<#
.SYNOPSIS
Starts Budgeter like a desktop app: runs the API and the web app in the background and opens it in the
default browser. The servers keep running afterwards (scripts\stop-app.ps1 stops them); opening it again
reuses them.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\launch-app.ps1
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$apiUrl = 'http://localhost:5099'
$webUrl = 'http://localhost:4200'
$appData = Join-Path $env:LOCALAPPDATA 'Budgeter'
$logDir = Join-Path $appData 'logs'
$startupTimeoutSeconds = 240
$apiProject = Join-Path $root 'apps\api'
$apiDll = Join-Path $apiProject 'bin\Release\net10.0\Budgeter.Api.dll'
$splash = $null

# A hidden script has no message loop, so the splash only paints while the waiting loops call this.
function Update-Splash {
    if ($splash) { [System.Windows.Forms.Application]::DoEvents() }
}

function Show-Splash {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $form = New-Object System.Windows.Forms.Form
    $form.FormBorderStyle = 'None'
    $form.StartPosition = 'CenterScreen'
    $form.TopMost = $true
    $form.ShowInTaskbar = $false
    $form.Size = New-Object System.Drawing.Size 360, 150
    $form.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#050507')
    $form.Controls.Add((New-SplashLabel 'Budgeter' 22 24 ([System.Drawing.FontStyle]::Bold)))
    $form.Controls.Add((New-SplashLabel 'Starting...' 11 76 ([System.Drawing.FontStyle]::Regular)))
    $bar = New-Object System.Windows.Forms.ProgressBar
    $bar.Style = 'Marquee'
    $bar.SetBounds(30, 112, 300, 6)
    $form.Controls.Add($bar)
    $form.Show()
    return $form
}

function New-SplashLabel([string] $Text, [int] $Size, [int] $Top, $Style) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.Font = New-Object System.Drawing.Font 'Segoe UI', $Size, $Style
    $label.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#2EF2A6')
    $label.AutoSize = $false
    $label.TextAlign = 'MiddleCenter'
    $label.SetBounds(0, $Top, 360, 40)
    return $label
}

function Close-Splash {
    if ($script:splash) { $script:splash.Close(); $script:splash = $null }
}

# Waits for a process without freezing the splash.
function Wait-ProcessWithSplash($Process) {
    # Windows PowerShell 5.1 never updates HasExited of a Start-Process -PassThru object (no -Wait) until
    # its Handle has been read once.
    $null = $Process.Handle
    while (-not $Process.HasExited) { Update-Splash; Start-Sleep -Milliseconds 100 }
}

function Test-Url([string] $Url) {
    try {
        Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    }
    catch { return $false }
}

# The first start after a clone has no node_modules yet.
function Install-WebDependencies {
    $webDir = Join-Path $root 'apps\web'
    if (Test-Path (Join-Path $webDir 'node_modules')) { return }
    $install = Start-Process -FilePath 'npm.cmd' -ArgumentList 'ci', '--ignore-scripts' `
        -WorkingDirectory $webDir -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logDir 'npm.out.log') `
        -RedirectStandardError (Join-Path $logDir 'npm.err.log')
    Wait-ProcessWithSplash $install
    if ($install.ExitCode -ne 0) { throw "npm ci failed (exit $($install.ExitCode)); see $logDir" }
}

function Start-Service([string] $Name, [string] $File, [string[]] $Arguments, [string] $Directory) {
    Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $Directory `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logDir "$Name.out.log") `
        -RedirectStandardError (Join-Path $logDir "$Name.err.log")
}

# `dotnet run` re-checks and rebuilds on every start, which cost most of the API's startup time, so the
# compiled build is run directly and only rebuilt when a source file is newer than it.
function Test-ApiBuildStale {
    if (-not (Test-Path $apiDll)) { return $true }
    $builtAt = (Get-Item $apiDll).LastWriteTimeUtc
    $newest = Get-ChildItem $apiProject -Recurse -File -Include '*.cs', '*.csproj', 'appsettings*.json' |
        Where-Object { $_.FullName -notmatch '\\(bin|obj|tests)\\' } |
        Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    return $newest.LastWriteTimeUtc -gt $builtAt
}

function Build-Api {
    if (-not (Test-ApiBuildStale)) { return }
    $build = Start-Process -FilePath 'dotnet' -ArgumentList 'build', '-c', 'Release', '--nologo' `
        -WorkingDirectory $apiProject -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logDir 'api-build.out.log') `
        -RedirectStandardError (Join-Path $logDir 'api-build.err.log')
    Wait-ProcessWithSplash $build
    if ($build.ExitCode -ne 0) { throw "The API build failed (exit $($build.ExitCode)); see $logDir" }
}

# Run from the project folder, as `dotnet run` does, so the relative database path stays apps\api\budgeter.db.
function Start-Api {
    Build-Api
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = $apiUrl
    Start-Service 'api' 'dotnet' @("`"$apiDll`"") $apiProject
}

function Start-Web {
    Start-Service 'web' 'npm.cmd' @('start', '--', '--port', '4200') (Join-Path $root 'apps\web')
}

function Wait-Until([string] $Url, [string] $What) {
    $deadline = (Get-Date).AddSeconds($startupTimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Url $Url) { return }
        Update-Splash
        Start-Sleep -Milliseconds 300
    }
    throw "$What did not answer at $Url within $startupTimeoutSeconds seconds; see $logDir"
}

function Stop-Tree($Process) {
    if ($Process -and -not $Process.HasExited) { & taskkill /PID $Process.Id /T /F | Out-Null }
}

function Show-Failure([string] $Message) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($Message, 'Budgeter', 'OK', 'Error') | Out-Null
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$started = @()
try {
    $splash = Show-Splash
    Install-WebDependencies
    # Servers already running (from an earlier launch or scripts\dev.ps1) are reused: opening the shortcut
    # again just opens another tab. The web app is slower to start, so it goes first and builds while
    # the API compiles.
    if (-not (Test-Url $webUrl)) { $started += Start-Web }
    if (-not (Test-Url "$apiUrl/health")) { $started += Start-Api }
    Wait-Until "$apiUrl/health" 'The API'
    Wait-Until $webUrl 'The web app'
    Close-Splash
    # The default browser has no window this script could wait on, so the servers keep running after it
    # exits; scripts\stop-app.ps1 stops them.
    Start-Process $webUrl
}
catch {
    Close-Splash
    $started | ForEach-Object { Stop-Tree $_ }
    # Logged first: a hidden script that dies while showing the message would otherwise leave no trace.
    "$(Get-Date -Format s) $($_ | Out-String)" | Add-Content (Join-Path $logDir 'launcher.log')
    Show-Failure $_.Exception.Message
}

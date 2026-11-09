<#
.SYNOPSIS
Starts Budgeter like a desktop app: runs the API and the web app in the background and opens it in its
own browser window; closing that window stops what this script started.

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
        -WorkingDirectory $webDir -WindowStyle Hidden -PassThru -Wait `
        -RedirectStandardOutput (Join-Path $logDir 'npm.out.log') `
        -RedirectStandardError (Join-Path $logDir 'npm.err.log')
    if ($install.ExitCode -ne 0) { throw "npm ci failed (exit $($install.ExitCode)); see $logDir" }
}

function Start-Service([string] $Name, [string] $File, [string[]] $Arguments, [string] $Directory) {
    Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $Directory `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logDir "$Name.out.log") `
        -RedirectStandardError (Join-Path $logDir "$Name.err.log")
}

# Same setup as `dotnet run` in development (it holds the connection string), minus the launch profile
# that would open a second browser tab on the API.
function Start-Api {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = $apiUrl
    Start-Service 'api' 'dotnet' @('run', '--no-launch-profile') (Join-Path $root 'apps\api')
}

function Start-Web {
    Start-Service 'web' 'npm.cmd' @('start', '--', '--port', '4200') (Join-Path $root 'apps\web')
}

function Wait-Until([string] $Url, [string] $What) {
    $deadline = (Get-Date).AddSeconds($startupTimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Url $Url) { return }
        Start-Sleep -Milliseconds 700
    }
    throw "$What did not answer at $Url within $startupTimeoutSeconds seconds; see $logDir"
}

# Edge ships with Windows, so it is the first choice; Chrome is the fallback.
function Find-AppBrowser {
    foreach ($name in 'msedge.exe', 'chrome.exe') {
        foreach ($hive in 'HKLM', 'HKCU') {
            $key = "${hive}:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$name"
            $path = (Get-ItemProperty -Path $key -ErrorAction SilentlyContinue).'(default)'
            if ($path -and (Test-Path $path)) { return $path }
        }
    }
    return $null
}

# A profile of its own makes the window a separate instance, so waiting for it to close works.
function Open-AppWindow {
    $browser = Find-AppBrowser
    if (-not $browser) {
        Start-Process $webUrl
        return $null
    }
    $profile = Join-Path $appData 'browser-profile'
    return Start-Process -FilePath $browser -PassThru -ArgumentList `
        "--app=$webUrl", "--user-data-dir=`"$profile`"", '--no-first-run', '--no-default-browser-check'
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
    Install-WebDependencies
    # Servers already running (for example from scripts\dev.ps1) are reused and left running on exit.
    if (-not (Test-Url "$apiUrl/health")) { $started += Start-Api }
    if (-not (Test-Url $webUrl)) { $started += Start-Web }
    Wait-Until "$apiUrl/health" 'The API'
    Wait-Until $webUrl 'The web app'
    $window = Open-AppWindow
    # Without a window of its own there is nothing to wait for, so the servers stay up.
    if (-not $window) { $started = @() }
    elseif ($started.Count -gt 0) { $window.WaitForExit() }
}
catch {
    $started | ForEach-Object { Stop-Tree $_ }
    $started = @()
    Show-Failure $_.Exception.Message
}
finally {
    $started | ForEach-Object { Stop-Tree $_ }
}

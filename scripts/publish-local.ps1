<#
.SYNOPSIS
Installs Orbit on this computer, or updates an installed one, without touching the data: the API and the
compiled web app run as one process on one port, and the data lives in its own folder.

An update builds the new version first (Orbit keeps running meanwhile), then stops it, copies the database
to data\backups, swaps the program folder and starts the new version. The new version creates any table or
column it needs by itself when it starts (see SqliteSchema and SqliteMigrations). If it does not come up,
the previous program and the copy of the database are put back and Orbit is started again.

.PARAMETER Destination
Where Orbit is installed. Default: C:\Orbit.

.PARAMETER BackupsKept
How many database copies made before an update are kept. Default: 10.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\publish-local.ps1
.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\publish-local.ps1 -Destination D:\Apps\Orbit
#>
param([string] $Destination = 'C:\Orbit', [int] $BackupsKept = 10)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $Destination 'app'
$newAppDir = Join-Path $Destination 'app.new'
$previousAppDir = Join-Path $Destination 'app.previous'
$dataDir = Join-Path $Destination 'data'
$backupDir = Join-Path $dataDir 'backups'
$databaseFile = Join-Path $dataDir 'orbit.db'
$webDir = Join-Path $root 'apps\web'

function Invoke-Step([string] $Title, [scriptblock] $Action) {
    Write-Host "==> $Title"
    & $Action
    if ($LASTEXITCODE -ne 0) { throw "$Title failed (exit $LASTEXITCODE)" }
}

function Build-NewApp {
    if (-not (Test-Path (Join-Path $webDir 'node_modules'))) {
        Invoke-Step 'Installing web dependencies' { npm ci --ignore-scripts --prefix $webDir }
    }
    Invoke-Step 'Building the web app' { npm run build --prefix $webDir }
    if (Test-Path $newAppDir) { Remove-Item -LiteralPath $newAppDir -Recurse -Force }
    Invoke-Step 'Publishing the API' {
        dotnet publish (Join-Path $root 'apps\api\Orbit.Api.csproj') -c Release -o $newAppDir --nologo
    }
    # The API serves what is in wwwroot (see BundledWebApp.cs).
    Copy-Item -Path (Join-Path $webDir 'dist\web\browser') -Destination (Join-Path $newAppDir 'wwwroot') -Recurse
    Remove-Item -LiteralPath (Join-Path $newAppDir 'orbit.db'), (Join-Path $newAppDir 'auth-dev.key') -ErrorAction SilentlyContinue
}

function Stop-Orbit {
    $stopper = Join-Path $Destination 'stop-orbit.ps1'
    if (Test-Path $stopper) { & $stopper }
}

function Start-Orbit {
    & (Join-Path $Destination 'start-orbit.ps1') -NoBrowser
}

function New-SigningKeyFile {
    $keyFile = Join-Path $dataDir 'auth.key'
    if (Test-Path $keyFile) { return }
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    [Convert]::ToBase64String($bytes) | Set-Content -LiteralPath $keyFile -Encoding ascii
}

# Orbit is stopped, so the single file is a consistent copy.
function Save-DatabaseCopy {
    if (-not (Test-Path $databaseFile)) { return $null }
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    $copy = Join-Path $backupDir "orbit-$(Get-Date -Format 'yyyy-MM-dd-HHmmss')-before-update.db"
    Copy-Item -LiteralPath $databaseFile -Destination $copy
    Get-ChildItem $backupDir -Filter 'orbit-*-before-update.db' | Sort-Object Name -Descending |
        Select-Object -Skip $BackupsKept | Remove-Item
    return $copy
}

function Install-NewApp {
    if (Test-Path $previousAppDir) { Remove-Item -LiteralPath $previousAppDir -Recurse -Force }
    if (Test-Path $appDir) { Move-Item -LiteralPath $appDir -Destination $previousAppDir }
    Move-Item -LiteralPath $newAppDir -Destination $appDir
}

function Restore-PreviousVersion([string] $databaseCopy) {
    Stop-Orbit
    if (Test-Path $appDir) { Remove-Item -LiteralPath $appDir -Recurse -Force }
    Move-Item -LiteralPath $previousAppDir -Destination $appDir
    if ($databaseCopy) { Copy-Item -LiteralPath $databaseCopy -Destination $databaseFile -Force }
    Start-Orbit
}

Build-NewApp
New-Item -ItemType Directory -Force -Path $Destination, $dataDir | Out-Null
New-SigningKeyFile
Copy-Item (Join-Path $PSScriptRoot 'start-orbit.ps1'), (Join-Path $PSScriptRoot 'stop-orbit.ps1') $Destination -Force

$hadPreviousVersion = Test-Path (Join-Path $appDir 'Orbit.Api.dll')
Write-Host '==> Stopping Orbit and copying the database'
Stop-Orbit
$databaseCopy = Save-DatabaseCopy
Install-NewApp

try {
    Write-Host '==> Starting the new version'
    Start-Orbit
}
catch {
    if (-not $hadPreviousVersion) { throw }
    Write-Host "The new version did not start: $($_.Exception.Message)"
    Write-Host '==> Putting the previous version and the database copy back'
    Restore-PreviousVersion $databaseCopy
    throw 'The update failed and was rolled back; Orbit is running the previous version again.'
}

Write-Host ''
Write-Host "Orbit is running the new version at http://localhost:5050 (installed in $Destination)."
if ($databaseCopy) { Write-Host "A copy of the database from before the update: $databaseCopy" }
Write-Host "Your data lives in $dataDir (back that folder up)."

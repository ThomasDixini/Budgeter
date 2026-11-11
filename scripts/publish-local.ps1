<#
.SYNOPSIS
Builds Orbit into a folder on this computer so it can be used for real, without the dev servers: the API
and the compiled web app run as one process on one port, and the data lives in its own folder.

Running it again updates the program (app\) and leaves the data (data\) alone. Stop Orbit first
(stop-orbit.ps1 in the destination); it is stopped for you when the script finds it running.

.PARAMETER Destination
Where Orbit is installed. Default: C:\Orbit.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\publish-local.ps1
.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\publish-local.ps1 -Destination D:\Apps\Orbit
#>
param([string] $Destination = 'C:\Orbit')
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $Destination 'app'
$dataDir = Join-Path $Destination 'data'
$webDir = Join-Path $root 'apps\web'

function Invoke-Step([string] $Title, [scriptblock] $Action) {
    Write-Host "==> $Title"
    & $Action
    if ($LASTEXITCODE -ne 0) { throw "$Title failed (exit $LASTEXITCODE)" }
}

function Stop-RunningOrbit {
    $stopper = Join-Path $Destination 'stop-orbit.ps1'
    if (Test-Path $stopper) { & $stopper }
}

function New-SigningKeyFile {
    $keyFile = Join-Path $dataDir 'auth.key'
    if (Test-Path $keyFile) { return }
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    [Convert]::ToBase64String($bytes) | Set-Content -LiteralPath $keyFile -Encoding ascii
}

Stop-RunningOrbit
New-Item -ItemType Directory -Force -Path $Destination, $dataDir | Out-Null

if (-not (Test-Path (Join-Path $webDir 'node_modules'))) {
    Invoke-Step 'Installing web dependencies' { npm ci --ignore-scripts --prefix $webDir }
}
Invoke-Step 'Building the web app' { npm run build --prefix $webDir }

# The program folder is replaced whole so files removed from the project do not linger.
if (Test-Path $appDir) { Remove-Item -LiteralPath $appDir -Recurse -Force }
Invoke-Step 'Publishing the API' {
    dotnet publish (Join-Path $root 'apps\api\Orbit.Api.csproj') -c Release -o $appDir --nologo
}
# The API serves what is in wwwroot (see BundledWebApp.cs).
Copy-Item -Path (Join-Path $webDir 'dist\web\browser') -Destination (Join-Path $appDir 'wwwroot') -Recurse
Remove-Item -LiteralPath (Join-Path $appDir 'orbit.db'), (Join-Path $appDir 'auth-dev.key') -ErrorAction SilentlyContinue

New-SigningKeyFile
Copy-Item (Join-Path $PSScriptRoot 'start-orbit.ps1'), (Join-Path $PSScriptRoot 'stop-orbit.ps1') $Destination -Force

Write-Host ''
Write-Host "Orbit is ready in $Destination"
Write-Host "Start it with: powershell -ExecutionPolicy Bypass -File `"$Destination\start-orbit.ps1`""
Write-Host "Your data lives in $dataDir (back that folder up)."

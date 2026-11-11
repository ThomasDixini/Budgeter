<#
.SYNOPSIS
Starts the installed Orbit (see publish-local.ps1) in the background and opens it in the browser. If it is
already running it only opens the browser. It keeps running until stop-orbit.ps1.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File C:\Orbit\start-orbit.ps1
#>
param([switch] $NoBrowser)
$ErrorActionPreference = 'Stop'

$orbitHome = $PSScriptRoot
$appDir = Join-Path $orbitHome 'app'
$dataDir = Join-Path $orbitHome 'data'
$logDir = Join-Path $dataDir 'logs'
$pidFile = Join-Path $dataDir 'orbit.pid'
$port = 5050
$url = "http://localhost:$port"
$timeoutSeconds = 60

function Test-Orbit {
    try { Invoke-WebRequest -Uri "$url/health" -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true }
    catch { return $false }
}

if (Test-Orbit) { if (-not $NoBrowser) { Start-Process $url }; return }
if (-not (Test-Path (Join-Path $appDir 'Orbit.Api.dll'))) { throw "Orbit is not installed in $orbitHome; run scripts\publish-local.ps1 first." }

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:ASPNETCORE_URLS = $url
$env:ConnectionStrings__Orbit = "Data Source=$(Join-Path $dataDir 'orbit.db')"
$env:Auth__SigningKey = (Get-Content -LiteralPath (Join-Path $dataDir 'auth.key') -Raw).Trim()

$api = Start-Process -FilePath 'dotnet' -ArgumentList "`"$(Join-Path $appDir 'Orbit.Api.dll')`"" `
    -WorkingDirectory $appDir -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDir 'orbit.out.log') `
    -RedirectStandardError (Join-Path $logDir 'orbit.err.log')
$api.Id | Set-Content -LiteralPath $pidFile

$deadline = (Get-Date).AddSeconds($timeoutSeconds)
while ((Get-Date) -lt $deadline) {
    if (Test-Orbit) { if (-not $NoBrowser) { Start-Process $url }; return }
    Start-Sleep -Milliseconds 300
}
throw "Orbit did not answer at $url within $timeoutSeconds seconds; see $logDir"

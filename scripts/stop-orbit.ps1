<#
.SYNOPSIS
Stops the installed Orbit started by start-orbit.ps1. Safe to run when it is not running.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File C:\Orbit\stop-orbit.ps1
#>
$pidFile = Join-Path $PSScriptRoot 'data\orbit.pid'
if (-not (Test-Path $pidFile)) { return }

$processId = [int](Get-Content -LiteralPath $pidFile -Raw)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
# Only a dotnet process: the number may have been reused by something else since Orbit stopped.
if ($process -and $process.ProcessName -eq 'dotnet') {
    Stop-Process -Id $processId
    $process.WaitForExit(10000) | Out-Null
}
Remove-Item -LiteralPath $pidFile

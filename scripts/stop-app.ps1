<#
.SYNOPSIS
Stops the API and the web app that the Orbit shortcut (launch-app.ps1) left running in the background.
They are found by the ports they listen on (5099 and 4200), so servers started by scripts\dev.ps1 stop too.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\stop-app.ps1
.EXAMPLE
npm run stop-app --prefix apps/web
#>
$ErrorActionPreference = 'Stop'

$ports = 5099, 4200
$owners = Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

if (-not $owners) {
    Write-Host 'Orbit is not running.'
    return
}

# /T also takes down the children (npm starts node, which starts the dev server).
foreach ($owner in $owners) { & taskkill /PID $owner /T /F | Out-Null }
Write-Host 'Orbit stopped.'

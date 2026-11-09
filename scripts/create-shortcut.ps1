<#
.SYNOPSIS
Creates the "Orbit" shortcut on the Desktop; it starts the app like a desktop program (see
launch-app.ps1). Safe to run again: it rewrites the shortcut, e.g. after moving the project folder.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1
.EXAMPLE
npm run create-shortcut --prefix apps/web
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'launch-app.ps1'
# The same icon the browser tab shows. It is copied out of the project so the shortcut keeps its icon
# even while the project folder is being moved or recloned.
$sourceIcon = Join-Path $root 'apps\web\public\favicon.ico'
$iconPath = Join-Path $env:LOCALAPPDATA 'Orbit\orbit.ico'
# The Desktop can be redirected (OneDrive), so ask Windows instead of assuming %USERPROFILE%\Desktop.
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Orbit.lnk'

function New-Shortcut {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
    $shortcut.WorkingDirectory = $root
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = 'Orbit: routines, goals and finances'
    $shortcut.WindowStyle = 7
    $shortcut.Save()
}

New-Item -ItemType Directory -Force -Path (Split-Path $iconPath) | Out-Null
Copy-Item -LiteralPath $sourceIcon -Destination $iconPath -Force
New-Shortcut
Write-Host "Shortcut created: $shortcutPath"

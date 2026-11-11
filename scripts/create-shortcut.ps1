<#
.SYNOPSIS
Creates the "Orbit" shortcut on the Desktop; it starts the app like a desktop program (see
launch-app.ps1). Safe to run again: it rewrites the shortcut, e.g. after moving the project folder.

.PARAMETER Launcher
The script the shortcut runs. Default: launch-app.ps1 (the dev servers). Pass the start-orbit.ps1 of an
installed build (see publish-local.ps1) to open that instead.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1
.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1 -Launcher C:\Orbit\start-orbit.ps1
.EXAMPLE
npm run create-shortcut --prefix apps/web
#>
param([string] $Launcher = (Join-Path $PSScriptRoot 'launch-app.ps1'))
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$launcher = $Launcher
# An installed build runs from its own folder; the dev launcher works from the project.
$workingDirectory = if ($PSBoundParameters.ContainsKey('Launcher')) { Split-Path -Parent $Launcher } else { $root }
# The same icon the browser tab shows. It is copied out of the project so the shortcut keeps its icon
# even while the project folder is being moved or recloned.
$sourceIcon = Join-Path $root 'apps\web\public\favicon.ico'
# Windows caches shortcut icons by file path, so an icon that changes must come with a new file name
# (bump the number) or Explorer keeps showing the old one.
$iconPath = Join-Path $env:LOCALAPPDATA 'Orbit\orbit-icon-2.ico'
# The Desktop can be redirected (OneDrive), so ask Windows instead of assuming %USERPROFILE%\Desktop.
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Orbit.lnk'

function New-Shortcut {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
    $shortcut.WorkingDirectory = $workingDirectory
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = 'Orbit: routines, goals and finances'
    $shortcut.WindowStyle = 7
    $shortcut.Save()
}

New-Item -ItemType Directory -Force -Path (Split-Path $iconPath) | Out-Null
Copy-Item -LiteralPath $sourceIcon -Destination $iconPath -Force
New-Shortcut
Write-Host "Shortcut created: $shortcutPath"

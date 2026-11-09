<#
.SYNOPSIS
Creates the "Budgeter" shortcut on the Desktop; it starts the app like a desktop program (see
launch-app.ps1). Safe to run again: it rewrites the shortcut, e.g. after moving the project folder.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1
.EXAMPLE
npm run create-shortcut --prefix apps/web
#>
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'launch-app.ps1'
$iconPath = Join-Path $env:LOCALAPPDATA 'Budgeter\budgeter.ico'
# The Desktop can be redirected (OneDrive), so ask Windows instead of assuming %USERPROFILE%\Desktop.
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Budgeter.lnk'

$background = [System.Drawing.ColorTranslator]::FromHtml('#050507')
$mint = [System.Drawing.ColorTranslator]::FromHtml('#2EF2A6')
$text = [System.Drawing.ColorTranslator]::FromHtml('#F5F5F7')

function New-IconImage([int] $Size) {
    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = 'AntiAlias'
    $graphics.TextRenderingHint = 'AntiAliasGridFit'
    $graphics.Clear([System.Drawing.Color]::Transparent)
    Add-RoundedBackground $graphics $Size
    Add-MintRing $graphics $Size
    Add-Letter $graphics $Size
    $graphics.Dispose()
    return $bitmap
}

function Add-RoundedBackground($Graphics, [int] $Size) {
    $radius = $Size * 0.22
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($Size - $d - 1, 0, $d, $d, 270, 90)
    $path.AddArc($Size - $d - 1, $Size - $d - 1, $d, $d, 0, 90)
    $path.AddArc(0, $Size - $d - 1, $d, $d, 90, 90)
    $path.CloseFigure()
    $Graphics.FillPath((New-Object System.Drawing.SolidBrush $background), $path)
}

function Add-MintRing($Graphics, [int] $Size) {
    $inset = $Size * 0.14
    $pen = New-Object System.Drawing.Pen $mint, ([Math]::Max(1.5, $Size * 0.055))
    $Graphics.DrawEllipse($pen, $inset, $inset, $Size - 2 * $inset, $Size - 2 * $inset)
}

function Add-Letter($Graphics, [int] $Size) {
    $font = New-Object System.Drawing.Font 'Segoe UI', ($Size * 0.36), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = 'Center'
    $format.LineAlignment = 'Center'
    $area = New-Object System.Drawing.RectangleF 0, ($Size * 0.02), $Size, $Size
    $Graphics.DrawString('B', $font, (New-Object System.Drawing.SolidBrush $text), $area, $format)
}

# An .ico is a directory of images; PNG-encoded entries are understood since Windows Vista.
function Save-Icon([string] $Path, [int[]] $Sizes) {
    $images = foreach ($size in $Sizes) {
        $stream = New-Object System.IO.MemoryStream
        (New-IconImage $size).Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        , $stream.ToArray()
    }
    $file = [System.IO.File]::Create($Path)
    $writer = New-Object System.IO.BinaryWriter $file
    Write-IconDirectory $writer $Sizes $images
    foreach ($image in $images) { $writer.Write([byte[]] $image) }
    $writer.Dispose()
}

function Write-IconDirectory($Writer, [int[]] $Sizes, $Images) {
    $Writer.Write([uint16] 0); $Writer.Write([uint16] 1); $Writer.Write([uint16] $Sizes.Count)
    $offset = 6 + 16 * $Sizes.Count
    for ($i = 0; $i -lt $Sizes.Count; $i++) {
        $dimension = if ($Sizes[$i] -ge 256) { 0 } else { $Sizes[$i] }
        $Writer.Write([byte] $dimension); $Writer.Write([byte] $dimension)
        $Writer.Write([byte] 0); $Writer.Write([byte] 0)
        $Writer.Write([uint16] 1); $Writer.Write([uint16] 32)
        $Writer.Write([uint32] $Images[$i].Length); $Writer.Write([uint32] $offset)
        $offset += $Images[$i].Length
    }
}

function New-Shortcut {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
    $shortcut.WorkingDirectory = $root
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = 'Budgeter: routines, goals and finances'
    $shortcut.WindowStyle = 7
    $shortcut.Save()
}

New-Item -ItemType Directory -Force -Path (Split-Path $iconPath) | Out-Null
Save-Icon $iconPath @(256, 64, 48, 32, 16)
New-Shortcut
Write-Host "Shortcut created: $shortcutPath"

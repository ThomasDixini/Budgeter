$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:TEMP "budgetcontroller-dev"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$services = @(
    @{
        Name = "api"
        Dir  = Join-Path $root "apps\api"
        File = "dotnet"
        Args = @("run")
        Out  = Join-Path $logDir "api.out.log"
        Err  = Join-Path $logDir "api.err.log"
    },
    @{
        Name = "web"
        Dir  = Join-Path $root "apps\web"
        File = "npm.cmd"
        Args = @("start")
        Out  = Join-Path $logDir "web.out.log"
        Err  = Join-Path $logDir "web.err.log"
    }
)

$offsets = @{}

foreach ($service in $services) {
    Remove-Item $service.Out, $service.Err -ErrorAction SilentlyContinue
    $offsets[$service.Out] = 0
    $offsets[$service.Err] = 0
    $service.Process = Start-Process -FilePath $service.File `
        -ArgumentList $service.Args `
        -WorkingDirectory $service.Dir `
        -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $service.Out `
        -RedirectStandardError $service.Err
}

Write-Host "[dev] API  -> http://localhost:5099"
Write-Host "[dev] Web  -> http://localhost:4200"
Write-Host "[dev] Press Ctrl+C to stop both."

function Write-NewLogLines {
    param($Path, $Prefix)

    if (-not (Test-Path -LiteralPath $Path)) { return }

    $lines = @(Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue)
    $start = $offsets[$Path]

    for ($index = $start; $index -lt $lines.Count; $index++) {
        Write-Host "[$Prefix] $($lines[$index])"
    }

    $offsets[$Path] = $lines.Count
}

try {
    while ($true) {
        $anyRunning = $false

        foreach ($service in $services) {
            Write-NewLogLines -Path $service.Out -Prefix $service.Name
            Write-NewLogLines -Path $service.Err -Prefix $service.Name
            if (-not $service.Process.HasExited) { $anyRunning = $true }
        }

        if (-not $anyRunning) { break }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    foreach ($service in $services) {
        if ($service.Process -and -not $service.Process.HasExited) {
            & taskkill /PID $service.Process.Id /T /F | Out-Null
        }
    }
    Write-Host "[dev] Stopped."
}

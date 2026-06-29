# Start local development environment
# Run from the project root: .\start-dev.ps1

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

# Refresh PATH so firebase and node are available
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("PATH", "User")

Write-Host "Starting Firebase emulators..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$projectDir'
  `$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
  firebase emulators:start --project teacherfail
" -WindowStyle Normal

Write-Host "Waiting for emulators to be ready..." -ForegroundColor Yellow
$timeout = 60
$elapsed = 0
$ready = $false
while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 2
    $elapsed += 2
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:4000" -TimeoutSec 1 -ErrorAction Stop
        $ready = $true
        break
    } catch {}
}

if (-not $ready) {
    Write-Host "Emulators took too long — check the emulator window for errors." -ForegroundColor Red
    exit 1
}

Write-Host "Emulators ready. Starting Next.js dev server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$projectDir'
  npm run dev
" -WindowStyle Normal

Write-Host ""
Write-Host "All services started:" -ForegroundColor Green
Write-Host "  App          http://localhost:3000" -ForegroundColor White
Write-Host "  Emulator UI  http://localhost:4000" -ForegroundColor White
Write-Host ""
Write-Host "Close the two terminal windows to stop." -ForegroundColor Gray

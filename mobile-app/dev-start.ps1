# Azure Lens Development Server - PowerShell Version
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "       Azure Lens - Development Server" -ForegroundColor Cyan  
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Set location to script directory
Set-Location $PSScriptRoot

# Add Node.js to PATH for this session
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

Write-Host "Checking environment..." -ForegroundColor Yellow

if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies!" -ForegroundColor Red
        Read-Host "Press Enter to continue"
        exit 1
    }
}

Write-Host ""
Write-Host "Starting Expo development server..." -ForegroundColor Green
Write-Host ""
Write-Host "Options:" -ForegroundColor White
Write-Host "- Scan QR code with Expo Go app on your phone" -ForegroundColor Gray
Write-Host "- Press 'i' for iOS simulator" -ForegroundColor Gray
Write-Host "- Press 'a' for Android emulator" -ForegroundColor Gray
Write-Host "- Press 'w' for web browser" -ForegroundColor Gray
Write-Host ""

& npx expo start --go --clear

Read-Host "Press Enter to continue"

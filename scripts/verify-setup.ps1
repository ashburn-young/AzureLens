# AzureLens PowerShell Deployment Verification Script

Write-Host "🔍 AzureLens Deployment Verification" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check if Azure CLI is installed
try {
    $azVersion = az --version 2>$null
    Write-Host "✅ Azure CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Azure CLI is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Check if Azure Developer CLI is installed
try {
    $azdVersion = azd version 2>$null
    Write-Host "✅ Azure Developer CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Azure Developer CLI is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    Write-Host "✅ Node.js is installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+." -ForegroundColor Red
    exit 1
}

# Check if Expo CLI is available
try {
    $expoVersion = npx expo --version 2>$null
    Write-Host "✅ Expo CLI is available" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Expo CLI not found. Install with: npm install -g @expo/cli" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Quick Start Commands:" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host "1. Login to Azure:     az login; azd auth login"
Write-Host "2. Deploy backend:     azd up"
Write-Host "3. Start mobile app:   cd mobile-app; npx expo start --tunnel"
Write-Host ""
Write-Host "📖 Full documentation: README.md" -ForegroundColor Green
Write-Host "🌐 GitHub repository:  https://github.com/ashburn-young/AzureLens" -ForegroundColor Green

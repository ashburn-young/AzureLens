#!/bin/bash

# AzureLens Deployment Verification Script
echo "🔍 AzureLens Deployment Verification"
echo "================================="

# Check if Azure CLI is installed
if command -v az &> /dev/null; then
    echo "✅ Azure CLI is installed"
else
    echo "❌ Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if Azure Developer CLI is installed
if command -v azd &> /dev/null; then
    echo "✅ Azure Developer CLI is installed"
else
    echo "❌ Azure Developer CLI is not installed. Please install it first."
    exit 1
fi

# Check if Node.js is installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js is installed: $NODE_VERSION"
else
    echo "❌ Node.js is not installed. Please install Node.js 18+."
    exit 1
fi

# Check if Expo CLI is available
if command -v expo &> /dev/null; then
    echo "✅ Expo CLI is available"
else
    echo "⚠️  Expo CLI not found. Install with: npm install -g @expo/cli"
fi

echo ""
echo "🚀 Quick Start Commands:"
echo "========================"
echo "1. Login to Azure:     az login && azd auth login"
echo "2. Deploy backend:     azd up"
echo "3. Start mobile app:   cd mobile-app && npx expo start --tunnel"
echo ""
echo "📖 Full documentation: README.md"
echo "🌐 GitHub repository:  https://github.com/ashburn-young/AzureLens"

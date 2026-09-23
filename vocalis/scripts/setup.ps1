# AI Meeting Assistant - Local Setup Script
Write-Host "Setting up AI Meeting Assistant Monorepo..." -ForegroundColor Cyan

# 1. Verify Node.js
$nodeVersion = node -v
Write-Host "Node version: $nodeVersion" -ForegroundColor Green

# 2. Copy .env.example to .env if not exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
} else {
    Write-Host ".env already exists, preserving existing file." -ForegroundColor Gray
}

# 3. Install Monorepo Dependencies
Write-Host "Installing npm dependencies across workspaces..." -ForegroundColor Cyan
npm install

# 4. Build Shared Types
Write-Host "Building @meeting-assistant/shared-types..." -ForegroundColor Cyan
npm run build -w @meeting-assistant/shared-types

Write-Host "Setup completed successfully! Run 'npm run dev' or '.\scripts\dev.ps1' to start." -ForegroundColor Green

$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

& (Join-Path $RootDir "scripts/check-env.ps1")

Write-Host "Installing dependencies..."
npm install

Write-Host "Building packages..."
npm run build

Write-Host "Running tests..."
npm test

Write-Host "Checking CLI environment..."
npm run cli -- doctor

Write-Host "Setup complete. Try: npm run cli -- version"

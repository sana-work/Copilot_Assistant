$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

Write-Host "Checking Copilot Architect environment..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required. Install Node.js 20.11 or newer."
}

$nodeVersion = node -p "process.versions.node"
$parts = $nodeVersion.Split(".")
$major = [int]$parts[0]
$minor = [int]$parts[1]

if ($major -lt 20 -or ($major -eq 20 -and $minor -lt 11)) {
  throw "Node.js 20.11 or newer is required. Current: v$nodeVersion"
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm is required for the MVP setup."
}

Write-Host "Node: v$nodeVersion"
Write-Host "npm: $(npm -v)"
Write-Host "Environment check passed."

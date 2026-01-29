# GitHub Pull Script (PowerShell)
# Usage: .\.github-pull.ps1

# Configuration
$GITHUB_USERNAME = "medamine980"
$GITHUB_TOKEN = $env:GITHUB_TOKEN
if (-not $GITHUB_TOKEN) {
    $GITHUB_TOKEN = "your_github_token_here"
}
$REPO_URL = "https://github.com/medamine980/Share-The-Vows-Backend.git"

# Colors
$GREEN = [ConsoleColor]::Green
$YELLOW = [ConsoleColor]::Yellow
$RED = [ConsoleColor]::Red

Write-Host "Pulling latest changes from GitHub..." -ForegroundColor $YELLOW

# Check if GITHUB_TOKEN is set
if ($GITHUB_TOKEN -eq "your_github_token_here") {
    Write-Host "Error: GITHUB_TOKEN environment variable not set" -ForegroundColor $RED
    Write-Host "Please set it with: `$env:GITHUB_TOKEN = 'your_token'" -ForegroundColor $RED
    exit 1
}

# Pull using token authentication
git pull "https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/medamine980/Share-The-Vows-Backend.git"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully pulled latest changes" -ForegroundColor $GREEN
} else {
    Write-Host "✗ Failed to pull changes" -ForegroundColor $RED
    exit 1
}

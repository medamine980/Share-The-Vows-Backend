#!/bin/bash

# GitHub Pull Script
# Usage: ./github-pull.sh

# Configuration
GITHUB_USERNAME="medamine980"
GITHUB_TOKEN="${GITHUB_TOKEN:-your_github_token_here}"
REPO_URL="https://github.com/medamine980/Share-The-Vows-Backend.git"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Pulling latest changes from GitHub...${NC}"

# Check if GITHUB_TOKEN is set
if [ "$GITHUB_TOKEN" = "your_github_token_here" ]; then
    echo -e "${RED}Error: GITHUB_TOKEN environment variable not set${NC}"
    echo "Please set it with: export GITHUB_TOKEN=your_token"
    exit 1
fi

# Pull using token authentication
git pull https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/medamine980/Share-The-Vows-Backend.git

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully pulled latest changes${NC}"
else
    echo -e "${RED}✗ Failed to pull changes${NC}"
    exit 1
fi

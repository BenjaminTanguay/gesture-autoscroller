#!/bin/bash

# Quick test script for the extension
# This validates the extension without opening Firefox

set -e

echo "🧪 Testing Gesture AutoScroller Extension..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(dirname "${BASH_SOURCE[0]}")"

# Check structure
echo -e "${BLUE}Checking project structure...${NC}"
if [ ! -d "src" ]; then
    echo -e "${RED}❌ src/ directory not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ src/ directory exists${NC}"

if [ ! -f "src/manifest.json" ]; then
    echo -e "${RED}❌ manifest.json not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ manifest.json exists${NC}"

if [ ! -f "src/content.js" ]; then
    echo -e "${RED}❌ content.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ content.js exists${NC}"

if [ ! -f "src/icons/icon-48.png" ]; then
    echo -e "${RED}❌ icon-48.png not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Icons exist${NC}"

echo ""
echo -e "${BLUE}Validating extension with web-ext...${NC}"

# Check if web-ext is installed
if ! command -v web-ext &> /dev/null; then
    echo -e "${RED}❌ web-ext is not installed!${NC}"
    echo ""
    echo -e "${YELLOW}Please install web-ext using one of these methods:${NC}"
    echo ""
    echo -e "${BLUE}Option 1 - npm (if you have Node.js):${NC}"
    echo "  npm install -g web-ext"
    echo ""
    echo -e "${BLUE}Option 2 - System package manager:${NC}"
    echo "  macOS:   brew install web-ext"
    echo "  Linux:   Check your package manager (apt, dnf, pacman, etc.)"
    echo ""
    echo -e "${BLUE}Option 3 - npx (no global install needed):${NC}"
    echo "  npx web-ext lint --source-dir=src --warnings-as-errors=false"
    echo ""
    echo "For more info: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/"
    exit 1
fi

web-ext lint --source-dir=src --warnings-as-errors=false

echo ""
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo -e "${YELLOW}To run the extension in Firefox:${NC}"
echo -e "  ${BLUE}./run-firefox.sh${NC}"
echo ""

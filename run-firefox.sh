#!/bin/bash

# Gesture AutoScroller - Firefox Auto-Load Script
# This script automatically loads the extension in Firefox for development testing

set -e

echo "🚀 Starting Gesture AutoScroller Firefox Auto-Load..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/src"

echo -e "${BLUE}Extension directory: ${EXTENSION_DIR}${NC}"

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
    echo "  Edit this script and replace 'web-ext' with 'npx web-ext'"
    echo ""
    echo "For more info: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/"
    exit 1
fi

# Check if extension directory exists
if [ ! -d "$EXTENSION_DIR" ]; then
    echo -e "${RED}❌ Extension directory not found: $EXTENSION_DIR${NC}"
    exit 1
fi

# Check if manifest.json exists
if [ ! -f "$EXTENSION_DIR/manifest.json" ]; then
    echo -e "${RED}❌ manifest.json not found in: $EXTENSION_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Extension files found${NC}"
echo -e "${BLUE}Starting Firefox with extension...${NC}"
echo ""
echo -e "${YELLOW}Firefox will open automatically with the extension loaded.${NC}"
echo -e "${YELLOW}The extension will reload automatically when you save changes.${NC}"
echo ""
echo -e "Press ${GREEN}Ctrl+C${NC} to stop the auto-reload server."
echo ""

# Run web-ext with auto-reload
cd "$EXTENSION_DIR"
web-ext run \
  --browser-console \
  --start-url "about:debugging#/runtime/this-firefox" \
  --start-url "https://example.com"

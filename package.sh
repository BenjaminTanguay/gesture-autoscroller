#!/bin/bash

# Gesture AutoScroller - Package Script
# Creates a distributable .zip file for Firefox extension submission

set -e

echo "📦 Packaging Gesture AutoScroller Extension..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/src"
BUILD_DIR="$SCRIPT_DIR/web-ext-artifacts"
VERSION=$(grep '"version"' "$SOURCE_DIR/manifest.json" | sed 's/.*"version": "\(.*\)".*/\1/')
OUTPUT_NAME="gesture-autoscroller-${VERSION}.zip"

echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}Source directory: ${SOURCE_DIR}${NC}"
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}❌ Source directory not found: $SOURCE_DIR${NC}"
    exit 1
fi

# Check if manifest.json exists
if [ ! -f "$SOURCE_DIR/manifest.json" ]; then
    echo -e "${RED}❌ manifest.json not found in: $SOURCE_DIR${NC}"
    exit 1
fi

# Check if web-ext is installed
if ! command -v web-ext &> /dev/null; then
    echo -e "${YELLOW}⚠️  web-ext not found, using manual zip method${NC}"
    echo ""
    
    # Create build directory if it doesn't exist
    mkdir -p "$BUILD_DIR"
    
    # Create zip file manually
    echo -e "${BLUE}Creating zip file...${NC}"
    cd "$SOURCE_DIR"
    zip -r -FS "$BUILD_DIR/$OUTPUT_NAME" . \
        -x "*.DS_Store" \
        -x "*Thumbs.db" \
        -x "*.swp" \
        -x "*.swo" \
        -x "*~"
    
    cd "$SCRIPT_DIR"
    
    echo -e "${GREEN}✅ Package created: $BUILD_DIR/$OUTPUT_NAME${NC}"
else
    # Use web-ext to build (validates and creates proper package)
    echo -e "${BLUE}Using web-ext to build package...${NC}"
    echo ""
    
    web-ext build \
        --source-dir="$SOURCE_DIR" \
        --artifacts-dir="$BUILD_DIR" \
        --filename="$OUTPUT_NAME" \
        --overwrite-dest
    
    echo ""
    echo -e "${GREEN}✅ Package created and validated: $BUILD_DIR/$OUTPUT_NAME${NC}"
fi

# Display package info
echo ""
echo -e "${BLUE}📊 Package Information:${NC}"
ls -lh "$BUILD_DIR/$OUTPUT_NAME" | awk '{print "  Size: " $5}'
echo -e "  Location: ${BUILD_DIR}/${OUTPUT_NAME}"

# Calculate checksum
if command -v shasum &> /dev/null; then
    CHECKSUM=$(shasum -a 256 "$BUILD_DIR/$OUTPUT_NAME" | awk '{print $1}')
    echo -e "  SHA256: ${CHECKSUM}"
fi

echo ""
echo -e "${GREEN}✅ Packaging complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Test the package: unzip and load in Firefox"
echo "  2. Submit to Mozilla Add-ons: https://addons.mozilla.org/developers/"
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo "  - Review the package contents before submitting"
echo "  - Ensure manifest.json version is correct"
echo "  - Have your release notes ready"
echo ""

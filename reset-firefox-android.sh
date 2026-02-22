#!/bin/bash

# Script to force close Firefox and clear its data before redeploying
# This fixes issues where the extension doesn't reinstall after manual removal

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔄 Firefox Reset for Extension Redeployment${NC}\n"

# Check if adb is available
if ! command -v adb &> /dev/null; then
    echo -e "${RED}❌ Error: adb is not installed${NC}"
    exit 1
fi

# Get device
DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | awk '{print $1}')
if [ -z "$DEVICES" ]; then
    echo -e "${RED}❌ No Android devices found${NC}"
    exit 1
fi

DEVICE_ID=$(echo "$DEVICES" | head -n 1)
echo -e "${GREEN}✓ Using device: $DEVICE_ID${NC}\n"

# Get Firefox package
PACKAGES=$(adb -s "$DEVICE_ID" shell pm list packages | grep -E "mozilla\.(firefox|fenix)" | sed 's/package://' | sort)
if [ -z "$PACKAGES" ]; then
    echo -e "${RED}❌ No Firefox installations found${NC}"
    exit 1
fi

FIREFOX_APK=$(echo "$PACKAGES" | head -n 1)
echo -e "${GREEN}✓ Found Firefox: $FIREFOX_APK${NC}\n"

echo -e "${YELLOW}This will:${NC}"
echo "  1. Force stop Firefox"
echo "  2. Clear Firefox app data (you'll lose tabs/history)"
echo "  3. Allow clean extension redeployment"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Cancelled${NC}"
    exit 0
fi

echo -e "${BLUE}📱 Force stopping Firefox...${NC}"
adb -s "$DEVICE_ID" shell am force-stop "$FIREFOX_APK"

echo -e "${BLUE}🗑️  Clearing Firefox data...${NC}"
adb -s "$DEVICE_ID" shell pm clear "$FIREFOX_APK"

echo -e "\n${GREEN}✅ Firefox reset complete!${NC}"
echo -e "${BLUE}💡 Now run: ./deploy-android.sh${NC}"

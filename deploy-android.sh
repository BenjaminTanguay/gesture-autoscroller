#!/bin/bash

# Script to deploy Gesture AutoScroller extension to Android device for debugging
# Automatically detects device and lets you choose Firefox package via fzf

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Gesture AutoScroller - Android Deployment${NC}\n"

# Check if adb is installed
if ! command -v adb &> /dev/null; then
    echo -e "${RED}❌ Error: adb is not installed${NC}"
    echo "Install Android SDK Platform Tools: https://developer.android.com/studio/releases/platform-tools"
    exit 1
fi

# Check if web-ext is installed
if ! command -v web-ext &> /dev/null; then
    echo -e "${RED}❌ Error: web-ext is not installed${NC}"
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

# Check if fzf is installed
if ! command -v fzf &> /dev/null; then
    echo -e "${RED}❌ Error: fzf is not installed${NC}"
    echo "Install it with: brew install fzf"
    exit 1
fi

# Get list of connected devices
echo -e "${BLUE}📱 Detecting Android devices...${NC}"
DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | awk '{print $1}')

if [ -z "$DEVICES" ]; then
    echo -e "${RED}❌ No Android devices found${NC}"
    echo "Make sure:"
    echo "  1. Your device is connected via USB"
    echo "  2. USB debugging is enabled"
    echo "  3. You've authorized the connection on your device"
    exit 1
fi

# Count devices
DEVICE_COUNT=$(echo "$DEVICES" | wc -l | xargs)

if [ "$DEVICE_COUNT" -eq 1 ]; then
    DEVICE_ID="$DEVICES"
    echo -e "${GREEN}✓ Found device: $DEVICE_ID${NC}\n"
else
    echo -e "${YELLOW}⚠ Multiple devices found:${NC}"
    echo "$DEVICES"
    echo -e "\n${BLUE}Select device:${NC}"
    DEVICE_ID=$(echo "$DEVICES" | fzf --prompt="Select Android device: " --height=10)
    
    if [ -z "$DEVICE_ID" ]; then
        echo -e "${RED}❌ No device selected${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Selected: $DEVICE_ID${NC}\n"
fi

# Get Firefox packages on the device
echo -e "${BLUE}🔍 Detecting Firefox installations...${NC}"
PACKAGES=$(adb -s "$DEVICE_ID" shell pm list packages | grep -E "mozilla\.(firefox|fenix)" | sed 's/package://' | sort)

if [ -z "$PACKAGES" ]; then
    echo -e "${RED}❌ No Firefox installations found on device${NC}"
    echo "Install Firefox or Firefox Nightly from Google Play Store"
    exit 1
fi

# Display packages with friendly names
PACKAGE_COUNT=$(echo "$PACKAGES" | wc -l | xargs)

if [ "$PACKAGE_COUNT" -eq 1 ]; then
    FIREFOX_APK="$PACKAGES"
    FRIENDLY_NAME=$(get_friendly_name "$FIREFOX_APK")
    echo -e "${GREEN}✓ Found Firefox: $FRIENDLY_NAME ($FIREFOX_APK)${NC}\n"
else
    echo -e "${YELLOW}⚠ Multiple Firefox installations found:${NC}"
    
    # Create a temporary file with package names and friendly names
    TEMP_FILE=$(mktemp)
    echo "$PACKAGES" | while read -r pkg; do
        case "$pkg" in
            org.mozilla.firefox)
                echo "$pkg (Firefox Release)" >> "$TEMP_FILE"
                ;;
            org.mozilla.fenix)
                echo "$pkg (Firefox Nightly/Beta)" >> "$TEMP_FILE"
                ;;
            org.mozilla.firefox_beta)
                echo "$pkg (Firefox Beta)" >> "$TEMP_FILE"
                ;;
            *)
                echo "$pkg" >> "$TEMP_FILE"
                ;;
        esac
    done
    
    echo -e "\n${BLUE}Select Firefox version:${NC}"
    SELECTED=$(cat "$TEMP_FILE" | fzf --prompt="Select Firefox: " --height=10)
    rm "$TEMP_FILE"
    
    if [ -z "$SELECTED" ]; then
        echo -e "${RED}❌ No Firefox version selected${NC}"
        exit 1
    fi
    
    # Extract package name (remove friendly name in parentheses)
    FIREFOX_APK=$(echo "$SELECTED" | awk '{print $1}')
    echo -e "${GREEN}✓ Selected: $SELECTED${NC}\n"
fi

# Deploy the extension
echo -e "${BLUE}🔧 Deploying extension to device...${NC}"
echo -e "${YELLOW}Note: Firefox will restart on your device${NC}\n"

web-ext run \
    --target=firefox-android \
    --android-device="$DEVICE_ID" \
    --firefox-apk="$FIREFOX_APK" \
    --source-dir=src

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo -e "${BLUE}💡 Tips:${NC}"
echo "  - The extension is now running on your device"
echo "  - Check the terminal for any errors or logs"
echo "  - Press Ctrl+C to stop the extension"

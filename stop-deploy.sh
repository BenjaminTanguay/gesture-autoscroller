#!/bin/bash

# Script to forcefully stop web-ext deployment processes
# Use this when Ctrl+C doesn't work

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🛑 Stopping web-ext deployment processes...${NC}\n"

# Find and kill web-ext processes
WEB_EXT_PIDS=$(pgrep -f "web-ext run" || true)

if [ -z "$WEB_EXT_PIDS" ]; then
    echo -e "${YELLOW}ℹ️  No web-ext processes found${NC}"
else
    echo -e "${BLUE}Found web-ext processes:${NC}"
    echo "$WEB_EXT_PIDS"
    echo ""
    
    echo -e "${BLUE}Killing processes...${NC}"
    echo "$WEB_EXT_PIDS" | xargs kill -9 2>/dev/null || true
    
    echo -e "${GREEN}✅ Killed web-ext processes${NC}"
fi

# Find and kill node processes related to web-ext
NODE_PIDS=$(pgrep -f "node.*web-ext" || true)

if [ -z "$NODE_PIDS" ]; then
    echo -e "${YELLOW}ℹ️  No node web-ext processes found${NC}"
else
    echo -e "${BLUE}Found node processes:${NC}"
    echo "$NODE_PIDS"
    echo ""
    
    echo -e "${BLUE}Killing processes...${NC}"
    echo "$NODE_PIDS" | xargs kill -9 2>/dev/null || true
    
    echo -e "${GREEN}✅ Killed node processes${NC}"
fi

# Also try to close the ADB forward connections
echo -e "\n${BLUE}Closing ADB port forwards...${NC}"
adb forward --remove-all 2>/dev/null || true

echo -e "\n${GREEN}✅ All deployment processes stopped!${NC}"
echo -e "${BLUE}💡 You can now run ./deploy-android.sh again${NC}"

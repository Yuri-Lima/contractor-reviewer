#!/bin/bash

# Mobile Development Helper Script
# Automates the workflow for mobile development with Capacitor

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPACITOR_CONFIG="$WEB_DIR/capacitor.config.ts"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📱 Capacitor Mobile Development Helper${NC}"
echo ""

# Function to get local IP address
get_local_ip() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "127.0.0.1"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    hostname -I | awk '{print $1}' || echo "127.0.0.1"
  else
    echo "127.0.0.1"
  fi
}

# Function to detect platform
detect_platform() {
  if [[ -d "$WEB_DIR/ios" ]]; then
    echo "ios"
  elif [[ -d "$WEB_DIR/android" ]]; then
    echo "android"
  else
    echo "none"
  fi
}

# Parse arguments
PLATFORM=""
BUILD_ONLY=false
OPEN_IDE=false
USE_LOCAL_IP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --ios)
      PLATFORM="ios"
      OPEN_IDE=true
      shift
      ;;
    --android)
      PLATFORM="android"
      OPEN_IDE=true
      shift
      ;;
    --build-only)
      BUILD_ONLY=true
      shift
      ;;
    --local-ip)
      USE_LOCAL_IP=true
      shift
      ;;
    *)
      echo -e "${YELLOW}Unknown option: $1${NC}"
      echo "Usage: $0 [--ios|--android] [--build-only] [--local-ip]"
      exit 1
      ;;
  esac
done

# If no platform specified, try to detect
if [[ -z "$PLATFORM" ]]; then
  PLATFORM=$(detect_platform)
fi

# Get local IP if needed
LOCAL_IP=""
if [[ "$USE_LOCAL_IP" == true ]]; then
  LOCAL_IP=$(get_local_ip)
  echo -e "${GREEN}🌐 Detected local IP: $LOCAL_IP${NC}"
fi

# Step 1: Build Angular app
echo -e "${BLUE}📦 Building Angular application...${NC}"
cd "$WEB_DIR"
pnpm build

if [[ $? -ne 0 ]]; then
  echo -e "${YELLOW}❌ Build failed. Please fix errors and try again.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"
echo ""

# Step 2: Update Capacitor config if using local IP
if [[ "$USE_LOCAL_IP" == true && -n "$LOCAL_IP" ]]; then
  echo -e "${BLUE}🔧 Updating Capacitor config with local IP...${NC}"
  
  # Create backup
  cp "$CAPACITOR_CONFIG" "$CAPACITOR_CONFIG.bak"
  
  # Update server URL (simple sed replacement)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|url: process.env\['CAPACITOR_SERVER_URL'\] || 'http://localhost:4200'|url: 'http://$LOCAL_IP:4200'|g" "$CAPACITOR_CONFIG"
  else
    sed -i "s|url: process.env\['CAPACITOR_SERVER_URL'\] || 'http://localhost:4200'|url: 'http://$LOCAL_IP:4200'|g" "$CAPACITOR_CONFIG"
  fi
  
  echo -e "${GREEN}✅ Capacitor config updated${NC}"
  echo ""
fi

# Step 3: Sync with Capacitor
echo -e "${BLUE}🔄 Syncing with Capacitor...${NC}"
pnpm cap:sync

if [[ $? -ne 0 ]]; then
  echo -e "${YELLOW}❌ Sync failed.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Sync completed${NC}"
echo ""

# Step 4: Open IDE if requested
if [[ "$OPEN_IDE" == true && -n "$PLATFORM" && "$PLATFORM" != "none" ]]; then
  echo -e "${BLUE}🚀 Opening $PLATFORM in IDE...${NC}"
  
  if [[ "$PLATFORM" == "ios" ]]; then
    pnpm cap:open:ios
  elif [[ "$PLATFORM" == "android" ]]; then
    pnpm cap:open:android
  fi
  
  echo -e "${GREEN}✅ IDE opened${NC}"
  echo ""
fi

# Step 5: Instructions
echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""

if [[ "$USE_LOCAL_IP" == true && -n "$LOCAL_IP" ]]; then
  echo "1. Make sure your dev server is running:"
  echo "   ${YELLOW}pnpm start${NC}"
  echo ""
  echo "2. The app will connect to: ${GREEN}http://$LOCAL_IP:4200${NC}"
  echo "   Make sure your mobile device/emulator can reach this IP"
  echo ""
fi

if [[ "$PLATFORM" == "ios" ]]; then
  echo "3. In Xcode:"
  echo "   - Select a simulator or connected device"
  echo "   - Click Run (▶️) or press Cmd+R"
  echo ""
elif [[ "$PLATFORM" == "android" ]]; then
  echo "3. In Android Studio:"
  echo "   - Select an emulator or connected device"
  echo "   - Click Run (▶️)"
  echo ""
fi

if [[ "$USE_LOCAL_IP" == true ]]; then
  echo -e "${YELLOW}⚠️  Note: To restore default config, run:${NC}"
  echo "   mv $CAPACITOR_CONFIG.bak $CAPACITOR_CONFIG"
  echo ""
fi

echo -e "${BLUE}For more information, see: apps/web/MOBILE-DEV.md${NC}"

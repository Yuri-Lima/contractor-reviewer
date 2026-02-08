#!/bin/bash

# One-time Mobile Setup Script
# Checks prerequisites and sets up iOS/Android platforms for Capacitor

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📱 Capacitor Mobile Platform Setup${NC}"
echo ""

# Check functions
check_command() {
  if command -v "$1" &> /dev/null; then
    echo -e "${GREEN}✅ $1 is installed${NC}"
    return 0
  else
    echo -e "${RED}❌ $1 is not installed${NC}"
    return 1
  fi
}

check_ios_prerequisites() {
  echo -e "${BLUE}Checking iOS prerequisites...${NC}"
  local all_ok=true
  
  if ! check_command "xcodebuild"; then
    echo -e "${YELLOW}   Install Xcode from the App Store${NC}"
    all_ok=false
  fi
  
  if ! check_command "pod"; then
    echo -e "${YELLOW}   Install CocoaPods: sudo gem install cocoapods${NC}"
    all_ok=false
  fi
  
  if [[ "$all_ok" == true ]]; then
    echo -e "${GREEN}✅ iOS prerequisites met${NC}"
    return 0
  else
    echo -e "${RED}❌ iOS prerequisites not met${NC}"
    return 1
  fi
}

check_android_prerequisites() {
  echo -e "${BLUE}Checking Android prerequisites...${NC}"
  local all_ok=true
  
  if ! check_command "java"; then
    echo -e "${YELLOW}   Install Java JDK${NC}"
    all_ok=false
  fi
  
  # Check for Android SDK
  if [[ -z "$ANDROID_HOME" ]] && [[ -z "$ANDROID_SDK_ROOT" ]]; then
    echo -e "${YELLOW}   ANDROID_HOME or ANDROID_SDK_ROOT not set${NC}"
    echo -e "${YELLOW}   Install Android Studio and set ANDROID_HOME${NC}"
    all_ok=false
  else
    echo -e "${GREEN}✅ Android SDK found${NC}"
  fi
  
  if [[ "$all_ok" == true ]]; then
    echo -e "${GREEN}✅ Android prerequisites met${NC}"
    return 0
  else
    echo -e "${RED}❌ Android prerequisites not met${NC}"
    return 1
  fi
}

# Parse arguments
SETUP_IOS=false
SETUP_ANDROID=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --ios)
      SETUP_IOS=true
      shift
      ;;
    --android)
      SETUP_ANDROID=true
      shift
      ;;
    --all)
      SETUP_IOS=true
      SETUP_ANDROID=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo -e "${YELLOW}Unknown option: $1${NC}"
      echo "Usage: $0 [--ios|--android|--all] [--force]"
      echo ""
      echo "Options:"
      echo "  --ios       Setup iOS platform only"
      echo "  --android   Setup Android platform only"
      echo "  --all       Setup both platforms"
      echo "  --force     Continue even if prerequisites are missing"
      exit 1
      ;;
  esac
done

# If no platform specified, ask user
if [[ "$SETUP_IOS" == false && "$SETUP_ANDROID" == false ]]; then
  echo "Which platform(s) would you like to set up?"
  echo "1) iOS only"
  echo "2) Android only"
  echo "3) Both"
  read -p "Enter choice [1-3]: " choice
  
  case $choice in
    1)
      SETUP_IOS=true
      ;;
    2)
      SETUP_ANDROID=true
      ;;
    3)
      SETUP_IOS=true
      SETUP_ANDROID=true
      ;;
    *)
      echo -e "${RED}Invalid choice${NC}"
      exit 1
      ;;
  esac
fi

cd "$WEB_DIR"

# Check prerequisites
IOS_OK=false
ANDROID_OK=false

if [[ "$SETUP_IOS" == true ]]; then
  if check_ios_prerequisites; then
    IOS_OK=true
  else
    echo ""
    if [[ "$FORCE" == true ]]; then
      echo -e "${YELLOW}⚠️  iOS prerequisites not met, but continuing with --force${NC}"
      echo -e "${YELLOW}   You may need to install CocoaPods manually: sudo gem install cocoapods${NC}"
      IOS_OK=true
    else
      echo -e "${YELLOW}⚠️  iOS prerequisites not met.${NC}"
      echo ""
      echo -e "${BLUE}To install CocoaPods:${NC}"
      echo "  ${YELLOW}sudo gem install cocoapods${NC}"
      echo ""
      echo -e "${BLUE}Or continue anyway with:${NC}"
      echo "  ${YELLOW}$0 --ios --force${NC}"
      echo ""
    fi
  fi
fi

if [[ "$SETUP_ANDROID" == true ]]; then
  if check_android_prerequisites; then
    ANDROID_OK=true
  else
    echo ""
    if [[ "$FORCE" == true ]]; then
      echo -e "${YELLOW}⚠️  Android prerequisites not met, but continuing with --force${NC}"
      echo -e "${YELLOW}   Make sure ANDROID_HOME is set before building${NC}"
      ANDROID_OK=true
    else
      echo -e "${YELLOW}⚠️  Android prerequisites not met.${NC}"
      echo ""
      echo -e "${BLUE}To set up Android SDK:${NC}"
      echo "  1. Install Android Studio"
      echo "  2. Set ANDROID_HOME environment variable:"
      echo "     ${YELLOW}export ANDROID_HOME=\$HOME/Library/Android/sdk${NC}"
      echo "     ${YELLOW}export PATH=\$PATH:\$ANDROID_HOME/platform-tools${NC}"
      echo ""
      echo -e "${BLUE}Or continue anyway with:${NC}"
      echo "  ${YELLOW}$0 --android --force${NC}"
      echo ""
    fi
  fi
fi

# Exit if no platforms are OK and not forcing
if [[ "$IOS_OK" == false && "$ANDROID_OK" == false && "$FORCE" == false ]]; then
  echo -e "${RED}❌ No platforms can be set up. Install prerequisites or use --force.${NC}"
  exit 1
fi

# Build Angular app first
echo ""
echo -e "${BLUE}📦 Building Angular application...${NC}"
pnpm build

if [[ $? -ne 0 ]]; then
  echo -e "${RED}❌ Build failed. Please fix errors and try again.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build completed${NC}"
echo ""

# Setup iOS
if [[ "$SETUP_IOS" == true && "$IOS_OK" == true ]]; then
  echo -e "${BLUE}🍎 Setting up iOS platform...${NC}"
  
  # Add iOS platform if it doesn't exist
  if [[ ! -d "$WEB_DIR/ios" ]]; then
    echo "Adding iOS platform..."
    pnpm cap:add ios
    
    if [[ $? -ne 0 ]]; then
      echo -e "${RED}❌ Failed to add iOS platform${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✅ iOS platform already exists${NC}"
  fi
  
  # Install CocoaPods dependencies (only if pod command exists)
  if command -v pod &> /dev/null; then
    echo "Installing CocoaPods dependencies..."
    cd "$WEB_DIR/ios/App"
    pod install
    
    if [[ $? -ne 0 ]]; then
      echo -e "${YELLOW}⚠️  CocoaPods install had issues. You may need to run 'pod install' manually.${NC}"
    else
      echo -e "${GREEN}✅ CocoaPods dependencies installed${NC}"
    fi
    
    cd "$WEB_DIR"
  else
    echo -e "${YELLOW}⚠️  CocoaPods not installed. Skipping pod install.${NC}"
    echo -e "${YELLOW}   Install with: sudo gem install cocoapods${NC}"
    echo -e "${YELLOW}   Then run: cd ios/App && pod install${NC}"
  fi
  
  # Sync
  echo "Syncing with Capacitor..."
  pnpm cap:sync
  
  echo -e "${GREEN}✅ iOS setup complete!${NC}"
  echo ""
fi

# Setup Android
if [[ "$SETUP_ANDROID" == true && "$ANDROID_OK" == true ]]; then
  echo -e "${BLUE}🤖 Setting up Android platform...${NC}"
  
  # Add Android platform if it doesn't exist
  if [[ ! -d "$WEB_DIR/android" ]]; then
    echo "Adding Android platform..."
    pnpm cap:add android
    
    if [[ $? -ne 0 ]]; then
      echo -e "${RED}❌ Failed to add Android platform${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✅ Android platform already exists${NC}"
  fi
  
  # Sync
  echo "Syncing with Capacitor..."
  pnpm cap:sync
  
  echo -e "${GREEN}✅ Android setup complete!${NC}"
  echo ""
fi

# Final instructions
echo ""
if [[ "$SETUP_IOS" == true && -d "$WEB_DIR/ios" ]] || [[ "$SETUP_ANDROID" == true && -d "$WEB_DIR/android" ]]; then
  echo -e "${GREEN}✨ Setup complete!${NC}"
else
  echo -e "${YELLOW}⚠️  Setup completed, but platforms may not be fully configured.${NC}"
fi
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""

if [[ "$SETUP_IOS" == true ]]; then
  if [[ -d "$WEB_DIR/ios" ]]; then
    echo "✅ iOS platform added"
    if ! command -v pod &> /dev/null; then
      echo -e "${YELLOW}   ⚠️  Install CocoaPods before opening: sudo gem install cocoapods${NC}"
      echo -e "${YELLOW}   Then run: cd ios/App && pod install${NC}"
    fi
    echo "   To open iOS project:"
    echo "     ${YELLOW}pnpm cap:open:ios${NC}"
  else
    echo -e "${RED}❌ iOS platform was not added${NC}"
  fi
  echo ""
fi

if [[ "$SETUP_ANDROID" == true ]]; then
  if [[ -d "$WEB_DIR/android" ]]; then
    echo "✅ Android platform added"
    if [[ -z "$ANDROID_HOME" ]] && [[ -z "$ANDROID_SDK_ROOT" ]]; then
      echo -e "${YELLOW}   ⚠️  Set ANDROID_HOME before building${NC}"
    fi
    echo "   To open Android project:"
    echo "     ${YELLOW}pnpm cap:open:android${NC}"
  else
    echo -e "${RED}❌ Android platform was not added${NC}"
  fi
  echo ""
fi

echo "For development workflow:"
if [[ -d "$WEB_DIR/ios" ]]; then
  echo "  ${YELLOW}./scripts/mobile-dev.sh --ios --local-ip${NC}"
fi
if [[ -d "$WEB_DIR/android" ]]; then
  echo "  ${YELLOW}./scripts/mobile-dev.sh --android --local-ip${NC}"
fi
echo ""

echo -e "${BLUE}For more information, see: apps/web/MOBILE-DEV.md${NC}"

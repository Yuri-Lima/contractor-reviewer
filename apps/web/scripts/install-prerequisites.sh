#!/bin/bash

# Prerequisites Installation Helper
# Helps install missing prerequisites for mobile development

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Mobile Development Prerequisites Installer${NC}"
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
else
  OS="unknown"
fi

# Check if command exists
command_exists() {
  command -v "$1" &> /dev/null
}

# Install CocoaPods
install_cocoapods() {
  echo -e "${BLUE}Installing CocoaPods...${NC}"
  
  if command_exists brew; then
    echo "Using Homebrew to install CocoaPods..."
    brew install cocoapods
  elif command_exists gem; then
    echo "Using Ruby gem to install CocoaPods..."
    sudo gem install cocoapods
  else
    echo -e "${RED}❌ Neither Homebrew nor Ruby gem found${NC}"
    echo "Please install Homebrew first: https://brew.sh"
    return 1
  fi
  
  if command_exists pod; then
    echo -e "${GREEN}✅ CocoaPods installed successfully${NC}"
    pod --version
    return 0
  else
    echo -e "${RED}❌ CocoaPods installation failed${NC}"
    return 1
  fi
}

# Setup Android environment
setup_android_env() {
  echo -e "${BLUE}Setting up Android environment...${NC}"
  
  # Common Android SDK locations
  local android_locations=(
    "$HOME/Library/Android/sdk"
    "$HOME/Android/Sdk"
    "/opt/android-sdk"
  )
  
  local android_home=""
  
  # Check if ANDROID_HOME is already set
  if [[ -n "$ANDROID_HOME" ]]; then
    android_home="$ANDROID_HOME"
    echo -e "${GREEN}✅ ANDROID_HOME is already set: $android_home${NC}"
  else
    # Try to find Android SDK
    for location in "${android_locations[@]}"; do
      if [[ -d "$location" ]]; then
        android_home="$location"
        echo -e "${GREEN}✅ Found Android SDK at: $android_home${NC}"
        break
      fi
    done
  fi
  
  if [[ -z "$android_home" ]]; then
    echo -e "${YELLOW}⚠️  Android SDK not found${NC}"
    echo ""
    echo "Please install Android Studio:"
    echo "  1. Download from: https://developer.android.com/studio"
    echo "  2. Install Android Studio"
    echo "  3. Open Android Studio > Preferences > Appearance & Behavior > System Settings > Android SDK"
    echo "  4. Note the 'Android SDK Location' path"
    echo ""
    echo "Then add to your ~/.zshrc (or ~/.bash_profile):"
    echo "  export ANDROID_HOME=<SDK_LOCATION>"
    echo "  export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
    echo "  export PATH=\$PATH:\$ANDROID_HOME/emulator"
    echo "  export PATH=\$PATH:\$ANDROID_HOME/tools"
    echo "  export PATH=\$PATH:\$ANDROID_HOME/tools/bin"
    return 1
  fi
  
  # Detect shell config file
  local shell_config=""
  if [[ -n "$ZSH_VERSION" ]]; then
    shell_config="$HOME/.zshrc"
  elif [[ -n "$BASH_VERSION" ]]; then
    shell_config="$HOME/.bash_profile"
    if [[ ! -f "$shell_config" ]]; then
      shell_config="$HOME/.bashrc"
    fi
  fi
  
  if [[ -z "$shell_config" ]]; then
    echo -e "${YELLOW}⚠️  Could not detect shell config file${NC}"
    echo "Please manually add to your shell config:"
    echo "  export ANDROID_HOME=$android_home"
    echo "  export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
    return 1
  fi
  
  # Check if already in config
  if grep -q "ANDROID_HOME" "$shell_config" 2>/dev/null; then
    echo -e "${GREEN}✅ ANDROID_HOME already configured in $shell_config${NC}"
    echo "Run: source $shell_config"
    return 0
  fi
  
  # Ask to add to config
  echo ""
  echo -e "${YELLOW}Add Android environment variables to $shell_config? (y/n)${NC}"
  read -r response
  
  if [[ "$response" =~ ^[Yy]$ ]]; then
    {
      echo ""
      echo "# Android SDK"
      echo "export ANDROID_HOME=$android_home"
      echo "export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
      echo "export PATH=\$PATH:\$ANDROID_HOME/emulator"
      echo "export PATH=\$PATH:\$ANDROID_HOME/tools"
      echo "export PATH=\$PATH:\$ANDROID_HOME/tools/bin"
    } >> "$shell_config"
    
    echo -e "${GREEN}✅ Added to $shell_config${NC}"
    echo ""
    echo -e "${BLUE}Run the following to apply changes:${NC}"
    echo "  source $shell_config"
    echo ""
    echo "Or restart your terminal."
    return 0
  else
    echo -e "${YELLOW}⚠️  Skipped. Please add manually to $shell_config:${NC}"
    echo "  export ANDROID_HOME=$android_home"
    echo "  export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
    return 1
  fi
}

# Main menu
main() {
  local install_ios=false
  local install_android=false
  
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --ios)
        install_ios=true
        shift
        ;;
      --android)
        install_android=true
        shift
        ;;
      --all)
        install_ios=true
        install_android=true
        shift
        ;;
      *)
        echo "Unknown option: $1"
        echo "Usage: $0 [--ios|--android|--all]"
        exit 1
        ;;
    esac
  done
  
  # If no arguments, show menu
  if [[ "$install_ios" == false && "$install_android" == false ]]; then
    echo "What would you like to install?"
    echo "1) CocoaPods (iOS)"
    echo "2) Android SDK setup"
    echo "3) Both"
    read -p "Enter choice [1-3]: " choice
    
    case $choice in
      1)
        install_ios=true
        ;;
      2)
        install_android=true
        ;;
      3)
        install_ios=true
        install_android=true
        ;;
      *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
    esac
  fi
  
  # Install iOS prerequisites
  if [[ "$install_ios" == true ]]; then
    if [[ "$OS" != "macos" ]]; then
      echo -e "${RED}❌ iOS development requires macOS${NC}"
    else
      if command_exists pod; then
        echo -e "${GREEN}✅ CocoaPods is already installed${NC}"
        pod --version
      else
        install_cocoapods
      fi
      echo ""
    fi
  fi
  
  # Setup Android prerequisites
  if [[ "$install_android" == true ]]; then
    setup_android_env
    echo ""
  fi
  
  # Summary
  echo ""
  echo -e "${GREEN}✨ Prerequisites check complete!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. If you modified shell config, restart terminal or run: source ~/.zshrc"
  echo "  2. Run the setup script: ./scripts/setup-mobile.sh --all"
  echo ""
}

main "$@"

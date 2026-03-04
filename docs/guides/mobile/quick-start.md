# Quick Start - Mobile Development

## Current Status

Based on your setup, here's what you need to do:

### Missing Prerequisites

1. **CocoaPods (for iOS)**
2. **ANDROID_HOME (for Android)**

## Automated Installation (Recommended)

Use the helper script to install prerequisites automatically:

```bash
cd apps/web
./scripts/install-prerequisites.sh --all
```

Or install individually:

```bash
# iOS only
./scripts/install-prerequisites.sh --ios

# Android only
./scripts/install-prerequisites.sh --android
```

## Manual Installation

### Install CocoaPods (iOS)

```bash
sudo gem install cocoapods
```

**Note**: If you get permission errors, you might need to use a Ruby version manager like `rbenv` or install via Homebrew:

```bash
# Via Homebrew (recommended on macOS)
brew install cocoapods
```

### Set Up Android SDK

1. **Install Android Studio** (if not already installed)
   - Download from: https://developer.android.com/studio

2. **Set Environment Variables**

   Add to your `~/.zshrc` (or `~/.bash_profile` if using bash):

   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   ```

3. **Reload your shell**:
   ```bash
   source ~/.zshrc
   ```

4. **Verify**:
   ```bash
   echo $ANDROID_HOME
   # Should output: /Users/your-username/Library/Android/sdk
   ```

## Continue Setup

After installing prerequisites (automated or manual), run the setup script:

```bash
cd apps/web
./scripts/setup-mobile.sh --all
```

Or if prerequisites are still missing but you want to proceed:

```bash
./scripts/setup-mobile.sh --all --force
```

## Next Steps After Setup

### For iOS Development

1. **Install CocoaPods dependencies**:
   ```bash
   cd ios/App
   pod install
   cd ../..
   ```

2. **Open in Xcode**:
   ```bash
   pnpm cap:open:ios
   ```

3. **Run the app** from Xcode (select simulator or device)

### For Android Development

1. **Open in Android Studio**:
   ```bash
   pnpm cap:open:android
   ```

2. **Let Android Studio sync** Gradle files (first time may take a while)

3. **Run the app** from Android Studio (select emulator or device)

## Development Workflow

Once platforms are set up, use the helper script for development:

```bash
# iOS with live reload
./scripts/mobile-dev.sh --ios --local-ip

# Android with live reload
./scripts/mobile-dev.sh --android --local-ip
```

This will:
- Build your Angular app
- Detect your local IP
- Update Capacitor config
- Sync with native platforms
- Open the IDE

## Troubleshooting

### CocoaPods Issues

If `pod install` fails:
```bash
# Update CocoaPods
sudo gem update cocoapods

# Clear CocoaPods cache
pod cache clean --all

# Try again
cd ios/App
pod install
```

### Android SDK Not Found

If Android Studio can't find the SDK:
1. Open Android Studio
2. Go to Preferences > Appearance & Behavior > System Settings > Android SDK
3. Note the "Android SDK Location" path
4. Set `ANDROID_HOME` to that path in your shell config

### Still Having Issues?

See the full guide: [development.md](development.md)

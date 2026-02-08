# Mobile Development Guide

This guide covers how to develop, test, and build the ContractAI Review app for iOS and Android using Capacitor.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Network Configuration](#network-configuration)
- [Testing on Devices](#testing-on-devices)
- [Building for Production](#building-for-production)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### iOS Development

- **macOS** (required for iOS development)
- **Xcode** (latest version from App Store)
- **CocoaPods**: Install via `sudo gem install cocoapods`
- **Xcode Command Line Tools**: `xcode-select --install`

### Android Development

- **Java JDK** (version 17 or higher)
- **Android Studio** (latest version)
- **Android SDK** (installed via Android Studio)
- **Environment Variables**:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/emulator
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  export PATH=$PATH:$ANDROID_HOME/tools
  export PATH=$PATH:$ANDROID_HOME/tools/bin
  ```

### General

- Node.js >= 18
- pnpm >= 9.0.0
- Backend API running (for API calls)

## Initial Setup

### One-Time Setup

Run the setup script to add platforms and install dependencies:

```bash
cd apps/web
./scripts/setup-mobile.sh --all
```

Or for specific platforms:

```bash
# iOS only
./scripts/setup-mobile.sh --ios

# Android only
./scripts/setup-mobile.sh --android
```

The script will:
1. Check prerequisites
2. Build the Angular app
3. Add iOS/Android platforms
4. Install CocoaPods dependencies (iOS)
5. Sync with Capacitor

### Manual Setup

If you prefer manual setup:

```bash
cd apps/web

# Build the app first
pnpm build

# Add platforms
pnpm cap:add ios
pnpm cap:add android

# Install CocoaPods (iOS only)
cd ios/App
pod install
cd ../..

# Sync
pnpm cap:sync
```

## Development Workflow

### Quick Start (Recommended)

Use the helper script for automated workflow:

```bash
cd apps/web

# For iOS with live reload (uses local IP)
./scripts/mobile-dev.sh --ios --local-ip

# For Android with live reload
./scripts/mobile-dev.sh --android --local-ip

# Build and sync only (no IDE)
./scripts/mobile-dev.sh --build-only
```

### Manual Workflow

1. **Start the Angular dev server**:
   ```bash
   pnpm start
   ```

2. **Build and sync** (in another terminal):
   ```bash
   pnpm cap:build:sync
   ```

3. **Open in IDE**:
   ```bash
   # iOS
   pnpm cap:open:ios
   
   # Android
   pnpm cap:open:android
   ```

4. **Run the app** from Xcode or Android Studio

### Available Scripts

- `pnpm cap:sync` - Sync web assets to native projects
- `pnpm cap:copy` - Copy web assets only (faster, no plugin updates)
- `pnpm cap:build:sync` - Build Angular app and sync
- `pnpm cap:open:ios` - Open iOS project in Xcode
- `pnpm cap:open:android` - Open Android project in Android Studio
- `pnpm cap:doctor` - Check Capacitor setup and dependencies

## Network Configuration

### Understanding Network Requirements

The app needs to communicate with:
1. **Angular dev server** (for live reload) - Port 4200
2. **Backend API** - Port 3000

### Physical Devices

Physical devices need your computer's **local IP address** (not `localhost`).

1. **Find your local IP**:
   ```bash
   # macOS
   ipconfig getifaddr en0
   
   # Linux
   hostname -I | awk '{print $1}'
   ```

2. **Update Capacitor config** (or use the helper script):
   ```bash
   # The mobile-dev.sh script does this automatically with --local-ip
   # Or manually set:
   export CAPACITOR_SERVER_URL=http://192.168.1.100:4200
   pnpm cap:sync
   ```

3. **Update API URL** in `apps/web/src/environments/environment.ts`:
   ```typescript
   apiUrl: 'http://192.168.1.100:3000/api', // Replace with your IP
   ```

4. **Ensure devices are on the same network** as your development machine

### Emulators/Simulators

- **iOS Simulator**: Can use `localhost` or `127.0.0.1`
- **Android Emulator**: Use `10.0.2.2` instead of `localhost`
  - The API config automatically handles this

### API Configuration

The app automatically detects the platform and adjusts API URLs:

- **Web**: Uses `http://localhost:3000/api`
- **iOS Simulator**: Uses `http://localhost:3000/api`
- **Android Emulator**: Automatically converts to `http://10.0.2.2:3000/api`
- **Physical Devices**: Requires manual IP configuration

To override the API URL, set the environment variable:

```bash
export NG_APP_API_URL=http://192.168.1.100:3000/api
pnpm build
pnpm cap:sync
```

## Testing on Devices

### iOS

1. **Connect iPhone/iPad** via USB
2. **Open Xcode**: `pnpm cap:open:ios`
3. **Select your device** from the device dropdown
4. **Click Run** (▶️) or press `Cmd+R`
5. **Trust the developer** on your device (Settings > General > Device Management)

**Note**: You need an Apple Developer account (free) for device testing.

### Android

1. **Enable USB Debugging** on your device:
   - Settings > About Phone > Tap "Build Number" 7 times
   - Settings > Developer Options > Enable "USB Debugging"

2. **Connect device** via USB

3. **Open Android Studio**: `pnpm cap:open:android`

4. **Select your device** from the device dropdown

5. **Click Run** (▶️)

### Emulators/Simulators

**iOS Simulator**:
```bash
pnpm cap:open:ios
# Select a simulator from Xcode's device menu
```

**Android Emulator**:
```bash
# Start emulator first
emulator -avd <avd_name>

# Then open Android Studio
pnpm cap:open:android
```

## Building for Production

### Development Build (Bundled)

1. **Build Angular app**:
   ```bash
   pnpm build:prod
   ```

2. **Sync with Capacitor**:
   ```bash
   pnpm cap:sync
   ```

3. **Update Capacitor config** to remove dev server:
   ```typescript
   // In capacitor.config.ts, set NODE_ENV=production
   // Or remove/comment the server.url property
   ```

4. **Build native app** in Xcode/Android Studio

### Release Build

#### iOS

1. **Open Xcode**: `pnpm cap:open:ios`
2. **Select "Any iOS Device"** as target
3. **Product > Archive**
4. **Distribute App** (App Store, Ad Hoc, Enterprise, or Development)

**Requirements**:
- Apple Developer account ($99/year)
- Signing certificates configured in Xcode

#### Android

1. **Generate signing key** (if not exists):
   ```bash
   keytool -genkey -v -keystore contractai-release.keystore \
     -alias contractai -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure signing** in `android/app/build.gradle`:
   ```gradle
   android {
     signingConfigs {
       release {
         storeFile file('../contractai-release.keystore')
         storePassword 'your-password'
         keyAlias 'contractai'
         keyPassword 'your-password'
       }
     }
     buildTypes {
       release {
         signingConfig signingConfigs.release
       }
     }
   }
   ```

3. **Build APK/AAB**:
   ```bash
   cd android
   ./gradlew assembleRelease  # APK
   ./gradlew bundleRelease    # AAB (for Play Store)
   ```

## Troubleshooting

### Build Errors

**"Command not found: pod"**
- Install CocoaPods: `sudo gem install cocoapods`
- Run `pod install` in `ios/App/`

**"ANDROID_HOME not set"**
- Set environment variables (see Prerequisites)
- Restart terminal/IDE

**"Build failed: Cannot find module"**
- Run `pnpm install` in the web directory
- Clear cache: `pnpm clean && pnpm install`

### Runtime Errors

**"Network request failed" or "Connection refused"**
- Check API URL configuration
- Ensure backend is running
- Verify network connectivity (same WiFi for physical devices)
- Check firewall settings

**"CORS errors"**
- Backend must allow requests from Capacitor origins
- For development, ensure CORS is configured for your IP

**"White screen" or app doesn't load**
- Check Capacitor config `webDir` matches build output
- Verify `dist/contractai-web` exists after build
- Check browser console for errors

### Sync Issues

**"Platform not found"**
- Run `pnpm cap:add ios` or `pnpm cap:add android`
- Then `pnpm cap:sync`

**"Changes not appearing"**
- Run `pnpm cap:copy` (faster) or `pnpm cap:sync` (full sync)
- Rebuild in Xcode/Android Studio

### iOS Specific

**"No signing certificate found"**
- Open Xcode
- Select project > Signing & Capabilities
- Choose your team or create a new certificate

**"App installation failed"**
- Check device storage
- Verify device is trusted (Settings > General > Device Management)
- Check provisioning profile

### Android Specific

**"Gradle sync failed"**
- Open Android Studio
- File > Sync Project with Gradle Files
- Check for SDK version compatibility

**"INSTALL_FAILED_INSUFFICIENT_STORAGE"**
- Free up space on device/emulator
- Increase emulator storage in AVD Manager

## Best Practices

1. **Always build before syncing**: `pnpm build` then `pnpm cap:sync`
2. **Use `cap:copy` for faster iterations** when only web assets change
3. **Test on real devices** regularly, not just emulators
4. **Keep platforms updated**: `pnpm cap update ios` / `pnpm cap update android`
5. **Version control**: Commit `ios/` and `android/` folders (but ignore build artifacts)
6. **Use environment variables** for API URLs instead of hardcoding

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Development Guide](https://developer.apple.com/documentation/)
- [Android Development Guide](https://developer.android.com/docs)
- [Angular Mobile Guide](https://angular.io/guide/mobile)

## Getting Help

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Run `pnpm cap:doctor` to check setup
3. Check Capacitor [GitHub Issues](https://github.com/ionic-team/capacitor/issues)
4. Review Angular and platform-specific documentation

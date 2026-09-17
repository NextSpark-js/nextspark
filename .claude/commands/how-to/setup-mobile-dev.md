# /how-to:setup-mobile-dev

Interactive guide to set up your development environment for NextSpark Mobile (Android & iOS).

---

## Syntax

```
/how-to:setup-mobile-dev
```

---

## Behavior

Guides the user through setting up Android Studio, Xcode, environment variables, and understanding the difference between Expo Go and Development Builds.

---

## Tutorial Overview

```
STEPS OVERVIEW (5 steps)

Step 1: Prerequisites & Environment Check
        └── Node, pnpm, Expo CLI verification

Step 2: Android Development Setup
        └── Android Studio, SDK, Emulator, Environment Variables

Step 3: iOS Development Setup (macOS only)
        └── Xcode, CocoaPods, Simulator

Step 4: Understanding Expo Go vs Development Builds
        └── Limitations, when to use each approach

Step 5: Running Your First Build
        └── expo prebuild, expo run:android/ios
```

---

## Step 1: Prerequisites & Environment Check

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 HOW TO: SETUP MOBILE DEVELOPMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Prerequisites & Environment Check

Verify your system has the required tools installed.

┌─────────────────────────────────────────────┐
│  PREREQUISITES CHECKLIST                    │
│  ─────────────────────────────────────────  │
│                                             │
│  [ ] Node.js 22.14.0+ installed              │
│      node --version                         │
│                                             │
│  [ ] pnpm installed                         │
│      pnpm --version                         │
│                                             │
│  [ ] Expo CLI available                     │
│      npx expo --version                     │
│                                             │
│  [ ] Git installed                          │
│      git --version                          │
│                                             │
└─────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Verify Prerequisites:

```bash
# Check Node.js version (22.14.0+ required)
node --version
# v22.14.0 or higher

# Check pnpm
pnpm --version
# 8.0.0 or higher

# Check Expo CLI (will install if missing)
npx expo --version
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Install Missing Prerequisites:

```bash
# Install pnpm (if missing)
npm install -g pnpm

# Expo CLI is included via npx, no global install needed
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 2: Android Development Setup

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 HOW TO: SETUP MOBILE DEVELOPMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 2 OF 5: Android Development Setup

Set up Android Studio and configure environment variables.

┌─────────────────────────────────────────────┐
│  ANDROID SETUP CHECKLIST                    │
│  ─────────────────────────────────────────  │
│                                             │
│  [ ] Install Android Studio                 │
│  [ ] Install Android SDK (API 34+)          │
│  [ ] Create Android Virtual Device (AVD)    │
│  [ ] Configure environment variables        │
│                                             │
└─────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 2.1: Install Android Studio

1. Download Android Studio from:
   https://developer.android.com/studio

2. Run the installer and follow the setup wizard

3. During setup, ensure these are selected:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 2.2: Install Android SDK

1. Open Android Studio
2. Go to: Settings/Preferences → Languages & Frameworks → Android SDK
3. In "SDK Platforms" tab, select:
   - Android 14 (API 34) or higher
4. In "SDK Tools" tab, ensure these are installed:
   - Android SDK Build-Tools
   - Android SDK Command-line Tools
   - Android Emulator
   - Android SDK Platform-Tools

Click "Apply" to install selected components.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 2.3: Create Android Virtual Device (AVD)

1. In Android Studio, go to: Tools → Device Manager
2. Click "Create Device"
3. Select a device (e.g., Pixel 7)
4. Select a system image (API 34 recommended)
5. Name your AVD and click "Finish"

To start the emulator:
- Click the play button next to your AVD in Device Manager
- Or use command line:
  ```bash
  emulator -avd <your-avd-name>
  ```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 2.4: Configure Environment Variables

Add these to your shell configuration file (~/.zshrc or ~/.bashrc):

```bash
# Java (bundled with Android Studio)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# Android SDK
export ANDROID_HOME="$HOME/Library/Android/sdk"

# Add tools to PATH
export PATH="$JAVA_HOME/bin:$PATH"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export PATH="$ANDROID_HOME/emulator:$PATH"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

After editing, reload your shell:

```bash
source ~/.zshrc
# or
source ~/.bashrc
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Verify Android Setup:

```bash
# Check Java
java -version

# Check Android SDK
adb --version

# Check emulator
emulator -list-avds
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 3: iOS Development Setup (macOS only)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 HOW TO: SETUP MOBILE DEVELOPMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 3 OF 5: iOS Development Setup (macOS only)

Set up Xcode and CocoaPods for iOS development.

⚠️  iOS development requires macOS with Xcode installed.
    Skip this step if you're on Windows or Linux.

┌─────────────────────────────────────────────┐
│  iOS SETUP CHECKLIST                        │
│  ─────────────────────────────────────────  │
│                                             │
│  [ ] Install Xcode from App Store           │
│  [ ] Accept Xcode license                   │
│  [ ] Install Xcode Command Line Tools       │
│  [ ] Install CocoaPods                      │
│  [ ] Configure iOS Simulator                │
│                                             │
└─────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 3.1: Install Xcode

1. Open the Mac App Store
2. Search for "Xcode"
3. Click "Get" / "Install" (requires Apple ID)
4. Wait for download (15+ GB)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 3.2: Accept License & Install CLI Tools

```bash
# Accept Xcode license
sudo xcodebuild -license accept

# Install command line tools
xcode-select --install
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 3.3: Install CocoaPods

CocoaPods is a dependency manager for iOS projects.

```bash
# Install CocoaPods via Homebrew (recommended)
brew install cocoapods

# Or via RubyGems
sudo gem install cocoapods

# Verify installation
pod --version
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 3.4: Configure iOS Simulator

1. Open Xcode
2. Go to: Xcode → Settings → Platforms
3. Download iOS Simulator runtime if not present
4. To open Simulator manually:
   ```bash
   open -a Simulator
   ```

Or use Xcode:
- Go to: Xcode → Open Developer Tool → Simulator

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Verify iOS Setup:

```bash
# Check Xcode version
xcodebuild -version

# Check CocoaPods
pod --version

# List available simulators
xcrun simctl list devices available
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 4: Understanding Expo Go vs Development Builds

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 HOW TO: SETUP MOBILE DEVELOPMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 4 OF 5: Understanding Expo Go vs Development Builds

Learn the difference and when to use each approach.

⚠️  IMPORTANT: Expo Go Limitations

NextSpark mobile uses modern native modules
(react-native-reanimated, gesture-handler) that
may have version incompatibilities with Expo Go.

Common error you might see:

┌─────────────────────────────────────────────┐
│  ERROR:                                     │
│  "[Worklets] Mismatch between JavaScript    │
│   part and native part of Reanimated"       │
└─────────────────────────────────────────────┘

SOLUTION: Use Development Build instead of Expo Go

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Comparison Table:

┌─────────────────────────────────────────────────────────────────┐
│  Method          │ Command                    │ Use Case        │
│  ────────────────┼────────────────────────────┼──────────────── │
│  Expo Go         │ npx expo start             │ Quick prototype │
│                  │                            │ (may fail)      │
│  ────────────────┼────────────────────────────┼──────────────── │
│  Dev Build       │ npx expo prebuild &&       │ Real development│
│  (Android)       │ npx expo run:android       │ (recommended)   │
│  ────────────────┼────────────────────────────┼──────────────── │
│  Dev Build       │ npx expo prebuild &&       │ Real development│
│  (iOS)           │ npx expo run:ios           │ (recommended)   │
└─────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 When to Use Each:

EXPO GO:
  ✓ Quick UI previews
  ✓ Simple apps without native modules
  ✗ May fail with native module mismatches
  ✗ Cannot use custom native code

DEVELOPMENT BUILD:
  ✓ Full native module support
  ✓ Custom native code possible
  ✓ Matches production behavior
  ✓ Recommended for NextSpark Mobile

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 What is "expo prebuild"?

The `expo prebuild` command generates native
iOS and Android project folders:

```
mobile/
├── android/     ← Generated Android project
├── ios/         ← Generated iOS project
├── app/         ← Your Expo Router screens
├── src/         ← Your source code
└── app.config.ts
```

This allows you to build and run the app using
native tooling (Android Studio / Xcode) while
keeping the Expo development experience.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 5: Running Your First Build

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 HOW TO: SETUP MOBILE DEVELOPMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 5 OF 5: Running Your First Build

Build and run the app on your emulator/simulator.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 5.1: Navigate to Mobile Directory

```bash
cd mobile
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 5.2: Install Dependencies

```bash
pnpm install
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 5.3: Build for Android

```bash
# Generate native Android project
npx expo prebuild --platform android

# Build and run on emulator/device
npx expo run:android
```

First build may take several minutes as it
downloads Gradle dependencies.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 5.4: Build for iOS (macOS only)

```bash
# Generate native iOS project
npx expo prebuild --platform ios

# Install CocoaPods dependencies
cd ios && pod install && cd ..

# Build and run on simulator
npx expo run:ios
```

First build may take several minutes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Full Build Commands (Both Platforms):

```bash
# Clean previous builds (optional)
npx expo prebuild --clean

# Android
npx expo prebuild --platform android
npx expo run:android

# iOS
npx expo prebuild --platform ios
npx expo run:ios
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Configure API Connection:

For the mobile app to connect to your NextSpark
web backend, configure the API URL:

1. In development, Expo auto-detects the dev server

2. For production, set in your app.config.ts or
   use EAS environment variables:

   ```bash
   # Example: Set production API URL
   EXPO_PUBLIC_API_URL=https://your-app.com
   ```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Troubleshooting:

ANDROID:
  • "No Java compiler found" / JAVA_HOME not set
    → This is the #1 cause of Android build failure
    → JAVA_HOME MUST be set before running expo run:android
    → Run: echo $JAVA_HOME
    → Fix: Add to ~/.zshrc:
       export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    → Then: source ~/.zshrc

  • "SDK location not found"
    → Verify ANDROID_HOME is set correctly
    → Run: echo $ANDROID_HOME

  • "No emulators found"
    → Create AVD in Android Studio Device Manager
    → Or connect physical device with USB debugging

  • Login/API calls fail on Android emulator
    → Android emulator uses a virtual network where
      "localhost" points to the emulator itself, NOT your Mac
    → The api.config.ts auto-detects your host IP via
      Expo's hostUri, so this should work automatically
    → If using EXPO_PUBLIC_API_URL in .env, use your
      local IP (e.g., http://192.168.x.x:3000)
      NOT http://localhost:3000
    → Alternative: http://10.0.2.2:3000 (Android emulator
      special alias for host machine)

iOS:
  • "CocoaPods not installed"
    → Run: brew install cocoapods

  • "Xcode not found"
    → Run: xcode-select --install

  • "Simulator not available"
    → Open Xcode, download iOS runtime from Settings

NETWORKING NOTE:
  iOS Simulator shares the Mac's network stack,
  so "localhost" works. Android Emulator does NOT.
  The api.config.ts handles this automatically via
  Expo's hostUri (uses your real network IP).

BOTH:
  • "Worklets mismatch"
    → Don't use Expo Go, use Development Build
    → Run: npx expo prebuild --clean

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 SUCCESS!

Your mobile development environment is ready.
You can now build and run NextSpark Mobile.

Next steps:
  • Explore the app/ directory for screens
  • Customize src/config/app.config.ts
  • Connect to your NextSpark web backend

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Quick Reference

### Environment Variables Template (macOS)

Add to `~/.zshrc`:

```bash
# Java (Android Studio bundled JDK)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# Android SDK
export ANDROID_HOME="$HOME/Library/Android/sdk"

# Add to PATH
export PATH="$JAVA_HOME/bin:$PATH"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export PATH="$ANDROID_HOME/emulator:$PATH"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

### Essential Commands

```bash
# Android build
cd mobile
npx expo prebuild --platform android
npx expo run:android

# iOS build (macOS only)
cd mobile
npx expo prebuild --platform ios
npx expo run:ios

# Clean rebuild
npx expo prebuild --clean

# Start Metro bundler only
npx expo start --dev-client
```

### Common Issues

| Issue | Solution |
|-------|----------|
| No Java compiler found | Set `JAVA_HOME` to Android Studio JBR (see env vars above) |
| Worklets mismatch | Use Development Build, not Expo Go |
| SDK not found | Check `ANDROID_HOME` environment variable |
| Android login/API fails | Use local IP in `.env`, not `localhost` (Android emulator network) |
| CocoaPods error | Run `brew install cocoapods` |
| Build fails | Run `npx expo prebuild --clean` |

---

## Related Commands

- `/how-to:start` - Get started with NextSpark
- `/how-to:deploy` - Deploy to production
- `/how-to:customize-app` - Customize your application

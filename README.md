# Gesture AutoScroller

A Firefox extension for Android that reduces hand strain during mobile reading by providing gesture-controlled autoscrolling and tap-based page navigation.

## Why This Exists

Reading long articles on mobile devices requires repetitive thumb movements to scroll, which can cause hand strain during extended reading sessions. This extension provides ergonomic alternatives:

- **Hands-free reading** with automatic scrolling
- **Simple tap navigation** to avoid dragging gestures
- **Gesture-based speed control** for comfortable reading pace

This is a personal weekend project built to solve my own reading fatigue. I'm sharing it in case others find it useful, but **I'm not interested in adding additional features**. The codebase is straightforward if you want to fork and customize it for your needs.

## Features

### 1. Gesture-Controlled Autoscrolling

Activate hands-free scrolling and control it with simple gestures:

- **Mobile activation**: Two-finger tap anywhere on the page
- **Desktop activation**: Scroll down with mouse wheel or trackpad
- **Pause/Resume**: Single tap anywhere
- **Speed control**: Swipe up to speed up, swipe down to slow down
- **Stop**: Swipe left or right to exit autoscroll mode
- **Auto-start**: Optional countdown timer to start scrolling automatically

### 2. Tap-Based Page Navigation

Quick navigation without dragging (works on both mobile and desktop):

- **Tap left side** of screen → Page up
- **Tap right side** of screen → Page down
- Automatically detects interactive elements (links, buttons) to avoid conflicts

### 3. Site Whitelist Management

Extension only activates on sites you choose:

- **Quick method (mobile)**: Three-finger tap to add/remove current site
- **Settings page**: Manually add domains to whitelist
- Prevents interference with sites where you don't need the features

### 4. Customizable Settings

- Adjustable scrolling speed (1-3000 px/sec)
- Configurable speed adjustment granularity
- Toggle features on/off independently
- Auto-start delay configuration

## Installation & Development

### Prerequisites

- Firefox Desktop (for development)
- `web-ext` tool (Mozilla's extension development tool)
- Firefox for Android (for testing on mobile)

### Quick Start

1. **Clone the repository**:
   ```bash
   cd /path/to/your/projects
   git clone <repository-url>
   cd gesture-autoscroller
   ```

2. **Install web-ext** (if not already installed):
   
   Choose one of these methods:
   ```bash
   # Option 1: npm (if you have Node.js)
   npm install -g web-ext
   
   # Option 2: Homebrew (macOS)
   brew install web-ext
   
   # Option 3: System package manager (Linux)
   # Check your distro's package manager
   
   # Option 4: Use npx without installing
   # Edit scripts to replace 'web-ext' with 'npx web-ext'
   ```
   
   More info: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/

3. **Run in Firefox** (auto-reloads on file changes):
   ```bash
   ./run-firefox.sh
   ```

   This script will:
   - Open Firefox with the extension loaded
   - Auto-reload when you modify files
   - Open the browser console for debugging

4. **Configure the extension**:
   - Click the extension icon or go to `about:addons`
   - Click "Options" for Gesture AutoScroller
   - Add sites to your whitelist (e.g., `medium.com`, `wikipedia.org`)
   - Adjust speed settings to your preference

### Testing on Android

1. **Deploy to Android device**:
   ```bash
   ./deploy-android.sh
   ```

   This script will:
   - Detect connected Android devices
   - Find Firefox installations on your device
   - Deploy the extension for testing
   - Keep it running with live updates

2. **Requirements for Android testing**:
   - USB debugging enabled on your Android device
   - ADB (Android Debug Bridge) installed
   - Firefox or Firefox Nightly installed on device

### Manual Testing

Use the included test script to validate the extension:

```bash
./test-extension.sh
```

This validates:
- Project structure
- Manifest file
- Required files
- Extension lint checks

## How to Use

### Setting Up

1. Open extension settings (click extension icon or go to `about:addons`)
2. Switch to the **Settings** tab
3. Add your favorite reading sites to the whitelist:
   - Type domain (e.g., `medium.com`) and click "Add Host"
   - Or use three-finger tap on any page to quickly add it
4. Configure your preferred speed settings
5. Enable the features you want to use

### Using Autoscroll (Mobile)

1. Navigate to a whitelisted site
2. **Tap with two fingers** anywhere to start autoscrolling
3. **Tap once** to pause, **tap again** to resume
4. **Swipe up/down** to adjust speed while scrolling
5. **Swipe left/right** to stop and exit autoscroll mode

### Using Autoscroll (Desktop)

1. Navigate to a whitelisted site
2. **Scroll down** with mouse wheel or trackpad to activate
3. Use same controls as mobile (tap/click, swipes)

### Using Tap Navigation

When autoscroll is NOT active:
- **Tap/click left side** of screen → Page up
- **Tap/click right side** of screen → Page down

### Quick Whitelist Management (Mobile)

**Three-finger tap** anywhere to instantly add or remove the current site from your whitelist. A toast notification confirms the action.

## Project Structure

```
gesture-autoscroller/
├── src/                      # Extension source code
│   ├── manifest.json        # Extension manifest (Manifest v2)
│   ├── content.js           # Main content script
│   ├── background.js        # Background script (settings)
│   ├── options.html         # Settings & instructions page
│   ├── options.js           # Settings page logic
│   └── icons/               # Extension icons
├── context/                 # Project documentation
│   ├── INTENTION.md         # Project goals & vision
│   ├── FEATURES.md          # Feature specifications
│   └── research/            # Research & reference docs
├── run-firefox.sh           # Development script
├── deploy-android.sh        # Android deployment script
├── test-extension.sh        # Validation script
└── README.md                # This file
```

## Development Scripts

### `run-firefox.sh`

Starts Firefox with the extension loaded and auto-reload enabled:

```bash
./run-firefox.sh
```

Perfect for development - any changes to files in `src/` will automatically reload the extension.

### `deploy-android.sh`

Deploys the extension to a connected Android device:

```bash
./deploy-android.sh
```

Features:
- Auto-detects connected devices
- Interactive Firefox version selection (using `fzf`)
- Live reload on file changes
- Console logging from device

### `test-extension.sh`

Validates extension structure and runs linter:

```bash
./test-extension.sh
```

Checks:
- Required files exist
- Manifest is valid
- Extension passes web-ext lint

## Inspiration & Research

This project was inspired by and draws from:

- [**firefox-simple_gesture**](https://github.com/utubo/firefox-simple_gesture) - Touch event handling and gesture detection patterns
- [**AutoScrolling**](https://github.com/hisakaz0/AutoScrolling) - Core autoscrolling mechanism and speed control

The `context/research/` directory contains detailed analysis of these projects and the code patterns adapted for this extension.

## Technical Details

- **Browser**: Firefox 109.0+ (Desktop and Android)
- **Manifest**: Version 2 (required for Firefox Android)
- **Permissions**: `storage` and `activeTab` (minimal and privacy-friendly)
- **Platforms**: 
  - Primary: Firefox for Android
  - Also works: Firefox Desktop (for development and desktop use)

## Known Limitations

1. **Volume keys**: Cannot be captured by browser extensions due to Android security sandboxing (researched and confirmed not feasible)
2. **Some websites**: Sites with custom scroll containers may require specific handling
3. **Gesture conflicts**: Some sites with their own gesture handlers may interfere

## Contributing

This is a personal project and **I'm not actively seeking feature additions**. However:

- **Bug reports** are welcome
- **Pull requests** for bug fixes are appreciated
- **Forks** are encouraged if you want to customize for your needs

The code is straightforward and well-commented. Feel free to fork and modify to your heart's content!

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contact

For issues or questions, please open an issue on the GitHub repository.

---

**Note**: This is a weekend project built to solve my personal reading fatigue. It works well for my needs, but may not be perfect for everyone. Use at your own discretion and feel free to customize!

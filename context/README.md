# Gesture AutoScroller - Project Context

## Overview
This folder contains all research, planning, and specifications for the Gesture AutoScroller Firefox extension - a mobile reading assistant designed to reduce hand strain.

## Problem Statement
Repetitive thumb movements while scrolling on mobile devices can cause thumb twitching and hand strain during extended reading sessions. This extension provides ergonomic alternatives:
- Tap-based page up/down (no dragging required)
- Gesture-controlled autoscrolling with pause and speed control

**Note**: Volume key remapping was originally planned but removed after technical research determined it's not feasible with WebExtension APIs. See `research/VOLUME_KEYS_RESEARCH.md` for details.

## Document Index

### 1. [INTENTION.md](./INTENTION.md)
**Purpose**: Project vision, goals, and scope definition

**Key Contents**:
- Problem statement (hand strain from repetitive scrolling)
- Core objectives (reduce strain with alternative navigation methods)
- Detailed feature descriptions
- Per-site activation strategy
- Success criteria and non-goals

**Read this first** to understand the project's purpose and boundaries.

---

### 2. [FEATURES.md](./FEATURES.md)
**Purpose**: Detailed specifications for all features

**Key Contents**:
- Volume key remapping specification
- Tap-based page navigation specification
- Gesture-controlled autoscrolling state machine
- Configuration menu layout and behavior
- Host whitelist system
- Technical implementation notes

**Read this** for detailed feature requirements and behavior specifications.

---

### 3. [research/RESEARCH.md](./research/RESEARCH.md)
**Purpose**: Deep analysis of the two reference projects

**Key Contents**:
- firefox-simple_gesture analysis (gesture detection patterns)
- AutoScrolling analysis (autoscroll engine)
- Integration architecture design
- Code reuse strategy
- Performance and testing considerations

**Read this** to understand how we're adapting functionality from reference projects.

---

### 4. [research/PERMISSIONS.md](./research/PERMISSIONS.md)
**Purpose**: Detailed explanation of required Firefox extension permissions

**Key Contents**:
- Minimal permission set (storage, activeTab)
- Permission justifications for each requirement
- Comparison with reference projects' permissions
- Security and privacy considerations
- Complete manifest.json structure

**Read this** to understand why we need specific permissions and how to configure the manifest.

---

### 5. [research/VOLUME_KEYS_RESEARCH.md](./research/VOLUME_KEYS_RESEARCH.md) (NEW!)
**Purpose**: Technical research on volume key capture feasibility

**Key Contents**:
- Comprehensive investigation of volume key event capture
- WebExtension API limitations
- Android platform restrictions
- Alternative approaches explored (all non-viable)
- Definitive verdict: Not feasible
- Recommended alternatives

**Read this** to understand why volume key remapping was removed from the project scope.

---

### 6. [research/CODE_EXTRACTION.md](./research/CODE_EXTRACTION.md)
**Purpose**: Ready-to-use code extracted and adapted from reference projects

**Key Contents**:
- Touch event handling code
- AutoScroller class implementation
- Toast notification system
- Complete content script integration
- Background script for settings
- Storage utilities
- CSS styling

**Read this** when you're ready to start implementing the extension.

---

## Quick Start Guide

### For Understanding the Project:
1. Read `INTENTION.md` - Understand what we're building and why (hand strain reduction)
2. Read `FEATURES.md` - See detailed specifications for each feature
3. Read `research/VOLUME_KEYS_RESEARCH.md` - Understand why volume keys were removed
4. Read `research/RESEARCH.md` - See how we're adapting reference projects
5. Read `research/PERMISSIONS.md` - Understand the permission model

### For Implementation:
1. Review `FEATURES.md` - Understand all feature requirements
2. Review `research/CODE_EXTRACTION.md` - See all the extracted code
3. Use the manifest structure from `research/PERMISSIONS.md`
4. Follow the architecture diagram in `research/RESEARCH.md`

---

## Project Structure

```
gesture-autoscroller/
├── context/                    # This folder (documentation)
│   ├── INTENTION.md           # Project vision & problem statement
│   ├── FEATURES.md            # Detailed feature specifications
│   ├── QUICK_REFERENCE.md     # Quick navigation guide
│   ├── README.md              # This file
│   └── research/              # Research documentation
│       ├── RESEARCH.md        # Analysis of reference projects
│       ├── PERMISSIONS.md     # Permission analysis
│       ├── CODE_EXTRACTION.md # Extracted code snippets
│       └── VOLUME_KEYS_RESEARCH.md # Volume key feasibility research
│
├── src/                       # Extension source code
│   ├── manifest.json          # Extension manifest
│   ├── content.js             # Gesture + tap detection + autoscroll
│   ├── background.js          # Settings + host whitelist management
│   ├── options.html           # Settings/configuration page (with instructions tab)
│   ├── options.js             # Settings UI logic
│   └── icons/                 # Extension icons
│       ├── icon-48.png
│       ├── icon-48.svg
│       ├── icon-96.png
│       └── icon-96.svg
│
├── run-firefox.sh             # Development auto-reload script
├── deploy-android.sh          # Android deployment script
├── test-extension.sh          # Extension validation script
├── LICENSE                    # MIT License
└── README.md                  # Main project README
```

---

## Key Design Decisions

### 1. Minimal Permissions
- Only `storage` and `activeTab` required
- No broad host permissions
- More privacy-friendly than reference projects

### 2. Two Primary Navigation Methods
**Tap Navigation**:
- Right tap → Page down
- Left tap → Page up
- Toggleable

**Gesture Autoscroll**:
- Activate with gesture
- Pause/resume with tap
- Speed control with swipes
- Deactivate with side swipe
- Toggleable

### 3. Per-Site Activation
- Host whitelist system
- Extension only active on reading sites
- Avoids interference with music/video sites

### 4. Focused Feature Set
From **firefox-simple_gesture**, we take:
- ✅ Touch event handling
- ✅ Basic gesture detection
- ✅ Toast notifications
- ❌ Complex gestures
- ❌ Tab management
- ❌ Custom scripting

From **AutoScrolling**, we take:
- ✅ Core scroll engine
- ✅ Speed management
- ✅ State tracking
- ❌ Browser action UI
- ❌ Context menus
- ❌ Multi-tab state

New features we're adding:
- ✅ Tap-based page navigation (left/right screen regions)
- ✅ Pause/resume with tap detection
- ✅ Speed adjustment during scrolling/pause
- ✅ Side swipe deactivation
- ✅ Host whitelist management
- ✅ Options page with comprehensive settings
- ❌ ~~Volume key remapping~~ (not feasible - see VOLUME_KEYS_RESEARCH.md)

### 5. Speed Configuration
**Granular speed control**:
- Default speed: User configurable
- Min/max speed bounds: Prevent too slow/fast
- Granularity: How much each swipe adjusts speed
- All configurable in options page

### 6. State Machine for Autoscroll
Three states:
- **INACTIVE**: Normal browsing
- **SCROLLING**: Auto-scrolling at current speed
- **PAUSED**: Scroll position frozen, ready to resume or deactivate

---

## Reference Projects

### 1. firefox-simple_gesture
- **GitHub**: https://github.com/utubo/firefox-simple_gesture
- **Purpose**: Touch gesture detection for Firefox Android
- **What we learned**: Touch event patterns, gesture detection algorithms

### 2. AutoScrolling
- **GitHub**: https://github.com/pinkienort/AutoScrolling
- **Purpose**: Automatic page scrolling for Firefox
- **What we learned**: Scroll engine implementation, speed control

---

## Development Workflow

### Phase 1: Research & Planning ✅ Complete
- [x] Research reference projects
- [x] Define scope and intentions
- [x] Analyze required permissions
- [x] Extract and adapt code
- [x] Research volume key feasibility (Result: Not feasible)

### Phase 2: Core Implementation ✅ Complete
- [x] **Step 1: Project Setup & Testing Automation**
  - [x] Create src/ directory structure
  - [x] Create basic manifest.json
  - [x] Set up script to automatically load plugin in Firefox
  - [x] Create Android deployment script
  - [x] Create extension validation script
- [x] **Step 2: Configuration Menu**
  - [x] Create options.html UI with tabbed interface
  - [x] Implement options.js (settings management)
  - [x] Implement background.js (settings storage and retrieval)
  - [x] Add extension icons (SVG and PNG)
  - [x] Add feature toggle checkboxes
  - [x] Add speed configuration sliders
  - [x] Add instructions tab with comprehensive usage guide
- [x] **Step 3: Tap to Navigate**
  - [x] Implement tap detection logic
  - [x] Add left/right screen region detection
  - [x] Implement page up/down scrolling
  - [x] Add visual feedback (toasts)
  - [x] Handle interactive element conflicts
  - [x] Add 3-finger tap for quick whitelist management
- [x] **Step 4: Gesture Control for Auto Scrolling**
  - [x] Implement gesture detection (two-finger tap on mobile, scroll on desktop)
  - [x] Implement AutoScroller class (core scrolling)
  - [x] Add pause/resume with tap detection
  - [x] Add speed modulation (swipe up/down)
  - [x] Add side swipe deactivation (works from both scrolling and paused states)
  - [x] Add visual indicators and toasts
  - [x] Add auto-start feature with countdown timer
- [x] **Step 5: Host Whitelisting**
  - [x] Implement host whitelist logic in background.js
  - [x] Add host matching rules
  - [x] Add whitelist UI in options page
  - [x] Implement per-site activation check in content.js
  - [x] Add 3-finger tap quick toggle for current site

### Phase 3: Testing & Refinement ✅ Complete
- [x] Test on Firefox Desktop
- [x] Test tap detection (left/right regions)
- [x] Test gesture detection accuracy
- [x] Test autoscroll pause/resume
- [x] Test speed adjustment
- [x] Test host whitelist functionality
- [x] Test on Firefox for Android
- [x] Verify no interference with interactive elements
- [x] Fix various bugs (mouse release, side swipe, continuous gestures)

### Phase 4: Documentation ✅ Complete
- [x] Create comprehensive README
- [x] Add MIT license
- [x] Write user instructions in options page
- [x] Clean up temporary markdown files
- [x] Document development workflow

---

## Technical Requirements

### Minimum Browser Version
- Firefox 142.0+ (Desktop & Android)
- Manifest v2 (v3 not yet fully supported on Firefox Android)

### Development Tools
- Firefox Developer Edition
- web-ext CLI tool
- Android device or emulator for testing

### Testing Checklist ✅ Complete
- [x] Touch events work correctly
- [x] Tap detection distinguishes quick taps from drags
- [x] Left/right screen regions correctly trigger page up/down
- [x] Gestures detected accurately (swipes, two-finger tap)
- [x] Autoscroll activation works (two-finger tap on mobile, scroll on desktop)
- [x] Pause/resume with tap works correctly
- [x] Speed adjustment with swipes works
- [x] Side swipe deactivation works from both scrolling and paused states
- [x] Scrolling is smooth
- [x] Speed changes take effect immediately
- [x] Settings persist across sessions
- [x] Host whitelist works correctly
- [x] Extension inactive on non-whitelisted sites
- [x] 3-finger tap quick whitelist toggle works
- [x] Auto-start with countdown timer works
- [x] No interference with clickable elements
- [x] No memory leaks observed
- [x] No performance issues

---

## Known Limitations

1. **Volume Keys**: ~~May not be accessible via standard WebExtension APIs on Android~~
   - **CONFIRMED**: Not accessible - removed from scope after comprehensive research
   - See `research/VOLUME_KEYS_RESEARCH.md` for complete technical analysis
   - Reason: Android platform restrictions prevent WebExtensions from capturing hardware volume keys

2. **Page Compatibility**: Some sites with custom scroll containers may not work perfectly

3. **Firefox Android Only**: Not designed for desktop or other browsers

4. **Manifest v2**: Will need migration when Firefox Android fully supports v3

5. **Tap Conflicts**: Taps on interactive elements (links, buttons) should work normally
   - Implementation must detect interactive elements and skip tap navigation

6. **Gesture Conflicts**: Multiple features using gestures must not interfere
   - Tap navigation active only when autoscroll inactive
   - Context-aware gesture handling required

---

## Questions & Decisions

### Resolved
- ✅ Use minimal permissions (storage + activeTab)
- ✅ Focus on ergonomic navigation features
- ✅ Two distinct navigation methods (tap, autoscroll)
- ✅ Host whitelist for per-site activation
- ✅ Granular speed configuration with bounds
- ✅ Pause/resume functionality for autoscroll
- ✅ Use extracted code patterns from both projects
- ✅ Target Firefox 109.0+ (Android & Desktop)
- ✅ Volume key feasibility: NOT POSSIBLE (removed from scope)
- ✅ Visual indicators: Toast notifications
- ✅ Options page design: Tabbed interface with Settings and Instructions
- ✅ Extension icons: SVG with PNG exports
- ✅ Default whitelist: Empty (user adds sites)
- ✅ Activation gesture: Two-finger tap (mobile) or scroll down (desktop)
- ✅ Quick whitelist management: 3-finger tap to toggle current site
- ✅ Auto-start feature: Optional countdown timer for automatic scrolling
- ✅ Side swipe: Works from both SCROLLING and PAUSED states

---

## Resources

### Documentation
- [WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Firefox for Android Extensions](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)
- [Touch Events API](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)

### Reference Code
- All extracted code is in [CODE_EXTRACTION.md](./research/CODE_EXTRACTION.md)
- Original projects linked above

### Tools
- [web-ext](https://github.com/mozilla/web-ext) - CLI for extension development
- [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/)

---

## Contributing

When working on this project:

1. **Review documentation first** - Understand the scope and decisions
2. **Keep it simple** - Resist feature creep
3. **Test thoroughly** - Especially on real Android devices
4. **Update docs** - Keep this context folder current with any major decisions

---

## License

MIT License - See [LICENSE](../LICENSE) file for details.

---

**Last Updated**: January 24, 2026  
**Status**: Project Complete ✅  
**Note**: This is a personal weekend project. The extension is fully functional and available for use.

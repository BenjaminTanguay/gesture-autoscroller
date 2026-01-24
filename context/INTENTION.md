# Project Intention: Gesture AutoScroller

## Overview
A Firefox extension for Android that helps reduce hand strain while reading on mobile devices by providing multiple navigation methods: volume key remapping, tap-based page navigation, and gesture-controlled autoscrolling.

## Problem Statement
Repetitive thumb movements to scroll pages on mobile devices can cause thumb twitching and hand strain during extended reading sessions. This extension provides ergonomic alternatives to reduce physical strain.

## Core Objectives

### 1. Reduce Hand Strain
- Eliminate repetitive dragging motions required for scrolling
- Provide alternative navigation methods that require minimal thumb movement
- Enable hands-free reading with automatic scrolling

### 2. Two Primary Navigation Methods
**Tap-Based Navigation**
- Tap right side of screen → page down
- Tap left side of screen → page up
- No dragging required

**Gesture-Controlled Autoscrolling**
- Activate with a gesture
- Pause by tapping anywhere
- Adjust speed with up/down gestures while active/paused
- Deactivate with a side swipe gesture while paused

### 3. Per-Site Control
- Only activate on specified hosts (whitelist approach)
- Prevent interference on sites where standard controls are needed
- Visual indicator when extension is active

## Target Platform
- **Primary**: Firefox for Android (manifest v2)
- **Browser Compatibility**: Firefox 142.0+
- **Device**: Android mobile devices with touch support

## Scope Constraints

This project focuses on **ergonomic reading** rather than complex gesture automation:

### From firefox-simple_gesture:
- **Take**: Touch event handling (touchstart, touchmove, touchend)
- **Take**: Gesture detection logic (swipe directions, tap detection)
- **Take**: Content script injection pattern
- **Take**: Storage API usage for settings
- **Skip**: Complex gesture combinations (multi-finger beyond two-finger tap)
- **Skip**: Custom gesture scripting
- **Skip**: Desktop support
- **Skip**: User agent switching
- **Skip**: Tab management features

### From AutoScrolling:
- **Take**: Core auto-scroll mechanism (setInterval-based scrolling)
- **Take**: Speed calculation and parsing
- **Take**: Scroll element detection
- **Take**: State management (scrolling/paused/stopped)
- **Skip**: Browser action UI modal (using options page instead)
- **Skip**: Context menus
- **Skip**: Window/tab focus tracking beyond basic visibility
- **Skip**: Complex "stop on hover" features

### New Features Required:
- **Add**: Screen region tap detection (left/right side)
- **Add**: Pause state with tap detection
- **Add**: Speed adjustment with up/down gestures during scrolling/pause
- **Add**: Side swipe deactivation from paused state
- **Add**: Host whitelist management
- **Add**: Granular speed configuration (min/max bounds, granularity)
- **Add**: Options page with feature toggles and speed settings
- **Skip**: Volume key detection (not technically feasible - see VOLUME_KEYS_RESEARCH.md)


## Key Features (Detailed)

### 1. Tap-Based Page Navigation
- Right side tap → Page down
- Left side tap → Page up
- Toggleable feature (can be enabled/disabled in settings)
- Screen split position configurable (default: 50/50 left/right)
- Respects host whitelist

### 2. Gesture-Controlled Autoscrolling
**Activation**:
- Use gesture (e.g., swipe down or two-finger tap) to start autoscrolling
- Toggleable feature (can be enabled/disabled in settings)

**Pause Control**:
- Tap anywhere on screen to pause autoscrolling
- Visual indicator shows paused state
- Tap again to resume

**Speed Modulation**:
- While scrolling or paused: swipe up to increase speed
- While scrolling or paused: swipe down to decrease speed
- Visual feedback shows current speed level
- Speed changes are granular and configurable

**Deactivation**:
- While paused: side swipe gesture (left or right) to deactivate
- Returns to normal browsing mode

### 3. Configuration Menu
**Feature Toggles**:
- [ ] Enable tap to page up/down
- [ ] Enable gesture autoscroll

**Speed Settings**:
- Default scrolling speed (slider or numeric input)
- Minimum speed bound
- Maximum speed bound
- Granularity setting (how much each speed adjustment changes the speed)

**Host Whitelist**:
- List of hosts where extension is active
- Add/remove hosts
- Quick toggle for current site
- Examples: "medium.com", "news.ycombinator.com", "reddit.com"

### 4. Smart Activation
- Extension only active on whitelisted hosts
- Visual indicator when extension is active on current page
- Easy one-click to add current site to whitelist

---

## Removed Features

### ~~Volume Key Remapping~~ ❌ NOT FEASIBLE

**Status**: Removed from scope after technical research

**Reason**: Hardware volume keys on Android cannot be captured by WebExtensions due to:
- Android platform architecture (system-level key handling)
- Security sandboxing (browsers cannot override system keys)
- No WebExtension API support (neither Firefox nor Chrome)

**Research**: See `context/research/VOLUME_KEYS_RESEARCH.md` for complete technical analysis

**Impact**: The two remaining features (tap navigation and autoscrolling) still achieve the core objective of reducing hand strain without needing volume keys.

## User Experience Goals
- Reduce thumb/hand strain during extended reading sessions
- Provide multiple navigation methods to suit different contexts
- Minimal UI footprint (no persistent buttons/modals)
- Natural gesture-based interaction
- Per-site control to avoid interference with normal browsing
- Works on long-form content sites (articles, documentation, news, blogs)

## Technical Approach
- Manifest v2 (Firefox for Android compatibility)
- Content script for gesture detection, tap detection, and scroll control
- Background script for state management and settings
- Volume key event detection (if possible via WebExtension APIs)
- Local storage for user preferences and host whitelist
- Options page for configuration
- Minimal dependencies (vanilla JavaScript)

## Success Criteria
1. **Tap Navigation**: User can page up/down with simple taps instead of dragging
2. **Autoscroll Control**: User can activate, pause, adjust speed, and deactivate autoscrolling with gestures
3. **Speed Adjustment**: Granular speed control with configurable bounds
4. **Per-Site Activation**: Extension only active on whitelisted hosts
5. **Low Performance Impact**: Smooth scrolling and responsive gestures without jank
6. **Configuration Flexibility**: Easy-to-use settings menu for all features
7. **Hand Strain Reduction**: Measurably reduces repetitive thumb movements
8. **No Interference**: Taps on interactive elements (links, buttons) work normally

## Non-Goals
- Complex gesture sequences beyond basic swipes and taps
- Desktop browser support (focus on mobile Firefox only)
- Custom scripting/advanced customization beyond settings
- Integration with other extensions
- Cloud sync of settings
- Analytics or telemetry
- Support for all possible gesture combinations
- Mouse/trackpad gesture support

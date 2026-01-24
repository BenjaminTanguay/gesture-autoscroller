# Feature Specifications

## Overview
This document provides detailed specifications for all features in the Gesture AutoScroller extension.

**Note**: Volume key remapping was originally planned but removed after technical research determined it is not feasible with WebExtension APIs. See `research/VOLUME_KEYS_RESEARCH.md` for details.

---

## Feature 1: Tap-Based Page Navigation

### Purpose
Enable simple tap/click navigation without dragging gestures.

### Behavior
- **Tap/Click on right side of screen** → Page down (scroll down one viewport height)
- **Tap/Click on left side of screen** → Page up (scroll up one viewport height)
- **Three-finger tap (mobile only)** → Toggle extension for current site (add/remove from whitelist)
- Works on both mobile (touch) and desktop (mouse click)
- Screen divided into left/right regions (default: 50/50 split)
- Only active when feature is enabled AND current host is whitelisted
- Tap/click must be quick (not a long press or drag)

### Configuration
- **Toggle**: "Enable tap to page up/down" checkbox in settings
- **Default**: Enabled
- **Per-Site**: Respects host whitelist setting
- **Quick Management**: Three-finger tap (mobile) adds/removes current site from whitelist
- **Advanced** (future): Adjustable split position (e.g., 40/60, 30/70)

### Tap/Click Detection Criteria
- Touch/click duration < 200ms
- Touch/click movement < 10px
- Single finger/click for navigation, three fingers for site management

### Finger/Button Count Detection
- **1 finger/1 click**: Page navigation (left/right side) or pause/resume autoscroll
- **2 fingers (mobile)**: Activate autoscroll
- **3 fingers (mobile)**: Toggle extension for current site (add/remove from whitelist)

### Edge Cases
- Should not interfere with clickable elements (links, buttons)
- Should not trigger if text selection is active
- Should not trigger if user is interacting with form elements

### User Stories
- As a reader, I want to tap the right side to move down the page without dragging
- As a reader, I want to tap the left side to go back up if I missed something
- As a user, I want taps on buttons/links to work normally (no interference)

---

## Feature 2: Gesture-Controlled Autoscrolling

### Purpose
Enable hands-free reading with gesture-based speed control and pause capability.

### State Machine

```
┌─────────┐
│ INACTIVE│ (default state)
└────┬────┘
     │
     │ activation gesture:
     │ - Mobile: two-finger tap
     │ - Desktop: scroll down anywhere
     ▼
┌─────────┐
│SCROLLING│ (auto-scrolling at current speed)
└────┬────┘
     │
     │ Available actions:
     │ • tap anywhere → PAUSED
     │ • side swipe → INACTIVE (✨ NEW)
     ▼
┌─────────┐
│ PAUSED  │ (scroll position frozen)
└────┬────┘
     │
     ├─ tap anywhere → back to SCROLLING
     │
     └─ side swipe (left or right) → back to INACTIVE
```

### 2.1 Activation

**Mobile Trigger**: Two-finger tap
**Desktop Trigger**: Scroll down with mouse wheel or trackpad
- Gesture must be detected within a small area (mobile) or any scroll down motion (desktop)
- Visual feedback: Toast shows "Autoscroll activated"
- State transition: INACTIVE → SCROLLING
- Scrolling begins at default speed

### 2.2 Pause/Resume

**While SCROLLING**:
- **Tap anywhere** → Pause scrolling
- Visual feedback: Toast shows "Paused"
- State transition: SCROLLING → PAUSED
- Scroll position is frozen

**While PAUSED**:
- **Tap anywhere** → Resume scrolling
- Visual feedback: Toast shows "Resumed"
- State transition: PAUSED → SCROLLING
- Scrolling continues at previous speed

### 2.3 Speed Modulation

**While SCROLLING or PAUSED**:
- **Swipe up** → Increase speed by one granularity step
- **Swipe down** → Decrease speed by one granularity step
- Visual feedback: Toast shows current speed (e.g., "Speed: 3.5 px/frame")
- Speed clamped to [minSpeed, maxSpeed] bounds
- Speed changes take effect immediately (even when paused)

**Speed Formula**:
```
newSpeed = currentSpeed + (swipeDirection * granularity)
clampedSpeed = Math.max(minSpeed, Math.min(maxSpeed, newSpeed))
```

### 2.4 Deactivation

**While SCROLLING or PAUSED**:
- **Side swipe left or right** → Deactivate autoscroll
- Visual feedback: Toast shows "Autoscroll stopped"
- State transition: SCROLLING or PAUSED → INACTIVE
- Clears all autoscroll state
- **Note**: Side swipe now works from both SCROLLING and PAUSED states

**Automatic Deactivation**:
- Reached bottom of page → INACTIVE
- User manually scrolls (touch drag detected) → INACTIVE

### 2.5 Visual Indicators

**While SCROLLING**:
- Optional: Subtle overlay icon (arrow pointing down)
- Optional: Speed indicator in corner

**While PAUSED**:
- Optional: Pause icon overlay
- Optional: Speed indicator remains visible

### Configuration

**Toggle**: "Enable gesture autoscroll" checkbox in settings
- **Default**: Enabled

**Speed Settings**:
- **Default speed**: 2.0 px/frame (slider: 0.5 - 10.0)
- **Minimum speed bound**: 0.5 px/frame (prevents too-slow scrolling)
- **Maximum speed bound**: 10.0 px/frame (prevents too-fast scrolling)
- **Granularity**: 0.5 px/frame (how much each swipe adjusts speed)

**Per-Site**: Respects host whitelist setting

### User Stories
- As a reader, I want to activate autoscroll with a simple gesture
- As a reader, I want to pause scrolling to study a diagram or take notes
- As a reader, I want to adjust speed on the fly if content is easy/hard to read
- As a reader, I want to quickly exit autoscroll mode with a swipe

---

## Feature 3: Configuration Menu (Options Page)

### Purpose
Provide centralized control for all extension features and settings.

### Layout

```
┌──────────────────────────────────────────┐
│  Gesture AutoScroller Settings          │
├──────────────────────────────────────────┤
│                                          │
│  FEATURE TOGGLES                         │
│  ┌────────────────────────────────────┐  │
│  │ ☑ Enable tap to page up/down      │  │
│  │ ☑ Enable gesture autoscroll       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  AUTOSCROLL SPEED SETTINGS               │
│  ┌────────────────────────────────────┐  │
│  │ Default speed:  [====●---] 2.0    │  │
│  │ Min speed:      [●--------] 0.5    │  │
│  │ Max speed:      [========●-] 10.0  │  │
│  │ Granularity:    [==●-------] 0.5   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ACTIVE HOSTS (WHITELIST)               │
│  ┌────────────────────────────────────┐  │
│  │ ✓ medium.com                [X]    │  │
│  │ ✓ news.ycombinator.com      [X]    │  │
│  │ ✓ reddit.com                [X]    │  │
│  │                                    │  │
│  │ Add host: [____________] [Add]     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  CURRENT PAGE                            │
│  ┌────────────────────────────────────┐  │
│  │ You are on: example.com            │  │
│  │ Status: Not whitelisted            │  │
│  │ [Add current site to whitelist]    │  │
│  └────────────────────────────────────┘  │
│                                          │
│             [Save Settings]              │
└──────────────────────────────────────────┘
```

### Feature Toggles Section
- Two checkboxes for each main feature
- Changes saved immediately (or on "Save Settings" button click)
- Visual indicator when feature is enabled

### Speed Settings Section
- Four sliders with numeric display
- **Default speed**: Starting speed when autoscroll activates
- **Min speed**: Lower bound for speed adjustment
- **Max speed**: Upper bound for speed adjustment
- **Granularity**: Amount each swipe up/down changes speed
- Real-time validation (min < default < max)

### Host Whitelist Section
- List of currently whitelisted hosts
- Each entry has a delete button [X]
- Text input + "Add" button to add new hosts
- Validates host format (basic domain validation)
- Checkbox to enable/disable individual hosts without deleting

### Current Page Section
- Shows current tab's host
- Shows whether current site is whitelisted
- Quick "Add current site" button
- Opens in new tab or popup (accessible from toolbar icon)

### Data Persistence
- Settings stored in `browser.storage.local`
- Settings structure:
```javascript
{
  tapNavigationEnabled: true,
  autoscrollEnabled: true,
  defaultSpeed: 2.0,
  minSpeed: 0.5,
  maxSpeed: 10.0,
  granularity: 0.5,
  whitelistedHosts: [
    "medium.com",
    "news.ycombinator.com",
    "reddit.com"
  ]
}
```

### User Stories
- As a user, I want to easily enable/disable features without editing code
- As a user, I want to customize scrolling speed to my reading pace
- As a user, I want to whitelist specific sites where I do most of my reading
- As a user, I want to quickly add the current site to my whitelist

---

## Feature 4: Host Whitelist System

### Purpose
Ensure extension only activates on intended sites, preventing interference elsewhere.

### Quick Site Management (NEW)
- **Three-finger tap**: Instantly add or remove current site from whitelist
- No need to open settings page
- Works from any state (inactive, scrolling, or paused)
- Shows toast notification confirming action
- Perfect for mobile users who find the settings page cumbersome

### Behavior
- Extension checks current page host against whitelist on page load
- If host matches whitelist: Activate content script features
- If host not in whitelist: Extension remains inactive (do nothing)
- Host matching is exact match or suffix match (for subdomains)

### Host Matching Rules
- Exact match: "example.com" matches "example.com"
- Subdomain match: "example.com" matches "www.example.com" and "blog.example.com"
- No partial match: "example.com" does NOT match "notexample.com"
- Port agnostic: "example.com" matches "example.com:8080"
- Protocol agnostic: Match regardless of http/https

### Default Whitelist
- Empty on first install (user must add sites manually)
- OR pre-populate with common reading sites:
  - medium.com
  - dev.to
  - news.ycombinator.com
  - reddit.com
  - wikipedia.org

### Visual Feedback
- Browser action icon shows enabled/disabled state:
  - **Colored icon**: Extension active on current site
  - **Grayed out icon**: Extension inactive on current site
- Clicking icon opens options page (or popup with quick toggle)

### User Stories
- As a user, I want the extension to only work on reading sites
- As a user, I want volume buttons to work normally on YouTube and Spotify
- As a user, I want to quickly see if the extension is active on the current page

---

## Removed Features

### ~~Feature: Volume Key Remapping~~ ❌ NOT FEASIBLE

**Original Intent**: Remap hardware volume up/down buttons to page up/down

**Status**: Removed from project scope after comprehensive technical research

**Research Date**: January 24, 2026

**Reason for Removal**:
Volume key capture is **not technically possible** in Firefox Android WebExtensions due to:

1. **Android Platform Architecture**: Volume keys are handled at the Android system framework level, before events reach the browser
2. **Security Sandboxing**: Browsers cannot override system-level key handling by design (prevents malicious extensions)
3. **No API Support**: Neither Firefox nor Chrome WebExtension APIs expose volume key events
4. **Cross-Browser Limitation**: This affects all browsers on Android, not just Firefox

**Research Documentation**: See `context/research/VOLUME_KEYS_RESEARCH.md` for complete technical analysis including:
- WebExtension API investigation
- Alternative approaches explored (all non-viable)
- Mozilla documentation references
- Cross-browser comparison
- Recommended alternatives

**Impact on Project**: Minimal - the two remaining features (tap navigation and autoscrolling) still fully achieve the core objective of reducing hand strain during mobile reading.

**Alternative Solutions Considered**:
- On-screen buttons (less ergonomic)
- External Bluetooth controllers (requires hardware)
- Native Android app (much more complex, outside WebExtension scope)

**Recommendation**: Focus development effort on the two viable and fully-implementable features.

---

## Technical Implementation Notes

### Implementation Order (Reordered)
1. **Step 1: Project Setup & Testing Automation** (Foundation)
   - Create project structure (src/ directory)
   - Create basic manifest.json
   - Set up Firefox auto-load script for easier testing
   - Test with "Hello World" plugin to verify setup

2. **Step 2: Configuration Menu** (Core Infrastructure)
   - Options page UI (options.html + options.js)
   - Settings storage and retrieval (background.js)
   - Feature toggle checkboxes
   - Speed configuration sliders
   - Extension icons

3. **Step 3: Tap to Navigate** (First Feature)
   - Tap detection logic
   - Left/right screen region detection
   - Page up/down scrolling
   - Visual feedback (toasts)
   - Interactive element conflict handling

4. **Step 4: Gesture Control for Auto Scrolling** (Core Feature - Multiple Sub-steps)
   - 4a. Gesture detection for activation
   - 4b. AutoScroller class implementation (core scrolling engine)
   - 4c. Pause/resume with tap detection
   - 4d. Speed modulation with swipe up/down
   - 4e. Side swipe deactivation
   - 4f. Visual indicators and state management

5. **Step 5: Host Whitelisting** (Access Control)
   - Host whitelist logic in background.js
   - Host matching rules
   - Whitelist UI in options page
   - Per-site activation check in content.js
   - Browser action icon state (active/inactive)

### Priority Order for MVP Features
- **Must Have**: Steps 1-5 (all features listed above)
- **Should Have**: Speed configuration refinements, visual indicators
- **Nice to Have**: Advanced tap split configuration, import/export settings

### Known Technical Challenges
1. **~~Volume Keys~~**: ~~May not be capturable via standard WebExtension APIs~~
   - **RESOLVED**: Not feasible - removed from scope (see VOLUME_KEYS_RESEARCH.md)

2. **Tap Detection**: Must not interfere with legitimate clicks
   - Solution: Check if tap target is interactive element (link, button, input)
   - Solution: Only handle taps on non-interactive areas

3. **Gesture Conflicts**: Tap for pause vs. tap for page navigation
   - Solution: Different contexts (autoscroll active vs. inactive)
   - When autoscrolling: tap = pause/resume
   - When not autoscrolling: tap = page up/down (if feature enabled)

4. **Performance**: Smooth scrolling without jank
   - Use requestAnimationFrame for scroll updates
   - Throttle touch event processing
   - Clean up intervals/listeners properly

---

## Future Enhancements (Out of Scope for v1)

- **Customizable gestures**: Let users choose activation gesture
- **Speed presets**: Save multiple speed profiles
- **Reading progress**: Track how much of page has been read
- **Smart pause**: Auto-pause at headings or images
- **Sync settings**: Sync whitelist/settings across devices
- **Dark mode support**: For settings page
- **Keyboard shortcuts**: Desktop fallback controls
- **Analytics**: Track usage patterns (with user consent)

---

**Last Updated**: January 24, 2026

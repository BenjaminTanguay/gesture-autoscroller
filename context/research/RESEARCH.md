# Gesture AutoScroller - Research Summary

## 1. firefox-simple_gesture Analysis

### Purpose
Touch gesture detection and command execution for Firefox on Android.

### Key Components

#### Manifest Configuration
```json
{
  "manifest_version": 2,
  "permissions": [
    "*://*/*",
    "storage",
    "tabs",
    "scripting",
    "activeTab",
    "sessions",
    "declarativeNetRequest"
  ],
  "content_scripts": [{
    "matches": ["*://*/*"],
    "js": ["content.js"],
    "run_at": "document_start"
  }],
  "background": {
    "scripts": ["background.js"]
  }
}
```

#### Touch Event Handling (content.js)
- **Event Listeners**: touchstart, touchmove, touchend, touchcancel
- **Gesture Detection**:
  - Tracks touch position (x, y coordinates)
  - Calculates movement direction (U/D/L/R arrows)
  - Detects stroke size threshold
  - Supports multi-finger detection
  - Timeout mechanism for gesture reset

**Key Code Patterns**:
```javascript
// Touch event setup
window.addEventListener('touchstart', onTouchStart, true);
window.addEventListener('touchmove', onTouchMove, true);
window.addEventListener('touchend', onTouchEnd, true);

// Gesture tracking
let arrows = []; // e.g., ['D', 'L'] for down-left swipe
let startPoint = ''; // edge detection: 'L:', 'R:', 'T:', 'B:'
let fingers = ''; // e.g., '2:' for two-finger gesture

// Direction calculation
const dx = x - lx;
const dy = y - ly;
const a = absX < absY ? (dy < 0 ? 'U' : 'D') : (dx < 0 ? 'L' : 'R');
```

#### Communication Pattern
- Content script → Background script via `browser.runtime.sendMessage()`
- Background script executes commands (history navigation, scrolling, tab management)

#### Relevant Functions for Our Use
1. `SimpleGesture.getXY()` - Get touch coordinates
2. `scroll()` - Scroll page smoothly
3. `doCommand()` - Execute gesture commands
4. Toast notifications for user feedback

### What We Need
- Touch event listener setup pattern
- Basic gesture detection (single tap, swipe up/down)
- Coordinate tracking and direction calculation
- Storage API usage pattern
- Communication between content and background scripts

### What We Skip
- Complex multi-direction gestures (L-D-R patterns)
- Edge gesture detection
- Multi-finger gestures (keeping it simple)
- Custom gesture scripting
- Tab/window management
- User agent switching

---

## 2. AutoScrolling Analysis

### Purpose
Automatic page scrolling with speed control, activated via browser action.

### Key Components

#### Manifest Configuration
```json
{
  "manifest_version": 2,
  "permissions": ["storage", "tabs", "menus"],
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["dist/content.js"],
    "css": ["dist/style.css"]
  }],
  "background": {
    "scripts": ["dist/background.js"]
  },
  "browser_action": {
    "default_icon": { ... }
  }
}
```

#### AutoScroller Class (auto-scroller.js)
Core scrolling engine with these capabilities:

**Scroll Mechanism**:
```javascript
start(speed) {
  this.scrollingElement = document.scrollingElement || document.documentElement;
  this.setScrollingSpeed(speed); // Parse speed into step/interval
  this.intervalId = window.setInterval(
    this.scroll.bind(this),
    this.scrollingInterval
  );
}

scroll() {
  if (isBottomOfWindow()) return this.stop(true);
  this.scrollingElement.scrollBy(0, this.scrollingStep);
}

setScrollingSpeed(speed) {
  const { step, interval } = parseSpeed(speed);
  this.scrollingStep = step; // pixels per scroll
  this.scrollingInterval = interval; // milliseconds between scrolls
}
```

**Speed Parser**:
- Converts speed strings like "fast", "slow", "5" into step/interval pairs
- Step = pixels to scroll per iteration
- Interval = milliseconds between scroll iterations

#### State Management (background/index.js)
- Manages scroll state: STOP_OR_CLOSE, SCROLLING, SLOW_SCROLLING, MIDDLE_SCROLLING, FAST_SCROLLING
- Handles browser action clicks
- Communicates with content script via messaging

#### Message Passing Pattern
```javascript
// Background → Content
sendMessageToTab(tabId, {
  action: ACTION_START_SCROLLING,
  data: { scrollingSpeed: speed }
});

// Content receives message
onMessageListener(msg) {
  switch (msg.action) {
    case ACTION_START_SCROLLING:
      this.autoScroller.start(msg.data.scrollingSpeed);
      break;
    case ACTION_STOP_SCROLLING:
      this.autoScroller.stop();
      break;
  }
}
```

### What We Need
- AutoScroller class structure
- Speed calculation logic (step + interval)
- setInterval-based scrolling mechanism
- Message-based control (start/stop/change speed)
- Scroll element detection
- Bottom-of-page detection

### What We Skip
- Browser action UI
- Modal for speed selection
- Context menus
- Multi-tab state tracking
- Window focus management
- Double-click detection
- Mouse wheel detection
- "Stop on hover" feature
- Keyboard command bindings

---

## 3. Required Permissions for Combined Extension

### Minimal Permission Set

```json
{
  "permissions": [
    "storage",        // Store user preferences and per-site settings
    "activeTab"       // Access current tab for gesture detection
  ]
}
```

### Permission Justification

1. **storage**
   - Save scroll speed preferences
   - Store per-site enable/disable settings
   - Save gesture mappings
   - Store volume key rebinding settings

2. **activeTab**
   - Required for content script to detect gestures
   - Access current page's scroll position
   - Control scrolling behavior
   - Much more restricted than `tabs` permission

### Permissions We DON'T Need
- `tabs` - Not managing multiple tabs
- `sessions` - Not restoring closed tabs
- `declarativeNetRequest` - Not modifying requests
- `scripting` - Using content_scripts instead
- `menus` - No context menus
- `*://*/*` - Not needed with activeTab + content_scripts

### Content Scripts Configuration
```json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "css": ["style.css"],
    "run_at": "document_start"
  }]
}
```

### Background Script
```json
{
  "background": {
    "scripts": ["background.js"]
  }
}
```

---

## 4. Integration Architecture

### Simplified Component Structure

```
┌─────────────────────────────────────┐
│         Content Script              │
│  ┌──────────────────────────────┐   │
│  │   GestureDetector            │   │
│  │   - touchstart/move/end      │   │
│  │   - simple swipe detection   │   │
│  │   - tap detection            │   │
│  └──────────┬───────────────────┘   │
│             │                        │
│  ┌──────────▼───────────────────┐   │
│  │   AutoScroller               │   │
│  │   - start(speed)             │   │
│  │   - stop()                   │   │
│  │   - changeSpeed(speed)       │   │
│  │   - setInterval scrolling    │   │
│  └──────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │ browser.runtime.sendMessage
               │
┌──────────────▼──────────────────────┐
│      Background Script               │
│  ┌──────────────────────────────┐   │
│  │   SettingsManager            │   │
│  │   - load/save preferences    │   │
│  │   - per-site configurations  │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Key Integration Points

1. **Gesture → Scroll Control**
   - Single tap → toggle scrolling (start/stop)
   - Swipe up → increase speed
   - Swipe down → decrease speed
   - Two-finger tap → pause/resume (optional)

2. **Speed Levels**
   - Slow: step=1, interval=50ms
   - Medium: step=2, interval=50ms
   - Fast: step=5, interval=50ms
   - Very Fast: step=10, interval=50ms

3. **Message Types**
   ```javascript
   // Simple message enum
   const MSG = {
     START_SCROLL: 'start',
     STOP_SCROLL: 'stop',
     CHANGE_SPEED: 'speed',
     SAVE_SETTINGS: 'save'
   };
   ```

---

## 5. Implementation Priorities

### Phase 1: Core Functionality
1. Basic gesture detection (tap, swipe up/down)
2. Simple autoscroll engine (start/stop)
3. Speed adjustment (3-4 speed levels)
4. Settings storage

### Phase 2: Enhancements
1. Per-site enable/disable
2. Visual feedback (toast notifications)
3. Pause/resume functionality
4. Page bottom detection

### Phase 3: Advanced (Optional)
1. Volume key rebinding
2. More gesture types
3. Custom speed configuration
4. Blacklist/whitelist UI

---

## 6. Code Reuse Strategy

### From firefox-simple_gesture
- Touch event listener setup pattern
- Coordinate tracking logic
- Direction detection algorithm
- Toast notification system
- Storage API wrapper

### From AutoScrolling
- AutoScroller class (simplified)
- Speed parser logic
- Scroll element detection
- Message passing structure

### New Code Needed
- Gesture-to-scroll command mapping
- Simplified state management
- Combined initialization logic
- Settings UI (options page)
- Volume key detection (if implemented)

---

## 7. Performance Considerations

1. **Event Throttling**: Limit touchmove event processing
2. **Scroll Efficiency**: Use requestAnimationFrame for smooth scrolling
3. **Memory**: Clean up intervals and event listeners
4. **Battery**: Stop scrolling when tab is inactive

---

## 8. Testing Strategy

1. **Target Websites**:
   - News sites (long articles)
   - Documentation sites
   - Social media feeds
   - Blog posts

2. **Gesture Testing**:
   - Tap detection accuracy
   - Swipe direction recognition
   - Accidental gesture prevention

3. **Scroll Testing**:
   - Smooth scrolling performance
   - Speed adjustment responsiveness
   - Page bottom handling
   - Memory leaks (long scrolling sessions)

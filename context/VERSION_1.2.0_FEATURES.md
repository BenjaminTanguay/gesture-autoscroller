# Version 1.2.0 - Features & Fixes Documentation

**Status**: Planning Phase  
**Release Date**: TBD  
**Last Updated**: February 21, 2026

---

## Overview

Version 1.2.0 focuses on improving the mobile reading experience by addressing interaction issues and adding more flexible tap zone configuration options. This version includes critical bug fixes for Android text selection conflicts and screen timeout issues, along with enhanced user customization features.

---

## 🐛 Bug Fixes

### FIX-001: Disable Text Selection on Tap/Scroll Interaction

**Priority**: High  
**Affects**: Android tap navigation and tap-to-scroll features

#### Problem Statement
On Android devices, when tap navigation or tap-to-scroll options are activated on whitelisted pages, text selection interferes with screen scrolling:
- When user taps to scroll, text sometimes gets selected by mistake
- The interaction between text selection and programmatic scrolling causes unpredictable scroll distances (not full page length as intended)
- Once text is selected, any subsequent tap triggers a scroll instead of deselecting the text
- This creates an awkward user experience where text selection needs manual cleanup

#### Root Cause
Android's default touch behavior includes text selection on tap/long-press. When combined with tap-to-scroll functionality, both behaviors compete, resulting in:
1. Tap registers as both a scroll command AND a text selection attempt
2. Text selection state interferes with subsequent scroll calculations
3. No clear way to exit text selection mode without navigating away

#### Proposed Solution
**Disable text selection via CSS when extension features are active:**

```css
/* Disable text selection on whitelisted pages when features are active */
body.gesture-autoscroller-active {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none; /* Disable iOS callout */
}
```

**Implementation Details:**
1. Add/remove `gesture-autoscroller-active` class to `<body>` when:
   - Extension activates on whitelisted page
   - Extension deactivates when page removed from whitelist
2. Only apply when tap navigation OR autoscroll features are enabled
3. Allow text selection on interactive elements (input fields, contenteditable):
   ```css
   body.gesture-autoscroller-active input,
   body.gesture-autoscroller-active textarea,
   body.gesture-autoscroller-active [contenteditable] {
     -webkit-user-select: text;
     -moz-user-select: text;
     -ms-user-select: text;
     user-select: text;
   }
   ```

**Edge Cases to Consider:**
- Pages with custom text selection handlers
- Reader mode or reading apps that rely on text selection
- Copy/paste functionality for URLs or code snippets
- User may want to select text even on whitelisted pages

**Alternative Approach (if CSS proves insufficient):**
- Programmatically clear selection on tap events:
  ```javascript
  function clearTextSelection() {
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
  }
  ```
- Call before executing scroll actions

**Configuration:**
- Add checkbox in settings: "Disable text selection on whitelisted pages"
- Default: Enabled
- Allow users to toggle if they prefer text selection over smooth scrolling

**Success Criteria:**
- No accidental text selection when tapping to scroll
- Full page-length scrolls work consistently
- Users can still select text in input fields
- No impact on non-whitelisted pages

---

### FIX-002: Prevent Duplicate Taps During Smooth Scroll

**Priority**: High  
**Affects**: Tap navigation feature

#### Problem Statement
When the user taps to scroll (using tap navigation), they are currently able to tap again before the viewport has finished scrolling from the previous tap:
- If the user double-taps by mistake, the scrolling length becomes unpredictable
- Multiple rapid taps can queue up scroll actions, causing the page to scroll much further than intended
- The smooth scroll animation (typically 300-500ms) doesn't block new tap inputs
- This creates a poor user experience where accidental double-taps cause loss of reading position

#### Root Cause
The `pageUp()` and `pageDown()` functions in content.js (lines 707-722) use `window.scrollBy()` with `behavior: 'smooth'` but don't implement any mechanism to prevent new taps while a scroll is in progress. Each tap immediately triggers a new scroll action regardless of whether the previous scroll has completed.

#### Proposed Solution
**Implement a tap-scroll lock to block taps during active scrolling:**

```javascript
// Add state variable to track scroll in progress
let isTapScrollInProgress = false;

// Page down (scroll down one viewport height)
function pageDown() {
  // Prevent tap if a scroll is already in progress
  if (isTapScrollInProgress) {
    return;
  }
  
  const viewportHeight = window.innerHeight;
  
  // Mark scroll as in progress
  isTapScrollInProgress = true;
  
  window.scrollBy({
    top: viewportHeight,
    behavior: 'smooth'
  });
  
  // Release lock after scroll completes
  // Smooth scroll typically takes 300-500ms, so we wait a bit longer to be safe
  setTimeout(() => {
    isTapScrollInProgress = false;
  }, 600);
}

// Page up (scroll up one viewport height)
function pageUp() {
  // Prevent tap if a scroll is already in progress
  if (isTapScrollInProgress) {
    return;
  }
  
  const viewportHeight = window.innerHeight;
  
  // Mark scroll as in progress
  isTapScrollInProgress = true;
  
  window.scrollBy({
    top: -viewportHeight,
    behavior: 'smooth'
  });
  
  // Release lock after scroll completes
  // Smooth scroll typically takes 300-500ms, so we wait a bit longer to be safe
  setTimeout(() => {
    isTapScrollInProgress = false;
  }, 600);
}
```

**Implementation Details:**
1. Add `isTapScrollInProgress` state variable to track active scrolls
2. Check this flag at the start of `pageUp()` and `pageDown()` functions
3. Set flag to `true` immediately before triggering scroll
4. Use `setTimeout()` to release lock after scroll duration (600ms)
5. Early return if lock is active, silently ignoring the duplicate tap

**Alternative Approaches:**

**Option 1: Listen to scroll end event (more precise)**
```javascript
function pageDown() {
  if (isTapScrollInProgress) return;
  
  isTapScrollInProgress = true;
  
  const scrollHandler = () => {
    // Check if scroll has stopped
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isTapScrollInProgress = false;
      window.removeEventListener('scroll', scrollHandler);
    }, 150);
  };
  
  window.addEventListener('scroll', scrollHandler);
  
  window.scrollBy({
    top: window.innerHeight,
    behavior: 'smooth'
  });
}
```

**Option 2: Use IntersectionObserver (most accurate)**
- Create sentinel elements before/after scroll destination
- Monitor when scroll reaches target
- More complex but handles edge cases better

**Edge Cases to Consider:**
- User manually scrolls during tap-triggered smooth scroll
  - Solution: Reset lock on any manual scroll event
- Very slow devices where smooth scroll takes longer
  - Solution: Increase timeout to 800-1000ms or use scroll event listener
- Rapid legitimate taps (user wants to scroll multiple pages quickly)
  - Solution: Show visual feedback when tap is ignored
  - Optional: Add setting for scroll lock duration
- Page content changes height during scroll
  - Solution: Lock mechanism still works, just blocks inputs

**Configuration (Optional):**
- Add setting: "Tap scroll lock duration" (300-1000ms)
- Default: 600ms
- Power users who want faster scrolling can reduce this

**Visual Feedback (Optional):**
- Show brief toast when tap is ignored: "Scrolling..."
- Add visual indicator (border flash) when scroll lock is active
- This helps users understand why their tap didn't work

**Success Criteria:**
- No duplicate scrolls from accidental double-taps
- Scroll distance is predictable (always one viewport height per tap)
- Lock releases reliably after scroll completes
- No blocking of legitimate single taps
- Works consistently across different devices and scroll speeds

---

### FIX-003: Keep Screen Active During Autoscroll

**Priority**: High  
**Affects**: Autoscroll feature on Android

#### Problem Statement
When autoscroll is active and user is reading without touching the screen:
- Android screen timeout still applies (typically 30 seconds to 2 minutes)
- Screen turns off mid-reading session
- User must unlock device and restart autoscroll
- Breaks the hands-free reading experience that autoscroll provides

#### Root Cause
WebExtension APIs do not provide access to:
- Android WakeLock API (prevents screen from sleeping)
- Power management settings
- System-level screen timeout control

#### Proposed Solution

**Approach 1: Screen Wake Lock API (Preferred)**

Use the experimental Screen Wake Lock API if available:

```javascript
let wakeLock = null;

async function enableWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock acquired');
      
      // Re-acquire lock if visibility changes
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released');
      });
    }
  } catch (err) {
    console.error(`Wake Lock error: ${err.name}, ${err.message}`);
    // Fallback to alternative approach
    enableFallbackWakeMethod();
  }
}

async function disableWakeLock() {
  if (wakeLock !== null) {
    await wakeLock.release();
    wakeLock = null;
  }
}
```

**When to acquire/release:**
- Acquire: When autoscroll enters SCROLLING state
- Maintain: While in SCROLLING state
- Release: When autoscroll enters PAUSED or INACTIVE state
- Release: When user manually scrolls or navigates away

**Approach 2: Fallback - Periodic Invisible Touch Events**

If Wake Lock API is unavailable, simulate user activity:

```javascript
let keepAwakeInterval = null;

function enableFallbackWakeMethod() {
  // Create invisible element at edge of screen
  const wakeElement = document.createElement('div');
  wakeElement.id = 'gesture-autoscroller-wake-element';
  wakeElement.style.cssText = `
    position: fixed;
    top: -10px;
    left: -10px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  `;
  document.body.appendChild(wakeElement);
  
  // Update element position every 10 seconds
  // This may reset screen timeout timer
  keepAwakeInterval = setInterval(() => {
    wakeElement.style.top = wakeElement.style.top === '-10px' ? '-11px' : '-10px';
  }, 10000);
}

function disableFallbackWakeMethod() {
  if (keepAwakeInterval) {
    clearInterval(keepAwakeInterval);
    keepAwakeInterval = null;
  }
  const wakeElement = document.getElementById('gesture-autoscroller-wake-element');
  if (wakeElement) {
    wakeElement.remove();
  }
}
```

**Approach 3: Video Element Hack**

Play silent video to prevent screen sleep:

```javascript
let keepAwakeVideo = null;

function enableVideoWakeMethod() {
  keepAwakeVideo = document.createElement('video');
  keepAwakeVideo.style.cssText = `
    position: fixed;
    top: -100px;
    left: -100px;
    width: 1px;
    height: 1px;
    opacity: 0;
  `;
  
  // Create 1-second silent video blob
  const videoBlob = createSilentVideoBlob();
  keepAwakeVideo.src = URL.createObjectURL(videoBlob);
  keepAwakeVideo.loop = true;
  keepAwakeVideo.muted = true;
  keepAwakeVideo.playsinline = true;
  
  document.body.appendChild(keepAwakeVideo);
  keepAwakeVideo.play();
}

function disableVideoWakeMethod() {
  if (keepAwakeVideo) {
    keepAwakeVideo.pause();
    keepAwakeVideo.remove();
    keepAwakeVideo = null;
  }
}
```

**Implementation Priority:**
1. Try Screen Wake Lock API first (cleanest, most efficient)
2. Fall back to video element hack (proven to work on Android)
3. Last resort: periodic DOM manipulation

**Configuration:**
- Add checkbox: "Keep screen awake during autoscroll"
- Default: Enabled
- Users can disable if they prefer default screen timeout behavior

**Visual Indicator:**
- Show small icon in corner when wake lock is active
- Icon disappears when autoscroll paused or stopped

**Success Criteria:**
- Screen stays on during autoscroll sessions
- Wake mechanism releases when autoscroll stops
- Minimal battery impact
- No interference with normal screen timeout when not autoscrolling

**Browser Compatibility:**
- Screen Wake Lock API: Firefox 126+, Chrome 84+
- Video hack: Works on most mobile browsers
- Test fallback paths thoroughly

---

### FIX-004: Stop Autoscroll at Bottom of Page

**Priority**: Medium  
**Affects**: Autoscroll feature

#### Problem Statement
Currently, autoscroll continues even after reaching the bottom of the page:
- Scrolling attempts continue despite no more content
- No visual feedback that end is reached
- User must manually stop autoscroll
- Wastes battery on pointless scroll calculations

#### Root Cause
AutoScroller class doesn't detect when page bottom is reached before attempting scroll.

#### Proposed Solution

**Detection Logic:**

```javascript
function isAtPageBottom() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const windowHeight = window.innerHeight;
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
  
  // Consider bottom reached if within 10px threshold
  const threshold = 10;
  return (scrollTop + windowHeight) >= (documentHeight - threshold);
}
```

**Integration into AutoScroller:**

Add check in scroll animation loop:

```javascript
class AutoScroller {
  scroll() {
    if (!this.isScrolling) return;
    
    // Check if at bottom before scrolling
    if (isAtPageBottom()) {
      this.stop();
      showToast('Reached end of page');
      return;
    }
    
    // Perform scroll
    window.scrollBy(0, this.speed);
    
    // Check if now at bottom after scroll
    if (isAtPageBottom()) {
      this.stop();
      showToast('Reached end of page');
      return;
    }
    
    // Continue scrolling
    requestAnimationFrame(() => this.scroll());
  }
  
  stop() {
    this.isScrolling = false;
    this.state = 'INACTIVE';
    // Release wake lock (FIX-003)
    disableWakeLock();
    showToast('Autoscroll stopped');
  }
}
```

**Edge Cases:**
- Dynamic content loading (infinite scroll sites)
  - Check for new content appearing
  - Resume if page height increases
- Fixed position footers
  - Adjust threshold based on footer height
- Frames and iframes
  - Detect scroll container correctly

**User Experience Enhancements:**
- Show toast: "Reached end of page"
- Optional: vibration feedback on Android
- Optional: automatically scroll back to top and pause

**Configuration:**
- Add checkbox: "Auto-stop at page bottom"
- Default: Enabled
- Add threshold setting: 10px (default), range 0-100px

**Success Criteria:**
- Autoscroll stops within 10px of page bottom
- Visual feedback confirms page end reached
- No scroll attempts after bottom detected
- Works correctly with dynamic content

---

### FIX-005: Add Text Input for Slider Values

**Priority**: Medium  
**Affects**: Settings/Options page UI

#### Problem Statement
Current settings page only has sliders for numeric values:
- Speed settings range from 1 to 5000 px/sec
- Granularity settings have large ranges
- Very difficult to select precise values with slider alone
- Especially problematic on mobile with touch input
- Users waste time trying to drag slider to exact value

#### Root Cause
UI only provides slider input without numeric text field alternative.

#### Proposed Solution

**Hybrid Slider + Input Field:**

For each slider, add a synchronized text input field:

```html
<div class="setting-group">
  <label for="defaultSpeed">Default scrolling speed</label>
  <div class="slider-input-group">
    <input 
      type="range" 
      id="defaultSpeed" 
      name="defaultSpeed"
      min="1" 
      max="5000" 
      value="20"
      class="slider"
    >
    <div class="input-with-unit">
      <input 
        type="number" 
        id="defaultSpeedValue"
        min="1"
        max="5000"
        value="20"
        class="value-input"
      >
      <span class="unit">px/sec</span>
    </div>
  </div>
</div>
```

**CSS Styling:**

```css
.slider-input-group {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.slider {
  flex: 1;
  min-width: 0;
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f9f9f9;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.value-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  text-align: right;
}

.value-input:focus {
  outline: none;
  border-color: #667eea;
}

.unit {
  color: #666;
  font-size: 13px;
  white-space: nowrap;
}

/* Mobile responsive */
@media (max-width: 600px) {
  .slider-input-group {
    flex-direction: column;
    gap: 12px;
  }
  
  .slider {
    width: 100%;
  }
  
  .input-with-unit {
    justify-content: center;
  }
}
```

**Bidirectional Synchronization:**

```javascript
function setupSliderSync(sliderId, inputId) {
  const slider = document.getElementById(sliderId);
  const input = document.getElementById(inputId);
  
  // Update input when slider changes
  slider.addEventListener('input', () => {
    input.value = slider.value;
  });
  
  // Update slider when input changes
  input.addEventListener('input', () => {
    const value = parseFloat(input.value);
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    
    // Clamp value to valid range
    if (!isNaN(value)) {
      const clampedValue = Math.max(min, Math.min(max, value));
      input.value = clampedValue;
      slider.value = clampedValue;
    }
  });
  
  // Validate on blur
  input.addEventListener('blur', () => {
    const value = parseFloat(input.value);
    if (isNaN(value)) {
      input.value = slider.value;
    }
  });
}

// Initialize all slider-input pairs
setupSliderSync('defaultSpeed', 'defaultSpeedValue');
setupSliderSync('minSpeed', 'minSpeedValue');
setupSliderSync('maxSpeed', 'maxSpeedValue');
setupSliderSync('granularity', 'granularityValue');
setupSliderSync('autoStartDelay', 'autoStartDelayValue');
setupSliderSync('tapScrollPercentage', 'tapScrollPercentageValue'); // NEW feature
```

**Validation:**
- Min/max enforcement on both slider and input
- Invalid input reverts to current slider value
- Real-time feedback for out-of-range values
- Prevent letters and special characters (except decimal point)

**Settings to Update:**
1. Default speed (1-5000 px/sec)
2. Minimum speed (1-5000 px/sec)
3. Maximum speed (1-5000 px/sec)
4. Granularity (1-1000 px/sec)
5. Auto-start delay (1-60 seconds)
6. **NEW**: Tap scroll percentage (10-100%)
7. **NEW**: Tap zone percentage (10-100%)

**Success Criteria:**
- Users can type exact values instead of dragging slider
- Slider and input stay synchronized
- Invalid inputs don't break settings
- Mobile-friendly layout
- Consistent styling across all settings

---

## ✨ New Features

### FEATURE-001: Configurable Tap Scroll Distance

**Priority**: High  
**Affects**: Tap navigation feature

#### Feature Description
Allow users to configure how much the screen scrolls when tapping as a percentage of viewport height, instead of fixed "one page length" behavior.

#### User Story
> "As a reader, I want to configure tap scrolling to move half a screen length (50%) instead of full page, so I can maintain better context of what I just read while progressing through the content."

#### Current Behavior
- Tap right side → Scroll down one full viewport height
- Tap left side → Scroll up one full viewport height
- No customization available

#### Proposed Behavior
**Configurable scroll distance:**
- Range: 10% to 100% of viewport height
- Default: 100% (maintains current behavior)
- Examples:
  - 50% = half screen scroll (maintains reading context)
  - 75% = three-quarter screen scroll
  - 100% = full screen scroll (current behavior)

#### Implementation

**Settings Storage:**

```javascript
const DEFAULT_SETTINGS = {
  // ... existing settings ...
  tapScrollPercentage: 100, // Range: 10-100
};
```

**Options Page UI:**

```html
<div class="setting-group">
  <label for="tapScrollPercentage">
    <span class="label-text">Tap scroll distance</span>
    <span class="label-description">
      Percentage of screen height to scroll on tap (10-100%)
    </span>
  </label>
  <div class="slider-input-group">
    <input 
      type="range" 
      id="tapScrollPercentage" 
      min="10" 
      max="100" 
      step="5"
      value="100"
      class="slider"
    >
    <div class="input-with-unit">
      <input 
        type="number" 
        id="tapScrollPercentageValue"
        min="10"
        max="100"
        step="5"
        value="100"
        class="value-input"
      >
      <span class="unit">%</span>
    </div>
  </div>
  <div class="setting-hint">
    <strong>100%</strong> = full screen (default)<br>
    <strong>50%</strong> = half screen (maintains context)<br>
    <strong>75%</strong> = three-quarters screen
  </div>
</div>
```

**Content Script Logic:**

```javascript
function calculateTapScrollDistance() {
  const viewportHeight = window.innerHeight;
  const percentage = settings.tapScrollPercentage / 100;
  return Math.floor(viewportHeight * percentage);
}

function handleTapNavigation(x, y) {
  if (!settings.tapNavigationEnabled) return;
  if (autoscroller && autoscroller.state !== 'INACTIVE') return;
  
  const screenWidth = window.innerWidth;
  const scrollDistance = calculateTapScrollDistance();
  
  // Determine tap zone (using current 50/50 split)
  if (x < screenWidth / 2) {
    // Left side - scroll up
    window.scrollBy({
      top: -scrollDistance,
      behavior: 'smooth'
    });
    showToast(`↑ Scrolled up ${settings.tapScrollPercentage}%`);
  } else {
    // Right side - scroll down
    window.scrollBy({
      top: scrollDistance,
      behavior: 'smooth'
    });
    showToast(`↓ Scrolled down ${settings.tapScrollPercentage}%`);
  }
}
```

**Visual Feedback:**
- Toast shows percentage scrolled: "↓ 50%" or "↑ 75%"
- Optional: Show scroll distance in pixels in settings preview

**Edge Cases:**
- Very small percentages (10%) on large screens
- Very small viewports (mobile landscape)
- Dynamic viewport height changes (keyboard appearing/disappearing)

**Configuration Validation:**
- Minimum: 10% (prevents too-small scrolls)
- Maximum: 100% (prevents over-scroll)
- Step: 5% increments for slider
- Allow manual entry of any value in range

**Success Criteria:**
- Users can set any percentage from 10-100%
- Scrolling distance matches configured percentage
- Works consistently across different screen sizes
- Visual feedback confirms scroll distance
- Setting persists across sessions

---

### FEATURE-002: Vertical Tap Zones (Alternative to Horizontal)

**Priority**: High  
**Affects**: Tap navigation feature

#### Feature Description
Provide an alternative tap zone layout where vertical zones determine scroll direction, instead of the current horizontal left/right split.

#### User Story
> "As a reader holding my phone in one hand, I want to tap the bottom of the screen to scroll down and tap the top to scroll up, because it's more natural than reaching across to tap left or right sides."

#### Current Behavior
- Screen divided horizontally (left/right)
- Tap left 50% → Scroll up
- Tap right 50% → Scroll down

#### Proposed Behavior
**Two layout options:**

**Option 1: Horizontal Zones (Current)**
```
┌─────────┬─────────┐
│         │         │
│  SCROLL │ SCROLL  │
│   UP    │  DOWN   │
│  (tap   │  (tap   │
│  left)  │  right) │
└─────────┴─────────┘
```

**Option 2: Vertical Zones (NEW)**
```
┌───────────────────┐
│   SCROLL UP       │
│   (tap top)       │
├───────────────────┤
│   SCROLL DOWN     │
│   (tap bottom)    │
└───────────────────┘
```

#### Implementation

**Settings Storage:**

```javascript
const DEFAULT_SETTINGS = {
  // ... existing settings ...
  tapZoneLayout: 'horizontal', // Options: 'horizontal', 'vertical'
};
```

**Options Page UI:**

```html
<div class="setting-group">
  <label>
    <span class="label-text">Tap zone layout</span>
    <span class="label-description">
      Choose how tap zones are divided for scroll up/down
    </span>
  </label>
  
  <div class="radio-group">
    <label class="radio-option">
      <input 
        type="radio" 
        name="tapZoneLayout" 
        value="horizontal"
        checked
      >
      <div class="radio-label">
        <strong>Horizontal Split</strong>
        <span class="description">Tap left = up, tap right = down</span>
      </div>
      <div class="zone-preview horizontal-preview">
        <div class="zone up-zone">UP</div>
        <div class="zone down-zone">DOWN</div>
      </div>
    </label>
    
    <label class="radio-option">
      <input 
        type="radio" 
        name="tapZoneLayout" 
        value="vertical"
      >
      <div class="radio-label">
        <strong>Vertical Split</strong>
        <span class="description">Tap top = up, tap bottom = down</span>
      </div>
      <div class="zone-preview vertical-preview">
        <div class="zone up-zone">UP</div>
        <div class="zone down-zone">DOWN</div>
      </div>
    </label>
  </div>
</div>
```

**CSS for Zone Previews:**

```css
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.radio-option {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-option:hover {
  border-color: #667eea;
  background: #f9f9ff;
}

.radio-option input[type="radio"]:checked ~ * {
  /* Highlight when selected */
}

.zone-preview {
  margin-top: 12px;
  border: 2px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
  height: 150px;
  font-weight: 600;
  font-size: 14px;
}

.horizontal-preview {
  display: flex;
  flex-direction: row;
}

.vertical-preview {
  display: flex;
  flex-direction: column;
}

.zone {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.up-zone {
  background: #ffebee; /* Light red */
  color: #c62828;
}

.down-zone {
  background: #e8f5e9; /* Light green */
  color: #2e7d32;
}
```

**Content Script Logic:**

```javascript
function handleTapNavigation(x, y) {
  if (!settings.tapNavigationEnabled) return;
  if (autoscroller && autoscroller.state !== 'INACTIVE') return;
  
  const scrollDistance = calculateTapScrollDistance();
  let shouldScrollDown = false;
  
  if (settings.tapZoneLayout === 'horizontal') {
    // Current behavior: left/right split
    const screenWidth = window.innerWidth;
    shouldScrollDown = (x >= screenWidth / 2);
  } else {
    // New behavior: top/bottom split
    const screenHeight = window.innerHeight;
    shouldScrollDown = (y >= screenHeight / 2);
  }
  
  if (shouldScrollDown) {
    window.scrollBy({
      top: scrollDistance,
      behavior: 'smooth'
    });
    showToast(`↓ Scrolled down ${settings.tapScrollPercentage}%`);
  } else {
    window.scrollBy({
      top: -scrollDistance,
      behavior: 'smooth'
    });
    showToast(`↑ Scrolled up ${settings.tapScrollPercentage}%`);
  }
}
```

**Edge Cases:**
- Fixed headers/footers (adjust tap zones to account for them)
- Browser chrome/UI (navigation bar on Android)
- Landscape vs portrait orientation
- Different screen aspect ratios

**User Preference:**
- Users can switch between layouts at any time
- Setting applies immediately to all whitelisted pages
- Independent of zone size configuration (FEATURE-003)

**Success Criteria:**
- Both layouts work correctly
- Visual preview clearly shows difference
- Easy to switch between layouts
- Consistent behavior across orientations
- No conflicts with page interactions

---

### FEATURE-003: Configurable Tap Zone Sizes

**Priority**: High  
**Affects**: Tap navigation feature

#### Feature Description
Allow users to configure the relative size of scroll-up vs scroll-down tap zones as a percentage split, rather than fixed 50/50 division.

#### User Story
> "As a reader, I mostly scroll down and rarely need to scroll up. I want the scroll-down zone to take 90% of the screen so I can tap almost anywhere to scroll down, with only a small 10% zone for scrolling up."

#### Current Behavior
- Fixed 50/50 split (left/right or top/bottom)
- Equal size zones for both directions
- No customization

#### Proposed Behavior
**Configurable zone split:**
- Range: 10/90 to 90/10 (scroll-up% / scroll-down%)
- Default: 50/50 (maintains current behavior)
- Examples:
  - 10/90 = tiny scroll-up zone, large scroll-down zone
  - 30/70 = small scroll-up zone, large scroll-down zone
  - 50/50 = equal zones (current behavior)
  - 70/30 = large scroll-up zone, small scroll-down zone

#### Implementation

**Settings Storage:**

```javascript
const DEFAULT_SETTINGS = {
  // ... existing settings ...
  tapZoneUpPercentage: 50, // Range: 10-90 (remaining goes to scroll-down)
};
```

**Options Page UI:**

```html
<div class="setting-group">
  <label for="tapZoneUpPercentage">
    <span class="label-text">Tap zone size</span>
    <span class="label-description">
      Size of scroll-up zone (remaining space is scroll-down zone)
    </span>
  </label>
  <div class="slider-input-group">
    <input 
      type="range" 
      id="tapZoneUpPercentage" 
      min="10" 
      max="90" 
      step="5"
      value="50"
      class="slider"
    >
    <div class="input-with-unit">
      <input 
        type="number" 
        id="tapZoneUpPercentageValue"
        min="10"
        max="90"
        step="5"
        value="50"
        class="value-input"
      >
      <span class="unit">%</span>
    </div>
  </div>
  <div class="zone-split-preview" id="zoneSplitPreview">
    <!-- Dynamic preview updated via JavaScript -->
  </div>
  <div class="setting-hint">
    <span id="zoneSplitDescription">
      Scroll-up: 50%, Scroll-down: 50%
    </span>
  </div>
</div>
```

**Dynamic Zone Preview:**

```javascript
function updateZoneSplitPreview() {
  const upPercentage = parseInt(document.getElementById('tapZoneUpPercentage').value);
  const downPercentage = 100 - upPercentage;
  const layout = settings.tapZoneLayout; // 'horizontal' or 'vertical'
  
  const preview = document.getElementById('zoneSplitPreview');
  const isVertical = layout === 'vertical';
  
  preview.innerHTML = `
    <div class="zone-split-container ${isVertical ? 'vertical' : 'horizontal'}">
      <div class="zone up-zone" style="${isVertical ? 'height' : 'width'}: ${upPercentage}%">
        UP<br>${upPercentage}%
      </div>
      <div class="zone down-zone" style="${isVertical ? 'height' : 'width'}: ${downPercentage}%">
        DOWN<br>${downPercentage}%
      </div>
    </div>
  `;
  
  document.getElementById('zoneSplitDescription').textContent = 
    `Scroll-up: ${upPercentage}%, Scroll-down: ${downPercentage}%`;
}

// Update preview when slider or layout changes
document.getElementById('tapZoneUpPercentage').addEventListener('input', updateZoneSplitPreview);
document.querySelectorAll('input[name="tapZoneLayout"]').forEach(radio => {
  radio.addEventListener('change', updateZoneSplitPreview);
});
```

**CSS for Preview:**

```css
.zone-split-preview {
  margin: 16px 0;
  border: 2px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
  height: 200px;
}

.zone-split-container {
  display: flex;
  height: 100%;
  font-weight: 600;
  font-size: 14px;
  text-align: center;
}

.zone-split-container.horizontal {
  flex-direction: row;
}

.zone-split-container.vertical {
  flex-direction: column;
}

.zone-split-container .zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

/* Color-coded zones */
.up-zone {
  background: linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%);
  color: #c62828;
  border-right: 2px solid #e57373;
}

.down-zone {
  background: linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%);
  color: #2e7d32;
}

.vertical .up-zone {
  border-right: none;
  border-bottom: 2px solid #81c784;
}
```

**Content Script Logic:**

```javascript
function handleTapNavigation(x, y) {
  if (!settings.tapNavigationEnabled) return;
  if (autoscroller && autoscroller.state !== 'INACTIVE') return;
  
  const scrollDistance = calculateTapScrollDistance();
  const upZonePercentage = settings.tapZoneUpPercentage / 100;
  let shouldScrollDown = false;
  
  if (settings.tapZoneLayout === 'horizontal') {
    // Horizontal split: left = up, right = down
    const screenWidth = window.innerWidth;
    const upZoneWidth = screenWidth * upZonePercentage;
    shouldScrollDown = (x >= upZoneWidth);
  } else {
    // Vertical split: top = up, bottom = down
    const screenHeight = window.innerHeight;
    const upZoneHeight = screenHeight * upZonePercentage;
    shouldScrollDown = (y >= upZoneHeight);
  }
  
  if (shouldScrollDown) {
    window.scrollBy({
      top: scrollDistance,
      behavior: 'smooth'
    });
    showToast(`↓ Scrolled down ${settings.tapScrollPercentage}%`);
  } else {
    window.scrollBy({
      top: -scrollDistance,
      behavior: 'smooth'
    });
    showToast(`↑ Scrolled up ${settings.tapScrollPercentage}%`);
  }
}
```

**Common Use Cases:**
1. **90/10 split**: Reader who rarely scrolls up
   - 10% left/top edge for scroll-up
   - 90% rest of screen for scroll-down
2. **70/30 split**: Moderate preference for scrolling down
3. **50/50 split**: Equal preference (default)
4. **30/70 split**: Prefers scrolling up (unusual but supported)

**Edge Cases:**
- Very small zones (10%) must still be usable
- Minimum touch target size (Android: 48dp ≈ 48px)
- Ensure small zones are accessible
- Consider fixed headers/footers

**Success Criteria:**
- Users can configure any split from 10/90 to 90/10
- Visual preview updates in real-time
- Works correctly with both horizontal and vertical layouts
- Small zones remain usable
- Setting persists across sessions

---

### FEATURE-004: Visual Tap Zone Preview in Settings

**Priority**: Medium  
**Affects**: Options/Settings page UI

#### Feature Description
Add a visual representation of the configured tap zones in the settings page, showing users exactly how their screen will be divided for tap navigation.

#### User Story
> "As a user configuring tap zones, I want to see a visual preview of how the zones are laid out and sized, so I can understand exactly where I need to tap without trial and error."

#### Current Behavior
- Settings page shows sliders and radio buttons
- No visual representation of resulting tap zone layout
- Users must save and test to see effect

#### Proposed Behavior
**Interactive visual preview:**
- Rectangle representing phone screen
- Color-coded zones:
  - **Red zone**: Tap to scroll up
  - **Green zone**: Tap to scroll down
- Updates in real-time as settings change
- Responsive to:
  - Layout selection (horizontal/vertical)
  - Zone size configuration (up/down percentage)

#### Implementation

**HTML Structure:**

```html
<div class="section">
  <div class="section-title">Tap Zone Preview</div>
  
  <div class="preview-container">
    <div class="screen-preview" id="screenPreview">
      <!-- Content area (simulates scrollable content) -->
      <div class="preview-content">
        <div class="content-line"></div>
        <div class="content-line"></div>
        <div class="content-line"></div>
        <div class="content-line"></div>
        <div class="content-line"></div>
      </div>
      
      <!-- Tap zones overlay -->
      <div class="tap-zones-overlay" id="tapZonesOverlay">
        <div class="tap-zone up-zone" id="upZone">
          <div class="zone-label">
            <span class="zone-icon">↑</span>
            <span class="zone-text">TAP TO SCROLL UP</span>
            <span class="zone-percentage" id="upZonePercentage">50%</span>
          </div>
        </div>
        <div class="tap-zone down-zone" id="downZone">
          <div class="zone-label">
            <span class="zone-icon">↓</span>
            <span class="zone-text">TAP TO SCROLL DOWN</span>
            <span class="zone-percentage" id="downZonePercentage">50%</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="preview-legend">
      <div class="legend-item">
        <div class="legend-color up-color"></div>
        <span>Scroll Up Zone</span>
      </div>
      <div class="legend-item">
        <div class="legend-color down-color"></div>
        <span>Scroll Down Zone</span>
      </div>
    </div>
  </div>
</div>
```

**CSS Styling:**

```css
.preview-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: #f9f9f9;
  border-radius: 8px;
}

.screen-preview {
  position: relative;
  width: 200px;
  height: 400px;
  background: white;
  border: 3px solid #333;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Simulate phone screen notch */
.screen-preview::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 20px;
  background: #333;
  border-radius: 0 0 10px 10px;
  z-index: 10;
}

.preview-content {
  padding: 30px 16px 16px;
  height: 100%;
  opacity: 0.3;
}

.content-line {
  height: 12px;
  background: #ccc;
  margin-bottom: 8px;
  border-radius: 2px;
}

.tap-zones-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  pointer-events: none;
}

/* Horizontal layout */
.tap-zones-overlay.horizontal {
  flex-direction: row;
}

/* Vertical layout */
.tap-zones-overlay.vertical {
  flex-direction: column;
}

.tap-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.5);
  transition: all 0.3s ease;
}

.up-zone {
  background: rgba(244, 67, 54, 0.3); /* Semi-transparent red */
}

.down-zone {
  background: rgba(76, 175, 80, 0.3); /* Semi-transparent green */
}

.zone-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.zone-icon {
  font-size: 32px;
  margin-bottom: 4px;
}

.zone-text {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.zone-percentage {
  font-size: 16px;
  font-weight: 700;
}

.preview-legend {
  display: flex;
  gap: 24px;
  margin-top: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.legend-color {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid #ccc;
}

.up-color {
  background: rgba(244, 67, 54, 0.5);
}

.down-color {
  background: rgba(76, 175, 80, 0.5);
}

/* Responsive design */
@media (max-width: 600px) {
  .screen-preview {
    width: 160px;
    height: 320px;
  }
  
  .zone-icon {
    font-size: 24px;
  }
  
  .zone-text {
    font-size: 8px;
  }
  
  .zone-percentage {
    font-size: 14px;
  }
}
```

**JavaScript Update Logic:**

```javascript
function updateTapZonePreview() {
  const layout = document.querySelector('input[name="tapZoneLayout"]:checked').value;
  const upPercentage = parseInt(document.getElementById('tapZoneUpPercentage').value);
  const downPercentage = 100 - upPercentage;
  
  const overlay = document.getElementById('tapZonesOverlay');
  const upZone = document.getElementById('upZone');
  const downZone = document.getElementById('downZone');
  
  // Update layout class
  overlay.className = `tap-zones-overlay ${layout}`;
  
  // Update zone sizes
  if (layout === 'horizontal') {
    upZone.style.width = `${upPercentage}%`;
    upZone.style.height = '100%';
    downZone.style.width = `${downPercentage}%`;
    downZone.style.height = '100%';
  } else {
    upZone.style.width = '100%';
    upZone.style.height = `${upPercentage}%`;
    downZone.style.width = '100%';
    downZone.style.height = `${downPercentage}%`;
  }
  
  // Update percentage labels
  document.getElementById('upZonePercentage').textContent = `${upPercentage}%`;
  document.getElementById('downZonePercentage').textContent = `${downPercentage}%`;
  
  // Hide labels if zone too small
  if (upPercentage < 20) {
    upZone.querySelector('.zone-text').style.display = 'none';
  } else {
    upZone.querySelector('.zone-text').style.display = 'block';
  }
  
  if (downPercentage < 20) {
    downZone.querySelector('.zone-text').style.display = 'none';
  } else {
    downZone.querySelector('.zone-text').style.display = 'block';
  }
}

// Attach event listeners
document.querySelectorAll('input[name="tapZoneLayout"]').forEach(radio => {
  radio.addEventListener('change', updateTapZonePreview);
});

document.getElementById('tapZoneUpPercentage').addEventListener('input', updateTapZonePreview);
document.getElementById('tapZoneUpPercentageValue').addEventListener('input', updateTapZonePreview);

// Initialize on page load
document.addEventListener('DOMContentLoaded', updateTapZonePreview);
```

**Interactive Enhancement (Optional):**

Make preview clickable to demonstrate behavior:

```javascript
upZone.addEventListener('click', () => {
  showPreviewFeedback('↑ Would scroll UP');
});

downZone.addEventListener('click', () => {
  showPreviewFeedback('↓ Would scroll DOWN');
});

function showPreviewFeedback(message) {
  const feedback = document.createElement('div');
  feedback.className = 'preview-feedback';
  feedback.textContent = message;
  document.querySelector('.screen-preview').appendChild(feedback);
  
  setTimeout(() => feedback.remove(), 1500);
}
```

**Success Criteria:**
- Preview accurately reflects configured zones
- Updates in real-time as settings change
- Works for both horizontal and vertical layouts
- Works for all zone size configurations
- Visually clear and intuitive
- Responsive on mobile settings page

---

### FEATURE-005: Auto-Navigate to Next Page

**Priority**: High  
**Affects**: Autoscroll feature, whitelisted pages with pagination

#### Feature Description
Automatically detect and click "Next Page" buttons when reaching the bottom of a page during autoscroll, allowing seamless continuous reading across multiple pages without manual interaction.

#### User Story
> "As a reader using autoscroll on sites with pagination (like web novels, article series, or documentation), I want the extension to automatically navigate to the next page when reaching the bottom, so I can enjoy truly hands-free continuous reading without having to manually find and click the 'Next' button."

#### Current Behavior
- Autoscroll stops at page bottom (after FIX-004)
- User must manually find and click "Next" button
- Breaks the hands-free reading experience
- Requires re-enabling autoscroll on new page

#### Proposed Behavior
**Per-site configurable auto-navigation:**
1. When autoscroll reaches page bottom
2. Extension pauses for configurable delay (e.g., 3 seconds)
3. Shows countdown toast: "Next page in 3... 2... 1..."
4. Automatically clicks configured "Next" button
5. Optionally auto-starts scrolling on new page

**User cancellation:**
- Tap anywhere during countdown to cancel
- Side swipe to cancel and stop autoscroll

#### Implementation

**Settings Storage - Per-Site Configuration:**

```javascript
const DEFAULT_SETTINGS = {
  // ... existing settings ...
  autoNavigateEnabled: false,           // Global enable/disable
  autoNavigateDelay: 3,                 // Seconds before clicking next (1-30)
  autoNavigateAutoStart: true,          // Auto-start scroll on new page
  
  // Per-site navigation selectors (hostname -> config)
  navigationSelectors: {
    // Example configurations:
    'example.com': {
      selector: 'a.next-page',           // CSS selector for next button
      enabled: true,
      delay: 3,                           // Site-specific delay override
      autoStart: true,                    // Site-specific auto-start override
      notes: 'Main content pagination'    // User notes
    },
    'webnovel.com': {
      selector: '#next_chap',
      enabled: true,
      delay: 2,
      autoStart: true,
      notes: 'Chapter navigation'
    },
    'docs.example.org': {
      selector: 'a[rel="next"]',
      enabled: true,
      delay: 5,
      autoStart: false,
      notes: 'Documentation pages'
    }
  }
};
```

**Options Page UI - Per-Site Navigation Configuration:**

```html
<div class="section">
  <div class="section-title">Auto-Navigate to Next Page</div>
  
  <!-- Global toggle -->
  <div class="setting-group">
    <div class="checkbox-group">
      <input type="checkbox" id="autoNavigateEnabled" name="autoNavigateEnabled">
      <label for="autoNavigateEnabled">
        <span class="label-text">Enable auto-navigation at page bottom</span>
        <span class="label-description">
          Automatically click "Next" button when autoscroll reaches bottom
        </span>
      </label>
    </div>
  </div>
  
  <!-- Global defaults -->
  <div class="setting-group">
    <label for="autoNavigateDelay">
      <span class="label-text">Default countdown delay</span>
      <span class="label-description">
        Seconds to wait before navigating (allows cancellation)
      </span>
    </label>
    <div class="slider-input-group">
      <input type="range" id="autoNavigateDelay" min="1" max="30" value="3" class="slider">
      <div class="input-with-unit">
        <input type="number" id="autoNavigateDelayValue" min="1" max="30" value="3" class="value-input">
        <span class="unit">sec</span>
      </div>
    </div>
  </div>
  
  <div class="setting-group">
    <div class="checkbox-group">
      <input type="checkbox" id="autoNavigateAutoStart" name="autoNavigateAutoStart" checked>
      <label for="autoNavigateAutoStart">
        <span class="label-text">Auto-start scrolling on new page</span>
        <span class="label-description">
          Automatically resume autoscroll after navigating
        </span>
      </label>
    </div>
  </div>
  
  <!-- Per-site selector configuration -->
  <div class="subsection">
    <div class="subsection-title">Per-Site Configuration</div>
    
    <!-- Add new site configuration -->
    <div class="add-nav-config">
      <h4>Add Site</h4>
      <div class="form-row">
        <input type="text" id="navSiteHost" placeholder="example.com" class="form-input">
        <input type="text" id="navSiteSelector" placeholder="a.next-page" class="form-input">
        <button id="addNavConfig" class="btn-secondary">Add</button>
      </div>
      <div class="form-hint">
        Enter site hostname and CSS selector for the "Next" button
      </div>
      
      <!-- Selector tester -->
      <div class="selector-tester">
        <button id="testSelector" class="btn-secondary">Test Selector on Current Page</button>
        <div id="testResult" class="test-result"></div>
      </div>
    </div>
    
    <!-- List of configured sites -->
    <div class="nav-configs-list" id="navConfigsList">
      <!-- Populated dynamically with existing configurations -->
    </div>
  </div>
  
  <!-- Help and examples -->
  <div class="setting-hint">
    <strong>Common CSS Selectors:</strong><br>
    <code>a.next</code> - Link with class "next"<br>
    <code>#next-button</code> - Element with ID "next-button"<br>
    <code>a[rel="next"]</code> - Link with rel="next" attribute<br>
    <code>button:contains("Next")</code> - Button containing text "Next"<br>
    <code>.pagination > a:last-child</code> - Last link in pagination
  </div>
</div>
```

**Site Configuration Item Template:**

```html
<div class="nav-config-item" data-hostname="example.com">
  <div class="config-header">
    <div class="config-hostname">
      <strong>example.com</strong>
      <span class="config-status enabled">Enabled</span>
    </div>
    <div class="config-actions">
      <button class="btn-icon edit-config" title="Edit">✏️</button>
      <button class="btn-icon delete-config" title="Delete">🗑️</button>
    </div>
  </div>
  
  <div class="config-details">
    <div class="config-row">
      <span class="config-label">Selector:</span>
      <code class="config-value">a.next-page</code>
    </div>
    <div class="config-row">
      <span class="config-label">Delay:</span>
      <span class="config-value">3 seconds</span>
    </div>
    <div class="config-row">
      <span class="config-label">Auto-start:</span>
      <span class="config-value">Yes</span>
    </div>
    <div class="config-row" *ngIf="notes">
      <span class="config-label">Notes:</span>
      <span class="config-value">Main content pagination</span>
    </div>
  </div>
  
  <!-- Edit form (hidden by default) -->
  <div class="config-edit-form" style="display: none;">
    <div class="form-group">
      <label>CSS Selector</label>
      <input type="text" class="edit-selector" value="a.next-page">
    </div>
    <div class="form-group">
      <label>Countdown Delay (seconds)</label>
      <input type="number" class="edit-delay" value="3" min="1" max="30">
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" class="edit-autostart" checked>
        Auto-start scrolling on new page
      </label>
    </div>
    <div class="form-group">
      <label>Notes (optional)</label>
      <input type="text" class="edit-notes" value="Main content pagination">
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" class="edit-enabled" checked>
        Enable for this site
      </label>
    </div>
    <div class="form-actions">
      <button class="btn-primary save-config">Save</button>
      <button class="btn-secondary cancel-edit">Cancel</button>
    </div>
  </div>
</div>
```

**CSS Styling:**

```css
.subsection {
  margin-top: 24px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 6px;
}

.subsection-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #555;
}

.add-nav-config {
  padding: 16px;
  background: white;
  border-radius: 6px;
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: monospace;
}

.form-hint {
  font-size: 13px;
  color: #666;
  margin-top: 8px;
}

.selector-tester {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.test-result {
  margin-top: 8px;
  padding: 8px;
  border-radius: 4px;
  font-size: 13px;
}

.test-result.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.test-result.error {
  background: #ffebee;
  color: #c62828;
}

.nav-configs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nav-config-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 16px;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-hostname {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.config-status.enabled {
  background: #e8f5e9;
  color: #2e7d32;
}

.config-status.disabled {
  background: #f5f5f5;
  color: #999;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  padding: 4px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  transition: transform 0.2s;
}

.btn-icon:hover {
  transform: scale(1.2);
}

.config-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-row {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.config-label {
  font-weight: 600;
  color: #666;
  min-width: 100px;
}

.config-value {
  color: #333;
}

code.config-value {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 13px;
}
```

**Content Script - Auto-Navigation Logic:**

```javascript
// Auto-navigation state
let autoNavigateCountdown = null;
let autoNavigateCountdownValue = 0;
let autoNavigateCancelled = false;

// Modified AutoScroller stop logic (from FIX-004)
class AutoScroller {
  stop() {
    this.isScrolling = false;
    this.state = 'INACTIVE';
    
    // Release wake lock (FIX-003)
    disableWakeLock();
    
    // Check if auto-navigation is enabled for this site
    if (shouldAutoNavigate()) {
      startAutoNavigationCountdown();
    } else {
      showToast('Autoscroll stopped - End of page');
    }
  }
}

function shouldAutoNavigate() {
  if (!settings.autoNavigateEnabled) return false;
  
  const hostname = window.location.hostname;
  const siteConfig = settings.navigationSelectors[hostname];
  
  return siteConfig && siteConfig.enabled;
}

function getNavigationConfig() {
  const hostname = window.location.hostname;
  const siteConfig = settings.navigationSelectors[hostname];
  
  return {
    selector: siteConfig.selector,
    delay: siteConfig.delay || settings.autoNavigateDelay,
    autoStart: siteConfig.autoStart !== undefined ? siteConfig.autoStart : settings.autoNavigateAutoStart
  };
}

function startAutoNavigationCountdown() {
  const config = getNavigationConfig();
  autoNavigateCountdownValue = config.delay;
  autoNavigateCancelled = false;
  
  // Show initial countdown toast
  showCountdownToast(autoNavigateCountdownValue);
  
  // Start countdown
  autoNavigateCountdown = setInterval(() => {
    autoNavigateCountdownValue--;
    
    if (autoNavigateCancelled) {
      clearAutoNavigationCountdown();
      showToast('Auto-navigation cancelled');
      return;
    }
    
    if (autoNavigateCountdownValue <= 0) {
      clearAutoNavigationCountdown();
      navigateToNextPage();
    } else {
      showCountdownToast(autoNavigateCountdownValue);
    }
  }, 1000);
}

function clearAutoNavigationCountdown() {
  if (autoNavigateCountdown) {
    clearInterval(autoNavigateCountdown);
    autoNavigateCountdown = null;
  }
  hideCountdownToast();
}

function showCountdownToast(seconds) {
  const message = `Next page in ${seconds}s... (tap to cancel)`;
  showToast(message, { duration: 1100, type: 'countdown' });
}

function hideCountdownToast() {
  // Remove countdown toast
  const countdownToast = document.querySelector('.toast.countdown');
  if (countdownToast) {
    countdownToast.remove();
  }
}

function cancelAutoNavigation() {
  autoNavigateCancelled = true;
  clearAutoNavigationCountdown();
}

function navigateToNextPage() {
  const config = getNavigationConfig();
  const nextButton = document.querySelector(config.selector);
  
  if (!nextButton) {
    showToast('⚠️ Next button not found', { duration: 3000 });
    console.warn(`Auto-navigate: selector "${config.selector}" not found`);
    return;
  }
  
  // Verify element is clickable
  if (!isElementClickable(nextButton)) {
    showToast('⚠️ Next button not clickable', { duration: 3000 });
    console.warn('Auto-navigate: next button not clickable', nextButton);
    return;
  }
  
  showToast('→ Navigating to next page...', { duration: 2000 });
  
  // Store auto-start preference for next page
  if (config.autoStart) {
    sessionStorage.setItem('gesture-autoscroller-auto-start', 'true');
  }
  
  // Click the next button
  try {
    nextButton.click();
  } catch (error) {
    console.error('Auto-navigate: click failed', error);
    showToast('⚠️ Navigation failed', { duration: 3000 });
  }
}

function isElementClickable(element) {
  // Check if element is visible and enabled
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0 &&
    !element.hasAttribute('disabled')
  );
}

// Handle auto-start on new page
function checkAutoStartFromNavigation() {
  const shouldAutoStart = sessionStorage.getItem('gesture-autoscroller-auto-start');
  
  if (shouldAutoStart === 'true') {
    sessionStorage.removeItem('gesture-autoscroller-auto-start');
    
    // Wait for page to be ready
    if (document.readyState === 'complete') {
      startAutoScrollAfterDelay();
    } else {
      window.addEventListener('load', startAutoScrollAfterDelay);
    }
  }
}

function startAutoScrollAfterDelay() {
  // Give page 1 second to settle
  setTimeout(() => {
    if (autoscroller) {
      autoscroller.start();
      showToast('Autoscroll resumed', { duration: 2000 });
    }
  }, 1000);
}

// Listen for taps during countdown to cancel
function handleTouchForAutoNavigate(event) {
  if (autoNavigateCountdown && !autoNavigateCancelled) {
    // Any tap cancels auto-navigation
    cancelAutoNavigation();
  }
}

// Initialize on page load
async function init() {
  // ... existing init code ...
  
  // Check if we should auto-start from navigation
  checkAutoStartFromNavigation();
}
```

**Options Page - Selector Testing:**

```javascript
// Test CSS selector on current page
async function testSelectorOnCurrentPage() {
  const selector = document.getElementById('navSiteSelector').value;
  const resultDiv = document.getElementById('testResult');
  
  if (!selector) {
    resultDiv.className = 'test-result error';
    resultDiv.textContent = 'Please enter a CSS selector';
    return;
  }
  
  try {
    // Get current active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    // Execute test in content script
    const results = await browser.tabs.executeScript(currentTab.id, {
      code: `
        (function() {
          const selector = "${selector.replace(/"/g, '\\"')}";
          const element = document.querySelector(selector);
          
          if (!element) {
            return { found: false };
          }
          
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          
          return {
            found: true,
            tag: element.tagName.toLowerCase(),
            text: element.textContent.trim().substring(0, 50),
            href: element.href || null,
            visible: style.display !== 'none' && style.visibility !== 'hidden',
            position: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            }
          };
        })();
      `
    });
    
    const result = results[0];
    
    if (result.found) {
      resultDiv.className = 'test-result success';
      resultDiv.innerHTML = `
        ✅ <strong>Element found!</strong><br>
        Tag: &lt;${result.tag}&gt;<br>
        Text: "${result.text}"<br>
        ${result.href ? `Link: ${result.href}<br>` : ''}
        Visible: ${result.visible ? 'Yes' : 'No'}<br>
        Position: (${Math.round(result.position.top)}, ${Math.round(result.position.left)})
      `;
    } else {
      resultDiv.className = 'test-result error';
      resultDiv.textContent = '❌ No element found matching this selector';
    }
  } catch (error) {
    resultDiv.className = 'test-result error';
    resultDiv.textContent = `❌ Error: ${error.message}`;
  }
}

document.getElementById('testSelector').addEventListener('click', testSelectorOnCurrentPage);
```

**Edge Cases:**

1. **Selector not found:**
   - Show warning toast
   - Log to console for debugging
   - Don't navigate

2. **Multiple elements match:**
   - Use first match (querySelector behavior)
   - Document this in help text

3. **Element not clickable:**
   - Check visibility and enabled state
   - Show warning if not clickable

4. **Page takes time to load:**
   - Wait for page load before auto-starting
   - Configurable delay before starting

5. **Single-page applications (SPAs):**
   - May need to detect URL change instead of page load
   - Session storage survives in-page navigation

6. **Infinite loops:**
   - User can always cancel with tap/swipe
   - Consider max pages limit (optional feature)

7. **Wrong selector configured:**
   - User can test selector before saving
   - Easy to edit/fix configuration

**Configuration Workflow:**

1. User navigates to reading site
2. Opens extension settings
3. Adds site hostname
4. Inspects page to find "Next" button selector
5. Tests selector using built-in tester
6. Saves configuration
7. Returns to page and starts autoscroll
8. Extension automatically navigates when reaching bottom

**Common Selector Patterns:**

```javascript
// Provide quick-add buttons for common patterns
const COMMON_SELECTORS = [
  { label: 'a.next', description: 'Link with class "next"' },
  { label: 'a[rel="next"]', description: 'Link with rel="next"' },
  { label: '.next-page', description: 'Element with class "next-page"' },
  { label: '#next', description: 'Element with ID "next"' },
  { label: 'button:contains("Next")', description: 'Button with text "Next"' },
  { label: '.pagination > a:last-child', description: 'Last pagination link' },
];
```

**Visual Feedback:**

During countdown:
- Large countdown toast with cancel hint
- Optional: Countdown circle animation
- Optional: Visual highlight on next button

After navigation:
- Toast: "Navigating to next page..."
- Toast on new page: "Autoscroll resumed" (if auto-start enabled)

**Success Criteria:**
- Users can configure selectors per site
- Countdown gives time to cancel
- Tap/swipe cancels navigation
- Successfully clicks next button
- Auto-start works on new page
- Works with various selector types
- Clear error messages when selector fails
- Easy to test and debug selectors

---

## 📊 Summary

### Version 1.2.0 Deliverables

**Bug Fixes: 4**
1. ✅ Disable text selection on whitelisted pages (FIX-001)
2. ✅ Prevent duplicate taps during smooth scroll (FIX-002)
3. ✅ Keep screen active during autoscroll (FIX-003)
4. ✅ Stop autoscroll at page bottom (FIX-004)
5. ✅ Add text input for slider values (FIX-005)

**New Features: 5**
1. ✅ Configurable tap scroll distance percentage (FEATURE-001)
2. ✅ Vertical tap zone layout option (FEATURE-002)
3. ✅ Configurable tap zone sizes (FEATURE-003)
4. ✅ Visual tap zone preview in settings (FEATURE-004)
5. ✅ Auto-navigate to next page (FEATURE-005)

---

## 🔄 Migration Notes

### Settings Schema Changes

**New Settings Added:**
```javascript
{
  tapScrollPercentage: 100,     // Range: 10-100 (% of viewport height)
  tapZoneLayout: 'horizontal',  // Options: 'horizontal', 'vertical'
  tapZoneUpPercentage: 50,      // Range: 10-90 (% for scroll-up zone)
  keepScreenAwake: true,         // Enable wake lock during autoscroll
  autoStopAtBottom: true,        // Stop autoscroll when reaching page end
  disableTextSelection: true,    // Disable text selection on whitelisted pages
  autoNavigateEnabled: false,    // Enable auto-navigation to next page
  autoNavigateDelay: 3,          // Countdown delay before navigation (seconds)
  autoNavigateAutoStart: true,   // Auto-start scroll on new page after navigation
  navigationSelectors: {}        // Per-site CSS selector configurations
}
```

**Default Values:**
- Maintain backward compatibility with v1.x
- All new settings have sensible defaults
- Existing users: settings auto-migrate with defaults
- No manual intervention required

### Upgrade Path

**From v1.1.0 to v1.2.0:**
1. Existing settings preserved
2. New settings initialized with defaults
3. UI shows all new options automatically
4. Users can customize at their leisure

**No Breaking Changes:**
- All existing features continue to work
- Default behavior matches v1.x behavior
- New features are opt-in enhancements

---

## 🧪 Testing Checklist

### Bug Fixes Testing

**FIX-001: Text Selection**
- [ ] Text selection disabled on whitelisted pages
- [ ] Text selection works in input fields
- [ ] Text selection works in contenteditable elements
- [ ] No interference with copy/paste
- [ ] Works across different page layouts

**FIX-002: Tap Scroll Lock**
- [ ] Duplicate taps are ignored during smooth scroll
- [ ] Scroll lock releases after scroll completes
- [ ] Works consistently across devices
- [ ] No blocking of legitimate single taps
- [ ] Predictable scroll distance (one viewport per tap)

**FIX-003: Screen Wake**
- [ ] Screen stays awake during autoscroll
- [ ] Screen wake releases when autoscroll stops
- [ ] Screen wake releases when autoscroll paused
- [ ] Works on different Android versions
- [ ] Fallback method works if Wake Lock API unavailable

**FIX-004: Auto-stop**
- [ ] Autoscroll stops at page bottom
- [ ] Toast notification confirms stop
- [ ] Works with dynamic content loading
- [ ] Works with fixed footers
- [ ] Threshold configurable

**FIX-005: Input Fields**
- [ ] All sliders have corresponding input fields
- [ ] Slider and input stay synchronized
- [ ] Invalid input handled gracefully
- [ ] Min/max validation works
- [ ] Mobile-friendly layout

### New Features Testing

**FEATURE-001: Scroll Distance**
- [ ] All percentages (10-100%) work correctly
- [ ] Visual feedback shows percentage
- [ ] Works on different screen sizes
- [ ] Setting persists
- [ ] Smooth scroll animation

**FEATURE-002: Vertical Zones**
- [ ] Horizontal layout works (left/right)
- [ ] Vertical layout works (top/bottom)
- [ ] Easy to switch between layouts
- [ ] Preview shows layout correctly
- [ ] Works in portrait and landscape

**FEATURE-003: Zone Sizes**
- [ ] All splits (10/90 to 90/10) work
- [ ] Small zones remain usable
- [ ] Works with both layouts
- [ ] Preview updates correctly
- [ ] Percentage labels accurate

**FEATURE-004: Visual Preview**
- [ ] Preview displays correctly
- [ ] Updates in real-time
- [ ] Color coding clear
- [ ] Works on mobile settings page
- [ ] Responsive design

**FEATURE-005: Auto-Navigate**
- [ ] Global enable/disable works
- [ ] Per-site configuration saves correctly
- [ ] Countdown displays with correct timing
- [ ] Tap during countdown cancels navigation
- [ ] Side swipe during countdown cancels navigation
- [ ] Selector tester identifies elements correctly
- [ ] Next button clicks successfully
- [ ] Auto-start on new page works
- [ ] Session storage persists across navigation
- [ ] Error handling for missing selectors
- [ ] Multiple selector formats work (class, id, attribute, etc.)
- [ ] Works with common pagination patterns

### Cross-Platform Testing

**Desktop:**
- [ ] Firefox Desktop 142+
- [ ] All features work (where applicable)
- [ ] Settings UI responsive

**Mobile:**
- [ ] Firefox Android 142+
- [ ] Touch interactions smooth
- [ ] Text selection disabled properly
- [ ] Screen wake lock works
- [ ] Zone configurations accurate

**Edge Cases:**
- [ ] Very small screens
- [ ] Very large screens
- [ ] Landscape orientation
- [ ] Portrait orientation
- [ ] Dynamic content pages
- [ ] Fixed position elements

---

## 📝 Documentation Updates Required

### User-Facing Documentation

**README.md:**
- [ ] Add v2.0.0 changelog
- [ ] Document new features
- [ ] Update screenshots (if any)
- [ ] Update feature list

**Options Page Instructions Tab:**
- [ ] Add section on tap zone configuration
- [ ] Add section on scroll distance customization
- [ ] Add troubleshooting for text selection
- [ ] Add troubleshooting for screen wake

### Developer Documentation

**FEATURES.md:**
- [ ] Document new features (this file!)
- [ ] Update tap navigation specification
- [ ] Add visual preview specification

**context/README.md:**
- [ ] Update project status
- [ ] Link to v2.0.0 features document

---

## 🚀 Implementation Priority

### Phase 1: Critical Fixes (High Priority)
1. FIX-001: Text selection disable
2. FIX-002: Tap scroll lock
3. FIX-003: Screen wake lock
4. FIX-004: Auto-stop at bottom

**Estimated Time:** 1-2 weeks

### Phase 2: UI Improvements (Medium Priority)
5. FIX-005: Input fields for sliders
6. FEATURE-004: Visual preview

**Estimated Time:** 1 week

### Phase 3: Feature Enhancements (Medium Priority)
6. FEATURE-001: Configurable scroll distance
7. FEATURE-002: Vertical zones
8. FEATURE-003: Configurable zone sizes

**Estimated Time:** 1-2 weeks

### Phase 4: Advanced Features (Medium Priority)
9. FEATURE-005: Auto-navigate to next page
   - Per-site selector configuration UI
   - Countdown and cancellation logic
   - Selector testing tool
   - Auto-start on new page

**Estimated Time:** 1-2 weeks

### Total Estimated Time: 4-7 weeks

---

## ✅ Definition of Done

A feature/fix is complete when:
- [ ] Code implemented and tested
- [ ] UI updated (if applicable)
- [ ] Settings storage updated (if applicable)
- [ ] Documentation updated
- [ ] Manual testing passed
- [ ] Works on Firefox Desktop
- [ ] Works on Firefox Android
- [ ] No regressions in existing features
- [ ] Committed to version control

---

## 📌 Notes

- All features maintain backward compatibility
- No breaking changes to existing functionality
- Settings auto-migrate from v1.x
- Focus on mobile user experience
- Keep extension lightweight and performant

---

**Document Version:** 1.0  
**Author:** OpenCode AI Assistant  
**Date:** February 21, 2026

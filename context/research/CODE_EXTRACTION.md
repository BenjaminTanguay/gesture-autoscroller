# Code Extraction from Reference Projects

## 1. Gesture Detection (from firefox-simple_gesture)

### Touch Event Handling

```javascript
// File: content.js
// Simplified version for our needs

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let touchStartTime = 0;
let touchEndTime = 0;

const SWIPE_THRESHOLD = 50; // pixels
const TAP_MAX_DURATION = 300; // milliseconds
const TAP_MAX_MOVEMENT = 10; // pixels

// Get touch coordinates (handles both touch and mouse events)
function getXY(event) {
  const touch = event.touches ? event.touches[0] : event;
  return [touch.clientX, touch.clientY];
}

// Touch start handler
function onTouchStart(event) {
  touchStartTime = Date.now();
  [touchStartX, touchStartY] = getXY(event);
  touchEndX = touchStartX;
  touchEndY = touchStartY;
}

// Touch move handler
function onTouchMove(event) {
  [touchEndX, touchEndY] = getXY(event);
}

// Touch end handler
function onTouchEnd(event) {
  touchEndTime = Date.now();
  
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const duration = touchEndTime - touchStartTime;
  
  // Detect tap
  if (duration < TAP_MAX_DURATION && absX < TAP_MAX_MOVEMENT && absY < TAP_MAX_MOVEMENT) {
    handleTap(event);
    return;
  }
  
  // Detect swipe
  if (absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) {
    if (absY > absX) {
      // Vertical swipe
      if (deltaY < 0) {
        handleSwipeUp();
      } else {
        handleSwipeDown();
      }
    } else {
      // Horizontal swipe (optional, we might not use these)
      if (deltaX < 0) {
        handleSwipeLeft();
      } else {
        handleSwipeRight();
      }
    }
  }
}

// Touch cancel handler
function onTouchCancel(event) {
  // Reset state
  touchStartX = 0;
  touchStartY = 0;
  touchEndX = 0;
  touchEndY = 0;
}

// Setup touch event listeners
function setupTouchListeners() {
  if ('ontouchstart' in window) {
    // Mobile touch events
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
  } else {
    // Fallback for testing on desktop
    window.addEventListener('mousedown', onTouchStart, { passive: true });
    window.addEventListener('mousemove', onTouchMove, { passive: true });
    window.addEventListener('mouseup', onTouchEnd, { passive: false });
  }
}

// Cleanup function
function removeTouchListeners() {
  if ('ontouchstart' in window) {
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchCancel);
  } else {
    window.removeEventListener('mousedown', onTouchStart);
    window.removeEventListener('mousemove', onTouchMove);
    window.removeEventListener('mouseup', onTouchEnd);
  }
}
```

### Toast Notifications

```javascript
// File: content.js
// Toast notification for user feedback

let toastElement = null;
let toastTimeout = null;

function showToast(message, duration = 2000) {
  // Remove existing toast
  hideToast();
  
  // Create toast element
  toastElement = document.createElement('div');
  toastElement.id = 'gesture-autoscroll-toast';
  toastElement.textContent = message;
  toastElement.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 2147483647;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  document.body.appendChild(toastElement);
  
  // Fade in
  requestAnimationFrame(() => {
    toastElement.style.opacity = '1';
  });
  
  // Auto-hide after duration
  toastTimeout = setTimeout(() => {
    hideToast();
  }, duration);
}

function hideToast() {
  if (toastElement) {
    toastElement.style.opacity = '0';
    setTimeout(() => {
      if (toastElement && toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement);
      }
      toastElement = null;
    }, 300);
  }
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
}
```

---

## 2. AutoScroller (from AutoScrolling)

### Core Scrolling Engine

```javascript
// File: content.js
// Simplified AutoScroller class

class AutoScroller {
  constructor() {
    this.intervalId = null;
    this.scrollingElement = null;
    this.scrollingStep = 2; // pixels per iteration
    this.scrollingInterval = 50; // milliseconds between iterations
    this.isScrolling = false;
    this.currentSpeed = 'medium';
  }
  
  // Get the scrollable element
  getScrollingElement() {
    return document.scrollingElement || document.documentElement;
  }
  
  // Check if at bottom of page
  isBottomOfPage() {
    const element = this.scrollingElement;
    if (!element) return false;
    
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    
    return scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
  }
  
  // Parse speed setting into step/interval
  parseSpeed(speed) {
    const speeds = {
      'slow': { step: 1, interval: 50 },
      'medium': { step: 2, interval: 50 },
      'fast': { step: 4, interval: 50 },
      'veryfast': { step: 8, interval: 50 }
    };
    
    return speeds[speed] || speeds['medium'];
  }
  
  // Set scrolling speed
  setSpeed(speed) {
    const config = this.parseSpeed(speed);
    this.scrollingStep = config.step;
    this.scrollingInterval = config.interval;
    this.currentSpeed = speed;
    
    // If already scrolling, restart with new speed
    if (this.isScrolling) {
      this.stop();
      this.start();
    }
  }
  
  // Increase speed (cycle through speeds)
  increaseSpeed() {
    const speeds = ['slow', 'medium', 'fast', 'veryfast'];
    const currentIndex = speeds.indexOf(this.currentSpeed);
    const nextIndex = Math.min(currentIndex + 1, speeds.length - 1);
    this.setSpeed(speeds[nextIndex]);
    showToast(`Speed: ${speeds[nextIndex]}`);
  }
  
  // Decrease speed
  decreaseSpeed() {
    const speeds = ['slow', 'medium', 'fast', 'veryfast'];
    const currentIndex = speeds.indexOf(this.currentSpeed);
    const nextIndex = Math.max(currentIndex - 1, 0);
    this.setSpeed(speeds[nextIndex]);
    showToast(`Speed: ${speeds[nextIndex]}`);
  }
  
  // Start scrolling
  start(speed = null) {
    if (this.isScrolling) {
      return;
    }
    
    if (speed) {
      this.setSpeed(speed);
    }
    
    this.scrollingElement = this.getScrollingElement();
    if (!this.scrollingElement) {
      console.warn('No scrolling element found');
      return;
    }
    
    this.isScrolling = true;
    this.intervalId = setInterval(() => this.scroll(), this.scrollingInterval);
    
    showToast(`Scrolling started (${this.currentSpeed})`);
  }
  
  // Perform one scroll iteration
  scroll() {
    if (this.isBottomOfPage()) {
      this.stop();
      showToast('Reached bottom of page');
      return;
    }
    
    if (this.scrollingElement) {
      this.scrollingElement.scrollBy(0, this.scrollingStep);
    }
  }
  
  // Stop scrolling
  stop() {
    if (!this.isScrolling) {
      return;
    }
    
    this.isScrolling = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    showToast('Scrolling stopped');
  }
  
  // Toggle scrolling on/off
  toggle() {
    if (this.isScrolling) {
      this.stop();
    } else {
      this.start();
    }
  }
  
  // Cleanup
  destroy() {
    this.stop();
    this.scrollingElement = null;
  }
}
```

---

## 3. Integration - Complete Content Script

```javascript
// File: content.js
// Complete implementation combining gesture detection and autoscrolling

// Check if extension is enabled for this site
let isEnabled = true;

// Initialize autoscroller
const scroller = new AutoScroller();

// Gesture handlers
function handleTap(event) {
  if (!isEnabled) return;
  
  // Toggle scrolling
  scroller.toggle();
}

function handleSwipeUp() {
  if (!isEnabled) return;
  
  // Increase speed (only if scrolling)
  if (scroller.isScrolling) {
    scroller.increaseSpeed();
  } else {
    // Or start scrolling at faster speed
    scroller.start('fast');
  }
}

function handleSwipeDown() {
  if (!isEnabled) return;
  
  // Decrease speed (only if scrolling)
  if (scroller.isScrolling) {
    scroller.decreaseSpeed();
  } else {
    // Or start scrolling at slower speed
    scroller.start('slow');
  }
}

function handleSwipeLeft() {
  // Optional: could be used for other features
}

function handleSwipeRight() {
  // Optional: could be used for other features
}

// Load settings and initialize
async function init() {
  try {
    // Load settings from storage
    const settings = await browser.storage.local.get('gesture_autoscroll_settings');
    
    if (settings.gesture_autoscroll_settings) {
      const config = settings.gesture_autoscroll_settings;
      
      // Check if enabled globally
      isEnabled = config.enabled !== false;
      
      // Check per-site settings
      const hostname = window.location.hostname;
      if (config.perSiteSettings && config.perSiteSettings[hostname]) {
        isEnabled = config.perSiteSettings[hostname].enabled !== false;
        
        // Load preferred speed for this site
        if (config.perSiteSettings[hostname].speed) {
          scroller.currentSpeed = config.perSiteSettings[hostname].speed;
        }
      }
    }
    
    // Setup touch listeners
    setupTouchListeners();
    
    console.log('Gesture AutoScroller initialized');
    
  } catch (error) {
    console.error('Failed to initialize Gesture AutoScroller:', error);
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  scroller.destroy();
  removeTouchListeners();
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message) => {
  switch (message.action) {
    case 'toggleEnabled':
      isEnabled = !isEnabled;
      if (!isEnabled && scroller.isScrolling) {
        scroller.stop();
      }
      showToast(isEnabled ? 'Enabled' : 'Disabled');
      break;
      
    case 'setSpeed':
      scroller.setSpeed(message.speed);
      break;
      
    case 'stop':
      scroller.stop();
      break;
      
    default:
      console.warn('Unknown message action:', message.action);
  }
});
```

---

## 4. Background Script (Settings Management)

```javascript
// File: background.js
// Minimal background script for settings management

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  defaultSpeed: 'medium',
  perSiteSettings: {}
};

// Initialize settings on install
browser.runtime.onInstalled.addListener(async () => {
  const existing = await browser.storage.local.get('gesture_autoscroll_settings');
  
  if (!existing.gesture_autoscroll_settings) {
    await browser.storage.local.set({
      gesture_autoscroll_settings: DEFAULT_SETTINGS
    });
  }
});

// Listen for messages from content script
browser.runtime.onMessage.addListener(async (message, sender) => {
  switch (message.action) {
    case 'saveSettings':
      await browser.storage.local.set({
        gesture_autoscroll_settings: message.settings
      });
      return { success: true };
      
    case 'getSettings':
      const data = await browser.storage.local.get('gesture_autoscroll_settings');
      return data.gesture_autoscroll_settings || DEFAULT_SETTINGS;
      
    default:
      console.warn('Unknown message action:', message.action);
      return { error: 'Unknown action' };
  }
});
```

---

## 5. Storage Wrapper Utilities

```javascript
// File: storage.js
// Helper functions for settings management

async function getSettings() {
  try {
    const data = await browser.storage.local.get('gesture_autoscroll_settings');
    return data.gesture_autoscroll_settings || {
      enabled: true,
      defaultSpeed: 'medium',
      perSiteSettings: {}
    };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return null;
  }
}

async function saveSettings(settings) {
  try {
    await browser.storage.local.set({
      gesture_autoscroll_settings: settings
    });
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
}

async function isEnabledForSite(hostname) {
  const settings = await getSettings();
  if (!settings) return true;
  
  // Check global enabled
  if (settings.enabled === false) return false;
  
  // Check per-site setting
  if (settings.perSiteSettings && settings.perSiteSettings[hostname]) {
    return settings.perSiteSettings[hostname].enabled !== false;
  }
  
  return true;
}

async function updateSiteSettings(hostname, siteSettings) {
  const settings = await getSettings();
  if (!settings) return false;
  
  if (!settings.perSiteSettings) {
    settings.perSiteSettings = {};
  }
  
  settings.perSiteSettings[hostname] = {
    ...settings.perSiteSettings[hostname],
    ...siteSettings
  };
  
  return await saveSettings(settings);
}
```

---

## 6. CSS Styling

```css
/* File: style.css */
/* Minimal styling for toast notifications */

#gesture-autoscroll-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 500;
  z-index: 2147483647;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
}

/* Optional: Visual indicator when scrolling is active */
body.gesture-autoscroll-active {
  /* Could add a subtle border or indicator */
}
```

---

## Summary of Extracted Code

### From firefox-simple_gesture:
- ✅ Touch event handling (touchstart, touchmove, touchend, touchcancel)
- ✅ Coordinate tracking and gesture detection
- ✅ Toast notification system
- ✅ Storage API patterns

### From AutoScrolling:
- ✅ AutoScroller class with start/stop/speed control
- ✅ Speed parsing and configuration
- ✅ Scroll element detection
- ✅ Bottom-of-page detection
- ✅ setInterval-based scrolling

### New Integration Code:
- ✅ Combined gesture handlers → scroll actions
- ✅ Settings management in background script
- ✅ Storage wrapper utilities
- ✅ Message passing between content and background

### Ready for Implementation:
All core code components are extracted and simplified. The next step is to:
1. Create manifest.json
2. Assemble these files into the extension structure
3. Add options page (optional)
4. Test on Firefox for Android

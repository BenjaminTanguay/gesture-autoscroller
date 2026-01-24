# Manifest Permissions Analysis

## Required Permissions for Gesture AutoScroller

### Minimal Manifest (Recommended)

```json
{
  "manifest_version": 2,
  "name": "Gesture AutoScroller",
  "version": "1.0.0",
  "description": "Control autoscrolling with Android gestures",
  
  "permissions": [
    "storage",
    "activeTab"
  ],
  
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "css": ["style.css"],
    "run_at": "document_start"
  }],
  
  "background": {
    "scripts": ["background.js"]
  },
  
  "browser_specific_settings": {
    "gecko": {
      "id": "gesture-autoscroller@yourdomain.com",
      "strict_min_version": "142.0"
    }
  }
}
```

---

## Permission Breakdown

### 1. `storage` (REQUIRED)
**Purpose**: Store user preferences and settings

**Usage**:
- Save scroll speed preferences
- Store per-site enable/disable settings
- Save gesture mappings
- Store volume key rebinding configurations

**Code Example**:
```javascript
// Save settings
await browser.storage.local.set({
  'gesture_autoscroll_settings': {
    enabled: true,
    defaultSpeed: 'medium',
    perSiteSettings: {
      'example.com': { enabled: true, speed: 'fast' }
    }
  }
});

// Load settings
const data = await browser.storage.local.get('gesture_autoscroll_settings');
```

**From Reference Projects**:
- firefox-simple_gesture uses it for gesture configurations
- AutoScrolling uses it for scroll speed and behavior settings

---

### 2. `activeTab` (REQUIRED)
**Purpose**: Access the current active tab

**Why activeTab instead of `tabs`**:
- More privacy-friendly (only accesses current tab)
- Sufficient for our use case (we only control scrolling on the active page)
- Lower permission warning for users
- Firefox approval process prefers minimal permissions

**Usage**:
- Content script can access current page's DOM
- Detect and respond to touch gestures on the active page
- Control scrolling on the current page

**Note**: We DON'T need the full `tabs` permission because:
- We're not managing multiple tabs
- We're not creating/closing tabs
- We're not reading tab history
- We're not accessing inactive tabs

---

### 3. Content Scripts (REQUIRED DECLARATION)
**Purpose**: Inject our gesture detection and scrolling code into web pages

```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"],
  "css": ["style.css"],
  "run_at": "document_start"
}]
```

**Why `<all_urls>`**:
- User should be able to use gestures on any website
- Can be overridden by per-site settings stored in `storage`

**Why `document_start`**:
- Initialize touch event listeners as early as possible
- Prevent conflicts with page scripts
- Ensure gesture detection is ready when page loads

---

### 4. Background Script (REQUIRED DECLARATION)
**Purpose**: Handle settings management and state persistence

```json
"background": {
  "scripts": ["background.js"]
}
```

**Responsibilities**:
- Manage settings storage
- Handle messages from content scripts
- Maintain global state (if needed)
- Process volume key events (if implemented)

---

## Permissions We DON'T Need

### ❌ `tabs`
**Why NOT needed**:
- We use `activeTab` instead (more restricted)
- We don't manage multiple tabs
- We don't need to query all tabs
- We don't need tab.url access for all tabs

**Reference projects use it for**:
- firefox-simple_gesture: Tab management features (we skip these)
- AutoScrolling: Multi-tab state tracking (we skip this)

---

### ❌ `*://*/*` (host permissions)
**Why NOT needed**:
- `activeTab` provides sufficient access
- Content scripts already get injected via `content_scripts.matches`
- Avoid requesting broad host permissions

**Note**: Some Firefox versions might require this, but try without it first.

---

### ❌ `scripting`
**Why NOT needed**:
- We use `content_scripts` for injection (manifest v2 way)
- `scripting` is more for dynamic injection (manifest v3)
- Simpler permission model without it

**Reference projects**:
- firefox-simple_gesture uses it for dynamic script execution
- We can achieve our goals with static content scripts

---

### ❌ `sessions`
**Why NOT needed**:
- Only needed for restoring closed tabs
- Not part of our feature set

---

### ❌ `declarativeNetRequest`
**Why NOT needed**:
- Only needed for modifying network requests
- Not related to scrolling or gestures

---

### ❌ `menus`
**Why NOT needed**:
- We don't need context menus
- All control via gestures

---

## Volume Key Rebinding Considerations

### If We Implement Volume Key Rebinding:

**Option 1: Content Script Key Events (Preferred)**
No additional permissions needed! We can detect keyboard events in the content script:

```javascript
// In content.js
document.addEventListener('keydown', (e) => {
  if (e.key === 'AudioVolumeUp') {
    e.preventDefault();
    pageDown();
  }
  if (e.key === 'AudioVolumeDown') {
    e.preventDefault();
    pageUp();
  }
}, true);
```

**Limitations**:
- Volume keys might not be exposed as keyboard events on all Android devices
- Some browsers might not allow preventDefault on volume keys
- May not work when browser is in background

**Option 2: WebExtension APIs (If Option 1 Fails)**
No standard WebExtension API exists for volume keys. This might not be feasible without native code or alternative approaches.

**Recommendation**: 
- Start without volume key support
- Add as experimental feature if feasible
- Consider alternative: use on-screen buttons instead

---

## Comparison with Reference Projects

### firefox-simple_gesture Permissions
```json
"permissions": [
  "*://*/*",           // ❌ We use activeTab instead
  "storage",           // ✅ We need this
  "tabs",              // ❌ We use activeTab instead
  "scripting",         // ❌ We use content_scripts
  "activeTab",         // ✅ We need this
  "sessions",          // ❌ Not needed (tab restoration)
  "declarativeNetRequest" // ❌ Not needed (user agent switching)
]
```

### AutoScrolling Permissions
```json
"permissions": [
  "storage",  // ✅ We need this
  "tabs",     // ❌ We use activeTab instead
  "menus"     // ❌ Not needed (no context menu)
]
```

### Our Permissions (Minimal Set)
```json
"permissions": [
  "storage",    // ✅ Settings storage
  "activeTab"   // ✅ Current tab access
]
```

---

## Permission Justification for Firefox AMO Review

When submitting to Mozilla Addons (AMO), we'll need to justify each permission:

### `storage`
> "Required to save user preferences including scroll speed settings, per-site configurations, and gesture mappings. Data is stored locally on the user's device and never transmitted."

### `activeTab`
> "Required to detect touch gestures and control autoscrolling on the currently active webpage. This extension only accesses the page the user is currently viewing."

### `<all_urls>` (in content_scripts)
> "Required to enable gesture-based scrolling on any website the user visits. Users can disable the extension on specific sites via settings."

---

## Security & Privacy Considerations

1. **Minimal Permissions**: We only request what's absolutely necessary
2. **No Network Access**: No remote connections, all data stored locally
3. **No Tracking**: No analytics, no telemetry, no user data collection
4. **Transparent Storage**: Users can inspect stored settings via browser DevTools
5. **Open Source**: Code can be audited by users

---

## Future Permission Considerations

If we add features in the future, we might need:

### Clipboard Access (for gesture patterns sharing)
```json
"optional_permissions": [
  "clipboardWrite",
  "clipboardRead"
]
```

### Notifications (for feedback)
```json
"permissions": [
  "notifications"
]
```

### WebRequest (for advanced site detection)
```json
"permissions": [
  "webRequest"
]
```

**Recommendation**: Keep these as optional or avoid them entirely to maintain minimal permission footprint.

---

## Testing Permission Requirements

### Desktop Firefox (Development)
1. Install extension with manifest
2. Check `about:debugging` for permission warnings
3. Verify storage access works
4. Test content script injection

### Firefox for Android (Target Platform)
1. Install via `web-ext run --target=firefox-android`
2. Test touch events work with activeTab
3. Verify storage persists across sessions
4. Check content script runs on all sites

### Permission Error Troubleshooting

**If content script doesn't run**:
- Check `matches` pattern in content_scripts
- Verify run_at timing
- Check console for errors

**If storage doesn't work**:
- Confirm `storage` in permissions array
- Check storage API compatibility (local vs sync)
- Verify data isn't exceeding storage limits

**If can't access page**:
- Ensure `activeTab` is in permissions
- Check content_scripts matches pattern
- Verify page isn't restricted (e.g., about:, moz-extension:)

---

## Summary: Required Manifest Structure

```json
{
  "manifest_version": 2,
  "name": "Gesture AutoScroller",
  "version": "1.0.0",
  "description": "Control page autoscrolling with simple touch gestures",
  
  "permissions": [
    "storage",
    "activeTab"
  ],
  
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "css": ["style.css"],
    "run_at": "document_start"
  }],
  
  "background": {
    "scripts": ["background.js"]
  },
  
  "icons": {
    "48": "icons/icon-48.png",
    "96": "icons/icon-96.png"
  },
  
  "browser_specific_settings": {
    "gecko": {
      "id": "gesture-autoscroller@yourdomain.com",
      "strict_min_version": "142.0"
    },
    "gecko_android": {
      "strict_min_version": "142.0"
    }
  },
  
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  }
}
```

This minimal permission set provides everything we need while maximizing user privacy and security.

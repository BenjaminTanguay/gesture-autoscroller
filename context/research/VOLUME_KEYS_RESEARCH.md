# Volume Key Capture Research Findings

## Executive Summary

**VERDICT: NOT FEASIBLE ❌**

Volume key capture in Firefox Android WebExtensions is **not technically possible** due to fundamental platform limitations. This is not a Firefox-specific limitation but an Android system architecture restriction applied to all browsers for security reasons.

**Date**: January 24, 2026  
**Status**: Research Complete - Feature Not Implementable

---

## Research Question

Can a Firefox Android WebExtension intercept hardware volume up/down button presses and remap them to page up/page down actions?

---

## Key Findings

### 1. WebExtension API Limitations

**KeyboardEvent API**:
- Volume keys (VolumeUp/VolumeDown) are defined in the KeyboardEvent specification
- However, they are **not exposed to web content** or WebExtensions on Android
- Android OS intercepts these keys at the system level before they reach the browser
- Volume keys do NOT generate `keydown` or `keyup` events in the web context

**Commands API**:
- Firefox `commands` API only supports keyboard shortcuts (Ctrl/Alt + keys)
- Cannot bind hardware buttons like volume keys
- No Android-specific command bindings available

**Permissions**:
- No WebExtension permissions exist for hardware button capture
- No manifest.json configuration can enable this access

### 2. Platform Architecture

**Android System Design**:
- Volume keys are handled at the Android framework level
- System always prioritizes volume control for audio
- Browsers run in a sandboxed environment with no direct hardware access

**Security Model**:
- WebExtensions cannot override system-level key handling
- This prevents malicious extensions from hijacking system controls
- Intentional design decision, not a bug or oversight

### 3. Alternative Approaches Investigated

All alternative approaches were found to be **non-viable**:

**Media Session API**:
```javascript
// This does NOT work - volume keys are not exposed
navigator.mediaSession.setActionHandler('volumeup', () => { ... });
```
- Volume keys are not part of MediaSession API
- Only supports: play, pause, seek, track navigation
- Limited Firefox Android support anyway

**Accessibility APIs**:
- Not available in WebExtensions
- Would require native app permissions

**Content Script Interception**:
```javascript
// This will NEVER see volume key events
document.addEventListener('keydown', (e) => {
  console.log(e.code);  // Never logs "VolumeUp" or "VolumeDown"
});
```
- Volume keys don't reach the web content layer
- Android intercepts before browser receives events

**GeckoView/WebView**:
- Only works in native Android apps with embedded browser
- Requires Java/Kotlin code:
```java
@Override
public boolean dispatchKeyEvent(KeyEvent event) {
    if (event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_UP) {
        // Handle volume up
        return true;
    }
    return super.dispatchKeyEvent(event);
}
```
- Not applicable to WebExtensions

### 4. Cross-Browser Comparison

**Chrome/Chromium**:
- Has the **same limitation** on Android
- No Chrome extensions can capture volume keys on mobile

**Conclusion**: This is an **Android platform restriction**, not Firefox-specific

### 5. Real-World Evidence

**Extension Search**:
- Searched Mozilla Add-ons (AMO)
- Searched Chrome Web Store
- Searched GitHub for open-source examples
- **Result**: Zero extensions found that capture volume keys on Android

**Reason**: Technical impossibility, not lack of developer interest

### 6. Mozilla Bug Tracker

**Bugzilla Search**:
- No open bugs for "volume key android webextension"
- No feature requests found for this capability
- Suggests this isn't commonly requested (likely because developers know it's not possible)

---

## Technical Requirements That Would Be Needed

For this feature to work, the following would be required:

1. **New WebExtension API**: Create a `browser.hardware` or similar API
2. **New Permission**: Something like `"hardware.keys"` in manifest.json
3. **Android Permission**: `android.permission.CAPTURE_AUDIO_OUTPUT` or similar
4. **Firefox Implementation**: Mozilla would need to implement the API
5. **System Override**: Ability to prevent default volume behavior
6. **User Consent**: Permission prompt for granting hardware access

**Likelihood of Implementation**: Very low

**Reasons Against**:
- Security risk (malicious extensions could hijack system controls)
- Against Android design principles (system keys should remain system-level)
- User experience issues (unexpected volume button behavior)
- Accessibility concerns (users rely on volume keys for audio)

---

## Recommended Alternatives

Since direct volume key capture is not possible, here are viable alternatives for the Gesture AutoScroller project:

### Option 1: Focus on Other Features ✅ (RECOMMENDED)

**Implement the two viable features**:
1. **Tap-based page navigation** (left/right screen regions)
2. **Gesture-controlled autoscrolling** (with pause/resume and speed control)

**Benefits**:
- Both features are fully implementable
- Achieve the same goal (reduce hand strain)
- Better UX than volume keys anyway (more intuitive)
- No technical blockers

### Option 2: On-Screen Buttons

Add page up/down buttons in a subtle overlay:
```javascript
// Browser action or page action button
browser.browserAction.onClicked.addListener(() => {
  browser.tabs.executeScript({
    code: 'window.scrollBy(0, window.innerHeight);'
  });
});
```

**Pros**:
- Fully implementable
- Always accessible

**Cons**:
- Requires screen space
- Still requires tapping (doesn't reduce thumb strain as much)

### Option 3: Enhanced Touch Gestures

Implement additional gestures for navigation:
- Two-finger swipe up → Page down
- Two-finger swipe down → Page up
- Edge swipe left → Page up
- Edge swipe right → Page down

**Pros**:
- More ergonomic than single-finger drags
- Reduces thumb strain
- Fully implementable

**Cons**:
- Learning curve for users
- May conflict with browser gestures

### Option 4: External Bluetooth Controllers

Support external Bluetooth page-turn devices:
- E-reader remote controls
- Presentation clickers
- Bluetooth keyboards

**Pros**:
- These devices send PageUp/PageDown key events that ARE capturable
- Great for extended reading sessions
- Fully implementable

**Cons**:
- Requires external hardware purchase
- Less convenient than built-in buttons

### Option 5: Native Android App (If Essential)

If volume keys are absolutely essential:
- Build a **native Android app** instead of a WebExtension
- Embed a WebView with the extension functionality
- Use native code to intercept volume keys
- Bridge to JavaScript via WebView interface

**Pros**:
- Volume keys work
- More control over UI/UX

**Cons**:
- Much more complex development
- Need to learn Android development (Java/Kotlin)
- Harder to distribute (Google Play vs. Firefox Add-ons)
- Can't leverage existing Firefox WebExtension ecosystem

---

## Documentation References

- [MDN: KeyboardEvent Code Values](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values)
- [Firefox Android Extension Development](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)
- [WebExtensions Commands API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/commands)
- [MediaSession API Specification](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession)
- [Android KeyEvent Reference](https://developer.android.com/reference/android/view/KeyEvent)

---

## Impact on Project Scope

### Updated Feature List

**Remove from MVP** ❌:
- Volume key remapping (not feasible)

**Keep in MVP** ✅:
- Tap-based page navigation (left/right screen regions)
- Gesture-controlled autoscrolling (activation, pause, speed control)
- Configuration menu
- Host whitelist system

### Updated Project Goals

The project can still achieve its **core objective**:
> Reduce hand strain from repetitive scrolling on mobile devices

**Without volume keys, we still have**:
1. **Tap navigation**: Simple taps instead of drag gestures
2. **Autoscrolling**: Hands-free reading
3. **Gesture speed control**: Fine-tune reading pace

These two features combined **effectively solve the hand strain problem** without needing volume keys.

### User Communication

When users ask about volume keys:
- Explain the technical limitation clearly
- Provide Android platform reasoning
- Suggest alternative features (tap navigation, autoscroll)
- Mention external Bluetooth controllers as an option

---

## Conclusion

**Volume key remapping is not implementable** in a Firefox Android WebExtension due to fundamental Android platform restrictions. This limitation applies to all browsers, not just Firefox.

**Recommendation**: **Remove volume key feature from project scope** and focus on the two fully-implementable features:
1. Tap-based page navigation
2. Gesture-controlled autoscrolling

These features alone will achieve the project's goal of reducing hand strain during mobile reading.

**Next Steps**:
1. Update INTENTION.md to remove volume key feature
2. Update FEATURES.md to remove Feature 1
3. Update README.md to reflect revised scope
4. Proceed with implementation of viable features

---

**Research Completed**: January 24, 2026  
**Researcher**: OpenCode AI Agent  
**Status**: Definitive - No further investigation needed

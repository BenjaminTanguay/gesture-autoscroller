/**
 * Gesture AutoScroller - Content Script
 * Tap-based page navigation feature
 */

(function() {
  'use strict';
  
  // ============================================================================
  // CONFIGURATION & STATE
  // ============================================================================
  
  // Default settings structure
  const DEFAULT_SETTINGS = {
    tapNavigationEnabled: true,
    autoscrollEnabled: true,
    autoStartEnabled: false,    // Auto-start scrolling on page load
    autoStartDelay: 3,          // Seconds to wait before auto-starting
    defaultSpeed: 20,      // px/sec
    minSpeed: 1,           // px/sec
    maxSpeed: 3000,        // px/sec
    granularity: 10,       // px/sec
    tapScrollPercentage: 100,   // Percentage of viewport height to scroll (10-100%)
    tapZoneLayout: 'horizontal', // Options: 'horizontal', 'vertical'
    tapZoneUpPercentage: 50     // Size of scroll-up zone (10-90%)
  };
  
  // Current settings
  let settings = { ...DEFAULT_SETTINGS };
  
  // Extension active state
  let isExtensionActive = false;
  
  // Touch tracking state
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let touchStartTime = 0;
  let touchEndTime = 0;
  let touchStartTarget = null;
  let isTouchActive = false; // Track if touch/mouse is currently pressed
  let fingerCount = 0; // Track number of fingers touching
  
  // For tracking continuous gesture direction changes
  let lastCheckX = 0; // Last position where we checked direction
  let lastCheckY = 0; // Last position where we checked direction
  let lastSpeedAdjustmentY = 0; // Last Y position where we adjusted speed
  let accumulatedSpeedDistance = 0; // Accumulated distance for speed adjustment
  
  // Constants
  const TAP_MAX_DURATION = 200; // milliseconds (quick tap)
  const TAP_MAX_MOVEMENT = 10; // pixels
  const SWIPE_MIN_DISTANCE = 50; // pixels (minimum swipe distance)
  const GESTURE_SEQUENCE_TIMEOUT = 2000; // milliseconds (time window for gesture sequence)
  const SPEED_ADJUSTMENT_DISTANCE = 30; // pixels traveled to trigger one speed adjustment
  
  // Toast state
  let toastElement = null;
  let toastTimeout = null;
  
  // Autoscroll state
  let autoscroller = null;
  
  // Gesture sequence tracking (for activation: swipe down THEN swipe left)
  let gestureSequence = [];
  let gestureSequenceTimer = null;
  
  // Continuous gesture tracking (for detecting direction changes within single touch)
  let lastGestureDirection = null; // Last detected direction in current touch sequence
  let isTrackingContinuousGesture = false; // Whether we're tracking a continuous gesture
  
  // Auto-start state
  let autoStartTimer = null;
  let autoStartCountdownInterval = null;
  let autoStartRemainingSeconds = 0;
  
  // Desktop scroll activation tracking
  let lastScrollTime = 0;
  let scrollActivationThreshold = 100; // pixels scrolled down to activate
  
  // Tap scroll lock (prevents duplicate taps during smooth scroll)
  let isTapScrollInProgress = false;
  let tapScrollAnimationId = null;
  let tapScrollStartPosition = 0;
  let tapScrollTargetPosition = 0;
  let tapScrollStartTime = 0;
  const TAP_SCROLL_DURATION = 500; // milliseconds for smooth scroll animation
  
  // Wake Lock (keeps screen active during autoscroll)
  let wakeLock = null;
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  // Initialize extension
  async function init() {
    // Add countdown animation styles
    addCountdownStyles();
    
    // Load settings
    await loadSettings();
    
    // IMPORTANT: Always set up touch listeners for three-finger tap
    // This allows users to add non-whitelisted sites with the gesture
    setupTouchListeners();
    
    // Check if extension should be active on this site
    if (await isHostWhitelisted()) {
      activateExtension();
    }
  }
  
  // Load settings from storage (per-domain)
  async function loadSettings() {
    try {
      const hostname = window.location.hostname;
      
      // Request domain-specific configuration from background script
      const response = await browser.runtime.sendMessage({
        action: 'getSettings',
        host: hostname
      });
      
      if (response && response.success && response.config) {
        settings = {
          ...DEFAULT_SETTINGS,
          ...response.config
        };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
  
  // Save current speed to storage (per-domain)
  async function saveCurrentSpeedToStorage(newSpeed) {
    try {
      const hostname = window.location.hostname;
      
      // Update local settings
      settings.defaultSpeed = newSpeed;
      
      // Save to browser storage (domain-specific)
      await browser.runtime.sendMessage({
        action: 'saveDomainConfig',
        hostname: hostname,
        config: settings
      });
    } catch (error) {
      console.error('Failed to save speed:', error);
    }
  }
  
  // Check if current host is whitelisted
  async function isHostWhitelisted() {
    const currentHost = window.location.hostname;
    
    try {
      // Ask background script if this host is whitelisted
      const response = await browser.runtime.sendMessage({
        action: 'isHostWhitelisted',
        host: currentHost
      });
      
      return response && response.success && response.isWhitelisted;
    } catch (error) {
      console.error('Failed to check whitelist:', error);
      return false;
    }
  }
  
  // Activate extension features
  function activateExtension() {
    isExtensionActive = true;
    
    // Add CSS class to disable text selection
    if (document.body) {
      document.body.classList.add('gesture-autoscroller-active');
    }
    
    // Touch listeners are already set up in init() for three-finger tap
    // No need to set them up again here
    
    // Start auto-start countdown if enabled
    if (settings.autoStartEnabled && settings.autoscrollEnabled) {
      startAutoStartCountdown();
    }
  }
  
  // Deactivate extension features
  function deactivateExtension() {
    isExtensionActive = false;
    
    // Remove CSS class to re-enable text selection
    if (document.body) {
      document.body.classList.remove('gesture-autoscroller-active');
    }
    
    // Keep touch listeners active for three-finger tap functionality
    // Don't remove them here - they should remain active to allow re-enabling with 3-finger tap
    
    cancelAutoStartCountdown();
  }
  
  // Toggle extension for current site (add/remove from whitelist)
  async function toggleExtensionForCurrentSite() {
    const currentHost = window.location.hostname;
    
    // Get current whitelist from new storage schema
    const result = await browser.storage.local.get('gesture_autoscroller_whitelist');
    const whitelist = result.gesture_autoscroller_whitelist || [];
    
    // Check if current host is in whitelist
    const isCurrentlyWhitelisted = whitelist.includes(currentHost);
    
    if (isCurrentlyWhitelisted) {
      // Remove from whitelist via background script
      const response = await browser.runtime.sendMessage({
        action: 'removeFromWhitelist',
        hostname: currentHost
      });
      
      if (response && response.success) {
        // Deactivate extension
        deactivateExtension();
        
        // Show confirmation
        showToast(`Disabled for ${currentHost}`, 2500);
      } else {
        showToast(`Failed to disable for ${currentHost}`, 2500);
      }
    } else {
      // Add to whitelist via background script
      const response = await browser.runtime.sendMessage({
        action: 'addToWhitelist',
        hostname: currentHost
      });
      
      if (response && response.success) {
        // Activate extension
        activateExtension();
        
        // Show confirmation
        showToast(`Enabled for ${currentHost}`, 2500);
      } else {
        showToast(`Failed to enable for ${currentHost}`, 2500);
      }
    }
  }
  
  // ============================================================================
  // AUTO-START COUNTDOWN
  // ============================================================================
  
  // Start auto-start countdown
  function startAutoStartCountdown() {
    // Don't start if autoscroll is already active
    if (autoscroller && autoscroller.isActive()) {
      return;
    }
    
    // Cancel any existing countdown
    cancelAutoStartCountdown();
    
    autoStartRemainingSeconds = settings.autoStartDelay;
    
    // Show initial countdown notification
    showCountdownNotification(autoStartRemainingSeconds);
    
    // Update countdown every second
    autoStartCountdownInterval = setInterval(() => {
      autoStartRemainingSeconds--;
      
      if (autoStartRemainingSeconds > 0) {
        showCountdownNotification(autoStartRemainingSeconds);
      } else {
        // Countdown finished - activate autoscroll
        cancelAutoStartCountdown();
        
        if (settings.autoscrollEnabled) {
          activateAutoscroll();
        }
      }
    }, 1000);
  }
  
  // Cancel auto-start countdown
  function cancelAutoStartCountdown() {
    if (autoStartTimer) {
      clearTimeout(autoStartTimer);
      autoStartTimer = null;
    }
    
    if (autoStartCountdownInterval) {
      clearInterval(autoStartCountdownInterval);
      autoStartCountdownInterval = null;
    }
    
    autoStartRemainingSeconds = 0;
    hideCountdownNotification();
  }
  
  // Show countdown notification
  function showCountdownNotification(seconds) {
    // Remove existing countdown notification
    let countdownElement = document.getElementById('gesture-autoscroll-countdown');
    
    if (!countdownElement) {
      // Create countdown element
      countdownElement = document.createElement('div');
      countdownElement.id = 'gesture-autoscroll-countdown';
      countdownElement.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        transform: none;
        background: rgba(50, 50, 50, 0.95);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        font-family: system-ui, -apple-system, sans-serif;
        z-index: 2147483647;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        text-align: center;
        min-width: 60px;
      `;
      
      document.body.appendChild(countdownElement);
    }
    
    // Update countdown number with animation
    countdownElement.style.animation = 'none';
    countdownElement.offsetHeight; // Trigger reflow
    countdownElement.style.animation = 'countdown-pulse 0.5s ease';
    countdownElement.textContent = seconds;
  }
  
  // Hide countdown notification
  function hideCountdownNotification() {
    const countdownElement = document.getElementById('gesture-autoscroll-countdown');
    if (countdownElement && countdownElement.parentNode) {
      countdownElement.style.animation = 'countdown-fadeout 0.3s ease';
      setTimeout(() => {
        if (countdownElement && countdownElement.parentNode) {
          countdownElement.parentNode.removeChild(countdownElement);
        }
      }, 300);
    }
  }
  
  // Add countdown animation styles to page
  function addCountdownStyles() {
    if (document.getElementById('gesture-autoscroll-countdown-styles')) {
      return; // Already added
    }
    
    const style = document.createElement('style');
    style.id = 'gesture-autoscroll-countdown-styles';
    style.textContent = `
      @keyframes countdown-pulse {
        0% {
          transform: scale(0.8);
          opacity: 0.5;
        }
        50% {
          transform: scale(1.1);
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
      
      @keyframes countdown-fadeout {
        from {
          transform: scale(1);
          opacity: 1;
        }
        to {
          transform: scale(0.8);
          opacity: 0;
        }
      }
      
      /* Disable text selection when extension is active */
      body.gesture-autoscroller-active {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
      
      /* Prevent overscroll bounce on mobile - always active to prevent white space scrolling */
      html {
        overscroll-behavior-y: none;
      }
      
      body {
        overscroll-behavior-y: none;
      }
      
      /* Allow text selection on interactive elements */
      body.gesture-autoscroller-active input,
      body.gesture-autoscroller-active textarea,
      body.gesture-autoscroller-active [contenteditable] {
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        user-select: text;
      }
    `;
    document.head.appendChild(style);
  }
  
  // ============================================================================
  // TOUCH EVENT HANDLING
  // ============================================================================
  
  // Get touch coordinates (handles both touch and mouse events)
  function getXY(event) {
    const touch = event.touches ? event.touches[0] : event;
    return [touch.clientX, touch.clientY];
  }
  
  // Touch start handler
  function onTouchStart(event) {
    isTouchActive = true; // Mark touch as active
    touchStartTime = Date.now();
    [touchStartX, touchStartY] = getXY(event);
    touchEndX = touchStartX;
    touchEndY = touchStartY;
    touchStartTarget = event.target;
    
    // Track number of fingers (for two-finger tap detection)
    fingerCount = event.touches ? event.touches.length : 1;
    
    // Reset continuous gesture tracking
    lastGestureDirection = null;
    isTrackingContinuousGesture = false;
    gestureSequence = [];
    lastCheckX = touchStartX;
    lastCheckY = touchStartY;
    lastSpeedAdjustmentY = touchStartY;
    accumulatedSpeedDistance = 0;
    
    // Cancel auto-start countdown on any touch interaction
    if (autoStartCountdownInterval) {
      cancelAutoStartCountdown();
      showToast('Auto-start cancelled');
    }
  }
  
  // Touch move handler
  function onTouchMove(event) {
    // CRITICAL: Only process if touch/mouse is actually pressed
    if (!isTouchActive) {
      return;
    }
    
    // Prevent default scrolling if autoscroll is active OR if tap scroll is in progress
    if ((autoscroller && autoscroller.isActive()) || isTapScrollInProgress) {
      event.preventDefault();
    }
    
    [touchEndX, touchEndY] = getXY(event);
    
    // FIRST: Handle speed adjustment continuously (with low threshold)
    // This runs on every touch move when autoscroll is active
    if (autoscroller && autoscroller.isActive()) {
      const deltaYFromStart = touchEndY - touchStartY;
      const absYFromStart = Math.abs(deltaYFromStart);
      
      // Determine if this is primarily a vertical gesture
      const deltaXFromStart = touchEndX - touchStartX;
      const absXFromStart = Math.abs(deltaXFromStart);
      
      // If vertical movement dominates, handle speed adjustment
      if (absYFromStart > absXFromStart && absYFromStart > 10) {
        const direction = deltaYFromStart > 0 ? 'down' : 'up';
        handleDistanceBasedSpeedAdjustment(direction);
      }
    }
    
    // SECOND: Handle gesture direction detection (for side swipes, etc.)
    // Calculate delta from last check position (for continuous direction changes)
    const deltaX = touchEndX - lastCheckX;
    const deltaY = touchEndY - lastCheckY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Only process gesture direction if movement is significant since last check
    if (absX < SWIPE_MIN_DISTANCE && absY < SWIPE_MIN_DISTANCE) {
      return;
    }
    
    // Determine current direction (prioritize dominant axis)
    let currentDirection = null;
    if (absY > absX) {
      currentDirection = deltaY > 0 ? 'down' : 'up';
    } else {
      currentDirection = deltaX > 0 ? 'right' : 'left';
    }
    
    // Check if direction changed (this indicates a continuous gesture sequence)
    if (currentDirection !== lastGestureDirection && lastGestureDirection !== null) {
      // Direction changed during continuous touch - add to gesture sequence
      gestureSequence.push(currentDirection);
      
      // Check for activation pattern (down -> left) or speed adjustment
      handleContinuousGesture(currentDirection);
      
      // Update last check position since we detected a direction change
      lastCheckX = touchEndX;
      lastCheckY = touchEndY;
    } else if (lastGestureDirection === null) {
      // First direction in this touch sequence
      gestureSequence.push(currentDirection);
      lastCheckX = touchEndX;
      lastCheckY = touchEndY;
      
      // Also handle this direction (for side swipe deactivation from paused state)
      handleContinuousGesture(currentDirection);
    }
    
    // Update last direction
    lastGestureDirection = currentDirection;
    isTrackingContinuousGesture = true;
  }
  
  // Touch end handler
  function onTouchEnd(event) {
    isTouchActive = false; // Mark touch as inactive
    touchEndTime = Date.now();
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const duration = touchEndTime - touchStartTime;
    
    // Detect tap
    if (duration < TAP_MAX_DURATION && absX < TAP_MAX_MOVEMENT && absY < TAP_MAX_MOVEMENT) {
      // If tap scroll is in progress, prevent default to avoid cancelling the smooth scroll
      if (isTapScrollInProgress) {
        event.preventDefault();
      }
      handleTap(event);
      // Reset continuous gesture tracking
      lastGestureDirection = null;
      isTrackingContinuousGesture = false;
      return;
    }
    
    // Detect swipe
    if (absX > SWIPE_MIN_DISTANCE || absY > SWIPE_MIN_DISTANCE) {
      handleSwipe(deltaX, deltaY, absX, absY);
      // Reset continuous gesture tracking after processing
      lastGestureDirection = null;
      isTrackingContinuousGesture = false;
      return;
    }
    
    // Reset continuous gesture tracking
    lastGestureDirection = null;
    isTrackingContinuousGesture = false;
  }
  
  // Touch cancel handler
  function onTouchCancel(event) {
    isTouchActive = false; // Mark touch as inactive
    
    // Reset state
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
    touchStartTarget = null;
    
    // Reset continuous gesture tracking
    lastGestureDirection = null;
    isTrackingContinuousGesture = false;
    gestureSequence = [];
  }
  
  // Setup touch event listeners
  function setupTouchListeners() {
    if ('ontouchstart' in window) {
      // Mobile touch events
      // Use passive:false for touchend to allow preventDefault() during tap scroll lock
      // Use passive:false for touchmove to allow preventDefault() when autoscroll is active
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd, { passive: false });
      window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    } else {
      // Desktop: mouse events for gestures + scroll event for activation
      window.addEventListener('mousedown', onTouchStart, { passive: true });
      window.addEventListener('mousemove', onTouchMove, { passive: true });
      window.addEventListener('mouseup', onTouchEnd, { passive: false });
      
      // Add scroll listener for desktop activation
      window.addEventListener('wheel', onWheelScroll, { passive: false });
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
      window.removeEventListener('wheel', onWheelScroll);
    }
  }
  
  // ============================================================================
  // DESKTOP SCROLL ACTIVATION
  // ============================================================================
  
  // Handle wheel scroll for desktop activation
  function onWheelScroll(event) {
    // Only handle on desktop (non-touch devices)
    if ('ontouchstart' in window) {
      return;
    }
    
    // Require extension to be active
    if (!isExtensionActive) {
      return;
    }
    
    // If autoscroll is already active, let it handle things
    if (autoscroller && autoscroller.isActive()) {
      return;
    }
    
    // Check if autoscroll is enabled
    if (!settings.autoscrollEnabled) {
      return;
    }
    
    // Check if user is scrolling down (positive deltaY)
    if (event.deltaY > 0) {
      // Prevent default scroll behavior
      event.preventDefault();
      
      // Activate autoscroll
      activateAutoscroll();
      
      // Reset last scroll time
      lastScrollTime = Date.now();
    }
  }
  
  // ============================================================================
  // TAP NAVIGATION LOGIC
  // ============================================================================
  
  // Handle tap event
  function handleTap(event) {
    // Check for four-finger tap (activate element picker) - MOBILE ONLY
    // This works when extension is active on the current site
    if (fingerCount === 4 && 'ontouchstart' in window) {
      // Four-finger tap detected on mobile
      if (isExtensionActive) {
        // Don't show toast - the picker has its own UI banner with instructions
        activateElementPicker();
      } else {
        showToast('Add this site to whitelist first (3-finger tap)', 3000);
      }
      return;
    }
    
    // Check for three-finger tap (toggle extension for current site) - MOBILE ONLY
    // This ALWAYS works, even when extension is not active
    if (fingerCount === 3 && 'ontouchstart' in window) {
      // Three-finger tap detected on mobile - toggle extension for current site
      toggleExtensionForCurrentSite();
      return;
    }
    
    // All other gestures require extension to be active
    if (!isExtensionActive) {
      return;
    }
    
    // Check for two-finger tap (activation gesture) - MOBILE ONLY
    if (fingerCount === 2 && 'ontouchstart' in window) {
      // Two-finger tap detected on mobile
      if (!autoscroller || !autoscroller.isActive()) {
        // Not autoscrolling - activate with two-finger tap
        if (settings.autoscrollEnabled) {
          activateAutoscroll();
          return;
        }
      }
      // If already autoscrolling, two-finger tap does nothing (use single tap to pause/resume)
      return;
    }
    
    // Check if auto-navigate countdown is active
    if (autoNavigateCountdownInterval) {
      cancelAutoNavigateCountdown();
      showToast('Auto-navigate cancelled', 2000);
      return;
    }
    
    // Single-finger tap behavior
    // If autoscroll is active, tap = pause/resume
    if (autoscroller && autoscroller.isActive()) {
      autoscroller.toggle();
      const state = autoscroller.getState();
      showToast(state === 'PAUSED' ? 'Paused' : 'Resumed');
      return;
    }
    
    // Check if tap navigation is enabled
    if (!settings.tapNavigationEnabled) {
      return;
    }
    
    // Prevent tap navigation if a scroll is already in progress (FIX-002)
    // This prevents double-tap from cancelling the smooth scroll
    if (isTapScrollInProgress) {
      return;
    }
    
    // Check if tap target is an interactive element
    if (isInteractiveElement(touchStartTarget)) {
      return;
    }
    
    // Determine scroll direction based on tap zone layout and size
    const upZonePercentage = settings.tapZoneUpPercentage / 100;
    let shouldScrollDown = false;
    
    if (settings.tapZoneLayout === 'horizontal') {
      // Horizontal layout: left = up, right = down
      const screenWidth = window.innerWidth;
      const upZoneWidth = screenWidth * upZonePercentage;
      const tapX = touchStartX;
      shouldScrollDown = (tapX >= upZoneWidth);
    } else {
      // Vertical layout: top = up, bottom = down
      const screenHeight = window.innerHeight;
      const upZoneHeight = screenHeight * upZonePercentage;
      const tapY = touchStartY;
      shouldScrollDown = (tapY >= upZoneHeight);
    }
    
    if (shouldScrollDown) {
      // Scroll down
      pageDown();
    } else {
      // Scroll up
      pageUp();
    }
  }
  
  // Check if element is interactive (link, button, input, etc.)
  function isInteractiveElement(element) {
    if (!element) return false;
    
    // Check element itself and its parents (up to 5 levels)
    let currentElement = element;
    let depth = 0;
    const maxDepth = 5;
    
    while (currentElement && depth < maxDepth) {
      const tagName = currentElement.tagName ? currentElement.tagName.toLowerCase() : '';
      
      // Interactive tags
      if (['a', 'button', 'input', 'textarea', 'select', 'label'].includes(tagName)) {
        return true;
      }
      
      // Elements with click handlers
      if (currentElement.onclick) {
        return true;
      }
      
      // Elements with role="button" or similar
      const role = currentElement.getAttribute('role');
      if (role && ['button', 'link', 'tab', 'menuitem', 'option'].includes(role)) {
        return true;
      }
      
      // Elements with cursor: pointer (common for clickable elements)
      const computedStyle = window.getComputedStyle(currentElement);
      if (computedStyle.cursor === 'pointer') {
        return true;
      }
      
      currentElement = currentElement.parentElement;
      depth++;
    }
    
    return false;
  }
  
  // Custom smooth scroll animation using easing function
  function animateTapScroll(timestamp) {
    if (!tapScrollStartTime) {
      tapScrollStartTime = timestamp;
    }
    
    const elapsed = timestamp - tapScrollStartTime;
    const progress = Math.min(elapsed / TAP_SCROLL_DURATION, 1);
    
    // Ease-out cubic easing for smooth deceleration
    const eased = 1 - Math.pow(1 - progress, 3);
    
    // Calculate current position
    const currentPosition = tapScrollStartPosition + (tapScrollTargetPosition - tapScrollStartPosition) * eased;
    
    // Set scroll position (using instant scroll)
    window.scrollTo({
      top: currentPosition,
      left: 0,
      behavior: 'auto'
    });
    
    // Continue animation if not complete
    if (progress < 1) {
      tapScrollAnimationId = requestAnimationFrame(animateTapScroll);
    } else {
      // Animation complete - release lock
      isTapScrollInProgress = false;
      tapScrollAnimationId = null;
      tapScrollStartTime = 0;
    }
  }
  
  // Start a tap scroll animation
  function startTapScroll(direction) {
    // Prevent tap if a scroll is already in progress
    if (isTapScrollInProgress) {
      return;
    }
    
    // Cancel any existing animation
    if (tapScrollAnimationId) {
      cancelAnimationFrame(tapScrollAnimationId);
      tapScrollAnimationId = null;
    }
    
    // Mark scroll as in progress
    isTapScrollInProgress = true;
    
    // Calculate scroll distance using configurable percentage
    const viewportHeight = window.innerHeight;
    const scrollPercentage = settings.tapScrollPercentage / 100;
    const scrollDistance = Math.floor(viewportHeight * scrollPercentage);
    
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    const scrollAmount = direction === 'down' ? scrollDistance : -scrollDistance;
    
    tapScrollStartPosition = currentScroll;
    tapScrollTargetPosition = currentScroll + scrollAmount;
    tapScrollStartTime = 0;
    
    // Clamp target to document bounds
    const maxScroll = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    tapScrollTargetPosition = Math.max(0, Math.min(tapScrollTargetPosition, maxScroll));
    
    // Start animation
    tapScrollAnimationId = requestAnimationFrame(animateTapScroll);
  }
  
  // Page down (scroll down one viewport height)
  function pageDown() {
    startTapScroll('down');
  }
  
  // Page up (scroll up one viewport height)
  function pageUp() {
    startTapScroll('up');
  }
  
  // ============================================================================
  // SWIPE DETECTION & AUTOSCROLL
  // ============================================================================
  
  // Handle continuous gesture detection (direction changes within single touch)
  function handleContinuousGesture(currentDirection) {
    // Check if autoscroll is active
    if (autoscroller && autoscroller.isActive()) {
      // Autoscroll is active - handle speed adjustment or deactivation
      const state = autoscroller.getState();
      
      if (currentDirection === 'up' || currentDirection === 'down') {
        // Speed adjustment handled in onTouchMove continuously
        return;
      } else if (currentDirection === 'left' || currentDirection === 'right') {
        // Side swipe = deactivate (works from both SCROLLING and PAUSED states)
        autoscroller.stop();
        showToast('Autoscroll stopped');
      }
    }
    // Note: Activation now uses two-finger tap instead of down→left gesture
  }
  
  // Handle continuous speed adjustment during active touch
  // This allows speed to keep changing while user maintains swipe motion
  // Speed adjustment is based on distance traveled, not time
  function handleDistanceBasedSpeedAdjustment(direction) {
    // Calculate distance traveled since last speed adjustment
    const distanceTraveled = Math.abs(touchEndY - lastSpeedAdjustmentY);
    
    // Add to accumulated distance
    accumulatedSpeedDistance += distanceTraveled;
    
    // Update last adjustment position
    lastSpeedAdjustmentY = touchEndY;
    
    // Check if we've traveled enough distance to trigger adjustments
    if (accumulatedSpeedDistance >= SPEED_ADJUSTMENT_DISTANCE) {
      // Calculate how many adjustments to make based on distance
      const numAdjustments = Math.floor(accumulatedSpeedDistance / SPEED_ADJUSTMENT_DISTANCE);
      
      // Reset accumulated distance (keep remainder)
      accumulatedSpeedDistance = accumulatedSpeedDistance % SPEED_ADJUSTMENT_DISTANCE;
      
      // Apply multiple speed adjustments
      for (let i = 0; i < numAdjustments; i++) {
        if (direction === 'up') {
          autoscroller.increaseSpeed();
        } else if (direction === 'down') {
          autoscroller.decreaseSpeed();
        }
      }
      
      // Show toast with current speed (only once per batch of adjustments)
      showToast(`Speed: ${Math.round(autoscroller.getCurrentSpeed())} px/sec`, 600);
    }
  }
  
  // Handle swipe gesture (called on touchend)
  function handleSwipe(deltaX, deltaY, absX, absY) {
    // Determine final swipe direction
    let direction = null;
    if (absY > absX) {
      direction = deltaY > 0 ? 'down' : 'up';
    } else {
      direction = deltaX > 0 ? 'right' : 'left';
    }
    
    // Check if auto-navigate countdown is active - cancel on any swipe
    if (autoNavigateCountdownInterval) {
      cancelAutoNavigateCountdown();
      showToast('Auto-navigate cancelled', 2000);
      return;
    }
    
    // If continuous gesture tracking was active, most logic already handled
    // Otherwise handle as discrete swipe (backward compatibility)
    if (!isTrackingContinuousGesture) {
      if (autoscroller && autoscroller.isActive()) {
        handleAutoscrollSwipe(direction);
      }
    }
  }
  
  // Handle swipes when autoscroll is active (for discrete swipes - backward compatibility)
  function handleAutoscrollSwipe(direction) {
    const state = autoscroller.getState();
    
    if (direction === 'up') {
      // Increase speed (already handled continuously, but keep for discrete swipes)
      if (!isTrackingContinuousGesture) {
        autoscroller.increaseSpeed();
        showToast(`Speed: ${Math.round(autoscroller.getCurrentSpeed())} px/sec`);
      }
    } else if (direction === 'down') {
      // Decrease speed
      if (!isTrackingContinuousGesture) {
        autoscroller.decreaseSpeed();
        showToast(`Speed: ${Math.round(autoscroller.getCurrentSpeed())} px/sec`);
      }
    } else if (direction === 'left' || direction === 'right') {
      // Side swipe = deactivate (works from both SCROLLING and PAUSED states)
      if (!isTrackingContinuousGesture) {
        autoscroller.stop();
        showToast('Autoscroll stopped');
      }
    }
  }
  
  // Note: Activation is now done via two-finger tap instead of swipe gestures
  
  // Activate autoscroll
  function activateAutoscroll() {
    // Always create a new autoscroller with current settings
    autoscroller = new AutoScroller(settings);
    
    autoscroller.start();
  }
  
  // ============================================================================
  // SPEED PARSER (based on AutoScrolling extension)
  // ============================================================================
  
  // Parse speed (px/sec) into interval (ms) and step (px)
  // This allows for smooth scrolling at very low speeds
  function parseSpeed(speed) {
    const THOUSAND_MS = 1000;
    const THRESHOLD_STEP = 5; // Maximum step size for smooth scrolling
    
    // Handle edge cases
    if (speed <= 0) {
      return { interval: THOUSAND_MS, step: 1 }; // Minimum speed
    }
    if (speed >= THOUSAND_MS * THRESHOLD_STEP) {
      return { interval: 1, step: THRESHOLD_STEP }; // Maximum speed
    }
    
    // Calculate GCD (Greatest Common Divisor)
    function gcd(n, m) {
      let r = 0;
      while (n !== 0) {
        r = m % n;
        m = n;
        n = r;
      }
      return m;
    }
    
    // Start with 1 second interval and speed as step
    let interval = THOUSAND_MS;
    let step = Math.round(speed);
    
    // Simplify the fraction using GCD
    const divisor = gcd(interval, step);
    interval /= divisor;
    step /= divisor;
    
    // If step is small enough, we're done
    if (step <= THRESHOLD_STEP) {
      return { interval, step };
    }
    
    // Otherwise, try speed - 1 (recursive approach for smooth scrolling)
    return parseSpeed(speed - 1);
  }
  
  // ============================================================================
  // WAKE LOCK (SCREEN KEEP AWAKE)
  // ============================================================================
  
  // Enable wake lock to prevent screen from sleeping during autoscroll
  async function enableWakeLock() {
    try {
      // Check if Wake Lock API is available
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock acquired');
        
        // Re-acquire lock if it gets released (e.g., tab visibility change)
        wakeLock.addEventListener('release', () => {
          console.log('Wake Lock released');
        });
      } else {
        console.log('Wake Lock API not supported');
      }
    } catch (err) {
      console.error(`Wake Lock error: ${err.name}, ${err.message}`);
    }
  }
  
  // Disable wake lock
  async function disableWakeLock() {
    if (wakeLock !== null) {
      try {
        await wakeLock.release();
        wakeLock = null;
        console.log('Wake Lock manually released');
      } catch (err) {
        console.error('Failed to release wake lock:', err);
      }
    }
  }
  
  // ============================================================================
  // AUTO-NAVIGATE FEATURE
  // ============================================================================
  
  // Auto-navigate state
  let autoNavigateCountdownTimer = null;
  let autoNavigateCountdownInterval = null;
  let autoNavigateRemainingSeconds = 0;
  let autoNavigateCancelled = false;
  
  // Handle reaching bottom of page
  function handleReachedBottom() {
    // Check if auto-navigate is enabled for this domain
    if (!settings.autoNavigateEnabled) {
      showToast('Reached end of page', 2000);
      return;
    }
    
    // Check if there's a configured selector for this domain
    const siteConfig = settings.navigationSelector;
    
    if (!siteConfig || !siteConfig.enabled) {
      showToast('Reached end of page', 2000);
      return;
    }
    
    // Start countdown to auto-navigate
    startAutoNavigateCountdown(siteConfig);
  }
  
  // Start countdown before clicking next button
  function startAutoNavigateCountdown(siteConfig) {
    // Cancel any existing countdown
    cancelAutoNavigateCountdown();
    
    // Get delay from site config or global setting
    const delay = siteConfig.delay || settings.autoNavigateDelay;
    autoNavigateRemainingSeconds = delay;
    autoNavigateCancelled = false;
    
    // Show initial countdown toast
    showAutoNavigateCountdown(autoNavigateRemainingSeconds);
    
    // Update countdown every second
    autoNavigateCountdownInterval = setInterval(() => {
      autoNavigateRemainingSeconds--;
      
      if (autoNavigateRemainingSeconds <= 0) {
        // Time's up - navigate to next page
        clearInterval(autoNavigateCountdownInterval);
        autoNavigateCountdownInterval = null;
        navigateToNextPage(siteConfig);
      } else {
        // Update countdown display
        showAutoNavigateCountdown(autoNavigateRemainingSeconds);
      }
    }, 1000);
  }
  
  // Show auto-navigate countdown toast
  function showAutoNavigateCountdown(seconds) {
    // Show message toast at bottom center (clickable to cancel)
    const message = `Navigating to next page... (Tap to cancel)`;
    showToast(message, 1100); // Show for slightly longer than 1 second
    
    // Add cancel handler to toast
    if (toastElement) {
      toastElement.style.cursor = 'pointer';
      toastElement.style.pointerEvents = 'auto';
      toastElement.onclick = () => {
        cancelAutoNavigateCountdown();
        showToast('Auto-navigate cancelled', 2000);
      };
    }
    
    // Show countdown number at bottom right
    showCountdownNotification(seconds);
  }
  
  // Cancel auto-navigate countdown
  function cancelAutoNavigateCountdown() {
    if (autoNavigateCountdownInterval) {
      clearInterval(autoNavigateCountdownInterval);
      autoNavigateCountdownInterval = null;
    }
    if (autoNavigateCountdownTimer) {
      clearTimeout(autoNavigateCountdownTimer);
      autoNavigateCountdownTimer = null;
    }
    autoNavigateCancelled = true;
    
    // Hide countdown notification
    hideCountdownNotification();
    
    // Reset toast click handler
    if (toastElement) {
      toastElement.style.cursor = 'default';
      toastElement.style.pointerEvents = 'none';
      toastElement.onclick = null;
    }
  }
  
  // Navigate to next page
  function navigateToNextPage(siteConfig) {
    try {
      // Hide countdown notification
      hideCountdownNotification();
      
      // Find the next button using the configured selector
      const nextButton = document.querySelector(siteConfig.selector);
      
      if (!nextButton) {
        showToast('Next button not found', 2000);
        return;
      }
      
      // Check if it's visible
      if (nextButton.offsetParent === null) {
        showToast('Next button not visible', 2000);
        return;
      }
      
      showToast('Navigating to next page...', 1000);
      
      // Click the next button
      nextButton.click();
      
      // If auto-start is enabled, start autoscroll after page loads
      if (siteConfig.autoStart || settings.autoNavigateAutoStart) {
        // Wait for page to load, then start autoscroll
        setTimeout(() => {
          if (autoscroller && !autoscroller.isActive()) {
            autoscroller.start();
            showToast('Auto-scrolling...', 2000);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to navigate to next page:', error);
      showToast('Failed to navigate', 2000);
    }
  }
  
  // ============================================================================
  // AUTOSCROLLER CLASS
  // ============================================================================
  
  class AutoScroller {
    constructor(config) {
      // Store reference to settings object (will be updated dynamically)
      this.config = config;
      this.state = 'INACTIVE'; // INACTIVE, SCROLLING, PAUSED
      this.currentSpeed = config.defaultSpeed;
      this.animationFrameId = null;
      this.lastScrollTime = 0;
      this.accumulatedScroll = 0;
      this.targetScrollPosition = 0; // For smooth scrolling approach
      this.usesSmoothScroll = false; // Flag to track which method we're using
    }
    
    // Update config (for when settings change)
    updateConfig(newConfig) {
      this.config = newConfig;
    }
    
    // Check if autoscroller is active (either scrolling or paused)
    isActive() {
      return this.state !== 'INACTIVE';
    }
    
    // Get current state
    getState() {
      return this.state;
    }
    
    // Get current speed (in px/sec)
    getCurrentSpeed() {
      return this.currentSpeed;
    }
    
    // Start autoscrolling
    start() {
      if (this.state === 'INACTIVE') {
        this.state = 'SCROLLING';
        this.currentSpeed = this.config.defaultSpeed;
        this.startScrolling();
        // Acquire wake lock to keep screen active
        enableWakeLock();
      }
    }
    
    // Stop autoscrolling (deactivate completely)
    stop() {
      this.state = 'INACTIVE';
      this.stopScrolling();
      // Release wake lock
      disableWakeLock();
    }
    
    // Pause autoscrolling
    pause() {
      if (this.state === 'SCROLLING') {
        this.state = 'PAUSED';
        this.stopScrolling();
        // Keep wake lock active during pause so screen doesn't turn off
      }
    }
    
    // Resume autoscrolling
    resume() {
      if (this.state === 'PAUSED') {
        this.state = 'SCROLLING';
        this.startScrolling();
      }
    }
    
    // Toggle between scrolling and paused
    toggle() {
      if (this.state === 'SCROLLING') {
        this.pause();
      } else if (this.state === 'PAUSED') {
        this.resume();
      }
    }
    
    // Increase scroll speed
    increaseSpeed() {
      this.currentSpeed = Math.min(
        this.config.maxSpeed,
        this.currentSpeed + this.config.granularity
      );
      
      // Update the config default speed so it persists
      this.config.defaultSpeed = this.currentSpeed;
      
      // Save to storage
      saveCurrentSpeedToStorage(this.currentSpeed);
    }
    
    // Decrease scroll speed
    decreaseSpeed() {
      this.currentSpeed = Math.max(
        this.config.minSpeed,
        this.currentSpeed - this.config.granularity
      );
      
      // Update the config default speed so it persists
      this.config.defaultSpeed = this.currentSpeed;
      
      // Save to storage
      saveCurrentSpeedToStorage(this.currentSpeed);
    }
    
    // Start the scrolling animation loop using requestAnimationFrame
    startScrolling() {
      this.lastScrollTime = performance.now();
      this.accumulatedScroll = 0;
      
      // For low speeds, use smooth scroll with continuously updated target
      this.usesSmoothScroll = this.currentSpeed < 60;
      
      if (this.usesSmoothScroll) {
        // Initialize target position to current scroll position
        this.targetScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      }
      
      this.animationFrameId = requestAnimationFrame(this.scroll.bind(this));
    }
    
    // Stop the scrolling animation loop
    stopScrolling() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
    
    // Scroll one frame (called by requestAnimationFrame)
    scroll(timestamp) {
      // Check if state is INACTIVE (might have been stopped externally)
      if (this.state === 'INACTIVE') {
        return;
      }
      
      // Check if we've reached the bottom of the page BEFORE scrolling
      if (this.isAtBottom()) {
        this.stop();
        handleReachedBottom();
        return;
      }
      
      // Calculate time elapsed since last scroll
      const deltaTime = timestamp - this.lastScrollTime;
      this.lastScrollTime = timestamp;
      
      // Calculate how many pixels to scroll this frame
      // speed is in px/sec, deltaTime is in ms, so convert: (px/sec) * (ms / 1000)
      const pixelsThisFrame = (this.currentSpeed * deltaTime) / 1000;
      
      if (this.usesSmoothScroll) {
        // For low speeds: use smooth scrollTo with continuously advancing target
        // This leverages browser's sub-pixel interpolation for smoother motion
        this.targetScrollPosition += pixelsThisFrame;
        
        // Clamp target position to document bounds to prevent overscroll
        // Use same calculation as isAtBottom() for consistency
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        const maxScrollTop = scrollHeight - clientHeight;
        
        // Clamp to maximum scroll position
        this.targetScrollPosition = Math.min(this.targetScrollPosition, maxScrollTop);
        
        window.scrollTo({
          top: this.targetScrollPosition,
          left: 0,
          behavior: 'auto'  // Use instant scroll - we're animating manually via RAF
        });
      } else {
        // For higher speeds: use the accumulation method
        this.accumulatedScroll += pixelsThisFrame;
        
        if (this.accumulatedScroll >= 1) {
          const pixelsToScroll = Math.floor(this.accumulatedScroll);
          this.accumulatedScroll -= pixelsToScroll;
          
          window.scrollBy({
            top: pixelsToScroll,
            left: 0,
            behavior: 'auto'
          });
        }
      }
      
      // Continue animation loop
      this.animationFrameId = requestAnimationFrame(this.scroll.bind(this));
    }
    
    // Check if we're at the bottom of the page
    isAtBottom() {
      // Get scroll position - try multiple methods for cross-browser compatibility
      const scrollTop = window.pageYOffset || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      
      // Get document height - use document.documentElement for consistency
      const scrollHeight = document.documentElement.scrollHeight;
      
      // Get viewport height - use document.documentElement.clientHeight for consistency
      // (window.innerHeight includes address bar on mobile which causes issues)
      const clientHeight = document.documentElement.clientHeight;
      
      // Use a threshold for "close enough to bottom"
      const threshold = 10;
      
      // Calculate how far we are from the bottom
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      
      // Check if we're at bottom using the original formula
      const isAtBottom = distanceFromBottom <= threshold;
      
      return isAtBottom;
    }
  }
  
  // ============================================================================
  // TOAST NOTIFICATIONS
  // ============================================================================
  
  // Show toast message
  function showToast(message, duration = 1500) {
    // Safety check: ensure document.body exists
    if (!document.body) {
      return;
    }
    
    // Remove existing toast and clear any pending timeout
    hideToast();
    
    // Create toast element
    toastElement = document.createElement('div');
    toastElement.id = 'gesture-autoscroll-toast';
    toastElement.textContent = message;
    toastElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(50, 50, 50, 0.95);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 2147483647;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    try {
      document.body.appendChild(toastElement);
      
      // Fade in
      requestAnimationFrame(() => {
        if (toastElement) {
          toastElement.style.opacity = '1';
        }
      });
      
      // Auto-hide after duration
      toastTimeout = setTimeout(() => {
        hideToast();
      }, duration);
    } catch (error) {
      console.error('Failed to show toast:', error);
      toastElement = null;
    }
  }
  
  // Hide toast
  function hideToast() {
    // Clear any pending timeout first
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
    
    // Then hide and remove the element
    if (toastElement) {
      try {
        toastElement.style.opacity = '0';
        
        const elementToRemove = toastElement;
        toastElement = null; // Clear reference immediately
        
        setTimeout(() => {
          if (elementToRemove && elementToRemove.parentNode) {
            elementToRemove.parentNode.removeChild(elementToRemove);
          }
        }, 300);
      } catch (error) {
        console.error('Failed to hide toast:', error);
        toastElement = null;
      }
    }
  }
  
  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================
  
  // Store last right-clicked element
  let lastRightClickedElement = null;
  
  // Listen for context menu to capture element
  document.addEventListener('contextmenu', (event) => {
    lastRightClickedElement = event.target;
  }, true);
  
  // ============================================================================
  // ELEMENT PICKER MODE (for mobile)
  // ============================================================================
  
  let elementPickerActive = false;
  let pickerOverlay = null;
  let pickerHighlight = null;
  let pickerTarget = null;
  let pickerReadyToSelect = false; // Flag to prevent immediate selection after activation
  
  // Activate element picker mode
  function activateElementPicker() {
    console.log('activateElementPicker called, current state:', elementPickerActive);
    
    if (elementPickerActive) {
      console.log('Picker already active, ignoring');
      return;
    }
    
    elementPickerActive = true;
    pickerReadyToSelect = false; // Not ready yet - need to wait for activation touches to clear
    console.log('Setting elementPickerActive to true');
    
    // Notify background script that element picking has started
    browser.runtime.sendMessage({
      action: 'startElementPicking'
    }).catch(error => {
      console.log('Failed to notify background of element picking start:', error);
      // Continue anyway - the background script now accepts elementPicked without this flag
    });
    
    // Hide any existing toasts
    if (toastElement) {
      toastElement.style.display = 'none';
    }
    
    console.log('Creating picker UI elements');
    
    // Create highlight box first (under overlay)
    pickerHighlight = document.createElement('div');
    pickerHighlight.id = 'gesture-autoscroller-picker-highlight';
    pickerHighlight.style.cssText = `
      position: absolute;
      border: 3px solid #667eea;
      background: rgba(102, 126, 234, 0.2);
      pointer-events: none;
      z-index: 2147483645;
      transition: all 0.1s ease;
      box-shadow: 0 0 0 3000px rgba(0, 0, 0, 0.5);
    `;
    
    // Create instructions banner
    const banner = document.createElement('div');
    banner.id = 'gesture-autoscroller-picker-banner';
    banner.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(50, 50, 50, 0.95);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      max-width: 70%;
      text-align: center;
      pointer-events: none;
    `;
    banner.textContent = 'Tap on the "Next Page" button';
    
    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'gesture-autoscroller-picker-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, calc(-50% + 60px));
      background: rgba(50, 50, 50, 0.95);
      color: white;
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
      touch-action: manipulation;
    `;
    
    // Append elements
    document.body.appendChild(pickerHighlight);
    document.body.appendChild(banner);
    document.body.appendChild(cancelBtn);
    
    // Add event listeners
    document.addEventListener('mousemove', handlePickerMouseMove, true);
    document.addEventListener('touchstart', handlePickerTouchStart, true);
    document.addEventListener('touchmove', handlePickerTouchMove, true);
    document.addEventListener('click', handlePickerClick, true);
    document.addEventListener('touchend', handlePickerTouchEnd, true);
    
    // Wait for 500ms before allowing selection (prevents immediate selection from activation gesture)
    setTimeout(() => {
      pickerReadyToSelect = true;
      console.log('Picker ready to select elements');
    }, 500);
    
    // Cancel button handler
    cancelBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deactivateElementPicker();
    }, true);
    
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deactivateElementPicker();
    }, true);
    
    // Store references for cleanup
    pickerHighlight._banner = banner;
    pickerHighlight._cancelBtn = cancelBtn;
  }
  
  // Deactivate element picker mode
  function deactivateElementPicker() {
    if (!elementPickerActive) return;
    
    elementPickerActive = false;
    pickerReadyToSelect = false; // Reset the ready flag
    
    // Remove event listeners
    document.removeEventListener('mousemove', handlePickerMouseMove, true);
    document.removeEventListener('touchstart', handlePickerTouchStart, true);
    document.removeEventListener('touchmove', handlePickerTouchMove, true);
    document.removeEventListener('click', handlePickerClick, true);
    document.removeEventListener('touchend', handlePickerTouchEnd, true);
    
    // Remove elements
    if (pickerHighlight) {
      if (pickerHighlight._banner) pickerHighlight._banner.remove();
      if (pickerHighlight._cancelBtn) pickerHighlight._cancelBtn.remove();
      pickerHighlight.remove();
      pickerHighlight = null;
    }
    
    // Restore toasts
    if (toastElement) {
      toastElement.style.display = '';
    }
    
    pickerTarget = null;
  }
  
  // Handle mouse move in picker mode
  function handlePickerMouseMove(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    updatePickerHighlight(element);
  }
  
  // Handle touch start in picker mode
  function handlePickerTouchStart(event) {
    // Check if it's the cancel button
    if (event.target && event.target.id === 'gesture-autoscroller-picker-cancel') {
      return; // Let the cancel button handle its own event
    }
    
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      updatePickerHighlight(element);
    }
  }
  
  // Handle touch move in picker mode
  function handlePickerTouchMove(event) {
    // Check if it's the cancel button
    if (event.target && event.target.id === 'gesture-autoscroller-picker-cancel') {
      return; // Let the cancel button handle its own event
    }
    
    event.preventDefault();
    
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      updatePickerHighlight(element);
    }
  }
  
  // Update picker highlight
  function updatePickerHighlight(element) {
    if (!element || element === pickerHighlight) return;
    
    // Don't highlight our own UI elements
    if (element.id && element.id.startsWith('gesture-autoscroller-picker')) {
      return;
    }
    
    // Check if it's one of our picker UI elements
    if (pickerHighlight && (
      element === pickerHighlight._banner ||
      element === pickerHighlight._cancelBtn
    )) return;
    
    pickerTarget = element;
    
    const rect = element.getBoundingClientRect();
    pickerHighlight.style.top = (rect.top + window.scrollY) + 'px';
    pickerHighlight.style.left = (rect.left + window.scrollX) + 'px';
    pickerHighlight.style.width = rect.width + 'px';
    pickerHighlight.style.height = rect.height + 'px';
  }
  
  // Handle click in picker mode
  function handlePickerClick(event) {
    // Check if it's the cancel button
    if (event.target && event.target.id === 'gesture-autoscroller-picker-cancel') {
      return; // Let the cancel button handle its own event
    }
    
    // Don't process selection if picker isn't ready yet
    if (!pickerReadyToSelect) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    if (!pickerTarget) return;
    
    // Don't pick our own UI elements
    if (pickerTarget.id && pickerTarget.id.startsWith('gesture-autoscroller-picker')) {
      return;
    }
    
    // Get selector for the target element
    const selector = generateSelector(pickerTarget);
    const elementInfo = {
      selector: selector,
      hostname: window.location.hostname,
      tagName: pickerTarget.tagName.toLowerCase(),
      text: pickerTarget.textContent ? pickerTarget.textContent.trim().substring(0, 50) : '',
      href: pickerTarget.href || ''
    };
    
    console.log('Element picked:', elementInfo);
    
    // Deactivate picker
    deactivateElementPicker();
    
    // Send to background script (which will forward to options page)
    browser.runtime.sendMessage({
      action: 'elementPicked',
      elementInfo: elementInfo
    }).then(response => {
      console.log('Element picked message sent, response:', response);
    }).catch(error => {
      console.error('Failed to send element picked message:', error);
    });
  }
  
  // Handle touch end in picker mode
  function handlePickerTouchEnd(event) {
    // Check if it's the cancel button
    if (event.target && event.target.id === 'gesture-autoscroller-picker-cancel') {
      return; // Let the cancel button handle its own event
    }
    
    // Don't process selection if picker isn't ready yet (prevents immediate selection from activation gesture)
    if (!pickerReadyToSelect) {
      console.log('Picker not ready to select yet, ignoring touch');
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    // Get the touch point
    if (event.changedTouches && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Update target one last time
      if (element && element.id !== 'gesture-autoscroller-picker-cancel') {
        updatePickerHighlight(element);
      }
    }
    
    // Small delay to ensure highlight is updated
    setTimeout(() => {
      handlePickerClick(event);
    }, 50);
  }
  
  // Generate unique CSS selector for an element
  function generateSelector(element) {
    if (!element) return null;
    
    // Try ID first (most specific)
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }
    
    // Try unique class combination
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        const classSelector = classes.map(c => `.${CSS.escape(c)}`).join('');
        const matchingElements = document.querySelectorAll(classSelector);
        if (matchingElements.length === 1) {
          return classSelector;
        }
      }
    }
    
    // Try element type + attributes
    const tagName = element.tagName.toLowerCase();
    
    // For links, try href attribute
    if (tagName === 'a' && element.hasAttribute('href')) {
      const href = element.getAttribute('href');
      const linkSelector = `a[href="${CSS.escape(href)}"]`;
      const matchingLinks = document.querySelectorAll(linkSelector);
      if (matchingLinks.length === 1) {
        return linkSelector;
      }
    }
    
    // Try rel attribute (common for next/prev buttons)
    if (element.hasAttribute('rel')) {
      const rel = element.getAttribute('rel');
      const relSelector = `${tagName}[rel="${CSS.escape(rel)}"]`;
      const matchingElements = document.querySelectorAll(relSelector);
      if (matchingElements.length === 1) {
        return relSelector;
      }
    }
    
    // Try data attributes
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-')) {
        const attrSelector = `${tagName}[${attr.name}="${CSS.escape(attr.value)}"]`;
        const matchingElements = document.querySelectorAll(attrSelector);
        if (matchingElements.length === 1) {
          return attrSelector;
        }
      }
    }
    
    // Fall back to nth-child selector
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element) + 1;
      return `${generateSelector(parent)} > ${tagName}:nth-child(${index})`;
    }
    
    return tagName;
  }
  
  // Listen for messages from options page (settings updates)
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated' || message.action === 'configUpdated') {
      // Handle both legacy 'settingsUpdated' and new 'configUpdated' messages
      if (message.settings) {
        settings = message.settings;
      } else if (message.config) {
        settings = message.config;
      }
      
      // Re-check if extension should be active
      isHostWhitelisted().then(isWhitelisted => {
        if (isWhitelisted && !isExtensionActive) {
          activateExtension();
        } else if (!isWhitelisted && isExtensionActive) {
          deactivateExtension();
        } else if (isExtensionActive) {
          // Update listeners based on new settings
          // Touch listeners needed if either tap navigation OR autoscroll is enabled
          if (settings.tapNavigationEnabled || settings.autoscrollEnabled) {
            setupTouchListeners();
          } else {
            removeTouchListeners();
          }
        }
      });
    } else if (message.action === 'captureElementSelector') {
      // Capture the CSS selector of the last right-clicked element
      if (lastRightClickedElement) {
        const selector = generateSelector(lastRightClickedElement);
        const elementInfo = {
          selector: selector,
          hostname: window.location.hostname,
          tagName: lastRightClickedElement.tagName.toLowerCase(),
          text: lastRightClickedElement.textContent ? lastRightClickedElement.textContent.trim().substring(0, 50) : '',
          href: lastRightClickedElement.href || ''
        };
        
        sendResponse({ success: true, ...elementInfo });
      } else {
        sendResponse({ success: false, error: 'No element was captured' });
      }
      return true; // Keep the message channel open for async response
    } else if (message.action === 'testSelector') {
      // Test if a selector matches any elements on the current page
      try {
        const elements = document.querySelectorAll(message.selector);
        const matches = Array.from(elements).map(el => ({
          tagName: el.tagName.toLowerCase(),
          text: el.textContent ? el.textContent.trim().substring(0, 50) : '',
          href: el.href || '',
          visible: el.offsetParent !== null
        }));
        
        sendResponse({ 
          success: true, 
          count: elements.length,
          matches: matches
        });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: `Invalid selector: ${error.message}` 
        });
      }
      return true;
    } else if (message.action === 'activateElementPicker') {
      // Activate element picker mode
      console.log('Received activateElementPicker message');
      try {
        activateElementPicker();
        console.log('Element picker activated');
        sendResponse({ success: true });
      } catch (error) {
        console.error('Failed to activate element picker:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
  });
  
  // ============================================================================
  // START EXTENSION
  // ============================================================================
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();

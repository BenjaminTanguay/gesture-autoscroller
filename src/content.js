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
    whitelistedHosts: []
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
  
  // Load settings from storage
  async function loadSettings() {
    try {
      const result = await browser.storage.local.get('gesture_autoscroller_settings');
      
      if (result.gesture_autoscroller_settings) {
        settings = {
          ...DEFAULT_SETTINGS,
          ...result.gesture_autoscroller_settings
        };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
  
  // Save current speed to storage
  async function saveCurrentSpeedToStorage(newSpeed) {
    try {
      // Update local settings
      settings.defaultSpeed = newSpeed;
      
      // Save to browser storage
      await browser.storage.local.set({
        gesture_autoscroller_settings: settings
      });
    } catch (error) {
      console.error('Failed to save speed:', error);
    }
  }
  
  // Check if current host is whitelisted
  async function isHostWhitelisted() {
    const currentHost = window.location.hostname;
    
    // If whitelist is empty, extension is inactive
    if (!settings.whitelistedHosts || settings.whitelistedHosts.length === 0) {
      return false;
    }
    
    // Check if current host matches any whitelisted host
    return settings.whitelistedHosts.some(whitelistedHost => {
      // Exact match
      if (currentHost === whitelistedHost) return true;
      
      // Subdomain match (e.g., "example.com" matches "www.example.com")
      if (currentHost.endsWith('.' + whitelistedHost)) return true;
      
      return false;
    });
  }
  
  // Activate extension features
  function activateExtension() {
    isExtensionActive = true;
    
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
    
    // Keep touch listeners active for three-finger tap functionality
    // Don't remove them here - they should remain active to allow re-enabling with 3-finger tap
    
    cancelAutoStartCountdown();
  }
  
  // Toggle extension for current site (add/remove from whitelist)
  async function toggleExtensionForCurrentSite() {
    const currentHost = window.location.hostname;
    
    // Check if current host is in whitelist
    const isCurrentlyWhitelisted = settings.whitelistedHosts && 
                                    settings.whitelistedHosts.includes(currentHost);
    
    if (isCurrentlyWhitelisted) {
      // Remove from whitelist
      settings.whitelistedHosts = settings.whitelistedHosts.filter(host => host !== currentHost);
      
      // Save updated settings
      await browser.storage.local.set({
        gesture_autoscroller_settings: settings
      });
      
      // Deactivate extension
      deactivateExtension();
      
      // Show confirmation
      showToast(`Disabled for ${currentHost}`, 2500);
    } else {
      // Add to whitelist
      if (!settings.whitelistedHosts) {
        settings.whitelistedHosts = [];
      }
      settings.whitelistedHosts.push(currentHost);
      
      // Save updated settings
      await browser.storage.local.set({
        gesture_autoscroller_settings: settings
      });
      
      // Activate extension
      activateExtension();
      
      // Show confirmation
      showToast(`Enabled for ${currentHost}`, 2500);
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
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(102, 126, 234, 0.95);
        color: white;
        padding: 24px 32px;
        border-radius: 16px;
        font-size: 48px;
        font-weight: 700;
        font-family: system-ui, -apple-system, sans-serif;
        z-index: 2147483647;
        pointer-events: none;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        text-align: center;
        min-width: 120px;
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
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 0.5;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.1);
        }
        100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
      }
      
      @keyframes countdown-fadeout {
        from {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
        to {
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 0;
        }
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
    
    // Prevent default scrolling if autoscroll is active
    if (autoscroller && autoscroller.isActive()) {
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
      // Use passive:false for touchmove to allow preventDefault() when autoscroll is active
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd, { passive: true });
      window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    } else {
      // Desktop: mouse events for gestures + scroll event for activation
      window.addEventListener('mousedown', onTouchStart, { passive: true });
      window.addEventListener('mousemove', onTouchMove, { passive: true });
      window.addEventListener('mouseup', onTouchEnd, { passive: true });
      
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
    
    // Check if tap target is an interactive element
    if (isInteractiveElement(touchStartTarget)) {
      return;
    }
    
    // Determine if tap is on left or right side of screen
    const screenWidth = window.innerWidth;
    const tapX = touchStartX;
    const isLeftSide = tapX < screenWidth / 2;
    
    if (isLeftSide) {
      // Left side tap = Page up
      pageUp();
    } else {
      // Right side tap = Page down
      pageDown();
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
  
  // Page down (scroll down one viewport height)
  function pageDown() {
    const viewportHeight = window.innerHeight;
    window.scrollBy({
      top: viewportHeight,
      behavior: 'smooth'
    });
  }
  
  // Page up (scroll up one viewport height)
  function pageUp() {
    const viewportHeight = window.innerHeight;
    window.scrollBy({
      top: -viewportHeight,
      behavior: 'smooth'
    });
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
      }
    }
    
    // Stop autoscrolling (deactivate completely)
    stop() {
      this.state = 'INACTIVE';
      this.stopScrolling();
    }
    
    // Pause autoscrolling
    pause() {
      if (this.state === 'SCROLLING') {
        this.state = 'PAUSED';
        this.stopScrolling();
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
      // Check if we've reached the bottom of the page
      if (this.isAtBottom()) {
        this.stop();
        showToast('Reached bottom');
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
        
        window.scrollTo({
          top: this.targetScrollPosition,
          left: 0,
          behavior: 'smooth'
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
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      
      return scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
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
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
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
  
  // Listen for messages from options page (settings updates)
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated') {
      settings = message.settings;
      
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

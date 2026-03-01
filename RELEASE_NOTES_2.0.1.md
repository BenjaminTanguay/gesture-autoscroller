# Release Notes - Version 2.0.1

**Release Date:** March 1, 2026

---

## Overview

Version 2.0.1 is a patch release focused on performance optimizations and reliability fixes for the autoscroll feature.

---

## Bug Fixes

### Fixed Bottom-of-Page Detection
Autoscroll now reliably stops when reaching the bottom of the page at all speeds. Previously, at speeds around 50+ px/sec, the detection could fail intermittently, causing the scroller to continue past the viewport.

### Two-Finger Tap Resumes from Paused State
When autoscroll is paused, both single-tap and two-finger tap now resume scrolling. This provides a more intuitive experience when you forget whether the screen is paused.

---

## Performance Improvements

### Optimized Autoscroll Engine
Simplified and optimized the autoscroll implementation for smoother performance and more reliable bottom-of-page detection, especially during speed changes.

### Optimized Toast Notifications
Toast notifications now reuse a single element instead of creating new ones, reducing overhead during frequent speed adjustments.

### Removed Debug Logging
Cleaned up console logging for a quieter experience.

---

## Upgrade Notes

- No configuration changes required
- Fully backward compatible with 2.0.0

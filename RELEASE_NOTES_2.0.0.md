# Release Notes - Version 2.0.0

**Release Date:** TBD  
**Last Updated:** February 22, 2026

---

## Overview

Version 2.0.0 improves the mobile reading experience with per-domain configurations, enhanced tap zone customization, automatic page navigation, and Android compatibility fixes.

---

## New Features

### Per-Domain Configuration
Each whitelisted domain has its own configuration profile. New domains inherit from a customizable "Default" template.

### Configuration Presets
Save and load named presets that can be applied to any domain. Export presets for backup or sharing.

### Configurable Tap Zones
- Adjust tap scroll distance (10% to 100% of viewport height)
- Choose horizontal or vertical tap zone layouts
- Configure zone size split (10/90 to 90/10)
- Real-time visual preview with color-coded zones

### Auto-Navigate to Next Page
Automatically click "Next Page" buttons when reaching the bottom during autoscroll. Configure countdown delays, auto-start behavior, and custom CSS selectors per domain.

---

## Bug Fixes

### Android Text Selection Fix
Disabled text selection on whitelisted pages during tap navigation to prevent accidental selection. Text selection remains available in input fields.

### Duplicate Tap Prevention
Tap-scroll lock blocks new taps during smooth scrolling (~600ms) to prevent double-taps and unpredictable scroll distances.

### Screen Wake Lock
Keep screen active during autoscroll on Android devices using the Screen Wake Lock API.

### Auto-Stop at Page Bottom
Autoscroll automatically stops when reaching the bottom with visual feedback. Configurable threshold (0-100px).

---

## UX Improvements

### Tabbed Settings Layout
Settings organized into tabs by feature category: Tap Navigation, Auto-Scrolling, Auto-Navigate, Whitelist, and Advanced.

### Improved Toast Notifications
Consistent dark theme with optimized positioning. State toasts at bottom center, countdown numbers in bottom right corner.

---

## Release Summary

- 9 New Features including per-domain configuration, presets, and auto-navigate
- 5 Bug Fixes addressing Android compatibility and precision issues
- 3 UX Improvements for better organization and less intrusive notifications

---

## Upgrade Notes

- Existing configurations will be migrated to the per-domain system
- All whitelisted domains will inherit your previous global settings
- Review domain configurations in the new tabbed layout

---

**For detailed technical documentation, see [VERSION_2.0.0_FEATURES.md](context/VERSION_2.0.0_FEATURES.md)**

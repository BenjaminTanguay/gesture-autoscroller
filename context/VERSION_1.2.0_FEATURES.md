# Version 1.2.0 - Features & Fixes Documentation

**Release Date**: TBD  
**Last Updated**: February 22, 2026

---

## Overview

Version 1.2.0 focuses on improving the mobile reading experience by addressing interaction issues and adding more flexible tap zone configuration options. This version includes critical bug fixes for Android text selection conflicts and screen timeout issues, along with enhanced user customization features and UX improvements.

---

## 🐛 Bug Fixes

### FIX-001: Disable Text Selection on Tap/Scroll Interaction

**Affects**: Android tap navigation and tap-to-scroll features

#### Problem
On Android devices, when tap navigation or tap-to-scroll is activated on whitelisted pages, text selection interferes with scrolling:
- Tapping to scroll sometimes selects text by mistake
- Text selection causes unpredictable scroll distances
- Selected text persists after scrolling, requiring manual cleanup
- Creates awkward user experience during reading

#### Solution
Disable text selection on whitelisted pages when extension features are active, while preserving text selection in input fields, textareas, and contenteditable elements.

#### User Configuration
- Settings checkbox: "Disable text selection on whitelisted pages"
- Default: Enabled
- Users can toggle if they prefer text selection over smooth scrolling

---

### FIX-002: Prevent Duplicate Taps During Smooth Scroll

**Affects**: Tap navigation feature

#### Problem
When users tap to scroll, they can tap again before the viewport finishes scrolling from the previous tap:
- Accidental double-taps cause unpredictable scroll distances
- Multiple rapid taps queue up scroll actions
- Smooth scroll animation doesn't block new tap inputs
- Users lose their reading position from unintended scrolls

#### Solution
Implement a tap-scroll lock that blocks new taps during active scrolling. The lock automatically releases after the scroll animation completes (approximately 600ms).

---

### FIX-003: Keep Screen Active During Autoscroll

**Affects**: Autoscroll feature on Android

#### Problem
During hands-free autoscroll reading sessions:
- Android screen timeout still applies (typically 30 seconds to 2 minutes)
- Screen turns off mid-reading
- User must unlock device and restart autoscroll
- Breaks the hands-free reading experience

#### Solution
Use the Screen Wake Lock API to keep the screen on during autoscroll. Wake lock is acquired when autoscroll starts and released when it stops or pauses. Falls back to alternative methods if the API is unavailable.

#### User Configuration
- Settings checkbox: "Keep screen awake during autoscroll"
- Default: Enabled
- Users can disable if they prefer default screen timeout behavior

---

### FIX-004: Stop Autoscroll at Bottom of Page

**Affects**: Autoscroll feature

#### Problem
Autoscroll continues even after reaching the bottom of the page:
- Scrolling attempts continue despite no more content
- No visual feedback that end is reached
- User must manually stop autoscroll
- Wastes battery on pointless scroll calculations

#### Solution
Detect when page bottom is reached and automatically stop autoscroll with visual feedback toast: "Reached end of page"

#### User Configuration
- Settings checkbox: "Auto-stop at page bottom"
- Default: Enabled
- Configurable threshold: 10px (default), range 0-100px

---

### FIX-005: Add Text Input for Slider Values

**Affects**: Settings/Options page UI

#### Problem
Settings page only has sliders for numeric values:
- Speed settings range from 1 to 5000 px/sec
- Very difficult to select precise values with slider alone
- Especially problematic on mobile with touch input
- Users waste time trying to drag slider to exact value

#### Solution
Add a synchronized text input field next to each slider, allowing users to either drag the slider or type an exact value. Changes to either input automatically update the other.

---

## ✨ New Features

### FEATURE-001: Configurable Tap Scroll Distance

**Affects**: Tap navigation feature

#### Description
Allow users to configure how much the screen scrolls when tapping, as a percentage of viewport height instead of fixed full-page behavior.

#### Current Behavior
- Tap right side → Scroll down one full viewport height
- Tap left side → Scroll up one full viewport height
- No customization available

#### New Behavior
Users can configure scroll distance from 10% to 100% of viewport height:
- **100%** = full screen (default, maintains current behavior)
- **75%** = three-quarter screen scroll
- **50%** = half screen scroll (maintains reading context)
- **10%** = minimal scroll for precise navigation

#### User Value
"As a reader, I want to configure tap scrolling to move half a screen length instead of full page, so I can maintain better context of what I just read while progressing through the content."

---

### FEATURE-002: Vertical Tap Zones (Alternative to Horizontal)

**Affects**: Tap navigation feature

#### Description
Provide an alternative tap zone layout where vertical zones (top/bottom) determine scroll direction, instead of the current horizontal left/right split.

#### Current Behavior
Screen divided horizontally (left/right):
- Tap left 50% → Scroll up
- Tap right 50% → Scroll down

#### New Behavior
Users can choose between two layouts:

**Horizontal Split (Current)**
- Left half = scroll up
- Right half = scroll down

**Vertical Split (NEW)**
- Top half = scroll up
- Bottom half = scroll down

#### User Value
"As a reader holding my phone in one hand, I want to tap the bottom of the screen to scroll down and tap the top to scroll up, because it's more natural than reaching across to tap left or right sides."

---

### FEATURE-003: Configurable Tap Zone Sizes

**Affects**: Tap navigation feature

#### Description
Allow users to configure the relative size of scroll-up vs scroll-down tap zones as a percentage split, rather than fixed 50/50 division.

#### Current Behavior
- Fixed 50/50 split (left/right or top/bottom)
- Equal size zones for both directions
- No customization

#### New Behavior
Users can configure zone split from 10/90 to 90/10 (scroll-up% / scroll-down%):
- **10/90** = tiny scroll-up zone, large scroll-down zone
- **30/70** = small scroll-up zone, large scroll-down zone
- **50/50** = equal zones (default, maintains current behavior)
- **70/30** = large scroll-up zone, small scroll-down zone
- **90/10** = large scroll-up zone, tiny scroll-down zone

Works with both horizontal and vertical layouts.

#### User Value
"As a reader, I mostly scroll down and rarely need to scroll up. I want the scroll-down zone to take 90% of the screen so I can tap almost anywhere to scroll down, with only a small 10% zone for scrolling up."

---

### FEATURE-004: Visual Tap Zone Preview in Settings

**Affects**: Options/Settings page UI

#### Description
Add a visual representation of the configured tap zones in the settings page, showing users exactly how their screen will be divided for tap navigation.

#### Features
- Rectangle representing phone screen with simulated content
- Color-coded zones:
  - **Red zone**: Tap to scroll up
  - **Green zone**: Tap to scroll down
- Updates in real-time as settings change
- Responsive to:
  - Layout selection (horizontal/vertical)
  - Zone size configuration (up/down percentage)
- Interactive: clicking zones shows scroll direction feedback

#### User Value
"As a user configuring tap zones, I want to see a visual preview of how the zones are laid out and sized, so I can understand exactly where I need to tap without trial and error."

---

### FEATURE-005: Auto-Navigate to Next Page

**Affects**: Autoscroll feature, whitelisted pages with pagination

#### Description
Automatically detect and click "Next Page" buttons when reaching the bottom of a page during autoscroll, allowing seamless continuous reading across multiple pages without manual interaction.

#### Current Behavior
- Autoscroll stops at page bottom
- User must manually find and click "Next" button
- Breaks the hands-free reading experience
- Requires re-enabling autoscroll on new page

#### New Behavior
When autoscroll reaches page bottom (on configured sites):
1. Extension pauses for configurable delay (default: 3 seconds)
2. Shows countdown: "Navigating to next page... (Tap to cancel)" + countdown number
3. Automatically clicks configured "Next" button
4. Optionally auto-starts scrolling on new page

User can cancel by tapping the message during countdown.

#### Configuration

**Global Settings:**
- Enable/disable auto-navigation
- Default countdown delay (1-30 seconds)
- Auto-start scrolling on new page (yes/no)

**Per-Site Configuration:**
- Add sites with custom CSS selectors for their "Next" buttons
- Override delay and auto-start per site
- Enable/disable per site
- Add notes for each configuration

**Selector Testing Tool:**
- Test CSS selectors on current page
- Visual feedback showing if selector works
- Helps users configure sites correctly

#### User Value
"As a reader using autoscroll on sites with pagination (like web novels, article series, or documentation), I want the extension to automatically navigate to the next page when reaching the bottom, so I can enjoy truly hands-free continuous reading without having to manually find and click the 'Next' button."

---

### FEATURE-006: Per-Domain Configuration

**Affects**: All extension settings, whitelist management

#### Description
Reorganize settings to be domain-specific rather than global, allowing different configurations for different reading sites. Each whitelisted domain becomes a configuration profile with its own settings for tap navigation, autoscroll speed, auto-navigate behavior, etc.

#### Current Behavior
- Single global configuration applies to all whitelisted sites
- All sites share same tap zone layout, scroll speed, auto-navigate settings
- No way to have different settings for different types of content
- Adding a site to whitelist applies global settings

#### New Behavior
Settings are organized per-domain:
- Each whitelisted domain has its own configuration
- Domains inherit from "Default" configuration when first added
- Can customize any setting per-domain
- Switch between domains to edit their specific configurations

**Domain Configuration Includes:**
- Tap Navigation settings (layout, zone size, scroll distance)
- Auto-Scrolling settings (speeds, delays, auto-start)
- Auto-Navigate settings (enable/disable, countdown delay, next button selector)
- Advanced settings (text selection, screen wake, auto-stop)

**Example Use Cases:**
- Manga sites: Large tap zones (90/10), slower scroll speed, no auto-navigate
- Novel sites: Balanced zones (50/50), faster scroll speed, auto-navigate enabled
- Documentation: Vertical zones, medium scroll speed, no auto-start
- Articles: Horizontal zones, custom scroll distance (75%)

#### Benefits
- Optimal settings for each type of content
- No need to reconfigure when switching between sites
- Settings automatically apply when visiting configured domain
- More control and flexibility for power users

#### User Value
"As a reader who visits different types of sites (manga, novels, documentation), I want to configure different settings for each site, so I don't have to manually adjust speeds and zones every time I switch between reading different content types."

---

### FEATURE-007: Default Configuration Template

**Affects**: Settings management, new domain initialization

#### Description
Provide a "Default" configuration that serves as the template for newly whitelisted domains. Users can customize this default to set their preferred starting point for new sites.

#### Current Behavior
- New whitelisted sites use hardcoded default values
- No way to change what defaults are applied to new sites
- Must manually configure each new site from scratch

#### New Behavior
**Default Configuration:**
- Editable "Default" configuration available in settings
- Acts as template for new domains
- When adding a domain to whitelist, it copies all settings from Default
- Can be modified like any other domain configuration

**Use Cases:**
- Set your preferred base configuration once
- All new sites start with your preferences
- Reduce repetitive configuration work
- Quickly onboard new reading sites

#### User Interface
Settings page shows "Default" as a special configuration entry:
- Clearly labeled as the template for new domains
- Can be edited like any domain configuration
- Visual indicator showing it's the default template
- Option to "Reset to factory defaults" if needed

#### Benefits
- Saves time when adding new domains
- Consistent starting point for new configurations
- Easier onboarding for new users
- Reduces configuration friction

#### User Value
"As a user who frequently adds new reading sites, I want to customize the default settings that new sites start with, so I don't have to manually configure the same preferences for every new domain I add."

---

### FEATURE-008: Configuration Presets

**Affects**: Settings management, quick configuration switching

#### Description
Allow users to save and load named configuration presets that can be applied to any domain. Presets capture all settings except domain-specific elements (like auto-navigate selectors).

#### Current Behavior
- No way to save/load configurations
- Cannot reuse settings across domains
- Must manually copy settings between domains
- Cannot share configurations

#### New Behavior

**Save Preset:**
- Select any domain configuration
- Click "Save as Preset"
- Enter preset name (e.g., "Manga Settings", "Novel Settings")
- Preset captures all settings except auto-navigate next button selector
- Preset saved to preset library

**Load Preset:**
- Select any domain configuration
- Click "Load Preset"
- Choose from saved presets
- Settings overwritten with preset values (except next button selector)
- Domain-specific next button selector preserved

**Preset Management:**
- Create, rename, delete presets
- Export presets to file (for backup/sharing)
- Import presets from file
- Preset library shows list of saved presets with names

**Preset Scope:**
Settings included in presets:
- Tap Navigation (layout, zones, scroll distance)
- Auto-Scrolling (speeds, delays, auto-start)
- Auto-Navigate (enable/disable, countdown delay, auto-start on new page)
- Advanced (text selection, screen wake, auto-stop)

Settings NOT included in presets:
- Auto-Navigate next button CSS selector (domain-specific)
- Domain name/URL (configuration remains for that domain)

#### Example Workflows

**Scenario 1: New manga site**
1. Add manga site to whitelist (inherits Default config)
2. Load "Manga Settings" preset
3. Customize next button selector for this specific manga site
4. Done - all other settings match your manga preferences

**Scenario 2: Create novel preset**
1. Configure settings on existing novel site
2. Save as preset: "Novel Settings"
3. Add new novel site to whitelist
4. Load "Novel Settings" preset
5. Configure next button selector
6. New novel site now has same settings as others

**Scenario 3: Share configuration**
1. Export "Manga Settings" preset to file
2. Share file with friend
3. Friend imports preset
4. Friend can apply manga settings to their domains

#### Benefits
- Quickly apply proven configurations to new domains
- Consistent settings across similar content types
- Backup and restore configurations
- Share configurations with others
- Experiment with settings without losing current config

#### User Value
"As a user who reads similar content on multiple sites, I want to save my configurations as named presets, so I can quickly apply the same settings to new sites without manually copying all the values."

---

### FEATURE-009: Simplified Auto-Navigate Configuration

**Affects**: Auto-navigate to next page feature

#### Description
Simplify auto-navigate configuration by removing redundant domain selection and showing only relevant configurations for the currently active domain.

#### Current Behavior (FEATURE-005)
- Auto-navigate shows configurations for all domains
- User must select domain when adding configuration
- List can become cluttered with many domains
- Not clear which configuration applies to current page

#### New Behavior
**Integrated with Per-Domain Config:**
- Auto-navigate next button selector is part of domain configuration
- When viewing a domain's settings, see its next button configuration
- No separate "Per-Site Configuration" list
- No domain selection needed - configuring current domain

**Configuration Location:**
Within each domain's settings section:
- Enable/disable auto-navigate for this domain
- Next button CSS selector for this domain
- Override countdown delay (or use default)
- Override auto-start setting (or use default)
- Selector testing tool (tests on current domain)

**Settings Page View:**
When editing a domain's configuration:
```
Domain: example-manga-site.com

[Tap Navigation Section]
[Auto-Scrolling Section]

[Auto-Navigate Section]
  ☑ Enable auto-navigate to next page
  Next Button Selector: a.next-chapter
  [Test Selector] button
  Countdown Delay: ○ Use default (3s) ● Override: [5] seconds
  Auto-start scrolling: ○ Use default (Yes) ● Override: No
```

#### Benefits
- Clearer which settings apply to which domain
- No redundant domain selection
- Simpler mental model - all settings in one place
- Less UI clutter
- Easier to configure next button for current site

#### User Value
"As a user configuring auto-navigate for a site, I want to see and edit the next button selector alongside all other settings for that domain, so I don't have to navigate to a separate section and search for my domain in a list."

---

## 🎨 UX Improvements

### UX-001: Toast Notification Layout Rework ✅

**Affects**: All toast notifications and UI overlays

#### Problem
Current toast notification layout is distracting during reading:
- Toasts appear at top of screen, masking text where eyes are focused
- Large blue countdown box in center of screen blocks content
- Element picker buttons appear at top and bottom, preventing interaction with page elements
- Multiple different styling themes across notification types

#### Solution
Redesigned notification system optimized for reading:

**Unified Theme:**
All notifications now use consistent dark gray background with white text

**New Positioning:**

1. **State Toasts** (status messages, speed changes)
   - Position: Bottom center
   - Doesn't mask reading area at top
   - Still visible but not intrusive

2. **Countdown Numbers** (auto-start, auto-navigate)
   - Position: Bottom right corner
   - Compact size matching other toasts
   - Out of the reading path, aligned with text flow

3. **Auto-Navigate Display**
   - Message toast: Bottom center (clickable to cancel)
   - Countdown number: Bottom right
   - Separate displays for clarity

4. **Element Picker UI**
   - Banner: Center of screen (smaller)
   - Cancel button: Center, just below banner
   - Top and bottom of screen remain clickable for page elements

#### Benefits
- Reading area at top remains clear and unobstructed
- Consistent visual theme across all notifications
- Better touch targets and interaction zones
- Reduced visual noise
- Mobile-optimized positioning

#### User Value
"As a reader, I want notifications to appear at the bottom of the screen in a consistent style, so they don't mask the text I'm reading at the top, and I can still interact with page elements."

---

### UX-002: Settings Page Layout with Collapsible Sections

**Affects**: Options/Settings page

#### Problem
Current settings page shows all options in a long scrollable list:
- Overwhelming for new users (15+ settings)
- Hard to find specific settings
- No logical grouping of related features
- Poor mobile experience with excessive scrolling
- Settings context not clear

#### Solution
Organize settings into collapsible sections by feature category:

**Section Organization:**

1. **🎯 Tap Navigation**
   - Enable tap navigation
   - Tap zone layout (horizontal/vertical)
   - Tap zone size (scroll-up percentage)
   - Tap scroll distance (percentage)
   - Visual zone preview

2. **🔄 Auto-Scrolling**
   - Enable autoscroll
   - Default speed
   - Minimum speed
   - Maximum speed
   - Speed adjustment granularity
   - Auto-start delay
   - Auto-start countdown

3. **🚀 Auto-Navigate**
   - Enable auto-navigate
   - Default countdown delay
   - Auto-start on new page
   - Per-site configuration list
   - Add new site configuration
   - Selector testing tool

4. **🌐 Whitelist**
   - Enabled sites list
   - Add/remove sites
   - Quick three-finger tap instructions

5. **⚙️ Advanced**
   - Disable text selection
   - Keep screen awake
   - Auto-stop at page bottom
   - Debug mode

**Features:**
- Click section headers to expand/collapse
- Smooth animations
- Section states persist across page reloads
- Icons for quick visual scanning

#### Benefits
- Improved discoverability of related settings
- Reduced cognitive load - see only what you need
- Better mobile experience with less scrolling
- Persistent state remembers your preferences
- Clearer feature scope and context

#### User Value
"As a user, I want settings organized into collapsible sections by feature category, so I can quickly find and configure specific features without being overwhelmed by all options at once."

---

## 📋 Summary

### Bug Fixes (5)
- FIX-001: Disable text selection during tap navigation
- FIX-002: Prevent duplicate taps during smooth scroll
- FIX-003: Keep screen active during autoscroll
- FIX-004: Stop autoscroll at page bottom
- FIX-005: Add text input fields for slider values

### New Features (9)
- FEATURE-001: Configurable tap scroll distance
- FEATURE-002: Vertical tap zones layout option
- FEATURE-003: Configurable tap zone sizes
- FEATURE-004: Visual tap zone preview
- FEATURE-005: Auto-navigate to next page
- FEATURE-006: Per-domain configuration
- FEATURE-007: Default configuration template
- FEATURE-008: Configuration presets
- FEATURE-009: Simplified auto-navigate configuration

### UX Improvements (2)
- UX-001: Toast notification layout rework ✅
- UX-002: Settings page collapsible sections

### Total Improvements: 16

---

**Document Version:** 2.0  
**Last Updated:** February 22, 2026

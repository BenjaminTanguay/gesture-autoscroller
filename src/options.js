// Gesture AutoScroller - Options Page Script
// Handles per-domain settings UI and storage with autosave

// Default configuration structure (per-domain)
const DEFAULT_CONFIG = {
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
  tapZoneUpPercentage: 50,    // Size of scroll-up zone (10-90%)
  
  // Auto-navigate settings (per-domain)
  autoNavigateEnabled: false,           // Enable/disable for this domain
  autoNavigateDelay: 3,                 // Seconds before clicking next (1-30)
  autoNavigateAutoStart: true,          // Auto-start scroll on new page
  navigationSelector: null              // { selector, enabled, delay, autoStart, notes } or null
};

// Current data in memory
let defaultConfig = { ...DEFAULT_CONFIG };
let domainConfigs = {};  // hostname -> config
let whitelist = [];      // array of whitelisted hostnames
let currentDomain = '__default__';  // Currently selected domain (__default__ or hostname)
let currentConfig = { ...DEFAULT_CONFIG };  // Config for currently selected domain
let presets = {};        // name -> config (presets library)

// Autosave debounce timer
let autosaveTimer = null;
const AUTOSAVE_DELAY = 500; // milliseconds

// Track if we are currently saving to prevent storage listener from reloading
let isSaving = false;
let saveTimestamp = 0; // Timestamp of last save to ignore immediate storage changes

// DOM elements
let elements = {};

// Toggle collapsible section
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.toggle('collapsed');
  }
}

// Setup collapsible section event listeners (no longer needed with tabs)
function setupCollapsibleSections() {
  // No collapsible sections in the new tab-based design
}

// Check for picked element in storage
async function checkForPickedElement() {
  try {
    console.log('Checking for picked element in storage...');
    const result = await browser.storage.local.get(['pickedElement', 'pickedElementTimestamp']);
    console.log('Storage result:', result);
    
    if (result.pickedElement && result.pickedElementTimestamp) {
      // Check if it's recent (within last 30 seconds)
      const age = Date.now() - result.pickedElementTimestamp;
      console.log('Picked element age (ms):', age);
      
      if (age < 30000) {
        console.log('Processing picked element:', result.pickedElement);
        // Process the picked element
        await handleElementPicked({
          action: 'elementPicked',
          elementInfo: result.pickedElement
        });
        
        // Clear from storage
        await browser.storage.local.remove(['pickedElement', 'pickedElementTimestamp']);
        console.log('Cleared picked element from storage');
        return true; // Found and processed a picked element
      } else {
        console.log('Picked element too old, ignoring');
        // Clear old picked element
        await browser.storage.local.remove(['pickedElement', 'pickedElementTimestamp']);
      }
    } else {
      console.log('No picked element in storage');
    }
    return false; // No picked element found
  } catch (error) {
    console.error('Error checking for picked element:', error);
    return false;
  }
}

// Initialize the options page
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== Options page DOMContentLoaded ===');
  
  // Cache DOM elements
  cacheElements();
  
  // Setup tab switching
  setupTabs();
  
  // Load settings from storage
  await loadSettings();
  
  // Check for picked element BEFORE auto-selecting domain
  // This ensures we switch to the correct domain if an element was picked
  const hasPickedElement = await checkForPickedElement();
  
  // Auto-select current tab's domain if whitelisted (only if no picked element)
  if (!hasPickedElement) {
    await autoSelectCurrentTabDomain();
  }
  
  // Update UI with loaded settings (may be updated again by handleElementPicked)
  updateUI();
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup preset listeners
  setupPresetListeners();
  
  // Setup domain selector sync across all tabs
  setupDomainSelectorSync();
  
  // Load current page info (if available)
  loadCurrentPageInfo();
  
  // Initialize auto-navigate feature (after settings are loaded)
  initAutoNavigate();
  
  // Listen for storage changes to update UI in real-time
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      // Only reload if changes were made from another tab/window
      // If we made the change ourselves, we've already updated the UI
      const timeSinceLastSave = Date.now() - saveTimestamp;
      if (isSaving || timeSinceLastSave < 500) {
        return;
      }
      
      // Reload configs if changed externally
      if (changes.gesture_autoscroller_domain_configs || 
          changes.gesture_autoscroller_default_config) {
        // Reload all settings
        await loadSettings();
        // Re-select current domain to get latest config (skip saving since we're reloading)
        if (currentDomain) {
          await switchDomain(currentDomain, true);
        }
      }
      
      // Reload whitelist if changed externally
      if (changes.gesture_autoscroller_whitelist) {
        const newWhitelist = changes.gesture_autoscroller_whitelist.newValue;
        if (newWhitelist) {
          whitelist = newWhitelist;
          updateDomainSelector();
          renderWhitelist();
          // Re-check domain selection when whitelist changes
          await autoSelectCurrentTabDomain();
          updateUI();
        }
      }
    }
  });
  
  // Listen for page visibility changes to update domain selection
  // This handles when user switches back to the settings tab
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      console.log('Settings page became visible, re-checking domain selection');
      await autoSelectCurrentTabDomain();
      updateUI();
    }
  });
  
  // Also listen for window focus events
  window.addEventListener('focus', async () => {
    console.log('Settings page gained focus, re-checking domain selection');
    await autoSelectCurrentTabDomain();
    updateUI();
  });
});

// Setup tab switching
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      button.classList.add('active');
      const targetContent = document.getElementById(tabName + 'Tab');
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// Cache all DOM elements
function cacheElements() {
  elements = {
    // Domain selectors (one per tab)
    domainSelector: document.getElementById('domainSelector'),
    domainSelector2: document.getElementById('domainSelector2'),
    domainSelector3: document.getElementById('domainSelector3'),
    domainSelector4: document.getElementById('domainSelector4'),
    domainSelector5: document.getElementById('domainSelector5'),
    
    // Feature toggles
    tapNavigationEnabled: document.getElementById('tapNavigationEnabled'),
    autoscrollEnabled: document.getElementById('autoscrollEnabled'),
    autoStartEnabled: document.getElementById('autoStartEnabled'),
    autoNavigateEnabled: document.getElementById('autoNavigateEnabled'),
    
    // Tap zone layout
    tapZoneLayoutHorizontal: document.getElementById('tapZoneLayoutHorizontal'),
    tapZoneLayoutVertical: document.getElementById('tapZoneLayoutVertical'),
    
    // Speed sliders
    defaultSpeed: document.getElementById('defaultSpeed'),
    minSpeed: document.getElementById('minSpeed'),
    maxSpeed: document.getElementById('maxSpeed'),
    granularity: document.getElementById('granularity'),
    autoStartDelay: document.getElementById('autoStartDelay'),
    tapScrollPercentage: document.getElementById('tapScrollPercentage'),
    tapZoneUpPercentage: document.getElementById('tapZoneUpPercentage'),
    
    // Speed value displays (removed - no longer needed)
    
    // Speed input fields
    defaultSpeedInput: document.getElementById('defaultSpeedInput'),
    minSpeedInput: document.getElementById('minSpeedInput'),
    maxSpeedInput: document.getElementById('maxSpeedInput'),
    granularityInput: document.getElementById('granularityInput'),
    autoStartDelayInput: document.getElementById('autoStartDelayInput'),
    tapScrollPercentageInput: document.getElementById('tapScrollPercentageInput'),
    tapZoneUpPercentageInput: document.getElementById('tapZoneUpPercentageInput'),
    
    // Zone preview elements
    zoneSplitPreview: document.getElementById('zoneSplitPreview'),
    zoneSplitDescription: document.getElementById('zoneSplitDescription'),
    
    // Sections
    autoStartSection: document.getElementById('autoStartSection'),
    
    // Whitelist
    whitelistList: document.getElementById('whitelistList'),
    hostInput: document.getElementById('hostInput'),
    btnAddHost: document.getElementById('btnAddHost'),
    
    // Current page
    currentPageSection: document.getElementById('currentPageSection'),
    currentPageHost: document.getElementById('currentPageHost'),
    currentPageStatus: document.getElementById('currentPageStatus'),
    btnAddCurrent: document.getElementById('btnAddCurrent'),
    
    // Status
    statusMessage: document.getElementById('statusMessage')
  };
}

// Load all configurations from browser storage
async function loadSettings() {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'getSettings'  // Will call getAllConfigs() since no host is provided
    });
    
    if (response && response.success) {
      defaultConfig = response.defaultConfig || { ...DEFAULT_CONFIG };
      domainConfigs = response.domainConfigs || {};
      whitelist = response.whitelist || [];
      
      // Set current config to default initially
      currentDomain = '__default__';
      currentConfig = { ...defaultConfig };
      
      // Update domain selector dropdown
      updateDomainSelector();
    } else {
      // No settings found or error, use defaults
      defaultConfig = { ...DEFAULT_CONFIG };
      domainConfigs = {};
      whitelist = [];
      currentConfig = { ...DEFAULT_CONFIG };
    }
    
    // Load presets
    await loadPresets();
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatusMessage('Failed to load settings', 'error');
  }
}

// Auto-select current tab's domain if it's whitelisted
async function autoSelectCurrentTabDomain() {
  try {
    console.log('=== Auto-selecting current tab domain ===');
    console.log('Current whitelist:', whitelist);
    console.log('Timestamp:', new Date().toISOString());
    
    // Strategy 1: Ask background script for the last active tab (most reliable)
    try {
      const response = await browser.runtime.sendMessage({ action: 'getLastActiveTab' });
      console.log('Last active tab from background:', response);
      
      if (response && response.success && response.tabInfo) {
        const tabInfo = response.tabInfo;
        const host = tabInfo.hostname;
        const whitelistedHost = findWhitelistedHost(host);
        
        console.log('Found whitelisted host from background tracker:', whitelistedHost);
        if (whitelistedHost) {
          await switchToDomain(whitelistedHost);
          console.log('Switched to domain:', whitelistedHost);
          return;
        } else {
          // Host exists but not whitelisted - switch to default
          console.log('Last active tab is not whitelisted, switching to default');
          await switchToDomain('__default__');
          return;
        }
      }
    } catch (e) {
      console.log('Could not get last active tab from background:', e);
    }
    
    // Strategy 2: Try to get the opener tab (tab that opened this options page)
    const currentTab = await browser.tabs.getCurrent();
    console.log('Current tab:', currentTab);
    
    if (currentTab && currentTab.openerTabId) {
      try {
        const openerTab = await browser.tabs.get(currentTab.openerTabId);
        console.log('Opener tab:', openerTab);
        if (openerTab && openerTab.url) {
          const url = new URL(openerTab.url);
          console.log('Opener tab URL:', url.href, 'hostname:', url.hostname);
          // Skip extension and special URLs
          if (!url.protocol.startsWith('moz-extension') && 
              !url.protocol.startsWith('about') &&
              !url.protocol.startsWith('chrome')) {
            const host = url.hostname;
            const whitelistedHost = findWhitelistedHost(host);
            console.log('Found whitelisted host from opener:', whitelistedHost);
            if (whitelistedHost) {
              await switchToDomain(whitelistedHost);
              console.log('Switched to domain:', whitelistedHost);
              return;
            } else {
              console.log('Opener tab is not whitelisted, switching to default');
              await switchToDomain('__default__');
              return;
            }
          }
        }
      } catch (e) {
        console.log('Could not get opener tab:', e);
      }
    }
    
    // Strategy 3: Find the most recently accessed non-settings tab (fallback)
    console.log('Trying strategy 3: finding most recent tab with lastAccessed');
    const allTabs = await browser.tabs.query({});
    console.log('All tabs count:', allTabs.length);
    
    // Get current tab ID to exclude it
    const settingsTabId = currentTab ? currentTab.id : null;
    
    // Filter and sort tabs by lastAccessed
    const candidateTabs = allTabs
      .filter(tab => {
        try {
          // Skip the settings tab itself
          if (settingsTabId && tab.id === settingsTabId) return false;
          
          if (!tab.url) return false;
          const url = new URL(tab.url);
          
          // Only include http/https tabs
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (e) {
          return false;
        }
      })
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    
    console.log('Candidate tabs (sorted by lastAccessed):', candidateTabs.map(t => ({
      url: t.url,
      lastAccessed: t.lastAccessed,
      id: t.id
    })));
    
    // Try to find a whitelisted tab, checking in order of most recently accessed
    for (const tab of candidateTabs) {
      const url = new URL(tab.url);
      const host = url.hostname;
      const whitelistedHost = findWhitelistedHost(host);
      
      if (whitelistedHost) {
        console.log('Found whitelisted host:', whitelistedHost, 'from tab:', tab.url);
        await switchToDomain(whitelistedHost);
        return;
      }
    }
    
    // If we found tabs but none were whitelisted
    if (candidateTabs.length > 0) {
      console.log('Found tabs but none are whitelisted, switching to default');
    }
    
    console.log('No whitelisted domain found, switching to default');
    // Switch to default if no whitelisted domain was found
    await switchToDomain('__default__');
    
  } catch (error) {
    // If there's an error, just stay with default selection
    console.log('Could not auto-select domain:', error);
    await switchToDomain('__default__');
  }
}

// Helper: Find the whitelisted hostname for a given host
function findWhitelistedHost(host) {
  if (!host) return null;
  
  // Check if this host is whitelisted
  if (!isHostWhitelisted(host)) return null;
  
  // Find the exact whitelisted hostname (could be parent domain)
  return whitelist.find(whitelistedHost => {
    // Exact match
    if (host === whitelistedHost) return true;
    // Subdomain match
    if (host.endsWith('.' + whitelistedHost)) return true;
    return false;
  });
}

// Helper: Switch to a domain's configuration
async function switchToDomain(hostname) {
  console.log('Switching to domain:', hostname);
  currentDomain = hostname;
  
  // Get the appropriate config
  if (hostname === '__default__') {
    currentConfig = { ...defaultConfig };
  } else {
    currentConfig = domainConfigs[hostname] || { ...defaultConfig };
  }
  
  // Update all dropdowns to reflect the selection
  const selectors = [
    elements.domainSelector,
    elements.domainSelector2,
    elements.domainSelector3,
    elements.domainSelector4,
    elements.domainSelector5
  ].filter(s => s);
  
  selectors.forEach(selector => {
    selector.value = hostname;
  });
  
  console.log('Current domain is now:', currentDomain);
}

// Setup domain selector synchronization across all tabs
function setupDomainSelectorSync() {
  const selectors = [
    elements.domainSelector,
    elements.domainSelector2,
    elements.domainSelector3,
    elements.domainSelector4,
    elements.domainSelector5
  ].filter(s => s);  // Filter out null/undefined
  
  selectors.forEach(selector => {
    selector.addEventListener('change', async (e) => {
      const newDomain = e.target.value;
      await switchDomain(newDomain);
      updateUI();
      // Sync all other selectors
      selectors.forEach(s => {
        if (s !== selector) s.value = newDomain;
      });
    });
  });
}

// Update domain selector dropdown with available domains
function updateDomainSelector() {
  const selectors = [
    elements.domainSelector,
    elements.domainSelector2,
    elements.domainSelector3,
    elements.domainSelector4,
    elements.domainSelector5
  ].filter(s => s);  // Filter out null/undefined
  
  selectors.forEach(selector => {
    // Clear existing options except default
    selector.innerHTML = '<option value="__default__">Default</option>';
    
    // Add whitelisted domains
    whitelist.forEach(hostname => {
      const option = document.createElement('option');
      option.value = hostname;
      option.textContent = hostname;
      selector.appendChild(option);
    });
    
    // Set selected value
    selector.value = currentDomain;
  });
}

// Update UI with current configuration
function updateUI() {
  // Feature toggles
  elements.tapNavigationEnabled.checked = currentConfig.tapNavigationEnabled;
  elements.autoscrollEnabled.checked = currentConfig.autoscrollEnabled;
  elements.autoStartEnabled.checked = currentConfig.autoStartEnabled;
  
  // Tap zone layout
  if (currentConfig.tapZoneLayout === 'horizontal') {
    elements.tapZoneLayoutHorizontal.checked = true;
  } else {
    elements.tapZoneLayoutVertical.checked = true;
  }
  
  // Speed settings - update both sliders and inputs
  elements.defaultSpeed.value = currentConfig.defaultSpeed;
  if (elements.defaultSpeedInput) elements.defaultSpeedInput.value = currentConfig.defaultSpeed;
  
  elements.minSpeed.value = currentConfig.minSpeed;
  if (elements.minSpeedInput) elements.minSpeedInput.value = currentConfig.minSpeed;
  
  elements.maxSpeed.value = currentConfig.maxSpeed;
  if (elements.maxSpeedInput) elements.maxSpeedInput.value = currentConfig.maxSpeed;
  
  elements.granularity.value = currentConfig.granularity;
  if (elements.granularityInput) elements.granularityInput.value = currentConfig.granularity;
  
  elements.autoStartDelay.value = currentConfig.autoStartDelay;
  if (elements.autoStartDelayInput) elements.autoStartDelayInput.value = currentConfig.autoStartDelay;
  
  elements.tapScrollPercentage.value = currentConfig.tapScrollPercentage;
  if (elements.tapScrollPercentageInput) elements.tapScrollPercentageInput.value = currentConfig.tapScrollPercentage;
  
  elements.tapZoneUpPercentage.value = currentConfig.tapZoneUpPercentage;
  if (elements.tapZoneUpPercentageInput) elements.tapZoneUpPercentageInput.value = currentConfig.tapZoneUpPercentage;
  
  // Update zone split preview
  updateZoneSplitPreview();
  
  // Show/hide auto-start section based on checkbox
  updateAutoStartSectionVisibility();
  
  // Auto-navigate settings
  const autoNavigateEnabled = document.getElementById('autoNavigateEnabled');
  const autoNavigateDelay = document.getElementById('autoNavigateDelay');
  const autoNavigateDelayValue = document.getElementById('autoNavigateDelayValue');
  const autoNavigateAutoStart = document.getElementById('autoNavigateAutoStart');
  
  if (autoNavigateEnabled) autoNavigateEnabled.checked = currentConfig.autoNavigateEnabled;
  if (autoNavigateDelay) autoNavigateDelay.value = currentConfig.autoNavigateDelay;
  if (autoNavigateDelayValue) autoNavigateDelayValue.value = currentConfig.autoNavigateDelay;
  if (autoNavigateAutoStart) autoNavigateAutoStart.checked = currentConfig.autoNavigateAutoStart;
  
  // Render navigation selector (per-domain)
  renderNavigationSelector();
  
  // Whitelist
  renderWhitelist();
}

// Setup slider-input synchronization
function setupSliderSync(sliderElementKey, inputElementKey) {
  const slider = elements[sliderElementKey];
  const input = elements[inputElementKey];
  
  if (!slider || !input) {
    console.warn(`Slider sync failed: slider=${sliderElementKey}, input=${inputElementKey}`);
    return;
  }
  
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

// Update auto-start section visibility
function updateAutoStartSectionVisibility() {
  if (elements.autoStartSection) {
    elements.autoStartSection.style.display = 
      elements.autoStartEnabled.checked ? 'block' : 'none';
  }
}

// Switch to a different domain's configuration
async function switchDomain(hostname, skipSave = false) {
  // Save current config before switching (unless explicitly skipped)
  if (!skipSave && currentDomain) {
    await saveCurrentConfig();
  }
  
  // Update current domain
  currentDomain = hostname;
  
  // Load config for new domain
  if (hostname === '__default__') {
    currentConfig = { ...defaultConfig };
  } else {
    currentConfig = domainConfigs[hostname] || { ...defaultConfig };
  }
  
  // Update UI
  updateUI();
}

// Render whitelist
function renderWhitelist() {
  const list = elements.whitelistList;
  
  if (!whitelist || whitelist.length === 0) {
    list.innerHTML = '<div class="whitelist-empty">No sites added yet. Add your favorite reading sites below.</div>';
    return;
  }
  
  list.innerHTML = '';
  
  whitelist.forEach((host, index) => {
    const item = document.createElement('div');
    item.className = 'whitelist-item';
    
    const hostSpan = document.createElement('span');
    hostSpan.className = 'whitelist-item-host';
    hostSpan.textContent = host;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'whitelist-item-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeHost(host);
    
    item.appendChild(hostSpan);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Domain selectors are set up in setupDomainSelectorSync()
  
  // Setup slider-input synchronization (pass element keys from elements object)
  setupSliderSync('defaultSpeed', 'defaultSpeedInput');
  setupSliderSync('minSpeed', 'minSpeedInput');
  setupSliderSync('maxSpeed', 'maxSpeedInput');
  setupSliderSync('granularity', 'granularityInput');
  setupSliderSync('autoStartDelay', 'autoStartDelayInput');
  setupSliderSync('tapScrollPercentage', 'tapScrollPercentageInput');
  setupSliderSync('tapZoneUpPercentage', 'tapZoneUpPercentageInput');
  
  // Feature toggles - autosave on change
  elements.tapNavigationEnabled.addEventListener('change', () => {
    autoSaveSettings();
  });
  
  elements.autoscrollEnabled.addEventListener('change', () => {
    autoSaveSettings();
  });
  
  elements.autoStartEnabled.addEventListener('change', () => {
    updateAutoStartSectionVisibility();
    autoSaveSettings();
  });
  
  if (elements.autoNavigateEnabled) {
    elements.autoNavigateEnabled.addEventListener('change', () => {
      autoSaveSettings();
    });
  }
  
  // Tap zone layout - autosave on change and update preview
  elements.tapZoneLayoutHorizontal.addEventListener('change', () => {
    updateZoneSplitPreview();
    autoSaveSettings();
  });
  
  elements.tapZoneLayoutVertical.addEventListener('change', () => {
    updateZoneSplitPreview();
    autoSaveSettings();
  });
  
  // Tap zone size - update preview and autosave
  elements.tapZoneUpPercentage.addEventListener('input', () => {
    updateZoneSplitPreview();
    debouncedAutoSave();
  });
  
  // Speed sliders - autosave with debounce
  elements.defaultSpeed.addEventListener('input', () => {
    debouncedAutoSave();
  });
  
  elements.minSpeed.addEventListener('input', () => {
    debouncedAutoSave();
  });
  
  elements.maxSpeed.addEventListener('input', () => {
    debouncedAutoSave();
  });
  
  elements.granularity.addEventListener('input', () => {
    debouncedAutoSave();
  });
  
  elements.autoStartDelay.addEventListener('input', () => {
    debouncedAutoSave();
  });
  
  elements.tapScrollPercentage.addEventListener('input', () => {
    debouncedAutoSave();
  });
  
  // Speed inputs - autosave with debounce (with null checks)
  if (elements.defaultSpeedInput) {
    elements.defaultSpeedInput.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  if (elements.minSpeedInput) {
    elements.minSpeedInput.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  if (elements.maxSpeedInput) {
    elements.maxSpeedInput.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  if (elements.granularityInput) {
    elements.granularityInput.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  if (elements.autoStartDelayInput) {
    elements.autoStartDelayInput.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  if (elements.tapScrollPercentageInput) {
    elements.tapScrollPercentageInput.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  if (elements.tapZoneUpPercentageInput) {
    elements.tapZoneUpPercentageInput.addEventListener('input', () => {
      updateZoneSplitPreview();
      debouncedAutoSave();
    });
  }
  
  // Add host button
  elements.btnAddHost.addEventListener('click', addHost);
  
  // Enter key in host input
  elements.hostInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addHost();
    }
  });
  
  // Add current site button
  elements.btnAddCurrent.addEventListener('click', addCurrentSite);
}

// Add host to whitelist
async function addHost() {
  const input = elements.hostInput;
  const host = input.value.trim().toLowerCase();
  
  if (!host) {
    showStatusMessage('Please enter a host name', 'error');
    return;
  }
  
  // Basic validation
  if (!isValidHost(host)) {
    showStatusMessage('Invalid host name. Use format: example.com', 'error');
    return;
  }
  
  // Check for duplicates
  if (whitelist.includes(host)) {
    showStatusMessage('Host already in whitelist', 'error');
    return;
  }
  
  try {
    // Set flag to prevent storage listener from reloading
    isSaving = true;
    saveTimestamp = Date.now();
    
    try {
      // Add to whitelist via background script
      const response = await browser.runtime.sendMessage({
        action: 'addToWhitelist',
        hostname: host
      });
      
      if (response && response.success) {
        // Update local state
        whitelist.push(host);
        whitelist.sort();
        
        // Add domain config for new host (copy from default)
        if (!domainConfigs[host]) {
          domainConfigs[host] = { ...defaultConfig };
        }
        
        // Update UI
        updateDomainSelector();
        renderWhitelist();
        input.value = '';
        
        // Update current page status if it matches
        updateCurrentPageStatus();
        
        showStatusMessage(`Added ${host}`, 'success');
      } else {
        showStatusMessage('Failed to add host', 'error');
      }
    } finally {
      // Clear flag after storage operations complete
      setTimeout(() => {
        isSaving = false;
      }, 100);
    }
  } catch (error) {
    console.error('Failed to add host:', error);
    showStatusMessage('Failed to add host', 'error');
    isSaving = false;
  }
}

// Remove host from whitelist
async function removeHost(host) {
  try {
    // Set flag to prevent storage listener from reloading
    isSaving = true;
    saveTimestamp = Date.now();
    
    try {
      const response = await browser.runtime.sendMessage({
        action: 'removeFromWhitelist',
        hostname: host
      });
      
      if (response && response.success) {
        // Update local state
        whitelist = whitelist.filter(h => h !== host);
        
        // Update UI
        updateDomainSelector();
        renderWhitelist();
        
        // Update current page status
        updateCurrentPageStatus();
        
        // If we're currently viewing this domain's config, switch to default
        if (currentDomain === host) {
          elements.domainSelector.value = '__default__';
          await switchDomain('__default__');
        }
        
        showStatusMessage(`Removed ${host}`, 'success');
      } else {
        showStatusMessage('Failed to remove host', 'error');
      }
    } finally {
      // Clear flag after storage operations complete
      setTimeout(() => {
        isSaving = false;
      }, 100);
    }
  } catch (error) {
    console.error('Failed to remove host:', error);
    showStatusMessage('Failed to remove host', 'error');
    isSaving = false;
  }
}

// Validate host format
function isValidHost(host) {
  // Basic validation: should look like a domain
  // Allow alphanumeric, dots, hyphens
  const hostRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
  return hostRegex.test(host);
}

// Load current page info
async function loadCurrentPageInfo() {
  try {
    // Query active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    
    if (tabs && tabs.length > 0) {
      const url = new URL(tabs[0].url);
      const host = url.hostname;
      
      // Show current page section
      elements.currentPageSection.style.display = 'block';
      elements.currentPageHost.textContent = host;
      
      // Update status
      updateCurrentPageStatus(host);
    }
  } catch (error) {
    // Hide current page section if there's an error
    elements.currentPageSection.style.display = 'none';
  }
}

// Update current page status
function updateCurrentPageStatus(host = null) {
  if (!host) {
    host = elements.currentPageHost.textContent;
  }
  
  const isWhitelisted = isHostWhitelisted(host);
  
  if (isWhitelisted) {
    elements.currentPageStatus.textContent = 'Status: Active (whitelisted)';
    elements.currentPageStatus.className = 'current-page-status active';
    elements.btnAddCurrent.disabled = true;
    elements.btnAddCurrent.textContent = 'Already in whitelist';
  } else {
    elements.currentPageStatus.textContent = 'Status: Not whitelisted';
    elements.currentPageStatus.className = 'current-page-status inactive';
    elements.btnAddCurrent.disabled = false;
    elements.btnAddCurrent.textContent = 'Add current site to whitelist';
  }
}

// Check if host is whitelisted
function isHostWhitelisted(host) {
  return whitelist.some(whitelistedHost => {
    // Exact match
    if (host === whitelistedHost) return true;
    
    // Subdomain match (e.g., "example.com" matches "www.example.com")
    if (host.endsWith('.' + whitelistedHost)) return true;
    
    return false;
  });
}

// Render navigation selector for current domain
function renderNavigationSelector() {
  const navSiteSelector = document.getElementById('navSiteSelector');
  const navSiteNotes = document.getElementById('navSiteNotes');
  
  console.log('renderNavigationSelector called');
  console.log('  navSiteSelector element:', !!navSiteSelector);
  console.log('  navSiteNotes element:', !!navSiteNotes);
  console.log('  currentConfig.navigationSelector:', currentConfig.navigationSelector);
  
  if (!navSiteSelector || !navSiteNotes) {
    console.log('  Skipping - elements not found');
    return;
  }
  
  // Get navigation selector for current config
  const selector = currentConfig.navigationSelector;
  
  if (selector) {
    navSiteSelector.value = selector.selector || '';
    navSiteNotes.value = selector.notes || '';
    console.log('  Set selector to:', navSiteSelector.value);
    console.log('  Set notes to:', navSiteNotes.value);
  } else {
    navSiteSelector.value = '';
    navSiteNotes.value = '';
    console.log('  No selector in config, cleared fields');
  }
}

// Add current site to whitelist
async function addCurrentSite() {
  const host = elements.currentPageHost.textContent;
  
  if (isHostWhitelisted(host)) {
    showStatusMessage('Site already in whitelist', 'error');
    return;
  }
  
  try {
    // Set flag to prevent storage listener from reloading
    isSaving = true;
    saveTimestamp = Date.now();
    
    try {
      // Add to whitelist via background script
      const response = await browser.runtime.sendMessage({
        action: 'addToWhitelist',
        hostname: host
      });
      
      if (response && response.success) {
        // Update local state
        whitelist.push(host);
        whitelist.sort();
        
        // Add domain config for new host (copy from default)
        if (!domainConfigs[host]) {
          domainConfigs[host] = { ...defaultConfig };
        }
        
        // Update UI
        updateDomainSelector();
        renderWhitelist();
        updateCurrentPageStatus(host);
        
        showStatusMessage(`Added ${host}`, 'success');
      } else {
        showStatusMessage('Failed to add site', 'error');
      }
    } finally {
      // Clear flag after storage operations complete
      setTimeout(() => {
        isSaving = false;
      }, 100);
    }
  } catch (error) {
    console.error('Failed to add site:', error);
    showStatusMessage('Failed to add site', 'error');
    isSaving = false;
  }
}

// Update zone split preview
function updateZoneSplitPreview() {
  if (!elements.zoneSplitPreview || !elements.zoneSplitDescription) {
    return;
  }
  
  const upPercentage = parseInt(elements.tapZoneUpPercentage.value);
  const downPercentage = 100 - upPercentage;
  const layout = elements.tapZoneLayoutHorizontal.checked ? 'horizontal' : 'vertical';
  
  elements.zoneSplitPreview.innerHTML = `
    <div class="zone-split-container ${layout}">
      <div class="zone up-zone" style="${layout === 'vertical' ? 'height' : 'width'}: ${upPercentage}%">
        UP<br>${upPercentage}%
      </div>
      <div class="zone down-zone" style="${layout === 'vertical' ? 'height' : 'width'}: ${downPercentage}%">
        DOWN<br>${downPercentage}%
      </div>
    </div>
  `;
  
  elements.zoneSplitDescription.textContent = 
    `Scroll-up: ${upPercentage}%, Scroll-down: ${downPercentage}%`;
}

// Debounced autosave for sliders (prevents saving too frequently)
function debouncedAutoSave() {
  // Clear existing timer
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
  }
  
  // Set new timer
  autosaveTimer = setTimeout(() => {
    autoSaveSettings();
  }, AUTOSAVE_DELAY);
}

// Save current configuration
async function saveCurrentConfig() {
  try {
    // Read current values from UI
    const config = readConfigFromUI();
    
    // Validate speed settings silently
    if (config.minSpeed > config.defaultSpeed) {
      return; // Don't save, speeds are invalid
    }
    
    if (config.defaultSpeed > config.maxSpeed) {
      return; // Don't save, speeds are invalid
    }
    
    if (config.minSpeed >= config.maxSpeed) {
      return; // Don't save, speeds are invalid
    }
    
    // Update current config in memory
    currentConfig = config;
    
    // Set flag to prevent storage listener from reloading
    isSaving = true;
    saveTimestamp = Date.now();
    
    try {
      // Save to appropriate location
      if (currentDomain === '__default__') {
        // Save as default config
        const response = await browser.runtime.sendMessage({
          action: 'saveDefaultConfig',
          config: config
        });
        
        if (response && response.success) {
          defaultConfig = { ...config };
          showStatusMessage('Saved', 'success');
        }
      } else {
        // Save as domain-specific config
        const response = await browser.runtime.sendMessage({
          action: 'saveDomainConfig',
          hostname: currentDomain,
          config: config
        });
        
        if (response && response.success) {
          domainConfigs[currentDomain] = { ...config };
          showStatusMessage('Saved', 'success');
        }
      }
    } finally {
      // Always clear the flag after save completes
      setTimeout(() => {
        isSaving = false;
      }, 100);
    }
    
  } catch (error) {
    console.error('Failed to save config:', error);
    isSaving = false;
  }
}

// Read configuration from UI elements
function readConfigFromUI() {
  // Check if input elements exist, otherwise fall back to sliders
  const autoStartDelay = elements.autoStartDelayInput ? 
    parseFloat(elements.autoStartDelayInput.value) : 
    parseFloat(elements.autoStartDelay.value);
  
  const defaultSpeed = elements.defaultSpeedInput ? 
    parseFloat(elements.defaultSpeedInput.value) : 
    parseFloat(elements.defaultSpeed.value);
  
  const minSpeed = elements.minSpeedInput ? 
    parseFloat(elements.minSpeedInput.value) : 
    parseFloat(elements.minSpeed.value);
  
  const maxSpeed = elements.maxSpeedInput ? 
    parseFloat(elements.maxSpeedInput.value) : 
    parseFloat(elements.maxSpeed.value);
  
  const granularity = elements.granularityInput ? 
    parseFloat(elements.granularityInput.value) : 
    parseFloat(elements.granularity.value);
  
  const tapScrollPercentage = elements.tapScrollPercentageInput ? 
    parseFloat(elements.tapScrollPercentageInput.value) : 
    parseFloat(elements.tapScrollPercentage.value);
  
  const tapZoneUpPercentage = elements.tapZoneUpPercentageInput ? 
    parseFloat(elements.tapZoneUpPercentageInput.value) : 
    parseFloat(elements.tapZoneUpPercentage.value);
  
  // Get tap zone layout
  const tapZoneLayout = elements.tapZoneLayoutHorizontal.checked ? 'horizontal' : 'vertical';
  
  // Get auto-navigate settings
  const autoNavigateEnabled = document.getElementById('autoNavigateEnabled');
  const autoNavigateDelay = document.getElementById('autoNavigateDelayValue') || document.getElementById('autoNavigateDelay');
  const autoNavigateAutoStart = document.getElementById('autoNavigateAutoStart');
  
  // Get navigation selector
  const navSiteSelector = document.getElementById('navSiteSelector');
  const navSiteNotes = document.getElementById('navSiteNotes');
  
  let navigationSelector = null;
  
  // Update navigation selector if fields have values
  if (navSiteSelector && navSiteSelector.value.trim()) {
    navigationSelector = {
      selector: navSiteSelector.value.trim(),
      enabled: true,
      delay: autoNavigateDelay ? parseFloat(autoNavigateDelay.value) : 3,
      autoStart: autoNavigateAutoStart ? autoNavigateAutoStart.checked : true,
      notes: navSiteNotes ? navSiteNotes.value.trim() : ''
    };
  }
  
  return {
    tapNavigationEnabled: elements.tapNavigationEnabled.checked,
    autoscrollEnabled: elements.autoscrollEnabled.checked,
    autoStartEnabled: elements.autoStartEnabled.checked,
    autoStartDelay: autoStartDelay,
    defaultSpeed: defaultSpeed,
    minSpeed: minSpeed,
    maxSpeed: maxSpeed,
    granularity: granularity,
    tapScrollPercentage: tapScrollPercentage,
    tapZoneLayout: tapZoneLayout,
    tapZoneUpPercentage: tapZoneUpPercentage,
    autoNavigateEnabled: autoNavigateEnabled ? autoNavigateEnabled.checked : currentConfig.autoNavigateEnabled,
    autoNavigateDelay: autoNavigateDelay ? parseFloat(autoNavigateDelay.value) : currentConfig.autoNavigateDelay,
    autoNavigateAutoStart: autoNavigateAutoStart ? autoNavigateAutoStart.checked : currentConfig.autoNavigateAutoStart,
    navigationSelector: navigationSelector
  };
}

// Auto-save settings (debounced wrapper for saveCurrentConfig)
async function autoSaveSettings() {
  await saveCurrentConfig();
}

// Save settings (kept for compatibility, but now just calls autoSave)
async function saveSettings() {
  await autoSaveSettings();
}

// Notify content scripts that settings have changed
async function notifyContentScripts() {
  try {
    const tabs = await browser.tabs.query({});
    
    for (const tab of tabs) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          settings: currentSettings
        });
      } catch (error) {
        // Tab might not have content script loaded, ignore
      }
    }
  } catch (error) {
    // Could not notify content scripts
  }
}

// Show status message
function showStatusMessage(message, type = 'success', duration = 2000) {
  const statusEl = elements.statusMessage;
  statusEl.textContent = message;
  statusEl.className = `status-message ${type} show`;
  
  // Auto-hide after duration
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, duration);
}

// ============================================================================
// AUTO-NAVIGATE FEATURE
// ============================================================================

// Initialize auto-navigate feature
function initAutoNavigate() {
  // Check URL parameters for pre-filled selector info (from right-click context menu)
  const urlParams = new URLSearchParams(window.location.search);
  const selector = urlParams.get('selector');
  const hostname = urlParams.get('hostname');
  
  if (selector && hostname) {
    console.log('=== URL parameters detected (right-click method) ===');
    console.log('Selector:', selector);
    console.log('Hostname:', hostname);
    
    // Use the same handleElementPicked flow for consistency
    handleElementPicked({
      action: 'elementPicked',
      elementInfo: {
        selector: selector,
        hostname: hostname
      }
    }).then(() => {
      console.log('URL parameters processed successfully');
      // Clear the URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }).catch(error => {
      console.error('Failed to process URL parameters:', error);
      showStatusMessage('Error processing selector from right-click', 'error');
    });
  }
  
  // Cache auto-navigate elements
  const autoNavigateElements = {
    enabled: document.getElementById('autoNavigateEnabled'),
    delay: document.getElementById('autoNavigateDelay'),
    delayValue: document.getElementById('autoNavigateDelayValue'),
    autoStart: document.getElementById('autoNavigateAutoStart'),
    navSiteSelector: document.getElementById('navSiteSelector'),
    navSiteNotes: document.getElementById('navSiteNotes'),
    testSelector: document.getElementById('testSelector'),
    testResult: document.getElementById('testResult')
  };
  
  // Setup slider sync for auto-navigate delay
  setupSliderSync('autoNavigateDelay', 'autoNavigateDelayValue');
  
  // Event listeners for auto-navigate settings
  if (autoNavigateElements.enabled) {
    autoNavigateElements.enabled.addEventListener('change', () => {
      autoSaveSettings();
    });
  }
  
  if (autoNavigateElements.delay) {
    autoNavigateElements.delay.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  if (autoNavigateElements.delayValue) {
    autoNavigateElements.delayValue.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  if (autoNavigateElements.autoStart) {
    autoNavigateElements.autoStart.addEventListener('change', () => {
      autoSaveSettings();
    });
  }
  
  // Selector changes trigger autosave
  if (autoNavigateElements.navSiteSelector) {
    autoNavigateElements.navSiteSelector.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  if (autoNavigateElements.navSiteNotes) {
    autoNavigateElements.navSiteNotes.addEventListener('input', () => {
      debouncedAutoSave();
    });
  }
  
  // Save selector button
  const btnSaveSelector = document.getElementById('btnSaveSelector');
  if (btnSaveSelector) {
    btnSaveSelector.addEventListener('click', async () => {
      await saveCurrentConfig();
      showStatusMessage('Selector saved successfully!', 'success');
    });
  }
  
  // Test selector button
  if (autoNavigateElements.testSelector) {
    autoNavigateElements.testSelector.addEventListener('click', async () => {
      const selector = autoNavigateElements.navSiteSelector.value.trim();
      
      if (!selector) {
        showTestResult('Please enter a CSS selector to test', 'error');
        return;
      }
      
      try {
        // Get active tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          showTestResult('No active tab found', 'error');
          return;
        }
        
        // Send test message to content script
        const response = await browser.tabs.sendMessage(tabs[0].id, {
          action: 'testSelector',
          selector: selector
        });
        
        if (response.success) {
          if (response.count === 0) {
            showTestResult('Selector is valid but found no matching elements on current page', 'error');
          } else if (response.count === 1) {
            const match = response.matches[0];
            showTestResult(
              `✓ Found 1 match: <${match.tagName}> "${match.text || 'No text'}"${match.href ? ' → ' + match.href : ''}`,
              'success'
            );
          } else {
            showTestResult(
              `⚠ Found ${response.count} matches. Consider making the selector more specific to target only the "Next" button.`,
              'success'
            );
          }
        } else {
          showTestResult(response.error || 'Failed to test selector', 'error');
        }
      } catch (error) {
        showTestResult(`Error: ${error.message}`, 'error');
      }
    });
  }
  
  // Navigation selector is rendered as part of updateUI()
  
  // Setup element picker button
  const activateElementPicker = document.getElementById('activateElementPicker');
  if (activateElementPicker) {
    activateElementPicker.addEventListener('click', async () => {
      try {
        // Simply store a flag in background that we're waiting for an element
        // We don't need to store the tab ID - the background script will handle returning
        const response = await browser.runtime.sendMessage({
          action: 'startElementPicking'
        });
        
        // Get all tabs to activate picker on them
        const allTabs = await browser.tabs.query({});
        
        // Find non-options tabs
        const websiteTabs = allTabs.filter(t => 
          t.url && 
          t.url.startsWith('http') && 
          !t.url.includes('options.html') &&
          !t.url.includes('about:') &&
          !t.url.includes('moz-extension:')
        );
        
        if (websiteTabs.length === 0) {
          showStatusMessage('Please open a website in another tab first', 'error');
          return;
        }
        
        // Activate picker on ALL website tabs
        let activatedCount = 0;
        for (const tab of websiteTabs) {
          try {
            const response = await browser.tabs.sendMessage(tab.id, {
              action: 'activateElementPicker'
            });
            if (response && response.success) {
              activatedCount++;
            }
          } catch (error) {
          }
        }
        
        if (activatedCount === 0) {
          showStatusMessage('Could not activate picker. Try refreshing the website page and try again.', 'error', 5000);
        } else {
          showStatusMessage(`Picker activated on ${activatedCount} tab(s)! Switch to a website tab, tap the Next button, then come back here.`, 'success', 5000);
        }
        
      } catch (error) {
        console.error('Failed to activate element picker:', error);
        showStatusMessage(`Error: ${error.message}`, 'error');
      }
    });
  }
}

// Handle element picked message
async function handleElementPicked(message) {
  if (message.action === 'elementPicked') {
    console.log('=== handleElementPicked called ===');
    console.log('Message:', JSON.stringify(message, null, 2));
    
    // Element was picked, fill in the form
    const elementInfo = message.elementInfo;
    
    if (!elementInfo) {
      console.error('No elementInfo in message');
      showStatusMessage('Error: No element info received', 'error');
      return;
    }
    
    const hostname = elementInfo.hostname;
    const selector = elementInfo.selector;
    
    console.log('Element hostname:', hostname);
    console.log('Element selector:', selector);
    console.log('Current domain:', currentDomain);
    console.log('Whitelist:', whitelist);
    
    // If hostname is in whitelist but not currently selected, switch to it
    if (whitelist.includes(hostname) && currentDomain !== hostname) {
      console.log('Need to switch to domain:', hostname);
      await switchToDomain(hostname);
      console.log('Switched to domain:', currentDomain);
    } else if (!whitelist.includes(hostname)) {
      console.warn('Hostname not in whitelist:', hostname);
      showStatusMessage(`Warning: ${hostname} is not whitelisted. Add it to the whitelist first.`, 'error', 5000);
      return;
    }
    
    // Update the current config's navigationSelector BEFORE switching tabs
    console.log('Updating currentConfig.navigationSelector');
    if (!currentConfig.navigationSelector) {
      currentConfig.navigationSelector = {};
    }
    currentConfig.navigationSelector.selector = selector;
    console.log('Updated config:', currentConfig.navigationSelector);
    
    // Switch to the Auto-Navigate tab
    const autonavigateTab = document.querySelector('.tab[data-tab="autonavigate"]');
    console.log('Auto-Navigate tab found:', !!autonavigateTab);
    
    if (autonavigateTab) {
      console.log('Clicking Auto-Navigate tab');
      autonavigateTab.click();
      
      // Wait for tab to render
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Tab should be visible now');
    } else {
      console.error('Auto-Navigate tab not found in DOM');
    }
    
    // Now update the UI which will populate the selector field
    console.log('Calling updateUI()');
    updateUI();
    
    // Verify the field was populated
    const navSiteSelector = document.getElementById('navSiteSelector');
    console.log('navSiteSelector element:', navSiteSelector);
    console.log('navSiteSelector value:', navSiteSelector?.value);
    
    if (navSiteSelector) {
      // If value is still empty, set it directly as a fallback
      if (!navSiteSelector.value) {
        console.warn('Field still empty after updateUI, setting directly');
        navSiteSelector.value = selector;
      }
      
      // Save the config directly (don't use debouncedAutoSave which reads from UI)
      console.log('Saving config directly');
      await saveCurrentConfig();
      
      // Scroll to the selector section
      setTimeout(() => {
        const selectorSection = document.querySelector('.element-picker-section');
        if (selectorSection) {
          console.log('Scrolling to selector section');
          selectorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      
      showStatusMessage('Element captured and saved!', 'success', 5000);
      console.log('=== handleElementPicked completed successfully ===');
    } else {
      console.error('navSiteSelector not found in DOM after tab switch');
      showStatusMessage('Error: Could not find selector field', 'error');
    }
  }
}

// Listen for element picked message via runtime.onMessage (for tabs)
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle elementPicked messages, ignore everything else
  if (message.action === 'elementPicked') {
    handleElementPicked(message);
    sendResponse({ success: true });
    return true;
  }
  
  // Don't respond to other messages - let background script handle them
  return false;
});

// Listen for element picked message via custom event (for popups)
document.addEventListener('gestureAutoscrollerMessage', (event) => {
  handleElementPicked(event.detail);
});

// Check for picked element when page becomes visible (in case it was suspended)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    checkForPickedElement();
  }
});

// Also check when window gains focus
window.addEventListener('focus', () => {
  checkForPickedElement();
});

// Show test result
function showTestResult(message, type) {
  const testResult = document.getElementById('testResult');
  if (testResult) {
    testResult.textContent = message;
    testResult.className = `test-result visible ${type}`;
  }
}

// ============================================================================
// PRESET MANAGEMENT
// ============================================================================

// Load presets from storage
async function loadPresets() {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'getPresets'
    });
    
    if (response && response.success) {
      presets = response.presets || {};
    } else {
      presets = {};
    }
  } catch (error) {
    console.error('Failed to load presets:', error);
    presets = {};
  }
}

// Setup preset button event listeners
function setupPresetListeners() {
  const btnSavePreset = document.getElementById('btnSavePreset');
  const btnLoadPreset = document.getElementById('btnLoadPreset');
  const btnManagePresets = document.getElementById('btnManagePresets');
  const btnConfirmSavePreset = document.getElementById('btnConfirmSavePreset');
  const btnConfirmRenamePreset = document.getElementById('btnConfirmRenamePreset');
  const presetNameInput = document.getElementById('presetNameInput');
  
  if (btnSavePreset) {
    btnSavePreset.addEventListener('click', openSavePresetModal);
  }
  
  if (btnLoadPreset) {
    btnLoadPreset.addEventListener('click', openLoadPresetModal);
  }
  
  if (btnManagePresets) {
    btnManagePresets.addEventListener('click', openManagePresetsModal);
  }
  
  if (btnConfirmSavePreset) {
    btnConfirmSavePreset.addEventListener('click', confirmSavePreset);
  }
  
  if (btnConfirmRenamePreset) {
    btnConfirmRenamePreset.addEventListener('click', confirmRenamePreset);
  }
  
  // Enter key in preset name input
  if (presetNameInput) {
    presetNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        confirmSavePreset();
      }
    });
  }
  
  // Close modals when clicking overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAllModals();
      }
    });
  });
  
  // Setup close buttons for all modals
  const modalCloseButtons = document.querySelectorAll('.modal-close');
  modalCloseButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Find which modal this button belongs to and close it
      const modal = button.closest('.modal-overlay');
      if (modal) {
        modal.classList.remove('show');
      }
    });
  });
  
  // Setup cancel buttons for modals
  const modalCancelButtons = document.querySelectorAll('.btn-modal-secondary');
  modalCancelButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Find which modal this button belongs to and close it
      const modal = button.closest('.modal-overlay');
      if (modal) {
        modal.classList.remove('show');
      }
    });
  });
}

// Open save preset modal
function openSavePresetModal() {
  const modal = document.getElementById('savePresetModal');
  const input = document.getElementById('presetNameInput');
  
  if (modal && input) {
    input.value = '';
    modal.classList.add('show');
    input.focus();
  }
}

// Close save preset modal
function closeSavePresetModal() {
  const modal = document.getElementById('savePresetModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Confirm save preset
async function confirmSavePreset() {
  const input = document.getElementById('presetNameInput');
  const name = input.value.trim();
  
  if (!name) {
    showStatusMessage('Please enter a preset name', 'error');
    return;
  }
  
  // Check if preset already exists
  if (presets[name]) {
    if (!confirm(`A preset named "${name}" already exists. Do you want to overwrite it?`)) {
      return;
    }
  }
  
  try {
    // Get current config and remove navigationSelector
    const { navigationSelector, ...presetConfig } = currentConfig;
    
    const response = await browser.runtime.sendMessage({
      action: 'savePreset',
      name: name,
      config: presetConfig
    });
    
    if (response && response.success) {
      // Update local presets
      presets[name] = presetConfig;
      
      showStatusMessage(`Preset "${name}" saved successfully`, 'success');
      closeSavePresetModal();
    } else {
      showStatusMessage(response.error || 'Failed to save preset', 'error');
    }
  } catch (error) {
    console.error('Failed to save preset:', error);
    showStatusMessage('Failed to save preset', 'error');
  }
}

// Open load preset modal
function openLoadPresetModal() {
  const modal = document.getElementById('loadPresetModal');
  const list = document.getElementById('loadPresetList');
  
  if (modal && list) {
    renderLoadPresetList();
    modal.classList.add('show');
  }
}

// Close load preset modal
function closeLoadPresetModal() {
  const modal = document.getElementById('loadPresetModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Render preset list in load modal
function renderLoadPresetList() {
  const list = document.getElementById('loadPresetList');
  if (!list) return;
  
  const presetNames = Object.keys(presets);
  
  if (presetNames.length === 0) {
    list.innerHTML = '<div class="preset-list-empty">No presets saved yet. Save your first preset to get started!</div>';
    return;
  }
  
  list.innerHTML = '';
  
  presetNames.sort().forEach(name => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'preset-item-name';
    nameSpan.textContent = name;
    
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn-preset-action btn-preset-load';
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => loadPreset(name);
    
    item.appendChild(nameSpan);
    item.appendChild(loadBtn);
    list.appendChild(item);
  });
}

// Load a preset
async function loadPreset(name) {
  if (!presets[name]) {
    showStatusMessage('Preset not found', 'error');
    return;
  }
  
  try {
    // Get preset config
    const presetConfig = presets[name];
    
    // Merge preset with current config, preserving navigationSelector
    const newConfig = {
      ...presetConfig,
      navigationSelector: currentConfig.navigationSelector
    };
    
    // Update current config
    currentConfig = newConfig;
    
    // Update UI
    updateUI();
    
    // Save the updated config
    await saveCurrentConfig();
    
    showStatusMessage(`Preset "${name}" loaded successfully`, 'success');
    closeLoadPresetModal();
  } catch (error) {
    console.error('Failed to load preset:', error);
    showStatusMessage('Failed to load preset', 'error');
  }
}

// Open manage presets modal
function openManagePresetsModal() {
  const modal = document.getElementById('managePresetsModal');
  const list = document.getElementById('managePresetList');
  
  if (modal && list) {
    renderManagePresetList();
    modal.classList.add('show');
  }
}

// Close manage presets modal
function closeManagePresetsModal() {
  const modal = document.getElementById('managePresetsModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Render preset list in manage modal
function renderManagePresetList() {
  const list = document.getElementById('managePresetList');
  if (!list) return;
  
  const presetNames = Object.keys(presets);
  
  if (presetNames.length === 0) {
    list.innerHTML = '<div class="preset-list-empty">No presets saved yet. Save your first preset to get started!</div>';
    return;
  }
  
  list.innerHTML = '';
  
  presetNames.sort().forEach(name => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'preset-item-name';
    nameSpan.textContent = name;
    
    const actions = document.createElement('div');
    actions.className = 'preset-item-actions';
    
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn-preset-action btn-preset-load';
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => {
      loadPreset(name);
      closeManagePresetsModal();
    };
    
    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn-preset-action btn-preset-rename';
    renameBtn.textContent = 'Rename';
    renameBtn.onclick = () => openRenamePresetModal(name);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-preset-action btn-preset-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deletePreset(name);
    
    actions.appendChild(loadBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    
    item.appendChild(nameSpan);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

// Delete a preset
async function deletePreset(name) {
  if (!confirm(`Are you sure you want to delete the preset "${name}"?`)) {
    return;
  }
  
  try {
    const response = await browser.runtime.sendMessage({
      action: 'deletePreset',
      name: name
    });
    
    if (response && response.success) {
      // Update local presets
      delete presets[name];
      
      showStatusMessage(`Preset "${name}" deleted successfully`, 'success');
      
      // Refresh the manage list
      renderManagePresetList();
    } else {
      showStatusMessage(response.error || 'Failed to delete preset', 'error');
    }
  } catch (error) {
    console.error('Failed to delete preset:', error);
    showStatusMessage('Failed to delete preset', 'error');
  }
}

// Open rename preset modal
function openRenamePresetModal(oldName) {
  const modal = document.getElementById('renamePresetModal');
  const input = document.getElementById('renamePresetInput');
  
  if (modal && input) {
    input.value = oldName;
    input.dataset.oldName = oldName;
    modal.classList.add('show');
    input.focus();
    input.select();
  }
}

// Close rename preset modal
function closeRenamePresetModal() {
  const modal = document.getElementById('renamePresetModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Confirm rename preset
async function confirmRenamePreset() {
  const input = document.getElementById('renamePresetInput');
  const oldName = input.dataset.oldName;
  const newName = input.value.trim();
  
  if (!newName) {
    showStatusMessage('Please enter a preset name', 'error');
    return;
  }
  
  if (newName === oldName) {
    closeRenamePresetModal();
    return;
  }
  
  // Check if new name already exists
  if (presets[newName]) {
    showStatusMessage('A preset with this name already exists', 'error');
    return;
  }
  
  try {
    const response = await browser.runtime.sendMessage({
      action: 'renamePreset',
      oldName: oldName,
      newName: newName
    });
    
    if (response && response.success) {
      // Update local presets
      presets[newName] = presets[oldName];
      delete presets[oldName];
      
      showStatusMessage(`Preset renamed to "${newName}" successfully`, 'success');
      closeRenamePresetModal();
      
      // Refresh the manage list
      renderManagePresetList();
    } else {
      showStatusMessage(response.error || 'Failed to rename preset', 'error');
    }
  } catch (error) {
    console.error('Failed to rename preset:', error);
    showStatusMessage('Failed to rename preset', 'error');
  }
}

// Close all modals
function closeAllModals() {
  closeSavePresetModal();
  closeLoadPresetModal();
  closeManagePresetsModal();
  closeRenamePresetModal();
}



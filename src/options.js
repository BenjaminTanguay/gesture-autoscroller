// Gesture AutoScroller - Options Page Script
// Handles settings UI and storage with autosave

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
  tapZoneUpPercentage: 50,    // Size of scroll-up zone (10-90%)
  whitelistedHosts: [],
  
  // Auto-navigate settings
  autoNavigateEnabled: false,           // Global enable/disable
  autoNavigateDelay: 3,                 // Seconds before clicking next (1-30)
  autoNavigateAutoStart: true,          // Auto-start scroll on new page
  
  // Per-site navigation selectors (hostname -> config)
  navigationSelectors: {}
};

// Current settings in memory
let currentSettings = { ...DEFAULT_SETTINGS };

// Autosave debounce timer
let autosaveTimer = null;
const AUTOSAVE_DELAY = 500; // milliseconds

// DOM elements
let elements = {};

// Toggle collapsible section
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.toggle('collapsed');
  }
}

// Make toggleSection available globally for onclick handlers
window.toggleSection = toggleSection;

// Setup collapsible section event listeners
function setupCollapsibleSections() {
  const sections = ['tapSection', 'autoscrollSection', 'whitelistSection', 'autoNavigateSection'];
  
  sections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) {
      const header = section.querySelector('.collapsible-header');
      if (header) {
        header.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSection(sectionId);
        });
      }
    }
  });
}

// Check for picked element in storage
async function checkForPickedElement() {
  console.log('Checking for picked element in storage...');
  try {
    const result = await browser.storage.local.get(['pickedElement', 'pickedElementTimestamp']);
    console.log('Storage result:', result);
    
    if (result.pickedElement && result.pickedElementTimestamp) {
      // Check if it's recent (within last 30 seconds)
      const age = Date.now() - result.pickedElementTimestamp;
      console.log('Picked element age:', age, 'ms');
      
      if (age < 30000) {
        console.log('Found recent picked element, processing...');
        // Process the picked element
        handleElementPicked({
          action: 'elementPicked',
          elementInfo: result.pickedElement
        });
        
        // Clear it from storage so we don't process it again
        await browser.storage.local.remove(['pickedElement', 'pickedElementTimestamp']);
        console.log('Cleared picked element from storage');
      } else {
        console.log('Picked element too old, ignoring');
      }
    } else {
      console.log('No picked element in storage');
    }
  } catch (error) {
    console.error('Error checking for picked element:', error);
  }
}

// Initialize the options page
document.addEventListener('DOMContentLoaded', async () => {
  // Cache DOM elements
  cacheElements();
  
  // Setup tab switching
  setupTabs();
  
  // Load settings from storage
  await loadSettings();
  
  // Update UI with loaded settings
  updateUI();
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize collapsible sections - start with sections collapsed
  const autoscrollSection = document.getElementById('autoscrollSection');
  const whitelistSection = document.getElementById('whitelistSection');
  const autoNavigateSection = document.getElementById('autoNavigateSection');
  if (autoscrollSection) autoscrollSection.classList.add('collapsed');
  if (whitelistSection) whitelistSection.classList.add('collapsed');
  if (autoNavigateSection) autoNavigateSection.classList.add('collapsed');
  
  // Setup collapsible section click handlers
  setupCollapsibleSections();
  
  // Load current page info (if available)
  loadCurrentPageInfo();
  
  // Initialize auto-navigate feature (after settings are loaded)
  initAutoNavigate();
  
  // Check for picked element from storage (fallback method)
  await checkForPickedElement();
  
  // Listen for storage changes to update UI in real-time
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.gesture_autoscroller_settings) {
      const newSettings = changes.gesture_autoscroller_settings.newValue;
      if (newSettings) {
        // Update current settings
        currentSettings = newSettings;
        // Update UI to reflect new settings
        updateUI();
      }
    }
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
    // Feature toggles
    tapNavigationEnabled: document.getElementById('tapNavigationEnabled'),
    autoscrollEnabled: document.getElementById('autoscrollEnabled'),
    autoStartEnabled: document.getElementById('autoStartEnabled'),
    
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

// Load settings from browser storage
async function loadSettings() {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_settings');
    
    if (result.gesture_autoscroller_settings) {
      currentSettings = {
        ...DEFAULT_SETTINGS,
        ...result.gesture_autoscroller_settings
      };
    } else {
      // No settings found, use defaults
      currentSettings = { ...DEFAULT_SETTINGS };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatusMessage('Failed to load settings', 'error');
  }
}

// Update UI with current settings
function updateUI() {
  // Feature toggles
  elements.tapNavigationEnabled.checked = currentSettings.tapNavigationEnabled;
  elements.autoscrollEnabled.checked = currentSettings.autoscrollEnabled;
  elements.autoStartEnabled.checked = currentSettings.autoStartEnabled;
  
  // Tap zone layout
  if (currentSettings.tapZoneLayout === 'horizontal') {
    elements.tapZoneLayoutHorizontal.checked = true;
  } else {
    elements.tapZoneLayoutVertical.checked = true;
  }
  
  // Speed settings - update both sliders and inputs
  elements.defaultSpeed.value = currentSettings.defaultSpeed;
  if (elements.defaultSpeedInput) elements.defaultSpeedInput.value = currentSettings.defaultSpeed;
  
  elements.minSpeed.value = currentSettings.minSpeed;
  if (elements.minSpeedInput) elements.minSpeedInput.value = currentSettings.minSpeed;
  
  elements.maxSpeed.value = currentSettings.maxSpeed;
  if (elements.maxSpeedInput) elements.maxSpeedInput.value = currentSettings.maxSpeed;
  
  elements.granularity.value = currentSettings.granularity;
  if (elements.granularityInput) elements.granularityInput.value = currentSettings.granularity;
  
  elements.autoStartDelay.value = currentSettings.autoStartDelay;
  if (elements.autoStartDelayInput) elements.autoStartDelayInput.value = currentSettings.autoStartDelay;
  
  elements.tapScrollPercentage.value = currentSettings.tapScrollPercentage;
  if (elements.tapScrollPercentageInput) elements.tapScrollPercentageInput.value = currentSettings.tapScrollPercentage;
  
  elements.tapZoneUpPercentage.value = currentSettings.tapZoneUpPercentage;
  if (elements.tapZoneUpPercentageInput) elements.tapZoneUpPercentageInput.value = currentSettings.tapZoneUpPercentage;
  
  // Update zone split preview
  updateZoneSplitPreview();
  
  // Show/hide auto-start section based on checkbox
  updateAutoStartSectionVisibility();
  
  // Auto-navigate settings
  const autoNavigateEnabled = document.getElementById('autoNavigateEnabled');
  const autoNavigateDelay = document.getElementById('autoNavigateDelay');
  const autoNavigateDelayValue = document.getElementById('autoNavigateDelayValue');
  const autoNavigateAutoStart = document.getElementById('autoNavigateAutoStart');
  
  if (autoNavigateEnabled) autoNavigateEnabled.checked = currentSettings.autoNavigateEnabled;
  if (autoNavigateDelay) autoNavigateDelay.value = currentSettings.autoNavigateDelay;
  if (autoNavigateDelayValue) autoNavigateDelayValue.value = currentSettings.autoNavigateDelay;
  if (autoNavigateAutoStart) autoNavigateAutoStart.checked = currentSettings.autoNavigateAutoStart;
  
  // Render navigation configs
  renderNavigationConfigs();
  
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

// Render whitelist
function renderWhitelist() {
  const list = elements.whitelistList;
  
  if (!currentSettings.whitelistedHosts || currentSettings.whitelistedHosts.length === 0) {
    list.innerHTML = '<div class="whitelist-empty">No sites added yet. Add your favorite reading sites below.</div>';
    return;
  }
  
  list.innerHTML = '';
  
  currentSettings.whitelistedHosts.forEach((host, index) => {
    const item = document.createElement('div');
    item.className = 'whitelist-item';
    
    const hostSpan = document.createElement('span');
    hostSpan.className = 'whitelist-item-host';
    hostSpan.textContent = host;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'whitelist-item-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeHost(index);
    
    item.appendChild(hostSpan);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });
}

// Setup event listeners
function setupEventListeners() {
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
function addHost() {
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
  if (currentSettings.whitelistedHosts.includes(host)) {
    showStatusMessage('Host already in whitelist', 'error');
    return;
  }
  
  // Add to whitelist
  currentSettings.whitelistedHosts.push(host);
  currentSettings.whitelistedHosts.sort();
  
  // Update UI
  renderWhitelist();
  input.value = '';
  
  // Update current page status if it matches
  updateCurrentPageStatus();
  
  // Autosave after adding host
  autoSaveSettings();
  
  showStatusMessage(`Added ${host}`, 'success');
}

// Remove host from whitelist
function removeHost(index) {
  const host = currentSettings.whitelistedHosts[index];
  currentSettings.whitelistedHosts.splice(index, 1);
  renderWhitelist();
  
  // Update current page status
  updateCurrentPageStatus();
  
  // Autosave after removing host
  autoSaveSettings();
  
  showStatusMessage(`Removed ${host}`, 'success');
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
  return currentSettings.whitelistedHosts.some(whitelistedHost => {
    // Exact match
    if (host === whitelistedHost) return true;
    
    // Subdomain match (e.g., "example.com" matches "www.example.com")
    if (host.endsWith('.' + whitelistedHost)) return true;
    
    return false;
  });
}

// Add current site to whitelist
function addCurrentSite() {
  const host = elements.currentPageHost.textContent;
  
  if (isHostWhitelisted(host)) {
    showStatusMessage('Site already in whitelist', 'error');
    return;
  }
  
  // Add to whitelist
  currentSettings.whitelistedHosts.push(host);
  currentSettings.whitelistedHosts.sort();
  
  // Update UI
  renderWhitelist();
  updateCurrentPageStatus(host);
  
  // Autosave after adding host
  autoSaveSettings();
  
  showStatusMessage(`Added ${host}`, 'success');
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

// Auto-save settings
async function autoSaveSettings() {
  try {
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
    
    // Read current values from UI
    const settings = {
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
      whitelistedHosts: currentSettings.whitelistedHosts,
      
      // Auto-navigate settings
      autoNavigateEnabled: autoNavigateEnabled ? autoNavigateEnabled.checked : currentSettings.autoNavigateEnabled,
      autoNavigateDelay: autoNavigateDelay ? parseFloat(autoNavigateDelay.value) : currentSettings.autoNavigateDelay,
      autoNavigateAutoStart: autoNavigateAutoStart ? autoNavigateAutoStart.checked : currentSettings.autoNavigateAutoStart,
      navigationSelectors: currentSettings.navigationSelectors || {}
    };
    
    // Validate speed settings silently
    if (settings.minSpeed > settings.defaultSpeed) {
      // Don't save, speeds are invalid
      return;
    }
    
    if (settings.defaultSpeed > settings.maxSpeed) {
      // Don't save, speeds are invalid
      return;
    }
    
    if (settings.minSpeed >= settings.maxSpeed) {
      // Don't save, speeds are invalid
      return;
    }
    
    // Save to storage
    await browser.storage.local.set({
      gesture_autoscroller_settings: settings
    });
    
    // Update current settings
    currentSettings = settings;
    
    showStatusMessage('Saved', 'success');
    
    // Notify content scripts of settings change
    notifyContentScripts();
    
  } catch (error) {
    console.error('Failed to auto-save settings:', error);
  }
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
  // Check URL parameters for pre-filled selector info
  const urlParams = new URLSearchParams(window.location.search);
  const selector = urlParams.get('selector');
  const hostname = urlParams.get('hostname');
  
  if (selector && hostname) {
    // Pre-fill the form with captured selector
    const navSiteHost = document.getElementById('navSiteHost');
    const navSiteSelector = document.getElementById('navSiteSelector');
    
    if (navSiteHost && navSiteSelector) {
      navSiteHost.value = hostname;
      navSiteSelector.value = selector;
      
      // Scroll to the auto-navigate section
      const autoNavigateSection = document.getElementById('autoNavigateSection');
      if (autoNavigateSection) {
        // Expand the section if collapsed
        autoNavigateSection.classList.remove('collapsed');
        // Scroll into view
        setTimeout(() => {
          autoNavigateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      
      showStatusMessage('Element selector captured! Review and click "Add Configuration" to save.', 'success');
    }
  }
  
  // Cache auto-navigate elements
  const autoNavigateElements = {
    enabled: document.getElementById('autoNavigateEnabled'),
    delay: document.getElementById('autoNavigateDelay'),
    delayValue: document.getElementById('autoNavigateDelayValue'),
    autoStart: document.getElementById('autoNavigateAutoStart'),
    navSiteHost: document.getElementById('navSiteHost'),
    navSiteSelector: document.getElementById('navSiteSelector'),
    navSiteDelay: document.getElementById('navSiteDelay'),
    navSiteAutoStart: document.getElementById('navSiteAutoStart'),
    navSiteNotes: document.getElementById('navSiteNotes'),
    addNavConfig: document.getElementById('addNavConfig'),
    testSelector: document.getElementById('testSelector'),
    testResult: document.getElementById('testResult'),
    navConfigsList: document.getElementById('navConfigsList')
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
  
  // Add configuration button
  if (autoNavigateElements.addNavConfig) {
    autoNavigateElements.addNavConfig.addEventListener('click', () => {
      const hostname = autoNavigateElements.navSiteHost.value.trim();
      const selector = autoNavigateElements.navSiteSelector.value.trim();
      const delay = parseInt(autoNavigateElements.navSiteDelay.value) || 3;
      const autoStart = autoNavigateElements.navSiteAutoStart.checked;
      const notes = autoNavigateElements.navSiteNotes.value.trim();
      
      if (!hostname || !selector) {
        showStatusMessage('Please enter both hostname and CSS selector', 'error');
        return;
      }
      
      // Add or update configuration
      if (!currentSettings.navigationSelectors) {
        currentSettings.navigationSelectors = {};
      }
      
      currentSettings.navigationSelectors[hostname] = {
        selector: selector,
        enabled: true,
        delay: delay,
        autoStart: autoStart,
        notes: notes
      };
      
      // Save settings
      saveSettings().then(() => {
        showStatusMessage(`Configuration saved for ${hostname}`, 'success');
        
        // Clear form
        autoNavigateElements.navSiteHost.value = '';
        autoNavigateElements.navSiteSelector.value = '';
        autoNavigateElements.navSiteDelay.value = '3';
        autoNavigateElements.navSiteAutoStart.checked = true;
        autoNavigateElements.navSiteNotes.value = '';
        
        // Update UI
        renderNavigationConfigs();
      });
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
  
  // Render existing configurations
  renderNavigationConfigs();
  
  // Setup element picker button
  const activateElementPicker = document.getElementById('activateElementPicker');
  if (activateElementPicker) {
    activateElementPicker.addEventListener('click', async () => {
      try {
        // Simply store a flag in background that we're waiting for an element
        // We don't need to store the tab ID - the background script will handle returning
        console.log('Sending startElementPicking message to background...');
        const response = await browser.runtime.sendMessage({
          action: 'startElementPicking'
        });
        console.log('startElementPicking response:', response);
        
        // Get all tabs to activate picker on them
        const allTabs = await browser.tabs.query({});
        console.log('All tabs:', allTabs.map(t => ({ id: t.id, url: t.url })));
        
        // Find non-options tabs
        const websiteTabs = allTabs.filter(t => 
          t.url && 
          t.url.startsWith('http') && 
          !t.url.includes('options.html') &&
          !t.url.includes('about:') &&
          !t.url.includes('moz-extension:')
        );
        console.log('Website tabs:', websiteTabs);
        
        if (websiteTabs.length === 0) {
          showStatusMessage('Please open a website in another tab first', 'error');
          return;
        }
        
        // Activate picker on ALL website tabs
        let activatedCount = 0;
        for (const tab of websiteTabs) {
          try {
            console.log('Activating picker on tab:', tab.id, tab.url);
            const response = await browser.tabs.sendMessage(tab.id, {
              action: 'activateElementPicker'
            });
            console.log('Response from tab', tab.id, ':', response);
            if (response && response.success) {
              activatedCount++;
            }
          } catch (error) {
            console.log('Could not activate picker on tab', tab.id, ':', error.message);
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
function handleElementPicked(message) {
  console.log('==========================================');
  console.log('HANDLING ELEMENT PICKED');
  console.log('Message:', message);
  console.log('==========================================');
  
  if (message.action === 'elementPicked') {
    // Element was picked, fill in the form
    const elementInfo = message.elementInfo;
    console.log('Processing elementPicked:', elementInfo);
    
    const navSiteHost = document.getElementById('navSiteHost');
    const navSiteSelector = document.getElementById('navSiteSelector');
    
    console.log('navSiteHost element:', navSiteHost);
    console.log('navSiteSelector element:', navSiteSelector);
    
    if (navSiteHost && navSiteSelector) {
      navSiteHost.value = elementInfo.hostname;
      navSiteSelector.value = elementInfo.selector;
      console.log('Form fields filled in:', navSiteHost.value, navSiteSelector.value);
      
      // Expand the auto-navigate section if collapsed
      const autoNavigateSection = document.getElementById('autoNavigateSection');
      if (autoNavigateSection) {
        autoNavigateSection.classList.remove('collapsed');
        console.log('Section expanded');
        // Scroll into view
        setTimeout(() => {
          autoNavigateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      
      showStatusMessage('Element captured! Review and click "Add Configuration" to save.', 'success', 5000);
    } else {
      console.error('Form fields not found');
      showStatusMessage('Error: Could not find form fields', 'error');
    }
  }
}

// Listen for element picked message via runtime.onMessage (for tabs)
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('OPTIONS PAGE RECEIVED runtime.onMessage:', message);
  handleElementPicked(message);
  sendResponse({ success: true });
  return true;
});

// Listen for element picked message via custom event (for popups)
document.addEventListener('gestureAutoscrollerMessage', (event) => {
  console.log('OPTIONS PAGE RECEIVED custom event:', event.detail);
  handleElementPicked(event.detail);
});

// Check for picked element when page becomes visible (in case it was suspended)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('Page became visible, checking for picked element...');
    checkForPickedElement();
  }
});

// Also check when window gains focus
window.addEventListener('focus', () => {
  console.log('Window gained focus, checking for picked element...');
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

// Render navigation configurations list
function renderNavigationConfigs() {
  const navConfigsList = document.getElementById('navConfigsList');
  if (!navConfigsList) return;
  
  // Ensure currentSettings is loaded
  if (!currentSettings) return;
  
  const configs = currentSettings.navigationSelectors || {};
  const hostnames = Object.keys(configs);
  
  if (hostnames.length === 0) {
    navConfigsList.innerHTML = '<div class="nav-configs-empty">No site configurations yet. Add your first one above!</div>';
    return;
  }
  
  navConfigsList.innerHTML = hostnames.map(hostname => {
    const config = configs[hostname];
    return `
      <div class="nav-config-item" data-hostname="${hostname}">
        <div class="config-header">
          <div class="config-hostname">
            <strong>${hostname}</strong>
            <span class="config-status ${config.enabled ? 'enabled' : 'disabled'}">
              ${config.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div class="config-actions">
            <button class="btn-icon edit-config" data-hostname="${hostname}" title="Edit">✏️</button>
            <button class="btn-icon delete-config" data-hostname="${hostname}" title="Delete">🗑️</button>
          </div>
        </div>
        
        <div class="config-details">
          <div class="config-row">
            <span class="config-label">Selector:</span>
            <span class="config-value"><code>${config.selector}</code></span>
          </div>
          <div class="config-row">
            <span class="config-label">Delay:</span>
            <span class="config-value">${config.delay} seconds</span>
          </div>
          <div class="config-row">
            <span class="config-label">Auto-start:</span>
            <span class="config-value">${config.autoStart ? 'Yes' : 'No'}</span>
          </div>
          ${config.notes ? `
          <div class="config-row">
            <span class="config-label">Notes:</span>
            <span class="config-value">${config.notes}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="config-edit-form" style="display: none;">
          <div class="form-group">
            <label>CSS Selector</label>
            <input type="text" class="edit-selector" value="${config.selector}">
          </div>
          <div class="form-group">
            <label>Countdown Delay (seconds)</label>
            <input type="number" class="edit-delay" value="${config.delay}" min="1" max="30">
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" class="edit-autostart" ${config.autoStart ? 'checked' : ''}>
              Auto-start scrolling on new page
            </label>
          </div>
          <div class="form-group">
            <label>Notes (optional)</label>
            <input type="text" class="edit-notes" value="${config.notes || ''}">
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" class="edit-enabled" ${config.enabled ? 'checked' : ''}>
              Enable for this site
            </label>
          </div>
          <div class="form-actions">
            <button class="btn-primary save-config" data-hostname="${hostname}">Save</button>
            <button class="btn-secondary cancel-edit" data-hostname="${hostname}">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners to dynamically created elements
  attachNavConfigEventListeners();
}

// Attach event listeners to navigation config items
function attachNavConfigEventListeners() {
  // Edit buttons
  document.querySelectorAll('.edit-config').forEach(button => {
    button.addEventListener('click', () => {
      const hostname = button.getAttribute('data-hostname');
      const item = document.querySelector(`.nav-config-item[data-hostname="${hostname}"]`);
      if (item) {
        const editForm = item.querySelector('.config-edit-form');
        const details = item.querySelector('.config-details');
        if (editForm && details) {
          details.style.display = 'none';
          editForm.style.display = 'block';
        }
      }
    });
  });
  
  // Delete buttons
  document.querySelectorAll('.delete-config').forEach(button => {
    button.addEventListener('click', () => {
      const hostname = button.getAttribute('data-hostname');
      if (confirm(`Delete configuration for ${hostname}?`)) {
        delete currentSettings.navigationSelectors[hostname];
        saveSettings().then(() => {
          showStatusMessage(`Configuration deleted for ${hostname}`, 'success');
          renderNavigationConfigs();
        });
      }
    });
  });
  
  // Save buttons
  document.querySelectorAll('.save-config').forEach(button => {
    button.addEventListener('click', () => {
      const hostname = button.getAttribute('data-hostname');
      const item = document.querySelector(`.nav-config-item[data-hostname="${hostname}"]`);
      if (item) {
        const selector = item.querySelector('.edit-selector').value.trim();
        const delay = parseInt(item.querySelector('.edit-delay').value) || 3;
        const autoStart = item.querySelector('.edit-autostart').checked;
        const notes = item.querySelector('.edit-notes').value.trim();
        const enabled = item.querySelector('.edit-enabled').checked;
        
        if (!selector) {
          showStatusMessage('Selector cannot be empty', 'error');
          return;
        }
        
        currentSettings.navigationSelectors[hostname] = {
          selector: selector,
          enabled: enabled,
          delay: delay,
          autoStart: autoStart,
          notes: notes
        };
        
        saveSettings().then(() => {
          showStatusMessage(`Configuration updated for ${hostname}`, 'success');
          renderNavigationConfigs();
        });
      }
    });
  });
  
  // Cancel buttons
  document.querySelectorAll('.cancel-edit').forEach(button => {
    button.addEventListener('click', () => {
      const hostname = button.getAttribute('data-hostname');
      const item = document.querySelector(`.nav-config-item[data-hostname="${hostname}"]`);
      if (item) {
        const editForm = item.querySelector('.config-edit-form');
        const details = item.querySelector('.config-details');
        if (editForm && details) {
          editForm.style.display = 'none';
          details.style.display = 'block';
        }
      }
    });
  });
}



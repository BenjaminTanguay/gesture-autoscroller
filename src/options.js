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
  whitelistedHosts: []
};

// Current settings in memory
let currentSettings = { ...DEFAULT_SETTINGS };

// Autosave debounce timer
let autosaveTimer = null;
const AUTOSAVE_DELAY = 500; // milliseconds

// DOM elements
let elements = {};

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
  
  // Load current page info (if available)
  loadCurrentPageInfo();
  
  // Listen for storage changes to update UI in real-time
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.gesture_autoscroller_settings) {
      const newSettings = changes.gesture_autoscroller_settings.newValue;
      if (newSettings) {
        // Update current settings
        currentSettings = newSettings;
        // Update UI to reflect new settings
        updateUI();
        console.log('Options UI updated from storage change:', newSettings);
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
    
    // Speed sliders
    defaultSpeed: document.getElementById('defaultSpeed'),
    minSpeed: document.getElementById('minSpeed'),
    maxSpeed: document.getElementById('maxSpeed'),
    granularity: document.getElementById('granularity'),
    autoStartDelay: document.getElementById('autoStartDelay'),
    
    // Speed value displays
    defaultSpeedValue: document.getElementById('defaultSpeedValue'),
    minSpeedValue: document.getElementById('minSpeedValue'),
    maxSpeedValue: document.getElementById('maxSpeedValue'),
    granularityValue: document.getElementById('granularityValue'),
    autoStartDelayValue: document.getElementById('autoStartDelayValue'),
    
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
    
    console.log('Settings loaded:', currentSettings);
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
  
  // Speed settings
  elements.defaultSpeed.value = currentSettings.defaultSpeed;
  elements.minSpeed.value = currentSettings.minSpeed;
  elements.maxSpeed.value = currentSettings.maxSpeed;
  elements.granularity.value = currentSettings.granularity;
  elements.autoStartDelay.value = currentSettings.autoStartDelay;
  
  // Update speed displays
  updateSpeedDisplay('defaultSpeed', currentSettings.defaultSpeed);
  updateSpeedDisplay('minSpeed', currentSettings.minSpeed);
  updateSpeedDisplay('maxSpeed', currentSettings.maxSpeed);
  updateSpeedDisplay('granularity', currentSettings.granularity);
  updateAutoStartDelayDisplay(currentSettings.autoStartDelay);
  
  // Show/hide auto-start section based on checkbox
  updateAutoStartSectionVisibility();
  
  // Whitelist
  renderWhitelist();
}

// Update speed slider display
function updateSpeedDisplay(sliderId, value) {
  const displayElement = elements[sliderId + 'Value'];
  if (displayElement) {
    displayElement.textContent = `${Math.round(parseFloat(value))} px/sec`;
  }
}

// Update auto-start delay display
function updateAutoStartDelayDisplay(value) {
  const displayElement = elements.autoStartDelayValue;
  if (displayElement) {
    const seconds = Math.round(parseFloat(value));
    displayElement.textContent = `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  }
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
  
  // Speed sliders - update display in real-time and autosave with debounce
  elements.defaultSpeed.addEventListener('input', (e) => {
    updateSpeedDisplay('defaultSpeed', e.target.value);
    debouncedAutoSave();
  });
  
  elements.minSpeed.addEventListener('input', (e) => {
    updateSpeedDisplay('minSpeed', e.target.value);
    debouncedAutoSave();
  });
  
  elements.maxSpeed.addEventListener('input', (e) => {
    updateSpeedDisplay('maxSpeed', e.target.value);
    debouncedAutoSave();
  });
  
  elements.granularity.addEventListener('input', (e) => {
    updateSpeedDisplay('granularity', e.target.value);
    debouncedAutoSave();
  });
  
  elements.autoStartDelay.addEventListener('input', (e) => {
    updateAutoStartDelayDisplay(e.target.value);
    debouncedAutoSave();
  });
  
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
    console.log('Could not load current page info:', error);
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
    // Read current values from UI
    const settings = {
      tapNavigationEnabled: elements.tapNavigationEnabled.checked,
      autoscrollEnabled: elements.autoscrollEnabled.checked,
      autoStartEnabled: elements.autoStartEnabled.checked,
      autoStartDelay: parseFloat(elements.autoStartDelay.value),
      defaultSpeed: parseFloat(elements.defaultSpeed.value),
      minSpeed: parseFloat(elements.minSpeed.value),
      maxSpeed: parseFloat(elements.maxSpeed.value),
      granularity: parseFloat(elements.granularity.value),
      whitelistedHosts: currentSettings.whitelistedHosts
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
    
    console.log('Settings auto-saved:', settings);
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
    console.log('Could not notify content scripts:', error);
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

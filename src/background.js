// Gesture AutoScroller - Background Script
// Handles settings storage, initialization, and message passing

// Storage schema version for migration tracking
const STORAGE_SCHEMA_VERSION = 2;

// Track the most recently active non-extension tab
let lastActiveTabInfo = null;

// Listen for tab activation changes
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      const url = new URL(tab.url);
      // Only track http/https tabs
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        lastActiveTabInfo = {
          url: tab.url,
          hostname: url.hostname,
          timestamp: Date.now()
        };
        console.log('Tracked active tab:', lastActiveTabInfo);
      }
    }
  } catch (e) {
    // Ignore errors
  }
});

// Listen for tab updates (URL changes within a tab)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    try {
      const url = new URL(changeInfo.url);
      // Only track http/https tabs
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        lastActiveTabInfo = {
          url: changeInfo.url,
          hostname: url.hostname,
          timestamp: Date.now()
        };
        console.log('Tracked updated active tab:', lastActiveTabInfo);
      }
    } catch (e) {
      // Ignore errors
    }
  }
});

// Default configuration template (used for new domains)
const DEFAULT_CONFIG = {
  tapNavigationEnabled: true,
  autoscrollEnabled: true,
  autoStartEnabled: false,    // Auto-start scrolling on page load
  autoStartDelay: 3,          // Seconds to wait before auto-starting
  defaultSpeed: 20,      // px/sec
  minSpeed: 1,           // px/sec
  maxSpeed: 3000,        // px/sec
  granularity: 10,       // px/sec
  tapScrollPercentage: 100,  // Percentage of viewport height to scroll (10-100%)
  tapZoneLayout: 'horizontal', // Options: 'horizontal', 'vertical'
  tapZoneUpPercentage: 50,   // Size of scroll-up zone (10-90%), remaining is scroll-down
  
  // Auto-navigate settings (per-domain)
  autoNavigateEnabled: false,           // Enable/disable for this domain
  autoNavigateDelay: 3,                 // Seconds before clicking next (1-30)
  autoNavigateAutoStart: true,          // Auto-start scroll on new page
  navigationSelector: null              // { selector, enabled, delay, autoStart, notes } or null
};

// Legacy default settings for backward compatibility during migration
const LEGACY_DEFAULT_SETTINGS = {
  tapNavigationEnabled: true,
  autoscrollEnabled: true,
  defaultSpeed: 20,
  minSpeed: 1,
  maxSpeed: 3000,
  granularity: 10,
  tapScrollPercentage: 100,
  tapZoneLayout: 'horizontal',
  tapZoneUpPercentage: 50,
  whitelistedHosts: [],
  autoNavigateEnabled: false,
  autoNavigateDelay: 3,
  autoNavigateAutoStart: true,
  navigationSelectors: {}
};

// Initialize settings on extension install/update
browser.runtime.onInstalled.addListener(async (details) => {
  try {
    // Check if we need to migrate from old storage format
    const needsMigration = await checkNeedsMigration();
    
    if (needsMigration) {
      console.log('Migrating to per-domain configuration...');
      await migrateToPerDomainConfig();
      console.log('Migration complete!');
    } else {
      // Check if this is first install
      const result = await browser.storage.local.get('gesture_autoscroller_metadata');
      if (!result.gesture_autoscroller_metadata) {
        // First install - initialize with defaults
        await initializeDefaultStorage();
      }
    }
    
    // Create context menu item for selecting navigation button
    await createContextMenu();
  } catch (error) {
    console.error('Failed to initialize settings:', error);
  }
});

// Track if we're currently picking an element
let isPickingElement = false;

// ============================================================================
// STORAGE MIGRATION & INITIALIZATION
// ============================================================================

// Check if we need to migrate from old storage format
async function checkNeedsMigration() {
  try {
    const result = await browser.storage.local.get([
      'gesture_autoscroller_settings',
      'gesture_autoscroller_metadata'
    ]);
    
    // If we have old settings but no metadata, we need to migrate
    return result.gesture_autoscroller_settings && !result.gesture_autoscroller_metadata;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return false;
  }
}

// Migrate from old global settings to per-domain configuration
async function migrateToPerDomainConfig() {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_settings');
    const oldSettings = result.gesture_autoscroller_settings || LEGACY_DEFAULT_SETTINGS;
    
    // Extract whitelist
    const whitelist = oldSettings.whitelistedHosts || [];
    
    // Create domain configs from old settings
    const domainConfigs = {};
    
    // For each whitelisted host, create a config with the global settings
    for (const hostname of whitelist) {
      domainConfigs[hostname] = createDomainConfigFromLegacy(oldSettings, hostname);
    }
    
    // Create default config from old global settings
    const defaultConfig = createDomainConfigFromLegacy(oldSettings, null);
    
    // Save new storage format
    await browser.storage.local.set({
      gesture_autoscroller_metadata: {
        version: STORAGE_SCHEMA_VERSION,
        lastMigration: Date.now()
      },
      gesture_autoscroller_default_config: defaultConfig,
      gesture_autoscroller_domain_configs: domainConfigs,
      gesture_autoscroller_whitelist: whitelist
    });
    
    // Remove old settings key
    await browser.storage.local.remove('gesture_autoscroller_settings');
    
    console.log(`Migrated ${whitelist.length} domain(s) to per-domain configuration`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Create domain config from legacy settings
function createDomainConfigFromLegacy(oldSettings, hostname) {
  const config = {
    ...DEFAULT_CONFIG,
    tapNavigationEnabled: oldSettings.tapNavigationEnabled ?? DEFAULT_CONFIG.tapNavigationEnabled,
    autoscrollEnabled: oldSettings.autoscrollEnabled ?? DEFAULT_CONFIG.autoscrollEnabled,
    autoStartEnabled: oldSettings.autoStartEnabled ?? DEFAULT_CONFIG.autoStartEnabled,
    autoStartDelay: oldSettings.autoStartDelay ?? DEFAULT_CONFIG.autoStartDelay,
    defaultSpeed: oldSettings.defaultSpeed ?? DEFAULT_CONFIG.defaultSpeed,
    minSpeed: oldSettings.minSpeed ?? DEFAULT_CONFIG.minSpeed,
    maxSpeed: oldSettings.maxSpeed ?? DEFAULT_CONFIG.maxSpeed,
    granularity: oldSettings.granularity ?? DEFAULT_CONFIG.granularity,
    tapScrollPercentage: oldSettings.tapScrollPercentage ?? DEFAULT_CONFIG.tapScrollPercentage,
    tapZoneLayout: oldSettings.tapZoneLayout ?? DEFAULT_CONFIG.tapZoneLayout,
    tapZoneUpPercentage: oldSettings.tapZoneUpPercentage ?? DEFAULT_CONFIG.tapZoneUpPercentage,
    autoNavigateEnabled: oldSettings.autoNavigateEnabled ?? DEFAULT_CONFIG.autoNavigateEnabled,
    autoNavigateDelay: oldSettings.autoNavigateDelay ?? DEFAULT_CONFIG.autoNavigateDelay,
    autoNavigateAutoStart: oldSettings.autoNavigateAutoStart ?? DEFAULT_CONFIG.autoNavigateAutoStart
  };
  
  // Add navigation selector if exists for this hostname
  if (hostname && oldSettings.navigationSelectors && oldSettings.navigationSelectors[hostname]) {
    config.navigationSelector = oldSettings.navigationSelectors[hostname];
  } else {
    config.navigationSelector = null;
  }
  
  return config;
}

// Initialize default storage for first install
async function initializeDefaultStorage() {
  try {
    await browser.storage.local.set({
      gesture_autoscroller_metadata: {
        version: STORAGE_SCHEMA_VERSION,
        lastMigration: Date.now()
      },
      gesture_autoscroller_default_config: { ...DEFAULT_CONFIG },
      gesture_autoscroller_domain_configs: {},
      gesture_autoscroller_whitelist: []
    });
    
    console.log('Initialized default storage');
  } catch (error) {
    console.error('Failed to initialize default storage:', error);
    throw error;
  }
}

// Log state changes
function setPickingState(value, reason) {
  console.log('==========================================');
  console.log('CHANGING isPickingElement:', isPickingElement, '->', value);
  console.log('Reason:', reason);
  console.log('Stack trace:', new Error().stack);
  console.log('==========================================');
  isPickingElement = value;
}

// Listen for messages from content scripts and options page
browser.runtime.onMessage.addListener(async (message, sender) => {
  switch (message.action) {
    case 'getLastActiveTab':
      // Return the most recently active non-extension tab
      return {
        success: true,
        tabInfo: lastActiveTabInfo
      };
      
    case 'getSettings':
      // Legacy support: return settings for a specific host if provided
      if (message.host) {
        return await getDomainConfig(message.host);
      }
      // For options page: return all configs
      return await getAllConfigs();
      
    case 'saveSettings':
      // Legacy support for saving global settings (now saves to default)
      return await saveSettings(message.settings);
      
    case 'saveDomainConfig':
      // Save configuration for a specific domain
      return await saveDomainConfig(message.hostname, message.config);
      
    case 'getDomainConfig':
      // Get configuration for a specific domain
      return await getDomainConfig(message.hostname);
      
    case 'getDefaultConfig':
      // Get the default configuration template
      return await getDefaultConfig();
      
    case 'saveDefaultConfig':
      // Save the default configuration template
      return await saveDefaultConfig(message.config);
      
    case 'addToWhitelist':
      // Add a domain to whitelist
      return await addToWhitelist(message.hostname);
      
    case 'removeFromWhitelist':
      // Remove a domain from whitelist
      return await removeFromWhitelist(message.hostname);
      
    case 'isHostWhitelisted':
      return await isHostWhitelisted(message.host);
      
    case 'getPresets':
      // Get all presets
      return await getPresets();
      
    case 'savePreset':
      // Save a preset
      return await savePreset(message.name, message.config);
      
    case 'deletePreset':
      // Delete a preset
      return await deletePreset(message.name);
      
    case 'renamePreset':
      // Rename a preset
      return await renamePreset(message.oldName, message.newName);
      
    case 'startElementPicking':
      // Options page is starting element picking
      setPickingState(true, 'startElementPicking message received');
      return { success: true };
      
    case 'elementPicked':
      // Element was picked, forward to all options pages
      console.log('==========================================');
      console.log('BACKGROUND RECEIVED elementPicked');
      console.log('Message:', message);
      console.log('isPickingElement:', isPickingElement);
      console.log('==========================================');
      
      // Optional: Show notification (can be disabled if annoying)
      // browser.notifications.create({
      //   type: 'basic',
      //   title: 'Element Picked',
      //   message: 'Picked: ' + (message.elementInfo ? message.elementInfo.selector : 'unknown'),
      //   iconUrl: browser.runtime.getURL('icons/icon-48.png')
      // }).catch(err => console.log('Notification failed:', err));
      
      // Allow elementPicked even if not explicitly in picking mode
      // This supports 4-finger gesture and right-click methods that don't set the flag
      if (!isPickingElement) {
        console.log('NOT IN PICKING MODE - but accepting anyway (4-finger gesture or direct activation)');
      } else {
        console.log('IN PICKING MODE - resetting state');
        setPickingState(false, 'Element picked, resetting state');
      }
      
      // FALLBACK: Store in local storage so options page can pick it up
      console.log('Storing picked element in local storage as fallback');
      try {
        await browser.storage.local.set({
          pickedElement: message.elementInfo,
          pickedElementTimestamp: Date.now()
        });
        console.log('Stored in local storage successfully');
      } catch (error) {
        console.error('Failed to store in local storage:', error);
      }
      
      try {
        // Try to find options page using extension views (works for both tabs and popups)
        const views = browser.extension.getViews({ type: 'popup' });
        console.log('Found', views.length, 'popup views');
        
        // Also check for tab views
        const tabViews = browser.extension.getViews({ type: 'tab' });
        console.log('Found', tabViews.length, 'tab views');
        
        const allViews = [...views, ...tabViews];
        
        // Forward message to all options views
        let forwarded = false;
        for (const view of allViews) {
          try {
            // Check if this view has our message handler
            if (view.location && view.location.href && view.location.href.includes('options.html')) {
              console.log('Found options view, dispatching message');
              // Dispatch message directly to the view
              if (view.browser && view.browser.runtime) {
                // Trigger the message handler by dispatching a custom event
                const event = new view.CustomEvent('gestureAutoscrollerMessage', {
                  detail: message
                });
                view.document.dispatchEvent(event);
                console.log('Dispatched custom event to options view');
                forwarded = true;
              }
            }
          } catch (error) {
            console.error('Failed to forward message to view:', error);
          }
        }
        
        if (!forwarded) {
          console.error('Could not forward message to any options view');
        }
        
        // Also try the tab approach as fallback
        const allTabs = await browser.tabs.query({});
        const optionsTabs = allTabs.filter(t => t.url && t.url.includes('options.html'));
        console.log('Found', optionsTabs.length, 'options tabs');
        
        for (const tab of optionsTabs) {
          try {
            console.log('Sending message to tab', tab.id);
            await browser.tabs.sendMessage(tab.id, message);
            console.log('Message sent to tab', tab.id);
            forwarded = true;
          } catch (error) {
            console.error('Failed to send message to tab', tab.id, ':', error);
          }
        }
        
        return { success: forwarded };
      } catch (error) {
        console.error('Failed to forward elementPicked message:', error);
        return { success: false };
      }
      
    default:
      return { error: 'Unknown action' };
  }
});

// ============================================================================
// SETTINGS API
// ============================================================================

// Get all configurations (for options page)
async function getAllConfigs() {
  try {
    const result = await browser.storage.local.get([
      'gesture_autoscroller_default_config',
      'gesture_autoscroller_domain_configs',
      'gesture_autoscroller_whitelist'
    ]);
    
    return {
      success: true,
      defaultConfig: result.gesture_autoscroller_default_config || { ...DEFAULT_CONFIG },
      domainConfigs: result.gesture_autoscroller_domain_configs || {},
      whitelist: result.gesture_autoscroller_whitelist || []
    };
  } catch (error) {
    console.error('Failed to get all configs:', error);
    return { success: false, error: error.message };
  }
}

// Get configuration for a specific domain (or default if not configured)
async function getDomainConfig(hostname) {
  try {
    const result = await browser.storage.local.get([
      'gesture_autoscroller_default_config',
      'gesture_autoscroller_domain_configs'
    ]);
    
    const domainConfigs = result.gesture_autoscroller_domain_configs || {};
    const defaultConfig = result.gesture_autoscroller_default_config || { ...DEFAULT_CONFIG };
    
    // Return domain-specific config if exists, otherwise return default
    const config = domainConfigs[hostname] || defaultConfig;
    
    return {
      success: true,
      config: config,
      hostname: hostname,
      isDefault: !domainConfigs[hostname]
    };
  } catch (error) {
    console.error('Failed to get domain config:', error);
    return { success: false, error: error.message };
  }
}

// Save configuration for a specific domain
async function saveDomainConfig(hostname, config) {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_domain_configs');
    const domainConfigs = result.gesture_autoscroller_domain_configs || {};
    
    // Update the config for this domain
    domainConfigs[hostname] = config;
    
    await browser.storage.local.set({
      gesture_autoscroller_domain_configs: domainConfigs
    });
    
    // Notify content scripts on this domain
    await notifyDomainConfigUpdate(hostname, config);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save domain config:', error);
    return { success: false, error: error.message };
  }
}

// Get default configuration template
async function getDefaultConfig() {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_default_config');
    const config = result.gesture_autoscroller_default_config || { ...DEFAULT_CONFIG };
    
    return { success: true, config };
  } catch (error) {
    console.error('Failed to get default config:', error);
    return { success: false, error: error.message };
  }
}

// Save default configuration template
async function saveDefaultConfig(config) {
  try {
    await browser.storage.local.set({
      gesture_autoscroller_default_config: config
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save default config:', error);
    return { success: false, error: error.message };
  }
}

// Legacy support: Save settings (now saves to default config)
async function saveSettings(settings) {
  try {
    // For backward compatibility, save to default config
    // and update whitelist if included
    if (settings.whitelistedHosts) {
      await browser.storage.local.set({
        gesture_autoscroller_whitelist: settings.whitelistedHosts
      });
    }
    
    // Extract config part (remove whitelistedHosts)
    const { whitelistedHosts, navigationSelectors, ...config } = settings;
    
    await browser.storage.local.set({
      gesture_autoscroller_default_config: config
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save settings:', error);
    return { success: false, error: error.message };
  }
}

// Notify content scripts on specific domain about config update
async function notifyDomainConfigUpdate(hostname, config) {
  try {
    const tabs = await browser.tabs.query({});
    
    for (const tab of tabs) {
      try {
        if (tab.url) {
          const url = new URL(tab.url);
          if (url.hostname === hostname || url.hostname.endsWith('.' + hostname)) {
            await browser.tabs.sendMessage(tab.id, {
              action: 'configUpdated',
              config: config
            });
          }
        }
      } catch (error) {
        // Tab might not have content script loaded, ignore
      }
    }
  } catch (error) {
    // Could not notify content scripts
  }
}

// ============================================================================
// WHITELIST MANAGEMENT
// ============================================================================

// Add hostname to whitelist
async function addToWhitelist(hostname) {
  try {
    const result = await browser.storage.local.get([
      'gesture_autoscroller_whitelist',
      'gesture_autoscroller_domain_configs',
      'gesture_autoscroller_default_config'
    ]);
    
    let whitelist = result.gesture_autoscroller_whitelist || [];
    const domainConfigs = result.gesture_autoscroller_domain_configs || {};
    const defaultConfig = result.gesture_autoscroller_default_config || { ...DEFAULT_CONFIG };
    
    // Check if already whitelisted
    if (whitelist.includes(hostname)) {
      return { success: true, alreadyExists: true };
    }
    
    // Add to whitelist
    whitelist.push(hostname);
    whitelist.sort();
    
    // Create domain config from default if doesn't exist
    if (!domainConfigs[hostname]) {
      domainConfigs[hostname] = { ...defaultConfig };
    }
    
    await browser.storage.local.set({
      gesture_autoscroller_whitelist: whitelist,
      gesture_autoscroller_domain_configs: domainConfigs
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to add to whitelist:', error);
    return { success: false, error: error.message };
  }
}

// Remove hostname from whitelist
async function removeFromWhitelist(hostname) {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_whitelist');
    let whitelist = result.gesture_autoscroller_whitelist || [];
    
    // Remove from whitelist
    whitelist = whitelist.filter(h => h !== hostname);
    
    await browser.storage.local.set({
      gesture_autoscroller_whitelist: whitelist
    });
    
    // Note: We don't delete the domain config, so user can re-enable without losing settings
    
    return { success: true };
  } catch (error) {
    console.error('Failed to remove from whitelist:', error);
    return { success: false, error: error.message };
  }
}

// Check if host is whitelisted
async function isHostWhitelisted(host) {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_whitelist');
    const whitelist = result.gesture_autoscroller_whitelist || [];
    
    if (whitelist.length === 0) {
      return { success: true, isWhitelisted: false };
    }
    
    // Check if host matches any whitelisted host
    const isWhitelisted = whitelist.some(whitelistedHost => {
      // Exact match
      if (host === whitelistedHost) return true;
      
      // Subdomain match (e.g., "example.com" matches "www.example.com")
      if (host.endsWith('.' + whitelistedHost)) return true;
      
      return false;
    });
    
    return { success: true, isWhitelisted };
  } catch (error) {
    console.error('Failed to check whitelist:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// PRESET MANAGEMENT
// ============================================================================

// Get all presets
async function getPresets() {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_presets');
    const presets = result.gesture_autoscroller_presets || {};
    
    return { success: true, presets };
  } catch (error) {
    console.error('Failed to get presets:', error);
    return { success: false, error: error.message };
  }
}

// Save a preset (config without navigationSelector)
async function savePreset(name, config) {
  try {
    if (!name || name.trim() === '') {
      return { success: false, error: 'Preset name cannot be empty' };
    }
    
    // Remove navigationSelector from config before saving
    const { navigationSelector, ...presetConfig } = config;
    
    // Get existing presets
    const result = await browser.storage.local.get('gesture_autoscroller_presets');
    const presets = result.gesture_autoscroller_presets || {};
    
    // Save preset
    presets[name] = presetConfig;
    
    await browser.storage.local.set({
      gesture_autoscroller_presets: presets
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save preset:', error);
    return { success: false, error: error.message };
  }
}

// Delete a preset
async function deletePreset(name) {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_presets');
    const presets = result.gesture_autoscroller_presets || {};
    
    // Check if preset exists
    if (!presets[name]) {
      return { success: false, error: 'Preset not found' };
    }
    
    // Delete preset
    delete presets[name];
    
    await browser.storage.local.set({
      gesture_autoscroller_presets: presets
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to delete preset:', error);
    return { success: false, error: error.message };
  }
}

// Rename a preset
async function renamePreset(oldName, newName) {
  try {
    if (!newName || newName.trim() === '') {
      return { success: false, error: 'Preset name cannot be empty' };
    }
    
    const result = await browser.storage.local.get('gesture_autoscroller_presets');
    const presets = result.gesture_autoscroller_presets || {};
    
    // Check if old preset exists
    if (!presets[oldName]) {
      return { success: false, error: 'Preset not found' };
    }
    
    // Check if new name already exists
    if (presets[newName] && oldName !== newName) {
      return { success: false, error: 'Preset name already exists' };
    }
    
    // Rename preset
    presets[newName] = presets[oldName];
    if (oldName !== newName) {
      delete presets[oldName];
    }
    
    await browser.storage.local.set({
      gesture_autoscroller_presets: presets
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to rename preset:', error);
    return { success: false, error: error.message };
  }
}

// Update browser action icon based on current tab
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    await updateBrowserActionIcon(tab);
  } catch (error) {
    console.error('Failed to update browser action icon:', error);
  }
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only update icon when URL changes
  if (changeInfo.url) {
    await updateBrowserActionIcon(tab);
  }
});

// Update browser action icon based on whitelist status
async function updateBrowserActionIcon(tab) {
  try {
    if (!tab.url) return;
    
    const url = new URL(tab.url);
    const host = url.hostname;
    
    // Skip special URLs
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return;
    }
    
    const result = await isHostWhitelisted(host);
    
    if (result.success) {
      const title = result.isWhitelisted 
        ? 'Gesture AutoScroller (Active)'
        : 'Gesture AutoScroller (Inactive)';
      
      // Update browser action title
      await browser.browserAction.setTitle({
        tabId: tab.id,
        title: title
      });
      
      // Note: Firefox Android has limited support for icon changes
      // We keep the same icon but change the title to indicate status
    }
  } catch (error) {
    // Ignore errors for special tabs
  }
}

// Listen for storage changes and notify content scripts
browser.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local') {
    try {
      // Check if domain configs changed
      if (changes.gesture_autoscroller_domain_configs) {
        const newConfigs = changes.gesture_autoscroller_domain_configs.newValue || {};
        const oldConfigs = changes.gesture_autoscroller_domain_configs.oldValue || {};
        
        // Find which domains changed
        const changedDomains = new Set([
          ...Object.keys(newConfigs),
          ...Object.keys(oldConfigs)
        ]);
        
        const tabs = await browser.tabs.query({});
        
        for (const tab of tabs) {
          try {
            if (tab.url) {
              const url = new URL(tab.url);
              const hostname = url.hostname;
              
              // Check if this tab's domain config changed
              for (const domain of changedDomains) {
                if (hostname === domain || hostname.endsWith('.' + domain)) {
                  // Send updated config to this tab
                  const config = newConfigs[domain];
                  if (config) {
                    await browser.tabs.sendMessage(tab.id, {
                      action: 'configUpdated',
                      config: config
                    });
                  }
                  break;
                }
              }
            }
          } catch (error) {
            // Tab might not have content script loaded, ignore
          }
        }
      }
      
      // Check if default config changed (notify all tabs without specific config)
      if (changes.gesture_autoscroller_default_config) {
        const newDefaultConfig = changes.gesture_autoscroller_default_config.newValue;
        if (newDefaultConfig) {
          const domainConfigs = await browser.storage.local.get('gesture_autoscroller_domain_configs');
          const configs = domainConfigs.gesture_autoscroller_domain_configs || {};
          
          const tabs = await browser.tabs.query({});
          
          for (const tab of tabs) {
            try {
              if (tab.url) {
                const url = new URL(tab.url);
                const hostname = url.hostname;
                
                // If no specific config for this domain, send default
                if (!configs[hostname]) {
                  await browser.tabs.sendMessage(tab.id, {
                    action: 'configUpdated',
                    config: newDefaultConfig
                  });
                }
              }
            } catch (error) {
              // Tab might not have content script loaded, ignore
            }
          }
        }
      }
    } catch (error) {
      // Could not notify content scripts
      console.error('Error in storage change listener:', error);
    }
  }
});

// ============================================================================
// CONTEXT MENU FOR ELEMENT SELECTION
// ============================================================================

// Create context menu for selecting navigation button
async function createContextMenu() {
  try {
    await browser.contextMenus.removeAll();
    
    browser.contextMenus.create({
      id: 'select-next-button',
      title: 'Select as "Next Page" button',
      contexts: ['link', 'all']
    });
  } catch (error) {
    console.error('Failed to create context menu:', error);
  }
}

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'select-next-button') {
    try {
      // Request the content script to capture the clicked element's selector
      const response = await browser.tabs.sendMessage(tab.id, {
        action: 'captureElementSelector',
        frameId: info.frameId
      });
      
      if (response && response.success) {
        // Build options URL with captured selector info
        const optionsBaseUrl = browser.runtime.getURL('options.html');
        const optionsUrl = optionsBaseUrl + 
          `?selector=${encodeURIComponent(response.selector)}&` +
          `hostname=${encodeURIComponent(response.hostname)}`;
        
        // Check if options page is already open
        const tabs = await browser.tabs.query({});
        let optionsTab = null;
        
        for (const t of tabs) {
          if (t.url && t.url.startsWith(optionsBaseUrl)) {
            optionsTab = t;
            break;
          }
        }
        
        if (optionsTab) {
          // Update existing options tab
          await browser.tabs.update(optionsTab.id, { url: optionsUrl, active: true });
        } else {
          // Create new options tab
          await browser.tabs.create({ url: optionsUrl });
        }
      }
    } catch (error) {
      console.error('Failed to capture element selector:', error);
    }
  }
});

// Initialize context menu on startup
createContextMenu();

// Handle browser action (toolbar icon) clicks - open options in tab
browser.browserAction.onClicked.addListener(async () => {
  try {
    // Check if options page is already open
    const allTabs = await browser.tabs.query({});
    const optionsUrl = browser.runtime.getURL('options.html');
    const optionsTab = allTabs.find(t => t.url && t.url.startsWith(optionsUrl));
    
    if (optionsTab) {
      // Options page already open, switch to it
      await browser.tabs.update(optionsTab.id, { active: true });
    } else {
      // Open new options tab
      await browser.tabs.create({ url: 'options.html' });
    }
  } catch (error) {
    console.error('Failed to open options page:', error);
  }
});

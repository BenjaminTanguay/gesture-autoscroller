// Gesture AutoScroller - Background Script
// Handles settings storage, initialization, and message passing

// Default settings
const DEFAULT_SETTINGS = {
  tapNavigationEnabled: true,
  autoscrollEnabled: true,
  defaultSpeed: 20,      // px/sec
  minSpeed: 1,           // px/sec
  maxSpeed: 3000,        // px/sec
  granularity: 10,       // px/sec
  whitelistedHosts: []
};

// Initialize settings on extension install/update
browser.runtime.onInstalled.addListener(async (details) => {
  console.log('Gesture AutoScroller installed/updated:', details.reason);
  
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_settings');
    
    if (!result.gesture_autoscroller_settings) {
      // First install - set default settings
      await browser.storage.local.set({
        gesture_autoscroller_settings: DEFAULT_SETTINGS
      });
      console.log('Default settings initialized');
    } else {
      // Update - merge with defaults to add any new settings
      const currentSettings = result.gesture_autoscroller_settings;
      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...currentSettings
      };
      
      await browser.storage.local.set({
        gesture_autoscroller_settings: mergedSettings
      });
      console.log('Settings updated with new defaults');
    }
  } catch (error) {
    console.error('Failed to initialize settings:', error);
  }
});

// Listen for messages from content scripts and options page
browser.runtime.onMessage.addListener(async (message, sender) => {
  console.log('Background received message:', message.action);
  
  switch (message.action) {
    case 'getSettings':
      return await getSettings();
      
    case 'saveSettings':
      return await saveSettings(message.settings);
      
    case 'isHostWhitelisted':
      return await isHostWhitelisted(message.host);
      
    default:
      console.warn('Unknown message action:', message.action);
      return { error: 'Unknown action' };
  }
});

// Get current settings
async function getSettings() {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_settings');
    const settings = result.gesture_autoscroller_settings || DEFAULT_SETTINGS;
    return { success: true, settings };
  } catch (error) {
    console.error('Failed to get settings:', error);
    return { success: false, error: error.message };
  }
}

// Save settings
async function saveSettings(settings) {
  try {
    await browser.storage.local.set({
      gesture_autoscroller_settings: settings
    });
    console.log('Settings saved:', settings);
    return { success: true };
  } catch (error) {
    console.error('Failed to save settings:', error);
    return { success: false, error: error.message };
  }
}

// Check if host is whitelisted
async function isHostWhitelisted(host) {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_settings');
    const settings = result.gesture_autoscroller_settings || DEFAULT_SETTINGS;
    
    if (!settings.whitelistedHosts || settings.whitelistedHosts.length === 0) {
      return { success: true, isWhitelisted: false };
    }
    
    // Check if host matches any whitelisted host
    const isWhitelisted = settings.whitelistedHosts.some(whitelistedHost => {
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
    console.log('Could not update browser action icon:', error.message);
  }
}

// Listen for storage changes and notify content scripts
browser.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.gesture_autoscroller_settings) {
    console.log('Settings changed, notifying content scripts');
    
    try {
      const tabs = await browser.tabs.query({});
      const newSettings = changes.gesture_autoscroller_settings.newValue;
      
      for (const tab of tabs) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: newSettings
          });
        } catch (error) {
          // Tab might not have content script loaded, ignore
        }
      }
    } catch (error) {
      console.log('Could not notify content scripts:', error);
    }
  }
});

console.log('Gesture AutoScroller background script initialized');

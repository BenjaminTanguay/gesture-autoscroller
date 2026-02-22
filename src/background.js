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
  tapScrollPercentage: 100,  // Percentage of viewport height to scroll (10-100%)
  tapZoneLayout: 'horizontal', // Options: 'horizontal', 'vertical'
  tapZoneUpPercentage: 50,   // Size of scroll-up zone (10-90%), remaining is scroll-down
  whitelistedHosts: [],
  
  // Auto-navigate settings
  autoNavigateEnabled: false,           // Global enable/disable
  autoNavigateDelay: 3,                 // Seconds before clicking next (1-30)
  autoNavigateAutoStart: true,          // Auto-start scroll on new page
  
  // Per-site navigation selectors (hostname -> config)
  navigationSelectors: {}
};

// Initialize settings on extension install/update
browser.runtime.onInstalled.addListener(async (details) => {
  try {
    const result = await browser.storage.local.get('gesture_autoscroller_settings');
    
    if (!result.gesture_autoscroller_settings) {
      // First install - set default settings
      await browser.storage.local.set({
        gesture_autoscroller_settings: DEFAULT_SETTINGS
      });
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
    }
    
    // Create context menu item for selecting navigation button
    await createContextMenu();
  } catch (error) {
    console.error('Failed to initialize settings:', error);
  }
});

// Track if we're currently picking an element
let isPickingElement = false;

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
    case 'getSettings':
      return await getSettings();
      
    case 'saveSettings':
      return await saveSettings(message.settings);
      
    case 'isHostWhitelisted':
      return await isHostWhitelisted(message.host);
      
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
      
      if (!isPickingElement) {
        console.log('NOT IN PICKING MODE - REJECTING MESSAGE');
        console.log('This means isPickingElement was never set to true, or was already reset');
        return { success: false };
      }
      
      setPickingState(false, 'Element picked, resetting state');
      
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
  }
}

// Listen for storage changes and notify content scripts
browser.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.gesture_autoscroller_settings) {
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
      // Could not notify content scripts
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

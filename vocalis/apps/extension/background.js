// Scribe Background Service Worker
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  
  // Restricted system pages where content scripts cannot run
  if (tab.url && (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:') ||
    tab.url.startsWith('view-source:')
  )) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggle_scribe_bar' });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
    } catch {
      // Silently ignore if tab is not injectable
    }
  }
});

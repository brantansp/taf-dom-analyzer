// This runs on every page load
// You can add any initialization code here if needed

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    // Could trigger analysis from content script
    sendResponse({ status: 'received' });
  }
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open_dom_tree_analyzer",
    title: "Open DOM Tree Analyzer",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open_dom_tree_analyzer" && tab) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});
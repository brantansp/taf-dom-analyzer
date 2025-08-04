document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const cleanupBtn = document.getElementById('cleanupBtn');
  const exportBtn = document.getElementById('exportBtn');
  const darkToggle = document.getElementById('darkToggle');
  const status = document.getElementById('status');
  const results = document.getElementById('results');

  // Initialize dark mode
  initializeDarkMode();

  // Auto-update current tab info
  updateTabInfo();

  // Dark mode toggle handler
  darkToggle.addEventListener('click', () => {
    toggleDarkMode();
  });

  function initializeDarkMode() {
    // Load saved dark mode preference
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      darkToggle.classList.add('active');
    }
  }

  function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    darkToggle.classList.toggle('active', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);

    // Update status with smooth transition
    setTimeout(() => {
      if (isDarkMode) {
        console.log(`&#127769; Dark mode enabled`);
      } else {
        console.log(`&#9728; Light mode enabled`);
      }
    }, 150);
  }

  // Auto-update current tab info
  updateTabInfo();

  analyzeBtn.addEventListener('click', async () => {
    try {
      status.innerHTML = `&#9203; Analyzing page...`;
      analyzeBtn.disabled = true;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const settings = {
        doHighlightElements: document.getElementById('doHighlight').checked,
        focusHighlightIndex: -1,
        viewportExpansion: parseInt(document.getElementById('viewportExpansion').value),
        debugMode: false,
        maxElements: parseInt(document.getElementById('maxElements').value),
        prioritizeByImportance: document.getElementById('prioritizeByImportance').checked
      };

      // Load the analyzePage script and execute it
      const loadResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['analyzePage.js']
      });

      // Execute the analyzePage function with settings
      const scriptResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (settings) => {
          return window.analyzePage(settings);
        },
        args: [settings]
      });

      if (scriptResults && scriptResults[0] && scriptResults[0].result) {
        const { totalElements, highlightedElements } = scriptResults[0].result;

        // Update results section
        document.getElementById('totalCount').textContent = totalElements;
        document.getElementById('highlightedCount').textContent = highlightedElements;
        document.getElementById('pageTitle').textContent = tab.title;
        document.getElementById('pageUrl').textContent = new URL(tab.url).hostname;

        results.classList.add('visible');
        status.innerHTML = `&#9989; Analysis complete! Found ${totalElements} elements, ${highlightedElements} highlighted`;
      } else {
        status.innerHTML = `&#9888; Analysis completed but no data returned`;
      }
    } catch (error) {
      console.error('Analysis error:', error);
      status.innerHTML = `&#10060 Error: ${error.message}`;
    } finally {
      analyzeBtn.disabled = false;
    }
  });

  cleanupBtn.addEventListener('click', async () => {
    try {
      status.innerHTML = `&#129529; Cleaning up...`;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (window.cleanupHighlights) {
            window.cleanupHighlights();
            return true;
          }

          // Fallback cleanup
          const container = document.getElementById("dom-tree-analyzer-container");
          if (container) container.remove();

          if (window._highlightCleanupFunctions) {
            window._highlightCleanupFunctions.forEach(fn => fn());
            window._highlightCleanupFunctions = [];
          }

          return true;
        }
      });

      results.classList.remove('visible');
      status.innerHTML = `&#10024; Highlights cleaned up successfully`;
    } catch (error) {
      status.innerHTML = `&#10060; Cleanup Error: ${error.message}`;
    }
  });

  exportBtn.addEventListener('click', async () => {
    try {
      status.innerHTML = `$#9203; Exporting data...`;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const exportResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Get only interactive elements for LLM
          const highlightedElements = Object.values(window.DOM_HASH_MAP || {}).filter(node =>
            node.highlightIndex !== undefined
          );

          // Helper function to get text content
          function getElementText(nodeData) {
            if (nodeData.text) return nodeData.text;

            let text = '';
            for (const childId of nodeData.children || []) {
              const child = window.DOM_HASH_MAP[childId];
              if (child && child.tagName === '#text' && child.text) {
                text += child.text + ' ';
              } else if (child) {
                text += getElementText(child) + ' ';
              }
            }
            return text.trim().substring(0, 100);
          }

          // Helper function to generate description
          function generateElementDescription(node) {
            const { tagName, attributes } = node;
            const text = getElementText(node);

            let description = tagName;

            if (attributes.type) description += ` (${attributes.type})`;
            if (attributes.placeholder) description += ` placeholder="${attributes.placeholder}"`;
            if (attributes.value) description += ` value="${attributes.value}"`;
            if (attributes.href) description += ` href="${attributes.href}"`;
            if (attributes.title) description += ` title="${attributes.title}"`;
            if (attributes.alt) description += ` alt="${attributes.alt}"`;

            if (text && text.length > 0) {
              description += ` text="${text}"`;
            }

            if (attributes.role) description += ` role="${attributes.role}"`;
            if (attributes['aria-label']) description += ` aria-label="${attributes['aria-label']}"`;

            return description;
          }

          // Return only interactive elements data for LLM
          return {
            pageInfo: {
              title: document.title,
              url: window.location.href,
              timestamp: new Date().toISOString()
            },
            interactiveElements: highlightedElements.map(node => ({
              index: node.highlightIndex,
              tagName: node.tagName,
              attributes: node.attributes,
              xpath: node.xpath,
              text: getElementText(node),
              isVisible: node.isVisible,
              isInViewport: node.isInViewport,
              description: generateElementDescription(node)
            })).sort((a, b) => a.index - b.index),
            totalInteractiveElements: highlightedElements.length
          };
        }
      });

      if (exportResults && exportResults[0] && exportResults[0].result) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `interactive-elements-${timestamp}.json`;

        const dataStr = JSON.stringify(exportResults[0].result, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        await chrome.downloads.download({
          url: url,
          filename: filename
        });

        URL.revokeObjectURL(url);
        status.innerHTML = `&#128190; Data exported as ${filename}`;
      }
    } catch (error) {
      status.innerHTML = `&#10060; Export Error: ${error.message}`;
    }
  });

  // Update tab info periodically
  async function updateTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        document.getElementById('pageTitle').textContent = tab.title || 'Unknown';
        document.getElementById('pageUrl').textContent = tab.url ? new URL(tab.url).hostname : 'Unknown';
      }
    } catch (error) {
      console.error('Error updating tab info:', error);
    }
  }

  // Listen for tab changes
  chrome.tabs.onActivated.addListener(updateTabInfo);
  chrome.tabs.onUpdated.addListener(updateTabInfo);
});

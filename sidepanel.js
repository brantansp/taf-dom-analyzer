document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const cleanupBtn = document.getElementById('cleanupBtn');
  const exportBtn = document.getElementById('exportBtn');
  const darkToggle = document.getElementById('darkToggle');
  const viewportExpansionToggle = document.getElementById('viewportExpansionToggle');
  const status = document.getElementById('status');
  const results = document.getElementById('results');

  // Initialize dark mode
  initializeDarkMode();
  initializeViewportExpansion();

  // Auto-update current tab info
  updateTabInfo();

  // Dark mode toggle handler
  darkToggle.addEventListener('click', () => {
    toggleDarkMode();
  });

  // Viewport expansion toggle handler
  viewportExpansionToggle.addEventListener('click', () => {
    toggleViewportExpansion();
  });

  function initializeDarkMode() {
    // Load saved dark mode preference, default to true (dark mode) if not set
    const isDarkMode = localStorage.getItem('darkMode') !== 'false'; // Default to true unless explicitly set to false
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      darkToggle.classList.add('active');
    }
    // Store the initial preference if it wasn't set before
    if (localStorage.getItem('darkMode') === null) {
      localStorage.setItem('darkMode', 'true');
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

  function toggleViewportExpansion() {
    const isActive = viewportExpansionToggle.classList.toggle('active');
    localStorage.setItem('viewportExpansion', isActive);
  }

  function initializeViewportExpansion() {
    // Load saved viewport expansion preference
    const isViewportExpansionActive = localStorage.getItem('viewportExpansion') === 'true';
    if (isViewportExpansionActive) {
      viewportExpansionToggle.classList.add('active');
    }
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
        viewportExpansion: viewportExpansionToggle.classList.contains('active') ? -1 : 0,
        debugMode: false
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
        const { totalElements, highlightedElements, interactiveElements } = scriptResults[0].result;

        // Update results section
        document.getElementById('totalCount').textContent = totalElements;
        document.getElementById('highlightedCount').textContent = highlightedElements;
        document.getElementById('pageTitle').textContent = tab.title;
        document.getElementById('pageUrl').textContent = new URL(tab.url).hostname;

        // Populate the detailed results table
        populateResultsTable(interactiveElements || []);

        results.classList.add('visible');
        document.getElementById('detailedResults').classList.add('visible');
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
      document.getElementById('detailedResults').classList.remove('visible');
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

          // Helper function to generate CSS selector
          function generateCssSelector(node, nodeElement) {
            if (!nodeElement) return '';

            try {
              // Try ID first
              if (nodeElement.id) {
                return `#${nodeElement.id}`;
              }

              // Try unique class combination
              if (nodeElement.className && typeof nodeElement.className === 'string') {
                const classes = nodeElement.className.trim().split(/\s+/).filter(cls => cls.length > 0);
                if (classes.length > 0) {
                  const classSelector = '.' + classes.join('.');
                  const elements = document.querySelectorAll(classSelector);
                  if (elements.length === 1 && elements[0] === nodeElement) {
                    return classSelector;
                  }
                }
              }

              // Build path from parent to child
              const path = [];
              let current = nodeElement;

              while (current && current !== document.body) {
                let selector = current.tagName.toLowerCase();

                // Add ID if available
                if (current.id) {
                  selector += `#${current.id}`;
                  path.unshift(selector);
                  break;
                }

                // Add class if available and distinctive
                if (current.className && typeof current.className === 'string') {
                  const classes = current.className.trim().split(/\s+/).filter(cls => cls.length > 0);
                  if (classes.length > 0) {
                    const distinctiveClass = classes.find(cls =>
                      /^(btn|button|input|form|modal|dialog|menu|nav|header|footer|main|content|container|wrapper|card|item|entry)/.test(cls)
                    );
                    if (distinctiveClass) {
                      selector += `.${distinctiveClass}`;
                    } else if (classes.length === 1) {
                      selector += `.${classes[0]}`;
                    }
                  }
                }

                // Add nth-child if needed for uniqueness
                if (current.parentElement) {
                  const siblings = Array.from(current.parentElement.children)
                    .filter(sibling => sibling.tagName === current.tagName);
                  if (siblings.length > 1) {
                    const index = siblings.indexOf(current) + 1;
                    selector += `:nth-child(${index})`;
                  }
                }

                path.unshift(selector);
                current = current.parentElement;
              }

              return path.join(' > ');
            } catch (error) {
              console.warn('CSS selector generation failed:', error);
              return '';
            }
          }

          // Helper function to find DOM element by xpath
          function findElementByXPath(xpath) {
            try {
              const result = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              return result.singleNodeValue;
            } catch (error) {
              console.warn('XPath evaluation failed:', error);
              return null;
            }
          }

          // Return only interactive elements data for LLM
          return {
            interactiveElements: highlightedElements.map(node => {
              const nodeElement = findElementByXPath(node.xpath);
              const elementText = getElementText(node);

              return {
                index: node.highlightIndex,
                tagName: node.tagName,
                attributes: node.attributes,
                description: generateElementDescription(node),
                isVisible: node.isVisible,
                isInViewport: node.isInViewport,
                locators: {
                  text: elementText || (node.attributes.value || node.attributes.placeholder || node.attributes['aria-label'] || node.attributes.title || '').substring(0, 50),
                  cssPath: generateCssSelector(node, nodeElement),
                  xpath: node.xpath
                }
              };
            }).sort((a, b) => a.index - b.index),
            pageInfo: {
              title: document.title,
              url: window.location.href,
              timestamp: new Date().toISOString()
            },
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

  // Function to populate the detailed results table
  function populateResultsTable(interactiveElements) {
    const tableBody = document.getElementById('detailedResultsBody');
    tableBody.innerHTML = ''; // Clear existing rows

    if (!interactiveElements || interactiveElements.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="5" style="text-align: center; padding: 20px; color: #718096;">No interactive elements found</td>';
      tableBody.appendChild(emptyRow);
      return;
    }

    // First, we need to fetch the CSS paths for each element since they might not be in the analysis result
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];

      // Get CSS paths by executing the export script function which generates them
      const cssPathResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const highlightedElements = Object.values(window.DOM_HASH_MAP || {}).filter(node =>
            node.highlightIndex !== undefined
          );

          // Helper function to generate CSS selector
          function generateCssSelector(node, nodeElement) {
            if (!nodeElement) return '';

            try {
              // Try ID first
              if (nodeElement.id) {
                return `#${nodeElement.id}`;
              }

              // Try unique class combination
              if (nodeElement.className && typeof nodeElement.className === 'string') {
                const classes = nodeElement.className.trim().split(/\s+/).filter(cls => cls.length > 0);
                if (classes.length > 0) {
                  const classSelector = '.' + classes.join('.');
                  const elements = document.querySelectorAll(classSelector);
                  if (elements.length === 1 && elements[0] === nodeElement) {
                    return classSelector;
                  }
                }
              }

              // Build path from parent to child
              const path = [];
              let current = nodeElement;

              while (current && current !== document.body) {
                let selector = current.tagName.toLowerCase();

                // Add ID if available
                if (current.id) {
                  selector += `#${current.id}`;
                  path.unshift(selector);
                  break;
                }

                // Add class if available and distinctive
                if (current.className && typeof current.className === 'string') {
                  const classes = current.className.trim().split(/\s+/).filter(cls => cls.length > 0);
                  if (classes.length > 0) {
                    const distinctiveClass = classes.find(cls =>
                      /^(btn|button|input|form|modal|dialog|menu|nav|header|footer|main|content|container|wrapper|card|item|entry)/.test(cls)
                    );
                    if (distinctiveClass) {
                      selector += `.${distinctiveClass}`;
                    } else if (classes.length === 1) {
                      selector += `.${classes[0]}`;
                    }
                  }
                }

                // Add nth-child if needed for uniqueness
                if (current.parentElement) {
                  const siblings = Array.from(current.parentElement.children)
                    .filter(sibling => sibling.tagName === current.tagName);
                  if (siblings.length > 1) {
                    const index = siblings.indexOf(current) + 1;
                    selector += `:nth-child(${index})`;
                  }
                }

                path.unshift(selector);
                current = current.parentElement;
              }

              return path.join(' > ');
            } catch (error) {
              console.warn('CSS selector generation failed:', error);
              return '';
            }
          }

          // Helper function to find DOM element by xpath
          function findElementByXPath(xpath) {
            try {
              const result = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              return result.singleNodeValue;
            } catch (error) {
              console.warn('XPath evaluation failed:', error);
              return null;
            }
          }

          // Generate CSS paths for all elements
          const elementsCssData = {};
          highlightedElements.forEach(node => {
            const nodeElement = findElementByXPath(node.xpath);
            elementsCssData[node.highlightIndex] = generateCssSelector(node, nodeElement);
          });

          return elementsCssData;
        }
      });

      const cssPathData = cssPathResults?.[0]?.result || {};

      // Now populate the table with the CSS path data
      interactiveElements.forEach(element => {
        const row = document.createElement('tr');

        // Helper function to safely escape HTML and truncate text
        const safeText = (text, maxLength = 100) => {
          if (!text) return '';
          const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return escaped.length > maxLength ? escaped.substring(0, maxLength) + '...' : escaped;
        };

        // Helper function to copy text to clipboard
        const copyToClipboard = async (text, cellElement) => {
          try {
            await navigator.clipboard.writeText(text);
            // Visual feedback
            const originalBg = cellElement.style.backgroundColor;
            cellElement.style.backgroundColor = '#48bb78';
            cellElement.style.color = 'white';
            setTimeout(() => {
              cellElement.style.backgroundColor = originalBg;
              cellElement.style.color = '';
            }, 200);
          } catch (err) {
            console.error('Failed to copy to clipboard:', err);
          }
        };

        // Get data with CSS path from our generated data
        const xpath = element.locators?.xpath || element.xpath || '';
        const cssPath = cssPathData[element.index] || element.locators?.cssPath || '';
        const textContent = element.locators?.text || element.text || '';
        const tagName = element.tagName || '';

        // Create cells in the new order: Index, Tag Name, XPath, CSS Path, Text
        const indexCell = document.createElement('td');
        indexCell.className = 'index-col';
        indexCell.textContent = element.index;

        const tagCell = document.createElement('td');
        tagCell.className = 'tagname-col';
        tagCell.textContent = tagName;
        tagCell.style.cursor = 'pointer';
        tagCell.addEventListener('click', () => copyToClipboard(tagName, tagCell));

        const xpathCell = document.createElement('td');
        xpathCell.className = 'xpath-col';
        xpathCell.textContent = safeText(xpath, 50);
        xpathCell.title = xpath;
        xpathCell.style.cursor = 'pointer';
        xpathCell.addEventListener('click', () => copyToClipboard(xpath, xpathCell));

        const cssCell = document.createElement('td');
        cssCell.className = 'css-col';
        cssCell.textContent = safeText(cssPath, 50);
        cssCell.title = cssPath;
        cssCell.style.cursor = 'pointer';
        cssCell.addEventListener('click', () => copyToClipboard(cssPath, cssCell));

        const textCell = document.createElement('td');
        textCell.className = 'text-col';
        textCell.textContent = safeText(textContent, 30);
        textCell.title = textContent;
        textCell.style.cursor = 'pointer';
        textCell.addEventListener('click', () => copyToClipboard(textContent, textCell));

        // Append cells to row in the new order
        row.appendChild(indexCell);
        row.appendChild(tagCell);
        row.appendChild(xpathCell);
        row.appendChild(cssCell);
        row.appendChild(textCell);

        tableBody.appendChild(row);
      });
    });
  }
});

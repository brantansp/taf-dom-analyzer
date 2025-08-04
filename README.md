# DOM Analyzer

A powerful DOM analysis tool that can be used across different contexts: Chrome Extension, direct browser console, Playwright automation, and Selenium frameworks.

## Files

- `analyzePage.js` - Standalone DOM analysis function
- `popup.js` - Chrome extension popup interface
- `popup.html` - Extension UI
- `manifest.json` - Chrome extension manifest

## Usage Examples

### 1. Chrome Console (Direct Usage)

```javascript
// Copy-paste the entire analyzePage.js content into console, then:
const result = analyzePage({
  doHighlightElements: true,
  viewportExpansion: 0,
  debugMode: true
});

console.log(`Found ${result.totalElements} elements, ${result.highlightedElements} highlighted`);

// Cleanup highlights
cleanupHighlights();
```

### 2. Playwright (JavaScript/TypeScript)

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  
  // Load the analyzer
  await page.addScriptTag({ path: './analyzePage.js' });
  
  // Run analysis
  const result = await page.evaluate(() => {
    return analyzePage({
      doHighlightElements: true,
      viewportExpansion: 100,
      debugMode: false
    });
  });
  
  console.log(`Analysis complete: ${result.totalElements} elements found`);
  
  // Cleanup
  await page.evaluate(() => cleanupHighlights());
  await browser.close();
})();
```

### 3. Selenium (Python)

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
import json

driver = webdriver.Chrome()
driver.get("https://example.com")

# Load the analyzer script
with open('analyzePage.js', 'r') as f:
    analyzer_script = f.read()

driver.execute_script(analyzer_script)

# Run analysis
result = driver.execute_script("""
  return analyzePage({
    doHighlightElements: true,
    viewportExpansion: 0,
    debugMode: false
  });
""")

print(f"Found {result['totalElements']} elements, {result['highlightedElements']} highlighted")

# Cleanup
driver.execute_script("cleanupHighlights();")
driver.quit()
```

### 4. Selenium (Java)

```java
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.JavascriptExecutor;
import java.nio.file.Files;
import java.nio.file.Paths;

WebDriver driver = new ChromeDriver();
JavascriptExecutor js = (JavascriptExecutor) driver;

driver.get("https://example.com");

// Load analyzer script
String analyzerScript = new String(Files.readAllBytes(Paths.get("analyzePage.js")));
js.executeScript(analyzerScript);

// Run analysis
Object result = js.executeScript(
  "return analyzePage({" +
  "  doHighlightElements: true," +
  "  viewportExpansion: 0," +
  "  debugMode: false" +
  "});"
);

System.out.println("Analysis result: " + result.toString());

// Cleanup
js.executeScript("cleanupHighlights();");
driver.quit();
```

## Settings Options

```javascript
const settings = {
  doHighlightElements: true,      // Whether to visually highlight elements
  focusHighlightIndex: -1,        // Highlight only specific index (-1 for all)
  viewportExpansion: 0,           // Expand viewport bounds (pixels, -1 for no limit)
  debugMode: false,               // Enable debug logging
  maxElements: 10000,             // Maximum elements to process
  prioritizeByImportance: true    // Prioritize important interactive elements
};
```

## Output Format

```javascript
{
  rootId: "0",                    // Root element ID in the map
  map: {                          // DOM tree as flat hash map
    "0": {
      tagName: "body",
      attributes: {},
      xpath: "body",
      children: ["1", "2", "3"],
      isVisible: true,
      isInteractive: false,
      highlightIndex: undefined,  // Only set for highlighted elements
      // ... other properties
    }
  },
  totalElements: 150,             // Total elements processed
  highlightedElements: 25,        // Elements that were highlighted
  timestamp: "2024-01-15T10:30:00Z",
  url: "https://example.com",
  title: "Example Page"
}
```


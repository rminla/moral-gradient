const { chromium } = require('playwright');

async function findOverflowSource() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  console.log('=== Finding Exact Overflow Source ===\n');
  
  await page.goto('http://localhost:3000/quiz-v4');
  await page.click('text=START');
  await page.waitForSelector('text=The Trolley', { timeout: 10000 });
  await page.waitForTimeout(500);
  
  const analysis = await page.evaluate(() => {
    const findings = [];
    
    // Check the header container
    const headerContainer = document.querySelector('.mx-auto.flex.h-16.max-w-\\[1200px\\]');
    if (headerContainer) {
      const rect = headerContainer.getBoundingClientRect();
      const styles = window.getComputedStyle(headerContainer);
      
      findings.push({
        element: 'HEADER CONTAINER (max-w-[1200px])',
        classes: headerContainer.className,
        scrollWidth: headerContainer.scrollWidth,
        offsetWidth: headerContainer.offsetWidth,
        boundingWidth: rect.width,
        boundingRight: rect.right,
        computedWidth: styles.width,
        marginLeft: styles.marginLeft,
        marginRight: styles.marginRight
      });
      
      // Check children
      const children = Array.from(headerContainer.children);
      children.forEach(child => {
        const childRect = child.getBoundingClientRect();
        const childStyles = window.getComputedStyle(child);
        
        findings.push({
          element: `  CHILD: ${child.tagName}`,
          classes: child.className.substring(0, 80),
          scrollWidth: child.scrollWidth,
          offsetWidth: child.offsetWidth,
          boundingWidth: childRect.width,
          boundingRight: childRect.right,
          left: childRect.left,
          right: childRect.right,
          computedWidth: childStyles.width,
          extends: childRect.right > 1280 ? `⚠️ EXTENDS ${(childRect.right - 1280).toFixed(2)}px beyond viewport` : 'OK'
        });
      });
    }
    
    // Also check the border element
    const borderEl = document.querySelector('[aria-hidden="true"].absolute.inset-y-0');
    if (borderEl) {
      const rect = borderEl.getBoundingClientRect();
      const styles = window.getComputedStyle(borderEl);
      findings.push({
        element: 'BORDER DECORATION ELEMENT',
        classes: borderEl.className.substring(0, 80),
        display: styles.display,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        computedMaxWidth: styles.maxWidth,
        transform: styles.transform,
        extends: rect.right > 1280 ? `⚠️ EXTENDS ${(rect.right - 1280).toFixed(2)}px beyond viewport` : 'OK'
      });
    }
    
    return findings;
  });
  
  console.log('=== Analysis Results ===\n');
  analysis.forEach(item => {
    console.log(`${item.element}`);
    Object.keys(item).forEach(key => {
      if (key !== 'element') {
        console.log(`  ${key}: ${item[key]}`);
      }
    });
    console.log('');
  });
  
  await browser.close();
}

findOverflowSource().catch(console.error);

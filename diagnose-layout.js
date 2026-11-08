const { chromium } = require('playwright');

async function diagnoseLayout() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1024, height: 565 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:3000/quiz-v4');
  await page.waitForSelector('text=START', { timeout: 10000 });
  await page.click('text=START');
  await page.waitForSelector('text=The Trolley', { timeout: 10000 });
  
  console.log('=== QUESTION 1: The Trolley ===\n');
  
  // Check viewport and document dimensions
  const dimensions = await page.evaluate(() => {
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight
    };
  });
  
  console.log('Viewport dimensions:', dimensions.viewportWidth, 'x', dimensions.viewportHeight);
  console.log('Document scroll dimensions:', dimensions.documentWidth, 'x', dimensions.documentHeight);
  console.log('Body scroll dimensions:', dimensions.bodyWidth, 'x', dimensions.bodyHeight);
  console.log('Horizontal overflow:', dimensions.documentWidth > dimensions.viewportWidth ? 'YES - ' + (dimensions.documentWidth - dimensions.viewportWidth) + 'px overflow' : 'NO');
  console.log('');
  
  // Find containers and their widths
  const containerInfo = await page.evaluate(() => {
    const containers = [];
    
    // Find main question container
    const mainContainer = document.querySelector('[role="status"]')?.closest('div') || document.querySelector('main');
    if (mainContainer) {
      const rect = mainContainer.getBoundingClientRect();
      const styles = window.getComputedStyle(mainContainer);
      containers.push({
        selector: 'Main container',
        classes: mainContainer.className,
        width: rect.width,
        computedWidth: styles.width,
        padding: `${styles.paddingLeft} ${styles.paddingRight}`,
        margin: `${styles.marginLeft} ${styles.marginRight}`
      });
    }
    
    // Find grid containers
    const gridContainers = document.querySelectorAll('[class*="grid"]');
    gridContainers.forEach((el, idx) => {
      if (idx < 5) { // Limit to first 5
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        containers.push({
          selector: `Grid container ${idx + 1}`,
          classes: el.className,
          width: rect.width,
          computedWidth: styles.width,
          padding: `${styles.paddingLeft} ${styles.paddingRight}`,
          gridTemplateColumns: styles.gridTemplateColumns
        });
      }
    });
    
    // Check for elements that extend beyond viewport
    const allElements = document.querySelectorAll('*');
    const overflowing = [];
    allElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        overflowing.push({
          tag: el.tagName,
          classes: el.className,
          right: rect.right,
          overflow: rect.right - window.innerWidth
        });
      }
    });
    
    return { containers, overflowing: overflowing.slice(0, 10) };
  });
  
  console.log('Container information:');
  containerInfo.containers.forEach(c => {
    console.log(`  ${c.selector}:`);
    console.log(`    Classes: ${c.classes}`);
    console.log(`    Width: ${c.width}px`);
    console.log(`    Computed width: ${c.computedWidth}`);
    console.log(`    Padding: ${c.padding}`);
    if (c.gridTemplateColumns) console.log(`    Grid columns: ${c.gridTemplateColumns}`);
    console.log('');
  });
  
  if (containerInfo.overflowing.length > 0) {
    console.log('Elements extending beyond viewport:');
    containerInfo.overflowing.forEach(el => {
      console.log(`  ${el.tag}.${el.classes} - extends to ${el.right}px (${el.overflow}px overflow)`);
    });
  } else {
    console.log('No elements extend beyond viewport');
  }
  console.log('');
  
  // Take screenshot
  await page.screenshot({ path: '/opt/cursor/artifacts/quiz-defects-1024x565-q1.png', fullPage: false });
  console.log('Screenshot saved: quiz-defects-1024x565-q1.png\n');
  
  // Navigate to Question 2
  await page.click('text=LEAVE THE SWITCH ALONE');
  await page.waitForSelector('text=The Experience Machine', { timeout: 10000 });
  
  console.log('=== QUESTION 2: The Experience Machine ===\n');
  
  const dimensions2 = await page.evaluate(() => {
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth
    };
  });
  
  console.log('Viewport width:', dimensions2.viewportWidth);
  console.log('Document scroll width:', dimensions2.documentWidth);
  console.log('Horizontal overflow:', dimensions2.documentWidth > dimensions2.viewportWidth ? 'YES - ' + (dimensions2.documentWidth - dimensions2.viewportWidth) + 'px overflow' : 'NO');
  console.log('');
  
  // Take screenshot
  await page.screenshot({ path: '/opt/cursor/artifacts/quiz-defects-1024x565-q2.png', fullPage: false });
  console.log('Screenshot saved: quiz-defects-1024x565-q2.png\n');
  
  await browser.close();
  console.log('Diagnosis complete!');
}

diagnoseLayout().catch(console.error);

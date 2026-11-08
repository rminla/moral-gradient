const { chromium } = require('playwright');

async function investigateOverflow() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  console.log('=== Investigating 59px Overflow at 1280×800 ===\n');
  
  await page.goto('http://localhost:3000/quiz-v4');
  await page.click('text=START');
  await page.waitForSelector('text=The Trolley', { timeout: 10000 });
  await page.waitForTimeout(500);
  
  // Get comprehensive measurements
  const measurements = await page.evaluate(() => {
    const results = {
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        offsetWidth: document.documentElement.offsetWidth,
        scrollHeight: document.documentElement.scrollHeight
      },
      body: {
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
        offsetWidth: document.body.offsetWidth
      },
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
    
    // Find elements with scrollWidth > clientWidth
    const overflowingElements = [];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(el => {
      if (el.scrollWidth > el.clientWidth || el.offsetWidth > window.innerWidth) {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        
        overflowingElements.push({
          tag: el.tagName,
          classes: el.className.substring(0, 100),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          offsetWidth: el.offsetWidth,
          boundingWidth: rect.width,
          computedWidth: styles.width,
          computedMaxWidth: styles.maxWidth,
          padding: `${styles.paddingLeft} | ${styles.paddingRight}`,
          margin: `${styles.marginLeft} | ${styles.marginRight}`,
          position: styles.position,
          left: rect.left,
          right: rect.right
        });
      }
    });
    
    // Sort by scrollWidth descending
    overflowingElements.sort((a, b) => b.scrollWidth - a.scrollWidth);
    
    return { measurements: results, elements: overflowingElements.slice(0, 15) };
  });
  
  console.log('=== Document Measurements ===');
  console.log('Viewport width:', measurements.measurements.viewport.innerWidth);
  console.log('Document scrollWidth:', measurements.measurements.document.scrollWidth);
  console.log('Document clientWidth:', measurements.measurements.document.clientWidth);
  console.log('Document offsetWidth:', measurements.measurements.document.offsetWidth);
  console.log('Body scrollWidth:', measurements.measurements.body.scrollWidth);
  console.log('OVERFLOW:', measurements.measurements.overflow, 'px\n');
  
  console.log('=== Elements with Overflow ===');
  measurements.elements.forEach((el, idx) => {
    console.log(`\n${idx + 1}. ${el.tag} (${el.classes.substring(0, 60)}${el.classes.length > 60 ? '...' : ''})`);
    console.log(`   scrollWidth: ${el.scrollWidth}px`);
    console.log(`   clientWidth: ${el.clientWidth}px`);
    console.log(`   offsetWidth: ${el.offsetWidth}px`);
    console.log(`   boundingWidth: ${el.boundingWidth}px`);
    console.log(`   computedWidth: ${el.computedWidth}`);
    console.log(`   maxWidth: ${el.computedMaxWidth}`);
    console.log(`   padding: ${el.padding}`);
    console.log(`   margin: ${el.margin}`);
    console.log(`   position: ${el.position}`);
    console.log(`   left: ${el.left}px, right: ${el.right}px`);
  });
  
  // Take screenshot for reference
  await page.screenshot({ path: '/opt/cursor/artifacts/overflow-investigation-1280x800.png' });
  console.log('\n Screenshot saved: overflow-investigation-1280x800.png');
  
  await browser.close();
  console.log('\n=== Investigation Complete ===');
}

investigateOverflow().catch(console.error);

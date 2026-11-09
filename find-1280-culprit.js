const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('https://moral-gradient.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const analysis = await page.evaluate(() => {
    const results = {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      wideElements: []
    };
    
    // Check all elements
    const all = document.querySelectorAll('*');
    all.forEach(el => {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);
      
      // Check if element extends beyond viewport
      if (rect.right > 1280 || el.scrollWidth > 1280) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string' ? 
          `.${el.className.split(' ').slice(0,3).join('.')}` : '';
        
        results.wideElements.push({
          selector: `${tag}${id}${cls}`,
          rectRight: Math.round(rect.right),
          rectWidth: Math.round(rect.width),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflow: el.scrollWidth - el.clientWidth,
          marginRight: computed.marginRight,
          paddingRight: computed.paddingRight
        });
      }
    });
    
    // Sort by how far right they extend
    results.wideElements.sort((a, b) => b.rectRight - a.rectRight);
    
    return results;
  });
  
  console.log(`Document scrollWidth: ${analysis.documentWidth}px`);
  console.log(`Viewport width: ${analysis.viewport.width}px`);
  console.log(`Overflow: ${analysis.documentWidth - analysis.viewport.width}px\n`);
  
  console.log('Elements extending beyond 1280px:');
  analysis.wideElements.slice(0, 10).forEach((el, i) => {
    console.log(`${i+1}. ${el.selector}`);
    console.log(`   rectRight: ${el.rectRight}px (extends ${el.rectRight - 1280}px beyond)`);
    console.log(`   width: ${el.rectWidth}px, scrollWidth: ${el.scrollWidth}px`);
    if (el.overflow > 0) {
      console.log(`   internal overflow: ${el.overflow}px`);
    }
    console.log();
  });
  
  await browser.close();
})();

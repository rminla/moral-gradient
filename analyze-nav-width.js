const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  await page.goto('https://moral-gradient.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const navAnalysis = await page.evaluate(() => {
    const header = document.querySelector('header');
    const navContainer = header?.querySelector('.mx-auto.flex');
    
    if (!navContainer) return { error: 'Nav container not found' };
    
    const children = Array.from(navContainer.children);
    const childInfo = children.map((el, i) => {
      const rect = el.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(el);
      return {
        index: i,
        tagName: el.tagName,
        className: el.className.substring(0, 80),
        text: el.textContent?.trim().substring(0, 30) || '',
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        paddingLeft: computedStyle.paddingLeft,
        paddingRight: computedStyle.paddingRight,
        flexGrow: computedStyle.flexGrow,
        flexShrink: computedStyle.flexShrink
      };
    });
    
    const containerRect = navContainer.getBoundingClientRect();
    
    return {
      container: {
        left: Math.round(containerRect.left),
        right: Math.round(containerRect.right),
        width: Math.round(containerRect.width),
        maxWidth: window.getComputedStyle(navContainer).maxWidth
      },
      viewport: {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      },
      children: childInfo
    };
  });
  
  console.log('=== NAVIGATION BAR ANALYSIS (1280px) ===\n');
  console.log('Viewport:', JSON.stringify(navAnalysis.viewport, null, 2));
  console.log('\nContainer:', JSON.stringify(navAnalysis.container, null, 2));
  console.log('\nChildren:');
  
  navAnalysis.children.forEach(child => {
    console.log(`\n  [${child.index}] ${child.tagName} "${child.text}"`);
    console.log(`    Left: ${child.left}px, Right: ${child.right}px, Width: ${child.width}px`);
    console.log(`    Padding: ${child.paddingLeft} / ${child.paddingRight}`);
    console.log(`    Flex: grow=${child.flexGrow}, shrink=${child.flexShrink}`);
    if (child.right > 1280) {
      console.log(`    ⚠️  EXTENDS PAST VIEWPORT by ${child.right - 1280}px`);
    }
  });
  
  console.log('\n=== DIAGNOSIS ===');
  const totalChildWidth = navAnalysis.children.reduce((sum, c) => sum + c.width, 0);
  console.log(`Total child widths: ${totalChildWidth}px`);
  console.log(`Container width: ${navAnalysis.container.width}px`);
  console.log(`Container max-width: ${navAnalysis.container.maxWidth}`);
  console.log(`Container right edge: ${navAnalysis.container.right}px`);
  
  if (navAnalysis.container.right > 1280) {
    console.log(`\n✗ Container itself extends ${navAnalysis.container.right - 1280}px past viewport`);
    console.log('  Solution: The nav content is too wide for 1280px viewport');
    console.log('  Need to reduce padding or hide some nav items at this breakpoint');
  }
  
  await browser.close();
})();

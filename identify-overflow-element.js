const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('https://moral-gradient.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const element = await page.evaluate(() => {
    // Find all links in the header
    const header = document.querySelector('header');
    const links = header.querySelectorAll('a');
    
    let culprit = null;
    let maxRight = 0;
    
    links.forEach(link => {
      const rect = link.getBoundingClientRect();
      if (rect.right > maxRight) {
        maxRight = rect.right;
        culprit = {
          text: link.textContent.trim(),
          href: link.getAttribute('href'),
          classes: link.className,
          rect: {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width)
          }
        };
      }
    });
    
    return { culprit, maxRight: Math.round(maxRight) };
  });
  
  console.log(`Rightmost element extends to: ${element.maxRight}px`);
  console.log(`Overflow: ${element.maxRight - 1280}px\n`);
  console.log('Element details:');
  console.log(`  Text: "${element.culprit.text}"`);
  console.log(`  Href: ${element.culprit.href}`);
  console.log(`  Classes: ${element.culprit.classes}`);
  console.log(`  Position: ${element.culprit.rect.left}px to ${element.culprit.rect.right}px`);
  console.log(`  Width: ${element.culprit.rect.width}px`);
  
  await browser.close();
})();

const { chromium } = require('playwright');

async function findOverflow() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Find all elements wider than 1280px
  const wideElements = await page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    const wide = [];
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 1280) {
        wide.push({
          tag: el.tagName,
          class: el.className,
          width: rect.width,
          scrollWidth: el.scrollWidth,
          text: el.textContent?.substring(0, 50)
        });
      }
    });
    return wide.slice(0, 10);
  });
  
  console.log('Elements wider than 1280px:');
  wideElements.forEach((el, i) => {
    console.log(`${i+1}. ${el.tag}.${el.class}`);
    console.log(`   width: ${el.width}px, scrollWidth: ${el.scrollWidth}px`);
  });
  
  await browser.close();
}

findOverflow();

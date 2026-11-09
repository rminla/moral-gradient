const { chromium } = require('playwright');

async function diagnoseOverflow() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:3000/quiz-v4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const measurements = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    
    const results = {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      html: {
        clientWidth: html.clientWidth,
        scrollWidth: html.scrollWidth,
        offsetWidth: html.offsetWidth,
        computed: window.getComputedStyle(html).width
      },
      body: {
        clientWidth: body.clientWidth,
        scrollWidth: body.scrollWidth,
        offsetWidth: body.offsetWidth,
        computed: window.getComputedStyle(body).width
      },
      culprits: []
    };
    
    // Find all direct children of body
    Array.from(body.children).forEach(child => {
      const rect = child.getBoundingClientRect();
      const styles = window.getComputedStyle(child);
      if (rect.width > 1280 || child.scrollWidth > 1280) {
        results.culprits.push({
          tag: child.tagName,
          id: child.id,
          class: child.className,
          width: rect.width,
          scrollWidth: child.scrollWidth,
          marginLeft: styles.marginLeft,
          marginRight: styles.marginRight,
          paddingLeft: styles.paddingLeft,
          paddingRight: styles.paddingRight
        });
      }
    });
    
    return results;
  });
  
  console.log('Viewport:', measurements.viewport);
  console.log('\nHTML element:');
  console.log('  clientWidth:', measurements.html.clientWidth);
  console.log('  scrollWidth:', measurements.html.scrollWidth);
  console.log('  overflow:', measurements.html.scrollWidth - measurements.html.clientWidth, 'px');
  
  console.log('\nBody element:');
  console.log('  clientWidth:', measurements.body.clientWidth);
  console.log('  scrollWidth:', measurements.body.scrollWidth);
  
  if (measurements.culprits.length > 0) {
    console.log('\nCulprit elements (> 1280px):');
    measurements.culprits.forEach((el, i) => {
      console.log(`\n${i+1}. <${el.tag}> ${el.class}`);
      console.log(`   width: ${el.width}px`);
      console.log(`   scrollWidth: ${el.scrollWidth}px`);
      console.log(`   margins: ${el.marginLeft} / ${el.marginRight}`);
      console.log(`   padding: ${el.paddingLeft} / ${el.paddingRight}`);
    });
  } else {
    console.log('\nNo culprit elements found');
  }
  
  await browser.close();
}

diagnoseOverflow();

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  // Test homepage first (nav bar visible immediately)
  console.log('=== TESTING 1280px VIEWPORT ===\n');
  console.log('Testing homepage...');
  
  await page.goto('https://moral-gradient.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const homeOverflow = await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    const overflowAmount = scrollWidth - clientWidth;
    
    // Find Donate button
    const donateBtn = document.querySelector('a[href="/donate"]');
    const donateBtnInfo = donateBtn ? {
      exists: true,
      text: donateBtn.textContent.trim(),
      boundingRect: donateBtn.getBoundingClientRect(),
      computedPadding: window.getComputedStyle(donateBtn).padding
    } : { exists: false };
    
    return {
      scrollWidth,
      clientWidth,
      overflowAmount,
      donateButton: donateBtnInfo
    };
  });
  
  console.log('Homepage:');
  console.log(`  Document width: ${homeOverflow.scrollWidth}px`);
  console.log(`  Viewport width: ${homeOverflow.clientWidth}px`);
  console.log(`  Overflow: ${homeOverflow.overflowAmount}px`);
  
  if (homeOverflow.donateButton.exists) {
    console.log(`  Donate button:`);
    console.log(`    Right edge: ${Math.round(homeOverflow.donateButton.boundingRect.right)}px`);
    console.log(`    Width: ${Math.round(homeOverflow.donateButton.boundingRect.width)}px`);
    console.log(`    Padding: ${homeOverflow.donateButton.computedPadding}`);
  }
  
  if (homeOverflow.overflowAmount === 0) {
    console.log('  ✓ NO OVERFLOW');
  } else {
    console.log(`  ✗ OVERFLOW: ${homeOverflow.overflowAmount}px`);
  }
  
  await page.screenshot({ path: '/tmp/homepage-1280.png', fullPage: false });
  
  // Test quiz page
  console.log('\nTesting quiz results page...');
  
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Start")');
  
  for (let i = 0; i < 10; i++) {
    const buttons = page.locator('button').filter({ hasText: /^(?!Back).+/ });
    await buttons.first().click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);
  
  const quizOverflow = await page.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflowAmount: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  
  console.log('Quiz results page:');
  console.log(`  Document width: ${quizOverflow.scrollWidth}px`);
  console.log(`  Viewport width: ${quizOverflow.clientWidth}px`);
  console.log(`  Overflow: ${quizOverflow.overflowAmount}px`);
  
  if (quizOverflow.overflowAmount === 0) {
    console.log('  ✓ NO OVERFLOW');
  } else {
    console.log(`  ✗ OVERFLOW: ${quizOverflow.overflowAmount}px`);
  }
  
  await page.screenshot({ path: '/tmp/quiz-results-1280.png', fullPage: false });
  
  console.log('\nScreenshots saved:');
  console.log('  /tmp/homepage-1280.png');
  console.log('  /tmp/quiz-results-1280.png');
  
  await context.close();
  await browser.close();
  
  console.log('\n=== 1280px TEST COMPLETE ===');
})();

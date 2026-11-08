const { chromium } = require('playwright');

async function testBackAndResults() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1024, height: 565 } });
  const page = await context.newPage();
  
  console.log('=== Testing BACK navigation and Results page ===\n');
  
  await page.goto('http://localhost:3000/quiz-v4', { waitUntil: 'networkidle' });
  await page.click('text=START');
  await page.waitForSelector('text=The Trolley', { timeout: 10000 });
  
  // Answer Q1
  await page.click('text=LEAVE THE SWITCH ALONE');
  await page.waitForSelector('text=The Experience Machine', { timeout: 10000 });
  await page.waitForTimeout(500);
  
  // Answer Q2
  await page.click('text=STAY IN MY REAL LIFE');
  await page.waitForSelector('text=The Veil of Ignorance', { timeout: 10000 });
  await page.waitForTimeout(500);
  console.log('On Q3 (Veil of Ignorance)');
  
  // Find and click the BACK button/link
  const backButton = await page.locator('button:has-text("BACK"), a:has-text("BACK")').first();
  if (await backButton.count() > 0) {
    await backButton.click();
    await page.waitForSelector('text=The Experience Machine', { timeout: 10000 });
    await page.waitForTimeout(500);
    
    const scrollY = await page.evaluate(() => window.scrollY);
    console.log(`After BACK: Scroll Y = ${scrollY}px ${scrollY === 0 ? '✅ (top)' : '⚠️ (not at top)'}`);
    
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/quiz-fixed-q2-after-back.png',
      fullPage: false 
    });
    console.log('Screenshot: quiz-fixed-q2-after-back.png\n');
  } else {
    console.log('BACK button not found, trying alternative selector...');
    await page.click('[href*="back"], button:text-matches("back", "i")');
  }
  
  // Complete the quiz
  console.log('Completing quiz to reach results...');
  
  // Answer remaining questions
  await page.click('text=STAY IN MY REAL LIFE'); // Q2 again
  await page.waitForTimeout(500);
  await page.click('button:has-text("A MORE SECURE MINIMUM")'); // Q3
  await page.waitForTimeout(500);
  
  // Answer remaining 7 questions
  for (let i = 4; i <= 10; i++) {
    console.log(`Answering Q${i}...`);
    const buttons = await page.$$('button[class*="border"]');
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.trim().length > 15 && !text.includes('BACK')) {
        await btn.click();
        await page.waitForTimeout(700);
        break;
      }
    }
  }
  
  // Wait for results page
  await page.waitForTimeout(2000);
  
  // Check if we're on results
  const url = page.url();
  console.log(`Current URL: ${url}`);
  
  const pageText = await page.textContent('body');
  if (pageText.includes('Your ethical') || pageText.includes('Results') || pageText.includes('twin')) {
    console.log('✅ Reached results page');
    
    const resultsOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }));
    
    console.log(`Results: ${resultsOverflow.scrollWidth}px scroll width, ${resultsOverflow.clientWidth}px client width`);
    console.log(`Horizontal overflow: ${resultsOverflow.hasHorizontalOverflow ? 'YES ⚠️' : 'NO ✅'}`);
    
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/quiz-fixed-results-1024x565.png',
      fullPage: false 
    });
    console.log('Screenshot: quiz-fixed-results-1024x565.png');
  } else {
    console.log('❌ Did not reach results page');
    console.log('Page content preview:', pageText.substring(0, 200));
  }
  
  await browser.close();
  console.log('\n✅ Test complete!');
}

testBackAndResults().catch(console.error);

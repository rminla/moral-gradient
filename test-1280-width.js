const { chromium } = require('playwright');

async function test1280Width() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    // Test homepage
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    const homeScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const homeClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const homeOverflow = homeScrollWidth - homeClientWidth;
    
    console.log('Homepage at 1280px:');
    console.log(`  scrollWidth: ${homeScrollWidth}px`);
    console.log(`  clientWidth: ${homeClientWidth}px`);
    console.log(`  overflow: ${homeOverflow}px ${homeOverflow > 0 ? '❌ OVERFLOW!' : '✓ OK'}`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/test-1280-home.png', fullPage: false });
    
    // Test quiz-v4
    await page.goto('http://localhost:3000/quiz-v4', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    const quizScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const quizClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const quizOverflow = quizScrollWidth - quizClientWidth;
    
    console.log('\nQuiz-v4 at 1280px:');
    console.log(`  scrollWidth: ${quizScrollWidth}px`);
    console.log(`  clientWidth: ${quizClientWidth}px`);
    console.log(`  overflow: ${quizOverflow}px ${quizOverflow > 0 ? '❌ OVERFLOW!' : '✓ OK'}`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/test-1280-quiz-intro.png', fullPage: false });
    
    // Test with Sofie question
    await page.click('button:has-text("Start")');
    await page.waitForTimeout(500);
    
    // Navigate to question 7 (Sofie)
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(300);
      const buttons = await page.locator('button').all();
      if (buttons.length > 2) await buttons[2].click();
    }
    
    await page.waitForTimeout(1000);
    const sofieText = await page.textContent('body');
    const hasCorrectedText = sofieText.includes('Say you would buy one to encourage her');
    const hasOldText = sofieText.includes('Say you would to encourage her');
    
    console.log('\nSofie question text:');
    console.log(`  Corrected text: ${hasCorrectedText ? '✓' : '❌'}`);
    console.log(`  Old text: ${hasOldText ? '❌' : '✓'}`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/test-1280-sofie-question.png', fullPage: true });
    
    // Continue to results to test refusals display
    for (let i = 6; i < 10; i++) {
      await page.waitForTimeout(300);
      const buttons = await page.locator('button').all();
      if (buttons.length > 2) await buttons[2].click();
    }
    
    await page.waitForTimeout(2000);
    
    // Scroll to see question-by-question results
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(500);
    
    const resultsText = await page.textContent('body');
    const hasRefusalText = resultsText.includes('Refusal') || resultsText.includes('refused');
    const hasUsableText = resultsText.includes('usable');
    
    console.log('\nResults page refusals:');
    console.log(`  Has refusal text: ${hasRefusalText ? '✓' : '❌'}`);
    console.log(`  Has usable denominator: ${hasUsableText ? '✓' : '❌'}`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/test-1280-results-detail.png', fullPage: true });
    
    const resultsScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const resultsClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const resultsOverflow = resultsScrollWidth - resultsClientWidth;
    
    console.log('\nResults at 1280px:');
    console.log(`  scrollWidth: ${resultsScrollWidth}px`);
    console.log(`  clientWidth: ${resultsClientWidth}px`);
    console.log(`  overflow: ${resultsOverflow}px ${resultsOverflow > 0 ? '❌ OVERFLOW!' : '✓ OK'}`);
    
    const allPass = homeOverflow === 0 && quizOverflow === 0 && resultsOverflow === 0 && hasCorrectedText && !hasOldText;
    
    console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

test1280Width();

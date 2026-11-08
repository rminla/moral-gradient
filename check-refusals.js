const { chromium } = require('playwright');

async function checkRefusals() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
    await page.click('button:has-text("Start")');
    
    // Answer all 10 questions quickly to get to results
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const buttons = await page.locator('button').all();
      if (buttons.length > 2) {
        await buttons[2].click(); // Click first choice button
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Look for Ring of Gyges in results
    const bodyText = await page.textContent('body');
    
    console.log('\n=== Checking for Refusals/Non-answers ===\n');
    
    // Check for "Ring" or "Gyges"
    const hasRing = bodyText.includes('Ring') || bodyText.includes('Gyges');
    console.log(`Has Ring/Gyges text: ${hasRing}`);
    
    // Check for specific patterns
    const patterns = [
      'Refusal',
      'refusal', 
      'No answer',
      'no answer',
      'non-answer',
      'Non-answer',
      '/20',
      '6/20',
      '14/20'
    ];
    
    patterns.forEach(p => {
      const has = bodyText.includes(p);
      console.log(`  "${p}": ${has}`);
    });
    
    // Extract a portion of text around "Ring"
    if (hasRing) {
      const ringIndex = bodyText.indexOf('Ring');
      const excerpt = bodyText.substring(ringIndex, ringIndex + 500);
      console.log('\nExcerpt around "Ring":');
      console.log(excerpt.substring(0, 300));
    }
    
    // Take a screenshot of the results
    await page.screenshot({ path: '/opt/cursor/artifacts/quiz-v4-check-refusals.png', fullPage: true });
    console.log('\nScreenshot saved to /opt/cursor/artifacts/quiz-v4-check-refusals.png');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkRefusals();

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
  
  // Complete quiz
  await page.click('button:has-text("Start")');
  for (let i = 0; i < 10; i++) {
    const buttons = page.locator('button').filter({ hasText: /^(?!Back).+/ });
    await buttons.first().click();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(2000);
  
  console.log('=== RESULTS PAGE LOADED ===\n');
  
  // Scroll down to find Q-by-Q section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  
  // Check what's on the page
  const pageStructure = await page.evaluate(() => {
    const body = document.body.textContent;
    
    return {
      hasAgreementWithEachModel: body.includes('Agreement with each model'),
      hasHowAgreementCalculated: body.includes('How agreement is calculated'),
      hasQuestionByQuestion: body.includes('Question by question'),
      hasSelectAModel: body.includes('Select a model'),
      hasTrolleyProblem: body.includes('The Trolley Problem'),
      hasRingOfGyges: body.includes('Ring of Gyges'),
      
      // Count buttons with model names
      buttonCounts: (() => {
        const allButtons = Array.from(document.querySelectorAll('button'));
        return {
          total: allButtons.length,
          withClaude: allButtons.filter(b => b.textContent.includes('Claude Haiku')).length,
          withGPT: allButtons.filter(b => b.textContent.includes('GPT-OSS')).length,
          withQwen: allButtons.filter(b => b.textContent.includes('Qwen')).length,
          withGemini: allButtons.filter(b => b.textContent.includes('Gemini')).length
        };
      })(),
      
      // Get all button texts for debugging
      allButtonTexts: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    };
  });
  
  console.log('Page structure:', JSON.stringify(pageStructure, null, 2));
  
  if (pageStructure.hasQuestionByQuestion && pageStructure.buttonCounts.withClaude > 0) {
    console.log('\n✓ Q-by-Q section exists');
    console.log(`✓ Found ${pageStructure.buttonCounts.withClaude} Claude buttons`);
    console.log(`✓ Found ${pageStructure.buttonCounts.withGPT} GPT-OSS buttons`);
    
    // Try clicking the Q-by-Q selector button (not the summary button)
    // Look for buttons AFTER "Select a model" text
    const selectorButton = page.locator('button:has-text("GPT-OSS-120B")').last();
    const count = await selectorButton.count();
    console.log(`\nGPT-OSS button count: ${count}`);
    
    if (count > 0) {
      await selectorButton.click();
      await page.waitForTimeout(1500);
      
      // Check if Ring of Gyges now shows refusals
      const gyges = await page.evaluate(() => {
        const body = document.body.textContent;
        const idx = body.indexOf('Ring of Gyges');
        if (idx < 0) return { found: false };
        
        const section = body.substring(idx, idx + 400);
        return {
          found: true,
          section,
          hasRefusal: /refusal/i.test(section),
          has6slash20: section.includes('6/20') || section.includes('6 / 20')
        };
      });
      
      console.log('\nRing of Gyges after GPT-OSS click:', JSON.stringify(gyges, null, 2));
      
      await page.screenshot({ path: '/tmp/gpt-oss-selected.png', fullPage: true });
      console.log('\nScreenshot: /tmp/gpt-oss-selected.png');
    }
  } else {
    console.log('\n✗ Q-by-Q section or buttons missing');
  }
  
  await browser.close();
})();

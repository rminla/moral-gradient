const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  console.log('=== TESTING 3 VIEWPORTS: 1280px, 1024px, 390px ===\n');
  
  const viewports = [
    { width: 1280, height: 800, name: '1280px (desktop)' },
    { width: 1024, height: 768, name: '1024px (tablet)' },
    { width: 390, height: 844, name: '390px (mobile)' }
  ];
  
  for (const vp of viewports) {
    console.log(`\n--- ${vp.name} ---`);
    
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    
    await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
    
    // Complete quiz quickly
    await page.click('button:has-text("Start")');
    for (let i = 0; i < 10; i++) {
      const buttons = page.locator('button').filter({ hasText: /^(?!Back).+/ });
      await buttons.first().click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1000);
    
    // Check overflow
    const overflow = await page.evaluate(() => {
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        overflowAmount: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth
      };
    });
    
    console.log(`Document width: ${overflow.documentWidth}px`);
    console.log(`Viewport width: ${overflow.viewportWidth}px`);
    console.log(`Overflow: ${overflow.overflowAmount}px`);
    
    if (overflow.overflowAmount > 0) {
      console.log(`✗ OVERFLOW DETECTED: ${overflow.overflowAmount}px`);
      
      // Find what's causing overflow
      const culprits = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const vw = document.documentElement.clientWidth;
        const problems = [];
        
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.right > vw) {
            problems.push({
              tag: el.tagName,
              className: el.className || '',
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              text: el.textContent?.substring(0, 50) || ''
            });
          }
        }
        
        // Sort by how far they extend past viewport
        return problems.sort((a, b) => b.right - a.right).slice(0, 5);
      });
      
      console.log('Overflow culprits:', JSON.stringify(culprits, null, 2));
    } else {
      console.log('✓ NO OVERFLOW');
    }
    
    // Screenshot
    await page.screenshot({ path: `/tmp/viewport-${vp.width}.png`, fullPage: false });
    
    await context.close();
  }
  
  // Final detailed check at 1280px for model selectors and refusals
  console.log('\n\n=== DETAILED FEATURE CHECK (1280px) ===\n');
  
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
  
  // Complete quiz
  await page.click('button:has-text("Start")');
  for (let i = 0; i < 10; i++) {
    const buttons = page.locator('button').filter({ hasText: /^(?!Back).+/ });
    await buttons.first().click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1500);
  
  // Scroll to Q-by-Q section
  await page.evaluate(() => {
    const qbyq = document.body.textContent.indexOf('Question by question');
    if (qbyq > 0) {
      window.scrollTo(0, document.body.scrollHeight * 0.6);
    }
  });
  await page.waitForTimeout(500);
  
  // Test GPT-OSS
  await page.click('button:has-text("GPT-OSS-120B")');
  await page.waitForTimeout(1500);
  
  const gptCheck = await page.evaluate(() => {
    const body = document.body.textContent;
    const gygesIdx = body.indexOf('Ring of Gyges');
    const gygesSection = gygesIdx >= 0 ? body.substring(gygesIdx, gygesIdx + 400) : '';
    
    return {
      gygesFound: gygesIdx >= 0,
      hasRefusalWord: /refusal/i.test(gygesSection),
      has6_20: /6\s*\/\s*20/.test(gygesSection),
      snippet: gygesSection.substring(0, 200)
    };
  });
  
  console.log('GPT-OSS Ring of Gyges:');
  console.log(`  Found: ${gptCheck.gygesFound}`);
  console.log(`  Has "refusal": ${gptCheck.hasRefusalWord}`);
  console.log(`  Has "6/20": ${gptCheck.has6_20}`);
  if (gptCheck.gygesFound && gptCheck.hasRefusalWord && gptCheck.has6_20) {
    console.log('  ✓ REFUSALS VISIBLE');
  } else {
    console.log('  ✗ REFUSALS ISSUE');
  }
  
  // Test Gemini
  await page.click('button:has-text("Gemini 3.8 Flash")');
  await page.waitForTimeout(1500);
  
  const geminiCheck = await page.evaluate(() => {
    const body = document.body.textContent;
    const veilIdx = body.indexOf('Veil of Ignorance');
    const veilSection = veilIdx >= 0 ? body.substring(veilIdx, veilIdx + 400) : '';
    
    return {
      veilFound: veilIdx >= 0,
      hasNoAnswerWord: /no answer/i.test(veilSection),
      has1_20: /1\s*\/\s*20/.test(veilSection),
      snippet: veilSection.substring(0, 200)
    };
  });
  
  console.log('\nGemini Veil of Ignorance:');
  console.log(`  Found: ${geminiCheck.veilFound}`);
  console.log(`  Has "no answer": ${geminiCheck.hasNoAnswerWord}`);
  console.log(`  Has "1/20": ${geminiCheck.has1_20}`);
  if (geminiCheck.veilFound && geminiCheck.hasNoAnswerWord && geminiCheck.has1_20) {
    console.log('  ✓ NON-ANSWER VISIBLE');
  } else {
    console.log('  ✗ NON-ANSWER ISSUE');
  }
  
  // Full page screenshot with Gemini selected
  await page.screenshot({ path: '/tmp/final-verification.png', fullPage: true });
  console.log('\nScreenshots saved:');
  console.log('  /tmp/viewport-1280.png');
  console.log('  /tmp/viewport-1024.png');
  console.log('  /tmp/viewport-390.png');
  console.log('  /tmp/final-verification.png');
  
  await context.close();
  await browser.close();
  
  console.log('\n=== VERIFICATION COMPLETE ===');
})();

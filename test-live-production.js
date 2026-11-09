const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log('=== TESTING LIVE PRODUCTION (0ce0811) ===\n');
  
  // Test 1: Viewport overflow measurements
  console.log('1. VIEWPORT OVERFLOW:');
  for (const vp of [
    { width: 1280, height: 800, name: '1280px' },
    { width: 1024, height: 768, name: '1024px' },
    { width: 390, height: 844, name: '390px' }
  ]) {
    // Fresh context with cache disabled
    const context = await browser.newContext({ 
      viewport: vp,
      bypassCSP: true,
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    
    // Cache-busting navigation
    await page.goto(`https://moral-gradient.vercel.app/quiz-v4?_=${Date.now()}`, { 
      waitUntil: 'networkidle',
      timeout: 20000 
    });
    await page.waitForTimeout(4000);
    
    const measurements = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    }));
    
    const overflow = measurements.scrollWidth - measurements.clientWidth;
    console.log(`   ${vp.name}: scrollWidth=${measurements.scrollWidth} clientWidth=${measurements.clientWidth} overflow=${overflow}px ${overflow === 0 ? '✓' : '❌'}`);
    
    if (vp.width === 1280) {
      await page.screenshot({ path: '/opt/cursor/artifacts/live-quiz-1280.png', fullPage: false });
      
      // If overflow, find culprit
      if (overflow > 0) {
        const culprit = await page.evaluate(() => {
          const all = document.querySelectorAll('*');
          let widest = null;
          let maxRight = 0;
          
          all.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > maxRight) {
              maxRight = rect.right;
              const computed = window.getComputedStyle(el);
              widest = {
                tag: el.tagName,
                class: el.className,
                id: el.id,
                right: Math.round(rect.right),
                width: Math.round(rect.width),
                marginLeft: computed.marginLeft,
                marginRight: computed.marginRight,
                paddingLeft: computed.paddingLeft,
                paddingRight: computed.paddingRight
              };
            }
          });
          return { widest, maxRight: Math.round(maxRight) };
        });
        console.log(`   CULPRIT: <${culprit.widest.tag}> extends to ${culprit.maxRight}px`);
        console.log(`   Classes: ${culprit.widest.class}`);
        console.log(`   Padding: ${culprit.widest.paddingLeft} / ${culprit.widest.paddingRight}`);
      }
    }
    
    await context.close();
  }
  
  // Test 2: Model selector functionality
  console.log('\n2. MODEL SELECTOR & REFUSALS:');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  await page.goto(`https://moral-gradient.vercel.app/quiz-v4?_=${Date.now()}`, {
    waitUntil: 'networkidle',
    timeout: 20000
  });
  await page.waitForTimeout(3000);
  
  // Check for formula text
  let bodyText = await page.textContent('body');
  const hasFormula = bodyText.includes('How agreement is calculated');
  const hasExample = bodyText.includes('15') && bodyText.includes('18');
  console.log(`   Formula explanation: ${hasFormula ? '✓' : '❌'}`);
  console.log(`   15/18 example: ${hasExample ? '✓' : '❌'}`);
  
  // Complete quiz
  await page.click('button:has-text("Start")');
  await page.waitForTimeout(1500);
  
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(400);
    const btns = await page.locator('button').all();
    if (btns.length > 2) await btns[2].click();
  }
  
  await page.waitForTimeout(4000);
  
  // Check for model buttons
  const modelBtns = await page.locator('button:has-text("Claude"), button:has-text("GPT-OSS"), button:has-text("Qwen"), button:has-text("Gemini")').count();
  console.log(`   Model selector buttons: ${modelBtns} ${modelBtns >= 4 ? '✓' : '❌'}`);
  
  await page.screenshot({ path: '/opt/cursor/artifacts/live-results-overview.png', fullPage: false });
  
  // Test GPT-OSS selection
  if (modelBtns > 0) {
    try {
      await page.click('button:has-text("GPT-OSS")');
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.waitForTimeout(1000);
      
      const detailText = await page.textContent('body');
      const hasRefusal = detailText.includes('Refusal') || detailText.includes('refusal');
      const has14 = detailText.includes('/14');
      const has6refusal = detailText.includes('6/20');
      
      console.log(`   GPT-OSS refusals visible: ${(hasRefusal || has14) ? '✓' : '❌'}`);
      console.log(`   Has /14 denominator: ${has14 ? '✓' : '❌'}`);
      console.log(`   Has 6/20 refusal count: ${has6refusal ? '✓' : '❌'}`);
      
      await page.screenshot({ path: '/opt/cursor/artifacts/live-gpt-oss-details.png', fullPage: true });
    } catch (e) {
      console.log(`   ❌ GPT-OSS click failed: ${e.message}`);
    }
    
    // Test Gemini selection
    try {
      await page.click('button:has-text("Gemini")');
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.waitForTimeout(1000);
      
      const detailText = await page.textContent('body');
      const has19 = detailText.includes('/19');
      const has1nonanswer = detailText.includes('1/20');
      const hasNoAnswer = detailText.toLowerCase().includes('no answer');
      
      console.log(`   Gemini non-answer visible: ${(has19 || has1nonanswer || hasNoAnswer) ? '✓' : '❌'}`);
      console.log(`   Has /19 denominator: ${has19 ? '✓' : '❌'}`);
      console.log(`   Has 1/20 non-answer: ${has1nonanswer ? '✓' : '❌'}`);
      
      await page.screenshot({ path: '/opt/cursor/artifacts/live-gemini-details.png', fullPage: true });
    } catch (e) {
      console.log(`   ❌ Gemini click failed: ${e.message}`);
    }
  }
  
  await context.close();
  await browser.close();
  
  console.log('\n=== VERIFICATION COMPLETE ===');
})();

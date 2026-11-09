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
  
  // Expand Q-by-Q section
  await page.click('button:has-text("Claude Haiku 5.5")');
  await page.waitForTimeout(1500);
  
  // Get initial state (Claude selected by default)
  const claudeData = await page.evaluate(() => {
    const trolleySection = document.body.textContent;
    const trolleyIdx = trolleySection.indexOf('The Trolley Problem');
    if (trolleyIdx < 0) return null;
    
    const snippet = trolleySection.substring(trolleyIdx, trolleyIdx + 250);
    
    // Extract the first option count (should be something like "X/20")
    const match = snippet.match(/(\d+)\/(\d+)\s*\((\d+)%\)/);
    return match ? {
      model: 'Claude (default)',
      trolleyFirstCount: match[1],
      trolleyDenominator: match[2],
      trolleyPct: match[3]
    } : null;
  });
  
  console.log('1. Initial (Claude):', JSON.stringify(claudeData, null, 2));
  
  // Click GPT-OSS selector
  const gptButton = page.locator('button:has-text("GPT-OSS-120B")').nth(1); // Second one (first is summary)
  await gptButton.click();
  await page.waitForTimeout(1500);
  
  const gptData = await page.evaluate(() => {
    const trolleySection = document.body.textContent;
    const trolleyIdx = trolleySection.indexOf('The Trolley Problem');
    if (trolleyIdx < 0) return null;
    
    const snippet = trolleySection.substring(trolleyIdx, trolleyIdx + 250);
    const match = snippet.match(/(\d+)\/(\d+)\s*\((\d+)%\)/);
    return match ? {
      model: 'GPT-OSS',
      trolleyFirstCount: match[1],
      trolleyDenominator: match[2],
      trolleyPct: match[3]
    } : null;
  });
  
  console.log('2. After clicking GPT-OSS:', JSON.stringify(gptData, null, 2));
  
  // Check if data changed
  if (claudeData && gptData && 
      (claudeData.trolleyFirstCount !== gptData.trolleyFirstCount || 
       claudeData.trolleyPct !== gptData.trolleyPct)) {
    console.log('\n✓ Model switching WORKS - data changed');
  } else {
    console.log('\n✗ Model switching BROKEN - data did not change');
  }
  
  // Now check Ring of Gyges specifically for GPT-OSS
  const gygesData = await page.evaluate(() => {
    const body = document.body.textContent;
    const gygesIdx = body.indexOf('Ring of Gyges');
    if (gygesIdx < 0) return { found: false };
    
    const section = body.substring(gygesIdx, gygesIdx + 500);
    
    // Look for refusal indicators
    const hasRefusalWord = /refusal/i.test(section);
    const has6slash20 = /6\s*\/\s*20/.test(section);
    const has14usable = /14\s+usable/.test(section);
    
    return {
      found: true,
      hasRefusalWord,
      has6slash20,
      has14usable,
      snippet: section.substring(0, 300)
    };
  });
  
  console.log('\n3. Ring of Gyges (GPT-OSS):', JSON.stringify(gygesData, null, 2));
  
  if (gygesData.found && gygesData.hasRefusalWord && gygesData.has6slash20) {
    console.log('\n✓ GPT-OSS Ring of Gyges refusals ARE visible');
  } else {
    console.log('\n✗ GPT-OSS refusals issue detected');
  }
  
  // Screenshot for manual verification
  await page.screenshot({ path: '/tmp/model-switch-test.png', fullPage: true });
  console.log('\nFull page screenshot: /tmp/model-switch-test.png');
  
  await browser.close();
})();

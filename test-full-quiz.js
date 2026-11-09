const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', error => errors.push(`PAGE ERROR: ${error.message}`));
  
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
  
  console.log('Starting quiz...');
  await page.click('button:has-text("Start")');
  await page.waitForTimeout(1000);
  
  // Answer all 10 questions by clicking the first visible option button each time
  for (let i = 0; i < 10; i++) {
    console.log(`Question ${i + 1}...`);
    await page.waitForTimeout(500);
    
    // Find all buttons, skip the first one (likely "Back" or similar)
    const buttons = page.locator('button').filter({ hasText: /^(?!Back).+/ });
    const count = await buttons.count();
    console.log(`  Found ${count} buttons`);
    
    if (count > 0) {
      await buttons.first().click();
    } else {
      console.log('  ERROR: No buttons found');
      break;
    }
    
    await page.waitForTimeout(300);
  }
  
  // Wait for results to load
  console.log('\nWaiting for results page...');
  await page.waitForTimeout(3000);
  
  // Check for model selector buttons
  const modelButtons = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const modelNames = ['Claude Haiku', 'GPT-OSS', 'Qwen', 'Gemini'];
    const found = buttons.filter(b => modelNames.some(name => b.textContent.includes(name)));
    return {
      total: found.length,
      texts: found.map(b => b.textContent.trim()),
      allButtonTexts: buttons.map(b => b.textContent.trim().substring(0, 60))
    };
  });
  
  console.log('\nModel selector buttons:', JSON.stringify(modelButtons, null, 2));
  
  // Check for formula explanation
  const formulaCheck = await page.evaluate(() => {
    const body = document.body.textContent;
    return {
      hasFormulaHeader: body.includes('How agreement is calculated'),
      hasExcluding: body.includes('excluding refusals'),
      hasExample: body.includes('15 times out of 18'),
      bodySnippet: body.substring(body.indexOf('agreement') - 50, body.indexOf('agreement') + 200)
    };
  });
  
  console.log('\nFormula explanation:', JSON.stringify(formulaCheck, null, 2));
  
  // Check for refusals display by looking for "refusal" and "/20" text
  const refusalCheck = await page.evaluate(() => {
    const body = document.body.textContent;
    return {
      hasRefusalText: body.includes('refusal'),
      hasNoAnswerText: body.includes('no answer'),
      has_20denominator: body.includes('/20'),
      questionByQuestion: body.includes('Question by question')
    };
  });
  
  console.log('\nRefusal display:', JSON.stringify(refusalCheck, null, 2));
  
  console.log('\nJavaScript errors:', errors.length > 0 ? errors : 'None');
  
  await browser.close();
})();

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
  
  // Quick quiz completion
  await page.click('button:has-text("Start")');
  await page.waitForTimeout(500);
  
  for (let i = 0; i < 10; i++) {
    const buttons = page.locator('button').filter({ hasText: /^(?!Back).+/ });
    await buttons.first().click();
    await page.waitForTimeout(200);
  }
  
  await page.waitForTimeout(2000);
  console.log('=== RESULTS PAGE LOADED ===\n');
  
  // Click first model button (Claude Haiku)
  await page.click('button:has-text("Claude Haiku")');
  await page.waitForTimeout(1500);
  
  console.log('1. After clicking Claude Haiku button:');
  const claudeState = await page.evaluate(() => {
    const body = document.body.textContent;
    return {
      hasQuestionByQuestion: body.includes('Question by question'),
      hasFormulaHeader: body.includes('How agreement is calculated'),
      formulaSnippet: (() => {
        const idx = body.indexOf('How agreement is calculated');
        return idx >= 0 ? body.substring(idx, idx + 400) : 'NOT FOUND';
      })(),
      hasModelSelectorButtons: (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const modelNames = ['Claude Haiku 5.5', 'GPT-OSS-120B', 'Qwen 3.6 27B', 'Gemini 3.8 Flash'];
        const selectorButtons = buttons.filter(b => 
          modelNames.some(name => b.textContent.trim() === name)
        );
        return {
          count: selectorButtons.length,
          texts: selectorButtons.map(b => b.textContent.trim())
        };
      })()
    };
  });
  
  console.log(JSON.stringify(claudeState, null, 2));
  console.log();
  
  // Look for GPT-OSS button in Q-by-Q section
  const gptButton = page.locator('button').filter({ hasText: 'GPT-OSS-120B' }).filter({ hasNotText: '%' }).first();
  const gptExists = await gptButton.count();
  
  console.log(`2. Found GPT-OSS-120B selector button: ${gptExists > 0 ? 'YES' : 'NO'}`);
  
  if (gptExists > 0) {
    await gptButton.click();
    await page.waitForTimeout(1500);
    
    console.log('\n3. After clicking GPT-OSS-120B selector:');
    const gptState = await page.evaluate(() => {
      const body = document.body.textContent;
      return {
        hasRingOfGyges: body.includes('Ring of Gyges') || body.includes('ring of gyges'),
        refusalMentions: (body.match(/refusal/gi) || []).length,
        has6_20refusal: body.includes('6/20 refusal'),
        gygesSnippet: (() => {
          const idx = body.toLowerCase().indexOf('ring');
          return idx >= 0 ? body.substring(idx, idx + 300) : 'NOT FOUND';
        })()
      };
    });
    
    console.log(JSON.stringify(gptState, null, 2));
    
    // Take screenshot showing GPT-OSS with refusals
    await page.screenshot({ path: '/tmp/gpt-oss-refusals.png', fullPage: false });
    console.log('\nScreenshot saved: /tmp/gpt-oss-refusals.png');
  }
  
  // Try Gemini
  const geminiButton = page.locator('button').filter({ hasText: 'Gemini 3.8 Flash' }).filter({ hasNotText: '%' }).first();
  const geminiExists = await geminiButton.count();
  
  console.log(`\n4. Found Gemini 3.8 Flash selector button: ${geminiExists > 0 ? 'YES' : 'NO'}`);
  
  if (geminiExists > 0) {
    await geminiButton.click();
    await page.waitForTimeout(1500);
    
    console.log('\n5. After clicking Gemini selector:');
    const geminiState = await page.evaluate(() => {
      const body = document.body.textContent;
      return {
        hasVeilOfIgnorance: body.includes('Veil of Ignorance') || body.includes('veil of ignorance'),
        noAnswerMentions: (body.match(/no answer/gi) || []).length,
        has1_20noAnswer: body.includes('1/20 no answer'),
        veilSnippet: (() => {
          const idx = body.toLowerCase().indexOf('veil');
          return idx >= 0 ? body.substring(idx, idx + 300) : 'NOT FOUND';
        })()
      };
    });
    
    console.log(JSON.stringify(geminiState, null, 2));
    
    await page.screenshot({ path: '/tmp/gemini-non-answer.png', fullPage: false });
    console.log('\nScreenshot saved: /tmp/gemini-non-answer.png');
  }
  
  await browser.close();
})();

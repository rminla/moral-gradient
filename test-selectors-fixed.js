const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
  
  // Complete quiz
  await page.click('button:has-text("Start")');
  await page.waitForTimeout(500);
  
  for (let i = 0; i < 10; i++) {
    const buttons = page.locator('button').filter({ hasText: /^(?!Back).+/ });
    await buttons.first().click();
    await page.waitForTimeout(200);
  }
  
  await page.waitForTimeout(2000);
  
  // Click the top model result button to expand details
  await page.click('button:has-text("Claude Haiku")');
  await page.waitForTimeout(1500);
  
  console.log('=== QUESTION-BY-QUESTION SECTION ===\n');
  
  // Look for the model selector buttons in the Q-by-Q section
  // These have format "{Model Name} ({score}%)"
  const selectorInfo = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    
    // Find buttons that look like model selectors (have model name + percentage)
    const modelPatterns = ['Claude Haiku 5.5', 'GPT-OSS-120B', 'Qwen 3.6 27B', 'Gemini 3.8 Flash'];
    const selectorButtons = allButtons.filter(b => {
      const text = b.textContent.trim();
      return modelPatterns.some(name => text.includes(name) && text.includes('(') && text.includes('%'));
    });
    
    // Count which section they're in
    const afterQuestionByQuestion = (() => {
      const body = document.body.textContent;
      const qbqIndex = body.indexOf('Question by question');
      if (qbqIndex < 0) return false;
      
      return selectorButtons.every(b => {
        const buttonText = b.textContent.trim();
        const buttonIndex = body.indexOf(buttonText, qbqIndex);
        return buttonIndex > qbqIndex;
      });
    })();
    
    return {
      totalSelectorButtons: selectorButtons.length,
      buttonTexts: selectorButtons.map(b => b.textContent.trim()),
      inQbyQSection: afterQuestionByQuestion,
      allButtonCount: allButtons.length
    };
  });
  
  console.log('Selector buttons found:', JSON.stringify(selectorInfo, null, 2));
  
  if (selectorInfo.totalSelectorButtons >= 4) {
    console.log('\n✓ All 4 model selector buttons present');
    
    // Try clicking GPT-OSS button
    await page.click('button:has-text("GPT-OSS-120B")');
    await page.waitForTimeout(1500);
    
    console.log('\n=== AFTER CLICKING GPT-OSS ===');
    
    const gygesCheck = await page.evaluate(() => {
      const body = document.body.textContent;
      
      // Find "Ring of Gyges" section
      const gygesIndex = body.indexOf('Ring of Gyges');
      if (gygesIndex < 0) return { found: false };
      
      const snippet = body.substring(gygesIndex, gygesIndex + 400);
      
      return {
        found: true,
        snippet,
        has6_20refusal: snippet.includes('6/20 refusal'),
        has3_14: snippet.includes('3/14'),
        has11_14: snippet.includes('11/14')
      };
    });
    
    console.log('Ring of Gyges check:', JSON.stringify(gygesCheck, null, 2));
    
    if (gygesCheck.has6_20refusal) {
      console.log('\n✓ GPT-OSS Ring of Gyges refusals displaying correctly');
    } else {
      console.log('\n✗ GPT-OSS refusals NOT visible');
    }
    
    // Screenshot
    await page.screenshot({ path: '/tmp/gpt-oss-gyges.png', fullPage: false });
    console.log('\nScreenshot: /tmp/gpt-oss-gyges.png');
    
    // Try Gemini
    await page.click('button:has-text("Gemini 3.8 Flash")');
    await page.waitForTimeout(1500);
    
    console.log('\n=== AFTER CLICKING GEMINI ===');
    
    const veilCheck = await page.evaluate(() => {
      const body = document.body.textContent;
      
      const veilIndex = body.indexOf('Veil of Ignorance');
      if (veilIndex < 0) return { found: false };
      
      const snippet = body.substring(veilIndex, veilIndex + 400);
      
      return {
        found: true,
        snippet,
        has1_20noAnswer: snippet.includes('1/20 no answer'),
        has19_19: snippet.includes('19/19')
      };
    });
    
    console.log('Veil of Ignorance check:', JSON.stringify(veilCheck, null, 2));
    
    if (veilCheck.has1_20noAnswer) {
      console.log('\n✓ Gemini Veil of Ignorance non-answer displaying correctly');
    } else {
      console.log('\n✗ Gemini non-answer NOT visible');
    }
    
    await page.screenshot({ path: '/tmp/gemini-veil.png', fullPage: false });
    console.log('Screenshot: /tmp/gemini-veil.png');
    
  } else {
    console.log('\n✗ Model selector buttons missing or incomplete');
  }
  
  await browser.close();
})();

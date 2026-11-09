const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });
  
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  console.log('JavaScript Errors:', errors.length > 0 ? errors : 'None');
  
  // Check if buttons render after completing quiz
  await page.click('button:has-text("Start")');
  await page.waitForTimeout(1000);
  
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300);
    const btns = await page.locator('button').all();
    if (btns.length > 2) await btns[2].click();
  }
  
  await page.waitForTimeout(5000);
  
  console.log('\nAfter quiz completion errors:', errors.filter((e, i, a) => a.indexOf(e) === i));
  
  // Check DOM for button elements
  const buttonDebug = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    return {
      totalButtons: allButtons.length,
      buttonTexts: allButtons.map(b => b.textContent.trim().substring(0, 50)).filter(t => t),
      hasModelNames: {
        claude: document.body.textContent.includes('Claude Haiku'),
        gpt: document.body.textContent.includes('GPT-OSS'),
        qwen: document.body.textContent.includes('Qwen'),
        gemini: document.body.textContent.includes('Gemini')
      }
    };
  });
  
  console.log('\nButton debug:', JSON.stringify(buttonDebug, null, 2));
  
  // Check if results section exists
  const resultsInfo = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    return {
      sectionCount: sections.length,
      hasKicker: !!document.querySelector('.kicker'),
      bodyIncludes: {
        'Question by question': document.body.textContent.includes('Question by question'),
        'Agreement': document.body.textContent.includes('Agreement'),
        'How agreement': document.body.textContent.includes('How agreement'),
        'usable': document.body.textContent.includes('usable')
      }
    };
  });
  
  console.log('\nResults section:', JSON.stringify(resultsInfo, null, 2));
  
  await browser.close();
})();

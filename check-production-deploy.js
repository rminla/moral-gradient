const { chromium } = require('playwright');

async function checkDeploy() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Checking production deployment...\n');
  
  // Check homepage link
  await page.goto('https://moral-gradient.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const homeHtml = await page.content();
  const hasQuizV4Link = homeHtml.includes('href="/quiz-v4"');
  console.log(`1. Homepage link to /quiz-v4: ${hasQuizV4Link ? '✓ DEPLOYED' : '❌ OLD'}`);
  
  // Check quiz page
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Start quiz
  await page.click('button:has-text("Start")');
  await page.waitForTimeout(2000);
  
  // Go to Sofie (question 7)
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    try {
      await page.click('button >> nth=2', { timeout: 5000 });
    } catch (e) {
      console.log(`   Click ${i+1} failed, retrying...`);
      await page.click('button', { timeout: 5000 });
    }
  }
  
  await page.waitForTimeout(2000);
  const bodyText = await page.textContent('body');
  
  const hasNewText = bodyText.includes('buy one to encourage');
  const hasOldText = bodyText.includes('Say you would to encourage her');
  
  console.log(`2. Sofie grammar fix: ${hasNewText ? '✓ DEPLOYED' : '❌ OLD'}`);
  console.log(`   Old text present: ${hasOldText ? '❌' : '✓'}`);
  
  // Continue to results
  for (let i = 6; i < 10; i++) {
    await page.waitForTimeout(500);
    try {
      await page.click('button >> nth=2', { timeout: 5000 });
    } catch (e) {
      await page.click('button', { timeout: 5000 });
    }
  }
  
  await page.waitForTimeout(3000);
  
  // Check for refusals
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(1000);
  
  const resultsText = await page.textContent('body');
  const hasUsable = resultsText.includes('usable');
  const hasRefusal = resultsText.includes('Refusal') || resultsText.includes('refusal');
  const has14 = resultsText.includes('/14');
  const has19 = resultsText.includes('/19');
  
  console.log(`3. Refusals display: ${(hasUsable || hasRefusal) ? '✓ DEPLOYED' : '❌ OLD'}`);
  console.log(`   Has 'usable': ${hasUsable ? '✓' : '❌'}`);
  console.log(`   Has refusal text: ${hasRefusal ? '✓' : '❌'}`);
  console.log(`   Has /14 denominator: ${has14 ? '✓' : '❌'}`);
  console.log(`   Has /19 denominator: ${has19 ? '✓' : '❌'}`);
  
  const allDeployed = hasQuizV4Link && hasNewText && !hasOldText && (hasUsable || hasRefusal);
  
  console.log(`\n${allDeployed ? '✅ NEW CODE DEPLOYED' : '❌ OLD CODE STILL LIVE'}`);
  
  await browser.close();
}

checkDeploy().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

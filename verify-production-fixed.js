const { chromium } = require('playwright');

async function verifyProductionFixed() {
  const browser = await chromium.launch({ headless: true });
  
  console.log('Testing production fixes at https://moral-gradient.vercel.app\n');
  
  // Test 1: Homepage link
  console.log('1. Testing homepage link...');
  const homePage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await homePage.goto('https://moral-gradient.vercel.app', { waitUntil: 'networkidle' });
  await homePage.waitForTimeout(2000);
  
  const mainQuizLink = await homePage.locator('main >> text=Which AI model are you most like?').getAttribute('href');
  const mainLinkCorrect = mainQuizLink === '/quiz-v4';
  console.log(`   Main area link: ${mainQuizLink} ${mainLinkCorrect ? '✓' : '❌'}`);
  
  await homePage.close();
  
  // Test 2-4: Quiz fixes at 1280px
  console.log('\n2. Testing quiz at 1280px...');
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const overflow = scrollWidth - clientWidth;
  console.log(`   Width check: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${overflow}px ${overflow === 0 ? '✓' : '❌'}`);
  
  await page.screenshot({ path: '/opt/cursor/artifacts/prod-fixed-1280-intro.png' });
  
  // Start quiz and go to Sofie (question 7)
  await page.click('button:has-text("Start")');
  await page.waitForTimeout(1000);
  
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(400);
    const buttons = await page.locator('button').all();
    if (buttons.length > 2) await buttons[2].click();
  }
  
  await page.waitForTimeout(1500);
  
  console.log('\n3. Testing Sofie text fix...');
  const sofieText = await page.textContent('body');
  const hasCorrectText = sofieText.includes('Say you would buy one to encourage her');
  const hasOldText = sofieText.includes('Say you would to encourage her');
  console.log(`   Correct text present: ${hasCorrectText ? '✓' : '❌'}`);
  console.log(`   Old text absent: ${!hasOldText ? '✓' : '❌'}`);
  
  await page.screenshot({ path: '/opt/cursor/artifacts/prod-fixed-sofie.png', fullPage: true });
  
  // Continue to results
  for (let i = 6; i < 10; i++) {
    await page.waitForTimeout(400);
    const buttons = await page.locator('button').all();
    if (buttons.length > 2) await buttons[2].click();
  }
  
  await page.waitForTimeout(3000);
  
  console.log('\n4. Testing refusals/non-answers display...');
  
  // Scroll to question-by-question section
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(1000);
  
  const resultsText = await page.textContent('body');
  
  // Check for refusals or usable denominator text
  const patterns = {
    'Refusal or refused': resultsText.toLowerCase().includes('refusal') || resultsText.toLowerCase().includes('refused'),
    'No answer': resultsText.toLowerCase().includes('no answer'),
    'Usable answers': resultsText.toLowerCase().includes('usable'),
    'Has /14 pattern': resultsText.includes('/14'),
    'Has /19 pattern': resultsText.includes('/19'),
  };
  
  Object.entries(patterns).forEach(([test, pass]) => {
    console.log(`   ${test}: ${pass ? '✓' : '❌'}`);
  });
  
  await page.screenshot({ path: '/opt/cursor/artifacts/prod-fixed-results-detail.png', fullPage: true });
  
  // Check for specific Ring of Gyges with GPT-OSS refusals
  const hasRingText = resultsText.includes('Ring') || resultsText.includes('Gyges');
  console.log(`   Ring of Gyges present: ${hasRingText ? '✓' : '❌'}`);
  
  await browser.close();
  
  console.log('\n✅ Production verification complete');
  console.log('Screenshots saved to /opt/cursor/artifacts/prod-fixed-*.png');
}

verifyProductionFixed().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

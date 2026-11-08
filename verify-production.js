const { chromium } = require('playwright');
const fs = require('fs');

const PROD_URL = 'https://moral-gradient.vercel.app/quiz-v4';
const ARTIFACTS_DIR = '/opt/cursor/artifacts';

async function verifyProduction() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  const results = {
    url: PROD_URL,
    timestamp: new Date().toISOString(),
    tests: [],
    screenshots: []
  };
  
  try {
    console.log('Loading quiz intro page...');
    await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Check intro page
    const introTitle = await page.textContent('h1');
    results.tests.push({ test: 'Intro title', passed: introTitle.includes('ethical twin'), value: introTitle });
    
    // Check no demo language
    const bodyText = await page.textContent('body');
    const hasDemo = bodyText.includes('demo data') || bodyText.includes('fictional') || bodyText.includes('mockup');
    results.tests.push({ test: 'No demo language', passed: !hasDemo, value: `Has demo text: ${hasDemo}` });
    
    // Screenshot intro
    const introPath = `${ARTIFACTS_DIR}/quiz-v4-prod-intro-desktop.png`;
    await page.screenshot({ path: introPath, fullPage: true });
    results.screenshots.push(introPath);
    console.log('✓ Intro screenshot saved');
    
    // Start quiz
    await page.click('button:has-text("Start")');
    await page.waitForTimeout(1500);
    
    // Verify 10 questions
    const questions = [
      { title: 'The Trolley', hasBackground: true },
      { title: 'The Experience Machine', hasBackground: true },
      { title: 'The Veil of Ignorance', hasBackground: true },
      { title: 'Omelas', hasBackground: true },
      { title: 'The Pig That Wants to Be Eaten', hasBackground: true },
      { title: 'The Ring of Gyges', hasBackground: true },
      { title: 'Sofie\'s Paintings', hasBackground: true },
      { title: 'The CEO\'s Preferred Candidate', hasBackground: true },
      { title: 'The Cancellation', hasBackground: true },
      { title: 'The Promised Shoes', hasBackground: true },
    ];
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionTitle = await page.textContent('h1');
      const hasTitle = questionTitle.includes(q.title);
      results.tests.push({ test: `Q${i+1}: ${q.title}`, passed: hasTitle, value: questionTitle });
      
      // Check for background section
      const hasBackground = await page.locator('text=Background').count() > 0;
      results.tests.push({ test: `Q${i+1}: Has background`, passed: hasBackground });
      
      // Check for AI relevance
      const hasAI = await page.locator('text=Why it matters for AI').count() > 0;
      results.tests.push({ test: `Q${i+1}: Has AI relevance`, passed: hasAI });
      
      // Screenshot first question (Trolley)
      if (i === 0) {
        const q1Path = `${ARTIFACTS_DIR}/quiz-v4-prod-q1-trolley-desktop.png`;
        await page.screenshot({ path: q1Path, fullPage: true });
        results.screenshots.push(q1Path);
        console.log('✓ Question 1 screenshot saved');
      }
      
      // Screenshot Ring of Gyges (question 6, index 5)
      if (i === 5) {
        const q6Path = `${ARTIFACTS_DIR}/quiz-v4-prod-q6-ring-desktop.png`;
        await page.screenshot({ path: q6Path, fullPage: true });
        results.screenshots.push(q6Path);
        console.log('✓ Question 6 (Ring) screenshot saved');
      }
      
      // Click first button to answer
      await page.click('button:has-text("")', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    
    // Now on results page
    console.log('Checking results page...');
    await page.waitForTimeout(2000);
    
    // Check for all 4 models
    const models = ['Claude Haiku 5.5', 'GPT-OSS-120B', 'Qwen 3.6 27B', 'Gemini 3.8 Flash'];
    for (const model of models) {
      const hasModel = await page.locator(`text=${model}`).count() > 0;
      results.tests.push({ test: `Model: ${model}`, passed: hasModel });
    }
    
    // Check for "20 samples per question"
    const hasSamples = await page.locator('text=/20 samples/i').count() > 0;
    results.tests.push({ test: 'Shows sample size', passed: hasSamples });
    
    // Check for frequency counts (looking for "/20" pattern)
    const bodyTextResults = await page.textContent('body');
    const hasFrequencies = bodyTextResults.includes('/20');
    results.tests.push({ test: 'Shows frequencies out of 20', passed: hasFrequencies });
    
    // Check for refusals
    const hasRefusal = bodyTextResults.toLowerCase().includes('refusal') || bodyTextResults.toLowerCase().includes('no answer');
    results.tests.push({ test: 'Shows refusals/non-answers', passed: hasRefusal });
    
    // Screenshot results overview
    const resultsPath = `${ARTIFACTS_DIR}/quiz-v4-prod-results-overview-desktop.png`;
    await page.screenshot({ path: resultsPath, fullPage: false });
    results.screenshots.push(resultsPath);
    console.log('✓ Results overview screenshot saved');
    
    // Scroll down to see question-by-question details
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(500);
    
    const resultsDetailPath = `${ARTIFACTS_DIR}/quiz-v4-prod-results-detail-desktop.png`;
    await page.screenshot({ path: resultsDetailPath, fullPage: true });
    results.screenshots.push(resultsDetailPath);
    console.log('✓ Results detail screenshot saved');
    
    // Mobile test
    console.log('Testing mobile viewport...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PROD_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    const mobileIntroPath = `${ARTIFACTS_DIR}/quiz-v4-prod-intro-mobile.png`;
    await page.screenshot({ path: mobileIntroPath, fullPage: true });
    results.screenshots.push(mobileIntroPath);
    console.log('✓ Mobile intro screenshot saved');
    
    // Click through one question on mobile
    await page.click('button:has-text("Start")');
    await page.waitForTimeout(1500);
    
    const mobileQuestionPath = `${ARTIFACTS_DIR}/quiz-v4-prod-question-mobile.png`;
    await page.screenshot({ path: mobileQuestionPath, fullPage: true });
    results.screenshots.push(mobileQuestionPath);
    console.log('✓ Mobile question screenshot saved');
    
  } catch (error) {
    results.error = error.message;
    console.error('Error during verification:', error);
  } finally {
    await browser.close();
  }
  
  // Summary
  const passed = results.tests.filter(t => t.passed).length;
  const total = results.tests.length;
  results.summary = {
    passed,
    total,
    success: passed === total,
    passRate: `${passed}/${total} (${Math.round(passed/total*100)}%)`
  };
  
  return results;
}

verifyProduction().then(results => {
  console.log('\n=== VERIFICATION RESULTS ===');
  console.log(`URL: ${results.url}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Tests: ${results.summary.passRate}`);
  console.log(`\nScreenshots saved:`);
  results.screenshots.forEach(s => console.log(`  - ${s}`));
  
  console.log(`\nTest Details:`);
  results.tests.forEach(t => {
    const status = t.passed ? '✓' : '✗';
    console.log(`  ${status} ${t.test}`);
  });
  
  if (results.error) {
    console.error(`\nError: ${results.error}`);
  }
  
  fs.writeFileSync('/tmp/verification-results.json', JSON.stringify(results, null, 2));
  console.log('\nFull results saved to /tmp/verification-results.json');
  
  process.exit(results.summary.success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

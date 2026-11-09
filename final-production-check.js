const { chromium } = require('playwright');
const fs = require('fs');

async function finalCheck() {
  const browser = await chromium.launch({ headless: true });
  
  const results = {
    timestamp: new Date().toISOString(),
    checks: {},
    measurements: {},
    screenshots: []
  };
  
  // Test at 1280px
  console.log('Testing at 1280px viewport...\n');
  const page1280 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page1280.goto('https://moral-gradient.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  await page1280.waitForTimeout(5000); // Wait for full hydration
  
  // Check homepage
  const homeContent = await page1280.content();
  results.checks.homepageQuizV4Link = homeContent.includes('href="/quiz-v4"');
  
  const homeScroll = await page1280.evaluate(() => document.documentElement.scrollWidth);
  const homeClient = await page1280.evaluate(() => document.documentElement.clientWidth);
  results.measurements.home1280 = { scrollWidth: homeScroll, clientWidth: homeClient, overflow: homeScroll - homeClient };
  
  console.log(`Homepage:
    Link to /quiz-v4: ${results.checks.homepageQuizV4Link ? 'YES' : 'NO'}
    scrollWidth: ${homeScroll}px, clientWidth: ${homeClient}px, overflow: ${homeScroll - homeClient}px`);
  
  const ss1 = '/opt/cursor/artifacts/final-prod-home-1280.png';
  await page1280.screenshot({ path: ss1, fullPage: false });
  results.screenshots.push(ss1);
  
  //  Navigate to quiz
  await page1280.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle', timeout: 30000 });
  await page1280.waitForTimeout(5000);
  
  const quizScroll = await page1280.evaluate(() => document.documentElement.scrollWidth);
  const quizClient = await page1280.evaluate(() => document.documentElement.clientWidth);
  results.measurements.quiz1280 = { scrollWidth: quizScroll, clientWidth: quizClient, overflow: quizScroll - quizClient };
  
  console.log(`\nQuiz intro:
    scrollWidth: ${quizScroll}px, clientWidth: ${quizClient}px, overflow: ${quizScroll - quizClient}px`);
  
  const ss2 = '/opt/cursor/artifacts/final-prod-quiz-1280.png';
  await page1280.screenshot({ path: ss2, fullPage: true });
  results.screenshots.push(ss2);
  
  await page1280.close();
  
  // Test at 1024px
  console.log('\nTesting at 1024px viewport...');
  const page1024 = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page1024.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle', timeout: 30000 });
  await page1024.waitForTimeout(3000);
  
  const quiz1024Scroll = await page1024.evaluate(() => document.documentElement.scrollWidth);
  const quiz1024Client = await page1024.evaluate(() => document.documentElement.clientWidth);
  results.measurements.quiz1024 = { scrollWidth: quiz1024Scroll, clientWidth: quiz1024Client, overflow: quiz1024Scroll - quiz1024Client };
  
  console.log(`    scrollWidth: ${quiz1024Scroll}px, clientWidth: ${quiz1024Client}px, overflow: ${quiz1024Scroll - quiz1024Client}px`);
  
  const ss3 = '/opt/cursor/artifacts/final-prod-quiz-1024.png';
  await page1024.screenshot({ path: ss3, fullPage: false });
  results.screenshots.push(ss3);
  
  await page1024.close();
  
  // Test at 390px (mobile)
  console.log('\nTesting at 390px viewport...');
  const page390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page390.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle', timeout: 30000 });
  await page390.waitForTimeout(3000);
  
  const quiz390Scroll = await page390.evaluate(() => document.documentElement.scrollWidth);
  const quiz390Client = await page390.evaluate(() => document.documentElement.clientWidth);
  results.measurements.quiz390 = { scrollWidth: quiz390Scroll, clientWidth: quiz390Client, overflow: quiz390Scroll - quiz390Client };
  
  console.log(`    scrollWidth: ${quiz390Scroll}px, clientWidth: ${quiz390Client}px, overflow: ${quiz390Scroll - quiz390Client}px`);
  
  const ss4 = '/opt/cursor/artifacts/final-prod-quiz-390.png';
  await page390.screenshot({ path: ss4, fullPage: true });
  results.screenshots.push(ss4);
  
  await page390.close();
  
  await browser.close();
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Homepage link: ${results.checks.homepageQuizV4Link ? '✓' : '❌'}`);
  console.log(`1280px overflow: ${results.measurements.quiz1280.overflow}px ${results.measurements.quiz1280.overflow === 0 ? '✓' : '❌'}`);
  console.log(`1024px overflow: ${results.measurements.quiz1024.overflow}px ${results.measurements.quiz1024.overflow === 0 ? '✓' : '❌'}`);
  console.log(`390px overflow: ${results.measurements.quiz390.overflow}px ${results.measurements.quiz390.overflow === 0 ? '✓' : '❌'}`);
  
  fs.writeFileSync('/tmp/final-production-check.json', JSON.stringify(results, null, 2));
  
  return results;
}

finalCheck().catch(err => console.error(err));

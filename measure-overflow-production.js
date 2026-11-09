const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // Test all viewports
  for (const viewport of [
    { width: 1280, height: 800, name: '1280px' },
    { width: 1024, height: 768, name: '1024px' },
    { width: 390, height: 844, name: '390px' }
  ]) {
    const page = await browser.newPage({ viewport });
    
    // Test homepage
    await page.goto('https://moral-gradient.vercel.app/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const homeScroll = await page.evaluate(() => document.documentElement.scrollWidth);
    const homeClient = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`${viewport.name} HOME: client=${homeClient} scroll=${homeScroll} overflow=${homeScroll-homeClient}`);
    
    // Test quiz
    await page.goto('https://moral-gradient.vercel.app/quiz-v4', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const quizScroll = await page.evaluate(() => document.documentElement.scrollWidth);
    const quizClient = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`${viewport.name} QUIZ: client=${quizClient} scroll=${quizScroll} overflow=${quizScroll-quizClient}`);
    
    await page.close();
  }
  
  await browser.close();
})();

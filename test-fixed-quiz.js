const { chromium } = require('playwright');

async function testFixedQuiz() {
  const browser = await chromium.launch();
  const results = [];
  
  console.log('=== Testing Fixed Quiz Layout ===\n');
  
  // Test configurations
  const viewports = [
    { name: '1024x565', width: 1024, height: 565 },
    { name: '1024x693', width: 1024, height: 693 },
    { name: '1280x800', width: 1280, height: 800 },
    { name: 'mobile-390', width: 390, height: 844 }
  ];
  
  for (const viewport of viewports) {
    console.log(`\n--- Testing ${viewport.name} (${viewport.width}×${viewport.height}) ---`);
    
    const context = await browser.newContext({ 
      viewport: { width: viewport.width, height: viewport.height } 
    });
    const page = await context.newPage();
    
    try {
      // Navigate to quiz
      await page.goto('http://localhost:3000/quiz-v4', { waitUntil: 'networkidle' });
      
      // 1. INTRO PAGE
      await page.waitForSelector('text=START', { timeout: 10000 });
      
      // Check overflow on intro
      const introOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }));
      
      console.log(`Intro page: ${introOverflow.scrollWidth}px scroll width, ${introOverflow.clientWidth}px client width`);
      console.log(`  Horizontal overflow: ${introOverflow.hasHorizontalOverflow ? 'YES ⚠️' : 'NO ✅'}`);
      
      // Take intro screenshot (for 1024x565 only)
      if (viewport.name === '1024x565') {
        await page.screenshot({ 
          path: '/opt/cursor/artifacts/quiz-fixed-intro-1024x565.png',
          fullPage: false 
        });
        console.log('  Screenshot: quiz-fixed-intro-1024x565.png');
      }
      
      // Click START
      await page.click('text=START');
      await page.waitForSelector('text=The Trolley', { timeout: 10000 });
      await page.waitForTimeout(500); // Let animations settle
      
      // 2. QUESTION 1 (The Trolley)
      const q1Overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollY: window.scrollY
      }));
      
      console.log(`Q1 (Trolley): ${q1Overflow.scrollWidth}px scroll width, ${q1Overflow.clientWidth}px client width`);
      console.log(`  Horizontal overflow: ${q1Overflow.hasHorizontalOverflow ? 'YES ⚠️' : 'NO ✅'}`);
      console.log(`  Scroll Y position: ${q1Overflow.scrollY}px`);
      
      // Take Q1 screenshots for specified viewports
      if (['1024x565', '1024x693', '1280x800'].includes(viewport.name)) {
        await page.screenshot({ 
          path: `/opt/cursor/artifacts/quiz-fixed-q1-${viewport.name}.png`,
          fullPage: false 
        });
        console.log(`  Screenshot: quiz-fixed-q1-${viewport.name}.png`);
      }
      
      // Navigate to Q2
      await page.click('text=LEAVE THE SWITCH ALONE');
      await page.waitForSelector('text=The Experience Machine', { timeout: 10000 });
      await page.waitForTimeout(500);
      
      // 3. QUESTION 2 (Experience Machine)
      const q2Overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollY: window.scrollY
      }));
      
      console.log(`Q2 (Experience Machine): ${q2Overflow.scrollWidth}px scroll width, ${q2Overflow.clientWidth}px client width`);
      console.log(`  Horizontal overflow: ${q2Overflow.hasHorizontalOverflow ? 'YES ⚠️' : 'NO ✅'}`);
      console.log(`  Scroll Y position: ${q2Overflow.scrollY}px`);
      
      // Take Q2 screenshots
      if (viewport.name === '1024x565' || viewport.name === '1280x800') {
        await page.screenshot({ 
          path: `/opt/cursor/artifacts/quiz-fixed-q2-${viewport.name}.png`,
          fullPage: false 
        });
        console.log(`  Screenshot: quiz-fixed-q2-${viewport.name}.png`);
      } else if (viewport.name === 'mobile-390') {
        await page.screenshot({ 
          path: '/opt/cursor/artifacts/quiz-fixed-q2-mobile-390.png',
          fullPage: false 
        });
        console.log('  Screenshot: quiz-fixed-q2-mobile-390.png');
      }
      
      // 4. Test BACK navigation (only for 1024x565)
      if (viewport.name === '1024x565') {
        // Go to Q3
        await page.click('text=STAY IN MY REAL LIFE');
        await page.waitForSelector('text=The Veil of Ignorance', { timeout: 10000 });
        await page.waitForTimeout(500);
        console.log('  Navigated to Q3 (Veil of Ignorance)');
        
        // Click BACK
        await page.click('text=BACK');
        await page.waitForSelector('text=The Experience Machine', { timeout: 10000 });
        await page.waitForTimeout(500);
        
        const q2BackScroll = await page.evaluate(() => window.scrollY);
        console.log(`  After BACK: Scroll Y = ${q2BackScroll}px ${q2BackScroll === 0 ? '✅' : '⚠️'}`);
        
        await page.screenshot({ 
          path: '/opt/cursor/artifacts/quiz-fixed-q2-after-back.png',
          fullPage: false 
        });
        console.log('  Screenshot: quiz-fixed-q2-after-back.png');
        
        // Continue through quiz to results
        console.log('  Completing quiz to reach results...');
        await page.click('text=STAY IN MY REAL LIFE'); // Answer Q2
        await page.waitForSelector('text=The Veil of Ignorance', { timeout: 10000 });
        await page.click('button:has-text("A MORE SECURE MINIMUM")'); // Q3
        await page.waitForTimeout(500);
        
        // Continue answering remaining questions
        for (let i = 0; i < 7; i++) {
          // Find and click the first button option
          const buttons = await page.$$('button');
          for (const button of buttons) {
            const text = await button.textContent();
            if (text && text.length > 10 && !text.includes('BACK')) {
              await button.click();
              await page.waitForTimeout(500);
              break;
            }
          }
        }
        
        // Check if we reached results
        const hasResults = await page.locator('text=Your ethical').count();
        if (hasResults > 0) {
          console.log('  Reached results page ✅');
          
          const resultsOverflow = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
          }));
          
          console.log(`  Results: ${resultsOverflow.scrollWidth}px scroll width, ${resultsOverflow.clientWidth}px client width`);
          console.log(`  Horizontal overflow: ${resultsOverflow.hasHorizontalOverflow ? 'YES ⚠️' : 'NO ✅'}`);
          
          await page.screenshot({ 
            path: '/opt/cursor/artifacts/quiz-fixed-results-1024x565.png',
            fullPage: false 
          });
          console.log('  Screenshot: quiz-fixed-results-1024x565.png');
        }
      }
      
      results.push({
        viewport: viewport.name,
        intro: introOverflow,
        q1: q1Overflow,
        q2: q2Overflow
      });
      
    } catch (error) {
      console.error(`  Error testing ${viewport.name}:`, error.message);
    }
    
    await context.close();
  }
  
  await browser.close();
  
  // Summary
  console.log('\n=== SUMMARY ===\n');
  results.forEach(r => {
    console.log(`${r.viewport}:`);
    console.log(`  Intro: ${r.intro.hasHorizontalOverflow ? '❌ OVERFLOW' : '✅ OK'}`);
    console.log(`  Q1: ${r.q1.hasHorizontalOverflow ? '❌ OVERFLOW' : '✅ OK'}`);
    console.log(`  Q2: ${r.q2.hasHorizontalOverflow ? '❌ OVERFLOW' : '✅ OK'}`);
  });
  
  console.log('\n✅ All tests complete!');
}

testFixedQuiz().catch(console.error);

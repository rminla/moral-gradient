const { chromium } = require('playwright');
const fs = require('fs');

async function testProductionQuiz() {
  const browser = await chromium.launch();
  const results = {
    questions: [],
    results: {},
    screenshots: [],
    issues: []
  };
  
  console.log('=== Testing Production Quiz at moral-gradient.vercel.app/quiz-v4 ===\n');
  
  // Test Desktop 1280x800
  console.log('--- Testing Desktop 1280×800 ---\n');
  const desktopContext = await browser.newContext({ 
    viewport: { width: 1280, height: 800 } 
  });
  const desktopPage = await desktopContext.newPage();
  
  try {
    await desktopPage.goto('https://moral-gradient.vercel.app/quiz-v4', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // 1. Intro page screenshot
    await desktopPage.waitForSelector('text=Start', { timeout: 10000 });
    await desktopPage.screenshot({ 
      path: '/opt/cursor/artifacts/quiz-v4-prod-intro.png',
      fullPage: false 
    });
    results.screenshots.push('quiz-v4-prod-intro.png');
    console.log('✅ Intro page captured');
    
    // Check for mockup/demo language
    const introText = await desktopPage.textContent('body');
    if (introText.toLowerCase().includes('mockup') || 
        introText.toLowerCase().includes('fictional') ||
        introText.toLowerCase().includes('demo data')) {
      results.issues.push('⚠️ Intro page contains mockup/demo/fictional language');
    } else {
      console.log('✅ No mockup/demo language on intro');
    }
    
    // Click Start
    await desktopPage.click('text=Start');
    await desktopPage.waitForTimeout(1000);
    
    // 2. Test all 10 questions
    for (let i = 1; i <= 10; i++) {
      console.log(`\nChecking Question ${i}...`);
      
      // Wait for question to load
      await desktopPage.waitForTimeout(500);
      
      const questionData = await desktopPage.evaluate(() => {
        const body = document.body.textContent;
        
        // Check for question number
        const hasQuestionNum = body.includes(`QUESTION ${i} OF 10`) || 
                               body.includes(`Question ${i}`);
        
        // Check for buttons (options)
        const buttons = document.querySelectorAll('button[class*="border"]');
        const buttonTexts = Array.from(buttons)
          .map(b => b.textContent.trim())
          .filter(t => t.length > 10 && !t.includes('BACK'));
        
        // Check for Background section
        const hasBackground = body.includes('BACKGROUND') || body.includes('Background');
        
        // Check for AI relevance section
        const hasAIRelevance = body.includes('WHY IT MATTERS FOR AI') || 
                               body.includes('Why it matters for AI');
        
        return {
          hasQuestionNum,
          optionCount: buttonTexts.length,
          options: buttonTexts.slice(0, 2),
          hasBackground,
          hasAIRelevance,
          bodyText: body.substring(0, 500)
        };
      }, i);
      
      results.questions.push({
        number: i,
        ...questionData
      });
      
      console.log(`  Options found: ${questionData.optionCount}`);
      console.log(`  Background section: ${questionData.hasBackground ? '✅' : '❌'}`);
      console.log(`  AI relevance section: ${questionData.hasAIRelevance ? '✅' : '❌'}`);
      
      if (questionData.optionCount !== 2) {
        results.issues.push(`Question ${i}: Expected 2 options, found ${questionData.optionCount}`);
      }
      if (!questionData.hasBackground) {
        results.issues.push(`Question ${i}: Background section missing`);
      }
      if (!questionData.hasAIRelevance) {
        results.issues.push(`Question ${i}: AI relevance section missing`);
      }
      
      // Take screenshots of Q1 and Q6
      if (i === 1) {
        await desktopPage.screenshot({ 
          path: '/opt/cursor/artifacts/quiz-v4-prod-trolley.png',
          fullPage: false 
        });
        results.screenshots.push('quiz-v4-prod-trolley.png');
        console.log('  📸 Screenshot: quiz-v4-prod-trolley.png');
      } else if (i === 6) {
        await desktopPage.screenshot({ 
          path: '/opt/cursor/artifacts/quiz-v4-prod-ring-of-gyges.png',
          fullPage: false 
        });
        results.screenshots.push('quiz-v4-prod-ring-of-gyges.png');
        console.log('  📸 Screenshot: quiz-v4-prod-ring-of-gyges.png');
      }
      
      // Click the first option to proceed
      if (i < 10) {
        const firstButton = await desktopPage.$$('button[class*="border"]');
        for (const btn of firstButton) {
          const text = await btn.textContent();
          if (text.trim().length > 10 && !text.includes('BACK')) {
            await btn.click();
            await desktopPage.waitForTimeout(800);
            break;
          }
        }
      }
    }
    
    // After Q10, should show results
    await desktopPage.waitForTimeout(2000);
    
    console.log('\n--- Checking Results Page ---\n');
    
    const resultsData = await desktopPage.evaluate(() => {
      const body = document.body.textContent;
      
      // Check for models
      const models = {
        claudeHaiku: body.includes('Claude') && body.includes('Haiku'),
        gptOSS: body.includes('GPT-OSS') || body.includes('GPT OSS'),
        qwen: body.includes('Qwen'),
        gemini: body.includes('Gemini')
      };
      
      // Check for mockup language
      const hasMockup = body.toLowerCase().includes('mockup') || 
                        body.toLowerCase().includes('fictional') ||
                        body.toLowerCase().includes('demo data');
      
      // Check for frequency counts (looking for "out of 20" or "/20")
      const hasFrequencies = body.includes('out of 20') || 
                             body.includes('/20') ||
                             body.includes('of 20');
      
      // Check for refusals/non-answers
      const hasRefusals = body.includes('refusal') || body.includes('Refusal');
      const hasNonAnswers = body.includes('non-answer') || body.includes('Non-answer');
      
      // Check for disclaimers
      const hasDisclaimers = body.includes('saw') || 
                             body.includes('presented') ||
                             body.includes('question');
      
      return {
        models,
        hasMockup,
        hasFrequencies,
        hasRefusals,
        hasNonAnswers,
        hasDisclaimers,
        bodyPreview: body.substring(0, 1000)
      };
    });
    
    results.results = resultsData;
    
    console.log('Models found:');
    console.log(`  Claude Haiku: ${resultsData.models.claudeHaiku ? '✅' : '❌'}`);
    console.log(`  GPT-OSS: ${resultsData.models.gptOSS ? '✅' : '❌'}`);
    console.log(`  Qwen: ${resultsData.models.qwen ? '✅' : '❌'}`);
    console.log(`  Gemini: ${resultsData.models.gemini ? '✅' : '❌'}`);
    console.log(`Frequency counts: ${resultsData.hasFrequencies ? '✅' : '❌'}`);
    console.log(`Refusals shown: ${resultsData.hasRefusals ? '✅' : '❌'}`);
    console.log(`Non-answers shown: ${resultsData.hasNonAnswers ? '✅' : '❌'}`);
    console.log(`Has disclaimers: ${resultsData.hasDisclaimers ? '✅' : '❌'}`);
    console.log(`Mockup language: ${resultsData.hasMockup ? '❌ FOUND' : '✅ NONE'}`);
    
    if (resultsData.hasMockup) {
      results.issues.push('⚠️ Results page contains mockup/demo/fictional language');
    }
    
    // Take results screenshots
    await desktopPage.screenshot({ 
      path: '/opt/cursor/artifacts/quiz-v4-prod-results.png',
      fullPage: false 
    });
    results.screenshots.push('quiz-v4-prod-results.png');
    console.log('\n📸 Screenshot: quiz-v4-prod-results.png');
    
    // Scroll to see more detail
    await desktopPage.evaluate(() => window.scrollBy(0, 400));
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({ 
      path: '/opt/cursor/artifacts/quiz-v4-prod-results-detail.png',
      fullPage: false 
    });
    results.screenshots.push('quiz-v4-prod-results-detail.png');
    console.log('📸 Screenshot: quiz-v4-prod-results-detail.png');
    
    await desktopContext.close();
    
    // Test Tablet 1024x693
    console.log('\n--- Testing Tablet 1024×693 ---\n');
    const tabletContext = await browser.newContext({ 
      viewport: { width: 1024, height: 693 } 
    });
    const tabletPage = await tabletContext.newPage();
    
    await tabletPage.goto('https://moral-gradient.vercel.app/quiz-v4', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    await tabletPage.waitForSelector('text=Start');
    await tabletPage.screenshot({ 
      path: '/opt/cursor/artifacts/quiz-v4-prod-tablet-intro.png',
      fullPage: false 
    });
    results.screenshots.push('quiz-v4-prod-tablet-intro.png');
    console.log('✅ Tablet intro captured');
    
    await tabletContext.close();
    
    // Test Mobile 390px
    console.log('\n--- Testing Mobile 390px ---\n');
    const mobileContext = await browser.newContext({ 
      viewport: { width: 390, height: 844 } 
    });
    const mobilePage = await mobileContext.newPage();
    
    await mobilePage.goto('https://moral-gradient.vercel.app/quiz-v4', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    await mobilePage.waitForSelector('text=Start');
    await mobilePage.screenshot({ 
      path: '/opt/cursor/artifacts/quiz-v4-prod-mobile-intro.png',
      fullPage: false 
    });
    results.screenshots.push('quiz-v4-prod-mobile-intro.png');
    console.log('📸 Mobile intro captured');
    
    // Go through to a question
    await mobilePage.click('text=Start');
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ 
      path: '/opt/cursor/artifacts/quiz-v4-prod-mobile-question.png',
      fullPage: false 
    });
    results.screenshots.push('quiz-v4-prod-mobile-question.png');
    console.log('📸 Mobile question captured');
    
    await mobileContext.close();
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    results.issues.push(`Error: ${error.message}`);
  }
  
  await browser.close();
  
  // Save results to file
  const report = JSON.stringify(results, null, 2);
  fs.writeFileSync('/opt/cursor/artifacts/quiz-v4-prod-test-results.json', report);
  
  return results;
}

testProductionQuiz()
  .then(results => {
    console.log('\n=== TEST SUMMARY ===\n');
    console.log(`Total questions tested: ${results.questions.length}`);
    console.log(`Screenshots captured: ${results.screenshots.length}`);
    console.log(`Issues found: ${results.issues.length}`);
    
    if (results.issues.length > 0) {
      console.log('\n⚠️ Issues:');
      results.issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('\n✅ All checks passed!');
    }
    
    console.log('\n📸 Screenshots saved:');
    results.screenshots.forEach(s => console.log(`  - ${s}`));
  })
  .catch(console.error);

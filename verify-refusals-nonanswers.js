const { chromium } = require('playwright');

async function verifyRefusalsAndNonAnswers() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  console.log('=== Verifying Refusals and Non-Answers ===\n');
  
  try {
    await page.goto('https://moral-gradient.vercel.app/quiz-v4', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.click('text=Start');
    await page.waitForTimeout(1000);
    
    // Answer all 10 questions quickly
    console.log('Answering all 10 questions...');
    for (let i = 1; i <= 10; i++) {
      const buttons = await page.$$('button[class*="border"]');
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text.trim().length > 10 && !text.includes('BACK')) {
          await btn.click();
          await page.waitForTimeout(600);
          break;
        }
      }
    }
    
    await page.waitForTimeout(2000);
    console.log('Reached results page\n');
    
    // Scroll down to see the full page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    // Get full page text
    const fullText = await page.textContent('body');
    
    // Check for refusals
    console.log('--- Checking for Refusals ---');
    const refusalMatches = fullText.match(/refusal|Refusal|REFUSAL/gi) || [];
    console.log(`Found ${refusalMatches.length} mentions of "refusal"`);
    
    // Look for specific patterns
    const ringOfGygesRefusal = fullText.includes('ring_of_gyges') && 
                                (fullText.includes('6 refusal') || fullText.includes('refusal'));
    console.log(`Ring of Gyges refusals: ${ringOfGygesRefusal ? '✅ FOUND' : '❌ NOT FOUND'}`);
    
    // Check for non-answers
    console.log('\n--- Checking for Non-Answers ---');
    const nonAnswerMatches = fullText.match(/non-answer|Non-answer|NON-ANSWER/gi) || [];
    console.log(`Found ${nonAnswerMatches.length} mentions of "non-answer"`);
    
    const veilNonAnswer = fullText.includes('veil_of_ignorance') && 
                          (fullText.includes('1 non-answer') || fullText.includes('non-answer'));
    console.log(`Veil of Ignorance non-answer: ${veilNonAnswer ? '✅ FOUND' : '❌ NOT FOUND'}`);
    
    // Take a full page screenshot for manual review
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/quiz-v4-prod-full-results.png',
      fullPage: true 
    });
    console.log('\n📸 Full page screenshot saved: quiz-v4-prod-full-results.png');
    
    // Extract text samples containing refusal/non-answer
    console.log('\n--- Text Samples ---');
    const lines = fullText.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('refusal') || line.includes('Refusal')) {
        console.log(`Refusal context: "${lines.slice(Math.max(0, idx-1), idx+2).join(' ')}"`);
      }
      if (line.includes('non-answer') || line.includes('Non-answer')) {
        console.log(`Non-answer context: "${lines.slice(Math.max(0, idx-1), idx+2).join(' ')}"`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

verifyRefusalsAndNonAnswers().catch(console.error);

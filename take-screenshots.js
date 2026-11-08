const { chromium } = require('playwright');

async function takeScreenshots() {
  const browser = await chromium.launch();
  
  // Screenshot 1: 1024x693 - Question 2 (Experience Machine)
  let page = await browser.newPage({ viewport: { width: 1024, height: 693 } });
  await page.goto('http://localhost:3000/quiz-v4');
  await page.waitForSelector('text=START', { timeout: 10000 });
  await page.click('text=START');
  // First goes to Question 1 (The Trolley)
  await page.waitForSelector('text=The Trolley', { timeout: 10000 });
  // Click an answer to go to Question 2
  await page.click('text=LEAVE THE SWITCH ALONE');
  await page.waitForSelector('text=The Experience Machine', { timeout: 10000 });
  await page.screenshot({ path: '/opt/cursor/artifacts/quiz-desktop-1024-experience.png', fullPage: false });
  console.log('Screenshot 1 saved: quiz-desktop-1024-experience.png');
  await page.close();
  
  // Screenshot 2: 1280x800 - Question 2 (Experience Machine)
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/quiz-v4');
  await page.waitForSelector('text=START', { timeout: 10000 });
  await page.click('text=START');
  await page.waitForSelector('text=The Trolley', { timeout: 10000 });
  await page.click('text=LEAVE THE SWITCH ALONE');
  await page.waitForSelector('text=The Experience Machine', { timeout: 10000 });
  await page.screenshot({ path: '/opt/cursor/artifacts/quiz-desktop-1280-experience.png', fullPage: false });
  console.log('Screenshot 2 saved: quiz-desktop-1280-experience.png');
  
  // Navigate to Question 3
  await page.click('text=STAY IN MY REAL LIFE');
  await page.waitForSelector('text=The Veil of Ignorance', { timeout: 10000 });
  await page.screenshot({ path: '/opt/cursor/artifacts/quiz-desktop-1280-veil.png', fullPage: false });
  console.log('Screenshot 3 saved: quiz-desktop-1280-veil.png');
  await page.close();
  
  // Screenshot 4: 390px wide (mobile) - Question 2
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:3000/quiz-v4');
  await page.waitForSelector('text=START', { timeout: 10000 });
  await page.click('text=START');
  await page.waitForSelector('text=The Trolley', { timeout: 10000 });
  await page.click('text=LEAVE THE SWITCH ALONE');
  await page.waitForSelector('text=The Experience Machine', { timeout: 10000 });
  await page.screenshot({ path: '/opt/cursor/artifacts/quiz-mobile-390-experience.png', fullPage: false });
  console.log('Screenshot 4 saved: quiz-mobile-390-experience.png');
  
  // Navigate to Question 3
  await page.click('text=STAY IN MY REAL LIFE');
  await page.waitForSelector('text=The Veil of Ignorance', { timeout: 10000 });
  await page.screenshot({ path: '/opt/cursor/artifacts/quiz-mobile-390-veil.png', fullPage: false });
  console.log('Screenshot 5 saved: quiz-mobile-390-veil.png');
  await page.close();
  
  await browser.close();
  console.log('All screenshots completed!');
}

takeScreenshots().catch(console.error);

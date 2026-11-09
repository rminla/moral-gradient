import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';

const CHROME_PATH = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium', { encoding: 'utf-8' }).trim();

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const screenshots = [
  {
    name: 'trolley-question-1280',
    url: 'http://localhost:3000/quiz-v4',
    width: 1280,
    height: 1024,
    description: 'Trolley question at 1280px - before answering',
    actions: async (page) => {
      // Click Start button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const startBtn = buttons.find(b => b.textContent.includes('Start'));
        if (startBtn) startBtn.click();
      });
      await wait(1000);
    }
  },
  {
    name: 'trolley-after-answer-1280',
    url: 'http://localhost:3000/quiz-v4',
    width: 1280,
    height: 1800,
    description: 'Trolley after answering at 1280px',
    actions: async (page) => {
      // Click Start
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const startBtn = buttons.find(b => b.textContent.includes('Start'));
        if (startBtn) startBtn.click();
      });
      await wait(1000);
      
      // Answer the question (pull switch)
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const pullBtn = buttons.find(b => b.textContent.includes('Pull the switch'));
        if (pullBtn) pullBtn.click();
      });
      await wait(1000);
    }
  },
  {
    name: 'veil-after-answer-split-1280',
    url: 'http://localhost:3000/quiz-v4',
    width: 1280,
    height: 1800,
    description: 'Veil of Ignorance after answering at 1280px (split question)',
    actions: async (page) => {
      // Start quiz
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const startBtn = buttons.find(b => b.textContent.includes('Start'));
        if (startBtn) startBtn.click();
      });
      await wait(1000);
      
      // Question 1: Trolley
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const pullBtn = buttons.find(b => b.textContent.includes('Pull the switch'));
        if (pullBtn) pullBtn.click();
      });
      await wait(1000);
      
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(b => b.textContent.includes('Next question'));
        if (nextBtn) nextBtn.click();
      });
      await wait(1000);
      
      // Question 2: Experience Machine
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const answerBtn = buttons.find(b => b.textContent.includes('Stay in my real life'));
        if (answerBtn) answerBtn.click();
      });
      await wait(1000);
      
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(b => b.textContent.includes('Next question'));
        if (nextBtn) nextBtn.click();
      });
      await wait(1000);
      
      // Question 3: Veil of Ignorance - answer Society A
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const answerBtn = buttons.find(b => b.textContent.includes('A more secure minimum'));
        if (answerBtn) answerBtn.click();
      });
      await wait(1000);
    }
  },
  {
    name: 'trolley-after-answer-390',
    url: 'http://localhost:3000/quiz-v4',
    width: 390,
    height: 1600,
    description: 'Trolley after answering at 390px (mobile)',
    actions: async (page) => {
      // Click Start
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const startBtn = buttons.find(b => b.textContent.includes('Start'));
        if (startBtn) startBtn.click();
      });
      await wait(1000);
      
      // Answer the question
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const pullBtn = buttons.find(b => b.textContent.includes('Pull the switch'));
        if (pullBtn) pullBtn.click();
      });
      await wait(1000);
    }
  },
  {
    name: 'veil-after-answer-split-390',
    url: 'http://localhost:3000/quiz-v4',
    width: 390,
    height: 1800,
    description: 'Veil of Ignorance after answering at 390px (mobile, split question)',
    actions: async (page) => {
      // Start quiz
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const startBtn = buttons.find(b => b.textContent.includes('Start'));
        if (startBtn) startBtn.click();
      });
      await wait(1000);
      
      // Question 1: Trolley
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const pullBtn = buttons.find(b => b.textContent.includes('Pull the switch'));
        if (pullBtn) pullBtn.click();
      });
      await wait(1000);
      
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(b => b.textContent.includes('Next question'));
        if (nextBtn) nextBtn.click();
      });
      await wait(1000);
      
      // Question 2: Experience Machine
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const answerBtn = buttons.find(b => b.textContent.includes('Stay in my real life'));
        if (answerBtn) answerBtn.click();
      });
      await wait(1000);
      
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(b => b.textContent.includes('Next question'));
        if (nextBtn) nextBtn.click();
      });
      await wait(1000);
      
      // Question 3: Veil of Ignorance
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const answerBtn = buttons.find(b => b.textContent.includes('A more secure minimum'));
        if (answerBtn) answerBtn.click();
      });
      await wait(1000);
    }
  },
];

async function takeScreenshots() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  for (const screenshot of screenshots) {
    console.log(`Taking screenshot: ${screenshot.description}`);
    const page = await browser.newPage();
    await page.setViewport({ width: screenshot.width, height: screenshot.height });
    await page.goto(screenshot.url, { waitUntil: 'networkidle0' });
    
    if (screenshot.actions) {
      await screenshot.actions(page);
    }
    
    await page.screenshot({
      path: `/opt/cursor/artifacts/${screenshot.name}.png`,
      fullPage: false
    });
    
    await page.close();
    console.log(`Saved: ${screenshot.name}.png`);
  }

  await browser.close();
  console.log('\nAll screenshots saved to /opt/cursor/artifacts/');
}

takeScreenshots().catch(console.error);

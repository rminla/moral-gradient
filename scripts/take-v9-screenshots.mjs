import puppeteer from "puppeteer";
import { writeFile } from "fs/promises";

const BASE_URL = process.argv[2] || "http://localhost:3456";
const OUTPUT_DIR = process.argv[3] || "/tmp/quiz-v9-screenshots";

async function takeScreenshot(page, width, name) {
  await page.setViewport({ width, height: 1080 });
  await new Promise(resolve => setTimeout(resolve, 800));
  const screenshot = await page.screenshot({ fullPage: true, type: "png" });
  const path = `${OUTPUT_DIR}/${name}-${width}.png`;
  await writeFile(path, screenshot);
  console.log(`Saved: ${path}`);
  return path;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Trolley (all models agree) - before answer
    console.log("\nTrolley - before answer...");
    await page.goto(`${BASE_URL}/quiz-v4`, { waitUntil: "networkidle2" });
    
    // Start quiz
    await page.waitForSelector('button');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startButton = buttons.find(b => b.textContent.includes('Start'));
      if (startButton) startButton.click();
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Take screenshots before answering
    await takeScreenshot(page, 1280, "trolley-before");
    await takeScreenshot(page, 390, "trolley-before");
    
    // Answer "Pull the switch"
    console.log("\nTrolley - answering...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pullButton = buttons.find(b => b.textContent.includes('Pull the switch'));
      if (pullButton) pullButton.click();
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take screenshots after answering
    await takeScreenshot(page, 1280, "trolley-after");
    await takeScreenshot(page, 390, "trolley-after");
    
    // Navigate to Veil of Ignorance (question 3)
    console.log("\nNavigating to Veil of Ignorance...");
    await page.goto(`${BASE_URL}/quiz-v4`, { waitUntil: "networkidle2" });
    
    // Start and skip to question 3
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startButton = buttons.find(b => b.textContent.includes('Start'));
      if (startButton) startButton.click();
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Skip first two questions
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const firstChoice = buttons.find(b => b.classList.contains('btn-ghost'));
        if (firstChoice) firstChoice.click();
      });
      await new Promise(resolve => setTimeout(resolve, 800));
      
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextButton = buttons.find(b => b.textContent.includes('Next') || b.textContent.includes('question'));
        if (nextButton) nextButton.click();
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Veil of Ignorance - before answer
    console.log("\nVeil - before answer...");
    await takeScreenshot(page, 1280, "veil-before");
    await takeScreenshot(page, 390, "veil-before");
    
    // Answer "Greater prosperity, with a less secure minimum" (Society B, split question)
    console.log("\nVeil - answering...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const societyBButton = buttons.find(b => b.textContent.includes('Greater prosperity'));
      if (societyBButton) societyBButton.click();
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take screenshots after answering
    await takeScreenshot(page, 1280, "veil-after");
    await takeScreenshot(page, 390, "veil-after");
    
    console.log("\n✓ All screenshots captured");
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

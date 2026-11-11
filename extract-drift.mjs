import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:3000/drift';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

// Click the method details to expand it
try {
  await page.click('button:has-text("Show the full method")');
  await page.waitForTimeout(500);
} catch (e) {
  // Already expanded or button not found
}

const text = await page.locator('main').innerText();
console.log(text);

await browser.close();

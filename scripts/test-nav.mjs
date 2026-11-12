import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const WIDTHS = [1440, 1280, 1024, 768, 390];
const PAGES = [
  { url: 'http://localhost:3000', name: 'homepage' },
  { url: 'http://localhost:3000/about', name: 'about' },
  { url: 'http://localhost:3000/try', name: 'try' },
];

async function testNav() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const outputDir = '/opt/cursor/artifacts/nav-screenshots';
  await mkdir(outputDir, { recursive: true });

  const results = [];

  // Test each width on each page
  for (const { url, name } of PAGES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Take regular screenshot
      await page.screenshot({
        path: join(outputDir, `${name}-${width}px.png`),
        fullPage: false,
      });

      // Check for horizontal overflow
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      results.push({
        page: name,
        width,
        ...overflow,
        status: overflow.hasOverflow ? '❌ OVERFLOW' : '✅ OK',
      });

      console.log(`${name} @ ${width}px: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth} - ${overflow.hasOverflow ? 'OVERFLOW' : 'OK'}`);
    }
  }

  // Test dropdowns at desktop width (1280px)
  await page.setViewportSize({ width: 1280, height: 900 });
  
  // Test Results dropdown
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.hover('nav a[href="/results"]');
  await page.waitForTimeout(300);
  await page.screenshot({
    path: join(outputDir, 'dropdown-results-1280px.png'),
    fullPage: false,
  });

  // Test About dropdown
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const aboutButton = await page.locator('nav button:has-text("About")').first();
  await aboutButton.hover();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: join(outputDir, 'dropdown-about-1280px.png'),
    fullPage: false,
  });

  // Test mobile menu at 390px
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.click('button:has-text("Menu")');
  await page.waitForTimeout(300);
  await page.screenshot({
    path: join(outputDir, 'mobile-menu-390px.png'),
    fullPage: true,
  });

  await browser.close();

  // Write results to file
  await writeFile(
    join(outputDir, 'overflow-check.txt'),
    results.map(r => `${r.page.padEnd(10)} @ ${String(r.width).padStart(4)}px: scrollWidth=${String(r.scrollWidth).padStart(4)}, clientWidth=${String(r.clientWidth).padStart(4)} - ${r.status}`).join('\n')
  );

  console.log('\n=== OVERFLOW CHECK SUMMARY ===');
  results.forEach(r => {
    console.log(`${r.page.padEnd(10)} @ ${String(r.width).padStart(4)}px: ${r.status}`);
  });

  const hasAnyOverflow = results.some(r => r.hasOverflow);
  if (hasAnyOverflow) {
    console.log('\n❌ FAILED: Horizontal overflow detected');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: No horizontal overflow at any tested width');
    console.log(`\nScreenshots saved to: ${outputDir}`);
  }
}

testNav().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

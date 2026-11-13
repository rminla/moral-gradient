#!/usr/bin/env node
/**
 * Test the new logomark at various viewport sizes and capture screenshots.
 */
import { chromium } from "playwright";
import fs from "fs/promises";

const ARTIFACT_DIR = "/opt/cursor/artifacts";
const BASE_URL = "http://localhost:3000";

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  // Additional test sizes to verify no overflow
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
];

async function testLogomark() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  console.log("Testing logomark at various viewport sizes...\n");
  
  // Test each viewport
  for (const viewport of VIEWPORTS) {
    console.log(`Testing ${viewport.name} (${viewport.width}x${viewport.height})...`);
    
    const page = await context.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    
    // Check for horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    if (hasOverflow) {
      console.warn(`  ⚠️  Horizontal overflow detected at ${viewport.name}`);
    } else {
      console.log(`  ✓ No horizontal overflow`);
    }
    
    // Take full page screenshot for desktop views, header-only for all
    const headerHeight = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? header.offsetHeight : 0;
    });
    
    // Screenshot of just the header
    if (viewport.name === "desktop-1280" || viewport.name === "mobile-390") {
      const screenshotPath = `${ARTIFACT_DIR}/header-${viewport.name}.png`;
      await page.screenshot({
        path: screenshotPath,
        clip: { x: 0, y: 0, width: viewport.width, height: Math.max(headerHeight, 64) },
      });
      console.log(`  ✓ Header screenshot saved: ${screenshotPath}`);
    }
    
    await page.close();
  }
  
  // Capture favicon
  console.log("\nCapturing favicon...");
  const page = await context.newPage();
  await page.goto(BASE_URL);
  
  // Get the favicon URL
  const faviconUrl = await page.evaluate(() => {
    const link = document.querySelector('link[rel*="icon"]');
    return link ? link.href : '/favicon-32.png';
  });
  
  await page.goto(faviconUrl.startsWith('http') ? faviconUrl : BASE_URL + faviconUrl);
  const faviconPath = `${ARTIFACT_DIR}/favicon.png`;
  await page.screenshot({ path: faviconPath });
  console.log(`  ✓ Favicon screenshot saved: ${faviconPath}`);
  
  await page.close();
  await browser.close();
  
  console.log("\n✅ Logomark testing complete!");
  console.log(`\nArtifacts saved to: ${ARTIFACT_DIR}/`);
}

testLogomark().catch(console.error);

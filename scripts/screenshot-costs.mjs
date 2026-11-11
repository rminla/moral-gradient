#!/usr/bin/env node
/**
 * Take screenshots of the costs page and homepage for verification.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  
  const screenshots = [
    { url: 'http://localhost:3000/costs', name: 'costs-desktop', width: 1280, height: 1024 },
    { url: 'http://localhost:3000/costs', name: 'costs-mobile', width: 390, height: 844 },
    { url: 'http://localhost:3000', name: 'homepage-desktop', width: 1280, height: 1024 },
    { url: 'http://localhost:3000', name: 'homepage-mobile', width: 390, height: 844 },
  ];
  
  for (const shot of screenshots) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
    console.log(`Taking screenshot: ${shot.name} (${shot.width}x${shot.height})`);
    
    try {
      await page.goto(shot.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000); // Let any animations settle
      
      const path = `/opt/cursor/artifacts/${shot.name}.png`;
      await page.screenshot({ path, fullPage: true });
      console.log(`✓ Saved: ${path}`);
    } catch (err) {
      console.error(`✗ Failed: ${shot.name}`, err.message);
    } finally {
      await page.close();
    }
  }
  
  await browser.close();
  console.log('\nAll screenshots saved to /opt/cursor/artifacts/');
}

takeScreenshots().catch(console.error);

#!/usr/bin/env node
/**
 * Regenerate app/apple-icon.png from the logomark SVG.
 */
import fs from "fs/promises";
import { launch } from "puppeteer-core";

const SVG_PATH = "./public/moral-gradient-logomark.svg";
const OUTPUT_PATH = "./app/apple-icon.png";
const SIZE = 180;

async function regenerateAppleIcon() {
  const svgContent = await fs.readFile(SVG_PATH, "utf-8");
  
  const chromePaths = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ];
  
  let executablePath;
  for (const path of chromePaths) {
    try {
      await fs.access(path);
      executablePath = path;
      break;
    } catch {}
  }
  
  if (!executablePath) {
    throw new Error("Chrome/Chromium not found");
  }
  
  console.log(`Generating ${OUTPUT_PATH} (${SIZE}x${SIZE})...`);
  
  const browser = await launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: SIZE, height: SIZE });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 0; width: ${SIZE}px; height: ${SIZE}px; }
          svg { display: block; width: 100%; height: 100%; }
        </style>
      </head>
      <body>${svgContent}</body>
    </html>
  `);
  
  await page.screenshot({ path: OUTPUT_PATH, omitBackground: false });
  console.log(`✓ ${OUTPUT_PATH}`);
  
  await browser.close();
}

regenerateAppleIcon().catch(console.error);

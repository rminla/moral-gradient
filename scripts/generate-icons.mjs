#!/usr/bin/env node
/**
 * Generate favicon and app icons from the SVG logomark.
 * Outputs: favicon.ico (via multiple PNGs), apple-touch-icon.png, icon-192.png, icon-512.png
 */
import fs from "fs/promises";
import { launch } from "puppeteer-core";
import { execSync } from "child_process";

const SVG_PATH = "./public/moral-gradient-logomark.svg";
const OUTPUT_DIR = "./app";

const SIZES = [
  { name: "favicon-16.png", size: 16 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-48.png", size: 48 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
];

async function generateIcons() {
  const svgContent = await fs.readFile(SVG_PATH, "utf-8");
  
  // Find Chrome/Chromium executable
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
    throw new Error("Chrome/Chromium not found. Tried: " + chromePaths.join(", "));
  }
  
  console.log("Using browser:", executablePath);
  
  const browser = await launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  
  const page = await browser.newPage();
  
  for (const { name, size } of SIZES) {
    console.log(`Generating ${name} (${size}x${size})...`);
    
    await page.setViewport({ width: size, height: size });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; }
            svg { display: block; width: 100%; height: 100%; }
          </style>
        </head>
        <body>${svgContent}</body>
      </html>
    `);
    
    const outputPath = `${OUTPUT_DIR}/${name}`;
    await page.screenshot({ path: outputPath, omitBackground: false });
    console.log(`  ✓ ${outputPath}`);
  }
  
  await browser.close();
  
  // Generate favicon.ico from the 16, 32, 48 PNGs if ImageMagick is available
  try {
    console.log("\nGenerating favicon.ico...");
    execSync(
      `convert ${OUTPUT_DIR}/favicon-16.png ${OUTPUT_DIR}/favicon-32.png ${OUTPUT_DIR}/favicon-48.png ${OUTPUT_DIR}/favicon.ico`,
      { stdio: "inherit" }
    );
    console.log("  ✓ app/favicon.ico");
    
    // Clean up intermediate favicon PNGs
    await fs.unlink(`${OUTPUT_DIR}/favicon-16.png`);
    await fs.unlink(`${OUTPUT_DIR}/favicon-32.png`);
    await fs.unlink(`${OUTPUT_DIR}/favicon-48.png`);
  } catch (err) {
    console.log("  ImageMagick not available, keeping individual PNG files");
    console.log("  (favicon-16.png, favicon-32.png, favicon-48.png)");
  }
  
  console.log("\n✅ Icon generation complete!");
}

generateIcons().catch(console.error);

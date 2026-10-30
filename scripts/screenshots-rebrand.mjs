// Rebrand review shots: full-page desktop (1366px) and mobile (390px). Usage: BASE=http://localhost:3100 node scripts/screenshots-rebrand.mjs
import fs from "node:fs";
import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "screenshots/rebrand"; fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true });
const page = await browser.newPage();
const shot = async (name, path, full = true) => {
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("saved", `${OUT}/${name}.png`);
};
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
await shot("01-home-desktop", "/");
await shot("02-results-desktop", "/results");
await shot("03-donate-desktop", "/donate");
await shot("04-about-desktop", "/about");
await shot("06-finding-desktop", "/f/haiku-car01-saydo-gap");
await shot("07-scenario-desktop", "/scenarios/SD-CAR-01");
await shot("08-costs-desktop", "/costs");
await shot("09-model-desktop", "/models/claude-haiku-5-5");
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await shot("10-og-finding", "/f/haiku-car01-saydo-gap/opengraph-image", false);
await shot("11-og-site", "/opengraph-image", false);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await shot("05-home-mobile", "/");
await browser.close();

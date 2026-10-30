// Design-direction review shots. Usage: BASE=http://localhost:3100 OUT=screenshots/design-a node scripts/screenshots-design.mjs
import fs from "node:fs";
import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "screenshots/design"; fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true });
const page = await browser.newPage();
const shot = async (name, path, full = true) => {
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 2200)); // let entrance animations settle
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("saved", `${OUT}/${name}.png`);
};
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await shot("01-home-desktop", "/");
await shot("03-results-desktop", "/results");
await shot("04-about-desktop", "/about");
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await shot("02-home-mobile", "/");
await browser.close();

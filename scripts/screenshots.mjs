// Capture key pages to screenshots/*.png with the system Chrome. Assumes the site runs on BASE (default http://localhost:3000)
// with ALLOW_MOCK_PAYMENTS=1 and ALLOW_DEV_LOGIN=1. Makes one anonymous mock donation (run `npm run db:init -- --reset-local` afterwards to clear it) and signs in through the dev magic link.
import fs from "node:fs";
import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "screenshots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
const shot = async (name, path, { full = true, before } = {}) => {
  if (path) await page.goto(BASE + path, { waitUntil: "networkidle0" });
  if (before) await before();
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("saved", `${OUT}/${name}.png`);
};
const firstFinding = process.env.FINDING || "haiku-car01-saydo-gap";
// Donation flow (mock): named $25 donation
const amount = process.env.DONATION || "25";
await page.goto(BASE + "/donate", { waitUntil: "networkidle0" });
await page.click('input[name="amount"][value=""]');
await page.type('input[name="amount_custom"]', amount);
await page.click('input[name="display_mode"][value="anonymous"]');
await page.type('input[name="message"]', "Testing the mock checkout");
await page.type('input[name="email"]', "donor@example.com");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("form button.btn-money")]);
await shot("10-mock-checkout", null);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("form button.btn-primary")]);
await shot("11-donate-thanks", null);
await shot("12-costs-after-donation", "/costs");
await shot("01-home", "/");
await shot("02-results", "/results");
await shot("03-model-claude-haiku-5-5", "/models/claude-haiku-5-5");
await shot("04-scenario-SD-CAR-01-public", "/scenarios/SD-CAR-01");
await shot("05-finding-share", `/f/${firstFinding}`);
await shot("06-og-image", `/f/${firstFinding}/opengraph-image`, { full: false });
await shot("07-costs-and-funding", "/costs");
await shot("08-about-methodology", "/about");
await shot("09-donate", "/donate");

// Magic-link sign-in (dev link shown on screen)
await page.goto(BASE + "/signin?next=/scenarios/SD-CAR-01", { waitUntil: "networkidle0" });
await page.type('input[name="email"]', "donor@example.com");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("form button")]);
await shot("13-signin-link-sent", null, { full: false });
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("a[href*='/api/auth/verify']")]);
await shot("14-scenario-SD-CAR-01-donor-traces", "/scenarios/SD-CAR-01?v=do%3Aoriginal");
await shot("15-account", "/account");
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await shot("16-home-mobile", "/", { full: false });
await browser.close();

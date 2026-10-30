// Signal review shots + mobile overflow check. Usage: BASE=http://localhost:3100 OUT=screenshots/signal node scripts/screenshots-signal.mjs
import fs from "node:fs";
import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "screenshots/signal"; fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true });
const page = await browser.newPage();
const go = async (path) => { await page.goto(BASE + path, { waitUntil: "networkidle0" }); await page.evaluate(() => document.fonts.ready); await new Promise((r) => setTimeout(r, 2200)); };
const shot = async (name, path) => { await go(path); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log("saved", name); };
const PAGES = [["home", "/"], ["results", "/results"], ["models", "/models"], ["model-detail", "/models/claude-haiku-5-5"], ["scenario", "/scenarios/SD-CAR-01"], ["finding", "/f/haiku-car01-saydo-gap"],
  ["costs", "/costs"], ["donate", "/donate"], ["donate-thanks", "/donate/thanks"], ["signin", "/signin"], ["about", "/about"], ["not-found", "/this-page-does-not-exist"]];
// overflow check at 390
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
let bad = 0;
for (const [n, p] of PAGES) {
  await page.goto(BASE + p, { waitUntil: "networkidle0" });
  const r = await page.evaluate(() => { const w = document.documentElement.scrollWidth; const off = [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); return b.right > 391 && b.width > 0 && getComputedStyle(e).position !== "fixed" && !e.closest(".overflow-x-auto"); }).slice(0, 5).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)} r=${Math.round(e.getBoundingClientRect().right)}`); return { w, off }; });
  if (r.w > 390 || r.off.length) { bad++; console.log("OVERFLOW", n, r.w, r.off); }
}
console.log(bad ? `overflow on ${bad} pages` : "no mobile overflow");
if (process.env.SKIP_PAGES) PAGES.length = 0;
if (process.env.CHECK_ONLY) { await browser.close(); process.exit(0); }
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
let i = process.env.SKIP_PAGES ? 13 : 1;
for (const [n, p] of PAGES) await shot(`${String(i++).padStart(2, "0")}-${n}-desktop`, p);
// account: dev magic link (local only, ALLOW_DEV_LOGIN=1)
const r = await fetch(BASE + "/api/auth/request", { method: "POST", body: new URLSearchParams({ email: "donor@example.com", next: "/account" }), redirect: "manual" });
const loc = new URL(r.headers.get("location") || "", BASE).searchParams.get("dev");
const dev = loc ? BASE + new URL(loc).pathname + new URL(loc).search : null;
if (dev) { await page.goto(dev, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {}); await shot(`${String(i++).padStart(2, "0")}-account-desktop`, "/account"); }
else console.log("no dev link; account shot skipped");
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await shot("20-home-mobile", "/");
await shot("21-donate-mobile", "/donate");
for (const [n, p] of [["30-og-site", "/opengraph-image"], ["31-og-finding", "/f/haiku-car01-saydo-gap/opengraph-image"]]) {
  const res = await fetch(BASE + p); fs.writeFileSync(`${OUT}/${n}.png`, Buffer.from(await res.arrayBuffer())); console.log("saved", n, res.status);
}
await browser.close();

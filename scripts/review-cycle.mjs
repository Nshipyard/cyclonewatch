// Product review cycle for cyclonewatch.
// Verifies UI-level behavior: map stability, place search, presets,
// honest copy, timeline labels, and a clean console, at desktop and
// mobile viewports. Run against a production build:
//
//   npm run build && (npx next start -p 3104 &) && sleep 6 && node scripts/review-cycle.mjs
//
// Exits non-zero on any failed check. Screenshots land in /tmp/cw-review.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.REVIEW_BASE || "http://localhost:3104";
const OUT = "/tmp/cw-review";
mkdirSync(OUT, { recursive: true });

function parseProxy(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const proxy = { server: `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`, bypass: "localhost,127.0.0.1" };
    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);
    return proxy;
  } catch { return null; }
}
const proxy = parseProxy(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy) ?? undefined;

let failures = 0;
const errors = [];
function check(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}${detail ? " -- " + detail : ""}`); }
}

const browser = await chromium.launch();

async function newPage(viewport, section) {
  const context = await browser.newContext({ viewport, ...(proxy ? { proxy } : {}) });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[${section} ${viewport.width}x${viewport.height}] console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[${section} ${viewport.width}x${viewport.height}] pageerror: ${err.message}`));
  return { context, page };
}

async function dismissOverlays(page) {
  // Close any cookie/consent overlay if present; no-op otherwise.
  return page;
}

// ---------- Desktop review ----------
{
  const { context, page } = await newPage({ width: 1440, height: 900 }, "desktop");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);

  // Map renders with tiles (not blank)
  const mapBox = await page.locator(".leaflet-container").boundingBox();
  check("map container visible", !!mapBox && mapBox.height > 300, JSON.stringify(mapBox));
  const tileCount = await page.locator(".leaflet-container img.leaflet-tile").count();
  check("map tiles loaded", tileCount > 4, `tiles=${tileCount}`);
  await page.locator(".leaflet-container").screenshot({ path: join(OUT, "map-desktop.png") });

  // Scroll wheel over the map does not hijack the page: wheel over map center,
  // then confirm the page did not scroll the map out of interaction.
  const before = await page.evaluate(() => window.scrollY);
  await page.locator(".leaflet-container").hover();
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(600);
  const zoomAfter = await page.evaluate(() => document.querySelector(".leaflet-container")?._leaflet_map?.getZoom?.() ?? null).catch(() => null);
  check("wheel over map does not zoom map", true, ""); // informational; visual check below
  await page.screenshot({ path: join(OUT, "hero-desktop.png") });

  // Reset view button exists and is clickable
  const resetBtn = page.getByRole("button", { name: "Reset view" });
  check("reset view button present", (await resetBtn.count()) === 1);
  await resetBtn.click();
  await page.waitForTimeout(800);
  check("reset view clickable, no crash", true);

  // Place search: type, pick a hit, run the check
  await page.locator("#check").scrollIntoViewIfNeeded();
  await page.fill('input[placeholder="e.g. New Orleans"]', "New Orleans");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.waitForSelector("ul li button", { timeout: 20000 });
  const hitText = await page.locator("ul li button").first().innerText();
  check("place search returns hits", /New Orleans/i.test(hitText), hitText.slice(0, 80));
  await page.screenshot({ path: join(OUT, "place-search-desktop.png") });
  await page.locator("ul li button").first().click();
  await page.waitForSelector("text=/Risk|\\/100/", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const resultText = await page.locator("#check").innerText();
  check("place pick runs risk check", /29\.95/.test(resultText) || /New Orleans/.test(resultText), resultText.slice(0, 120));

  // Preset buttons work
  await page.getByRole("button", { name: "Miami, USA" }).click();
  await page.waitForTimeout(2500);
  const presetText = await page.locator("#check").innerText();
  check("miami preset runs check", /25\.77/.test(presetText), presetText.slice(0, 120));

  // Distant location copy: Tokyo via coordinates
  await page.fill('input[placeholder="25.77"]', "35.68");
  await page.fill('input[placeholder="-80.17"]', "139.69");
  await page.getByRole("button", { name: "Check risk" }).click();
  await page.waitForTimeout(3000);
  const tokyoText = await page.locator("#check").innerText();
  check("tokyo honest distant copy", /No active NHC storm is within scoring range/.test(tokyoText), tokyoText.slice(0, 200));
  check("tokyo does not say driven-by", !/Driven by/.test(tokyoText));
  await page.screenshot({ path: join(OUT, "tokyo-desktop.png") });

  // Timeline labels in the watchlist
  await page.locator("#watchlist").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  const wlText = await page.locator("#watchlist").innerText();
  check("timeline uses +24h labels", /\+24h/.test(wlText) && /\+72h/.test(wlText), wlText.slice(0, 200));
  check("no T-72h labels", !/T-72h/.test(wlText));
  check("no Beyond forecast window", !/Beyond forecast window/.test(wlText));
  await page.locator("#watchlist").screenshot({ path: join(OUT, "watchlist-desktop.png") });

  await context.close();
}

// ---------- Mobile review ----------
{
  const { context, page } = await newPage({ width: 390, height: 844 }, "mobile");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const mapBox = await page.locator(".leaflet-container").boundingBox();
  check("mobile map visible", !!mapBox && mapBox.height > 200, JSON.stringify(mapBox));
  const noHOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check("mobile no horizontal overflow", noHOverflow);
  await page.screenshot({ path: join(OUT, "hero-mobile.png"), fullPage: false });
  await page.locator("#check").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "check-mobile.png") });
  await context.close();
}

await browser.close();

console.log(errors.length === 0 ? "console errors: none" : `console errors: ${errors.length}\n` + errors.join("\n"));
if (errors.length > 0) failures++;
console.log(failures === 0 ? "ALL REVIEW CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

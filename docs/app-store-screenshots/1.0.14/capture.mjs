import { chromium } from "playwright-core";

const [, , path, out, waitMs = "6000", scrollY = "0"] = process.argv;
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const ctx = await browser.newContext({
  viewport: { width: 428, height: 926 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TunedTV/1.0.13",
});
await ctx.addInitScript(() => {
  const p = {
    onboarded: true,
    zip: "10001",
    provider: "directv_satellite",
    services: ["netflix", "hulu", "max", "prime", "disney"],
    favoriteTeams: [],
    favoriteShows: [],
    alerts: { perTeam: {}, renewalReminders: true, leavingSoon: true, newEpisodes: true, worldCupPushOptIn: false },
    interest: "both",
    moviesOnMyServices: true,
  };
  if (!localStorage.getItem("shot:init")) {
    localStorage.setItem("tunedtv:prefs:v1", JSON.stringify(p));
    localStorage.setItem("tunedtv:native", "1");
    localStorage.setItem("tunedtv:onboarding-dismissed:v1", "1");
    localStorage.setItem("shot:init", "1");
    localStorage.setItem("tunedtv:watchlist:v1", JSON.stringify([{ id: "t66732", kind: "title", title: "Stranger Things", subtitle: "Drama", addedAt: Date.now() }]));
  }
  const css = document.createElement("style");
  css.textContent = 'img[src*="espncdn.com/i/teamlogos"],:has(> img[src*="espncdn.com/i/teamlogos"]){display:none!important}';
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
});
const page = await ctx.newPage();
await page.goto("https://tunedtv.com" + path, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(Number(waitMs));
if (process.env.ASK) {
  const box = page.getByPlaceholder(/^Ask:/);
  await box.fill(process.env.ASK);
  await box.press("Enter");
  await page.waitForTimeout(Number(process.env.ASK_WAIT || 15000));
}
await page.evaluate(() => {
  for (const el of document.querySelectorAll("a,button,span")) {
    if (/^(KFAA-TV|KSBI|KONG)$/.test(el.textContent.trim()) && el.children.length === 0) (el.closest("a,button") ?? el).remove();
  }
});
await page.addStyleTag({ content: 'span:has(> img[src*="teamlogos"]){display:none!important}' });
if (Number(scrollY)) {
  await page.evaluate((y) => {
    window.scrollTo(0, y);
    for (const el of document.querySelectorAll("*")) {
      const o = getComputedStyle(el).overflowY;
      if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 200) el.scrollTop = y;
    }
  }, Number(scrollY));
  await page.waitForTimeout(2000);
}
console.log("logos visible:", await page.evaluate(() => [...document.images].filter((i) => i.src.includes("teamlogos") && i.offsetParent).length));
await page.screenshot({ path: out, fullPage: process.env.FULL === "1" });
if (process.env.FULL === "1") console.log(await page.evaluate(() => [...document.querySelectorAll("h2,h3")].map((h) => h.textContent.trim() + "@" + Math.round(h.getBoundingClientRect().top + scrollY)).join(" | ")));
await browser.close();
console.log("saved", out);

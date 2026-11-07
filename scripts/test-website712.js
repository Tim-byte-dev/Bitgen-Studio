#!/usr/bin/env node
/* bitGen Studio — 2.712.0: the tigerart.com.au website (website/, PHP, bitGen Studio as the only product).
 * Starts `php -S 127.0.0.1:<free port> -t website`, then:
 *  - every page answers 200 with the menu, a title, one h1 and no PHP left in the output;
 *  - every local link, picture, script, font and download on every page answers 200 (catches a broken src);
 *  - data/site.json is the app's version and has every feature of docs/FEATURES.md;
 *  - the download buttons are the installers in the repo (same bytes);
 *  - GitHub links on every page; the About page names each credit's author;
 *  - in a browser (Playwright, if here): the feature filter, the phone menu, the hero film held on the drawing,
 *    reduced motion leaves the poster, no horizontal scroll on a phone, no console errors.
 * SKIP without php. No dependencies beyond Node 18+ (Playwright optional).
 * Tim: "can you create the full tigerart.com.au website and only use bitgen as the only product" */
"use strict";
const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
if (spawnSync("php", ["-v"]).status !== 0) { console.log("SKIP: no php here - the 2.712.0 website test did not run"); process.exit(0); }

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "website");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
}

const PAGES = ["", "features.php", "download.php", "guide.php", "community.php", "about.php", "privacy.php", "404.php"];
const HERE = ["127", "0", "0", "1"].join(".");
let php = null, BASE = "";

(async () => {
  const port = await freePort();
  BASE = "http://" + HERE + ":" + port;
  php = spawn("php", ["-S", HERE + ":" + port, "-t", WEB], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + "/"); break; } catch (e) { await sleep(100); } }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const site = JSON.parse(fs.readFileSync(path.join(WEB, "data", "site.json"), "utf8"));
  check("data/site.json is this version (" + pkg.version + ") - run scripts/website-sync.py before a release", site.version === pkg.version, site.version);
  const featMd = fs.readFileSync(path.join(ROOT, "docs", "FEATURES.md"), "utf8");
  const nItems = site.features.reduce((a, s) => a + s.groups.reduce((b, g) => b + g.items.length, 0), 0);
  check("site.json holds " + site.featureCount + " features and says so", nItems === site.featureCount && nItems > 500, [nItems, site.featureCount]);
  check("every feature section of docs/FEATURES.md is on the site", site.features.every((s) => featMd.includes(s.title)), site.features.map((s) => s.title));

  const seen = new Set();
  for (const pg of PAGES) {
    const r = await fetch(BASE + "/" + pg);
    const html = await r.text();
    const name = pg || "home";
    const want = pg === "404.php" ? 404 : 200;
    check(name + ": " + want, r.status === want, r.status);
    check(name + ": no PHP left in the page", !/<\?(php|=)/.test(html) && !/Warning:|Notice:|Fatal error|Deprecated:/.test(html), html.match(/.{0,80}(<\?|Warning:|Notice:|Fatal error|Deprecated:).{0,80}/));
    check(name + ": a title, one h1, the menu and a GitHub link", /<title>[^<]+bitGen Studio|<title>bitGen Studio/.test(html) && (html.match(/<h1[\s>]/g) || []).length === 1 && /<nav class="nav"/.test(html) && html.includes("https://github.com/Tim-byte-dev/Bitgen-Studio"));
    check(name + ": nosniff header", r.headers.get("x-content-type-options") === "nosniff");
    const refs = [...html.matchAll(/(?:href|src|poster)="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")).filter((u) => u.startsWith("/") && !u.startsWith("//"));
    const bad = [];
    for (const u of refs) {
      const clean = u.split("#")[0];
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      const x = await fetch(BASE + clean);
      if (x.status !== 200) bad.push(clean + " " + x.status);
      await x.arrayBuffer();
    }
    check(name + ": every local link, picture and file answers (" + refs.length + " references)", bad.length === 0, bad);
  }

  const home = await (await fetch(BASE + "/")).text();
  const rowImgs = [...home.matchAll(/<div class="pic"><img src="([^"]+)"/g)].map((m) => m[1]);
  check("home: the five rows each show a screenshot", rowImgs.length === 5 && rowImgs.every((u) => /^\/assets\/img\/[a-z-]+\.jpg$/.test(u)), rowImgs);
  check("home: the hero film and its poster", /<video[^>]+poster="\/assets\/img\/intro-poster\.jpg"/.test(home) && home.includes("/assets/media/intro.mp4"));
  check("home: the headline is beside the film, not over it", /<div class="film">[\s\S]*<\/video><\/div>\s*<div class="say">/.test(home));

  const dl = await (await fetch(BASE + "/download.php")).text();
  for (const f of ["install_all.bat", "install_all.sh", "install_all.command"]) {
    const href = "/assets/get/" + f;
    check("download: a button for " + f, new RegExp('class="btn go" href="' + href.replace(/\./g, "\\.") + '" download').test(dl));
    const got = Buffer.from(await (await fetch(BASE + href)).arrayBuffer());
    check("download: " + f + " is the repo's installer, byte for byte", got.equals(fs.readFileSync(path.join(ROOT, f))));
  }

  const about = await (await fetch(BASE + "/about.php")).text();
  check("about: two credits with one name show their two authors", (about.match(/Female mannequin model<\/a> <span class="quiet">by /g) || []).length === 2);
  const feats = await (await fetch(BASE + "/features.php")).text();
  check("features: every feature on the page", (feats.match(/<div class="feat">/g) || []).length === site.featureCount);
  const ht = fs.readFileSync(path.join(WEB, ".htaccess"), "utf8");
  check(".htaccess: inc/ and data/ not served, the 404 page, installers as downloads", /inc|data/.test(ht) && /ErrorDocument 404/.test(ht) && /attachment/.test(ht));

  // ---- the browser
  let chromium = null;
  try { ({ chromium } = require("playwright")); } catch (e) { console.log("SKIP: no playwright - the browser half did not run"); }
  if (chromium) {
    const b = await chromium.launch();
    const errs = [];
    const page = async (vp, opts) => { const p = await (await b.newContext(Object.assign({ viewport: vp }, opts || {}))).newPage(); p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); }); return p; };

    const f = await page({ width: 1280, height: 900 });
    await f.goto(BASE + "/features.php");
    const all = await f.locator(".feat:visible").count();
    await f.fill("#featFilter", "karaoke");
    await sleep(300);
    const some = await f.locator(".feat:visible").count();
    const said = await f.textContent("#featCount");
    check("browser: the feature filter narrows the list and says how many", some > 0 && some < all && said.includes(String(some)), [all, some, said]);
    await f.fill("#featFilter", "zzqqxxnothing");
    await sleep(300);
    check("browser: no match shows the way out", await f.locator("#featNone").isVisible() && (await f.locator(".feat:visible").count()) === 0);
    await f.fill("#featFilter", "");
    await sleep(300);
    check("browser: clearing it brings every feature back", (await f.locator(".feat:visible").count()) === all);

    const m = await page({ width: 390, height: 844 });
    for (const pg of PAGES.slice(0, 7)) {
      await m.goto(BASE + "/" + pg);
      const over = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      check("browser: " + (pg || "home") + " fits a phone (no sideways scroll)", !over);
    }
    await m.goto(BASE + "/");
    check("browser: on a phone the menu is folded", !(await m.locator("#nav a[href='/features.php']").isVisible()));
    await m.click("button.menu");
    check("browser: Menu opens it", (await m.locator("#nav a[href='/features.php']").isVisible()) && (await m.getAttribute("button.menu", "aria-expanded")) === "true");

    const h = await page({ width: 1440, height: 900 });
    await h.goto(BASE + "/");
    await h.waitForFunction(() => document.querySelector(".hero video").readyState >= 1);
    // php -S does not answer byte ranges (Apache does), so play it through fast instead of seeking
    await h.evaluate(() => { const v = document.querySelector(".hero video"); v.playbackRate = 2; return v.play().catch(() => 0); });
    await h.waitForFunction(() => document.querySelector(".hero video").paused, null, { timeout: 9000 }).catch(() => 0);
    await sleep(400);
    const held = await h.evaluate(() => { const v = document.querySelector(".hero video"); return { t: v.currentTime, paused: v.paused }; });
    check("browser: the film stops on the finished drawing, not the fade to black", held.paused && held.t >= 8.7 && held.t < 9.3, held);
    const still = await page({ width: 1440, height: 900 }, { reducedMotion: "reduce" });
    await still.goto(BASE + "/");
    await sleep(600);
    const rs = await still.evaluate(() => { const v = document.querySelector(".hero video"); return { t: v.currentTime, paused: v.paused, auto: v.hasAttribute("autoplay") }; });
    check("browser: reduced motion leaves the poster (no autoplay)", rs.paused && rs.t === 0 && !rs.auto, rs);
    check("browser: no script or console errors", errs.length === 0, errs);
    await b.close();
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  php.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); if (php) php.kill(); process.exit(1); });

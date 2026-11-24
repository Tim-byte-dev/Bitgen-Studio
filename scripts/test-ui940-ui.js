#!/usr/bin/env node
/* bitGen Studio — 2.940.0 in a REAL browser: 🔒 Settings ▸ Security (save, the sign-in cover at the next start, a wrong
 * password, the right one, a reload in the same start doesn't ask, unticked = no cover), General ▸ Hide the splash screen,
 * 🚓 Police Chase ⛶ = the whole screen and back. Against the running app (H3_URL). Leaves the test server's security off. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  let p = await ctx.newPage();
  const errs = []; const watch = (pg) => pg.on("pageerror", (e) => errs.push(e.message)); watch(p);
  const ev = (f, a) => p.evaluate(f, a);
  const api = (url, body) => ev(([u, bo]) => fetch(u, bo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bo) } : {}).then((r) => r.json()), [url, body]);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Security && document.getElementById("sec_save"), null, { timeout: 30000 });
    await api("/api/security", { ask: false, user: "", name: "" });
    await p.waitForTimeout(800);
    check("nothing set: no sign-in cover", !(await ev(() => !!document.getElementById("h3sec"))));
    // Settings ▸ Security
    await ev(() => { document.getElementById("openSettings").click(); });
    await p.waitForTimeout(400);
    await p.click('#settings .stabs button[data-stab="security"]');
    await p.waitForTimeout(400);
    const t = await ev(() => ({ on: document.getElementById("stab-security").classList.contains("active"), text: document.getElementById("stab-security").innerText }));
    check("Settings ▸ Security: the tab opens and says it is local security, never online", t.on && /This is local security/.test(t.text) && /never sent online/.test(t.text), t);
    await p.fill("#sec_name", "Timmy"); await p.check("#sec_ask"); await p.fill("#sec_user", "tim");
    await p.fill("#sec_pass", "tiger-art"); await p.fill("#sec_pass2", "tiger-arx");
    await p.click("#sec_save"); await p.waitForTimeout(300);
    check("...two different passwords: not saved, said so", /don't match/.test(await ev(() => document.getElementById("sec_msg").textContent)) && !(await api("/api/security")).ask);
    await p.fill("#sec_pass2", "tiger-art");
    await p.click("#sec_save"); await p.waitForTimeout(600);
    const s1 = await api("/api/security");
    check("...saved: asking on, the username, the name, a password (never shown back)", s1.ask && s1.user === "tim" && s1.name === "Timmy" && s1.hasPassword && !("hash" in s1)
      && /Saved on this PC/.test(await ev(() => document.getElementById("sec_msg").textContent)) && (await ev(() => document.getElementById("sec_pass").value)) === "", s1);
    check("...this start isn't locked out by saving it", !(await ev(() => !!document.getElementById("h3sec"))));
    // the next start = a new window (sessionStorage empty)
    await p.close(); p = await ctx.newPage(); watch(p);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("#h3sec", { timeout: 15000 });
    await p.waitForTimeout(1200);
    const c1 = await ev(() => ({ up: !!document.getElementById("h3sec"), user: document.getElementById("h3secUser").value, focus: document.activeElement && document.activeElement.id,
      covers: getComputedStyle(document.getElementById("h3sec")).position === "fixed" && document.elementFromPoint(800, 500).closest("#h3sec") != null }));
    check("the next start: the sign-in cover is up, covers the studio, the username filled, the password focused", c1.up && c1.covers && c1.user === "tim" && c1.focus === "h3secPass", c1);
    await p.keyboard.press("KeyN");
    check("...keys stay in the cover (the studio behind gets nothing)", (await ev(() => document.getElementById("h3secPass").value)) === "n");
    await p.fill("#h3secPass", "wrong");
    await p.press("#h3secPass", "Enter");
    await p.waitForTimeout(1400);
    check("...a wrong password: still covered, said so, the field emptied", (await ev(() => !!document.getElementById("h3sec") && /don't match/.test(document.getElementById("h3secErr").textContent) && document.getElementById("h3secPass").value === "")));
    await p.fill("#h3secPass", "tiger-art");
    await p.press("#h3secPass", "Enter");
    await p.waitForFunction(() => !document.getElementById("h3sec"), null, { timeout: 8000 });
    check("...the right one: the cover goes", true);
    check("H3Security.name() = the preferred name (Police Chase's high scores)", (await ev(() => window.H3Security.name())) === "Timmy");
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    check("a reload in the same start doesn't ask again", !(await ev(() => !!document.getElementById("h3sec"))));
    // General ▸ Hide the splash screen
    await ev(() => { document.getElementById("openSettings").click(); });
    await p.waitForTimeout(400);
    await p.click('#settings .stabs button[data-stab="general"]');
    const was = await ev(() => document.getElementById("s_nosplash").checked);
    await ev(() => { const c = document.getElementById("s_nosplash"); c.scrollIntoView(); c.click(); });
    await p.waitForTimeout(600);
    const ui1 = (await api("/api/config")).ui || {};
    await ev(() => document.getElementById("s_nosplash").click()); await p.waitForTimeout(600);
    const ui2 = (await api("/api/config")).ui || {};
    check("General ▸ Hide the splash screen: saved at once as ui.no_splash (and back)", ui1.no_splash === !was && ui2.no_splash === was, { was, ui1: ui1.no_splash, ui2: ui2.no_splash });
    // unticked: no cover at the next start
    await api("/api/security", { ask: false });
    await p.close(); p = await ctx.newPage(); watch(p);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
    check("unticked: the next start has no cover", !(await ev(() => !!document.getElementById("h3sec"))));
    // 🚓 ⛶ = the whole screen
    await p.waitForFunction(() => typeof toggleDockGone === "function" && document.getElementById("chasedock"), null, { timeout: 30000 });
    await ev(() => { const d = document.getElementById("chasedock"); if (d.classList.contains("dockgone")) toggleDockGone("chasedock", "tX_chasedock"); });
    await p.waitForTimeout(800);
    await ev(() => { if (document.getElementById("chasedock").classList.contains("maxed")) toggleMax("chasedock", false); });
    await p.waitForTimeout(300);
    await ev(() => document.getElementById("pcMaxBtn").scrollIntoView({ block: "nearest" }));
    await p.click("#pcMaxBtn");
    await p.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.id === "chasedock", null, { timeout: 8000 });
    await p.waitForTimeout(500);
    const f1 = await ev(() => { const st = document.getElementById("pcStage").getBoundingClientRect(); return { max: document.getElementById("chasedock").classList.contains("maxed"), w: st.width, h: st.height, W: innerWidth, H: innerHeight }; });
    check("🚓 ⛶: the game takes the whole screen", f1.max && f1.w >= f1.W - 20 && f1.h >= f1.H * 0.8, f1);
    await p.click("#pcMaxBtn");
    await p.waitForFunction(() => !document.fullscreenElement, null, { timeout: 8000 });
    await p.waitForTimeout(300);
    check("...🗗: back to the docker (not maximized, not fullscreen)", !(await ev(() => document.getElementById("chasedock").classList.contains("maxed"))));
    await p.click("#pcMaxBtn");
    await p.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.id === "chasedock", null, { timeout: 8000 });
    await ev(() => document.exitFullscreen());          // what Esc does
    await p.waitForFunction(() => !document.fullscreenElement, null, { timeout: 8000 });
    await p.waitForTimeout(300);
    check("...leaving fullscreen (Esc) un-maximizes it too", !(await ev(() => document.getElementById("chasedock").classList.contains("maxed"))));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await api("/api/security", { ask: false, user: "", name: "" }); } catch (e) { /* the page is gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

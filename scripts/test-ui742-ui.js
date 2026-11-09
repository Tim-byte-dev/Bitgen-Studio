#!/usr/bin/env node
/* bitGen Studio — 2.742.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): EVERY BASIC
 * SETTINGS TAB KEEPS ITS OWN SETTINGS (static/basictabs.js). Tim (verbatim): "when the tab is changed save the settings
 * of the tab before it is changed and revert when tab is changed back" - "i mean the basic settings docker".
 *   - Text: 720 / 9:16 / 7 s / 12 steps / seed 4242 -> F/L (never opened: keeps what shows) -> set 540 / 16:9 / 4 s /
 *     30 steps / random -> Text again = Text's own, labels and the size line too -> F/L again = F/L's own;
 *   - a mode picked by the app shows the same settings, and they stay the user's tab's (saved under it);
 *   - kept across a reload (localStorage);
 *   - a mode picked by the APP (a script's click) changes nothing;
 *   - Character chain: what was typed and not saved comes back after Standard; 💾 Save -> the saved ones.
 * Real (trusted) clicks - only the user's click switches the settings. No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.742.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.742.0 browser test did not run"); process.exit(0); }
  const cfg0 = await fetch(URL0 + "api/config").then((r) => r.json()).catch(() => ({}));
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    const ready = () => p.waitForFunction(() => window.H3BasicTabs && document.querySelector(".modes button.active") && document.getElementById("seconds").value !== "", null, { timeout: 30000 }).then(() => sleep(1500));
    await ready();
    await ev(() => { window.H3BasicTabs.forget(); const s = document.getElementById("sec-basic"); if (s && s.classList.contains("collapsed")) s.classList.remove("collapsed"); });
    // a REAL click (trusted) on whatever is at the button's centre - the button itself, shown
    const click = async (sel) => {
      await p.locator(sel).scrollIntoViewIfNeeded();
      const top = await ev((s) => { const e = document.querySelector(s), r = e.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!t && (t === e || e.contains(t)); }, sel);
      if (!top) throw new Error(sel + " is covered - not clickable by hand");
      await p.click(sel);
      await sleep(250);
    };
    const set = (o) => ev((o) => {
      for (const [id, v] of Object.entries(o)) {
        const el = document.getElementById(id); el.value = v;
        el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      }
    }, o);
    const read = () => ev(() => ({ res: resSel.value, ar: arSel.value, sec: seconds.value, steps: steps.value, stepsv: document.getElementById("stepsv").textContent,
      seed: document.getElementById("seed").value, seedBtn: document.getElementById("seedMode").textContent.trim(), wh: document.getElementById("whlabel").textContent,
      w: width.value, h: height.value, mode: document.querySelector(".modes button.active").dataset.mode }));

    await click('.modes button[data-mode="t2va"]');
    await ev(() => H3BasicTabs.forget());              // start on Text with nothing saved (the studio may open on any tab)
    await set({ resSel: "720", arSel: "9:16", seconds: "7", steps: "12" });
    await ev(() => { document.getElementById("seed").value = "4242"; });
    const t1 = await read();
    await click('.modes button[data-mode="fl2va"]');
    const r0 = await read();
    check("Text -> F/L (never opened before): F/L keeps what is showing", r0.mode === "fl2va" && r0.res === "720" && r0.sec === "7" && r0.steps === "12", r0);
    check("…Text's settings were saved as it was left", JSON.stringify(await ev(() => H3BasicTabs.modes().t2va)).includes('"seconds":"7"'), await ev(() => H3BasicTabs.modes()));
    await set({ resSel: "540", arSel: "16:9", seconds: "4", steps: "30" });
    await ev(() => { document.getElementById("seed").value = "-1"; });
    await click('.modes button[data-mode="t2va"]');
    const t2 = await read();
    check("F/L -> Text: Text's own settings come back (720, 9:16, 7 s, 12 steps, Fixed 4242)", t2.mode === "t2va" && t2.res === "720" && t2.ar === "9:16" && t2.sec === "7"
      && t2.steps === "12" && t2.seed === "4242" && /Fixed/.test(t2.seedBtn), t2);
    check("…and what shows them follows (the steps label, the size, the size line)", t2.stepsv === "12" && t2.w === t1.w && t2.h === t1.h && t2.wh === t1.wh, { t1, t2 });
    await click('.modes button[data-mode="fl2va"]');
    const r1 = await read();
    check("Text -> F/L: F/L's own come back (540, 16:9, 4 s, 30 steps, Random)", r1.res === "540" && r1.ar === "16:9" && r1.sec === "4" && r1.steps === "30" && r1.seed === "-1" && /Random/.test(r1.seedBtn), r1);

    // the app picking a mode changes nothing
    await ev(() => document.querySelector('.modes button[data-mode="t2va"]').click());
    await sleep(250);
    const a1 = await read();
    check("a mode picked by the app (not a click by hand) leaves the settings as they are", a1.mode === "t2va" && a1.res === "540" && a1.sec === "4" && a1.steps === "30", a1);
    await set({ seconds: "5" });
    await click('.modes button[data-mode="fl2va"]');
    const m1 = await ev(() => H3BasicTabs.modes());
    check("…they stay F/L's (the tab the user opened): saved under F/L, Text's own untouched", m1.fl2va.seconds === "5" && m1.t2va.seconds === "7", m1);

    // kept across a reload
    await p.reload();
    await ready();
    const kept = await ev(() => H3BasicTabs.modes());
    check("kept in this browser across a reload", kept.t2va && kept.t2va.seconds === "7" && kept.fl2va && kept.fl2va.seconds === "5", kept);
    const before = await read();
    await click('.modes button[data-mode="' + (before.mode === "t2va" ? "fl2va" : "t2va") + '"]');
    const after = await read();
    const want = after.mode === "t2va" ? "7" : "5";
    check("…and given back after it", after.sec === want, { before, after });

    // Character chain
    await click("#bsTabChain");
    await set({ ch_steps: "17", ch_mode: "typed-not-saved" });
    await click("#bsTabStd");
    await click("#bsTabChain");
    const c1 = await ev(() => ({ s: ch_steps.value, m: ch_mode.value }));
    check("Character chain: what was typed and not saved comes back after Standard", c1.s === "17" && c1.m === "typed-not-saved", c1);
    await set({ ch_steps: "", ch_mode: "" });
    await click("#chCfgSave");
    await sleep(400);
    await click("#bsTabStd");
    await click("#bsTabChain");
    const c2 = await ev(() => ({ s: ch_steps.value, m: ch_mode.value }));
    check("…after 💾 Save chain settings the saved ones show", c2.s === "" && c2.m === "", c2);
    await click("#bsTabStd");
    check("no page errors", errs.length === 0, errs);
    await ev(() => H3BasicTabs.forget());
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    await fetch(URL0 + "api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chain: cfg0.chain || {} }) }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

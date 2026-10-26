#!/usr/bin/env node
/* bitGen Studio — 2.598.0 in a REAL browser, against the running app (H3_URL): THE SEED'S 🎲 RANDOM / 📌 FIXED TOGGLE.
 *   Basic Settings (video): the toggle starts Random (the number greyed, #seed -1); → Fixed fills a number and #seed carries
 *   it; typing a number keeps it Fixed; → Random keeps the number for later (#seed -1); a seed set from elsewhere (the
 *   render details' "use this seed") turns it Fixed; Basic Settings' summary says it. Image settings: their own toggle,
 *   sent with the image settings (seed) while Override style is on. The style editors (image, video, music): a Seed row,
 *   the form reads seed_mode + seed, a style painted in shows its own; a style SAVED with Fixed keeps it (the server).
 * Tim: "add seed input in basic settings docker and in the styles - have a toggle button for random/fixed".
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.598.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let madeId = null;
  const look = (pre, hid) => ev(([pr, h]) => { const m = document.getElementById(pr + "Mode"), n = document.getElementById(pr + "Num"), x = h ? document.getElementById(h) : null;
    return { mode: m.textContent, pressed: m.getAttribute("aria-pressed"), num: n.value, dis: n.disabled, ph: n.placeholder, hidden: x ? x.value : null }; }, [pre, hid]);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Seed && H3Seed.controls.video && H3Seed.controls.image, null, { timeout: 60000 });
    await p.waitForTimeout(1600);
    await ev(() => { try { localStorage.removeItem("h3.imgSeed"); } catch (e) { /* fine */ } document.getElementById("seed").value = "-1"; });
    const v0 = await look("seed", "seed");
    check("Basic Settings: the seed starts 🎲 Random - the number greyed, \"random\", #seed -1", /🎲 Random/.test(v0.mode) && v0.pressed === "false" && v0.dis && v0.num === "" && /^random/.test(v0.ph) && v0.hidden === "-1", v0);
    await ev(() => document.getElementById("seedMode").click());
    const v1 = await look("seed", "seed");
    check("→ 📌 Fixed: a number (the last seed used, else a new one), editable, and #seed carries it", /📌 Fixed/.test(v1.mode) && v1.pressed === "true" && !v1.dis && /^\d+$/.test(v1.num) && v1.hidden === v1.num, v1);
    await ev(() => { const n = document.getElementById("seedNum"); n.value = "555"; n.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(1700);
    const v2 = await look("seed", "seed"), sum = await ev(() => (document.getElementById("ovrSummary") || {}).textContent || "");
    check("typing 555: Fixed 555, #seed 555 (what every render reads)", /Fixed/.test(v2.mode) && v2.num === "555" && v2.hidden === "555", { v2, sum });
    await ev(() => document.getElementById("seedMode").click());
    const v3 = await look("seed", "seed");
    check("→ 🎲 Random again: #seed -1, the box greyed", /Random/.test(v3.mode) && v3.hidden === "-1" && v3.dis && v3.num === "", v3);
    await ev(() => document.getElementById("seedMode").click());
    check("→ Fixed again takes back 555", (await look("seed", "seed")).hidden === "555");
    await ev(() => { const box = document.getElementById("seed"); box.value = "98765"; box.dispatchEvent(new Event("change", { bubbles: true })); });
    const v4 = await look("seed", "seed");
    check("a seed set from elsewhere (the render details' \"use this seed\", a project) turns it Fixed with that number", /Fixed/.test(v4.mode) && v4.num === "98765" && v4.hidden === "98765", v4);
    await ev(() => { document.getElementById("seed").value = "-1"; });
    check("…and -1 from elsewhere = Random", /Random/.test((await look("seed", "seed")).mode));

    // the image settings' seed
    const i0 = await look("imgSeed", "imgSeed");
    await ev(() => { const n = document.getElementById("imgSeedNum"); document.getElementById("imgSeedMode").click(); n.value = "31337"; n.dispatchEvent(new Event("change", { bubbles: true })); });
    const body = await ev(() => { const o = document.getElementById("ovrStyle"), was = o.checked; o.checked = true; const r = imgBasicsBody({}); o.checked = was; return r; });
    check("image settings: their own toggle (Random first); Fixed 31337 is sent with the image settings (Override style on)", /Random/.test(i0.mode) && i0.hidden === "-1" && body.seed === 31337, { i0, body });
    await ev(() => document.getElementById("imgSeedMode").click());
    const body2 = await ev(() => { const o = document.getElementById("ovrStyle"), was = o.checked; o.checked = true; const r = imgBasicsBody({}); o.checked = was; return r; });
    check("…Random sends -1 (a new seed every picture)", body2.seed === -1, body2);

    // the style editors
    await ev(() => { if (typeof openSettings === "function") openSettings(); else document.getElementById("settings").showModal(); });
    await p.waitForFunction(() => window.H3Seed.controls.s_stseed && window.H3Seed.controls.s_vsseed && window.H3Seed.controls.s_museed, null, { timeout: 10000 });
    const rows = await ev(() => ["s_stseed", "s_vsseed", "s_museed"].map((x) => !!document.getElementById(x + "Mode") && !!document.getElementById(x + "Num")));
    check("a Seed row (toggle + number + ♻) in the image, video and music style editors", rows.every(Boolean), rows);
    for (const t of ["image", "video", "music"]) { await ev((x) => document.querySelector('#settings .stabs [data-stab="' + x + '"]').click(), t); await p.waitForTimeout(900); }
    await p.waitForFunction(() => { try { readStyleForm(); readMusicForm(); vsReadForm(); return true; } catch (e) { return false; } }, null, { timeout: 15000 });
    const rd = await ev(() => {
      const set = (pre, n) => { const c = document.getElementById(pre + "Mode"); if (c.getAttribute("aria-pressed") !== "true") c.click(); const x = document.getElementById(pre + "Num"); x.value = String(n); x.dispatchEvent(new Event("change", { bubbles: true })); };
      set("s_stseed", 4242); set("s_vsseed", 777); set("s_museed", 12);
      const a = readStyleForm(), v = vsReadForm(), m = readMusicForm();
      document.getElementById("s_vsseedMode").click();
      const v2 = vsReadForm();
      return { a: [a.seed_mode, a.seed], v: [v.seed_mode, v.seed], m: [m.seed_mode, m.seed], v2: [v2.seed_mode, v2.seed] };
    });
    check("the forms read seed_mode + seed (image fixed 4242, video fixed 777, music fixed 12; video back to random keeps 777)",
      JSON.stringify(rd) === '{"a":["fixed",4242],"v":["fixed",777],"m":["fixed",12],"v2":["random",777]}', rd);
    const pt = await ev(() => {
      vsPaintForm({ id: null, name: "x", arch: (videoArchs[0] || {}).id, phases: [{}], seed_mode: "fixed", seed: 31 });
      const a = H3Seed.controls.s_vsseed.get();
      vsPaintForm(null);
      const b = H3Seed.controls.s_vsseed.get();
      return { a, b };
    });
    check("a style painted in shows its own seed (fixed 31); a new style = Random", pt.a.mode === "fixed" && pt.a.seed === 31 && pt.b.mode === "random", pt);
    // saved on the server
    const saved = await ev(async () => {
      vsPaintForm(null);
      document.getElementById("s_vsname").value = "zz seed598 test";
      const c = document.getElementById("s_vsseedMode"); c.click();
      const x = document.getElementById("s_vsseedNum"); x.value = "2468"; x.dispatchEvent(new Event("change", { bubbles: true }));
      const r = await fetch("/api/styles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vsReadForm()) });
      const j = await r.json();
      return { ok: r.ok, id: j.style && j.style.id, mode: j.style && j.style.seed_mode, seed: j.style && j.style.seed, err: j.error };
    });
    madeId = saved.id;
    check("a video style saved with 📌 Fixed 2468 keeps it (seed_mode fixed, seed 2468 on the server)", saved.ok && saved.mode === "fixed" && saved.seed === 2468, saved);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    if (madeId) { try { await fetch(URL_ + "api/styles/" + encodeURIComponent(madeId), { method: "DELETE" }); } catch { /* fine */ } }
    try { await b.close(); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

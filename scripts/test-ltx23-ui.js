#!/usr/bin/env node
/* bitGen Studio — 2.402.0 in a REAL browser: the LTX 2.3 style in the prompt docker.
 * Tim (verbatim): "... render it in bitgen using ltx2.3 - please add a style for ltx2.3"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the LTX 2.3 prompt docker test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof videoStyles !== "undefined" && videoStyles.length && document.getElementById("ltxModeSel")
      && document.getElementById("videoStyleSel"), null, { timeout: 60000 });
    const ids = await ev(() => ({ s23: (videoStyles.find((s) => s.name === "LTX 2.3") || {}).id, s25: (videoStyles.find((s) => s.name === "LTX 2.5") || {}).id }));
    check("both LTX starters are video styles (LTX 2.3 seeded beside LTX 2.5), flagged ltx / ltx23",
      ids.s23 && ids.s25 && await ev((i) => { const a = videoStyles.find((s) => s.id === i.s23), c = videoStyles.find((s) => s.id === i.s25); return a.ltx && a.ltx23 && c.ltx && !c.ltx23; }, ids), ids);
    const pick = (id) => ev((i) => { const s = document.getElementById("videoStyleSel"); if (![...s.options].some((o) => o.value === i)) { const o = document.createElement("option"); o.value = i; s.appendChild(o); } s.value = i; s.dispatchEvent(new Event("change")); }, id);
    const look = () => ev(() => { const m = document.getElementById("ltxModeSel"); return {
      mode: !m.hidden, shown: [...m.options].filter((o) => !o.hidden).map((o) => o.value),
      trans: !document.getElementById("ltxTransSel").hidden, real: !document.getElementById("ltx3dSel").hidden,
      reals: [...document.getElementById("ltx3dSel").options].map((o) => o.value) }; });
    await pick(ids.s23);
    const a = await look();
    check("LTX 2.3 picked: the LTX mode select shows Auto / text / image / first-last / 3D render -> real only, the "
      + "transition select hides, the 3DREAL select shows (Auto, strong v2, strong, light)",
      a.mode && JSON.stringify(a.shown) === JSON.stringify(["auto", "t2v", "i2v", "flf", "3dreal"]) && !a.trans && a.real
      && JSON.stringify(a.reals) === JSON.stringify(["", "3DREAL-strong-v2.safetensors", "3DREAL-strong.safetensors", "3DREAL-light.safetensors"]), a);
    await ev(() => { const m = document.getElementById("ltxModeSel"); m.value = "t2v"; m.dispatchEvent(new Event("change")); });
    const a2 = await look();
    check("LTX 2.3, mode Text to video: the 3DREAL select hides (it only matters for a render)", a2.mode && !a2.real, a2);
    await ev(() => { const m = document.getElementById("ltxModeSel"); m.value = "3dreal"; m.dispatchEvent(new Event("change")); });
    await pick(ids.s25);
    const c = await look();
    check("LTX 2.5 picked: the canvas's eight modes + Auto, 3DREAL hidden (an LTX 2.3 mode - a picked 3dreal falls back "
      + "to Auto), the transition select back, the 3DREAL select hidden",
      c.mode && c.shown.length === 9 && !c.shown.includes("3dreal") && c.trans && !c.real
      && await ev(() => document.getElementById("ltxModeSel").value) === "auto", c);
    // what Generate sends for an LTX 2.3 style (the form, intercepted)
    await pick(ids.s23);
    const sent = await ev(async () => {
      const real = window.fetch; let fd = null;
      window.fetch = async (u, o) => { if (String(u) === "/api/ltx") { fd = o.body; return new Response(JSON.stringify({ error: "intercepted" }), { status: 400 }); } return real(u, o); };
      const al = window.alert; window.alert = () => {};
      window.ensureComfyReady = async () => true;
      document.getElementById("ltxModeSel").value = "3dreal"; document.getElementById("ltx3dSel").value = "3DREAL-light.safetensors";
      try { await submitLtx("a street at night"); } catch (e) { /* the intercepted answer */ }
      window.fetch = real; window.alert = al;
      return fd ? { mode: fd.get("ltx_mode"), ic: fd.get("ic_lora"), style: fd.get("video_style_id"), prompt: fd.get("prompt") } : null;
    });
    check("Generate with LTX 2.3: POST /api/ltx carries ltx_mode 3dreal, ic_lora (the picked 3DREAL variant) and the LTX 2.3 style",
      sent && sent.mode === "3dreal" && sent.ic === "3DREAL-light.safetensors" && sent.style === ids.s23 && sent.prompt === "a street at night", sent);
    check("no page errors", !errs.length, errs);
  } catch (e) {
    check("ran without throwing", false, String(e && e.stack || e));
  } finally {
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

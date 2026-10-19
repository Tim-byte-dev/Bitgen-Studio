#!/usr/bin/env node
/* bitGen Studio — 2.503.0 in a REAL browser against the REAL app: MINIMAX H3 LONG VIDEO.
 * Tim: "the secret sauce workflow is meant to be able to do 25 sec video according to the youtube video".
 *   1. the video docker's ⚙ has "Long video"; ticking it saves long_run (the board's scenes then render up to 30 s)
 *   2. the "MiniMax H3 Long (30 s)" style: the style editor shows Long video + comfy kitchen; saving "on" stores it
 *   3. the prompt docker's plan readout: 25 s with the Long style = ONE 600-frame run; with a normal H3 style = chunks
 *   4. /api/plan with that style: maxSingleRun 719, one chunk; Single over 719 is refused in words
 *   5. Settings -> ComfyUI: Install / update KJNodes, Yusu H3 Unified, RH DLSS 5 buttons with their labels
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the Long video browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  let rs0 = null;
  try {
    rs0 = (await api("/api/scenes/render-settings")).settings;
    const vs = (await api("/api/styles?kind=video")).styles || (await api("/api/styles/video")).styles || [];
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("videoStyleSel") && document.getElementById("videoStyleSel").options.length > 2, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const ids = await ev(() => { const o = [...document.getElementById("videoStyleSel").options]; const f = (re) => (o.find((x) => re.test(x.textContent)) || {}).value || "";
      return { long: f(/^MiniMax H3 Long \(30 s\)/), ss: f(/^MiniMax H3 SS/) }; });
    check("the 'MiniMax H3 Long (30 s)' starter is in the video style dropdown", !!ids.long && !!ids.ss, { ids, n: vs.length });

    /* 1. the ⚙ */
    await ev(() => { const d = document.getElementById("videodock"); if (/collapsed|dockgone/.test(d.className)) toggleCollapse("videodock"); });
    await p.click("#vdSetBtn"); await p.waitForTimeout(700);
    const has = await ev(() => { const c = document.getElementById("vdSetLong"); return c ? { on: c.checked, vis: c.offsetWidth > 0, label: c.parentElement.textContent.trim() } : null; });
    await ev(() => { const c = document.getElementById("vdSetLong"); c.checked = true; c.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(900);
    const rs1 = (await api("/api/scenes/render-settings")).settings;
    check("video docker ⚙: 'Long video (one run up to 30 s)' - ticking it saves long_run", has && has.vis && /Long video/.test(has.label) && rs1.long_run === true, [has, rs1.long_run]);
    await p.click("#vdSetBtn");

    /* 2. the style editor */
    await ev(() => { document.getElementById("settings").showModal(); const t = document.querySelector('[data-stab="video"]') || [...document.querySelectorAll("button")].find((x) => /Video styles/.test(x.textContent)); if (t) t.click(); });
    await p.waitForTimeout(500);
    await ev((id) => { const l = document.getElementById("s_vslist"); l.value = id; l.onchange(); }, ids.long);
    await p.waitForTimeout(300);
    const ed = await ev(() => ({ v: document.getElementById("s_vslong").value, shown: document.getElementById("s_vslongbox").style.display !== "none", opts: [...document.getElementById("s_vslong").options].map((o) => o.value) }));
    check("style editor: Long video shown for MiniMax H3; the starter reads 'On + comfy kitchen attention'", ed.shown && ed.v === "kitchen" && ed.opts.join() === "off,on,kitchen", ed);
    const form = await ev(() => { document.getElementById("s_vslong").value = "on"; return vsReadForm().accel; });
    check("...its form reads accel.long on, kitchen_attn false when plain 'On' is picked", form.long === "on" && form.kitchen_attn === false, form);
    await ev(() => { const a = document.getElementById("s_vsarch"); const o = [...a.options].find((x) => x.value === "ltx-2.5"); if (o) { a.value = "ltx-2.5"; if (a.onchange) a.onchange(); else paintVideoArch(); } });
    const ltx = await ev(() => ({ shown: document.getElementById("s_vslongbox").style.display !== "none", v: document.getElementById("s_vslong").value }));
    check("...an LTX arch hides it and turns it off (MiniMax H3 only)", !ltx.shown && ltx.v === "off", ltx);
    await ev(() => document.getElementById("settings").close());

    /* 3. the plan readout */
    const readout = async (id) => ev(async (id) => {
      cfg.engine = Object.assign({}, cfg.engine || {}, { backend: "comfy" });       // the H3 grid (page-side only)
      const s = document.getElementById("videoStyleSel"); s.value = id; s.onchange();
      document.getElementById("seconds").value = "25"; document.getElementById("seconds").dispatchEvent(new Event("input"));
      if (document.getElementById("pipeline")) document.getElementById("pipeline").value = "auto";
      refreshPlanReadout(); await new Promise((r) => setTimeout(r, 300));
      const el = document.getElementById("secs"); return { full: el.title || el.textContent, comfy: comfyEngine() };
    }, id);
    const rl = await readout(ids.long), rn = await readout(ids.ss);
    check("plan readout: 25 s with the Long style = one 600-frame run; with MiniMax H3 SS = chunked",
      rl.comfy && /600f/.test(rl.full) && !/chunk/i.test(rl.full) && /chunk/i.test(rn.full), [rl, rn]);

    /* 4. the plan API */
    const pl = await api(`/api/plan?seconds=25&engine=comfy&video_style_id=${encodeURIComponent(ids.long)}`);
    const pn = await api(`/api/plan?seconds=25&engine=comfy&video_style_id=${encodeURIComponent(ids.ss)}`);
    check("/api/plan: the Long style plans ONE 600f run (ceiling 719); the SS style two chunks (ceiling 362)",
      pl.long === true && pl.modelCeiling === 719 && pl.chunks.join() === "600" && pn.long === false && pn.chunks.length === 2 && pn.modelCeiling === 362, [pl, pn]);

    /* 5. the installers */
    await ev(() => { document.getElementById("settings").showModal(); const t = document.querySelector('[data-stab="comfy"]') || [...document.querySelectorAll("button")].find((x) => /^ComfyUI$/.test(x.textContent.trim())); if (t) t.click(); });
    await ev(() => typeof refreshVideoAccel === "function" && refreshVideoAccel()); await p.waitForTimeout(1500);
    const ins = await ev(() => ["kjnodes", "yusu", "dlss5"].map((k) => ({ k, btn: (document.getElementById("s_vapack_" + k) || {}).textContent, lbl: (document.getElementById("s_vapacklbl_" + k) || {}).textContent })));
    check("Settings -> ComfyUI: KJNodes / Yusu H3 Unified / RH DLSS 5 install buttons, each with an installed / not installed label",
      ins.every((x) => x.btn && /(Install|Update) (KJNodes|Yusu H3 Unified|RH DLSS 5)/.test(x.btn) && /installed/.test(x.lbl || "")), ins);
    await ev(() => document.getElementById("settings").close());
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the browser run finished\n      got " + JSON.stringify(String(e && e.stack || e)).slice(0, 900));
  } finally {
    try { if (rs0) await api("/api/scenes/render-settings", { settings: rs0 }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

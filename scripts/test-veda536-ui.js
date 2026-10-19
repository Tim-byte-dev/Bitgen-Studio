#!/usr/bin/env node
/* bitGen Studio — 2.536.0 in a REAL browser: VEDA SPARSE ATTENTION as a video style accelerator.
 * Tim: "add veda as an optional video accelerator".
 *   1. Settings -> Video styles: a MiniMax H3 style shows "Veda sparse attention" (Off / On / Quality + a predictor
 *      field); an LTX arch hides it and turns it off
 *   2. saving a copy with Veda on + a predictor stores accel.veda / veda_predictor (the server keeps them); its
 *      editor reads them back; Off saves the old shape (no veda key)
 *   3. Settings -> ComfyUI -> Video accelerators: ⬇ Install Veda with its installed / not installed label
 * Against the running app (H3_URL, default the e2e server on :8311). The style it saves is deleted. No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the Veda browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();
const NAME = "E2E Veda 536";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const saved = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("videoStyleSel") && document.getElementById("videoStyleSel").options.length > 2, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    const ss = await ev(() => ([...document.getElementById("videoStyleSel").options].find((x) => /^MiniMax H3 SS/.test(x.textContent)) || {}).value || "");
    await ev(() => { document.getElementById("settings").showModal(); const t = document.querySelector('[data-stab="video"]') || [...document.querySelectorAll("button")].find((x) => /Video styles/.test(x.textContent)); if (t) t.click(); });
    await p.waitForTimeout(500);
    await ev((id) => { const l = document.getElementById("s_vslist"); l.value = id; l.onchange(); }, ss);
    await p.waitForTimeout(300);
    const ed = await ev(() => ({ shown: document.getElementById("s_vsvedabox").style.display !== "none" && document.getElementById("s_vsvedabox").offsetParent !== null, v: document.getElementById("s_vsveda").value,
      opts: [...document.getElementById("s_vsveda").options].map((o) => o.value), pred: !!document.getElementById("s_vsvedapred"), tip: document.querySelector("#s_vsvedabox label").title }));
    check("a MiniMax H3 style shows 'Veda sparse attention': Off / On / Quality + a predictor field; the SS starter is Off", ed.shown && ed.v === "off" && ed.opts.join() === "off,on,quality" && ed.pred && /Sage is skipped/.test(ed.tip), ed);

    // save a copy with Veda on
    await ev((n) => { document.getElementById("s_vsname").value = n; if (typeof curVideoStyleId !== "undefined") curVideoStyleId = null; document.getElementById("s_vsveda").value = "quality"; document.getElementById("s_vsvedapred").value = "minimax_h3_r2va_veda_preview_fp8.safetensors"; }, NAME);
    const form = await ev(() => vsReadForm().accel);
    check("the form reads accel.veda quality + the predictor", form.veda === "quality" && form.veda_predictor === "minimax_h3_r2va_veda_preview_fp8.safetensors", form);
    await p.click("#s_vssave"); await p.waitForTimeout(900);
    const all = await api("/api/styles?kind=video");
    const mine = (all.styles || all || []).filter ? (all.styles || all).filter((s) => s.name === NAME) : [];
    mine.forEach((s) => saved.push(s.id));
    check("saved: the server keeps accel.veda = quality and its predictor", mine.length === 1 && mine[0].accel && mine[0].accel.veda === "quality" && mine[0].accel.veda_predictor === "minimax_h3_r2va_veda_preview_fp8.safetensors", mine.map((s) => s.accel));
    await ev((id) => { const l = document.getElementById("s_vslist"); l.value = id; l.onchange(); }, ss); await p.waitForTimeout(200);
    await ev((id) => { const l = document.getElementById("s_vslist"); l.value = id; l.onchange(); }, saved[0]); await p.waitForTimeout(300);
    check("…opening it again reads Veda quality + the predictor back", await ev(() => document.getElementById("s_vsveda").value === "quality" && document.getElementById("s_vsvedapred").value === "minimax_h3_r2va_veda_preview_fp8.safetensors"));
    await ev(() => { document.getElementById("s_vsveda").value = "off"; }); await p.click("#s_vssave"); await p.waitForTimeout(900);
    const off = ((await api("/api/styles?kind=video")).styles || []).find((s) => s.id === saved[0]) || {};
    check("…Veda Off saves the old shape (no veda key)", off.accel && !("veda" in off.accel) && !("veda_predictor" in off.accel), off.accel);
    await ev(() => { const a = document.getElementById("s_vsarch"); const o = [...a.options].find((x) => x.value === "ltx-2.5"); if (o) { a.value = "ltx-2.5"; if (a.onchange) a.onchange(); else paintVideoArch(); } });
    const ltx = await ev(() => ({ shown: document.getElementById("s_vsvedabox").style.display !== "none", v: document.getElementById("s_vsveda").value }));
    check("an LTX arch hides Veda and turns it off (MiniMax H3 only)", !ltx.shown && ltx.v === "off", ltx);
    await ev(() => document.getElementById("settings").close());

    // the installer
    await ev(() => { document.getElementById("settings").showModal(); const t = document.querySelector('[data-stab="comfy"]') || [...document.querySelectorAll("button")].find((x) => /^ComfyUI$/.test(x.textContent.trim())); if (t) t.click(); });
    await ev(() => typeof refreshVideoAccel === "function" && refreshVideoAccel()); await p.waitForTimeout(1500);
    const ins = await ev(() => ({ btn: (document.getElementById("s_vapack_veda") || {}).textContent, lbl: (document.getElementById("s_vapacklbl_veda") || {}).textContent, head: [...document.querySelectorAll("#settings label.f")].map((l) => l.textContent).find((t) => /Video accelerators/.test(t)) }));
    check("Settings -> ComfyUI -> Video accelerators: ⬇ Install Veda with its installed / not installed label", /(Install|Update) Veda/.test(ins.btn || "") && /installed/.test(ins.lbl || "") && /Veda/.test(ins.head || ""), ins);
    const st = await api("/api/comfy/vaccel");
    check("/api/comfy/vaccel lists the veda pack (Veda-on-ComfyUI)", st.repos && st.repos.veda && st.repos.veda.folder === "Veda-on-ComfyUI", st.repos && st.repos.veda);
    await ev(() => document.getElementById("settings").close());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    for (const id of saved) await api("/api/styles/" + encodeURIComponent(id), undefined, "DELETE").catch(() => {});
    try { await b.close(); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

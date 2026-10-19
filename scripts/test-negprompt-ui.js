#!/usr/bin/env node
/* bitGen Studio — 2.419.0 in a REAL browser against the REAL app: ⊖ THE NEGATIVE PROMPT DOCKER (key 2 shows / hides it,
 * not while the 🎥 multi-camera dialog is open; its status line per model), the LLM's "Negative:" line lands in it (never
 * in the positive), image / video requests carry it, and the tools' prompt boxes follow the ONE prompt docker.
 * Tim: "use the prompt docker for all prompts ... add a negative prompt docker - "2" toggles negative prompt docker".
 * Run against the running app (H3_URL, default :8311). No Playwright = SKIP (exit 0). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.419 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_negui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "negui_"));

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1200 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.H3Neg && window.H3PromptBind && document.getElementById("negBtn") && document.getElementById("sf-negprompt"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    const shown = () => ev(() => { const e = document.getElementById("sf-negprompt"); if (!e || e.classList.contains("sf-hidden")) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    await ev(() => { if (document.activeElement) document.activeElement.blur(); });
    const s0 = await shown();
    await p.keyboard.press("2"); await p.waitForTimeout(300);
    const s1 = await shown();
    await ev(() => { if (document.activeElement) document.activeElement.blur(); });
    await p.keyboard.press("2"); await p.waitForTimeout(300);
    const s2 = await shown();
    check("key 2 shows the ⊖ Negative prompt docker, 2 again hides it", s1 !== s0 && s2 === s0, { s0, s1, s2 });
    if (!(await shown())) { await ev(() => { if (document.activeElement) document.activeElement.blur(); }); await p.keyboard.press("2"); await p.waitForTimeout(300); }
    // the 🎥 multi-camera dialog open: 1 - 9 are its cuts - 2 leaves the docker alone
    await ev(() => { const d = document.createElement("dialog"); d.id = "tlMulticamDlg"; document.body.appendChild(d); d.show(); if (document.activeElement) document.activeElement.blur(); });
    const m0 = await shown(); await p.keyboard.press("2"); await p.waitForTimeout(300); const m1 = await shown();
    await ev(() => document.getElementById("tlMulticamDlg").remove());
    check("...not while the 🎥 multi-camera dialog is open (its 2 cuts to camera 2)", m0 === true && m1 === true, { m0, m1 });

    /* ---- the LLM's negative */
    await ev(() => { H3Neg.set(""); const a = document.getElementById("negAuto"); a.checked = true; a.dispatchEvent(new Event("change")); });
    const ap = await ev(() => { chatApplyKind("Here you go:\n```image\nportrait of a red fox in snow, telephoto\nNegative: blurry, text, watermark\n```"); return { pos: document.getElementById("prompt").value, neg: document.getElementById("negPrompt").value }; });
    check("an LLM reply's ```image fence: the prompt docker gets the positive only, the ⊖ docker the 'Negative:' line", ap.pos === "portrait of a red fox in snow, telephoto" && ap.neg === "blurry, text, watermark", ap);

    /* ---- the status line */
    const st = await ev(() => {
      const out = {}, sel = document.getElementById("genModeSel"), ss = document.getElementById("styleSel");
      sel.value = "image"; sel.dispatchEvent(new Event("change"));
      const sd = (styleList || []).find((s) => s.arch === "sdxl"), fl = (styleList || []).find((s) => s.arch === "flux" && !(+s.cfg > 1));
      if (sd) { ss.value = sd.id; ss.dispatchEvent(new Event("change")); H3Neg.paint(); out.sd = document.getElementById("negUse").className; }
      if (fl) { ss.value = fl.id; ss.dispatchEvent(new Event("change")); H3Neg.paint(); out.fl = document.getElementById("negUse").className + " | " + document.getElementById("negUse").textContent; }
      sel.value = "video"; sel.dispatchEvent(new Event("change"));
      const vs = document.getElementById("videoStyleSel"); if (vs) { vs.value = ""; vs.dispatchEvent(new Event("change")); }
      document.getElementById("cfg").value = "1"; H3Neg.paint(); out.h31 = document.getElementById("negUse").textContent;
      document.getElementById("cfg").value = "3"; H3Neg.paint(); out.h33 = document.getElementById("negUse").className;
      document.getElementById("cfg").value = "1"; H3Neg.paint();
      return out;
    });
    check("the status line: SDXL ✓ uses it, FLUX ✗ distilled; MiniMax H3 at cfg 1 ✗ (raise cfg), at cfg 3 ✓",
      (st.sd === undefined || /\bon\b/.test(st.sd)) && (st.fl === undefined || /\boff\b/.test(st.fl)) && /raise cfg/.test(st.h31) && /\bon\b/.test(st.h33), st);

    /* ---- the requests carry it */
    let vbody = "";
    await p.route("**/api/generate", (r) => { vbody = r.request().postData() || ""; r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "test stop" }) }); });
    await ev(() => submitJob("a red fox in snow").catch(() => null));
    await p.waitForTimeout(500);
    await p.unroute("**/api/generate");
    check("a video request (H3 / Wan) carries the ⊖ docker's text as 'negative'", /name="negative"\r?\n\r?\nblurry, text, watermark/.test(vbody), vbody.slice(0, 400));
    let ibody = null;
    await p.route("**/api/genimage", (r) => { try { ibody = JSON.parse(r.request().postData() || "{}"); } catch { ibody = {}; } r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "test stop" }) }); });
    await ev(() => { const sel = document.getElementById("genModeSel"); sel.value = "image"; sel.dispatchEvent(new Event("change")); const ss = document.getElementById("styleSel"); if (!ss.value && ss.options.length) ss.value = ss.options[ss.options.length - 1].value;
      // no ComfyUI here: the request itself is what is checked (intercepted above)
      window.__ecr = ensureComfyReady; window.__cpf = comfyPreflight; ensureComfyReady = async () => true; comfyPreflight = async () => null;
      return startImageJob("a red fox in snow").catch(() => null).finally(() => { ensureComfyReady = window.__ecr; comfyPreflight = window.__cpf; }); });
    await p.waitForTimeout(600);
    await p.unroute("**/api/genimage");
    check("an image request carries it too", ibody && ibody.negative === "blurry, text, watermark", ibody);

    /* ---- one prompt docker */
    await ev(() => { const e = document.getElementById("prompt"); e.value = "make the sky stormy"; e.dispatchEvent(new Event("input")); });
    await p.waitForTimeout(300);
    const ie = await ev(() => { const el = document.getElementById("iePrompt"); if (!el) return null; const chip = el.nextElementSibling;
      return { hidden: el.classList.contains("pb-hidden") && el.offsetParent === null, val: el.value, chip: chip && chip.className, txt: chip && chip.textContent }; });
    check("the image editor's ✨ AI prompt box is gone - it follows the prompt docker (a chip shows the text it will use)",
      ie && ie.hidden && ie.val === "make the sky stormy" && /pbchip docker/.test(ie.chip) && /make the sky stormy/.test(ie.txt), ie);
    const dyn = await ev(async () => { const t = document.createElement("textarea"); t.id = "tlfPrompt"; t.value = "its own default"; document.body.appendChild(t);
      await new Promise((r) => setTimeout(r, 200)); const a = { hidden: t.classList.contains("pb-hidden"), val: t.value };
      const e = document.getElementById("prompt"); e.value = ""; e.dispatchEvent(new Event("input")); await new Promise((r) => setTimeout(r, 100));
      const b2 = { val: t.value, chip: t.nextElementSibling.className }; t.nextElementSibling.remove(); t.remove(); return { a, b: b2 }; });
    check("a tool box that appears later (✨ Fill) is taken over too; with the prompt docker empty the tool keeps its own default",
      dyn.a.hidden && dyn.a.val === "make the sky stormy" && dyn.b.val === "its own default" && /own/.test(dyn.b.chip), dyn);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { H3Neg.set(""); const e = document.getElementById("prompt"); e.value = ""; if (window.SecFloat && SecFloat.show) SecFloat.show("negprompt", false); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();

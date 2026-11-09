#!/usr/bin/env node
/* bitGen Studio — 2.744.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): ON A RUNPOD
 * SERVERLESS ENDPOINT THE STYLE LISTS SHOW ONLY WHAT IT CAN RENDER (static/rpstyles.js) + Settings ▸ Save keeps it.
 * Tim (verbatim): "if user is using runpod only show the styles that will work with runpod"
 *   - the prompt docker's image styles and the video styles: a style is hidden exactly when the endpoint cannot render it
 *     (GET /api/remotegpu/serverless/styles), a last line says how many; a hidden style that was picked moves to a shown one;
 *   - Settings ▸ Remote GPU says "can render N of M" and lists the others with why;
 *   - "my image has extra node packs" shows every style; "a newer ComfyUI" shows Fibo 2 but not a GGUF style;
 *   - Settings ▸ Save while on RunPod keeps ComfyUI's address on the endpoint (it put this computer's back - Tim's test
 *     rendered locally);
 *   - This computer: every style shows again.
 * The Remote GPU settings are put back afterwards. No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.744.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.744.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu");
  const c0 = await api("/api/config");
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI744" }, serverless: { endpoint: "epui744", comfy: "0.34.0", show_all: false } });
  await api("/api/remotegpu/use", { mode: "serverless" });
  // 2.746.0: Remote lists only the REMOTE styles - every image + video style made remote for this test (put back after)
  const madeRemote = [];
  for (const k of ["image", "video"]) for (const st of ((await api("/api/styles?kind=" + k)).styles || [])) {
    if (st.runs_on === "remote") continue;
    await api("/api/styles", { id: st.id, kind: k, runs_on: "remote" }); madeRemote.push([st.id, k]);
  }
  const ans = await api("/api/remotegpu/serverless/styles");
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RpStyles && H3RpStyles.state().map && document.getElementById("styleSel").options.length > 1, null, { timeout: 30000 });
    await sleep(800);
    const lists = () => ev(() => ["styleSel", "videoStyleSel"].map((id) => ({ id, opts: [...document.getElementById(id).options].map((o) => ({ v: o.value, t: o.textContent, hidden: o.hidden, note: o.dataset.rpsl === "note", title: o.title })), val: document.getElementById(id).value })));
    let L = await lists();
    const img = L[0], vid = L[1];
    const wrongI = img.opts.filter((o) => !o.note && o.v && ans.styles[o.v] && o.hidden === ans.styles[o.v].ok);
    const nHidI = img.opts.filter((o) => o.hidden && !o.note).length;
    check("image styles: hidden exactly when the endpoint cannot render them (why in the title); a last line says how many", ans.filter && nHidI > 0 && wrongI.length === 0
      && img.opts.some((o) => o.note && new RegExp("^☁ " + nHidI + " styles hidden: Basic Settings ▸ GPU is on Remote")) && img.opts.filter((o) => o.hidden && !o.note).every((o) => o.title.length > 5), { nHidI, wrongI: wrongI.slice(0, 3), note: img.opts.filter((o) => o.note) });
    const name = (o, re) => o.opts.find((x) => re.test(x.t));
    check("…R_SDXL and R_FLUX 2 Klein shown; Fibo 2, a GGUF style, Qwen Image 2.1 hidden (this install's, made remote)", name(img, /^R_SDXL$/) && !name(img, /^R_SDXL$/).hidden && name(img, /^R_FLUX\.2 Klein 9B$/) && !name(img, /^R_FLUX\.2 Klein 9B$/).hidden
      && name(img, /^R_Fibo 2\.0 Dev/).hidden && name(img, /GGUF/).hidden && name(img, /^R_Qwen Image 2\.1 edit$/).hidden);
    check("video styles: R_MiniMax H3 SS shown; LTX, Wan, the swap style hidden; the template (Ref + F/L work) shown", !name(vid, /^R_MiniMax H3 SS$/).hidden && name(vid, /^R_LTX 2\.3$/).hidden && name(vid, /^R_Wan 2\.1$/).hidden
      && name(vid, /^R_mmh3_chr_swap$/).hidden && !vid.opts.find((o) => o.v === "").hidden);
    check("…nothing hidden is the one picked", ![img, vid].some((x) => (x.opts.find((o) => o.v === x.val) || {}).hidden));
    // a hidden style picked (a project that remembered it) moves to a shown one, with a change event
    const moved = await ev((id) => { const s = document.getElementById("styleSel"); let changed = 0; s.addEventListener("change", () => changed++, { once: true }); s.value = id; H3RpStyles.apply(); return { val: s.value, hidden: s.selectedOptions[0].hidden, changed }; }, name(img, /^R_Fibo 2\.0 Dev/).v);
    check("…a hidden style that was picked moves to a shown one (and the page hears the change)", moved.val !== name(img, /^R_Fibo 2\.0 Dev/).v && !moved.hidden && moved.changed === 1, moved);
    // the list repainted (a style saved) is filtered again
    await ev(() => { const s = document.getElementById("styleSel"); const o = s.options[0].cloneNode(true); s.innerHTML = ""; [...document.querySelectorAll("#videoStyleSel option")].length; s.appendChild(o); });
    await sleep(300);
    check("…a repainted list is filtered again", await ev(() => document.getElementById("styleSel").options.length >= 1));
    await p.reload(); await p.waitForFunction(() => window.H3RpStyles && H3RpStyles.state().map && document.getElementById("styleSel").options.length > 1, null, { timeout: 30000 }); await sleep(600);

    // Settings ▸ Remote GPU
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="rgpu"]').click(); });
    await p.waitForFunction(() => /can render \d+ of your \d+ remote styles/.test((document.getElementById("rgSlsStyles") || {}).textContent || ""), null, { timeout: 8000 }).catch(() => {});
    const tab = await ev(() => ({ line: document.getElementById("rgSlsStyles").textContent, items: [...document.querySelectorAll("#rgSlsStyles li")].map((li) => li.textContent), comfy: document.getElementById("rgSlsComfy").value, all: document.getElementById("rgSlsAll").checked, shown: !!document.getElementById("rgSlsStyles").offsetParent }));
    const remo = Object.values(ans.styles).filter((x) => x.runs_on === "remote");   // 2.746.0: the remote styles are counted
    const nNo = remo.filter((x) => !x.ok).length, nAll = remo.length;
    tab.nAll = nAll; tab.nNo = nNo;
    check("Remote GPU ▸ RunPod Serverless: \"can render N of M\", the others listed with why; ComfyUI 0.34.0, packs off", tab.shown && new RegExp(`can render ${nAll - nNo} of your ${nAll} remote styles`).test(tab.line)
      && tab.items.length === nNo && tab.items.some((t) => /^R_LTX 2\.3 \(video\) - the LTX worker/.test(t)) && tab.comfy === "0.34.0" && !tab.all, tab);
    // "my image has node packs"
    await p.click("#rgSlsAll"); await sleep(1200);
    L = await lists();
    check("\"My image has extra node packs\": saved, and every style shows (no note)", (await api("/api/remotegpu")).serverless.show_all === true && !L.some((x) => x.opts.some((o) => o.hidden || o.note)), L.map((x) => x.opts.filter((o) => o.hidden).length));
    await p.click("#rgSlsAll"); await sleep(300);
    await p.selectOption("#rgSlsComfy", "latest"); await sleep(1400);
    L = await lists();
    check("\"A newer ComfyUI\": Fibo 2 shows; a GGUF style still hidden (a node pack)", (await api("/api/remotegpu")).serverless.comfy === "latest" && !name(L[0], /^R_Fibo 2\.0 Dev/).hidden && name(L[0], /GGUF/).hidden);
    await p.selectOption("#rgSlsComfy", "0.34.0"); await sleep(600);

    // Settings ▸ Save keeps the endpoint (Tim's test rendered on this computer)
    const before = (await api("/api/config")).engine.comfy.url;
    await ev(() => document.getElementById("s_save").click()); await sleep(1500);
    const after = await api("/api/config");
    check("Settings ▸ Save while on RunPod: ComfyUI's address stays the endpoint's (/rpsl), not this computer's", /\/rpsl$/.test(before) && after.engine.comfy.url === before && after.rgpu.mode === "serverless", { before, after: after.engine.comfy.url });
    // This computer
    await ev(() => { if (!document.getElementById("settings").open) document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="rgpu"]').click(); }); await sleep(500);
    await p.check('#stab-rgpu input[name="rgmode"][value="local"]'); await p.click("#rgUse"); await sleep(1500);
    L = await lists();
    const c2 = await api("/api/config");
    check("This computer: its own ComfyUI again; only this computer's styles listed now (the ones made remote are hidden - 2.746.0)", !/\/rpsl$/.test(c2.engine.comfy.url)
      && L.every((x) => x.opts.filter((o) => o.v && !o.note).every((o) => o.hidden)) && L[0].opts.some((o) => o.note && /remote styles hidden: Basic Settings ▸ GPU is on Local/.test(o.t)), c2.engine.comfy.url);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    for (const [id, k] of madeRemote) await api("/api/styles", { id, kind: k, runs_on: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: (v0.runpod || {}).key || "" }, serverless: Object.assign({ endpoint: "", cost_hr: 0, comfy: "0.34.0", show_all: false }, v0.serverless || {}) }).catch(() => {});
    if (v0.mode && v0.mode !== "local") await api("/api/remotegpu/use", { mode: v0.mode }).catch(() => {});
    if ((c0.engine || {}).comfy) await api("/api/config", { engine: { comfy: { url: c0.engine.comfy.url, autostart: c0.engine.comfy.autostart } } }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

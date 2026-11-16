#!/usr/bin/env node
/* bitGen Studio — 2.788.0 browser test: BASIC SETTINGS' OVERRIDE LISTS FILTERED BY THE PROMPT DOCKER'S STYLES (lib/famFilter.js,
 * routes/famFilter.js, static/famfilter.js, the cmCombo + static/basicset.js hooks) on a running studio (H3_URL, default :8311).
 * Tim (verbatim): "in the model and lora lists in overide settings, filter the list by the syle selected in the prompt docker
 * dropdowns family of models and the type (image/image-edit/video)"
 * The files come from a stand-in pod's inventory (runpod/pods/<id>.json - the lists show them as "<pod name>/<file>"), so no
 * ComfyUI is needed; removed afterwards. No server / no Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.788.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const DIR = path.join(__dirname, "..", "runpod", "pods"), POD = "pod788test", NAME = "Test pod";
const F = (cat, rel) => ({ cat, rel, size: 1e9, kind: cat === "loras" ? "lora" : "model", state: "on" });

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.788.0 browser test did not run"); process.exit(0); }
  fs.mkdirSync(DIR, { recursive: true });
  const INV = path.join(DIR, POD + ".json");
  fs.writeFileSync(INV, JSON.stringify({ v: 1, id: POD, name: NAME, gone: false, at: Date.now(), listed_at: Date.now(), files: [
    F("checkpoints", "krea2_mine.safetensors"), F("checkpoints", "juggernaut_xl_v9.safetensors"), F("checkpoints", "qwen_image_2.1_edit_fp8.safetensors"),
    F("checkpoints", "qwen_image_fp8.safetensors"), F("checkpoints", "mystery_v3.safetensors"),
    F("diffusion_models", "wan2.2_t2v_14B.safetensors"), F("diffusion_models", "mmh3_dev_fp8.safetensors"),
    F("loras", "krea_grain.safetensors"), F("loras", "detail_tweaker_xl.safetensors"), F("loras", "mmh3_motion.safetensors")] }));
  const istyles = ((await api("/api/styles?kind=image")).styles || []), vstyles = ((await api("/api/styles?kind=video")).styles || []);
  const kreaSt = istyles.find((s) => /^krea 2 raw$/i.test(s.name)) || istyles.find((s) => s.arch === "krea2");
  const qwenSt = istyles.find((s) => /qwen image 2\.1 edit$/i.test(s.name)) || istyles.find((s) => s.arch === "qwen-image");
  const h3St = vstyles.find((s) => /^minimax h3 ss$/i.test(s.name)) || vstyles.find((s) => s.arch === "minimax-h3");
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3FamFilter && document.getElementById("styleSel") && document.getElementById("imgCkptCombo") && typeof loadComfyModels === "function", null, { timeout: 60000 });
    // the page puts the last styles back ~4 s after it loads (static/stylebasic.js) - pick after that
    await p.waitForFunction(() => performance.now() > 6500, null, { timeout: 20000 });
    await ev(() => { try { localStorage.removeItem("h3.famfilter.off.image"); localStorage.removeItem("h3.famfilter.off.video"); } catch (e) { /* fine */ } return loadComfyModels(true); });
    const pick = (id, v) => ev(([i, x]) => { const s = document.getElementById(i); if (![...s.options].some((o) => o.value === x)) { const o = document.createElement("option"); o.value = x; o.textContent = x; s.appendChild(o); } s.value = x; s.dispatchEvent(new Event("change", { bubbles: true })); }, [id, v]);
    const opts = () => ev(() => [...document.querySelectorAll("#imgCkptCombo .cmfile option")].map((o) => o.textContent));
    const note = (k) => ev((x) => { const el = document.getElementById("ffNote_" + x); return el && !el.hidden ? el.textContent : ""; }, k);
    const waitNote = (k, re) => p.waitForFunction(([x, r]) => { const el = document.getElementById("ffNote_" + x); return el && !el.hidden && new RegExp(r).test(el.textContent); }, [k, re], { timeout: 15000 }).catch(() => {});

    await pick("styleSel", kreaSt.id);
    await waitNote("image", "Krea");
    let o = await opts();
    const has = (L, s) => L.some((t) => t.includes(s));
    check("a Krea style: the checkpoint list = Krea files + the ones of no known family (marked, at the end) - SDXL / Qwen / video files hidden",
      has(o, "krea2_mine") && has(o, "mystery_v3") && o.find((t) => t.includes("mystery_v3")).includes("family not known") && !has(o, "juggernaut") && !has(o, "qwen_image") && !has(o, "wan2.2") && !has(o, "mmh3")
      && o.findIndex((t) => t.includes("krea2_mine")) < o.findIndex((t) => t.includes("mystery_v3")), o);
    let n = await note("image");
    check("the line under the checkpoint: the style, its family Krea (2.798.0: no image / edit split), models + LoRAs counted, ☐ Show all", /For .*Krea 2 Raw|For .*Krea/.test(n) && /: Krea - /.test(n) && /\d+ models?/.test(n) && /\d+ LoRAs?/.test(n) && /Show all/.test(n), n);

    // a picture temporary LoRA row
    await ev(() => { const b = document.getElementById("tliAdd"); b.click(); });
    await sleep(600);
    const lo = await ev(() => { const rows = document.querySelectorAll("#tliRows .lorarow"); const r = rows[rows.length - 1]; return r ? [...r.querySelectorAll(".cmfile option")].map((o) => o.textContent) : null; });
    check("a picture temporary LoRA row lists the Krea LoRA, not the SDXL / video ones", lo && has(lo, "krea_grain") && !has(lo, "detail_tweaker_xl") && !has(lo, "mmh3_motion"), lo);
    await ev(() => { const rows = document.querySelectorAll("#tliRows .lorarow"); const r = rows[rows.length - 1]; if (r) r.querySelector(".lx").click(); });

    // an edit style: 2.798.0 (Tim: "drop the split because some image models like klein can edit as well as generate") - every Qwen file
    if (qwenSt) {
      await pick("styleSel", qwenSt.id);
      await waitNote("image", "Qwen");
      o = await opts();
      check("a Qwen edit style: every Qwen file - the edit one AND the picture one (no type split) - not Krea", has(o, "qwen_image_2.1_edit") && has(o, "qwen_image_fp8") && !has(o, "krea2_mine") && /: Qwen - /.test(await note("image")), o);
    } else check("a Qwen edit style exists", false, istyles.map((s) => s.name));

    // Show all
    await pick("styleSel", kreaSt.id); await waitNote("image", "Krea");
    await ev(() => { const c = document.querySelector('#ffNote_image .ffAll'); c.checked = true; c.dispatchEvent(new Event("change")); });
    await sleep(400);
    o = await opts();
    check("☐ Show all: every model again (kept)", has(o, "juggernaut") && has(o, "qwen_image_fp8") && /Showing every model/.test(await note("image")) && await ev(() => localStorage.getItem("h3.famfilter.off.image") === "1"), o);
    await ev(() => { const c = document.querySelector('#ffNote_image .ffAll'); c.checked = false; c.dispatchEvent(new Event("change")); });
    await sleep(400);

    // a picked file of another family stays picked, said why
    await ev((v) => { const i = document.getElementById("imgCkpt"); i.value = v; document.querySelector("#imgCkptCombo .cmcombo")._repaint(); }, NAME + "/juggernaut_xl_v9.safetensors");
    o = await opts();
    check("a picked SDXL file under a Krea style stays picked, its line says it is not a Krea image model", o.some((t) => /juggernaut_xl_v9.*not a Krea image model/.test(t)) && await ev(() => document.querySelector("#imgCkptCombo .cmfile").value) === NAME + "/juggernaut_xl_v9.safetensors", o);
    await ev(() => { const i = document.getElementById("imgCkpt"); i.value = ""; document.querySelector("#imgCkptCombo .cmcombo")._repaint(); });

    // video: the video Model list + the video LoRAs
    await pick("videoStyleSel", h3St.id);
    await waitNote("video", "MiniMax H3");
    await ev(() => { const m = document.getElementById("vidModel"); m.dispatchEvent(new Event("focus")); });
    await p.waitForFunction(() => document.querySelectorAll("#vidModelList option").length > 0, null, { timeout: 10000 }).catch(() => {});
    const vl = await ev(() => [...document.querySelectorAll("#vidModelList option")].map((o) => o.value));
    check("a MiniMax H3 video style: the video Model list = the H3 file (+ no known family) - not Wan, not the picture models", has(vl, "mmh3_dev") && !has(vl, "wan2.2") && !has(vl, "krea2_mine") && !has(vl, "juggernaut") && /: MiniMax H3 - /.test(await note("video")), vl);
    await ev(() => document.getElementById("tlvAdd").click());
    await sleep(600);
    const vlo = await ev(() => { const rows = document.querySelectorAll("#tlvRows .lorarow"); const r = rows[rows.length - 1]; return r ? [...r.querySelectorAll(".cmfile option")].map((o) => o.textContent) : null; });
    check("a video temporary LoRA row lists the H3 LoRA, not the picture ones", vlo && has(vlo, "mmh3_motion") && !has(vlo, "krea_grain") && !has(vlo, "detail_tweaker_xl"), vlo);
    await ev(() => { const rows = document.querySelectorAll("#tlvRows .lorarow"); const r = rows[rows.length - 1]; if (r) r.querySelector(".lx").click(); });

    // the style editor's own lists are not filtered
    check("only Basic Settings' lists: the 📁 browser / style editor keep everything (H3FamFilter.files gives null for them)", await ev(() => { const i = document.createElement("input"); i.id = "s_stckpt"; return H3FamFilter.files(i, [{ name: "x", category: "checkpoints" }]) === null; }));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the test crashed: " + e.message, false); }
  finally {
    await b.close();
    try { fs.unlinkSync(INV); } catch { /* gone */ }
    try { fs.rmdirSync(DIR); fs.rmdirSync(path.dirname(DIR)); } catch { /* kept: others there */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

#!/usr/bin/env node
/* bitGen Studio — 2.777.0 browser test: BASIC SETTINGS ▸ USE MODEL / USE TEMPORARY LORAS (static/ovruse.js, lib/basicUse.js) on a
 * running studio (H3_URL, default :8311): the four boxes over their fields, an unticked box leaves the checkpoint / the LoRAs out
 * of the picture's request (the rest of Override still goes), saved and kept after a reload; the pod docker's ⬆ buttons gone.
 * Settings put back afterwards. Tim (verbatim): "add a checkbox over the checkpoint "Use Model", and another over loras "Use
 * Temporary Lora's this will allow the style to be more versatile, we can send overide settings without changing the base model
 * or use loras if we want with the styles model or the overide model"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.777.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (u, b) => (await fetch(URL0 + u, b === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json();

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.777.0 browser test did not run"); process.exit(0); }
  const u0 = await api("api/basic-use");
  const b = await chromium.launch();
  try {
    await api("api/basic-use", { image_model: true, image_loras: true, video_model: true, video_loras: true });
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const tick = (id, on) => ev(([i, o]) => { const c = document.getElementById(i); c.checked = o; c.dispatchEvent(new Event("change", { bubbles: true })); }, [id, on]);   // the panel may be folded
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3OvrUse && ["useImgModel", "useImgLoras", "useVidModel", "useVidLoras"].every((i) => document.getElementById(i)), null, { timeout: 60000 });
    await sleep(800);
    const a = await ev(() => {
      const over = (box, id) => { const l = document.getElementById(box).closest("label"), n = l.nextElementSibling; return !!n && (n.contains(document.getElementById(id)) || n.getAttribute("for") === id || (n.nextElementSibling && n.nextElementSibling.id === id)); };
      return { txt: ["useImgModel", "useImgLoras", "useVidModel", "useVidLoras"].map((i) => document.getElementById(i).closest("label").textContent.trim()),
        on: ["useImgModel", "useImgLoras", "useVidModel", "useVidLoras"].map((i) => document.getElementById(i).checked),
        over: [over("useImgModel", "imgCkptCombo"), over("useImgLoras", "tliAdd"), over("useVidModel", "vidModel"), over("useVidLoras", "tlvAdd")] };
    });
    check("four boxes: Use model over the checkpoint and over the video model, Use temporary LoRAs over each LoRA list - all ticked (as before)",
      a.txt.join("|") === "Use model|Use temporary LoRAs|Use model|Use temporary LoRAs" && a.on.every(Boolean) && a.over.every(Boolean), a);
    const body = () => ev(() => { const o = document.getElementById("ovrStyle"); if (o && !o.checked) { o.checked = true; o.dispatchEvent(new Event("change", { bubbles: true })); }
      document.getElementById("imgCkpt").value = "other.safetensors"; window.tempLoras = (k) => (k === "image" ? [{ name: "t.safetensors", strength: 0.8 }] : []);
      const x = imgBasicsBody({}); return { model: x.model || null, loras: (x.extra_loras || []).length, steps: "steps" in x }; });
    const b1 = await body();
    check("ticked: the override checkpoint and the temporary LoRAs go with a picture", b1.model === "other.safetensors" && b1.loras === 1, b1);
    await tick("useImgModel", false); await sleep(700);
    const b2 = await body();
    check("Use model off: the style's own checkpoint renders (no model sent) - the LoRAs and Override's settings still go", b2.model === null && b2.loras === 1 && b2.steps, b2);
    await tick("useImgLoras", false); await tick("useImgModel", true); await sleep(700);
    const b3 = await body();
    check("Use temporary LoRAs off, Use model on: the override checkpoint with no LoRAs", b3.model === "other.safetensors" && b3.loras === 0, b3);
    const s = await api("api/basic-use"), dimmed = await ev(() => getComputedStyle(document.getElementById("tliRows")).opacity);
    check("saved at once (POST /api/basic-use) and the unused list is dimmed", s.image_loras === false && s.image_model === true && s.video_loras === true && Number(dimmed) < 0.6, { s, dimmed });
    await tick("useVidLoras", false); await sleep(700);
    const v = await ev(() => ({ use: H3OvrUse.loras("video"), basic: window.H3Basic && H3Basic.loras ? H3Basic.loras() : null }));
    check("video: Use temporary LoRAs off - H3OvrUse says so (the video bodies ask it)", v.use === false, v);
    await p.reload();
    await p.waitForFunction(() => window.H3OvrUse && document.getElementById("useImgLoras") && document.getElementById("useVidLoras"), null, { timeout: 60000 }); await sleep(1500);
    const r = await ev(() => ({ il: document.getElementById("useImgLoras").checked, vl: document.getElementById("useVidLoras").checked, im: document.getElementById("useImgModel").checked }));
    check("kept after a reload", r.il === false && r.vl === false && r.im === true, r);
    const pd = await ev(() => !!document.querySelector("[data-psnodes],[data-pscomfy]"));
    check("the pod docker has no ⬆ Nodes its styles need / ⬆ Update ComfyUI buttons", pd === false);
    check("no page errors", errs.length === 0, errs);
  } finally {
    await b.close();
    await api("api/basic-use", u0).catch(() => 0);
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

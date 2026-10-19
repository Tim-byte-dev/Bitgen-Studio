#!/usr/bin/env node
/* bitGen Studio — 2.401.0: Basic Settings' video style card (lib/styleModels.js, routes/styleCard.js,
 * static/stylecard.js) + the prompt docker's ⏫ Enhance on the selected video (static/selvideo.js,
 * static/seedvr2panel.js, lib/seedvr2.resolve's `from`).
 * Tim (verbatim): "show the selected video style settings with it's model in basic settings . allow user to quick
 * change the model. use the enhance button in the prompt docker to upscale the selected video - the selected video
 * will be the one selected from gallery,assets or reference" (asked: "upscale only, the prompt enhance is not
 * necessary because enter goes direct to llm to enhance").
 *   1. styleModels.loadersOf: an API export's model loaders in graph order (unet / ckpt / model_name, links skipped);
 *      a UI export's UNET / GGUF / checkpoint loaders (not the VAE / CLIP / upscale loaders);
 *   2. workflowFor: LTX = its canvas; the style's own file; a board style's .ui.json until converted; a chain named
 *      after the style; the template; forStyle: Wan = auto;
 *   3. seedvr2.resolve(from): asset / ref look in video/ first, the gallery in output/ first;
 *   4. the wiring (scripts, the card's mount, the Enhance handler + its label, the route);
 *   5. LIVE (H3_URL): GET /api/stylecard/<a template style> = the template's model; unknown -> 404.
 * Run from repo root: node scripts/test-stylecard.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SM = require(path.join(ROOT, "lib", "styleModels.js"));
const SV = require(path.join(ROOT, "lib", "seedvr2.js"));
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0, skip = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

(async () => {
  // 1
  const api = { "_meta": {}, "5": { class_type: "UNETLoader", inputs: { unet_name: "a.safetensors", weight_dtype: "default" } },
    "9": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "b.ckpt" } }, "12": { class_type: "UNETLoader", inputs: { unet_name: ["3", 0] } },
    "14": { class_type: "LatentUpscaleModelLoader", inputs: { model_name: "up.safetensors" } }, "20": { class_type: "VAELoader", inputs: { vae_name: "v.safetensors" } } };
  const l1 = SM.loadersOf(api);
  check("loadersOf (API): unet / ckpt / model_name loaders in graph order (worker.py's phase order); a linked name and the VAE skipped",
    JSON.stringify(l1.map((x) => x.name)) === '["a.safetensors","b.ckpt","up.safetensors"]' && l1[0].node === "5" && l1[0].key === "unet_name", l1);
  const ui = { nodes: [{ id: 1, type: "CLIPLoader", widgets_values: ["gemma.safetensors"] }, { id: 2, type: "UNETLoader", widgets_values: ["ltx.safetensors", "default"] },
    { id: 3, type: "UnetLoaderGGUF", widgets_values: ["ltx-Q4.gguf"] }, { id: 4, type: "VAELoaderKJ", widgets_values: ["vae.safetensors"] },
    { id: 5, type: "LatentUpscaleModelLoader", widgets_values: ["x2.safetensors"] }] };
  check("loadersOf (UI): the UNET + GGUF loaders, not the CLIP / VAE / latent upscaler",
    JSON.stringify(SM.loadersOf(ui).map((x) => x.name)) === '["ltx.safetensors","ltx-Q4.gguf"]', SM.loadersOf(ui));

  // 2
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sc401-"));
  const W = (rel, obj) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), JSON.stringify(obj)); };
  W("comfy_workflows/ref2va.json", { "1": { class_type: "UNETLoader", inputs: { unet_name: "tpl.safetensors" } } });
  W("comfy_workflows/own.json", { "1": { class_type: "UNETLoader", inputs: { unet_name: "own.safetensors" } } });
  W("comfy_workflows/Board.ui.json", { nodes: [{ id: 1, type: "UNETLoader", widgets_values: ["board.safetensors"] }] });
  W("comfy_workflows/Chain_Style.json", { "1": { class_type: "UNETLoader", inputs: { unet_name: "chain.safetensors" } } });
  W("comfy_workflows/LTX25_All_In_One.json", ui);
  const cfg = { engine: { comfy: { workflows: { ref2va: "comfy_workflows/ref2va.json" } } } };
  const f = (st) => SM.forStyle(st, { base: tmp, config: cfg });
  const a = f({ name: "Plain", arch: "minimax-h3", workflows: { ref2va: "" } }), b = f({ name: "Own", arch: "minimax-h3", workflows: { ref2va: "comfy_workflows/own.json" } });
  const c = f({ name: "Board", arch: "minimax-h3", workflows: { ref2va: "comfy_workflows/Board.json" } }), d = f({ name: "Chain_Style", arch: "minimax-h3", workflows: {} });
  const e = f({ name: "LTX 2.5", arch: "ltx-2.5", workflows: { ltx: "" } }), w = f({ name: "Wan", arch: "wan22" });
  check("forStyle: the template's model (own false); the style's own file; a board style's .ui.json until converted; a chain named after the style; LTX = its canvas; Wan = auto",
    a.loaders[0] === "tpl.safetensors" && a.own === false && b.loaders[0] === "own.safetensors" && b.own === true
    && c.loaders[0] === "board.safetensors" && /Board\.ui\.json$/.test(c.workflow) && d.loaders[0] === "chain.safetensors"
    && e.loaders.join() === "ltx.safetensors,ltx-Q4.gguf" && w.auto === true && !w.loaders.length && /Wan builds its graph itself/.test(w.note), { a, b, c, d, e, w });

  // 3
  for (const sub of ["output", "video"]) fs.mkdirSync(path.join(tmp, "p", sub), { recursive: true });
  fs.writeFileSync(path.join(tmp, "p", "output", "same.mp4"), "o");
  fs.writeFileSync(path.join(tmp, "p", "video", "same.mp4"), "v");
  const P = path.join(tmp, "p");
  check("seedvr2.resolve: a gallery pick reads output/ first; an asset / a reference video reads video/ first (same name in both)",
    SV.resolve(P, "same.mp4", "gallery") === path.join(P, "output", "same.mp4") && SV.resolve(P, "same.mp4", "asset") === path.join(P, "video", "same.mp4")
    && SV.resolve(P, "same.mp4", "ref") === path.join(P, "video", "same.mp4") && SV.resolve(P, "same.mp4") === path.join(P, "output", "same.mp4"));
  fs.rmSync(tmp, { recursive: true, force: true });

  // 4
  const html = read("static/index.html"), pd = read("ext/promptdock/dock.html");
  check("wiring: seedvr2panel.js + selvideo.js + stylecard.js loaded; #bsStyleCard first in the video set; repainted after a style refresh / pick / project load",
    // 2.519.0: a later release loads static/dlss5panel.js between seedvr2panel.js and selvideo.js
    /<script src="\/static\/seedvr2panel\.js"><\/script>\s*(<script src="\/static\/dlss5panel\.js"><\/script>\s*)?<script src="\/static\/selvideo\.js"><\/script>\s*<script src="\/static\/stylecard\.js"><\/script>/.test(html)
    && /<div id="vset">[\s\S]{0,400}<div id="bsStyleCard"><\/div>\s*<div class="modes"/.test(html)
    && (html.match(/StyleCard\.paint\(\)/g) || []).length === 3);
  check("wiring: ⏫ Enhance in the prompt menubar opens the SeedVR2 panel for SelVideo.get(); the prompt rewrite kept as enhancePrompt(); the tooltip follows h3:selvideo",
    /id="enhanceBtn"[^>]*>⏫ Enhance<\/button>/.test(pd) && /\$\("enhanceBtn"\)\.onclick = \(e\) => \{[\s\S]{0,400}SeedVR2Panel\.open\(\{ name: v \? v\.name : "", from: v \? v\.from : "", anchor: \$\("enhanceBtn"\) \}\)/.test(html)
    && /async function enhancePrompt\(\)/.test(html) && /addEventListener\("h3:selvideo"/.test(html));
  check("wiring: /api/stylecard mounted; the preview's ⏫ SeedVR2 uses the shared panel (no panel markup of its own)",
    /require\("\.\/styleCard"\)\.mount\(app\)/.test(read("routes/index.js")) && /SeedVR2Panel\.open\(\{ name: current\(\), from: "preview"/.test(read("ext/previewdock/seedvr2.js"))
    && !/pvSvPanel/.test(read("ext/previewdock/dock.html")));

  // 5 LIVE
  let list = null;
  try { list = (await (await fetch(URL_ + "api/styles?kind=video")).json()).styles; } catch { list = null; }
  if (!list) { skip++; console.log("SKIP: no app at " + URL_ + " - the live legs did not run"); }
  else {
    const tplStyle = list.find((s) => s.arch === "minimax-h3" && !Object.values(s.workflows || {}).some(Boolean) && !/^MM3_Characters$/.test(s.name));
    const wan = list.find((s) => /^wan/.test(s.arch));
    const r1 = tplStyle ? await (await fetch(URL_ + "api/stylecard/" + tplStyle.id)).json() : null;
    const r2 = wan ? await (await fetch(URL_ + "api/stylecard/" + wan.id)).json() : null;
    const r3 = await fetch(URL_ + "api/stylecard/nope");
    check("LIVE /api/stylecard: a template style = the template workflow's model loader(s); a Wan style = auto; unknown = 404",
      (!tplStyle || (r1 && r1.own === false && Array.isArray(r1.loaders) && /comfy_workflows\//.test(r1.workflow)))
      && (!wan || (r2 && r2.auto === true)) && r3.status === 404, { r1, r2, s3: r3.status });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed${skip ? ", " + skip + " skipped" : ""}`);
  process.exit(fail ? 1 : 0);
})();

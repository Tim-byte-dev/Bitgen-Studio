#!/usr/bin/env node
// bitGen Studio 2.920.0 - SAM 3 in the image editor (Tim: "yeh, upgrade to sam3"). Units (the editor's clicks / words / layers
// through the stand-in server stay covered by scripts/test-pcsam.js and the browser tests). Run: node scripts/test-920.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 500)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

(async () => {
  const core = require("../lib/core");
  const SEG = require("../lib/segment");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sam3-920-"));
  const venv = path.join(tmp, "venv"), sam3 = path.join(tmp, "sam3");
  const vpy = path.join(venv, process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
  fs.mkdirSync(path.dirname(vpy), { recursive: true }); fs.writeFileSync(vpy, ""); fs.writeFileSync(path.join(venv, ".bitgen_segment_ready"), "x");
  const real = core.getConfig;
  let cfg = { segment: { venv, model: "sam3", checkpoint: sam3 } };
  core.getConfig = () => cfg;
  try {
    check("SAM 3 is a model: a FOLDER, 3.4 GB, facebook/sam3 first then the ungated mirror (same SAM License)",
      SEG.MODELS.sam3 && SEG.MODELS.sam3.dir === true && SEG.MODELS.sam3.repos.join() === "facebook/sam3,ml-resources/sam3");
    fs.mkdirSync(sam3, { recursive: true });
    check("found(): an empty SAM 3 folder is not SAM 3", SEG.found("sam3") === false);
    fs.writeFileSync(path.join(sam3, "config.json"), "{}"); fs.writeFileSync(path.join(sam3, "model.safetensors"), "x");
    const st = SEG.status();
    check("found(): config.json + the weights = SAM 3 here; status ready with SAM 3 as the model", SEG.found("sam3") && st.ready && st.model === "sam3" && st.models.sam3.found, st);
    cfg = { segment: { venv } };
    check("no model picked: SAM 1 ViT-B unless SAM 3 is in models/sam3 (the default once installed)", SEG.status().model === (fs.existsSync(path.join(ROOT, "models", "sam3", "config.json")) ? "sam3" : "vit_b"));
    cfg = { segment: { venv, model: "sam3", checkpoint: sam3 } };
    let e = null;
    const sam1There = ["vit_h", "vit_l", "vit_b"].some((k) => fs.existsSync(SEG.checkpointFor(k)));
    if (!sam1There) {
      try { await SEG.run({ op: "auto", image: Buffer.from([1, 2, 3]) }); } catch (x) { e = x; }
      check("\"Everything\" with SAM 3 and no SAM 1 here: 409 in words (SAM 3 has no segment-everything mode - Reinstall fetches ViT-B)",
        e && e.status === 409 && /SAM 3 has none/.test(e.message) && /ViT-B/.test(e.message), e && e.message);
    } else check("(SAM 1 is on this machine - the 409 case is not testable here)", true);
    // settings: SAM 3's checkpoint is a folder (a .pth is asked of the others)
    let saved = null;
    const realSet = core.setConfig; core.setConfig = (c) => { saved = c; };
    try {
      SEG.settings({ model: "sam3", checkpoint: sam3 });
      check("settings: SAM 3 with its FOLDER as the checkpoint is accepted", saved && saved.segment.model === "sam3" && saved.segment.checkpoint === sam3);
      let bad = null; try { SEG.settings({ model: "vit_b", checkpoint: sam3 }); } catch (x) { bad = x; }
      check("settings: a SAM 1 still needs a .pth", bad && /\.pth/.test(bad.message));
    } finally { core.setConfig = realSet; }
  } finally { core.getConfig = real; SEG.stop(); fs.rmSync(tmp, { recursive: true, force: true }); }

  const plan = SEG.pipPlan(true);
  check("the venv: PyTorch cu128 (an RTX 50-series has no cu124 kernels) + transformers 5 (SAM 3) + huggingface_hub", /cu128/.test(plan[1].join(" ")) && plan[2].includes("transformers>=5.0") && plan[2].includes("huggingface_hub"));
  const scr = SEG.sam3Script(["facebook/sam3", "ml-resources/sam3"], "/x/sam3");
  check("the SAM 3 download: each repo in turn with the Hugging Face token, the json / safetensors / licence files into the folder, a clear failure",
    /snapshot_download\(r, local_dir=dest, token=tok/.test(scr) && /HF_TOKEN/.test(scr) && /LICENSE\*/.test(scr) && /SAM 3 could not be downloaded/.test(scr));
  const ls = src("lib/segment.js");
  check("install: SAM 3 for a new install (+ SAM ViT-B for Everything), the token from Settings", /: "sam3"\);   \/\/ 2\.920\.0: SAM 3 for a new install/.test(ls) && /for "Everything" \(SAM 3 has no segment-everything mode\)/.test(ls) && /HF_TOKEN: tok/.test(ls));
  const py = src("scripts/segment.py");
  check("segment.py: Sam3Tracker for clicks / a box (the picture's embedding reused), Sam3 concept segmentation for words (every instance, its score as the threshold)",
    /T\.Sam3TrackerProcessor\.from_pretrained\(folder\), T\.Sam3TrackerModel/.test(py) && /T\.Sam3Processor\.from_pretrained\(folder\), T\.Sam3Model/.test(py)
    && /model\.get_image_embeddings\(inputs\["pixel_values"\]\)/.test(py) && /post_process_instance_segmentation\(res, threshold=thr/.test(py)
    && /if req\.get\("model"\) == "sam3":\s+# 2\.920\.0\s+m, s = sam3_points/.test(py) && /return sam3_words\(req, rgb, terms, thr, each\)/.test(py));
  check("segment.py: transformers without SAM 3 says Reinstall", /it needs 5\.0 or newer\) - ⟳ Reinstall/.test(py));
  check("the editor's Segment Anything settings say what SAM 3 does (words itself, gated + the mirror, ViT-B for Everything)", /<b>SAM 3<\/b> \(the default\) selects by a click, a box OR words/.test(src("ext/imageeditdock/pcsam.js")));
  check("credits: SAM 3 (Meta, SAM License)", /SAM 3/.test(src("lib/credits.json")) && /SAM 3/.test(src("misc/NOTICE.md")));
  console.log(`RESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log("FAIL:", e.stack || e); process.exit(1); });

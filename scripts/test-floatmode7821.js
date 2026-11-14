#!/usr/bin/env node
/* bitGen Studio — 2.782.1: a docker that becomes floating comes to the front (static/floatz.js); each Remote generation type sets its
 * own mode (lib/modeSwitch.js remoteWhere / localTypes / mixed; both model lists when mixed - lib/remoteModels.js mergeComfy;
 * this computer's ComfyUI kept for a Local type); a pod's ComfyUI keeps the text encoder + VAE on the card (lib/podVram.js
 * --highvram); RunPod ▸ Serverless / Pods moved from the docker to Settings ▸ Remote generation. Pure + jsdom.
 * Tim (verbatim): "if a docker is in floating state bring it to the front , right now new floating docker are going behind the new
 * custom docker. put the text encoder and/or vae in vram if it fits, use offloading if necessary. ... when local is selected in any
 * of the remote generation radios , set that type to local mode, if remote is selected then set that model to remote mode. remove
 * runpod options for serverless or pods from remote generation docker, the user can choose that from the settings dialog" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const M = require("../lib/modeSwitch");
  const sp = (o) => Object.assign({ where: "remote", per: true }, o);
  check("per type: Image Local + Video Remote = remote mode with image (and music) here", M.remoteWhere(sp({ video: true })) && JSON.stringify(M.localTypes(sp({ video: true }))) === '["image","music"]' && M.mixed(sp({ video: true })));
  check("…all three Local = local mode (this computer's lists, its ComfyUI started)", !M.remoteWhere(sp({})) && !M.mixed(sp({})));
  check("…all three Remote = remote mode, nothing here", M.remoteWhere(sp({ image: true, video: true, music: true })) && !M.mixed(sp({ image: true, video: true, music: true })));
  check("…before the types were set one by one (no per) - as before; Local on Basic Settings = local", M.remoteWhere({ where: "remote" }) && !M.remoteWhere({ where: "local", per: true, image: true }) && !M.mixed({ where: "remote" }));
  const R = require("../lib/remoteModels");
  const m = R.mergeComfy({ ok: true, categories: { checkpoints: { files: [{ name: "Krea2\\Ultra.safetensors" }] }, loras: { files: [] } }, warnings: [] },
    { categories: { checkpoints: { files: [{ name: "Krea2/Ultra.safetensors", remote: true }, { name: "krea2_nsfw-aio-2.safetensors", remote: true }] }, loras: { files: [{ name: "B.safetensors", remote: true }] } } });
  check("mixed: this computer's models AND the remote ones (a name both have once), said so", m.mixed && m.categories.checkpoints.files.length === 2 && m.categories.checkpoints.files[1].remote && m.categories.loras.files[0].name === "B.safetensors" && /both listed/.test(m.warnings[0]), m.categories);
  const RT = rd("routes/remoteModels.js"), MS = rd("lib/modeSwitch.js");
  check("/api/comfymodels when mixed: this computer's answer with the remote models merged in; a Local type keeps / starts ComfyUI here",
    /res\.json = \(j\) => json\(RM\.mergeComfy\(j, remoteList\)\)/.test(RT) && /req\.query\.local = "1"/.test(RT) && /if \(mode === "local" \|\| mix\)/.test(MS));
  const PV = require("../lib/podVram").PY.join("\n");
  check("a pod's ComfyUI: --highvram too when it knows it (the text encoder + VAE stay on the card; ComfyUI unloads what does not fit)", /if _knows\(comfy_dir, '--highvram'\): out\.append\('--highvram'\)/.test(PV) && require("../lib/podVram").OURS.includes("--highvram"));
  const GS = rd("static/gpusplit.js"), RG = rd("static/remotegpu.js");
  check("the docker has no RunPod ▸ Serverless / Pods row; Settings ▸ Remote generation has RunPod renders on: Pods / Serverless",
    !/\["gpuRunpod", "RunPod", \[\["serverless"/.test(GS) && /name="rgEng" value="pods"/.test(RG) && /name="rgEng" value="serverless"/.test(RG) && /post\("\/api\/gpusplit", \{ engine: \{ provider: "runpod", runpod: r\.value \} \}\)/.test(RG));
  // floatz in jsdom
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><body><div id="custom" class="h3fp dg-app" style="position:fixed"></div><div id="comm" class="secfloat df-float" style="position:fixed;display:none"></div></body>', { pretendToBeVisual: true, runScripts: "outside-only" });
  const W = dom.window, D = W.document, z = (id) => +D.getElementById(id).style.zIndex || 0, tick = () => new Promise((ok) => setTimeout(ok, 120));
  W.eval(rd("static/floatz.js"));
  await tick();
  D.getElementById("custom").dispatchEvent(new W.Event("pointerdown", { bubbles: true }));
  const nd = D.createElement("div"); nd.id = "floated"; nd.className = "h3fp"; D.body.appendChild(nd); await tick();
  nd.classList.add("dg-app"); nd.style.position = "fixed"; await tick();
  check("a docker just floated comes in front of the ▣ docker pressed before (no press needed)", z("floated") > z("custom"), { floated: z("floated"), custom: z("custom") });
  const n2 = D.createElement("div"); n2.id = "made"; n2.className = "h3fp dg-app"; n2.style.position = "fixed"; D.body.appendChild(n2); await tick();
  check("…a new floating docker made comes in front too", z("made") > z("floated"), { made: z("made"), floated: z("floated") });
  D.getElementById("comm").style.display = ""; await tick();
  check("…a floating dialog shown again (💬 Community) comes in front of them all", z("comm") > z("made"), { comm: z("comm"), made: z("made") });
  D.getElementById("floated").dispatchEvent(new W.Event("pointerdown", { bubbles: true }));
  check("…pressing still raises (the floating dialogs stay above the dockers)", z("floated") > z("made") && z("comm") > z("floated"));
  W.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

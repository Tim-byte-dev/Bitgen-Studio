// bitGen Studio 2.901.0 - the bitGen pod is THE pod (Tim: "can we use this template as our template in bitgen instead of the
// current one - 3 minute startup is much better"): no template of ours found = the pod made from the bitGen pod IMAGE itself
// (RunPod v2 takes `image` in place of templateId), presets / recipes with no template = the bitGen pod, rgpu.bitgen_image =
// false = the old way. Run: node scripts/test-901.js
"use strict";
let ok = 0, fail = 0;
const check = (n, c, x) => { if (c) { ok++; console.log("ok   ", n); } else { fail++; console.log("FAIL ", n, x === undefined ? "" : JSON.stringify(x)); } };
let CFG = { rgpu: { runpod: { key: "k" } } };
require.cache[require.resolve("../lib/core")] = { id: "core", filename: require.resolve("../lib/core"), loaded: true, exports: { getConfig: () => CFG, setConfig: (c) => { CFG = c; } } };
let OWN = [], MADE = null;
const A = require("../lib/runpodApi");
A.myTemplates = async () => OWN;
A.template = async () => { const e = new Error("no"); e.status = 404; throw e; };
A.templates = async (src) => src === "official" ? [{ id: "pt", name: "PyTorch", image: "runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404", source: "official" }] : [];
A.createPod = async (body) => { MADE = body; return { id: "pod9", name: body.name }; };
require("../lib/podModels").setJupyter = () => {};
const PI = require("../lib/podImage"), P = require("../lib/pods");
const fs = require("fs"), path = require("path"), R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

(async () => {
  const iv = PI.imageView();
  check("imageView: no template id, the image :latest, made like a blank pod (install, CUDA 12.8, 8188 / 8888 / 22)",
    iv.id === "" && iv.image === "ghcr.io/tim-byte-dev/bitgen-pod:latest" && iv.install && iv.cuda === "12.8" && iv.source === "image" && iv.ports.includes("8188/http"), iv);
  // createBody
  const b = P.createBody({ image: iv.image, gpu: "NVIDIA GeForce RTX 4090", jupyter: "pw", install: true });
  check("createBody: the image sent in place of a template (RunPod v2 'image is required unless templateId is set')", b.image === iv.image && !("templateId" in b), b);
  check("createBody: an image pod always opens ComfyUI, Jupyter and SSH (no template brings ports)", ["8188/http", "8888/http", "22/tcp"].every((p) => b.ports.includes(p)), b.ports);
  check("createBody: BITGEN_MADE + bitGen's Jupyter password", b.env.BITGEN_MADE === "1" && b.env.JUPYTER_PASSWORD === "pw");
  let refused = ""; try { P.createBody({ image: "someone/else:1", gpu: "x" }); } catch (e) { refused = e.message; }
  check("createBody: any OTHER image without a template is refused", /only the bitGen pod image/.test(refused), refused);
  refused = ""; try { P.createBody({ gpu: "x" }); } catch (e) { refused = e.message; }
  check("createBody: neither = said as before", /no template was picked/.test(refused), refused);
  const bt = P.createBody({ templateId: "tim1", gpu: "x" });
  check("createBody: a template id still sent as before (no image)", bt.templateId === "tim1" && !("image" in bt));
  // create with nothing named = the image pod
  PI.forget();
  const t = await P.bitgenTemplate();
  check("bitgenTemplate: no template of ours = the image pod", t.id === "" && t.source === "image", t);
  const made = await P.create({ gpu: "NVIDIA GeForce RTX 4090", count: 1, cloud: "SECURE", disk: 50, volume: 50 });
  check("create: made from the image", MADE && MADE.image === iv.image && !MADE.templateId, MADE);
  check("…bitGen's install job (finds everything there) + a CUDA 12.8 host", MADE && (MADE.gpu || {}).minCudaVersion === "12.8" && ((CFG.rgpu.pod_made || {}).pod9 || {}).install === true, [MADE, CFG.rgpu.pod_made]);
  check("…ports for ComfyUI / Jupyter / SSH", MADE && ["8188/http", "8888/http", "22/tcp"].every((p) => MADE.ports.includes(p)));
  // a template in the account wins (Tim's creator credits)
  OWN = [{ id: "tim1", name: "bitGen Studio pod", imageName: "ghcr.io/tim-byte-dev/bitgen-pod:latest", ports: ["8188/http", "8888/http", "22/tcp"] }]; PI.forget(); MADE = null;
  await P.create({ gpu: "NVIDIA GeForce RTX 4090" });
  check("create: a bitGen pod TEMPLATE is still used first when there is one", MADE && MADE.templateId === "tim1" && !MADE.image, MADE);
  // the old way on request
  OWN = []; PI.forget(); CFG.rgpu.bitgen_image = false; MADE = null;
  await P.create({ gpu: "NVIDIA GeForce RTX 4090" });
  check("rgpu.bitgen_image = false: RunPod's PyTorch template, bitGen installing ComfyUI", MADE && MADE.templateId === "pt", MADE);
  delete CFG.rgpu.bitgen_image; PI.forget();
  // presets / recipes with no template
  check("a preset with no template is no longer refused (= the bitGen pod)", !/the preset has no template/.test(R("lib/podPresets.js")));
  check("stylePods: the bitGen pod first, its CUDA used", /require\("\.\/podImage"\)\.find\(\)/.test(R("lib/stylePods.js")) && /t\.cuda \|\| PI\.cudaOf/.test(R("lib/stylePods.js")));
  console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

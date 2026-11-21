// bitGen Studio 2.900.0 - the bitGen pod template (lib/podImage.js): found by its image, picked before RunPod's PyTorch template,
// and a pod made from it gets bitGen's install job (which finds everything there). The image's own scripts run for real
// against stand-ins in scripts/test-podimage900.py; GitHub builds the image (.github/workflows/pod-image.yml).
// Run: node scripts/test-900.js
"use strict";
const fs = require("fs"), path = require("path");
let ok = 0, fail = 0;
const check = (n, c, x) => { if (c) { ok++; console.log("ok   ", n); } else { fail++; console.log("FAIL ", n, x === undefined ? "" : JSON.stringify(x)); } };

let CFG = { rgpu: { runpod: { key: "k" } } };
require.cache[require.resolve("../lib/core")] = { id: "core", filename: require.resolve("../lib/core"), loaded: true, exports: { getConfig: () => CFG, setConfig: (c) => { CFG = c; } } };
const calls = [];
let OWN = [], BYID = {}, CAT = [], MADE = null;
const A = require("../lib/runpodApi");
A.myTemplates = async () => { calls.push("own"); return OWN; };
A.template = async (id) => { calls.push("id:" + id); if (!BYID[id]) { const e = new Error("RunPod does not know it"); e.status = 404; throw e; } return BYID[id]; };
A.templates = async (src) => { calls.push("cat:" + src); return CAT.filter((t) => (t.source || "community") === src); };
A.gpus = async () => [];
A.createPod = async (body) => { MADE = body; return { id: "pod1", name: body.name }; };
const PI = require("../lib/podImage"), P = require("../lib/pods");

(async () => {
  // ---- pure
  check("the image: ghcr.io/tim-byte-dev/bitgen-pod", PI.IMAGE === "ghcr.io/tim-byte-dev/bitgen-pod");
  check("isOurs: the image with a tag, a digest, none, any case", ["ghcr.io/tim-byte-dev/bitgen-pod:latest", "ghcr.io/tim-byte-dev/bitgen-pod@sha256:ab", "ghcr.io/Tim-byte-dev/bitgen-pod", "ghcr.io/tim-byte-dev/bitgen-pod:20261121"].every((i) => PI.isOurs({ image: i })));
  check("isOurs: RunPod's own fields (imageName)", PI.isOurs({ imageName: "ghcr.io/tim-byte-dev/bitgen-pod:latest" }));
  check("isOurs: not another image", !["runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404", "ghcr.io/tim-byte-dev/bitgen-pod-x:1", "ghcr.io/someone/bitgen-pod:latest", "x/ghcr.io/tim-byte-dev/bitgen-pod", ""].some((i) => PI.isOurs({ image: i })) && !PI.isOurs(null));
  const v = PI.view({ id: "abc", name: "bitGen Studio pod", imageName: "ghcr.io/tim-byte-dev/bitgen-pod:latest", ports: "8188/http,8888/http", containerDiskInGb: 30 }, "own");
  check("view: made like a blank pod (install, not 'a ComfyUI template')", v.install === true && v.comfy === false && v.ours === true, v);
  check("view: CUDA 12.8 (the image's base)", v.cuda === "12.8");
  check("view: ComfyUI 8188, Jupyter 8888, SSH 22 - each once", JSON.stringify(v.ports) === JSON.stringify(["8188/http", "8888/http", "22/tcp"]), v.ports);
  check("view: at least 50 GB of container disk", v.disk === 50 && PI.view({ disk: 80, image: PI.IMAGE }).disk === 80);
  const T = (id, image, extra) => Object.assign({ id, name: id, image }, extra || {});
  const ours = (id) => T(id, PI.IMAGE + ":latest");
  check("pick: nothing of ours = null (RunPod's PyTorch template then)", PI.pick({ own: [T("a", "runpod/pytorch:2.8")], catalog: [T("b", "runpod/comfyui:1")] }) === null);
  check("pick: the account's own template made from the image", (PI.pick({ own: [T("a", "x/y"), ours("mine")] }) || {}).id === "mine");
  check("pick: a public one when the account has none", (PI.pick({ catalog: [Object.assign(ours("pub"), { source: "community" })] }) || {}).source === "community");
  check("pick: the account's own before a public one", PI.pick({ own: [ours("mine")], catalog: [ours("pub")] }).id === "mine");
  check("pick: the one set by hand first", PI.pick({ configured: "set1", byId: [ours("set1")], own: [ours("mine")] }).id === "set1");
  check("pick: the published one before the account's own", PI.pick({ published: "pub1", byId: [ours("pub1")], own: [ours("mine")] }).id === "pub1");
  check("pick: an id set by hand that is NOT our image is passed over", PI.pick({ configured: "bad", byId: [T("bad", "runpod/pytorch:2.8")], own: [ours("mine")] }).id === "mine");

  // ---- live: find
  CAT = [T("pt", "runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404", { source: "official" })];
  check("find: no template of ours anywhere = the image itself (2.901.0)", ((await PI.find({ refresh: true })) || {}).source === "image");
  check("…it asked RunPod for the account's own templates and the public lists", calls.includes("own") && calls.some((c) => c.startsWith("cat:")), calls);
  OWN = [{ id: "tim1", name: "bitGen Studio pod", imageName: "ghcr.io/tim-byte-dev/bitgen-pod:latest", ports: ["8188/http", "8888/http", "22/tcp"] }];
  check("find: cached for 10 minutes (no new answer without refresh)", ((await PI.find()) || {}).source === "image");
  PI.forget();
  const f1 = await PI.find();
  check("find: the account's own template (Tim makes it on runpod.io - nothing to type into bitGen)", f1 && f1.id === "tim1" && f1.source === "own", f1);
  CFG.rgpu.bitgen_template = "set9"; BYID.set9 = { name: "mine too", image: PI.IMAGE + ":20261121" };
  calls.length = 0;
  const f2 = await PI.find({ refresh: true });
  check("find: rgpu.bitgen_template asked for by its id (a public template not in RunPod's lists)", calls.includes("id:set9") && f2.id === "set9", [calls, f2]);
  CFG.rgpu.bitgen_template = "nope";
  check("find: an id RunPod does not know is passed over", (await PI.find({ refresh: true })).id === "tim1");
  delete CFG.rgpu.bitgen_template;
  A.myTemplates = async () => { throw Object.assign(new Error("RunPod refused the API key"), { status: 401 }); };
  check("find: RunPod refusing a list = that list passed over (no error)", ((await PI.find({ refresh: true })) || {}).source === "image");
  A.myTemplates = async () => { calls.push("own"); return OWN; };

  // ---- live: lib/pods.js uses it
  PI.forget();
  const bt = await P.bitgenTemplate();
  check("bitgenTemplate: the bitGen pod template before RunPod's PyTorch one", bt.id === "tim1" && bt.install === true && bt.cuda === "12.8", bt);
  OWN = []; PI.forget(); CFG.rgpu.bitgen_image = false;
  const bt2 = await P.bitgenTemplate();
  check("bitgenTemplate: rgpu.bitgen_image = false - RunPod's PyTorch template as before", bt2.id === "pt" && bt2.install === true, bt2);
  delete CFG.rgpu.bitgen_image;
  OWN = [{ id: "tim1", name: "bitGen Studio pod", imageName: "ghcr.io/tim-byte-dev/bitgen-pod:latest", ports: ["8188/http", "8888/http", "22/tcp"] }]; PI.forget();
  require("../lib/podModels").setJupyter = () => {};
  const made = await P.create({ gpu: "NVIDIA GeForce RTX 4090", count: 1, cloud: "SECURE", disk: 50, volume: 50 });
  check("create (no template named): made from the bitGen pod template", MADE && MADE.templateId === "tim1", MADE);
  check("…with ComfyUI's port, Jupyter's and SSH open", MADE && ["8188/http", "8888/http", "22/tcp"].every((p) => (MADE.ports || []).includes(p)), MADE && MADE.ports);
  check("…marked for bitGen's install job (it finds everything there, then starts ComfyUI)", made && (made.install === true || (made.pod && made.pod.install === true) || ((CFG.rgpu.pod_made || {}).pod1 || {}).install === true), [made, CFG.rgpu.pod_made]);
  check("…BITGEN_MADE=1: the image's post_start leaves ComfyUI's start to bitGen", MADE && MADE.env && MADE.env.BITGEN_MADE === "1");
  check("…on a host whose driver runs CUDA 12.8", MADE && (MADE.gpu || {}).minCudaVersion === "12.8", MADE);

  // ---- the image's scripts agree with bitGen (static)
  const R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
  const bake = R("misc/pod-image/bake.sh"), post = R("misc/pod-image/post_start.sh"), inst = R("lib/podInstall.js"), vram = R("lib/podVram.js");
  check("bake.sh writes podInstall's markers", [".bitgen_pip_ok", ".bitgen_install.json", "\"by\": \"bitGen\"", "--system-site-packages"].every((s) => bake.includes(s)) && inst.includes(".bitgen_pip_ok") && inst.includes("'by': 'bitGen'"));
  check("post_start.sh: podInstall's arguments and log", post.includes("--listen 0.0.0.0 --port \"$PORT\"") && post.includes(".bitgen_comfy.log") && inst.includes("'--listen', '0.0.0.0', '--port'"));
  check("post_start.sh: the GPU-memory flags podVram knows", ["--disable-dynamic-vram", "--highvram"].every((f) => post.includes(f) && (vram.includes(f) || inst.includes(f))));
  check("post_start.sh: BITGEN_MADE is the variable lib/pods.js sets", post.includes("BITGEN_MADE") && R("lib/pods.js").includes("BITGEN_MADE: \"1\""));
  check("routes untouched: GET /api/pods/bitgen-template still answers from bitgenTemplate", R("routes/pods.js").includes("P.bitgenTemplate()"));
  check("server.js not touched by this", !R("misc/server.js").includes("podImage"));

  console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

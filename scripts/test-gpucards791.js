#!/usr/bin/env node
/* bitGen Studio — 2.791.0 units: local multi-GPU - ☁ Runs on ▸ "Local - <card>" (lib/remoteHosts.js), one ComfyUI per picked card
 * (lib/gpuCards.js), the job's ComfyUI address (lib/gpuSplit.js forJob), the queue's gate (lib/core.js). Pure + source pins - no
 * studio, no graphics card. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const GC = require("../lib/gpuCards"), RH = require("../lib/remoteHosts");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const cards = GC.cardsFrom([{ name: "NVIDIA GeForce RTX 5090", mem_total: 32607 }, { name: "NVIDIA GeForce RTX 3090", mem_total: 24576 }]);
check("cardsFrom: index (nvidia-smi order), name, VRAM", cards.length === 2 && cards[1].index === 1 && cards[1].name === "NVIDIA GeForce RTX 3090" && cards[1].vram_mb === 24576);
check("labelOf: Local - <name> (GPU N, GB)", GC.labelOf(cards[1]) === "Local - NVIDIA GeForce RTX 3090 (GPU 1, 24 GB)", GC.labelOf(cards[1]));
check("portFor: 8189 + the card (8188 stays the main ComfyUI)", GC.portFor(0) === 8189 && GC.portFor(1) === 8190);
const L = GC.argsFor({ cmd: "/c/python_embeded/python.exe", args: ["-s", "/c/ComfyUI/main.py", "--windows-standalone-build"], cwd: "/c", how: "portable" }, 1);
check("argsFor: the main launcher's python + main.py + --port + --cuda-device", L.cmd === "/c/python_embeded/python.exe" && L.args.join(" ") === "-s /c/ComfyUI/main.py --windows-standalone-build --port 8190 --cuda-device 1" && L.cwd === "/c", L);
check("argsFor: a custom launch command / a .bat launcher cannot take a card (said), none = said", /custom launch command/.test(GC.argsFor({ shellCmd: "x", how: "custom" }, 1).error) && /cannot give that a card/.test(GC.argsFor({ cmd: "cmd", args: ["run_nvidia_gpu.bat"], how: "run_nvidia_gpu.bat" }, 0).error) && /no ComfyUI launcher/.test(GC.argsFor(null, 0).error));
check("pickOf: rgpu.local_cards per kind", GC.pickOf({ local_cards: { image: 1 } }, "image") === 1 && GC.pickOf({ local_cards: { image: 1 } }, "video") === null && GC.pickOf({}, "image") === null && GC.pickOf({ local_cards: { image: -1 } }, "image") === null);

// Runs on
const o1 = RH.optionsFor("image", cards).map((x) => x.id), o2 = RH.optionsFor("tts", cards).map((x) => x.id), o3 = RH.optionsFor("image", cards.slice(0, 1)).map((x) => x.id);
check("Runs on: Image / Video / Music (and since 2.794.0 speech + the LLMs) get Local - <card> right after Local (2+ cards); one card / no list = as before", o1.join() === "local,local:0,local:1,runpod,openrouter,lan,team" && o2.join() === "local,local:0,local:1,runpod,openrouter,lan,team" && o3.join() === "local,runpod,openrouter,lan,team" && RH.optionsFor("video").length === 5, { o1, o2, o3 });
const H = RH.hostsOf({ local_cards: { image: 1, music: 0 } }, { where: "local" }, {}, () => "", {});
check("hostsOf: a kind with a card = local:<N>", H.image === "local:1" && H.music === "local:0" && H.video === "local" && H.tts === "local", H);
check("whereFor: a card is local (nothing remote = local)", RH.whereFor({ image: "local:1", video: "local" }) === "local" && RH.whereFor({ image: "local:1", video: "runpod" }) === "both");
const Hr = RH.hostsOf({ local_cards: { image: 1 } }, { where: "both", per: { image: true } }, {}, () => "", {});
check("hostsOf: a kind sent to RunPod is RunPod whatever its card", Hr.image === "runpod" || Hr.image === "local:1", Hr);

// wiring
const C = src("lib/core.js"), G = src("lib/gpuSplit.js"), R = src("lib/remoteHosts.js"), RI = src("routes/index.js"), CF = src("lib/comfy.js"), GCs = src("lib/gpuCards.js");
check("core.js: the card's gate before a local job (not a pod / API job), wait / fail with why / params.gpu_card", /require\("\.\/gpuCards"\)\.gate\(p0\)/.test(C) && /!p0\.pod_job && !\(s0 && s0\.runs_on === "pod"\) && !isApiJob\(p0\)/.test(C) && /p0\.gpu_card = \{ card: cg\.card, url: cg\.url \}/.test(C) && /the graphics card ☁ Runs on picked for it could not be used/.test(C));
check("gpuSplit.forJob: params.gpu_card = that ComfyUI's address, no autostart of the main one", /const gc = params && params\.gpu_card;/.test(G) && /url: gc\.url, autostart: false/.test(G));
check("remoteHosts.set: local:<N> = Local + the card (gpuCards.setPick), any other choice forgets it", /picks\[k\] = \+host\.split\(":"\)\[1\]; want\[k\] = "local";/.test(R) && /GC\.setPick\(k, picks\[k\]\)/.test(R));
check("the card's ComfyUI: CUDA_DEVICE_ORDER=PCI_BUS_ID (N = the card the list shows), its own log, stopped on exit", /CUDA_DEVICE_ORDER: "PCI_BUS_ID"/.test(GCs) && /comfyui-gpu" \+ n \+ "\.log"/.test(GCs) && /process\.once\("exit", stopAll\)/.test(GCs));
check("comfy.js exports detectLaunch; routes mount gpuCards", /module\.exports = \{ detectLaunch,/.test(CF) && /require\("\.\/gpuCards"\)\.mount\(app\)/.test(RI));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

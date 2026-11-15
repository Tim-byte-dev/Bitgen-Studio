#!/usr/bin/env node
/* bitGen Studio — 2.784.0: THE CREATE POD GPU LIST'S FASTEST / CHEAPEST ORDER (static/gpuspeed.js, lib/pods.js gpuView speed,
 * static/podsdock.js). Tim (verbatim): "add a sort order to the top of the gpu selection list in create new pod, by fastest, by
 * cheapest". Pure + source checks (no server).
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } }
const G = require("../static/gpuspeed.js");
const sp = (n) => G.speedOf(n);
check("the order of RunPod's names: B200 > H200 > H100 SXM (HBM3) > H100 NVL > H100 PCIe > RTX PRO 6000 > RTX 5090 > L40S > RTX 6000 Ada > RTX 4090 = A100 SXM > A100 PCIe = L40 > RTX A6000 > A40 > L4 > T4",
  [sp("NVIDIA B200"), sp("NVIDIA H200"), sp("NVIDIA H100 80GB HBM3"), sp("NVIDIA H100 NVL"), sp("NVIDIA H100 PCIe"), sp("NVIDIA RTX PRO 6000 Blackwell Server Edition"), sp("NVIDIA GeForce RTX 5090"),
    sp("NVIDIA L40S"), sp("NVIDIA RTX 6000 Ada Generation"), sp("NVIDIA GeForce RTX 4090"), sp("NVIDIA A100-SXM4-80GB"), sp("NVIDIA A100 80GB PCIe"), sp("NVIDIA L40"), sp("NVIDIA RTX A6000"), sp("NVIDIA A40"), sp("NVIDIA L4"), sp("Tesla T4")]
    .join() === "260,190,180,160,140,115,100,85,80,75,75,65,65,45,40,25,8");
check("Tim's numbers: the RTX A6000 at under half a 5090 (he measured ~2.2x the time)", sp("NVIDIA RTX A6000") / sp("NVIDIA GeForce RTX 5090") < 0.5);
check("L40 is not L40S, L4 is not L40; an unknown card = 0", sp("NVIDIA L40") !== sp("NVIDIA L40S") && sp("NVIDIA L4") !== sp("NVIDIA L40") && sp("AMD Instinct MI300X OAM") === 0);
check("speedText: ~1× / ~0.45× / speed not known", G.speedText(100) === "~1× RTX 5090" && G.speedText(45) === "~0.45× RTX 5090" && G.speedText(0) === "speed not known");
const L = [{ id: "a6000", name: "RTX A6000", price: 0.49, offered: true, memory: 48, speed: 45 }, { id: "5090", name: "RTX 5090", price: 0.89, offered: true, memory: 32, speed: 100 },
  { id: "h100", name: "H100", price: 2.99, offered: false, memory: 80, speed: 180 }, { id: "a4000", name: "RTX A4000", price: 0.17, offered: true, memory: 16, speed: 20 },
  { id: "x", name: "Mystery", price: 0.3, offered: true, memory: 24, speed: 0 }, { id: "l40s", name: "L40S", price: 0.89, offered: true, memory: 48, speed: 85 }];
check("Fastest: offered first, fastest first, a tie by price (none free last)", G.sortGpus(L, "fast").map((g) => g.id).join() === "5090,l40s,a6000,a4000,x,h100", G.sortGpus(L, "fast").map((g) => g.id));
check("Cheapest: offered first, cheapest first, a tie by speed", G.sortGpus(L, "cheap").map((g) => g.id).join() === "a4000,x,a6000,5090,l40s,h100", G.sortGpus(L, "cheap").map((g) => g.id));
check("sortGpus leaves the list as it was (a new array)", L[0].id === "a6000");
check("pick: Fastest = the fastest one free with 20 GB+, Cheapest = the cheapest one free with 20 GB+", G.pick(L, "fast").id === "5090" && G.pick(L, "cheap").id === "x");
const P = require("../lib/pods.js");
check("lib/pods.js: every GPU carries its speed (gpuView)", /speed: require\("\.\.\/static\/gpuspeed\.js"\)\.speedOf\(/.test(fs.readFileSync(path.join(ROOT, "lib/pods.js"), "utf8")) && typeof P.gpus === "function");
const D = fs.readFileSync(path.join(ROOT, "static/podsdock.js"), "utf8"), H = fs.readFileSync(path.join(ROOT, "static/index.html"), "utf8");
check("podsdock: Sort GPUs (Fastest / Cheapest) above the GPU list, remembered, the list ordered by it with each card's speed",
  D.indexOf('id="pdGpuSort"') > 0 && D.indexOf('id="pdGpuSort"') < D.indexOf('<select id="pdGpu">') && /h3\.pod\.gpuSort/.test(D) && /GS\.sortGpus\(list0, by\)/.test(D) && /GS\.speedText\(g\.speed\)/.test(D));
check("index.html loads gpuspeed.js before podsdock.js", H.indexOf("/static/gpuspeed.js") > 0 && H.indexOf("/static/gpuspeed.js") < H.indexOf("/static/podsdock.js"));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);

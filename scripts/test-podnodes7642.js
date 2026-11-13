#!/usr/bin/env node
/* bitGen Studio — 2.764.2 units: ONLY THE CUSTOM NODES THE WORKFLOWS USE GO ON A POD (lib/podPrep.js, lib/podNodes.js,
 * lib/stylePods.js, lib/podPresets.js, routes/stylePods.js, static/podsetup.js).
 * Tim (verbatim): "only upload nodes that are necessary for the workflows we are using to the pod" + "[pod] uploading
 * ComfyUI-H3-NativeAudioLock - 0 MB to the pod" (a small pack said "0 MB"; the install step after it said nothing). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const PP = require("../lib/podPrep");

(async () => {
  process.env.H3_POD_REVIVE_POLL = "1";
  // a Krea workflow: core nodes + one custom node (KJNodes' ImageResizeKJ); the pod has the core ones only.
  // This computer has many packs (NativeAudioLock among them) - only KJNodes may go.
  const mirrored = [], said = [];
  let files = 0;
  const D = {
    ways: async () => ({ pod_id: "p", jupyter: true, manager: true, comfy_dir: "/w/ComfyUI", jupyter_url: "j", comfy_url: "c" }),
    contents: async () => { files++; return { models: { diffusion_models: ["krea.safetensors"] } }; },
    download: async () => ({ started: 0 }), state: async () => ({ running: false, files: [] }),
    send: async () => ({}), local: () => null, kernel: async () => "", nodeState: async () => null, reboot: async () => true,
    objectInfo: async () => ({ UNETLoader: {}, KSampler: {}, VAEDecode: {}, SaveImage: {} }),
    catalog: () => ({ models: [] }), packs: () => [],
    graph: () => ({}), classesOf: () => ["UNETLoader", "KSampler", "VAEDecode", "SaveImage", "ImageResizeKJ"],
    needs: () => [{ name: "krea.safetensors", cat: "diffusion_models" }], cfg: () => ({}),
    localFolders: async (classes) => ({ folders: classes.includes("ImageResizeKJ") ? ["ComfyUI-KJNodes"] : [], rest: classes.filter((c) => c !== "ImageResizeKJ") }),
    mirror: async (pod, port, folders) => { mirrored.push(folders.slice()); return { done: folders, there: [], failed: [] }; },
    sleep: async () => {},
  };
  const r = await PP.prepare("p", 8188, [{ id: "k", name: "Krea Raw", kind: "image", workflow: "w.json" }], { deps: D, say: (t) => said.push(t) });
  check("a style's workflow uses one custom node the pod lacks: ONLY its pack goes (ComfyUI-KJNodes) - not every pack of this computer", mirrored.length === 1 && mirrored[0].join() === "ComfyUI-KJNodes" && !r.notThere.length, { mirrored, r });
  mirrored.length = 0; said.length = 0;
  D.objectInfo = async () => ({ UNETLoader: {}, KSampler: {}, VAEDecode: {}, SaveImage: {}, ImageResizeKJ: {} });
  await PP.prepare("p", 8188, [{ id: "k", name: "Krea Raw", kind: "image", workflow: "w.json" }], { deps: D, say: (t) => said.push(t) });
  check("…the pod has every node the workflow uses: nothing uploaded, and the log says so", mirrored.length === 0 && said.includes("the pod has every node these workflows use"), said);
  // ⬆ Nodes its styles need: the node packs only (no model files looked at)
  files = 0; mirrored.length = 0;
  D.objectInfo = async () => ({ UNETLoader: {} });
  const r2 = await PP.prepare("p", 8188, [{ id: "k", name: "Krea Raw", kind: "image", workflow: "w.json" }], { deps: D, nodesOnly: true });
  check("nodesOnly (My pods ▸ ⬆ Nodes its styles need): the packs its workflows use, no model files", mirrored.length === 1 && files === 0 && r2.done.join() === "Krea Raw", { mirrored, files, r2 });

  const PN = require("../lib/podNodes"), PNs = rd("lib", "podNodes.js");
  check("a small pack says KB, not \"0 MB\" (a 40 KB node pack)", PN.sizeText(40 * 1024) === "40 KB" && PN.sizeText(10) === "1 KB" && PN.sizeText(5 * 1048576) === "5 MB" && PN.sizeText(250 * 1048576) === "250 MB");
  check("after the upload every step speaks: on the pod -> asking the pod to unpack and install -> installing <pack> (n of m done, s) / waiting for the pod to report",
    /say\(k\.folder \+ " is on the pod \(" \+ mb\(buf\.length\) \+ "\)"\)/.test(PNs) && /"unpack and install " \+ names/.test(PNs) && /"installing " : "next: "\) \+ cur\.id \+ " on the pod \("/.test(PNs) && /say\("waiting for the pod to report on " \+ names\)/.test(PNs));
  check("…its status unreadable for 3 minutes (H3_POD_NODES_BLIND) = it ends with the reason, not hours of silence", /H3_POD_NODES_BLIND \|\| 180000/.test(PNs) && /did not say how installing " \+ names \+ " went/.test(PNs));
  const SP = rd("lib", "stylePods.js"), PO = rd("lib", "pods.js"), PR = rd("lib", "podPresets.js"), RT = rd("routes", "stylePods.js"), PSU = rd("static", "podsetup.js"), PD = rd("static", "podsdock.js");
  check("no pod gets EVERY custom node any more: not a pod made for a style, not a preset's ▶, not stylePods.ready", !/require\("\.\/podNodes"\)\.mirror\(id, port, \{ say/.test(SP) && !/SP\.nodesTodo\(p\.id, true\)/.test(PO) && !/nodesTodo\(made\.pod\.id, true\)/.test(SP) && !/podNodes"\)\.mirror\(id, p\.port/.test(PR) && !/SP\.nodesTodo\(id, true\)/.test(PR));
  check("the pod's styles' nodes (podPrep nodesOnly) - none linked = it says to put a style on first; 2.777.0: no ⬆ Nodes its styles need button (the pod's setup does it)", /prepare\(pod, port, sts, \{ nodesOnly: true \}\)/.test(RT) && /the pod has no styles yet/.test(RT) && !/data-psnodes/.test(PSU));
  check("the summary before Create pod: the custom nodes the style's workflows use (not \"this computer's custom nodes (N)\")", /"the custom nodes " \+ sty\.name \+ "'s workflows use"/.test(PD) && !/this computer's custom nodes" \+ \(S\.nodesN/.test(PD));
  check("a preset's loading sequence: each style's nodes and files (no separate every-node step)", /label: n \+ ": its nodes and files"/.test(PR) && !/id: "nodes", label: "Your custom nodes"/.test(PR));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

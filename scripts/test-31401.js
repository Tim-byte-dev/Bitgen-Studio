#!/usr/bin/env node
/* bitGen Studio — 3.14.1: a video style whose ComfyUI graph is converted from its UI export (MMH3_NativeAudio_MV) gets it
 * converted before its job runs (lib/styleConvert.js, asked by lib/core.js pump()) - not only from the scene board.
 * Tim's log: "[worker] video style "MMH3_NativeAudio_MV": workflow for ref2va not found:
 * E:\Bitgen-Studio\comfy_workflows\MMH3_NativeAudio_MV.json" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const SC = require(path.join(ROOT, "lib/styleConvert.js"));
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const MV = { name: "MMH3_NativeAudio_MV", workflows: { ref2va: "comfy_workflows/MMH3_NativeAudio_MV.json", fl2va: "comfy_workflows/MMH3_NativeAudio_MV_fl2va.json" } };

(async () => {
  check("needFor: the Native Audio MV style (by the graph file it names) - not a style with a shipped API graph, not a picture job",
    SC.needFor({ video_style: MV }) === "MMH3_NativeAudio_MV" && SC.needFor({ video_style: { workflow: "comfy_workflows/ref2va.json" } }) === null && SC.needFor({ style: {} }) === null);
  const ch = require(path.join(ROOT, "routes/characters.js"));
  check("routes/characters.js hands out the conversion (CONVERT_STYLES, baseIsCurrent, ensureChainBase)", typeof ch.ensureChainBase === "function" && typeof ch.baseIsCurrent === "function" && ch.CONVERT_STYLES.MMH3_NativeAudio_MV.ui === "MMH3_NativeAudio_MV.ui.json");

  // a stand-in for the conversion: not current until converted
  let current = false, calls = 0, started = 0, up = false;
  const K = { CONVERT_STYLES: { MMH3_NativeAudio_MV: { base: "MMH3_NativeAudio_MV.json", ui: "MMH3_NativeAudio_MV.ui.json" } }, baseIsCurrent: () => current,
    ensureChainBase: async () => { calls++; current = true; return { ok: true, converted: true, warnings: [] }; } };
  const comfy = { objectInfo: async () => { if (!up) throw new Error("offline"); return {}; }, ensure: async () => { started++; setTimeout(() => { up = true; }, 50); return {}; } };
  const g1 = SC.gate({ video_style: MV }, { chars: K, comfy, waitMs: 20000 });
  check("not converted yet: the job waits, said in words", g1 && g1.wait > 0 && /made from its export MMH3_NativeAudio_MV\.ui\.json first/.test(g1.note), g1);
  check("…asked again while it converts: still waiting", (SC.gate({ video_style: MV }, { chars: K, comfy }) || {}).wait > 0);
  for (let i = 0; i < 40 && !current; i++) await sleep(250);
  const g2 = SC.gate({ video_style: MV }, { chars: K, comfy });
  check("ComfyUI was not up: started, then the graph converted once; the job goes, said", started === 1 && calls === 1 && g2 && !g2.wait && !g2.error && /MMH3_NativeAudio_MV\.json made from/.test(g2.note), { started, calls, g2 });
  check("…next time it is current: nothing to do", SC.gate({ video_style: MV }, { chars: K, comfy }) === null);
  current = false;
  const K2 = Object.assign({}, K, { ensureChainBase: async () => ({ ok: false, error: "ComfyUI does not know these node types: MiniMaxH3NativeAudioLock" }) });
  SC.gate({ video_style: MV }, { chars: K2, comfy });
  await sleep(300);
  const g3 = SC.gate({ video_style: MV }, { chars: K2, comfy });
  check("it cannot be converted: the job fails with the reason (the node pack)", g3 && /could not be made from MMH3_NativeAudio_MV\.ui\.json: ComfyUI does not know these node types: MiniMaxH3NativeAudioLock/.test(g3.error), g3);
  const core = fs.readFileSync(path.join(ROOT, "lib/core.js"), "utf8");
  check("lib/core.js pump() asks the gate before a job starts (wait / fail with the reason)", /require\("\.\/styleConvert"\)\.gate\(p0\)/.test(core) && /not rendered - its ComfyUI graph could not be made/.test(core));
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: threw " + (e && e.stack || e)); console.log("RESULT: 1 failed"); process.exit(1); });

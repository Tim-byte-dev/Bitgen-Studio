#!/usr/bin/env node
/* bitGen Studio — 2.773.0: ONLY THE STYLES OF THE MODE YOU ARE IN go on a pod (lib/remotePrep.js kindOfGen / fits / forMode,
 * start() with the Generate mode; lib/podMade.js afterLoad, lib/podSetup.js save) - stubbed config, styles and pod work.
 * Tim (verbatim): "if in any image mode then only upload or check image styles, if in video mode , then only upload/check the
 * video styles" */
"use strict";
const path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
let CFG = { rgpu: { pod_made: {} } };
const STY = { krea: { id: "krea", name: "Krea 2", kind: "image" }, qe: { id: "qe", name: "Qwen Edit", kind: "image" }, h3: { id: "h3", name: "H3 video", kind: "video" }, ace: { id: "ace", name: "ACE song", kind: "music" } };
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: "/x" });
stub("../lib/styles", { byId: (d, id) => { if (!STY[id]) throw new Error("no style"); return STY[id]; } });
const prepared = [];
stub("../lib/podPrep", { prepare: async (pod, port, sts) => { prepared.push(pod + ":" + sts.map((s) => s.name).join("+")); return { problems: [], notThere: [], lacks: [] }; } });
stub("../lib/remoteModels", { podsMode: () => true });
const SP = require("../lib/stylePods");
SP.podFor = (r, st, kind) => ({ pod_id: kind === "video" ? "podV" : "podI" });
const RP = require("../lib/remotePrep");

(async () => {
  check("kindOfGen: 🖼 Image / ⚙ Graph = image; 🎬 Video / 🎶 Music = video; Speech / Chat / nothing = no style",
    RP.kindOfGen("image") === "image" && RP.kindOfGen("graph") === "image" && RP.kindOfGen("video") === "video" && RP.kindOfGen("audio") === "video"
    && RP.kindOfGen("speech") === null && RP.kindOfGen("chat") === null && RP.kindOfGen("") === null);
  check("fits: an image mode takes picture styles (edit ones too), a video mode video + music styles; no mode = all",
    RP.fits(STY.krea, "image") && RP.fits(STY.qe, "image") && !RP.fits(STY.h3, "image") && !RP.fits(STY.ace, "image")
    && RP.fits(STY.h3, "video") && RP.fits(STY.ace, "video") && !RP.fits(STY.krea, "video") && RP.fits(STY.h3, null));
  // the page in 🖼 Image mode with Krea picked: the IMAGE style is made ready, not the video one
  RP.start({ gen_mode: "image", image_style_id: "krea", video_style_id: "h3" });
  await new Promise((r) => setTimeout(r, 20));
  check("start() in 🖼 Image mode: only the picked IMAGE style goes on its pod (not the video style)", prepared.join() === "podI:Krea 2" && RP.MODE.kind === "image" && RP.status().image.style === "Krea 2" && RP.status().mode === "image", { prepared, s: RP.status() });
  prepared.length = 0;
  RP.start({ gen_mode: "video", image_style_id: "krea", video_style_id: "h3" });
  await new Promise((r) => setTimeout(r, 20));
  check("…switched to 🎬 Video: the picked VIDEO style now", prepared.join() === "podV:H3 video" && RP.MODE.kind === "video", prepared);
  prepared.length = 0;
  RP.start({ gen_mode: "chat", image_style_id: "krea", video_style_id: "h3" });
  await new Promise((r) => setTimeout(r, 20));
  check("…💬 Chat / 🗣 Speech: no style at all", prepared.length === 0 && RP.MODE.kind === null);
  prepared.length = 0;
  RP.VIDEO.state = null;
  RP.start({ video_style_id: "h3" });
  await new Promise((r) => setTimeout(r, 20));
  check("an older page (no gen_mode): the video style, as before; the kept mode unchanged", prepared.join() === "podV:H3 video" && RP.MODE.kind === null, prepared);
  // a pod setting itself up / 💾 Save / a preset: only the mode's styles
  RP.MODE.kind = "image";
  const fm = RP.forMode([STY.krea, STY.h3, STY.qe, STY.ace]);
  check("forMode (in Image mode): Krea 2 + Qwen Edit now, the video + song styles later", fm.now.map((s) => s.id).join() === "krea,qe" && fm.later.map((s) => s.id).join() === "h3,ace" && fm.kind === "image");
  RP.MODE.kind = null;
  check("…the page has not said its mode yet: every style now (as before)", RP.forMode([STY.krea, STY.h3]).now.length === 2);
  RP.MODE.kind = "video";
  CFG.rgpu.pod_made.podM = { port: 8188 };
  const PMd = require("../lib/podMade"), seen = [], notes = [];
  const W = PMd.watch("podM", 8188, { up: async () => true, sleep: async () => {}, installable: () => false,
    autoUpdate: async () => ({ ok: true }), styles: () => [STY.krea, STY.h3, STY.ace], prepare: async (id, port, sts) => { seen.push(sts.map((s) => s.name).join("+")); return { problems: [], notThere: [] }; },
    useIfNone: () => false, forMode: (x) => RP.forMode(x) });
  await W.promise;
  const act = require("../lib/podActivity").view("podM");
  check("a new pod setting itself up in 🎬 Video mode: only H3 video + ACE song made ready; Krea 2 left for Image mode (said on the pod)",
    seen.join() === "H3 video+ACE song" && act.done.some((x) => /left for Image mode: Krea 2/.test(x.text)), { seen, act: act.done.map((x) => x.text) });
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });

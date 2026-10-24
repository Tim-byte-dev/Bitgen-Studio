#!/usr/bin/env node
/* bitGen Studio — 2.503.0 unit tests: MINIMAX H3 LONG VIDEO - one generation up to 30 s (lib/h3Long.js, the planners
 * in lib/framePlan.js / worker.plan_chunks, worker.apply_video_accel's three model patches, the style + ⚙ switches,
 * the planner readout, the board's scene ceiling) + the installer entries for KJNodes / Yusu H3 Unified / RH DLSS 5.
 * Tim: "the secret sauce workflow is meant to be able to do 25 sec video according to the youtube video". */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const py = (code) => execFileSync("python3", ["-c", "import sys,json,copy; sys.path.insert(0, " + JSON.stringify(ROOT) + "); sys.path.insert(0, " + JSON.stringify(require("path").join(ROOT, "misc")) + "); sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8", cwd: ROOT });

const L = require(path.join(ROOT, "lib", "h3Long.js")), F = require(path.join(ROOT, "lib", "framePlan.js"));
check("h3Long.on: a MiniMax H3 (or arch-less) video style with accel.long on; never LTX / Wan / an image style",
  L.on({ kind: "video", arch: "minimax-h3", accel: { long: "on" } }) && L.on({ accel: { long: "on" } }) && !L.on({ kind: "video", arch: "minimax-h3", accel: { long: "off" } })
  && !L.on({ kind: "video", arch: "ltx-2.5", accel: { long: "on" } }) && !L.on({ kind: "image", accel: { long: "on" } }) && !L.on(null));
check("ceilings: 719f (17*42+5 = 29.96 s) on the H3 grid when long, 362 otherwise, sd-cli untouched; a learned VRAM ceiling still caps",
  L.LONG_CEILING === 719 && (719 - 5) % 17 === 0 && L.modelCeiling("17k5", 362, true) === 719 && L.modelCeiling("17k5", 362, false) === 362
  && L.modelCeiling("4n1", 361, true) === 361 && L.ceiling("17k5", 362, true, 260) === 260 && L.ceiling("17k5", 362, true, 0) === 719);
const p25 = F.planChunks(600, 719, "17k5", false, 719), p25n = F.planChunks(600, 362, "17k5", false, 362), p35 = F.planChunks(840, 719, "17k5", false, 719), pOld = F.planChunks(600, 900, "17k5", false, 0);
check("framePlan: 25 s = ONE 600f run with the long ceiling (two chunks without); 35 s = 719 + the rest; no ceiling = the normal 362 still",
  p25.chunks.join() === "600" && p25.fitsSingle && p25n.chunks.length === 2 && p35.chunks[0] === 719 && p35.chunks.length === 2 && pOld.chunks[0] === 362 && F.GRIDS["17k5"].max === 719, { p25, p25n, p35, pOld });
const wp = JSON.parse(py("import worker as W\nprint(json.dumps([W.plan_chunks(600, 719, grid='17k5', ceiling=719)['chunks'], W.plan_chunks(600, 362, grid='17k5', ceiling=362)['chunks'], W.plan_chunks(600, 900, grid='17k5', ceiling=0)['chunks'], W.LONG_SINGLE_RUN_COMFY, W.long_on({'kind':'video','arch':'minimax-h3','accel':{'long':'on'}}), W.long_on({'arch':'wan22','accel':{'long':'on'}})]))"));
check("worker.plan_chunks mirrors it (600 single when long; 2 chunks otherwise); long_on mirrors h3Long.on",
  wp[0].join() === "600" && wp[1].length === 2 && wp[2][0] === 362 && wp[3] === 719 && wp[4] === true && wp[5] === false, wp);

/* ---- the graph: the export's three model patches, in its order */
const G = JSON.parse(py(`import worker as W
from pathlib import Path
FL = json.loads(Path('comfy_workflows/fl2va.json').read_text())
g, n = W.apply_video_accel(copy.deepcopy(FL), {'long': 'on'})
gk, nk = W.apply_video_accel(copy.deepcopy(FL), {'long': 'on', 'kitchen_attn': True, 'sage': 'auto', 'spectrum': 'on'})
g2 = {'1': {'class_type': 'UNETLoader', 'inputs': {}}, '2': {'class_type': 'BasicGuider', 'inputs': {'model': ['1', 0], 'conditioning': ['3', 0]}}, '3': {'class_type': 'CLIPTextEncode', 'inputs': {}}}
gn, nn = W.apply_video_accel(copy.deepcopy(g2), {'long': 'on'})
gd, ok = W.drop_accel_node(copy.deepcopy(gk), 'h3chunkff')
print(json.dumps({'lv': g.get('h3lowvram'), 'ff': g.get('h3chunkff'), 'guider': g['105:16']['inputs']['model'], 'sched': g['105:9']['inputs']['model'], 'be': 'h3attnbe' in g, 'n': n,
  'kbe': gk.get('h3attnbe'), 'klv': gk['h3lowvram']['inputs']['model'], 'ksage': 'h3sage' in gk, 'kspec': gk.get('h3spectrum', {}).get('inputs', {}).get('model'), 'kguider': gk['105:16']['inputs']['model'], 'nk': nk,
  'nonh3': gn == g2, 'nn': nn, 'ids': sorted(W.accel_nodes(gk)), 'drop': [ok, gd.get('h3spectrum', {}).get('inputs', {}).get('model')],
  'hints': all(c in W.ACCEL_INSTALL_HINTS for c in (W.ACCEL_LOWVRAM, W.ACCEL_CHUNKFF, W.ACCEL_ATTN_BACKEND))}))`));
check("Long video: MiniMaxLowVRAMAttention (head_chunks 4) -> MiniMaxChunkFeedForward (chunks 2, seq_threshold 4096) in front of the guider AND the scheduler",
  G.lv && G.lv.class_type === "MiniMaxLowVRAMAttention" && G.lv.inputs.head_chunks === 4 && G.lv.inputs.model[0] === "105:122"
  && G.ff.class_type === "MiniMaxChunkFeedForward" && G.ff.inputs.chunks === 2 && G.ff.inputs.seq_threshold === 4096 && G.ff.inputs.model[0] === "h3lowvram"
  && G.guider[0] === "h3chunkff" && G.sched[0] === "h3chunkff" && !G.be && /Long video/.test(G.n.join()), G);
check("+ comfy kitchen: ModelAttentionBackend 'comfy kitchen attention' first; Sage skipped (said); Spectrum still after the long chain",
  G.kbe && G.kbe.class_type === "ModelAttentionBackend" && G.kbe.inputs.attention === "comfy kitchen attention" && G.klv[0] === "h3attnbe" && !G.ksage
  && G.kspec[0] === "h3chunkff" && G.kguider[0] === "h3spectrum" && G.nk.some((x) => /sage auto skipped/.test(x)), G);
check("a graph without native H3 nodes: Long video skipped with a note, untouched", G.nonh3 && G.nn.some((x) => /H3-only/.test(x)), G.nn);
check("the seatbelt knows them (accel_nodes, install hints) and a failed one is removed with the chain healed",
  ["h3attnbe", "h3chunkff", "h3lowvram", "h3spectrum"].every((k) => G.ids.includes(k)) && G.hints && G.drop[0] === true && G.drop[1][0] === "h3lowvram", G);

/* ---- the switches */
const S = require(path.join(ROOT, "lib", "styles.js")), ST = read("lib", "styles.js");
check("styles: Long video stored only when on (old styles keep their shape); the 'MiniMax H3 Long (30 s)' starter",
  /if \(String\(o\.long \?\? ""\)\.trim\(\) === "on"\) \{\s*out\.long = "on";/.test(ST)
  && /name: "MiniMax H3 Long \(30 s\)", kind: "video", arch: "minimax-h3",\s*accel: \{ sage: "off", spectrum: "off", long: "on", kitchen_attn: true \}/.test(ST)
  && S.videoArchById("minimax-h3").accel.long === true && !S.videoArchById("ltx-2.5").accel.long);
const RS = require(path.join(ROOT, "lib", "renderSettings.js"));
const jo = RS.jobOverrides({ long_run: true, kitchen: true }, { width: 1280, height: 720, style: { name: "x", kind: "video", arch: "minimax-h3" } });
const jo0 = RS.jobOverrides({}, { width: 1280, height: 720, style: { name: "x", kind: "video", arch: "minimax-h3" } });
check("the video docker's ⚙ Long video: the job's style gets accel.long on (+ kitchen attention with Comfy kitchen); off = nothing",
  jo.video_style.accel.long === "on" && jo.video_style.accel.kitchen_attn === true && jo.notes.some((n) => /^Long video/.test(n))
  && !jo0.video_style.accel.long && RS.normalize({ long_run: true }).long_run === true && RS.normalize({}).long_run === false, jo);
const RI = read("routes", "index.js"), RC = read("routes", "characters.js"), IX = read("static", "index.html"), VD = read("ext", "videodock", "rendersettings.js"), DH = read("ext", "videodock", "dock.html");
check("Generate: the request's video style decides the ceiling (Single up to 719f when long), the plan API too",
  /const long = longFor\(f\.video_style_id\);/.test(RI) && /if \(requested === "single" && frames > MC\)/.test(RI) && /planChunks\(frames, pipeline === "single" \? MC : maxChunk/.test(RI)
  && /const long = longFor\(req\.query\.video_style_id\)/.test(RI) && /modelCeiling: MC, long,/.test(RI));
check("the board: a scene renders up to the long ceiling in one go (frames, plan, segment) when the ⚙ or the style says so",
  /const CEIL = h3Long\.modelCeiling\(grid, G\.ceiling, longScene\);/.test(RC) && /framePlan\.planChunks\(frames, CEIL, grid, false, CEIL\)/.test(RC) && /segment_frames: CEIL,/.test(RC));
check("the page: the ⚙ checkbox, the style editor's Long video select (+ kitchen), the plan readout's ceiling follows the picked style",
  /id="vdSetLong"/.test(DH) && /long_run: el\("vdSetLong"\)/.test(VD) && /<select id="s_vslong">/.test(IX) && /kitchen_attn: !!\(\$\("s_vslong"\) && \$\("s_vslong"\)\.value === "kitchen"\)/.test(IX)
  && /longStyleOn\(\) \? 719 : 362/.test(IX));
const CO = read("lib", "comfy.js");
check("installers: KJNodes (update), Yusu MiniMax H3 Unified, RH DLSS 5 - git clones into custom_nodes, buttons in Settings",
  /yusu: \{ url: "https:\/\/github\.com\/yusu-02\/ComfyUI-Yusu-MiniMaxH3-Unified\.git"/.test(CO) && /dlss5: \{ url: "https:\/\/github\.com\/RH-RunningHub\/ComfyUI-RH-DLSS5\.git"/.test(CO)
  && ["kjnodes", "yusu", "dlss5"].every((k) => IX.includes('id="s_vapack_' + k + '"')));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

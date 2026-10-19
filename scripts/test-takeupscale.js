#!/usr/bin/env node
/* bitGen Studio — 2.315.0: ⏫ UPSCALES THE TAKE YOU PREVIEWED.
 * Run: node scripts/test-takeupscale.js
 *
 * Tim (verbatim): "does it upscale automatically or do i need to press the
 * upscale button in the scene. i would prefer to press the button so i can
 * preview the scene, however i would like a icon only button in the scene
 * menubar to upscale selected"
 *   1. lib/takeUpscale: the take on disk (its lossless master first), its
 *      size (ffprobe, LIVE), the stage from the ⚙ (no upscaler / not larger
 *      -> said), the ticked list;
 *   2. the wiring: a plain render runs the stage only with "Upscale every
 *      render"; queueScene's ⏫ on a convert-style board passes the take +
 *      the stage and rebuilds the take's own inputs; POST /api/scenes/upscale;
 *   3. the dock: the icon-only ⏫ in the scene menubar posts the ticked scenes.
 * The graph side (the stage reading the take) runs in test-upscalestage.py;
 * the whole path runs LIVE in the e2e. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const TU = require(path.join(ROOT, "lib", "takeUpscale"));
const RS = require(path.join(ROOT, "lib", "renderSettings"));

// ---- 1. the lib ----------------------------------------------------------------------------
const d = fs.mkdtempSync(path.join(os.tmpdir(), "tu315-"));
try {
  fs.mkdirSync(path.join(d, "video")); fs.mkdirSync(path.join(d, "raw"));
  const mp4 = path.join(d, "video", "scene_2_3.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=960x544:d=0.5:r=24",
    "-pix_fmt", "yuv420p", mp4]);
  check("source: the take on disk, the mp4 while it has no master", (() => {
    const s = TU.source(d, "scene_2_3.mp4");
    return s && s.file === mp4 && s.master === false; })(), TU.source(d, "scene_2_3.mp4"));
  fs.writeFileSync(path.join(d, "raw", "scene_2_3.avi"), "master");
  check("...its LOSSLESS master when there is one; a take gone from disk -> null",
    TU.source(d, "scene_2_3.mp4").file === path.join(d, "raw", "scene_2_3.avi") && TU.source(d, "scene_2_3.mp4").master
    && TU.source(d, "gone.mp4") === null && TU.source(d, "") === null);
  check("probeSize LIVE (ffprobe): 960x544; not a video -> null",
    JSON.stringify(TU.probeSize(mp4)) === '{"width":960,"height":544}' && TU.probeSize(path.join(d, "raw", "scene_2_3.avi")) === null,
    TU.probeSize(mp4));
  const src = TU.source(d, "scene_2_3.mp4");
  const p = TU.plan(RS.normalize({ upscaler: "up3d.safetensors", upscale_res: "1080" }), src, { width: 960, height: 544 });
  check("plan: the ⚙'s upscaler at 1080p of the TAKE's own size (960x544 -> 1920x1088), said with the source",
    p.stage && p.stage.model === "up3d.safetensors" && p.stage.width === 1920 && p.stage.height === 1088
    && /⏫ upscales the take you previewed: scene_2_3\.avi \(its lossless master\) 960x544 -> 1920x1088 with up3d\.safetensors/.test(p.note), p);
  check("plan: no ⚙ upscaler -> the ⚙ is named; not larger -> said; no take / no size -> said",
    TU.plan(RS.normalize({}), src, { width: 960, height: 544 }).error === TU.NO_UPSCALER
    && /already 1920x1088 - pick a larger Upscale resolution/.test(TU.plan(RS.normalize({ upscaler: "u", upscale_res: "1080" }), src, { width: 1920, height: 1088 }).error)
    && /not in the project's Video assets/.test(TU.plan(RS.normalize({ upscaler: "u" }), null, null).error)
    && /could not read the size/.test(TU.plan(RS.normalize({ upscaler: "u" }), src, null).error));
  check("ticked: unique scene numbers in board order, junk dropped",
    JSON.stringify(TU.ticked(["3", 1, 3, "x", 0, -2, 2])) === "[1,2,3]" && TU.ticked(null).length === 0);
} finally { fs.rmSync(d, { recursive: true, force: true }); }

// ---- 2. the wiring --------------------------------------------------------------------------
{
  const RC = read("routes", "characters.js");
  check("a plain render runs the ⚙ upscaler only with \"Upscale every render\" (both board job builders)",
    RC.includes(": rs.upscale_stage && rs.upscale_auto && !upscale ? { upscale_stage: rs.upscale_stage } : {}),")
    && RC.includes("...(rs.upscale_stage && rs.upscale_auto ? { upscale_stage: rs.upscale_stage } : {}),"));
  check("queueScene: ⏫ on a convert-style board plans the take (source + size + the ⚙), refuses with the reason, passes the take + stage",
    RC.includes("if (upscale && !upExport && convName) {")
    && RC.includes("const tp = takeUpscale.plan(renderSettings.read(pdir), src, src && takeUpscale.probeSize(src.file));")
    && RC.includes("if (tp.error) return { status: 400, error: `scene ${n}: ${tp.error}` };")
    && RC.includes("...(takeUp ? { upscale_stage: takeUp.stage, upscale_take: takeUp.file }"));
  check("...and rebuilds the take's OWN inputs (mode, frame, references) for the refine pass",
    RC.includes("if (!upscale || takeUp) {"));
  check("POST /api/scenes/upscale: every ticked scene through the same queueScene, errors named, nothing queued -> 400",
    RC.includes('app.post("/api/scenes/upscale", trap.guard(async (req, res) => {')
    && RC.includes("const ns = takeUpscale.ticked(b.scenes);")
    && RC.includes("const r = queueScene(b.project, n, { upscale: true });")
    && RC.includes('return res.status(400).json({ error: "nothing to upscale", errors });'));
}

// ---- 3. the dock ------------------------------------------------------------------------------
{
  const DH = read("ext", "videodock", "dock.html"), CJ = read("ext", "videodock", "characters.js");
  const m = /<button class="ghost gbtn" id="scUpSel" type="button"[^>]*aria-label="Upscale the selected scenes">([^<]*)<\/button>/.exec(DH);
  check("the scene menubar has an ICON-ONLY ⏫ right after ▶ Selected (label + title for the screen reader / hover)",
    m && m[1] === "⏫" && DH.indexOf('id="scUpSel"') > DH.indexOf('id="scRenderSel"')
    && DH.indexOf('id="scUpSel"') < DH.indexOf("data-scallanchor"), m && m[1]);
  check("...it posts the ticked scenes to /api/scenes/upscale and says how many were queued",
    CJ.includes('el("scUpSel").addEventListener("click", function () {')
    && CJ.includes('scPost("/api/scenes/upscale", { scenes: ns })')
    && CJ.includes('"⏫ " + d.queued + " scene(s) queued for upscale'));
  check("the ⚙ carries \"Upscale every render\" (off by default)",
    DH.includes('<input type="checkbox" id="vdSetUpAuto"> Upscale every render</label>')
    && RS.normalize({}).upscale_auto === false);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

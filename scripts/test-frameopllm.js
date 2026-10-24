#!/usr/bin/env node
/* bitGen Studio — 2.395.0: Append / Prepend = fl2va; the dock's picture is <Picture 2>; the LLM is told.
 * Tim (verbatim): "when prepend or append video use fl2va not ref2a or i2v . if there are pictures in the ref images
 * tab label the first picture as picture 2. let the llm know the details"
 *   1. static/refroles.js: frameOpPick / frameOpPlan / frameOpTags (the typed frame picture, else the FIRST picture)
 *   2. lib/frameOp.js: the job note says fl2va, <Picture 1> / <Picture 2>, never i2v
 *   3. lib/refContext.js: the dock the LLM sees (<Picture 1> = the video's frame, described; <Picture 2>), the block,
 *      frameDesc (ffmpeg + the captioner, stubbed)
 *   4. the wiring: routes/index.js (chat + Enhance), static/index.html (the tray tags, the video's note, mapping
 *      lines off, Generate / Enhance / chat send the op), the stub LLMs echo FRAMEOP_TEST
 *   5. LIVE (the running app, H3_URL - default the e2e server on :8311): /api/chat and /api/enhance with an Append /
 *      Prepend video - what the LLM was told (the stub echoes it); SKIP without an app */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0, skip = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);

(async () => {
  // ---- 1
  const RR = require("../static/refroles.js");
  const S = { role: "person", file: { name: "s.png" } }, T = { role: "person", file: { name: "t.png" } };
  const F = { role: "first frame", file: { name: "f.png" } }, L = { role: "last frame", file: { name: "l.png" } };
  check("frameOpPick: the typed frame picture (Last for append, First for prepend), else the FIRST picture, none = null",
    RR.frameOpPick("append", [S, F, L]) === L && RR.frameOpPick("prepend", [S, F, L]) === F
    && RR.frameOpPick("append", [S, T]) === S && RR.frameOpPick("prepend", [T, S]) === T && RR.frameOpPick("append", []) === null);
  const ap = RR.frameOpPlan(["v.mp4"], { "v.mp4": "append" }, [S, T]);
  check("frameOpPlan append: the first picture sent as <Picture 2> (the last frame), fl2va said, never i2v / ref2va",
    ap.refs.length === 1 && ap.refs[0] === S && ap.pic === S && /<Picture 1>, the first frame/.test(ap.note) && /<Picture 2> s\.png is its last frame - fl2va/.test(ap.note)
    && /1 other picture\(s\) are not used \(fl2va takes two frames\)/.test(ap.note) && !/i2v|ref2va/.test(ap.note), ap.note);
  const pp = RR.frameOpPlan(["v.mp4"], { "v.mp4": "prepend" }, [S]);
  const pn = RR.frameOpPlan(["v.mp4"], { "v.mp4": "prepend" }, []);
  const an = RR.frameOpPlan(["v.mp4"], { "v.mp4": "append" }, []);
  check("frameOpPlan prepend: the picture is <Picture 2> (the FIRST frame); no picture = fl2va from <Picture 1> alone (prepend: played backwards)",
    pp.refs[0] === S && /<Picture 1>, the last frame/.test(pp.note) && /is its first frame - fl2va/.test(pp.note)
    && pn.refs.length === 0 && /fl2va from <Picture 1> alone, made forward and played backwards/.test(pn.note) && /fl2va from <Picture 1> alone$/.test(an.note)
    && ![pp, pn, an].some((x) => /i2v/.test(x.note)), [pp.note, pn.note, an.note]);
  check("frameOpTags: 'Picture 2 · last frame' / 'Picture 2 · first frame' on the picture used, 'not used (op)' on the rest, '' without an op",
    RR.frameOpTags(ap, [S, T]).join("|") === "Picture 2 · last frame|not used (append)" && RR.frameOpTags(pp, [S]).join() === "Picture 2 · first frame"
    && RR.frameOpTags(null, [S]).join() === "", RR.frameOpTags(ap, [S, T]));

  // ---- 2
  const FO = require("../lib/frameOp.js");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fopllm-"));
  const vdir = path.join(tmp, "video"), jdir = path.join(tmp, "job");
  fs.mkdirSync(vdir); fs.mkdirSync(jdir);
  let haveFf = true;
  try { ff(["-f", "lavfi", "-i", "color=c=red:s=96x64:r=24:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(vdir, "clip.mp4")]);
        ff(["-f", "lavfi", "-i", "color=c=blue:s=96x64", "-frames:v", "1", path.join(tmp, "pic.png")]); } catch { haveFf = false; }
  if (!haveFf) { skip++; console.log("SKIP: no ffmpeg - the frameOp note legs"); }
  else {
    const a1 = FO.build({ raw: { name: "clip.mp4", op: "append" }, videoDir: vdir, jobDir: jdir, files: [path.join(tmp, "pic.png")], names: ["girl.png"] });
    const a0 = FO.build({ raw: { name: "clip.mp4", op: "append" }, videoDir: vdir, jobDir: jdir, files: [] });
    const p1 = FO.build({ raw: { name: "clip.mp4", op: "prepend" }, videoDir: vdir, jobDir: jdir, files: [path.join(tmp, "pic.png")], names: ["girl.png"] });
    const p0 = FO.build({ raw: { name: "clip.mp4", op: "prepend" }, videoDir: vdir, jobDir: jdir, files: [] });
    check("frameOp notes: always fl2va, <Picture 1> = the video's frame, <Picture 2> (its name) the other end; never i2v",
      /<Picture 1> = clip\.mp4's last frame .* is the FIRST frame, <Picture 2> \(girl\.png\) the LAST - fl2va/.test(a1.note)
      && /<Picture 1> = clip\.mp4's first frame .* is the LAST frame, <Picture 2> \(girl\.png\) the FIRST - fl2va/.test(p1.note)
      && /- fl2va at/.test(a0.note) && /backwards/.test(p0.note) && /- fl2va at/.test(p0.note) && ![a1, a0, p1, p0].some((x) => /i2v/.test(x.note))
      && a1.files[1] === path.join(tmp, "pic.png") && p1.files[0] === path.join(tmp, "pic.png"), [a1.note, a0.note, p1.note, p0.note]);
  }

  // ---- 3
  const RC = require("../lib/refContext.js");
  const ctx = { refs: [{ name: "girl.png", subject: 1, role: "person" }], ref_videos: ["walk.mp4", "b.mp4"], ref_audios: ["v.wav"],
    ref_video_op: { name: "walk.mp4", op: "append" } };
  const d = RC.dock(ctx, ["a girl in a red coat"], "a man walking on a beach at dusk");
  check("dock (append): <Picture 1> = walk.mp4's last frame (described), <Picture 2> = the dock's picture, the op video not a <Video n>",
    d.op && d.op.op === "append" && d.pictures.length === 2 && d.pictures[0].n === 1 && d.pictures[0].frame === "last" && d.pictures[0].desc === "a man walking on a beach at dusk"
    && d.pictures[1].n === 2 && d.pictures[1].name === "girl.png" && d.pictures[1].desc === "a girl in a red coat"
    && d.videos.map((v) => v.name).join() === "b.mp4" && d.audios.length === 1, d);
  const blk = RC.block(d);
  check("block (append): fl2va named, not References / i2v; <Picture 1> the LAST frame of the video - the part STARTS on it; <Picture 2> where it ENDS; the descriptions",
    /THIS RENDER APPENDS A NEW PART TO THE VIDEO walk\.mp4/.test(blk) && /FIRST \/ LAST FRAME \(fl2va\)/.test(blk) && /not References, not a plain image-to-video/.test(blk)
    && /<Picture 1> - the LAST frame of walk\.mp4: the new part STARTS exactly on it[^\n]*a man walking on a beach at dusk/.test(blk)
    && /<Picture 2> - file girl\.png, the user's picture: the new part ENDS exactly on it: a girl in a red coat/.test(blk), blk);
  check("...the writing rule: one continuous shot carrying on to <Picture 2>, no <Subject n> mapping lines, no cuts, H3 speech syntax; no subject TEACHING",
    /CARRIES ON from the last moment of walk\.mp4 \(<Picture 1>\)[^\n]*<Picture 2> shows/.test(blk) && /NO <Subject n> mapping lines/.test(blk)
    && /no cuts/.test(blk) && /<d>\[English\]/.test(blk) && !/Definitions first/.test(blk) && /overrides any rule about mapping lines/.test(blk), blk);
  const dp = RC.dock({ refs: [], ref_video_op: { name: "walk.mp4", op: "prepend" } }, [], "");
  const bp = RC.block(dp);
  check("block (prepend, no picture): <Picture 1> = the FIRST frame, the part ENDS on it, made forward + played backwards (silent, no speech); only <Picture 1> named",
    dp.pictures.length === 1 && /PREPENDS A NEW PART/.test(bp) && /<Picture 1> - the FIRST frame of walk\.mp4: the new part ENDS exactly on it/.test(bp)
    && /played BACKWARDS \(silent\)/.test(bp) && /no speech/.test(bp) && /name it as <Picture 1>,/.test(bp) && !/<Picture 2>/.test(bp) && !/<d>\[English\]/.test(bp), bp);
  const dp2 = RC.dock({ refs: [{ name: "start.png" }], ref_video_op: { name: "walk.mp4", op: "prepend" } }, ["a door"], "a hall");
  check("block (prepend + picture): <Picture 2> is where it STARTS, leads INTO the video's first moment",
    /<Picture 2> - file start\.png, the user's picture: the new part STARTS exactly on it: a door/.test(RC.block(dp2)) && /LEADS INTO the first moment of walk\.mp4/.test(RC.block(dp2)));
  check("no op = the 2.354.0 dock exactly as before (<Picture 1> subject 1, <Video 1>)",
    RC.dock({ refs: [{ name: "a.png", subject: 1 }], ref_videos: ["walk.mp4"] }, ["x"]).op === undefined
    && /<Picture 1> - subject 1, file a\.png: x/.test(RC.block(RC.dock({ refs: [{ name: "a.png", subject: 1 }], ref_videos: ["walk.mp4"] }, ["x"]))));
  check("retag: <walk.mp4> written as a tag -> <Picture 1> (it is the frame now)", RC.retag("starts on <walk.mp4>", d).text === "starts on <Picture 1>");
  if (haveFf) {
    let asked = null;
    const fake = { describe: async (core, list) => { asked = list; return ["a red room"]; } };
    const fdir = path.join(tmp, "chat");
    const r1 = await RC.frameDesc({}, fdir, { name: "clip.mp4", op: "append" }, vdir, true, { captioner: fake });
    const r2 = await RC.frameDesc({}, fdir, { name: "nope.mp4", op: "append" }, vdir, true, { captioner: fake });
    const r3 = await RC.frameDesc({}, fdir, { name: "clip.mp4", op: "prepend" }, vdir, true, { captioner: fake, extract: () => false });
    check("frameDesc: the frame taken out with ffmpeg and described (the captioner gets a PNG named after the video), cached; a gone video / a failed take said",
      r1.desc === "a red room" && asked && asked[0].originalname === "clip.mp4_last_frame.png" && asked[0].buffer.slice(1, 4).toString() === "PNG"
      && /refdesc\.json/.test(fs.readdirSync(fdir).join()) && /not in this project's Assets/.test(r2.note) && /could not take the first frame/.test(r3.note), { r1, r2, r3 });
  }

  // ---- 4
  const R = read("routes", "index.js"), I = read("static", "index.html"), SL = read("scripts", "stub-llm.py"), ST = read("scripts", "stub-tts.py");
  check("routes: the chat describes the op video's frame and builds the fl2va dock; Enhance too (no mapping lines, the block in the user turn, mode fl2va)",
    /const rop = refContext\.opOf\(rctx\);/.test(R) && /refContext\.frameDesc\(core, dir, rop, core\.pDir\("video"\), describe\)/.test(R) && /refContext\.dock\(rctx, dsc\.descs, fd\.desc\)/.test(R)
    && /const eop = refContext\.opOf\(req\.body \|\| \{\}\);/.test(R) && /const mapping = eop \? "" :/.test(R) && /const avLines = eop \? refContext\.block\(eDock\)\.trim\(\)/.test(R)
    && /mode = "fl2va \(" \+ eop\.op/.test(R) && /files: referenceFiles, names: referenceNames, upscaler/.test(R));
  check("page: the tray tags from frameOpTags (the rest dimmed), mapping lines off, the video's fl2va note, Generate / Enhance / chat send the op",
    /const fopTags = fopT && RefRoles\.frameOpTags \? RefRoles\.frameOpTags\(fopT, refs\) : null;/.test(I) && /const tag = fopTags \? fopTags\[i\]/.test(I)
    && /classList\.toggle\("fopoff", r !== fopT\.pic\)/.test(I) && /if \(curFrameOp\(\)\) return "";   \/\/ 2\.395\.0/.test(I)
    && /fl2va · <Picture 1> = its last frame - the new part starts on it; <Picture 2> = the Image tab's picture \(its end\)/.test(I)
    && /const fop = curFrameOp\(\);/.test(I) && /ref_video_op: curFrameOp\(\)\.op/.test(I) && /picture: 2, name:/.test(I)
    && /if \(chatFop\) chatCtx\.ref_video_op = chatFop\.op;/.test(I) && /renderRefLists\(\); renderTray\(\);/.test(I));
  check("the stub LLMs echo FRAMEOP_TEST (what the LLM was told)", /"FRAMEOP_TEST" in alltext/.test(SL) && /"FRAMEOP_TEST" in alltext/.test(ST) && /FRAMEOP-ECHO/.test(SL + ST));
  check("nothing added to server.js", !/frameOp|refContext/.test(read("misc/server.js")));

  // ---- 5 LIVE
  let where = null;
  try { where = await (await fetch(URL_ + "api/outputs/where")).json(); } catch { where = null; }
  const proj = where && (where.dirs || where).find && (where.dirs || where).find((x) => x.where === "project");
  if (!proj || !haveFf) { skip++; console.log("SKIP: no app at " + URL_ + " (or no ffmpeg) - the live chat / Enhance legs did not run"); }
  else {
    const pv = path.join(proj.dir, "video");
    fs.mkdirSync(pv, { recursive: true });
    const name = "fol395_" + process.pid + ".mp4";
    fs.copyFileSync(path.join(vdir, "clip.mp4"), path.join(pv, name));
    const fd = new FormData();
    fd.append("text", "FRAMEOP_TEST write the video prompt");
    fd.append("describe", "0");
    fd.append("context", JSON.stringify({ gen_mode: "video", refs: [{ name: "girl.png", subject: 1, role: "person" }], ref_videos: [name], ref_video_op: { name, op: "append" } }));
    fd.append("ref_images", new Blob([fs.readFileSync(path.join(tmp, "pic.png"))], { type: "image/png" }), "girl.png");
    const cj = await (await fetch(URL_ + "api/chat", { method: "POST", body: fd })).json();
    const rep = String(cj.reply || cj.text || "");
    check("LIVE chat, Append: the LLM is told fl2va - <Picture 1> the video's LAST frame (the part starts on it), <Picture 2> girl.png (it ends on it), no mapping lines; the video is not a <Video n>",
      /FRAMEOP-ECHO/.test(rep) && new RegExp("THIS RENDER APPENDS A NEW PART TO THE VIDEO " + name).test(rep) && /<Picture 1> - the LAST frame of fol395_\d+\.mp4: the new part STARTS exactly on it/.test(rep)
      && /<Picture 2> - file girl\.png, the user's picture: the new part ENDS exactly on it/.test(rep) && /NO <Subject n> mapping lines/.test(rep) && !/<Video 1> - reference video/.test(rep), rep.slice(-1500));
    const ej = await (await fetch(URL_ + "api/enhance", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "FRAMEOP_TEST she walks on", mode: "ref2va", ref_video_op: { name, op: "prepend" },
        refs: [{ subject: 1, role: "person", picture: 2, name: "girl.png" }], ref_videos: [name] }) })).json();
    const et = String(ej.text || "");
    check("LIVE Enhance, Prepend: mode fl2va (prepend), <Picture 1> the video's FIRST frame (the part ends on it), <Picture 2> where it starts, no <Subject 1> mapping line",
      /FRAMEOP-ECHO/.test(et) && /Rough prompt \(mode: fl2va \(prepend fol395_\d+\.mp4\)\)/.test(et) && /<Picture 1> - the FIRST frame of fol395_\d+\.mp4: the new part ENDS exactly on it/.test(et)
      && /<Picture 2> - file girl\.png, the user's picture: the new part STARTS exactly on it/.test(et) && !/<Subject 1> is in <Picture/.test(et), et.slice(-1500));
    try { fs.rmSync(path.join(pv, name), { force: true }); } catch { /* fine */ }
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed${skip ? ", " + skip + " skipped" : ""}`);
  process.exit(fail ? 1 : 0);
})();

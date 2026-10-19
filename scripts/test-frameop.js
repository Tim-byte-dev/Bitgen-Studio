#!/usr/bin/env node
/* bitGen Studio — 2.388.0: APPEND / PREPEND a reference video from Generate.
 * Run: node scripts/test-frameop.js   (the live leg uses the running app: H3_URL, default the e2e server on :8311 -
 * no server there = that leg SKIPs)
 * Tim: "add option to dropdown in reference docker video dropdown -"Append" if this is selected then continue this
 * video, take the last frame, upscale the png then generate an i2v or fl2va video from that frame-append the video /
 * ... "prepend" ... take the first frame ... prepend the video. this will work from the generate button in the prompt
 * docker / is it possible to use refmods in fl2va?"
 *   1. lib/frameOp: parse, the frame taken out (last / first), the order (append [frame, pic?], prepend [pic, frame] or
 *      [frame] reversed), the size (the video's, 32-px grid), the refusals;
 *   2. static/refroles.js frameOpPlan / setOp (the page's pick: one op video, the Last / First frame picture);
 *   3. the wiring: routes/index.js, worker.py, wan_worker.py, the page;
 *   4. refmods on fl2va: worker._apply_refmods splices after MiniMaxH3ImageToVideo in comfy_workflows/fl2va.json;
 *   5. LIVE: POST /api/generate with ref_video_op append + prepend -> the worker's joined clip (frames, size, log). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0, skip = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 700) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const FO = require(path.join(ROOT, "lib", "frameOp"));
const RR = require(path.join(ROOT, "static", "refroles.js"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a));
const rgb = (png) => [...execFileSync("ffmpeg", ["-loglevel", "error", "-i", png, "-vf", "scale=1:1:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).subarray(0, 3)];
const near = (c, w) => c && c.every((v, i) => Math.abs(v - w[i]) < 60);
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fo388_"));
  try {
    // ---- 1
    const vdir = path.join(tmp, "video"), jdir = path.join(tmp, "job");
    fs.mkdirSync(vdir); fs.mkdirSync(jdir);
    ff(["-f", "lavfi", "-i", "color=c=red:s=330x190:r=24:d=1", "-f", "lavfi", "-i", "color=c=blue:s=330x190:r=24:d=1",
        "-filter_complex", "[0][1]concat=n=2:v=1:a=0", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(vdir, "clip.mp4")]);
    const pic = path.join(tmp, "pic.png");
    ff(["-f", "lavfi", "-i", "color=c=yellow:s=64x64", "-frames:v", "1", pic]);
    check("parse: {name, op} append / prepend (a path cut to its name); anything else = no op",
      JSON.stringify(FO.parse('{"name":"../x/clip.mp4","op":"Append"}')) === '{"name":"clip.mp4","op":"append"}'
      && FO.parse({ name: "a.mp4", op: "prepend" }).op === "prepend" && FO.parse('{"name":"a.mp4","op":"reference"}') === null
      && FO.parse("nope") === null && FO.parse('{"op":"append"}') === null);
    check("snap: the 32-px grid, 128..2048", FO.snap(330) === 320 && FO.snap(190) === 192 && FO.snap(20) === 128 && FO.snap(9000) === 2048);
    const a = FO.build({ raw: { name: "clip.mp4", op: "append" }, videoDir: vdir, jobDir: jdir, files: [], upscaler: "" });
    check("append, no picture: the LAST frame (blue) taken out, it alone = fl2va from it (2.395.0: never called i2v), the video's size, frame_op",
      a && !a.error && a.files.length === 1 && a.files[0] === path.join(jdir, "frame_op.png") && near(rgb(a.files[0]), [0, 0, 255])
      && a.width === 320 && a.height === 192 && a.frame_op.op === "append" && a.frame_op.reverse === false
      && a.frame_op.video === path.join(vdir, "clip.mp4") && /- fl2va at/.test(a.note) && !/i2v/.test(a.note), a);
    const a2 = FO.build({ raw: '{"name":"clip.mp4","op":"append"}', videoDir: vdir, jobDir: jdir, files: [pic], upscaler: "4x_x.pth" });
    check("append + the Last frame picture: [the frame, the picture] = fl2va; the ⚙ upscaler rides the frame_op",
      a2.files.length === 2 && a2.files[1] === pic && a2.frame_op.upscaler === "4x_x.pth" && /fl2va/.test(a2.note) && /4x_x\.pth/.test(a2.note), a2);
    const p1 = FO.build({ raw: { name: "clip.mp4", op: "prepend" }, videoDir: vdir, jobDir: jdir, files: [pic] });
    check("prepend + the First frame picture: [the picture, the video's FIRST frame (red)] = fl2va ending on the video",
      p1.files[0] === pic && p1.files[1].endsWith("frame_op.png") && near(rgb(p1.files[1]), [255, 0, 0]) && p1.frame_op.reverse === false, p1);
    const p2 = FO.build({ raw: { name: "clip.mp4", op: "prepend" }, videoDir: vdir, jobDir: jdir, files: [] });
    check("prepend, no picture: [the first frame], made forward and REVERSED (said)", p2.files.length === 1 && p2.frame_op.reverse === true
      && /backwards/.test(p2.note), p2);
    check("refused in words: a gone video, two pictures, an unreadable video, a frame that cannot be taken out",
      /gone/.test(FO.build({ raw: { name: "nope.mp4", op: "append" }, videoDir: vdir, jobDir: jdir }).error)
      && /at most one picture/.test(FO.build({ raw: { name: "clip.mp4", op: "append" }, videoDir: vdir, jobDir: jdir, files: [pic, pic] }).error)
      && (fs.writeFileSync(path.join(vdir, "bad.mp4"), "x"), /could not read/.test(FO.build({ raw: { name: "bad.mp4", op: "append" }, videoDir: vdir, jobDir: jdir }).error))
      && /could not take the last frame/.test(FO.build({ raw: { name: "clip.mp4", op: "append" }, videoDir: vdir, jobDir: path.join(tmp, "nojob"), extract: () => false }).error));
    check("no ref_video_op = null (an ordinary Generate)", FO.build({ raw: "", videoDir: vdir, jobDir: jdir }) === null);
    check("extractArgs = clipjoin.extract_cmd (the same ffmpeg)", FO.extractArgs("v", "first", "o").includes("-frames:v")
      && FO.extractArgs("v", "last", "o").join(" ").includes("-sseof -1 -i v -update 1"));

    // ---- 2
    const F = { role: "first frame", file: "F" }, L = { role: "last frame", file: "L" }, S = { role: "person", file: "S" };
    const ap = RR.frameOpPlan(["a.mp4", "b.mp4"], { "b.mp4": "append" }, [S, F, L]);
    check("frameOpPlan: append sends the LAST frame picture only, the others named as unused",
      ap.op.name === "b.mp4" && ap.op.op === "append" && ap.refs.length === 1 && ap.refs[0] === L && /2 other picture/.test(ap.note), ap);
    const pp = RR.frameOpPlan(["a.mp4"], { "a.mp4": "prepend" }, [S, F]);
    const pn = RR.frameOpPlan(["a.mp4"], { "a.mp4": "prepend" }, []);    // 2.395.0: an untyped picture is used too (<Picture 2>)
    check("frameOpPlan: prepend sends the FIRST frame picture; none = fl2va from the frame, played backwards; a stale op (video gone) / Reference = null",
      pp.refs[0] === F && pn.refs.length === 0 && /backwards/.test(pn.note)
      && RR.frameOpPlan(["a.mp4"], { "x.mp4": "append" }, []) === null && RR.frameOpPlan(["a.mp4"], {}, []) === null);
    check("setOp: one op video at a time; Reference clears", JSON.stringify(RR.setOp({ "a.mp4": "append" }, "b.mp4", "prepend")) === '{"b.mp4":"prepend"}'
      && JSON.stringify(RR.setOp({ "a.mp4": "append" }, "a.mp4", "")) === "{}");

    // ---- 3
    const R = read("routes", "index.js"), W = read("worker.py"), WW = read("wan_worker.py"), I = read("static", "index.html");
    check("routes/index.js: lib/frameOp on ref_video_op, fl2va forced, the frames re-ordered, the op video not a reference, the size, frame_op on H3 + Wan",
      /require\("\.\.\/lib\/frameOp"\)\.build\(\{ raw: f\.ref_video_op/.test(R) && /mode = "fl2va";/.test(R)
      && /referenceFiles\.splice\(0, referenceFiles\.length, \.\.\.frameOp\.files\)/.test(R) && /refVideos = refVideos\.filter\(\(p\) => p !== frameOp\.video\)/.test(R)
      && /\.\.\.\(frameOp \? \{ frame_op: frameOp\.frame_op \} : \{\}\)/.test(R) && /wp\.frame_op = Object\.assign/.test(R)
      && /width: frameOp \? frameOp\.width/.test(R) && /png_upscaler/.test(R));
    check("worker.py: the frame upscaled before the render (the ⚙ upscaler through ComfyUI), the join before the PNG tail",
      /import clipjoin as _cj/.test(W) && /_cj\.prepare\(fop, say/.test(W) && /_tail_comfy\(cfg\) if fop\.get\("upscaler"\)/.test(W)
      && W.indexOf("_cj.join(fop, part, final") > 0 && W.indexOf("_cj.join(fop, part, final") < W.indexOf("_tail_pngs(params, cfg, final, raw_dir)       # 2.313.0"));
    check("wan_worker.py: the same - prepare before the pictures upload, join before @@OUT",
      /import clipjoin as _cj/.test(WW) && WW.indexOf("_cj.prepare(fop") < WW.indexOf("# 1. pictures")
      && WW.indexOf("_cj.join(fop") > 0 && WW.indexOf("_cj.join(fop") < WW.indexOf('say("@@OUT " + name)'));
    check("the page: the Use dropdown (Reference / Append / Prepend) on each reference video, kept with the project, sent by Generate",
      /<select class="rvop"/.test(I) && /<option value="append">Append<\/option><option value="prepend">Prepend<\/option>/.test(I)
      && /RefRoles\.setOp\(refVidOps, n, sel\.value\)/.test(I) && /fd\.append\("ref_video_op", JSON\.stringify\(fop\.op\)\)/.test(I)
      && /refVidOps,\s+\/\/ 2\.388\.0/.test(I) && /refVidOps = d\.refVidOps/.test(I) && /closest\("button, select"\)/.test(I));

    // ---- 4
    const py = execFileSync("python3", ["-c", [
      "import sys, json, copy; sys.path.insert(0, 'scripts'); sys.path.insert(0, '.')",
      "import worker",
      "said = []; worker.say = said.append",
      "g = json.load(open('comfy_workflows/fl2va.json'))",
      "i2v = next(k for k, v in g.items() if v['class_type'] == 'MiniMaxH3ImageToVideo')",
      "pre = [(n, k) for n, v in g.items() for k, x in (v.get('inputs') or {}).items() if isinstance(x, list) and len(x) == 2 and str(x[0]) == i2v and int(x[1]) == 0]",
      "h = worker._apply_refmods(copy.deepcopy(g), ['bitgen_jinx'])",
      "post = [h[n]['inputs'][k] for n, k in pre]",
      "lat = [x for v in h.values() for x in (v.get('inputs') or {}).values() if isinstance(x, list) and len(x) == 2 and str(x[0]) == i2v and int(x[1]) == 1]",
      "print(json.dumps({'apply': h.get('refmod_apply', {}).get('inputs', {}).get('conditioning'), 'i2v': i2v, 'pre': len(pre), 'post': post, 'lat': len(lat),",
      "  'loader': h.get('refmod_loader', {}).get('inputs', {}).get('mod_1'), 'said': said, 'same': worker._apply_refmods(copy.deepcopy(g), []) == g}))",
    ].join("\n")], { cwd: ROOT, encoding: "utf8" });
    const rm = JSON.parse(py.trim().split("\n").pop());
    check("refmods on fl2va: Apply reads MiniMaxH3ImageToVideo's conditioning, every consumer of it rewired, the latent left alone, said as experimental",
      JSON.stringify(rm.apply) === JSON.stringify([rm.i2v, 0]) && rm.pre >= 1 && rm.post.every((x) => x[0] === "refmod_apply") && rm.lat >= 1
      && rm.loader === "bitgen_jinx" && rm.said.some((s) => /experimental/.test(s)) && rm.same, rm);

    // ---- 5 LIVE
    let where = null;
    try { where = await (await fetch(URL_ + "api/outputs/where")).json(); } catch { where = null; }
    const proj = where && (where.dirs || where).find && (where.dirs || where).find((d) => d.where === "project");
    if (!proj) { skip++; console.log("SKIP: no app at " + URL_ + " - the live append / prepend leg did not run"); }
    else {
      const pv = path.join(proj.dir, "video");
      fs.mkdirSync(pv, { recursive: true });
      const name = "fo388_" + process.pid + ".mp4";
      ff(["-f", "lavfi", "-i", "color=c=red:s=192x108:r=24:d=1", "-f", "lavfi", "-i", "color=c=blue:s=192x108:r=24:d=1",
          "-f", "lavfi", "-i", "sine=frequency=500:sample_rate=48000:duration=2",
          "-filter_complex", "[0][1]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(pv, name)]);
      const job = async (op) => {
        const fd = new FormData();
        for (const [k, v] of Object.entries({ prompt: "e2e the clip goes on", width: 192, height: 108, steps: 4, seed: 30, mode: "fl2va",
          frames: 24, pipeline: "auto", format: "mp4", ref_videos: JSON.stringify([name]), ref_video_op: JSON.stringify({ name, op }) })) fd.append(k, String(v));
        const r = await (await fetch(URL_ + "api/generate", { method: "POST", body: fd })).json();
        if (!r.id) return { r };
        let j = null;
        for (let i = 0; i < 300; i++) { j = await (await fetch(URL_ + "api/jobs/" + r.id + "?log_from=0")).json(); if (j.status === "done" || j.status === "failed") break; await sleep(1000); }
        return { r, j };
      };
      const frames = (f) => +execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", f], { encoding: "utf8" }).trim();
      const sizeOf = (f) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", f], { encoding: "utf8" }).trim();
      const outDir = path.join(proj.dir, "output");
      for (const op of ["append", "prepend"]) {
        const { r, j } = await job(op);
        const log = ((j && j.log) || []).join("\n");
        const out = j && j.output ? path.join(outDir, j.output) : "";
        const part = out ? out.replace(/\.mp4$/, "_part.mp4") : "";
        const ok = j && j.status === "done" && fs.existsSync(out) && fs.existsSync(part);
        const nOut = ok ? frames(out) : 0, nPart = ok ? frames(part) : 0;
        check(`LIVE ${op}: the reply says it, the job is fl2va at the video's size with the frame as a reference, the worker ${op}s (48 + part - 1 frames, back at 192x108 - the render 192x128, the 32-px grid floor), the part kept`,
          ok && /frame \(upscaled with/.test(r.note || "") && j.params.mode === "fl2va" && j.params.frame_op.op === op && j.params.width === 192 && j.params.height === 128
          && j.params.reference_files[0].endsWith("frame_op.png") && !j.params.ref_videos.length
          && nOut === 48 + nPart - 1 && sizeOf(out) === "192,108" && new RegExp(`\\[frame-op\\] ${op === "append" ? "appended" : "prepended"}: ${name}`).test(log)
          && /\[frame-op\] the frame scaled to 192x128 \(lanczos\)/.test(log) && /reversed|played backwards/.test(log) === (op === "prepend"),
          { status: j && j.status, note: r.note, err: r.error, nOut, nPart, tail: log.split("\n").filter((l) => /frame-op|error|fail/i.test(l)).slice(-6) });
      }
      fs.rmSync(path.join(pv, name), { force: true });
    }
  } catch (e) {
    check("the run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed${skip ? `, ${skip} skipped` : ""}`);
  process.exit(fail ? 1 : 0);
})();

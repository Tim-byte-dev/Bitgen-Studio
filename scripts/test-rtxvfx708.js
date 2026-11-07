#!/usr/bin/env node
/* bitGen Studio — 2.708.0 unit tests: THE RTX VFX VIDEO FINISHER (lib/rtxvfx.js, scripts/rtxvfx_graph.py, misc/rtxvfx_worker.py,
 * routes/rtxvfx.js, the ⚙ Upscaler "RTX VFX", the preview dock's ✨ RTX VFX + static/rtxvfxpanel.js, Settings' DENO install).
 * Tim (verbatim): "Add the RTX upscale" - the DENO pack's DenoRTXVFXVideoFinisher (NVIDIA RTX VSR / Deblur / High Bitrate).
 *   1. the graph (ONE chunk): loader (skip_first_frames / frame_load_cap) -> the finisher -> combine (no audio, no VHS
 *      meta batch), Tim's widget names and his two presets
 *   2. the live-list check (resolve), the size estimate, the worker's chunks, the lossless concat
 *   3. the options, the job params, isUpscaler / scale from the ⚙, the scene ⏫ / onTake wiring, the ⚙ note
 *   4. REAL WORKER RUNS on the stub ComfyUI: a 2 s 640x360 clip with sound at 48 frames per batch = ONE chunk; at 20 =
 *      3 chunks joined (all 48 frames) - preset B x2 WITH the sound; a ComfyUI without the pack refused with the
 *      installer hint; the pack's own error text passed on with the runtime note
 *   5. the page: the panel, the preview button, the ⚙ option, the install button; no third-party workflow copied */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { execFileSync, spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8" });

(async () => {
  /* 1. the graph */
  const [g, n, gb] = JSON.parse(py("import rtxvfx_graph as R\ng,n = R.build({'video':'in.mp4','prefix':'p/x'})\ngb,_ = R.build({'video':'in.mp4','preset':'twopass','scale':1.5,'skip':40,'cap':20})\nprint(json.dumps([g,n,gb]))"));
  const byCt = (G, ct) => Object.keys(G).find((k) => G[k].class_type === ct);
  const lv = byCt(g, "VHS_LoadVideo"), vi = byCt(g, "VHS_VideoInfoSource"), fx = byCt(g, "DenoRTXVFXVideoFinisher"), vc = byCt(g, "VHS_VideoCombine");
  check("graph: loader IMAGE(0) -> finisher images; finisher 0 -> combine; video_info(3) -> VHS_VideoInfoSource fps(0) -> frame_rate; NO VHS_BatchManager / meta_batch, no audio on the combine (the worker lays it back)",
    lv && vi && fx && vc && !byCt(g, "VHS_BatchManager") && !("meta_batch" in g[lv].inputs) && !("meta_batch" in g[vc].inputs) && !("audio" in g[vc].inputs)
    && g[fx].inputs.images.join() === lv + ",0" && g[vc].inputs.images.join() === fx + ",0"
    && g[vi].inputs.video_info.join() === lv + ",3" && g[vc].inputs.frame_rate.join() === vi + ",0", g);
  const L = g[lv].inputs, F = g[fx].inputs, C = g[vc].inputs;
  check("graph: the loader / combine widgets as Tim's export sets them (force_rate 0 .. select_every_nth 1; h264-mp4, yuv420p, crf 15, loop 0, no metadata, no trim)",
    L.video === "in.mp4" && L.force_rate === 0 && L.custom_width === 0 && L.custom_height === 0 && L.frame_load_cap === 0 && L.skip_first_frames === 0 && L.select_every_nth === 1 && typeof L.format === "string"
    && C.format === "video/h264-mp4" && C.pix_fmt === "yuv420p" && C.crf === 15 && C.loop_count === 0 && C.pingpong === false && C.save_output === true
    && C.save_metadata === false && C.trim_to_audio === false && C.filename_prefix === "p/x", [L, C]);
  check("graph: preset A (VSR) = first_pass Off / Ultra, upscale_pass VSR / High, Scale x2, divisible 32 - every widget name of the finisher",
    F.first_pass === "Off" && F.first_quality === "Ultra" && F.upscale_pass === "VSR" && F.upscale_quality === "High" && F.resize_type === "Scale" && F.scale === 2
    && F.megapixels === 4 && F.width === 3840 && F.height === 2160 && F.divisible_by === "32" && F.ratio_preset === "16:9" && F.resize_method === "Center Crop (Fill)"
    && /VSR \(High\) x2/.test(n.join()), F);
  const FB = gb[byCt(gb, "DenoRTXVFXVideoFinisher")].inputs;
  const LB = gb[byCt(gb, "VHS_LoadVideo")].inputs;
  check("graph: preset B = Deblur / Ultra then High Bitrate / High; the scale; a chunk = VHS_LoadVideo skip_first_frames + frame_load_cap",
    FB.first_pass === "Deblur" && FB.first_quality === "Ultra" && FB.upscale_pass === "High Bitrate" && FB.upscale_quality === "High" && FB.scale === 1.5
    && LB.skip_first_frames === 40 && LB.frame_load_cap === 20, [FB, LB]);

  /* 2. resolve, target, chunks, concat */
  const R = JSON.parse(py(`import rtxvfx_graph as R
base = dict(R.normalize({'preset':'custom','upscale_pass':'Turbo'}), **R.FIXED, format=R.LOAD_FORMAT)
lists = {'first_pass':['Off','Deblur','Denoise'], 'upscale_pass':['VSR','High Bitrate'], 'ratio_preset':['4:3'], 'format':['AnimateDiff','None']}
v1,n1,e1 = R.resolve(base, lists)
v2,n2,e2 = R.resolve(dict(R.normalize({}), **R.FIXED), {})
print(json.dumps([e1, v1['ratio_preset'], n1, v1['format'], e2, R.target(1280,720,2), R.target(640,360,1.5), R.target(0,0,2),
  R.chunks(48,48), R.chunks(48,20), R.chunks(120,0), R.chunks(0,48), R.chunks(100,25),
  R.concat_list(['/w/a.mp4', "/w/it's.mp4"]), R.concat_args('/w/l.txt', '/w/o.mp4'),
  R.normalize({'scale':9,'batch':-3,'preset':'x'}), R.normalize({}), R.normalize({'batch':0})]))`));
  check("resolve: a pass this ComfyUI does not offer is an ERROR naming what it does offer; a soft widget falls back with a note; VHS format 'None' preferred when listed; no lists = nothing refused",
    R[0].length === 1 && /upscale_pass 'Turbo' is not offered/.test(R[0][0]) && /VSR, High Bitrate/.test(R[0][0]) && R[1] === "4:3" && /ratio_preset/.test(R[2].join()) && R[3] === "None" && R[4].length === 0, R.slice(0, 5));
  check("target: about each side x scale to a multiple of 32 (1280x720 x2 = 2560x1440; 640x360 x1.5 = 960x544); no size = an error",
    R[5].width === 2560 && R[5].height === 1440 && R[6].width === 960 && R[6].height === 544 && /size/.test(R[7].error), R.slice(5, 8));
  check("chunks: 48 frames at 48 = one run; at 20 = (0,20) (20,20) (40, to the end); 0 per batch or an unknown count = one run of everything; 100 at 25 = 4",
    JSON.stringify(R[8]) === "[[0,0]]" && JSON.stringify(R[9]) === "[[0,20],[20,20],[40,0]]" && JSON.stringify(R[10]) === "[[0,0]]" && JSON.stringify(R[11]) === "[[0,0]]"
    && JSON.stringify(R[12]) === "[[0,25],[25,25],[50,25],[75,0]]", R.slice(8, 13));
  check("concat: an ffmpeg concat-demuxer list (quotes escaped), joined with -c copy (no re-encode)",
    R[13] === "file '/w/a.mp4'\nfile '/w/it'\\''s.mp4'\n" && R[14].join(" ") === "ffmpeg -y -loglevel error -f concat -safe 0 -i /w/l.txt -c copy /w/o.mp4", R.slice(13, 15));
  check("normalize: scale clamped 1-4, batch 0..4096 (0 = one run), default 48 frames per batch, an unknown preset -> A (VSR)",
    R[15].scale === 4 && R[15].batch === 0 && R[15].preset === "vsr" && R[15].upscale_pass === "VSR" && R[16].batch === 48 && R[17].batch === 0, R.slice(15));

  /* 3. options, params, branches */
  const X = require(path.join(ROOT, "lib", "rtxvfx.js"));
  const nm = X.normalize({ preset: "custom", first_pass: "Deblur", upscale_pass: "High Bitrate", scale: "1.5", batch: "16" });
  const np = X.normalize({ preset: "twopass", first_pass: "Nope" });
  check("lib normalize: custom keeps the passes as given (the live list decides), a preset overrides them, scale / batch numbers",
    nm.first_pass === "Deblur" && nm.upscale_pass === "High Bitrate" && nm.scale === 1.5 && nm.batch === 16 && np.first_pass === "Deblur" && np.upscale_pass === "High Bitrate", [nm, np]);
  const jp = X.jobParams("/x/take.mp4", { width: 1280, height: 720 }, { preset: "twopass", scale: 2 }, { output_name: "take_rtxvfx.mp4", scene: { n: 3 } });
  check("jobParams: mode rtxvfx, the options, about 2560x1440 (asked of rtxvfx_graph.target), the note names RTX + the runtime installer",
    jp.params && jp.params.mode === "rtxvfx" && jp.params.rtx.first_pass === "Deblur" && jp.params.width === 2560 && jp.params.output_name === "take_rtxvfx.mp4" && jp.params.scene.n === 3
    && /NVIDIA RTX/.test(jp.note) && /install_rtx_vfx\.bat/.test(jp.note) && /Deblur \(Ultra\) \+ High Bitrate \(High\)/.test(jp.note), jp);
  check("isUpscaler + the ⚙ resolution as a scale (720p take: 1440 -> x2, 2160 -> x3, 720 -> x1; a 4K target from 360p is capped at x4)",
    X.isUpscaler({ upscaler: "rtxvfx" }) && !X.isUpscaler({ upscaler: "dlss5" }) && !X.isUpscaler(null)
    && X.scaleFromSettings({ upscale_res: "1440" }, { width: 1280, height: 720 }) === 2 && X.scaleFromSettings({ upscale_res: "2160" }, { width: 1280, height: 720 }) === 3
    && X.scaleFromSettings({ upscale_res: "720" }, { width: 1280, height: 720 }) === 1 && X.scaleFromSettings({ upscale_res: "2160" }, { width: 640, height: 360 }) === 4);
  const fakeFetch = (body, ok = true) => async () => ({ ok, json: async () => body });
  const live = await X.liveOptions({ url: "http://x", fetch: fakeFetch({ DenoRTXVFXVideoFinisher: { input: { required: { first_pass: [["Off", "Deblur", "Denoise"]], upscale_pass: ["COMBO", { options: ["VSR", "High Bitrate"] }] } } } }) });
  const none = await X.liveOptions({ url: "http://x", fetch: fakeFetch({}) });
  const off = await X.liveOptions({ url: "http://x", fetch: async () => { throw new Error("refused"); } });
  check("liveOptions: the lists THIS ComfyUI's node offers (every /object_info combo shape); pack absent / ComfyUI offline said, never thrown",
    live.online && live.pack && live.options.first_pass.join() === "Off,Deblur,Denoise" && live.options.upscale_pass.join() === "VSR,High Bitrate"
    && none.online && !none.pack && !off.online, [live, none, off]);
  const RS = require(path.join(ROOT, "lib", "renderSettings.js"));
  const jo = RS.jobOverrides({ upscaler: "rtxvfx", upscale_res: "2160" }, { width: 1280, height: 720, style: { kind: "video" } });
  check("the ⚙ note: 'upscaler ready: RTX VFX -> 2160p'; never an in-render stage", jo.notes.some((x) => /^upscaler ready: RTX VFX -> 2160p/.test(x)) && !jo.upscale_stage, jo.notes);
  const CH = read("routes", "characters.js"), CO = read("lib", "core.js"), IX = read("routes", "index.js"), CM = read("lib", "comfy.js");
  check("wiring: worker map rtxvfx -> rtxvfx_worker.py; /api/rtxvfx mounted; the scene ⏫ branch and the harvest's onTake",
    /rtxvfx: "rtxvfx_worker\.py"/.test(CO) && /require\("\.\/rtxvfx"\)\.mount\(app\)/.test(IX) && /if \(upscale && rtxvfx\.isUpscaler\([\s\S]{0,90}\)\)\s*return rtxvfx\.queueTake\(project, n\);/.test(CH)
    && /rtxvfx\.onTake\(project, r\.n\)/.test(CH) && fs.existsSync(path.join(ROOT, "misc", "rtxvfx_worker.py")) && !/rtxvfx/.test(read("misc", "server.js")));
  check("install: lib/comfy.js repos.deno = the DENO pack cloned into custom_nodes/deno-custom-nodes (the pack's guide path)",
    /deno: \{ url: "https:\/\/github\.com\/Deno2026\/comfyui-deno-custom-nodes\.git",\s*folder: "deno-custom-nodes", label: "DENO custom nodes \(RTX VFX finisher, text-encoder unload\)" \}/.test(CM));
  // the routes, mounted on a bare app
  const routes = [];
  require(path.join(ROOT, "routes", "rtxvfx.js")).mount({ get: (p) => routes.push("GET " + p), post: (p) => routes.push("POST " + p) });
  check("routes: GET/POST /api/rtxvfx/settings, POST /api/rtxvfx/plan, POST /api/rtxvfx",
    ["GET /api/rtxvfx/settings", "POST /api/rtxvfx/settings", "POST /api/rtxvfx/plan", "POST /api/rtxvfx"].every((r) => routes.includes(r)), routes);

  /* 4. REAL worker runs against the stub ComfyUI */
  let haveFf = true;
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { haveFf = false; }
  if (!haveFf) { fail++; console.log("FAIL: ffmpeg is needed for the worker run"); }
  else {
    const T0 = fs.mkdtempSync(path.join(os.tmpdir(), "rtxvfx_")), out = path.join(T0, "out"), work = path.join(T0, "work");
    fs.mkdirSync(out); fs.mkdirSync(work);
    const freePort = () => new Promise((r) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
    const stubs = [];
    const startStub = async (env) => {
      const port = await freePort();
      const st = spawn("python3", [path.join(ROOT, "scripts", "stub-comfy.py"), String(port), path.join(T0, "stub" + port)], { stdio: "ignore", env: { ...process.env, STUB_MODELS_ROOT: path.join(T0, "models"), ...(env || {}) } });
      stubs.push(st);
      for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/system_stats`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
      return port;
    };
    const runJob = (name, job) => {
      fs.writeFileSync(path.join(work, name), JSON.stringify(job));
      try { return { code: 0, log: execFileSync("python3", [path.join(ROOT, "misc", "rtxvfx_worker.py"), path.join(work, name)], { cwd: work, encoding: "utf8", timeout: 180000 }) }; }
      catch (e) { return { code: e.status, log: String(e.stdout || "") + String(e.stderr || "") }; }
    };
    try {
      const src = path.join(T0, "clip.mp4");
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", src]);
      const port = await startStub();
      const job = { params: { mode: "rtxvfx", source: src, rtx: { preset: "twopass", scale: 2, batch: 48 }, output_name: "clip_one.mp4" },
                    config: { engine: { comfy: { url: `http://127.0.0.1:${port}` } } }, output_dir: out };
      const probeOut = (f) => { try { return execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=codec_type,width,height,nb_read_frames", "-of", "csv=p=0", f], { encoding: "utf8" }).trim(); } catch { return ""; } };
      const r0 = runJob("job0.json", job);
      const p0 = probeOut(path.join(out, "clip_one.mp4"));
      const q0 = fs.existsSync(path.join(work, "rtxvfx_queued.json")) ? JSON.parse(fs.readFileSync(path.join(work, "rtxvfx_queued.json"), "utf8")) : {};
      const qf = q0[byCt(q0, "DenoRTXVFXVideoFinisher")] || {}, ql = q0[byCt(q0, "VHS_LoadVideo")] || {};
      check("worker: a 2 s clip (48 frames) at 48 frames per batch = ONE chunk (skip 0, cap 0), preset B x2 -> clip_one.mp4 1280x736 (720 to a multiple of 32), 48 frames, WITH the sound, 4 stages, @@OUT",
        r0.code === 0 && /video,1280,736,48/.test(p0) && /audio/.test(p0) && /48 frames -> 1 chunk \(every frame in one run\)/.test(r0.log) && /chunk 1\/1 - frames 1-end/.test(r0.log)
        && !/joined/.test(r0.log) && /step 4\/4/.test(r0.log) && /@@OUT clip_one\.mp4/.test(r0.log) && /rtxvfx complete/.test(r0.log)
        && qf.inputs && qf.inputs.first_pass === "Deblur" && qf.inputs.upscale_pass === "High Bitrate" && ql.inputs && ql.inputs.skip_first_frames === 0 && ql.inputs.frame_load_cap === 0,
        { code: r0.code, p0, log: r0.log.slice(-1200) });
      const r1 = runJob("job.json", { ...job, params: { ...job.params, rtx: { preset: "twopass", scale: 2, batch: 20 }, output_name: "clip_rtxvfx.mp4" } });
      const p1 = probeOut(path.join(out, "clip_rtxvfx.mp4"));
      check("worker: at 20 frames per batch = 3 chunks (frames 1-20, 21-40, 41-end), each its own run, joined without re-encoding -> 1280x736 with ALL 48 frames and the sound",
        r1.code === 0 && /video,1280,736,48/.test(p1) && /audio/.test(p1) && /48 frames -> 3 chunks of 20 frames/.test(r1.log)
        && /chunk 1\/3 - frames 1-20/.test(r1.log) && /chunk 2\/3 - frames 21-40/.test(r1.log) && /chunk 3\/3 - frames 41-end/.test(r1.log)
        && /joined 3 chunks \(no re-encode\)/.test(r1.log) && /@@OUT clip_rtxvfx\.mp4/.test(r1.log), { code: r1.code, p1, log: r1.log.slice(-1200) });
      const r2 = runJob("job2.json", { ...job, params: { ...job.params, rtx: { preset: "custom", first_pass: "Off", upscale_pass: "Turbo" } } });
      check("worker: a pass this ComfyUI's node does not offer is refused before anything is queued, naming what it offers",
        r2.code !== 0 && /upscale_pass 'Turbo' is not offered by this ComfyUI's DENO nodes - it offers: VSR, High Bitrate/.test(r2.log) && !/queued as/.test(r2.log), r2.log.slice(-500));
      const portB = await startStub({ STUB_RTXVFX_ABSENT: "1" });
      const r3 = runJob("job3.json", { ...job, config: { engine: { comfy: { url: `http://127.0.0.1:${portB}` } } } });
      check("worker: a ComfyUI without the DENO pack - refused in words: the install button, the git URL, install_rtx_vfx.bat, RTX on Windows",
        r3.code !== 0 && /does not have DenoRTXVFXVideoFinisher/.test(r3.log) && /Install DENO nodes \(RTX VFX\)/.test(r3.log) && /install_rtx_vfx\.bat/.test(r3.log) && /Windows only/.test(r3.log), r3.log.slice(-600));
      const portC = await startStub({ STUB_RTXVFX_FAIL: "NVIDIA RTX VFX runtime not found - run tools/install_rtx_vfx.bat" });
      const r4 = runJob("job4.json", { ...job, config: { engine: { comfy: { url: `http://127.0.0.1:${portC}` } } } });
      check("worker: the pack's own error text is passed on (its line), plus where the NVIDIA runtime comes from",
        r4.code !== 0 && /DenoRTXVFXVideoFinisher said: NVIDIA RTX VFX runtime not found/.test(r4.log) && /the NVIDIA RTX VFX runtime is not in the node pack/.test(r4.log), r4.log.slice(-700));
    } finally {
      for (const s of stubs) s.kill();
      try { fs.rmSync(T0, { recursive: true, force: true }); } catch { /* fine */ }
    }
  }

  /* 5. the page */
  const PN = read("static", "rtxvfxpanel.js"), PH = read("ext", "previewdock", "dock.html"), PD = read("ext", "previewdock", "rtxvfx.js"), VX = read("static", "index.html"),
    VD = read("ext", "videodock", "rendersettings.js"), VH = read("ext", "videodock", "dock.html"), PE = JSON.parse(read("ext", "previewdock", "ext.json")).scripts;
  check("the page: ✨ RTX VFX in the preview bar opens static/rtxvfxpanel.js (preset, the four passes, scale, frames per batch; /api/rtxvfx/plan then /api/rtxvfx)",
    /id="pvRtxvfx"/.test(PH) && /RtxVfxPanel\.open\(\{ name: current\(\), from: "preview"/.test(PD) && PE.includes("rtxvfx.js")
    && ["rxPreset", "rxFirst", "rxFirstQ", "rxUp", "rxUpQ", "rxScale", "rxBatch", "rxGo"].every((id) => PN.includes('id="' + id + '"'))
    && /post\("\/api\/rtxvfx\/plan"/.test(PN) && /post\("\/api\/rtxvfx",/.test(PN) && /fetch\("\/api\/rtxvfx\/settings"\)/.test(PN) && /<script src="\/static\/rtxvfxpanel\.js"><\/script>/.test(VX));
  check("the ⚙ Upscaler offers 'RTX VFX (NVIDIA RTX) - the take as its own job' (the dock's markup and the rebuilt list)",
    /value="rtxvfx">RTX VFX \(NVIDIA RTX\) - the take as its own job/.test(VD) && /value="rtxvfx">RTX VFX \(NVIDIA RTX\) - the take as its own job/.test(VH));
  check("Settings -> ComfyUI -> Video accelerators: 'Install DENO nodes (RTX VFX)' with its status label, the runtime note (install_rtx_vfx.bat, Windows)",
    /id="s_vapack_deno"[^>]*data-pack="deno"[^>]*>⬇ Install DENO nodes \(RTX VFX\)</.test(VX) && /id="s_vapacklbl_deno"/.test(VX)
    && /\["kjnodes", "yusu", "veda", "dlss5", "deno"(, "h3latentup")?\]/.test(VX) && /deno: "DENO nodes \(RTX VFX\)"/.test(VX) && /install_rtx_vfx\.bat/.test(VX));
  const ours = ["scripts/rtxvfx_graph.py", "misc/rtxvfx_worker.py", "lib/rtxvfx.js", "routes/rtxvfx.js", "static/rtxvfxpanel.js", "ext/previewdock/rtxvfx.js"].map((f) => read(f)).join("\n");
  check("licence: no workflow JSON / third-party file copied - the graph is built in our code (no UI-export keys, no workflow file in the repo)",
    !/"last_node_id"|"links":\s*\[|"widgets_values"/.test(ours) && !fs.readdirSync(path.join(ROOT, "comfy_workflows")).some((f) => /rtx|deno/i.test(f)));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

#!/usr/bin/env node
/* bitGen Studio — 2.504.0 unit tests: DLSS 5 ENHANCE / UPSCALE / FRAME GENERATION (lib/dlss5.js, scripts/dlss5_graph.py,
 * dlss5_worker.py, routes/dlss5.js, the ⚙ Upscaler "DLSS 5", the preview dock's ⚡ DLSS 5 + static/dlss5panel.js).
 * Tim linked https://github.com/RH-RunningHub/ComfyUI-RH-DLSS5 with his "secret sauce" H3 workflow.
 *   1. the graph = the pack's own example API (class names, inputs, option strings), + frame generation
 *   2. the size rule (fixed factors, 1K-8K buckets, the 7680x4320 envelope)
 *   3. the options, the job params, the scene ⏫ / onTake branches, the ⚙ note
 *   4. A REAL WORKER RUN: dlss5_worker.py against the stub ComfyUI (its DLSS 5 nodes as the pack declares them) - a
 *      2 s 640x360 clip with sound -> 2K (x2 = 1280x720) + 2x frame generation (48 fps), the sound laid back
 *   5. the page: the panel, the preview button, the ⚙ option */
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
  const G = JSON.parse(py("import dlss5_graph as D\ng,n = D.build({'video':'in.mp4','mode':'4K','style':'cinematic','detail':1.2})\ngf,nf = D.build({'video':'in.mp4','fps':'2x'})\nprint(json.dumps([g,n,gf,nf]))"));
  const [g, n, gf, nf] = G;
  const ex = JSON.parse(fs.existsSync("/tmp/ext_repos/ComfyUI-RH-DLSS5/examples/ComfyUI-RH-DLSS5_video_api.json") ? fs.readFileSync("/tmp/ext_repos/ComfyUI-RH-DLSS5/examples/ComfyUI-RH-DLSS5_video_api.json", "utf8") : "null");
  check("graph: LoadVideo -> RH_DLSS5Enhance (video) -> SaveVideo (its VIDEO output 1, format / codec auto) - the pack's example's shape",
    g["1"].class_type === "LoadVideo" && g["1"].inputs.file === "in.mp4" && g["2"].class_type === "RH_DLSS5Enhance" && g["2"].inputs.video[0] === "1"
    && g["2"].inputs.upscaling_mode === "4K" && g["2"].inputs.style === "cinematic" && g["2"].inputs.detail === 1.2
    && g["9"].class_type === "SaveVideo" && g["9"].inputs.video.join() === "2,1" && g["9"].inputs.format === "auto" && g["9"].inputs.codec === "auto" && !g["3"], g);
  check("graph: every Enhance input the pack's own video example sends is sent, with the same option spellings",
    !ex || Object.keys(ex["1"].inputs).every((k) => k in g["2"].inputs && (typeof ex["1"].inputs[k] !== "string" || ["upscaling_mode", "style"].includes(k) || ex["1"].inputs[k] === g["2"].inputs[k])), ex && ex["1"].inputs);
  check("graph + frame generation: RH_DLSS5FrameInterpolation (video = Enhance's VIDEO, output_fps 2x) before SaveVideo",
    gf["3"].class_type === "RH_DLSS5FrameInterpolation" && gf["3"].inputs.video.join() === "2,1" && gf["3"].inputs.output_fps === "2x" && gf["9"].inputs.video.join() === "3,1" && /frame generation/.test(nf.join()), gf);

  /* 2. the size rule */
  const T = JSON.parse(py("import dlss5_graph as D\nprint(json.dumps([D.target(1280,720,'1K'), D.target(1280,720,'2K'), D.target(1280,720,'4K'), D.target(1920,1080,'1K'), D.target(640,360,'4K'), D.target(1280,720,'1.5x (Quality)'), D.target(3840,2160,'3x (Ultra Performance)'), D.target(720,1280,'2K')]))"));
  check("size: 720p -> 1K = 1920x1080 (x1.5), 2K = 2560x1440 (x2), 4K = 3840x2160 (x3); 1080p 1K stays 1x; 360p 4K unreachable; fixed 1.5x; beyond 7680x4320 refused; portrait by its short side",
    T[0].width === 1920 && T[0].factor === 1.5 && T[1].width === 2560 && T[1].factor === 2 && T[2].height === 2160 && T[2].factor === 3 && T[3].factor === 1
    && /cannot reach 4K/.test(T[4].error) && T[5].width === 1920 && /beyond/.test(T[6].error) && T[7].width === 1440 && T[7].height === 2560, T);

  /* 3. options, params, branches */
  const D = require(path.join(ROOT, "lib", "dlss5.js"));
  const nm = D.normalize({ mode: "9K", style: "x", detail: 5, color: -1, fps: "60" });
  check("normalize: unknown mode / style -> defaults (2K, default), strengths clamped, a frame rate from the list",
    nm.mode === "2K" && nm.style === "default" && nm.detail === 2 && nm.color === 0 && nm.fps === "60");
  const jp = D.jobParams("/x/take.mp4", { width: 1280, height: 720 }, { mode: "4K", fps: "2x" }, { output_name: "take_dlss5.mp4", scene: { n: 3 } });
  check("jobParams: mode dlss5, the options, the size DLSS will make (asked of dlss5_graph.target), the note names RTX + the DLL folder",
    jp.params.mode === "dlss5" && jp.params.dlss.mode === "4K" && jp.params.width === 3840 && jp.params.output_name === "take_dlss5.mp4" && jp.params.scene.n === 3
    && /NVIDIA RTX/.test(jp.note) && /models\/dlss5/.test(jp.note) && /frame generation 2x/.test(jp.note), jp);
  check("the ⚙ resolution as a DLSS bucket (720 -> DLAA 1x, 1080 -> 1K, 1440 -> 2K, 2160 -> 4K); isUpscaler",
    D.modeFromSettings({ upscale_res: "720" }) === "1x (DLAA / native)" && D.modeFromSettings({ upscale_res: "2160" }) === "4K" && D.isUpscaler({ upscaler: "dlss5" }) && !D.isUpscaler({ upscaler: "seedvr2" }));
  const RS = require(path.join(ROOT, "lib", "renderSettings.js"));
  const jo = RS.jobOverrides({ upscaler: "dlss5", upscale_res: "2160" }, { width: 1280, height: 720, style: { kind: "video" } });
  check("the ⚙ note: 'upscaler ready: DLSS 5 -> 2160p'; never an in-render stage", jo.notes.some((x) => /^upscaler ready: DLSS 5 -> 2160p/.test(x)) && !jo.upscale_stage, jo.notes);
  const CH = read("routes", "characters.js"), CO = read("lib", "core.js"), IX = read("routes", "index.js");
  check("wiring: worker map dlss5 -> dlss5_worker.py; /api/dlss5 mounted; the scene ⏫ branch and the harvest's onTake",
    /dlss5: "dlss5_worker\.py"/.test(CO) && /require\("\.\/dlss5"\)\.mount\(app\)/.test(IX) && /if \(upscale && dlss5\.isUpscaler\([\s\S]{0,90}\)\)\s*return dlss5\.queueTake\(project, n\);/.test(CH)
    && /dlss5\.onTake\(project, r\.n\)/.test(CH) && fs.existsSync(path.join(ROOT, "dlss5_worker.py")));

  /* 4. a REAL worker run against the stub ComfyUI */
  let haveFf = true;
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { haveFf = false; }
  if (!haveFf) { fail++; console.log("FAIL: ffmpeg is needed for the worker run"); }
  else {
    const T0 = fs.mkdtempSync(path.join(os.tmpdir(), "dlss5_")), out = path.join(T0, "out"), stubOut = path.join(T0, "stub"), work = path.join(T0, "work");
    fs.mkdirSync(out); fs.mkdirSync(work);
    const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
    const stub = spawn("python3", [path.join(ROOT, "scripts", "stub-comfy.py"), String(port), stubOut], { stdio: "ignore", env: { ...process.env, STUB_MODELS_ROOT: path.join(T0, "models") } });
    try {
      for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/system_stats`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
      const src = path.join(T0, "clip.mp4");
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", src]);
      const job = { params: { mode: "dlss5", source: src, dlss: { mode: "2x (Performance)", fps: "2x", style: "natural" }, output_name: "clip_dlss5.mp4" },
                    config: { engine: { comfy: { url: `http://127.0.0.1:${port}` } } }, output_dir: out };
      fs.writeFileSync(path.join(work, "job.json"), JSON.stringify(job));
      let log = "", code = 0;
      try { log = execFileSync("python3", [path.join(ROOT, "dlss5_worker.py"), path.join(work, "job.json")], { cwd: work, encoding: "utf8", timeout: 120000 }); }
      catch (e) { code = e.status; log = String(e.stdout || "") + String(e.stderr || ""); }
      const outFile = path.join(out, "clip_dlss5.mp4");
      let pr = "";
      try { pr = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate", "-of", "csv=p=0", outFile], { encoding: "utf8" }).trim(); } catch { pr = ""; }
      const queued = fs.existsSync(path.join(work, "dlss5_queued.json")) ? JSON.parse(fs.readFileSync(path.join(work, "dlss5_queued.json"), "utf8")) : {};
      check("worker: 640x360 -> DLSS 5 2x (Performance) + 2x frame generation on the stub -> clip_dlss5.mp4 1280x720 at 48 fps WITH the sound, 4 stages, @@OUT",
        code === 0 && /1280,720,48\/1/.test(pr) && /audio/.test(pr) && /step 4\/4/.test(log) && /@@OUT clip_dlss5\.mp4/.test(log) && /dlss5 complete/.test(log)
        && queued["2"] && queued["2"].inputs.style === "natural" && queued["3"] && queued["3"].class_type === "RH_DLSS5FrameInterpolation", { code, pr, log: log.slice(-900) });
      // a ComfyUI without the pack: refused in words with the install hint
      const job2 = { ...job, params: { ...job.params, dlss: { mode: "4K" } } };
      const T2 = path.join(T0, "small.mp4");
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-t", "1", "-pix_fmt", "yuv420p", T2]);
      job2.params.source = T2;
      fs.writeFileSync(path.join(work, "job2.json"), JSON.stringify(job2));
      let log2 = "";
      try { execFileSync("python3", [path.join(ROOT, "dlss5_worker.py"), path.join(work, "job2.json")], { cwd: work, encoding: "utf8" }); } catch (e) { log2 = String(e.stdout || ""); }
      check("worker: a size DLSS cannot reach (180p -> 4K) is refused in words before anything is queued", /cannot reach 4K/.test(log2), log2.slice(-300));
    } finally {
      stub.kill();
      try { fs.rmSync(T0, { recursive: true, force: true }); } catch { /* fine */ }
    }
  }

  /* 5. the page */
  const PN = read("static", "dlss5panel.js"), PH = read("ext", "previewdock", "dock.html"), PD = read("ext", "previewdock", "dlss5.js"), VX = read("static", "index.html"),
    VD = read("ext", "videodock", "rendersettings.js"), VH = read("ext", "videodock", "dock.html"), PE = JSON.parse(read("ext", "previewdock", "ext.json")).scripts;
  check("the page: ⚡ DLSS 5 in the preview bar opens static/dlss5panel.js (size, style, detail, structure, frame generation; /api/dlss5/plan then /api/dlss5); the ⚙ Upscaler offers DLSS 5",
    /id="pvDlss5"/.test(PH) && /Dlss5Panel\.open\(\{ name: current\(\), from: "preview"/.test(PD) && PE.includes("dlss5.js")
    && ["dlMode", "dlStyle", "dlDetail", "dlStructure", "dlFps", "dlGo"].every((id) => PN.includes('id="' + id + '"'))
    && /post\("\/api\/dlss5\/plan"/.test(PN) && /post\("\/api\/dlss5",/.test(PN) && /<script src="\/static\/dlss5panel\.js"><\/script>/.test(VX)
    && /value="dlss5">DLSS 5 \(NVIDIA RTX\)/.test(VD) && /value="dlss5">DLSS 5/.test(VH));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

#!/usr/bin/env node
/* bitGen Studio — 2.400.0: SeedVR2 video upscaling (lib/seedvr2.js, routes/seedvr2.js) + the queue's merged running
 * card (static/queuerun.js).
 * Tim (verbatim): "in the queue docker merge the running card with the running cards details and progress card, add
 * seedvr2 for upscaling videos - seedvr2_7b_sharp_fp16.safetensors - ...utility_seedvr2_3b_int8_upscale_video.json"
 *   1. lib/seedvr2: normalize (sizes, colours, 4n+1 split, denoise, a model name only), target (a short side / a
 *      factor, even sizes, smaller refused), resolve (names only, the project's folders), jobParams, the ⚙ link;
 *   2. renderSettings: the ⚙ Upscaler "seedvr2" is never an in-render MMH3 stage (said);
 *   3. QueueRun: pct over chunks, the step / time words, the id line, which job the RUNNING row stands for;
 *   4. the wiring (worker map, route mount, the scene ⏫ branch, the harvest, the catalog, the preview button, the ⚙);
 *   5. LIVE (the running app, H3_URL - default the e2e server on :8311, its stub ComfyUI's models folder): settings
 *      round trip, /plan, a real job x2 on a clip in output/ -> done, 640x384 with the sound, the merged log words.
 * Run from repo root: node scripts/test-seedvr2.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const SV = require(path.join(ROOT, "lib", "seedvr2.js"));
const RS = require(path.join(ROOT, "lib", "renderSettings.js"));
const QR = require(path.join(ROOT, "static", "queuerun.js"));
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0, skip = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

(async () => {
  // 1
  const n = SV.normalize({ size: "x4", color: "adain", chunk: "23", overlap: 40, denoise: 0.333, model: "../x.safetensors", seed: "12" });
  check("normalize: x4, adain, 23 -> 21 (4n+1), overlap capped 16, denoise 0.33, a path refused, the seed",
    n.size === "x4" && n.color === "adain" && n.chunk === "21" && n.overlap === 16 && n.denoise === 0.33 && n.model === "" && n.seed === 12, n);
  const d = SV.normalize({ size: "999", color: "pink", chunk: "x", model: "seedvr2_7b_sharp_fp16.safetensors" });
  check("normalize: unknown size / colour / split -> the defaults (1080, lab, auto); a model file name kept",
    d.size === "1080" && d.color === "lab" && d.chunk === "auto" && d.model === "seedvr2_7b_sharp_fp16.safetensors" && d.seed === -1, d);
  const t1 = SV.target("1080", 320, 192), t2 = SV.target("x2", 321, 191), t3 = SV.target("720", 1920, 1080), t4 = SV.target("1080", 1080, 1920);
  check("target: 1080p of 320x192 = 1800x1080 (x5.625); x2 of an odd size = even; a portrait clip's short side; smaller refused in words",
    t1.width === 1800 && t1.height === 1080 && t1.mult === 5.625 && t2.width === 642 && t2.height === 382
    && /already 1920x1080/.test(t3.error || "") && t4.width === 1080 && t4.height === 1920 && /could not read/.test(SV.target("1080", 0, 0).error), { t1, t2, t3, t4 });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sv400-"));
  for (const sub of ["output", "final", "video"]) fs.mkdirSync(path.join(tmp, sub));
  fs.writeFileSync(path.join(tmp, "video", "scene1_x.mp4"), "x");
  fs.writeFileSync(path.join(tmp, "output", "a.mp4"), "x");
  check("resolve: a Video asset / an output by NAME; a path is cut to its name; not a video / missing -> null",
    SV.resolve(tmp, "scene1_x.mp4") === path.join(tmp, "video", "scene1_x.mp4") && SV.resolve(tmp, "../../etc/a.mp4") === path.join(tmp, "output", "a.mp4")
    && SV.resolve(tmp, "a.png") === null && SV.resolve(tmp, "nope.mp4") === null);
  const jp = SV.jobParams("/p/output/a.mp4", { width: 320, height: 192 }, { size: "x2", color: "none", chunk: "off" }, { start: 1, duration: 2, output_name: "o.mp4" });
  check("jobParams: mode seedvr2, the source, 640x384, the options, the window, the name, a label for the queue; the note says it",
    jp.params.mode === "seedvr2" && jp.params.source === "/p/output/a.mp4" && jp.params.width === 640 && jp.params.height === 384
    && jp.params.color === "none" && jp.params.chunk === "off" && jp.params.start === 1 && jp.params.duration === 2 && jp.params.output_name === "o.mp4"
    && /SeedVR2 ⏫ a\.mp4/.test(jp.params.prompt) && /320x192 -> 640x384/.test(jp.note), jp);
  check("the ⚙ link: upscaler 'seedvr2' = SeedVR2; the ⚙ Upscale resolution is its size (1440), unknown -> 1080",
    SV.isUpscaler({ upscaler: "seedvr2" }) && !SV.isUpscaler({ upscaler: "x.safetensors" })
    && SV.sizeFromSettings({ upscale_res: "1440" }) === "1440" && SV.sizeFromSettings({}) === "1080");
  SV.save(tmp, { size: "2160", color: "wavelet" });
  check("save / read: the project's seedvr2.json", SV.read(tmp).size === "2160" && SV.read(tmp).color === "wavelet" && fs.existsSync(path.join(tmp, "seedvr2.json")));
  fs.rmSync(tmp, { recursive: true, force: true });

  // 2
  const jo = RS.jobOverrides({ upscaler: "seedvr2", upscale_res: "1440", upscale_auto: true }, { width: 960, height: 544 });
  const jo2 = RS.jobOverrides({ upscaler: "seedvr2", upscale_res: "1080" }, { width: 960, height: 544 });
  check("renderSettings: SeedVR2 is never an MMH3 in-render stage - 'queued as each take lands' / '⏫ upscales a take'",
    jo.upscale_stage === null && jo.notes.some((x) => /SeedVR2 -> 1440p, queued as each take lands/.test(x))
    && jo2.upscale_stage === null && jo2.notes.some((x) => /SeedVR2 -> 1080p - ⏫ upscales a take/.test(x)), { a: jo.notes, b: jo2.notes });

  // 3
  check("QueueRun.pct: chunk 1/2 step 3 of 8 = 19%; one chunk 4 of 8 = 50%; loading = null",
    QR.pct({ step: 3, total: 8, chunk: { i: 1, n: 2 } }) === 19 && QR.pct({ step: 4, total: 8 }) === 50 && QR.pct({ step: null, total: null }) === null && QR.pct(null) === null);
  check("QueueRun.runText: 'chunk 1/2 · step 3 of 8 · 1:11', loading, waiting for the GPU",
    QR.runText({ step: 3, total: 8, elapsed: 71, chunk: { i: 1, n: 2 } }) === "chunk 1/2 · step 3 of 8 · 1:11"
    && QR.runText({ elapsed: 5 }) === "loading · 0:05" && QR.runText(null, "queued") === "waiting for the GPU");
  check("QueueRun.idLine + mergedJobId: 'ab12 · ref2va · 960×544'; the RUNNING row's job only",
    QR.idLine({ id: "ab12", params: { mode: "ref2va", width: 960, height: 544 } }) === "ab12 · ref2va · 960×544"
    && QR.mergedJobId([{ status: "waiting", jobId: "x" }, { status: "running", jobId: "j1" }], "running") === "j1"
    && QR.mergedJobId([{ status: "running", jobId: null }], "running") === null);

  // 4
  const core = read("lib/core.js"), idx = read("routes/index.js"), ch = read("routes/characters.js"), html = read("static/index.html");
  const cat = JSON.parse(read("lib/modelCatalog.json"));
  const sharp = cat.models.find((m) => m.id === "seedvr2_sharp");
  check("wiring: worker map seedvr2 -> seedvr2_worker.py; /api/seedvr2 mounted; the scene ⏫ branch + the harvest; the catalog's sharp 7B fp16 + 3B",
    /seedvr2: "seedvr2_worker\.py"/.test(core) && /require\("\.\/seedvr2"\)\.mount\(app\)/.test(idx)
    && /seedvr2\.isUpscaler\(renderSettings\.read[^\n]*\n\s*return seedvr2\.queueTake\(project, n\)/.test(ch) && /seedvr2\.onTake\(project, r\.n\)/.test(ch)
    && sharp && sharp.file === "diffusion_models/seedvr2_7b_sharp_fp16.safetensors" && sharp.repo === "Comfy-Org/SeedVR2"
    && cat.models.some((m) => m.id === "seedvr2_3b") && fs.existsSync(path.join(ROOT, "misc", "seedvr2_worker.py")));
  check("wiring: the merged card (queuerun.js loaded, paint in paintQueue + refreshJobs + the stats poll, the job list skips it); the preview ⏫ SeedVR2; the ⚙ option",
    /<script src="\/static\/queuerun\.js"><\/script>/.test(html) && (html.match(/QueueRun\.paint\(/g) || []).length === 3
    && /!\(j\.id === merged && PENDING_ST\(j\.status\)\)/.test(html)
    && /id="pvSeedvr2"/.test(read("ext/previewdock/dock.html")) && /"seedvr2\.js"/.test(read("ext/previewdock/ext.json"))
    && /value="seedvr2">SeedVR2 \(video\)/.test(read("ext/videodock/rendersettings.js")));

  // 5 LIVE
  let where = null;
  try { where = await (await fetch(URL_ + "api/outputs/where")).json(); } catch { where = null; }
  const proj = where && (where.dirs || where).find && (where.dirs || where).find((x) => x.where === "project");
  let haveFf = true;
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { haveFf = false; }
  const MODELS = process.env.STUB_MODELS_ROOT || "/tmp/e2e_comfy/ComfyUI/models";
  if (!proj || !haveFf) { skip++; console.log("SKIP: no app at " + URL_ + " (or no ffmpeg) - the live legs did not run"); }
  else {
    const J = (u, b) => fetch(URL_ + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined)
      .then(async (r) => ({ status: r.status, j: await r.json() }));
    const before = (await J("api/seedvr2/settings")).j.settings;
    const sv = await J("api/seedvr2/settings", { size: "1440", color: "adain" });
    const back = (await J("api/seedvr2/settings")).j;
    check("LIVE settings: saved (1440, adain) and read back with the choices",
      sv.status === 200 && back.settings.size === "1440" && back.settings.color === "adain" && back.sizes.includes("x2") && back.default_model === "seedvr2_7b_sharp_fp16.safetensors", back);
    const out = path.join(proj.dir, "output");
    fs.mkdirSync(out, { recursive: true });
    const name = `sv_e2e_${process.pid}.mp4`;
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x192:rate=24", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000",
      "-t", "2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", path.join(out, name)]);
    const pl = await J("api/seedvr2/plan", { name, size: "1080" });
    const bad = await J("api/seedvr2/plan", { name: "nope.mp4" });
    const small = await J("api/seedvr2/plan", { name, size: "720" });
    check("LIVE /plan: 320x192 -> 1800x1080 (x5.625); an unknown name / a 720p of a smaller... refused in words",
      pl.status === 200 && pl.j.target.width === 1800 && pl.j.target.height === 1080 && pl.j.source.width === 320
      && bad.status === 400 && /not a video in this project/.test(bad.j.error) && small.status === 200 && small.j.target.height === 720, { pl, bad, small });
    // the stub ComfyUI lists what is in its models folder - a SeedVR2 file + the VAE for the job
    const made = [];
    for (const [sub, f] of [["diffusion_models", "seedvr2_7b_sharp_fp16.safetensors"], ["vae", "seedvr2_ema_vae_fp16.safetensors"]]) {
      const p = path.join(MODELS, sub, f);
      if (!fs.existsSync(p)) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "x"); made.push(p); }
    }
    const q = await J("api/seedvr2", { name, size: "x2", color: "none", chunk: "auto" });
    let job = null;
    for (let i = 0; q.j.id && i < 180; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      job = (await J(`api/jobs/${q.j.id}?log_from=0`)).j;
      if (["done", "failed", "cancelled"].includes(job.status)) break;
    }
    const log = ((job && job.log) || []).join("\n");
    let pr = "";
    try { pr = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "csv=p=0", path.join(out, job.output)], { encoding: "utf8" }).trim(); } catch { pr = ""; }
    check("LIVE ⏫ x2 on a clip in output/: queued (mode seedvr2), done on the stub ComfyUI -> <name>_seedvr2_384p.mp4 640x384 with the sound, the sharp 7B, 4 stages in the log",
      q.status === 200 && q.j.target.width === 640 && job && job.status === "done" && job.output === name.replace(".mp4", "_seedvr2_384p.mp4")
      && /640,384/.test(pr) && /audio/.test(pr) && /model seedvr2_7b_sharp_fp16\.safetensors/.test(log) && /step 4\/4/.test(log) && /seedvr2 complete/.test(log),
      { q: q.j, status: job && job.status, out: job && job.output, pr, log: log.slice(-900) });
    try { fs.rmSync(path.join(out, name), { force: true }); if (job && job.output) fs.rmSync(path.join(out, job.output), { force: true }); } catch { /* fine */ }
    for (const p of made) try { fs.rmSync(p, { force: true }); } catch { /* fine */ }
    await J("api/seedvr2/settings", before);
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed${skip ? ", " + skip + " skipped" : ""}`);
  process.exit(fail ? 1 : 0);
})();

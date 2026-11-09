#!/usr/bin/env node
/* bitGen Studio — 2.743.0 units + the adapter end to end: RUNPOD SERVERLESS (lib/runpodServerless.js,
 * routes/runpodServerless.js, lib/remoteGpu.js "serverless", lib/modelsFound.js).
 * Tim (verbatim): "can we try using a runpod serverless gpu?"
 *   pure    adapt (VHS_VideoCombine -> CreateVideo + SaveVideo; SaveAudio* -> the sound in a 16x16 video - input names as
 *           ComfyUI's source names them; the workflow given is not changed), inputNames, buildRun (10 MB), toHistory,
 *           audioName, parseMultipart, health
 *   live    a stand-in RunPod (/v2/<endpoint>/run, /status, /cancel, /health - the worker-comfyui 5.x shapes) + the adapter's
 *           routes on an express app + an in-memory config; THE APP'S OWN PYTHON CLIENT (scripts/comfy_client.py) uploads a
 *           picture, queues, waits and downloads a picture, a video and a song (taken out of its carrier video with
 *           ffmpeg) - exactly as a worker does; a failed job, a job over 10 MB, a bucket (s3_url) result, a cancel.
 * Not run here: RunPod itself (it needs an account and an endpoint). */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rpsl743-"));
let CFG = { engine: { comfy: { url: "http://127.0.0.1:8188", autostart: true } }, rgpu: { mode: "local", runpod: { key: "rpa_TESTKEY" }, serverless: { endpoint: "ep123", cost_hr: 1.2 } } };
const corePath = require.resolve("../lib/core.js");
require.cache[corePath] = { id: corePath, filename: corePath, loaded: true, exports: { BASE: ROOT, WORKSPACE: TMP, getConfig: () => JSON.parse(JSON.stringify(CFG)), setConfig: (c) => { CFG = JSON.parse(JSON.stringify(c)); } } };
const S = require("../lib/runpodServerless.js");
const R = require("../lib/remoteGpu.js");
const wf = (f) => JSON.parse(read("comfy_workflows", f));
const nodesOf = (g) => Object.entries(g).filter(([k, n]) => !k.startsWith("_") && n && typeof n === "object");
const dangling = (g) => nodesOf(g).flatMap(([k, n]) => Object.entries(n.inputs || {}).filter(([, v]) => Array.isArray(v) && v.length === 2 && typeof v[1] === "number" && !g[String(v[0])]).map(([i, v]) => [k, i, v]));

(async () => {
  /* ---------------- pure */
  const rip = wf("LTX_Ripple_FFAF_Edit_v11_api.json"), rip0 = JSON.stringify(rip);
  const a1 = S.adapt(rip);
  const sv = a1.graph["780"], cv = a1.graph[sv.inputs.video[0]];
  check("adapt: a VHS_VideoCombine becomes SaveVideo (same id) fed by CreateVideo - its pictures, fps and sound wired through",
    sv.class_type === "SaveVideo" && cv.class_type === "CreateVideo" && JSON.stringify(cv.inputs.images) === '["782",0]' && cv.inputs.fps === 24
      && JSON.stringify(cv.inputs.audio) === '["790",2]' && sv.inputs.filename_prefix === "Ripple_Edit/ltx", { sv, cv });
  // ComfyUI's source: comfy_extras/nodes_video.py CreateVideo (images, fps, audio?) / SaveVideo (video, filename_prefix, format, codec)
  check("…the inputs named as ComfyUI's CreateVideo / SaveVideo name them (SaveVideo written as the studio's MiniMax H3 workflows write it)",
    Object.keys(cv.inputs).every((k) => ["images", "fps", "audio"].includes(k)) && Object.keys(sv.inputs).sort().join() === "codec,filename_prefix,format,video"
      && sv.inputs.format === wf("ref2va.json")["92"].inputs.format && sv.inputs.codec === wf("ref2va.json")["92"].inputs.codec, { cv: cv.inputs, sv: sv.inputs });
  check("…a silent one gets no audio input; every VHS_VideoCombine saved is changed; no link left dangling; the workflow given is not touched",
    !("audio" in a1.graph[a1.graph["786"].inputs.video[0]].inputs) && !nodesOf(a1.graph).some(([, n]) => n.class_type === "VHS_VideoCombine")
      && dangling(a1.graph).length === 0 && JSON.stringify(rip) === rip0, dangling(a1.graph));
  const vig = S.adapt(wf("viggle_animate_h3_api.json")).graph;
  check("…a preview (save_output false) is left alone - nothing to bring back", vig["30"].class_type === "VHS_VideoCombine" && vig["21"].class_type === "SaveVideo");
  const ace = S.adapt(wf("audio_ace_step_1_5.json"));
  const asv = ace.graph["107"], acv = ace.graph[asv.inputs.video[0]], aei = ace.graph[acv.inputs.images[0]];
  check("adapt: a song's save node (SaveAudioAdvanced, mp3) -> EmptyImage 16x16 x 1800 at 1 fps + CreateVideo(the sound) + SaveVideo h3audio-mp3-…",
    asv.class_type === "SaveVideo" && acv.class_type === "CreateVideo" && aei.class_type === "EmptyImage" && JSON.stringify(acv.inputs.audio) === '["18",0]'
      && acv.inputs.fps === 1 && aei.inputs.batch_size === 1800 && aei.inputs.width === 16 && /^h3audio-mp3-audio_ace_step_1_5$/.test(asv.inputs.filename_prefix), { asv, acv, aei });
  // nodes.py EmptyImage: width, height, batch_size (max 4096), color
  check("…EmptyImage's inputs as nodes.py names them, within its limits; no link dangling",
    Object.keys(aei.inputs).sort().join() === "batch_size,color,height,width" && aei.inputs.batch_size <= 4096 && dangling(ace.graph).length === 0);
  const lin = { 1: { class_type: "VHS_VideoCombine", inputs: { images: ["2", 0], frame_rate: 8 } }, 2: { class_type: "EmptyImage", inputs: {} }, 3: { class_type: "Foo", inputs: { x: ["1", 0] } } };
  check("…a VHS_VideoCombine wired into another node is left as it is (said in the notes)", S.adapt(lin).graph["1"].class_type === "VHS_VideoCombine" && /wired into another node/.test(S.adapt(lin).notes.join()));

  const g2 = { 1: { class_type: "LoadImage", inputs: { image: "me.png" } }, 2: { class_type: "LoadAudio", inputs: { audio: "song.mp3 [input]" } }, 3: { class_type: "X", inputs: { t: "a prompt", m: "model.safetensors" } } };
  check("inputNames: the strings that name an uploaded file (a [input] tag dropped); nothing else", S.inputNames(g2, (n) => ["me.png", "song.mp3"].includes(n)).join() === "me.png,song.mp3");
  let big = null; try { S.buildRun(g2, [{ name: "long.mp4", buf: Buffer.alloc(8 * 1048576) }]); } catch (e) { big = e; }
  check("buildRun: past RunPod's 10 MB (base64 adds a third) -> 413 that names the file and what to do", big && big.status === 413 && /long\.mp4 8\.0 MB/.test(big.message) && /10 MB/.test(big.message), big && big.message);
  const ok = S.buildRun(g2, [{ name: "me.png", buf: Buffer.from("PNG") }]);
  check("…under it: {input: {workflow, images: [{name, image (base64)}]}} - worker-comfyui's input", JSON.parse(ok.body).input.images[0].image === "UE5H" && JSON.parse(ok.body).input.workflow["1"].inputs.image === "me.png");
  check("audioName: the carrier's name -> the song's", JSON.stringify(S.audioName("h3audio-mp3-song_00001_.mp4")) === '{"ext":"mp3","name":"song_00001_.mp3"}' && S.audioName("clip_00001_.mp4") === null);
  const h1 = S.toHistory({ status: "COMPLETED", output: { images: [] } }, [{ filename: "a_00001_.png", node: "9" }, { filename: "v_00001_.mp4", node: "12" }, { filename: "s_00001_.mp3" }], "pid1");
  check("toHistory: ComfyUI's success shape - under the node that wrote each, pictures / videos / sound by extension, subfolder = the job", h1.status.status_str === "success" && h1.outputs["9"].images[0].filename === "a_00001_.png"
    && h1.outputs["12"].videos[0].subfolder === "pid1" && h1.outputs.runpod.audio[0].type === "output", h1);
  const sl = S.savers({ 1: { class_type: "SaveImage", inputs: { filename_prefix: "img/pic" } }, 2: { class_type: "SaveVideo", inputs: { filename_prefix: "video/pic_long" } }, 3: { class_type: "KSampler", inputs: { filename_prefix: "pic" } } });
  check("savers / nodeFor: a result goes under the save node whose filename_prefix it starts with (the longest that fits)", S.nodeFor("pic_long_00001_.mp4", sl) === "2" && S.nodeFor("pic_00001_.png", sl) === "1"
    && S.nodeFor("zzz.png", sl) === "runpod" && S.nodeFor("x.png", [{ id: "7", stem: "y" }]) === "7", sl);
  const h2 = S.toHistory({ status: "FAILED", output: { error: "Workflow validation failed", details: ["Node 5: model missing"] } }, [], "p");
  const h3 = S.toHistory({ status: "COMPLETED", output: { images: [], status: "success_no_images" } }, [], "p");
  check("…a failure / no files: an execution_error message with the endpoint's own words", h2.status.status_str === "error" && /model missing/.test(JSON.stringify(h2)) && h3.status.status_str === "error" && /sent no files back/.test(JSON.stringify(h3)));
  const mp = Buffer.concat([Buffer.from('--BB\r\nContent-Disposition: form-data; name="image"; filename="pic one.png"\r\nContent-Type: application/octet-stream\r\n\r\n'), Buffer.from([1, 2, 13, 10, 3]), Buffer.from('\r\n--BB\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--BB--\r\n')]);
  const pm = S.parseMultipart(mp, "multipart/form-data; boundary=BB");
  check("parseMultipart: comfy_client's upload -> the file's name and bytes (CRLF inside kept)", pm && pm.name === "pic one.png" && pm.buf.equals(Buffer.from([1, 2, 13, 10, 3])), pm);
  check("health: one line - ready / running workers, waiting jobs; no worker = says the first job starts one",
    /1 ready, 0 running/.test(S.health({ workers: { idle: 1, running: 0 }, jobs: { inQueue: 2 } })) && /cold start/.test(S.health({ workers: {}, jobs: {} })));

  /* ---------------- Remote GPU: the mode */
  check("remoteGpu: MODES has serverless; describe -> the app's own /rpsl and the endpoint's $/hour", R.MODES.includes("serverless")
    && R.describe({ mode: "serverless", serverless: { endpoint: "ep1", cost_hr: 2 } }).url === `http://127.0.0.1:${parseInt(process.env.H3_PORT, 10) || 8311}/rpsl` && R.describe({ mode: "serverless", serverless: { endpoint: "ep1", cost_hr: 2 } }).cost_hr === 2);
  R.save({ serverless: { endpoint: " ep 9!x ", cost_hr: 3.5 } });
  check("…save keeps the endpoint (cleaned) and $/hour", CFG.rgpu.serverless.endpoint === "ep9x" && CFG.rgpu.serverless.cost_hr === 3.5, CFG.rgpu.serverless);
  R.use("serverless");
  check("…Use it: ComfyUI's URL = /rpsl, not started here; This computer puts it back", CFG.engine.comfy.url.endsWith("/rpsl") && CFG.engine.comfy.autostart === false && CFG.rgpu.mode === "serverless");
  R.use("local");
  check("…", CFG.engine.comfy.url === "http://127.0.0.1:8188" && CFG.engine.comfy.autostart === true);
  const MF = read("lib", "modelsFound.js");
  check("models check: Serverless (and the SSH tunnel, also 127.0.0.1) count as remote - no downloads offered for this computer", /rmode === "ssh" \|\| rmode === "serverless"/.test(MF) && /RunPod Serverless endpoint - its models are on its network volume/.test(MF));
  CFG.rgpu.serverless.endpoint = "ep123";

  /* ---------------- live: a stand-in RunPod + the adapter + the app's Python client */
  const media = path.join(TMP, "media"); fs.mkdirSync(media);
  const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);
  ff(["-f", "lavfi", "-i", "color=c=red:s=32x32:d=1", "-frames:v", "1", path.join(media, "out.png")]);
  ff(["-f", "lavfi", "-i", "testsrc=s=64x64:d=1:r=8", "-f", "lavfi", "-i", "sine=f=440:d=1", "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", path.join(media, "clip.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=black:s=16x16:r=1:d=30", "-f", "lavfi", "-i", "sine=f=220:d=3", "-shortest", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", path.join(media, "carrier.mp4")]);
  const RP = { runs: [], polls: {}, cancelled: [], auth: [] };
  const b64 = (f) => fs.readFileSync(path.join(media, f)).toString("base64");
  const rpSrv = http.createServer((req, res) => {
    let body = ""; req.on("data", (d) => { body += d; });
    req.on("end", () => {
      RP.auth.push(req.headers.authorization);
      const j = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
      let m;
      if (req.url === "/bucket/out.png") { res.writeHead(200); res.end(fs.readFileSync(path.join(media, "out.png"))); return; }
      if (!/^\/v2\/ep123\//.test(req.url)) { j(404, { error: "no endpoint" }); return; }
      if (req.headers.authorization !== "Bearer rpa_TESTKEY") { j(401, { error: "unauthorized" }); return; }
      if (req.url.endsWith("/health")) { j(200, { jobs: { completed: 3, failed: 0, inProgress: 1, inQueue: 0, retried: 0 }, workers: { idle: 1, running: 1 } }); return; }
      if (req.method === "POST" && req.url.endsWith("/run")) { const inp = JSON.parse(body).input; const id = "job" + RP.runs.length; RP.runs.push({ id, inp, bytes: body.length }); j(200, { id, status: "IN_QUEUE" }); return; }
      if ((m = /\/cancel\/(\w+)$/.exec(req.url))) { RP.cancelled.push(m[1]); j(200, { id: m[1], status: "CANCELLED" }); return; }
      if ((m = /\/status\/(\w+)$/.exec(req.url))) {
        const run = RP.runs.find((r) => r.id === m[1]); RP.polls[m[1]] = (RP.polls[m[1]] || 0) + 1;
        if (RP.cancelled.includes(m[1])) { j(200, { id: m[1], status: "CANCELLED" }); return; }
        if (RP.polls[m[1]] < 2) { j(200, { id: m[1], status: "IN_PROGRESS" }); return; }
        const wfj = run.inp.workflow;
        if (wfj.fail) { j(200, { id: m[1], status: "COMPLETED", output: { error: "Workflow validation failed", details: ["Node 4 (UNETLoader): unet_name 'nope.safetensors' not in list"] } }); return; }
        const images = [];
        for (const n of Object.values(wfj)) {
          if (!n || !n.class_type) continue;
          if (n.class_type === "SaveImage") images.push(wfj.s3 ? { filename: "pic_00001_.png", type: "s3_url", data: `http://127.0.0.1:${rpSrv.address().port}/bucket/out.png` } : { filename: "pic_00001_.png", type: "base64", data: b64("out.png") });
          if (n.class_type === "SaveVideo") {
            const pre = String(n.inputs.filename_prefix).split("/").pop();
            images.push({ filename: pre + "_00001_.mp4", type: "base64", data: b64(/^h3audio-/.test(pre) ? "carrier.mp4" : "clip.mp4") });
          }
        }
        j(200, { id: m[1], status: "COMPLETED", output: { images }, delayTime: 1200, executionTime: 3400 }); return;
      }
      j(404, { error: "?" });
    });
  });
  await new Promise((r) => rpSrv.listen(0, "127.0.0.1", r));
  process.env.H3_RUNPOD_SLS_API = `http://127.0.0.1:${rpSrv.address().port}/v2`;
  const express = require("express");
  const app = express();
  require("../routes/runpodServerless").early(app);
  app.use(express.json());
  require("../routes/runpodServerless").mount(app);
  const appSrv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const BASE = `http://127.0.0.1:${appSrv.address().port}/rpsl`;
  const t1 = await fetch(BASE.replace("/rpsl", "") + "/api/remotegpu/serverless/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json());
  check("✓ Test: RunPod's /health with the saved key + endpoint -> one line", t1.ok && /1 ready, 1 running/.test(t1.line), t1);
  const t2 = await fetch(BASE.replace("/rpsl", "") + "/api/remotegpu/serverless/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "wrong" }) }).then((r) => r.json());
  check("…a wrong key: 'RunPod refused the API key'", !t2.ok && /refused the API key/.test(t2.error), t2);
  const ss = await fetch(BASE + "/system_stats").then((r) => r.json());
  const oi = await fetch(BASE + "/object_info/KSampler");
  check("/system_stats answers (preflight passes; no card here); /object_info is a 404 (the workers go on without it)", /RunPod Serverless/.test(ss.system.comfyui_version) && Array.isArray(ss.devices) && oi.status === 404);

  // the app's own Python client, as a worker uses it
  const big8 = path.join(media, "big.mp4"); fs.writeFileSync(big8, Buffer.alloc(8 * 1048576, 7));
  const job = {
    base: BASE, pic: path.join(media, "out.png"), out: path.join(TMP, "dl"), big: big8,
    image: { 1: { class_type: "LoadImage", inputs: { image: "__UP__" } }, 2: { class_type: "SaveImage", inputs: { images: ["1", 0], filename_prefix: "pic" } } },
    video: S.adapt({}).graph && wf("LTX_Ripple_FFAF_Edit_v11_api.json"),
    song: wf("audio_ace_step_1_5.json"),
  };
  fs.mkdirSync(job.out);
  fs.writeFileSync(path.join(TMP, "job.json"), JSON.stringify(job));
  const py = `
import json, sys, os
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_client as cc
J = json.load(open(sys.argv[1])); B = J["base"]; R = {}
cc.preflight(B)
R["missing"] = cc.missing_classes(B, J["image"])
up = cc.upload_image(B, J["pic"]); R["up"] = up
g = J["image"]; g["1"]["inputs"]["image"] = up
outs = cc.wait(B, cc.queue(B, g), timeout=60, poll=0.3)
it = cc.output_images(outs)[0]; R["img"] = os.path.getsize(cc.download(B, it, os.path.join(J["out"], it["filename"])))
outs = cc.wait(B, cc.queue(B, J["video"]), timeout=60, poll=0.3)
R["vids"] = [v["filename"] for v in cc.output_videos(outs)]
v = cc.output_videos(outs)[0]; cc.download(B, v, os.path.join(J["out"], v["filename"])); R["vfile"] = v["filename"]
outs = cc.wait(B, cc.queue(B, J["song"]), timeout=60, poll=0.3)
a = cc.output_audio(outs)[0]; cc.download(B, a, os.path.join(J["out"], a["filename"])); R["afile"] = a["filename"]
fail = dict(J["image"]); fail["fail"] = {"class_type": "Note", "inputs": {}}
try:
    cc.wait(B, cc.queue(B, fail), timeout=60, poll=0.3); R["failed"] = "no error"
except cc.ComfyError as e:
    R["failed"] = str(e)
bu = cc.upload_image(B, J["big"]); bg = {"1": {"class_type": "LoadVideo", "inputs": {"file": bu}}, "2": {"class_type": "SaveVideo", "inputs": {"video": ["1", 0], "filename_prefix": "x", "format": "auto", "codec": "auto"}}}
try:
    cc.queue(B, bg); R["big"] = "queued"
except cc.ComfyError as e:
    R["big"] = str(e)
s3 = dict(J["image"]); s3["s3"] = {"class_type": "Note", "inputs": {}}
outs = cc.wait(B, cc.queue(B, s3), timeout=60, poll=0.3); R["s3"] = cc.output_images(outs)[0]["filename"]
print(json.dumps(R))
`;
  // async: the adapter answers from THIS process - a spawnSync would block it
  const pr = await new Promise((res) => {
    const c = require("child_process").spawn("python3", ["-c", py, path.join(TMP, "job.json")]);
    let stdout = "", stderr = ""; c.stdout.on("data", (d) => { stdout += d; }); c.stderr.on("data", (d) => { stderr += d; });
    const t = setTimeout(() => c.kill(), 240000);
    c.on("close", () => { clearTimeout(t); res({ stdout, stderr }); });
  });
  let RES = {}; try { RES = JSON.parse(pr.stdout.trim().split("\n").pop()); } catch { console.log(pr.stdout.slice(-1500), pr.stderr.slice(-1500)); }
  const run0 = RP.runs[0] || { inp: {} };
  check("comfy_client: preflight passes, the node check is skipped (no /object_info), the upload is kept by name", RES.up === "out.png" && Array.isArray(RES.missing) && RES.missing.length === 0, RES);
  check("…queue -> /run with the workflow AND the uploaded picture it names (base64), the key as Bearer", run0.inp.workflow && run0.inp.workflow["1"].inputs.image === "out.png"
    && run0.inp.images && run0.inp.images[0].name === "out.png" && Buffer.from(run0.inp.images[0].image, "base64").equals(fs.readFileSync(job.pic)) && RP.auth.every((a) => a === "Bearer rpa_TESTKEY" || a === "Bearer wrong" || a === undefined), run0.inp.images && run0.inp.images.map((i) => i.name));
  check("…wait -> the picture back (base64 -> a file, history -> /view -> downloaded)", RES.img === fs.statSync(job.pic).size, RES.img);
  const run1 = RP.runs[1] || { inp: { workflow: {} } };
  check("…the LTX Ripple workflow: sent with SaveVideo in place of VHS_VideoCombine; its videos come back as videos", !Object.values(run1.inp.workflow).some((n) => n && n.class_type === "VHS_VideoCombine")
    && (RES.vids || []).length === 3 && /^ltx_00001_\.mp4$/.test(RES.vfile) && fs.statSync(path.join(job.out, RES.vfile)).size === fs.statSync(path.join(media, "clip.mp4")).size, RES.vids);
  const probe = RES.afile ? spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name", "-of", "csv=p=0", path.join(job.out, RES.afile)], { encoding: "utf8" }).stdout.trim() : "";
  check("…the ACE-Step song: rides the 16x16 video, comes back as audio_ace_step_1_5_00001_.mp3 - an mp3 with one audio stream, no video", RES.afile === "audio_ace_step_1_5_00001_.mp3" && /^mp3,audio$/m.test(probe) && !/video/.test(probe), { afile: RES.afile, probe });
  check("…a failed job: comfy_client raises with the endpoint's own words", /reported an execution error/.test(RES.failed || "") && /nope\.safetensors/.test(RES.failed || ""), RES.failed);
  check("…a job over 10 MB: rejected at queue, before anything is sent, saying what to do", /rejected the workflow/.test(RES.big || "") && /10 MB at most/.test(RES.big || "") && /big\.mp4/.test(RES.big || "") && !RP.runs.some((r) => JSON.stringify(r.inp.workflow).includes("big.mp4")), RES.big);
  check("…a result in the endpoint's bucket (s3_url): downloaded", RES.s3 === "pic_00001_.png" && fs.existsSync(path.join(TMP, "runpod_sls", "out")), RES.s3);
  // cancel
  const q = await fetch(BASE + "/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: job.image }) }).then((r) => r.json());
  const qv = await fetch(BASE + "/queue").then((r) => r.json());
  const ic = await fetch(BASE + "/interrupt", { method: "POST" }).then((r) => r.json());
  const hh = await fetch(BASE + "/history/" + q.prompt_id).then((r) => r.json());
  check("/queue lists a job not finished; /interrupt cancels it at RunPod and the history says cancelled", (qv.queue_pending.length + qv.queue_running.length) >= 1 && ic.cancelled >= 1
    && RP.cancelled.includes(q.runpod_job) && /cancelled/.test(JSON.stringify(hh)), { qv, ic });
  const vw = await fetch(BASE + "/view?filename=../../../etc/passwd&subfolder=x");
  check("/view: only a job's own files (no path out of it)", vw.status === 404);
  appSrv.close(); rpSrv.close();

  /* ---------------- the wiring */
  const RI = read("routes", "index.js");
  check("routes: early() before express.json (big workflows, multipart), mount() beside Remote GPU - nothing in server.js",
    RI.indexOf('require("./runpodServerless").early(app)') < RI.indexOf("app.use(express.json())") && /require\("\.\/runpodServerless"\)\.mount\(app\)/.test(RI) && !/runpodServerless|rpsl/.test(read("misc", "server.js")));
  const UI = read("static", "remotegpu.js");
  check("Settings ▸ Remote GPU: RunPod Serverless - the key, the endpoint ID, $/hour, ✓ Test = /health", /\["serverless", "RunPod Serverless"\]/.test(UI) && /id="rgEndpoint"/.test(UI) && /id="rgSlsKey"/.test(UI) && /\/api\/remotegpu\/serverless\/test/.test(UI));
  check("nothing of worker-comfyui (AGPL) is in bitGen Studio - it is only called over HTTP", !fs.readdirSync(path.join(ROOT, "lib")).some((f) => /worker.?comfyui|rp_handler/i.test(f)) && !/^import runpod|from runpod/m.test(read("lib", "runpodServerless.js")));
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });

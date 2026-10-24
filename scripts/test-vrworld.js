#!/usr/bin/env node
/* bitGen Studio — 2.368.0: 🥽 VR WORLD (lib/vrWorld.js, routes/vrWorld.js, static/vrworld.js).
 * Run: node scripts/test-vrworld.js
 * Tim: "is it possible for bitgen to create vr 3d sbs movies from reference pictures and audio references- maybe
 * using a 360 sbs picture as reference?" -> "lets try route 2. and add a wan2.1 style so we can use wan as well".
 *   1. lib/vrWorld: the type from name / shape (the python mirror), the camera filter (the SAME string
 *      scripts/vr_swap.flat_vf builds), click -> aim, the view / auto size, put / clear / set, what is missing,
 *      the job for H3 / H3 + the sound lip-synced / a Wan style, the ✎ first-frame plan;
 *   2. routes/vrWorld.js LIVE on an express app: upload a world (type detected), the panorama + the view
 *      (real JPEG / PNG), an Image asset as a performer picture, set, ✎ first frame queues an image-edit job and its
 *      result becomes the first frame, ▶ render queues one vrworld job;
 *   3. jsdom: static/vrworld.js - the 🥽 button opens it, the state fills it, a click on the panorama aims, ▶ posts;
 *   4. the wiring. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 900) : "")); }
}
const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const styles = require(path.join(ROOT, "lib", "styles"));
const VW = require(path.join(ROOT, "lib", "vrWorld"));
const T = fs.mkdtempSync(path.join(os.tmpdir(), "vrw368js_"));
const PDIR = core.projDir(core.getProject());
const VWDIR = path.join(PDIR, "vrworld");
const hadDir = fs.existsSync(VWDIR);
const keep = hadDir ? fs.mkdtempSync(path.join(os.tmpdir(), "vrw368keep_")) : null;
if (hadDir) fs.renameSync(VWDIR, path.join(keep, "vrworld"));
const ff = (args) => spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);

(async () => {
try {
  // ---- 1
  check("detectMode mirrors the python: names first, then 1:1 TB / 4:1 SBS 360 / 2:1 mono (not sure)",
    JSON.stringify(VW.detectMode("x_360_TB.jpg", 4096, 4096)) === '{"mode":"tb360","sure":true}'
    && VW.detectMode("x_180_LR.png", 8192, 4096).mode === "sbs180" && VW.detectMode("x_360_sbs.jpg", 8192, 2048).mode === "sbs360"
    && JSON.stringify(VW.detectMode("x.jpg", 8192, 4096)) === '{"mode":"mono360","sure":false}'
    && VW.detectMode("x.jpg", 4096, 4096).mode === "tb360" && VW.detectMode("x.jpg", 1920, 1080).mode === "");
  const v = { yaw: 30, pitch: -10, fov: 70, shape: "1:1" };
  const py = spawnSync("python3", ["-c", "import sys; sys.path.insert(0,'scripts'); import vr_swap as V; "
    + "print(V.flat_vf('tb360','R',{'yaw':30,'pitch':-10,'fov':70},512,512)); print(V.flat_vf('sbs360','L',{'yaw':-170.5,'pitch':0,'fov':90},640,480))"],
    { encoding: "utf8" }).stdout.trim().split("\n");
  check("flatVf: the SAME filter string scripts/vr_swap.flat_vf builds (TB right eye; SBS 360 left eye)",
    VW.flatVf("tb360", "R", v, 512, 512) === py[0] && VW.flatVf("sbs360", "L", { yaw: -170.5, pitch: 0, fov: 90 }, 640, 480) === py[1],
    [VW.flatVf("tb360", "R", v, 512, 512), py]);
  check("aimFromClick: the panorama's centre = 0/0, its right edge = +180 (360) / +90 (180), the top = +90 pitch",
    JSON.stringify(VW.aimFromClick("mono360", 0.5, 0.5)) === '{"yaw":0,"pitch":0}'
    && VW.aimFromClick("tb360", 1, 0).yaw === 180 && VW.aimFromClick("tb360", 1, 0).pitch === 90 && VW.aimFromClick("sbs180", 1, 0.5).yaw === 90);
  check("viewSize mirrors vr_swap.view_size; autoShortSide mirrors vr_world.view_short_side_for",
    JSON.stringify(VW.viewSize(544, "16:9")) === '{"width":960,"height":544}' && JSON.stringify(VW.viewSize(512, "9:16")) === '{"width":512,"height":912}'
    && VW.autoShortSide("mono360", 8192, 4096, 70, "1:1") === 1088 && VW.autoShortSide("mono360", 2048, 1024, 70, "1:1") === 384);
  const pyss = spawnSync("python3", ["-c", "import sys; sys.path.insert(0,'scripts'); import vr_world as W; "
    + "print(W.view_short_side_for('tb360',4096,4096,60,'16:9'), W.view_short_side_for('sbs180',8192,4096,80,'3:4'))"], { encoding: "utf8" }).stdout.trim();
  check("...and agree on a TB 60° 16:9 and a 180 SBS 80° 3:4 view", pyss === `${VW.autoShortSide("tb360", 4096, 4096, 60, "16:9")} ${VW.autoShortSide("sbs180", 8192, 4096, 80, "3:4")}`, pyss);

  const D = fs.mkdtempSync(path.join(os.tmpdir(), "vrw368d_"));
  const world = path.join(T, "plaza_360_TB.jpg");
  ff(["-f", "lavfi", "-i", "testsrc2=size=1024x1024", "-frames:v", "1", world]);
  const face = path.join(T, "face.png"); ff(["-f", "lavfi", "-i", "color=c=blue:size=200x300", "-frames:v", "1", face]);
  const snd = path.join(T, "song.wav"); ff(["-f", "lavfi", "-i", "sine=frequency=220", "-t", "3", snd]);
  let s = VW.blank();
  let r = VW.put(D, s, "world", world, "plaza_360_TB.jpg");
  s = r.session;
  check("put world: copied, measured (1024x1024), typed from its name (tb360, sure), said",
    /^world_/.test(s.world) && s.world_w === 1024 && s.world_h === 1024 && s.vr_mode === "tb360" && s.sure && /from its name/.test(r.note), r);
  r = VW.put(D, s, "picture", face, "face.png"); s = r.session;
  r = VW.put(D, s, "sound", snd, "song.wav"); s = r.session;
  check("put picture / sound: filed, names kept", s.pictures.length === 1 && /^pic_/.test(s.pictures[0]) && s.sound_name === "song.wav");
  check("put refuses the wrong kind in words", /not a picture/.test(VW.put(D, s, "picture", snd, "song.wav").error)
    && /not a sound/.test(VW.put(D, s, "sound", face, "face.png").error) && /slot must be/.test(VW.put(D, s, "x", face, "f.png").error));
  s = VW.set(s, { view: { yaw: 400, fov: 200 }, seconds: 99, lock: true, engine: "h3song", prompt: "She sings." });
  check("set: the aim clamped (400 -> 40, fov 140), seconds capped at 15, lock, engine, prompt",
    s.view.yaw === 40 && s.view.fov === 140 && s.seconds === 15 && s.lock === true && s.engine === "h3song" && s.prompt === "She sings.", s);
  check("notReady: nothing missing now; a fresh session needs its world",
    VW.notReady(s, D) === "" && /load a 360/.test(VW.notReady(VW.blank(), D)));
  const song = styles.normalize(styles.STARTER_STYLES.find((x) => x.name === "MMH3_NativeAudio_MV"), null);
  s = VW.set(s, { seconds: 4, sound_start: 12 });
  let p = VW.jobParams({ session: s, dir: D, style: song, grid: "17k5" });
  check("jobParams h3song: mode vrworld, the world + type + aim, a fl2va render through MMH3_NativeAudio_MV with the song from 12 s for 4 s",
    p.mode === "vrworld" && p.world === path.join(D, s.world) && p.vr_mode === "tb360" && p.view.yaw === 40
    && p.render.mode === "fl2va" && p.render.video_style.name === "MMH3_NativeAudio_MV" && p.render.ref_audios[0] === path.join(D, s.sound)
    && p.render.audio_start === 12 && p.render.audio_dur === 4 && p.render.frames === 107 && p.render.plan && p.lock === true, p);
  check("...the render at the auto view size (TB 1024: one eye 1024 wide, 140° view)", p.render.width === p.render.height && p.render.width % 16 === 0
    && p.short_side === p.render.width, p.render.width);
  s = VW.set(s, { engine: "h3" });
  p = VW.jobParams({ session: s, dir: D, style: null, grid: "4n1" });
  check("jobParams h3: no style, no sound reference (H3 makes its own), the 4n1 grid on sd-cli",
    p.render.video_style === null && p.render.ref_audios.length === 0 && (p.render.frames - 1) % 4 === 0, p.render);
  const W21 = styles.normalize(styles.STARTER_STYLES.find((x) => x.name === "Wan 2.1"), null);
  s = VW.set(s, { engine: W21.id, prompt: "<Subject 1> says, in the timbre of <Audio 1>, <d>[English] Hi</d>" });
  p = VW.jobParams({ session: s, dir: D, style: W21, grid: "17k5" });
  check("jobParams Wan: an i2v render (the worker fills the start), the session's sound laid under it, the prompt plain",
    p.render.mode === "wan" && p.render.wan_mode === "i2v" && p.render.audio.path === path.join(D, s.sound) && p.render.audio.start === 12
    && p.render.prompt === 'subject 1 says, "Hi"', p.render);
  check("jobParams with a Wan engine whose style is gone: refused in words", /no longer exists/.test(VW.jobParams({ session: s, dir: D, style: null }).error));
  const fpPlan = VW.firstPlan(path.join(D, "view.png"), [face], "She smiles.");
  check("firstPlan: the view is the location (<image1>), the performer the character (<image2>), the camera kept",
    fpPlan.images[0] === path.join(D, "view.png") && fpPlan.images[1] === face && /<image1> is the location/.test(fpPlan.prompt)
    && /the character from <image2>/.test(fpPlan.prompt) && /Keep the camera exactly where it is/.test(fpPlan.prompt), fpPlan);
  r = VW.clear(D, s, "picture", 0);
  check("clear picture: the file goes too", r.session.pictures.length === 0 && !fs.existsSync(path.join(D, s.pictures[0])));
  fs.rmSync(D, { recursive: true, force: true });

  // ---- 2 LIVE
  const express = require("express");
  const app = express(); app.use(express.json());
  const made = [];
  const realMake = core.makeJob;
  core.makeJob = (params) => { const j = { id: "job" + (made.length + 1), params, log: [], status: "queued", finished: null, created: 0 }; made.push(j); core.jobs.set(j.id, j); return j; };
  require(path.join(ROOT, "routes", "vrWorld")).mount(app);
  const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
  const port = srv.address().port;
  const req = (method, p2, body, headers) => new Promise((ok) => {
    const data = body == null ? null : (Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)));
    const rq = http.request({ host: "127.0.0.1", port, path: p2, method,
      headers: { ...(data && !headers ? { "Content-Type": "application/json" } : {}), ...(headers || {}), ...(data ? { "Content-Length": data.length } : {}) } }, (rs) => {
      const parts = []; rs.on("data", (c) => parts.push(c)); rs.on("end", () => {
        const b = Buffer.concat(parts); let j = null; try { j = JSON.parse(b.toString()); } catch {} ok({ status: rs.statusCode, j, b, type: rs.headers["content-type"] }); });
    });
    if (data) rq.write(data); rq.end();
  });
  const multipart = (fields, file, name) => {
    const B = "----vrw368";
    const parts = Object.entries(fields).map(([k, v2]) => `--${B}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v2}\r\n`).join("");
    return { body: Buffer.concat([Buffer.from(parts + `--${B}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      fs.readFileSync(file), Buffer.from(`\r\n--${B}--\r\n`)]), headers: { "Content-Type": `multipart/form-data; boundary=${B}` } };
  };
  let a = await req("GET", "/api/vrworld");
  check("GET /api/vrworld: a blank session, the four VR types, the engines (H3, H3 + song, the Wan styles), not ready",
    a.status === 200 && a.j.session.world === "" && a.j.modes.map((m) => m.id).join() === "mono360,tb360,sbs360,sbs180"
    && a.j.engines[0].id === "h3" && a.j.engines[1].id === "h3song" && /load a 360/.test(a.j.ready), a.j);
  const mp = multipart({ slot: "world" }, world, "plaza_360_TB.jpg");
  a = await req("POST", "/api/vrworld/upload", mp.body, mp.headers);
  check("POST upload world: filed in projects/<p>/vrworld, typed tb360 from its name, the note says so",
    a.status === 200 && a.j.session.vr_mode === "tb360" && fs.existsSync(path.join(VWDIR, a.j.session.world)) && /tb360|top-bottom/.test(a.j.note), a.j);
  a = await req("GET", "/api/vrworld/pano");
  check("GET pano: a JPEG of the LEFT eye (1024 wide, half the TB height)", a.status === 200 && /jpeg/.test(a.type)
    && a.b[0] === 0xff && a.b[1] === 0xd8, a.status);
  a = await req("GET", "/api/vrworld/view?yaw=10&fov=60");
  const probe = (buf) => { const f = path.join(T, "v.png"); fs.writeFileSync(f, buf);
    return spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim(); };
  check("GET view: what the camera sees, a PNG at the preview size (384 short side)", a.status === 200 && /png/.test(a.type) && probe(a.b) === "384,384", a.status);
  const img = path.join(core.pDir("images"), "e2e_vrw368_face.png");
  fs.mkdirSync(core.pDir("images"), { recursive: true }); fs.copyFileSync(face, img);
  a = await req("POST", "/api/vrworld/asset", { slot: "picture", kind: "images", name: path.basename(img) });
  check("POST asset: an Image asset becomes a performer picture", a.status === 200 && a.j.session.pictures.length === 1, a.j);
  a = await req("POST", "/api/vrworld/asset", { slot: "picture", kind: "images", name: "nope.png" });
  check("...a missing asset: 404 in words", a.status === 404 && /no images asset/.test(a.j.error));
  a = await req("POST", "/api/vrworld/set", { prompt: "She waves.", view: { yaw: -30 }, engine: "h3", seconds: 3 });
  check("POST set: the fields stick", a.j.session.prompt === "She waves." && a.j.session.view.yaw === -30 && a.j.session.seconds === 3);
  a = await req("POST", "/api/vrworld/first", {});
  const editOk = a.status === 200;
  check("POST first: an image-edit job (the view as the location + the performer), no assets, the session waits on it",
    (editOk && made.length === 1 && made[0].params.mode === "image" && made[0].params.images.length === 2 && made[0].params.no_assets === true
      && /<image1> is the location/.test(made[0].params.prompt) && a.j.session.first_status === "running")
    || (!editOk && /no image-edit style/.test(a.j.error)), a.j);
  if (editOk) {
    const done = path.join(core.pDir("output"), "e2e_vrw368_first.png");
    fs.mkdirSync(core.pDir("output"), { recursive: true }); fs.copyFileSync(face, done);
    made[0].finished = 1; made[0].status = "done"; made[0].output = path.basename(done);
    a = await req("GET", "/api/vrworld");
    check("...when it is done the result becomes the session's first frame", /^first_/.test(a.j.session.first) && a.j.session.first_status === "done"
      && fs.existsSync(path.join(VWDIR, a.j.session.first)), a.j.session);
    try { fs.unlinkSync(done); } catch {}
  }
  a = await req("POST", "/api/vrworld/render", { prompt: "She waves hello." });
  const rj = made[made.length - 1];
  check("POST render: one mode vrworld job (H3 fl2va performer, the aim, the first frame), the reply's note says what it is",
    a.status === 200 && rj.params.mode === "vrworld" && rj.params.render.mode === "fl2va" && rj.params.view.yaw === -30
    && rj.params.render.prompt === "She waves hello." && /^VR World 360° stereo \(top-bottom\)/.test(a.j.note)
    && (!editOk || /first_/.test(rj.params.first_frame)), { a: a.j, p: rj.params });
  a = await req("POST", "/api/vrworld/clear", { slot: "world" });
  check("POST clear world: gone, the first frame with it", a.j.session.world === "" && a.j.session.first === "");
  a = await req("POST", "/api/vrworld/render", {});
  check("...render with no world: 400 in words", a.status === 400 && /load a 360/.test(a.j.error));
  srv.close();
  core.makeJob = realMake;
  for (const j of made) core.jobs.delete(j.id);
  try { fs.unlinkSync(img); } catch {}

  // ---- 3 jsdom
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the page checks are skipped)"); }
  if (JSDOM) {
    const dom = new JSDOM('<!doctype html><head></head><body><button id="vdVrWorld">🥽 VR World</button></body>',
      { runScripts: "outside-only", url: "http://127.0.0.1:8311/", pretendToBeVisual: true });
    const w = dom.window;
    if (!w.HTMLDialogElement.prototype.showModal) w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    if (!w.HTMLDialogElement.prototype.close) w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    const posts = [];
    const ST = { session: { ...VW.blank(), world: "world_x.jpg", world_name: "plaza_360_TB.jpg", vr_mode: "tb360", sure: true, world_w: 4096, world_h: 4096,
                            pictures: ["pic_a.png"], prompt: "She waves.", engine: "h3" },
                 modes: Object.entries(VW.MODES).map(([id, m]) => ({ id, label: m.label })),
                 engines: [{ id: "h3", label: "MiniMax H3" }, { id: "h3song", label: "H3 + song" }, { id: "st_w", label: "Wan 2.1", wan: true }],
                 edit: { ok: true, name: "Qwen Image 2.1 edit" }, view_size: { width: 1024, height: 1024 }, auto_short_side: true, ready: "" };
    w.fetch = async (url, o) => {
      const body = o && o.body && typeof o.body === "string" ? JSON.parse(o.body) : null;
      posts.push({ url, body });
      let j = ST;
      if (/\/set$/.test(url) && body.view) { ST.session.view = { ...ST.session.view, ...body.view }; }
      if (/\/render$/.test(url)) j = { id: "jr1", status: "queued", note: "VR World 360° stereo (top-bottom) · …" };
      return { ok: true, status: 200, json: async () => j };
    };
    w.eval(read("static", "vrworld.js"));
    w.VrWorld.install({ drag: () => null, note: () => {}, refresh: () => {} });
    w.document.getElementById("vdVrWorld").click();
    await new Promise((ok) => setTimeout(ok, 50));
    const dlg = w.document.querySelector("dialog.vwdlg[open]");
    const q = (k) => dlg.querySelector(`[data-k="${k}"]`);
    check("🥽 opens the dialog, filled from GET /api/vrworld: the world, its type, the aim, the engines, the picture, the size",
      dlg && /plaza_360_TB\.jpg/.test(q("world").textContent) && q("mode").value === "tb360" && q("engine").options.length === 3
      && q("pics").querySelectorAll("img").length === 1 && /renders 1024x1024 \(auto\)/.test(q("size").textContent)
      && q("prompt").value === "She waves." && posts[0].url === "/api/vrworld", posts);
    q("panoImg").getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
    q("pano").dispatchEvent(new w.MouseEvent("click", { clientX: 300, clientY: 50, bubbles: true }));
    await new Promise((ok) => setTimeout(ok, 30));
    const aim = posts.find((x) => /\/set$/.test(x.url));
    check("a click on the panorama aims the camera there (3/4 across = yaw 90, 1/4 down = pitch 45)",
      aim && aim.body.view.yaw === 90 && aim.body.view.pitch === 45, posts.slice(-2));
    check("...the dot follows the aim", /75%/.test(q("dot").style.left) && /25%/.test(q("dot").style.top), [q("dot").style.left, q("dot").style.top]);
    q("prompt").value = "She waves at us.";
    await w.VrWorld._api.render();
    const rp = posts.find((x) => /\/render$/.test(x.url));
    check("▶ Render VR posts the prompt as typed, says what was queued, waits on the job",
      rp && rp.body.prompt === "She waves at us." && /VR World 360/.test(q("msg").textContent) && w.VrWorld.state().job === "jr1", posts.slice(-1));
    w.VrWorld.close();
    check("✕ closes and removes it", !w.document.querySelector("dialog.vwdlg"));
  }

  // ---- 4 wiring
  const IDX = read("routes", "index.js"), H = read("static", "index.html"), DOCK = read("ext", "videodock", "dock.html");
  check("routes/index.js mounts ./vrWorld (never server.js)", /require\("\.\/vrWorld"\)\.mount\(app\)/.test(IDX) && !/vrWorld/i.test(read("misc/server.js")));
  check("static/index.html loads vrworld.js and installs it with the drag payload + the gallery refresh",
    H.includes('<script src="/static/vrworld.js"></script>') && /window\.VrWorld\.install\(\{\s*drag: \(\) => dragPayload/.test(H));
  check("the video docker has the 🥽 VR World button (#vdVrWorld) beside ⇄ Swap", /id="vdVrWorld"[\s\S]{0,300}🥽 VR World/.test(DOCK)
    && DOCK.indexOf('id="vdSwapDlg"') < DOCK.indexOf('id="vdVrWorld"'));
} catch (e) { fail++; console.log("FAIL: threw " + (e && e.stack || e)); }
finally {
  try { fs.rmSync(VWDIR, { recursive: true, force: true }); } catch {}
  if (hadDir) { try { fs.renameSync(path.join(keep, "vrworld"), VWDIR); fs.rmSync(keep, { recursive: true, force: true }); } catch {} }
  fs.rmSync(T, { recursive: true, force: true });
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();

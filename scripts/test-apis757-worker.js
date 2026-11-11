#!/usr/bin/env node
/* bitGen Studio — 2.757.0 LIVE: misc/api_worker.py renders an API_ style through each online service - against a stand-in
 * for each one on this computer (H3_API_BASE_<SERVICE>), no real keys, no money.
 * Tim (verbatim): "can you add an api tab to bitgen ... if api is checked add it to styles with prefix API_ so bitgen can
 * truly work without good hardware" + "add runninghub too".
 *   OpenRouter pictures (b64) + video (submit -> poll -> /content), fal.ai pictures + song (queue -> status -> result),
 *   Replicate video (Prefer: wait, then poll), OpenAI picture edit (multipart with the reference), Gemini picture
 *   (inline references), RunningHub workflow (its nodes filled: prompt, size, seed, the uploaded picture) - and the
 *   failures in words: a refused key, a failed run, no key, an API removed. */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), { spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake picture")]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.from("fake video")]);
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.from("fake song")]);
const seen = [];          // every request: {svc, method, path, headers, body}
let polls = {};
let PORT = 0;
const U = (p) => "http://127.0.0.1:" + PORT + p;

function body(req) { return new Promise((r) => { const b = []; req.on("data", (c) => b.push(c)); req.on("end", () => r(Buffer.concat(b))); }); }
const J = (res, st, o) => { res.writeHead(st, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
const srv = http.createServer(async (req, res) => {
  const raw = await body(req), u = new URL(req.url, "http://x"), p = u.pathname;
  let jb = null; try { jb = JSON.parse(raw.toString("utf8")); } catch { jb = null; }
  const svc = p.split("/")[1];
  seen.push({ svc, method: req.method, path: p, headers: req.headers, body: jb, raw: jb ? null : raw.toString("latin1") });
  const auth = req.headers.authorization || req.headers["x-goog-api-key"] || "";
  if (/BADKEY/.test(auth) || (jb && /BADKEY/.test(String(jb.apiKey || "")))) return J(res, 401, { error: { message: "invalid key" } });
  // files any service hands back by address
  if (p === "/files/a.png") { res.writeHead(200, { "Content-Type": "image/png" }); return res.end(PNG); }
  if (p === "/files/b.png") { res.writeHead(200, { "Content-Type": "image/png" }); return res.end(PNG); }
  if (p === "/files/v.mp4") { res.writeHead(200, { "Content-Type": "video/mp4" }); return res.end(MP4); }
  if (p === "/files/s.mp3") { res.writeHead(200, { "Content-Type": "audio/mpeg" }); return res.end(MP3); }
  // ---- OpenRouter (/or)
  if (p === "/or/images") return J(res, 200, { data: (Array(jb.n || 1).fill(0)).map(() => ({ b64_json: PNG.toString("base64"), media_type: "image/png" })), usage: { cost: 0.039 } });
  if (p === "/or/videos" && req.method === "POST") return J(res, 202, { id: "vid1", polling_url: U("/or/videos/vid1"), status: "pending" });
  if (p === "/or/videos/vid1") { polls.or = (polls.or || 0) + 1; return J(res, 200, polls.or < 2 ? { id: "vid1", status: "in_progress" } : { id: "vid1", status: "completed", usage: { cost: 1.2 } }); }
  if (p === "/or/videos/vid1/content") { res.writeHead(200, { "Content-Type": "video/mp4" }); return res.end(MP4); }
  if (p === "/or/videos/vidbad") return J(res, 200, { status: "failed", error: "content policy" });
  // ---- fal (/fal/<model...>)
  if (p.startsWith("/fal/") && req.method === "POST") {
    const music = /ace-step/.test(p);
    return J(res, 200, { request_id: "r1", status_url: U("/falq/r1/status" + (music ? "?m=1" : "")), response_url: U("/falq/r1" + (music ? "?m=1" : "")) });
  }
  if (p === "/falq/r1/status") { polls.fal = (polls.fal || 0) + 1; return J(res, 200, { status: polls.fal < 2 ? "IN_QUEUE" : "COMPLETED" }); }
  if (p === "/falq/r1") return J(res, 200, u.searchParams.get("m") ? { audio: { url: U("/files/s.mp3") } } : { images: [{ url: U("/files/a.png") }, { url: U("/files/b.png") }] });
  // ---- Replicate (/rep)
  if (p.startsWith("/rep/models/") && req.method === "POST") return J(res, 201, { id: "p1", status: "starting", urls: { get: U("/rep/predictions/p1") } });
  if (p === "/rep/predictions/p1") { polls.rep = (polls.rep || 0) + 1; return J(res, 200, polls.rep < 2 ? { status: "processing" } : { status: "succeeded", output: U("/files/v.mp4") }); }
  if (p.startsWith("/repbad/models/")) return J(res, 201, { id: "p2", status: "failed", error: "NSFW content detected" });
  // ---- OpenAI (/oai)
  if (p === "/oai/images/generations") return J(res, 200, { data: [{ b64_json: PNG.toString("base64") }] });
  if (p === "/oai/images/edits") return J(res, 200, { data: [{ b64_json: PNG.toString("base64") }] });
  // ---- Gemini (/gem)
  if (p.startsWith("/gem/models/")) return J(res, 200, { candidates: [{ content: { parts: [{ text: "here" }, { inlineData: { mimeType: "image/png", data: PNG.toString("base64") } }] } }] });
  // ---- RunningHub (/rh)
  if (p === "/rh/api/openapi/getJsonApiFormat") return J(res, 200, { code: 0, msg: "success", data: { prompt: JSON.stringify({
    "3": { class_type: "KSampler", inputs: { seed: 5, steps: 20 } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: 512, height: 512, batch_size: 1 } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: "old words", clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: "negative", clip: ["4", 1] } },
    "10": { class_type: "LoadImage", inputs: { image: "x.png" } } }) } });
  if (p === "/rh/task/openapi/upload") return J(res, 200, { code: 0, data: { fileName: "api/up123.png" } });
  if (p === "/rh/task/openapi/create") return J(res, 200, { code: 0, data: { taskId: "t77" } });
  if (p === "/rh/task/openapi/status") { polls.rh = (polls.rh || 0) + 1; return J(res, 200, { code: 0, data: polls.rh < 2 ? "RUNNING" : "SUCCESS" }); }
  if (p === "/rh/task/openapi/outputs") return J(res, 200, { code: 0, data: [{ fileUrl: U("/files/a.png"), fileType: "png", nodeId: "9" }] });
  J(res, 404, { error: "no " + p });
});

function job(o) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apiw-")), jd = path.join(dir, "jobs", "j" + Math.random().toString(36).slice(2, 8)), out = path.join(dir, "out");
  fs.mkdirSync(jd, { recursive: true });
  const ref = path.join(dir, "ref.png"); fs.writeFileSync(ref, PNG);
  const params = Object.assign({ prompt: "a red fox in snow", seed: 42 }, o.params || {});
  for (const k of ["images", "reference_files"]) if (params[k] === "REF") params[k] = [ref];
  if (Array.isArray(params.reference_files) && params.reference_files[1] === "REF") params.reference_files = [ref, ref];
  const apis = o.apis || { a1: Object.assign({ name: "Mine", use: true }, o.api) };
  fs.writeFileSync(path.join(jd, "job.json"), JSON.stringify({ params, config: { apis }, output_dir: out }));
  return { jf: path.join(jd, "job.json"), out };
}
function run(svcEnv, j) {
  const env = Object.assign({}, process.env, { PYTHONIOENCODING: "utf-8" });
  for (const [k, v] of Object.entries(svcEnv)) env["H3_API_BASE_" + k.toUpperCase()] = U(v);
  // spawned, not spawnSync: the stand-in services answer from this same process
  return new Promise((done) => {
    const c = spawn("python3", [path.join(ROOT, "misc", "api_worker.py"), j.jf], { env });
    let out = ""; c.stdout.on("data", (d) => { out += d; }); c.stderr.on("data", (d) => { out += d; });
    const t = setTimeout(() => c.kill(), 60000);
    c.on("close", (code) => { clearTimeout(t); const files = fs.existsSync(j.out) ? fs.readdirSync(j.out).sort() : [];
      done({ code, out, files, read: (f) => fs.readFileSync(path.join(j.out, f)) }); });
  });
}
const last = (svc) => seen.filter((s) => s.svc === svc);

srv.listen(0, "127.0.0.1", async () => {
  PORT = srv.address().port;
  try {
    // ---- OpenRouter pictures
    let j = job({ api: { service: "openrouter", key: "sk-or-v1-good" }, params: { mode: "image", batch: 2, width: 1280, height: 720, images: "REF",
      style: { name: "API_Mine pictures", runs_on: "api", api_id: "a1", api_model: "google/gemini-2.5-flash-image", api_extra: { quality: "high" } } } });
    let r = await run({ openrouter: "/or" }, j);
    let q = last("or").find((s) => s.path === "/or/images");
    check("OpenRouter pictures: POST /images with the model, the prompt, 16:9 for 1280x720, n = the batch, the seed, the reference as a data: address, the style's Extra settings; Bearer key",
      q && q.body.model === "google/gemini-2.5-flash-image" && q.body.prompt === "a red fox in snow" && q.body.aspect_ratio === "16:9" && q.body.n === 2 && q.body.seed === 42
      && /^data:image\/png;base64,/.test(q.body.input_references[0].image_url.url) && q.body.quality === "high" && q.headers.authorization === "Bearer sk-or-v1-good", q && q.body);
    check("…two pictures saved under the studio's names (stamp_s42_<job>_01/_02.png), @@OUTS lists them, the cost is in the log",
      r.code === 0 && r.files.length === 2 && r.files.every((f) => /^\d{8}-\d{6}_s42_j\w+_0[12]\.png$/.test(f)) && /@@OUTS \[/.test(r.out) && /about \$0\.039/.test(r.out) && r.read(r.files[0]).equals(PNG), r);
    check("…the log says it renders on the service, not this graphics card", /nothing runs on this graphics card/.test(r.out) && /\[api\] OpenRouter \(Mine\) · image · model google\/gemini-2\.5-flash-image · 1280x720/.test(r.out), r.out);

    // ---- OpenRouter video (first + last frame), polling
    polls = {};
    j = job({ api: { service: "openrouter", key: "sk-or-v1-good" }, params: { mode: "fl2va", frames: 120, width: 1280, height: 720, format: "mp4", reference_files: ["REF", "REF"],
      video_style: { name: "API_Mine video", runs_on: "api", api_id: "a1", api_model: "google/veo-3.1" } } });
    r = await run({ openrouter: "/or" }, j);
    q = last("or").find((s) => s.path === "/or/videos" && s.method === "POST");
    check("OpenRouter video: 120 frames = 5 s, the first and last frame as frame_images, then polled until completed and fetched from /content",
      q && q.body.duration === 5 && q.body.frame_images.length === 2 && q.body.frame_images[0].frame_type === "first_frame" && q.body.frame_images[1].frame_type === "last_frame"
      && polls.or >= 2 && last("or").some((s) => s.path === "/or/videos/vid1/content"), q && q.body);
    check("…saved as <stamp>_<job>.mp4 with @@OUT (the video names the queue knows)", r.code === 0 && r.files.length === 1 && /^\d{8}-\d{6}_j\w+\.mp4$/.test(r.files[0]) && new RegExp("@@OUT " + r.files[0]).test(r.out) && /in progress|in_progress/.test(r.out), r);

    // ---- fal pictures + a song
    polls = {}; seen.length = 0;
    j = job({ api: { service: "fal", key: "abc:def" }, params: { mode: "image", batch: 2, width: 1024, height: 1024,
      style: { name: "API_Fal pictures", runs_on: "api", api_id: "a1", api_model: "fal-ai/flux/schnell" } } });
    r = await run({ fal: "/fal" }, j);
    q = last("fal").find((s) => s.method === "POST");
    check("fal.ai pictures: the queue at /<model> with Authorization: Key, image_size {1024, 1024}, num_images 2; status polled; both pictures fetched by address",
      q && q.path === "/fal/fal-ai/flux/schnell" && q.headers.authorization === "Key abc:def" && q.body.image_size.width === 1024 && q.body.num_images === 2 && r.code === 0 && r.files.length === 2, { q: q && q.body, r });
    polls = {};
    j = job({ api: { service: "fal", key: "abc:def" }, params: { mode: "music", prompt: "[verse]\nla la la",
      style: { name: "API_Fal songs", runs_on: "api", api_id: "a1", api_model: "fal-ai/ace-step", caption: "synth pop, 120 bpm", max_duration: 90 } } });
    r = await run({ fal: "/fal" }, j);
    q = last("fal").filter((s) => s.method === "POST").pop();
    check("fal.ai song: the lyrics are the prompt, the style's caption the tags, its length the duration -> an .mp3 in the output",
      q && q.body.lyrics === "[verse]\nla la la" && q.body.tags === "synth pop, 120 bpm" && q.body.duration === 90 && r.code === 0 && r.files.length === 1 && /\.mp3$/.test(r.files[0]), { q: q && q.body, r });

    // ---- Replicate video, Prefer: wait then poll; and a failed run
    polls = {};
    j = job({ api: { service: "replicate", key: "r8_good" }, params: { mode: "t2va", frames: 48, width: 832, height: 480, format: "mp4",
      video_style: { name: "API_Rep video", runs_on: "api", api_id: "a1", api_model: "wan-video/wan-2.2-t2v-fast" } } });
    r = await run({ replicate: "/rep" }, j);
    q = last("rep").find((s) => s.method === "POST");
    check("Replicate video: POST /models/<owner>/<name>/predictions {input}, Prefer: wait, then urls.get polled until succeeded; the output address downloaded",
      q && q.path === "/rep/models/wan-video/wan-2.2-t2v-fast/predictions" && /wait/.test(q.headers.prefer) && q.body.input.prompt === "a red fox in snow" && r.code === 0 && /\.mp4$/.test(r.files[0] || ""), { q: q && q.body, r });
    j = job({ api: { service: "replicate", key: "r8_good" }, params: { mode: "t2va", frames: 48, video_style: { name: "API_Rep video", runs_on: "api", api_id: "a1", api_model: "x/y" } } });
    r = await run({ replicate: "/repbad" }, j);
    check("…a failed run: exit 1 and the service's own reason in words", r.code === 1 && /\[worker\] ERROR: Replicate: the run failed: NSFW content detected/.test(r.out), r.out);

    // ---- OpenAI picture edit (multipart) + plain
    j = job({ api: { service: "openai", key: "sk-proj-good" }, params: { mode: "image", images: "REF", width: 1536, height: 1024,
      style: { name: "API_OAI", runs_on: "api", api_id: "a1", api_model: "gpt-image-1" } } });
    r = await run({ openai: "/oai" }, j);
    q = last("oai").find((s) => s.path === "/oai/images/edits");
    check("OpenAI with a reference picture: /images/edits as multipart (model, prompt, size 1536x1024, the picture as image[])",
      q && /multipart\/form-data/.test(q.headers["content-type"]) && /name="model"\r\n\r\ngpt-image-1/.test(q.raw) && /name="size"\r\n\r\n1536x1024/.test(q.raw) && /name="image\[\]"; filename="ref.png"/.test(q.raw) && r.code === 0 && r.files.length === 1, r);
    j = job({ api: { service: "openai", key: "sk-proj-good" }, params: { mode: "t2va", frames: 48, video_style: { name: "API_OAI v", runs_on: "api", api_id: "a1", api_model: "sora-2" } } });
    r = await run({ openai: "/oai" }, j);
    check("…OpenAI video: refused in words (Sora ended in September 2026), nothing sent", r.code === 1 && /Sora/.test(r.out), r.out);

    // ---- Gemini
    j = job({ api: { service: "gemini", key: "AIzaGood" }, params: { mode: "image", images: "REF", width: 768, height: 1024,
      style: { name: "API_Gem", runs_on: "api", api_id: "a1", api_model: "gemini-2.5-flash-image" } } });
    r = await run({ gemini: "/gem" }, j);
    q = last("gem").find((s) => s.method === "POST");
    check("Google Gemini: models/<model>:generateContent with x-goog-api-key, the prompt + the reference inline, responseModalities IMAGE, 3:4 -> the picture saved",
      q && q.path === "/gem/models/gemini-2.5-flash-image:generateContent" && q.headers["x-goog-api-key"] === "AIzaGood" && q.body.contents[0].parts[1].inline_data.mime_type === "image/png"
      && q.body.generationConfig.responseModalities[0] === "IMAGE" && q.body.generationConfig.imageConfig.aspectRatio === "3:4" && r.code === 0 && r.files.length === 1, { q: q && q.body, r });

    // ---- RunningHub workflow
    polls = {};
    j = job({ api: { service: "runninghub", key: "0123456789abcdef0123456789abcdef" }, params: { mode: "image", images: "REF", width: 896, height: 1152, seed: 7,
      style: { name: "API_RH", runs_on: "api", api_id: "a1", api_model: "1987654321", api_extra: [{ nodeId: "3", fieldName: "steps", fieldValue: 8 }] } } });
    r = await run({ runninghub: "/rh" }, j);
    const cr = last("rh").find((s) => s.path === "/rh/task/openapi/create"), ni = cr && cr.body.nodeInfoList || [];
    const has = (n, f, v) => ni.some((x) => x.nodeId === n && x.fieldName === f && x.fieldValue === v);
    check("RunningHub: the workflow's nodes read (getJsonApiFormat), the picture uploaded, then create with nodeInfoList: the prompt into the FIRST text encoder (not the negative), the size, the seed, the uploaded picture, + the style's own extra values",
      cr && cr.body.workflowId === "1987654321" && has("6", "text", "a red fox in snow") && !ni.some((x) => x.nodeId === "7") && has("5", "width", 896) && has("5", "height", 1152)
      && has("3", "seed", 7) && has("10", "image", "api/up123.png") && has("3", "steps", 8) && last("rh").some((s) => s.path === "/rh/task/openapi/upload"), ni);
    check("…status polled to SUCCESS, the output fetched -> one picture", r.code === 0 && r.files.length === 1 && polls.rh >= 2 && /running/.test(r.out), r);
    j = job({ api: { service: "runninghub", key: "0123456789abcdef0123456789abcdef" }, params: { mode: "image", style: { name: "API_RH", runs_on: "api", api_id: "a1", api_model: "" } } });
    r = await run({ runninghub: "/rh" }, j);
    check("…no workflow ID in the style: refused in words", r.code === 1 && /workflow ID/.test(r.out), r.out);

    // ---- failures in words
    j = job({ api: { service: "openrouter", key: "sk-or-v1-BADKEY" }, params: { mode: "image", style: { name: "API_X", runs_on: "api", api_id: "a1", api_model: "m" } } });
    r = await run({ openrouter: "/or" }, j);
    check("a refused key: 'OpenRouter refused the API key (Settings ▸ API ▸ ✓ Test)'", r.code === 1 && /OpenRouter refused the API key/.test(r.out), r.out);
    j = job({ apis: {}, params: { mode: "image", style: { name: "API_Gone", runs_on: "api", api_id: "zz", api_model: "m" } } });
    r = await run({}, j);
    check("an API removed from Settings ▸ API: the style says so", r.code === 1 && /API_Gone runs on an API that is not in Settings ▸ API any more/.test(r.out), r.out);
    j = job({ api: { service: "fal", key: "" }, params: { mode: "image", style: { name: "API_X", runs_on: "api", api_id: "a1", api_model: "m" } } });
    r = await run({}, j);
    check("no key: 'Settings ▸ API ▸ Mine has no key'", r.code === 1 && /Settings ▸ API ▸ Mine has no key/.test(r.out), r.out);
    j = job({ api: { service: "claude", key: "sk-ant-x" }, params: { mode: "image", style: { name: "API_X", runs_on: "api", api_id: "a1", api_model: "m" } } });
    r = await run({}, j);
    check("a style pointed at Claude: refused in words (Claude is the LLM only)", r.code === 1 && /is Claude - it is the LLM only/.test(r.out), r.out);
    const src = fs.readFileSync(path.join(ROOT, "misc", "api_worker.py"), "utf8");
    const imports = [...src.matchAll(/^(?:import|from) (\S+)/gm)].map((m) => m[1]).filter((m) => m !== "image_name");
    check("the worker imports only Python's own library (and the studio's image_name)", imports.every((m) => ["base64", "json", "mimetypes", "os", "shutil", "subprocess", "sys", "time", "urllib.error", "urllib.request", "uuid", "pathlib"].includes(m)), imports);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});

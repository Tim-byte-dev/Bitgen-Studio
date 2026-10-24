#!/usr/bin/env node
/* bitGen Studio — 2.384.0: a render's metadata, progress and seeds (lib/jobMeta, lib/sceneSeed, routes/jobMeta,
 * scripts/comfy_client.graph_meta, worker force_seed / plan_seed) + the page's wiring.
 * Run: node scripts/test-jobmeta.js
 * Tim: "when a queue is running add step n of total to the queued item instead of running and time -when the job is
 * done add a slideout to the div to show metadata - seed,cfg,steps, model used,loras used(make this a dialog and show
 * these details in the preview images/video dialog in a right pane). add a seed input in the basic settings so user can
 * reuse seed, use custom seed or use random seed. add the seed input to the scenes in videodocker too, so user can
 * reuse scene. add option in settings of video docker to reuse same seed for all scenes and the seed input (show last
 * seed used with option to set as seed) - in videodocker scene, when render is running, say running step n of total and
 * show a progress bar and time taken to render" (+ the pins' colours reversed, the LLM tokens lines). */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const JM = require(path.join(ROOT, "lib", "jobMeta"));
const RS = require(path.join(ROOT, "lib", "renderSettings"));
const jobsInfo = require(path.join(ROOT, "lib", "jobsInfo"));

function send(port, method, u, body) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: data ? { "Content-Type": "application/json", "Content-Length": data.length } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; });
      res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = { raw: b.slice(0, 80) }; } ok({ status: res.statusCode, j }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}

(async () => {
  // 1. the log lines -> metadata + progress
  const job = { id: "jm1", status: "running", started: Date.now() / 1000 - 75, params: { mode: "image", seed: -1, cfg: 4, steps: 20,
    width: 1024, height: 1024, prompt: "a cat", style: { name: "FLUX.2 9B", model: "flux/klein.safetensors", loras: [{ path: "flux/grain.safetensors", weight: 0.8 }] } } };
  JM.onLine(job, "[comfy] seed -1 -> random seed 12345");
  JM.onLine(job, "[comfy] step 3/8 — KSampler");
  let pr = JM.progress(job);
  check("progress: the sampler's 'step v/m' -> step 3 of 8 (38%), the time since it started", pr.step === 3 && pr.total === 8 && pr.pct === 38 && pr.elapsed >= 74, pr);
  JM.onLine(job, '[meta] {"seed":12345,"steps":8,"cfg":4,"sampler":"euler","models":["klein.safetensors"],"loras":[{"name":"grain.safetensors","weight":0.8}]}');
  JM.onLine(job, " 12/20 [00:03<00:02, 3.1it/s]");
  check("...a tqdm line too (sd-cli and friends)", job.step.n === 12 && job.step.total === 20, job.step);
  job.status = "done"; job.finished = job.started + 75.4;
  const m = JM.metaOf(job);
  check("metaOf: what the worker said (seed the -1 became, steps, cfg, sampler, model, LoRAs) + the job's size, mode, prompt, render time",
    m.seed === 12345 && m.steps === 8 && m.cfg === 4 && m.sampler === "euler" && m.models[0] === "klein.safetensors"
    && m.loras[0].name === "grain.safetensors" && m.loras[0].weight === 0.8 && m.width === 1024 && m.mode === "image"
    && m.prompt === "a cat" && m.seconds === 75.4 && m.style === "FLUX.2 9B", m);
  const bare = JM.metaOf({ params: { seed: 7, cfg: 1, steps: 4, video_style: { name: "H3", phases: [{ model: "a/h3.gguf" }], loras: [{ path: "x/turbo.safetensors", weight: 1 }] } } });
  check("...a job that said nothing: what was ASKED (seed >= 0, cfg, steps, the style's model + LoRAs)",
    bare.seed === 7 && bare.steps === 4 && bare.models[0] === "h3.gguf" && bare.loras[0].name === "turbo.safetensors", bare);
  const planJob = { params: { seed: -1 } };
  JM.onLine(planJob, "[comfy] seed -1 -> random seed 99");
  JM.onLine(planJob, "[comfy] seed used: 7700112233445566778 (the plan's, for this scene)");
  check("...'seed used: N' wins over the random roll (a plan-linked seed); a seed longer than a JS number stays digits",
    JM.metaOf(planJob).seed === "7700112233445566778", JM.metaOf(planJob).seed);
  const em = JM.entryMeta(job);
  check("entryMeta: the compact copy jobs.info keeps", em.seed === 12345 && em.steps === 8 && em.loras.length === 1 && em.seconds === 75.4 && !("prompt" in em), em);
  check("jobs.info: a finished job's entry carries meta", jobsInfo.entryFor(job).meta && jobsInfo.entryFor(job).meta.seed === 12345);
  check("core: every job's line goes through jobMeta; jobDict answers meta + progress",
    /require\("\.\/jobMeta"\)\.onLine\(job, line\)/.test(read("lib", "core.js")) && /meta: require\("\.\/jobMeta"\)\.metaOf\(job\), progress: require\("\.\/jobMeta"\)\.progress\(job\)/.test(read("lib", "core.js")));

  // 2. graph_meta (python) + the worker's seeds
  const py = execFileSync("python3", ["-c", [
    "import sys, json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + "); import comfy_client as c",
    "g = {'1': {'class_type': 'KSampler', 'inputs': {'seed': 42, 'steps': 8, 'cfg': 1.5, 'sampler_name': 'euler'}},",
    "     '2': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'flux\\\\klein.safetensors'}},",
    "     '3': {'class_type': 'LoraLoaderModelOnly', 'inputs': {'lora_name': 'a/grain.safetensors', 'strength_model': 0.8}},",
    "     '4': {'class_type': 'RandomNoise', 'inputs': {'noise_seed': ['9', 0]}}}",
    "print(json.dumps(c.graph_meta(g)))"].join("\n")], { encoding: "utf8" }).trim();
  const gm = JSON.parse(py);
  check("comfy_client.graph_meta: the graph's literal seed, steps, cfg, sampler, model files, LoRAs (+ weight); a linked seed is not a seed",
    gm.seed === 42 && gm.steps === 8 && gm.cfg === 1.5 && gm.sampler === "euler" && gm.models[0] === "klein.safetensors"
    && gm.loras[0].name === "grain.safetensors" && gm.loras[0].weight === 0.8 && !gm.seeds, gm);
  const CC = read("scripts", "comfy_client.py"), W = read("misc/worker.py");
  check("...printed as '[meta] {...}' before every queue (comfy_client.queue + the video worker's own submit)",
    /def queue\(base, graph, client_id=None\):\n    print_meta\(graph\)/.test(CC) && /_cc\.print_meta\(graph\)\s*\n\s*resp = _http_json\(base \+ "\/prompt"/.test(W));
  const wk = execFileSync("python3", ["-c", [
    "import sys, json; sys.argv=['x']; sys.path.insert(0, " + JSON.stringify(ROOT) + "); sys.path.insert(0, " + JSON.stringify(require("path").join(ROOT, "misc")) + "); import worker",
    "said = []; worker.say = lambda s: said.append(s)",
    "def g(): return {'9': {'class_type': 'ChainCurrent', 'inputs': {}},",
    "   '1': {'class_type': 'MiniMaxH3ImageToVideo', 'inputs': {'prompt': 'x', 'seed': ['9', 1], 'width': 64, 'height': 64}},",
    "   '2': {'class_type': 'RandomNoise', 'inputs': {'noise_seed': ['9', 2]}}}",
    "a = worker._patch_workflow(g(), prompt='p', seed=555, frames=17, width=64, height=64, steps=0, images=[], force_seed=True)",
    "b = worker._patch_workflow(g(), prompt='p', seed=555, frames=17, width=64, height=64, steps=0, images=[], plan_seed='777')",
    "print(json.dumps({'a1': a['1']['inputs']['seed'], 'a2': a['2']['inputs']['noise_seed'], 'b1': b['1']['inputs']['seed'], 'b2': b['2']['inputs']['noise_seed'], 'said': said}))"].join("\n")],
    { encoding: "utf8" }).trim().split("\n").pop();
  const wr = JSON.parse(wk);
  check("worker: force_seed (a seed the user set) beats a plan-linked seed; without it the plan's link stays and 'seed used: <plan seed>' is said",
    wr.a1 === 555 && wr.a2 === 555 && Array.isArray(wr.b1) && Array.isArray(wr.b2)
    && wr.said.some((x) => /seed used: 555 \(set for this scene\)/.test(x)) && wr.said.some((x) => /seed used: 777 \(the plan's/.test(x)), wr);

  // 3. render settings + scene seeds + the routes
  check("renderSettings: seed_mode random | same, seed (-1 = the last used), last_seed", RS.normalize({}).seed_mode === "random"
    && RS.normalize({ seed_mode: "same", seed: "123" }).seed === 123 && RS.normalize({ seed: "abc" }).seed === -1 && RS.normalize({ last_seed: -5 }).last_seed === null);
  const P = "zz_jm384_" + process.pid, orig = core.getProject();
  core.ensureProject(P); core.setProject(P);
  const pd = core.projDir(P);
  const scenes = require(path.join(ROOT, "lib", "scenes"));
  const SS = require(path.join(ROOT, "lib", "sceneSeed"));
  try {
    let st = scenes.load(P);
    st.list = [{ n: 1, id: "clip_01", prompt: ["a"], seed: "88", status: "idle" }, { n: 2, id: "clip_02", prompt: ["b"], status: "idle" }];
    scenes.save(st, P);
    check("seedFor: no own seed, the ⚙ on random -> a fresh random seed (-1); the plan's r.seed is NOT the user's",
      SS.seedFor(P, scenes.at(scenes.load(P), 1), -1).seed === -1);
    SS.setSceneSeed(P, 1, 4242);
    check("setSceneSeed: the card's own seed is kept on the board (user_seed) and wins",
      scenes.at(scenes.load(P), 1).user_seed === 4242 && SS.seedFor(P, scenes.at(scenes.load(P), 1), -1).seed === 4242);
    RS.save(pd, { seed_mode: "same", seed: -1, last_seed: 777 });
    check("...the ⚙ 'same seed for every scene': its seed, or (blank) the last seed used; the card's own still wins",
      SS.seedFor(P, scenes.at(scenes.load(P), 2), -1).seed === 777 && SS.seedFor(P, scenes.at(scenes.load(P), 1), -1).seed === 4242);
    const params = { scene: { n: 2 }, seed: -1 };
    const note = SS.beforeJob(params, P);
    check("beforeJob (core.makeJob): a scene job gets the rule's seed + force_seed, and says why", params.seed === 777 && params.force_seed === true && /same seed/.test(note), [params, note]);
    const fake = { id: "sj1", status: "done", started: 100, finished: 160, params: { mode: "ref2va", seed: 777 }, meta: { seed: 777, steps: 8 } };
    st = SS.harvest(P, scenes.load(P), 2, fake); scenes.save(st, P);
    const r2 = scenes.at(scenes.load(P), 2);
    check("harvest: the take's seed used, render time, metadata on the scene; the ⚙'s last seed = it", r2.seed_used === 777 && r2.render_seconds === 60 && r2.meta.steps === 8
      && RS.read(pd).last_seed === 777, r2);
    const up = { scene: { n: 2, upscale: true }, seed: -1 };
    SS.beforeJob(up, P);
    check("...an upscale job reuses the seed its take used", up.seed === 777 && up.force_seed === true, up);
    SS.setSceneSeed(P, 1, "");
    check("...a blank card seed goes back to the ⚙ rule", scenes.at(scenes.load(P), 1).user_seed === undefined);
    // the routes
    const express = require("express");
    const app = express(); app.use(express.json());
    require(path.join(ROOT, "routes", "index.js")).mount(app);
    const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    const done = { id: "jmdone1", status: "done", project: P, started: 1000, finished: 1012, output: "img_jm.png", outputs: ["img_jm.png", "img_jm_2.png"],
      params: { mode: "image", width: 512, height: 512, prompt: "z" }, log: [], meta: { seed: 31337, steps: 6 } };
    core.jobs.set(done.id, done); core.order.push(done.id);
    let q = await send(port, "GET", "/api/job-meta?name=img_jm_2.png");
    check("GET /api/job-meta?name=<one of a job's outputs> -> its metadata", q.status === 200 && q.j.meta.seed === 31337 && q.j.id === "jmdone1", q.j);
    q = await send(port, "GET", "/api/job-meta?name=nothing.png");
    check("...a file no job made: 404 in JSON", q.status === 404 && /no render metadata/.test(q.j.error));
    q = await send(port, "GET", "/api/job-meta/last-seed");
    check("GET /api/job-meta/last-seed -> the last finished job's seed (Basic Settings' ♻)", q.status === 200 && q.j.seed === 31337, q.j);
    q = await send(port, "POST", "/api/scenes/2/seed", { seed: 9001 });
    check("POST /api/scenes/:n/seed -> the card's own seed", q.status === 200 && q.j.user_seed === 9001 && scenes.at(scenes.load(P), 2).user_seed === 9001, q.j);
    q = await send(port, "GET", "/api/jobs/jmdone1");
    check("GET /api/jobs/:id carries meta", q.status === 200 && q.j.meta && q.j.meta.seed === 31337 && q.j.meta.seconds === 12, q.j.meta);
    core.jobs.delete(done.id); core.order.splice(core.order.indexOf(done.id), 1);
    srv.close();
  } finally {
    core.setProject(orig);
    fs.rmSync(pd, { recursive: true, force: true });
  }

  // 4. the page
  const H = read("static", "index.html"), JS = read("static", "jobmeta.js"), VD = read("ext", "videodock", "dock.html"),
    VR = read("ext", "videodock", "rendersettings.js"), VC = read("ext", "videodock", "characters.js");
  check("pins: NOT pinned = lit (the tiger edge, full colour), pinned = the old dim grey",
    /\.pinbtn \{[^}]*border: 1px solid var\(--tiger-deep\)[^}]*opacity: 1; filter: none;/.test(H) && /\.pinbtn\.on \{ opacity: \.45; filter: grayscale\(1\); border-color: transparent; \}/.test(H));
  check("LLM tokens: ≈ in prompt / Reply budget / the slider / Tokens consumed: n / (in / out) - one per line",
    H.indexOf('id="tokCount"') < H.indexOf('>Reply budget') && H.indexOf('>Reply budget') < H.indexOf('id="tokMax" min') && H.indexOf('id="tokMax" min') < H.indexOf('Tokens consumed: <span id="tokUsed"')
    && H.indexOf('Tokens consumed: <span id="tokUsed"') < H.indexOf('id="tokUsedIO"') && H.includes('$("tokUsedIO").textContent = `(${u.in.toLocaleString()} in / ${u.out.toLocaleString()} out)`;'));
  check("queue: a running job says 'step n of total · m:ss' (refreshJobs + the stats poll); a finished one has ⓘ -> the details dialog",
    H.includes('if (j.status === "running") el.querySelector(".st").textContent = jobRunText(j.progress);') && /function jobRunText\(pr\)/.test(H)
    && H.includes("`${ch}step ${pr.step} of ${pr.total}`") && H.includes('if (row && s.running.progress) row.textContent = jobRunText(s.running.progress);')
    && H.includes('if (j.status === "done" && j.meta) jobInfoBtn(el, j.meta, j.id);') && /H3JobMeta\.open\(meta, "Render details · " \+ id\)/.test(H));
  check("the preview dialog: a right pane with the render details (ⓘ hides / shows it)",
    /<aside class="lbmeta" id="lb_meta"/.test(H) && /H3JobMeta\.pane\(\$\("lb_meta"\), it\.name\)/.test(H) && /id="lb_info"/.test(H)
    && H.includes('<script src="/static/jobmeta.js"></script>') && /fetch\("\/api\/job-meta\?name="/.test(JS) && /♻ Use/.test(JS));
  check("Basic Settings' Seed: the box (-1 random / any number), 🎲 random, ♻ the last seed used (shown)",
    /id="seed" value="-1"/.test(H) && /id="seedRand"/.test(H) && /id="seedLast"/.test(H) && /id="seedLastV"/.test(H) && /fetch\("\/api\/job-meta\/last-seed"\)/.test(H));
  check("video docker ⚙: Seed - Random for each scene / Same seed for every scene, the seed, ♻ the last seed used",
    /id="vdSetSeedMode"/.test(VD) && /<option value="same">Same seed for every scene/.test(VD) && /id="vdSetSeed"/.test(VD) && /id="vdSetSeedUse"/.test(VD)
    && /seed_mode: el\("vdSetSeedMode"\)/.test(VR) && /"last seed used: " \+ lastSeed/.test(VR));
  check("2.391.1: a running scene whose own job is not the running one gets the progress of the running job that names it (no bare 'rendering…')",
    /\(\(x\.params \|\| \{\}\)\.scene \|\| \{\}\)\.n === r\.n/.test(read("routes", "characters.js")));
  check("scene cards: a seed box (+ ♻ the last take's seed); a rendering scene says 'running step n of total', a bar, its time; a finished one its time + seed",
    /data-scseed="/.test(VC) && /data-scseeduse="/.test(VC) && /"\/api\/scenes\/" \+ b\.getAttribute\("data-scseed"\) \+ "\/seed"/.test(VC)
    && /"⏳ rendering" \+ \(pr\.total \? " step " \+ pr\.step \+ " of " \+ pr\.total/.test(VC) && /class="scprog"/.test(VC)
    && /b \+= " in " \+ scClock\(r\.render_seconds\)/.test(VC) && /b \+= " · seed " \+ r\.seed_used/.test(VC));
  check("routes/jobMeta mounted from routes/index.js (never server.js); /api/stats' running job carries its progress",
    /require\("\.\/jobMeta"\)\.mount\(app\)/.test(read("routes", "index.js")) && /progress: require\("\.\.\/lib\/jobMeta"\)\.progress\(running\)/.test(read("routes", "index.js"))
    && !/jobMeta/.test(read("misc/server.js")));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });

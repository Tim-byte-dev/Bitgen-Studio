"use strict";
/**
 * bitGen Studio — the native engine behind Viggle (native) (2.352.0) - the swap dialog's ⚙ uses it through
 * routes/viggleNative.js.
 *
 *   GET  /api/native/status    each component Viggle needs: its source (your ComfyUI file / the official
 *                              download / missing), the candidates found + their check, readiness, the venv,
 *                              the running server, the install job
 *   POST /api/native/check     read the headers of every ComfyUI candidate (in the venv) -> which ones the
 *                              engine can use; the sources are chosen again
 *   POST /api/native/config    the settings (prefer, RAM packing, folders, port, picks ...)
 *   POST /api/native/install   ONE job: the venv (torch + diffusers pinned) then the official parts missing
 *   POST /api/native/server    {action: "unload" | "stop"}
 *
 * lib/nativeEngine.js has the logic; scripts/native/ the engine itself.
 */
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const core = require("../lib/core");
const NE = require("../lib/nativeEngine");

function comfyExtra() {
  try { return require("../lib/comfyPaths").read(); } catch { return {}; }
}

/** Resolve + save what the workers read (config.native.sources ...). -> {n, p, res, cands, roots} */
function refresh(save) {
  const config = core.getConfig();
  const r = NE.refreshConfig(config, { BASE: core.BASE, MODELS_DIR: core.MODELS_DIR, resolvePath: core.resolvePath,
    comfyExtra, save: save === false ? null : () => core.setConfig(config) });
  return { ...r, cands: r.cands || NE.candidates(r.roots) };
}

function installJob() {
  for (let i = core.order.length - 1; i >= 0; i--) {
    const j = core.jobs.get(core.order[i]);
    if (j && j.params && (j.params.mode === "install_native" || j.params.mode === "install_viggle"))
      return { id: j.id, status: j.status, last: (j.log || []).slice(-1)[0] || "" };
  }
  return null;
}

let lastHealth = { at: 0, h: null };
function serverHealth(port) {
  // non-blocking: the status never waits on the server; the last answer (<= 5 s old) is shown
  if (Date.now() - lastHealth.at > 5000) {
    lastHealth.at = Date.now();
    const req = require("http").get({ host: "127.0.0.1", port, path: "/health", timeout: 800 }, (r) => {
      let b = ""; r.on("data", (d) => { b += d; }); r.on("end", () => { try { lastHealth.h = JSON.parse(b); } catch { lastHealth.h = null; } });
    });
    req.on("error", () => { lastHealth.h = null; });
    req.on("timeout", () => { req.destroy(); lastHealth.h = null; });
  }
  return lastHealth.h;
}

function statusView() {
  const { n, p, res } = refresh();
  const venv = fs.existsSync(p.python);
  const comps = NE.COMPONENTS.map((c) => ({ id: c.id, label: c.label, gb: c.gb, need: c.need, ...res[c.id] }));
  return {
    settings: { prefer: n.prefer, pack: n.pack, pin: n.pin, ram_budget_gb: n.ram_budget_gb, port: n.port,
                idle_unload_min: n.idle_unload_min, idle_exit_min: n.idle_exit_min, free_comfy: n.free_comfy, device: n.device,
                dir: n.dir, venv: n.venv, picks: n.picks },
    paths: p, venv_ready: venv, components: comps,
    viggle: { ...NE.readiness(res, venv, "viggle"), note: NE.notReady(NE.readiness(res, venv, "viggle"), "viggle") },
    server: serverHealth(n.port), job: installJob(), diffusers_commit: NE.DIFFUSERS_COMMIT,
    comfy_dir: (((core.getConfig().engine || {}).comfy || {}).dir) || "",
  };
}

let checking = null;
function runCheck() {
  if (checking) return checking;
  const { n, p, cands } = refresh(false);
  if (!fs.existsSync(p.python)) return Promise.resolve({ error: "⤓ Install first - its Python environment is what reads the files" });
  const spec = {};
  const todo = [];
  for (const [comp, files] of Object.entries(cands)) for (const f of files) {
    const k = NE.fileKey(f);
    if (k && !(n.checks || {})[k]) { spec[`${comp}#${todo.length}`] = { comfy: f }; todo.push({ comp, f, k }); }
  }
  if (!todo.length) return Promise.resolve({ checked: 0 });
  const base = fs.existsSync(path.join(p.base, "transformer_ref", "config.json")) ? p.base : "";
  if (!base) return Promise.resolve({ error: "the small official configs are needed to check files - ⤓ Install (it fetches them first, ~25 MB)" });
  // check.py wants plain component names: one call per file
  checking = new Promise((resolve) => {
    const results = {};
    const next = (i) => {
      if (i >= todo.length) {
        const config = core.getConfig();
        config.native = { ...NE.defaults(), ...(config.native || {}), checks: { ...((config.native || {}).checks || {}), ...results } };
        core.setConfig(config);
        checking = null;
        refresh();
        return resolve({ checked: todo.length });
      }
      const t = todo[i];
      const comp = t.comp === "viggle_lora" ? "viggle_lora" : t.comp;
      const child = spawn(p.python, [path.join(core.BASE, "scripts", "native", "check.py"), base, JSON.stringify({ [comp]: { comfy: t.f } })],
        { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
      let out = "";
      child.stdout.on("data", (d) => { out += d; });
      child.on("close", () => {
        let r = null;
        try { r = JSON.parse(out.trim().split("\n").pop())[comp]; } catch { r = { ok: false, why: "the check did not answer (is the venv complete?)" }; }
        results[t.k] = { ok: !!r.ok, why: String(r.why || "").slice(0, 400), at: Date.now() };
        next(i + 1);
      });
      child.on("error", (e) => { results[t.k] = { ok: false, why: e.message }; next(i + 1); });
    };
    next(0);
  });
  return checking;
}

/** The install job (the venv + the official weights still missing). -> {status, body}
 *  2.353.0: the files Tim's ComfyUI workflows name are NOT downloaded - they are checked once the venv
 *  exists (afterInstall) and only one the engine cannot read is fetched, by a follow-up install. */
function install(b) {
  const j = installJob();
  if (j && (j.status === "queued" || j.status === "running"))
    return { status: 409, body: { error: "a native engine install is already running - follow it in the queue", job: j } };
  const { p, res: r } = refresh();
  let comps = Array.isArray(b.components) ? b.components.filter((x) => Object.values(NE.FETCH_ID).includes(x)) : null;
  if (!comps) comps = NE.fetchList(r, "viggle");
  if (!fs.existsSync(path.join(p.base, "modular_model_index.json")) && !comps.includes("base")) comps.unshift("base");
  const mine = Object.entries(r).filter(([id, x]) => !x.source && NE.trusted(x) && NE.BYID[id].need.includes("viggle"))
    .map(([id, x]) => ({ id, file: x.workflow.file, name: x.workflow.name, from: x.workflow.from }));
  const job = core.makeJob({
    mode: "install_native", project: core.getProject(),
    prompt: `[install] Viggle (native)${b.auto ? " (on start - components.txt)" : ""}: venv ${p.venv}`
      + (comps.length ? `, weights ${comps.join(", ")} into ${p.root}` : "")
      + (mine.length ? `; your ComfyUI files (named in ${[...new Set(mine.map((x) => x.from))].join(", ")}): `
        + mine.map((x) => x.name).join(", ") + " - checked after the venv, downloaded only if the engine cannot read them" : ""),
    comfy_files: Object.fromEntries(mine.map((x) => [x.id, x.file])),
    width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm",
    venv: p.venv, weights_root: p.root, fetch: comps.length > 0, fetch_components: comps,
    torch_index: String(b.torch_index || ""), device: "cuda", diffusers_commit: NE.DIFFUSERS_COMMIT,
    hf_token: (core.getConfig().hf || {}).token || "", cuda_capability: (() => {
      try {
        const o = spawnSync("nvidia-smi", ["--query-gpu=compute_cap", "--format=csv,noheader"], { encoding: "utf8", timeout: 8000 });
        const caps = String(o.stdout || "").trim().split("\n").map(parseFloat).filter(isFinite);
        return caps.length ? Math.max(...caps) : 0;
      } catch { return 0; }
    })(),
  });
  watch(job.id, !!b.followup);
  return { status: 200, body: { id: job.id, components: comps, comfy_files: mine, ...statusView() } };
}

/** 2.353.0: when an install job ends - check the ComfyUI files (the venv can read them now), fetch what
 *  the engine could not read (one follow-up install), write components.txt. */
function afterInstall(jobId, followup) {
  const j = core.jobs.get(jobId);
  const say = (m) => { if (j) try { j.log = j.log || []; j.log.push(m); } catch {} console.log(m); };
  const done = () => { try { require("./components").sync(); } catch (e) { console.log("[components] " + e.message); } };
  if (!j || j.status !== "done") return Promise.resolve(done());
  return runCheck().then((c) => {
    if (c && c.checked) say(`[native] checked ${c.checked} ComfyUI file(s) against the engine`);
    const { res } = refresh();
    const rest = NE.fetchList(res, "viggle");
    if (rest.length && !followup) {
      say(`[native] the engine cannot use ${rest.join(", ")} from ComfyUI - downloading it`);
      install({ components: rest, followup: true });
    }
    done();
  }).catch((e) => { say("[native] the after-install check failed: " + e.message); done(); });
}

const watching = new Set();
function watch(jobId, followup) {
  if (watching.has(jobId)) return;
  watching.add(jobId);
  const t = setInterval(() => {
    const j = core.jobs.get(jobId);
    if (j && !j.finished) return;
    clearInterval(t);
    watching.delete(jobId);
    afterInstall(jobId, followup);
  }, 2000);
  if (t.unref) t.unref();
}

function mount(app) {
  app.get("/api/native/status", (_req, res) => res.json(statusView()));

  app.post("/api/native/check", async (_req, res) => {
    const r = await runCheck();
    if (r.error) return res.status(400).json({ error: r.error, ...statusView() });
    res.json({ ...r, ...statusView() });
  });

  app.post("/api/native/config", (req, res) => {
    const config = core.getConfig();
    const b = NE.settingsSafe(req.body || {});
    config.native = { ...NE.defaults(), ...(config.native || {}), ...b };
    core.setConfig(config);
    res.json(statusView());
  });

  app.post("/api/native/install", (req, res) => {
    const r = install(req.body || {});
    res.status(r.status).json(r.body);
  });

  app.post("/api/native/server", (req, res) => {
    const action = String((req.body || {}).action || "");
    if (!["unload", "stop"].includes(action)) return res.status(400).json({ error: "action must be unload or stop" });
    const port = NE.cfgOf(core.getConfig()).port;
    const r = require("http").request({ host: "127.0.0.1", port, path: action === "stop" ? "/shutdown" : "/unload", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": 2 }, timeout: 120000 }, (x) => {
      let b = ""; x.on("data", (d) => { b += d; }); x.on("end", () => { lastHealth.at = 0; res.json({ ok: x.statusCode === 200, answer: b.slice(0, 300) }); });
    });
    r.on("error", () => res.json({ ok: true, answer: "the engine server is not running" }));
    r.end("{}");
  });
}

module.exports = { mount, refresh, statusView, runCheck, install, afterInstall, installJob };

"use strict";
/**
 * bitGen Studio — the VISION model (2.233.0, Tim verbatim: "is it possible
 * for us to upload a picture or pictures into the prompt and have a te like
 * Qwen3-VL-8B-NSFW-Caption-V4-GGUF describe the pictures to the llm and for
 * the llm to use the descriptions and the prompt to generate a response?").
 *
 * A SECOND managed llama-server, started on demand on its own port
 * (config.captioner.port, default 8199), loading a Qwen3-VL-class .gguf,
 * WITH its mmproj projector (--mmproj) when one sits beside it. It rides
 * the EXISTING llama.cpp binaries from misc\\get-llama.ps1 — misc\\get-qwen3vl.ps1
 * only downloads model + mmproj into <app>/qwen3vl/.
 *
 * VRAM COURTESY beside the 26B chat model: when captioner.keep is off (the
 * default) the server is stopped after captioner.idle_min minutes without a
 * describe() call. keep=true holds it warm for rapid-fire captioning.
 *
 * Errors are THROWN with words a route can put straight in a reply — every
 * caller wraps describe() and falls back in words ("the vision model is not
 * installed - run misc\\get-qwen3vl.ps1"), never a dead chat.
 */
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

/** The one question every attached picture is asked. Named here so the chat
 *  route, the tests and the HANDOVER all point at the same words. */
const DESCRIBE_PROMPT =
  "Describe this picture precisely for a screenwriter: subjects, their "
  + "appearance and clothing, the setting, lighting, mood, and any visible "
  + "action. One tight paragraph, no preamble.";

let cap = { proc: null, sig: "", ready: false, idle: null, model: "", last_error: "" };

/* ------------------------------------------------------------------ 2.237.0
   THE VISION LOG (Tim verbatim: "no logs to show. show all logs in console
   and make it copiable"). EVERY captioner line — scans, the launch command,
   the vision llama-server's OWN stdout/stderr (piped, no longer discarded),
   health-wait progress, per-picture describes, errors and exit codes — goes
   through vlog(): to the app console AND into this ring, which
   GET /api/captioner/logs serves and the Console dock's 🖼 Vision view
   shows. Capped so a chatty server cannot eat the heap. */
const LOG_CAP = 600;
const LOG = [];
function vlog(line) {
  const s = String(line);
  console.log(s);
  LOG.push(new Date().toISOString().slice(11, 19) + " " + s);
  if (LOG.length > LOG_CAP) LOG.splice(0, LOG.length - LOG_CAP);
}
function logs() { return LOG.slice(); }

/** Wrap an async captioner entry point so ANY error it throws is logged in
 *  the ring and remembered on status().last_error before it propagates —
 *  "no logs to show" must never be true of a failure again. A success
 *  clears the remembered error. */
function logged(name, fn) {
  return async function (...a) {
    try { const r = await fn(...a); cap.last_error = ""; return r; }
    catch (e) {
      cap.last_error = String((e && e.message) || e);
      vlog(`[captioner] ERROR in ${name}: ` + cap.last_error);
      throw e;
    }
  };
}

/** 2.234.0 ("show loading vision model in statusbar"): the one truth the
 *  statusbar polls — GET /api/captioner/status answers this. `loading` is
 *  a process alive but not yet answering /health (the up-to-3-minute model
 *  load); the promptdock paints "loading vision model" for exactly that
 *  window. */
/** 2.235.0: which device the vision model runs on — captioner.device when
 *  set, else the LLM's own device (the 2.234.0 "same gpu as llm" rule). */
function visionDevice(core) {
  const c = cfgOf(core);
  if (c.device) return c.device;
  const llmCfg = ((typeof core.getConfig === "function" ? core.getConfig() : {}) || {}).llm || {};
  return String(llmCfg.device || "cuda1");
}

/** True when the vision model and the chat LLM share a device. Decides the
 *  after-describe policy (Tim verbatim: "after the vision llm describes all
 *  the loaded images it is unloaded from the gpu and the llm is loaded into
 *  the gpu ... if gpu for vision is different to gpu for llm then keep them
 *  both loaded"). */
function sameGpu(core) {
  const llmCfg = ((typeof core.getConfig === "function" ? core.getConfig() : {}) || {}).llm || {};
  return visionDevice(core) === String(llmCfg.device || "cuda1");
}

/** 2.235.0 ("keep them both loaded UNTIL an image or video model is going
 *  to be loaded"): core.pump() calls this before spawning any model-loading
 *  job — the vision model's VRAM is handed over. Answers whether anything
 *  was actually running (for the log's honesty). */
/** The card ComfyUI renders on — device 0 unless pinned in config
 *  (comfy.gpu). 2.258.0. */
function renderGpu(core) {
  const cfg = ((typeof core.getConfig === "function" ? core.getConfig() : {}) || {});
  return String((cfg.comfy && cfg.comfy.gpu) || "cuda0");
}

function freeForJob(reason, core) {
  if (!cap.proc) return false;
  /* 2.258.0 (Tim: "if model is load on second gpu with cpu offloading,
     keep the model on the second gpu until a new model for the gpu is
     selected, then clear the vram and load the new model"): a vision
     model on a DIFFERENT card than the render is not in the job's way —
     it stays warm. Only a NEW model selection for its own GPU (ensure's
     sig change) evicts it now. Without core context the old behaviour
     stands (free), so no caller can strand VRAM by accident. */
  if (core && visionDevice(core) !== renderGpu(core)) {
    vlog("[captioner] keeping the vision model warm — it lives on "
      + visionDevice(core) + ", the render runs on " + renderGpu(core));
    return false;
  }
  vlog("[captioner] freeing the vision model — "
    + (reason || "an image/video job is starting"));
  stop();
  return true;
}

function status() {
  return {
    running: !!cap.proc,
    ready: !!cap.ready,
    loading: !!cap.proc && !cap.ready,
    model: cap.model || "",
    last_error: cap.last_error || "",
  };
}

function cfgOf(core) {
  const c = ((typeof core.getConfig === "function" ? core.getConfig() : {}) || {}).captioner || {};
  const idle = Number(c.idle_min);
  // 2.233.6: the picked folder is SANITISED — Windows "Copy as path" wraps
  // the value in literal quotation marks, and a quoted or space-padded
  // path fails statSync and censused "(missing)" while looking perfectly
  // right in the Settings box. Strip wrapping quotes and trailing
  // whitespace/separators so what the eye sees is what the scan reads.
  const dir = String(c.dir || "").trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/[\\/]+$/, "");
  return {
    model: String(c.model || ""),
    dir,
    mmproj: String(c.mmproj || ""),
    // 2.235.0 (Tim verbatim: "add an option in settings-llm for gpu for
    // vision as well"): "" = follow the LLM's device (the 2.234.0 rule).
    device: String(c.device || ""),
    port: (c.port | 0) || 8199,
    keep: !!c.keep,
    idle_min: Number.isFinite(idle) && idle > 0 ? idle : 5,
  };
}

/** Where vision models live. 2.233.3 (Tim verbatim: "add another input
 *  (folder picker) in settings-llm for vision models. the use that folder
 *  for the vision models list"): when config captioner.dir is SET, THAT
 *  folder is the list — the one authoritative answer, no automatic scan
 *  beside it to muddy a diagnosis (relative paths resolve against the app
 *  root, like llm.dir does). Empty = the automatic scan: <app>/qwen3vl
 *  (misc\\get-qwen3vl.ps1's landing), the LLM folder's vision/ subfolder, and
 *  the LLM folder itself. */
function visionDirs(core) {
  const c = cfgOf(core);
  if (c.dir) {
    let d = path.isAbsolute(c.dir) ? c.dir : path.join(core.BASE, c.dir);
    // 2.233.6 (Tim's sixth report carried the cause at last: "my folder
    // path is F:\llModel\vision\Qwen3-VL-8B-...f16.gguf" — a FILE pasted
    // into the folder field; readdir on a file throws, the dir censused
    // "(missing)", the dropdown stayed empty through five releases of
    // scan fixes). A picked path that IS a file now means its PARENT
    // folder — the mistake becomes impossible instead of fatal.
    try { if (fs.statSync(d).isFile()) d = path.dirname(d); } catch { /* missing: censused below */ }
    return [d];
  }
  const dirs = [path.join(core.BASE, "qwen3vl")];
  try {
    const d = core.llmPaths().dir;
    const v = path.join(d, "vision");
    if (!dirs.includes(v)) dirs.push(v);
    if (!dirs.includes(d)) dirs.push(d);
  } catch { /* llm dir unset — qwen3vl/ alone */ }
  return dirs;
}

/** Pure pairing rule (tested directly). 2.233.5 (Tim verbatim: "check to
 *  see if there are any filters beyond the folder, remove all filters.
 *  scan the vision folder"): ZERO content filters — EVERY file in the
 *  folder lists, any extension, any name. The audit that this instruction
 *  forced found the survivor: every earlier cut still required the .gguf
 *  extension, so a folder of .safetensors (or anything else) scanned as
 *  occupied and listed NOTHING. Pairing is now advisory only: a non-mmproj
 *  file gets the folder's stem-matching mmproj .gguf (else the first, else
 *  ""); mmproj-named files list too, with mmproj "" — picking a file
 *  llama-server cannot load fails at LAUNCH in words, never silently in
 *  the scan. */
function pairFiles(names) {
  const isMm = (f) => /mmproj/i.test(f);
  const mms = names.filter((f) => isMm(f) && f.toLowerCase().endsWith(".gguf")).sort();
  const out = [];
  for (const f of names) {
    if (isMm(f)) { out.push({ model: f, mmproj: "" }); continue; }
    const stem = f.replace(/\.[^.]+$/, "").toLowerCase().slice(0, 12);
    const match = mms.find((m) => m.toLowerCase().includes(stem)) || mms[0] || "";
    out.push({ model: f, mmproj: match });
  }
  return out;
}

/** The dropdown's answer: every listable vision model, absolute paths.
 *  2.233.2 (Tim: "it is not populating the vision dropdown ... i already
 *  have the models in <llm folder>\vision"): vision dirs are walked ONE
 *  level deep — a per-model SUBFOLDER (vision\Qwen3-VL-8B\model+mmproj) is
 *  scanned as its own directory with its own pairing. The flat LLM folder
 *  itself is NOT recursed when it arrives via the automatic scan (it holds
 *  engines and chat models; vision/ is the sanctioned nest) — an
 *  explicitly PICKED folder (2.233.3) always walks one level, even when it
 *  IS the LLM folder. */
function scan(core) { return scanReport(core).models; }

function scanReport(core) {
  const models = [];
  const dirs = [];
  const roots = visionDirs(core);
  const flat = cfgOf(core).dir ? null
    : (() => { try { return core.llmPaths().dir; } catch { return null; } })();
  const walk = [];
  for (const root of roots) {
    walk.push(root);
    if (root === flat) continue;               // the flat LLM dir: top level only
    try {
      for (const e of fs.readdirSync(root, { withFileTypes: true })) {
        if (e.isDirectory()) walk.push(path.join(root, e.name));
      }
    } catch { /* reported below as missing */ }
  }
  for (const dir of walk) {
    let names = [];
    let exists = true;
    try { names = fs.readdirSync(dir).filter((n) => {
      try { return fs.statSync(path.join(dir, n)).isFile(); } catch { return false; }
    }); } catch { exists = false; }
    const gg = names.filter((n) => n.toLowerCase().endsWith(".gguf"));
    const mm = gg.filter((n) => /mmproj/i.test(n));
    dirs.push({ dir, exists, files: names.length, gguf: gg.length, mmproj: mm.length });
    if (!exists) continue;
    for (const p of pairFiles(names)) {
      models.push({ name: p.model, dir,
                    model: path.join(dir, p.model),
                    mmproj: p.mmproj ? path.join(dir, p.mmproj) : "" });
    }
  }
  // WHY-EMPTY IN WORDS + a VERSION STAMP (2.233.5): the report says which
  // code is answering, so "still not listing" can distinguish a stale
  // server from an empty folder at a glance. With zero content filters,
  // empty now means literally no files in any scanned folder.
  const app = (() => { try { return require("../package.json").version; } catch { return "?"; } })();
  const note = models.length ? "" :
    `[bitGen v${app}] no files found — scanned: `
    + dirs.map((d) => d.exists
        ? `${d.dir} (${d.files} file(s), ${d.gguf} .gguf, ${d.mmproj} mmproj)`
        : `${d.dir} (missing)`).join(" | ")
    + " — every file in these folders lists, so empty means the folders "
    + "hold nothing (or the path is wrong); an mmproj .gguf BESIDE a model "
    + "lets it see pictures (misc\\get-qwen3vl.ps1 downloads a matched pair).";
  return { app, models, dirs, note };
}

function stop() {
  if (cap.idle) { clearTimeout(cap.idle); }
  if (cap.proc) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(cap.proc.pid), "/T", "/F"]);
    else cap.proc.kill("SIGTERM");
  }
  cap = { proc: null, sig: "", ready: false, idle: null, model: "", last_error: cap.last_error };
}

/** (Re)arm the idle stop — a safety net for a SAME-GPU vision model that
 *  ensure()d but whose describe never finished (2.235.0: a DIFFERENT-GPU
 *  vision model never idles out — it holds warm beside the LLM until
 *  freeForJob() hands its VRAM to an image/video job, by instruction). */
function armIdle(core) {
  const c = cfgOf(core);
  if (cap.idle) clearTimeout(cap.idle);
  cap.idle = null;
  if (c.keep || !cap.proc) return;
  if (!sameGpu(core)) return;
  cap.idle = setTimeout(() => {
    vlog("[captioner] idle — stopping the vision model (captioner.keep holds it warm)");
    stop();
  }, c.idle_min * 60000);
  if (typeof cap.idle.unref === "function") cap.idle.unref();
}

async function healthy(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health`,
      { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

/** Start-on-demand. Throws in words when the pieces are missing.
 *  2.233.4: an EMPTY mmproj no longer refuses — the server launches
 *  without --mmproj (with a plain warning in the log); if the model has no
 *  embedded projector the describe call fails with the server's own words
 *  and the chat falls back, never dies. A CONFIGURED mmproj path that does
 *  not exist on disk is still an error — that is a broken setting, not a
 *  choice. */
async function ensure(core) {
  const c = cfgOf(core);
  if (!c.model) {
    throw new Error("no vision model selected — pick one in the Prompt dock's "
      + "Vision dropdown (the vision model is not installed - run misc\\get-qwen3vl.ps1 "
      + "if the list is empty)");
  }
  const { exe } = core.llmPaths();
  if (!fs.existsSync(exe)) {
    throw new Error(`llama-server not found at ${exe} — run misc\\get-llama.ps1 or `
      + "set the engine folder in Settings → LLM (the vision model rides the "
      + "same binaries).");
  }
  if (!fs.existsSync(c.model)) throw new Error(`vision model not found: ${c.model} — run misc\\get-qwen3vl.ps1 or re-pick in the Vision dropdown`);
  if (c.mmproj && !fs.existsSync(c.mmproj)) {
    throw new Error(`mmproj projector not found: ${c.mmproj} — re-pick the model `
      + "in the Vision dropdown (the projector file moved or was renamed).");
  }
  // 2.234.0 ("load visionmodel into the same gpu as llm") + 2.235.0 ("add
  // an option in settings-llm for gpu for vision as well"): the device is
  // captioner.device when Settings set one, else the LLM's own — pinned via
  // CUDA_VISIBLE_DEVICES exactly the way core.ensureLlama pins it, every
  // layer on that card (-ngl 99; the vision model is small beside the 26B),
  // cpu keeps -ngl 0. The device joins the launch signature so a Settings
  // device change restarts the vision server too.
  const dev = visionDevice(core);
  const env = { ...process.env };
  const sig = `${c.model}|${c.mmproj}|${c.port}|${dev}`;
  if (cap.proc && cap.sig === sig && (await healthy(c.port))) { armIdle(core); return; }
  // 2.258.0: same rule as the chat LLM — the old vision model's card must
  // be DRAINED before the new one allocates (the sig remembers its device).
  const hadProc = !!cap.proc;
  const oldDev = hadProc && cap.sig ? String(cap.sig).split("|").pop() : dev;
  stop();
  if (hadProc && core.gpuSettle) await core.gpuSettle(oldDev);
  const args = ["-m", c.model];
  if (!/\.gguf$/i.test(c.model)) {
    vlog(`[captioner] NOTE: ${path.basename(c.model)} is not a .gguf — `
      + "llama-server only loads .gguf files; if the launch fails, pick a "
      + ".gguf (the dropdown lists every file by instruction, loadable or not).");
  }
  if (c.mmproj) args.push("--mmproj", c.mmproj);
  else vlog(`[captioner] WARNING: no mmproj beside ${path.basename(c.model)} — `
    + "launching without --mmproj; unless the projector is embedded the model "
    + "is text-only and picture describes will fail in words. Drop the model's "
    + "mmproj .gguf into the same folder to fix.");
  if (dev === "cpu") args.push("-ngl", "0");
  else { env.CUDA_VISIBLE_DEVICES = dev.replace("cuda", ""); args.push("-ngl", "99"); }
  args.push("--port", String(c.port), "--host", "127.0.0.1");
  vlog(`[captioner] starting vision model: ${path.basename(c.model)} `
    + `(port ${c.port}, device ${dev} — the LLM's own GPU)`);
  vlog("[captioner] launch: " + core.llmPaths().exe + " " + args.join(" "));
  const proc = spawn(core.llmPaths().exe, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  // the server's own words are THE diagnosis (bad gguf, OOM, wrong build) —
  // line-split both streams into the ring, never discarded again (2.237.0)
  let vbuf = "";
  const onOut = (d) => {
    vbuf += d.toString();
    let i;
    while ((i = vbuf.indexOf("\n")) >= 0) {
      const l = vbuf.slice(0, i).trimEnd(); vbuf = vbuf.slice(i + 1);
      if (l) vlog("[vision-server] " + l);
    }
  };
  proc.stdout.on("data", onOut);
  proc.stderr.on("data", onOut);
  proc.on("exit", (code, sig2) => {
    if (vbuf.trim()) vlog("[vision-server] " + vbuf.trim());
    vlog(`[captioner] vision llama-server exited (code ${code}, signal ${sig2 || "none"})`);
    if (cap.proc === proc) cap = { proc: null, sig: "", ready: false, idle: null, model: "", last_error: cap.last_error };
  });
  cap = { proc, sig, ready: false, idle: null, model: path.basename(c.model) };
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (!cap.proc || cap.proc !== proc) {
      throw new Error("the vision llama-server exited while loading — wrong "
        + "build, or not enough memory beside the chat model? (captioner.keep=false "
        + "stops it when idle; try again with the chat model unloaded)");
    }
    if (await healthy(c.port)) {
      cap.ready = true; armIdle(core);
      vlog(`[captioner] vision model READY on port ${c.port} `
        + `(${Math.round((Date.now() - (deadline - 180000)) / 1000)}s to load)`);
      return;
    }
    const waited = Math.round((Date.now() - (deadline - 180000)) / 1000);
    if (waited > 0 && waited % 15 === 0) vlog(`[captioner] still loading… ${waited}s`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  stop();
  throw new Error("the vision model did not become ready within 3 minutes");
}

/**
 * One description per picture, in order. files = multer memory-storage
 * entries ({buffer, mimetype, originalname}) or {path} entries. 2.335.0: an
 * entry may carry its OWN question (`prompt`) and token budget (`max_tokens`)
 * - the character swap's ✎ Write prompt asks the picture about the
 * character's identity and a video frame about the performer
 * (lib/swapPrompt). No `prompt` = DESCRIBE_PROMPT, as before.
 */
async function describe(core, files) {
  await ensure(core);
  const c = cfgOf(core);
  const out = [];
  for (const f of files || []) {
    const buf = f.buffer || fs.readFileSync(f.path);
    const mt = String(f.mimetype || "image/png");
    const r = await fetch(`http://127.0.0.1:${c.port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "local",
        messages: [{ role: "user", content: [
          { type: "image_url", image_url: { url: `data:${mt};base64,${buf.toString("base64")}` } },
          { type: "text", text: f.prompt ? String(f.prompt) : DESCRIBE_PROMPT },
        ] }],
        temperature: 0.4,
        max_tokens: Math.max(64, Math.min(1500, parseInt(f.max_tokens, 10) || 400)),
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
    if (!r.ok) {
      let body = "";
      try { body = String(await r.text()).slice(0, 200); } catch { /* opaque */ }
      throw new Error(`the vision model answered ${r.status}${body ? ": " + body : ""}`
        + (c.mmproj ? "" : " (the selected model has no mmproj beside it — "
          + "without the projector it cannot see; drop the mmproj .gguf into "
          + "the same folder)"));
    }
    const j = await r.json();
    const text = String((((j.choices || [])[0] || {}).message || {}).content || "").trim();
    vlog(`[captioner] described ${f.originalname || f.path || "picture"} `
      + `(${Math.round(buf.length / 1024)} KB) -> ${text.length} chars`);
    out.push(text || "(the vision model returned nothing for this picture)");
  }
  // 2.235.0, the after-batch policy (Tim verbatim: "after the vision llm
  // describes all the loaded images it is unloaded from the gpu and the
  // llm is loaded into the gpu ... if gpu for vision is different to gpu
  // for llm then keep them both loaded until an image or video model is
  // going to be loaded"). keep=true always holds warm (an explicit
  // setting); otherwise SAME GPU = unload NOW so the chat model's launch
  // that follows this return has the VRAM, DIFFERENT GPU = hold warm (no
  // idle timer — armIdle refuses cross-GPU) until core.pump() hands the
  // card to a generation job via freeForJob().
  const cEnd = cfgOf(core);
  if (!cEnd.keep) {
    if (sameGpu(core)) {
      vlog("[captioner] describes done — unloading the vision model "
        + `from ${visionDevice(core)} so the chat LLM can load`);
      stop();
    } else {
      vlog("[captioner] describes done — vision model stays warm on "
        + `${visionDevice(core)} (different GPU to the LLM) until an `
        + "image/video job needs it");
      armIdle(core);                       // cross-GPU: a deliberate no-op
    }
  } else { armIdle(core); }
  return out;
}

/* ------------------------------------------------------------------ 2.234.0
   THE DESCRIPTION FILE (Tim verbatim: "save the description in images.tmp,
   load images.tmp into rag for llm model before running the llm").

   Every successful describe APPENDS its descriptions to <app>/images.tmp
   (a JSON array of {file, desc, at}, newest last, capped at TMP_CAP
   entries so the RAG block stays small), and EVERY /api/chat call loads
   the file back into the system context BEFORE the LLM runs — the
   recall-built stack IS the llm rag (the 2.230.0 reading), so pictures
   described in an earlier turn stay in sight without re-attaching them.
   The file is machine state, not source: gitignored and excluded from the
   delivery zips, tolerant of a missing/corrupt file (an unreadable
   images.tmp is an empty one, never a dead chat). */
const TMP_CAP = 24;

function tmpPath(core) { return path.join(core.BASE, "images.tmp"); }

function tmpLoad(core) {
  try {
    const j = JSON.parse(fs.readFileSync(tmpPath(core), "utf8"));
    return Array.isArray(j) ? j.filter((e) => e && typeof e.desc === "string") : [];
  } catch { return []; }
}

function tmpSave(core, items) {
  const now = new Date().toISOString();
  const add = (items || [])
    .filter((it) => it && String(it.desc || "").trim())
    .map((it) => ({ file: String(it.file || "picture"),
                    desc: String(it.desc).trim(), at: now }));
  if (!add.length) return tmpLoad(core).length;
  const all = tmpLoad(core).concat(add).slice(-TMP_CAP);
  try { fs.writeFileSync(tmpPath(core), JSON.stringify(all, null, 2)); }
  catch (e) { vlog("[captioner] images.tmp not written: " + (e && e.message || e)); }
  return all.length;
}

/** The RAG block /api/chat folds into the system context — "" when the
 *  file is empty, else a banner + one numbered line per description
 *  (newest last), capped in characters so no amount of describing can
 *  crowd the prompt out of its own context window. */
function tmpRag(core) {
  const all = tmpLoad(core);
  if (!all.length) return "";
  const lines = all.map((e, i) => `${i + 1}) [${e.file}] ${e.desc}`);
  let block = lines.join("\n");
  while (block.length > 6000 && lines.length > 1) { lines.shift(); block = lines.join("\n"); }
  return "\n\nPICTURES ON FILE (images.tmp — the local vision model's "
    + "descriptions of pictures the user attached, oldest first; treat them "
    + "as things the user has shown you. The [file] names are for you only - "
    + "never write a file name as a tag in a prompt):\n" + block;
}

module.exports = { scan, scanReport, stop, DESCRIBE_PROMPT, logs,
                   ensure: logged("ensure", ensure),
                   describe: logged("describe", describe),
                   pairFiles, visionDirs, _cfg: cfgOf, state: () => cap,
                   status, tmpSave, tmpLoad, tmpRag, tmpPath, TMP_CAP,
                   visionDevice, sameGpu, freeForJob };

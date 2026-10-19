#!/usr/bin/env node
// lib/captioner.js + the 2.233.0 PICTURES-IN-THE-PROMPT wiring (Tim verbatim:
// "upload a picture or pictures into the prompt and have a te ... describe
// the pictures to the llm and for the llm to use the descriptions and the
// prompt to generate a response?" + the UI refinements: vision dropdown,
// + button with claude.ai-style chips, Describe Image menubar checkbox).
// Run from repo root: node scripts/test-captioner.js
"use strict";
const fs = require("fs");
const path = require("path");
const C = require(path.join(__dirname, "..", "lib", "captioner"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

// ---- the pairing rule: a model is only a vision model WITH its mmproj ----
check("a .gguf with an mmproj beside it is listed, paired — and (2.233.5) the projector and the txt list too",
  (() => {
    const p = C.pairFiles(["a.gguf", "mmproj-a.gguf", "notes.txt"]);
    const m = p.find((e) => e.model === "a.gguf");
    const mm = p.find((e) => e.model === "mmproj-a.gguf");
    return p.length === 3 && m && m.mmproj === "mmproj-a.gguf"
           && mm && mm.mmproj === "";
  })(), C.pairFiles(["a.gguf", "mmproj-a.gguf", "notes.txt"]));
check("2.233.1: mid-name mmproj is detected too — mradermacher's <stem>.mmproj-<quant>.gguf, the shape get-qwen3vl.ps1 itself downloads",
  (() => {
    const p = C.pairFiles(["Qwen3-VL-8B-NSFW-Caption-V4.Q4_K_M.gguf",
                           "Qwen3-VL-8B-NSFW-Caption-V4.mmproj-f16.gguf"]);
    const m = p.find((e) => e.model === "Qwen3-VL-8B-NSFW-Caption-V4.Q4_K_M.gguf");
    return !!m && m.mmproj === "Qwen3-VL-8B-NSFW-Caption-V4.mmproj-f16.gguf";
  })(), C.pairFiles(["Qwen3-VL-8B-NSFW-Caption-V4.Q4_K_M.gguf",
                     "Qwen3-VL-8B-NSFW-Caption-V4.mmproj-f16.gguf"]));
check("2.233.4: a model WITHOUT a projector LISTS with mmproj empty",
  (() => {
    const p = C.pairFiles(["alone.gguf"]);
    return p.length === 1 && p[0].model === "alone.gguf" && p[0].mmproj === "";
  })(), C.pairFiles(["alone.gguf"]));
check("2.233.5: ZERO content filters — ANY extension lists (.safetensors, .bin, .txt), the launch says loadability, not the scan",
  (() => {
    const p = C.pairFiles(["model.safetensors", "weights.bin", "readme.md"]);
    return p.length === 3 && p.every((e) => e.mmproj === "");
  })(), C.pairFiles(["model.safetensors", "weights.bin", "readme.md"]));
check("2.233.5: ...and a non-gguf model still pairs with a .gguf projector beside it",
  (() => {
    const p = C.pairFiles(["model.safetensors", "mmproj-f16.gguf"]);
    const m = p.find((e) => e.model === "model.safetensors");
    return !!m && m.mmproj === "mmproj-f16.gguf";
  })(), C.pairFiles(["model.safetensors", "mmproj-f16.gguf"]));
check("2.233.5: even mmproj files list (remove ALL filters, by instruction), with mmproj empty",
  (() => {
    const p = C.pairFiles(["mmproj-x.gguf"]);
    return p.length === 1 && p[0].model === "mmproj-x.gguf" && p[0].mmproj === "";
  })(), C.pairFiles(["mmproj-x.gguf"]));
check("stem-matching prefers the model's own projector over the first",
  (() => {
    const p = C.pairFiles(["Qwen3-VL-8B.Q4_K_M.gguf", "mmproj-other.gguf",
                           "mmproj-Qwen3-VL-8B.f16.gguf"]);
    const m = p.find((e) => e.model === "Qwen3-VL-8B.Q4_K_M.gguf");
    return !!m && m.mmproj === "mmproj-Qwen3-VL-8B.f16.gguf";
  })(), C.pairFiles(["Qwen3-VL-8B.Q4_K_M.gguf", "mmproj-other.gguf",
                     "mmproj-Qwen3-VL-8B.f16.gguf"]));
check("one projector per folder serves every model there (the common drop)",
  (() => {
    const p = C.pairFiles(["x.gguf", "y.gguf", "mmproj-f16.gguf"])
      .filter((e) => e.model === "x.gguf" || e.model === "y.gguf");
    return p.length === 2 && p.every((e) => e.mmproj === "mmproj-f16.gguf");
  })());
check("2.233.1: the scan covers qwen3vl/, THE LLM FOLDER'S vision/ SUBFOLDER, and the LLM folder itself, in that order",
  (() => {
    const fake = { BASE: "/app", llmPaths: () => ({ dir: "/llms" }) };
    const d = C.visionDirs(fake).map((p) => p.replace(/\\/g, "/"));
    return d.length === 3 && d[0] === "/app/qwen3vl"
           && d[1] === "/llms/vision" && d[2] === "/llms";
  })(), C.visionDirs({ BASE: "/app", llmPaths: () => ({ dir: "/llms" }) }));

// ---- 2.233.2 (Tim: "it is not populating the vision dropdown ... i
// already have the models in <llm folder>\vision"): per-model SUBFOLDERS
// list, and an empty scan diagnoses itself in words -----------------------
{
  const os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cap-scan-"));
  const vis = path.join(tmp, "llms", "vision");
  fs.mkdirSync(path.join(vis, "Qwen3-VL-8B"), { recursive: true });
  fs.writeFileSync(path.join(vis, "Qwen3-VL-8B", "Qwen3-VL-8B.Q4_K_M.gguf"), "");
  fs.writeFileSync(path.join(vis, "Qwen3-VL-8B", "Qwen3-VL-8B.mmproj-f16.gguf"), "");
  fs.writeFileSync(path.join(vis, "flat.gguf"), "");
  fs.writeFileSync(path.join(vis, "mmproj-flat.gguf"), "");
  fs.writeFileSync(path.join(tmp, "llms", "chat-only.gguf"), "");
  const core = { BASE: tmp, llmPaths: () => ({ dir: path.join(tmp, "llms") }) };
  const r = C.scanReport(core);
  const names = r.models.map((m) => m.name).sort();
  check("2.233.2: a pair in a per-model SUBFOLDER of vision/ lists (one level walked)",
    names.includes("Qwen3-VL-8B.Q4_K_M.gguf"), names);
  check("2.233.2: ...beside a flat pair in vision/ itself",
    names.includes("flat.gguf"), names);
  check("2.233.4: a projector-less .gguf in the flat LLM folder now LISTS too (tagged client-side), with mmproj empty",
    (() => {
      const e = r.models.find((m) => m.name === "chat-only.gguf");
      return !!e && e.mmproj === "";
    })(), names);
  check("2.233.2+5: the report censuses every scanned dir (exists, files, .gguf, mmproj counts)",
    r.dirs.some((d) => d.dir === vis && d.exists && d.files === 2 && d.gguf === 2 && d.mmproj === 1)
    && r.dirs.some((d) => /qwen3vl$/.test(d.dir) && d.exists === false), r.dirs);
  check("2.233.2: models found -> empty note; nothing found -> the note NAMES every folder and the beside-it rule",
    r.note === "" && (() => {
      const e = C.scanReport({ BASE: path.join(tmp, "nope"),
                               llmPaths: () => ({ dir: path.join(tmp, "also-nope") }) });
      return /^\[bitGen v[\d.]+\] no files found — scanned:/.test(e.note)
             && /\(missing\)/.test(e.note)
             && /mmproj \.gguf BESIDE a model/.test(e.note)
             && typeof e.app === "string" && e.app.length > 0
             && /get-qwen3vl\.ps1/.test(e.note);
    })());
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---- 2.233.3 (Tim verbatim: "add another input (folder picker) in
// settings-llm for vision models. the use that folder for the vision
// models list. vision dropdown under prompt") ------------------------------
{
  const os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cap-dir-"));
  fs.mkdirSync(path.join(tmp, "picked", "SubModel"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "picked", "a.gguf"), "");
  fs.writeFileSync(path.join(tmp, "picked", "a.mmproj-f16.gguf"), "");
  fs.writeFileSync(path.join(tmp, "picked", "SubModel", "b.gguf"), "");
  fs.writeFileSync(path.join(tmp, "picked", "SubModel", "b.mmproj.gguf"), "");
  fs.mkdirSync(path.join(tmp, "llms", "vision"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "llms", "vision", "elsewhere.gguf"), "");
  fs.writeFileSync(path.join(tmp, "llms", "vision", "mmproj-elsewhere.gguf"), "");
  const core = { BASE: tmp,
    getConfig: () => ({ captioner: { dir: path.join(tmp, "picked") } }),
    llmPaths: () => ({ dir: path.join(tmp, "llms") }) };
  const r = C.scanReport(core);
  const names = r.models.map((m) => m.name).sort();
  check("2.233.3+5: a Settings-picked captioner.dir IS the list — every file, flat and one-level subfolders, the automatic dirs NOT scanned beside it",
    names.length === 4 && names.includes("a.gguf") && names.includes("b.gguf")
    && names.includes("a.mmproj-f16.gguf")
    && !names.includes("elsewhere.gguf")
    && r.dirs.every((d) => !d.dir.includes(path.join("llms", "vision"))), names);
  check("2.233.3: a RELATIVE picked dir resolves against the app root (the llm.dir rule)",
    C.scanReport({ BASE: tmp, getConfig: () => ({ captioner: { dir: "picked" } }),
                   llmPaths: () => ({ dir: path.join(tmp, "llms") }) })
      .models.length === 4);
  check("2.233.6: a picked path that IS A FILE means its parent folder (Tim's sixth report verbatim: a .gguf path pasted into the folder field)",
    (() => {
      const r6 = C.scanReport({ BASE: tmp,
        getConfig: () => ({ captioner: { dir: path.join(tmp, "picked", "a.gguf") } }),
        llmPaths: () => ({ dir: path.join(tmp, "llms") }) });
      return r6.models.some((m) => m.name === "a.gguf")
             && r6.models.some((m) => m.name === "b.gguf")
             && r6.dirs[0].exists;
    })());
  check("2.233.6: Copy-as-path QUOTES and trailing slashes/spaces are stripped — a value that LOOKS right in Settings scans right",
    (() => {
      const r7 = C.scanReport({ BASE: tmp,
        getConfig: () => ({ captioner: { dir: '"' + path.join(tmp, "picked") + '\\" ' } }),
        llmPaths: () => ({ dir: path.join(tmp, "llms") }) });
      return r7.dirs[0].exists && r7.models.some((m) => m.name === "a.gguf");
    })());
  check("2.233.3: no picked dir -> the automatic three-dir scan stands (unset stays backward-compatible)",
    (() => {
      const d = C.visionDirs({ BASE: "/app", getConfig: () => ({}),
                               llmPaths: () => ({ dir: "/llms" }) })
        .map((p) => p.replace(/\\/g, "/"));
      return d.length === 3 && d[1] === "/llms/vision";
    })());
  fs.rmSync(tmp, { recursive: true, force: true });

  // the Settings wiring: markup, fill, save, both pickers, defaults
  const H2 = read("static", "index.html");
  check("2.233.3: Settings → LLM carries the Vision models folder input in stab-llm (2.326.0: the Windows-only 🗔 button is gone - the 📁 opens the cross-platform file dialog)",
    (() => {
      const tab = H2.slice(H2.indexOf('id="stab-llm"'), H2.indexOf('id="stab-llm"') + 6000);
      return tab.includes('id="s_visdir"') && !tab.includes('id="s_visdirwin"');
    })());
  check("2.233.3: fill reads captioner.dir, save posts captioner:{dir} (shallow merge keeps model/mmproj), the 📁 rides the addPick registry (2.326.0: the file dialog)",
    H2.includes('$("s_visdir").value = ((cfg.captioner || {}).dir) || ""')
    && H2.includes('captioner: { dir: $("s_visdir").value.trim() }')
    && H2.includes('["s_visdir", "dir", ""]')
    && !H2.includes('$("s_visdirwin")') && H2.includes("window.FileDialog.open({"));
  check("2.233.7: the \ud83d\udd0e Scan folder button sits under the vision input with its output line, SAVES-then-scans, and answers Tim's exact line shape",
    (() => {
      const tab = H2.slice(H2.indexOf('id="stab-llm"'), H2.indexOf('id="stab-llm"') + 8000);
      return tab.includes('id="s_visscan"') && tab.includes('id="s_visscanout"')
        && H2.includes('$("s_visscan") && ($("s_visscan").onclick')
        && H2.indexOf('captioner: { dir: $("s_visdir").value.trim() } }) });') >= 0
        && H2.includes('"scanned " + d.dir + " - " + d.files + " - files"')
        && H2.includes('"scanned " + d.dir + " - (missing)"');
    })());
  const DS = JSON.parse(read("default.settings"));
  check("2.233.3: captioner.dir ships in default.settings (the tts lesson, again)",
    typeof (DS.captioner || {}).dir === "string");
}

// ---- config shape + the one describe prompt ------------------------------
check("defaults: port 8199, keep off, 5 idle minutes",
  (() => {
    const c = C._cfg({ getConfig: () => ({}) });
    return c.port === 8199 && c.keep === false && c.idle_min === 5;
  })(), C._cfg({ getConfig: () => ({}) }));
check("2.233.4: launch without a projector WARNS and drops --mmproj; a projector-less describe failure names the fix",
  (() => {
    const L4 = read("lib", "captioner.js");
    return L4.includes("if (c.mmproj) args.push(\"--mmproj\", c.mmproj)")
           && /launching without --mmproj/.test(L4)
           && /has no mmproj beside it/.test(L4);
  })());
check("2.233.5: a non-gguf pick launches anyway with a plain log NOTE (loadability said at launch, never hidden by the scan)",
  /is not a \.gguf/.test(read("lib", "captioner.js")));
check("the describe prompt asks for a screenwriter's paragraph",
  /Describe this picture precisely for a screenwriter/.test(C.DESCRIBE_PROMPT)
  && /One tight paragraph/.test(C.DESCRIBE_PROMPT));

// ---- 2.234.0: the vision model rides the LLM's GPU -----------------------
{
  const L34 = read("lib", "captioner.js");
  check("2.234.0: the vision llama-server pins to the LLM's device (llm.device via CUDA_VISIBLE_DEVICES, -ngl 99, cpu = -ngl 0), and the device joins the launch signature",
    L34.includes('llmCfg.device || "cuda1"')
    && L34.includes('env.CUDA_VISIBLE_DEVICES = dev.replace("cuda", "")')
    && L34.includes('args.push("-ngl", "99")')
    && L34.includes('if (dev === "cpu") args.push("-ngl", "0")')
    && L34.includes("${c.port}|${dev}")
    && L34.includes("spawn(core.llmPaths().exe, args, { env,"));
}

// ---- 2.234.0: status() — the statusbar's one truth -----------------------
check("2.234.0: status() answers {running, loading, ready, model} and idles as all-false",
  (() => {
    const s = C.status();
    return s.running === false && s.loading === false && s.ready === false
      && typeof s.model === "string";
  })(), C.status());

// ---- 2.234.0: images.tmp — save, load, cap, and the RAG block ------------
{
  const os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cap-imgtmp-"));
  const core34 = { BASE: tmp };
  check("images.tmp: empty file = empty load, empty RAG (a missing/broken file never breaks the chat)",
    C.tmpLoad(core34).length === 0 && C.tmpRag(core34) === "");
  fs.writeFileSync(C.tmpPath(core34), "{not json");
  check("images.tmp: corrupt file reads as empty, tolerantly",
    C.tmpLoad(core34).length === 0);
  fs.rmSync(C.tmpPath(core34));
  const n1 = C.tmpSave(core34, [{ file: "cat.png", desc: "a cat on a mat" },
                                { file: "dog.png", desc: "a dog in fog" }]);
  check("tmpSave appends {file, desc, at} entries and answers the count",
    n1 === 2 && C.tmpLoad(core34)[0].file === "cat.png"
    && C.tmpLoad(core34)[1].desc === "a dog in fog"
    && typeof C.tmpLoad(core34)[0].at === "string");
  const rag = C.tmpRag(core34);
  check("tmpRag folds the descriptions under the PICTURES ON FILE banner with numbered [file] lines",
    /PICTURES ON FILE \(images\.tmp/.test(rag)
    && rag.includes("1) [cat.png] a cat on a mat")
    && rag.includes("2) [dog.png] a dog in fog"));
  check("blank descriptions are never saved",
    C.tmpSave(core34, [{ file: "x.png", desc: "  " }]) === 2);
  C.tmpSave(core34, Array.from({ length: 30 }, (_, i) => ({ file: `p${i}.png`, desc: `d${i}` })));
  check("the file caps at TMP_CAP entries, newest kept",
    C.tmpLoad(core34).length === C.TMP_CAP
    && C.tmpLoad(core34)[C.TMP_CAP - 1].desc === "d29");
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---- 2.235.0: a GPU of the vision model's own -----------------------------
check("2.235.0: captioner.device defaults empty (= follow the LLM's device)",
  C._cfg({ getConfig: () => ({}) }).device === "");
check("2.235.0: visionDevice = captioner.device when set, else llm.device, else cuda1",
  C.visionDevice({ getConfig: () => ({ captioner: { device: "cuda0" }, llm: { device: "cuda1" } }) }) === "cuda0"
  && C.visionDevice({ getConfig: () => ({ llm: { device: "cuda1" } }) }) === "cuda1"
  && C.visionDevice({ getConfig: () => ({}) }) === "cuda1");
check("2.235.0: sameGpu answers the policy — default/matching true, cross-GPU false",
  C.sameGpu({ getConfig: () => ({ llm: { device: "cuda1" } }) }) === true
  && C.sameGpu({ getConfig: () => ({ captioner: { device: "cuda1" }, llm: { device: "cuda1" } }) }) === true
  && C.sameGpu({ getConfig: () => ({ captioner: { device: "cuda0" }, llm: { device: "cuda1" } }) }) === false);
check("2.235.0: freeForJob with nothing running is a quiet false (the pump calls it before every model-loading job)",
  C.freeForJob("a test job is starting") === false);
check("2.258.0: the SECOND-GPU keep rule — a vision model off the render card stays warm (freeForJob declines when visionDevice !== renderGpu; the pump passes core context); only an ensure() sig change evicts it",
  (() => {
    const SRC = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "captioner.js"), "utf8");
    const CORE = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "core.js"), "utf8");
    return SRC.includes("function renderGpu(core)")
      && SRC.includes("visionDevice(core) !== renderGpu(core)")
      && SRC.includes("keeping the vision model warm")
      && CORE.includes('freeForJob(`a ${(job.params || {}).mode || "video"} job is starting`, { getConfig })');
  })());
check("2.258.0: the vision launcher DRAINS the old model's card before the new one allocates (stop -> gpuSettle(oldDev) -> spawn, device from the old sig)",
  (() => {
    const SRC = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "captioner.js"), "utf8");
    return SRC.includes('String(cap.sig).split("|").pop()')
      && SRC.includes("if (hadProc && core.gpuSettle) await core.gpuSettle(oldDev);");
  })());
{
  const L35 = read("lib", "captioner.js");
  check("2.235.0: ensure() launches on visionDevice(core) (the Settings pick, else the LLM's card)",
    L35.includes("const dev = visionDevice(core);"));
  const CORE = read("lib", "core.js");
  // 2.373.0: the karaoke overlay is ffmpeg only too - it skips with export
  check("2.235.0: core.pump frees the vision model before spawning every model-loading job (export + karaoke skip — ffmpeg only)",
    CORE.includes('!["export", "karaoke"].includes((job.params || {}).mode)')
    && CORE.includes('require("./captioner").freeForJob('));
  const H35 = read("static", "index.html");
  check("2.235.0: Settings → LLM carries the Vision GPU picker (s_visdev) with the Default-follows-LLM option, filled and saved as captioner.device",
    (() => {
      const tab = H35.slice(H35.indexOf('id="stab-llm"'), H35.indexOf('id="stab-llm"') + 9000);
      return tab.includes('id="s_visdev"')
        && H35.includes('if (sel.id === "s_visdev") opts.unshift("")')
        && H35.includes('deviceOptions($("s_visdev"), (cfg.captioner || {}).device || "")')
        && H35.includes('device: $("s_visdev").value')
        && H35.includes('Default (same as LLM)');
    })());
  const DS35 = JSON.parse(read("default.settings"));
  check("2.235.0: captioner.device ships in default.settings (the tts lesson)",
    typeof (DS35.captioner || {}).device === "string");
}

// ---- 2.237.0: "no logs to show" must never be true again ------------------
check("2.237.0: the vision log ring is LIVE — a refused ensure leaves its error in the ring AND on status().last_error, timestamped",
  (() => {
    const probe = `
      const C = require(${JSON.stringify(path.join(__dirname, "..", "lib", "captioner"))});
      C.ensure({ getConfig: () => ({}), BASE: "/tmp" }).then(
        () => { console.log("NO-THROW"); },
        () => { console.log("@@RING " + JSON.stringify({ lines: C.logs(), err: C.status().last_error })); });`;
    const out = require("child_process").execFileSync(process.execPath, ["-e", probe],
      { encoding: "utf8", timeout: 20000 });
    const ring = out.split("\n").find((l) => l.startsWith("@@RING "));
    if (!ring) return false;                 // NO-THROW or vlog-only output
    const d = JSON.parse(ring.slice(7));
    return d.lines.length > 0
      && /^\d\d:\d\d:\d\d \[captioner\] ERROR in ensure: no vision model selected/.test(d.lines[d.lines.length - 1])
      && d.err.includes("no vision model selected");
  })());
{
  const L37 = read("lib", "captioner.js");
  check("2.237.0: the vision llama-server's OWN output is piped into the ring (never stdio ignore), exit codes logged",
    L37.includes('stdio: ["ignore", "pipe", "pipe"]')
    && L37.includes('vlog("[vision-server] " + l)')
    && L37.includes("vision llama-server exited (code ${code}, signal")
    && !L37.includes('stdio: "ignore"'));
  check("2.237.0: the wait loop reports progress and READY; every describe logs its picture",
    L37.includes("still loading… ${waited}s")
    && L37.includes("vision model READY on port")
    && L37.includes("described ${f.originalname || f.path ||"));
  check("2.237.0: status() carries last_error; a success clears it (logged() wrapper on ensure + describe)",
    L37.includes('ensure: logged("ensure", ensure)')
    && L37.includes('describe: logged("describe", describe)')
    && L37.includes('cap.last_error = ""; return r;'));
  const R37 = read("routes", "index.js");
  check("2.237.0: GET /api/captioner/logs serves the ring + status",
    R37.includes('app.get("/api/captioner/logs"')
    && R37.includes("captioner.logs()"));
  const CH = read("ext", "consoledock", "dock.html");
  check("2.237.0: the Console dock carries the Job/🖼 Vision toggle, the ⧉ Copy button, and selectable text",
    CH.includes('id="conSrc"') && CH.includes('data-consrc="vision"')
    && CH.includes('id="conCopy"') && CH.includes('id="vlog"')
    && CH.includes("user-select:text"));
  const CJ = read("ext", "consoledock", "consoledock.js");
  check("2.237.0: the Vision view polls /api/captioner/logs ONLY while visible, follows the tail, and Copy copies the visible log",
    CJ.includes('fetch("/api/captioner/logs")')
    && CJ.includes("clearInterval(conTimer)")
    && CJ.includes("navigator.clipboard.writeText")
    && CJ.includes("v.scrollTop = v.scrollHeight"));
  check("2.237.0: consoledock's script is registered in its ext.json",
    JSON.parse(read("ext", "consoledock", "ext.json")).scripts.includes("consoledock.js"));
  const P37 = read("ext", "promptdock", "promptdock.js");
  check("2.237.0: a failed describe names itself in the statusbar and points at the Console",
    P37.includes("Vision: failed — see Console"));
}

// ---- refusals in words (nothing spawned when the pieces are missing) -----
async function refusal(cfg) {
  try { await C.ensure({ getConfig: () => cfg, BASE: path.join(__dirname, ".."),
                         llmPaths: () => ({ dir: "/nowhere", eng: "/nowhere",
                                            exe: "/nowhere/llama-server" }) }); }
  catch (e) { return String(e.message || e); }
  return "";
}
(async () => {
  let m = await refusal({ captioner: {} });
  check("no selection: the refusal names the Vision dropdown AND get-qwen3vl.ps1",
    /Vision dropdown/.test(m) && /run get-qwen3vl\.ps1/.test(m), m);
  m = await refusal({ captioner: { model: "/x/a.gguf", mmproj: "/x/mm.gguf" } });
  check("no llama-server binary: the refusal names get-llama.ps1",
    /get-llama\.ps1/.test(m), m);

  // ---- lib source pins: --mmproj on the launch, own port, idle stop ------
  const L = read("lib", "captioner.js");
  check("the second llama-server launches WITH --mmproj on the captioner's own port",
    L.includes('"--mmproj", c.mmproj') && L.includes('"--port", String(c.port)'));
  check("VRAM courtesy 2.235.0: after-batch policy — same GPU unloads for the LLM, different GPU holds warm; the idle timer is same-GPU-only",
    /describes done — unloading the vision model/.test(L)
    && /stays warm on/.test(L)
    && L.includes("if (!sameGpu(core)) return;")
    && L.includes("c.idle_min * 60000")
    && /captioner\.keep holds it warm/.test(L));
  check("describe() posts base64 image_url parts + the describe prompt per picture (2.335.0: or the picture's OWN question + budget)",
    L.includes('type: "image_url"') && L.includes("base64")
    && L.includes("text: f.prompt ? String(f.prompt) : DESCRIBE_PROMPT")
    && L.includes("parseInt(f.max_tokens, 10) || 400"));

  // ---- route pins: multipart chat, the fold, the recall note, failure words
  const R = read("routes", "index.js");
  check("/api/chat takes multipart via the shared multer (JSON callers untouched)",
    // 2.354.0: fields - the attached pictures + the reference dock's (ref_images)
    R.includes('app.post("/api/chat", upload.fields([{ name: "images", maxCount: 9 }, { name: "ref_images", maxCount: 9 }])'));
  check("multipart context strings parse back to the object shape",
    R.includes('typeof b.context === "string"'));
  check("describe ON: descriptions fold into the system context under the attached-pictures banner",
    R.includes("THE ATTACHED PICTURES (described by the local ")
    && R.includes("+ visionNote }]"));
  check("...AND land in the stored chat as a bracketed user-side note (recall sees them forever)",
    R.includes(", described by the local vision model: "));
  check("captioner failure falls back IN WORDS — never a dead chat",
    R.includes("picture(s) attached but not described — ")
    && R.includes("the vision model is not installed - run get-qwen3vl.ps1"));
  check("describe OFF: the plain not-described note, captioner never started",
    R.includes(" picture(s) attached, not described"));
  check("non-picture uploads are refused in words, png/jpg/webp pass",
    R.includes("only png/jpg/webp pictures can ride the prompt")
    && R.includes("/^image\\/(png|jpe?g|webp)$/i"));
  check("the pictures store as files under the chat's attachments/",
    R.includes('path.join(dir, "attachments")'));
  check("the dropdown's catalogue endpoint exists and answers the FULL report (2.233.2)",
    R.includes('app.get("/api/captioner/models"')
    && R.includes("captioner.scanReport(core)"));
  check("captioner is on the /api/config allow-list (the tts lesson)",
    /"ui", "captioner"\]/.test(R));
  check("2.234.0: describe success SAVES the descriptions into images.tmp (tmpSave with the stored filenames)",
    R.includes("captioner.tmpSave(core, descs.map((d, i)") 
    && R.includes("saved[i] || (images[i] && images[i].originalname)"));
  check("2.234.0: EVERY chat call loads images.tmp into the system context BEFORE the LLM runs (the rag), tolerantly",
    R.includes("tmpRag = captioner.tmpRag(core)")
    && R.includes('+ tmpRag\n        + refBlock\n        + (songAsk ? songwriter.FORMAT_NOTE : "")\n        + visionNote }]'));   // 2.354.0: + the reference dock
  check("2.234.0: GET /api/captioner/status answers the statusbar's poll",
    R.includes('app.get("/api/captioner/status"')
    && R.includes("captioner.status()"));
  check("2.234.0: the core statusbar carries the hidden #sbvis span (markup only — the feature lives in promptdock, the hybrid ruling)",
    (() => {
      const H34 = read("static", "index.html");
      const sb = H34.slice(H34.indexOf('<div id="statusbar">'), H34.indexOf('<div id="statusbar">') + 2000);
      return sb.includes('id="sbvis"') && /id="sbvis" class="hidden"/.test(sb);
    })());

  // ---- the hybrid seam: core chatSend consults window.pdChatForm ---------
  const H = read("static", "index.html");
  check("core chatSend consults the promptdock seam and posts the FormData when it answers",
    H.includes("window.pdChatForm") && H.includes("body: pdForm"));
  check("...and stays the JSON call it always was without the extension",
    H.includes("JSON.stringify({ text: t, llm_file: chatLlm, context: chatCtx })"));

  // ---- the extension's own wiring (source pins; DOM legs live in sceneui) -
  const P = read("ext", "promptdock", "promptdock.js");
  check("chips: add, hover-\u2715 remove, and clear when the message sends",
    P.includes("pdFiles.splice(i, 1)") && P.includes("chip.onmouseenter")
    && /the chips clear when the message sends/.test(P));
  check("drag-drop onto the composer adds pictures too",
    P.includes('addEventListener("drop"') && P.includes("e.dataTransfer.files"));
  check("2.233.8: the describe checkbox persists via the SELF-CONTAINED pref helper (never core's store at load — the TDZ crash), and rides the form",
    P.includes('pref.get("pdDescribe", "1")')
    && !/[^.\w]store\./.test(P.replace(/\/\*[\s\S]*?\*\//g, ""))
    && P.includes('fd.append("describe"'));
  check("the vision selection SAVES as config captioner.model/mmproj",
    P.includes("captioner: { model: sel.value") && P.includes("dataset.mmproj"));
  check("an empty scan says what to run, and the server's why-note rides the tooltip + console (2.233.2)",
    P.includes("(no vision models - run get-qwen3vl.ps1)")
    && P.includes("sel.title = note")
    && P.includes('console.log("[vision] " + note)')
    && P.includes('server v'));
  check("2.234.0: promptdock watches /api/captioner/status from pdChatForm (describe on) and paints 'loading vision model' into #sbvis, deferred-only, no-op without the span",
    P.includes('fetch("/api/captioner/status")')
    && P.includes("loading vision model…")
    && P.includes('$("sbvis")')
    && P.includes("pdVisionWatch()")
    && /if \(!\$\("pdDescribe"\) \|\| \$\("pdDescribe"\)\.checked\) pdVisionWatch\(\);/.test(P));
  const E = JSON.parse(read("ext", "promptdock", "ext.json"));
  check("promptdock declares its own script (the hybrid contract: seam in core, feature in ext)",
    Array.isArray(E.scripts) && E.scripts.includes("promptdock.js"));

  // ---- the installer -------------------------------------------------------
  const G = read("get-qwen3vl.ps1");
  check("get-qwen3vl.ps1: pinned Q4_K_M default, model AND mandatory mmproj, ~6 GB truth",
    /\$Quant\s*=\s*"Q4_K_M"/.test(G) && /mmproj/i.test(G)
    && /MANDATORY/.test(G) && /6 GB/.test(G));
  check("...says the NSFW gate + -Token path, never embeds credentials",
    /NSFW GATE/.test(G) && /-Token/.test(G) && /NEVER embedded/i.test(G));
  check("...EAP=Continue with explicit failure checks (the 2.222.1 lesson)",
    G.includes('$ErrorActionPreference = "Continue"')
    && !/\$ErrorActionPreference\s*=\s*"Stop"/.test(G));
  check("...no venv, rides the existing llama.cpp binaries",
    /NO venv/i.test(G) && /get-llama\.ps1/.test(G));

  // ---- 2.233.8 EXECUTED regression: promptdock.js must survive and PAINT
  // in a page WITHOUT core's inline script (ext tags emit first — the TDZ
  // crash that kept the dropdown on its placeholder through seven reports)
  await new Promise((done) => {
    const { JSDOM } = require("jsdom");
    const dom = new JSDOM('<div class="pleft"><div id="pdChips" class="hidden"></div>'
      + '<textarea id="prompt"></textarea></div><select id="visionSel"></select>'
      + '<input type="checkbox" id="pdDescribe" checked>',
      { url: "http://localhost/", runScripts: "outside-only" });
    dom.window.fetch = (u) => Promise.resolve({ json: () => Promise.resolve(
      String(u).includes("captioner")
        ? { app: "t", models: [{ name: "m.gguf", model: "/x/m.gguf", mmproj: "" }] }
        : { captioner: {} }) });
    let threw = false;
    try { dom.window.eval(fs.readFileSync(path.join(__dirname, "..", "ext", "promptdock", "promptdock.js"), "utf8")); }
    catch { threw = true; }
    setTimeout(() => {
      const sel = dom.window.document.getElementById("visionSel");
      check("2.233.8: promptdock.js runs WITHOUT core's store in scope — no throw, the dropdown PAINTS, the seam wires",
        !threw && sel.options.length === 1
        && /\(no mmproj\)/.test(sel.options[0].textContent)
        && typeof dom.window.pdChatForm === "function",
        { threw, options: sel.options.length });
      console.log(fail ? `${fail} FAILED` : "ALL PASS");
      process.exit(fail ? 1 : 0);
    }, 80);
  });
})();

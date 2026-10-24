// bitGen Studio — lib/cadGen.js (2.581.0): ✨ GENERATE IN THE 📐 SOLIDCRAFT DOCKER - a description or a picture -> a part
// (CadQuery code, run by cad_worker.py in its own venv) -> SolidCraft's own editable features (sketches + extrudes +
// fillets), or the STEP when a step cannot be rebuilt.
// Tim: "are there any models that we can use to generate sketches and models for solidcraft?" -> "yes, please build your
// suggestion": cadrille (text / picture -> CadQuery) first, the local LLM as the fallback.
//
//   THE ADD-ON (Settings ▸ Add-ons ▸ CAD generate, lib/addons.js): <install>/cadgen/
//     .venv            its own Python environment: CadQuery (the runner - always) + PyTorch / transformers (cadrille)
//     hf/              Hugging Face's cache (HF_HOME) - cadrille's weights (maksimko123/cadrille, CC BY-NC 4.0) + the
//                      Qwen2-VL processor files; downloaded on the install, never shipped
//     runner.ok / cadrille.ok   what the install finished
//   THE ENGINES     cadrille (text or a picture; an NVIDIA GPU is best) | llm (the app's local LLM writes CadQuery from a
//                   description - a picture is described first by the vision model) | auto (cadrille when installed)
//                   Code that fails to run goes back to the LLM with the error, up to REPAIRS times.
//   THE FILES       projects/<p>/solidcraft/<name>.step + <name>.obj (the docker's files) and solidcraft/ai/<name>.py +
//                   <name>.json (the code + what the worker answered)
//
//   status()                           {runner, cadrille, llm, python, dir, note}
//   start({prompt, image, engine, name, code})  -> {ok, id} - one job at a time; `code` = run that code (✎ edited)
//   job(id) -> {id, state: running | done | error, stage, lines[], engine, code, result, error, name}
//   install(log, picks) / remove(log)  the add-on (items: runner, cadrille)
// Pure (scripts/test-cadgen581.js): extractCode, cadPrompt, repairPrompt, slug, parseLines, ITEMS.
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");

const IS_WIN = process.platform === "win32";
const REPAIRS = 2;
const CADRILLE = "maksimko123/cadrille";
const PROCESSOR = "Qwen/Qwen2-VL-2B-Instruct";
let BASE = null;
function setBase(b) { BASE = b; }
const dir = () => path.join(BASE || core.BASE, "cadgen");
const venv = () => path.join(dir(), ".venv");
const venvPy = () => path.join(venv(), IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python");
const worker = () => path.join(BASE || core.BASE, "misc", "cad_worker.py");   // 2.591.0: misc/

const ITEMS = [
  { id: "runner", label: "CadQuery (runs the part's code - needed)", size: "about 400 MB", required: true },
  { id: "cadrille", label: "cadrille (text / picture -> CAD, 2B; CC BY-NC 4.0 - non-commercial)", size: "about 3 GB PyTorch + 4.5 GB model; an NVIDIA GPU (8 GB) is best" },
];

/* ---------------- pure */
/** an LLM answer -> the Python in it (the last ``` block that builds with cadquery, else from `import cadquery`) */
function extractCode(text) {
  const t = String(text || "");
  const blocks = []; const re = /```(?:python|py)?[ \t]*\r?\n([\s\S]*?)```/g; let m;
  while ((m = re.exec(t))) blocks.push(m[1]);
  if (blocks.length) { const cq = blocks.filter((b) => /cadquery|Workplane/.test(b)); return (cq.length ? cq : blocks).pop().trim() + "\n"; }
  const i = t.indexOf("import cadquery");
  return (i >= 0 ? t.slice(i) : t).trim() + "\n";
}
const SYSTEM = [
  "You write CadQuery (Python) code for ONE mechanical part. Units are millimetres, Z is up.",
  "Rules:",
  "- Start with `import cadquery as cq` (math may also be imported). No other imports, no files, no printing, no functions you do not need.",
  "- Build the part from sketches that are extruded, plus boxes, cylinders, spheres, holes, unions, cuts, fillets and chamfers -",
  "  these become editable features in the CAD program. Avoid revolve, loft, sweep, shell, text and mirror when an extrude does it.",
  "- Put the finished part in a variable named `result` (a cq.Workplane).",
  "- Keep every size a plain number in mm. Make it a real, manufacturable part with sensible proportions.",
  "- Answer with ONLY the code in one ```python block.",
  "",
  "Example - a 60 x 40 x 6 mm mounting plate with four 4.5 mm holes 8 mm from the edges, rounded vertical corners and a 20 mm boss:",
  "```python",
  "import cadquery as cq",
  "result = (cq.Workplane(\"XY\").box(60, 40, 6, centered=(True, True, False))",
  "          .edges(\"|Z\").fillet(4)",
  "          .faces(\">Z\").workplane().rect(44, 24, forConstruction=True).vertices().hole(4.5)",
  "          .faces(\">Z\").workplane().circle(10).extrude(12)",
  "          .faces(\">Z\").workplane().hole(8))",
  "```",
  "Example - an L bracket from a sketch:",
  "```python",
  "import cadquery as cq",
  "result = (cq.Workplane(\"XZ\").polyline([(0, 0), (50, 0), (50, 5), (5, 5), (5, 40), (0, 40)]).close()",
  "          .extrude(-30))",
  "```",
].join("\n");
/** the messages that ask the LLM for a part (pure) */
function cadPrompt(prompt, pictureDesc) {
  const want = String(prompt || "").trim();
  const pic = String(pictureDesc || "").trim();
  return [{ role: "system", content: SYSTEM },
          { role: "user", content: (pic ? "A picture of the part shows: " + pic + "\n" : "") + "Make this part: " + (want || "the part in the picture") }];
}
/** the messages that send failing code back (pure) */
function repairPrompt(prompt, code, error) {
  return [{ role: "system", content: SYSTEM },
          { role: "user", content: "Make this part: " + String(prompt || "the part") },
          { role: "assistant", content: "```python\n" + String(code || "").trim() + "\n```" },
          { role: "user", content: "That code failed: " + String(error || "").slice(0, 800) + "\nFix it. Answer with ONLY the whole corrected code in one ```python block." }];
}
/** a part name -> a safe file stem (pure) */
function slug(s) {
  const t = String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return t || "part";
}
/** the worker's output lines -> {code, result} (pure) */
function parseLines(lines) {
  let code = null, result = null;
  for (const l of lines || []) {
    const s = String(l);
    if (s.startsWith("CADCODE ")) { try { code = JSON.parse(s.slice(8)); } catch { /* not ours */ } }
    else if (s.startsWith("CADRESULT ")) { try { result = JSON.parse(s.slice(10)); } catch { /* not ours */ } }
  }
  return { code, result };
}

/* ---------------- status */
function status() {
  const py = venvPy(), hasPy = fs.existsSync(py);
  const runner = hasPy && fs.existsSync(path.join(dir(), "runner.ok"));
  const cadrille = runner && fs.existsSync(path.join(dir(), "cadrille.ok"));
  // the local LLM is the app's own (Settings ▸ LLM) - whether it answers shows on the first ✨ Generate
  return { runner, cadrille, llm: true, python: hasPy ? py : "", dir: dir(),
           note: !runner ? "not installed - Settings ▸ Add-ons ▸ CAD generate" : cadrille ? "CadQuery + cadrille" : "CadQuery (the local LLM writes the code - add cadrille in Settings ▸ Add-ons)" };
}

/* ---------------- the jobs */
const JOBS = new Map();
let running = null;
const wenv = () => Object.assign({}, process.env, { PYTHONUTF8: "1", PYTHONUNBUFFERED: "1", HF_HOME: path.join(dir(), "hf"),
  HF_HUB_DISABLE_TELEMETRY: "1" });
let deps = null;          // tests: {run, complete, describe}
function setDeps(d) { deps = d; }
const D = () => deps || {
  run: (args, log, timeout) => X.run(venvPy(), [worker()].concat(args), { log, env: wenv(), cwd: BASE || core.BASE, timeout }),
  complete: (messages) => require("./llmChat").complete(core, { messages, temperature: 0.2, max_tokens: 1800 }),
  describe: async (abs) => {
    const got = await require("./captioner").describe(core, [{ path: abs, mimetype: /\.jpe?g$/i.test(abs) ? "image/jpeg" : /\.webp$/i.test(abs) ? "image/webp" : "image/png",
      prompt: "Describe this mechanical part for a CAD designer: its overall shape, the features (holes, slots, bosses, ribs, fillets), how they are arranged, and the likely sizes in millimetres. No background, no colours.", max_tokens: 400 }]);
    return String((got || [])[0] || "").trim();
  },
};

function outDirs() {
  const sc = core.pDir("solidcraft");
  const ai = path.join(sc, "ai");
  fs.mkdirSync(ai, { recursive: true });
  return { sc, ai };
}
function uniqueName(sc, stem) {
  let n = stem, i = 2;
  while (fs.existsSync(path.join(sc, n + ".step"))) n = stem + "_" + i++;
  return n;
}

function start(opts) {
  const o = opts || {};
  if (running && JOBS.get(running) && JOBS.get(running).state === "running") return { error: "a part is already being generated - one at a time" };
  const st = status();
  if (!st.runner && !deps) return { error: "CAD generate is not installed - Settings ▸ Add-ons ▸ CAD generate (CadQuery runs the part's code)" };
  const prompt = String(o.prompt || "").trim().slice(0, 4000);
  const code0 = o.code != null ? String(o.code) : "";
  let image = "";
  if (o.image) {
    image = String(o.image);
    if (!path.isAbsolute(image) || !fs.existsSync(image)) return { error: "the picture is not there: " + image };
  }
  if (!prompt && !image && !code0.trim()) return { error: "describe the part, or give a picture" };
  let engine = String(o.engine || "auto");
  const auto = engine === "auto";
  if (engine === "auto") engine = st.cadrille ? "cadrille" : "llm";
  if (engine === "cadrille" && !st.cadrille && !deps) return { error: "cadrille is not installed - Settings ▸ Add-ons ▸ CAD generate ▸ tick cadrille (or pick the local LLM)" };
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { sc, ai } = outDirs();
  const name = uniqueName(sc, slug(o.name || prompt.split(/[.,\n]/)[0] || (image ? path.basename(image).replace(/\.[^.]+$/, "") : "part")));
  const J = { id, state: "running", stage: "starting", lines: [], engine: code0.trim() ? "code" : engine, auto, code: code0, result: null, error: "", name, started: Date.now() };
  JOBS.set(id, J); running = id;
  if (JOBS.size > 20) JOBS.delete(JOBS.keys().next().value);
  const log = (l) => { J.lines.push(String(l)); if (J.lines.length > 400) J.lines.splice(0, J.lines.length - 400); };
  (async () => {
    try { await work(J, { prompt, image, sc, ai, log }); }
    catch (e) { J.state = "error"; J.error = String((e && e.message) || e); }
    if (J.state === "running") J.state = J.error ? "error" : "done";
    J.finished = Date.now();
  })();
  return { ok: true, id, name, engine: J.engine };
}

async function runCode(J, code, sc, ai, log) {
  const py = path.join(ai, J.name + ".py");
  fs.writeFileSync(py, code);
  const lines = [];
  J.stage = "running the code";
  await D().run(["run", "--code", py, "--out", sc, "--name", J.name], (l, err) => { lines.push(l); if (!/^CADRESULT /.test(l)) log((err ? "! " : "") + l); }, 10 * 60000);
  return parseLines(lines).result || { ok: false, error: "the CAD worker said nothing (" + (lines.slice(-1)[0] || "no output") + ")", stage: "run" };
}

async function work(J, c) {
  const { prompt, image, sc, ai, log } = c;
  let code = J.code, result = null;
  if (!code.trim() && J.engine === "cadrille") {
    J.stage = "cadrille is writing the part (the first run loads the model)";
    log("[..] cadrille: " + (image ? "the picture" + (prompt ? " + the description" : "") : "the description"));
    const lines = [];
    const args = ["cadrille", "--out", sc, "--name", J.name];
    // cadrille takes a description OR a picture (its picture prompt is fixed: "Generate cadquery code")
    if (image) args.push("--image", image); else args.push("--text", prompt);
    await D().run(args, (l, err) => { lines.push(l); if (!/^CAD(CODE|RESULT) /.test(l)) log((err ? "! " : "") + l); }, 30 * 60000);
    const p = parseLines(lines);
    code = p.code || (p.result && p.result.code) || "";
    result = p.result;
    if (result && result.stage === "model") {
      // Auto: cadrille could not run (no GPU memory, a failed download …) - the local LLM writes the part instead
      if (!J.auto) { J.error = result.error; J.state = "error"; return; }
      log("! " + result.error + " - the local LLM writes the part instead");
      J.engine = "llm"; code = ""; result = null;
    }
  }
  if (!code.trim() && J.engine === "llm") {
    let pic = "";
    if (image) {
      J.stage = "the vision model describes the picture";
      try { pic = await D().describe(image); log("[ok] the picture: " + pic.slice(0, 300)); }
      catch (e) { log("! the picture could not be described: " + String((e && e.message) || e).slice(0, 200)); }
      if (!pic && !prompt) { J.error = "the picture could not be described (the vision model) - describe the part in words, or install cadrille"; J.state = "error"; return; }
    }
    J.stage = "the LLM writes the part's code";
    const out = await D().complete(cadPrompt(prompt, pic));
    if (!out || !out.ok) { J.error = "the LLM: " + ((out && out.error) || "no answer"); J.state = "error"; return; }
    code = extractCode(out.text);
  }
  J.code = code;
  if (!result) result = await runCode(J, code, sc, ai, log);
  for (let i = 0; i < REPAIRS && result && !result.ok && result.stage !== "model" && J.engine !== "code"; i++) {
    log("! " + result.error + (result.where ? " (" + result.where + ")" : "") + " - the LLM fixes it (" + (i + 1) + "/" + REPAIRS + ")");
    J.stage = "the LLM fixes the code (" + (i + 1) + "/" + REPAIRS + ")";
    const out = await D().complete(repairPrompt(prompt || "the part in the picture", code, result.error + (result.where ? " at " + result.where : "")));
    if (!out || !out.ok) break;
    code = extractCode(out.text); J.code = code;
    result = await runCode(J, code, sc, ai, log);
  }
  J.result = result;
  try { fs.writeFileSync(path.join(ai, J.name + ".json"), JSON.stringify({ engine: J.engine, prompt, image, result }, null, 2)); } catch { /* the code is what counts */ }
  if (!result || !result.ok) { J.error = (result && result.error) || "the part's code did not run"; J.state = "error"; return; }
  J.stage = "done";
  log("[ok] " + J.name + ".step - " + Math.round(result.volume) + " mm³" + (result.editable ? ", " + result.features + " editable features" : " (one solid: " + (result.reason || "not rebuilt as features") + ")"));
}

function job(id) {
  const J = JOBS.get(String(id || "")) || (id ? null : JOBS.get(running));
  if (!J) return null;
  return { id: J.id, state: J.state, stage: J.stage, lines: J.lines.slice(-60), engine: J.engine, code: J.code, result: J.result, error: J.error, name: J.name };
}

/* ---------------- the add-on */
async function install(log, picks) {
  const want = new Set(["runner"].concat(Array.isArray(picks) ? picks : []));
  const SR = require("./setupRun");
  const py = SR.appPython(), env = Object.assign(SR.env(), { PYTHONUTF8: "1" });
  if (!py) return { ok: false, error: "no Python found - the app's setup installs one (Settings ▸ General ▸ Setup)" };
  fs.mkdirSync(dir(), { recursive: true });
  if (!fs.existsSync(venvPy())) {
    log("[..] its own Python environment: " + venv(), false);
    if (await X.run(py, ["-m", "venv", venv()], { log, env }) !== 0 || !fs.existsSync(venvPy())) return { ok: false, error: "could not make the venv " + venv() };
  }
  const pip = (args, t) => X.run(venvPy(), ["-m", "pip", "install", "--progress-bar", "off"].concat(args), { log, env, timeout: (t || 30) * 60000 });
  await pip(["--upgrade", "pip"], 10);
  log("[..] CadQuery (the part's code runs with it)", false);
  if (await pip(["cadquery"], 40) !== 0) return { ok: false, error: "CadQuery would not install - see the log (it needs Python 3.9 - 3.13)" };
  fs.writeFileSync(path.join(dir(), "runner.ok"), new Date().toISOString());
  log("[ok] CadQuery", false);
  if (want.has("cadrille")) {
    let gpu = {}; try { gpu = require("./setupGpu").detect(); } catch { gpu = {}; }
    const idx = require("./addons").torchIndexes(gpu);
    let ok = false;
    for (const i of idx.length ? idx : ["cpu"]) {
      log(`[..] PyTorch (${i} wheels, ~3 GB)`, false);
      // torchvision too: qwen-vl-utils (cadrille's picture input) imports it - from the same index as torch
      if (await pip(["torch", "torchvision", "--index-url", "https://download.pytorch.org/whl/" + i], 60) === 0) { ok = true; break; }
    }
    if (!ok) return { ok: false, error: "PyTorch would not install - see the log" };
    if (await pip(["transformers>=4.45,<5", "accelerate", "pillow", "huggingface_hub", "qwen-vl-utils"], 30) !== 0) return { ok: false, error: "transformers would not install - see the log" };
    log(`[..] cadrille's weights (${CADRILLE}, ~4.5 GB, CC BY-NC 4.0) + the ${PROCESSOR} processor`, false);
    const dl = "from huggingface_hub import snapshot_download as s; s('" + CADRILLE + "'); s('" + PROCESSOR + "', allow_patterns=['*.json','*.txt','*.model','merges.txt','vocab.json'])";
    if (await X.run(venvPy(), ["-c", dl], { log, env: wenv(), timeout: 120 * 60000 }) !== 0) return { ok: false, error: "the cadrille download did not finish - Install again to resume" };
    fs.writeFileSync(path.join(dir(), "cadrille.ok"), new Date().toISOString());
    log("[ok] cadrille - ✨ Generate in the 📐 SolidCraft docker uses it (Auto)", false);
  }
  return { ok: true };
}
async function remove(log) {
  log("[..] removing " + dir(), false);
  const ok = require("./setupPacks").safeRm(dir(), log);
  return ok ? { ok: true } : { ok: false, error: "could not remove " + dir() + " - close anything using it" };
}
function addonStatus() {
  const s = status();
  return { installed: s.runner, note: s.note, items: ITEMS.map((i) => ({ id: i.id, label: i.label, size: i.size, need: !!i.required, dflt: true,
    for: i.id === "runner" ? "runs the code every engine writes, and turns it into SolidCraft features" : "writes the part from a description or a picture - the engine Auto picks when it is here",
    present: i.id === "runner" ? s.runner : s.cadrille })) };
}

module.exports = { ITEMS, SYSTEM, REPAIRS, extractCode, cadPrompt, repairPrompt, slug, parseLines, status, addonStatus, start, job, install, remove, setBase, setDeps, dir, venvPy };

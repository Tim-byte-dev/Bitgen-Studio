// lib/blendSkills.js — 2.855.0 🟧 Blender skills (Tim: "after that do the blender skills" - github.com/EL4CTEO/blender-skills,
// MIT, vendored in blender/skills/). Two things:
//   ✨ Model with AI - the ask is routed to ONE skill sheet (keywords, else the words of each sheet's description); the LLM is
//      given blender-core + that sheet + bitGen's rules and writes ONE bpy script, shown to the user before it runs. check()
//      refuses anything but bpy / bmesh / mathutils / math / random … (no files, no network, no programs, no eval / exec);
//      scripts/blend_skill_run.py runs it headless in the user's Blender ON A COPY (the scene opened, saved as a NEW .blend,
//      never the original) with the same refusals at run time (a safe __import__, no open / eval / exec), a Workbench
//      preview rendered; an error goes back to the LLM with the traceback (3 tries in all, each fix checked again);
//      then the skills' qa_check gives its warnings. The result opens as a Blender layer.
//   🧰 Blender tools - the skills' own scripts (run(**kw) -> @@JSON@@) on a copy: LODs, UV pack, bake maps, export to
//      Unreal / Unity / Godot, toon, time of day, weather, turntable, QA - TOOLS says which arguments each takes.
// Blender 5.2 or newer (the skills' own rule): need() says what was found; the page shows a Download / Cancel box.
"use strict";
const fs = require("fs"), path = require("path"), { execFile } = require("child_process");
const ROOT = path.join(__dirname, "..", "blender", "skills");
const RUNNER = path.join(__dirname, "..", "scripts", "blend_skill_run.py");
const MIN = [5, 2];
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
let completeFn = null, runFn = null, dirFn = null, exeFn = null;
function setComplete(f) { completeFn = f; }      // tests
function setRun(f) { runFn = f; }                // tests: (exe, args) -> {code, out, err}
function setDir(f) { dirFn = f; }                // tests: () -> the project's blender folder
function setExe(f) { exeFn = f; }                // tests: () -> {exe, version}
const llm = (o) => completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o);
const blendDir = () => dirFn ? dirFn() : require("./blendView").dir();

/* ---------------- the skill sheets ---------------- */
function front(md) { const m = /^---\n([\s\S]*?)\n---\n?/.exec(md); const o = {}; if (m) for (const l of m[1].split("\n")) { const k = /^(\w[\w-]*):\s*(.*)$/.exec(l); if (k) o[k[1]] = k[2].replace(/^["']|["']$/g, ""); } return { meta: o, body: m ? md.slice(m[0].length) : md }; }
let cache = null;
function skills() {
  if (cache) return cache;
  const out = [];
  for (const d of fs.existsSync(ROOT) ? fs.readdirSync(ROOT).sort() : []) {
    const f = path.join(ROOT, d, "SKILL.md"); if (!fs.existsSync(f)) continue;
    const { meta } = front(fs.readFileSync(f, "utf8"));
    const sd = path.join(ROOT, d, "scripts");
    out.push({ name: meta.name || d, description: meta.description || "", scripts: fs.existsSync(sd) ? fs.readdirSync(sd).filter((x) => /\.py$/.test(x) && x[0] !== "_").sort() : [] });
  }
  return (cache = out);
}
/** a sheet's text (no front matter), at most max characters - whole sections kept */
function sheet(name, max) {
  const f = path.join(ROOT, String(name).replace(/[^\w-]/g, ""), "SKILL.md"); if (!fs.existsSync(f)) throw bad("no skill " + name, 404);
  let b = front(fs.readFileSync(f, "utf8")).body.trim(); const lim = max || 7000;
  if (b.length > lim) { const cut = b.lastIndexOf("\n## ", lim); b = b.slice(0, cut > lim / 2 ? cut : lim).trim() + "\n…"; }
  return b;
}
const KEYS = [
  [/\b(sculpt\w*|clay|organic|creature|character bust)\b/i, "blender-sculpting"],
  [/\b(rig\w*|armature|bones?|skin weights?|weight paint)\b/i, "blender-character-rigging"],
  [/\b(shape ?keys?|blend ?shapes?|visemes?|facial)\b/i, "blender-facial-shapekeys"],
  [/\b(animat\w*|keyframes?|walk ?cycle|loop(ing)? motion)\b/i, "blender-animation"],
  [/\b(geometry nodes|procedural\w*|scatter\w*|instances?)\b/i, "blender-geometry-nodes"],
  [/\b(terrain|landscape|rocks?|forest|trees?|cliffs?|modular kit)\b/i, "blender-environment-kits"],
  [/\b(hair|fur|groom\w*)\b/i, "blender-hair-grooming"],
  [/\b(cloth\w*|garments?|shirt|dress|jacket)\b/i, "blender-clothing"],
  [/\b(materials?|pbr|textures?|metal(lic)?|roughness)\b/i, "blender-pbr-materials"],
  [/\b(toon|cel|anime|npr|outline)\b/i, "blender-stylized-npr"],
  [/\b(rain|snow|storm|lightning|puddles?|weather)\b/i, "blender-weather-fx"],
  [/\b(sunset|sunrise|night|golden hour|fog|time of day|moon\w*)\b/i, "blender-time-of-day"],
  [/\b(light\w*|studio|hdri|turntable|lookdev)\b/i, "blender-lighting-lookdev"],
  [/\b(smoke|fire|fluid|rigid ?body|particles?|simulat\w*)\b/i, "blender-simulation"],
  [/\b(uvs?|unwrap\w*|retopo\w*)\b/i, "blender-retopology-uv"],
];
/** the skill for an ask: a keyword rule, else the most words shared with a sheet's description, else hard-surface modelling */
function route(ask) {
  const a = String(ask || "");
  for (const [re, s] of KEYS) if (re.test(a)) return s;
  const words = new Set(a.toLowerCase().match(/[a-z]{4,}/g) || []); let best = null, n = 0;
  for (const s of skills()) { if (s.name === "blender-core") continue; const k = (s.description.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => words.has(w)).length; if (k > n) { n = k; best = s.name; } }
  return n >= 2 ? best : "blender-hardsurface-modeling";
}

/* ---------------- the script: rules, the LLM, the check ---------------- */
const ALLOW = new Set(["bpy", "bmesh", "mathutils", "math", "random", "colorsys", "itertools", "functools", "collections", "statistics", "bpy_extras"]);
const RULES = `You write ONE Python script for Blender 5.2 or newer (bpy), run headless (no UI) by bitGen Studio. The scene the user has is already open (or an empty scene).
Rules - the script is refused otherwise:
- import ONLY bpy, bmesh, mathutils, math, random, colorsys, itertools, functools, collections, statistics, bpy_extras.
- no files: no open(), no os / sys / pathlib / shutil, no saving, exporting, importing or loading (bitGen saves the result itself), no .filepath.
- no network, no programs (subprocess), no eval / exec / compile / __import__ / globals(), no bpy.app.handlers, no add-ons or preferences.
- build exactly what is asked, in metres, real-world size; name every object, mesh and material clearly; put new objects in a collection named after the thing made; apply sensible materials (Principled BSDF); smooth shading where it should be smooth; keep it under 200k triangles.
- use data / bmesh calls where you can (bpy.ops needs a context in background mode); follow the 5.x API rules below.
- do not delete what was already in the scene unless asked.
Answer with the script only, in one \`\`\`python block.`;
function SYSTEM(skill) { return RULES + "\n\n# blender-core\n" + sheet("blender-core", 6500) + (skill && skill !== "blender-core" ? "\n\n# " + skill + "\n" + sheet(skill, 6500) : ""); }
function codeOf(text) { const m = /```(?:python|py)?\s*\n([\s\S]*?)```/i.exec(String(text || "")); return (m ? m[1] : String(text || "")).replace(/\r/g, "").trim() + "\n"; }
/** -> [] when the script may run, else the reasons */
function check(code) {
  const c = String(code || ""), why = [];
  if (!c.trim()) return ["the script is empty"];
  if (c.length > 60000) why.push("the script is too long");
  const noStr = c.replace(/("""|''')[\s\S]*?\1/g, "\"\"").replace(/#[^\n]*/g, "");
  for (const m of noStr.matchAll(/^\s*(?:from\s+([\w.]+)\s+import\b|import\s+([\w.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.]+(?:\s+as\s+\w+)?)*))/gm)) {
    const mods = m[1] ? [m[1]] : m[2].split(",").map((x) => x.trim().split(/\s+/)[0]);
    for (const mod of mods) if (!ALLOW.has(mod.split(".")[0])) why.push("imports " + mod);
  }
  const RX = [[/\b__import__\b|\bimportlib\b/, "imports by name"], [/(?<![\w.])(eval|exec|compile|open|globals|locals|vars|breakpoint|input)\s*\(/, "uses a built-in that is not allowed"],
    [/__builtins__|__subclasses__|__globals__|__code__|__loader__|__spec__/, "reaches Python's insides"], [/\bbpy\.app\.handlers\b|\bbpy\.app\.timers\b/, "adds handlers / timers"],
    [/\bbpy\.ops\.wm\.(save|open|read|quit|link|append|url_open|path_open)\w*/, "saves / opens / quits"], [/\bbpy\.ops\.(export_\w+|import_\w+|script|preferences|extensions|file)\./, "exports / imports files or changes Blender"],
    [/\.filepath(_raw)?\s*=|\bbpy\.data\.libraries\b|\.save_render\s*\(|\.save\s*\(\s*\)|\bwrite_still\s*=\s*True/, "writes or reads files"],
    [/\b(get|set|del)attr\s*\([^)]*["'][^"']*(save|export|import|open|quit|filepath|handler|exec|eval|system|load)/i, "reaches a forbidden call by name"],
    [/\bbpy\.utils\.(register|unregister|script_path|user_resource|execfile)\w*/, "registers code"], [/\bos\.|\bsys\.|\bsubprocess\b|\bsocket\b|\burllib\b|\brequests\b|\bshutil\b/, "uses the system"]];
  for (const [re, w] of RX) if (re.test(noStr)) why.push(w);
  return [...new Set(why)];
}
async function write(ask, skill, scene) {
  const r = await llm({ messages: [{ role: "system", content: SYSTEM(skill) }, { role: "user", content: `${scene ? `The open scene has: ${scene}\n\n` : ""}Make this in Blender: ${String(ask).slice(0, 4000)}` }], temperature: 0.3, max_tokens: 6000 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  return codeOf(r.text);
}
async function fix(ask, skill, code, error, refused) {
  const r = await llm({ messages: [{ role: "system", content: SYSTEM(skill) }, { role: "user", content: `Make this in Blender: ${String(ask).slice(0, 4000)}` }, { role: "assistant", content: "```python\n" + code + "```" },
    { role: "user", content: (refused ? "bitGen refused that script before running it: " + error + "." : `That script failed in Blender:\n${String(error).slice(-3000)}`) + "\n\nWrite the whole script again, fixed. The same rules." }], temperature: 0.2, max_tokens: 6000 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  return codeOf(r.text);
}

/* ---------------- Blender ---------------- */
function verOk(v) { const m = /^(\d+)\.(\d+)/.exec(String(v || "")); return !!m && (+m[1] > MIN[0] || (+m[1] === MIN[0] && +m[2] >= MIN[1])); }
async function blender() {
  if (exeFn) return exeFn();
  const B = require("./blender"), exe = B.find();
  return { exe, version: exe ? await B.version(exe) : null };
}
/** -> null when Blender 5.2+ is there, else what the Download / Cancel box says */
async function need() {
  const b = await blender();
  if (b.exe && verOk(b.version)) return null;
  return { found: b.exe || null, version: b.version || null, min: MIN.join("."), url: "https://www.blender.org/download/",
    why: !b.exe ? "Blender is not installed (or not found - Settings ▸ Blender)" : `Blender ${b.version || "?"} is too old - the skills need ${MIN.join(".")} or newer` };
}
function exec(exe, args, timeout) {
  if (runFn) return Promise.resolve(runFn(exe, args));
  return new Promise((ok) => execFile(exe, args, { timeout: timeout || 15 * 60000, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, out, er) => ok({ code: err ? (err.code || 1) : 0, out: String(out || ""), err: String(er || ""), killed: !!(err && err.killed) })));
}
const MARK = "@@JSON@@";
function jsonOf(r) { const ls = String(r.out || "").split(/\r?\n/).filter((l) => l.startsWith(MARK)); let j = null; try { j = ls.length ? JSON.parse(ls[ls.length - 1].slice(MARK.length)) : null; } catch { j = null; } return j; }
function tailOf(r) { return String(r.err || r.out || "").trim().split(/\r?\n/).slice(-15).join("\n"); }
/** a free name in the project's blender/scenes/ (the original is never written): <stem>_<tag>.blend, (2), (3) … */
function outPath(src, tag) {
  const d = path.join(blendDir(), "scenes"); fs.mkdirSync(d, { recursive: true });
  const stem = src ? path.basename(src).replace(/\.blend\d*$/i, "") : "ai_model";
  let p = path.join(d, `${stem}_${tag}.blend`);
  for (let i = 2; fs.existsSync(p) && i < 1000; i++) p = path.join(d, `${stem}_${tag} (${i}).blend`);
  return p;
}
/** the scene the user has open: a .blend that is there (only read - Blender opens it, bitGen saves a new file) */
function sceneOf(p) {
  if (!p) return null;
  const f = path.resolve(String(p));
  if (!/\.blend$/i.test(f) || !fs.existsSync(f)) throw bad("no scene " + path.basename(f), 404);
  return f;
}

/* ---------------- ✨ Model with AI ---------------- */
/** the script for an ask (shown before it runs): {skill, script, problems} */
async function plan(o) {
  const a = o || {}, ask = String(a.ask || "").trim(); if (!ask) throw bad("say what to make");
  const skill = a.skill && skills().some((s) => s.name === a.skill) ? a.skill : route(ask);
  const script = await write(ask, skill, a.scene ? String(a.scene).slice(0, 1500) : "");
  return { skill, script, problems: check(script) };
}
/** run it on a copy; a failure goes back to the LLM (3 tries in all) -> {ok, path, preview, tries, qa} */
async function model(o) {
  const a = o || {}, n = await need(); if (n) throw Object.assign(bad(n.why, 412), { need: n });
  const src = sceneOf(a.blend), skill = a.skill || route(a.ask), { exe } = await blender();
  let code = String(a.script || ""), tries = [];
  for (let k = 0; k < 3; k++) {
    const why = check(code);
    if (why.length) { tries.push({ script: code, error: "refused: " + why.join(", ") }); if (k === 2 || !a.ask) break; code = await fix(a.ask, skill, code, why.join(", "), true); continue; }
    const out = outPath(src, "ai"), prev = out.replace(/\.blend$/, ".png"), cf = out.replace(/\.blend$/, ".py");
    fs.writeFileSync(cf, code);
    const r = await exec(exe, ["-b", ...(src ? [src] : []), "--factory-startup", "--python-exit-code", "1", "-P", RUNNER, "--", "--mode", "model", "--code", cf, "--out", out, "--preview", prev]);
    const j = jsonOf(r);
    if (j && j.ok && fs.existsSync(out)) {
      tries.push({ script: code, error: null });
      let qa = null; try { qa = await tool({ tool: "qa", blend: out, args: { profile: "render" }, inPlace: true }); } catch (e) { qa = { ok: false, error: e.message }; }
      return { ok: true, skill, path: out, name: path.basename(out), preview: fs.existsSync(prev) ? prev : null, objects: j.objects || [], tries, script: code, qa: qa && qa.result ? qa.result : qa };
    }
    for (const f of [out, prev]) { try { fs.unlinkSync(f); } catch { /* not made */ } }
    const err = (j && (j.traceback || j.error)) || tailOf(r) || "Blender stopped (code " + r.code + ")";
    tries.push({ script: code, error: err });
    if (k === 2 || !a.ask) break;
    code = await fix(a.ask, skill, code, err);
  }
  return { ok: false, skill, tries, script: code, error: "the script did not work after " + tries.length + " tr" + (tries.length > 1 ? "ies" : "y") + " - " + String(tries[tries.length - 1].error).split("\n").pop() };
}

/* ---------------- 🧰 the tools ---------------- */
const F = (k, label, kind, def, extra) => Object.assign({ k, label, kind, def }, extra || {});
const OBJ = F("objects", "Objects (names, blank = all meshes)", "list", "");
const TOOLS = {
  lods: { label: "📉 LODs", skill: "blender-game-optimization", script: "make_lods.py", save: true, tip: "Lower-detail copies (LOD1..3) of each mesh, the triangles halved each time", fields: [OBJ, F("ratios", "Ratios", "nums", "0.5 0.25 0.125"), F("cleanup", "Clean the mesh first", "bool", true)] },
  uv: { label: "🗺 UV pack", skill: "blender-retopology-uv", script: "uv_pack.py", save: true, tip: "Unwrap + pack the UVs for a texture size", fields: [OBJ, F("method", "Method", "pick", "smart", { options: ["smart", "seams", "min_stretch"] }), F("res", "Texture size", "int", 2048), F("margin-px", "Margin (px)", "int", 8)] },
  bake: { label: "🔥 Bake maps", skill: "blender-texture-baking", script: "bake_maps.py", save: true, tip: "Bake normal / AO / curvature from a high-poly object onto a low one (or the object's own materials)", fields: [F("low", "Low-poly object", "text", ""), F("high", "High-poly objects (blank = its own materials)", "list", ""), F("maps", "Maps", "list", "normal ao"), F("res", "Size", "int", 2048), F("device", "Device", "pick", "GPU", { options: ["GPU", "CPU"] })] },
  export: { label: "📤 Export for a game engine", skill: "blender-export-pipelines", script: "export_asset.py", save: false, tip: "FBX / glTF with the engine's own settings (scale, axes, names)", fields: [F("preset", "Engine", "pick", "unreal", { options: ["unreal", "unity", "godot", "roblox", "web"] }), OBJ] },
  toon: { label: "🎨 Toon look", skill: "blender-stylized-npr", script: "toon_setup.py", save: true, tip: "Cel shading with bands, rim light and outlines", fields: [OBJ, F("bands", "Bands", "pick", "3", { options: ["2", "3"] }), F("outline", "Outline width", "num", 0.004), F("rim", "Rim", "num", 0.4)] },
  mood: { label: "🌇 Time of day", skill: "blender-time-of-day", script: "scene_mood.py", save: true, tip: "Sun, sky, fog and grade for a time of day / mood", fields: [F("time", "Time", "pick", "golden", { options: ["noon", "morning", "afternoon", "golden", "sunrise", "sunset", "blue_hour", "night", "moonless"] }), F("mood", "Mood", "pick", "none", { options: ["none", "cyberpunk", "horror", "underwater", "desert"] }), F("fog-visibility", "Fog visibility (m, 0 = none)", "num", 0)] },
  weather: { label: "🌧 Weather", skill: "blender-weather-fx", script: "surface_weather.py", save: true, tip: "Wet surfaces, puddles and snow on the objects", fields: [OBJ, F("wetness", "Wetness (0-1)", "num", 0.6), F("puddles", "Puddles (0-1)", "num", 0.4), F("snow", "Snow (0-1)", "num", 0)] },
  turntable: { label: "🔄 Turntable", skill: "blender-lighting-lookdev", script: "turntable.py", save: true, tip: "A studio turntable (camera orbit + lights) ready to render", fields: [OBJ, F("frames", "Frames", "int", 120), F("rig", "Lights", "pick", "studio", { options: ["studio", "hdri", "both"] }), F("lens", "Lens (mm)", "int", 85)] },
  qa: { label: "✅ QA check", skill: "blender-asset-qa", script: "qa_check.py", save: false, tip: "Finds z-fighting, floating parts, flipped normals, open geometry …", fields: [OBJ, F("profile", "For", "pick", "game", { options: ["game", "render", "print", "roblox"] })] },
};
/** the tool's command-line words from the box's values (only the fields it has; numbers checked) */
function argsOf(t, v) {
  const out = [], x = v || {};
  for (const f of t.fields) {
    let val = x[f.k]; if (val === undefined || val === null || val === "") val = f.def;
    if (f.kind === "bool") { if (val === true || val === "true" || val === 1) out.push("--" + (f.k === "cleanup" ? "cleanup" : f.k)); continue; }
    if (val === "" || val === undefined) continue;
    if (f.kind === "list" || f.kind === "nums") {
      const parts = String(val).split(/[\s,]+/).filter(Boolean).slice(0, 40);
      if (!parts.length) continue;
      if (f.kind === "nums" && parts.some((p) => !Number.isFinite(+p))) throw bad(f.label + ": numbers only");
      if (parts.some((p) => /^-/.test(p) && f.kind === "list")) throw bad(f.label + ": a name cannot start with -");
      out.push("--" + f.k, ...parts); continue;
    }
    if (f.kind === "int" || f.kind === "num") { if (!Number.isFinite(+val)) throw bad(f.label + ": a number"); if ((f.k === "fog-visibility" || f.k === "snow") && +val === 0) continue; out.push("--" + f.k, String(f.kind === "int" ? Math.round(+val) : +val)); continue; }
    if (f.kind === "pick") { if (!f.options.includes(String(val))) throw bad(f.label + ": one of " + f.options.join(", ")); out.push("--" + f.k, String(val)); continue; }
    if (/^-/.test(String(val))) throw bad(f.label + ": cannot start with -");
    out.push("--" + f.k, String(val).slice(0, 120));
  }
  return out;
}
/** 🧰 run a tool on a copy -> {ok, result, path?, exported?} */
async function tool(o) {
  const a = o || {}, t = TOOLS[a.tool]; if (!t) throw bad("no tool " + a.tool);
  const n = await need(); if (n) throw Object.assign(bad(n.why, 412), { need: n });
  const src = a.inPlace ? path.resolve(a.blend) : sceneOf(a.blend); if (!src) throw bad("open a Blender scene first (🟧 ▾ Open)");
  const { exe } = await blender(), script = path.join(ROOT, t.skill, "scripts", t.script);
  if (!fs.existsSync(script)) throw bad("the skill script " + t.script + " is missing", 500);
  const args = argsOf(t, a.args);
  let out = null, exported = null;
  if (t.save && !a.inPlace) { out = outPath(src, a.tool); args.push("--save", out); }
  if (a.tool === "bake") { const td = path.join(blendDir(), "scenes", "textures"); fs.mkdirSync(td, { recursive: true }); args.push("--out", td); }
  if (a.tool === "export") { const ed = path.join(blendDir(), "export"); fs.mkdirSync(ed, { recursive: true }); exported = path.join(ed, path.basename(src).replace(/\.blend$/i, "") + ((a.args || {}).preset === "godot" || (a.args || {}).preset === "web" ? ".glb" : ".fbx")); args.push("--out", exported); }
  const r = await exec(exe, ["-b", src, "--factory-startup", "--python-exit-code", "1", "-P", script, "--", ...args]);
  const j = jsonOf(r);
  if (!j) return { ok: false, tool: a.tool, error: tailOf(r) || "Blender stopped (code " + r.code + ")" };
  const ok = j.ok !== false && r.code === 0;
  return Object.assign({ ok, tool: a.tool, result: j }, out && fs.existsSync(out) ? { path: out, name: path.basename(out) } : {}, exported && fs.existsSync(exported) ? { exported } : {}, ok ? {} : { error: j.error || tailOf(r) });
}
function list() { return { skills: skills().map((s) => ({ name: s.name, description: s.description })), tools: Object.entries(TOOLS).map(([id, t]) => ({ id, label: t.label, tip: t.tip, skill: t.skill, fields: t.fields })) }; }
module.exports = { ROOT, MIN, ALLOW, TOOLS, setComplete, setRun, setDir, setExe, front, skills, sheet, route, SYSTEM, codeOf, check, verOk, need, outPath, sceneOf, argsOf, plan, model, tool, list, jsonOf };

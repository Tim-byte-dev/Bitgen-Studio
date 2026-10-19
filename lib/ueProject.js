// bitGen Studio — lib/ueProject.js (2.513.0): 🎮 LOAD AN UNREAL PROJECT - the bitGen Bridge plugin put into it, the
// plugins it needs switched on, Unreal (re)started with it.
//
// Tim (verbatim): "add a load ue project button in the main menubar, open a dialog to select the ue project folder then
// when user clicks select automatically add the plugin if not already there and restart unreal".
//
//   resolve(p)            a folder (its .uproject) or a .uproject file -> the .uproject's path (or throws)
//   inspect(p)            -> {uproject, dir, name, engine, plugin: {installed, version, bundled, needsUpdate},
//                            plugins: [{name, enabled}], editor: path | null, running: [{pid, project}], same, others}
//   installPlugin(up)     copies <app>/ue/bitGenBridge into <project>/Plugins/bitGenBridge when it is missing or older
//   enablePlugins(up)     the .uproject's Plugins list: PythonScriptPlugin, EditorScriptingUtilities, SequencerScripting,
//                         MovieRenderPipeline, bitGenBridge enabled (a backup .uproject.bitgen-bak first, once)
//   findEditor(engine)    UnrealEditor for the project's engine: the setting, the Epic launcher's list
//                         (LauncherInstalled.dat), a source build (the registry), the usual install folders
//   running()             the Unreal Editors open now [{pid, cmd}]
//   load(p, opts)         every step above, then Unreal closed (politely: it asks to save) and started with the
//                         project -> {steps: [...], ...}; the project is remembered (config ueProject: current, recent)
// Pure (Node: scripts/test-ueproject.js): parseUproject, withPlugins, versionOf, newer, pickInstall, matchProject.
// Routes: routes/ueProject.js.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile, spawn } = require("child_process");
const core = require("./core");

const NEEDED = ["PythonScriptPlugin", "EditorScriptingUtilities", "SequencerScripting", "MovieRenderPipeline"];
const PLUGIN = "bitGenBridge";
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });

/* ---------------- pure ---------------- */
function parseUproject(text) {
  const j = JSON.parse(String(text || "").replace(/^\uFEFF/, ""));
  if (!j || typeof j !== "object" || Array.isArray(j)) throw bad("that .uproject is not a project file");
  return j;
}
/** the project's JSON with these plugins enabled -> {json, changed: [names]} */
function withPlugins(j, names) {
  const o = JSON.parse(JSON.stringify(j)), changed = [];
  o.Plugins = Array.isArray(o.Plugins) ? o.Plugins : [];
  for (const n of names) {
    const e = o.Plugins.find((p) => p && String(p.Name).toLowerCase() === n.toLowerCase());
    if (!e) { o.Plugins.push({ Name: n, Enabled: true }); changed.push(n); }
    else if (e.Enabled !== true) { e.Enabled = true; changed.push(n); }
  }
  return { json: o, changed };
}
const versionOf = (uplugin) => { try { return String(parseUproject(uplugin).VersionName || ""); } catch (e) { return ""; } };
/** is version a newer than b ("1.10.0" > "1.9.2") */
function newer(a, b) {
  const p = (v) => String(v || "0").split(/[^0-9]+/).filter(Boolean).map(Number);
  const A = p(a), B = p(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) { const x = A[i] || 0, y = B[i] || 0; if (x !== y) return x > y; }
  return false;
}
/** the Epic launcher's list -> the install folder for an engine ("5.8" -> UE_5.8) */
function pickInstall(dat, engine) {
  let j; try { j = typeof dat === "string" ? JSON.parse(dat) : dat; } catch (e) { return null; }
  const L = (j && Array.isArray(j.InstallationList) ? j.InstallationList : []).filter((x) => x && /^UE_/i.test(String(x.AppName || "")));
  const want = "UE_" + String(engine || "");
  const hit = L.find((x) => String(x.AppName).toLowerCase() === want.toLowerCase())
    || L.filter((x) => engine && String(x.AppName).toLowerCase().startsWith(want.toLowerCase())).pop();
  return hit ? String(hit.InstallLocation || "") : null;
}
/** is this command line an Unreal Editor with that .uproject open */
function matchProject(cmd, uproject) {
  const norm = (s) => String(s || "").replace(/\\/g, "/").toLowerCase();
  return !!uproject && norm(cmd).includes(norm(uproject));
}

/* ---------------- the computer ---------------- */
function resolve(p) {
  const s = String(p || "").trim().replace(/^"|"$/g, "");
  if (!s) throw bad("pick your Unreal project's folder");
  let st; try { st = fs.statSync(s); } catch (e) { throw bad("there is no " + s, 404); }
  if (st.isFile()) { if (!/\.uproject$/i.test(s)) throw bad("pick the project's folder or its .uproject file"); return path.resolve(s); }
  const ups = fs.readdirSync(s).filter((f) => /\.uproject$/i.test(f));
  if (!ups.length) throw bad("no .uproject file in " + s + " - pick the folder that holds YourProject.uproject", 404);
  return path.resolve(s, ups.sort((a, b) => (a.toLowerCase() === path.basename(s).toLowerCase() + ".uproject" ? -1 : 0) - (b.toLowerCase() === path.basename(s).toLowerCase() + ".uproject" ? -1 : 0))[0]);
}
const bundledDir = () => path.join(core.BASE, "ue", PLUGIN);
const pluginDirOf = (up) => path.join(path.dirname(up), "Plugins", PLUGIN);
function readText(p) { try { return fs.readFileSync(p, "utf8"); } catch (e) { return ""; } }
function cfg() { const c = (core.getConfig() || {}).ueProject || {}; return { current: c.current || "", recent: Array.isArray(c.recent) ? c.recent.slice(0, 8) : [], editor: c.editor || "" }; }
function remember(up, editor) {
  const all = core.getConfig() || {}, c = cfg();
  all.ueProject = { current: up || c.current, recent: [up].concat(c.recent.filter((x) => x !== up)).filter(Boolean).slice(0, 8), editor: editor != null ? editor : c.editor };
  core.setConfig(all);
  return cfg();
}
function setEditor(p) { const s = String(p || "").trim(); if (s && !fs.existsSync(s)) throw bad("there is no " + s, 404); remember(cfg().current, s); return cfg(); }
function run(cmd, args, ms) {
  return new Promise((ok) => execFile(cmd, args, { timeout: ms || 15000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, out) => ok(err && !out ? "" : String(out || ""))));
}
async function regBuilds() {
  if (process.platform !== "win32") return {};
  const out = await run("reg", ["query", "HKCU\\Software\\Epic Games\\Unreal Engine\\Builds"]);
  const o = {};
  out.split(/\r?\n/).forEach((l) => { const m = /^\s+(\S+)\s+REG_SZ\s+(.+)$/.exec(l); if (m) o[m[1]] = m[2].trim(); });
  return o;
}
const editorIn = (root) => {
  if (!root) return null;
  const c = process.platform === "win32" ? path.join(root, "Engine", "Binaries", "Win64", "UnrealEditor.exe")
    : process.platform === "darwin" ? path.join(root, "Engine", "Binaries", "Mac", "UnrealEditor.app", "Contents", "MacOS", "UnrealEditor")
    : path.join(root, "Engine", "Binaries", "Linux", "UnrealEditor");
  return fs.existsSync(c) ? c : null;
};
async function findEditor(engine) {
  const set = cfg().editor; if (set && fs.existsSync(set)) return set;
  const e = String(engine || "");
  if (process.platform === "win32") {
    const dat = readText(path.join(process.env.ProgramData || "C:\\ProgramData", "Epic", "UnrealEngineLauncher", "LauncherInstalled.dat"));
    const hit = editorIn(pickInstall(dat, e)); if (hit) return hit;
    const builds = await regBuilds(); if (builds[e]) { const b = editorIn(builds[e]); if (b) return b; }
    for (const base of [process.env.ProgramFiles || "C:\\Program Files", "C:\\Program Files", "D:\\Program Files", "D:\\Epic Games", "C:\\Epic Games"]) {
      const b = editorIn(path.join(base, base.endsWith("Epic Games") ? "" : "Epic Games", "UE_" + e)); if (b) return b;
    }
  } else {
    for (const r of [path.join(os.homedir(), "UnrealEngine"), "/opt/UnrealEngine", path.join(os.homedir(), "UE_" + e), "/Users/Shared/Epic Games/UE_" + e]) { const b = editorIn(r); if (b) return b; }
  }
  return null;
}
async function running() {
  if (process.platform === "win32") {
    const out = await run("powershell", ["-NoProfile", "-NonInteractive", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='UnrealEditor.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"], 20000);
    let j = []; try { j = JSON.parse(out.trim() || "[]"); } catch (e) { j = []; }
    if (!Array.isArray(j)) j = [j];
    return j.filter((x) => x && x.ProcessId).map((x) => ({ pid: +x.ProcessId, cmd: String(x.CommandLine || "") }));
  }
  const out = await run("ps", ["-eo", "pid=,args="]);
  return out.split(/\n/).map((l) => { const m = /^\s*(\d+)\s+(.*)$/.exec(l); return m && /UnrealEditor(\.exe)?(\s|$)/.test(m[2]) && !/\bgrep\b/.test(m[2]) ? { pid: +m[1], cmd: m[2] } : null; }).filter(Boolean);
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
/** ask the editors to close (Unreal asks to save first) and wait up to ms for them to go */
async function closeEditors(list, ms) {
  for (const x of list) {
    if (process.platform === "win32") await run("taskkill", ["/PID", String(x.pid)]);
    else { try { process.kill(x.pid, "SIGTERM"); } catch (e) { /* gone */ } }
  }
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 60000)) {
    const left = list.filter((x) => alive(x.pid));
    if (!left.length) return { closed: list.length, waiting: [] };
    await new Promise((r) => setTimeout(r, 1000));
  }
  const left = list.filter((x) => alive(x.pid));
  return { closed: list.length - left.length, waiting: left.map((x) => x.pid) };
}
function launch(editor, up) {
  const ch = spawn(editor, [up], { detached: true, stdio: "ignore", windowsHide: false, cwd: path.dirname(up) });
  ch.on("error", () => { /* reported by the caller's check */ });
  ch.unref();
  return ch.pid || 0;
}
async function inspect(p) {
  const up = resolve(p), j = parseUproject(readText(up));
  const installedV = versionOf(readText(path.join(pluginDirOf(up), PLUGIN + ".uplugin"))), bundledV = versionOf(readText(path.join(bundledDir(), PLUGIN + ".uplugin")));
  const list = (Array.isArray(j.Plugins) ? j.Plugins : []);
  const plugins = NEEDED.concat([PLUGIN]).map((n) => { const e = list.find((x) => x && String(x.Name).toLowerCase() === n.toLowerCase()); return { name: n, enabled: !!(e && e.Enabled === true) }; });
  const eds = await running(), editor = await findEditor(j.EngineAssociation);
  return { uproject: up, dir: path.dirname(up), name: path.basename(up, ".uproject"), engine: String(j.EngineAssociation || ""),
    plugin: { installed: !!installedV, version: installedV, bundled: bundledV, needsUpdate: !installedV || newer(bundledV, installedV) },
    plugins, editor, running: eds.map((x) => ({ pid: x.pid, project: matchProject(x.cmd, up) })),
    same: eds.filter((x) => matchProject(x.cmd, up)).length, others: eds.filter((x) => !matchProject(x.cmd, up)).length };
}
function installPlugin(up) {
  const src = bundledDir(); if (!fs.existsSync(path.join(src, PLUGIN + ".uplugin"))) throw bad("the bitGen Bridge plugin is missing from the app's ue folder - reinstall bitGen", 500);
  const dst = pluginDirOf(up), have = versionOf(readText(path.join(dst, PLUGIN + ".uplugin"))), want = versionOf(readText(path.join(src, PLUGIN + ".uplugin")));
  if (have && !newer(want, have)) return { copied: false, version: have };
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, force: true });
  return { copied: true, version: want, was: have || null };
}
function enablePlugins(up) {
  const txt = readText(up), j = parseUproject(txt), r = withPlugins(j, NEEDED.concat([PLUGIN]));
  if (!r.changed.length) return { changed: [] };
  const bak = up + ".bitgen-bak"; if (!fs.existsSync(bak)) fs.writeFileSync(bak, txt);
  fs.writeFileSync(up, JSON.stringify(r.json, null, /\n\t/.test(txt) ? "\t" : 2) + "\n");
  return { changed: r.changed };
}
/** the whole job: plugin in, plugins on, Unreal (re)started with the project */
async function load(p, o) {
  o = Object.assign({ install: true, enable: true, restart: true, closeOthers: false, wait: 60000 }, o || {});
  const steps = [], info = await inspect(p), up = info.uproject;
  steps.push(`project ${info.name} (Unreal ${info.engine || "?"})`);
  if (o.install) { const r = installPlugin(up); steps.push(r.copied ? `bitGen Bridge ${r.version} ${r.was ? "updated (was " + r.was + ")" : "added"} - Plugins/${PLUGIN}` : `bitGen Bridge ${r.version} already there`); }
  if (o.enable) { const r = enablePlugins(up); steps.push(r.changed.length ? `switched on: ${r.changed.join(", ")} (the old .uproject kept as .uproject.bitgen-bak)` : "the plugins it needs were already on"); }
  remember(up);
  let launched = false, waiting = [];
  if (o.restart) {
    const eds = await running(), mine = eds.filter((x) => matchProject(x.cmd, up)), others = eds.filter((x) => !matchProject(x.cmd, up));
    const toClose = mine.concat(o.closeOthers ? others : []);
    if (toClose.length) {
      steps.push(`closing Unreal (${toClose.length} window${toClose.length > 1 ? "s" : ""}) - it may ask you to save first`);
      const c = await closeEditors(toClose, o.wait);
      waiting = c.waiting;
      if (waiting.length) steps.push("Unreal has not closed yet (is it asking to save?) - answer it there, then press Restart Unreal again");
    }
    if (!waiting.length) {
      if (!info.editor) steps.push("Unreal Editor was not found for engine " + (info.engine || "?") + " - set its path (UnrealEditor.exe) and press Restart Unreal");
      else { launch(info.editor, up); launched = true; steps.push("Unreal is starting with " + info.name + " - the Output Log will say \"[bitGen Bridge] listening\""); }
    }
    if (others.length && !o.closeOthers) steps.push(`${others.length} other Unreal window(s) left open - close them if the bridge's port (30020) is taken`);
  }
  return Object.assign(await inspect(up), { steps, launched, waiting });
}
module.exports = { NEEDED, PLUGIN, parseUproject, withPlugins, versionOf, newer, pickInstall, matchProject, resolve, inspect, installPlugin, enablePlugins, findEditor, running, closeEditors, launch, load, cfg, remember, setEditor };

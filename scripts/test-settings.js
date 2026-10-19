#!/usr/bin/env node
// lib/settings.js — default.settings + custom.settings (2.99.0).
// Run: node scripts/test-settings.js
//
// Tim: "write a default settings file with default settings that works for all
// our features. when we change the settings save the new settings as
// custom.settings, default.settings will be the default, in the general tab add
// a reset settings button."
//
// What can rot invisibly here: a Save that writes the WHOLE config (then an
// edited default never flows through), a reset that also forgets the open
// project, a migration that loses a key the user had set in config.json, and a
// deep merge that turns a nested object into a replacement (wiping the
// workflows map — the exact bug the comfy deep-merge guards against).
const fs = require("fs");
const os = require("os");
const path = require("path");
const S = require(path.join(__dirname, "..", "lib", "settings"));

let pass = 0, fail = 0;
const check = (n, cond, got) => cond
  ? (pass++, console.log("PASS: " + n))
  : (fail++, console.log("FAIL: " + n + (got !== undefined ? "\n      got " + JSON.stringify(got) : "")));

const DEFAULTS = {
  python: "python", engine: { backend: "comfy",
    comfy: { url: "http://127.0.0.1:8188", free_before_gen: true, vram_ceiling: 0,
             workflows: { t2va: "a.json", ref2va: "b.json" } } },
  defaults: { width: 960, height: 544, steps: 8 },
  current_project: "default",
};
const ws = () => fs.mkdtempSync(path.join(os.tmpdir(), "h3set-"));
const paths = (d) => ({ defaultsPath: path.join(d, "default.settings"),
                        customPath: path.join(d, "custom.settings"),
                        legacyPath: path.join(d, "config.json") });
const rj = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ---- deepMerge / deepDiff
{
  const m = S.deepMerge({ a: 1, n: { x: 1, y: 2 }, arr: [1, 2] }, { n: { y: 3 }, arr: [9] });
  check("deepMerge merges nested objects and replaces arrays",
    m.a === 1 && m.n.x === 1 && m.n.y === 3 && m.arr.length === 1 && m.arr[0] === 9, m);
  const base = { a: 1, n: { x: 1, y: 2 } };
  check("deepMerge never mutates its inputs",
    JSON.stringify(S.deepMerge(base, { n: { y: 9 } })) !== JSON.stringify(base) && base.n.y === 2, base);
  check("deepDiff of equal objects is {}", Object.keys(S.deepDiff(DEFAULTS, DEFAULTS)).length === 0);
  const d = S.deepDiff(S.deepMerge(DEFAULTS, { engine: { comfy: { url: "http://x:1" } } }), DEFAULTS);
  check("deepDiff keeps ONLY the changed leaf, nested",
    JSON.stringify(d) === JSON.stringify({ engine: { comfy: { url: "http://x:1" } } }), d);
}

// ---- first boot: no files at all
{
  const d = ws(); const P = paths(d);
  const r = S.load({ defaults: DEFAULTS, ...P });
  check("first boot writes default.settings from the code defaults",
    fs.existsSync(P.defaultsPath) && rj(P.defaultsPath).engine.backend === "comfy", r.notes);
  check("...and does NOT create custom.settings (nothing is custom yet)", !fs.existsSync(P.customPath));
  check("...effective config == defaults", JSON.stringify(r.config) === JSON.stringify(DEFAULTS));
  check("...and says so in the notes", r.notes.some((n) => /written from the code defaults/.test(n)), r.notes);
}

// ---- save writes only the diff; an edited default flows through
{
  const d = ws(); const P = paths(d);
  let r = S.load({ defaults: DEFAULTS, ...P });
  const cfg = S.deepMerge(r.config, { engine: { comfy: { url: "http://mine:8188" } }, defaults: { steps: 20 } });
  S.save({ config: cfg, base: r.base, customPath: P.customPath });
  const c = rj(P.customPath);
  check("a Save writes ONLY the difference to custom.settings",
    JSON.stringify(c) === JSON.stringify({ engine: { comfy: { url: "http://mine:8188" } }, defaults: { steps: 20 } }), c);
  check("...so the workflows map is NOT in custom.settings (it was not changed)",
    !(c.engine && c.engine.comfy && c.engine.comfy.workflows), c);
  // edit default.settings: change a default the user never touched
  const df = rj(P.defaultsPath); df.defaults.width = 1280; fs.writeFileSync(P.defaultsPath, JSON.stringify(df));
  r = S.load({ defaults: DEFAULTS, ...P });
  check("an edited default.settings flows through to untouched keys",
    r.config.defaults.width === 1280 && r.config.defaults.steps === 20 && r.config.engine.comfy.url === "http://mine:8188",
    r.config.defaults);
  check("...while the code defaults fill anything the file lacks",
    r.config.engine.comfy.workflows.ref2va === "b.json", r.config.engine.comfy);
}

// ---- reset: back to defaults, keeps the open project, keeps a .bak
{
  const d = ws(); const P = paths(d);
  let r = S.load({ defaults: DEFAULTS, ...P });
  const cfg = S.deepMerge(r.config, { engine: { comfy: { url: "http://mine:8188", vram_ceiling: 243 } },
                                       current_project: "myfilm" });
  S.save({ config: cfg, base: r.base, customPath: P.customPath });
  const after = S.reset({ base: r.base, customPath: P.customPath, current: cfg, keep: ["current_project"] });
  check("reset returns the defaults", after.engine.comfy.url === DEFAULTS.engine.comfy.url && after.engine.comfy.vram_ceiling === 0, after.engine);
  check("...but KEEPS the open project (state, not a setting)", after.current_project === "myfilm", after.current_project);
  check("...keeps the old custom layer as custom.settings.bak",
    fs.existsSync(P.customPath + ".bak") && rj(P.customPath + ".bak").engine.comfy.vram_ceiling === 243);
  check("...and custom.settings now holds only the project",
    JSON.stringify(rj(P.customPath)) === JSON.stringify({ current_project: "myfilm" }), rj(P.customPath));
  r = S.load({ defaults: DEFAULTS, ...P });
  check("...and the next boot agrees", r.config.engine.comfy.vram_ceiling === 0 && r.config.current_project === "myfilm");
}

// ---- migration: a pre-2.99 config.json becomes the custom layer, losslessly
{
  const d = ws(); const P = paths(d);
  fs.writeFileSync(P.legacyPath, JSON.stringify({
    python: "C:\\\\py\\\\python.exe", engine: { comfy: { dir: "E:\\\\ComfyUI", url: "http://127.0.0.1:8188" } },
    defaults: { steps: 4 }, current_project: "old", hf: { token: "hf_abc" } }));
  const r = S.load({ defaults: DEFAULTS, ...P });
  check("config.json is migrated: every key the user had is in effect",
    r.config.python === "C:\\\\py\\\\python.exe" && r.config.engine.comfy.dir === "E:\\\\ComfyUI"
    && r.config.defaults.steps === 4 && r.config.current_project === "old" && r.config.hf.token === "hf_abc", r.config);
  check("...a key config.json did not know keeps its default", r.config.engine.comfy.free_before_gen === true);
  check("...custom.settings holds the diff (not the url, which equals the default)",
    fs.existsSync(P.customPath) && !("url" in ((rj(P.customPath).engine || {}).comfy || {}))
    && rj(P.customPath).engine.comfy.dir === "E:\\\\ComfyUI", rj(P.customPath));
  check("...and config.json is renamed, never deleted",
    !fs.existsSync(P.legacyPath) && fs.existsSync(P.legacyPath + ".migrated"), fs.readdirSync(d));
  check("...said in the notes", r.notes.some((n) => /migrated/.test(n)), r.notes);
  const r2 = S.load({ defaults: DEFAULTS, ...P });
  check("a second boot does not migrate again", !r2.notes.some((n) => /migrated/.test(n)) && r2.config.hf.token === "hf_abc");
}

// ---- damage: an unreadable default.settings is kept aside and rewritten
{
  const d = ws(); const P = paths(d);
  fs.writeFileSync(P.defaultsPath, "{ not json");
  const r = S.load({ defaults: DEFAULTS, ...P });
  check("an unreadable default.settings is kept as .broken and rewritten",
    fs.existsSync(P.defaultsPath + ".broken") && rj(P.defaultsPath).engine.backend === "comfy", r.notes);
  fs.writeFileSync(P.customPath, "{ not json either");
  const r3 = S.load({ defaults: DEFAULTS, ...P });
  check("an unreadable custom.settings falls back to the defaults, no throw",
    r3.config.engine.comfy.url === DEFAULTS.engine.comfy.url);
}

// ---- the shipped default.settings really is complete for every feature
{
  const shipped = path.join(__dirname, "..", "default.settings");
  check("default.settings ships with the app", fs.existsSync(shipped));
  const d = rj(shipped);
  check("...engine is ComfyUI (video, stills AND music run on it)", d.engine.backend === "comfy", d.engine.backend);
  check("...VRAM clear before generation is on", d.engine.comfy.free_before_gen === true);
  check("...no learned VRAM ceiling baked in (0 = model max)", d.engine.comfy.vram_ceiling === 0);
  check("...the three video workflows are mapped",
    ["t2va", "ref2va", "fl2va"].every((k) => typeof d.engine.comfy.workflows[k] === "string"), d.engine.comfy.workflows);
  check("...every top-level section the routes allow-list is present",
    ["models", "flags", "defaults", "llm", "gpu", "hf", "engine", "tts", "asr"].every((k) => k in d), Object.keys(d));
  check("...and no per-machine value leaked in (no ComfyUI folder, no HF token, no launch command)",
    !d.engine.comfy.dir && !d.engine.comfy.launch && !(d.hf && d.hf.token), { dir: d.engine.comfy.dir, launch: d.engine.comfy.launch });
  // 2.100.0: NO DUPLICATE / CONFLICTING SETTINGS between the two default
  // layers. Every leaf in default.settings must also exist in DEFAULT_CONFIG
  // (an orphan key is a setting nothing reads) and the two must AGREE on the
  // values that steer a generation — a code default of sdcli under a shipped
  // default of comfy is the kind of two-layer contradiction that hides bugs.
  const CORE = require(path.join(__dirname, "..", "lib", "core.js"));
  const DC = CORE.DEFAULT_CONFIG;
  const leaves = (o, pre = "") => Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? leaves(v, pre + k + ".") : [pre + k]);
  const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const orphans = leaves(d).filter((k) => get(DC, k) === undefined);
  check("...every key in default.settings exists in DEFAULT_CONFIG (no orphan settings)", orphans.length === 0, orphans);
  const missing = leaves(DC).filter((k) => get(d, k) === undefined && k !== "python");
  check("...and every DEFAULT_CONFIG key is present in default.settings (nothing half-shipped)", missing.length === 0, missing);
  const steer = ["engine.backend", "engine.comfy.free_before_gen", "engine.comfy.chunk_on_oom",
                 "engine.comfy.clip_device", "engine.comfy.stdio", "engine.comfy.lora_4step",
                 "engine.comfy.vram_ceiling", "defaults.steps", "defaults.width", "defaults.height"];
  const dis = steer.filter((k) => JSON.stringify(get(d, k)) !== JSON.stringify(get(DC, k)));
  check("...and the two layers AGREE on every generation-steering value", dis.length === 0,
    dis.map((k) => `${k}: settings=${JSON.stringify(get(d, k))} code=${JSON.stringify(get(DC, k))}`));
  check("...steps default is 0 = auto (follows the LoRA toggle per workflow, 2.100.0)", d.defaults.steps === 0, d.defaults.steps);
  check("...the default video format is mp4 in both layers (2.102.1: webm does not share over Messenger)",
    d.defaults.format === "mp4" && DC.defaults.format === "mp4", [d.defaults.format, DC.defaults.format]);
  check("...text-encoder placement: clip_device is ComfyUI's 'default' (gpu.te=cpu is the sd-cli setting and is NOT the same knob)",
    d.engine.comfy.clip_device === "default" && d.gpu.te === "cpu", [d.engine.comfy.clip_device, d.gpu.te]);
  // the shipped video templates load the SMALL text encoder (Tim's own exports
  // do; the int8 one is ~27 GB beside a 21 GB video model on a 32 GB card)
  for (const wf of ["ref2va", "fl2va"]) {
    const g = rj(path.join(__dirname, "..", d.engine.comfy.workflows[wf]));
    const clips = Object.values(g).filter((n) => n && n.class_type === "CLIPLoader").map((n) => n.inputs.clip_name);
    check(`...${wf}.json loads the nvfp4_awq text encoder, not int8_convrot (2.100.0)`,
      clips.length && clips.every((c) => /nvfp4_awq/.test(c)), clips);
    const loras = Object.values(g).filter((n) => n && /loraloader/i.test(n.class_type)).map((n) => n.inputs.lora_name);
    check(`...${wf}.json's LoRA is a MiniMax H3 turbo LoRA whose name says its step count`,
      loras.every((l) => /minimax_h3.*\d+step/i.test(l)), loras);
  }
  const r2 = rj(path.join(__dirname, "..", d.engine.comfy.workflows.ref2va));
  const gen = Object.values(r2).find((n) => n && n.class_type === "MiniMaxH3ReferenceToVideo");
  check("...ref2va ref_image_size is 'max' (Tim's verified export), not 'match'", gen && gen.inputs.ref_image_size === "max", gen && gen.inputs.ref_image_size);
}

// ---- lib/framePlan.js planChunks(..., ceiling) — the JS side of the worker's
// plan_chunks(ceiling=) mirror (test-patcher.py pins the Python side). The two
// MUST agree: the UI readout and the worker must plan the same chunks.
{
  const { planChunks } = require(path.join(__dirname, "..", "lib", "framePlan"));
  const p1 = planChunks(360, 362, "17k5", false, 243);
  check("framePlan: ceiling 243 turns 360f into [243, 124]", JSON.stringify(p1.chunks) === "[243,124]" && p1.trim === 6, p1);
  const p2 = planChunks(240, 362, "17k5", false, 243);
  check("framePlan: ...while 240f stays one run", JSON.stringify(p2.chunks) === "[243]" && p2.fitsSingle === true, p2);
  const p3 = planChunks(360, 362, "17k5", false, 0);
  check("framePlan: ceiling 0 = model max", JSON.stringify(p3.chunks) === "[362]", p3);
  const p4 = planChunks(360, 362, "17k5", false, 250);
  check("framePlan: an off-grid ceiling snaps down (250 -> 243)", JSON.stringify(p4.chunks) === "[243,124]", p4);
  const p5 = planChunks(360, 361, "4n1", false, 243);
  check("framePlan: the sd-cli grid honours a ceiling too (snap 4n+1)", p5.chunks[0] === 241 && p5.chunks.length === 2, p5);
}

// 2.101.1: the root-cause record ships and says the decisive things
{
  const t = (() => { try { return fs.readFileSync(path.join(__dirname, "..", "minimax-fixed.txt"), "utf8"); } catch { return ""; } })();
  check("minimax-fixed.txt ships with the torch/cu130 root cause and the ComfyUI install checklist",
    /cu130/.test(t) && /DynamicVRAM support detected and enabled/.test(t) && /'disabled': False/.test(t)
    && /int8_linear/.test(t) && /--highvram/.test(t), t.length);
}
console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

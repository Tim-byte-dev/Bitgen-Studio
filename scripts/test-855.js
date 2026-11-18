#!/usr/bin/env node
/* bitGen Studio — 2.855.0 units: 🟧 BLENDER SKILLS - lib/blendSkills.js (the vendored sheets read, an ask routed to one
 * sheet, the LLM's prompt = rules + blender-core + that sheet, the script's check (imports, files, network, eval / exec,
 * handlers, saving / exporting, calls by name), Blender 5.2+ or the Download box, ✨ Model with AI on a copy with the
 * error fed back (3 tries, each fix checked), qa_check after; 🧰 the tools' arguments + where they write), scripts/
 * blend_skill_run.py (the same refusals at run time), routes/blendSkills.js, the 🟧 ▾ menu, NOTICE + credits. Blender
 * itself stood in (setRun / setExe) - no Blender 5.2 here. The browser: test-ui855-ui.js. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const K = require(path.join(ROOT, "lib/blendSkills.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t855-")); K.setDir(() => tmp);
  const sk = K.skills();
  check("the vendored sheets: 28 skills with names + descriptions, the scripts listed (no _bpyx helpers); the MIT licence + where it came from", sk.length === 28 && sk.find((s) => s.name === "blender-core") && sk.find((s) => s.name === "blender-game-optimization").scripts.includes("make_lods.py") && !sk.some((s) => s.scripts.some((x) => x.startsWith("_")))
    && /MIT License/.test(src("blender/skills/LICENSE")) && /9e7e04a6/.test(src("blender/skills/VENDOR.md")), sk.map((s) => s.name));
  check("an ask routed to one sheet (keywords, else the descriptions' words, else hard-surface)", K.route("sculpt a dragon head") === "blender-sculpting" && K.route("a low poly sword") === "blender-hardsurface-modeling" && K.route("rocky terrain with pine trees") === "blender-environment-kits"
    && K.route("make it rain on the street") === "blender-weather-fx" && K.route("a wooden chair") === "blender-hardsurface-modeling" && K.route("a cel shaded hero with outlines") === "blender-stylized-npr");
  const sys = K.SYSTEM("blender-sculpting");
  check("the LLM is given bitGen's rules + blender-core + the one sheet (cut at a section, not mid-line), never another", /ONE Python script for Blender 5\.2/.test(sys) && /# blender-core\n/.test(sys) && /# blender-sculpting\n/.test(sys) && !/# blender-rendering/.test(sys) && sys.length < 16000, sys.length);
  const ok = "import bpy, bmesh\nfrom mathutils import Vector\nimport math\nme = bpy.data.meshes.new('Mug')\n# open(x) in a comment is fine\ns = \"\"\"open('a') in a string\"\"\"\n";
  check("a clean script passes (comments and strings ignored)", K.check(ok).length === 0, K.check(ok));
  const BAD = { "import os": /imports os/, "import subprocess": /imports subprocess/, "from pathlib import Path": /imports pathlib/, "import bpy, socket": /imports socket/, "__import__('os')": /by name/, "eval('1')": /built-in/, "exec('x')": /built-in/,
    "f = open('/etc/passwd')": /built-in/, "bpy.ops.wm.save_as_mainfile(filepath='/x.blend')": /saves/, "bpy.ops.export_scene.fbx(filepath='x')": /exports/, "bpy.app.handlers.load_post.append(f)": /handlers/, "img.filepath = '/tmp/x.png'": /files/,
    "getattr(bpy.ops.wm, 'save_mainfile')()": /by name/, "().__class__.__subclasses__()": /insides/, "bpy.utils.register_class(X)": /registers/ };
  const misses = Object.entries(BAD).filter(([c, re]) => !K.check("import bpy\n" + c).some((w) => re.test(w)));
  check("refused before running: other imports, files, network, programs, eval / exec / __import__, saving / exporting, handlers, Python's insides, calls by name", !misses.length, misses.map((m) => [m[0], K.check("import bpy\n" + m[0])]));
  check("the code taken out of the LLM's answer", K.codeOf("Here:\n```python\nimport bpy\nx=1\n```\nDone") === "import bpy\nx=1\n");
  // Blender 5.2+
  K.setExe(() => ({ exe: null, version: null })); const n1 = await K.need();
  K.setExe(() => ({ exe: "/b/blender", version: "4.5.3" })); const n2 = await K.need();
  K.setExe(() => ({ exe: "/b/blender", version: "5.3.0" })); const n3 = await K.need();
  check("Blender 5.2 or newer: none = not installed, 4.5 = too old (the Download box: blender.org), 5.3 = ok", /not installed/.test(n1.why) && /4\.5\.3 is too old/.test(n2.why) && n2.url === "https://www.blender.org/download/" && n3 === null && K.verOk("5.2.0") && K.verOk("6.0") && !K.verOk("5.1.9"), { n1, n2 });
  // ✨ Model with AI: a fake Blender + LLM
  const calls = []; let llmCalls = [];
  K.setComplete(async (o) => { llmCalls.push(o.messages); const last = o.messages[o.messages.length - 1].content; return { ok: true, text: /failed in Blender/.test(last) ? "```python\nimport bpy\nbpy.data.meshes.new('Fixed')\n```" : /refused that script before running/.test(last) ? "```python\nimport bpy\nbpy.data.meshes.new('Clean')\n```" : "```python\nimport bpy\nimport os\n```" }; });
  const pl = await K.plan({ ask: "a coffee mug" });
  check("plan: the skill, the script and its problems - shown before anything runs", pl.skill === "blender-hardsurface-modeling" && /import os/.test(pl.script) && pl.problems.includes("imports os") && llmCalls.length === 1 && /Make this in Blender: a coffee mug/.test(llmCalls[0][1].content), pl);
  const scene = path.join(tmp, "room.blend"); fs.writeFileSync(scene, "BLENDER");
  K.setRun((exe, args) => {
    calls.push(args); const i = args.indexOf("--code"), o = args.indexOf("--out"), pv = args.indexOf("--preview");
    if (i > 0) { const code = fs.readFileSync(args[i + 1], "utf8"); if (/Broken/.test(code)) return { code: 1, out: "@@JSON@@" + JSON.stringify({ ok: false, error: "AttributeError: 'Mesh' object has no attribute 'nope'", traceback: "Traceback …\nAttributeError: 'Mesh' object has no attribute 'nope'" }) }; fs.writeFileSync(args[o + 1], "BLEND"); fs.writeFileSync(args[pv + 1], "PNG"); return { code: 0, out: "Blender 5.3\n@@JSON@@" + JSON.stringify({ ok: true, objects: [{ name: "Mug", type: "MESH", tris: 980 }] }) }; }
    return { code: 0, out: "@@JSON@@" + JSON.stringify({ pass: true, errors: [], warnings: ["Mug: 2 loose verts"] }) };
  });
  llmCalls = [];
  const m1 = await K.model({ ask: "a coffee mug", script: "import bpy\nme = bpy.data.meshes.new('Broken'); me.nope()\n", blend: scene });
  const run1 = calls[0];
  check("✨ the script runs on a COPY: Blender opens the scene, the runner saves a NEW .blend in the project's blender/scenes (room_ai.blend), never the scene", run1[1] === scene && run1.includes("--mode") && run1[run1.indexOf("--out") + 1] === path.join(tmp, "scenes", "room_ai.blend") && fs.readFileSync(scene, "utf8") === "BLENDER" && /blend_skill_run\.py$/.test(run1[run1.indexOf("-P") + 1]) && run1.includes("--factory-startup"), run1);
  check("...it failed: the traceback went back to the LLM, the fix ran (2 tries), then the skills' qa_check on the result; the preview + objects back", m1.ok && m1.tries.length === 2 && /AttributeError/.test(m1.tries[0].error) && m1.tries[1].error === null && /Fixed/.test(m1.script) && llmCalls.length === 1 && /failed in Blender:\n[\s\S]*AttributeError/.test(llmCalls[0][3].content)
    && m1.path === path.join(tmp, "scenes", "room_ai.blend") && fs.existsSync(m1.preview) && m1.objects[0].name === "Mug" && m1.qa && m1.qa.warnings[0] === "Mug: 2 loose verts" && /qa_check\.py$/.test(calls[2][calls[2].indexOf("-P") + 1]), m1);
  llmCalls = []; calls.length = 0;
  const m2 = await K.model({ ask: "a coffee mug", script: "import bpy\nimport os\n" });
  check("...a refused script never reaches Blender: the LLM is told why and its fix is checked again; no scene = an empty one (ai_model_ai.blend)", m2.ok && m2.tries[0].error === "refused: imports os" && /Clean/.test(m2.script) && calls[0][1] === "--factory-startup" && /ai_model_ai\.blend$/.test(m2.path), { m2, c: calls[0] });
  K.setComplete(async () => ({ ok: true, text: "```python\nimport bpy\nme = bpy.data.meshes.new('Broken')\n```" })); calls.length = 0;
  const m3 = await K.model({ ask: "a mug", script: "import bpy\nme = bpy.data.meshes.new('Broken')\n" });
  check("...3 tries at most, then said (no file left behind)", !m3.ok && m3.tries.length === 3 && /after 3 tries/.test(m3.error) && calls.length === 3 && !fs.existsSync(path.join(tmp, "scenes", "ai_model_ai (2).blend")), m3);
  K.setExe(() => ({ exe: "/b/blender", version: "4.2.0" })); let e1 = null; try { await K.model({ ask: "x", script: "import bpy\n" }); } catch (e) { e1 = e; }
  check("...an old Blender = HTTP 412 with the Download box's words, nothing run", e1 && e1.status === 412 && e1.need && /too old/.test(e1.need.why));
  K.setExe(() => ({ exe: "/b/blender", version: "5.3.0" }));
  // 🧰 the tools
  calls.length = 0;
  K.setRun((exe, args) => { calls.push(args); const s = args.indexOf("--save"); if (s > 0) fs.writeFileSync(args[s + 1], "B"); const o = args.indexOf("--out"); if (o > 0 && /\.(fbx|glb)$/.test(args[o + 1])) fs.writeFileSync(args[o + 1], "F"); return { code: 0, out: "@@JSON@@" + JSON.stringify({ ok: true, lods: {} }) }; });
  const t1 = await K.tool({ tool: "lods", blend: scene, args: { objects: "Mug Handle", ratios: "0.5 0.2" } });
  const a1 = calls[0];
  check("🧰 LODs: the skill's own make_lods.py on the scene, its arguments, saved as a new room_lods.blend", t1.ok && /make_lods\.py$/.test(a1[a1.indexOf("-P") + 1]) && a1.join(" ").includes("-- --objects Mug Handle --ratios 0.5 0.2 --cleanup --save") && t1.path === path.join(tmp, "scenes", "room_lods.blend"), a1);
  const t2 = await K.tool({ tool: "export", blend: scene, args: { preset: "godot" } });
  check("🧰 Export for Godot: a .glb in the project's export folder, the scene not re-saved", t2.ok && t2.exported === path.join(tmp, "export", "room.glb") && !calls[1].includes("--save") && calls[1].includes("godot"), { t2, a: calls[1] });
  await K.tool({ tool: "bake", blend: scene, args: { low: "Mug", maps: "normal ao" } });
  check("🧰 Bake: the textures written in the project (scenes/textures), not beside the scene", calls[2][calls[2].indexOf("--out") + 1] === path.join(tmp, "scenes", "textures"), calls[2]);
  const bads = [["lods", { ratios: "half" }], ["uv", { method: "magic" }], ["lods", { objects: "--save /etc/x" }], ["bake", { low: "-x" }], ["nope", {}]];
  const refused = []; for (const [t, a] of bads) { try { await K.tool({ tool: t, blend: scene, args: a }); } catch (e) { refused.push(e.message); } }
  check("🧰 values checked: numbers, the choices, no name starting with - (no extra switches), an unknown tool", refused.length === 5 && /numbers only/.test(refused[0]) && /one of smart/.test(refused[1]) && /cannot start with -/.test(refused[2]) && /cannot start with -/.test(refused[3]) && /no tool/.test(refused[4]), refused);
  let e2 = ""; try { await K.tool({ tool: "lods", blend: "" }); } catch (e) { e2 = e.message; }
  check("🧰 needs an open scene", /open a Blender scene first/.test(e2));
  check("the tool list for the page: 9 tools, each with its sheet and fields", K.list().tools.length === 9 && K.list().tools.every((t) => t.fields.length && t.skill) && K.list().skills.length === 28);
  fs.rmSync(tmp, { recursive: true, force: true });
  /* ---- the runner + wiring */
  const RN = src("scripts/blend_skill_run.py");
  check("the runner: a safe __import__ (the same list), no open / eval / exec / compile, saves a COPY (save_as_mainfile copy=True), a Workbench preview from a framing camera", /def safe_import/.test(RN) && /BLOCK = \{"open", "eval", "exec", "compile"/.test(RN) && /save_as_mainfile\(filepath=o\["out"\], copy=True\)/.test(RN) && /BLENDER_WORKBENCH/.test(RN)
    && [...K.ALLOW].every((m) => RN.includes('"' + m + '"')));
  const R = src("routes/blendSkills.js");
  check("routes/blendSkills.js mounted from routes/index.js (not server.js); the preview only from the project's blender folder", /require\("\.\/blendSkills"\)\.mount\(app\)/.test(src("routes/index.js")) && /app\.post\("\/api\/blendskills\/model"/.test(R) && /app\.post\("\/api\/blendskills\/tool"/.test(R) && /startsWith\(d \+ path\.sep\)/.test(R) && !/blendSkills/.test(src("misc/server.js")));
  check("NOTICE + credits name blender-skills (MIT)", /blender-skills[\s\S]{0,200}MIT/.test(src("misc/NOTICE.md")) && /"name": "blender-skills"/.test(src("lib/credits.json")));
  const BL = require(path.join(ROOT, "ext/imageeditdock/pcblendlayer.js"));
  const mi = BL.menuItems({ ai: true, has: true, open: true }), m0 = BL.menuItems({});
  check("the 🟧 ▾ menu: ✨ Model with AI… + 🧰 Blender tools… (tools need an open scene) when the skills are there - the menu without them as before", mi.some((x) => x.k === "ai") && mi.find((x) => x.k === "skilltools") && !mi.find((x) => x.k === "skilltools").off && BL.menuItems({ ai: true }).find((x) => x.k === "skilltools").off && m0.map((x) => x.k).join() === "new,open,save,import", mi.map((x) => x.k));
  check("pcblendai.js after pcblendlayer.js in ext.json and installed", /"pcblendlayer\.js"[^\]]*"pcblendai\.js"/.test(src("ext/imageeditdock/ext.json")) && /PCBlendAi\.install\(E\)/.test(src("ext/imageeditdock/imageedit.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

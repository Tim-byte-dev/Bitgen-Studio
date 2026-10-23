#!/usr/bin/env node
/* bitGen Studio — scripts/test-cadgen581.js (2.581.0): ✨ Generate in the 📐 SolidCraft docker - lib/cadGen.js (the
 * engines, the repair loop, the files, the add-on), routes/cadGen.js, ext/solidcraftdock/scgen.js (resolve / volumeOk).
 * The worker and the LLM are stood in (setDeps) - no Python, no model. cad_worker.py itself: scripts/test-cadworker581.py. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const CG = require("../lib/cadGen");
const GEN = require("../ext/solidcraftdock/scgen.js");
const core = require("../lib/core");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (id) => { for (let i = 0; i < 200; i++) { const j = CG.job(id); if (j && j.state !== "running") return j; await sleep(10); } return CG.job(id); };

(async () => {
  /* pure */
  check("extractCode: the ```python block that builds with cadquery (the last one), else from `import cadquery`",
    CG.extractCode("Here:\n```python\nimport cadquery as cq\nresult = cq.Workplane().box(1,1,1)\n```\nok") === "import cadquery as cq\nresult = cq.Workplane().box(1,1,1)\n"
    && CG.extractCode("```\nx=1\n```\n```py\nimport cadquery as cq\nr=1\n```") === "import cadquery as cq\nr=1\n" && CG.extractCode("Sure! import cadquery as cq\nresult=1") === "import cadquery as cq\nresult=1\n");
  const m = CG.cadPrompt("a 20 mm cube", "a grey block with a hole");
  check("cadPrompt: the CadQuery rules (mm, Z up, editable steps, `result`, one code block) + the picture's description + the ask",
    m[0].role === "system" && /millimetres, Z is up/.test(m[0].content) && /variable named `result`/.test(m[0].content) && /ONLY the code/.test(m[0].content) && /Avoid revolve, loft/.test(m[0].content)
    && /A picture of the part shows: a grey block with a hole\nMake this part: a 20 mm cube/.test(m[1].content));
  const rp = CG.repairPrompt("a cube", "bad()", "NameError: bad");
  check("repairPrompt: the failing code as the assistant's answer, then the error to fix", rp[2].role === "assistant" && /bad\(\)/.test(rp[2].content) && /That code failed: NameError: bad/.test(rp[3].content));
  check("slug + parseLines", CG.slug("A 60 x 40 Mounting-Plate!") === "a_60_x_40_mounting_plate" && CG.slug("") === "part"
    && JSON.stringify(CG.parseLines(["x", 'CADCODE "import cadquery"', 'CADRESULT {"ok":true,"volume":5}'])) === JSON.stringify({ code: "import cadquery", result: { ok: true, volume: 5 } }));
  check("scgen resolve: {$curves: [keys]} -> the curve ids those commands made (created.curves), nested anywhere",
    JSON.stringify(GEN.resolve({ sketch: "S", profiles: [{ curves: { $curves: ["k1", "k2"] } }], d: 5 }, { k1: { created: { curves: ["l1"] } }, k2: { curves: ["a1", "l2"] } }))
      === JSON.stringify({ sketch: "S", profiles: [{ curves: ["l1", "a1", "l2"] }], d: 5 }));
  check("scgen volumeOk: within 1 % of CadQuery's volume, never 0", GEN.volumeOk(1005, 1000) && !GEN.volumeOk(1020, 1000) && !GEN.volumeOk(0, 0) && !GEN.volumeOk(5, 0));

  /* jobs with the worker + the LLM stood in */
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "cg581-"));
  const realPDir = core.pDir;
  core.pDir = (k) => { const d = path.join(T, "projects", "p", k); fs.mkdirSync(d, { recursive: true }); return d; };
  const calls = { run: [], complete: [], describe: [] };
  let runAnswers = [], llmAnswers = [];
  CG.setDeps({
    run: async (args, log) => {
      calls.run.push(args);
      const code = args[0] === "run" ? fs.readFileSync(args[args.indexOf("--code") + 1], "utf8") : "";
      const ans = runAnswers.shift() || { ok: true, volume: 100, editable: true, commands: [{ id: "sketch.create", params: {} }], features: 1, step: "x.step", obj: "x.obj" };
      if (args[0] === "cadrille") log('CADCODE "import cadquery as cq\\nresult=1\\n"');
      log("worker says hi");
      log("CADRESULT " + JSON.stringify(typeof ans === "function" ? ans(code) : ans));
      return 0;
    },
    complete: async (messages) => { calls.complete.push(messages); const a = llmAnswers.shift(); return a == null ? { ok: false, error: "no LLM" } : { ok: true, text: a }; },
    describe: async (abs) => { calls.describe.push(abs); return "a round flange with six bolt holes"; },
  });
  try {
    // the LLM writes code that fails, then fixes it
    llmAnswers = ["```python\nimport cadquery as cq\nresult = cq.Workplane().bxo(1,1,1)\n```", "```python\nimport cadquery as cq\nresult = cq.Workplane().box(10,10,10)\n```"];
    runAnswers = [(code) => ({ ok: false, error: "AttributeError: 'Workplane' object has no attribute 'bxo'", where: "line 2", stage: "run" }),
                  { ok: true, volume: 1000, editable: true, commands: [{ id: "sketch.create" }], features: 1, step: "a_10_mm_cube.step", obj: "a_10_mm_cube.obj" }];
    let s = CG.start({ prompt: "a 10 mm cube", engine: "llm" });
    check("start: a job, the name from the description, the engine asked", s.ok && s.name === "a_10_mm_cube" && s.engine === "llm", s);
    let j = await until(s.id);
    check("the LLM's code ran, failed, went back with the error, the fixed code ran - done", j.state === "done" && calls.complete.length === 2 && /bxo/.test(calls.complete[1][3].content) && calls.run.length === 2 && /box\(10,10,10\)/.test(j.code), j);
    const sc = path.join(T, "projects", "p", "solidcraft");
    check("...the code + the answer kept in the project (solidcraft/ai/<name>.py / .json), the worker told to write the STEP into solidcraft/",
      fs.existsSync(path.join(sc, "ai", "a_10_mm_cube.py")) && JSON.parse(fs.readFileSync(path.join(sc, "ai", "a_10_mm_cube.json"), "utf8")).result.volume === 1000
      && calls.run[1].join(" ").indexOf("--out " + sc) > 0 && /editable features/.test(j.lines.join("\n")), calls.run[1]);
    check("one at a time", (() => { llmAnswers = ["```python\nimport cadquery as cq\nresult=1\n```"]; const a = CG.start({ prompt: "x", engine: "llm" }); const b = CG.start({ prompt: "y", engine: "llm" }); return a.ok && /one at a time/.test(b.error || ""); })());
    await until(CG.job().id);
    // still failing after the repairs -> error with the last code
    calls.complete.length = 0; calls.run.length = 0;
    llmAnswers = ["```python\nimport cadquery as cq\nresult = 1/0\n```", "```python\nimport cadquery as cq\nresult = 2/0\n```", "```python\nimport cadquery as cq\nresult = 3/0\n```"];
    runAnswers = [{ ok: false, error: "ZeroDivisionError", stage: "run" }, { ok: false, error: "ZeroDivisionError", stage: "run" }, { ok: false, error: "ZeroDivisionError again", stage: "run" }];
    j = await until(CG.start({ prompt: "a broken thing", engine: "llm" }).id);
    check("a part still failing after " + CG.REPAIRS + " repairs: an error, the last code there to ✎ edit", j.state === "error" && /again/.test(j.error) && calls.run.length === 1 + CG.REPAIRS && /3\/0/.test(j.code), j);
    // ✎ edited code: run as it is, never 'repaired'
    calls.complete.length = 0; calls.run.length = 0;
    runAnswers = [{ ok: false, error: "SyntaxError", stage: "check" }];
    j = await until(CG.start({ code: "import cadquery as cq\nresult = (", name: "mine" }).id);
    check("▶ Run again (your code): run as it is - its error comes back, the LLM is not asked", j.engine === "code" && j.state === "error" && /SyntaxError/.test(j.error) && calls.complete.length === 0 && calls.run.length === 1, j);
    // a picture with the LLM: described first
    const pic = path.join(T, "flange.png"); fs.writeFileSync(pic, "png");
    llmAnswers = ["```python\nimport cadquery as cq\nresult = cq.Workplane().circle(30).extrude(8)\n```"]; runAnswers = [];
    j = await until(CG.start({ prompt: "", image: pic, engine: "llm" }).id);
    const lastAsk = calls.complete[calls.complete.length - 1];
    check("a picture + the local LLM: the vision model describes it, the description goes into the ask; named after the picture",
      j.state === "done" && calls.describe[0] === pic && /A picture of the part shows: a round flange with six bolt holes/.test(lastAsk[1].content) && j.name === "flange", { j: j.name, ask: lastAsk[1].content });
    // cadrille: the worker writes + runs; a run error goes to the LLM
    calls.run.length = 0; calls.complete.length = 0;
    runAnswers = [{ ok: false, error: "ValueError: no pending wires", stage: "run" }, { ok: true, volume: 5, editable: false, reason: "revolve is not rebuilt", step: "c.step", commands: [] }];
    llmAnswers = ["```python\nimport cadquery as cq\nresult = cq.Workplane().box(1,1,1)\n```"];
    j = await until(CG.start({ prompt: "a pulley", engine: "cadrille" }).id);
    check("cadrille: the worker's cadrille step (--text), its code kept; its code failing goes to the LLM to fix",
      calls.run[0][0] === "cadrille" && calls.run[0].indexOf("--text") > 0 && calls.run[0][calls.run[0].indexOf("--text") + 1] === "a pulley" && calls.complete.length === 1 && /no pending wires/.test(calls.complete[0][3].content)
      && j.state === "done" && j.result.editable === false, { run: calls.run, j });
    // Auto with cadrille failing to load: the local LLM instead; asked for cadrille by name: the error
    calls.run.length = 0; calls.complete.length = 0;
    runAnswers = [{ ok: false, error: "cadrille: OutOfMemoryError: CUDA out of memory", stage: "model" }, { ok: true, volume: 8, editable: true, commands: [{ id: "x" }], features: 1, step: "s.step" }];
    llmAnswers = ["```python\nimport cadquery as cq\nresult = cq.Workplane().box(2,2,2)\n```"];
    const FB = fs.mkdtempSync(path.join(os.tmpdir(), "cg581c-"));     // a CAD generate install WITH cadrille (marker files)
    fs.mkdirSync(path.dirname(path.join(FB, "cadgen", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")), { recursive: true });
    fs.writeFileSync(path.join(FB, "cadgen", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"), "");
    for (const f of ["runner.ok", "cadrille.ok"]) fs.writeFileSync(path.join(FB, "cadgen", f), "x");
    CG.setBase(FB);
    check("status: cadrille installed -> Auto's engine", CG.status().cadrille && CG.status().runner);
    j = await until(CG.start({ prompt: "a small cube", engine: "auto" }).id);
    check("Auto: cadrille failing to run (out of GPU memory) -> the local LLM writes the part instead, said in the log",
      j.state === "done" && j.engine === "llm" && calls.run[0][0] === "cadrille" && calls.complete.length === 1 && /the local LLM writes the part instead/.test(j.lines.join("\n")), { e: j.engine, run: calls.run.map((r) => r[0]), lines: j.lines });
    runAnswers = [{ ok: false, error: "cadrille: OutOfMemoryError", stage: "model" }];
    j = await until(CG.start({ prompt: "a small cube", engine: "cadrille" }).id);
    check("...cadrille picked by name: its error, the LLM not asked", j.state === "error" && /OutOfMemory/.test(j.error), j);
    CG.setBase(null); fs.rmSync(FB, { recursive: true, force: true });
    check("start refuses: nothing asked / a picture that is not there",
      /describe the part/.test(CG.start({ prompt: " " }).error || "") && /not there/.test(CG.start({ prompt: "x", image: path.join(T, "nope.png") }).error || ""));
    check("a second part with the same name gets _2 (the first is kept)", (() => { fs.writeFileSync(path.join(sc, "dup.step"), "x"); const r = CG.start({ code: "import cadquery as cq\nresult=1", name: "dup" }); return r.name === "dup_2"; })());
    await until(CG.job().id);
  } finally {
    CG.setDeps(null); core.pDir = realPDir;
    fs.rmSync(T, { recursive: true, force: true });
  }

  /* the add-on */
  CG.setBase(fs.mkdtempSync(path.join(os.tmpdir(), "cg581b-")));
  const st = CG.addonStatus();
  check("the add-on: CadQuery (needed) + cadrille (CC BY-NC 4.0, ticked), not installed yet",
    !st.installed && st.items.length === 2 && st.items[0].need && st.items[0].id === "runner" && /CC BY-NC 4\.0/.test(st.items[1].label) && st.items[1].dflt && !st.items[1].present);
  check("not installed: ✨ Generate says where to install it", /Settings ▸ Add-ons ▸ CAD generate/.test(CG.start({ prompt: "x" }).error || ""));
  const A = require("../lib/addons").list().find((x) => x.id === "cadgen");
  check("Settings ▸ Add-ons lists CAD generate with its items and the licence", A && A.items.length === 2 && /CC BY-NC 4\.0/.test(A.needs) && /SolidCraft/.test(A.label));
  CG.setBase(null);

  /* the wiring */
  const R = path.join(__dirname, "..");
  const ix = fs.readFileSync(path.join(R, "routes", "index.js"), "utf8"), sv = fs.readFileSync(path.join(R, "server.js"), "utf8");
  const ext = JSON.parse(fs.readFileSync(path.join(R, "ext", "solidcraftdock", "ext.json"), "utf8"));
  const g = fs.readFileSync(path.join(R, "ext", "solidcraftdock", "scgen.js"), "utf8");
  check("wired: routes/cadGen mounted in routes/index.js (not server.js), scgen.js in the docker's scripts, cad_worker.py beside the other workers",
    /require\("\.\/cadGen"\)\.mount\(app\)/.test(ix) && !/cadGen/.test(sv) && ext.scripts.indexOf("scgen.js") > ext.scripts.indexOf("scbridge.js") && fs.existsSync(path.join(R, "cad_worker.py")));
  check("the docker: the replay checks SolidCraft's volume and falls back to the STEP (file.insert_step) at the checkpoint",
    /edit\.checkpoint/.test(g) && /edit\.restore_checkpoint/.test(g) && /sc\.insertFile\(r\.step/.test(g) && /volumeOk\(got, r\.volume\)/.test(g) && /inspect\.measure/.test(g));
  check("routes/cadGen extOf: png / jpeg / webp only", require("../routes/cadGen").extOf("image/png") === "png" && require("../routes/cadGen").extOf("image/jpg") === "jpeg" && require("../routes/cadGen").extOf("image/gif") === "");

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

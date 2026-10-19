#!/usr/bin/env node
/* bitGen Studio — 2.527.0 units: 🩺 THE STYLE DOCTOR - lib/styleDoctor.js (why a job failed, the test picture out of the
 * gallery, the report, the reference picture for edit styles), static/styledoctor.js's pure parts, the routes.
 * From the recommendations Tim asked to be worked through: "one click makes a tiny test picture with every style and
 * shows a pass/fail table with the failing log line" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

const T = fs.mkdtempSync(path.join(os.tmpdir(), "sd527-")), PROJ = path.join(T, "projects", "p1");
for (const d of ["images", "output"]) fs.mkdirSync(path.join(PROJ, d), { recursive: true });
const jobs = new Map();
const stub = (rel, exp) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports: exp }; };
stub("../lib/core.js", { BASE: T, STYLES_DIR: path.join(T, "styles"), getProject: () => "p1", projDir: () => PROJ, pDir: (k) => path.join(PROJ, k), outputDirs: () => [PROJ, path.join(PROJ, "output")], jobs });
stub("../lib/styles.js", {
  read: () => [{ id: "a", name: "SDXL", arch: "sdxl" }, { id: "b", name: "Qwen Edit", arch: "qwen-image" }, { id: "c", name: "Chain", chain: true }, { id: "d", name: "Song", kind: "music" }, { id: "e", name: "No Workflow", arch: "flux" }],
  missingSlots: (s) => (s.id === "e" ? ["workflow"] : []), imageSlots: (s) => (s.id === "b" ? 2 : 0) });
const D = require("../lib/styleDoctor.js");
const SD = require("../static/styledoctor.js");

/* ---- why it failed */
const krea = ["[worker] ERROR: ComfyUI rejected the workflow:", "Prompt outputs failed validation", "  node 70: Value not in list [unet_name] = Krea2/jibMixKrea_v60CarolinaReaper.safetensors",
  "    unet_name: 'Krea2/jibMixKrea_v60CarolinaReaper.safetensors' not in (list of length 72)", "[bitgen-studio] worker exited with code 1."];
let x = D.explain(krea);
check("Tim's Krea log: 'a model ComfyUI does not list' - the line with the list length, put it in models/diffusion_models", x.kind === "model" && /node 70: Value not in list \[unet_name\]/.test(x.line) && /list of length 72/.test(x.line) && /diffusion_models/.test(x.advice), x);
check("…a LoRA -> models/loras, a VAE -> models/vae, a text encoder -> models/text_encoders", /models\/loras/.test(D.explain("node 9: Value not in list [lora_name] = x.safetensors").advice) && /models\/vae/.test(D.explain("node 9: Value not in list [vae_name] = v.safetensors").advice) && /text_encoders/.test(D.explain("node 9: Value not in list [clip_name1] = t5.safetensors").advice));
check("a missing node pack (named)", (x = D.explain("[worker] ERROR: ComfyUI does not have these node types: UnetLoaderGGUF. Install the node pack")).kind === "nodes" && /UnetLoaderGGUF/.test(x.advice), x);
check("ComfyUI not running", D.explain("cannot reach ComfyUI at http://127.0.0.1:8188 (refused)").kind === "comfy");
check("out of VRAM", D.explain("torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 2 GiB").kind === "vram");
check("a half-downloaded file", D.explain("safetensors_rust.SafetensorError: Error while deserializing header: HeaderTooLarge").kind === "file");
check("a text encoder that does not fit", D.explain("RuntimeError: mat1 and mat2 shapes cannot be multiplied (77x768 and 4096x3072)").kind === "mismatch");
check("a workflow older than its nodes", D.explain("node 91: Required input is missing [resolution_steps]").kind === "input");
x = D.explain(["Traceback (most recent call last):", "  File \"x.py\", line 3", "KeyError: 'samples'", "[bitgen-studio] worker exited with code 1."]);
check("a worker crash: the error line, not 'exited with code 1'", x.kind === "crash" && /KeyError: 'samples'/.test(x.line), x);
check("nothing known: the last error-ish line", (x = D.explain(["ok", "ERROR: something odd happened", ""])).kind === "unknown" && /something odd/.test(x.line), x);

/* ---- the styles */
const L = D.list();
check("the styles: image ones only (no music), sorted, a chain style skipped, an incomplete one's missing slots, an edit style's picture slots",
  L.map((s) => s.name).join() === "Chain,No Workflow,Qwen Edit,SDXL" && L.find((s) => s.id === "c").skip && L.find((s) => s.id === "e").missing[0] === "workflow" && L.find((s) => s.id === "b").slots === 2, L);

/* ---- the render body (the docker) */
const q = SD.body({ id: "a", slots: 0 }, "quick", ""), r = SD.body({ id: "b", slots: 2 }, "real", "_ref.png");
check("Quick: 512 × 512, 4 steps, a fixed seed and prompt; Real: the style's own (no size / steps sent)", q.width === 512 && q.height === 512 && q.steps === 4 && q.seed === 1234567 && q.prompt === SD.PROMPT && r.width === undefined && r.steps === undefined, { q, r });
check("an edit style is given the test picture", JSON.stringify(r.images) === '["_ref.png"]' && q.images === undefined);
check("summary / fmtSecs", JSON.stringify(SD.summary([{ status: "ok" }, { status: "fail" }, { status: "ok" }, { status: "skip" }])) === JSON.stringify({ ok: 2, fail: 1, skip: 1, stopped: 0 }) && SD.fmtSecs(3.14) === "3.1 s" && SD.fmtSecs(125) === "2 m 5 s");

/* ---- the reference picture */
const png = D.makePng(64, 48);
check("makePng: a real PNG (signature, IHDR size)", png.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && png.readUInt32BE(16) === 64 && png.readUInt32BE(20) === 48);
check("ensureRef: in the Image assets (genimage takes pictures from there); removeRef takes it away", D.ensureRef() === D.REF && fs.existsSync(path.join(PROJ, "images", D.REF)) && D.removeRef() && !fs.existsSync(path.join(PROJ, "images", D.REF)));

/* ---- collect: the test picture out of the gallery + the Image assets */
const out = path.join(PROJ, "output", "20261018_s1_abc.png");
fs.writeFileSync(out, png); fs.linkSync(out, path.join(PROJ, "images", "20261018_s1_abc.png"));
fs.writeFileSync(path.join(PROJ, "images", "mine.png"), png);
jobs.set("j1", { id: "j1", output: "20261018_s1_abc.png", outputs: ["20261018_s1_abc.png"], log: [] });
const c = D.collect("j1", "a");
check("collect: the picture moves to doctor/<style>.png; it leaves the gallery and its Image asset (the hard link); your own assets stay",
  c.thumb === "a.png" && fs.existsSync(path.join(PROJ, "doctor", "a.png")) && !fs.existsSync(out) && !fs.existsSync(path.join(PROJ, "images", "20261018_s1_abc.png")) && fs.existsSync(path.join(PROJ, "images", "mine.png")), c);
check("…an unknown job = 404, a bad style id = 400", (() => { try { D.collect("nope", "a"); return false; } catch (e) { return e.status === 404; } })() && (() => { try { jobs.set("j2", { id: "j2", log: [] }); D.collect("j2", "../.."); return false; } catch (e) { return e.status === 400; } })());

/* ---- the report */
const rep = D.saveReport({ mode: "quick", rows: [{ id: "a", name: "SDXL", status: "ok", secs: 3.14159, thumb: "a.png" }, { id: "k", name: "Krea | 2", status: "fail", kind: "model", line: "x".repeat(900), advice: "do y" }, { id: "z", status: "evil" }] });
check("saveReport: cleaned (secs rounded, long lines cut, a bad status -> stopped) and kept", rep.rows[0].secs === 3.1 && rep.rows[1].line.length === 400 && rep.rows[2].status === "stopped" && D.loadReport().rows.length === 3);
const md = D.toMarkdown(D.loadReport(), "2.527.0");
check("the .md: the counts, a row per style, a | in a name cannot break the table", /# Style doctor/.test(md) && /\*\*1 work · 1 failed · 0 skipped\*\*/.test(md) && /\| SDXL \| ✓ works \| 3.1 s \|/.test(md) && /Krea \/ 2/.test(md), md.slice(0, 400));
check("clearReport: the run and its pictures go", D.clearReport() >= 2 && D.loadReport() === null);

/* ---- the routes */
const express = require("express");
const app = express(); app.use(express.json()); require("../routes/styleDoctor.js").mount(app);
jobs.set("jk", { id: "jk", log: krea });
const srv = app.listen(0, "127.0.0.1", async () => {
  const U = "http://127.0.0.1:" + srv.address().port;
  const j = async (u, b, m) => { const x2 = await fetch(U + u, b === undefined && !m ? {} : { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: x2.status, b: await x2.json().catch(() => null) }; };
  try {
    check("GET /api/doctor/styles", (await j("/api/doctor/styles")).b.length === 4);
    check("GET /api/doctor/explain/:job (the job's own log)", (await j("/api/doctor/explain/jk")).b.kind === "model" && (await j("/api/doctor/explain/nope")).s === 404);
    check("POST /api/doctor/ref + /ref/remove", (await j("/api/doctor/ref", {})).b.name === D.REF && (await j("/api/doctor/ref/remove", {})).b.ok === true);
    check("POST + GET + DELETE /api/doctor/report", (await j("/api/doctor/report", { rows: [{ id: "a", name: "A", status: "ok" }] })).b.rows.length === 1 && (await j("/api/doctor/report")).b.rows.length === 1 && (await j("/api/doctor/report", undefined, "DELETE")).s === 200 && (await j("/api/doctor/report")).b.rows.length === 0);
    const m2 = await fetch(U + "/api/doctor/report.md");
    check("GET /api/doctor/report.md: a download", m2.ok && /attachment/.test(m2.headers.get("content-disposition") || "") && /# Style doctor/.test(await m2.text()));
    check("GET /api/doctor/thumb: no climbing out", (await fetch(U + "/api/doctor/thumb/" + encodeURIComponent("../output/x.png"))).status === 404);
  } catch (e) { check("the routes ran", false, String(e && e.stack || e)); }
  srv.close(); fs.rmSync(T, { recursive: true, force: true });
  const root = path.join(__dirname, "..");
  check("pins: routes/styleDoctor.js mounted from routes/index.js (not server.js)", /require\("\.\/styleDoctor"\)\.mount\(app\)/.test(fs.readFileSync(path.join(root, "routes", "index.js"), "utf8")) && !/styleDoctor/.test(fs.readFileSync(path.join(root, "server.js"), "utf8")));
  check("pins: index.html loads static/styledoctor.js", fs.readFileSync(path.join(root, "static", "index.html"), "utf8").includes('<script src="/static/styledoctor.js"></script>'));
  check("pins: the 🧪 checklist has the 2.527 group", JSON.parse(fs.readFileSync(path.join(root, "lib", "testPlan.json"), "utf8")).groups.some((g) => g.id === "g527"));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});

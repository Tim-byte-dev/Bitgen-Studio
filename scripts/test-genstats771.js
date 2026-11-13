#!/usr/bin/env node
/* bitGen Studio — 2.771.0 unit test: 📊 THE STATISTICS DIALOG's figures (lib/genStats.js, static/statsdlg.js pure part, the
 * hooks in lib/core.js / lib/podPrep.js / lib/stylePods.js, routes/genStats.js).
 * Tim (verbatim): "record the time it takes to prepare a pod for generation each time it needs new uploads or restarts etc.
 * record generation for each generation separately - show user startup time, generation time and total time" + "statistics
 * go is Statistics Dialog"
 * Files go to a temporary folder (H3_USAGE_DIR) - the tree's usage/ is never touched. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "gs771-"));
process.env.H3_USAGE_DIR = TMP;
const ROOT = path.join(__dirname, "..");
const G = require("../lib/genStats");
const D = require("../static/statsdlg.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---- whereOf */
check("whereOf: no _ranOn = this computer", G.whereOf({ params: {} }).where === "local");
check("whereOf: an API_ style", G.whereOf({ _ranOn: { label: "API_fal (Settings ▸ API)", api: true }, params: { style: { api_id: "ab12cd34" } } }).where === "api"
  && G.whereOf({ _ranOn: { api: true }, params: { style: { api_id: "ab12cd34" } } }).api_id === "ab12cd34");
check("whereOf: a pod job (params.pod_job) = runpod + its pod", (() => { const w = G.whereOf({ _ranOn: { mode: "runpod", label: "RunPod pod p1" }, params: { pod_job: { pod_id: "p1", port: 8188 } } }); return w.where === "runpod" && w.pod === "p1"; })());
check("whereOf: a P_ style's pod", G.whereOf({ params: { style: { runs_on: "pod", pod_id: "p9" } } }).pod === "p9");
check("whereOf: a remote GPU address", (() => { const w = G.whereOf({ _ranOn: { mode: "url", label: "my server" }, params: {} }); return w.where === "url" && w.label === "my server"; })());

/* ---- entryFor: startup / generation / total */
const T = 1_800_000_000;   // seconds
const job = { id: "j1", project: "p", status: "done", created: T, started: T + 30, finished: T + 100, _prepAt: (T + 10) * 1000, _genAt: (T + 40) * 1000,
  params: { mode: "image", style_name: "Krea 2", prompt: "a  cat\non a mat", pod_job: { pod_id: "pp1" } }, _ranOn: { mode: "runpod", label: "RunPod pod pp1" } };
const e = G.entryFor(job, [{ at: (T + 12) * 1000, ms: 15000, kind: "prepare", phases: { download: 12000, check: 3000 } }]);
check("entryFor: queued = created -> the head of the queue (10 s)", e.queued_ms === 10000, e);
check("entryFor: startup = the head of the queue -> ComfyUI handed the workflow (30 s)", e.startup_ms === 30000, e);
check("entryFor: generation = handed -> finished (60 s)", e.gen_ms === 60000, e);
check("entryFor: total = startup + generation (90 s)", e.total_ms === 90000, e);
check("entryFor: where / pod / what / prompt one line / the preps it waited for", e.where === "runpod" && e.pod === "pp1" && e.what === "Krea 2" && e.prompt === "a cat on a mat" && e.preps.length === 1 && e.preps[0].phases.download === 12000, e);
const loc = G.entryFor({ id: "j2", status: "done", created: T, started: T + 5, finished: T + 65, params: { mode: "t2va" } });
check("entryFor: a local job with no [meta] line - startup 0 (no pod gate), generation = the run", loc.startup_ms === 0 && loc.gen_ms === 60000 && loc.queued_ms === 5000 && loc.where === "local", loc);
const loc2 = G.entryFor({ id: "j3", status: "done", created: T, started: T + 5, finished: T + 65, _genAt: (T + 20) * 1000, params: { mode: "image" } });
check("entryFor: a local job - startup = worker start -> /prompt (ComfyUI started, graph built)", loc2.startup_ms === 15000 && loc2.gen_ms === 45000 && loc2.total_ms === 60000, loc2);
const never = G.entryFor({ id: "j4", status: "failed", created: T, started: null, finished: T + 50, _prepAt: (T + 2) * 1000, params: { mode: "image" } });
check("entryFor: a job its pod stopped before it ran - startup only, marked", never.startup_ms === 48000 && never.gen_ms === 0 && never.never_started === true, never);
const ap = G.entryFor({ id: "j5", status: "done", created: T, started: T + 1, finished: T + 31, _apiUsd: 0.04, _ranOn: { api: true, label: "API_x" }, params: { mode: "image", style: { api_id: "k1" } } });
check("entryFor: an API_ render - the whole run is generation, its price kept", ap.gen_ms === 30000 && ap.api_usd === 0.04 && ap.api_id === "k1", ap);

/* ---- onLine / prepMark */
const j = {};
G.onLine(j, "[comfy] loading"); check("onLine: an ordinary line marks nothing", !j._genAt);
G.onLine(j, '[meta] {"seed":1}'); const g1 = j._genAt; check("onLine: the first [meta] line marks ComfyUI being handed the workflow", g1 > 0);
G.onLine(j, '[meta] {"seed":2}'); check("onLine: a later [meta] line (a second prompt) keeps the first moment", j._genAt === g1);
G.onLine(j, "[api] OpenRouter: about $0.012 for this"); G.onLine(j, "[api] OpenRouter: about $0.008 for this");
check("onLine: the worker's \"[api] … about $x\" lines add up", Math.abs(j._apiUsd - 0.02) < 1e-9, j._apiUsd);
const q = {}; G.prepMark(q); const p1 = q._prepAt; G.prepMark(q); check("prepMark: once (the first time a pod gate holds the job)", p1 > 0 && q._prepAt === p1);

/* ---- phases */
check("phaseOf: the notes podPrep says", G.phaseOf("downloading on the pod: a.safetensors") === "download" && G.phaseOf("installing node packs on the pod: X") === "nodes"
  && G.phaseOf("restarting the pod's ComfyUI for the new node packs") === "restart" && G.phaseOf("the pod's ComfyUI answers but lists no nodes - repairing it") === "repair"
  && G.phaseOf("ComfyUI on the pod is updated to 0.4") === "update" && G.phaseOf("sending x.safetensors from this computer") === "send"
  && G.phaseOf("linked into the folders the pod's ComfyUI reads: a") === "link" && G.phaseOf("starting the stopped pod Krea") === "start" && G.phaseOf("asking the pod what it has") === "check");
const ph = G.phasesOf([{ t: 1000, note: "asking the pod what it has" }, { t: 3000, note: "downloading on the pod: a" }, { t: 63000, note: "sending b from this computer" }, { t: 73000, note: "ready" }], 75000);
check("phasesOf: each note lasts until the next (the last until the end)", ph.check === 2000 + 2000 && ph.download === 60000 && ph.send === 10000, ph);

/* ---- summarize */
const S = G.summarize([e, loc, loc2, Object.assign({}, never)], [{ at: 5, ms: 15000, phases: { download: 12000, check: 3000 } }, { at: 9, ms: 5000, phases: { start: 5000 } }]);
check("summarize: totals - count, done / failed, averages", S.totals.count === 4 && S.totals.done === 3 && S.totals.failed === 1 && S.totals.total_ms === 90000 + 60000 + 60000 + 48000
  && S.totals.startup_avg === Math.round((30000 + 0 + 15000 + 48000) / 4), S.totals);
check("summarize: preps - count, time, the phases added", S.totals.preps === 2 && S.totals.prep_ms === 20000 && S.totals.phases.download === 12000 && S.totals.phases.start === 5000, S.totals);
check("summarize: by place - this computer / RunPod pods, each with its averages", (() => { const w = S.totals.by_where; const l = w.find((x) => x.key === "local"), r = w.find((x) => x.key === "runpod"); return l && r && l.count === 3 && l.label === "this computer" && r.label === "RunPod pods" && r.startup_avg === 30000; })(), S.totals.by_where);
check("summarize: by mode", S.totals.by_mode.find((x) => x.key === "image").count === 3);
check("summarize: newest first", S.gens[0].t >= S.gens[S.gens.length - 1].t);

/* ---- CSV */
const csv = G.toCsv("gens", [e]);
check("toCsv gens: the header and seconds", /^finished,day,id,project,mode,what,status,where,pod,queued_s,startup_s,generation_s,total_s,pod_preps,api_usd,prompt\n/.test(csv) && /,10,30,60,90,1,,/.test(csv), csv);
const csvp = G.toCsv("preps", [{ at: Date.UTC(2026, 10, 13), pod: "pp1", kind: "prepare", ms: 15000, phases: { download: 12000, check: 3000 }, styles: ["Krea 2"], problems: ["x"] }]);
check("toCsv preps: a column per phase", /check_s,start_s,update_s,repair_s,nodes_s,restart_s,download_s,send_s,link_s,problems/.test(csvp) && /,pp1,prepare,Krea 2,15,3,0,0,0,0,0,12,0,0,1/.test(csvp), csvp);

/* ---- live: recordGen / recordPrep / query in a temporary folder */
const now = Date.now() / 1000;   // the job: queued 60 s ago, head of the queue 50 s ago, started 25 s ago
const t9 = Date.now();
const pr = G.recordPrep({ pod: "pz", kind: "prepare", at: t9 - 45000, end: t9 - 28000, notes: [{ t: t9 - 45000, note: "asking the pod what it has" }, { t: t9 - 40000, note: "downloading on the pod: m.safetensors" }], styles: ["S1"] });
check("recordPrep: kept with its phases", pr && pr.ms === 17000 && pr.phases.download === 12000 && pr.phases.check === 5000, pr);
G.recordPrep({ pod: "other", kind: "start", at: t9 - 40000, end: t9 - 30000, phases: { start: 10000 } });   // another pod's - not this job's
const live = { id: "live1", status: "done", created: now - 60, started: now - 25, finished: now, _prepAt: (now - 50) * 1000, _genAt: (now - 20) * 1000, params: { mode: "image", pod_job: { pod_id: "pz" } }, _ranOn: { mode: "runpod", label: "RunPod pod pz" } };
const rg = G.recordGen(live);
check("recordGen: a pod render - with the preparation that ran while it waited", rg && rg.preps && rg.preps.length === 1 && rg.startup_ms === 30000, rg);
check("recordGen: once per job", G.recordGen(live) === null);
check("recordGen: not installs / downloads / the compile / ⚡ live / tool modes", G.recordGen({ id: "x1", status: "done", created: now, finished: now, params: { mode: "download" } }) === null
  && G.recordGen({ id: "x2", status: "done", created: now, finished: now, params: { mode: "export" } }) === null && G.recordGen({ id: "x3", status: "done", created: now, finished: now, params: { mode: "image", live: true } }) === null
  && G.recordGen({ id: "x4", status: "done", created: now, finished: now, params: { mode: "install_x" } }, { tool: true }) === null);
check("recordGen: a running job is not recorded", G.recordGen({ id: "x5", status: "running", params: { mode: "image" } }) === null);
const files = fs.readdirSync(TMP);
check("the file: usage/genstats-YYYY-MM.jsonl (H3_USAGE_DIR here)", files.length === 1 && /^genstats-\d{4}-\d{2}\.jsonl$/.test(files[0]), files);
const all = G.query("", "");
check("query: the generation + the preparations back, with totals", all.gens.length === 1 && all.preps.length === 2 && all.totals.count === 1 && all.totals.preps === 2, all.totals);
check("query: a range with nothing in it", G.query("2001-01-01", "2001-01-31").gens.length === 0);
fs.appendFileSync(path.join(TMP, files[0]), "{torn\n");
check("query: a torn line is skipped", G.query("", "").gens.length === 1);

/* ---- the page's pure part */
check("statsdlg rangeOf: the same ranges as 📊 Usage", D.rangeOf("today", new Date(2026, 10, 13)).from === "2026-11-13" && D.rangeOf("last", new Date(2026, 10, 13)).from === "2026-10-01" && D.rangeOf("last", new Date(2026, 10, 13)).to === "2026-10-31" && D.rangeOf("all").from === "");
check("statsdlg phaseText: longest first, under a second left out", D.phaseText({ download: 240000, nodes: 52000, check: 400 }) === "downloads 4 min · node packs 52 s", D.phaseText({ download: 240000, nodes: 52000, check: 400 }));
check("statsdlg durText", D.durText(850) === "850 ms" && D.durText(42000) === "42 s" && D.durText(185000) === "3 min 5 s" && D.durText(4320000) === "1 h 12 min");
check("statsdlg whereText", D.whereText({ where: "local" }) === "this computer" && D.whereText({ where: "runpod", pod: "p1" }) === "pod p1" && D.whereText({ where: "api", label: "API_fal" }) === "API_fal");

/* ---- the hooks are in place */
const core = src("lib/core.js");
check("core.js log(): every worker line goes to genStats.onLine", /require\("\.\/genStats"\)\.onLine\(job, line\)/.test(core));
check("core.js pump(): a pod gate marks the head of the queue (P_ and style pods)", (core.match(/require\("\.\/genStats"\)\.prepMark\(q0\)/g) || []).length === 2);
check("core.js: a finished job and a job its pod could not run are recorded", /require\("\.\/genStats"\)\.recordGen\(job, \{ tool: TOOL_MODES\.includes/.test(core) && /require\("\.\/genStats"\)\.recordGen\(j\)/.test(core));
check("podPrep.prepare: every preparation recorded with its timed notes", /require\("\.\/genStats"\)\.recordPrep\(\{ pod, kind: \(opts \|\| \{\}\)\.nodesOnly \? "nodes" : "prepare", at: t0, end: P\.at, notes/.test(src("lib/podPrep.js")));
check("podPrep.prepare: a test's stand-ins (opts.deps) are kept out of the statistics", /if \(!\(opts \|\| \{\}\)\.deps \|\| process\.env\.H3_GENSTATS_TEST\) try \{ require\("\.\/genStats"\)\.recordPrep/.test(src("lib/podPrep.js")));
check("stylePods.ready: a stopped pod started is a preparation (kind start)", /recordPrep\(\{ pod: id, kind: "start"/.test(src("lib/stylePods.js")));
check("routes/genStats.js mounted from routes/index.js (not server.js)", /require\("\.\/genStats"\)\.mount\(app\)/.test(src("routes/index.js")) && !/genStats/.test(src("misc/server.js")));
check("routes/genStats.js: GET /api/genstats + /api/genstats/csv", /app\.get\("\/api\/genstats"/.test(src("routes/genStats.js")) && /app\.get\("\/api\/genstats\/csv"/.test(src("routes/genStats.js")));
check("index.html loads static/statsdlg.js", /<script src="\/static\/statsdlg\.js"><\/script>/.test(src("static/index.html")));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
/* bitGen Studio — 2.522.0 units: 🐞 THE BUG REPORT (lib/bugReport.js, lib/appLog.js, routes/bugReport.js,
 * static/bugreport.js - Ctrl+Alt+Shift+B).
 * Tim (verbatim): "can you add a bug report floating docker - ctrl+alt+shift+b opens it. this will be where a user can
 * document bugs and send to the repo. i will upload the bug report file to you"
 * save / list / zip / remove run against a stand-in core (a temp app folder, settings WITH secrets, two jobs) and stand-in
 * ComfyUI / vision logs; the .zip is read back with lib/unzip.js. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const T = fs.mkdtempSync(path.join(os.tmpdir(), "br522-"));
fs.writeFileSync(path.join(T, "package.json"), JSON.stringify({ version: "9.9.9" }));

// stand-ins: core (a temp app folder + settings with secrets + jobs), ComfyUI's log, the vision log, the 🧪 checklist
const EVENTS = [];
const stub = (rel, exp) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports: exp }; };
const CFG = { civitai: { token: "civ-secret-123456" }, hf: { token: "hf_ABCDEFGHIJKLMNOPQRSTUVWX", repo: "x/y" }, rgpu: { runpod: { key: "rpa_ABCDEFGHIJKLMNOPQRST", pod_id: "p1" } },
  power: { price_kwh: 0.3 }, engine: { comfy: { url: "http://127.0.0.1:8188", dir: "C:\\ComfyUI" } }, remote: { pin: "1234", password: "hunter2" }, note: "my key is ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123 ok" };
const jobs = new Map([["a1", { id: "a1", status: "done", created: 100, params: { mode: "image", prompt: "a cat" }, log: ["step 1/2", "done"] }],
  ["b2", { id: "b2", status: "failed", created: 50, params: { mode: "lora_train", prompt: "LoRA x" }, log: ["Traceback", "CUDA out of memory", "token=hf_ABCDEFGHIJKLMNOPQRSTUVWX"] }]]);
stub("../lib/core.js", { BASE: T, getConfig: () => JSON.parse(JSON.stringify(CFG)), jobs });
stub("../lib/comfy.js", { status: async () => ({ reachable: false }), logFrom: () => ({ log: ["[ComfyUI] starting", "Total VRAM 24564 MB"], log_next: 2 }) });
stub("../lib/captioner.js", { logs: () => ["10:00:00 vision: loaded"] });
stub("../lib/testPlan.js", { event: (n, d) => EVENTS.push([n, d]) });
const B = require("../lib/bugReport.js"), AL = require("../lib/appLog.js"), UI = require("../static/bugreport.js"), UZ = require("../lib/unzip.js");

(async () => {
  /* ---- privacy */
  const s = B.scrub(CFG);
  check("scrub: values under token / key / password keys hidden (•••), the rest kept", s.civitai.token === "•••" && s.hf.token === "•••" && s.rgpu.runpod.key === "•••" && s.remote.password === "•••"
    && s.hf.repo === "x/y" && s.rgpu.runpod.pod_id === "p1" && s.power.price_kwh === 0.3 && s.engine.comfy.dir === "C:\\ComfyUI", s);
  check("scrub: a token-shaped string anywhere is hidden too (ghp_…)", /ghp_•••/.test(s.note) && !/ABCDEFGHIJKLMNOPQRSTUVWXYZ0123/.test(s.note), s.note);
  check("scrub: a deep copy - the settings are not touched", CFG.civitai.token === "civ-secret-123456");
  check("scrubText: hf_ / sk- / Bearer / ?token= / github_pat_ hidden", B.scrubText("hf_ABCDEFGHIJKLMNOPQRSTUVWX sk-abcdefghijklmnopqrstu Bearer abc.def.ghi123 /x?token=zz12&y=1 github_pat_11ABCDEFG0123456789_abcdef")
    === "hf_A••• sk-a••• Bearer ••• /x?token=•••&y=1 gith•••", B.scrubText("hf_ABCDEFGHIJKLMNOPQRSTUVWX sk-abcdefghijklmnopqrstu Bearer abc.def.ghi123 /x?token=zz12&y=1 github_pat_11ABCDEFG0123456789_abcdef"));
  check("scrub keeps empty secrets empty (nothing to hide)", B.scrub({ token: "" }).token === "" && B.scrub({ api_key: null }).api_key === null);

  /* ---- names, the form */
  const id = B.reportId("LoRA docker: freezes on Start!", new Date(2026, 9, 18, 9, 5, 7));
  check("reportId: bug-YYYYMMDD-HHMMSS-<title slug>", id === "bug-20261018-090507-lora-docker-freezes-on-start", id);
  check("safeId refuses paths and junk", (() => { try { B.safeId("../x"); return false; } catch (e) { return e.status === 404; } })() && B.safeId(id) === id);
  const c = B.clean({ title: "  a\n b ", severity: "nope", happened: "x".repeat(30000), recorded: Array.from({ length: 300 }, (_, i) => ({ t: "00:0" + (i % 10), what: "click " + i })), page_errors: ["err hf_ABCDEFGHIJKLMNOPQRSTUVWX"] });
  check("clean: title one line, unknown severity -> 'broken', long text cut, the last 200 steps, secrets out of the page errors", c.title === "a b" && c.severity === "broken" && c.happened.length === 20000 && c.recorded.length === 200 && c.recorded[199].what === "click 299" && /hf_A•••/.test(c.page_errors[0]), [c.title, c.severity, c.recorded.length]);
  check("clean: an empty title is 'Untitled bug'; every include is on unless switched off", B.clean({}).title === "Untitled bug" && B.clean({}).include.logs === true && B.clean({ include: { logs: false } }).include.logs === false);
  check("SEVERITIES: crash / broken / wrong / looks / idea", B.SEVERITIES.map((x) => x.id).join() === "crash,broken,wrong,looks,idea");

  /* ---- the app console ring (in its own process - it wraps console) */
  const al = spawnSync(process.execPath, ["-e", `const A=require(${JSON.stringify(path.join(ROOT, "lib", "appLog.js"))}); A.start(); A.start(); console.log("hello %s", "world"); console.error("bad\\nthing"); console.warn(""); process.stdout.write(JSON.stringify(A.lines()) + "\\n");`], { encoding: "utf8" });
  let ring = []; try { ring = JSON.parse(al.stdout.trim().split("\n").pop()); } catch { ring = []; }
  check("appLog: console.log / error kept with the time (ERROR marked, one line each, empty lines dropped), started once, still printed", ring.length === 3 && /^\d\d:\d\d:\d\d hello world$/.test(ring[0]) && /ERROR bad$/.test(ring[1]) && /ERROR thing$/.test(ring[2]) && /hello world/.test(al.stdout), ring);
  AL._push("from the test");
  check("appLog: a ring of 3000 lines", AL.MAX === 3000 && /from the test$/.test(AL.lines(1)[0]));

  /* ---- the static pure parts */
  check("keyName", UI.keyName({ ctrlKey: true, shiftKey: true, key: "s" }) === "Ctrl+Shift+S" && UI.keyName({ key: " " }) === "Space" && UI.keyName({ altKey: true, key: "F4" }) === "Alt+F4");
  check("recordKey: never plain typing in a box; shortcuts always; single keys outside a box (the app's P, S, 1…); modifiers alone never",
    !UI.recordKey({ key: "a" }, true) && UI.recordKey({ key: "a", ctrlKey: true }, true) && UI.recordKey({ key: "p" }, false) && UI.recordKey({ key: "Escape" }, false) && !UI.recordKey({ key: "Shift", shiftKey: true }, false));
  check("isOpenKey: Ctrl+Alt+Shift+B by its code (Alt changes the character on some layouts), not with Meta, not Ctrl+Shift+B",
    UI.isOpenKey({ ctrlKey: true, altKey: true, shiftKey: true, code: "KeyB", key: "∫" }) && !UI.isOpenKey({ ctrlKey: true, altKey: true, shiftKey: true, metaKey: true, code: "KeyB" }) && !UI.isOpenKey({ ctrlKey: true, shiftKey: true, code: "KeyB", key: "B" }));
  check("fmtT + stepsText", UI.fmtT(125000) === "02:05" && UI.stepsText([{ what: "click a" }, { what: "key Escape" }]) === "1. click a\n2. key Escape");

  /* ---- save -> folder, markdown, zip, list, remove */
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGM8oaHBQApgIkn1qIZRDUNKAwCMLQE4ZidSiAAAAABJRU5ErkJggg==", "base64");
  const r = await B.save({ title: "Queue stuck", severity: "crash", area: "Queue", happened: "It stopped.", expected: "It runs.", steps: "1. press Start",
    recorded: [{ t: "00:03", what: "click \"▶ Start\" (#ltStart) in LoRA & fine-tune trainer" }], page_errors: ["TypeError: x is undefined"], failed_requests: ["00:04 POST /api/x -> 500"],
    page: { url: "/", size: "1700×1000", dockers: ["LoRA & fine-tune trainer"] } }, PNG);
  const d = path.join(T, "bug-reports", r.id);
  check("save: bug-reports/<id>/ with report.json, report.md, screenshot.png, logs/app.txt + comfyui.txt + vision.txt + jobs.txt", /^bug-\d{8}-\d{6}-queue-stuck$/.test(r.id) && ["report.json", "report.md", "screenshot.png", "logs/app.txt", "logs/comfyui.txt", "logs/vision.txt", "logs/jobs.txt"].every((f) => fs.existsSync(path.join(d, f))), r);
  const J = JSON.parse(fs.readFileSync(path.join(d, "report.json"), "utf8")), MD = fs.readFileSync(path.join(d, "report.md"), "utf8"), JOBS = fs.readFileSync(path.join(d, "logs", "jobs.txt"), "utf8");
  check("report.json: the system (version from package.json, OS, RAM, ComfyUI 'not running') + the settings with NO secret in them", J.system.version === "9.9.9" && J.system.comfy === "not running" && J.system.ram_gb > 0
    && J.settings.civitai.token === "•••" && !/civ-secret|hf_ABCDEFGHIJ|rpa_ABCDEFGH|hunter2|ghp_ABCDEFGHIJ/.test(JSON.stringify(J)), J.system);
  check("report.md: title, severity, where, version, what happened / expected / steps, the recorded steps, page errors, failed requests, system, the attached files",
    /^# 🐞 Queue stuck/.test(MD) && /\*\*Severity:\*\* 💥 Crash \/ freeze/.test(MD) && /\*\*Where:\*\* Queue/.test(MD) && /bitGen Studio 9\.9\.9/.test(MD) && /## What happened\n\nIt stopped\./.test(MD)
    && /## What I expected\n\nIt runs\./.test(MD) && /- `00:03` click "▶ Start"/.test(MD) && /TypeError: x is undefined/.test(MD) && /POST \/api\/x -> 500/.test(MD) && /- Graphics: /.test(MD) && /- screenshot\.png/.test(MD) && /- logs\/jobs\.txt/.test(MD), MD.slice(0, 900));
  check("logs/jobs.txt: the failed job first, its log tail, tokens hidden", JOBS.indexOf("job b2") < JOBS.indexOf("job a1") && /CUDA out of memory/.test(JOBS) && /token=•••/.test(JOBS) && !/hf_ABCDEFGHIJ/.test(JOBS), JOBS.slice(0, 300));
  check("the 🧪 checklist hears bugreport_saved", EVENTS.some((e) => e[0] === "bugreport_saved" && e[1].what === r.id));
  const r2 = await B.save({ title: "No extras", include: { screenshot: true, logs: false, system: false, steps: false }, recorded: [{ t: "1", what: "secret step" }] }, Buffer.from("not a png"));
  const d2 = path.join(T, "bug-reports", r2.id), J2 = JSON.parse(fs.readFileSync(path.join(d2, "report.json"), "utf8"));
  check("switched off: no logs, no system / settings, no steps; a picture that is not a PNG is not written", fs.readdirSync(path.join(d2, "logs")).length === 0 && !J2.system && !J2.settings && J2.recorded.length === 0 && !fs.existsSync(path.join(d2, "screenshot.png")), J2);
  const L = B.list();
  check("list: newest first, with title / severity / screenshot", L.length === 2 && L.some((x) => x.id === r.id && x.title === "Queue stuck" && x.severity === "crash" && x.screenshot) && L.some((x) => x.id === r2.id && !x.screenshot), L);
  const z = B.zip(r.id);
  let names = []; try { names = UZ.entries(z.data).map((e) => e.name).sort(); } catch (e) { names = ["unzip: " + e.message]; }
  check("zip: bitgen-<id>.zip with the whole folder under <id>/", z.name === `bitgen-${r.id}.zip` && JSON.stringify(names) === JSON.stringify([`${r.id}/logs/app.txt`, `${r.id}/logs/comfyui.txt`, `${r.id}/logs/jobs.txt`, `${r.id}/logs/vision.txt`, `${r.id}/report.json`, `${r.id}/report.md`, `${r.id}/screenshot.png`].sort()), names);
  check("screenshot(id) + remove(id)", B.screenshot(r.id) && B.remove(r2.id) === true && B.remove(r2.id) === false && B.list().length === 1);
  const pv = await B.preview();
  check("preview: system, the settings scrubbed, each log's line count + its last lines, the severities", pv.system.version === "9.9.9" && pv.settings.hf.token === "•••" && pv.logs["comfyui.txt"].lines === 2 && /Total VRAM/.test(pv.logs["comfyui.txt"].tail) && pv.severities.length === 5);

  /* ---- wiring */
  const IDX = read("routes", "index.js"), SRV = read("server.js"), R = read("routes", "bugReport.js"), HTML = read("static", "index.html");
  check("routes/index mounts bugReport (not server.js) and starts the console ring before anything else", /require\("\.\/bugReport"\)\.mount\(app\)/.test(IDX) && IDX.indexOf('require("../lib/appLog").start()') < IDX.indexOf("app.use(express.json())") && !/bugReport|appLog/.test(SRV));
  check("routes: preview, list, save (TEXT body - the screenshot is big), zip, shot, delete", ["/api/bugreport/preview", "app.get(\"/api/bugreport\"", "app.post(\"/api/bugreport\"", "/api/bugreport/zip/:id", "/api/bugreport/shot/:id", "app.delete(\"/api/bugreport/:id\""].every((u) => R.includes(u)) && /express\.text\(\{ type: \(\) => true, limit: "40mb" \}\)/.test(R));
  check("the page loads static/bugreport.js; Settings -> General has 🐞 Report a bug…", /<script src="\/static\/bugreport\.js/.test(HTML) && /id="s_bug"/.test(HTML));
  const SC = JSON.parse(read("docs", "shortcuts.json"));
  check("docs/shortcuts.json lists Ctrl+Alt+Shift+B (the Guide's shortcut page)", SC.groups[0].rows.some((x) => x[0] === "Ctrl+Alt+Shift+B"));
  const IGN = fs.existsSync(path.join(ROOT, "_gitignore")) ? read("_gitignore") : "/bug-reports/";
  check("bug-reports/ is not shipped (ignored)", /^\/bug-reports\/$/m.test(IGN));
  const TP = JSON.parse(read("lib", "testPlan.json"));
  const g522 = TP.groups.find((g) => g.id === "g522");   /* 2.523.0: a newer release's group is first now */
  check("the testing checklist has the 2.522 items (💾 Save ticks itself)", !!g522 && g522.items.some((i) => i.auto && i.auto.event === "bugreport_saved"));

  fs.rmSync(T, { recursive: true, force: true });
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

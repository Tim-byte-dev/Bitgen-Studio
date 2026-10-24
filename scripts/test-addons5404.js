#!/usr/bin/env node
/* bitGen Studio — 2.540.4: Settings ▸ Add-ons (lib/addons.js, routes/addons.js) + the YuE2 call fixed.
 * Tim: "all generation works except for yue2, can we add an add ons tab to settings - install yue2?".
 * The YuE2 install with a stand-in runner (no downloads): the Python gate (3.10 - 3.13), no NVIDIA = a clear refusal,
 * its own venv, PyTorch 2.10.0 from the CUDA index for this card (the next index when one fails), the pinned
 * pipeline from its release zip (no git), the CLI checked; the job (one at a time, its log); music_worker.py runs
 * `yue2 generate --request …` (the pipeline's real CLI - `--input` is only `yue2 batch`) with UTF-8 and finds
 * <output>/<id>/audio.flac. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
const A = require(path.join(ROOT, "lib", "addons.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const IS_WIN = process.platform === "win32";

/** a stand-in for setupExec.run: answers the version probe, makes the venv / the CLI like the real steps would */
function fakeRun(o) {
  const calls = [];
  const run = async (cmd, args, opts) => {
    calls.push([cmd].concat(args).join(" "));
    const log = (opts && opts.log) || (() => {});
    if (args[0] === "-c" && /PYV/.test(args[1])) { log("PYV " + (o.ver || "3.13")); return 0; }
    if (args[0] === "-m" && args[1] === "venv") { const py = A.venvPy(args[2]); fs.mkdirSync(path.dirname(py), { recursive: true }); fs.writeFileSync(py, ""); return 0; }
    if (args.includes("torch==2.10.0")) { const i = args[args.indexOf("--index-url") + 1]; return (o.failIdx || []).some((x) => i.endsWith(x)) ? 1 : 0; }
    if (args.some((a) => /^yue2-infer @ /.test(a))) { if (o.noCli) return 0; const c = A.yueCli(o.base); fs.mkdirSync(path.dirname(c), { recursive: true }); fs.writeFileSync(c, ""); return o.pkgFail ? 1 : 0; }
    return 0;
  };
  return { run, calls };
}

(async () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "ao5404-"));
  try {
    const gpu = { cuda: true, torch: ["cu130", "cu128"] };
    // ---- the happy path
    let f = fakeRun({ base: T }), lines = [];
    let r = await A.installYue2({ run: f.run, log: (l) => lines.push(l), python: "/py/python3", gpu, base: T });
    const idx = (re) => f.calls.findIndex((c) => re.test(c));
    check("YuE2: the app's Python checked, its own venv at <app>/yue2/.venv, pip up to date, PyTorch 2.10.0 from the cu130 CUDA index, then the pinned pipeline from its release ZIP (no git) - in that order; the CLI is there -> ok",
      r.ok && idx(/PYV/) === 0 && idx(/-m venv .*yue2.\.venv$/) === 1 && idx(/pip install --upgrade pip/) === 2
      && /pip install torch==2\.10\.0 --index-url https:\/\/download\.pytorch\.org\/whl\/cu130/.test(f.calls[3])
      && /pip install yue2-infer @ https:\/\/github\.com\/multimodal-art-projection\/YuE\/archive\/refs\/tags\/yue2-v0\.1\.6\.zip/.test(f.calls[4])
      && fs.existsSync(A.yueCli(T)), { r, calls: f.calls });
    check("…the log says what it is doing and how to use it (the YuE2 style; the first song downloads the model)", lines.some((l) => /\[ok\] Python 3\.13/.test(l)) && lines.some((l) => /YuE2 installed/.test(l)) && lines.some((l) => /"YuE2" style in the Music docker.*m-a-p\/YuE2-3B/.test(l)), lines);
    // the venv already there: kept
    f = fakeRun({ base: T });
    r = await A.installYue2({ run: f.run, log: () => {}, python: "/py/python3", gpu, base: T });
    check("…a second install keeps the venv (no -m venv) and installs over the top", r.ok && !f.calls.some((c) => / -m venv /.test(c)));
    // cu130 fails -> cu128
    const T2 = fs.mkdtempSync(path.join(os.tmpdir(), "ao5404b-"));
    f = fakeRun({ base: T2, failIdx: ["cu130"] }); lines = [];
    r = await A.installYue2({ run: f.run, log: (l, e) => lines.push((e ? "! " : "") + l), python: "/py/python3", gpu, base: T2 });
    check("…a CUDA index whose wheels will not install -> the next one (cu128), said in the log", r.ok && f.calls.some((c) => /whl\/cu130/.test(c)) && f.calls.some((c) => /whl\/cu128/.test(c)) && lines.some((l) => /! \[warn\] the cu130 wheels did not install/.test(l)), lines);
    f = fakeRun({ base: T2, failIdx: ["cu130", "cu128"] });
    r = await A.installYue2({ run: f.run, log: () => {}, python: "/py/python3", gpu, base: T2 });
    check("…no CUDA build at all -> stops before the pipeline (update the driver)", !r.ok && /PyTorch 2\.10\.0 with CUDA would not install/.test(r.error) && !f.calls.some((c) => /yue2-infer/.test(c)), r);
    // gates
    for (const [ver, ok] of [["3.9", false], ["3.14", false], ["3.10", true], ["3.12", true]]) {
      const Tv = fs.mkdtempSync(path.join(os.tmpdir(), "ao5404v-"));
      f = fakeRun({ base: Tv, ver });
      r = await A.installYue2({ run: f.run, log: () => {}, python: "/py/python3", gpu, base: Tv });
      check(`…Python ${ver}: ${ok ? "accepted" : "refused (3.10 - 3.13)"}`, ok ? r.ok : (!r.ok && /needs Python 3\.10 - 3\.13; \/py\/python3 is /.test(r.error) && f.calls.length === 1), r);
      fs.rmSync(Tv, { recursive: true, force: true });
    }
    r = await A.installYue2({ run: fakeRun({ base: T }).run, log: () => {}, python: "/py/python3", gpu: { cuda: false }, base: T });
    check("…no NVIDIA GPU -> a clear refusal (nothing installed)", !r.ok && /needs an NVIDIA GPU with CUDA/.test(r.error), r);
    r = await A.installYue2({ run: fakeRun({ base: T }).run, log: () => {}, python: "", gpu, base: T });
    check("…no Python -> says where to get one", !r.ok && /no Python found/.test(r.error), r);
    const T3 = fs.mkdtempSync(path.join(os.tmpdir(), "ao5404c-"));
    r = await A.installYue2({ run: fakeRun({ base: T3, noCli: true }).run, log: () => {}, python: "/py/python3", gpu, base: T3 });
    check("…pip said ok but no yue2 CLI -> not ok (the log is the evidence)", !r.ok && /is not there/.test(r.error), r);
    check("torchIndexes: setupGpu's list (cu130 / cu128), cu128 when it cannot tell, none without CUDA", A.torchIndexes(gpu).join() === "cu130,cu128" && A.torchIndexes({ cuda: true }).join() === "cu128" && A.torchIndexes({}).length === 0);

    // ---- the list + status
    const y = A.LIST.find((a) => a.id === "yue2");
    check("the list: YuE2 music (for / needs / size) and Viggle (native) (its own installer)", y && /Music docker/.test(y.for) && /24 GB VRAM/.test(y.needs) && /PyTorch/.test(y.size) && A.LIST.some((a) => a.id === "viggle" && a.external));
    check("…YuE2 status: installed when its CLI is there; a venv without it says Install again", y.status(T).installed === true && y.status(path.join(T, "nope")).installed === false
      && /Install again/.test(y.status((() => { const b = fs.mkdtempSync(path.join(os.tmpdir(), "ao5404d-")); fs.mkdirSync(path.dirname(A.venvPy(A.yueVenv(b))), { recursive: true }); fs.writeFileSync(A.venvPy(A.yueVenv(b)), ""); return b; })()).note));

    // ---- the job: one at a time, its log
    A._reset();
    // (a stand-in job - never the real remove: on a machine with YuE2 installed this test must not delete it)
    const s1 = A.startJob("yue2", "remove", async (log) => { log("[..] removing (stand-in)"); await new Promise((ok) => setTimeout(ok, 150)); return { ok: true }; });
    const s2 = A.start("yue2", "remove");
    check("a job: started -> running; a second one while it runs -> refused (one at a time)", s1.ok && A.job().state === "running" && !!s2.error && /already being removed/.test(s2.error), { s1, s2 });
    for (let i = 0; i < 50 && A.job().state === "running"; i++) await new Promise((ok) => setTimeout(ok, 50));
    check("…it ends done with its log ([done] yue2 removed)", A.job().state === "done" && A.job().lines.some((l) => /\[done\] yue2 removed/.test(l)), A.job());
    check("…an unknown add-on -> an error", !!A.start("nothing", "install").error);

    // ---- the routes + the page + the worker
    const R = fs.readFileSync(path.join(ROOT, "routes", "addons.js"), "utf8"), IX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8");
    check("routes/addons.js: GET /api/addons, POST /api/addons/:id/install | remove (409 while one runs), GET /api/addons/job?from=N; mounted in routes/index.js (not server.js)",
      /app\.get\("\/api\/addons"/.test(R) && /\/api\/addons\/:id\/install/.test(R) && /\/api\/addons\/:id\/remove/.test(R) && /\/api\/addons\/job/.test(R) && /409/.test(R) && /require\("\.\/addons"\)\.mount\(app\)/.test(IX)
      && !/addons/.test(fs.readFileSync(path.join(ROOT, "misc", "server.js"), "utf8")));
    check("the page loads static/addons.js (Settings ▸ Add-ons)", /<script src="\/static\/addons\.js"><\/script>/.test(fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8")));
    const MW = fs.readFileSync(path.join(ROOT, "misc", "music_worker.py"), "utf8");
    check("music_worker.py: `yue2 generate --model M --request FILE --output DIR` (the real CLI), PYTHONUTF8=1, the song at <output>/<id>/audio.flac, and 'not installed' points to Settings > Add-ons",
      /cmd = (?:\[str\(cli\), |head \+ \[)"generate", "--model", model, "--request", str\(req_file\),/.test(MW) && /"PYTHONUTF8": "1"/.test(MW) && /flac = out_dir \/ req\["id"\] \/ "audio\.flac"/.test(MW)
      && /install it in Settings > Add-ons/.test(MW) && !/"--input", str\(req_file\)/.test(MW));
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally { try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

#!/usr/bin/env node
/* bitGen Studio — 2.764.6 units: is a Hugging Face file gated / missing? (lib/hfCheck.js) and a pod job that a dead kernel or a
 * dead pod no longer leaves at 0% (lib/podJob.js track - the pure part; the real Python run is scripts/test-podjob7646.js).
 * Tim (verbatim): "if the model is gated, i am guessing krea2 is gated, downloading for 5 minutes so far and still 0%, check
 * to see if it is gated and report to the user" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const H = require("../lib/hfCheck"), J = require("../lib/podJob");
const HF = "https://huggingface.co";

(async () => {
  /* ---- the repo of a file */
  check("repoOf: the owner/repo of a /resolve/ address; a dataset's too; not Hugging Face = \"\"",
    H.repoOf(HF + "/Comfy-Org/Krea-2/resolve/main/split_files/diffusion_models/krea2_raw_fp8_scaled.safetensors") === "Comfy-Org/Krea-2"
    && H.repoOf(HF + "/datasets/a/b/resolve/main/x") === "datasets/a/b" && H.repoOf("https://civitai.com/api/download/models/1") === "" && H.repoOf(HF + "/x") === "");

  /* ---- Hugging Face's answer in words */
  const g0 = H.why(401, "GatedRepo", "black-forest-labs/FLUX.1-dev", false), g1 = H.why(403, "GatedRepo", "black-forest-labs/FLUX.1-dev", true);
  check("why: gated, no token -> accept its license on its page + add the token in Settings ▸ Models", /^gated - open huggingface\.co\/black-forest-labs\/FLUX\.1-dev, accept its license, then add your Hugging Face token in Settings ▸ Models/.test(g0), g0);
  check("…gated with a token (403) -> that account has not accepted the license yet", /^gated - your Hugging Face account has not accepted its license yet: open huggingface\.co\/black-forest-labs\/FLUX\.1-dev/.test(g1), g1);
  check("…401 with no code and no token -> gated or private", /^gated or private - open huggingface\.co\/a\/b/.test(H.why(401, "", "a/b", false)));
  check("…the file or the repo not there -> not found (moved or renamed)", /^not found - huggingface\.co\/a\/b does not have this file/.test(H.why(404, "EntryNotFound", "a/b", false)) && /^not found/.test(H.why(404, "", "a/b", true)) && /^not found - huggingface\.co\/a\/b does not exist/.test(H.why(401, "RepoNotFound", "a/b", true)));
  check("…fine (200, 302 to the download servers) or not known (no answer) -> \"\"", H.why(200, "", "a/b") === "" && H.why(302, "", "a/b") === "" && H.why(0, "", "a/b") === "" && H.why(500, "", "a/b") === "");

  /* ---- check(): a stand-in Hugging Face */
  const asked = [];
  const fake = async (url, o) => {
    asked.push({ url, method: o.method, redirect: o.redirect, auth: (o.headers || {}).Authorization || "" });
    const hd = (c) => ({ get: (k) => (k.toLowerCase() === "x-error-code" ? c : null) });
    if (/Krea-2/.test(url)) return { status: 302, headers: hd(null) };
    if (/FLUX\.1-dev/.test(url)) return { status: (o.headers || {}).Authorization ? 403 : 401, headers: hd("GatedRepo") };
    if (/gone/.test(url)) return { status: 404, headers: hd("EntryNotFound") };
    throw new Error("offline");
  };
  const files = [{ name: "krea2_raw_fp8_scaled.safetensors", url: HF + "/Comfy-Org/Krea-2/resolve/main/split_files/diffusion_models/krea2_raw_fp8_scaled.safetensors" },
    { name: "flux1-dev.safetensors", url: HF + "/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors" },
    { name: "old.safetensors", url: HF + "/x/gone/resolve/main/old.safetensors" },
    { name: "noanswer.safetensors", url: HF + "/x/net/resolve/main/n.safetensors" },
    { name: "civitai.safetensors", url: "https://civitai.com/api/download/models/1" }];
  const r = await H.check(files, "", { base: HF, fetch: fake });
  check("check: Krea-2 (not gated - 302 to the download servers) goes; FLUX.1-dev gated and a missing file are held back with the reason; no answer / not Hugging Face are not held against the file",
    r.ok.map((f) => f.name).join() === "krea2_raw_fp8_scaled.safetensors,noanswer.safetensors,civitai.safetensors"
    && r.blocked.map((b) => b.name).join() === "flux1-dev.safetensors,old.safetensors" && /^gated/.test(r.blocked[0].why) && /^not found/.test(r.blocked[1].why), r);
  check("…asked with HEAD, not following the redirect (nothing downloaded here); Civitai not asked", asked.every((a) => a.method === "HEAD" && a.redirect === "manual") && !asked.some((a) => /civitai/.test(a.url)), asked);
  asked.length = 0;
  const r2 = await H.check(files.slice(1, 2), "hf_TOKEN", { base: HF, fetch: fake });
  check("…with the user's token: sent (Bearer) - gated and not accepted on that account says so", asked[0].auth === "Bearer hf_TOKEN" && /has not accepted its license yet/.test(r2.blocked[0].why), { asked, r2 });

  /* ---- the job's status read by bitGen: a job the pod stopped / no data */
  process.env.H3_POD_JOB_DEAD = "90000"; process.env.H3_POD_DL_STALL = "180000";
  const mem = {}, st = (beat, done) => ({ running: true, beat, files: [{ name: "a", state: "done", done: 5, size: 5 }, { name: "k", state: "downloading", done, size: 100 }, { name: "z", state: "waiting", done: 0, size: 9 }] });
  let s = J.track(mem, st(1, 0), 1000);
  check("track: running with a heartbeat - nothing said", s.running && !s.dead && !s.files[1].stalled, s);
  s = J.track(mem, st(5, 0), 1000 + 179000);
  check("…the heartbeat moves but the bytes do not for under 3 min - nothing yet", s.running && !s.files[1].stalled, s);
  s = J.track(mem, st(6, 0), 1000 + 181000);
  check("…no bytes for 3 min (heartbeat still moving) -> stalled + a note in words", s.running && s.files[1].stalled && /no data for 3 min/.test(s.files[1].note), s.files[1]);
  s = J.track(mem, st(7, 40), 1000 + 200000);
  check("…bytes again -> not stalled", !s.files[1].stalled, s.files[1]);
  s = J.track(mem, st(7, 40), 1000 + 200000 + 91000);
  check("…no heartbeat for 90 s while it says running -> the job is gone: not running, every unfinished file failed with the reason; a finished one kept",
    !s.running && /pod stopped this job/.test(s.dead) && /^failed: the pod stopped this job/.test(s.files[1].state) && /^failed:/.test(s.files[2].state) && s.files[0].state === "done", s);
  const m2 = {}; J.track(m2, { running: true, packs: [{ id: "p", state: "installing" }] }, 0);
  const s2 = J.track(m2, { running: true, packs: [{ id: "p", state: "installing" }] }, 95000);
  check("…a status file left from a job without a heartbeat (2.763.4-2.764.5: its kernel thread was ended) - seen as gone too; node packs as well", !s2.running && /^failed: the pod stopped/.test(s2.packs[0].state), s2);
  check("…no status (not readable) is passed through", J.track({}, null, 0) === null);

  /* ---- the kernel's code (pure) */
  const PM = require("../lib/podModels"), dl = PM.dlCode([{ name: "a.safetensors", folder: "vae", url: PM.HF + "/a/b/resolve/main/a.safetensors", size: 1 }], "/w/ComfyUI", "");
  const k = J.detach(dl);
  check("detach: the job is written to .bitgen_job_dl.py and started as its own process in a new session (not ended with the kernel); output to .bitgen_job_dl.log",
    /'\.bitgen_job_dl\.py'|"\.bitgen_job_dl\.py"/.test(k) && /subprocess\.Popen\(\[sys\.executable, '-u', p\], cwd=d, stdin=subprocess\.DEVNULL, stdout=open\(lg, 'wb'\), stderr=subprocess\.STDOUT, start_new_session=True\)/.test(k), k.slice(0, 400));
  check("…the marker only once the job wrote its status (20 s at most), else bitgen-job-failed + the log's end", /while time\.time\(\) - t0 < 20 and not os\.path\.exists\(st\) and pr\.poll\(\) is None/.test(k) && /if os\.path\.exists\(st\): print\("bitgen-started"\)/.test(k) && /print\('bitgen-job-failed '/.test(k));
  const prog = J.jobProgram(dl);
  check("…the job: run() in its main thread (no daemon thread to be cut), a heartbeat every 15 s, save() under a lock, running = False at the end whatever happens",
    !/daemon=True\)\.start\(\)\nprint/.test(prog) && /\ntry:\n    run\(\)\nfinally:\n    S\['running'\] = False; save\(\)$/.test(prog) && /_tm\.sleep\(15\); S\['beat'\] = S\.get\('beat', 0\) \+ 1; save\(\)/.test(prog) && /with _L: _save0\(\)/.test(prog) && !/print\('bitgen-started'\)/.test(prog), prog.slice(-500));
  check("…the node jobs too (mirror, packs) - their status files and markers", J.statusName(require("../lib/podNodes").mirrorCode([], "/c")) === ".bitgen_mirror.json" && J.markerOf(require("../lib/podPrep").nodeCode([], "/c")) === "bitgen-nodes-started");
  check("failed(): the reason from the kernel's answer", J.failed("bitgen-job-failed Traceback … SyntaxError") === "Traceback … SyntaxError" && J.failed("bitgen-started") === "");
  let thrown = null; try { J.detach("print(1)"); } catch (e) { thrown = e; } check("…not a bitGen job: refused", !!thrown);

  /* ---- wired in */
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const PMs = src("lib/podModels.js"), PNs = src("lib/podNodes.js"), PPs = src("lib/podPrep.js"), PL = src("static/podload.js");
  check("podModels: downloads asked first (gated / not found held back with the reason, all refused = an error naming each), then started detached; fromLink too",
    /const hc = await require\("\.\/hfCheck"\)\.check\(files, token, \{ base: HF \}\)/.test(PMs) && /if \(!hc\.ok\.length\) \{ const e = new Error\(hc\.blocked\.map\(\(b\) => b\.name \+ ": " \+ b\.why\)\.join\("; "\)\)/.test(PMs)
    && /require\("\.\/podJob"\)\.detach\(dlCode\(hc\.ok, w\.comfy_dir, token\)\)/.test(PMs) && /require\("\.\/podJob"\)\.detach\(dlCode\(\[\{ name, folder, url: jobUrl, size: \+o\.size \|\| 0, token \}\], w\.comfy_dir, ""\)\)/.test(PMs) && !/runKernel\([^)]*, dlCode\(/.test(PMs));
  check("…its progress tracked (a stopped job, no data) and the refused files listed with their reason", /require\("\.\/podJob"\)\.track\(s\.mem = s\.mem \|\| \{\}, await readCwdJson\(pid, "\.bitgen_dl\.json"\), Date\.now\(\)\)/.test(PMs) && /state: "failed: " \+ b\.why/.test(PMs));
  check("…the download job says Hugging Face's refusal in words on the pod too (gated or private / not found)", /def why\(e, url\):/.test(PMs) && /st\['state'\] = 'failed: ' \+ why\(e, f\['url'\]\)/.test(PMs) && /'gated or private - open ' \+ page/.test(PMs));
  check("podNodes / podPrep: the node installs detached and tracked too", /PJ\.detach\(mirrorCode\(items, w\.comfy_dir\)\)/.test(PNs) && /PJ\.track\(mem, await PM\.readCwdJson\(w\.pod_id, "\.bitgen_mirror\.json"\)/.test(PNs)
    && /PJ\.detach\(nodeCode\(pk\.packs, w\.comfy_dir\)\)/.test(PPs) && /s = PJ\.track\(mem, await D\.nodeState\(w\), Date\.now\(\)\)/.test(PPs));
  check("podPrep: a refused file said at once in the render's pod note (and once in its problems); a download with no data says so", /\(\(r0 && r0\.blocked\) \|\| \[\]\)\.forEach\(\(b\) => \{ P\.problems\.push\(`\$\{b\.name\}: \$\{b\.why\}`\); say\(`\$\{b\.name\}: \$\{b\.why\}`\); \}\)/.test(PPs)
    && /if \(!P\.problems\.some\(\(x\) => x\.startsWith\(f\.name \+ ": "\)\)\)/.test(PPs) && /\$\{cur\.note \? " \(" \+ cur\.note \+ "\)" : ""\}/.test(PPs));
  check("⬇ Models (static/podload.js): the files not downloaded and why; failed rows in red; the no-data note", /`Not downloaded: \$\{r\.blocked\.map/.test(PL) && /var bad = \/\^failed\/\.test\(String\(f\.state\)\)/.test(PL) && /esc\(f\.note\)/.test(PL));
  check("Krea-2 in bitGen's list is Comfy-Org/Krea-2 (not gated)", /"repo":\s*"Comfy-Org\/Krea-2"/.test(src("lib/modelCatalog.json")));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

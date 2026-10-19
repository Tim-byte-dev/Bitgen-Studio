#!/usr/bin/env node
/* bitGen Studio — 2.540.2: a node pack can never stop the setup.
 * Tim's first install from GitHub stopped after "Cloning into ...\bgsub-…\repo" (the first pack that lives in a
 * SUBFOLDER of a bigger repo, ComfyUI-H3-NativeAudioLock) with no further line. Checked here, with a real git and a
 * local repo (no network):
 *   setupExec.run's timeout stops a command that hangs (-2, logged); git runs with no prompts / no background gc;
 *   a subdir pack is copied out of its repo; a temp folder that will not delete (EBUSY) is retried, made writable,
 *   then left with a warning - install() still answers ok; anything that throws inside is {ok:false}, never a throw;
 *   setupRun keeps going after a pack that fails. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const X = require(path.join(ROOT, "lib", "setupExec.js"));
const P = require(path.join(ROOT, "lib", "setupPacks.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const which = (n) => { try { return execFileSync(process.platform === "win32" ? "where" : "which", [n], { encoding: "utf8" }).split(/\r?\n/)[0].trim(); } catch { return ""; } };

(async () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "sp5402-"));
  try {
    // ---- the timeout
    const lines = []; const t0 = Date.now();
    const code = await X.run(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { log: (l) => lines.push(l), timeout: 700 });
    check("run(): a command still running at its timeout is stopped -> -2, and the log says so (one stuck step can never hang the setup)",
      code === -2 && Date.now() - t0 < 5000 && lines.some((l) => /still running after .* stopped/.test(l)), { code, ms: Date.now() - t0, lines });
    const quick = await X.run(process.execPath, ["-e", "console.log('hi')"], { log: () => {}, timeout: 20000 });
    check("…a command that finishes in time answers its own exit code", quick === 0, quick);

    // ---- git: no prompts, no background gc
    check("git runs with GIT_TERMINAL_PROMPT=0 + GCM_INTERACTIVE=never (no hidden password window), gc.auto=0 (no background auto-pack holding .git files) and core.longpaths",
      P.GIT_ENV({ A: "1" }).GIT_TERMINAL_PROMPT === "0" && P.GIT_ENV({}).GCM_INTERACTIVE === "never" && P.GIT_ENV({ A: "1" }).A === "1"
      && P.cloneArgs("u", "d").join(" ") === "-c gc.auto=0 -c core.longpaths=true clone --depth 1 u d" && P.CLONE_MS >= 10 * 60000);

    const git = which("git");
    if (!git) { check("(no git here - the clone checks did not run)", true); }
    else {
      // a local "big repo" with the pack in a subfolder (like MiniMax-H3-NativeAudio-MusicVideo-Workflow)
      const src = path.join(T, "upstream");
      fs.mkdirSync(path.join(src, "custom_nodes", "ComfyUI-H3-NativeAudioLock"), { recursive: true });
      fs.writeFileSync(path.join(src, "custom_nodes", "ComfyUI-H3-NativeAudioLock", "__init__.py"), "NODE_CLASS_MAPPINGS = {}\n");
      fs.writeFileSync(path.join(src, "README.md"), "workflows\n");
      const g = (...a) => execFileSync(git, a, { cwd: src, stdio: "ignore" });
      g("init", "-q"); g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "x");
      const url = "file://" + src.replace(/\\/g, "/");
      const cn = path.join(T, "custom_nodes"); fs.mkdirSync(cn);
      const pack = { id: "nativeaudio", folder: "ComfyUI-H3-NativeAudioLock", url, subdir: "custom_nodes/ComfyUI-H3-NativeAudioLock" };
      const log = []; const say = (l) => log.push(l);
      const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("bgsub-")).length;
      const r = await P.install(pack, cn, { git, log: say });
      check("a pack in a SUBFOLDER of a repo: cloned aside, its folder copied into custom_nodes, logged, the temporary clone removed",
        r.ok && fs.existsSync(path.join(cn, pack.folder, "__init__.py")) && !fs.existsSync(path.join(cn, pack.folder, ".git"))
        && log.some((l) => /gc\.auto=0 -c core\.longpaths=true clone --depth 1/.test(l)) && log.some((l) => /copied custom_nodes\/ComfyUI-H3-NativeAudioLock/.test(l))
        && fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("bgsub-")).length === before, { r, log: log.slice(-4) });

      // the temp folder will not let go (Windows: a scanner / read-only pack files): EBUSY twice
      const rm0 = fs.rmSync; let tries = 0;
      fs.rmSync = function (p, o) { if (/bgsub-/.test(String(p)) && !/\.git/.test(String(p))) { tries++; const e = new Error("EBUSY: resource busy or locked"); e.code = "EBUSY"; throw e; } return rm0.call(fs, p, o); };
      const log2 = [];
      const r2 = await P.install(Object.assign({}, pack, { folder: "NativeAudio2" }), cn, { git, log: (l) => log2.push(l) });
      fs.rmSync = rm0;
      check("…a temp folder Windows will not delete: retried, made writable, tried again, then LEFT with a warning - the pack still installs (no throw)",
        r2.ok && tries === 2 && fs.existsSync(path.join(cn, "NativeAudio2", "__init__.py")) && log2.some((l) => /\[warn\] could not remove .*bgsub-.*EBUSY.*deleted by hand/.test(l)), { r2, tries, log2: log2.slice(-3) });
      for (const n of fs.readdirSync(os.tmpdir())) if (n.startsWith("bgsub-")) P.safeRm(path.join(os.tmpdir(), n));

      // the subfolder is not in the repo
      const r3 = await P.install(Object.assign({}, pack, { folder: "Missing", subdir: "custom_nodes/NotThere" }), cn, { git, log: () => {} });
      check("…a subfolder that is not in the repo -> {ok:false, the reason}", !r3.ok && /custom_nodes\/NotThere is not in/.test(r3.error), r3);

      // read-only files (git's pack files on Windows) are made writable before the second try
      const ro = path.join(T, "ro"); fs.mkdirSync(path.join(ro, "a"), { recursive: true }); fs.writeFileSync(path.join(ro, "a", "f"), "x"); fs.chmodSync(path.join(ro, "a", "f"), 0o444);
      P.writable(ro);
      check("writable(): every file under a folder is made writable (0666)", (fs.statSync(path.join(ro, "a", "f")).mode & 0o222) !== 0);
      check("safeRm(): removes it -> true; a missing folder -> true", P.safeRm(ro) === true && !fs.existsSync(ro) && P.safeRm(path.join(T, "nope")) === true);
    }

    // anything that throws inside install() is an answer, not a crash
    const cp0 = fs.cpSync; fs.cpSync = () => { throw new Error("EPERM: operation not permitted, copyfile"); };
    let threw = false, r4;
    try { r4 = await P.install({ folder: "Boom", url: "file:///nowhere", subdir: "x" }, path.join(T, "cn2"), { git: "", log: () => {} }); } catch { threw = true; }
    fs.cpSync = cp0;
    check("install(): an error inside (here no git and no GitHub URL) is {ok:false, error} - the setup's next pack still runs", !threw && r4 && r4.ok === false && !!r4.error, r4);

    // setupRun keeps going after a pack that fails
    const run = fs.readFileSync(path.join(ROOT, "lib", "setupRun.js"), "utf8");
    check("setupRun: each pack's install is in its own try / catch (one pack can never stop the rest); failures become warnings",
      /try \{ r = await Packs\.install\(pack[\s\S]{0,200}catch \(e\) \{ r = \{ ok: false/.test(run) && /packFails\.push\(pack\.folder\)/.test(run));
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally { try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

#!/usr/bin/env node
/* bitGen Studio — 2.540.5: ⟳ Update from GitHub (lib/updater.js, routes/updater.js, static/updater.js).
 * Tim: "add an update button to update bitgen from github". With a REAL git and a local "GitHub" (a repo on disk):
 *   a clone one release behind: the new commits listed, the update moves it to GitHub's branch, an app file the user
 *   changed is copied to backups/update-*, quick_prompts.json (the user's own) is put back, npm runs only because
 *   package-lock.json changed; a clone with its own commits is refused; up to date = says so.
 *   An install from the zip: GitHub's zip over the app - changed files written, the same ones skipped, the user's
 *   quick_prompts.json kept. Plus the version compare, the remote parse, the routes, the restart wiring. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const U = require(path.join(ROOT, "lib", "updater.js"));
const X = require(path.join(ROOT, "lib", "setupExec.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const which = (n) => { try { return execFileSync(process.platform === "win32" ? "where" : "which", [n], { encoding: "utf8" }).split(/\r?\n/)[0].trim(); } catch { return ""; } };
const wait = async (f, ms) => { for (let i = 0; i < (ms || 20000) / 50 && !f(); i++) await new Promise((ok) => setTimeout(ok, 50)); };

(async () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "up5405-"));
  try {
    check("cmpVersion: 2.540.10 > 2.540.9, 2.541.0 > 2.540.99, equal = 0", U.cmpVersion("2.540.10", "2.540.9") === 1 && U.cmpVersion("2.540.99", "2.541.0") === -1 && U.cmpVersion("2.540.4", "2.540.4") === 0);
    check("repoOf: https / ssh / .git -> owner/repo", U.repoOf("https://github.com/Tim-byte-dev/bitgen-studio.git") === "Tim-byte-dev/bitgen-studio" && U.repoOf("git@github.com:a/b.git") === "a/b" && U.repoOf("https://example.com/x") === "");
    check("the user's own files the repo carries are kept (quick_prompts.json)", U.USER_FILES.includes("quick_prompts.json"));

    const git = which("git");
    if (!git) check("(no git here - the git-mode checks did not run)", true);
    else {
      const g = (cwd, ...a) => execFileSync(git, ["-c", "user.name=t", "-c", "user.email=t@t"].concat(a), { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      // "GitHub": 2.540.4 -> 2.540.5
      const up = path.join(T, "github"); fs.mkdirSync(up);
      g(up, "init", "-q", "-b", "main");
      const w = (f, s) => { fs.mkdirSync(path.dirname(path.join(up, f)), { recursive: true }); fs.writeFileSync(path.join(up, f), s); };
      w("package.json", JSON.stringify({ name: "bitgen-studio", version: "2.540.4" })); w("package-lock.json", "{}"); w("server.js", "// v4\n"); w("lib/x.js", "x = 4\n"); w("quick_prompts.json", '{"version":1,"prompts":[]}');
      g(up, "add", "-A"); g(up, "commit", "-qm", "2.540.4");
      const inst = path.join(T, "install");
      execFileSync(git, ["clone", "-q", up, inst], { stdio: "ignore" });
      w("package.json", JSON.stringify({ name: "bitgen-studio", version: "2.540.5" })); w("package-lock.json", '{"v":5}'); w("server.js", "// v5\n"); w("lib/x.js", "x = 5\n"); w("lib/new.js", "new\n");
      g(up, "add", "-A"); g(up, "commit", "-qm", "2.540.5 - the update button");
      // the user changed an app file and saved quick prompts
      fs.writeFileSync(path.join(inst, "lib", "x.js"), "x = mine\n");
      fs.writeFileSync(path.join(inst, "quick_prompts.json"), '{"version":1,"prompts":[{"name":"mine","text":"mine"}]}');
      const I = U.info(inst);
      check("info(): a git clone - its version, origin's repo, its branch", I.mode === "git" && I.version === "2.540.4" && I.branch === "main", I);
      const c = await U.check({ base: inst, getJson: async () => ({ status: 200, json: { version: "2.540.5" } }) });
      check("check(): GitHub's version 2.540.5 > 2.540.4, 1 commit behind, the new commit listed", c.newer && c.latest === "2.540.5" && c.behind === 1 && c.ahead === 0 && c.commits.length === 1 && /2\.540\.5 - the update button/.test(c.commits[0]), c);
      // the update (npm is a stand-in; git is real)
      const ran = [];
      const run = (cmd, args, opts) => { if (/npm/i.test(path.basename(cmd)) || /python/i.test(path.basename(cmd))) { ran.push(path.basename(cmd) + " " + args.join(" ")); return Promise.resolve(0); } return X.run(cmd, args, opts); };
      U._reset();
      U.start({ base: inst, run });
      await wait(() => U.job().state !== "running");
      const J = U.job();
      const bk = fs.existsSync(path.join(inst, "backups")) ? fs.readdirSync(path.join(inst, "backups")) : [];
      check("update (git): done 2.540.4 -> 2.540.5, restart needed; GitHub's files in place (server.js v5, lib/new.js)",
        J.state === "done" && J.from === "2.540.4" && J.to === "2.540.5" && J.restart && fs.readFileSync(path.join(inst, "server.js"), "utf8") === "// v5\n" && fs.existsSync(path.join(inst, "lib", "new.js")), { J: { ...J, lines: J.lines.slice(-8) } });
      check("…the app file the user changed: replaced by GitHub's, a copy in backups/update-<time>/lib/x.js, said in the log",
        fs.readFileSync(path.join(inst, "lib", "x.js"), "utf8") === "x = 5\n" && bk.length === 1 && fs.readFileSync(path.join(inst, "backups", bk[0], "lib", "x.js"), "utf8") === "x = mine\n" && J.lines.some((l) => /! \[warn\] 1 app file\(s\) you changed .*lib\/x\.js/.test(l)), { bk, lines: J.lines });
      check("…quick_prompts.json (the user's own) put back as it was", /"mine"/.test(fs.readFileSync(path.join(inst, "quick_prompts.json"), "utf8")));
      check("…package-lock.json changed -> npm install ran (and no pip: requirements.txt did not change)", ran.some((r) => /^npm.* install --omit=dev/.test(r)) && !ran.some((r) => /pip/.test(r)), ran);
      // up to date now
      U._reset(); U.start({ base: inst, run }); await wait(() => U.job().state !== "running");
      check("…again: already up to date, no restart", U.job().state === "done" && !U.job().restart && U.job().lines.some((l) => /already up to date/.test(l)), U.job());
      // a clone with its own commit -> refused
      fs.writeFileSync(path.join(inst, "mine.txt"), "x"); g(inst, "add", "mine.txt"); g(inst, "commit", "-qm", "my own");
      w("server.js", "// v6\n"); g(up, "add", "-A"); g(up, "commit", "-qm", "2.540.6");
      U._reset(); U.start({ base: inst, run }); await wait(() => U.job().state !== "running");
      check("…a folder with commits of its own (a developer's repo) -> refused, nothing moved", U.job().state === "error" && /1 commit\(s\) of its own/.test(U.job().error) && fs.existsSync(path.join(inst, "mine.txt")), U.job().error);
      check("only one update at a time", (() => { U._reset(); const a = U.start({ base: inst, run }); const b = U.start({ base: inst, run }); return a.ok && /already running/.test(b.error); })());
      await wait(() => U.job().state !== "running");
    }

    // ---- zip mode
    const zi = path.join(T, "zipinst"); fs.mkdirSync(path.join(zi, "lib"), { recursive: true });
    fs.writeFileSync(path.join(zi, "package.json"), JSON.stringify({ version: "2.540.4" })); fs.writeFileSync(path.join(zi, "server.js"), "// v4\n");
    fs.writeFileSync(path.join(zi, "lib", "same.js"), "same\n"); fs.writeFileSync(path.join(zi, "quick_prompts.json"), '{"prompts":[{"name":"mine"}]}');
    fs.mkdirSync(path.join(zi, "projects", "default"), { recursive: true }); fs.writeFileSync(path.join(zi, "projects", "default", "a.txt"), "mine");
    const Z = require(path.join(ROOT, "lib", "zipWrite.js"));
    const zipBuf = Z.zip([{ name: "bitgen-studio-main/package.json", data: JSON.stringify({ version: "2.540.5" }) }, { name: "bitgen-studio-main/server.js", data: "// v5\n" },
      { name: "bitgen-studio-main/lib/same.js", data: "same\n" }, { name: "bitgen-studio-main/lib/new.js", data: "new\n" }, { name: "bitgen-studio-main/quick_prompts.json", data: '{"prompts":[]}' }]);
    const urls = [];
    const download = async (url, dest) => { urls.push(url); fs.writeFileSync(dest, zipBuf); return { ok: true }; };
    U._reset();
    U.start({ base: zi, download, run: async () => 0 });
    await wait(() => U.job().state !== "running");
    const ZJ = U.job();
    check("update (zip): GitHub's zip of the branch (codeload) over the app - 2.540.4 -> 2.540.5, the changed files written (package.json, server.js, lib/new.js), the same one skipped",
      ZJ.state === "done" && ZJ.mode === "zip" && /codeload\.github\.com\/Tim-byte-dev\/bitgen-studio\/zip\/refs\/heads\/main/.test(urls[0]) && ZJ.to === "2.540.5"
      && fs.readFileSync(path.join(zi, "server.js"), "utf8") === "// v5\n" && fs.existsSync(path.join(zi, "lib", "new.js")) && ZJ.lines.some((l) => /\[ok\] 3 file\(s\) updated/.test(l)), { ZJ: { ...ZJ, lines: ZJ.lines } });
    check("…the user's quick_prompts.json and projects untouched", /mine/.test(fs.readFileSync(path.join(zi, "quick_prompts.json"), "utf8")) && fs.readFileSync(path.join(zi, "projects", "default", "a.txt"), "utf8") === "mine");
    const bad = Z.zip([{ name: "x/readme.txt", data: "not it" }]);
    U._reset(); U.start({ base: zi, download: async (u, d) => { fs.writeFileSync(d, bad); return { ok: true }; }, run: async () => 0 }); await wait(() => U.job().state !== "running");
    check("…a download that is not bitGen Studio -> refused, nothing written", U.job().state === "error" && /does not look like bitGen Studio/.test(U.job().error));

    // ---- wiring
    const R = fs.readFileSync(path.join(ROOT, "routes", "updater.js"), "utf8"), IX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8");
    check("routes: GET /api/update/info, POST /api/update/check, POST /api/update/start (409 while one runs), GET /api/update/job; mounted in routes/index.js",
      /\/api\/update\/info/.test(R) && /\/api\/update\/check/.test(R) && /\/api\/update\/start/.test(R) && /409/.test(R) && /\/api\/update\/job/.test(R) && /require\("\.\/updater"\)\.mount\(app\)/.test(IX));
    const M = fs.readFileSync(path.join(ROOT, "electron", "main.js"), "utf8"), P = fs.readFileSync(path.join(ROOT, "electron", "preload.js"), "utf8");
    check("⟳ Restart now: electron h3:relaunch (app.relaunch, then the clean quit) + h3shell.relaunch in the preload; the page loads static/updater.js",
      /ipcMain\.handle\("h3:relaunch", \(\) => \{ app\.relaunch\(\); app\.quit\(\);/.test(M) && /relaunch: \(\) => ipcRenderer\.invoke\("h3:relaunch"\)/.test(P)
      && /<script src="\/static\/updater\.js"><\/script>/.test(fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8")));
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally { try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

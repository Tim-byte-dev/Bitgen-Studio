#!/usr/bin/env node
/* bitGen Studio — scripts/test-misc591.js (2.591.0): THE APP ROOT IS TIDY - its files live in misc/.
 * Tim: "can we put all the files that are in the app root except for start.bat in a folder call it misc" (picked: the
 * minimal root - start.bat, package.json + package-lock.json, README.md, LICENSE, the hidden .gitignore / .github).
 * Checks the layout, that everything that names a moved file names it in misc/ (server start, workers, installers,
 * the launchers), and lib/miscMigrate on a temp app folder (an install updated from a zip still has the old copies).
 * No server. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const M = require("../lib/miscMigrate");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-misc591-"));
try {
  // ---- the layout
  const KEEP = new Set(["start.bat", "package.json", "package-lock.json", "README.md", "LICENSE"]);
  // 2.591.3: GitHub's CI went red on the line-end check - a git checkout has the bytes git gave it (a commit from
  // Windows with core.autocrlf turns CRLF into LF). In a checkout (.git here) the repository's rules are checked
  // instead of the bytes on disk, and a leftover push-to-github.bat (never meant to be in the repo) is not read.
  const GIT = fs.existsSync(path.join(ROOT, ".git"));
  const HASPB = !GIT && fs.existsSync(path.join(ROOT, "push-to-github.bat"));   // 2.591.2: in the app folder, never in the repo
  const strays = M.MOVED.filter((n) => fs.existsSync(path.join(ROOT, n)));
  const shipped = M.MOVED.filter((n) => !["CONTINUATION-NOTES-2_137_1.md", "HANDOVER-ARCHIVE.md", "WORKING-VERSIONS.md", "FOLDER-STRUCTURE.md", "_gitignore", "CONTINUE.md", "HANDOVER.md", "unflatten.ps1"].includes(n));
  const missing = shipped.filter((n) => !fs.existsSync(path.join(ROOT, "misc", n)));
  check("the root keeps start.bat, package.json, package-lock.json, README.md, LICENSE; every moved file is in misc/ (none left in the root)",
    [...KEEP].every((n) => fs.existsSync(path.join(ROOT, n))) && missing.length === 0, { strays, missing });
  // 2.591.1: a checkout can still hold OLD root copies (a repository updated by unzipping over it / an upload that only
  // adds files - GitHub's CI went red on that). They are not an error: the app removes them at start and
  // push-to-github.bat before it commits (lib/miscMigrate) - said, not failed.
  if (strays.length) console.log("NOTE: old copies in the root (removed at the next start / push): " + strays.join(", "));
  check("MOVED names no file the root keeps", M.MOVED.every((n) => !KEEP.has(n)) && M.USER.join() === "quick_prompts.json");

  // ---- what names them
  const PKG = JSON.parse(rd("package.json")), CORE = rd("lib", "core.js"), BAT = rd("start.bat");
  check("npm start / main / electron start misc/server.js; its requires climb back out (../routes, ../lib/remote)",
    PKG.main === "misc/server.js" && /node misc\/server\.js/.test(PKG.scripts.start) && /misc", "server\.js"|misc\/server\.js/.test(rd("electron", "main.js"))
    && /require\("\.\.\/routes"\)/.test(rd("misc", "server.js")) && !/require\("\.\/routes"\)/.test(rd("misc", "server.js")));
  check("core: workers + default.settings from misc/ (MISC, workerScript)", /const MISC = path\.join\(BASE, "misc"\)/.test(CORE) && /DEFAULTS_PATH = path\.join\(MISC, "default\.settings"\)/.test(CORE)
    && require("../lib/core").workerScript("image") === path.join(ROOT, "misc", "image_worker.py") && fs.existsSync(require("../lib/core").workerScript("video")));
  check("start.bat: node misc\\server.js, pip -r misc\\requirements.txt, misc\\get-electron.ps1", /node misc\\server\.js/.test(BAT) && /-r misc\\requirements\.txt/.test(BAT) && /%~dp0misc\\get-electron\.ps1/.test(BAT) && !/node server\.js/.test(BAT));
  check("the engine installers run misc\\get-llama.ps1 / misc\\get-sd-cli.ps1 (worker.py); cad / comfy / setup / quick prompts point into misc/",
    /app_dir \/ "misc" \/ "get-llama\.ps1"/.test(rd("misc", "worker.py")) && /app_dir \/ "misc" \/ "get-sd-cli\.ps1"/.test(rd("misc", "worker.py"))
    && /misc/.test(rd("lib", "cadGen.js")) && /clear-comfy\.bat/.test(rd("lib", "comfy.js")) && /misc/.test(rd("lib", "quickPrompts.js")) && /misc/.test(rd("lib", "setupLlama.js")));
  check("the helper scripts find the app folder above misc\\ (ps1: Split-Path -Parent $PSScriptRoot; bat: %~dp0..)",
    ["get-comfy.ps1", "get-llama.ps1", "get-sd-cli.ps1", "get-yue2.ps1", "get-qwen3vl.ps1"].every((f) => /Split-Path -Parent \$PSScriptRoot/.test(rd("misc", f)))
    && /%~dp0\.\.\\/.test(rd("misc", "clear-comfy.bat")) && /cd \/d "%~dp0\.\."/.test(rd("misc", "reset-layout.bat")));
  check("2.591.3 .gitattributes: every .bat / .cmd is checked out with CRLF (cmd needs it), whatever autocrlf did", /^\*\.bat text eol=crlf$/m.test(rd(".gitattributes")) && /^\*\.cmd text eol=crlf$/m.test(rd(".gitattributes")));
  if (!GIT) check("reset-layout.bat (+ push-to-github.bat when it is here) keep their CRLF line ends", ["misc/reset-layout.bat", ...(HASPB ? ["push-to-github.bat"] : [])].every((f) => { const s = rd(f); return /\r\n/.test(s) && !/[^\r]\n/.test(s); }));
  check("the updater takes a misc/ download (and a pre-2.591 one) and keeps the user's misc/quick_prompts.json", /misc", "server\.js"|misc\/server\.js/.test(rd("lib", "updater.js")) && /"misc\/quick_prompts\.json"/.test(rd("lib", "updater.js")));
  check("miscMigrate runs first at mount (routes/index.js, not server.js)", /require\("\.\.\/lib\/miscMigrate"\)\.run\(core\.BASE\)/.test(rd("routes", "index.js")) && !/miscMigrate/.test(rd("misc", "server.js")));
  check("misc/_gitignore is the same as .gitignore (the flat zip carries it)", !fs.existsSync(path.join(ROOT, "misc", "_gitignore")) || rd("misc", "_gitignore") === rd(".gitignore"));

  // ---- miscMigrate on a temp app folder
  const B = path.join(tmp, "app");
  fs.mkdirSync(path.join(B, "misc"), { recursive: true });
  for (const n of ["server.js", "worker.py", "default.settings", "quick_prompts.json"]) fs.writeFileSync(path.join(B, "misc", n), "new " + n);
  for (const n of ["server.js", "worker.py", "quick_prompts.json", "get-comfy.ps1"]) fs.writeFileSync(path.join(B, n), "old " + n);
  fs.writeFileSync(path.join(B, "custom.settings"), "mine"); fs.writeFileSync(path.join(B, "start.bat"), "bat"); fs.mkdirSync(path.join(B, "requirements.txt"));
  const log0 = console.log; console.log = () => {};
  let r; try { r = M.run(B); } finally { console.log = log0; }
  check("an old root copy whose misc/ one exists is removed; one misc/ lacks is moved in", r.removed.sort().join() === "server.js,worker.py" && r.moved.includes("get-comfy.ps1")
    && !fs.existsSync(path.join(B, "server.js")) && fs.readFileSync(path.join(B, "misc", "server.js"), "utf8") === "new server.js" && fs.readFileSync(path.join(B, "misc", "get-comfy.ps1"), "utf8") === "old get-comfy.ps1", r);
  check("the user's quick_prompts.json wins over the shipped one (moved, root copy gone)", r.moved.includes("quick_prompts.json") && fs.readFileSync(path.join(B, "misc", "quick_prompts.json"), "utf8") === "old quick_prompts.json" && !fs.existsSync(path.join(B, "quick_prompts.json")));
  check("nothing else is touched: custom.settings, start.bat, a folder with a moved name", fs.readFileSync(path.join(B, "custom.settings"), "utf8") === "mine" && fs.existsSync(path.join(B, "start.bat")) && fs.statSync(path.join(B, "requirements.txt")).isDirectory());
  const R = path.join(tmp, "repo"); fs.mkdirSync(path.join(R, "misc"), { recursive: true });
  fs.writeFileSync(path.join(R, "misc", "quick_prompts.json"), "new"); fs.writeFileSync(path.join(R, "quick_prompts.json"), "old shipped");
  fs.writeFileSync(path.join(R, "misc", "server.js"), "new"); fs.writeFileSync(path.join(R, "server.js"), "old");
  const rr = (() => { const l0 = console.log; console.log = () => {}; try { return M.run(R, { repo: true }); } finally { console.log = l0; } })();
  check("2.591.1 {repo: true} (push-to-github.bat): every old root copy goes, misc/'s quick_prompts.json wins (the root one is the old shipped one)",
    rr.removed.sort().join() === "quick_prompts.json,server.js" && fs.readFileSync(path.join(R, "misc", "quick_prompts.json"), "utf8") === "new" && !fs.existsSync(path.join(R, "quick_prompts.json")), rr);
  check("2.591.1 push-to-github.bat tidies the old root copies before git add (node + lib/miscMigrate, repo mode) - or not here (a repo checkout)",
    !HASPB || /if exist "lib\\miscMigrate\.js" node -e "require\('\.\/lib\/miscMigrate'\)\.run\(process\.cwd\(\), \{repo: true\}\)"\r\ngit add -A\r\n/.test(rd("push-to-github.bat")));
  const r2 = M.run(B);
  check("a second start: nothing to do", r2.moved.length + r2.removed.length + r2.kept.length === 0);
  // 2.591.2 (Tim: "move push to github to the root folder and it must not be in the repo")
  const P = path.join(tmp, "pb"); fs.mkdirSync(path.join(P, "misc"), { recursive: true }); fs.writeFileSync(path.join(P, "misc", "push-to-github.bat"), "2.591.1");
  const P2 = path.join(tmp, "pb2"); fs.mkdirSync(path.join(P2, "misc"), { recursive: true }); fs.writeFileSync(path.join(P2, "misc", "push-to-github.bat"), "old"); fs.writeFileSync(path.join(P2, "push-to-github.bat"), "new");
  const q = (b) => { const l0 = console.log; console.log = () => {}; try { return M.run(b); } finally { console.log = l0; } };
  const p1 = q(P), p2 = q(P2);
  check("2.591.2 push-to-github.bat goes back to the app folder: misc\\'s copy moves up; with one there already misc\\'s goes; not in MOVED",
    M.BACK.join() === "push-to-github.bat" && !M.MOVED.includes("push-to-github.bat") && p1.moved.join() === "push-to-github.bat" && fs.readFileSync(path.join(P, "push-to-github.bat"), "utf8") === "2.591.1" && !fs.existsSync(path.join(P, "misc", "push-to-github.bat"))
    && p2.removed.join() === "misc/push-to-github.bat" && fs.readFileSync(path.join(P2, "push-to-github.bat"), "utf8") === "new" && !fs.existsSync(path.join(P2, "misc", "push-to-github.bat")), { p1, p2 });
  check("2.591.2 never in the repo: .gitignore /push-to-github.bat; misc\\ has none (a git checkout may still have an old one - the next push removes it)", /^\/push-to-github\.bat$/m.test(rd(".gitignore")) && (GIT || !fs.existsSync(path.join(ROOT, "misc", "push-to-github.bat"))));
  const B2 = path.join(tmp, "old"); fs.mkdirSync(B2); fs.writeFileSync(path.join(B2, "server.js"), "x");
  check("a folder without misc/ (not this layout) is left alone", M.run(B2).moved.length === 0 && fs.existsSync(path.join(B2, "server.js")));
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
/* bitGen Studio — 2.540.6: push-to-github.bat (Tim: "can you include a bat file in the repo that i can just double
 * click to push?"). Windows only, so this checks its shape: CRLF; every label it jumps to exists; no ( or ) inside a
 * rem or an unescaped echo within a ( ) block (cmd ends the block there); a dropped zip re-runs from TEMP (the zip step
 * replaces the bat itself); only tracked files are removed (git rm, never del / rmdir of the folder); the private
 * notes are never committed; never a force push; the full zip is refused. Plus the zip step's git commands for real:
 * a removed file is recorded as removed, an ignored folder (node_modules) is untouched. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const raw = fs.readFileSync(path.join(ROOT, "misc", "push-to-github.bat"), "utf8");
check("CRLF line ends throughout", /\r\n/.test(raw) && !/[^\r]\n/.test(raw));
const L = raw.split("\r\n");
const labels = new Set(L.filter((l) => /^:\w/.test(l)).map((l) => l.slice(1).trim().toLowerCase()));
const jumps = [...raw.matchAll(/goto :(\w+)/gi)].map((m) => m[1].toLowerCase());
check("every goto has its label", jumps.length > 10 && jumps.every((j) => j === "eof" || labels.has(j)), jumps.filter((j) => !labels.has(j)));
let depth = 0; const bad = [];
for (const l of L) {
  const t = l.trim();
  const body = t.replace(/\^./g, "").replace(/"[^"]*"/g, "");
  if (depth > 0 && /^(rem|echo)\b/i.test(t) && /[()]/.test(body)) bad.push(t);
  if (/^rem\b/i.test(t)) continue;
  for (const c of body) { if (c === "(") depth++; else if (c === ")") depth = Math.max(0, depth - 1); }
}
check("no bare ( ) in a rem / echo inside a ( ) block", bad.length === 0, bad);
check("a dropped zip: the bat copies itself to TEMP and runs from there (without call), with --from-temp (2.591.0: the folder above misc\\)", /copy \/Y "%~f0" "%TEMP%\\bitgen-push\.bat"/.test(raw) && /^"%TEMP%\\bitgen-push\.bat" "%~f1" --from-temp "%~dp0(\.\.\\)?"\r?$/m.test(raw) && /if \/i "%~2"=="--from-temp" goto :fromtemp/.test(raw));
check("only tracked files are removed (git rm -r -f), the zip is copied in with robocopy (no purge), nothing deletes the folder", /git rm -r -q -f --ignore-unmatch -- \./.test(raw) && /robocopy "%SRC%" "%REPO%\." \/E /.test(raw) && !/\/MIR|\/PURGE/i.test(raw) && !/rmdir [^\r\n]*%REPO%/i.test(raw) && !/\bdel\b/i.test(raw));
const drop = ["HANDOVER.md", "HANDOVER-ARCHIVE.md", "CONTINUATION-NOTES-2_137_1.md", "WORKING-VERSIONS.md", "FOLDER-STRUCTURE.md", "unflatten.ps1", "scripts/unflatten.py", "_gitignore", "g_kf.cmd", "t_kf.cmd", "CONTINUE.md", "docs/PHOTOSHOP-GAP.md", "docs/PREMIERE-GAP.md", "docs/AFTER-EFFECTS-GAP.md"];
const rmLine = L.find((l) => /git rm -r -q --cached --ignore-unmatch/.test(l)) || "";
check("the private notes are never committed (the release's public drop list)", drop.every((f) => rmLine.includes(" " + f)), rmLine);
check("never a force push; pushes HEAD to main; brings GitHub's changes in with a rebase (aborted on a clash)", !/--force|push -f\b|\+HEAD/.test(raw) && /git push -u origin HEAD:%BRANCH%/.test(raw) && /git pull -q --rebase origin %BRANCH%/.test(raw) && /git rebase --abort/.test(raw));
check("the full zip (with the private notes) is refused; asks before replacing and before pushing (+ 2.540.9: before making a non-app folder the repository)", /FOLDER-STRUCTURE\.md" goto :fullzip/.test(raw) && (raw.match(/choice \/C YN/g) || []).length === 3);
check("2.540.9 the wrong folder: the bat beside a bitgen-studio folder -> says to move it there (nothing set up); a folder with neither .git nor package.json asks first", raw.includes('if exist "bitgen-studio\\.git" goto :wrongplace') && /if exist "package\.json" goto :placeok/.test(raw) && /Make THIS folder the repository anyway/.test(raw) && raw.indexOf(":placeok") < raw.indexOf("git init -q"));
check("2.540.9 'detected dubious ownership' (a folder owned by another Windows account) -> safe.directory added for this folder with forward slashes, said; called once the repository exists", /:hasgit\r\ncall :trustdir/.test(raw) && /findstr \/c:"dubious ownership"/.test(raw) && /set "SAFE=%CD:\\=\/%"/.test(raw) && /git config --global --add safe\.directory "%SAFE%"/.test(raw) && /endlocal\r\nexit \/b/.test(raw));
check("the first time: git init -b main + the GitHub address; a broken address is put right", /git init -q -b %BRANCH%/.test(raw) && /git remote add origin %URL%/.test(raw) && /git remote set-url origin %URL%/.test(raw) && /Tim-byte-dev\/bitgen-studio\.git/.test(raw));
// the zip step's git commands, for real
let gitOk = true; try { execFileSync("git", ["--version"]); } catch { gitOk = false; }
if (gitOk) {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "pb5406-")), g = (...a) => execFileSync("git", ["-C", T, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8" });
  try {
    g("init", "-q", "-b", "main");
    fs.writeFileSync(path.join(T, ".gitignore"), "node_modules/\n"); fs.writeFileSync(path.join(T, "keep.js"), "1"); fs.writeFileSync(path.join(T, "gone.js"), "1"); fs.writeFileSync(path.join(T, "HANDOVER.md"), "x");
    fs.mkdirSync(path.join(T, "node_modules")); fs.writeFileSync(path.join(T, "node_modules", "m.js"), "m");
    g("add", "-A"); g("commit", "-qm", "1");
    g("rm", "-r", "-q", "-f", "--ignore-unmatch", "--", ".");
    fs.writeFileSync(path.join(T, ".gitignore"), "node_modules/\n"); fs.writeFileSync(path.join(T, "keep.js"), "2"); fs.writeFileSync(path.join(T, "HANDOVER.md"), "x");
    g("add", "-A"); g("rm", "-r", "-q", "--cached", "--ignore-unmatch", ...drop);
    const st = g("status", "--short").trim().split("\n").sort();
    check("…the zip step for real: a file the release removed is removed, a changed one changed, HANDOVER.md untracked, node_modules untouched",
      JSON.stringify(st) === JSON.stringify(["?? HANDOVER.md", "D  HANDOVER.md", "D  gone.js", "M  keep.js"].sort()) && fs.existsSync(path.join(T, "node_modules", "m.js")), st);
  } finally { fs.rmSync(T, { recursive: true, force: true }); }
} else console.log("SKIP: git is not installed - the real git step did not run");
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);

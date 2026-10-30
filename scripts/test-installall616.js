#!/usr/bin/env node
/* bitGen Studio — 2.616.0: INSTALL ALL - one file that installs Git / Node.js when missing, clones the repo when it is
 * on its own, then starts (installs the rest the first time).
 * Tim: "is it possible to create an install_all file that will install git and nodejs if they are not installed then run
 * start for all our supported os?" + "so user can use this file only, it will also clone our repo".
 *   install_all.sh / install_all.command (Linux / macOS - RUN here against stand-in git / node / apt-get / bootstrap)
 *   install_all.bat (Windows - its steps checked as text: winget + the direct-download fall-backs, the clone, start.bat;
 *   no Windows here to run it) */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0, skip = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const SH = read("install_all.sh");

check("install_all.command (macOS double-click) is the same script as install_all.sh - either works ON ITS OWN", read("install_all.command") === SH);
const syn = spawnSync("sh", ["-n", path.join(R, "install_all.sh")], { encoding: "utf8" });
check("install_all.sh: valid sh", syn.status === 0, syn.stderr);

if (process.platform === "win32") { skip++; console.log("SKIP: the sh runs need a Unix shell"); }
else {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "install616_"));
  const log = path.join(T, "calls.log");
  const bin = path.join(T, "bin"); fs.mkdirSync(bin);
  // a PATH with the basics only (no git, no node) - each tool linked from the system
  for (const t of ["sh", "uname", "cat", "chmod", "mkdir", "dirname", "printf", "sleep", "id", "rm", "touch", "env", "cp"]) {
    for (const d of ["/usr/bin", "/bin"]) { const f = path.join(d, t); if (fs.existsSync(f)) { try { fs.symlinkSync(f, path.join(bin, t)); } catch { /* there */ } break; } }
  }
  const tool = (dir, name, body) => { const f = path.join(dir, name); fs.writeFileSync(f, "#!/bin/sh\necho \"" + name + " $*\" >> \"" + log + "\"\n" + body + "\n"); fs.chmodSync(f, 0o755); };
  // a stand-in app the stand-in git "clones"
  const appBody = (dir) => [
    `mkdir -p "${dir}/misc" "${dir}/installer"`, `echo x > "${dir}/misc/server.js"`,
    `printf '#!/bin/sh\\necho "BOOTSTRAP $*" >> "${log}"\\n' > "${dir}/installer/bootstrap.sh"`,
    `printf '#!/bin/sh\\necho "START" >> "${log}"\\n' > "${dir}/misc/bitgen-studio.sh"`].join("\n");
  const gitBin = path.join(T, "gitbin"); fs.mkdirSync(gitBin);
  tool(gitBin, "git", `if [ "$1" = clone ]; then D="$3"; ${appBody('$D')}; fi\n[ "$1" = --version ] && echo "git version 2.99.0"\nexit 0`);
  const nodeBin = path.join(T, "nodebin"); fs.mkdirSync(nodeBin);
  tool(nodeBin, "node", `[ "$1" = --version ] && echo v22.20.0\nexit 0`);
  const curlBin = path.join(T, "curlbin"); fs.mkdirSync(curlBin); tool(curlBin, "curl", "exit 0"); tool(curlBin, "xz", "exit 0");
  const run = (dir, file, PATHS, env) => { fs.writeFileSync(log, ""); const r = spawnSync("sh", [path.join(dir, file)], { encoding: "utf8", env: Object.assign({ PATH: PATHS.join(":"), HOME: T }, env || {}), timeout: 20000 }); return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), calls: fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean) }; };

  // A: the file ON ITS OWN in an empty folder, Git there, no Node.js: clone next to it, then the first-start install
  const A = path.join(T, "A"); fs.mkdirSync(A); fs.copyFileSync(path.join(R, "install_all.sh"), path.join(A, "install_all.sh"));
  let r = run(A, "install_all.sh", [gitBin, curlBin, bin]);
  check("on its own (Git there, no Node.js): clones the repo into ./Bitgen-Studio, then the first start installs Node.js etc. (installer/bootstrap.sh)",
    r.code === 0 && r.calls.includes("git clone https://github.com/Tim-byte-dev/Bitgen-Studio " + path.join(A, "Bitgen-Studio")) && r.calls.includes("BOOTSTRAP") && /inside the app folder \(runtime\/node\)/.test(r.out), r);
  // A again: the clone is there - not cloned twice
  r = run(A, "install_all.sh", [gitBin, curlBin, bin]);
  check("…run again: the clone is found (no second clone)", !r.calls.some((c) => /^git clone/.test(c)) && r.calls.includes("BOOTSTRAP"), r.calls);
  // B: installed (node_modules/express + Node.js 18+): just starts
  fs.mkdirSync(path.join(A, "Bitgen-Studio", "node_modules", "express"), { recursive: true });
  r = run(A, "install_all.sh", [gitBin, nodeBin, curlBin, bin]);
  check("installed (its Node packages + Node.js 18+): it just starts (misc/bitgen-studio.sh) - nothing installed", r.code === 0 && JSON.stringify(r.calls.filter((c) => !/^(node|git) /.test(c))) === JSON.stringify(["START"]), r);
  // C: no Git on Linux: the package manager installs it (a stand-in apt-get that brings a git)
  if (process.platform === "linux") {
    const aptBin = path.join(T, "aptbin"); fs.mkdirSync(aptBin);
    tool(aptBin, "apt-get", `if [ "$1" = install ]; then cp "${path.join(gitBin, "git")}" "${aptBin}/git"; fi\nexit 0`);
    tool(aptBin, "sudo", `exec "$@"`);
    const C = path.join(T, "C"); fs.mkdirSync(C); fs.copyFileSync(path.join(R, "install_all.sh"), path.join(C, "install_all.sh"));
    r = run(C, "install_all.sh", [aptBin, curlBin, bin]);
    check("no Git (Linux): installed with the package manager (apt-get install -y git), then the clone", r.calls.some((c) => /apt-get install -y git$/.test(c)) && r.calls.some((c) => /^git clone /.test(c)) && r.calls.includes("BOOTSTRAP"), r.calls);
  } else { skip++; console.log("SKIP: the apt-get leg is Linux only"); }
  // D: BITGEN_NO_START: installs, does not open
  const Dd = path.join(T, "D"); fs.mkdirSync(Dd); fs.copyFileSync(path.join(R, "install_all.sh"), path.join(Dd, "install_all.sh"));
  r = run(Dd, "install_all.sh", [gitBin, curlBin, bin], { BITGEN_NO_START: "1" });
  check("BITGEN_NO_START=1: the first-start install without opening it (bootstrap --no-launch)", r.calls.includes("BOOTSTRAP --no-launch"), r.calls);
  // E: in the app folder itself (a zip / a clone): no clone
  const E = path.join(T, "E"); fs.mkdirSync(E); spawnSync("sh", ["-c", appBody(E)]); fs.copyFileSync(path.join(R, "install_all.sh"), path.join(E, "install_all.sh"));
  r = run(E, "install_all.sh", [gitBin, curlBin, bin]);
  check("inside a bitGen Studio folder (unzipped / cloned): that folder is used - no clone", !r.calls.some((c) => /^git clone/.test(c)) && r.calls.includes("BOOTSTRAP"), r.calls);
  fs.rmSync(T, { recursive: true, force: true });
}

const B = read("install_all.bat");
check("install_all.bat: CRLF line ends (cmd), kept so in the repo (.gitattributes -text - GitHub's raw file is CRLF too)", /\r\n/.test(B) && !/[^\r]\n/.test(B) && /^install_all\.bat -text$/m.test(read(".gitattributes")));
check("install_all.bat: Git, Node.js 18+ and Python 3.10+ installed when missing - winget, else the direct downloads (Git for Windows' latest, the Node.js LTS .msi, python.org 3.12) - then the PATH read again",
  /winget install --id Git\.Git /.test(B) && /winget install --id OpenJS\.NodeJS\.LTS /.test(B) && /winget install --id Python\.Python\.3\.12 /.test(B)
  && /api\.github\.com\/repos\/git-for-windows\/git\/releases\/latest/.test(B) && /nodejs\.org\/dist\/index\.json/.test(B) && /python-3\.12\.10-/.test(B)
  && /GetEnvironmentVariable\('Path','Machine'\)/.test(B) && /process\.versions\.node\.split\('\.'\)\[0\] >= 18/.test(B));
check("install_all.bat works ON ITS OWN: this folder when it is a bitGen folder, else git clone into .\\Bitgen-Studio; then start.bat there",
  /if exist "%~dp0misc\\server\.js" goto :haveapp/.test(B) && /git clone "%REPO%" "%~dp0Bitgen-Studio"/.test(B) && /set "REPO=https:\/\/github\.com\/Tim-byte-dev\/Bitgen-Studio"/.test(B) && /call "%APP%start\.bat"/.test(B));
check("install_all.bat: no folder path echoed inside a ( ) block (a path with brackets would break it), no \\\" in its PowerShell",
  !/\(\s*\r\n[^)]*%APP%[^)]*\)/.test(B) && !(B.match(/%PS% "[^\r\n]*/g) || []).some((l) => /\\"/.test(l)));
const ZM = read("scripts/make_zips.sh");
check("the zips and the repo carry install_all.* (nothing in make_zips leaves them out)", !/install_all/.test(ZM));
check("server.js untouched by this release", !/install_all/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed` + (skip ? `, ${skip} skipped` : ""));
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);

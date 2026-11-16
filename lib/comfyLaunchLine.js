/* bitGen Studio — lib/comfyLaunchLine.js (2.805.0): THE PYTHON + main.py LINE INSIDE A ComfyUI LAUNCHER.
 * Tim (2.805.0): "in gpu docker, when i select one of my gpu, it fails, when i select local it works."
 * Why it failed: a card's own ComfyUI (lib/gpuCards.js) needs --port + --cuda-device on ComfyUI's main.py, and Settings ▸ ComfyUI's
 * launcher was a .bat (ComfyUI portable's run_nvidia_gpu.bat - the usual Windows setup) or a custom launch command, which
 * 2.791.0 refused ("cannot give that a card of its own"). Plain Local runs the .bat as it is, so it worked.
 * Now the launcher is READ (never changed): the line that runs main.py is found, its python + main.py made absolute, and its own
 * flags kept (--fast, --use-sage-attention ...) - only its --port / --cuda-device are dropped (the card's are added by gpuCards).
 * No such line (a launcher that only calls another program) = ComfyUI's own layout (portable python_embeded + ComfyUI\main.py,
 * venv / .venv + main.py), else null (gpuCards says what to do).
 * Pure (scripts/test-launchline805.js): tokens, fromScript, direct, stripOwn. `has` = fs.existsSync (a stand-in in the tests).
 */
"use strict";
const path = require("path");

const PY_BARE = /^(python3?|py)(\.exe)?$/i;
const LEAD = /^(call|exec|start|nohup|cmd|cmd\.exe|\/c|\/d|\/s|\/b|\/k)$/i;

/** split a command line into words; "..." and '...' keep their spaces (the quotes go) */
function tokens(line) {
  const out = [], re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m; while ((m = re.exec(String(line || "")))) out.push(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]);
  return out;
}
const P = (plat) => (plat === "win32" ? path.win32 : path.posix);
const bare = (x) => !/[\\/]/.test(x);
/** the python a bare "python" means in this folder: venv / .venv first (an activated venv), else as written */
function pyIn(dir, plat, has, word) {
  const p = P(plat);
  for (const v of ["venv", ".venv"]) {
    const exe = plat === "win32" ? p.join(dir, v, "Scripts", "python.exe") : p.join(dir, v, "bin", "python");
    if (has(exe)) return exe;
  }
  return word;
}
/** drop the launcher's own --port / --cuda-device (and their values) - the card's are added after */
function stripOwn(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (/^--(port|cuda-device)$/.test(a)) { i++; continue; }
    if (/^--(port|cuda-device)=/.test(a)) continue;
    out.push(a);
  }
  return out;
}
/**
 * text = the launcher's text (a .bat / .cmd / .sh, or a custom launch command), dir = the ComfyUI folder (absolute),
 * plat = process.platform, has(path) -> bool, name = what to call it in `how`
 * -> {cmd, args, cwd, how} | null
 */
function fromScript(text, dir, plat, has, name) {
  const p = P(plat), ok = has || (() => false);
  let cwd = dir;
  const expand = (s) => String(s)
    .replace(/%~dp0\\?/gi, dir + p.sep).replace(/%cd%/gi, cwd)
    .replace(/\$\(\s*dirname\s+"?\$0"?\s*\)\/?/g, dir + p.sep).replace(/\$\{?PWD\}?/g, cwd);
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line0 = raw.trim().replace(/^@/, "");
    if (!line0 || /^(rem\b|::|#)/i.test(line0)) continue;
    for (const seg0 of line0.split(/\s*(?:&&|\|\||;|(?<![>^\d])&(?!\d))\s*/)) {
      const seg = seg0.trim().replace(/^@/, "");
      // cd / pushd before the python line moves where its relative paths start
      const cd = /^(?:cd|chdir|pushd)\s+(?:\/d\s+)?(.+)$/i.exec(seg);
      if (cd) { const to = tokens(expand(cd[1]))[0]; if (to && !/[%$]/.test(to)) cwd = p.resolve(cwd, to); continue; }
      if (!/main\.py/i.test(seg)) continue;
      let t = tokens(expand(seg)).filter((x) => x !== "" && !/^(%\*|\$@|\$\*)$/.test(x));
      // leave out redirections (> log.txt 2>&1)
      { const r = t.findIndex((x) => /^\d?>/.test(x)); if (r > 0) t = t.slice(0, r); }
      while (t.length && LEAD.test(t[0])) t.shift();
      const mi = t.findIndex((x) => /main\.py$/i.test(x));
      if (mi < 1) continue;
      if (t.some((x) => /%[^%\s]+%|\$\{?[A-Za-z_]/.test(x))) return null;   // a variable we cannot know
      let cmd = t[0];
      if (bare(cmd)) { if (PY_BARE.test(cmd)) cmd = pyIn(cwd, plat, ok, cmd); else return null; }
      else cmd = p.resolve(cwd, cmd);
      const args = t.slice(1).map((x, i) => (i + 1 === mi ? p.resolve(cwd, x) : x));
      return { cmd, args: stripOwn(args), cwd, how: "the python line of " + (name || "the launcher") };
    }
  }
  return null;
}
/** ComfyUI's own layout, no launcher (the same order as comfy.detectLaunch after its .bat files) -> {cmd, args, cwd, how} | null */
function direct(dir, plat, has) {
  const p = P(plat), ok = has || (() => false), j = (...a) => p.join(dir, ...a);
  for (const v of ["venv", ".venv"]) {
    const exe = plat === "win32" ? j(v, "Scripts", "python.exe") : j(v, "bin", "python");
    if (ok(exe) && ok(j("main.py"))) return { cmd: exe, args: ["-s", j("main.py")], cwd: dir, how: v + " python + main.py" };
  }
  if (ok(j("python_embeded", "python.exe")) && ok(j("ComfyUI", "main.py")))
    return { cmd: j("python_embeded", "python.exe"), args: ["-s", j("ComfyUI", "main.py"), "--windows-standalone-build"], cwd: dir, how: "embedded python + ComfyUI\\main.py" };
  return null;
}
module.exports = { tokens, fromScript, direct, stripOwn };

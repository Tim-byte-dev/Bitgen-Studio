#!/usr/bin/env node
/* bitGen Studio — the Windows-11 SETUP window pinned (2.220.0; the 2.331.0
 * cross-platform wizard - its behaviour is scripts/test-setup.js).
 *
 * The window itself cannot open on the suite's Linux (no display, no
 * Electron), so this suite does what CAN be proven here: the page is loaded
 * for real in jsdom and its DOM contract asserted; the preload bridge, the
 * main-process wiring, the gate, and start.bat's hand-off are pinned by
 * shape. The first live open happens on Tim's machine — that is said in
 * HANDOVER.md, not hidden. Run: node scripts/test-installer.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got !== undefined ? " -> " + JSON.stringify(got) : "")); }
};

const R = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const HTML = R("electron", "installer.html");
const PRE = R("electron", "installer-preload.js");
const MAIN = R("electron", "main.js");
const BAT = R("start.bat");

/* ---- the page, loaded for real ---- */
const dom = new JSDOM(HTML);
const d = dom.window.document;
const has = (id) => !!d.getElementById(id);

check("title bar exists with minimize + close and NO maximize (fixed-size dialog)",
  has("tbar") && has("w_min") && has("w_close") && !has("w_max"));
check("the title bar drags and its buttons do not (frameless window contract)",
  /#tbar\s*{[^}]*-webkit-app-region:\s*drag/.test(HTML)
  && /#tbar button\s*{[^}]*-webkit-app-region:\s*no-drag/.test(HTML));
check("Win11 installer look: Segoe UI first, accent button, progress bars",
  /font-family:\s*"Segoe UI Variable", "Segoe UI"/.test(HTML) && /button\.b\.accent/.test(HTML)
  && has("ibar") && has("dbar"));
check("2.331.0: it is a WIZARD: welcome -> installing -> models -> downloading -> done, welcome first",
  ["pg_welcome", "pg_install", "pg_models", "pg_dl", "pg_done"].every(has)
  && d.getElementById("pg_welcome").classList.contains("on")
  && !d.getElementById("pg_install").classList.contains("on"));
check("2.331.0: page 1 = the GPU check, ComfyUI new / existing (each with Browse), the node packs, OmniVoice",
  has("hw_gpu") && has("hw_plan") && has("cm_new") && has("dir_new") && has("b_new") && has("cm_ex") && has("dir_ex") && has("b_ex")
  && has("packs") && has("cb_omni") && has("b_install") && /h3setup\.browse\(/.test(HTML));
check("2.331.0: the models page has the Hugging Face token box BEFORE the list",
  has("tok") && has("b_tok") && has("mlist")
  && (d.getElementById("tok").compareDocumentPosition(d.getElementById("mlist")) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING));
check("skip is a small link (h3setup.skip); the close button closes",
  /\$\("b_skip"\)\.onclick = \(\) => h3setup\.skip\(\);/.test(HTML)
  && /\$\("w_close"\)\.onclick = \(\) => h3setup\.close\(\);/.test(HTML));
check("a failed setup reaches the done page with an honest message and setup.log named",
  /Setup stopped/.test(HTML) && /setup\.log/.test(HTML));
check("no node access in the page — everything through the h3setup bridge",
  !/require\(/.test(HTML));

/* ---- the bridge ---- */
check("preload keeps contextIsolation: exposeInMainWorld, no node handed to the page",
  /contextBridge\.exposeInMainWorld\("h3setup"/.test(PRE) && !/nodeIntegration/.test(PRE));
for (const fn of ["detect", "browse", "inspect", "install", "token", "models", "disk", "download", "finish", "skip", "onEvent"])
  check("bridge exposes " + fn, new RegExp(fn + ":").test(PRE));

/* ---- the main process ---- */
check("setup window is frameless, fixed-size, uses installer-preload and loads installer.html",
  /resizable: false/.test(MAIN) && /installer-preload\.js/.test(MAIN)
  && /loadFile\(path\.join\(__dirname, "installer\.html"\)\)/.test(MAIN));
check("2.331.0: the gate is setupRun.wanted(setupNeeded) - .setup-pending, H3_SETUP=1, the old no-ComfyUI gate",
  /setupNeeded\(ROOT\)/.test(MAIN) && /Setup\(\)\.wanted\(fallback\)/.test(MAIN) && /H3_SETUP === "1"/.test(MAIN));
check("2.331.0: the engine is lib/setupRun.js (cross-platform), not PowerShell scripts spawned from main",
  /require\(path\.join\(ROOT, "lib", "setupRun"\)\)/.test(MAIN) && !/get-comfy\.ps1/.test(MAIN));
check("browse is the native dialog with New-Folder and typed-new-path support",
  /showOpenDialog/.test(MAIN)
  && /"openDirectory", "createDirectory", "promptToCreate"/.test(MAIN));
check("skip writes the SAME .declined marker start.bat and the gate honour",
  /setup:skip/.test(MAIN) && /comfy", "\.declined"/.test(MAIN));
check("the hand-off starts the server then the app window, then closes setup",
  /async function launchApp\(\)/.test(MAIN)
  && /await startServer\(\);/.test(MAIN.slice(MAIN.indexOf("async function launchApp")))
  && /sw\.close\(\)/.test(MAIN));

/* ---- the gate, functionally (same helper the batch flow relies on) ---- */
{
  const os = require("os");
  const C = require("../lib/comfy");
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "bgsetup-"));
  check("gate: a bare tree needs setup", C.setupNeeded(t) === true);
  fs.mkdirSync(path.join(t, "comfy"), { recursive: true });
  fs.writeFileSync(path.join(t, "comfy", ".declined"), "");
  check("gate: a declined tree does not", C.setupNeeded(t) === false);
  fs.rmSync(path.join(t, "comfy", ".declined"));
  fs.mkdirSync(path.join(t, "comfy", "ComfyUI"), { recursive: true });
  fs.writeFileSync(path.join(t, "comfy", "ComfyUI", "main.py"), "");
  check("gate: an installed tree does not", C.setupNeeded(t) === false);
  fs.rmSync(t, { recursive: true, force: true });
}

/* ---- adoption of a CHOSEN folder, functionally ---- */
{
  const os = require("os");
  const C = require("../lib/comfy");
  // adoptInstall writes the REAL custom.settings (config is not base-scoped),
  // so snapshot and restore it — a test that leaves a bogus engine folder and
  // autostart behind poisons every later suite in the tree.
  const CS = path.join(__dirname, "..", "custom.settings");
  const before = fs.existsSync(CS) ? fs.readFileSync(CS) : null;
  const b = fs.mkdtempSync(path.join(os.tmpdir(), "bgadopt-"));
  const chosen = path.join(b, "my", "engines", "comfystuff");
  fs.mkdirSync(path.join(chosen, "ComfyUI"), { recursive: true });
  fs.writeFileSync(path.join(chosen, "ComfyUI", "main.py"), "");
  let r = null;
  try { r = C.adoptInstall(b, chosen); }
  finally { before === null ? fs.rmSync(CS, { force: true }) : fs.writeFileSync(CS, before); }
  check("adopt(chosen): resolves the launchable ComfyUI inside the chosen folder + autostart ON",
    !!r && r.adopted === true && /comfystuff[\/\\]ComfyUI$/.test(r.dir.replace(/\//g, path.sep))
    && r.autostart === true, r);
  fs.rmSync(b, { recursive: true, force: true });
}

/* ---- start.bat hands the console prompt to the window ---- */
check("start.bat: question-free — the wizard owns setup; browser mode is pointed at the ps1",
  !/set \/p/.test(BAT) && /setup window will handle it/.test(BAT)
  && /run (misc\\)?get-comfy\.ps1 yourself/.test(BAT));

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

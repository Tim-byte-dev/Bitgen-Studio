#!/usr/bin/env node
/* bitGen Studio — scripts/test-install601.js (2.601.0): ⟳ REINSTALL that really reinstalls + the install STATUS helper.
 * Tim: "if an addon/package/model has been installed change the button to reinstall", then "when installing an addon -
 * let the user know the status next to the button and disable the button when download/install starts. do this with all
 * buttons so user knows whats happening."
 *   static/installbtn.js     label(): Install -> ⟳ Reinstall, Download -> ⟳ Download again; lastLine() of a job log
 *   lib/reinstallForce.js    on / run / wrap (off again after a throw)
 *   lib/setupModels.download a file already there: skipped normally, fetched AGAIN with {force} or inside a reinstall
 *                            (a stand-in Hugging Face, BITGEN_HF_BASE)
 *   lib/addons.start         {reinstall: true} runs the add-on's install with the flag on; routes pass reinstall / force
 *   lib/comfy.installVerdict the ComfyUI installs' end: running / ✓ / ✗ (pip's resolver "ERROR:" note is not a failure)
 *   wiring                   every install button the request names uses it */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-inst601-"));
  let srv = null;
  try {
    const IB = require("../static/installbtn.js");
    check("label: ⬇ Install sd-cli (…) -> ⟳ Reinstall sd-cli (…); Install OmniVoice -> ⟳ Reinstall OmniVoice; ⚙ Install -> ⟳ Reinstall",
      IB.label("⬇ Install sd-cli (latest CUDA build, ~900 MB)", true) === "⟳ Reinstall sd-cli (latest CUDA build, ~900 MB)" && IB.label("Install OmniVoice", true) === "⟳ Reinstall OmniVoice" && IB.label("⚙ Install", true) === "⟳ Reinstall");
    check("label: ⤓ Download -> ⟳ Download again; ⬇ Install / repair -> ⟳ Reinstall; not installed = unchanged; already Reinstall stays",
      IB.label("⤓ Download", true) === "⟳ Download again" && IB.label("⬇ Install / repair", true) === "⟳ Reinstall" && IB.label("⬇ Install Sage", false) === "⬇ Install Sage" && IB.label("⟳ Reinstall Sage", true) === "⟳ Reinstall Sage");
    check("lastLine: the last real log line (no blank, no bar, the [tag] off, long ones cut)",
      IB.lastLine(["[worker] installing torch", "  ", "|████████|", ""]) === "installing torch" && IB.lastLine(["x".repeat(200)]).length === 88 && IB.lastLine([]) === "");

    const F = require("../lib/reinstallForce");
    let seen = null;
    await F.run(async () => { await new Promise((r) => setTimeout(r, 5)); seen = F.on(); });
    let threw = false; try { await F.run(() => { throw new Error("x"); }); } catch { threw = true; }
    const lines = []; await F.wrap(async () => F.on())((l) => lines.push(l));
    check("reinstallForce: on inside run (across an await), off after; off again after a throw; wrap says so in the log", seen === true && !F.on() && threw && /every file is fetched again/.test(lines[0]), { seen, on: F.on(), lines });

    // a stand-in Hugging Face
    let hits = 0;
    srv = http.createServer((q, r) => { hits++; r.writeHead(200, { "Content-Length": 6 }); r.end("NEWBIN"); });
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    process.env.BITGEN_HF_BASE = `http://127.0.0.1:${srv.address().port}`;
    const M = require("../lib/setupModels");
    const m = { id: "t", repo: "a/b", file: "w.bin", dest: "models/x", size: 6, available: true };
    const paths = { app: tmp };
    const dest = M.destPath(m, paths);
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, "OLDBIN");
    const r1 = await M.download(m, { paths, engine: "builtin", log: () => {} });
    check("download: a file already there is skipped (no request)", r1.ok && r1.skipped && hits === 0 && fs.readFileSync(dest, "utf8") === "OLDBIN", { r1, hits });
    const log2 = [];
    const r2 = await M.download(m, { paths, engine: "builtin", force: true, log: (l) => log2.push(l) });
    check("download {force}: fetched AGAIN and put in place (the log says so)", r2.ok && !r2.skipped && hits === 1 && fs.readFileSync(dest, "utf8") === "NEWBIN" && log2.some((l) => /downloading it again/.test(l)), { r2, hits, log2 });
    fs.writeFileSync(dest, "OLDBIN");
    const r3 = await F.run(() => M.download(m, { paths, engine: "builtin", log: () => {} }));
    check("download inside a reinstall (the add-on job's flag): fetched again too", r3.ok && hits === 2 && fs.readFileSync(dest, "utf8") === "NEWBIN", { r3, hits });

    const A = require("../lib/addons");
    A._reset();
    let flag = null;
    A.LIST.push({ id: "zz601", label: "zz", install: () => async () => { flag = F.on(); return { ok: true }; } });
    A.start("zz601", "install", { reinstall: true });
    for (let i = 0; i < 40 && A.job().state === "running"; i++) await new Promise((r) => setTimeout(r, 20));
    const f1 = flag; A._reset(); flag = null;
    A.start("zz601", "install", {});
    for (let i = 0; i < 40 && A.job().state === "running"; i++) await new Promise((r) => setTimeout(r, 20));
    check("addons.start: {reinstall: true} runs the install with the flag on; a plain install without", f1 === true && flag === false && A.job().state === "done", { f1, flag });
    A.LIST.pop(); A._reset();
    const RA = rd("routes", "addons.js"), RS = rd("routes", "setup.js"), RUN = rd("lib", "setupRun.js");
    check("routes: /api/addons/:id/install passes reinstall:true; /api/setup/download passes force:true; setupRun hands it to every file",
      /reinstall = \(req\.body \|\| \{\}\)\.reinstall === true/.test(RA) && /force: b\.force === true/.test(RS) && /engine, force, dirs/.test(RUN));
    const FA = ["solarAddon", "fasth3Addon", "featureAddons", "visionAddon"].filter((n) => !/reinstallForce"\)\.on\(\)/.test(rd("lib", n + ".js")));
    check("the add-ons' own 'already there' checks give way in a reinstall (solar, fasth3, feature, vision)", FA.length === 0, FA);

    const C = require("../lib/comfy");
    const v1 = C.installVerdict(["[kitchen] installing x", "ERROR: pip's dependency resolver does not currently take into account", "Successfully installed comfy-kitchen", "[kitchen] install finished — restart ComfyUI to load the kernels"], false);
    const v2 = C.installVerdict(["[sage] Collecting x", "[sage] pip exited with code 1"], false);
    const v3 = C.installVerdict(["[veda] Cloning into"], true);
    check("comfy.installVerdict: finished = ✓ (pip's resolver note is not a failure), exit 1 = ✗ with the line, running = its last line",
      v1.ok && /restart ComfyUI/.test(v1.text) && v2.ok === false && /exited with code 1/.test(v2.error) && v3.running && v3.text === "Cloning into", { v1, v2, v3 });
    check("comfy: the install-state route + Comfy Kitchen's reinstall (--force-reinstall --no-deps, never ComfyUI's torch)",
      /\/api\/comfy\/install-state/.test(rd("routes", "index.js")) && /again \? \["--force-reinstall", "--no-deps"\]/.test(rd("lib", "comfy.js")));

    // the wiring: every button the request names
    const IH = rd("static", "index.html");
    const W = {
      "index.html loads installbtn.js": /<script src="\/static\/installbtn\.js"><\/script>/.test(IH),
      "faster-whisper / OmniVoice follow their job": /H3Install\.job\(btn, j\.id, \{ doing: "Installing " \+ name/.test(IH),
      "sd-cli: ⟳ Reinstall + its job": /H3Reinstall\.set\(\$\("s_sdinstall"\), !!h\.sd_cli\)/.test(IH) && /H3Install\.job\(b, j\.id, \{ doing: "Installing sd-cli…"/.test(IH),
      "Comfy Kitchen / Sage / Spectrum / node packs follow the ComfyUI install": /comfyInstallFollow\(kb,/.test(IH) && /comfyInstallFollow\(btn, "Installing " \+ name/.test(IH) && /vaInstall\(k, \{[\s\S]*?e\.currentTarget\)\)/.test(IH),
      "extensions from a folder": /H3Install\.start\(xb, "Installing the extensions…"\)/.test(IH),
      "speech engines ⟳ Reinstall": /re\(\$\("s_asrinstall"\), j\.installed/.test(rd("static", "speechengines.js")) && /re\(\$\("s_omniinstall"\)/.test(rd("static", "speechengines.js")),
      "add-on cards: the status beside the buttons": /function chipPaint\(\)/.test(rd("static", "addons.js")) && /reinstall: again/.test(rd("static", "addons.js")),
      "model catalog: ⟳ Download again + status": /⟳ Download again/.test(rd("static", "modelsdlg.js")) && /force: again_\(ids\) > 0/.test(rd("static", "modelsdlg.js")) && /"Downloading " \+ Math\.min/.test(rd("static", "modelsdlg.js")),
      "LoRA trainer": /window\.H3Install\.job\(b, id, \{ doing: "Installing " \+ eng/.test(rd("static", "loratrain.js")),
      "Civitai ⤓ buttons": /function paintDlButtons\(\)/.test(rd("static", "modelmgr.js")),
      "Viggle (native)": /cur\.vnTimer = setTimeout\(vnState, 2000\)/.test(rd("static", "swapdlg.js")),
      "package upgrade": /⏳ starting the upgrade…/.test(rd("static", "hwpanel.js")),
      "stems (⟳ Reinstall, no longer hidden)": /H\.job\(b, j\.id, \{ doing: "Installing demucs…"/.test(rd("ext", "stemsdock", "stemsdock.js")),
      "AI matte (path layers)": /function matteChip\(mi\)/.test(rd("ext", "timelinedock", "paths.js")),
      "SAM 2 (cut out)": /function samPaint\(sam\)/.test(rd("ext", "timelinedock", "tlcutout.js")),
      "Select ▸ Subject": /const sbWords = /.test(rd("ext", "imageeditdock", "pcsubject.js")),
      "Segment Anything": /⟳ Reinstall \/ repair/.test(rd("ext", "imageeditdock", "pcsam.js")) && /id="ssInst"/.test(rd("ext", "imageeditdock", "pcsam.js")),
    };
    const miss = Object.keys(W).filter((k) => !W[k]);
    check("wired: " + Object.keys(W).length + " install / download places use the reinstall label + the status beside the button", miss.length === 0, miss);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { if (srv) srv.close(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

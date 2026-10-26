#!/usr/bin/env node
/* bitGen Studio — scripts/test-llamaengine596.js (2.596.0): Settings ▸ LLM ▸ ⟳ UPDATE LLAMA.CPP + busy buttons.
 * Tim: "add update llama in llm tab in settings. when updating, loading saving, onlclick show the action is being done".
 *   lib/llamaEngine.js    the version (VERSION.txt / llama-server --version), the newest release with a build for this
 *                         computer (GitHub, kept 15 min), newer(), Install refused when there, Update = stop the servers
 *                         FIRST, then the newest over the engine folder Settings ▸ LLM points at (force), one job at a time
 *   lib/setupLlama.js     install(..., {dest, force}) puts a release zip over an existing engine + writes VERSION.txt
 *                         (macOS / Linux path; a real zip, a fake GitHub)
 *   routes/llamaEngine.js GET /api/llm/engine?check=1 (update: true), POST update (409 while one runs), GET job lines
 *   the page              ⟳ Update llama.cpp + the engine line + its log in the LLM tab; static/busy.js, static/llmtab.js
 * No server of the app; temp folders. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-llama596-"));
const core = require("../lib/core");
const ENG = path.join(tmp, "My Engine");
const EXE = path.join(ENG, process.platform === "win32" ? "llama-server.exe" : "llama-server");
let running = { proc: null, file: "" };
core.llmPaths = () => ({ dir: path.join(tmp, "llm"), eng: ENG, exe: EXE });
core.llamaState = () => running;
const E = require("../lib/llamaEngine");
const wait = async (f, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 10000)) { if (f()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };

(async () => {
  try {
    check("num / newer: b10601 is newer than b10456; nonsense = 0", E.num("b10456") === 10456 && E.newer("b10456", "b10601") && !E.newer("b10601", "b10456") && E.num("v0.3.0") === 0);
    let i = E.info();
    check("info: nothing there = not installed, no version", !i.installed && i.version === "" && i.dir === ENG);
    fs.mkdirSync(ENG, { recursive: true }); fs.writeFileSync(EXE, "x"); fs.writeFileSync(path.join(ENG, "VERSION.txt"), "b10456 cuda-13.3\n");
    i = E.info();
    check("info: installed, its version from VERSION.txt (get-llama.ps1 writes it)", i.installed && i.version === "b10456", i);
    const asset = process.platform === "win32" ? "llama-b10601-bin-win-cuda-13.3-x64.zip" : process.platform === "darwin" ? (process.arch === "arm64" ? "llama-b10601-bin-macos-arm64.zip" : "llama-b10601-bin-macos-x64.zip") : "llama-b10601-bin-ubuntu-vulkan-x64.zip";
    let calls = 0;
    const rels = [{ tag_name: "v0.3.0", assets: [] }, { tag_name: "b10602", assets: [{ name: "llama-b10602-xcframework.zip" }] }, { tag_name: "b10601", html_url: "https://github.com/ggml-org/llama.cpp/releases/tag/b10601", assets: [{ name: asset, browser_download_url: "https://x/" + asset }] }];
    E._set({ getJson: async () => { calls++; return { status: 200, json: rels }; } });
    const L1 = await E.latest(), L2 = await E.latest();
    check("latest: the newest release WITH a build for this computer (b10602 has none, v0.3.0 is notes), asked once in 15 min", L1.tag === "b10601" && L2.tag === "b10601" && calls === 1, { L1, calls });
    E._set({ getJson: async () => ({ status: 403 }) });
    const L3 = await E.latest(true);
    check("latest: GitHub refusing = words, never a throw", /GitHub did not answer \(403\)/.test(L3.error), L3);
    const r0 = E.start("install");
    check("Install while it is there = refused (use ⟳ Update)", /already installed \(b10456\).*Update/.test(r0.error || ""), r0);

    // ---- Update: the servers stop FIRST, then the newest goes over THIS engine folder
    const order = [];
    running = { proc: {}, file: "qwen.gguf" };
    E._set({ stopAll: async (log) => { order.push("stop"); log("[..] stopping the LLM server", false); running = { proc: null }; },
      install: async (base, ctx) => { order.push("install"); await new Promise((r) => setTimeout(r, 300)); ctx.log("Downloading llama-b10601…", false); fs.writeFileSync(path.join(ctx.dest, "VERSION.txt"), "b10601 cuda-13.3\n"); order.push(JSON.stringify({ dest: ctx.dest, force: ctx.force })); return { ok: true }; } });
    const r1 = E.start("update");
    const r2 = E.start("update");
    check("one at a time: a second Update while one runs is refused", r1.ok && /already being updated/.test(r2.error || ""), { r1: !!r1.ok, r2 });
    await wait(() => E.job().state !== "running");
    const j = E.job();
    check("Update: the LLM server stopped first, then the newest build over the engine folder Settings ▸ LLM points at (force); before b10456 -> after b10601",
      j.state === "done" && order[0] === "stop" && order[1] === "install" && order[2] === JSON.stringify({ dest: ENG, force: true }) && j.before === "b10456" && j.after === "b10601" && j.lines.some((l) => /stopping the LLM server/.test(l)) && j.lines.some((l) => /llama\.cpp b10601 is in/.test(l)), { j, order });
    E._set({ stopAll: async () => {}, install: async () => ({ ok: false, error: "get-llama.ps1 exited 1" }) });
    E.start("update"); await wait(() => E.job().state !== "running");
    check("a failed update: the job says why", E.job().state === "error" && /get-llama\.ps1 exited 1/.test(E.job().error), E.job());

    // ---- setupLlama.install over an existing engine (macOS / Linux path) with a real zip
    if (process.platform !== "win32") {
      const SL = require("../lib/setupLlama");
      const zipDir = path.join(tmp, "z"); fs.mkdirSync(path.join(zipDir, "build", "bin"), { recursive: true });
      fs.writeFileSync(path.join(zipDir, "build", "bin", "llama-server"), "NEW"); fs.writeFileSync(path.join(zipDir, "build", "bin", "libllama.so"), "lib");
      const zipFile = path.join(tmp, asset);
      require("child_process").execFileSync("python3", ["-c", `import zipfile,os,sys\nz=zipfile.ZipFile(sys.argv[1],'w')\nfor r,d,f in os.walk(sys.argv[2]):\n  for n in f: p=os.path.join(r,n); z.write(p, os.path.relpath(p, sys.argv[2]))\nz.close()`, zipFile, zipDir]);
      fs.writeFileSync(EXE, "OLD");
      const skip = await SL.install(tmp, { log: () => {}, dest: ENG });
      const r = await SL.install(tmp, { log: () => {}, dest: ENG, force: true, getJson: async () => ({ status: 200, json: rels }), download: async (url, dest) => { fs.copyFileSync(zipFile, dest); return { ok: true }; } });
      check("setupLlama.install: without force an engine that is there is kept; with force (Update) the newest replaces it in that folder + VERSION.txt", skip.skipped && r.ok && r.tag === "b10601"
        && fs.readFileSync(EXE, "utf8") === "NEW" && fs.readFileSync(path.join(ENG, "VERSION.txt"), "utf8").trim() === "b10601" && (fs.statSync(EXE).mode & 0o111) !== 0, r);
    } else check("setupLlama.install on Windows passes -Dest and -Cuda to get-llama.ps1", /args\.push\("-Dest", dest\)/.test(rd("lib", "setupLlama.js")));
    check("get-llama.ps1 takes -Dest (the engine folder) and writes VERSION.txt", /\[string\] \$Dest = ""/.test(rd("misc", "get-llama.ps1")) && /\$dest = if \(\$Dest\)/.test(rd("misc", "get-llama.ps1")) && /VERSION\.txt/.test(rd("misc", "get-llama.ps1")));

    // ---- the routes
    E._reset();
    E._set({ getJson: async () => ({ status: 200, json: rels }), stopAll: async () => {}, install: async (b, ctx) => { await new Promise((r) => setTimeout(r, 400)); ctx.log("Downloading…", false); return { ok: true }; } });
    fs.writeFileSync(path.join(ENG, "VERSION.txt"), "b10456\n");
    const express = require("express");
    const app = express(); require("../routes/llamaEngine").mount(app);
    const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const u = `http://127.0.0.1:${srv.address().port}`;
    const g = await (await fetch(u + "/api/llm/engine?check=1")).json();
    check("GET /api/llm/engine?check=1: installed b10456, latest b10601, update: true", g.installed && g.version === "b10456" && g.latest.tag === "b10601" && g.update === true && g.job === null, g);
    const p1 = await fetch(u + "/api/llm/engine/update", { method: "POST" }), p2 = await fetch(u + "/api/llm/engine/update", { method: "POST" });
    check("POST update: started; a second = 409", p1.status === 200 && p2.status === 409);
    await wait(() => E.job().state !== "running");
    const jj = await (await fetch(u + "/api/llm/engine/job?from=0")).json();
    check("GET /api/llm/engine/job: the lines, n, done", jj.job.state === "done" && jj.job.lines.some((l) => /Downloading/.test(l)) && jj.job.n === jj.job.lines.length, jj);
    srv.close();
    check("routes/index.js mounts routes/llamaEngine.js (never server.js)", /require\("\.\/llamaEngine"\)\.mount\(app\)/.test(rd("routes", "index.js")) && !/llamaEngine/.test(rd("misc", "server.js")));

    // ---- the page (pure parts + markup)
    const BZ = require("../static/busy.js"), LT = require("../static/llmtab.js");
    check("busy label: the seconds after 2 s", BZ.label("Saving", 0) === "Saving…" && BZ.label("Updating llama.cpp", 12) === "Updating llama.cpp… 12 s");
    check("the engine line's words", LT.engineWords({ installed: false, dir: "D:\\llama" }) === "llama.cpp is not installed - ⬇ Install engine puts it in D:\\llama"
      && LT.engineWords({ installed: true, version: "b10456", latest: { tag: "b10601" }, update: true }) === "llama.cpp b10456 · the newest is b10601 - ⟳ Update available"
      && /up to date \(the newest is b10601\)/.test(LT.engineWords({ installed: true, version: "b10601", latest: { tag: "b10601" }, update: false }))
      && /could not check/.test(LT.engineWords({ installed: true, version: "b1", latest: { error: "x" } })));
    const html = rd("static", "index.html"), js = rd("static", "llmtab.js");
    check("the LLM tab: ⟳ Update llama.cpp, the engine line + its log; busy.js + llmtab.js loaded; Start waits for the model to load; Stop / Rescan / Scan / Save show it",
      /id="s_llmupdate"/.test(html) && /⟳ Update llama\.cpp/.test(html) && /id="s_llmengver"/.test(html) && /id="s_llmenglog"/.test(html)
      && /<script src="\/static\/busy\.js">/.test(html) && /<script src="\/static\/llmtab\.js">/.test(html)
      && /running\.ready/.test(js) && /"s_llmstop"/.test(js) && /"s_llmrescan"/.test(js) && /"s_visscan"/.test(js) && /"s_save"/.test(js) && /\/api\/llm\/engine\/" \+ act/.test(js));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

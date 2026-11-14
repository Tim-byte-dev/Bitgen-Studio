#!/usr/bin/env node
/* bitGen Studio — 2.781.3: ⟳ RESTART COMFYUI IN A RUNNING POD'S ITEM (static/podsdock.js button -> static/podfiles.js restartBtn
 * -> POST /api/pods/:id/comfy/restart -> lib/podVram.js apply(id, port, {force}): the running ComfyUI stopped and started again
 * with its own command (the GPU memory way), even when nothing changed). Pure + jsdom.
 * Tim (verbatim): "ok, can u add a restart comfyui button to the pod info" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PV = require("../lib/podVram");
(async () => {
  const forced = PV.applyCode("/w/ComfyUI", 8188, "gpu", true), plain = PV.applyCode("/w/ComfyUI", 8188, "gpu");
  check("the pod's Python: forced = restarted even when its arguments are already right; Apply alone still skips that", /FORCE = True/.test(forced) && /FORCE = False/.test(plain) && /if new == argv and not FORCE:/.test(forced));
  check("…its own command kept (python, main.py, --listen, --port …), the GPU memory flag as picked, its env + folder; not the pod's first process",
    /keep = \[a for a in argv if a not in/.test(forced) && /subprocess\.Popen\(new, cwd=cwd, env=env/.test(forced) && /elif pid == 1/.test(forced));
  const RT = rd("routes/podFiles.js");
  check("route POST /api/pods/:id/comfy/restart -> apply(…, {force: true}); the state from GET /api/pods/:id/vram", /app\.post\("\/api\/pods\/:id\/comfy\/restart", wrap\(\(req\) => V\(\)\.apply\(req\.params\.id, .*\{ force: true \}\)\)\);/.test(RT));
  const PD = rd("static/podsdock.js");
  check("PODS ▸ My pods: ⟳ Restart ComfyUI on a RUNNING pod (beside 📁 Files), wired to H3PodFiles.restartBtn",
    /\/RUNNING\/\.test\(p\.status\) \? '<button type="button" class="ghost" data-pdcrs[^>]*>⟳ Restart ComfyUI<\/button>'/.test(PD) && /H3PodFiles\.restartBtn\(crs, p\.id/.test(PD));
  // jsdom: two presses -> the POST; the button says it is restarting; the state polled until done
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><body><div id="pdPods"><div class="pdRow" data-pod="p1"><div class="pdStats"></div><button id="b">⟳ Restart ComfyUI</button></div></div></body>', { pretendToBeVisual: true, runScripts: "outside-only" });
  const W = dom.window, posts = []; let polls = 0;
  W.fetch = (u, o) => {
    const ok = (j) => Promise.resolve({ json: () => Promise.resolve(j) });
    if (o && o.method === "POST") { posts.push(u); return ok({ running: true, note: "restarting ComfyUI" }); }
    if (/\/vram$/.test(u)) { polls++; return ok({ state: polls < 2 ? { running: true, note: "waiting for ComfyUI to answer again" } : { running: false, ok: true, note: "ComfyUI restarted with --disable-dynamic-vram" } }); }
    return ok({ mode: "gpu" });
  };
  W.eval(rd("static/podfiles.js"));
  const b = W.document.getElementById("b");
  W.H3PodFiles.restartBtn(b, "p1", 0);
  b.click();
  check("first press asks (nothing sent)", b.textContent === "⟳ Sure? Press again" && !posts.length, b.textContent);
  const b2 = W.document.createElement("button"); b2.textContent = "⟳ Restart ComfyUI"; W.document.querySelector(".pdRow").appendChild(b2);
  W.H3PodFiles.restartBtn(b2, "p1", 0);
  check("…a repainted button remembers the first press", b2.textContent === "⟳ Sure? Press again", b2.textContent);
  b2.click(); await new Promise((ok) => setTimeout(ok, 50));
  check("second press: POST /api/pods/p1/comfy/restart, the button says it is restarting and waits", posts[0] === "/api/pods/p1/comfy/restart" && b2.disabled && /Restarting ComfyUI/.test(b2.textContent), { posts, t: b2.textContent });
  await new Promise((ok) => setTimeout(ok, 7000));
  const line = W.document.querySelector(".pvLine");
  check("…when the pod says done: the button is back and the pod's GPU memory line says what happened", !b2.disabled && b2.textContent === "⟳ Restart ComfyUI" && line && /ComfyUI restarted with --disable-dynamic-vram/.test(line.textContent), { t: b2.textContent, line: line && line.textContent, polls });
  W.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

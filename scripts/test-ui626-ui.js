#!/usr/bin/env node
/* bitGen Studio — 2.626.0 in a REAL browser: PUSHPULL IS NOW THE 📏 SKETCHER; WITH THE PROMPT DOCKER OPEN IT EDITS THE VIEW
 * INTO A REAL PHOTO (an Image asset); → IMAGE EDITOR / → TIMELINE SEND A SKETCHER LAYER.
 * Tim: "change the name of push pull to Sketcher - when sketcher is open and prompt is open go to image mode in prompt and
 * edit - create a real photo of the model in view , when image is sent to timeline or image-editor send it as a sketcher
 * layer and when generated using prompt docker , make it a real image"
 * Against the running app (H3_URL, the e2e stub - its edit model renders a stand-in). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.626.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_sk626_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1700, height: 1150 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN });
    await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3SketcherReal && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    const nm = await ev(() => ({ head: document.querySelector("#pushpulldock > .bhead").textContent, btn: document.getElementById("tX_pushpulldock").textContent }));
    check("the docker is the 📏 Sketcher now (its title and its status-bar button)", /Sketcher/.test(nm.head) && !/PushPull/.test(nm.head) && /Sketcher/.test(nm.btn), nm);

    // the prompt docker shown, the image editor hidden, the Sketcher opened
    const before = await ev(() => {
      const show = (id, btn) => { const d = document.getElementById(id); if (d && d.classList.contains("dockgone")) toggleDockGone(id, btn); if (d && d.classList.contains("collapsed")) toggleCollapse(id); };
      const hide = (id, btn) => { const d = document.getElementById(id); if (d && !d.classList.contains("dockgone")) toggleDockGone(id, btn); };
      show("promptdock", "tP"); hide("imageeditdock", "tIE");
      const gm = document.getElementById("genModeSel"); gm.value = "video"; gm.dispatchEvent(new Event("change"));
      document.getElementById("prompt").value = "";
      const r = { mode: gm.value, style: document.getElementById("styleSel").value };
      const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock");
      return r;
    });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A, null, { timeout: 40000 });
    await p.waitForFunction(() => H3SketcherReal.linked(), null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(800);
    const ln = await ev(async () => { const E = await (await fetch("/api/aiedit/engines")).json(); const st = document.getElementById("styleSel").value; return { linked: H3SketcherReal.linked(), mode: document.getElementById("genModeSel").value, style: st, edit: (E.edit || []).some((x) => x.id === st), prompt: document.getElementById("prompt").value, go: document.getElementById("go").textContent }; });
    check("the Sketcher + the prompt docker open: the prompt docker in 🖼 Image, an EDIT model, \"create a real photo of the model in view\", its button ✏ Edit (Sketcher)",
      ln.linked && ln.mode === "image" && ln.edit && ln.prompt === "create a real photo of the model in view" && /Edit \(Sketcher\)/.test(ln.go), ln);

    // a box, then Generate (the prompt docker's button)
    await ev(() => { const S = H3PushPull.state; const M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [2, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1); M.arch = S.M.arch; S.M = M; S.V.setModel(M); S.V.view("iso"); });
    // 1) the real route: an image EDIT job of the view with the prompt and the edit model (the stub has no ComfyUI - it fails there)
    await ev(() => document.getElementById("go").click());
    await p.waitForFunction(() => /not made|Image assets/.test(document.getElementById("ppMsg").textContent), null, { timeout: 60000 }).catch(() => {});
    const jobs = await api("/api/jobs"), JL = Array.isArray(jobs) ? jobs : (jobs.jobs || []);
    const job = JL.length ? await api("/api/jobs/" + JL[JL.length - 1].id) : null, jp = job && job.params || {};
    check("Generate (the prompt docker's button): the Sketcher's view goes to the EDIT model with the prompt (an image edit job, the view's shape)",
      job && jp.prompt === "create a real photo of the model in view" && ln.style === (jp.style || {}).id && job.meta && job.meta.width % 16 === 0 && job.meta.height % 16 === 0, job && { prompt: jp.prompt, style: (jp.style || {}).name, w: job.meta && job.meta.width, h: job.meta && job.meta.height });
    // 2) a render that comes back (the page's fetches answered here): the result is a REAL image - an Image asset
    let sent = null;
    await p.route("**/api/aiedit", async (rt) => { sent = rt.request().postData() || ""; await rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: [{ id: "zz626job", seed: 1 }], mode: "edit", workflow: "x" }) }); });
    await p.route("**/api/jobs/zz626job", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "zz626job", status: "done", outputs: ["zz626.png"] }) }));
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await p.route("**/outputs/zz626.png*", (rt) => rt.fulfill({ status: 200, contentType: "image/png", body: png }));
    const assets0 = await api("/api/passets");
    await ev(() => document.getElementById("go").click());
    await p.waitForFunction(() => H3SketcherReal.last && H3SketcherReal.last(), null, { timeout: 30000 }).catch(() => {});
    const last = await ev(() => ({ last: H3SketcherReal.last && H3SketcherReal.last(), msg: document.getElementById("ppMsg").textContent }));
    const assets1 = await api("/api/passets");
    const names = (a) => JSON.stringify(a).match(/sketcher_real_[\w.-]*\.png/g) || [];
    check("…its photo is a REAL image: filed in the project's Image assets (sent: the view as the picture, mode edit, the whole picture)",
      last.last && /^sketcher_real_/.test(last.last.asset) && names(assets1).length > names(assets0).length && /Image assets/.test(last.msg) && /name="crop"/.test(sent) && /name="mode"\r\n\r\nedit/.test(sent) && /name="whole"\r\n\r\n1/.test(sent), { last, a0: names(assets0), a1: names(assets1) });
    await p.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});

    // → image editor: a Sketcher layer; sent again = the same layer
    await ev(() => document.getElementById("ppToIE").click());
    await p.waitForFunction(() => window.imageEditorInstance && imageEditorInstance.E && imageEditorInstance.E.S.w > 0, null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const L1 = await ev(() => imageEditorInstance.E.S.layers.map((L) => ({ name: L.name, sk: L.sketcher || null })));
    await ev(() => H3PushPull.toEditor(false)); await p.waitForTimeout(1500);
    const L2 = await ev(() => imageEditorInstance.E.S.layers.map((L) => ({ name: L.name, sk: L.sketcher || null })));
    const sk = (L) => L.filter((x) => x.sk && /^📏 Sketcher · /.test(x.name));
    check("→ Image editor: the view as a 📏 Sketcher layer (tagged with its model); sent again, that layer is updated (no second one)", sk(L1).length === 1 && sk(L2).length === 1 && L2.length === L1.length, { L1, L2 });

    // the link ends when the Sketcher closes: the prompt docker as it was
    await ev(() => { if (H3PushPullFrame.maxed()) H3PushPullFrame.toggleMaxed(false); toggleDockGone("pushpulldock", "tX_pushpulldock"); });
    await p.waitForTimeout(1200);
    const after = await ev(() => ({ linked: H3SketcherReal.linked(), mode: document.getElementById("genModeSel").value, style: document.getElementById("styleSel").value, prompt: document.getElementById("prompt").value }));
    check("the Sketcher closed: the prompt docker's mode and style come back, the words it put there go", !after.linked && after.mode === before.mode && after.style === before.style && after.prompt === "", { before, after });

    // → timeline: a Sketcher layer
    await ev(() => { toggleDockGone("pushpulldock", "tX_pushpulldock"); });
    await p.waitForTimeout(500);
    const tl = await ev(async () => { await H3PushPull.toTimeline(); await new Promise((r) => setTimeout(r, 1200)); const t = document.getElementById("timelinedock"); return { msg: document.getElementById("ppMsg").textContent, has: !!t && t.textContent.includes("📏 Sketcher · ") }; });
    check("→ Timeline: a 📏 Sketcher layer (the model in 3D)", /Sketcher layer/.test(tl.msg) && tl.has, tl);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();

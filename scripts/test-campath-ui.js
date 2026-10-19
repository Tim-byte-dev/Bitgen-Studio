#!/usr/bin/env node
/* bitGen Studio — 2.399.0 in a REAL browser: the timeline's 🎥 Camera (panel + tool), the guide videos, Generate.
 * Tim (verbatim): "can we add camera movement to follow a 3d path, pan,roll and dolly, height and angle to the tools in
 * timeline docker. will we be able to tell mmh3 , wan and ltx to follow these paths and camera movement"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the camera browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const field = (body, k) => { const m = new RegExp(`name="${k}"\\r\\n\\r\\n([^\\r]*)`).exec(body || ""); return m ? m[1] : null; };
const RESET = { floats: { camera: { shown: false, x: -1, y: -1, w: 0, h: 0, mode: "float", to: "", side: "" } } };
const post = (body) => fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const gen = [], ltx = [];
  const ev = (f, a) => p.evaluate(f, a);
  let made = null;
  try {
    await post(RESET);
    await p.route("**/api/generate", (r) => { gen.push(r.request().postData() || ""); r.fulfill({ json: { id: "cam1", status: "queued" } }); });
    await p.route("**/api/ltx", (r) => { ltx.push(r.request().postData() || ""); r.fulfill({ json: { id: "cam2", status: "queued" } }); });
    await p.route("**/api/comfy/status", (r) => r.fulfill({ json: { ok: true, running: true, reachable: true, engine: "sdcli" } }));
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.TlCamera && TlCamera.started, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { tl.camera = null; const d = document.getElementById("timelinedock"); if (d && d.classList.contains("dockgone")) toggleDockGone("timelinedock", null); if (d && d.classList.contains("collapsed")) toggleCollapse("timelinedock"); });

    // 1 the button, the tool, the panel
    const t1 = await ev(() => ({ btn: !!document.querySelector("#tlbar #tlCamBtn"), tool: (document.getElementById("tlTool_camera") || {}).title || "",
      hidden: document.getElementById("sf-camera").classList.contains("sf-hidden") }));
    await ev(() => document.getElementById("tlCamBtn").click());
    await p.waitForTimeout(400);
    const t1b = await ev(() => { const el = document.getElementById("sf-camera"), r = el.getBoundingClientRect(); return { shown: !el.classList.contains("sf-hidden"), w: Math.round(r.width), on: document.getElementById("tlCamBtn").classList.contains("on"),
      title: el.querySelector(".sft").textContent, presets: document.getElementById("cpPreset").options.length }; });
    check("🎥 Camera on the timeline bar, the 🎥 tool in the canvas toolbar (Shift+C); the button shows the Camera panel (a docker of its own, 20 presets)",
      t1.btn && /^Camera - drag to aim it/.test(t1.tool) && /\(Shift\+C\)$/.test(t1.tool) && t1.hidden && t1b.shown && t1b.w > 300 && t1b.on && t1b.title === "Camera" && t1b.presets === 20, { t1, t1b });

    // 2 a preset
    await ev(() => { document.getElementById("cpPreset").value = "orbit_left"; document.getElementById("cpApply").click(); });
    await p.waitForTimeout(250);
    const t2 = await ev(() => ({ aim: document.getElementById("cpAim").value, pts: TlCamera.cam().path.length, told: document.getElementById("cpTold").innerText }));
    check("Apply Orbit left: the path (5 points), aim at the centre; what each model is told (H3 'arcs around the subject', Wan's nearest move, LTX words only)",
      t2.aim === "centre" && t2.pts === 5 && /MiniMax H3: The camera arcs around the subject/.test(t2.told) && /Wan: Fun Camera Pan Left/.test(t2.told) && /LTX: camera LoRA none for this move/.test(t2.told), t2);

    // 3 keys
    await ev(() => TlCamera.goF(0.5)); await p.waitForTimeout(300);
    await ev(() => { const el = document.querySelector('#cpKeys input[data-cpk="pan"]'); el.value = "12"; el.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(250);
    const t3 = await ev(() => ({ keys: TlCamera.cam().keys.map((k) => [k.f, k.pan]), keyed: document.querySelector('#cpKeys input[data-cpk="pan"]').classList.contains("keyed"), info: document.getElementById("cpKeyInfo").textContent }));
    await ev(() => TlCamera.goF(1)); await p.waitForTimeout(150);
    await ev(() => document.getElementById("cpPrev").click()); await p.waitForTimeout(250);
    const f3 = await ev(() => Math.round(TlCamera.fNow() * 100) / 100);
    check("a value changed at 50 % writes a ◆ key there (the field lit); ◀ goes back to it", t3.keys.length === 1 && Math.abs(t3.keys[0][0] - 0.5) < 0.01 && t3.keys[0][1] === 12 && t3.keyed && /◆ here/.test(t3.info) && f3 === 0.5, { t3, f3 });

    // 4 the Top view: drag a point
    await ev(() => TlCamera.view("top")); await p.waitForTimeout(250);
    const before = await ev(() => TlCamera.cam().path[4].slice());
    const sp = await ev(() => TlCamera.pointOnScreen(4));
    await p.mouse.move(sp.x, sp.y); await p.mouse.down(); await p.mouse.move(sp.x - 30, sp.y + 25, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(250);
    const after = await ev(() => ({ p: TlCamera.cam().path[4].slice(), preset: TlCamera.cam().preset, sel: document.getElementById("cpPtInfo").textContent }));
    check("Top view: dragging a point moves it (left / right, toward / away - its height kept); the camera is then 'custom', the point selected",
      after.preset === "custom" && after.p[0] < before[0] - 0.05 && after.p[2] > before[2] + 0.05 && after.p[1] === before[1] && /point 5 selected/.test(after.sel), { sp, before, after });

    // 5 docked as a tab, floated again
    const t5 = await ev(() => { const ok = SecFloat.dockTo("camera", "refsdock", "inside"); const el = document.getElementById("sf-camera");
      return { ok, tab: el.classList.contains("df-tabbed"), host: el.parentElement && el.parentElement.id, strip: !!document.querySelector("#refsdock .dftabs") }; });
    await p.waitForTimeout(300);
    await ev(() => SecFloat.float("camera", 900, 120, 430, 640)); await p.waitForTimeout(300);
    const t5b = await ev(() => ({ float: document.getElementById("sf-camera").classList.contains("df-float"), st: SecFloat.state("camera") }));
    check("the panel docks INSIDE another docker as a tab (References), and floats again - kept in docker_status.json (floats.camera)",
      t5.ok && t5.tab && t5.host === "refsdock" && t5.strip && t5b.float && t5b.st.mode === "float", { t5, t5b });

    // 6 the picture, a depth map, the guide
    made = await ev(async () => {
      const mk = (draw) => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 640; c.height = 360; const g = c.getContext("2d"); draw(g); c.toBlob((b2) => ok(b2), "image/png"); });
      const pic = await mk((g) => { g.fillStyle = "#4a90d9"; g.fillRect(0, 0, 640, 360); g.fillStyle = "#2e8b57"; g.beginPath(); g.arc(320, 150, 70, 0, 7); g.fill(); g.fillStyle = "#8b5a2b"; g.fillRect(300, 200, 40, 120); });
      const dep = await mk((g) => { g.fillStyle = "#333"; g.fillRect(0, 0, 640, 360); g.fillStyle = "#ddd"; g.beginPath(); g.arc(320, 150, 70, 0, 7); g.fill(); g.fillRect(300, 200, 40, 120); });
      refs.length = 0; refs.push({ file: new File([pic], "cam_tree.png", { type: "image/png" }), url: URL.createObjectURL(pic), subject: 1, role: "person", roleOther: "" });
      document.getElementById("cpSrc").value = "ref";
      await TlCamera.usePicture();
      const fd = new FormData(); fd.append("file", dep, "cam_tree_depth.png"); fd.append("hint", "images");
      const up = await (await fetch("/api/passets", { method: "POST", body: fd })).json();
      const c = TlCamera.cam(); c.src.depth = "/passets/images/" + encodeURIComponent(up.name); c.dur = 2; TlCamera.paint();
      const g = await TlCamera.makeGuide();
      const head = async (n) => (await fetch("/passets/video/" + encodeURIComponent(n), { method: "HEAD" })).status;
      return { g, src: c.src, rgb: await head(g.rgb), depth: await head(g.depth), say: document.getElementById("cpGuideSay").textContent, fresh: TlCamera.guideFresh() };
    });
    check("⟳ Use picture (the first reference picture kept in Assets), a depth map, 🎬 Make guide: camguide_<id>_rgb.mp4 + _depth.mp4 (2 s = 49 frames), fresh",
      made && /^\/passets\/images\/camsrc_/.test(made.src.image) && /^camguide_[a-z0-9]+_rgb\.mp4$/.test(made.g.rgb) && /^camguide_[a-z0-9]+_depth\.mp4$/.test(made.g.depth)
      && made.g.frames === 49 && made.rgb === 200 && made.depth === 200 && made.fresh && /^✓ /.test(made.say), made);
    const cv = await ev(async () => { TlCamera.view("camera"); await new Promise((r) => setTimeout(r, 600)); const c = document.getElementById("cpView"), d = c.getContext("2d").getImageData(c.width / 2, c.height / 3, 1, 1).data; return Array.from(d); });
    check("the Camera view shows the picture in 3D (not blank)", cv[0] + cv[1] + cv[2] > 60, cv);

    // 7 Generate (H3 / Wan) and LTX send the camera
    await ev(() => { document.getElementById("cpUse").checked = true; document.getElementById("cpUse").dispatchEvent(new Event("change"));
                     document.getElementById("cpExact").checked = true; document.getElementById("cpExact").dispatchEvent(new Event("change")); });
    await ev(() => submitJob("a tree")); await p.waitForTimeout(300);
    const c1 = JSON.parse(field(gen[gen.length - 1], "camera") || "{}");
    await ev(() => submitLtx("a tree")); await p.waitForTimeout(300);
    const c2 = JSON.parse(field(ltx[ltx.length - 1], "camera") || "{}");
    check("Generate and LTX send `camera`: the path (use + exact on), the fresh guide's two videos",
      c1.cam && c1.cam.use && c1.cam.exact && c1.cam.aim === "centre" && c1.guide.rgb === made.g.rgb && c1.guide.depth === made.g.depth
      && c2.cam && c2.guide && c2.guide.depth === made.g.depth, { c1, c2 });
    // a changed path makes the guide stale: words + native moves only, said in the log
    await ev(() => { window.__cl = []; const o = window.logLine; window.logLine = (t) => { window.__cl.push(String(t)); return o(t); };
      document.getElementById("cpPreset").value = "push_in"; document.getElementById("cpApply").click(); });
    await ev(() => submitJob("a tree")); await p.waitForTimeout(300);
    const c3 = JSON.parse(field(gen[gen.length - 1], "camera") || "{}"), lg = await ev(() => (window.__cl || []).join("\n"));
    const stale = await ev(() => document.getElementById("cpGuideSay").textContent);
    check("a changed path: the guide is marked stale (⚠), Generate sends the path without it and the log says so",
      c3.cam && c3.cam.preset === "push_in" && !c3.guide.rgb && /older than the path/.test(lg) && /^⚠ the path or picture changed/.test(stale), { c3, lg, stale });
    await ev(() => { document.getElementById("cpUse").checked = false; document.getElementById("cpUse").dispatchEvent(new Event("change")); });
    await ev(() => submitJob("a tree")); await p.waitForTimeout(300);
    check("Use in Generate off = no `camera` field", field(gen[gen.length - 1], "camera") === null);

    // 8 the canvas tool: drag = aim (a key at the marker), the frame drawn
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      if (typeof setVar === "function") setVar("th", 760);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      // 2.519.0: the 🧰 Tools & Properties float (tlfloat.js, shown by default, confined over the preview canvas row
      // since 2.438.0) covered this narrow canvas - the drag landed on it, not on #tlCanvas. Put it away for the drag.
      if (window.TlFloat) TlFloat.show(false);
      TlCamera.goF(0); TlCanvas.setTool("camera");
    });
    await p.waitForTimeout(300);
    const cbox = await p.$eval("#tlCanvas", (c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    if (cbox.w > 20 && cbox.h > 20) {
      await p.mouse.move(cbox.x + cbox.w / 2, cbox.y + cbox.h / 2); await p.mouse.down();
      await p.mouse.move(cbox.x + cbox.w / 2 + 100, cbox.y + cbox.h / 2, { steps: 5 }); await p.mouse.up();
    }
    await p.waitForTimeout(300);
    const t8 = await ev(() => { const k = TlCamera.cam().keys.find((x) => x.f < 0.01); return { k, tool: TlCanvas.state.tool }; });
    check("the 🎥 tool: dragging across the canvas pans the camera - a ◆ key at the marker (pan > 0)", cbox.w > 20 && t8.tool === "camera" && t8.k && t8.k.pan > 2, { t8, cbox });
    await ev(() => { TlCanvas.setTool("move"); if (window.TlFloat) TlFloat.show(true); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try {
      await ev(async (m) => { if (m && m.g) { /* the guide stays an asset like any other - removed here */ }
        tl.camera = null; if (typeof tlSave === "function") tlSave(); refs.length = 0; }, made);
    } catch { /* fine */ }
    try { await post(RESET); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

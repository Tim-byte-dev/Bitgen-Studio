#!/usr/bin/env node
/* bitGen Studio — 2.526.0 units: THE WORKSPACE dropdown - static/workspaces.js (the five workspaces: what each shows and
 * hides, the default heights), lib/workspaces.js (workspaces.json: current, each one as it was left, ↺ reset) and
 * routes/workspaces.js against a temp install root.
 * Tim (verbatim): "lets add a workspace dropdown to the main menubar - image editing, video editing, music video,basic,
 * expert. to make it easier to navigate the app" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const W = require("../static/workspaces.js");

check("five workspaces: Basic, Image editing, Video editing, Music video, Expert", JSON.stringify(W.IDS) === JSON.stringify(["basic", "image", "video", "musicvideo", "expert"]) && W.IDS.every((i) => W.LABELS[i] && W.DEFS[i].tip));
const pb = W.plan("basic"), pi = W.plan("image"), pv = W.plan("video"), pm = W.plan("musicvideo"), pe = W.plan("expert");
check("Basic: the preview + the prompt; no timeline / image editor / music; the assets side dock hidden", pb.bottom.previewdock === "open" && pb.bottom.promptdock === "open" && pb.bottom.timelinedock === "gone" && pb.bottom.imageeditdock === "gone" && pb.bottom.musicdock === "gone" && pb.side.assets === false && pb.side.rdock === true, pb);
check("Image editing: the image editor + the prompt, Generate -> 🖼 Image, the editor maximized", pi.bottom.imageeditdock === "open" && pi.bottom.previewdock === "gone" && pi.bottom.timelinedock === "gone" && pi.genMode === "image" && W.DEFS.image.max === "imageeditdock", pi);
check("Video editing: preview, timeline, storyboard, SFX, prompt; Generate -> 🎬 Video", ["previewdock", "timelinedock", "videodock", "sfxdock", "promptdock"].every((k) => pv.bottom[k] === "open") && pv.bottom.imageeditdock === "gone" && pv.bottom.musicdock === "gone" && pv.genMode === "video", pv);
check("Music video: + music and stems", ["previewdock", "timelinedock", "videodock", "musicdock", "stemsdock", "promptdock"].every((k) => pm.bottom[k] === "open") && pm.bottom.imageeditdock === "gone", pm);
check("Expert: every docker on screen (the busy ones collapsed), every side dock", W.BOTTOM.every((k) => pe.bottom[k] !== "gone") && W.SIDE.every((k) => pe.side[k]), pe);
check("the buttons: Basic hides the advanced ones (Timeline, Stems, ComfyUI, 🎓 LoRA, 🏠 House, ↺ Reset project, ⊞ …); Expert hides none",
  ["tT", "tSt", "tCF", "ltBtn", "hbBtn", "projReset", "dockCfgWrap"].every((b) => W.hidden("basic").includes(b)) && W.hidden("expert").length === 0 && !W.hidden("basic").includes("tP") && !W.hidden("basic").includes("tQ"), W.hidden("basic"));
check("…a workspace never hides the button of a docker it shows", W.IDS.every((id) => { const p = W.plan(id), G = { tP: "promptdock", tT: "timelinedock", tV: "videodock", tPv: "previewdock", tSt: "stemsdock", tSfx: "sfxdock", tCh: "chatdock", tC: "consoledock", tMu: "musicdock", tIE: "imageeditdock", tCF: "comfydock" }; return W.hidden(id).every((b) => !G[b] || p.bottom[G[b]] === "gone"); }));
check("…and never the Workspace dropdown, ⚙ Settings, 💾 Save or the statusbar's ⟨ ⟩", W.IDS.every((id) => !["wsWrap", "wsSel", "openSettings", "projSave", "projNew", "tL", "tR"].some((b) => W.hidden(id).includes(b))));
const h = W.heights("video", 1000);
check("default heights: a share of the column each (the storyboard takes what is left), at least 60 px", h.previewdock === 340 && h.timelinedock === 220 && !h.videodock && W.heights("video", 100).sfxdock === 60, h);
check("an unknown workspace reads as Expert", JSON.stringify(W.plan("nope")) === JSON.stringify(pe) && !W.valid("nope"));

/* ---- lib/workspaces.js + the routes, a temp install root */
const T = fs.mkdtempSync(path.join(os.tmpdir(), "ws526-"));
const stub = (rel, exp) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports: exp }; };
stub("../lib/core.js", { BASE: T });
const L = require("../lib/workspaces.js");
const SNAP = { window: { w: 1700, h: 1000 }, col: { h: 930 }, docks: { previewdock: { state: "open", height: 300, width: 400 }, refs: { width: 260, hidden: true } },
  vis: { bottom: { previewdock: { gone: false, collapsed: false }, timelinedock: { gone: true, collapsed: false } }, side: { refs: true } }, floats: { house: { shown: true, floating: true, x: 100, y: 80, w: 900, h: 600 } } };
check("no file: Expert, nothing kept (nothing changes for anyone who never picks one)", JSON.stringify(L.load(T)) === JSON.stringify({ version: 1, current: "expert", saved: {} }));
let r = L.switchTo(T, { from: "expert", snap: SNAP, to: "basic" });
check("switch: Expert is kept as it was left, Basic is current", r.current === "basic" && r.saved.expert && r.saved.expert.vis.bottom.timelinedock.gone === true && r.saved.expert.docks.previewdock.height === 300 && r.saved.expert.floats.house.shown === true && fs.existsSync(path.join(T, "workspaces.json")), r);
r = L.switchTo(T, { from: "basic", snap: { window: { w: 1700, h: 1000 } }, to: "video" });
check("…a snapshot without what was on screen is not kept", r.current === "video" && !r.saved.basic);
check("…an unknown workspace is refused (400)", (() => { try { L.switchTo(T, { to: "nope" }); return false; } catch (e) { return e.status === 400; } })());
r = L.snapshot(T, "video", SNAP);
check("snapshot (leaving the app): kept", r.saved.video && r.saved.video.vis.side.refs === true);
r = L.reset(T, "video");
check("↺ reset: its own layout is forgotten (the default comes back)", !r.saved.video && r.saved.expert);
fs.writeFileSync(path.join(T, "workspaces.json"), JSON.stringify({ current: "evil", saved: { evil: SNAP, image: { junk: 1 } } }));
check("a broken file reads clean", JSON.stringify(L.load(T)) === JSON.stringify({ version: 1, current: "expert", saved: {} }));
L.reset(T, "all");

const express = require("express");
const app = express(); app.use(express.json()); require("../routes/workspaces.js").mount(app);
const srv = app.listen(0, "127.0.0.1", async () => {
  const U = "http://127.0.0.1:" + srv.address().port;
  const j = async (u, b) => { const x = await fetch(U + u, b === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return { s: x.status, b: await x.json() }; };
  try {
    check("GET /api/workspaces", (await j("/api/workspaces")).b.current === "expert");
    const s1 = await j("/api/workspaces/switch", { from: "expert", snap: SNAP, to: "image" });
    check("POST /api/workspaces/switch", s1.s === 200 && s1.b.current === "image" && s1.b.saved.expert, s1);
    check("…bad = 400", (await j("/api/workspaces/switch", { to: "x" })).s === 400);
    const s2 = await j("/api/workspaces/snapshot", { id: "image", snap: SNAP });
    check("POST /api/workspaces/snapshot", s2.s === 200 && s2.b.saved.image);
    const s3 = await j("/api/workspaces/reset", { id: "all" });
    check("POST /api/workspaces/reset {all}", s3.s === 200 && Object.keys(s3.b.saved).length === 0 && s3.b.current === "image");
  } catch (e) { check("the routes ran", false, String(e && e.stack || e)); }
  srv.close(); fs.rmSync(T, { recursive: true, force: true });
  const root = path.join(__dirname, "..");
  const idx = fs.readFileSync(path.join(root, "routes", "index.js"), "utf8"), html = fs.readFileSync(path.join(root, "static", "index.html"), "utf8");
  check("pins: routes/workspaces.js mounted from routes/index.js (not server.js)", /require\("\.\/workspaces"\)\.mount\(app\)/.test(idx) && !/workspaces/.test(fs.readFileSync(path.join(root, "server.js"), "utf8")));
  check("pins: index.html loads static/workspaces.js", html.includes('<script src="/static/workspaces.js"></script>'));
  check("pins: a statusbar hide / a collapse updates the docker_status record at once (⊞ Docker layout re-showed hidden dockers)", html.includes('dsEntry(id).hidden = hide;') && html.includes('if (STATUS_VARS[id]) dsEntry(id).state ='));
  check("pins: workspaces.json is user state - .gitignore + make_zips.sh", /^workspaces\.json$/m.test(fs.readFileSync(path.join(root, ".gitignore"), "utf8")) && fs.readFileSync(path.join(root, "scripts", "make_zips.sh"), "utf8").includes('! -name "workspaces.json"'));
  const tp = JSON.parse(fs.readFileSync(path.join(root, "lib", "testPlan.json"), "utf8"));
  check("pins: the 🧪 checklist has the 2.526 group", (tp.groups || []).some((g) => g.id === "g526"));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});

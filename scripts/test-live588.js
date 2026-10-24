#!/usr/bin/env node
/* bitGen Studio — scripts/test-live588.js (2.588.0): ⚡ LIVE GENERATION (ext/imageeditdock/pclive.js + lib/liveGen.js +
 * routes/aiedit.js live=1 + core's front-of-queue) and ⬚ FOCUS MODE (ext/imageeditdock/pcfocus.js). Tim: "add live
 * generation mode like krita has" + "add a button in the menubar, this will make the canvas full screen and frameless,
 * nothing else but canvas will show, ctrl+p will show a color pallet, ctrl+b will show brush types and size. ctrl+esc
 * will go back to normal mode". The pure parts, the server's latest-wins / prune, the wiring. No server. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const LV = require("../ext/imageeditdock/pclive.js");
const FO = require("../ext/imageeditdock/pcfocus.js");
const LG = require("../lib/liveGen");

try {
  // ---- the loop
  const st = (o) => Object.assign({ on: true, paused: false, doc: true, dirty: true, inflight: false, now: 1000, changed: 0, debounce: 350 }, o);
  check("nextAction: a settled change renders; one still settling or one rendering waits; paused / off / no picture / nothing changed = idle",
    LV.nextAction(st()) === "run" && LV.nextAction(st({ changed: 800 })) === "wait" && LV.nextAction(st({ inflight: true })) === "wait"
    && LV.nextAction(st({ paused: true })) === "idle" && LV.nextAction(st({ on: false })) === "idle" && LV.nextAction(st({ doc: false })) === "idle" && LV.nextAction(st({ dirty: false })) === "idle");
  const s1 = LV.liveSize(2048, 1024, 0.5), s2 = LV.liveSize(256, 256, 1);
  check("liveSize: the MP budget, multiples of 16, the aspect kept; a small picture at most 1.5 x", s1.w * s1.h <= 0.5 * 1048576 * 1.05 && s1.w % 16 === 0 && s1.h % 16 === 0 && Math.abs(s1.w / s1.h - 2) < 0.05 && s2.w === 384 && s2.h === 384, [s1, s2]);
  const S = { w: 100, h: 80, undo: [{}], redo: [], layers: [{ visible: true, opacity: 1 }], selVer: 0 };
  const ids = new WeakMap(); let n = 0; const idOf = (o) => { if (!ids.has(o)) ids.set(o, ++n); return ids.get(o); };
  const f0 = LV.fingerprint(S, { p: "a cat" }, idOf);
  const changes = [
    () => S.undo.push({}), () => { S.layers[0].visible = false; }, () => { S.layers[0].opacity = 0.5; }, () => S.layers.push({ visible: true }), () => { S.selVer = 3; },
  ];
  let all = true, prev = f0;
  for (const c of changes) { c(); const f = LV.fingerprint(S, { p: "a cat" }, idOf); if (f === prev) all = false; prev = f; }
  check("fingerprint: a stroke (undo entry), a layer shown / hidden / its opacity, a new layer, a selection change - each one is a change; the prompt / settings too",
    all && LV.fingerprint(S, { p: "a dog" }, idOf) !== prev && LV.fingerprint(S, { p: "a cat" }, idOf) === prev);
  check("blendTo: the on-canvas mix 0..1", LV.blendTo(0.7) === 0.7 && LV.blendTo(3) === 1 && LV.blendTo(-1) === 0 && LV.blendTo("x") === 1);

  // ---- the server: latest wins, the head of the queue, the prune
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-live588-"));
  const out = path.join(tmp, "output"); fs.mkdirSync(out);
  const core = { jobs: new Map(), order: [], queue: [], outputDirs: () => [out] };
  const mk = (id, status) => { const j = { id, status, project: "p", params: { live: true, images: [], live_inputs: [] }, dir: path.join(tmp, "jobs", id) }; core.jobs.set(id, j); core.order.push(id); if (status === "queued") core.queue.push(j); return j; };
  LG._reset();
  const a = mk("a1", "running"); LG.track("tab 1!", a);
  const b = mk("b2", "queued"); LG.track("tab 1!", b);
  const other = mk("c3", "queued"); LG.track("tab2", other);
  const sup = LG.supersede(core, "tab 1!");
  check("supersede: a newer live change cancels the client's waiting render (out of the queue); the running one finishes; another tab's stays",
    sup.join() === "b2" && b.status === "cancelled" && a.status === "running" && other.status === "queued" && core.queue.length === 1 && LG.clientId("tab 1!") === "tab1");
  // five finished renders + the cancelled one -> prune keeps the newest KEEP done ones, removes the rest and their files
  a.status = "done"; a.output = "live_a1.png"; fs.writeFileSync(path.join(out, "live_a1.png"), "x");
  const done = [];
  for (let i = 0; i < 4; i++) { const j = mk("d" + i, "done"); j.output = `live_d${i}.png`; fs.writeFileSync(path.join(out, j.output), "x"); const inp = path.join(tmp, `in${i}.png`); fs.writeFileSync(inp, "x"); j.params.live_inputs = [inp]; LG.track("tab1", j); done.push(j); }
  const r = LG.finished(core, done[3]);
  const kept = ["a1", "b2", "d0", "d1", "d2", "d3"].filter((id) => core.jobs.has(id));
  check("finished: the newest " + LG.KEEP + " finished live renders are kept, older ones (+ the cancelled) go - their pictures and inputs too, out of the jobs list",
    r.removed === 3 && kept.join() === "d1,d2,d3" && !fs.existsSync(path.join(out, "live_a1.png")) && !fs.existsSync(path.join(out, "live_d0.png")) && !fs.existsSync(path.join(tmp, "in0.png"))
    && fs.existsSync(path.join(out, "live_d3.png")) && !core.order.includes("a1") && core.jobs.has("c3"), { r, kept });
  fs.rmSync(tmp, { recursive: true, force: true });

  // ---- the wiring
  const CORE = rd("lib", "core.js"), AE = rd("routes", "aiedit.js"), IW = rd("misc/image_worker.py"), IDX = rd("routes", "index.js"), MT = rd("ext", "imageeditdock", "mount.js");
  check("core: o.front = the head of the queue; a live render skips the queue preset's rest (before and after) and jobs.info; liveGen.finished after it",
    /if \(o\.front\) queue\.unshift\(job\); else queue\.push\(job\);/.test(CORE) && /!\(queue\[0\]\.params \|\| \{\}\)\.live\)/.test(CORE) && /if \(!\(job\.params \|\| \{\}\)\.live\) \{ try \{ require\("\.\/queuePresets"\)\.finished\(\)/.test(CORE)
    && /if \(job && job\.params && job\.params\.live\) return;/.test(CORE) && /require\("\.\/liveGen"\)\.finished\(module\.exports, job\)/.test(CORE));
  check("aiedit: live=1 -> one render, the live steps, latest wins (supersede), the head of the queue, tracked; its input files listed for the prune",
    /const live = b\.live === "1";/.test(AE) && /const n = live \? 1 : aiEdit\.count\(b\.count\);/.test(AE) && /liveGen\.supersede\(core, b\.live_id\)/.test(AE)
    && /core\.makeJob\(p, null, null, \{ front: true, local: true \}\)/.test(AE) && /liveGen\.track\(b\.live_id, job\)/.test(AE) && /p\.live_inputs = /.test(AE));
  check("the image worker keeps the model loaded for a live render (no VRAM clear); /api/jobs leaves live renders out (?all=1 shows them)",
    /if params\.get\("live"\):\n\s+say\("\[worker\] live render/.test(IW) && /\.filter\(\(j\) => all \|\| !\(j\.params \|\| \{\}\)\.live\)/.test(IDX));
  check("mount.js sends live / live_id / live_steps / seed and does not pick the live job in the queue docker", /"live", "live_id", "live_steps", "seed"\]/.test(MT) && /if \(req\.live\) return j;/.test(MT));

  // ---- ⬚ focus mode
  const on = { on: true, pop: false };
  const K = (o) => FO.keyAction(Object.assign({ key: "", code: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }, o), on);
  check("focus keys: Ctrl+P = the colour palette, Ctrl+B = the brushes, Ctrl+Esc = back (Ctrl+Shift+F too); nothing when focus is off; plain P / B are the editor's",
    K({ key: "p", ctrlKey: true }) === "palette" && K({ key: "b", ctrlKey: true }) === "brushes" && K({ key: "Escape", ctrlKey: true }) === "exit" && K({ key: "F", code: "KeyF", ctrlKey: true, shiftKey: true }) === "exit"
    && K({ key: "p" }) === null && K({ key: "b" }) === null && K({ key: "P", ctrlKey: true, shiftKey: true }) === null
    && FO.keyAction({ key: "p", ctrlKey: true }, { on: false }) === null && FO.keyAction({ key: "Escape" }, { on: true, pop: true }) === "close" && FO.keyAction({ key: "Escape" }, { on: true, pop: false }) === null);
  const hx = ["#ff0000", "#00ff00", "#0000ff", "#808080", "#123456", "#ffffff", "#000000", "#c0ffee"];
  check("hsv <-> hex round trip (the palette's square + hue strip)", hx.every((h) => { const v = FO.hexToHsv(h); return FO.hsvToHex(v.h, v.s, v.v) === h; })
    && FO.hsvToHex(0, 1, 1) === "#ff0000" && FO.hsvToHex(120, 1, 1) === "#00ff00" && FO.hsvToHex(240, 1, 1) === "#0000ff", hx.map((h) => { const v = FO.hexToHsv(h); return FO.hsvToHex(v.h, v.s, v.v); }));
  check("clampPop: the popup centred on the pointer, kept on screen", JSON.stringify(FO.clampPop(10, 10, 200, 100, 800, 600)) === '{"x":4,"y":4}' && JSON.stringify(FO.clampPop(400, 300, 200, 100, 800, 600)) === '{"x":300,"y":250}' && FO.clampPop(799, 599, 200, 100, 800, 600).x === 596);
  const EXT = JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts, IE = rd("ext", "imageeditdock", "imageedit.js"), PF = rd("ext", "imageeditdock", "pcfocus.js"), PL = rd("ext", "imageeditdock", "pclive.js");
  check("wiring: pclive.js + pcfocus.js loaded before the editor and installed; ⚡ and ⬚ in the menu bar beside ⛶; View ▸ ⚡ Live Generation / 🎨 Artist Mode (Shift+Ctrl+F, 2.590.0: a labelled button right after the menus)",
    EXT.indexOf("pclive.js") > 0 && EXT.indexOf("pcfocus.js") > 0 && EXT.indexOf("pcfocus.js") < EXT.indexOf("imageedit.js") && /win\.PCLive\.install\(E\)/.test(IE) && /win\.PCFocus\.install\(E\)/.test(IE)
    && /b\.id = "kxLive"/.test(PL) && /b\.id = "kxFocus"/.test(PF) && /insertBefore\(b, full\)/.test(PL) && /"view\.live", "⚡ Live Generation"/.test(PL) && /"view\.focus", "🎨 Artist Mode \(canvas only\)", "Shift\+Ctrl\+F"/.test(PF) && /menus\.after\(b\)/.test(PF));
  check("focus: the keys are caught first (capture) so Ctrl+P / Ctrl+B never reach the browser's print / bookmarks; the chain to the canvas is kept, every sibling hidden",
    /doc\.addEventListener\("keydown", \(e\) => \{\s*const a = keyAction/.test(PF) && /\}, true\);\s*\n\s*\/\/ 2\.590\.0 \(Tim: "i can't find the full screen canvas button/.test(PF) && /pcfocus-hide/.test(PF) && /pcfocus-chain/.test(PF) && /requestFullscreen/.test(PF));
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);

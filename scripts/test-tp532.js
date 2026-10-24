#!/usr/bin/env node
/* bitGen Studio — 2.532.0 units: 🧪 TESTS TICK THEMSELVES AND STAY TICKED (lib/testPlan.js keepAuto / remember /
 * clientEvent, the new event autos in testPlan.json), the floating docker's ▁ ⛶ ✕ title bar (static/secfloat.js) and the
 * House builder's walking camera range (static/housegeo.js heightRange / camAt).
 * Tim (verbatim): "when a task is completed successfully and we haven't checked it in the test list then check it
 * automatically ... add a maximize button to the titlebar and a minimize button, minimize will make it a standard docker
 * titlebar, x will close the docker ... shift button raises cameras elevation to maximum 3m over the roof, alt button
 * drops camera elevation to min. ground floor floor" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const TP = require("../lib/testPlan.js"), G = require("../static/housegeo.js");

/* ---- the plan */
const plan = TP.plan(), items = TP.flatten(plan), byId = (id) => items.find((i) => i.id === id);
const g532 = plan.groups.find((g) => g.id === "g532");
check("the plan has 2.532.0's group (9 items), newest first", g532 && g532.items.length >= 8 && plan.groups.indexOf(g532) <= plan.groups.length - 1 && plan.groups[0].id >= "g532", plan.groups[0].id);
const was = ["an_dl", "pal_open", "pal_set", "pal_help", "hx_roof", "hx_trace", "hx_furnish", "hx_glb", "hx_list", "pp_place", "pp_real", "sd_why", "sd_real", "ws_pick", "ws_expert", "ws_reset", "rl_none", "hb_open", "hb_real"];
check("19 tick-by-hand items tick themselves now too (an auto) and keep their ✓ ✗ buttons (manual)", was.every((id) => byId(id) && byId(id).auto && byId(id).manual), was.filter((id) => !(byId(id) && byId(id).auto)));
const evs = new Set(items.filter((i) => i.auto && i.auto.kind === "event").map((i) => i.auto.event));
const srcAll = ["lib/house.js", "lib/houseFurnish.js", "lib/workspaces.js", "lib/styleDoctor.js", "routes/styleDoctor.js", "lib/bugReport.js", "lib/civitai.js", "routes/modelMgr.js"].map((f) => read(f)).join("\n");
const missing = [...evs].filter((e) => !TP.CLIENT_EVENTS.includes(e) && !new RegExp("[\"']" + e + "[\"']|\"house_\" \\+ k").test(srcAll));
check("every event an item waits for is told by the server (lib / routes) or is a page event the route takes (CLIENT_EVENTS)", missing.length === 0, missing);
const pageSrc = ["static/palette.js", "static/housebuilder.js", "static/secfloat.js", "static/testcoach.js",
  "ext/imageeditdock/imageedit.js", "ext/imageeditdock/pc3d.js", "ext/imageeditdock/pcunreal.js"].map((f) => read(f)).join("\n");   // 2.539.0 ie_ref, 2.540.0 ie_realrefs: the image editor tells them
const unsent = TP.CLIENT_EVENTS.filter((e) => !pageSrc.includes('"' + e + '"'));
check("…and every page event is sent by the page (palette / House builder / docker title bar / the image editor)", unsent.length === 0, unsent);

/* ---- evaluate: a picture it was given, several ways */
const ctx = { jobs: [{ id: "j1", status: "done", mode: "image", style: "Qwen Image Edit", images: ["house-beach-living-room-shot.png", "house-beach-char-ana.png"], log: [] },
  { id: "j2", status: "failed", mode: "image", style: "Anima", images: [], log: ["x is not in Load Checkpoint's list (models/checkpoints)"] }], events: [{ event: "workspace_used", data: { cat: "video", what: "video" }, at: 1 }] };
check("job + image: a finished job given a house shot ticks 'Make it real'", TP.evaluate({ auto: { kind: "job", mode: "image", image: "^house-" } }, ctx).state === "pass");
check("…a character picture of the house (pp_real's regex)", TP.evaluate(byId("pp_real"), ctx).state === "pass" && TP.evaluate({ auto: byId("pp_real").auto }, { jobs: [{ id: "x", status: "done", mode: "image", images: ["house-a-cam-shot.png"] }] }).state === "");
check("…a failed job never ticks it", TP.evaluate({ auto: { kind: "job", image: "^house-" } }, { jobs: [Object.assign({}, ctx.jobs[0], { status: "failed" })] }).state === "");
check("any: the first way that is seen", TP.evaluate({ auto: { kind: "any", of: [{ kind: "event", event: "nope" }, { kind: "event", event: "workspace_used" }] } }, ctx).state === "pass"
  && TP.evaluate({ auto: { kind: "any", of: [{ kind: "event", event: "nope" }] } }, ctx).state === "");
check("workspace_used with cat: the five (ws_pick) vs expert (ws_expert)", TP.evaluate(byId("ws_pick"), ctx).state === "pass" && TP.evaluate(byId("ws_expert"), ctx).state === "");
check("rl_none: the 'not in Load Checkpoint's list' line of any job", TP.evaluate(byId("rl_none"), ctx).state === "pass");

/* ---- keepAuto: an auto pass is kept as a mark; yours wins */
const its = [{ id: "a", auto: { kind: "job", mode: "image" } }, { id: "b", auto: { kind: "event", event: "nope" } }, { id: "c", auto: { kind: "job", mode: "image" } }, { id: "d", auto: { kind: "job", mode: "image" } }];
const marks = { c: { state: "fail", note: "it was blurry", at: 5 }, d: { state: "", note: "a note only", at: 6 } };
const sum = TP.summarize(its, ctx, marks), kept = TP.keepAuto(sum.rows, marks, 99);
check("keepAuto: the auto pass nobody marked is kept {state pass, auto, how}", kept.a && kept.a.state === "pass" && kept.a.auto === true && /job j1/.test(kept.a.how) && kept.a.at === 99, kept);
check("…not what is not seen, never over your ✗ - and a note you wrote stays with it", !kept.b && !kept.c && kept.d && kept.d.note === "a note only", kept);
const after = TP.summarize(its, { jobs: [], events: [] }, Object.assign({}, marks, kept));
const ra = after.rows.find((r) => r.id === "a");
check("after a restart (no jobs): the kept tick is still ✓, says 'auto: …' and is flagged kept", ra.state === "pass" && /^auto: job j1/.test(ra.how) && ra.kept === true && ra.auto_state === "pass", ra);
check("…keepAuto does not keep it twice", Object.keys(TP.keepAuto(after.rows, Object.assign({}, marks, kept))).length === 0);
check("your ✓ on top of it is 'you: pass'", /^you: pass/.test(TP.summarize(its, ctx, { a: { state: "pass", note: "", at: 1 } }).rows[0].how));

/* ---- the server side (source) */
const tps = read("lib/testPlan.js");
check("status() and report() keep what they saw (remember), and a note on a kept tick keeps the tick (mark)", (tps.match(/remember\(sum\);/g) || []).length === 2 && /was && was\.auto/.test(tps));
check("clientEvent takes only CLIENT_EVENTS", TP.clientEvent("rm_rf", "x").error && /palette_run/.test(TP.clientEvent("rm_rf").error));
check("context(): a job's pictures (basenames) for the image autos", /images: \[\]\.concat\(p\.images/.test(tps));
check("POST /api/testplan/event (routes/testPlan.js, not server.js)", /\/api\/testplan\/event/.test(read("routes/testPlan.js")) && !/testplan\/event/.test(read("misc/server.js")));
const td = read("static/testdock.js");
check("the page's H3TestEvent: once per event a session; the docker shows 'auto ✓' for a kept tick", /root\.H3TestEvent = function/.test(td) && /told\[key\]/.test(td) && /r\.kept \? " ✓"/.test(td));

/* ---- the docker title bar */
const sf = read("static/secfloat.js");
check("secfloat: ▁ minimize + ⛶ maximize before ✕ (Close) in every floating docker's title bar", /class="sfmin"[^]*class="sfmax"[^]*class="sfx" title="Close/.test(sf));
check("…minimized = only the title bar (sf-min hides the body, height auto); a double-click on the title does it too", /\.secfloat\.sf-min > \.sfbody\{display:none!important\}/.test(sf) && /\.secfloat\.sf-min\{height:auto!important/.test(sf) && /addEventListener\("dblclick"/.test(sf));
check("…maximized = between the menu bar and the statusbar, the old place kept (float or docked) to go back to", /\$\("menubar"\), sb = \$\("statusbar"\)/.test(sf) && /w\.max = \{ x: s\.x, y: s\.y, w: s\.w, h: s\.h, mode:/.test(sf) && /dockTo\(t, p\.side, false, true, p\.at\)/.test(sf));
check("…SecFloat.minimize / maximize are there for the menus and tests", /SecFloat = \{ started: true, show, add, minimize, maximize,/.test(sf));

/* ---- the walking camera's range */
const m = G.example(), E = G.elevations(m);
const flat = G.normalize(Object.assign({}, m, { roof: { kind: "none" } }));
const top0 = E[m.floors.length - 1] + m.floors[m.floors.length - 1].height;
const Rn = G.heightRange(flat);
check("heightRange: no roof = the top floor's ceiling + 3 m; the bottom = the ground floor + 0.15 m", Math.abs(Rn.max - (top0 + 3)) < 0.01 && Rn.min === 0.15, [Rn, top0]);
const gab = G.normalize(Object.assign({}, m, { roof: { kind: "gable", pitch: 30, overhang: 0.4 } })), Rg = G.heightRange(gab);
check("…a gable roof: its ridge + 3 m (higher than no roof)", Rg.top > top0 + 0.5 && Math.abs(Rg.max - Rg.top - 3) < 0.01, Rg);
const fl = G.normalize(Object.assign({}, m, { roof: { kind: "flat" } }));
check("…a flat roof: its parapet + 3 m", Math.abs(G.heightRange(fl).top - (top0 + 0.55)) < 0.01);
const two = G.normalize(Object.assign({}, m, { floors: [{ name: "Ground", height: 2.7 }, { name: "Upstairs", height: 2.6 }] })), E2 = G.elevations(two);
check("camAt: an eye height -> the floor it is over + the height over that floor", G.camAt(two, 1.6).floor === 0 && G.camAt(two, E2[1] + 1.2).floor === 1 && Math.abs(G.camAt(two, E2[1] + 1.2).z - 1.2) < 1e-6 && G.camAt(two, 0.15).z === 0.15, [E2, G.camAt(two, E2[1] + 1.2)]);
check("…high over the roof it is still the top floor's camera (z far over its ceiling - normalize keeps up to 40 m)", G.camAt(two, 12).floor === 1 && G.normalize(Object.assign({}, two, { cameras: [{ id: "c", floor: 1, x: 0, y: 0, z: 9.4, yaw: 0, pitch: 0, fov: 70 }] })).cameras[0].z === 9.4);
const hb = read("static/housebuilder.js");
check("House builder: hold Shift rises / Alt sinks 2 m a second within heightRange (walkStep), ← → yaw, ↑ ↓ pitch", /dir \* 2 \* dt/.test(hb) && /G\.heightRange\(m\)/.test(hb) && /wc\.yaw = deg360\(wc\.yaw - 3\)/.test(hb) && /wc\.pitch \+ \(e\.key === "ArrowUp" \? 2 : -2\)/.test(hb));
check("…a box / Shift+click selects several, handles size and turn (frameOf / scaleTo / turnTo), the camera's drag looks through it", /boxPick\(d\.a, d\.b\)/.test(hb) && /function scaleTo\(F, hd, p, keep\)/.test(hb) && /k === "camera" && d\.moved\) \{ camTouched\(o\)/.test(hb));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + (fail ? "FAIL" : "PASS") + ` (${pass} passed, ${fail} failed)`);
process.exit(fail ? 1 : 0);

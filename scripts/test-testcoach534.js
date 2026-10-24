#!/usr/bin/env node
/* bitGen Studio — 2.534.0 units: 🧪 TEST MODE (lib/testPlan.js on / off, suggestions, `where`, ie_action), THE COACH
 * (static/testcoach.js order / nextTest / toConfirm) and A NEW RENDER JOINING THE OPEN PREVIEW (static/lbfollow.js merge).
 * Tim (verbatim): "if user is in the preview dialog and a new generation completes add it to the preview dialog. create a
 * checkbox in settings for test mode . when in test mode check if tests are successful, prompt the user to test features
 * - eg if i am in image edit mode, pop up a little reminder to test blur, then the next test in image editor. when out of
 * test mode no tests are done" + "once the user does the test confirm with a dialog that the test was successful, have an
 * input box for suggestions to change feature" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const TP = require("../lib/testPlan.js"), TC = require("../static/testcoach.js"), LF = require("../static/lbfollow.js");

/* ---- the plan */
const plan = TP.plan(), items = TP.flatten(plan), by = (id) => items.find((i) => i.id === id);
check("2.534.0's group (newest first) + the image editor's everyday tools", plan.groups[0].id >= "g534" && plan.groups.some((g) => g.id === "g534") && plan.groups.some((g) => g.id === "gie" && g.items.length >= 10), plan.groups.slice(0, 2).map((g) => g.id));
const AREAS = new Set(TC.ORDER);
check("nearly every item says WHERE it is tested (a known area)", items.filter((i) => i.where).length >= items.length - 10 && items.every((i) => !i.where || AREAS.has(i.where)), items.filter((i) => i.where && !AREAS.has(i.where)).map((i) => i.id));
check("…Gaussian Blur is an image editor test that ticks from the editor's step name", by("ie_blur").where === "imageedit" && by("ie_blur").auto.event === "ie_action" && /Gaussian Blur/.test("Gaussian Blur") && new RegExp(by("ie_blur").auto.what).test("Gaussian Blur"));
check("…house items -> house, LoRA -> lora, keyframes -> timeline, Remote GPU -> settings", by("hb_draw").where === "house" && by("lt_job").where === "lora" && by("kf_any").where === "timeline" && by("rg_url").where === "settings");

/* ---- evaluate: an event's `what` */
const ev = (w) => ({ events: [{ event: "ie_action", data: { what: w }, at: 1 }] });
check("ie_action 'Gaussian Blur' ticks ie_blur, 'paint' ticks ie_paint - not each other", TP.evaluate(by("ie_blur"), ev("Gaussian Blur")).state === "pass" && TP.evaluate(by("ie_blur"), ev("paint")).state === "" && TP.evaluate(by("ie_paint"), ev("paint")).state === "pass");
check("…ie_action is a page event the route takes", TP.CLIENT_EVENTS.includes("ie_action"));

/* ---- off = nothing evaluated */
const its = [{ id: "a", auto: { kind: "event", event: "ie_action", what: "^paint$" } }, { id: "b", manual: true }];
const on = TP.summarize(its, ev("paint"), {}), off = TP.summarize(its, ev("paint"), { b: { state: "pass", note: "" } }, { auto: false });
check("test mode ON: the auto item passes", on.rows[0].state === "pass");
check("test mode OFF: no auto tick at all - your own ✓ stays", off.rows[0].state === "" && off.rows[0].auto_state === "" && off.rows[1].state === "pass", off.rows);
const tps = read("lib/testPlan.js");
check("OFF: event() keeps nothing, clientEvent answers {off}, status() / report() neither evaluate nor keep", /if \(t\.on !== true\) return;/.test(tps) && /if \(!isOn\(\)\) return \{ ok: true, off: true \};/.test(tps)
  && (tps.match(/summarize\(flatten\(p\), ctx, rec\(\)\.marks, \{ auto: on \}\);\n  if \(on\) remember\(sum\);/g) || []).length === 2);
check("…↺ Clear keeps the switch as it was; POST /api/testplan/mode in routes/testPlan.js (not server.js)", /const on = !!\(c\.testlog && c\.testlog\.on === true\); c\.testlog = \{ on,/.test(tps) && /\/api\/testplan\/mode/.test(read("routes/testPlan.js")) && !/testplan\/mode/.test(read("misc/server.js")));

/* ---- pending + suggestions */
const kept = TP.summarize(its, { events: [] }, { a: { state: "pass", auto: true, how: "ie_action: paint", at: 5 } });
check("a kept auto tick is PENDING (seen working, not confirmed) until you answer", kept.rows[0].pending === true && kept.rows[0].state === "pass");
const you = TP.summarize(its, { events: [] }, { a: { state: "pass", note: "fine", suggest: "a bigger brush preview", at: 6 } });
check("…your answer: not pending, the suggestion kept on the row", you.rows[0].pending === false && you.rows[0].suggest === "a bigger brush preview");
const txt = TP.textReport(Object.assign({ mode: true }, you), { version: "x" }, [], "now");
check("the log: SUGGESTIONS first, each row's suggestion, test mode ON/OFF", /== SUGGESTIONS \(what to change\)\n  • undefined|== SUGGESTIONS/.test(txt) && /suggestion: a bigger brush preview/.test(txt) && /test mode ON/.test(txt) && txt.indexOf("SUGGESTIONS") < txt.indexOf("suggestion: a bigger"), txt.slice(0, 600));
check("mark(id, state, note, suggest) - the route passes suggest", /function mark\(id, state, note, suggest\)/.test(tps) && /b\.note, b\.suggest/.test(read("routes/testPlan.js")));

/* ---- the coach (pure) */
check("areas: most specific first, 'app' always last", JSON.stringify(TC.order({ imageedit: true, house: true, settings: false })) === JSON.stringify(["house", "imageedit", "app"]) && JSON.stringify(TC.order({})) === '["app"]');
const rows = [{ id: "ie_blur", where: "imageedit", state: "" }, { id: "ie_paint", where: "imageedit", state: "" }, { id: "ie_erase", where: "imageedit", state: "pass" }, { id: "dk_x", where: "app", state: "" }];
const n1 = TC.nextTest(rows, ["imageedit", "app"], {}, {});
check("in the image editor: blur first (Tim's example), 2 left there", n1.row.id === "ie_blur" && n1.where === "imageedit" && n1.left === 2, n1);
check("…Later / answered -> the next test in the image editor", TC.nextTest(rows, ["imageedit", "app"], { ie_blur: 1 }, {}).row.id === "ie_paint");
check("…✕ hides the area -> the app's own", TC.nextTest(rows, ["imageedit", "app"], {}, { imageedit: 1 }).row.id === "dk_x" && TC.nextTest(rows, ["imageedit"], { ie_blur: 1, ie_paint: 1 }, {}) === null);
const pr = [{ id: "a", pending: true }, { id: "b", pending: true }, { id: "c", pending: false }];
check("Did it work?: what became pending since Test mode came on, not yet answered", JSON.stringify(TC.toConfirm(pr, { a: 1 }, {}).map((r) => r.id)) === '["b"]' && TC.toConfirm(pr, {}, { a: "pass", b: "later" }).length === 0);
const tcs = read("static/testcoach.js");
check("the confirm box: ✓ It worked / ✗ It didn't / Later + 'what happened' + '💡 Suggestions to change this feature' -> /api/testplan/mark {state, note, suggest}", /Did it work\?/.test(tcs) && /Suggestions to change this feature/.test(tcs) && /\{ id: row\.id, state: act, note, suggest: sg \}/.test(tcs));
check("…the image editor's undo steps -> ie_action (E.onPush chained, once)", /E\.__tcHook = true;/.test(tcs) && /H3TestEvent\("ie_action"/.test(tcs) && /prev\.apply\(this, arguments\)/.test(tcs));
check("…in an open modal dialog as a top-layer popover; nothing while Test mode is off", /function hostOf\(\)/.test(tcs) && /showPopover/.test(tcs) && /if \(!C\.on \|\| !C\.st \|\| !C\.st\.mode \|\| !C\.base\) \{ hide\(\); return; \}/.test(tcs));
const td = read("static/testdock.js");
check("the docker: its own 🧪 Test mode box, a 💡 suggestion field per row, 'confirm?' on a pending tick; H3TestEvent sends nothing when off (the editor: once per step name)", /id="tdMode"/.test(td) && /class="sg"/.test(td) && /confirm\?/.test(td) && /if \(root\.H3TestMode === false\) return false;/.test(td) && /name === "ie_action" \? name \+ "\|"/.test(td));
const html = read("static", "index.html");
check("Settings -> General: the 🧪 Test mode checkbox under Testing; testcoach.js + lbfollow.js loaded after testdock.js", /id="s_testmode"/.test(html) && html.indexOf('id="s_testmode"') > html.indexOf('id="s_testing"') && html.indexOf("/static/testcoach.js") > html.indexOf("/static/testdock.js") && html.includes("/static/lbfollow.js"));

/* ---- the preview follows its list */
const A = (u) => ({ url: u, kind: "image", name: u });
const m1 = LF.merge([A("/o/2.png"), A("/o/1.png")], [A("/o/3.png"), A("/o/2.png"), A("/o/1.png")], "/o/1.png");
check("a render joins the open preview in the dock's order; the picture you are on stays (its index follows)", m1.items.map((x) => x.url).join() === "/o/3.png,/o/2.png,/o/1.png" && m1.i === 2 && m1.added.length === 1 && m1.added[0].url === "/o/3.png", m1);
const m2 = LF.merge([A("/o/2.png"), A("/o/1.png")], [A("/o/3.png"), A("/o/2.png")], "/o/1.png");
check("…a file the dock dropped stays while the preview is open", m2.items.some((x) => x.url === "/o/1.png") && m2.items[m2.i].url === "/o/1.png");
check("…duplicates (a tile + its no-preview stand-in) once; nothing new = nothing added", LF.merge([A("a")], [A("a"), A("a")], "a").added.length === 0 && LF.merge([A("a")], [A("b"), A("b"), A("a")], "a").items.length === 2);
const lf = read("static/lbfollow.js");
check("lbfollow: the list it was opened from (a capturing click), watched while #lb is open, '✨ N new' jumps to the newest", /addEventListener\("click"[^]*, true\)/.test(lf) && /attributeFilter: \["open"\]/.test(lf) && /"✨ " \+ S\.count \+ " new"/.test(lf));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + (fail ? "FAIL" : "PASS") + ` (${pass} passed, ${fail} failed)`);
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
/* bitGen Studio — 2.995.0: ✨ Photo / ✏ Edit (Sketcher) - one rule, checked results, several at once (pure + source pins).
 * Tim: "please check the condional statements for edit sketcher button and photo button in sketcher, i am getting mixed
 * results, sometimes correct, sometimes with a gray mannequin, sometimes with gray bg. allow multiple edits, add it to the queue" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const R = require(path.join(ROOT, "ext/pushpulldock/ppreal.js"));

// plan - the one rule
const P = (t, bg, refs) => R.plan(t, bg, refs || []);
check("plan: the model's own backdrop / sky = own (one pass, as it is) - words or not", P("", true).mode === "own" && P("a park", true).mode === "own" && P("a park", true).words === true);
check("…an environment reference = place (2.996.0: the model cut out onto it in step 2), its picture kept", P("x", false, [{ role: "Environment", src: "e.png" }]).mode === "place" && P("x", false, [{ role: "environment", src: "e.png" }]).env.src === "e.png");
check("…everything else = fill: no words, the default words, words, a person reference (no more 'no words = the pale sky')",
  ["", R.DEFAULT, "  ", "a park"].every((t) => P(t, false).mode === "fill") && P("", false, [{ role: "person", src: "p" }]).mode === "fill");
check("…words = only real words (not empty, not the default)", !P("", false).words && !P(R.DEFAULT, false).words && P("a park", false).words);

// promptFor in fill mode, no words: the grey is EMPTY (a place that suits the model), never "add nothing else"
const sc = R.sceneWords({ rooms: [{ closed: true }] }, [], {});
const f0 = R.promptFor("", null, sc, { fill: true }), f1 = R.promptFor(R.DEFAULT, null, sc, { fill: true }), o0 = R.promptFor("", null, sc), pl = R.promptFor("", null, sc, { placed: true, fill: true });
check("2.996.0: step 1 never replaces the grey (EMPTY / EMPTY_ANY / PLACED gone - see test-996): KEEP_GREY with or without words, OWN_BG with a backdrop", f0.includes(R.KEEP_GREY) && f1.includes(R.KEEP_GREY) && o0.includes(R.KEEP_GREY) && R.promptFor("", null, sc, { own: true }).includes(R.OWN_BG));

// modelChange - the grey mannequin detector
const W = 8, H = 4, N = W * H, rgba = (f) => { const d = new Uint8ClampedArray(N * 4); for (let i = 0; i < N; i++) { const c = f(i); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; } return d; };
const alpha = new Uint8Array(N).map((v, i) => (i % W >= 2 && i % W < 6 ? 255 : 0));
const grey = rgba(() => [128, 128, 128]), photo = rgba((i) => (i % W >= 2 && i % W < 6 ? [200, 150, 120] : [128, 128, 128])), bgOnly = rgba((i) => (i % W >= 2 && i % W < 6 ? [128, 128, 128] : [0, 200, 0]));
check("modelChange: the same picture = 0, a real photo of the model = a lot, only the background changed = 0 (the model is all that counts)",
  R.modelChange(grey, grey, alpha) === 0 && R.modelChange(grey, photo, alpha) > 30 && R.modelChange(grey, bgOnly, alpha) === 0, [R.modelChange(grey, photo, alpha)]);
check("…no model in view = -1 (never retried); the threshold is small (a copy, not an edit)", R.modelChange(grey, photo, new Uint8Array(N)) === -1 && R.UNCHANGED > 0 && R.UNCHANGED < 20);

// greyLeft - the grey / green background detector
const sel = new Uint8Array(N).map((v, i) => (i % W < 2 || i % W >= 6 ? 1 : 0));
const filled = rgba((i) => (i % W < 2 ? [60, 120, 40] : [90, 140, 210])), greyBack = rgba(() => [126, 129, 131]), greenBack = rgba(() => [5, 250, 3]);
check("greyLeft: a real place = 0, the grey kept = 1, the green kept = 1 (only the filled part counts)",
  R.greyLeft(filled, sel, 128) === 0 && R.greyLeft(greyBack, sel, 128) === 1 && R.greyLeft(greenBack, sel, 128) === 1 && R.GREY_LEFT > 0 && R.GREY_LEFT < 1);

// retryPrompt / fillPrompt strict
const rp = R.retryPrompt("a woman in a park", { mode: "fill" }), rp0 = R.retryPrompt("", { mode: "own" });
check("retryPrompt: short and direct - a real photograph, nothing like a grey mannequin, shapes / pose / camera kept, the prompt after (2.996.0: the grey kept / the backdrop kept)",
  /^Make \{img1\} a real photograph/.test(rp) && /grey 3D model, a mannequin or a render/.test(rp) && /same shapes, pose, layout and camera angle/.test(rp) && rp.includes(R.KEEP_GREY) && /: a woman in a park$/.test(rp) && rp0.includes(R.OWN_BG) && !/What the photo/.test(rp0));
check("fillPrompt strict: 'Every green pixel must become …' first, the rest as before", /^Every green pixel must become part of a real photographed place/.test(R.fillPrompt("x", false, true)) && !/^Every/.test(R.fillPrompt("x", false)));

// the wiring
const PR = src("ext/pushpulldock/ppreal.js"), PV = src("ext/pushpulldock/ppview.js");
check("one way in: the ✨ Photo button and the prompt docker both call run -> capture (the plan) -> make",
  /async function run\(text\) \{\s*const R = capture\(text\)/.test(PR) && /const p = plan\(text, !!used\.bg, all\)/.test(PR) && /return await make\(R\)/.test(PR) && /run\(text\)\.catch/.test(PR) && /H3SketcherReal\.run\(t\)/.test(src("ext/pushpulldock/ppdock.js")));
check("several at once: no busy lock ('still making the last one' gone), a running count on both buttons, the shots taken at the click",
  !/S\.busy/.test(PR) && !/still making the last one/.test(PR) && /S\.runs\+\+; paintBusy\(\);/.test(PR) && /S\.runs = Math\.max\(0, S\.runs - 1\)/.test(PR)
  && /"✏ Edit \(Sketcher\)" \+ \(S\.runs \? " · " \+ S\.runs \+ " making" : ""\)/.test(PR) && /"✨ Photo" \+ \(S\.runs \? " · " \+ S\.runs : ""\)/.test(PR) && /shots: \{ photo, depth, model \}/.test(PR));
check("…each job goes in the queue (refreshJobs after every /api/aiedit), each run's own tag (📷 #n)", /async function aiJob\(fd, label(, R)?\)[\s\S]{0,400}root\.refreshJobs\(\)/.test(PR) && /tag = "📷 #" \+ R\.k/.test(PR));
check("the model's coverage from a SILHOUETTE shot (the renderer has alpha: false - a 'transparent' clear was opaque black on a real GPU)",
  /alpha: false/.test(PV) && /if \(o\.mask\) \{ ground\.visible = false; R\.setClearColor\(0x000000, 1\); scene\.overrideMaterial = new T\.MeshBasicMaterial\(\{ color: 0xffffff, side: T\.DoubleSide \}\); \}/.test(PV)
  && /if \(o\.transparent && !o\.mask\) \{[\s\S]{0,200}mask: true/.test(PV) && /d\.data\[i\] = md\[i - 3\]/.test(PV));
check("checked results (2.996.0: judge = shape + change): failed step 1 -> once more (retryPrompt, no references); a fill still plain / green -> once more (strict, no reference); said when it still is",
  /judge\(change, corr\)/.test(PR) && /retryPrompt\(text, p\)/.test(PR) && /if \(left > GREY_LEFT\)/.test(PR) && /form\(false, true\)/.test(PR) && /it still looks like the 3D model/.test(PR) && /some of the place is still a plain backdrop/.test(PR));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;

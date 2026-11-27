#!/usr/bin/env node
/* bitGen Studio — 2.996.0: ✨ Photo / ✏ Edit (Sketcher) - ONE JOB PER STEP, each checked (pure + source pins).
 * Tim: "photo or edit in sketcher from prompt produced 0/10 directed images. it is worse than before, i am getting random
 * interations, sometime just the actual reference picture, sometime the right pose but gray background, sometimes a mannequin
 * on the right background. please check to see if the logic statements don't conflict" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const R = require(path.join(ROOT, "ext/pushpulldock/ppreal.js"));

// ---- the references by what they are for
const ref = (role, i) => ({ src: "r" + i + ".png", role, cap: "Reference " + i + (role && role !== "person" ? " (" + role + ")" : "") });
const person = ref("person", 1), env = ref("environment", 2), style = ref("style", 3), cloth = ref("clothing", 4), wall = ref("wall", 5), first = ref("first frame", 6), env2 = ref("environment", 7);
const g = R.groupRefs([person, env, style, cloth, wall, first, env2]);
check("groupRefs: environment = the place, style = the place's look, person / clothing / wall … = the model's own, frames and a 2nd environment unused",
  g.env === env && g.style === style && g.subject.join() === [person, cloth, wall].join() && g.subject.length === 3 && g.unused.includes(first) && g.unused.includes(env2) && !g.unused.includes(person));

// ---- plan: ONE rule, every way in
const P = (t, bg, refs) => R.plan(t, bg, refs || []);
check("plan: the model's own backdrop = own (one step), whatever the references", P("", true).mode === "own" && P("a park", true, [env]).mode === "own" && P("", true, [env]).unused.includes(env));
check("…an environment reference = place (step 1, then cut out onto it) - its picture is the place, never sent to step 1", P("x", false, [person, env]).mode === "place" && P("x", false, [person, env]).env === env && !P("x", false, [person, env]).subject.includes(env));
check("…anything else = fill - no words, the default words, words, a person reference, a style reference (the style goes to step 2 only)",
  ["", R.DEFAULT, "a park"].every((t) => P(t, false).mode === "fill") && P("", false, [person]).mode === "fill" && P("", false, [style]).style === style && !P("", false, [style]).subject.includes(style));
check("…a style with an environment: the environment wins, the style is said as not used", P("", false, [env, style]).mode === "place" && P("", false, [env, style]).style === null && P("", false, [env, style]).unused.includes(style));

// ---- step 1's words: ONLY the model, the grey KEPT; no place, no "whole picture's look"
const sc = R.sceneWords({ rooms: [{ closed: true }] }, [], {});
const p0 = R.promptFor("", null, sc), pw = R.promptFor("a woman standing in a park", null, sc), po = R.promptFor("a park", null, sc, { own: true });
check("step 1: the lead + the depth line + KEEP the grey (the place comes later) - with or without words",
  p0.startsWith("Convert {img1}") && p0.includes(R.DEPTH) && p0.includes(R.KEEP_GREY) && pw.includes(R.KEEP_GREY) && !/replace all of it/.test(pw), pw);
check("…words ride as what the photo is for (for the model itself - keep the grey), last", /\nWhat the photo is for \(use it for the model itself - keep the grey\): a woman standing in a park$/.test(pw));
check("…the model's own backdrop: OWN_BG (that place made real), not the grey line", po.includes(R.OWN_BG) && !po.includes(R.KEEP_GREY) && /\nWhat the photo is for \(use it for the model itself\): a park$/.test(po));
const one = R.promptFor("", { tiles: [], refs: [person], single: true }, sc), many = R.promptFor("", { tiles: [], refs: [person, cloth] }, sc);
check("…one reference for the model: SUBJ1 with its Type (the model looks like it, in the render's pose) - never 'the whole picture's look'",
  one.includes(R.SUBJ1 + " (person): the model looks like it") && !/whole picture|its place, ground/.test(one) && many.includes(R.SUBJS), one);
check("…the old place-in-step-1 lines are gone (EMPTY / FOLLOW / PLACED / REF1 / REFS / EMPTY_ANY)", ["EMPTY", "FOLLOW", "PLACED", "REF1", "REFS", "EMPTY_ANY", "KEEP_MODEL"].every((k) => R[k] === undefined));
const rp = R.retryPrompt("a woman", { mode: "fill" });
check("retryPrompt: short and direct, the grey kept too (step 2 makes the place)", /^Make \{img1\} a real photograph/.test(rp) && rp.includes(R.KEEP_GREY) && /\nWhat the photo is for \(use it for the model itself\): a woman$/.test(rp) && R.retryPrompt("", { mode: "own" }).includes(R.OWN_BG));

// ---- step 2's words
const fp = R.fillPrompt("", false, false, "a person");
check("fillPrompt: no words = a real place that suits the model (named); words = the prompt's place", /\nA real place that suits a person\.$/.test(fp) && /\nThe place and the scene: a beach$/.test(R.fillPrompt("a beach", false, false, "a person")));
check("ringPrompt: only the green edge band - the ground under them, contact shadows, outline; nothing else changes", /^The green band in \{img1\} is the edge/.test(R.ringPrompt("")) && /contact shadows/.test(R.ringPrompt("")) && /Change nothing else\./.test(R.ringPrompt("")));

// ---- the checks
const W = 64, H = 48, N = W * H;
const mk = (f) => { const d = new Uint8ClampedArray(N * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = f(x, y), i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } return d; };
const inBox = (x, y) => x >= 20 && x < 44 && y >= 10 && y < 42;
const alpha = new Uint8Array(N).map((v, i) => (inBox(i % W, Math.floor(i / W)) ? 255 : 0));
const render = mk((x, y) => (inBox(x, y) ? [150, 150, 150] : [128, 128, 128]));                                 // a grey mannequin on the grey
const photo = mk((x, y) => (inBox(x, y) ? [200 - (y % 4) * 3, 150, 120] : [128, 128, 128]));                         // the same box, real colours
const other = mk((x, y) => ((x * 7 + y * 13) % 31 < 15 ? [40, 120, 200] : [220, 210, 90]));                         // a different picture (a copied reference)
const cR = R.edgeCorr(render, photo, W, H, alpha), cO = R.edgeCorr(render, other, W, H, alpha);
check("edgeCorr: the same outlines (a real photo of the render) high, a different picture low", cR > 0.5 && cO < R.EDGE_OK, { cR, cO });
check("…no model in view = 1 (nothing to judge)", R.edgeCorr(render, other, W, H, new Uint8Array(N)) === 1);
const ch = (b) => R.modelChange(render, b, alpha), J = (b) => R.judge(ch(b), R.edgeCorr(render, b, W, H, alpha));
check("judge: a real photo ok; the render back = 'render' (the grey mannequin); a copied reference = 'shape'", J(photo).ok && !J(render).ok && J(render).why === "render" && !J(other).ok && J(other).why === "shape", [J(photo), J(render), J(other)]);
const A = { ok: false, why: "shape", corr: 0.05, change: 80 }, B = { ok: false, why: "render", corr: 0.9, change: 2 }, C = { ok: true, why: "", corr: 0.6, change: 40 };
check("better: a passing photo wins; else the one that kept the shape (a mannequin beats a copied reference); else the one that changed more",
  R.better(A, C) === C && R.better(C, A) === C && R.better(A, B) === B && R.better(B, A) === B && R.better(B, Object.assign({}, B, { change: 5 })).change === 5 && R.better(A, null) === A);
const sel = new Uint8Array(N).map((v, i) => (inBox(i % W, Math.floor(i / W)) ? 0 : 1));
const flatWhite = mk(() => [236, 236, 238]), grass = mk((x, y) => [40 + (x * 3 + y) % 30, 120 + (x + y * 5) % 40, 30]), greenB = mk(() => [0, 255, 0]);
check("greyLeft: the grey, the green and a flat studio white count; a real (textured) place does not; greenOnly = the green alone",
  R.greyLeft(render, sel, 128) === 1 && R.greyLeft(greenB, sel, 128) === 1 && R.greyLeft(flatWhite, sel, 128) > 0.9 && R.greyLeft(grass, sel, 128) === 0 && R.greyLeft(flatWhite, sel, 128, true) === 0 && R.greyLeft(greenB, sel, 128, true) === 1);
const use = R.refUse(R.plan("", false, [person, style]), [person, style]);
check("refUse: what each reference was used for, said (a place typed 'person' is told to be set to environment)", /^Reference 1 \(person\) → the model's look - a place\? set its Type to environment$/.test(use[0]) && /^Reference 3 \(style\) → the look of the place$/.test(use[1]), use);

// ---- the wiring
const PR = src("ext/pushpulldock/ppreal.js"), AE = src("routes/aiedit.js");
check("capture: step 1 gets the model's own references only (plan.subject); the grey unless the model has its own backdrop",
  /used\.refs = p\.subject;/.test(PR) && /p\.mode === "own" \? \{\} : \{ fill: FILL \}/.test(PR) && /promptFor\(text, withBoard \? used : null, scene, \{ own: p\.mode === "own" \}\)/.test(PR));
check("step 1 checked (modelChange + edgeCorr -> judge); failed = once more WITHOUT the references (form(false, retryPrompt)), the better kept",
  /judge\(change, corr\)/.test(PR) && /form\(false, retryPrompt\(text, p\)\)/.test(PR) && /best = better\(best, await look\(/.test(PR));
check("step 2: place = cut out onto the environment picture (coverData) + the edge band (ringPrompt, greenOnly); fill = the green with a style reference only",
  /const env = await coverData\(p\.env\.src, w, h\)/.test(PR) && /prompt: \(\) => ringPrompt\(text\), ref: null, greenOnly: true/.test(PR) && /ref = p\.style \? await refBlobOf\(p\.style\.src\) : null/.test(PR));
check("a failed step is SAID in the last message (⚠ …), never overwritten by 'done'", /notes\.push\(\(p\.mode === "place"/.test(PR) && /\(notes\.length \? " ⚠ " : " "\)/.test(PR) && !/setTimeout\(ok, 1500\)/.test(PR));
check("the server: {img1} replaced with ref_raw even with no reference (step 2's fill had '{img1}' as written)", /if \(!ref0 && b\.ref_raw === "1"\) plan\.prompt = String\(plan\.prompt \|\| ""\)\.replace/.test(AE));
check("no busy lock (several at once, 2.995.0 kept)", !/S\.busy/.test(PR) && /S\.runs\+\+; paintBusy\(\);/.test(PR));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;

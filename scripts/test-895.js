#!/usr/bin/env node
/* bitGen Studio — 2.895.0 units: ✨ Auto edit PART 2 - sound effects pinned to the picture (seams, crash zoom, steps, the
 * closing riser -> impact -> sparkle, never a machine gun), the flash cut, the speed moves (freeze then catch up, slow motion -
 * time remapping), bitGen's own plan using them, lib/autoEditMedia.js (the synthesized sounds' recipes, the vision look with its
 * cache), the routes, the box's new ticks and the prompt docker route.
 * Tim (verbatim): "continue with part 2" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const AE = require("../static/autoedit.js"), KF = require("../static/keyframes.js"), CF = require("../static/clipfx.js");

const g = AE.grid({ tempo: 120, total: 24 });   // 48 beats of 0.5 s
const assets = [{ name: "dough.mp4", kind: "video", dur: 20, w: 1920, h: 1080 }, { name: "shop.png", kind: "picture", w: 1600, h: 900 }, { name: "oven.mp4", kind: "video", dur: 20, w: 1920, h: 1080 }];
const files = {}; Object.keys(AE.SFX).forEach((k) => { files[k] = [{ name: `autoedit-sfx-${k}-1.wav`, dur: AE.SFX[k].dur }, { name: `autoedit-sfx-${k}-2.wav`, dur: AE.SFX[k].dur }]; });
const plan = AE.clean({ shots: [
  { asset: 1, beats: 8, move: "push" }, { asset: 2, beats: 4, move: "panL", enter: "push" }, { asset: 3, beats: 8, move: "crash", enter: "flash" },
  { card: true, text: "Fresh daily", beats: 4, enter: "cut" }, { asset: 1, beats: 8, move: "freeze", enter: "whip" }, { asset: 3, beats: 4, move: "steps", enter: "zoom" },
  { asset: 2, beats: 4, move: "pulse", enter: "push" }, { asset: 3, beats: 8, move: "slowmo", enter: "dissolve", text: "Visit us", title: "card" }] }, assets, g);
const B = AE.build(plan, assets, g, { W: 1920, H: 1080 }, { sfx: files, white: { name: "autoedit-white-1920x1080.png", w: 1920, h: 1080 } });
const sfx = B.audio.flatMap((L) => L.clips.map((c) => Object.assign({ L: L.name }, c)));
const hitAt = (c) => c.start - c.in + AE.SFX[c.ae.sfx].peak;
const t0 = (i) => B.shots[i - 1].t0;

/* ---- the recipes */
check("the new recipes: freeze (speed-ramp-freeze) + slow motion (videos only) moves, the flash cut seam (shot-transitions A), 7 sound effects with their lengths and hits",
  AE.MOVES.freeze.video && AE.MOVES.slowmo.video && /speed-ramp-freeze/.test(AE.MOVES.freeze.credit) && AE.ENTERS.flash.flash && /flash cut/.test(AE.ENTERS.flash.credit)
  && Object.keys(AE.SFX).join() === "whoosh,swish,impact,hit,riser,sparkle,tick" && AE.SFX.riser.peak === AE.SFX.riser.dur && /- freeze: Freeze/.test(AE.catalogue()) && /- flash: Flash cut/.test(AE.catalogue()));

/* ---- sound effects */
const at = (kind) => sfx.filter((c) => c.ae.sfx === kind).map(hitAt);
const near = (a, b) => Math.abs(a - b) < 1e-3;
check("a whoosh on the push seam, its swell peaking ON the shot's beat; a swish on the whip; nothing on a plain cut or a dissolve",
  at("whoosh").some((t) => near(t, t0(2))) && at("swish").some((t) => near(t, t0(5))) && !sfx.some((c) => near(hitAt(c), t0(8)) && c.ae.sfx === "whoosh"), sfx.map((c) => [c.ae.sfx, hitAt(c).toFixed(2), c.ae.why]));
const crash = B.vlayers.flatMap((L) => L.clips).find((c) => c.ae.move === "crash"), punch = crash.start + crash.kf.filter((k) => k.scale != null).reduce((m, k) => (k.scale > m.scale ? k : m)).at;
check("an impact on the crash zoom's punch; a hit on the flash cut and on each step of the step zoom; a tick when the title card comes",
  at("impact").some((t) => near(t, punch)) && at("hit").some((t) => near(t, t0(3))) && at("hit").filter((t) => t > t0(6) && t < t0(7)).length === 2 && at("tick").some((t) => near(t, t0(4))), sfx.map((c) => [c.ae.sfx, hitAt(c).toFixed(2), c.ae.why]));
check("the closing phrase: a riser ending on the sign-off's beat, an impact on it, a sparkle just after (nothing else on that beat)",
  at("riser").some((t) => near(t, t0(8))) && at("impact").some((t) => near(t, t0(8))) && at("sparkle").some((t) => near(t, t0(8) + 0.12)) && !sfx.some((c) => ["whoosh", "hit", "tick"].includes(c.ae.sfx) && near(hitAt(c), t0(8))), sfx.filter((c) => hitAt(c) > t0(7)).map((c) => [c.ae.sfx, hitAt(c)]));
const ev = AE.sfxEvents([{ i: 0, t0: 0, shot: { enter: "cut" } }, { i: 1, t0: 1, shot: { enter: "push" }, clip: null }, { i: 2, t0: 1.1, shot: { enter: "flash" } }, { i: 3, t0: 1.5, shot: { enter: "push" } }, { i: 4, t0: 2.5, shot: { enter: "push" } }, { i: 5, t0: 5, shot: { enter: "cut" } }], g, files);
check("never a machine gun: two sounds 0.1 s apart = the stronger only (the flash's hit); a whoosh soon after another is the other variant and quieter",
  !ev.some((c) => c.ae.sfx === "whoosh" && near(c.start - c.in + 0.48, 1)) && ev.some((c) => c.ae.sfx === "hit") && (() => { const w = ev.filter((c) => c.ae.sfx === "whoosh"); return w.length === 2 && w[0].name !== w[1].name && w[1].kf[0].vol < w[0].kf[0].vol; })(), ev.map((c) => [c.ae.sfx, c.name, c.start, c.kf[0].vol]));
check("...on ✨ SFX A / B taking turns (two may overlap), full layer volume; a riser that would start before 0 s is trimmed from its start",
  B.audio.map((L) => L.name).join() === "✨ SFX A,✨ SFX B" && B.audio.every((L) => L.volume === 1) && AE.sfxEvents([{ i: 0, t0: 0, shot: {} }, { i: 1, t0: 0.5, shot: {} }, { i: 2, t0: 1, shot: {} }], g, files).some((c) => c.ae.sfx === "riser" && c.start === 0 && c.in === 1));
check("no files (☐ sound effects) = no sound effects layers", AE.build(plan, assets, g, { W: 1920, H: 1080 }, {}).audio.length === 0);

/* ---- the flash cut */
const fl = B.images.find((L) => L.name === "✨ Flash");
check("the flash cut: a white frame on ✨ Flash (under ✨ Titles) at the cut, 0.95 -> 0 in 4 frames; the seam itself a hard cut (no overlap)",
  fl && fl.clips.length === 1 && near(fl.clips[0].start, t0(3)) && KF.value(fl.clips[0].kf, 0, "op", 0) === 0.95 && KF.value(fl.clips[0].kf, 4 / 24, "op", 1) < 0.01 && B.images.map((L) => L.name).indexOf("✨ Flash") === B.images.length - 2 && B.shots[2].o === 0, fl);
check("...no white picture = a plain cut (no flash layer)", !AE.build(plan, assets, g, { W: 1920, H: 1080 }, {}).images.some((L) => L.name === "✨ Flash"));

/* ---- speed moves */
const vc = B.vlayers.flatMap((L) => L.clips), fz = vc.find((c) => c.ae.move === "freeze"), sm = vc.find((c) => c.ae.move === "slowmo");
const fzLen = fz.fx.remap[fz.fx.remap.length - 1].t, fzN = CF.normalize(fz.fx);
check("freeze then catch up: the source flows, HOLDS one frame (the remap's q stays), then plays faster to catch up; the clip as long as its shot; clipfx accepts it",
  fz.fx.remap.length === 4 && fz.fx.remap[1].q === fz.fx.remap[2].q && fz.fx.remap[2].t > fz.fx.remap[1].t && near(fzLen, fz.out - fz.in) && fzN.remap && near(fzLen, B.shots[4].t1 - fz.start), fz);
check("slow motion: half speed - the clip uses half its length of the source", sm && near(sm.out - sm.in, sm.fx.remap[1].t / 2) && sm.fx.remap[1].q === r(sm.fx.remap[1].t / 2), sm);
function r(v) { return Math.round(v * 1e4) / 1e4; }
check("...a hit when the freeze lands", at("hit").some((t) => near(t, fz.start + fz.fx.remap[1].t)));
const pc = AE.clean({ shots: [{ asset: 2, beats: 8, move: "freeze" }, { asset: 2, beats: 8, move: "slowmo" }] }, assets, g);
check("a speed move asked for a picture becomes one it can do; a 6 s video can carry a 9 s slow motion shot (it uses half)",
  pc.shots[0].move === "kenburns" && pc.shots[1].move === "push" && AE.clean({ shots: [{ asset: 1, beats: 18, move: "slowmo" }] }, [{ name: "dough.mp4", kind: "video", dur: 6 }], g).shots.find((s) => s.move === "slowmo").beats >= 18, pc.shots);
const as2 = [assets[1], assets[0], assets[2]];   // the hero (the second) a video
const fb = AE.clean(AE.fallback(as2, AE.grid({ tempo: 120, total: 40 }), { feel: "promo" }), as2, AE.grid({ tempo: 120, total: 40 }));
check("bitGen's own plan uses them: slow motion on a video hero shot, one freeze at most, flash cuts in the climb",
  fb.shots.some((s) => s.move === "slowmo") && fb.shots.filter((s) => s.move === "freeze").length <= 1 && fb.shots.some((s) => s.enter === "flash"), fb.shots.map((s) => s.move + "/" + s.enter));
check("the check still finds nothing in a full edit with sound + flash + speed", AE.qa(B, plan, g, assets).length === 0, AE.qa(B, plan, g, assets));

/* ---- lib/autoEditMedia.js */
const M = require("../lib/autoEditMedia");
const a = M.sfxArgs("impact", 0, "/tmp/x.wav"), w = M.sfxArgs("whoosh", 1, "/tmp/y.wav");
check("the sounds are bitGen's own (ffmpeg's tone + noise sources, no sample files): every kind, two variants; the lengths = static/autoedit.js SFX",
  M.KINDS.join() === Object.keys(AE.SFX).join() && M.KINDS.every((k) => M.SFX_RECIPES[k](0)[2] === AE.SFX[k].dur && M.SFX_RECIPES[k](1)[2] === AE.SFX[k].dur)
  && a.includes("-filter_complex") && a.filter((x) => x === "lavfi").length === 2 && /anoisesrc/.test(w.join(" ")) && w.includes("-af") && w[w.length - 1] === "/tmp/y.wav" && w.includes("44100"), { a, w });
// the vision look, with a stand-in core (a project in a temp folder) and a stand-in vision model
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ae895-")); fs.mkdirSync(path.join(tmp, "images")); fs.writeFileSync(path.join(tmp, "images", "shop.png"), "png");
require.cache[require.resolve("../lib/core")] = { id: "core", filename: "core", loaded: true, exports: { projDir: () => tmp, getProject: () => "p", pDir: (k) => path.join(tmp, k) } };
let asked = 0;
M.setDescribe(async (fl) => { asked += fl.length; return fl.map((f) => "A bakery shop front at dawn, wide. (" + f.originalname + ")"); });
(async () => {
  let r = await M.describe([{ name: "shop.png", kind: "picture" }, { name: "gone.png", kind: "picture" }]);
  check("describe: the vision model asked about each picture (its own short question), the answer kept per file; a missing one said",
    r.notes["shop.png"] === "A bakery shop front at dawn, wide. (shop.png)" && r.asked === 1 && r.errors.some((e) => /gone\.png/.test(e)) && /video editor/.test(M.LOOK), r);
  r = await M.describe([{ name: "shop.png", kind: "picture" }]);
  check("...asked once: the second time it comes from the project's cache (cache/autoedit-look.json)", asked === 1 && r.cached === 1 && fs.existsSync(path.join(tmp, "cache", "autoedit-look.json")), r);
  M.setDescribe(async () => { throw new Error("no vision model loaded"); });
  fs.writeFileSync(path.join(tmp, "images", "new.png"), "png2");
  r = await M.describe([{ name: "new.png", kind: "picture" }]);
  check("...no vision model = no notes, the reason said (the plan goes on without)", !r.notes["new.png"] && /no vision model loaded/.test(r.errors.join()), r);
  M.setDescribe(null); delete require.cache[require.resolve("../lib/core")];
  fs.rmSync(tmp, { recursive: true, force: true });
  const LA = require("../lib/autoEdit");
  check("the LLM is told to pick shots by what is in them, a freeze once, the flash cut's use; the descriptions go in the list", /Pick shots by what is in them/.test(LA.SYSTEM) && /A freeze is for one key moment/.test(LA.SYSTEM)
    && /1\. shop\.png - picture - A bakery/.test(LA.assetLines([{ name: "shop.png", kind: "picture", note: "A bakery shop front" }])));
  const rt = src("routes/autoEdit.js"), ui = src("ext/timelinedock/tlautoedit.js");
  check("routes: POST /api/autoedit/media (base + white + sounds), POST /api/autoedit/describe", /"\/api\/autoedit\/media"/.test(rt) && /"\/api\/autoedit\/describe"/.test(rt));
  check("the box: ☑ 👁 look at them first, ☑ 🔊 sound effects, /api/autoedit/media at ✔ Build (built again with the sounds + the white picture), the notes as each asset's tooltip",
    ["aeLook", "aeSfx", "/api/autoedit/describe", "/api/autoedit/media", "sfx: wantSfx ? m.sfx : null", "white: m.white"].every((s) => ui.includes(s)) && /a\.note \? ' title="'/.test(ui));
  // the prompt docker route (its words test)
  const ASK = eval(ui.match(/var ASK = (\/.*\/i);/)[1]);
  check("the prompt docker: \"auto edit …\", \"cut these to the music\", \"make a promo edit of …\" go to ✨ Auto edit; ordinary words do not (H3ChatRoutes)",
    ["auto edit my bakery clips", "Auto-edit these", "cut these to the music please", "cut my clips to the beat", "make a promo edit of the bakery photos", "edit my videos into a reel"].every((t) => ASK.test(t))
    && !["what is the weather", "write a song about bread", "make a picture of a cat", "edit the prompt"].some((t) => ASK.test(t)) && /window\.H3ChatRoutes = \(window\.H3ChatRoutes \|\| \[\]\)\.concat\(\[route\]\)/.test(ui));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

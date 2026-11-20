#!/usr/bin/env node
/* bitGen Studio — 2.894.0 units: ✨ AUTO EDIT on the timeline - static/autoedit.js (the beat grid, the recipes, bitGen's own plan, a
 * plan made valid, the build into layers + keyframes, the check), lib/autoEdit.js (the LLM's plan, cleaned; bitGen's plan when it
 * does not answer), the route, the timeline's ✨ box, the credit.
 * Tim (verbatim): "https://github.com/Vincentwei1021/video-shotcraft, can we add these to timeline to automate video editing?"
 * (he chose "Our own Auto edit") */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const AE = require("../static/autoedit.js"), KF = require("../static/keyframes.js"), LA = require("../lib/autoEdit");

/* ---- the grid */
const songBeats = Array.from({ length: 80 }, (_, i) => 0.24 + i * 0.5 + (i % 3 ? 0.01 : -0.01));
let g = AE.grid({ beats: songBeats, tempo: 120, total: 30 });
check("grid: the song's first beat = 0 (offset kept for the song), 120 BPM, 30 s = 60 beats = 15 bars, beat i = the song's beat",
  g.offset === 0.23 && Math.abs(g.spb - 0.5) < 0.01 && g.n === 60 && g.bars === 15 && Math.abs(g.at(10) - (songBeats[10] - songBeats[0])) < 1e-3 && g.fromSong, { off: g.offset, spb: g.spb, n: g.n });
check("...past the song's last beat the grid goes on at its tempo; a length that is not whole bars is rounded to bars", Math.abs(g.at(85) - (g.at(79) + 6 * g.spb)) < 1e-3 && AE.grid({ beats: songBeats, total: 31.3 }).n === 60);
const g0 = AE.grid({ tempo: 100, total: 20 });
check("...no song: a steady grid (100 beats a minute = 0.6 s), 32 beats in whole bars", g0.n === 32 && g0.spb === 0.6 && g0.at(5) === 3 && !g0.fromSong, g0);

/* ---- the recipes */
check("the recipes: 11 moves, 5 seams, 3 title styles, the 4-part arc adding to 100 %; each says which video-shotcraft card it comes from",
  Object.keys(AE.MOVES).length >= 11 && ["cut", "dissolve", "push", "whip", "zoom"].every((k) => AE.ENTERS[k]) && Object.keys(AE.TITLES).length === 3 && Math.abs(AE.ARC.reduce((s, a) => s + a.share, 0) - 1) < 1e-9
  && Object.values(AE.MOVES).every((m) => m.credit) && Object.values(AE.ENTERS).every((m) => m.credit) && /crash-zoom-punch/.test(AE.MOVES.crash.credit));
check("...the catalogue for the LLM names every move with its energy and the arc", /- crash: Crash zoom/.test(AE.catalogue()) && /needs 3.2 s/.test(AE.catalogue()) && /- climb 61 %/.test(AE.catalogue()));
const ck = AE.MOVES.crash.keys(4, 1.5, 1920, 1080, 1.5);
check("crash zoom (crash-zoom-punch): the wide held, 6 frames in to 1.66x, back to 1.6x (a 4 % overshoot), the close-up held to the end",
  ck[1].at === 1.5 && Math.abs(ck[2].at - (1.5 + 6 / 24)) < 1e-9 && Math.abs(ck[2].v / 1.5 - 1.66) < 1e-9 && Math.abs(ck[3].v / 1.5 - 1.6) < 1e-9 && 4 - ck[3].at >= 45 / 24 - 1e-9, ck);

/* ---- plans */
const assets = [{ name: "dough.mp4", kind: "video", dur: 6, w: 1280, h: 720 }, { name: "shop.png", kind: "picture", w: 1024, h: 1024 }, { name: "oven.mp4", kind: "video", dur: 12, w: 1920, h: 1080, src: "output" }, { name: "loaf.jpg", kind: "picture", w: 3000, h: 2000 }];
const fb = AE.clean(AE.fallback(assets, g, { brief: "Rosie bakes bread at dawn. Come and visit us!", feel: "promo" }), assets, g);
const sum = (p) => p.shots.reduce((t, s) => t + s.beats, 0);
check("bitGen's own plan: fills the 60 beats, every asset used before any again, the first shot cut in, the opening and sign-off held >= 1 s, the brief's words opening and closing",
  sum(fb) === 60 && fb.shots.slice(0, 4).map((s) => s.asset).sort().join() === assets.map((a) => a.name).sort().join() && fb.shots[0].enter === "cut" && fb.shots[0].beats * g.spb >= 1
  && fb.shots[fb.shots.length - 1].beats * g.spb >= 1 && fb.shots[0].text === "Rosie bakes bread at dawn." && fb.shots[fb.shots.length - 1].text === "Come and visit us!" && fb.shots[fb.shots.length - 1].title === "card", fb.shots);
check("...no move twice in a row; a crash zoom never in a shot too short for it", fb.shots.every((s, i) => !i || s.move !== fb.shots[i - 1].move || s.move === "hold") && fb.shots.every((s) => s.move !== "crash" || s.beats * g.spb >= 3.2));
check("...hype = shorter shots than calm", AE.fallback(assets, g, { feel: "hype" }).shots.length > AE.fallback(assets, g, { feel: "calm" }).shots.length);
let p = AE.clean({ shots: [{ asset: 1, beats: 40, move: "push", enter: "whip" }, { asset: "SHOP", beats: 8, move: "push" }, { asset: "nope.mov", beats: 4, move: "fly" }, { card: true, text: "Fresh  every   morning", beats: 4 }, { asset: "oven.mp4", beats: 2, move: "crash" }] }, assets, g);
const sh = p.shots;
check("clean: asset by number / name (any case) / unknown -> one of the list (said); a 6 s video cut to the beats it has; an unknown move -> a fitting one",
  sh[0].asset === "dough.mp4" && sh[0].beats <= Math.floor((6 - 0.375) / 0.5) && sh[1].asset === "shop.png" && sh.some((s) => s.card && s.text === "Fresh every morning") && p.notes.some((n) => /nope\.mov/.test(n)) && p.notes.some((n) => /dough\.mp4 is 6\.0 s/.test(n)), p);
check("...the beats add up to the length again; the first shot enters with a cut; the same move twice in a row changed (said); a 1 s crash zoom made a push",
  sum(p) === 60 && sh[0].enter === "cut" && sh[1].move !== "push" && p.notes.some((n) => /twice in a row/.test(n)) && sh.every((s) => s.move !== "crash" || s.beats * g.spb >= 3.2), sh);
check("...no shots at all = bitGen's own plan (said)", AE.clean({ shots: [] }, assets, g).notes[0] === "the plan had no shots - bitGen's own plan");

/* ---- build */
const B = AE.build(fb, assets, g, { W: 1920, H: 1080 }, { song: { name: "song.mp3", in: 2, dur: 60 } });
const clips = B.vlayers.concat(B.images).flatMap((L) => L.clips.map((c) => Object.assign({ L: L.name }, c)));
check("build: videos on ✨ Video A / B and pictures on ✨ Pictures A / B taking turns, titles on ✨ Titles (on top), the song on ✨ Music; the video layers muted under the song",
  B.vlayers.map((L) => L.name).join() === "✨ Video A,✨ Video B" && B.images.map((L) => L.name).join() === "✨ Pictures A,✨ Pictures B,✨ Titles" && B.audio[0].name === "✨ Music" && B.vlayers.every((L) => L.muted), B.vlayers.map((L) => L.name));
check("...every shot starts on a beat; the edit is exactly the 60 beats; the check finds nothing", B.shots.every((s) => songBeats.some((b) => Math.abs(b - songBeats[0] - s.t0) < 1e-3) || s.t0 > 39) && Math.abs(B.total - g.at(60)) < 1e-9 && AE.qa(B, fb, g, assets).length === 0, AE.qa(B, fb, g, assets));
const v0 = B.vlayers[0].clips[0];
check("...a video: its source in / out, cover scale (1280 x 720 on 1920 x 1080 = 1.5), the push move as keys (1.5 -> 1.68, ease in-out)",
  v0.name === "dough.mp4" && v0.src === "video" && v0.in === 0 && v0.tf.scale === 1.5 && v0.kf[0].scale === 1.5 && Math.abs(v0.kf[v0.kf.length - 1].scale - 1.68) < 1e-6 && v0.kf[0].ease === "bezier", v0);
const pic = B.images[0].clips[0];
check("...a picture: its length, cover scale from the canvas's scale-1 size (1024 square drawn 1024 wide -> fills 1920 wide: 1920/1024)", pic.name === "shop.png" && pic.len > 0 && Math.abs(pic.tf.scale - 1920 / 1024) < 1e-3, pic);
const dis = B.shots.find((s) => s.enter === "dissolve" && s.o > 0);
check("...a dissolve: the two shots overlap (the incoming starts early, arrives ON the beat), the upper one fades", dis && (() => {
  const inc = clips.find((c) => c.ae && c.ae.shot === dis.i), prev = clips.find((c) => c.ae && c.ae.shot === dis.i - 1);
  const up = KF.has(inc.kf, "op") ? inc : prev;
  return Math.abs(inc.start - (dis.t0 - dis.o)) < 1e-3 && KF.has(up.kf, "op") && (up === inc ? KF.value(up.kf, 0, "op", 1) === 0 && KF.value(up.kf, dis.o, "op", 1) === 1 : KF.value(up.kf, (prev.len || prev.out - prev.in), "op", 1) === 0);
})(), dis);
const pu = B.shots.find((s) => s.enter === "push" && s.o > 0), inc = pu && clips.find((c) => c.ae && c.ae.shot === pu.i), out = pu && clips.find((c) => c.ae && c.ae.shot === pu.i - 1);
check("...a push: the incoming slides in from a frame's width to the move's own place on the beat, the outgoing slides out the other way",
  inc && Math.abs(KF.value(inc.kf, 0, "x", 0) - (1920 + KF.value(inc.kf, pu.o, "x", 0))) < 1 && out && KF.value(out.kf, (out.len != null ? out.len : out.out - out.in), "x", 0) < -1900, { inc, out });
const ti = B.images[2].clips;
check("...titles: from their shot's beat, rising in (opacity 0 -> 1, from lower), the last one a title card held to the end",
  ti.length === 2 && ti[0].text.content === "Rosie bakes bread at dawn." && ti[0].start === 0 && KF.value(ti[0].kf, 0, "op", 1) === 0 && KF.value(ti[0].kf, 0.5, "op", 0) === 1 && ti[1].ae.title === "card" && Math.abs(ti[1].start + ti[1].len - B.total) < 1e-3, ti);
const mu = B.audio[0].clips[0];
check("...the music: from the song's first beat (its in + the grid's offset), the edit's length, faded out over the last 2 beats", mu.in === 2.23 && Math.abs(mu.out - mu.in - B.total) < 1e-3 && KF.value(mu.kf, B.total, "vol", 1) === 0 && KF.value(mu.kf, B.total - 1.1, "vol", 0) === 1, mu);
const twice = AE.build(AE.clean({ shots: [{ asset: "oven.mp4", beats: 8, move: "push" }, { asset: "shop.png", beats: 8, move: "hold" }, { asset: "oven.mp4", beats: 8, move: "pull" }] }, assets, AE.grid({ tempo: 120, total: 12 })), assets, AE.grid({ tempo: 120, total: 12 }), { W: 1920, H: 1080 });
const ov = twice.vlayers.flatMap((L) => L.clips).filter((c) => c.name === "oven.mp4");
check("...a video used twice takes the next stretch of it, never past its end; no song = no music layer and the clips keep their sound", ov.length === 2 && ov[1].in > ov[0].in && ov[1].out <= 12 + 1e-9 && twice.audio.length === 0 && twice.vlayers.every((L) => !L.muted), ov);
const bad = Object.assign({}, B, { shots: B.shots.map((s, i) => (i === 2 ? Object.assign({}, s, { t0: s.t0 + 0.11 }) : s)) });
check("qa: a shot off the beat is found", AE.qa(bad, fb, g, assets).some((x) => /does not start on a beat/.test(x)));

/* ---- the server's plan */
(async () => {
  let asked = null;
  LA.setComplete(async (o) => { asked = o; return { ok: true, text: '```json\n{"title":"Rosie","shots":[{"asset":2,"beats":8,"move":"push","enter":"cut","text":"Baked at dawn","title":"rise","section":"open"},{"asset":1,"beats":10,"move":"panL","enter":"dissolve"},{"card":true,"text":"Open 7am","beats":4},{"asset":3,"beats":30,"move":"crash","enter":"zoom"},{"asset":4,"beats":8,"move":"hold","enter":"whip","text":"Visit us","title":"card"}]}\n```' }; });
  let r = await LA.plan({ assets, beats: songBeats, tempo: 120, total: 30, brief: "A promo for Rosie's Bakery", feel: "promo" });
  check("plan: the LLM is told the rules, the beats (60 total, the tempo), the numbered pictures / videos with their seconds and the recipes",
    /Music first: every shot starts on a beat/.test(asked.messages[0].content) && /TOTAL BEATS = 60/.test(asked.messages[1].content) && /1\. dough\.mp4 - video, 6\.0 s, 1280x720/.test(asked.messages[1].content) && /- whip: Whip pan/.test(asked.messages[1].content), asked.messages[1].content.slice(0, 600));
  check("...its plan cleaned: by the LLM, assets by number, the beats adding to 60, the card kept, the grid returned", r.by === "llm" && r.plan.shots[0].asset === "shop.png" && sum(r.plan) === 60 && r.plan.shots.some((s) => s.card) && r.grid.n === 60 && r.plan.title === "Rosie", r.plan.shots);
  LA.setComplete(async () => ({ ok: false, error: "no LLM running" }));
  r = await LA.plan({ assets, tempo: 110, total: 20, titles: false });
  check("...no LLM answering = bitGen's own plan, said; words off = no words", r.by === "bitGen" && /no LLM running - bitGen's own plan/.test(r.plan.notes[0]) && r.plan.shots.every((s) => !s.text) && sum(r.plan) === r.grid.n, r.plan.notes);
  let e = ""; try { await LA.plan({ assets: [] }); } catch (x) { e = x.message; }
  check("...nothing to edit is refused; a video with no length is left out", /give the pictures/.test(e) && LA.cleanAssets([{ name: "a.mp4", kind: "video" }, { name: "b.png" }]).length === 1);
  LA.setComplete(null);
  const rt = src("routes/autoEdit.js");
  check("route: POST /api/autoedit/plan, mounted from routes/index.js (not server.js)", /app\.post\("\/api\/autoedit\/plan"/.test(rt) && /require\("\.\/autoEdit"\)\.mount\(app\)/.test(src("routes/index.js")) && !/autoedit/i.test(src("misc/server.js")));
  const ui = src("ext/timelinedock/tlautoedit.js");
  check("the timeline: ✨ (tlAutoEditBtn) opens the box - what to edit, music, length, feel, words, the brief, ✨ Plan, the storyboard, ✔ Build into a new timeline; static/autoedit.js loaded after keyframes.js",
    /TlDlg\.button\("tlAutoEditBtn", "✨"/.test(ui) && ["aeSrc", "aeSong", "aeLen", "aeFeel", "aeTitles", "aeCards", "aeBrief", "aePlan", "aeBuild", "aeNewTl", "/api/tlai/beats", "/api/autoedit/plan", "tlSaveNamed", "A.qa("].every((s) => ui.includes(s))
    && /"tlautoedit\.js"/.test(src("ext/timelinedock/ext.json")) && src("static/index.html").indexOf("/static/autoedit.js") > src("static/index.html").indexOf("/static/keyframes.js"));
  check("credit: video-shotcraft (Vincentwei1021, Apache-2.0) named in the code, the box and lib/credits.json", /video-shotcraft \(Vincentwei1021, Apache-2\.0\)/.test(src("static/autoedit.js")) && /video-shotcraft/.test(ui) && /video-shotcraft/.test(src("lib/credits.json")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

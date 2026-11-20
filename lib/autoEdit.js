// bitGen Studio — lib/autoEdit.js (2.894.0): ✨ AUTO EDIT on the timeline - the server half: the LLM plans the edit (the shots, how
// long each is in beats, its move, the seam into it, its words) from the pictures / videos, the song's beat grid and the user's
// brief; static/autoedit.js (H3AutoEdit - the same file the page uses) makes the plan valid, or makes one itself when no LLM
// answers. The page builds it on the timeline (ext/timelinedock/tlautoedit.js).
// The craft is video-shotcraft's (Vincentwei1021, Apache-2.0 - its editing rules and shot recipes, not its code or Remotion).
// Tim (verbatim): "https://github.com/Vincentwei1021/video-shotcraft, can we add these to timeline to automate video editing?"
"use strict";
const AE = require("../static/autoedit.js");
let completeFn = null;
function setComplete(fn) { completeFn = fn; }   // tests
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const clip = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

const SYSTEM = `You are a film editor cutting a short video to music (or to a steady pace when there is no song). bitGen Studio builds your plan on its timeline with real keyframes. Answer with JSON only, exactly this shape:
{"title": "a short name for the edit", "shots": [{"asset": <the picture / video NUMBER from the list>, "beats": <whole beats>, "move": "<a MOVE id>", "enter": "<an ENTER id>", "text": "words on screen or \\"\\"", "title": "<a TITLES id>", "section": "open|hero|climb|card|finale"}]}
A title card with no picture under it: {"card": true, "text": "...", "beats": n, "enter": "cut", "section": "card"}.
THE RULES (a promo editor's craft):
- Music first: every shot starts on a beat; the beats of all shots add up EXACTLY to the total beats given. Calm shots last a bar or two (4-8 beats), fast ones 1-4 beats.
- The arc: a low, held opening (at least 1 second); one hero shot, slow and the richest; the climb - high and low energy shots taking turns, a short title card (about 2 seconds) every one or two shots, 2-4 cards in all; the finale is the peak, then a sign-off held at least 1 second.
- Use every picture / video once before using any again; a video shot can never be longer than the video (its seconds are listed).
- One move per shot, never the same move twice in a row; one technique is the star of a shot only once in the film.
- The seam into a shot follows the energy on both sides: dissolve between calm shots, push between shots of the same pace, whip between fast shots, zoom into a climax; cut is the default. The first shot enters with cut.
- Words: short (2-7 words), in the language of the brief, never invented facts - take names, offers and dates from the brief. Titles on a few shots only; the last shot carries the call to action or sign-off.
- Write nothing but the JSON.`;

function assetLines(assets) {
  return assets.map((a, i) => `${i + 1}. ${a.name} - ${a.kind === "video" ? "video, " + Math.max(0, (a.out != null ? a.out : a.dur || 0) - (a.in || 0)).toFixed(1) + " s" : "picture"}${a.w && a.h ? `, ${a.w}x${a.h}` : ""}${a.note ? " - " + clip(a.note, 200) : ""}`).join("\n");
}
/** the assets the page sends: [{name, kind video|picture, dur, in, out, w, h, src, note}] - cleaned */
function cleanAssets(list) {
  const out = [];
  for (const a of Array.isArray(list) ? list : []) {
    const name = clip(a && a.name, 240); if (!name) continue;
    const kind = a.kind === "video" ? "video" : "picture";
    const o = { name, kind, w: Math.round(+a.w || 0) || undefined, h: Math.round(+a.h || 0) || undefined, src: clip(a.src, 20) || undefined, note: clip(a.note, 300) || undefined };
    if (kind === "video") { o.dur = Math.max(0, +a.dur || 0); if (a.in != null) o.in = Math.max(0, +a.in || 0); if (a.out != null) o.out = Math.max(0, +a.out || 0); if (!(o.dur > 0.2) && !(o.out > 0.2)) continue; }
    out.push(o);
  }
  if (!out.length) throw bad("give the pictures / videos to edit");
  if (out.length > 120) out.length = 120;
  return out;
}
/** {assets, beats, tempo, total, brief, feel, titles, cards, llm} -> {plan, grid {n, spb, tempo, total, bars}, by: llm|bitGen, notes} */
async function plan(o0) {
  const o = o0 || {}, assets = cleanAssets(o.assets);
  const g = AE.grid({ beats: o.beats, tempo: o.tempo, total: o.total });
  const opts = { brief: clip(o.brief, 2000), feel: AE.FEEL[o.feel] ? o.feel : "promo", titles: o.titles !== false, cards: o.cards !== false, cta: clip(o.cta, 120) };
  const gridOut = { n: g.n, spb: g.spb, tempo: g.tempo, total: g.total, bars: g.bars, offset: g.offset, fromSong: g.fromSong };
  let p = null, by = "bitGen", why = "";
  if (o.llm !== false) {
    const user = [`THE BRIEF: ${opts.brief || "(none - a lively edit of the pictures / videos)"}`,
      `THE FEEL: ${opts.feel} (${opts.feel === "calm" ? "longer shots" : opts.feel === "hype" ? "short, punchy shots" : "a promo pace"})`,
      `THE MUSIC: ${g.fromSong ? `a song at ${g.tempo.toFixed(1)} BPM` : `no song - a steady pace of ${g.tempo.toFixed(0)} beats a minute`}; one beat = ${g.spb.toFixed(3)} s; TOTAL BEATS = ${g.n} (${g.bars} bars of 4, ${g.total.toFixed(1)} s)`,
      `WORDS ON SCREEN: ${opts.titles ? "yes" : "none - leave every text \"\""}; TITLE CARDS: ${opts.titles && opts.cards ? "yes, 2-4" : "none"}`,
      `THE PICTURES / VIDEOS:\n${assetLines(assets)}`, AE.catalogue(), "The JSON:"].join("\n\n");
    try {
      const r = await call({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }], temperature: 0.5, max_tokens: 3000 });
      if (r && r.ok) p = require("./slideAi").parsePlan(r.text);
      if (!p || !Array.isArray(p.shots) || !p.shots.length) { why = r && r.ok ? "the LLM's answer was not a plan" : "the LLM did not answer" + (r && r.error ? ": " + r.error : ""); p = null; }
      else { by = "llm"; if (!opts.titles) p.shots.forEach((s) => { s.text = ""; if (s.card) s.card = false; }); if (!opts.cards) p.shots = p.shots.filter((s) => !s.card); }
    } catch (e) { why = "the LLM did not answer: " + (e.message || e); }
  }
  const raw = p || AE.fallback(assets, g, opts);
  const clean = AE.clean(Object.assign({}, raw, { by }), assets, g, opts);
  if (why) clean.notes.unshift(why + " - bitGen's own plan");
  return { plan: clean, grid: gridOut, by, assets };
}
/** the black base on V1 (⚙ Compile needs a V1 clip; the edit itself is on the layers above): <project>/video/autoedit-black-WxH-Ns.mp4,
 *  made once per size + length (H.264, silent, 24 fps - tiny: black compresses to almost nothing) */
async function base(o0) {
  const o = o0 || {}, W = Math.max(16, Math.min(7680, Math.round(+o.W || 1920) & ~1)), H = Math.max(16, Math.min(4320, Math.round(+o.H || 1080) & ~1));
  const secs = Math.max(1, Math.min(3600, Math.ceil(+o.dur || 0)));
  if (!(+o.dur > 0)) throw bad("give the edit's length");
  const core = require("./core"), fs = require("fs"), path = require("path"), dir = core.pDir("video");
  const name = `autoedit-black-${W}x${H}-${secs}s.mp4`, file = path.join(dir, name);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return { name, dur: secs, made: false };
  fs.mkdirSync(dir, { recursive: true });
  const tmp = file + ".part.mp4";
  const run = (args) => new Promise((ok, no) => { const p = require("child_process").spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] }); let e = ""; p.stderr.on("data", (d) => { e += d; }); p.on("error", no); p.on("close", (c) => (c === 0 ? ok() : no(new Error(e.trim().split("\n").pop() || "ffmpeg failed")))); });
  const src = ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=black:s=${W}x${H}:r=24:d=${secs}`];
  try { await run(src.concat(["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmp])); }
  catch (e) { await run(src.concat(["-c:v", "mpeg4", "-q:v", "5", tmp])); }             // an ffmpeg without x264
  fs.renameSync(tmp, file);
  return { name, dur: secs, made: true };
}
module.exports = { plan, base, cleanAssets, assetLines, setComplete, SYSTEM };

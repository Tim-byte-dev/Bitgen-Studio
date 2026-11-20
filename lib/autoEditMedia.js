// bitGen Studio — lib/autoEditMedia.js (2.895.0): ✨ Auto edit part 2 - the media an edit needs besides the user's own:
//   sfx(kinds)        bitGen's OWN sound effects, synthesized by ffmpeg (no sample library, nothing to licence) into the
//                     project's sound folder as autoedit-sfx-<kind>-<n>.wav, two variants each (so a sound that comes again
//                     takes turns - video-shotcraft sound-design 4.2); made once, then reused. The shapes (static/autoedit.js SFX
//                     has their lengths and where their hit is): whoosh (pink noise swelling to its peak at 80 %), swish (a short
//                     bright one for a whip), impact (a falling low sine + a dark noise thump), hit (a short punch), riser (a
//                     rising sweep + noise, 2 s, ending on its hit), sparkle (four bell tones one after another), tick (a click)
//   white(W, H)       a plain white picture the flash cut flashes (images/autoedit-white-WxH.png)
//   describe(assets)  the vision model looks at each picture and a video's middle frame and says in a line or two what is in it
//                     (lib/captioner.js describe - this computer, a pod or OpenRouter), kept in <project>/cache/autoedit-look.json
//                     by file + size + time, so it is asked once; the LLM plans with it
// Tim (verbatim): "continue with part 2"
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const core = () => require("./core");

/** the lavfi recipes: [the filter graph's inputs, the filter, seconds] - variant v (0 / 1) shifts pitch / colour */
const SFX_RECIPES = {
  whoosh: (v) => [[`anoisesrc=d=0.6:c=pink:a=0.8:r=44100`], `highpass=f=${250 + v * 150},lowpass=f=${v ? 5200 : 3600},afade=t=in:d=0.47:curve=exp,afade=t=out:st=0.48:d=0.12:curve=tri,volume=2.2`, 0.6],
  swish: (v) => [[`anoisesrc=d=0.3:c=white:a=0.7:r=44100`], `highpass=f=${1400 + v * 600},lowpass=f=${v ? 9000 : 7000},afade=t=in:d=0.21:curve=exp,afade=t=out:st=0.22:d=0.08,volume=1.2`, 0.3],
  impact: (v) => [[`aevalsrc='0.9*sin(2*PI*(${v ? 62 : 52})*t*(1-0.35*t))*exp(-5*t)':s=44100:d=0.8`, `anoisesrc=d=0.8:c=brown:a=0.9:r=44100`],
    `[1]lowpass=f=${v ? 900 : 700},afade=t=out:d=0.14:curve=exp[n];[0][n]amix=inputs=2:duration=first:normalize=0,volume=0.85`, 0.8],
  hit: (v) => [[`aevalsrc='0.8*sin(2*PI*${v ? 150 : 120}*t)*exp(-18*t)':s=44100:d=0.25`, `anoisesrc=d=0.25:c=pink:a=0.6:r=44100`],
    `[1]highpass=f=1200,afade=t=out:d=0.05:curve=exp[n];[0][n]amix=inputs=2:duration=first:normalize=0`, 0.25],
  riser: (v) => [[`aevalsrc='0.35*sin(2*PI*(${v ? 240 : 180}*t+${v ? 260 : 220}*t*t))*(t/2)':s=44100:d=2`, `anoisesrc=d=2:c=white:a=0.4:r=44100`],
    `[1]highpass=f=${v ? 2000 : 1500},afade=t=in:d=1.95:curve=exp[n];[0][n]amix=inputs=2:duration=first:normalize=0,afade=t=out:st=1.97:d=0.03`, 2],
  sparkle: (v) => { const f = v ? [2349, 2794, 3520, 4186] : [2093, 2637, 3136, 4186]; return [[`aevalsrc='${f.map((hz, i) => `0.18*sin(2*PI*${hz}*t)*gte(t,${(i * 0.07).toFixed(2)})*exp(-5*(t-${(i * 0.07).toFixed(2)}))`).join("+")}':s=44100:d=1`], `afade=t=out:st=0.85:d=0.15`, 1]; },
  tick: (v) => [[`aevalsrc='0.6*sin(2*PI*${v ? 2200 : 1800}*t)*exp(-90*t)':s=44100:d=0.08`], `anull`, 0.08],
};
const KINDS = Object.keys(SFX_RECIPES);
function run(args) {
  return new Promise((ok, no) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] }); let e = "";
    p.stderr.on("data", (d) => { e += d; }); p.on("error", no);
    p.on("close", (c) => (c === 0 ? ok() : no(new Error(e.trim().split("\n").pop() || "ffmpeg failed"))));
  });
}
/** one effect's ffmpeg arguments (the tests read them) */
function sfxArgs(kind, v, out) {
  const [ins, filter, dur] = SFX_RECIPES[kind](v);
  const a = ["-y", "-loglevel", "error"];
  ins.forEach((i) => a.push("-f", "lavfi", "-i", i));
  if (ins.length > 1) a.push("-filter_complex", filter + "[o]", "-map", "[o]"); else a.push("-af", filter);
  a.push("-t", String(dur), "-ac", "1", "-ar", "44100", out);
  return a;
}
/** the effects asked for (all when none named) -> {kind: [{name, dur}]} - made once into the project's sound folder */
async function sfx(kinds0) {
  const kinds = (Array.isArray(kinds0) && kinds0.length ? kinds0 : KINDS).filter((k) => SFX_RECIPES[k]);
  const dir = core().pDir("sound"), out = {};
  fs.mkdirSync(dir, { recursive: true });
  for (const k of kinds) {
    out[k] = [];
    for (let v = 0; v < 2; v++) {
      const name = `autoedit-sfx-${k}-${v + 1}.wav`, file = path.join(dir, name), dur = SFX_RECIPES[k](v)[2];
      if (!(fs.existsSync(file) && fs.statSync(file).size > 1000)) { const tmp = file + ".part.wav"; await run(sfxArgs(k, v, tmp)); fs.renameSync(tmp, file); }
      out[k].push({ name, dur });
    }
  }
  return out;
}
/** a white picture W x H for the flash cut (images/autoedit-white-WxH.png) */
async function white(W0, H0) {
  const W = Math.max(16, Math.min(7680, Math.round(+W0 || 1920))), H = Math.max(16, Math.min(4320, Math.round(+H0 || 1080)));
  const dir = core().pDir("images"), name = `autoedit-white-${W}x${H}.png`, file = path.join(dir, name);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) { const tmp = file + ".part.png"; await run(["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=white:s=${W}x${H}`, "-frames:v", "1", tmp]); fs.renameSync(tmp, file); }
  return { name, w: W, h: H };
}
/** everything ✔ Build needs made at once: {W, H, dur, sfx, white} -> {base, white, sfx} */
async function media(o0) {
  const o = o0 || {}, out = {};
  out.base = await require("./autoEdit").base(o);
  if (o.white !== false) { try { out.white = await white(o.W, o.H); } catch (e) { out.whiteError = e.message; } }
  if (o.sfx !== false) { try { out.sfx = await sfx(o.kinds); } catch (e) { out.sfxError = e.message; } }
  return out;
}

/* ------------------------------------------------------------------ 👁 the vision model's look */
const LOOK = "In one or two short sentences for a video editor: what is in this picture (the subject, the action, the setting, the mood, close-up or wide)? No preamble.";
let DESCRIBE = null;                                    // tests: setDescribe(async (files) => [text])
function setDescribe(fn) { DESCRIBE = fn || null; }
/** [{name, kind video|picture, src, in, out, dur}] -> {notes: {name: text}, asked, cached, errors} */
async function describe(list0) {
  const list = (Array.isArray(list0) ? list0 : []).slice(0, 40), c = core();
  const cf = path.join(c.projDir(c.getProject()), "cache", "autoedit-look.json");
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(cf, "utf8")) || {}; } catch { cache = {}; }
  const notes = {}, todo = [], errors = [];
  for (const a of list) {
    const name = path.basename(String(a && a.name || "")); if (!name) continue;
    let file = null;
    try {
      if (a.kind === "video") {
        const mid = (+a.in || 0) + Math.max(0, ((a.out != null ? +a.out : +a.dur || 0) - (+a.in || 0)) / 2);
        const T = require("./tlAi"), fr = T.frame({ name, t: mid }); file = T.fileFor(fr.file);
      } else file = path.join(c.pDir("images"), name);
      if (!file || !fs.existsSync(file)) throw new Error("not found");
    } catch (e) { errors.push(name + ": " + e.message); continue; }
    const st = fs.statSync(file), key = crypto.createHash("sha1").update([name, st.size, Math.round(st.mtimeMs), a.kind === "video" ? Math.round((+a.in || 0) * 10) : 0].join("|")).digest("hex").slice(0, 16);
    if (cache[key]) { notes[name] = cache[key]; continue; }
    todo.push({ name, key, path: file, mimetype: "image/png", originalname: name, prompt: LOOK, max_tokens: 120 });
  }
  let asked = 0;
  if (todo.length) {
    try {
      const said = DESCRIBE ? await DESCRIBE(todo) : await require("./captioner").describe(c, todo);
      todo.forEach((t, i) => { const s = String(said[i] || "").replace(/\s+/g, " ").trim().slice(0, 300); if (s && !/returned nothing/.test(s)) { notes[t.name] = s; cache[t.key] = s; asked++; } });
      fs.mkdirSync(path.dirname(cf), { recursive: true }); fs.writeFileSync(cf, JSON.stringify(cache));
    } catch (e) { errors.push("the vision model: " + (e.message || e)); }
  }
  return { notes, asked, cached: Object.keys(notes).length - asked, errors };
}
module.exports = { SFX_RECIPES, KINDS, sfxArgs, sfx, white, media, describe, setDescribe, LOOK };

// bitGen Studio — lib/songTags.js (2.922.0): A SONG FILE -> THE 🎶 SONG TAB (its title, lyrics and details, from its tags).
//
// Tim: "if i load a song into our song tab in audio that was generated with bitgen, can we add the lyrics and details and
// name from the meta tags?"
//
// Where the details come from - the first that has each one wins:
//   bitgen    the JSON bitGen writes into every song since 2.922.0 (scripts/song_tags.py: a "bitgen" tag; a WAV's comment
//             after "bitgen:") - title, lyrics, caption, style, length, seed, format, bpm / key / time signature / language
//   job       the job that made it, while it is still in this session's queue (its params: the same details)
//   graph     ComfyUI's own "prompt" tag - the API graph its SaveAudio writes (every bitGen song before 2.922.0 has it):
//             the lyrics / tags / style on the ACE-Step / YuE2 / Music3 encoders, the length, bpm, key, the sampler's seed
//   record    the render record (projects/<p>/songs/<song>.music, 2.250.0) whose filename is this file: title + lyrics
//   tags      a music player's tags: title, lyrics (USLT / LYRICS / UNSYNCEDLYRICS), genre
//   name      the filename itself: bitGen's <Title>_<YYYYMMDD-HHMMSS>_s<seed>_<job> -> the title and the seed
//   file      the file's own length (seconds) when nothing said the length asked for
// The style is matched to this install's music styles (by id, else by name); a style that is gone is named, not guessed.
//   fromTags(tags), bitgenOf(tags), fromGraph(graph), fromName(name) - pure (scripts/test-922.js)
//   read(abs, {name}) -> {song, from: {field: source}, found: [...sources], file, style_found}
"use strict";
const fs = require("fs");
const path = require("path");

const FIELDS = ["title", "lyrics", "caption", "style_id", "style_name", "dur", "seed", "format", "bpm", "keyscale", "timesig", "language"];
const num = (v) => (v === "" || v == null || !Number.isFinite(+v) ? null : +v);
const str = (v) => (v == null ? "" : String(v));
const lower = (tags) => { const t = {}; for (const [k, v] of Object.entries(tags || {})) t[String(k).toLowerCase()] = str(v); return t; };

/** the details bitGen wrote (its "bitgen" tag, or a WAV's comment after "bitgen:") | null (pure) */
function bitgenOf(tags) {
  const t = lower(tags);
  let raw = t.bitgen || "";
  if (!raw) { const c = t.comment || t.icmt || ""; const i = c.indexOf("bitgen:{"); if (i >= 0) raw = c.slice(i + 7); }
  if (!raw) return null;
  try {
    const j = JSON.parse(raw.trim());
    if (!j || typeof j !== "object") return null;
    const o = {};
    for (const k of FIELDS) if (j[k] !== undefined && j[k] !== null && j[k] !== "") o[k] = j[k];
    if (j.made_at) o.made_at = str(j.made_at);
    return Object.keys(o).length ? o : null;
  } catch { return null; }
}

/** ComfyUI's API graph -> the song's details (pure): ACE-Step (TextEncodeAceStepAudio / 1.5: lyrics, tags, bpm, keyscale,
 *  timesignature, language, duration), YuE2 (lyrics, style), MiniMax Music3 (lyrics, caption, max_duration), the latent's
 *  seconds and the sampler's seed (through a SeedNode / Primitive when it is wired) */
function fromGraph(g) {
  if (typeof g === "string") { try { g = JSON.parse(g); } catch { return null; } }
  if (!g || typeof g !== "object") return null;
  const o = {};
  const lit = (v) => (Array.isArray(v) ? null : v);
  // a seed wired from a SeedNode / Primitive: its literal value
  const follow = (v, d) => {
    if (!Array.isArray(v)) return v;
    const n = g[String(v[0])]; if (!n || !n.inputs || d > 4) return null;
    for (const k of ["seed", "noise_seed", "value", "int"]) if (k in n.inputs) return follow(n.inputs[k], d + 1);
    return null;
  };
  let lyr = "";
  for (const n of Object.values(g)) {
    if (!n || typeof n !== "object" || !n.inputs) continue;
    const c = str(n.class_type), ins = n.inputs;
    const l = lit(ins.lyrics);
    if (typeof l === "string" && l.trim().length > lyr.length) lyr = l.trim();
    if (/AceStep/i.test(c)) {
      if (!o.caption && typeof lit(ins.tags) === "string" && ins.tags.trim()) o.caption = ins.tags.trim();
      if (o.bpm == null && num(lit(ins.bpm)) != null) o.bpm = num(ins.bpm);
      if (!o.keyscale && typeof lit(ins.keyscale) === "string" && ins.keyscale) o.keyscale = ins.keyscale;
      if (!o.timesig && lit(ins.timesignature) != null && ins.timesignature !== "") o.timesig = str(ins.timesignature);
      if (!o.language && typeof lit(ins.language) === "string" && ins.language) o.language = ins.language;
      if (o.dur == null && num(lit(ins.duration)) != null) o.dur = num(ins.duration);
    }
    if (/YuE2/i.test(c) && !o.caption && typeof lit(ins.style) === "string" && ins.style.trim()) o.caption = ins.style.trim();
    if (!o.caption && typeof lit(ins.caption) === "string" && ins.caption.trim()) o.caption = ins.caption.trim();
    if (o.dur == null && num(lit(ins.max_duration)) != null) o.dur = num(ins.max_duration);
    if (o.dur == null && /Latent/i.test(c) && num(lit(ins.seconds)) != null) o.dur = num(ins.seconds);
    if (o.seed == null && /Sampler|Noise|YuE2Generate/i.test(c)) {
      const s = num(follow(ins.seed != null ? ins.seed : ins.noise_seed, 0));
      if (s != null) o.seed = s;
    }
  }
  if (lyr) o.lyrics = lyr;
  return Object.keys(o).length ? o : null;
}

/** a music player's tags -> title / lyrics / genre (pure) - "Made with bitGen Studio" comments are not lyrics */
function fromTags(tags) {
  const t = lower(tags), o = {};
  if (t.title && t.title.trim()) o.title = t.title.trim();
  let lyr = t.lyrics || t.unsyncedlyrics || t.uslt || "";
  if (!lyr) for (const k of Object.keys(t)) if (/^lyrics[-_ ]/.test(k) && t[k].trim()) { lyr = t[k]; break; }
  if (lyr.trim()) o.lyrics = lyr.replace(/\r\n/g, "\n").trim();
  if (t.genre && t.genre.trim()) o.genre = t.genre.trim();
  if (num(t.tbpm || t.bpm) != null) o.bpm = num(t.tbpm || t.bpm);
  return Object.keys(o).length ? o : null;
}

/** bitGen's filename <Title-Lead>_<YYYYMMDD-HHMMSS>_s<seed>_<job>[_n].<ext> -> {title, seed} (pure) */
function fromName(name) {
  const stem = path.basename(str(name)).replace(/\.[^.]+$/, "");
  const m = /^(?:(.+?)_)?\d{8}-\d{6}(?:_s(\d+))?(?:_[A-Za-z0-9-]+)*$/.exec(stem);
  if (!m) return null;
  const o = {};
  if (m[1] && !/^(audio|song|music|ComfyUI)$/i.test(m[1])) o.title = m[1].replace(/[-_]+/g, " ").trim();
  if (m[2]) o.seed = +m[2];
  return Object.keys(o).length ? o : null;
}

function probe(abs) {
  const r = require("child_process").spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:format_tags:stream_tags", "-of", "json", abs],
    { encoding: "utf8", timeout: 20000, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  let j = {}; try { j = JSON.parse(r.stdout || "{}"); } catch { j = {}; }
  return { tags: Object.assign({}, ...((j.streams || []).map((s) => s.tags || {})), (j.format || {}).tags || {}), duration: num((j.format || {}).duration) };
}

/** the job of this session that made `name` -> its details | null */
function fromJob(name) {
  try {
    const core = require("./core");
    for (const id of [...core.order].reverse()) {
      const j = core.jobs.get(id);
      if (!j || j.status !== "done" || !j.params || j.params.mode !== "music") continue;
      const outs = [j.output, ...(j.outputs || [])].filter(Boolean).map((x) => path.basename(String(x)));
      if (!outs.includes(name)) continue;
      const p = j.params, st = p.style || {};
      const o = { title: str(p.title), lyrics: str(p.prompt), caption: str(st.caption), style_id: str(p.style_id), style_name: str(p.style_name),
        dur: num(p.max_duration != null ? p.max_duration : st.max_duration), seed: num(p.seed), format: str(p.audio_format) };
      for (const k of Object.keys(o)) if (o[k] === "" || o[k] == null) delete o[k];
      return Object.keys(o).length ? o : null;
    }
  } catch { /* no queue */ }
  return null;
}

/** the render record (songs/<song>.music) whose filename is `name` | null */
function fromRecord(name) {
  try {
    const core = require("./core");
    const r = require("./songs").listRecords(core.projDir(core.getProject())).find((x) => path.basename(x.filename) === name);
    if (!r) return null;
    const o = {}; if (r.title) o.title = r.title; if (r.lyrics) o.lyrics = r.lyrics;
    return Object.keys(o).length ? o : null;
  } catch { return null; }
}

/** this install's music style for an id / a name -> {id, name} | null */
function matchStyle(id, name) {
  try {
    const core = require("./core"), styles = require("./styles");
    if (id) { const s = styles.byId(core.STYLES_DIR, id); if (s && s.kind === "music") return { id: s.id, name: s.name }; }
    if (name) {
      const want = str(name).trim().toLowerCase();
      const s = styles.read(core.STYLES_DIR).find((x) => x && x.kind === "music" && str(x.name).trim().toLowerCase() === want);
      if (s) return { id: s.id, name: s.name };
    }
  } catch { /* no styles */ }
  return null;
}

/** an audio file -> the Song tab's fields. o.name = the name it had (an upload's own name, for the filename reading) */
function read(abs, o) {
  const name = path.basename(str((o && o.name) || abs));
  const pr = probe(abs);
  const layers = [
    ["bitgen", bitgenOf(pr.tags)],
    ["job", fromJob(name)],
    ["graph", fromGraph(lower(pr.tags).prompt || "")],
    ["record", fromRecord(name)],
    ["tags", fromTags(pr.tags)],
    ["name", fromName(name)],
  ];
  const song = {}, from = {};
  for (const [src, d] of layers) {
    if (!d) continue;
    for (const k of FIELDS) if (song[k] === undefined && d[k] !== undefined && d[k] !== "" && d[k] !== null) { song[k] = d[k]; from[k] = src; }
  }
  if (song.dur === undefined && pr.duration) { song.dur = Math.round(pr.duration); from.dur = "file"; }
  const ext = path.extname(name).toLowerCase().slice(1);
  if (song.format === undefined && ["flac", "mp3", "wav"].includes(ext)) { song.format = ext; from.format = "file"; }
  for (const k of ["dur", "seed", "bpm"]) if (song[k] !== undefined) song[k] = num(song[k]);
  const st = song.style_id || song.style_name ? matchStyle(song.style_id, song.style_name) : null;
  if (st) { song.style_id = st.id; song.style_name = st.name; }
  const found = [...new Set(Object.values(from))];
  const tg = fromTags(pr.tags);
  return { song, from, found, file: name, duration: pr.duration, style_found: !!st, genre: tg && tg.genre ? tg.genre : "",
    bitgen: !!layers[0][1] || !!layers[1][1] || !!layers[2][1] || !!layers[3][1] };
}

module.exports = { FIELDS, bitgenOf, fromGraph, fromTags, fromName, fromJob, fromRecord, matchStyle, read };

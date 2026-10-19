/* bitGen Studio — SAVED SONGS (2.241.0, Tim verbatim: "add a save button to
   the left of the music dockers menu bar, save the song, including lyrics
   and details. add a load button next to the save button to load a song,
   add a new button at the left of the menu bar for a new song").

   A song is the music dock's whole working state — the lyrics (the prompt)
   and the details around them (caption override, style pick, length, count,
   seed, save-as format) — one JSON per song under projects/<p>/songs/, the
   temploras/timelines pattern: the SERVER knows the project
   (core.getProject()), the client never plumbs it. Reads are tolerant (a
   junk file lists as nothing and never breaks the dialog); names are
   sanitized the projDir way so a song can never escape its folder. */
"use strict";

const fs = require("fs");
const path = require("path");

/** The details a song carries — everything else in a posted body is dropped. */
const FIELDS = {
  title: "string",
  lyrics: "string", caption: "string", style_id: "string",
  style_name: "string", format: "string",
  dur: "number", batch: "number", seed: "number",
};

function safeName(name) {
  const n = String(name || "").trim()
    .replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/^\.+/, "").slice(0, 80).trim();
  if (!n) throw new Error("a song needs a name — type one in the Save box");
  return n;
}

function dir(pdir) { return path.join(pdir, "songs"); }
function file(pdir, name) { return path.join(dir(pdir), safeName(name) + ".json"); }

/** Sanitize a posted song down to FIELDS (strings trimmed, numbers finite
 *  or absent) — the file holds exactly what the dock can put back. */
function clean(song) {
  const s = song || {};
  const out = {};
  for (const [k, t] of Object.entries(FIELDS)) {
    if (s[k] === undefined || s[k] === null || s[k] === "") continue;
    if (t === "string") out[k] = String(s[k]);
    else { const n = Number(s[k]); if (Number.isFinite(n)) out[k] = n; }
  }
  return out;
}

function write(pdir, name, song) {
  const n = safeName(name);
  const data = clean(song);
  data.name = n;
  data.saved_at = new Date().toISOString();
  fs.mkdirSync(dir(pdir), { recursive: true });
  fs.writeFileSync(file(pdir, n), JSON.stringify(data, null, 2));
  return { name: n, file: n + ".json" };
}

function read(pdir, name) {
  const p = file(pdir, name);
  if (!fs.existsSync(p)) {
    throw new Error(`no saved song called "${safeName(name)}" in this project`);
  }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const out = clean(j);
  out.name = safeName(j.name || name);
  out.saved_at = String(j.saved_at || "");
  return out;
}

/** Newest first; a broken file is skipped, never fatal. */
function list(pdir) {
  let names = [];
  try { names = fs.readdirSync(dir(pdir)).filter((f) => f.endsWith(".json")); }
  catch { return []; }
  const out = [];
  for (const f of names) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir(pdir), f), "utf8"));
      out.push({ name: f.slice(0, -5), saved_at: String(j.saved_at || ""),
                 lyrics_chars: String(j.lyrics || "").length,
                 style_name: String(j.style_name || ""),
                 title: String(j.title || "") });
    } catch { /* a junk file lists as nothing */ }
  }
  out.sort((a, b) => (b.saved_at || "").localeCompare(a.saved_at || ""));
  return out;
}

/** 2.246.0: the JS mirror of music_worker.title_lead — the lead a titled
 *  song's rendered files start with. The two MUST stay identical: the
 *  worker names with the python one, the play button finds with this one
 *  (the suite cross-checks them live). */
function titleLead(title) {
  const t = String(title || "").trim().split("")
    .map((c) => (/[\p{L}\p{N} \-_]/u.test(c) ? c : "_")).join("");  // \p{L}\p{N} = python isalnum()'s unicode letters+digits
  return t.split(/\s+/).filter(Boolean).join("-").slice(0, 60)
    .replace(/^[-_]+|[-_]+$/g, "");
}

/** 2.246.0 ("put a play button next to each song so user can hear song"):
 *  the NEWEST rendered audio whose filename leads with the song's title
 *  (or its name when untitled) — "" when nothing has been rendered yet.
 *  dirs are core.outputDirs(): every folder a finished job writes into. */
function audioFor(dirs, name, title) {
  const lead = titleLead(title || name).toLowerCase();
  if (!lead) return "";
  // 2.248.0 (Tim: "make the play button play the song"): the match is
  // CASE-INSENSITIVE, prefix first (the worker's own naming), then a
  // contains fallback — a render whose name merely carries the title
  // still plays. Prefix hits outrank contains hits; newest wins within a
  // rank. Nothing matched stays "" — a guessed wrong song is worse than
  // an honest disabled ▶.
  let best = null;
  for (const d of dirs || []) {
    let names = [];
    try { names = fs.readdirSync(d); } catch { continue; }
    for (const f of names) {
      if (!/\.(flac|mp3|wav)$/i.test(f)) continue;
      const lf = f.toLowerCase();
      const rank = lf.startsWith(lead + "_") ? 2 : (lf.includes(lead) ? 1 : 0);
      if (!rank) continue;
      let m = 0;
      try { m = fs.statSync(path.join(d, f)).mtimeMs; } catch { continue; }
      if (!best || rank > best.rank || (rank === best.rank && m > best.m)) {
        best = { f, m, rank };
      }
    }
  }
  return best ? best.f : "";
}

/* ------------------------------------------------------------- 2.250.0
   THE RENDER RECORD (Tim verbatim: "save the filename.ext, song title,
   lyrics, date created, created by in a file <songname>.music ... when the
   play button is pressed, play the filename file"). Written by core the
   moment a music job finishes — the ▶ button plays a RECORDED filename,
   never a guess (the 2.248 scan stays only as a fallback for renders from
   before the record existed). */
function musicFile(pdir, name) { return path.join(dir(pdir), safeName(name) + ".music"); }

function recordRender(pdir, info) {
  const name = safeName((info && (info.title || info.name)) || "untitled");
  const rec = {
    filename: String((info && info.filename) || ""),
    title: String((info && info.title) || name),
    lyrics: String((info && info.lyrics) || ""),
    created_at: new Date().toISOString(),
    created_by: String((info && info.created_by) || "bitGen Studio"),
  };
  if (!rec.filename) return null;           // nothing produced = nothing recorded
  fs.mkdirSync(dir(pdir), { recursive: true });
  fs.writeFileSync(musicFile(pdir, name), JSON.stringify(rec, null, 2));
  return { name, file: name + ".music" };
}

function readRecord(pdir, name) {
  try {
    const j = JSON.parse(fs.readFileSync(musicFile(pdir, name), "utf8"));
    return { filename: String(j.filename || ""), title: String(j.title || ""),
             lyrics: String(j.lyrics || ""), created_at: String(j.created_at || ""),
             created_by: String(j.created_by || "") };
  } catch { return null; }
}

/** Every .music record in the project — for listing renders that were never
 *  saved as songs (they still load: title + lyrics live in the record). */
function listRecords(pdir) {
  let names = [];
  try { names = fs.readdirSync(dir(pdir)).filter((f) => f.endsWith(".music")); }
  catch { return []; }
  const out = [];
  for (const f of names) {
    const r = readRecord(pdir, f.slice(0, -6));
    if (r && r.filename) out.push({ name: f.slice(0, -6), ...r });
  }
  return out;
}

module.exports = { safeName, clean, write, read, list, file, dir, FIELDS,
                   titleLead, audioFor, musicFile, recordRender, readRecord,
                   listRecords };

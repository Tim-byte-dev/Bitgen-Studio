"use strict";
/**
 * bitGen Studio — THE chat transcript store (2.85.0).
 *
 * One conversation with the prompt assistant = one file at
 * `projects/<project>/chat/<YYYY-MM-DD_HHMMSS>.chat`. Same doctrine as styles
 * and reference groups: a file per thing, browsable and hand-editable, rather
 * than one blob that grows forever and cannot be split.
 *
 * THE FORMAT IS JSON LINES, one message per line:
 *
 *     {"t":"2026-08-22T20:33:25.104Z","role":"user","text":"..."}
 *
 * Chosen over a JSON array because appending a message is then a single write
 * that cannot corrupt what is already there: no read-modify-write, no chance of
 * a half-serialised array if the app dies mid-save. A line that will not parse
 * is SKIPPED rather than made fatal — a damaged line must cost you that line,
 * not the whole day's conversation.
 *
 * WHY THE LLM READS TODAY AND YESTERDAY. Tim's ask: "so it knows where we are up
 * to". A session is not the unit of continuity — you close the app, you come
 * back after dinner, the project has not changed. Two calendar days covers "this
 * evening" and "last night" while staying bounded, which matters because every
 * message is re-sent on every turn and a context window is finite. Bounded by
 * MAX_CONTEXT_MESSAGES as well, keeping the most RECENT, because the end of a
 * conversation is where the current idea lives.
 *
 * Nothing here throws. A broken chat folder must not stop anybody rendering.
 */
const fs = require("fs");
const path = require("path");

/** Most recent N messages handed to the LLM as history. */
const MAX_CONTEXT_MESSAGES = 40;
/** Longest single message stored, so one paste cannot swallow the window. */
const MAX_TEXT = 8000;
const EXT = ".chat";

const pad = (n) => String(n).padStart(2, "0");

/** `2026-08-22` in LOCAL time — "today" means the user's today, not UTC's. */
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The filename for a session started at `d`: `<day>_<HHMMSS>.chat`. */
function sessionName(d = new Date()) {
  return `${dayKey(d)}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${EXT}`;
}

/** Every session file in `dir`, oldest first. The name sorts chronologically. */
function sessions(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(EXT)).sort();
  } catch { return []; }
}

/** The day a session file belongs to, from its name. "" if it is not one. */
function dayOf(file) {
  const m = /^(\d{4}-\d{2}-\d{2})_/.exec(path.basename(file));
  return m ? m[1] : "";
}

function msg(role, text) {
  return {
    t: new Date().toISOString(),
    role: role === "assistant" ? "assistant" : "user",
    text: String(text == null ? "" : text).slice(0, MAX_TEXT),
  };
}

/** Append one message. Returns true if it was written. */
function append(dir, file, role, text) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, path.basename(file)),
                      JSON.stringify(msg(role, text)) + "\n", "utf8");
    return true;
  } catch { return false; }
}

/** Every message in one session file, in order. Unparseable lines are skipped. */
function read(dir, file) {
  let raw = "";
  try { raw = fs.readFileSync(path.join(dir, path.basename(file)), "utf8"); }
  catch { return []; }
  const out = [];
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      const m = JSON.parse(s);
      if (m && typeof m.text === "string") {
        out.push({ t: m.t || "", role: m.role === "assistant" ? "assistant" : "user",
                   text: m.text });
      }
    } catch { /* one bad line costs one line */ }
  }
  return out;
}

/**
 * The conversation so far: every message from the last `days` CALENDAR days,
 * oldest first, capped to the most recent `limit`.
 *
 * `now` is injectable so the day arithmetic is testable without waiting for
 * midnight — the one condition under which this code changes behaviour and the
 * one nobody ever reproduces by hand.
 */
/* THE CURRENT SESSION ONLY (2.115.1, Tim: "clear the chat window when user
   clicks new chat"). A New chat starts a fresh file; what the window shows
   and what the model is given are that file's messages, not the day's
   earlier sessions. Older sessions stay on disk under the project's chat/. */
function current(dir, { limit = MAX_CONTEXT_MESSAGES, now = new Date() } = {}) {
  const f = currentSession(dir, now);
  const out = read(dir, f).map((m) => ({ ...m, session: f }));
  return limit > 0 ? out.slice(-limit) : out;
}

function history(dir, { days = 2, limit = MAX_CONTEXT_MESSAGES, now = new Date() } = {}) {
  const wanted = new Set();
  for (let i = 0; i < Math.max(1, days); i += 1) {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() - i);
    wanted.add(dayKey(d));
  }
  const out = [];
  for (const f of sessions(dir)) {
    if (!wanted.has(dayOf(f))) continue;
    for (const m of read(dir, f)) out.push({ ...m, session: f });
  }
  return limit > 0 ? out.slice(-limit) : out;
}

/**
 * The session to append to right now: the newest file from TODAY, or a new one.
 *
 * Continuing today's file rather than opening one per message is what makes the
 * transcript a conversation. A new day starts a new file on its own, because
 * that is the boundary the history window is expressed in.
 */
function currentSession(dir, now = new Date()) {
  const today = dayKey(now);
  const mine = sessions(dir).filter((f) => dayOf(f) === today);
  // NEWEST BY TIME, not by name (2.115.1): a second session opened within the
  // same second is "…-2.chat", which sorts BEFORE "….chat" by name, so New
  // chat used to fall straight back into the old file.
  if (mine.length) {
    const mt = (f) => { try { return fs.statSync(path.join(dir, f)).mtimeMs; } catch { return 0; } };
    const nth = (f) => { const m = f.match(/-(\d+)\.chat$/); return m ? parseInt(m[1], 10) : 1; };   // "-2" is the LATER one
    return mine.slice().sort((a, b) => (mt(a) - mt(b)) || (nth(a) - nth(b)) || a.localeCompare(b))[mine.length - 1];
  }
  const name = sessionName(now);
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(path.join(dir, name))) fs.writeFileSync(path.join(dir, name), "", "utf8");
  } catch { /* append() will try again and report */ }
  return name;
}

/** Start a fresh session even though today already has one ("New chat"). */
function newSession(dir, now = new Date()) {
  let name = sessionName(now);
  try {
    fs.mkdirSync(dir, { recursive: true });
    // Two "New chat" presses inside one second must not share a file.
    for (let n = 2; n < 100 && fs.existsSync(path.join(dir, name)); n += 1)
      name = `${sessionName(now).slice(0, -EXT.length)}-${n}${EXT}`;
    fs.writeFileSync(path.join(dir, name), "", "utf8");
  } catch { /* reported by the first append */ }
  return name;
}

/** Open a conversation AS A FRESH COPY (2.164.0, by instruction: "add a
 *  load chat ... and a save chat"): the source file's lines are copied into
 *  a brand-new session file, which — being today's newest — becomes the
 *  current conversation. The source is never written again: 💾 Save uses
 *  this with no name (freeze the current file, continue in the copy) and
 *  📂 Load uses it with a picked name. Returns { session, from } or null
 *  when the source does not exist / the name is not a chat file. */
function openCopy(dir, name, now = new Date()) {
  try {
    const from = name ? path.basename(String(name)) : currentSession(dir, now);
    if (!from.endsWith(EXT)) return null;
    const src = path.join(dir, from);
    if (!fs.existsSync(src)) return null;
    const session = newSession(dir, now);
    fs.writeFileSync(path.join(dir, session), fs.readFileSync(src, "utf8"), "utf8");
    // the copy must out-mtime its SOURCE (currentSession picks by mtime),
    // but only by milliseconds — a whole-second bump into the future would
    // still be "current" over a genuinely newer session started right after
    let srcMs = 0;
    try { srcMs = fs.statSync(src).mtimeMs; } catch { /* best-effort */ }
    const t = (Math.max(Date.now(), srcMs + 10) + 5) / 1000;
    try { fs.utimesSync(path.join(dir, session), t, t); } catch { /* mtime best-effort */ }
    return { session, from };
  } catch { return null; }
}

/** SAVE AS (2.370.0, Tim: "save the chat as <subject summary> - <date>"): the current conversation is frozen
 *  under `<stem>.chat` (a taken name gets " (2)", " (3)" ...) and the chat continues in a fresh copy, exactly
 *  like 💾 always did - only the archive's NAME changed. A titled file has no date prefix, so it never becomes
 *  "today's current" (currentSession only looks at date-named files). -> {session, saved, from} | null when the
 *  conversation is empty. */
function saveAs(dir, stem, now = new Date()) {
  try {
    const from = currentSession(dir, now);
    if (!read(dir, from).length) return null;
    const base = String(stem || "").trim() || "Chat";
    let saved = base + EXT;
    for (let n = 2; n < 1000 && fs.existsSync(path.join(dir, saved)); n += 1) saved = `${base} (${n})${EXT}`;
    const copy = openCopy(dir, from, now);
    if (!copy) return null;
    fs.renameSync(path.join(dir, from), path.join(dir, saved));
    return { session: copy.session, saved, from };
  } catch { return null; }
}

/** CLEAR (2.370.0, "add a clear chat icon only button"): the current conversation emptied in place - the
 *  window and the model's context start over; saved chats are untouched. -> {session, cleared} */
function clear(dir, now = new Date()) {
  const session = currentSession(dir, now);
  const cleared = read(dir, session).length;
  try { fs.writeFileSync(path.join(dir, session), "", "utf8"); } catch { return { session, cleared: 0, error: true }; }
  return { session, cleared };
}

/** Every chat file, NEWEST FIRST by time (the picker: titled saves and dated sessions mixed). */
function byRecent(dir) {
  const mt = (f) => { try { return fs.statSync(path.join(dir, f)).mtimeMs; } catch { return 0; } };
  return sessions(dir).map((f) => [f, mt(f)]).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).map((x) => x[0]);
}

module.exports = {
  saveAs, clear, byRecent,
  openCopy,
  current,
  MAX_CONTEXT_MESSAGES, MAX_TEXT, EXT,
  dayKey, sessionName, sessions, dayOf, append, read, history,
  currentSession, newSession,
};

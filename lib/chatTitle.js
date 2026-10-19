"use strict";
/**
 * chatTitle.js — A SAVED CHAT IS NAMED BY ITS SUBJECT (2.370.0).
 *
 * Tim: "in prompt chat docker save the chat as <subject summary> - <date>, add a clear chat icon only button next
 * to the dropdown".
 *
 * 💾 Save freezes the current conversation as `<subject summary> - <YYYY-MM-DD>.chat` (lib/chatStore.saveAs).
 * The summary:
 *   llmTitle()   the prompt LLM, when one is ALREADY running (or an external endpoint is set), names the subject
 *                in 2-6 words - never cold-starts a model just for a title; 20 s at most
 *   heuristic()  otherwise (or when the LLM says nothing usable): the first thing the user asked, cut to its
 *                first words at a word boundary, the bracketed notes the app writes into the chat skipped
 * fileStem() makes it a safe Windows / macOS / Linux file name.
 */
const STOP_END = new Set(["a", "an", "the", "of", "and", "or", "to", "in", "on", "with", "for", "at", "by", "from",
                          "into", "about", "as", "is", "are", "was", "be", "my", "our", "your", "this", "that"]);
const MAX_WORDS = 7;
const MAX_CHARS = 48;

const pad = (n) => String(n).padStart(2, "0");
function dateKey(d) { const t = d || new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; }

/** Text with the app's / H3's markup taken out, one line. */
function plain(s) {
  return String(s || "")
    .replace(/<\/?d>/gi, "").replace(/<[^>]{1,40}>/g, "").replace(/\[English\]/gi, "")
    .replace(/[`*_#>"“”‘’]+/g, "").replace(/\s+/g, " ").trim();
}

/** The subject from the conversation itself: the first real user line, its first words. */
function heuristic(messages) {
  const first = (messages || []).find((m) => m && m.role !== "assistant" && plain(m.text) && !/^\s*\[/.test(m.text || ""));
  const src = first || (messages || []).find((m) => m && plain(m.text));
  if (!src) return "Chat";
  // the first clause when it says enough ("a woman walking in rain, close on her face" -> "A woman walking in rain")
  const txt = plain(src.text);
  const clause = txt.split(/[.!?;:,\n]/)[0].trim();
  let words = (clause.split(" ").filter(Boolean).length >= 3 ? clause : txt).split(" ").filter(Boolean)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, "")).filter(Boolean);
  // a polite opener says nothing about the subject
  while (words.length > 2 && /^(please|can|could|would|you|help|me|i|hi|hello|hey|so|ok|okay|let's|lets)$/i.test(words[0])) words.shift();
  words = words.slice(0, MAX_WORDS);
  let out = words.join(" ");
  while (out.length > MAX_CHARS && words.length > 1) { words.pop(); out = words.join(" "); }
  while (words.length > 1 && STOP_END.has(words[words.length - 1].toLowerCase())) { words.pop(); out = words.join(" "); }
  out = out.slice(0, MAX_CHARS).trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "Chat";
}

/** An LLM reply -> a title (first line, no quotes / labels / trailing dot, at most 8 words), or "". */
function cleanTitle(s) {
  let t = String(s || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim().split(/\r?\n/).map((x) => x.trim()).find(Boolean) || "";
  t = t.replace(/^(title|subject|topic)\s*[:\-–]\s*/i, "").replace(/^["'“”‘’*_#\s]+|["'“”‘’*_#.\s]+$/g, "");
  const w = t.split(/\s+/).filter(Boolean);
  if (!w.length || w.length > 10) return "";
  return w.slice(0, 8).join(" ").slice(0, MAX_CHARS).trim();
}

/** A safe file-name stem: no reserved characters, no trailing dots / spaces, not a device name. */
function fileStem(title) {
  let t = String(title || "").replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim()
    .replace(/[. ]+$/g, "").slice(0, 60).trim();
  if (!t || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(t)) t = "Chat";
  return t;
}

/** "<subject summary> - <YYYY-MM-DD>" (the file name without .chat). */
function savedName(title, when) { return `${fileStem(title)} - ${dateKey(when)}`; }

/** Is an LLM up already? (never start one just to name a chat) */
function llmReady(core) {
  try {
    const cfg = core.getConfig() || {};
    if (cfg.llm && cfg.llm.external_url) return true;
    const st = typeof core.llamaState === "function" ? core.llamaState() || {} : {};
    return !!(st.file && st.proc);
  } catch { return false; }
}

/** The LLM's 2-6 word subject, or "" (no LLM up, an error, a slow answer, an unusable reply). */
async function llmTitle(core, messages, opts) {
  if (!llmReady(core)) return "";
  const llmChat = require("./llmChat");
  const convo = (messages || []).slice(0, 12)
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${plain(m.text).slice(0, 400)}`).join("\n");
  if (!convo) return "";
  const ask = llmChat.complete(core, { temperature: 0.2, max_tokens: 24, messages: [
    { role: "system", content: "You name conversations. Reply with ONLY a 2 to 6 word title for the SUBJECT of the "
      + "conversation (what is being made or discussed) - no quotes, no punctuation at the end, nothing else." },
    { role: "user", content: convo }] });
  const timeout = new Promise((ok) => setTimeout(() => ok(null), (opts && opts.timeoutMs) || 20000));
  try {
    const out = await Promise.race([ask, timeout]);
    return out && out.ok ? cleanTitle(out.text) : "";
  } catch { return ""; }
}

/** The title for a conversation: the LLM's when it gives one, else the heuristic. -> {title, how}. */
async function titleFor(core, messages, opts) {
  const t = await llmTitle(core, messages, opts);
  return t ? { title: t, how: "llm" } : { title: heuristic(messages), how: "first words" };
}

module.exports = { MAX_WORDS, MAX_CHARS, dateKey, plain, heuristic, cleanTitle, fileStem, savedName, llmReady,
                   llmTitle, titleFor };

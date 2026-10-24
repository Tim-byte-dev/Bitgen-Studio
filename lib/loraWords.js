/* bitGen Studio — lib/loraWords.js (2.581.0): THE SELECTED LoRAs' KEYWORDS IN WHAT THE LLM WRITES.
 * Tim: "make the llm add the selected loras keywords to the prompt".
 * The selected LoRAs = Basic Settings' LoRA rows for the Generate mode (where the 🧩 Model manager's ✓ picks land) +
 * the Model manager's own picks; the page sends their paths ({loras: [...]}) with ✨ Enhance and with the prompt chat.
 * Their keywords are the 🧩 cards' (yours from ✎, else Civitai's trained words, else the LoRA file's most used tags).
 *   forPaths(paths, cards?)  -> [{path, title, words[]}] - only LoRAs that have keywords; a path the scan does not know
 *                               is matched by its file name (any folder, either slash)
 *   systemNote(list)         -> the rule for the LLM's system prompt ("" with none)
 *   ensure(text, list)       -> {text, added[]} - ✨ Enhance: a keyword the LLM left out is put in anyway (at the end of
 *                               the prompt, comma-separated) - the LoRA only works with it
 * Pure apart from forPaths' default cards (lib/modelCards.list). */
"use strict";

const MAX_WORDS = 5, MAX_LEN = 80, MAX_LORAS = 8;
const norm = (p) => String(p || "").trim().replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
const base = (p) => norm(p).split("/").pop();
const stem = (p) => base(p).replace(/\.(safetensors|ckpt|pt|bin|gguf)$/i, "");

function cleanWords(words) {
  const out = [];
  for (const w of words || []) {
    const t = String(w || "").replace(/\s+/g, " ").trim().replace(/^,+|,+$/g, "").trim();
    if (!t || t.length > MAX_LEN) continue;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

/** the LoRAs behind these paths, with their keywords (pure when `cards` is given: the 🧩 LoRA cards) */
function forPaths(paths, cards) {
  let pool = cards;
  if (!pool) { try { pool = require("./modelCards").list().loras || []; } catch { pool = []; } }
  const out = [], seen = new Set(), cardsSeen = new Set();
  for (const p of (Array.isArray(paths) ? paths : []).slice(0, 32)) {
    const n = norm(p); if (!n || seen.has(n)) continue;
    seen.add(n);
    const c = pool.find((x) => norm(x.name) === n) || pool.find((x) => base(x.name) === base(n)) || pool.find((x) => stem(x.name) === stem(n));
    if (!c || cardsSeen.has(c.name)) continue;          // two paths to one LoRA: once
    cardsSeen.add(c.name);
    const words = cleanWords(c.keywords);
    if (!words.length) continue;
    out.push({ path: String(p), title: String(c.title || stem(c.name)), words });
    if (out.length >= MAX_LORAS) break;
  }
  return out;
}

function systemNote(list) {
  if (!list || !list.length) return "";
  return "\n\nLoRAs IN USE - each only works when its keywords (trigger words) are in the prompt:\n"
    + list.map((l) => `- ${l.title}: ${l.words.join(", ")}`).join("\n")
    + "\nEvery prompt you write must contain each of these keywords exactly as written (same spelling and case, once each, "
    + "early in the prompt, woven into the description or as a short comma list) - do not translate, explain or drop them.";
}

/** the keyword in the text as a whole word / phrase, any case ("art" is not in "lineart") (pure) */
const has = (text, w) => {
  const k = String(w || "").trim(); if (!k) return true;
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp("(^|[^\\p{L}\\p{N}_])" + esc + "($|[^\\p{L}\\p{N}_])", "iu").test(String(text || ""));
};
/** every keyword in the text: the missing ones added at the end (pure) */
function ensure(text, list) {
  const t = String(text || "").replace(/\s+$/, "");
  const added = [];
  for (const l of list || []) for (const w of l.words) if (!has(t, w) && !added.some((a) => a.toLowerCase() === w.toLowerCase())) added.push(w);
  if (!added.length) return { text: t, added };
  const sep = /[.!?,;:]$/.test(t) || !t ? " " : ", ";
  return { text: (t + sep + added.join(", ")).trim(), added };
}

module.exports = { forPaths, systemNote, ensure, cleanWords, MAX_WORDS };

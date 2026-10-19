"use strict";
/* Chat recall (2.169.0, Tim: "the llm sends the scenes to the video docker
 * once, but if i ask a second time in the same session it just produces a
 * prompt not related to the characters. it works again when i restart the
 * app. can we have it do a rag for the current chat so it knows what the
 * conversation is about and acts accordingly").
 *
 * THE BUG THIS KILLS: the chat posted the WHOLE session history every call.
 * Once the history outgrew the model's context window, llama-server truncated
 * the prompt FROM THE TOP — and the first thing to fall off was the system
 * prompt carrying the cast. The model, blind to the characters, wrote
 * unrelated prompts; a restart "fixed" it only because a fresh session is
 * short again.
 *
 * THE SHAPE OF THE FIX: every call sends a conversation REBUILT to fit a hard
 * budget, so llama-side truncation never happens and the system prompt always
 * survives:
 *   - the SEED (the first user message) is always kept — it is what the
 *     conversation is about;
 *   - the most recent turns are always kept verbatim — they are what is being
 *     replied to;
 *   - the middle is RETRIEVED, not replayed: prior turns are scored by word
 *     overlap with the new message (plus a small recency lean) and the best
 *     fit inside the budget, in their original order.
 * Pure functions, no disk, no server state — the routes own the wiring. */

const STOP = new Set([
  "the", "and", "for", "that", "this", "with", "have", "from", "your", "what",
  "about", "into", "then", "them", "they", "were", "will", "would", "could",
  "should", "there", "here", "when", "where", "which", "while", "been", "being",
  "also", "just", "like", "make", "made", "want", "need", "please", "scene",
  "write", "video", "prompt",
]);

/** lowercase content words, 4+ letters, stopworded — the retrieval vocabulary */
function words(text) {
  return new Set(String(text || "").toLowerCase().match(/[a-z0-9@]{4,}/g) || []);
}

/** overlap score of a turn against the query vocabulary */
function score(turnText, queryWords) {
  if (!queryWords.size) return 0;
  const w = words(turnText);
  let hit = 0;
  for (const t of w) if (queryWords.has(t) && !STOP.has(t)) hit++;
  return hit;
}

/**
 * Rebuild a conversation to fit a budget.
 * @param {Array<{role:string,text:string}>} prior  the session, oldest first
 * @param {string} newText   the message being replied to (already appended to
 *                           prior by the caller or not — it is only used as
 *                           the retrieval query here)
 * @param {number} budgetChars  hard cap on the SUM of kept turn texts
 * @param {object} [opts]    { tail: how many recent turns always ride (6) }
 * @returns {Array<{role:string,text:string}>} chronological, within budget
 */
function build(prior, newText, budgetChars, opts) {
  const all = (Array.isArray(prior) ? prior : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant")
                && String(m.text || "").trim());
  const budget = Math.max(1000, budgetChars | 0);
  const tailN = Math.max(1, (opts && opts.tail) || 6);
  if (!all.length) return [];

  // small enough already? send it whole — recall must never LOSE a short chat
  const total = all.reduce((n, m) => n + m.text.length, 0);
  if (total <= budget) return all.slice();

  const keep = new Set();
  const seedIdx = all.findIndex((m) => m.role === "user");
  if (seedIdx >= 0) keep.add(seedIdx);
  for (let i = Math.max(0, all.length - tailN); i < all.length; i++) keep.add(i);

  let used = 0;
  for (const i of keep) used += all[i].text.length;
  // the seed and the tail are non-negotiable; if they alone bust the budget,
  // the tail turns are clipped from the FRONT of their text rather than
  // dropped — the newest words are the ones being replied to
  if (used > budget) {
    const out = [];
    let room = budget;
    const idxs = [...keep].sort((a, b) => a - b);
    // newest first gets the room
    for (let j = idxs.length - 1; j >= 0; j--) {
      const m = all[idxs[j]];
      if (room <= 0) break;
      const t = m.text.length <= room ? m.text : m.text.slice(-room);
      out.unshift({ role: m.role, text: t });
      room -= t.length;
    }
    return out;
  }

  // retrieve the middle: score every unkept turn against the new message,
  // greedy-fill the remaining budget, then restore chronological order
  const q = words(newText);
  const scored = [];
  for (let i = 0; i < all.length; i++) {
    if (keep.has(i)) continue;
    const s = score(all[i].text, q);
    if (s > 0) scored.push({ i, s: s + i / all.length }); // recency lean
  }
  scored.sort((a, b) => b.s - a.s);
  for (const { i } of scored) {
    const len = all[i].text.length;
    if (used + len > budget) continue;
    keep.add(i);
    used += len;
  }
  return [...keep].sort((a, b) => a - b).map((i) => ({ role: all[i].role, text: all[i].text }));
}

/** One always-fresh paragraph of cast facts for the chat's system prompt —
 *  re-sent EVERY call so no amount of history can push the characters out of
 *  the model's sight. Compact on purpose: tags, types, headline facts. */
function castNote(cast, environments) {
  const cs = (cast || []).filter((c) => c && c.name);
  if (!cs.length) return "";
  const line = (c) => {
    const kind = c.type && c.type !== "person" ? ` (${c.subtype || c.type})` : "";
    const facts = [c.breed, c.color, c.model, c.year, c.age && `age ${c.age}`]
      .filter(Boolean).join(", ");
    return `@${c.tag || c.name}${kind}${facts ? ` — ${facts}` : ""}`;
  };
  const envLine = (environments || []).filter((e) => e && e.name)
    .map((e) => `@${e.tag}`).join(", ");
  return "\n\nTHE CAST OF THIS PROJECT (refer to them ONLY by these @tags; "
    + "never invent characters when asked for scenes or prompts):\n"
    + cs.map(line).join("\n")
    + (envLine ? `\nLocations with references: ${envLine}` : "");
}

/** The conversation RECALLED against an ask and flattened to a compact
 *  block another prompt can carry (2.174.0, Tim: "do a rag of the chat to
 *  complete the response"). Same retriever as /api/chat (build), formatted
 *  as "User:"/"Assistant:" lines, hard-capped at budgetChars — the prefix
 *  overhead means the cap is enforced AGAIN after build's own budget. */
function digest(prior, ask, budgetChars) {
  const turns = build(prior, ask, budgetChars);
  const out = [];
  let used = 0;
  for (const t of turns) {
    const line = (t.role === "user" ? "User: " : "Assistant: ")
      + String(t.text || "").replace(/\s+/g, " ").trim();
    if (used + line.length + 1 > budgetChars) break;
    out.push(line); used += line.length + 1;
  }
  return out.join("\n");
}

module.exports = { build, castNote, words, score, digest };

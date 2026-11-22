// bitGen Studio — lib/appVoice.js (2.914.0): 🎙 TALK TO THE 📱 APP - YOUR VOICE, THIS PC'S EARS, THE WORDS DECIDE WHAT HAPPENS.
//
// Tim: "voice chat will be very useful especially if we can add keywords or phrases, like fix this photo or create a video
// or create a song about... or if i say find... it goes to websearch mode. like find cheapest flights to china, or find out
// about... etc". The app records, this PC hears it (lib/asr.js - its own speech to text, nothing sent anywhere else) and:
//   "find … / find out about … / search for … / look up …"     🔎 the web (lib/llmAgent.js with the web tools - the same
//                                                                 search + read as the prompt docker's 🌐, its filters) -> a
//                                                                 short spoken answer + the sources
//   "create / make a video of …"                               🎬 the app fills its prompt and presses Generate (video)
//   "create / make a picture / photo / drawing of …"            🖼 the same, a picture
//   "create / make / write a song about …"                      🎵 ✨ the songwriter writes it, then Generate (music)
//   "fix / restore / repair this photo" ("colourise …")          🩹 the app's picture through an edit style, a restore prompt
//   your own phrases (the app's 🎙 ⚙): "<phrase> = find | video | picture | song | fix photo | chat"
//   anything else                                               💬 a chat with this PC's LLM (the conversation kept)
//   classify(text, custom) - pure (scripts/test-913.js);  handle(core, o) -> {heard, intent, text, reply, sources}
"use strict";

const KINDS = ["find", "video", "image", "song", "fix_photo", "chat"];
const LEAD = /^\s*(?:(?:hey|ok|okay)\s+bitgen[,.!]?\s*)?(?:(?:please|can you|could you|would you|will you|i want you to|i'd like you to|i would like you to)\s+)?/i;
const RULES = [
  { kind: "fix_photo", re: /^(?:fix|restore|repair|clean up|enhance|sharpen|colou?ri[sz]e|recolou?r)\s+(?:this|the|my|that|our)\s+(?:old\s+)?(?:photo|picture|image|pic|photograph)\b[\s,.]*(.*)$/i },
  { kind: "find", re: /^(?:find out(?:\s+about)?|find|search(?:\s+the\s+web)?(?:\s+for)?|look\s+up|google|check\s+online(?:\s+for)?)\b[\s:,]*(.*)$/i },
  { kind: "song", re: /^(?:create|make|write|compose|generate|sing)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+)?(?:new\s+|little\s+|short\s+)?(?:song|tune|track|jingle|music|ballad|rap)\b(?:\s+(?:about|for|of|called|on))?[\s:,]*(.*)$/i },
  { kind: "video", re: /^(?:create|make|generate|render|film|animate|shoot)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+)?(?:new\s+|short\s+)?(?:video|clip|movie|film|animation)\b(?:\s+(?:of|about|with|showing|where|in which))?[\s:,]*(.*)$/i },
  { kind: "image", re: /^(?:create|make|generate|draw|paint|render|design)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+)?(?:new\s+)?(?:picture|image|photo|drawing|painting|portrait|logo|poster|illustration)\b(?:\s+(?:of|about|showing|with))?[\s:,]*(.*)$/i },
];
const KIND_WORDS = { find: "find", search: "find", web: "find", video: "video", clip: "video", picture: "image", image: "image", photo: "image",
  song: "song", music: "song", "fix photo": "fix_photo", fix: "fix_photo", restore: "fix_photo", chat: "chat", talk: "chat" };
/** "phrase = kind" lines -> [{phrase, kind}] (pure; unknown kinds dropped) */
function parsePhrases(lines) {
  const out = [];
  for (const raw of Array.isArray(lines) ? lines : String(lines || "").split(/\r?\n/)) {
    const l = typeof raw === "string" ? raw : (raw && raw.phrase ? raw.phrase + " = " + raw.kind : "");
    const m = /^\s*(.+?)\s*[=:→>-]+\s*([a-z ]+?)\s*$/i.exec(l);
    if (!m) continue;
    const k = KIND_WORDS[m[2].toLowerCase()] || (KINDS.includes(m[2].toLowerCase()) ? m[2].toLowerCase() : "");
    if (k && m[1].length >= 2) out.push({ phrase: m[1].toLowerCase().replace(/[.,!?]+$/, ""), kind: k });
  }
  return out.slice(0, 40);
}
function tidy(t) { return String(t || "").replace(/^[\s,.:;-]+|[\s.!?]+$/g, "").replace(/^please\b[\s,]*|[\s,]*\bplease$/gi, "").trim(); }
/** what was said -> {kind, text (the rest), colour} (pure) */
function classify(text, custom) {
  const said = String(text || "").trim();
  const t = said.replace(LEAD, "");
  for (const c of parsePhrases(custom || [])) {
    if (t.toLowerCase().startsWith(c.phrase)) return { kind: c.kind, text: tidy(t.slice(c.phrase.length)) || said, custom: c.phrase };
  }
  for (const r of RULES) {
    const m = r.re.exec(t);
    if (m) return { kind: r.kind, text: tidy(m[1]), colour: r.kind === "fix_photo" && /colou?r/i.test(t) };
  }
  return { kind: "chat", text: said };
}

const FIND_NOTE = "You answer a question spoken into a phone. Search the web for it, read what you need, then answer in a few short, "
  + "plain sentences that sound right read aloud (no tables, no markdown, no links in the text - the sources are listed separately). "
  + "Give the concrete answer first (a price, a date, a name), then one line of what to check.";
const CHAT_NOTE = "You are bitGen Studio's assistant, talking with the user through the bitGen app on their phone. Answer briefly and "
  + "naturally, as speech (no markdown).";
function strip(t) { try { return require("./llmChat").stripThinking(String(t || "")); } catch { return String(t || ""); } }
/** o = {text, history: [{role, content}], custom, mode: "dictate" | "talk"} -> the answer for the app */
async function handle(core, o) {
  const heard = String(o.text || "").trim();
  if (!heard) return { heard: "", intent: "none", reply: "" };
  if (o.mode === "dictate") return { heard, intent: "dictate" };
  const c = classify(heard, o.custom);
  const hist = (Array.isArray(o.history) ? o.history : []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (c.kind === "find") {
    const q = c.text || heard;
    const out = await require("./llmAgent").run(core, { messages: [{ role: "system", content: FIND_NOTE }].concat(hist, [{ role: "user", content: q }]), web: true, temperature: 0.4, max_tokens: 700 });
    if (!out || out.ok === false) return { heard, intent: "find", text: q, error: (out && out.error) || "the web search did not answer" };
    return { heard, intent: "find", text: q, reply: strip(out.text).trim(), sources: (out.sources || []).slice(0, 6).map((s) => ({ title: s.title, url: s.url })) };
  }
  if (c.kind === "chat") {
    const r = await require("./llmChat").complete(core, { messages: [{ role: "system", content: CHAT_NOTE }].concat(hist, [{ role: "user", content: heard }]), temperature: 0.7, max_tokens: 500 });
    if (!r || r.ok === false) return { heard, intent: "chat", error: (r && r.error) || "the LLM did not answer" };
    return { heard, intent: "chat", reply: strip(r.text).trim() };
  }
  return { heard, intent: c.kind, text: c.text, colour: !!c.colour };   // the app does it (its prompt + Generate)
}
module.exports = { KINDS, RULES, classify, parsePhrases, handle };

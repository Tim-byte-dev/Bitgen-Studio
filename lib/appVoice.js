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
//
// 2.921.0 - Tim: "in the android app when user speaks check keywords, find , search, what is? etc. Let's have a chat, what's?
// will question the llm. add a web button so it searches the internet. act as a personal assistant or just have a chat as a
// friend . speak back to me":
//   "what is / what's / who / when / where / why / how much … / tell me about … / explain …"   ❓ a question for the LLM ("ask")
//   "let's have a chat / let's talk / chat with me / be my friend …"                          🤝 the friend (persona "friend")
//   "be my assistant / assistant mode / let's get to work …"                                   🧑‍💼 the personal assistant
//   o.web (the app's 🌐 button): questions and chats may search the web (the LLM decides when - lib/llmAgent.js's web tools);
//   off = the LLM's own knowledge. "find / search / look up …" always searches (you asked for it).
//   o.persona "assistant" | "friend": how it talks (the result carries the persona, so a spoken switch updates the app).
"use strict";

const KINDS = ["find", "ask", "video", "image", "song", "fix_photo", "chat", "persona", "bye"];
// 2.915.0: the end of a conversation ("bye", "that's all", "stop listening" ...) - the app says goodbye and stops listening
const BYE = /^(?:ok(?:ay)?[, ]+)?(?:bye|goodbye|good bye|stop|stop listening|that'?s all|that is all|thanks?(?: you)?[,.!]? (?:that'?s all|bye)|we'?re done|i'?m done|end(?: the)? conversation|cancel|never ?mind)\b[\s.!]*$/i;
const LEAD = /^\s*(?:(?:hey|ok|okay)\s+bitgen[,.!]?\s*)?(?:(?:please|can you|could you|would you|will you|i want you to|i'd like you to|i would like you to)\s+)?/i;
// 2.921.0: the persona switches ("let's have a chat" = the friend, "be my assistant" = the assistant) and the questions
const FRIEND_RE = /^(?:(?:let'?s|let us|can we|could we|shall we|i (?:just )?(?:want|wanna|would like) to)\s+(?:just\s+)?(?:have\s+a\s+(?:little\s+|quick\s+|good\s+)?)?(?:chat|talk|natter|yarn)|(?:just\s+)?chat\s+with\s+me|talk\s+to\s+me|be\s+my\s+(?:friend|mate|buddy)|friend\s+mode|chat\s+mode)\b(?:\s+(?:for\s+a\s+(?:bit|while|minute)|about))?[\s,.!:]*(.*)$/i;
const ASSIST_RE = /^(?:be\s+my\s+(?:personal\s+)?assistant|act\s+(?:as|like)\s+my\s+(?:personal\s+)?assistant|(?:switch\s+to\s+|go\s+to\s+)?(?:personal\s+)?assistant\s+mode|work\s+mode|let'?s\s+get\s+(?:to\s+work|down\s+to\s+business))\b[\s,.!:]*(.*)$/i;
const ASK_RE = /^(?:what(?:'s|s|\s+is|\s+are|\s+was|\s+were|\s+does|\s+do|\s+did|\s+will|\s+would|\s+can|\s+should)?|who(?:'s|s|\s+is|\s+are|\s+was|\s+were|\s+did)?|whose|where(?:'s|\s+is|\s+are|\s+was|\s+can|\s+do|\s+did)?|when(?:'s|\s+is|\s+are|\s+was|\s+did|\s+does|\s+do|\s+will)?|why|which|how\s+(?:much|many|far|long|old|big|tall|fast|often|hot|cold|do|does|did|can|could|should|would|is|was|to)|tell\s+me\s+(?:about|what|who|how|why|when|where|a\s+joke)|explain|define|is\s+(?:it|there|the|this|that|a|an)|are\s+(?:there|the|they|you\s+sure)|do\s+you\s+know|can\s+you\s+tell\s+me)\b/i;
const RULES = [
  { kind: "fix_photo", re: /^(?:fix|restore|repair|clean up|enhance|sharpen|colou?ri[sz]e|recolou?r)\s+(?:this|the|my|that|our)\s+(?:old\s+)?(?:photo|picture|image|pic|photograph)\b[\s,.]*(.*)$/i },
  { kind: "find", re: /^(?:find out(?:\s+about)?|find|search(?:\s+the\s+web)?(?:\s+for)?|look\s+up|google|check\s+online(?:\s+for)?)\b[\s:,]*(.*)$/i },
  { kind: "song", re: /^(?:create|make|write|compose|generate|sing)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+)?(?:new\s+|little\s+|short\s+)?(?:song|tune|track|jingle|music|ballad|rap)\b(?:\s+(?:about|for|of|called|on))?[\s:,]*(.*)$/i },
  { kind: "video", re: /^(?:create|make|generate|render|film|animate|shoot)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+)?(?:new\s+|short\s+)?(?:video|clip|movie|film|animation)\b(?:\s+(?:of|about|with|showing|where|in which))?[\s:,]*(.*)$/i },
  { kind: "image", re: /^(?:create|make|generate|draw|paint|render|design)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+)?(?:new\s+)?(?:picture|image|photo|drawing|painting|portrait|logo|poster|illustration)\b(?:\s+(?:of|about|showing|with))?[\s:,]*(.*)$/i },
];
const KIND_WORDS = { ask: "ask", question: "ask", find: "find", search: "find", web: "find", video: "video", clip: "video", picture: "image", image: "image", photo: "image",
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
  if (BYE.test(t.trim())) return { kind: "bye", text: "" };
  let m = FRIEND_RE.exec(t);
  if (m) return { kind: "persona", persona: "friend", text: tidy(m[1]) };
  m = ASSIST_RE.exec(t);
  if (m) return { kind: "persona", persona: "assistant", text: tidy(m[1]) };
  for (const r of RULES) {
    m = r.re.exec(t);
    if (m) return { kind: r.kind, text: tidy(m[1]), colour: r.kind === "fix_photo" && /colou?r/i.test(t) };
  }
  if (ASK_RE.test(t)) return { kind: "ask", text: tidy(t) };
  return { kind: "chat", text: said };
}

const FIND_NOTE = "The user asked you to search: search the web for it, read what you need, then answer. "
  + "Give the concrete answer first (a price, a date, a name), then one line of what to check.";
const ASK_NOTE = "The user asked a question: answer it directly in a few short sentences, the answer first.";
const WEB_NOTE = "You can search the web: do it when the answer depends on anything current or that you are not sure of (prices, news, "
  + "weather, opening hours, scores, times), not for small talk.";
const SPEECH = "Your words are read aloud by the phone: plain spoken sentences - no markdown, lists, tables, emoji or links "
  + "(the sources are listed separately).";
const PERSONAS = {
  assistant: "You are the user's personal assistant in the bitGen app on their phone, running on their own PC. Be quick, practical and "
    + "exact: the answer first, then at most one useful next step. Help them plan, decide, work things out and word short messages. Say "
    + "plainly what you cannot do from here (set alarms, send messages, read their calendar or email).",
  friend: "You are chatting with the user as a friend, through the bitGen app on their phone. Be warm, relaxed and curious - short turns, "
    + "now and then a question back, a little humour when it fits, your own take when asked. Be honest that you are an AI on their PC, not "
    + "a person. If they sound low or in trouble, be kind and encourage them to reach the people around them.",
};
/** the system message for a persona (+ the web note when it may search) */
function note(persona, extra, web) {
  let day = ""; try { day = "Today is " + new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + "."; } catch { /* no locale */ }
  return [PERSONAS[persona] || PERSONAS.assistant, day, extra, web ? WEB_NOTE : "", SPEECH].filter(Boolean).join(" ");
}
function strip(t) { try { return require("./llmChat").stripThinking(String(t || "")); } catch { return String(t || ""); } }
/** the LLM's answer: with the web tools (lib/llmAgent.js - it searches when it needs to) or this PC's LLM alone */
async function answer(core, messages, web, max) {
  if (web) {
    const out = await require("./llmAgent").run(core, { messages, web: true, temperature: 0.5, max_tokens: max || 700 });
    if (!out || out.ok === false) return { error: (out && out.error) || "the web search did not answer" };
    return { reply: strip(out.text).trim(), sources: (out.sources || []).slice(0, 6).map((x) => ({ title: x.title, url: x.url })) };
  }
  const r = await require("./llmChat").complete(core, { messages, temperature: 0.7, max_tokens: max || 500 });
  if (!r || r.ok === false) return { error: (r && r.error) || "the LLM did not answer" };
  return { reply: strip(r.text).trim() };
}
/** o = {text, history: [{role, content}], custom, mode: "dictate" | "talk", web, persona} -> the answer for the app */
async function handle(core, o) {
  const heard = String(o.text || "").trim();
  if (!heard) return { heard: "", intent: "none", reply: "" };
  if (o.mode === "dictate") return { heard, intent: "dictate" };
  const c = classify(heard, o.custom);
  let persona = o.persona === "friend" ? "friend" : "assistant";
  const web = o.web === true || o.web === "1" || o.web === "true";
  if (c.kind === "bye") return { heard, intent: "bye", persona };
  const hist = (Array.isArray(o.history) ? o.history : []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const said = (extra, q, useWeb) => [{ role: "system", content: note(persona, extra, useWeb) }].concat(hist, [{ role: "user", content: q }]);
  if (c.kind === "find") {                                              // you asked for a search: always the web
    const q = c.text || heard;
    const a = await answer(core, said(FIND_NOTE, q, true), true);
    return Object.assign({ heard, intent: "find", text: q, persona, web: true }, a);
  }
  if (c.kind === "persona") {                                           // "let's have a chat" / "be my assistant"
    persona = c.persona;
    const hello = persona === "friend" ? "They just asked to have a chat - say hi like a friend would and get the conversation going (or answer what they said)."
      : "They just asked for their personal assistant - say you are ready in one short sentence (or help with what they said).";
    const a = await answer(core, said(hello, heard, web && !!c.text), web && !!c.text, 300);
    return Object.assign({ heard, intent: "persona", persona, web }, a);
  }
  if (c.kind === "ask" || c.kind === "chat") {
    const a = await answer(core, said(c.kind === "ask" ? ASK_NOTE : "", heard, web), web);
    return Object.assign({ heard, intent: c.kind, persona, web }, a);
  }
  return { heard, intent: c.kind, text: c.text, colour: !!c.colour, persona };   // the app does it (its prompt + Generate)
}
module.exports = { BYE, KINDS, RULES, ASK_RE, FRIEND_RE, ASSIST_RE, PERSONAS, classify, parsePhrases, note, handle };

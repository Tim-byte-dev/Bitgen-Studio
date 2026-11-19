// lib/webAi.js — 2.865.0 ✨ the Web editor's AI prompt docker (Tim: "add prompt input docker inside web builder to edit via ai. user can
// type or speak"). The open file (or only the selected part of it) + what the user asked -> the LLM -> the whole edited text back, which
// the docker puts into the editor as ONE change (✔ Keep / ↶ Undo - nothing is saved until 💾 Save).
//   edit({path, text, ask, a, b})  a < b = only text.slice(a, b) is sent and replaced; else the whole file (up to 120 000 characters)
//   -> {text (the whole file after the change), part (the new part), a, b, kind, added, removed}
// The LLM is told the site's files (names only) so it points at real pictures / pages, and to answer with the whole text in ONE code block.
"use strict";
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
let completeFn = null;
function setComplete(f) { completeFn = f; }   // tests
const MAX = 120000;
const KIND = (p) => /\.css$/i.test(p) ? "css" : /\.m?js$/i.test(p) ? "javascript" : /\.php$/i.test(p) ? "php" : /\.json$/i.test(p) ? "json" : /\.svg$/i.test(p) ? "svg" : "html";
const RULES = (kind, part) => `You edit one ${kind.toUpperCase()} file of a website made with bitGen Studio. Do exactly what the user asks and nothing else: keep every
other line as it is (same order, same spacing). ${part ? "You are given ONLY A PART of the file - answer with that part, changed." : "Answer with the WHOLE file, changed."}
Real, specific words for the business - no lorem ipsum. Pictures are in images/ (use the names listed when they fit), pages are .html / .php files in the
site's folder. Keep the site's own classes and the bg-* classes of its skills. Answer with the text only, in ONE \`\`\`${kind} code block - no explanation.`;
/** a line diff count (added / removed lines) - for the docker's "+3 −1" */
function countDiff(a, b) {
  const A = String(a).split("\n"), B = String(b).split("\n"), have = new Map();
  for (const l of A) have.set(l, (have.get(l) || 0) + 1);
  let same = 0; for (const l of B) { const n = have.get(l) || 0; if (n) { have.set(l, n - 1); same++; } }
  return { added: B.length - same, removed: A.length - same };
}
function pick(text, kind) {
  const blocks = [...String(text || "").matchAll(/```[\w-]*\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (blocks.length) return blocks.sort((x, y) => y.length - x.length)[0].replace(/\n$/, "");
  const t = String(text || "").trim();   // no code block: only an answer that looks like code (a page starts with <, CSS / JS have { or ;)
  if (kind === "html" || kind === "svg" || kind === "php") return /^</.test(t) ? t : "";
  return /[{};]/.test(t) && !/^(sorry|i |i'm|here)/i.test(t) ? t : "";
}
async function edit(o) {
  const a0 = o || {}, ask = String(a0.ask || "").trim(), text = String(a0.text == null ? "" : a0.text), path = String(a0.path || "index.html");
  if (!ask) throw bad("say what to change");
  const a = Math.max(0, Math.min(text.length, parseInt(a0.a, 10) || 0)), b = Math.max(a, Math.min(text.length, parseInt(a0.b, 10) || 0)), part = b > a;
  const src = part ? text.slice(a, b) : text;
  if (src.length > MAX) throw bad("the file is too long to send whole - select the part to change first", 413);
  const kind = KIND(path);
  let files = []; try { files = require("./webProject").tree().files.filter((f) => !f.dir).map((f) => f.path).slice(0, 300); } catch (e) { /* no www */ }
  const llm = completeFn || ((x) => require("./llmChat").complete(require("./core"), x));
  const user = `File: ${path}${part ? ` (the selected part, characters ${a}-${b})` : ""}\nThe site's files: ${files.join(", ") || "(none listed)"}\n\nWhat to do: ${ask.slice(0, 4000)}\n\n\`\`\`${kind}\n${src}\n\`\`\``;
  const r = await llm({ messages: [{ role: "system", content: RULES(kind, part) }, { role: "user", content: user }], temperature: 0.3, max_tokens: Math.min(32000, Math.ceil(src.length / 2.5) + 2500) });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  const out = pick(r.text, kind);
  if (!out.trim() && src.trim()) throw bad("the LLM's answer had no code in it - ask again, or say it more plainly", 502);
  if (!part && kind === "html" && /<html[\s>]/i.test(src) && !/<html[\s>]/i.test(out)) throw bad("the LLM sent back only part of the page - select the part to change and ask again", 502);
  const whole = part ? text.slice(0, a) + out + text.slice(b) : out;
  return Object.assign({ text: whole, part: out, a, b: a + out.length, kind }, countDiff(src, out));
}
module.exports = { edit, setComplete, countDiff, pick, KIND, MAX };

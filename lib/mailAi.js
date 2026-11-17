// bitGen Studio — lib/mailAi.js (2.818.0): ✉ MAIL - THE USER'S OWN LLM READS, FLAGS AND WRITES.
//
// Every call goes through lib/llmChat.complete (the prompt docker's LLM: llama-server here, the external endpoint, or the
// 🖥 GPU docker's OpenRouter / pod LLM) - mail text leaves this computer only when the user has put the LLM elsewhere.
//
//   flag(acc, folder, {uids, redo})    each message rated 0-3 with a short reason, kept in the index (m.ai)
//                                      3 urgent · 2 important · 1 normal · 0 low (newsletters, offers, automated)
//   summary(acc, folder, uid)          2 sentences + "Action: …" (kept in the body file)
//   reply(acc, folder, uid, {ask, tone, all})   the reply's body, in the user's voice
//   write({notes, to, subject, tone, name, sig})  a new email from notes -> {subject, body}
//   rewrite({text, how, name})         the user's own draft rewritten (shorter, friendlier, more formal, fix spelling …)
//   pure: plainOf(body), excerpt(head, body, n), flagPrompt(items, important, me), parseFlags(text, n), parseSummary(t),
//         parseWrite(t), cleanBody(t), TONES
// The LLM is swappable for tests: setComplete(fn) - fn({messages, temperature, max_tokens}) -> {ok, text, error}.
"use strict";
const MS = require("./mailStore");

const TONES = { friendly: "friendly and natural", professional: "professional and clear", formal: "formal and polite", brief: "brief - as few words as will do", warm: "warm and personal", apologetic: "apologetic and constructive", firm: "firm but polite" };
const toneOf = (t) => TONES[t] || TONES.friendly;

let completeFn = null;
function setComplete(fn) { completeFn = fn; }
async function ask(messages, opts) {
  const o = Object.assign({ messages, temperature: 0.4, max_tokens: 900 }, opts || {});
  const r = completeFn ? await completeFn(o) : await require("./llmChat").complete(require("./core"), o);
  if (!r || !r.ok) { const e = new Error("the LLM did not answer: " + ((r && r.error) || "no reply")); e.status = (r && r.status) || 502; throw e; }
  const strip = require("./llmChat").stripThinking;
  return String(strip ? strip(r.text || "") : (r.text || "")).trim();
}

/** an email's words without its markup (the html when there is no plain text) */
function plainOf(b) {
  const o = b || {};
  let t = String(o.text || "").trim();
  if (!t && o.html) {
    t = String(o.html).replace(/<(style|head)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  // the quoted history under a reply says nothing new
  t = t.split("\n").filter((l) => !/^\s*>/.test(l)).join("\n");
  const cut = t.search(/\n\s*(On .{6,120} wrote:|-{2,} ?Original Message ?-{2,}|-{5,} Forwarded message)/i);
  if (cut > 0) t = t.slice(0, cut);
  return t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
const who = (a) => (a ? (a.name ? `${a.name} <${a.address}>` : a.address || "") : "");
/** the header lines + the start of the text, at most n characters */
function excerpt(head, body, n) {
  const h = head || {}, b = body || {};
  const lines = [`From: ${who(b.from || h.from)}`, `Subject: ${b.subject || h.subject || "(no subject)"}`, `Date: ${b.date || h.date || ""}`];
  const to = (b.to || h.to || []).map(who).filter(Boolean);
  if (to.length) lines.push(`To: ${to.slice(0, 5).join(", ")}${to.length > 5 ? " …" : ""}`);
  if (b.attachments && b.attachments.length) lines.push(`Attachments: ${b.attachments.map((a) => a.name).slice(0, 6).join(", ")}`);
  const t = plainOf(b), max = n || 1200;
  return lines.join("\n") + "\n\n" + (t.length > max ? t.slice(0, max) + " …" : t);
}

const LEVELS = ["low", "normal", "important", "urgent"];
function flagPrompt(items, important, me) {
  const sys = "You sort a person's incoming email by how much it needs their attention. Rate every email with one level:\n"
    + "3 = urgent: needs their action soon - a deadline, a payment due, a person waiting for an answer, a real account or security problem\n"
    + "2 = important: a real person writing to them personally, their work or business, appointments, bills and orders that need checking\n"
    + "1 = normal: worth a look but no action - receipts, confirmations, updates from services they use\n"
    + "0 = low: newsletters, offers and promotions, automated notices, mass mailings\n"
    + "Judge by what the email asks of the reader, not by how loudly it shouts. Marketing that claims urgency is still 0."
    + (me ? `\nThe reader is ${me}.` : "")
    + (String(important || "").trim() ? `\nWhat matters most to the reader (rate these higher): ${String(important).trim()}` : "")
    + "\nAnswer with exactly one line per email and nothing else, in this form:\n<email number> | <level 0-3> | <the reason, at most 12 words>";
  const user = items.map((it, i) => `=== Email ${i + 1} ===\n${it}`).join("\n\n") + `\n\nRate all ${items.length} emails, one line each.`;
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}
/** "2 | 3 | invoice due Friday" lines -> [{n, level, why}] (numbers 1..n; anything else ignored) */
function parseFlags(text, n) {
  const out = {};
  for (const raw of String(text || "").split(/\r?\n/)) {
    const l = raw.replace(/\*\*/g, "").trim();
    const m = /^(?:email\s*)?#?\[?(\d{1,3})\]?\s*[|:.)\-–]\s*(?:level\s*)?([0-3])\b\s*[|:\-–]?\s*(.*)$/i.exec(l);
    if (!m) continue;
    const i = parseInt(m[1], 10);
    if (i >= 1 && i <= (n || 999) && !out[i]) out[i] = { n: i, level: parseInt(m[2], 10), why: m[3].replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 140) };
  }
  return Object.values(out);
}

function parseSummary(t) {
  const s = String(t || "").trim();
  const m = /\n?\s*\**\s*action\s*\**\s*[:\-–]\s*\**\s*(.+)$/im.exec(s);
  const summary = (m ? s.slice(0, m.index) : s).replace(/^\s*\**\s*summary\s*\**\s*[:\-–]\s*\**\s*/i, "").replace(/\*\*/g, "").trim();
  const action = m ? m[1].replace(/\*\*/g, "").trim().replace(/^none\.?$/i, "") : "";
  return { summary: summary.slice(0, 600), action: action.slice(0, 300) };
}
/** the model's email body cleaned: no "Subject:" line, no wrapping quotes / code fences, no "Here is your reply:" */
function cleanBody(t) {
  let s = String(t || "").replace(/^```[a-z]*\n?|```\s*$/gim, "").trim();
  s = s.replace(/^(sure|certainly|of course|here(?:'s| is)[^\n]{0,60}):?\s*\n+/i, "");
  s = s.replace(/^\s*subject\s*:[^\n]*\n+/i, "");
  if (/^".*"$/s.test(s)) s = s.slice(1, -1);
  return s.trim();
}
function parseWrite(t) {
  const s = String(t || "").replace(/^```[a-z]*\n?|```\s*$/gim, "").trim();
  const m = /^\s*\**subject\**\s*:\s*(.+)$/im.exec(s);
  const subject = m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  const body = cleanBody(m ? s.slice(0, m.index) + s.slice(m.index + m[0].length) : s);
  return { subject: subject.slice(0, 200), body };
}
const meOf = (acc) => (acc ? (acc.name && acc.name !== acc.email ? `${acc.name} (${acc.email})` : acc.email) : "");

async function flag(acc, folder, o) {
  const box = folder || "INBOX", opts = o || {};
  const ix = MS.index(acc.id, box);
  let msgs = ix.msgs || [];
  if (Array.isArray(opts.uids) && opts.uids.length) { const U = new Set(opts.uids.map(Number)); msgs = msgs.filter((m) => U.has(m.uid)); }
  else msgs = msgs.filter((m) => opts.redo || !m.ai).slice(0, Math.max(1, Math.min(100, parseInt(opts.max, 10) || 40)));
  const imap = require("./mailImap"), important = MS.settings().important, me = meOf(acc);
  const done = [], failed = [];
  const SIZE = Math.max(1, Math.min(10, parseInt(process.env.H3_MAIL_FLAG_BATCH, 10) || 6));
  for (let i = 0; i < msgs.length; i += SIZE) {
    const part = msgs.slice(i, i + SIZE), items = [];
    for (const m of part) {
      let b = null; try { b = await imap.message(acc, box, m.uid); } catch (e) { b = null; }
      items.push(excerpt(m, b, 700));
    }
    let got = [];
    try { got = parseFlags(await ask(flagPrompt(items, important, me), { max_tokens: 60 + 40 * part.length, temperature: 0.1 }), part.length); }
    catch (e) { if (!done.length && i === 0) throw e; failed.push(...part.map((m) => m.uid)); continue; }
    const at = new Date().toISOString();
    part.forEach((m, k) => {
      const g = got.find((x) => x.n === k + 1);
      if (!g) { failed.push(m.uid); return; }
      const ai = { level: g.level, why: g.why, at };
      MS.patchMsg(acc.id, box, m.uid, (x) => { x.ai = ai; });
      done.push({ uid: m.uid, level: g.level, why: g.why });
    });
  }
  return { flagged: done.length, results: done, failed, levels: LEVELS };
}

async function summary(acc, folder, uid) {
  const box = folder || "INBOX";
  const b = await require("./mailImap").message(acc, box, uid);
  const t = await ask([
    { role: "system", content: "You summarise emails for a busy person. Write at most two short sentences saying what the email is about and anything important in it (dates, amounts, names). Then a new line: Action: <what the reader needs to do, or none>." },
    { role: "user", content: excerpt(null, b, 6000) },
  ], { max_tokens: 220, temperature: 0.2 });
  const s = parseSummary(t);
  b.ai_summary = Object.assign(s, { at: new Date().toISOString() });
  MS.setBody(acc.id, box, uid, b);
  return b.ai_summary;
}

async function reply(acc, folder, uid, o) {
  const box = folder || "INBOX", opts = o || {};
  const b = await require("./mailImap").message(acc, box, uid);
  const me = meOf(acc);
  const sys = `You write email replies for ${me || "the user"}, in their voice. Write ONLY the body of the reply: a greeting, the reply, a sign-off`
    + `${acc && acc.name && acc.name !== acc.email ? " with the name " + acc.name.split(/\s+/)[0] : ""}. No subject line, no quoted original, no notes about the reply.`
    + ` Tone: ${toneOf(opts.tone)}. Answer what the email asks; keep facts you do not know as short questions or a [bracketed] gap the writer fills in - never invent dates, prices or promises.`
    + (opts.all ? " The reply goes to everyone on the email." : "");
  const user = "The email to reply to:\n\n" + excerpt(null, b, 6000) + "\n\n"
    + (String(opts.ask || "").trim() ? `What the reply should say: ${String(opts.ask).trim()}` : "Write a suitable reply.");
  const t = cleanBody(await ask([{ role: "system", content: sys }, { role: "user", content: user }], { max_tokens: 700, temperature: 0.6 }));
  if (!t) throw MS.bad("the LLM's reply was empty - try again or say what the reply should say", 502);
  return { body: t };
}

async function write(o) {
  const opts = o || {};
  const notes = String(opts.notes || "").trim();
  if (!notes) throw MS.bad("say what the email is about (a few words or notes are enough)");
  const sys = `You write emails for ${opts.name || "the user"}. From their notes write a complete email: first a line "Subject: <a short subject>", then a blank line, then the body - a greeting, the message, a sign-off${opts.name ? " with the name " + String(opts.name).split(/\s+/)[0] : ""}.`
    + ` Tone: ${toneOf(opts.tone)}. Use only the facts in the notes; leave a [bracketed] gap for anything missing. Nothing else - no notes about the email.`;
  const user = (opts.to ? `To: ${opts.to}\n` : "") + (opts.subject ? `Subject they had in mind: ${opts.subject}\n` : "") + `Their notes:\n${notes}`;
  const r = parseWrite(await ask([{ role: "system", content: sys }, { role: "user", content: user }], { max_tokens: 800, temperature: 0.6 }));
  if (!r.body) throw MS.bad("the LLM's email was empty - try again with a little more in the notes", 502);
  if (!r.subject && opts.subject) r.subject = String(opts.subject);
  return r;
}

async function rewrite(o) {
  const opts = o || {};
  const text = String(opts.text || "").trim();
  if (!text) throw MS.bad("there is nothing written to rewrite yet");
  const how = String(opts.how || "").trim() || "clearer and better written";
  const sys = `You improve emails ${opts.name ? "for " + opts.name : ""}. Rewrite the email you are given: ${how}. Keep its meaning, facts, names and any [bracketed] gaps. Answer with the rewritten body only.`;
  const t = cleanBody(await ask([{ role: "system", content: sys }, { role: "user", content: text }], { max_tokens: Math.min(2000, 200 + Math.ceil(text.length / 2)), temperature: 0.5 }));
  if (!t) throw MS.bad("the LLM's rewrite was empty - try again", 502);
  return { body: t };
}

module.exports = { TONES, LEVELS, setComplete, plainOf, excerpt, flagPrompt, parseFlags, parseSummary, parseWrite, cleanBody, flag, summary, reply, write, rewrite };

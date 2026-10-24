// bitGen Studio — lib/llmArena.js (2.584.0): 🔁 COMPARE LLMs - one prompt answered by each LLM in turn, the user picks
// the reply they like, and every round is kept so the app knows which LLM is best for which job.
//
// Tim: "add a button in the promptdocker top menubar to cycle through llms - let each llm send a response in chat and
// user chooses the one he likes - record the llm , the request and the response - this can keep track of the best llm
// for the job".
//
//   A ROUND (<app>/llm_arena/rounds/<id>.json - every project's rounds in one place, the app's own memory of the LLMs):
//     {id, t, project, kind, gen_mode, request, llms: [planned files], candidates: [{n, llm, reply, secs, error, song}],
//      chosen: null (not picked yet) | -1 (none of them) | n, picked_at}
//   start(core, {text, gen_mode, llms})  -> the round       (routes/llmArena.js POST /api/llmarena/start)
//   addCandidate(core, arena, cand)      one LLM's reply     (routes/index.js /api/chat with an `arena` field)
//   pick(core, id, n)                    the user's choice: the reply goes into the chat as THE answer
//   stats(core) / rounds(core, opts) / remove(core, id) / clear(core) / csv(core) / checkServed(core, file)
// Pure (scripts/test-llmarena584.js): kindOf(text, genMode), parseArena(v), score(rounds), llmName(file), csvRow(cells);
// 2.585.0 (scripts/test-ftpref585.js): trainingSet(rounds, opts), promptOf(round), tokensOf(chars) - setPrompt (the full
// prompt with each round), toTrainer (⤒ the 🎓 trainer's LLM job: chat.jsonl winners + prefs.jsonl pairs).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KINDS = ["screenplay", "music video", "song", "image prompt", "video prompt", "chat"];

/* ------------------------------------------------------------------ pure */
/** what job a request is (pure) - the same words the prompt docker's toolbar puts in (🎬 🖼 📹 🎵 🎤) */
function kindOf(text, genMode) {
  const t = String(text || "");
  if (/\bscr?eenplay\b/i.test(t)) return "screenplay";
  if (/\bmusic[\s-]?video\b/i.test(t)) return "music video";
  if (/\b(?:create|make|write)\b[^.!?\n]{0,60}?\bsongs?\b/i.test(t) || /\blyrics\b/i.test(t)) return "song";
  if (/\b(?:image|picture|photo|still)\s+prompt\b/i.test(t) || (genMode === "image" && /\bprompt\b/i.test(t))) return "image prompt";
  if (/\b(?:video|shot|scene)\s+prompt\b/i.test(t) || (genMode === "video" && /\bprompt\b/i.test(t))) return "video prompt";
  return "chat";
}
/** the `arena` field of a chat call -> {id, n} | null (pure) */
function parseArena(v) {
  let a = v;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { return null; } }
  if (!a || typeof a !== "object") return null;
  const id = String(a.id || "");
  const n = Number(a.n);
  if (!/^[a-z0-9]{6,32}$/.test(id) || !Number.isInteger(n) || n < 0 || n > 63) return null;
  return { id, n };
}
/** a .gguf file -> the name people read (pure) */
function llmName(file) { return String(file || "").replace(/\.gguf$/i, ""); }
/** the scores per job (pure): only rounds where a choice was made count; a reply that failed does not take part */
function score(rounds) {
  const by = new Map();
  const slot = (kind) => { if (!by.has(kind)) by.set(kind, { kind, rounds: 0, none: 0, llms: new Map() }); return by.get(kind); };
  const row = (k, llm) => { if (!k.llms.has(llm)) k.llms.set(llm, { llm, name: llmName(llm), entered: 0, wins: 0, secs: 0, answered: 0, errors: 0 }); return k.llms.get(llm); };
  for (const r of rounds || []) {
    if (r.chosen == null) continue;                      // not decided yet
    for (const kind of [r.kind || "chat", "all"]) {
      const k = slot(kind);
      k.rounds++;
      if (r.chosen === -1) k.none++;
      for (const c of r.candidates || []) {
        const x = row(k, c.llm);
        if (c.error) { x.errors++; continue; }
        x.entered++; x.answered++; x.secs += +c.secs || 0;
        if (c.n === r.chosen) x.wins++;
      }
    }
  }
  const order = (a, b) => (b.wins - a.wins) || (b.rate - a.rate) || (b.entered - a.entered) || (a.avg_secs - b.avg_secs) || a.name.localeCompare(b.name);   // an LLM that only failed goes last
  const out = [...by.values()].map((k) => {
    const llms = [...k.llms.values()].map((x) => ({ llm: x.llm, name: x.name, entered: x.entered, wins: x.wins, errors: x.errors,
      rate: x.entered ? Math.round((x.wins / x.entered) * 100) : 0, avg_secs: x.answered ? Math.round((x.secs / x.answered) * 10) / 10 : 0 })).sort(order);
    return { kind: k.kind, rounds: k.rounds, none: k.none, llms, best: llms[0] && llms[0].wins > 0 ? llms[0].llm : "" };
  });
  return out.sort((a, b) => (a.kind === "all") - (b.kind === "all") || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
}
/** 2.585.0 - THE TRAINING SET from the decided rounds (pure): Tim (on "can we use this to train a gguf llm?" -> "go with
 *  your suggestions"). Each round's input is the FULL prompt the LLMs got (round.prompt: bitGen's instructions + the
 *  conversation so far + the request - saved since 2.585.0; an older round has only the request).
 *    chats  {messages: prompt + the picked reply}                        -> SFT (the answers you want)
 *    prefs  {prompt, chosen: the picked reply, rejected: one not picked}  -> DPO / ORPO (one per reply not picked)
 *  opts {kind ("all" / a job), include_system (true)} -> {chats, prefs, rounds, with_prompt, without_prompt, longest_chars} */
function promptOf(r, includeSystem) {
  let m = Array.isArray(r.prompt) && r.prompt.length ? r.prompt : [{ role: "user", content: r.request }];
  m = m.filter((x) => x && ["system", "user", "assistant"].includes(x.role) && String(x.content || "").trim()).map((x) => ({ role: x.role, content: String(x.content) }));
  if (!includeSystem) m = m.filter((x) => x.role !== "system");
  const out = [];                                           // same roles in a row = one turn (what the model was sent)
  for (const x of m) { const last = out[out.length - 1]; if (last && last.role === x.role) last.content += "\n\n" + x.content; else out.push(x); }
  while (out.length && out[out.length - 1].role !== "user") out.pop();
  return out;
}
function trainingSet(rounds, opts) {
  const o = opts || {};
  const inc = o.include_system !== false && o.include_system !== "0";
  const res = { chats: [], prefs: [], rounds: 0, with_prompt: 0, without_prompt: 0, longest_chars: 0 };
  for (const r of rounds || []) {
    if (r.chosen == null || r.chosen < 0) continue;
    if (o.kind && o.kind !== "all" && r.kind !== o.kind) continue;
    const win = (r.candidates || []).find((c) => c.n === r.chosen && !c.error && String(c.reply || "").trim());
    if (!win) continue;
    const p = promptOf(r, inc);
    if (!p.length) continue;
    res.rounds++;
    if (Array.isArray(r.prompt) && r.prompt.length) res.with_prompt++; else res.without_prompt++;
    res.chats.push({ messages: p.concat([{ role: "assistant", content: String(win.reply) }]) });
    const pc = p.reduce((a, x) => a + x.content.length, 0);
    for (const c of r.candidates || []) {
      if (c.n === r.chosen || c.error || !String(c.reply || "").trim() || String(c.reply).trim() === String(win.reply).trim()) continue;
      res.prefs.push({ prompt: p, chosen: String(win.reply), rejected: String(c.reply) });
      res.longest_chars = Math.max(res.longest_chars, pc + Math.max(String(win.reply).length, String(c.reply).length));
    }
    res.longest_chars = Math.max(res.longest_chars, pc + String(win.reply).length);
  }
  return res;
}
/** characters -> about how many tokens (pure; ~3.5 characters a token for English) */
const tokensOf = (chars) => Math.ceil((+chars || 0) / 3.5);

/** one CSV line (pure) */
function csvRow(cells) { return cells.map((c) => { const s = String(c == null ? "" : c); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(","); }

/** the model llama-server says it serves (its /v1/models id) is the one asked for? -> "" | why not. An old
 *  llama-server still holding the port (left running by an earlier session) answers for EVERY model - the comparison
 *  would record one model's replies under several names. A server that cannot say (an older build) passes. */
async function checkServed(core, file) {
  const cfg = core.getConfig().llm || {};
  if (cfg.external_url || !file) return "";
  try {
    const r = await fetch(`http://127.0.0.1:${cfg.port}/v1/models`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return "";
    const j = await r.json();
    const ids = ((j && j.data) || []).map((m) => path.basename(String(m.id || "").replace(/\\/g, "/"))).filter(Boolean);
    if (!ids.length || ids.some((x) => x.toLowerCase() === path.basename(file).toLowerCase())) return "";
    return `the LLM port answered as ${ids[0]}, not ${path.basename(file)} - an older llama-server is probably still running on port ${cfg.port} (close it, or restart bitGen)`;
  } catch { return ""; }
}

/* ------------------------------------------------------------------ the files */
let DIR = null;
function setDir(d) { DIR = d; }
const dir = (core) => { const d = DIR || path.join(core.BASE, "llm_arena", "rounds"); fs.mkdirSync(d, { recursive: true }); return d; };
const file = (core, id) => path.join(dir(core), path.basename(String(id)) + ".json");
const read = (core, id) => { try { return JSON.parse(fs.readFileSync(file(core, id), "utf8")); } catch { return null; } };
function write(core, r) {
  const f = file(core, r.id), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(r, null, 2)); fs.renameSync(tmp, f);
}
const locks = new Map();          // one write at a time per round (two replies can land together)
function edit(core, id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const next = prev.then(() => { const r = read(core, id); if (!r) return null; const out = fn(r); write(core, r); return out === undefined ? r : out; });
  locks.set(id, next.catch(() => null));
  return next;
}

function start(core, b) {
  const text = String((b && b.text) || "").trim();
  if (!text) return { error: "type the prompt first - every LLM answers it" };
  const llms = [...new Set(((b && b.llms) || []).map((x) => path.basename(String(x))).filter((x) => /\.gguf$/i.test(x)))];
  if (llms.length < 2) return { error: "pick at least two LLMs to compare (🔁 ▾)" };
  const r = { id: crypto.randomBytes(6).toString("hex"), t: new Date().toISOString(), project: core.getProject(), kind: kindOf(text, b.gen_mode),
    gen_mode: String(b.gen_mode || ""), request: text.slice(0, 20000), llms, candidates: [], chosen: null, picked_at: null };
  write(core, r);
  return r;
}
/** 2.585.0: the FULL prompt the LLMs were sent (bitGen's instructions + the conversation + the request), saved once per
 *  round - what a model trained on the round must see to learn the right thing */
function setPrompt(core, id, messages) {
  return edit(core, id, (r) => {
    if (Array.isArray(r.prompt) && r.prompt.length) return r;
    let budget = 400000;
    r.prompt = (messages || []).map((m) => {
      const c = String((m && m.content) || "").slice(0, Math.max(0, budget)); budget -= c.length;
      return { role: String((m && m.role) || ""), content: c };
    }).filter((m) => m.role && m.content);
    return r;
  });
}
/** ⤒ To the trainer: the training set into an LLM job of the 🎓 LoRA creator (made when the name is new) -> what was added */
function toTrainer(core, o) {
  const LT = require("./loraTrain"), FTM = require("./fineTune");
  const name = String((o && o.job) || "").trim();
  if (!name) return { error: "pick an LLM job of the trainer, or type a name for a new one" };
  const jobs = LT.list(), have = jobs.find((j) => j.name.toLowerCase() === name.toLowerCase());
  if (have && have.kind !== "llm") return { error: `"${have.name}" is a ${have.kind} job - pick an LLM fine-tune job` };
  const what = ["chats", "prefs", "both"].includes(o.what) ? o.what : "both";
  let job = have;
  if (!job) {
    const st = LT.save({ name, kind: "llm", objective: what === "chats" ? "sft" : "dpo" });
    job = { name: st.name, kind: "llm", settings: st };
  }
  const d = LT.jobDir(job.name);
  const set = trainingSet(all(core), { kind: o.kind, include_system: o.include_system });
  const key = (x) => JSON.stringify(x);
  let addedC = 0, addedP = 0, totalC = FTM.readChat(d).length, totalP = FTM.readPrefs(d).length;
  if (what !== "prefs") {
    const cur = o.replace ? [] : FTM.readChat(d), seen = new Set(cur.map(key));
    const add = set.chats.filter((c) => !seen.has(key(c)));
    totalC = FTM.writeChat(d, cur.concat(add)); addedC = add.length;
  }
  if (what !== "chats") {
    const cur = o.replace ? [] : FTM.readPrefs(d), seen = new Set(cur.map(key));
    const add = set.prefs.map((p) => FTM.validPref(p)).filter((p) => p && !seen.has(key(p)));
    totalP = FTM.writePrefs(d, cur.concat(add)); addedP = add.length;
  }
  return { ok: true, job: job.name, created: !have, chats_added: addedC, prefs_added: addedP, chats: totalC, prefs: totalP, rounds: set.rounds,
    without_prompt: set.without_prompt, longest_tokens: tokensOf(set.longest_chars), max_seq: (LT.list().find((j) => j.name === job.name) || {}).settings.max_seq };
}

/** one LLM's answer (or its failure) joins the round -> the candidate */
function addCandidate(core, arena, c) {
  return edit(core, arena.id, (r) => {
    const cand = { n: arena.n, llm: path.basename(String(c.llm || r.llms[arena.n] || "?")), reply: String(c.reply || ""), secs: Math.round((+c.secs || 0) * 10) / 10,
      error: c.error ? String(c.error).slice(0, 400) : "", song: c.song || null };
    r.candidates = r.candidates.filter((x) => x.n !== arena.n).concat([cand]).sort((a, b) => a.n - b.n);
    return cand;
  });
}
/** the user's choice -> {round, chosen candidate | null} */
function pick(core, id, n) {
  return edit(core, id, (r) => {
    const want = n == null || n === -1 ? -1 : Number(n);
    const c = want === -1 ? null : r.candidates.find((x) => x.n === want && !x.error);
    if (want !== -1 && !c) return { error: "no such reply in this round" };
    r.chosen = want; r.picked_at = new Date().toISOString();
    return { round: r, chosen: c };
  });
}
function all(core) {
  let fsx = []; try { fsx = fs.readdirSync(dir(core)).filter((f) => /^[a-z0-9]+\.json$/.test(f)); } catch { fsx = []; }
  return fsx.map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir(core), f), "utf8")); } catch { return null; } })
    .filter(Boolean).sort((a, b) => String(b.t).localeCompare(String(a.t)));
}
function rounds(core, o) {
  const opt = o || {};
  let list = all(core);
  if (opt.kind && opt.kind !== "all") list = list.filter((r) => r.kind === opt.kind);
  const limit = Math.max(1, Math.min(500, +opt.limit || 100));
  return { total: list.length, rounds: list.slice(0, limit) };
}
function stats(core) { const list = all(core); return { kinds: score(list), rounds: list.length, decided: list.filter((r) => r.chosen != null).length, KINDS }; }
function remove(core, id) { try { fs.unlinkSync(file(core, id)); return { ok: true }; } catch { return { error: "no such round" }; } }
function clear(core) { let n = 0; for (const r of all(core)) { try { fs.unlinkSync(file(core, r.id)); n++; } catch { /* gone */ } } return { ok: true, removed: n }; }
/** every reply of every round, one line each: when, job, project, the request, the LLM, its reply, chosen, seconds */
function csv(core) {
  const lines = [csvRow(["time", "job", "project", "request", "llm", "chosen", "seconds", "reply", "error"])];
  for (const r of all(core)) for (const c of r.candidates || [])
    lines.push(csvRow([r.t, r.kind, r.project, r.request, llmName(c.llm), r.chosen == null ? "" : r.chosen === c.n ? "yes" : "no", c.secs, c.reply, c.error]));
  return lines.join("\r\n") + "\r\n";
}

module.exports = { allRounds: (core) => all(core), trainingSet, promptOf, tokensOf, setPrompt, toTrainer, checkServed, KINDS, kindOf, parseArena, llmName, score, csvRow, setDir, start, addCandidate, pick, read, rounds, stats, remove, clear, csv };

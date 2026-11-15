/* bitGen Studio — lib/apiSources.js (2.795.0): 🧩 MODEL MANAGER ▸ ＋ ADD SOURCE - ANY MODEL API AS A TAB OF ITS OWN.
 * Tim (verbatim): "Is it possible to make the model manager dynamic, add source button will create a tab, in the tab we have a
 * settings button to bring up a dialog, for url, api key and endpoint format. (the endpoint will automatically be filled in by
 * bitgen with the url and api key and the model chosen from the list of models that we can get through the api)"
 * Tim's choices: formats OpenAI-compatible + Ollama native + Anthropic-style + Custom template; used for LLM + Vision + pictures
 * + video (pictures / video = 2.796.0); the ☁ OpenRouter tab stays as it is.
 *   A SOURCE   config.sources.<id> = {name, format, url, list_tpl, chat_tpl, auth, key, models: [{id, kind, name, added}],
 *              list: [{id, name}] (the API's last answer), list_at}. The key is kept encrypted (lib/secrets.js sources.<id>.key)
 *              and never sent to the page (has_key, key_tail).
 *   FORMATS    openai     GET {url}/v1/models (data[].id)          chat {url}/v1/chat/completions   Authorization: Bearer <key>
 *              ollama     GET {url}/api/tags (models[].name)        chat {url}/v1/chat/completions   no key (Ollama's OpenAI door)
 *              anthropic  GET {url}/v1/models (x-api-key + anthropic-version)  chat {url}/v1/chat/completions (its OpenAI door)
 *              custom     your own list + chat templates ({url} {model}) and key header (Bearer / x-api-key / none / a name)
 *              The chat request is always OpenAI's shape (messages, max_tokens) - every format above answers it.
 *   ENDPOINT   endpointFor(src, model) = the chat template with {url} and {model} filled in - what bitGen calls.
 *   USE        the prompt docker's LLM / Vision lists get a "🔌 <source> · your models" group (static/mmapisrc.js); a pick =
 *              config.source_use[llm|vlm] = {source, model}; lib/gpuSplit.js llmTarget asks llmTarget(kind) FIRST, so the
 *              chat, quick prompts and picture describes go there. Any other pick in that list (or ☁ Runs on) clears it.
 * Pure (scripts/test-apisources795.js): FORMATS, RESERVED, normUrl, fill, endpointFor, listUrl, headersFor, parseList, kindGuess,
 * cleanSource, view, mineOf, targetOf.
 */
"use strict";
const FORMATS = {
  openai: { name: "OpenAI-compatible", list: "{url}/v1/models", chat: "{url}/v1/chat/completions", auth: "bearer", key: true, url: "https://api.openai.com" },
  ollama: { name: "Ollama", list: "{url}/api/tags", chat: "{url}/v1/chat/completions", auth: "none", key: false, url: "http://127.0.0.1:11434" },
  anthropic: { name: "Anthropic-style", list: "{url}/v1/models", chat: "{url}/v1/chat/completions", auth: "x-api-key", key: true, url: "https://api.anthropic.com" },
  custom: { name: "Custom template", list: "{url}/v1/models", chat: "{url}/v1/chat/completions", auth: "bearer", key: true, url: "" },
};
const KINDS = ["llm", "vlm", "image", "video"];
const RESERVED = ["openrouter", "no_pod", "local", "runpod", "api"];   // names the lists already use as a prefix

/* ---------------- pure */
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, "").trim().slice(0, n || 300);
/** a base address without its trailing / and /v1 (the templates add them) */
function normUrl(u) { return clean(u, 500).replace(/\/+$/, "").replace(/\/v1$/i, ""); }
function fill(tpl, o) { return String(tpl || "").replace(/\{url\}/g, normUrl((o || {}).url)).replace(/\{model\}/g, encodeURIComponent((o || {}).model || "").replace(/%2F/gi, "/")); }
function fmtOf(src) { return FORMATS[(src || {}).format] || FORMATS.openai; }
/** the address bitGen sends the chat to for a model */
function endpointFor(src, model) { return fill((src || {}).chat_tpl || fmtOf(src).chat, { url: (src || {}).url, model }); }
function listUrl(src) { return fill((src || {}).list_tpl || fmtOf(src).list, { url: (src || {}).url }); }
/** the key's header: for the list (anthropic-style asks x-api-key) or the chat (its OpenAI door takes Bearer) */
function headersFor(src, forList) {
  const s = src || {}, key = s.key || "", auth = s.auth || fmtOf(s).auth;
  if (!key || auth === "none") return {};
  if (s.format === "anthropic") return forList ? { "x-api-key": key, "anthropic-version": "2023-06-01" } : { Authorization: "Bearer " + key };
  if (auth === "bearer") return { Authorization: "Bearer " + key };
  if (auth === "x-api-key") return { "x-api-key": key };
  if (/^header:[A-Za-z0-9-]{1,60}$/.test(auth)) return { [auth.slice(7)]: key };
  return { Authorization: "Bearer " + key };
}
/** the API's model list -> [{id, name}] (OpenAI data[], Ollama models[], or a plain array) */
function parseList(j) {
  const arr = Array.isArray(j) ? j : Array.isArray((j || {}).data) ? j.data : Array.isArray((j || {}).models) ? j.models : [];
  const out = [], seen = new Set();
  for (const m of arr) {
    const id = clean(typeof m === "string" ? m : (m && (m.id || m.name || m.model)), 200);
    if (!id || seen.has(id)) continue; seen.add(id);
    out.push({ id, name: clean(typeof m === "object" && m && (m.display_name || m.name) || id, 200) });
  }
  return out;
}
/** what a model is, from its name (you can change it before ＋) */
function kindGuess(id) {
  const s = String(id || "").toLowerCase();
  if (/(veo|sora|kling|\bwan\b|wan2|hunyuan-?video|ltx|seedance|minimax-video|hailuo|runway|luma|pika|video)/.test(s)) return "video";
  if (/(dall-?e|gpt-image|imagen|flux|sdxl|stable-diffusion|\bsd3|seedream|ideogram|recraft|playground|kolors|image-gen|qwen-image|z-image)/.test(s)) return "image";
  if (/(vision|-vl\b|-vl-|vl-|\bvl\b|llava|pixtral|gpt-4o|gpt-4\.1|gpt-5|claude-(3|sonnet|opus|haiku)|gemini|gemma-?3|moondream|minicpm-v|qwen2\.5-vl|qwen3-vl|internvl|molmo)/.test(s)) return "vlm";
  return "llm";
}
function slugName(n) { return clean(n, 40).replace(/[\/\\]/g, "-"); }
/** a source as stored (the fields a request may set) */
function cleanSource(b, prev) {
  const o = b || {}, p = prev || {}, format = FORMATS[o.format] ? o.format : (FORMATS[p.format] ? p.format : "openai");
  const out = {
    name: slugName(o.name != null ? o.name : p.name) || "Source", format,
    url: normUrl(o.url != null ? o.url : (p.url != null ? p.url : FORMATS[format].url)),
    list_tpl: clean(o.list_tpl != null ? o.list_tpl : p.list_tpl, 400), chat_tpl: clean(o.chat_tpl != null ? o.chat_tpl : p.chat_tpl, 400),
    auth: /^(bearer|x-api-key|none|header:[A-Za-z0-9-]{1,60})$/.test(String(o.auth || "")) ? o.auth : (p.auth || FORMATS[format].auth),
    key: o.key != null && String(o.key).trim() !== "" ? clean(o.key, 400) : (o.clear_key ? "" : (p.key || "")),
    models: Array.isArray(p.models) ? p.models : [], list: Array.isArray(p.list) ? p.list : [], list_at: p.list_at || 0,
  };
  if (format !== "custom") { out.list_tpl = ""; out.chat_tpl = ""; if (o.format && o.format !== p.format) out.auth = FORMATS[format].auth; }
  return out;
}
/** a source for the page - never the key */
function view(id, s) {
  const k = String((s || {}).key || "");
  return { id, name: s.name, format: s.format, format_name: fmtOf(s).name, url: s.url, list_tpl: s.list_tpl || "", chat_tpl: s.chat_tpl || "", auth: s.auth || fmtOf(s).auth,
    list_url: listUrl(s), chat_tpl_used: s.chat_tpl || fmtOf(s).chat, has_key: !!k, key_tail: k ? "…" + k.slice(-4) : "", models: s.models || [], list: s.list || [], list_at: s.list_at || 0 };
}
/** every source's models of yours -> [{source, name, model, kind, ref}] (ref = "<source name>/<model>", what the lists show) */
function mineOf(sources) {
  const out = [];
  for (const [id, s] of Object.entries(sources || {})) for (const m of s.models || []) out.push({ source: id, name: s.name, model: m.id, kind: m.kind, ref: s.name + "/" + m.id });
  return out;
}
/** the chat target for a picked model (lib/llmChat.js / quickPrompt.js / captioner.js take it) */
function targetOf(src, model, kind) {
  if (!src || !model) return null;
  return { url: endpointFor(src, model), model, headers: headersFor(src, false), label: src.name + "/" + model + " (🧩 Model manager source)", source: true, kind,
    drop: ["chat_template_kwargs"].concat(src.format === "anthropic" ? ["n", "top_p"] : []), min_tokens: src.format === "anthropic" ? 1024 : 0 };
}

/* ---------------- live */
const core = () => require("./core");
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function all() { const c = core().getConfig() || {}; return isObj(c.sources) ? c.sources : {}; }
function save(next, use) { const c = core().getConfig(); c.sources = next; if (use !== undefined) c.source_use = use; core().setConfig(c); }
function useMap() { const c = core().getConfig() || {}; return isObj(c.source_use) ? c.source_use : {}; }
function bad(m, st) { const e = new Error(m); e.status = st || 400; return e; }
function list() { const S = all(); return { sources: Object.entries(S).map(([id, s]) => view(id, s)), formats: Object.entries(FORMATS).map(([id, f]) => Object.assign({ id }, f)), use: useMap(), kinds: KINDS }; }
function newId() { return "s" + Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 5); }
function checkName(S, id, name) {
  if (RESERVED.includes(String(name).toLowerCase())) throw bad("\"" + name + "\" is already used by bitGen's own lists - pick another name");
  for (const [k, s] of Object.entries(S)) if (k !== id && String(s.name).toLowerCase() === String(name).toLowerCase()) throw bad("another source is called " + name);
}
function add(b) {
  const S = Object.assign({}, all()), id = newId();
  let name = slugName((b || {}).name) || "";
  if (!name) { let n = Object.keys(S).length + 1; while (Object.values(S).some((s) => s.name === "Source " + n)) n++; name = "Source " + n; }
  checkName(S, id, name);
  S[id] = cleanSource(Object.assign({}, b, { name }), null);
  save(S);
  return Object.assign(list(), { id });
}
function update(id, b) {
  const S = Object.assign({}, all());
  if (!S[id]) throw bad("no such source", 404);
  const next = cleanSource(b, S[id]);
  checkName(S, id, next.name);
  S[id] = next; save(S);
  return Object.assign(list(), { id });
}
function remove(id) {
  const S = Object.assign({}, all()); if (!S[id]) throw bad("no such source", 404);
  delete S[id];
  const U = Object.assign({}, useMap()); for (const k of Object.keys(U)) if (U[k] && U[k].source === id) delete U[k];
  save(S, U); return list();
}
async function fetchList(src) {
  const url = listUrl(src);
  if (!/^https?:\/\//i.test(url)) throw bad("set the source's URL first (⚙ Settings)");
  let r;
  try { r = await fetch(url, { headers: Object.assign({ Accept: "application/json" }, headersFor(src, true)), signal: AbortSignal.timeout(+process.env.H3_SOURCE_MS || 15000) }); }
  catch (e) { throw bad("could not reach " + url + " - " + ((e && e.cause && e.cause.code) || (e && e.message) || e), 502); }
  const t = await r.text();
  if (!r.ok) throw bad(url + " answered HTTP " + r.status + (t ? ": " + t.slice(0, 200) : "") + (r.status === 401 || r.status === 403 ? " - check the API key (⚙ Settings)" : ""), 502);
  let j; try { j = JSON.parse(t); } catch { throw bad(url + " did not answer JSON - is the format right?", 502); }
  return parseList(j);
}
/** the API's models, asked again (refresh) or the last answer */
async function models(id, refresh) {
  const S = Object.assign({}, all()), s = S[id];
  if (!s) throw bad("no such source", 404);
  if (refresh || !(s.list || []).length) {
    const L = await fetchList(s);
    S[id] = Object.assign({}, s, { list: L, list_at: Date.now() }); save(S);
  }
  const v = view(id, S[id]);
  return { id, name: v.name, list: v.list.map((m) => Object.assign({ kind: kindGuess(m.id), endpoint: endpointFor(S[id], m.id) }, m)), models: v.models, list_at: v.list_at };
}
/** ✓ Test in the dialog: the dialog's values (the stored key when its box is empty) -> {ok, count, sample, endpoint} */
async function test(b) {
  const o = b || {}, prev = o.id ? all()[o.id] : null, s = cleanSource(o, prev);
  const L = await fetchList(s);
  return { ok: true, count: L.length, sample: L.slice(0, 5).map((m) => m.id), models: L.slice(0, 400).map((m) => m.id), list_url: listUrl(s), endpoint: L.length ? endpointFor(s, L[0].id) : endpointFor(s, "<model>") };
}
function setMine(id, b) {
  const S = Object.assign({}, all()), s = S[id]; if (!s) throw bad("no such source", 404);
  const o = b || {}, m = clean(o.model, 200); if (!m) throw bad("which model?");
  let L = (s.models || []).filter((x) => x.id !== m);
  if (o.add !== false) L.push({ id: m, kind: KINDS.includes(o.kind) ? o.kind : kindGuess(m), name: clean(o.name || m, 200), added: Date.now() });
  S[id] = Object.assign({}, s, { models: L });
  let U;
  if (o.add === false) { U = Object.assign({}, useMap()); for (const k of Object.keys(U)) if (U[k] && U[k].source === id && U[k].model === m) delete U[k]; }
  save(S, U);
  return { ok: true, models: L };
}
function mine() { return { mine: mineOf(all()), use: useMap() }; }
/** the prompt docker's pick: {kind llm|vlm, source, model} (none = back to the list's own choice) */
function use(kind, source, model) {
  if (!["llm", "vlm"].includes(kind)) throw bad("kind must be llm or vlm");
  const U = Object.assign({}, useMap());
  if (!source) { delete U[kind]; save(all(), U); return { ok: true, use: U }; }
  const s = all()[source]; if (!s) throw bad("no such source", 404);
  if (!(s.models || []).some((m) => m.id === model)) throw bad(model + " is not one of " + s.name + "'s models of yours - ＋ it in its tab first");
  U[kind] = { source, model: String(model) }; save(all(), U);
  return { ok: true, use: U, endpoint: endpointFor(s, model) };
}
function clearUse(kind) { const U = useMap(); if (U[kind]) { const n = Object.assign({}, U); delete n[kind]; save(all(), n); } }
/** lib/gpuSplit.js llmTarget asks this first: the picked source model, or null */
function llmTarget(kind) { const u = useMap()[kind]; if (!u) return null; const s = all()[u.source]; return s ? targetOf(s, u.model, kind) : null; }
module.exports = { FORMATS, KINDS, RESERVED, normUrl, fill, endpointFor, listUrl, headersFor, parseList, kindGuess, cleanSource, view, mineOf, targetOf,
  list, add, update, remove, models, test, setMine, mine, use, clearUse, llmTarget, fetchList };

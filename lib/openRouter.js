// bitGen Studio — lib/openRouter.js (2.753.0): OPENROUTER - Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter.
// Tim (verbatim): "please check openrouter ... i am looking for some cheap or free sources so people aren't limited by their
// gpu" -> "lets add openrouter to remote gpu, maybe change remote gpu to remote generation?" (he picked: the LLM, pictures
// and video; this release is the LLM - pictures 2.754.0, video 2.755.0).
//
// OpenRouter (openrouter.ai) is one API in front of hundreds of models - some free. Nothing to install: the studio calls it
// over HTTPS with the user's API key (openrouter.ai/keys), kept encrypted in settings/keys.json (lib/secrets.js
// "rgpu.openrouter.key"). Its chat API is OpenAI's, so lib/llmChat.js, lib/quickPrompt.js and lib/captioner.js use it
// unchanged through lib/gpuSplit.js llmTarget().
//
//   GET  <base>/models                   {data: [{id, name, context_length, pricing: {prompt, completion, ...} (USD per
//                                         token, strings; "0" = free), architecture: {input_modalities, output_modalities}}]}
//   POST <base>/chat/completions          OpenAI's request + response
//   GET  <base>/key                       the key's own record {data: {label, usage, limit, is_free_tier, ...}} - ✓ Test
//   Headers: Authorization: Bearer <key>; HTTP-Referer + X-OpenRouter-Title name the app (OpenRouter's app rankings)
//   Free models: 20 requests a minute, 50 a day (1000 a day once the account has bought $10 of credits) - OpenRouter's
//   numbers in 2026; they change.
//   rgpu.openrouter = {key, model, vlm_model, free_only}    rgpu.llm_provider = "runpod" | "openrouter"
//   H3_OPENROUTER_API = another base (the tests' stand-in).
// Pure (scripts/test-openrouter753.js): BASE, headers, priceOf, mapModel, listView, pickVision.
"use strict";

const BASE = () => (process.env.H3_OPENROUTER_API || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const SITE = "https://tigerart.com.au";
const TITLE = "bitGen Studio";

/** the request headers (pure) */
function headers(key) {
  return { Authorization: "Bearer " + String(key || ""), "HTTP-Referer": SITE, "X-OpenRouter-Title": TITLE, "Content-Type": "application/json" };
}
/** USD per million tokens from OpenRouter's per-token string; NaN = not given (pure) */
function priceOf(v) { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 1e6 * 10000) / 10000 : NaN; }
/** one model as the studio lists it (pure) -> {id, name, free, vision, ctx, in, out} | null (not a text model) */
function mapModel(m) {
  if (!m || typeof m.id !== "string" || !m.id) return null;
  const a = m.architecture || {}, outs = Array.isArray(a.output_modalities) ? a.output_modalities : ["text"];
  const ins = Array.isArray(a.input_modalities) ? a.input_modalities : String(a.modality || "text->text").split("->")[0].split("+");
  if (!outs.includes("text")) return null;
  const p = m.pricing || {}, pin = priceOf(p.prompt), pout = priceOf(p.completion);
  const free = /:free$/.test(m.id) || (pin === 0 && pout === 0);
  return { id: m.id, name: String(m.name || m.id), free, vision: ins.includes("image"), ctx: +m.context_length || 0,
    in: Number.isFinite(pin) ? pin : null, out: Number.isFinite(pout) ? pout : null,
    // 2.770.0: the Show all list's details
    desc: String(m.description || "").replace(/\s+/g, " ").slice(0, 600), created: +m.created || 0, maker: String(m.id).split("/")[0] };
}
/** the list for the dropdowns (pure): free first, then by name; freeOnly / vision filter; 2.770.0 free / paid (both false = none) */
function listView(data, o) {
  const opt = o || {};
  const all = (Array.isArray(data) ? data : []).map(mapModel).filter(Boolean);
  const free = opt.free != null ? !!opt.free : true, paid = opt.paid != null ? !!opt.paid : !opt.freeOnly;
  return all.filter((m) => (m.free ? free : paid) && (!opt.vision || m.vision))
    .sort((a, b) => (b.free - a.free) || a.name.localeCompare(b.name));
}
/** the model for pictures (the vision LLM): the one picked for it, else the LLM's when it takes pictures (pure) -> id | "" */
function pickVision(o, models) {
  const v = String((o || {}).vlm_model || "");
  if (v) return v;
  const m = String((o || {}).model || "");
  const known = (models || []).find((x) => x.id === m);
  return known && known.vision ? m : "";
}

/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
// 2.770.0 (Tim: "in settings openrouter and checkbox show paid, show free"): show_free / show_paid (an old free_only = free shown,
// paid not); the remote platform for the LLM is chosen in Settings with OpenRouter the default ("the remote platform will be
// selected in settings with openrouter as default") - RunPod only when picked, or when only its vLLM endpoint is set up
function cfg() {
  const o = rg().openrouter || {};
  return { key: String(o.key || ""), model: String(o.model || ""), vlm_model: String(o.vlm_model || ""), free_only: o.free_only !== false, reasoning: o.reasoning !== false,
    show_free: o.show_free !== false, show_paid: o.show_paid != null ? !!o.show_paid : o.free_only === false };
}
function provider() { const p = rg().llm_provider; return p === "openrouter" || p === "runpod" ? p : ((rg().vllm || {}).endpoint && !cfg().key ? "runpod" : "openrouter"); }
function ready() { const c = cfg(); return !!(c.key && c.model); }
function view() { const c = cfg(); return { key: c.key, model: c.model, vlm_model: c.vlm_model, free_only: c.free_only, show_free: c.show_free, show_paid: c.show_paid, reasoning: c.reasoning, provider: provider(), ready: ready() }; }

let CACHE = { at: 0, data: null };
/** OpenRouter's model list (10 minutes cached) -> the raw data array */
async function models(force) {
  if (!force && CACHE.data && Date.now() - CACHE.at < 600000) return CACHE.data;
  const h = headers(cfg().key); if (!cfg().key) delete h.Authorization;   // 2.768.0: the list needs no key (the free models are listed before one is added)
  const r = await fetch(BASE() + "/models", { headers: h, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`OpenRouter did not list its models (HTTP ${r.status})`);
  const j = await r.json().catch(() => ({}));
  if (!Array.isArray(j.data)) throw new Error("OpenRouter's model list was not readable");
  CACHE = { at: Date.now(), data: j.data };
  return j.data;
}
/** GET /api/openrouter/models?free=1&vision=1 */
async function list(o) {
  const data = await models(!!(o && o.refresh));
  const x = o || {};
  return { models: listView(data, x.show ? { free: !!x.show.free, paid: !!x.show.paid, vision: !!x.vision } : { freeOnly: !!x.free, vision: !!x.vision }), total: data.length };
}
function save(b) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" }, o = Object.assign({}, r.openrouter || {});
  const id = (x) => String(x || "").trim().replace(/[^A-Za-z0-9_.:/@-]/g, "").slice(0, 200);
  if (b.key != null) o.key = String(b.key).trim().slice(0, 300);
  if (b.model != null) o.model = id(b.model);
  if (b.vlm_model != null) o.vlm_model = id(b.vlm_model);
  if (b.free_only != null) o.free_only = !!b.free_only;
  if (b.show_free != null) o.show_free = !!b.show_free;   // 2.770.0
  if (b.show_paid != null) o.show_paid = !!b.show_paid;
  if (b.reasoning != null) o.reasoning = !!b.reasoning;   // 2.767.0
  r.openrouter = o;
  if (b.provider === "openrouter" || b.provider === "runpod") r.llm_provider = b.provider;
  core().setConfig(c);
  return view();
}
/** the target lib/gpuSplit.js llmTarget hands the chat callers: {url, model, headers, label} */
async function target(kind) {
  const c = cfg();
  if (!c.key) throw new Error("an OpenRouter API key first - Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter");
  let model = c.model;
  if (kind === "vlm") {
    let known = [];
    if (!c.vlm_model) { try { known = listView(await models()); } catch { known = []; } }
    model = known.length || c.vlm_model ? pickVision(c, known) : c.model;   // no list to check = try the LLM's own
    if (!model) throw new Error(`the OpenRouter model ${c.model} does not take pictures - pick a vision model for the vision LLM (Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter)`);
  }
  if (!model) throw new Error("pick an OpenRouter model first - Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter");
  const h = headers(c.key); delete h["Content-Type"];
  // 2.767.0 (Tim, with OpenRouter's own example: "reasoning": {"enabled": True} and the assistant's reasoning_details passed
  // back unmodified on the next call): reasoning on (Settings ▸ Remote generation ▸ OpenRouter ▸ Reasoning) - the reply needs
  // room for the thinking as well as the answer (min_tokens)
  return { url: BASE() + "/chat/completions", model, headers: h, label: "OpenRouter " + model, provider: "openrouter",
    body: c.reasoning ? { reasoning: { enabled: true } } : {}, min_tokens: c.reasoning ? 4000 : 0 };
}
/* 2.767.0: an assistant's reasoning_details are given back unmodified when that message is sent again (a chat's next turn) -
   kept here by its content (the page sends the chat back as plain messages); the last 200 */
const RD = new Map();
function keyOf(content) { return require("crypto").createHash("sha1").update(String(content || "")).digest("hex"); }
/** a reply's reasoning_details, kept (pure apart from the map) */
function remember(message) {
  const m = message || {};
  if (!m.reasoning_details || !m.content) return;
  RD.set(keyOf(m.content), m.reasoning_details);
  while (RD.size > 200) RD.delete(RD.keys().next().value);
}
/** the messages with each assistant turn's reasoning_details put back (a copy) */
function attach(messages) {
  return (messages || []).map((m) => (m && m.role === "assistant" && !m.reasoning_details && RD.has(keyOf(m.content)) ? Object.assign({}, m, { reasoning_details: RD.get(keyOf(m.content)) }) : m));
}
/** ✓ Test: the key (GET /key) + the model in OpenRouter's list */
async function test(kind) {
  const c = cfg();
  if (!c.key) return { ok: false, error: "an OpenRouter API key first (openrouter.ai/keys)" };
  try {
    const r = await fetch(BASE() + "/key", { headers: headers(c.key), signal: AbortSignal.timeout(20000) });
    if (r.status === 401 || r.status === 403) return { ok: false, error: "OpenRouter refused the API key" };
    const k = ((await r.json().catch(() => ({}))) || {}).data || {};
    const want = kind === "vlm" ? (c.vlm_model || c.model) : c.model;
    let m = null;
    try { m = listView(await models()).find((x) => x.id === want) || null; } catch { m = null; }
    const tier = k.is_free_tier === true ? "free tier (50 free requests a day)" : k.is_free_tier === false ? "credits bought (1000 free requests a day)" : "";
    if (!want) return { ok: true, line: "the key works" + (tier ? " - " + tier : ""), model: "" };
    if (!m) return { ok: false, error: `the key works, but OpenRouter does not list the model ${want}` };
    if (kind === "vlm" && !m.vision) return { ok: false, error: `${want} does not take pictures - pick a vision model` };
    return { ok: true, line: "the key works" + (tier ? " - " + tier : ""), model: m.id + (m.free ? " (free)" : ` ($${m.in} in / $${m.out} out per million tokens)`) };
  } catch (e) { return { ok: false, error: `OpenRouter did not answer (${String(e.message || e).slice(0, 120)})` }; }
}

module.exports = { remember, attach, RD, BASE, SITE, TITLE, headers, priceOf, mapModel, listView, pickVision, cfg, provider, ready, view, models, list, save, target, test };

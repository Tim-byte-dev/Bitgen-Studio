/* bitGen Studio — lib/orModels.js (2.786.0): OPENROUTER MODELS - what OpenRouter offers for each type of work, and YOUR list of
 * the ones you use (☁ Remote generation ▸ OpenRouter models…; routes/orModels.js; the dialog is static/ormodels.js).
 *
 * Tim (verbatim): "Add an openrouter button to remote generation docker to select models to use, show dialog with free and paid
 * models and tabs for each type and inside each type have tabs for each family + 1 tab for all - but show price for paid
 * service. use 2 frames in the dialog 1 tab to show available models and 1 to show added models, when user double clicks model
 * then add the model to users models with a delete button at the end of each model name. when user closes the dialog update all
 * the dropdowns with the new lists add models to the appropriate dropdown in llm/vllm and the override model dropdown (not the
 * video/image styles) as openrouter/model name but don't remove the other models" + "if openrouter model is not found, remove it
 * from our list"
 *
 *   TYPES      image · video · llm · vlm
 *   OpenRouter's lists (no key needed to list):
 *     llm / vlm  GET <base>/models (lib/openRouter.js mapModel: text out; vlm = takes pictures)
 *     image      GET <base>/images/models {data: [{id, name, description, supported_parameters, ...}]} + the price of each
 *                from GET <base>/images/models/<id>/endpoints (a "pricing" array of {billable, unit, cost_usd}); names /
 *                descriptions also from GET <base>/models?output_modalities=image
 *     video      GET <base>/videos/models {data: [{id, name, description, created, supported_durations, supported_resolutions,
 *                supported_aspect_ratios, supported_sizes, pricing_skus: {"per-video-second": "0.50", ...}}]}
 *   YOUR LIST  rgpu.openrouter.mine = {image: [m], video: [m], llm: [m], vlm: [m]} - m = {id, name, maker, free, price, usd,
 *              unit, caps?, added}. Kept in the settings (one place); the dropdowns list them as "openrouter/<id>".
 *   prune      a model OpenRouter no longer lists is taken off your list - only when OpenRouter ANSWERED (never on a network
 *              error); the answer says which (`removed`).
 * 2.790.0 (Tim: "put a + button next to the openrouter model to add the model to our model list and save it's endpoint"): every
 *   entry of your list keeps `endpoint` - the OpenRouter address it renders at (endpointOf: image = <base>/images, video =
 *   <base>/videos, llm / vlm = <base>/chat/completions); added with + in 🧩 Model manager ▸ ☁ OpenRouter or the dialog.
 * Pure (scripts/test-ormodels786.js): TYPES, makerOf, familyLabel, families, mapImage, mapVideo, mapText, pricesIn,
 *   priceText, isFree, inFamily, prune, estimate, snapDuration, snapAspect.
 */
"use strict";

const TYPES = [["image", "Image"], ["video", "Video"], ["llm", "LLM"], ["vlm", "Vision LLM"]];
const TYPE_IDS = TYPES.map((t) => t[0]);
const MAX_MINE = 200;

/* ---------------- pure */
const makerOf = (id) => String(id || "").split("/")[0].toLowerCase();
const NAMES = { openai: "OpenAI", "x-ai": "xAI", "meta-llama": "Meta Llama", "bytedance-seed": "ByteDance Seed", bytedance: "ByteDance",
  "black-forest-labs": "Black Forest Labs", mistralai: "Mistral AI", deepseek: "DeepSeek", "z-ai": "Z.ai", minimax: "MiniMax",
  qwen: "Qwen", google: "Google", anthropic: "Anthropic", nvidia: "NVIDIA", microsoft: "Microsoft", moonshotai: "Moonshot AI",
  "ibm-granite": "IBM Granite", ai21: "AI21", cohere: "Cohere", amazon: "Amazon", baidu: "Baidu", tencent: "Tencent",
  "kwaivgi": "Kling", "openrouter": "OpenRouter", "recraft": "Recraft", "ideogram": "Ideogram", "stability-ai": "Stability AI",
  "luma": "Luma", "runway": "Runway", "pika": "Pika", "alibaba": "Alibaba", "wan-ai": "Wan", "lightricks": "Lightricks" };
/** a maker's words (pure): known ones as the maker writes them, else Title Case of the slug */
function familyLabel(maker) {
  const m = String(maker || "").toLowerCase();
  if (NAMES[m]) return NAMES[m];
  return m.split(/[-_]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") || "Other";
}
/** the family tabs of a list (pure) -> [{id: "all", label: "All", n}, {id: maker, label, n} ... by count, then name] */
function families(list) {
  const by = {};
  for (const m of list || []) { const k = m.maker || makerOf(m.id); by[k] = (by[k] || 0) + 1; }
  const fam = Object.keys(by).map((k) => ({ id: k, label: familyLabel(k), n: by[k] }))
    .sort((a, b) => (b.n - a.n) || a.label.localeCompare(b.label));
  return [{ id: "all", label: "All", n: (list || []).length }].concat(fam);
}
const inFamily = (m, fam) => !fam || fam === "all" || (m.maker || makerOf(m.id)) === fam;
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : NaN; };
const r6 = (n) => Math.round(n * 1e6) / 1e6;
/** every {billable, unit, cost_usd} pricing line anywhere in an endpoints answer (pure) */
function pricesIn(j) {
  const out = [], seen = new Set();
  const walk = (x, depth) => {
    if (!x || typeof x !== "object" || depth > 8 || seen.has(x)) return;
    seen.add(x);
    if (Array.isArray(x)) { x.forEach((y) => walk(y, depth + 1)); return; }
    if (Array.isArray(x.pricing)) for (const p of x.pricing) {
      const c = num(p && (p.cost_usd != null ? p.cost_usd : p.cost));
      if (p && Number.isFinite(c)) out.push({ billable: String(p.billable || ""), unit: String(p.unit || ""), usd: c });
    }
    for (const v of Object.values(x)) if (v && typeof v === "object") walk(v, depth + 1);
  };
  walk(j, 0);
  return out;
}
/** an image model's price from its pricing lines (pure) -> {usd, unit} | null: the cheapest line for an output image */
function imagePrice(lines) {
  const L = (lines || []).filter((p) => /image|megapixel|mp/i.test(p.unit + " " + p.billable) && /out|image/i.test(p.billable || p.unit));
  const pick = (L.length ? L : lines || []).slice().sort((a, b) => a.usd - b.usd)[0];
  if (!pick) return null;
  const unit = /megapixel|^mp$/i.test(pick.unit) ? "megapixel" : /token/i.test(pick.unit) ? "token" : /image/i.test(pick.unit) ? "image" : pick.unit || "image";
  return { usd: pick.usd, unit };
}
/** a video model's per-second price (pure) -> {usd, unit: "second", skus} | {usd, unit: "video"} | null */
function videoPrice(skus) {
  const s = skus && typeof skus === "object" ? skus : {};
  const per = Object.keys(s).filter((k) => /second/i.test(k)).map((k) => ({ k, usd: num(s[k]) })).filter((x) => Number.isFinite(x.usd));
  if (per.length) {
    const base = per.find((x) => /^per-video-second$/i.test(x.k)) || per.slice().sort((a, b) => a.usd - b.usd)[0];
    const o = {}; per.forEach((x) => { o[x.k] = x.usd; });
    return { usd: base.usd, unit: "second", skus: o, from: per.some((x) => x.usd !== base.usd) };
  }
  const v = Object.keys(s).map((k) => num(s[k])).filter(Number.isFinite).sort((a, b) => a - b)[0];
  return v != null ? { usd: v, unit: "video" } : null;
}
/** the price in a few words (pure) */
function priceText(m) {
  if (!m) return "";
  if (m.free) return "free";
  if (m.in != null || m.out != null) return "$" + (m.in != null ? m.in : "?") + " in / $" + (m.out != null ? m.out : "?") + " out per M tokens";
  if (m.usd == null || !Number.isFinite(+m.usd)) return "paid - price on OpenRouter";
  const u = m.unit === "second" ? "/ second" : m.unit === "megapixel" ? "/ megapixel" : m.unit === "token" ? "/ token" : m.unit === "video" ? "/ video" : "/ image";
  return (m.from ? "from " : "") + "$" + (+m.usd).toFixed(m.usd < 0.01 ? 4 : m.usd < 1 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, ".0") + " " + u;
}
const isFree = (m) => !!(m && (m.free || /:free$/.test(String(m.id || ""))));
/** one image model as the dialog lists it (pure) - general = the /models entry of the same id (names, prices), price = imagePrice() */
function mapImage(m, general, price) {
  if (!m || typeof m.id !== "string" || !m.id) return null;
  const g = general || {}, p = price || null, sp = m.supported_parameters || {};
  const refs = sp.input_references && (sp.input_references.max != null ? +sp.input_references.max : null);
  const o = { id: m.id, name: String(m.name || g.name || m.id), maker: makerOf(m.id), type: "image",
    desc: String(m.description || g.description || "").replace(/\s+/g, " ").slice(0, 600), created: +(m.created || g.created) || 0,
    usd: p ? r6(p.usd) : null, unit: p ? p.unit : "", free: !!(p && p.usd === 0),
    caps: { aspect: ((sp.aspect_ratio || {}).values || []).slice(0, 30), resolution: ((sp.resolution || {}).values || []).slice(0, 10), refs: Number.isFinite(refs) ? refs : null, n: sp.n ? +(sp.n.max || 1) : 1 } };
  o.price = priceText(o);
  return o;
}
/** one video model (pure) */
function mapVideo(m) {
  if (!m || typeof m.id !== "string" || !m.id) return null;
  const p = videoPrice(m.pricing_skus);
  const o = { id: m.id, name: String(m.name || m.id), maker: makerOf(m.id), type: "video",
    desc: String(m.description || "").replace(/\s+/g, " ").slice(0, 600), created: +m.created || 0,
    usd: p ? r6(p.usd) : null, unit: p ? p.unit : "", from: !!(p && p.from), skus: p && p.skus ? p.skus : null, free: !!(p && p.usd === 0),
    caps: { durations: (m.supported_durations || []).map(Number).filter(Number.isFinite).slice(0, 40), aspect: (m.supported_aspect_ratios || []).slice(0, 20),
      resolution: (m.supported_resolutions || []).slice(0, 10), sizes: (m.supported_sizes || []).slice(0, 20) } };
  o.price = priceText(o);
  return o;
}
/** a text model (LLM / vision LLM) from lib/openRouter.js mapModel's shape (pure) */
function mapText(x, type) {
  if (!x) return null;
  if (type === "vlm" && !x.vision) return null;
  const o = { id: x.id, name: x.name, maker: x.maker || makerOf(x.id), type, desc: x.desc || "", created: x.created || 0, free: !!x.free,
    in: x.in, out: x.out, ctx: x.ctx || 0 };
  o.price = priceText(o);
  return o;
}
/** your list against what OpenRouter lists now (pure) -> {keep, removed} - ids = every id OpenRouter answered with for that type */
function prune(mine, ids) {
  const set = new Set(ids || []), keep = [], removed = [];
  for (const m of mine || []) (set.has(m.id) ? keep : removed).push(m);
  return { keep, removed };
}
/** a video length OpenRouter takes for the model (pure): the nearest of its durations (none listed = the seconds, at least 1) */
function snapDuration(caps, seconds) {
  const s = Math.max(1, Math.round(+seconds || 5)), d = ((caps || {}).durations || []).filter((x) => x > 0);
  if (!d.length) return s;
  return d.slice().sort((a, b) => (Math.abs(a - s) - Math.abs(b - s)) || (b - a))[0];
}
/** the nearest aspect ratio the model takes (pure) -> "16:9" | "" (none listed = leave it to the worker) */
function snapAspect(caps, w, h) {
  const list = ((caps || {}).aspect || []).filter((a) => /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(a));
  if (!list.length || !(w > 0 && h > 0)) return "";
  const r = w / h, val = (a) => { const [x, y] = a.split(":").map(Number); return x / y; };
  return list.slice().sort((a, b) => Math.abs(Math.log(val(a) / r)) - Math.abs(Math.log(val(b) / r)))[0];
}
/** what a render will cost, before it is queued (pure) -> {usd, text} | {usd: null, text} - m = your list's entry
 *  o = {n (pictures), seconds, w, h} */
function estimate(m, o) {
  const x = o || {};
  if (!m) return { usd: null, text: "" };
  if (isFree(m)) return { usd: 0, text: "free" };
  if (m.usd == null) return { usd: null, text: "OpenRouter says the price after the render (" + (m.price || "paid") + ")" };
  if (m.type === "video" || m.unit === "second") {
    const secs = snapDuration(m.caps, x.seconds);
    let rate = +m.usd;
    if (m.skus) {   // a resolution's own price ("per-video-second-1080p") when the render is that big
      const tall = Math.min(+x.w || 0, +x.h || 0), want = tall >= 2000 ? "4k" : tall >= 1000 ? "1080p" : tall >= 700 ? "720p" : "";
      const k = want && Object.keys(m.skus).find((s) => s.toLowerCase().endsWith(want));
      if (k) rate = +m.skus[k];
    }
    const usd = r6(rate * secs);
    return { usd, text: "about $" + usd.toFixed(2) + " (" + secs + " s × $" + rate + " a second)" };
  }
  const n = Math.max(1, Math.min(8, +x.n || 1));
  if (m.unit === "megapixel") {
    const mp = Math.max(0.25, ((+x.w || 1024) * (+x.h || 1024)) / 1e6), usd = r6(m.usd * mp * n);
    return { usd, text: "about $" + usd.toFixed(3) + " (" + n + " × " + mp.toFixed(2) + " MP × $" + m.usd + ")" };
  }
  if (m.unit === "image" || !m.unit) { const usd = r6(m.usd * n); return { usd, text: "about $" + usd.toFixed(3) + (n > 1 ? " (" + n + " × $" + m.usd + ")" : "") }; }
  return { usd: null, text: "priced by " + m.unit + " - OpenRouter says the cost after the render" };
}
/** a list's entry kept in your list (pure): the fields worth keeping */
/** 2.790.0: the address a model of `type` renders at (pure) */
function endpointOf(type, base) {
  const b = String(base || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  return type === "image" ? b + "/images" : type === "video" ? b + "/videos" : b + "/chat/completions";
}
function entryOf(m) {
  const o = { id: String(m.id).slice(0, 200), name: String(m.name || m.id).slice(0, 200), maker: m.maker || makerOf(m.id), type: m.type,
    free: !!m.free, price: String(m.price || priceText(m)).slice(0, 120), added: Date.now() };
  for (const k of ["usd", "unit", "from", "in", "out", "ctx"]) if (m[k] != null && m[k] !== "") o[k] = m[k];
  if (m.skus) o.skus = m.skus;
  if (m.caps) o.caps = m.caps;
  return o;
}

/* ---------------- live */
function core() { return require("./core"); }
function OR() { return require("./openRouter"); }
const CACHE = {};
async function getJson(url, ms) {
  const h = OR().headers(OR().cfg().key); if (!OR().cfg().key) delete h.Authorization; delete h["Content-Type"];
  const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(ms || 30000) });
  if (!r.ok) { const e = new Error("OpenRouter answered HTTP " + r.status); e.http = r.status; throw e; }
  return r.json();
}
async function cached(k, ttl, fn, force) {
  if (!force && CACHE[k] && Date.now() - CACHE[k].at < ttl) return CACHE[k].v;
  const v = await fn();
  CACHE[k] = { at: Date.now(), v };
  return v;
}
/** a few at a time */
async function eachLimit(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; out[k] = await fn(list[k]).catch(() => null); } }));
  return out;
}
/** OpenRouter's models of one type -> {models: [...], ids: [every id it answered]} (cached 10 min; prices of pictures 1 h) */
async function catalogue(type, force) {
  const B = OR().BASE();
  if (type === "llm" || type === "vlm") {
    const data = await OR().models(force);
    return { models: data.map(OR().mapModel).filter(Boolean).map((x) => mapText(x, type)).filter(Boolean), ids: data.map((d) => d && d.id).filter(Boolean) };
  }
  if (type === "video") {
    return cached("video", 600000, async () => {
      const j = await getJson(B + "/videos/models");
      const data = Array.isArray(j && j.data) ? j.data : null;
      if (!data) throw new Error("OpenRouter's video model list was not readable");
      return { models: data.map(mapVideo).filter(Boolean), ids: data.map((d) => d && d.id).filter(Boolean) };
    }, force);
  }
  if (type === "image") {
    return cached("image", 600000, async () => {
      const j = await getJson(B + "/images/models");
      const data = Array.isArray(j && j.data) ? j.data : null;
      if (!data) throw new Error("OpenRouter's picture model list was not readable");
      let general = {};
      try { const g = await getJson(B + "/models?output_modalities=image"); for (const m of (g && g.data) || []) if (m && m.id) general[m.id] = m; } catch { general = {}; }
      const prices = await eachLimit(data, 6, (m) => cached("ip:" + m.id, 3600000, async () => imagePrice(pricesIn(await getJson(B + "/images/models/" + String(m.id).split("/").map(encodeURIComponent).join("/") + "/endpoints", 20000))), force));
      return { models: data.map((m, i) => mapImage(m, general[m.id], prices[i])).filter(Boolean), ids: data.map((d) => d && d.id).filter(Boolean) };
    }, force);
  }
  throw Object.assign(new Error("unknown type " + type), { status: 400 });
}
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
/** your list (every type) */
function mine() {
  const m = (rg().openrouter || {}).mine || {}, out = {};
  for (const t of TYPE_IDS) out[t] = Array.isArray(m[t]) ? m[t].filter((x) => x && x.id).map((x) => (x.endpoint ? x : Object.assign({}, x, { endpoint: endpointOf(t, OR().BASE()) }))) : [];
  return out;
}
function saveMine(all) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" }, o = r.openrouter = Object.assign({}, r.openrouter || {});
  o.mine = {}; for (const t of TYPE_IDS) o.mine[t] = (all[t] || []).slice(0, MAX_MINE);
  core().setConfig(c);
  return mine();
}
function bad(m, s) { return Object.assign(new Error(m), { status: s || 400 }); }
const typeOk = (t) => { if (!TYPE_IDS.includes(t)) throw bad("type must be one of " + TYPE_IDS.join(", ")); return t; };
/** GET /api/ormodels?type= -> {type, types, families, models, mine (that type), removed} - prunes your list when OpenRouter answered */
async function view(type, force) {
  typeOk(type);
  let cat = null, error = "";
  try { cat = await catalogue(type, force); } catch (e) { error = String((e && e.message) || e); }
  let my = mine(), removed = [];
  if (cat && cat.ids.length) {
    const p = prune(my[type], cat.ids);
    if (p.removed.length) { removed = p.removed.map((m) => ({ id: m.id, name: m.name })); my[type] = p.keep; my = saveMine(my); }
    // your entries take the newest price / caps
    const by = new Map(cat.models.map((m) => [m.id, m]));
    let changed = false;
    my[type] = my[type].map((m) => { const n = by.get(m.id); if (!n) return m; const e = Object.assign(entryOf(n), { added: m.added, endpoint: m.endpoint || endpointOf(type, OR().BASE()) }); if (JSON.stringify(e.caps) !== JSON.stringify(m.caps) || e.usd !== m.usd || e.price !== m.price) changed = true; return e; });
    if (changed) my = saveMine(my);
  }
  const models = cat ? cat.models : [];
  return { type, types: TYPES.map(([id, label]) => ({ id, label, n: mine()[id].length })), families: families(models), models,
    mine: my[type], removed, error, key: !!OR().cfg().key };
}
async function add(type, id) {
  typeOk(type);
  const all = mine();
  if (all[type].some((m) => m.id === id)) return { mine: all[type], added: false };
  const cat = await catalogue(type);
  const m = cat.models.find((x) => x.id === id);
  if (!m) throw bad("OpenRouter does not list " + id + " for " + type, 404);
  const e = Object.assign(entryOf(m), { endpoint: endpointOf(type, OR().BASE()) });   // 2.790.0: where it renders
  all[type].push(e);
  return { mine: saveMine(all)[type], added: true, entry: e };
}
function remove(type, id) {
  typeOk(type);
  const all = mine(), before = all[type].length;
  all[type] = all[type].filter((m) => m.id !== id);
  const out = saveMine(all)[type];
  // the model in use was this one: the Runs on choice falls back to the next of your list (lib/orRender.js modelFor)
  const u = (rg().openrouter || {}).use || {};
  if (u[type] === id) { const c = core().getConfig(); c.rgpu.openrouter.use = Object.assign({}, u, { [type]: "" }); core().setConfig(c); }
  return { mine: out, removed: before !== out.length };
}
/** your list checked against OpenRouter's lists (GET /api/ormodels/mine?check=1 - once a session from the page): every type you
 *  have models of; a model OpenRouter answered without is taken off -> [{type, id, name}] */
async function checkMine() {
  const out = [], all = mine();
  for (const t of TYPE_IDS) {
    if (!all[t].length) continue;
    try { const v = await view(t); for (const r of v.removed) out.push(Object.assign({ type: t }, r)); } catch { /* not answered - kept */ }
  }
  return out;
}
/** one of your models by id (any type, or one type) */
function find(id, type) {
  const all = mine();
  for (const t of type ? [type] : TYPE_IDS) { const m = all[t].find((x) => x.id === id); if (m) return m; }
  return null;
}
module.exports = { endpointOf, TYPES, TYPE_IDS, makerOf, familyLabel, families, inFamily, pricesIn, imagePrice, videoPrice, priceText, isFree, mapImage, mapVideo, mapText,
  prune, snapDuration, snapAspect, estimate, entryOf, catalogue, mine, saveMine, view, add, remove, find, checkMine, CACHE };

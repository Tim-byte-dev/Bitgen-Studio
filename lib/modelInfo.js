// bitGen Studio — lib/modelInfo.js (2.537.0): THE MODEL INFO LIBRARY - Civitai's details, thumbnails and example
// pictures for the models + LoRAs you already have, kept in ONE folder every project shares.
// Tim (verbatim): "add a model info page, download info and thumbs and examples from civitai for each matching model
// name, keep them in model_info folder made available to all projects."
//
//   WHERE          <app>/model_info/<models|loras>/<file stem>/
//                    info.json   {v, file, size, cat, status: found|nomatch, match: id|hash|file|stem|size, query,
//                                 fetched_at, civitai: the version (lib/civitai.slim), examples: [{file, url, width,
//                                 height, meta: {prompt, negative, cfg, steps, sampler, seed}}], thumb}
//                    thumb.<ext> + ex1.<ext> … ex8.<ext>   (512 px; safe-for-work unless Settings -> Civitai -> mature)
//                  Not beside the model: one library for every project, and model folders stay as they are.
//                  lib/modelCards reads it (below your own <stem>.bitgen.json, above other tools' files).
//   MATCHING       a SHA-256 the card already knows -> by-hash (exact). Else a search by the file's NAME (the stem
//                  cleaned of versions / precisions: cleanQuery) in Checkpoint or LoRA types, then matchVersion: the
//                  same FILE NAME in a version's files (case-insensitive) beats the same stem, beats the same size
//                  with a shared word - and nothing below that is taken (a wrong page is worse than none).
//   THE QUEUE      fetch({keys | all, force}) - one model at a time, ~1 s between Civitai calls; status() for the
//                  docker's progress line; stop(). A model with info (or a "nomatch" < 30 days old) is skipped
//                  unless force.
// Pure (scripts/test-modelinfo537.js): cleanQuery, matchVersion, examplesOf, dirName, isStale.
"use strict";
const fs = require("fs");
const path = require("path");

const MAX_EX = 8;
const MEDIA_V = 2;          // 2.581.0: info.json media_v - videos + animated pictures kept; below it 🔄 Sync fetches the media again
const NOMATCH_DAYS = 30;
const DROP = /^(v?\d+([._]\d+)*[a-z]?|fp(8|16|32)|bf16|f16|f32|e4m3fn|e5m2|int[48]|nf4|q\d(_[0-9a-z]+)*|gguf|safetensors|ckpt|pruned|emaonly|ema|fixed|final|convrot|scaled|lora|lycoris|locon|dora|model|checkpoint|sdxl?|xl|sd15|sd|full|turbo|lightning|hyper|dmd2?|\d+steps?|\d+k|\d+mb|\d+gb|by)$/i;

/** a file stem -> the words Civitai's search is asked for (pure) */
function cleanQuery(stem) {
  const s = String(stem || "").replace(/\.[a-z0-9]+$/i, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-.+()[\]{}]+/g, " ");
  const words = s.split(/\s+/).filter(Boolean).filter((w) => !DROP.test(w));
  return words.slice(0, 4).join(" ").trim();
}
const lc = (x) => String(x || "").toLowerCase();
const stemOf = (n) => lc(path.basename(String(n || ""))).replace(/\.[a-z0-9]+$/i, "");
const wordsOf = (n) => stemOf(n).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

/** Civitai search items + the local file -> {model, version, file, how} | null (pure).
 *  file name > stem > (size within 0.5 % AND a shared word of 4+ letters, only when it is the only one) */
function matchVersion(items, fileName, size) {
  const want = lc(path.basename(String(fileName || ""))), wstem = stemOf(fileName), ww = wordsOf(fileName);
  let best = null;
  const bySize = [];
  for (const m of items || []) {
    for (const v of (m && m.modelVersions) || []) {
      for (const f of (v && v.files) || []) {
        const fn = lc(f && f.name);
        let score = 0;
        if (fn && fn === want) score = 3;
        else if (fn && stemOf(fn) === wstem) score = 2;
        if (score && (!best || score > best.score)) best = { model: m, version: v, file: f, score, how: score === 3 ? "file" : "stem" };
        const kb = +(f && (f.sizeKB || f.sizeKb)) || 0;
        if (!score && size > 0 && kb > 0 && Math.abs(kb * 1024 - size) / size < 0.005) {
          const mw = wordsOf(m.name || "").concat(wordsOf(f.name || ""));
          if (ww.some((w) => mw.includes(w))) bySize.push({ model: m, version: v, file: f, score: 1, how: "size" });
        }
      }
    }
  }
  if (best) return best;
  return bySize.length === 1 ? bySize[0] : null;
}
/** a version's pictures + videos -> the examples to keep (safe-for-work unless mature) (pure). 2.581.0 (Tim: "when
 *  syncing models with civitai dl it's animated thumbs and videos for the models too"): videos and animated pictures
 *  are kept too - media "video" (type video, or an .mp4 / .webm / .mov address) | "image" (stills and GIFs) */
function mediaOf(i) {
  if (!i) return "";
  if (i.type === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(i.url || ""))) return "video";
  if (!i.type || i.type === "image") return "image";
  return "";                                      // audio / anything else Civitai adds later
}
function examplesOf(images, mature, max) {
  const out = [];
  for (const i of images || []) {
    if (!i || !i.url) continue;
    const media = mediaOf(i);
    if (!media) continue;
    if (!mature && (i.nsfw === true || i.nsfw === "X" || i.nsfw === "Mature" || (+i.nsfwLevel || 1) > 1)) continue;
    const m = i.meta || {};
    out.push({ url: String(i.url), media, width: i.width || null, height: i.height || null,
      meta: { prompt: String(m.prompt || "").slice(0, 3000), negative: String(m.negativePrompt || "").slice(0, 1500),
        cfg: m.cfgScale != null ? +m.cfgScale : null, steps: m.steps != null ? +m.steps : null, sampler: String(m.sampler || ""),
        seed: m.seed != null ? m.seed : null, size: m.Size || "" } });
    if (out.length >= (max || MAX_EX)) break;
  }
  return out;
}
const dirName = (n) => String(stemOf(n) || "model").replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "model";
/** a "nomatch" answer older than 30 days is asked again (pure) */
function isStale(info, now) { return !!(info && info.status === "nomatch" && (now || Date.now()) - (+info.fetched_at || 0) > NOMATCH_DAYS * 864e5); }

/* ---------------- live */
function core() { return require("./core"); }
function root() { return path.join(core().BASE, "model_info"); }
function dirFor(card) { return path.join(root(), card && card.kind === "lora" ? "loras" : "models", dirName(card ? card.name : "")); }
function readInfo(card) { try { return JSON.parse(fs.readFileSync(path.join(dirFor(card), "info.json"), "utf8")); } catch { return null; } }
/** the info for a card - only when it is about THIS file (its size, when both are known) */
function infoFor(card) {
  const i = readInfo(card);
  if (!i) return null;
  if (i.size && card.size && Math.abs(i.size - card.size) / card.size > 0.01) return null;
  return i;
}
function filePath(card, name) {
  const d = dirFor(card), f = path.basename(String(name || ""));
  if (!f) return null;
  const p = path.join(d, f);
  return p.startsWith(d) && fs.existsSync(p) ? p : null;
}
function thumbPath(card) { const i = infoFor(card); return i && i.thumb ? filePath(card, i.thumb) : null; }
function examplePath(card, n) { const i = infoFor(card); const e = i && (i.examples || [])[+n]; return e && e.file ? filePath(card, e.file) : null; }

const Q = { list: [], running: false, current: "", done: 0, found: 0, nomatch: 0, failed: 0, total: 0, stop: false, log: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function note(t) { Q.log.push(t); if (Q.log.length > 40) Q.log.shift(); }
/** the file extension for what Civitai's CDN answered (pure) - the address' own extension lies for transcoded media */
function extFor(ct, url, media) {
  const c = String(ct || "").toLowerCase();
  if (/video\/webm/.test(c)) return ".webm";
  if (/video\/quicktime/.test(c)) return ".mov";
  if (/video\//.test(c)) return ".mp4";
  if (/image\/gif/.test(c)) return ".gif";
  if (/png/.test(c)) return ".png";
  if (/webp/.test(c)) return ".webp";
  if (/jpe?g/.test(c)) return ".jpeg";
  const m = /\.(mp4|webm|mov|gif|png|webp|jpe?g)(\?|$)/i.exec(String(url || ""));
  if (m) return "." + m[1].toLowerCase().replace("jpg", "jpeg");
  return media === "video" ? ".mp4" : ".jpeg";
}
/** what a saved example is, by its file name (pure) */
const kindOfFile = (f) => (/\.(mp4|webm|mov|m4v)$/i.test(String(f || "")) ? "video" : /\.gif$/i.test(String(f || "")) ? "animated" : "image");
const MAX_VIDEO = 60 * 1024 * 1024;   // a longer clip than an example needs is not kept
async function saveImage(url, dest, media) {
  const ex = require("./setupExec");
  const u = String(url).replace(/\/width=\d+\//, "/width=512/");          // Civitai's CDN scales (and transcodes a video) to 512 px
  const r = await ex.open(u, {});
  if (r.status !== 200) { try { r.res.resume(); } catch { /* fine */ } return ""; }
  const out = dest + extFor(r.headers["content-type"], u, media);
  const len = +r.headers["content-length"] || 0;
  if (len > MAX_VIDEO) { try { r.res.resume(); } catch { /* fine */ } return ""; }
  let got = 0;
  try {
    await new Promise((ok, bad) => {
      const w = fs.createWriteStream(out);
      r.res.on("data", (b) => { got += b.length; if (got > MAX_VIDEO) { r.res.destroy(new Error("too big")); } });
      r.res.pipe(w); w.on("finish", ok); w.on("error", bad); r.res.on("error", bad);
    });
  } catch (e) { try { fs.unlinkSync(out); } catch { /* fine */ } return ""; }
  return path.basename(out);
}
/** one card: ask Civitai, keep what matched (never throws) -> "found" | "nomatch" | "failed" */
async function fetchOne(card) {
  const cv = require("./civitai");
  const c = cv.cfg();
  const d = dirFor(card);
  const query = cleanQuery(card.file || card.name);
  let match = null, model = null, sha = "", hashed = false;
  try {
    // 2.538.0: a model Civitai already named (its .civitai.info / .metadata.json / our .bitgen.json) is asked for by its version id
    // 2.581.0: a model already matched (any way) is asked for by that version id again - how 🔄 Sync fetches the
    // videos / animated pictures of models synced before they were kept
    const prev = readInfo(card);
    const prevId = prev && prev.status === "found" && prev.civitai && prev.civitai.id && (!prev.size || !card.size || prev.size === card.size) ? prev.civitai.id : "";
    const vid = card.civitai && card.civitai.version_id ? String(card.civitai.version_id).replace(/\D/g, "") : String(prevId || "").replace(/\D/g, "");
    if (vid) {
      try { const ver = await cv.api("/model-versions/" + vid); if (ver && ver.id) match = { version: ver, how: "id" }; } catch (e) { if (e.status !== 404) throw e; }
      await sleep(900);
    }
    if (!match && card.sha256) {
      try { const ver = await cv.api("/model-versions/by-hash/" + String(card.sha256).toUpperCase()); match = { version: ver, how: "hash" }; } catch (e) { if (e.status !== 404) throw e; }
      await sleep(900);
    }
    if (!match && query) {
      const types = card.kind === "lora" ? "LORA,LoCon,DoRA" : "Checkpoint";
      for (const q of [query, query.split(" ").slice(0, 2).join(" ")].filter((x, i, a) => x && a.indexOf(x) === i)) {
        const j = await cv.api("/models", { query: q, types, limit: 20, nsfw: c.mature ? "true" : "false" });
        await sleep(900);
        const hit = matchVersion((j && j.items) || [], card.file || card.name, card.size);
        if (hit) { match = { version: Object.assign({ modelId: hit.model.id, model: { name: hit.model.name, type: hit.model.type, nsfw: hit.model.nsfw } }, hit.version), how: hit.how }; model = hit.model; break; }
        if (Q.stop) break;
      }
    }
    /* 2.576.0 (Tim: "a lot of my models are not found on civitai during sync, but i downloaded most from civitai"): the
       name search misses a file that was renamed, or whose Civitai page has another name - but a file downloaded from
       Civitai is known there BY ITS CONTENT. The SHA-256 is read (once - kept in info.json for the next time) and
       Civitai asked by it: exact. A big model takes a while to read (about 30 s - 2 min for 20 GB); the status bar's
       Civitai chip says "reading …". */
    if (!match && card.sha256) { sha = String(card.sha256).toLowerCase(); hashed = true; }      // asked by it above already
    else if (!match && !Q.stop) {
      sha = String(((readInfo(card) || {}).size === card.size ? (readInfo(card) || {}).sha256 : "") || "").toLowerCase();
      if (!sha) {
        let abs = ""; try { const h = require("./modelCards").find(card.key); abs = h ? h.abs : ""; } catch { abs = ""; }
        if (abs) {
          Q.hash = { file: card.file, got: 0, total: card.size || 0 };
          try { sha = await (hashFn || cv.sha256)(abs, (g) => { if (Q.hash) Q.hash.got = g; }); } finally { Q.hash = null; }
        }
      }
      if (sha) {
        hashed = true;
        try { const ver = await cv.api("/model-versions/by-hash/" + sha.toUpperCase()); if (ver && ver.id) match = { version: ver, how: "hash" }; } catch (e) { if (e.status !== 404) throw e; }
        await sleep(900);
      }
    }
    fs.mkdirSync(d, { recursive: true });
    if (!match) {
      fs.writeFileSync(path.join(d, "info.json"), JSON.stringify(Object.assign({ v: 1, file: card.file, size: card.size, cat: card.cat, status: "nomatch", query, fetched_at: Date.now() }, sha ? { sha256: sha, hashed } : {}), null, 2));
      return "nomatch";
    }
    const ver = match.version;
    if ((!model || !model.description) && ver.modelId) { try { model = (await cv.api("/models/" + ver.modelId)) || model; await sleep(600); } catch { /* the search's answer will do */ } }
    const exs = examplesOf(ver.images, c.mature, MAX_EX);
    const kept = [];
    let thumb = "";
    for (let i = 0; i < exs.length && !Q.stop; i++) {
      try {
        const f = await saveImage(exs[i].url, path.join(d, "ex" + (i + 1)), exs[i].media);
        if (f) { kept.push(Object.assign({ file: f }, exs[i], { media: kindOfFile(f) })); if (!thumb) thumb = f; }
      } catch { /* that picture is skipped */ }
    }
    if (thumb) {
      // the thumbnail is the first example AS IT IS - a video / animated picture moves on the card (2.581.0)
      try { for (const f of fs.readdirSync(d)) if (/^thumb\./.test(f)) fs.unlinkSync(path.join(d, f)); } catch { /* fine */ }
      try { const ext = path.extname(thumb); fs.copyFileSync(path.join(d, thumb), path.join(d, "thumb" + ext)); thumb = "thumb" + ext; } catch { /* the first example is the thumb */ }
    }
    // examples of an earlier fetch that this one did not write again (fewer this time) go
    try { const keep = new Set(kept.map((k) => k.file)); for (const f of fs.readdirSync(d)) if (/^ex\d+\./.test(f) && !keep.has(f)) fs.unlinkSync(path.join(d, f)); } catch { /* fine */ }
    const info = { v: 1, media_v: MEDIA_V, file: card.file, size: card.size, cat: card.cat, status: "found", match: match.how, query, fetched_at: Date.now(), ...(sha ? { sha256: sha } : {}),
      civitai: cv.slim(ver, model), examples: kept, thumb,
      url: ver.modelId ? `https://civitai.com/models/${ver.modelId}?modelVersionId=${ver.id}` : "" };
    fs.writeFileSync(path.join(d, "info.json"), JSON.stringify(info, null, 2));
    return "found";
  } catch (e) {
    note(`${card.file}: ${e.message || e}`);
    if (e.status === 401) Q.stop = true;          // no key / a refused key: the rest would fail the same way
    return "failed";
  }
}
async function pump() {
  if (Q.running) return;
  Q.running = true;
  try {
    while (Q.list.length && !Q.stop) {
      const card = Q.list.shift();
      Q.current = card.file;
      const r = await fetchOne(card);
      Q.done++; Q[r === "found" ? "found" : r === "nomatch" ? "nomatch" : "failed"]++;
      if (r === "found") note(`✓ ${card.file}`);
      try { require("./modelCards").invalidate(); } catch { /* fine */ }
    }
  } finally {
    Q.running = false; Q.current = ""; Q.list = [];
    try { require("./testPlan").event("model_info", { what: `${Q.found} found / ${Q.nomatch} no match` }); } catch { /* the 🧪 checklist */ }
  }
}
/** should this card be asked (again)? (pure) - none yet / a stale "no match" / forced; 🔄 Sync also: Civitai named it
 *  but the details are not a match yet, a "no match" by name only (asked by SHA-256), and (2.581.0) details kept before
 *  videos + animated pictures were (media_v < MEDIA_V - asked by its version id again) */
function wants(c, i, o, now) {
  if (o.force || !i || isStale(i, now)) return true;
  if (!o.sync) return false;
  return !!((c.civitai && c.civitai.version_id && i.status !== "found") || (i.status === "nomatch" && !i.hashed)
    || (i.status === "found" && (+i.media_v || 1) < MEDIA_V && i.civitai && i.civitai.id));
}
/** queue cards for fetching: {keys: [...]} or {all: true, kind: "model"|"lora"|"", sync}; force = fetch again */
function fetch(opts) {
  const o = opts || {}, cards = require("./modelCards");
  const d = cards.list();
  let pool = d.models.concat(d.loras);
  if (Array.isArray(o.keys) && o.keys.length) { const set = new Set(o.keys.map(String)); pool = pool.filter((c) => set.has(c.key)); }
  else if (!o.all) return { error: "which models? (keys or all)" };
  if (o.kind) pool = pool.filter((c) => c.kind === o.kind);
  const now = Date.now();
  // 2.538.0 sync (🔄 Sync): every model on this computer - the ones with none yet / stale, + the ones Civitai already
  // named (a version id) whose saved details are not a match yet (the exact ask finds them)
  const todo = pool.filter((c) => wants(c, infoFor(c), o, now));   // 2.576.0 🔄 Sync: a "no match" by name only - asked again by its SHA-256
  if (!Q.running) Object.assign(Q, { done: 0, found: 0, nomatch: 0, failed: 0, total: 0, stop: false, log: [] });
  const have = new Set(Q.list.map((c) => c.key));
  for (const c of todo) if (!have.has(c.key)) Q.list.push(c);
  Q.total = Q.done + Q.list.length;
  pump();
  if (o.sync) { try { require("./testPlan").event("model_sync", { what: `${todo.length} queued` }); } catch { /* the 🧪 checklist */ } }
  return { ok: true, queued: todo.length, skipped: pool.length - todo.length, status: status() };
}
function stop() { Q.stop = true; Q.list = []; return status(); }
function status() { return { running: Q.running, current: Q.current, done: Q.done, total: Q.total, found: Q.found, nomatch: Q.nomatch, failed: Q.failed, left: Q.list.length, log: Q.log.slice(-8),
  hashing: Q.hash ? { file: Q.hash.file, got: Q.hash.got, total: Q.hash.total } : null }; }   // 2.576.0: reading a file's SHA-256
let hashFn = null;                                            // tests: a stand-in for civitai.sha256
function setHashFn(f) { hashFn = typeof f === "function" ? f : null; }

/** the full details of one card (the info page) */
function details(key) {
  const cards = require("./modelCards");
  const h = cards.find(key); if (!h) return null;
  const i = infoFor(h.card);
  const ver = (i && i.civitai) || null;
  return { card: h.card, status: i ? i.status : "", match: i ? i.match || "" : "", fetched_at: i ? i.fetched_at || null : null, url: (i && i.url) || ((h.card.civitai || {}).url || ""),
    version: ver ? { name: ver.name || "", base_model: ver.baseModel || "", released: String(ver.publishedAt || "").slice(0, 10), trained_words: ver.trainedWords || [],
      model_name: (ver.model || {}).name || "", model_type: (ver.model || {}).type || "", description: cards.textOf((ver.model || {}).description || ver.description || "") } : null,
    examples: ((i && i.examples) || []).map((e, n) => ({ n, width: e.width, height: e.height, media: e.file ? kindOfFile(e.file) : "image", meta: e.meta || {} })),
    folder: path.relative(core().BASE, dirFor(h.card)).split(path.sep).join("/") };
}

module.exports = { setHashFn, MAX_EX, MEDIA_V, mediaOf, extFor, kindOfFile, wants, cleanQuery, matchVersion, examplesOf, dirName, isStale, root, dirFor, readInfo, infoFor, thumbPath, examplePath, fetchOne, fetch, stop, status, details };

/* bitGen Studio — lib/remoteHosts.js (2.785.0): ONE "RUNS ON" CHOICE PER TYPE OF WORK (routes/gpuSplit.js GET / POST
 * /api/remotehosts; static/remotehosts.js draws it at the top of the 🖥 GPU docker).
 *
 * Tim (verbatim): "remove the radiogroups from remote generation docker, replace them with a dropdown, local, runpod,
 * openrouter,LAN,Team (gray out lan and team for now , until we get them working) for each type. show the pods button in
 * statusbar only if one of the selections is runpod" + "go"
 *   KINDS   image, video, music, tts, stt, stems (lib/gpuSplit.js TYPES - per type, split.per) + llm, vlm (lib/podLlm.js
 *           llm_where - local | openrouter | runpod)
 *   HOSTS   local · runpod · openrouter · lan · team. LAN and Team are greyed (not working yet). OpenRouter makes pictures and
 *           video (2.786.0 - its Image and Video APIs, paid; rgpu.openrouter.runs, lib/orRender.js) and runs the LLM / Vision
 *           LLM; speech / transcripts / song separation do not run there in bitGen.
 *   hostsOf(r, split, engine, llmHost)  -> {kind: host} what each kind runs on now (pure; the old Remote = RunPod when the
 *           engine is RunPod, another computer / SSH tunnel = LAN)
 *   whereFor(hosts) -> "local" (nothing remote) | "both" (some or all remote - the per-type choices decide; lib/gpuSplit decide
 *           and onRemote honour split.per)
 *   set(kind | "all", host) saves it: render kinds through lib/gpuSplit.js set({per, kind, where, engine}), the LLMs through
 *           lib/podLlm.js setWhere; -> view()
 * Pure (scripts/test-remotehosts785.js): KINDS, HOSTS, optionsFor, hostsOf, whereFor, anyRunpod.
 * 2.791.0 (the agreed design's D, local multi-GPU): with 2+ graphics cards, Image / Video / Music also offer "Local - <card>"
 *   (host id "local:<N>" - lib/gpuCards.js: that card's own ComfyUI); rgpu.local_cards keeps the pick; plain Local as before.
 */
"use strict";
const RENDER = ["image", "video", "music", "tts", "stt", "stems"];
const LLMS = ["llm", "vlm"];
const KINDS = [["image", "Image"], ["video", "Video"], ["music", "Music"], ["tts", "Text to speech"], ["stt", "Speech to text"], ["stems", "Song separation"], ["llm", "LLM"], ["vlm", "Vision LLM"]];
const HOSTS = [["local", "Local"], ["runpod", "RunPod"], ["openrouter", "OpenRouter"], ["lan", "LAN"], ["team", "Team"]];
/** the choices of one kind (pure) -> [{id, label, off, why}] */
function optionsFor(kind, cards) {
  const out = HOSTS.map(([id, label]) => {
    let why = "";
    if (id === "lan" || id === "team") why = "not working yet - coming later";
    else if (id === "openrouter" && !LLMS.includes(kind) && kind !== "image" && kind !== "video") why = "OpenRouter does not run this in bitGen";
    return { id, label, off: !!why, why };
  });
  out.splice(1, 0, ...cardList(kind, cards));   // 2.791.0: "Local - <card>" right after plain Local
  return out;
}
function cardList(kind, cards) {
  // 2.794.0: every kind - the LLMs and speech too (lib/cardUse.js); only image / video / music get a ComfyUI of their own
  if (!KINDS.some((x) => x[0] === kind) || !Array.isArray(cards) || cards.length < 2) return [];
  const GC = require("./gpuCards");
  return cards.map((c) => ({ id: "local:" + c.index, label: GC.labelOf(c), off: false, why: "", card: c.index }));
}
/** what each kind runs on now (pure): split = gpuSplit.split(), engine = gpuSplit.engineOf(rgpu), llmHost(kind) = "" | runpod | openrouter */
function hostsOf(r, split, engine, llmHost, orRuns) {
  const s = split || {}, e = engine || {}, mode = String((r || {}).mode || "");
  const remoteOf = () => (mode === "remote" || mode === "ssh") ? "lan" : "runpod";
  const on = require("./gpuSplit").onRemote, out = {};
  void e;
  for (const k of RENDER) out[k] = s.where && s.where !== "local" && on(s, k) ? remoteOf() : "local";
  // 2.786.0: pictures / video on OpenRouter (rgpu.openrouter.runs - lib/orRender.js)
  for (const k of ["image", "video"]) if (orRuns && orRuns[k]) out[k] = "openrouter";
  for (const k of LLMS) { const h = typeof llmHost === "function" ? llmHost(k) : ""; out[k] = h === "runpod" || h === "openrouter" ? h : "local"; }
  // 2.791.0: a card of its own (rgpu.local_cards) - "local:<N>"
  const lc = (r && r.local_cards) || {};
  for (const [k] of KINDS) if (out[k] === "local" && Number.isInteger(lc[k]) && lc[k] >= 0) out[k] = "local:" + lc[k];   // 2.794.0: every kind
  return out;
}
/** split.where from the choices (pure) */
function whereFor(hosts) { return Object.values(hosts || {}).some((h) => h && !/^local(:\d+)?$/.test(h)) ? "both" : "local"; }   // 2.791.0: a card is local
/** does any kind run on RunPod? (pure) - the status bar's Pods button */
function anyRunpod(hosts) { return Object.values(hosts || {}).some((h) => h === "runpod"); }

/* ---------------- live */
const core = () => require("./core");
const rg = () => ((core().getConfig() || {}).rgpu) || {};
function now() {
  const G = require("./gpuSplit"), r = rg();
  return hostsOf(r, G.split(), G.engineOf(r), (k) => require("./remoteLlm").hostOf(r, k), require("./orRender").runs());
}
/** 2.786.0: the line under an Image / Video row on OpenRouter - the model it uses and its price */
function orNote(kind) {
  try {
    const m = require("./orRender").modelFor(kind, "");
    if (!m) return "";
    if (m.error) return "✗ your OpenRouter " + (kind === "image" ? "picture" : "video") + " models list is empty - ☁ OpenRouter models…";
    return m.entry.name + " · " + (m.entry.price || "paid") + " - another: Basic Settings ▸ Model (openrouter/…)";
  } catch { return ""; }
}
/** 2.795.0: the LLM / Vision row's line while a 🧩 Model manager source's model is picked */
function srcNote(kind) { try { const u = require("./apiSources").mine().use[kind]; if (!u) return ""; const s = require("./apiSources").list().sources.find((x) => x.id === u.source); return s ? "🔌 " + s.name + "/" + u.model + " - a 🧩 Model manager source, picked in the prompt docker's list" : ""; } catch { return ""; } }
function view() {
  const hosts = now(), GC = require("./gpuCards"), cards = GC.cached();
  GC.list().catch(() => null);   // 2.791.0: the cards, read again now and then (nvidia-smi)
  return { hosts, where: whereFor(hosts), any_runpod: anyRunpod(hosts), cards, kinds: KINDS.map(([k, label]) => ({ k, label, host: hosts[k], options: optionsFor(k, cards), note: (k === "llm" || k === "vlm") && srcNote(k) ? srcNote(k) : /^local:\d+$/.test(hosts[k]) ? cardNote(k, hosts[k]) : hosts[k] === "openrouter" && (k === "image" || k === "video") ? orNote(k) : "" })) };
}
/** 2.791.0: the line under a row on a card of its own */
function cardNote(kind, host) {
  const n = +host.split(":")[1], st = require("./gpuCards").status()[n];
  // 2.794.0: the LLMs and speech run their own program on the card
  if (kind === "llm" || kind === "vlm") return "llama.cpp on GPU " + n + " - as many layers as its free memory holds" + (require("./cardUse").offloadNow() ? ", the rest in RAM" : " (Offload is off: a model that does not fit is refused)");
  if (["tts", "stt", "stems"].includes(kind)) return "runs on GPU " + n + " (the card is all its program sees)";
  // 2.805.0: a launcher that cannot start a card's ComfyUI is said as soon as the card is picked (not at the first render)
  if (!st) { const why = require("./gpuCards").launchProblem(n); if (why) return "⚠ " + why; }
  return "its own ComfyUI on port " + require("./gpuCards").portFor(n) + " - " + (st ? st.note : "started with the first " + (kind === "music" ? "song" : kind) + " render") + "; a model used here and on another card is loaded on each";
}
function bad(m) { const e = new Error(m); e.status = 400; return e; }
/** save one kind's choice (or "all") -> view() */
function set(kind, host) {
  const kinds = kind === "all" ? KINDS.map((x) => x[0]) : [kind];
  if (!KINDS.some((x) => x[0] === kinds[0])) throw bad("unknown kind " + kind);
  const want = {};
  const cards = require("./gpuCards").cached(), picks = {};
  for (const k of kinds) {
    const o = optionsFor(k, cards).find((x) => x.id === host);
    if (!o && /^local:\d+$/.test(host) && kind === "all") continue;   // a card only for ComfyUI's kinds
    if (!o) throw bad("unknown host " + host);
    if (o.off) { if (kind === "all") continue; throw bad(o.label + " - " + o.why); }
    // 2.791.0: "local:<N>" = Local + that card (lib/gpuCards.js); any other choice forgets the kind's card
    if (/^local:\d+$/.test(host)) { picks[k] = +host.split(":")[1]; want[k] = "local"; }
    else { picks[k] = null; want[k] = host; }
  }
  const GC = require("./gpuCards");
  for (const k of Object.keys(picks)) GC.setPick(k, picks[k]);
  const hosts = Object.assign(now(), want);
  const G = require("./gpuSplit"), b = { per: true, where: whereFor(hosts) };
  for (const k of RENDER) b[k] = hosts[k] === "runpod";
  if (RENDER.some((k) => want[k] === "runpod")) b.engine = { provider: "runpod" };
  const ll = {}; for (const k of LLMS) if (k in want) { ll[k] = want[k]; require("./apiSources").clearUse(k); }   // 2.795.0: a Runs on choice ends a source pick
  if (Object.keys(ll).length) require("./podLlm").setWhere(ll);
  G.set(b);
  require("./orRender").setRuns({ image: hosts.image === "openrouter", video: hosts.video === "openrouter" });   // 2.786.0
  return view();
}
module.exports = { KINDS, HOSTS, RENDER, LLMS, optionsFor, hostsOf, whereFor, anyRunpod, now, view, set };

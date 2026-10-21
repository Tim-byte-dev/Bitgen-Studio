// bitGen Studio — lib/voiceAgent.js (2.564.0): what the 🎙 voice chat's words DO - the LLM's turn as {say, actions}.
//
// Tim: "i think we just use a mic to talk to the app instead to ask for prompt, change style, create..." - and for the
// trigger: "can it be like live chat". A live conversation: you speak, the app hears (lib/asrLive.js), the local LLM
// answers in one JSON object - what to SAY back (spoken by the page) and the ACTIONS to take in the app (the page runs
// them: static/voicechat.js) - then it listens again.
//   ACTIONS             the catalogue the LLM may use, each {do, ...params}
//   messages(o)         the LLM's request: o = {text, history: [{role, content}], state: the page's snapshot}
//   parse(reply)        the LLM's answer -> {say, actions, dropped: [why]} - never throws (a plain answer = say only)
//   clean(action)       one action checked against the catalogue -> the action or null
"use strict";

const SETTINGS = ["steps", "cfg", "seconds", "seed", "resolution", "aspect", "format", "override"];
const DOCKERS = ["prompt", "preview", "timeline", "storyboard", "music", "stems", "sfx", "image editor", "comfyui", "chat",
                 "console", "settings", "references", "assets", "queue", "gallery", "basic settings", "llm tokens", "negative"];
const ACTIONS = {
  set_prompt: { text: "string", about: "replace the prompt (write a complete, vivid prompt when asked to write or improve one)" },
  add_to_prompt: { text: "string", about: "add words to the end of the prompt" },
  clear_prompt: { about: "empty the prompt" },
  set_negative: { text: "string", about: "the negative prompt (what to avoid)" },
  set_generate: { what: ["video", "image", "music", "speech", "chat"], about: "what the Generate button makes" },
  set_video_mode: { mode: ["ref", "fl", "text", "swap"], about: "the video mode: ref = reference pictures, fl = first/last frame, text = text only, swap = character swap" },
  set_style: { kind: ["image", "video"], name: "string", about: "pick an image / video style by (part of) its name" },
  set_setting: { name: SETTINGS, value: "string", about: "a Basic Settings value (resolution 480/540/720/1080, aspect like 16:9, seconds, steps, cfg, seed -1 = random, format mp4/webm, override on/off)" },
  generate: { about: "press Generate (what it makes = set_generate)" },
  generate_image: { about: "make a still image from the prompt now" },
  cancel_job: { about: "stop the job that is running" },
  add_scene: { text: "string", about: "add a scene to the StoryBoard with this description" },
  render_scene: { n: "number", about: "render StoryBoard scene n" },
  show: { docker: DOCKERS, about: "show a docker / panel" },
  stop_listening: { about: "end the voice chat (the user said goodbye / stop listening)" },
};
const MAX_SAY = 600, MAX_TEXT = 2000, MAX_ACTIONS = 8;

/** one action checked against the catalogue (enum values loosely: "Video" -> "video") */
function clean(a) {
  if (!a || typeof a !== "object") return null;
  const name = String(a.do || a.action || a.type || "").trim().toLowerCase();
  const spec = ACTIONS[name]; if (!spec) return null;
  const out = { do: name };
  for (const [k, t] of Object.entries(spec)) {
    if (k === "about") continue;
    let v = a[k];
    if (v == null && a.args && typeof a.args === "object") v = a.args[k];
    if (v == null) return null;
    if (Array.isArray(t)) { const s = String(v).trim().toLowerCase(); const hit = t.find((x) => x === s) || t.find((x) => s.startsWith(x) || x.startsWith(s)); if (!hit) return null; out[k] = hit; }
    else if (t === "number") { const n = parseInt(v, 10); if (!Number.isFinite(n) || n < 1) return null; out[k] = n; }
    else { const s = String(v).trim(); if (!s) return null; out[k] = s.slice(0, MAX_TEXT); }
  }
  return out;
}

/** the first balanced {...} in a text (a model may wrap its JSON in words or a code fence) */
function firstObject(s) {
  const t = String(s || "");
  for (let i = t.indexOf("{"); i >= 0; i = t.indexOf("{", i + 1)) {
    let depth = 0, str = false, esc = false;
    for (let j = i; j < t.length; j++) {
      const c = t[j];
      if (str) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') str = false; continue; }
      if (c === '"') str = true; else if (c === "{") depth++; else if (c === "}" && --depth === 0) {
        const chunk = t.slice(i, j + 1);
        try { return JSON.parse(chunk); } catch { /* a local model's trailing commas */ }
        try { return JSON.parse(chunk.replace(/,\s*([}\]])/g, "$1")); } catch { break; }
      }
    }
  }
  return null;
}

function parse(reply) {
  const raw = String(reply || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const j = firstObject(raw);
  if (!j || typeof j !== "object") return { say: raw.replace(/```[a-z]*|```/gi, "").trim().slice(0, MAX_SAY), actions: [], dropped: [] };
  const acts = Array.isArray(j.actions) ? j.actions : j.action ? [j.action] : [];
  const actions = [], dropped = [];
  for (const a of acts.slice(0, MAX_ACTIONS)) { const c = clean(a); if (c) actions.push(c); else dropped.push(JSON.stringify(a).slice(0, 120)); }
  const say = String(j.say || j.reply || j.answer || "").trim().slice(0, MAX_SAY);
  return { say, actions, dropped };
}

function catalogue() {
  return Object.entries(ACTIONS).map(([k, v]) => {
    const ps = Object.entries(v).filter(([p]) => p !== "about").map(([p, t]) => `"${p}": ${Array.isArray(t) ? t.map((x) => JSON.stringify(x)).join("|") : t}`);
    return `- {"do": "${k}"${ps.length ? ", " + ps.join(", ") : ""}}  ${v.about}`;
  }).join("\n");
}

/** the page's snapshot in a few lines */
function stateLines(s) {
  const x = s || {}, L = [];
  const list = (a) => (Array.isArray(a) ? a.slice(0, 40).map(String).join(" | ") : "");
  if (x.prompt != null) L.push(`Prompt now: ${String(x.prompt).slice(0, 700) || "(empty)"}`);
  if (x.negative) L.push(`Negative prompt: ${String(x.negative).slice(0, 200)}`);
  if (x.generate) L.push(`Generate makes: ${x.generate}`);
  if (x.video_mode) L.push(`Video mode: ${x.video_mode}`);
  if (x.video_style || x.video_styles) L.push(`Video style: ${x.video_style || "(none)"} - available: ${list(x.video_styles)}`);
  if (x.image_style || x.image_styles) L.push(`Image style: ${x.image_style || "(none)"} - available: ${list(x.image_styles)}`);
  if (x.settings && typeof x.settings === "object") L.push("Basic Settings: " + Object.entries(x.settings).map(([k, v]) => `${k} ${v}`).join(", "));
  if (Number.isFinite(+x.scenes)) L.push(`StoryBoard scenes: ${+x.scenes}`);
  if (x.job) L.push(`Running job: ${String(x.job).slice(0, 160)}`);
  return L.join("\n");
}

function messages(o) {
  const x = o || {};
  const sys = "You are the voice of bitGen Studio, a local AI video / image / music studio. The user TALKS to you; your "
    + "answer is spoken aloud, so keep \"say\" short and natural (one or two sentences, no lists, no markdown, no emoji). "
    + "You can change the app with actions. Answer with ONE JSON object and nothing else:\n"
    + '{"say": "what you say back", "actions": [ ... ]}\n'
    + "Actions you may use (only these, only when the user asks for them; none = []):\n" + catalogue() + "\n"
    + "Rules: when the user asks for a prompt, write a complete, vivid one (subject, action, setting, camera, light, sound) "
    + "and put it in set_prompt - say only a short summary of it. Pick style names from the available lists. Press generate "
    + "only when the user asks to make / create / render / generate. If something is unclear, ask in \"say\" and take no action.";
  const hist = (Array.isArray(x.history) ? x.history : []).filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 1200) }));
  const st = stateLines(x.state);
  return [{ role: "system", content: sys }].concat(hist,
    [{ role: "user", content: (st ? "[the app now]\n" + st + "\n\n" : "") + "[the user said] " + String(x.text || "").slice(0, 2000) }]);
}

module.exports = { ACTIONS, SETTINGS, DOCKERS, clean, parse, messages, catalogue, stateLines, firstObject };

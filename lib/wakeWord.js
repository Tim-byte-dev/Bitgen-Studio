// bitGen Studio — lib/wakeWord.js (2.927.0): 👂 "HI GEMMA" - THE 📱 APP WAKES ON ITS NAME.
//
// Tim: "can we make the chat with the phone more realistic" -> "when the app is running it is listening for keywords like Hi
// Gemma. the desktop app can give it a name in general settings".
// The name lives here (config.app_voice {name, wake}); Settings ▸ General ▸ 🗣 The assistant sets it, the app reads it from
// /api/app/info. While the app is open it sends each short burst of speech it hears (0.3-6 s, never through the relay) to
// POST /api/app/wake (routes/appVoice.js): the kept-up Whisper (lib/asrLive.js, told the name so it spells it right) hears
// it and match() says whether it was the name being called - then the app answers and the conversation starts; anything
// said after the name ("Hi Gemma, what's the time in Sydney?") is the first question. The LLM is told its name too
// (lib/appVoice.js note()).
//   settings() -> {name, wake}      setSettings({name, wake}) -> settings
//   match(text, name) -> {wake, rest}            pure: "hi / hey / hello / ok / okay … <name> …", or the name first
//   sound(word)                                  pure: a rough sound-key (j = g, k = c, ph = f, doubles one) - "Jemma" = "Gemma"
"use strict";
const DEF = { name: "Gemma", wake: true };
const GREET = new Set(["hi", "hey", "hello", "ok", "okay", "yo", "oi", "hiya", "heya", "morning", "evening", "afternoon", "good", "g'day", "gday", "hallo", "ola", "hola"]);

function core() { return require("./core"); }
function clean(name) { return String(name == null ? "" : name).replace(/[^\p{L}\p{N} '-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 30); }
function settings() {
  const v = Object.assign({}, DEF, (core().getConfig() || {}).app_voice || {});
  return { name: clean(v.name) || DEF.name, wake: v.wake !== false };
}
function setSettings(b) {
  const c = core().getConfig(), v = Object.assign({}, c.app_voice || {});
  if (b && b.name != null) { const n = clean(b.name); if (n) v.name = n; }
  if (b && b.wake != null) v.wake = b.wake === true || b.wake === "1" || b.wake === "true";
  c.app_voice = v; core().setConfig(c);
  return settings();
}

/** a rough sound-key, so Whisper's "Jemma", "Gema" or "Gemmah" still is "Gemma" */
function sound(w) {
  let s = String(w || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  s = s.replace(/ph/g, "f").replace(/ck/g, "k").replace(/q/g, "k").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k")
    .replace(/j/g, "g").replace(/z/g, "s").replace(/x/g, "ks").replace(/w(?=[^aeiou]|$)/g, "").replace(/([^aeiou])h/g, "$1")
    .replace(/(.)\1+/g, "$1").replace(/h$/, "").replace(/y$/, "i");
  return s;
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function like(heard, name) {
  const a = sound(heard), b = sound(name);
  if (!a || !b) return false;
  if (a === b) return true;
  const slack = b.length >= 7 ? 2 : b.length >= 4 ? 1 : 0;   // "Gemma" (gema) allows one sound off - "Jemma", "Gema", "Emma"
  return lev(a, b) <= slack;
}
/** was the name called? "Hi Gemma", "Hey Gemma, what's the weather", "Gemma what time is it" -> {wake, rest} */
function match(text, name) {
  const t = String(text || "").trim(), nm = clean(name || settings().name);
  if (!t || !nm) return { wake: false, rest: "" };
  const words = t.split(/\s+/), plain = words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""));
  const k = nm.split(" ").length;
  for (let i = 0; i + k <= words.length && i <= 3; i++) {
    const cand = plain.slice(i, i + k).join("");
    if (!cand || !like(cand, nm.replace(/ /g, ""))) continue;
    const before = plain.slice(0, i).filter(Boolean);
    if (before.length && !before.every((w) => GREET.has(w))) continue;               // only greetings before the name
    if (!before.length && sound(cand) !== sound(nm)) continue;                       // no "hi": the name itself, said clearly
                                                                                      // (a TV's "Emma went…" is not "Gemma")
    const rest = words.slice(i + k).join(" ").replace(/^[\s,.!?:;-]+/, "").trim();
    return { wake: true, rest, greeted: before.length > 0 };
  }
  return { wake: false, rest: "" };
}
module.exports = { DEF, settings, setSettings, match, sound, like, clean };

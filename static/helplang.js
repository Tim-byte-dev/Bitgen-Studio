/* bitGen Studio — static/helplang.js (2.703.0): THE LANGUAGE OF THE GUIDE AND HELP (window.H3HelpLang).
 * Tim: "is it possible to translate help and the user guide into chinese and japanese as additional help files?"
 * English, Simplified Chinese (mainland China), Traditional Chinese (Taiwan / Hong Kong - 2.704.0) and Japanese. The app's own buttons stay English - only the guide (📖 Help,
 * Ctrl+K's guide entries), the ❔ help pages and the shortcut list change. The files: lib/helpI18n.js.
 *   LANGS            [{id, native}]
 *   get()            the picked language: kept in localStorage "bg.helpLang", else the system's (zh-CN / zh-SG / zh-Hans /
 *                    zh -> zh-CN, zh-TW / zh-HK / zh-MO / zh-Hant -> zh-TW, ja -> ja), else "en"
 *   set(id)          keeps it, tells every listener
 *   onChange(fn)
 *   say(key[, id])   the notes in that language: stale (English is newer), missing (not translated yet), english (button)
 *   picker(cls)      a <select> of the languages that follows get() / set()
 *   fromSystem(navLangs[, packs])  (pure) the default for a list like navigator.languages - each pack's "browser" tags,
 *                    the longest match wins (zh-Hant-TW -> zh-hant -> zh-TW; zh -> zh-CN)
 * 2.715.0 (Tim: "make the languages into language packs, so we can add a new language easily later"): the languages are
 *   LANGUAGE PACKS (lib/langPacks.js - built in, or installed in Settings ▸ Languages). The list comes from /api/langpacks
 *   (kept in localStorage "bg.langPacks" so an installed language is there before the server answers); the four below are
 *   only what the page knows before the first answer.
 *   setPacks(list)   the packs (from the server): LANGS / WORDS refilled, every picker refilled, onPacks listeners told
 *   onPacks(fn)      refresh(): ask the server again (after an install / remove)
 */
(function (root) {
  "use strict";
  var LANGS = [{ id: "en", native: "English" }, { id: "zh-CN", native: "简体中文" }, { id: "zh-TW", native: "繁體中文" }, { id: "ja", native: "日本語" }];
  var WORDS = {
    en: { stale: "", missing: "", english: "English", lang: "Language of the guide and help" },
    "zh-CN": { stale: "这一部分的英文版已更新，以下译文可能已过时。", missing: "这一部分尚未翻译，以下为英文原文。", english: "查看英文版", lang: "指南与帮助的语言" },
    "zh-TW": { stale: "這一部分的英文版已更新，以下譯文可能已過時。", missing: "這一部分尚未翻譯，以下為英文原文。", english: "檢視英文版", lang: "指南與說明的語言" },
    ja: { stale: "このセクションは英語版のほうが新しいため、翻訳が古くなっている可能性があります。", missing: "このセクションはまだ翻訳されていません。英語の原文を表示しています。", english: "英語版を表示", lang: "ガイドとヘルプの言語" },
  };
  var BROWSER = { "zh-CN": ["zh-cn", "zh-sg", "zh-hans", "zh"], "zh-TW": ["zh-tw", "zh-hk", "zh-mo", "zh-hant"], ja: ["ja"] };
  var PACKS = LANGS.slice(1).map(function (l) { return { id: l.id, native: l.native, browser: BROWSER[l.id], keepAll: true }; });
  var ok = function (id) { return LANGS.some(function (l) { return l.id === id; }); };
  /** the system's languages -> a pack: for each in order, the pack with the longest tag that is it or starts it */
  function fromSystem(list, packs) {
    var P = packs || PACKS, a = (list || []).map(function (x) { return String(x || "").toLowerCase().replace(/_/g, "-"); });
    for (var i = 0; i < a.length; i++) {
      var l = a[i], best = null, len = 0;
      if (/^en($|-)/.test(l)) return "en";
      for (var j = 0; j < P.length; j++) {
        var tags = P[j].browser || [String(P[j].id).toLowerCase()];
        for (var k = 0; k < tags.length; k++) {
          var t = String(tags[k]).toLowerCase();
          if ((l === t || l.indexOf(t + "-") === 0) && t.length > len) { best = P[j].id; len = t.length; }
        }
      }
      if (best) return best;
    }
    return "en";
  }
  var subs = [], psubs = [];
  /** 2.715.0: the packs from the server -> LANGS, WORDS, the pickers */
  function setPacks(list) {
    if (!Array.isArray(list)) return;
    var before = get();
    PACKS = list.filter(function (p) { return p && typeof p.id === "string" && p.id !== "en"; });
    LANGS.length = 0; LANGS.push({ id: "en", native: "English" });
    PACKS.forEach(function (p) {
      LANGS.push({ id: p.id, native: String(p.native || p.id) });
      var w = p.words || {}, base = WORDS[p.id] || {};
      WORDS[p.id] = { stale: w.stale || base.stale || WORDS.en.stale, missing: w.missing || base.missing || "", english: w.english || base.english || "English", lang: w.lang || base.lang || WORDS.en.lang };
    });
    try { root.localStorage.setItem("bg.langPacks", JSON.stringify(PACKS)); } catch (e) { /* kept for this page only */ }
    psubs.slice().forEach(function (f) { try { f(PACKS); } catch (e) { /* a listener's own problem */ } });
    var now = get();
    if (now !== before) subs.slice().forEach(function (f) { try { f(now); } catch (e) { /* a listener's own problem */ } });
  }
  function onPacks(fn) { psubs.push(fn); }
  function refresh() {
    if (typeof root.fetch !== "function") return Promise.resolve(PACKS);
    return root.fetch("/api/langpacks", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("no packs"); return r.json(); })
      .then(function (j) { setPacks(j.packs); return PACKS; }).catch(function () { return PACKS; });
  }
  function get() {
    var v = null;
    try { v = root.localStorage && root.localStorage.getItem("bg.helpLang"); } catch (e) { v = null; }
    if (ok(v)) return v;
    var nav = root.navigator || {};
    return fromSystem(nav.languages && nav.languages.length ? nav.languages : [nav.language], PACKS);
  }
  function set(id) {
    if (!ok(id)) return;
    try { root.localStorage.setItem("bg.helpLang", id); } catch (e) { /* kept for this page only */ }
    subs.slice().forEach(function (f) { try { f(id); } catch (e) { /* a listener's own problem */ } });
  }
  function onChange(fn) { subs.push(fn); }
  function say(key, id) { var w = WORDS[id || get()] || WORDS.en; return w[key] != null ? w[key] : WORDS.en[key]; }
  function picker(cls) {
    var s = root.document.createElement("select"); s.className = cls || "hlplang"; s.setAttribute("aria-label", "Language of the guide and help");
    var fill = function () {                    // 2.715.0: from the packs (a pack's name is text, never markup)
      while (s.firstChild) s.removeChild(s.firstChild);
      LANGS.forEach(function (l) { var o = root.document.createElement("option"); o.value = l.id; o.textContent = l.native; o.lang = l.id; s.appendChild(o); });
      s.value = get(); s.title = say("lang");
    };
    fill();
    s.onchange = function () { set(s.value); };
    onChange(function (id) { if (s.value !== id) s.value = id; s.title = say("lang"); });
    onPacks(fill);
    return s;
  }
  var api = { LANGS: LANGS, WORDS: WORDS, get: get, set: set, onChange: onChange, say: say, picker: picker, fromSystem: fromSystem,
    setPacks: setPacks, onPacks: onPacks, refresh: refresh, packs: function () { return PACKS; } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    root.H3HelpLang = api;
    try { var kept = JSON.parse(root.localStorage.getItem("bg.langPacks") || "null"); if (Array.isArray(kept) && kept.length) setPacks(kept); } catch (e) { /* none kept */ }
    refresh();
  }
})(typeof window !== "undefined" ? window : globalThis);

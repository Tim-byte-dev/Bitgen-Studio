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
 *   fromSystem(navLangs)  (pure) the default for a list like navigator.languages
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
  var ok = function (id) { return LANGS.some(function (l) { return l.id === id; }); };
  function fromSystem(list) {
    var a = (list || []).map(function (x) { return String(x || "").toLowerCase(); });
    for (var i = 0; i < a.length; i++) {
      var l = a[i];
      if (/^ja\b/.test(l)) return "ja";
      if (/^zh-(hant|tw|hk|mo)/.test(l)) return "zh-TW";               // 2.704.0: Traditional (Taiwan / Hong Kong / Macau)
      if (/^zh(-hans|-cn|-sg)?($|-)/.test(l)) return "zh-CN";
      if (/^en\b/.test(l)) return "en";
    }
    return "en";
  }
  var subs = [];
  function get() {
    var v = null;
    try { v = root.localStorage && root.localStorage.getItem("bg.helpLang"); } catch (e) { v = null; }
    if (ok(v)) return v;
    var nav = root.navigator || {};
    return fromSystem(nav.languages && nav.languages.length ? nav.languages : [nav.language]);
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
    s.innerHTML = LANGS.map(function (l) { return '<option value="' + l.id + '">' + l.native + "</option>"; }).join("");
    s.value = get(); s.title = say("lang");
    s.onchange = function () { set(s.value); };
    onChange(function (id) { if (s.value !== id) s.value = id; s.title = say("lang"); });
    return s;
  }
  var api = { LANGS: LANGS, WORDS: WORDS, get: get, set: set, onChange: onChange, say: say, picker: picker, fromSystem: fromSystem };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3HelpLang = api;
})(typeof window !== "undefined" ? window : globalThis);

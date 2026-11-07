/* bitGen Studio — static/uilang.js (2.705.0): THE APP'S OWN WORDS IN ANOTHER LANGUAGE (window.H3UiLang).
 *
 * Tim (verbatim): "is it possible to add a language dropdown to the left of docker layout and change the language of the ui
 * on change?" - then: the main window first (the image editor, timeline, Sketcher and CAD dockers later), ONE language
 * setting with the guide (static/helplang.js - the 📖 Help / ❔ pickers and this dropdown are the same setting), and the
 * guides name the buttons as the UI now shows them (lib/helpI18n.js uiNames).
 *
 * How: the app is not rewritten. Its words are swapped AS THEY APPEAR, from a dictionary per language
 * (static/i18n/ui/<lang>.json {strings: {"English": "translation"}} - made from scripts/ui-strings.js, which collects every
 * word of the running main window). A text node / a title, placeholder or aria-label whose words are in the dictionary shows
 * the translation; anything else stays English. The icons and symbols round the words are kept ("💾 Save" -> "💾 保存",
 * "Steps:" -> "步数:"). The app's code still writes English; a MutationObserver translates what it writes, before it is
 * painted. Back to English puts every original back (nothing is reloaded).
 *   split(s)            (pure) {pre, core, post} - the words between their leading / trailing symbols, spaces collapsed
 *   tr(s, dict)         (pure) s translated (its pre / post kept), or null
 *   NOT TRANSLATED      SKIP: the editors' dockers (this release), the guide's own text, code / pre / kbd, inputs' values,
 *                       contenteditable, [data-noi18n] - and words not in the dictionary
 *   apply(lang)         the dictionary loaded (cached in localStorage for the next start), the page translated
 *   picker()            the language dropdown on the menu bar, left of ⊞ (the same setting as the guide's)
 */
(function (root) {
  "use strict";
  var SKIP = "#hlpBody .hlpc, #hpBody, #log, script, style, code, pre, kbd, textarea, [contenteditable=''], [contenteditable='true'], [data-noi18n]";
  var ATTRS = ["title", "placeholder", "aria-label"];
  // a text box's own words (what is typed) are never touched - but its placeholder / tooltip are
  var SKIP_ATTR = SKIP.replace(", textarea", "");
  var LET = /[A-Za-z]/;
  /** the words between their symbols: "💾 Save…" -> {pre "💾 ", core "Save", post "…"} (inner spaces collapsed) */
  function split(s) {
    s = String(s == null ? "" : s);
    var m = /^([^A-Za-z0-9]*)([\s\S]*?)([\s:：.…·,;!?)）\]]*)$/.exec(s);
    var pre = m[1], core = m[2], post = m[3];
    // a closing bracket belongs to the words when they opened one: "Zoom in (lens)" stays whole, "(top level)" -> pre "(" + post ")"
    var opens = (core.match(/[(（\[]/g) || []).length, closes = (core.match(/[)）\]]/g) || []).length;
    while (opens > closes && /^\s*[)）\]]/.test(post)) { var k = post.search(/[)）\]]/); core += post.slice(0, k + 1); post = post.slice(k + 1); closes++; }
    return { pre: pre, core: core.replace(/\s+/g, " "), post: post };
  }
  /** 2.706.0: the words the app BUILDS ("installed {0} — skipped {1}") - dictionary patterns, {n} = any value; compiled once */
  function compile(pats) {
    return Object.keys(pats || {}).map(function (k) {
      var parts = k.split(/\{(\d+)\}/), lits = [], order = [], re = "^";
      for (var i = 0; i < parts.length; i++) {
        if (i % 2) { order.push(+parts[i]); re += "((?:(?! · )[^\\n])+?)"; }     // a value never spans a " · " piece or a line
        else { lits.push(parts[i]); re += parts[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
      }
      var frag = lits.slice().sort(function (a, b) { return b.length - a.length; })[0] || "";
      return { re: new RegExp(re + "$"), order: order, to: pats[k], frag: frag.trim() };
    }).filter(function (c) { return c.frag.length >= 3; });
  }
  function fill(c, m, dict) {
    return c.to.replace(/\{(\d+)\}/g, function (all, n) {
      var i = c.order.indexOf(+n); if (i < 0) return all;
      var v = m[i + 1], t = dict && dict[v.replace(/\s+/g, " ").trim()];       // a value that is itself a word the app has
      return t != null ? t : v;
    });
  }
  function tr(s, dict, pats) {
    if (!dict || !s || !LET.test(s)) return null;
    var p = split(s), t = dict[p.core];
    if (t == null && pats && pats.length) {
      var core = p.core.trim();
      for (var i = 0; i < pats.length; i++) {
        var c = pats[i]; if (core.indexOf(c.frag) < 0) continue;
        var m = c.re.exec(core); if (m) return p.pre + fill(c, m, dict) + p.post;
      }
    }
    if (t == null && p.post) { var full = (p.core + p.post).replace(/\s+/g, " ").trim(); if (dict[full] != null) return p.pre + dict[full]; }
    if (t == null) { var whole = s.replace(/\s+/g, " ").trim(); if (dict[whole] != null) return s.match(/^\s*/)[0] + dict[whole] + s.match(/\s*$/)[0]; return null; }
    return p.pre + t + p.post;
  }
  /** 2.706.0: words the app JOINS from pieces - lines ("\n") or " · " parts: the whole first, else each piece */
  function trAll(s, dict, pats) {
    var t = tr(s, dict, pats);
    if (t != null) return t;
    var seps = [/(\r?\n)/, /( · )/];
    for (var i = 0; i < seps.length; i++) {
      var parts = String(s).split(seps[i]); if (parts.length < 3) continue;
      var changed = false;
      for (var j = 0; j < parts.length; j += 2) { var u = trAll(parts[j], dict, pats); if (u != null && u !== parts[j]) { parts[j] = u; changed = true; } }
      if (changed) return parts.join("");
    }
    return null;
  }
  var pure = { split: split, tr: tr, trAll: trAll, compile: compile, SKIP: SKIP, SKIP_ATTR: SKIP.replace(", textarea", ""), ATTRS: ATTRS };
  if (typeof module !== "undefined" && module.exports && typeof window === "undefined") { module.exports = pure; return; }

  var doc = root.document, S = { lang: "en", dict: null, obs: null, nodes: new Set(), els: new Set() };
  var ORIG = new WeakMap(), LAST = new WeakMap(), AORIG = new WeakMap(), ALAST = new WeakMap();
  var skipped = function (el, sel) { try { return !!(el && el.closest && el.closest(sel || SKIP)); } catch (e) { return false; } };
  function textNode(n) {
    var v = n.nodeValue;
    if (LAST.get(n) === v) return;                          // our own translation
    if (!v || !LET.test(v)) return;
    if (skipped(n.parentElement)) return;
    var t = trAll(v, S.dict, S.pats);
    ORIG.set(n, v);
    if (t != null && t !== v) { LAST.set(n, t); n.nodeValue = t; S.nodes.add(n); }
  }
  function attrs(el) {
    if (!el.getAttribute || skipped(el, SKIP_ATTR)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (v == null) continue;
      var last = ALAST.get(el) || {};
      if (last[a] === v) continue;
      var t = trAll(v, S.dict, S.pats);
      var o = AORIG.get(el) || {}; o[a] = v; AORIG.set(el, o);
      if (t != null && t !== v) { last[a] = t; ALAST.set(el, last); el.setAttribute(a, t); S.els.add(el); }
    }
  }
  function walk(rootEl) {
    if (!rootEl || !S.dict) return;
    if (rootEl.nodeType === 3) { textNode(rootEl); return; }
    if (rootEl.nodeType !== 1) return;
    attrs(rootEl);
    if (skipped(rootEl) && !rootEl.querySelector("textarea")) return;
    var w = doc.createTreeWalker(rootEl, 5 /* elements + text */, null), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) textNode(n); else attrs(n); }      // (textNode / attrs check what to skip)
  }
  function restore() {
    S.nodes.forEach(function (n) { if (ORIG.has(n) && LAST.get(n) === n.nodeValue) n.nodeValue = ORIG.get(n); LAST.delete(n); });
    S.els.forEach(function (el) { var o = AORIG.get(el) || {}, l = ALAST.get(el) || {}; ATTRS.forEach(function (a) { if (o[a] != null && l[a] === el.getAttribute(a)) el.setAttribute(a, o[a]); }); ALAST.delete(el); });
    S.nodes.clear(); S.els.clear();
  }
  function observe() {
    if (S.obs) return;
    S.obs = new MutationObserver(function (list) {
      if (!S.dict) return;
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === "characterData") textNode(m.target);
        else if (m.type === "attributes") attrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    });
    S.obs.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  var KEY = function (l) { return "bg.uiDict." + l; };
  function load(lang) {
    var cached = null;
    try { cached = JSON.parse(root.localStorage.getItem(KEY(lang)) || "null"); } catch (e) { cached = null; }
    var fresh = fetch("/static/i18n/ui/" + lang + ".json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("no " + lang); return r.json(); })
      .then(function (j) { try { root.localStorage.setItem(KEY(lang), JSON.stringify(j)); } catch (e) { /* too big for storage - fetched each time */ } return j; });
    return cached ? { now: cached, later: fresh } : { now: null, later: fresh };
  }
  function setDict(lang, j) {
    if (S.lang !== lang) return;
    var same = S.dict && j && S.dictV === j.v;
    S.dict = j && j.strings ? j.strings : null; S.dictV = j && j.v; S.pats = compile(j && j.patterns);
    if (!same && S.dict) { observe(); walk(doc.body); }
    doc.documentElement.setAttribute("data-uilang", lang);
  }
  // Chinese / Japanese break between any two characters - short labels and buttons would stand one character per line
  // (工/作/区): there they break only where the English would (keep-all); long text still wraps normally
  (function css() {
    if (doc.getElementById("uiLangCss")) return;
    var st = doc.createElement("style"); st.id = "uiLangCss";
    st.textContent = ["zh-CN", "zh-TW", "ja"].map(function (l) { return 'html[data-uilang="' + l + '"] :is(button, label, select, option, th, legend, summary, .bhead, .wslab, .tab, [role=tab], .stab, h1, h2, h3, h4, h5)'; }).join(",\n")
      + " { word-break: keep-all; }"
      // the status bar's short readouts (idle, LLM: …, ComfyUI: …) stay on one line
      + ["zh-CN", "zh-TW", "ja"].map(function (l) { return 'html[data-uilang="' + l + '"] :is(#sbjobs, #sbllm, #sbvis, #sbcomfy, #sbfree)'; }).join(",\n") + " { white-space: nowrap; }";
    (doc.head || doc.documentElement).appendChild(st);
  })();
  function apply(lang) {
    if (lang === S.lang && (lang === "en" || S.dict)) return Promise.resolve();
    restore(); S.dict = null; S.pats = null; S.lang = lang;
    doc.documentElement.setAttribute("data-uilang", lang);
    if (lang === "en") return Promise.resolve();
    var L = load(lang);
    if (L.now) setDict(lang, L.now);
    return L.later.then(function (j) { setDict(lang, j); }).catch(function () { /* no dictionary: stays English */ });
  }
  function picker() {
    var bar = doc.getElementById("menubar"), wrap = doc.getElementById("dockCfgWrap");
    if (!bar || !root.H3HelpLang || doc.getElementById("uiLangSel")) return;
    var s = H3HelpLang.picker("uilang"); s.id = "uiLangSel"; s.setAttribute("data-noi18n", "");
    s.title = "Language of the app and its guide"; s.setAttribute("aria-label", "Language");
    s.style.cssText = "margin-right:6px;max-width:110px";
    if (wrap) wrap.insertBefore(s, wrap.firstChild); else bar.appendChild(s);
  }
  function start() {
    if (!root.H3HelpLang) { setTimeout(start, 50); return; }
    apply(H3HelpLang.get());
    H3HelpLang.onChange(function (l) { apply(l); });
    (function place() { if (doc.getElementById("dockCfgWrap")) picker(); else setTimeout(place, 200); })();
  }
  root.H3UiLang = Object.assign({ apply: apply, restore: restore, walk: walk, state: function () { return S; } }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);

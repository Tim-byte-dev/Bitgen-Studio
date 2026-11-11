/* bitGen Studio — static/audiodock.js (2.760.0): THE AUDIO DOCKER - Music, Stems and SFX as tabs of one docker (H3Audio).
 * Tim (verbatim): "put music stems and sfx as tabs in an new docker called audio, remove those buttons from the statusbar -
 * it is getting cluttered"
 *   The statusbar's Music / Stems / SFX buttons are one: Audio. It shows / hides the Audio docker - the tab picked last
 *   (kept in localStorage h3.autab). The docker's title bar reads "Audio" with the tabs 🎵 Music · 🎚 Stems · 💥 SFX; a tab
 *   shows that one, the others step aside. Under the tabs each is still its own docker (#musicdock, #stemsdock, #sfxdock)
 *   with its own height, ▾ fold, ⛶ maximize and ⇱ float, so everything that opens one of them (a workspace, a saved
 *   docker layout, voice chat, the 🎤 music video button) opens it as the Audio docker's tab: at most ONE of the three is
 *   on screen - the one shown last wins. A tab whose extension is turned off (Settings ▸ Extensions) is not offered.
 * Pure (Node: scripts/test-audiodock760.js): IDS, TABS, keep(before, now, active) -> the one to keep on screen.
 */
(function (root) {
  "use strict";
  var IDS = ["musicdock", "stemsdock", "sfxdock"], TITLE = "Audio";
  var TABS = { musicdock: { icon: "🎵", name: "Music", tip: "Songs - lyrics, a music style, cover, sheet music" },
               stemsdock: { icon: "🎚", name: "Stems", tip: "Split a song into its vocals and its music (demucs)" },
               sfxdock: { icon: "💥", name: "SFX", tip: "Sound effects - add audio or video, trim, keep a part" } };
  /** which of the three stays on screen: `now` = the ids showing, `before` = those that showed last time. One showing -> it;
   *  several -> one that has just come up (the active tab when it is among them, else the first), else the active one,
   *  else the first. None -> null. */
  function keep(before, now, active) {
    now = (now || []).filter(function (id) { return IDS.indexOf(id) >= 0; });
    if (!now.length) return null;
    if (now.length === 1) return now[0];
    var fresh = now.filter(function (id) { return (before || []).indexOf(id) < 0; });
    if (fresh.length) return fresh.indexOf(active) >= 0 ? active : fresh[0];
    return now.indexOf(active) >= 0 ? active : now[0];
  }
  var pure = { IDS: IDS, TABS: TABS, keep: keep };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  var S = { active: "musicdock", before: [], busy: false };
  try { var a = root.localStorage.getItem("h3.autab"); if (IDS.indexOf(a) >= 0) S.active = a; } catch (e) { /* private window */ }
  function setActive(id) { S.active = id; try { root.localStorage.setItem("h3.autab", id); } catch (e) { /* fine */ } }
  function there(id) { var d = $(id); return !!d && !d.classList.contains("dockoff"); }
  function showing(id) { var d = $(id); return !!d && !d.classList.contains("dockgone") && !d.classList.contains("dockoff"); }
  function shownNow() { return IDS.filter(showing); }
  function gone(id, hide) {
    var d = $(id); if (!d || d.classList.contains("dockgone") === hide) return;
    if (typeof root.toggleDockGone === "function") root.toggleDockGone(id, null);
    else d.classList.toggle("dockgone", hide);
  }
  var CSS = ".bhead .autabs{display:inline-flex;gap:2px;margin:0 auto 0 10px;vertical-align:middle}"   // the ⛶ / ⇱ stay at the right
    + ".bhead .autabs button{font-size:.7rem;padding:1px 8px;border-radius:5px;background:transparent;border:1px solid transparent;color:var(--dim,#aaa);cursor:pointer}"
    + ".bhead .autabs button:hover{color:var(--text,#eee)}"
    + ".bhead .autabs button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".bhead .autabs button[hidden]{display:none}";
  /** the title bar: "Audio" + the tabs (made once per docker; ▾ / ▸ keeps them - toggleCollapse keeps the head's children) */
  function dress(id) {
    var d = $(id), h = d && d.querySelector(":scope > .bhead"); if (!h) return;
    for (var i = 0; i < h.childNodes.length; i++) {
      var n = h.childNodes[i];
      // the docker's own name only - a title you renamed (🖌 Edit theme ▸ double-click) is kept
      if (n.nodeType === 3 && /\S/.test(n.textContent)) { var w = n.textContent.replace(/[▾▸]/g, "").trim(); if (w === TABS[id].name) n.textContent = (/▸/.test(n.textContent) ? "▸ " : "▾ ") + TITLE; break; }
    }
    if (h.querySelector(".autabs")) return;
    var box = doc.createElement("span"); box.className = "autabs"; box.setAttribute("role", "tablist"); box.setAttribute("aria-label", "Audio");
    IDS.forEach(function (t) {
      var b = doc.createElement("button"); b.type = "button"; b.dataset.autab = t; b.setAttribute("role", "tab");
      b.textContent = TABS[t].icon + " " + TABS[t].name; b.title = TABS[t].tip;
      b.onclick = function (e) { e.stopPropagation(); tab(t); };
      box.appendChild(b);
    });
    var mx = h.querySelector(":scope > .maxbtn");
    h.insertBefore(box, mx || null);
  }
  function paint() {
    var on = shownNow(), b = $("tAu");
    if (b) { b.classList.toggle("on", on.length > 0); b.setAttribute("aria-pressed", on.length ? "true" : "false"); }
    IDS.forEach(function (id) {
      var d = $(id); if (!d) return;
      d.querySelectorAll("[data-autab]").forEach(function (x) {
        var t = x.dataset.autab, sel = t === (on[0] || S.active);
        x.classList.toggle("on", sel); x.setAttribute("aria-selected", sel ? "true" : "false");
        x.hidden = !there(t);
      });
    });
  }
  /** a tab: that docker on screen (open), the others away */
  function tab(id) {
    if (!there(id)) return;
    setActive(id);
    if (!showing(id)) gone(id, false);
    var d = $(id); if (d && d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(id);
    settle();
  }
  /** at most one on screen */
  function settle() {
    if (S.busy) return;
    var now = shownNow(), k = keep(S.before, now, S.active);
    if (k) {
      setActive(k);
      S.busy = true;
      try { now.forEach(function (id) { if (id !== k) gone(id, true); }); } finally { S.busy = false; }
    }
    S.before = shownNow();
    paint();
  }
  /** the statusbar's Audio: shows the tab picked last, or hides the Audio docker */
  function toggle(on) {
    var now = shownNow(), want = on == null ? !now.length : !!on;
    if (!want) { now.forEach(function (id) { gone(id, true); }); settle(); return false; }
    var t = there(S.active) ? S.active : IDS.filter(there)[0];
    if (t) tab(t);
    return true;
  }
  function start() {
    if (!IDS.some(function (id) { return $(id); })) { root.setTimeout(start, 400); return; }   // the extension dockers load late
    if (!$("auCss")) { var st = doc.createElement("style"); st.id = "auCss"; st.textContent = CSS; doc.head.appendChild(st); }
    var b = $("tAu"); if (b && !b.dataset.wired) { b.dataset.wired = "1"; b.onclick = function () { toggle(); }; }
    IDS.forEach(dress);
    S.before = [];
    settle();
    try {
      var mo = new root.MutationObserver(function () { IDS.forEach(dress); settle(); });
      IDS.forEach(function (id) { var d = $(id); if (d) mo.observe(d, { attributes: true, attributeFilter: ["class"] }); });
    } catch (e) { root.setInterval(settle, 1000); }
    // a docker added after the start (an extension turned on) gets its tabs too
    root.setInterval(function () { IDS.forEach(function (id) { var d = $(id); if (d && !d.querySelector(".autabs")) { dress(id); settle(); } }); }, 2000);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else root.setTimeout(start, 0);
  root.H3Audio = Object.assign({ tab: tab, toggle: toggle, show: function (id) { tab(IDS.indexOf(id) >= 0 ? id : S.active); }, active: function () { return S.active; }, settle: settle }, pure);
})(typeof window !== "undefined" ? window : globalThis);

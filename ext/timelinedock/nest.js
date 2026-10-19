/* bitGen Studio — ext/timelinedock/nest.js (2.414.0): NESTED SEQUENCES on the timeline (window.TlNest). lib/nest.js
 * + routes/nest.js are the server side.
 *
 * Tim: "lets do the medium jobs now" (Premiere's nested sequences).
 *
 *   ⧉ in the menu bar: pick another named timeline -> it is compiled (its own payload: TlExportBody(tl, {nest})),
 *   moved into the project's videos and placed on a new layer "⧉ <name>" at the position marker - an ordinary video
 *   clip from then on (trim it, move it, grade it, nest it again) that remembers which timeline it is (c.nest) and
 *   which version (c.nestHash).
 *   When that timeline is saved again the clip shows ↻ (out of date); its Properties: ↻ Re-render (the clip keeps its
 *   place and trim) and ⧉ Open (switch to the nested timeline to edit it).
 *   A timeline cannot hold itself, nor one that uses it (a loop) - said in words.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlExportBody && window.TlCanvas && TlCanvas.onProps && typeof renderTimeline === "function" && $("tlbar")); } catch (e) { return false; } }
  function say(t) { try { if (TlCanvas.say) TlCanvas.say(t); } catch (e) { /* fine */ } if ($("sblog")) $("sblog").textContent = t; }
  function log(t) { if (typeof logLine === "function") logLine("[nest] " + t); }
  function save() { if (typeof tlSave === "function") tlSave(); }
  var status = {}, asked = 0, busy = {};
  var CSS = ".clip .tlnest{position:absolute;right:16px;top:1px;font-size:.62rem;padding:0 3px;border-radius:3px;background:#3a2f1a;color:var(--tiger,#f59e2c);pointer-events:none;z-index:5}"
    + ".clip .tlnest.stale{background:#5a2a1a;color:#ffb38a}#tlpNestRow button{font-size:.7rem;padding:1px 6px}";

  function j(u, body) {
    return fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().then(function (x) { if (!r.ok || x.ok === false) throw new Error(x.error || "HTTP " + r.status); return x; }); });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function nests() {
    var out = [];
    (tl.video || []).forEach(function (c) { if (c && c.nest) out.push(c); });
    (tl.vlayers || []).forEach(function (L) { ((L && L.clips) || []).forEach(function (c) { if (c && c.nest) out.push(c); }); });
    return out;
  }
  function stale(c) { var s = status[c.nest]; return !!(s && s.hash && c.nestHash && s.hash !== c.nestHash); }
  /** the nested timeline compiled -> {file, dur, hash} */
  function render(name, note) {
    if (busy[name]) return busy[name];
    var p = j("/api/nest/check", { outer: typeof tlName !== "undefined" ? tlName : "main", inner: name })
      .then(function () { return j("/api/timelines/" + encodeURIComponent(name)); })
      .then(function (r) {
        var X = r.tl || {};
        if (!(X.video || []).length) throw new Error('"' + name + '" has no clips on V1 - a timeline compiles from V1 (add one, save it, nest again)');
        say("⧉ compiling \"" + name + "\" for the nest…");
        return fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(TlExportBody(X, { nest: name, keepAudio: true })) })
          .then(function (x) { return x.json().then(function (k) { if (!x.ok) throw new Error(k.error || "the compile was refused"); return k; }); });
      })
      .then(function (job) {
        var poll = function (n) {
          return j("/api/jobs/" + job.id).then(function (g) {
            if (g.status === "done") return g;
            if (g.status === "failed" || g.status === "cancelled") throw new Error("the compile of \"" + name + "\" " + g.status + (g.error ? ": " + g.error : ""));
            if (n % 5 === 0) say("⧉ compiling \"" + name + "\"… " + (g.progress != null ? Math.round(g.progress * 100) + " %" : ""));
            return sleep(1000).then(function () { return poll(n + 1); });
          });
        };
        return poll(0);
      })
      .then(function () { return j("/api/nest/adopt", { name: name }); })
      .then(function (r) { status[name] = { hash: r.hash, exists: true, file: r.file }; delete busy[name]; log((note || "rendered") + " \"" + name + "\" -> " + r.file + " (" + r.dur + " s)"); return r; })
      .catch(function (e) { delete busy[name]; throw e; });
    busy[name] = p;
    return p;
  }
  /** ⧉: nest a named timeline at the position marker (a new layer) */
  function add(name) {
    var go = name ? Promise.resolve(name) : j("/api/timelines").then(function (r) {
      var cur = typeof tlName !== "undefined" ? tlName : "main";
      var names = (r.timelines || []).map(function (t) { return t.name; }).filter(function (n) { return n !== cur; });
      if (!names.length) throw new Error("no other timeline to nest - Save as… a timeline first, then nest it here");
      return askText("Nest a timeline", "Which timeline goes in here as one clip?", "", names).then(function (v) {
        var i = parseInt(v, 10) - 1; return names[i] || (names.indexOf(v) >= 0 ? v : null);
      });
    });
    return go.then(function (n) {
      if (!n) return null;
      return render(n, "nested").then(function (r) {
        var at = (typeof playhead === "number" && isFinite(playhead)) ? playhead : 0, d = r.dur || 1;
        var c = { name: r.file, src: "video", in: 0, out: d, dur: d, opacity: 1, start: Math.round(at * 100) / 100, nest: n, nestHash: r.hash };
        var L = mkLayer("⧉ " + n, [c]);
        tl.vlayers = tl.vlayers || []; tl.vlayers.push(L);
        if (typeof tlKaraokeOnTop === "function") tlKaraokeOnTop();
        save(); renderTimeline(); TlCanvas.mark();
        say("⧉ \"" + n + "\" nested at " + at.toFixed(2) + " s (" + d.toFixed(2) + " s)");
        return c;
      });
    }).catch(function (e) { say("⧉ " + (e.message || e)); throw e; });
  }
  /** ↻: the nested timeline compiled again - the clip keeps its place, its trim inside the new length */
  function rerender(c) {
    return render(c.nest, "re-rendered").then(function (r) {
      var d = r.dur || c.dur || 1;
      c.name = r.file; c.dur = d; c.nestHash = r.hash;
      c.in = Math.min(+c.in || 0, Math.max(0, d - 0.1)); c.out = Math.min(c.out != null ? +c.out : d, d);
      if (c.out - c.in < 0.1) c.out = d;
      save(); renderTimeline(); TlCanvas.mark(); if (TlCanvas.paintProps) TlCanvas.paintProps();
      say("⧉ \"" + c.nest + "\" up to date");
      return c;
    });
  }
  function refresh() {
    var ns = nests(); if (!ns.length || Date.now() - asked < 1500) return Promise.resolve(status);
    asked = Date.now();
    var names = ns.map(function (c) { return c.nest; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    return j("/api/nest/status?names=" + encodeURIComponent(names.join(","))).then(function (r) { Object.assign(status, r.status || {}); paint(); return status; }).catch(function () { return status; });
  }
  function paint() {
    Array.prototype.forEach.call(document.querySelectorAll("#tlinner .clip"), function (el) {
      var c = el._clip, b = el.querySelector(".tlnest");
      if (!c || !c.nest) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement("span"); b.className = "tlnest"; el.appendChild(b); }
      var st = stale(c);
      b.classList.toggle("stale", st);
      b.textContent = st ? "⧉ ↻ out of date" : "⧉ " + c.nest;
      b.title = st ? "\"" + c.nest + "\" was changed after this render - Properties: ↻ Re-render" : "A nested timeline: \"" + c.nest + "\"";
    });
  }
  function hook(P, c, sel) {
    if (!P || !c || !c.nest) return;
    if ($("tlpNestRow")) $("tlpNestRow").remove();
    var row = document.createElement("div");
    row.className = "tlp-row"; row.id = "tlpNestRow";
    row.innerHTML = '<span style="font-size:.72rem">⧉ ' + String(c.nest).replace(/[<>&]/g, "") + (stale(c) ? ' <b style="color:#ffb38a">out of date</b>' : "") + "</span>"
      + '<button class="ghost" type="button" id="tlpNestRe" title="Compile the nested timeline again (the clip keeps its place and trim)">↻ Re-render</button>'
      + '<button class="ghost" type="button" id="tlpNestOpen" title="Switch to the nested timeline to edit it (save it, come back, ↻)">⧉ Open</button>';
    P.appendChild(row);
    $("tlpNestRe").onclick = function () { $("tlpNestRe").disabled = true; rerender(c).catch(function (e) { say("⧉ " + (e.message || e)); $("tlpNestRe").disabled = false; }); };
    $("tlpNestOpen").onclick = function () {
      if (typeof tlSaveNamed !== "function" || typeof tlSwitch !== "function") return;
      tlSaveNamed(tlName).then(function () { return tlSwitch(c.nest); }).catch(function (e) { say("⧉ " + (e.message || e)); });
    };
    refresh();
  }
  function start() {
    if (!$("tlnestCss")) { var st = document.createElement("style"); st.id = "tlnestCss"; st.textContent = CSS; document.head.appendChild(st); }
    var orig = window.renderTimeline;
    if (typeof orig === "function" && !orig._tlnest) {
      var w = function () { var r = orig.apply(this, arguments); try { paint(); refresh(); } catch (e) { /* never breaks the timeline */ } return r; };
      w._tlnest = true; w._tlmk = orig._tlmk; w._tltg = orig._tltg;
      window.renderTimeline = w;
    }
    var bar = $("tlbar");
    if (bar && !$("tlNestBtn")) {
      var b = document.createElement("button");
      b.className = "ghost"; b.id = "tlNestBtn"; b.type = "button"; b.textContent = "⧉";
      b.title = "Nest a timeline here: another named timeline as ONE clip on a new layer (re-rendered when it changes)";
      b.setAttribute("aria-label", "Nest a timeline");
      b.onclick = function () { add().catch(function () { /* said */ }); };
      var ref = $("tlLinkSel") || $("tlMarkBtn") || $("tlSelGrp");
      if (ref && ref.parentNode) ref.parentNode.insertBefore(b, ref); else bar.appendChild(b);
    }
    TlCanvas.onProps(hook);
    refresh();
  }
  function boot() { if (!ready()) { setTimeout(boot, 100); return; } start(); }
  window.TlNest = { add: add, render: render, rerender: rerender, refresh: refresh, stale: stale, status: status, paint: paint };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

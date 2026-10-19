/* bitGen Studio — ext/timelinedock/markers.js (2.410.0): the timeline's MARKERS (Premiere's sequence markers),
 * window.TlMarks. The maths is static/tlmarks.js (H3Marks); they live on the timeline as tl.seqMarkers.
 *
 * Tim: "continue with the next stages of the premier gap closure".
 *
 *   M (pointer over the layers - tlkeys.js) or ⚑ in the menu bar: a marker at the position marker
 *   on the ruler:  a coloured flag + a faint line down the layers; click = the preview goes there; drag = move it
 *                  (frame by frame); double-click = name, colour, comment, 🗑
 *   Shift+M / Alt+M: the next / previous marker; 📝 ✂ Scene cuts can drop markers instead of cutting
 *   ⇄ Export writes them into the FCP XML (<marker>), the EDL (* LOC:) and OTIO (Marker.2); XML / EDL import reads them
 *
 * 2.412.0 (Tim: "do the smaller jobs and complete the 10 partly done jobs"):
 *   RANGES - a marker with a length: the editor's "length" (or ⟦ ⟧ = the ruler's In / Out), a band on the ruler whose
 *            right end drags the length
 *   CLIP MARKERS - Ctrl+Shift+M (or Shift+click ⚑) puts one on the selected clip at the position marker: a small flag
 *            on the clip that stays on its FRAME (trims, slips, speed, reverse); click = go there, drag = move it along
 *            the clip, double-click = the same editor. ⇄ XML / OTIO carry them; Shift+M / Alt+M stop at them too.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.H3Marks && window.TlCanvas && typeof renderTimeline === "function" && $("tlinner") && $("tlbar")); } catch (e) { return false; } }
  var M = function () { return window.H3Marks; };
  var CSS = ""
    + ".tlruler .tlmk{position:absolute;top:0;width:12px;height:15px;margin-left:-6px;padding:0;border:0;cursor:pointer;z-index:4;background:none}"
    + ".tlruler .tlmk::before{content:'';position:absolute;left:0;top:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid var(--mk)}"
    + ".tlruler .tlmk:hover::before,.tlruler .tlmk.on::before{filter:brightness(1.3);border-top-width:13px}"
    + ".tlmk-line{position:absolute;top:16px;bottom:0;width:0;border-left:1px dashed var(--mk);opacity:.5;pointer-events:none;z-index:1}"
    + ".tlmk-pop{position:fixed;z-index:10070;width:250px;background:var(--panel,#1d1a15);border:1px solid var(--line,#3a342a);border-radius:8px;"
    + "box-shadow:0 10px 28px rgba(0,0,0,.6);padding:8px;display:flex;flex-direction:column;gap:6px;font-size:.74rem}"
    + ".tlmk-pop input,.tlmk-pop textarea{width:100%;font-size:.74rem}.tlmk-pop textarea{min-height:44px;resize:vertical}"
    + ".tlmk-pop .sw{display:flex;gap:4px}.tlmk-pop .sw button{width:20px;height:20px;padding:0;border-radius:50%;border:2px solid transparent}"
    + ".tlmk-pop .sw button.on{border-color:var(--text,#e8e2d6)}.tlmk-pop .row{display:flex;gap:6px;justify-content:flex-end;align-items:center}"
    + ".tlmk-pop .tm{margin-right:auto;font-family:var(--mono,monospace);color:var(--dim,#9a917f)}"
    + ".tlruler .tlmk-rng{position:absolute;top:1px;height:7px;background:var(--mk);opacity:.38;border-radius:2px;pointer-events:none;z-index:3}"
    + ".tlruler .tlmk-end{position:absolute;top:0;width:7px;height:12px;margin-left:-3px;padding:0;border:0;background:var(--mk);opacity:.85;cursor:ew-resize;z-index:4;border-radius:1px}"
    + ".tlmk-rline{position:absolute;top:16px;bottom:0;background:var(--mk);opacity:.07;pointer-events:none;z-index:1}"
    + ".clip .tlcmk{position:absolute;top:-1px;width:9px;height:10px;margin-left:-4px;padding:0;border:0;background:none;cursor:pointer;z-index:6}"
    + ".clip .tlcmk::before{content:'';position:absolute;left:0;top:0;border-left:4.5px solid transparent;border-right:4.5px solid transparent;border-top:8px solid var(--mk)}"
    + ".clip .tlcmk:hover::before{filter:brightness(1.35)}"
    + ".clip .tlcmk-rng{position:absolute;top:0;height:3px;background:var(--mk);opacity:.6;pointer-events:none;z-index:5}"
    + ".tlmk-pop .len{display:flex;gap:6px;align-items:center}.tlmk-pop .len input{width:70px}";
  function fps() { try { return (tl.tc && +tl.tc.fps) || (typeof TLFPS === "number" ? TLFPS : 25); } catch (e) { return 25; } }
  function snap(t) { var f = fps(); return Math.round(Math.max(0, t) * f) / f; }
  /** the markers, cleaned IN PLACE (an open editor keeps editing the very marker on the timeline) */
  function L() {
    var out = [];
    (Array.isArray(tl.seqMarkers) ? tl.seqMarkers : []).forEach(function (m) { var c = M().one(m); if (c) { Object.assign(m, c); out.push(m); } });
    out.sort(function (a, b) { return a.t - b.t; });
    tl.seqMarkers = out;
    return out;
  }
  function save() { if (typeof tlSave === "function") tlSave(); }
  function log(t) { if (typeof logLine === "function") logLine("[markers] " + t); }
  function ph() { try { return typeof playhead === "number" && isFinite(playhead) ? playhead : (TlCanvas.state.t || 0); } catch (e) { return 0; } }
  function go(t) { if (t == null) return false; TlCanvas.go(t); return true; }
  function tcOf(t) { try { return window.H3Timecode ? H3Timecode.fmt(H3Timecode.frames(t, fps()), fps(), H3Timecode.isDrop(typeof tl !== "undefined" && tl && tl.tc, fps())) : t.toFixed(2) + " s"; } catch (e) { return t.toFixed(2) + " s"; } }

  /** a marker at t (the position marker when t is left out) -> the marker */
  function add(t, o) {
    var at = snap(t == null ? ph() : t), r = M().add(L(), at, Object.assign({ fps: fps() }, o || {}));
    tl.seqMarkers = r.list; save(); paint();
    if (r.added) log("marker at " + at.toFixed(2) + " s" + (r.m.name ? " - " + r.m.name : ""));
    return r.m;
  }
  /** M: a marker at the position marker - or, when one is already there, its name / colour / comment (Premiere: M M) */
  function mark() {
    var at = snap(ph()), half = 0.5 / fps(), hit = L().find(function (m) { return Math.abs(m.t - at) <= half; });
    if (!hit) return add(at);
    editAt(hit);
    return hit;
  }
  /** the editor beside a marker's flag */
  function editAt(m) {
    var f = Array.prototype.find.call(document.querySelectorAll("#tlinner .tlruler .tlmk"), function (x) { return x._mk && Math.abs(x._mk.t - m.t) < 1e-6; });
    var r = f ? f.getBoundingClientRect() : { left: 200, bottom: 120 };
    edit(m, r.left + 6, r.bottom - 10);
  }
  function remove(m) { tl.seqMarkers = M().remove(L(), m); save(); paint(); }
  function times() { return M().allTimes ? M().allTimes(tl, window.H3ClipFx) : L().map(function (m) { return m.t; }); }
  function nextM() { var t = ph(), h = times().find(function (x) { return x > t + 1e-3; }); return go(h == null ? null : h); }
  function prevM() { var t = ph(), a = times().filter(function (x) { return x < t - 1e-3; }); return go(a.length ? a[a.length - 1] : null); }

  /* ---------------- 2.412.0: clip markers */
  /** which kind of clip c is ("v1" / "vl" / "img" / "aud"), or null when it is not on the timeline */
  function kindOf(c) {
    if (!c) return null;
    if ((tl.video || []).indexOf(c) >= 0) return "v1";
    var hit = null;
    [["vlayers", "vl"], ["images", "img"], ["audio", "aud"]].forEach(function (p) {
      (tl[p[0]] || []).forEach(function (Ly) { if (!hit && Ly && (Array.isArray(Ly) ? Ly : (Ly.clips || [])).indexOf(c) >= 0) hit = p[1]; });
    });
    return hit;
  }
  /** the clip to mark: the selected one, else the highlighted layer's clip under the position marker */
  function targetClip() {
    var c = typeof tlSelClip !== "undefined" ? tlSelClip : null, t = ph();
    if (c && kindOf(c)) return c;
    var pick = null;
    Array.prototype.forEach.call(document.querySelectorAll("#tlinner .clip"), function (el) {
      var x = el._clip; if (!x || pick) return;
      var k = kindOf(x), s0 = +x.start || 0, len = k === "img" ? (+x.len || 3) : (typeof effDur === "function" ? effDur(x) : 1);
      if (t >= s0 - 1e-6 && t <= s0 + len + 1e-6 && el.closest(".tltrack") && el.closest(".tltrack").classList.contains("sellayer")) pick = x;
    });
    return pick;
  }
  /** Ctrl+Shift+M: a clip marker on the selected clip at the position marker -> the marker, or null (said why) */
  function clipMark(o) {
    var c = targetClip(), k = kindOf(c);
    if (!c || !k) { if (typeof TlCanvas.say === "function") TlCanvas.say("⚑ Select a clip under the position marker first (a clip marker sits on a clip)"); return null; }
    var at = snap(ph()), s0 = +c.start || 0, len = k === "img" ? (+c.len || 3) : effDur(c);
    if (at < s0 - 1e-6 || at > s0 + len + 1e-6) { if (typeof TlCanvas.say === "function") TlCanvas.say("⚑ The position marker is not on the selected clip"); return null; }
    var r = M().addClipMark(c, k, at, Object.assign({ fps: fps() }, o || {}), window.H3ClipFx);
    save(); if (typeof renderTimeline === "function") renderTimeline(); else paint();
    if (r.added) log("clip marker on " + (c.name || "a picture") + " at " + at.toFixed(2) + " s");
    else { var el = clipFlag(c, r.m); if (el) { var b = el.getBoundingClientRect(); edit(r.m, b.left + 4, b.bottom, c); } }
    return r.m;
  }
  function clipFlag(c, m) {
    return Array.prototype.find.call(document.querySelectorAll("#tlinner .tlcmk"), function (f) { return f._mk === m && f._clip === c; }) || null;
  }
  function paintClips() {
    Array.prototype.forEach.call(document.querySelectorAll("#tlinner .clip"), function (el) {
      Array.prototype.forEach.call(el.querySelectorAll(".tlcmk, .tlcmk-rng"), function (x) { x.remove(); });
      var c = el._clip, k = kindOf(c); if (!c || !k || !Array.isArray(c.marks) || !c.marks.length) return;
      var keep = [];                                  // cleaned IN PLACE - an open editor keeps its marker object
      c.marks.forEach(function (m) { var q = M().one(m); if (q) { Object.keys(m).forEach(function (kk) { if (!(kk in q)) delete m[kk]; }); Object.assign(m, q); keep.push(m); } });
      c.marks = keep.sort(function (a, b) { return a.t - b.t; });
      var s0 = +c.start || 0;
      c.marks.forEach(function (m) {
        var T = M().clipMarkAt(c, k, m, window.H3ClipFx); if (T == null) return;
        var col = M().HEX[m.color] || "#f59e2c", x = (T - s0) * PXS;
        var f = document.createElement("button");
        f.type = "button"; f.className = "tlcmk"; f.style.left = x + "px"; f.style.setProperty("--mk", col);
        f.title = "Clip marker " + (m.name || "") + " · " + tcOf(T) + (m.note ? "\n" + m.note : "") + "\nclick: go there · drag: move along the clip · double-click: edit";
        f.setAttribute("aria-label", "Clip marker " + (m.name || "") + " at " + T.toFixed(2) + " seconds");
        f._mk = m; f._clip = c;
        wireClip(f, m, c, k, el);
        el.appendChild(f);
        if (m.d) {
          var E = M().clipMarkAt(c, k, { t: k === "img" ? m.t + m.d : (c.fx && c.fx.reverse ? m.t - m.d : m.t + m.d) }, window.H3ClipFx);
          if (E != null) { var b = document.createElement("div"); b.className = "tlcmk-rng"; b.style.setProperty("--mk", col);
            b.style.left = Math.min(x, (E - s0) * PXS) + "px"; b.style.width = Math.abs(E - T) * PXS + "px"; el.appendChild(b); }
        }
      });
    });
  }
  function wireClip(f, m, c, k, el) {
    f.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation();
      var x0 = ev.clientX, T0 = M().clipMarkAt(c, k, m, window.H3ClipFx), moved = false, s0 = +c.start || 0;
      try { f.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
      var mv = function (e) {
        if (!moved && Math.abs(e.clientX - x0) < 4) return;
        moved = true;
        var T = snap(T0 + (e.clientX - x0) / PXS);
        m.t = M().clipMarkFrom(c, k, T, window.H3ClipFx);
        var T2 = M().clipMarkAt(c, k, m, window.H3ClipFx);
        if (T2 != null) f.style.left = (T2 - s0) * PXS + "px";
      };
      var up = function () {
        f.removeEventListener("pointermove", mv); f.removeEventListener("pointerup", up); f.removeEventListener("pointercancel", up);
        if (moved) { c.marks.sort(function (a, b) { return a.t - b.t; }); save(); paintClips(); return; }
        var now = Date.now();
        if (lastFlag && lastFlag.m === m && now - lastFlag.at < 450) { lastFlag = null; edit(m, ev.clientX, ev.clientY, c); return; }
        lastFlag = { m: m, at: now, c: c };
        go(T0);
      };
      f.addEventListener("pointermove", mv); f.addEventListener("pointerup", up); f.addEventListener("pointercancel", up);
    });
    f.addEventListener("dblclick", function (ev) { ev.preventDefault(); ev.stopPropagation(); edit(m, ev.clientX, ev.clientY, c); });
    f.addEventListener("click", function (ev) { ev.stopPropagation(); });
  }

  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } document.removeEventListener("pointerdown", outside, true); }
  function outside(e) { if (pop && !pop.contains(e.target)) closePop(); }
  function edit(m, x, y, clip) {
    closePop();
    pop = document.createElement("div");
    pop.className = "tlmk-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Marker");
    pop.innerHTML = '<input type="text" id="tlmkName" placeholder="Marker name" aria-label="Marker name" value="' + esc(m.name) + '">'
      + '<div class="sw" role="radiogroup" aria-label="Colour">' + M().COLORS.map(function (c) {
        return '<button type="button" data-c="' + c + '" title="' + c + '" aria-label="' + c + '" style="background:' + M().HEX[c] + '"' + (c === m.color ? ' class="on"' : "") + "></button>"; }).join("") + "</div>"
      + '<textarea id="tlmkNote" placeholder="Comment" aria-label="Comment">' + esc(m.note) + "</textarea>"
      + '<div class="len"><label>length <input type="number" id="tlmkLen" min="0" step="0.04" value="' + (+m.d || 0) + '" aria-label="Length in seconds (0 = a point)"> s</label>'
      + (clip ? "" : '<button type="button" class="ghost" id="tlmkIo" title="The ruler selection (In / Out) becomes this marker\'s range">⟦ ⟧ In / Out</button>') + "</div>"
      + '<div class="row"><span class="tm">' + esc(clip ? "clip · " + tcOf(M().clipMarkAt(clip, kindOf(clip), m, window.H3ClipFx) || 0) : tcOf(m.t)) + '</span><button type="button" class="ghost" id="tlmkDel" title="Remove this marker">🗑</button>'
      + '<button type="button" class="ghost" id="tlmkOk">✓ Done</button></div>';
    document.body.appendChild(pop);
    pop.style.left = Math.max(4, Math.min(window.innerWidth - 260, x - 20)) + "px";
    pop.style.top = Math.max(4, Math.min(window.innerHeight - 190, y + 14)) + "px";
    var commit = function () {
      m.name = $("tlmkName").value.trim().slice(0, 120); m.note = $("tlmkNote").value.slice(0, 2000);
      var d = Math.max(0, +$("tlmkLen").value || 0); if (d > 0) m.d = Math.round(d * 10000) / 10000; else delete m.d;
      save(); if (clip) paintClips(); else paint();
    };
    Array.prototype.forEach.call(pop.querySelectorAll("[data-c]"), function (b) {
      b.onclick = function () { m.color = b.dataset.c; Array.prototype.forEach.call(pop.querySelectorAll("[data-c]"), function (x) { x.classList.toggle("on", x === b); }); commit(); };
    });
    if ($("tlmkIo")) $("tlmkIo").onclick = function () {
      var sl = tl.sel; if (!sl || !(sl.b > sl.a)) { if (typeof TlCanvas.say === "function") TlCanvas.say("⚑ Drag across the ruler (or I / O) first - that selection becomes the range"); return; }
      m.t = snap(sl.a); m.d = Math.round((snap(sl.b) - m.t) * 10000) / 10000; $("tlmkLen").value = m.d;
      tl.seqMarkers = M().move(L(), m, m.t); commit();
    };
    $("tlmkLen").addEventListener("change", commit);
    $("tlmkLen").addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); commit(); closePop(); } });
    ["tlmkName", "tlmkNote"].forEach(function (id) {
      $(id).addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && id === "tlmkName")) { e.preventDefault(); commit(); closePop(); }
      });
      $(id).addEventListener("change", commit);
    });
    $("tlmkDel").onclick = function () {
      if (clip) { clip.marks = (clip.marks || []).filter(function (x) { return x !== m; }); if (!clip.marks.length) delete clip.marks; save(); paintClips(); }
      else remove(m);
      closePop();
    };
    $("tlmkOk").onclick = function () { commit(); closePop(); };
    setTimeout(function () { document.addEventListener("pointerdown", outside, true); $("tlmkName").focus(); $("tlmkName").select(); }, 0);
  }

  /** the flags on the ruler + their lines (after every renderTimeline) */
  function paint() {
    var inner = $("tlinner"), ruler = inner && inner.querySelector(".tlruler");
    if (!inner || !ruler) return;
    Array.prototype.forEach.call(inner.querySelectorAll(".tlmk, .tlmk-line, .tlmk-rng, .tlmk-rline, .tlmk-end"), function (x) { x.remove(); });
    L().forEach(function (m) {
      var x = LABW + m.t * PXS, col = M().HEX[m.color] || "#3fbf5f";
      var f = document.createElement("button");
      f.type = "button"; f.className = "tlmk"; f.style.left = x + "px"; f.style.setProperty("--mk", col);
      f.title = (m.name || "Marker") + " · " + tcOf(m.t) + (m.note ? "\n" + m.note : "") + "\nclick: go there · drag: move · double-click: edit";
      f.setAttribute("aria-label", "Marker " + (m.name || "") + " at " + m.t.toFixed(2) + " seconds");
      f._mk = m;
      wire(f, m);
      ruler.appendChild(f);
      var ln = document.createElement("div");
      ln.className = "tlmk-line"; ln.style.left = x + "px"; ln.style.setProperty("--mk", col);
      inner.appendChild(ln);
      if (m.d) {                                      // 2.412.0: a range - a band, its end drags the length
        var w = m.d * PXS, band = document.createElement("div");
        band.className = "tlmk-rng"; band.style.left = x + "px"; band.style.width = w + "px"; band.style.setProperty("--mk", col);
        ruler.appendChild(band);
        var rl = document.createElement("div");
        rl.className = "tlmk-rline"; rl.style.left = x + "px"; rl.style.width = w + "px"; rl.style.setProperty("--mk", col);
        inner.appendChild(rl);
        var en = document.createElement("button");
        en.type = "button"; en.className = "tlmk-end"; en.style.left = (x + w) + "px"; en.style.setProperty("--mk", col);
        en.title = "The end of " + (m.name || "the range") + " · " + tcOf(m.t + m.d) + " - drag to change its length";
        en.setAttribute("aria-label", "End of the range " + (m.name || ""));
        wireEnd(en, m, band, rl);
        ruler.appendChild(en);
      }
    });
    paintClips();
  }
  function wireEnd(en, m, band, rl) {
    en.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation();
      var x0 = ev.clientX, d0 = m.d;
      try { en.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
      var mv = function (e) {
        m.d = Math.max(1 / fps(), snap(m.t + d0 + (e.clientX - x0) / PXS) - m.t);
        var w = m.d * PXS; band.style.width = w + "px"; rl.style.width = w + "px"; en.style.left = (LABW + m.t * PXS + w) + "px";
      };
      var up = function () { en.removeEventListener("pointermove", mv); en.removeEventListener("pointerup", up); m.d = Math.round(m.d * 10000) / 10000; save(); paint(); };
      en.addEventListener("pointermove", mv); en.addEventListener("pointerup", up);
    });
    en.addEventListener("click", function (ev) { ev.stopPropagation(); });
  }
  var lastFlag = null;          // a flag's click: the next one on it (or on the position marker now over it) edits it
  function wire(f, m) {
    f.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation();
      var x0 = ev.clientX, t0 = m.t, moved = false;
      try { f.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
      var mv = function (e) {
        if (!moved && Math.abs(e.clientX - x0) < 4) return;
        moved = true;
        m.t = snap(t0 + (e.clientX - x0) / PXS);
        f.style.left = (LABW + m.t * PXS) + "px";
        var ln = Array.prototype.find.call(document.querySelectorAll("#tlinner .tlmk-line"), function (l, i) { return document.querySelectorAll("#tlinner .tlmk")[i] === f; });
        if (ln) ln.style.left = f.style.left;
      };
      var up = function () {
        f.removeEventListener("pointermove", mv); f.removeEventListener("pointerup", up); f.removeEventListener("pointercancel", up);
        if (moved) { tl.seqMarkers = M().move(L(), m, m.t); save(); paint(); }
        else {
          var now = Date.now();
          if (lastFlag && lastFlag.m === m && now - lastFlag.at < 450) { lastFlag = null; edit(m, ev.clientX, ev.clientY); return; }
          lastFlag = { m: m, at: now };
          go(m.t);
        }
      };
      f.addEventListener("pointermove", mv); f.addEventListener("pointerup", up); f.addEventListener("pointercancel", up);
    });
    f.addEventListener("dblclick", function (ev) { ev.preventDefault(); ev.stopPropagation(); edit(m, ev.clientX, ev.clientY); });
    f.addEventListener("click", function (ev) { ev.stopPropagation(); });
  }

  function start() {
    if (!$("tlmkCss")) { var st = document.createElement("style"); st.id = "tlmkCss"; st.textContent = CSS; document.head.appendChild(st); }
    var orig = window.renderTimeline;
    if (typeof orig === "function" && !orig._tlmk) {
      var wrapped = function () { var r = orig.apply(this, arguments); try { paint(); } catch (e) { /* never breaks the timeline */ } return r; };
      wrapped._tlmk = true;
      window.renderTimeline = wrapped;
    }
    var bar = $("tlbar");
    if (bar && !$("tlMarkBtn")) {
      var b = document.createElement("button");
      b.className = "ghost"; b.id = "tlMarkBtn"; b.type = "button"; b.textContent = "⚑";
      b.title = "Add a marker at the position marker (M over the layers; Shift+M / Alt+M: next / previous)\nShift+click (or Ctrl+Shift+M): a clip marker on the selected clip";
      b.setAttribute("aria-label", "Add a marker");
      b.onclick = function (e) { if (e && e.shiftKey) clipMark(); else add(); };
      var ref = $("tlSelGrp") || $("tlKeepSel");
      if (ref && ref.parentNode) ref.parentNode.insertBefore(b, ref); else bar.appendChild(b);
    }
    // a click on a flag moves the position marker onto it, so the second click of a double-click lands on the position
    // marker's own line: a double-click there edits the marker under it
    // the 2nd click lands on the position marker's line (it moved onto the flag): within 450 ms that is a double-click
    $("tlinner").addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0 || !lastFlag || Date.now() - lastFlag.at > 450 || !ev.target.closest || !ev.target.closest("#playhead")) return;
      var m = lastFlag.m, oc = lastFlag.c; lastFlag = null;
      if (oc ? (oc.marks || []).indexOf(m) < 0 : L().indexOf(m) < 0) return;
      ev.preventDefault(); ev.stopPropagation();
      edit(m, ev.clientX, ev.clientY, oc);
    }, true);
    $("tlinner").addEventListener("dblclick", function (ev) {
      if (!ev.target.closest || !ev.target.closest("#playhead")) return;
      var hit = L().find(function (m) { return Math.abs(LABW + m.t * PXS - (LABW + ph() * PXS)) <= 3; });
      if (!hit) return;
      ev.preventDefault(); ev.stopPropagation();
      edit(hit, ev.clientX, ev.clientY);
    }, true);
    paint();
  }
  function boot() { if (!ready()) { setTimeout(boot, 80); return; } start(); }
  window.TlMarks = { add: add, mark: mark, remove: remove, next: nextM, prev: prevM, list: function () { return L(); }, paint: paint, edit: edit, go: go,
    clipMark: clipMark, kindOf: kindOf, times: times };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

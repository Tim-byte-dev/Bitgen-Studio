/* bitGen Studio — ext/timelinedock/tlranges.js (2.613.0): ▼ RANGES MARKED WHILE IT PLAYS (Ctrl), cut or sped up all at once;
 * the time under the pointer; the playback speed.
 *
 * Tim (verbatim): "in timeline mode if user presses ctrl while the clip is playing add an upsidedown triangle at the time
 * marker, this marker will mark the start of the range, if user presses ctrl again add a second marker in the time ruler
 * this will indicate the end of the range. allow the clip to continue to play and allow the user to add multiple ranges on
 * the same layer the ranges will apply to the selected layer, change the color of the range markers for each range, allow
 * the user to move the range markers show the fram in preview of the range marker selected frame. when user hovers over
 * the timeline show the time in a small box. add option to cut all the ranges. add 2x,4x,8x,0.5x,0.25,0.125 playback
 * options. can i speed up a range in my clip, so if a file is rendering in the video can make it look like fast forward
 * instead of waiting for the entire render time".
 *
 *   CTRL (a tap - pressed and let go alone)  while the preview plays (or with the pointer on the timeline): a ▼ in the
 *            time ruler at the position marker = a range's START on the highlighted layer; Ctrl again = its END (a second
 *            ▼). Playback carries on. As many ranges as you like - each its own colour, its band drawn on its layer's row.
 *            Esc forgets a started one.
 *   ▼ DRAG   moves that end (whole frames); the preview shows the frame under it (playback pauses). A click shows it too;
 *            right-click removes that range; Del removes the picked one.
 *   ▼ BAR    (the timeline's menu bar) ▼ n · ✂ Cut all (each range out of its layer - ripple as its box says; a clip cut
 *            more than once is joined into one again, tljoin.js) · ⏩ 2× / 4× / 8× / 10× Speed up (each range plays that much
 *            faster - its part of the clip is split off and sped up, what follows moves up with ripple) · ✕ all.
 *   HOVER    over the timeline: the time under the pointer in a small box (timecode · seconds).
 *   SPEED    the canvas transport's 0.125× … 8× - ▶ / Space play at it (TlCanvas.setRate); J / L still shuttle.
 * Pure (Node): rangeOf, hueOf, union, speedRange, hoverText.
 */
(function (root) {
  "use strict";
  var EPS = 1e-6;
  function rangeOf(a, t, fps) {
    var f = fps || 24, lo = Math.round(Math.max(0, Math.min(a, t)) * f) / f, hi = Math.round(Math.max(0, Math.max(a, t)) * f) / f;
    return hi - lo < 1 / f - 1e-9 ? null : { a: Math.round(lo * 1e6) / 1e6, b: Math.round(hi * 1e6) / 1e6 };
  }
  /** each range its own colour (golden-angle steps - neighbours differ) */
  function hueOf(k) { return Math.round(((+k || 0) * 137.508 + 28) % 360); }
  /** a layer's ranges merged where they overlap / touch, latest first (cutting from the end keeps the earlier times) */
  function union(list) {
    var s = (list || []).map(function (r) { return { a: +r.a, b: +r.b }; }).filter(function (r) { return r.b > r.a; }).sort(function (x, y) { return x.a - y.a; }), out = [];
    s.forEach(function (r) { var l = out[out.length - 1]; if (l && r.a <= l.b + EPS) l.b = Math.max(l.b, r.b); else out.push(r); });
    return out.reverse();
  }
  /** a range played k times faster: the clips split at its ends, the part inside sped up (fx.speed, at most 10x) and packed
   *  from its start; with ripple what follows moves up by the time saved. o: {split(c, t), len(c), ripple}. Throws in words. */
  function speedRange(clips, a, b, k, o) {
    var out = (clips || []).map(function (c) { return Object.assign({}, c); }), len = o.len;
    [a, b].forEach(function (t) {
      var nx = [];
      out.forEach(function (c) { var s = +c.start || 0, e = s + len(c); if (t > s + 1e-4 && t < e - 1e-4) nx.push.apply(nx, o.split(c, t)); else nx.push(c); });
      out = nx;
    });
    var mid = out.filter(function (c) { var s = +c.start || 0; return s >= a - 1e-4 && s + len(c) <= b + 1e-4; }).sort(function (x, y) { return (+x.start || 0) - (+y.start || 0); });
    if (!mid.length) throw new Error("no clip inside that range");
    mid.forEach(function (c) {
      var fx = c.fx || {};
      if (fx.reverse || fx.ramp || fx.remap) throw new Error("a reversed / ramped / remapped clip in the range - its speed is its own");
      if (c.text || c.m3d || c.adjust || c.shape || c.nul) throw new Error("a text / 3D / shape clip in the range");
    });
    var at = a;
    mid.forEach(function (c) {
      var sp = Math.min(10, Math.round((+(c.fx && c.fx.speed) || 1) * k * 1e4) / 1e4);
      c.fx = Object.assign({}, c.fx || {}, { speed: sp });
      c.start = Math.round(at * 1e6) / 1e6; at += len(c);
    });
    var saved = b - at;
    if (o.ripple && saved > EPS) out.forEach(function (c) { if (mid.indexOf(c) < 0 && (+c.start || 0) >= b - 1e-4) c.start = Math.round(Math.max(0, (+c.start || 0) - saved) * 1e6) / 1e6; });
    out.sort(function (x, y) { return (+x.start || 0) - (+y.start || 0); });
    return { clips: out, saved: Math.round(saved * 1e6) / 1e6, n: mid.length };
  }
  function hoverText(t, fps, tc) {
    var f = fps || 24, fr = Math.floor(t * f + 1e-6);
    return (tc ? tc + " · " : "") + t.toFixed(2) + " s · f " + fr;
  }
  var api = { rangeOf: rangeOf, hueOf: hueOf, union: union, speedRange: speedRange, hoverText: hoverText };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = api; return; }

  function $(id) { return document.getElementById(id); }
  function tlObj() { try { return tl; } catch (e) { return null; } }
  function fps() { try { return typeof TLFPS === "number" ? TLFPS : 24; } catch (e) { return 24; } }
  function pxs() { try { return PXS; } catch (e) { return 40; } }
  function labw() { try { return LABW; } catch (e) { return 0; } }
  function say(t) { try { if (root.TlCanvas && TlCanvas.say) TlCanvas.say(t); } catch (e) { /* fine */ } if ($("sblog")) $("sblog").textContent = t; }
  function log(t) { if (typeof logLine === "function") logLine("[ranges] " + t); }
  function label(lk) { try { return typeof lkLabel === "function" ? lkLabel(lk) : lk; } catch (e) { return lk; } }
  function exists(lk) { try { return typeof lkExists === "function" ? lkExists(lk) : false; } catch (e) { return false; } }
  function typing() { var a = document.activeElement; return !!(a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))); }
  function playing() { try { return !!(TlCanvas.state && TlCanvas.state.playing) || (typeof pv === "object" && pv && pv.on && !pv.paused); } catch (e) { return false; } }
  function now() { try { if (TlCanvas.state && TlCanvas.state.playing) return TlCanvas.state.t; } catch (e) { /* fine */ } try { return typeof playhead === "number" && isFinite(playhead) ? playhead : 0; } catch (e) { return 0; } }
  function col(h, a) { return "hsla(" + h + ",88%,60%," + (a == null ? 1 : a) + ")"; }
  function list() { var T = tlObj(); if (!T) return []; if (!Array.isArray(T.ranges)) T.ranges = []; return T.ranges; }
  function save() { if (typeof tlSave === "function") tlSave(); }

  var pend = null, pick = -1;

  /* ---------------- painting: ▼ in the ruler, the band on its layer's row */
  var CSS = ".tlrm{position:absolute;top:0;width:13px;margin-left:-6.5px;height:16px;line-height:15px;text-align:center;font-size:12px;z-index:5;cursor:ew-resize;user-select:none;text-shadow:0 1px 2px #000}"
    + ".tlrm.pend{animation:tlrmP 1s infinite}@keyframes tlrmP{50%{opacity:.35}}.tlrm.pick{font-size:15px;line-height:14px}"
    + ".tlrband{position:absolute;top:2px;bottom:2px;z-index:3;pointer-events:none;border-radius:3px;border:1.5px solid}.tlrband.pick{border-width:2.5px}"
    + ".tlrband .lab{position:absolute;left:3px;top:0;font:600 .6rem var(--mono,monospace);color:#fff;text-shadow:0 1px 2px #000;white-space:nowrap}"
    + "#tlHovT{position:fixed;z-index:10061;pointer-events:none;background:#000d;color:#fff;font:11px var(--mono,monospace);padding:2px 6px;border-radius:4px;white-space:nowrap;display:none;border:1px solid var(--tiger,#f59e2c)}"
    + "#tlRangeGrp{display:inline-flex;gap:3px;align-items:center;border-left:1px solid var(--line);padding-left:6px;margin-left:2px}#tlRangeGrp.none>.rq{opacity:.45;pointer-events:none}"
    + "#tlRangeN{font:600 .7rem var(--mono,monospace);min-width:12px}";
  function css() { if ($("tlrangesCss")) return; var s = document.createElement("style"); s.id = "tlrangesCss"; s.textContent = CSS; document.head.appendChild(s); }
  function trackOf(lk) { var inner = $("tlinner"); return inner ? inner.querySelector('.tltrack[data-lk="' + (root.CSS && CSS.escape ? CSS.escape(lk) : lk) + '"]') : null; }
  function paint() {
    css();
    var inner = $("tlinner"); if (!inner) return;
    inner.querySelectorAll(".tlrm, .tlrband").forEach(function (x) { x.remove(); });
    var ruler = inner.querySelector(".tlruler"), R = list();
    R.forEach(function (r, i) {
      if (ruler) ["a", "b"].forEach(function (side) { ruler.appendChild(mark(r, i, side)); });
      var tr = trackOf(r.lk); if (!tr) return;
      var d = document.createElement("div"); d.className = "tlrband" + (i === pick ? " pick" : "");
      d.style.left = (labw() + r.a * pxs()) + "px"; d.style.width = Math.max(2, (r.b - r.a) * pxs()) + "px";
      d.style.background = col(r.hue, 0.22); d.style.borderColor = col(r.hue);
      d.innerHTML = '<span class="lab"></span>'; d.querySelector(".lab").textContent = (i + 1) + " · " + (r.b - r.a).toFixed(2) + " s";
      tr.appendChild(d);
    });
    if (pend && ruler) { var m = mark({ a: pend.a, hue: pend.hue, lk: pend.lk }, -1, "a"); m.classList.add("pend"); m.title = "A range starts here on " + label(pend.lk) + " - Ctrl again ends it, Esc forgets it"; ruler.appendChild(m); }
    var n = $("tlRangeN"); if (n) n.textContent = String(R.length);
    var g = $("tlRangeGrp"); if (g) g.classList.toggle("none", !R.length);
  }
  function mark(r, i, side) {
    var m = document.createElement("div"); m.className = "tlrm" + (i === pick && i >= 0 ? " pick" : ""); m.textContent = "▼";
    m.dataset.i = i; m.dataset.side = side; m.style.color = col(r.hue);
    m.style.left = (labw() + r[side] * pxs()) + "px";
    m.title = "Range " + (i + 1) + (side === "a" ? " start " : " end ") + (+r[side]).toFixed(2) + " s on " + label(r.lk) + " - drag to move (the preview shows the frame), right-click removes the range";
    if (i >= 0) { m.addEventListener("pointerdown", drag); m.addEventListener("contextmenu", function (e) { e.preventDefault(); e.stopPropagation(); remove(i); }); }
    else m.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    return m;
  }
  function drag(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var i = +e.currentTarget.dataset.i, side = e.currentTarget.dataset.side, r = list()[i]; if (!r) return;
    if (playing()) { try { TlCanvas.pause(); } catch (x) { /* fine */ } }
    pick = i;
    var inner = $("tlinner"), rect = inner.getBoundingClientRect(), F = fps(), moved = false, x0 = e.clientX;
    var show = function (t) { try { TlCanvas.go(t); } catch (x) { /* fine */ } };
    var mv = function (ev) {
      if (Math.abs(ev.clientX - x0) > 2) moved = true; if (!moved) return;
      var t = Math.round(Math.max(0, (ev.clientX - rect.left - labw()) / pxs()) * F) / F;
      if (side === "a") t = Math.min(t, r.b - 1 / F); else t = Math.max(t, r.a + 1 / F);
      t = Math.round(t * 1e6) / 1e6;
      if (t !== r[side]) { r[side] = t; paint(); show(t); }
    };
    var up = function () {
      window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true);
      if (moved) save(); else paint();
      show(r[side]);
      say("▼ Range " + (i + 1) + ": " + r.a.toFixed(2) + " – " + r.b.toFixed(2) + " s on " + label(r.lk) + " - the preview shows its " + (side === "a" ? "first" : "last") + " frame");
      if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_range_marker", i);
    };
    window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true);
  }
  function remove(i) {
    var R = list(); if (!R[i]) return;
    R.splice(i, 1); pick = -1; save(); paint();
    say("▼ Range " + (i + 1) + " removed - " + R.length + " left");
  }
  function clearAll() { var T = tlObj(); if (!T) return; T.ranges = []; pend = null; pick = -1; save(); paint(); say("▼ Ranges cleared"); }

  /* ---------------- Ctrl: start / end at the position marker */
  function tap() {
    var T = tlObj(); if (!T) return null;
    var t = Math.round(now() * fps()) / fps();
    if (!pend) {
      var lk = exists(T.selLayer) ? T.selLayer : "v1";
      T.rangeN = (+T.rangeN || 0) + 1;
      pend = { a: t, lk: lk, hue: hueOf(T.rangeN) };
      paint();
      say("▼ Range start " + t.toFixed(2) + " s on " + label(lk) + " - press Ctrl again where it ends (playback goes on)");
      if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_range_start", lk);
      return pend;
    }
    var r = rangeOf(pend.a, t, fps());
    if (!r) { say("▼ The range's end is on its start - let it play on, then press Ctrl"); return null; }
    var o = { a: r.a, b: r.b, lk: pend.lk, hue: pend.hue };
    list().push(o); pend = null; pick = list().length - 1;
    save(); paint();
    say("▼ Range " + list().length + ": " + o.a.toFixed(2) + " – " + o.b.toFixed(2) + " s on " + label(o.lk) + " - ✂ Cut all / ⏩ Speed up in the menu bar");
    log("range " + o.a.toFixed(2) + "-" + o.b.toFixed(2) + " on " + o.lk);
    if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_range_end", o.lk);
    return o;
  }
  function docked() { var d = $("timelinedock"); return !!(d && !/dockgone|collapsed/.test(d.className)); }
  var over = null, armed = 0;
  var px = -1, py = -1;
  /** the pointer is on the timeline docker (asked at its spot - a repaint replaces the element it entered) */
  function overTl() {
    var el = px >= 0 && document.elementFromPoint ? document.elementFromPoint(px, py) : over;
    return !!(el && el.closest && el.closest("#timelinedock"));
  }
  function onKeyDown(e) {
    if (e.key === "Control") { if (!e.repeat) armed = performance.now(); return; }
    armed = 0;
    if (e.key === "Escape" && pend && !typing()) { pend = null; paint(); say("▼ The started range is forgotten"); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && pick >= 0 && list()[pick] && !typing() && overTl() && !document.querySelector("dialog[open]")) {
      var T = tlObj(); if (T && T.sel && T.sel.frame) return;                    // ▯ Frame's own Del
      e.preventDefault(); e.stopImmediatePropagation(); remove(pick);
    }
  }
  function onKeyUp(e) {
    if (e.key !== "Control") return;
    var ok = armed && performance.now() - armed < 600; armed = 0;
    if (!ok || typing() || document.querySelector("dialog[open]") || !docked()) return;
    if (!playing() && !overTl()) return;
    tap();
  }

  /* ---------------- ✂ Cut all / ⏩ Speed up */
  function byLayer() {
    var m = {}; list().forEach(function (r) { if (exists(r.lk)) (m[r.lk] = m[r.lk] || []).push(r); }); return m;
  }
  async function cutAll() {
    var M = byLayer(), lks = Object.keys(M); if (!lks.length) { say("▼ No ranges to cut - press Ctrl while it plays to mark one"); return false; }
    var ripple = !!($("tlRipple") && $("tlRipple").checked), F = fps(), done = 0, base = "r" + Date.now() + "_", joins = [];
    for (var li = 0; li < lks.length; li++) {
      var lk = lks[li], kind = typeof lkKind === "function" ? lkKind(lk) : "video", U = union(M[lk]);
      (lkClips(lk) || []).forEach(function (c, i) {
        var s = +c.start || 0, e = s + (kind === "image" ? (+c.len || 0) : effDur(c));
        if (U.some(function (r) { return s < r.b - EPS && e > r.a + EPS; })) c._tlj = base + li + "_" + i;
      });
      for (var k = 0; k < U.length; k++) {
        var r = U[k], j;
        try {
          var res = await fetch("/api/timeline/edit", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op: "cut", kind: kind, clips: (lkClips(lk) || []).map(function (c) { return Object.assign({}, c); }), a: r.a, b: r.b, scope: "layer", at: (r.a + r.b) / 2,
                                   ripple: ripple, compact: lk === "v1" && ripple, fps: F }) });
          j = await res.json(); if (!res.ok) throw new Error(j.error || "HTTP " + res.status);
        } catch (x) { say("✂ Cut all stopped: " + (x.message || x)); break; }
        lkSet(lk, j.clips); if (lk === "v1" && typeof resolveOverlaps === "function") resolveOverlaps(); done++;
      }
      var G = {};
      (lkClips(lk) || []).forEach(function (c) { if (c._tlj) { (G[c._tlj] = G[c._tlj] || []).push(c); delete c._tlj; } });
      if (ripple && !(root.TlJoin && TlJoin.toNew && TlJoin.toNew())) Object.keys(G).forEach(function (id) { var p = G[id].sort(function (x, y) { return (+x.start || 0) - (+y.start || 0); }); if (p.length > 1) joins.push([lk, kind, p]); });
    }
    var T = tlObj(); T.ranges = list().filter(function (r) { return !M[r.lk]; }); pick = -1; T.sel = null;
    save(); if (typeof renderTimeline === "function") renderTimeline();
    say("✂ Cut " + done + " range(s)" + (ripple ? " - the gaps closed" : "") + " · Ctrl+Z undoes");
    log("cut all: " + done + " range(s) on " + lks.join(", "));
    for (var q = 0; q < joins.length; q++) { if (root.TlJoin && TlJoin.joinChain) await TlJoin.joinChain(joins[q][0], joins[q][1], joins[q][2]); }
    if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_ranges_cut", done);
    return done;
  }
  function speedAll(k) {
    var M = byLayer(), lks = Object.keys(M); if (!lks.length) { say("▼ No ranges to speed up - press Ctrl while it plays to mark one"); return false; }
    var ripple = !!($("tlRipple") && $("tlRipple").checked), done = 0, why = "", saved = 0;
    lks.forEach(function (lk) {
      var kind = typeof lkKind === "function" ? lkKind(lk) : "video";
      if (kind !== "video") { why = "⏩ works on video layers (" + label(lk) + " is not one)"; return; }
      union(M[lk]).forEach(function (r) {
        try {
          var res = speedRange(lkClips(lk) || [], r.a, r.b, k, { ripple: ripple, len: function (c) { return effDur(c); },
            split: function (c, t) { return H3Marks.splitClip(c, t, lk === "v1" ? "v1" : "vl", 1 / fps()); } });
          lkSet(lk, res.clips); done++; saved += res.saved;
        } catch (x) { why = (x.message || String(x)); }
      });
      if (lk === "v1" && typeof resolveOverlaps === "function") resolveOverlaps();
    });
    if (!done) { say("⏩ Nothing sped up" + (why ? ": " + why : "")); return false; }
    var T = tlObj(); T.ranges = list().filter(function (r) { return !M[r.lk] || (typeof lkKind === "function" && lkKind(r.lk) !== "video"); }); pick = -1;
    save(); if (typeof renderTimeline === "function") renderTimeline();
    say("⏩ " + done + " range(s) play " + k + "× faster - " + saved.toFixed(2) + " s shorter" + (why ? " (" + why + ")" : "") + " · Ctrl+Z undoes");
    log("speed " + k + "x: " + done + " range(s)");
    if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_ranges_speed", done);
    return done;
  }

  /* ---------------- the bar, the speed, the hover box */
  function bar() {
    if ($("tlRangeGrp")) return;
    var ref = $("tlCutNewL") ? $("tlCutNewL") : $("tlSelGrp"); if (!ref) return;
    var g = document.createElement("span"); g.id = "tlRangeGrp"; g.className = "none";
    g.title = "Ranges: press Ctrl while the preview plays - once where a range starts, again where it ends (on the highlighted layer)";
    g.innerHTML = '<span style="color:var(--tiger,#f59e2c)">▼</span><span id="tlRangeN">0</span>'
      + '<button class="ghost rq" id="tlRangeCut" type="button" title="Cut every range out of its layer (ripple as its box says; a clip cut more than once becomes one clip again). Ctrl+Z undoes">✂ Cut all</button>'
      + '<select class="rq" id="tlRangeSpd" title="How much faster ⏩ plays the ranges"><option value="2">2×</option><option value="4" selected>4×</option><option value="8">8×</option><option value="10">10×</option></select>'
      + '<button class="ghost rq" id="tlRangeFast" type="button" title="Speed up every range on a video layer - like fast forward (e.g. a render you don\'t want to wait through). What follows moves up with ripple. Ctrl+Z undoes">⏩ Speed up</button>'
      + '<button class="ghost rq" id="tlRangeClr" type="button" title="Remove every range marker (the clips stay as they are)">✕</button>';
    ref.parentNode.insertBefore(g, ref.nextSibling);
    $("tlRangeCut").onclick = function () { cutAll(); };
    $("tlRangeFast").onclick = function () { speedAll(+$("tlRangeSpd").value || 4); };
    $("tlRangeClr").onclick = clearAll;
  }
  var RATES = [0.125, 0.25, 0.5, 1, 2, 4, 8];
  function speedSel() {
    if ($("tlCSpeed")) return;
    var ref = $("tlCLoop"); if (!ref) return;
    var s = document.createElement("select"); s.id = "tlCSpeed"; s.title = "Playback speed (▶ / Space)"; s.setAttribute("aria-label", "Playback speed");
    s.style.cssText = "font:600 .7rem var(--mono,monospace);padding:0 2px";
    RATES.forEach(function (r) { var o = document.createElement("option"); o.value = String(r); o.textContent = r + "×"; s.appendChild(o); });
    var keep = 1; try { keep = +localStorage.getItem("h3.tl.prate") || 1; } catch (e) { /* fine */ }
    if (RATES.indexOf(keep) < 0) keep = 1;
    s.value = String(keep);
    ref.parentNode.insertBefore(s, ref.nextSibling);
    if (TlCanvas.setRate) TlCanvas.setRate(keep);
    s.addEventListener("change", function () {
      var r = +s.value || 1; try { localStorage.setItem("h3.tl.prate", String(r)); } catch (e) { /* fine */ }
      TlCanvas.setRate(r); say("Playback " + r + "×");
    });
  }
  function hoverBox() {
    var box = $("tlHovT"); if (!box) { box = document.createElement("div"); box.id = "tlHovT"; document.body.appendChild(box); }
    var sc = $("tlscroll"); if (!sc || sc._tlhov) return; sc._tlhov = true;
    sc.addEventListener("pointermove", function (e) {
      var inner = $("tlinner"); if (!inner) return;
      var t = (e.clientX - inner.getBoundingClientRect().left - labw()) / pxs();
      if (t < 0 || e.target.closest(".tlab")) { box.style.display = "none"; return; }
      var tc = ""; try { var T = tlObj(); tc = root.H3Timecode ? H3Timecode.at(t, (T && T.tc) || { start: "00:00:00:00", fps: 25 }) : ""; } catch (x) { tc = ""; }
      box.textContent = hoverText(t, fps(), tc);
      box.style.display = "block"; box.style.left = (e.clientX + 12) + "px"; box.style.top = (e.clientY - 26) + "px";
    });
    sc.addEventListener("pointerleave", function () { box.style.display = "none"; });
  }
  function wrapRender() {
    var f = root.renderTimeline; if (typeof f !== "function" || f._tlranges) return;
    var w = function () { var r = f.apply(this, arguments); try { paint(); } catch (e) { /* the timeline still works */ } return r; };
    w._tlranges = true; root.renderTimeline = w;
  }
  function boot() {
    if (typeof root.renderTimeline !== "function" || !$("tlinner") || !$("tlSelGrp") || !root.TlCanvas || !$("tlCLoop") || !$("tlCutNewL")) { setTimeout(boot, 150); return; }
    css(); bar(); speedSel(); hoverBox(); wrapRender();
    window.addEventListener("pointerover", function (e) { over = e.target; }, true);
    window.addEventListener("pointermove", function (e) { px = e.clientX; py = e.clientY; }, true);
    window.addEventListener("pointerdown", function () { armed = 0; }, true);
    window.addEventListener("wheel", function () { armed = 0; }, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", function () { armed = 0; });
    paint();
  }
  root.TlRanges = Object.assign({ tap: tap, paint: paint, cutAll: cutAll, speedAll: speedAll, clear: clearAll, remove: remove,
    pending: function () { return pend; }, picked: function () { return pick; } }, api);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);

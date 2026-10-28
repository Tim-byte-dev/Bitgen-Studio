/* bitGen Studio — ext/timelinedock/tljoin.js (2.612.0): a CUT clip stays ONE clip, or its after-cut part goes to a NEW layer.
 *
 * Tim (verbatim): "when clips are cut the remaining portion is being put next to the part before the cut as a separate
 * clip, it is leaving a black frame that can't be edited - can we merge the before cut and after cut portion of the layer
 * so it is 1 continuous clip - add a checkbox to the timeline to cut to new layer - then put the after cut portion on a
 * new layer".
 *
 *   ✂ CUT / DEL ON FRAMES (applySel "cut", wrapped here) with ripple: a clip the cut went through was left as two clips side
 *                 by side (before + after the cut). They are JOINED into one clip again: a video or a sound is made into one
 *                 file (POST /api/timeline/join - lib/tlJoin.js: the two parts of its file, frame-exact, one after the
 *                 other - the new file lands in the project's Video / Sound assets as "<name>-join<n>"); a picture is
 *                 just made longer. The cut shows at once; the join follows (a few seconds for a video) and is the SAME
 *                 ↶ step as the cut. Not joined (kept as two clips, the status line says why): a retimed clip (speed /
 *                 reverse / ramp / remap), a cut-out, a text / shape / 3D / generated clip.
 *   ✂ TO NEW LAYER (the checkbox in the timeline's menu bar, kept): the part AFTER the cut goes on a new layer right
 *                 above (V1's: the first video layer) - with ✂ Cut, Del on frames and Ctrl+K split. The rest stays.
 * Pure (Node): plainPicture, joinKind, merged, newSlot.
 */
(function (root) {
  "use strict";
  var BAD = ["text", "shape", "m3d", "adjust", "nul", "path", "gen", "particles", "lottie", "d3", "tm", "data", "bgv", "mogrt", "nest", "cam"];
  var PIC_OK = ["name", "start", "len", "opacity", "tf", "kf", "fx", "id", "blend", "crop", "marks", "label", "color", "hue", "_tlj"];
  function retimed(fx) { return !!(fx && (fx.remap || fx.ramp || fx.reverse || (fx.speed && Math.abs(fx.speed - 1) > 1e-4))); }
  function plainPicture(c) { return !!(c && c.name) && Object.keys(c).every(function (k) { return PIC_OK.indexOf(k) >= 0; }); }
  function lenOf(c, kind) { return kind === "image" ? Math.max(0, +c.len || 0) : Math.max(0, (c.out != null ? +c.out : (c.dur != null ? +c.dur : 0)) - (+c.in || 0)); }
  /** how the two parts of a cut clip become one: "extend" (nothing to make - a picture, or the parts meet in the file),
   *  "file" (a video / sound made into one file), or why they stay two (words) */
  function joinKind(h, t, kind, fps) {
    var hf = 0.5 / (fps || 24);
    if (!h || !t) return "the cut left one part";
    if (h.name !== t.name || (h.src || "") !== (t.src || "")) return "not the same file";
    if (kind === "image") { if (!plainPicture(h) || !plainPicture(t)) return "a text / shape / generated clip"; }
    else {
      for (var i = 0; i < BAD.length; i++) if (h[BAD[i]] || t[BAD[i]]) return "a text / shape / 3D / generated clip";
      if (retimed(h.fx) || retimed(t.fx)) return "a retimed clip (speed / reverse / ramp)";
      if ((h.cut && h.cut.use !== false) || (t.cut && t.cut.use !== false)) return "a cut-out clip";
    }
    if (Math.abs((+h.start || 0) + lenOf(h, kind) - (+t.start || 0)) > hf) return "the parts do not meet (ripple was off)";
    if (kind === "image") return "extend";
    if (Math.abs((+t.in || 0) - (h.out != null ? +h.out : 0)) <= hf) return "extend";
    return "file";
  }
  /** the one clip: the first part's settings (it starts where the clip did), as long as both */
  function merged(h, t, kind, file) {
    var o = Object.assign({}, h); delete o._tlj;
    if (file) { o.name = file.name; o.in = 0; o.out = file.dur; o.dur = file.dur; if (file.src) o.src = file.src; else delete o.src; delete o.cut; }
    else if (kind === "image") o.len = Math.round((lenOf(h, kind) + lenOf(t, kind)) * 1e6) / 1e6;
    else o.out = t.out;
    return o;
  }
  /** where a layer's new "after the cut" layer goes: {arr, at} - right above it (V1's: the first video layer) */
  function newSlot(lk) {
    if (lk === "v1") return { arr: "vlayers", at: 0 };
    var m = /^(vl|a|i):(\d+)$/.exec(lk || ""); if (!m) return null;
    return { arr: m[1] === "vl" ? "vlayers" : m[1] === "a" ? "audio" : "images", at: +m[2] + 1, pre: m[1] };
  }
  var api = { plainPicture: plainPicture, joinKind: joinKind, merged: merged, newSlot: newSlot, lenOf: lenOf, retimed: retimed };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = api; return; }

  function $(id) { return document.getElementById(id); }
  function g(n) { try { return root[n]; } catch (e) { return undefined; } }
  function tlObj() { try { return tl; } catch (e) { return null; } }
  function fps() { try { return typeof TLFPS === "number" ? TLFPS : 24; } catch (e) { return 24; } }
  function say(t) { try { if (root.TlCanvas && TlCanvas.say) TlCanvas.say(t); } catch (e) { /* fine */ } if ($("sblog")) $("sblog").textContent = t; }
  function log(t) { if (typeof logLine === "function") logLine("[cut] " + t); }
  function kindOf(lk) { return typeof lkKind === "function" ? lkKind(lk) : (lk === "v1" || /^vl:/.test(lk) ? "video" : /^a:/.test(lk) ? "audio" : "image"); }
  function KEY() { return "h3.tl.cutNew"; }
  function toNew() { var b = $("tlCutNew"); return !!(b && b.checked); }
  function save() { if (typeof tlSave === "function") tlSave(); }
  function paint() { if (typeof renderTimeline === "function") renderTimeline(); try { TlCanvas.mark(); } catch (e) { /* fine */ } }
  function glue() { try { if (root.TlRange && TlRange.glue) TlRange.glue(); } catch (e) { /* fine */ } }

  /** put clips on a NEW layer right above lk -> its key */
  function toNewLayer(lk, clips) {
    var T = tlObj(), s = newSlot(lk); if (!T || !s || !clips.length) return null;
    var L = typeof lkLayer === "function" ? lkLayer(lk) : null;
    var name = ((L && L.name) || lk) + " ✂";
    var N = typeof mkLayer === "function" ? mkLayer(name, clips) : { name: name, clips: clips, opacity: 1, volume: 1, visible: true };
    if (L) ["opacity", "volume", "visible", "muted", "blend"].forEach(function (k) { if (L[k] !== undefined) N[k] = L[k]; });
    T[s.arr] = T[s.arr] || [];
    T[s.arr].splice(Math.min(s.at, T[s.arr].length), 0, N);
    var key = (s.arr === "vlayers" ? "vl:" : s.arr === "audio" ? "a:" : "i:") + Math.min(s.at, T[s.arr].length - 1);
    // the highlighted layer keeps pointing at the same layer when the new one went in below it
    if (T.selLayer && T.selLayer !== lk) {
      var m = /^(vl|a|i):(\d+)$/.exec(T.selLayer), pre = s.arr === "vlayers" ? "vl" : s.arr === "audio" ? "a" : "i";
      if (m && m[1] === pre && +m[2] >= s.at) T.selLayer = pre + ":" + (+m[2] + 1);
    }
    return key;
  }

  var seq = 0;
  function wrapCut() {
    var orig = g("applySel"); if (typeof orig !== "function" || orig._tljoin) return !!(orig && orig._tljoin);
    var w = async function (op) {
      var T = tlObj();
      if (op !== "cut" || !T || !T.sel || typeof lkExists !== "function" || !lkExists(T.selLayer)) return orig.apply(this, arguments);
      var lk = T.selLayer, kind = kindOf(lk), a = +T.sel.a, b = +T.sel.b, eps = 1e-6, base = "j" + (++seq) + "_";
      var before = lkClips(lk) || [], tagged = [];
      before.forEach(function (c, i) {                       // every clip the cut's END goes through has an after-cut part
        var s = +c.start || 0, e = s + (kind === "image" ? (+c.len || 0) : (typeof effDur === "function" ? effDur(c) : lenOf(c, kind)));
        if (s < b - eps && e > b + eps) { c._tlj = base + i; tagged.push(c); }
      });
      var r;
      try { r = await orig.apply(this, arguments); }
      finally { tagged.forEach(function (c) { delete c._tlj; }); }
      if (!tagged.length) return r;
      var now = lkClips(lk) || [], groups = {};
      now.forEach(function (c) { if (c._tlj) (groups[c._tlj] = groups[c._tlj] || []).push(c); });
      var ids = Object.keys(groups);
      if (!ids.length) return r;                            // the edit failed - nothing changed
      ids.forEach(function (id) { groups[id].sort(function (x, y) { return (+x.start || 0) - (+y.start || 0); }); groups[id].forEach(function (c) { delete c._tlj; }); });
      if (toNew()) {
        var moved = [];
        ids.forEach(function (id) { var p = groups[id], t = p[p.length - 1]; moved.push(t); });
        lkSet(lk, now.filter(function (c) { return moved.indexOf(c) < 0; }));
        var nk = toNewLayer(lk, moved);
        glue(); save(); paint();
        say("✂ Cut - the part after it is on a new layer (" + (typeof lkLabel === "function" ? lkLabel(nk) : nk) + ") · Ctrl+Z undoes");
        log("cut " + a.toFixed(2) + "-" + b.toFixed(2) + " s on " + lk + ", after-cut part -> " + nk);
        if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_cut_newlayer", nk);
        return r;
      }
      glue(); save();
      var jobs = ids.map(function (id) { var p = groups[id]; return p.length === 2 ? { h: p[0], t: p[1] } : null; }).filter(Boolean);
      for (var i = 0; i < jobs.length; i++) await joinOne(lk, kind, jobs[i].h, jobs[i].t);
      return r;
    };
    w._tljoin = true; root.applySel = w; return true;
  }
  async function joinOne(lk, kind, h, t) { return joinChain(lk, kind, [h, t]); }
  /** 2.613.0: two parts OR MORE of one clip (✂ Cut all ranges) - one file for all of them */
  async function joinChain(lk, kind, ps) {
    var hows = [];
    for (var q = 0; q + 1 < ps.length; q++) hows.push(joinKind(ps[q], ps[q + 1], kind, fps()));
    var bad = hows.filter(function (w) { return w !== "extend" && w !== "file"; })[0];
    var how = bad || (hows.indexOf("file") >= 0 ? "file" : "extend");
    root.TlJoin.last = how;                             // what the last cut did (the status line can be overwritten)
    if (bad) { say("✂ Cut - kept as " + ps.length + " clips: " + bad); return false; }
    var file = null, h = ps[0], t = ps[ps.length - 1];
    if (how === "file") {
      say("✂ Cut - joining the " + ps.length + " parts into one clip …");
      try {
        var res = await fetch("/api/timeline/join", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: kind === "audio" ? "audio" : "video", name: h.name, src: h.src || "", parts: ps.map(function (c) { return [+c.in || 0, +c.out]; }) }) });
        file = await res.json();
        if (!res.ok || !file || !file.name) throw new Error((file && file.error) || "HTTP " + res.status);
      } catch (e) { say("✂ Cut - kept as " + ps.length + " clips (the join did not work: " + (e.message || e) + ")"); log("join failed: " + (e.message || e)); return false; }
    }
    var list = lkClips(lk) || [];
    if (ps.some(function (c) { return list.indexOf(c) < 0; })) { say("✂ Cut - the layer changed meanwhile, the parts stay apart"); return false; }
    var one = kind === "image" && !file ? Object.assign(merged(h, t, "image", null), { len: Math.round(ps.reduce(function (a, c) { return a + lenOf(c, "image"); }, 0) * 1e6) / 1e6 }) : merged(h, t, kind === "image" ? "image" : kind, file);
    var out = list.slice(); out[out.indexOf(h)] = one;
    out = out.filter(function (c) { return ps.indexOf(c) < 1; });
    lkSet(lk, out);
    if (lk === "v1" && typeof resolveOverlaps === "function") resolveOverlaps();
    glue(); save(); paint();
    if (file && typeof refreshAssets === "function") { try { refreshAssets(); } catch (e) { /* fine */ } }
    say("✂ Cut - one continuous clip" + (file ? " (" + file.name + " in " + (kind === "audio" ? "Sound" : "Video") + " assets)" : "") + " · Ctrl+Z undoes the cut");
    log("joined " + h.name + " -> " + (file ? file.name : "the same clip"));
    if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_cut_joined", one.name);
    return true;
  }

  function box() {
    if ($("tlCutNew")) return;
    var ref = $("tlSelGrp"); if (!ref) return;
    var l = document.createElement("label"); l.className = "chk"; l.id = "tlCutNewL";
    l.title = "Cut to a new layer: ✂ Cut, Del on frames and Ctrl+K split put the part AFTER the cut on a new layer right above (V1's: the first video layer). Off: a cut clip stays one continuous clip";
    l.innerHTML = '<input type="checkbox" id="tlCutNew"> ✂ to new layer';
    ref.parentNode.insertBefore(l, ref);
    var c = $("tlCutNew");
    try { c.checked = localStorage.getItem(KEY()) === "1"; } catch (e) { /* fine */ }
    c.addEventListener("change", function () { try { localStorage.setItem(KEY(), c.checked ? "1" : "0"); } catch (e) { /* fine */ } });
  }
  function boot() {
    if (typeof g("applySel") !== "function" || !$("tlSelGrp") || typeof g("tlSave") !== "function") { setTimeout(boot, 150); return; }
    box(); wrapCut();
  }
  root.TlJoin = Object.assign({ toNew: toNew, toNewLayer: toNewLayer, joinOne: joinOne, joinChain: joinChain }, api);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);

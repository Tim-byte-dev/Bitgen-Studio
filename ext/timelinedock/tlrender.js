/* bitGen Studio — ext/timelinedock/tlrender.js (2.418.0): ⚡ REAL-TIME PLAYBACK (window.TlRender) - Premiere's render
 * bar, "Render In to Out", the dropped-frame indicator and the playback resolution.
 *   - the RENDER BAR under the ruler: every stretch of the timeline costed (static/tlrender.js): nothing = the canvas
 *     draws it live in real time, yellow = it may drop frames, red = too heavy to draw live (or it DID drop frames
 *     while playing), green = rendered
 *   - ⚡ Render previews: the real compile into its own file (POST /api/export {preview: id} -> lib/tlRender.js adopt
 *     -> <project>/cache/preview); while the canvas PLAYS over a green stretch it shows that file - the exact movie at
 *     full speed - instead of building the picture layer by layer. An edit turns only the stretches it touches red /
 *     yellow again (each stretch has its own fingerprint)
 *   - the transport's ⏱ meter (frames drawn late while playing) and the playback resolution (Full / ½ / ¼: the clips'
 *     grades, effects and masks worked on a smaller picture while playing - canvas.js shrink)
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior". */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && window.H3TlRender && window.TlDlg && typeof tl === "object" && tl && typeof renderTimeline === "function"); } catch (e) { return false; } }
  var V = null, busy = null, slow = {}, meter = { late: 0, frames: 0, last: 0 }, cache = { key: "", list: [] };
  function R() { return H3TlRender; }
  function fps() { return typeof TLFPS === "number" ? TLFPS : 24; }
  function say(m) { if (typeof logLine === "function") logLine("[render] " + m); }
  /** every stretch with its level and whether it is rendered (cached until the timeline changes) */
  function list() {
    var now = Date.now();
    if (cache.t && now - cache.t < 400) return cache.list;          // at most ~2 checks a second (it runs every frame)
    cache.t = now;
    var key;
    try { key = JSON.stringify([tl.video, tl.vlayers, tl.images, tl.v1, tl.captions, tl.previewRender, Object.keys(slow).length]); } catch (e) { key = String(Math.random()); }
    if (key === cache.key) return cache.list;
    var st = R().status(R().stretches(tl), tl.previewRender);
    st.forEach(function (s) { if (slow[s.fp] && !s.rendered && s.level !== "red") { s.level = "red"; s.why = s.why.concat(["dropped frames"]); } });
    cache = { key: key, list: st, t: now };
    return st;
  }
  function on() { return tl.previewUse !== false; }
  /* ---------------------------------------------------------------- the render bar */
  var CSS = ".tlruler .tlrbar{position:absolute;bottom:0;height:3px;pointer-events:none;z-index:3}"
    + ".tlruler .tlrbar.red{background:#e0453a}.tlruler .tlrbar.yellow{background:#e8c23a}.tlruler .tlrbar.green{background:#3fbf5f}";
  function paintBar() {
    var inner = $("tlinner"), ruler = inner && inner.querySelector(".tlruler");
    if (!ruler) return;
    Array.prototype.forEach.call(ruler.querySelectorAll(".tlrbar"), function (x) { x.remove(); });
    list().forEach(function (s) {
      var cls = s.rendered ? "green" : s.level === "ok" ? "" : s.level;
      if (!cls) return;
      var d = document.createElement("div");
      d.className = "tlrbar " + cls; d.style.left = (LABW + s.a * PXS) + "px"; d.style.width = Math.max(1, (s.b - s.a) * PXS) + "px";
      d.dataset.a = s.a; d.dataset.b = s.b;
      d.title = (s.rendered ? "rendered - plays the ⚡ preview" : s.level === "red" ? "too heavy to draw live" : "may drop frames") + " · " + s.why.join(", ");
      ruler.appendChild(d);
    });
  }
  /* ---------------------------------------------------------------- ⚡ render */
  function j(url, body) {
    return fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().then(function (x) { if (!r.ok || x.ok === false) throw new Error(x.error || "HTTP " + r.status); return x; }); });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /** compile the timeline as a preview -> green; resolves with {id, url, stretches} */
  function render() {
    if (busy) return busy;
    if (!(tl.video || []).length) return Promise.reject(new Error("the timeline compiles from V1 - put a clip on V1 first"));
    var L = list(), fpsList = L.map(function (s) { return s.fp; });
    var id = R().hash(fpsList.join(",")) + ("0000000" + (Date.now() >>> 0).toString(16)).slice(-8);
    var btn = $("tlRenderBtn"); if (btn) btn.classList.add("busy");
    say("⚡ rendering the preview (" + L.length + " stretch(es))…");
    var flush = TlCanvas.flushText ? TlCanvas.flushText() : Promise.resolve();
    busy = flush.then(function () { return j("/api/export", TlExportBody(tl, { preview: id })); })
      .then(function (job) {
        var poll = function (n) {
          return j("/api/jobs/" + job.id).then(function (g) {
            if (g.status === "done") return g;
            if (g.status === "failed" || g.status === "cancelled") throw new Error("the preview render " + g.status + (g.error ? ": " + g.error : ""));
            return sleep(800).then(function () { return poll(n + 1); });
          });
        };
        return poll(0);
      })
      .then(function () { return j("/api/tlrender/adopt", { id: id }); })
      .then(function (r) {
        tl.previewRender = { id: id, url: r.url, fps: fpsList, dur: r.dur };
        Object.keys(slow).forEach(function (k) { delete slow[k]; }); cache.t = 0;
        if (typeof tlSave === "function") tlSave();
        busy = null; if (btn) btn.classList.remove("busy");
        paintBar(); say("⚡ rendered - " + fpsList.length + " stretch(es) play the preview (" + r.dur + " s)");
        return { id: id, url: r.url, stretches: fpsList.length };
      })
      .catch(function (e) { busy = null; if (btn) btn.classList.remove("busy"); throw e; });
    return busy;
  }
  /* ---------------------------------------------------------------- playback */
  function video() {
    var pr = tl.previewRender; if (!pr || !pr.url) return null;
    if (!V || V._url !== pr.url) {
      if (V) { try { V.pause(); V.removeAttribute("src"); V.load(); } catch (e) { /* gone */ } }
      V = document.createElement("video");
      V.muted = true; V.preload = "auto"; V.playsInline = true; V.crossOrigin = "anonymous"; V._url = pr.url; V.src = pr.url;
    }
    return V;
  }
  /** is the canvas showing the preview at t (playing, on, the stretch rendered)? */
  function covers(t) {
    if (!on() || !tl.previewRender) return false;
    var s = R().at(list(), t);
    return !!(s && s.rendered);
  }
  /** keep the preview video in step (canvas.js syncMedia) */
  function sync(t, play, rate) {
    var use = play && covers(t);
    if (!use) { if (V && !V.paused) V.pause(); return; }
    var v = video(); if (!v) return;
    var r = Math.max(0.0625, Math.min(16, rate || 1));
    if (Math.abs((v.playbackRate || 1) - r) > 1e-3) { try { v.playbackRate = r; } catch (e) { /* range */ } }
    if (Math.abs(v.currentTime - t) > 0.15 * Math.max(1, r)) { try { v.currentTime = t; } catch (e) { /* not ready */ } }
    if (v.paused) v.play().catch(function () { /* autoplay */ });
  }
  /** the picture to draw at t instead of the layers (null = draw them live) */
  function frame(t) {
    if (!covers(t)) return null;
    var v = video();
    return v && v.readyState >= 2 && !v.seeking ? v : null;
  }
  /** canvas.js loop: dt = ms since the last frame while playing - a frame later than 1.5 x the frame time is DROPPED */
  function note(t, dt) {
    meter.frames++;
    var late = dt > 1.5 * 1000 / fps();
    if (late) {
      meter.late++;
      var s = R().at(list(), t);
      if (s && !s.rendered && !slow[s.fp]) { slow[s.fp] = 1; cache.key = ""; cache.t = 0; clearTimeout(note.T); note.T = setTimeout(paintBar, 300); }
    }
    var now = performance.now();
    if (now - meter.last > 250) { meter.last = now; paintMeter(); }
  }
  function resetMeter() { meter.late = 0; meter.frames = 0; paintMeter(); }
  function paintMeter() {
    var m = $("tlCFps"); if (!m) return;
    m.textContent = "⏱ " + meter.late;
    m.style.color = meter.late ? "#e0453a" : "#3fbf5f";
    m.title = meter.late + " of " + meter.frames + " frame(s) drawn late since ▶ (the red stretches on the ruler) - ⚡ renders them";
  }
  /* ---------------------------------------------------------------- the transport: ⏱ + resolution */
  function transport() {
    var b = $("tlCPlay"); if (!b || !b.parentNode || $("tlCRes") || !window.TlCanvas) return;
    var m = document.createElement("span"); m.id = "tlCFps"; m.style.cssText = "font:600 .7rem var(--mono,monospace);min-width:30px;cursor:default";
    var s = document.createElement("select"); s.id = "tlCRes"; s.title = "Playback resolution: the clips' looks worked on a smaller picture while playing (½ / ¼)";
    s.style.cssText = "font-size:.68rem;padding:0 2px";
    [["1", "Full"], ["0.5", "½"], ["0.25", "¼"]].forEach(function (o) { var x = document.createElement("option"); x.value = o[0]; x.textContent = o[1]; s.appendChild(x); });
    s.value = String(tl.playRes || 1);
    s.onchange = function () { tl.playRes = +s.value; TlCanvas.state.res = +s.value; if (typeof tlSave === "function") tlSave(); TlCanvas.mark(); };
    s.addEventListener("keydown", function (e) { e.stopPropagation(); });
    // 2.420.0: GPU - the frame put together on the graphics card while playing (static/glcomp.js); off = the 2D path
    var gp = document.createElement("button"); gp.type = "button"; gp.className = "ghost"; gp.id = "tlCGpu"; gp.textContent = "GPU";
    gp.style.cssText = "font:600 .62rem var(--mono,monospace);padding:0 4px";
    var paintGpu = function () { var on = tl.glComp !== false && !!(window.H3GLComp && H3GLComp.ok()); gp.classList.toggle("on", on); gp.style.color = on ? "#3fbf5f" : "";
      gp.title = window.H3GLComp && H3GLComp.ok() ? "GPU compositor " + (on ? "ON" : "OFF") + " - while playing the layers are put together on the graphics card (click to switch)" : "no WebGL2 here - the 2D path draws"; };
    gp.onclick = function () { tl.glComp = tl.glComp === false ? true : false; if (typeof tlSave === "function") tlSave(); paintGpu(); TlCanvas.mark(); };
    var anchor = $("tlCRate") || b;
    anchor.parentNode.insertBefore(m, anchor.nextSibling);
    m.parentNode.insertBefore(s, m.nextSibling);
    s.parentNode.insertBefore(gp, s.nextSibling);
    paintGpu();
    TlCanvas.state.res = +(tl.playRes || 1);
    paintMeter();
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    if (!$("tlrCss")) { var st = document.createElement("style"); st.id = "tlrCss"; st.textContent = CSS; document.head.appendChild(st); }
    var orig = window.renderTimeline;
    if (typeof orig === "function" && !orig._tlr) {
      var wrapped = function () { var r = orig.apply(this, arguments); try { cache.t = 0; paintBar(); } catch (e) { /* never breaks the timeline */ } return r; };
      wrapped._tlr = true; wrapped._tlmk = orig._tlmk;
      window.renderTimeline = wrapped;
    }
    TlDlg.button("tlRenderBtn", "⚡", "Render previews: the red / yellow stretches on the ruler compiled once, then played as the movie (real time)", function (e) {
      if (e && e.shiftKey) { tl.previewUse = !on(); if (typeof tlSave === "function") tlSave(); say(on() ? "previews on" : "previews off - the canvas draws everything live"); return; }
      render().catch(function (er) { alert("⚡ Render: " + er.message); });
    });
    if ($("tlCRate")) transport();          // else canvas.js paintTransport adds them with its own ⏩ rate (no late layout shift)
    paintBar();
  }
  window.TlRender = { list: list, render: render, covers: covers, sync: sync, frame: frame, note: note, resetMeter: resetMeter,
                      paintBar: paintBar, transport: transport, meter: function () { return { late: meter.late, frames: meter.frames }; }, _slow: slow };
  try { if ($("tlCRate") && typeof tl === "object" && tl) transport(); } catch (e) { /* the canvas adds them (paintTransport) */ }
  boot();
})();

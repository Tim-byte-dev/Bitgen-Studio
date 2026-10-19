/* bitGen Studio — ext/timelinedock/proxy.js (2.416.0): 🪶 PROXIES (window.TlProxy) - light copies of heavy footage
 * (4K, HEVC, ProRes, high bit rates) that the canvas plays while the compile reads the originals. lib/proxy.js makes
 * them (960 wide VP9, a key frame every 12 frames); canvas.js vidUrl asks TlProxy.url(c) when "play proxies" is on.
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior". */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlDlg && window.TlCanvas && typeof tl !== "undefined"); } catch (e) { return false; } }
  var M = {}, dlg = null, timer = 0;                      // name -> {state, url, error, w, h, codec, heavy, why}
  function post(u, b) {
    return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.error || "HTTP " + r.status); return j; }); });
  }
  function on() { try { return !!tl.proxies; } catch (e) { return false; } }
  function names() {
    var out = [];
    var add = function (c) { if (c && c.name && !c.m3d && !c.text && !c.adjust && (c.src === "video" || c.src === "output" || !c.src) && out.indexOf(c.name) < 0) out.push(c.name); };
    (tl.video || []).forEach(add);
    (tl.vlayers || []).forEach(function (L) { ((L && L.clips) || []).forEach(add); });
    return out;
  }
  function make(n) {
    var r = M[n] = M[n] || {};
    if (r.state === "working" || r.state === "ready") return Promise.resolve(r);
    r.state = "working"; paint();
    return post("/api/proxy/want", { name: n }).then(function (j) { r.state = j.state; r.url = j.url || r.url; r.error = j.error || ""; poll(); paint(); return r; })
      .catch(function (e) { r.state = "failed"; r.error = e.message; paint(); return r; });
  }
  function refresh() {
    var ns = names(); if (!ns.length) return Promise.resolve(M);
    return post("/api/proxy/info", { names: ns }).then(function (j) {
      var was = {}; Object.keys(M).forEach(function (k) { was[k] = M[k].state; });
      Object.keys(j.info || {}).forEach(function (k) { M[k] = Object.assign(M[k] || {}, j.info[k]); });
      paint();
      if (Object.keys(M).some(function (k) { return was[k] !== "ready" && M[k].state === "ready"; }) && window.TlCanvas) TlCanvas.mark();
      return M;
    }).catch(function () { return M; });
  }
  function poll() {
    clearTimeout(timer);
    if (!Object.keys(M).some(function (k) { return M[k].state === "working"; })) return;
    timer = setTimeout(function () { refresh().then(poll); }, 1500);
  }
  /** the proxy's URL for this clip when proxies are on and it is made (canvas.js vidUrl) */
  function url(c) {
    if (!on() || !c || !c.name) return null;
    var r = M[c.name];
    if (!r) { M[c.name] = { state: "?" }; refresh(); return null; }
    return r.state === "ready" && r.url ? r.url : null;
  }
  function paint() {
    var B = dlg && dlg.isOpen() ? $("tpxList") : null; if (!B) return;
    var ns = names();
    B.innerHTML = ns.length ? '<table style="width:100%;font-size:.72rem;border-collapse:collapse">'
      + '<tr class="fx-dim"><th style="text-align:left">clip</th><th>size</th><th>codec</th><th>Mbit/s</th><th>heavy</th><th>proxy</th><th></th></tr>'
      + ns.map(function (n) {
        var r = M[n] || {}, st = r.state === "ready" ? "✓ made" : r.state === "working" ? "⏳ making…" : r.state === "failed" ? "⚠ " + esc(r.error || "failed") : "—";
        return '<tr><td>' + esc(n) + '</td><td style="text-align:center">' + (r.w ? r.w + "×" + r.h : "") + '</td><td style="text-align:center">' + esc(r.codec || "")
          + '</td><td style="text-align:center">' + (r.mbps || "") + '</td><td style="text-align:center" title="' + esc(r.why || "") + '">' + (r.heavy ? "● " + esc(r.why) : "") + "</td>"
          + '<td style="text-align:center">' + st + '</td><td><button class="ghost" type="button" data-px="' + esc(n) + '"' + (r.state === "ready" || r.state === "working" ? " disabled" : "") + ">make</button></td></tr>";
      }).join("") + "</table>" : '<div class="fx-dim">No video clips on the timeline yet.</div>';
    Array.prototype.forEach.call(B.querySelectorAll("[data-px]"), function (b) { b.onclick = function () { make(b.dataset.px); }; });
    var c = $("tpxOn"); if (c) c.checked = on();
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlProxyDlg", title: "Proxies", width: 680 });
      dlg.foot.innerHTML = '<span style="flex:1"></span><button type="button" id="tpxDone">Done</button>';
      $("tpxDone").onclick = function () { dlg.close(); };
    }
    dlg.body.innerHTML = '<div class="fx-row"><label title="The canvas plays the light copies (made ones); the compile always reads the originals"><input type="checkbox" id="tpxOn"> play proxies on the canvas</label>'
      + '<span style="flex:1"></span><button type="button" id="tpxHeavy" title="Make a proxy for every heavy clip (4K, HEVC, ProRes, high bit rate)">🪶 Make for the heavy ones</button>'
      + '<button type="button" class="ghost" id="tpxAll">Make for all</button></div><div id="tpxList"></div>'
      + '<div class="fx-dim">A proxy is 960 wide (VP9, a key frame every 12 frames - quick to scrub), its sound as is. The movie, the deliverables and the exchange files use the originals.</div>';
    $("tpxOn").onchange = function () { tl.proxies = $("tpxOn").checked || undefined; if (typeof tlSave === "function") tlSave(); TlCanvas.mark(); if (on()) refresh(); };
    $("tpxHeavy").onclick = function () { refresh().then(function () { names().forEach(function (n) { if (M[n] && M[n].heavy) make(n); }); }); };
    $("tpxAll").onclick = function () { names().forEach(make); };
    dlg.open(); paint(); refresh().then(poll);
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlProxyBtn", "🪶", "Proxies: light copies of heavy footage for the canvas (the movie uses the originals)", open);
  }
  window.TlProxy = { open: open, url: url, make: make, refresh: refresh, state: function (n) { return M[n] || null; }, _M: M };
  boot();
})();

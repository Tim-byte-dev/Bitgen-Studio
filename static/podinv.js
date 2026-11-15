/* bitGen Studio — static/podinv.js (2.787.0): PODS ▸ MY PODS ▸ 🗂 INVENTORY - what bitGen knows is on a pod, stopped or running
 * (window.H3PodInv; GET /api/podinv/:id[?refresh=1], lib/podInv.js runpod/pods/<id>.json).
 *
 * Tim (verbatim, the agreed design): "the pod info will keep a list of styles and models + vae + textencoders in each pod"
 *   The panel (under the pod list, like 📁 Files): Models · VAE · Text encoders · LoRAs · Other, each file with its size and
 *   ✓ on the pod / ⇪ sent by bitGen since the pod last listed its files; the styles linked to the pod; when it was last listed.
 *   ⟳ (a running pod) asks the pod for its files now. These files are in Basic Settings' model / LoRA lists as
 *   "<pod name>/<file>" - picked = the render goes to this pod. A refresh sends "h3:podinv" and the lists load again.
 * Pure (Node: scripts/test-podinv787.js): size, panelHtml.
 */
(function (root) {
  "use strict";
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function size(n) { n = +n || 0; return n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : n >= 1e6 ? Math.round(n / 1e6) + " MB" : n ? Math.round(n / 1e3) + " KB" : ""; }
  function ago(t) { if (!t) return "never"; var s = Math.round((Date.now() - t) / 1000); return s < 90 ? "just now" : s < 5400 ? Math.round(s / 60) + " min ago" : s < 129600 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " days ago"; }
  /** the panel (pure): v = GET /api/podinv/:id's inv, running = the pod runs now */
  function panelHtml(v, running) {
    var g = (v && v.groups) || [];
    return '<div class="piHead" style="display:flex;gap:8px;align-items:center"><b>🗂 ' + esc(v.name) + "</b>"
      + '<span class="hint">' + (v.count || 0) + " file" + (v.count === 1 ? "" : "s") + " · listed by the pod " + esc(ago(v.listed_at)) + "</span>"
      + (running ? '<button type="button" class="ghost" data-pirefresh title="Ask the pod for its files now">⟳</button>' : "")
      + '<button type="button" class="ghost" data-piclose title="Close">✕</button></div>'
      + (g.length ? g.map(function (x) {
        return '<div class="piGrp" data-pikind="' + esc(x.kind) + '"><div class="hint" style="margin:6px 0 2px;font-weight:600">' + esc(x.label) + " (" + x.files.length + ")</div>"
          + x.files.map(function (f) {
            return '<div class="piFile" style="display:flex;gap:8px;font-size:.74rem"><span title="' + (f.state === "on" ? "on the pod" : "sent by bitGen since the pod last listed its files") + '">' + (f.state === "on" ? "✓" : "⇪") + "</span>"
              + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + esc(f.cat + "/" + f.rel) + '</span><span class="hint">' + esc(size(f.size)) + "</span></div>";
          }).join("") + "</div>";
      }).join("") : '<div class="hint">No files known yet' + (running ? " - press ⟳" : " - start the pod and press ⟳") + ".</div>")
      + '<div class="hint" style="margin-top:6px">Styles on this pod: ' + ((v.styles || []).length ? v.styles.map(function (s) { return esc(s.name); }).join(", ") : "none linked") + "</div>"
      + '<div class="hint">Its models and LoRAs are in Basic Settings\' lists as <b>' + esc(v.label) + "/&lt;file&gt;</b> - picked, the render goes to this pod.</div>";
  }
  var pure = { size: size, panelHtml: panelHtml };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = pure; return; }

  var doc = root.document;
  function open(host, p, port, refresh) {
    if (!host) return;
    var running = /RUNNING/.test(String(p.status || ""));
    host.innerHTML = '<div class="hint">' + (refresh ? "asking the pod for its files…" : "loading…") + "</div>";
    return root.fetch("/api/podinv/" + encodeURIComponent(p.id) + (refresh ? "?refresh=1&port=" + (+port || 0) : "")).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.error || !j.inv) {
        if (running && !refresh) return open(host, p, port, true);   // nothing known yet - list it now
        host.innerHTML = '<div class="hint" style="color:var(--bad,#e66)">' + esc((j && j.error) || "no answer") + "</div>"; return;
      }
      host.innerHTML = panelHtml(j.inv, running);
      var b = host.querySelector("[data-pirefresh]"); if (b) b.onclick = function () { open(host, p, port, true); };
      var c = host.querySelector("[data-piclose]"); if (c) c.onclick = function () { host.innerHTML = ""; };
      if (refresh) {
        try { doc.dispatchEvent(new Event("h3:podinv")); } catch (e) { /* fine */ }
        if (typeof root.loadComfyModels === "function") root.loadComfyModels(true);   // Basic Settings' lists get "<pod>/<file>"
      }
    }).catch(function (e) { host.innerHTML = '<div class="hint" style="color:var(--bad,#e66)">' + esc(e && e.message || e) + "</div>"; });
  }
  root.H3PodInv = Object.assign({ open: open }, pure);
})(typeof window !== "undefined" ? window : globalThis);

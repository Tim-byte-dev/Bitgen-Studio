/* bitGen Studio — static/podpick.js (2.764.0): GENERATE WITH A STYLE THAT HAS NO POD = THIS BOX - your pods and presets, each
 * with ＋ <style>, and Create pod. window.H3PodPick (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "I think we can use multiple styles on the same pod. so if a user clicks a style that is not assigned to a
 * pod bring up a dialog with my pods and a + style button, then add the style to the button, add a create pod button to create
 * a new pod for the style" + "dialog should only appear when u press generate"
 *
 *   Your pods      each with its GPU (× how many), state, $/h, the styles it holds, whether its GPU memory is enough for this
 *                  style - ＋ <style>: the style goes on that pod (linked; its files go on before the render; a stopped pod is
 *                  started) and the waiting render goes there
 *   Your presets   the ones whose pod is not on RunPod now - ＋ <style> & ▶: the style joins the preset and ▶ makes its pod
 *                  again with every style on it (its GPU not free = pick one with as much memory or more, here)
 *   Create pod…    the PODS docker's create form, filled in for the style (static/podsdock.js forRender) - the new pod is kept
 *                  as a preset too
 *   Cancel render  the render is not made
 *   Opened by static/stylepodask.js when a queued render asks (lib/stylePods.js gate -> job.pod_ask) - only on Generate.
 * Pure (Node: scripts/test-podpresets764.js): fits, rowText.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** does the style fit the pod's GPU memory? -> "yes" | "no" | "" (not known) */
  function fits(memGb, needGb) { if (!(+memGb > 0) || !(+needGb > 0)) return ""; return +memGb >= +needGb ? "yes" : "no"; }
  /** a pod's line under its name (pure) */
  function rowText(p) {
    var bits = [String(p.gpu || "") + ((+p.gpus || 1) > 1 ? " × " + p.gpus : ""), String(p.status || "").toLowerCase()].filter(Boolean);
    return bits.join(" · ");
  }
  var api = { fits: fits, rowText: rowText };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  /* ================================ the page ================================ */
  var doc = root.document;
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function money(v, s) { return root.H3Money ? root.H3Money.usd(v, s) : "$" + (+v || 0).toFixed(2) + (s || ""); }
  var CSS = "#ppkDlg{max-width:min(720px,94vw);width:640px;padding:0;border:1px solid var(--line,#3a342a);border-radius:10px;background:var(--panel,#1c1915);color:var(--text,#e8e2d6)}"
    + "#ppkDlg::backdrop{background:rgba(0,0,0,.45)}#ppkDlg .in{padding:14px 16px;display:flex;flex-direction:column;gap:10px;max-height:80vh;overflow:auto}"
    + "#ppkDlg h3{margin:0;font-size:15px}#ppkDlg h4{margin:4px 0 0;font-size:12px;color:var(--dim,#9a917f);font-weight:600}"
    + "#ppkDlg .row{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;border:1px solid var(--line,#3a342a);border-radius:6px;padding:6px 8px}"
    + "#ppkDlg .row .nm{font-weight:600}#ppkDlg .row .sub{font-size:12px;color:var(--dim,#9a917f);grid-column:1}#ppkDlg .row .act{grid-row:1 / span 3;grid-column:2}"
    + "#ppkDlg .warn{color:#e8a35a}#ppkDlg .ok{color:#8d8}#ppkDlg .bar{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}#ppkDlg .msg{min-height:1em;font-size:12px}#ppkDlg .msg.bad{color:#e88}"
    + "#ppkDlg .need{grid-column:1 / span 2;display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px}";
  function css() { if (!doc.getElementById("ppkCss")) { var st = doc.createElement("style"); st.id = "ppkCss"; st.textContent = CSS; doc.head.appendChild(st); } }
  var cur = null;
  /** the box for the question `id` -> Promise<true> when it opened (false = not possible here) */
  function show(id) {
    if (!doc.createElement("dialog").showModal) return Promise.resolve(false);
    return getj("/api/stylepods/ask/" + encodeURIComponent(id)).then(function (o) {
      if (!o || o.error || !o.ask) return false;
      css();
      var d = doc.getElementById("ppkDlg");
      if (!d) { d = doc.createElement("dialog"); d.id = "ppkDlg"; d.setAttribute("aria-labelledby", "ppkTitle"); doc.body.appendChild(d); }
      cur = { id: id, o: o };
      paint(d, o);
      if (!d.open) d.showModal();
      d.oncancel = function (ev) { ev.preventDefault(); };   // Esc does not leave a render waiting - Cancel render says what happens
      return true;
    }).catch(function () { return false; });
  }
  function paint(d, o, need) {
    var a = o.ask, sn = a.style_name, pods = o.pods || [], pre = o.presets || [];
    var h = '<div class="in"><h3 id="ppkTitle">' + esc(sn) + " has no pod</h3>"
      + '<div class="hint">Several styles can share one pod - put ' + esc(sn) + " on one of yours, start a preset with it, or create a pod for it." + (o.need_gb ? " It wants about " + o.need_gb + " GB of GPU memory" + (o.size_gb ? " and " + o.size_gb + " GB of files" : "") + "." : "") + "</div>"
      + (o.was ? '<div class="warn">Its pod (' + esc(o.was.name) + ") is gone on RunPod.</div>" : "");
    h += "<h4>Your pods</h4>" + (pods.length ? pods.map(function (p) {
      var f = fits(p.memory, o.need_gb);
      return '<div class="row" data-ppkpod="' + esc(p.id) + '"><span class="nm">' + esc(p.name) + (p.preset ? ' <span class="hint">(preset ' + esc(p.preset) + ")</span>" : "") + "</span>"
        + '<span class="sub">' + esc(rowText(p)) + (p.cost_hr ? " · " + esc(money(p.cost_hr, "/h")) : "") + (f === "yes" ? ' · <span class="ok">' + p.memory + " GB - fits</span>" : f === "no" ? ' · <span class="warn">' + p.memory + " GB - " + esc(sn) + " wants ~" + o.need_gb + " GB</span>" : "") + "</span>"
        + '<span class="sub">' + (p.styles && p.styles.length ? "Holds: " + esc(p.styles.join(", ")) : "No styles on it yet") + "</span>"
        + '<span class="act"><button type="button" data-ppkuse="' + esc(p.id) + '" title="Put ' + esc(sn) + ' on this pod - the render goes there (a stopped pod is started)">＋ ' + esc(sn) + "</button></span></div>";
    }).join("") : '<div class="hint">No pods on your RunPod account.</div>');
    if (pre.length) h += "<h4>Your presets</h4>" + pre.map(function (p) {
      var n = need && need.name === p.name ? need : null;
      return '<div class="row" data-ppkpre="' + esc(p.name) + '"><span class="nm">📦 ' + esc(p.name) + "</span>"
        + '<span class="sub">' + esc(p.gpu + (p.count > 1 ? " × " + p.count : "")) + " · " + (p.cloud === "COMMUNITY" ? "Community" : "Secure") + " · no pod now - ▶ makes it</span>"
        + '<span class="sub">' + (p.styles && p.styles.length ? "Holds: " + esc(p.styles.join(", ")) : "No styles yet") + "</span>"
        + '<span class="act"><button type="button" data-ppkpreset="' + esc(p.name) + '" title="Add ' + esc(sn) + ' to the preset and make its pod (with every style on it)">＋ ' + esc(sn) + " & ▶</button></span>"
        + (n ? '<div class="need"><span>' + esc(p.gpu) + " is not free now - pick one with as much memory or more:</span><select data-ppkgpu>" + (n.options || []).map(function (g) { return '<option value="' + esc(g.id) + '">' + esc(g.name) + " · " + g.memory + " GB · " + esc(money(g.price, "/h")) + "</option>"; }).join("") + "</select>"
          + '<button type="button" data-ppkgpugo="' + esc(p.name) + '"' + ((n.options || []).length ? "" : " disabled") + ">▶ Use it</button></div>" : "")
        + "</div>";
    }).join("");
    h += '<div class="msg" aria-live="polite"></div><div class="bar"><button type="button" class="ghost" data-ppkcancel title="The render is not made">Cancel render</button>'
      + '<button type="button" data-ppkcreate title="The PODS docker\'s create form, filled in for ' + esc(sn) + ' - the new pod is kept as a preset">Create pod…</button></div></div>';
    d.innerHTML = h;
    wire(d, o);
  }
  function busy(d, t, bad) { var m = d.querySelector(".msg"); m.textContent = t || ""; m.className = "msg" + (bad ? " bad" : ""); d.querySelectorAll("button,select").forEach(function (b) { b.disabled = !bad && !!t; }); }
  function done(d, r) {
    if (!r || r.error) { busy(d, (r && r.error) || "that did not work", true); return false; }
    if (root.H3StylePodAsk && H3StylePodAsk.answered) H3StylePodAsk.answered(cur.id);
    d.close(); cur = null; return true;
  }
  function wire(d, o) {
    var id = cur.id, q = function (s) { return d.querySelectorAll(s); };
    q("[data-ppkuse]").forEach(function (b) { b.onclick = function () { busy(d, "putting " + o.ask.style_name + " on the pod…"); post("/api/stylepods/ask/" + id, { action: "use", pod_id: b.dataset.ppkuse }).then(function (r) { done(d, r); }, function (e) { done(d, { error: String(e) }); }); }; });
    var pr = function (name, gpu) {
      busy(d, "adding " + o.ask.style_name + " to " + name + " and starting it…");
      post("/api/stylepods/ask/" + id, { action: "preset", name: name, gpu: gpu || undefined }).then(function (r) {
        if (r && r.need_gpu) { busy(d, ""); paint(d, o, Object.assign({ name: name }, r)); return; }
        done(d, r);
      }, function (e) { done(d, { error: String(e) }); });
    };
    q("[data-ppkpreset]").forEach(function (b) { b.onclick = function () { pr(b.dataset.ppkpreset); }; });
    q("[data-ppkgpugo]").forEach(function (b) { b.onclick = function () { pr(b.dataset.ppkgpugo, d.querySelector("[data-ppkgpu]").value); }; });
    d.querySelector("[data-ppkcancel]").onclick = function () { post("/api/stylepods/ask/" + id, { action: "cancel" }).then(function (r) { done(d, r); }, function () { done(d, { ok: true }); }); };
    d.querySelector("[data-ppkcreate]").onclick = function () {
      // the PODS docker's create form, filled in (the render still waits - the docker's banner answers it)
      if (root.H3Pods && H3Pods.forRender && H3Pods.forRender(o)) { d.close(); cur = null; if (root.H3StylePodAsk && H3StylePodAsk.answered) H3StylePodAsk.answered(id); return; }
      d.close(); cur = null; if (root.H3StylePodAsk && H3StylePodAsk.show) H3StylePodAsk.show(id);
    };
  }
  root.H3PodPick = Object.assign({ show: show, open: function () { return cur ? cur.id : null; } }, api);
})(typeof window !== "undefined" ? window : globalThis);

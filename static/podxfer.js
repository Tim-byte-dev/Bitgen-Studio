/* bitGen Studio — static/podxfer.js (2.766.0): A PROGRESS BAR FOR EACH TRANSFER TO A POD. window.H3PodXfer (+ require() in
 * Node for the pure part).
 *
 * Tim (verbatim): "go with your suggestions and add a progress bar for each transfer to the pod"
 *
 *   mount(host)   the bars in `host` (PODS docker, Model manager in remote mode): each transfer bitGen does - ⬇ a pod
 *                 downloading (Hugging Face, Civitai, your repo, a link), ⬆ this computer sending to a pod, ☁ this computer
 *                 putting a model in your private Hugging Face repo, 🔎 reading a file once to find it on Civitai - with
 *                 its %, size, speed and time left; finished ones stay 10 minutes (✕ Clear takes them off). Hidden when there
 *                 are none. GET /api/pods/transfers every 1.5 s while one runs, else every 8 s.
 *   poke()        look now (something just started)
 * Pure (Node: scripts/test-remotemodels766.js): gb, rowText, rowHtml.
 */
(function (root) {
  "use strict";
  function gb(n) { n = +n || 0; return n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : n >= 1e6 ? Math.round(n / 1e6) + " MB" : n ? Math.round(n / 1e3) + " KB" : "0 MB"; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var ICON = { download: "⬇", upload: "⬆", hf: "☁", hash: "🔎" };
  /** the words under a bar (pure) */
  function rowText(x) {
    var st = String(x.state || "");
    if (st === "done") return (x.size ? gb(x.size) + " · " : "") + "done";
    if (/^failed/.test(st)) return st;
    if (x.note && !(x.done > 0)) return x.note;   // 2.766.1: waiting for the pod to answer
    var bits = [x.size ? gb(x.done) + " of " + gb(x.size) + " (" + (x.pct || 0) + "%)" : gb(x.done)];
    if (x.rate > 0) bits.push((x.rate / 1e6).toFixed(1) + " MB/s");
    if (x.left > 0) bits.push(x.left < 90 ? "under 2 min left" : x.left < 5400 ? "about " + Math.round(x.left / 60) + " min left" : "about " + (x.left / 3600).toFixed(1) + " h left");
    return bits.join(" · ");
  }
  /** what is moving where (pure) */
  function whatText(x) {
    var to = x.pod_name || x.pod;
    if (x.how === "hash") return "reading " + x.name + " to find it on Civitai (once)";
    if (x.how === "hf") return x.name + " → your Hugging Face repo";
    if (x.how === "upload") return x.name + " → " + to + " (from this computer)";
    return x.name + " → " + to + (x.from ? " (from " + x.from + ")" : "");
  }
  function rowHtml(x) {
    var st = String(x.state || ""), bad = /^failed/.test(st), done = st === "done";
    return '<div class="pxRow' + (bad ? " bad" : done ? " done" : "") + '" data-pxid="' + esc(x.id) + '"><div class="pxTop"><span class="pxIc" aria-hidden="true">' + (ICON[x.how] || "⬇") + '</span><span class="pxNm" title="' + esc(whatText(x)) + '">' + esc(whatText(x)) + "</span></div>"
      + '<div class="pxBar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (x.pct || 0) + '" aria-label="' + esc(x.name) + '"><i style="width:' + Math.max(done ? 100 : 2, x.pct || 0) + '%"></i></div>'
      + '<div class="pxSub">' + esc(rowText(x)) + "</div></div>";
  }
  var api = { gb: gb, rowText: rowText, whatText: whatText, rowHtml: rowHtml };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  var doc = root.document, hosts = [], timer = null, last = [];
  var CSS = ".pxBox{display:flex;flex-direction:column;gap:6px;margin:6px 0;padding:6px 8px;border:1px solid var(--line,#3a342a);border-radius:7px;background:var(--panel,#1b1814)}"
    + ".pxBox .pxHd{display:flex;align-items:center;gap:6px;font-size:.74rem;color:var(--dim,#9a917f)}.pxBox .pxHd b{color:var(--text,#eee);font-weight:600}.pxBox .pxHd button{margin-left:auto;padding:1px 7px;font-size:.7rem}"
    + ".pxRow{display:flex;flex-direction:column;gap:2px}.pxTop{display:flex;gap:6px;align-items:center;font-size:.76rem;min-width:0}.pxNm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".pxBar{height:7px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}.pxBar i{display:block;height:100%;background:var(--tiger,#f59e2c);transition:width .4s}"
    + ".pxRow.done .pxBar i{background:#6c6}.pxRow.bad .pxBar i{background:#c55}.pxSub{font-size:.68rem;color:var(--dim,#9a917f)}.pxRow.bad .pxSub{color:#e88}";
  function css() { if (!doc.getElementById("pxCss")) { var s = doc.createElement("style"); s.id = "pxCss"; s.textContent = CSS; doc.head.appendChild(s); } }
  function paint() {
    hosts = hosts.filter(function (h) { return h.isConnected; });
    var running = last.filter(function (x) { return x.state === "running"; }).length;
    hosts.forEach(function (h) {
      if (!last.length) { h.hidden = true; h.innerHTML = ""; return; }
      h.hidden = false;
      h.innerHTML = '<div class="pxBox"><div class="pxHd"><b>Transfers</b><span>' + (running ? running + " running" : "all finished") + "</span>"
        + (last.length > running ? '<button type="button" class="ghost" data-pxclear title="Take the finished ones off the list">✕ Clear</button>' : "") + "</div>" + last.map(rowHtml).join("") + "</div>";
      var c = h.querySelector("[data-pxclear]"); if (c) c.onclick = function () { root.fetch("/api/pods/transfers/clear", { method: "POST" }).then(function () { poke(); }); };
    });
  }
  function poll() {
    clearTimeout(timer);
    if (!hosts.some(function (h) { return h.isConnected; })) { timer = null; return; }
    root.fetch("/api/pods/transfers").then(function (r) { return r.json(); }).then(function (j) {
      last = (j && j.transfers) || []; paint();
      var run = last.some(function (x) { return x.state === "running"; });
      timer = setTimeout(poll, run ? 1500 : 8000);
    }).catch(function () { timer = setTimeout(poll, 8000); });
  }
  function mount(host) { if (!host) return; css(); if (hosts.indexOf(host) < 0) hosts.push(host); paint(); poll(); }
  function poke() { poll(); }
  root.H3PodXfer = Object.assign({ mount: mount, poke: poke }, api);
})(typeof window !== "undefined" ? window : globalThis);

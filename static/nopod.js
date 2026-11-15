/* bitGen Studio — static/nopod.js (2.789.0): A TERMINATED POD'S FILES - KEEP THEM AS "NO_Pod (<old name>)/<file>" OR REMOVE THEM;
 * PICKING ONE ASKS BEFORE THE POD IS MADE AGAIN.
 * Tim (verbatim, the agreed design): "if pod is terminated ask user if they want to remove models from the list, if no, change
 * the podname to NO_Pod, but keep all the model details in a file so if user clicks a nopod/model name, the pod will be
 * recreated and the models uploaded to the new pod"
 *   THE QUESTION  a pod terminated in 🖥 PODS (or found gone) with files in its inventory: "Keep as NO_Pod" (its files stay in
 *                 Basic Settings' lists as NO_Pod (<name>)/<file>) or "Remove from the lists" - GET /api/podinv/asks, POST
 *                 /api/podinv/:id/keep; asked again after a reload until answered (checked every 30 s, and when PODS terminates)
 *   THE PICK      a NO_Pod file picked in Basic Settings (the picture checkpoint, a temporary LoRA row, the video Model) shows the
 *                 old pod's recipe (template, GPU, count, cloud, disk, volume): "Make the pod again" (POST /api/podinv/:id/remake
 *                 {ok: true} - the next render with it makes the pod, lib/noPod.js) or "Not now" (the field emptied). 2.763.4:
 *                 bitGen never makes a gone pod again unasked.
 * Pure (Node: scripts/test-nopod789.js): isNoPod, groupsText, askHtml, pickHtml.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.boot(root);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  function isNoPod(v) { return /^NO_Pod \([^)]*\)\//.test(String(v || "")); }
  function groupsText(groups) { return (groups || []).map(function (g) { return g.n + " " + (g.n === 1 ? String(g.label).replace(/s$/, "").replace(/^VAE$/, "VAE") : g.label); }).join(", "); }
  var BTN = "white-space:nowrap;padding:4px 12px;width:auto;flex:0 0 auto";
  var MAIN = BTN + ";border-color:var(--accent,#e8a33d);color:var(--accent,#e8a33d)";
  function askHtml(a) {
    return '<h3 style="margin:0 0 8px">🖥 ' + esc(a.label) + ' was terminated</h3>'
      + '<p style="margin:0 0 8px">It had ' + esc(groupsText(a.groups) || a.count + " files") + ' on it. Keep them in Basic Settings\' lists as <b>NO_Pod (' + esc(a.label) + ')/&lt;file&gt;</b>? '
      + 'Picking one of them later makes the pod again' + (a.recipe_line ? ' (' + esc(a.recipe_line) + ')' : '') + ' and puts its files back - bitGen asks you first.</p>'
      + (a.recipe_line ? '' : '<p class="dim" style="margin:0 0 8px;color:var(--dim)">bitGen does not know how this pod was made, so it cannot be made again from here - its files can still be sent to another pod.</p>')
      + '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="ghost" style="' + BTN + '" data-npkeep="0">Remove from the lists</button>'
      + '<button type="button" class="ghost" style="' + MAIN + '" data-npkeep="1">Keep as NO_Pod</button></div>';
  }
  function pickHtml(j) {
    var p = j.pod || {};
    if (!p.recipe) return '<h3 style="margin:0 0 8px">' + esc(p.label) + '</h3><p style="margin:0 0 8px">' + esc(j.file) + ' was on a pod that was terminated, and bitGen does not know how that pod was made - it cannot be made again from here. '
      + 'Pick another file, or send this one to a pod with Basic Settings ▸ Remote.</p><div style="display:flex;justify-content:flex-end"><button type="button" class="ghost" style="' + BTN + '" data-npmake="0">OK</button></div>';
    return '<h3 style="margin:0 0 8px">Make ' + esc(p.name) + ' again?</h3>'
      + '<p style="margin:0 0 8px"><b>' + esc(j.file) + '</b> was on <b>' + esc(p.label) + '</b>, a pod that was terminated. Using it makes the pod again the way it was made:</p>'
      + '<p style="margin:0 0 8px;font-family:var(--mono,monospace);font-size:12px">' + esc(p.recipe_line) + '</p>'
      + '<p style="margin:0 0 8px">Its ' + esc(p.count) + (p.count === 1 ? ' model / LoRA is' : ' models and LoRAs are') + ' put back on it (found online first, else sent from this computer). RunPod charges for it while it runs. It is made when you render with this file.</p>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="ghost" style="' + BTN + '" data-npmake="0">Not now</button><button type="button" class="ghost" style="' + MAIN + '" data-npmake="1">Make the pod again</button></div>';
  }

  function boot(win) {
    var doc = win.document, S = { open: false, asked: {}, last: 0 };
    var $ = function (id) { return doc.getElementById(id); };
    function dlg() {
      var d = $("npDlg"); if (d) return d;
      d = doc.createElement("dialog"); d.id = "npDlg"; d.className = "npDlg"; d.style.cssText = "max-width:520px;padding:16px 18px";
      doc.body.appendChild(d); return d;
    }
    function show(html, onClick) {
      var d = dlg(); d.innerHTML = html; S.open = true;
      d.onclick = function (e) { var b = e.target.closest && e.target.closest("button"); if (!b) return; onClick(b, function () { S.open = false; try { d.close(); } catch (x) { /* fine */ } }); };
      d.oncancel = function (e) { e.preventDefault(); };   // an answer is needed (Esc does not drop the question)
      try { if (!d.open) d.showModal(); } catch (e) { d.setAttribute("open", ""); }
    }
    function lists() { try { if (typeof win.loadComfyModels === "function") win.loadComfyModels(true); } catch (e) { /* fine */ } try { doc.dispatchEvent(new Event("h3:nopod")); } catch (e) { /* fine */ } }
    function check() {
      if (S.open) return;
      S.last = Date.now();
      win.fetch("/api/podinv/asks").then(function (r) { return r.json(); }).then(function (j) {
        var a = ((j && j.asks) || [])[0]; if (!a || S.open) return;
        show(askHtml(a), function (b, close) {
          var keep = b.getAttribute("data-npkeep"); if (keep == null) return;
          b.disabled = true;
          win.fetch("/api/podinv/" + encodeURIComponent(a.id) + "/keep", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keep: keep === "1" }) })
            .then(function () { close(); lists(); setTimeout(check, 300); }).catch(function () { b.disabled = false; });
        });
      }).catch(function () { /* asked next time */ });
    }
    /** a NO_Pod file picked in Basic Settings: asks before its pod is made again */
    function picked(el) {
      var v = String(el.value || "").trim(); if (!isNoPod(v) || S.open) return;
      win.fetch("/api/podinv/nopod?name=" + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.pod || j.pod.remake_ok) return;
        show(pickHtml(j), function (b, close) {
          var ok = b.getAttribute("data-npmake"); if (ok == null) return;
          if (ok === "1") {
            b.disabled = true;
            win.fetch("/api/podinv/" + encodeURIComponent(j.pod.id) + "/remake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) })
              .then(function () { close(); }).catch(function () { b.disabled = false; });
            return;
          }
          close();
          el.value = ""; el.dispatchEvent(new Event("change", { bubbles: true }));   // not now = the field emptied (the style's own)
        });
      }).catch(function () { /* the render says it */ });
    }
    doc.addEventListener("change", function (e) {
      var t = e.target; if (!t || !t.matches) return;
      if (t.matches("#imgCkptCombo select.cmfile, #tliRows select.cmfile, #tlvRows select.cmfile, #vidModel")) picked(t);
    }, true);
    doc.addEventListener("h3:podinv", function () { setTimeout(check, 1500); });
    setTimeout(check, 4000); setInterval(check, 30000);
    win.H3NoPod = { check: check, picked: picked, state: function () { return S; } };
  }
  return { isNoPod: isNoPod, groupsText: groupsText, askHtml: askHtml, pickHtml: pickHtml, boot: boot };
});

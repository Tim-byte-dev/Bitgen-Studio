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
 * 2.793.0 NO_POD PART 2 (Tim: "also ask the user if the model + vae + textencoder should be added to an existing pod. show user
 * running pods and stopped pods ... check the full list of pods and models in the pods to see if the model exists in any other
 * pod - advise the user of which pod has it and ask if it should start that pod, create a new pod or add the model to a
 * different pod" + "change the name of the model to pod name/model name"):
 *   THE PICK      GET /api/podinv/nopod/where: the pods that HAVE the file ("Start that pod" / "Use that pod"), then every other
 *                 pod of yours (running first, stopped ones say "starts it") with what it already has and what would be sent
 *                 ("VAE + text encoder there, sends 6.9 GB", "not enough room", "may not fit its 24 GB card") - Use this pod,
 *                 Make the pod again (its recipe), Not now. No other pod = the 2.789.0 box. POST /api/podinv/nopod/use -> the
 *                 field gets the new name "<pod name>/<file>" (whereHtml, rowHtml - pure)
 *   STALE NAMES   every 30 s a field still holding "NO_Pod (x)/…" asks GET /api/podinv/nopod/now - a pod made again from it =
 *                 the field renamed to "<name>/<file>"
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
      + '<p style="margin:0 0 8px">' + (p.groups && p.groups.length ? 'Its files (' + esc(groupsText(p.groups)) + ') are' : 'Its ' + esc(p.count) + (p.count === 1 ? ' model / LoRA is' : ' models and LoRAs are')) + ' put back on it (found online first, else sent from this computer). RunPod charges for it while it runs. It is made when you render with this file.</p>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="ghost" style="' + BTN + '" data-npmake="0">Not now</button><button type="button" class="ghost" style="' + MAIN + '" data-npmake="1">Make the pod again</button></div>';
  }

  /* 2.793.0: the pods a NO_Pod file can run on now */
  function stateWord(r) { return r.status === "running" ? "running" : r.status === "starting" ? "starting" : r.status === "stopped" ? "stopped" : "not checked"; }
  function rowHtml(r, radio, first) {
    var st = '<span style="color:' + (r.status === "running" ? "#5c5" : "var(--dim,#999)") + '">' + esc(stateWord(r)) + (r.status === "stopped" ? " - starts it" : "") + '</span>';
    var w = r.words ? ' · <span' + ((r.warn || []).length ? ' style="color:var(--bad,#e66)"' : '') + '>' + esc(r.words) + '</span>' : '';
    if (radio) return '<label class="nprow" style="display:block;margin:3px 0;cursor:pointer"><input type="radio" name="npPod" value="' + esc(r.id) + '"' + (first ? ' checked' : '') + '> 🖥 <b>' + esc(r.name) + '</b> · ' + st + w + '</label>';
    return '<div class="nprow" style="display:flex;gap:8px;align-items:center;margin:3px 0"><span style="flex:1">🖥 <b>' + esc(r.name) + '</b> · ' + st + w + '</span>'
      + '<button type="button" class="ghost" style="' + MAIN + '" data-npuse="' + esc(r.id) + '">' + (r.status === "stopped" ? "Start that pod" : "Use that pod") + '</button></div>';
  }
  function whereHtml(j) {
    var p = j.pod || {}, has = j.has || [], oth = j.others || [];
    var h = '<h3 style="margin:0 0 8px">' + esc(j.file) + ' was on ' + esc(p.label) + '</h3>'
      + '<p style="margin:0 0 8px">That pod was terminated.' + ((j.companions || []).length ? ' It renders with ' + esc(j.companions.join(" + ")) + ' - they go with it.' : '') + '</p>';
    if (has.length) h += '<p style="margin:8px 0 2px"><b>' + (has.length === 1 ? 'This pod has it:' : 'These pods have it:') + '</b></p>' + has.map(function (r) { return rowHtml(r, false); }).join("");
    if (oth.length) h += '<p style="margin:10px 0 2px"><b>' + (has.length ? 'Or put it on another pod:' : 'Put it on one of your pods:') + '</b> <span style="color:var(--dim,#999)">(only what the pod does not have is sent)</span></p>'
      + oth.map(function (r, i) { return rowHtml(r, true, i === 0); }).join("");
    if (j.runpod_error) h += '<p style="margin:6px 0;color:var(--dim,#999);font-size:12px">RunPod did not say which pods run: ' + esc(j.runpod_error) + '</p>';
    if (p.recipe) h += '<p style="margin:10px 0 2px;color:var(--dim,#999);font-size:12px">Or make the pod again the way it was made: <span style="font-family:var(--mono,monospace)">' + esc(p.recipe_line) + '</span></p>';
    h += '<p class="npmsg" style="margin:6px 0;min-height:1em;color:var(--bad,#e66)"></p>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="ghost" style="' + BTN + '" data-npmake="0">Not now</button>'
      + (p.recipe ? '<button type="button" class="ghost" style="' + BTN + '" data-npmake="1">Make the pod again</button>' : '')
      + (oth.length ? '<button type="button" class="ghost" style="' + MAIN + '" data-npusesel="1">Use this pod</button>' : '') + '</div>';
    return h;
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
    /** 2.793.0: the field gets a new name (a select gets the option when its list does not have it yet) */
    function setField(el, name) {
      if (el.tagName === "SELECT" && ![].some.call(el.options, function (o) { return o.value === name; })) { var o = doc.createElement("option"); o.value = name; o.textContent = name; el.appendChild(o); }
      el.value = name; el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    var FIELDS = "#imgCkptCombo select.cmfile, #tliRows select.cmfile, #tlvRows select.cmfile, #vidModel";
    /** 2.793.0: fields still holding a NO_Pod name whose pod was made again - renamed to "<name>/<file>" */
    function renameStale() {
      [].forEach.call(doc.querySelectorAll(FIELDS), function (el) {
        var v = String(el.value || "").trim(); if (!isNoPod(v)) return;
        win.fetch("/api/podinv/nopod/now?name=" + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.found && j.name && j.name !== v && String(el.value || "").trim() === v) { setField(el, j.name); lists(); }
        }).catch(function () { /* next time */ });
      });
    }
    function useIt(el, v, pod, b, d, close) {
      var msg = d.querySelector(".npmsg"); if (msg) msg.textContent = "";
      [].forEach.call(d.querySelectorAll("button"), function (x) { x.disabled = true; });
      b.textContent = "⏳ " + b.textContent;
      win.fetch("/api/podinv/nopod/use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: v, pod: pod }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok || !x.j || !x.j.name) throw new Error((x.j && x.j.error) || "the pod could not be used");
          close(); setField(el, x.j.name); lists();
          var said = x.j.name + (x.j.started ? " - the pod is starting" : "") + (x.j.sending && x.j.sending.length ? " - sending " + x.j.sending.join(", ") + " (🖥 PODS shows it)" : "");
          try { if (typeof win.appNote === "function") win.appNote(said); } catch (e) { /* fine */ }
          S.lastUse = x.j;
        })
        .catch(function (e) { [].forEach.call(d.querySelectorAll("button"), function (x) { x.disabled = false; }); b.textContent = b.textContent.replace(/^⏳ /, ""); if (msg) msg.textContent = String((e && e.message) || e); });
    }
    /** a NO_Pod file picked in Basic Settings: asks where it runs now (2.793.0) / before its pod is made again */
    function picked(el) {
      var v = String(el.value || "").trim(); if (!isNoPod(v) || S.open) return;
      win.fetch("/api/podinv/nopod/where?name=" + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.pod || j.pod.remake_ok) return;
        var many = (j.has || []).length + (j.others || []).length > 0;
        show(many ? whereHtml(j) : pickHtml(j), function (b, close) {
          var d = $("npDlg"), use = b.getAttribute("data-npuse");
          if (use) return useIt(el, v, use, b, d, close);
          if (b.getAttribute("data-npusesel") != null) { var r = d.querySelector('input[name="npPod"]:checked'); if (!r) { d.querySelector(".npmsg").textContent = "Pick a pod first"; return; } return useIt(el, v, r.value, b, d, close); }
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
      if (t.matches(FIELDS)) picked(t);
    }, true);
    doc.addEventListener("h3:podinv", function () { setTimeout(check, 1500); setTimeout(renameStale, 2500); });
    setTimeout(check, 4000); setInterval(function () { check(); renameStale(); }, 30000);
    win.H3NoPod = { check: check, picked: picked, renameStale: renameStale, state: function () { return S; } };
  }
  return { isNoPod: isNoPod, groupsText: groupsText, askHtml: askHtml, pickHtml: pickHtml, rowHtml: rowHtml, whereHtml: whereHtml, boot: boot };
});

/* bitGen Studio — static/podfiles.js (2.781.2): A POD'S MODEL FILES + HOW ITS COMFYUI USES THE CARD, in 🖥 PODS ▸ My pods
 * (window.H3PodFiles; lib/podFiles.js + lib/podVram.js, routes/podFiles.js).
 * Tim (verbatim): "add model files available on pod, allow user to delete model files from pod" + "I think comfy is not using
 * vram thats why the renders are so slow"
 *   📁 Files (a running pod's item, beside ⬇ Models) opens the list under My pods: the pod's disk (used / free), every model
 *   file by folder with its size (🔗 = a link bitGen made, ⏳ = a download that did not finish), ☐ each, ☐ a whole folder,
 *   🗑 Delete selected (asked first) - the pod's room back; bitGen forgets them for that pod.
 *   GPU memory (each open running pod): Keep the models on the card (default) | ComfyUI's Dynamic VRAM - one setting for
 *   every pod (rgpu.pod_vram); ⟳ Apply restarts that pod's ComfyUI that way now (a new pod starts that way by itself).
 * Pure (Node: scripts/test-podfiles7812.js): gb, groups, picked, vramLine.
 */
(function (root) {
  "use strict";
  function gb(n) { n = +n || 0; return n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : n >= 1e6 ? Math.round(n / 1e6) + " MB" : Math.max(0, Math.round(n / 1e3)) + " KB"; }
  /** files -> [{folder, files, size}] by folder, folders in order */
  function groups(files) {
    var by = {}, order = [];
    (files || []).forEach(function (f) { var k = f.folder || ""; if (!by[k]) { by[k] = { folder: k, files: [], size: 0 }; order.push(k); } by[k].files.push(f); by[k].size += f.link ? 0 : (+f.size || 0); });
    return order.sort().map(function (k) { return by[k]; });
  }
  /** the ticked paths -> {n, size, paths} */
  function picked(files, sel) {
    var paths = [], size = 0;
    (files || []).forEach(function (f) { if (sel && sel[f.path]) { paths.push(f.path); size += f.link ? 0 : (+f.size || 0); } });
    return { n: paths.length, size: size, paths: paths };
  }
  /** the GPU memory line's words (st = the restart's state) */
  function vramLine(mode, st) {
    if (st && st.running) return "⏳ " + (st.note || "restarting ComfyUI");
    if (st && st.note) return st.note;
    return mode === "dynamic" ? "ComfyUI keeps the models in the pod's RAM and streams them to the card (for small cards)"
      : "the models stay on the card between renders (cards of 24 GB or more) - a new pod starts this way";
  }
  var pure = { gb: gb, groups: groups, picked: picked, vramLine: vramLine };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, F = { pod: null, data: null, sel: {}, ask: false, busy: false, msg: "" }, V = { mode: "gpu", st: {} };
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getJ(u) { return root.fetch(u).then(function (r) { return r.json(); }).catch(function (e) { return { error: String(e) }; }); }
  function postJ(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }).catch(function (e) { return { error: String(e) }; }); }

  /* ---------- 📁 Files */
  function paint(host) {
    var p = F.pod; if (!p) { host.innerHTML = ""; return; }
    var d = F.data, h = '<div class="pfBox" style="border:1px solid var(--line,#333);border-radius:6px;padding:8px;margin:8px 0">'
      + '<div style="display:flex;gap:8px;align-items:center"><b>📁 Model files on ' + esc(p.name || p.id) + "</b>"
      + '<button type="button" class="ghost" data-pfre title="Read the list again">⟳</button>'
      + '<button type="button" class="ghost" data-pfx style="margin-left:auto" title="Close">✕</button></div>';
    if (F.busy && !d) h += '<div class="hint">⏳ asking the pod…</div>';
    else if (d && d.error) h += '<div class="hint" style="color:#e88">✗ ' + esc(d.error) + "</div>";
    else if (d) {
      var dk = d.disk;
      h += '<div class="hint" style="margin:4px 0">' + (dk ? "disk " + gb(dk.used) + " of " + gb(dk.total) + " used · <b>" + gb(dk.free) + " free</b> · " : "")
        + d.files.length + " model file" + (d.files.length === 1 ? "" : "s") + ", " + gb(d.total) + "</div>";
      if (!d.files.length) h += '<div class="hint">No model files on the pod yet.</div>';
      groups(d.files).forEach(function (g) {
        var all = g.files.every(function (f) { return F.sel[f.path]; });
        h += '<div class="pfGrp" style="margin-top:6px"><div style="display:flex;gap:8px;align-items:center"><label class="chk" style="margin:0;font-weight:600"><input type="checkbox" data-pfgrp="' + esc(g.folder) + '"' + (all ? " checked" : "") + "> 📂 " + esc(g.folder || "models") + '</label><span class="hint">' + gb(g.size) + "</span></div>"
          + g.files.map(function (f) {
            return '<div style="display:flex;gap:8px;align-items:center;padding-left:18px"><label class="chk" style="margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(f.path + (f.link ? " → " + f.target : "")) + '">'
              + '<input type="checkbox" data-pfsel="' + esc(f.path) + '"' + (F.sel[f.path] ? " checked" : "") + "> " + (f.partial ? "⏳ " : f.link ? "🔗 " : "") + esc(f.name) + "</label>"
              + '<span class="hint" style="white-space:nowrap">' + (f.link ? "link" : gb(f.size)) + (f.partial ? " · not finished" : "") + "</span></div>";
          }).join("") + "</div>";
      });
      var s = picked(d.files, F.sel);
      h += '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">'
        + '<button type="button" class="ghost" data-pfall>' + (s.n === d.files.length && s.n ? "Select none" : "Select all") + "</button>"
        + '<button type="button" class="ghost" data-pfdel' + (s.n && !F.busy ? "" : " disabled") + ">🗑 Delete selected" + (s.n ? " (" + s.n + ", " + gb(s.size) + ")" : "") + "</button></div>";
      if (F.ask && s.n) h += '<div class="pdKill" style="margin-top:6px">Delete <b>' + s.n + "</b> file" + (s.n === 1 ? "" : "s") + " (" + gb(s.size) + ") from the pod? A style that needs one sends or downloads it again on its next render. "
        + '<button type="button" class="ghost" data-pfyes>Delete</button> <button type="button" class="ghost" data-pfno>Cancel</button></div>';
    }
    if (F.msg) h += '<div class="hint" style="margin-top:6px" aria-live="polite">' + esc(F.msg) + "</div>";
    host.innerHTML = h + "</div>";
    var q = function (s) { return host.querySelector(s); };
    q("[data-pfx]").onclick = function () { close(host); };
    q("[data-pfre]").onclick = function () { load(host); };
    host.querySelectorAll("[data-pfsel]").forEach(function (c) { c.onchange = function () { F.sel[c.dataset.pfsel] = c.checked; F.ask = false; paint(host); }; });
    host.querySelectorAll("[data-pfgrp]").forEach(function (c) { c.onchange = function () { (F.data.files || []).forEach(function (f) { if (f.folder === c.dataset.pfgrp) F.sel[f.path] = c.checked; }); F.ask = false; paint(host); }; });
    var a = q("[data-pfall]"); if (a) a.onclick = function () { var s = picked(F.data.files, F.sel), on = !(s.n === F.data.files.length); F.data.files.forEach(function (f) { F.sel[f.path] = on; }); F.ask = false; paint(host); };
    var dl = q("[data-pfdel]"); if (dl) dl.onclick = function () { F.ask = true; paint(host); };
    var y = q("[data-pfyes]"); if (y) y.onclick = function () { del(host); };
    var n = q("[data-pfno]"); if (n) n.onclick = function () { F.ask = false; paint(host); };
  }
  function load(host) {
    F.busy = true; F.msg = ""; paint(host);
    getJ("/api/pods/" + encodeURIComponent(F.pod.id) + "/files" + (F.port ? "?port=" + F.port : "")).then(function (j) {
      F.busy = false; F.data = j && !j.error ? j : { error: (j && j.error) || "no answer" };
      var keep = {}; ((F.data.files) || []).forEach(function (f) { if (F.sel[f.path]) keep[f.path] = true; }); F.sel = keep;
      paint(host);
    });
  }
  function del(host) {
    var s = picked(F.data.files, F.sel); if (!s.n) return;
    F.busy = true; F.ask = false; F.msg = "⏳ deleting " + s.n + " file" + (s.n === 1 ? "" : "s") + " on the pod…"; paint(host);
    postJ("/api/pods/" + encodeURIComponent(F.pod.id) + "/files/delete", { paths: s.paths, port: F.port || 0 }).then(function (j) {
      F.busy = false;
      if (!j || j.error) { F.msg = "✗ " + ((j && j.error) || "no answer"); paint(host); return; }
      F.sel = {};
      var bad = (j.failed || []).map(function (x) { return x.path.split("/").pop() + ": " + x.why; });
      F.msg = "✓ deleted " + j.deleted.length + (j.disk ? " - " + gb(j.disk.free) + " free now" : "") + (bad.length ? " · ✗ " + bad.join("; ") : "");
      var m = F.msg; load(host); F.msg = m;
    });
  }
  function close(host) { F.pod = null; F.data = null; F.sel = {}; F.ask = false; host.innerHTML = ""; }
  /** PODS ▸ My pods ▸ 📁 Files (static/podsdock.js) - the panel under the list; again = closed */
  function open(host, p, port) {
    if (F.pod && F.pod.id === p.id && host.innerHTML) { close(host); return false; }
    F.pod = { id: p.id, name: p.name }; F.port = +port || 0; F.data = null; F.sel = {}; F.ask = false;
    load(host); return true;
  }

  /* ---------- GPU memory (each open running pod) */
  function vramRow(row, id) {
    var box = row.querySelector(".pvRow");
    if (!box) {
      var after = row.querySelector(".pdStats"); if (!after) return;
      box = doc.createElement("div"); box.className = "pvRow"; box.style.cssText = "display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;margin:4px 0";
      after.parentNode.insertBefore(box, after.nextSibling);
    }
    var st = V.st[id], h = '<span class="hint" title="How the pod\'s ComfyUI uses its graphics card\'s memory">GPU memory</span>'
      + '<select data-pvmode style="width:auto"><option value="gpu"' + (V.mode === "gpu" ? " selected" : "") + ">Keep the models on the card</option>"
      + '<option value="dynamic"' + (V.mode === "dynamic" ? " selected" : "") + ">ComfyUI's Dynamic VRAM</option></select>"
      + '<button type="button" class="ghost" data-pvapply' + (st && st.running ? " disabled" : "") + ' title="Restart this pod\'s ComfyUI the way picked (a render running on it stops)">⟳ Apply to this pod</button>'
      + '<span class="hint pvLine" style="flex-basis:100%;font-size:.7rem" aria-live="polite">' + esc(vramLine(V.mode, st)) + "</span>";
    if (box.dataset.sig === h) return;
    box.dataset.sig = h; box.innerHTML = h;
    box.querySelector("[data-pvmode]").onchange = function (e) {
      postJ("/api/pod-vram", { mode: e.target.value }).then(function (j) { if (j && j.mode) { V.mode = j.mode; sweep(); } });
    };
    box.querySelector("[data-pvapply]").onclick = function () {
      V.st[id] = { running: true, note: "asking the pod" }; sweep();
      postJ("/api/pods/" + encodeURIComponent(id) + "/vram/apply", {}).then(function (j) { V.st[id] = j && !j.error ? j : { note: "✗ " + ((j && j.error) || "no answer") }; sweep(); watch(id); });
    };
  }
  function watch(id) {
    if (!(V.st[id] && V.st[id].running)) return;
    setTimeout(function () { getJ("/api/pods/" + encodeURIComponent(id) + "/vram").then(function (j) { if (j && j.state) V.st[id] = j.state; sweep(); watch(id); }); }, 3000);
  }
  function sweep() { doc.querySelectorAll("#pdPods .pdRow[data-pod]").forEach(function (row) { if (row.querySelector(".pdStats")) vramRow(row, row.dataset.pod); }); }
  function boot() {
    var host = doc.getElementById("pdPods");
    if (!host) { setTimeout(boot, 500); return; }
    getJ("/api/pod-vram").then(function (j) { if (j && j.mode) V.mode = j.mode; sweep(); });
    new MutationObserver(function () { sweep(); }).observe(host, { childList: true, subtree: true });
  }
  root.H3PodFiles = Object.assign({ open: open, close: close }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);

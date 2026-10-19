/* bitGen Studio — ext/timelinedock/mogrt.js (2.417.0): 🧩 MOTION GRAPHICS TEMPLATES (window.TlMogrt) - Premiere's
 * Essential Graphics: a designed title (picture + text layers, their ◆ keyframes, text presets) saved once as a
 * template, then dropped in again at the playhead with its words changed and scaled to the picture.
 * The maths: static/mogrt.js (H3Mogrt); the files: lib/mogrt.js (built-ins in <app>/mogrt, saved ones in mogrt/user).
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior". */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlDlg && window.TlCanvas && window.H3Mogrt && typeof tl !== "undefined"); } catch (e) { return false; } }
  var dlg = null, list = [], cur = null;
  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.error || "HTTP " + r.status); return j; }); });
  }
  function msg(t) { var m = $("tmgMsg"); if (m) m.textContent = t; }
  function stop(el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); }
  function playhead() { return TlCanvas.state && TlCanvas.state.t != null ? TlCanvas.state.t : 0; }
  function sub(L) {
    var c = (L.clips || []).filter(function (x) { return x.text; })[0];
    return c ? "“" + String(c.text.content || "").split("\n")[0].slice(0, 30) + "”" : (L.clips || []).map(function (x) { return x.name; }).join(", ").slice(0, 40);
  }
  /* the layers the save would take: picture / text layers (not an adjustment layer) - ticked when they are under the
     playhead or hold the selected clip */
  function candidates() {
    var t = playhead(), sel = null;
    try { sel = TlCanvas.selClip ? TlCanvas.selClip() : null; } catch (e) { sel = null; }
    return (tl.images || []).map(function (L, i) {
      var any = (L.clips || []).some(function (c) { return !c.adjust && (c.text || c.name); });
      if (!any) return null;
      var under = (L.clips || []).some(function (c) { return t >= (c.start || 0) - 1e-6 && t < (c.start || 0) + (+c.len || 3); });
      var has = sel && (L.clips || []).indexOf(sel.c || sel) >= 0;
      return { i: i, L: L, on: under || has };
    }).filter(Boolean);
  }
  function paintSave() {
    var C = candidates();
    var el = $("tmgLayers"); if (!el) return;
    el.innerHTML = C.length ? C.map(function (x) {
      return '<label style="display:block"><input type="checkbox" class="tmgL" data-i="' + x.i + '"' + (x.on ? " checked" : "") + "> " + esc(x.L.name) + ' <span class="fx-dim">' + esc(sub(x.L)) + "</span></label>";
    }).join("") : '<div class="fx-dim">No picture or text layers on this timeline yet - add a text (T on the canvas) or a picture first.</div>';
    Array.prototype.forEach.call(el.querySelectorAll(".tmgL"), function (b) { b.onchange = paintLabels; });
    paintLabels();
  }
  function picked() {
    return Array.prototype.filter.call(document.querySelectorAll(".tmgL"), function (b) { return b.checked; })
      .map(function (b) { return tl.images[+b.dataset.i]; }).filter(Boolean);
  }
  function paintLabels() {
    var el = $("tmgLabels"); if (!el) return;
    var out = [];
    picked().filter(function (L) { return (L.clips || []).some(function (c) { return !c.adjust && (c.text || c.name); }); }).forEach(function (L, li) {
      (L.clips || []).filter(function (c) { return !c.adjust && (c.text || c.name); }).forEach(function (c, ci) {
        if (!c.text) return;
        var key = "L" + li + "C" + ci;
        out.push('<label style="display:block">field <input type="text" class="tmgLab" data-k="' + key + '" value="' + esc(String(c.text.content || "").split("\n")[0].slice(0, 40) || "Text")
          + '" style="width:160px"> <span class="fx-dim">' + esc(String(c.text.content || "").slice(0, 40)) + "</span></label>");
      });
    });
    el.innerHTML = out.length ? '<div class="fx-dim">The editable texts (their names in the template):</div>' + out.join("") : "";
    Array.prototype.forEach.call(el.querySelectorAll("input"), stop);
  }
  function save() {
    var labels = {};
    Array.prototype.forEach.call(document.querySelectorAll(".tmgLab"), function (x) { if (x.value.trim()) labels[x.dataset.k] = x.value.trim(); });
    var S = TlCanvas.state, tpl;
    try { tpl = H3Mogrt.capture(picked(), { name: $("tmgName").value.trim() || "My template", w: S.W, h: S.H, labels: labels }); }
    catch (e) { msg("⚠ " + e.message); return Promise.resolve(null); }
    return api("POST", "/api/mogrt", tpl).then(function (j) {
      msg("✓ saved “" + j.name + "” - " + j.layers + " layer(s), " + j.fields + " editable text(s)" + (j.pictures ? ", " + j.pictures + " picture(s) kept with it" : ""));
      return refresh(j.id);
    }).catch(function (e) { msg("⚠ " + e.message); });
  }
  function paintPick() {
    var el = $("tmgFields"); if (!el) return;
    cur = list.filter(function (x) { return x.id === $("tmgList").value; })[0] || null;
    if (!cur) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="fx-dim">' + esc(cur.description || "") + " · " + cur.layers + " layer(s) · " + cur.len.toFixed(1) + " s" + (cur.builtin ? " · built in" : " · saved") + "</div>"
      + cur.fields.map(function (f) {
        var ty = f.type === "color" ? 'type="color"' : f.type === "num" ? 'type="number" step="any" style="width:90px"' : 'type="text" style="width:260px"';   // 2.511.0: 📋 exposed fields
        return '<div class="fx-row"><label>' + esc(f.label) + ' <input ' + ty + ' id="tmgF_' + esc(f.key) + '" value="' + esc(f.value) + '"></label></div>';
      }).join("");
    Array.prototype.forEach.call(el.querySelectorAll("input"), stop);
    var d = $("tmgDel"); if (d) d.disabled = !!cur.builtin;
  }
  var seq = 0;
  function refresh(sel) {
    var my = ++seq;
    return api("GET", "/api/mogrt").then(function (j) {
      if (my !== seq) return list;              // 2.418.0: an older answer (the dialog's first list) never wins over a newer one
      list = j.templates || [];
      var s = $("tmgList"); if (!s) return list;
      var keep = sel || s.value;
      s.innerHTML = list.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + (x.builtin ? "" : " ★") + "</option>"; }).join("");
      if (keep && list.some(function (x) { return x.id === keep; })) s.value = keep;
      paintPick();
      return list;
    }).catch(function (e) { msg("⚠ " + e.message); return []; });
  }
  /** drop template `id` in at `at` (default: the playhead) with `values` ({key: text}) - returns the new layers */
  function insert(id, values, at) {
    return api("POST", "/api/mogrt/" + encodeURIComponent(id) + "/place").then(function (j) {
      var S = TlCanvas.state;
      var layers = H3Mogrt.instantiate(j.template, { at: at != null ? at : playhead(), w: S.W, h: S.H, values: values || {},
        newId: function () { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); } });
      var made = layers.map(function (x) {
        var L = mkLayer(x.name, x.clips);
        if (x.text) L.text = true;
        if (x.opacity != null) L.opacity = x.opacity;
        L.mogrt = id;
        tl.images.push(L);
        x.clips.forEach(function (c) { if (c.text) TlCanvas.uploadText(c); });
        return L;
      });
      if (typeof tlSave === "function") tlSave();
      if (typeof renderTimeline === "function") renderTimeline();
      if (typeof refreshAssets === "function" && j.template.copied && j.template.copied.length) refreshAssets();
      try { TlCanvas.paintLayers(); } catch (e) { /* closed */ }
      TlCanvas.mark();
      if (typeof logLine === "function") logLine("[mogrt] " + j.template.name + " at " + (+((at != null ? at : playhead()))).toFixed(2) + "s - " + made.length + " layer(s)");
      return made;
    });
  }
  function paint() {
    dlg.body.innerHTML = '<fieldset><legend>Drop in a template</legend>'
      + '<div class="fx-row"><select id="tmgList" style="flex:1"></select><button type="button" id="tmgInsert">⤓ Insert at the playhead</button>'
      + '<button type="button" class="ghost" id="tmgDel" title="Delete this saved template">🗑</button></div>'
      + '<div id="tmgFields"></div></fieldset>'
      + '<fieldset><legend>Save as a template</legend>'
      + '<div class="fx-dim">The picture / text layers you tick - with their moves, ◆ keyframes, text presets and opacity - become a template every project can use; each text becomes a field you fill in when you drop it in.</div>'
      + '<div id="tmgLayers"></div><div id="tmgLabels"></div>'
      + '<div class="fx-row"><label>name <input type="text" id="tmgName" value="My template" style="width:180px"></label><button type="button" id="tmgSave">💾 Save as a template</button></div>'
      + '</fieldset><div class="fx-dim" id="tmgMsg"></div>';
    stop($("tmgName"));
    $("tmgList").onchange = paintPick;
    $("tmgInsert").onclick = function () {
      if (!cur) return;
      var v = {};
      cur.fields.forEach(function (f) { var x = $("tmgF_" + f.key); if (x) v[f.key] = x.value; });
      insert(cur.id, v).then(function (m) { msg("✓ " + cur.name + " dropped in - " + m.length + " layer(s) at " + playhead().toFixed(2) + " s"); })
        .catch(function (e) { msg("⚠ " + e.message); });
    };
    $("tmgDel").onclick = function () {
      if (!cur || cur.builtin || !confirm("Delete the template “" + cur.name + "”?")) return;
      api("DELETE", "/api/mogrt/" + encodeURIComponent(cur.id)).then(function () { msg("deleted"); return refresh(); }).catch(function (e) { msg("⚠ " + e.message); });
    };
    $("tmgSave").onclick = save;
    paintSave();
    refresh();
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlMogrtDlg", title: "Motion graphics templates", width: 600 });
      dlg.foot.innerHTML = '<button type="button" id="tmgDone">Done</button>';
      $("tmgDone").onclick = function () { dlg.close(); };
    }
    paint(); dlg.open();
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlMogrtBtn", "🧩", "Motion graphics templates: save titles as templates, drop them in with new words", open);
  }
  window.TlMogrt = { open: open, insert: insert, save: save, refresh: refresh };
  boot();
})();

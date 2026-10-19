/* bitGen Studio — ext/timelinedock/tldata.js (2.511.0): 📋 DATA-DRIVEN ANIMATION (CSV / JSON) and 📋 TEMPLATE FIELDS.
 * window.TlData.
 *
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 6: "Data-driven animation from CSV / JSON, plus exposed
 * template fields" (AFTER-EFFECTS-GAP.md: "the templates have fixed fields").
 *
 *   📋 Data (any layer's Properties)   ⤓ import a CSV or JSON file as a named DATA SET (saved with the timeline:
 *                                      tl.data); its current row (1..n) - switch it and everything that reads it changes.
 *     in a text                        {{set.column}} = the current row's value, {{set.column.3}} = row 3's
 *     in ƒx                            data("set", "column") / data("set", "column", row) - a number
 *     📋 Data → keys                   a column keyed onto a property: one row every `s per row` seconds (rows from ..
 *                                      to), the value as it is or scaled (x factor + offset) - bar charts, counters...
 *   📋 Template fields                 expose this layer's properties (its text colour, opacity, scale, x, y, turn) with a
 *                                      label: every exposed field of the timeline is listed to edit in one place, and a
 *                                      🧩 template saved from these layers offers them when it is dropped in
 *                                      (static/mogrt.js: fields of type num / color).
 * Pure (Node: scripts/test-data.js): parseCSV, parseJSON, fromText(name, text), fill(text, sets), value(sets, set,
 *   col, row), columnKeys(set, col, o).
 */
(function (root) {
  "use strict";
  var MAXR = 5000, MAXC = 100;
  /** CSV (commas or semicolons or tabs, "quoted", "" inside quotes, CRLF) -> {cols, rows} (the first line = the columns) */
  function parseCSV(text) {
    var s = String(text || "").replace(/^﻿/, ""), first = s.split(/\r?\n/)[0] || "";
    var sep = [",", ";", "\t"].map(function (c) { return [c, first.split(c).length]; }).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(function (x) { return x !== ""; })) rows.push(row); row = []; }
      else cell += ch;
    }
    row.push(cell); if (row.some(function (x) { return x !== ""; })) rows.push(row);
    if (!rows.length) return { cols: [], rows: [] };
    var cols = rows[0].map(function (c, k) { return String(c).trim() || "col" + (k + 1); }).slice(0, MAXC);
    return { cols: cols, rows: rows.slice(1, MAXR + 1).map(function (r) { return cols.map(function (_, k) { return r[k] == null ? "" : String(r[k]).trim(); }); }) };
  }
  /** JSON: [ {..}, .. ] | {cols, rows} | { col: [..], .. } | { key: [ {..} ] } -> {cols, rows} */
  function parseJSON(text) {
    var j = typeof text === "string" ? JSON.parse(text) : text;
    if (j && !Array.isArray(j) && Array.isArray(j.cols) && Array.isArray(j.rows)) return { cols: j.cols.map(String).slice(0, MAXC), rows: j.rows.slice(0, MAXR).map(function (r) { return j.cols.slice(0, MAXC).map(function (_, k) { return r[k] == null ? "" : String(r[k]); }); }) };
    if (j && !Array.isArray(j) && typeof j === "object") {
      var ks = Object.keys(j), arr = ks.filter(function (k) { return Array.isArray(j[k]); });
      if (arr.length === 1 && j[arr[0]].length && typeof j[arr[0]][0] === "object") j = j[arr[0]];
      else if (arr.length && arr.length === ks.length) { var n = Math.max.apply(null, arr.map(function (k) { return j[k].length; })); var o = []; for (var i = 0; i < n; i++) { var r = {}; arr.forEach(function (k) { r[k] = j[k][i]; }); o.push(r); } j = o; }
      else j = [j];
    }
    if (!Array.isArray(j)) throw new Error("not a list of records");
    var cols = [];
    j.slice(0, MAXR).forEach(function (r) { if (r && typeof r === "object") Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0 && cols.length < MAXC) cols.push(k); }); });
    return { cols: cols, rows: j.slice(0, MAXR).map(function (r) { return cols.map(function (k) { var v = r && r[k]; return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); }); }) };
  }
  var nameOf = function (n) { return String(n || "data").replace(/\.[a-z0-9]+$/i, "").replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "data"; };
  /** a file's text -> {name, cols, rows, row: 1} (JSON when it looks like JSON) */
  function fromText(name, text) {
    var t = String(text || "").trim(), d = /^[[{]/.test(t) || /\.json$/i.test(name || "") ? parseJSON(t) : parseCSV(t);
    if (!d.cols.length) throw new Error("no columns in " + (name || "the file"));
    return { name: nameOf(name), cols: d.cols, rows: d.rows, row: 1 };
  }
  /** a value: set, column (name or 1-based number), row (1-based; default the set's current row) -> a string (null = none) */
  function value(sets, set, col, row) {
    var S = sets && sets[set]; if (!S) return null;
    var k = S.cols.indexOf(String(col)); if (k < 0 && /^\d+$/.test(String(col))) k = +col - 1; if (k < 0 || k >= S.cols.length) return null;
    var r = row == null ? (S.row || 1) : Math.round(+row); r = Math.max(1, Math.min(S.rows.length, r)); if (!S.rows.length) return null;
    return S.rows[r - 1][k];
  }
  /** {{set.col}} / {{set.col.N}} in a text filled from the data (left as written when unknown) */
  function fill(text, sets) {
    return String(text == null ? "" : text).replace(/\{\{\s*([A-Za-z0-9_]+)\.([^{}.]+?)(?:\.(\d+))?\s*\}\}/g, function (all, s, c, n) { var v = value(sets, s, c.trim(), n ? +n : null); return v == null ? all : v; });
  }
  var numOf = function (v) { var x = parseFloat(String(v == null ? "" : v).replace(/[, ]/g, "")); return isFinite(x) ? x : NaN; };
  /** a column as keys [[tau, v]]: row r at (r - from) * spr; o: {spr, from, to, mul, add} */
  function columnKeys(S, col, o) {
    o = o || {}; var out = [], k = S.cols.indexOf(String(col)); if (k < 0) return out;
    var a = Math.max(1, Math.round(+o.from || 1)), b = Math.min(S.rows.length, Math.round(+o.to || S.rows.length)), spr = Math.max(1 / 24, +o.spr || 1), m = o.mul == null ? 1 : +o.mul, ad = +o.add || 0;
    for (var r = a; r <= b; r++) { var v = numOf(S.rows[r - 1][k]); if (isFinite(v)) out.push([(r - a) * spr, Math.round((v * m + ad) * 10000) / 10000]); }
    return out;
  }
  var pure = { MAXR: MAXR, parseCSV: parseCSV, parseJSON: parseJSON, fromText: fromText, nameOf: nameOf, value: value, fill: fill, numOf: numOf, columnKeys: columnKeys };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  var sets = function () { try { return (tl && tl.data && tl.data.sets) || {}; } catch (e) { return {}; } };
  root.TlData = Object.assign({ ready: false }, pure, { fillWith: fill, fill: function (t) { return fill(t, sets()); }, get: function (s, c, r) { return value(sets(), s, c, r); },
    num: function (s, c, r) { return numOf(value(sets(), s, c, r)); }, sets: sets });          // the page's fill / get read the timeline's data
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.keysChanged && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlData.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function texts() { var o = []; (tl.images || []).forEach(function (L) { (L.clips || []).forEach(function (c) { if (c.text && /\{\{/.test(String(c.text.content || ""))) o.push(c); }); }); return o; }
    /** the data changed: texts that read it are drawn (and sent up) again, the bakes that may read it redone */
    function changed(repaint) {
      texts().forEach(function (c) { try { C.saveTextPng(c); } catch (e) { /* closed */ } delete c.bakeSig; });
      (window.TlParent ? TlParent.all() : []).forEach(function (x) { if (x.c.expr) { delete x.c.bakeSig; delete x.c.vbakeSig; } });
      if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps();
    }
    function add(name, text) {
      var d = fromText(name, text); tl.data = tl.data || {}; tl.data.sets = tl.data.sets || {};
      var nm = d.name, k = 2; while (tl.data.sets[nm] && tl.data.sets[nm]._file !== name) nm = d.name + "_" + k++;
      tl.data.sets[nm] = { cols: d.cols, rows: d.rows, row: 1, _file: String(name || "").slice(0, 80) };
      changed(true); return nm;
    }
    var PROPS = ["op", "scale", "x", "y", "rot"], PNAME = { op: "opacity (0..1)", scale: "scale", x: "x px", y: "y px", rot: "turn °", color: "text colour" };
    var EXPOSE = ["color", "op", "scale", "x", "y", "rot"];
    var statOf = function (c, p) { var tf = c.tf || {}; return p === "op" ? (c.opacity == null ? 1 : +c.opacity) : p === "scale" ? (tf.scale == null ? 1 : +tf.scale) : p === "color" ? ((c.text && c.text.color) || "#ffffff") : +tf[p] || 0; };
    function setStat(c, p, v) {
      if (p === "color") { if (c.text) { c.text.color = v; try { C.saveTextPng(c); } catch (e) { /* fine */ } } return; }
      v = +v; if (!isFinite(v)) return;
      var old = statOf(c, p);
      if (KF.has(c.kf, p)) { var d = v - KF.value(c.kf, 0, p, old); c.kf = c.kf.map(function (k) { if (k[p] == null) return k; var q = Object.assign({}, k); q[p] = Math.round((+q[p] + d) * 10000) / 10000; return q; }); }   // keyed: the keys move by the change
      if (p === "op") c.opacity = Math.max(0, Math.min(1, v)); else { c.tf = Object.assign({ x: 0, y: 0, scale: 1, rot: 0 }, c.tf || {}); c.tf[p] = v; }
    }
    function exposedAll() {
      var o = [];
      (tl.images || []).concat(tl.vlayers || []).forEach(function (L) { (L.clips || []).forEach(function (c) { if (c.expose) Object.keys(c.expose).forEach(function (p) { o.push({ c: c, L: L, p: p, label: c.expose[p] }); }); }); });
      return o;
    }
    C.onProps(function (Pn, c, s) {
      if (!c || !Pn || !s || !s.Ly || s.Ly.kind === "aud" || s.Ly.kind === "v1") return;
      var S = sets(), names = Object.keys(S), d = document.createElement("div"); d.className = "tlp-data";
      var h = '<div class="tlp-t">📋 Data &amp; fields</div><div class="tlp-row" style="flex-wrap:wrap">'
        + names.map(function (n) { return '<span title="' + esc(S[n].cols.join(", ")) + '">' + esc(n) + ' <label>row <input type="number" data-dtrow="' + esc(n) + '" value="' + (S[n].row || 1) + '" min="1" max="' + S[n].rows.length + '" style="width:46px"></label> / ' + S[n].rows.length + '<button class="ghost" data-dtx="' + esc(n) + '" title="Remove this data set">✕</button></span>'; }).join("")
        + '<label class="ghost" style="cursor:pointer" title="A CSV or JSON file: each row a record, the first line (or the keys) its columns">⤓ Import CSV / JSON<input type="file" id="tlpDtFile" accept=".csv,.json,.tsv,.txt,text/csv,application/json" style="display:none"></label>'
        + (names.length ? '<span class="fx-dim">text: {{' + esc(names[0]) + "." + esc(S[names[0]].cols[0]) + '}} · ƒx: data("' + esc(names[0]) + '", "' + esc(S[names[0]].cols[0]) + '")</span>' : "") + "</div>";
      if (names.length) {
        var cur = names[0];
        h += '<div class="tlp-row" style="flex-wrap:wrap"><span>📋 Data → keys</span><select id="tlpDtSet">' + names.map(function (n) { return "<option>" + esc(n) + "</option>"; }).join("") + "</select>"
          + '<select id="tlpDtCol">' + S[cur].cols.map(function (k) { return "<option>" + esc(k) + "</option>"; }).join("") + "</select>"
          + '<select id="tlpDtProp">' + PROPS.map(function (p) { return '<option value="' + p + '">' + PNAME[p] + "</option>"; }).join("") + "</select>"
          + '<label>s per row <input type="number" id="tlpDtSpr" value="1" step="any" style="width:44px"></label><label>rows <input type="number" id="tlpDtFrom" value="1" min="1" style="width:40px"> to <input type="number" id="tlpDtTo" value="' + S[cur].rows.length + '" min="1" style="width:40px"></label>'
          + '<label title="The value x this + the offset">x <input type="number" id="tlpDtMul" value="1" step="any" style="width:48px"></label><label>+ <input type="number" id="tlpDtAdd" value="0" step="any" style="width:48px"></label><button class="ghost" id="tlpDtGo">📋 Make keys</button></div>';
      }
      var ex = c.expose || {};
      h += '<div class="tlp-row" style="flex-wrap:wrap"><span title="Fields you can change from one place - and a 🧩 template saved from this layer offers them when it is dropped in">📋 Template fields</span>'
        + Object.keys(ex).map(function (p) { return '<span>' + esc(ex[p]) + ' <span class="fx-dim">(' + PNAME[p] + ')</span><button class="ghost" data-tfx="' + p + '" title="Stop exposing it">✕</button></span>'; }).join("")
        + '<select id="tlpTfProp">' + EXPOSE.filter(function (p) { return !ex[p] && (p !== "color" || c.text); }).map(function (p) { return '<option value="' + p + '">' + PNAME[p] + "</option>"; }).join("") + '</select><input type="text" id="tlpTfLbl" placeholder="label" style="width:90px"><button class="ghost" id="tlpTfAdd">＋ expose</button></div>';
      var all = exposedAll();
      if (all.length) h += '<div class="tlp-row" style="flex-wrap:wrap"><span class="fx-dim">exposed on this timeline:</span>' + all.map(function (f, i) {
        var v = statOf(f.c, f.p); return '<label title="' + esc(f.L.name || "") + '">' + esc(f.label) + ' <input ' + (f.p === "color" ? 'type="color"' : 'type="number" step="any" style="width:58px"') + ' data-tfv="' + i + '" value="' + esc(f.p === "color" ? v : Math.round(v * 1000) / 1000) + '"></label>'; }).join("") + "</div>";
      d.innerHTML = h; Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      d.querySelectorAll("input").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
      q("tlpDtFile").addEventListener("change", function () {
        var f = q("tlpDtFile").files && q("tlpDtFile").files[0]; if (!f) return;
        f.text().then(function (t) { var n = add(f.name, t); say("📋 " + n + ": " + tl.data.sets[n].rows.length + " rows, " + tl.data.sets[n].cols.length + " columns"); }).catch(function (e) { say("📋 " + (e.message || e)); });
      });
      d.querySelectorAll("[data-dtrow]").forEach(function (el) { el.addEventListener("input", function () { var n = el.getAttribute("data-dtrow"), v = Math.round(+el.value); if (S[n] && v >= 1 && v <= S[n].rows.length) { S[n].row = v; changed(false); } }); });
      d.querySelectorAll("[data-dtx]").forEach(function (el) { el.addEventListener("click", function () { delete tl.data.sets[el.getAttribute("data-dtx")]; changed(true); }); });
      if (q("tlpDtSet")) q("tlpDtSet").addEventListener("change", function () { var n = q("tlpDtSet").value; q("tlpDtCol").innerHTML = S[n].cols.map(function (k) { return "<option>" + esc(k) + "</option>"; }).join(""); q("tlpDtTo").value = S[n].rows.length; });
      if (q("tlpDtGo")) q("tlpDtGo").addEventListener("click", function () {
        var n = q("tlpDtSet").value, p = q("tlpDtProp").value, K = columnKeys(S[n], q("tlpDtCol").value, { spr: +q("tlpDtSpr").value, from: +q("tlpDtFrom").value, to: +q("tlpDtTo").value, mul: +q("tlpDtMul").value, add: +q("tlpDtAdd").value });
        if (!K.length) { say("📋 no numbers in that column"); return; }
        var kf = (c.kf || []).map(function (k) { var o = Object.assign({}, k); delete o[p]; return o; }).filter(function (k) { return Object.keys(k).some(function (x) { return !/^(at|ease|bz|to|ti)$/.test(x); }); });
        K.forEach(function (k) { var kv = {}; kv[p] = k[1]; kf = KF.set(kf, k[0], kv, FPS); });
        c.kf = kf; delete c.bakeSig; delete c.vbakeSig; C.keysChanged(c);
        say("📋 " + K.length + " keys on " + PNAME[p] + " from " + n + "." + q("tlpDtCol").value);
      });
      q("tlpTfAdd").addEventListener("click", function () { var p = q("tlpTfProp").value; if (!p) return; c.expose = Object.assign({}, c.expose || {}); c.expose[p] = (q("tlpTfLbl").value || PNAME[p]).slice(0, 60); if (typeof tlSave === "function") tlSave(); C.paintProps(); });
      d.querySelectorAll("[data-tfx]").forEach(function (el) { el.addEventListener("click", function () { delete c.expose[el.getAttribute("data-tfx")]; if (!Object.keys(c.expose).length) delete c.expose; if (typeof tlSave === "function") tlSave(); C.paintProps(); }); });
      d.querySelectorAll("[data-tfv]").forEach(function (el) { el.addEventListener("input", function () { var f = all[+el.getAttribute("data-tfv")]; if (!f) return; setStat(f.c, f.p, f.p === "color" ? el.value : +el.value); delete f.c.bakeSig; delete f.c.vbakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); }); });
    });
    Object.assign(root.TlData, { ready: true, add: add, exposedAll: exposedAll, setStat: setStat });
  }
})(typeof window !== "undefined" ? window : globalThis);

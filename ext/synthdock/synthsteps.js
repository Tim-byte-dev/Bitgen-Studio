/* bitGen Studio — ext/synthdock/synthsteps.js (2.962.0): 🎹 THE STEP SEQUENCER for a timeline step clip (window.H3SynthSteps).
 * Tim: "lets do the last cakewalk item" (a step sequencer per layer).
 * A step clip {kind "steps", n, div, swing, rows [{src, vol, hits}]} lives on any layer; its pattern repeats over the clip's
 * length on the tempo track's beats (H3SynthTLCore.stepEvents). This is its editor - a box over the Synth tab:
 *   a row a sound (the kit or your samples), a cell a step: click = on -> accent -> off, right-click = off, drag across = paint;
 *   Steps (8 - 32), per beat (8ths / triplets / 16ths / 16th triplets / 32nds), Swing, a row's volume, ＋ Row (8 at most), 🗑 a row,
 *   ▶ hear the clip, ✕ Done (Esc).
 *   open(clip, {color, sounds: [[src, label]], changed(), play()}), close(), isOpen(), info()
 */
(function (root) {
  "use strict";
  var doc = root.document, Z = null;
  var NS = [8, 12, 16, 24, 32], DIVN = [[2, "8ths"], [3, "8th triplets"], [4, "16ths"], [6, "16th triplets"], [8, "32nds"]];
  function esc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }
  function T() { return root.H3SynthTLCore; }
  function changed() { if (Z && Z.o.changed) Z.o.changed(); }
  /** a row's hits fitted to n steps (the pattern repeats into new steps) */
  function fit(hits, n) { var out = []; for (var i = 0; i < n; i++) out.push(hits.length ? hits[i % hits.length] : 0); return out; }
  function setN(n) { var c = Z.c; c.rows.forEach(function (r) { r.hits = c.n < n ? fit(r.hits, n) : r.hits.slice(0, n); }); c.n = n; build(); changed(); }
  function cell(r, s) { return Z.box.querySelector('[data-r="' + r + '"][data-s="' + s + '"]'); }
  function paintCell(r, s) { var b = cell(r, s), h = Z.c.rows[r].hits[s]; if (!b) return; b.classList.toggle("on", h === 1); b.classList.toggle("acc", h === 2); b.setAttribute("aria-pressed", h ? "true" : "false"); b.title = "Step " + (s + 1) + (h === 2 ? " - accent" : h ? " - on" : ""); }
  function setHit(r, s, h) { Z.c.rows[r].hits[s] = h; paintCell(r, s); changed(); }
  function soundOpts(sel) {
    var have = false, html = (Z.o.sounds || []).map(function (p) { if (p[0] === sel) have = true; return '<option value="' + esc(p[0]) + '"' + (p[0] === sel ? " selected" : "") + ">" + esc(p[1]) + "</option>"; }).join("");
    return (have ? "" : '<option value="' + esc(sel) + '" selected>' + esc(sel.replace(/^\w+:/, "")) + "</option>") + html;
  }
  function build() {
    var c = Z.c, g = Z.box.querySelector("#syStepGrid"), html = "";
    c.rows.forEach(function (r, ri) {
      html += '<div class="systeprow" data-row="' + ri + '"><select data-snd="' + ri + '" title="This row\'s sound">' + soundOpts(r.src) + "</select>"
        + '<input type="range" min="0" max="1" step="0.05" value="' + r.vol + '" data-vol="' + ri + '" title="This row\'s volume" aria-label="Row ' + (ri + 1) + ' volume">'
        + '<div class="systepcells">';
      for (var s = 0; s < c.n; s++) html += '<button type="button" class="systep' + (s % c.div === 0 ? " beat" : "") + '" data-r="' + ri + '" data-s="' + s + '"></button>';
      html += '</div><button type="button" class="sydk" data-delrow="' + ri + '" title="Remove this row">🗑</button></div>';
    });
    g.innerHTML = html || '<i class="systepnone">No rows - ＋ Row adds one</i>';
    c.rows.forEach(function (r, ri) { for (var s = 0; s < c.n; s++) paintCell(ri, s); });
    Z.box.querySelector("#syStepN").value = String(c.n); Z.box.querySelector("#syStepDiv").value = String(c.div);
    Z.box.querySelector("#syStepSwing").value = String(c.swing || 0); Z.box.querySelector("#syStepAdd").disabled = c.rows.length >= T().MAXROWS;
  }
  function open(c, o) {
    close();
    Z = { c: c, o: o || {}, paint: null };
    var host = doc.getElementById("synthdock") || doc.body, back = doc.createElement("div");
    back.id = "syStepBack"; back.className = "syrollback";
    back.innerHTML = '<div class="syroll systeps" id="syStep" tabindex="-1" role="dialog" aria-label="Step sequencer" style="border-color:' + esc(Z.o.color || "#38e1ff") + '">'
      + '<div class="syrollbar"><b>▦ ' + esc(c.name) + '</b>'
      + '<label>Steps <select id="syStepN">' + NS.map(function (n) { return '<option value="' + n + '">' + n + "</option>"; }).join("") + "</select></label>"
      + '<label>Each <select id="syStepDiv">' + DIVN.map(function (d) { return '<option value="' + d[0] + '">' + d[1] + "</option>"; }).join("") + "</select></label>"
      + '<label title="Swing: every second step a little late">Swing <input type="range" id="syStepSwing" min="0" max="0.5" step="0.05"></label>'
      + '<button type="button" class="sydk" id="syStepAdd" title="＋ A row (8 at most)">＋ Row</button>'
      + '<button type="button" class="sydk" id="syStepPlay" title="▶ Hear the clip">▶</button>'
      + '<span class="hint">click = on → accent → off · drag = paint · right-click = off · the pattern repeats over the clip</span>'
      + '<button type="button" class="sydk" id="syStepX" title="Done (Esc)">✕ Done</button></div>'
      + '<div id="syStepGrid" class="systepgrid"></div></div>';
    host.appendChild(back); Z.box = back;
    build();
    var q = function (id) { return back.querySelector("#" + id); };
    q("syStepN").onchange = function () { setN(+q("syStepN").value); };
    q("syStepDiv").onchange = function () { c.div = +q("syStepDiv").value; build(); changed(); };
    q("syStepSwing").oninput = function () { c.swing = +q("syStepSwing").value; changed(); };
    q("syStepAdd").onclick = function () { if (c.rows.length >= T().MAXROWS) return; var used = c.rows.map(function (r) { return r.src; }), next = (Z.o.sounds || []).map(function (p) { return p[0]; }).filter(function (s) { return used.indexOf(s) < 0; })[0] || "kit:clap"; c.rows.push({ src: next, vol: 0.8, hits: fit([], c.n) }); build(); changed(); };
    q("syStepPlay").onclick = function () { if (Z.o.play) Z.o.play(); };
    q("syStepX").onclick = close;
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    back.addEventListener("change", function (e) { var t = e.target; if (t.dataset.snd != null) { c.rows[+t.dataset.snd].src = t.value; changed(); } });
    back.addEventListener("input", function (e) { var t = e.target; if (t.dataset.vol != null) { c.rows[+t.dataset.vol].vol = +t.value; changed(); } });
    back.addEventListener("pointerdown", function (e) {
      var b = e.target.closest("[data-delrow]"); if (b) { c.rows.splice(+b.dataset.delrow, 1); build(); changed(); return; }
      var k = e.target.closest(".systep"); if (!k) return; e.preventDefault();
      var r = +k.dataset.r, s = +k.dataset.s, h = c.rows[r].hits[s], nv = e.button === 2 ? 0 : (h + 1) % 3;
      Z.paint = { v: nv === 2 && !h ? 1 : nv }; setHit(r, s, nv);
    });
    back.addEventListener("pointerover", function (e) { if (!Z || !Z.paint || !(e.buttons & 3)) return; var k = e.target.closest(".systep"); if (k) setHit(+k.dataset.r, +k.dataset.s, Z.paint.v); });
    root.addEventListener("pointerup", Z.up = function () { if (Z) Z.paint = null; });
    back.addEventListener("contextmenu", function (e) { if (e.target.closest(".systep")) e.preventDefault(); });
    back.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); close(); } });
    q("syStep").focus();
    return true;
  }
  function close() {
    if (!Z) return false;
    var b = Z.box, up = Z.up, done = Z.o.closed; Z = null;
    if (up) root.removeEventListener("pointerup", up);
    if (b && b.parentNode) b.parentNode.removeChild(b);
    if (done) done();
    return true;
  }
  root.H3SynthSteps = { open: open, close: close, isOpen: function () { return !!Z; }, fit: fit,
    info: function () { return Z ? { n: Z.c.n, div: Z.c.div, rows: Z.c.rows.length, on: Z.box.querySelectorAll(".systep.on").length, acc: Z.box.querySelectorAll(".systep.acc").length } : null; } };
})(typeof window !== "undefined" ? window : globalThis);

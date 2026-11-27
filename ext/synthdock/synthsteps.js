/* bitGen Studio — ext/synthdock/synthsteps.js (2.962.0): 🎹 THE STEP SEQUENCER for a timeline step clip (window.H3SynthSteps).
 * Tim: "lets do the last cakewalk item" (a step sequencer per layer).
 * A step clip {kind "steps", n, div, swing, rows [{src, vol, hits}]} lives on any layer; its pattern repeats over the clip's
 * length on the tempo track's beats (H3SynthTLCore.stepEvents). This is its editor - a box over the Synth tab:
 *   a row a sound (the kit or your samples), a cell a step: click = on -> accent -> off, right-click = off, drag across = paint;
 *   Steps (8 - 32), per beat (8ths / triplets / 16ths / 16th triplets / 32nds), Swing, a row's volume, ＋ Row (8 at most), 🗑 a row,
 *   ▶ hear the clip, ✕ Done (Esc).
 *   open(clip, {color, sounds: [[src, label]], changed(), play()}), close(), isOpen(), info()
 * 2.992.0 (Tim: "our own Magenta" in the Edit Booth - 🥁 Drumify / Groove first): 🥁 Drumify… opens a part under the bar - a rhythm
 *   you TAP (the pad, any key, your MIDI keyboard or drum pads, after one bar of clicks), a NOTE CLIP on the timeline or a SOUND
 *   (a clip on the timeline, the kit, your samples) -> a kick / snare / hats pattern (H3SynthGroove.drumify) with the timing and
 *   strength you played it with. Feel (0 = on the grid, 1 = as played) decides how much of that timing is heard; a cell's
 *   brightness = how hard, its tick = early / late. 🎲 Another = the same rhythm, another take; ↶ Put back = the pattern before.
 *   Extra options: o.ctx(), o.dest(), o.tmap(), o.noteClips() [{label, clip}], o.audioClips() [{label, src, start, off, len}],
 *   o.load(src) -> Promise<AudioBuffer>. tap(v, perfMs) takes a hit while ● Tap records (synthdock sends MIDI / pad hits here).
 */
(function (root) {
  "use strict";
  var doc = root.document, Z = null;
  var NS = [8, 12, 16, 24, 32, 48, 64], DIVN = [[2, "8ths"], [3, "8th triplets"], [4, "16ths"], [6, "16th triplets"], [8, "32nds"]];
  function esc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }
  function T() { return root.H3SynthTLCore; }
  function G() { return root.H3SynthGroove; }
  function changed() { if (Z && Z.o.changed) Z.o.changed(); }
  /** a row's hits fitted to n steps (the pattern repeats into new steps) */
  function fit(hits, n) { var out = []; for (var i = 0; i < n; i++) out.push(hits.length ? hits[i % hits.length] : 0); return out; }
  function setN(n) {
    var c = Z.c, f = function (a) { return c.n < n ? fit(a, n) : a.slice(0, n); };
    c.rows.forEach(function (r) { r.hits = f(r.hits); if (r.off) r.off = f(r.off); if (r.vel) r.vel = f(r.vel); }); c.n = n; build(); changed();
  }
  function cell(r, s) { return Z.box.querySelector('[data-r="' + r + '"][data-s="' + s + '"]'); }
  function paintCell(r, s) {
    var b = cell(r, s), row = Z.c.rows[r], h = row.hits[s]; if (!b) return;
    b.classList.toggle("on", h === 1); b.classList.toggle("acc", h === 2); b.setAttribute("aria-pressed", h ? "true" : "false");
    // 2.992.0: how hard (brightness) and how early / late (the tick) it was played
    var v = h && row.vel && row.vel[s] ? row.vel[s] : h === 2 ? 1 : 0.7, o = h && row.off ? row.off[s] || 0 : 0;
    b.style.setProperty("--v", h ? v.toFixed(2) : "1"); b.style.setProperty("--o", o.toFixed(2)); b.classList.toggle("felt", !!(h && Math.abs(o) >= 0.03));
    b.title = "Step " + (s + 1) + (h === 2 ? " - accent" : h ? " - on" : "") + (h && row.vel && row.vel[s] ? " · " + Math.round(v * 100) + "%" : "") + (h && Math.abs(o) >= 0.03 ? " · " + (o < 0 ? "early " : "late ") + Math.round(Math.abs(o) * 100) + "% of a step" : "");
  }
  function setHit(r, s, h) {
    var row = Z.c.rows[r]; row.hits[s] = h;
    if (row.vel) row.vel[s] = h === 2 ? 1 : h ? 0.7 : 0;   // a cell set by hand: plain strength, on the grid
    if (row.off) row.off[s] = 0;
    paintCell(r, s); changed();
  }
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
    Z.box.querySelector("#syStepFeel").value = String(c.feel == null ? 1 : c.feel);
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
      + '<label title="Feel: how much of the timing you played is heard - 0 = every hit on the grid, 1 = as played (🥁 Drumify keeps it)">Feel <input type="range" id="syStepFeel" min="0" max="1" step="0.05"></label>'
      + '<button type="button" class="sydk" id="syStepAdd" title="＋ A row (8 at most)">＋ Row</button>'
      + '<button type="button" class="sydk" id="syStepGroove" aria-expanded="false" title="🥁 Drumify: tap a rhythm, or take a note clip or a sound -> a drum pattern with your feel">🥁 Drumify…</button>'
      + '<button type="button" class="sydk" id="syStepPlay" title="▶ Hear the clip">▶</button>'
      + '<span class="hint">click = on → accent → off · drag = paint · right-click = off · the pattern repeats over the clip</span>'
      + '<button type="button" class="sydk" id="syStepX" title="Done (Esc)">✕ Done</button></div>'
      + grooveHtml() + '<div id="syStepGrid" class="systepgrid"></div></div>';
    host.appendChild(back); Z.box = back;
    build();
    var q = function (id) { return back.querySelector("#" + id); };
    q("syStepN").onchange = function () { setN(+q("syStepN").value); };
    q("syStepDiv").onchange = function () { c.div = +q("syStepDiv").value; build(); changed(); };
    q("syStepSwing").oninput = function () { c.swing = +q("syStepSwing").value; changed(); };
    q("syStepFeel").oninput = function () { c.feel = +q("syStepFeel").value; changed(); };
    q("syStepGroove").onclick = function () { grooveShow(!Z.gOpen); };
    grooveWire(q);
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
    back.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); if (Z.tapping) tapStop(false); else close(); return; }
      // 2.992.0: while ● Tap records, any key is a hit (Shift = a loud one) - except in a text box / list
      if (Z.tapping && !e.repeat && e.key !== "Tab" && e.key !== "Shift" && !/^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName || "")) { e.preventDefault(); tap(e.shiftKey ? 1 : 0.75, e.timeStamp); }
    });
    q("syStep").focus();
    return true;
  }
  /* ---------------- 2.992.0: 🥁 Drumify ---------------- */
  function grooveHtml() {
    var Gr = G(), chk = function (id, label, tip) { return '<label title="' + tip + '"><input type="checkbox" id="' + id + '" checked> ' + label + "</label>"; };
    return '<div id="syGrv" class="sygrv" hidden>'
      + '<div class="sygrvnote">' + esc(Gr ? Gr.NOTE : "") + "</div>"
      + '<div class="sygrvrow"><label>From <select id="syGrvFrom"><option value="tap">👆 Tap it</option><option value="notes">🎹 A note clip</option><option value="sound">🔊 A sound</option></select></label>'
      + '<label title="How long the pattern is (bars of 4 beats). Auto = as long as what you took, the clip\'s own length for a tap">Bars <select id="syGrvBars"><option value="auto">Auto</option><option value="1">1</option><option value="2">2</option><option value="4">4</option></select></label>'
      + '<span class="sygrvsrc" data-from="tap"><button type="button" class="sydk" id="syGrvTap" title="● Tap: one bar of clicks, then tap along for the bars - the pad, any key (Shift = loud), your MIDI keyboard or drum pads">● Tap</button>'
      + '<button type="button" id="syGrvPad" class="sygrvpad" title="Tap here (or any key) while ● Tap records">TAP</button><span id="syGrvTapN" class="sygrvn"></span></span>'
      + '<span class="sygrvsrc" data-from="notes" hidden><select id="syGrvNotes" title="A note clip on the timeline - its rhythm and how hard each note was played"></select></span>'
      + '<span class="sygrvsrc" data-from="sound" hidden><select id="syGrvSnd" title="A sound clip on the timeline, the kit or your samples - its hits are found (low = kick, middle = snare, high = hats)"></select></span>'
      + '<label title="What your hits become. Auto: from where they fall in the beat (a sound: from how low / high each hit is)">Your hits <select id="syGrvKeep"><option value="auto">Auto</option><option value="kick">all kick</option><option value="snare">all snare</option><option value="hat">all hats</option></select></label></div>'
      + '<div class="sygrvrow">' + chk("syGrvHats", "＋ hats", "Add hats when your rhythm has none (8ths, or 16ths if you played 16ths) - in your feel") + chk("syGrvBack", "＋ backbeat", "Add a snare on beats 2 and 4 when there is none") + chk("syGrvKick", "＋ kick on 1", "Add a kick on the first beat of each bar when there is none")
      + '<label title="Ghost notes: soft snares between the hits">Ghost notes <input type="range" id="syGrvGhost" min="0" max="1" step="0.1" value="0.3"></label>'
      + '<button type="button" class="sydk sygrvgo" id="syGrvGo" title="✨ Make the pattern from what you took (replaces the kick / snare / hats rows)">✨ Make</button>'
      + '<button type="button" class="sydk" id="syGrvAgain" disabled title="🎲 The same rhythm, another take">🎲 Another</button>'
      + '<button type="button" class="sydk" id="syGrvUndo" disabled title="↶ The pattern as it was before ✨ Make">↶ Put back</button>'
      + '<span id="syGrvMsg" class="sygrvmsg" role="status"></span></div></div>';
  }
  function gq(id) { return Z && Z.box.querySelector("#" + id); }
  function gmsg(t, bad) { var m = gq("syGrvMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } }
  function grooveShow(on) {
    if (!Z || !G()) return false;
    Z.gOpen = !!on; gq("syGrv").hidden = !on; gq("syStepGroove").setAttribute("aria-expanded", on ? "true" : "false"); gq("syStepGroove").classList.toggle("grvopen", !!on);
    if (on) fillSources();
    return true;
  }
  function fromNow() { return gq("syGrvFrom").value; }
  function fillSources() {
    var o = Z.o, nc = o.noteClips ? o.noteClips() : [], ac = o.audioClips ? o.audioClips() : [];
    Z.nc = nc; Z.ac = ac.concat((o.sounds || []).map(function (p) { return { label: p[1], src: p[0] }; }));
    var ns = gq("syGrvNotes"), ss = gq("syGrvSnd"), keepN = ns.value, keepS = ss.value;
    ns.innerHTML = nc.length ? nc.map(function (x, i) { return '<option value="' + i + '">' + esc(x.label) + "</option>"; }).join("") : '<option value="">(no note clip on the timeline yet)</option>';
    ss.innerHTML = Z.ac.map(function (x, i) { return '<option value="' + i + '">' + esc((x.start != null ? "▤ " : "") + x.label) + "</option>"; }).join("");
    if (keepN && ns.querySelector('option[value="' + keepN + '"]')) ns.value = keepN;
    if (keepS && ss.querySelector('option[value="' + keepS + '"]')) ss.value = keepS;
  }
  function paintFrom() { var f = fromNow(); Z.box.querySelectorAll(".sygrvsrc").forEach(function (e) { e.hidden = e.dataset.from !== f; }); }
  function grooveWire(q) {
    if (!q("syGrv")) return;
    q("syGrvFrom").onchange = paintFrom;
    q("syGrvTap").onclick = function () { if (Z.tapping) tapStop(true); else tapStart(); };
    q("syGrvPad").addEventListener("pointerdown", function (e) {
      e.preventDefault(); if (!Z.tapping) return;
      var pr = e.pointerType !== "mouse" && e.pressure > 0 && e.pressure < 1 ? 0.3 + 0.7 * e.pressure : 0.75;
      tap(e.shiftKey ? 1 : pr, e.timeStamp);
    });
    q("syGrvGo").onclick = function () { make(); };
    q("syGrvAgain").onclick = function () { if (Z.last) { Z.seed = (Z.seed || 1) + 1; apply(Z.last.hits, Z.last.bars, Z.last.base); } };
    q("syGrvUndo").onclick = putBack;
  }
  function maxBars() { return Math.max(1, Math.floor(64 / (4 * (Z.c.div || 4)))); }
  function barsFor(beats) {   // the bars select, or as long as the beats taken (1 / 2 / 4)
    var v = gq("syGrvBars").value, mb = maxBars();
    if (v !== "auto") return Math.min(mb, +v);
    var b = Math.max(1, Math.ceil((beats - 0.01) / 4)); b = b <= 1 ? 1 : b <= 2 ? 2 : 4;
    return Math.min(mb, b);
  }
  function opts(bars) {
    var c = Z.c, Gr = G(), snd = {}, vols = {};
    Gr.KINDS.forEach(function (k) { var r = pickRow(k, {}); if (r) { snd[k] = r.src; vols[k] = r.vol; } });
    return { div: c.div || 4, bars: bars, seed: Z.seed || 1, keep: gq("syGrvKeep").value, hats: gq("syGrvHats").checked, backbeat: gq("syGrvBack").checked, kick: gq("syGrvKick").checked, ghost: +gq("syGrvGhost").value, sounds: snd, vols: vols };
  }
  /** the clip's row for a drum: its default kit sound first, else the first sound of that kind not taken yet */
  function pickRow(kind, taken) {
    var Gr = G(), rows = Z.c.rows, best = -1;
    rows.forEach(function (r, i) { if (taken[i] || Gr.kindOf(r.src) !== kind) return; if (best < 0 || (r.src === Gr.SOUNDS[kind] && rows[best].src !== Gr.SOUNDS[kind])) best = i; });
    return best >= 0 ? Object.assign({ i: best }, rows[best]) : null;
  }
  function apply(hits, bars, base) {
    var c = Z.c, Gr = G(), r = Gr.drumify(hits, opts(bars));
    if (!Z.before) Z.before = JSON.parse(JSON.stringify({ n: c.n, rows: c.rows, len: c.len, feel: c.feel }));
    var taken = {}, rows = c.rows.map(function (x) { return x; });
    if (r.n !== c.n) { rows.forEach(function (x) { x.hits = fit(x.hits, r.n); if (x.off) x.off = fit(x.off, r.n); if (x.vel) x.vel = fit(x.vel, r.n); }); c.n = r.n; }
    r.rows.forEach(function (nr) {
      var at = pickRow(nr.kind, taken), row = { src: nr.src, vol: nr.vol, hits: nr.hits, off: nr.off, vel: nr.vel };
      if (at) { taken[at.i] = 1; rows[at.i] = Object.assign({}, rows[at.i], { hits: nr.hits, off: nr.off, vel: nr.vel }); }
      else if (nr.hits.some(Boolean) && rows.length < T().MAXROWS) { taken[rows.length] = 1; rows.push(row); }
    });
    c.rows = rows;
    if (c.feel == null) c.feel = 1;
    // the whole groove is heard: the clip at least as long as the pattern
    var map = Z.o.tmap ? Z.o.tmap() : [{ t: 0, bpm: 120 }], tl = T(), b0 = tl.beatAt(map, c.start), plen = tl.timeAt(map, b0 + r.n / (c.div || 4)) - c.start;
    if (c.len < plen - 1e-6) c.len = Math.round(plen * 1e6) / 1e6;
    Z.last = { hits: hits, bars: bars, base: base };
    gq("syGrvAgain").disabled = false; gq("syGrvUndo").disabled = false;
    build(); changed(); gmsg(Gr.summary(r) + (base ? " · from " + base : ""));
    Z.result = r; return r;
  }
  function putBack() {
    if (!Z || !Z.before) return false;
    var c = Z.c, b = Z.before; c.n = b.n; c.rows = b.rows; c.len = b.len; if (b.feel == null) delete c.feel; else c.feel = b.feel;
    Z.before = null; gq("syGrvUndo").disabled = true; build(); changed(); gmsg("↶ The pattern as it was"); return true;
  }
  /** ✨ Make from the source picked */
  function make() {
    if (!Z) return Promise.resolve(null);
    var f = fromNow(), tl = T(), map = Z.o.tmap ? Z.o.tmap() : [{ t: 0, bpm: 120 }];
    if (f === "tap") {
      if (!Z.taps || !Z.taps.length) { gmsg("👆 Press ● Tap and tap a rhythm first", true); return Promise.resolve(null); }
      return Promise.resolve(apply(Z.taps.slice(), Z.tapBars || barsFor(Z.c.n / (Z.c.div || 4)), "your taps"));
    }
    if (f === "notes") {
      var x = Z.nc && Z.nc[+gq("syGrvNotes").value]; if (!x) { gmsg("🎹 There is no note clip on the timeline - ＋ ♪ Notes or send a keyboard take first", true); return Promise.resolve(null); }
      var nc = x.clip, nb0 = tl.beatAt(map, nc.start), hits = (nc.notes || []).map(function (n) { return { b: tl.beatAt(map, nc.start + n.t) - nb0, v: n.v, m: n.m }; });
      if (!hits.length) { gmsg("🎹 That clip has no notes", true); return Promise.resolve(null); }
      var last = hits.reduce(function (a, h) { return Math.max(a, h.b); }, 0);
      return Promise.resolve(apply(hits, barsFor(last + 0.25), x.label));
    }
    var s = Z.ac && Z.ac[+gq("syGrvSnd").value]; if (!s) { gmsg("🔊 Pick a sound", true); return Promise.resolve(null); }
    if (!Z.o.load) { gmsg("🔊 Sounds cannot be read here", true); return Promise.resolve(null); }
    gmsg("🔊 Listening to " + s.label + "…");
    var want = Z.c.n / (Z.c.div || 4);
    return Z.o.load(s.src).then(function (buf) {
      if (!Z) return null;
      var sr = buf.sampleRate, a = Math.round((s.off || 0) * sr), len = s.len ? Math.round(s.len * sr) : buf.length - a, chans = [];
      for (var ch = 0; ch < buf.numberOfChannels; ch++) chans.push(buf.getChannelData(ch).subarray(a, Math.min(buf.length, a + Math.min(len, sr * 30))));
      var base = s.start != null ? s.start : Z.c.start, b0 = tl.beatAt(map, base), on = G().onsets(chans, sr, { maxS: 30 });
      if (!on.length) { gmsg("🔊 No hits found in " + s.label + " - is it quiet?", true); return null; }
      var hits = on.map(function (h) { return { b: tl.beatAt(map, base + h.t) - b0, v: h.v, bands: h.bands }; });
      var last = hits.reduce(function (m, h) { return Math.max(m, h.b); }, 0);
      return apply(hits, barsFor(gq("syGrvBars").value === "auto" ? Math.max(last + 0.25, s.start != null ? 0 : want) : last + 0.25), s.label);
    }, function (e) { gmsg("🔊 " + (e && e.message || "That sound could not be read"), true); return null; });
  }
  /* ● Tap: one bar of clicks, then the bars to tap; each hit placed on the audio clock (what you HEAR - the output's own time) */
  function audioAt(ctx, perfMs) {
    var now = root.performance ? root.performance.now() : Date.now();
    if (perfMs == null || !isFinite(perfMs)) perfMs = now;
    try { var ts = ctx.getOutputTimestamp && ctx.getOutputTimestamp(); if (ts && ts.performanceTime > 0) return ts.contextTime + (perfMs - ts.performanceTime) / 1000; } catch (e) { /* older browsers */ }
    return ctx.currentTime - (ctx.outputLatency || 0) - (now - perfMs) / 1000;
  }
  function tapStart() {
    var o = Z.o, ctx = o.ctx && o.ctx(); if (!ctx) { gmsg("👆 No sound here", true); return false; }
    var tl = T(), map = o.tmap ? o.tmap() : [{ t: 0, bpm: 120 }], c = Z.c, bars = barsFor(c.n / (c.div || 4)), beats = bars * 4;
    var b0 = tl.beatAt(map, c.start), bsec = 60 / tl.bpmAt(map, c.start), at = ctx.currentTime + 0.15, start = at + 4 * bsec;
    var list = [0, 1, 2, 3].map(function (j) { return { t: j * bsec, accent: j === 0 }; });
    for (var k = 0; k < beats; k++) list.push({ t: 4 * bsec + (tl.timeAt(map, b0 + k) - c.start), accent: k % 4 === 0 });
    var end = start + (tl.timeAt(map, b0 + beats) - c.start);
    Z.tapping = { ctx: ctx, map: map, b0: b0, start: start, end: end, bsec: bsec, beats: beats };
    Z.taps = []; Z.tapBars = bars;
    Z.tapping.stopClicks = root.H3SynthClick && o.dest ? root.H3SynthClick.play(ctx, o.dest(), list, at) : null;
    Z.tapping.timer = root.setTimeout(function () { tapStop(true); }, Math.max(0, (end - ctx.currentTime + 0.25) * 1000));
    gq("syGrvTap").textContent = "■ Stop"; gq("syGrvTap").classList.add("rec"); gq("syGrvPad").classList.add("live");
    gq("syGrvTapN").textContent = "1 bar of clicks, then tap " + bars + " bar" + (bars === 1 ? "" : "s");
    gq("syGrvPad").focus();
    return true;
  }
  /** one hit while ● Tap records: v 0..1, perfMs = the event's time (performance.now() clock) */
  function tap(v, perfMs) {
    var tp = Z && Z.tapping; if (!tp) return false;
    var at = audioAt(tp.ctx, perfMs), rel = at - tp.start, step = tp.bsec / (Z.c.div || 4);
    if (rel < -step / 2 || at > tp.end + 0.05) return false;   // in the count-in / after the end
    var b = rel < 0 ? rel / tp.bsec : T().beatAt(tp.map, Z.c.start + rel) - tp.b0;
    Z.taps.push({ b: Math.round(b * 10000) / 10000, v: Math.max(0.05, Math.min(1, v == null ? 0.75 : v)) });
    var pad = gq("syGrvPad"); if (pad) { pad.classList.add("hit"); root.setTimeout(function () { if (pad) pad.classList.remove("hit"); }, 70); }
    var n = gq("syGrvTapN"); if (n) n.textContent = Z.taps.length + " hit" + (Z.taps.length === 1 ? "" : "s");
    return true;
  }
  function tapStop(go) {
    var tp = Z && Z.tapping; if (!tp) return false;
    Z.tapping = null; root.clearTimeout(tp.timer); if (tp.stopClicks) tp.stopClicks();
    gq("syGrvTap").textContent = "● Tap"; gq("syGrvTap").classList.remove("rec"); gq("syGrvPad").classList.remove("live");
    if (go && Z.taps.length) make(); else if (go) gmsg("👆 No hits taken - tap the pad or any key after the bar of clicks", true);
    return true;
  }
  function close() {
    if (!Z) return false;
    if (Z.tapping) tapStop(false);
    var b = Z.box, up = Z.up, done = Z.o.closed; Z = null;
    if (up) root.removeEventListener("pointerup", up);
    if (b && b.parentNode) b.parentNode.removeChild(b);
    if (done) done();
    return true;
  }
  root.H3SynthSteps = { open: open, close: close, isOpen: function () { return !!Z; }, fit: fit,
    groove: grooveShow, make: make, audioAt: audioAt, tap: tap, tapStart: tapStart, tapStop: tapStop, putBack: putBack, tapping: function () { return !!(Z && Z.tapping); },
    taps: function () { return Z && Z.taps ? Z.taps.slice() : []; }, setTaps: function (a, bars) { if (!Z) return false; Z.taps = (a || []).slice(); Z.tapBars = bars || null; return true; },
    tapClock: function () { var tp = Z && Z.tapping; return tp ? { start: tp.start, end: tp.end, bsec: tp.bsec, beats: tp.beats } : null; },
    result: function () { return Z && Z.result ? Z.result : null; },
    info: function () { return Z ? { n: Z.c.n, div: Z.c.div, rows: Z.c.rows.length, on: Z.box.querySelectorAll(".systep.on").length, acc: Z.box.querySelectorAll(".systep.acc").length } : null; } };
})(typeof window !== "undefined" ? window : globalThis);

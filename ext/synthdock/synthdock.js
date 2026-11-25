/* bitGen Studio — ext/synthdock/synthdock.js (2.953.0): 🎹 THE SYNTH STATION (window.H3Synth) - the Audio docker's Synth tab.
 * Tim: "can we add a synthstation that looks something like this in Audio docker with a midi keyboard and hammer head style
 * looper that the user can add new samples to ?"
 *   The rack     panels of glowing knobs (synthcore.js PARAMS, synthknob.js): oscillators, filter, the two envelopes (each
 *                drawn), LFO, effects, master; the screen = the sound's wave live (a drawing of the patch while it is quiet)
 *   Patches      ours (PRESETS) and yours (💾 - kept in this browser, h3.synth.user); the knobs as you left them come back
 *   Keys         the keyboard on screen (3 octaves, lower on a key = louder, drag = glide over the keys), the computer keys
 *                (Z row = the octave shown, Q row = the one above; ↑ / ↓ = octave) while the Synth tab has the focus, any MIDI
 *                keyboard (Web MIDI: notes, velocity, pitch bend, mod wheel CC1, sustain CC64, volume CC7)
 *   🎙 Sample it one note of the patch -> a new sample in 📂 My samples (routes/synth.js, lib/synthSamples.js) -> pick it in a looper row
 *   ⏺ Rec        what you play (synth + loop) -> ⏹ = into this project's SFX
 *   The looper   synthloop.js (H3SynthLoop); ⬇ WAV / → 💥 SFX / → 🔊 Sound
 *   ⛶            maximized = the whole window; 🗗, Esc or leaving the browser's full screen = back to the docker
 *   Kind to work the sound engine starts on the first click (the browser's rule); hiding / folding the tab stops the loop and
 *                every note; nothing is drawn while it is hidden
 * window.H3Synth: info(), noteOn / noteOff, set(id, v), preset(name), engine(), ctx(), refresh(), sample(), exportLoop(to) (tests)
 */
(function (root) {
  "use strict";
  var doc = root.document, C = root.H3SynthCore, V = root.H3SynthVoice, KN = root.H3SynthKnob, LP = root.H3SynthLoop;
  if (!doc || !C || !V || !KN || !LP) return;
  var $ = function (id) { return doc.getElementById(id); };
  var LS = {
    get: function (k, d) { try { var v = root.localStorage.getItem("h3.synth." + k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { root.localStorage.setItem("h3.synth." + k, String(v)); } catch (e) { /* private mode */ } },
  };
  try { if (root.localStorage.getItem("h3.g.synthdock") == null) root.localStorage.setItem("h3.g.synthdock", "1"); } catch (e) { /* fine */ }
  function jget(k, d) { try { var j = JSON.parse(LS.get(k, "null")); return j == null ? d : j; } catch (e) { return d; } }
  var G = { ctx: null, E: null, p: null, preset: LS.get("preset", "o:Neon Lead"), dirty: LS.get("dirty", "0") === "1", knobs: {}, oct: Math.max(0, Math.min(7, parseInt(LS.get("oct", "3"), 10) || 3)),
            down: {}, ptr: {}, keys: {}, midi: null, midiIn: LS.get("midi", "*"), raf: 0, rec: null, user: jget("user", []), last: null, busy: false, my: [], sfx: [] };
  if (!Array.isArray(G.user)) G.user = [];
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function msg(t, bad) { var m = $("syMsg"); if (!m) return; m.textContent = t || ""; m.classList.toggle("bad", !!bad); }
  function shown() { var d = $("synthdock"); return !!(d && !d.classList.contains("dockgone") && !d.classList.contains("collapsed") && !d.classList.contains("dockoff") && d.offsetWidth > 0); }

  /* ---------------- the sound engine (made on the first click) ---------------- */
  function ctx() {
    if (!G.ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw new Error("this browser has no Web Audio");
      G.ctx = new AC({ latencyHint: "interactive" });
      G.E = new V.Engine(G.ctx);
      G.E.setAll(G.p);
      G.ctx.onstatechange = asleep;
    }
    if (G.ctx.state === "suspended") { try { G.ctx.resume().then(asleep, asleep); } catch (e) { /* fine */ } }
    asleep();
    return G.ctx;
  }
  function engine() { ctx(); return G.E; }
  function asleep() { var d = $("synthdock"); if (d) d.classList.toggle("sy-asleep", !!G.ctx && G.ctx.state !== "running"); }

  /* ---------------- the patch ---------------- */
  var saveT = 0;
  function keep() {
    root.clearTimeout(saveT);
    saveT = root.setTimeout(function () { LS.set("patch", JSON.stringify(G.p)); LS.set("preset", G.preset); LS.set("dirty", G.dirty ? "1" : "0"); }, 250);
  }
  function setParam(id, v, quiet) {
    if (!C.BY[id]) return;
    G.p[id] = C.cleanValue(id, v);
    if (G.E) G.E.set(id, G.p[id]);
    if (!quiet) { if (!G.dirty) { G.dirty = true; presetList(); } keep(); }
    var k = G.knobs[id]; if (k) k.draw();
    if (/^[fa][ADSR]$/.test(id)) envDraw();
    if (!G.E || !G.E.sounding()) drawIdle();
  }
  function applyPatch(p, name) {
    G.p = C.cleanPatch(p); G.preset = name; G.dirty = false;
    if (G.E) G.E.setAll(G.p);
    Object.keys(G.knobs).forEach(function (id) { G.knobs[id].draw(); });
    envDraw(); presetList(); keep(); drawIdle();
  }
  function presetOf(v) {
    var m = /^(o|u):(.*)$/.exec(v || ""); if (!m) return null;
    if (m[1] === "o") return C.patch(m[2]);
    for (var i = 0; i < G.user.length; i++) if (G.user[i].name === m[2]) return C.cleanPatch(G.user[i].p);
    return null;
  }
  function allPresets() { return C.PRESETS.map(function (x) { return "o:" + x.name; }).concat(G.user.map(function (x) { return "u:" + x.name; })); }
  function presetList() {
    var sel = $("syPreset"); if (!sel) return;
    sel.innerHTML = "";
    var g1 = doc.createElement("optgroup"); g1.label = "Our patches"; sel.appendChild(g1);
    C.PRESETS.forEach(function (x) { var o = doc.createElement("option"); o.value = "o:" + x.name; o.textContent = x.name; g1.appendChild(o); });
    if (G.user.length) {
      var g2 = doc.createElement("optgroup"); g2.label = "My patches"; sel.appendChild(g2);
      G.user.forEach(function (x) { var o = doc.createElement("option"); o.value = "u:" + x.name; o.textContent = x.name; g2.appendChild(o); });
    }
    if (allPresets().indexOf(G.preset) < 0) G.preset = "o:Init";
    sel.value = G.preset;
    if (G.dirty) { var cur = sel.options[sel.selectedIndex]; if (cur) cur.textContent = cur.textContent + " *"; }
    $("syDelPreset").disabled = !/^u:/.test(G.preset);
    screenText();
  }
  function pickPreset(v) { var p = presetOf(v); if (!p) return false; applyPatch(p, v); msg(""); return true; }
  function stepPreset(d) { var all = allPresets(), i = all.indexOf(G.preset); pickPreset(all[(i + d + all.length) % all.length]); }
  function savePreset() {
    var cur = /^u:(.*)$/.exec(G.preset), box = $("sySaveBox");
    if (box) { box.remove(); return; }
    box = doc.createElement("span"); box.id = "sySaveBox"; box.style.cssText = "display:inline-flex;gap:3px;align-items:center";
    box.innerHTML = '<input id="syName" maxlength="40" style="width:150px;font-size:12px" placeholder="Name this patch"><button class="ghost" id="syNameOk" type="button" title="Save">✓</button>';
    $("sySave").after(box);
    var inp = $("syName"); inp.value = cur ? cur[1] : (G.preset.replace(/^[ou]:/, "") + " (mine)").slice(0, 40); inp.focus(); inp.select();
    var go = function () {
      var name = inp.value.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40);
      if (!name) { msg("Give the patch a name", true); return; }
      G.user = G.user.filter(function (x) { return x.name !== name; }); G.user.push({ name: name, p: G.p });
      G.user.sort(function (a, b) { return a.name.localeCompare(b.name); });
      LS.set("user", JSON.stringify(G.user)); G.preset = "u:" + name; G.dirty = false; keep(); box.remove(); presetList();
      msg("💾 " + name + " saved in My patches");
    };
    $("syNameOk").onclick = go;
    inp.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") go(); else if (e.key === "Escape") box.remove(); });
  }
  function delPreset() {
    var m = /^u:(.*)$/.exec(G.preset); if (!m) return;
    G.user = G.user.filter(function (x) { return x.name !== m[1]; }); LS.set("user", JSON.stringify(G.user));
    msg("🗑 " + m[1] + " deleted (the knobs stay as they are)"); G.preset = "o:Init"; G.dirty = true; keep(); presetList();
  }

  /* ---------------- the rack ---------------- */
  var ORDER = { osc: ["aWave", "bWave", "aOct", "bSemi", "aDet", "bDet", "aLvl", "bLvl", "sub", "noise", "uni", "spread"], filter: ["fType", "drive", "cut", "res", "fEnv", "kTrack"],
                fenv: ["fA", "fD", "fS", "fR"], aenv: ["aA", "aD", "aS", "aR"], lfo: ["lTarget", "lWave", "lRate", "lDepth"],
                fx: ["dTime", "dFb", "dMix", "chorus", "rSize", "rMix"], master: ["mode", "vol", "glide"] };
  var GRID = { fenv: "sygrid c2", aenv: "sygrid c2", lfo: "sygrid c2", fx: "sygrid c3", master: "sygrid c2" };
  function control(id, color) {
    var q = C.BY[id];
    if (q.ch) return KN.pick({ label: q.label, color: color, values: q.ch, get: function () { return G.p[id]; }, set: function (v) { ctx(); setParam(id, v); } });
    return KN.knob({ label: q.label, color: color, def: C.toNorm(id, q.def), steps: q.c === "int" ? q.max - q.min + 1 : 0, bipolar: q.min < 0,
                     get: function () { return C.toNorm(id, G.p[id]); }, set: function (n) { setParam(id, C.fromNorm(id, n)); }, text: function () { return C.show(id, G.p[id]); } });
  }
  function rack() {
    var host = $("syRack"), screen = host && host.querySelector(".syscreen"); if (!host) return;
    host.querySelectorAll(".sypanel:not(.syscreen)").forEach(function (x) { x.remove(); });
    G.knobs = {};
    C.SECTIONS.forEach(function (s) {
      var pn = doc.createElement("div"); pn.className = "sypanel"; pn.dataset.sec = s.id; pn.style.setProperty("--c", s.color);
      pn.innerHTML = "<h4>" + esc(s.name) + "</h4>";
      if (s.id === "fenv" || s.id === "aenv") {   // the envelope drawn (in a box: the canvas never widens the panel)
        var wrap = doc.createElement("div"), cv = doc.createElement("canvas"); wrap.style.cssText = "position:relative;height:34px";
        cv.className = "syenv"; cv.dataset.env = s.id; cv.width = 10; cv.height = 10; cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block";
        wrap.appendChild(cv); pn.appendChild(wrap);
      }
      var box = doc.createElement("div"); box.className = GRID[s.id] || "sygrid";
      ORDER[s.id].forEach(function (id) { var k = control(id, s.color); k.el.dataset.p = id; G.knobs[id] = k; box.appendChild(k.el); });
      pn.appendChild(box);
      // the screen sits after the filter
      if (["osc", "filter"].indexOf(s.id) >= 0) host.insertBefore(pn, screen); else host.appendChild(pn);
    });
    envDraw();
  }
  function envDraw() {
    doc.querySelectorAll("#syRack canvas.syenv").forEach(function (cv) {
      var w = cv.clientWidth || 200, h = cv.clientHeight || 34, dpr = Math.min(3, root.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      var x = cv.getContext("2d"); if (!x) return; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
      var k = cv.dataset.env === "fenv" ? "f" : "a", A = G.p[k + "A"], D = G.p[k + "D"], S = G.p[k + "S"], R = G.p[k + "R"], col = cv.dataset.env === "fenv" ? "#b78cff" : "#ffae3a";
      // time drawn on a square-root scale so short and long both read
      var tot = Math.sqrt(A) + Math.sqrt(D) + 0.6 + Math.sqrt(R), sx = (w - 4) / tot, y0 = h - 3, y1 = 3, X = 2;
      x.beginPath(); x.moveTo(X, y0); X += Math.sqrt(A) * sx; x.lineTo(X, y1); X += Math.sqrt(D) * sx; var ys = y0 - (y0 - y1) * S; x.lineTo(X, ys); X += 0.6 * sx; x.lineTo(X, ys); X += Math.sqrt(R) * sx; x.lineTo(X, y0);
      x.save(); x.shadowColor = col; x.shadowBlur = 6; x.strokeStyle = col; x.lineWidth = 1.6; x.stroke(); x.restore();
      x.lineTo(2, y0); x.closePath(); x.fillStyle = col + "22"; x.fill();
    });
  }

  /* ---------------- the screen ---------------- */
  function scopeCanvas() {
    var cv = $("syScope"); if (!cv) return null;
    var w = cv.clientWidth || 300, h = cv.clientHeight || 110, dpr = Math.min(2, root.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var x = cv.getContext("2d"); if (!x) return null; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = "#05070a"; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#38e1ff14"; x.lineWidth = 1;
    for (var i = 1; i < 8; i++) { x.beginPath(); x.moveTo(w * i / 8, 0); x.lineTo(w * i / 8, h); x.stroke(); }
    for (var j = 1; j < 4; j++) { x.beginPath(); x.moveTo(0, h * j / 4); x.lineTo(w, h * j / 4); x.stroke(); }
    return { x: x, w: w, h: h };
  }
  function line(s, pts, col, glow) {
    var x = s.x; x.save(); x.shadowColor = col; x.shadowBlur = glow; x.strokeStyle = col; x.lineWidth = 1.8; x.beginPath();
    for (var i = 0; i < pts.length; i++) { var px = i / (pts.length - 1) * s.w, py = s.h / 2 - pts[i] * s.h * 0.42; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
    x.stroke(); x.restore();
  }
  /** quiet: two cycles of the patch's oscillators drawn as they would sound */
  function shape(w, ph) { ph = ph - Math.floor(ph); return w === "saw" ? 2 * ph - 1 : w === "square" ? (ph < 0.5 ? 1 : -1) : w === "triangle" ? 1 - 4 * Math.abs(ph - 0.5) : Math.sin(2 * Math.PI * ph); }
  function drawIdle() {
    var s = scopeCanvas(); if (!s || !G.p) return;
    var pts = [], n = 240, p = G.p, rb = Math.pow(2, (p.bSemi * 100 + p.bDet - p.aOct * 1200 - p.aDet) / 1200), m = 0;
    for (var i = 0; i < n; i++) { var ph = i / n * 2, v = p.aLvl * shape(p.aWave, ph) + p.bLvl * shape(p.bWave, ph * rb) + p.sub * Math.sin(Math.PI * ph); pts.push(v); m = Math.max(m, Math.abs(v)); }
    if (m > 0) pts = pts.map(function (v) { return v / m; });
    line(s, pts, "#38e1ff66", 6);
    screenText();
  }
  var buf = null;
  function drawLive() {
    G.raf = 0;
    if (!G.E || !shown()) return;
    var an = G.E.scope, s = scopeCanvas(); if (!s) return;
    if (!buf || buf.length !== an.fftSize) buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    // start on a rising zero crossing - a steady picture
    var st = 0; for (var i = 1; i < buf.length / 2; i++) if (buf[i - 1] < 0 && buf[i] >= 0) { st = i; break; }
    var pts = [], n = Math.min(900, buf.length - st), peak = 0;
    for (var j = 0; j < n; j += 2) { pts.push(buf[st + j] * 2.2); peak = Math.max(peak, Math.abs(buf[st + j])); }
    if (peak < 0.0008 && !LP.playing() && !G.E.sounding()) { drawIdle(); G.idle = (G.idle || 0) + 1; if (G.idle > 30) return; }
    else { G.idle = 0; line(s, pts, "#38e1ff", 10); }
    G.raf = root.requestAnimationFrame(drawLive);
  }
  function wake() { if (!G.raf && G.E && shown()) { G.idle = 0; G.raf = root.requestAnimationFrame(drawLive); } }
  function screenText() {
    var t = $("syScreenTxt"); if (!t) return;
    var name = (G.preset || "").replace(/^[ou]:/, "") + (G.dirty ? " *" : "");
    t.textContent = name + (G.last != null ? "  ·  " + C.noteName(G.last) : "") + (G.E ? "  ·  " + G.E.sounding() + " voice" + (G.E.sounding() === 1 ? "" : "s") : "");
  }

  /* ---------------- playing notes ---------------- */
  function noteOn(m, vel) {
    if (m < 0 || m > 127) return;
    try { engine().noteOn(m, vel); } catch (e) { msg(e.message, true); return; }
    G.down[m] = (G.down[m] || 0) + 1; G.last = m; piano(); screenText(); wake();
  }
  function noteOff(m) {
    if (!G.down[m]) return;
    G.down[m]--; if (G.down[m] <= 0) delete G.down[m];
    if (!G.down[m] && G.E) G.E.noteOff(m);
    piano(); screenText();
  }
  function allOff() { G.down = {}; G.keys = {}; G.ptr = {}; if (G.E) G.E.allOff(); piano(); screenText(); }
  function base() { return 12 * (G.oct + 1); }
  function setOct(o) { G.oct = Math.max(0, Math.min(7, o)); LS.set("oct", G.oct); var b = $("syOct"); if (b) b.textContent = "C" + G.oct; piano(); }

  /* ---------------- the keyboard on screen ---------------- */
  // 2.953.1 (Tim: "can u make the keyboard look a little more like a keyboard"): drawn like a real one - a felt strip
  // under the case's lip, ivory keys with rounded fronts and a lip, black keys with a top face, a sloped front and a
  // shadow on the white keys; a pressed key goes down (shorter, its front lip hidden) with an amber glow
  var KB = { n: 36, geo: null, felt: 7 };
  function pianoGeo(w, h) {
    var lo = base(), whites = [], blacks = [], F = KB.felt;
    for (var m = lo; m < lo + KB.n + 1; m++) if (!C.isBlack(m)) whites.push(m);
    var ww = w / whites.length, bw = ww * 0.58, bh = (h - F) * 0.62, keys = [];
    whites.forEach(function (m, i) { keys.push({ m: m, x: i * ww, y: F, w: ww, h: h - F, black: false }); });
    whites.forEach(function (m, i) { if (C.isBlack(m + 1) && m + 1 < lo + KB.n + 1) blacks.push({ m: m + 1, x: (i + 1) * ww - bw / 2, y: F, w: bw, h: bh, black: true }); });
    return { keys: keys.concat(blacks), blacks: blacks, whites: keys, w: w, h: h, F: F };
  }
  /** a rectangle with rounded BOTTOM corners (the front of a key) */
  function keyPath(x, X, Y, W, H, r) {
    r = Math.min(r, W / 2, H / 2);
    x.beginPath(); x.moveTo(X, Y); x.lineTo(X + W, Y); x.lineTo(X + W, Y + H - r); x.quadraticCurveTo(X + W, Y + H, X + W - r, Y + H);
    x.lineTo(X + r, Y + H); x.quadraticCurveTo(X, Y + H, X, Y + H - r); x.closePath();
  }
  function piano() {
    var cv = $("syPiano"); if (!cv) return;
    var w = cv.clientWidth || 600, h = cv.clientHeight || 130, dpr = Math.min(2, root.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var x = cv.getContext("2d"); if (!x) return; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = KB.geo = pianoGeo(w, h), F = g.F;
    // the bed under the keys (shows in the gaps) and the felt strip
    x.fillStyle = "#0b0c0f"; x.fillRect(0, 0, w, h);
    var fe = x.createLinearGradient(0, 0, 0, F);
    fe.addColorStop(0, "#1c0709"); fe.addColorStop(0.45, "#6a1a22"); fe.addColorStop(1, "#2c0b0f");
    x.fillStyle = fe; x.fillRect(0, 0, w, F);
    // white keys
    g.whites.forEach(function (k) {
      var on = !!G.down[k.m], X = k.x + 0.6, W = k.w - 1.2, top = F, H = h - F - (on ? 3 : 1), lip = on ? 3 : 7;
      var gr = x.createLinearGradient(0, top, 0, top + H);
      gr.addColorStop(0, on ? "#b9b2a3" : "#c8c3b8");
      gr.addColorStop(0.07, on ? "#e6dfd0" : "#f1eee6");
      gr.addColorStop(0.8, on ? "#efe8da" : "#fcfbf7");
      gr.addColorStop(1, on ? "#ddd4c3" : "#ebe7de");
      keyPath(x, X, top, W, H, 4); x.fillStyle = gr; x.fill();
      // the front lip
      var lg = x.createLinearGradient(0, top + H - lip, 0, top + H);
      lg.addColorStop(0, "rgba(0,0,0,0.10)"); lg.addColorStop(0.25, "rgba(255,255,255,0.55)"); lg.addColorStop(1, "rgba(150,140,120,0.35)");
      keyPath(x, X, top + H - lip, W, lip, 4); x.fillStyle = lg; x.fill();
      // its sides
      x.fillStyle = "rgba(0,0,0,0.10)"; x.fillRect(X + W - 1, top, 1, H - 4);
      x.fillStyle = "rgba(255,255,255,0.7)"; x.fillRect(X, top, 1, H - 4);
      if (on) {
        x.fillStyle = "rgba(255,174,58,0.28)"; keyPath(x, X, top, W, H, 4); x.fill();
        x.save(); x.shadowColor = "#ffae3a"; x.shadowBlur = 12; x.fillStyle = "#ffb347"; x.fillRect(X + 4, top + H - 9, W - 8, 2.5); x.restore();
      }
      if (k.m % 12 === 0) { x.fillStyle = on ? "#7a5a2a" : "#8d877a"; x.font = "600 9px system-ui, sans-serif"; x.textAlign = "center"; x.fillText(C.noteName(k.m), X + W / 2, top + H - lip - 5); }
    });
    // the shadow the case's lip throws on the keys
    var sh = x.createLinearGradient(0, F, 0, F + 10);
    sh.addColorStop(0, "rgba(0,0,0,0.45)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = sh; x.fillRect(0, F, w, 10);
    // black keys: a shadow on the whites, the body, the top face, the sloped front
    g.blacks.forEach(function (k) {
      var on = !!G.down[k.m], X = k.x, W = k.w, top = F, H = k.h - (on ? 2 : 0), front = on ? 4 : 10;
      x.save(); x.shadowColor = "rgba(0,0,0,0.55)"; x.shadowBlur = 6; x.shadowOffsetX = 2; x.shadowOffsetY = on ? 1 : 3;
      keyPath(x, X, top, W, H, 2.5); x.fillStyle = "#08090b"; x.fill(); x.restore();
      var bd = x.createLinearGradient(X, 0, X + W, 0);
      bd.addColorStop(0, "#050607"); bd.addColorStop(0.5, "#202228"); bd.addColorStop(1, "#050607");
      keyPath(x, X, top, W, H, 2.5); x.fillStyle = bd; x.fill();
      var tf = x.createLinearGradient(0, top, 0, top + H - front);
      tf.addColorStop(0, on ? "#4a3420" : "#2b2d33"); tf.addColorStop(1, on ? "#2a1a0c" : "#121317");
      x.fillStyle = tf; x.fillRect(X + 2, top, W - 4, H - front);
      var ff = x.createLinearGradient(0, top + H - front, 0, top + H);
      ff.addColorStop(0, on ? "#5a3d1e" : "#3a3c43"); ff.addColorStop(1, "#0a0a0c");
      keyPath(x, X + 1, top + H - front, W - 2, front, 2); x.fillStyle = ff; x.fill();
      x.fillStyle = "rgba(255,255,255,0.10)"; x.fillRect(X + 3, top + 2, 1.2, H - front - 4);
      if (on) { x.save(); x.shadowColor = "#ffae3a"; x.shadowBlur = 10; x.fillStyle = "#ffcf8a"; x.fillRect(X + 3, top + H - front - 3, W - 6, 2); x.restore(); }
    });
  }
  function keyAt(px, py) {
    var g = KB.geo; if (!g) return null;
    var y = Math.max(0, py - g.F);
    for (var i = 0; i < g.blacks.length; i++) { var b = g.blacks[i]; if (px >= b.x && px < b.x + b.w && y < b.h) return { m: b.m, vel: 0.35 + 0.65 * Math.min(1, y / b.h) }; }
    for (var j = 0; j < g.whites.length; j++) { var k = g.whites[j]; if (px >= k.x && px < k.x + k.w) return { m: k.m, vel: 0.35 + 0.65 * Math.min(1, y / k.h) }; }
    return null;
  }
  function wirePiano() {
    var cv = $("syPiano"); if (!cv) return;
    var pos = function (e) { var r = cv.getBoundingClientRect(); return keyAt(e.clientX - r.left, e.clientY - r.top); };
    cv.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return; e.preventDefault(); cv.focus();
      var k = pos(e); if (!k) return;
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
      G.ptr[e.pointerId] = k.m; noteOn(k.m, k.vel);
    });
    cv.addEventListener("pointermove", function (e) {
      var was = G.ptr[e.pointerId]; if (was == null) return;
      var k = pos(e); if (!k || k.m === was) return;
      noteOff(was); G.ptr[e.pointerId] = k.m; noteOn(k.m, k.vel);
    });
    var up = function (e) { var was = G.ptr[e.pointerId]; if (was == null) return; delete G.ptr[e.pointerId]; noteOff(was); };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("lostpointercapture", up);
    if (root.ResizeObserver) new root.ResizeObserver(function () { piano(); envDraw(); if (!G.raf) drawIdle(); }).observe(cv);
  }
  /* the bend wheel springs back to the middle; the mod wheel stays */
  function wheel(id, bipolar, apply) {
    var el = $(id); if (!el) return;
    var val = bipolar ? 0 : 0, knobEl = el.querySelector("b");
    function draw() { var hh = el.clientHeight || 96, n = bipolar ? (val + 1) / 2 : val; knobEl.style.top = Math.round((1 - n) * (hh - 8) + 2) + "px"; el.setAttribute("aria-valuenow", String(Math.round(val * 100))); }
    function put(v) { val = Math.max(bipolar ? -1 : 0, Math.min(1, v)); draw(); apply(val); }
    var drag = null;
    el.addEventListener("pointerdown", function (e) { e.preventDefault(); drag = { y: e.clientY, v: val }; try { el.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } ctx(); });
    el.addEventListener("pointermove", function (e) { if (!drag) return; put(drag.v + (drag.y - e.clientY) / ((el.clientHeight || 96) * (bipolar ? 0.5 : 1))); });
    var up = function () { if (!drag) return; drag = null; if (bipolar) put(0); };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowUp" ? 0.1 : e.key === "ArrowDown" ? -0.1 : 0; if (!d) return;
      e.preventDefault(); e.stopPropagation(); ctx(); put(val + d);
    });
    el.addEventListener("keyup", function (e) { if (bipolar && (e.key === "ArrowUp" || e.key === "ArrowDown")) put(0); });
    draw();
    return { set: function (v) { val = v; draw(); } };
  }
  var W = {};

  /* ---------------- the computer keys ---------------- */
  function typing(t) { return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))); }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    var dn = e.type === "keydown";
    if (e.code === "Space") { e.preventDefault(); e.stopPropagation(); if (dn && !e.repeat) { ctx(); LP.play(); wake(); } return; }
    if (dn && (e.key === "ArrowUp" || e.key === "ArrowDown") && !(e.target.closest && e.target.closest(".sykn, .sywheel"))) { e.preventDefault(); e.stopPropagation(); allKeysOff(); setOct(G.oct + (e.key === "ArrowUp" ? 1 : -1)); return; }
    var semi = C.KEYS[e.code]; if (semi == null) return;
    e.preventDefault(); e.stopPropagation();
    if (dn) { if (e.repeat || G.keys[e.code] != null) return; var m = base() + semi; G.keys[e.code] = m; noteOn(m, 0.8); }
    else { var was = G.keys[e.code]; delete G.keys[e.code]; if (was != null) noteOff(was); }
  }
  function allKeysOff() { Object.keys(G.keys).forEach(function (c) { noteOff(G.keys[c]); }); G.keys = {}; }

  /* ---------------- MIDI ---------------- */
  function midiTxt(t, on) { var s = $("syMidiTxt"), b = $("syMidi"); if (s) s.textContent = t; if (b) b.classList.toggle("on", !!on); }
  function midiStart() {
    if (G.midi || G.midiAsked) return;
    G.midiAsked = true;
    if (!root.navigator || !root.navigator.requestMIDIAccess) { midiTxt("MIDI: this browser has none"); return; }
    root.navigator.requestMIDIAccess({ sysex: false }).then(function (acc) {
      G.midi = acc; acc.onstatechange = midiList; midiList();
    }, function () { midiTxt("MIDI: blocked by the browser"); });
  }
  function midiList() {
    var sel = $("syMidiIn"); if (!sel || !G.midi) return;
    var ins = []; G.midi.inputs.forEach(function (i) { ins.push(i); });
    sel.innerHTML = '<option value="*">All inputs</option>' + ins.map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.name || i.id) + "</option>"; }).join("");
    sel.value = ins.some(function (i) { return i.id === G.midiIn; }) ? G.midiIn : "*";
    ins.forEach(function (i) { i.onmidimessage = function (ev) { if (sel.value === "*" || sel.value === i.id) midiMsg(ev.data); }; });
    midiTxt(ins.length ? "MIDI: " + ins.length + " in" : "MIDI: plug in a keyboard", ins.length > 0);
  }
  /** one MIDI message (also the tests' way in) */
  function midiMsg(d) {
    if (!d || d.length < 2 || !shown()) return;
    var st = d[0] & 0xf0, a = d[1], b = d.length > 2 ? d[2] : 0;
    var dot = $("syMidi"); if (dot) { dot.classList.add("hit"); root.setTimeout(function () { dot.classList.remove("hit"); }, 60); }
    if (st === 0x90 && b > 0) noteOn(a, b / 127);
    else if (st === 0x80 || (st === 0x90 && b === 0)) noteOff(a);
    else if (st === 0xb0) {
      if (a === 1) { engine().mod(b / 127); if (W.mod) W.mod.set(b / 127); }
      else if (a === 64) engine().sustain(b >= 64);
      else if (a === 7) setParam("vol", b / 127);
      else if (a === 123 || a === 120) allOff();
    } else if (st === 0xe0) { var v = ((b << 7) | a) - 8192; engine().bend(v / 8192); if (W.bend) W.bend.set(v / 8192); }
  }

  /* ---------------- the samples library, the project ---------------- */
  function getJ(u) { return root.fetch(u).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.statusText); return j; }); }); }
  function refresh() {
    return Promise.all([getJ("/api/synth/samples").catch(function () { return { samples: [] }; }), getJ("/api/sfx").catch(function () { return { files: [] }; })]).then(function (r) {
      G.my = (r[0].samples || []).map(function (x) { return x.name; }); G.sfx = (r[1].files || []).map(function (x) { return x.name; });
      LP.setLists(G.my, G.sfx); libList();
      return { my: G.my, sfx: G.sfx };
    });
  }
  function libList() {
    var box = $("syLibList"); if (!box) return;
    box.innerHTML = G.my.length ? "" : '<div style="color:#8b95a7">No samples yet - ＋ Add files, drop some here, or 🎙 Sample it</div>';
    G.my.forEach(function (n) {
      var row = doc.createElement("div");
      row.innerHTML = '<button class="ghost" type="button" title="Listen">▶</button><span title="' + esc(n) + '">' + esc(n) + '</span><select title="Put it in a row of the looper"><option value="">→ row…</option>'
        + LP.loop().rows.map(function (r, i) { return '<option value="' + i + '">Row ' + (i + 1) + " (" + esc(LP.sndName(r.snd)) + ")</option>"; }).join("") + '</select><button class="ghost" type="button" title="Delete this sample">🗑</button>';
      var bs = row.querySelectorAll("button");
      bs[0].onclick = function () { var c = ctx(); LP.buffer("my:" + n).then(function (b) { var s = c.createBufferSource(); s.buffer = b; s.connect(G.E.mix); s.start(); }).catch(function () { /* said */ }); };
      row.querySelector("select").onchange = function (e) { var r = +e.target.value; if (e.target.value !== "") { ctx(); LP.assign(r, "my:" + n); msg(n + " is in row " + (r + 1)); libList(); } };
      bs[1].onclick = function () {
        root.fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) })
          .then(function (r) { return r.json(); }).then(function (j) { if (j.error) throw new Error(j.error); LP.forget("my:" + n); msg("🗑 " + n + " deleted"); return refresh(); })
          .catch(function (e) { msg(e.message, true); });
      };
      box.appendChild(row);
    });
  }
  /** files -> the library (row given: the first one goes into that row) */
  function upload(files, row) {
    var fd = new root.FormData(), n = 0;
    [].forEach.call(files || [], function (f) { fd.append("files", f, f.name || "sample.wav"); n++; });
    if (!n) return Promise.resolve(null);
    msg("Adding " + n + " sample" + (n === 1 ? "" : "s") + "…");
    return root.fetch("/api/synth/samples", { method: "POST", body: fd }).then(function (r) { return r.json(); }).then(function (j) {
      return refresh().then(function () {
        var added = (j.added || []).map(function (x) { return x.name; });
        if (added.length && row != null) { ctx(); LP.assign(row, "my:" + added[0]); }
        msg(added.length ? "📂 " + added.join(", ") + (row != null ? " - in row " + (row + 1) : " - in My samples (pick it in a row)") + (j.errors && j.errors.length ? " · " + j.errors.join(" · ") : "")
                         : (j.errors || ["nothing was added"]).join(" · "), !added.length);
        return j;
      });
    }).catch(function (e) { msg("The samples could not be added - " + e.message, true); });
  }
  function blobOf(r) { return new root.Blob([C.wav(r.chans, r.sampleRate)], { type: "audio/wav" }); }
  function toProject(blob, fname, to, name) {
    var fd = new root.FormData(); fd.append("to", to); fd.append("name", name); fd.append("file", blob, fname);
    return root.fetch("/api/synth/to-project", { method: "POST", body: fd }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error);
      msg("✓ " + j.note); refresh(); return j;
    });
  }
  function loopName() { var L = LP.loop(); return "synth loop " + (L.chain ? "chain" : C.PAT_NAMES.charAt(L.pat)) + " " + L.bpm + "bpm"; }
  /** ⬇ WAV (to = null) / → 💥 SFX (sfx) / → 🔊 (sound) */
  function exportLoop(to) {
    if (G.busy) return Promise.resolve(null);
    var passes = +(($("syPasses") || {}).value || 2);
    G.busy = true; msg("Making the loop's WAV…");
    try { ctx(); } catch (e) { G.busy = false; msg(e.message, true); return Promise.resolve(null); }
    return LP.render(passes).then(function (r) {
      if (!r.hits) throw new Error("the loop is empty - put some steps on first");
      var blob = blobOf(r), name = loopName();
      if (!to) {
        var a = doc.createElement("a"), u = root.URL.createObjectURL(blob); a.href = u; a.download = name + ".wav"; doc.body.appendChild(a); a.click(); a.remove();
        root.setTimeout(function () { root.URL.revokeObjectURL(u); }, 4000);
        msg("⬇ " + name + ".wav (" + r.seconds.toFixed(1) + " s)"); return { name: name + ".wav", seconds: r.seconds, bytes: blob.size };
      }
      return toProject(blob, "loop.wav", to, name);
    }).catch(function (e) { msg(e.message, true); return null; }).then(function (x) { G.busy = false; return x; });
  }
  /** 🎙 Sample it: one note of the patch -> My samples */
  function sample() {
    if (G.busy) return Promise.resolve(null);
    G.busy = true; var m = base() + 12, name = (G.preset.replace(/^[ou]:/, "") || "synth") + " " + C.noteName(m) + ".wav";
    msg("🎙 Sampling " + C.noteName(m) + "…");
    return V.sampleNote(G.p, m, 1).then(function (r) {
      var f = new root.File([C.wav(r.chans, r.sampleRate)], name, { type: "audio/wav" });
      return upload([f], null).then(function (j) {
        var got = j && j.added && j.added[0]; if (got) msg("🎙 " + got.name + " is in My samples (pitch " + C.noteName(m) + " = 0 st) - pick it in a looper row");
        return got || null;
      });
    }).catch(function (e) { msg("🎙 " + e.message, true); return null; }).then(function (x) { G.busy = false; return x; });
  }
  /** ⏺ Rec / ⏹: what plays -> a take in the project's SFX */
  function rec() {
    var b = $("syRec");
    if (G.rec) { G.rec.r.stop(); return; }
    if (!root.MediaRecorder) { msg("⏺ this browser cannot record", true); return; }
    var c = ctx(), dst = c.createMediaStreamDestination(); G.E.scope.connect(dst);
    var type = root.MediaRecorder.isTypeSupported && root.MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    var r = type ? new root.MediaRecorder(dst.stream, { mimeType: type }) : new root.MediaRecorder(dst.stream), parts = [], t0 = Date.now();
    r.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
    r.onstop = function () {
      try { G.E.scope.disconnect(dst); } catch (e) { /* fine */ }
      G.rec = null; if (b) { b.classList.remove("on"); b.textContent = "⏺ Rec"; }
      var blob = new root.Blob(parts, { type: "audio/webm" }), d = new Date();
      if (!blob.size) { msg("⏺ nothing was recorded", true); return; }
      msg("Putting the take in this project's SFX…");
      toProject(blob, "take.webm", "sfx", "synth take " + d.toTimeString().slice(0, 8).replace(/:/g, "-")).catch(function (e) { msg(e.message, true); });
    };
    r.start(250); G.rec = { r: r, t0: t0 };
    if (b) { b.classList.add("on"); b.textContent = "⏹ Stop rec"; }
    msg("⏺ Recording - play, then ⏹ Stop rec");
  }

  /* ---------------- ⛶ = the whole window ---------------- */
  function setFull(on) {
    on = !!on; if (on === doc.body.classList.contains("sy-full")) return;
    doc.body.classList.toggle("sy-full", on);
    if (!on && doc.fullscreenElement && doc.exitFullscreen) { try { var q = doc.exitFullscreen(); if (q && q.catch) q.catch(function () {}); } catch (e) { /* fine */ } }
    root.setTimeout(function () { piano(); envDraw(); drawIdle(); }, 80);
  }
  function exitFull() { if (typeof root.toggleMax === "function" && $("synthdock").classList.contains("maxed")) root.toggleMax("synthdock", false); setFull(false); }

  /* ---------------- start ---------------- */
  function hideStop() { if (!shown()) { if (LP.playing()) LP.play(false); allOff(); if (G.rec) G.rec.r.stop(); } }
  function boot() {
    var d = $("synthdock"); if (!d) return;
    try { if (root.localStorage.getItem("h3.g.synthdock") === "1") d.classList.add("dockgone"); } catch (e) { /* fine */ }
    G.p = C.cleanPatch(jget("patch", null) || presetOf(G.preset) || C.defaults());
    rack(); presetList(); setOct(G.oct);
    LP.init({ ctx: ctx, dest: function () { return engine().mix; }, msg: msg, changed: function () { root.clearTimeout(G.lt); G.lt = root.setTimeout(function () { LS.set("loop", JSON.stringify(LP.loop())); }, 300); },
              upload: upload, pick: function (r) { G.pickRow = r; $("syFile").click(); } });
    var saved = jget("loop", null); if (saved) LP.setLoop(saved);
    wirePiano();
    W.bend = wheel("syBend", true, function (v) { engine().bend(v); });
    W.mod = wheel("syMod", false, function (v) { engine().mod(v); });
    var on = function (id, f) { var el = $(id); if (el) el.onclick = f; };
    on("syPrev", function () { stepPreset(-1); }); on("syNext", function () { stepPreset(1); });
    $("syPreset").onchange = function (e) { pickPreset(e.target.value); };
    on("sySave", savePreset); on("syDelPreset", delPreset);
    on("syPanic", function () { allOff(); if (LP.playing()) LP.play(false); msg("Every note off"); });
    on("syAudioOn", function () { ctx(); });
    on("syOctUp", function () { setOct(G.oct + 1); }); on("syOctDn", function () { setOct(G.oct - 1); });
    on("sySample", sample); on("syRec", rec);
    on("syWav", function () { exportLoop(null); }); on("syToSfx", function () { exportLoop("sfx"); }); on("syToSound", function () { exportLoop("sound"); });
    on("syLibBtn", function () { var l = $("syLib"); l.classList.toggle("on"); if (l.classList.contains("on")) refresh(); });
    on("syLibClose", function () { $("syLib").classList.remove("on"); });
    on("syAdd", function () { G.pickRow = null; $("syFile").click(); });
    $("syFile").onchange = function (e) { var r = G.pickRow; G.pickRow = null; upload(e.target.files, r).then(function () { e.target.value = ""; }); };
    var drop = $("syDrop");
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer && e.dataTransfer.files.length) upload(e.dataTransfer.files, null); });
    $("syMidiIn").onchange = function (e) { G.midiIn = e.target.value; LS.set("midi", G.midiIn); };
    var body = $("syBody");
    body.addEventListener("keydown", onKey); body.addEventListener("keyup", onKey);
    body.addEventListener("focusout", function (e) { if (!body.contains(e.relatedTarget)) allKeysOff(); });
    // the first click anywhere in the station wakes the sound (the browser's rule) and asks for MIDI
    body.addEventListener("pointerdown", function (e) { if (!typing(e.target)) { if (!e.target.closest || !e.target.closest("button, select, input, .sykn, canvas, .sywheel")) body.focus({ preventScroll: true }); } try { ctx(); } catch (er) { /* said on play */ } midiStart(); wake(); }, true);
    // Esc while it fills the window: back to the docker (capture: before the page's own) - not while naming a patch
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || e.ctrlKey || e.metaKey || e.altKey || !doc.body.classList.contains("sy-full") || typing(e.target)) return;
      e.preventDefault(); e.stopImmediatePropagation(); exitFull();
    }, true);
    doc.addEventListener("fullscreenchange", function () { if (!doc.fullscreenElement && doc.body.classList.contains("sy-full")) exitFull(); });
    if (root.MutationObserver) new root.MutationObserver(function () { setFull(d.classList.contains("maxed") && !d.classList.contains("dockgone")); hideStop(); if (shown()) { root.setTimeout(function () { piano(); envDraw(); drawIdle(); wake(); }, 60); midiStart(); refresh(); } })
      .observe(d, { attributes: true, attributeFilter: ["class"] });
    doc.addEventListener("visibilitychange", function () { if (doc.hidden) allKeysOff(); });
    setFull(d.classList.contains("maxed") && !d.classList.contains("dockgone"));
    piano(); drawIdle();
    if (shown()) { midiStart(); refresh(); }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();

  root.H3Synth = {
    noteOn: noteOn, noteOff: noteOff, allOff: allOff, set: function (id, v) { setParam(id, v); return G.p[id]; }, preset: function (name) { return pickPreset(/^[ou]:/.test(name) ? name : "o:" + name); },
    engine: engine, ctx: ctx, refresh: refresh, exitFull: exitFull, sample: sample, exportLoop: exportLoop, upload: upload, midi: midiMsg, octave: setOct, rec: rec,
    info: function () {
      return { shown: shown(), preset: G.preset, dirty: G.dirty, oct: G.oct, down: Object.keys(G.down).map(Number), last: G.last, p: G.p, state: G.ctx ? G.ctx.state : "none",
               voices: G.E ? G.E.sounding() : 0, knobs: Object.keys(G.knobs).length, my: G.my.slice(), sfx: G.sfx.slice(), recording: !!G.rec, midi: !!G.midi, user: G.user.map(function (x) { return x.name; }),
               loop: LP.info() };
    },
  };
})(window);

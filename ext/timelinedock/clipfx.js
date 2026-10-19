/* bitGen Studio — ext/timelinedock/clipfx.js (2.406.0): a timeline clip's 🎬 SPEED / REVERSE / RAMP, 🎨 COLOUR (grade,
 * looks, LUTs) and 🎧 SOUND clean-up, in the canvas's Properties panel, plus the 🎚 MIX dialog (each layer's role,
 * the music ducked under the voices, the loudness).
 *
 * Tim: "what tools does adobe premier that bitgen doesn't?" -> "lets start closing the gap and go with your
 * suggestions as you see fit".
 *
 * Everything is stored on the timeline itself (saved with it): clip.fx (static/clipfx.js normalizes it), layer.role
 * (voice | music | sfx), tl.mix = {duck: {on, amount}, loudness: {on, target}}. The canvas previews the speed and the
 * colour with the compile's own maths (canvas.js srcAt, static/gradegl.js); the sound clean-up is heard with 🎧 (the
 * compile's own filters on a few seconds - POST /api/clipfx/afx-preview). The compile: lib/clipFx.forJob ->
 * scripts/clipfx_render.py, scripts/mixfx.py.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function log(t) { if (typeof logLine === "function") logLine("[clip fx] " + t); }
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && window.H3ClipFx && window.TlDlg); } catch (e) { return false; } }
  var F = function () { return window.H3ClipFx; };
  var lib = { luts: [], looks: {}, ramps: {} }, open = { speed: false, colour: false, sound: false };
  var CSS = ".tlp-fx{border-top:1px solid var(--line,#3a342a);margin-top:6px;padding-top:4px}"
    + ".tlp-fx summary{cursor:pointer;font-weight:600;font-size:.72rem;padding:2px 0;user-select:none}"
    + ".tlp-fx .tlp-row{flex-wrap:wrap}.tlp-fx input[type=range]{flex:1;min-width:70px}"
    + ".tlp-fx .fxv{min-width:38px;text-align:right;color:var(--dim,#9a917f);font-size:.66rem}"
    + ".tlp-fx .fxdim{color:var(--dim,#9a917f);font-size:.66rem}"
    + ".tlp-fx .fxon{color:var(--tiger,#f59e2c)}";
  function css() { if (!$("tlFxCss")) { var st = document.createElement("style"); st.id = "tlFxCss"; st.textContent = CSS; document.head.appendChild(st); } }

  function loadLib() {
    return fetch("/api/luts").then(function (r) { return r.json(); }).then(function (j) {
      lib.luts = j.luts || []; lib.looks = j.looks || F().LOOKS; lib.ramps = j.ramps || F().RAMPS;
    }).catch(function () { lib.looks = F().LOOKS; lib.ramps = F().RAMPS; });
  }

  function touch(c, sel, structural) {
    if (typeof tlSave === "function") tlSave();
    TlCanvas.mark();
    if (structural) {
      if (sel && sel.Ly.kind === "v1" && typeof resolveOverlaps === "function") { try { resolveOverlaps(); } catch (e) { /* older core */ } }
      if (typeof renderTimeline === "function") renderTimeline();
    }
  }
  function setFx(c, d) {
    var n = F().normalize(d);
    if (n) { if (d.look && !n.look) n.look = d.look; c.fx = n; } else delete c.fx;
  }
  function rampName(fx) {
    if (!fx || !fx.ramp) return "";
    var k = JSON.stringify(fx.ramp);
    var hit = Object.keys(lib.ramps).filter(function (n) { return JSON.stringify(F().normalize({ ramp: lib.ramps[n] }).ramp) === k; })[0];
    return hit || "custom";
  }
  function roleSel(id, L, dflt) {
    var v = L.role || dflt;
    return '<select id="' + id + '" title="Its part in the 🎚 mix: the music ducks under the voices">'
      + [["voice", "🗣 voice"], ["music", "🎵 music"], ["sfx", "💥 sfx"]].map(function (r) { return '<option value="' + r[0] + '"' + (v === r[0] ? " selected" : "") + ">" + r[1] + "</option>"; }).join("")
      + "</select>";
  }

  /* ---------------------------------------------------------------- the Properties panel */
  function props(P, c, sel) {
    if (window.TlColour) TlColour.refresh();             // 2.407.0: the Colour dialog follows the selection
    // 2.409.0: an ADJUSTMENT LAYER (a picture-layer clip marked adjust) has 🎨 Colour + ✨ Effects, nothing else
    var isAdj = !!(c && c.adjust && sel && sel.Ly.kind === "img");
    if (!c || c.m3d || c.text || !sel || (sel.Ly.kind === "img" && !isAdj)) return;
    css();
    var X = F(), fx = c.fx || {}, aud = sel.Ly.kind === "aud", h = "";
    var srcLen = Math.max(0, (c.out != null ? c.out : (c.dur || 0)) - (c.in || 0));
    if (!aud) {
      var g = fx.grade || {}, rn = rampName(fx);
      var sp = Math.round((fx.speed || 1) * 100);
      if (isAdj) h += '<div class="tlp-t" style="margin-top:6px">◐ Adjustment layer</div><div class="fxdim">Its colour and effects work on every layer under it while it is on the timeline; its opacity mixes them in.</div>';
      if (!isAdj) h += '<details class="tlp-fx" id="tfxSpeed"' + (open.speed ? " open" : "") + '><summary' + (X.retimed(fx) ? ' class="fxon"' : "") + ">🎬 Speed</summary>"
        + '<div class="tlp-row"><label>Speed <input type="number" id="tfxSp" min="10" max="1000" step="5" value="' + sp + '" style="width:62px"' + (fx.ramp || fx.remap ? " disabled" : "") + ">%</label>"
        + '<label><input type="checkbox" id="tfxRev"' + (fx.reverse && !fx.remap ? " checked" : "") + (fx.remap ? " disabled" : "") + "> ⇄ reverse</label></div>"
        + '<div class="tlp-row"><label>Ramp <select id="tfxRamp"' + (fx.remap ? " disabled" : "") + '><option value="">none</option>'
        + Object.keys(lib.ramps).map(function (n) { return '<option' + (n === rn ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("")
        + (rn === "custom" ? '<option value="custom" selected>custom</option>' : "") + "</select></label>"
        + '<label title="How slowed frames are made: repeat (crisp), blend neighbours, or optical flow (smooth, slow to compile)">Frames <select id="tfxBlend">'
        + [["dup", "repeat"], ["blend", "blend"], ["flow", "optical flow"]].map(function (b) { return '<option value="' + b[0] + '"' + ((fx.blend || "dup") === b[0] ? " selected" : "") + ">" + b[1] + "</option>"; }).join("")
        + "</select></label></div>"
        + (window.TlRemap ? TlRemap.html(c, fx) : "")                          // 2.501.0: ⏱ time remapping on a curve
        + '<div class="fxdim" id="tfxLen">' + srcLen.toFixed(2) + " s of source → " + (X.clipLen(Object.assign({}, c, { out: c.out != null ? c.out : c.dur })) || srcLen).toFixed(2) + " s on the timeline</div></details>";
      h += '<details class="tlp-fx" id="tfxColour"' + (open.colour ? " open" : "") + '><summary' + (X.graded(fx) ? ' class="fxon"' : "") + ">🎨 Colour</summary>"
        + '<div class="tlp-row"><label>Look <select id="tfxLook"><option value="">—</option>'
        + Object.keys(lib.looks).map(function (n) { return '<option' + (n === fx.look ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + "</select></label>"
        + '<button class="ghost" id="tfxCReset" title="No grade, no LUT">Reset</button>'
        + '<button class="ghost" id="tfxCMore" title="Wheels, curves, HSL secondaries and scopes">🎨 more…</button></div>'
        + Object.keys(X.GRADE).map(function (k) {
          var L = X.GRADE[k], v = g[k] != null ? g[k] : L[2], st = k === "exposure" ? 0.05 : 1;
          return '<div class="tlp-row"><span style="width:74px">' + k + '</span><input type="range" data-g="' + k + '" min="' + L[0] + '" max="' + L[1] + '" step="' + st + '" value="' + v + '">'
            + '<span class="fxv" data-gv="' + k + '">' + v + "</span></div>";
        }).join("")
        + '<div class="tlp-row"><label>LUT <select id="tfxLut" style="max-width:150px"><option value="">none</option>'
        + lib.luts.map(function (l) { return '<option value="' + esc(l.name) + '"' + (l.name === fx.lut ? " selected" : "") + ">" + esc(l.name.replace(/\.cube$/i, "")) + (l.where === "app" ? " ·app" : "") + "</option>"; }).join("")
        + (fx.lut && !lib.luts.some(function (l) { return l.name === fx.lut; }) ? '<option selected value="' + esc(fx.lut) + '">' + esc(fx.lut) + " (missing)</option>" : "")
        + '</select></label><button class="ghost" id="tfxLutAdd" title="Import a .cube LUT into this project">＋ LUT</button>'
        + '<input type="file" id="tfxLutFile" accept=".cube" class="hidden" style="display:none"></div>'
        + '<div class="tlp-row"><span style="width:74px">LUT mix</span><input type="range" id="tfxLutMix" min="0" max="100" step="1" value="' + Math.round((fx.lut_mix != null ? fx.lut_mix : 1) * 100) + '"' + (fx.lut ? "" : " disabled") + ">"
        + '<span class="fxv" id="tfxLutMixV">' + Math.round((fx.lut_mix != null ? fx.lut_mix : 1) * 100) + "%</span></div></details>";
      h += effectsHtml(fx.vfx || {}, isAdj, c);
    }
    var a = fx.afx || {};
    if (!isAdj) h += '<details class="tlp-fx" id="tfxSound"' + (open.sound || aud ? " open" : "") + '><summary' + (X.hasAfx(fx) ? ' class="fxon"' : "") + ">🎧 Sound</summary>"
      + '<div class="tlp-row"><label><input type="checkbox" id="tfxVoice"' + (a.voice ? " checked" : "") + ' title="High-pass, a little presence, a gentle compressor"> 🗣 voice clarity</label>'
      + "<label>Role " + roleSel("tfxRole", sel.Ly.L, aud ? "music" : "voice") + "</label></div>"
      + '<div class="tlp-row"><span style="width:74px">denoise</span><input type="range" id="tfxDn" min="0" max="100" step="1" value="' + Math.round((a.denoise || 0) * 100) + '">'
      + '<span class="fxv" id="tfxDnV">' + Math.round((a.denoise || 0) * 100) + "%</span></div>"
      + '<div class="tlp-row"><span style="width:74px">gain</span><input type="range" id="tfxGain" min="-24" max="24" step="0.5" value="' + (a.gain || 0) + '">'
      + '<span class="fxv" id="tfxGainV">' + (a.gain || 0) + " dB</span></div>"
      // 2.412.0: EQ (three bands), a multiband compressor, a reverb (scripts/clipfx_render.py: bass / equalizer / treble,
      // mcompand, aecho) - heard with 🎧 before / after, made in the compile
      + ["low", "mid", "high"].map(function (k) {
        var v = (a.eq && a.eq[k]) || 0, lab = { low: "EQ low", mid: "EQ mid", high: "EQ high" }[k];
        return '<div class="tlp-row"><span style="width:74px" title="' + { low: "A shelf below 120 Hz", mid: "A bell at the middle frequency", high: "A shelf above 8 kHz" }[k] + '">' + lab + "</span>"
          + '<input type="range" id="tfxEq_' + k + '" min="-12" max="12" step="0.5" value="' + v + '" aria-label="' + lab + '">'
          + '<span class="fxv" id="tfxEq_' + k + 'V">' + v + " dB</span></div>"; }).join("")
      + '<div class="tlp-row"><span style="width:74px">mid at</span><input type="range" id="tfxEqHz" min="200" max="5000" step="50" value="' + ((a.eq && a.eq.midHz) || 1000) + '" aria-label="The middle band\'s frequency">'
      + '<span class="fxv" id="tfxEqHzV">' + ((a.eq && a.eq.midHz) || 1000) + " Hz</span></div>"
      + '<div class="tlp-row"><span style="width:74px" title="Three bands (below 200 Hz, to 3 kHz, above) each kept even - a steadier, fuller sound">multiband</span>'
      + '<input type="range" id="tfxComp" min="0" max="100" step="1" value="' + Math.round((a.comp || 0) * 100) + '" aria-label="Multiband compressor amount">'
      + '<span class="fxv" id="tfxCompV">' + Math.round((a.comp || 0) * 100) + "%</span></div>"
      + '<div class="tlp-row"><span style="width:74px" title="The space\'s reflections mixed over the sound">reverb</span>'
      + '<input type="range" id="tfxRev" min="0" max="100" step="1" value="' + Math.round(((a.reverb && a.reverb.mix) || 0) * 100) + '" aria-label="Reverb amount">'
      + '<span class="fxv" id="tfxRevV">' + Math.round(((a.reverb && a.reverb.mix) || 0) * 100) + "%</span>"
      + '<select id="tfxRoom" aria-label="Reverb space">' + X.ROOMS.map(function (r) { return '<option' + (((a.reverb && a.reverb.room) || "room") === r ? " selected" : "") + ">" + r + "</option>"; }).join("") + "</select></div>"
      + (sel.Ly.kind === "v1" || sel.Ly.kind === "vl" ? '<div class="tlp-row" title="J / L cut: this clip\'s sound starts before its picture (J) or runs on after it (L), over the neighbour on its layer (whose sound is silenced there) - a 🎬 retimed clip\'s at its speed">'
        + '<label>J <input type="number" id="tfxJ" min="0" max="10" step="0.1" value="' + ((c.split && c.split.lead) || 0) + '" style="width:50px">s early</label>'
        + '<label>L <input type="number" id="tfxL" min="0" max="10" step="0.1" value="' + ((c.split && c.split.tail) || 0) + '" style="width:50px">s late</label></div>' : "")
      + '<div class="tlp-row"><button class="ghost" id="tfxHear" title="Hear 6 s from the position marker: first as it is, then cleaned up">🎧 before / after</button>'
      + '<button class="ghost" id="tfxMix" title="The mix: ducking + loudness">🎚 Mix…</button></div></details>';
    P.insertAdjacentHTML("beforeend", h);
    ["tfxSpeed", "tfxColour", "tfxSound", "tfxEffects"].forEach(function (id, i) {
      var d = $(id); if (d) d.addEventListener("toggle", function () { open[["speed", "colour", "sound", "effects"][i]] = d.open; });
    });
    var d = JSON.parse(JSON.stringify(fx));
    var commit = function (structural) { setFx(c, d); touch(c, sel, structural); };
    if (!aud) wireVideo(c, sel, d, commit, srcLen);
    if (!aud) wireEffects(c, sel, d, commit);
    if (!isAdj) wireSound(c, sel, d, commit);
  }

  /* ---------------------------------------------------------------- ✨ Effects (2.409.0) */
  var VFXUI = [["blur", "blur", 0, 50, 0.5], ["sharpen", "sharpen", 0, 2, 0.05], ["glow", "glow", 0, 1, 0.01], ["vignette", "vignette", 0, 1, 0.01], ["grain", "grain", 0, 1, 0.01]];
  /** 2.412.0: seconds into the clip on the timeline at the position marker (its effect keyframes count from there) */
  function localT(c) { try { return Math.max(0, (TlCanvas.state.t || 0) - (+c.start || 0)); } catch (e) { return 0; } }
  function effectsHtml(v, isAdj, c) {
    var k = v.key || null;
    var kv = v.kf && v.kf.length && F().vfxAt ? F().vfxAt(v, localT(c)) : v, cr = kv.crop || {};   // keyframed: the values here
    var on = !!(v && Object.keys(v).length);
    var kfs = v.kf || [], lt = localT(c), half = 0.5 / ((tl.tc && +tl.tc.fps) || 25);
    var h = '<details class="tlp-fx" id="tfxEffects"' + (open.effects ? " open" : "") + '><summary' + (on ? ' class="fxon"' : "") + ">✨ Effects" + (kfs.length ? " ◆" : "") + "</summary>"
      + '<div class="tlp-row" id="tfxKfRow" title="Effect keyframes: the values move in a straight line from one ◆ to the next (animated effects). With keys, a slider changed away from a key makes a new one at the position marker.">'
      + '<button class="ghost" type="button" id="tfxKfAdd" title="A key at the position marker with the effects as they are now">◆ key here</button>'
      + kfs.map(function (q, i) {
        var at = Math.abs(q.at - lt) <= half;
        return '<button class="ghost tfxkf' + (at ? " on" : "") + '" type="button" data-kf="' + i + '" title="Go to this key (' + q.at.toFixed(2) + ' s into the clip)" style="padding:0 4px' + (at ? ";color:var(--tiger,#f59e2c)" : "") + '">◆' + q.at.toFixed(2) + "</button>"
          + '<button class="ghost" type="button" data-kfdel="' + i + '" title="Remove this key" style="padding:0 2px">✕</button>';
      }).join("")
      + (kfs.length ? '<button class="ghost" type="button" id="tfxKfClear" title="No keys - the effects stay as they are at the position marker">clear</button>' : "") + "</div>"
      + VFXUI.map(function (e) {
        var val = kv[e[0]] || 0;
        return '<div class="tlp-row"><span style="width:74px">' + e[1] + '</span><input type="range" data-vfx="' + e[0] + '" min="' + e[2] + '" max="' + e[3] + '" step="' + e[4] + '" value="' + val + '">'
          + '<span class="fxv" data-vfxv="' + e[0] + '">' + val + "</span></div>";
      }).join("") + distortHtml(v);
    if (!isAdj) {
      h += '<div class="tlp-row" title="Crop: the edges made see-through (%) - the picture stays where it is">crop'
        + ["l", "t", "r", "b"].map(function (s) { return ' <label>' + { l: "L", t: "T", r: "R", b: "B" }[s] + ' <input type="number" data-crop="' + s + '" min="0" max="45" step="1" value="' + (cr[s] || 0) + '" style="width:40px"></label>'; }).join("") + "</div>"
        + '<div class="tlp-row"><label title="Green / blue screen: that colour becomes see-through"><input type="checkbox" id="tfxKey"' + (k ? " checked" : "") + "> key</label>"
        + '<input type="color" id="tfxKeyC" value="' + esc((k && k.color) || "#00ff00") + '" title="The screen colour">'
        + '<label title="How far from the screen colour still keys">match <input type="range" id="tfxKeyS" min="0.01" max="0.5" step="0.01" value="' + ((k && k.similarity) || 0.12) + '" style="width:60px"></label>'
        + '<label title="A soft edge">edge <input type="range" id="tfxKeyB" min="0" max="0.5" step="0.01" value="' + (k ? k.blend : 0.08) + '" style="width:50px"></label>'
        + '<label title="Remove the screen colour\'s cast from the edges">spill <input type="range" id="tfxKeyP" min="0" max="1" step="0.05" value="' + (k ? k.spill : 0.5) + '" style="width:50px"></label></div>'
        + '<div class="tlp-row"><label title="Steady a shaky shot - the compile (vidstab: smoothed by the %, or locked still) and the canvas (a steady preview of the file, made once)"><input type="checkbox" id="tfxStab"' + (v.stabilise ? " checked" : "") + "> stabilise</label>"
        + '<label title="How smooth the camera path is made (Warp\'s Smoothness)">smooth <input type="range" id="tfxStabS" min="0" max="100" step="5" value="' + ((v.stabilise && v.stabilise.smooth != null) ? v.stabilise.smooth : 50) + '" style="width:60px"' + (v.stabilise ? "" : " disabled") + "></label>"
        + '<label title="No camera motion at all (a tripod shot)"><input type="checkbox" id="tfxStabL"' + (v.stabilise && v.stabilise.lock ? " checked" : "") + (v.stabilise ? "" : " disabled") + "> locked</label>"
        + '<span class="fx-dim" id="tfxStabState" style="font-size:.66rem"></span></div><div class="tlp-row">'
        + '<button class="ghost" id="tfxVReset" title="No effects">Reset</button></div>';
    } else h += '<div class="tlp-row"><button class="ghost" id="tfxVReset" title="No effects">Reset</button></div>';
    return h + "</details>";
  }
  /* 2.415.0 - DISTORT: lens (barrel / pincushion), mirror, warp (wave / twirl) - static/clipfx.js distortAt is the maths,
     the canvas (static/vfxgl.js) and the compile (scripts/vfx_filters.py) draw the same. Tim: "lets do the medium jobs now" */
  function distortHtml(v) {
    var w = v.warp || {}, wt = w.type || "";
    return '<div class="tlp-row" title="Lens: barrel / fisheye (right) or pincushion (left)"><span style="width:74px">lens</span><input type="range" id="tfxLens" min="-100" max="100" step="1" value="' + (v.lens || 0) + '">'
      + '<span class="fxv" id="tfxLensV">' + (v.lens || 0) + "</span></div>"
      + '<div class="tlp-row"><span style="width:74px">mirror</span><select id="tfxMirror" title="The left half mirrored to the right, the top half down, or the top-left quarter four ways">'
      + [["", "off"], ["h", "left → right"], ["v", "top → bottom"], ["quad", "four ways"]].map(function (o) { return '<option value="' + o[0] + '"' + ((v.mirror || "") === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>"
      + '<div class="tlp-row"><span style="width:74px">warp</span><select id="tfxWarp" title="A sideways wave or a twirl at the middle">'
      + [["", "off"], ["wave", "wave"], ["twirl", "twirl"]].map(function (o) { return '<option value="' + o[0] + '"' + (wt === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>"
      + '<label title="How strong">amount <input type="range" id="tfxWarpA" min="0" max="100" step="1" value="' + (w.amount != null ? w.amount : 30) + '" style="width:60px"' + (wt ? "" : " disabled") + "></label>"
      + '<label title="Wave: its length (% of the height). Twirl: its radius (% of the half-height)">size <input type="range" id="tfxWarpS" min="5" max="100" step="1" value="' + (w.size != null ? w.size : (wt === "twirl" ? 60 : 20)) + '" style="width:50px"' + (wt ? "" : " disabled") + "></label>"
      + '<label title="Wave: how fast it travels (cycles a second)">speed <input type="range" id="tfxWarpV" min="0" max="5" step="0.1" value="' + (w.speed || 0) + '" style="width:44px"' + (wt === "wave" ? "" : " disabled") + "></label></div>";
  }
  function wireDistort(vx, live, commit) {
    if (!$("tfxLens")) return;
    var put = function () {
      var v = vx(), ln = +$("tfxLens").value || 0;
      if (ln) v.lens = ln; else delete v.lens;
      if ($("tfxMirror").value) v.mirror = $("tfxMirror").value; else delete v.mirror;
      var wt = $("tfxWarp").value;
      if (wt) v.warp = { type: wt, amount: +$("tfxWarpA").value, size: +$("tfxWarpS").value, speed: +$("tfxWarpV").value }; else delete v.warp;
      $("tfxWarpA").disabled = $("tfxWarpS").disabled = !wt; $("tfxWarpV").disabled = wt !== "wave";
      $("tfxLensV").textContent = ln;
    };
    ["tfxLens", "tfxWarpA", "tfxWarpS", "tfxWarpV"].forEach(function (id) {
      $(id).addEventListener("input", function () { put(); live(); });
      $(id).addEventListener("change", function () { put(); commit(false); });
    });
    $("tfxLens").addEventListener("dblclick", function () { $("tfxLens").value = 0; put(); commit(false); });
    ["tfxMirror", "tfxWarp"].forEach(function (id) { $(id).addEventListener("change", function () { put(); commit(false); }); });
  }
  function wireEffects(c, sel, d, commit) {
    var vx = function () { d.vfx = d.vfx || {}; return d.vfx; };
    var live = function () { setFx(c, d); TlCanvas.mark(); };
    wireDistort(vx, live, commit);                        // 2.415.0
    // 2.412.0: effect keyframes - the key at the position marker (made when `make` and there are keys already)
    var half = function () { return 0.5 / ((tl.tc && +tl.tc.fps) || 25); };
    var keyAt = function (make) {
      var v = vx(); if (!v.kf || !v.kf.length) return null;
      var t = localT(c), k = v.kf.find(function (q) { return Math.abs(q.at - t) <= half(); });
      if (!k && make) {
        var cur = F().vfxAt(v, t);
        k = { at: Math.round(t * 1000) / 1000 };
        F().KF_KEYS.forEach(function (q) { if (v.kf.some(function (x) { return x[q] != null; })) k[q] = cur[q] || 0; });
        if (v.kf.some(function (x) { return x.crop; })) k.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, cur.crop || {});
        v.kf.push(k); v.kf.sort(function (a, b) { return a.at - b.at; });
      }
      return k;
    };
    if ($("tfxKfAdd")) $("tfxKfAdd").onclick = function () {
      var v = vx(), t = localT(c), cur = v.kf && v.kf.length ? F().vfxAt(v, t) : v;
      v.kf = (v.kf || []).filter(function (q) { return Math.abs(q.at - t) > half(); });
      var k = { at: Math.round(t * 1000) / 1000 };
      F().KF_KEYS.forEach(function (q) { k[q] = cur[q] || 0; });
      if (cur.crop || v.kf.some(function (x) { return x.crop; })) k.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, cur.crop || {});
      v.kf.push(k); v.kf.sort(function (a, b) { return a.at - b.at; });
      commit(false); TlCanvas.paintProps();
    };
    Array.prototype.forEach.call(document.querySelectorAll("#tlProps [data-kf]"), function (b) {
      b.onclick = function () { var q = (vx().kf || [])[+b.dataset.kf]; if (!q) return; TlCanvas.go((+c.start || 0) + q.at); TlCanvas.paintProps(); };
    });
    Array.prototype.forEach.call(document.querySelectorAll("#tlProps [data-kfdel]"), function (b) {
      b.onclick = function () { var v = vx(); (v.kf || []).splice(+b.dataset.kfdel, 1); if (!v.kf.length) delete v.kf; commit(false); TlCanvas.paintProps(); };
    });
    if ($("tfxKfClear")) $("tfxKfClear").onclick = function () {
      var v = vx(), cur = F().vfxAt(v, localT(c)); delete v.kf;
      F().KF_KEYS.forEach(function (q) { if (cur[q]) v[q] = cur[q]; else delete v[q]; });
      if (cur.crop) v.crop = cur.crop;
      commit(false); TlCanvas.paintProps();
    };
    Array.prototype.forEach.call(document.querySelectorAll("#tlProps input[data-vfx]"), function (r) {
      r.addEventListener("input", function () {
        var kk = keyAt(true);
        if (kk) kk[r.dataset.vfx] = +r.value; else vx()[r.dataset.vfx] = +r.value;
        var v = document.querySelector('#tlProps [data-vfxv="' + r.dataset.vfx + '"]'); if (v) v.textContent = r.value;
        live();
      });
      r.addEventListener("change", function () { commit(false); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("#tlProps input[data-crop]"), function (el) {
      el.addEventListener("keydown", function (e) { e.stopPropagation(); });
      el.addEventListener("change", function () {
        var kk = keyAt(true), val = Math.max(0, Math.min(45, +el.value || 0));
        if (kk) { kk.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, kk.crop || {}); kk.crop[el.dataset.crop] = val; }
        else { var cr = vx().crop = Object.assign({}, vx().crop || {}); cr[el.dataset.crop] = val; }
        commit(false);
      });
    });
    var key = function () {
      if (!$("tfxKey")) return;
      if ($("tfxKey").checked) vx().key = { color: $("tfxKeyC").value, similarity: +$("tfxKeyS").value, blend: +$("tfxKeyB").value, spill: +$("tfxKeyP").value };
      else delete vx().key;
    };
    ["tfxKey", "tfxKeyC", "tfxKeyS", "tfxKeyB", "tfxKeyP"].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener("input", function () { key(); live(); });
      el.addEventListener("change", function () { key(); commit(false); });
    });
    var stab = function () {                              // 2.413.0: smoothing + locked; the canvas's steady preview
      if ($("tfxStab").checked) vx().stabilise = { smooth: +$("tfxStabS").value, lock: $("tfxStabL").checked }; else delete vx().stabilise;
      $("tfxStabS").disabled = $("tfxStabL").disabled = !$("tfxStab").checked;
      commit(false);
      var st = $("tfxStabState"); if (st && window.TlStab) { st._clip = c; TlStab.url(c); TlStab.paint(); }
    };
    if ($("tfxStab")) {
      $("tfxStab").addEventListener("change", stab); $("tfxStabS").addEventListener("change", stab); $("tfxStabL").addEventListener("change", stab);
      var st0 = $("tfxStabState"); if (st0 && window.TlStab) { st0._clip = c; TlStab.paint(); }
    }
    $("tfxVReset").addEventListener("click", function () { delete d.vfx; commit(false); TlCanvas.paintProps(); });
  }

  /* ---------------------------------------------------------------- ◐ a new adjustment layer (2.409.0) */
  function addAdjustment() {
    fetch("/api/effects/adjustment", { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || "could not make the adjustment layer");
      var t = (typeof playhead === "number" && isFinite(playhead)) ? playhead : 0;
      var n = (tl.images || []).filter(function (L) { return (L.clips || []).some(function (x) { return x.adjust; }); }).length + 1;
      var c = { name: j.name, start: Math.round(t * 100) / 100, len: 5, opacity: 1, adjust: true, fx: {} };
      tl.images = tl.images || [];
      tl.images.push(mkLayer("Adjust " + n, [c]));               // the top layer: it works on everything under it
      if (typeof tlSave === "function") tlSave();
      if (typeof renderTimeline === "function") renderTimeline();
      TlCanvas.select(c, TlCanvas.layerOf(c));
      open.colour = true;
      TlCanvas.paintProps();
    }).catch(function (e) { alert(e.message || e); });
  }

  function wireVideo(c, sel, d, commit, srcLen) {
    var X = F();
    var lenTxt = function () { var t = $("tfxLen"); if (t) t.textContent = srcLen.toFixed(2) + " s of source → " + (X.clipLen(Object.assign({}, c, { out: c.out != null ? c.out : c.dur })) || srcLen).toFixed(2) + " s on the timeline"; };
    if (!$("tfxSp")) return wireColour(c, sel, d, commit);       // 2.409.0: an adjustment layer has no speed
    $("tfxSp").addEventListener("change", function () { d.speed = Math.max(0.1, Math.min(10, (+$("tfxSp").value || 100) / 100)); commit(true); lenTxt(); });
    $("tfxRev").addEventListener("change", function () { d.reverse = $("tfxRev").checked; commit(true); });
    $("tfxRamp").addEventListener("change", function () {
      var v = $("tfxRamp").value;
      if (!v) delete d.ramp; else if (lib.ramps[v]) d.ramp = lib.ramps[v].map(function (k) { return { p: k.p, s: k.s }; });
      $("tfxSp").disabled = !!d.ramp;
      commit(true); lenTxt();
    });
    $("tfxBlend").addEventListener("change", function () { d.blend = $("tfxBlend").value; commit(false); });
    if (window.TlRemap) TlRemap.wire(c, d, commit, lenTxt);           // 2.501.0
    wireColour(c, sel, d, commit);
  }
  function wireColour(c, sel, d, commit) {
    var X = F();
    var gr = function () { d.grade = d.grade || {}; return d.grade; };
    Array.prototype.forEach.call(document.querySelectorAll("#tlProps input[data-g]"), function (r) {
      r.addEventListener("input", function () {
        gr()[r.dataset.g] = +r.value; delete d.look;
        var v = document.querySelector('#tlProps [data-gv="' + r.dataset.g + '"]'); if (v) v.textContent = r.value;
        setFx(c, d); TlCanvas.mark();
      });
      r.addEventListener("change", function () { commit(false); });
    });
    $("tfxLook").addEventListener("change", function () {
      var n = $("tfxLook").value;
      d.grade = Object.assign({}, lib.looks[n] || {}); if (n) d.look = n; else delete d.look;
      commit(false); TlCanvas.paintProps();
    });
    $("tfxCMore").addEventListener("click", function () { if (window.TlColour) TlColour.open(); });
    $("tfxCReset").addEventListener("click", function () { delete d.grade; delete d.lut; delete d.lut_mix; delete d.look; commit(false); TlCanvas.paintProps(); });
    $("tfxLut").addEventListener("change", function () {
      var v = $("tfxLut").value;
      if (v) { d.lut = v; if (d.lut_mix == null) d.lut_mix = 1; } else { delete d.lut; delete d.lut_mix; }
      $("tfxLutMix").disabled = !v; commit(false);
    });
    $("tfxLutMix").addEventListener("input", function () { d.lut_mix = (+$("tfxLutMix").value) / 100; $("tfxLutMixV").textContent = $("tfxLutMix").value + "%"; setFx(c, d); TlCanvas.mark(); });
    $("tfxLutMix").addEventListener("change", function () { commit(false); });
    $("tfxLutAdd").addEventListener("click", function () { $("tfxLutFile").click(); });
    $("tfxLutFile").addEventListener("change", function () {
      var f = $("tfxLutFile").files && $("tfxLutFile").files[0]; if (!f) return;
      f.text().then(function (text) {
        return fetch("/api/luts?name=" + encodeURIComponent(f.name), { method: "POST", headers: { "Content-Type": "text/plain" }, body: text })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); });
      }).then(function (j) {
        lib.luts = j.luts || lib.luts;
        if (window.H3GradeGL) H3GradeGL.forget(j.name);
        d.lut = j.name; if (d.lut_mix == null) d.lut_mix = 1;
        commit(false); log("LUT " + j.name + " (" + j.size + "³) imported"); TlCanvas.paintProps();
      }).catch(function (e) { alert("That LUT could not be imported: " + (e.message || e)); });
    });
  }

  function wireSound(c, sel, d, commit) {
    var af = function () { d.afx = d.afx || {}; return d.afx; };
    $("tfxVoice").addEventListener("change", function () { af().voice = $("tfxVoice").checked; commit(false); });
    $("tfxDn").addEventListener("input", function () { $("tfxDnV").textContent = $("tfxDn").value + "%"; });
    $("tfxDn").addEventListener("change", function () { af().denoise = (+$("tfxDn").value) / 100; commit(false); });
    $("tfxGain").addEventListener("input", function () { $("tfxGainV").textContent = $("tfxGain").value + " dB"; });
    $("tfxGain").addEventListener("change", function () { af().gain = +$("tfxGain").value; commit(false); });
    ["low", "mid", "high"].forEach(function (k) {         // 2.412.0
      var el = $("tfxEq_" + k); if (!el) return;
      el.addEventListener("input", function () { $("tfxEq_" + k + "V").textContent = el.value + " dB"; });
      el.addEventListener("change", function () { var e = af().eq = af().eq || {}; e[k] = +el.value; commit(false); });
    });
    if ($("tfxEqHz")) {
      $("tfxEqHz").addEventListener("input", function () { $("tfxEqHzV").textContent = $("tfxEqHz").value + " Hz"; });
      $("tfxEqHz").addEventListener("change", function () { var e = af().eq = af().eq || {}; e.midHz = +$("tfxEqHz").value; commit(false); });
    }
    if ($("tfxComp")) {
      $("tfxComp").addEventListener("input", function () { $("tfxCompV").textContent = $("tfxComp").value + "%"; });
      $("tfxComp").addEventListener("change", function () { af().comp = (+$("tfxComp").value) / 100; commit(false); });
    }
    if ($("tfxRev")) {
      var rv = function () { af().reverb = { mix: (+$("tfxRev").value) / 100, room: $("tfxRoom").value }; commit(false); };
      $("tfxRev").addEventListener("input", function () { $("tfxRevV").textContent = $("tfxRev").value + "%"; });
      $("tfxRev").addEventListener("change", rv); $("tfxRoom").addEventListener("change", rv);
    }
    $("tfxRole").addEventListener("change", function () { sel.Ly.L.role = $("tfxRole").value; touch(c, sel, false); if (mixDlg && mixDlg.isOpen()) paintMix(); });
    $("tfxMix").addEventListener("click", openMix);
    ["tfxJ", "tfxL"].forEach(function (id) {             // 2.407.0: J / L cuts (lib/splitEdit.js)
      var el = $(id); if (!el) return;
      el.addEventListener("keydown", function (e) { e.stopPropagation(); });
      el.addEventListener("change", function () {
        var lead = Math.max(0, Math.min(10, +$("tfxJ").value || 0)), tail = Math.max(0, Math.min(10, +$("tfxL").value || 0));
        if (lead > 0 || tail > 0) c.split = { lead: lead, tail: tail }; else delete c.split;
        touch(c, sel, false);
      });
    });
    $("tfxHear").addEventListener("click", function () {
      var b = $("tfxHear"); b.disabled = true; b.textContent = "🎧 …";
      var t = TlCanvas.state.t, at0 = TlCanvas.at(c, sel.Ly.kind === "aud" ? "aud" : sel.Ly.kind, t) ? TlCanvas.srcAt(c, t) : (c.in || 0);
      fetch("/api/clipfx/afx-preview", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: c.name, at: at0, secs: 6, afx: (F().normalize(d) || {}).afx || {} }) })
        .then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "HTTP " + r.status); }); return r.blob(); })
        .then(function (bl) {
          var au = new Audio(URL.createObjectURL(bl));
          au.onended = function () { URL.revokeObjectURL(au.src); };
          return au.play();
        })
        .catch(function (e) { alert("🎧 " + (e.message || e)); })
        .then(function () { b.disabled = false; b.textContent = "🎧 before / after"; });
    });
  }

  /* ---------------------------------------------------------------- 🎚 the Mix dialog */
  var mixDlg = null;
  var TARGETS = [[-14, "-14 LUFS · YouTube, Spotify"], [-16, "-16 LUFS · podcasts, Apple"], [-23, "-23 LUFS · broadcast (EBU R128)"], [-24, "-24 LUFS · US broadcast (ATSC)"]];
  function layers() {
    var out = [{ L: typeof v1 === "function" ? v1() : tl.v1, name: "V1", dflt: "voice" }];
    (tl.vlayers || []).forEach(function (L, i) { if (!(L.clips || []).some(function (c) { return c.m3d; })) out.push({ L: L, name: L.name || "V" + (i + 2), dflt: "voice" }); });
    (tl.audio || []).forEach(function (L, i) { out.push({ L: L, name: L.name || "A" + (i + 1), dflt: "music" }); });
    return out;
  }
  function paintMix() {
    var m = tl.mix || {}, du = m.duck || {}, lo = m.loudness || {};
    var amt = du.amount != null ? du.amount : 12, tg = lo.target != null ? lo.target : -14;
    var B = mixDlg.body;
    B.innerHTML = '<fieldset><legend>Roles</legend><div class="fx-dim">Who speaks and what is music - the ducking listens to the voices.</div>'
      + layers().map(function (x, i) { return '<div class="fx-row"><span style="flex:1">' + esc(x.name) + "</span>" + roleSel("tfxMR" + i, x.L, x.dflt) + "</div>"; }).join("")
      + "</fieldset>"
      + '<fieldset><legend><label><input type="checkbox" id="tfxDuck"' + (du.on ? " checked" : "") + "> Ducking</label></legend>"
      + '<div class="fx-row"><span>The music dips</span><input type="range" id="tfxDuckAmt" min="3" max="30" step="1" value="' + amt + '"><span id="tfxDuckV">' + amt + " dB</span></div>"
      + '<div class="fx-dim">while anyone speaks, then comes back.</div></fieldset>'
      + '<fieldset><legend><label><input type="checkbox" id="tfxLoud"' + (lo.on ? " checked" : "") + "> Loudness</label></legend>"
      + '<div class="fx-row"><select id="tfxLoudT">' + TARGETS.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === +tg ? " selected" : "") + ">" + t[1] + "</option>"; }).join("") + "</select></div>"
      + '<div class="fx-dim">The whole mix is measured and evened out to this (true peak -1.5 dB).</div></fieldset>';
    var save = function () {
      tl.mix = { duck: { on: $("tfxDuck").checked, amount: +$("tfxDuckAmt").value }, loudness: { on: $("tfxLoud").checked, target: +$("tfxLoudT").value } };
      if (!tl.mix.duck.on && !tl.mix.loudness.on) delete tl.mix;
      if (typeof tlSave === "function") tlSave();
    };
    layers().forEach(function (x, i) { $("tfxMR" + i).addEventListener("change", function () { x.L.role = $("tfxMR" + i).value; if (typeof tlSave === "function") tlSave(); TlCanvas.paintProps(); }); });
    $("tfxDuckAmt").addEventListener("input", function () { $("tfxDuckV").textContent = $("tfxDuckAmt").value + " dB"; });
    ["tfxDuck", "tfxDuckAmt", "tfxLoud", "tfxLoudT"].forEach(function (id) { $(id).addEventListener("change", save); });
  }
  function openMix() {
    if (!mixDlg) {
      mixDlg = TlDlg.make({ id: "tlMixDlg", title: "Mix", width: 440 });
      mixDlg.foot.innerHTML = '<button type="button" id="tfxMixDone">Done</button>';
      $("tfxMixDone").onclick = function () { mixDlg.close(); };
    }
    paintMix(); mixDlg.open();
  }

  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    loadLib().then(function () {
      TlCanvas.onProps(props);
      TlDlg.button("tlMixBtn", "🎚", "Mix: roles, ducking, loudness", openMix);
      TlDlg.button("tlAdjBtn", "◐", "Add an adjustment layer (its colour + effects work on everything under it)", addAdjustment);
    });
  }
  window.TlClipFx = { openMix: openMix, reload: loadLib, props: props, addAdjustment: addAdjustment };
  boot();
})();

/* bitGen Studio — the timeline canvas's ⬚ SELECT, 🖌 MASK and ✨ FILL (2.380.0).
 *
 * Tim (verbatim): "add a selection box and masking tools - allow user to generate an image or video in that selection
 * that blends with the rest of the scene".
 *
 *   ⬚ Select (M)   drag a box (Shift adds, Alt takes away)
 *   🖌 Mask (B)    paint the area (Alt erases); the brush size and the feather are in the Fill panel
 *   ✨ Fill        the Layers panel's Fill section: the prompt, Image | Video (+ seconds), the inpaint style, Generate
 *     Image   the frame at the position marker (TlCanvas.paintComp) around the selection goes to the image editor's
 *             inpaint (POST /api/aiedit, mode generate); the result is cut out by the FEATHERED mask
 *             (POST /api/tlcanvas/layer -> images/layer_<id>.png) and lands on a new picture layer exactly over the area,
 *             for the ruler selection, else 3 s from the position marker
 *     Video   the same picture, then the video model animates it (POST /api/generate, fl2va, the prompt docker's video
 *             style) for the seconds asked; the clip gets the feathered mask as its alpha (POST /api/tlcanvas/maskvideo
 *             -> video/fillv_<id>.webm) and lands on a new video layer over the area
 * Explanations: ❔ help (static/help/timeline.html#fill) - none in the dock.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function boot() {
    if (!$("tlCanvas")) return;
    if (!window.TlCanvas || !window.TlCanvas.addTool) { setTimeout(boot, 60); return; }
    start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function start() {
    var C = window.TlCanvas, S = C.state;
    var F = { mask: null, maskVer: 0, tintVer: -1, tint: null, brush: 40, feather: 16, mode: "image", secs: 4, busy: false,
              drag: null, engines: null };
    function store(k, v) { try { if (typeof window.store === "object") window.store.set("tlfill." + k, v); } catch (e) { /* fine */ } }
    function stored(k, d) { try { return typeof window.store === "object" ? window.store.get("tlfill." + k, d) : d; } catch (e) { return d; } }
    F.brush = +stored("brush", 40) || 40; F.feather = +stored("feather", 16) || 0; F.mode = stored("mode", "image") === "video" ? "video" : "image";
    F.secs = +stored("secs", 4) || 4;

    function ensureMask() {
      if (!F.mask || F.mask.width !== S.W || F.mask.height !== S.H) {
        var old = F.mask;
        F.mask = document.createElement("canvas"); F.mask.width = S.W; F.mask.height = S.H;
        if (old) F.mask.getContext("2d").drawImage(old, 0, 0, S.W, S.H);
      }
      return F.mask;
    }
    function changed() { F.maskVer++; paint(); C.mark(); }
    function clearMask() { if (F.mask) F.mask.getContext("2d").clearRect(0, 0, F.mask.width, F.mask.height); changed(); }
    /* the mask's bounding box in picture pixels, or null */
    function bbox() {
      if (!F.mask) return null;
      if (F.bbVer === F.maskVer && F.bbW === F.mask.width) return F.bb;
      F.bbVer = F.maskVer; F.bbW = F.mask.width;
      F.bb = scan();
      return F.bb;
    }
    function scan() {
      var w = F.mask.width, h = F.mask.height, d = F.mask.getContext("2d").getImageData(0, 0, w, h).data;
      var x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }

    /* ---------------------------------------------------------- the tools */
    C.addTool({ id: "select", icon: "⬚", title: "Select", key: "m", cursor: "crosshair",
      down: function (p, ev) { ensureMask(); F.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: ev.shiftKey, sub: ev.altKey }; },
      move: function (p) { if (F.drag) { F.drag.x1 = p.x; F.drag.y1 = p.y; } },
      up: function (p) {
        var d = F.drag; F.drag = null; if (!d) return;
        var x = Math.max(0, Math.min(d.x0, p.x)), y = Math.max(0, Math.min(d.y0, p.y));
        var w = Math.min(S.W, Math.max(d.x0, p.x)) - x, h = Math.min(S.H, Math.max(d.y0, p.y)) - y;
        var g = ensureMask().getContext("2d");
        if (!d.add && !d.sub) g.clearRect(0, 0, S.W, S.H);
        if (w >= 2 && h >= 2) {
          g.globalCompositeOperation = d.sub ? "destination-out" : "source-over";
          g.fillStyle = "#fff"; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
          g.globalCompositeOperation = "source-over";
        }
        changed();
      } });
    function dab(p, erase) {
      var g = ensureMask().getContext("2d");
      g.globalCompositeOperation = erase ? "destination-out" : "source-over";
      g.fillStyle = "#fff"; g.beginPath(); g.arc(p.x, p.y, F.brush / 2, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = "source-over";
    }
    function stroke(a, b, erase) {
      var n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, F.brush / 4)));
      for (var i = 1; i <= n; i++) dab({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }, erase);
    }
    C.addTool({ id: "mask", icon: "🖌", title: "Mask", key: "b", cursor: "crosshair",
      down: function (p, ev) { F.drag = { last: p, erase: ev.altKey }; dab(p, ev.altKey); F.maskVer++; },
      move: function (p) { if (!F.drag) return; stroke(F.drag.last, p, F.drag.erase); F.drag.last = p; F.maskVer++; },
      up: function () { F.drag = null; changed(); } });

    /* ---------------------------------------------------------- what the canvas shows */
    C.onDraw(function (g, h) {
      var v = h.view;
      if (F.mask && F.maskVer) {
        if (F.tintVer !== F.maskVer) {
          F.tint = F.tint || document.createElement("canvas");
          F.tint.width = F.mask.width; F.tint.height = F.mask.height;
          var tg = F.tint.getContext("2d");
          tg.clearRect(0, 0, F.tint.width, F.tint.height);
          tg.drawImage(F.mask, 0, 0);
          tg.globalCompositeOperation = "source-in"; tg.fillStyle = "rgba(255,60,60,.35)"; tg.fillRect(0, 0, F.tint.width, F.tint.height);
          tg.globalCompositeOperation = "source-over";
          F.tintVer = F.maskVer;
        }
        g.drawImage(F.tint, v.ox, v.oy, F.tint.width * v.z, F.tint.height * v.z);
      }
      if (F.drag && F.drag.x0 != null) {
        var a = h.toScreen(Math.min(F.drag.x0, F.drag.x1), Math.min(F.drag.y0, F.drag.y1));
        var b = h.toScreen(Math.max(F.drag.x0, F.drag.x1), Math.max(F.drag.y0, F.drag.y1));
        g.save(); g.setLineDash([5, 4]); g.strokeStyle = "#fff"; g.lineWidth = 1; g.strokeRect(a.x + .5, a.y + .5, b.x - a.x, b.y - a.y); g.restore();
      }
    });

    /* ---------------------------------------------------------- the Fill panel (under the Properties) */
    var panel = document.createElement("div");
    panel.id = "tlFill";
    var host = $("tlLayersPanel");
    if (host) host.appendChild(panel);
    var css = document.createElement("style");
    css.textContent = "#tlFill{border-top:1px solid var(--line);padding:6px 8px;font-size:.72rem;flex:none;display:flex;flex-direction:column;gap:4px}"
      + "#tlFill .tlf-t{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}"
      + "#tlFill textarea{width:100%;min-height:38px;font-size:.72rem;resize:vertical;font-family:var(--body)}"
      + "#tlFill .tlf-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}"
      + "#tlFill .tlf-row input[type=number]{width:52px;font-size:.72rem}"
      + "#tlFill .tlf-row select{font-size:.72rem;max-width:100%}"
      + "#tlFill .tlf-msg{color:var(--dim);min-height:1em}"
      + "#tlFill button:disabled{opacity:.4}";
    document.head.appendChild(css);
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function paint() {
      var bb = bbox();
      var tool = S.tool === "select" || S.tool === "mask";
      panel.style.display = (bb || tool) ? "" : "none";
      if (panel._built) {
        $("tlfGo").disabled = !bb || F.busy;
        $("tlfSize").textContent = bb ? (bb.w + "×" + bb.h) : "";
        $("tlfSecsRow").style.display = F.mode === "video" ? "" : "none";
        return;
      }
      panel._built = true;
      panel.innerHTML = '<div class="tlf-t">✨ Fill <span id="tlfSize" style="text-transform:none;letter-spacing:0"></span></div>'
        + '<textarea id="tlfPrompt" placeholder="What goes in the selection" aria-label="Fill prompt"></textarea>'
        + '<div class="tlf-row"><select id="tlfMode" aria-label="Fill with"><option value="image">Image</option><option value="video">Video</option></select>'
        + '<span id="tlfSecsRow"><input type="number" id="tlfSecs" min="1" max="15" step="1" aria-label="Seconds" title="Seconds"> s</span>'
        + '<label title="Feather (px)">◌ <input type="number" id="tlfFeather" min="0" max="200" step="1" aria-label="Feather"></label>'
        + '<label title="Brush (px)">🖌 <input type="number" id="tlfBrush" min="2" max="600" step="2" aria-label="Brush size"></label></div>'
        + '<div class="tlf-row"><select id="tlfStyle" aria-label="Inpaint style" title="Inpaint style"></select></div>'
        + '<div class="tlf-row"><button class="ghost" id="tlfGo" type="button">✨ Generate</button>'
        + '<button class="ghost" id="tlfClear" type="button" title="Clear the selection" aria-label="Clear the selection">✕</button></div>'
        + '<div class="tlf-msg" id="tlfMsg" aria-live="polite"></div>';
      $("tlfMode").value = F.mode; $("tlfSecs").value = F.secs; $("tlfFeather").value = F.feather; $("tlfBrush").value = F.brush;
      $("tlfMode").addEventListener("change", function () { F.mode = $("tlfMode").value; store("mode", F.mode); paint(); });
      $("tlfSecs").addEventListener("change", function () { F.secs = Math.max(1, Math.min(15, +$("tlfSecs").value || 4)); store("secs", F.secs); });
      $("tlfFeather").addEventListener("change", function () { F.feather = Math.max(0, Math.min(200, +$("tlfFeather").value || 0)); store("feather", F.feather); });
      $("tlfBrush").addEventListener("change", function () { F.brush = Math.max(2, Math.min(600, +$("tlfBrush").value || 40)); store("brush", F.brush); });
      $("tlfClear").addEventListener("click", clearMask);
      $("tlfGo").addEventListener("click", generate);
      fetch("/api/aiedit/engines").then(function (r) { return r.json(); }).then(function (e) {
        F.engines = e || {};
        var list = (F.engines.inpaint || []);
        var want = stored("style", "") || (F.engines.defaults || {}).inpaint || "";
        $("tlfStyle").innerHTML = list.length ? list.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + "</option>"; }).join("")
          : '<option value="">-</option>';
        if (list.some(function (x) { return x.id === want; })) $("tlfStyle").value = want;
      }).catch(function () { /* the select stays empty */ });
      $("tlfStyle").addEventListener("change", function () { store("style", $("tlfStyle").value); });
      paint();
    }
    function say(t) { var m = $("tlfMsg"); if (m) m.textContent = t || ""; }
    // the panel follows the tool and the selection
    var origSet = C.setTool;
    C.setTool = function (t) { origSet(t); paint(); };
    ["tlTool_move", "tlTool_text", "tlTool_hand", "tlTool_zoom", "tlTool_select", "tlTool_mask"].forEach(function (id) {
      var b = $(id); if (b) b.addEventListener("click", function () { setTimeout(paint, 0); });
    });
    document.addEventListener("keyup", function () { setTimeout(paint, 0); });

    /* ---------------------------------------------------------- generate */
    function canvasOf(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
    function blobOf(c) { return new Promise(function (ok) { c.toBlob(ok, "image/png"); }); }
    function imgOf(url) { return new Promise(function (ok, no) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { no(new Error("could not load the result")); }; im.src = url; }); }
    function jobOut(id) { return fetch("/api/jobs/" + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (j) { return (j.outputs && j.outputs[0]) || j.output || ""; }); }
    // 2.574.0: base = the line's words - while the job runs it says base · step n of total
    function waitJob(id, base) { return typeof awaitJob === "function" ? awaitJob(id, base && window.H3Steps ? function (jj) { if (jj.status === "running") say(base + window.H3Steps.tag(jj.progress)); } : undefined) : Promise.reject(new Error("the page's job poll is missing - reload")); }
    function upload(id, canvas) {
      return blobOf(canvas).then(function (b) {
        return fetch("/api/tlcanvas/layer?id=" + encodeURIComponent(id), { method: "POST", headers: { "Content-Type": "image/png" }, body: b });
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j.name; }); });
    }
    /* the area around the selection the model sees (some context), clamped to the picture */
    function contextBox(bb) {
      var m = Math.max(48, Math.round(Math.max(bb.w, bb.h) * 0.25));
      var x = Math.max(0, bb.x - m), y = Math.max(0, bb.y - m);
      return { x: x, y: y, w: Math.min(S.W, bb.x + bb.w + m) - x, h: Math.min(S.H, bb.y + bb.h + m) - y };
    }
    function fitSize(w, h) {
      var k = Math.min(1, Math.sqrt(1048576 / (w * h)));
      var r16 = function (v) { return Math.max(64, Math.round(v * k / 16) * 16); };
      return { w: r16(w), h: r16(h) };
    }
    /* the feathered mask of a box (white = the selection), box-sized */
    function featherMask(box) {
      var c = canvasOf(box.w, box.h), g = c.getContext("2d");
      if (F.feather > 0) g.filter = "blur(" + (F.feather / 2) + "px)";
      g.drawImage(F.mask, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      g.filter = "none";
      return c;
    }
    function timing() {
      if (typeof tl === "object" && tl && tl.sel) return { start: tl.sel.a, len: Math.max(0.1, tl.sel.b - tl.sel.a) };
      return { start: Math.round(S.t * 24) / 24, len: F.mode === "video" ? F.secs : 3 };
    }
    async function inpaint(bb) {
      var box = contextBox(bb), fit = fitSize(box.w, box.h);
      var frame = canvasOf(S.W, S.H);
      C.paintComp(frame.getContext("2d"), S.t);
      var crop = canvasOf(fit.w, fit.h), cg = crop.getContext("2d");
      cg.imageSmoothingQuality = "high"; cg.drawImage(frame, box.x, box.y, box.w, box.h, 0, 0, fit.w, fit.h);
      // the model's mask: transparent = the selection (the image editor's format)
      var m = canvasOf(fit.w, fit.h), mg = m.getContext("2d");
      mg.fillStyle = "#000"; mg.fillRect(0, 0, fit.w, fit.h);
      mg.globalCompositeOperation = "destination-out"; mg.drawImage(F.mask, box.x, box.y, box.w, box.h, 0, 0, fit.w, fit.h);
      var hole = canvasOf(fit.w, fit.h), hg = hole.getContext("2d");
      hg.drawImage(crop, 0, 0); hg.globalCompositeOperation = "destination-in"; hg.drawImage(m, 0, 0);
      var fd = new FormData();
      fd.append("crop", await blobOf(crop), "crop.png");
      fd.append("mask", await blobOf(m), "mask.png");
      fd.append("rgba", await blobOf(hole), "hole.png");
      var vals = { mode: "generate", prompt: $("tlfPrompt").value.trim(), style_id: $("tlfStyle").value, strength: 100, count: 1, width: fit.w, height: fit.h };
      Object.keys(vals).forEach(function (k) { fd.append(k, String(vals[k])); });
      if (window.H3Neg && H3Neg.get()) fd.append("negative", H3Neg.get());   // 2.419.0: ⊖ the negative docker
      var r = await fetch("/api/aiedit", { method: "POST", body: fd });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || "the inpaint was refused");
      if (typeof refreshJobs === "function") refreshJobs();
      var id = (j.jobs && j.jobs[0] && j.jobs[0].id) || "";
      if (!id) throw new Error("no inpaint job");
      say("✨ image…");
      var st = await waitJob(id, "✨ image");
      if (st !== "done") throw new Error("the inpaint " + st + " - see the job log");
      var out = await jobOut(id);
      var im = await imgOf("/outputs/" + encodeURIComponent(out) + "?v=" + Date.now());
      var full = canvasOf(box.w, box.h);
      full.getContext("2d").drawImage(im, 0, 0, box.w, box.h);
      return { box: box, picture: full };
    }
    async function generate() {
      var bb = bbox();
      if (!bb) { say("select an area first"); return; }
      if (!$("tlfPrompt").value.trim()) { say("write what goes in the selection"); $("tlfPrompt").focus(); return; }
      if (!$("tlfStyle").value) { say("no inpaint style (Settings → Image)"); return; }
      F.busy = true; paint(); say("✨ …");
      var when = timing(), id = "f" + Date.now().toString(36);
      try {
        var res = await inpaint(bb);
        var box = res.box, soft = featherMask(box);
        var tf = { x: Math.round(box.x + box.w / 2 - S.W / 2), y: Math.round(box.y + box.h / 2 - S.H / 2), scale: 1, rot: 0 };
        if (F.mode === "image") {
          var layer = canvasOf(box.w, box.h), lg = layer.getContext("2d");
          lg.drawImage(res.picture, 0, 0); lg.globalCompositeOperation = "destination-in"; lg.drawImage(soft, 0, 0);
          var name = await upload(id, layer);
          C.newLayer("image", { name: name, start: when.start, len: when.len, opacity: 1, tf: tf });
          if (typeof logLine === "function") logLine("[canvas] ✨ fill: " + name + " (" + box.w + "×" + box.h + ") at " + when.start.toFixed(2) + "s");
          say(""); clearMask();
        } else {
          // the filled box is the video's first frame; the model animates it, the mask keeps it inside the area
          var maskName = await upload(id + "m", soft);
          var first = await blobOf(res.picture);
          var short = 480, w = box.w >= box.h ? Math.round(short * box.w / box.h) : short, h = box.w >= box.h ? short : Math.round(short * box.h / box.w);
          var fd = new FormData();
          fd.append("references", first, "fill_first.png");
          var vals = { mode: "fl2va", prompt: $("tlfPrompt").value.trim(), width: Math.min(2048, Math.round(w / 16) * 16),
                       height: Math.min(2048, Math.round(h / 16) * 16), frames: Math.round(F.secs * 24) + 1, seed: -1, format: "mp4" };
          Object.keys(vals).forEach(function (k) { fd.append(k, String(vals[k])); });
          if ($("videoStyleSel") && $("videoStyleSel").value) fd.append("video_style_id", $("videoStyleSel").value);
          if (window.H3Neg && H3Neg.get()) fd.append("negative", H3Neg.get());   // 2.419.0
          var r = await fetch("/api/generate", { method: "POST", body: fd });
          var j = await r.json();
          if (!r.ok) throw new Error(j.error || "the video was refused");
          if (typeof refreshJobs === "function") refreshJobs();
          say("✨ video…");
          var st = await waitJob(j.id, "✨ video");
          if (st !== "done") throw new Error("the video " + st + " - see the job log");
          var out = await jobOut(j.id);
          var mr = await fetch("/api/tlcanvas/maskvideo", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id, output: out, mask: maskName, width: box.w, height: box.h }) });
          var mj = await mr.json();
          if (!mr.ok) throw new Error(mj.error || "the mask could not be applied");
          var dur = +mj.dur || F.secs;
          C.newLayer("video", { name: mj.name, src: "video", start: when.start, dur: dur, in: 0, out: dur, opacity: 1, tf: tf });
          if (typeof refreshAssets === "function") refreshAssets();
          if (typeof logLine === "function") logLine("[canvas] ✨ video fill: " + mj.name + " (" + box.w + "×" + box.h + ", " + dur.toFixed(2) + "s) at " + when.start.toFixed(2) + "s");
          say(""); clearMask();
        }
      } catch (e) {
        say(String(e && e.message || e));
      } finally { F.busy = false; paint(); }
    }
    paint();
    window.TlFill = { state: F, bbox: bbox, clear: clearMask, generate: generate, paint: paint, contextBox: contextBox, fitSize: fitSize };
  }
})();

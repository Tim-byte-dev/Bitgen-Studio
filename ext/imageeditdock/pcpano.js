/* pcpano.js — 🌐 360 PANORAMA (2.971.0), the image editor's Image ▸ 360 Panorama…, window.PCPano (E.pano once installed).
 *
 * Tim: "can we add this to image-editor to create 360 panaromic images for mmh3. https://github.com/nomadoor/ComfyUI-Panorama-Stickers?"
 *
 * Done the way that node pack does it, without needing the pack: your pictures are placed on a 2:1 EQUIRECTANGULAR canvas
 * (the whole sphere unrolled - left / right edges meet behind you), everything else PURE GREEN, and Qwen Image 2.1 with
 * nomadoor's 360 panorama outpaint LoRA fills the green into one seamless 360° picture (lib/pano360.js, /api/pano360).
 *
 *   PICTURES   ＋ the picture (flattened), ＋ the active layer, ＋ a file - each sits on the sphere where you put it: drag it on
 *              the canvas (or Turn / Tilt), the mouse wheel or Size = how much of your view it covers (its field of view).
 *              Several pictures = several views of the same place.
 *   DESCRIBE   what fills the green - where it is, what is round it, where the light comes from (after the LoRA's trigger)
 *   ▶ MAKE     one image job (2048 × 1024 or 1408 × 704); the panorama opens as a new picture in the editor
 *   ↔ SEAM     the LoRA is v0.1 and the left / right join can break: the panorama turned half way round (the join in the
 *              middle), a green strip over it, filled by the same model, turned back - a new picture again
 *   🌐 LOOK    look round inside the panorama (drag, wheel to zoom) - or inside the green canvas before making it
 *   🥽 VR      the panorama as 🥽 VR World's world (a MiniMax H3 performer inside it - the StoryBoard's 🥽 VR World)
 * Pure (Node: scripts/test-971.js): GREEN, tables, blank, paste, build, roll, seamPrep, unroll, view, hit, lonLat, fovFor.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const GREEN = [0, 255, 0];
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /** an RGBA picture {w, h, data} */
  function img(w, h, data) { return { w: w, h: h, data: data || new Uint8ClampedArray(w * h * 4) }; }
  /** per column / row sines and cosines of the longitude / latitude each pixel looks at */
  function tables(W, H) {
    const sl = new Float64Array(W), cl = new Float64Array(W), sp = new Float64Array(H), cp = new Float64Array(H);
    for (let x = 0; x < W; x++) { const lon = ((x + 0.5) / W) * 2 * Math.PI - Math.PI; sl[x] = Math.sin(lon); cl[x] = Math.cos(lon); }
    for (let y = 0; y < H; y++) { const lat = Math.PI / 2 - ((y + 0.5) / H) * Math.PI; sp[y] = Math.sin(lat); cp[y] = Math.cos(lat); }
    return { W: W, H: H, sl: sl, cl: cl, sp: sp, cp: cp };
  }
  /** the canvas: all pure green */
  function blank(W, H) {
    const o = img(W, H);
    for (let i = 0; i < W * H; i++) { o.data[i * 4] = GREEN[0]; o.data[i * 4 + 1] = GREEN[1]; o.data[i * 4 + 2] = GREEN[2]; o.data[i * 4 + 3] = 255; }
    return o;
  }
  /** a picture's frame on the sphere: yaw (turn, degrees, + = right), pitch (tilt, + = up), fov (its width in degrees) */
  function frame(st, src) {
    const yaw = (+st.yaw || 0) * D2R, pit = clamp(+st.pitch || 0, -89, 89) * D2R, half = Math.tan(clamp(+st.fov || 90, 1, 175) * D2R / 2);
    return { cy: Math.cos(yaw), sy: Math.sin(yaw), cpi: Math.cos(pit), spi: Math.sin(pit), half: half, hh: half / ((src.w / src.h) || 1) };
  }
  /** where a direction lands in a picture's frame -> [u, v] in -1..1 (inside) or null (behind / outside) */
  function inFrame(F, dx, dy, dz) {
    const x1 = dx * F.cy - dz * F.sy, z1 = dx * F.sy + dz * F.cy;          // the turn undone
    const y2 = dy * F.cpi - z1 * F.spi, z2 = dy * F.spi + z1 * F.cpi;      // the tilt undone
    if (z2 <= 1e-6) return null;
    const u = x1 / z2 / F.half, v = y2 / z2 / F.hh;
    return u < -1 || u > 1 || v < -1 || v > 1 ? null : [u, v];
  }
  /** a picture painted onto the canvas where it sits (bilinear; its own transparency kept - green shows through) */
  function paste(dst, T, src, st) {
    const F = frame(st, src), W = dst.w, H = dst.h, sw = src.w, sh = src.h, s = src.data, d = dst.data;
    for (let y = 0; y < H; y++) {
      const sp = T.sp[y], cp = T.cp[y];
      for (let x = 0; x < W; x++) {
        const uv = inFrame(F, cp * T.sl[x], sp, cp * T.cl[x]);
        if (!uv) continue;
        const px = (uv[0] + 1) / 2 * sw - 0.5, py = (1 - uv[1]) / 2 * sh - 0.5;
        const x0 = clamp(Math.floor(px), 0, sw - 1), y0 = clamp(Math.floor(py), 0, sh - 1), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
        const fx = clamp(px - x0, 0, 1), fy = clamp(py - y0, 0, 1);
        const a = (y0 * sw + x0) * 4, b = (y0 * sw + x1) * 4, c = (y1 * sw + x0) * 4, e = (y1 * sw + x1) * 4, o = (y * W + x) * 4;
        const al = ((s[a + 3] * (1 - fx) + s[b + 3] * fx) * (1 - fy) + (s[c + 3] * (1 - fx) + s[e + 3] * fx) * fy) / 255;
        if (al <= 0) continue;
        for (let k = 0; k < 3; k++) {
          const v = (s[a + k] * (1 - fx) + s[b + k] * fx) * (1 - fy) + (s[c + k] * (1 - fx) + s[e + k] * fx) * fy;
          d[o + k] = Math.round(d[o + k] * (1 - al) + v * al);
        }
        d[o + 3] = 255;
      }
    }
    return dst;
  }
  /** the whole canvas: green, then each picture in order (the last on top) */
  function build(W, H, list) {
    const T = tables(W, H), o = blank(W, H);
    (list || []).forEach((p) => { if (p && p.src && p.src.w && p.src.h) paste(o, T, p.src, p); });
    return o;
  }
  /** turned round by dx pixels (the picture wraps: x -> x + dx) */
  function roll(p, dx) {
    const W = p.w, H = p.h, o = img(W, H), n = ((Math.round(dx) % W) + W) % W;
    for (let y = 0; y < H; y++) {
      const r = y * W * 4;
      o.data.set(p.data.subarray(r, r + (W - n) * 4), r + n * 4);
      o.data.set(p.data.subarray(r + (W - n) * 4, r + W * 4), r);
    }
    return o;
  }
  /** the seam pass's canvas: turned half way round (the left / right join now in the middle), a green strip over it */
  function seamPrep(p, frac) {
    const o = roll(p, p.w / 2), sw = Math.max(8, Math.round(p.w * (frac || 1 / 12))), x0 = Math.round(p.w / 2 - sw / 2);
    for (let y = 0; y < o.h; y++) for (let x = x0; x < x0 + sw; x++) { const i = (y * o.w + x) * 4; o.data[i] = GREEN[0]; o.data[i + 1] = GREEN[1]; o.data[i + 2] = GREEN[2]; o.data[i + 3] = 255; }
    return { img: o, x0: x0, width: sw };
  }
  /** the seam pass's answer turned back the other way */
  function unroll(p) { return roll(p, -p.w / 2); }
  /** what you see looking out from the middle of an equirectangular picture: yaw / pitch / fov (degrees) -> dst {w, h} */
  function view(dst, src, yaw, pitch, fov) {
    const W = src.w, H = src.h, s = src.data, d = dst.data, w = dst.w, h = dst.h;
    const half = Math.tan(clamp(fov || 90, 10, 150) * D2R / 2), hh = half * h / w;
    const cyw = Math.cos((yaw || 0) * D2R), syw = Math.sin((yaw || 0) * D2R), cpi = Math.cos(clamp(pitch || 0, -89, 89) * D2R), spi = Math.sin(clamp(pitch || 0, -89, 89) * D2R);
    for (let y = 0; y < h; y++) {
      const ny = (1 - 2 * (y + 0.5) / h) * hh;
      for (let x = 0; x < w; x++) {
        const nx = (2 * (x + 0.5) / w - 1) * half;
        const y1 = ny * cpi + spi, z1 = -ny * spi + cpi;                    // the tilt
        const x2 = nx * cyw + z1 * syw, z2 = -nx * syw + z1 * cyw;          // the turn
        const lon = Math.atan2(x2, z2), lat = Math.atan2(y1, Math.hypot(x2, z2));
        let X = Math.floor((lon + Math.PI) / (2 * Math.PI) * W); X = ((X % W) + W) % W;
        const Y = clamp(Math.floor((Math.PI / 2 - lat) / Math.PI * H), 0, H - 1), i = (Y * W + X) * 4, o = (y * w + x) * 4;
        d[o] = s[i]; d[o + 1] = s[i + 1]; d[o + 2] = s[i + 2]; d[o + 3] = 255;
      }
    }
    return dst;
  }
  /** the canvas point (0..1 across, 0..1 down) -> {yaw, pitch} in degrees */
  function lonLat(fx, fy) { return { yaw: clamp(fx, 0, 1) * 360 - 180, pitch: 90 - clamp(fy, 0, 1) * 180 }; }
  /** the topmost picture under a canvas point (0..1, 0..1) -> its index or -1 */
  function hit(list, fx, fy) {
    const ll = lonLat(fx, fy), lon = ll.yaw * D2R, lat = ll.pitch * D2R;
    const dx = Math.cos(lat) * Math.sin(lon), dy = Math.sin(lat), dz = Math.cos(lat) * Math.cos(lon);
    for (let i = (list || []).length - 1; i >= 0; i--) { const p = list[i]; if (p && p.src && inFrame(frame(p, p.src), dx, dy, dz)) return i; }
    return -1;
  }
  /** a new picture's first size: a landscape about a quarter of the way round, a portrait narrower */
  function fovFor(w, h) { const a = w / (h || 1); return a >= 1 ? 90 : Math.round(clamp(90 * a, 35, 90)); }

  const pure = { GREEN, img, tables, blank, frame, inFrame, paste, build, roll, seamPrep, unroll, view, lonLat, hit, fovFor };

  /* ================================ the dialog ================================ */
  function install(E) {
    const S = E.S, doc = E.doc || document, win = E.win || window, say = E.say || function () {};
    const $ = (id) => doc.getElementById(id);
    const st = { pics: [], sel: -1, result: null, resultName: "", mode: "place", look: { yaw: 0, pitch: 0, fov: 90 }, busy: false, info: null };
    let dlg = null, raf = 0;
    const CSS = ""
      + "dialog.ppdlg{width:min(1500px,96vw);max-width:96vw;padding:0;background:#0d1015;color:#d9dee8;border:1px solid #2d3340;border-radius:12px;box-shadow:0 20px 60px #000c}"
      + ".ppdlg::backdrop{background:#0008}"
      + ".ppdlg .pp-title{display:flex;align-items:center;gap:8px;height:38px;padding:0 0 0 14px;background:#11141a;border-bottom:1px solid #232935;user-select:none}"
      + ".ppdlg .pp-title h2{margin:0;flex:1;font:700 11px/1 system-ui,sans-serif;letter-spacing:.2em;color:#38e1ff;text-shadow:0 0 6px #38e1ff}"
      + ".ppdlg .pp-x{width:46px;height:38px;border:0;border-radius:0 12px 0 0;background:none;color:#d9dee8;font-size:15px;cursor:pointer}.ppdlg .pp-x:hover{background:#c42b1c}"
      + ".ppdlg .pp-body{display:flex;gap:12px;padding:12px}"
      + ".ppdlg .pp-left{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:6px}"
      + ".ppdlg .pp-modes{display:flex;gap:4px;align-items:center}"
      + ".ppdlg .pp-modes button,.ppdlg .pp-btn{background:#11141a;border:1px solid #2a2f3a;color:#c9d2e3;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer}"
      + ".ppdlg .pp-modes button.on{color:#38e1ff;border-color:#38e1ff88;background:#0b1a20;text-shadow:0 0 6px #38e1ff99}"
      + ".ppdlg .pp-btn:hover:not([disabled]),.ppdlg .pp-modes button:hover{border-color:#38e1ff88;color:#fff}.ppdlg .pp-btn[disabled]{opacity:.4;cursor:default}"
      + ".ppdlg #pnView{width:100%;aspect-ratio:2/1;background:#000;border:1px solid #1d2430;border-radius:8px;cursor:grab;touch-action:none;display:block}"
      + ".ppdlg #pnView.look{aspect-ratio:16/9}"
      + ".ppdlg .pp-hint{font-size:11px;color:#8b95a7}"
      + ".ppdlg .pp-right{flex:0 0 330px;display:flex;flex-direction:column;gap:8px}"
      + ".ppdlg .pp-sec{background:#11141a;border:1px solid #232935;border-radius:9px;padding:8px;display:flex;flex-direction:column;gap:6px}"
      + ".ppdlg .pp-sec h3{margin:0;font:700 10px/1 system-ui,sans-serif;letter-spacing:.18em;color:#38e1ff;text-shadow:0 0 6px #38e1ff}"
      + ".ppdlg .pp-pics{display:flex;flex-direction:column;gap:4px;max-height:150px;overflow:auto}"
      + ".ppdlg .pp-pic{display:flex;align-items:center;gap:6px;padding:3px;border:1px solid #232935;border-radius:6px;cursor:pointer;font-size:12px}"
      + ".ppdlg .pp-pic.sel{border-color:#38e1ff;background:#0b1a20}.ppdlg .pp-pic img{width:48px;height:30px;object-fit:cover;border-radius:3px;background:#000}"
      + ".ppdlg .pp-pic span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ppdlg .pp-pic button{background:none;border:0;color:#6c7688;cursor:pointer}"
      + ".ppdlg .pp-row{display:grid;grid-template-columns:52px 1fr 52px;gap:6px;align-items:center;font-size:12px}.ppdlg .pp-row input[type=range]{accent-color:#38e1ff;width:100%}"
      + ".ppdlg .pp-row output{font:600 11px ui-monospace,Consolas,monospace;color:#6ff0ff;text-align:right}"
      + ".ppdlg .pp-adds{display:flex;flex-wrap:wrap;gap:4px}"
      + ".ppdlg textarea{width:100%;box-sizing:border-box;min-height:70px;resize:vertical;background:#07090c;color:#e6ebf5;border:1px solid #2a2f3a;border-radius:6px;padding:6px;font:12px/1.4 system-ui,sans-serif}"
      + ".ppdlg select,.ppdlg input[type=number]{background:#07090c;color:#e6ebf5;border:1px solid #2a2f3a;border-radius:5px;padding:3px 4px;font-size:12px}"
      + ".ppdlg .pp-go{background:linear-gradient(180deg,#1f6f3a,#14502a);border:1px solid #2ee66b;color:#eafff0;font:700 13px system-ui,sans-serif;border-radius:8px;padding:8px;cursor:pointer;box-shadow:0 0 12px #2ee66b44}"
      + ".ppdlg .pp-go[disabled]{opacity:.45;cursor:default}"
      + ".ppdlg .pp-msg{font-size:11.5px;color:#c8f6ff;min-height:16px}.ppdlg .pp-msg.bad{color:#ff9b8b}"
      + ".ppdlg .pp-after{display:flex;flex-wrap:wrap;gap:4px}"
      + ".ppdlg .pp-lic{font-size:10.5px;color:#6c7688;line-height:1.4}";

    function api() { return win.fetch("/api/pano360").then((r) => r.json()).catch(() => null); }
    /** a canvas / image -> {w, h, data}, no side over `max` px */
    function grab(source, max) {
      const w0 = source.naturalWidth || source.width, h0 = source.naturalHeight || source.height, k = Math.min(1, (max || 2048) / Math.max(w0, h0));
      const c = E.newCanvas(Math.max(1, Math.round(w0 * k)), Math.max(1, Math.round(h0 * k))), g = c.getContext("2d");
      g.imageSmoothingQuality = "high"; g.drawImage(source, 0, 0, c.width, c.height);
      return { src: img(c.width, c.height, g.getImageData(0, 0, c.width, c.height).data), thumb: c.toDataURL("image/jpeg", 0.7) };
    }
    function addPic(source, name) {
      const g = grab(source, 2048), n = st.pics.length;
      // a second picture goes to the right of the first, a third behind - several views round the same place
      st.pics.push({ src: g.src, thumb: g.thumb, name: name || "picture " + (n + 1), yaw: [0, 90, -90, 180][n % 4], pitch: 0, fov: fovFor(g.src.w, g.src.h) });
      st.sel = st.pics.length - 1; paintList(); paint();
    }
    function toImage(canvas) { const c = E.newCanvas(canvas.w, canvas.h); c.getContext("2d").putImageData(new win.ImageData(canvas.data, canvas.w, canvas.h), 0, 0); return c; }

    /* ---- the view: the canvas (placing) or a look round ---- */
    function paint() { if (raf) return; raf = win.requestAnimationFrame(() => { raf = 0; draw(); }); }
    function draw() {
      const cv = $("pnView"); if (!cv) return;
      const look = st.mode === "look";
      cv.classList.toggle("look", look);
      const w = Math.max(320, Math.round(cv.clientWidth || 960)), h = look ? Math.round(w * 9 / 16) : Math.round(w / 2);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const g = cv.getContext("2d");
      if (look) {
        const srcImg = st.result || build(1024, 512, st.pics);
        const out = view(img(w, h), srcImg, st.look.yaw, st.look.pitch, st.look.fov);
        g.putImageData(new win.ImageData(out.data, w, h), 0, 0);
        g.fillStyle = "#000a"; g.fillRect(8, 8, 300, 22); g.fillStyle = "#c8f6ff"; g.font = "600 12px ui-monospace,Consolas,monospace";
        g.fillText((st.result ? "the panorama" : "the canvas (not made yet)") + " · turn " + Math.round(st.look.yaw) + "° tilt " + Math.round(st.look.pitch) + "°", 14, 23);
        return;
      }
      if (st.mode === "result" && st.result) {                     // the panorama made, flat (2:1)
        const c = toImage(st.result); g.drawImage(c, 0, 0, w, h);
      } else {
        const can = build(w, h, st.pics); g.putImageData(new win.ImageData(can.data, w, h), 0, 0);
      }
      // the grid: every 30° round, every 30° up / down; FRONT in the middle, BEHIND at both edges
      g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 1;
      for (let k = 0; k <= 12; k++) { const x = Math.round(k * w / 12) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let k = 1; k < 6; k++) { const y = Math.round(k * h / 6) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.font = "700 11px system-ui,sans-serif"; g.fillStyle = "rgba(0,0,0,.55)";
      [["BEHIND", 0.02], ["LEFT", 0.25], ["FRONT", 0.5], ["RIGHT", 0.75], ["BEHIND", 0.94]].forEach(([t, f]) => g.fillText(t, f * w - (t === "BEHIND" && f > 0.5 ? 12 : 0), h - 8));
      if (st.mode === "place" && st.sel >= 0 && st.pics[st.sel]) {
        const p = st.pics[st.sel], x = (p.yaw + 180) / 360 * w, y = (90 - p.pitch) / 180 * h;
        g.strokeStyle = "#38e1ff"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x + 14, y); g.moveTo(x, y - 14); g.lineTo(x, y + 14); g.stroke();
      }
    }
    function wireView() {
      const cv = $("pnView"); let drag = null;
      const at = (e) => { const r = cv.getBoundingClientRect(); return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, x: e.clientX, y: e.clientY }; };
      cv.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return; e.preventDefault(); cv.setPointerCapture(e.pointerId);
        const a = at(e);
        if (st.mode === "look") { drag = { look: true, x: a.x, y: a.y, yaw: st.look.yaw, pitch: st.look.pitch }; return; }
        if (st.mode !== "place") return;
        const i = hit(st.pics, a.fx, a.fy); if (i >= 0) st.sel = i;
        if (st.sel < 0) return;
        drag = { place: true }; const ll = lonLat(a.fx, a.fy), p = st.pics[st.sel]; p.yaw = ll.yaw; p.pitch = clamp(ll.pitch, -85, 85);
        paintList(); paint();
      });
      cv.addEventListener("pointermove", (e) => {
        if (!drag) return; const a = at(e);
        if (drag.look) { const k = st.look.fov / cv.clientWidth; st.look.yaw = ((drag.yaw - (a.x - drag.x) * k + 540) % 360) - 180; st.look.pitch = clamp(drag.pitch + (a.y - drag.y) * k, -89, 89); paint(); return; }
        const ll = lonLat(a.fx, a.fy), p = st.pics[st.sel]; if (!p) return; p.yaw = ll.yaw; p.pitch = clamp(ll.pitch, -85, 85); paintSliders(); paint();
      });
      const up = () => { drag = null; };
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      cv.addEventListener("wheel", (e) => {
        e.preventDefault(); const d = e.deltaY > 0 ? 1 : -1;
        if (st.mode === "look") { st.look.fov = clamp(st.look.fov + d * 5, 30, 140); paint(); return; }
        const p = st.pics[st.sel]; if (!p || st.mode !== "place") return; p.fov = clamp(p.fov + d * 4, 15, 170); paintSliders(); paint();
      }, { passive: false });
    }

    /* ---- the pictures list and the sliders ---- */
    function paintList() {
      const L = $("pnPics"); if (!L) return;
      L.innerHTML = st.pics.length ? "" : '<div class="pp-hint">No picture yet - add one below (or make a panorama from the words alone).</div>';
      st.pics.forEach((p, i) => {
        const r = doc.createElement("div"); r.className = "pp-pic" + (i === st.sel ? " sel" : ""); r.dataset.i = String(i);
        r.innerHTML = '<img alt=""><span></span><button type="button" title="Take this picture off the canvas" aria-label="Remove">✕</button>';
        r.querySelector("img").src = p.thumb; r.querySelector("span").textContent = p.name;
        r.addEventListener("click", (e) => { if (e.target.tagName === "BUTTON") return; st.sel = i; paintList(); paint(); });
        r.querySelector("button").addEventListener("click", () => { st.pics.splice(i, 1); st.sel = Math.min(st.sel, st.pics.length - 1); paintList(); paint(); });
        L.appendChild(r);
      });
      paintSliders();
    }
    function paintSliders() {
      const p = st.pics[st.sel], on = !!p;
      [["pnYaw", "yaw", "°"], ["pnPitch", "pitch", "°"], ["pnFov", "fov", "°"]].forEach(([id, k, u]) => {
        const r = $(id), o = $(id + "V"); if (!r) return;
        r.disabled = !on; if (on) r.value = String(Math.round(p[k])); o.textContent = on ? Math.round(p[k]) + u : "-";
      });
    }
    function wireSliders() {
      [["pnYaw", "yaw"], ["pnPitch", "pitch"], ["pnFov", "fov"]].forEach(([id, k]) => {
        $(id).addEventListener("input", () => { const p = st.pics[st.sel]; if (!p) return; p[k] = +$(id).value; paintSliders(); paint(); });
      });
    }

    /* ---- making it ---- */
    function msg(t, bad) { const m = $("pnMsg"); if (m) { m.textContent = t; m.classList.toggle("bad", !!bad); } }
    function lock(on) { st.busy = on; ["pnGo", "pnSeam", "pnVr"].forEach((id) => { const b = $(id); if (b) b.disabled = on || ((id === "pnSeam" || id === "pnVr") && !st.result); }); }
    function blobOf(p) { return new Promise((res) => toImage(p).toBlob(res, "image/png")); }
    async function run(canvas, seam) {
      const info = st.info || (st.info = await api());
      if (!info || !info.style_id) throw new Error((info && info.error) || "the Qwen Image 2.1 edit style is not there - Settings ▸ Styles ▸ restore the starter styles");
      if (win.H3ModelsFound && win.H3ModelsFound.ensure) {
        const go = await win.H3ModelsFound.ensure({ kind: "image", style_id: info.style_id, extra_loras: [{ path: info.lora, weight: info.lora_weight }] });
        if (!go) throw new Error("not made - the models it needs are not there (cancelled)");
      }
      const fd = new win.FormData();
      fd.append("canvas", await blobOf(canvas), "pano360.png");
      fd.append("desc", $("pnDesc").value || ""); fd.append("size", $("pnSize").value); fd.append("seed", $("pnSeed").value || "");
      if (seam) fd.append("seam", "1");
      const r = await win.fetch("/api/pano360", { method: "POST", body: fd }), j = await r.json().catch(() => ({}));
      if (!r.ok || !j.jobs) throw new Error(j.error || "HTTP " + r.status);
      msg((seam ? "↔ the seam pass" : "🌐 the panorama") + " is rendering (job " + j.jobs[0].id + ", seed " + j.jobs[0].seed + ")…");
      const url = E.api && E.api.awaitResult ? await E.api.awaitResult(j.jobs[0].id, (t) => msg(t, true), (t) => msg((seam ? "↔ seam pass · " : "🌐 ") + t)) : null;
      if (!url) throw new Error("the render did not finish - see the job log");
      const pic = await new Promise((res, rej) => { const im = new win.Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("could not load the panorama")); im.src = url; });
      return grab(pic, 8192).src;
    }
    function nameNow() { return String((S && S.name) || "panorama").replace(/\.[a-z0-9]+$/i, "").replace(/\s*360(\s*\(seam\))?$/i, "") || "panorama"; }
    function openResult(p, label) {
      st.result = p; st.resultName = nameNow() + " 360" + (label ? " (" + label + ")" : "");
      if (E.openImage) E.openImage(toImage(p), st.resultName + ".png");
      setMode("result"); lock(false);
    }
    async function make() {
      if (st.busy) return;
      const sz = $("pnSize").value === "1408" ? [1408, 704] : [2048, 1024];
      lock(true); msg("🌐 building the canvas (" + sz[0] + " × " + sz[1] + ")…");
      try {
        const can = build(sz[0], sz[1], st.pics);
        openResult(await run(can, false), "");
        msg("🌐 done - it opened as a new picture: \"" + st.resultName + "\". 🌐 Look round in it, ↔ fix the seam if the join shows, 🥽 use it in VR World.");
      } catch (e) { lock(false); msg("🌐 " + (e.message || e), true); }
    }
    async function seam() {
      if (st.busy || !st.result) return;
      lock(true);
      try {
        const info = st.info || (st.info = await api()), prep = seamPrep(st.result, (info && info.seam_strip) || 1 / 12);
        const back = await run(prep.img, true);
        // the answer's size can differ from the panorama's (the size picked): matched back, then turned back round
        const same = back.w === st.result.w ? back : grab(toImage(back), Math.max(st.result.w, st.result.h)).src;
        openResult(unroll(same), "seam");
        msg("↔ the join is filled - opened as \"" + st.resultName + "\" (the first one is still open)");
      } catch (e) { lock(false); msg("↔ " + (e.message || e), true); }
    }
    async function toVr() {
      if (!st.result) return;
      try {
        const fd = new win.FormData(); fd.append("slot", "world"); fd.append("file", await blobOf(st.result), st.resultName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").replace(/_360(_seam)?$/i, "") + "_360.png");   // _360 = VR World reads it as a 360 picture
        const r = await win.fetch("/api/vrworld/upload", { method: "POST", body: fd }), j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status);
        if (win.VrWorld && win.VrWorld.open) {                   // straight into VR World with it as the world
          msg("🥽 it is 🥽 VR World's world now - VR World is open: aim, add the performer, ▶ Render VR");
          dlg.close(); win.VrWorld.open();
        } else msg("🥽 it is 🥽 VR World's world now - open 🥽 VR World (the StoryBoard's button) and add the performer");
      } catch (e) { msg("🥽 " + (e.message || e), true); }
    }
    function setMode(m) {
      st.mode = m === "look" || (m === "result" && st.result) ? m : "place";
      ["place", "result", "look"].forEach((k) => { const b = $("pnM_" + k); if (b) { b.classList.toggle("on", st.mode === k); if (k === "result") b.disabled = !st.result; } });
      const h = $("pnHint");
      if (h) h.textContent = st.mode === "look" ? "Drag to look round, the mouse wheel to zoom in / out." : st.mode === "result" ? "The panorama, unrolled flat - the left and right edges meet behind you."
        : "Drag a picture to where it should be (FRONT is the middle; the edges meet BEHIND you). The mouse wheel = its size. Green = what the model fills.";
      paint();
    }

    /* ---- the dialog ---- */
    function build_() {
      if (dlg) return dlg;
      if (!$("pnCss")) { const s = doc.createElement("style"); s.id = "pnCss"; s.textContent = CSS; doc.head.appendChild(s); }
      dlg = doc.createElement("dialog"); dlg.className = "ppdlg"; dlg.id = "pnDlg"; dlg.setAttribute("aria-label", "360 Panorama");
      dlg.innerHTML = '<div class="pp-title"><h2>🌐 360 PANORAMA</h2><button type="button" class="pp-x" id="pnClose" aria-label="Close" title="Close">✕</button></div>'
        + '<div class="pp-body"><div class="pp-left">'
        + '<div class="pp-modes" role="group" aria-label="View"><button type="button" id="pnM_place" class="on">✋ Place</button><button type="button" id="pnM_result" disabled>🖼 Panorama</button><button type="button" id="pnM_look">🌐 Look round</button></div>'
        + '<canvas id="pnView" tabindex="0" aria-label="The 360 canvas"></canvas><div class="pp-hint" id="pnHint"></div></div>'
        + '<div class="pp-right">'
        + '<div class="pp-sec"><h3>PICTURES</h3><div class="pp-pics" id="pnPics"></div>'
        + '<div class="pp-row"><label for="pnYaw">Turn</label><input type="range" id="pnYaw" min="-180" max="180" step="1"><output id="pnYawV">-</output></div>'
        + '<div class="pp-row"><label for="pnPitch">Tilt</label><input type="range" id="pnPitch" min="-85" max="85" step="1"><output id="pnPitchV">-</output></div>'
        + '<div class="pp-row"><label for="pnFov">Size</label><input type="range" id="pnFov" min="15" max="170" step="1"><output id="pnFovV">-</output></div>'
        + '<div class="pp-adds"><button type="button" class="pp-btn" id="pnAddDoc" title="The picture as you see it (all its layers)">＋ This picture</button>'
        + '<button type="button" class="pp-btn" id="pnAddLayer" title="Only the active layer (its transparency stays green)">＋ Active layer</button>'
        + '<button type="button" class="pp-btn" id="pnAddFile">＋ From a file…</button><input type="file" id="pnFile" accept="image/*" hidden></div></div>'
        + '<div class="pp-sec"><h3>DESCRIBE THE PLACE</h3><textarea id="pnDesc" placeholder="What fills the green: where it is, what is round it, where the light comes from - e.g. a quiet beach at sunset, palm trees behind, the sun low on the left"></textarea>'
        + '<div class="pp-row" style="grid-template-columns:52px 1fr"><label for="pnSize">Size</label><select id="pnSize"></select></div>'
        + '<div class="pp-row" style="grid-template-columns:52px 1fr"><label for="pnSeed">Seed</label><input type="number" id="pnSeed" placeholder="random" min="0"></div></div>'
        + '<button type="button" class="pp-go" id="pnGo">▶ Make the 360 panorama</button><div class="pp-msg" id="pnMsg" aria-live="polite"></div>'
        + '<div class="pp-after"><button type="button" class="pp-btn" id="pnSeam" disabled title="The LoRA is an early version - if the left / right join shows, this fills it again (a new picture)">↔ Fix the seam</button>'
        + '<button type="button" class="pp-btn" id="pnVr" disabled title="Put it in 🥽 VR World as the world (a MiniMax H3 performer inside it)">🥽 Use in VR World</button></div>'
        + '<div class="pp-lic">Qwen Image 2.1 with nomadoor\'s 360 panorama outpaint LoRA (v0.1) - the Qwen Research License: <b>non-commercial use</b>. '
        + 'The way of placing pictures comes from ComfyUI-Panorama-Stickers (nomadoor, MIT). Best with real scenery; people in a placed picture can come out stretched.</div>'
        + '</div></div>';
      doc.body.appendChild(dlg);
      $("pnClose").addEventListener("click", () => dlg.close());
      ["place", "result", "look"].forEach((k) => $("pnM_" + k).addEventListener("click", () => setMode(k)));
      $("pnAddDoc").addEventListener("click", () => { if (!S.w) { msg("open a picture first", true); return; } if (E.flattenCache) E.flattenCache(); addPic(E.flatten(), (S.name || "the picture").replace(/\.[a-z0-9]+$/i, "")); });
      $("pnAddLayer").addEventListener("click", () => { const L = E.layer && E.layer(); if (!L || !L.canvas) { msg("pick a picture layer first", true); return; } addPic(L.canvas, L.name || "layer"); });
      $("pnAddFile").addEventListener("click", () => $("pnFile").click());
      $("pnFile").addEventListener("change", () => {
        const f = $("pnFile").files && $("pnFile").files[0]; $("pnFile").value = ""; if (!f) return;
        const u = win.URL.createObjectURL(f), im = new win.Image();
        im.onload = () => { addPic(im, f.name.replace(/\.[a-z0-9]+$/i, "")); win.URL.revokeObjectURL(u); }; im.onerror = () => msg("could not read " + f.name, true); im.src = u;
      });
      $("pnGo").addEventListener("click", make); $("pnSeam").addEventListener("click", seam); $("pnVr").addEventListener("click", toVr);
      wireView(); wireSliders();
      if (win.ResizeObserver) new win.ResizeObserver(paint).observe($("pnView"));
      return dlg;
    }
    async function open() {
      build_();
      const info = st.info = await api();
      const sel = $("pnSize"); sel.innerHTML = "";
      ((info && info.sizes) || [{ id: "2048", label: "2048 × 1024" }, { id: "1408", label: "1408 × 704" }]).forEach((s) => { const o = doc.createElement("option"); o.value = s.id; o.textContent = s.label; sel.appendChild(o); });
      if (!st.pics.length && S.w) { if (E.flattenCache) E.flattenCache(); addPic(E.flatten(), (S.name || "the picture").replace(/\.[a-z0-9]+$/i, "")); }
      paintList(); setMode(st.result ? "result" : "place"); lock(false);
      msg(info && !info.style_id ? "the Qwen Image 2.1 edit style is not there - Settings ▸ Styles ▸ restore the starter styles" : "", info && !info.style_id);
      if (!dlg.open) dlg.showModal();
      paint();
    }
    if (E.ui && E.ui.addCmd) E.ui.addCmd("image.pano360", "🌐 360 Panorama…", "", open, {}, ["Image", null, true]);
    E.pano = { open, state: st, make, seam, toVr, setMode, addPic, build: (w, h) => build(w, h, st.pics), close: () => dlg && dlg.close() };
  }

  const PCPano = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCPano;
  else root.PCPano = PCPano;
})(typeof window !== "undefined" ? window : globalThis);

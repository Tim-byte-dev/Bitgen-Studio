/* bitGen Studio — THE TIMELINE'S 🎥 CAMERA (2.399.0), window.TlCamera.
 *
 * Tim (verbatim): "can we add camera movement to follow a 3d path, pan,roll and dolly, height and angle to the tools in
 * timeline docker. will we be able to tell mmh3 , wan and ltx to follow these paths and camera movement" - asked, he
 * chose "Also an exact-path guide".
 *
 *   🎥 (the canvas toolbar, Shift+C)   the Camera tool: the frame the camera sees at the position marker is drawn on the
 *                                      picture; drag = aim it (pan / tilt), Alt+drag = roll, Shift+drag = height,
 *                                      wheel = dolly, Shift+wheel = zoom (lens) - each writes a ◆ key at that moment
 *   🎥 Camera (the timeline bar)       the Camera panel - a docker of its own (float it, dock it beside / inside another):
 *     Use in Generate / Exact path     the prompt docker's Generate tells the model (static/campath.js, lib/camPlan.js)
 *     Preset                           push in, pull out, truck, pedestal, pan, tilt, roll, orbit, crane, zoom, fly in
 *     Camera / Top / Side              what the camera sees (the picture made 3D with its depth), the path from above
 *                                      (drag a point: left / right, toward / away) and from the side (drag: height)
 *     ▶ + the slider                   play / scrub the move (the timeline's position marker follows)
 *     Pan Tilt Roll Height Dolly Lens  the values at that moment; changing one writes a ◆ key there; ◀ ▶ the keys
 *     Aim · Ease · Length · From       straight ahead / at the picture's centre / along the path; the move's easing; how
 *                                      long it is; where it starts on the timeline
 *     Picture · ◐ Depth · Relief       the picture the guide is made from (the first reference picture, or the timeline
 *                                      canvas at the marker) and its depth map (Depth Anything V2 through ComfyUI)
 *     🎬 Make guide                    the picture flown along the path, twice - as the camera sees it (RGB) and its depth
 *                                      - video/camguide_<id>_rgb.mp4 / _depth.mp4 (routes/camPath.js)
 *     What the models are told         MiniMax H3's sentence, Wan's Fun Camera move, LTX's camera LoRA, the prose, and
 *                                      what ComfyUI has for them
 * tl.camera (saved with the timeline) = static/campath.js's camera + start, src {image, depth, relief}, guide.
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function ready() {
    try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onDraw && typeof tl === "object" && tl && window.CamPath
                    && window.SecFloat && SecFloat.started && SecFloat.add && $("tlbar")); } catch (e) { return false; }
  }
  function boot() { if (!$("tlCanvas")) return; if (!ready()) { setTimeout(boot, 80); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function start() {
    if (window.TlCamera && window.TlCamera.started) return;
    const CP = window.CamPath, C = window.TlCanvas, S = C.state;
    const KEY_LABEL = { pan: "Pan°", tilt: "Tilt°", roll: "Roll°", height: "Height", dolly: "Dolly", lens: "Lens mm" };
    const KEY_STEP = { pan: 1, tilt: 1, roll: 1, height: 0.05, dolly: 0.05, lens: 1 };
    const KEY_TIP = { pan: "Turn left (-) / right (+), degrees", tilt: "Look down (-) / up (+), degrees",
      roll: "Roll counterclockwise (-) / clockwise (+), degrees", height: "Lower (-) / raise (+) the camera, in the picture's half-height",
      dolly: "Move back (-) / forward (+) along where it looks", lens: "Focal length (mm, a 24 mm-tall sensor): smaller = wider, bigger = zoomed in" };
    let view = "camera", playing = false, playT0 = 0, playF0 = 0, selPt = -1, lastF = -1, scene = null, models = null;

    /* ---------------------------------------------------------------- the camera, kept in tl.camera */
    function genSeconds() { const s = $("seconds"); return clamp(num(s && s.value, 5), 0.5, 60); }
    function genSize() {
      const w = num($("width") && $("width").value, 1280), h = num($("height") && $("height").value, 720);
      return { w: Math.max(64, w), h: Math.max(64, h) };
    }
    const normed = new WeakSet();
    /** tl.camera, made safe ONCE per object (a timeline loaded / switched brings a new one) - edits then go to it */
    function cam() {
      if (!tl.camera || typeof tl.camera !== "object") tl.camera = Object.assign(CP.defaults(), { dur: genSeconds(), start: 0 });
      if (!normed.has(tl.camera)) {
        const keep = { start: num(tl.camera.start, 0), src: tl.camera.src || null, guide: tl.camera.guide || null };
        tl.camera = Object.assign(CP.norm(tl.camera), keep);
        normed.add(tl.camera);
      }
      return tl.camera;
    }
    function save() { if (typeof tlSave === "function") tlSave(); }
    function fNow() { const c = cam(); return clamp((num(S.t, 0) - c.start) / Math.max(0.01, c.dur), 0, 1); }
    function goF(f) { const c = cam(); C.go(c.start + clamp(f, 0, 1) * c.dur); }
    function keyAt(f) { return (cam().keys || []).findIndex((k) => Math.abs(k.f - f) < 0.006); }
    /** write fields into the key at f (made from the values there when there is none) */
    function setKey(f, patch) {
      const c = cam();
      let i = keyAt(f);
      if (i < 0) { const v = CP.keysAt(c, f); c.keys.push(Object.assign({ f: Math.round(f * 1000) / 1000 }, v)); c.keys.sort((a, b) => a.f - b.f); i = keyAt(f); }
      Object.assign(c.keys[i], patch);
      c.preset = "custom";
      changed();
    }
    function changed() { cam(); save(); paintAll(); C.mark(); }

    /* ---------------------------------------------------------------- the panel */
    const CSS = ""
      + "#cpWrap{display:flex;flex-direction:column;gap:7px;font-size:.74rem}"
      + "#cpWrap .cprow{display:flex;flex-wrap:wrap;align-items:center;gap:6px}"
      + "#cpWrap label{display:inline-flex;align-items:center;gap:4px;color:var(--dim,#9a917f)}"
      + "#cpWrap input[type=number]{width:58px}"
      + "#cpWrap .cprow select{width:auto;flex:1 1 120px;min-width:0}"
      + "#cpWrap .cprow button{flex:none;width:auto}"
      + "#cpWrap .cptabs{display:flex;gap:4px}"
      + "#cpWrap .cptabs button{flex:1;padding:3px 4px;border:1px solid var(--line,#3a342a);border-radius:6px 6px 0 0;background:var(--panel-2,#26221b);color:var(--dim,#9a917f);font-size:.68rem;cursor:pointer}"
      + "#cpWrap .cptabs button.on{color:var(--tiger,#f59e2c);border-color:var(--tiger,#f59e2c)}"
      + "#cpView{width:100%;aspect-ratio:16/9;background:#0b0a08;border:1px solid var(--line,#3a342a);border-radius:0 0 6px 6px;display:block;touch-action:none}"
      + "#cpWrap .cpkeys{display:grid;grid-template-columns:repeat(3,auto 1fr);gap:4px 6px;align-items:center}"
      + "#cpWrap .cpkeys span{color:var(--dim,#9a917f)}"
      + "#cpWrap .cpkeys input{width:100%}"
      + "#cpWrap .cpkeys input.keyed{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
      + "#cpWrap .cpsay{color:var(--dim,#9a917f);font-size:.68rem}"
      + "#cpWrap .cpsay.bad{color:#ff8b6b}#cpWrap .cpsay.good{color:var(--tiger,#f59e2c)}"
      + "#cpTold{border-top:1px solid var(--line,#3a342a);padding-top:6px;color:var(--dim,#9a917f);font-size:.68rem;line-height:1.45}"
      + "#cpTold b{color:var(--text,#e8e2d6);font-weight:600}"
      + "#cpTold .cpq{color:var(--text,#e8e2d6)}"
      + "#cpF{flex:1;min-width:80px}"
      + "#cpWrap h5{margin:2px 0 0;font-family:var(--disp);font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:var(--tiger,#f59e2c)}";
    if (!$("cpCss")) { const st = document.createElement("style"); st.id = "cpCss"; st.textContent = CSS; document.head.appendChild(st); }
    const body = document.createElement("div"); body.id = "cpWrap";
    body.innerHTML = ''
      + '<div class="cprow"><label title="The prompt docker\'s Generate tells MiniMax H3, Wan and LTX about this camera"><input type="checkbox" id="cpUse"> Use in Generate</label>'
      + '<label title="Also send the guide video (🎬 Make guide): H3 as a reference video, Wan as VACE\'s depth control, LTX through its style-transfer depth guide"><input type="checkbox" id="cpExact"> Exact path (guide video)</label></div>'
      + '<div class="cprow"><span>Preset</span><select id="cpPreset"></select><button class="ghost" id="cpApply" type="button" title="Replace the path and keys with this move">Apply</button>'
      + '<button class="ghost" id="cpReset" type="button" title="A static camera framing the picture">Reset</button></div>'
      + '<div class="cptabs" role="tablist"><button data-cpv="camera" class="on" type="button">Camera</button><button data-cpv="top" type="button">Top</button><button data-cpv="side" type="button">Side</button></div>'
      + '<canvas id="cpView" width="640" height="360" aria-label="Camera view"></canvas>'
      + '<div class="cprow"><button class="ghost" id="cpPlay" type="button" title="Play the move">▶</button><input type="range" id="cpF" min="0" max="1000" value="0" title="Scrub the move (the timeline\'s marker follows)"><span id="cpT" class="cpsay">0.00 s</span></div>'
      + '<div class="cpkeys" id="cpKeys"></div>'
      + '<div class="cprow"><button class="ghost" id="cpKey" type="button" title="A key here with the values as they are">◆ Key</button><button class="ghost" id="cpUnkey" type="button" title="Remove the key here">✕ Key</button>'
      + '<button class="ghost" id="cpPrev" type="button" title="The previous key">◀</button><button class="ghost" id="cpNext" type="button" title="The next key">▶</button><span id="cpKeyInfo" class="cpsay"></span></div>'
      + '<h5>Path</h5>'
      + '<div class="cprow"><span>Aim</span><select id="cpAim"><option value="fixed">straight ahead</option><option value="centre">at the picture\'s centre</option><option value="path">along the path</option></select>'
      + '<span>Ease</span><select id="cpEase"><option value="inout">in + out</option><option value="linear">linear</option><option value="in">in</option><option value="out">out</option></select></div>'
      + '<div class="cprow"><span>Length</span><input type="number" id="cpDur" min="0.5" max="60" step="0.5"><span>s</span><button class="ghost" id="cpDurSec" type="button" title="The same as Basic Settings\' Seconds (what Generate renders)">= Seconds</button>'
      + '<span>From</span><input type="number" id="cpStart" min="0" step="0.1"><span>s</span><button class="ghost" id="cpStartPh" type="button" title="Start at the timeline\'s position marker">⇤ marker</button></div>'
      + '<div class="cprow"><button class="ghost" id="cpAddPt" type="button" title="A new point at the end of the path">＋ Point</button><button class="ghost" id="cpDelPt" type="button" title="Remove the selected point (click one in Top / Side)">✕ Point</button><span id="cpPtInfo" class="cpsay"></span></div>'
      + '<h5>Picture + guide</h5>'
      + '<div class="cprow"><select id="cpSrc"><option value="ref">the first reference picture</option><option value="canvas">the timeline canvas at the marker</option></select>'
      + '<button class="ghost" id="cpUsePic" type="button" title="Take this picture for the Camera view and the guide">⟳ Use picture</button>'
      + '<button class="ghost" id="cpDepth" type="button" title="Its depth map (Depth Anything V2 through ComfyUI - comfyui_controlnet_aux) - what makes the picture 3D">◐ Depth</button></div>'
      + '<div class="cprow"><span>Relief</span><input type="range" id="cpRelief" min="0" max="200" value="80" title="How far the near parts stand out from the far ones"><span id="cpPicSay" class="cpsay"></span></div>'
      + '<div class="cprow"><button class="ghost" id="cpGuide" type="button" title="Fly the picture along the path: the camera\'s view (RGB) and its depth, as two videos in Assets">🎬 Make guide</button><span id="cpGuideSay" class="cpsay"></span></div>'
      + '<div id="cpTold"></div>';
    const btn = document.createElement("button");
    btn.className = "ghost"; btn.id = "tlCamBtn"; btn.type = "button"; btn.textContent = "🎥 Camera";
    btn.title = "The camera path - pan, tilt, roll, dolly, height, a 3D path - and what MiniMax H3, Wan and LTX are told (a docker of its own)";
    const bar = $("tlbar"), after = $("tlAddImgTrack");
    if (after && after.parentElement === bar) after.after(btn); else bar.appendChild(btn);
    const w = SecFloat.add({ id: "camera", title: "Camera", w: 430, h: 640, body, button: btn, onShow: () => { refreshModels(); paintAll(); },
      firstX: (vw) => Math.max(8, vw - 470) });
    const keysBox = $("cpKeys");
    keysBox.innerHTML = CP.KEY_FIELDS.map((k) => `<span>${KEY_LABEL[k]}</span><input type="number" data-cpk="${k}" step="${KEY_STEP[k]}" title="${esc(KEY_TIP[k])}">`).join("");
    $("cpPreset").innerHTML = Object.keys(CP.PRESETS).map((k) => `<option value="${k}">${esc(CP.PRESETS[k])}</option>`).join("");

    /* ---------------------------------------------------------------- painting the panel */
    function shown() { return !!(w && w.el && !w.el.classList.contains("sf-hidden") && w.el.getClientRects().length); }
    function paintAll() {
      const c = cam();
      if (!shown()) return;
      $("cpUse").checked = !!c.use; $("cpExact").checked = !!c.exact;
      if (CP.PRESETS[c.preset]) $("cpPreset").value = c.preset;
      $("cpAim").value = c.aim; $("cpEase").value = c.ease;
      if (document.activeElement !== $("cpDur")) $("cpDur").value = c.dur;
      if (document.activeElement !== $("cpStart")) $("cpStart").value = Math.round(c.start * 100) / 100;
      $("cpRelief").value = Math.round(num((c.src || {}).relief, 0.8) * 100);
      paintKeys(); paintView(); paintTold(); paintGuide(); paintPic();
      $("cpPtInfo").textContent = `${c.path.length} point${c.path.length === 1 ? "" : "s"}` + (selPt >= 0 && selPt < c.path.length ? ` · point ${selPt + 1} selected` : "");
    }
    function paintKeys() {
      const c = cam(), f = fNow(), v = CP.keysAt(c, f), on = keyAt(f) >= 0;
      keysBox.querySelectorAll("input[data-cpk]").forEach((el) => {
        const k = el.dataset.cpk;
        if (document.activeElement !== el) el.value = Math.round(v[k] * (k === "height" || k === "dolly" ? 100 : 10)) / (k === "height" || k === "dolly" ? 100 : 10);
        el.classList.toggle("keyed", on);
      });
      $("cpF").value = Math.round(f * 1000);
      $("cpT").textContent = `${(f * c.dur).toFixed(2)} s of ${c.dur} s`;
      $("cpKeyInfo").textContent = c.keys.length ? `${c.keys.length} key${c.keys.length === 1 ? "" : "s"}${on ? " · ◆ here" : ""}` : "no keys";
    }
    function told() { return CP.plan(cam(), { seconds: genSeconds() }); }
    function paintTold() {
      const c = cam(), pl = told(), m = models || {};
      const lora = pl.ltx ? `${pl.ltx.key}` + (m.ltxLoras ? (m.ltxLoras[pl.ltx.key] ? " ✓ in ComfyUI" : " - not in ComfyUI's loras") : "") : "none for this move (words only)";
      const wanCam = m.reachable ? ((m.wanCamera || []).length ? "✓ Fun Camera model" : "no Fun Camera model in ComfyUI (words only)") : "";
      const vace = m.reachable ? ((m.wanVace || []).length ? "✓ VACE model" : "no VACE model") : "";
      $("cpTold").innerHTML = '<b>What the models are told</b>' + (c.use ? "" : ' <span class="cpsay bad">(Use in Generate is off)</span>')
        + `<div><b>Moves:</b> ${esc(pl.desc.segments.map((s) => CP.proseMove(s)).join(" → "))}</div>`
        + `<div><b>MiniMax H3:</b> <span class="cpq">${esc(pl.h3)}</span>${c.exact ? " + the RGB guide as a reference video (References renders)" : ""}</div>`
        + `<div><b>Wan:</b> Fun Camera <span class="cpq">${esc(pl.wan.pose)}</span> (speed ${pl.wan.speed})${wanCam ? " · " + esc(wanCam) : ""}${c.exact ? " · exact: the depth guide through VACE" + (vace ? " (" + esc(vace) + ")" : "") : ""}</div>`
        + `<div><b>LTX:</b> camera LoRA <span class="cpq">${esc(lora)}</span>${c.exact ? " · exact: the depth guide (style-transfer mode)" : ""}</div>`
        + `<div><b>Words (Wan, LTX):</b> <span class="cpq">${esc(pl.prose)}</span></div>`
        + (pl.notes.length ? `<div>${pl.notes.map(esc).join("<br>")}</div>` : "")
        + (m.reachable === false ? '<div class="cpsay">ComfyUI is not running - what it has is checked when it is.</div>'
          : m.reachable ? `<div>Depth Anything (comfyui_controlnet_aux): ${m.depth ? "✓" : "not installed - ◐ Depth needs it"}</div>` : "");
    }
    async function refreshModels() {
      try { models = await (await fetch("/api/campath/models")).json(); } catch (e) { models = { reachable: false }; }
      paintTold();
    }
    function guideSig() { const c = cam(), g = genSize(); return CP.sig(c, [(c.src || {}).image || "", (c.src || {}).depth || "", num((c.src || {}).relief, 0.8), guideSize(g).w, guideSize(g).h]); }
    function guideFresh() { const g = cam().guide; return !!(g && g.rgb && g.depth && g.sig === guideSig()); }
    function paintGuide() {
      const g = cam().guide, el = $("cpGuideSay");
      if (!g || !g.rgb) { el.textContent = "no guide yet"; el.className = "cpsay"; return; }
      const fresh = guideFresh();
      el.textContent = (fresh ? "✓ " : "⚠ the path or picture changed - make it again · ") + `${g.rgb} + ${g.depth} (${g.w}×${g.h}, ${g.frames} frames)`;
      el.className = "cpsay " + (fresh ? "good" : "bad");
    }
    function paintPic() {
      const s = cam().src || {}, el = $("cpPicSay");
      el.textContent = s.image ? (s.depth ? "picture + depth ✓" : "picture ✓ (flat - no depth yet)") : "no picture yet (⟳ Use picture)";
    }

    /* ---------------------------------------------------------------- Top / Side views (2D) */
    function viewGeom(cv) {
      const c = cam(), A = S.W / S.H, D = CP.distFor(c.lens);
      const xs = [-A * 1.3, A * 1.3], zs = [-0.6, D * 1.25], ys = [-1.3, 1.3];
      c.path.forEach((p) => { xs.push(p[0]); zs.push(p[2]); ys.push(p[1]); });
      const pad = 18, W = cv.width, H = cv.height;
      if (view === "top") {
        const x0 = Math.min(...xs) - 0.3, x1 = Math.max(...xs) + 0.3, z0 = Math.min(...zs) - 0.3, z1 = Math.max(...zs) + 0.3;
        const k = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (z1 - z0));
        const ox = W / 2 - (x0 + x1) / 2 * k, oz = H / 2 - (z0 + z1) / 2 * k;
        return { k, to: (p) => ({ x: ox + p[0] * k, y: oz + p[2] * k }), from: (sx, sy, p) => [ (sx - ox) / k, p[1], (sy - oz) / k ] };
      }
      const z0 = Math.min(...zs) - 0.3, z1 = Math.max(...zs) + 0.3, y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3;
      const k = Math.min((W - 2 * pad) / (z1 - z0), (H - 2 * pad) / (y1 - y0));
      const oz = W / 2 - (z0 + z1) / 2 * k, oy = H / 2 + (y0 + y1) / 2 * k;
      return { k, to: (p) => ({ x: oz + p[2] * k, y: oy - p[1] * k }), from: (sx, sy, p) => [ p[0], (oy - sy) / k, (sx - oz) / k ] };
    }
    function paint2D(cv) {
      const g = cv.getContext("2d"), c = cam(), G = viewGeom(cv), A = S.W / S.H, W = cv.width, H = cv.height;
      g.fillStyle = "#0b0a08"; g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(255,255,255,.06)"; g.lineWidth = 1;
      for (let i = -10; i <= 10; i++) {
        const a = G.to(view === "top" ? [i * 0.5, 0, -5] : [0, i * 0.5, -5]), b = G.to(view === "top" ? [i * 0.5, 0, 10] : [0, i * 0.5, 10]);
        const c1 = G.to(view === "top" ? [-10, 0, i * 0.5] : [0, -10, i * 0.5]), d = G.to(view === "top" ? [10, 0, i * 0.5] : [0, 10, i * 0.5]);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.moveTo(c1.x, c1.y); g.lineTo(d.x, d.y); g.stroke();
      }
      // the picture (and its relief)
      const rel = num((c.src || {}).relief, 0.8);
      const p0 = G.to(view === "top" ? [-A, 0, 0] : [0, -1, 0]), p1 = G.to(view === "top" ? [A, 0, 0] : [0, 1, 0]);
      const r0 = G.to(view === "top" ? [-A, 0, rel / 2] : [0, -1, rel / 2]), r1 = G.to(view === "top" ? [A, 0, -rel / 2] : [0, 1, -rel / 2]);
      g.fillStyle = "rgba(245,158,44,.08)"; g.fillRect(Math.min(r0.x, r1.x), Math.min(r0.y, r1.y), Math.abs(r1.x - r0.x) || 2, Math.abs(r1.y - r0.y) || 2);
      g.strokeStyle = "#f59e2c"; g.lineWidth = 3; g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
      g.fillStyle = "#9a917f"; g.font = "11px sans-serif"; g.fillText(view === "top" ? "the picture (from above)" : "the picture (from the side)", 8, 14);
      // the path
      const Sm = CP.sample(c.path, 12);
      g.strokeStyle = "#e8e2d6"; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath();
      Sm.pts.forEach((p, i) => { const q = G.to(p); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.stroke(); g.setLineDash([]);
      c.path.forEach((p, i) => { const q = G.to(p); g.fillStyle = i === selPt ? "#f59e2c" : "#e8e2d6"; g.beginPath(); g.arc(q.x, q.y, i === selPt ? 6 : 4.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#14120f"; g.font = "9px sans-serif"; g.fillText(String(i + 1), q.x - 3, q.y + 3); });
      // the keys along the move
      c.keys.forEach((k) => { const q = G.to(CP.poseAt(c, k.f).pos); g.fillStyle = "#f59e2c"; g.save(); g.translate(q.x, q.y); g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore(); });
      // the camera now: where it is, where it looks, its field of view
      const P = CP.poseAt(c, fNow()), q = G.to(P.pos), len = 0.9;
      const hv = view === "top" ? (P.fov / 2) * (S.W / S.H) : P.fov / 2;
      const ang = view === "top" ? Math.atan2(P.fwd[2], P.fwd[0]) : Math.atan2(-P.fwd[1], P.fwd[2]);
      g.fillStyle = "rgba(245,158,44,.18)"; g.strokeStyle = "#f59e2c"; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(q.x, q.y);
      g.lineTo(q.x + Math.cos(ang - hv) * len * G.k, q.y + Math.sin(ang - hv) * len * G.k);
      g.lineTo(q.x + Math.cos(ang + hv) * len * G.k, q.y + Math.sin(ang + hv) * len * G.k); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#f59e2c"; g.beginPath(); g.arc(q.x, q.y, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#9a917f"; g.fillText(view === "top" ? "drag a point: left / right, toward / away · click the empty space to add one" : "drag a point: height, toward / away · click the empty space to add one", 8, H - 8);
    }

    /* ---------------------------------------------------------------- the 3D picture (three.js): the Camera view + the guide */
    async function T() { if (!window.H3M3D) throw new Error("the 3D renderer (static/m3d.js) is not loaded"); return window.H3M3D.load(); }
    function loadImg(url) {
      return new Promise((ok, no) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => no(new Error("could not load " + url)); im.src = url; });
    }
    /** the scene for the current picture + depth + relief (rebuilt when they change) */
    async function sceneFor(wantW, wantH) {
      const THREE = await T();
      const c = cam(), src = c.src || {}, rel = num(src.relief, 0.8);
      const key = [src.image || "comp", src.depth || "", rel, S.W, S.H].join("|");
      if (scene && scene.key === key) return scene;
      let pic = null;
      if (src.image) { try { pic = await loadImg(src.image); } catch (e) { pic = null; } }
      if (!pic) { pic = await loadImg(C.snapshot()); }
      let dpx = null, dw = 0, dh = 0;
      if (src.depth) {
        try {
          const dimg = await loadImg(src.depth);
          dw = Math.min(512, dimg.naturalWidth); dh = Math.max(1, Math.round(dw * dimg.naturalHeight / dimg.naturalWidth));
          const cv = document.createElement("canvas"); cv.width = dw; cv.height = dh;
          const g = cv.getContext("2d"); g.drawImage(dimg, 0, 0, dw, dh); dpx = g.getImageData(0, 0, dw, dh).data;
        } catch (e) { dpx = null; }
      }
      const A = (pic.naturalWidth || pic.width) / (pic.naturalHeight || pic.height) || S.W / S.H;
      const EXT = 3, SX = 300, SY = Math.max(8, Math.round(300 / A));   // past the picture's edges (their pixels stretched) for big moves
      const geo = new THREE.PlaneGeometry(2 * A * EXT, 2 * EXT, SX, SY);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      let mean = 0.5;
      if (dpx) { let s = 0, n = 0; for (let i = 0; i < dpx.length; i += 16) { s += dpx[i] / 255; n++; } mean = n ? s / n : 0.5; }
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const u = x / (2 * A) + 0.5, v = y / 2 + 0.5;
        uv.setXY(i, u, v);
        if (dpx) {
          const px = clamp(Math.round(clamp(u, 0, 1) * (dw - 1)), 0, dw - 1), py = clamp(Math.round((1 - clamp(v, 0, 1)) * (dh - 1)), 0, dh - 1);
          pos.setZ(i, (dpx[(py * dw + px) * 4] / 255 - mean) * rel);
        }
      }
      pos.needsUpdate = true; uv.needsUpdate = true;
      const tex = new THREE.Texture(pic); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0b0a08); sc.add(mesh);
      if (scene && scene.dispose) scene.dispose();
      scene = { key, THREE, scene: sc, mesh, A, rel, hasDepth: !!dpx,
        // the depth pass: disparity (1 / distance) between the guide's near and far - near = white, like Depth Anything's maps
        depthMat: new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uNear: { value: 0.1 }, uFar: { value: 20 } },
          vertexShader: "varying float vz; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vz = -mv.z; gl_Position = projectionMatrix * mv; }",
          fragmentShader: "uniform float uNear; uniform float uFar; varying float vz; void main(){ float d = (1.0 / max(vz, 1e-4) - 1.0 / uFar) / (1.0 / uNear - 1.0 / uFar); gl_FragColor = vec4(vec3(clamp(d, 0.0, 1.0)), 1.0); }" }),
        colorMat: mesh.material, dispose: () => { geo.dispose(); tex.dispose(); } };
      return scene;
    }
    let R = null;
    function renderer(THREE, w2, h2) {
      if (!R) { R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.outputColorSpace = THREE.SRGBColorSpace; }
      const sz = R.getSize(new THREE.Vector2());
      if (sz.x !== w2 || sz.y !== h2) R.setSize(w2, h2, false);
      return R;
    }
    /** the picture as the camera sees it at f (kind "rgb" | "depth"), drawn into a w x h canvas */
    function shoot(sc, f, w2, h2, kind, near, far) {
      const THREE = sc.THREE, P = CP.poseAt(cam(), f);
      const r = renderer(THREE, w2, h2);
      const camera = new THREE.PerspectiveCamera(P.fov * 180 / Math.PI, w2 / h2, near || 0.02, far || 60);
      camera.position.set(P.pos[0], P.pos[1], P.pos[2]);
      camera.up.set(P.rup[0], P.rup[1], P.rup[2]);
      camera.lookAt(P.pos[0] + P.fwd[0], P.pos[1] + P.fwd[1], P.pos[2] + P.fwd[2]);
      if (kind === "depth") { sc.depthMat.uniforms.uNear.value = near || 0.1; sc.depthMat.uniforms.uFar.value = far || 20; }
      sc.mesh.material = kind === "depth" ? sc.depthMat : sc.colorMat;
      sc.scene.background = new THREE.Color(kind === "depth" ? 0x000000 : 0x0b0a08);
      r.render(sc.scene, camera);
      sc.mesh.material = sc.colorMat;
      return r.domElement;
    }
    let painting = false, repaint = false;
    async function paintCamera(cv) {
      if (painting) { repaint = true; return; }
      painting = true;
      try {
        const sc = await sceneFor();
        const el = shoot(sc, fNow(), cv.width, cv.height, "rgb");
        const g = cv.getContext("2d"); g.drawImage(el, 0, 0, cv.width, cv.height);
        g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, cv.height - 18, cv.width, 18);
        g.fillStyle = "#e8e2d6"; g.font = "11px sans-serif";
        g.fillText(sc.hasDepth ? "the picture in 3D (its depth)" : "flat picture - ◐ Depth makes it 3D", 8, cv.height - 5);
      } catch (e) {
        const g = cv.getContext("2d"); g.fillStyle = "#0b0a08"; g.fillRect(0, 0, cv.width, cv.height);
        g.fillStyle = "#ff8b6b"; g.font = "12px sans-serif"; g.fillText(String(e.message || e).slice(0, 80), 10, 20);
      } finally {
        painting = false;
        if (repaint) { repaint = false; paintCamera(cv); }
      }
    }
    function paintView() {
      const cv = $("cpView"); if (!cv) return;
      document.querySelectorAll("#cpWrap .cptabs button").forEach((b) => b.classList.toggle("on", b.dataset.cpv === view));
      const r = cv.getBoundingClientRect();
      const W2 = Math.max(160, Math.round(r.width || 400)), H2 = Math.max(90, Math.round(W2 * 9 / 16));
      if (cv.width !== W2 || cv.height !== H2) { cv.width = W2; cv.height = H2; }
      if (view === "camera") paintCamera(cv); else paint2D(cv);
    }

    /* ---------------------------------------------------------------- the guide */
    function guideSize(g) {
      const k = Math.min(1, 832 / Math.max(g.w, g.h));
      return { w: Math.max(64, Math.round(g.w * k / 16) * 16), h: Math.max(64, Math.round(g.h * k / 16) * 16) };
    }
    async function makeGuide(onProgress) {
      const c = cam();
      const say = (t, cls) => { const el = $("cpGuideSay"); if (el) { el.textContent = t; el.className = "cpsay " + (cls || ""); } };
      const sc = await sceneFor();
      const gs = guideSize(genSize()), fps = 24, frames = Math.round(c.dur * fps) + 1;
      // one near / far for every frame (the depth stays comparable across the video)
      let dmin = Infinity, dmax = 0;
      for (let i = 0; i <= 24; i++) {
        const P = CP.poseAt(c, i / 24);
        for (const cx of [-sc.A, 0, sc.A]) for (const cy of [-1, 0, 1]) for (const cz of [-sc.rel / 2, sc.rel / 2]) {
          const d = Math.hypot(P.pos[0] - cx, P.pos[1] - cy, P.pos[2] - cz);
          dmin = Math.min(dmin, d); dmax = Math.max(dmax, d);
        }
      }
      const near = Math.max(0.02, dmin * 0.85), far = Math.max(near + 0.5, dmax * 1.6);
      const id = Date.now().toString(36);
      for (const kind of ["rgb", "depth"]) {
        for (let i = 0; i < frames; i++) {
          const el = shoot(sc, frames === 1 ? 0 : i / (frames - 1), gs.w, gs.h, kind, kind === "depth" ? near : 0.02, kind === "depth" ? far : 80);
          const blob = await new Promise((ok) => el.toBlob(ok, "image/png"));
          const r = await fetch(`/api/campath/frame?id=${id}&kind=${kind}&i=${i}`, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `frame ${i} refused`);
          if (i % 6 === 0) { say(`rendering the ${kind === "rgb" ? "camera view" : "depth"}: frame ${i + 1} of ${frames}`); if (onProgress) onProgress(kind, i, frames); }
        }
      }
      say("encoding…");
      const r = await fetch("/api/campath/encode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, fps, frames }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "encode failed");
      c.guide = { rgb: j.rgb, depth: j.depth, frames: j.frames, w: gs.w, h: gs.h, sig: guideSig(), id };
      save(); paintGuide();
      try { if (typeof refreshAssets === "function") refreshAssets(); } catch (e) { /* fine */ }
      return c.guide;
    }

    /* ---------------------------------------------------------------- the picture + its depth */
    async function usePicture() {
      const c = cam(), how = $("cpSrc").value;
      let blob = null;
      if (how === "ref") {
        const r0 = (typeof refs !== "undefined" && refs && refs[0]) || null;
        if (!r0 || !r0.file) throw new Error("the reference dock's Image tab has no picture - pick 'the timeline canvas' or add one");
        blob = r0.file;
      } else {
        blob = await (await fetch(C.snapshot())).blob();
      }
      const fd = new FormData(); fd.append("file", blob, `camsrc_${Date.now().toString(36)}.png`); fd.append("hint", "images");
      const up = await (await fetch("/api/passets", { method: "POST", body: fd })).json();
      if (!up || !up.name) throw new Error((up && up.error) || "could not keep the picture");
      c.src = { image: `/passets/images/${encodeURIComponent(up.name)}`, name: up.name, depth: "", relief: num((c.src || {}).relief, 0.8) };
      scene = null; save(); paintAll();
      try { if (typeof refreshAssets === "function") refreshAssets(); } catch (e) { /* fine */ }
    }
    async function makeDepth() {
      const c = cam(), src = c.src || {};
      if (!src.image) throw new Error("⟳ Use picture first");
      const blob = await (await fetch(src.image)).blob();
      const fd = new FormData(); fd.append("image", blob, "picture.png"); fd.append("type", "depth");
      const r = await fetch("/api/aiedit/preprocess", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "refused");
      if (typeof refreshJobs === "function") await refreshJobs();
      const st = typeof awaitJob === "function" ? await awaitJob(j.job) : "done";
      if (st !== "done") throw new Error("the depth job " + st + " - see its log (ComfyUI with comfyui_controlnet_aux?)");
      const jj = await (await fetch(`/api/jobs/${j.job}`)).json();
      const out = (jj.outputs && jj.outputs[0]) || jj.output;
      if (!out) throw new Error("the depth job made no picture");
      c.src = Object.assign({}, src, { depth: `/outputs/${encodeURIComponent(out)}` });
      scene = null; save(); paintAll();
    }

    /* ---------------------------------------------------------------- what Generate sends */
    /** the `camera` form field for Generate (prompt docker), or "" when Use in Generate is off */
    function field() {
      const c = cam();
      if (!c.use) return "";
      const fresh = guideFresh(), g = c.guide || {};
      if (c.exact && !fresh && typeof logLine === "function")
        logLine("[camera] " + (g.rgb ? "the guide is older than the path / picture - 🎬 Make guide again; words + native moves only this time" : "Exact path is on but there is no guide yet (🎬 Make guide) - words + native moves only"));
      const cc = CP.norm(c);
      return JSON.stringify({ cam: cc, guide: c.exact && fresh ? { rgb: g.rgb, depth: g.depth } : {} });
    }

    /* ---------------------------------------------------------------- wiring */
    function wireUi() {
      $("cpUse").onchange = () => { cam().use = $("cpUse").checked; changed(); };
      $("cpExact").onchange = () => { cam().exact = $("cpExact").checked; changed(); };
      $("cpApply").onclick = () => {
        const c = cam(), p = CP.preset($("cpPreset").value, c.lens);
        if (!p) return;
        Object.assign(c, { path: p.path, keys: p.keys, aim: p.aim, ease: p.ease, lens: p.lens, preset: p.preset });
        selPt = -1; changed();
      };
      $("cpReset").onclick = () => { const c = cam(), p = CP.preset("static", 35); Object.assign(c, { path: p.path, keys: [], aim: "fixed", ease: "inout", lens: 35, preset: "static" }); selPt = -1; changed(); };
      document.querySelectorAll("#cpWrap .cptabs button").forEach((b) => { b.onclick = () => { view = b.dataset.cpv; paintView(); }; });
      $("cpF").oninput = () => { goF(num($("cpF").value, 0) / 1000); };
      $("cpPlay").onclick = () => {
        playing = !playing; $("cpPlay").textContent = playing ? "⏸" : "▶";
        if (playing) { playT0 = performance.now(); playF0 = fNow() >= 0.999 ? 0 : fNow(); }
      };
      keysBox.querySelectorAll("input[data-cpk]").forEach((el) => {
        el.onchange = () => { const k = el.dataset.cpk; setKey(fNow(), { [k]: num(el.value, 0) }); };
      });
      $("cpKey").onclick = () => setKey(fNow(), {});
      $("cpUnkey").onclick = () => { const i = keyAt(fNow()); if (i >= 0) { cam().keys.splice(i, 1); changed(); } };
      $("cpPrev").onclick = () => { const f = fNow(), k = cam().keys.filter((x) => x.f < f - 0.006).pop(); if (k) goF(k.f); };
      $("cpNext").onclick = () => { const f = fNow(), k = cam().keys.find((x) => x.f > f + 0.006); if (k) goF(k.f); };
      $("cpAim").onchange = () => { cam().aim = $("cpAim").value; cam().preset = "custom"; changed(); };
      $("cpEase").onchange = () => { cam().ease = $("cpEase").value; changed(); };
      $("cpDur").onchange = () => { cam().dur = clamp(num($("cpDur").value, 5), 0.5, 60); changed(); };
      $("cpDurSec").onclick = () => { cam().dur = genSeconds(); changed(); };
      $("cpStart").onchange = () => { cam().start = Math.max(0, num($("cpStart").value, 0)); changed(); };
      $("cpStartPh").onclick = () => { cam().start = Math.max(0, num(S.t, 0)); changed(); };
      $("cpAddPt").onclick = () => {
        const c = cam(), last = c.path[c.path.length - 1], prev = c.path[c.path.length - 2];
        const nx = prev ? [last[0] + (last[0] - prev[0]) * 0.5, last[1] + (last[1] - prev[1]) * 0.5, last[2] + (last[2] - prev[2]) * 0.5] : [last[0], last[1], last[2] - 0.5];
        c.path.push(nx.map((v) => Math.round(v * 1000) / 1000)); selPt = c.path.length - 1; c.preset = "custom"; changed();
      };
      $("cpDelPt").onclick = () => { const c = cam(); if (c.path.length > 1 && selPt >= 0) { c.path.splice(selPt, 1); selPt = -1; c.preset = "custom"; changed(); } };
      $("cpRelief").oninput = () => { const c = cam(); c.src = Object.assign({}, c.src || {}, { relief: num($("cpRelief").value, 80) / 100 }); scene = null; save(); paintView(); paintGuide(); };
      const busy = async (b, fn) => {
        const say = (t, cls) => { const el = b === $("cpGuide") ? $("cpGuideSay") : $("cpPicSay"); el.textContent = t; el.className = "cpsay " + (cls || ""); };
        b.disabled = true;
        try { await fn(say); } catch (e) { say("⚠ " + (e.message || e), "bad"); } finally { b.disabled = false; }
      };
      $("cpUsePic").onclick = () => busy($("cpUsePic"), async (say) => { say("taking the picture…"); await usePicture(); });
      $("cpDepth").onclick = () => busy($("cpDepth"), async (say) => { say("depth through ComfyUI…"); await makeDepth(); });
      $("cpGuide").onclick = () => busy($("cpGuide"), async () => { await makeGuide(); });
      // Top / Side: drag a point, click the empty space to add one
      const cv = $("cpView");
      let drag = null;
      cv.addEventListener("pointerdown", (ev) => {
        if (view === "camera") return;
        const r = cv.getBoundingClientRect(), sx = (ev.clientX - r.left) * cv.width / r.width, sy = (ev.clientY - r.top) * cv.height / r.height;
        const G = viewGeom(cv), c = cam();
        let hit = -1;
        c.path.forEach((p, i) => { const q = G.to(p); if (Math.hypot(q.x - sx, q.y - sy) <= 9) hit = i; });
        if (hit < 0) { c.path.push(G.from(sx, sy, c.path[c.path.length - 1]).map((v) => Math.round(v * 1000) / 1000)); hit = c.path.length - 1; c.preset = "custom"; }
        selPt = hit; drag = { i: hit, G }; cv.setPointerCapture(ev.pointerId); changed();
      });
      cv.addEventListener("pointermove", (ev) => {
        if (!drag) return;
        const r = cv.getBoundingClientRect(), sx = (ev.clientX - r.left) * cv.width / r.width, sy = (ev.clientY - r.top) * cv.height / r.height;
        const c = cam();
        c.path[drag.i] = drag.G.from(sx, sy, c.path[drag.i]).map((v) => Math.round(v * 1000) / 1000);
        c.preset = "custom"; paintView(); C.mark();
      });
      cv.addEventListener("pointerup", () => { if (drag) { drag = null; changed(); } });
    }
    wireUi();

    /* ---------------------------------------------------------------- the canvas tool + the frame on the picture */
    let tdrag = null;
    C.addTool({ id: "camera", icon: "🎥", title: "Camera - drag to aim it (pan / tilt), Alt+drag = roll, Shift+drag = height, wheel = dolly, Shift+wheel = zoom; each writes a ◆ key at the marker", key: "shift+c", cursor: "move",
      down: (p, ev) => { const v = CP.keysAt(cam(), fNow()); tdrag = { x: ev.clientX, y: ev.clientY, v, alt: ev.altKey, shift: ev.shiftKey }; if (!shown()) SecFloat.show("camera", true); },
      move: (p, ev) => {
        if (!tdrag) return;
        const dx = ev.clientX - tdrag.x, dy = ev.clientY - tdrag.y, v = tdrag.v;
        if (tdrag.alt) setKey(fNow(), { roll: Math.round((v.roll + dx * 0.25) * 10) / 10 });
        else if (tdrag.shift) setKey(fNow(), { height: Math.round((v.height - dy * 0.004) * 1000) / 1000 });
        else setKey(fNow(), { pan: Math.round((v.pan + dx * 0.08) * 10) / 10, tilt: Math.round((v.tilt - dy * 0.08) * 10) / 10 });
      },
      up: () => { tdrag = null; } });
    $("tlCanvas").addEventListener("wheel", (ev) => {
      if (S.tool !== "camera" || ev.ctrlKey) return;
      ev.preventDefault(); ev.stopPropagation();
      const v = CP.keysAt(cam(), fNow()), d = ev.deltaY > 0 ? 1 : -1;
      if (ev.shiftKey) setKey(fNow(), { lens: Math.round(clamp(v.lens * (d > 0 ? 1 / 1.05 : 1.05), 8, 400) * 10) / 10 });
      else setKey(fNow(), { dolly: Math.round((v.dolly - d * 0.05) * 1000) / 1000 });
    }, { passive: false, capture: true });
    C.onDraw((ctx, o) => {
      const c = tl.camera;
      if (!c || !(S.tool === "camera" || (shown() && c.use))) return;
      const P = CP.poseAt(CP.norm(c), fNow()), gs = genSize();
      const q = CP.frameOnPicture(P, S.W, S.H, gs.w / gs.h);
      ctx.save();
      if (!q) { ctx.fillStyle = "#ff8b6b"; ctx.font = "12px sans-serif"; const s0 = o.toScreen(10, 20); ctx.fillText("🎥 the camera looks away from the picture here", s0.x, s0.y); ctx.restore(); return; }
      const pts = q.map((p) => o.toScreen(p.x, p.y));
      ctx.strokeStyle = "#f59e2c"; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#f59e2c"; ctx.font = "12px sans-serif";
      ctx.fillText(`🎥 ${Math.round(fNow() * 100)}% · ${CP.proseMove(CP.describe(c, c.dur).primary)}`, pts[0].x + 6, pts[0].y + 16);
      ctx.restore();
    });

    /* ---------------------------------------------------------------- the clock: play, follow the marker */
    function tick() {
      requestAnimationFrame(tick);
      if (!shown()) return;
      if (playing) {
        const c = cam(), f = playF0 + (performance.now() - playT0) / 1000 / c.dur;
        if (f >= 1) { playing = false; $("cpPlay").textContent = "▶"; goF(1); } else goF(f);
      }
      const f = fNow();
      if (Math.abs(f - lastF) > 1e-4) { lastF = f; paintKeys(); paintView(); }
    }
    requestAnimationFrame(tick);
    window.TlCamera = { started: true, cam, field, makeGuide, usePicture, makeDepth, setKey, fNow, goF, told, guideFresh,
                        paint: paintAll, show: (on) => SecFloat.show("camera", on), view: (v) => { view = v; paintView(); }, sceneFor,
                        /** a path point's place on the screen in the Top / Side view (tests, tours) */
                        pointOnScreen: (i) => { const cv = $("cpView"), G = viewGeom(cv), q = G.to(cam().path[i]), r = cv.getBoundingClientRect();
                          return { x: r.x + q.x * r.width / cv.width, y: r.y + q.y * r.height / cv.height }; } };
    paintAll();
  }
})();

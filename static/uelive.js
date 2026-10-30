/* bitGen Studio — static/uelive.js (2.590.0): 📺 THE UNREAL VIEW - what a layer's / clip's camera sees in Unreal, live,
 * window.UELive (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "unreal connection works. do i have to keep the unreal window open? show the unreal window in timeline
 * and image-editor when selected" - picked: a live camera view (works with Unreal minimized or behind bitGen).
 *   view(el, {request, onState})   the viewer inside el: a picture refreshed frame after frame (POST /api/unreal/frame -
 *                                  lib/ueLive.js -> bitGen Bridge 1.5.0 "frame"), its bar: ● state + frames a second, the
 *                                  size (S / M / L), ⏸, ⚡ keep Unreal fast (the editor keeps full speed behind bitGen).
 *                                  request() -> a still's request for what is selected now, or null (nothing to show)
 *                                  -> {start(), stop(), running(), refresh(), el}
 *   floatBox(host, {id, title})    a small floating window inside host (the timeline): its title drags it, ✕ hides it,
 *                                  a corner sizes it -> {el, body, show(on), shown()}
 * Users: the image editor's 📺 Unreal View docker (ext/imageeditdock/pcuelive.js), the timeline's (ext/timelinedock/
 * tluelive.js). Pure (Node: scripts/test-uelive590.js): frameSize, clipRequest, nextDelay, SIZES.
 */
(function (root) {
  "use strict";
  const SIZES = { s: 480, m: 640, l: 960 };
  /** the frame's pixels: the layer's aspect at the chosen width (multiples of 2, at most 1280 x 720) */
  function frameSize(w, h, width) {
    const W = Math.max(16, +w || 1280), H = Math.max(16, +h || 720), k = Math.min((+width || 640) / W, 1280 / W, 720 / H);
    return { w: Math.max(16, Math.round(W * k / 2) * 2), h: Math.max(16, Math.round(H * k / 2) * 2) };
  }
  /** the wait before the next frame: a short breath after a frame, longer after an error (backs off to 5 s) */
  function nextDelay(ok, fails) { return ok ? 60 : Math.min(5000, 800 * Math.pow(2, Math.max(0, (fails || 1) - 1))); }
  /** a timeline clip made with Unreal (c.ue) at the playhead t (the timeline's seconds) -> the frame's request, or null.
   *  framing = UEBridge.framing, keyAt = TlUnreal.keyAt */
  function clipRequest(c, t, framing, keyAt) {
    const ue = c && c.ue; if (!ue) return null;
    const local = Math.max(0, Math.min(ue.dur || 1e9, (+t || 0) - (+c.start || 0) + (+c.in || 0)));
    const o = { w: ue.w || 1280, h: ue.h || 720, alpha: !!ue.alpha };
    if (ue.level) o.level = ue.level;
    if (ue.lens) o.lens = ue.lens;
    if (ue.rig) o.rig = ue.rig;
    if (ue.kind === "sequence") { if (!ue.sequence) return null; o.sequence = ue.sequence; o.time = local; o.camera = { viewport: true }; }
    else if (ue.kind === "camera") { const k = keyAt && keyAt(ue.keys || [], local); if (!k) return null; o.camera = { loc: k.loc, rot: k.rot, fov: k.fov || 60 }; }
    else if (ue.kind === "scene") { const cm = ue.camera || {}; o.camera = cm.loc ? { loc: cm.loc, rot: cm.rot || [0, 0, 0], fov: cm.fov || 60 } : cm.name ? { name: cm.name } : { viewport: true }; }
    else if (ue.kind === "metahuman") {
      if (!framing || !ue.metahuman) return null;
      const f = framing(ue.preset || "bust", ue.turn || 0);
      o.camera = { loc: f.camera.loc, rot: f.camera.rot, fov: f.camera.fov };
      o.metahuman = { bp: ue.metahuman.bp, time: local, loc: f.figure.loc, rot: f.figure.rot };
      if (ue.metahuman.anim) o.metahuman.anim = ue.metahuman.anim;
      o.onlyMetahuman = true; o.alpha = true;
    } else return null;
    return o;
  }
  const pure = { SIZES, frameSize, nextDelay, clipRequest };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  const doc = root.document;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = { get: (k, d) => { try { const v = root.localStorage.getItem("h3.uelive." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { root.localStorage.setItem("h3.uelive." + k, JSON.stringify(v)); } catch (e) { /* private */ } } };
  let css = false;
  function addCss() {
    if (css || doc.getElementById("ueLiveCss")) { css = true; return; }
    css = true;
    const st = doc.createElement("style"); st.id = "ueLiveCss";
    st.textContent = ".uelv{display:flex;flex-direction:column;gap:4px;min-height:0;height:100%;font:11px system-ui,sans-serif}"
      + ".uelv .uelb{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.uelv .uelb button,.uelv .uelb select{font:inherit;padding:1px 6px;border-radius:4px;border:1px solid var(--pc-sep,var(--line,#555));background:none;color:inherit;cursor:pointer}"
      + ".uelv .uelb button.on{background:var(--pc-accent,var(--tiger,#2680eb));color:#fff;border-color:transparent}.uelv .ueld{width:8px;height:8px;border-radius:50%;background:#777;flex:none}"
      + ".uelv .ueld.run{background:#3fb950}.uelv .ueld.wait{background:#f59e2c}.uelv .ueld.bad{background:#e5534b}.uelv .uels{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--pc-dim,var(--dim,#999))}"
      + ".uelv .uelp{flex:1 1 auto;min-height:90px;background:#000 repeating-conic-gradient(#2a2a2a 0 25%,#222 0 50%) 0 0/14px 14px;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}"
      + ".uelv .uelp img{max-width:100%;max-height:100%;object-fit:contain;display:block}.uelv .uelp .e{color:#aaa;padding:12px;text-align:center;position:absolute}"
      + ".uefb{position:absolute;z-index:70;display:flex;flex-direction:column;background:var(--panel,#221e19);border:1px solid var(--line,#555);border-radius:7px;box-shadow:0 8px 26px rgba(0,0,0,.5);color:var(--text,#ddd);resize:both;overflow:hidden;min-width:220px;min-height:150px}"
      + ".uefb.off{display:none}.uefb .uefh{display:flex;align-items:center;gap:6px;padding:4px 7px;cursor:move;user-select:none;background:rgba(255,255,255,.05);border-bottom:1px solid var(--line,#444);font:600 11px system-ui,sans-serif}"
      + ".uefb .uefh b{flex:1}.uefb .uefh button{background:none;border:0;color:inherit;cursor:pointer;font:inherit}.uefb .uefc{flex:1;min-height:0;padding:5px}";
    doc.head.appendChild(st);
  }
  let cid = "";
  const clientId = () => { if (!cid) { try { cid = root.sessionStorage.getItem("h3.uelive.id") || ""; } catch (e) { cid = ""; } if (!cid) { cid = "uv" + Math.random().toString(36).slice(2, 10); try { root.sessionStorage.setItem("h3.uelive.id", cid); } catch (e) { /* private */ } } } return cid; };

  function view(el, o) {
    addCss();
    const opt = o || {}, me = "v" + Math.random().toString(36).slice(2, 7);
    el.classList.add("uelv");
    el.innerHTML = '<div class="uelb"><span class="ueld" data-u="dot"></span><span class="uels" data-u="st">select an Unreal / MetaHuman layer</span>'
      + '<select data-u="size" title="The live picture\'s size - smaller is faster">' + Object.keys(SIZES).map((k) => `<option value="${k}">${k.toUpperCase()} ${SIZES[k]}</option>`).join("") + "</select>"
      + '<button type="button" data-u="pause" title="Pause / go on">⏸</button>'
      + '<button type="button" data-u="fast" title="⚡ Keep Unreal fast: the editor keeps full speed when it is behind bitGen or minimized (Editor Preferences ▸ Performance ▸ Use Less CPU when in Background off) - needs the bitGen Bridge plugin 1.5.0">⚡</button></div>'
      + '<div class="uelp" data-u="pic"><div class="e">📺 the Unreal View shows what the selected layer\'s camera sees</div></div>';
    const q = (k) => el.querySelector(`[data-u="${k}"]`);
    let size = store.get("size", "m"), paused = false, running = false, fails = 0, url = "", timer = null, busy = false, n = 0, t0 = 0, last = "";
    q("size").value = SIZES[size] ? size : "m";
    q("size").onchange = (e) => { size = e.target.value; store.set("size", size); };
    q("pause").onclick = () => { paused = !paused; q("pause").textContent = paused ? "▶" : "⏸"; q("pause").classList.toggle("on", paused); if (!paused) loop(); else say("paused", ""); };
    const fastOn = () => store.get("fast", false);
    const paintFast = () => q("fast").classList.toggle("on", !!fastOn());
    q("fast").onclick = () => {
      const on = !fastOn();
      fetch("/api/unreal/keepfast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) }).then((r) => r.json()).then((j) => {
        if (j.error) { say(j.error, "bad"); return; }
        store.set("fast", on); paintFast(); say(on ? "⚡ Unreal keeps full speed behind bitGen" : "Unreal slows down again when it is not in front", "");
      }).catch((e) => say(e.message, "bad"));
    };
    paintFast();
    function say(t, cls) { q("st").textContent = t; q("dot").className = "ueld" + (cls ? " " + cls : ""); if (opt.onState) { try { opt.onState(cls || "", t); } catch (e) { /* theirs */ } } }
    function show(blob, ms, legacy) {
      const u = URL.createObjectURL(blob), pic = q("pic");
      let img = pic.querySelector("img"); if (!img) { pic.innerHTML = ""; img = doc.createElement("img"); img.alt = "Unreal View"; pic.appendChild(img); }
      img.src = u; if (url) URL.revokeObjectURL(url); url = u;
      n++; const sec = (Date.now() - t0) / 1000;
      say(`live · ${sec > 0.5 ? (n / sec).toFixed(1) : "…"} fps · ${ms} ms a frame${legacy ? " · plugin 1.4 (update it for speed)" : ""}`, "run");
    }
    async function once() {
      const req = opt.request && opt.request();
      if (!req) { say("select an Unreal / MetaHuman layer (or an Unreal clip) - its camera shows here", ""); return "none"; }
      const sz = frameSize(req.w, req.h, SIZES[size] || 640);
      const body = Object.assign({}, req, sz, { client: clientId() + me });
      const key = JSON.stringify(body); if (key !== last) { last = key; }
      const r = await fetch("/api/unreal/frame", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { let j = {}; try { j = await r.json(); } catch (e) { j = {}; } throw new Error(j.error || ("Unreal: " + r.status)); }
      show(await r.blob(), +(r.headers.get("X-UE-Ms") || 0), r.headers.get("X-UE-Legacy") === "1");
      return "ok";
    }
    async function loop() {
      if (!running || paused || busy) return;
      clearTimeout(timer); busy = true;
      let st = "ok";
      try { st = await once(); fails = st === "ok" ? 0 : fails; }
      catch (e) { fails++; st = "err"; say(String(e.message || e), "bad"); }
      finally { busy = false; }
      if (running && !paused) timer = setTimeout(loop, st === "none" ? 600 : nextDelay(st === "ok", fails));
    }
    const api = {
      el,
      start() { if (running) return; running = true; n = 0; t0 = Date.now(); say("connecting…", "wait"); loop(); },
      stop() { running = false; clearTimeout(timer); if (!paused) say("stopped", ""); },
      /** 2.618.0: stopped AND the picture gone (its layer / clip was deleted or hidden - the scene is not shown) */
      clear(why) { running = false; clearTimeout(timer); last = ""; const pic = q("pic"); pic.innerHTML = '<div class="e"></div>'; pic.firstChild.textContent = why || "📺 the Unreal View shows what the selected layer's camera sees"; if (url) { URL.revokeObjectURL(url); url = ""; } say(why || "closed", ""); },
      running: () => running && !paused,
      refresh() { if (running && !paused && !busy) { clearTimeout(timer); loop(); } },
      frames: () => n,
    };
    return api;
  }

  function floatBox(host, o) {
    addCss();
    const opt = o || {};
    if (root.getComputedStyle && root.getComputedStyle(host).position === "static") host.style.position = "relative";
    const box = doc.createElement("div"); box.className = "uefb off"; if (opt.id) box.id = opt.id;
    box.innerHTML = `<div class="uefh"><b>${esc(opt.title || "📺 Unreal View")}</b><button type="button" data-x title="Hide (the button that opened it brings it back)">✕</button></div><div class="uefc"></div>`;
    host.appendChild(box);
    const key = "box." + (opt.id || "x");
    let r = store.get(key, null);
    const place = () => { const W = host.clientWidth || 800, H = host.clientHeight || 400; if (!r) r = { x: Math.max(0, W - 500), y: 8, w: 470, h: 310 };
      r.w = Math.max(220, Math.min(W, r.w)); r.h = Math.max(150, Math.min(Math.max(150, H), r.h)); r.x = Math.max(0, Math.min(W - 80, r.x)); r.y = Math.max(0, Math.min(Math.max(0, H - 30), r.y));
      Object.assign(box.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" }); };
    box.querySelector(".uefh").addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return; e.preventDefault();
      const sx = e.clientX, sy = e.clientY, x0 = r.x, y0 = r.y;
      const mv = (m) => { r.x = x0 + m.clientX - sx; r.y = y0 + m.clientY - sy; place(); };
      const up = () => { root.removeEventListener("pointermove", mv); root.removeEventListener("pointerup", up); store.set(key, r); };
      root.addEventListener("pointermove", mv); root.addEventListener("pointerup", up);
    });
    if (typeof root.ResizeObserver === "function") new root.ResizeObserver(() => { if (box.classList.contains("off") || !r) return; r.w = box.offsetWidth; r.h = box.offsetHeight; store.set(key, r); }).observe(box);
    const api = { el: box, body: box.querySelector(".uefc"), shown: () => !box.classList.contains("off"),
      show(on) { box.classList.toggle("off", !on); if (on) place(); if (opt.onShow) { try { opt.onShow(!!on); } catch (e) { /* theirs */ } } } };
    box.querySelector("[data-x]").onclick = () => api.show(false);
    return api;
  }
  root.UELive = Object.assign({ view, floatBox, store, clientId }, pure);
})(typeof window !== "undefined" ? window : globalThis);

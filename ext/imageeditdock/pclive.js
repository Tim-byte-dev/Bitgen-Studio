/* pclive.js — ⚡ LIVE GENERATION in the image editor (2.588.0), window.PCLive.
 *
 * Tim (verbatim): "add live generation mode like krita has."
 *
 *   ⚡ (the menu bar, beside ⛶) / View ▸ ⚡ Live Generation   turns it on: the ⚡ Live docker opens inside the editor
 *   PAINT              every change to the picture (a stroke, an undo, a layer shown / hidden, the prompt, a setting) is
 *                      rendered again a moment later - the whole picture (or the selection's box) as a Refine with the
 *                      live strength, through the live style. Only ONE render at a time; changes made while it renders
 *                      are rendered next (latest wins: the server drops a waiting one when a newer one comes -
 *                      lib/liveGen.js). The model stays loaded (no VRAM clear between live renders) and live renders go
 *                      to the head of the queue; they are never in the queue docker, the gallery or the assets.
 *   THE DOCKER         the result (click = full size on the canvas while held), ● idle / rendering / an error,
 *                      the style, strength, steps (0 = the style's own), size (MP), 🔒 seed (same seed = the result only
 *                      changes where you painted - Krita's way; 🎲 a new one), ▣ on canvas (the result over the picture,
 *                      with a mix), ⏸ pause, ✔ Apply as layer (Krita's "copy to layer": one undo step)
 *   PROMPT             the ✨ AI panel's prompt box, or the main prompt box when it is empty
 * A fast style makes it feel live: a turbo / lightning / LCM / FLUX schnell / Z-Image Turbo style at 4-8 steps.
 * Pure (Node: scripts/test-live588.js): nextAction, liveSize, fingerprint, blendTo, MP_CHOICES.
 */
(function (root) {
  "use strict";
  const MP_CHOICES = [0.25, 0.5, 0.75, 1, 1.5];
  /** the loop's decision: run a render now, wait (a change is settling / one is rendering), or idle */
  function nextAction(st) {
    const s = st || {};
    if (!s.on || s.paused || !s.doc) return "idle";
    if (!s.dirty) return "idle";
    if (s.inflight) return "wait";
    return (s.now - (s.changed || 0)) >= (s.debounce == null ? 350 : s.debounce) ? "run" : "wait";
  }
  /** the render size for a w x h picture at mp megapixels (multiples of 16, never bigger than the picture x 1.5) */
  function liveSize(w, h, mp) {
    const budget = Math.max(0.0625, +mp || 0.5) * 1048576;
    let k = Math.sqrt(budget / Math.max(1, w * h));
    k = Math.min(k, 1.5);
    const r16 = (v) => Math.max(64, Math.round(v * k / 16) * 16);
    return { w: r16(w), h: r16(h), scale: k };
  }
  /** what decides whether the picture changed (the editor's state, cheap) */
  function fingerprint(S, extra, idOf) {
    const id = idOf || (() => 0);
    const top = S.undo && S.undo.length ? id(S.undo[S.undo.length - 1]) : 0;
    const lay = (S.layers || []).map((L) => (L.visible ? 1 : 0) + ":" + (L.opacity == null ? 1 : L.opacity) + ":" + (L.blend || "")).join(",");
    return [S.w, S.h, (S.undo || []).length, (S.redo || []).length, top, (S.layers || []).length, lay, S.selVer || 0].join("|") + "#" + JSON.stringify(extra || {});
  }
  /** the result over the picture at mix (0..1) - the alpha the on-canvas preview is drawn with */
  function blendTo(mix) { const m = +mix; return Math.max(0, Math.min(1, isNaN(m) ? 1 : m)); }

  /* ================================ the docker ================================ */
  function install(E) {
    const { S, doc, win, store, kx } = E;
    if (!kx || !doc) return;
    const say = E.say || (() => {});
    const $ = E.$;
    const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
    const clientId = (() => { let v = ""; try { v = win.sessionStorage.getItem("h3.live.id") || ""; } catch (e) { v = ""; }
      if (!v) { v = "lv" + Math.random().toString(36).slice(2, 12); try { win.sessionStorage.setItem("h3.live.id", v); } catch (e) { /* private */ } } return v; })();
    const L = {
      on: false, paused: false, inflight: false, dirty: true, changed: 0, fp: "", result: null, resultFor: null, error: "", lastMs: 0, renders: 0,
      strength: store.get("live.strength", 35), steps: store.get("live.steps", 0), mp: store.get("live.mp", 0.5),
      lock: store.get("live.lock", true), seed: store.get("live.seed", Math.floor(Math.random() * 2147483647)),
      onCanvas: store.get("live.oncanvas", false), mix: store.get("live.mix", 70), style: store.get("live.style", ""),
    };
    const ids = new WeakMap(); let idn = 0;
    const idOf = (o) => { if (!o || typeof o !== "object") return 0; let v = ids.get(o); if (!v) { v = ++idn; ids.set(o, v); } return v; };

    if (!doc.getElementById("pcLiveCss")) {
      const st = doc.createElement("style"); st.id = "pcLiveCss";
      st.textContent = `.pclive{position:absolute;z-index:61;width:272px;display:flex;flex-direction:column;background:var(--pc-panel,#323232);color:var(--pc-text,#ddd);border:1px solid var(--pc-sep,#555);border-radius:6px;box-shadow:0 6px 22px rgba(0,0,0,.45);font:12px system-ui,sans-serif}
.pclive.off{display:none}.pclive .plh{display:flex;align-items:center;gap:5px;padding:5px 6px;cursor:move;background:var(--pc-panel2,#3c3c3c);border-radius:6px 6px 0 0;user-select:none}
.pclive .plh b{flex:1;font-weight:600}.pclive button{background:none;border:1px solid var(--pc-sep,#555);color:inherit;border-radius:4px;padding:1px 6px;cursor:pointer;font:inherit}
.pclive button:hover{background:var(--pc-hover,#454545)}.pclive button.on{background:var(--pc-accent,#2680eb);border-color:var(--pc-accent,#2680eb);color:#fff}
.pclive .pldot{width:9px;height:9px;border-radius:50%;background:#777;flex:none}.pclive .pldot.run{background:#f59e2c;animation:plp 1s infinite}.pclive .pldot.ok{background:#3fb950}.pclive .pldot.bad{background:#e5534b}
@keyframes plp{50%{opacity:.35}}
.pclive .plv{margin:6px;background:repeating-conic-gradient(#3a3a3a 0 25%,#2c2c2c 0 50%) 0 0/14px 14px;border-radius:4px;min-height:120px;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:zoom-in}
.pclive .plv canvas{max-width:100%;max-height:220px;display:block}.pclive .plv .e{color:var(--pc-dim,#999);padding:16px;text-align:center}
.pclive .plr{display:grid;grid-template-columns:62px 1fr auto;gap:4px 6px;align-items:center;padding:0 8px 4px}.pclive .plr label{color:var(--pc-dim,#aaa)}
.pclive select,.pclive input[type=number]{background:var(--pc-input,#232323);color:inherit;border:1px solid var(--pc-sep,#555);border-radius:4px;font:inherit;padding:1px 3px;min-width:0}
.pclive input[type=range]{width:100%}.pclive .plb{display:flex;gap:4px;padding:4px 8px 8px;flex-wrap:wrap}.pclive .pls{padding:0 8px 6px;color:var(--pc-dim,#999);font-size:11px;min-height:14px}`;
      doc.head.appendChild(st);
    }
    if (win.getComputedStyle && win.getComputedStyle(kx).position === "static") kx.style.position = "relative";
    const box = doc.createElement("div"); box.className = "pclive off"; box.id = "pcLive";
    box.innerHTML = `<div class="plh" id="plHead" title="⚡ Live - drag to move (it stays inside the editor)"><span class="pldot" id="plDot"></span><b>⚡ Live</b>
        <button type="button" id="plPause" title="Pause / go on rendering">⏸</button><button type="button" id="plClose" title="Live mode off">✕</button></div>
      <div class="plv" id="plView" title="Hold to see the result full size on the canvas"><div class="e">Paint - the result shows here</div></div>
      <div class="plr"><label for="plStyle">style</label><select id="plStyle" title="The style live renders with - a fast one (turbo / lightning / LCM / schnell, 4-8 steps) feels live"></select><span></span>
        <label for="plStr">strength</label><input type="range" id="plStr" min="5" max="95" step="5" title="How much the AI may change (Krita's live strength - 30-50 % keeps your drawing)"><span id="plStrV"></span>
        <label for="plSteps">steps</label><input type="number" id="plSteps" min="0" max="60" title="0 = the style's own steps; fewer = faster"><span class="k" style="color:var(--pc-dim,#999)">0 = style</span>
        <label for="plMp">size</label><select id="plMp" title="The render size (megapixels) - smaller is faster; the result is scaled to the picture">${MP_CHOICES.map((m) => `<option value="${m}">${m} MP</option>`).join("")}</select><span></span>
        <label for="plSeed">seed</label><input type="number" id="plSeed" min="0" max="2147483647" title="The same seed keeps the result steady - it only changes where you paint"><span><button type="button" id="plLock" title="🔒 the same seed every render / 🔓 a new one each time">🔒</button><button type="button" id="plDice" title="A new seed">🎲</button></span>
        <label for="plMix">on canvas</label><input type="range" id="plMix" min="10" max="100" step="5" title="The result over the picture - how much"><span><button type="button" id="plOn" title="Show the result over the picture on the canvas">▣</button></span></div>
      <div class="plb"><button type="button" id="plApply" title="The result as a new layer above the current one (one undo step)">✔ Apply as layer</button><button type="button" id="plNow" title="Render now">↻</button></div>
      <div class="pls" id="plStat" aria-live="polite"></div>`;
    kx.appendChild(box);
    const $l = (id) => box.querySelector("#" + id);
    let pos = store.get("live.pos", null);
    const clamp = (p) => { const W = kx.clientWidth || 800, H = kx.clientHeight || 600, w = box.offsetWidth || 272, h = box.offsetHeight || 300;
      return { x: Math.max(0, Math.min(W - w, p.x)), y: Math.max(0, Math.min(H - 40, p.y)) }; };
    const place = () => { if (!pos) pos = { x: (kx.clientWidth || 800) - 290, y: 64 }; pos = clamp(pos); box.style.left = pos.x + "px"; box.style.top = pos.y + "px"; };
    $l("plHead").addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, p0 = Object.assign({}, pos);
      const mv = (ev) => { pos = { x: p0.x + ev.clientX - sx, y: p0.y + ev.clientY - sy }; place(); };
      const up = () => { win.removeEventListener("pointermove", mv); win.removeEventListener("pointerup", up); store.set("live.pos", pos); };
      win.addEventListener("pointermove", mv); win.addEventListener("pointerup", up);
    });
    box.addEventListener("keydown", (e) => e.stopPropagation());

    // the style list = the ✨ AI panel's Regenerate styles (the same <option>s)
    function paintStyles() {
      const src = $("ieStyle"), sel = $l("plStyle"); if (!src || !sel) return;
      const keep = L.style || src.value;
      sel.innerHTML = src.innerHTML;
      if ([...sel.options].some((o) => o.value === keep)) sel.value = keep; else sel.value = src.value;
      L.style = sel.value;
    }
    function paintCtl() {
      $l("plStr").value = L.strength; $l("plStrV").textContent = L.strength + "%";
      $l("plSteps").value = L.steps; $l("plMp").value = String(L.mp); $l("plSeed").value = L.seed; $l("plMix").value = L.mix;
      $l("plLock").textContent = L.lock ? "🔒" : "🔓"; $l("plLock").classList.toggle("on", !!L.lock);
      $l("plOn").classList.toggle("on", !!L.onCanvas); $l("plMix").disabled = !L.onCanvas;
      $l("plPause").textContent = L.paused ? "▶" : "⏸"; $l("plPause").classList.toggle("on", !!L.paused);
      const b = $("kxLive"); if (b) { b.classList.toggle("on", L.on); b.title = L.on ? "⚡ Live is on - click to stop" : "⚡ Live generation - the AI renders the picture again as you paint (Krita's live mode)"; }
    }
    const set = (k, v) => { L[k] = v; store.set("live." + k.toLowerCase(), v); L.dirty = true; L.changed = Date.now(); paintCtl(); };
    $l("plStyle").onchange = (e) => { L.style = e.target.value; store.set("live.style", L.style); L.dirty = true; L.changed = Date.now(); };
    $l("plStr").oninput = (e) => set("strength", +e.target.value);
    $l("plSteps").onchange = (e) => set("steps", Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)));
    $l("plMp").onchange = (e) => set("mp", +e.target.value || 0.5);
    $l("plSeed").onchange = (e) => set("seed", Math.max(0, Math.min(2147483647, parseInt(e.target.value, 10) || 0)));
    $l("plLock").onclick = () => set("lock", !L.lock);
    $l("plDice").onclick = () => set("seed", Math.floor(Math.random() * 2147483647));
    $l("plOn").onclick = () => { L.onCanvas = !L.onCanvas; store.set("live.oncanvas", L.onCanvas); paintCtl(); showOnCanvas(); };
    $l("plMix").oninput = (e) => { L.mix = +e.target.value; store.set("live.mix", L.mix); showOnCanvas(); };
    $l("plPause").onclick = () => { L.paused = !L.paused; paintCtl(); dot(L.paused ? "" : L.inflight ? "run" : "ok"); stat(L.paused ? "paused - ▶ goes on" : ""); };
    $l("plClose").onclick = () => setOn(false);
    $l("plNow").onclick = () => { L.dirty = true; L.changed = 0; };
    $l("plApply").onclick = () => apply();
    // hold the result = full size on the canvas
    const vw = $l("plView");
    vw.addEventListener("pointerdown", () => { if (L.result && L.resultFor === docKey()) { E.setPreview(L.result); } });
    const unhold = () => { if (!L.onCanvas) E.setPreview(null); else showOnCanvas(); };
    vw.addEventListener("pointerup", unhold); vw.addEventListener("pointerleave", (e) => { if (e.buttons) unhold(); });

    const dot = (c) => { const d = $l("plDot"); d.className = "pldot" + (c ? " " + c : ""); };
    const stat = (t) => { $l("plStat").textContent = t || ""; };
    const docKey = () => S.w + "x" + S.h + ":" + (S.name || "");
    const promptNow = () => (($("iePrompt") && $("iePrompt").value.trim()) || (E.api && E.api.mainPrompt ? E.api.mainPrompt() : "") || "").trim();
    const extra = () => ({ p: promptNow(), s: L.style, st: L.strength, n: L.steps, m: L.mp, seed: L.lock ? L.seed : -1 });

    function showOnCanvas() {
      if (!L.on || !L.onCanvas || !L.result || L.resultFor !== docKey()) { if (S.preview && S.preview.__live) E.setPreview(null); return; }
      const c = E.newCanvas(S.w, S.h), g = E.ctx(c); g.globalAlpha = blendTo(L.mix / 100); g.drawImage(L.result, 0, 0);
      c.__live = true; E.setPreview(c);
    }
    function showResult() {
      vw.innerHTML = "";
      const k = Math.min(256 / S.w, 220 / S.h, 1), t = E.newCanvas(Math.max(1, Math.round(S.w * k)), Math.max(1, Math.round(S.h * k)));
      E.ctx(t).drawImage(L.result, 0, 0, t.width, t.height); vw.appendChild(t);
      showOnCanvas();
    }

    async function render() {
      if (!E.api || !E.api.aiedit) { L.error = "the AI is not connected (reload the page)"; dot("bad"); stat(L.error); L.dirty = false; return; }
      const prompt = promptNow();
      if (!prompt) { dot("bad"); stat("write a prompt (the ✨ AI panel's box or the main prompt) - live renders need one"); L.dirty = false; return; }
      if (!L.style) { paintStyles(); if (!L.style) { dot("bad"); stat("pick a style (Settings → Image makes them)"); L.dirty = false; return; } }
      L.inflight = true; L.dirty = false; dot("run");
      const key = docKey(), t0 = Date.now();
      L.fp = fingerprint(S, extra(), idOf);
      try {
        const src = E.flatten();
        const fit = liveSize(S.w, S.h, L.mp);
        const crop = E.newCanvas(fit.w, fit.h), cg = E.ctx(crop); cg.imageSmoothingQuality = "high"; cg.drawImage(src, 0, 0, fit.w, fit.h);
        const mask = E.newCanvas(fit.w, fit.h);                 // fully transparent = the whole picture is the selection
        const rgba = E.newCanvas(fit.w, fit.h);
        const req = { mode: "refine", prompt, count: 1, strength: L.strength, style_id: L.style, width: fit.w, height: fit.h,
          crop: await E.blobOf(crop), mask: await E.blobOf(mask), rgba: await E.blobOf(rgba), whole: "1",
          live: "1", live_id: clientId, live_steps: L.steps ? String(L.steps) : "", seed: String(L.lock ? L.seed : Math.floor(Math.random() * 2147483647)) };
        let err = "";
        const r = await E.api.aiedit(req, (t) => { err = t; });
        if (!r || !r.jobs || !r.jobs[0]) throw new Error(err || "refused");
        const id = r.jobs[0].id;
        stat("rendering…");
        const out = await poll(id);
        if (!out) return;                                        // superseded / failed (said)
        if (docKey() !== key) { stat("the picture changed size - rendering again"); L.dirty = true; return; }
        const im = await E.imgOf(out);
        const c = E.newCanvas(S.w, S.h), g = E.ctx(c); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, S.w, S.h);
        L.result = c; L.resultFor = key; L.lastMs = Date.now() - t0; L.renders++; L.error = "";
        showResult(); dot("ok");
        stat(`${(L.lastMs / 1000).toFixed(1)} s · ${fit.w}×${fit.h} · seed ${req.seed}` + (L.renders === 1 ? " - ✔ Apply keeps it as a layer" : ""));
        tev("ie_live", String(L.renders));
      } catch (e) { L.error = String(e.message || e); dot("bad"); stat("live: " + L.error); }
      finally {
        L.inflight = false;
        // changed while it rendered? the loop renders it next (latest wins)
        if (fingerprint(S, extra(), idOf) !== L.fp) { L.dirty = true; L.changed = Date.now(); }
      }
    }
    async function poll(id) {
      for (let i = 0; i < 2400; i++) {
        await new Promise((res) => win.setTimeout(res, 450));
        if (!L.on) return null;
        let j = null, st = 0;
        try { const r = await win.fetch("/api/jobs/" + encodeURIComponent(id)); st = r.status; j = await r.json(); } catch (e) { continue; }
        if (st === 404) { stat("a newer change took its place"); return null; }
        if (!j || !j.status) continue;
        if (j.status === "running" && j.progress && j.progress.total) stat(`rendering… step ${j.progress.step} / ${j.progress.total}`);
        if (j.status === "done") { const o = (j.outputs && j.outputs[0]) || j.output; return o ? `/outputs/${encodeURIComponent(o)}?v=${Date.now()}` : null; }
        if (j.status === "cancelled") { stat("a newer change took its place"); return null; }
        if (j.status !== "running" && j.status !== "queued") { dot("bad"); stat("the live render failed - see the job log (Queue ▸ all)"); return null; }
      }
      return null;
    }
    function apply() {
      if (!L.result || L.resultFor !== docKey()) return say("⚡ live: nothing to apply yet");
      const Ly = E.makeLayer("⚡ Live: " + promptNow().slice(0, 28));
      E.ctx(Ly.canvas).drawImage(L.result, 0, 0);
      E.addLayer(Ly, "Live result", false);
      E.refresh(); E.renderLayersPanel();
      say("⚡ the live result is a new layer - hide (👁) or delete it like any layer");
      tev("ie_live_apply", Ly.name);
    }

    // the loop: a change -> a render a moment later; one at a time
    let timer = null;
    const prevPush = E.onPush;
    E.onPush = function (e) { if (prevPush) { try { prevPush.call(this, e); } catch (er) { /* theirs */ } } if (L.on) { L.dirty = true; L.changed = Date.now(); } };
    function tick() {
      if (!L.on) return;
      if (S.w && !S.stroke) {
        const fp = fingerprint(S, extra(), idOf);
        if (fp !== L.fp && !L.inflight && !L.dirty) { L.dirty = true; L.changed = Date.now(); }
        if (fp !== L.fpSeen) { L.fpSeen = fp; L.changed = Date.now(); }
      }
      const a = nextAction({ on: L.on, paused: L.paused, doc: !!S.w && !S.stroke, dirty: L.dirty, inflight: L.inflight, now: Date.now(), changed: L.changed });
      if (a === "run") render();
    }
    function setOn(on) {
      L.on = !!on;
      box.classList.toggle("off", !L.on);
      if (L.on) { paintStyles(); paintCtl(); place(); L.dirty = true; L.changed = 0; L.fp = ""; dot(""); stat(S.w ? "" : "open a picture - live renders it as you paint");
        if (!timer) timer = win.setInterval(tick, 250); say("⚡ live: paint - the AI renders the picture again as you go (one at a time, the newest change wins)"); }
      else { if (timer) { win.clearInterval(timer); timer = null; } if (S.preview && S.preview.__live) E.setPreview(null); say("⚡ live is off"); }
      paintCtl();
      tev("ie_live_on", L.on ? "1" : "0");
    }

    // the menu bar's ⚡ (beside ⛶) + View ▸ ⚡ Live Generation
    const full = $("kxFull");
    if (full && full.parentNode) {
      const b = doc.createElement("button"); b.className = "ghost"; b.id = "kxLive"; b.type = "button"; b.textContent = "⚡";
      b.onclick = () => setOn(!L.on);
      full.parentNode.insertBefore(b, full);
    }
    if (E.ui && E.ui.addCmd) E.ui.addCmd("view.live", "⚡ Live Generation", "", () => setOn(!L.on), { checked: () => L.on }, ["View", "view.full"]);
    paintCtl();
    E.live = { on: () => L.on, set: setOn, state: () => L, render, apply, clientId };
  }

  const PCLive = { MP_CHOICES, nextAction, liveSize, fingerprint, blendTo, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCLive;
  else root.PCLive = PCLive;
})(typeof window !== "undefined" ? window : globalThis);

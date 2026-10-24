/* pcuelive.js — 📺 THE UNREAL VIEW docker of the image editor (2.590.0), window.PCUELive.
 *
 * Tim (verbatim): "unreal connection works. do i have to keep the unreal window open? show the unreal window in timeline
 * and image-editor when selected" - picked: a live camera view.
 *   A docker (a tab - 📺 Unreal View - floating at first; drag it onto another docker to make it a tab there, pctabdock.js)
 *   that shows what the ACTIVE Unreal / MetaHuman layer's camera sees in Unreal, refreshed frame after frame
 *   (static/uelive.js -> /api/unreal/frame -> bitGen Bridge 1.5.0). It follows the layer's camera as the 🎥 camera tool /
 *   the 🎮 Unreal tab move it, its lens and its lights. Selecting an Unreal layer shows it (☑ auto); another layer stops
 *   it (and hides it again when it floats alone). The Unreal Editor must be running - it may be minimized or behind.
 * Pure (Node: scripts/test-uelive590.js): requestOf(layer, stillRequest, framing).
 */
(function (root) {
  "use strict";
  /** the active layer -> the live frame's request (null: not an Unreal / MetaHuman layer) */
  function requestOf(L, stillRequest, framing) {
    if (!L || !L.smart || !L.smart.ue || typeof stillRequest !== "function") return null;
    const o = stillRequest(L.smart.ue, framing);
    if (L.smart.ue.camera && L.smart.ue.camera.viewport && !(o.camera && o.camera.loc)) o.camera = { viewport: true, fov: o.camera && o.camera.fov };
    return o;
  }

  function install(E) {
    const { kx, doc, win, store } = E;
    if (!kx || !doc || !root.UELive) return;
    const ctl = kx.querySelector('.pcgrp .pctabs [data-tab="kxCtl"]'); if (!ctl) return;
    const tabs = ctl.parentElement, holder = tabs.parentElement;
    const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "kuelive"; b.dataset.grp = "props"; b.textContent = "📺 Unreal View";
    b.title = "What the selected Unreal / MetaHuman layer's camera sees in Unreal, live (drag this tab out to float it, onto a docker to tab it)";
    b.onclick = () => E.ui.showTab("kuelive");
    (tabs.querySelector('[data-tab="kuelights"]') || tabs.querySelector('[data-tab="kuecam"]') || tabs.querySelector('[data-tab="kue"]') || ctl).after(b);
    const body = doc.createElement("div"); body.className = "pcbody"; body.dataset.body = "kuelive"; body.id = "kueLiveBody"; holder.appendChild(body);
    body.innerHTML = '<label style="display:flex;gap:5px;align-items:center;font-size:11px;margin-bottom:4px;color:var(--pc-dim)"><input type="checkbox" id="kueLiveAuto"> show it when an Unreal layer is selected</label><div id="kueLiveView" style="height:calc(100% - 22px);min-height:160px"></div>';
    const css = doc.createElement("style"); css.textContent = "#kueLiveBody.on{display:flex!important;flex-direction:column;height:100%}#kueLiveBody #kueLiveView{flex:1 1 auto}";
    doc.head.appendChild(css);
    const auto = body.querySelector("#kueLiveAuto");
    auto.checked = store.get("uelive.auto", true) !== false;
    auto.onchange = () => store.set("uelive.auto", auto.checked);
    const P = () => root.PCUnreal, U = () => root.UEBridge;
    const req = () => requestOf(E.layer && E.layer(), P() && P().stillRequest, U() && U().framing);
    const V = root.UELive.view(body.querySelector("#kueLiveView"), { request: req });
    const visible = () => body.classList.contains("on") && body.offsetParent !== null;
    let lastL = null, wasUE = false, revealed = false;
    function tick() {
      const L = E.layer && E.layer(), ue = !!(L && L.smart && L.smart.ue);
      if (L !== lastL || ue !== wasUE) {
        lastL = L;
        if (ue && !wasUE && auto.checked && E.tabdock) {
          E.tabdock.reveal("kuelive"); revealed = true;
          // until it is dragged by hand it opens at the bottom right of the canvas (clear of the menus and tool bars)
          const g = E.tabdock.groupOfTab("kuelive"), st = E.stage && E.stage.getBoundingClientRect(), kr = kx.getBoundingClientRect();
          if (g && E.tabdock.floating(g) && store.get("uelive.autopos", true) !== false && st && st.width > 0) {
            const w = Math.min(420, Math.max(240, st.width * 0.45)), h = Math.round(w * 0.62) + 70;
            E.tabdock.setRect(g, { x: st.right - kr.left - w - 12, y: st.bottom - kr.top - h - 12, w, h });
          }
        }
        if (!ue && wasUE && revealed && E.tabdock) { const g = E.tabdock.groupOfTab("kuelive"); if (g && E.tabdock.floating(g) && E.tabdock.tabsIn(g).length === 1) E.tabdock.hideOf("kuelive"); revealed = false; }
        wasUE = ue;
      }
      const want = ue && visible();
      if (want && !V.running()) V.start(); else if (!want && V.running()) V.stop();
    }
    win.setInterval(tick, 400);
    if (E.tabdock && E.tabdock.onMoved) E.tabdock.onMoved((g) => { if (g === E.tabdock.groupOfTab("kuelive")) store.set("uelive.autopos", false); });
    E.uelive = { view: V, request: req, tick };
  }
  /** before pctabdock restores the kept layout: float the 📺 tab by default (once) */
  function placeFirst(E) {
    const b = E.kx && E.kx.querySelector('.pctabs [data-tab="kuelive"]'); if (b) b.dataset.tdhome = "float";   // Reset Docker Tabs floats it again
    if (!E.tabdock || E.store.get("uelive.placed", false)) return;
    const kept = E.store.get("pc.td", null);
    const inKept = kept && Array.isArray(kept.groups) && kept.groups.some((x) => (x.tabs || []).includes("kuelive"));
    if (!inKept) { const g = E.tabdock.floatTab("kuelive", { x: Math.max(0, (E.kx.clientWidth || 1000) - 520), y: 64, w: 480, h: 330 }); if (g) E.tabdock.hideOf("kuelive"); }
    E.store.set("uelive.placed", true);
  }

  const PCUELive = { requestOf, install, placeFirst };
  if (typeof module !== "undefined" && module.exports) module.exports = PCUELive;
  else root.PCUELive = PCUELive;
})(typeof window !== "undefined" ? window : globalThis);

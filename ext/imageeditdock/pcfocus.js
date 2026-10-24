/* pcfocus.js — 🎨 ARTIST MODE (2.588.0 "focus mode", renamed 2.590.0): the canvas alone, full screen, no frame, window.PCFocus.
 *
 * Tim (verbatim): "when in the image edit tab add a button in the menubar, this will make the canvas full screen and
 * frameless, nothing else but canvas will show, ctrl+p will show a color pallet, ctrl+b will show brush types and size.
 * ctrl+esc will go back to normal mode"
 *
 *   🎨 Artist mode (the menu bar, right after Help) / View ▸ Artist Mode / Ctrl+Shift+F   the whole screen is the canvas: bitGen's bars, the
 *                editor's menus, tools, panels, rulers, dockers and document tabs are all hidden (the browser goes full
 *                screen too). Painting, the brush keys ([ ]), zoom (wheel / Ctrl+-+), Space-pan, undo all work as before.
 *   Ctrl+P       the COLOUR PALETTE at the pointer: a hue strip + a saturation / brightness square (drag), the
 *                foreground / background colours (⇄ swaps), the hex value, the palette's chips and the recent colours
 *                (left click = foreground, right click = background). Ctrl+P / Esc / a click outside closes it.
 *   Ctrl+B       the BRUSHES at the pointer: every brush preset (click = paint with it) + size, opacity and flow.
 *   Ctrl+Esc     back to normal (Ctrl+Shift+F too - Windows keeps Ctrl+Esc for its Start menu on some keyboards).
 *                The browser's own Esc only leaves the browser's full screen - the canvas stays frameless until Ctrl+Esc.
 * Pure (Node: scripts/test-live588.js): keyAction, hsvToHex, hexToHsv, clampPop, RECENT_MAX.
 */
(function (root) {
  "use strict";
  const RECENT_MAX = 16;
  /** what a key press does in focus mode -> "palette" | "brushes" | "exit" | "close" | null */
  function keyAction(e, st) {
    const s = st || {};
    if (!s.on || !e) return null;
    const c = !!(e.ctrlKey || e.metaKey), k = String(e.key || "").toLowerCase(), code = String(e.code || "");
    if (c && (k === "escape" || code === "Escape")) return "exit";
    if (c && e.shiftKey && !e.altKey && (k === "f" || code === "KeyF")) return "exit";
    if (c && !e.shiftKey && !e.altKey && (k === "p" || code === "KeyP")) return "palette";
    if (c && !e.shiftKey && !e.altKey && (k === "b" || code === "KeyB")) return "brushes";
    if (!c && k === "escape" && s.pop) return "close";
    return null;
  }
  const h2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  function hsvToHex(h, s, v) {
    h = ((+h % 360) + 360) % 360; s = Math.max(0, Math.min(1, +s)); v = Math.max(0, Math.min(1, +v));
    const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return "#" + h2(f(5) * 255) + h2(f(3) * 255) + h2(f(1) * 255);
  }
  function hexToHsv(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); if (!m) return { h: 0, s: 0, v: 0 };
    const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: Math.round(((h * 60) + 360) % 360), s: mx ? d / mx : 0, v: mx };
  }
  /** a popup of w x h centred on the pointer, kept on screen */
  function clampPop(x, y, w, h, W, H) {
    return { x: Math.max(4, Math.min(W - w - 4, Math.round(x - w / 2))), y: Math.max(4, Math.min(H - h - 4, Math.round(y - h / 2))) };
  }

  function install(E) {
    const { S, doc, win, store, kx, B } = E;
    if (!kx || !doc) return;
    const say = E.say || (() => {});
    const $ = E.$;
    const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    if (!doc.getElementById("pcFocusCss")) {
      const st = doc.createElement("style"); st.id = "pcFocusCss";
      st.textContent = `body.ie-focus #imageeditdock:not(.dockgone){position:fixed!important;left:0!important;top:0!important;right:0!important;bottom:0!important;width:auto!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;z-index:2147483000!important;display:flex!important;flex-direction:column;background:var(--pc-stage,#1e1e1e)}
body.ie-focus .pcfocus-hide{display:none!important}
body.ie-focus .pcfocus-chain{flex:1 1 auto!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;transform:none!important;display:flex!important;flex-direction:column}
body.ie-focus .pcfocus-chain:not(.kxstage){position:relative!important;left:0!important;top:0!important}
body.ie-focus .kxstage.pcfocus-chain{display:block!important}
body.ie-focus .kxstage .pcruler,body.ie-focus .kxstage .kxhint{display:none!important}
.pcfocuspop{position:fixed;z-index:2147483600;background:var(--pc-panel,#2d2d2d);color:var(--pc-text,#ddd);border:1px solid var(--pc-sep,#555);border-radius:10px;box-shadow:0 10px 34px rgba(0,0,0,.6);font:12px system-ui,sans-serif;padding:8px;user-select:none}
.pcfocuspop .fph{display:flex;align-items:center;gap:6px;margin-bottom:6px}.pcfocuspop .fph b{flex:1}.pcfocuspop .k{color:var(--pc-dim,#999);font-size:11px}
.pcfocuspop button{background:none;border:1px solid var(--pc-sep,#555);color:inherit;border-radius:5px;padding:2px 7px;cursor:pointer;font:inherit}
.pcfocuspop button:hover{background:var(--pc-hover,#454545)}.pcfocuspop button.on{outline:2px solid var(--pc-accent,#2680eb)}
.pcfocuspop .fsv{display:block;cursor:crosshair;border-radius:4px}.pcfocuspop .fhue{display:block;cursor:ew-resize;margin-top:6px;border-radius:3px}
.pcfocuspop .fcol{display:flex;gap:6px;align-items:center;margin-top:6px}.pcfocuspop .fsw{width:28px;height:28px;border-radius:5px;border:1px solid #000;box-shadow:0 0 0 1px #777;cursor:pointer}
.pcfocuspop input[type=text]{width:72px;background:var(--pc-input,#1d1d1d);color:inherit;border:1px solid var(--pc-sep,#555);border-radius:4px;font:11px monospace;padding:2px 4px}
.pcfocuspop .fchips{display:grid;grid-template-columns:repeat(12,16px);gap:3px;margin-top:6px}.pcfocuspop .fchips i{width:16px;height:16px;border-radius:3px;cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.5)}
.pcfocuspop .fbr{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;max-height:260px;overflow:auto}.pcfocuspop .fbr button{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 2px;min-width:0}
.pcfocuspop .fbr button span:first-child{font-size:18px;line-height:20px}.pcfocuspop .fbr button span:last-child{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.pcfocuspop .frow{display:grid;grid-template-columns:56px 1fr 42px;gap:6px;align-items:center;margin-top:6px}.pcfocuspop .frow input[type=range]{width:100%}`;
      doc.head.appendChild(st);
    }
    let on = false, pop = null, popKind = "", px = (win.innerWidth || 800) / 2, py = (win.innerHeight || 600) / 2, marked = [], fsOurs = false;
    doc.addEventListener("pointermove", (e) => { px = e.clientX; py = e.clientY; }, true);

    /* ---------------- on / off */
    function markChain() {
      unmark();
      const dock = doc.getElementById("imageeditdock");
      let n = E.stage;
      while (n && n.parentNode && n !== dock && n !== doc.body) {
        n.classList.add("pcfocus-chain"); marked.push([n, "pcfocus-chain"]);
        for (const sib of n.parentNode.children) if (sib !== n && !sib.classList.contains("pcfocuspop") && sib.tagName !== "STYLE" && sib.tagName !== "SCRIPT") { sib.classList.add("pcfocus-hide"); marked.push([sib, "pcfocus-hide"]); }
        n = n.parentNode;
      }
    }
    function unmark() { for (const [el, c] of marked) el.classList.remove(c); marked = []; }
    function setFocus(v) {
      v = !!v;
      if (v === on) return;
      on = v;
      closePop();
      if (on) {
        const dk = doc.getElementById("imageeditdock");
        if (dk && dk.classList.contains("collapsed") && typeof win.toggleCollapse === "function") win.toggleCollapse("imageeditdock");
        if (E.setFull && doc.body.classList.contains("ie-full")) E.setFull(false);
        markChain();
        doc.body.classList.add("ie-focus");
        const de = doc.documentElement;
        if (!doc.fullscreenElement && de.requestFullscreen) { try { de.requestFullscreen().then(() => { fsOurs = true; }, () => { fsOurs = false; }); } catch (e) { /* jsdom */ } }
        try { E.stage.focus({ preventScroll: true }); } catch (e) { /* fine */ }
        say("🎨 artist mode - Ctrl+P colours, Ctrl+B brushes, Ctrl+Esc back");
      } else {
        doc.body.classList.remove("ie-focus");
        unmark();
        if (doc.fullscreenElement && fsOurs && doc.exitFullscreen) { try { doc.exitFullscreen().catch(() => {}); } catch (e) { /* jsdom */ } }
        fsOurs = false;
      }
      const b = $("kxFocus"); if (b) b.classList.toggle("on", on);
      win.setTimeout(() => { if (S.w && E.fitView) E.fitView(); try { win.dispatchEvent(new win.Event("resize")); } catch (e) { /* jsdom */ } }, 120);
      tev("ie_focus", on ? "1" : "0");
    }
    doc.addEventListener("fullscreenchange", () => { if (!doc.fullscreenElement) fsOurs = false; win.setTimeout(() => { if (on && S.w && E.fitView) E.fitView(); }, 120); });

    /* ---------------- the popups */
    function closePop() { if (pop) { pop.remove(); pop = null; popKind = ""; } }
    function openAt(el, kind) {
      closePop();
      el.className = "pcfocuspop"; el.dataset.kind = kind; el.id = kind === "palette" ? "pcFocusPal" : "pcFocusBr";
      doc.body.appendChild(el); pop = el; popKind = kind;
      const r = el.getBoundingClientRect(), p = clampPop(px, py, r.width || 240, r.height || 260, win.innerWidth || 800, win.innerHeight || 600);
      el.style.left = p.x + "px"; el.style.top = p.y + "px";
      el.addEventListener("keydown", (e) => { if (e.key !== "Escape" && !(e.ctrlKey || e.metaKey)) e.stopPropagation(); });
      el.addEventListener("contextmenu", (e) => e.preventDefault());
      tev("ie_focus_pop", kind);
    }
    doc.addEventListener("pointerdown", (e) => { if (pop && !pop.contains(e.target)) closePop(); }, true);

    const recent = () => store.get("focus.recent", []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
    function remember(c) { const l = recent().filter((x) => x.toLowerCase() !== c.toLowerCase()); l.unshift(c); store.set("focus.recent", l.slice(0, RECENT_MAX)); }
    function setColor(c, bg) {
      if (!/^#[0-9a-f]{6}$/i.test(c)) return;
      if (bg) { if (E.setBg) E.setBg(c); } else { if (E.setFg) E.setFg(c); else S.fg = c; }
      remember(c);
    }
    function palette() {
      const el = doc.createElement("div");
      const SV = 196, HUE = 196;
      let hsv = hexToHsv(S.fg || "#000000");
      const chips = (() => { let a = []; try { a = E.palette && E.palette.colours ? E.palette.colours() : []; } catch (e) { a = []; }
        if (!a || !a.length) a = (root.PCPalette && root.PCPalette.DEFAULT) || []; return a.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 48); })();
      el.innerHTML = `<div class="fph"><b>🎨 Colour</b><span class="k">Ctrl+P / Esc closes · right click = background</span></div>
        <canvas class="fsv" width="${SV}" height="${SV}"></canvas><canvas class="fhue" width="${HUE}" height="14"></canvas>
        <div class="fcol"><span class="fsw" data-w="fg" title="Foreground"></span><span class="fsw" data-w="bg" title="Background (click = make it the foreground)"></span>
          <button type="button" data-a="swap" title="Swap (X)">⇄</button><input type="text" data-a="hex" maxlength="7" spellcheck="false" title="The foreground colour (#rrggbb)"></div>
        <div class="fchips" data-a="chips">${chips.map((c) => `<i style="background:${c}" data-c="${c}" title="${c}"></i>`).join("")}</div>
        ${recent().length ? `<div class="k" style="margin-top:6px">recent</div><div class="fchips" data-a="recent">${recent().map((c) => `<i style="background:${c}" data-c="${c}" title="${c}"></i>`).join("")}</div>` : ""}`;
      openAt(el, "palette");
      const sv = el.querySelector(".fsv"), hue = el.querySelector(".fhue"), g = sv.getContext("2d"), hg = hue.getContext("2d");
      function draw() {
        if (!g || !hg) return;
        g.fillStyle = hsvToHex(hsv.h, 1, 1); g.fillRect(0, 0, SV, SV);
        let gr = g.createLinearGradient(0, 0, SV, 0); gr.addColorStop(0, "#fff"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, SV, SV);
        gr = g.createLinearGradient(0, 0, 0, SV); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.fillRect(0, 0, SV, SV);
        g.strokeStyle = hsv.v > 0.5 ? "#000" : "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(hsv.s * SV, (1 - hsv.v) * SV, 6, 0, Math.PI * 2); g.stroke();
        for (let x = 0; x < HUE; x++) { hg.fillStyle = hsvToHex(x / HUE * 360, 1, 1); hg.fillRect(x, 0, 1, 14); }
        hg.fillStyle = "#fff"; hg.fillRect(Math.round(hsv.h / 360 * HUE) - 1, 0, 3, 14);
      }
      function paintSw() {
        el.querySelector('[data-w="fg"]').style.background = S.fg || "#000"; el.querySelector('[data-w="bg"]').style.background = S.bg || "#fff";
        const hx = el.querySelector('[data-a="hex"]'); if (doc.activeElement !== hx) hx.value = S.fg || "";
      }
      const pick = (bg) => { const c = hsvToHex(hsv.h, hsv.s, hsv.v); if (bg) { if (E.setBg) E.setBg(c); } else if (E.setFg) E.setFg(c); paintSw(); draw(); };
      const drag = (cv, fn) => cv.addEventListener("pointerdown", (e) => {
        e.preventDefault(); const bg = e.button === 2;
        const mv = (ev) => { const r = cv.getBoundingClientRect(); fn((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height); pick(bg); };
        const up = () => { win.removeEventListener("pointermove", mv); win.removeEventListener("pointerup", up); remember(bg ? S.bg : S.fg); };
        mv(e); win.addEventListener("pointermove", mv); win.addEventListener("pointerup", up);
      });
      drag(sv, (x, y) => { hsv.s = Math.max(0, Math.min(1, x)); hsv.v = Math.max(0, Math.min(1, 1 - y)); });
      drag(hue, (x) => { hsv.h = Math.max(0, Math.min(359, x * 360)); });
      el.addEventListener("pointerdown", (e) => {
        const c = e.target.dataset && e.target.dataset.c;
        if (c) { e.preventDefault(); setColor(c, e.button === 2); hsv = hexToHsv(S.fg); paintSw(); draw(); return; }
        if (e.target.dataset && e.target.dataset.w === "bg") { setColor(S.bg, false); hsv = hexToHsv(S.fg); paintSw(); draw(); }
      });
      el.querySelector('[data-a="swap"]').onclick = () => { const f = S.fg, b = S.bg; if (E.swapColors) E.swapColors(); else { E.setFg(b); E.setBg(f); } hsv = hexToHsv(S.fg); paintSw(); draw(); };
      el.querySelector('[data-a="hex"]').addEventListener("change", (e) => { let v = e.target.value.trim(); if (!v.startsWith("#")) v = "#" + v; if (/^#[0-9a-f]{6}$/i.test(v)) { setColor(v, false); hsv = hexToHsv(v); paintSw(); draw(); } });
      draw(); paintSw();
    }
    function brushes() {
      const el = doc.createElement("div");
      const P = (B && B.PRESETS) || [];
      el.innerHTML = `<div class="fph"><b>🖌 Brushes</b><span class="k">Ctrl+B / Esc closes</span></div>
        <div class="fbr">${P.map((p) => `<button type="button" data-p="${esc(p.id)}" title="${esc(p.name)}"${p.id === S.preset && (S.tool === "paint" || S.tool === "erase") ? ' class="on"' : ""}><span>${esc(p.icon || "●")}</span><span>${esc(p.name)}</span></button>`).join("")}</div>
        <div class="frow"><label>size</label><input type="range" data-a="size" min="1" max="600"><span data-v="size"></span></div>
        <div class="frow"><label>opacity</label><input type="range" data-a="opacity" min="1" max="100"><span data-v="opacity"></span></div>
        <div class="frow"><label>flow</label><input type="range" data-a="flow" min="1" max="100"><span data-v="flow"></span></div>`;
      openAt(el, "brushes");
      const paint = () => {
        el.querySelector('[data-a="size"]').value = Math.round(S.size); el.querySelector('[data-v="size"]').textContent = Math.round(S.size) + " px";
        el.querySelector('[data-a="opacity"]').value = Math.round((S.opacity || 1) * 100); el.querySelector('[data-v="opacity"]').textContent = Math.round((S.opacity || 1) * 100) + "%";
        el.querySelector('[data-a="flow"]').value = Math.round((S.flow || 1) * 100); el.querySelector('[data-v="flow"]').textContent = Math.round((S.flow || 1) * 100) + "%";
        el.querySelectorAll("[data-p]").forEach((b) => b.classList.toggle("on", b.dataset.p === S.preset && (S.tool === "paint" || S.tool === "erase")));
      };
      el.querySelector(".fbr").onclick = (e) => {
        const b = e.target.closest("[data-p]"); if (!b) return;
        if (E.choosePreset) E.choosePreset(b.dataset.p);
        if (E.renderOptions) E.renderOptions();
        paint(); tev("ie_focus_brush", b.dataset.p);
      };
      el.querySelector('[data-a="size"]').oninput = (e) => { if (E.setSize) E.setSize(+e.target.value); else S.size = +e.target.value; if (E.renderOptions) E.renderOptions(); paint(); };
      const frac = (k) => (e) => { S[k] = Math.max(0.01, Math.min(1, +e.target.value / 100)); store.set(k + "." + S.preset, S[k]); if (E.renderOptions) E.renderOptions(); paint(); };
      el.querySelector('[data-a="opacity"]').oninput = frac("opacity");
      el.querySelector('[data-a="flow"]').oninput = frac("flow");
      paint();
    }
    function toggle(kind) { if (pop && popKind === kind) closePop(); else if (kind === "palette") palette(); else brushes(); }

    // the keys - first, before the editor and the browser (Ctrl+P = print, Ctrl+B = bookmarks otherwise)
    doc.addEventListener("keydown", (e) => {
      const a = keyAction(e, { on, pop: !!pop });
      if (!a) return;
      const t = e.target, tag = (t && t.tagName) || "";
      if (a !== "exit" && a !== "close" && /INPUT|TEXTAREA|SELECT/.test(tag) && t.type !== "range" && !(pop && pop.contains(t))) return;
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (a === "exit") setFocus(false);
      else if (a === "close") closePop();
      else toggle(a);
    }, true);

    // 2.590.0 (Tim: "i can't find the full screen canvas button (lets call the full screen canvas button artist mode)"):
    // 🎨 ARTIST MODE - a labelled button right after the menus (File … Help), where it is always seen (the ⛶ group on the
    // right is cut off when the editor is narrow - the menu bar now wraps onto a second line instead) + View ▸ Artist Mode (Ctrl+Shift+F)
    const menus = $("pcMenus"), full = $("kxFull");
    if ((menus && menus.parentNode) || (full && full.parentNode)) {
      const b = doc.createElement("button"); b.className = "ghost pcartist"; b.id = "kxFocus"; b.type = "button"; b.innerHTML = "🎨 <span>Artist mode</span>";
      b.title = "Artist mode - only the canvas, full screen, no frame (Ctrl+Shift+F). Ctrl+P colours · Ctrl+B brushes · Ctrl+Esc back";
      b.onclick = () => setFocus(!on);
      if (menus && menus.parentNode) menus.after(b); else full.parentNode.insertBefore(b, full);
      if (!doc.getElementById("pcArtistCss")) { const st = doc.createElement("style"); st.id = "pcArtistCss"; st.textContent = ".pcmenu .pcartist{margin-left:8px;flex:none;white-space:nowrap;border:1px solid var(--pc-accent,#2680eb)!important;border-radius:4px;padding:1px 8px!important;font-size:11px;color:var(--pc-text,#ddd)}.pcmenu .pcartist:hover,.pcmenu .pcartist.on{background:var(--pc-accent,#2680eb);color:#fff}.kx .pcmenu{flex-wrap:wrap;height:auto!important;min-height:26px}.kx[data-theme=bitgen] .pcmenu{min-height:var(--mbar,36px)}.kx .pcmenu .mr{flex-wrap:wrap;justify-content:flex-end}"; doc.head.appendChild(st); }
    }
    if (E.ui && E.ui.addCmd) E.ui.addCmd("view.focus", "🎨 Artist Mode (canvas only)", "Shift+Ctrl+F", () => setFocus(!on), { checked: () => on }, ["View", "view.full"]);
    E.focus = { on: () => on, set: setFocus, palette: () => toggle("palette"), brushes: () => toggle("brushes"), close: closePop, pop: () => popKind };
  }

  const PCFocus = { RECENT_MAX, keyAction, hsvToHex, hexToHsv, clampPop, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCFocus;
  else root.PCFocus = PCFocus;
})(typeof window !== "undefined" ? window : globalThis);

/* pcgrad.js — THE GRADIENT EDITOR: gradients with many colour stops, each with its own opacity (2.434.0),
 * window.PCGrad.
 *
 * Tim (verbatim, the 2.430.0 message): "add anything else in our gap list that will fit this turn" - the gap list's
 * "Gradient editor with many stops" (docs/PHOTOSHOP-GAP.md).
 *
 *   A GRADIENT       {name, stops: [{t 0..1, c "#rrggbb" | "fg" | "bg", a 0..1}]} - "fg" / "bg" = the foreground /
 *                    background colour when it is used (the presets Foreground to Background ... follow the swatches).
 *   THE EDITOR       Photoshop's Gradient Editor: the presets (and yours - New saves one, right-click deletes it),
 *                    the name, the bar - click under it = a new stop (the colour there), drag a stop = move it, drag it
 *                    down off the bar = delete it (2 stay at least); the picked stop's Colour / Opacity / Location;
 *                    Delete, Reverse, Distribute evenly; OK / Cancel.
 *   USED BY          the Gradient tool (its gradient button / Colours: Custom), the Paint Bucket's gradient, a Gradient
 *                    fill layer (Properties ▸ Edit…), a vector shape's gradient fill (Object Properties ▸ Edit… - kept
 *                    in its SVG too), Edit ▸ Gradient Editor….
 *
 * Pure (Node: scripts/test-psgrad.js): PRESETS, norm, resolve, colorAt, addStop, removeStop, moveStop, reverse,
 * distribute, toCanvas (canvas colour stops), toCss, svgStops, fromTwo (c1 / c2 -> a gradient).
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
  const clamp01 = (v) => Math.max(0, Math.min(1, +v || 0));
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const hexRgb = (h) => { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const S = (t, c, a) => ({ t, c, a: a == null ? 1 : a });
  const PRESETS = [
    { name: "Foreground to Background", stops: [S(0, "fg"), S(1, "bg")] },
    { name: "Foreground to Transparent", stops: [S(0, "fg"), S(1, "fg", 0)] },
    { name: "Black, White", stops: [S(0, "#000000"), S(1, "#ffffff")] },
    { name: "Spectrum", stops: ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"].map((c, i, a) => S(r4(i / (a.length - 1)), c)) },
    { name: "Transparent Rainbow", stops: [S(0, "#ff0000", 0), S(0.15, "#ff0000"), S(0.3, "#ffff00"), S(0.5, "#00ff00"), S(0.7, "#0000ff"), S(0.85, "#ff00ff"), S(1, "#ff00ff", 0)] },
    { name: "Chrome", stops: [S(0, "#29abe2"), S(0.5, "#ffffff"), S(0.51, "#8c6239"), S(0.7, "#c69c6d"), S(1, "#ffffff")] },
    { name: "Copper", stops: [S(0, "#97461a"), S(0.3, "#fbd8c5"), S(0.65, "#6c2e16"), S(1, "#efdbcd")] },
    { name: "Gold", stops: [S(0, "#7a5a0c"), S(0.35, "#f8e27a"), S(0.6, "#b88a1b"), S(1, "#fff2b0")] },
    { name: "Sunset", stops: [S(0, "#2d0b59"), S(0.45, "#c2185b"), S(0.75, "#ff7043"), S(1, "#ffd54f")] },
    { name: "Violet, Orange", stops: [S(0, "#290a59"), S(1, "#ff7c00")] },
    { name: "Blue, Red, Yellow", stops: [S(0, "#0a00b2"), S(0.5, "#ff0000"), S(1, "#fffc00")] },
    { name: "Transparent Stripes", stops: [S(0, "#000000"), S(0.2, "#000000"), S(0.2001, "#000000", 0), S(0.4, "#000000", 0), S(0.4001, "#000000"), S(0.6, "#000000"), S(0.6001, "#000000", 0), S(0.8, "#000000", 0), S(0.8001, "#000000"), S(1, "#000000")] },
  ];
  /** a clean gradient: 2+ stops, sorted, 0..1, colours hex / fg / bg, opacity 0..1 */
  function norm(g) {
    const o = g && typeof g === "object" ? g : {};
    let st = (Array.isArray(o.stops) ? o.stops : []).map((s) => ({ t: r4(clamp01(s && s.t)), c: s && (isHex(s.c) ? s.c.toLowerCase() : s.c === "fg" || s.c === "bg" ? s.c : "#000000"), a: r4(s && s.a != null ? clamp01(s.a) : 1) }));
    st.sort((p, q) => p.t - q.t);
    if (!st.length) st = [S(0, "#000000"), S(1, "#ffffff")];
    if (st.length === 1) st.push(Object.assign({}, st[0], { t: st[0].t < 1 ? 1 : 0 })), st.sort((p, q) => p.t - q.t);
    return { name: typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 60) : "Custom", stops: st };
  }
  /** "fg" / "bg" -> the colours */
  function resolve(g, fg, bg) {
    const n = norm(g);
    return { name: n.name, stops: n.stops.map((s) => ({ t: s.t, c: s.c === "fg" ? (isHex(fg) ? fg.toLowerCase() : "#000000") : s.c === "bg" ? (isHex(bg) ? bg.toLowerCase() : "#ffffff") : s.c, a: s.a })) };
  }
  /** the colour + opacity at t (between the stops on each side, linear) */
  function colorAt(g, t, fg, bg) {
    const st = resolve(g, fg, bg).stops; t = clamp01(t);
    if (t <= st[0].t) return { c: st[0].c, a: st[0].a };
    if (t >= st[st.length - 1].t) { const l = st[st.length - 1]; return { c: l.c, a: l.a }; }
    let i = 0; while (i < st.length - 1 && st[i + 1].t < t) i++;
    const p = st[i], q = st[i + 1], k = q.t > p.t ? (t - p.t) / (q.t - p.t) : 0;
    const A = hexRgb(p.c), B = hexRgb(q.c);
    return { c: rgbHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k), a: r4(p.a + (q.a - p.a) * k) };
  }
  /** a new stop at t with the colour there (or the one given); -> {g, i} */
  function addStop(g, t, c, a, fg, bg) {
    const n = norm(g), at = colorAt(n, t, fg, bg);
    n.stops.push({ t: r4(clamp01(t)), c: isHex(c) ? c.toLowerCase() : at.c, a: a != null ? r4(clamp01(a)) : at.a });
    const s = n.stops[n.stops.length - 1];
    n.stops.sort((p, q) => p.t - q.t);
    return { g: n, i: n.stops.indexOf(s) };
  }
  function removeStop(g, i) { const n = norm(g); if (n.stops.length <= 2 || !(i >= 0 && i < n.stops.length)) return n; n.stops.splice(i, 1); return n; }
  /** stop i to t (kept sorted); -> {g, i (where it is now)} */
  function moveStop(g, i, t) {
    const n = norm(g); if (!(i >= 0 && i < n.stops.length)) return { g: n, i };
    const s = n.stops[i]; s.t = r4(clamp01(t)); n.stops.sort((p, q) => p.t - q.t);
    return { g: n, i: n.stops.indexOf(s) };
  }
  function reverse(g) { const n = norm(g); n.stops = n.stops.map((s) => Object.assign({}, s, { t: r4(1 - s.t) })).sort((p, q) => p.t - q.t); return n; }
  function distribute(g) { const n = norm(g), k = n.stops.length - 1; n.stops.forEach((s, i) => { s.t = r4(i / k); }); return n; }
  /** canvas colour stops [[t, "rgba(r,g,b,a)"]] */
  function toCanvas(g, fg, bg) { return resolve(g, fg, bg).stops.map((s) => [s.t, `rgba(${hexRgb(s.c).join(",")},${s.a})`]); }
  /** a CSS linear-gradient (left -> right) over a checkerboard, for the bar / the buttons */
  function toCss(g, fg, bg) {
    return "linear-gradient(90deg," + toCanvas(g, fg, bg).map(([t, c]) => `${c} ${Math.round(t * 1000) / 10}%`).join(",") + "),repeating-conic-gradient(#bbb 0 25%,#fff 0 50%) 0 0/10px 10px";
  }
  /** SVG <stop>s */
  function svgStops(g, fg, bg) { return resolve(g, fg, bg).stops.map((s) => `<stop offset="${s.t}" stop-color="${s.c}"${s.a < 1 ? ` stop-opacity="${s.a}"` : ""}/>`).join(""); }
  /** the older two-colour form (c1 / c2) as a gradient */
  function fromTwo(c1, c2) { return norm({ name: "Custom", stops: [S(0, isHex(c1) ? c1 : "#000000"), S(1, isHex(c2) ? c2 : "#ffffff")] }); }

  /* ================================ the page ================================ */
  function install(E) {
    const { S: St, doc, kx, say, store } = E;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!doc.getElementById("pcgradCss")) {
      const st = doc.createElement("style"); st.id = "pcgradCss";
      st.textContent = ".kx .gedlg .gpre{display:grid;grid-template-columns:repeat(auto-fill,34px);gap:4px;max-height:118px;overflow:auto;margin:0 0 8px}"
        + ".kx .gedlg .gpre button{width:34px;height:24px;min-width:0;min-height:0;padding:0;border:1px solid var(--pc-line);border-radius:3px;cursor:pointer}.kx .gedlg .gpre button.on{outline:2px solid var(--pc-accent)}"
        + ".kx .gedlg .gbar{position:relative;height:28px;border:1px solid var(--pc-line);border-radius:3px;margin:6px 8px 0;cursor:copy}"
        + ".kx .gedlg .gstops{position:relative;height:22px;margin:0 8px 6px;cursor:copy}"
        + ".kx .gedlg .gst{position:absolute;top:2px;width:12px;height:16px;margin-left:-6px;border:1px solid #000;box-shadow:0 0 0 1px #fff;border-radius:2px 2px 3px 3px;cursor:ew-resize;touch-action:none}"
        + ".kx .gedlg .gst::before{content:'';position:absolute;left:3px;top:-6px;border:3px solid transparent;border-bottom:4px solid #fff}.kx .gedlg .gst.on{box-shadow:0 0 0 2px var(--pc-accent)}"
        + ".kx .gedlg .grw{display:flex;gap:6px;align-items:center;margin:4px 8px;color:var(--pc-dim);flex-wrap:wrap}.kx .gedlg .grw input[type=number]{width:58px}"
        + ".kx .ptgbtn{width:72px;height:18px;min-width:0;padding:0;border:1px solid var(--pc-line);border-radius:3px;cursor:pointer;vertical-align:middle}";
      doc.head.appendChild(st);
    }
    const mine = () => (store.get("grad.mine", []) || []).map(norm);
    /** the Gradient Editor: g (a gradient) -> onOk(gradient); {title} */
    function edit(g0, onOk, opts) {
      const o = opts || {};
      let g = norm(g0 || PRESETS[0]), sel = 0;
      const pres = () => PRESETS.map((p, i) => ({ p, k: "p" + i })).concat(mine().map((p, i) => ({ p, k: "m" + i })));
      const d = E.ui.dialog(o.title || "Gradient Editor", `<div class="gedlg">
        <div class="gpre" id="geP"></div>
        <div class="grw"><span>Name</span><input type="text" id="geName" style="flex:1;min-width:0"><button class="ghost" id="geNew" title="Keep it among the presets (right-click one of yours deletes it)">New</button></div>
        <div class="gbar" id="geBar" title="Click under the bar for a new stop"></div><div class="gstops" id="geStops" title="Click: a new stop · drag a stop: move it · drag it down off the bar: delete it"></div>
        <div class="grw"><span>Colour</span><input type="color" id="geC"><label><input type="checkbox" id="geFg"> foreground</label><label><input type="checkbox" id="geBg"> background</label></div>
        <div class="grw"><span>Opacity</span><input type="number" id="geA" min="0" max="100" step="1"> %<span>Location</span><input type="number" id="geT" min="0" max="100" step="0.5"> %<button class="ghost" id="geDel" title="Delete the picked stop">Delete</button></div>
        <div class="grw"><button class="ghost" id="geRev">⇄ Reverse</button><button class="ghost" id="geDist">Distribute evenly</button><span id="geN" style="margin-left:auto"></span></div></div>`,
      () => { if (onOk) onOk(norm(Object.assign({}, g, { name: (d.querySelector("#geName").value || g.name) }))); }, { wide: true, okLabel: "OK" });
      d.classList.add("gedlg-host");
      const q = (id) => d.querySelector("#" + id);
      function paintPresets() {
        q("geP").innerHTML = pres().map(({ p, k }) => `<button type="button" data-pk="${k}" title="${esc(p.name)}${k[0] === "m" ? " (yours - right-click deletes it)" : ""}" style="background:${toCss(p, St.fg, St.bg)}"></button>`).join("");
        q("geP").querySelectorAll("[data-pk]").forEach((b) => {
          b.onclick = () => { const k = b.dataset.pk, p = k[0] === "p" ? PRESETS[+k.slice(1)] : mine()[+k.slice(1)]; g = norm(JSON.parse(JSON.stringify(p))); sel = 0; paint(); };
          b.oncontextmenu = (e) => { e.preventDefault(); const k = b.dataset.pk; if (k[0] !== "m") return; const m = store.get("grad.mine", []) || []; m.splice(+k.slice(1), 1); store.set("grad.mine", m); paintPresets(); };
        });
      }
      function paint() {
        q("geName").value = g.name;
        q("geBar").style.background = toCss(g, St.fg, St.bg);
        const R = resolve(g, St.fg, St.bg).stops;
        q("geStops").innerHTML = R.map((s, i) => `<div class="gst${i === sel ? " on" : ""}" data-si="${i}" style="left:${s.t * 100}%;background:${s.c};opacity:${0.35 + 0.65 * s.a}" title="${Math.round(s.t * 1000) / 10}% · ${g.stops[i].c} · ${Math.round(s.a * 100)}%"></div>`).join("");
        const s = g.stops[sel] || g.stops[0];
        q("geC").value = s.c === "fg" ? St.fg : s.c === "bg" ? St.bg : s.c;
        q("geFg").checked = s.c === "fg"; q("geBg").checked = s.c === "bg";
        q("geA").value = Math.round(s.a * 100); q("geT").value = Math.round(s.t * 1000) / 10;
        q("geDel").disabled = g.stops.length <= 2;
        q("geN").textContent = g.stops.length + " stops";
        q("geStops").querySelectorAll(".gst").forEach((el) => wireStop(el));
      }
      const tOf = (x) => { const r = q("geBar").getBoundingClientRect(); return clamp01((x - r.left) / Math.max(1, r.width)); };
      function wireStop(el) {
        el.addEventListener("pointerdown", (e) => {
          e.preventDefault(); e.stopPropagation();
          let i = +el.dataset.si; sel = i; let gone = false;
          const y0 = e.clientY;
          el.setPointerCapture && el.setPointerCapture(e.pointerId);
          q("geStops").querySelectorAll(".gst").forEach((x) => x.classList.toggle("on", +x.dataset.si === i));
          const mv = (ev) => {
            gone = ev.clientY - y0 > 40 && g.stops.length > 2;
            el.style.opacity = gone ? "0.2" : "";
            const m = moveStop(g, i, tOf(ev.clientX)); g = m.g; i = m.i; sel = i;
            el.style.left = (g.stops[i].t * 100) + "%"; el.dataset.si = i;
            q("geBar").style.background = toCss(g, St.fg, St.bg); q("geT").value = Math.round(g.stops[i].t * 1000) / 10;
          };
          const up = () => {
            el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
            if (gone) { g = removeStop(g, i); sel = Math.max(0, Math.min(i, g.stops.length - 1)); }
            paint();
          };
          el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
        });
      }
      const addAt = (e) => { if (e.target.closest && e.target.closest(".gst")) return; const r = addStop(g, tOf(e.clientX), null, null, St.fg, St.bg); g = r.g; sel = r.i; paint(); };
      q("geStops").addEventListener("pointerdown", addAt); q("geBar").addEventListener("pointerdown", addAt);
      const setStop = (f) => { const s = g.stops[sel]; if (!s) return; f(s); paint(); };
      q("geC").oninput = () => setStop((s) => { s.c = q("geC").value.toLowerCase(); });
      q("geFg").onchange = () => setStop((s) => { s.c = q("geFg").checked ? "fg" : (St.fg || "#000000"); });
      q("geBg").onchange = () => setStop((s) => { s.c = q("geBg").checked ? "bg" : (St.bg || "#ffffff"); });
      q("geA").onchange = () => setStop((s) => { s.a = clamp01((+q("geA").value || 0) / 100); });
      q("geT").onchange = () => { const m = moveStop(g, sel, (+q("geT").value || 0) / 100); g = m.g; sel = m.i; paint(); };
      q("geDel").onclick = () => { g = removeStop(g, sel); sel = Math.max(0, Math.min(sel, g.stops.length - 1)); paint(); };
      q("geRev").onclick = () => { g = reverse(g); sel = g.stops.length - 1 - sel; paint(); };
      q("geDist").onclick = () => { g = distribute(g); paint(); };
      q("geName").onchange = () => { g.name = q("geName").value.trim() || g.name; };
      q("geName").onkeydown = (e) => e.stopPropagation();
      q("geNew").onclick = () => { const m = store.get("grad.mine", []) || []; m.push(norm(Object.assign({}, g, { name: q("geName").value || g.name }))); store.set("grad.mine", m.slice(-60)); paintPresets(); say("kept among the presets"); };
      paintPresets(); paint();
      E.gradDlg = { get: () => norm(g), sel: () => sel, set: (x) => { g = norm(x); sel = 0; paint(); } };
      return d;
    }
    E.gradEdit = edit;
    /** the Gradient tool's gradient (custom), kept */
    St.gradCustom = norm(store.get("grad.tool", null) || PRESETS[0]);
    E.gradToolEdit = () => edit(St.gradCustom, (g) => { St.gradCustom = g; store.set("grad.tool", g); St.gradKind = "custom"; store.set("t.gkind", "custom"); E.renderOptions(); }, { title: "Gradient Editor - the Gradient tool / Paint Bucket" });
    E.ui.addCmd("edit.gradient", "Gradient Editor…", "", () => E.gradToolEdit(), {}, ["Edit", "edit.stroke"]);
  }

  const PCGrad = { PRESETS, norm, resolve, colorAt, addStop, removeStop, moveStop, reverse, distribute, toCanvas, toCss, svgStops, fromTwo, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCGrad;
  else root.PCGrad = PCGrad;
})(typeof window !== "undefined" ? window : globalThis);

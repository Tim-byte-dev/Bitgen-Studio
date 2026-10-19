/* pcsketchcadui.js — SKETCH LAYERS' measuring + CAD files in the editor (2.464.0), window.PCSketchCADUI.
 * The pure part is pcsketchcad.js (PCSketchCAD); the sketch tools are pcsketchtools.js (E.sketch).
 *
 * Tim (verbatim): "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor"
 * - a sketch layer "something like fusion 360 sketch".
 *
 *   Measure Tool (sketch) (M with a sketch tool picked; also in the N group): click a point / line / circle / arc /
 *     spline = its sizes; a second click = between the two (distance, angle, gap...); a click inside a closed region =
 *     its area + perimeter (holes taken out). The numbers in a box by the pointer (📋 copies them); Esc clears.
 *   Sketch units (📐 Sketch tab): px, or mm / in with "1 px = k" - the Measure box and the DXF / SVG files use them.
 *   File ▸ Export Sketch as DXF… / as SVG…: kept in the project's cad folder (and downloaded); the DXF's 0,0 is the
 *     sketch's origin, y up, construction + dimensions optional.
 *   File ▸ Import DXF… / Import DXF from Project…: lines, circles, arcs, polylines (bulges = arcs), splines, ellipses
 *     into the picked sketch layer (or a new one) - fitted to the picture or at real size round the origin.
 */
(function (root) {
  "use strict";
  const K = () => root.PCSketch, CAD = () => root.PCSketchCAD;
  const UNIT_LABEL = { "": "px", mm: "mm", in: "in" };
  /** a sketch's units: {u: "" | "mm" | "in", k: units per px} */
  const unitsOf = (s) => { const u = (s && s.units) || {}; return { u: UNIT_LABEL[u.u] && u.u ? u.u : "", k: +u.k > 0 ? +u.k : 1 }; };
  /** a Measure row in the sketch's units (lengths x k, areas x k², angles / counts as they are) */
  function inUnits(row, U) {
    const [label, v, unit] = row;
    if (!U.u || (unit !== "px" && unit !== "px²")) return [label, v, unit];
    return unit === "px" ? [label, v * U.k, U.u] : [label, v * U.k * U.k, U.u + "²"];
  }
  const fmt = (v) => (Math.abs(v) >= 1000 ? (Math.round(v * 100) / 100).toString() : (Math.round(v * 1000) / 1000).toString());

  function install(E) {
    const S = E.S, doc = E.doc || root.document, say = E.say, kx = E.kx, store = E.store;
    if (!E.ui || !E.tools || !kx || !K() || !CAD() || !E.sketch) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const cur = () => E.sketch.cur();
    const tol = () => 8 / (S.zoom || 1);

    /* ---------------- the Measure tool ---------------- */
    const ms = { picks: [], region: null, res: null, at: null };
    let box = null;
    function hideBox() { if (box) { box.remove(); box = null; } }
    function clear() { ms.picks = []; ms.region = null; ms.res = null; hideBox(); E.drawOverlay(); }
    function showBox(L) {
      hideBox(); if (!ms.res) return;
      const U = unitsOf(L.sketch), rows = ms.res.rows.map((r) => inUnits(r, U));
      // in the stage's top-right corner (never over what is being clicked)
      const st0 = (E.stage && E.stage.getBoundingClientRect) ? E.stage : $("kxPaper"), r = st0.getBoundingClientRect(), kr = kx.getBoundingClientRect();
      box = doc.createElement("div"); box.id = "skMeasure";
      box.style.cssText = `position:absolute;z-index:50;left:${Math.max(4, r.right - kr.left - 250)}px;top:${r.top - kr.top + 10}px;min-width:150px;padding:4px 6px;font:11px sans-serif;background:var(--pc-bg);color:var(--pc-text);border:1px solid var(--pc-accent);border-radius:3px;box-shadow:0 2px 8px rgba(0,0,0,.35)`;
      box.innerHTML = `<div style="display:flex;gap:6px;align-items:center;margin-bottom:3px"><b style="flex:1">📏 ${esc(ms.res.title)}</b><button type="button" class="ghost" id="skMCopy" title="Copy the numbers" style="padding:0 4px">📋</button><button type="button" class="ghost" id="skMClose" title="Clear (Esc)" style="padding:0 4px">✕</button></div>`
        + `<table style="border-collapse:collapse">${rows.map(([l, v, u]) => `<tr><td style="color:var(--pc-dim);padding-right:8px">${esc(l)}</td><td style="text-align:right;font-variant-numeric:tabular-nums" data-v="${v}">${esc(fmt(v))}</td><td style="padding-left:3px">${esc(u)}</td></tr>`).join("")}</table>`;
      kx.appendChild(box);
      $("skMClose").onclick = clear;
      $("skMCopy").onclick = () => { const t = ms.res.title + "\n" + rows.map(([l, v, u]) => `${l || "-"}\t${fmt(v)} ${u}`).join("\n"); try { root.navigator.clipboard.writeText(t); say("measurements copied"); } catch (e) { say(t.replace(/\n/g, " · ")); } };
    }
    function measureNow(L) {
      const s = L.sketch;
      if (ms.region) {
        const g = ms.region;
        ms.res = { title: "Closed region", rows: [["Area", g.area, "px²"], ["Perimeter", g.perimeter, "px"], ["Outer edge", g.outer, "px"], ["Holes", g.holes, ""]] };
      } else ms.res = ms.picks.length ? CAD().measure(s, ms.picks) : null;
      showBox(L);
      if (ms.res && ms.res.rows.length) { const r0 = inUnits(ms.res.rows[0], unitsOf(s)); say(`📏 ${ms.res.title}: ${r0[0]} ${fmt(r0[1])} ${r0[2]}`); }
      E.drawOverlay();
    }
    E.tools.sk_measure = {
      id: "sk_measure", name: "Measure", cursor: "crosshair",
      options: () => `<span class="hint">click a point / line / circle (a second click = between them) - or inside a closed region = its area + perimeter · Esc clears</span>`,
      bindOptions() {},
      key(e) { if ((e.key || "") === "Escape" && (ms.res || ms.picks.length)) { clear(); return true; } return E.sketch.keyFor(e); },
      down(e, fx, fy) {
        const L = cur(); if (!L) { say("Measure: pick a sketch layer first (Layer ▸ New Sketch)"); return false; }
        const s = L.sketch, hit = K().pick(s, fx, fy, tol(), { axes: false });
        ms.at = [fx, fy];
        if (hit && !(hit.k === "pt" && K().isOrigin(s, hit.id) && hit.id !== s.origin.pt)) {
          ms.region = null;
          if (ms.picks.length === 1 && !ms.picks.some((q) => q.id === hit.id)) ms.picks.push(hit); else ms.picks = [hit];
          if (ms.picks.length === 2 && !CAD().measure(s, ms.picks)) ms.picks = [hit];
          if (!CAD().measure(s, ms.picks) && ms.picks.length === 1 && hit.k === "pt") { /* one point alone: wait for the second */ ms.res = null; hideBox(); say("Measure: now a second point / line / circle"); E.drawOverlay(); return false; }
        } else {
          ms.picks = []; ms.region = CAD().regionAt(s, fx, fy);
          if (!ms.region) { clear(); say("Measure: click a point, a line, a circle - or inside a closed region"); return false; }
        }
        measureNow(L);
        return false;
      },
      hover(e, fx, fy) { void e; void fx; void fy; },
      leave() { clear(); },
    };
    E.overlayHooks.push((g, px) => {
      if (S.tool !== "sk_measure") return;
      const L = cur(); if (!L) return;
      const s = L.sketch;
      g.save();
      if (ms.region) {
        const p = ms.region.profile;
        g.beginPath(); for (const poly of [p.poly, ...(p.holes || []).map((h) => h.poly)]) { poly.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); }
        g.fillStyle = "rgba(255,138,0,0.22)"; g.fill("evenodd"); g.strokeStyle = "#ff8a00"; g.lineWidth = 2 * px; g.stroke();
      }
      g.strokeStyle = "#ff8a00"; g.lineWidth = 2.6 * px;
      for (const q of ms.picks) { if (q.k === "pt") { const p = K().pt(s, q.id); if (p) g.strokeRect(p.x - 5 * px, p.y - 5 * px, 10 * px, 10 * px); } else { const e = K().ent(s, q.id); if (e && e.t !== "point") K().strokeEnt(g, s, e); else if (e) { const p = K().pt(s, e.p1); g.strokeRect(p.x - 5 * px, p.y - 5 * px, 10 * px, 10 * px); } } }
      if (ms.picks.length === 2) {           // a dashed line between the two picks
        const c = (q) => { if (q.k === "pt") return K().pt(s, q.id); const e = K().ent(s, q.id); if (!e) return null; if (e.t === "point") return K().pt(s, e.p1); if (e.c) return K().pt(s, e.c); if (e.t === "line") { const a = K().pt(s, e.p1), b = K().pt(s, e.p2); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; } return null; };
        const a = c(ms.picks[0]), b = c(ms.picks[1]);
        if (a && b) { g.setLineDash([5 * px, 3 * px]); g.lineWidth = 1.2 * px; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      }
      g.restore();
    });

    /* ---------------- CAD files ---------------- */
    const baseName = (L) => String((L && L.name) || S.name || "sketch").replace(/\.(png|jpe?g|webp|bgi)$/i, "").trim() || "sketch";
    async function saveText(name, text, download, type) {
      const r = await root.fetch("/api/cad/save?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: text });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "the save was refused");
      if (download) {
        const a = doc.createElement("a"); a.href = root.URL.createObjectURL(new root.Blob([text], { type })); a.download = j.name;
        doc.body.appendChild(a); a.click(); root.setTimeout(() => { root.URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      }
      return j;
    }
    function exportText(L, kind, o) {
      const s = L.sketch;
      return kind === "dxf" ? CAD().toDXF(s, o) : CAD().toSVG(s, Object.assign({ w: S.w, h: S.h, title: L.name }, o));
    }
    function exportDialog(kind) {
      const L = cur(); if (!L) return say("pick a sketch layer first");
      const U = unitsOf(L.sketch), up = kind.toUpperCase();
      E.ui.dialog(`Export Sketch as ${up}`, `<div class="kxrow"><span>Name</span><input type="text" id="skXN" value="${esc(baseName(L))}" style="flex:1"><span>.${kind}</span></div>
        <div class="kxrow"><span>Units</span><select id="skXU"><option value=""${U.u ? "" : " selected"}>px (as drawn)</option><option value="mm"${U.u === "mm" ? " selected" : ""}>mm</option><option value="in"${U.u === "in" ? " selected" : ""}>in</option></select><span>1 px =</span><input type="number" id="skXK" step="any" min="0" value="${U.k}" style="width:70px"></div>
        <div class="kxrow"><label><input type="checkbox" id="skXC"> construction lines too</label><label><input type="checkbox" id="skXD"> dimensions too</label></div>
        <div class="kxrow"><label><input type="checkbox" id="skXDl" checked> also download it</label></div>
        <div class="kxrow" style="color:var(--pc-dim)">${kind === "dxf" ? "R12 DXF (opens in any CAD / laser / CNC program): the sketch's origin is 0,0 and y goes up; splines as polylines." : "The picture's size; with mm / in the SVG gets that real size. Fill profiles go in when the sketch fills them."}<br>Kept in the project's cad folder.</div>`,
      async (d) => {
        const unit = d.querySelector("#skXU").value, k = +d.querySelector("#skXK").value > 0 ? +d.querySelector("#skXK").value : 1;
        const o = { unit, scale: unit ? k : 1, construction: d.querySelector("#skXC").checked, dims: d.querySelector("#skXD").checked };
        const nm = (d.querySelector("#skXN").value.trim() || baseName(L)) + "." + kind;
        try {
          const j = await saveText(nm, exportText(L, kind, o), d.querySelector("#skXDl").checked, kind === "dxf" ? "application/dxf" : "image/svg+xml");
          say(`saved ${j.name} (${Math.max(1, Math.round(j.size / 1024))} KB) in the project's cad folder`);
        } catch (e) { say(`Export ${up} failed: ${e.message}`); }
      }, { okLabel: "💾 Export" });
    }
    /* import */
    const input = doc.createElement("input"); input.type = "file"; input.accept = ".dxf,application/dxf,image/vnd.dxf"; input.style.display = "none"; input.id = "skDxfFile";
    input.onchange = () => { const f = input.files && input.files[0]; input.value = ""; if (f) f.text().then((t) => importText(t, f.name)).catch((e) => say("Import DXF failed: " + e.message)); };
    kx.appendChild(input);
    function importText(text, name, opts) {
      let parsed;
      try { parsed = CAD().parseDXF(text); } catch (e) { return say("that DXF could not be read: " + e.message); }
      if (!parsed.items.length) return say(`${name}: nothing to import (no lines, circles, arcs, polylines or splines)` + (Object.keys(parsed.skipped).length ? " - it has " + Object.keys(parsed.skipped).join(", ") : ""));
      const go = (place, scale) => {
        let L = cur(); const made = !L;
        if (!L) L = E.sketch.newSketch(String(name || "DXF").replace(/\.dxf$/i, ""));
        let r = null;
        E.sketch.edit(L, "import DXF", (sk) => { r = CAD().addDXF(sk, parsed, { place, scale, w: S.w, h: S.h }); if (!r.ok) return false; });
        const sk = Object.keys(parsed.skipped);
        say(r && r.ok ? `${name}: ${r.count} entit${r.count === 1 ? "y" : "ies"} into ${L.name}${made ? " (a new sketch layer)" : ""}${sk.length ? " · left out: " + sk.map((t) => `${parsed.skipped[t]} ${t}`).join(", ") : ""}` : `${name}: ${(r && r.why) || "nothing imported"}`);
        if (r && r.ok) E.sketch.setSel(r.ents.map((id) => ({ k: "ent", id })));
        return r;
      };
      if (opts && opts.place) return go(opts.place, opts.scale);
      const B = parsed.bounds, un = CAD().UNIT_NAMES[parsed.units] || "units", U = cur() ? unitsOf(cur().sketch) : { u: "", k: 1 };
      const pxPer = U.u && U.u === un ? 1 / U.k : 1;
      E.ui.dialog("Import DXF", `<div class="kxrow"><b>${esc(name)}</b>: ${parsed.items.length} entities · ${esc(String(Math.round((B.x1 - B.x0) * 100) / 100))} × ${esc(String(Math.round((B.y1 - B.y0) * 100) / 100))} ${esc(un)}</div>
        ${Object.keys(parsed.skipped).length ? `<div class="kxrow" style="color:var(--pc-dim)">Left out: ${esc(Object.keys(parsed.skipped).map((t) => `${parsed.skipped[t]} ${t}`).join(", "))}</div>` : ""}
        <div class="kxrow"><label><input type="radio" name="skIP" value="fit" checked> fit to the picture</label></div>
        <div class="kxrow"><label><input type="radio" name="skIP" value="origin"> real size round the sketch's origin: 1 ${esc(un)} =</label><input type="number" id="skIK" step="any" min="0" value="${pxPer}" style="width:70px"><span>px</span></div>
        <div class="kxrow" style="color:var(--pc-dim)">Into ${cur() ? "the picked sketch layer" : "a new sketch layer"}; ends that meet are joined, so closed outlines are profiles at once.</div>`,
      (d) => { const place = (d.querySelector("input[name=skIP]:checked") || {}).value || "fit", k = +d.querySelector("#skIK").value; go(place, k > 0 ? k : 1); }, { okLabel: "⬆ Import" });
      return null;
    }
    async function projectDialog() {
      let files = []; try { files = (await (await root.fetch("/api/cad/list?ext=dxf")).json()).files || []; } catch (e) { files = []; }
      E.ui.dialog("Import DXF from Project", files.length
        ? `<select id="skPL" size="${Math.min(10, Math.max(3, files.length))}" style="width:100%">${files.map((f, i) => `<option value="${esc(f.name)}"${i ? "" : " selected"}>${esc(f.name)} — ${Math.max(1, Math.round(f.size / 1024))} KB</option>`).join("")}</select>`
        : `<div style="color:var(--pc-dim)">No DXF in this project's cad folder yet - Export Sketch as DXF… keeps one there.</div>`,
      async (d) => { const sl = d.querySelector("#skPL"); if (!sl || !sl.value) return; try { const t = await (await root.fetch("/api/cad/file/" + encodeURIComponent(sl.value))).text(); root.setTimeout(() => importText(t, sl.value), 50); } catch (e) { say("Import DXF failed: " + e.message); } }, { okLabel: "Next…" });
    }
    function setUnits(u, k) {
      const L = cur(); if (!L) return;
      E.sketch.edit(L, "sketch units", (sk) => { sk.units = { u: UNIT_LABEL[u] && u ? u : "", k: +k > 0 ? +k : 1 }; });
      if (ms.res) showBox(L);
    }

    /* ---------------- the 📐 Sketch tab: Measure + CAD files + units ---------------- */
    E.sketch.tabHooks.push((body, L) => {
      const U = unitsOf(L.sketch), div = doc.createElement("div");
      div.innerHTML = `<h5>Measure + CAD files</h5>
        <div class="r"><button type="button" class="ghost cb${S.tool === "sk_measure" ? " on" : ""}" id="skMeasureT" title="Measure Tool (M): sizes, distances, angles, a region's area">📏 Measure</button><button type="button" class="ghost cb" id="skDxfOut" title="Export the sketch as a DXF (CAD / laser / CNC)">⬇ DXF…</button><button type="button" class="ghost cb" id="skSvgOut" title="Export the sketch as an SVG">⬇ SVG…</button><button type="button" class="ghost cb" id="skDxfIn" title="Import a DXF into this sketch">⬆ Import DXF…</button></div>
        <div class="r"><label title="The Measure box and the DXF / SVG files use these">Units <select id="skUnit"><option value=""${U.u ? "" : " selected"}>px</option><option value="mm"${U.u === "mm" ? " selected" : ""}>mm</option><option value="in"${U.u === "in" ? " selected" : ""}>in</option></select></label><label>1 px = <input type="number" id="skUnitK" step="any" min="0" value="${U.k}"${U.u ? "" : " disabled"}></label></div>`;
      const fin = body.querySelector("#skFinish"), at = fin ? fin.closest(".r") : null;
      if (at) body.insertBefore(div, at); else body.appendChild(div);
      $("skMeasureT").onclick = () => E.setTool("sk_measure");
      $("skDxfOut").onclick = () => exportDialog("dxf"); $("skSvgOut").onclick = () => exportDialog("svg"); $("skDxfIn").onclick = () => input.click();
      $("skUnit").onchange = (e) => setUnits(e.target.value, $("skUnitK").value);
      $("skUnitK").onchange = (e) => setUnits($("skUnit").value, e.target.value);
    });

    /* ---------------- commands ---------------- */
    const C = E.ui.addCmd, has = () => !!cur();
    C("sketch.exportdxf", "Export Sketch as DXF…", "", () => exportDialog("dxf"), { enabled: has }, ["File", "file.export"]);
    C("sketch.exportsvg", "Export Sketch as SVG…", "", () => exportDialog("svg"), { enabled: has }, ["File", "sketch.exportdxf"]);
    C("sketch.importdxf", "Import DXF…", "", () => input.click(), {}, ["File", "file.place"]);
    C("sketch.importdxfproj", "Import DXF from Project…", "", () => projectDialog(), {}, ["File", "sketch.importdxf"]);
    E.sketchCAD = { exportDialog, exportText, importText, projectDialog, setUnits, measure: () => (ms.res ? { title: ms.res.title, rows: ms.res.rows.map((r) => inUnits(r, unitsOf((cur() || {}).sketch))) } : null), picks: () => ms.picks.slice(), clear, unitsOf };
  }

  const PCSketchCADUI = { install, unitsOf, inUnits };
  if (typeof module !== "undefined" && module.exports) module.exports = PCSketchCADUI;
  else root.PCSketchCADUI = PCSketchCADUI;
})(typeof window !== "undefined" ? window : globalThis);

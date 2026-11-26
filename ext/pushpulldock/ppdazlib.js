/* bitGen Studio — ext/pushpulldock/ppdazlib.js (2.977.0): 📚 THE DAZ LIBRARY in the Sketcher (window.H3DazLib).
 * Tim: "just for bitgen to point to the daz library, and can we build our own dforce... but also make sure to say this is not a
 * replacement for daz studio this is made for light tasks and DAZ studio is a very powerful character creator" -> "build steps
 * 1-4" -> "also use our dforce for hair and other physics".
 * The dialog (#pdlDlg): the folders, the library by kind (figures / characters, clothing, hair, anatomy, other) with
 * thumbnails, a figure's shape dials (sliders), what it wears, 💨 our own cloth / hair physics (lib/clothSim.js), 📷 a face
 * from a gallery photo (lib/dazFace.js) -> POST /api/dazlib/build -> <name>_daz.glb in the project's 3D models -> ⤒ Open in
 * the Sketcher. Says, always: not a replacement for Daz Studio. Pure: KINDS, dialsToSend(map) (Node: test-977 reads the file). */
(function (root) {
  "use strict";
  const NOTE = "This is not a replacement for Daz Studio - it is made for light tasks. Daz Studio is a very powerful character creator: use it for real character work.";
  const LIC = "Your own Daz content, used on this computer: renders and videos are yours to publish; the 3D files must not be shared (not to the render farm's shared projects, not to the Community).";
  const KINDS = [["figure", "🧍 Figures"], ["character", "🎭 Characters"], ["clothing", "👕 Clothing"], ["hair", "💇 Hair"], ["anatomy", "🫀 Anatomy"], ["other", "📦 Other"]];
  function dialsToSend(map) { return Object.keys(map || {}).filter((u) => +map[u]).map((u) => ({ url: u, value: +map[u] })); }
  const pure = { NOTE, LIC, KINDS, dialsToSend };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const st = { kind: "figure", fig: null, wear: [], dials: {}, dialList: [], last: null };
  async function jget(u) { const r = await fetch(u); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; }
  const say = (t) => { const m = $("pdlMsg"); if (m) m.textContent = t || ""; };
  function css() {
    if ($("pdlCss")) return;
    const s = doc.createElement("style"); s.id = "pdlCss";
    s.textContent = "#pdlDlg{padding:0;border:1px solid var(--line,#3a352d);border-radius:8px;background:var(--panel,#1b1915);color:var(--fg,#e8e2d4);width:min(1100px,97vw);max-height:95vh}"
      + "#pdlDlg .pdl{display:flex;flex-direction:column;max-height:95vh;font-size:12px}.pdl-bar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line,#3a352d);cursor:move}.pdl-bar b{flex:1;font-size:13px}"
      + ".pdl-note{margin:6px 10px 0;padding:6px 8px;border-left:3px solid var(--tiger,#f59e2c);background:#2a2418;border-radius:3px}.pdl-lic{margin:2px 10px 0;opacity:.7;font-size:11px}"
      + ".pdl-body{display:flex;gap:10px;padding:8px 10px;min-height:0;overflow:hidden}.pdl-lib{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}.pdl-side{width:330px;flex:none;display:flex;flex-direction:column;gap:6px;overflow:auto;max-height:calc(95vh - 170px)}"
      + ".pdl-tabs{display:flex;gap:4px;flex-wrap:wrap}.pdl-tabs button.on{outline:2px solid #38e1ff}.pdl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:6px;overflow:auto;max-height:calc(95vh - 250px)}"
      + ".pdl-it{border:2px solid transparent;border-radius:5px;padding:3px;cursor:pointer;background:#0006;text-align:center}.pdl-it.sel{border-color:#38e1ff}.pdl-it.wear{border-color:#7bd389}.pdl-it img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:3px;background:#000}.pdl-it span{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".pdl-side fieldset{border:1px solid var(--line,#3a352d);border-radius:6px;padding:5px 8px;margin:0;display:flex;flex-direction:column;gap:4px}.pdl-side legend{opacity:.75;font-size:11px}"
      + ".pdl-dial{display:flex;gap:6px;align-items:center}.pdl-dial span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pdl-dial input{width:110px}.pdl-dials{max-height:200px;overflow:auto}"
      + ".pdl-foot{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--line,#3a352d)}.pdl-foot .hint{flex:1}";
    doc.head.appendChild(s);
  }
  function ensure() {
    let d = $("pdlDlg"); if (d) return d;
    css();
    d = doc.createElement("dialog"); d.id = "pdlDlg"; d.setAttribute("aria-label", "Daz library");
    d.innerHTML = '<div class="pdl"><div class="pdl-bar" data-dlg-drag title="Drag to move"><b>📚 Daz library</b><span id="pdlRoots" class="hint"></span>'
      + '<button type="button" class="ghost" id="pdlFolders" title="The Daz content folders bitGen reads (found by itself when Daz is installed in the usual place)">📁 Folders…</button><button type="button" class="ghost" id="pdlX" title="Close (Esc)">✕</button></div>'
      + '<div id="pdlFolderBox" hidden style="padding:6px 10px"><div class="hint">The Daz content folders, one a line (e.g. C:\\Users\\Public\\Documents\\My DAZ 3D Library) - empty = found by itself:</div><textarea id="pdlFolderTa" rows="3" style="width:100%"></textarea><button type="button" class="ghost" id="pdlFolderSave">Save</button></div>'
      + '<div class="pdl-note" role="note">' + esc(NOTE) + "</div><div class=\"pdl-lic\">" + esc(LIC) + "</div>"
      + '<div class="pdl-body"><div class="pdl-lib"><div class="pdl-tabs" id="pdlTabs">' + KINDS.map(([k, l]) => '<button type="button" class="ghost" data-kind="' + k + '">' + l + "</button>").join("")
      + '<input type="search" id="pdlQ" placeholder="Search the library…" style="flex:1;min-width:140px"></div><div id="pdlEnc" class="hint"></div><div class="pdl-grid" id="pdlGrid"></div></div>'
      + '<div class="pdl-side"><fieldset><legend>Figure</legend><div id="pdlFig" class="hint">pick a figure or a character</div></fieldset>'
      + '<fieldset><legend>Shape dials</legend><input type="search" id="pdlDialQ" placeholder="Find a dial (e.g. height, nose)…"><div class="pdl-dials" id="pdlDials"></div></fieldset>'
      + '<fieldset><legend>Wearing</legend><div id="pdlWear" class="hint">click clothing, hair or anatomy to add it</div></fieldset>'
      + '<fieldset><legend>💨 Physics (our own cloth - a light drape, not Daz\'s dForce)</legend><label><input type="checkbox" id="pdlDrapeC"> Clothing</label><label><input type="checkbox" id="pdlDrapeH"> Hair (held at the roots)</label><label><input type="checkbox" id="pdlDrapeO"> Other pieces</label>'
      + '<label class="pdl-dial"><span>Settle frames</span><input type="number" id="pdlFrames" min="5" max="240" value="45"></label></fieldset>'
      + '<fieldset><legend>📷 A face from a photo (light - Daz Studio\'s Face Transfer does far more)</legend><select id="pdlFace"><option value="">no photo</option></select></fieldset>'
      + '<label class="pdl-dial"><span>Name</span><input type="text" id="pdlName" placeholder="character" style="width:160px"></label></div></div>'
      + '<div class="pdl-foot"><span class="hint" id="pdlMsg" role="status"></span><button type="button" class="ghost" id="pdlOpen" hidden>⤒ Open in the Sketcher</button><button type="button" class="primary" id="pdlBuild">🧍 Build the character</button></div></div>';
    doc.body.appendChild(d);
    $("pdlX").onclick = () => d.close();
    $("pdlTabs").querySelectorAll("[data-kind]").forEach((b) => { b.onclick = () => { st.kind = b.dataset.kind; list(); }; });
    let qt = 0; $("pdlQ").oninput = () => { clearTimeout(qt); qt = setTimeout(list, 300); };
    let dq = 0; $("pdlDialQ").oninput = () => { clearTimeout(dq); dq = setTimeout(dialsLoad, 300); };
    $("pdlFolders").onclick = folders; $("pdlFolderSave").onclick = saveFolders;
    $("pdlBuild").onclick = buildIt;
    $("pdlOpen").onclick = openIt;
    return d;
  }
  async function info() { try { const j = await jget("/api/dazlib"); $("pdlRoots").textContent = j.roots.length ? j.roots.join(" · ") : "no Daz library found - 📁 Folders…"; return j; } catch (e) { say("⚠ " + e.message); return null; } }
  async function folders() {
    const box = $("pdlFolderBox"); if (!box.hidden) { box.hidden = true; return; }
    const j = await info(); $("pdlFolderTa").value = (j && j.roots || []).join("\n"); box.hidden = false; $("pdlFolderTa").focus();
  }
  async function saveFolders() {
    try { const r = await fetch("/api/dazlib/roots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roots: $("pdlFolderTa").value.split(/\r?\n/) }) }); await r.json(); $("pdlFolderBox").hidden = true; await info(); list(); } catch (e) { say("⚠ " + e.message); }
  }
  async function list() {
    $("pdlTabs").querySelectorAll("[data-kind]").forEach((b) => b.classList.toggle("on", b.dataset.kind === st.kind));
    const g = $("pdlGrid"); g.textContent = "…";
    let j; try { j = await jget("/api/dazlib/scan?kind=" + encodeURIComponent(st.kind) + "&q=" + encodeURIComponent($("pdlQ").value || "") + "&limit=400"); } catch (e) { g.textContent = "⚠ " + e.message; return; }
    $("pdlEnc").textContent = j.encrypted ? "🔒 " + j.encrypted + " encrypted Daz Connect item(s) skipped - only Daz Studio can read them (Install Manager installs readable copies)" : "";
    g.innerHTML = j.items.length ? "" : '<span class="hint">nothing here - ' + (j.roots.length ? "another kind or search" : "📁 Folders… to point bitGen at your Daz library") + "</span>";
    j.items.forEach((it) => {
      const b = doc.createElement("div"); b.className = "pdl-it"; b.title = it.rel;
      b.innerHTML = (it.thumb ? '<img loading="lazy" alt="" src="/api/dazlib/thumb?root=' + encodeURIComponent(it.root) + "&rel=" + encodeURIComponent(it.thumb) + '">' : '<img alt="">') + "<span>" + esc(it.name) + "</span>";
      const isWear = !["figure", "character"].includes(it.kind);
      if (st.fig && st.fig.rel === it.rel) b.classList.add("sel");
      if (st.wear.some((w) => w.rel === it.rel)) b.classList.add("wear");
      b.onclick = () => { if (isWear) toggleWear(it); else pickFig(it); list(); };
      g.appendChild(b);
    });
  }
  function pickFig(it) { st.fig = it; st.dials = {}; $("pdlFig").textContent = it.name + " (" + it.kind + ")"; if (!$("pdlName").value) $("pdlName").value = it.name; dialsLoad(); }
  function toggleWear(it) { const i = st.wear.findIndex((w) => w.rel === it.rel); if (i >= 0) st.wear.splice(i, 1); else st.wear.push(it); $("pdlWear").textContent = st.wear.length ? st.wear.map((w) => w.name).join(", ") : "click clothing, hair or anatomy to add it"; }
  async function dialsLoad() {
    const box = $("pdlDials"); if (!st.fig) { box.textContent = ""; return; }
    box.textContent = "…";
    try {
      const j = await jget("/api/dazlib/dials?root=" + encodeURIComponent(st.fig.root) + "&rel=" + encodeURIComponent(st.fig.rel) + "&q=" + encodeURIComponent($("pdlDialQ").value || "") + "&limit=150");
      st.dialList = j.dials || [];
      box.innerHTML = st.dialList.length ? "" : '<span class="hint">no dials found (search another word)</span>';
      st.dialList.forEach((d) => {
        const row = doc.createElement("label"); row.className = "pdl-dial"; row.title = d.group || "";
        row.innerHTML = "<span>" + esc(d.label) + '</span><input type="range" min="' + d.min + '" max="' + d.max + '" step="0.01"><output>' + (+st.dials[d.url] || 0).toFixed(2) + "</output>";
        const r = row.querySelector("input"); r.value = st.dials[d.url] || 0;
        r.oninput = () => { st.dials[d.url] = +r.value; row.querySelector("output").textContent = (+r.value).toFixed(2); };
        box.appendChild(row);
      });
    } catch (e) { box.textContent = "⚠ " + e.message; }
  }
  async function faces() { try { const L = await jget("/api/outputs?kind=images"); $("pdlFace").innerHTML = '<option value="">no photo</option>' + (Array.isArray(L) ? L : []).slice(0, 200).map((f) => '<option>' + esc(f.name) + "</option>").join(""); } catch (e) { /* fine */ } }
  async function buildIt() {
    if (!st.fig) { say("pick a figure or a character first"); return; }
    const kinds = [["pdlDrapeC", "clothing"], ["pdlDrapeH", "hair"], ["pdlDrapeO", "other"]].filter(([id]) => $(id).checked).map(([, k]) => k);
    const body = { root: st.fig.root, rel: st.fig.rel, dials: dialsToSend(st.dials), wear: st.wear.map((w) => ({ root: w.root, rel: w.rel })), drape: kinds.length ? { kinds, frames: +$("pdlFrames").value || 45 } : false,
      face: $("pdlFace").value ? { picture: $("pdlFace").value } : null, name: $("pdlName").value || st.fig.name };
    $("pdlBuild").disabled = true; say("🧍 building " + body.name + (kinds.length ? " + 💨 physics" : "") + (body.face ? " + 📷 the face" : "") + "…");
    try {
      const r = await fetch("/api/dazlib/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText);
      st.last = j; $("pdlOpen").hidden = false;
      say("✔ " + j.model + " in the project's 3D models - " + j.info.pieces.length + " piece(s), " + j.info.bones + " bones" + (j.info.warnings.length ? " · ⚠ " + j.info.warnings.slice(0, 2).join("; ") : ""));
    } catch (e) { say("⚠ " + e.message); }
    $("pdlBuild").disabled = false;
  }
  async function openIt() {
    const P = root.H3PushPull; if (!st.last || !P || !P.importModel) return;
    try { await P.importModel(st.last.model); $("pdlDlg").close(); } catch (e) { say("⚠ " + e.message + " - the .glb is in the 3D models (Blender, the timeline)"); }
  }
  function open() { const d = ensure(); if (!d.open) d.showModal(); info(); list(); faces(); }
  root.H3DazLib = Object.assign({ open, list, buildIt, state: st }, pure);
})(typeof window !== "undefined" ? window : globalThis);

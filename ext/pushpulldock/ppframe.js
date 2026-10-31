/* bitGen Studio — ext/pushpulldock/ppframe.js (2.620.0): the 📏 PushPull docker's ☰ FILE MENU and its FULL-WINDOW MAXIMIZE.
 *
 * Tim (verbatim): "when maximized it takes bitgens full window minus the titlebar, it has it's own file menu. send to image
 * editor button and send to time line button - this goes in our new sketchup docker"
 *   ⛶ / ✕ in its title bar (2.624.0: ⛶ reads "⇲ Dock" while maximized; ✕ closes it) - the usual maximize (toggleMax) -> #pushpulldock.maxed is fixed over the whole window under the title
 *     bar (--pp-top = the title bar's bottom; none in a browser = the very top); 🗗 / Esc (nothing else to cancel) restores
 *   ☰ File ▾  New · Open… · Save (Ctrl+S) · Save as… · Rename… · Import (a project 3D model / from this computer: .pp3d .glb
 *     .gltf .obj) · Export… · 🖼 → the image editor · 🎞 → the timeline · ➜ Send to… · Delete… · Maximize / Restore · Close
 *   the 🖼 / 🎞 buttons on the bar are wired in ppdock.js */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  if (!doc || !$("pushpulldock")) return;
  const H = () => root.H3PushPull;
  const dock = $("pushpulldock");

  /* ---- a small question in the docker's own look (window.prompt does not exist in the desktop app) */
  function ask(title, value, okLabel) {
    return new Promise((done) => {
      const w = doc.createElement("div"); w.className = "ppask";
      const b = doc.createElement("div"); w.appendChild(b);
      const t = doc.createElement("div"); t.textContent = title; b.appendChild(t);
      const i = doc.createElement("input"); i.type = "text"; i.value = value || ""; b.appendChild(i);
      const r = doc.createElement("div"); r.className = "r"; b.appendChild(r);
      const no = doc.createElement("button"); no.type = "button"; no.className = "ghost"; no.textContent = "Cancel"; r.appendChild(no);
      const ok = doc.createElement("button"); ok.type = "button"; ok.textContent = okLabel || "OK"; r.appendChild(ok);
      const end = (v) => { w.remove(); done(v); };
      ok.onclick = () => end(i.value.trim() || null); no.onclick = () => end(null);
      w.addEventListener("pointerdown", (e) => { if (e.target === w) end(null); });
      i.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") end(i.value.trim() || null); if (e.key === "Escape") end(null); });
      doc.body.appendChild(w); setTimeout(() => { i.focus(); i.select(); }, 0);
    });
  }
  const safe = (n) => String(n || "").replace(/[^\w .()-]+/g, "_").slice(0, 80).trim();
  async function saveAs() {
    const h = H(); const n = safe(await ask("Save the model as", h.nameNow() + " copy", "Save")); if (!n) return;
    $("ppName").value = n; await h.save(false);
  }
  async function rename() {
    const h = H(), old = h.nameNow(); const n = safe(await ask("Rename \"" + old + "\" to", old, "Rename")); if (!n || n === old) return;
    $("ppName").value = n; const j = await h.save(true);
    if (j) { try { await h.api("/api/pushpull/" + encodeURIComponent(old), { method: "DELETE" }); } catch (e) { /* it was never saved */ } h.msg("✎ renamed to " + j.name); }
  }
  async function del() {
    const h = H(), n = h.nameNow(); const yes = await ask("Delete \"" + n + "\"? (it goes to the recycle bin) - type DELETE", "", "Delete"); if (!yes || yes.toUpperCase() !== "DELETE") { h.msg("not deleted"); return; }
    try { await h.api("/api/pushpull/" + encodeURIComponent(n), { method: "DELETE" }); h.msg("🗑 " + n + " deleted"); } catch (e) { h.msg("not deleted: " + e.message); }
    await h.newModel();
  }
  function fromComputer() {
    const i = doc.createElement("input"); i.type = "file"; i.accept = ".pp3d,.json,.glb,.gltf,.obj";
    i.onchange = async () => {
      const f = i.files && i.files[0], h = H(); if (!f) return;
      try {
        if (/\.(pp3d|json)$/i.test(f.name)) {
          const j = JSON.parse(await f.text()), model = j && (j.model || (Array.isArray(j.v) ? j : null)); if (!model) throw new Error("that is not a PushPull model");
          const name = safe(f.name.replace(/\.(pp3d|json)$/i, "")) || "imported";
          await h.api("/api/pushpull/" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, view: j.view || null }) });
          await h.open(name); h.msg("📂 " + name + " - from this computer, now kept in the project");
        } else { const u = URL.createObjectURL(f); try { await h.importModel(f.name, u); } finally { setTimeout(() => URL.revokeObjectURL(u), 30000); } }
      } catch (e) { h.msg("not imported: " + (e.message || e)); }
    };
    i.click();
  }
  const maxed = () => dock.classList.contains("maxed");
  // 2.624.0: the title bar's ⛶ / ✕ - ⛶ is "⇲ Dock" while maximized; a docker the app cannot maximize (not a .bdock) does it itself
  function toggleMaxed(force) {
    const on = force != null ? !!force : !maxed();
    if (dock.classList.contains("bdock") && typeof root.toggleMax === "function") root.toggleMax("pushpulldock", on);
    else dock.classList.toggle("maxed", on);
    paintMax();
  }
  function paintMax() {
    const b = $("ppMaxBtn"); if (!b) return;
    const m = maxed(), t = m ? "⇲ Dock" : "⛶";
    if (b.textContent !== t) b.textContent = t;
    b.title = m ? "Dock - put it back in its place (Esc)" : "Maximize - the whole window under the title bar";
    b.setAttribute("aria-label", m ? "Dock" : "Maximize");
  }
  function close() { if (maxed()) toggleMaxed(false); if (typeof root.toggleDockGone === "function") root.toggleDockGone("pushpulldock", "tX_pushpulldock"); }
  function fileMenu() {
    const h = H(), at = $("ppFile"); if (!h) return;
    const g = (what, fn) => () => h.guard(what, fn);
    h.menu(at, [
      { head: "The model - \"" + h.nameNow() + "\"" },
      { label: "＋ New", run: () => h.newModel() },
      { label: "📂 Open…", run: () => h.openMenu(at) },
      { label: "💾 Save   (Ctrl+S)", run: () => h.save(false) },
      { label: "💾 Save as…", run: g("Save as", saveAs) },
      { label: "✎ Rename…", run: g("Rename", rename) },
      { head: "Bring in" },
      { label: "⤒ A 3D model of the project…", run: () => h.state.V && h.importMenu(at) },
      { label: "⤒ From this computer… (.pp3d · .glb · .gltf · .obj)", run: fromComputer },
      { head: "Out" },
      { label: "⤓ Export… (.glb · .obj · .stl)", run: () => h.exportMenu(at) },
      { label: "🖼 → the image editor (a picture of the view)", run: g("→ Image editor", () => h.toEditor(false)) },
      { label: "🎞 → the timeline (a 3D layer)", run: g("→ Timeline", h.toTimeline) },
      { label: "➜ Send to… (House builder · Blender · Unreal)", run: () => h.sendMenu(at) },
      { head: "" },
      { label: maxed() ? "⇲ Dock - back in its place" : "⛶ Maximize - the whole window", run: () => toggleMaxed() },
      { label: "🗑 Delete this model…", run: g("Delete", del) },
      { label: "✕ Close the docker", run: close },
    ]);
  }

  /* ---- the full-window maximize */
  function top() { const tb = $("titlebar"); return tb && !tb.classList.contains("hidden") && tb.offsetHeight ? Math.round(tb.getBoundingClientRect().bottom) : 0; }
  /** 2.625.0: the status bar stays too - the room under the maximized docker (0: no status bar shown) */
  function bottom() { const sb = $("statusbar"); if (!sb || !sb.offsetHeight || getComputedStyle(sb).display === "none") return 0; return Math.max(0, Math.round(root.innerHeight - sb.getBoundingClientRect().top)); }
  function fit() {
    if (maxed()) { dock.style.setProperty("--pp-top", top() + "px"); dock.style.setProperty("--pp-bottom", bottom() + "px"); }
    else { dock.style.removeProperty("--pp-top"); dock.style.removeProperty("--pp-bottom"); }
    paintMax();
    const h = H(); if (h && h.state.V) setTimeout(() => { h.state.V.size(); }, 30);
  }
  try { new root.MutationObserver(fit).observe(dock, { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* jsdom */ }
  // a narrow docker (a side column): the panel floats over the view's right side instead of taking its width
  const narrow = () => { const w = dock.clientWidth; if (w) dock.classList.toggle("ppnarrow", w < 820); };
  try { new root.ResizeObserver(narrow).observe(dock); } catch (e) { root.addEventListener("resize", narrow); }
  root.addEventListener("resize", () => { if (maxed()) fit(); });

  const fb = $("ppFile"); if (fb) fb.onclick = fileMenu;
  const mb = $("ppMaxBtn"); if (mb) mb.onclick = (e) => { e.stopPropagation(); toggleMaxed(); };
  const cb = $("ppCloseBtn"); if (cb) cb.onclick = (e) => { e.stopPropagation(); close(); };
  // Esc (one the 3D view did not use): a docker maximized by itself goes back (the app's Esc does a .bdock's)
  doc.addEventListener("keydown", (e) => { if (e.key === "Escape" && maxed() && !dock.classList.contains("bdock") && !doc.querySelector("dialog[open]")) toggleMaxed(false); });
  paintMax();
  root.H3PushPullFrame = { fileMenu, ask, saveAs, rename, del, fromComputer, toggleMaxed, maxed, top, bottom, close, paintMax };
})(typeof window !== "undefined" ? window : globalThis);

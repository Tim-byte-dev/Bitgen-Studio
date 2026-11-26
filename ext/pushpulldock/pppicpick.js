/* bitGen Studio — ext/pushpulldock/pppicpick.js (2.978.0): ONE PICTURE PICKER for the Sketcher's dialogs (window.H3PicPick).
 * Tim: "the create 3d from picture does not load the picture. it should load from gallery, assets, references or from a
 * folder select" - used by 🧱 Picture → 3D scene (ppscene.js) and the 📚 Daz library's 📷 face photo (ppdazlib.js).
 *   mount(box, {onPick, title}) -> {pick, source, refresh}   tabs 🖼 Gallery | 🗂 Assets | 📌 References | 📁 Folder… | 📄 File…
 *     Gallery    GET /api/outputs?kind=images      -> {name, where: "output"}  (thumbnail /outputs/<name>)
 *     Assets     GET /api/passets (images)          -> {name, where: "images"}  (thumbnail /passets/images/<name>)
 *     References the page's own reference pictures (the global `refs`: {file | url, name}) -> {blob, name}
 *     Folder     a folder of this computer (<input webkitdirectory>) - its pictures -> {blob, name}
 *     File       one picture of this computer -> {blob, name}
 *   A thumbnail that will not load says so on the tile (never an empty grid without a word).
 *   toProject(p) -> Promise<{name, where}>  a blob pick saved into the project's images (POST /api/dazlib/photo)
 * Pure: isPic(name), SOURCES (Node: test-978). */
(function (root) {
  "use strict";
  const SOURCES = [["gallery", "🖼 Gallery"], ["assets", "🗂 Assets"], ["refs", "📌 References"], ["folder", "📁 Folder…"], ["file", "📄 File…"]];
  const isPic = (n) => /\.(png|jpe?g|webp|bmp|gif)$/i.test(String(n || ""));
  const pure = { SOURCES, isPic };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }
  const doc = root.document;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function css() {
    if (doc.getElementById("pppCss")) return;
    const s = doc.createElement("style"); s.id = "pppCss";
    s.textContent = ".ppp-tabs{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px}.ppp-tabs button{font-size:11px;padding:2px 6px}.ppp-tabs button.on{outline:2px solid #38e1ff}"
      + ".ppp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;max-height:220px;overflow:auto;border:1px solid var(--line,#3a352d);border-radius:5px;padding:4px;min-height:60px}"
      + ".ppp-t{position:relative;cursor:pointer;border:2px solid transparent;border-radius:4px}.ppp-t.sel{border-color:#38e1ff}.ppp-t img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block;border-radius:3px;background:#000}"
      + ".ppp-t i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:10px;text-align:center;color:#ff9b9b;padding:2px}.ppp-note{font-size:11px;opacity:.75}";
    doc.head.appendChild(s);
  }
  const jget = (u) => fetch(u).then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || r.statusText); return j; }));
  function mount(box, opt) {
    css();
    const o = opt || {}, S = { source: "gallery", pick: null, urls: [] };
    box.innerHTML = '<div class="ppp-tabs">' + SOURCES.map(([k, l]) => '<button type="button" class="ghost" data-src="' + k + '">' + l + "</button>").join("") + '</div>'
      + '<input type="file" data-ppp="folder" webkitdirectory directory multiple hidden><input type="file" data-ppp="file" accept="image/*" hidden><div class="ppp-grid" role="listbox" aria-label="' + esc(o.title || "Pictures") + '"></div>';
    const grid = box.querySelector(".ppp-grid"), fin = box.querySelector('[data-ppp="folder"]'), fil = box.querySelector('[data-ppp="file"]');
    const freeUrls = () => { S.urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* fine */ } }); S.urls = []; };
    const tiles = (list, why) => {
      grid.innerHTML = list.length ? "" : '<span class="ppp-note">' + esc(why) + "</span>";
      list.forEach((it) => {
        const t = doc.createElement("div"); t.className = "ppp-t"; t.title = it.name; t.setAttribute("role", "option");
        const im = doc.createElement("img"); im.alt = it.name; im.loading = "lazy"; im.src = it.thumb;
        im.onerror = () => { const i = doc.createElement("i"); i.textContent = "can't show " + it.name; t.appendChild(i); };
        t.appendChild(im);
        t.onclick = () => { S.pick = it; grid.querySelectorAll(".ppp-t").forEach((x) => x.classList.toggle("sel", x === t)); if (o.onPick) o.onPick(it); };
        grid.appendChild(t);
      });
    };
    const fromFiles = (files) => {
      freeUrls();
      const L = [...files].filter((f) => isPic(f.name) || /^image\//.test(f.type)).slice(0, 300).map((f) => { const u = URL.createObjectURL(f); S.urls.push(u); return { name: f.name, blob: f, thumb: u, source: S.source }; });
      tiles(L, "no pictures in that folder");
      if (L.length === 1 && S.source === "file") grid.querySelector(".ppp-t").click();
    };
    fin.onchange = () => { S.source = "folder"; fromFiles(fin.files || []); }; fil.onchange = () => { S.source = "file"; fromFiles(fil.files || []); };
    async function show(src) {
      S.source = src; S.pick = null;
      box.querySelectorAll("[data-src]").forEach((b) => b.classList.toggle("on", b.dataset.src === src));
      grid.innerHTML = '<span class="ppp-note">…</span>';
      try {
        if (src === "gallery") { const L = await jget("/api/outputs?kind=images"); tiles((Array.isArray(L) ? L : []).slice(0, 200).map((f) => ({ name: f.name, where: "output", thumb: "/outputs/" + encodeURIComponent(f.name), source: src })), "no pictures in the gallery"); }
        else if (src === "assets") { const j = await jget("/api/passets"); tiles(((j && j.images) || []).slice(0, 300).map((f) => ({ name: f.name, where: "images", thumb: "/passets/images/" + encodeURIComponent(f.name), source: src })), "no pictures in Assets ▸ Images"); }
        else if (src === "refs") {
          freeUrls();
          const R = (typeof refs !== "undefined" && Array.isArray(refs)) ? refs : (Array.isArray(root.refs) ? root.refs : []);   // eslint-disable-line no-undef - the page's own top-level `refs` (index.html), as static/mesh3dctx.js reads it
          tiles(R.map((r, i) => { const nm = (r && r.file && r.file.name) || (r && r.name) || "reference_" + (i + 1) + ".png"; let u = r && r.url; if (!u && r && r.file instanceof Blob) { u = URL.createObjectURL(r.file); S.urls.push(u); } return u ? { name: nm, blob: r.file instanceof Blob ? r.file : null, url: u, thumb: u, source: src } : null; }).filter(Boolean), "no reference pictures - add some in the References docker");
        } else if (src === "folder") { grid.innerHTML = '<span class="ppp-note">choose a folder of this computer…</span>'; fin.value = ""; fin.click(); }
        else if (src === "file") { grid.innerHTML = '<span class="ppp-note">choose a picture of this computer…</span>'; fil.value = ""; fil.click(); }
      } catch (e) { grid.innerHTML = '<span class="ppp-note">⚠ ' + esc(e.message) + "</span>"; }
    }
    box.querySelectorAll("[data-src]").forEach((b) => { b.onclick = () => show(b.dataset.src); });
    show(o.source || "gallery");
    return { get pick() { return S.pick; }, get source() { return S.source; }, refresh: () => show(S.source), show };
  }
  /** a pick that is a blob (references / folder / file) -> saved in the project's images -> {name, where} */
  async function toProject(p) {
    if (!p) throw new Error("pick a picture first");
    if (p.name && p.where) return { name: p.name, where: p.where };
    const blob = p.blob || (p.url ? await fetch(p.url).then((r) => r.blob()) : null);
    if (!blob) throw new Error("that picture could not be read");
    const r = await fetch("/api/dazlib/photo?name=" + encodeURIComponent(p.name || "picture.png"), { method: "POST", headers: { "Content-Type": blob.type || "image/png" }, body: blob });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText);
    return { name: j.name, where: "images" };
  }
  root.H3PicPick = Object.assign({ mount, toProject }, pure);
})(typeof window !== "undefined" ? window : globalThis);

/* bitGen Studio — THE "+ ADD" PLACEHOLDER TILES (2.394.0), window.AddTile.
 *
 * Tim (verbatim): "add a + video placeholder to reference docker video and sound tab and assets dockers image sound and
 * video tabs to add a video , picture or sound, user will be able to select multiple files with ctrl or shift like in
 * the windows 11 file docker"
 *
 *   REFERENCES   Video tab: "+ add video" after the reference videos, Sound tab: "+ add sound" after the reference
 *                sounds - shown while there is room (the model takes 3 of each). The picked files go into the project's
 *                Assets (the same sorting as a drop) and then into the list, up to the room left; the rest stay in
 *                Assets and the line above the tabs says so.
 *   ASSETS       Image / Video / Sound tabs: "+ add pictures" / "+ add videos" / "+ add sounds" at the top of the list.
 *   SEVERAL      the tile opens an <input type=file multiple> with that kind's extensions, so bitGen's own Open dialog
 *                (static/filedialog.js, Windows 11 style) opens with Ctrl-click / Shift-click / Ctrl+A selection; with
 *                the dialog turned off the browser's picker does the same.
 *   KEYBOARD     the tile is focusable; Enter or Space opens it. Files dropped ON a tile go the same way.
 * Pure helpers (tested in Node: scripts/test-addtile.js): EXTS, kindOf, accept, split, label, room.
 */
(function (root) {
  "use strict";

  /* ================================ pure ================================ */
  // the same lists as lib/core.js PKINDS (what POST /api/passets accepts)
  const EXTS = {
    images: [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".jxl"],
    video: [".webm", ".avi", ".mp4", ".mov", ".mkv"],
    sound: [".wav", ".mp3", ".ogg", ".flac", ".m4a", ".opus"],
  };
  const WORD = { images: ["picture", "pictures"], video: ["video", "videos"], sound: ["sound", "sounds"] };
  /** a file name -> "images" | "video" | "sound" | null */
  function kindOf(name) {
    const m = /(\.[^.\\/]+)$/.exec(String(name || "").toLowerCase());
    if (!m) return null;
    for (const k of Object.keys(EXTS)) if (EXTS[k].includes(m[1])) return k;
    return null;
  }
  /** the accept="" for a kind (extensions, so the Open dialog's filter names them) */
  function accept(kind) { return (EXTS[kind] || []).join(","); }
  /** files -> {mine: [...the kind], other: [...another supported kind], bad: [...not supported]} */
  function split(files, kind) {
    const out = { mine: [], other: [], bad: [] };
    for (const f of Array.from(files || [])) {
      const k = kindOf(f && f.name);
      (k === kind ? out.mine : k ? out.other : out.bad).push(f);
    }
    return out;
  }
  /** how many more fit: cap - used (never below 0; no cap = Infinity) */
  function room(used, cap) { return cap == null ? Infinity : Math.max(0, cap - (used || 0)); }
  /** the tile's words: "+ add video" (one place left) / "+ add videos" / "+ add videos (2 free)" */
  function label(kind, free, cap) {
    const w = WORD[kind] || ["file", "files"];
    if (free === 1) return "+ add " + w[0];
    if (cap != null && isFinite(free) && free < cap) return "+ add " + w[1] + " (" + free + " free)";
    return "+ add " + w[1];
  }

  /* ================================ DOM ================================ */
  /** open the picker for `kind` (several at once) and hand the chosen files to onFiles */
  function pick(kind, onFiles, multi) {
    const doc = root.document;
    const inp = doc.createElement("input");
    inp.type = "file"; inp.multiple = multi !== false; inp.accept = accept(kind);
    inp.dataset.addtile = kind;
    inp.onchange = () => { const fs = Array.from(inp.files || []); if (fs.length) onFiles(fs); };
    inp.click();
    return inp;
  }
  /** a placeholder tile: {kind, free, cap, title, onFiles, multi} -> element */
  function make(o) {
    const doc = root.document;
    const el = doc.createElement("div");
    el.className = "addtile";
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.dataset.addkind = o.kind;
    el.innerHTML = '<span class="atplus">+</span><span class="atword"></span>';
    const txt = label(o.kind, o.free == null ? Infinity : o.free, o.cap);
    el.querySelector(".atword").textContent = txt.replace(/^\+\s*/, "");
    el.title = o.title || ("Add " + (WORD[o.kind] || ["file", "files"])[1] + " - Ctrl-click or Shift-click to pick several");
    el.setAttribute("aria-label", txt);
    const go = () => pick(o.kind, o.onFiles, o.multi);
    el.onclick = (e) => { e.stopPropagation(); go(); };
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    el.draggable = false;
    el.addEventListener("dragover", (e) => {
      if (!Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes("Files")) return;
      e.preventDefault(); el.classList.add("hot");
    });
    el.addEventListener("dragleave", () => el.classList.remove("hot"));
    el.addEventListener("drop", (e) => {
      el.classList.remove("hot");
      const fs = e.dataTransfer && e.dataTransfer.files;
      if (!fs || !fs.length) return;
      e.preventDefault(); e.stopPropagation();          // the dock's own drop would import them a second time
      o.onFiles(Array.from(fs));
    });
    return el;
  }

  const api = { EXTS, kindOf, accept, split, room, label, pick, make };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.AddTile = api;
})(typeof window !== "undefined" ? window : globalThis);

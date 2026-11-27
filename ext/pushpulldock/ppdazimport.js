/* bitGen Studio — ext/pushpulldock/ppdazimport.js (2.993.0): ⤓ IMPORT DAZ CONTENT (window.H3DazImport).
 * Tim: "in sketcher when daz dockers are visible add an import button next to my library, open a dialog, the dialog will have a
 * create new library folder, create a library structure in the selected folder (from folder select), add an import button, allow
 * user to select folders, look through all the folders for zip files, extract them to the right location."
 * The ⤓ button sits in the 📚 DAZ Library docker's title (ppdaztools.js #dzImport). The dialog (#dziDlg):
 *   1 The library: one of your library folders (#dziLib) or 📂 another (#dziPick); ＋ New library folder… (#dziNewBox: where
 *     #dziParent / 📂 #dziParentPick, its name #dziName, #dziNewGo); ▦ Make the library folders here (#dziMake);
 *     ☑ #dziAddRoot = it becomes one of your library folders.
 *   2 The zips: folders to look in (#dziSrc rows, ＋ Add a folder… #dziAdd, ✕ each), ☑ #dziRec subfolders too, 🔍 Find the zips
 *     (#dziScan) -> #dziList rows (a tick each, what it holds: a DIM package / Daz content / zips inside / not Daz content).
 *   3 ⤓ Import (#dziGo) -> the job (polled): #dziBar, #dziMsg, #dziLog; ■ Stop (#dziStop); ☑ #dziOver replaces files that are
 *     there (else they are kept). Done -> the library is read again.
 * Folders come from the app's own folder picker (window.FileDialog, the server's disk) - a typed path works too.
 * Not a replacement for Daz Studio / DIM - light tasks: it unpacks product zips as they are laid out (lib/dazImport.js).
 *   open(), close(), state(), scan(), go(), info()
 */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const S = { src: [], zips: [], poll: 0, lib: "" };
  const KIND = { dim: "📦 a DIM package", daz: "🧬 Daz content", zips: "🗜 zips inside", none: "⚠ not Daz content - left out", bad: "⚠ can't read it" };
  const NOTE = "Unpacks Daz product zips into a library folder, the way they are laid out (data, People, Runtime …). Not a replacement for Daz Studio or its Install Manager - light tasks.";
  function esc(s) { return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }
  async function jget(u) { const r = await root.fetch(u), j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j; }
  async function jpost(u, b) { const r = await root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }), j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j; }
  function msg(t, bad) { const m = $("dziMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } }
  function mb(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1) + " GB" : (n / 1048576).toFixed(n >= 104857600 ? 0 : 1) + " MB"; }
  /** a folder from the app's picker (the server's disk) - or typed */
  function pick(title, start) {
    if (root.FileDialog && root.FileDialog.open) return root.FileDialog.open({ mode: "dir", title, okLabel: "Select", key: "dazimport", start: start || "" }).then((x) => (x ? x.path || x.dir || "" : ""));
    const t = root.prompt ? root.prompt(title, start || "") : ""; return Promise.resolve(t ? t.trim() : "");
  }
  function css() {
    if ($("dziCss")) return;
    const s = doc.createElement("style"); s.id = "dziCss";
    s.textContent = "#dziDlg{padding:0;border:1px solid var(--line,#3a352d);border-radius:8px;background:var(--panel,#1b1915);color:var(--fg,#e8e2d4);width:min(860px,96vw);max-height:94vh}"
      + "#dziDlg .dzi{display:flex;flex-direction:column;max-height:94vh}.dzi-bar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line,#3a352d);cursor:move}.dzi-bar b{flex:1;font-size:13px}"
      + ".dzi-body{padding:10px;overflow:auto;display:flex;flex-direction:column;gap:10px;font-size:12px}.dzi-sec{border:1px solid var(--line,#3a352d);border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:6px}"
      + ".dzi-sec>b{font-size:12px}.dzi-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.dzi-row select,.dzi-row input[type=text]{flex:1;min-width:180px}"
      + ".dzi-src{display:flex;flex-direction:column;gap:3px}.dzi-src div{display:flex;gap:6px;align-items:center}.dzi-src code{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + "#dziList{max-height:240px;overflow:auto;border:1px solid var(--line,#3a352d);border-radius:5px}#dziList label{display:flex;gap:6px;align-items:center;padding:3px 6px;border-bottom:1px solid #ffffff10}"
      + "#dziList label span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#dziList small{opacity:.75;white-space:nowrap}#dziList label.no{opacity:.55}"
      + ".dzi-foot{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--line,#3a352d);flex-wrap:wrap}#dziMsg{flex:1;min-width:200px}#dziMsg.bad{color:#ff9aa4}"
      + "#dziBar{height:6px;border-radius:3px;background:#ffffff14;overflow:hidden}#dziBar i{display:block;height:100%;width:0;background:#38e1ff}"
      + "#dziDlg [hidden]{display:none!important}"   // the rows are display flex - [hidden] alone would not hide them
      + "#dziLog{max-height:140px;overflow:auto;font:11px/1.4 monospace;white-space:pre-wrap;opacity:.85}.dzi-note{opacity:.7;font-size:11px}";
    doc.head.appendChild(s);
  }
  function ensure() {
    let d = $("dziDlg"); if (d) return d;
    css();
    d = doc.createElement("dialog"); d.id = "dziDlg"; d.setAttribute("aria-label", "Import Daz content");
    d.innerHTML = '<div class="dzi">'
      + '<div class="dzi-bar" data-dlg-drag title="Drag to move"><b>⤓ Import Daz content</b><button type="button" class="ghost" id="dziX" title="Close (Esc) - an import keeps going">✕</button></div>'
      + '<div class="dzi-body"><div class="dzi-note">' + esc(NOTE) + '</div>'
      + '<div class="dzi-sec"><b>1 · The library to import into</b>'
      + '<div class="dzi-row"><select id="dziLib" title="One of your library folders (📁 in the DAZ Library docker)"></select><button type="button" class="ghost" id="dziPick" title="Another folder">📂 Another…</button></div>'
      + '<div class="dzi-row"><button type="button" class="ghost" id="dziNew" aria-expanded="false" title="A new, empty library folder with the Daz layout">＋ New library folder…</button>'
      + '<button type="button" class="ghost" id="dziMake" title="Make the library folders (data, People, Props, Runtime …) in the folder picked above - nothing is removed">▦ Make the library folders here</button>'
      + '<label title="It becomes one of the library folders the DAZ Library docker reads"><input type="checkbox" id="dziAddRoot" checked> add it to my library folders</label></div>'
      + '<div class="dzi-row" id="dziNewBox" hidden><input type="text" id="dziParent" placeholder="the folder it goes in" title="Where the new library folder goes"><button type="button" class="ghost" id="dziParentPick">📂</button>'
      + '<input type="text" id="dziName" value="My DAZ Library" title="The new folder\'s name" style="flex:0 1 200px;min-width:120px"><button type="button" class="primary" id="dziNewGo">Create</button></div></div>'
      + '<div class="dzi-sec"><b>2 · Where your zips are</b><div class="dzi-src" id="dziSrc"></div>'
      + '<div class="dzi-row"><button type="button" class="ghost" id="dziAdd" title="A folder to look in for .zip files">＋ Add a folder…</button>'
      + '<label title="Look in every folder inside it too"><input type="checkbox" id="dziRec" checked> its subfolders too</label>'
      + '<button type="button" class="primary" id="dziScan" title="Look for .zip files and see what each one holds">🔍 Find the zips</button>'
      + '<span style="flex:1"></span><label><input type="checkbox" id="dziAll" checked> all</label></div><div id="dziList" hidden></div></div>'
      + '<div class="dzi-sec"><b>3 · Import</b><div class="dzi-row"><label title="A file that is already in the library is replaced (else it is kept as it is)"><input type="checkbox" id="dziOver"> replace files that are there</label></div>'
      + '<div id="dziBar"><i></i></div><div id="dziLog"></div></div></div>'
      + '<div class="dzi-foot"><span id="dziMsg" role="status"></span><button type="button" class="ghost" id="dziStop" hidden>■ Stop</button><button type="button" class="primary" id="dziGo" disabled title="Unpack the ticked zips into the library">⤓ Import</button></div></div>';
    doc.body.appendChild(d);
    $("dziX").onclick = close;
    $("dziPick").onclick = async () => { const p = await pick("The library folder to import into", libNow()); if (p) setLib(p, true); };
    $("dziLib").onchange = () => { S.lib = $("dziLib").value; paintGo(); };
    $("dziNew").onclick = () => { const b = $("dziNewBox"); b.hidden = !b.hidden; $("dziNew").setAttribute("aria-expanded", b.hidden ? "false" : "true"); if (!b.hidden) $("dziName").focus(); };
    $("dziParentPick").onclick = async () => { const p = await pick("Where the new library folder goes", $("dziParent").value); if (p) $("dziParent").value = p; };
    $("dziNewGo").onclick = newLib;
    $("dziMake").onclick = makeHere;
    $("dziAdd").onclick = async () => { const p = await pick("A folder with your Daz zips", S.src[S.src.length - 1] || ""); if (p) addSrc(p); };
    $("dziSrc").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b) { S.src.splice(+b.dataset.del, 1); paintSrc(); } });
    $("dziScan").onclick = scan;
    $("dziAll").onchange = () => { d.querySelectorAll("#dziList input[data-z]:not(:disabled)").forEach((x) => { x.checked = $("dziAll").checked; }); paintGo(); };
    $("dziList").addEventListener("change", paintGo);
    $("dziGo").onclick = go;
    $("dziStop").onclick = () => { jpost("/api/dazlib/import/cancel").catch(() => {}); msg("■ stopping after this file…"); };
    d.addEventListener("keydown", (e) => e.stopPropagation());   // the Sketcher's keys stay out of the boxes
    return d;
  }
  function libNow() { return S.lib || ($("dziLib") && $("dziLib").value) || ""; }
  function setLib(p, other) {
    const sel = $("dziLib"); if (!sel) return;
    if (other && ![...sel.options].some((o) => o.value === p)) { const o = doc.createElement("option"); o.value = p; o.textContent = "📂 " + p; sel.appendChild(o); }
    sel.value = p; S.lib = p; paintGo();
  }
  async function loadRoots() {
    try {
      const j = await jget("/api/dazlib"), sel = $("dziLib"), keep = libNow(), all = (j.roots || []).concat((j.detected || []).filter((x) => (j.roots || []).indexOf(x) < 0));
      sel.innerHTML = all.length ? all.map((r) => '<option value="' + esc(r) + '">' + esc(((j.roots || []).indexOf(r) >= 0 ? "📚 " : "🔎 ") + r) + "</option>").join("") : '<option value="">(no library folder yet - ＋ New library folder…)</option>';
      if (keep && all.indexOf(keep) < 0) setLib(keep, true); else if (keep) sel.value = keep;
      S.lib = sel.value; paintGo();
    } catch (e) { msg("⚠ " + e.message, true); }
  }
  async function newLib() {
    const parent = $("dziParent").value.trim(), name = $("dziName").value.trim();
    if (!parent) { msg("📂 pick where the new library folder goes", true); return; }
    try {
      const j = await jpost("/api/dazlib/library", { parent, name, add: $("dziAddRoot").checked });
      msg("＋ " + (j.existed ? "the folder was there - " : "made ") + j.dir + (j.made.length ? " with " + j.made.length + " library folders" : " (its library folders were there)") + (j.roots ? " · added to your library folders" : ""));
      $("dziNewBox").hidden = true; await loadRoots(); setLib(j.dir, true); refreshLib();
    } catch (e) { msg("⚠ " + e.message, true); }
  }
  async function makeHere() {
    const dir = libNow(); if (!dir) { msg("📂 pick a folder first", true); return; }
    try { const j = await jpost("/api/dazlib/structure", { dir, add: $("dziAddRoot").checked }); msg("▦ " + (j.made.length ? "made " + j.made.join(", ") : "the library folders were all there") + " in " + dir); if (j.roots) { await loadRoots(); setLib(dir, true); refreshLib(); } }
    catch (e) { msg("⚠ " + e.message, true); }
  }
  function addSrc(p) { if (S.src.indexOf(p) < 0) S.src.push(p); paintSrc(); }
  function paintSrc() {
    $("dziSrc").innerHTML = S.src.length ? S.src.map((p, i) => '<div><code title="' + esc(p) + '">📁 ' + esc(p) + '</code><button type="button" class="ghost" data-del="' + i + '" title="Not this folder">✕</button></div>').join("")
      : '<span class="dzi-note">No folder yet - ＋ Add a folder… (your Downloads, a backup drive …)</span>';
  }
  async function scan() {
    if (!S.src.length) { msg("＋ add a folder to look in first", true); return null; }
    msg("🔍 looking for zips…"); $("dziScan").disabled = true;
    try {
      const j = await jpost("/api/dazlib/zips", { folders: S.src, recursive: $("dziRec").checked });
      S.zips = j.zips || [];
      const ok = (z) => z.kind === "dim" || z.kind === "daz" || z.kind === "zips";
      $("dziList").hidden = !S.zips.length;
      $("dziList").innerHTML = S.zips.map((z, i) => '<label class="' + (ok(z) ? "" : "no") + '" title="' + esc(z.path + (z.error ? " - " + z.error : z.tops && z.tops.length ? " - " + z.tops.join(", ") : "")) + '"><input type="checkbox" data-z="' + i + '"' + (ok(z) ? " checked" : " disabled") + '><span>' + esc(z.path) + "</span><small>" + esc((KIND[z.kind] || z.kind) + (z.files ? " · " + z.files + " file" + (z.files === 1 ? "" : "s") : "") + (z.nested ? " + " + z.nested + " zip" + (z.nested === 1 ? "" : "s") + " inside" : "") + " · " + mb(z.size || 0)) + "</small></label>").join("");
      const n = S.zips.filter(ok).length;
      msg(S.zips.length ? "🔍 " + S.zips.length + " zip" + (S.zips.length === 1 ? "" : "s") + " found - " + n + " with Daz content" + (j.more ? " (5000 at most - add fewer folders)" : "") : "🔍 no .zip files in " + (S.src.length === 1 ? "that folder" : "those folders"), !n);
      paintGo(); return S.zips;
    } catch (e) { msg("⚠ " + e.message, true); return null; }
    finally { $("dziScan").disabled = false; }
  }
  function picked() { return [...doc.querySelectorAll("#dziList input[data-z]:checked")].map((x) => S.zips[+x.dataset.z].path); }
  function paintGo() { const g = $("dziGo"); if (g) g.disabled = !(libNow() && picked().length) || !!S.poll; }
  async function go() {
    const zips = picked(), library = libNow();
    if (!library) { msg("1 · pick the library folder first", true); return null; }
    if (!zips.length) { msg("2 · find the zips and tick some", true); return null; }
    try { const j = await jpost("/api/dazlib/import", { library, zips, overwrite: $("dziOver").checked }); paintJob(j); follow(); return j; }
    catch (e) { msg("⚠ " + e.message, true); return null; }
  }
  function follow() {
    root.clearInterval(S.poll);
    S.poll = root.setInterval(async () => {
      let j = null; try { j = await jget("/api/dazlib/import"); } catch (e) { return; }
      paintJob(j);
      if (j.state !== "running") { root.clearInterval(S.poll); S.poll = 0; paintGo(); refreshLib(); }
    }, 500);
    paintGo();
  }
  function paintJob(j) {
    if (!j || j.state === "none") return;
    S.job = j;
    $("dziBar").firstChild.style.width = (j.total ? Math.round(100 * j.done / j.total) : 0) + "%";
    $("dziStop").hidden = j.state !== "running";
    $("dziLog").textContent = (j.results || []).map((r) => (r.errors && r.errors.length && !r.written ? "⚠ " : "✓ ") + r.file.split(/[\\/]/).pop() + " - " + r.written + " file" + (r.written === 1 ? "" : "s") + (r.kept ? ", " + r.kept + " kept (there)" : "") + (r.nested ? ", " + r.nested + " zip(s) inside" : "") + (r.errors && r.errors.length ? " · " + r.errors.slice(0, 2).join("; ") : "")).join("\n");
    $("dziLog").scrollTop = 1e9;
    if (j.state === "running") msg("⤓ " + j.done + " of " + j.total + (j.current ? " - " + j.current : "") + "…");
    else msg((j.state === "cancelled" ? "■ stopped - " : "✓ done - ") + j.written + " files into " + j.library + (j.kept ? " · " + j.kept + " were there (kept)" : "") + " · " + mb(j.bytes || 0) + " - the DAZ Library reads it again");
  }
  function refreshLib() { try { const r = $("dzRefresh"); if (r) r.click(); } catch (e) { /* fine */ } }
  function open() {
    const d = ensure(); if (!d.open) d.showModal();
    paintSrc(); loadRoots();
    jget("/api/dazlib/import").then((j) => { if (j && j.state === "running") { paintJob(j); follow(); } }).catch(() => {});
    return true;
  }
  function close() { const d = $("dziDlg"); if (d && d.open) d.close(); return true; }
  root.H3DazImport = { open, close, scan, go, addSrc, setLib, NOTE, KIND,
    state: () => S, info: () => ({ open: !!($("dziDlg") && $("dziDlg").open), lib: libNow(), src: S.src.slice(), zips: S.zips.length, picked: picked().length, job: S.job || null }) };
})(typeof window !== "undefined" ? window : globalThis);

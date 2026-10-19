/* bitGen Studio — THE FILE / FOLDER DIALOG (2.326.0).
 *
 * Tim (verbatim): "please create a file select and folder select dialog that
 * looks and behaves like the windows 11 ones, but build it with nodejs and
 * python. we will replace all the folder select and file select with these
 * dialogs to try and make the app cross platform compatible".
 *
 * A Windows 11 style Open / Select Folder dialog drawn in the page, over the
 * routes in routes/filedialog.js (Node lists and searches, Python makes the
 * thumbnails and knows the real Desktop / Documents / drives). Same look and
 * behaviour on Windows, macOS and Linux:
 *
 *   title bar (drag to move) · ← → ↑ ↻ · the address bar (breadcrumbs;
 *   click it to type a path) · "Search <folder>" · New folder · Rename ·
 *   Details / Large icons (thumbnails) · the navigation pane (Quick access,
 *   bitGen Studio, This PC with drive space) · sortable columns · File name
 *   + the file-type filter · Open / Select Folder · Cancel. Double-click a
 *   folder to go in, a file to open it; Ctrl / Shift-click for several where
 *   the caller takes several; F2 renames; Backspace / Alt+↑ goes up; Alt+← /
 *   Alt+→ back / forward; F5 refreshes; typing jumps to a name; Esc cancels.
 *   Right-click: Open, Rename, New folder, Copy path, Refresh.
 *
 * window.FileDialog = {
 *   open({mode: "file"|"dir"|"save", multi, title, okLabel, filters: [{label, exts}],
 *         start, key, name}) -> Promise<null | {path, paths[], dir, base, sep, overwrite}>
 *     2.359.0 mode "save" (Save As): the folder's files are listed, File name starts as `name`, Save
 *     returns the typed path (it need not exist); a name that exists asks once in the footer and a
 *     second Save replaces it ({overwrite: true}); a typed folder name goes into that folder
 *   pickInto(input)   the upload shim - fills an <input type=file> from disk
 *   enabled           false = every <input type=file> uses the browser's own
 *   pure helpers (tested): parseAccept, crumbs, joinPath, sortEntries,
 *   fmtSize, parseNames, quoteNames, isLocalPage
 * }
 *
 * THE UPLOAD SHIM: every <input type="file"> in the app - clicked, reached
 * through its <label>, or .click()ed from code - opens THIS dialog instead
 * of the browser's; the picked files are read from disk (/api/fdlg/file)
 * and handed to the input exactly as the browser would (input.files +
 * input / change events), so every existing upload keeps working untouched.
 * Only on a page opened on this machine (the dialog browses THIS disk); the
 * phone remote and a LAN browser keep their own pickers. data-native-picker
 * on an input opts it out; Settings -> General turns the shim off. */
(function () {
  "use strict";
  var LS = "fdlg.";
  function sget(k, d) { try { var v = localStorage.getItem(LS + k); return v == null ? d : v; } catch (e) { return d; } }
  function sset(k, v) { try { localStorage.setItem(LS + k, v); } catch (e) {} }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------------------------------------------------------------- icons
  var PAGE = '<path d="M6.5 2h7.2L19 7.3V20a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#f4f4f4"/>'
    + '<path d="M13.7 2v4.2c0 .6.5 1.1 1.1 1.1H19z" fill="#c9c9c9"/>';
  function svg(inner, vb) { return '<svg viewBox="' + (vb || "0 0 24 24") + '" aria-hidden="true">' + inner + "</svg>"; }
  var ICON = {
    folder: svg('<path d="M2 6.6A2.6 2.6 0 0 1 4.6 4h4.3c.5 0 1 .2 1.3.5L12 6.3h7.4A2.6 2.6 0 0 1 22 8.9v8.5a2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 17.4z" fill="#e8a33d"/>'
      + '<path d="M2 9.2c0-.7.6-1.3 1.3-1.3h17.4c.7 0 1.3.6 1.3 1.3v8.2a2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 17.4z" fill="#ffc94a"/>'),
    file: svg(PAGE),
    image: svg(PAGE + '<rect x="7" y="11" width="9.5" height="7" rx="1" fill="#3b8fd9"/><path d="M7 18l3-3.4 2 2.2 1.4-1.4 3.1 2.6z" fill="#57b85f"/><circle cx="14.2" cy="13" r="1" fill="#ffd54a"/>'),
    video: svg(PAGE + '<rect x="6.8" y="11" width="10" height="7" rx="1.2" fill="#8a5cd6"/><path d="M10.6 12.8v3.4l2.9-1.7z" fill="#fff"/>'),
    audio: svg(PAGE + '<path d="M13.6 10.5v5.3a1.9 1.9 0 1 1-1.2-1.7v-4.4l3.3-.8v1.4z" fill="#f08a24"/>'),
    model: svg(PAGE + '<rect x="7" y="11.5" width="10" height="6" rx="1" fill="#2d7d9a"/><text x="12" y="16.3" font-size="4.3" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial" font-weight="700">AI</text>'),
    archive: svg(PAGE + '<rect x="10.3" y="4" width="2.2" height="14" fill="#d7a23a"/><rect x="9.8" y="15" width="3.2" height="3" rx=".6" fill="#8d6417"/>'),
    code: svg(PAGE + '<path d="M9.8 12.3l-2 2.1 2 2.1M14.2 12.3l2 2.1-2 2.1" stroke="#3b8fd9" stroke-width="1.3" fill="none" stroke-linecap="round"/>'),
    text: svg(PAGE + '<path d="M8 11.5h8M8 13.8h8M8 16.1h5" stroke="#8a8a8a" stroke-width="1.1" stroke-linecap="round"/>'),
    drive: svg('<rect x="2.5" y="8" width="19" height="9" rx="2" fill="#aeb4bb"/><rect x="2.5" y="13.5" width="19" height="3.5" rx="1.2" fill="#6f767e"/><circle cx="18.5" cy="15.2" r=".9" fill="#5ad16b"/>'),
    usb: svg('<rect x="7" y="3" width="10" height="7" rx="1" fill="#aeb4bb"/><rect x="5" y="9" width="14" height="12" rx="2.2" fill="#6f767e"/><rect x="9" y="5" width="2" height="2" fill="#555"/><rect x="13" y="5" width="2" height="2" fill="#555"/>'),
    network: svg('<rect x="3" y="6" width="18" height="9" rx="2" fill="#aeb4bb"/><path d="M12 15v4M7 19h10" stroke="#6fa8dc" stroke-width="1.6" stroke-linecap="round"/>'),
    desktop: svg('<rect x="2.5" y="4" width="19" height="12.5" rx="1.6" fill="#2f8fdb"/><rect x="4" y="5.5" width="16" height="9.5" rx=".8" fill="#6ec1ff"/><path d="M9 20h6M12 16.5V20" stroke="#9aa0a6" stroke-width="1.6" stroke-linecap="round"/>'),
    downloads: svg('<circle cx="12" cy="12" r="9.5" fill="#1f9e6a"/><path d="M12 6.5v8M8.6 11.3L12 14.7l3.4-3.4M8 17.5h8" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    documents: svg('<path d="M6.5 2h7.2L19 7.3V20a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#5aa2f0"/><path d="M8 11h8M8 14h8M8 17h5" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>'),
    pictures: svg('<rect x="2.5" y="4.5" width="19" height="15" rx="2" fill="#3b8fd9"/><path d="M2.5 17l5.5-6 4 4.3 2.6-2.6 6.9 6.1V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18z" fill="#57b85f"/><circle cx="16.5" cy="8.8" r="1.8" fill="#ffd54a"/>'),
    videos: svg('<rect x="2.5" y="5" width="19" height="14" rx="2" fill="#8a5cd6"/><path d="M10 9.2v5.6l4.9-2.8z" fill="#fff"/>'),
    music: svg('<circle cx="12" cy="12" r="9.5" fill="#f08a24"/><path d="M14.3 6.8v7.4a2.3 2.3 0 1 1-1.4-2.1V8.3l-2.7.7" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>'),
    home: svg('<path d="M3.5 11L12 4l8.5 7v8.5a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" fill="#e8a33d"/>'),
    app: svg('<rect x="3" y="3" width="18" height="18" rx="4.5" fill="#f59e2c"/><text x="12" y="16.5" font-size="11" text-anchor="middle" fill="#14120f" font-family="Segoe UI,Arial" font-weight="800">b</text>'),
    project: svg('<path d="M2 6.6A2.6 2.6 0 0 1 4.6 4h4.3c.5 0 1 .2 1.3.5L12 6.3h7.4A2.6 2.6 0 0 1 22 8.9v8.5a2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 17.4z" fill="#c4761a"/><path d="M2 9.2c0-.7.6-1.3 1.3-1.3h17.4c.7 0 1.3.6 1.3 1.3v8.2a2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 17.4z" fill="#f59e2c"/>'),
    comfy: svg('<rect x="3" y="3" width="18" height="18" rx="4.5" fill="#1f5fbf"/><text x="12" y="16.5" font-size="10.5" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial" font-weight="800">C</text>'),
    pc: svg('<rect x="2.5" y="4" width="19" height="12.5" rx="1.6" fill="#5b6770"/><rect x="4" y="5.5" width="16" height="9.5" rx=".8" fill="#9ad0ff"/><path d="M9 20h6M12 16.5V20" stroke="#9aa0a6" stroke-width="1.6" stroke-linecap="round"/>'),
    search: svg('<circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  };
  function iconFor(e) { return e.dir ? ICON.folder : (ICON[e.kind] || ICON.file); }

  // ------------------------------------------------------------ pure helpers
  var MIME_EXT = {
    "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"], "image/bmp": [".bmp"], "image/jxl": [".jxl"],
    "image/gif": [".gif"], "image/svg+xml": [".svg"], "image/tiff": [".tif", ".tiff"],
    "video/mp4": [".mp4", ".m4v"], "video/webm": [".webm"], "video/quicktime": [".mov"],
    "video/x-matroska": [".mkv"], "audio/wav": [".wav"], "audio/x-wav": [".wav"], "audio/mpeg": [".mp3"],
    "audio/flac": [".flac"], "audio/ogg": [".ogg", ".opus"], "application/json": [".json"],
    "application/zip": [".zip"], "text/plain": [".txt"],
  };
  var FAMILY = {
    image: { label: "Image files", exts: [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".jxl"] },
    video: { label: "Video files", exts: [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"] },
    audio: { label: "Audio files", exts: [".wav", ".mp3", ".flac", ".ogg", ".opus", ".m4a", ".aac"] },
  };
  var ALL = { label: "All files", exts: [] };

  function uniq(a) { var o = []; a.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }
  function filterLabel(f) {
    return f.exts && f.exts.length ? f.label + " (" + f.exts.map(function (e) { return "*" + e; }).join(";") + ")"
      : f.label + " (*.*)";
  }

  /** An <input accept="..."> -> the dialog's file-type list, Windows style:
   *  the combined filter first, one per family when mixed, "All files" last. */
  function parseAccept(accept) {
    var parts = String(accept || "").split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    if (!parts.length) return [ALL];
    var fams = [], exts = [];
    parts.forEach(function (p) {
      var m = /^(image|video|audio)\/\*$/.exec(p);
      if (m) { fams.push(m[1]); exts = exts.concat(FAMILY[m[1]].exts); return; }
      if (MIME_EXT[p]) { exts = exts.concat(MIME_EXT[p]); return; }
      if (p.charAt(0) === ".") { exts.push(p); return; }
      var f = /^(image|video|audio)\//.exec(p);
      if (f) { exts.push("." + p.split("/")[1].replace(/^x-/, "")); }
    });
    exts = uniq(exts);
    if (!exts.length) return [ALL];
    var out = [];
    if (fams.length === 1 && exts.length === FAMILY[fams[0]].exts.length) out.push(FAMILY[fams[0]]);
    else {
      var one = fams.length === 1 ? fams[0] : null;
      if (!fams.length) ["image", "video", "audio"].forEach(function (k) {
        if (exts.every(function (e) { return FAMILY[k].exts.indexOf(e) >= 0; })) one = one || k;
      });
      out.push({ label: one ? FAMILY[one].label : "Supported files", exts: exts });
    }
    if (fams.length > 1) fams.forEach(function (f) { out.push(FAMILY[f]); });
    out.push(ALL);
    return out;
  }

  /** The address bar's segments: C:\a\b -> C: › a › b ; /a/b -> / › a › b. */
  function crumbs(dir, sep) {
    var d = String(dir || "");
    sep = sep || (d.indexOf("\\") >= 0 ? "\\" : "/");
    var out = [];
    if (sep === "\\") {
      var m = /^([a-z]:)\\?/i.exec(d) || /^(\\\\[^\\]+\\[^\\]+)\\?/.exec(d);
      if (!m) return [{ name: d, path: d }];
      var root = m[1] + "\\";
      out.push({ name: m[1], path: root });
      var acc = root;
      d.slice(m[0].length).split("\\").filter(Boolean).forEach(function (s) {
        acc = acc.replace(/\\$/, "") + "\\" + s; out.push({ name: s, path: acc });
      });
      return out;
    }
    out.push({ name: "/", path: "/" });
    var a = "";
    d.split("/").filter(Boolean).forEach(function (s) { a += "/" + s; out.push({ name: s, path: a }); });
    return out;
  }

  function joinPath(dir, name, sep) {
    sep = sep || "/";
    return String(dir).replace(/[\\/]+$/, "") + sep + name;
  }
  function baseName(p) { return String(p).replace(/[\\/]+$/, "").split(/[\\/]/).pop(); }
  function isAbs(p) { return /^([a-z]:[\\/]|\\\\|\/|~)/i.test(String(p)); }

  var collator = (typeof Intl !== "undefined" && Intl.Collator)
    ? new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }) : null;
  function cmpName(a, b) { return collator ? collator.compare(a, b) : (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0); }

  /** Explorer's order: folders first, then the column (natural name order). */
  function sortEntries(list, key, desc) {
    var k = key || "name", s = desc ? -1 : 1;
    return list.slice().sort(function (a, b) {
      if (a.dir !== b.dir) return a.dir ? -1 : 1;
      var r = 0;
      if (k === "mtime") r = (a.mtime || 0) - (b.mtime || 0);
      else if (k === "size") r = (a.size || 0) - (b.size || 0);
      else if (k === "type") r = cmpName(a.type || "", b.type || "");
      if (!r) r = cmpName(a.name, b.name);
      return r * s;
    });
  }

  /** Explorer's Size column: whole KB, rounded up, grouped. */
  function fmtSize(n) {
    if (n == null) return "";
    var kb = Math.max(n > 0 ? 1 : 0, Math.ceil(n / 1024));
    return kb.toLocaleString("en-US") + " KB";
  }
  function fmtBytes(n) {
    if (n == null) return "";
    var u = ["bytes", "KB", "MB", "GB", "TB"], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i ? n.toFixed(n < 10 ? 1 : 0) : n) + " " + u[i];
  }
  function fmtDate(ms) {
    if (!ms) return "";
    try { return new Date(ms).toLocaleString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }); }
    catch (e) { return new Date(ms).toISOString().slice(0, 16).replace("T", " "); }
  }

  /** The File name box with several: "a.png" "b.png" -> ["a.png", "b.png"]. */
  function parseNames(text) {
    var t = String(text || "").trim();
    if (!t) return [];
    if (t.indexOf('"') < 0) return [t];
    var out = [], re = /"([^"]*)"/g, m;
    while ((m = re.exec(t))) if (m[1].trim()) out.push(m[1].trim());
    return out;
  }
  function quoteNames(names) {
    return names.length === 1 ? names[0] : names.map(function (n) { return '"' + n + '"'; }).join(" ");
  }

  function isLocalPage(loc) {
    var l = loc || (typeof location !== "undefined" ? location : {});
    return l.protocol === "file:" || ["127.0.0.1", "localhost", "::1", "[::1]"].indexOf(l.hostname) >= 0;
  }

  // ------------------------------------------------------------------- CSS
  var CSS = ""
    + "dialog.fdlg{--fd-bg:#202020;--fd-pane:#1c1c1c;--fd-main:#191919;--fd-line:#2f2f2f;--fd-line2:#3a3a3a;"
    + "--fd-text:#ffffff;--fd-dim:#c5c5c5;--fd-dim2:#9d9d9d;--fd-hover:rgba(255,255,255,.06);--fd-sel:rgba(96,205,255,.16);"
    + "--fd-selb:rgba(96,205,255,.42);--fd-acc:#60cdff;--fd-acc-t:#000;--fd-field:#2b2b2b;--fd-fieldb:#3d3d3d;"
    + "padding:0;margin:auto;border:1px solid #3b3b3b;border-radius:8px;background:var(--fd-bg);color:var(--fd-text);"
    + "width:min(1000px,94vw);height:min(640px,88vh);max-width:98vw;max-height:96vh;min-width:520px;min-height:360px;"
    + "box-shadow:0 32px 64px rgba(0,0,0,.55),0 2px 21px rgba(0,0,0,.4);overflow:hidden;resize:both;"
    + "font:13px/1.35 'Segoe UI Variable Text','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif}"
    + "dialog.fdlg[open]{display:flex;flex-direction:column}"
    + "dialog.fdlg::backdrop{background:rgba(0,0,0,.35)}"
    + "dialog.fdlg *{box-sizing:border-box}"
    + "dialog.fdlg button{font:inherit;color:inherit;background:transparent;border:1px solid transparent;border-radius:4px;"
    + "padding:0 8px;height:30px;min-width:0;cursor:default;display:inline-flex;align-items:center;gap:6px;letter-spacing:normal;text-transform:none;margin:0;box-shadow:none}"
    + "dialog.fdlg button:hover:not(:disabled){background:var(--fd-hover)}"
    + "dialog.fdlg button:disabled{opacity:.38}"
    + "dialog.fdlg input,dialog.fdlg select{font:inherit;color:var(--fd-text);background:var(--fd-field);border:1px solid var(--fd-fieldb);"
    + "border-bottom-color:#8a8a8a;border-radius:4px;height:30px;padding:0 9px;outline:none;width:auto;margin:0;box-shadow:none}"
    + "dialog.fdlg input:focus,dialog.fdlg select:focus{border-bottom:2px solid var(--fd-acc);background:#1f1f1f}"
    + "dialog.fdlg svg{width:16px;height:16px;flex:none;display:block}"
    + ".fdlg .fd-title{display:flex;align-items:center;height:36px;padding:0 0 0 14px;user-select:none;flex:none}"
    + ".fdlg .fd-ttl{flex:1;font-size:12px}"
    + ".fdlg .fd-x{width:46px;height:36px!important;border-radius:0 8px 0 0!important;justify-content:center;font-size:15px}"
    + ".fdlg .fd-x:hover{background:#c42b1c!important}"
    + ".fdlg .fd-nav{display:flex;align-items:center;gap:4px;padding:4px 10px 8px;flex:none}"
    + ".fdlg .fd-nb{width:32px;justify-content:center;font-size:15px}"
    + ".fdlg .fd-addr{flex:1;display:flex;align-items:center;height:32px;background:var(--fd-field);border:1px solid var(--fd-fieldb);"
    + "border-radius:4px;padding:0 4px;min-width:0;overflow:hidden;position:relative}"
    + ".fdlg .fd-addr .fd-pc{margin:0 4px 0 4px}"
    + ".fdlg .fd-crumbs{display:flex;align-items:center;min-width:0;overflow:hidden;flex:1}"
    + ".fdlg .fd-crumb{height:24px!important;padding:0 6px!important;white-space:nowrap}"
    + ".fdlg .fd-chev{color:var(--fd-dim2);padding:0 1px;font-size:11px}"
    + ".fdlg .fd-addrin{position:absolute;inset:0;width:100%!important;height:100%!important;display:none}"
    + ".fdlg .fd-addr.editing .fd-addrin{display:block}"
    + ".fdlg .fd-search{position:relative;width:min(260px,28%)}"
    + ".fdlg .fd-search input{width:100%;padding-right:30px;height:32px}"
    + ".fdlg .fd-search svg{position:absolute;right:9px;top:8px;color:var(--fd-dim)}"
    + ".fdlg .fd-cmd{display:flex;align-items:center;gap:2px;padding:4px 10px;border-top:1px solid var(--fd-line);border-bottom:1px solid var(--fd-line);flex:none}"
    + ".fdlg .fd-cmd .fd-sepv{width:1px;height:20px;background:var(--fd-line2);margin:0 6px}"
    + ".fdlg .fd-cmd .on{background:var(--fd-hover)}"
    + ".fdlg .fd-count{margin-left:auto;color:var(--fd-dim2);font-size:12px}"
    + ".fdlg .fd-body{flex:1;display:flex;min-height:0}"
    + ".fdlg .fd-side{width:210px;flex:none;overflow:auto;padding:6px 4px 10px;background:var(--fd-pane);border-right:1px solid var(--fd-line)}"
    + ".fdlg .fd-sh{font-size:11px;color:var(--fd-dim2);padding:10px 10px 3px;text-transform:none;letter-spacing:.02em}"
    + ".fdlg .fd-si{display:flex;align-items:center;gap:9px;width:100%;height:30px!important;padding:0 10px!important;text-align:left;justify-content:flex-start}"
    + ".fdlg .fd-si span.l{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".fdlg .fd-si.cur{background:var(--fd-sel)!important}"
    + ".fdlg .fd-bar{display:block;height:4px;border-radius:2px;background:#3a3a3a;margin:1px 10px 6px 35px;overflow:hidden}"
    + ".fdlg .fd-bar i{display:block;height:100%;background:var(--fd-acc)}"
    + ".fdlg .fd-bar i.full{background:#ff6b6b}"
    + ".fdlg .fd-main{flex:1;overflow:auto;background:var(--fd-main);outline:none;position:relative}"
    + ".fdlg .fd-hdr,.fdlg .fd-row{display:grid;grid-template-columns:minmax(200px,1fr) 175px 130px 100px;align-items:center}"
    + ".fdlg .fd-hdr{position:sticky;top:0;background:var(--fd-main);z-index:1;height:30px;padding:0 8px;border-bottom:1px solid var(--fd-line)}"
    + ".fdlg .fd-hdr button{height:26px!important;color:var(--fd-dim);font-size:12px;justify-content:flex-start;border-radius:0!important;border-right:1px solid var(--fd-line)!important}"
    + ".fdlg .fd-hdr button .ar{margin-left:auto;font-size:9px;opacity:.8}"
    + ".fdlg .fd-list{padding:2px 8px 8px}"
    + ".fdlg .fd-row{height:30px;border-radius:4px;border:1px solid transparent;padding:0 0 0 0;user-select:none}"
    + ".fdlg .fd-row:hover{background:var(--fd-hover)}"
    + ".fdlg .fd-row.sel{background:var(--fd-sel);border-color:var(--fd-selb)}"
    + ".fdlg .fd-row .c{padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fd-dim)}"
    + ".fdlg .fd-row .n{display:flex;align-items:center;gap:8px;color:var(--fd-text)}"
    + ".fdlg .fd-row .n span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".fdlg .fd-row .s{text-align:right}"
    + ".fdlg .fd-row.hid .n{opacity:.6}"
    + ".fdlg .fd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:4px;padding:8px}"
    + ".fdlg .fd-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 4px;border-radius:4px;border:1px solid transparent;user-select:none;min-width:0}"
    + ".fdlg .fd-tile:hover{background:var(--fd-hover)}"
    + ".fdlg .fd-tile.sel{background:var(--fd-sel);border-color:var(--fd-selb)}"
    + ".fdlg .fd-th{width:96px;height:96px;display:flex;align-items:center;justify-content:center}"
    + ".fdlg .fd-th svg{width:72px;height:72px}"
    + ".fdlg .fd-th img{max-width:96px;max-height:96px;object-fit:contain;border-radius:2px;box-shadow:0 1px 4px rgba(0,0,0,.5)}"
    + ".fdlg .fd-tn{font-size:12px;text-align:center;line-height:1.25;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}"
    + ".fdlg .fd-ren{height:24px!important;width:100%!important;padding:0 5px!important}"
    + ".fdlg .fd-empty{color:var(--fd-dim2);text-align:center;padding:40px 10px}"
    + ".fdlg .fd-err{color:#ff99a4}"
    + ".fdlg .fd-foot{display:grid;grid-template-columns:auto 1fr auto;gap:8px 10px;align-items:center;padding:12px 14px;background:var(--fd-pane);border-top:1px solid var(--fd-line);flex:none}"
    + ".fdlg .fd-foot label{color:var(--fd-dim);text-align:right}"
    + ".fdlg .fd-foot .fd-name{width:100%}"
    + ".fdlg .fd-foot select{min-width:220px;max-width:340px}"
    + ".fdlg .fd-btns{grid-column:2/4;display:flex;justify-content:flex-end;gap:8px}"
    + ".fdlg .fd-btns button{min-width:92px;justify-content:center;background:#2d2d2d;border-color:#3a3a3a}"
    + ".fdlg .fd-btns button.pri{background:var(--fd-acc);color:var(--fd-acc-t);border-color:var(--fd-acc)}"
    + ".fdlg .fd-btns button.pri:hover{background:#56b8e6!important}"
    + ".fdlg .fd-msg{grid-column:1/2;color:#ff99a4;font-size:12px;align-self:center}"
    + ".fdlg .fd-menu{position:fixed;z-index:10;background:#2c2c2c;border:1px solid #3d3d3d;border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:180px}"
    + ".fdlg .fd-menu button{width:100%;justify-content:flex-start;height:30px!important}"
    + ".fdlg .fd-menu hr{border:0;border-top:1px solid #3d3d3d;margin:4px 0}"
    + ".fd-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#2c2c2c;color:#fff;border:1px solid #3d3d3d;border-radius:8px;"
    + "padding:9px 14px;font:13px 'Segoe UI',system-ui,sans-serif;z-index:100000;box-shadow:0 8px 24px rgba(0,0,0,.5)}";

  function injectCss() {
    if (document.getElementById("fdlgCss")) return;
    var s = document.createElement("style"); s.id = "fdlgCss"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  // -------------------------------------------------------------- the dialog
  var api = { fetch: function (u, o) { return window.fetch(u, o); } };
  function getJSON(url) { return api.fetch(url).then(function (r) { return r.json(); }); }
  function postJSON(url, body) {
    return api.fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }
  var placesP = null, cur = null;

  function open(opts) {
    var o = opts || {};
    if (cur) cur.cancel();
    injectCss();
    var mode = o.mode === "dir" ? "dir" : o.mode === "save" ? "save" : "file";
    var filters = (o.filters && o.filters.length ? o.filters.slice() : [ALL]);
    if (mode !== "dir" && !filters.some(function (f) { return !f.exts || !f.exts.length; })) filters.push(ALL);
    var S = {
      mode: mode, multi: !!o.multi && mode === "file", filters: filters, fi: 0,
      key: o.key || mode, dir: "", sep: "/", parent: null, entries: [], error: "",
      view: sget("view", "details"), sortKey: sget("sort", "name"), sortDesc: sget("desc", "0") === "1",
      sel: [], anchor: -1, back: [], fwd: [], q: "", results: null, places: null, base: "",
      typed: "", typedAt: 0, loadSeq: 0,
    };
    return new Promise(function (resolve) {
      var dlg = document.createElement("dialog");
      dlg.className = "fdlg";
      var defTitle = mode === "dir" ? "Select Folder" : mode === "save" ? "Save As" : "Open";
      dlg.setAttribute("aria-label", o.title || defTitle);
      dlg.innerHTML =
        '<div class="fd-title"><span class="fd-ttl"></span><button type="button" class="fd-x" aria-label="Close">✕</button></div>'
        + '<div class="fd-nav">'
        + '<button type="button" class="fd-nb fd-back" title="Back (Alt+Left)" aria-label="Back">←</button>'
        + '<button type="button" class="fd-nb fd-fwd" title="Forward (Alt+Right)" aria-label="Forward">→</button>'
        + '<button type="button" class="fd-nb fd-up" title="Up (Alt+Up)" aria-label="Up one level">↑</button>'
        + '<button type="button" class="fd-nb fd-ref" title="Refresh (F5)" aria-label="Refresh">↻</button>'
        + '<div class="fd-addr" title="Click to type a path"><span class="fd-pc">' + ICON.pc + '</span><div class="fd-crumbs"></div>'
        + '<input class="fd-addrin" type="text" spellcheck="false" aria-label="Address"></div>'
        + '<div class="fd-search"><input type="text" spellcheck="false" aria-label="Search">' + ICON.search + "</div></div>"
        + '<div class="fd-cmd">'
        + '<button type="button" class="fd-new" title="New folder (Ctrl+Shift+N)">＋ New folder</button>'
        + '<button type="button" class="fd-rename" title="Rename (F2)">✎ Rename</button>'
        + '<span class="fd-sepv"></span>'
        + '<button type="button" class="fd-vdet" title="Details">☰ Details</button>'
        + '<button type="button" class="fd-vico" title="Large icons">▦ Large icons</button>'
        + '<span class="fd-count"></span></div>'
        + '<div class="fd-body"><nav class="fd-side" aria-label="Navigation pane"></nav>'
        + '<div class="fd-main" tabindex="0" role="listbox"></div></div>'
        + '<div class="fd-foot">'
        + '<label class="fd-nl"></label><input class="fd-name" type="text" spellcheck="false">'
        + '<select class="fd-filter" aria-label="File type"></select>'
        + '<span class="fd-msg"></span>'
        + '<div class="fd-btns"><button type="button" class="pri fd-ok"></button><button type="button" class="fd-cancel">Cancel</button></div>'
        + "</div>";
      document.body.appendChild(dlg);
      var q = function (c) { return dlg.querySelector("." + c); };
      var main = q("fd-main"), side = q("fd-side"), nameIn = q("fd-name"), msg = q("fd-msg"), sbox = q("fd-search").querySelector("input");
      q("fd-ttl").textContent = o.title || defTitle;
      q("fd-nl").textContent = mode === "dir" ? "Folder:" : "File name:";
      if (mode === "dir") nameIn.placeholder = "the folder shown above - or pick / type one";
      q("fd-ok").textContent = o.okLabel || (mode === "dir" ? "Select Folder" : mode === "save" ? "Save" : "Open");
      if (mode === "save") nameIn.value = o.name || "";
      var fsel = q("fd-filter");
      if (mode === "dir") fsel.style.display = "none";
      filters.forEach(function (f, i) { var op = document.createElement("option"); op.value = String(i); op.textContent = filterLabel(f); fsel.appendChild(op); });
      try { var sz = JSON.parse(sget("size", "null")); if (sz && sz.w > 500 && sz.h > 340) { dlg.style.width = sz.w + "px"; dlg.style.height = sz.h + "px"; } } catch (e) {}

      function extsNow() { var f = S.filters[S.fi]; return f && f.exts ? f.exts.join(",") : ""; }
      function say(t) { msg.textContent = t || ""; }

      // ---- finish
      var done = false;
      function finish(paths, overwrite) {
        if (done) return; done = true;
        try { sset("size", JSON.stringify({ w: dlg.offsetWidth, h: dlg.offsetHeight })); } catch (e) {}
        if (S.dir) sset("dir." + S.key, S.dir);
        sset("view", S.view); sset("sort", S.sortKey); sset("desc", S.sortDesc ? "1" : "0");
        try { dlg.close(); } catch (e) {}
        if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        document.removeEventListener("mousedown", closeMenu, true);
        cur = null;
        resolve(paths && paths.length ? { path: paths[0], paths: paths, dir: S.dir, base: S.base, sep: S.sep,
                                          overwrite: !!overwrite } : null);
      }
      function cancel() { finish(null); }

      // ---- the listing
      function shown() {
        var list = S.results ? S.results : S.entries;
        return sortEntries(list, S.sortKey, S.sortDesc);
      }
      function fullOf(e) { return e.path || joinPath(S.dir, e.name, S.sep); }
      var view = [];
      function paint() {
        view = shown();
        var h = "";
        if (S.error) h = '<div class="fd-empty fd-err">' + esc(S.error) + "</div>";
        else if (!view.length) h = '<div class="fd-empty">' + (S.results ? "No items match your search." : "This folder is empty.") + "</div>";
        else if (S.view === "icons") {
          h = '<div class="fd-grid">' + view.map(function (e, i) {
            var th = (!e.dir && (e.kind === "image" || e.kind === "video"))
              ? '<img loading="lazy" alt="" src="/api/fdlg/thumb?size=192&path=' + encodeURIComponent(fullOf(e)) + '" data-ti="' + i + '">'
              : iconFor(e);
            return '<div class="fd-tile' + (S.sel.indexOf(fullOf(e)) >= 0 ? " sel" : "") + '" role="option" data-i="' + i
              + '" title="' + esc(e.name + (e.size != null ? "\n" + fmtBytes(e.size) : "") + (e.mtime ? "\n" + fmtDate(e.mtime) : "")) + '">'
              + '<div class="fd-th">' + th + '</div><div class="fd-tn">' + esc(e.name) + "</div></div>";
          }).join("") + "</div>";
        } else {
          var ar = function (k) { return S.sortKey === k ? '<span class="ar">' + (S.sortDesc ? "▼" : "▲") + "</span>" : ""; };
          h = '<div class="fd-hdr"><button type="button" data-sort="name">Name' + ar("name") + '</button>'
            + '<button type="button" data-sort="mtime">Date modified' + ar("mtime") + '</button>'
            + '<button type="button" data-sort="type">' + (S.results ? "Folder" : "Type") + ar("type") + '</button>'
            + '<button type="button" data-sort="size">Size' + ar("size") + "</button></div>"
            + '<div class="fd-list">' + view.map(function (e, i) {
              return '<div class="fd-row' + (S.sel.indexOf(fullOf(e)) >= 0 ? " sel" : "") + (e.hidden ? " hid" : "") + '" role="option" data-i="' + i + '">'
                + '<div class="c n">' + iconFor(e) + "<span>" + esc(e.name) + "</span></div>"
                + '<div class="c">' + esc(fmtDate(e.mtime)) + "</div>"
                + '<div class="c" title="' + esc(S.results ? e.folder : e.type) + '">' + esc(S.results ? e.folder : e.type) + "</div>"
                + '<div class="c s">' + esc(e.dir ? "" : fmtSize(e.size)) + "</div></div>";
            }).join("") + "</div>";
        }
        main.innerHTML = h;
        Array.prototype.forEach.call(main.querySelectorAll("img[data-ti]"), function (im) {
          im.addEventListener("error", function () { var e = view[+im.dataset.ti]; if (e) im.outerHTML = iconFor(e); });
        });
        var n = view.length, ns = S.sel.length;
        q("fd-count").textContent = (S.results ? n + " result" + (n === 1 ? "" : "s") : n + " item" + (n === 1 ? "" : "s"))
          + (ns ? " · " + ns + " selected" : "");
        q("fd-vdet").classList.toggle("on", S.view !== "icons");
        q("fd-vico").classList.toggle("on", S.view === "icons");
        q("fd-back").disabled = !S.back.length; q("fd-fwd").disabled = !S.fwd.length;
        q("fd-up").disabled = !S.parent;
        q("fd-rename").disabled = S.sel.length !== 1;
      }
      /* a selection change only re-marks the rows (no re-render): a click
         must not replace the node a double-click is about to land on */
      function paintSel() {
        Array.prototype.forEach.call(main.querySelectorAll("[data-i]"), function (n) {
          var e = view[+n.dataset.i];
          n.classList.toggle("sel", !!e && S.sel.indexOf(fullOf(e)) >= 0);
        });
        var n = view.length, ns = S.sel.length;
        q("fd-count").textContent = (S.results ? n + " result" + (n === 1 ? "" : "s") : n + " item" + (n === 1 ? "" : "s"))
          + (ns ? " · " + ns + " selected" : "");
        q("fd-rename").disabled = S.sel.length !== 1;
      }
      function paintAddr() {
        var box = q("fd-crumbs"); box.innerHTML = "";
        crumbs(S.dir, S.sep).forEach(function (c, i) {
          if (i) { var ch = document.createElement("span"); ch.className = "fd-chev"; ch.textContent = "›"; box.appendChild(ch); }
          var b = document.createElement("button"); b.type = "button"; b.className = "fd-crumb";
          b.textContent = c.name; b.title = c.path;
          b.addEventListener("click", function (ev) { ev.stopPropagation(); go(c.path); });
          box.appendChild(b);
        });
        box.scrollLeft = box.scrollWidth;
        sbox.placeholder = "Search " + (baseName(S.dir) || S.dir);
        Array.prototype.forEach.call(side.querySelectorAll(".fd-si"), function (b) {
          b.classList.toggle("cur", b.dataset.path === S.dir);
        });
      }
      function load(dir, keepSel) {
        var my = ++S.loadSeq;
        return getJSON("/api/fdlg/list?dir=" + encodeURIComponent(dir || "") + "&exts=" + encodeURIComponent(S.mode === "dir" ? "" : extsNow())
          + (S.mode === "dir" ? "&folders=1" : "")).then(function (j) {
          if (my !== S.loadSeq) return;
          S.dir = j.dir; S.sep = j.sep || S.sep; S.parent = j.parent; S.entries = j.entries || []; S.error = j.error || "";
          S.results = null; S.q = ""; sbox.value = "";
          if (!keepSel) { S.sel = []; S.anchor = -1; }
          paintAddr(); paint();
          if (S.mode === "dir" && !keepSel) nameIn.value = "";
        }).catch(function () { S.error = "The server is not answering."; paint(); });
      }
      function go(dir, noHist) {
        if (!noHist && S.dir && dir !== S.dir) { S.back.push(S.dir); S.fwd = []; }
        say("");
        return load(dir);
      }

      // ---- the navigation pane
      function paintSide(p) {
        var h = "";
        var item = function (ic, label, path, extra) {
          return '<button type="button" class="fd-si" data-path="' + esc(path) + '" title="' + esc(path) + '">' + ic
            + '<span class="l">' + esc(label) + "</span></button>" + (extra || "");
        };
        if (p.quick && p.quick.length) {
          h += '<div class="fd-sh">Quick access</div>';
          if (p.home) h += item(ICON.home, "Home", p.home);
          p.quick.forEach(function (x) { h += item(ICON[x.id] || ICON.folder, x.name, x.path); });
        }
        if (p.app && p.app.length) {
          h += '<div class="fd-sh">bitGen Studio</div>';
          p.app.forEach(function (x) { h += item(ICON[x.id] || ICON.folder, x.name, x.path); });
        }
        h += '<div class="fd-sh">This PC</div>';
        (p.drives || []).forEach(function (d) {
          var bar = "";
          if (d.total) {
            var used = Math.max(0, Math.min(1, 1 - (d.free || 0) / d.total));
            bar = '<span class="fd-bar" title="' + esc(fmtBytes(d.free) + " free of " + fmtBytes(d.total)) + '"><i class="' + (used > 0.9 ? "full" : "")
              + '" style="width:' + Math.round(used * 100) + '%"></i></span>';
          }
          h += item(d.kind === "removable" ? ICON.usb : d.kind === "network" ? ICON.network : ICON.drive, d.label, d.path, bar);
        });
        side.innerHTML = h;
        Array.prototype.forEach.call(side.querySelectorAll(".fd-si"), function (b) {
          b.addEventListener("click", function () { go(b.dataset.path); });
        });
        paintAddr();
      }

      // ---- selection
      function selectIdx(i, how) {
        var e = view[i]; if (!e) return;
        var k = fullOf(e);
        if (how === "toggle" && S.multi) {
          var at = S.sel.indexOf(k);
          if (at >= 0) S.sel.splice(at, 1); else S.sel.push(k);
          S.anchor = i;
        } else if (how === "range" && S.multi && S.anchor >= 0) {
          var a = Math.min(S.anchor, i), b = Math.max(S.anchor, i);
          S.sel = view.slice(a, b + 1).map(fullOf);
        } else { S.sel = [k]; S.anchor = i; }
        var files = view.filter(function (x) { return S.sel.indexOf(fullOf(x)) >= 0 && (S.mode === "dir" ? x.dir : !x.dir); });
        if (files.length) nameIn.value = quoteNames(files.map(function (x) { return x.name; }));
        else if (S.mode === "dir" && S.sel.length === 1) nameIn.value = e.name;
        paintSel();
        var node = main.querySelector('[data-i="' + i + '"]');
        if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
      }
      function selIndex() {
        if (!S.sel.length) return -1;
        for (var i = 0; i < view.length; i++) if (fullOf(view[i]) === S.sel[S.sel.length - 1]) return i;
        return -1;
      }
      function activate(i) {
        var e = view[i]; if (!e) return;
        if (e.dir) { go(fullOf(e)); return; }
        if (S.mode === "file") finish([fullOf(e)]);
        else if (S.mode === "save") { nameIn.value = e.name; ok(); }
      }

      // ---- OK
      function stat(p) { return getJSON("/api/fdlg/stat?path=" + encodeURIComponent(p)); }
      var replaceAsk = "";            // save: the path the footer asked to replace
      function ok() {
        say("");
        var text = nameIn.value.trim();
        if (S.mode === "save") {
          if (!text) { say("Type a file name."); return Promise.resolve(); }
          if (/[*?<>|"]/.test(text)) { say('A file name can\'t contain any of these characters: * ? < > | "'); return Promise.resolve(); }
          var sp = isAbs(text) ? text : joinPath(S.dir, text, S.sep);
          return stat(sp).then(function (st) {
            if (st.exists && st.dir) { nameIn.value = o.name || ""; replaceAsk = ""; return go(st.path); }
            if (st.exists && replaceAsk !== st.path) {
              replaceAsk = st.path;
              say(baseName(st.path) + " already exists. Press Save again to replace it.");
              return;
            }
            finish([st.path], st.exists);
          });
        }
        if (S.mode === "dir") {
          if (text) {
            var p = isAbs(text) ? text : joinPath(S.dir, text, S.sep);
            return stat(p).then(function (s) {
              if (s.exists && s.dir) finish([s.path]); else say("Folder not found: " + text);
            });
          }
          var e = view[selIndex()];
          return finish([e && e.dir ? fullOf(e) : S.dir]);
        }
        if (/[*?]/.test(text) && text.indexOf('"') < 0) {      // "*.png" = a filter, like Windows
          var custom = { label: text, exts: text.split(/[;,\s]+/).map(function (x) { return x.replace(/^\*/, "").toLowerCase(); }).filter(function (x) { return x && x !== ".*"; }) };
          S.filters.splice(0, 0, custom); S.fi = 0;
          var op = document.createElement("option"); op.textContent = filterLabel(custom);
          fsel.insertBefore(op, fsel.firstChild);
          Array.prototype.forEach.call(fsel.options, function (x, i) { x.value = String(i); });
          fsel.value = "0"; nameIn.value = "";
          return load(S.dir);
        }
        var names = parseNames(text);
        if (!names.length) {
          var e2 = view[selIndex()];
          if (e2 && e2.dir) return go(fullOf(e2));
          say("Select a file, or type its name.");
          return Promise.resolve();
        }
        if (names.length > 1 && !S.multi) { say("Only one file can be chosen here."); return Promise.resolve(); }
        var paths = names.map(function (n) {
          if (isAbs(n)) return n;
          var hit = view.filter(function (x) { return x.name === n; })[0];
          return hit ? fullOf(hit) : joinPath(S.dir, n, S.sep);
        });
        return Promise.all(paths.map(stat)).then(function (ss) {
          if (ss.length === 1 && ss[0].exists && ss[0].dir) { nameIn.value = ""; return go(ss[0].path); }
          var bad = ss.filter(function (s) { return !s.exists || s.dir; });
          if (bad.length) { say((bad[0].dir ? "That is a folder: " : "File not found: ") + baseName(bad[0].path)); return; }
          finish(ss.map(function (s) { return s.path; }));
        });
      }

      // ---- rename / new folder
      function startRename(i) {
        var e = view[i]; if (!e || S.results) return;
        var node = main.querySelector('[data-i="' + i + '"]'); if (!node) return;
        var holder = node.querySelector(".n span") || node.querySelector(".fd-tn");
        var inp = document.createElement("input"); inp.className = "fd-ren"; inp.value = e.name;
        holder.textContent = ""; holder.appendChild(inp);
        var dot = e.dir ? -1 : e.name.lastIndexOf(".");
        inp.focus(); inp.setSelectionRange(0, dot > 0 ? dot : e.name.length);
        var fin = false;
        var commit = function (keep) {
          if (fin) return; fin = true;
          var v = inp.value.trim();
          if (!keep || !v || v === e.name) { paint(); main.focus(); return; }
          postJSON("/api/fdlg/rename", { dir: S.dir, from: e.name, to: v }).then(function (r) {
            if (r.error) { say(r.error); paint(); return; }
            S.sel = [joinPath(S.dir, r.name, S.sep)];
            return load(S.dir, true).then(function () { main.focus(); });
          });
        };
        inp.addEventListener("keydown", function (ev) {
          ev.stopPropagation();
          if (ev.key === "Enter") { ev.preventDefault(); commit(true); }
          else if (ev.key === "Escape") { ev.preventDefault(); commit(false); }
        });
        inp.addEventListener("blur", function () { commit(true); });
        inp.addEventListener("mousedown", function (ev) { ev.stopPropagation(); });
        inp.addEventListener("dblclick", function (ev) { ev.stopPropagation(); });
      }
      function newFolder() {
        if (S.results) return;
        postJSON("/api/fdlg/mkdir", { dir: S.dir }).then(function (r) {
          if (r.error) { say(r.error); return; }
          S.sel = [joinPath(S.dir, r.name, S.sep)];
          load(S.dir, true).then(function () { startRename(selIndex()); });
        });
      }

      // ---- search
      var sTimer = 0;
      function runSearch() {
        var t = sbox.value.trim();
        S.q = t;
        if (!t) { S.results = null; paint(); return; }
        var my = ++S.loadSeq;
        q("fd-count").textContent = "Searching…";
        getJSON("/api/fdlg/search?dir=" + encodeURIComponent(S.dir) + "&q=" + encodeURIComponent(t)
          + "&exts=" + encodeURIComponent(S.mode === "dir" ? "" : extsNow()) + (S.mode === "dir" ? "&folders=1" : ""))
          .then(function (j) {
            if (my !== S.loadSeq) return;
            S.results = j.results || []; S.sel = []; paint();
            if (!j.done) q("fd-count").textContent += " (search stopped early - narrow it down)";
          });
      }
      sbox.addEventListener("input", function () { clearTimeout(sTimer); sTimer = setTimeout(runSearch, 300); });
      sbox.addEventListener("keydown", function (ev) {
        ev.stopPropagation();
        if (ev.key === "Escape") { ev.preventDefault(); sbox.value = ""; runSearch(); main.focus(); }
        if (ev.key === "Enter") { ev.preventDefault(); clearTimeout(sTimer); runSearch(); }
      });

      // ---- context menu
      var menu = null;
      function closeMenu(ev) { if (menu && (!ev || !menu.contains(ev.target))) { menu.remove(); menu = null; } }
      function openMenu(x, y, i) {
        closeMenu();
        var e = i >= 0 ? view[i] : null;
        menu = document.createElement("div"); menu.className = "fd-menu";
        var items = [];
        if (e) {
          items.push(["Open", function () { activate(i); }]);
          if (!S.results) items.push(["Rename", function () { startRename(i); }]);
          items.push(["Copy path", function () { try { navigator.clipboard.writeText(fullOf(e)); } catch (er) {} }]);
          items.push(["-"]);
        }
        if (!S.results) items.push(["New folder", newFolder]);
        items.push(["Refresh", function () { load(S.dir, true); }]);
        items.forEach(function (it) {
          if (it[0] === "-") { menu.appendChild(document.createElement("hr")); return; }
          var b = document.createElement("button"); b.type = "button"; b.textContent = it[0];
          b.addEventListener("click", function () { closeMenu(); it[1](); });
          menu.appendChild(b);
        });
        dlg.appendChild(menu);
        menu.style.left = Math.min(x, window.innerWidth - 200) + "px";
        menu.style.top = Math.min(y, window.innerHeight - 40 * items.length) + "px";
      }
      document.addEventListener("mousedown", closeMenu, true);

      // ---- wiring
      function idxOf(ev) { var n = ev.target.closest && ev.target.closest("[data-i]"); return n ? +n.dataset.i : -1; }
      main.addEventListener("mousedown", function (ev) {
        if (ev.button !== 0) return;
        var s = ev.target.closest && ev.target.closest("[data-sort]");
        if (s) return;
        var i = idxOf(ev);
        if (i < 0) { S.sel = []; paintSel(); return; }
        selectIdx(i, ev.shiftKey ? "range" : (ev.ctrlKey || ev.metaKey) ? "toggle" : "one");
      });
      main.addEventListener("click", function (ev) {
        var s = ev.target.closest && ev.target.closest("[data-sort]");
        if (!s) return;
        var k = s.dataset.sort;
        if (S.sortKey === k) S.sortDesc = !S.sortDesc; else { S.sortKey = k; S.sortDesc = false; }
        paint();
      });
      main.addEventListener("dblclick", function (ev) { var i = idxOf(ev); if (i >= 0) activate(i); });
      main.addEventListener("contextmenu", function (ev) {
        ev.preventDefault();
        var i = idxOf(ev);
        if (i >= 0 && S.sel.indexOf(fullOf(view[i])) < 0) selectIdx(i, "one");
        openMenu(ev.clientX, ev.clientY, i);
      });
      main.addEventListener("keydown", function (ev) {
        var i = selIndex(), n = view.length;
        var cols = 1;
        if (S.view === "icons") { var g = main.querySelector(".fd-grid"); if (g) cols = Math.max(1, Math.round(g.clientWidth / 116)); }
        var move = function (to) { ev.preventDefault(); if (n) selectIdx(Math.max(0, Math.min(n - 1, to)), ev.shiftKey ? "range" : "one"); };
        if (ev.key === "ArrowDown") return move(i < 0 ? 0 : i + cols);
        if (ev.key === "ArrowUp") return move(i < 0 ? 0 : i - cols);
        if (ev.key === "ArrowRight" && S.view === "icons" && !ev.altKey) return move(i + 1);
        if (ev.key === "ArrowLeft" && S.view === "icons" && !ev.altKey) return move(i - 1);
        if (ev.key === "Home") return move(0);
        if (ev.key === "End") return move(n - 1);
        if (ev.key === "Enter") { ev.preventDefault(); if (i >= 0) activate(i); else ok(); return; }
        if (ev.key === "F2") { ev.preventDefault(); if (i >= 0) startRename(i); return; }
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "a" && S.multi) {
          ev.preventDefault(); S.sel = view.filter(function (x) { return !x.dir; }).map(fullOf);
          nameIn.value = quoteNames(view.filter(function (x) { return !x.dir; }).map(function (x) { return x.name; })); paint(); return;
        }
        if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey && ev.key !== " ") {
          var now = Date.now();
          S.typed = (now - S.typedAt < 900 ? S.typed : "") + ev.key.toLowerCase(); S.typedAt = now;
          for (var k = 0; k < n; k++) if (view[k].name.toLowerCase().indexOf(S.typed) === 0) { selectIdx(k, "one"); break; }
        }
      });
      dlg.addEventListener("keydown", function (ev) {
        ev.stopPropagation();                    // the app's own shortcuts stay out of the dialog
        var inField = ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT";
        if (ev.key === "Escape") { ev.preventDefault(); if (menu) closeMenu(); else cancel(); return; }
        if (ev.altKey && ev.key === "ArrowLeft") { ev.preventDefault(); q("fd-back").click(); return; }
        if (ev.altKey && ev.key === "ArrowRight") { ev.preventDefault(); q("fd-fwd").click(); return; }
        if (ev.altKey && ev.key === "ArrowUp") { ev.preventDefault(); q("fd-up").click(); return; }
        if (ev.key === "F5") { ev.preventDefault(); load(S.dir, true); return; }
        if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === "n") { ev.preventDefault(); newFolder(); return; }
        if (ev.key === "Backspace" && !inField) { ev.preventDefault(); q("fd-up").click(); return; }
        if (ev.key === "Enter" && ev.target === nameIn) { ev.preventDefault(); ok(); }
      });
      dlg.addEventListener("cancel", function (ev) { ev.preventDefault(); cancel(); });
      q("fd-x").addEventListener("click", cancel);
      q("fd-cancel").addEventListener("click", cancel);
      q("fd-ok").addEventListener("click", ok);
      q("fd-back").addEventListener("click", function () { if (!S.back.length) return; S.fwd.push(S.dir); load(S.back.pop()); });
      q("fd-fwd").addEventListener("click", function () { if (!S.fwd.length) return; S.back.push(S.dir); load(S.fwd.pop()); });
      q("fd-up").addEventListener("click", function () {
        if (!S.parent) return;
        var from = S.dir;
        go(S.parent).then(function () {
          S.sel = [from]; var i = selIndex(); if (i >= 0) selectIdx(i, "one");
        });
      });
      q("fd-ref").addEventListener("click", function () { load(S.dir, true); });
      q("fd-new").addEventListener("click", newFolder);
      q("fd-rename").addEventListener("click", function () { var i = selIndex(); if (i >= 0) startRename(i); });
      q("fd-vdet").addEventListener("click", function () { S.view = "details"; paint(); });
      q("fd-vico").addEventListener("click", function () { S.view = "icons"; paint(); });
      fsel.addEventListener("change", function () { S.fi = +fsel.value || 0; if (S.results) runSearch(); else load(S.dir, true); });
      // the address bar: breadcrumbs, click the empty part to type
      var addr = q("fd-addr"), addrIn = q("fd-addrin");
      addr.addEventListener("click", function () {
        addr.classList.add("editing"); addrIn.value = S.dir; addrIn.focus(); addrIn.select();
      });
      addrIn.addEventListener("keydown", function (ev) {
        ev.stopPropagation();
        if (ev.key === "Enter") {
          ev.preventDefault(); var v = addrIn.value.trim(); addr.classList.remove("editing");
          if (!v) return;
          stat(v).then(function (s) {
            if (!s.exists) { say("Can't find '" + v + "'. Check the spelling and try again."); return; }
            if (s.dir) go(s.path);
            else if (S.mode === "file") finish([s.path]);
            else go(s.path);
          });
        } else if (ev.key === "Escape") { ev.preventDefault(); addr.classList.remove("editing"); main.focus(); }
      });
      addrIn.addEventListener("blur", function () { addr.classList.remove("editing"); });
      // drag the dialog by its title bar
      var tb = q("fd-title");
      tb.addEventListener("pointerdown", function (ev) {
        if (ev.target.closest("button")) return;
        var r = dlg.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
        var mv = function (e) {
          dlg.style.margin = "0"; dlg.style.position = "fixed";
          dlg.style.left = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dx)) + "px";
          dlg.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy)) + "px";
        };
        var up = function () { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
      });

      try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }
      var ctl = { dialog: dlg, state: S, cancel: cancel, ok: ok, go: go, load: load, paint: paint,
                  selectIdx: selectIdx, activate: activate, newFolder: newFolder, startRename: startRename,
                  runSearch: runSearch, view: function () { return view; } };
      cur = ctl;
      if (!placesP) placesP = getJSON("/api/fdlg/places").catch(function () { placesP = null; return { drives: [], quick: [] }; });
      ctl.ready = placesP.then(function (p) {
        S.places = p; S.base = p.start || ""; S.sep = p.sep || S.sep;
        paintSide(p);
        var start = o.start || sget("dir." + S.key, "") || p.start || p.home || "";
        return load(start);
      }).then(function () { if (!addr.classList.contains("editing")) main.focus(); return ctl; });   // 2.429.0: typing in the address bar before the first folder loads keeps the focus
    });
  }

  // ------------------------------------------------------ the upload shim
  function toast(t) {
    var el = document.querySelector(".fd-toast");
    if (!t) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.className = "fd-toast"; document.body.appendChild(el); }
    el.textContent = t;
  }
  function shimWanted(input) {
    return FD.enabled && FD.local && input && input.type === "file"
      && !input.hasAttribute("data-native-picker") && !input.hasAttribute("capture") && !input.disabled;
  }
  var busy = false;
  function pickInto(input) {
    if (busy) return Promise.resolve(null);
    busy = true;
    var dirMode = input.hasAttribute("webkitdirectory");
    var key = "input:" + (input.id || input.name || input.accept || "any");
    return open({ mode: dirMode ? "dir" : "file", multi: input.multiple, filters: dirMode ? null : parseAccept(input.accept),
                  key: key, title: dirMode ? "Select Folder" : "Open" })
      .then(function (r) {
        if (!r) { busy = false; try { input.dispatchEvent(new Event("cancel", { bubbles: true })); } catch (e) {} return null; }
        var list = r.paths;
        var getList = dirMode
          ? getJSON("/api/fdlg/list?dir=" + encodeURIComponent(r.path)).then(function (j) {
              return (j.entries || []).filter(function (e) { return !e.dir; }).map(function (e) { return joinPath(j.dir, e.name, j.sep); });
            })
          : Promise.resolve(list);
        return getList.then(function (paths) {
          var files = [], i = 0;
          var next = function () {
            if (i >= paths.length) return Promise.resolve();
            var p = paths[i++];
            toast("Reading " + baseName(p) + (paths.length > 1 ? " (" + i + " of " + paths.length + ")" : "") + "…");
            return api.fetch("/api/fdlg/file?path=" + encodeURIComponent(p)).then(function (res) {
              if (!res.ok) throw new Error("could not read " + baseName(p));
              var mt = +(res.headers.get("X-File-Mtime") || 0) || Date.now();
              return res.blob().then(function (b) {
                files.push(new File([b], baseName(p), { type: b.type || "", lastModified: mt }));
              });
            }).then(next);
          };
          return next().then(function () {
            toast("");
            var dt = new DataTransfer();
            files.forEach(function (f) { dt.items.add(f); });
            input.files = dt.files;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            busy = false;
            return files;
          });
        });
      })
      .catch(function (e) { busy = false; toast(""); alert("The file could not be read: " + ((e && e.message) || e)); return null; });
  }

  var FD = {
    enabled: true, local: false, open: open, pickInto: pickInto, ICON: ICON,
    parseAccept: parseAccept, crumbs: crumbs, joinPath: joinPath, sortEntries: sortEntries,
    fmtSize: fmtSize, fmtBytes: fmtBytes, parseNames: parseNames, quoteNames: quoteNames,
    isLocalPage: isLocalPage, filterLabel: filterLabel, current: function () { return cur; },
    _api: api,
  };

  function install() {
    FD.local = isLocalPage();
    var origClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (shimWanted(this)) { pickInto(this); return; }
      return origClick.apply(this, arguments);
    };
    if (HTMLInputElement.prototype.showPicker) {
      var origShow = HTMLInputElement.prototype.showPicker;
      HTMLInputElement.prototype.showPicker = function () {
        if (shimWanted(this)) { pickInto(this); return; }
        return origShow.apply(this, arguments);
      };
    }
    document.addEventListener("click", function (ev) {
      var t = ev.target;
      if (t && t.tagName === "INPUT" && shimWanted(t)) { ev.preventDefault(); pickInto(t); }
    }, true);
  }
  window.FileDialog = FD;
  if (typeof HTMLInputElement !== "undefined") install();
})();

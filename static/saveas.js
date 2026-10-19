/* bitGen Studio — SAVE / SAVE AS for a picture, clip or song (2.359.0).
 *
 * Tim: "add a save button to the image preview dialog next to the open externally button. add a save as
 * button to the top left of the thumbnails in the gallery button. on save the file to the last save as
 * location".
 *
 * window.SaveAs = {
 *   saveAs(item)   the file dialog in Save As mode (static/filedialog.js) picks folder + name; the server
 *                  copies the file there (routes/saveAs.js) and remembers the folder
 *   save(item)     no dialog: a copy goes into the last save-as folder under its own name (a taken name gets
 *                  " (2)" - a quick save never overwrites); no folder yet (or it is gone) = Save as
 *   last()         Promise<{dir, exists}>
 *   say(text)      a short toast (inside the open modal dialog, so it shows over the preview)
 * }
 * item = {url, name, kind}. A file the server serves from disk (/outputs, /passets, /api/fdlg/file) is copied
 * on the server; anything else (a blob: / data: picture) is read by the page and uploaded. A page that is not
 * on this computer (the phone remote) downloads through the browser instead. */
(function () {
  "use strict";
  var lastDir = "";

  function say(text, bad) {
    var host = null;
    var open = document.querySelectorAll("dialog[open]");
    host = open.length ? open[open.length - 1] : document.body;
    var t = host.querySelector(":scope > .svas-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "svas-toast";
      t.setAttribute("role", "status");
      t.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000;max-width:min(520px,80vw);"
        + "padding:7px 11px;border-radius:7px;font-size:.78rem;background:#1d2128;color:#e8e8e8;"
        + "border:1px solid #3a404c;box-shadow:0 4px 18px rgba(0,0,0,.45);pointer-events:none;"
        + "transition:opacity .25s;word-break:break-all";
      host.appendChild(t);
    }
    t.textContent = text || "";
    t.style.borderColor = bad ? "#c0504d" : "#3a404c";
    t.style.opacity = text ? "1" : "0";
    clearTimeout(t._h);
    if (text) t._h = setTimeout(function () { t.style.opacity = "0"; }, bad ? 7000 : 4000);
    try { document.dispatchEvent(new CustomEvent("saveas:said", { detail: { text: text, bad: !!bad } })); } catch (e) {}
    return text;
  }

  function local() { return !!(window.FileDialog && window.FileDialog.local); }

  function postJSON(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }

  function last() {
    if (!local()) return Promise.resolve({ dir: "", exists: false });
    return fetch("/api/save-as/last").then(function (r) { return r.json(); })
      .then(function (j) { lastDir = (j && j.exists && j.dir) || ""; return j || { dir: "", exists: false }; })
      .catch(function () { return { dir: "", exists: false }; });
  }

  function cleanUrl(u) { return String(u || "").replace(/\?v=\d+$/, ""); }

  /** The browser's own download (a page that is not on this computer). */
  function download(item) {
    var a = document.createElement("a");
    a.href = item.url; a.download = item.name || "";
    document.body.appendChild(a); a.click(); a.remove();
    return Promise.resolve(say("downloaded " + (item.name || "the file") + " (to the browser's Downloads folder)"));
  }

  /** Upload the bytes the page holds (blob: / data: / a URL the server does not map to a file). */
  function upload(item, fields) {
    return fetch(item.url).then(function (r) { return r.blob(); }).then(function (blob) {
      var fd = new FormData();
      fd.append("file", blob, item.name || "file");
      Object.keys(fields).forEach(function (k) { if (fields[k] !== undefined && fields[k] !== "") fd.append(k, String(fields[k])); });
      return fetch("/api/save-as/upload", { method: "POST", body: fd })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
    });
  }

  function send(item, fields) {
    var body = { url: cleanUrl(item.url) };
    Object.keys(fields).forEach(function (k) { body[k] = fields[k]; });
    var serverSide = /^\/(outputs|passets)\//.test(body.url) || /^\/api\/fdlg\/file\?/.test(body.url);
    return (serverSide ? postJSON("/api/save-as", body) : Promise.resolve({ upload: true, _status: 404 }))
      .then(function (j) { return j && j.upload ? upload(item, fields) : j; });
  }

  function report(j) {
    if (j && j.ok) { lastDir = j.dir || lastDir; say("💾 " + (j.note || ("saved to " + j.path))); return j; }
    say("⚠ " + ((j && j.error) || "could not save"), true);
    return j;
  }

  function filtersFor(item) {
    var ext = (String(item.name || "").match(/\.([^.\/]+)$/) || [])[1];
    return ext ? [{ label: ext.toUpperCase() + " file", exts: ["." + ext.toLowerCase()] }] : null;
  }

  function saveAs(item) {
    if (!item || !item.url) return Promise.resolve(null);
    if (!local() || !window.FileDialog) return download(item);
    return last().then(function (l) {
      return window.FileDialog.open({ mode: "save", title: "Save As", name: item.name || "", key: "saveas",
                                      start: l.exists ? l.dir : undefined, filters: filtersFor(item) });
    }).then(function (r) {
      if (!r) return null;                                  // cancelled
      return send(item, { dest: r.path, overwrite: !!r.overwrite }).then(report);
    }).catch(function (e) { say("⚠ could not save: " + ((e && e.message) || e), true); return null; });
  }

  function save(item) {
    if (!item || !item.url) return Promise.resolve(null);
    if (!local()) return download(item);
    return send(item, { name: item.name || "" }).then(function (j) {
      if (j && j.need_dir) return saveAs(item);          // no save-as folder yet (or it is gone): ask once
      return report(j);
    }).catch(function (e) { say("⚠ could not save: " + ((e && e.message) || e), true); return null; });
  }

  window.SaveAs = { save: save, saveAs: saveAs, last: last, say: say, lastDir: function () { return lastDir; } };
})();

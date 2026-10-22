/* bitGen Studio — ext/videodock/posepick.js (2.577.0): THE CHARACTER CREATOR'S 🧍 POSE SHEET DIALOG (window.H3PosePick).
 * Tim: "delete the pose sheets, they are crap. can we add a folder to the app for pose_sheets. i will save pose sheets
 * to that folder. in the character editor/creator remove the pose dropdown and add a dialog with thumbnails of the
 * pose sheets in the folder and use the selected one for the poses".
 * The creator's "Pose sheet" button (#chPoseBtn, dock.html) opens a grid of thumbnails of every picture in
 * <install>/pose_sheets/ (GET /api/pose-sheets, routes/poseSheets.js) + "No pose sheet". A click picks, a double
 * click / ✔ Use (or Enter) takes it; 📂 Open folder shows the folder, ↻ refreshes after saving new ones. The pick is
 * written to the hidden #chOptPose (characters.js chSheetOpts sends it as `pose`) and remembered for next time.
 * Pure: label(id) / filter(items, q). */
(function (root) {
  "use strict";
  var KEY = "h3.poseSheet";
  /** the button's words for a pick (pure) */
  function label(id) {
    if (!id) return "🧍 No pose sheet";
    var n = String(id).split("/").pop().replace(/\.(png|jpe?g|webp)$/i, "");
    return "🧍 " + n;
  }
  /** the sheets a search shows (pure): every word in the name or folder */
  function filter(items, q) {
    var w = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (items || []).filter(function (it) { var t = (it.id || "").toLowerCase(); return w.every(function (x) { return t.indexOf(x) >= 0; }); });
  }
  function thumbUrl(it) { return "/api/pose-sheets/file?id=" + encodeURIComponent(it.id) + "&v=" + (it.mtime || 0); }
  if (typeof module !== "undefined" && module.exports) { module.exports = { label: label, filter: filter, thumbUrl: thumbUrl }; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lsGet() { try { return root.localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function lsSet(v) { try { if (v) root.localStorage.setItem(KEY, v); else root.localStorage.removeItem(KEY); } catch (e) { /* fine */ } }
  var P = { items: [], dir: "", sel: "", byId: {} };

  /** the creator's pick: the hidden input + the button's name and thumbnail */
  function set(id) {
    id = id || "";
    var inp = $("chOptPose"); if (inp) inp.value = id;
    var nm = $("chPoseName"); if (nm) nm.textContent = label(id);
    var th = $("chPoseThumb"), it = P.byId[id];
    if (th) {
      if (id) { th.style.backgroundImage = 'url("' + thumbUrl(it || { id: id }) + '")'; th.style.display = ""; }
      else { th.style.backgroundImage = ""; th.style.display = "none"; }
    }
    var b = $("chPoseBtn"); if (b) b.title = id ? "Pose sheet: " + id + " (pose_sheets folder) - click to change" : "Pick the pose sheet the character sheet copies its panels and poses from - your own pictures in the pose_sheets folder";
    lsSet(id);
    return id;
  }
  function current() { var inp = $("chOptPose"); return inp ? inp.value : ""; }

  function load() {
    return fetch("/api/pose-sheets").then(function (r) { return r.json(); }).then(function (j) {
      P.items = (j && j.items) || []; P.dir = (j && j.dir) || ""; P.byId = {};
      P.items.forEach(function (it) { P.byId[it.id] = it; });
      P.ok = true;
      return P;
    }).catch(function () { P.ok = false; return P; });
  }

  function dlg() {
    var d = $("chPoseDlg"); if (d) return d;
    d = doc.createElement("dialog"); d.id = "chPoseDlg"; d.setAttribute("aria-label", "Pose sheets");
    d.style.cssText = "width:min(94vw,1100px);max-height:88vh;padding:0;overflow:hidden;border-radius:10px";
    d.innerHTML = '<style>'
      + '#chPoseDlg[open]{display:flex;flex-direction:column}'
      + '#chPoseDlg .pdHead{display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(128,128,128,.3)}'
      + '#chPoseDlg .pdHead h2{margin:0 8px 0 0;font-size:.9rem}'
      + '#chPoseDlg .pdGrid{flex:1;min-height:0;overflow-y:auto;padding:10px 12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;align-content:start}'
      + '#chPoseDlg .pdTile{display:flex;flex-direction:column;gap:4px;padding:5px;border:2px solid transparent;border-radius:8px;cursor:pointer;background:rgba(128,128,128,.12);text-align:left;color:inherit;font:inherit}'
      + '#chPoseDlg .pdTile:hover{background:rgba(128,128,128,.22)}'
      + '#chPoseDlg .pdTile.on{border-color:var(--tiger,#f59e2c)}'
      + '#chPoseDlg .pdTile img,#chPoseDlg .pdNone{width:100%;aspect-ratio:4/3;object-fit:contain;background:#1a1a1a;border-radius:5px;display:block}'
      + '#chPoseDlg .pdNone{display:flex;align-items:center;justify-content:center;font-size:2rem;opacity:.6}'
      + '#chPoseDlg .pdName{font-size:.74rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '#chPoseDlg .pdSub{font-size:.68rem;opacity:.65}'
      + '#chPoseDlg .pdEmpty{grid-column:1/-1;padding:24px;text-align:center;opacity:.8;line-height:1.6}'
      + '#chPoseDlg .pdFoot{display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid rgba(128,128,128,.3)}'
      + '#chPoseDlg .pdDir{flex:1;min-width:0;font-size:.7rem;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '</style>'
      + '<div class="pdHead"><h2>🧍 Pose sheet</h2><input id="pdQ" type="search" placeholder="search…" aria-label="Search the pose sheets" style="flex:1;max-width:280px">'
      + '<button class="ghost gbtn" id="pdOpen" type="button" title="Show the pose_sheets folder - save your pose sheets (PNG, JPG, WebP) there">📂 Open folder</button>'
      + '<button class="ghost gbtn" id="pdRefresh" type="button" title="Read the folder again (after saving new pose sheets)">↻ Refresh</button></div>'
      + '<div class="pdGrid" id="pdGrid" role="listbox" aria-label="Pose sheets"></div>'
      + '<div class="pdFoot"><span class="pdDir" id="pdDir"></span><button class="ghost gbtn" id="pdCancel" type="button">Cancel</button>'
      + '<button class="ghost gbtn" id="pdUse" type="button" title="Use the picked pose sheet for the character sheet\'s panels and poses">✔ Use</button></div>';
    doc.body.appendChild(d);
    $("pdQ").oninput = paint;
    $("pdOpen").onclick = function () { fetch("/api/pose-sheets/open", { method: "POST" }).catch(function () { /* fine */ }); };
    $("pdRefresh").onclick = function () { load().then(paint); };
    $("pdCancel").onclick = function () { d.close(); };
    $("pdUse").onclick = use;
    d.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter" && e.target && e.target.id !== "pdOpen" && e.target.id !== "pdRefresh" && e.target.id !== "pdCancel") { e.preventDefault(); use(); }
    });
    return d;
  }
  function tile(id, inner, name, sub) {
    return '<button type="button" class="pdTile' + (P.sel === id ? " on" : "") + '" role="option" aria-selected="' + (P.sel === id) + '" data-pd="' + esc(id) + '" title="' + esc(id || "No pose sheet - the sheet uses a natural standing stance") + '">'
      + inner + '<span class="pdName">' + esc(name) + "</span>" + (sub ? '<span class="pdSub">' + esc(sub) + "</span>" : "") + "</button>";
  }
  function paint() {
    var g = $("pdGrid"); if (!g) return;
    var list = filter(P.items, $("pdQ").value);
    var html = tile("", '<span class="pdNone">∅</span>', "No pose sheet", "natural standing stance");
    html += list.map(function (it) { return tile(it.id, '<img loading="lazy" alt="" src="' + esc(thumbUrl(it)) + '">', it.name, it.folder || ""); }).join("");
    if (!P.items.length) html += '<div class="pdEmpty">No pose sheets yet.<br>Save your pose sheets (PNG, JPG or WebP) into the <b>pose_sheets</b> folder - <b>📂 Open folder</b> shows it - then press <b>↻ Refresh</b>.</div>';
    else if (!list.length) html += '<div class="pdEmpty">No pose sheet matches.</div>';
    g.innerHTML = html;
    $("pdDir").textContent = P.dir ? "Folder: " + P.dir : "";
    $("pdDir").title = P.dir;
    g.querySelectorAll("[data-pd]").forEach(function (b) {
      b.onclick = function () { P.sel = b.getAttribute("data-pd"); g.querySelectorAll(".pdTile").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); };
      b.ondblclick = function () { P.sel = b.getAttribute("data-pd"); use(); };
    });
  }
  function use() { set(P.sel); var d = $("chPoseDlg"); if (d && d.open) d.close(); }
  /** open the dialog (the current pick selected) */
  function open() {
    var d = dlg();
    P.sel = current(); $("pdQ").value = "";
    if (P.items.length) paint();   // what was read last shows at once; the folder is read again below
    else $("pdGrid").innerHTML = '<div class="pdEmpty">reading the pose_sheets folder…</div>';
    if (!d.open) d.showModal();
    return load().then(function () { if (P.sel && !P.byId[P.sel]) P.sel = ""; paint(); var on = $("pdGrid").querySelector(".pdTile.on"); if (on) try { on.focus(); on.scrollIntoView({ block: "nearest" }); } catch (e) { /* fine */ } return P; });
  }
  function boot() {
    var b = $("chPoseBtn"); if (!b) return false;
    if (b.dataset.pdBound) return true;
    b.dataset.pdBound = "1";
    b.addEventListener("click", function (e) { e.preventDefault(); open(); });
    // the last pick, if it is still in the folder (read now, so the dialog's thumbnails are ready when it opens)
    var last = lsGet();
    set(last);
    load().then(function () { if (P.ok && last && !P.byId[last]) set(""); else if (last) set(last); });
    return true;
  }
  root.H3PosePick = { open: open, set: set, current: current, load: load, label: label, filter: filter, state: P };
  if (!boot()) {
    // the StoryBoard dock's HTML may land after this script - look again until it is there
    var n = 0, t = setInterval(function () { if (boot() || ++n > 120) clearInterval(t); }, 500);
  }
})(typeof window !== "undefined" ? window : globalThis);

/* bitGen Studio — ext/timelinedock/bgv.js (2.436.0): the VIDEO PROJECT FILE (.bgv, XML) - 🎞 on the timeline's toolbar.
 *
 * Tim (verbatim): "save video project as .bgv" (+ "bgv XML"). Save: the timeline open now - every layer, clip,
 * keyframe, effect, caption, marker and setting - with the nested timelines its nest clips use and the list of media
 * it plays, as projects/<p>/bgv/<name>.bgv (lib/bgVideo.js, routes/bgfiles.js); also downloaded when asked. Open: a
 * .bgv from the computer or from the project's bgv folder - what is in it first (clips, layers, nested timelines,
 * media this project does not have), then "Open it" makes it a named timeline of this project and switches to it.
 *
 *   TlBgv.open()   the dialog;   TlBgv.save(name, download) / TlBgv.load({file | text}, as)  (the tests drive them)
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ready() { try { return !!(window.TlDlg && typeof tl !== "undefined"); } catch (e) { return false; } }
  function curTl() { try { return tl; } catch (e) { return null; } }                 // the page's timeline (index.html)
  function curName() { try { return tlName || "main"; } catch (e) { return "main"; } }
  function req(url, body, type) {
    return fetch(url, { method: "POST", headers: { "Content-Type": type || "text/plain" }, body: body })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); });
  }
  var dlg = null, pending = null;
  function msg(id, html) { var el = $(id); if (el) el.innerHTML = html; }
  function kb(n) { return Math.max(1, Math.round(n / 1024)) + " KB"; }

  function save(name, download) {
    var t = curTl(); if (!t) return Promise.reject(new Error("no timeline"));
    var nm = String(name || curName()).trim() || curName();
    return req("/api/bgv/save", JSON.stringify({ file: nm, timeline: curName(), tl: t })).then(function (j) {
      if (download) {
        return fetch("/api/bgfile/bgv/file/" + encodeURIComponent(j.name)).then(function (r) { return r.blob(); }).then(function (b) {
          var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = j.name; document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
          return j;
        });
      }
      return j;
    }).then(function (j) {
      if (typeof logLine === "function") logLine("[timeline] saved " + j.name + " (" + kb(j.size) + ")" + (j.nested.length ? " with nested " + j.nested.join(", ") : "") + (j.missing.length ? " - not in the project: " + j.missing.join(", ") : ""));
      return j;
    });
  }
  /** src: {file: a .bgv in the project} | {text: the file's XML}; as: apply it as this timeline (else just look) */
  function load(src, as) {
    var q = (src.file ? "file=" + encodeURIComponent(src.file) : "") + (as ? (src.file ? "&" : "") + "apply=1&as=" + encodeURIComponent(as) : "");
    return req("/api/bgv/open" + (q ? "?" + q : ""), src.file ? "" : String(src.text || "")).then(function (j) {
      if (!as) return j;
      var go = typeof tlSwitch === "function" ? tlSwitch(j.applied) : Promise.resolve();
      return Promise.resolve(go).then(function () { if (typeof tlRefreshList === "function") tlRefreshList(); if (typeof logLine === "function") logLine("[timeline] opened " + (src.file || "a .bgv") + " as \"" + j.applied + "\""); return j; });
    });
  }
  function paintPreview(j) {
    var miss = j.missing || [], nests = j.nested || [];
    msg("bgvInfo", '<div class="fx-row"><b>' + esc(j.name) + '</b><span class="fx-dim">' + j.clips + " clip(s) · " + j.layers.video + " video, " + j.layers.audio + " sound, " + j.layers.images
      + " picture layer(s)" + (j.saved ? " · saved " + esc(String(j.saved).slice(0, 16).replace("T", " ")) : "") + (j.app ? " · bitGen " + esc(j.app) : "") + "</span></div>"
      + (nests.length ? '<div class="fx-dim">⧉ nested: ' + nests.map(function (n) { return esc(n.name) + (n.exists ? " (this project has one - kept)" : " (added)"); }).join(", ") + "</div>" : "")
      + (miss.length ? '<div class="fx-dim" id="bgvMissing">⚠ not in this project (add them to the assets - the clips stay and play once the files are there): ' + miss.map(esc).join(", ") + "</div>" : "")
      + (j.notes || []).map(function (x) { return '<div class="fx-dim">' + esc(x) + "</div>"; }).join("")
      + '<div class="fx-row"><label>as the timeline <input type="text" id="bgvAs" value="' + esc(j.name) + '" style="width:160px"></label><button type="button" id="bgvOpenIt">Open it</button></div>');
    $("bgvAs").addEventListener("keydown", function (e) { e.stopPropagation(); });
    $("bgvOpenIt").onclick = function () {
      var as = $("bgvAs").value.trim() || j.name;
      load(pending, as).then(function () { if (dlg) dlg.close(); }).catch(function (e) { msg("bgvInfo", '<div class="fx-dim">⚠ ' + esc(e.message) + "</div>"); });
    };
  }
  function look(src) {
    pending = src;
    msg("bgvInfo", '<div class="fx-dim">reading…</div>');
    return load(src, null).then(paintPreview).catch(function (e) { pending = null; msg("bgvInfo", '<div class="fx-dim">⚠ ' + esc(e.message) + "</div>"); });
  }
  function paint() {
    var b = dlg.body;
    b.innerHTML = '<fieldset><legend>💾 Save this timeline as a .bgv</legend>'
      + '<div class="fx-row"><label>name <input type="text" id="bgvName" style="width:180px"></label><span class="fx-dim">.bgv</span>'
      + '<label class="chk"><input type="checkbox" id="bgvDl"> also download it</label><button type="button" id="bgvSave">💾 Save</button></div>'
      + '<div class="fx-dim">Everything on the timeline (layers, clips, keyframes, effects, captions, markers, settings), the nested timelines its nest clips use and the list of its media - kept in the project\'s bgv folder.</div>'
      + '<div id="bgvSaveMsg" class="fx-dim"></div></fieldset>'
      + '<fieldset><legend>📂 Open a .bgv</legend>'
      + '<div class="fx-row"><button type="button" id="bgvPick">From the computer…</button><select id="bgvList" style="max-width:220px"></select><button type="button" id="bgvLook">Look</button></div>'
      + '<input type="file" id="bgvFile" accept=".bgv,application/xml,text/xml" class="hidden" style="display:none">'
      + '<div id="bgvInfo"></div></fieldset>';
    $("bgvName").value = curName();
    $("bgvName").addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") $("bgvSave").click(); });
    $("bgvSave").onclick = function () {
      msg("bgvSaveMsg", "saving…");
      save($("bgvName").value, $("bgvDl").checked).then(function (j) {
        msg("bgvSaveMsg", "✓ " + esc(j.name) + " (" + kb(j.size) + ", " + j.media + " media file(s))" + (j.nested.length ? " · nested: " + j.nested.map(esc).join(", ") : "")
          + (j.missing.length ? " · ⚠ not in the project: " + j.missing.map(esc).join(", ") : ""));
        listFiles();
      }).catch(function (e) { msg("bgvSaveMsg", "⚠ " + esc(e.message)); });
    };
    $("bgvPick").onclick = function () { $("bgvFile").click(); };
    $("bgvFile").onchange = function () {
      var f = $("bgvFile").files && $("bgvFile").files[0]; $("bgvFile").value = ""; if (!f) return;
      f.text().then(function (t) { look({ text: t, label: f.name }); });
    };
    $("bgvLook").onclick = function () { var v = $("bgvList").value; if (v) look({ file: v }); };
    listFiles();
  }
  function listFiles() {
    fetch("/api/bgfile/bgv/list").then(function (r) { return r.json(); }).then(function (j) {
      var s = $("bgvList"); if (!s) return;
      var f = j.files || [];
      s.innerHTML = f.length ? f.map(function (x) { return '<option value="' + esc(x.name) + '">' + esc(x.name) + " — " + kb(x.size) + "</option>"; }).join("") : '<option value="">(none saved in this project)</option>';
    }).catch(function () {});
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlBgvDlg", title: "Video project (.bgv)", width: 600 });
      dlg.foot.innerHTML = '<button type="button" id="bgvDone">Done</button>';
      $("bgvDone").onclick = function () { dlg.close(); };
    }
    paint(); dlg.open();
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlBgvBtn", "🎞", "Video project (.bgv): save this timeline / open one", open);
  }
  window.TlBgv = { open: open, save: save, load: load };
  boot();
})();

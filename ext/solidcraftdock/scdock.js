/* bitGen Studio — ext/solidcraftdock/scdock.js (2.578.0): THE 📐 SOLIDCRAFT DOCKER (window.H3SolidCraftDock).
 * Tim: "yes, lets build a solidcraft bridge, but we will put it in it's own docker".
 * The frame runs SolidCraft (its own UI, every feature) from the app's copy at /solidcraft-app/ - loaded the first time
 * the docker is shown. Not installed: ⤓ Install (the Add-ons job: GitHub release, about 20 MB, once) or 📦 a zip you
 * downloaded. The bar is the bridge (H3SolidCraft, scbridge.js):
 *   📁 Designs ▾         the project's designs and parts (projects/<p>/solidcraft) - open one; 📂 one from the computer
 *   💾 Save to project   the design as <name>.solidcraft in the project; SolidCraft's own Save (Ctrl+S) on that design
 *                        then keeps the project's copy current (a look every 4 s while the docker shows)
 *   🖼 → Image editor    the model from the View picked as a new layer (transparent, the Size picked, Edges);
 *                        Shift: SolidCraft's own render (lit, shaded, slower - the bar shows its progress)
 *   View                 Iso / Front … Bottom / SolidCraft's Named Views - picking one turns SolidCraft's view there
 *                        (its API cannot tell where you orbited to; save an angle as a Named View to picture it)
 *   🎞 → Timeline        the model (OBJ) as a 3D layer at the playhead; sent again it updates the layers that use it
 *   ✏ Sketch → SolidCraft the image editor's selected sketch layer as a SolidCraft sketch (DXF, mm)
 *   ⤓ Export ▾           STEP / STL / OBJ / 3MF into the project's solidcraft folder
 *   2.579.0 (Tim: "add send to blender,send to unreal, send to homebuilder and send to image-editor buttons in soldicraft
 *   docker. only show the docker is solidcraft is installed. only show the blender and unreal buttons if they are
 *   installed too"): the model (OBJ, sc_<name>.obj in the project's 3D models) -> 📏 the Sketcher (2.630.0 - a group; the House builder is gone),
 *   🟠 Blender (POST /api/blender/send - Blender opens with it; shown when Blender is found), 🎮 Unreal (POST
 *   /api/unreal/import - a Static Mesh placed in the open level; shown when an Unreal project / editor is set). No
 *   SolidCraft installed = the docker and its status-bar button are not shown (sc-absent) - Settings ▸ Add-ons installs
 *   it (⤓ or 📦 a zip), then the docker appears (the h3:addons-changed event, or a look every 30 s)
 * The version is in the bar; a newer SolidCraft release shows ⤓ Update. */
(function (root) {
  "use strict";
  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  var B = function () { return root.H3SolidCraft; };
  var S = { installed: false, version: "", loaded: false, latest: null, link: null, busy: false, timer: null, visible: false };

  function msg(t, err) { var m = $("scMsg"); if (m) { m.textContent = t || ""; m.title = t || ""; m.style.color = err ? "#e5534b" : ""; } }
  function prog(f) {
    var p = $("scProg"), b = $("scProgBar"); if (!p || !b) return;
    if (f == null) { p.style.display = "none"; b.style.width = "0"; return; }
    p.style.display = ""; b.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + "%";
  }
  function jget(u) { return fetch(u).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); }); }
  function ask(title, label, value) {
    if (typeof root.askText === "function") return root.askText(title, label, value);
    return Promise.resolve(root.prompt ? root.prompt(label, value) : null);
  }
  function confirmIt(text) { return typeof root.appConfirm === "function" ? root.appConfirm(text, "SolidCraft") : Promise.resolve(root.confirm(text)); }
  function guard(label, fn) {
    if (S.busy) { msg("one thing at a time - " + S.busy + " is still running"); return Promise.resolve(null); }
    S.busy = label;
    return Promise.resolve().then(fn).catch(function (e) { msg(label + ": " + ((e && e.message) || e), true); return null; })
      .then(function (r) { S.busy = false; prog(null); return r; });
  }
  function needOpen() {
    if (!S.installed) throw new Error("install SolidCraft first");
    if (!B().api()) throw new Error("SolidCraft is still starting - a moment");
  }

  /* ---- installed? the frame */
  /** no SolidCraft = no docker and no status-bar button (its button is made after this script - looked at again) */
  function presence() {
    var off = !S.installed;
    [$("solidcraftdock"), $("tX_solidcraftdock")].forEach(function (x) { if (x) x.classList.toggle("sc-absent", off); });
  }
  /** 🟠 / 🎮 only when Blender / an Unreal project are there */
  function checkTools() {
    if (!S.installed) return Promise.resolve(null);
    var a = jget("/api/blender/status").then(function (j) { $("scToBlender").hidden = !(j && j.found); }).catch(function () { $("scToBlender").hidden = true; });
    var b = jget("/api/ue/project").then(function (j) { $("scToUnreal").hidden = !(j && (j.current || j.editor || (j.info && j.info.editor))); }).catch(function () { $("scToUnreal").hidden = true; });
    return Promise.all([a, b]);
  }
  function status() {
    return jget("/api/solidcraft/status").then(function (st) {
      var was = S.installed;
      S.installed = !!st.installed; S.version = st.version || "";
      presence();
      if (S.installed && !was) checkTools();
      $("scInstall").style.display = S.installed ? "none" : "";
      $("scFrameHold").style.display = S.installed ? "" : "none";
      $("scBar").querySelectorAll("button:not(#scVerBtn), select, input").forEach(function (x) { x.disabled = !S.installed; });
      paintVer();
      if (S.installed) { maybeLoad(); checkLatest(); }
      return st;
    }).catch(function (e) { msg("SolidCraft: " + e.message, true); return null; });
  }
  function paintVer() {
    var v = $("scVer"); if (!v) return;
    v.innerHTML = "";
    if (!S.installed) return;
    v.appendChild(doc.createTextNode("v" + (S.version || "?")));
    if (S.latest && S.latest.newer) {
      var b = doc.createElement("button"); b.type = "button"; b.className = "ghost gbtn"; b.id = "scVerBtn";
      b.textContent = "⤓ Update to v" + S.latest.version; b.title = "Download SolidCraft " + S.latest.version + " (your designs are not touched)";
      b.style.marginLeft = "6px"; b.onclick = install; v.appendChild(b);
    }
  }
  function checkLatest() {
    if (S.latest) return;
    S.latest = {};
    jget("/api/solidcraft/latest").then(function (j) { S.latest = j || {}; paintVer(); }).catch(function () { /* offline - fine */ });
  }
  function maybeLoad() {
    if (!S.installed || S.loaded || !S.visible) return;
    S.loaded = true;
    msg("starting SolidCraft…");
    $("scFrame").src = "/solidcraft-app/index.html";
    B().ready(120000).then(function () { msg("SolidCraft " + (S.version ? "v" + S.version + " " : "") + "ready"); }).catch(function (e) { msg(e.message, true); });
  }
  function reload() { S.loaded = false; S.link = null; $("scFrame").src = "about:blank"; setTimeout(maybeLoad, 50); }

  /* ---- install (the Add-ons job) */
  function pollJob(from) {
    var log = $("scInstallLog"); log.style.display = "";
    return jget("/api/addons/job?from=" + (from || 0)).then(function (j) {
      (j.lines || []).forEach(function (l) { log.textContent += l + "\n"; });
      log.scrollTop = log.scrollHeight;
      var m = (j.lines || []).map(function (l) { return /(\d+)%/.exec(l); }).filter(Boolean).pop();
      if (m) prog(+m[1] / 100);
      if (j.job && j.job.id === "solidcraft" && j.job.state === "running") return new Promise(function (r) { setTimeout(r, 700); }).then(function () { return pollJob(j.next); });
      prog(null);
      if (j.job && j.job.state === "error") { msg("install: " + (j.job.error || "failed"), true); return false; }
      msg("SolidCraft installed");
      S.latest = null;
      return status().then(function () { reload(); return true; });
    });
  }
  function install() {
    msg("downloading SolidCraft…"); $("scInstallLog").textContent = "";
    return fetch("/api/solidcraft/install", { method: "POST" }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); }); })
      .then(function () { $("scInstall").style.display = ""; return pollJob(0); })
      .catch(function (e) { msg("install: " + e.message, true); });
  }
  function installZip(file) {
    if (!file) return;
    msg("unpacking " + file.name + "…"); $("scInstallLog").textContent = "";
    return fetch("/api/solidcraft/install-zip", { method: "POST", headers: { "Content-Type": "application/zip" }, body: file })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); }); })
      .then(function () { return pollJob(0); })
      .catch(function (e) { msg("install: " + e.message, true); });
  }

  /* ---- the project's designs */
  var menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  function menu(anchor, rows) {
    closeMenu();
    var m = doc.createElement("div"); menuEl = m;
    m.className = "scMenu";
    m.style.cssText = "position:fixed;z-index:9000;min-width:240px;max-width:420px;max-height:60vh;overflow:auto;background:var(--panel,#24272d);border:1px solid var(--line,#444);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.45);font-size:12px";
    rows.forEach(function (r) {
      if (r.head) { var h = doc.createElement("div"); h.textContent = r.head; h.style.cssText = "padding:6px 8px 2px;opacity:.6;font-size:11px"; m.appendChild(h); return; }
      var row = doc.createElement("div"); row.style.cssText = "display:flex;gap:6px;align-items:center";
      var b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.textContent = r.label; b.title = r.title || r.label;
      b.style.cssText = "flex:1;text-align:left;padding:5px 8px;border:0;background:none;color:inherit;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      b.onmouseenter = function () { b.style.background = "rgba(128,128,128,.18)"; }; b.onmouseleave = function () { b.style.background = "none"; };
      b.onclick = function () { closeMenu(); r.run(); };
      row.appendChild(b);
      if (r.del) { var x = doc.createElement("button"); x.type = "button"; x.className = "ghost"; x.textContent = "🗑"; x.title = "Delete " + r.label; x.style.cssText = "border:0;background:none;cursor:pointer;color:inherit"; x.onclick = function (e) { e.stopPropagation(); closeMenu(); r.del(); }; row.appendChild(x); }
      m.appendChild(row);
    });
    doc.body.appendChild(m);
    var a = anchor.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(a.left, root.innerWidth - m.offsetWidth - 8)) + "px";
    var top = a.bottom + 4; if (top + m.offsetHeight > root.innerHeight - 8) top = Math.max(4, a.top - m.offsetHeight - 4);
    m.style.top = top + "px";
  }
  doc.addEventListener("pointerdown", function (e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }, true);
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

  function designs(anchor) {
    return jget("/api/solidcraft/files").then(function (j) {
      var files = j.files || [], rows = [];
      var ds = files.filter(function (f) { return f.kind === "design"; }), ps = files.filter(function (f) { return f.kind === "part"; });
      rows.push({ head: ds.length ? "Designs in this project" : "No designs in this project yet - 💾 Save to project keeps one here" });
      ds.forEach(function (f) { rows.push({ label: "📐 " + f.name.replace(/\.solidcraft$/, ""), title: f.name + " · " + fmtSize(f.size) + " · " + new Date(f.mtime).toLocaleString(), run: function () { openFromProject(f.name); }, del: function () { delFile(f.name); } }); });
      if (ps.length) { rows.push({ head: "Parts (opened as a new design)" }); ps.forEach(function (f) { rows.push({ label: "🧱 " + f.name, title: f.name + " · " + fmtSize(f.size), run: function () { openFromProject(f.name); }, del: function () { delFile(f.name); } }); }); }
      rows.push({ head: "" });
      rows.push({ label: "📂 Open from the computer…", title: "A .solidcraft design, or STEP / IGES / STL / OBJ / 3MF / glTF", run: function () { $("scOpenFile").click(); } });
      menu(anchor, rows);
    }).catch(function (e) { msg(e.message, true); });
  }
  function openFromProject(name) {
    return guard("open", function () {
      needOpen();
      msg("opening " + name + "…");
      return fetch("/api/solidcraft/file/" + encodeURIComponent(name)).then(function (r) { if (!r.ok) throw new Error("could not read " + name); return r.blob(); })
        .then(function (b) { return B().openFile(name, b); })
        .then(function () {
          if (/\.solidcraft$/i.test(name)) return B().inspect().then(function (ins) { S.link = { path: "/opfs/" + name, name: name, rev: ins.revision }; });
          S.link = null;
        })
        .then(function () { msg(name + " opened" + (S.link ? " - SolidCraft's Save keeps the project's copy current" : "")); });
    });
  }
  function openFromComputer(file) {
    if (!file) return;
    return guard("open", function () { needOpen(); msg("opening " + file.name + "…"); return B().openFile(file.name, file).then(function () { S.link = null; msg(file.name + " opened - 💾 Save to project keeps it in the project"); }); });
  }
  function delFile(name) {
    return confirmIt("Delete " + name + " from the project's solidcraft folder? (it goes to the recycle bin)").then(function (ok) {
      if (!ok) return;
      return fetch("/api/solidcraft/file/" + encodeURIComponent(name), { method: "DELETE" }).then(function (r) { return r.json(); }).then(function (j) { msg(j.error ? j.error : name + " deleted", !!j.error); if (S.link && S.link.name === name) S.link = null; });
    });
  }
  function upload(name, blob) {
    return fetch("/api/solidcraft/save?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
  }
  function save() {
    return guard("save", function () {
      needOpen();
      return B().inspect().then(function (ins) {
        var nm = ins && ins.name && !/^untitled\b/i.test(ins.name) ? ins.name : "";
        return nm ? nm : ask("Save to project", "The design's name", "").then(function (v) { if (v == null || !String(v).trim()) throw new Error("not saved - no name"); return String(v).trim(); });
      }).then(function (stem) {
        msg("saving…");
        return B().saveDesign(stem).then(function (r) {
          return upload(r.name, r.blob).then(function (j) {
            return B().inspect().then(function (ins) { S.link = { path: "/opfs/" + r.name, name: j.name, rev: ins.revision }; msg(j.name + " saved in the project (" + fmtSize(j.size) + ") - SolidCraft's Save now keeps it current"); });
          });
        });
      });
    });
  }
  /** SolidCraft's own Save on a project design -> the project's copy (a look every 4 s while the docker shows) */
  function sync() {
    if (S.busy || !S.link || !S.visible || !B() || !B().api()) return;
    B().inspect().then(function (ins) {
      if (!ins || ins.path !== S.link.path || ins.dirty || ins.revision === S.link.rev) return;
      var rev = ins.revision, name = S.link.name;
      return B().get(name, 0, 10000).then(function (f) { return upload(name, f); }).then(function () { if (S.link && S.link.name === name) S.link.rev = rev; msg(name + " - the project's copy updated"); });
    }).catch(function () { /* the next look */ });
  }

  /* ---- → the image editor / timeline, sketches in, parts out */
  function showDock(id, btn) {
    var d = $(id); if (!d) return false;
    try {
      if (d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone(id, btn);
      if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(id);
    } catch (e) { /* fine */ }
    return true;
  }
  function editor() {
    if (!showDock("imageeditdock", "tIE")) throw new Error("the image editor is not installed (its extension)");
    if (typeof root.mountImageEditor === "function") try { root.mountImageEditor(); } catch (e) { /* fine */ }
    var E = root.imageEditorInstance && root.imageEditorInstance.E;
    if (!E) throw new Error("the image editor did not start");
    return E;
  }
  function sizeFor() {
    var v = $("scSize").value, s = B().parseSize(v);
    if (s) return s;
    var E = root.imageEditorInstance && root.imageEditorInstance.E;
    return E && E.S && E.S.w ? { w: E.S.w, h: E.S.h } : { w: 1024, h: 768 };
  }
  /** the picked view's camera, applied in SolidCraft (null = its own Iso framing) */
  function pickedCam() { var v = $("scView").value; return v ? B().view(v) : Promise.resolve(null); }
  function fillViews() {
    if (!B() || !B().api()) return;
    B().views().then(function (vs) {
      var sel = $("scView"), keep = sel.value;
      Array.prototype.slice.call(sel.querySelectorAll("option[data-named]")).forEach(function (o) { o.remove(); });
      vs.forEach(function (v) { var o = doc.createElement("option"); o.value = v.name; o.textContent = "★ " + v.name; o.dataset.named = "1"; sel.appendChild(o); });
      sel.value = keep; if (sel.value !== keep) sel.value = "";
    });
  }
  function toEditor(rendered) {
    return guard("→ Image editor", function () {
      needOpen();
      var sz = sizeFor(), cam = null;
      return pickedCam().then(function (c) { cam = c; return B().inspect(); }).then(function (ins) {
        var name = "📐 " + ((ins && ins.name) || "SolidCraft");
        var p;
        if (rendered) { msg("SolidCraft is rendering " + sz.w + " × " + sz.h + "…"); prog(0); p = B().render({ w: sz.w, h: sz.h, cam: cam }, function (f, ph) { prog(f); msg("SolidCraft is rendering " + sz.w + " × " + sz.h + " - " + (ph || "") + " " + Math.round(f * 100) + "%"); }); }
        else { msg("drawing the view…"); p = B().snapshot({ w: sz.w, h: sz.h, edges: $("scEdges").checked, cam: cam }); }
        return p.then(function (r) {
          var E = editor(), url = root.URL.createObjectURL(r.blob);
          return Promise.resolve(E.load(url, name.replace(/[^\w ()+.,&'-]+/g, "").trim() || "SolidCraft", true)).then(function () {
            setTimeout(function () { root.URL.revokeObjectURL(url); }, 60000);
            msg(name + " → the image editor (" + r.w + " × " + r.h + (rendered ? ", rendered" : "") + ")");
          });
        });
      });
    });
  }
  /** the model as sc_<design>.obj in the project's 3D models (the timeline, the Sketcher, Blender, Unreal use it) -> its name */
  function modelToProject() {
    return B().inspect().then(function (ins) {
      var stem = B().stemOf((ins && ins.name) || "design"), name = "sc_" + stem.replace(/[^\w-]+/g, "_") + ".obj";
      msg("exporting the model…");
      return B().exportPart("obj").then(function (blob) {
        return fetch("/api/tlcanvas/model?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j.name || name; }); });
      });
    });
  }
  /* 2.630.0: the House builder is gone - 📏 Send to Sketcher: the part (OBJ in the project's 3D models) into the Sketcher as a
     group (move / turn / scale / paint it there, put it in a room) */
  function toSketcher() {
    return guard("📏 Send to Sketcher", function () {
      needOpen();
      return modelToProject().then(function (saved) {
        var d = root.document.getElementById("pushpulldock"); if (!d || !root.H3PushPull) throw new Error("the Sketcher is not installed (its extension)");
        if (d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone("pushpulldock", "tX_pushpulldock");
        if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse("pushpulldock");
        var wait = function (n) { return root.H3PushPull.state && root.H3PushPull.state.booted ? Promise.resolve() : n > 0 ? new Promise(function (ok) { setTimeout(ok, 250); }).then(function () { return wait(n - 1); }) : Promise.reject(new Error("the Sketcher did not start")); };
        return wait(120).then(function () { return root.H3PushPull.importModel(saved); }).then(function () { msg(saved + " → the 📏 Sketcher: in as a group - move / turn / scale it there"); });
      });
    });
  }

  function toBlender() {
    return guard("🟠 Send to Blender", function () {
      needOpen();
      return modelToProject().then(function (saved) {
        return fetch("/api/blender/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: saved }) })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || r.status); return j; }); })
          .then(function (j) { msg("Blender is opening with " + saved + " - saved as " + String(j.blend || "").split(/[\\/]/).slice(-3).join("/")); });
      });
    });
  }
  function toUnreal() {
    return guard("🎮 Send to Unreal", function () {
      needOpen();
      return modelToProject().then(function (saved) {
        msg("importing " + saved + " into Unreal…");
        return fetch("/api/unreal/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: saved }) })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(/ECONNREFUSED|not answer|connect/i.test(j.error || "") ? "Unreal is not answering - open your project in Unreal (🎮 Load UE project) with the bitGen Bridge plugin" : (j.error || r.status)); return j; }); })
          .then(function (j) { msg(saved + " → Unreal: " + ((j.assets || [])[0] || "imported") + (j.actor ? ", placed in the level as " + j.actor : "")); });
      });
    });
  }
  function toTimeline() {
    return guard("→ Timeline", function () {
      needOpen();
      return Promise.resolve().then(function () {
        return modelToProject().then(function (saved) {
          var n = root.TlBody && root.TlBody.reload ? root.TlBody.reload(saved) : 0;
          if (n) { msg(saved + " sent again - " + n + " 3D layer(s) on the timeline updated"); return; }
          showDock("timelinedock", "tTL");
          if (!root.TlM3D || !root.TlM3D.add) throw new Error("the model is in the project's 3D models (" + saved + ") - open the timeline docker to place it");
          root.TlM3D.add("model", saved, { x: 0, y: 0 });
          msg(saved + " → the timeline: a 3D layer at the playhead");
        });
      });
    });
  }
  function sketchIn() {
    return guard("✏ Sketch → SolidCraft", function () {
      needOpen();
      var E = root.imageEditorInstance && root.imageEditorInstance.E;
      var L = E && E.sketch && E.sketch.cur && E.sketch.cur();
      if (!L || !E.sketchCAD || !E.sketchCAD.exportText) throw new Error("select a sketch layer in the image editor first (Layer ▸ New Sketch)");
      var dxf = E.sketchCAD.exportText(L, "dxf", { unit: "mm", scale: 1 });
      return B().sketchIn(dxf).then(function (r) {
        var c = (r && r.created) || {};
        msg("\"" + L.name + "\" → a SolidCraft sketch (" + ((c.curves || []).length) + " curves, " + ((c.constraints || []).length) + " constraints) - Finish Sketch, then Extrude or Revolve");
      });
    });
  }
  function exportMenu(anchor) {
    menu(anchor, [{ head: "Into the project's solidcraft folder" }].concat([["step", "STEP (exact solids - other CAD programs)"], ["stl", "STL (3D printing)"], ["obj", "OBJ (3D programs, the timeline)"], ["3mf", "3MF (3D printing, with units)"]].map(function (f) {
      return { label: f[1], run: function () { exportAs(f[0]); } };
    })));
  }
  function exportAs(fmt) {
    return guard("⤓ Export", function () {
      needOpen();
      return B().inspect().then(function (ins) {
        var name = B().stemOf((ins && ins.name) || "design") + "." + fmt;
        msg("exporting " + name + "…");
        return B().exportPart(fmt).then(function (b) { return upload(name, b); }).then(function (j) { msg(j.name + " saved in the project's solidcraft folder (" + fmtSize(j.size) + ")"); });
      });
    });
  }

  /* ---- boot */
  function boot() {
    if (!$("solidcraftdock") || !$("scFrame")) return false;
    if ($("solidcraftdock").dataset.scBound) return true;
    $("solidcraftdock").dataset.scBound = "1";
    var inp = doc.createElement("input"); inp.type = "file"; inp.id = "scOpenFile"; inp.className = "hidden";
    inp.accept = ".solidcraft,.json,.step,.stp,.igs,.iges,.stl,.obj,.3mf,.glb,.gltf,.fcstd,.3dm";
    inp.onchange = function () { openFromComputer(inp.files && inp.files[0]); inp.value = ""; };
    $("scBody").appendChild(inp);
    $("scInstallBtn").onclick = install;
    $("scInstallZip").onclick = function () { $("scZipFile").click(); };
    $("scZipFile").onchange = function () { installZip(this.files && this.files[0]); this.value = ""; };
    $("scDesigns").onclick = function () { designs(this); };
    $("scSave").onclick = save;
    $("scToEditor").onclick = function (e) { toEditor(!!e.shiftKey); };
    $("scToTimeline").onclick = toTimeline;
    $("scToSketcher").onclick = toSketcher;
    $("scToBlender").onclick = toBlender;
    $("scToUnreal").onclick = toUnreal;
    root.addEventListener("h3:addons-changed", function () { S.latest = null; status(); });
    setInterval(function () { if (!S.installed) status(); else presence(); }, 30000);
    setTimeout(presence, 1500);                                   // the status-bar button is made after this script
    setInterval(function () { if (S.installed && S.visible) checkTools(); }, 120000);
    $("scSketchIn").onclick = sketchIn;
    $("scExport").onclick = function () { exportMenu(this); };
    $("scView").addEventListener("pointerdown", fillViews);
    $("scView").addEventListener("focus", fillViews);
    $("scView").onchange = function () { var v = this.value; if (B() && B().api()) B().view(v || "iso").then(function () { msg("the view: " + (v || "iso")); }).catch(function (e) { msg(e.message, true); }); };
    // load SolidCraft (about 50 MB of WebAssembly) only once the docker is on screen
    var hold = $("scFrameHold"), dock = $("solidcraftdock");
    function seen() { var r = dock.getBoundingClientRect(); return !dock.classList.contains("collapsed") && !dock.classList.contains("dockgone") && r.width > 0 && r.height > 60; }
    function look() { var v = seen(); if (v !== S.visible) { S.visible = v; if (v) maybeLoad(); } }
    if (root.IntersectionObserver) new root.IntersectionObserver(look).observe(hold);
    if (root.MutationObserver) new root.MutationObserver(look).observe(dock, { attributes: true, attributeFilter: ["class", "style"] });
    setInterval(look, 1500);
    look();
    S.timer = setInterval(sync, 4000);
    status();
    return true;
  }
  root.H3SolidCraftDock = { state: S, status: status, presence: presence, checkTools: checkTools, toSketcher: toSketcher, toBlender: toBlender, toUnreal: toUnreal, modelToProject: modelToProject, install: install, installZip: installZip, save: save, sync: sync, toEditor: toEditor, toTimeline: toTimeline,
    sketchIn: sketchIn, exportAs: exportAs, openFromProject: openFromProject, designs: designs, reload: reload };
  if (!boot()) { var n = 0, t = setInterval(function () { if (boot() || ++n > 120) clearInterval(t); }, 500); }
})(typeof window !== "undefined" ? window : globalThis);

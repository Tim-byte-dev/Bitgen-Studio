/* bitGen Studio — 🥽 VR WORLD DIALOG (2.368.0).
 *
 * Tim: "is it possible for bitgen to create vr 3d sbs movies from reference pictures and audio references-
 * maybe using a 360 sbs picture as reference?" -> "lets try route 2. and add a wan2.1 style so we can use wan
 * as well, also wan2.2".
 *
 *   LEFT    🌐 World: the 360 / 180 picture (click = choose, or drop a picture / an Image asset) · its VR type
 *           · the panorama: CLICK where the performer stands (yaw / pitch) · View ° · Shape · Size · what the
 *           camera sees
 *   MIDDLE  the performer: up to 3 pictures · ♪ the sound (a song or a voice) + its start · the prompt ·
 *           Engine (MiniMax H3 · H3 + the sound lip-synced · every Wan style) · Seconds · Seed · Lock the
 *           background · ✎ First frame (the image-edit style puts the performer INTO the view - the render
 *           starts on it, so the place stays the place)
 *   RIGHT   ▶ Render VR · the job's progress · the finished file (it is in the gallery; open it in your headset)
 * Server: routes/vrWorld.js + lib/vrWorld.js; the job: vr_world_worker.py.
 *
 * window.VrWorld = { install(ctx), open(), close(), state() }    ctx = { drag(), note(msg), refresh() }
 */
(function () {
  "use strict";
  var ctx = { drag: function () { return null; }, note: function () {}, refresh: function () {} };
  var cur = null;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function jget(url) { return fetch(url).then(function (r) { return r.json(); }); }
  function jpost(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); });
  }
  function upload(slot, file) {
    var fd = new FormData();
    fd.append("slot", slot);
    fd.append("file", file, file.name || "file");
    return fetch("/api/vrworld/upload", { method: "POST", body: fd })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); });
  }

  var CSS = ""
    + "dialog.vwdlg{width:96vw;max-width:96vw;height:92vh;max-height:92vh;padding:0;display:flex;flex-direction:column;overflow:hidden}"
    + "dialog.vwdlg:not([open]){display:none}"
    + ".vwdlg .vwHead{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line,#333)}"
    + ".vwdlg .vwHead h2{margin:0;font-size:.9rem;flex:1}"
    + ".vwdlg .vwGrid{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,.9fr);gap:12px;padding:10px;overflow:auto}"
    + ".vwdlg .vwCol{min-width:0;display:flex;flex-direction:column;gap:6px}"
    + ".vwdlg .vwLbl{font-family:var(--disp);font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--tiger,#f59e2c)}"
    + ".vwdlg .vwDrop{border:2px dashed var(--line,#444);border-radius:8px;display:flex;align-items:center;justify-content:center;"
    + "text-align:center;color:var(--dim,#999);font-size:.75rem;cursor:pointer;background:var(--panel-2,#222);min-height:44px;padding:6px}"
    + ".vwdlg .vwDrop:hover,.vwdlg .vwDrop.hot{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".vwdlg .vwPano{position:relative;width:100%;background:#000;border-radius:6px;overflow:hidden;cursor:crosshair;min-height:60px}"
    + ".vwdlg .vwPano img{width:100%;display:block}"
    + ".vwdlg .vwDot{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--tiger,#f59e2c);"
    + "box-shadow:0 0 0 2px #000;pointer-events:none}"
    + ".vwdlg .vwBar{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:.74rem}"
    + ".vwdlg .vwBar input[type=number]{width:66px}"
    + ".vwdlg .vwView{width:100%;max-height:30vh;object-fit:contain;background:#000;border-radius:6px;border:1px solid var(--line,#444)}"
    + ".vwdlg .vwPics{display:flex;gap:6px}"
    + ".vwdlg .vwPic{position:relative;width:72px;height:96px;border:2px dashed var(--line,#444);border-radius:6px;display:flex;"
    + "align-items:center;justify-content:center;color:var(--dim,#999);cursor:pointer;overflow:hidden;background:var(--panel-2,#222)}"
    + ".vwdlg .vwPic img{width:100%;height:100%;object-fit:cover}"
    + ".vwdlg .vwX{position:absolute;top:2px;right:2px;background:rgba(0,0,0,.7);color:#fff;border:0;border-radius:4px;font-size:.7rem;cursor:pointer;padding:0 4px}"
    + ".vwdlg textarea{width:100%;min-height:90px;resize:vertical;box-sizing:border-box}"
    + ".vwdlg .vwFirst{position:relative;width:100%;max-height:28vh;background:#000;border-radius:6px;overflow:hidden;display:none}"
    + ".vwdlg .vwFirst.on{display:block}.vwdlg .vwFirst img{width:100%;max-height:28vh;object-fit:contain;display:block}"
    + ".vwdlg .vwMsg{font-size:.72rem;color:var(--dim,#999);min-height:1em;white-space:pre-wrap}"
    + ".vwdlg .vwMsg.bad{color:#e5484d}"
    + ".vwdlg .vwOut{width:100%;background:#000;border-radius:6px;max-height:40vh;display:none}"
    + ".vwdlg .vwOut.on{display:block}"
    + ".vwdlg .vwGo{font-size:.85rem;padding:6px 14px}"
    + ".vwdlg .vwHint{font-size:.66rem;color:var(--dim,#999);line-height:1.4}";

  function css() {
    if (document.getElementById("vwStyle")) return;
    var s = el("style"); s.id = "vwStyle"; s.textContent = CSS; document.head.appendChild(s);
  }

  function build() {
    css();
    var dlg = el("dialog", "vwdlg");
    dlg.setAttribute("aria-label", "VR World");
    dlg.innerHTML = ''
      + '<div class="vwHead"><h2>🥽 VR World — a performer inside a 360° / 180° picture</h2>'
      + '<button type="button" class="ghost gbtn" data-k="close" aria-label="Close">✕</button></div>'
      + '<div class="vwGrid">'
      + '<div class="vwCol">'
      + '<div class="vwLbl">🌐 World</div>'
      + '<div class="vwDrop" data-k="world" tabindex="0" role="button" title="Click to choose a 360° or 180° picture - or drop one / an Image asset here">'
      + 'Click to choose a 360° / 180° picture (mono, stereo top-bottom or side by side)</div>'
      + '<input type="file" data-k="worldIn" accept="image/*" hidden>'
      + '<div class="vwBar"><label>Type <select data-k="mode" aria-label="VR type"></select></label><span class="vwHint" data-k="worldInfo"></span></div>'
      + '<div class="vwPano" data-k="pano" title="Click where the performer stands - the virtual camera aims there"><img data-k="panoImg" alt=""><div class="vwDot" data-k="dot"></div></div>'
      + '<div class="vwBar">'
      + '<label>Yaw <input type="number" data-k="yaw" step="1" min="-180" max="180"></label>'
      + '<label>Pitch <input type="number" data-k="pitch" step="1" min="-85" max="85"></label>'
      + '<label>View ° <input type="number" data-k="fov" step="1" min="20" max="140" title="The virtual camera\'s horizontal field of view - smaller = the performer bigger and sharper"></label>'
      + '<label>Shape <select data-k="shape"><option>1:1</option><option>3:4</option><option>9:16</option><option>4:3</option><option>16:9</option></select></label>'
      + '<label title="The render\'s short side in pixels - 0 = matched to the picture\'s sharpness">Size <input type="number" data-k="short" step="16" min="0" max="1088"></label>'
      + '<span class="vwHint" data-k="size"></span></div>'
      + '<div class="vwLbl">What the camera sees</div>'
      + '<img class="vwView" data-k="view" alt="">'
      + '</div>'
      + '<div class="vwCol">'
      + '<div class="vwLbl">The performer</div>'
      + '<div class="vwPics" data-k="pics"></div>'
      + '<input type="file" data-k="picIn" accept="image/*" hidden>'
      + '<div class="vwDrop" data-k="sound" tabindex="0" role="button" title="Click to choose a song or a voice - or drop a sound file / a Sound asset here">♪ Click to choose a sound (song / voice)</div>'
      + '<input type="file" data-k="soundIn" accept="audio/*" hidden>'
      + '<div class="vwBar"><label>Sound from <input type="number" data-k="soundStart" step="0.1" min="0"> s</label>'
      + '<button type="button" class="ghost gbtn" data-k="soundX" title="Remove the sound">✕ sound</button></div>'
      + '<textarea data-k="prompt" placeholder="Who they are and what they do - e.g. She sings to the camera, swaying gently, warm stage light on her face." aria-label="Prompt"></textarea>'
      + '<div class="vwBar"><label>Engine <select data-k="engine" aria-label="Engine"></select></label></div>'
      + '<div class="vwBar"><label>Seconds <input type="number" data-k="seconds" step="0.5" min="1" max="15"></label>'
      + '<label>Seed <input type="number" data-k="seed" step="1" min="-1"></label>'
      + '<label title="Outside the performer both eyes show the picture itself - no shimmer and no seam, but no shadows on the floor either"><input type="checkbox" data-k="lock"> Lock the background</label></div>'
      + '<div class="vwBar"><button type="button" class="gbtn" data-k="first" title="The image-edit style puts the performer into the view - the render starts on it">✎ First frame</button>'
      + '<span class="vwHint" data-k="firstInfo"></span></div>'
      + '<div class="vwFirst" data-k="firstBox"><img data-k="firstImg" alt=""><button type="button" class="vwX" data-k="firstX" title="Start from the empty view instead">✕</button></div>'
      + '</div>'
      + '<div class="vwCol">'
      + '<div class="vwLbl">The VR clip</div>'
      + '<button type="button" class="gbtn vwGo" data-k="go">▶ Render VR</button>'
      + '<div class="vwMsg" data-k="msg"></div>'
      + '<video class="vwOut" data-k="out" controls playsinline></video>'
      + '<div class="vwHint">The finished file is in the gallery (Videos), named …_vrworld_360 / _360_TB / _360_LR / _180_LR '
      + 'with VR metadata - copy it to your headset and open it in its player (Quest: Meta Quest TV / Skybox / DeoVR).<br><br>'
      + 'Only the area around the performer moves; the rest of the world is the still picture. Stereo: the place keeps its own '
      + 'depth and the performer stands at the depth of the ground at their feet. Best results: a static camera prompt, the '
      + 'performer framed with a margin, a View ° of 50-80.</div>'
      + '</div></div>';
    document.body.appendChild(dlg);
    var q = function (k) { return dlg.querySelector('[data-k="' + k + '"]'); };
    cur = { dlg: dlg, q: q, st: null, poll: 0, viewT: 0, job: "" };
    wire();
    return cur;
  }

  function msg(t, bad) { if (!cur) return; var m = cur.q("msg"); m.textContent = t || ""; m.classList.toggle("bad", !!bad); }

  function dropOf(e) {
    var d = ctx.drag ? ctx.drag() : null;
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    return { file: f, asset: d && (d.type === "asset" || d.type === "output") ? { kind: d.type === "output" ? "output" : d.kind, name: d.name } : null };
  }
  function takeDrop(zone, slot, kinds) {
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("hot"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("hot"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault(); e.stopPropagation(); zone.classList.remove("hot");
      var x = dropOf(e);
      if (x.file) return upload(slot, x.file).then(apply);
      if (x.asset && kinds.indexOf(x.asset.kind) >= 0) return jpost("/api/vrworld/asset", { slot: slot, kind: x.asset.kind, name: x.asset.name }).then(apply);
      msg("drop a " + (slot === "sound" ? "sound" : "picture") + " file or a matching asset", true);
    });
  }

  function set(body) { return jpost("/api/vrworld/set", body).then(apply); }

  function wire() {
    var q = cur.q;
    q("close").addEventListener("click", close);
    // world
    var world = q("world"), wIn = q("worldIn");
    world.addEventListener("click", function () { wIn.click(); });
    world.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); wIn.click(); } });
    wIn.addEventListener("change", function () { var f = wIn.files && wIn.files[0]; wIn.value = ""; if (f) { msg("loading " + f.name + "…"); upload("world", f).then(apply); } });
    takeDrop(world, "world", ["images", "output"]);
    q("mode").addEventListener("change", function () { set({ vr_mode: this.value }); });
    q("pano").addEventListener("click", function (e) {
      var s = cur.st && cur.st.session;
      if (!s || !s.world) return;
      var r = q("panoImg").getBoundingClientRect();
      if (!r.width || !r.height) return;
      var u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      var span = (s.vr_mode === "sbs180") ? 180 : 360;
      set({ view: { yaw: Math.round((u - 0.5) * span), pitch: Math.round((0.5 - v) * 180) } });
    });
    ["yaw", "pitch", "fov"].forEach(function (k) {
      q(k).addEventListener("change", function () { var b = { view: {} }; b.view[k] = +this.value; set(b); });
    });
    q("shape").addEventListener("change", function () { set({ view: { shape: this.value } }); });
    q("short").addEventListener("change", function () { set({ short_side: +this.value || 0 }); });
    // performer
    var picIn = q("picIn");
    picIn.addEventListener("change", function () { var f = picIn.files && picIn.files[0]; picIn.value = ""; if (f) upload("picture", f).then(apply); });
    var snd = q("sound"), sIn = q("soundIn");
    snd.addEventListener("click", function () { sIn.click(); });
    snd.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sIn.click(); } });
    sIn.addEventListener("change", function () { var f = sIn.files && sIn.files[0]; sIn.value = ""; if (f) upload("sound", f).then(apply); });
    takeDrop(snd, "sound", ["sound", "output"]);
    q("soundX").addEventListener("click", function () { jpost("/api/vrworld/clear", { slot: "sound" }).then(apply); });
    q("soundStart").addEventListener("change", function () { set({ sound_start: +this.value || 0 }); });
    q("prompt").addEventListener("change", function () { set({ prompt: this.value }); });
    q("engine").addEventListener("change", function () { set({ engine: this.value }); });
    q("seconds").addEventListener("change", function () { set({ seconds: +this.value || 5 }); });
    q("seed").addEventListener("change", function () { set({ seed: parseInt(this.value, 10) }); });
    q("lock").addEventListener("change", function () { set({ lock: this.checked }); });
    q("first").addEventListener("click", makeFirst);
    q("firstX").addEventListener("click", function () { jpost("/api/vrworld/clear", { slot: "first" }).then(apply); });
    q("go").addEventListener("click", render);
  }

  function pics(s) {
    var box = cur.q("pics");
    box.innerHTML = "";
    (s.pictures || []).forEach(function (n, i) {
      var p = el("div", "vwPic");
      p.innerHTML = '<img alt="" src="/api/vrworld/file/' + encodeURIComponent(n) + '"><button type="button" class="vwX" title="Remove">✕</button>';
      p.querySelector("button").addEventListener("click", function (e) { e.stopPropagation(); jpost("/api/vrworld/clear", { slot: "picture", index: i }).then(apply); });
      box.appendChild(p);
    });
    if ((s.pictures || []).length < 3) {
      var add = el("div", "vwPic", "＋");
      add.title = "Add a picture of the performer (click, or drop a picture / an Image asset)";
      add.setAttribute("role", "button"); add.tabIndex = 0;
      add.addEventListener("click", function () { cur.q("picIn").click(); });
      takeDrop(add, "picture", ["images", "output"]);
      box.appendChild(add);
    }
  }

  function apply(j) {
    if (!cur || !j) return j;
    if (j.error) { msg(j.error, true); return j; }
    cur.st = j;
    var s = j.session, q = cur.q;
    var modeSel = q("mode");
    if (!modeSel.options.length) (j.modes || []).forEach(function (m) { var o = el("option"); o.value = m.id; o.textContent = m.label; modeSel.appendChild(o); });
    modeSel.value = s.vr_mode || "";
    q("world").textContent = s.world ? "🌐 " + (s.world_name || s.world) + " — click to change" : "Click to choose a 360° / 180° picture (mono, stereo top-bottom or side by side)";
    q("worldInfo").textContent = s.world ? (s.world_w + "x" + s.world_h + (s.sure ? "" : " · check the type")) : "";
    var img = q("panoImg");
    if (s.world) {
      var src = "/api/vrworld/pano?w=" + encodeURIComponent(s.world + s.vr_mode);
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    } else img.removeAttribute("src");
    var span = s.vr_mode === "sbs180" ? 180 : 360;
    var dot = q("dot");
    dot.style.display = s.world ? "block" : "none";
    dot.style.left = ((s.view.yaw / span + 0.5) * 100) + "%";
    dot.style.top = ((0.5 - s.view.pitch / 180) * 100) + "%";
    q("yaw").value = s.view.yaw; q("pitch").value = s.view.pitch; q("fov").value = s.view.fov; q("shape").value = s.view.shape;
    q("short").value = s.short_side || 0;
    q("size").textContent = j.view_size ? ("renders " + j.view_size.width + "x" + j.view_size.height + (j.auto_short_side ? " (auto)" : "")) : "";
    if (s.world) {
      clearTimeout(cur.viewT);
      var key = [s.world, s.vr_mode, s.view.yaw, s.view.pitch, s.view.fov, s.view.shape].join("|");
      if (cur.viewKey !== key) {
        cur.viewKey = key;
        cur.viewT = setTimeout(function () { q("view").setAttribute("src", "/api/vrworld/view?k=" + encodeURIComponent(key)); }, 150);
      }
    } else q("view").removeAttribute("src");
    pics(s);
    q("sound").textContent = s.sound ? "♪ " + (s.sound_name || s.sound) + " — click to change" : "♪ Click to choose a sound (song / voice)";
    q("soundStart").value = s.sound_start || 0;
    if (document.activeElement !== q("prompt")) q("prompt").value = s.prompt || "";
    var eng = q("engine");
    eng.innerHTML = "";
    (j.engines || []).forEach(function (e) { var o = el("option"); o.value = e.id; o.textContent = e.label; eng.appendChild(o); });
    eng.value = s.engine;
    q("seconds").value = s.seconds; q("seed").value = s.seed; q("lock").checked = !!s.lock;
    var fb = q("firstBox");
    fb.classList.toggle("on", !!s.first);
    if (s.first) q("firstImg").setAttribute("src", "/api/vrworld/file/" + encodeURIComponent(s.first));
    q("first").disabled = s.first_status === "running" || !j.edit.ok;
    q("firstInfo").textContent = !j.edit.ok ? "needs an image-edit style (Qwen Image 2.1 edit)"
      : s.first_status === "running" ? "✎ " + j.edit.name + " is making it…"
      : s.first_status === "failed" ? "✎ failed: " + (s.first_error || "?")
      : s.first ? "the render starts on this frame" : "optional - " + j.edit.name + " puts the performer into the view";
    if (j.note) msg(j.note);
    q("go").title = j.ready || "Render the VR clip";
    schedule();
    return j;
  }

  function schedule() {
    clearTimeout(cur.poll);
    var s = cur.st && cur.st.session;
    var busy = (s && s.first_status === "running") || cur.job;
    if (busy) cur.poll = setTimeout(tick, 2000);
  }
  function tick() {
    if (!cur) return;
    var p = jget("/api/vrworld").then(apply);
    if (cur.job) {
      var id = cur.job;
      p = p.then(function () { return jget("/api/jobs/" + encodeURIComponent(id) + "?log_from=0"); }).then(function (jb) {
        if (!jb || !jb.status || !cur || cur.job !== id) return;
        var last = (jb.log && jb.log.length) ? jb.log[jb.log.length - 1] : "";
        if (jb.status === "done") {
          cur.job = "";
          msg("✔ " + (jb.output || "done") + " - in the gallery (Videos)");
          var v = cur.q("out");
          v.src = "/outputs/" + encodeURIComponent(jb.output || "");
          v.classList.add("on");
          try { ctx.refresh(); } catch (e) {}
          cur.q("go").disabled = false;
        } else if (jb.status === "failed" || jb.status === "cancelled") {
          cur.job = "";
          msg("✖ " + jb.status + (last ? ": " + last : ""), true);
          cur.q("go").disabled = false;
        } else msg((jb.status === "queued" ? "queued…" : "rendering…") + (last ? "\n" + last : ""));
      });
    }
    p.then(schedule, schedule);
  }

  function makeFirst() {
    msg("✎ making the first frame…");
    return jpost("/api/vrworld/first", {}).then(apply);
  }

  function render() {
    var q = cur.q;
    var body = { prompt: q("prompt").value };
    q("go").disabled = true;
    msg("queueing…");
    return jpost("/api/vrworld/render", body).then(function (j) {
      if (j.error) { q("go").disabled = false; msg(j.error, true); return j; }
      cur.job = j.id;
      msg(j.note || "queued");
      ctx.note("VR World: " + (j.note || "queued"));
      schedule();
      return j;
    });
  }

  function open() {
    var c = cur || build();
    if (!c.dlg.open) { try { c.dlg.showModal(); } catch (e) { c.dlg.setAttribute("open", ""); } }
    return jget("/api/vrworld").then(apply).then(function () { return c; }, function () { return c; });
  }
  function close() {
    if (!cur) return;
    clearTimeout(cur.poll); clearTimeout(cur.viewT);
    try { cur.q("out").pause(); } catch (e) {}
    try { cur.dlg.close(); } catch (e) { cur.dlg.removeAttribute("open"); }
    if (cur.dlg.parentNode) cur.dlg.parentNode.removeChild(cur.dlg);
    cur = null;
  }
  function install(o) {
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ctx[k] = o[k];
    // the video docker's "🥽 VR World" button (ext/videodock/dock.html #vdVrWorld)
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("#vdVrWorld")) { e.preventDefault(); open(); }
    });
  }

  window.VrWorld = { install: install, open: open, close: close, state: function () { return cur; },
                     _api: { apply: apply, render: render, makeFirst: makeFirst, tick: tick } };
})();

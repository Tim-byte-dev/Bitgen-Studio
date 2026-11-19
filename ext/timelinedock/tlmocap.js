/* bitGen Studio — ext/timelinedock/tlmocap.js (2.869.0): 🕺 Mocap on the timeline - RGB MoCap (Tim: "can we add this to timeline for
 * mocap, https://github.com/toyxyz/toyxyz_RGBMocap").
 * RGB MoCap is a Windows app with its own window (no command line), so the panel walks it:
 *   ① the clip (the video clips on the timeline; the one under the playhead first) -> its used part cut to projects/<p>/mocap/<clip>/
 *      (/api/mocap/rgb/prepare) - the path shown + 📋 copied;  ② ▶ Open RGB MoCap (File ▸ Open Video, Reconstruct 3D, Export FBX / BVH
 *      into that folder);  ③ what is exported there is listed (every 5 s while open) - ⤓ To the timeline = a 🕺 3D layer at the playhead
 *      that plays its animation (a .bvh is made an .fbx by Blender). Not installed: the panel says so and opens Settings ▸ Add-ons. */
(function (root) {
  "use strict";
  var doc = root.document, $ = function (id) { return doc.getElementById(id); };
  var timer = null, last = null;
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function api(u, body) {
    return root.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; }); });
  }
  function say(t, err) { var m = $("tlMocapMsg"); if (m) { m.textContent = t || ""; m.style.color = err ? "#e53935" : ""; } }
  function T() { try { return root.tl || (typeof tl !== "undefined" ? tl : null); } catch (e) { return null; } }
  function now() { try { return root.TlCanvas && TlCanvas.state ? +TlCanvas.state.t || 0 : 0; } catch (e) { return 0; } }
  /** the video clips on the timeline: [{key, c, lk, label}] - the one under the playhead first */
  function clips() {
    var t = T(); if (!t) return [];
    var out = [], add = function (list, lk, lab) { (list || []).forEach(function (c, i) { if (c && c.name && (c.src === "video" || !c.src) && !c.m3d && !/^m3d_/.test(c.name)) out.push({ key: lk + "#" + i, c: c, lk: lk, label: lab + " · " + c.name }); }); };
    add(t.video, "v1", "V1"); (t.vlayers || []).forEach(function (L, i) { add(L && L.clips, "vl:" + i, (L && L.name) || "Layer " + (i + 2)); });
    var p = now(), len = function (c) { return Math.max(0, (+c.out || 0) - (+c.in || 0)); };
    out.sort(function (a, b) { var ia = p >= (+a.c.start || 0) && p < (+a.c.start || 0) + len(a.c), ib = p >= (+b.c.start || 0) && p < (+b.c.start || 0) + len(b.c); return (ib ? 1 : 0) - (ia ? 1 : 0); });
    return out;
  }
  function paintClips() {
    var s = $("tlMocapClip"); if (!s) return; var L = clips(), was = s.value;
    s.innerHTML = L.length ? L.map(function (x) { return '<option value="' + esc(x.key) + '">' + esc(x.label) + "</option>"; }).join("") : '<option value="">no video clips on the timeline</option>';
    if (was && L.some(function (x) { return x.key === was; })) s.value = was;
  }
  function paintResults(r) {
    last = r; var st = r.status || {}, box = $("tlMocapList"), inst = $("tlMocapInst");
    inst.innerHTML = !st.windows ? "⚠ " + esc(st.note || "RGB MoCap runs on Windows only") + " - you can still bring in FBX / BVH files exported elsewhere into the folder below."
      : st.installed ? "✓ RGB MoCap is installed" : 'RGB MoCap is not installed. <button class="ghost" type="button" id="tlMocapGetIt">⬇ Settings ▸ Add-ons ▸ RGB MoCap</button>';
    if ($("tlMocapGetIt")) $("tlMocapGetIt").onclick = function () { try { $("openSettings").onclick(); setTimeout(function () { var b = doc.querySelector('[data-stab="addons"]'); if (b) b.click(); }, 400); } catch (e) { /* fine */ } };
    $("tlMocapOpen").disabled = !(st.windows && st.installed);
    $("tlMocapFolder").textContent = r.folder || "";
    box.innerHTML = (r.results || []).length ? r.results.map(function (x) {
      return '<div class="mr"><span title="' + esc(x.rel) + '">' + (x.kind === "bvh" ? "🦴" : "🕺") + " " + esc(x.rel) + '</span><span class="d">' + new Date(x.mtime).toLocaleString() + "</span>"
        + '<button class="ghost" type="button" data-bring="' + esc(x.rel) + '">' + (x.inTimeline ? "⤓ Again" : "⤓ To the timeline") + "</button></div>";
    }).join("") : '<div class="d">Nothing exported yet - export FBX / BVH from RGB MoCap into the folder above.</div>';
  }
  function refresh() { return api("/api/mocap/rgb").then(paintResults).catch(function (e) { say("✗ " + e.message, true); }); }
  function prepare() {
    var key = $("tlMocapClip").value, x = clips().filter(function (k) { return k.key === key; })[0]; if (!x) return say("put a video clip on the timeline first", true);
    $("tlMocapPrep").disabled = true; say("cutting the clip…");
    api("/api/mocap/rgb/prepare", { name: x.c.name, src: x.c.src || "video", in: +x.c.in || 0, out: +x.c.out || 0 }).then(function (r) {
      $("tlMocapPath").value = r.video; $("tlMocapPathRow").hidden = false;
      var plain = function () { say("✓ ready - in RGB MoCap, File ▸ Open Video ▸ the path below; export into the same folder"); };
      try { root.navigator.clipboard.writeText(r.video).then(function () { say("✓ ready - its path is copied: in RGB MoCap, File ▸ Open Video and paste it; export into the same folder"); }, plain); } catch (e) { plain(); }
      refresh();
    }).catch(function (e) { say("✗ " + e.message, true); }).then(function () { $("tlMocapPrep").disabled = false; });
  }
  function bring(rel) {
    say("bringing " + rel + " in…");
    api("/api/mocap/rgb/bring", { rel: rel }).then(function (r) {
      if (!root.TlM3D) throw new Error("the timeline's 3D layers are not loaded");
      root.TlM3D.add("model", r.model, { x: 0, y: 0 }, null, "🕺 " + rel.split("/").pop().replace(/\.(fbx|bvh)$/i, ""));
      say("✓ a 🕺 3D layer at the playhead plays " + rel + (r.via === "blender" ? " (made an .fbx by Blender)" : "")); refresh();
      if (root.H3TestEvent) { try { root.H3TestEvent("tl_mocap", rel); } catch (e) { /* the 🧪 list */ } }
    }).catch(function (e) { say("✗ " + e.message, true); });
  }
  function panel() {
    var p = $("tlMocap");
    if (p) { var open = p.hidden; p.hidden = !open; if (open) { paintClips(); refresh(); start(); } else stop(); return; }
    p = doc.createElement("div"); p.id = "tlMocap";
    p.innerHTML = '<div class="hd"><b>🕺 Motion capture - RGB MoCap</b><button class="ghost" type="button" id="tlMocapX" title="Close">✕</button></div>'
      + '<div id="tlMocapInst" class="d"></div>'
      + '<label>① Clip <select id="tlMocapClip"></select></label><div class="row"><button class="ghost" type="button" id="tlMocapPrep" title="Cut the clip\'s used part into the project\'s mocap folder for RGB MoCap to open">✂ Prepare the clip</button>'
      + '<button class="go" type="button" id="tlMocapOpen" title="RGB MoCap\'s own window - File ▸ Open Video, Reconstruct 3D, Export">② ▶ Open RGB MoCap</button></div>'
      + '<div class="row" id="tlMocapPathRow" hidden><input id="tlMocapPath" readonly><button class="ghost" type="button" id="tlMocapCopy" title="Copy the path">📋</button></div>'
      + '<div class="d">③ Export FBX (or BVH) into: <code id="tlMocapFolder"></code></div><div id="tlMocapList"></div><div id="tlMocapMsg" class="d"></div>';
    (($("timelinedock")) || doc.body).appendChild(p);
    $("tlMocapX").onclick = function () { p.hidden = true; stop(); };
    $("tlMocapPrep").onclick = prepare;
    $("tlMocapOpen").onclick = function () { api("/api/mocap/rgb/open", {}).then(function () { say("▶ RGB MoCap is opening (its console stays open while it runs)"); }).catch(function (e) { say("✗ " + e.message, true); }); };
    $("tlMocapCopy").onclick = function () { try { root.navigator.clipboard.writeText($("tlMocapPath").value).then(function () { say("📋 copied"); }, function () { $("tlMocapPath").select(); say("select + Ctrl+C - this window may not copy by itself"); }); } catch (e) { /* fine */ } };
    $("tlMocapList").addEventListener("click", function (e) { var b = e.target.closest("[data-bring]"); if (b) bring(b.getAttribute("data-bring")); });
    p.addEventListener("keydown", function (e) { e.stopPropagation(); });
    paintClips(); refresh(); start();
  }
  function start() { stop(); timer = setInterval(function () { if ($("tlMocap") && !$("tlMocap").hidden) refresh(); else stop(); }, 5000); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function css() {
    if ($("tlMocapCss")) return; var s = doc.createElement("style"); s.id = "tlMocapCss";
    s.textContent = "#tlMocap{position:fixed;right:24px;bottom:60px;width:470px;max-height:70vh;overflow:auto;z-index:120;background:var(--panel,#1e1f24);border:1px solid var(--tiger,#f59e2c);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px;font-size:12px;box-shadow:0 8px 28px rgba(0,0,0,.45)}"
      + "#tlMocap[hidden]{display:none}#tlMocap .hd{display:flex;justify-content:space-between;align-items:center}#tlMocap .row{display:flex;gap:6px;align-items:center}#tlMocap label{display:flex;gap:6px;align-items:center}#tlMocap select,#tlMocap input{flex:1;min-width:0}"
      + "#tlMocap .d{color:var(--dim,#999);font-size:11px}#tlMocap code{word-break:break-all}#tlMocap .mr{display:flex;gap:6px;align-items:center;border-top:1px solid var(--line,#333);padding-top:4px}#tlMocap .mr span:first-child{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
    doc.head.appendChild(s);
  }
  function bar() {
    if ($("tlMocapBtn")) return true;
    var ref = $("tlRangeGrp") || $("tlCutNewL") || $("tlSelGrp"); if (!ref) return false;
    css();
    var b = doc.createElement("button"); b.className = "ghost"; b.type = "button"; b.id = "tlMocapBtn"; b.textContent = "🕺 Mocap";
    b.title = "Motion capture with RGB MoCap: a clip of a person -> editable body animation -> a 🕺 3D layer on the timeline";
    ref.parentNode.insertBefore(b, ref.nextSibling); b.onclick = panel; return true;
  }
  function boot() { if (!bar()) setTimeout(boot, 800); }
  root.TlMocap = { panel: panel, clips: clips, refresh: refresh, bring: bring };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);

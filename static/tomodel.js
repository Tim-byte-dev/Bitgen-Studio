/* bitGen Studio — static/tomodel.js (2.576.0): "🧩 To model" IN THE VIEWER + Ctrl+↓ = THE MODEL'S THUMBNAIL (window.H3ToModel).
 * Tim: "in the viewer add a button to send music/video/image to modelinfo - copy the media to the folder model info images
 * are saved and add the thumbnail to model info images. when user clicks on an image and presses ctrl+ the down arrow to
 * make this the primary thumbnail for the model".
 *   🧩 To model…   (the viewer's bar) a small picker over the viewer: the models + LoRAs (a search box; the one the file
 *                 was made with - its metadata - picked first), ☐ Make it the model's thumbnail (ticked when the model
 *                 has none, or when Ctrl+↓ opened it). Add = the file is copied into the model's files in model_info
 *                 (lib/modelMedia via POST /api/modelmgr/media - with its prompt / seed / cfg / steps), and a picture
 *                 becomes the thumbnail when ticked
 *   Ctrl+↓        in the viewer: a picture OF a model (one of its files, a Civitai example) becomes that model's
 *                 thumbnail at once; any other picture opens the picker with the thumbnail box ticked
 *   where it comes from: /outputs/<n> = the gallery, /passets/<kind>/<n> = Assets (the server copies it and reads its
 *   render record); anything else (References, a model's file, an example) is fetched and uploaded.
 * Pure (scripts/test-tomodel576.js): sourceOf(url), modelOfUrl(url), rank(cards, want, q). */
(function (root) {
  "use strict";
  /** a viewer url -> {src, name} (a project file the server reads by name) | null (pure) */
  function sourceOf(url) {
    var u = String(url || "").replace(/^https?:\/\/[^/]+/, "");
    var m = /^\/outputs\/([^?#]+)/.exec(u); if (m) return { src: "output", name: decodeURIComponent(m[1]) };
    m = /^\/passets\/(images|video|sound)\/([^?#]+)/.exec(u); if (m) return { src: m[1], name: decodeURIComponent(m[2]) };
    return null;
  }
  /** a viewer url that IS a model's picture -> {key, item} | {key, example} | null (pure) */
  function modelOfUrl(url) {
    var u = String(url || ""), q = u.indexOf("?"); if (q < 0) return null;
    var p = {}; u.slice(q + 1).split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " ")); });
    if (/\/api\/modelmgr\/media\/file\?/.test(u) && p.key && p.id) return { key: p.key, item: p.id };
    if (/\/api\/modelmgr\/example\?/.test(u) && p.key && p.n != null) return { key: p.key, example: p.n };
    return null;
  }
  /** the cards in the picker's order: the one the file names first, then by the search (pure) */
  function rank(cards, want, q) {
    var w = String(want || "").toLowerCase().split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, ""), s = String(q || "").toLowerCase().trim();
    var list = (cards || []).filter(function (c) { if (!s) return true; var h = [c.title, c.name, c.family_label, c.model_type].join(" ").toLowerCase(); return s.split(/\s+/).every(function (x) { return h.indexOf(x) >= 0; }); });
    var score = function (c) { if (!w) return 0; var f = String(c.file || c.name || "").toLowerCase().replace(/\.[a-z0-9]+$/i, ""); return f === w ? 2 : (f.indexOf(w) >= 0 || w.indexOf(f) >= 0) ? 1 : 0; };
    return list.map(function (c, i) { return { c: c, s: score(c), i: i }; }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).map(function (x) { return x.c; });
  }
  var pure = { sourceOf: sourceOf, modelOfUrl: modelOfUrl, rank: rank };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function jpost(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function cur() { var L = null; try { L = typeof lb !== "undefined" ? lb : null; } catch (e) { L = null; } return L && L.items ? L.items[L.i] : null; }   // eslint-disable-line no-undef
  function say(t) { if (root.H3UseMeta && root.H3UseMeta.say) root.H3UseMeta.say(t); }
  function refreshMM(key) { var M = root.H3ModelMgr; if (M && M.reloadKeep) try { M.reloadKeep(key); } catch (e) { /* fine */ } else if (M && M.load) try { M.load(true); } catch (e) { /* fine */ } }

  /** a picture of a model -> its thumbnail now */
  function thumbFromModel(mk) {
    return jpost("/api/modelmgr/thumb", mk.item ? { key: mk.key, item: mk.item } : { key: mk.key, example: mk.example }).then(function (j) {
      if (j.error) { say("🖼 " + j.error); return null; }
      say("🖼 the model's thumbnail is this picture now"); refreshMM(mk.key); return j;
    });
  }
  /** copy the viewer's file into model `key` -> the new item */
  function send(it, key, thumb) {
    var s = sourceOf(it.url), p;
    if (s) p = jpost("/api/modelmgr/media", { key: key, src: s.src, name: s.name });
    else p = fetch(it.url).then(function (r) { if (!r.ok) throw new Error("could not read the file (" + r.status + ")"); return r.blob(); }).then(function (b) {
      var fd = new FormData(); fd.append("key", key);
      var nm = it.name || "file"; if (!/\.[a-z0-9]{2,5}$/i.test(nm)) nm += it.kind === "video" ? ".mp4" : it.kind === "audio" ? ".wav" : (/png/.test(b.type) ? ".png" : /webp/.test(b.type) ? ".webp" : ".jpg");
      fd.append("file", b, nm);
      return fetch("/api/modelmgr/media", { method: "POST", body: fd }).then(function (r) { return r.json(); });
    });
    return p.then(function (j) {
      if (!j || j.error || !j.item) throw new Error((j && j.error) || "not added");
      var m = j.item.meta || {};
      var words = "added to the model's files" + (m.prompt ? " - with its prompt" + (m.seed != null ? ", seed " + m.seed : "") + (m.steps != null ? ", " + m.steps + " steps" : "") + (m.cfg != null ? ", cfg " + m.cfg : "") : "");
      if (thumb && j.item.kind === "image") return jpost("/api/modelmgr/thumb", { key: key, item: j.item.id }).then(function (t) { say("🧩 " + words + (t.error ? " (thumbnail: " + t.error + ")" : " and made its thumbnail")); refreshMM(key); return j.item; });
      say("🧩 " + words); refreshMM(key); return j.item;
    }).catch(function (e) { say("🧩 " + e.message); return null; });
  }

  /* ---- the picker */
  var P = { cards: [], want: "", thumb: false };
  function css() {
    if ($("tmCss")) return;
    var st = doc.createElement("style"); st.id = "tmCss";
    st.textContent = "#tmDlg{background:var(--panel,#1d1a16);color:var(--text,#ddd);border:1px solid var(--tiger,#f59e2c);border-radius:8px;padding:10px 12px;width:min(520px,92vw);max-height:80vh}"
      + "#tmDlg::backdrop{background:rgba(0,0,0,.35)}#tmDlg h3{margin:0 0 6px;font-size:14px}#tmDlg .row{display:flex;gap:6px;align-items:center;margin:6px 0}"
      + "#tmList{max-height:46vh;overflow:auto;border:1px solid var(--line,#3a342a);border-radius:6px}#tmList label{display:flex;gap:8px;align-items:center;padding:4px 6px;cursor:pointer;font-size:12.5px}"
      + "#tmList label:hover{background:rgba(255,255,255,.05)}#tmList .th{width:34px;height:34px;flex:none;border-radius:4px;background:#111 center/cover no-repeat}#tmList .sub{color:var(--dim,#999);font-size:11px}"
      + "#tmList .hit{color:var(--tiger,#f59e2c);font-size:11px}";
    doc.head.appendChild(st);
  }
  function dlg() {
    var d = $("tmDlg"); if (d) return d;
    css();
    d = doc.createElement("dialog"); d.id = "tmDlg"; d.setAttribute("aria-label", "Send to a model");
    d.innerHTML = '<h3>🧩 Send to a model\'s files</h3><div class="sub" id="tmWhat" style="color:var(--dim);font-size:12px"></div>'
      + '<div class="row"><input type="search" id="tmQ" placeholder="Search the models + LoRAs…" style="flex:1" aria-label="Search the models"></div>'
      + '<div id="tmList" role="listbox"></div>'
      + '<div class="row"><label style="display:inline-flex;gap:5px;align-items:center"><input type="checkbox" id="tmThumb"> Make it the model\'s thumbnail</label></div>'
      + '<div class="row" style="justify-content:flex-end"><button type="button" class="ghost" id="tmCancel">Cancel</button><button type="button" id="tmGo">🧩 Add to the model</button></div>';
    // inside the viewer's dialog, so it shows above it (one top layer)
    ($("lb") || doc.body).appendChild(d);
    $("tmCancel").onclick = function () { d.close(); };
    $("tmQ").oninput = paintList;
    $("tmQ").onkeydown = function (e) { e.stopPropagation(); if (e.key === "Enter") go(); if (e.key === "Escape") d.close(); };
    d.addEventListener("keydown", function (e) { e.stopPropagation(); });
    $("tmGo").onclick = go;
    return d;
  }
  function paintList() {
    var L = $("tmList"), list = rank(P.cards, P.want, $("tmQ").value).slice(0, 200), chosen = (L.querySelector("input:checked") || {}).value;
    if (!chosen && list.length && P.want && rank(P.cards, P.want, "")[0] === list[0] && list[0]) chosen = list[0].key;
    L.innerHTML = list.length ? list.map(function (c) {
      var t = c.thumb ? "/api/modelmgr/thumb?key=" + encodeURIComponent(c.key) + (c.thumb_v ? "&v=" + encodeURIComponent(c.thumb_v) : "") : "";
      var hit = P.want && String(c.file || "").toLowerCase().replace(/\.[a-z0-9]+$/i, "") === String(P.want).toLowerCase().split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, "");
      return '<label><input type="radio" name="tmPick" value="' + esc(c.key) + '"' + (c.key === chosen ? " checked" : "") + '><span class="th"' + (t ? ' style="background-image:url(&quot;' + esc(t) + '&quot;)"' : "") + "></span>"
        + "<span><b>" + esc(c.title) + '</b><br><span class="sub">' + esc([c.model_type || (c.kind === "lora" ? "LoRA" : "model"), c.family_label, c.file].filter(Boolean).join(" · ")) + "</span>"
        + (hit ? ' <span class="hit">· the file was made with it</span>' : "") + (c.thumb ? "" : ' <span class="sub">· no thumbnail yet</span>') + "</span></label>";
    }).join("") : '<div class="sub" style="padding:8px">no model matches</div>';
    L.querySelectorAll("input[name=tmPick]").forEach(function (r) { r.onchange = function () { var c = P.cards.find(function (x) { return x.key === r.value; }); if (c && !c.thumb && !P.thumbForced) $("tmThumb").checked = true; }; });
  }
  function go() {
    var r = $("tmList").querySelector("input[name=tmPick]:checked");
    if (!r) { say("pick the model first"); return; }
    var it = P.item, key = r.value, thumb = $("tmThumb").checked && it.kind === "image";
    $("tmDlg").close();
    send(it, key, thumb);
  }
  /** open the picker for the viewer's file (thumb: the thumbnail box ticked) */
  function open(it, thumb) {
    it = it || cur(); if (!it) return Promise.resolve(null);
    var d = dlg();
    P.item = it; P.thumbForced = !!thumb; P.want = "";
    $("tmWhat").textContent = (it.kind === "image" ? "🖼 " : it.kind === "video" ? "🎬 " : "🔊 ") + (it.name || "") + " - copied into the model's files in model_info (with its prompt and settings)";
    $("tmThumb").checked = !!thumb; $("tmThumb").disabled = it.kind !== "image";
    $("tmQ").value = "";
    $("tmList").innerHTML = '<div class="sub" style="padding:8px">reading the models…</div>';
    if (!d.open) d.showModal();
    setTimeout(function () { try { $("tmQ").focus(); } catch (e) { /* fine */ } }, 0);
    var s = sourceOf(it.url);
    var metaP = s ? fetch("/api/media-meta?src=" + encodeURIComponent(s.src) + "&name=" + encodeURIComponent(s.name)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([fetch("/api/modelmgr/cards").then(function (r) { return r.json(); }), metaP]).then(function (res) {
      var d0 = res[0] || {}, m = (res[1] && res[1].meta) || {};
      P.cards = (d0.models || []).concat(d0.loras || []);
      P.want = m.model || "";
      paintList();
      // the model it was made with, picked for you - no thumbnail yet: tick "Make it the model's thumbnail"
      var r0 = $("tmList").querySelector("input[name=tmPick]:checked"), c0 = r0 && P.cards.find(function (x) { return x.key === r0.value; });
      if (c0 && !c0.thumb && it.kind === "image") $("tmThumb").checked = true;
      return P;
    });
  }
  /** Ctrl+↓ in the viewer: a model's own picture -> its thumbnail now; anything else -> the picker, thumbnail ticked */
  function ctrlDown() {
    var it = cur(); if (!it || it.kind !== "image") { say("Ctrl+↓ makes a PICTURE a model's thumbnail"); return null; }
    var mk = modelOfUrl(it.url);
    return mk ? thumbFromModel(mk) : open(it, true);
  }

  function boot() {
    var bar = doc.querySelector("#lb .lbbar"); if (!bar || $("lb_tomodel")) return;
    var b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.id = "lb_tomodel"; b.textContent = "🧩 To model…";
    b.title = "Send this picture / video / sound to a model's files (model_info) - with its prompt and settings; a picture can become the model's thumbnail (Ctrl+↓)";
    b.onclick = function () { open(); };
    var after = $("lb_open"); if (after && after.parentNode === bar) bar.insertBefore(b, after.nextSibling); else bar.appendChild(b);
    doc.addEventListener("keydown", function (e) {
      if (!$("lb") || !$("lb").open || ($("tmDlg") && $("tmDlg").open)) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); ctrlDown(); }
    }, true);
  }
  root.H3ToModel = Object.assign({ open: open, send: send, ctrlDown: ctrlDown, thumbFromModel: thumbFromModel }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);

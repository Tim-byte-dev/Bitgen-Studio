/* bitGen app — www/app.js: the screens. Talks to bitGen Studio on your PC (paired through Settings ▸ General ▸ Remote
 * access): every request carries the PC's key in X-Bitgen-Key (pictures / videos: ?bgk=, an <img> / <video> cannot send a
 * header). The PC decides everything a render needs - this is the prompt docker, in your pocket.
 *   Connect   the QR (a photo of it, read by jsQR) or the link -> POST /api/remote/pair -> the key, kept on the phone
 *   Create    /api/app/info (the styles), POST /api/app/video (every video model) or /api/genimage (+ /api/passets for
 *             pictures), ⏱ /api/timeestimate, ComfyUI started on the PC first (/api/comfy/status, /api/comfy/ensure)
 *   Queue     /api/jobs?all=1, /api/jobs/<id> (its log), /api/jobs/<id>/cancel
 *   Gallery   /api/outputs?kind=video|images -> /outputs/<name>; ⬇ Save into the phone's Documents/bitGen, ⤴ Share */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var Cap = window.Capacitor || null;
  var P = (Cap && Cap.Plugins) || {};
  var S = { base: "", key: "", device: "", info: null, kind: "video", pics: [], gal: "video", view: "create", estKey: "", jobsOpen: {} };

  /* ---------- kept on the phone (Capacitor Preferences; a plain browser: localStorage) */
  function kget(k) {
    if (P.Preferences) return P.Preferences.get({ key: k }).then(function (r) { return r && r.value != null ? r.value : ""; });
    try { return Promise.resolve(localStorage.getItem("bg." + k) || ""); } catch (e) { return Promise.resolve(""); }
  }
  function kset(k, v) {
    if (P.Preferences) return v ? P.Preferences.set({ key: k, value: String(v) }) : P.Preferences.remove({ key: k });
    try { if (v) localStorage.setItem("bg." + k, String(v)); else localStorage.removeItem("bg." + k); } catch (e) { /* private */ }
    return Promise.resolve();
  }

  /* ---------- the PC */
  function api(path, opts) {
    var o = opts || {};
    var h = Object.assign({}, o.headers || {});
    if (S.key) h["X-Bitgen-Key"] = S.key;
    var init = { method: o.method || "GET", headers: h };
    if (o.json !== undefined) { h["Content-Type"] = "application/json"; init.body = JSON.stringify(o.json); }
    else if (o.body) init.body = o.body;
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ctl) { init.signal = ctl.signal; setTimeout(function () { ctl.abort(); }, o.timeout || 30000); }
    return fetch(S.base + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && j && j.unpaired) { unpaired(); }
        if (!r.ok) { var e = new Error((j && j.error) || ("HTTP " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    }, function (e) {
      throw new Error(e && e.name === "AbortError" ? "your PC did not answer in time" : "cannot reach your PC at " + S.base + " - is it on, with bitGen Studio running, and the phone on the same Wi-Fi?");
    });
  }
  function conn(text, cls) { var c = $("conn"); c.textContent = text; c.className = "conn " + (cls || ""); }
  function msg(id, text, cls) { var m = $(id); if (m) { m.textContent = text || ""; m.className = "msg " + (cls || ""); } }
  function unpaired() {
    S.key = ""; kset("key", "");
    conn("○ not paired", "bad"); show("connect");
    msg("pairMsg", "Your PC no longer knows this phone (it was disconnected there, or paired with another phone). Create a new link on the PC and scan it.", "bad");
  }

  /* ---------- views */
  function show(v) {
    if (!S.key && v !== "connect" && v !== "settings") v = "connect";
    S.view = v;
    ["connect", "create", "queue", "gallery", "settings"].forEach(function (n) { $("v-" + n).hidden = n !== v; });
    [].forEach.call(document.querySelectorAll("#tabs button"), function (b) { b.classList.toggle("on", b.dataset.v === v); });
    if (v === "queue") loadJobs();
    if (v === "gallery") loadGallery();
    if (v === "settings") { $("baseIn").value = S.base; aboutPc(); }
    if (v === "create") estimate(true);
  }
  [].forEach.call(document.querySelectorAll("#tabs button"), function (b) { b.onclick = function () { show(b.dataset.v); }; });

  /* ---------- connect */
  function readQr(file) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var d = g.getImageData(0, 0, c.width, c.height);
        var r = window.jsQR ? window.jsQR(d.data, c.width, c.height, { inversionAttempts: "attemptBoth" }) : null;
        if (r && r.data) ok(r.data); else no(new Error("no QR code found in that photo - hold the phone closer, the whole QR in the picture"));
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error("the photo could not be read")); };
      img.src = url;
    });
  }
  $("qrFile").onchange = function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    msg("pairMsg", "Reading the QR…");
    readQr(f).then(function (text) { $("linkIn").value = text; pair(); }, function (err) { msg("pairMsg", err.message, "bad"); });
  };
  function pair() {
    var l = BG.parseLink($("linkIn").value);
    if (!l) { msg("pairMsg", "That is not a bitGen pairing link - it looks like http://192.168.1.20:8311/remote?t=…", "bad"); return; }
    var dev = ($("devName").value || "").trim() || "bitGen app";
    msg("pairMsg", "Connecting to " + l.base + "…");
    S.base = l.base; S.key = "";
    api("/api/remote/pair", { method: "POST", json: { code: l.code, device: dev + " (bitGen app)" } }).then(function (j) {
      S.key = j.token; S.device = dev;
      return Promise.all([kset("base", S.base), kset("key", S.key), kset("device", dev)]).then(function () {
        msg("pairMsg", "Connected to bitGen Studio " + (j.version || "") + " - project " + (j.project || ""), "ok");
        $("linkIn").value = "";
        return start();
      });
    }).catch(function (e) { msg("pairMsg", e.message, "bad"); });
  }
  $("pairBtn").onclick = pair;

  /* ---------- create */
  function styles() { var i = S.info || {}; return (S.kind === "video" ? i.video_styles : i.image_styles) || []; }
  function fillStyles() {
    var sel = $("styleSel"), keep = sel.value || ((S.info || {}).ui || {})[S.kind === "video" ? "vstyle" : "style"] || "";
    var l = styles();
    sel.innerHTML = l.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + "</option>"; }).join("") || '<option value="">(no styles on the PC)</option>';
    if (l.some(function (s) { return s.id === keep; })) sel.value = keep;
    kget("style." + S.kind).then(function (v) { if (v && l.some(function (s) { return s.id === v; })) { sel.value = v; estimate(true); } });
  }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  [].forEach.call(document.querySelectorAll("#kindSeg button"), function (b) {
    b.onclick = function () {
      S.kind = b.dataset.kind;
      [].forEach.call(document.querySelectorAll("#kindSeg button"), function (x) { x.classList.toggle("on", x === b); });
      [].forEach.call(document.querySelectorAll(".vonly"), function (x) { x.hidden = S.kind !== "video"; });
      fillStyles(); paintWh(); estimate(true);
    };
  });
  $("styleSel").onchange = function () { kset("style." + S.kind, $("styleSel").value); estimate(true); };
  function wh() {
    if (S.kind === "image") { var e = { 480: 768, 540: 1024, 720: 1280, 1080: 1536 }[$("resSel").value] || 1024; return BG.imgSizeFor(e, $("arSel").value); }
    return BG.sizeFor($("resSel").value, $("arSel").value);
  }
  function paintWh() {
    var s = wh();
    $("whLine").textContent = "→ " + s.width + " × " + s.height + (S.kind === "image" && !$("ovrOn").checked ? " (with Override style on - off, the style's own size)" : "");
  }
  ["resSel", "arSel", "seconds", "steps", "cfg", "ovrOn"].forEach(function (id) { $(id).addEventListener("change", function () { paintWh(); estimate(); kset("f." + id, id === "ovrOn" ? ($("ovrOn").checked ? "1" : "") : $(id).value); }); });
  function addPics(files) {
    [].slice.call(files || []).forEach(function (f) { if (S.pics.length < 9 && /^image\//.test(f.type)) S.pics.push({ file: f, url: URL.createObjectURL(f) }); });
    paintPics();
  }
  function paintPics() {
    var box = $("pics"); box.innerHTML = "";
    S.pics.forEach(function (p, i) {
      var d = document.createElement("div"); d.className = "p";
      d.innerHTML = '<img alt=""><b>' + (i + 1) + '</b><button type="button" aria-label="Remove">✕</button>';
      d.querySelector("img").src = p.url;
      d.querySelector("button").onclick = function () { URL.revokeObjectURL(p.url); S.pics.splice(i, 1); paintPics(); };
      box.appendChild(d);
    });
  }
  $("picCam").onchange = function (e) { addPics(e.target.files); e.target.value = ""; };
  $("picLib").onchange = function (e) { addPics(e.target.files); e.target.value = ""; };

  var estT = 0;
  function estimate(now) {
    clearTimeout(estT);
    estT = setTimeout(function () {
      if (!S.key || S.view !== "create") return;
      var s = wh(), st = styles().find(function (x) { return x.id === $("styleSel").value; }) || {};
      var ov = $("ovrOn").checked;
      var body = S.kind === "video"
        ? { kind: "video", style: st.id || "", name: st.name || "", width: s.width, height: s.height, seconds: +$("seconds").value || 5, steps: +$("steps").value || 0, cfg: +$("cfg").value }
        : { kind: "image", style: st.id || "", name: st.name || "", width: ov ? s.width : 0, height: ov ? s.height : 0, frames: 1, steps: ov ? +$("steps").value || 0 : 0, cfg: ov ? +$("cfg").value : null };
      var k = JSON.stringify(body);
      if (k === S.estKey && !now) return;
      S.estKey = k;
      api("/api/timeestimate", { method: "POST", json: body }).then(function (j) { $("est").textContent = j.text || ""; $("est").title = j.title || ""; }, function () { $("est").textContent = ""; });
    }, now ? 0 : 400);
  }
  function comfyReady(say) {
    return api("/api/comfy/status").then(function (st) {
      if (st.backend && st.backend !== "comfy") return true;
      if (st.reachable) return true;
      say("Starting ComfyUI on your PC…");
      return api("/api/comfy/ensure", { method: "POST", json: { force: true } }).then(function () {
        var t0 = Date.now();
        return new Promise(function (ok, no) {
          (function poll() {
            api("/api/comfy/status").then(function (s2) {
              if (s2.reachable) return ok(true);
              if (Date.now() - t0 > 300000) return no(new Error("ComfyUI did not come up on your PC within 5 minutes - look at the PC"));
              say("Starting ComfyUI on your PC… " + Math.round((Date.now() - t0) / 1000) + " s");
              setTimeout(poll, 2500);
            }, function () { setTimeout(poll, 2500); });
          })();
        });
      });
    });
  }
  function uploadPic(p) {
    var fd = new FormData(); fd.append("file", p.file, p.file.name || "phone.jpg");
    return api("/api/passets", { method: "POST", body: fd, timeout: 120000 }).then(function (j) { return j.name; });
  }
  $("goBtn").onclick = function () {
    var prompt = $("prompt").value.trim(), st = styles().find(function (x) { return x.id === $("styleSel").value; });
    if (!prompt) { msg("goMsg", "Write what you want first.", "bad"); return; }
    if (!st) { msg("goMsg", "Pick a style - your PC has none of this kind yet.", "bad"); return; }
    var btn = $("goBtn"); btn.disabled = true;
    var say = function (t, c) { msg("goMsg", t, c); };
    var s = wh(), ov = $("ovrOn").checked;
    comfyReady(say).then(function () {
      say("Sending it to your PC…");
      if (S.kind === "video") {
        var fd = new FormData();
        fd.append("prompt", prompt); fd.append("style_id", st.id);
        fd.append("width", s.width); fd.append("height", s.height); fd.append("seconds", $("seconds").value || "5");
        fd.append("steps", $("steps").value || "0"); fd.append("cfg", $("cfg").value || "1"); fd.append("seed", $("seed").value || "-1");
        fd.append("override", ov ? "1" : "0");
        S.pics.forEach(function (p) { fd.append("pictures", p.file, p.file.name || "phone.jpg"); });
        return api("/api/app/video", { method: "POST", body: fd, timeout: 180000 });
      }
      var body = { prompt: prompt, style_id: st.id, batch: 1 };
      if (ov) { body.width = s.width; body.height = s.height; body.steps = +$("steps").value || undefined; body.cfg = +$("cfg").value; body.seed = +$("seed").value; }
      var want = st.slots > 0 || st.refs_optional;
      return (want && S.pics.length ? Promise.all(S.pics.slice(0, Math.max(1, st.slots || 3)).map(uploadPic)) : Promise.resolve([])).then(function (names) {
        if (st.slots > 0 && !st.refs_optional && !names.length) throw new Error("this style edits a picture - add one first (📷 / 🖼)");
        if (names.length) body.images = names;
        return api("/api/genimage", { method: "POST", json: body, timeout: 60000 });
      });
    }).then(function (j) {
      say("On its way - " + (j.id ? "job " + j.id : "queued") + ". The Queue tab follows it.", "ok");
      setTimeout(function () { show("queue"); }, 900);
    }).catch(function (e) { say(e.message, "bad"); }).then(function () { btn.disabled = false; });
  };

  /* ---------- queue */
  var jobsT = 0;
  function loadJobs() {
    clearTimeout(jobsT);
    if (S.view !== "queue" || !S.key) return;
    api("/api/jobs?all=1").then(function (d) {
      var l = BG.jobsOf(d).slice().sort(function (a, b) { return (b.created || 0) - (a.created || 0); }).slice(0, 30);
      var box = $("jobs");
      if (!l.length) { box.innerHTML = '<p class="hint">Nothing yet - make something on the Create tab.</p>'; }
      else box.innerHTML = l.map(function (j) {
        var w = BG.statusWords(j), pr = j.progress || {}, name = BG.outName(j);
        return '<div class="job' + (S.jobsOpen[j.id] ? " open" : "") + '" data-id="' + j.id + '"><div class="t"><b>' + esc(w.what) + '</b><span class="s ' + esc(w.status) + '">' + esc(w.status) + esc(w.more) + "</span></div>"
          + '<div class="pr">' + esc(((j.params || {}).prompt || "").replace(/\s+/g, " ").slice(0, 140)) + "</div>"
          + (j.status === "running" ? '<div class="bar"><i style="width:' + (pr.pct || 3) + '%"></i></div>' : "")
          + '<div class="row">' + (j.status === "running" || j.status === "queued" ? '<button class="btn small" data-cancel="' + j.id + '">■ Cancel</button>' : "")
          + (j.status === "done" && name ? '<button class="btn small" data-open="' + esc(name) + '">▶ Open</button>' : "")
          + '<button class="btn small" data-log="' + j.id + '">Log</button></div><div class="log"></div></div>';
      }).join("");
      [].forEach.call(box.querySelectorAll("[data-cancel]"), function (b) { b.onclick = function () { api("/api/jobs/" + b.dataset.cancel + "/cancel", { method: "POST", json: {} }).then(loadJobs, function (e) { alert(e.message); }); }; });
      [].forEach.call(box.querySelectorAll("[data-open]"), function (b) { b.onclick = function () { view(b.dataset.open); }; });
      [].forEach.call(box.querySelectorAll("[data-log]"), function (b) { b.onclick = function () { S.jobsOpen[b.dataset.log] = !S.jobsOpen[b.dataset.log]; loadJobs(); }; });
      Object.keys(S.jobsOpen).forEach(function (id) {
        if (!S.jobsOpen[id]) return;
        var el = box.querySelector('.job[data-id="' + id + '"] .log'); if (!el) return;
        api("/api/jobs/" + id + "?log=0").then(function (jd) { el.textContent = (jd.log || []).slice(-40).join("\n"); el.scrollTop = el.scrollHeight; }, function () { /* next time */ });
      });
      conn("● " + hostOf(S.base), "on");
    }).catch(function (e) { $("jobs").innerHTML = '<p class="msg bad">' + esc(e.message) + "</p>"; conn("● can't reach the PC", "bad"); })
      .then(function () { jobsT = setTimeout(loadJobs, 3000); });
  }
  function hostOf(b) { return String(b || "").replace(/^https?:\/\//, ""); }

  /* ---------- gallery + viewer */
  [].forEach.call(document.querySelectorAll("#galSeg button"), function (b) {
    b.onclick = function () { S.gal = b.dataset.g; [].forEach.call(document.querySelectorAll("#galSeg button"), function (x) { x.classList.toggle("on", x === b); }); loadGallery(); };
  });
  function loadGallery() {
    if (!S.key) return;
    var box = $("gal");
    api("/api/outputs" + (S.gal === "images" ? "?kind=images" : "")).then(function (l) {
      l = (Array.isArray(l) ? l : []).slice(0, 60);
      if (!l.length) { box.innerHTML = '<p class="hint">Nothing here yet.</p>'; return; }
      box.innerHTML = l.map(function (f) {
        var u = BG.media(S.base, f.name, S.key);
        return '<div class="g" data-n="' + esc(f.name) + '">' + (S.gal === "images" ? '<img loading="lazy" alt="" src="' + u + '">' : '<video preload="metadata" muted playsinline src="' + u + '#t=0.1"></video>')
          + "<span>" + esc(f.name) + "</span></div>";
      }).join("");
      [].forEach.call(box.querySelectorAll(".g"), function (g) { g.onclick = function () { view(g.dataset.n); }; });
    }).catch(function (e) { box.innerHTML = '<p class="msg bad">' + esc(e.message) + "</p>"; });
  }
  var cur = "";
  function view(name) {
    cur = name;
    var u = BG.media(S.base, name, S.key), k = BG.kindOf(name);
    $("vName").textContent = name;
    $("vBody").innerHTML = k === "video" ? '<video controls autoplay playsinline src="' + u + '"></video>' : '<img alt="" src="' + u + '">';
    $("viewer").hidden = false;
  }
  $("vClose").onclick = function () { $("viewer").hidden = true; $("vBody").innerHTML = ""; };
  /** the file into the phone: Documents/bitGen (asked for the storage permission first), else the app's own folder;
   *  share = the app's cache (the share sheet saves it anywhere) -> the file's uri */
  function fetchTo(name, directory) {
    var url = BG.media(S.base, name, S.key), path = "bitGen/" + name;
    return P.Filesystem.mkdir({ directory: directory, path: "bitGen", recursive: true }).catch(function () { /* there */ })
      .then(function () { return P.Filesystem.getUri({ directory: directory, path: path }); })
      .then(function (u) { return P.FileTransfer.downloadFile({ url: url, path: u.uri }).then(function () { return u.uri; }); });
  }
  function saveLocal(name, forShare) {
    if (!(P.FileTransfer && P.Filesystem)) { window.open(BG.media(S.base, name, S.key), "_blank"); return Promise.resolve(""); }
    if (forShare) return fetchTo(name, "CACHE");
    return (P.Filesystem.requestPermissions ? P.Filesystem.requestPermissions().catch(function () { return null; }) : Promise.resolve(null))
      .then(function () { return fetchTo(name, "DOCUMENTS"); })
      .catch(function () { return fetchTo(name, "EXTERNAL"); });
  }
  $("vSave").onclick = function () {
    var b = $("vSave"); b.disabled = true; b.textContent = "⬇ …";
    saveLocal(cur).then(function (uri) { b.textContent = uri ? "✓ Saved" : "⬇ Save"; if (uri) b.title = decodeURIComponent(String(uri).replace(/^file:\/\//, "")); setTimeout(function () { b.textContent = "⬇ Save"; }, 2500); },
      function (e) { alert("Not saved: " + (e && e.message || e)); b.textContent = "⬇ Save"; }).then(function () { b.disabled = false; });
  };
  $("vShare").onclick = function () {
    if (!P.Share) { alert("Sharing works in the app on the phone."); return; }
    saveLocal(cur, true).then(function (uri) { return P.Share.share({ title: cur, files: [uri] }); }).catch(function (e) { if (e && !/cancel/i.test(e.message || "")) alert(e.message || e); });
  };

  /* ---------- settings */
  function aboutPc() {
    if (!S.key) { $("aboutPc").textContent = "Not paired."; return; }
    api("/api/app/info").then(function (i) { $("aboutPc").textContent = "bitGen Studio " + i.version + " · project " + i.project + " · " + (i.video_styles || []).length + " video / " + (i.image_styles || []).length + " picture styles"; },
      function (e) { $("aboutPc").textContent = e.message; });
  }
  $("testBtn").onclick = function () { msg("setMsg", "Testing…"); api("/api/remote/hello").then(function (j) { msg("setMsg", "✓ " + j.app + " " + j.version + " answers at " + S.base, "ok"); aboutPc(); }, function (e) { msg("setMsg", e.message, "bad"); }); };
  $("saveBase").onclick = function () {
    var b = ($("baseIn").value || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\/[^\s\/]+$/.test(b)) { msg("setMsg", "An address looks like http://192.168.1.20:8311", "bad"); return; }
    S.base = b; kset("base", b); $("testBtn").onclick();
  };
  $("forget").onclick = function () {
    if (!confirm("Forget your PC on this phone? You will need a new pairing link to connect again.")) return;
    S.key = ""; S.info = null; Promise.all([kset("key", ""), kset("base", "")]).then(function () { S.base = ""; conn("○ not connected"); show("connect"); });
  };

  /* ---------- start */
  function start() {
    if (!S.key) { show("connect"); return Promise.resolve(); }
    conn("… " + hostOf(S.base));
    return api("/api/app/info").then(function (i) {
      S.info = i; conn("● " + hostOf(S.base), "on");
      fillStyles(); paintWh(); show(S.view === "connect" ? "create" : S.view);
    }).catch(function (e) { conn("● can't reach the PC", "bad"); msg("goMsg", e.message, "bad"); show("create"); });
  }
  Promise.all(["base", "key", "device", "f.resSel", "f.arSel", "f.seconds", "f.steps", "f.cfg", "f.ovrOn"].map(kget)).then(function (v) {
    S.base = v[0]; S.key = v[1]; S.device = v[2];
    $("devName").value = S.device || "";
    if (v[3]) $("resSel").value = v[3]; if (v[4]) $("arSel").value = v[4]; if (v[5]) $("seconds").value = v[5];
    if (v[6]) $("steps").value = v[6]; if (v[7]) $("cfg").value = v[7]; $("ovrOn").checked = v[8] === "1";
    start();
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && S.key) { if (S.view === "queue") loadJobs(); estimate(true); } });
})();

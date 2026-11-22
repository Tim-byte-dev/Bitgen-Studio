/* bitGen app — www/app.js: the screens. Talks to bitGen Studio on your PC (paired through Settings ▸ General ▸ Remote
 * access): every request carries the PC's key in X-Bitgen-Key (pictures / videos: ?bgk=, an <img> / <video> cannot send a
 * header). The PC decides everything a render needs - this is the prompt docker, in your pocket.
 *   Connect   the QR (a photo of it, read by jsQR) or the link -> POST /api/remote/pair -> the key, kept on the phone
 *   Create    /api/app/info (the styles), POST /api/app/video (every video model) or /api/genimage (+ /api/passets for
 *             pictures) or 🎵 /api/genmusic (the lyrics, the sound, the length; ✨ /api/app/song - the PC's LLM writes
 *             them from an idea), ⏱ /api/timeestimate, ComfyUI started on
 *             the PC first (/api/comfy/status, /api/comfy/ensure)
 *   Queue     /api/jobs?all=1, /api/jobs/<id> (its log), /api/jobs/<id>/cancel
 *   Gallery   /api/outputs?kind=video|images|audio -> /outputs/<name>; ⬇ Save into the phone's Documents/bitGen, ⤴ Share
 *   Update    (2.912.0) /api/app/update -> a newer build on the PC than www/lib/build.js: ⬆ Update downloads /api/app/apk
 *             and opens Android's installer (FileOpener) - one tap on Install
 *   Wi-Fi     (2.913.0) 📶 Find my PC on Wi-Fi: the phone's own Wi-Fi address (the LanInfo plugin) -> every address of that
 *             network asked GET /api/remote/hello (lib/net.js scan) -> POST /api/remote/lanpair, the PC says Allow (or its
 *             📱 Connect the phone) -> the key. On start: the PC at its address, else found again on the Wi-Fi (its
 *             name), else ☁ the relay - for 6 hours after the app was last on the Wi-Fi (lib/net.js relaySend: sealed
 *             with the relay key from pairing; pictures / videos in 4 MB Range parts)
 *   Away      (2.914.0) the PC says how: a relay (sealed boxes, above) or a Cloudflare tunnel ({mode: "tunnel", url} - plain
 *             https to the PC with the key, the same 6 hours)
 *   Talk      (2.914.0) 🎙 POST /api/app/voice (the recording; the PC's speech to text): find … = the web, make a video /
 *             picture / song …, fix this photo, your own phrases, else a chat; 🎙 Speak the prompt (dictate)
 *   Layout    (2.910.0, a Galaxy Z Fold) compact = one pane + bottom tabs (the cover screen, a pop-up window); wide (700 px+)
 *             = Create on the left, the other tab on the right (the unfolded screen); ⛶ hides the phone's bars */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var Cap = window.Capacitor || null;
  var P = (Cap && Cap.Plugins) || {};
  var S = { base: "", key: "", device: "", relay: null, pcName: "", lanAt: 0, via: "lan", info: null, kind: "video", pics: [], gal: "video", view: "create", right: "queue", estKey: "", jobsOpen: {}, wide: false };

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

  /* ---------- the PC: on the Wi-Fi (S.base), or away from it through ☁ the relay (2.913.0 - lib/net.js; for 6 hours after
     the app was last on the Wi-Fi - bitGen Studio checks the same) */
  var AWAY = window.BGNet ? BGNet.AWAY_MS : 6 * 3600 * 1000, te = new TextEncoder(), td = new TextDecoder();
  function tunnel() { return !!(S.relay && S.relay.mode === "tunnel" && S.relay.url); }   // 2.914.0: away through Cloudflare
  function canRelay() { return !!(window.BGNet && S.key && S.relay && (tunnel() || (S.relay.id && S.relay.key)) && Date.now() - (S.lanAt || 0) < AWAY); }
  function api(path, opts) {
    if (S.via === "relay" && canRelay()) return relayApi(path, opts);
    return lanFetch(path, opts).catch(function (e) {
      if (e.net && canRelay() && !(opts && opts.lanOnly)) { goRelay(); return relayApi(path, opts); }
      throw e;
    });
  }
  var lanSaved = 0;
  function onLan() {
    S.lanAt = Date.now();
    if (S.lanAt - lanSaved > 60000) { lanSaved = S.lanAt; kset("lanAt", String(S.lanAt)); }
    if (S.via === "relay") { S.via = "lan"; stopProbe(); Object.keys(blobs).forEach(function (k) { URL.revokeObjectURL(blobs[k]); delete blobs[k]; }); connOk(); }
  }
  function hm(ms) { var m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60); return h ? h + " h " + (m % 60) + " min" : m + " min"; }
  function connOk() {
    if (S.via === "relay") conn("☁ " + (S.pcName || "your PC") + (tunnel() ? " through Cloudflare · " : " through the relay · ") + hm(AWAY - (Date.now() - S.lanAt)) + " left", "away");
    else conn("● " + hostOf(S.base), "on");
  }
  var probeT = null;
  function stopProbe() { if (probeT) clearInterval(probeT); probeT = null; }
  function goRelay() {
    S.via = "relay"; connOk();
    if (!probeT) probeT = setInterval(function () { hello(S.base, 2500).then(function (h) { if (h) onLan(); }); }, 30000);
  }
  /** a body for the relay: bytes + its type (JSON, a form with pictures, anything fetch takes) */
  function bodyOf(o) {
    if (o.json !== undefined) return Promise.resolve({ bytes: te.encode(JSON.stringify(o.json)), type: "application/json" });
    if (!o.body) return Promise.resolve({ bytes: null, type: "" });
    var r = new Response(o.body);
    return r.arrayBuffer().then(function (ab) { return { bytes: new Uint8Array(ab), type: r.headers.get("content-type") || "" }; });
  }
  function relayRaw(path, opts) {
    var o = opts || {};
    return bodyOf(o).then(function (b) {
      if (b.bytes && b.bytes.length > 6.5 * 1048576) throw new Error("that is too big to send through the relay (the pictures?) - at home on the Wi-Fi it works");
      var h = {}; Object.keys(o.headers || {}).forEach(function (k) { h[k.toLowerCase()] = String(o.headers[k]); });
      h["x-bitgen-key"] = S.key; if (b.type) h["content-type"] = b.type;
      return BGNet.relaySend(S.relay, { method: o.method || "GET", path: path, headers: h, body: b.bytes }, o.timeout ? o.timeout + 10000 : 40000);
    }).catch(function (e) {
      if (e && e.relay) conn("☁ " + (e.status === 503 ? "your PC is not online with the relay" : "the relay: " + e.message), "bad");
      throw e;
    });
  }
  function relayApi(path, opts) {
    if (tunnel()) {                                          // the PC itself over https - the key in the header, as at home
      return lanFetch(path, opts, S.relay.url).then(function (j) { connOk(); return j; }, function (e) {
        if (e.status === 403 && /6 hours/.test(e.message)) { S.via = "lan"; stopProbe(); conn("○ away from your Wi-Fi for more than 6 hours", "bad"); }
        else if (e.net) conn("☁ the Cloudflare tunnel does not answer - is bitGen Studio running?", "bad");
        throw e;
      });
    }
    return relayRaw(path, opts).then(function (r) {
      var j = {}; try { j = JSON.parse(td.decode(r.body) || "{}"); } catch (e) { j = {}; }
      if (r.status === 401 && j && j.unpaired) unpaired();
      if (r.status === 403 && j && j.away) { S.via = "lan"; stopProbe(); conn("○ away from your Wi-Fi for more than 6 hours", "bad"); }
      if (r.status < 200 || r.status >= 300) { var e = new Error((j && j.error) || ("HTTP " + r.status)); e.status = r.status; throw e; }
      connOk();
      return j;
    });
  }
  /** a picture / video / song through the relay, 4 MB at a time (Range) -> a Blob */
  function relayFile(path, onPct) {
    var PART = 4 * 1048576, parts = [], type = "";
    function get(from) {
      return relayRaw(path, { headers: { Range: "bytes=" + from + "-" + (from + PART - 1) }, timeout: 60000 }).then(function (r) {
        if (r.status !== 206 && r.status !== 200) { var j = {}; try { j = JSON.parse(td.decode(r.body)); } catch (e) { j = {}; } throw new Error(j.error || ("HTTP " + r.status)); }
        type = r.headers["content-type"] || type; parts.push(r.body);
        if (r.status === 200) return null;
        var m = /\/(\d+)$/.exec(r.headers["content-range"] || ""), total = m ? +m[1] : 0, next = from + r.body.length;
        if (onPct && total) onPct(Math.round(next / total * 100));
        return total && next < total && r.body.length ? get(next) : null;
      });
    }
    return get(0).then(function () { return new Blob(parts, { type: type || "application/octet-stream" }); });
  }
  var blobs = {};
  /** where an <img> / <video> gets a file: the PC itself on the Wi-Fi, a Blob fetched through the relay when away */
  function mediaUrl(name, onPct) {
    if (S.via !== "relay") return Promise.resolve(BG.media(S.base, name, S.key));
    if (tunnel()) return Promise.resolve(BG.media(S.relay.url, name, S.key));
    if (blobs[name]) return Promise.resolve(blobs[name]);
    return relayFile("/outputs/" + encodeURIComponent(name), onPct).then(function (b) { blobs[name] = URL.createObjectURL(b); return blobs[name]; });
  }
  function hello(base, ms) {
    if (!base) return Promise.resolve(null);
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ctl) setTimeout(function () { ctl.abort(); }, ms || 2500);
    return fetch(base + "/api/remote/hello", { signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && j.app === "bitGen Studio" ? j : null; }, function () { return null; });
  }
  function lanFetch(path, opts, base) {
    var o = opts || {};
    var h = Object.assign({}, o.headers || {});
    if (S.key) h["X-Bitgen-Key"] = S.key;
    var init = { method: o.method || "GET", headers: h };
    if (o.json !== undefined) { h["Content-Type"] = "application/json"; init.body = JSON.stringify(o.json); }
    else if (o.body) init.body = o.body;
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ctl) { init.signal = ctl.signal; setTimeout(function () { ctl.abort(); }, o.timeout || 30000); }
    return fetch((base || S.base) + path, init).then(function (r) {
      if (S.key && !base) onLan();
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && j && j.unpaired) { unpaired(); }
        if (!r.ok) { var e = new Error((j && j.error) || ("HTTP " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    }, function (e) {
      var x = new Error(e && e.name === "AbortError" ? "your PC did not answer in time" : base ? "cannot reach your PC through " + base + " - is bitGen Studio running?" : "cannot reach your PC at " + S.base + " - is it on, with bitGen Studio running, and the phone on the same Wi-Fi?");
      x.net = true; throw x;
    });
  }
  function conn(text, cls) { var c = $("conn"); c.textContent = text; c.className = "conn " + (cls || ""); }
  function msg(id, text, cls) { var m = $(id); if (m) { m.textContent = text || ""; m.className = "msg " + (cls || ""); } }
  function unpaired() {
    S.key = ""; kset("key", "");
    conn("○ not paired", "bad"); show("connect");
    msg("pairMsg", "Your PC no longer knows this phone (it was disconnected there, or paired with another phone). Create a new link on the PC and scan it.", "bad");
    if (P.LanInfo) setTimeout(findAndConnect, 500);                         // 2.914.1: on the Wi-Fi it asks again by itself
  }

  /* ---------- views */
  /** compact: one view. wide: Create on the left + the right-hand view (Queue / Gallery / Settings) */
  function show(v) {
    if (!S.key && v !== "connect" && v !== "settings") v = "connect";
    if (S.wide && v === "create") v = S.right || "queue";
    if (v === "queue" || v === "gallery" || v === "settings" || v === "talk") S.right = v;
    S.view = v;
    var both = S.wide && v !== "connect";
    ["connect", "create", "queue", "gallery", "settings", "talk"].forEach(function (n) { $("v-" + n).hidden = !(n === v || (both && n === "create")); });
    [].forEach.call(document.querySelectorAll("#tabs button"), function (b) { b.classList.toggle("on", b.dataset.v === v); });
    if (v === "queue") loadJobs();
    if (v === "gallery") loadGallery();
    if (v === "settings") { $("baseIn").value = S.base; aboutPc(); var mb = myBuild(); $("aboutApp").textContent = "This app: bitGen " + (mb.version || "") + (mb.id && mb.id !== "dev" ? " (build " + mb.id + ")" : " (built by hand)"); }
    if (v === "create" || both) estimate(true);
  }
  function visible(n) { return !$("v-" + n).hidden; }
  /* the Fold: folding / unfolding (or resizing a pop-up window) switches compact <-> wide where the user is */
  var mqWide = window.matchMedia ? window.matchMedia("(min-width: 700px)") : null;
  function layout() {
    var w = !!(mqWide && mqWide.matches);
    if (w === S.wide && document.body.classList.contains("wide") === w) return;
    S.wide = w; document.body.classList.toggle("wide", w);
    if (S.view) show(S.view === "create" && !w ? "create" : S.view);
  }
  if (mqWide) { if (mqWide.addEventListener) mqWide.addEventListener("change", layout); else if (mqWide.addListener) mqWide.addListener(layout); }
  window.addEventListener("resize", layout);
  /* ⛶ full screen: Capacitor 8's SystemBars hides the status + navigation bars (swipe from an edge shows them a moment) */
  function fullscreen(on) {
    $("fsBtn").classList.toggle("on", !!on);
    var sb = P.SystemBars;
    if (sb) return (on ? sb.hide({}) : sb.show({})).catch(function () { /* an old Capacitor */ });
    try { if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) return document.documentElement.requestFullscreen().catch(function () {}); if (!on && document.fullscreenElement) return document.exitFullscreen(); } catch (e) { /* fine */ }
    return Promise.resolve();
  }
  $("fsBtn").onclick = function () { var on = !$("fsBtn").classList.contains("on"); fullscreen(on); kset("fullscreen", on ? "1" : ""); };
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
    lanFetch("/api/remote/pair", { method: "POST", json: { code: l.code, device: dev + " (bitGen app)" } }).then(function (j) {
      return hello(S.base, 2500).then(function (h) { return paired(j, S.base, dev, h && h.name, "pairMsg"); });
    }).then(function () { $("linkIn").value = ""; }).catch(function (e) { msg("pairMsg", e.message, "bad"); });
  }
  $("pairBtn").onclick = pair;
  /** connected (a QR / link, or 📶 on the Wi-Fi): the key, the relay for 6 hours away, the PC's name - kept on the phone */
  function paired(j, base, dev, name, msgId) {
    S.base = base; S.key = j.token; S.device = dev; S.pcName = name || ""; S.lanAt = Date.now(); S.via = "lan";
    if (j.relay !== undefined) S.relay = j.relay || null;
    return Promise.all([kset("base", S.base), kset("key", S.key), kset("device", dev), kset("pcName", S.pcName), kset("lanAt", String(S.lanAt)),
      kset("relay", S.relay ? JSON.stringify(S.relay) : "")]).then(function () {
      msg(msgId, "Connected to bitGen Studio " + (j.version || "") + (S.pcName ? " on " + S.pcName : "") + " - project " + (j.project || ""), "ok");
      return start();
    });
  }
  function saveRelay(r) { var t = r ? JSON.stringify(r) : ""; if (t !== (S.relay ? JSON.stringify(S.relay) : "")) { S.relay = r || null; kset("relay", t); } }

  /* ---------- 📶 Find my PC on Wi-Fi (2.913.0): no QR, no link. Tim: "if my phone is on the same wifi connection as the
     desktop ... connect automaticlly when i start the app" */
  function lanInfo() { return P.LanInfo && P.LanInfo.get ? P.LanInfo.get().catch(function () { return null; }) : Promise.resolve(null); }
  function portOf(b) { var m = /:(\d+)$/.exec(String(b || "")); return m ? +m[1] : 8311; }
  function ipOf(b) { var m = /^https?:\/\/(\d+\.\d+\.\d+\.\d+)(:|$)/.exec(String(b || "")); return m ? m[1] : ""; }
  /** bitGen Studio on this Wi-Fi (`name` given: that PC only) -> {base, hello} */
  function findPc(name) {
    var port = portOf(S.base), known = ipOf(S.base);
    return lanInfo().then(function (li) {
      var hosts = known ? [known] : [];
      if (li && li.wifi && li.ip) hosts = hosts.concat(BGNet.hostsOf(li.ip, li.prefix).filter(function (h) { return h !== known; }));
      if (!hosts.length) throw new Error(li && !li.wifi ? "This phone is not on a Wi-Fi network - connect it to the same Wi-Fi as your PC." : "The app could not see this phone's Wi-Fi address - use the QR or the link below.");
      return BGNet.scan(hosts, function (h) {
        return hello("http://" + h + ":" + port, 1500).then(function (j) { return j && j.lanpair && (!name || j.name === name) ? j : null; });
      }, 32);
    }).then(function (f) {
      if (!f) throw new Error("bitGen Studio was not found on this Wi-Fi. On the PC: Settings ▸ General ▸ Remote access ticked (then restart bitGen Studio), and Windows allows it through the firewall on private networks.");
      return { base: "http://" + f.host + ":" + port, hello: f.hello };
    });
  }
  var finding = false;
  function findAndConnect() {
    if (finding) return Promise.resolve();
    finding = true; $("findBtn").disabled = true;
    msg("findMsg", "Looking for bitGen Studio on this Wi-Fi…");
    var dev = ($("devName").value || "").trim() || "Android phone";
    return findPc("").then(function (f) {
      S.base = f.base; S.key = "";
      msg("findMsg", "Found bitGen Studio on " + (f.hello.name || hostOf(f.base)) + " - press Allow on the PC (or 📱 Connect the phone there).");
      return lanFetch("/api/remote/lanpair", { method: "POST", json: { device: dev + " (bitGen app)" }, timeout: 15000 }).then(function wait(j) {
        if (j.state === "allowed") return paired(j, f.base, dev, f.hello.name, "findMsg");
        if (j.state !== "pending") throw new Error(j.error || "bitGen Studio said no");
        return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return lanFetch("/api/remote/lanpair/" + j.rid, { timeout: 15000 }); }).then(wait);
      });
    }).catch(function (e) { msg("findMsg", e.message + (P.LanInfo ? " - trying again by itself…" : ""), "bad"); }).then(function () {
      finding = false; $("findBtn").disabled = false;
      // 2.914.1 (Tim: "app should connect to bitgen-studio automatically when wifi is the same"): not connected yet = look
      // again every 15 s while the app is open (the PC's 📱 Connect the phone lets it in, or its bar says Allow)
      clearTimeout(findT);
      if (P.LanInfo && !S.key) findT = setTimeout(function () { if (!S.key && !document.hidden) findAndConnect(); }, 15000);
    });
  }
  var findT = null;
  $("findBtn").onclick = findAndConnect;
  /** before talking to the paired PC: there at its address -> the Wi-Fi; else found again on this Wi-Fi (a new address) ->
   *  kept; else away -> ☁ the relay (6 hours) */
  function reach() {
    return hello(S.base, 2500).then(function (h) {
      if (h) { onLan(); S.via = "lan"; return "lan"; }
      return lanInfo().then(function (li) {
        if (!(li && li.wifi)) return null;
        return findPc(S.pcName).then(function (f) { S.base = f.base; kset("base", S.base); onLan(); S.via = "lan"; return "lan"; }, function () { return null; });
      }).then(function (r) {
        if (r) return r;
        if (canRelay()) { goRelay(); return "relay"; }
        return "";
      });
    });
  }

  /* ---------- create */
  function styles() { var i = S.info || {}; return (S.kind === "video" ? i.video_styles : S.kind === "music" ? i.music_styles : i.image_styles) || []; }
  function fillStyles() {
    var sel = $("styleSel"), keep = sel.value || ((S.info || {}).ui || {})[S.kind === "video" ? "vstyle" : S.kind === "music" ? "music" : "style"] || "";
    var l = styles();
    sel.innerHTML = l.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + "</option>"; }).join("") || '<option value="">(no styles on the PC)</option>';
    if (l.some(function (s) { return s.id === keep; })) sel.value = keep;
    kget("style." + S.kind).then(function (v) { if (v && l.some(function (s) { return s.id === v; })) sel.value = v; musicFill(); estimate(true); });
    musicFill();
  }
  /** 🎵 a music style's own sound words and length fill the fields - unless you changed them */
  var muFilled = { caption: "", secs: $("muSecs").defaultValue || "" };   // the page's own 60 counts as not yours
  function musicFill() {
    if (S.kind !== "music") return;
    var st = styles().find(function (x) { return x.id === $("styleSel").value; }) || {};
    var c = $("muCaption"), d = $("muSecs");
    if (!c.value.trim() || c.value === muFilled.caption) { c.value = st.caption || ""; muFilled.caption = c.value; }
    if (!d.value || d.value === muFilled.secs) { if (st.seconds) d.value = String(st.seconds); muFilled.secs = d.value; }
    if (st.max_seconds) d.max = String(st.max_seconds);
  }
  /** ✨ Write the song (2.911.0): the prompt box holds the idea; the PC's LLM writes the title, the sound and the lyrics
   *  (POST /api/app/song - lib/songwriter.js, as the studio's prompt chat does for "make a song about ...") */
  $("writeSong").onclick = function () {
    var idea = $("prompt").value.trim(), st = styles().find(function (x) { return x.id === $("styleSel").value; }) || {};
    if (!idea) { msg("goMsg", "Type what the song is about first (a few words), then ✨.", "bad"); return; }
    var b = $("writeSong"); b.disabled = true; b.textContent = "✨ Writing…";
    msg("goMsg", "Your PC's LLM is writing the song (the first time it may have to start the LLM)…");
    api("/api/app/song", { method: "POST", json: { idea: idea, style_id: st.id || "" }, timeout: 300000 }).then(function (j) {
      $("prompt").value = j.lyrics || ""; $("muTitle").value = j.title || "";
      if (j.style) $("muCaption").value = j.style;
      msg("goMsg", "✨ \"" + (j.title || "the song") + "\" written - change anything you like, then Make the song.", "ok");
    }).catch(function (e) { msg("goMsg", e.message, "bad"); }).then(function () { b.disabled = false; b.textContent = "✨ Write the song"; });
  };
  function paintKind() {
    [].forEach.call(document.querySelectorAll(".vonly"), function (x) { x.hidden = S.kind !== "video"; });
    [].forEach.call(document.querySelectorAll(".viOnly"), function (x) { x.hidden = S.kind === "music"; });
    [].forEach.call(document.querySelectorAll(".monly"), function (x) { x.hidden = S.kind !== "music"; });
    $("prompt").placeholder = S.kind === "music" ? "The lyrics - [verse] … [chorus] … (or a few words for an instrumental)"
      : S.kind === "image" ? "The picture - who, what, where, the light, the style…" : "What happens - who, where, how the camera moves…";
    $("goBtn").textContent = S.kind === "music" ? "Make the song" : "Generate";
  }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  [].forEach.call(document.querySelectorAll("#kindSeg button"), function (b) {
    b.onclick = function () {
      S.kind = b.dataset.kind; kset("kind", S.kind);
      [].forEach.call(document.querySelectorAll("#kindSeg button"), function (x) { x.classList.toggle("on", x === b); });
      paintKind(); fillStyles(); paintWh(); estimate(true);
    };
  });
  $("styleSel").onchange = function () { kset("style." + S.kind, $("styleSel").value); musicFill(); estimate(true); };
  function wh() {
    if (S.kind === "image") { var e = { 480: 768, 540: 1024, 720: 1280, 1080: 1536 }[$("resSel").value] || 1024; return BG.imgSizeFor(e, $("arSel").value); }
    return BG.sizeFor($("resSel").value, $("arSel").value);
  }
  function paintWh() {
    var s = wh();
    $("whLine").textContent = "→ " + s.width + " × " + s.height + (S.kind === "image" && !$("ovrOn").checked ? " (with Override style on - off, the style's own size)" : "");
  }
  $("muSecs").addEventListener("change", function () { estimate(); });
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
      if (!S.key || !visible("create")) return;
      var s = wh(), st = styles().find(function (x) { return x.id === $("styleSel").value; }) || {};
      var ov = $("ovrOn").checked;
      var body = S.kind === "music"
        ? { kind: "music", style: st.id || "", name: st.name || "", seconds: +$("muSecs").value || 0 }
        : S.kind === "video"
        ? { kind: "video", style: st.id || "", name: st.name || "", width: s.width, height: s.height, seconds: +$("seconds").value || 5, steps: +$("steps").value || 0, cfg: +$("cfg").value }
        : { kind: "image", style: st.id || "", name: st.name || "", width: ov ? s.width : 0, height: ov ? s.height : 0, frames: 1, steps: ov ? +$("steps").value || 0 : 0, cfg: ov ? +$("cfg").value : null };
      var k = JSON.stringify(body);
      if (k === S.estKey && !now) return;
      S.estKey = k;
      api("/api/timeestimate", { method: "POST", json: body }).then(function (j) {
        $("est").textContent = j.text || ""; $("est").title = j.title || "";
        if (!j.estimate) S.estKey = "";                 /* "no time yet": ask again next time - a render may have just landed */
      }, function () { $("est").textContent = ""; S.estKey = ""; });
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
    if (!prompt) { msg("goMsg", S.kind === "music" ? "Write the lyrics first (a few words make an instrumental)." : "Write what you want first.", "bad"); return; }
    if (!st) { msg("goMsg", "Pick a style - your PC has none of this kind yet.", "bad"); return; }
    var btn = $("goBtn"); btn.disabled = true;
    var say = function (t, c) { msg("goMsg", t, c); };
    var s = wh(), ov = $("ovrOn").checked;
    comfyReady(say).then(function () {
      say("Sending it to your PC…");
      if (S.kind === "music") {
        var mb = { prompt: prompt, style_id: st.id, batch: 1, format: $("muFormat").value || "mp3" };
        var cap = $("muCaption").value.trim(); if (cap) mb.caption = cap;
        var secs = parseFloat($("muSecs").value); if (secs > 0) mb.max_duration = secs;
        var ttl = $("muTitle").value.trim(); if (ttl) mb.title = ttl;
        return api("/api/genmusic", { method: "POST", json: mb, timeout: 60000 });
      }
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
    if (!visible("queue") || !S.key) return;
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
      connOk();
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
    api("/api/outputs" + (S.gal === "images" ? "?kind=images" : S.gal === "audio" ? "?kind=audio" : "")).then(function (l) {
      l = (Array.isArray(l) ? l : []).slice(0, 60);
      if (!l.length) { box.innerHTML = '<p class="hint">Nothing here yet.</p>'; return; }
      var away = S.via === "relay" && !tunnel();
      box.innerHTML = l.map(function (f) {
        var u = BG.media(S.via === "relay" && tunnel() ? S.relay.url : S.base, f.name, S.key);
        if (away && S.gal !== "audio") return '<div class="g" data-n="' + esc(f.name) + '"><div class="ph">' + (S.gal === "images" ? "🖼" : "🎬") + "</div><span>" + esc(f.name) + "</span></div>";
        if (S.gal === "audio") return '<div class="g au" data-n="' + esc(f.name) + '">🎵<span>' + esc(f.name) + (f.duration ? " · " + Math.round(f.duration) + " s" : "") + "</span></div>";
        return '<div class="g" data-n="' + esc(f.name) + '">' + (S.gal === "images" ? '<img loading="lazy" alt="" src="' + u + '">' : '<video preload="metadata" muted playsinline src="' + u + '#t=0.1"></video>')
          + "<span>" + esc(f.name) + "</span></div>";
      }).join("");
      [].forEach.call(box.querySelectorAll(".g"), function (g) { g.onclick = function () { view(g.dataset.n); }; });
      if (away && S.gal === "images") thumbs([].slice.call(box.querySelectorAll(".g")).slice(0, 12));
    }).catch(function (e) { box.innerHTML = '<p class="msg bad">' + esc(e.message) + "</p>"; });
  }
  /** ☁ away: the first pictures through the relay, one at a time (videos open when tapped) */
  function thumbs(list) {
    var g = list.shift(); if (!g || S.via !== "relay") return;
    mediaUrl(g.dataset.n).then(function (u) { var ph = g.querySelector(".ph"); if (ph) ph.outerHTML = '<img alt="" src="' + u + '">'; }, function () { /* stays a placeholder */ })
      .then(function () { thumbs(list); });
  }
  var cur = "";
  function view(name) {
    cur = name;
    var k = BG.kindOf(name);
    $("vName").textContent = name;
    $("viewer").hidden = false;
    $("vBody").innerHTML = S.via === "relay" && !tunnel() ? '<p class="msg" id="vWait">☁ Fetching it through the relay…</p>' : "";
    mediaUrl(name, function (pc) { var w = $("vWait"); if (w) w.textContent = "☁ Fetching it through the relay… " + pc + "%"; }).then(function (u) {
      if (cur !== name) return;
      $("vBody").innerHTML = k === "video" ? '<video controls autoplay playsinline src="' + u + '"></video>'
        : k === "audio" ? '<audio controls autoplay src="' + u + '"></audio>' : '<img alt="" src="' + u + '">';
    }, function (e) { if (cur === name) $("vBody").innerHTML = '<p class="msg bad">' + esc(e.message) + "</p>"; });
  }
  $("vClose").onclick = function () { $("viewer").hidden = true; $("vBody").innerHTML = ""; };
  /** the file into the phone: Documents/bitGen (asked for the storage permission first), else the app's own folder;
   *  share = the app's cache (the share sheet saves it anywhere) -> the file's uri */
  function b64of(blob) {
    return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(String(r.result).replace(/^data:[^,]*,/, "")); }; r.onerror = function () { no(r.error); }; r.readAsDataURL(blob); });
  }
  function fetchTo(name, directory) {
    var url = BG.media(S.base, name, S.key), path = "bitGen/" + name;
    return P.Filesystem.mkdir({ directory: directory, path: "bitGen", recursive: true }).catch(function () { /* there */ })
      .then(function () { return P.Filesystem.getUri({ directory: directory, path: path }); })
      .then(function (u) {
        if (S.via === "relay" && tunnel()) url = BG.media(S.relay.url, name, S.key);                         // ☁ away: the tunnel
        else if (S.via === "relay") return relayFile("/outputs/" + encodeURIComponent(name)).then(b64of)       // ☁ away: through the relay
          .then(function (data) { return P.Filesystem.writeFile({ directory: directory, path: path, data: data, recursive: true }); }).then(function () { return u.uri; });
        return P.FileTransfer.downloadFile({ url: url, path: u.uri }).then(function () { return u.uri; });
      });
  }
  function saveLocal(name, forShare) {
    if (!(P.FileTransfer && P.Filesystem)) { return mediaUrl(name).then(function (u) { window.open(u, "_blank"); return ""; }); }
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

  /* ---------- ⬆ Update (2.912.0): a newer build on the PC (GET /api/app/update) -> download it (the app's key) into the app's
     cache and open Android's installer (FileOpener) - you tap Install; Samsung's Auto Blocker must be off */
  function myBuild() { return window.BG_BUILD || { id: "dev", version: "" }; }
  var updInfo = null;
  function isNewer(pcId, appId) {
    var p = String(pcId || ""), a = String(appId || "");
    if (!/^\d{14}$/.test(p)) return false;
    if (!/^\d{14}$/.test(a)) return true;
    return p > a;
  }
  function checkUpdate(say) {
    if (!S.key) return Promise.resolve(null);
    return api("/api/app/update").then(function (u) {
      updInfo = u && u.available && isNewer(u.id, myBuild().id) ? u : null;
      $("upd").hidden = !updInfo; document.body.classList.toggle("has-upd", !!updInfo);
      if (updInfo) $("updText").textContent = "⬆ A newer bitGen app is on your PC" + (updInfo.version ? " (" + updInfo.version + ")" : "") + " - " + Math.round(updInfo.size / 1048576) + " MB";
      if (say) msg("setMsg", updInfo ? "A newer build is on your PC - tap Update at the top." : (u && u.available ? "✓ This is the newest build on your PC." : "Your PC has no build of the app yet."), updInfo ? "" : "ok");
      return updInfo;
    }).catch(function (e) { if (say) msg("setMsg", e.message, "bad"); return null; });
  }
  function doUpdate() {
    if (!updInfo) return;
    if (S.via === "relay") { alert("Update at home on the Wi-Fi - the app is too big to fetch through the relay."); return; }
    var url = S.base + "/api/app/apk?bgk=" + encodeURIComponent(S.key);
    var b = $("updBtn"); b.disabled = true; b.textContent = "Downloading…";
    var done = function () { b.disabled = false; b.textContent = "Update"; };
    if (!(P.FileTransfer && P.Filesystem && P.FileOpener)) { window.open(url, "_blank"); done(); return; }
    P.Filesystem.getUri({ directory: "CACHE", path: "bitGen-update.apk" }).then(function (u) {
      return P.FileTransfer.downloadFile({ url: url, path: u.uri }).then(function () { return u.uri; });
    }).then(function (uri) {
      b.textContent = "Installing…";
      return P.FileOpener.open({ filePath: uri, contentType: "application/vnd.android.package-archive", openWithDefault: true });
    }).catch(function (e) {
      alert("The update could not be installed: " + ((e && e.message) || e) + "\n\nIf Android says installs are blocked: turn off Samsung Auto Blocker (Settings ▸ Security and privacy ▸ Auto Blocker) and allow bitGen to install unknown apps, then Update again.");
    }).then(done);
  }
  $("updBtn").onclick = doUpdate;
  $("updLater").onclick = function () { $("upd").hidden = true; document.body.classList.remove("has-upd"); };
  $("updCheck").onclick = function () { msg("setMsg", "Checking…"); checkUpdate(true); };

  /* ---------- 🎙 voice (2.914.0). Tim: "voice chat will be very useful especially if we can add keywords or phrases, like fix
     this photo or create a video or create a song about... or if i say find... it goes to websearch mode". The recording goes
     to the PC (POST /api/app/voice - its own speech to text, lib/appVoice.js decides what the words mean); making things is
     done here, with the Create screen's own Generate. */
  var rec = null, talkHist = [];
  function record(btn, label, done) {
    if (rec) { rec.stop(); return; }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) { alert("This phone cannot record here."); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], mr = new MediaRecorder(stream), t = null;
      rec = mr; btn.classList.add("rec"); btn.textContent = "■ Stop - listening…";
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        clearTimeout(t); stream.getTracks().forEach(function (x) { x.stop(); });
        rec = null; btn.classList.remove("rec"); btn.textContent = label;
        done(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start(250);
      t = setTimeout(function () { if (rec === mr) mr.stop(); }, 30000);                 // 30 s at most
    }, function (e) { alert("The microphone: " + ((e && e.message) || e) + " - allow bitGen to use the microphone (Android asks the first time)."); });
  }
  function sendVoice(blob, mode) {
    var fd = new FormData();
    fd.append("audio", blob, "voice.webm"); fd.append("mode", mode);
    fd.append("history", JSON.stringify(talkHist.slice(-10)));
    fd.append("phrases", JSON.stringify(($("phrases").value || "").split("\n")));
    if (window.BG_TEST_HEARD) fd.append("test_heard", window.BG_TEST_HEARD);            // the suite (the PC honours it only in its test mode)
    return api("/api/app/voice", { method: "POST", body: fd, timeout: 240000 });
  }
  $("micBtn").onclick = function () {
    record($("micBtn"), "🎙 Speak the prompt", function (b) {
      msg("goMsg", "🎙 Your PC is listening to it…");
      sendVoice(b, "dictate").then(function (j) {
        var p = $("prompt"); p.value = (p.value.trim() ? p.value.trim() + " " : "") + (j.heard || "");
        msg("goMsg", j.heard ? "🎙 \"" + j.heard + "\"" : "Nothing was heard - try again a little closer.", j.heard ? "ok" : "bad");
        estimate(true);
      }, function (e) { msg("goMsg", e.message, "bad"); });
    });
  };
  function say(who, text, extra) {
    var d = document.createElement("div"); d.className = "t " + who; d.textContent = text;
    if (extra) d.appendChild(extra);
    $("talkLog").appendChild(d); d.scrollIntoView({ block: "end" });
    return d;
  }
  function speak(text) {
    if (!$("talkSpeak").checked || !window.speechSynthesis || !text) return;
    try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } catch (e) { /* no voice here */ }
  }
  function setKind(k) { var b = document.querySelector('#kindSeg button[data-kind="' + k + '"]'); if (b && S.kind !== k) b.click(); }
  /** make it with the Create screen: its kind, the prompt, (a song: written first), Generate */
  function makeIt(kind, text) {
    setKind(kind);
    if (kind === "music") {
      var st = styles().find(function (x) { return x.id === $("styleSel").value; }) || {};
      say("pc", "🎵 Writing a song about " + text + "…");
      return api("/api/app/song", { method: "POST", json: { idea: text, style_id: st.id || "" }, timeout: 300000 }).then(function (j) {
        $("prompt").value = j.lyrics || text; $("muTitle").value = j.title || ""; if (j.style) $("muCaption").value = j.style;
        say("pc", "🎵 \"" + (j.title || "the song") + "\" - making it now."); $("goBtn").click();
      });
    }
    $("prompt").value = text;
    say("pc", (kind === "video" ? "🎬 Making a video: " : "🖼 Making a picture: ") + text);
    $("goBtn").click();
    return Promise.resolve();
  }
  function fixPhoto(colour) {
    if (!S.pics.length) { say("pc", "🩹 Add the photo first - Create ▸ 📷 Camera or 🖼 Pictures - then say fix this photo again."); show("create"); return; }
    setKind("image");
    var l = styles(), st = l.find(function (x) { return x.slots > 0 && /restor|repair|fix/i.test(x.name); }) || l.find(function (x) { return x.slots > 0 && /edit|kontext/i.test(x.name); }) || l.find(function (x) { return x.slots > 0; });
    if (!st) { say("pc", "🩹 Your PC has no picture-edit style (Qwen Image Edit, FLUX Kontext…) to fix a photo with."); return; }
    $("styleSel").value = st.id;
    $("prompt").value = colour ? "Restore and colourise this old photo: repair scratches, tears, stains and noise, sharpen the faces, natural realistic colours, keep every person and detail the same."
      : "Restore this photo: repair scratches, tears, stains, fading and noise, sharpen the faces, keep every person and detail the same.";
    say("pc", "🩹 " + (colour ? "Restoring and colourising" : "Restoring") + " your photo with " + st.name + "…");
    $("goBtn").click();
  }
  function onHeard(j) {
    if (!j.heard) { say("pc", "Nothing was heard - try again a little closer."); return; }
    say("you", j.heard);
    if (j.error) { say("pc", "✗ " + j.error); return; }
    if (j.intent === "find" || j.intent === "chat") {
      var ex = null;
      if (j.sources && j.sources.length) { ex = document.createElement("span"); ex.className = "src"; ex.textContent = j.sources.map(function (x, i) { return "[" + (i + 1) + "] " + (x.title || "") + " - " + x.url; }).join("\n"); }
      say("pc", (j.intent === "find" ? "🔎 " : "") + (j.reply || "(no answer)"), ex);
      talkHist.push({ role: "user", content: j.heard }, { role: "assistant", content: j.reply || "" });
      speak(j.reply);
      return;
    }
    if (!j.text && j.intent !== "fix_photo") { say("pc", "What should it be? Say it again with what you want - for example: make a video of a tiger walking in the snow."); return; }
    if (j.intent === "video") return makeIt("video", j.text);
    if (j.intent === "image") return makeIt("image", j.text);
    if (j.intent === "song") return makeIt("music", j.text).catch(function (e) { say("pc", "✗ " + e.message); });
    if (j.intent === "fix_photo") return fixPhoto(j.colour);
  }
  $("talkBtn").onclick = function () {
    record($("talkBtn"), "🎙 Tap and speak", function (b) {
      msg("talkMsg", "🎙 Your PC is listening…");
      sendVoice(b, "talk").then(function (j) { msg("talkMsg", ""); return onHeard(j); }, function (e) { msg("talkMsg", e.message, "bad"); });
    });
  };
  $("phrases").onchange = function () { kset("phrases", $("phrases").value); };
  $("talkSpeak").onchange = function () { kset("talkSpeak", $("talkSpeak").checked ? "1" : ""); };

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
    if (!confirm("Forget your PC on this phone? You will need to connect again (📶 Find my PC on Wi-Fi, or a pairing link).")) return;
    S.key = ""; S.info = null; S.relay = null; S.via = "lan"; stopProbe();
    Promise.all([kset("key", ""), kset("base", ""), kset("relay", ""), kset("pcName", "")]).then(function () { S.base = ""; conn("○ not connected"); show("connect"); });
  };

  /* ---------- start */
  function start() {
    if (!S.key) { show("connect"); if (P.LanInfo) findAndConnect(); return Promise.resolve(); }   // 📶 in the app: look for the PC at once
    conn("… " + hostOf(S.base));
    return reach().then(function () { return api("/api/app/info"); }).then(function (i) {
      S.info = i; if (i.relay !== undefined) saveRelay(i.relay); connOk();
      fillStyles(); paintWh(); show(S.view === "connect" ? "create" : S.view);
      checkUpdate(false);
    }).catch(function (e) { conn("● can't reach the PC", "bad"); msg("goMsg", e.message, "bad"); show("create"); });
  }
  layout();
  Promise.all(["base", "key", "device", "f.resSel", "f.arSel", "f.seconds", "f.steps", "f.cfg", "f.ovrOn", "kind", "fullscreen", "relay", "pcName", "lanAt", "phrases", "talkSpeak"].map(kget)).then(function (v) {
    S.base = v[0]; S.key = v[1]; S.device = v[2];
    try { S.relay = v[11] ? JSON.parse(v[11]) : null; } catch (e) { S.relay = null; }
    S.pcName = v[12] || ""; S.lanAt = +v[13] || 0;
    $("phrases").value = v[14] || ""; $("talkSpeak").checked = v[15] === "1";
    if (v[9] === "image" || v[9] === "music") { S.kind = v[9]; [].forEach.call(document.querySelectorAll("#kindSeg button"), function (x) { x.classList.toggle("on", x.dataset.kind === S.kind); }); }
    paintKind();
    if (v[10] === "1") fullscreen(true);
    $("devName").value = S.device || "";
    if (v[3]) $("resSel").value = v[3]; if (v[4]) $("arSel").value = v[4]; if (v[5]) $("seconds").value = v[5];
    if (v[6]) $("steps").value = v[6]; if (v[7]) $("cfg").value = v[7]; $("ovrOn").checked = v[8] === "1";
    start();
  });
  // 2.914.1: a heartbeat while the app is open - the PC shows "connected" only for a phone heard from in the last 90 s
  setInterval(function () { if (!document.hidden && S.key && S.via !== "relay") api("/api/remote/me", { timeout: 10000, lanOnly: true }).catch(function () { /* reach() sorts it out */ }); }, 30000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !S.key && P.LanInfo) { findAndConnect(); return; }
    if (document.hidden || !S.key) return;
    reach().then(function () { if (S.view === "queue") loadJobs(); estimate(true); if (S.via !== "relay") checkUpdate(false); connOk(); });   // 📶 / ☁ again after a while away
  });
})();

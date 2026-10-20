/* bitGen Studio — static/bugreport.js (2.522.0): 🐞 THE BUG REPORT docker (window.H3BugReport) - Ctrl+Alt+Shift+B.
 * Tim (verbatim): "can you add a bug report floating docker - ctrl+alt+shift+b opens it. this will be where a user can
 * document bugs and send to the repo. i will upload the bug report file to you" - a report FILE (one .zip), with a
 * screenshot, the logs, the system + settings and the recorded steps.
 *   Ctrl+Alt+Shift+B   anywhere (even while typing): takes a screenshot of the window FIRST (the app as it was - in the
 *                      app, Electron's capturePage; in a browser 📷 asks which window), then opens the docker; again = hide.
 *                      Settings -> General -> 🐞 Report a bug… too
 *   THE FORM           title, severity, where (the docker you used last is picked), what happened, what you expected,
 *                      the steps (⤵ the recorded ones), the screenshot with ✏ pen / ▭ box marks (↶ undo), 📎 another picture
 *   ATTACHED           ☑ screenshot ☑ logs (the app console, ComfyUI, the vision model, the last jobs) ☑ system + settings
 *                      (every key / token hidden) ☑ recorded steps; 👁 What is included shows them first
 *   💾 SAVE            bug-reports/<id>/ in the app folder + the download of bitgen-<id>.zip - the file to send;
 *                      earlier reports: ⤓ again, 🗑. The draft is kept in this browser until it is saved.
 *   THE RECORDER       from the page's start: the last 120 clicks, choices, shortcut keys and dockers opened (WHAT was
 *                      pressed and where - never what was typed: a text box only says "edited #id"), page errors and
 *                      requests that failed (method, path, status - no bodies)
 * Pure (Node: scripts/test-bugreport522.js): keyName, recordKey, fmtT, stepsText, isOpenKey.
 */
(function (root) {
  "use strict";
  /** a key combo's name: "Ctrl+Shift+S" (pure) */
  function keyName(e) {
    var k = e.key || "";
    if (k === " ") k = "Space";
    if (k.length === 1) k = k.toUpperCase();
    return (e.ctrlKey ? "Ctrl+" : "") + (e.altKey ? "Alt+" : "") + (e.shiftKey ? "Shift+" : "") + (e.metaKey ? "Meta+" : "") + k;
  }
  /** is this key worth recording? combos and named keys - never plain typing (pure: inField = a text box has focus) */
  function recordKey(e, inField) {
    var k = e.key || "";
    if (/^(Control|Alt|Shift|Meta|OS|AltGraph|CapsLock|Dead|Unidentified)$/.test(k)) return false;
    if (e.ctrlKey || e.altKey || e.metaKey) return true;     // a shortcut
    if (inField) return false;                              // typing - never recorded
    return k.length >= 1;                                   // the app's single-key shortcuts (P, S, 1 …), Escape, Delete, F5 …
  }
  /** Ctrl+Alt+Shift+B (pure) - by the key's code: Alt changes e.key on some layouts */
  function isOpenKey(e) { return !!(e.ctrlKey && e.altKey && e.shiftKey && !e.metaKey && (e.code === "KeyB" || String(e.key).toLowerCase() === "b")); }
  function fmtT(ms) { var s = Math.max(0, Math.round(ms / 1000)); var m = Math.floor(s / 60); return (m < 10 ? "0" : "") + m + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  /** the recorded steps as numbered lines (pure) */
  function stepsText(rec) { return (rec || []).map(function (s, i) { return (i + 1) + ". " + s.what; }).join("\n"); }
  var pure = { keyName: keyName, recordKey: recordKey, isOpenKey: isOpenKey, fmtT: fmtT, stepsText: stepsText };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the recorder (from the page's start) */
  var T0 = Date.now(), REC = [], ERR = [], FREQ = [], LAST_WHERE = "";
  function push(arr, v, max) { arr.push(v); if (arr.length > max) arr.splice(0, arr.length - max); }
  function rec(what) { if (!what) return; var last = REC[REC.length - 1]; if (last && last.what === what && Date.now() - last.at < 800) return; push(REC, { t: fmtT(Date.now() - T0), at: Date.now(), what: what }, 120); }
  function clip(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function whereOf(el) {
    if (!el || !el.closest) return "";
    var sf = el.closest(".secfloat"); if (sf) { var t = sf.querySelector(".sft"); if (t) return clip(t.textContent, 40); }
    var dl = el.closest("dialog"); if (dl) { if (dl.id === "settings") { var on = dl.querySelector(".stabs button.active, .stabs button.on, .stabs [aria-selected=true]"); return "Settings" + (on ? " -> " + clip(on.textContent, 24) : ""); } var h = dl.querySelector("h1,h2,h3,.dlgt,.title"); return clip(h ? h.textContent : dl.id || "a dialog", 40); }
    var p = el.closest("[data-dock],[data-panel],.dock,.panel,[id$=Dock],[id$=Panel]"); if (p) return clip(p.getAttribute("data-dock") || p.getAttribute("data-panel") || p.id || "", 40);
    var m = el.closest("#menubar,header,nav"); if (m) return "the menu bar";
    return "";
  }
  function labelOf(el) {
    var b = el.closest ? el.closest("button,a,[role=button],[role=tab],[role=menuitem],summary,select,input,textarea,label,[data-ltab],[data-stab],[data-utab],[data-tab],.tab") || el : el;
    var tag = (b.tagName || "").toLowerCase();
    var id = b.id ? "#" + b.id : "";
    var txt = tag === "input" || tag === "textarea" || tag === "select" ? "" : clip(b.getAttribute && (b.getAttribute("aria-label") || "") || b.textContent || (b.title || ""), 50);
    if (!txt && b.title) txt = clip(b.title, 50);
    return { b: b, tag: tag, id: id, txt: txt };
  }
  function isText(el) { var t = el && el.tagName; if (!t) return false; t = t.toLowerCase(); if (t === "textarea" || el.isContentEditable) return true; if (t !== "input") return false; return !/^(checkbox|radio|button|submit|range|color|file|reset|image)$/i.test(el.type || ""); }
  // only what a PERSON did (isTrusted) - the app's own scripted clicks at start are not steps
  function onClick(e) {
    if (e.isTrusted === false) return;
    var el = e.target; if (!el || !el.closest || el.closest("#brBody")) return;
    var L = labelOf(el); if (isText(L.b) || L.tag === "select" || L.tag === "label" && L.b.control) return;
    if (L.tag === "input" && /checkbox|radio/i.test(L.b.type)) return;            // its change is recorded
    var w = whereOf(el); if (w && w !== "the menu bar") LAST_WHERE = w;
    rec("click " + (L.txt ? "\"" + L.txt + "\"" : L.tag || "?") + (L.id ? " (" + L.id + ")" : "") + (w ? " in " + w : ""));
  }
  function onChange(e) {
    if (e.isTrusted === false) return;
    var el = e.target; if (!el || !el.closest || el.closest("#brBody")) return;
    var w = whereOf(el), id = el.id ? "#" + el.id : el.name ? "[" + el.name + "]" : el.tagName.toLowerCase();
    var lab = el.labels && el.labels[0] ? clip(el.labels[0].textContent, 40) : "";
    if (w && w !== "the menu bar") LAST_WHERE = w;
    if (/checkbox|radio/i.test(el.type || "")) rec((el.checked ? "ticked " : "unticked ") + (lab ? "\"" + lab + "\" " : "") + id + (w ? " in " + w : ""));
    else if (el.tagName === "SELECT") { var o = el.options[el.selectedIndex]; rec("chose \"" + clip(o ? o.textContent : el.value, 50) + "\" in " + (lab ? "\"" + lab + "\" " : "") + id + (w ? " in " + w : "")); }
    else if (el.type === "file") rec("picked " + (el.files ? el.files.length : 0) + " file(s) in " + id + (w ? " in " + w : ""));
    else if (el.type === "range" || el.type === "color") rec("set " + (lab ? "\"" + lab + "\" " : "") + id + " = " + clip(el.value, 20) + (w ? " in " + w : ""));
    else rec("edited " + (lab ? "\"" + lab + "\" " : "") + id + (w ? " in " + w : ""));            // never what was typed
  }
  function onKey(e) {
    if (isOpenKey(e) || e.isTrusted === false) return;
    var a = document.activeElement;
    if (!recordKey(e, isText(a))) return;
    rec("key " + keyName(e) + (whereOf(a) ? " in " + whereOf(a) : ""));
  }
  if (root.addEventListener) {
    root.addEventListener("click", onClick, true);
    root.addEventListener("change", onChange, true);
    root.addEventListener("keydown", onKey, true);
    root.addEventListener("error", function (e) { push(ERR, fmtT(Date.now() - T0) + " " + (e.message || String(e.error)) + (e.filename ? " (" + String(e.filename).replace(/^.*\/static\//, "static/") + ":" + e.lineno + ")" : "") + (e.error && e.error.stack ? "\n" + String(e.error.stack).split("\n").slice(0, 6).join("\n") : ""), 50); });
    root.addEventListener("unhandledrejection", function (e) { var r = e.reason; push(ERR, fmtT(Date.now() - T0) + " unhandled: " + (r && (r.stack || r.message) || String(r)).split("\n").slice(0, 6).join("\n"), 50); });
  }
  // requests that failed (method, path, status - never their bodies)
  if (typeof root.fetch === "function" && !root.fetch.__h3br) {
    var of = root.fetch;
    var wrapped = function (u, o) {
      var m = ((o && o.method) || "GET").toUpperCase(), p = String(u && u.url || u).replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "");
      return of.apply(this, arguments).then(function (r) { if (r && r.status >= 400) push(FREQ, fmtT(Date.now() - T0) + " " + m + " " + p + " -> " + r.status, 50); return r; },
        function (err) { push(FREQ, fmtT(Date.now() - T0) + " " + m + " " + p + " -> " + (err && err.message || "failed"), 50); throw err; });
    };
    wrapped.__h3br = true;
    root.fetch = wrapped;
  }

  /* ---------------- the docker */
  var CSS = ".brd{display:flex;flex-direction:column;gap:6px;height:100%;min-height:0;overflow:auto;font-size:.76rem}"
    + ".brd .bf{display:grid;grid-template-columns:120px 1fr;gap:5px 8px;align-items:start}.brd .bf label{padding-top:4px;color:var(--dim,#9a917f)}"
    + ".brd textarea{width:100%;min-height:54px;resize:vertical}.brd input[type=text]{width:100%}"
    + ".brd .bbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.brd .bnote{color:var(--dim,#999);font-size:.7rem}.brd .bok{color:#7c7}.brd .bbad{color:#e66}"
    + ".brd .bshot{border:1px solid var(--line,#3a342a);border-radius:7px;padding:5px;background:var(--panel,#1b1814)}"
    + ".brd .bshot canvas{max-width:100%;display:block;border-radius:4px;cursor:crosshair;background:#111}"
    + ".brd .bshot .tool.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".brd .binc{display:flex;gap:12px;flex-wrap:wrap}.brd pre{font:10.5px/1.35 ui-monospace,monospace;background:#0b0b0b;border:1px solid var(--line,#333);border-radius:6px;max-height:160px;overflow:auto;padding:4px 6px;white-space:pre-wrap;margin:3px 0}"
    + ".brd .blist .bi{display:flex;gap:6px;align-items:center;border-top:1px solid rgba(255,255,255,.05);padding:3px 0}.brd .blist .bi img{width:48px;height:30px;object-fit:cover;border-radius:3px}"
    + ".brd h5{margin:6px 0 0;color:var(--tiger,#f59e2c);font-size:.7rem;text-transform:uppercase;letter-spacing:.06em}";
  var S = { img: null, marks: [], tool: "pen", drawing: null, sev: [], preview: null, shotAt: "" };
  var DRAFT = "bitgen.bugDraft";
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function say(t, cls) { var m = $("brMsg"); if (m) { m.textContent = t || ""; m.className = "bnote " + (cls || ""); } }
  var AREAS = ["Timeline", "Image editor", "StoryBoard", "Music", "Prompt / generate", "Queue", "Settings", "ComfyUI", "Assistant (LLM)", "Vision model", "Install / setup", "Export", "Other"];
  /** the floating dockers open now (SecFloat's own state - a fixed window has no offsetParent) */
  function shownDockers() {
    var W = (root.SecFloat && SecFloat.windows) || {};
    return Object.keys(W).filter(function (id) { var st = SecFloat.state ? SecFloat.state(id) : null; return id !== "bugreport" && st && st.shown; })
      .map(function (id) { var t = W[id].el && W[id].el.querySelector(".sft"); return t ? clip(t.textContent, 40) : id; }).filter(Boolean);
  }

  function build() {
    var body = document.createElement("div"); body.className = "brd"; body.id = "brBody";
    body.innerHTML = '<div class="bnote">Describe what went wrong - a screenshot, the logs, the system and your last steps go with it. 💾 Save makes one .zip: the file to send.</div>'
      + '<div class="bf">'
      + '<label for="brTitle">Title</label><input type="text" id="brTitle" placeholder="in a few words: what broke" maxlength="200">'
      + '<label for="brSev">Severity</label><select id="brSev"></select>'
      + '<label for="brArea">Where</label><select id="brArea" title="The docker or part of the app - the one you used last is picked"></select>'
      + '<label for="brWhat">What happened</label><textarea id="brWhat" placeholder="what you saw - an error message, what stopped, what looked wrong"></textarea>'
      + '<label for="brExp">What you expected</label><textarea id="brExp" placeholder="what should have happened" style="min-height:40px"></textarea>'
      + '<label for="brSteps">Steps to reproduce</label><div><textarea id="brSteps" placeholder="1. open …&#10;2. click …&#10;3. …"></textarea>'
      + '<div class="bbar"><button type="button" class="ghost" id="brUseRec" title="Your last clicks and keys, recorded from when the app started (never what you typed)">⤵ Use the recorded steps</button><span class="bnote" id="brRecInfo"></span></div></div>'
      + "</div>"
      + "<h5>Screenshot</h5>"
      + '<div class="bshot"><div class="bbar" style="margin-bottom:4px"><button type="button" class="ghost tool on" data-tool="pen" title="Draw on it">✏ Pen</button><button type="button" class="ghost tool" data-tool="box" title="Draw a box around something">▭ Box</button>'
      + '<button type="button" class="ghost" id="brUndo">↶ Undo</button><button type="button" class="ghost" id="brShot" title="Take a new screenshot of the window (the docker hides for it)">📷 Again</button>'
      + '<button type="button" class="ghost" id="brAddPic">📎 A picture…</button><input type="file" id="brFile" accept="image/*" hidden><button type="button" class="ghost" id="brNoShot">🗑</button><span class="bnote" id="brShotInfo"></span></div>'
      + '<canvas id="brCanvas" width="10" height="10" style="display:none"></canvas><div class="bnote" id="brNoImg">No screenshot - 📷 to take one (Ctrl+Alt+Shift+B takes it before the docker opens).</div></div>'
      + "<h5>Attached</h5>"
      + '<div class="binc"><label><input type="checkbox" id="brIncShot" checked> screenshot</label><label><input type="checkbox" id="brIncLogs" checked> logs</label>'
      + '<label><input type="checkbox" id="brIncSys" checked> system + settings (keys and tokens hidden)</label><label><input type="checkbox" id="brIncSteps" checked> recorded steps</label>'
      + '<button type="button" class="ghost" id="brPeek">👁 What is included</button></div><div id="brPeekBox" style="display:none"></div>'
      + '<div class="bbar" style="margin-top:6px"><button type="button" id="brSave">💾 Save report</button><button type="button" class="ghost" id="brNew" title="Clear the form for another bug">🧹 New</button><span class="bnote" id="brMsg" aria-live="polite" style="flex:1"></span></div>'
      + "<h5>Earlier reports</h5><div class=\"blist\" id=\"brList\"><div class=\"bnote\">none yet</div></div>";
    return body;
  }
  function fillSelects() {
    var sev = S.sev.length ? S.sev : [{ id: "crash", label: "💥 Crash / freeze" }, { id: "broken", label: "⛔ Something does not work" }, { id: "wrong", label: "⚠ Wrong result" }, { id: "looks", label: "🎨 Looks wrong" }, { id: "idea", label: "💡 Idea / wish" }];
    var cur = $("brSev").value || "broken";
    $("brSev").innerHTML = sev.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === cur ? " selected" : "") + ">" + esc(s.label) + "</option>"; }).join("");
    var areas = [], seen = {};
    [LAST_WHERE].concat(shownDockers(), AREAS).forEach(function (a) { var k = String(a || "").split(" -> ")[0]; if (a && !seen[a]) { seen[a] = 1; areas.push(a); } if (k && !seen[k]) { seen[k] = 1; } });
    var was = $("brArea").value;
    $("brArea").innerHTML = areas.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + "</option>"; }).join("");
    $("brArea").value = was && areas.indexOf(was) >= 0 ? was : areas[0] || "Other";
    $("brRecInfo").textContent = REC.length + " steps recorded" + (ERR.length ? " · " + ERR.length + " page error(s)" : "") + (FREQ.length ? " · " + FREQ.length + " failed request(s)" : "");
  }

  /* ---- the screenshot + marks */
  function redraw() {
    var c = $("brCanvas"), x = c.getContext("2d");
    if (!S.img) { c.style.display = "none"; $("brNoImg").style.display = ""; $("brShotInfo").textContent = ""; return; }
    c.style.display = ""; $("brNoImg").style.display = "none";
    if (c.width !== S.img.naturalWidth || c.height !== S.img.naturalHeight) { c.width = S.img.naturalWidth; c.height = S.img.naturalHeight; }
    x.drawImage(S.img, 0, 0);
    var lw = Math.max(3, Math.round(c.width / 400));
    S.marks.concat(S.drawing ? [S.drawing] : []).forEach(function (m) {
      x.strokeStyle = "#ff2d2d"; x.lineWidth = lw; x.lineJoin = x.lineCap = "round"; x.beginPath();
      if (m.t === "box") x.strokeRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
      else { m.p.forEach(function (q, i) { if (i) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); }); x.stroke(); }
    });
    $("brShotInfo").textContent = c.width + " × " + c.height + (S.shotAt ? " · " + S.shotAt : "") + (S.marks.length ? " · " + S.marks.length + " mark(s)" : "");
  }
  function setImage(src, note) {
    var im = new Image();
    im.onload = function () { S.img = im; S.marks = []; S.shotAt = note || ""; redraw(); };
    im.onerror = function () { say("that picture could not be read", "bbad"); };
    im.src = src;
  }
  function canvasPt(e) { var c = $("brCanvas"), r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; }
  function wireCanvas() {
    var c = $("brCanvas");
    c.addEventListener("pointerdown", function (e) { if (!S.img) return; c.setPointerCapture(e.pointerId); var p = canvasPt(e); S.drawing = S.tool === "box" ? { t: "box", x0: p[0], y0: p[1], x1: p[0], y1: p[1] } : { t: "pen", p: [p] }; redraw(); });
    c.addEventListener("pointermove", function (e) { if (!S.drawing) return; var p = canvasPt(e); if (S.drawing.t === "box") { S.drawing.x1 = p[0]; S.drawing.y1 = p[1]; } else S.drawing.p.push(p); redraw(); });
    var end = function () { if (!S.drawing) return; var d = S.drawing; S.drawing = null; if (d.t === "pen" ? d.p.length > 1 : Math.abs(d.x1 - d.x0) + Math.abs(d.y1 - d.y0) > 4) S.marks.push(d); redraw(); };
    c.addEventListener("pointerup", end); c.addEventListener("pointercancel", end);
    document.querySelectorAll("#brBody .tool").forEach(function (b) { b.onclick = function () { S.tool = b.dataset.tool; document.querySelectorAll("#brBody .tool").forEach(function (x) { x.classList.toggle("on", x === b); }); }; });
    $("brUndo").onclick = function () { S.marks.pop(); redraw(); };
    $("brNoShot").onclick = function () { S.img = null; S.marks = []; redraw(); };
    $("brAddPic").onclick = function () { $("brFile").click(); };
    $("brFile").onchange = function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; var r = new FileReader(); r.onload = function () { setImage(r.result, f.name); }; r.readAsDataURL(f); };
    $("brShot").onclick = function () { var shown = isShown(); if (shown) show(false); setTimeout(function () { capture().then(function () { if (shown) show(true); }); }, 350); };
  }
  /** a screenshot of the window: Electron's capturePage, else the browser's own picker */
  function capture() {
    var sh = root.h3shell && root.h3shell.capture && root.h3shell.capture.shot;
    var stamp = new Date().toLocaleTimeString();
    if (sh) {
      return Promise.resolve(sh({ target: "window" })).then(function (buf) {
        var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf && buf.data ? buf.data : buf || []);
        if (!u8.length) return;
        return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { setImage(fr.result, "the window at " + stamp); res(); }; fr.readAsDataURL(new Blob([u8], { type: "image/png" })); });
      }).catch(function (e) { say("no screenshot: " + (e && e.message || e), "bbad"); });
    }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) { say("this browser cannot take a screenshot - 📎 add one instead", "bbad"); return Promise.resolve(); }
    return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then(function (st) {
      var v = document.createElement("video"); v.muted = true; v.srcObject = st;
      return v.play().then(function () { return new Promise(function (r) { setTimeout(r, 250); }); }).then(function () {
        var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
        st.getTracks().forEach(function (t) { t.stop(); });
        setImage(c.toDataURL("image/png"), "picked at " + stamp);
      });
    }).catch(function () { say("no screenshot taken - 📎 add one instead", ""); });
  }

  /* ---- the draft (this browser only - a convenience) */
  var FIELDS = ["brTitle", "brWhat", "brExp", "brSteps"];
  function saveDraft() { try { var d = {}; FIELDS.forEach(function (f) { d[f] = $(f).value; }); d.sev = $("brSev").value; localStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) { /* storage off */ } }
  function loadDraft() { try { var d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (!d) return; FIELDS.forEach(function (f) { if (d[f] != null && !$(f).value) $(f).value = d[f]; }); if (d.sev) $("brSev").value = d.sev; } catch (e) { /* none */ } }
  function clearForm() { FIELDS.forEach(function (f) { $(f).value = ""; }); S.img = null; S.marks = []; redraw(); try { localStorage.removeItem(DRAFT); } catch (e) { /* fine */ } }

  /* ---- 👁 included, 💾 save, the list */
  function peek() {
    var box = $("brPeekBox");
    if (box.style.display !== "none") { box.style.display = "none"; return; }
    box.style.display = ""; box.innerHTML = '<div class="bnote">reading…</div>';
    fetch("/api/bugreport/preview").then(function (r) { return r.json(); }).then(function (p) {
      var sys = p.system || {};
      box.innerHTML = '<div class="bnote">System</div><pre>' + esc(["bitGen Studio " + sys.version, sys.os, sys.cpu + " · " + sys.ram_gb + " GB RAM", "Graphics: " + sys.gpu, "ComfyUI: " + sys.comfy].join("\n")) + "</pre>"
        + Object.keys(p.logs || {}).map(function (k) { return '<div class="bnote">logs/' + esc(k) + " - " + p.logs[k].lines + " lines (the last 40)</div><pre>" + esc(p.logs[k].tail) + "</pre>"; }).join("")
        + '<div class="bnote">Recorded steps (' + REC.length + ")</div><pre>" + esc(stepsText(REC) || "-") + "</pre>"
        + (ERR.length ? '<div class="bnote">Page errors</div><pre>' + esc(ERR.join("\n")) + "</pre>" : "")
        + (FREQ.length ? '<div class="bnote">Failed requests</div><pre>' + esc(FREQ.join("\n")) + "</pre>" : "")
        + '<div class="bnote">Settings (report.json - keys and tokens hidden)</div><pre>' + esc(JSON.stringify(p.settings, null, 1).slice(0, 6000)) + "</pre>";
    }).catch(function () { box.innerHTML = '<div class="bnote bbad">the app did not answer</div>'; });
  }
  function save() {
    var title = $("brTitle").value.trim();
    if (!title && !$("brWhat").value.trim()) { say("a title or what happened first", "bbad"); $("brTitle").focus(); return; }
    var inc = { screenshot: $("brIncShot").checked && !!S.img, logs: $("brIncLogs").checked, system: $("brIncSys").checked, steps: $("brIncSteps").checked };
    var body = { title: title, severity: $("brSev").value, area: $("brArea").value, happened: $("brWhat").value, expected: $("brExp").value, steps: $("brSteps").value,
      recorded: inc.steps ? REC.map(function (s) { return { t: s.t, what: s.what }; }) : [], page_errors: ERR.slice(), failed_requests: FREQ.slice(),
      page: { url: location.pathname, size: innerWidth + "×" + innerHeight, ua: navigator.userAgent, dockers: shownDockers() }, include: inc,
      screenshot: inc.screenshot ? $("brCanvas").toDataURL("image/png") : "" };
    $("brSave").disabled = true; say("saving…");
    fetch("/api/bugreport", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }).then(function (r) {
      $("brSave").disabled = false;
      if (r.error) { say(r.error, "bbad"); return; }
      say("✓ saved " + r.id + " - bitgen-" + r.id + ".zip is downloading: the file to send", "bok");
      var a = document.createElement("a"); a.href = "/api/bugreport/zip/" + encodeURIComponent(r.id); a.download = "bitgen-" + r.id + ".zip"; document.body.appendChild(a); a.click(); a.remove();
      try { localStorage.removeItem(DRAFT); } catch (e) { /* fine */ }
      S.lastId = r.id; list();
    }).catch(function (e) { $("brSave").disabled = false; say("the app did not answer: " + (e && e.message || e), "bbad"); });
  }
  function list() {
    return fetch("/api/bugreport").then(function (r) { return r.json(); }).then(function (l) {
      var box = $("brList"); if (!box || !Array.isArray(l)) return;
      box.innerHTML = l.length ? l.map(function (b) {
        return '<div class="bi" data-id="' + esc(b.id) + '">' + (b.screenshot ? '<img alt="" loading="lazy" src="/api/bugreport/shot/' + encodeURIComponent(b.id) + '">' : "") + '<span style="flex:1">' + esc(b.title) + ' <span class="bnote">' + esc((b.when || "").slice(0, 16).replace("T", " ")) + (b.area ? " · " + esc(b.area) : "") + "</span></span>"
          + '<a class="ghost" href="/api/bugreport/zip/' + encodeURIComponent(b.id) + '" download="bitgen-' + esc(b.id) + '.zip" title="The .zip to send" style="text-decoration:none;padding:2px 7px;border:1px solid var(--line,#444);border-radius:5px;color:inherit">⤓</a>'
          + '<button type="button" class="ghost" data-del title="Delete this report">🗑</button></div>';
      }).join("") : '<div class="bnote">none yet</div>';
    }).catch(function () { /* offline */ });
  }

  function isShown() { var st = root.SecFloat && SecFloat.state ? SecFloat.state("bugreport") : null; return !!(st && st.shown); }
  function show(on) { return root.SecFloat && SecFloat.show ? SecFloat.show("bugreport", on) : false; }
  /** Ctrl+Alt+Shift+B: the screenshot first (the app as it was), then the docker; again = hide */
  function open(force) {
    if (!$("brBody")) return Promise.resolve(false);
    if (isShown() && !force) { show(false); return Promise.resolve(false); }
    rec("opened 🐞 Bug report");
    var first = !S.img && root.h3shell && root.h3shell.capture ? capture() : Promise.resolve();
    return first.then(function () { show(true); fillSelects(); loadDraft(); list(); setTimeout(function () { var t = $("brTitle"); if (t && !t.value) t.focus(); }, 60); return true; });
  }
  function start() {
    if (!root.SecFloat || !SecFloat.add || !SecFloat.started) { setTimeout(start, 150); return; }
    if ($("brBody")) return;
    if (!$("brCss")) { var st = document.createElement("style"); st.id = "brCss"; st.textContent = CSS; document.head.appendChild(st); }
    var body = build();
    SecFloat.add({ id: "bugreport", title: "🐞 Bug report", w: 680, h: 760, body: body, onShow: function () { fillSelects(); list(); } });
    wireCanvas();
    $("brUseRec").onclick = function () { var t = stepsText(REC.filter(function (s) { return !/^opened 🐞/.test(s.what); }).slice(-25)); $("brSteps").value = ($("brSteps").value.trim() ? $("brSteps").value.trim() + "\n" : "") + t; saveDraft(); };
    $("brPeek").onclick = peek;
    $("brSave").onclick = save;
    $("brNew").onclick = function () { clearForm(); say("🧹 a new report"); };
    FIELDS.forEach(function (f) { $(f).addEventListener("input", saveDraft); });
    body.addEventListener("keydown", function (e) { if (!isOpenKey(e)) e.stopPropagation(); });
    $("brList").addEventListener("click", function (e) {
      if (!e.target.hasAttribute("data-del")) return;
      var id = e.target.closest(".bi").dataset.id;
      var ok = typeof appConfirm === "function" ? appConfirm("Delete the bug report " + id + "?") : Promise.resolve(true);
      Promise.resolve(ok).then(function (y) { if (y) fetch("/api/bugreport/" + encodeURIComponent(id), { method: "DELETE" }).then(list); });
    });
    var sb = $("s_bug"); if (sb) sb.onclick = function () { var d = $("settings"); if (d && d.open) d.close(); setTimeout(function () { open(true); }, 120); };
  }
  if (root.addEventListener) root.addEventListener("keydown", function (e) { if (isOpenKey(e)) { e.preventDefault(); e.stopPropagation(); open(); } }, true);
  root.H3BugReport = Object.assign({ open: open, show: show, capture: capture, steps: function () { return REC.slice(); }, errors: function () { return ERR.slice(); }, failed: function () { return FREQ.slice(); }, state: function () { return S; } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);

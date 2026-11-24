/* bitGen Studio — static/securitytab.js (2.940.0): 🔒 LOCAL SECURITY ON THE PAGE - window.H3Security.
 *
 * Tim (verbatim): "add a security tab to settings. explain that it is local security,not saved online. add a checkbox to ask
 * for username and password on startup. add inputs for username and password and preferred name. when user talks to llm ,
 * llm will talk to them by their preferred name in a friendly manner. in the general tab add a checkbox to hide splash screen"
 *
 *   The sign-in cover   when Settings ▸ Security asks for it, an opaque cover hides the studio until POST /api/security/login
 *                       says yes; once per start (sessionStorage h3.sec.ok - a project reload doesn't ask again). Loaded at
 *                       the TOP of <body>: the last answer is remembered (localStorage h3.sec.ask), so the cover is up
 *                       before anything paints. Keys and focus stop at it.
 *   Settings ▸ Security preferred name, the checkbox, username, password (twice), 💾 Save security (routes/security.js)
 *   Settings ▸ General  "Hide the splash screen" = ui.no_splash (POST /api/config; the desktop shell reads it -
 *                       electron/startPrefs.js)
 *   H3Security.name()   the preferred name (else the username, else "") - Police Chase's high scores use it
 * Pure (Node: scripts/test-940.js): shown(cfg), passProblem(p1, p2, had, ask), who(cfg).
 */
(function (root) {
  "use strict";
  /** the cover goes up when asking is on and this start hasn't signed in */
  function shown(cfg, signedIn) { return !!(cfg && cfg.ask) && !signedIn; }
  /** why the password fields can't be saved, or "" */
  function passProblem(p1, p2, had, ask) {
    p1 = String(p1 || ""); p2 = String(p2 || "");
    if (p1 || p2) { if (p1 !== p2) return "The two passwords don't match."; if (p1.length < 4) return "The password needs at least 4 characters."; return ""; }
    return ask && !had ? "Type a password (twice) to ask for it at start-up." : "";
  }
  function who(cfg) { cfg = cfg || {}; return String(cfg.name || cfg.user || ""); }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { shown: shown, passProblem: passProblem, who: who }; return; }

  var doc = root.document, SK = "h3.sec.ok", LK = "h3.sec.ask";
  var $ = function (id) { return doc.getElementById(id); };
  var S = {
    get: function (st, k) { try { return root[st].getItem(k); } catch (e) { return null; } },
    set: function (st, k, v) { try { root[st].setItem(k, v); } catch (e) { /* private mode */ } }
  };
  var cur = { ask: false, user: "", name: "", hasPassword: false }, cover = null;
  function signedIn() { return S.get("sessionStorage", SK) === "1"; }
  function post(url, b) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); });
  }

  /* ---------------- the sign-in cover ---------------- */
  var CSS = "#h3sec{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;"
    + "background:radial-gradient(circle at 50% 35%,#24201b,#0c0b0a 70%);color:#eee;font-family:system-ui,Segoe UI,sans-serif;transition:opacity .3s}"
    + "#h3sec.out{opacity:0}"
    + "#h3sec form{display:flex;flex-direction:column;gap:10px;padding:30px 36px;border-radius:14px;min-width:300px;"
    + "background:rgba(28,26,23,.95);border:1px solid rgba(245,158,44,.35);box-shadow:0 10px 50px rgba(0,0,0,.6)}"
    + "#h3sec img{height:46px;align-self:center;margin-bottom:4px}"
    + "#h3sec h2{margin:0 0 4px;text-align:center;font-size:1.15rem;font-weight:600}"
    + "#h3sec input{padding:8px 10px;border-radius:7px;border:1px solid #555;background:#141210;color:#eee;font-size:1rem}"
    + "#h3sec input:focus{outline:2px solid #f59e2c;outline-offset:0}"
    + "#h3sec button{padding:9px;border-radius:7px;border:0;background:#f59e2c;color:#111;font-weight:600;font-size:1rem;cursor:pointer}"
    + "#h3sec button[disabled]{opacity:.6;cursor:progress}"
    + "#h3sec .e{min-height:1.2em;color:#f88;font-size:.9rem;text-align:center}"
    + "#h3sec .n{opacity:.6;font-size:.8rem;text-align:center}"
    + "#h3sec.shake form{animation:h3secshake .35s}"
    + "@keyframes h3secshake{0%,100%{transform:none}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}";
  function inCover(t) { return !!(cover && t && cover.contains(t)); }
  function block(e) { if (cover && !inCover(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); } }
  function keepFocus(e) { if (cover && !inCover(e.target)) { var u = $("h3secUser"); if (u) try { u.focus(); } catch (x) { /* fine */ } } }
  function show(user) {
    if (cover) return;
    if (!$("h3secCss")) { var st = doc.createElement("style"); st.id = "h3secCss"; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st); }
    cover = doc.createElement("div"); cover.id = "h3sec";
    cover.setAttribute("role", "dialog"); cover.setAttribute("aria-modal", "true"); cover.setAttribute("aria-label", "Sign in to bitGen Studio");
    cover.innerHTML = '<form autocomplete="off"><img src="/static/logo.svg" alt=""><h2>Sign in to bitGen Studio</h2>'
      + '<input id="h3secUser" type="text" placeholder="Username" aria-label="Username" spellcheck="false" autocomplete="username">'
      + '<input id="h3secPass" type="password" placeholder="Password" aria-label="Password" autocomplete="current-password">'
      + '<button type="submit">Sign in</button><div class="e" id="h3secErr" role="alert"></div>'
      + '<div class="n">Local security - checked on this computer, nothing goes online.</div></form>';
    (doc.body || doc.documentElement).appendChild(cover);
    if (user) $("h3secUser").value = user;
    cover.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); signIn(); });
    ["keydown", "keyup", "keypress"].forEach(function (k) { root.addEventListener(k, block, true); });
    doc.addEventListener("focusin", keepFocus, true);
    setTimeout(function () { try { (user ? $("h3secPass") : $("h3secUser")).focus(); } catch (e) { /* fine */ } }, 30);
  }
  function hide() {
    if (!cover) return;
    var c = cover; cover = null;
    ["keydown", "keyup", "keypress"].forEach(function (k) { root.removeEventListener(k, block, true); });
    doc.removeEventListener("focusin", keepFocus, true);
    c.classList.add("out"); setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 320);
  }
  function signIn() {
    var b = cover && cover.querySelector("button"), err = $("h3secErr");
    if (!b || b.disabled) return;
    b.disabled = true; err.textContent = "";
    post("/api/security/login", { user: $("h3secUser").value, password: $("h3secPass").value }).then(function (j) {
      b.disabled = false;
      if (j && j.ok) { S.set("sessionStorage", SK, "1"); if (j.name) cur.name = cur.name || j.name; hide(); return; }
      err.textContent = (j && j.error) || "That didn't work."; $("h3secPass").value = "";
      cover.classList.remove("shake"); void cover.offsetWidth; cover.classList.add("shake");
      try { $("h3secPass").focus(); } catch (e) { /* fine */ }
    }).catch(function () { b.disabled = false; err.textContent = "bitGen Studio's server isn't answering yet - try again in a moment."; });
  }

  /* ---------------- the settings ---------------- */
  function load() {
    return fetch("/api/security").then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.error) return cur;
      cur = j; S.set("localStorage", LK, j.ask ? "1" : "0");
      if (shown(j, signedIn())) { show(j.user); var u = $("h3secUser"); if (u && !u.value && j.user) { u.value = j.user; try { $("h3secPass").focus(); } catch (e) { /* fine */ } } } else if (!j.ask) hide();
      paint(); return cur;
    }).catch(function () { return cur; });
  }
  function paint() {
    if (!$("sec_name")) return;
    $("sec_name").value = cur.name || ""; $("sec_user").value = cur.user || ""; $("sec_ask").checked = !!cur.ask;
    $("sec_pass").value = ""; $("sec_pass2").value = "";
    $("sec_pass").placeholder = cur.hasPassword ? "•••••• (kept - type a new one to change it)" : "at least 4 characters";
  }
  function msg(t, bad) { var m = $("sec_msg"); if (m) { m.textContent = t; m.style.color = bad ? "#f88" : ""; } }
  function save() {
    var ask = $("sec_ask").checked, user = $("sec_user").value.trim(), p1 = $("sec_pass").value, p2 = $("sec_pass2").value;
    if (ask && !user) { msg("Type a username to ask for it at start-up.", true); return Promise.resolve(null); }
    var bad = passProblem(p1, p2, cur.hasPassword, ask); if (bad) { msg(bad, true); return Promise.resolve(null); }
    var b = { ask: ask, user: user, name: $("sec_name").value };
    if (p1) b.password = p1;
    return post("/api/security", b).then(function (j) {
      if (!j || j.error) { msg((j && j.error) || "Not saved.", true); return null; }
      if (j.ask) S.set("sessionStorage", SK, "1");                    // this start is already signed in
      cur = j; S.set("localStorage", LK, j.ask ? "1" : "0"); paint();
      msg("✓ Saved on this PC" + (j.ask ? " - bitGen Studio asks for it at the next start." : "."));
      return j;
    }).catch(function () { msg("Not saved - the server isn't answering.", true); return null; });
  }
  function wireSplash() {
    var c = $("s_nosplash"); if (!c) return;
    fetch("/api/config").then(function (r) { return r.json(); }).then(function (cfg) { c.checked = !!((cfg && cfg.ui) || {}).no_splash; }).catch(function () { /* stays */ });
    c.addEventListener("change", function () { post("/api/config", { ui: { no_splash: c.checked } }).catch(function () { /* next time */ }); });
  }
  function wire() {
    if ($("sec_save")) $("sec_save").addEventListener("click", save);
    doc.querySelectorAll('#settings .stabs button[data-stab="security"]').forEach(function (b) { b.addEventListener("click", function () { msg(""); load(); }); });
    ["sec_pass", "sec_pass2", "sec_user", "sec_name"].forEach(function (id) { var e = $(id); if (e) e.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); save(); } }); });
    wireSplash(); paint();
  }

  // up at once when the last start asked (no flash of the studio), then the server's answer decides
  if (S.get("localStorage", LK) === "1" && !signedIn()) show("");
  load();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  root.H3Security = { name: function () { return who(cur); }, load: load, save: save, show: show, hide: hide, shown: shown, passProblem: passProblem, who: who };
})(typeof window !== "undefined" ? window : globalThis);

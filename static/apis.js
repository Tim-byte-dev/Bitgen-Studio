/* bitGen Studio — static/apis.js (2.757.0): SETTINGS ▸ API (window.H3Apis).
 * Tim (verbatim): "can you add an api tab to bitgen with add api input and name input and a use checkbox for each api the
 * use adds. if api is checked add it to styles with prefix API_ so bitgen can truly work without good hardware"
 * (asked: "Several known services", "Pictures, Video, Songs, The LLM too") + "add runninghub too".
 *   Add:   Service (Auto-detect from the key) · Name · API key · Use · + Add
 *   Each:  ☐ Use (= its API_ styles: pictures / video / songs, whatever the service makes) · ✓ Test · ✕ Remove ·
 *          Models (the defaults, changeable) · ☐ Use for the LLM (OpenRouter / OpenAI / Gemini; one at a time)
 *   The key is sent once and kept encrypted (lib/secrets.js); the page only ever sees its last 4.
 *   Tim: "can we add claude as well?" - Claude (Anthropic) is the LLM only: added with Use = Use for the LLM, no styles.
 * API: GET/POST /api/apis, POST /api/apis/:id, POST /api/apis/:id/test, DELETE /api/apis/:id (routes/apis.js).
 * Pure (scripts/test-apis757.js): guess(key) - the same shapes as lib/apis.js detect. */
(function (root) {
  "use strict";
  var doc = root.document;
  var S = { apis: [], services: [], busy: false };
  var KW = { image: `pictures`, video: `video`, music: `songs` };
  var SHAPES = [["openrouter", /^sk-or-(v1-)?[A-Za-z0-9_-]{20,}$/], ["fal", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{20,}$/i],
    ["replicate", /^r8_[A-Za-z0-9]{20,}$/], ["gemini", /^AIza[0-9A-Za-z_-]{30,}$/], ["claude", /^sk-ant-[A-Za-z0-9_-]{20,}$/], ["openai", /^sk-(proj-)?[A-Za-z0-9_-]{20,}$/], ["runninghub", /^[0-9a-f]{32}$/i]];
  function guess(key) { var k = String(key || "").trim(); for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i][1].test(k)) return SHAPES[i][0]; return ""; }
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function call(method, url, body) {
    return fetch(url, { method: method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }
  function say(t, bad) { var e = $("apiSay"); if (e) { e.textContent = t || ""; e.className = "hint" + (bad ? " apibad" : ""); } }
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[api] " + t); } catch (e) { /* no console */ } }
  var CSS = "#stab-api .apiadd{display:grid;grid-template-columns:minmax(120px,1fr) minmax(120px,1fr) minmax(180px,2fr) auto auto;gap:6px;align-items:end;margin:0 0 6px}"
    + "#stab-api .apiadd label.f{display:block;font-size:11px;color:var(--dim,#aaa);margin:0 0 2px}"
    + "@media (max-width:640px){#stab-api .apiadd{grid-template-columns:1fr 1fr}}"
    + "#stab-api .apirow{border:1px solid var(--line,#3a352e);border-radius:6px;padding:8px 10px;margin:0 0 8px}"
    + "#stab-api .apirow.on{border-color:var(--tiger,#f59e2c)}"
    + "#stab-api .apihead{display:flex;gap:10px;align-items:center;flex-wrap:wrap}"
    + "#stab-api .apihead .nm{font-weight:600}#stab-api .apihead .sv{color:var(--dim,#aaa);font-size:12px}"
    + "#stab-api .apihead .key{font:11px ui-monospace,monospace;color:var(--dim,#999)}"
    + "#stab-api .apihead .sp{flex:1}"
    + "#stab-api .apikinds{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 0}#stab-api .apikinds span{font-size:11px;padding:0 7px;border:1px solid var(--line,#3a352e);border-radius:9px}"
    + "#stab-api .apimore{margin:6px 0 0;font-size:12px}#stab-api .apimore summary{cursor:pointer;color:var(--dim,#aaa)}"
    + "#stab-api .apimodels{display:grid;grid-template-columns:110px 1fr;gap:4px 8px;align-items:center;margin:6px 0}"
    + "#stab-api .apiline{font-size:12px;margin:4px 0 0;color:var(--dim,#aaa)}#stab-api .apiline.ok{color:#7fd17f}#stab-api .apibad,#stab-api .apiline.bad{color:#e88}";
  function boot() {
    var dlg = $("settings"), tabs = dlg && dlg.querySelector(".stabs");
    if (!tabs || $("stab-api")) return;
    var st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);
    var b = doc.createElement("button"); b.dataset.stab = "api"; b.type = "button"; b.textContent = `API`;
    var rg = tabs.querySelector('[data-stab="rgpu"]');
    if (rg) rg.after(b); else tabs.appendChild(b);
    var pane = doc.createElement("div"); pane.className = "stab"; pane.id = "stab-api";
    pane.innerHTML = `<p class="hint help" style="margin:0 0 8px">Online services that render for you - no graphics card needed on this computer. `
      + `Add a service's API key, tick Use, and its API_ styles appear in the picture, video and song style lists. The service charges your account for each render. `
      + `The key is kept encrypted on this computer and only sent to that service.</p>`
      + `<div class="apiadd">`
      + `<div><label class="f" for="apiSvc">Service</label><select id="apiSvc"><option value="auto">Auto-detect from the key</option></select></div>`
      + `<div><label class="f" for="apiName">Name</label><input type="text" id="apiName" maxlength="40" spellcheck="false" placeholder="e.g. My OpenRouter"></div>`
      + `<div><label class="f" for="apiKey">API key</label><input type="password" id="apiKey" autocomplete="off" spellcheck="false" placeholder="Paste the key"></div>`
      + `<label class="chk" style="margin:0 0 6px" title="Make its API_ styles now"><input type="checkbox" id="apiUse" checked> Use</label>`
      + `<button type="button" id="apiAdd">+ Add</button>`
      + `</div>`
      + `<div class="hint" id="apiHint"></div><div class="hint" id="apiSay" aria-live="polite"></div>`
      + `<div id="apiList" style="margin-top:8px"></div>`;
    var all = dlg.querySelectorAll(".stab"); if (all.length) all[all.length - 1].after(pane); else tabs.after(pane);
    b.onclick = function () {
      dlg.querySelectorAll(".stabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
      doc.querySelectorAll(".stab").forEach(function (t) { t.classList.toggle("active", t.id === "stab-api"); });
      refresh();
    };
    $("apiKey").addEventListener("input", hint);
    $("apiSvc").addEventListener("change", hint);
    $("apiAdd").addEventListener("click", add);
    $("apiList").addEventListener("click", onClick);
    $("apiList").addEventListener("change", onChange);
  }
  function svcOf(id) { return S.services.filter(function (s) { return s.id === id; })[0] || null; }
  /** under the add row: what the key looks like, where to get one, what the service makes */
  function hint() {
    var sel = $("apiSvc").value, key = $("apiKey").value.trim();
    var id = sel === "auto" ? guess(key) : sel, s = svcOf(id), h = $("apiHint");
    if (!s) { h.textContent = sel === "auto" && key ? `Not a key shape bitGen knows - pick the service in the list.` : ""; return; }
    h.innerHTML = (sel === "auto" && key ? `Looks like ${esc(s.name)}. ` : "") + esc(s.note || "")
      + ` <a href="${esc(s.site)}" target="_blank" rel="noopener">Get a key</a>`;
    if (!$("apiName").value.trim() && key) $("apiName").placeholder = s.name;
  }
  function refresh() {
    return call("GET", "/api/apis").then(function (r) {
      S.apis = r.apis || []; S.services = r.services || [];
      var sel = $("apiSvc");
      if (sel && sel.options.length < 2) S.services.forEach(function (s) { var o = doc.createElement("option"); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
      paint(); return r;
    }).catch(function (e) { say(`Could not read the APIs: ${e.message}`, true); });
  }
  function kinds(a) { return (a.kinds || []).map(function (k) { return `<span>${esc(KW[k] || k)}</span>`; }).join("") + (a.can_llm ? `<span>LLM</span>` : ""); }
  function row(a) {
    var models = (a.kinds || []).map(function (k) {
      return `<label for="apim_${a.id}_${k}">${esc(KW[k] || k)}</label><input type="text" id="apim_${a.id}_${k}" data-model="${k}" spellcheck="false" value="${esc((a.models || {})[k] || "")}"`
        + (a.service === "runninghub" ? ` placeholder="workflow ID (the number in its address)"` : "") + ">";
    }).join("") + (a.can_llm ? `<label for="apim_${a.id}_llm">LLM</label><input type="text" id="apim_${a.id}_llm" data-model="llm" spellcheck="false" value="${esc((a.models || {}).llm || "")}">` : "");
    return `<div class="apirow${a.use ? " on" : ""}" data-api="${esc(a.id)}">`
      + `<div class="apihead"><label class="chk" style="margin:0" title="Use = its API_ styles are in the style lists"><input type="checkbox" data-act="use"${a.use ? " checked" : ""}> Use</label>`
      + `<span class="nm">${esc(a.name)}</span><span class="sv">${esc(a.service_name)}</span>`
      + `<span class="key">${a.has_key ? "key …" + esc(a.key_end) : "no key"}</span><span class="sp"></span>`
      + (a.can_llm ? `<label class="chk" style="margin:0" title="Every LLM call (the prompt LLM, captions, the shot list) goes to this service - one API at a time"><input type="checkbox" data-act="llm"${a.llm ? " checked" : ""}> Use for the LLM</label>` : "")
      + `<button type="button" class="ghost" data-act="test" title="Ask the service whether it takes the key">✓ Test</button>`
      + `<button type="button" class="ghost" data-act="del" title="Remove this API and its API_ styles">✕</button></div>`
      + `<div class="apikinds">${kinds(a)}</div>`
      + `<details class="apimore"><summary>Models and key</summary><div class="apimodels">${models}`
      + `<label for="apik_${a.id}">New key</label><input type="password" id="apik_${a.id}" data-key="1" autocomplete="off" spellcheck="false" placeholder="Leave blank to keep the key">`
      + `</div><button type="button" class="ghost" data-act="save">Save models and key</button>`
      + (a.site ? ` <a href="${esc(a.site)}" target="_blank" rel="noopener">${esc(a.service_name)} keys</a>` : "") + `</details>`
      + `<div class="apiline" data-line="1"></div></div>`;
  }
  function paint() {
    var L = $("apiList"); if (!L) return;
    L.innerHTML = S.apis.length ? S.apis.map(row).join("") : `<p class="hint">No APIs yet - add one above.</p>`;
  }
  function line(id, t, cls) { var r = doc.querySelector('#apiList [data-api="' + id + '"] [data-line]'); if (r) { r.textContent = t; r.className = "apiline" + (cls ? " " + cls : ""); } }
  /** the style lists everywhere see the new / removed API_ styles */
  function stylesChanged() {
    try { if (root.H3RunsOn && root.H3RunsOn.reload) root.H3RunsOn.reload(); } catch (e) { /* fine */ }
    try { if (typeof root.refreshStyles === "function") root.refreshStyles(); } catch (e) { /* fine */ }
    try { if (typeof root.refreshMusicStyles === "function") root.refreshMusicStyles(); } catch (e) { /* fine */ }
  }
  function made(r) {
    var n = (r.styles || []);
    return n.length ? `Styles: ${n.join(", ")}` : "";
  }
  function add() {
    if (S.busy) return;
    var key = $("apiKey").value.trim(), sel = $("apiSvc").value, svc = sel === "auto" ? guess(key) : sel;
    var name = $("apiName").value.trim() || (svcOf(svc) || {}).name || "";
    if (!key) { say(`Paste the API key first.`, true); return; }
    if (!svc) { say(`bitGen does not know this key's service - pick it in the list.`, true); return; }
    S.busy = true; say(`Adding…`);
    call("POST", "/api/apis", { service: svc, name: name, key: key, use: $("apiUse").checked }).then(function (r) {
      $("apiKey").value = ""; $("apiName").value = ""; $("apiHint").textContent = "";
      say(`Added ${r.api.name}.` + (made(r) ? " " + made(r) : "") + (r.api.llm ? " " + `The LLM now runs on ${r.api.service_name} (${r.api.models.llm}).` : ""));
      log("added " + r.api.name + " (" + r.api.service_name + ")" + (made(r) ? " - " + made(r) : ""));
      stylesChanged();
      return refresh();
    }).catch(function (e) { say(e.message, true); }).then(function () { S.busy = false; });
  }
  function onChange(ev) {
    var t = ev.target, box = t.closest("[data-api]"); if (!box || !t.dataset.act) return;
    var id = box.getAttribute("data-api"), body = {};
    body[t.dataset.act] = t.checked;
    t.disabled = true;
    call("POST", "/api/apis/" + id, body).then(function (r) {
      var i = S.apis.findIndex(function (a) { return a.id === id; }); if (i >= 0) S.apis[i] = r.api;
      if (t.dataset.act === "llm") S.apis.forEach(function (a) { if (a.id !== id && r.api.llm) a.llm = false; });
      paint();
      if (t.dataset.act === "use") { line(id, r.api.use ? (made(r) || `Use is on.`) : `Use is off - its API_ styles were removed.`, "ok"); stylesChanged(); }
      else line(id, r.api.llm ? `The LLM now runs on ${r.api.service_name} (${r.api.models.llm}).` : `The LLM is back on its own setting (Settings ▸ LLM / Remote generation).`, "ok");
    }).catch(function (e) { t.checked = !t.checked; t.disabled = false; line(id, e.message, "bad"); });
  }
  function onClick(ev) {
    var b = ev.target.closest("button[data-act]"); if (!b) return;
    var box = b.closest("[data-api]"), id = box.getAttribute("data-api"), a = S.apis.filter(function (x) { return x.id === id; })[0];
    if (b.dataset.act === "test") {
      b.disabled = true; line(id, `Asking ${a ? a.service_name : "the service"}…`);
      call("POST", "/api/apis/" + id + "/test").then(function (r) { line(id, r.ok ? "✓ " + r.line : "✗ " + r.error, r.ok ? "ok" : "bad"); })
        .catch(function (e) { line(id, "✗ " + e.message, "bad"); }).then(function () { b.disabled = false; });
    } else if (b.dataset.act === "del") {
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = `✕ Remove?`; setTimeout(function () { if (b.isConnected) { b.dataset.sure = ""; b.textContent = "✕"; } }, 4000); return; }
      call("DELETE", "/api/apis/" + id).then(function () { log("removed " + (a ? a.name : id)); stylesChanged(); return refresh(); }).catch(function (e) { line(id, e.message, "bad"); });
    } else if (b.dataset.act === "save") {
      var body = { models: {} };
      box.querySelectorAll("[data-model]").forEach(function (i) { body.models[i.dataset.model] = i.value.trim(); });
      var k = box.querySelector("[data-key]"); if (k && k.value.trim()) body.key = k.value.trim();
      call("POST", "/api/apis/" + id, body).then(function (r) {
        var i = S.apis.findIndex(function (x) { return x.id === id; }); if (i >= 0) S.apis[i] = r.api;
        paint(); line(id, `Saved.` + (body.key ? ` The new key is in use.` : "") + (made(r) ? " " + made(r) : ""), "ok"); stylesChanged();
      }).catch(function (e) { line(id, e.message, "bad"); });
    }
  }
  root.H3Apis = { refresh: refresh, guess: guess, state: S };
  if (doc && doc.readyState !== "loading") boot(); else if (doc) doc.addEventListener("DOMContentLoaded", boot);
})(typeof window !== "undefined" ? window : globalThis);

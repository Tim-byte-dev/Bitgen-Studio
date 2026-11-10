/* bitGen Studio — static/openrouter.js (2.753.0): Settings ▸ Remote generation ▸ 🧠 LLM ▸ OPENROUTER (window.H3OpenRouter,
 * lib/openRouter.js, routes/openRouter.js).
 * Tim (verbatim): "i am looking for some cheap or free sources so people aren't limited by their gpu" -> "lets add
 * openrouter to remote gpu, maybe change remote gpu to remote generation?"
 *   The 🧠 LLM section (static/remotegpu.js #rgVllm) gets "Runs on ◉ RunPod vLLM ◉ OpenRouter"; OpenRouter shows:
 *     the API key (kept encrypted - settings/keys.json), "Free models only", the LLM and the vision LLM (models that take
 *     pictures; blank = the LLM's when it does) from OpenRouter's list, 🔄, ✓ Test each, and what the free tier allows.
 *   Basic Settings ▸ GPU (static/gpusplit.js) decides when they are used: Both with LLM / Vision LLM ticked, or Remote.
 *   A change saves at once and fires document "h3:rgpu". */
(function (root) {
  "use strict";
  var doc = root.document, S = { v: null, models: [] };
  function $(id) { return doc.getElementById(id); }
  function el(tag, attrs, text) { var e = doc.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function say(t, ok) { var m = $("rgOrMsg"); if (m) { m.textContent = t || ""; m.style.color = ok === true ? "#7c7" : ok === false ? "#e66" : ""; } }
  function prov() { var r = doc.querySelector('input[name="rgLlmProv"]:checked'); return r ? r.value : "runpod"; }
  function build() {
    var box = $("rgVllm"); if (!box) return false;
    if ($("rgLlmProv")) return true;
    var head = box.querySelector("label.f"); if (head) head.textContent = "🧠 LLM";
    var g = el("div", { id: "rgLlmProv", class: "rowbtns", role: "radiogroup", "aria-label": "The LLM runs on", style: "align-items:center;margin:2px 0 6px" });
    [["runpod", "RunPod vLLM", "A RunPod Serverless endpoint running RunPod's vLLM worker (your model, paid while it runs)"],
     ["openrouter", "OpenRouter", "openrouter.ai - hundreds of models through one API key, some of them free; nothing to install"]].forEach(function (o) {
      var l = el("label", { class: "chk", title: o[2], style: "margin:0 12px 0 0" }), i = el("input", { type: "radio", name: "rgLlmProv", value: o[0] });
      l.appendChild(i); l.appendChild(doc.createTextNode(" " + o[1])); g.appendChild(l);
    });
    if (head && head.nextSibling) box.insertBefore(g, head.nextSibling); else box.appendChild(g);
    // RunPod's own rows: everything after the radios, as remotegpu.js built them
    Array.prototype.forEach.call(box.children, function (c) { if (c !== head && c !== g) c.classList.add("rgVrp"); });
    var or = el("div", { id: "rgOr" });
    or.innerHTML = '<div class="rowbtns" style="align-items:center"><input type="password" id="rgOrKey" spellcheck="false" autocomplete="off" placeholder="OpenRouter API key (openrouter.ai → Keys)" style="flex:1">'
      + '<label class="chk" style="margin:0;flex:none" title="List only the models OpenRouter offers free"><input type="checkbox" id="rgOrFree"> Free models only</label></div>'
      + '<div class="rowbtns" style="align-items:center;margin-top:4px"><label class="f" for="rgOrModel" style="margin:0;flex:none;min-width:84px">LLM</label><select id="rgOrModel" style="flex:1;min-width:200px"></select>'
      + '<button type="button" class="ghost" id="rgOrRefresh" title="Ask OpenRouter for its model list again" style="flex:none">🔄</button><button type="button" class="ghost" id="rgOrTest" style="flex:none">✓ Test</button></div>'
      + '<div class="rowbtns" style="align-items:center;margin-top:4px"><label class="f" for="rgOrVlm" style="margin:0;flex:none;min-width:84px">Vision LLM</label><select id="rgOrVlm" style="flex:1;min-width:200px"></select>'
      + '<button type="button" class="ghost" id="rgOrVtest" style="flex:none">✓ Test</button></div>'
      + '<div id="rgOrMsg" class="hint" aria-live="polite" style="margin-top:4px"></div>'
      + '<ul class="hint help" style="margin:6px 0 0;padding-left:18px">'
      + '<li>Make a free account and a key at openrouter.ai (Keys). Nothing to install - the studio sends the LLM\'s requests over the internet.</li>'
      + '<li>Free models: about 20 requests a minute and 50 a day; 1000 a day once the account has bought $10 of credits. Paid models show their price per million tokens.</li>'
      + '<li>The vision LLM must take pictures (marked 👁). Blank = the LLM, when it does.</li>'
      + '<li>Your prompts and pictures go to OpenRouter and the model\'s provider - keep private material on this computer.</li>'
      + '<li>Basic Settings ▸ GPU decides when they are used: Both with LLM / Vision LLM ticked, or Remote. It works without a remote GPU - pictures, videos and songs still render here.</li>'
      + '</ul>';
    box.appendChild(or);
    // RunPod vLLM until the saved choice loads (load() paints it) - never both parts at once
    g.querySelector('input[value="' + ((S.v && S.v.provider) || "runpod") + '"]').checked = true;
    paintProv();
    g.querySelectorAll("input").forEach(function (i) { i.onchange = function () { paintProv(); save({ provider: i.value }); }; });
    $("rgOrKey").addEventListener("change", function () { save({ key: $("rgOrKey").value }).then(function () { models(true); }); });
    $("rgOrFree").onchange = function () { save({ free_only: $("rgOrFree").checked }); paintModels(); };
    $("rgOrModel").onchange = function () { save({ model: $("rgOrModel").value }); };
    $("rgOrVlm").onchange = function () { save({ vlm_model: $("rgOrVlm").value }); };
    $("rgOrRefresh").onclick = function () { models(true); };
    $("rgOrTest").onclick = function () { test("llm"); }; $("rgOrVtest").onclick = function () { test("vlm"); };
    or.querySelectorAll("input,select").forEach(function (x) { x.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
    var tb = doc.querySelector('#settings .stabs [data-stab="rgpu"]'); if (tb) tb.addEventListener("click", load);
    return true;
  }
  function paintProv() {
    var p = prov();
    Array.prototype.forEach.call(doc.querySelectorAll("#rgVllm .rgVrp"), function (c) { c.style.display = p === "runpod" ? "" : "none"; });
    $("rgOr").style.display = p === "openrouter" ? "" : "none";
  }
  function label(m) { return (m.vision ? "👁 " : "") + m.name + (m.free ? " - free" : m.in != null ? " - $" + m.in + " / $" + m.out + " per M tokens" : ""); }
  function fill(sel, list, cur, blank) {
    sel.innerHTML = "";
    if (blank) sel.appendChild(el("option", { value: "" }, blank));
    var has = false;
    list.forEach(function (m) { var o = el("option", { value: m.id }, label(m)); o.title = m.id + (m.ctx ? " · " + m.ctx + " tokens" : ""); if (m.id === cur) has = true; sel.appendChild(o); });
    if (cur && !has) sel.appendChild(el("option", { value: cur }, cur + " (not in the list)"));
    sel.value = cur || "";
  }
  function paintModels() {
    var v = S.v || {}, free = $("rgOrFree").checked;
    var all = S.models.filter(function (m) { return !free || m.free; });
    if (!S.models.length) {
      fill($("rgOrModel"), [], v.model, v.key ? "(no list yet - 🔄)" : "(the API key first)");
      fill($("rgOrVlm"), [], v.vlm_model, "Same as the LLM (when it takes pictures)");
      return;
    }
    fill($("rgOrModel"), all, v.model, "Pick a model…");
    fill($("rgOrVlm"), all.filter(function (m) { return m.vision; }), v.vlm_model, "Same as the LLM (when it takes pictures)");
  }
  function models(refresh) {
    say("asking OpenRouter for its models…");
    return root.fetch("/api/openrouter/models" + (refresh ? "?refresh=1" : "")).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) { say("✗ " + j.error, false); return; }
      S.models = j.models || []; paintModels();
      var nf = S.models.filter(function (m) { return m.free; }).length;
      var mm = $("rgOrMsg"); mm.style.color = ""; mm.textContent = S.models.length + " models · " + nf + " free";
    }).catch(function () { say("✗ OpenRouter could not be reached", false); });
  }
  function paint() {
    var v = S.v; if (!v || !$("rgOr")) return;
    var r = doc.querySelector('input[name="rgLlmProv"][value="' + v.provider + '"]'); if (r) r.checked = true;
    if (doc.activeElement !== $("rgOrKey")) $("rgOrKey").value = v.key || "";
    $("rgOrFree").checked = v.free_only !== false;
    paintProv(); paintModels();
  }
  function load() {
    return root.fetch("/api/openrouter").then(function (r) { return r.json(); }).then(function (v) {
      if (!v || v.error) return v;
      S.v = v; paint();
      if (v.key && !S.models.length && prov() === "openrouter") models(false);
      return v;
    }).catch(function () { /* offline */ });
  }
  function save(b) {
    return post("/api/openrouter", b).then(function (v) {
      if (v && !v.error) { S.v = v; paint(); }
      try { doc.dispatchEvent(new Event("h3:rgpu")); } catch (e) { /* fine */ }
      return v;
    });
  }
  function test(kind) {
    say("asking OpenRouter…");
    post("/api/openrouter/test", { kind: kind }).then(function (r) {
      say(r.ok ? "✓ " + (kind === "vlm" ? "Vision LLM: " : "LLM: ") + (r.model || "-") + " · " + r.line : "✗ " + r.error, !!r.ok);
    });
  }
  function boot() {
    if (!build()) { setTimeout(boot, 400); return; }
    load();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3OpenRouter = { load: load, models: models, state: function () { return S; } };
})(typeof window !== "undefined" ? window : globalThis);

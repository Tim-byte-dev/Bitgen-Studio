/* bitGen Studio — static/orcost.js (2.786.0): THE PRICE BEFORE A PAID OPENROUTER RENDER (window.H3OrCost; POST /api/ormodels/check -
 * lib/orRender.js check, lib/orModels.js estimate).
 *
 * The agreed design (Tim said "go"): "price shown before a paid render + 💲 Costs". Every POST that starts a picture or a video
 * in this page (/api/genimage, /api/generate - the prompt docker, the image editor, the StoryBoard …) is looked at first: an
 * "openrouter/<id>" model in it (Basic Settings ▸ Model) or ☁ Runs on ▸ Image / Video = OpenRouter -> the box:
 *     Render on OpenRouter - <model>  ·  about $0.12 (3 s × $0.04 a second)  ·  OpenRouter does not take: steps, CFG …
 *     [ Render ]  [ Cancel ]   ☐ Don't ask again for 10 minutes
 *   Cancel = 409 {error, cancelled} to the caller (no render). A free model = no box. The check failing = the render is sent
 *   (the studio refuses it itself if something is missing). The cost is kept in 💲 Costs ▸ OpenRouter once OpenRouter says it.
 * Pure (Node: scripts/test-ormodels786.js): reqOf, boxText.
 */
(function (root) {
  "use strict";
  var RENDERS = { "/api/genimage": "image", "/api/generate": "video" };
  function field(body, k) {
    if (!body) return undefined;
    if (typeof FormData !== "undefined" && body instanceof FormData) { var v = body.get(k); return v == null || typeof v !== "string" ? undefined : v; }
    return body[k];
  }
  /** the check's request from a render request (pure) -> {kind, model, n, seconds, w, h} | null (a body this cannot read) */
  function reqOf(kind, raw) {
    var body = raw;
    if (typeof raw === "string") { try { body = JSON.parse(raw); } catch (e) { return null; } }
    else if (!(typeof FormData !== "undefined" && raw instanceof FormData) && !(raw && typeof raw === "object")) return null;
    if (!body || typeof body !== "object") return null;
    var f = function (k) { return field(body, k); };
    if (kind === "video") {
      var b = f("basic"), m = "";
      if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
      if (b && (b.override === true || b.override === "true")) m = String(b.model || "");
      return { kind: "video", model: m, seconds: (parseInt(f("frames"), 10) || 120) / 24, w: +f("width") || 0, h: +f("height") || 0 };
    }
    return { kind: "image", model: String(f("model") || ""), n: +f("batch") || 1, w: +f("width") || 0, h: +f("height") || 0 };
  }
  /** the box's words (pure) - c = the check's answer */
  function boxText(c) {
    var e = c.estimate || {};
    return { title: "Render on OpenRouter - " + (c.name || c.id),
      cost: e.text || c.price || "paid",
      why: c.why ? "Because: " + c.why + "." : "",
      ignored: c.ignored && c.ignored.length ? "OpenRouter does not take Basic Settings' " + c.ignored.join(", ") + " - the model decides them." : "" };
  }
  var pure = { reqOf: reqOf, boxText: boxText, RENDERS: RENDERS };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = pure; return; }

  var doc = root.document, quietUntil = 0;
  var realFetch = root.fetch ? root.fetch.bind(root) : null;
  // the studio decides (Runs on may have changed in another window) - the check is local and quick, nothing goes to OpenRouter
  function maybeOr(q) { return !!q; }
  function ask(c) {
    return new Promise(function (done) {
      var t = boxText(c), d = doc.createElement("dialog");
      d.className = "orCostDlg"; d.id = "orCostDlg";
      d.style.cssText = "max-width:min(520px,92vw);padding:14px 16px";
      d.innerHTML = '<h3 style="margin:0 0 8px;font-size:1rem"></h3><div class="orc" style="font-size:1.05rem;font-weight:600;margin:4px 0"></div>'
        + '<div class="hint orw" style="margin:4px 0"></div><div class="hint ori" style="margin:4px 0"></div>'
        + '<label class="chk" style="display:flex;gap:6px;align-items:center;font-size:.78rem;margin:8px 0"><input type="checkbox" id="orCostQuiet"> Don\'t ask again for 10 minutes</label>'
        + '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="go" id="orCostGo">Render</button><button type="button" class="ghost" id="orCostNo">Cancel</button></div>';
      d.querySelector("h3").textContent = t.title;
      d.querySelector(".orc").textContent = t.cost;
      d.querySelector(".orw").textContent = t.why;
      d.querySelector(".ori").textContent = t.ignored;
      doc.body.appendChild(d);
      var end = function (go) { if (go && d.querySelector("#orCostQuiet").checked) quietUntil = Date.now() + 600000; try { d.close(); } catch (e) { /* closed */ } d.remove(); done(go); };
      d.querySelector("#orCostGo").onclick = function () { end(true); };
      d.querySelector("#orCostNo").onclick = function () { end(false); };
      d.addEventListener("cancel", function (e) { e.preventDefault(); end(false); });
      d.addEventListener("keydown", function (e) { e.stopPropagation(); });
      try { d.showModal(); } catch (e) { d.setAttribute("open", ""); }
      d.querySelector("#orCostGo").focus();
    });
  }
  function check(q) {
    return realFetch("/api/ormodels/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) })
      .then(function (r) { return r.json(); }).catch(function () { return null; });
  }
  /** ask(q) -> Promise<true = render, false = don't> - also for callers that want to ask themselves */
  function ensure(q) {
    if (!maybeOr(q)) return Promise.resolve(true);
    return check(q).then(function (c) {
      if (!c || !c.openrouter || c.error) return true;           // not OpenRouter / the studio says what is missing
      if (c.free || Date.now() < quietUntil) return true;
      return ask(c);
    });
  }
  function wrap(win) {
    if (!win || !win.fetch || win.fetch.__h3orc) return;
    var orig = win.fetch.bind(win);
    var w = function (input, init) {
      var q = null;
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        var method = String((init && init.method) || (input && typeof input !== "string" && input.method) || "GET").toUpperCase();
        var kind = method === "POST" ? RENDERS[new URL(url, (win.location && win.location.href) || "http://localhost/").pathname] : null;
        if (kind) q = reqOf(kind, init && init.body);
      } catch (e) { q = null; }
      if (!q) return orig(input, init);
      return ensure(q).then(function (go) {
        if (go) return orig(input, init);
        return new Response(JSON.stringify({ error: "Not rendered - the OpenRouter render was cancelled (it is paid).", cancelled: true }), { status: 409, headers: { "Content-Type": "application/json" } });
      });
    };
    w.__h3orc = true;
    win.fetch = w;
  }
  if (root.fetch && typeof root.Response !== "undefined") wrap(root);
  root.H3OrCost = Object.assign({ ensure: ensure, wrap: wrap }, pure);
})(typeof window !== "undefined" ? window : globalThis);

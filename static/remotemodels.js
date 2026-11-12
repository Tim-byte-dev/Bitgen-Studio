/* bitGen Studio — static/remotemodels.js (2.766.0): MODEL MANAGER IN REMOTE MODE - the models your pods use
 * (runpod/pods/remote_models.json, lib/remoteModels.js). window.H3RemoteModels (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "add a remote_models.json in our pods folder ... these will be the models listed in remote mode in model
 * manager and the overide settings dropdowns instead of the local models. if user has a model/lora on their hdd without a
 * link. user can search for it in model manager and it will upload to the selected pod" + "go with your suggestions and add
 * a progress bar for each transfer to the pod"
 *
 *   bar(host, ctx)    above Model manager's cards in remote mode: what this list is, the pods ticked in PODS ▸ My pods
 *                     ("Send to"), and
 *     ＋ From this computer…  search this computer's models + LoRAs; ⇪ Add: found on Civitai (the same SHA-256) = its link;
 *                     else put in your private Hugging Face repo once (a token that can write); else sent straight to each
 *                     ticked pod - then each ticked pod downloads it (a progress bar each, static/podxfer.js)
 *     ＋ Link…        a Hugging Face / Civitai / any download link + the ComfyUI folder it goes in
 *     ↻ My styles' models   the files of the styles your pods use, from bitGen's download list
 *   send(id) / del(id)   the cards' ⇪ / ✕
 *   Remote mode switched (Basic Settings) -> the page's model lists (Basic Settings' combos, Model manager) are read again.
 * Pure (Node: scripts/test-remotemodels766.js): sendTo, localMatches.
 */
(function (root) {
  "use strict";
  var FOLDERS = ["checkpoints", "diffusion_models", "unet", "loras", "vae", "text_encoders", "clip", "clip_vision", "controlnet", "upscale_models", "embeddings"];
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /** "Send to: A, B" (pure) */
  function sendTo(sel) { var s = (sel || []).map(function (p) { return p.name || p.id; }); return s.length ? "Send to: " + s.join(", ") : "No pods ticked - tick them (☐ beside each pod's name) in PODS ▸ My pods"; }
  /** this computer's cards matching a search, models first, 40 at most (pure) */
  function localMatches(cards, q) {
    var w = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (cards || []).filter(function (c) { var h = [c.title, c.name, c.family_label].join(" ").toLowerCase(); return w.every(function (x) { return h.indexOf(x) >= 0; }); })
      .sort(function (a, b) { return (a.kind === b.kind ? 0 : a.kind === "model" ? -1 : 1) || String(a.title).localeCompare(String(b.title)); }).slice(0, 40);
  }
  var api = { FOLDERS: FOLDERS, sendTo: sendTo, localMatches: localMatches };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  var doc = root.document;
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b, m) { return root.fetch(u, { method: m || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  var CSS = ".mmremote{display:flex;flex-direction:column;gap:6px;margin:4px 0 6px;padding:7px 9px;border:1px solid var(--tiger,#f59e2c);border-radius:8px;background:rgba(245,158,44,.06)}"
    + ".mmremote .rmHd{font-size:.76rem;line-height:1.35}.mmremote .rmTo{font-size:.72rem;color:var(--dim,#9a917f)}.mmremote .rmBtns{display:flex;gap:6px;flex-wrap:wrap}"
    + ".mmremote .rmPanel{display:flex;flex-direction:column;gap:5px}.mmremote .rmRow{display:flex;gap:6px;align-items:center;font-size:.74rem;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05)}"
    + ".mmremote .rmRow span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mmremote .rmRow small{color:var(--dim,#9a917f)}.mmremote .rmForm{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;font-size:.74rem}"
    + ".mmremote .rmMsg{font-size:.72rem;min-height:1em}.mmremote .rmMsg.bad{color:#e88}.mmremote .rmMsg.ok{color:#8d8}";
  function css() { if (!doc.getElementById("rmCss")) { var s = doc.createElement("style"); s.id = "rmCss"; s.textContent = CSS; doc.head.appendChild(s); } }
  var local = null;   // this computer's cards (for ＋ From this computer)
  function bar(host, ctx) {
    if (!host) return;
    css();
    var c = ctx || {};
    if (!host.dataset.rmBuilt) {
      host.dataset.rmBuilt = "1";
      host.innerHTML = '<div class="rmHd">☁ <b>Remote mode</b> - the models your pods use (runpod/pods/remote_models.json). This computer\'s models are not listed here or in Basic Settings while remote generation uses pods.</div>'
        + '<div class="rmTo" data-rmto></div>'
        + '<div class="rmBtns"><button type="button" class="ghost" data-rmlocal title="Search this computer\'s models and LoRAs - one without a link goes up once (Civitai\'s link if it is there, else your private Hugging Face repo) and the ticked pods download it">＋ From this computer…</button>'
        + '<button type="button" class="ghost" data-rmlink title="A Hugging Face / Civitai / any download link">＋ Link…</button>'
        + '<button type="button" class="ghost" data-rmfill title="The files of the styles your pods use (linked to a pod, in a preset) from bitGen\'s download list">↻ My styles\' models</button></div>'
        + '<div class="rmPanel" data-rmpanel></div><div class="rmMsg" data-rmmsg aria-live="polite"></div><div data-rmxfer></div>';
      host.querySelector("[data-rmlocal]").onclick = function () { panel(host, "local", c); };
      host.querySelector("[data-rmlink]").onclick = function () { panel(host, "link", c); };
      host.querySelector("[data-rmfill]").onclick = function () {
        msg(host, "adding the files of your pods' styles…");
        post("/api/remotemodels/fill", {}).then(function (j) { if (j.error) { msg(host, j.error, "bad"); return; } msg(host, j.added ? j.added + " added" : "they are all in the list", "ok"); if (c.reload) c.reload(); });
      };
      if (root.H3PodXfer) root.H3PodXfer.mount(host.querySelector("[data-rmxfer]"));
    }
    getj("/api/pods/selected").then(function (j) { var t = host.querySelector("[data-rmto]"); if (t) t.textContent = sendTo((j && j.selected) || []); }).catch(function () { /* fine */ });
  }
  function msg(host, t, cls) { var m = host.querySelector("[data-rmmsg]"); if (m) { m.textContent = t || ""; m.className = "rmMsg" + (cls ? " " + cls : ""); } }
  function panel(host, which, c) {
    var p = host.querySelector("[data-rmpanel]");
    if (p.dataset.open === which) { p.dataset.open = ""; p.innerHTML = ""; return; }
    p.dataset.open = which;
    if (which === "link") {
      p.innerHTML = '<form class="rmForm" data-rmlf><label for="rmLUrl">Link</label><input id="rmLUrl" placeholder="https://huggingface.co/…/resolve/main/x.safetensors or a Civitai download link" spellcheck="false">'
        + '<label for="rmLFolder">Folder</label><select id="rmLFolder">' + FOLDERS.map(function (f) { return "<option>" + f + "</option>"; }).join("") + "</select>"
        + '<label for="rmLName">File name</label><input id="rmLName" placeholder="from the link">'
        + '<label for="rmLLabel">Label</label><input id="rmLLabel" placeholder="Krea raw">'
        + '<label for="rmLGroup">Group</label><input id="rmLGroup" placeholder="Krea">'
        + '<span></span><span><button type="submit">＋ Add</button></span></form>';
      p.querySelectorAll("input,select").forEach(function (x) { x.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
      p.querySelector("[data-rmlf]").onsubmit = function (e) {
        e.preventDefault();
        post("/api/remotemodels/link", { url: p.querySelector("#rmLUrl").value.trim(), folder: p.querySelector("#rmLFolder").value, name: p.querySelector("#rmLName").value.trim(), label: p.querySelector("#rmLLabel").value.trim(), group: p.querySelector("#rmLGroup").value.trim() }).then(function (j) {
          if (j.error) { msg(host, j.error, "bad"); return; }
          msg(host, "✓ " + j.entry.label + " is in the list - ⇪ on its card sends it to the ticked pods", "ok"); p.dataset.open = ""; p.innerHTML = ""; if (c.reload) c.reload();
        });
      };
      return;
    }
    p.innerHTML = '<input type="search" data-rmq placeholder="Search this computer\'s models and LoRAs…" aria-label="Search this computer\'s models"><div data-rmlist><div class="rmRow"><span>reading this computer\'s model folders…</span></div></div>';
    var q = p.querySelector("[data-rmq]"), list = p.querySelector("[data-rmlist]");
    q.addEventListener("keydown", function (e) { e.stopPropagation(); });
    var draw = function () {
      var m = localMatches(local || [], q.value);
      list.innerHTML = m.length ? m.map(function (x) { return '<div class="rmRow"><span title="' + esc(x.cat + "/" + x.name) + '">' + (x.kind === "lora" ? "🎛 " : "🧩 ") + esc(x.title) + " <small>" + esc(x.cat + "/" + x.name) + "</small></span>"
        + '<button type="button" class="ghost" data-rmadd="' + esc(x.cat) + '" data-rmname="' + esc(x.name) + '" title="Into the list and onto the ticked pods - Civitai\'s link if it is there, else your private Hugging Face repo (once), else straight to each pod">⇪ Add</button></div>'; }).join("")
        : '<div class="rmRow"><span>nothing matches</span></div>';
      list.querySelectorAll("[data-rmadd]").forEach(function (b) {
        b.onclick = function () {
          b.disabled = true;
          post("/api/remotemodels/local", { cat: b.dataset.rmadd, name: b.dataset.rmname }).then(function (j) {
            if (j.error) { b.disabled = false; msg(host, j.error, "bad"); return; }
            msg(host, "⇪ " + j.name + ": looking for it on Civitai, else your Hugging Face repo - the bars below show it" + (j.pods && j.pods.length ? "; then " + j.pods.length + " pod(s) download it" : "; no pods ticked - it goes in the list only"), "ok");
            if (root.H3PodXfer) root.H3PodXfer.poke();
            setTimeout(function () { if (c.reload) c.reload(); }, 4000);
          });
        };
      });
    };
    var t = null; q.addEventListener("input", function () { clearTimeout(t); t = setTimeout(draw, 120); });
    if (local) draw();
    else getj("/api/modelmgr/cards?local=1").then(function (d) { local = ((d && d.models) || []).concat((d && d.loras) || []); draw(); }).catch(function () { list.innerHTML = '<div class="rmRow"><span>could not read this computer\'s model folders</span></div>'; });
  }
  function send(id, say) {
    return post("/api/remotemodels/" + encodeURIComponent(id) + "/send", {}).then(function (j) {
      if (j.error) { if (say) say(j.error, "bad"); return j; }
      if (say) say("⇪ " + j.sending.length + " pod(s) downloading it - the bars show it", "ok");
      if (root.H3PodXfer) root.H3PodXfer.poke();
      return j;
    });
  }
  function del(id, say) {
    return post("/api/remotemodels/" + encodeURIComponent(id), {}, "DELETE").then(function (j) { if (j.error && say) say(j.error, "bad"); else if (say) say("✕ off the list (the pods keep their copy)", "ok"); return j; });
  }
  /* remote mode switched in Basic Settings: the page's model lists again */
  var mode = null;
  function watch() {
    getj("/api/remotemodels/mode").then(function (j) {
      var m = !!(j && j.pods_mode);
      if (mode !== null && m !== mode) {
        if (typeof root.loadComfyModels === "function") try { root.loadComfyModels(true); } catch (e) { /* fine */ }
        if (root.H3ModelMgr && root.H3ModelMgr.load) try { root.H3ModelMgr.load(); } catch (e) { /* fine */ }
        local = null;
      }
      mode = m;
    }).catch(function () { /* the server is restarting */ }).then(function () { setTimeout(watch, 5000); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", watch); else watch();
  root.H3RemoteModels = Object.assign({ bar: bar, send: send, del: del, mode: function () { return mode; } }, api);
})(typeof window !== "undefined" ? window : globalThis);

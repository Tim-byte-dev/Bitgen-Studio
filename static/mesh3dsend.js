/* bitGen Studio — 🧊 a picture -> a 3D model (2.404.0), window.Mesh3DSend.
 *
 * Tim (verbatim): "can we add option 1 + the image to workflow?" - and asked where the pictures come from: "Both" (the
 * scene plan's own, and any picture sent by hand). A 🧊 on every picture in the Gallery (Images) and the Assets dock
 * (Images) asks which engine - Hunyuan3D 2.1 (the shape) or TRELLIS.2 (textured) - and queues the job (POST /api/mesh3d,
 * mesh3d_worker.py). The .glb lands in the project's models3d/: the .blend preview's ＋ Model, the AI scene builder
 * and the timeline's 🧊 3D layers all find it there. */
(function () {
  "use strict";
  var KEY = "mesh3d.engine";
  function engine() { try { return localStorage.getItem(KEY) || "auto"; } catch (e) { return "auto"; } }
  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* fine */ } }
  function say(s) { try { if (typeof logLine === "function") logLine("[3D] " + s); } catch (e) { /* fine */ } }

  function send(name, where, eng) {
    return fetch("/api/mesh3d", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, where: where || "", engine: eng || engine() }) })
      .then(function (r) { return r.json().then(function (x) { if (!r.ok) throw new Error(x.error || r.status); return x; }); })
      .then(function (job) {
        say("🧊 " + name + " -> models3d/" + job.model + " (job " + job.id + ")");
        if (typeof refreshJobs === "function") { try { refreshJobs(); } catch (e) { /* fine */ } }
        return job;
      });
  }
  var menu = null;
  function closeMenu() { if (menu && menu.parentNode) menu.parentNode.removeChild(menu); menu = null; }
  function ask(btn, name, where) {
    closeMenu();
    menu = document.createElement("div");
    menu.id = "mesh3dMenu";
    menu.style.cssText = "position:fixed;z-index:9999;background:var(--panel,#222);border:1px solid var(--line,#444);border-radius:6px;"
      + "padding:6px;display:flex;flex-direction:column;gap:4px;font-size:.75rem;box-shadow:0 4px 18px rgba(0,0,0,.5)";
    var r = btn.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(window.innerWidth - 240, r.left)) + "px";
    menu.style.top = Math.min(window.innerHeight - 120, r.bottom + 4) + "px";
    menu.innerHTML = '<div style="opacity:.8">🧊 Make a 3D model of ' + String(name).replace(/[<&]/g, "") + '</div>'
      + '<button class="ghost" type="button" data-e="auto" title="The shape (grey) - quick; 3DREAL paints the real look">Hunyuan3D 2.1 - shape</button>'
      + '<button class="ghost" type="button" data-e="trellis" title="Shape + baked texture - slower, needs the TRELLIS.2 files">TRELLIS.2 - textured</button>'
      + '<button class="ghost" type="button" data-e="">Cancel</button>';
    document.body.appendChild(menu);
    Array.prototype.forEach.call(menu.querySelectorAll("button"), function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        var e = b.dataset.e; closeMenu();
        if (!e && e !== "auto") return;
        remember(e);
        send(name, where, e).catch(function (er) { alert("3D model: " + (er.message || er)); });
      };
    });
    setTimeout(function () { document.addEventListener("click", closeMenu, { once: true }); }, 0);
  }
  function addButton(el, where, cls) {
    if (!el || el.querySelector(".gmesh3d")) return;
    var name = el.dataset.lbName || el.dataset.name;
    if (!name) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "gmesh3d " + (cls || ""); b.textContent = "🧊";
    b.title = "Make a 3D model of this picture (Hunyuan3D / TRELLIS.2 in ComfyUI) -> models3d/ (the .blend preview's ＋ Model)";
    b.setAttribute("aria-label", "Make a 3D model");
    b.draggable = false;
    b.onclick = function (ev) { ev.stopPropagation(); ev.preventDefault(); ask(b, name, where); };
    el.appendChild(b);
  }
  function scan(root) {
    var r = root && root.querySelectorAll ? root : document;
    Array.prototype.forEach.call(r.querySelectorAll('.thumb[data-lb-kind="image"]'), function (el) { addButton(el, "output", "gm-gal"); });
    Array.prototype.forEach.call(r.querySelectorAll('.aitem[data-lb-kind="image"]'), function (el) { addButton(el, "images", "gm-asset"); });
  }
  function boot() {
    if (!document.getElementById("mesh3dCss")) {
      var css = document.createElement("style"); css.id = "mesh3dCss";
      css.textContent = ".thumb{position:relative}.aitem{position:relative}"
        + ".gmesh3d{position:absolute;padding:0 4px;font-size:.72rem;line-height:1.4;z-index:2;opacity:.75;cursor:pointer;"
        + "background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.2);border-radius:4px;color:#fff}"
        + ".gmesh3d:hover{opacity:1}.gm-gal{top:4px;left:4px}.gm-asset{top:2px;right:2px}";
      document.head.appendChild(css);
    }
    scan(document);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) for (var k = 0; k < ms[i].addedNodes.length; k++) {
        var n = ms[i].addedNodes[k];
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches('.thumb[data-lb-kind="image"]')) addButton(n, "output", "gm-gal");
        else if (n.matches && n.matches('.aitem[data-lb-kind="image"]')) addButton(n, "images", "gm-asset");
        else scan(n);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.Mesh3DSend = { send: send, scan: scan };
})();

/* bitGen Studio — static/comfydetect.js (2.622.0): Settings ▸ ComfyUI ▸ Folder - "ComfyUI found at … · Use this folder".
 * Tim (verbatim): "if comfyui is installed add the diffusion models and checkpoint folder models to our model list in
 * basic settings and the model manager"
 * The lists already take the ComfyUI found on this computer when the folder is empty (lib/comfyDetect.js); this line says
 * which one it is and sets it as the folder in one click (POST /api/comfy/detect/use). Shown while the folder is empty. */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  function paint() {
    const inp = $("s_cdir"); if (!inp) return;
    let box = $("s_cdetect");
    if (!box) { box = doc.createElement("div"); box.id = "s_cdetect"; box.className = "hint"; box.style.cssText = "margin:4px 0 6px;display:none"; const row = inp.closest(".pickrow") || inp; row.parentNode.insertBefore(box, row.nextSibling); }
    if (inp.value.trim()) { box.style.display = "none"; return; }
    fetch("/api/comfy/detect").then((r) => r.json()).then((j) => {
      const f = j && j.found;
      if (!f || f.configured || inp.value.trim()) { box.style.display = "none"; return; }
      box.innerHTML = "";
      box.appendChild(doc.createTextNode("🔎 ComfyUI found: " + f.root + " (" + f.source + ") - its checkpoints and diffusion models are in the model lists already. "));
      if (f.kind !== "desktop") {
        const b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.id = "s_cdetectUse"; b.textContent = "Use this folder"; b.style.cssText = "padding:0 8px";
        b.title = "Set it as the ComfyUI folder (saved now) - bitGen can then start it and its node packs are checked";
        b.onclick = () => fetch("/api/comfy/detect/use", { method: "POST" }).then((r) => r.json()).then((k) => {
          if (k.error) { box.textContent = "⚠ " + k.error; return; }
          inp.value = k.dir; inp.dispatchEvent(new Event("change", { bubbles: true })); box.textContent = "✓ ComfyUI folder: " + k.dir;
        });
        box.appendChild(b);
      }
      box.style.display = "block";
    }).catch(() => { box.style.display = "none"; });
  }
  function boot() {
    const inp = $("s_cdir"); if (!inp) { setTimeout(boot, 500); return; }
    try { new root.IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) paint(); }).observe(inp); } catch (e) { /* no observer: on input only */ }
    inp.addEventListener("input", paint); inp.addEventListener("change", paint);
  }
  root.H3ComfyDetect = { paint };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(window);

/* bitGen Studio — comfydock's OWN code (2.223.14, by instruction: "anything
   that is shared among extensions should be core" — and nothing here is: the
   painter and the toolbar buttons touch only this docker's elements). The
   core status loop and the show/hide toggle call window.comfyDockPaint when
   it exists — remove this folder and they no-op, the app runs on. Shared
   state (cfg, comfyReachable — set by the core's comfyPaint) is read at call
   time through the page's global scope, never duplicated here. */
(function () {
  function $(id) { return document.getElementById(id); }

function comfyDockPaint() {
  const f = $("comfyframe"); const d = $("comfydown");
  if (!f || !d) return;
  const dock = $("comfydock");
  const open = dock && !dock.classList.contains("collapsed");
  const url = (cfg && cfg.engine && cfg.engine.comfy && cfg.engine.comfy.url) || "http://127.0.0.1:8188";
  if ($("cfnote")) $("cfnote").textContent = comfyReachable ? url : "not running";
  if (!comfyReachable) {
    f.classList.add("hidden"); d.classList.remove("hidden");
    d.textContent = "ComfyUI is not reachable at " + url
      + ". Start it in Settings \u2192 ComfyUI (or press \u21bb once it is up).";
    return;
  }
  d.classList.add("hidden"); f.classList.remove("hidden");
  // THE SRC IS SET LAZILY, and only once: assigning it again would reload
  // ComfyUI's whole frontend and throw away an unsaved canvas.
  if (open && f.getAttribute("src") !== url) f.setAttribute("src", url);
}

if ($("cfReload")) $("cfReload").onclick = () => {
  const f = $("comfyframe");
  if (f) f.removeAttribute("src");
  comfyDockPaint();
};

if ($("cfOpen")) $("cfOpen").onclick = () => {
  const url = (cfg && cfg.engine && cfg.engine.comfy && cfg.engine.comfy.url) || "http://127.0.0.1:8188";
  window.open(url, "_blank", "noopener");
};

window.comfyDockPaint = comfyDockPaint;
})();

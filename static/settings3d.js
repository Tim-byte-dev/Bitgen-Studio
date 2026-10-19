/* bitGen Studio — static/settings3d.js (2.471.0): Settings ▸ 3D - the engine for the parametric 3D bodies (and room for
 * more 3D settings: Settings3D.addSection), window.Settings3D.
 *
 * Tim (verbatim): "in settings give user option for 1 and 3, use the option the user selects but add both 1 and 3":
 *   ◉ In the browser (OpenCascade)   exact solids in the page (static/body3docc.js) - nothing else to install
 *   ○ Blender (on this computer)     the body built by Blender headless (lib/body3d.js) - the Blender the timeline's
 *                                    🟧 settings point at; "found / not found" beside it
 * Saved on the server (config.body3d - /api/body3d/settings); the image editor and the timeline read it.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  const sections = [];
  function boot() {
    const dlg = $("settings"), tabs = dlg && dlg.querySelector(".stabs");
    if (!tabs) return;
    if ($("stab-3d")) return;
    const b = document.createElement("button"); b.dataset.stab = "3d"; b.textContent = "3D"; b.type = "button";
    tabs.appendChild(b);
    const pane = document.createElement("div"); pane.className = "stab"; pane.id = "stab-3d";
    pane.innerHTML = '<p class="hint help" style="margin:0 0 8px">The <b>parametric 3D bodies</b> (Extrude, Revolve, Fillet, Chamfer, Split, Shell on a sketch - '
      + "the image editor's SOLID tab) are worked out by one of two engines. Both give the same body; pick the one you prefer.</p>"
      + '<label class="f">3D body engine</label>'
      + '<div class="rowbtns" style="flex-direction:column;align-items:flex-start;gap:4px">'
      + '<label><input type="radio" name="s_b3eng" value="occ" id="s_b3occ"> <b>In the browser (OpenCascade)</b> <span class="hint">- exact solids, nothing to install; the first build loads it (a second or two)</span></label>'
      + '<label><input type="radio" name="s_b3eng" value="blender" id="s_b3bl"> <b>Blender (on this computer)</b> <span class="hint" id="s_b3blinfo">- …</span></label>'
      + "</div><div id=\"s_b3more\"></div>";
    const all = dlg.querySelectorAll(".stab"); if (all.length) all[all.length - 1].after(pane); else tabs.after(pane);
    b.onclick = () => {
      dlg.querySelectorAll(".stabs button").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll(".stab").forEach((t) => t.classList.toggle("active", t.id === "stab-3d"));
      load();
    };
    pane.querySelectorAll('input[name="s_b3eng"]').forEach((r) => {
      r.onchange = () => {
        const e = r.value;
        (window.Body3D ? window.Body3D.setEngine(e) : fetch("/api/body3d/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: e }) }).then((x) => x.json()))
          .then(() => { if (typeof window.toast === "function") window.toast("3D body engine: " + (e === "blender" ? "Blender" : "OpenCascade (in the browser)")); });
      };
    });
    sections.forEach((s) => mount(s));
    load();
  }
  function load() {
    fetch("/api/body3d/settings").then((r) => r.json()).then((j) => {
      const occ = $("s_b3occ"), bl = $("s_b3bl"); if (!occ) return;
      (j.engine === "blender" ? bl : occ).checked = true;
      $("s_b3blinfo").textContent = j.blender && j.blender.found ? "- " + j.blender.path : "- Blender was not found (set its path in the timeline's 🟧 Blender settings)";
    }).catch(() => {});
    sections.forEach((s) => { try { if (s.load) s.load(); } catch (e) { /* a section never breaks the tab */ } });
  }
  function mount(s) { const host = $("s_b3more"); if (!host || s.el) return; s.el = document.createElement("div"); s.el.innerHTML = s.html; host.appendChild(s.el); try { if (s.init) s.init(s.el); } catch (e) { /* fine */ } }
  /** another 3D setting (the Unreal bridge …): {html, init(el), load()} */
  function addSection(s) { sections.push(s); mount(s); }
  window.Settings3D = { addSection, load, open: () => { const o = $("openSettings"); if (o) o.click(); setTimeout(() => { const b = document.querySelector('#settings .stabs [data-stab="3d"]'); if (b) b.click(); }, 50); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

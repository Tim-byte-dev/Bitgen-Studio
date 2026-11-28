/* bitGen Studio — ext/pushpulldock/ppdetail.js (3.7.0): 💎 FINE DETAIL in the Sketcher (window.H3Detail) - Direct3D-V3 carves
 * fine detail into a rough 3D model of a picture. Tim: "can you add this to sketcher. https://dreamtechai.github.io/Direct3D-V3/"
 *
 * The dialog: the picture (H3PicPick - gallery, assets, references, a folder, a file) + the rough model - "✨ make it from the
 * picture first" (🧊 Convert to 3D: POST /api/mesh3d, Hunyuan3D 2.1, the same way round as the picture - what Direct3D-V3 wants)
 * or one of the project's 3D models - + Detail 512 / 1024 / 1536, steps, guidance, faces, Low memory -> POST /api/d3v3
 * (routes/d3v3.js) -> a job (misc/d3v3_worker.py) -> <name>_detail.glb in models3d, ⤒ brought into this model when ticked.
 * Not installed (409 needs "d3v3") -> H3Addons.act("d3v3", "install"): the add-on's own Download / Cancel box.
 *   open(), close(), run() -> Promise<model name | null>; pure: roughOk(name), detailName(name) (Node: test-3700). */
(function (root) {
  "use strict";
  const RX = /\.(glb|gltf|obj|ply|stl)$/i;
  const roughOk = (name) => RX.test(String(name || "")) && !/_rigged(_\d+)?\.glb$/i.test(String(name || ""));
  const detailName = (name) => String(name || "").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_rough$/, "").slice(0, 60) + "_detail.glb";
  const pure = { roughOk, detailName };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const P = () => root.H3PushPull;
  const LS = { get: (k, d) => { try { const v = root.localStorage.getItem("h3.detail." + k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { root.localStorage.setItem("h3.detail." + k, String(v)); } catch (e) { /* fine */ } } };
  const st = { pick: null, busy: false };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function say(t) { const m = $("ppdMsg"); if (m) m.textContent = t || ""; const p = P(); if (p && p.msg && t) p.msg(t); }
  function css() {
    if ($("ppdCss")) return;
    const s = doc.createElement("style"); s.id = "ppdCss";
    s.textContent = "#ppdDlg{padding:0;border:1px solid var(--line,#3a352d);border-radius:8px;background:var(--panel,#1b1915);color:var(--fg,#e8e2d4);width:min(560px,96vw);max-height:94vh}"
      + "#ppdDlg .ppd{display:flex;flex-direction:column;max-height:94vh}.ppd-bar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line,#3a352d);cursor:move}.ppd-bar b{flex:1;font-size:13px}"
      + ".ppd-body{display:flex;flex-direction:column;gap:6px;padding:10px;overflow:auto;font-size:12px}.ppd-row{display:flex;gap:6px;align-items:center}.ppd-row>span{width:110px;flex:none;opacity:.85}"
      + ".ppd-row select,.ppd-row input[type=number]{flex:1;min-width:0}.ppd-note{opacity:.75;margin:2px 0}.ppd-foot{display:flex;gap:6px;align-items:center;padding:8px 10px;border-top:1px solid var(--line,#3a352d)}.ppd-foot .hint{flex:1}";
    doc.head.appendChild(s);
  }
  function ensure() {
    let d = $("ppdDlg"); if (d) return d;
    css();
    d = doc.createElement("dialog"); d.id = "ppdDlg"; d.setAttribute("aria-label", "Fine detail");
    d.innerHTML = '<div class="ppd"><div class="ppd-bar" data-dlg-drag title="Drag to move"><b>💎 Fine detail (Direct3D-V3)</b><button type="button" class="ghost" id="ppdX" title="Close (Esc) - a job that is running keeps going">✕</button></div>'
      + '<div class="ppd-body"><p class="ppd-note">A picture and a rough 3D model of the same thing, the same way round, become a finely detailed model. With no rough model, 🧊 Convert to 3D (Hunyuan3D 2.1) makes one from the picture first.</p>'
      + '<div class="ppd-row"><span>The picture</span></div><div id="ppdPick"></div>'
      + '<label class="ppd-row"><span>Rough model</span><select id="ppdRough"><option value="">✨ Make it from the picture first (Hunyuan3D 2.1)</option></select></label>'
      + '<label class="ppd-row"><span>Detail</span><select id="ppdRes"><option value="512">512 - quick</option><option value="1024">1024 - fine</option><option value="1536">1536 - finest (most memory)</option></select></label>'
      + '<label class="ppd-row"><span>Steps / guidance</span><input type="number" id="ppdSteps" min="1" max="50" step="1"><input type="number" id="ppdCfg" min="0" max="15" step="0.5"></label>'
      + '<label class="ppd-row"><span>Faces</span><select id="ppdFaces"><option value="200000">200 000</option><option value="500000">500 000</option><option value="2000000">2 000 000</option><option value="all">all (no simplifying)</option></select></label>'
      + '<label class="ppd-row" title="A smaller detail budget (60 000 tokens instead of 150 000): less graphics memory, the model a little smaller in the grid"><input type="checkbox" id="ppdLow"> Low memory</label>'
      + '<label class="ppd-row"><input type="checkbox" id="ppdBring"> Bring it into this Sketcher model when it is done</label>'
      + '<p class="ppd-note">On this computer, in the job list. Direct3D-V3 (MIT code); its picture encoder DINOv3 is under Meta\'s DINOv3 licence. Settings ▸ Add-ons ▸ 💎 Fine detail installs it.</p></div>'
      + '<div class="ppd-foot"><span class="hint" id="ppdMsg" role="status"></span><button type="button" class="primary" id="ppdGo">💎 Make it detailed</button></div></div>';
    doc.body.appendChild(d);
    $("ppdX").onclick = () => close();
    d.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    $("ppdRes").value = LS.get("res", "1024"); $("ppdSteps").value = LS.get("steps", "15"); $("ppdCfg").value = LS.get("cfg", "4");
    $("ppdFaces").value = LS.get("faces", "500000"); $("ppdLow").checked = LS.get("low", "0") === "1"; $("ppdBring").checked = LS.get("bring", "1") === "1";
    ["ppdRes", "ppdSteps", "ppdCfg", "ppdFaces"].forEach((id) => { $(id).onchange = () => LS.set({ ppdRes: "res", ppdSteps: "steps", ppdCfg: "cfg", ppdFaces: "faces" }[id], $(id).value); });
    $("ppdLow").onchange = () => LS.set("low", $("ppdLow").checked ? "1" : "0"); $("ppdBring").onchange = () => LS.set("bring", $("ppdBring").checked ? "1" : "0");
    if (root.H3PicPick) root.H3PicPick.mount($("ppdPick"), { title: "The picture", onPick: (it) => { st.pick = it; say("🖼 " + it.name); } });
    else $("ppdPick").textContent = "the picture picker did not load (pppicpick.js)";
    $("ppdGo").onclick = () => run();
    return d;
  }
  async function models() {
    const sel = $("ppdRough"); if (!sel) return;
    const keep = sel.value;
    try {
      const j = await (await root.fetch("/api/tlcanvas/models")).json();
      const L = (j.models || []).map((m) => m.name).filter(roughOk);
      sel.innerHTML = '<option value="">✨ Make it from the picture first (Hunyuan3D 2.1)</option>' + L.map((n) => '<option value="' + esc(n) + '">' + esc(n) + "</option>").join("");
      if (L.includes(keep)) sel.value = keep;
    } catch (e) { say("⚠ " + e.message); }
  }
  function open() { const d = ensure(); if (!d.open) d.showModal(); models(); return d; }
  function close() { const d = $("ppdDlg"); if (d && d.open) d.close(); }
  const api = (u, b) => root.fetch(u, b === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json().catch(() => ({})).then((j) => ({ r, j })));
  async function waitJob(id, label) {
    for (;;) {
      await new Promise((ok) => setTimeout(ok, 1200));
      let jj; try { jj = await (await root.fetch("/api/jobs/" + encodeURIComponent(id))).json(); } catch (e) { continue; }
      if (jj.status === "running" && jj.progress && jj.progress.total) say(label + " - step " + jj.progress.step + " / " + jj.progress.total);
      else if (jj.status === "queued") say(label + " - waiting in the job list");
      if (jj.status && jj.status !== "running" && jj.status !== "queued") {
        if (jj.status !== "done") throw new Error(label + " " + jj.status + (jj.error ? ": " + jj.error : " - its log is in the job list"));
        return (jj.outputs && jj.outputs[jj.outputs.length - 1]) || jj.output;
      }
    }
  }
  /** ▶ - the whole chain; returns the detailed model's name */
  async function run() {
    if (st.busy) return null;
    if (!st.pick) { say("pick the picture first"); return null; }
    st.busy = true; const go = $("ppdGo"); if (go) go.disabled = true;
    try {
      const pic = await root.H3PicPick.toProject(st.pick);
      let rough = $("ppdRough").value;
      const body = { picture: pic.name, where: pic.where, model: rough || "", resolution: +$("ppdRes").value, steps: +$("ppdSteps").value, cfg: +$("ppdCfg").value,
        faces: $("ppdFaces").value === "all" ? "all" : +$("ppdFaces").value, low: $("ppdLow").checked };
      // the add-on first (no Hunyuan3D run for nothing): a GET says what is missing
      const s = await api("/api/d3v3");
      if (s.j && s.j.installed === false) return needInstall();
      if (!rough) {
        say("🧊 the rough model from the picture (Hunyuan3D 2.1)…");
        const m = await api("/api/mesh3d", { name: pic.name, where: pic.where, engine: "hunyuan", model_name: pic.name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 50) + "_rough" });
        if (!m.r.ok) throw new Error(m.j.error || m.r.statusText);
        rough = await waitJob(m.j.id, "🧊 the rough model");
        body.model = rough;
        models();
      }
      say("💎 " + rough + " → fine detail…");
      const d = await api("/api/d3v3", body);
      if (d.r.status === 409 && d.j.needs) return needInstall();
      if (!d.r.ok) throw new Error(d.j.error || d.r.statusText);
      const out = await waitJob(d.j.job.id, "💎 fine detail");
      say("💎 " + out + " is in the project's 3D models");
      if ($("ppdBring").checked && P() && P().importModel) { await P().importModel(out); say("💎 " + out + " brought into this model as a group"); }
      return out;
    } catch (e) { say("⚠ " + (e.message || e)); return null; }
    finally { st.busy = false; if (go) go.disabled = false; }
  }
  async function needInstall() {
    const A = root.H3Addons;
    if (A && A.act) { try { if (A.refresh) await A.refresh(); } catch (e) { /* the list */ } A.act("d3v3", "install"); }
    say("💎 Fine detail needs its add-on (Direct3D-V3) - its Download box is open; then 💎 again");
    return null;
  }
  root.H3Detail = Object.assign({ open, close, run, models, state: () => st }, pure);
})(typeof window !== "undefined" ? window : globalThis);

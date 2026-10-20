/* bitGen Studio — imageeditdock's app glue (2.223.14). imageedit.js (in this
   folder) owns the canvas and tools; THIS file is the bridge that gives it
   the app: where a dropped picture comes from (the core's dragPayload/refs,
   read at call time), how a result saves into the project, how the ✨ AI
   panel's requests become image jobs (2.332.0: /api/aiedit), and the
   docker's own Regenerate-style dropdown. The core
   boot/loadStyles call window.mountImageEditor / window.paintIeStyles when
   present — remove this folder and they no-op. */
(function () {
  function $(id) { return document.getElementById(id); }

/* ================= image editor dock (2.108.0) =================
   static/imageedit.js owns the canvas and the tools; this glue gives it the
   app: where a dropped gallery/asset/ref picture comes from, how to save a
   result into the project, and how an infill request becomes an image job. */
let imageEditor = null;
/* The editor's Infill style (2.109.0, by instruction: "use this style for
   inpaint in image editor dock"): its own dropdown, listing only styles whose
   inpaint path resolves, defaulting to the built-in "FLUX Fill inpaint". */
function ieStyleId() {
  const sel = document.getElementById("ieStyle");
  return sel && sel.value ? sel.value : "";
}
function paintIeStyles() {
  const sel = document.getElementById("ieStyle"); if (!sel) return;
  const list = (styleList || []).filter((st) => styleInpaintCapable[st.id]);
  const want = sel.value || store.get("ie.style", "") || ((list.find((st) => /flux fill inpaint/i.test(st.name)) || {}).id) || "";
  sel.innerHTML = list.length ? list.map((st) => `<option value="${st.id}">${st.name}</option>`).join("")
                              : `<option value="">(no inpaint-capable image style)</option>`;
  if (list.some((st) => st.id === want)) sel.value = want; else if (list.length) sel.value = list[0].id;
  // 2.332.0: the ✨ AI panel's Edit-model list follows the same style reloads
  if (imageEditor && imageEditor.paintEngines) imageEditor.paintEngines();
}
function mountImageEditor() {
  ieWatchMode();                                                                       // 2.431.0
  if (imageEditor || !window.ImageEdit || !$("ieHost")) return;
  imageEditor = window.ImageEdit.mount($("ieHost"), {
    onOpen: (name) => { if ($("ieName")) $("ieName").textContent = name || ""; },
    // 2.539.0: the References docker's pictures for the ✨ AI panel's "reference" dropdown [{i, name, url, role, desc, file}]
    refList: () => (window.H3Refs ? window.H3Refs.images() : []),
    dropUrl: () => {
      const d = dragPayload;
      if (!d) return null;
      if (d.type === "output" && d.kind === "images") return { url: `/outputs/${encodeURIComponent(d.name)}`, name: d.name };
      if (d.type === "asset" && d.kind === "images") return { url: `/passets/images/${encodeURIComponent(d.name)}`, name: d.name };
      // 2.539.0: a reference picture comes in as a LAYER when a picture is open (named by its description)
      if (d.type === "refimg" && refs[d.refIndex]) return { url: refs[d.refIndex].url, name: (refs[d.refIndex].desc || "").trim() || (refs[d.refIndex].file || {}).name || "reference", asLayer: true };
      return null;
    },
    save: async (blob, name) => {
      const fd = new FormData(); fd.append("file", blob, name); fd.append("hint", "images");
      try {
        const up = await (await fetch("/api/passets", { method: "POST", body: fd })).json();
        refreshAssets(); refreshGallery();
        return up && up.name;
      } catch { return null; }
    },
    // 2.332.0: the editor's ✨ AI (routes/aiedit.js) - engines for the
    // Edit-model dropdown, one request that queues N results, each awaited
    engines: async () => {
      const r = await fetch("/api/aiedit/engines");
      return r.ok ? r.json() : null;
    },
    mainPrompt: () => ($("prompt") ? $("prompt").value.trim() : ""),
    // 2.333.0: ◈ control layers - the ControlNet models ComfyUI has, and a
    // layer's "From image" (the type's preprocessor as a job)
    controlnets: async () => {
      const r = await fetch("/api/aiedit/controlnets");
      return r.ok ? r.json() : null;
    },
    preprocess: async (blob, type, say) => {
      const fd = new FormData(); fd.append("image", blob, "picture.png"); fd.append("type", type);
      const r = await fetch("/api/aiedit/preprocess", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { say(j.error || "refused"); return null; }
      await refreshJobs(); selectJob(j.job);
      const st = await awaitJob(j.job);
      if (st !== "done") { say("From image " + st + " - see the job log (comfyui_controlnet_aux installed?)"); return null; }
      const jj = await (await fetch(`/api/jobs/${j.job}`)).json();
      const out = (jj.outputs && jj.outputs[0]) || jj.output;
      return out ? `/outputs/${encodeURIComponent(out)}?v=${Date.now()}` : null;
    },
    aiedit: async (req, say) => {
      if (!req.style_id) { say(req.mode === "edit" ? "pick an Edit model in the ✨ AI panel" : "pick a style in the ✨ AI panel (Settings → Image makes more)"); return null; }
      if (!req.prompt && req.mode !== "remove") { say(req.mode === "edit" ? "write the edit instruction first" : "write what should appear in the selection first"); return null; }
      const fd = new FormData();
      fd.append("crop", req.crop, "crop.png");
      if (req.mask) fd.append("mask", req.mask, "mask.png");
      if (req.ref) { fd.append("ref0", req.ref, "ref.png"); fd.append("ref_desc", req.ref_desc || ""); }   // 2.539.0: the References docker's picture
      if (req.rgba) fd.append("rgba", req.rgba, "hole.png");
      for (const k of ["mode", "prompt", "style_id", "strength", "count", "width", "height"]) fd.append(k, String(req[k] == null ? "" : req[k]));
      if (req.mode !== "remove" && window.H3Neg && H3Neg.get()) fd.append("negative", H3Neg.get());   // 2.419.0: ⊖ the negative docker
      // 2.333.0: the ◈ control layers - one picture each + their settings
      if (req.controls && req.controls.length) {
        req.controls.forEach((c, i) => fd.append(`ctl${i}`, c.blob, `ctl${i}.png`));
        fd.append("controls", JSON.stringify(req.controls.map(({ blob, ...c }) => c)));
      }
      const r = await fetch("/api/aiedit", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { say(j.error || "refused"); return null; }
      say(`${j.mode}: ${j.jobs.length} render(s) queued (${String(j.workflow).split("/").pop()})…`);
      await refreshJobs(); if (j.jobs[0]) selectJob(j.jobs[0].id);
      return j;
    },
    // 2.390.0: ✨ Compose - the picked layers as Picture 1..3 for an edit model (routes/aiedit.js /api/aiedit/compose)
    compose: async (req, say) => {
      if (!req.style_id) { say("pick an Edit model in the ✨ AI panel (Qwen Image Edit 2511 ...)"); return null; }
      const fd = new FormData();
      req.pics.forEach((b, i) => fd.append(`pic${i}`, b, `pic${i}.png`));
      fd.append("names", JSON.stringify(req.names || []));
      if (Array.isArray(req.scene_refs)) fd.append("scene_refs", JSON.stringify(req.scene_refs));   // 2.546.0: a Blender scene + the References docker's pictures
      for (const k of ["prompt", "style_id", "count", "width", "height"]) fd.append(k, String(req[k] == null ? "" : req[k]));
      const r = await fetch("/api/aiedit/compose", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { say(j.error || "refused"); return null; }
      say(`compose: ${j.jobs.length} render(s) queued (${j.workflow})…`);
      await refreshJobs(); if (j.jobs[0]) selectJob(j.jobs[0].id);
      return j;
    },
    // 2.390.0: layers -> the reference dock's Image tab (Generate in the prompt docker uses them as <Picture n>)
    toRefs: (items) => {
      let n = 0;
      for (const it of items || []) {
        const file = new File([it.blob], it.name || "layer.png", { type: "image/png" });
        refs.push({ file, url: URL.createObjectURL(file), subject: typeof nextFreeSubject === "function" ? nextFreeSubject() : 1, role: "person", roleOther: "" });
        n++;
      }
      if (typeof normalizeSubjects === "function") normalizeSubjects();
      if (typeof renderTray === "function") renderTray();
      // the reference dock is a side dock: shown if it was hidden (the statusbar's References button does the same)
      if ($("app") && $("app").classList.contains("no-refs") && $("tRefs")) $("tRefs").click();
      const tab = document.querySelector('#reftabs [data-rtab="img"]'); if (tab) tab.click();
      return n;
    },
    awaitResult: async (id, say) => {
      const st = await awaitJob(id);
      if (st !== "done") { say("a render " + st + " - see the job log"); return null; }
      const jj = await (await fetch(`/api/jobs/${id}`)).json();
      const out = (jj.outputs && jj.outputs[0]) || jj.output;
      return out ? `/outputs/${encodeURIComponent(out)}?v=${Date.now()}` : null;
    },
  });
}

window.mountImageEditor = mountImageEditor;
/* 2.339.0: another window opens a picture here (the swap dialog's LTX Ripple
   first frames: 🖌 touch it up, 💾 Save -> Image assets, ⤓ back in the dialog) */
window.ieOpenUrl = function (url, name) {
  const d = $("imageeditdock"); if (!d) return false;
  if (d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("imageeditdock", "tIE");
  else if (d.classList.contains("collapsed") && typeof toggleCollapse === "function") toggleCollapse("imageeditdock");
  mountImageEditor();
  if (!imageEditor) return false;
  imageEditor.load(url, name || "picture.png");
  return true;
};
/* 2.431.0 (Tim: "when the editor is open the prompt docker changes to image mode - all generated images are sent to
   the open canvas as a layer"):
   - the editor docker ON SCREEN (shown, not collapsed) -> the prompt docker's Generate mode is 🖼 Image (the mode it was
     in is kept - h3.ie.modeWas - and comes back when the editor closes, unless it was changed meanwhile); a chip beside
     the mode says where the pictures go
   - every picture a Generate makes while the editor is open (the queue's image / graph renders - core's generateOne
     calls window.H3OnGenerated) lands on the document in front as a NEW LAYER named after the prompt (scaled down to
     fit, centred); no document open = it opens as one. The gallery keeps it as always. */
const IE_PICS = /\.(png|jpe?g|webp|bmp|jxl)$/i;
function ieOnScreen() { const d = $("imageeditdock"); return !!d && !d.classList.contains("dockgone") && !d.classList.contains("collapsed"); }
window.ieOnScreen = ieOnScreen;      // 2.543.0: the prompt docker's ▾ asks (pcimgop / pcpromptlink) - it was never global, so they always saw "open"
const iePref = {
  get: (k, d) => { try { const v = localStorage.getItem("h3." + k); return v == null ? d : v; } catch { return d; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem("h3." + k); else localStorage.setItem("h3." + k, v); } catch { /* private */ } },
};
function ieChip(on) {
  const sel = $("genModeSel"); if (!sel) return;
  let c = $("pdToCanvas");
  if (!c) {
    c = document.createElement("span"); c.id = "pdToCanvas";
    c.title = "The image editor is open: Generate makes pictures and each one lands on its canvas as a new layer (the gallery keeps them too)";
    c.style.cssText = "font-size:.66rem;color:var(--tiger,#f59e2c);border:1px solid var(--tiger,#f59e2c);border-radius:8px;padding:0 6px;margin-left:4px;white-space:nowrap;align-self:center";
    c.textContent = "→ ▦ canvas";
    sel.insertAdjacentElement("afterend", c);
  }
  c.hidden = !on;
}
/* only a CHANGE counts (the editor opened / closed by hand): the state it boots in is left alone - a page that loads
   with the editor already open keeps the mode it was kept in (h3.genmode: Image when it was switched before) */
let ieWasOpen = null, ieBootT = 0;
function ieBooting() {
  let ready = false; try { ready = typeof dsReady !== "undefined" && !!dsReady; } catch (e) { ready = false; }
  if (!ready) return true;
  if (!ieBootT) ieBootT = Date.now();
  return Date.now() - ieBootT < 1500;                          // the saved layout lands just after
}
function ieFollowMode() {
  const sel = $("genModeSel"); if (!sel) return;
  const open = ieOnScreen();
  if (ieBooting()) { ieWasOpen = open; ieChip(open && sel.value === "image"); setTimeout(ieFollowMode, 400); return; }
  if (ieWasOpen === null) {
    ieWasOpen = open;
    // this browser switched to Image for the editor before and it is still open: Image again (a reload)
    const was0 = iePref.get("ie.modeWas", null);
    if (open && was0 !== null && sel.value !== "image") { sel.value = "image"; if (sel.onchange) sel.onchange(); }
    else if (!open && was0 !== null) iePref.set("ie.modeWas", null);
  }
  if (open !== ieWasOpen) {
    ieWasOpen = open;
    const was = iePref.get("ie.modeWas", null);
    if (open) {                                                // opened: remember the mode, switch to Image
      iePref.set("ie.modeWas", sel.value === "image" ? "" : sel.value);
      if (sel.value !== "image") { sel.value = "image"; if (sel.onchange) sel.onchange(); }
    } else if (was !== null) {                                 // closed: the mode it was in, unless it was changed meanwhile
      if (was && sel.value === "image" && [...sel.options].some((o) => o.value === was)) { sel.value = was; if (sel.onchange) sel.onchange(); }
      iePref.set("ie.modeWas", null);
    }
  }
  ieChip(open && sel.value === "image");
}
let ieModeT = null;
function ieWatchMode() {
  const d = $("imageeditdock"); if (!d || d.dataset.modeWatch) return;
  d.dataset.modeWatch = "1";
  if (typeof MutationObserver === "function") new MutationObserver(() => { clearTimeout(ieModeT); ieModeT = setTimeout(ieFollowMode, 60); }).observe(d, { attributes: true, attributeFilter: ["class"] });
  const sel = $("genModeSel"); if (sel) sel.addEventListener("change", () => ieChip(ieOnScreen() && sel.value === "image"));
  ieFollowMode();
}
/** the pictures of a finished render -> the canvas, one layer each */
window.H3OnGenerated = async function (info) {
  if (!info || !ieOnScreen()) return 0;
  mountImageEditor();
  if (!imageEditor || !imageEditor.E) return 0;
  let outs = info.outputs;
  if (!outs) {
    try { const jj = await (await fetch(`/api/jobs/${encodeURIComponent(info.job)}`)).json(); outs = (jj.outputs && jj.outputs.length ? jj.outputs : [jj.output]).filter(Boolean); }
    catch { return 0; }
  }
  const pics = (outs || []).filter((n) => IE_PICS.test(String(n)));
  const E = imageEditor.E, base = String(info.text || "").replace(/\s+/g, " ").trim().slice(0, 40) || "generated";
  let n = 0;
  for (const name of pics) {
    const img = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.crossOrigin = "anonymous"; im.src = `/outputs/${encodeURIComponent(name)}?v=${Date.now()}`; });
    if (!img) continue;
    const label = "✨ " + base + (pics.length > 1 ? " " + (n + 1) : "");
    if (E.S.w) E.addImageLayer(img, label); else E.openImage(img, name);
    n++;
  }
  if (n) E.say(`${n} generated picture${n > 1 ? "s" : ""} added to ${E.S.name || "the canvas"} as ${n > 1 ? "layers" : "a layer"}`);
  return n;
};
/** the mode the user picked (not the editor's Image) - what the project keeps (core's project state asks) */
window.ieModeKept = function () { const w = iePref.get("ie.modeWas", null); return w ? w : null; };
// the live editor (tests, and the console when something looks wrong)
Object.defineProperty(window, "imageEditorInstance", { get: () => imageEditor, configurable: true });
window.paintIeStyles = paintIeStyles;
window.ieStyleId = ieStyleId;
})();

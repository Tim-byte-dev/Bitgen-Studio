/* static/selvideo.js — THE SELECTED VIDEO (2.401.0).
 *
 * Tim (verbatim): "use the enhance button in the prompt docker to upscale the selected video - the selected video will
 * be the one selected from gallery,assets or reference".
 *
 * The app had three different ideas of "selected": the gallery's one ringed tile (.thumb.sel), the Assets dock's
 * Ctrl/Shift set (AssetGroups) and NO selection at all in the reference dock. This file keeps ONE answer: the video
 * clicked most recently in any of the three, ringed (.svpick) wherever it shows, so the prompt docker's ⏫ Enhance
 * (static/seedvr2panel.js) knows what it will upscale - and says so on its tooltip before it is pressed.
 *
 *   SelVideo.get()  -> {name, from: "gallery" | "asset" | "ref", label} | null
 *   SelVideo.pick(name, from)   (tests, other docks)
 *   SelVideo.clear()
 * A pick that is gone (deleted, removed from the dock) falls back: the gallery's ringed video, the last Ctrl-picked
 * Video asset, the first reference video. Every change fires `h3:selvideo` on document with the answer.
 *
 * 2.733.0 (Tim: "if we select an image thumbnail and press the enhance buton can we upscale the image"): a PICTURE
 * clicked (a gallery image, an Image asset, a reference-dock picture) is noted too, and which of the two was clicked
 * LAST decides what ⏫ Enhance upscales:
 *   SelVideo.getImage() -> {name, from: "gallery" | "asset" | "ref", url, label} | null
 *   SelVideo.kind()     -> "image" when a picture was clicked after any video (and is still there), else "video"
 *   SelVideo.pickImage(name, from, url)
 * Every change of either fires `h3:selmedia` with {kind, video, image}. */
(function () {
  "use strict";
  const LABEL = { gallery: "gallery", asset: "Video assets", ref: "reference dock" };
  const VIDEO_RX = /\.(mp4|webm|mov|mkv|m4v|avi)$/i;
  let picked = null;                                   // {name, from}
  let pickedImg = null;                                // 2.733.0: {name, from, url}
  let lastKind = "video";
  const IMAGE_RX = /\.(png|jpe?g|webp|bmp)$/i;
  const IMG_LABEL = { gallery: "gallery Images", asset: "Image assets", ref: "reference dock" };

  const q = (s, r) => (r || document).querySelector(s);
  const qa = (s, r) => [...(r || document).querySelectorAll(s)];
  function galleryIsVideo() {
    const g = document.getElementById("gallery");
    if (!g) return false;
    if (g.dataset.gtab) return g.dataset.gtab === "video";
    try { return typeof galTab === "undefined" || galTab === "video"; } catch { return true; }
  }
  /** Is `p` still there to upscale? */
  function alive(p) {
    if (!p || !p.name) return false;
    try {
      if (p.from === "ref") return typeof refVids !== "undefined" && refVids.includes(p.name);
      if (p.from === "asset") return typeof assets === "undefined" || ((assets && assets.video) || []).some((a) => a && a.name === p.name);
    } catch { return true; }
    return true;                                       // a gallery file: the server says if it is gone
  }
  function fallback() {
    const t = galleryIsVideo() && q("#gallery .thumb.sel");
    if (t && t.dataset.name && VIDEO_RX.test(t.dataset.name)) return { name: t.dataset.name, from: "gallery" };
    try {
      const sel = window.AssetGroups && AssetGroups.state && AssetGroups.state.sel;
      if (sel && sel.size) {
        const vids = [...sel.values()].filter((s) => s && s.kind === "video");
        if (vids.length) return { name: vids[vids.length - 1].name, from: "asset" };
      }
    } catch { /* no asset groups */ }
    try { if (typeof refVids !== "undefined" && refVids.length) return { name: refVids[0], from: "ref" }; } catch { /* none */ }
    return null;
  }
  function imgAlive(p) {
    if (!p || !p.name) return false;
    try {
      if (p.from === "ref") return typeof refs !== "undefined" && refs.some((r) => r && r.url === p.url);
      if (p.from === "asset") return typeof assets === "undefined" || ((assets && assets.images) || []).some((a) => a && a.name === p.name);
    } catch { return true; }
    return true;
  }
  function getImage() {
    return imgAlive(pickedImg) ? { name: pickedImg.name, from: pickedImg.from, url: pickedImg.url || "", label: IMG_LABEL[pickedImg.from] || pickedImg.from } : null;
  }
  function kind() { return lastKind === "image" && getImage() ? "image" : "video"; }
  function get() {
    const p = alive(picked) ? picked : fallback();
    return p ? { name: p.name, from: p.from, label: LABEL[p.from] || p.from } : null;
  }
  /** The ring on every tile that shows the pick (the docks re-render - this runs again after them). */
  function mark() {
    const k = kind(), p = k === "video" ? get() : null, im = k === "image" ? getImage() : null;
    const key = p ? p.from + "/" + p.name : im ? "img:" + im.from + "/" + im.name : "";
    qa(".svpick").forEach((x) => { if (!key || x.dataset.svkey !== key) x.classList.remove("svpick"); });
    if (im) {                                          // 2.733.0: the picture's tile, ringed the same way
      const sel = im.from === "gallery" ? `#gallery .thumb[data-name="${CSS.escape(im.name)}"]`
        : im.from === "ref" ? `#tray .imgwrap[data-lb-url="${CSS.escape(im.url)}"]`
          : `[data-apane="images"] .aitem[data-lb-name="${CSS.escape(im.name)}"]`;
      qa(sel).forEach((x) => { x.classList.add("svpick"); x.dataset.svkey = key; });
      return;
    }
    if (!p) return;
    const sel = p.from === "gallery" ? `#gallery .thumb[data-name="${CSS.escape(p.name)}"]`
      : p.from === "ref" ? `#refvids [data-refvid="${CSS.escape(p.name)}"]`
        : `[data-apane="video"] .aitem[data-lb-name="${CSS.escape(p.name)}"]`;
    qa(sel).forEach((x) => { x.classList.add("svpick"); x.dataset.svkey = p.from + "/" + p.name; });
  }
  let last = "", lastMedia = "";
  function changed() {
    mark();
    const p = get(), key = p ? p.from + "/" + p.name : "";
    const im = getImage(), mk = kind() + "|" + key + "|" + (im ? im.from + "/" + im.name : "");
    if (mk !== lastMedia) { lastMedia = mk; document.dispatchEvent(new CustomEvent("h3:selmedia", { detail: { kind: kind(), video: p, image: im } })); }
    if (key === last) return;
    last = key;
    document.dispatchEvent(new CustomEvent("h3:selvideo", { detail: p }));
  }
  function pick(name, from) {
    picked = name ? { name: String(name), from: String(from || "gallery") } : null;
    if (name) lastKind = "video";
    changed();
  }
  function pickImage(name, from, url) {
    pickedImg = name ? { name: String(name), from: String(from || "gallery"), url: String(url || "") } : null;
    lastKind = name ? "image" : "video";
    changed();
  }
  function clear() { picked = null; changed(); }

  // capture phase: the tiles' own handlers (lightbox, the frame-range cutter) still run - this only notes the pick
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const g = t.closest("#gallery .thumb");
    if (g && galleryIsVideo() && g.dataset.name && VIDEO_RX.test(g.dataset.name)) { pick(g.dataset.name, "gallery"); return; }
    // 2.733.0: a picture - the gallery's Images, the reference dock, the Image assets
    if (g && !t.closest(".gsave") && g.dataset.name && IMAGE_RX.test(g.dataset.name) && g.dataset.lbKind === "image") { pickImage(g.dataset.name, "gallery"); return; }
    const ri = t.closest('#tray .imgwrap[data-lb-kind="image"]');
    if (ri && ri.dataset.lbUrl) { pickImage(ri.dataset.lbName || "reference.png", "ref", ri.dataset.lbUrl); return; }
    const ai = t.closest('[data-apane="images"] .aitem');
    if (ai && !t.closest(".agchk, button, input") && (ai.dataset.lbName || ai.dataset.agname)) { pickImage(ai.dataset.lbName || ai.dataset.agname, "asset"); return; }
    const r = t.closest("#refvids [data-refvid]");
    if (r && !t.closest("select, button, input, .rvop")) { pick(r.dataset.refvid, "ref"); return; }
    const a = t.closest('[data-apane="video"] .aitem');
    if (a && !t.closest(".agchk, button, input") && (a.dataset.lbName || a.dataset.agname)) pick(a.dataset.lbName || a.dataset.agname, "asset");
  }, true);
  // the docks repaint their tiles (a refresh, a tab switch, a removal): keep the ring + the answer true
  let tmr = 0;
  const mo = new MutationObserver(() => { clearTimeout(tmr); tmr = setTimeout(changed, 60); });
  function watch() {
    for (const id of ["gallery", "refvids", "assetscroll", "assetsdock", "tray"]) {
      const n = document.getElementById(id);
      if (n && !n.dataset.svwatch) { n.dataset.svwatch = "1"; mo.observe(n, { childList: true, subtree: true }); }
    }
  }
  const st = document.createElement("style");
  st.textContent = ".svpick { outline: 2px dashed var(--tiger, #e8892b) !important; outline-offset: -3px; }";
  try { (document.head || document.documentElement || document.body).appendChild(st); } catch { /* a bare test document */ }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { watch(); changed(); });
  else { watch(); changed(); }
  setTimeout(watch, 3000);                             // docks injected by extensions after boot
  window.SelVideo = { get, pick, clear, mark, refresh: changed, getImage, pickImage, kind };
})();

/* bitGen Studio — 2.548.0: the reference docker KEPT as it changes (H3RefKeep) - not only on 💾 Save.
 * Tim: "keep the references in the reference docker on close and on project save. they clear right now".
 *   - a picture, video or sound added, removed or described in the reference docker is written to the project within a
 *     couple of seconds (POST /api/projects/refs - routes/refKeep.js): only the pictures the server does not have yet
 *     travel; closing the app or opening another project keeps them (a last flush on close)
 *   - nothing is written while a project's references are still loading, before the first load, or for a page whose
 *     project is not the server's (409)
 *   - two pictures with the same name (pasted pictures are all "image.png") get their own names first, so one never
 *     stands in for the other
 * Pure (Node: scripts/test-refkeep548.js): uniqueNames, sigOf. */
(function (root) {
  "use strict";
  /** names made unique in order: ["a.png","a.png","b.png"] -> ["a.png","a_2.png","b.png"] (case-insensitive) */
  function uniqueNames(names) {
    const seen = new Set(), out = [];
    for (const n0 of names || []) {
      const n = String(n0 || "picture.png"), dot = n.lastIndexOf("."), stem = dot > 0 ? n.slice(0, dot) : n, ext = dot > 0 ? n.slice(dot) : "";
      let v = n, k = 2;
      while (seen.has(v.toLowerCase())) v = `${stem}_${k++}${ext}`;
      seen.add(v.toLowerCase()); out.push(v);
    }
    return out;
  }
  /** what decides "changed": the manifest as JSON */
  function sigOf(m) { try { return JSON.stringify(m || null); } catch (e) { return ""; } }
  const API = { uniqueNames, sigOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  const doc = root.document;
  const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
  // the page's globals (index.html's classic script - its top-level let / function names)
  const G = (name) => { try { return (0, eval)(name); } catch (e) { return undefined; } };   // eslint-disable-line no-eval
  const onServer = new WeakSet();          // File objects the server already holds in reference/images
  let ready = false, loading = 0, saved = null, busy = false, again = false, timer = 0;
  const projName = () => { const e = doc.getElementById("projname"); return e ? e.textContent.trim() : ""; };
  function refsArr() { const r = G("refs"); return Array.isArray(r) ? r : []; }
  /** unique names on the tray's Files (renamed in place - a File's name is what the manifest says) */
  function tidyNames() {
    const R = refsArr(), names = uniqueNames(R.map((r) => (r && r.file && r.file.name) || "picture.png"));
    R.forEach((r, i) => {
      if (!r || !r.file || r.file.name === names[i]) return;
      const was = onServer.has(r.file);
      r.file = new File([r.file], names[i], { type: r.file.type || "image/png" });
      if (was) onServer.add(r.file);
    });
  }
  function manifest() { const ps = G("projectState"); try { return typeof ps === "function" ? ps().references : null; } catch (e) { return null; } }
  function markAll() { for (const r of refsArr()) if (r && r.file) onServer.add(r.file); }
  function baseline() { markAll(); tidyNames(); saved = sigOf(manifest()); }
  async function save(final) {
    if (!ready || loading || !projName()) return false;
    if (busy) { again = true; return false; }
    tidyNames();
    const m = manifest(); if (!m) return false;
    const s = sigOf(m); if (s === saved) return false;
    const R = refsArr(), fresh = R.filter((r) => r && r.file && !onServer.has(r.file));
    busy = true;
    try {
      let res;
      if (final && !fresh.length && root.navigator.sendBeacon) {        // closing: the manifest alone
        root.navigator.sendBeacon("/api/projects/refs", new Blob([JSON.stringify({ project: projName(), references: m })], { type: "application/json" }));
        saved = s; return true;
      }
      const fd = new FormData();
      fd.append("project", projName()); fd.append("data", JSON.stringify(m));
      for (const r of fresh) fd.append("ref_images", r.file, r.file.name);
      res = await root.fetch("/api/projects/refs", { method: "POST", body: fd, keepalive: !!final });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { if (root.logLine) root.logLine(`[references] not kept: ${j.error || res.status}`); return false; }
      // the server may have renamed a picture (same name, other bytes): adopt its names
      const imgs = (j.references && j.references.images) || [];
      R.forEach((r, i) => { if (!r || !r.file) return; if (imgs[i] && imgs[i].file && imgs[i].file !== r.file.name) r.file = new File([r.file], imgs[i].file, { type: r.file.type || "image/png" }); onServer.add(r.file); });
      saved = sigOf(manifest());
      tev("refs_kept", String(imgs.length));
      return true;
    } catch (e) { return false; }
    finally { busy = false; if (again) { again = false; schedule(); } }
  }
  function schedule() { root.clearTimeout(timer); timer = root.setTimeout(() => save(false), 1200); }
  function wrap(name, after) {
    const f = G(name); if (typeof f !== "function" || f.__refkeep) return false;
    const w = function () { const r = f.apply(this, arguments); try { after(r, arguments); } catch (e) { /* never break the page */ } return r; };
    w.__refkeep = true;
    try { root[name] = w; } catch (e) { return false; }
    return G(name) === w;
  }
  function start() {
    // a project's references loading: nothing is written until they are all in
    const lpr = G("loadProjectReferences");
    if (typeof lpr === "function" && !lpr.__refkeep) {
      const w = function () {
        loading++;
        let p; try { p = lpr.apply(this, arguments); } catch (e) { loading--; throw e; }
        return Promise.resolve(p).finally(() => { loading = Math.max(0, loading - 1); if (!loading) { baseline(); ready = true; } });
      };
      w.__refkeep = true; root.loadProjectReferences = w;
    }
    wrap("applyProjectState", (r, a) => { const d = a[0]; if (!d || !d.references) root.setTimeout(() => { if (!loading) { baseline(); ready = true; } }, 300); });
    wrap("renderTray", () => { if (ready && !loading) schedule(); });
    wrap("renderRefLists", () => { if (ready && !loading) schedule(); });
    // 💾 Save stores them too: what it uploaded is on the server
    const ps = G("projSave");
    if (typeof ps === "function" && !ps.__refkeep) {
      const w = async function () { const j = await ps.apply(this, arguments); if (j) { markAll(); saved = sigOf(manifest()); } return j; };
      w.__refkeep = true; root.projSave = w;
    }
    // leaving for another project: what is pending goes first (while the server still points at this one)
    const sls = G("saveLeavingState");
    if (typeof sls === "function" && !sls.__refkeep) {
      const w = async function () { try { await save(false); } catch (e) { /* the state save still runs */ } return sls.apply(this, arguments); };
      w.__refkeep = true; root.saveLeavingState = w;
    }
    // a description or a subject typed without a repaint: a slow look
    root.setInterval(() => { if (ready && !loading && !busy && sigOf(manifest()) !== saved) schedule(); }, 3000);
    // a fresh page with nothing to load
    root.setTimeout(() => { if (!ready && !loading) { baseline(); ready = true; } }, 20000);
    root.addEventListener("beforeunload", () => { if (ready && !loading) save(true); });
  }
  root.H3RefKeep = Object.assign(API, { save: () => save(false), state: () => ({ ready, loading, saved, busy }) });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);

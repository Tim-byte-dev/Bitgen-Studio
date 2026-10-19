/* pclinked.js — LINKED SMART OBJECTS + PSD SMART OBJECTS KEPT (2.469.0), window.PCLinked.
 *
 * Tim (verbatim): "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor"
 * - the gap row "linked smart objects (contents in a separate file), PSD smart objects kept as smart objects".
 *
 *   A LINKED smart object = a smart object (pcsmart.js) whose contents are a picture in the project's linked folder
 *   (lib/linkedStore.js, /api/linked): L.smart.link = {name, mtime}. Layers that link to the same file share it.
 *     File ▸ Place Linked…                       a picture from the computer -> the linked folder -> a linked smart object
 *     Layer ▸ Smart Objects ▸ Convert to Linked…  an embedded one's contents saved there, the layer (and every copy) linked
 *     … ▸ Embed Linked                            the link dropped (the contents stay in the document)
 *     … ▸ Update Modified Content                 files changed since: read again (also by itself when the editor gets the
 *                                                 focus back, and every 20 s while open) - the transform and filters stay
 *     … ▸ Relink to File…                         another picture of the linked folder
 *     Edit Contents on a linked one: Done writes the new contents back to its file.
 *     The Layers panel marks them 🔗 (⚠ when the file is missing).
 *   PSD: a smart object's embedded file (PNG / JPEG / PSD) becomes the smart object's contents with its transform; saving
 *   writes smart objects back as placed layers with their contents embedded (pcpsd.js uses quadOf / transformOf / guid).
 *
 * Pure (Node: scripts/test-linked.js): quadOf (PSD transform [8] -> quad), transformOf, guid, sniff (png / jpg / psd / gif),
 * staleOf (links vs the folder's mtimes).
 */
(function (root) {
  "use strict";
  const quadOf = (t) => (Array.isArray(t) && t.length >= 8 ? [[+t[0], +t[1]], [+t[2], +t[3]], [+t[4], +t[5]], [+t[6], +t[7]]] : null);
  const transformOf = (q) => [].concat(...q.map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]));
  /** a GUID the PSD writer accepts (8-4-4-4-12 hex); seeded = the same text, the same GUID */
  function guid(seed) {
    let h = 2166136261 >>> 0; const s = String(seed == null ? Math.random() + ":" + Date.now() : seed), out = [];
    for (let k = 0; k < 16; k++) { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) + k * 131; h = Math.imul(h, 16777619) >>> 0; } out.push((h >>> 24) & 255); }
    const x = out.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
  }
  function sniff(u8) {
    if (!u8 || u8.length < 8) return null;
    if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return "png";
    if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return "jpg";
    if (u8[0] === 0x38 && u8[1] === 0x42 && u8[2] === 0x50 && u8[3] === 0x53) return "psd";
    if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return "gif";
    return null;
  }
  /** links [{name, mtime}] vs the folder's {name: mtime | 0} -> {changed: [names], missing: [names]} */
  function staleOf(links, mt) {
    const changed = new Set(), missing = new Set();
    for (const l of links) { const m = mt[l.name]; if (!m) missing.add(l.name); else if (m !== l.mtime) changed.add(l.name); }
    return { changed: [...changed], missing: [...missing] };
  }
  const pure = { quadOf, transformOf, guid, sniff, staleOf };

  function install(E) {
    const { S, doc, say, ctx, newCanvas } = E, SM = root.PCSmart, X = root.PCMesh;
    if (!SM || !X || !E.smart || !E.ui || !E.ui.addCmd) return;
    const win = doc.defaultView || root;
    const isSmart = (L) => !!L && L.type === "smart" && !!L.smart;
    const linked = () => S.layers.filter((L) => isSmart(L) && L.smart.link);
    const missing = new Set();
    const toPng = (c) => new Promise((ok) => c.toBlob(ok, "image/png"));
    async function upload(name, blob) {
      const r = await win.fetch("/api/linked/save?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "the save was refused"); return j;
    }
    async function loadCanvas(name) {
      const r = await win.fetch("/api/linked/file/" + encodeURIComponent(name) + "?t=" + Date.now()); if (!r.ok) throw new Error(`${name} is not in the linked folder`);
      const bmp = await win.createImageBitmap(await r.blob()), c = newCanvas(bmp.width, bmp.height); ctx(c).drawImage(bmp, 0, 0); return c;
    }
    const mtimes = async (names) => (await (await win.fetch("/api/linked/stat?names=" + encodeURIComponent(names.join(",")))).json()).mtimes || {};
    /** a smart object layer from a canvas (centred, fitted inside the picture) */
    function newSmart(c, name, link) {
      const k = Math.min(1, S.w / c.width, S.h / c.height), w = c.width * k, h = c.height * k, x = (S.w - w) / 2, y = (S.h - h) / 2;
      const id = SM.addSource(c, null); let L = null;
      E.structOp("place linked", () => {
        L = E.makeLayer(name, S.w, S.h, "smart");
        L.smart = { src: id, w: c.width, h: c.height, t: { quad: X.rectQuad(x, y, w, h), warp: null }, filters: [] };
        if (link) L.smart.link = link;
        const A = E.layer(); S.layers.splice(A ? S.layers.indexOf(A) + 1 : S.layers.length, 0, L); S.active = S.layers.indexOf(L);
        SM.render(L);
      });
      E.renderLayersPanel(); return L;
    }
    /* ---- Place Linked… */
    let pin = null;
    function placeLinked(file) {
      if (!S.w) return say("open or make a picture first");
      const go = async (f) => {
        try {
          const j = await upload(f.name, f), c = await loadCanvas(j.name);
          newSmart(c, f.name.replace(/\.[a-z0-9]+$/i, ""), { name: j.name, mtime: j.mtime });
          say(`"${j.name}" placed LINKED (${c.width} × ${c.height}) - kept in the project's linked folder; change that file and this layer follows`);
        } catch (e) { say("Place Linked: " + e.message); }
      };
      if (file) return go(file);
      if (!pin) { pin = doc.createElement("input"); pin.type = "file"; pin.accept = "image/png,image/jpeg"; pin.style.display = "none"; E.kx.appendChild(pin); }
      pin.onchange = () => { const f = pin.files && pin.files[0]; pin.value = ""; if (f) go(f); }; pin.click();
    }
    /* ---- Convert to Linked / Embed / Relink / Update */
    async function toLinked(name0) {
      const L = E.layer(); if (!isSmart(L)) return say("pick a smart object first");
      if (L.smart.link) return say(`it is linked already (${L.smart.link.name})`);
      const s0 = SM.STORE.get(L.smart.src); if (!s0) return;
      try {
        const j = await upload(name0 || String(L.name).replace(/[^\w .()-]+/g, "_") + ".png", await toPng(s0.canvas));
        E.structOp("convert to linked", () => { for (const x of S.layers) if (isSmart(x) && x.smart.src === L.smart.src) x.smart.link = { name: j.name, mtime: j.mtime }; });
        E.renderLayersPanel(); say(`"${L.name}" is linked to ${j.name} in the project's linked folder`);
        return j;
      } catch (e) { say("Convert to Linked: " + e.message); return null; }
    }
    function embed() {
      const L = E.layer(); if (!isSmart(L) || !L.smart.link) return say("pick a linked smart object first");
      const nm = L.smart.link.name;
      E.structOp("embed linked", () => { for (const x of S.layers) if (isSmart(x) && x.smart.link && x.smart.link.name === nm) delete x.smart.link; });
      E.renderLayersPanel(); say(`embedded - "${nm}" is no longer followed`);
    }
    /** read the changed files again: every layer linked to them gets the new contents (one undo step) */
    async function update(quiet, only) {
      const ls = linked(); if (!ls.length) { if (!quiet) say("no linked smart objects here"); return { changed: [], missing: [] }; }
      const names = [...new Set(ls.map((L) => L.smart.link.name))];
      let mt; try { mt = await mtimes(names); } catch (e) { return { changed: [], missing: [] }; }
      const st = staleOf(ls.map((L) => L.smart.link), mt);
      const want = only ? names.filter((n) => only.includes(n)) : st.changed;
      missing.clear(); st.missing.forEach((n) => missing.add(n));
      const got = new Map();
      for (const n of want) { if (st.missing.includes(n)) continue; try { got.set(n, await loadCanvas(n)); } catch (e) { missing.add(n); } }
      if (got.size) {
        E.structOp("update modified content", () => {
          for (const [n, c] of got) {
            const id = SM.addSource(c, null);
            for (const L of S.layers) if (isSmart(L) && L.smart.link && L.smart.link.name === n) { L.smart.src = id; L.smart.w = c.width; L.smart.h = c.height; L.smart.link = { name: n, mtime: mt[n] }; SM.render(L); }
          }
        });
        E.refresh();
      }
      E.renderLayersPanel();
      if (got.size) say(`updated from ${[...got.keys()].join(", ")}`);
      else if (!quiet) say(missing.size ? `missing: ${[...missing].join(", ")} (Relink to File… points them at another picture)` : "the linked files have not changed");
      return { changed: [...got.keys()], missing: [...missing] };
    }
    async function relink(name) {
      const L = E.layer(); if (!isSmart(L)) return say("pick a smart object first");
      const go = async (n) => {
        try {
          const c = await loadCanvas(n), mt = (await mtimes([n]))[n], id = SM.addSource(c, null), old = L.smart.link ? L.smart.link.name : null, src0 = L.smart.src;
          E.structOp("relink to file", () => { for (const x of S.layers) if (isSmart(x) && (x === L || (old ? x.smart.link && x.smart.link.name === old : x.smart.src === src0))) { x.smart.src = id; x.smart.w = c.width; x.smart.h = c.height; x.smart.link = { name: n, mtime: mt }; SM.render(x); } });
          missing.delete(old); E.refresh(); E.renderLayersPanel(); say(`linked to ${n}`);
        } catch (e) { say("Relink: " + e.message); }
      };
      if (name) return go(name);
      let files = []; try { files = (await (await win.fetch("/api/linked/list")).json()).files || []; } catch (e) { files = []; }
      if (!files.length) return say("the project's linked folder is empty - File ▸ Place Linked… puts pictures there");
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      E.ui.dialog("Relink to File", `<select id="lkF" size="${Math.min(10, Math.max(3, files.length))}" style="width:100%">${files.map((f, i) => `<option value="${esc(f.name)}"${i ? "" : " selected"}>${esc(f.name)} — ${Math.max(1, Math.round(f.size / 1024))} KB</option>`).join("")}</select>`,
        (d) => { const v = d.querySelector("#lkF").value; if (v) go(v); }, { okLabel: "🔗 Relink" });
    }
    // Edit Contents on a linked smart object: Done writes the new contents to its file (seen in the "edit contents" undo
    // step: a linked layer whose source changed between its before and after)
    const basePush = E.onPush;
    E.onPush = (entry) => {
      if (basePush) basePush(entry);
      if (!entry || entry.t !== "struct" || entry.label !== "edit contents" || !entry.before || !entry.after) return;
      const was = new Map(entry.before.list.map((x) => [x.L && x.L.id, x.smart && x.smart.src]));
      const done = new Set();
      for (const x of entry.after.list) {
        const sm = x.smart; if (!sm || !sm.link || done.has(sm.link.name) || !x.L || was.get(x.L.id) === sm.src) continue;
        const nm = sm.link.name, s0 = SM.STORE.get(sm.src); done.add(nm); if (!s0) continue;
        toPng(s0.canvas).then((b) => upload(nm, b)).then((j) => { for (const L of linked()) if (L.smart.link.name === nm) L.smart.link.mtime = j.mtime; say(`saved the new contents to ${nm} (the linked file)`); }).catch((e) => say(`${nm}: ${e.message}`));
      }
    };
    // the Layers panel: 🔗 on linked smart objects (⚠ when the file is missing)
    const baseLayers = E.ui.layers;
    if (baseLayers) E.ui.layers = function () {
      const r = baseLayers.apply(this, arguments);
      try {
        for (const row of E.kx.querySelectorAll(".kxlayer[data-i]")) {
          const L = S.layers[+row.dataset.i]; if (!isSmart(L) || !L.smart.link || row.querySelector(".lkb")) continue;
          const b = doc.createElement("span"); b.className = "lkb"; const miss = missing.has(L.smart.link.name);
          b.textContent = miss ? "⚠🔗" : "🔗"; b.title = (miss ? "missing: " : "linked to ") + L.smart.link.name; b.style.cssText = "margin-left:4px;font-size:11px";
          const nm = row.querySelector(".nm"); if (nm) nm.after(b); else row.appendChild(b);
        }
      } catch (e) { /* the panel is not there */ }
      return r;
    };
    // follow the files: when the editor gets the focus back, and every 20 s
    let busy = false;
    const check = async () => { if (busy || !S.w || !linked().length || doc.hidden) return; busy = true; try { await update(true); } finally { busy = false; } };
    win.addEventListener("focus", () => { check(); });
    win.setInterval(check, 20000);

    const C = E.ui.addCmd, sm = () => isSmart(E.layer()), lk = () => sm() && !!E.layer().smart.link;
    C("file.placelinked", "Place Linked…", "", () => placeLinked(), { enabled: () => !!S.w }, ["File", "file.place"]);
    C("so.tolinked", "Smart Objects: Convert to Linked…", "", () => toLinked(), { enabled: () => sm() && !E.layer().smart.link }, ["Layer", "so.raster"]);
    C("so.embed", "Smart Objects: Embed Linked", "", embed, { enabled: lk }, ["Layer", "so.tolinked"]);
    C("so.update", "Smart Objects: Update Modified Content", "", () => update(false), { enabled: () => linked().length > 0 }, ["Layer", "so.embed"]);
    C("so.relink", "Smart Objects: Relink to File…", "", () => relink(), { enabled: sm }, ["Layer", "so.update"]);
    E.linked = { placeLinked, toLinked, embed, update, relink, check, linked, missing: () => [...missing], newSmart };
  }
  const PCLinked = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCLinked;
  else root.PCLinked = PCLinked;
})(typeof window !== "undefined" ? window : globalThis);

/* bitGen Studio — 2.547.0: ↺ Built-in styles - the built-in styles that are missing, back (routes/stylesRestore.js).
 * Tim: "the krea2 style is gone, please add them back". Settings ▸ Image styles (after ✕ Delete) and Video styles: the
 * button lists the built-in styles whose file is gone (deleted, lost in a move …) and writes them again after a yes -
 * a style you made or edited is never touched. (Krea 2 Turbo / Raw / GGUF also come back on their own once, at the next
 * start - lib/styles.js RESEED.) Pure (Node: scripts/test-styles547.js): listText. */
(function (root) {
  "use strict";
  /** the question for n missing names */
  function listText(names, kind) {
    const n = (names || []).length, k = kind === "video" ? "video" : kind === "music" ? "music" : "image";
    if (!n) return `Every built-in ${k} style is there.`;
    return `Put back ${n} built-in ${k} style${n > 1 ? "s" : ""}?\n\n` + names.slice(0, 20).map((x) => "• " + x).join("\n") + (n > 20 ? `\n… and ${n - 20} more` : "")
      + "\n\nYour own styles and the ones you edited are not touched.";
  }
  const API = { listText };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
  async function run(kind) {
    let miss = [];
    try { miss = (await (await root.fetch("/api/styles/missing?kind=" + kind)).json()).missing || []; } catch (e) { miss = []; }
    const ask = typeof root.appConfirm === "function" ? root.appConfirm : (t) => Promise.resolve(root.confirm(t));
    if (!miss.length) { await (typeof root.noteDlg === "function" ? root.noteDlg(listText([], kind), "Built-in styles", false) : Promise.resolve(root.alert(listText([], kind)))); return []; }
    if (!(await ask(listText(miss, kind)))) return [];
    const r = await (await root.fetch("/api/styles/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names: miss, kind }) })).json();
    tev("styles_restored", (r.made || []).join(","));
    try { if (kind === "video" && typeof root.refreshVideoStyles === "function") await root.refreshVideoStyles(); else if (typeof root.refreshStyles === "function") await root.refreshStyles(); } catch (e) { /* the list repaints next time */ }
    return r.made || [];
  }
  function button(afterId, kind) {
    const a = $(afterId); if (!a || $("styleRestore_" + kind)) return;
    const b = doc.createElement("button"); b.className = "ghost"; b.type = "button"; b.id = "styleRestore_" + kind; b.textContent = "↺ Built-in";
    b.title = "Put back the built-in " + kind + " styles that are missing (deleted or lost) - yours are not touched";
    b.onclick = () => run(kind);
    a.after(b);
  }
  function start() { button("s_styledel", "image"); button("s_vsdel", "video"); }
  root.H3StyleRestore = Object.assign(API, { run });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);

/* bitGen Studio — 2.559.0: every FOLDER FILTER dropdown remembers its folder until it is changed (H3FolderMem).
 * Tim: "when user selects a folder to filter remember the folder selection until changed for all folder select dropdowns".
 *   The ComfyUI model combos ([folder filter] [file] [📁] - Settings ▸ Image / Video / Music / ControlNet, Basic Settings,
 *   the LoRA rows), the 📁 model browser, the character dialogs' LoRA folder and the Model manager's folder tabs keep the
 *   folder picked - each its own - across closing, reloading and restarting.
 *   Kept in folder_filters.cfg in the install folder (GET / POST /api/layout/folders - lib/layoutCfg.js), with a copy in
 *   the browser so the first paint already has it.
 *   get(key) -> the folder | null;  set(key, folder);  onReady(fn) - after the file is read;  pick(stored, values, fallback)
 * Pure (Node: scripts/test-basiccfg559.js): pick. */
(function (root) {
  "use strict";
  /** the stored folder when the list still has it, else the fallback */
  function pick(stored, values, fallback) { return stored != null && (values || []).indexOf(stored) >= 0 ? stored : fallback; }
  const API = { pick };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  const LS = "h3.folders";
  let mem = {};
  try { mem = JSON.parse(root.localStorage.getItem(LS) || "{}") || {}; } catch (e) { mem = {}; }
  let ready = false, timer = 0, pend = {};
  const waiters = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(mem, k);
  function get(key) { return has(key) ? mem[key] : null; }
  function keep() { try { root.localStorage.setItem(LS, JSON.stringify(mem)); } catch (e) { /* private window */ } }
  function flush() {
    const part = pend; pend = {};
    if (!Object.keys(part).length) return;
    root.fetch("/api/layout/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ set: part }) }).catch(() => {});
  }
  function set(key, folder) {
    const v = folder == null ? null : String(folder);
    if (has(key) && mem[key] === v) return;
    if (v == null) delete mem[key]; else mem[key] = v;
    keep(); pend[key] = v;
    root.clearTimeout(timer); timer = root.setTimeout(flush, 400);
    if (root.H3TestEvent) { try { root.H3TestEvent("folder_filter", key + "=" + v); } catch (e) { /* the 🧪 list */ } }
  }
  function onReady(fn) { if (ready) { try { fn(); } catch (e) { /* fine */ } } else waiters.push(fn); }
  root.addEventListener("beforeunload", flush);
  if (typeof root.fetch === "function") {
    root.fetch("/api/layout/folders").then((r) => r.json()).then((o) => {
      if (o && typeof o === "object" && !o.error) {           // the file is what counts (the browser copy only paints first)
        mem = Object.assign({}, o);
        for (const k of Object.keys(pend)) { if (pend[k] == null) delete mem[k]; else mem[k] = pend[k]; }   // a pick made meanwhile
        keep();
      }
    }).catch(() => {}).then(() => { ready = true; waiters.splice(0).forEach((f) => { try { f(); } catch (e) { /* fine */ } }); });
  } else ready = true;
  root.H3FolderMem = Object.assign(API, { get, set, onReady, all: () => Object.assign({}, mem) });
})(typeof window !== "undefined" ? window : globalThis);

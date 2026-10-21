/* bitGen Studio — 2.559.0: BASIC SETTINGS KEPT IN basic.cfg (H3BasicCfg).
 * Tim: "keep basic settings in a file basic.cfg and edit and save when basic settings are changed".
 *   Every setting in Basic Settings (the override switch, mode, resolution / aspect / size, seconds, steps, cfg, seed,
 *   format, the image set, ControlNet, face fix, the chain settings …) is written to basic.cfg in the install folder
 *   (GET / POST /api/layout/basic - lib/layoutCfg.js) a moment after it changes - by hand, by a style, by a project -
 *   and read back when the app starts (after the project's own state, so the last settings you had are the ones you get).
 *   Not kept there: the style card's model dropdowns (they save into the style itself) and the graph's own controls.
 *   collect(root) -> {id: value}  /  apply(root, values) -> how many were set  /  save() / load()
 * Pure (Node: scripts/test-basiccfg559.js): keepable (which elements), valueOf, same. */
(function (root) {
  "use strict";
  const SKIP = "#bsStyleCard, #gsControls, #ovrSummary";
  /** the fields of Basic Settings that are kept: inputs / selects / textareas with an id, not buttons / files, not in SKIP */
  function keepable(el) {
    if (!el || !el.id || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName || "")) return false;
    const ty = String(el.type || "").toLowerCase();
    if (/^(button|submit|reset|file|image)$/.test(ty)) return false;
    return !(el.closest && el.closest(SKIP));
  }
  function valueOf(el) { return String(el.type || "").toLowerCase() === "checkbox" || String(el.type || "").toLowerCase() === "radio" ? !!el.checked : String(el.value == null ? "" : el.value); }
  const same = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});
  const API = { keepable, valueOf, same, SKIP };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  const doc = root.document;
  const host = () => doc.getElementById("sec-basic");
  const fields = (h) => (h ? [...h.querySelectorAll("input[id], select[id], textarea[id]")].filter(keepable) : []);
  function collect(h) { const o = {}; for (const el of fields(h || host())) o[el.id] = valueOf(el); return o; }
  function apply(h, vals) {
    let n = 0;
    for (const el of fields(h || host())) {
      if (!Object.prototype.hasOwnProperty.call(vals || {}, el.id)) continue;
      const v = vals[el.id], cb = typeof v === "boolean";
      if (cb) { if (el.checked === v) continue; el.checked = v; }
      else {
        if (el.value === String(v)) continue;
        if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === String(v))) continue;   // that choice is gone
        el.value = String(v);
      }
      n++;
      try { el.dispatchEvent(new root.Event("input", { bubbles: true })); el.dispatchEvent(new root.Event("change", { bubbles: true })); } catch (e) { /* fine */ }
    }
    try { if (typeof root.cmRepaintAll === "function") root.cmRepaintAll(); } catch (e) { /* fine */ }
    return n;
  }
  let saved = null, timer = 0, started = false;
  function save() {
    const h = host(); if (!h || !started) return false;
    const o = collect(h);
    if (same(o, saved)) return false;
    saved = o;
    root.fetch("/api/layout/basic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: o }) }).catch(() => {});
    if (root.H3TestEvent) { try { root.H3TestEvent("basic_cfg_saved", String(Object.keys(o).length)); } catch (e) { /* the 🧪 list */ } }
    return true;
  }
  const soon = () => { root.clearTimeout(timer); timer = root.setTimeout(save, 600); };
  async function load() {
    let o = {};
    try { o = await (await root.fetch("/api/layout/basic")).json(); } catch (e) { o = {}; }
    const h = host();
    if (o && typeof o === "object" && !o.error && Object.keys(o).length) apply(h, o);
    started = true; saved = null;
    save();                                                // the file exists from the first start (and says what is set now)
  }
  function start() {
    const h = host(); if (!h) return;
    // a change by hand (the section may float in its own window - its elements keep their ids, the listener stays on it)
    h.addEventListener("change", soon, true); h.addEventListener("input", soon, true);
    // a change made by the app (a style, a project, a preset) - a quiet look every 3 s
    root.setInterval(() => { if (started && !same(collect(), saved)) soon(); }, 3000);
    root.addEventListener("beforeunload", () => { if (started) { try { const o = collect(); if (!same(o, saved)) root.navigator.sendBeacon("/api/layout/basic", new Blob([JSON.stringify({ all: o })], { type: "application/json" })); } catch (e) { /* fine */ } } });
    // after the boot: the layout ready and the project's own state applied (H3_PROJECT_READY - set even without a
    // project; a slow project can take 10 s+, so its restore must not land after the file), 60 s at most
    let waited = 0;
    const go = () => {
      const ready = typeof root.dsReady !== "undefined" ? root.dsReady : (() => { try { return (0, eval)("dsReady"); } catch (e) { return true; } })();   // eslint-disable-line no-eval
      if ((ready && root.H3_PROJECT_READY) || waited > 60000) { root.setTimeout(load, 600); return; }
      waited += 300; root.setTimeout(go, 300);
    };
    go();
  }
  root.H3BasicCfg = Object.assign(API, { collect: () => collect(), apply: (v) => apply(host(), v), save, load, state: () => ({ started, saved }) });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);

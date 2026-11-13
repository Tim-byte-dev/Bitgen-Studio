/* bitGen Studio — lib/podFails.js (2.778.0): A FILE THAT DID NOT GET ONTO A POD - ASKED "TRY AGAIN?".
 * Tim (verbatim): "if a file fails to upload to the pod ask the user if they want to try again".
 *   When a style is made ready on a pod (lib/podPrep.js) and a file it needs is still not on the pod at the end - its upload
 *   from this computer failed, the pod's download failed, or it was found nowhere - the file is kept here with why, per pod.
 *   The page (static/podfails.js) asks once for each new failure: ↻ Try again makes those styles ready on the pod again
 *   (the files that are there are skipped), and when that works the render waiting for the pod goes again by itself
 *   (lib/podRetry.js - the pod's activity ends well). Not now = not asked again until it fails again. A later run that
 *   puts the file on the pod clears it. Only in this run of the app.
 *   note(pod, styles, fails)  podPrep at the end of a run: fails = [{name, how: upload | download | missing, why}] -
 *                             this pod's other entries for those styles' files are cleared first
 *   list()                    -> [{id, pod, name, how, why, styles: [names], at, asked, tries, retrying}]
 *   retry(id, deps)           the pod's failed styles made ready again (in the background) -> {started, pod, styles}
 *   dismiss(id)               not asked again (until it fails again)
 * Pure (scripts/test-podfails778.js): idOf, merge, wordsOf.
 */
"use strict";

const FAILS = new Map();   // id -> {id, pod, name, how, why, styles: [{id, name, …style}], at, asked, tries, retrying}
const pid = (x) => String(x || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
const base = (n) => String(n || "").split(/[\\/]/).pop();
/** one entry per pod + file (pure) */
function idOf(pod, name) { return pid(pod) + "-" + base(name).toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 120); }
/** what the box says for one (pure) */
function wordsOf(f) {
  const how = f.how === "upload" ? "could not be sent from this computer" : f.how === "download" ? "the pod could not download it" : "was not found - not on the pod, this computer, bitGen's download list or Civitai";
  return base(f.name) + " " + how + (f.why ? ": " + String(f.why).slice(0, 300) : "");
}
/** a run's failures into the list (pure on a Map): the styles' earlier entries on that pod cleared, these added / renewed */
function merge(map, pod, styles, fails, now) {
  const k = pid(pod), names = new Set((styles || []).map((s) => s && s.id));
  for (const [id, f] of map) if (f.pod === k && f.styles.some((s) => names.has(s.id))) map.delete(id);
  for (const x of fails || []) {
    if (!x || !x.name) continue;
    const id = idOf(k, x.name), old = map.get(id);
    map.set(id, { id, pod: k, name: base(x.name), how: ["upload", "download", "missing"].includes(x.how) ? x.how : "missing", why: String(x.why || "").slice(0, 400),
      styles: (styles || []).filter(Boolean), at: now || Date.now(), asked: false, tries: old ? old.tries : 0, retrying: false });
  }
  return map;
}
function note(pod, styles, fails) { merge(FAILS, pod, styles, fails, Date.now()); }
function list() {
  return [...FAILS.values()].sort((a, b) => a.at - b.at).map((f) => ({ id: f.id, pod: f.pod, name: f.name, how: f.how, why: f.why, words: wordsOf(f),
    styles: f.styles.map((s) => s.name || s.id), at: f.at, asked: f.asked, tries: f.tries, retrying: f.retrying }));
}
function dismiss(id) { const f = FAILS.get(String(id)); if (!f) return false; f.asked = true; return true; }
/** ↻ Try again: every failed file of that pod - its styles made ready again in the background */
function retry(id, deps) {
  const f = FAILS.get(String(id));
  if (!f) { const e = new Error("that file is no longer waiting - it may be on the pod now"); e.status = 404; throw e; }
  const mine = [...FAILS.values()].filter((x) => x.pod === f.pod);
  const styles = []; for (const x of mine) for (const s of x.styles) if (!styles.some((y) => y.id === s.id)) styles.push(s);
  mine.forEach((x) => { x.asked = true; x.retrying = true; x.tries += 1; });
  const d = deps || {};
  const port = d.port ? d.port(f.pod) : (() => { try { return require("./stylePods").portOf(((require("./core").getConfig() || {}).rgpu) || {}, f.pod); } catch { return 8188; } })();
  const prep = d.prepare || ((pod, p, sts) => require("./podPrep").prepare(pod, p, sts, {}));
  Promise.resolve().then(() => prep(f.pod, port, styles)).catch(() => null).then(() => { for (const x of mine) if (FAILS.get(x.id) === x) x.retrying = false; });
  return { started: true, pod: f.pod, styles: styles.map((s) => s.name || s.id), files: mine.map((x) => x.name) };
}
function clear() { FAILS.clear(); }
module.exports = { idOf, merge, wordsOf, note, list, dismiss, retry, clear, FAILS };

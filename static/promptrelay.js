/* bitGen Studio — static/promptrelay.js (2.592.0): ⏱ TIMED LINES for an LTX prompt (window.H3Relay).
 *
 * Tim: "lets just add the regional character lora and prompt relay". Prompt Relay (Nougan_Nodes / Kijai's pack, Settings
 * ▸ Add-ons ▸ Nougan Nodes) gives each stretch of an LTX clip its own words in one render. The prompt says it:
 *     a red fox in the snow, cinematic          <- lines without a time = over the whole clip
 *     [0-2s] the fox sniffs the ground
 *     [2-4s] the fox looks up
 * scripts/prompt_relay.py reads it in misc/ltx_worker.py (the same rules as parse() here); without the node pack the
 * clip renders all of it as one prompt. The prompt docker's ⏱ (beside the LTX mode, LTX styles only) adds the next line.
 * Pure (Node: scripts/test-nougan592.js): LINE, parse(text), nextLine(text, seconds, step?)
 */
(function (root) {
  "use strict";
  const NUM = "(\\d+(?:\\.\\d+)?)\\s*(?:s|sec|secs|seconds?)?";
  const LINE = new RegExp("^\\s*\\[\\s*" + NUM + "\\s*(?:(?:-|–|—|to)\\s*(?:" + NUM + ")?\\s*)?\\]\\s*(.*?)\\s*$", "i");
  /** the prompt -> {global, segments: [{start, end, text}]} | null (nothing timed) - prompt_relay.parse's twin */
  function parse(text) {
    const glob = [], segs = [];
    for (const raw of String(text == null ? "" : text).replace(/\r/g, "").split("\n")) {
      const m = LINE.exec(raw);
      if (m) {
        if (!m[3].trim()) continue;
        const a = parseFloat(m[1]), b = m[2] != null ? parseFloat(m[2]) : null;
        segs.push({ start: a, end: b != null && b > a ? b : null, text: m[3].trim() });
      } else if (raw.trim()) glob.push(raw.trim());
    }
    if (!segs.length) return null;
    segs.sort((x, y) => x.start - y.start);
    return { global: glob.join(" ").trim(), segments: segs };
  }
  /** the next timed line to add: from where the last one ends (or starts + step), `step` seconds long, inside the clip */
  function nextLine(text, seconds, step) {
    const st = Math.max(0.5, Number(step) || 2), total = Math.max(1, Number(seconds) || 5);
    const p = parse(text);
    let a = 0;
    if (p) { const last = p.segments[p.segments.length - 1]; a = last.end != null ? last.end : last.start + st; }
    a = Math.min(a, Math.max(0, total - 0.5));
    const b = Math.min(total, a + st);
    const f = (v) => (Math.round(v * 10) / 10).toString();
    return `[${f(a)}-${f(b)}s] `;
  }
  const pure = { LINE, parse, nextLine };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /** the ⏱ button: the next timed line at the end of the prompt, the caret after it */
  function add() {
    const ta = document.getElementById("prompt");
    if (!ta) return;
    const secs = parseFloat((document.getElementById("seconds") || {}).value || "5");
    const line = nextLine(ta.value, secs, 2);
    const sep = ta.value && !/\n$/.test(ta.value) ? "\n" : "";
    ta.value = ta.value + sep + line;
    ta.focus();
    try { ta.selectionStart = ta.selectionEnd = ta.value.length; } catch (e) { /* old browsers */ }
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function wire() {
    const b = document.getElementById("ltxRelayBtn");
    if (b && !b.dataset.wired) { b.dataset.wired = "1"; b.addEventListener("click", add); }
  }
  root.H3Relay = Object.assign({ add, wire }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
  // the prompt docker is an extension - its markup can arrive after this script (ltxModePaint wires it too)
  setTimeout(wire, 1500);
})(typeof window !== "undefined" ? window : globalThis);

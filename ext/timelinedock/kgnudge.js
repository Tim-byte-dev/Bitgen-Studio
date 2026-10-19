/* bitGen Studio — ext/timelinedock/kgnudge.js (2.433.0): the 🎤 Karaoke docker's word NUDGES and the line under the
 * preview marker, window.KGNudge.
 *
 * Tim (verbatim): "in karaoke docker add a nudge left and nudge right button to each word in the timing. if the user
 * ctrl+click the button then nudge all the following words by the same amount, shift+ctrl+click all the words following
 * and the word we are editing will be nudged by the larger nudge setting . shift+click will nudge the single word by
 * the larger nudge - highlight the line of words that the marker is over."
 *
 *   ◀ / ▶ on a word        click = that word by the NUDGE (its start and end together); Shift+click = by the LARGER
 *                          nudge; Ctrl+click (⌘ on a Mac) = that word AND every word after it by the nudge;
 *                          Shift+Ctrl+click = them all by the larger nudge. Nothing moves before 0 s (a move that would
 *                          is cut short for every word it moves, so their spacing stays).
 *   the line under the marker   the words of the line being sung where the preview marker is (or the next line,
 *                          when it starts within 1.5 s) - lit in the list (and drawn as the 👁 draft).
 * Pure: plan, nudge, wordAt, lineAt (Node: scripts/test-kgnudge.js); karaokegen.js draws them.
 */
(function (root) {
  "use strict";
  const DEF = { small: 0.05, big: 0.25 };
  const r2 = (v) => Math.round(v * 100) / 100;
  /** what a click on ◀ / ▶ does: {amount (s, signed by dir), following} */
  function plan(ev, dir, small, big) {
    const e = ev || {}, s = +small > 0 ? +small : DEF.small, b = +big > 0 ? +big : DEF.big;
    const amount = (e.shiftKey ? b : s) * (dir < 0 ? -1 : 1);
    return { amount: r2(amount), following: !!(e.ctrlKey || e.metaKey) };
  }
  /** words[i] (and every word after it when `following`) moved by d seconds - start and end together, 2 decimals,
   *  never before 0 (the move is cut short for them all); returns the indexes moved ([] = nothing) */
  function nudge(words, i, d, following) {
    if (!Array.isArray(words) || !(i >= 0 && i < words.length) || !d) return [];
    const idx = following ? words.map((_, k) => k).filter((k) => k >= i) : [i];
    let dd = +d;
    const lo = Math.min(...idx.map((k) => +words[k].start || 0));
    if (lo + dd < 0) dd = -lo;
    if (!dd) return [];
    for (const k of idx) {
      const w = words[k], len = Math.max(0, (+w.end || 0) - (+w.start || 0));
      w.start = r2(Math.max(0, (+w.start || 0) + dd));
      w.end = r2(w.start + len);
    }
    return idx;
  }
  /** the word being sung at song time st (-1: none - before the first, or a pause) */
  function wordAt(words, st) {
    if (!words || st == null) return -1;
    let hit = -1;
    for (let i = 0; i < words.length; i++) { if (words[i].start <= st + 1e-3) hit = i; else break; }
    if (hit >= 0 && st > words[hit].end + 0.6 && (hit + 1 >= words.length || words[hit + 1].start - st > 0.3)) return -1;   // a pause
    return hit;
  }
  /** the line under the marker: the sung word's line, else the next line starting within 1.5 s; {line, word} or null */
  function lineAt(words, st) {
    if (!words || !words.length || st == null) return null;
    let i = wordAt(words, st);
    if (i < 0) { for (let k = 0; k < words.length; k++) if (words[k].start > st) { if (words[k].start - st < 1.5) i = k; break; } }
    return i < 0 ? null : { line: words[i].line, word: i };
  }
  const KGNudge = { DEF, plan, nudge, wordAt, lineAt };
  if (typeof module !== "undefined" && module.exports) module.exports = KGNudge;
  else root.KGNudge = KGNudge;
})(typeof window !== "undefined" ? window : globalThis);

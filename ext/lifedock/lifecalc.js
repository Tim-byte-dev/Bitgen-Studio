/* bitGen Studio — ext/lifedock/lifecalc.js (2.951.0): 🎓 LIFE CHOICES' 🧮 CALCULATOR (window.H3LifeCalc).
 * Tim: "for life choices, use a dialog to show questions, add a calculator to the dialog".
 * A small four-function calculator for the puzzle dialog - its own parser (never eval / Function): + - × ÷ (or * /), brackets,
 * decimals, unary minus, % as "of a hundred" (50% = 0.5). Pure - no DOM (lifedock.js draws its keys).
 *   evaluate(text)  -> a number, or throws an Error in words ("÷ 0", "a bracket is open", ...)
 *   show(n)         -> the number for the display: up to 10 significant digits, no float dust (0.1 + 0.2 = 0.3)
 *   tidy(text)      -> the text with × ÷ − written as * / - (what evaluate reads)
 */
(function (root) {
  "use strict";
  function tidy(t) { return String(t == null ? "" : t).replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/,/g, "").replace(/\s+/g, ""); }
  function evaluate(text) {
    var s = tidy(text), i = 0;
    if (!s) throw new Error("type a sum");
    if (s.length > 200) throw new Error("that sum is too long");
    function peek() { return s.charAt(i); }
    function num() {
      var m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) throw new Error(i >= s.length ? "the sum ends too soon" : "\"" + s.charAt(i) + "\" is not a number");
      i += m[0].length; return parseFloat(m[0]);
    }
    function atom() {
      var c = peek();
      if (c === "-") { i++; return -atom(); }
      if (c === "+") { i++; return atom(); }
      var v;
      if (c === "(") { i++; v = sum(); if (peek() !== ")") throw new Error("a bracket is open"); i++; }
      else v = num();
      while (peek() === "%") { i++; v = v / 100; }
      return v;
    }
    function product() {
      var v = atom();
      for (;;) {
        var c = peek();
        if (c === "*") { i++; v *= atom(); }
        else if (c === "/") { i++; var d = atom(); if (d === 0) throw new Error("÷ 0 has no answer"); v /= d; }
        else if (c === "(") v *= atom();                    // 2(3+4)
        else return v;
      }
    }
    function sum() {
      var v = product();
      for (;;) { var c = peek(); if (c === "+") { i++; v += product(); } else if (c === "-") { i++; v -= product(); } else return v; }
    }
    var v = sum();
    if (i < s.length) throw new Error(s.charAt(i) === ")" ? "a ) with no (" : "\"" + s.charAt(i) + "\" is not part of a sum");
    if (!isFinite(v)) throw new Error("too big");
    return v;
  }
  function show(n) {
    if (typeof n !== "number" || !isFinite(n)) return "";
    if (n === 0) return "0";
    var t = String(parseFloat(n.toPrecision(10)));
    return t.indexOf("e") >= 0 ? n.toPrecision(6) : t;
  }
  root.H3LifeCalc = { evaluate: evaluate, show: show, tidy: tidy };
  if (typeof module !== "undefined" && module.exports) module.exports = root.H3LifeCalc;
})(typeof window !== "undefined" ? window : globalThis);

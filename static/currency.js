/* bitGen Studio — static/currency.js (2.760.0): Settings ▸ General ▸ Currency - the prices bitGen shows, in your money (H3Money).
 * Tim (verbatim): "in general tab add currency (AUD,USD,CNY,JPY)etc. convert to this currency when showing prices"
 *   The prices come in US dollars (RunPod's GPUs and pods, OpenRouter's models, a remote GPU). H3Money.usd(0.27, "/h") shows
 *   them in the picked currency ("A$0.41/h") with the dollars and the day's rate on hover; with USD picked, or no rate known
 *   yet, they stay in US dollars. The rate: Frankfurter's reference rate of the day (lib/currency.js, kept for offline use)
 *   or one typed in Settings. A change re-paints the open prices at once (the "h3:currency" event).
 * Pure (Node: scripts/test-currency760.js): fmt, digits, usdText.
 */
(function (root) {
  "use strict";
  /** how many decimals an amount gets: the currency's own (0 for JPY / KRW), more for small amounts */
  function digits(v, code) {
    var own = 2;
    try { own = new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits; } catch (e) { /* 2 */ }
    var a = Math.abs(+v || 0);
    if (a > 0 && a < 0.1) return Math.max(own, 3);
    if (a > 0 && a < 1) return Math.max(own, 2);
    return own;
  }
  /** an amount in a currency -> "A$0.41", "¥42", "$1.20" ("en" names: A$ for Australian dollars, CN¥ for yuan) */
  function fmt(v, code) {
    code = String(code || "USD").toUpperCase();
    var d = digits(v, code);
    try { return new Intl.NumberFormat("en", { style: "currency", currency: code, minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: d }).format(+v || 0); }
    catch (e) { return code + " " + (+v || 0).toFixed(d); }
  }
  /** US dollars -> {text, title} in the picked currency (st = {code, rate, source, date}) */
  function usdText(usd, st, suffix) {
    var v = +usd || 0, sfx = suffix || "";
    st = st || {};
    if (!st.code || st.code === "USD" || !(+st.rate > 0)) {
      var t = fmt(v, "USD") + sfx;
      return { text: t, title: st.code && st.code !== "USD" ? "US dollars - no " + st.code + " rate yet (Settings ▸ General ▸ Currency)" : "" };
    }
    return { text: fmt(v * st.rate, st.code) + sfx,
             title: fmt(v, "USD") + sfx + " · 1 USD = " + (+st.rate).toFixed(4).replace(/0+$/, "").replace(/\.$/, "") + " " + st.code
               + (st.source === "typed" ? " (your rate)" : st.date ? " (" + st.date + ")" : "") };
  }
  var pure = { fmt: fmt, digits: digits, usdText: usdText };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var S = { st: { code: "USD", rate: 1, source: "usd" }, loaded: false };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function changed() { try { root.dispatchEvent(new root.CustomEvent("h3:currency", { detail: S.st })); } catch (e) { /* fine */ } paint(); }
  function load() {
    return fetch("/api/currency").then(function (r) { return r.json(); }).then(function (j) { if (j && j.code) { S.st = j; S.loaded = true; changed(); } return S.st; }).catch(function () { return S.st; });
  }
  function post(url, b) { return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  /** text: "A$0.41/h" (US dollars when none is picked) */
  function usd(v, suffix) { return usdText(v, S.st, suffix).text; }
  /** a <span> with the dollars and the rate on hover - for innerHTML */
  function usdHtml(v, suffix) { var u = usdText(v, S.st, suffix); return '<span class="h3money"' + (u.title ? ' title="' + esc(u.title) + '"' : "") + ">" + esc(u.text) + "</span>"; }
  /** Settings ▸ General ▸ Currency */
  function paint() {
    var sel = $("s_cur"), rate = $("s_currate"), msg = $("s_curmsg"), st = S.st;
    if (!sel) return;
    if (sel.options.length < 2 && st.codes) sel.innerHTML = st.codes.map(function (c) { return "<option>" + c + "</option>"; }).join("");
    if (document.activeElement !== sel) sel.value = st.code || "USD";
    var usdPicked = (st.code || "USD") === "USD";
    var row = $("s_curraterow"); if (row) row.style.display = usdPicked ? "none" : "";
    if ($("s_curcode")) $("s_curcode").textContent = st.code || "";
    if (rate && document.activeElement !== rate) rate.value = st.manual && st.manual[st.code] ? st.manual[st.code] : "";
    if (rate) rate.placeholder = st.rates && st.rates[st.code] ? String(st.rates[st.code]) : "";
    if (msg) msg.textContent = usdPicked ? "Prices show in US dollars, as the services list them."
      : st.source === "typed" ? "Your rate: 1 USD = " + st.rate + " " + st.code + "."
      : st.source === "fetched" ? "1 USD = " + st.rate + " " + st.code + " (the reference rate of " + (st.date || "the last check") + ") - checked again every 12 hours."
      : "No " + st.code + " rate yet - bitGen could not reach the rates service. Type a rate, or press ↻ when you are online. Prices stay in US dollars until then.";
  }
  function wire() {
    var sel = $("s_cur"), rate = $("s_currate"), re = $("s_curre");
    if (!sel || sel.dataset.wired) return;
    sel.dataset.wired = "1";
    sel.onchange = function () { post("/api/currency", { code: sel.value }).then(function (j) { if (j && j.code) { S.st = j; changed(); } }); };
    if (rate) rate.onchange = function () { post("/api/currency", { manual: rate.value.trim() }).then(function (j) { if (j && j.code) { S.st = j; changed(); } }); };
    if (re) re.onclick = function () {
      if ($("s_curmsg")) $("s_curmsg").textContent = "checking the rates…";
      post("/api/currency/refresh").then(function (j) { if (j && j.view) { S.st = j.view; changed(); } if (j && j.ok === false && $("s_curmsg")) $("s_curmsg").textContent = "Could not get the rates: " + j.error; });
    };
    paint();
  }
  function start() { wire(); load(); var st = $("settings"); if (st) st.addEventListener("toggle", function () { if (st.open) load(); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);
  root.H3Money = Object.assign({ usd: usd, usdHtml: usdHtml, load: load, state: function () { return S.st; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);

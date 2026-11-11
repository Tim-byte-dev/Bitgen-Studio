// bitGen Studio — lib/currency.js (2.760.0): Settings ▸ General ▸ Currency - the prices bitGen shows, in your money.
// Tim (verbatim): "in general tab add currency (AUD,USD,CNY,JPY)etc. convert to this currency when showing prices"
//   The prices bitGen shows come in US dollars (RunPod's GPUs and pods, OpenRouter's models, a remote GPU's $/h). With a
//   currency picked they show in it: the rate is the day's reference rate from Frankfurter (api.frankfurter.dev - free,
//   no key, the central banks' published rates), fetched at most every 12 hours and kept in config.fx, so a computer
//   that is offline keeps the last one. A rate typed in Settings ("1 USD = 1.53 AUD") is used instead of the fetched one.
//   config.fx = {code, manual: {AUD: 1.53}, rates: {AUD: 1.53, ...}, date: "2026-11-10", at: <ms>}
//   H3_FX_API overrides the address (the tests' stand-in).
"use strict";
const CODES = ["USD", "AUD", "EUR", "GBP", "CNY", "JPY", "NZD", "CAD", "SGD", "HKD", "KRW", "INR", "THB", "CHF"];
const STALE = 12 * 3600e3;
const core = () => require("./core");
const base = () => String(process.env.H3_FX_API || "https://api.frankfurter.dev").replace(/\/+$/, "");

/** a currency code bitGen offers, or "" */
function codeOf(c) { const k = String(c || "").trim().toUpperCase(); return CODES.includes(k) ? k : ""; }
/** Frankfurter's answer -> {rates: {AUD: 1.53}, date} - v2 (an array of {date, base, quote, rate}) or v1 ({date, rates}) */
function parseRates(j) {
  const rates = {}; let date = "";
  if (Array.isArray(j)) {
    for (const r of j) {
      if (!r || String(r.base || "").toUpperCase() !== "USD") continue;
      const q = codeOf(r.quote), v = +r.rate;
      if (q && v > 0 && isFinite(v)) { rates[q] = v; if (r.date && String(r.date) > date) date = String(r.date); }
    }
  } else if (j && typeof j === "object" && j.rates && typeof j.rates === "object") {
    for (const [k, v] of Object.entries(j.rates)) { const q = codeOf(k); if (q && +v > 0 && isFinite(+v)) rates[q] = +v; }
    date = String(j.date || "");
  }
  rates.USD = 1;
  return { rates, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "" };
}
/** the rate for 1 USD in `code` from an fx record: a typed rate first, then the fetched one; null = none known */
function rateOf(fx, code) {
  const c = codeOf(code); if (!c) return null;
  if (c === "USD") return 1;
  const m = +((fx && fx.manual) || {})[c]; if (m > 0 && isFinite(m)) return m;
  const r = +((fx && fx.rates) || {})[c]; return r > 0 && isFinite(r) ? r : null;
}
/** an amount in US dollars -> `code` (null when no rate is known) */
function convert(usd, code, fx) { const r = rateOf(fx, code), v = +usd; return r == null || !isFinite(v) ? null : v * r; }
/** the record, tidied: {code, manual, rates, date, at} */
function tidy(fx) {
  fx = fx && typeof fx === "object" ? fx : {};
  const manual = {};
  for (const [k, v] of Object.entries(fx.manual || {})) { const c = codeOf(k); if (c && c !== "USD" && +v > 0 && isFinite(+v)) manual[c] = +v; }
  const rates = {};
  for (const [k, v] of Object.entries(fx.rates || {})) { const c = codeOf(k); if (c && +v > 0 && isFinite(+v)) rates[c] = +v; }
  return { code: codeOf(fx.code) || "USD", manual, rates, date: String(fx.date || ""), at: +fx.at || 0 };
}
function fxNow() { return tidy((core().getConfig() || {}).fx); }
function save(fx) { const c = core().getConfig(); c.fx = tidy(fx); core().setConfig(c); return c.fx; }
/** what the app needs: {code, rate, source: "usd" | "typed" | "fetched" | "none", date, codes, manual, rates} */
function view(fx) {
  fx = tidy(fx || fxNow());
  const typed = fx.code !== "USD" && fx.manual[fx.code] > 0, rate = rateOf(fx, fx.code);
  return { code: fx.code, rate, source: fx.code === "USD" ? "usd" : typed ? "typed" : rate ? "fetched" : "none",
           date: fx.date, at: fx.at, codes: CODES.slice(), manual: fx.manual, rates: fx.rates };
}
let pending = null;
/** fetch the day's rates (USD -> every code bitGen offers) and keep them; {ok, date} | {ok: false, error} */
async function refresh() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const q = CODES.filter((c) => c !== "USD").join(",");
      const r = await fetch(base() + "/v2/rates?base=USD&quotes=" + q, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("the rates service answered " + r.status);
      const p = parseRates(await r.json());
      if (Object.keys(p.rates).length < 2) throw new Error("the rates service sent no rates");
      const fx = fxNow(); fx.rates = p.rates; fx.date = p.date; fx.at = Date.now(); save(fx);
      return { ok: true, date: p.date };
    } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    finally { pending = null; }
  })();
  return pending;
}
/** GET: the view; rates older than 12 hours (or none) are fetched again - this answer waits for them only when there are none */
async function get() {
  const fx = fxNow();
  if (fx.code !== "USD" && !fx.manual[fx.code] && (!fx.at || Date.now() - fx.at > STALE)) {
    const p = refresh();
    if (!fx.rates[fx.code]) await p;
  }
  return view();
}
/** POST {code?, manual?: number | "" (for the picked code)} */
async function set(b) {
  b = b || {}; const fx = fxNow();
  if ("code" in b) { const c = codeOf(b.code); if (!c) { const e = new Error("bitGen does not know that currency"); e.status = 400; throw e; } fx.code = c; }
  if ("manual" in b && fx.code !== "USD") {
    const v = +b.manual;
    if (b.manual === "" || b.manual == null || !(v > 0)) delete fx.manual[fx.code]; else fx.manual[fx.code] = Math.min(1e6, v);
  }
  save(fx);
  return get();
}
/** a remote GPU's cost (US dollars) in the energy bill's currency (Settings ▸ General ▸ Energy cost) - unchanged when
 *  that currency is USD or no rate is known (lib/usageLog.js) */
function usdIn(usd, code) { const c = codeOf(code); if (!c || c === "USD") return +usd || 0; const v = convert(usd, c, fxNow()); return v == null ? +usd || 0 : v; }

module.exports = { CODES, STALE, codeOf, parseRates, rateOf, convert, tidy, view, refresh, get, set, usdIn };

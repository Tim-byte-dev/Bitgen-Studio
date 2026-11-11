// bitGen Studio — lib/runpodAccount.js (2.763.5): YOUR RUNPOD ACCOUNT - the balance, what it is spending now, the limit.
// Tim (verbatim): "make a new docker for runpod prices and move runpod balance and usage costs from the basic settings
// docker to the runpod docker"
//   RunPod's REST v2 has no balance; its GraphQL API does (what runpodctl user shows):
//     POST https://api.runpod.io/graphql   Authorization: Bearer <API key>   (H3_RUNPOD_GQL_API = the tests' stand-in)
//     {query: "query { myself { clientBalance currentSpendPerHr spendLimit underBalance } }"}
//     -> {data: {myself: {clientBalance: 435.85, currentSpendPerHr: 0.69, spendLimit: 180, underBalance: false}}}
//   account() -> {balance, spend_hr, spend_limit, under, lasts_hr, at, error?}   (US dollars; kept 50 s, like lib/podCosts.js)
// Pure (scripts/test-runpoddock7635.js): QUERY, parseMyself, lastsHours.
"use strict";
const QUERY = "query bitGenAccount { myself { clientBalance currentSpendPerHr spendLimit underBalance } }";
const GQL = () => (process.env.H3_RUNPOD_GQL_API || "https://api.runpod.io/graphql").replace(/\/+$/, "");
const num = (v) => (v == null || v === "" || !isFinite(+v) ? null : +v);

/** how many hours the balance lasts at the spend now (pure); null = nothing is spending */
function lastsHours(balance, spendHr) {
  const b = num(balance), s = num(spendHr);
  if (b == null || !s || s <= 0) return null;
  return Math.max(0, Math.round((b / s) * 10) / 10);
}
/** RunPod's answer -> the account (pure); throws with RunPod's own words when it answered an error */
function parseMyself(j) {
  const errs = (j && Array.isArray(j.errors)) ? j.errors.map((e) => String((e && e.message) || e)).filter(Boolean) : [];
  const m = j && j.data && j.data.myself;
  if (!m) throw new Error(errs.length ? "RunPod: " + errs.join("; ").slice(0, 200) : "RunPod did not say what is on the account");
  const balance = num(m.clientBalance), spend = num(m.currentSpendPerHr);
  return { balance, spend_hr: spend == null ? 0 : spend, spend_limit: num(m.spendLimit), under: !!m.underBalance, lasts_hr: lastsHours(balance, spend) };
}

/* ---------------- live */
function key() {
  try { return String((((require("./core").getConfig() || {}).rgpu || {}).runpod || {}).key || "").trim(); } catch { return ""; }
}
let LAST = null;
async function account(force, opts) {
  if (!force && LAST && Date.now() - LAST.at < 50000) return LAST;
  const k = opts && opts.key != null ? String(opts.key).trim() : key();   // (opts.key: the tests)
  if (!k) return (LAST = { balance: null, spend_hr: 0, spend_limit: null, under: false, lasts_hr: null, at: Date.now(), error: "a RunPod API key first (Settings ▸ Remote generation)" });
  const f = (opts && opts.fetch) || fetch;
  let out;
  try {
    const r = await f(GQL(), { method: "POST", headers: { Authorization: "Bearer " + k, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "bitGen-Studio" },
      body: JSON.stringify({ query: QUERY }), signal: AbortSignal.timeout(20000) });
    const txt = await r.text().catch(() => "");
    let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = null; }
    if (r.status === 401 || r.status === 403) throw new Error("RunPod refused the API key for the account's balance");
    if (!r.ok && !(j && j.errors)) throw new Error("RunPod answered HTTP " + r.status);
    out = Object.assign(parseMyself(j), { at: Date.now() });
  } catch (e) {
    const was = LAST && LAST.balance != null ? LAST : null;     // the last figures stay, with the reason they are old
    out = Object.assign({ balance: null, spend_hr: 0, spend_limit: null, under: false, lasts_hr: null }, was || {}, { at: Date.now(), error: "RunPod's balance could not be read: " + String((e && e.message) || e) });
  }
  return (LAST = out);
}
module.exports = { QUERY, GQL, parseMyself, lastsHours, account };

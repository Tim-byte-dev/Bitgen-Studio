/* bitGen Studio — ext/lifedock/lifemoney.js (2.947.0): 🎓 LIFE CHOICES - life's money: the bills, the budget, insurance and
 * Australian income tax (window.H3LifeMoney; pure, no DOM - lifecore.js uses it).
 *
 * Tim: "make insurance plans, bills (utilities, food, entertainment) going to a cinema is different price from going on a
 * picnic etc. life expenses. user can choose to buy health insurance or house insurance or car insurance. if it is
 * reasonable in this build we could add taxes and deductions (use au tax scale)".
 *   TAX      the Australian resident scale for 2026-27 (1 July 2026 - 30 June 2027): $0-$18,200 nil, 15% to $45,000,
 *            30% to $135,000, 37% to $190,000, 45% above; the low income tax offset; the 2% Medicare levy (its low-income
 *            reduction left out); the Medicare levy surcharge for no hospital cover (singles: 1% over $105,000, 1.25% over
 *            $123,000, 1.5% over $164,000); the $1,000 standard deduction for work expenses, or the real deductions when
 *            they are bigger (loan interest and costs on rental property, rates, landlord insurance, storm repairs).
 *            A game's tax - not tax advice.
 *   BILLS    every quarter once you work: rent (none once you own a place), utilities, phone and internet, getting around,
 *            groceries / eating out (your choice), fun (your choice - a picnic costs less than the cinema, the cinema less
 *            than concerts, a holiday most) and insurance premiums
 *   WELLBEING  fun keeps it up (0-100, start 50); it counts at the end (+/- $2,000 a point from 50)
 *   COVER    🏥 health (hospital bills -> the excess; no Medicare levy surcharge), 🚗 car (a written-off car -> the
 *            excess), 🏠 home (storm and water damage -> the excess; contents only while renting)
 */
(function (root) {
  "use strict";
  // [up to, base tax at the start of the band, rate] - 2026-27 resident rates
  var SCALE = [[18200, 0, 0], [45000, 0, 0.15], [135000, 4020, 0.30], [190000, 31020, 0.37], [Infinity, 51370, 0.45]];
  var MEDICARE = 0.02, STD_DEDUCTION = 1000;
  var MLS = [[105000, 0], [123000, 0.01], [164000, 0.0125], [Infinity, 0.015]];
  var YEAR = "2026-27";
  function incomeTax(t) {
    t = Math.max(0, Math.floor(t)); var lo = 0;
    for (var i = 0; i < SCALE.length; i++) { var b = SCALE[i]; if (t <= b[0]) return Math.round(b[1] + (t - lo) * b[2]); lo = b[0]; }
    return 0;
  }
  /** the low income tax offset: $700 to $37,500, less 5c a dollar to $45,000, less 1.5c a dollar to $66,667 */
  function lito(t) { t = Math.max(0, t); if (t <= 37500) return 700; if (t <= 45000) return Math.round(700 - 0.05 * (t - 37500)); if (t <= 66667) return Math.max(0, Math.round(325 - 0.015 * (t - 45000))); return 0; }
  function mlsRate(income) { for (var i = 0; i < MLS.length; i++) if (income <= MLS[i][0]) return MLS[i][1]; return 0.015; }
  /** the year's tax on a taxable income -> {tax, offset, medicare, surcharge, total} */
  function taxOn(taxable, hospitalCover) {
    taxable = Math.max(0, Math.round(taxable));
    var tax = incomeTax(taxable), off = Math.min(tax, lito(taxable)), med = taxable > 0 ? Math.round(taxable * MEDICARE) : 0;
    var sur = hospitalCover ? 0 : Math.round(taxable * mlsRate(taxable));
    return { taxable: taxable, tax: tax, offset: off, medicare: med, surcharge: sur, total: tax - off + med + sur };
  }
  /** the tax taken from each quarter's pay (PAYG): a quarter of the year's tax on the salary, after the standard deduction */
  function withholding(salary, hospitalCover) { return Math.round(taxOn(salary - STD_DEDUCTION, hospitalCover).total / 4); }

  /* ---------------- the budget ---------------- */
  var FOOD = { home: ["🥕 Cook at home", 1500], mix: ["🍝 A mix of home and takeaway", 2400], out: ["🍽 Eat out a lot", 3900] };
  // [label, a quarter's cost, wellbeing a quarter]
  var FUN = { picnic: ["🧺 Picnics, parks and the beach", 150, 1], cinema: ["🎬 Cinema and cafés", 450, 1.5], gigs: ["🎤 Concerts, dinners out and sport", 1300, 2], travel: ["✈ A holiday every year", 2800, 3] };
  var BILL = { rent: 4200, utilities: 900, phone: 250, transport: 650, jobseeker: 2400 };
  var COVER = { health: { name: "🏥 Health (hospital + extras)", premium: 650, excess: 500 }, car: { name: "🚗 Car (comprehensive)", premium: 320, excess: 800 },
                home: { name: "🏠 Home (building + contents)", premium: 150, rate: 0.001, excess: 1000 } };
  var WB = { start: 50, drift: 1, point: 2000 };
  /** what a quarter of cover costs: home = 0.1% of what you own a quarter (contents only, $150, while renting) */
  function premium(kind, propValue) { var c = COVER[kind]; return kind === "home" ? Math.max(c.premium, Math.round((propValue || 0) * c.rate)) : c.premium; }
  /** a quarter's bills for an adult: {rent, utilities, phone, transport, food, fun, insurance, total} */
  function bills(b, ins, ownsHome, propValue) {
    b = b || {}; ins = ins || {};
    var o = { rent: ownsHome ? 0 : BILL.rent, utilities: BILL.utilities, phone: BILL.phone, transport: BILL.transport,
              food: (FOOD[b.food] || FOOD.mix)[1], fun: (FUN[b.fun] || FUN.cinema)[1], insurance: 0 };
    Object.keys(COVER).forEach(function (k) { if (ins[k]) o.insurance += premium(k, propValue); });
    o.total = o.rent + o.utilities + o.phone + o.transport + o.food + o.fun + o.insurance;
    return o;
  }
  /** a luck event's cost with cover: the excess (never more than the bill) */
  function covered(kind, ins, cost) { return ins && ins[kind] && COVER[kind] ? Math.min(cost, COVER[kind].excess) : cost; }

  var API = { SCALE: SCALE, MEDICARE: MEDICARE, MLS: MLS, STD_DEDUCTION: STD_DEDUCTION, YEAR: YEAR, FOOD: FOOD, FUN: FUN, BILL: BILL, COVER: COVER, WB: WB,
              incomeTax: incomeTax, lito: lito, mlsRate: mlsRate, taxOn: taxOn, withholding: withholding, premium: premium, bills: bills, covered: covered };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.H3LifeMoney = API;
})(typeof window !== "undefined" ? window : this);

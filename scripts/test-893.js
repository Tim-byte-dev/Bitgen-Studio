#!/usr/bin/env node
/* bitGen Studio — 2.893.0 units: (1) 👷 a year's payment summary per person in 📒 Accounts (lib/accountingPaySummary.js - the
 * financial year, people grouped by name, totals, the years with pay runs, the page to print, the CSV, the routes, the docker's
 * 👷 Pay summary…); (2) the business card's front / back descriptions as the prompts of its two backgrounds (lib/createAi.js
 * bgPrompt, pccreate.js cardLayout + lay keeping a background under the words) and the business details dialog made wider with
 * inputs that stay inside it.
 * Tim (verbatim): "continue next. with the business card descriptions in image-editor , use them as prompts for the background for
 * the front an back, make the dialog wider, the input boxes go past the dialog frame" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const A = require("../lib/accounting"), PS = require("../lib/accountingPaySummary"), T = require("../lib/accountingTax");

/* ---- 1 the payment summary */
const y = PS.yearOf("2027"), y2 = PS.yearOf("2026-27"), y3 = PS.yearOf("2026-08-01"), y4 = PS.yearOf("FY 2025-26");
check("yearOf: \"2027\" / \"2026-27\" / a date in it = 1 July 2026 - 30 June 2027, FY 2026-27; \"FY 2025-26\" the year before",
  y.from === "2026-07-01" && y.to === "2027-06-30" && y.label === "FY 2026-27" && y.end === 2027 && y2.to === y.to && y3.to === y.to && y4.to === "2026-06-30", { y, y2, y3, y4 });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc893-")); A.setRoot(tmp);
const pay = (employee, date, gross, tax, sup, period) => T.payRun("t", { employee, date, gross, tax, super: sup, period });
pay("Sam Lee", "2026-06-25", 1000, 100, "");                // last year
pay("Sam Lee", "2026-07-03", 1200, 150, "", "week ending 3/7/2026");
pay("sam  lee ", "2026-07-10", 1300, 170, "");              // the same person, typed differently
pay("Alex Wu", "2026-09-01", 2000, 400, 0);
pay("Sam Lee", "2027-07-01", 900, 80, "");                  // next year
let S = PS.summaryOf("t", "2027");
const sam = PS.personOf(S, "SAM LEE"), alex = PS.personOf(S, "alex wu");
check("summary FY 2026-27: two people (the same name typed twice = one), sorted by name; last / next year's pays left out",
  S.people.length === 2 && S.people[0].name === "Alex Wu" && sam && sam.runs === 2 && sam.first === "2026-07-03" && sam.last === "2026-07-10", S.people.map((p) => [p.name, p.runs]));
check("...Sam: gross $2,500, tax $320, net $2,180, super 12 % = $300; each pay with its period", sam.gross === 250000 && sam.tax === 32000 && sam.net === 218000 && sam.super === 30000 && sam.pays[0].period === "week ending 3/7/2026", sam);
check("...Alex: super given as 0 stays 0; the totals add up (3 pays, gross $4,500, tax $720, super $300)", alex.super === 0 && S.totals.runs === 3 && S.totals.gross === 450000 && S.totals.tax === 72000 && S.totals.super === 30000 && S.totals.net === 378000, S.totals);
check("...the years with pay runs, newest first (FY 2027-28, 2026-27, 2025-26)", S.years.map((x) => x.label).join() === "FY 2027-28,FY 2026-27,FY 2025-26", S.years);
check("...another year: FY 2025-26 = Sam's one pay; a year with none = no people, still listed", PS.summaryOf("t", "2026").people.length === 1 && PS.summaryOf("t", "2030").people.length === 0 && PS.summaryOf("t", "2030").years.some((x) => x.end === 2030));
const R = PS.rows(S);
check("rows (CSV): a header, a line per person, the total in dollars", R.length === 4 && R[0][5] === "Gross payments" && R[2][1] === "Sam Lee" && R[2][5] === "2500.00" && R[3][1] === "Total" && R[3][6] === "720.00", R);
const H = PS.html(S, { company: "Rosie's Bakery", abn: "51 824 753 556" }), H1 = PS.html(S, null, "sam lee");
check("the page: the year's totals then a sheet per person (page breaks), the business + ABN, each pay, 🖨, the Single Touch Payroll note",
  /Payment summaries - the year/.test(H) && (H.match(/class="sheet"/g) || []).length === 3 && /ABN 51 824 753 556/.test(H) && /week ending 3\/7\/2026/.test(H) && /window\.print\(\)/.test(H) && /Single Touch Payroll/.test(H) && /page-break-after/.test(H));
check("...one person asked for: their sheet only (no totals page); nobody that year = says so", (H1.match(/class="sheet"/g) || []).length === 1 && /Sam Lee/.test(H1) && !/Alex Wu/.test(H1) && /No pay runs in this year/.test(PS.html(PS.summaryOf("t", "2030"))));
check("...the names are escaped", !/<script>/.test(PS.html(Object.assign({}, S, { people: [Object.assign({}, sam, { name: "<script>x" })] }))));
const rt = src("routes/accounting.js");
check("routes: GET /api/accounts/paysummary (+ /print ?person, /csv) - not in server.js", ['app.get("/api/accounts/paysummary"', '"/api/accounts/paysummary/print"', '"/api/accounts/paysummary/csv"'].every((s) => rt.includes(s)) && !/paysummary/.test(src("misc/server.js")));
const tx = src("ext/acctdock/accttax.js");
check("the docker: 👷 Pay summary… (acPaySum) -> H3AcctTax.paySummary: the year dropdown, a row each with 🖨, 🖨 All, ⤓ CSV",
  /id="acPaySum"/.test(src("ext/acctdock/dock.html")) && /acPaySum[\s\S]{0,120}paySummary/.test(src("ext/acctdock/acctdock.js")) && ["acpsFy", "data-psprint", "acpsAll", "acpsCsv", "/api/accounts/paysummary/print", "paySummary }"].every((s) => tx.includes(s)));
fs.rmSync(tmp, { recursive: true, force: true });

/* ---- 2 the business card's backgrounds + the wider dialog */
const C = require("../lib/createAi");
const fb = C.bgPrompt("", "Clean and warm, cream with the logo top left, my name big, the phone and email under it", { bg: "#fff7ed", accent: "#b45309" });
check("bgPrompt: made from the front's description - the words about name / phone / logo taken out, the colours added, background art only",
  /^Clean and warm, cream - colours #fff7ed, #b45309\. /.test(fb) && /no text, no letters/.test(fb) && !/phone|logo top/.test(fb.split(".")[0]), fb);
check("...the LLM's own background sentence first; a description that only places words = a plain abstract background; none = no background",
  /^golden crust texture/.test(C.bgPrompt("golden crust texture", "x")) && /^a simple, elegant abstract background/.test(C.bgPrompt("", "The logo in the middle, the services under it")) && C.bgPrompt("", "") === "");
let p = C.applyBusiness("card", C.clean("card", { name: "R", front_bg: "soft wheat watercolour", back_bg: "" }), { name: "Rosie", front: "warm bakery feel", back: "dark brown with a gold line" });
check("the card plan: front_bg / back_bg asked of the LLM; frontBg = the LLM's, backBg = from the back's description", /front_bg/.test(src("lib/createAi.js")) && /^soft wheat watercolour/.test(p.frontBg) && /^dark brown with a gold line/.test(p.backBg), p);
p = C.applyBusiness("card", C.clean("card", { name: "R", front_bg: "x" }), { name: "Rosie", front: "", back: "" });
check("...no description for a side = no background picture for it (the colour as before)", p.frontBg === "" && p.backBg === "");
const PC = require("../ext/imageeditdock/pccreate.js");
const pal = { bg: "#fff7ed", accent: "#b45309", ink: "#3b2f2f", accentInk: "#ffffff" };
const plan = { name: "Rosie Smith", company: "Rosie's Bakery", palette: pal, back: { heading: "What we bake" }, frontBg: "warm", backBg: "dark", bgPics: true };
const L1 = PC.cardLayout(Object.assign({}, plan, { radius: 38 }), 1011, 638), L0 = PC.cardLayout(Object.assign({}, plan, { bgPics: false }), 1063, 650);
check("cardLayout: with backgrounds each side starts with a full-size background picture (its prompt, its colour as the stand-in, the PVC corners)",
  L1[0][0].t === "picture" && L1[0][0].bg && L1[0][0].prompt === "warm" && L1[0][0].fill === pal.bg && L1[0][0].w === 1011 && L1[0][0].radius === 38 && L1[0][0].name === "Front background"
  && L1[1][0].t === "picture" && L1[1][0].prompt === "dark" && L1[1][0].fill === pal.accent, L1[0][0]);
check("...without (unticked / no description): the colour rectangles as before", L0[0][0].t === "rect" && L0[1][0].t === "rect");
const cr = src("ext/imageeditdock/pccreate.js");
check("lay: the background's stand-in is whole (not faded), the picture goes in its place under the words, clipped to round corners; made when ticked",
  /e\.t === "picture" && !e\.bg\) L\.opacity = 0\.35/.test(cr) && /S\.layers\.splice\(Math\.min\(at, S\.layers\.length\), 0, NL\)/.test(cr) && /roundRect\(e\.x, e\.y, e\.w, e\.h/.test(cr) && /plan\.bgPics = a\.backgrounds !== false/.test(cr) && /lay\(pages, !!a\.pictures \|\| !!plan\.bgPics/.test(cr));
const bz = src("ext/imageeditdock/pcbizinfo.js"), ui = src("ext/imageeditdock/pcui.js");
check("the business details dialog: ☑ 🖼 Backgrounds (kept), the description labels say the background is made from them, backgrounds passed to make()",
  /id="pcbzBgs"/.test(bz) && /create\.cardBgs/.test(bz) && /its background is made from this/.test(bz) && /backgrounds: bgs/.test(bz));
check("...wider (860 px, never past the window), the body scrolls, the grid's columns shrink (minmax(0,1fr)) and rows wrap - nothing past the frame",
  /width: "min\(860px, 96vw\)", scroll: true/.test(bz) && /minmax\(0,1fr\) minmax\(0,1fr\)/.test(bz) && /\.pcbz \.kxrow\{flex-wrap:wrap/.test(bz) && !/min-width:min\(620px/.test(bz)
  && /if \(o\.width\) \{ d\.style\.width = o\.width; d\.style\.maxWidth = "96vw"; \}/.test(ui) && /if \(o\.scroll\)/.test(ui));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

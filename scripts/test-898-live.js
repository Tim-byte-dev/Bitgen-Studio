#!/usr/bin/env node
/* bitGen Studio — 2.898.0 LIVE: 📇 the card stocks in the same database as the business details (lib/businessDb.js +
 * lib/cardStocks.js) against a REAL MariaDB - computer A has a stock, moves the details to the database: the stock goes too
 * (business_card_stocks, mm as numbers); computer B moves there and has it; B changes it, A sees it on its sync; one name = one
 * stock (B's stock of the same name updates the row, both computers end with one); a delete goes from both; the database not
 * answering keeps a stock's change waiting, sent when it answers. Needs MariaDB (with its install script) - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  if (!f || !f.installDb || !/mariadbd/.test(f.bin)) { console.log("SKIP: no MariaDB here"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); return; }
  const BP = require(path.join(ROOT, "lib/businessProfiles.js")), BD = require(path.join(ROOT, "lib/businessDb.js")), CS = require(path.join(ROOT, "lib/cardStocks.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t898l-")), A = path.join(tmp, "pcA", "business"), B = path.join(tmp, "pcB", "business");
  D.setBase(tmp, path.join(tmp, "projdb")); BD.setDb(D);
  const on = (dir) => { BP.setRoot(dir); CS._setRoot(dir); };
  const stock = { name: "My 10-up", paper: { w: 210, h: 297 }, cols: 2, rows: 5, cw: 85, ch: 54, top: 13.5, left: 15, hpitch: 95, vpitch: 54 };
  const tick = () => new Promise((r) => setTimeout(r, 15));
  try {
    on(A);
    BP.save({ company: "Rosie's Bakery", name: "Rosie" });
    const s1 = CS.save(stock);
    const mv = await BD.move({ scope: "global", db: "bitgen_business" });
    const q = async (sql, a) => (await D.run("global", "bitgen_business", sql)).results[0].rows;
    const row = (await q("SELECT name, paper_w, across_n, down_n, card_w, top_mm, pitch_across, updated_by FROM business_card_stocks"))[0];
    check("🗄 A moves to the database: its card stock goes too (1 card stock), a row in business_card_stocks with every size", mv.stocksSent === 1 && row && row.name === "My 10-up" && +row.paper_w === 210 && +row.across_n === 2 && +row.down_n === 5 && +row.card_w === 85 && +row.top_mm === 13.5 && +row.pitch_across === 95, { mv, row });
    check("...A's copy: the stock as numbers again (from the database), the status counts it", CS.list().stocks.length === 1 && CS.list().stocks[0].cw === 85 && CS.list().stocks[0].top === 13.5 && BD.status().stocks === 1, CS.list());
    on(B);
    const mvB = await BD.move({ scope: "global", db: "bitgen_business" });
    check("💻 B moves there: it has A's stock (nothing of its own sent)", mvB.stocksSent === 0 && CS.list().stocks.length === 1 && CS.list().stocks[0].id === s1.id && CS.list().stocks[0].vpitch === 54, CS.list());
    await tick(); const b1 = CS.save(Object.assign({}, CS.list().stocks[0], { top: 12 })); await BD.changed("stock-save", b1.id);
    on(A); await BD.sync();
    check("...B moves its top margin to 12 mm: A sees it on its sync", CS.list().stocks[0].top === 12, CS.list());
    // one name, one stock: B makes a NEW stock with the same name (another id) while A's exists
    on(B);
    const raw = CS.raw(); fs.writeFileSync(CS.file(), JSON.stringify({ version: 1, stocks: raw.concat([{ id: "stB2", name: "My 10-up", paper: { w: 210, h: 297 }, cols: 2, rows: 5, cw: 85, ch: 54, top: 11, left: 15, hpitch: 95, vpitch: 54, created: new Date().toISOString(), updated: new Date().toISOString() }]).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i) }));
    await BD.changed("stock-save", "stB2");
    const n = (await q("SELECT COUNT(*) AS n FROM business_card_stocks"))[0].n;
    check("...one name = one stock: the same name under another id updates the database's row (still 1), B's copy is that one", +n === 1 && CS.list().stocks.length === 1 && CS.list().stocks[0].top === 11, { n, here: CS.list().stocks });
    // the database not answering
    BD.setDb(Object.assign({}, D, { createDb: async () => { throw new Error("connect ECONNREFUSED (the server is down)"); } }));
    await tick(); const b2 = CS.save(Object.assign({}, CS.list().stocks[0], { left: 16 }));
    const off = await BD.changed("stock-save", b2.id);
    check("⚠ the database does not answer: the stock's change kept here, waiting (1)", !off.ok && off.waiting === 1 && BD.status().waiting === 1 && CS.list().stocks[0].left === 16, off);
    BD.setDb(D); const back = await BD.sync();
    check("...sent when it answers", back.ok && BD.status().waiting === 0 && +(await q("SELECT left_mm FROM business_card_stocks"))[0].left_mm === 16, back);
    // delete
    CS.remove(CS.list().stocks[0].id); await BD.changed("stock-remove", b2.id);
    on(A); await BD.sync();
    check("🗑 B deletes it: gone from the database and from A's copy", +(await q("SELECT COUNT(*) AS n FROM business_card_stocks"))[0].n === 0 && CS.list().stocks.length === 0);
    await BD.move({ mode: "file" });
    CS.save(Object.assign({}, stock, { name: "Only here" }));
    check("📁 back on this computer: a stock saved then stays in the file only", BD.status().mode === "file" && CS.list().stocks.length === 1 && +(await q("SELECT COUNT(*) AS n FROM business_card_stocks"))[0].n === 0);
  } catch (e) { check("ran: " + e.message, false); console.log(e.stack); }
  finally { try { await D.stop("global"); } catch (e) { /* stopped */ } fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

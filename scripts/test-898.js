#!/usr/bin/env node
/* bitGen Studio — 2.898.0 units: 📇 the card stocks in the same database as the business details (lib/businessDb.js: the
 * business_card_stocks table, a stock's change waiting when the database does not answer, routes/cardStocks.js syncing first and
 * sending saves / deletes) and the References docker's drag-to-reorder (static/refreorder.js: picture 6 onto picture 1 = picture 1,
 * the prompt's <Picture n> / <Video n> / <Audio n> tags follow; loaded by index.html). The real database: test-898-live.js. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const RO = require("../static/refreorder.js");
  check("move: picture 6 onto picture 1 -> 6 first, 1 - 5 down one", RO.move([1, 2, 3, 4, 5, 6], 5, 0).join() === "6,1,2,3,4,5");
  check("...picture 1 onto picture 3 -> it takes place 3, 2 and 3 up one; the same place = unchanged; out of range clamped", RO.move(["a", "b", "c", "d"], 0, 2).join() === "b,c,a,d" && RO.move(["a", "b"], 1, 1).join() === "a,b" && RO.move(["a", "b", "c"], 0, 99).join() === "b,c,a");
  check("positions: where each old place lands (6 items, 6 -> 1)", RO.positions(6, 5, 0).join() === "1,2,3,4,5,0");
  check("retag: the prompt's tags still name the same pictures (6 -> 1: <Picture 6> = 1, <Picture 1> = 2), other kinds and unknown numbers left alone",
    RO.retag("<Picture 6> hugs <Picture 1>; <Picture 9> <Video 1>", "Picture", 6, 5, 0) === "<Picture 1> hugs <Picture 2>; <Picture 9> <Video 1>");
  check("...videos and sounds the same way", RO.retag("<Video 1> then <Video 3>", "Video", 3, 0, 2) === "<Video 3> then <Video 2>" && RO.retag("<Audio 2>", "Audio", 2, 1, 0) === "<Audio 1>");
  const ro = src("static/refreorder.js"), ix = src("static/index.html");
  check("the page: refreorder.js loaded after refinfo.js; the tray's pictures + #refvids / #refauds items; the arrays changed in place (refs, refVids, refAuds); repainted; a picked group still goes to the timeline",
    /<script src="\/static\/refinfo\.js"><\/script>\n<script src="\/static\/refreorder\.js"><\/script>/.test(ix) && /arr: "refs"/.test(ro) && /arr: "refVids"/.test(ro) && /arr: "refAuds"/.test(ro) && /arr\.splice\(0, n, \.\.\.now\)/.test(ro)
    && /call\("renderTray"\)/.test(ro) && /\.slot\.rsel"\)\.length > 1\) return;/.test(ro) && /editable\(e\.target\)/.test(ro));

  // 📇 the card stocks in the database (no database here: the waiting part)
  const BP = require("../lib/businessProfiles"), BD = require("../lib/businessDb"), CS = require("../lib/cardStocks");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t898-")); BP.setRoot(tmp); CS._setRoot(tmp);
  BD.setDb({ find: () => ({ bin: "mariadbd" }), externalCfg: () => ({}), createDb: async () => { throw new Error("connect ECONNREFUSED"); } });
  try {
    const T = BD.SCHEMA.join("\n");
    check("the table business_card_stocks: every size in mm (DECIMAL), across / down, one name each (UNIQUE), who changed it",
      /CREATE TABLE IF NOT EXISTS business_card_stocks/.test(T) && ["paper_w", "paper_h", "card_w", "card_h", "top_mm", "left_mm", "pitch_across", "pitch_down"].every((c) => new RegExp(c + " DECIMAL\\(7,2\\)").test(T)) && /across_n SMALLINT/.test(T) && /UNIQUE KEY by_name \(name\)/.test(T) && /business_card_stocks[^"]*updated_by/.test(T.replace(/\n/g, " ")));
    const st = CS.save({ name: "10-up", paper: { w: 210, h: 297 }, cols: 2, rows: 5, cw: 85, ch: 54, top: 13.5, left: 15, hpitch: 95, vpitch: 54 });
    check("in file mode a stock's save reaches for no database", (await BD.changed("stock-save", st.id)).file === true && BD.status().stocks === 1);
    fs.writeFileSync(path.join(tmp, "store.json"), JSON.stringify({ mode: "db", scope: "global" }));
    const off = await BD.changed("stock-save", st.id);
    check("in a database that does not answer: the stock's change waits (counted with the details'), kept here", !off.ok && off.waiting === 1 && BD.store().pending.stockSave.join() === st.id && CS.list().stocks.length === 1, off);
    CS.remove(st.id); await BD.changed("stock-remove", st.id);
    check("...deleted while waiting: the waiting save becomes a waiting delete", BD.store().pending.stockSave.length === 0 && BD.store().pending.stockRemove.join() === st.id);
    check("lib/cardStocks: raw + adopt (the database's stocks become this computer's; a bad row left out)", CS.adopt([{ id: "x1", name: "From the DB", paper: { w: 210, h: 297 }, cols: 1, rows: 1, cw: 90, ch: 55, top: 10, left: 10, hpitch: 90, vpitch: 55 }, { id: "bad", name: "Bad", paper: { w: 210, h: 297 }, cols: 9, rows: 1, cw: 90, ch: 55 }]) === 1 && CS.raw()[0].name === "From the DB");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const rt = src("routes/cardStocks.js");
  check("routes/cardStocks: a list syncs first, a save / delete is sent (stock-save / stock-remove), the answer carries where they are kept",
    /BD\(\)\.sync\(\); return withStore\(S\(\)\.list\(\)/.test(rt) && /changed\("stock-save"/.test(rt) && /changed\("stock-remove"/.test(rt) && /store: Object\.assign\(BD\(\)\.status\(\)/.test(rt));
  check("the dialogs say so: the card sheet's Keep (in the business database / waiting), the details box (+ n card stocks moved, the stocks go with them)",
    /in the business database/.test(src("ext/imageeditdock/pccardsheet.js")) && /card stock\$\{j\.stocksSent > 1/.test(src("ext/imageeditdock/pcbizinfo.js")) && /your card stocks of 📇 Business Card Sheet/.test(src("ext/imageeditdock/pcbizinfo.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

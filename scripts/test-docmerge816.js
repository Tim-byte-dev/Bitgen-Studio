#!/usr/bin/env node
/* bitGen Studio — 2.816.0: mail merge in document text - the data (CSV / TSV / ; with quotes), fields filled into the
 * story for Preview Results, file names, the model's field runs, the server's merge (one .docx / one per record in a zip /
 * a Word mail-merge document + .csv), the pins.
 * Tim (verbatim): "i would actually like to keep comments, footnotes and mail merge" + "lets go with next, we will do all
 * the releases before i start testing". */
"use strict";
const fs = require("fs"), path = require("path");
const { JSDOM } = require("jsdom");
const ROOT = path.join(__dirname, "..");
const M = require("../ext/imageeditdock/pcdocmerge.js"), X = require("../ext/imageeditdock/pcdocx.js"), T = require("../ext/imageeditdock/pcdoctext.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const doc = new JSDOM("<!doctype html><body></body>").window.document;

(async () => {
  const c1 = M.parseCSV('﻿First Name,Last Name,Address\r\nAnna,"Smith, Jr",""12 Main St""\r\n"Bo","O""Neil","Line 1\nLine 2"\r\n\r\n');
  check("CSV: BOM, quoted commas, doubled quotes, a line break inside quotes, blank lines skipped", JSON.stringify(c1.fields) === '["First Name","Last Name","Address"]' && c1.rows.length === 2 && c1.rows[0][1] === "Smith, Jr" && c1.rows[1][1] === "O\"Neil" && c1.rows[1][2] === "Line 1\nLine 2", c1);
  const c2 = M.parseCSV("a;b;c\n1;2;3\n"), c3 = M.parseCSV("x\ty\n1\t2\n"), c4 = M.parseCSV("Name,Name,\nA,B,C\n");
  check("semicolons and tabs found by themselves; repeated / empty field names made unique", JSON.stringify(c2.rows) === '[["1","2","3"]]' && JSON.stringify(c3.fields) === '["x","y"]' && JSON.stringify(c4.fields) === '["Name","Name 2","Field 3"]', [c2, c3, c4]);
  const rec = M.recordOf(["First Name", "City"], ["Anna", "Perth\nWA"]);
  const tpl = T.sanitize('<p>Dear <span data-field="First Name">«First Name»</span>,</p><p><span data-field="City">«City»</span> <span data-field="Missing">«Missing»</span></p>', doc);
  const f = M.fillHtml(tpl, rec, doc);
  check("Preview: each field replaced by the record's value (line breaks kept, unknown fields empty), the story untouched", f === "<p>Dear Anna,</p><p>Perth<br>WA </p>" && /data-field/.test(tpl), f);
  check("file names from a pattern (record number, a field, bad characters out)", M.fileName("«#» - «Last»", { Last: "O/Neil?" }, 4) === "5 - O_Neil_" && M.fileName("", {}, 0) === "Record 1");
  // the model + the server
  const B = X.toModel(tpl + '<p>Note<sup data-fn="f1">1</sup> <span data-cid="c1">here</span></p>', doc);
  check("the model: a merge field is its own run (field + «Name»)", B[0].runs.some((r) => r.field === "First Name" && r.text === "«First Name»"), B[0].runs);
  const DM = require("../lib/docxMerge"), JSZip = require("jszip");
  const filled = DM.fill(B, { "First Name": "Anna", City: "Perth\nWA" }, "_3");
  check("server fill: values in, line breaks as breaks, comments out, footnotes the record's own", filled[0].runs.map((r) => r.text).join("") === "Dear Anna," && filled[1].runs.filter((r) => r.br).length === 1 && !filled[2].runs.some((r) => r.cmt) && filled[2].runs.some((r) => r.fn === "f1_3"), filled);
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "merge816-"));
  const core = require("../lib/core"); const keep = core.pDir; core.pDir = (k) => path.join(tmp, k);
  const D = require("../lib/docxFiles"); const dir0 = D.dir;
  try {
    const model = { page: { wmm: 210, hmm: 297 }, blocks: B, footnotes: { f1: "A note." }, comments: [{ id: "c1", author: "A", text: "x" }] };
    const fields = ["First Name", "City"], rows = [["Anna", "Perth"], ["Bo", "Sydney"], ["Cy", "Hobart"]];
    const one = await DM.run({ model, fields, rows, mode: "one", name: "Letters" });
    const z1 = await JSZip.loadAsync(fs.readFileSync(D.file(one.name))), x1 = await z1.file("word/document.xml").async("string");
    check("one .docx: every record (Anna, Bo, Cy), each after the first from a new page, 3 footnotes, no comments", one.name === "Letters.docx" && one.records === 3 && /Anna/.test(x1) && /Sydney/.test(x1) && /Hobart/.test(x1) && (x1.match(/<w:pageBreakBefore\/>/g) || []).length === 2 && (x1.match(/<w:footnoteReference /g) || []).length === 3 && !/commentRangeStart/.test(x1), one);
    const each = await DM.run({ model, fields, rows: rows.concat([["Anna", "Perth"]]), first: 1, mode: "each", name: "Letters", each: "«First Name» - «City»" });
    const z2 = await JSZip.loadAsync(fs.readFileSync(D.file(each.name)));
    check("one per record in a .zip, named by the pattern, a repeated name numbered", each.name === "Letters.zip" && JSON.stringify(Object.keys(z2.files).sort()) === JSON.stringify(["Anna - Perth (2).docx", "Anna - Perth.docx", "Bo - Sydney.docx", "Cy - Hobart.docx"]), Object.keys(z2.files));
    const w = await DM.run({ model, fields, rows, mode: "word", name: "Letters" });
    const z3 = await JSZip.loadAsync(fs.readFileSync(D.file(w.name))), names = Object.keys(z3.files);
    const x3 = await (await JSZip.loadAsync(await z3.file("Letters.docx").async("nodebuffer"))).file("word/document.xml").async("string");
    const csv = await z3.file("Letters - data.csv").async("string");
    check("Word mail-merge pack: the .docx with MERGEFIELDs + the data as .csv", w.name === "Letters - mail merge.zip" && names.includes("Letters.docx") && /MERGEFIELD First Name/.test(x3) && /MERGEFIELD City/.test(x3) && /^﻿First Name,City\r\nAnna,Perth/.test(csv), { names, csv: csv.slice(0, 60) });
    check("CSV out: quotes where needed", DM.csvOf(["a"], [['x,"y"']]) === '﻿a\r\n"x,""y"""\r\n');
    check("refused: no fields / no records / no document", await DM.run({ model, fields: [], rows }).then(() => false, (e) => e.status === 400) && await DM.run({ model, fields, rows: [], mode: "one" }).then(() => false, (e) => /no records/.test(e.message)) && await DM.run({ fields, rows }).then(() => false, () => true));
  } finally { core.pDir = keep; void dir0; fs.rmSync(tmp, { recursive: true, force: true }); }
  // pins
  const IE = src("ext/imageeditdock/imageedit.js"), EX = JSON.parse(src("ext/imageeditdock/ext.json")), DT = src("ext/imageeditdock/pcdoctext.js"), DMg = src("ext/imageeditdock/pcdocmerge.js"), RT = src("routes/docx.js"), PK = JSON.parse(src("package.json"));
  check("pcdocmerge.js after pcdocnotes.js, installed after PCDocNotes", EX.scripts.indexOf("pcdocmerge.js") === EX.scripts.indexOf("pcdocnotes.js") + 1 && IE.indexOf("PCDocMerge.install(E)") > IE.indexOf("PCDocNotes.install(E)"));
  check("the frames show a record through PCDocText.viewOf (the story keeps its fields)", /const view = PCDocText\.viewOf \? PCDocText\.viewOf\(head\) : null;/.test(DT) && /xhtmlOf\(doc, D\.view \|\| D\.html/.test(DT) && /PCDocText\.viewOf = \(head\)/.test(DMg));
  check("«» Merge ▾: Data Source…, Insert Merge Field…, Preview Results, ◀ / ▶, Finish & Merge…; POST /api/docx/merge in routes/docx.js", ["doc.merge.source", "doc.merge.field", "doc.merge.preview", "doc.merge.prev", "doc.merge.next", "doc.merge.finish"].every((c) => DMg.includes(`"${c}"`)) && /app\.post\("\/api\/docx\/merge"/.test(RT));
  check("jszip (MIT) a dependency, credited", PK.dependencies.jszip && /JSZip/.test(src("lib/credits.json")) && /jszip/i.test(src("misc/NOTICE.md")));
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();

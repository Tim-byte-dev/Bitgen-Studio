// bitGen Studio — lib/docxMerge.js (2.816.0): mail merge of the image editor's document text into Word files.
//
// Tim (verbatim): "i would actually like to keep comments, footnotes and mail merge" (the WORD PLAN's step 4). The page
// (ext/imageeditdock/pcdocmerge.js) sends the story's model (pcdocx.js - merge fields are runs with `field`), the data's
// fields + rows and what to make:
//   one   one .docx, every record from a new page
//   each  a .zip of one .docx per record, named by a pattern ("«#» - «Last Name»")
//   word  a .zip of a Word mail-merge document (its fields are Word's own MERGEFIELDs) + the data as .csv, for Word's
//         Mailings ▸ Select Recipients ▸ Use an Existing List
// Comments are left out of merged letters; each record's footnotes are its own. Written with lib/docxFiles.js build();
// zips with JSZip (MIT).
"use strict";
const D = require("./docxFiles");

const MAX_ROWS = 5000;
function bad(msg) { const e = new Error(msg); e.status = 400; return e; }
const recordOf = (fields, row) => { const o = {}; (fields || []).forEach((f, i) => { o[f] = row ? String(row[i] == null ? "" : row[i]) : ""; }); return o; };
function fileName(pattern, rec, i) {
  const s = String(pattern || "Record «#»").replace(/«#»/g, String(i + 1)).replace(/«([^»]+)»/g, (a, f) => (rec && rec[f] != null ? rec[f] : ""));
  return s.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim().slice(0, 100) || "Record " + (i + 1);
}
/** the blocks with each field run turned into its value (or Word's MERGEFIELD when rec is null); comments dropped;
 *  footnote ids made the record's own (suffix) */
function fill(blocks, rec, suffix) {
  const runs = (rs) => {
    const out = [];
    for (const r0 of rs || []) {
      const r = Object.assign({}, r0); delete r.cmt;
      if (r.fn && suffix) r.fn = r.fn + suffix;
      if (r.field) {
        const f = r.field; delete r.field;
        if (!rec) { out.push({ mergefield: f }); continue; }
        String(rec[f] == null ? "" : rec[f]).split(/\r?\n/).forEach((line, i) => out.push(Object.assign({}, r, { text: line }, i ? { br: true } : {})));
        continue;
      }
      out.push(r);
    }
    return out;
  };
  const blk = (b) => {
    const c = Object.assign({}, b);
    if (c.runs) c.runs = runs(c.runs);
    if (c.rows) c.rows = c.rows.map((row) => row.map((cell) => Object.assign({}, cell, { blocks: (cell.blocks || []).map(blk) })));
    return c;
  };
  return (blocks || []).map(blk);
}
function csvOf(fields, rows) {
  const q = (v) => (/[",\r\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  return "﻿" + [fields].concat(rows).map((r) => r.map((v) => q(v == null ? "" : v)).join(",")).join("\r\n") + "\r\n";
}
async function run(o) {
  const model = o.model, fields = Array.isArray(o.fields) ? o.fields.map(String) : [], rows = Array.isArray(o.rows) ? o.rows.slice(0, MAX_ROWS) : [];
  if (!model || !Array.isArray(model.blocks)) throw bad("no document to merge");
  if (!fields.length) throw bad("no data fields");
  const mode = ["one", "each", "word"].includes(o.mode) ? o.mode : "one", first = Math.max(1, +o.first || 1), name = String(o.name || "Merged");
  const base = Object.assign({}, model, { comments: [] });
  if (mode === "word") {
    const JSZip = require("jszip"), z = new JSZip();
    const docBuf = await D.build(Object.assign({}, base, { blocks: fill(model.blocks, null, "") }));
    z.file(D.safeName(name), docBuf);
    z.file(D.safeName(name).replace(/\.docx$/, "") + " - data.csv", csvOf(fields, rows));
    const buf = await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return Object.assign(D.save(name + " - mail merge", buf, ".zip"), { records: rows.length });
  }
  if (!rows.length) throw bad("no records to merge");
  if (mode === "one") {
    const blocks = [], footnotes = {};
    rows.forEach((row, i) => {
      const sfx = "_" + (i + 1), b = fill(model.blocks, recordOf(fields, row), sfx);
      if (i) { if (b[0] && b[0].t === "p") b[0] = Object.assign({}, b[0], { pageBreak: true }); else b.unshift({ t: "p", runs: [], pageBreak: true }); }
      blocks.push(...b);
      for (const [id, t] of Object.entries(model.footnotes || {})) footnotes[id + sfx] = t;
    });
    const buf = await D.build(Object.assign({}, base, { blocks, footnotes }));
    return Object.assign(D.save(name, buf), { records: rows.length });
  }
  const JSZip = require("jszip"), z = new JSZip(), used = new Set();
  for (let i = 0; i < rows.length; i++) {
    const rec = recordOf(fields, rows[i]);
    let fn = fileName(o.each, rec, first - 1 + i), k = 2; while (used.has(fn.toLowerCase())) fn = fileName(o.each, rec, first - 1 + i) + " (" + k++ + ")";
    used.add(fn.toLowerCase());
    z.file(fn + ".docx", await D.build(Object.assign({}, base, { blocks: fill(model.blocks, rec, "") })));
  }
  const buf = await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return Object.assign(D.save(name, buf, ".zip"), { records: rows.length });
}

module.exports = { run, fill, recordOf, fileName, csvOf, MAX_ROWS };

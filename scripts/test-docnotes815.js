#!/usr/bin/env node
/* bitGen Studio — 2.815.0: comments + footnotes in document text - the marks kept by the cleaner, footnotes numbered and
 * laid out per frame (pcdoctext renumber / notesBlock), comments wrapped (pcdocnotes), both in the .docx model, written
 * by docx and read back by mammoth (lib/docxFiles.js), the pins.
 * Tim (verbatim): "i would actually like to keep comments, footnotes and mail merge" + "lets go with next, we will do all
 * the releases before i start testing". */
"use strict";
const fs = require("fs"), path = require("path");
const { JSDOM } = require("jsdom");
const ROOT = path.join(__dirname, "..");
const T = require("../ext/imageeditdock/pcdoctext.js"), N = require("../ext/imageeditdock/pcdocnotes.js"), X = require("../ext/imageeditdock/pcdocx.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const doc = new JSDOM("<!doctype html><body></body>").window.document;

(async () => {
  const h = T.sanitize('<p>One<sup data-fn="fa">9</sup> <span data-cid="c1" data-done="1">two</span> <span data-field="First Name">«First Name»</span> <sup data-fn="bad id!">x</sup><span data-cid="<x>">y</span></p>', doc);
  check("the cleaner keeps a footnote mark, a comment's words (+ resolved) and a merge field; bad ids dropped", /<sup data-fn="fa">9<\/sup>/.test(h) && /<span data-cid="c1" data-done="1">two<\/span>/.test(h) && /<span data-field="First Name">/.test(h) && !/bad id/.test(h) && !/data-cid="&lt;/.test(h), h);
  const rn = T.renumber('<p>a<sup data-fn="f2">7</sup> b<sup data-fn="f1">7</sup> c<sup data-fn="gone">3</sup></p>', { f1: "one", f2: "two", f9: "old" }, doc);
  check("footnotes numbered in story order; a mark with no note goes; a note with no mark goes", /<sup data-fn="f2">1<\/sup>/.test(rn.html) && /<sup data-fn="f1">2<\/sup>/.test(rn.html) && !/gone/.test(rn.html) && JSON.stringify(rn.ids) === '["f2","f1"]' && !rn.notes.f9, rn);
  const nb = T.notesBlock([[1, "A <source>"], [2, "line\nbreak"]]);
  check("the notes block: a short rule, number + text (escaped, line breaks kept)", /class="pcfnrule"/.test(nb) && /<p><sup>1<\/sup> A &lt;source&gt;<\/p>/.test(nb) && /line<br>break/.test(nb), nb);
  check("CSS: footnote marks small, comment marks yellow (pale when resolved / hidden), merge fields blue, the notes 9 pt", /sup\[data-fn\]\{font-size:\.7em/.test(T.CSS) && /span\[data-cid\]\{background:#fff0a0/.test(T.CSS) && /\.pcnocmt span\[data-cid\]\{background:none/.test(T.CSS) && /span\[data-field\]\{background:#e3ecfa/.test(T.CSS) && /\.pcfn\{font-size:9pt/.test(T.CSS));
  // wrapRange: a selection inside one paragraph, and one running into the next (cut to the first)
  const box = doc.createElement("div"); box.innerHTML = "<p>alpha <b>beta</b> gamma</p><p>delta</p>"; doc.body.appendChild(box);
  const p1 = box.firstChild, r = doc.createRange(); r.setStart(p1.firstChild, 2); r.setEnd(p1.childNodes[1].firstChild, 2);
  N.wrapRange(r, "c7", doc);
  check("a comment wraps the selected words (across bold)", /<p>al<span data-cid="c7">pha <b>be<\/b><\/span><b>ta<\/b> gamma<\/p>/.test(box.innerHTML), box.innerHTML);
  const r2 = doc.createRange(); r2.setStart(box.querySelector("p:last-child").firstChild, 1); r2.setEnd(box.querySelector("p:last-child").firstChild, 3);
  const p0 = box.firstChild; const r3 = doc.createRange(); r3.setStart(p0.lastChild, 1); r3.setEnd(box.querySelector("p:last-child").firstChild, 3);
  N.wrapRange(r3, "c8", doc);
  check("a selection running into the next paragraph is cut to the first", /<span data-cid="c8">gamma<\/span><\/p><p>delta<\/p>/.test(box.innerHTML.replace(/ gamma/, "gamma").replace(/> /, ">")) || /<span data-cid="c8">[^<]*<\/span><\/p><p>delta<\/p>/.test(box.innerHTML), box.innerHTML);
  void r2;
  check("comments cleaned: ids, plain text, done", JSON.stringify(N.clean([{ id: "c1", author: "A", text: "t", done: 1 }, { id: "<b>" }, null])) === '[{"id":"c1","author":"A","text":"t","date":"","done":true}]');
  /* the model */
  const B = X.toModel('<p>Hi <span data-cid="c1">there</span> you<sup data-fn="f1">1</sup>.</p>', doc);
  const rs = B[0].runs;
  check("the model: a comment's run carries cmt, a footnote mark is its own run (fn, no text)", rs.some((x) => x.cmt === "c1" && x.text === "there") && rs.some((x) => x.fn === "f1" && x.text === "") && !rs.some((x) => /1/.test(x.text)), rs);
  /* the server */
  const D = require("../lib/docxFiles");
  const m = { page: { wmm: 210, hmm: 297 }, blocks: B, comments: [{ id: "c1", author: "Tim Paul", text: "Is this right?", date: "2026-11-17 10:00" }], footnotes: { f1: "Source: the 2025 survey." } };
  const buf = await D.build(m);
  const JSZip = require("jszip"), z = await JSZip.loadAsync(buf), xml = await z.file("word/document.xml").async("string");
  const cx = z.file("word/comments.xml") ? await z.file("word/comments.xml").async("string") : "", fx = z.file("word/footnotes.xml") ? await z.file("word/footnotes.xml").async("string") : "";
  check(".docx: a comment range + reference round the words, comments.xml with author + initials + text", /<w:commentRangeStart w:id="0"\/>/.test(xml) && /<w:commentRangeEnd w:id="0"\/>/.test(xml) && /<w:commentReference w:id="0"\/>/.test(xml) && /w:author="Tim Paul"/.test(cx) && /w:initials="TP"/.test(cx) && /Is this right\?/.test(cx), cx.slice(-400));
  check(".docx: a real footnote (reference + footnotes.xml)", /<w:footnoteReference w:id="1"\/>/.test(xml) && /Source: the 2025 survey\./.test(fx));
  const back = await D.read(buf);
  check("read back: the footnote mark + its note, the comment on the word before its reference (author's initials)", /<sup data-fn="f1">\*<\/sup>/.test(back.html) && back.notes.f1 === "Source: the 2025 survey." && /<span data-cid="cm0">there<\/span>/.test(back.html) && back.comments[0].text === "Is this right?" && back.comments[0].author === "TP", back);
  const again = T.renumber(T.sanitize(back.html, doc), back.notes, doc);
  check("…and the page's cleaner + numbering take it", /<sup data-fn="f1">1<\/sup>/.test(again.html) && /data-cid="cm0"/.test(again.html), again.html);
  /* pins */
  const IE = src("ext/imageeditdock/imageedit.js"), EX = JSON.parse(src("ext/imageeditdock/ext.json")), DT = src("ext/imageeditdock/pcdoctext.js"), DN = src("ext/imageeditdock/pcdocnotes.js");
  check("pcdocnotes.js after pcdocx.js, installed after PCDocx", EX.scripts.indexOf("pcdocnotes.js") === EX.scripts.indexOf("pcdocx.js") + 1 && IE.indexOf("PCDocNotes.install(E)") > IE.indexOf("PCDocx.install(E)"));
  check("flowStory keeps room at a frame's foot for its notes (worked out again until it settles); draw puts them there", /for \(let it = 0; it < 5; it\+\+\)/.test(DT) && /f\.L\.doc\.h \/ k - fnH\[i\]/.test(DT) && /class="pcdoc pcfn" style="position:absolute;left:0;top:\$\{hC - \(D\.fnH \|\| 0\)\}px/.test(DT));
  check("commands: 💬 New Comment, 💬 Comments, ¹ Insert Footnote, Edit Footnote…, View ▸ Show Comments; Ctrl+Alt+M / Ctrl+Alt+F", ["doc.comment.new", "doc.comment.panel", "doc.fn.new", "doc.fn.edit", "view.showcomments"].every((c) => DN.includes(`"${c}"`)) && /k === "m"/.test(DN) && /k === "f"/.test(DN));
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();

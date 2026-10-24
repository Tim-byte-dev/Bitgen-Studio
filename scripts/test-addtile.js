#!/usr/bin/env node
/* bitGen Studio — 2.394.0 unit tests: the "+ add" placeholder tiles (static/addtile.js) and their wiring.
 * Tim (verbatim): "add a + video placeholder to reference docker video and sound tab and assets dockers image sound and
 * video tabs to add a video , picture or sound, user will be able to select multiple files with ctrl or shift like in
 * the windows 11 file docker . make the docker configs button icon only" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

const A = require("../static/addtile.js");

// the kinds = what the server takes (lib/core.js PKINDS)
const core = read("lib/core.js");
const pk = /const PKINDS = (\{[\s\S]*?\});/.exec(core);
const PK = pk ? Function("return " + pk[1])() : null;
check("the extensions are the server's (lib/core.js PKINDS)", PK && JSON.stringify(PK) === JSON.stringify(A.EXTS), { PK, mine: A.EXTS });
check("kindOf: by extension, any case, a path too; unknown / none = null",
  A.kindOf("a.MP4") === "video" && A.kindOf("C:\\x\\b.wav") === "sound" && A.kindOf("/y/c.jpeg") === "images" && A.kindOf("d.txt") === null && A.kindOf("noext") === null && A.kindOf("") === null);
check("accept: the kind's extensions, comma separated (the Open dialog's filter names them)",
  A.accept("video") === ".webm,.avi,.mp4,.mov,.mkv" && A.accept("sound").split(",").length === 6 && A.accept("nope") === "");
const sp = A.split([{ name: "a.mp4" }, { name: "b.wav" }, { name: "c.MOV" }, { name: "d.txt" }], "video");
check("split: the kind / another supported kind / not supported", sp.mine.map((f) => f.name).join() === "a.mp4,c.MOV" && sp.other.length === 1 && sp.bad[0].name === "d.txt", sp);
check("room: cap - used, never below 0, no cap = Infinity", A.room(1, 3) === 2 && A.room(5, 3) === 0 && A.room(0, 3) === 3 && A.room(2) === Infinity);
check("label: one left = singular, some left = '(n free)', all free / no cap = plural",
  A.label("video", 1, 3) === "+ add video" && A.label("video", 2, 3) === "+ add videos (2 free)" && A.label("video", 3, 3) === "+ add videos"
  && A.label("images", Infinity) === "+ add pictures" && A.label("sound", Infinity) === "+ add sounds", [A.label("video", 1, 3), A.label("video", 2, 3)]);

// a fake DOM: make() and pick()
{
  const made = [];
  const mk = (tag) => {
    const ev = {};
    const el = { tagName: tag.toUpperCase(), dataset: {}, attrs: {}, children: [], classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); } },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
      addEventListener(t, f) { ev[t] = f; }, fire(t, e) { return ev[t] && ev[t](e); },
      set innerHTML(h) { this._h = h; this._word = { textContent: "" }; }, get innerHTML() { return this._h; },
      querySelector(sel) { return sel === ".atword" ? this._word : null; },
      click() { this.clicked = (this.clicked || 0) + 1; } };
    made.push(el); return el;
  };
  const win = { document: { createElement: mk } };
  const src = read("static/addtile.js");
  Function("window", "globalThis", "module", src)(win, win, undefined);
  const T = win.AddTile;
  let got = null;
  const t = T.make({ kind: "video", free: 2, cap: 3, onFiles: (f) => { got = f; } });
  check("make: a focusable button tile, its kind, '+' and the words, a tooltip naming Ctrl / Shift",
    t.className === "addtile" && t.tabIndex === 0 && t.attrs.role === "button" && t.dataset.addkind === "video" && t._word.textContent === "add videos (2 free)"
    && t.attrs["aria-label"] === "+ add videos (2 free)" && /Ctrl-click or Shift-click/.test(t.title) && /atplus/.test(t._h), { cls: t.className, w: t._word.textContent, title: t.title });
  t.onclick({ stopPropagation() {} });
  const inp = made.filter((e) => e.tagName === "INPUT").pop();
  check("a click opens an <input type=file multiple> with the kind's extensions (bitGen's Open dialog takes several with Ctrl / Shift)",
    inp && inp.type === "file" && inp.multiple === true && inp.accept === A.accept("video") && inp.clicked === 1 && inp.dataset.addtile === "video", inp && { type: inp.type, multiple: inp.multiple, accept: inp.accept });
  inp.files = [{ name: "x.mp4" }, { name: "y.mov" }]; inp.onchange();
  check("...the picked files go to onFiles, all of them", got && got.length === 2 && got[1].name === "y.mov");
  got = null; inp.files = []; inp.onchange();
  check("...nothing picked (Cancel) = nothing happens", got === null);
  let prevented = 0;
  t.onkeydown({ key: "Enter", preventDefault() { prevented++; } });
  t.onkeydown({ key: " ", preventDefault() { prevented++; } });
  t.onkeydown({ key: "x", preventDefault() { prevented++; } });
  check("Enter / Space open it from the keyboard (not other keys)", made.filter((e) => e.tagName === "INPUT").length === 3 && prevented === 2);
  got = null; let stopped = 0;
  t.fire("drop", { dataTransfer: { files: [{ name: "z.mkv" }] }, preventDefault() {}, stopPropagation() { stopped++; } });
  check("files dropped on the tile go the same way, and stop there (the dock's drop would import them twice)", got && got[0].name === "z.mkv" && stopped === 1);
}

// the wiring
const H = read("static/index.html");
check("index.html loads static/addtile.js (before the app script)", /<script src="\/static\/addtile\.js"><\/script>/.test(H) && H.indexOf("/static/addtile.js") < H.indexOf("function renderRefLists"));
check("Assets: every tab's list is a .dpane-items, the tile above it (outside - AssetGroups repaints never remove it)",
  /data-apane="images" data-lb-group><div class="dpane-items"><\/div>/.test(H) && /data-apane="video" data-lb-group><div class="dpane-items"><\/div>/.test(H)
  && /assetAddTile\(kind, outer, pane\);[^\n]*\n\s*if \(window\.AssetGroups\) \{ window\.AssetGroups\.paint/.test(H)
  && /function assetAddTile\(kind, outer, pane\) \{[\s\S]{0,400}AddTile\.make\(\{ kind, onFiles: async \(files\) => \{ await importFiles\(files\); setAtab\(kind\); \} \}\)/.test(H));
check("References: + add video / + add sound while there is room (RCAP), into Assets then the list (refAddFiles -> importFiles -> refAccept)",
  /AddTile\.room\(refVids\.length, RCAP\.video\)/.test(H) && /AddTile\.room\(refAuds\.length, RCAP\.sound\)/.test(H)
  && /if \(fv\) rv\.appendChild\(AddTile\.make\(\{ kind: "video"/.test(H) && /if \(fa\) ra\.appendChild\(AddTile\.make\(\{ kind: "sound"/.test(H)
  && /async function refAddFiles\(files\) \{[\s\S]{0,300}await importFiles\(files, \(up\) => \{ ups\.push\(up\); \}\);[\s\S]{0,300}refAccept\(\{ type: "asset"/.test(H));
check("the tiles' look: dashed, tiger on hover / focus / a file over it", /\.addtile \{[^}]*border: 1px dashed var\(--line\)/.test(H) && /\.addtile:hover, \.addtile:focus-visible, \.addtile\.hot \{ border-color: var\(--tiger\)/.test(H));
const DC = read("static/dockcfg.js");
check("Docker configs: the menu bar button is the icon only (⊞), named by its tooltip and aria-label",
  /aria-label="Docker configs" aria-haspopup="true" aria-expanded="false">⊞<\/button>/.test(DC) && !/>⊞ Docker configs<\/button>/.test(DC) && /title="Docker configs - /.test(DC));
check("nothing added to server.js", !/addtile|AddTile/.test(read("misc/server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

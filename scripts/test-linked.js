// scripts/test-linked.js — 2.469.0: LINKED SMART OBJECTS (ext/imageeditdock/pclinked.js, lib/linkedStore.js,
// routes/linked.js) and PSD smart objects kept as smart objects (pcpsd.js) - the pure part, the store, the wiring.
// Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
"use strict";
const fs = require("fs"), path = require("path");
const K = require("../ext/imageeditdock/pclinked.js");
const ROOT = path.join(__dirname, "..");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra).slice(0, 500))); if (!ok) fail++; };

const q = K.quadOf([10, 20, 110, 20, 110, 70, 10, 70]);
check("quadOf / transformOf: a PSD placed layer's 8 numbers <-> a quad (TL, TR, BR, BL)", JSON.stringify(q) === "[[10,20],[110,20],[110,70],[10,70]]" && JSON.stringify(K.transformOf(q)) === "[10,20,110,20,110,70,10,70]" && K.quadOf([1, 2]) === null);
const g1 = K.guid("src:so1"), g2 = K.guid("src:so1"), g3 = K.guid("src:so2");
check("guid: the PSD writer's GUID shape; the same seed = the same GUID, another seed another", /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(g1) && g1 === g2 && g1 !== g3);
check("sniff: png / jpg / psd / gif / nothing", K.sniff(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])) === "png" && K.sniff(Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0])) === "jpg" && K.sniff(Uint8Array.from([0x38, 0x42, 0x50, 0x53, 0, 1, 0, 0])) === "psd" && K.sniff(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0])) === "gif" && K.sniff(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])) === null);
const st = K.staleOf([{ name: "a.png", mtime: 5 }, { name: "b.png", mtime: 7 }, { name: "a.png", mtime: 5 }, { name: "c.png", mtime: 1 }], { "a.png": 5, "b.png": 9, "c.png": 0 });
check("staleOf: a changed file once, a missing one", JSON.stringify(st) === '{"changed":["b.png"],"missing":["c.png"]}', st);

const LS = require(path.join(ROOT, "lib", "linkedStore.js"));
check("linkedStore: PNG / JPEG only, safe names in the folder", LS.kindOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])) === "png" && LS.kindOf(Buffer.from("hello world")) === null && LS.safeName("../../x/a b?.jpeg", "jpg") === "a b_.jpg" && LS.safeName("", "png") === "linked.png");
let err = ""; try { LS.file("../server.js"); } catch (e) { err = String(e.status); }
check("linkedStore.file refuses names that are no linked picture (404)", err === "404");

const IDX = fs.readFileSync(path.join(ROOT, "routes/index.js"), "utf8"), RT = fs.readFileSync(path.join(ROOT, "routes/linked.js"), "utf8"), SV = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const IE = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/imageedit.js"), "utf8"), PS = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcpsd.js"), "utf8"), LK = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pclinked.js"), "utf8");
const ext = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/imageeditdock/ext.json"), "utf8")).scripts;
check("wiring: routes/linked.js (save / list / stat / file) mounted from routes/index.js with lib/linkedStore.js - not server.js", /require\("\.\/linked"\)\.mount\(app\)/.test(IDX) && ["/api/linked/save", "/api/linked/list", "/api/linked/stat", "/api/linked/file/:name"].every((u) => RT.includes(u)) && /require\("\.\.\/lib\/linkedStore"\)/.test(RT) && !/linkedStore|api\/linked/.test(SV));
check("wiring: pclinked.js after pcwarp.js, installed right after PCSmart; Place Linked…, Convert to Linked…, Embed Linked, Update Modified Content, Relink to File…; Done writes back (the edit contents undo step); the 🔗 marks; focus + 20 s checks", ext.indexOf("pclinked.js") === ext.indexOf("pcwarp.js") + 1 && IE.indexOf("PCLinked.install(E)") > IE.indexOf("PCSmart.install(E)") && IE.indexOf("PCLinked.install(E)") < IE.indexOf("PCWarp.install(E)")
  && ["file.placelinked", "so.tolinked", "so.embed", "so.update", "so.relink"].every((c) => LK.includes(`C("${c}"`)) && /entry\.label !== "edit contents"/.test(LK) && /className = "lkb"/.test(LK) && /addEventListener\("focus"/.test(LK) && /setInterval\(check, 20000\)/.test(LK));
check("wiring: pcpsd opens embedded smart objects as smart objects (linkedFiles -> sources, placedLayer -> quad) and saves them as placed layers + embedded PNGs (a fallback to pixels)", /soSrc\.set\(lf\.id, c\)/.test(PS) && /L\.type = "smart"; L\.smart = \{ src: root\.PCSmart\.addSource\(src, null\)/.test(PS) && /o\.placedLayer = \{ id, placed:/.test(PS) && /psd\.linkedFiles\.push\(/.test(PS) && /notes\.smartPixels = lfs\.size/.test(PS));
console.log(fail ? `\n${fail} FAILED` : "\nall linked smart object checks passed");
process.exit(fail ? 1 : 0);

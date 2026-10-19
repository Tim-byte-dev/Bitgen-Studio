#!/usr/bin/env node
/* bitGen Studio — 2.436.0 units: bitGen's OWN FILES - .bgi (the image editor's project, a zip), .bgv (the timeline,
 * XML), .bgp (the whole project, XML: self-contained or a manifest). static/bgxml.js, static/bgzip.js, lib/bgFiles.js,
 * lib/bgVideo.js, lib/bgProject.js, routes/bgfiles.js, routes/bgp.js, ext/imageeditdock/pcbgi.js,
 * ext/timelinedock/bgv.js, static/bgp.js.
 * Tim: "save image edit project as .bgi, save video project as .bgv, save the overall project as .bgp in xml format". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const X = require(path.join(ROOT, "static", "bgxml.js"));
const Z = require(path.join(ROOT, "static", "bgzip.js"));
const BV = require(path.join(ROOT, "lib", "bgVideo.js"));
const BP = require(path.join(ROOT, "lib", "bgProject.js"));
const PB = require(path.join(ROOT, "ext", "imageeditdock", "pcbgi.js"));

(async () => {
  /* ---- the XML codec */
  const v = { a: 1, f: -0.000125, big: 1e21, s: 'x<y & "q" \'a\'\n\ttab \u0001 ü 🎞', e: "", t: true, n: null, arr: [1, [2, []], { k: "v" }], o: {}, "key with spaces & <": 3 };
  const xml = X.doc("t", { v: 1 }, [X.toXml(v, null, null, 0)]);
  check("BgXml: any JSON value -> XML -> exactly the same value (numbers, escaped text, control characters, unicode, empty arrays / objects, odd keys)", JSON.stringify(X.fromXml(xml)) === JSON.stringify(v), X.fromXml(xml));
  check("...readable: <o> <a> <s> <n> <b> <z/>, each member's key in k=\"…\"", /<n k="a">1<\/n>/.test(xml) && /<b k="t">true<\/b>/.test(xml) && /<z k="n"\/>/.test(xml) && /<s k="s">x&lt;y &amp; "q"/.test(xml));
  let threw = ""; try { X.parse("<a><b></a>"); } catch (e) { threw = e.message; }
  check("...a broken document is refused (</a> closes <b>)", /closes <b>/.test(threw), threw);
  check("...comments, <?xml?>, CDATA, entities read", X.fromXml("<?xml version='1.0'?><!-- hi --><r><s>a&#x41;&lt;<![CDATA[<raw>]]></s></r>") === "aA<<raw>");

  /* ---- the zip */
  const big = crypto.randomBytes(70000), rep = new Uint8Array(200000).fill(9);
  const z1 = Z.zip([{ name: "doc.xml", data: "héllo" }, { name: "l/1.png", data: big }]);
  const m1 = Z.unzip(z1);
  check("BgZip: stored entries (UTF-8 names / text, binary) back exactly; CRC checked", Z.text(m1.get("doc.xml")) === "héllo" && Buffer.compare(Buffer.from(m1.get("l/1.png")), big) === 0);
  const z2 = await Z.zipAsync([{ name: "sel.u8", data: rep, deflate: true }, { name: "a.png", data: big, deflate: false }]);
  const m2 = await Z.unzipAsync(z2);
  check("...zipAsync DEFLATEs the marked entries (a 200 KB mask -> a few hundred bytes), unzipAsync inflates", z2.length < big.length + 2000 && m2.get("sel.u8").length === 200000 && m2.get("sel.u8")[123] === 9, z2.length);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgf_"));
  fs.writeFileSync(path.join(tmp, "z.zip"), Buffer.from(z2));
  let unzipOk = null; try { unzipOk = require("child_process").execFileSync("unzip", ["-t", path.join(tmp, "z.zip")], { encoding: "utf8" }); } catch (e) { unzipOk = e.code === "ENOENT" ? "skip" : String(e.stdout || e.message); }
  check("...a standard zip (unzip -t: no errors)", unzipOk === "skip" || /No errors detected/.test(unzipOk), unzipOk);
  const bad = Buffer.from(z1); bad[200] ^= 0xff;
  threw = ""; try { Z.unzip(new Uint8Array(bad)); } catch (e) { threw = e.message; }
  check("...a damaged entry is refused (CRC)", /damaged|CRC/.test(threw), threw);

  /* ---- .bgv */
  const tl = { video: [{ name: "a.mp4", src: "video", start: 0, in: 0, out: 2 }, { name: "nest_n.mp4", src: "video", nest: "intro", start: 2 }],
    vlayers: [{ name: "T", clips: [{ name: "", text: { str: "hi" }, start: 0 }, { name: "Adj", adjust: true, fx: {} }, { name: "b.mp4", src: "video" }] }],
    audio: [{ name: "A", clips: [{ name: "s.wav", start: 0 }] }], images: [{ name: "I", clips: [{ name: "p.png", start: 1 }] }], markers: { refs: [] }, tc: { fps: 25 } };
  check("bgVideo.clipsOf: V1 + video layers + sound + picture layers", BV.clipsOf(tl).length === 7);
  const pdir = path.join(tmp, "P"); for (const d of ["video", "sound", "images", "output"]) fs.mkdirSync(path.join(pdir, d), { recursive: true });
  fs.writeFileSync(path.join(pdir, "video", "a.mp4"), "x"); fs.writeFileSync(path.join(pdir, "output", "b.mp4"), "x"); fs.writeFileSync(path.join(pdir, "images", "p.png"), "x");
  const media = BV.mediaOf(tl, BV.finder(pdir));
  check("mediaOf: one entry a file, where it was found (b.mp4 in output though its clip says video), what is missing; text / adjustment clips are not files",
    JSON.stringify(media.map((m) => [m.name, m.folder, m.kind, m.found])) === JSON.stringify([["a.mp4", "video", "video", true], ["nest_n.mp4", "video", "video", false], ["b.mp4", "output", "video", true], ["s.wav", "", "audio", false], ["p.png", "images", "image", true]]), media);
  check("nestsOf: the nested timelines its nest clips use", JSON.stringify(BV.nestsOf(tl)) === '["intro"]');
  const bx = BV.toXml({ tl, name: "main", project: "P", app: "2.436.0", nested: { intro: { video: [{ name: "a.mp4" }] } }, media });
  const back = BV.fromXml(bx);
  check(".bgv: <bitgen-video> with the timeline, its nested timelines and the media list -> read back exactly", /^<\?xml/.test(bx) && /<bitgen-video version="1" app="2.436.0" name="main" project="P"/.test(bx)
    && JSON.stringify(back.tl) === JSON.stringify(tl) && back.nested.intro.video[0].name === "a.mp4" && back.media.length === 5 && back.media[3].found === false && back.name === "main");
  threw = ""; try { BV.fromXml("<bitgen-video version=\"9\"><timeline><o></o></timeline></bitgen-video>"); } catch (e) { threw += e.status; }
  try { BV.fromXml("<other/>"); } catch (e) { threw += "," + e.status; }
  check("...a newer file version / not a .bgv = 400", threw === "400,400", threw);

  /* ---- .bgp */
  const P = path.join(tmp, "Proj"), w = (r, d) => { fs.mkdirSync(path.dirname(path.join(P, r)), { recursive: true }); fs.writeFileSync(path.join(P, r), d); };
  const media1 = crypto.randomBytes(1000003);
  w("Proj.prj", JSON.stringify({ a: 1, where: P + "/video/x.mp4", s: "x<y" })); w("timelines/main.json", JSON.stringify(tl)); w("chat/c.chat", "hello & <bye>\nü");
  w("video/x.mp4", media1); w("images/e.png", Buffer.alloc(0)); w("cache/c.bin", "zz"); w("recycle_bin/y", "q"); w("broken.json", "{nope"); w("video/half.mp4.part", "x");
  fs.mkdirSync(path.join(P, "sfx"), { recursive: true });
  const est = BP.estimate(P, {});
  check("bgProject.walk / estimate: the project's files (not the recycle bin, the caches, a file still being written), media vs text, the sizes", est.files === 6 && est.media === 2 && est.mediaBytes === 1000003 && est.embeddedBytes > 1333000 && est.manifestBytes < 5000, est);
  check("classify: JSON (.prj .json .seg) / text (.chat .srt .lrc .cube…) / binary", BP.classify("a.prj", 9) === "json" && BP.classify("x/a.chat", 9) === "text" && BP.classify("a.mp4", 9) === "binary" && BP.classify("a.json", 99e6) === "binary");
  const r1 = await BP.exportTo(P, path.join(tmp, "o.bgp"), { name: "Proj", app: "2.436.0" });
  const s1 = fs.readFileSync(path.join(tmp, "o.bgp"), "utf8");
  check(".bgp self-contained: <bitgen-project mode=embedded>, the .prj as value XML, text as text, the media base64 in 76-character lines, empty folders as <dir/>",
    r1.files === 6 && r1.embedded === 2 && /<bitgen-project version="1" app="2.436.0" name="Proj" dir="[^"]+" mode="embedded"/.test(s1) && /<file path="Proj.prj" size="\d+" type="json">\s*<o>/.test(s1)
    && /<file path="chat\/c.chat" size="\d+" type="text">hello &amp; &lt;bye&gt;/.test(s1) && /<file path="video\/x.mp4" size="1000003" type="base64">\n[A-Za-z0-9+/]{76}\n/.test(s1) && /<dir path="sfx"\/>/.test(s1) && !/cache\/c.bin|recycle_bin|half.mp4/.test(s1), r1);
  check("...peek: the root's attributes from the first 64 KB", BP.peek(path.join(tmp, "o.bgp")).name === "Proj" && BP.peek(path.join(tmp, "o.bgp")).mode === "embedded");
  const i1 = await BP.importFrom(path.join(tmp, "o.bgp"), path.join(tmp, "Q"), {});
  const same = (r) => Buffer.compare(fs.readFileSync(path.join(P, r)), fs.readFileSync(path.join(tmp, "Q", r))) === 0;
  check("...read back (streamed): the media byte for byte (a 1,000,003-byte file, an empty one), text exactly, JSON the same value, the empty folder made",
    i1.written === 6 && same("video/x.mp4") && same("images/e.png") && same("chat/c.chat") && same("broken.json") && JSON.parse(read(path.relative(ROOT, path.join(tmp, "Q", "Proj.prj")))).s === "x<y"
    && JSON.stringify(JSON.parse(fs.readFileSync(path.join(tmp, "Q", "timelines", "main.json"), "utf8"))) === JSON.stringify(tl) && fs.existsSync(path.join(tmp, "Q", "sfx")), i1);
  const r2 = await BP.exportTo(P, path.join(tmp, "m.bgp"), { embed: false, name: "Proj" });
  const s2 = fs.readFileSync(path.join(tmp, "m.bgp"), "utf8");
  check(".bgp manifest only: small, the media listed with where it is (type=external source=…)", r2.external === 2 && r2.size < 6000 && /<file path="video\/x.mp4" size="1000003" type="external" source="[^"]*x\.mp4"\/>/.test(s2), r2);
  const i2 = await BP.importFrom(path.join(tmp, "m.bgp"), path.join(tmp, "R"), {});
  fs.renameSync(path.join(P, "video", "x.mp4"), path.join(tmp, "x.mp4"));
  const i3 = await BP.importFrom(path.join(tmp, "m.bgp"), path.join(tmp, "S"), {});
  check("...opened: each listed file copied from where it is; one that is not on this computer = missing", i2.missing.length === 0 && Buffer.compare(fs.readFileSync(path.join(tmp, "R", "video", "x.mp4")), media1) === 0 && JSON.stringify(i3.missing) === '["video/x.mp4"]', [i2.missing, i3.missing]);
  fs.writeFileSync(path.join(tmp, "evil.bgp"), '<?xml version="1.0"?><bitgen-project version="1" name="E"><file path="../../x.txt" type="text">pwn</file><file path="/etc/y" type="text">pwn</file><file path="C:/w" type="text">pwn</file><file path="ok.txt" type="text">fine</file></bitgen-project>');
  const i4 = await BP.importFrom(path.join(tmp, "evil.bgp"), path.join(tmp, "E"), {});
  check("...a path out of the project (../, /…, C:) is left out - never written", i4.skipped.length === 3 && fs.readdirSync(path.join(tmp, "E")).join() === "ok.txt" && !fs.existsSync(path.join(tmp, "x.txt")), i4.skipped);
  fs.writeFileSync(path.join(tmp, "cut.bgp"), s1.slice(0, s1.length - 300));
  threw = ""; try { await BP.importFrom(path.join(tmp, "cut.bgp"), path.join(tmp, "C"), {}); } catch (e) { threw = e.message; }
  check("...a file cut short is an error (not half a project said to be whole)", /ends inside/.test(threw), threw);
  check("safeRel", BP.safeRel("a/b.png") === "a/b.png" && BP.safeRel("a\\b") === "a/b" && BP.safeRel("../a") === null && BP.safeRel("a//b") === null && BP.safeRel("/a") === null);

  /* ---- pcbgi's pure part */
  check("jsonSafe: plain values yes; a canvas-like object, a typed array, a Map, NaN no", PB.jsonSafe({ a: [1, { b: "x" }], n: null }) && !PB.jsonSafe(new Uint8Array(2)) && !PB.jsonSafe(new Map()) && !PB.jsonSafe(NaN) && !PB.jsonSafe({ c: new (class Canvas {})() }));
  const L = { id: 7, name: "T", type: "text", canvas: {}, mask: {}, fmask: {}, ver: 3, _skey: "x", visible: true, text: { str: "hi" }, smart: null, custom: { k: [1] }, fn() {}, bad: new Float32Array(2) };
  check("settingsOf: every JSON-safe field of a layer (new kinds of setting too), not its id / pixels / masks / private / functions / typed arrays",
    JSON.stringify(PB.settingsOf(L)) === '{"name":"T","type":"text","visible":true,"text":{"str":"hi"},"smart":null,"custom":{"k":[1]}}', PB.settingsOf(L));
  const m = { layers: [{ id: 5, parent: null }, { id: 6, parent: 5 }, { id: 9, parent: 4 }], comps: [{ id: "c1", layers: { 5: { v: true }, 6: { v: false }, 99: { v: true } } }], compLast: { layers: { 6: { v: true } } }, ptarget: { k: "shape", id: 6 } };
  PB.remap(m, new Map([[5, 50], [6, 60], [9, 90]]));
  check("remap: the new ids - parents (a missing parent = none), the comps' layers (a gone layer dropped), Last Document State, the path target",
    m.layers[1].parent === 50 && m.layers[2].parent === null && JSON.stringify(Object.keys(m.comps[0].layers)) === '["50","60"]' && Object.keys(m.compLast.layers)[0] === "60" && m.ptarget.id === 60, m);
  const refs = PB.refsOf([{ smart: { src: "so1", filters: [{ id: "blur" }, { id: "liquify", field: "lq1" }] } }, { smart: null }, {}]);
  check("refsOf: the smart sources / liquify fields the layers use", [...refs.smart].join() === "so1" && [...refs.fields].join() === "lq1");
  check("stemOf", PB.stemOf("a.b.png") === "a.b" && PB.stemOf("x.bgi") === "x" && PB.stemOf("y") === "y");

  /* ---- the wiring */
  const IDX = read("routes", "index.js"), IE = read("ext", "imageeditdock", "imageedit.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, TEXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts, IX = read("static", "index.html");
  check("routes/bgfiles.js + routes/bgp.js mounted from routes/index.js (server.js untouched)", /require\("\.\/bgfiles"\)\.mount\(app\)/.test(IDX) && /require\("\.\/bgp"\)\.mount\(app\)/.test(IDX) && !/bgFiles|bgProject|bgVideo|bgfiles|bgp"/.test(read("server.js")));
  check("pcbgi after pccomps (2.468.0: pcactionsx.js between), installed; File ▸ Open Project (.bgi)… / Open Project from Project… / Save Project (.bgi) Alt+Ctrl+S / Save Project As; Open… (Ctrl+O) takes a .bgi; the name kept per document (DOC_KEYS bgiName)",
    EXT.indexOf("pcbgi.js") === EXT.indexOf("pccomps.js") + 2 && EXT[EXT.indexOf("pccomps.js") + 1] === "pcactionsx.js" && /PCBgi\.install\(E\)/.test(IE) && /"file\.openbgi", "Open Project \(\.bgi\)…"/.test(read("ext", "imageeditdock", "pcbgi.js")) && /"file\.savebgi", "Save Project \(\.bgi\)", "Alt\+Ctrl\+S"/.test(read("ext", "imageeditdock", "pcbgi.js"))
    && /ief\.accept = "image\/\*,\.bgi"/.test(read("ext", "imageeditdock", "pcbgi.js")) && require(path.join(ROOT, "ext", "imageeditdock", "pcdocs.js")).DOC_KEYS.includes("bgiName"));
  check("the timeline's 🎞 (bgv.js after interchange.js, a toolbar button left of 🎤 - ⚙ stays last); the page loads bgxml / bgzip / bgp.js (📦 beside 💾)",
    TEXT.indexOf("bgv.js") === TEXT.indexOf("interchange.js") + 1 && /TlDlg\.button\("tlBgvBtn", "🎞"/.test(read("ext", "timelinedock", "bgv.js"))
    && ["bgxml", "bgzip", "bgp"].every((n) => IX.includes(`<script src="/static/${n}.js"></script>`)) && /b\.id = "projBgp"/.test(read("static", "bgp.js")));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed - " + e.stack); process.exit(1); });

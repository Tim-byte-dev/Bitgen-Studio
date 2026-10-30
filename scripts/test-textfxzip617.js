#!/usr/bin/env node
/* bitGen Studio — 2.617.0 (pure + wiring): TEXT EFFECTS FROM A ZIP (several in one), the fonts it carries too.
 * Tim: "can we install text preset effects from a zip, multiple effects can be in a single zip".
 *   static/zipread.js   entries / read from a Blob in place (stored + deflate, folders, __MACOSX left out, Zip64 refused)
 *   lib/fontInstall.js  a .ttf / .otf into <install>/fonts (+ POST /api/fonts/install in routes/fonts.js)
 *   static/textfx.js    importZip + the picker's zip / several files; static/fontlist.js reload() */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");

/** a zip written here: [{name, data, store?}] (CRC left 0 - the reader does not check it) */
function makeZip(files) {
  const locals = [], central = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"), raw = Buffer.from(f.data || ""), dat = f.store ? raw : zlib.deflateRawSync(raw), m = f.store ? 0 : 8;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(m, 8);
    lh.writeUInt32LE(dat.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(m, 10);
    ch.writeUInt32LE(dat.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, name, dat); central.push(ch, name); off += 30 + name.length + dat.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}
const Z = require(path.join(R, "static", "zipread.js"));
(async () => {
  const big = "x".repeat(200000);
  const zip = makeZip([{ name: "Pack/Gold Effect.psd", data: "PSDGOLD" + big }, { name: "Pack/silver.PSB", data: "PSB", store: true }, { name: "Pack/", data: "" },
    { name: "__MACOSX/Pack/._Gold Effect.psd", data: "junk" }, { name: "Pack/._hidden.psd", data: "junk" }, { name: "Pack/preview.jpg", data: "jpg" },
    { name: "fonts/Blantic.otf", data: "OTTO" }, { name: "neon – über.json", data: '{"name":"x"}' }]);
  const blob = new Blob([zip]);
  const ents = await Z.entries(blob);
  check("entries: every file (a folder left out), names in UTF-8, sizes", ents.length === 7 && ents[0].name === "Pack/Gold Effect.psd" && ents[0].usize === 7 + big.length && ents[6].name === "neon – über.json", ents.map((e) => e.name));
  const g = await Z.read(blob, ents[0], (u8) => zlib.inflateRawSync(Buffer.from(u8)));
  const s = await Z.read(blob, ents[1]);
  check("read: a deflated entry inflated, a stored one as it is (each read from the zip in place)", Buffer.from(g).toString().startsWith("PSDGOLD") && g.length === 7 + big.length && Buffer.from(s).toString() === "PSB");
  check("kind: .psd / .psb (any case) = psd, .json = a preset, .ttf / .otf = a font; macOS's __MACOSX + ._ copies, hidden files and the rest left out",
    JSON.stringify(ents.map((e) => Z.kind(e.name))) === JSON.stringify(["psd", "psd", null, null, null, "font", "json"]));
  let err = "";
  try { await Z.entries(new Blob([Buffer.from("not a zip at all")])); } catch (e) { err = e.message; }
  const z64 = Buffer.from(zip); z64.writeUInt16LE(0xffff, z64.length - 22 + 10);
  let err2 = ""; try { await Z.entries(new Blob([z64])); } catch (e) { err2 = e.message; }
  const enc = Buffer.from(makeZip([{ name: "a.psd", data: "a", store: true }])); enc.writeUInt16LE(0x801, enc.length - 22 - 46 - 5 + 8);
  let err3 = ""; try { const E = await Z.entries(new Blob([enc])); await Z.read(new Blob([enc]), E[0]); } catch (e) { err3 = e.message; }
  check("refused in words: not a zip, a Zip64 zip, a password-protected entry", /not a zip/.test(err) && /Zip64/.test(err2) && /password/.test(err3), [err, err2, err3]);

  // fonts
  const FI = require(path.join(R, "lib", "fontInstall.js"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fi617_")); FI.setDir(dir);
  const sys = ["/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:\\Windows\\Fonts\\arial.ttf", "/Library/Fonts/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"].find((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } });
  check("safeName / isFont: .ttf / .otf only, the path dropped, odd characters made safe; TrueType / OpenType bytes only",
    FI.safeName("../../x/My Font*.TTF") === "My Font_.TTF" && FI.safeName("a.woff") === null && FI.isFont(Buffer.from("OTTOxxxxxxxxxx")) && FI.isFont(Buffer.from([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])) && !FI.isFont(Buffer.from("PK\u0003\u0004xxxxxxxx")));
  if (sys) {
    const buf = fs.readFileSync(sys), nm = path.basename(sys);
    const a = FI.install(nm, buf), b = FI.install(nm, buf);
    const other = Buffer.concat([buf, Buffer.from([0])]), c = FI.install(nm, other);
    check("install: into <install>/fonts with its family read; the same file again is not written twice; another file of that name gets \" (2)\"",
      fs.existsSync(path.join(dir, nm)) && a.family && !a.existed && b.existed && c.name === nm.replace(/(\.\w+)$/, " (2)$1") && fs.readdirSync(dir).length === 2, { a, b, c });
  } else console.log("SKIP: no system font file to copy");
  let fe = ""; try { FI.install("x.ttf", Buffer.from("hello world, not a font")); } catch (e) { fe = e.message; }
  check("…a file that is not a font refused", /not a TrueType/.test(fe), fe);
  fs.rmSync(dir, { recursive: true, force: true });
  FI.setDir(null);
  check("the folder is the studio's own <install>/fonts (every font list + the PDF save read it)", FI.dir() === path.join(R, "fonts") && read("lib/fontFiles.js").includes('d.push(path.join(core.BASE, "fonts"));') && /function reset\(\)/.test(read("lib/fontFiles.js")));

  const T = read("static/textfx.js"), RF = read("routes/fonts.js"), FL = read("static/fontlist.js");
  check("textfx: importZip - fonts first (POST /api/fonts/install, the font lists asked again), then every PSD (importFile) and .json preset, one at a time; what failed named, the rest still in",
    /async function importZip\(file, o\)/.test(T) && /fetch\("\/api\/fonts\/install\?name="/.test(T) && /H3Fonts\.reload/.test(T) && /importFile\(\{ name: nm, arrayBuffer: \(\) => blob\.arrayBuffer\(\) \}, \{ reload: false \}\)/.test(T)
    && /res\.failed\.push\(\{ name: nm, error:/.test(T) && /loadScript\("\/static\/zipread\.js"\)/.test(T));
  check("the picker: ＋ Import PSD text effects or a zip… - .psd / .psb / .zip, several at once; one line says what went in",
    /accept="\.psd,\.psb,\.zip" multiple hidden/.test(T) && /＋ Import PSD text effects or a zip…/.test(T) && /async function importMany\(fs\)/.test(T) && /text effect" \+ \(added\.length > 1 \? "s" : ""\) \+ " added/.test(T));
  check("routes/fonts.js: POST /api/fonts/install (raw bytes, 41 MB) -> lib/fontInstall; fontlist.js: reload()",
    /app\.post\("\/api\/fonts\/install", require\("express"\)\.raw/.test(RF) && /require\("\.\.\/lib\/fontInstall"\)\.install/.test(RF) && /function reload\(\)/.test(FL) && /reload: reload/.test(FL));
  check("this machine's fonts and imported text effects stay out of git + the zips", /^fonts\/$/m.test(read(".gitignore")) && /^textfx\/user\/$/m.test(read(".gitignore")) && /! -path "\.\/fonts\/\*" ! -path "\.\/textfx\/user\/\*"/.test(read("scripts/make_zips.sh")));
  check("server.js untouched by this release", !/fontInstall|zipread|importZip/.test(read("misc/server.js")));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();

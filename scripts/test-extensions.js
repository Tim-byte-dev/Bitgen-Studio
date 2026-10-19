/* bitGen Studio — lib/extensions.js pinned (2.217.0).
 *
 * The shell + ext/<id>/ assembly is now what every browser and every DOM
 * test sees, so its contract is pinned here: all nine dockers splice in
 * exactly once, scripts emit in column order under /ext/, a REMOVED
 * extension leaves a working page with that docker absent, a folder
 * without a manifest is not an extension, and the markers never leak into
 * the assembled page. Run from repo root: node scripts/test-extensions.js
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ext = require("../lib/extensions");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

const BASE = path.join(__dirname, "..");
const DOCKS = ["previewdock", "timelinedock", "videodock", "imageeditdock",
               "comfydock", "musicdock", "stemsdock",   // 2.269.0: Stems at column 65
               "sfxdock",                               // 2.360.0: SFX at column 66
               "chatdock", "promptdock", "consoledock"];

/* ---- the real install ---- */
const exts = ext.list(BASE);
check("all ELEVEN dockers are installed extensions (Stems joined at 2.269.0, SFX at 2.360.0)",
  DOCKS.every((d) => exts.some((e) => e.id === d)), exts.map((e) => e.id));
check("emission order is column order",
  exts.map((e) => e.id).join(",").indexOf(DOCKS.join(",")) !== -1,
  exts.map((e) => e.id));

const page = ext.pageHtml(BASE);
for (const d of DOCKS)
  check(d + " splices in exactly once",
    page.split('<div class="bdock" id="' + d + '">').length === 2);
check("no marker leaks into the page", !page.includes("<!-- ext:dock") && !page.includes("<!-- ext:scripts -->"));
check("videodock's characters.js is tagged under /ext, version-stamped (2.242.0)",
  new RegExp('<script src="/ext/videodock/characters\\.js\\?v=[0-9.]+"></script>').test(page));
check("previewdock owns audioviz + vr360",
  /<script src="\/ext\/previewdock\/audioviz\.js\?v=[0-9.]+"><\/script>/.test(page)
  && /<script src="\/ext\/previewdock\/vr360\.js\?v=[0-9.]+"><\/script>/.test(page));
check("core scripts stay on /static, version-stamped (2.242.0)", /<script src="\/static\/dockscroll\.js\?v=[0-9.]+"><\/script>/.test(page)
  && /<script src="\/static\/genqueue\.js\?v=[0-9.]+"><\/script>/.test(page));
check("ext scripts come before the inline app script",
  page.indexOf("/ext/videodock/characters.js") !== -1
  && page.indexOf("/ext/videodock/characters.js") < page.indexOf("\n<script>"));

const shell = fs.readFileSync(path.join(BASE, "static", "index.html"), "utf8");
for (const d of DOCKS)
  check(d + " is OUT of the shell", !shell.includes('<div class="bdock" id="' + d + '">'));
check("the shell holds one marker per docker",
  DOCKS.every((d) => shell.split("<!-- ext:dock " + d + " -->").length === 2));
check("the shell holds the catch-all slot for dockers installed later",
  shell.includes("<!-- ext:dock * -->"));

/* ---- a synthetic install: removal + junk tolerance ---- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgext-"));
fs.mkdirSync(path.join(tmp, "static"));
fs.writeFileSync(path.join(tmp, "static", "index.html"),
  "<body>\n  <!-- ext:dock adock -->\n  <!-- ext:dock bdock -->\n<!-- ext:scripts -->\n</body>\n");
fs.mkdirSync(path.join(tmp, "ext", "adock"), { recursive: true });
fs.writeFileSync(path.join(tmp, "ext", "adock", "ext.json"),
  JSON.stringify({ id: "adock", name: "A", order: 10, html: "dock.html", scripts: ["a.js"] }));
fs.writeFileSync(path.join(tmp, "ext", "adock", "dock.html"), '<div id="adock">A</div>\n');
fs.mkdirSync(path.join(tmp, "ext", "junk"));           // no manifest — not an extension
fs.writeFileSync(path.join(tmp, "ext", "junk", "x.txt"), "x");

const p2 = ext.pageHtml(tmp);
check("installed docker splices, missing docker resolves to nothing",
  p2.includes('<div id="adock">A</div>') && !p2.includes("bdock") && !p2.includes("ext:dock"));
check("declared script is tagged, stamped even in an unversioned tree (?v=0)",
  p2.includes('<script src="/ext/adock/a.js?v=0"></script>'));
check("a folder without ext.json is not an extension",
  ext.list(tmp).map((e) => e.id).join(",") === "adock");
fs.mkdirSync(path.join(tmp, "empty", "static"), { recursive: true });
fs.writeFileSync(path.join(tmp, "empty", "static", "index.html"), "<body><!-- ext:scripts --></body>");
check("no ext folder at all is a working page",
  ext.pageHtml(path.join(tmp, "empty")) === "<body></body>");
fs.rmSync(tmp, { recursive: true, force: true });

/* ---- 2.218.0: the zip reader + install-from-folder ---- */
const zlib = require("zlib");
const unzip = require("../lib/unzip");

/** A minimal zip WRITER, test-only: enough of the format (local headers +
 *  central directory + EOCD, methods 0 and 8) to hand the reader real input
 *  with no dependency and no shelling out. */
function crc32(buf) {
  let t = crc32.t;
  if (!t) {
    t = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
  }
  let c = ~0;
  for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function makeZip(files) {           // files: [{name, data, stored?}]
  const parts = [], cd = [];
  let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const raw = Buffer.from(f.data, "utf8");
    const method = f.stored ? 0 : 8;
    const comp = f.stored ? raw : zlib.deflateRawSync(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(method, 8); lh.writeUInt32LE(crc32(raw), 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(method, 10); ch.writeUInt32LE(crc32(raw), 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    cd.push(Buffer.concat([ch, name]));
    parts.push(lh, name, comp);
    off += 30 + name.length + comp.length;
  }
  const cdbuf = Buffer.concat(cd);
  const eo = Buffer.alloc(22);
  eo.writeUInt32LE(0x06054b50, 0);
  eo.writeUInt16LE(files.length, 8); eo.writeUInt16LE(files.length, 10);
  eo.writeUInt32LE(cdbuf.length, 12); eo.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdbuf, eo]);
}

const itmp = fs.mkdtempSync(path.join(os.tmpdir(), "bginst-"));
const zips = path.join(itmp, "zips");
fs.mkdirSync(zips);
fs.mkdirSync(path.join(itmp, "static"));
fs.writeFileSync(path.join(itmp, "static", "index.html"),
  "<body>\n  <!-- ext:dock * -->\n<!-- ext:scripts -->\n</body>\n");

// a good extension zip (one deflated, one stored entry)
fs.writeFileSync(path.join(zips, "bitgen-ext-zzalpha-v1.zip"), makeZip([
  { name: "ext/zzalpha/ext.json",
    data: JSON.stringify({ id: "zzalpha", name: "Alpha", order: 10, html: "dock.html", scripts: ["a.js"] }) },
  { name: "ext/zzalpha/dock.html", data: '<div class="bdock" id="zzalpha">v1</div>\n', stored: true },
  { name: "ext/zzalpha/a.js", data: "// a\n" },
]));
// not an extension zip (no ext/<id>/ext.json)
fs.writeFileSync(path.join(zips, "notes.zip"), makeZip([{ name: "readme.txt", data: "hi" }]));
// a HOSTILE zip: traversal entries beside a valid extension — the WHOLE
// archive must be refused (an archive that tries ../ is not half-trusted)
fs.writeFileSync(path.join(zips, "mixed.zip"), makeZip([
  { name: "../escape.txt", data: "no" },
  { name: "ext/zzevil/ext.json", data: JSON.stringify({ id: "zzevil", html: "dock.html" }) },
  { name: "ext/zzevil/dock.html", data: "<div>evil-but-legal</div>" },
  { name: "ext/../../up.txt", data: "no" },
]));
// junk that is not a zip at all
fs.writeFileSync(path.join(zips, "broken.zip"), Buffer.from("PK\x03\x04 nope"));

const rep = ext.installFromDir(zips, itmp);
check("install: the good zip lands with all its files",
  rep.installed.some((i) => i.zip === "bitgen-ext-zzalpha-v1.zip" && i.ids.join() === "zzalpha" && i.files === 3), rep);
check("install: a zip without ext/<id>/ext.json is SKIPPED with the reason named",
  rep.skipped.some((k) => k.zip === "notes.zip" && /not an extension zip/.test(k.why)), rep.skipped);
check("install: a broken zip is skipped, not fatal",
  rep.skipped.some((k) => k.zip === "broken.zip"), rep.skipped);
check("install: traversal entries never touch the disk",
  !fs.existsSync(path.join(itmp, "..", "escape.txt")) && !fs.existsSync(path.join(itmp, "up.txt"))
  && !fs.existsSync(path.join(itmp, "escape.txt")), null);
check("install: a zip carrying ANY unsafe path is refused WHOLE — no half-trust",
  rep.skipped.some((k) => k.zip === "mixed.zip" && /refusing unsafe path/.test(k.why))
  && !rep.installed.some((i) => i.zip === "mixed.zip")
  && !fs.existsSync(path.join(itmp, "ext", "zzevil")), rep.skipped);
check("install: a NEW docker (no named marker) assembles in at the CATCH-ALL slot",
  ext.pageHtml(itmp).includes('<div class="bdock" id="zzalpha">v1</div>')
  && !ext.pageHtml(itmp).includes("ext:dock"), null);
check("install: stored and deflated entries both read back exactly",
  fs.readFileSync(path.join(itmp, "ext", "zzalpha", "a.js"), "utf8") === "// a\n"
  && fs.readFileSync(path.join(itmp, "ext", "zzalpha", "ext.json"), "utf8").includes('"Alpha"'), null);

// overwrite IS upgrade
fs.writeFileSync(path.join(zips, "bitgen-ext-zzalpha-v2.zip"), makeZip([
  { name: "ext/zzalpha/ext.json",
    data: JSON.stringify({ id: "zzalpha", name: "Alpha", order: 10, html: "dock.html", scripts: ["a.js"] }) },
  { name: "ext/zzalpha/dock.html", data: '<div class="bdock" id="zzalpha">v2</div>\n' },
]));
ext.installFromDir(zips, itmp);
check("install: a newer zip over an installed extension UPGRADES it",
  ext.pageHtml(itmp).includes('id="zzalpha">v2') && !ext.pageHtml(itmp).includes('id="zzalpha">v1'), null);
let threw = null;
try { ext.installFromDir(path.join(itmp, "nope"), itmp); } catch (e) { threw = e.message; }
check("install: a missing folder throws (the route turns it into a 400)", !!threw, threw);
fs.rmSync(itmp, { recursive: true, force: true });

/* ---- 2.218.0: the Settings -> Extensions tab is IN the page and wired ---- */
check("settings: the Extensions tab button exists", /<button data-stab="extensions">Extensions<\/button>/.test(page));
check("settings: the pane holds the folder input, install, refresh and reload controls",
  /id="stab-extensions"/.test(page) && /id="x_dir"/.test(page) && /id="x_install"/.test(page)
  && /id="x_refresh"/.test(page) && /id="x_reload"/.test(page) && /id="x_list"/.test(page) && /id="x_hint"/.test(page));
check("settings: the folder input gets the server-side path browser",
  /addPick\("x_dir", "dir"\);/.test(page));
check("settings: install POSTs the picked folder to /api/extensions/install",
  /fetch\("\/api\/extensions\/install", \{ method: "POST"/.test(page)
  && /JSON\.stringify\(\{ dir \}\)/.test(page));
check("settings: the list paints from /api/extensions and repaints after install",
  /fetch\("\/api\/extensions"\)/.test(page) && /paintExtensions\(\);/.test(page));
check("settings: reload is OFFERED, never forced",
  /\$\("x_reload"\)\.onclick = \(\) => location\.reload\(\);/.test(page)
  && !/location\.reload\(\)[\s\S]{0,40}x_install/.test(page));

/* ---- 2.223.0: dock resize handles — bottom-owned, pair-move, hideable ---- */
{
  const { JSDOM } = require("jsdom");
  const dom2 = new JSDOM(page);
  const dd = dom2.window.document;
  const DOCKS2 = ["previewdock", "timelinedock", "videodock", "imageeditdock",
                  "comfydock", "musicdock", "chatdock", "promptdock", "consoledock"];
  const KEY = { previewdock: "pv", timelinedock: "th", videodock: "vh", imageeditdock: "eh",
                comfydock: "cfh", musicdock: "mh", chatdock: "ch2", promptdock: "ph" };
  check("every docker except the last carries ITS OWN bottom handle, keyed to itself",
    DOCKS2.slice(0, -1).every((d) => {
      let n = dd.getElementById(d) && dd.getElementById(d).nextElementSibling;
      while (n && !(n.classList && n.classList.contains("hsplit")) && !(n.classList && n.classList.contains("bdock"))) n = n.nextElementSibling;
      return n && n.classList.contains("hsplit") && n.dataset.hresize === KEY[d];
    }), null);
  check("the last docker (console) has NO handle below it",
    (() => {
      let n = dd.getElementById("consoledock").nextElementSibling;
      while (n) { if (n.classList && n.classList.contains("hsplit")) return false; n = n.nextElementSibling; }
      return true;
    })(), null);
  check("a hidden (collapsed) docker's handle hides until it is unhidden (CSS)",
    /\.bdock\.collapsed \+ \.hsplit \{ display: none/.test(page)
    || /\.bdock\.collapsed \.bbody, \.bdock\.collapsed \+ \.hsplit \{ display: none/.test(page), null);
  check("the grab area is 11px straddling the seam, layout unchanged (negative margins)",
    /\.hsplit \{ height: 11px; margin: -3px 0;/.test(page), null);
  check("2.254.0: dragging CASCADES — every visible dock below gives room in order (floor 60), shrink gives back to the ceiling (2.381.0: or a 📌 max), the grabbed dock moves by what the column gave",
    /const A = hsplitDock\(sp, false\)/.test(page) && /const belows = \[\];/.test(page)
    && /Math\.min\(need, Math\.max\(0, b\.start - \(b\.key \? 60 : b\.floor\)\)\)/.test(page)
    && /const top = b\.max > 0 \? Math\.min\(ceil, b\.max\) : ceil;/.test(page)
    && /setVar\(aKey, aCur \+ given\)/.test(page), null);
  check("collapsed and hidden docks are SKIPPED when picking the giving partners (2.381.0: dockOpen)",
    /if \((!n \|\| )?!\(n\.classList && n\.classList\.contains\("bdock"\)\) \|\| !dockOpen\(n\)\) continue;/.test(page)   // 2.389.0: (!n ||) - a .pf-row stands for its dock
    && /function dockOpen\(el\) \{ return !!el && !el\.classList\.contains\("collapsed"\) && !el\.classList\.contains\("dockgone"\); \}/.test(page), null);
  check("2.381.0: the drag's end writes docker_status.json (the whole record, debounced)",
    /docker_status\.json gets them the moment the drag ends\s*saveLayout\(\);/.test(page), null);
  check("2.223.1 reflow: closing a docker makes the OPEN ones fill down to the statusbar",
    /function reflowDocks\(keep\)/.test(page)
    && /const each = gap \/ ids\.length;/.test(page)
    && /last\.getBoundingClientRect\(\)\.bottom/.test(page), null);
  check("2.223.1 reflow: fires on collapse, maximize-restore, boot apply and window resize",
    (page.match(/reflowSoon\(\)/g) || []).length >= 3
    && /window\.addEventListener\("resize", \(\) => reflowSoon\(\)\)/.test(page), null);
  check("2.256.0 reflow: OVERFLOW is corrected unconditionally; a positive gap fills only when nothing flexes (2.381.0: the maximized dock flexes too)",
    /const flexEl = mx \|\| vd;/.test(page)
    && /gap > 0 && flexOpen\) return/.test(page)
    && /reflowSoon\((A\.id)?\);\s+\/\/ 2\.256\.0: a drag must never leave the console clipped/.test(page), null);   // 2.384.1: keeps the dragged dock
  check("at-start: stored fixed heights are normalised to leave the ELASTIC dock room (2.255.0: the video dock)",
    /fix the preview docker size on start/.test(page) && /scale/.test(page)
    && /\* \.25/.test(page), null);
}

// ---- 2.239.0: the update-must-arrive rule --------------------------------
{
  const R39 = require("fs").readFileSync(require("path").join(__dirname, "..", "routes", "index.js"), "utf8");
  check("2.239.0: /ext and /static serve Cache-Control no-cache (heuristic caching served STALE docker scripts after updates; 304s keep it cheap)",
    R39.includes('res.setHeader("Cache-Control", "no-cache")')
    && R39.includes('express.static(path.join(core.BASE, "ext"), NO_CACHE)')
    && R39.includes('express.static(path.join(core.BASE, "static"), NO_CACHE)'));
}

// ---- 2.242.0: version-stamped asset URLs — stale caches cannot serve -----
{
  const fs2 = require("fs"), path2 = require("path");
  const ext2 = require(path2.join(__dirname, "..", "lib", "extensions"));
  const ver = JSON.parse(fs2.readFileSync(path2.join(__dirname, "..", "package.json"), "utf8")).version;
  const html = ext2.pageHtml(path2.join(__dirname, ".."));
  const srcs = [...html.matchAll(/(?:src|href)="(\/(?:static|ext)\/[^"]+)"/g)].map((m) => m[1]);
  check("2.242.0 LIVE: EVERY /static and /ext asset URL in the assembled page carries ?v=<app version>, none doubled (a new release = new URLs = no cache can serve last release's code)",
    srcs.length >= 10
    && srcs.every((s) => s.endsWith("?v=" + ver))
    && !/\?v=[^"]*\?v=/.test(html));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

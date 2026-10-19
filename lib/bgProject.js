// bitGen Studio — lib/bgProject.js (2.436.0): the WHOLE PROJECT as one .bgp file (XML).
//
// Tim (verbatim): "save the overall project as .bgp in xml format" (+ "Both": self-contained OR a manifest, picked
// at Save). Everything in projects/<p>/ goes in, one <file> per file, by its path in the project:
//   · the project's state (the .prj), timelines, references, chats, songs, settings - every JSON file as bitGen's value
//     XML (static/bgxml.js, readable and exactly the JSON back), other text files as text;
//   · the media (video, pictures, sound, models...) - SELF-CONTAINED: inside the file (base64, 76-character lines);
//     MANIFEST ONLY: listed with its size and where it is on this computer (source="…") - small, for a backup of the
//     work or moving it on one computer.
// Left out: the recycle bin, and (unless asked) the caches and previews bitGen re-makes (temp, cache, framecache,
// preview).
//
//   <bitgen-project version="1" app="2.436.0" name="P" dir="…/projects/P" mode="embedded | manifest" saved="ISO">
//     <file path="P.prj" size="…" type="json"><o>…</o></file>
//     <file path="chat/x.chat" size="…" type="text">…</file>
//     <file path="video/a.mp4" size="…" type="base64">QUJD…</file>          self-contained
//     <file path="video/a.mp4" size="…" type="external" source="C:\…\a.mp4"/>  manifest only
//     <dir path="sfx"/>                                                        an empty folder (the project's shape)
//   </bitgen-project>
//
// Both ways STREAM (a project can be gigabytes): the writer reads each file in pieces, the reader decodes as it reads.
//   walk(pdir, {caches})                    [{rel, abs, size}] the files that go in (sorted, forward slashes)
//   classify(rel, size)                     "json" | "text" | "binary"
//   estimate(pdir, {caches})                {files, bytes, text, media, mediaBytes, embeddedBytes (≈ the self-contained file)}
//   exportTo(pdir, outPath, {embed, caches, name, app})  -> Promise {path, size, files, embedded, external, missing}
//   peek(file)                              -> the root's attributes (name, mode, saved, app, dir) from the first 64 KB
//   importFrom(file, destDir, {near})       -> Promise {files, written, missing: [paths], fromDir, name, mode}
//   safeRel(rel)                            a path inside the project, or null
"use strict";
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { StringDecoder } = require("string_decoder");
const X = require("../static/bgxml.js");

const VERSION = 1;
const CACHE_DIRS = new Set(["temp", "cache", "framecache", "preview"]);
const ALWAYS_SKIP = new Set(["recycle_bin"]);
const JSON_RX = /\.(prj|json|seg)$/i;
const TEXT_RX = /\.(txt|md|lrc|srt|vtt|ass|chat|cube|csv|xml|svg|py|js|css|html?|yaml|yml|ini|cfg|log)$/i;
const MAX_TEXT = 32 * 1024 * 1024;
const LINE = 57;                    // bytes per base64 line (76 characters)
const CHUNK = LINE * 8192;          // 466,944 bytes read at a time
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

function walk(pdir, o) {
  const caches = !!(o && o.caches), out = [];
  const go = (d, rel, depth) => {
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const r = rel ? rel + "/" + e.name : e.name, a = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!rel && (ALWAYS_SKIP.has(e.name) || (!caches && CACHE_DIRS.has(e.name)))) continue;
        let n = 0; try { n = fs.readdirSync(a).length; } catch { /* unreadable */ }
        if (!n) { out.push({ rel: r, abs: a, size: 0, dir: true }); continue; }      // an empty folder (kept: the project's shape)
        if (depth < 24) go(a, r, depth + 1);
      } else if (e.isFile()) {
        if (/\.part(\.\w+)?$/i.test(e.name)) continue;                // a file still being written
        let size = 0; try { size = fs.statSync(a).size; } catch { continue; }
        out.push({ rel: r, abs: a, size });
      }
    }
  };
  go(pdir, "", 0);
  return out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}
function classify(rel, size) {
  if (size > MAX_TEXT) return "binary";
  if (JSON_RX.test(rel)) return "json";
  if (TEXT_RX.test(rel)) return "text";
  return "binary";
}
function estimate(pdir, o) {
  const list = walk(pdir, o);
  let bytes = 0, text = 0, media = 0, mediaBytes = 0, textBytes = 0;
  for (const f of list) { if (f.dir) continue; bytes += f.size; if (classify(f.rel, f.size) === "binary") { media++; mediaBytes += f.size; } else { text++; textBytes += f.size; } }
  return { files: list.filter((f) => !f.dir).length, bytes, text, media, mediaBytes, embeddedBytes: Math.round(textBytes * 1.6 + mediaBytes * 4 / 3 * (77 / 76) + list.length * 120), manifestBytes: Math.round(textBytes * 1.6 + media * 220) };
}
function safeRel(rel) {
  const r = String(rel || "").replace(/\\/g, "/");
  if (!r || r.startsWith("/") || /^[A-Za-z]:/.test(r) || r.split("/").some((p) => p === ".." || p === "" || p === ".")) return null;
  return r;
}

/* ============================== writing ============================== */
async function exportTo(pdir, outPath, o) {
  o = o || {};
  const embed = o.embed !== false;
  const list = walk(pdir, o).filter((f) => path.resolve(f.abs) !== path.resolve(outPath));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmp = outPath + ".part";
  const fh = await fsp.open(tmp, "w");
  let embedded = 0, external = 0;
  const missing = [];
  const w = (s) => fh.write(s);
  try {
    const root = { version: VERSION, app: o.app || "", name: o.name || path.basename(pdir), dir: path.resolve(pdir), mode: embed ? "embedded" : "manifest", saved: new Date().toISOString(), files: list.length };
    root.files = list.filter((f) => !f.dir).length;
    await w(`<?xml version="1.0" encoding="UTF-8"?>\n<bitgen-project${Object.keys(root).map((k) => ` ${k}="${X.attr(root[k])}"`).join("")}>`);
    for (const f of list) {
      if (f.dir) { await w(`\n  <dir path="${X.attr(f.rel)}"/>`); continue; }
      const kind = classify(f.rel, f.size);
      const head = `\n  <file path="${X.attr(f.rel)}" size="${f.size}"`;
      if (kind !== "binary") {
        let t; try { t = await fsp.readFile(f.abs, "utf8"); } catch { missing.push(f.rel); continue; }
        if (kind === "json") {
          let v, ok = true; try { v = JSON.parse(t); } catch { ok = false; }
          if (ok) { await w(`${head} type="json">${X.toXml(v, null, null, 2)}\n  </file>`); continue; }
        }
        await w(`${head} type="text">${X.esc(t)}</file>`);
        continue;
      }
      if (!embed) { await w(`${head} type="external" source="${X.attr(path.resolve(f.abs))}"/>`); external++; continue; }
      let src; try { src = await fsp.open(f.abs, "r"); } catch { missing.push(f.rel); continue; }
      try {
        await w(`${head} type="base64">`);
        const buf = Buffer.alloc(CHUNK);
        let pos = 0, carry = Buffer.alloc(0);
        for (;;) {
          const { bytesRead } = await src.read(buf, 0, CHUNK, pos);
          if (!bytesRead) break;
          pos += bytesRead;
          let data = carry.length ? Buffer.concat([carry, buf.subarray(0, bytesRead)]) : Buffer.from(buf.subarray(0, bytesRead));
          const whole = data.length - (data.length % LINE);
          carry = data.subarray(whole);
          data = data.subarray(0, whole);
          if (data.length) {
            const b64 = data.toString("base64"), lines = [];
            for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
            await w("\n" + lines.join("\n"));
          }
        }
        if (carry.length) await w("\n" + carry.toString("base64"));
        await w("\n  </file>");
        embedded++;
      } finally { await src.close(); }
    }
    await w("\n</bitgen-project>\n");
  } catch (e) { await fh.close().catch(() => {}); fs.rmSync(tmp, { force: true }); throw e; }
  await fh.close();
  fs.renameSync(tmp, outPath);
  return { path: outPath, size: fs.statSync(outPath).size, files: list.filter((f) => !f.dir).length - missing.length, folders: list.filter((f) => f.dir).length, embedded, external, missing };
}

/* ============================== reading ============================== */
function attrsOf(tagText) {
  const a = {}, re = /([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g; let m;
  while ((m = re.exec(tagText))) a[m[1]] = X.unesc(m[3] != null ? m[3] : m[4]);
  return a;
}
function peek(file) {
  const fd = fs.openSync(file, "r");
  try {
    const b = Buffer.alloc(65536), n = fs.readSync(fd, b, 0, b.length, 0), s = b.toString("utf8", 0, n);
    const m = /<bitgen-project(\s[^>]*)?>/.exec(s);
    if (!m) throw bad("not a .bgp file (no <bitgen-project>)");
    return attrsOf(m[1] || "");
  } finally { fs.closeSync(fd); }
}
async function importFrom(file, destDir, o) {
  o = o || {};
  const root = peek(file);
  if (+root.version > VERSION) throw bad(`this .bgp was written by a newer bitGen (file version ${root.version})`);
  const near = [path.dirname(path.resolve(file))].concat(o.near || []);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.resolve(destDir);
  const target = (rel) => { const r = safeRel(rel); if (!r) return null; const p = path.join(dest, ...r.split("/")); return p.startsWith(dest + path.sep) ? p : null; };
  const fh = await fsp.open(file, "r");
  const dec = new StringDecoder("utf8");
  let buf = "", state = "seek", cur = null, out = null, b64rest = "", text = [], textLen = 0, files = 0, written = 0;
  const missing = [], skipped = [];
  const chunk = Buffer.alloc(1 << 20);
  let pos = 0, eof = false;
  const more = async () => { const { bytesRead } = await fh.read(chunk, 0, chunk.length, pos); if (!bytesRead) { eof = true; buf += dec.end(); return false; } pos += bytesRead; buf += dec.write(chunk.subarray(0, bytesRead)); return true; };
  const openOut = async (p) => { fs.mkdirSync(path.dirname(p), { recursive: true }); return fsp.open(p, "w"); };
  async function external(a) {
    const p = target(a.path); if (!p) { skipped.push(a.path); return; }
    const cands = [a.source].concat(near.map((d) => path.join(d, root.name || "", ...a.path.split("/"))), near.map((d) => path.join(d, ...a.path.split("/")))).filter(Boolean);
    for (const c of cands) {
      try { if (fs.statSync(c).isFile()) { fs.mkdirSync(path.dirname(p), { recursive: true }); await fsp.copyFile(c, p); written++; return; } } catch { /* next */ }
    }
    missing.push(a.path);
  }
  try {
    for (;;) {
      if (state === "seek") {
        const iF = buf.indexOf("<file "), iD = buf.indexOf("<dir ");
        if (iD >= 0 && (iF < 0 || iD < iF)) {                                   // an empty folder
          const g = buf.indexOf(">", iD); if (g < 0) { if (eof) throw bad("the .bgp ends inside a <dir> tag"); await more(); continue; }
          const p = target(attrsOf(buf.slice(iD + 5, g)).path); if (p) fs.mkdirSync(p, { recursive: true });
          buf = buf.slice(g + 1); continue;
        }
        const i = iF;
        if (i < 0) {
          if (eof) break;
          buf = buf.slice(Math.max(0, buf.length - 5));
          await more(); continue;
        }
        const gt = buf.indexOf(">", i);
        if (gt < 0) { if (eof) throw bad("the .bgp ends inside a <file> tag"); await more(); continue; }
        const tag = buf.slice(i + 6, gt), self = tag.trimEnd().endsWith("/");
        cur = attrsOf(tag); files++;
        buf = buf.slice(gt + 1);
        if (self || cur.type === "external") { await external(cur); state = "seek"; if (!self) state = "skipbody"; continue; }
        const p = target(cur.path);
        if (!p) { skipped.push(cur.path); state = "skipbody"; continue; }
        cur.abs = p;
        if (cur.type === "base64") { out = await openOut(p); b64rest = ""; state = "b64"; }
        else { text = []; textLen = 0; state = "text"; }
        continue;
      }
      const end = buf.indexOf("</file>");
      const take = end >= 0 ? buf.slice(0, end) : buf.slice(0, Math.max(0, buf.length - 6));
      buf = end >= 0 ? buf.slice(end + 7) : buf.slice(take.length);
      if (state === "b64") {
        let s = b64rest + take.replace(/[^A-Za-z0-9+/=]/g, "");
        const whole = end >= 0 ? s.length : s.length - (s.length % 4);
        if (whole) await out.write(Buffer.from(s.slice(0, whole), "base64"));
        b64rest = s.slice(whole);
      } else if (state === "text") {
        textLen += take.length; if (textLen > MAX_TEXT * 2) throw bad(`${cur.path}: a text entry over ${MAX_TEXT * 2 / 1048576} MB`);
        text.push(take);
      }
      if (end >= 0) {
        if (state === "b64") { await out.close(); out = null; written++; }
        else if (state === "text") {
          const body = text.join(""); text = [];
          fs.mkdirSync(path.dirname(cur.abs), { recursive: true });
          if (cur.type === "json") { const v = X.fromXml(body); fs.writeFileSync(cur.abs, JSON.stringify(v === undefined ? null : v, null, 2)); }
          else fs.writeFileSync(cur.abs, X.unesc(body));
          written++;
        }
        state = "seek"; continue;
      }
      if (eof) throw bad(`the .bgp ends inside ${cur && cur.path}`);
      await more();
    }
  } finally {
    if (out) await out.close().catch(() => {});
    await fh.close();
  }
  return { files, written, missing, skipped, fromDir: root.dir || "", name: root.name || "", mode: root.mode || "", app: root.app || "", saved: root.saved || "" };
}

module.exports = { VERSION, CACHE_DIRS, walk, classify, estimate, safeRel, exportTo, peek, importFrom };

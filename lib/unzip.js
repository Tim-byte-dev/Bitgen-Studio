/* bitGen Studio — a minimal ZIP READER (2.218.0, for Settings → Extensions
 * "install all the extensions from that folder (zip files)").
 *
 * Node ships zlib but no zip, and the stack rule is NO new dependencies —
 * so this reads the format directly: find the end-of-central-directory
 * record, walk the central directory, and inflate each wanted entry from
 * its local header. Methods 0 (stored) and 8 (deflate) only — that is what
 * `zip`, PowerShell's Compress-Archive, and every delivery zip this project
 * builds actually use; anything else is refused by name.
 *
 * extract() REFUSES path traversal: an entry whose name is absolute, has a
 * drive letter, or contains a ".." segment never touches the disk — a zip
 * is user-supplied input even on a local app.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const EOCD = 0x06054b50, CDFH = 0x02014b50, LFH = 0x04034b50;

/** Every file entry in the zip (directories skipped): {name, method, csize, usize, offset}. */
function entries(buf) {
  // EOCD sits in the last 22..(22+65535) bytes — scan back for its signature
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === EOCD) { e = i; break; }
  }
  if (e < 0) throw new Error("not a zip (no end-of-central-directory)");
  const count = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);              // central directory offset
  const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== CDFH) throw new Error("central directory is corrupt");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString("utf8");
    if (!name.endsWith("/")) out.push({ name, method, csize, usize, offset });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

/** One entry's bytes, read via its LOCAL header (the central record's sizes
 *  are authoritative; the local name/extra lengths position the data). */
function read(buf, ent) {
  if (buf.readUInt32LE(ent.offset) !== LFH) throw new Error("local header is corrupt: " + ent.name);
  const nlen = buf.readUInt16LE(ent.offset + 26);
  const xlen = buf.readUInt16LE(ent.offset + 28);
  const start = ent.offset + 30 + nlen + xlen;
  const data = buf.slice(start, start + ent.csize);
  if (ent.method === 0) return data;
  if (ent.method === 8) return zlib.inflateRawSync(data);
  throw new Error("unsupported compression method " + ent.method + " in " + ent.name);
}

function unsafe(name) {
  return path.isAbsolute(name) || /^[A-Za-z]:/.test(name)
    || name.split(/[\\/]+/).some((s) => s === "..");
}

/** Extract into destRoot the entries `filter(name)` accepts (all when no
 *  filter). Existing files are OVERWRITTEN — installing a newer extension
 *  zip over an older install IS the upgrade path. Returns written names. */
function extract(zipPath, destRoot, filter) {
  const buf = fs.readFileSync(zipPath);
  const written = [];
  for (const ent of entries(buf)) {
    if (unsafe(ent.name)) throw new Error("refusing unsafe path in zip: " + ent.name);
    if (filter && !filter(ent.name)) continue;
    const dest = path.join(destRoot, ent.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, read(buf, ent));
    written.push(ent.name);
  }
  return written;
}

module.exports = { entries, read, extract, unsafe };

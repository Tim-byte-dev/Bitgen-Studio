/* bitGen Studio — static/zipread.js (2.617.0): a ZIP READER for the page (window.H3Zip / require()).
 *
 * Tim (verbatim): "can we install text preset effects from a zip, multiple effects can be in a single zip".
 * A pack of text effects is often a big zip (PSDs of 50 - 200 MB each, previews, fonts). It is read IN PLACE from the
 * File (Blob.slice): the end record, the central directory, then each wanted entry alone - never the whole zip in memory.
 * Methods 0 (stored) and 8 (deflate - DecompressionStream "deflate-raw"); Zip64 and encrypted entries are refused in words.
 *   entries(blob) -> Promise<[{name, method, csize, usize, offset, flags}]>   (folders left out)
 *   read(blob, ent, inflate?) -> Promise<Uint8Array>   inflate(Uint8Array) -> Uint8Array|Promise (Node tests: zlib)
 *   parseCentral(eocdBytes, cdBytes) (pure), skip(name) - __MACOSX / ._ files / folders, kind(name) - psd | json | font | null
 */
(function (root) {
  "use strict";
  const EOCD = 0x06054b50, CDFH = 0x02014b50, LFH = 0x04034b50;
  const dv = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  function utf8(u8, flags) {
    try { return new TextDecoder("utf-8", { fatal: !(flags & 0x800) }).decode(u8); }
    catch (e) { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; }   // an old zip's own code page: kept as bytes
  }
  /** the end record in the tail bytes -> {count, cdOffset, cdSize} */
  function findEnd(tail) {
    const v = dv(tail);
    for (let i = tail.length - 22; i >= 0; i--) {
      if (v.getUint32(i, true) !== EOCD) continue;
      const count = v.getUint16(i + 10, true), cdSize = v.getUint32(i + 12, true), cdOffset = v.getUint32(i + 16, true);
      if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new Error("a Zip64 zip (over 4 GB or 65535 files) - make smaller zips");
      return { count, cdSize, cdOffset };
    }
    throw new Error("not a zip file");
  }
  function parseCentral(cd, count) {
    const v = dv(cd), out = [];
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (p + 46 > cd.length || v.getUint32(p, true) !== CDFH) throw new Error("the zip's directory is damaged");
      const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), usize = v.getUint32(p + 24, true);
      const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), offset = v.getUint32(p + 42, true);
      const name = utf8(cd.subarray(p + 46, p + 46 + nlen), flags);
      if (!/\/$/.test(name)) out.push({ name, method, csize, usize, offset, flags });
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }
  const bytes = async (blob, a, b) => new Uint8Array(await blob.slice(a, b).arrayBuffer());
  async function entries(blob) {
    const size = blob.size, tailLen = Math.min(size, 22 + 65535);
    const end = findEnd(await bytes(blob, size - tailLen, size));
    return parseCentral(await bytes(blob, end.cdOffset, end.cdOffset + end.cdSize), end.count);
  }
  async function inflateWeb(u8) {
    if (typeof DecompressionStream !== "function") throw new Error("this window cannot unpack zips (no DecompressionStream)");
    const ds = new DecompressionStream("deflate-raw");
    const out = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(out);
  }
  async function read(blob, ent, inflate) {
    if (ent.flags & 1) throw new Error(ent.name + " is password protected");
    const head = await bytes(blob, ent.offset, ent.offset + 30), v = dv(head);
    if (v.getUint32(0, true) !== LFH) throw new Error("the zip is damaged at " + ent.name);
    const start = ent.offset + 30 + v.getUint16(26, true) + v.getUint16(28, true);
    const data = await bytes(blob, start, start + ent.csize);
    if (ent.method === 0) return data;
    if (ent.method === 8) return new Uint8Array(await (inflate || inflateWeb)(data));
    throw new Error(ent.name + " uses a compression this reader does not know (method " + ent.method + ")");
  }
  /** files a pack carries that are not wanted: macOS's resource copies, hidden files */
  function skip(name) { const b = String(name).split("/").pop(); return /(^|\/)__MACOSX\//.test(name) || /^\._/.test(b) || /^\./.test(b) || !b; }
  function kind(name) {
    if (skip(name)) return null;
    if (/\.ps[db]$/i.test(name)) return "psd";
    if (/\.json$/i.test(name)) return "json";
    if (/\.(ttf|otf)$/i.test(name)) return "font";
    return null;
  }
  const api = { entries, read, parseCentral, findEnd, skip, kind };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.H3Zip = api;
})(typeof window !== "undefined" ? window : globalThis);

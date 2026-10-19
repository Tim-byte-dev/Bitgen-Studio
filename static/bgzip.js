/* bitGen Studio — static/bgzip.js (2.436.0): a ZIP container for bitGen's files (the image editor's .bgi), window.BgZip
 * (and require() in Node). No compression (the layers are PNGs, already compressed; the XML is small) - "stored"
 * entries any unzip opens, CRC-32 checked on reading.
 *   zip([{name, data: Uint8Array | string}])  -> Uint8Array (a string is written as UTF-8)
 *   zipAsync([{name, data, deflate}])          -> Promise<Uint8Array>: the {deflate: true} entries compressed (DEFLATE)
 *   unzip(bytes)                               -> Map(name -> Uint8Array) (stored and deflated entries: deflated ones
 *                                                need DecompressionStream / zlib - unzipAsync)
 *   unzipAsync(bytes)                          -> Promise<Map> (also inflates "deflate" entries where it can)
 *   text(u8) / utf8(str)                       UTF-8 helpers; crc32(u8)
 */
(function (root) {
  "use strict";
  const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const utf8 = (s) => (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, "utf8")));
  const text = (u8) => (typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8").decode(u8) : Buffer.from(u8).toString("utf8"));
  function dosTime(d) {
    const t = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31);
    const dt = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return [t, dt];
  }
  function zip(files) {
    return zipRaw(files.map((f) => ({ name: f.name, data: typeof f.data === "string" ? utf8(f.data) : f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data) })));
  }
  /** the entries: [{name, method, data (raw), size, crc}] from the central directory */
  function entries(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("not a zip file (no end record)");
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const out = [];
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("a broken zip directory");
      const method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = text(u8.subarray(p + 46, p + 46 + nl));
      const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true), d0 = lo + 30 + lnl + lxl;
      out.push({ name, method, data: u8.subarray(d0, d0 + csize), size, crc });
      p += 46 + nl + xl + cl;
    }
    return out;
  }
  function unzip(u8) {
    const m = new Map();
    for (const e of entries(u8)) {
      if (e.method !== 0) throw new Error(e.name + ": a compressed entry (use unzipAsync)");
      if (crc32(e.data) !== e.crc) throw new Error(e.name + ": damaged (CRC)");
      m.set(e.name, e.data);
    }
    return m;
  }
  async function inflateRaw(data) {
    if (typeof root.DecompressionStream === "function") {
      const ds = new root.DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(data); w.close();
      return new Uint8Array(await new root.Response(ds.readable).arrayBuffer());
    }
    if (typeof require === "function") return new Uint8Array(require("zlib").inflateRawSync(Buffer.from(data)));
    throw new Error("this browser can not inflate");
  }
  async function unzipAsync(u8) {
    const m = new Map();
    for (const e of entries(u8)) {
      const d = e.method === 0 ? e.data : e.method === 8 ? await inflateRaw(e.data) : null;
      if (!d) throw new Error(e.name + ": an unknown compression");
      if (crc32(d) !== e.crc) throw new Error(e.name + ": damaged (CRC)");
      m.set(e.name, d);
    }
    return m;
  }
  async function deflateRaw(data) {
    if (typeof root.CompressionStream === "function") {
      const cs = new root.CompressionStream("deflate-raw"), w = cs.writable.getWriter(); w.write(data); w.close();
      return new Uint8Array(await new root.Response(cs.readable).arrayBuffer());
    }
    if (typeof require === "function") return new Uint8Array(require("zlib").deflateRawSync(Buffer.from(data)));
    return null;
  }
  /** zip() with DEFLATE for the entries marked {deflate: true} (raw masks, fields - not the PNGs) where the browser can */
  async function zipAsync(files) {
    const out = [];
    for (const f of files) {
      const data = typeof f.data === "string" ? utf8(f.data) : f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      const z = f.deflate && data.length > 64 ? await deflateRaw(data) : null;
      out.push(z && z.length < data.length ? { name: f.name, data, z } : { name: f.name, data });
    }
    return zipRaw(out);
  }
  /** the writer behind zip / zipAsync: entries {name, data, z (the deflated bytes, or none = stored)} */
  function zipRaw(files) {
    const now = dosTime(new Date()), parts = [], central = [];
    let off = 0;
    for (const f of files) {
      const name = utf8(String(f.name)), data = f.data, body = f.z || data, method = f.z ? 8 : 0, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
      lh.setUint16(10, now[0], true); lh.setUint16(12, now[1], true); lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, body);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
      ch.setUint16(12, now[0], true); ch.setUint16(14, now[1], true); ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + body.length;
    }
    const cdSize = central.reduce((a, p) => a + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]), out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
    let o = 0; for (const p of all) { out.set(p, o); o += p.length; }
    return out;
  }
  const BgZip = { zip, zipAsync, unzip, unzipAsync, entries, crc32, utf8, text };
  if (typeof module !== "undefined" && module.exports) module.exports = BgZip;
  else root.BgZip = BgZip;
})(typeof window !== "undefined" ? window : globalThis);

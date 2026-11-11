// bitGen Studio — lib/zipWrite.js (2.520.0): a small .zip WRITER (stored, no compression - pictures are already
// compressed). The LoRA trainer's ⤓ Export job (lib/loraTrain.js) - the dataset + config.yaml to run on another machine
// (a RunPod pod's ai-toolkit). lib/unzip.js is the reader.
//   zip([{name, data: Buffer}]) -> Buffer      crc32(buf) -> uint32
// 2.715.0: an entry with deflate: true is compressed (method 8 - zlib, no new dependency): the language packs are text.
"use strict";
let TABLE = null;
function crc32(buf) {
  const Z = require("zlib");
  if (typeof Z.crc32 === "function") return Z.crc32(buf) >>> 0;   // 2.763.5: Node's own (22.2+) - far quicker on a big file
  if (!TABLE) { TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosTime(d) {
  const t = d || new Date();
  return { time: (t.getHours() << 11) | (t.getMinutes() << 5) | Math.floor(t.getSeconds() / 2), date: ((t.getFullYear() - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate() };
}
function zip(entries, when) {
  const parts = [], central = [];
  let off = 0;
  const { time, date } = dosTime(when);
  for (const e of entries || []) {
    const name = Buffer.from(String(e.name).replace(/\\/g, "/"), "utf8"), data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data || ""), "utf8");
    const crc = crc32(data);
    const packed = e.deflate ? require("zlib").deflateRawSync(data, { level: 9 }) : data, method = e.deflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(packed.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, packed);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(packed.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, name);
    off += 30 + name.length + packed.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE((entries || []).length, 8); end.writeUInt16LE((entries || []).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
/** 2.763.5: zip() that lets the server breathe between files - a big custom-node folder (hundreds of MB) no longer holds
 *  bitGen still while it is packed (lib/podNodes.js). entries [{name, data | path, deflate?}] - a path is read when its
 *  turn comes; deflate at level 6. tick(i, n) after each entry. -> Promise<Buffer> */
async function zipAsync(entries, when, tick) {
  const fs = require("fs"), Z = require("zlib"), parts = [], central = [], list = entries || [];
  let off = 0;
  const { time, date } = dosTime(when);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    await new Promise((r) => setImmediate(r));
    const name = Buffer.from(String(e.name).replace(/\\/g, "/"), "utf8");
    const data = e.path ? await fs.promises.readFile(e.path) : (Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data || ""), "utf8"));
    const crc = crc32(data);
    const packed = e.deflate ? await new Promise((res, rej) => Z.deflateRaw(data, { level: 6 }, (err, b) => (err ? rej(err) : res(b)))) : data, method = e.deflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(packed.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, packed);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(packed.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, name);
    off += 30 + name.length + packed.length;
    if (tick) tick(i + 1, list.length);
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(list.length, 8); end.writeUInt16LE(list.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
module.exports = { zip, zipAsync, crc32 };

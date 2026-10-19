// bitGen Studio — lib/zipWrite.js (2.520.0): a small .zip WRITER (stored, no compression - pictures are already
// compressed). The LoRA trainer's ⤓ Export job (lib/loraTrain.js) - the dataset + config.yaml to run on another machine
// (a RunPod pod's ai-toolkit). lib/unzip.js is the reader.
//   zip([{name, data: Buffer}]) -> Buffer      crc32(buf) -> uint32
"use strict";
let TABLE = null;
function crc32(buf) {
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
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, name);
    off += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE((entries || []).length, 8); end.writeUInt16LE((entries || []).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
module.exports = { zip, crc32 };

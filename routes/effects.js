// bitGen Studio — routes/effects.js (2.409.0): ✨ effects' server bits. Mounted from routes/index.js (never server.js).
//
//   POST /api/effects/adjustment   -> {name}   makes images/adjustment.png (a see-through placeholder) in this project:
//                                     an ADJUSTMENT LAYER is a picture-layer clip marked `adjust` - it trims, moves and
//                                     saves like any picture; the canvas and the compile never draw the placeholder
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const core = require("../lib/core");

const NAME = "adjustment.png";
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** a w x h fully transparent RGBA PNG */
function clearPng(w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);           // filter byte 0 + zeros = transparent black
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr),
                        chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function mount(app) {
  app.post("/api/effects/adjustment", (_req, res) => {
    try {
      const d = core.pDir("images");
      fs.mkdirSync(d, { recursive: true });
      const p = path.join(d, NAME);
      if (!fs.existsSync(p)) fs.writeFileSync(p, clearPng(16, 16));
      res.json({ ok: true, name: NAME });
    } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
  });
}

module.exports = { mount, clearPng, NAME };

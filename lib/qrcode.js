// bitGen Studio — a QR encoder with no dependencies, because this app has no
// runtime network and must not fetch a library from a CDN to draw a code.
//
// Byte mode, error-correction level M, versions 1-10 (up to 213 bytes: a LAN
// URL with a pairing token is ~70). Emits SVG so the UI can print it at any
// size without a canvas.
//
// HOW THIS IS VERIFIED (scripts/test-qrcode.js), since "it looks like a QR" is
// worth nothing and a scanner is not available here:
//   * the Reed-Solomon block is checked by SYNDROMES - every codeword is
//     evaluated at a^1..a^n and must come out zero, which is the definition of
//     a valid RS codeword and does not depend on any remembered constant;
//   * the format bits are checked for divisibility by the BCH generator;
//   * the placement and mask are checked by READING THE SYMBOL BACK along the
//     same zigzag and rebuilding the codeword stream. That round trip is what
//     catches the classic silent bugs.

// ---- GF(256), primitive polynomial 0x11d ---------------------------------
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];                       // the x term keeps it monic
      next[j + 1] ^= gmul(poly[j], EXP[i]);     // the a^i term
    }
    poly = next;
  }
  return poly;                        // monic, length degree+1
}

/** The `ec` error-correction codewords for one data block. */
function rsEncode(data, ec) {
  const gen = rsGenerator(ec);
  const rem = new Array(ec).fill(0);
  for (const d of data) {
    const factor = d ^ rem[0];
    rem.shift(); rem.push(0);
    if (factor !== 0) for (let i = 0; i < ec; i++) rem[i] ^= gmul(gen[i + 1], factor);
  }
  return rem;
}

// ---- version tables, ECC level M only ------------------------------------
// [total codewords, ec codewords per block, [[blocks, data codewords], ...]]
const VERSIONS = {
  1:  [26,  10, [[1, 16]]],
  2:  [44,  16, [[1, 28]]],
  3:  [70,  26, [[1, 44]]],
  4:  [100, 18, [[2, 32]]],
  5:  [134, 24, [[2, 43]]],
  6:  [172, 16, [[4, 27]]],
  7:  [196, 18, [[4, 31]]],
  8:  [242, 22, [[2, 38], [2, 39]]],
  9:  [292, 22, [[3, 36], [2, 37]]],
  10: [346, 26, [[4, 43], [1, 44]]],
};
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const countBits = (v) => (v < 10 ? 8 : 16);

function dataCodewords(v) {
  const [, ec, groups] = VERSIONS[v];
  let n = 0;
  for (const [blocks, dataLen] of groups) n += blocks * dataLen;
  return n;
}

/** Smallest version in 1..10 that fits `len` bytes, or 0. */
function pickVersion(len) {
  for (let v = 1; v <= 10; v++) {
    const capacityBits = dataCodewords(v) * 8 - 4 - countBits(v);
    if (len * 8 <= capacityBits) return v;
  }
  return 0;
}

// ---- bit stream ----------------------------------------------------------
function buildCodewords(bytes, v) {
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);                          // byte mode
  push(bytes.length, countBits(v));
  for (const b of bytes) push(b, 8);
  const total = dataCodewords(v) * 8;
  for (let i = 0; i < 4 && bits.length < total; i++) bits.push(0);   // terminator
  while (bits.length % 8) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    out.push(b);
  }
  const PAD = [0xEC, 0x11];
  for (let i = 0; out.length < dataCodewords(v); i++) out.push(PAD[i % 2]);
  return out;
}

/** Split into blocks, RS-encode each, then interleave as the spec requires. */
function interleave(dataCw, v) {
  const [, ec, groups] = VERSIONS[v];
  const dBlocks = [], eBlocks = [];
  let at = 0;
  for (const [blocks, dataLen] of groups) {
    for (let i = 0; i < blocks; i++) {
      const d = dataCw.slice(at, at + dataLen); at += dataLen;
      dBlocks.push(d);
      eBlocks.push(rsEncode(d, ec));
    }
  }
  const out = [];
  const maxD = Math.max(...dBlocks.map((b) => b.length));
  for (let i = 0; i < maxD; i++) for (const b of dBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ec; i++) for (const b of eBlocks) out.push(b[i]);
  return { stream: out, dBlocks, eBlocks };
}

// ---- symbol --------------------------------------------------------------
function blankMatrix(size) {
  return { size, m: Array.from({ length: size }, () => new Array(size).fill(0)),
           fixed: Array.from({ length: size }, () => new Array(size).fill(false)) };
}

function setF(M, r, c, val) {
  if (r < 0 || c < 0 || r >= M.size || c >= M.size) return;
  M.m[r][c] = val ? 1 : 0; M.fixed[r][c] = true;
}

function placeFunctionPatterns(M, v) {
  const n = M.size;
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const ring = inner && (r === 0 || r === 6 || c === 0 || c === 6
                             || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      setF(M, r0 + r, c0 + c, inner ? (ring ? 1 : 0) : 0);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) {            // timing
    setF(M, 6, i, i % 2 === 0); setF(M, i, 6, i % 2 === 0);
  }
  const centers = ALIGN[v];
  for (const r of centers) for (const c of centers) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const edge = Math.max(Math.abs(dr), Math.abs(dc));
      setF(M, r + dr, c + dc, edge !== 1);
    }
  }
  setF(M, n - 8, 8, 1);                        // the always-dark module
  for (let i = 0; i <= 8; i++) {               // reserve format areas
    if (!M.fixed[8][i]) setF(M, 8, i, 0);
    if (!M.fixed[i][8]) setF(M, i, 8, 0);
  }
  for (let i = 0; i < 8; i++) {
    if (!M.fixed[8][n - 1 - i]) setF(M, 8, n - 1 - i, 0);
    if (!M.fixed[n - 1 - i][8]) setF(M, n - 1 - i, 8, 0);
  }
  if (v >= 7) {                                // version information blocks
    const bits = versionBits(v);
    for (let i = 0; i < 18; i++) {
      const b = (bits >> i) & 1;
      setF(M, Math.floor(i / 3), n - 11 + (i % 3), b);
      setF(M, n - 11 + (i % 3), Math.floor(i / 3), b);
    }
  }
}

function bch(value, generator, genBits) {
  let v = value;
  const top = 1 << (genBits - 1);
  for (let i = genBits - 1; i >= 0; i--) {
    if (v & (top << i)) v ^= generator << i;
  }
  return v;
}

/** 18-bit version info: 6 data bits + BCH(18,6) remainder, generator 0x1F25. */
function versionBits(v) {
  return (v << 12) | bch(v << 12, 0x1F25, 13);
}

/** 15-bit format info for level M (bits 00) and a mask, XOR 0x5412. */
function formatBits(mask) {
  const data = (0b00 << 3) | mask;
  return (((data << 10) | bch(data << 10, 0x537, 11)) ^ 0x5412) & 0x7FFF;
}

function placeFormat(M, mask) {
  const n = M.size, bits = formatBits(mask);
  const bit = (i) => (bits >> i) & 1;
  for (let i = 0; i <= 5; i++) { setF(M, 8, i, bit(i)); setF(M, n - 1 - i, 8, bit(i)); }
  setF(M, 8, 7, bit(6)); setF(M, 8, 8, bit(7)); setF(M, 7, 8, bit(8));
  setF(M, n - 7, 8, bit(6));
  for (let i = 9; i <= 14; i++) setF(M, 14 - i, 8, bit(i));
  for (let i = 9; i <= 14; i++) setF(M, 8, n - 15 + i, bit(i));
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** The zigzag data path: right-to-left column pairs, skipping column 6. */
function dataPath(M) {
  const n = M.size, out = [];
  let up = true;
  for (let right = n - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (const c of [right, right - 1]) {
        if (!M.fixed[r][c]) out.push([r, c]);
      }
    }
    up = !up;
  }
  return out;
}

function placeData(M, stream, mask) {
  const path = dataPath(M);
  const fn = MASKS[mask];
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    const byte = stream[i >> 3];
    const bit = byte === undefined ? 0 : (byte >> (7 - (i & 7))) & 1;
    M.m[r][c] = bit ^ (fn(r, c) ? 1 : 0);
  }
}

function penalty(M) {
  const n = M.size, m = M.m;
  let score = 0;
  const run = (get) => {
    for (let a = 0; a < n; a++) {
      let last = -1, len = 0;
      for (let b = 0; b < n; b++) {
        const v = get(a, b);
        if (v === last) { len++; if (len === 5) score += 3; else if (len > 5) score += 1; }
        else { last = v; len = 1; }
      }
    }
  };
  run((a, b) => m[a][b]); run((a, b) => m[b][a]);
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
  }
  const PAT = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const hit = (get, a, b) => {
    for (let i = 0; i < 11; i++) if (get(a, b + i) !== PAT[i]) return false;
    return true;
  };
  for (let a = 0; a < n; a++) for (let b = 0; b + 11 <= n; b++) {
    if (hit((x, y) => m[x][y], a, b)) score += 40;
    if (hit((x, y) => m[y][x], a, b)) score += 40;
  }
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += m[r][c];
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/** Encode `text` and return {size, modules:[[0|1]], version, mask}. */
function encode(text) {
  const bytes = Array.from(Buffer.from(String(text), "utf8"));
  const v = pickVersion(bytes.length);
  if (!v) throw new Error(`too long for a version-10 QR: ${bytes.length} bytes (max 213)`);
  const { stream } = interleave(buildCodewords(bytes, v), v);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const M = blankMatrix(17 + 4 * v);
    placeFunctionPatterns(M, v);
    placeFormat(M, mask);
    placeData(M, stream, mask);
    const p = penalty(M);
    if (!best || p < best.p) best = { p, M, mask };
  }
  return { size: best.M.size, modules: best.M.m, version: v, mask: best.mask, stream };
}

/** An SVG string, with the 4-module quiet zone the spec requires. */
function svg(text, { scale = 6, quiet = 4, dark = "#111", light = "#fff" } = {}) {
  const { size, modules } = encode(text);
  const dim = (size + quiet * 2) * scale;
  let d = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) d += `M${(c + quiet) * scale} ${(r + quiet) * scale}h${scale}v${scale}h-${scale}z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" `
       + `viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">`
       + `<rect width="${dim}" height="${dim}" fill="${light}"/>`
       + `<path d="${d}" fill="${dark}"/></svg>`;
}

module.exports = {
  encode, svg, pickVersion, dataCodewords, rsEncode, rsGenerator, gmul, EXP, LOG,
  buildCodewords, interleave, formatBits, versionBits, dataPath, MASKS, VERSIONS,
  blankMatrix, placeFunctionPatterns, placeFormat, placeData,
};

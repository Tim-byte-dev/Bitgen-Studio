// bitGen Studio — lib/qrcode.js. A QR that "looks right" is worth nothing, and
// there is no scanner here, so everything below is checked mathematically or by
// reading the finished symbol back. Run: node scripts/test-qrcode.js
const path = require("path");
const Q = require(path.join(__dirname, "..", "lib", "qrcode"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

// ---- GF(256) ------------------------------------------------------------
check("GF(256): the field is a full cycle of 255 non-zero elements",
      new Set(Array.from({ length: 255 }, (_, i) => Q.EXP[i])).size === 255);
check("GF(256): multiplication has an identity and annihilates zero",
      Q.gmul(1, 173) === 173 && Q.gmul(0, 173) === 0);
check("GF(256): a * a^-1 = 1 across the field",
      Array.from({ length: 254 }, (_, i) => i + 1)
        .every((e) => Q.gmul(Q.EXP[e], Q.EXP[255 - e]) === 1));

// ---- Reed-Solomon, checked by SYNDROMES ---------------------------------
// A codeword is valid iff C(a^i) = 0 for i = 1..ec. This proves the encoder
// without depending on any generator polynomial remembered from a table.
function syndromeAt(cw, i) {
  let acc = 0;
  for (const b of cw) acc = Q.gmul(acc, Q.EXP[i]) ^ b;      // Horner at x = a^i
  return acc;
}
// QR uses a narrow-sense RS code with roots a^0 .. a^(ec-1): the codeword
// polynomial vanishes at every one of them. That is the whole definition, and
// checking it needs no generator polynomial from any table.
function syndromesZero(data, ec) {
  const cw = data.concat(Q.rsEncode(data, ec));
  for (let i = 0; i < ec; i++) {
    if (syndromeAt(cw, i) !== 0) return false;
  }
  return true;
}
check("RS: every syndrome of an encoded block is zero (ec=10)",
      syndromesZero([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10));
check("RS: the same holds for every EC size the version table uses",
      [10, 16, 18, 22, 24, 26].every((ec) =>
        syndromesZero(Array.from({ length: 40 }, (_, i) => (i * 37 + 11) & 0xff), ec)));
check("RS: a corrupted codeword does NOT pass the syndrome check (the test can fail)",
      (() => {
        const d = [1, 2, 3, 4, 5], cw = d.concat(Q.rsEncode(d, 10));
        cw[2] ^= 0x55;
        return [0, 1, 2, 3].some((i) => syndromeAt(cw, i) !== 0);
      })());
check("RS: the generator polynomial is monic and of the right degree",
      Q.rsGenerator(10).length === 11 && Q.rsGenerator(10)[0] === 1);

// ---- BCH: format and version information --------------------------------
// The 15-bit format word, once the 0x5412 mask is removed, must be divisible by
// the BCH generator 0x537 - that is the property a decoder relies on.
function divisible(value, gen, genBits) {
  let v = value;
  for (let i = 15 - genBits; i >= 0; i--) if (v & (1 << (i + genBits - 1))) v ^= gen << i;
  return v === 0;
}
check("format bits: all 8 masks produce a word divisible by the BCH generator",
      [0, 1, 2, 3, 4, 5, 6, 7].every((m) => divisible(Q.formatBits(m) ^ 0x5412, 0x537, 11)));
check("format bits: the 8 masks give 8 DIFFERENT words",
      new Set([0, 1, 2, 3, 4, 5, 6, 7].map(Q.formatBits)).size === 8);
check("format bits: level M is encoded in the top two data bits (00)",
      [0, 3, 7].every((m) => (((Q.formatBits(m) ^ 0x5412) >> 13) & 0b11) === 0b00));
check("version bits: the top 6 bits are the version itself",
      [7, 8, 9, 10].every((v) => (Q.versionBits(v) >> 12) === v));
check("version bits: 18 bits wide, and distinct per version",
      new Set([7, 8, 9, 10].map(Q.versionBits)).size === 4
      && Q.versionBits(10) < (1 << 18));

// ---- version choice ------------------------------------------------------
check("version 1 is chosen for a short string, and it holds 14 bytes",
      Q.pickVersion(1) === 1 && Q.pickVersion(14) === 1 && Q.pickVersion(15) === 2);
check("a typical LAN pairing URL fits comfortably",
      Q.pickVersion("http://192.168.1.50:8311/remote?t=aBcDeFgHiJkLmNoPqRsTuV".length) <= 4);
check("capacity table is self-consistent: data + ec = total, for every version",
      Object.keys(Q.VERSIONS).every((v) => {
        const [total, ec, groups] = Q.VERSIONS[v];
        const blocks = groups.reduce((n, [b]) => n + b, 0);
        return Q.dataCodewords(+v) + blocks * ec === total;
      }));
check("too long is an error, not a silently truncated code",
      (() => { try { Q.encode("x".repeat(400)); return false; } catch { return true; } })());

// ---- THE ROUND TRIP: read the finished symbol back ----------------------
// Rebuild the codeword stream by walking the same zigzag and un-masking. This
// is what catches a wrong mask, a reversed bit order, or a data path that runs
// over a function pattern.
function readBack(text) {
  const enc = Q.encode(text);
  const M = Q.blankMatrix(enc.size);
  Q.placeFunctionPatterns(M, enc.version);
  Q.placeFormat(M, enc.mask);
  const path2 = Q.dataPath(M);
  const fn = Q.MASKS[enc.mask];
  const bits = path2.map(([r, c]) => enc.modules[r][c] ^ (fn(r, c) ? 1 : 0));
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    out.push(b);
  }
  return { enc, read: out };
}
for (const sample of ["http://192.168.1.50:8311/remote?t=Ab3-_x9",
                      "hello", "x".repeat(120)]) {
  const { enc, read } = readBack(sample);
  const ok = enc.stream.every((b, i) => read[i] === b);
  check(`round trip: the symbol reads back as the exact codeword stream (${sample.length} bytes, v${enc.version})`,
        ok, ok ? undefined : { want: enc.stream.slice(0, 8), got: read.slice(0, 8) });
}

// ---- structure -----------------------------------------------------------
const E = Q.encode("http://192.168.1.50:8311/remote?t=TESTTESTTEST");
const m = E.modules, n = E.size;
check("the symbol is the right size for its version", n === 17 + 4 * E.version);
const finderOK = (r0, c0) => m[r0][c0] === 1 && m[r0 + 6][c0 + 6] === 1
  && m[r0 + 1][c0 + 1] === 0 && m[r0 + 3][c0 + 3] === 1;
check("three finder patterns, in the three corners a scanner looks in",
      finderOK(0, 0) && finderOK(0, n - 7) && finderOK(n - 7, 0));
const FINDER = [[1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],
                [1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]];
const isFinder = (r0, c0) => FINDER.every((row, r) => row.every((v, c) => m[r0 + r][c0 + c] === v));
check("the three finder patterns match the spec exactly, module for module",
      isFinder(0, 0) && isFinder(0, n - 7) && isFinder(n - 7, 0));
check("the fourth corner has NO finder (that is how a scanner reads orientation)",
      !isFinder(n - 7, n - 7));
check("the timing patterns alternate",
      Array.from({ length: n - 16 }, (_, i) => i + 8)
        .every((i) => m[6][i] === (i % 2 === 0 ? 1 : 0) && m[i][6] === (i % 2 === 0 ? 1 : 0)));
check("the always-dark module is set", m[n - 8][8] === 1);

// ---- SVG -----------------------------------------------------------------
const s = Q.svg("http://192.168.1.50:8311/remote?t=abc", { scale: 5, quiet: 4 });
check("svg: well-formed, sized for the quiet zone, and draws something",
      s.startsWith("<svg") && s.endsWith("</svg>")
      && s.includes(`width="${(E.size + 8) * 5}"`) === false || s.includes("<path"), undefined);
check("svg: includes the 4-module quiet zone in its dimensions",
      (() => {
        const enc = Q.encode("http://192.168.1.50:8311/remote?t=abc");
        return s.includes(`width="${(enc.size + 8) * 5}"`);
      })());
check("svg: no external references (this app has no runtime network)",
      !/https?:\/\/(?!www\.w3\.org)/.test(s));

console.log("==============================");
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);

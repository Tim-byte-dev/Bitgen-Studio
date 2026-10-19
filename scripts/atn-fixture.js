// scripts/atn-fixture.js — 2.469.0: a tiny Photoshop .atn WRITER for the tests (scripts/test-atn.js, test-atn-ui.js):
// version 16, Unicode strings, action descriptors with units, longs, enums, references, nested objects and lists -
// the way Photoshop writes them - and the sample set "Photo Fix" both tests read.
"use strict";
function W() {
  const b = [];
  const w = {
    u8: (v) => b.push(v & 255), u16: (v) => { b.push((v >> 8) & 255, v & 255); }, i32: (v) => { const x = v >>> 0; b.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255); },
    f64: (v) => { const d = new DataView(new ArrayBuffer(8)); d.setFloat64(0, v); for (let i = 0; i < 8; i++) b.push(d.getUint8(i)); },
    ascii: (s) => { for (const c of s) b.push(c.charCodeAt(0)); },
    uni: (s) => { w.i32(s.length + 1); for (const c of s) w.u16(c.charCodeAt(0)); w.u16(0); },
    id: (s) => { if (s.length === 4) { w.i32(0); w.ascii(s); } else { w.i32(s.length); w.ascii(s); } },
    pascal: (s) => { w.i32(s.length); w.ascii(s); },
    bytes: () => Uint8Array.from(b),
  };
  return w;
}
// values: ["UntF", "#Pxl", 3] | ["doub", 1] | ["long", 5] | ["bool", true] | ["TEXT", "x"] | ["enum", type, value] | ["obj ", [refs]] | ["Objc", cls, {..}] | ["VlLs", [values]]
function val(w, v) {
  const [t] = v; w.ascii(t);
  if (t === "UntF") { w.ascii(v[1]); w.f64(v[2]); }
  else if (t === "doub") w.f64(v[1]);
  else if (t === "long") w.i32(v[1]);
  else if (t === "bool") w.u8(v[1] ? 1 : 0);
  else if (t === "TEXT") w.uni(v[1]);
  else if (t === "enum") { w.id(v[1]); w.id(v[2]); }
  else if (t === "Objc") desc(w, v[1], v[2]);
  else if (t === "VlLs") { w.i32(v[1].length); for (const x of v[1]) val(w, x); }
  else if (t === "obj ") { w.i32(v[1].length); for (const r of v[1]) { w.ascii(r[0]); if (r[0] === "Enmr") { w.uni(""); w.id(r[1]); w.id(r[2]); w.id(r[3]); } else if (r[0] === "prop") { w.uni(""); w.id(r[1]); w.id(r[2]); } else if (r[0] === "Clss") { w.uni(""); w.id(r[1]); } } }
}
function desc(w, cls, obj) { w.uni(""); w.id(cls); const ks = Object.keys(obj); w.i32(ks.length); for (const k of ks) { w.id(k); val(w, obj[k]); } }
function atn(setName, actions) {
  const w = W(); w.i32(16); w.uni(setName); w.u8(1); w.i32(actions.length);
  for (const a of actions) {
    w.u16(a.fkey || 0); w.u8(0); w.u8(0); w.u16(0); w.uni(a.name); w.u8(1); w.i32(a.items.length);
    for (const it of a.items) {
      w.u8(0); w.u8(it.enabled === false ? 0 : 1); w.u8(it.dialog ? 1 : 0); w.u8(0);
      if (it.event.length === 4) { w.ascii("long"); w.ascii(it.event); } else { w.ascii("TEXT"); w.pascal(it.event); }
      w.pascal(it.name);
      if (it.desc) { w.i32(-1); desc(w, "null", it.desc); } else w.i32(0);
    }
  }
  return w.bytes();
}
const curLayer = ["obj ", [["Enmr", "Lyr ", "Ordn", "Trgt"]]], curDoc = ["obj ", [["Enmr", "Dcmn", "Ordn", "Trgt"]]];
const bytes = atn("Photo Fix", [
  { name: "Soften", fkey: 2, items: [
    { event: "GsnB", name: "Gaussian Blur", desc: { "Rds ": ["UntF", "#Pxl", 3.5] } },
    { event: "UnsM", name: "Unsharp Mask", dialog: true, desc: { Amnt: ["UntF", "#Prc", 80], "Rds ": ["UntF", "#Pxl", 1.2], Thsh: ["long", 3] } },
    { event: "Dplc", name: "Duplicate", desc: { null: curLayer, Vrsn: ["long", 5] } },
    { event: "setd", name: "Set", desc: { null: curLayer, "T   ": ["Objc", "Lyr ", { Opct: ["UntF", "#Prc", 65], "Md  ": ["enum", "BlnM", "Scrn"] }] } },
    { event: "setd", name: "Set", desc: { null: curLayer, "T   ": ["Objc", "Lyr ", { "Md  ": ["enum", "BlnM", "Mltp"] }] } },
    { event: "HStr", name: "Hue/Saturation", desc: { Clrz: ["bool", false], Adjs: ["VlLs", [["Objc", "Hst2", { "H   ": ["long", 10], Strt: ["long", -20], Lght: ["long", 5] }]]] } },
  ] },
  { name: "Turn + misc", items: [
    { event: "Rtte", name: "Rotate", desc: { null: curDoc, Angl: ["UntF", "#Ang", 90] } },
    { event: "Flip", name: "Flip", desc: { null: curDoc, Axis: ["enum", "Ornt", "Hrzn"] } },
    { event: "setd", name: "Set Selection", desc: { null: ["obj ", [["prop", "Chnl", "fsel"]]], "T   ": ["enum", "Ordn", "Al  "] } },
    { event: "Invs", name: "Inverse" },
    { event: "Stop", name: "Stop", desc: { Msge: ["TEXT", "Check the sky"], Cntn: ["bool", true] } },
    { event: "placeEvent", name: "Place", desc: { Idnt: ["long", 3] } },
    { event: "Fltn", name: "Flatten Image", enabled: false },
  ] },
]);
module.exports = { W, val, desc, atn, bytes };

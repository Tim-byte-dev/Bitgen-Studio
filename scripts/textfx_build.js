#!/usr/bin/env node
/* bitGen Studio — scripts/textfx_build.js (2.411.0): a PSD text effect -> a BUILT-IN text effect preset (textfx/<id>.json)
 * with the same reader the page's ＋ Import uses (static/textfx.js fromPsd + the image editor's PSD effect mapping).
 *   node scripts/textfx_build.js <file.psd> "<Name>" [<file.psd> "<Name>" ...]
 * Only the effect's numbers are kept (no pixels, no fonts) - the PSD itself is not needed afterwards. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const A = require(path.join(ROOT, "static", "vendor", "ag-psd.js"));
const PP = require(path.join(ROOT, "ext", "imageeditdock", "pcpsd.js"));
const TFX = require(path.join(ROOT, "static", "textfx.js"));
const opts = { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true };
/* hand finishing of the built-in ones - what the PSD reader cannot see. Arena: its face sparkles (the PSD's glitter is
   baked into its picture, not in a layer style) -> a glitter pattern overlay on the face copy */
const TWEAKS = {
  "arena-gold-3d": (p) => {
    // a copy over the face, screened: bright sparkles on black (black screens to nothing) - over the face's colour overlay
    (function find(ns) {
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        if (n.name === "Arena copy 5") {
          ns.splice(i + 1, 0, { type: "text", name: "glitter", blend: "screen", opacity: 0.7, fillOpacity: 1, t: Object.assign({}, n.t),
            styles: { patternOverlay: { on: true, pattern: "glitter", c1: "#fff7a8", c2: "#000000", scale: 800, blend: "normal", opacity: 1 } } });
          return true;
        }
        if (n.kids && find(n.kids)) return true;
      }
      return false;
    })(p.nodes);
  },
};
const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2) { console.log("usage: node scripts/textfx_build.js <file.psd> \"<Name>\" ..."); process.exit(1); }
for (let i = 0; i < args.length; i += 2) {
  const psd = A.readPsd(fs.readFileSync(args[i]), opts);
  const p = TFX.fromPsd(psd, { effectsToStyles: PP.effectsToStyles, blendIn: PP.blendIn, rgbToHex: PP.rgbToHex, readPsd: (d) => A.readPsd(d, opts) }, args[i + 1]);
  p.id = "psd:" + TFX.slug(args[i + 1]);
  p.source = path.basename(args[i]).replace(/^[0-9a-f]{8}-/i, "");
  if (TWEAKS[TFX.slug(args[i + 1])]) TWEAKS[TFX.slug(args[i + 1])](p);
  const out = path.join(ROOT, "textfx", TFX.slug(args[i + 1]) + ".json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(p, null, 1));
  let n = 0; (function walk(ns) { for (const x of ns) { n++; if (x.kids) walk(x.kids); } })(p.nodes);
  console.log(JSON.stringify({ out: path.relative(ROOT, out), id: p.id, nodes: n, ref: p.ref, fill: p.fill, font: p.font, notes: p.notes }));
}

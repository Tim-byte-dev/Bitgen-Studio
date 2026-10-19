#!/usr/bin/env node
/* bitGen Studio — scripts/jxl-cli.js (2.479.0): JPEG XL from the command line (the Python workers use it).
 *   node scripts/jxl-cli.js topng <in.jxl> [out.png]   no out = the cached PNG (lib/jxl.js pngFile); prints the PNG's path
 *   node scripts/jxl-cli.js info <in.jxl>              prints {"width", "height", "animated"}
 * Exit 1 with the reason on stderr when the file is not a readable JPEG XL. */
"use strict";
const fs = require("fs");
const jxl = require("../lib/jxl");
(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  if (!cmd || !a) { console.error("use: jxl-cli.js topng <in.jxl> [out.png] | info <in.jxl>"); process.exit(2); }
  if (cmd === "topng") {
    if (b) { const r = await jxl.toPng(fs.readFileSync(a)); fs.writeFileSync(b, r.png); console.log(b); }
    else console.log(await jxl.pngFile(a));
  } else if (cmd === "info") {
    const r = await jxl.toPng(fs.readFileSync(a)); console.log(JSON.stringify({ width: r.width, height: r.height, animated: r.animated }));
  } else { console.error("unknown command " + cmd); process.exit(2); }
})().catch((e) => { console.error(e && e.message ? e.message : String(e)); process.exit(1); });

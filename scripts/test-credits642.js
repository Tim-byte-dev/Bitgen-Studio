#!/usr/bin/env node
/* bitGen Studio — 2.642.0: THE CREDITS (lib/credits.json -> lib/credits.js / routes/about.js / static/about.js, and the Credits
 * section of docs/USAGE.md made by scripts/make_credits.py -> the Guide PDF + the in-app Help). Pure + wiring. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require(path.join(ROOT, "lib/credits.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

const d = C.read(), a = C.about(), lines = d.credits.map((c) => c.role + c.join + c.name);
check("Tim's credit lines, exactly: Produced and Developed by Tim Paul / Programmer - Claude Opus 5.5", JSON.stringify(lines) === JSON.stringify(["Produced and Developed by Tim Paul", "Programmer - Claude Opus 5.5"]), lines);
check("about(): the name and package.json's version", a.name === "bitGen Studio" && a.version === JSON.parse(read("package.json")).version, a.version);
const items = d.sections.flatMap((s) => s.items);
check("credits to the work used: 9 sections, every item has a name and what it is for", d.sections.length === 9 && items.length > 60 && items.every((i) => i.name && i.what), { s: d.sections.length, n: items.length });
check("the projects whose code is in bitGen are there (NOTICE.md's vendor libraries + the re-implemented sources)", ["three.js", "pdf.js", "ag-psd", "polygon-clipping", "replicad and OpenCascade", "comfy-kitchen", "Hugging Face diffusers", "Viggle-Animate", "Krita AI Diffusion", "MiniMax-H3-NativeAudio-MusicVideo-Workflow"].every((n) => items.some((i) => i.name === n)));
check("links are https only (a bad one dropped)", items.every((i) => !i.url || /^https:\/\//.test(i.url)));
check("no other products' names that the 2.459.0 rule keeps out of what users see", !/CorelDRAW|Corel|Adobe|Photoshop|Illustrator|Premiere|After Effects|InDesign|Lightroom|Acrobat|Audition|PowerClip/.test(read("lib/credits.json")));
// the Guide's Credits section = lib/credits.json
const U = read("docs/USAGE.md"), blk = (U.split("<!-- credits:start -->")[1] || "").split("<!-- credits:end -->")[0];
check("docs/USAGE.md has the Credits section (between its markers, listed in the contents)", /^## Credits$/m.test(blk) && /\[Credits\]\(#credits\)/.test(U), blk.slice(0, 200));
check("…with both credit lines, every section and every item of lib/credits.json (python3 scripts/make_credits.py keeps it so)", lines.every((l) => blk.includes("**" + l + "**")) && d.sections.every((s) => blk.includes("### " + s.title)) && items.every((i) => blk.includes(i.name)));
// wiring
const IDX = read("routes/index.js"), SRV = read("misc/server.js"), H = read("static/index.html"), AB = read("static/about.js"), G = read("scripts/make_guide_pdf.py");
check("routes/about.js mounted from routes/index.js - server.js untouched", /require\("\.\/about"\)\.mount\(app\)/.test(IDX) && !/api\/about|credits/.test(SRV));
check("static/about.js loaded; it adds the About tab last in Settings (kept last) and reads /api/about", /<script src="\/static\/about\.js"><\/script>/.test(H) && /b\.dataset\.stab = "about"/.test(AB) && /tabs\.lastElementChild !== b/.test(AB) && /fetch\("\/api\/about"\)/.test(AB));
check("the Guide's cover prints the credit lines from lib/credits.json", /lib", "credits\.json"/.test(G) && /cr\["role"\] \+ cr\.get\("join", " "\) \+ cr\["name"\]/.test(G));
// html() is pure: escape + links in a new window
global.window = undefined;
const H3 = (() => { const root = { document: { readyState: "complete", getElementById: () => null, querySelector: () => null, addEventListener() {} } }; new Function("window", "globalThis", AB.replace(/\(typeof window !== "undefined" \? window : globalThis\)/, "(window)"))(root, root); return root.H3About; })();
const out = H3.html({ name: "bitGen Studio", version: "9.9.9", credits: [{ role: "A", join: " - ", name: "<b>" }], sections: [{ title: "T", items: [{ name: "x", url: "https://e.x/", what: "y" }] }] });
check("html(): the version, a line escaped, a link opening outside (target _blank)", /Version 9\.9\.9/.test(out) && /A - &lt;b&gt;/.test(out) && /href="https:\/\/e\.x\/" target="_blank" rel="noopener"/.test(out), out);

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);

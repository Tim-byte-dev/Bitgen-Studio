#!/usr/bin/env node
/* bitGen Studio — 2.929.0 in a REAL browser: ✨ Lifelike - the display mannequin made real by an edit style on your PC.
 * Tim: "your mannequins don't look human" -> "3D + your PC makes them real" -> "go next".
 * Against the running studio (H3_URL): the Character Creator's sheet tab, 🧍 Male picked -> ✨ Lifelike shows; pressed:
 * the front, side and back go to the edit style one after another (each as <Picture 1>, the prompt keeping the pose and
 * asking for a faceless gloss mannequin on black), the front lands in Your mannequins and opens as the start picture.
 * The renders are stand-ins (Playwright answers /api/genimage, /api/jobs, /outputs); the library is the real one (the item
 * is deleted after). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const zlib = require("zlib");
/** a plain 128 x 160 grey PNG (the library wants 64 x 64 at least) */
const PNG = (() => {
  const w = 128, h = 160, raw = Buffer.alloc((w * 3 + 1) * h, 0x88); for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
})();
(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sent = []; let n = 0, made = null;
  await p.route("**/api/aiedit/engines", async (route) => { const r = await route.fetch(); const j = await r.json(); j.edit = [{ id: "edit929", name: "Stand-in edit" }].concat(j.edit || []); route.fulfill({ json: j }); });
  await p.route("**/api/genimage", (route) => { sent.push(JSON.parse(route.request().postData() || "{}")); n++; route.fulfill({ json: { id: "fake929-" + n, status: "queued" } }); });
  await p.route(/\/api\/jobs\/fake929-\d+$/, (route) => { const k = route.request().url().split("-").pop(); route.fulfill({ json: { status: "done", outputs: ["life929-" + k + ".png"] } }); });
  await p.route(/\/outputs\/life929-\d+\.png$/, (route) => route.fulfill({ body: PNG, contentType: "image/png" }));
  await p.route("**/api/characters/gens", (route) => route.request().method() === "POST" ? route.fulfill({ json: { gens: [] } }) : route.continue());
  try {
    await p.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && window.H3MannequinLife && document.getElementById("chNewPic"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { localStorage.removeItem("h3sheet.v1"); document.getElementById("chNewPic").click(); });
    await p.waitForFunction(() => document.getElementById("h3sMannequin") && document.getElementById("h3sLife"), null, { timeout: 15000 });
    check("✨ Lifelike sits beside 🧍 Mannequin…, hidden until Male / Female is picked", await ev(() => document.getElementById("h3sLife").hidden && document.getElementById("h3sMannequin").nextElementSibling.id === "h3sLife"));
    await p.selectOption("#h3sMannequin", "male");
    await p.waitForTimeout(400);
    check("…🧍 Male picked -> ✨ Lifelike shows", await ev(() => !document.getElementById("h3sLife").hidden));
    const done = p.waitForResponse((r) => /\/api\/charsheet\/library\/mannequins$/.test(r.url()) && r.request().method() === "POST", { timeout: 60000 }).catch(() => null);
    await ev(() => document.getElementById("h3sLife").click());
    const lib = await done; made = lib ? await lib.json() : null;
    await p.waitForFunction(() => /✓ Lifelike male/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 30000 }).catch(() => {});
    check("the front, side and back went to the edit style one after another, each as <Picture 1> (mannequin-male-<view>.png)",
      sent.length === 3 && sent.map((x) => x.images && x.images[0]).join() === "mannequin-male-front.png,mannequin-male-side.png,mannequin-male-back.png" && sent.every((x) => x.style_id === "edit929"), sent.map((x) => x.images));
    check("…the prompt keeps the pose and asks for a faceless glossy white mannequin on black, the view named", sent.every((x) => /<Picture 1>/.test(x.prompt) && /faceless/.test(x.prompt) && /Keep the pose/.test(x.prompt) && /black background/.test(x.prompt)) && /from the side/.test(sent[1].prompt) && /from behind/.test(sent[2].prompt));
    check("the front went into Your mannequins (\"Lifelike male display mannequin\") and is the start picture now", made && made.id && /Lifelike male display mannequin/.test(made.name) && await ev((id) => document.getElementById("h3sMannequin").value === "own:" + id, made.id), made);
    check("the note says so (the side and back in the Gallery)", /Gallery/.test(await ev(() => document.getElementById("h3sPicNote").textContent)));
    const v = await (await fetch(URL_ + "/api/charsheet/h3/mannequin-view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sex: "female", view: "nope" }) })).json();
    check("the views route takes front / side / back only", /front, side and back/.test(v.error || ""), v);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    await b.close();
    if (made && made.id) await fetch(URL_ + "/api/charsheet/library/mannequins/" + made.id, { method: "DELETE" }).catch(() => {});
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

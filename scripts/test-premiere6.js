#!/usr/bin/env node
/* bitGen Studio — 2.411.0 units: the Premiere leftovers - J / K / L shuttle (ext/timelinedock/tlkeys.js + canvas.js),
 * L yielding to the shuttle over the timeline (static/secfloat.js), 📤 MP4 · AV1 + MP4 · H.265 10-bit and the graphics
 * card's encoder with a software fallback (lib/exportPresets.json, scripts/deliver.py), the text effect presets'
 * plumbing (static/textfx.js, lib/textFx.js, routes/textfx.js) wired in without touching server.js.
 * Tim: "yes please and any premier leftovers that you can do comfortably". */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8" });

/* ---- 1. J / K / L (tlkeys.js action table) */
{
  const ctx = { window: null, document: { readyState: "complete", getElementById: () => null, addEventListener() {} }, setTimeout() {}, console };
  ctx.window = { addEventListener() {} };
  vm.createContext(ctx);
  vm.runInContext(read("ext", "timelinedock", "tlkeys.js"), ctx);
  const K = ctx.window.TlKeys, A = (k, m, lay, tl) => K.action(k, Object.assign({ ctrl: false, shift: false, alt: false, meta: false }, m || {}), lay !== false, tl !== false);
  check("L = shuttle forwards, J = backwards, K = stop - over the layers AND anywhere else in the timeline docker (the canvas too)",
    A("l") === "shuttleFwd" && A("j") === "shuttleBack" && A("k") === "shuttleStop" && A("L", {}, false, true) === "shuttleFwd" && A("j", {}, false, true) === "shuttleBack" && A("k", {}, false, true) === "shuttleStop");
  check("...K held: L / J = one frame on / back", A("l", { kHeld: true }) === "stepFwd" && A("j", { kHeld: true }, false, true) === "stepBack");
  check("...outside the timeline, or with Ctrl / Alt / Shift: nothing (Ctrl+K is still split)",
    A("l", {}, false, false) === "" && A("k", {}, false, false) === "" && A("l", { shift: true }) === "" && A("j", { alt: true }) === "" && A("k", { ctrl: true }) === "split");
  check("the earlier keys unchanged (V, I, M, Ctrl+Shift+E)", A("v") === "mode:select" && A("i") === "in" && A("m") === "marker" && A("e", { ctrl: true, shift: true }, false, true) === "still");
  check("the shortcut map lists J / K / L and K + J / K + L", K.KEYS.some((k) => k[0] === "J / K / L") && K.KEYS.some((k) => k[0] === "K + J / K + L"));
}
const TK = read("ext", "timelinedock", "tlkeys.js");
check("tlkeys: K down remembered, K up / leaving the window forgets it; held J / K / L do not scroll the page",
  /keyup[\s\S]{0,120}"k"\) kHeld = false/.test(TK) && /blur[\s\S]{0,60}kHeld = false/.test(TK) && /\^\[jkl\]\$\/i\.test\(e\.key\) && inTimeline\(\)/.test(TK));

/* ---- 2. the canvas's shuttle */
const CV = read("ext", "timelinedock", "canvas.js");
check("canvas.js: shuttle(dir) doubles 1 -> 2 -> 4 -> 8 (no more), -1 -> -8 backwards, 0 = pause; step(n) one frame, paused",
  /function shuttle\(dir\)/.test(CV) && /Math\.min\(8, cur \* 2\)/.test(CV) && /Math\.max\(-8, cur \* 2\)/.test(CV) && /if \(!dir\) \{ pause\(\); return 0; \}/.test(CV)
  && /function step\(n\) \{ pause\(\); go\(fsnap\(S\.t \+ \(n \|\| 1\) \/ FPS\)\)/.test(CV));
check("...pause() goes back to 1x; play(rate) only takes a number (the ▶ button's click is not a speed); the speed shown beside ▶ (#tlCRate)",
  /S\.playing = false;\s*S\.rate = 1;/.test(CV) && /S\.rate = typeof rate === "number" && rate \? rate : 1;/.test(CV) && /sr\.id = "tlCRate"/.test(CV)
  && /shuttle: shuttle, step: step/.test(CV));

/* ---- 3. L over the timeline belongs to the shuttle, not LLM tokens */
const SF = require(path.join(ROOT, "static", "secfloat.js"));
check("secfloat: TL_OWNS = the timeline docker + the dockers beside its canvas; L there is left to the shuttle (S is not)",
  SF.TL_OWNS === "#timelinedock, .tsd" && /owner \|\| \(tlOwn && (W\[id\]\.spec|sp)\.key === "l"\)/.test(read("static", "secfloat.js"))
  && SF.SPECS.some((s) => s.key === "l") && !SF.wants({ key: "l" }, "l", null, false, true) && SF.wants({ key: "l" }, "l", null, false, false));

/* ---- 4. 📤 AV1 + H.265 10-bit, the graphics card's encoder */
const EP = JSON.parse(read("lib", "exportPresets.json"));
check("exportPresets: MP4 · AV1 + MP4 · H.265 10-bit (10 presets; 12 since 2.412.0)", EP.presets.length >= 10 && EP.presets.some((p) => p.id === "av1" && p.ext === "mp4" && p.video && p.audio)
  && EP.presets.some((p) => p.id === "h265_10" && p.label === "MP4 · H.265 10-bit"), EP.presets.map((p) => p.id));
const R = JSON.parse(py(`import deliver as D
info={"w":1920,"h":1080,"fps":30,"audio":True}
a=lambda d,enc=None: " ".join(D.args_for(d,info,"01:00:00:00",enc)[0])
D._hw_ok.update({"hevc_nvenc":False,"hevc_qsv":False,"av1_nvenc":False,"av1_qsv":False,"av1_amf":False,"h264_nvenc":True})
none=[D.pick_encoder("h265_10",True), D.pick_encoder("av1",False)[1], D.pick_encoder("h264",False)]
yes=D.pick_encoder("h264",True)
D._hw_ok["hevc_qsv"]=True
q=D.pick_encoder("h265_10",True)
enc=D.encoders; D.encoders=lambda: {"libaom-av1"}
aom=D.pick_encoder("av1",False); D.encoders=enc
print(json.dumps({"av1":a({"preset":"av1","quality":"small"}),"h10":a({"preset":"h265_10","quality":"high"}),"nv":a({"preset":"h264"},"h264_nvenc"),
 "qsv10":a({"preset":"h265_10"},"hevc_qsv"),"amf":a({"preset":"h265","quality":"small"},"hevc_amf"),"aomargs":a({"preset":"av1"},"libaom-av1"),
 "none":none,"yes":yes,"q":q,"aom":aom,"hw":{k:list(v) for k,v in D.HW.items()}}))`));
check("deliver.py AV1: SVT-AV1, crf + preset 8, AAC, the timecode", /-c:v libsvtav1 -crf \d+ -preset 8 -pix_fmt yuv420p/.test(R.av1) && /-c:a aac -b:a 128k/.test(R.av1) && /-timecode 01:00:00:00/.test(R.av1), R.av1);
check("...no SVT-AV1 in this ffmpeg -> libaom-av1 (crf, -b:v 0)", R.aom[0] === "libaom-av1" && R.aom[1] === null && /-c:v libaom-av1 -crf \d+ -b:v 0/.test(R.aomargs), [R.aom, R.aomargs]);
check("deliver.py H.265 10-bit: libx265 yuv420p10le, hvc1, AAC 320k (high), the timecode", /-c:v libx265 .*-pix_fmt yuv420p10le -tag:v hvc1/.test(R.h10) && /-b:a 320k/.test(R.h10) && /-timecode/.test(R.h10), R.h10);
check("pick_encoder: asked, none works -> software (libx265, hw None); not asked -> software", JSON.stringify(R.none) === '[["libx265",null],null,["libx264",null]]', R.none);
check("...asked and one works -> the card's (h264_nvenc; hevc_qsv for 10-bit when NVENC fails)", JSON.stringify(R.yes) === '["h264_nvenc","h264_nvenc"]' && JSON.stringify(R.q) === '["hevc_qsv","hevc_qsv"]', [R.yes, R.q]);
check("the card's args: NVENC -rc vbr -cq, Quick Sync -global_quality + p010le for 10-bit, AMF -rc cqp; H.265 hvc1",
  /-c:v h264_nvenc -rc vbr -cq 24 -pix_fmt yuv420p/.test(R.nv) && /-c:v hevc_qsv -global_quality 24 -pix_fmt p010le -tag:v hvc1/.test(R.qsv10) && /-c:v hevc_amf -rc cqp -qp_i 30 -qp_p 30 .*hvc1/.test(R.amf), [R.nv, R.qsv10, R.amf]);
check("HW: NVENC / Quick Sync / AMF for H.264, H.265, AV1 (2.412.0: + VAAPI last, with its own upload chain)",
  R.hw.h264.slice(0, 3).join() === "h264_nvenc,h264_qsv,h264_amf" && R.hw.av1.includes("av1_nvenc"), R.hw);
const DP = read("scripts", "deliver.py");
check("deliver.py: the log names the card's encoder, or says none works and uses software", /the graphics card's \{hw\}/.test(DP) && /no graphics-card encoder works here - \{enc\} \(software\)/.test(DP));
check("routes/index.js passes deliver_hw (only true counts); the 📤 dialog has ⚡ the graphics card's encoder (#tdlHw)",
  /deliver_hw: t\.deliverHw === true/.test(read("routes", "index.js")) && /tdlHw/.test(read("ext", "timelinedock", "deliver.js")) && /deliverHw/.test(read("ext", "timelinedock", "timelinedock.js")));

/* ---- 5. wiring: text effect presets */
const IDX = read("routes", "index.js");
check("routes/textfx.js mounted from routes/index.js; server.js untouched", /require\("\.\/textfx"\)\.mount\(app\)/.test(IDX) && !/textfx|deliver_hw|shuttle/.test(read("server.js")));
check("static/index.html loads /static/textfx.js; the timeline ext lists textfx.js before tlfloat.js",
  /<script src="\/static\/textfx\.js"><\/script>/.test(read("static", "index.html")) && (() => { const e = JSON.parse(read("ext", "timelinedock", "ext.json")); const f = e.scripts || e.files || e.js || []; return f.indexOf("textfx.js") >= 0 && f.indexOf("textfx.js") < f.indexOf("tlfloat.js"); })());
check("the two built-in presets ship (textfx/*.json, ids psd:...)", ["arena-gold-3d", "trend-candy-3d"].every((s) => { try { return JSON.parse(read("textfx", s + ".json")).id === "psd:" + s; } catch { return false; } }));
const SC = JSON.parse(read("docs", "shortcuts.json"));
check("docs/shortcuts.json: J / K / L + K + J / K + L in the timeline group; L's LLM row says the timeline's is the shuttle",
  SC.groups.some((g) => /Timeline layers/.test(g.title) && g.rows.some((r) => r[0] === "J / K / L") && g.rows.some((r) => r[0] === "K + J / K + L"))
  && SC.groups[0].rows.some((r) => r[0] === "L" && /shuttle/.test(r[1])));
check("package.json is 2.411.0 or later", JSON.parse(read("package.json")).version.localeCompare("2.411.0", undefined, { numeric: true }) >= 0);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

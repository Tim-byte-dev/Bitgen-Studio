#!/usr/bin/env node
/* bitGen Studio — 2.393.0: Basic Settings (S) and LLM tokens (L) in floating dockers (static/secfloat.js's pure parts,
 * docker_status.json floats in lib/dockerStatus.js) and the image editor's bitGen look (ext/imageeditdock).
 * Run: node scripts/test-secfloat.js
 * Tim: "put basic settings dropdown in a floating docker - press s when not typing etc / put llm dropdown in a floating
 * docker - press l when not typing / when image editor use the bitgen titlebar and statusbar so it still looks like
 * part of bitgen". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const F = require(path.join(ROOT, "static", "secfloat.js"));
const DS = require(path.join(ROOT, "lib", "dockerStatus"));

const k = (key, o) => Object.assign({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false }, o || {});
check("S / L: the specs (LLM tokens = L, Basic Settings = S)", F.SPECS.map((s) => s.id + "=" + s.key).join() === "llmtok=l,basic=s");
check("wants: s and S toggle (no modifier), nothing else does", F.wants(k("s"), "s") && F.wants(k("S"), "s") && !F.wants(k("l"), "s") && F.wants(k("l"), "l") && !F.wants(k("x"), "s"));
check("...not with Ctrl / Alt / Shift / Meta, not a held-down repeat", ["ctrlKey", "altKey", "shiftKey", "metaKey", "repeat"].every((m) => !F.wants(k("s", { [m]: true }), "s")));
check("...not while typing in a box (text input, textarea, select, contenteditable) - a slider / checkbox focused is not typing",
  !F.wants(k("s"), "s", { tagName: "INPUT", type: "text" }) && !F.wants(k("s"), "s", { tagName: "TEXTAREA" }) && !F.wants(k("l"), "l", { tagName: "SELECT" })
  && !F.wants(k("s"), "s", { tagName: "DIV", isContentEditable: true }) && F.wants(k("s"), "s", { tagName: "INPUT", type: "range" }) && F.wants(k("l"), "l", { tagName: "INPUT", type: "checkbox" }));
check("...not with a dialog open, not over the image editor / the timeline canvas (S and L are their tools there)",
  !F.wants(k("s"), "s", null, true) && !F.wants(k("s"), "s", null, false, true) && F.OWNERS === "#imageeditdock, #tlCanvasWrap");
const p1 = F.firstPlace(F.SPECS[0], 1600, 950, 300), p2 = F.firstPlace(F.SPECS[1], 1600, 950, 300);
check("first place: beside the left docker, the two side by side (no overlap)", p1.x === 312 && p1.y === 90 && p2.x === 624 && p2.x >= p1.x + p1.w && p2.h <= 640, [p1, p2]);
check("...a small window: they still fit", F.firstPlace(F.SPECS[1], 700, 500, 300).x + F.firstPlace(F.SPECS[1], 700, 500, 300).w <= 700 && F.firstPlace(F.SPECS[1], 700, 500, 300).h <= 360);
check("onScreen: the titlebar stays reachable", JSON.stringify(F.onScreen(5000, -50, 300, 1600, 900)) === '{"x":1520,"y":0}');
const sn = F.snap({ x: 306, y: 95, w: 300, h: 200 }, [{ l: 0, t: 40, r: 300, b: 900 }], 10);
check("snap: the left edge sticks to the docker's right edge (10 px)", sn.x === 300 && sn.y === 95, sn);

// docker_status.json
const base = fs.mkdtempSync(path.join(os.tmpdir(), "secfloat393_"));
try {
  const d0 = DS.load(base);
  const F0 = '{"shown":false,"x":-1,"y":-1,"w":0,"h":0,"mode":"float","to":"","side":"","dw":0,"dh":0,"active":false,"at":""}';   // 2.401.4: + at (inline in the left docker)
  check("docker_status.json: floats.basic / floats.llmtok (+ 2.399.0 floats.camera, the timeline's 🎥 Camera panel; 2.419.0 floats.negprompt, the ⊖ negative prompt), hidden and unplaced at first",
    JSON.stringify(d0.floats) === `{"basic":${F0},"llmtok":${F0},"camera":${F0},"negprompt":${F0}}`, d0.floats);   // 2.398.0: + where it is docked
  const r1 = DS.save(base, { floats: { basic: { shown: true, x: 400, y: 120, w: 360, h: 99999 }, junk: { shown: true } } });
  check("save: merged and clamped, unknown floats dropped, the dockers untouched", r1.floats.basic.shown && r1.floats.basic.x === 400 && r1.floats.basic.h === 4000 && !r1.floats.junk && Object.keys(r1.docks).length === 16, r1.floats);
  const r2 = DS.save(base, { floats: { llmtok: { shown: true } } });
  check("...one float at a time (the other kept)", r2.floats.basic.x === 400 && r2.floats.llmtok.shown === true && JSON.parse(fs.readFileSync(path.join(base, "docker_status.json"), "utf8")).floats.llmtok.shown === true);
  check("inject: the page head carries the floats", /"floats":\{"basic":\{"shown":true/.test(DS.inject("<head></head>", r2)));
} finally { fs.rmSync(base, { recursive: true, force: true }); }

// the wiring
const I = read("static", "index.html"), SF = read("static", "secfloat.js"), IE = read("ext", "imageeditdock", "imageedit.js"), UI = read("ext", "imageeditdock", "pcui.js");
check("the page loads static/secfloat.js (after dockcfg.js; 2.398.0 dockfloat.js just before it); nothing in server.js", /dockcfg\.js"><\/script>\n<!--[^\n]*-->\n<script src="\/static\/dockfloat\.js"><\/script>[^\n]*\n<script src="\/static\/secfloat\.js"><\/script>/.test(I) && !/secfloat/.test(read("server.js")));
check("the sections move whole (their ids kept): #sec-basic and #sec-llmtok into the windows, a launcher row in the left docker", /\$\("sec-" \+ spec\.id\)/.test(SF) && /body\.appendChild\(body0\)/.test(SF) && /sfLaunch/.test(SF) && /\/api\/docker-status/.test(SF));
check("the editor: a bitGen theme (the app's colours - 2.432.0: the app's variables, so it follows Settings ▸ Themes), the default and moved to once; Window ▸ Theme lists it first",
  /\.kx\[data-theme=bitgen\]\{--pc-bg:var\(--th-ink,#14120f\);--pc-panel:var\(--th-panel,#1d1a15\);--pc-panel2:var\(--th-panel-2,#26221b\);[^}]*--pc-accent:var\(--th-tiger,#f59e2c\)/.test(IE) && /data-theme="\$\{store\.get\("theme", "bitgen"\)\}"/.test(IE)
  && /themeV", 0\) < 393/.test(IE) && /\[\["bitgen", "bitGen \(dark\)"\], \["pro"/.test(UI) && /sub\("Theme", \["theme\.bitgen"/.test(UI));
check("...its menu bar is the app's menu bar's height and look, its status line the app's status bar's",
  /\.kx\[data-theme=bitgen\] \.pcmenu\{height:var\(--mbar,36px\)/.test(IE) && /\.kx\[data-theme=bitgen\] \.kxstatus\{height:var\(--sbar,30px\)/.test(IE));
check("...full screen keeps bitGen's title bar, menu bar and status bar (body.ie-full, the whole page in full screen), its status line in bitGen's status bar",
  /body\.ie-full #imageeditdock:not\(\.dockgone\)\{position:fixed!important;left:0;right:0;top:var\(--mbar,36px\);bottom:var\(--sbar,30px\)/.test(IE)
  && /body\.shell\.ie-full #imageeditdock\{top:calc\(32px \+ var\(--mbar,36px\)\)\}/.test(IE) && /de\.requestFullscreen\(\)/.test(IE) && !/kx\.requestFullscreen/.test(IE) && /m\.id = "sbIe"/.test(IE));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

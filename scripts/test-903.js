// bitGen Studio 2.903.0 - the preview's ⏴ ⏵ one frame + 📷 Capture frame (Tim: "when viewing a video add a button to advance
// 1 frame and go back 1 frame. and a button to capture the frame"): lib/videoFrame.js (pure parts + the address check),
// static/lbframe.js frameOf / timeOf, the wiring. The real ffmpeg / browser run: scripts/test-ui903-ui.js.
// Run: node scripts/test-903.js
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
let ok = 0, fail = 0;
const check = (n, c, x) => { if (c) { ok++; console.log("ok   ", n); } else { fail++; console.log("FAIL ", n, x === undefined ? "" : JSON.stringify(x)); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t903-"));
const dirs = { output: path.join(tmp, "output"), video: path.join(tmp, "video"), images: path.join(tmp, "images"), sound: path.join(tmp, "sound") };
Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }));
fs.writeFileSync(path.join(dirs.video, "clip one.mp4"), "x"); fs.writeFileSync(path.join(dirs.output, "take.mp4"), "x");
const core = { pDir: (k) => dirs[k], projDir: () => tmp, getProject: () => "p" };
require.cache[require.resolve("../lib/core")] = { id: "core", filename: require.resolve("../lib/core"), loaded: true, exports: core };
const V = require("../lib/videoFrame");

check("rate: 24, 30000/1001, 25/1, nonsense", V.rate("24/1") === 24 && V.rate("30000/1001") === 29.97 && V.rate("25") === 25 && V.rate("0/0") === 0 && V.rate("x") === 0);
check("frameAt: the frame shown at t (its middle, its start, past the end)", V.frameAt(2.5 / 24, 24, 48) === 2 && V.frameAt(2 / 24, 24, 48) === 2 && V.frameAt(99, 24, 48) === 47 && V.frameAt(-1, 24, 48) === 0);
check("nameFor: <video>_frame<n>.png, tidy", V.nameFor("/a/clip one (2).mp4", 7) === "clip_one_2_frame7.png" && V.nameFor("x.webm", 0) === "x_frame0.png");
check("fileOf: /passets/video/<name> (spaces encoded)", V.fileOf("/passets/video/clip%20one.mp4") === path.join(dirs.video, "clip one.mp4"));
check("fileOf: /outputs/<name> (a full address too)", V.fileOf("http://studio.example:8311/outputs/take.mp4?t=1") === path.join(dirs.output, "take.mp4"));
check("fileOf: refuses anything else - other folders, .., a missing file", [ "/etc/passwd", "/passets/video/..%2F..%2Fetc%2Fpasswd", "/passets/other/x.mp4", "/outputs/nope.mp4", "/static/icon.png", "" ].every((u) => V.fileOf(u) === null));
let e = null; try { V.capture("/etc/passwd", { frame: 0 }); } catch (x) { e = x; }
check("capture outside the project: 404, nothing run", e && e.status === 404 && /not in this project/.test(e.message), e && e.message);
const R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const vf = R("lib/videoFrame.js");
check("capture seeks half a frame BEFORE frame n (ffmpeg's -ss = the first frame starting at or after the time)", /n === 0 \? 0 : Math\.max\(0, \(n - 0\.5\) \/ p\.fps\)/.test(vf));
check("saved like the image editor's Save to Images (Assets + Gallery)", /require\("\.\/imageSave"\)\.finish\(buf, \{ name: nameFor\(file, n\), ext: "png" \}\)/.test(vf));

// the page's maths
global.window = { document: { readyState: "loading", addEventListener() {}, getElementById: () => null } };
new Function("window", R("static/lbframe.js"))(global.window);
const F = global.window.H3LbFrame;
check("page: frameOf / timeOf agree (the middle of frame f shows frame f)", [0, 1, 2, 23, 47].every((f) => F.frameOf(F.timeOf(f, 24, 2), 24, 48) === f) && F.frameOf(F.timeOf(5, 29.97, 10), 29.97, 300) === 5);
check("page: timeOf keeps inside the video", F.timeOf(999, 24, 2) <= 2 && F.timeOf(-3, 24, 2) === 0.5 / 24);
const ix = R("routes/index.js"), html = R("static/index.html");
check("the route is mounted (not in server.js)", /require\("\.\/videoFrame"\)\.mount\(app\)/.test(ix) && !/videoFrame/.test(R("misc/server.js")));
check("the page loads static/lbframe.js", /<script src="\/static\/lbframe\.js"><\/script>/.test(html));
check("the , and . keys are in the shortcut list", R("docs/shortcuts.json").includes("One frame back / one frame on"));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

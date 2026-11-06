// bitGen Studio — 2.700.0: the 10 s intro (Tim's logo: two tigers + a tree = a butterfly). node misc/intro/render.js -> docs/images/bitgen-studio-intro.mp4; node misc/intro/render.js 2.2,5.9 = those frames as misc/intro/f_<t>.jpg (look before a full render). Needs Playwright + ffmpeg.
const { chromium } = require("playwright"); const fs = require("fs"); const { spawn } = require("child_process");
const only = process.argv[2] ? process.argv[2].split(",").map(Number) : null, FPS = 30, N = 300;
(async () => { const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto("file://" + __dirname + "/intro.html"); await p.evaluate((s) => boot(s), fs.readFileSync(__dirname + "/../../static/logo.svg", "utf8")); await p.evaluate(() => document.fonts.ready);
  if (only) { for (const t of only) { await p.evaluate((t) => draw(t), t); await p.screenshot({ path: __dirname + `/f_${t}.jpg`, type: "jpeg", quality: 92 }); } await b.close(); return; }
  const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", __dirname + "/intro_tmp.mp4"], { stdio: ["pipe", "ignore", "inherit"] });
  for (let i = 0; i < N; i++) { await p.evaluate((t) => draw(t), i / FPS); const buf = await p.screenshot({ type: "jpeg", quality: 92 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r)); }
  ff.stdin.end(); const code = await new Promise((r) => ff.on("close", r)); await b.close();
  if (code === 0) fs.renameSync(__dirname + "/intro_tmp.mp4", "bitgen-studio-intro.mp4"); console.log("ffmpeg", code); })();

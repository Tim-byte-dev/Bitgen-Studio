// bitGen Studio — 2.700.0: the 10 s intro (Tim's logo: two tigers + a tree = a butterfly); 2.701.0: --splash = the 15 s splash with
// the credits (docs/images/bitgen-studio-splash.mp4). 2.752.0: the app's splash is the brain film (static/splash-neural.webm),
// so no static/splash.webm any more.
//   node misc/intro/render.js               -> docs/images/bitgen-studio-intro.mp4
//   node misc/intro/render.js --splash      -> docs/images/bitgen-studio-splash.mp4
//   node misc/intro/render.js [--splash] 2.2,5.9   -> those moments as misc/intro/f_<t>.jpg (look before a full render)
// Needs Playwright (its Chromium) + ffmpeg (libx264).
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path"); const { spawn } = require("child_process");
const SPL = process.argv.includes("--splash"), args = process.argv.slice(2).filter((a) => a !== "--splash");
const only = args[0] ? args[0].split(",").map(Number) : null, FPS = 30, N = SPL ? 450 : 300;
const HERE = __dirname, ROOT = path.join(HERE, "..", "..");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto("file://" + path.join(HERE, "intro.html") + (SPL ? "#splash" : ""));
  await p.evaluate((s) => boot(s), fs.readFileSync(path.join(ROOT, "static", "logo.svg"), "utf8")); await p.evaluate(() => document.fonts.ready);
  if (only) { for (const t of only) { await p.evaluate((t) => draw(t), t); await p.screenshot({ path: path.join(HERE, `f_${t}.jpg`), type: "jpeg", quality: 92 }); } await b.close(); return; }
  const tmp = path.join(HERE, "render_tmp.mp4");
  const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmp], { stdio: ["pipe", "ignore", "inherit"] });
  for (let i = 0; i < N; i++) { await p.evaluate((t) => draw(t), i / FPS); const buf = await p.screenshot({ type: "jpeg", quality: 92 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r)); }
  ff.stdin.end(); const code = await new Promise((r) => ff.on("close", r)); await b.close();
  if (code !== 0) { console.log("ffmpeg failed", code); process.exit(1); }
  const out = path.join(ROOT, "docs", "images", "bitgen-studio-" + (SPL ? "splash" : "intro") + ".mp4"); fs.renameSync(tmp, out); console.log("->", out);
})();

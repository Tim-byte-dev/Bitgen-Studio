/* bitGen Studio — lib/jxl.js (2.479.0): JPEG XL on the server.
 *
 * Tim (verbatim): "add jxl file support".
 *
 * The same codecs as the page (static/jxl.js over static/vendor/jxl/, run in Node):
 *   toPng(buffer)            -> {png: Buffer, width, height, animated}
 *   encode({data, width, height}, opts) -> Buffer (.jxl)
 *   pngFile(path)            -> a PNG of a .jxl file, kept in the cache (os temp / bitgen-jxl, keyed by the path, its size
 *                               and time) - for ffmpeg, ComfyUI uploads and thumbnails (scripts/jxl-cli.js topng uses it)
 *   wantsPng(req)            an <img> (Sec-Fetch-Dest: image, or an Accept that starts with image/ and has no image/jxl)
 *                               or ?as=png - and not ?jxl=raw
 *   sendFileShim             express middleware: res.sendFile of a .jxl answers a PNG when wantsPng(req) - so every
 *                               route that sends a picture (project files, outputs, thumbnails, the file dialog) shows
 *                               .jxl in the browser, which cannot read it; fetch() / downloads get the .jxl itself
 *   isJxl, isJxlName         (static/jxl.js)
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const J = require("../static/jxl.js");
J.setBase(path.join(__dirname, "..", "static", "vendor", "jxl"));

let cacheDir = path.join(os.tmpdir(), "bitgen-jxl");
function setCacheDir(d) { cacheDir = d; }

const toPng = async (buf) => { const r = await J.toPng(new Uint8Array(buf)); return Object.assign(r, { png: Buffer.from(r.png) }); };
const encode = async (img, opts) => Buffer.from(await J.encode(img, opts));

const inflight = new Map();
/** a cached PNG beside nothing of yours: os temp/bitgen-jxl/<sha1>.png */
async function pngFile(p) {
  const st = fs.statSync(p);
  const key = crypto.createHash("sha1").update(path.resolve(p) + "|" + st.size + "|" + st.mtimeMs).digest("hex").slice(0, 24);
  const out = path.join(cacheDir, key + ".png");
  if (fs.existsSync(out)) return out;
  if (inflight.has(out)) return inflight.get(out);
  const pr = (async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const r = await toPng(fs.readFileSync(p));
    const tmp = out + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, r.png); fs.renameSync(tmp, out);
    return out;
  })().finally(() => inflight.delete(out));
  inflight.set(out, pr);
  return pr;
}

function wantsPng(req) {
  const q = (req && req.query) || {};
  if (q.jxl === "raw") return false;
  if (q.as === "png") return true;
  const h = (req && req.headers) || {};
  const accept = String(h.accept || "");
  if (/image\/jxl/i.test(accept)) return false;            // a browser that reads JPEG XL itself
  const dest = String(h["sec-fetch-dest"] || "");
  if (dest) return dest === "image";
  return /^image\//i.test(accept);
}

/** express middleware: a .jxl sent to an <img> is sent as a PNG */
function sendFileShim(req, res, next) {
  const orig = res.sendFile;
  res.sendFile = function (p, ...rest) {
    if (typeof p === "string" && J.isJxlName(p) && wantsPng(req)) {
      let opts = rest[0], cb = rest[1];
      if (typeof opts === "function") { cb = opts; opts = undefined; }
      let file = p;
      if (opts && opts.root && !path.isAbsolute(p)) file = path.join(opts.root, p);
      pngFile(file).then((png) => {
        res.type("image/png"); res.set("Cache-Control", "no-store");
        orig.call(res, png, Object.assign({}, opts || {}, { root: undefined, dotfiles: "allow" }), cb);
      }, (e) => {
        if (cb) return cb(e);
        if (!res.headersSent) res.status(415).json({ error: "this JPEG XL file could not be read: " + (e && e.message) });
      });
      return;
    }
    return orig.call(this, p, ...rest);
  };
  next();
}

module.exports = { toPng, encode, pngFile, wantsPng, sendFileShim, setCacheDir, isJxl: J.isJxl, isJxlName: J.isJxlName, cacheDir: () => cacheDir };

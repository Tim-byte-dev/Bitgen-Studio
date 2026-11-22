/* bitGen app — www/lib/core.js: the parts with no screen in them (window.BG and Node's require, for scripts/test-app.js).
 *   parseLink(text)        the pairing QR / link "http://192.168.1.20:8311/remote?t=CODE" -> {base, code} | null
 *   sizeFor(res, aspect)   bitGen Studio's Basic Settings size (static/index.html updateWH: the short side = res, 16-px steps)
 *   imgSizeFor(edge, ar)   the image size the same way as the studio (the LONG edge)
 *   jobsOf(d)              /api/jobs answers a list or {jobs} -> the list
 *   outName(job)           a job's file name in the Gallery (/outputs/<name>)
 *   media(base, name, key) the address of a picture / video with the key (an <img> / <video> cannot send a header)
 *   kindOf(name)           "video" | "image" | "audio" | ""
 *   statusWords(job)       a job's line for the queue */
(function (root) {
  "use strict";
  function parseLink(text) {
    var t = String(text || "").trim();
    var m = /^(https?:\/\/[^\/\s?#]+)(?:\/[^\s?#]*)?\?(?:[^\s#]*&)?t=([A-Za-z0-9_\-%]+)/.exec(t);
    if (!m) return null;
    var code = decodeURIComponent(m[2]);
    return code.length >= 8 ? { base: m[1].replace(/\/+$/, ""), code: code } : null;
  }
  var a16 = function (v) { return Math.max(128, Math.round(v / 16) * 16); };
  function sizeFor(res, aspect) {
    var p = parseInt(res, 10) || 540, ar = String(aspect || "16:9").split(":").map(Number);
    var aw = ar[0] > 0 ? ar[0] : 16, ah = ar[1] > 0 ? ar[1] : 9, w, h;
    if (aw >= ah) { h = a16(p); w = a16(h * aw / ah); } else { w = a16(p); h = a16(w * ah / aw); }
    return { width: w, height: h };
  }
  function imgSizeFor(edge, aspect) {
    var e = parseInt(edge, 10); if (!(e > 0)) return null;
    var ar = String(aspect || "1:1").split(":").map(Number), aw = ar[0] > 0 ? ar[0] : 1, ah = ar[1] > 0 ? ar[1] : 1;
    return aw >= ah ? { width: a16(e), height: a16(e * ah / aw) } : { width: a16(e * aw / ah), height: a16(e) };
  }
  function jobsOf(d) { return Array.isArray(d) ? d : (d && Array.isArray(d.jobs) ? d.jobs : []); }
  function outName(job) {
    var o = job && (job.output || (job.outputs && job.outputs[0])) || "";
    return String(o).split(/[\\\/]/).pop();
  }
  function media(base, name, key) { return String(base || "") + "/outputs/" + encodeURIComponent(name) + "?bgk=" + encodeURIComponent(key || ""); }
  function kindOf(name) {
    var n = String(name || "").toLowerCase();
    return /\.(mp4|webm|mov|mkv|avi)$/.test(n) ? "video" : /\.(png|jpe?g|webp|bmp|gif|avif)$/.test(n) ? "image" : /\.(mp3|wav|flac|ogg|m4a|opus)$/.test(n) ? "audio" : "";
  }
  function statusWords(job) {
    var j = job || {}, p = j.params || {}, pr = j.progress || {};
    var what = p.video_style_name || p.style_name || p.mode || "render";
    var st = j.status || "?";
    var pct = pr && pr.pct != null ? " " + Math.round(pr.pct) + "%" : (pr && pr.step && pr.total ? " step " + pr.step + "/" + pr.total : "");
    return { what: String(what), status: st, more: st === "running" ? pct : "" };
  }
  var API = { parseLink: parseLink, sizeFor: sizeFor, imgSizeFor: imgSizeFor, jobsOf: jobsOf, outName: outName, media: media, kindOf: kindOf, statusWords: statusWords };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.BG = API;
})(typeof window !== "undefined" ? window : globalThis);

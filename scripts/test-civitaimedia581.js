#!/usr/bin/env node
/* bitGen Studio — scripts/test-civitaimedia581.js (2.581.0): 🔄 Sync / ⤓ Civitai info keep a model's VIDEOS and ANIMATED
 * pictures too, and its thumbnail moves (lib/modelInfo.js, lib/modelCards.thumbKind, lib/modelMedia setThumb).
 * Tim: "when syncing models with civitai dl it's animated thumbs and videos for the models too".
 * A fake Civitai (cv.api + setupExec.open stood in) - no network. */
"use strict";
const fs = require("fs");
const path = require("path");
const { PassThrough } = require("stream");
const MI = require("../lib/modelInfo");
const MC = require("../lib/modelCards");
const MM = require("../lib/modelMedia");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  /* pure */
  check("mediaOf: type video / an .mp4 address -> video; a still or a GIF -> image; anything else -> skipped",
    MI.mediaOf({ type: "video", url: "x.jpeg" }) === "video" && MI.mediaOf({ url: "https://i/a/1.mp4" }) === "video" && MI.mediaOf({ type: "image", url: "a.gif" }) === "image" && MI.mediaOf({ url: "a.png" }) === "image" && MI.mediaOf({ type: "audio", url: "a" }) === "");
  check("extFor: by what the CDN answered (the address lies for a transcoded video), else the address, else by kind",
    MI.extFor("video/mp4", "x.jpeg") === ".mp4" && MI.extFor("video/webm") === ".webm" && MI.extFor("image/gif") === ".gif" && MI.extFor("image/webp") === ".webp" && MI.extFor("image/png") === ".png"
    && MI.extFor("", "https://a/b/2.webm?x=1") === ".webm" && MI.extFor("", "https://a/b", "video") === ".mp4" && MI.extFor("application/octet-stream", "z.jpg") === ".jpeg");
  check("kindOfFile + modelCards.thumbKind: mp4 / webm = video; gif = animated (still an <img> / background)",
    MI.kindOfFile("ex1.mp4") === "video" && MI.kindOfFile("ex2.gif") === "animated" && MI.kindOfFile("ex3.png") === "image" && MC.thumbKind("thumb.webm") === "video" && MC.thumbKind("thumb.gif") === "image" && MC.thumbKind("") === "image");
  const ex = MI.examplesOf([{ url: "https://image.civitai.com/a/width=450/1.mp4", type: "video", nsfwLevel: 1 }, { url: "https://image.civitai.com/b/width=450/2.gif", type: "image", nsfwLevel: 1 },
    { url: "https://image.civitai.com/c/width=450/3.mp4", type: "video", nsfwLevel: 16 }, { url: "https://image.civitai.com/d/width=450/4.jpeg", type: "image", nsfwLevel: 1 }], false, 8);
  check("examplesOf: the videos and the GIF kept in Civitai's order, a mature video left out (Settings ▸ Civitai ▸ mature off)",
    ex.map((e) => e.media).join() === "video,image,image" && /1\.mp4$/.test(ex[0].url) && /4\.jpeg$/.test(ex[2].url), ex);
  const now = Date.now(), card = { civitai: null };
  check("wants (🔄 Sync): details kept before videos were (no media_v) are fetched again by their version id; up-to-date ones and a plain ⤓ are not",
    MI.wants(card, { status: "found", civitai: { id: 5 } }, { sync: true }, now) && !MI.wants(card, { status: "found", media_v: MI.MEDIA_V, civitai: { id: 5 } }, { sync: true }, now)
    && !MI.wants(card, { status: "found", civitai: { id: 5 } }, {}, now) && MI.wants(card, null, {}, now) && MI.wants(card, { status: "found", media_v: 9 }, { force: true }, now)
    && !MI.wants(card, { status: "found" }, { sync: true }, now));

  /* fetchOne against a fake Civitai: a video first, a GIF, a still */
  const cv = require("../lib/civitai.js"), sx = require("../lib/setupExec.js");
  const realApi = cv.api, realOpen = sx.open, realCfg = cv.cfg;
  const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42"), Buffer.alloc(40, 1)]);
  const GIF = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "latin1");
  const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a730000001649444154789c63f8cfc0f09f818181e1ff7f0606000037f005fd8a5a6fb10000000049454e44ae426082", "hex");
  const calls = [], opened = [];
  cv.cfg = () => ({ token: "", site: "civitai.com", mature: false });
  const VER = { id: 5810, modelId: 581, name: "v1", baseModel: "Wan Video 14B t2v", trainedWords: ["e2e581"], publishedAt: "2026-09-01T00:00:00Z", stats: {},
    model: { name: "E2E Motion LoRA", type: "LORA" },
    files: [{ name: "e2e581_motion.safetensors", sizeKB: 1 }],
    images: [{ url: "https://image.civitai.com/x/abc/width=720/11.mp4", type: "video", nsfwLevel: 1, width: 720, height: 1280, meta: { prompt: "a dancing robot" } },
             { url: "https://image.civitai.com/x/abc/width=720/12.gif", type: "image", nsfwLevel: 1 },
             { url: "https://image.civitai.com/x/abc/width=720/13.jpeg", type: "image", nsfwLevel: 1 },
             { url: "https://image.civitai.com/x/abc/width=720/14.mp4", type: "video", nsfwLevel: 1 }] };
  cv.api = async (p, q) => {
    calls.push([p, q]);
    if (p === "/models") return { items: [{ id: 581, name: "E2E Motion LoRA", type: "LORA", modelVersions: [VER] }] };
    if (p === "/model-versions/5810") return VER;
    if (p === "/models/581") return { id: 581, name: "E2E Motion LoRA", type: "LORA", description: "moves", stats: {} };
    const e = new Error("404"); e.status = 404; throw e;
  };
  sx.open = async (u) => {
    opened.push(u);
    const r = new PassThrough();
    // the 14.mp4 answers bigger than an example may be: not kept
    if (/14\.mp4/.test(u)) { setImmediate(() => r.end(Buffer.alloc(16))); return { status: 200, headers: { "content-type": "video/mp4", "content-length": String(200 * 1024 * 1024) }, res: r }; }
    const [ct, buf] = /\.mp4/.test(u) ? ["video/mp4", MP4] : /\.gif/.test(u) ? ["image/gif", GIF] : ["image/png", PNG];
    setImmediate(() => r.end(buf));
    return { status: 200, headers: { "content-type": ct }, res: r };
  };
  const c = { key: "loras|e2e581_motion.safetensors", kind: "lora", cat: "loras", name: "e2e581_motion.safetensors", file: "e2e581_motion.safetensors", size: 1024 };
  const dir = MI.dirFor(c);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    const r = await MI.fetchOne(c);
    const info = MI.readInfo(c);
    check("⤓ a LoRA whose first example is a video: found, the video kept as ex1.mp4, the GIF as ex2.gif, the still as ex3.png",
      r === "found" && info.examples.map((e) => e.file).join() === "ex1.mp4,ex2.gif,ex3.png" && fs.readFileSync(path.join(dir, "ex1.mp4")).equals(MP4) && fs.readFileSync(path.join(dir, "ex2.gif")).equals(GIF), info && info.examples);
    check("...each example says what it is (video / animated / image) - and the details page passes it on",
      info.examples.map((e) => e.media).join() === "video,animated,image" && info.examples[0].meta.prompt === "a dancing robot");
    check("...the thumbnail is the first example AS IT IS: thumb.mp4 (it moves on the card)", info.thumb === "thumb.mp4" && fs.existsSync(path.join(dir, "thumb.mp4")) && MI.thumbPath(c) === path.join(dir, "thumb.mp4"), info.thumb);
    check("...asked for at 512 px (Civitai's CDN scales / transcodes); a clip over 60 MB is not kept", opened.every((u) => /\/width=512\//.test(u)) && opened.some((u) => /14\.mp4/.test(u)) && !fs.existsSync(path.join(dir, "ex4.mp4")), opened);
    check("...media_v written (🔄 Sync leaves it alone next time)", info.media_v === MI.MEDIA_V && !MI.wants(c, info, { sync: true }, Date.now()));

    // a library entry from before 2.581.0: stills only, no media_v -> 🔄 Sync asks by its version id, the old stills go
    fs.writeFileSync(path.join(dir, "ex5.jpeg"), "old");
    const old = Object.assign({}, info); delete old.media_v; old.thumb = "thumb.jpeg"; fs.writeFileSync(path.join(dir, "thumb.jpeg"), "old");
    old.examples = [{ file: "ex5.jpeg", url: "u", meta: {} }]; fs.writeFileSync(path.join(dir, "info.json"), JSON.stringify(old));
    check("an entry kept before 2.581.0 is one 🔄 Sync wants again", MI.wants(c, MI.readInfo(c), { sync: true }, Date.now()));
    calls.length = 0;
    const r2 = await MI.fetchOne(c);
    const i2 = MI.readInfo(c);
    check("...asked by its version id first (no name search), the videos kept, the old thumb.jpeg + the example no longer there gone",
      r2 === "found" && calls[0][0] === "/model-versions/5810" && !calls.some((x) => x[0] === "/models") && i2.thumb === "thumb.mp4" && !fs.existsSync(path.join(dir, "thumb.jpeg")) && !fs.existsSync(path.join(dir, "ex5.jpeg")) && i2.media_v === MI.MEDIA_V, { calls, i2 });

    /* your own video as the thumbnail (2.575.0's media - pictures only before) */
    const set = MM.setThumb(c, { path: path.join(dir, "ex1.mp4"), name: "ex1.mp4" });
    check("✎ / Ctrl+↓: a video can be the card's thumbnail too (was: pictures only)", set.ok && /\.mp4$/.test(set.thumb || MM.thumbPath(c) || ""), set);
    check("...a sound still cannot", !!MM.setThumb(c, { buf: Buffer.from("x"), name: "a.wav" }).error);
  } finally {
    cv.api = realApi; sx.open = realOpen; cv.cfg = realCfg;
    fs.rmSync(dir, { recursive: true, force: true });
  }

  /* the page (source) */
  const mm = fs.readFileSync(path.join(__dirname, "..", "static", "modelmgr.js"), "utf8");
  check("the Model manager draws a video thumbnail / example as a looping muted <video> (cards, the ⓘ hero, the examples, the editor) and opens it in the viewer as a video",
    /function vidFill/.test(mm) && /c\.thumb_kind === "video" \? vidFill\(t\)/.test(mm) && /x\.media === "video" \? vidFill\(exu\)/.test(mm) && /kind: e\.media === "video" \? "video" : "image"/.test(mm) && /muted loop autoplay playsinline/.test(mm));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();

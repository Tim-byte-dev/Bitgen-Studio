#!/usr/bin/env node
/* bitGen Studio — 2.417.0 units: the bigger Premiere rows (part two)
 *   1. HDR: scripts/hdr.py puts the master's white at 203 nits (PQ code 0.58, HLG 0.75), wide-gamut Rec.2020 SDR; an
 *      HDR10 / HLG file comes back to the SDR it was made from (tone-mapped: the mid-tones where they were); the HDR10
 *      metadata (x265 / SVT-AV1); scripts/deliver.py's arguments for a coloured deliverable; lib/deliver.js's names
 *   2. AAF: scripts/aaf_export.py writes the timeline (picture + mono sound tracks, fillers, the source in-points in the
 *      timeline's frames, the timecode) - read back with pyaaf2; lib/aaf.js's job (frames, stills left out)
 *   3. THE SOUND OF A REVERSED / RAMPED CLIP: clipfx_render.py soundprev (backwards = the end first; 2x = half as
 *      long); lib/retimeSound.plan; the canvas plays it (TlRetimeSound)
 *   4. 🧩 MOTION GRAPHICS TEMPLATES: static/mogrt.js capture / fields / instantiate (scaled to the picture, new text
 *      ids, the words changed, keyframes scaled); the built-in templates are valid; the page / route wiring
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8", cwd: ROOT, maxBuffer: 64 << 20 });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "p12_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const T = (f) => JSON.stringify(path.join(TMP, f));

/* ---- 1. HDR */
const lv = JSON.parse(py(`
import subprocess, hdr
def y10(col, v):
    b = subprocess.run(["ffmpeg","-loglevel","error","-f","lavfi","-i","color=c=0x%02x%02x%02x:s=64x36:d=0.1" % (v,v,v),"-frames:v","1","-vf","format=yuv420p," + hdr.out_chain(col, "yuv420p10le"),"-f","rawvideo","-"], capture_output=True).stdout
    return int.from_bytes(b[0:2], "little")
rt = {}
for col in ("hdr10", "hlg"):
    rt[col] = []
    for v in (64, 128, 192, 255):
        f = ${T("h.mp4")}
        subprocess.run(["ffmpeg","-y","-loglevel","error","-f","lavfi","-i","color=c=0x%02x%02x%02x:s=64x36:d=0.2" % (v,v,v),"-vf","format=yuv420p," + hdr.out_chain(col, "yuv420p10le"),
                        "-c:v","libx265","-x265-params","log-level=error:" + hdr.x265_params(col),"-pix_fmt","yuv420p10le"] + hdr.tags(col) + [f], check=True)
        pr = hdr.probe(f)
        b = subprocess.run(["ffmpeg","-loglevel","error","-i",f,"-frames:v","1","-vf",",".join(hdr.to_sdr(pr)) + ",format=gray","-f","rawvideo","-"], capture_output=True).stdout
        r = subprocess.run(["ffmpeg","-loglevel","error","-f","lavfi","-i","color=c=0x%02x%02x%02x:s=64x36:d=0.2" % (v,v,v),"-frames:v","1","-vf","format=yuv420p,format=gray","-f","rawvideo","-"], capture_output=True).stdout
        rt[col].append([r[100], b[100], pr["hdr"]])
print(json.dumps({"pq": y10("hdr10", 255), "hlg": y10("hlg", 255), "r2020": y10("rec2020", 255), "rt": rt,
  "sdr": hdr.to_sdr({"hdr": None}), "x265": hdr.x265_params("hdr10"), "x265hlg": hdr.x265_params("hlg"), "av1": hdr.svtav1_params("hdr10"), "tags": hdr.tags("hlg"), "none": hdr.out_chain("sdr", "x")}))`));
check("HDR10: the master's white at 203 nits - PQ code 0.58 (10-bit limited ≈ 573)", lv.pq >= 565 && lv.pq <= 581, lv.pq);
check("HLG: white at 75 % of the signal (≈ 721); Rec.2020 SDR: white stays white (940)", lv.hlg >= 712 && lv.hlg <= 730 && lv.r2020 >= 930 && lv.r2020 <= 945, lv);
check("an HDR10 / HLG file comes back to the SDR it was made from (tone-mapped: dark, grey and light within 3, white within 8)",
  ["hdr10", "hlg"].every((c) => lv.rt[c].every((x, i) => Math.abs(x[0] - x[1]) <= (i === 3 ? 8 : 3))) && lv.rt.hdr10[0][2] === "pq" && lv.rt.hlg[0][2] === "hlg", lv.rt);
check("an SDR source needs nothing; sdr is no chain", lv.sdr.length === 0 && lv.none === "");
check("HDR10 metadata: x265 hdr10 + mastering display (BT.2020 / D65, 1000 nits) + MaxCLL; HLG repeats its headers; SVT-AV1 PQ (16) + mastering display; the stream's tags",
  /hdr10=1/.test(lv.x265) && /master-display=G\(8500,39850\)B\(6550,2300\)R\(35400,14600\)WP\(15635,16450\)L\(10000000,1\)/.test(lv.x265) && /max-cll=203,203/.test(lv.x265)
  && /transfer=arib-std-b67/.test(lv.x265hlg) && !/hdr10/.test(lv.x265hlg) && /transfer-characteristics=16/.test(lv.av1) && /mastering-display=/.test(lv.av1)
  && lv.tags.join(" ") === "-color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc -color_range tv", lv);
const da = JSON.parse(py(`
import deliver
info = {"w": 1920, "h": 1080, "fps": 25, "audio": True, "dur": 2}
def a(d):
    r = deliver.args_for(d, info, None, enc=d.get("enc"))
    return " ".join(str(x) for x in (r[0] if isinstance(r, tuple) else r))
print(json.dumps({"h265": a({"preset": "h265_10", "colour": "hdr10"}), "h265sdr": a({"preset": "h265_10"}), "h264": a({"preset": "h264", "colour": "hdr10"}),
                  "pr": a({"preset": "prores", "colour": "hlg"})}))`));
check("deliver.py: h265_10 + hdr10 = PQ chain into 10-bit, x265's HDR10 metadata, the stream tagged; sdr has none; an 8-bit preset ignores a colour",
  /t=smpte2084/.test(da.h265) && /format=yuv420p10le/.test(da.h265) && /hdr10=1/.test(da.h265) && /-color_trc smpte2084/.test(da.h265)
  && !/smpte2084/.test(da.h265sdr) && !/smpte2084|bt2020/.test(da.h264) && /t=arib-std-b67/.test(da.pr) && /yuv422p10le/.test(da.pr), da);
const DL = require(path.join(ROOT, "lib", "deliver.js"));
const EP = JSON.parse(read("lib", "exportPresets.json"));
check("lib/deliver.js: a wide preset keeps its colour (named h265_10_hdr10); an 8-bit one drops it; an unknown colour = sdr",
  DL.one({ preset: "h265_10", colour: "hdr10" }).name === "h265_10_hdr10" && DL.one({ preset: "h264", colour: "hdr10" }).colour === undefined
  && DL.one({ preset: "av1", colour: "zzz" }).colour === undefined && ["h265_10", "av1", "prores", "prores4444"].every((id) => EP.presets.find((p) => p.id === id).wide)
  && ["sdr", "hdr10", "hlg", "rec2020"].every((c) => EP.colours.includes(c)));
const CR = read("scripts", "clipfx_render.py");
check("an HDR SOURCE on the timeline: rendered once, tone-mapped to the timeline's SDR (clipfx_render.needs / graph)",
  /_hdr\.to_sdr\(/.test(CR) && /def is_hdr\(/.test(CR) && /tone-mapped to the timeline's SDR/.test(CR));
const DJ = read("ext", "timelinedock", "deliver.js");
check("📤 the page: a colour for the 10-bit presets (data-k=\"colour\"), the HDR pack", /data-k="colour"/.test(DJ) && /hdr/.test(DJ));

/* ---- 2. AAF */
ff(["-f", "lavfi", "-i", "testsrc=s=320x240:r=25:d=4", "-f", "lavfi", "-i", "sine=f=440:d=4", "-ac", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "a.mp4")]);
ff(["-f", "lavfi", "-i", "sine=f=300:d=6", "-ac", "2", path.join(TMP, "b.wav")]);
const job = { name: "AAF test", fps: 25, tc_start: 90000, video: [{ name: "V1", items: [{ path: path.join(TMP, "a.mp4"), name: "a", start: 0, len: 50, in: 10 }, { path: path.join(TMP, "a.mp4"), name: "a2", start: 75, len: 20, in: 0, speed: 2 }] }],
  audio: [{ name: "A1", items: [{ path: path.join(TMP, "b.wav"), name: "b", start: 10, len: 100, in: 25 }] }] };
fs.writeFileSync(path.join(TMP, "job.json"), JSON.stringify(job));
const ar = JSON.parse(execFileSync("python3", [path.join(ROOT, "scripts", "aaf_export.py"), path.join(TMP, "o.aaf")], { input: JSON.stringify(job), encoding: "utf8" }));
check("aaf_export.py: 1 picture + 2 sound tracks (a stereo file on two mono tracks), 4 clips, the speed said", ar.ok && ar.video_tracks === 1 && ar.audio_tracks === 2 && ar.clips === 4 && /a2: 2x/.test(ar.notes.join()), ar);
const rb = JSON.parse(py(`
import aaf2
with aaf2.open(${T("o.aaf")}) as f:
    comp = list(f.content.toplevel())[0]
    out = {"name": comp.name, "slots": []}
    for s in comp.slots:
        seg = s.segment
        if seg.media_kind == "Timecode":
            out["tc"] = [seg.start, seg.length, seg.fps]; continue
        out["slots"].append({"name": s.name, "kind": seg.media_kind, "rate": str(s.edit_rate), "c": [[type(c).__name__, c.length, getattr(c, "start", None), (c.mob.name if getattr(c, "mob", None) else None)] for c in seg.components]})
    out["masters"] = sorted(m.name for m in f.content.mastermobs())
print(json.dumps(out))`));
const v1 = rb.slots[0], a1 = rb.slots[1];
check("read back (pyaaf2): the composition, timecode 01:00:00:00 at 25, V1 = clip(50, in 10) + filler 25 + clip(20) + filler to the end",
  rb.name === "AAF test" && rb.tc[0] === 90000 && rb.tc[2] === 25 && v1.kind === "Picture" && v1.rate === "25"
  && JSON.stringify(v1.c.map((x) => [x[0], x[1], x[2]])) === JSON.stringify([["SourceClip", 50, 10], ["Filler", 25, null], ["SourceClip", 20, 0], ["Filler", 15, null]]), rb);
check("...sound: A1 L / A1 R = filler 10 + clip(100) from 1 s in (25 timeline frames - the AAF's own units); the media LINKED (master clips a, b)",
  a1.name === "A1 L" && rb.slots[2].name === "A1 R" && a1.kind === "Sound" && JSON.stringify(a1.c.map((x) => [x[0], x[1], x[2]])) === JSON.stringify([["Filler", 10, null], ["SourceClip", 100, 25]])
  && JSON.stringify(rb.masters) === JSON.stringify(["a", "b"]), rb);
let otioOk = null;
try {
  otioOk = JSON.parse(py(`
import opentimelineio as otio
t = otio.adapters.read_from_file(${T("o.aaf")})
print(json.dumps([[tr.kind, tr.name, [[c.name, round(c.source_range.start_time.to_seconds(), 3), round(c.source_range.duration.to_seconds(), 3)] for c in tr]] for tr in t.tracks]))`));
} catch (e) { otioOk = null; }
check("...and OpenTimelineIO's AAF reader (what Resolve / Pro Tools tools use) sees the same cut (skipped when it is not installed)",
  otioOk === null || (otioOk[0][2][0][1] === 0.4 && otioOk[0][2][0][2] === 2 && otioOk[1][2][1][1] === 1 && otioOk[1][2][1][2] === 4), otioOk);
const AF = require(path.join(ROOT, "lib", "aaf.js"));
const aj = AF.job({ video: [{ name: "a.mp4", src: "video", start: 0, in: 1, out: 3, dur: 4 }], images: [{ name: "T1", clips: [{ name: "p.png", start: 0, len: 2 }] }],
  audio: [{ name: "Music", clips: [{ name: "s.wav", start: 1, in: 0, out: 2, dur: 5 }] }] }, { fps: 25, abs: (x) => "/x/" + x.name, tc: { start: "01:00:00:00", fps: 25 } });
check("lib/aaf.js job: frames at the fps, V1's sound as a track, a still left out (said), the start timecode",
  aj.tc_start === 90000 && aj.video.length === 1 && aj.video[0].items[0].in === 25 && aj.video[0].items[0].len === 50 && aj.audio.length === 2
  && aj.audio[1].items[0].start === 25 && aj.audio[1].items[0].path === "/x/s.wav" && /p\.png/.test(aj.skipped.join()), aj);
check("the ⇄ Exchange: AAF in the formats, fetched as a file; /api/interchange/export format aaf; pyaaf2 in requirements.txt",
  /\["aaf", "AAF - Avid Media Composer, Pro Tools/.test(read("ext", "timelinedock", "interchange.js")) && /\/api\/interchange\/file\//.test(read("ext", "timelinedock", "interchange.js"))
  && /fmt === "aaf"/.test(read("routes", "interchange.js")) && /^pyaaf2/m.test(read("requirements.txt")));

/* ---- 3. the sound of a reversed / ramped clip */
ff(["-f", "lavfi", "-i", "sine=f=440:d=2,apad=pad_dur=2", "-f", "lavfi", "-i", "testsrc=s=160x120:r=25:d=4", "-c:a", "aac", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-shortest", "-t", "4", path.join(TMP, "tone.mp4")]);
execFileSync("python3", [path.join(ROOT, "scripts", "clipfx_render.py"), "soundprev", path.join(TMP, "tone.mp4"), path.join(TMP, "r.webm"), JSON.stringify({ segments: [{ q0: 0, q1: 4, s: 2 }], reverse: true }), "0", "4"]);
const vd = (f, a, d) => {
  const r = require("child_process").spawnSync("ffmpeg", ["-hide_banner", "-ss", String(a), "-t", String(d), "-i", f, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const m = /mean_volume: (-?[\d.]+) dB/.exec(r.stderr || ""); return m ? +m[1] : null;
};
const dur = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(TMP, "r.webm")], { encoding: "utf8" });
const q1 = vd(path.join(TMP, "r.webm"), 0.05, 0.8), q2 = vd(path.join(TMP, "r.webm"), 1.15, 0.8);
check("soundprev: a reversed 2x clip's sound - half as long (2 s), the silent END first, then the tone (Opus webm)", Math.abs(dur - 2) < 0.1 && q1 < -60 && q2 > -40, { dur, q1, q2 });
const RS = require(path.join(ROOT, "lib", "retimeSound.js"));
const pl = RS.plan({ name: "x.mp4", in: 0, out: 4, fx: { speed: 2, reverse: true } });
check("lib/retimeSound.plan: the compile's segments + reverse; a straight clip = none", pl && pl.reverse === true && pl.segments.length === 1 && pl.segments[0].s === 2 && RS.plan({ name: "x", in: 0, out: 4, fx: {} }) === null, pl);
const CV = read("ext", "timelinedock", "canvas.js"), RJ = read("ext", "timelinedock", "retimesound.js");
check("the canvas HEARS a reversed / ramped clip: TlRetimeSound.sync (t - start, the shuttle rate, the 🎚 mixer); stopped off the clip; the routes",
  /TlRetimeSound\.sync\(c, t, play && keepAudio\(\) && !Ly\.L\.muted && R > 0 && !c\.soundOut, Ly, R\)/.test(CV) && /TlRetimeSound\.stop\(c\)/.test(CV)
  && /var want = Math\.max\(0, t - \(c\.start \|\| 0\)\)/.test(RJ) && /TlMixer\.apply\(a, Ly\.lk, Ly\.L, 1\)/.test(RJ) && /\/api\/clipfx\/retimesound/.test(RJ)
  && /retimeSound\.want/.test(read("routes", "clipfx.js")) && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("retimesound.js"));

/* ---- 4. motion graphics templates */
const MG = require(path.join(ROOT, "static", "mogrt.js"));
const layers = [
  { name: "Bar", opacity: 1, clips: [{ name: "bar.png", start: 4, len: 5, tf: { x: -300, y: 300, scale: 1, rot: 0 }, kf: [{ at: 0, op: 0, x: -600, scale: 0.5 }, { at: 0.5, op: 1, x: -300, scale: 1 }], src: "zzz" }] },
  { name: "T1", text: true, opacity: 0.9, clips: [{ name: "text_abc.png", tid: "abc", start: 4.25, len: 4, text: { content: "Jordan\nRivers", size: 60, strokeW: 3, color: "#fff", fx: "arena-gold-3d", junk: 1 }, tf: { x: -300, y: 280, scale: 1, rot: 5 }, kf: [{ at: 0, x: -500 }] }] },
  { name: "Adj", clips: [{ adjust: true, start: 0, len: 9 }] },
];
const tp = MG.capture(layers, { name: "Lower", w: 1920, h: 1080, labels: { L1C0: "Name" } });
check("capture: the picture / text layers (an adjustment layer left out), starts from 0, the text's own keys only, the field named, the length",
  tp.layers.length === 2 && tp.layers[0].clips[0].start === 0 && tp.layers[1].clips[0].start === 0.25 && tp.layers[1].clips[0].text.junk === undefined && tp.layers[1].clips[0].tid === undefined
  && tp.layers[0].clips[0].src === undefined && tp.fields.length === 1 && tp.fields[0].label === "Name" && tp.fields[0].key === "L1C0" && tp.len === 5 && tp.layers[1].clips[0].text.fx === "arena-gold-3d", tp);
let ids = 0;
const inst = MG.instantiate(tp, { at: 10, w: 1280, h: 720, values: { L1C0: "Tim" }, newId: () => "n" + (++ids) });
const ib = inst[0].clips[0], it = inst[1].clips[0];
check("instantiate at 10 s on 1280×720 (k = 2/3): starts moved, positions + keyframe x scaled, a picture's scale (and its keyframed scale) × k",
  ib.start === 10 && it.start === 10.25 && ib.tf.x === -200 && ib.tf.y === 200 && Math.abs(ib.tf.scale - 0.6667) < 1e-3 && ib.kf[0].x === -400 && Math.abs(ib.kf[0].scale - 0.3333) < 1e-3 && ib.name === "bar.png", inst);
check("...a text: the words changed, its size + outline × k (its scale stays), a NEW id + picture name, its preset kept, the layer's opacity",
  it.text.content === "Tim" && it.text.size === 40 && it.text.strokeW === 2 && it.tf.scale === 1 && it.tf.rot === 5 && it.tid === "n1" && it.name === "text_n1.png" && it.kf[0].x === -333
  && it.text.fx === "arena-gold-3d" && inst[1].text === true && inst[1].opacity === 0.9, it);
{ const t2 = JSON.parse(JSON.stringify(tp)); t2.layers[0].clips[0].nat = { w: 1100, h: 150 };
  const small = MG.instantiate(t2, { at: 0, w: 320, h: 180 })[0].clips[0];
  check("...a picture with its size known (nat) keeps its DESIGNED width on a small picture (the canvas never draws it wider than the frame): 1100 px of 1920 = 183 of 320",
    Math.abs(Math.min(1100, 320) * small.tf.scale - 1100 / 6) < 0.5 && small.nat === undefined && small.tf.x === -50 && small.kf[1].x === -50 && Math.abs(small.kf[1].scale - small.tf.scale) < 1e-3, small); }
check("fields: every text, its label + its words; nothing to keep = an error", MG.fields(tp)[0].value === "Jordan\nRivers" && MG.fields(tp)[0].label === "Name"
  && (() => { try { MG.capture([{ name: "A", clips: [{ adjust: true }] }], {}); return false; } catch (e) { return /nothing/.test(e.message); } })());
const BI = ["lower-third", "title-card", "end-card", "corner-tag"];
check("the built-in templates: valid, with editable texts, their pictures shipped beside them", BI.every((id) => {
  const t = MG.clean(JSON.parse(read("mogrt", id + ".json")));
  return t.layers.length >= 2 && t.fields.length >= 1 && MG.assets(t).every((n) => fs.existsSync(path.join(ROOT, "mogrt", id, n)));
}));
const MJ = read("ext", "timelinedock", "mogrt.js");
check("🧩 the page: save the ticked layers (H3Mogrt.capture -> POST /api/mogrt), insert at the playhead (place -> instantiate -> mkLayer + uploadText); routes/mogrt mounted; static/mogrt.js loaded",
  /H3Mogrt\.capture\(picked\(\)/.test(MJ) && /\/api\/mogrt\/" \+ encodeURIComponent\(id\) \+ "\/place"/.test(MJ) && /H3Mogrt\.instantiate\(/.test(MJ) && /TlCanvas\.uploadText\(c\)/.test(MJ)
  && /require\("\.\/mogrt"\)\.mount\(app\)/.test(read("routes", "index.js")) && /<script src="\/static\/mogrt\.js"><\/script>/.test(read("static", "index.html"))
  && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("mogrt.js"));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
/* bitGen Studio — scripts/ue-stub.js (2.472.0): a STAND-IN for the Unreal Editor with the bitGen Bridge plugin, for the
 * tests (and for trying the bridge without Unreal): the same HTTP protocol as ue/bitGenBridge/Content/Python/
 * bitgen_bridge.py - POST /bitgen {cmd, args} -> {ok, ...} on 127.0.0.1:<port>.
 *   node scripts/ue-stub.js [port]          (default 30020)
 *   require("./ue-stub").start(port) -> {port, close(), calls, state}
 * Its "project" has two levels, a sequence, two cameras, two MetaHumans and animations; a still is a PNG (the sky
 * blue, a figure in the middle; with alpha = the background clear); a render writes PNG frames over ~1 s.
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
/** an RGBA PNG: px(x, y) -> [r, g, b, a] */
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const p = px(x, y), o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3]; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const hexRGB = (h) => { const n = parseInt(String(h || "#ffffff").slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const scene = (w, h, alpha, k, ev, rig) => {
  // 2.476.0: bitGen's lights tint the figure (their colours, on ones only); fog pulls the background toward its colour
  const on = rig && rig.lights ? rig.lights.filter((l) => l.on !== false) : [];
  const tint = on.length ? [0, 1, 2].map((i) => on.reduce((s, l) => s + hexRGB(l.color)[i], 0) / on.length / 255) : [1, 1, 1];
  const fog = rig && rig.fog && rig.fog.on ? { c: hexRGB(rig.fog.color), k: Math.min(0.8, (rig.fog.density || 0) * 10 + (rig.fog.volumetric ? 0.2 : 0)) } : null;
  return png(w, h, (x, y) => {
    const fig = Math.abs(x - w / 2 - (k || 0)) < w / 8 && y > h / 5 && y < h * 0.95;
    const b = Math.pow(2, Math.max(-3, Math.min(3, ev || 0)));          // 2.475.0: the lens's exposure brightens / darkens
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * b)));
    if (fig) return [c(200 * tint[0]), c(150 * tint[1]), c(120 * tint[2]), 255];
    if (alpha) return [0, 0, 0, 0];
    const bg = [110, 160, 220];
    return fog ? [c(bg[0] + (fog.c[0] - bg[0]) * fog.k), c(bg[1] + (fog.c[1] - bg[1]) * fog.k), c(bg[2] + (fog.c[2] - bg[2]) * fog.k), 255] : [c(bg[0]), c(bg[1]), c(bg[2]), 255];
  });
};

function start(port) {
  const st = { level: "/Game/Maps/Studio", jobs: {}, seq: 0 };
  const calls = [];
  const C = {
    ping: () => ({ bridge: "1.0.0", engine: "5.8.1-stub", project: "C:/Unreal/StubProject/StubProject.uproject", level: st.level + ".Studio", port }),
    levels: () => ({ items: [{ path: "/Game/Maps/Studio", name: "Studio", object: "/Game/Maps/Studio.Studio" }, { path: "/Game/Maps/Street", name: "Street", object: "/Game/Maps/Street.Street" }] }),
    sequences: () => ({ items: [{ path: "/Game/Cine/Seq_Intro", name: "Seq_Intro", object: "/Game/Cine/Seq_Intro.Seq_Intro" }] }),
    metahumans: () => ({ items: [{ path: "/Game/MetaHumans/Ada/BP_Ada", name: "Ada", object: "/Game/MetaHumans/Ada/BP_Ada.BP_Ada" }, { path: "/Game/MetaHumans/Kai/BP_Kai", name: "Kai", object: "/Game/MetaHumans/Kai/BP_Kai.BP_Kai" }] }),
    anims: () => ({ items: [{ path: "/Game/Anims/Idle", name: "Idle", object: "/Game/Anims/Idle.Idle" }, { path: "/Game/Anims/Wave", name: "Wave", object: "/Game/Anims/Wave.Wave" }] }),
    cameras: () => ({ items: [{ name: "CineCam_Wide", loc: [-600, 0, 170], rot: [0, -5, 0], fov: 40, focal: 35, cine: true }, { name: "CineCam_Close", loc: [-180, 30, 160], rot: [0, 0, -8], fov: 25, focal: 85, cine: true }] }),
    viewport: () => st.viewport || { loc: [-400, -200, 200], rot: [0, -10, 25], fov: 90 },
    set_viewport: (a) => { st.viewport = { loc: a.loc, rot: a.rot, fov: 90 }; return { loc: a.loc, rot: a.rot }; },   // 2.475.0
    focus_at: (a) => ({ hit: true, focus: Math.round(300 + 400 * Math.abs((a.u || 0.5) - 0.5)), at: [0, 0, 100] }),

    // 2.540.0: the level's mesh actors + their bounds, through the camera asked (a car in front, a sofa left, a lamp right)
    actors_in_view: (a) => {
      const cam = a.camera && a.camera.loc ? { loc: a.camera.loc, rot: a.camera.rot || [0, 0, 0], fov: a.camera.fov || 60 } : a.camera && a.camera.name === "CineCam_Close" ? { loc: [-180, 30, 160], rot: [0, 0, -8], fov: 25 } : { loc: [-600, 0, 170], rot: [0, -5, 0], fov: 40 };
      return { camera: cam, actors: [
        { label: "SM_Car_01", cls: "StaticMeshActor", origin: [0, 0, 70], extent: [220, 90, 70], dist: 600 },
        { label: "Sofa", cls: "StaticMeshActor", origin: [150, -260, 45], extent: [100, 45, 45], dist: 800 },
        { label: "FloorLamp", cls: "StaticMeshActor", origin: [120, 260, 90], extent: [20, 20, 90], dist: 830 },
        { label: "BehindTheCamera", cls: "StaticMeshActor", origin: [-2000, 0, 100], extent: [50, 50, 50], dist: 1400 }] };
    },
    open_level: (a) => { if (!a.path) throw new Error("no level"); st.level = a.path; return { level: a.path }; },
    still: (a) => {
      if (!a.out) throw new Error("no output file");
      if (a.level) st.level = a.level;
      if (a.camera && a.camera.name && !["CineCam_Wide", "CineCam_Close"].includes(a.camera.name)) throw new Error("no camera named " + a.camera.name + " in the open level");
      fs.mkdirSync(path.dirname(a.out), { recursive: true });
      const turn = (a.camera && a.camera.yaw ? a.camera.yaw : 0) + (a.camera && a.camera.rot ? Math.round(Math.sin(a.camera.rot[2] * Math.PI / 180) * (a.w || 1280) / 4) : 0);   // the figure moves as the camera turns
      fs.writeFileSync(a.out, scene(a.w || 1280, a.h || 720, !!a.alpha, turn, a.lens && a.lens.exposure, a.rig));
      const cam = a.camera && a.camera.loc ? { loc: a.camera.loc, rot: a.camera.rot, fov: a.camera.fov } : { loc: [-600, 0, 170], rot: [0, -5, 0], fov: 40 };
      return { out: a.out, w: a.w, h: a.h, camera: cam };
    },
    render: (a) => {
      if (!a.out_dir) throw new Error("no output folder");
      const id = "s" + (++st.seq), n = a.frames || 24, w = Math.min(a.w || 64, 160), h = Math.min(a.h || 36, 90);
      fs.mkdirSync(a.out_dir, { recursive: true });
      const seqPath = a.sequence || "/Game/bitGen/bitGen_" + id;
      st.jobs[id] = { state: "running", error: "", out: a.out_dir, n, args: a };
      let f = 0;
      const t = setInterval(() => {
        for (let k = 0; k < Math.max(1, Math.ceil(n / 8)) && f < n; k++, f++) fs.writeFileSync(path.join(a.out_dir, "f_" + String(f).padStart(5, "0") + ".png"), scene(w, h, !!a.alpha, f, a.lens && a.lens.exposure, a.rig));
        if (f >= n) { clearInterval(t); st.jobs[id].state = "done"; }
      }, 100);
      return { job: id, sequence: seqPath };
    },
    job: (a) => { const j = st.jobs[a.id]; if (!j) throw new Error("no such job"); return { state: j.state, error: j.error, frames: fs.readdirSync(j.out).length, sequence: "" }; },
  };
  const srv = http.createServer((req, res) => {
    const send = (code, o) => { const b = JSON.stringify(o); res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(b) }); res.end(b); };
    if (req.method !== "POST" || !req.url.startsWith("/bitgen")) return send(404, { ok: false, error: "POST /bitgen" });
    let body = ""; req.on("data", (d) => { body += d; });
    req.on("end", () => {
      let q; try { q = JSON.parse(body || "{}"); } catch (e) { return send(400, { ok: false, error: "not JSON" }); }
      calls.push(q);
      const f = C[q.cmd]; if (!f) return send(422, { ok: false, error: "unknown command " + q.cmd });
      try { send(200, Object.assign({ ok: true }, f(q.args || {}))); } catch (e) { send(422, { ok: false, error: e.message }); }
    });
  });
  return new Promise((ok) => srv.listen(port || 30020, "127.0.0.1", () => ok({ port: srv.address().port, calls, state: st, close: () => new Promise((r) => srv.close(r)) })));
}
module.exports = { start, png };
if (require.main === module) start(Number(process.argv[2]) || 30020).then((s) => console.log("bitGen Bridge stand-in on http://127.0.0.1:" + s.port + "/bitgen"));

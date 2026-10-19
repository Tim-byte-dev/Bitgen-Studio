/* bitGen Studio — lib/dazLive.js (2.461.0): the EXPERIMENTAL DAZ LIVE LINK - bitGen moves Daz Studio's camera and poses.
 *
 * Tim (verbatim): "bridge daz3d to image editor and timeline - allow me to move the camera and adjust poses in daz3d through
 * the image editor or timeline docker ... if we can't do it wit daz directly we can send daz scene to blender" - asked:
 * Blender (2.460.0) + an experimental Daz live link (this). It could not be tried against a real Daz Studio here.
 *
 * Daz cannot be called from outside, so Daz asks: the bridge's "bitGen Live Link" script (daz/bitgen_bridge/bitGen Live
 * Link.dsa) runs in Daz with a small window and POSTs /api/daz/live/poll about once a second with what Daz has (the
 * selected figure's name + its bones, the camera) - and gets back the commands queued since its last poll:
 *   {type: "view", cam: {pos: [x, y, z], target: [x, y, z], fov}}   Daz units (cm, Y up): a camera "bitGen Camera"
 *                                                                    there, the viewport looks through it
 *   {type: "pose", figure, bones: {<bone>: [x, y, z]}}               degrees ADDED to those bones' X / Y / Z Rotate
 *   {type: "reset"}                                                  the pose sent so far taken back
 * The page (the image editor's 3D layer) converts its Blender view: Blender (x, y, z) m -> Daz (100x, 100z, -100y) cm (a
 * Daz FBX comes into Blender in metres with Z up). Bones turn in Daz's own axes (they may not match Blender's).
 *   push(cmd) / poll({since, info}) / status() - pure: toDaz, cleanCmd */
"use strict";

const MAX = 200;
let seq = 0;
const queue = [];
let last = 0, info = null;

/** a Blender world point (m, Z up) -> Daz (cm, Y up) */
function toDaz(p, scale) {
  const k = Number(scale) > 0 ? Number(scale) : 100, a = Array.isArray(p) ? p : [0, 0, 0];
  return [+(a[0] || 0) * k, +(a[2] || 0) * k, -(+(a[1] || 0)) * k];
}
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const v3 = (a) => (Array.isArray(a) ? a.slice(0, 3).map((x) => num(x, 0)).concat([0, 0, 0]).slice(0, 3) : [0, 0, 0]);
/** a command from the page, made safe (null = not one) */
function cleanCmd(c) {
  const o = c || {};
  if (o.type === "view" && o.cam) return { type: "view", cam: { pos: v3(o.cam.pos), target: v3(o.cam.target), fov: Math.max(1, Math.min(170, num(o.cam.fov, 40))) } };
  if (o.type === "pose" && o.bones && typeof o.bones === "object") {
    const bones = {};
    for (const [b, r] of Object.entries(o.bones).slice(0, 400)) if (Array.isArray(r)) bones[String(b).slice(0, 120)] = v3(r).map((x) => Math.max(-360, Math.min(360, x)));
    return { type: "pose", figure: String(o.figure || "").slice(0, 120), bones };
  }
  if (o.type === "reset") return { type: "reset" };
  return null;
}
function push(cmd) {
  const c = cleanCmd(cmd);
  if (!c) { const e = new Error("not a live-link command (view / pose / reset)"); e.status = 400; throw e; }
  seq += 1;
  // a newer view replaces a view Daz has not taken yet
  if (c.type === "view") for (let i = queue.length - 1; i >= 0; i--) if (queue[i].cmd.type === "view") queue.splice(i, 1);
  queue.push({ seq, cmd: c, at: Date.now() });
  while (queue.length > MAX) queue.shift();
  return { seq, queued: queue.length, connected: connected() };
}
const connected = () => Date.now() - last < 5000;
/** Daz asks: what it has + the last command it took -> the newer ones */
function poll(body) {
  const b = body || {};
  last = Date.now();
  if (b.info && typeof b.info === "object") info = { figure: String(b.info.figure || "").slice(0, 200), bones: Array.isArray(b.info.bones) ? b.info.bones.slice(0, 600).map((x) => String(x).slice(0, 120)) : [],
                                                     camera: String(b.info.camera || "").slice(0, 200), version: String(b.info.version || "").slice(0, 40), at: last };
  const since = num(b.since, 0) > seq ? 0 : num(b.since, 0);     // bitGen restarted since Daz's last poll: from the start
  const cmds = queue.filter((q) => q.seq > since).map((q) => Object.assign({ seq: q.seq }, q.cmd));
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].seq <= since) queue.splice(i, 1);    // taken
  return { seq, cmds };
}
function status() { return { connected: connected(), last: last || null, info, queued: queue.length, seq }; }
function _reset() { queue.length = 0; seq = 0; last = 0; info = null; }

module.exports = { toDaz, cleanCmd, push, poll, status, _reset };

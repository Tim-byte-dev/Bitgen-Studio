#!/usr/bin/env node
// Tests for static/vr360.js — the 360° equirectangular viewer (2.119.0, Tim:
// "is it possible to make a 360 vr video, and allow our preview/media player
// play the 360 video?"). VR360.math is the JS mirror of the GLSL the GPU
// runs; pinning it here pins the projection without needing WebGL.
// Run: node scripts/test-vr360.js
const fs = require("fs");
const PAGE = require("../lib/extensions").pageHtml(require("path").join(__dirname, ".."));

const path = require("path");
const V = require(path.join(__dirname, "..", "ext", "previewdock", "vr360.js"));

let pass = 0, fail = 0;
const check = (n, cond, got) => cond
  ? (pass++, console.log("PASS: " + n))
  : (fail++, console.log("FAIL: " + n + (got !== undefined ? "\n      got " + JSON.stringify(got) : "")));
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const PI = Math.PI;

check("the module exports attach() and math", typeof V.attach === "function" && V.math && typeof V.math.uv === "function", Object.keys(V));

// ---------------------------------------------------------- the projection
{
  const m = V.math;
  check("looking straight ahead samples the frame centre",
    (() => { const [u, v] = m.uv(m.dir(0, 0)); return near(u, 0.5) && near(v, 0.5); })(), m.uv(m.dir(0, 0)));
  check("a quarter turn right lands a quarter frame right",
    near(m.uv(m.dir(PI / 2, 0))[0], 0.75), m.uv(m.dir(PI / 2, 0)));
  check("a quarter turn left lands a quarter frame left",
    near(m.uv(m.dir(-PI / 2, 0))[0], 0.25), m.uv(m.dir(-PI / 2, 0)));
  check("straight up is the top pole (v=0), straight down the bottom (v=1)",
    near(m.uv(m.dir(0, PI / 2))[1], 0, 1e-3) && near(m.uv(m.dir(0, -PI / 2))[1], 1, 1e-3), null);
  // the seam: the direction BEHIND the viewer is both u→1 and u→0 —
  // approaching from either side must land within a hair of the same place
  const uL = m.uv(m.dir(PI - 1e-4, 0))[0];
  const uR = m.uv(m.dir(-PI + 1e-4, 0))[0];
  const wrapDist = Math.min(Math.abs(uL - uR), 1 - Math.abs(uL - uR));
  check("the left/right seam is continuous (wrap distance ~0 behind the viewer)",
    uL > 0.999 && uR < 0.001 && wrapDist < 1e-3, [uL, uR]);
  check("the screen-centre ray equals dir() for any yaw/pitch",
    (() => {
      for (let i = 0; i < 50; i++) {
        const y = (Math.random() * 2 - 1) * PI, p = (Math.random() * 2 - 1) * 1.4;
        const a = m.dir(y, p), b = m.ray(0, 0, y, p, 1.3, 1.77);
        if (!(near(a[0], b[0]) && near(a[1], b[1]) && near(a[2], b[2]))) return false;
      }
      return true;
    })(), null);
  check("the ray respects the field of view (right screen edge = fov/2 * aspect off forward)",
    (() => {
      const fov = 75 * PI / 180, aspect = 1.5;
      const d = m.ray(1, 0, 0, 0, fov, aspect);
      const want = Math.atan(Math.tan(fov / 2) * aspect);
      return near(Math.atan2(d[0], -d[2]), want, 1e-9);
    })(), null);
  check("uv° round-trips a direction in the mid band",
    (() => {
      for (let i = 0; i < 50; i++) {
        const y = (Math.random() * 2 - 1) * (PI - 0.01), p = (Math.random() * 2 - 1) * 1.4;
        const d = m.dir(y, p);
        const [u, v] = m.uv(d);
        const d2 = m.dir((u - 0.5) * 2 * PI, (0.5 - v) * PI);
        if (!(near(d[0], d2[0], 1e-6) && near(d[1], d2[1], 1e-6) && near(d[2], d2[2], 1e-6))) return false;
      }
      return true;
    })(), null);
}

// ------------------------------------- graceful when WebGL does not exist
{
  const hadDoc = "document" in globalThis;
  globalThis.document = { createElement: () => ({ getContext: () => null, style: {}, className: "" }) };
  let out, threw = false;
  try { out = V.attach({}, { appendChild() {} }); } catch { threw = true; }
  if (!hadDoc) delete globalThis.document;
  check("attach() returns null (never throws) when the context is unavailable", !threw && out === null, { threw, out });
  check("attach() returns null for a missing video/host", V.attach(null, null) === null, null);
}

// --------------------------------------------------- the UI wiring, source
const HTML = PAGE;
check("the player bar has the 360° button", HTML.includes('id="pv360"'), null);
check("vr360.js is loaded with the other static scripts, version-stamped (2.242.0)", HTML.includes('<script src="/ext/previewdock/vr360.js?v='), null);
check("the toggle wires attach/destroy and hides only the video's pixels",
  HTML.includes("VR360.attach(p, $(\"viewerwrap\"))") && HTML.includes("vr360Off")
  && HTML.includes("vr360hide"), null);
check("a ~2:1 video lights the button up (equirect hint)",
  HTML.includes('classList.toggle("equirect"'), null);
check("both video aspect selects offer 2:1 (360°)",
  (HTML.match(/value="2:1"/g) || []).length >= 2, (HTML.match(/value="2:1"/g) || []).length);
check("the shader mirrors math.uv (same atan/asin form)",
  (() => {
    const js = fs.readFileSync(path.join(__dirname, "..", "ext", "previewdock", "vr360.js"), "utf8");
    return js.includes("atan(d.x,-d.z)/6.2831853") && js.includes("asin(clamp(d.y,-1.,1.))/3.14159265");
  })(), null);

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/* static/vr360.js — 360° EQUIRECTANGULAR VIDEO VIEWER (2.119.0, Tim: "is it
 * possible to make a 360 vr video, and allow our preview/media player play
 * the 360 video?").
 *
 * No dependencies, no three.js: one fullscreen triangle and a fragment shader
 * that turns every pixel into a view ray from yaw/pitch/fov and samples the
 * equirectangular frame of the SAME <video> element the player already uses —
 * the video keeps playing (and keeps its audio); this only changes how its
 * pixels are shown. Drag to look around, wheel to zoom (FOV 30–110°), click
 * without dragging to play/pause, double-click to level the view.
 *
 * The projection math lives in VR360.math and is MIRRORED in the shader, so
 * node tests (scripts/test-vr360.js) pin the exact math the GPU runs without
 * needing WebGL. Conventions: yaw 0 / pitch 0 looks down -Z at the CENTRE of
 * the equirect frame (u=0.5, v=0.5); +yaw turns right; +pitch looks up;
 * u wraps at the frame's left/right seam (the direction behind the viewer).
 */
(function (root) {
  "use strict";
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const math = {
    /** Unit view ray of the screen CENTRE for a yaw/pitch (radians). */
    dir(yaw, pitch) {
      const cp = Math.cos(pitch);
      return [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
    },
    /** Equirect texture coords [u,v] of a unit direction. u wraps 0..1. */
    uv(d) {
      const u = 0.5 + Math.atan2(d[0], -d[2]) / TAU;
      const v = 0.5 - Math.asin(clamp(d[1], -1, 1)) / Math.PI;
      return [u - Math.floor(u), clamp(v, 0, 1)];
    },
    /** Unit ray through a screen point. nx,ny in [-1,1] (right/up positive),
        fovY the VERTICAL field of view in radians, aspect = width/height. */
    ray(nx, ny, yaw, pitch, fovY, aspect) {
      const t = Math.tan(fovY / 2);
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const f = [sy * cp, sp, -cy * cp];          // forward
      const r = [cy, 0, sy];                      // right  = cross(f, worldUp)
      const u2 = [-sy * sp, cp, cy * sp];         // up     = cross(r, f)
      const d = [
        f[0] + nx * t * aspect * r[0] + ny * t * u2[0],
        f[1] + ny * t * u2[1],
        f[2] + nx * t * aspect * r[2] + ny * t * u2[2],
      ];
      const L = Math.hypot(d[0], d[1], d[2]) || 1;
      return [d[0] / L, d[1] / L, d[2] / L];
    },
  };

  const VERT = "attribute vec2 p;varying vec2 n;"
    + "void main(){n=p;gl_Position=vec4(p,0.,1.);}";
  // the exact GLSL twin of math.ray + math.uv
  const FRAG = "precision highp float;varying vec2 n;"
    + "uniform sampler2D tex;uniform float yaw,pitch,fov,aspect;"
    + "void main(){"
    + "float t=tan(fov*0.5);"
    + "float cy=cos(yaw),sy=sin(yaw),cp=cos(pitch),sp=sin(pitch);"
    + "vec3 f=vec3(sy*cp,sp,-cy*cp);"
    + "vec3 r=vec3(cy,0.,sy);"
    + "vec3 u2=vec3(-sy*sp,cp,cy*sp);"
    + "vec3 d=normalize(f+n.x*t*aspect*r+n.y*t*u2);"
    + "float u=0.5+atan(d.x,-d.z)/6.2831853;"
    + "float v=0.5-asin(clamp(d.y,-1.,1.))/3.14159265;"
    + "gl_FragColor=texture2D(tex,vec2(fract(u),clamp(v,0.001,0.999)));}";

  /** Attach the viewer over `video` inside `host`. Returns a controller
      { destroy() } or null when WebGL (or a document) is not available. */
  function attach(video, host) {
    if (typeof document === "undefined" || !video || !host) return null;
    const canvas = document.createElement("canvas");
    canvas.className = "vr360canvas";
    canvas.title = "Drag to look · wheel to zoom · click to play/pause · double-click to level";
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return null;

    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const uYaw = U("yaw"), uPitch = U("pitch"), uFov = U("fov"), uAspect = U("aspect");
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // NPOT video texture: CLAMP + LINEAR only; the shader's fract() does the
    // horizontal wrap, so the seam costs at most one blended texel column.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    let yaw = 0, pitch = 0, fov = 75 * Math.PI / 180;
    let raf = 0, dead = false, haveFrame = false;
    let drag = null, moved = 0;

    const onDown = (e) => {
      drag = { x: e.clientX, y: e.clientY }; moved = 0;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      moved += Math.abs(dx) + Math.abs(dy);
      const k = 0.0032 * (fov / (75 * Math.PI / 180));   // slower when zoomed in
      yaw -= dx * k;
      pitch = clamp(pitch + dy * k, -1.53, 1.53);        // ±(90°-2°)
    };
    const onUp = () => {
      if (drag && moved < 5) {                            // a CLICK: play/pause
        try { video.paused ? video.play() : video.pause(); } catch { /* not ready */ }
      }
      drag = null;
    };
    const onWheel = (e) => {
      fov = clamp(fov + e.deltaY * 0.0009, 30 * Math.PI / 180, 110 * Math.PI / 180);
      e.preventDefault();
    };
    const onDbl = () => { yaw = 0; pitch = 0; fov = 75 * Math.PI / 180; };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDbl);
    host.appendChild(canvas);

    const frame = () => {
      if (dead) return;
      const w = host.clientWidth || 2, h = host.clientHeight || 2;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      if (video.readyState >= 2) {
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          haveFrame = true;
        } catch { /* first frames of a new src can throw; next tick works */ }
      }
      if (haveFrame) {
        gl.uniform1f(uYaw, yaw); gl.uniform1f(uPitch, pitch);
        gl.uniform1f(uFov, fov); gl.uniform1f(uAspect, w / h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return {
      destroy() {
        dead = true;
        cancelAnimationFrame(raf);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("dblclick", onDbl);
        try { canvas.remove(); } catch { /* already gone */ }
        const lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
      },
    };
  }

  const API = { attach, math };
  root.VR360 = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

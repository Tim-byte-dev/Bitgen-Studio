/* bitGen Studio — static/body3docc.js (2.471.0): the OPENCASCADE engine of the parametric 3D bodies, window.Body3DOCC.
 *
 * Settings ▸ 3D ▸ "In the browser (OpenCascade)": a real solid modeller (B-rep - exact fillets, chamfers, booleans,
 * shells) running in the page as WebAssembly - replicad + replicad-opencascadejs in static/vendor/replicad/ (MIT /
 * LGPL-2.1, their licences beside them; never from the internet). Loaded the first time a body is built (about 23 MB,
 * a second or two).
 *
 *   load()           -> Promise replicad (the OpenCascade module set up)
 *   build(job)       -> Promise mesh {vertices, normals, triangles, edgeLines (the solid's real edges), smooth, volume}
 *   step(job)        -> Promise Blob (a STEP file of the body)
 *   buildWith(R, job) the work itself (Node: scripts/test-body3d-occ.js runs it on the same files)
 * The job is Body3D.plan()'s: ops extrude / revolve (profiles of segments L / A / C / B, mode new / join / cut /
 * intersect), fillet / chamfer (edges all / top / bottom / vertical / horizontal), split (a plane, keep a side), shell.
 */
(function (root) {
  "use strict";
  const BASE = "/static/vendor/replicad/";
  let ready = null;
  function load() {
    if (ready) return ready;
    ready = new Promise((ok, no) => {
      const go = () => {
        import(BASE + "replicad_single.js").then((m) => m.default({ locateFile: () => BASE + "replicad_single.wasm" }))
          .then((OC) => { root.replicad.setOC(OC); ok(root.replicad); }).catch((e) => { ready = null; no(new Error("OpenCascade did not start: " + (e.message || e))); });
      };
      if (root.replicad) return go();
      const s = root.document.createElement("script"); s.src = BASE + "replicad.umd.js";
      s.onload = go; s.onerror = () => { ready = null; no(new Error("static/vendor/replicad/replicad.umd.js is missing")); };
      root.document.head.appendChild(s);
    });
    return ready;
  }

  /** one loop of segments -> a closed replicad Drawing */
  function drawLoop(R, segs) {
    if (segs.length === 1 && segs[0].k === "C") return R.drawCircle(segs[0].r).translate(segs[0].c[0], segs[0].c[1]);
    const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-7;
    let pen = R.draw(segs[0].a);
    segs.forEach((g, i) => {
      const last = i === segs.length - 1 && near(g.b, segs[0].a);
      if (last) {                                      // close() draws the last straight piece; a curve has to be drawn first
        if (g.k === "L") return;
        if (g.k === "A") pen = pen.threePointsArcTo(g.b, g.m);
        if (g.k === "B") pen = pen.cubicBezierCurveTo(g.b, g.c1, g.c2);
        return;
      }
      if (g.k === "L") pen = pen.lineTo(g.b);
      else if (g.k === "A") pen = pen.threePointsArcTo(g.b, g.m);
      else if (g.k === "B") pen = pen.cubicBezierCurveTo(g.b, g.c1, g.c2);
    });
    return pen.close();
  }
  function drawProfile(R, p) { let d = drawLoop(R, p.outer); for (const h of p.holes || []) d = d.cut(drawLoop(R, h)); return d; }
  const fuseAll = (list) => list.reduce((a, b) => (a ? a.fuse(b) : b), null);
  function zRange(shape) { const b = shape.boundingBox; return [b.bounds[0][2], b.bounds[1][2]]; }
  function edgeFinder(set, shape) {
    const [z0, z1] = zRange(shape);
    return (e) => {
      if (set === "top") return e.inPlane("XY", z1);
      if (set === "bottom") return e.inPlane("XY", z0);
      if (set === "vertical") return e.inDirection("Z");
      if (set === "horizontal") return e.not((f) => f.inDirection("Z"));
      return e;
    };
  }
  function solidOf(R, op) {
    const parts = op.profiles.map((p) => {
      const d = drawProfile(R, p);
      if (op.op === "extrude") {
        let z = op.z, len = op.dist;
        if (op.dir === "sym") { z = op.z - op.dist / 2; }
        if (op.dir === "two") { z = op.z - op.dist2; len = op.dist + op.dist2; }
        if (len < 0) { z += len; len = -len; }
        return d.sketchOnPlane("XY", z).extrude(len);
      }
      const ax = op.axis;
      return d.sketchOnPlane("XY", op.z).revolve([ax.d[0], ax.d[1], 0], { origin: [ax.o[0], ax.o[1], op.z], angle: op.angle });
    });
    return fuseAll(parts);
  }
  function buildWith(R, job) {
    let body = null; const warnings = [];
    for (const op of job.ops || []) {
      try {
        if (op.op === "extrude" || op.op === "revolve") {
          const s = solidOf(R, op);
          if (!body || op.mode === "new") body = body && op.mode === "new" ? body.fuse(s) : s;
          else if (op.mode === "join") body = body.fuse(s);
          else if (op.mode === "cut") body = body.cut(s);
          else if (op.mode === "intersect") body = body.intersect(s);
        } else if (!body) continue;
        else if (op.op === "fillet") body = body.fillet(op.radius, edgeFinder(op.edges, body));
        else if (op.op === "chamfer") body = body.chamfer(op.dist, edgeFinder(op.edges, body));
        else if (op.op === "split") {
          const B = 1e5, o = op.offset, pos = op.keep !== "neg";
          const box = op.plane === "XY" ? R.makeBox(pos ? [-B, -B, o] : [-B, -B, -B], pos ? [B, B, B] : [B, B, o])
            : op.plane === "XZ" ? R.makeBox(pos ? [-B, o, -B] : [-B, -B, -B], pos ? [B, B, B] : [B, o, B])
            : R.makeBox(pos ? [o, -B, -B] : [-B, -B, -B], pos ? [B, B, B] : [o, B, B]);
          body = body.intersect(box);
        } else if (op.op === "shell") {
          const [z0, z1] = zRange(body);
          body = body.shell(op.thick, (f) => f.inPlane("XY", op.face === "bottom" ? z0 : z1));
        }
      } catch (e) { warnings.push({ id: op.id, msg: String((e && e.message) || e || "OpenCascade could not do it") }); }
    }
    return { body, warnings };
  }
  function meshOf(body, tol) {
    const m = body.mesh({ tolerance: tol || 0.05, angularTolerance: 12 }), e = body.meshEdges({ tolerance: tol || 0.05, angularTolerance: 12 });
    let vol = 0; try { vol = root.replicad && root.replicad.measureVolume ? root.replicad.measureVolume(body) : 0; } catch (x) { vol = 0; }
    return { vertices: Float32Array.from(m.vertices), normals: Float32Array.from(m.normals), triangles: Uint32Array.from(m.triangles), edgeLines: Float32Array.from(e.lines), smooth: true, volume: vol };
  }
  function build(job) {
    return load().then((R) => {
      const { body, warnings } = buildWith(R, job);
      if (!body) throw new Error(warnings.length ? warnings.map((w) => w.msg).join("; ") : "nothing to build");
      return Object.assign(meshOf(body, job.tol), { warnings });
    });
  }
  function step(job) { return load().then((R) => { const { body } = buildWith(R, job); if (!body) throw new Error("nothing to export"); return body.blobSTEP(); }); }
  const Body3DOCC = { load, build, step, buildWith, meshOf, drawLoop, edgeFinder };
  if (typeof module !== "undefined" && module.exports) module.exports = Body3DOCC;
  else root.Body3DOCC = Body3DOCC;
})(typeof window !== "undefined" ? window : globalThis);

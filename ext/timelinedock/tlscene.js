/* bitGen Studio — ext/timelinedock/tlscene.js (2.515.0): what the timeline's SCENE TOOLS share - window.TlScene.
 *
 * Tim (verbatim): "do number 8 of the after effects list" - 🧍 the AI cut-out through a shot (tlcutout.js), 📷 the 3D
 * camera tracker (tlcamtrack.js), 🩹 content-aware fill for video (tlvfill.js). The work is done by the app
 * (routes/scene.js -> lib/sceneTools.js -> scripts/roto.py | camtrack.py | vfill.py) as background jobs.
 *   TlScene.start(url, body)          -> Promise {id}
 *   TlScene.watch(id, onProgress)     -> Promise result (polls GET /api/scene/job/:id; rejects on failed / cancelled)
 *   TlScene.cancel(id)
 *   TlScene.status(force)             -> Promise {cutout: {methods, sam2, ai}, cv2} (kept 20 s)
 *   TlScene.busy(c, kind)             the job running for this clip (kind: cut | cam | fill), or null
 *   TlScene.range(c)                  [in, out] - the clip's source seconds
 * Pure (Node: scripts/test-scene515.js): range, pct.
 */
(function (root) {
  "use strict";
  function range(c) {
    var a = Math.max(0, +c.in || 0), b = c.out != null && +c.out > a ? +c.out : (+c.dur > a ? +c.dur : a + (+c.len || 5));
    return [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000];
  }
  function pct(p) { return Math.max(0, Math.min(100, Math.round((+p || 0) * 100))) + "%"; }
  var pure = { range: range, pct: pct };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var ST = null, STAT = 0, RUN = new Map();          // RUN: clip uid + kind -> {id, p, stage}
  function j(r) { return r.json().then(function (x) { if (!r.ok || x.error) throw new Error(x.error || r.status); return x; }); }
  function start(url, body) { return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then(j); }
  function watch(id, onProgress) {
    return new Promise(function (ok, no) {
      var tick = function () {
        fetch("/api/scene/job/" + encodeURIComponent(id)).then(j).then(function (s) {
          if (onProgress) { try { onProgress(s); } catch (e) { /* fine */ } }
          if (s.state === "done") return ok(s.result);
          if (s.state === "failed" || s.state === "cancelled") return no(new Error(s.state === "cancelled" ? "stopped" : (s.error || "failed")));
          setTimeout(tick, 700);
        }).catch(no);
      };
      tick();
    });
  }
  function cancel(id) { return fetch("/api/scene/job/" + encodeURIComponent(id) + "/cancel", { method: "POST" }).then(j).catch(function () { return null; }); }
  function status(force) {
    if (ST && !force && Date.now() - STAT < 20000) return Promise.resolve(ST);
    return fetch("/api/scene/status").then(j).then(function (s) { ST = s; STAT = Date.now(); return s; }).catch(function () { return ST || { cutout: { methods: [], sam2: {} }, cv2: false }; });
  }
  var uid = function (c) { return c.uid || (c.uid = "u" + Math.random().toString(36).slice(2, 10)); };
  function busy(c, kind) { return RUN.get(uid(c) + ":" + kind) || null; }
  /** run a job for a clip: its progress kept (busy) and painted; -> Promise result */
  function run(c, kind, url, body, paint) {
    var key = uid(c) + ":" + kind, R = { id: "", p: 0, stage: "starting" };
    RUN.set(key, R); if (paint) paint();
    return start(url, body).then(function (x) { R.id = x.id; return watch(x.id, function (s) { R.p = s.p; R.stage = s.stage; if (paint) paint(); }); })
      .then(function (res) { RUN.delete(key); if (paint) paint(); return res; }, function (e) { RUN.delete(key); if (paint) paint(); throw e; });
  }
  function stop(c, kind) { var R = busy(c, kind); if (R && R.id) return cancel(R.id); return Promise.resolve(null); }
  root.TlScene = Object.assign({ start: start, watch: watch, cancel: cancel, status: status, busy: busy, run: run, stop: stop, uid: uid }, pure);
})(typeof window !== "undefined" ? window : globalThis);

/* bitGen Studio — static/remotestats.js (2.773.0): THE LEFT DOCKER'S SYSTEM STATS SHOW THE POD IN REMOTE MODE (window.H3RemoteStats).
 *
 * Tim (verbatim): "when in remote mode , show the remote gpus/ram/cpu/hdd stats in the left docker instead of the local stats"
 *   apply(s, charts, Bar)   called by static/index.html refreshStats with /api/stats: in remote mode (GET /api/pods/remote-stats,
 *                           asked every 4 s at most - lib/remoteStats.js) the CPU load, RAM and GPUs (load, temperature, VRAM)
 *                           are the POD's; its disks (/ = the container disk, /workspace) get bars under them; the System
 *                           heading says "System · ☁ <pod>". The queue, the progress bar and ⚡ since start stay this
 *                           computer's (its electricity). Back on Local the charts are this computer's again (started over -
 *                           the two are never drawn in one line).
 *   remote mode, no pod in use (or Serverless / OpenRouter): this computer's figures, the heading says why.
 * Pure (Node: scripts/test-remotestats773.js): merge, heading, diskRows.
 */
(function (root) {
  "use strict";
  function gb(b) { return (Math.round((+b || 0) / 1e8) / 10).toFixed(1); }
  /** /api/stats with the pod's figures in place of this computer's (pure); r = /api/pods/remote-stats */
  function merge(s, r) {
    var x = r && r.stats; if (!x) return s;
    var out = {}; for (var k in s) out[k] = s[k];
    out.cpu = x.cpu == null ? 0 : x.cpu; out.cpu_temp = null;
    out.ram_used = x.ram_used || 0; out.ram_total = x.ram_total || 1;
    out.gpus = (x.gpus || []).map(function (g) { return { name: g.name, util: g.util, temp: g.temp, mem_used: g.mem_used, mem_total: g.mem_total || 1 }; });
    // ⚡ since start stays this computer's; its GPU power / clock graphs are not drawn on the pod's GPUs
    if (s.power) { var p = {}; for (var q in s.power) p[q] = s.power[q]; p.gpus = []; p.cpu_mhz = null; p.cpu_power_w = null; out.power = p; }
    out.remote = { pod_id: r.remote.pod_id, name: r.remote.name, disks: x.disks || [] };
    return out;
  }
  /** the System heading (pure) -> {text, title}: short (one line - the docker's layout stays as it is), the why in its tooltip */
  function heading(r) {
    if (!r || !r.remote) return { text: "System", title: "" };
    if (r.remote.none) return { text: "System · this computer", title: "Remote mode - " + r.remote.none };
    if (r.remote.error) return { text: "System · this computer", title: "Remote mode - ☁ " + r.remote.name + " is not answering yet" };
    return { text: "System · ☁ " + r.remote.name, title: "the pod's figures (its Jupyter) - the queue, the progress and ⚡ since start are this computer's" };
  }
  /** the disk bars (pure) -> [{label, pct, text, title}] */
  function diskRows(disks) {
    return (disks || []).filter(function (d) { return d.total > 0; }).map(function (d) {
      return { label: d.path === "/" ? "Disk /" : "Disk " + d.path, pct: 100 * d.used / d.total, text: gb(d.used) + "/" + gb(d.total) + "GB",
        title: d.path === "/" ? "the pod's container disk (wiped when the pod stops)" : d.path + " (kept while the pod is stopped)" };
    });
  }
  var api = { merge: merge, heading: heading, diskRows: diskRows };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  var doc = root.document, S = { src: "local", r: null, at: 0, busy: null, disks: {}, head: "System" };
  function get() {
    if (S.busy) return S.busy;
    if (S.r && Date.now() - S.at < +(root.H3_REMOTE_STATS_POLL || 4000)) return Promise.resolve(S.r);
    S.busy = root.fetch("/api/pods/remote-stats").then(function (x) { return x.json(); }).catch(function () { return { remote: null }; })
      .then(function (r) { S.r = r; S.at = Date.now(); S.busy = null; return r; });
    return S.busy;
  }
  function head() { var st = doc.getElementById("stats"), h = st && st.previousElementSibling; return h && h.tagName === "H2" ? h : null; }
  /** the charts started over when the figures change from this computer to the pod (or back, or another pod) */
  function reset(charts) {
    [charts.cpuLoad, charts.cpuTemp, charts.ram].forEach(function (c) { if (c && c.series) { c.series = [[], []]; if (c.draw) try { c.draw(); } catch (e) { /* fine */ } } });
    (charts.gpus || []).forEach(function (g) { var f = g && g.load && g.load.el && g.load.el.parentNode; if (f && f.parentNode) f.parentNode.removeChild(f); });
    charts.gpus.length = 0;
    var box = doc.getElementById("statsDisks"); if (box) box.parentNode.removeChild(box);
    S.disks = {};
  }
  function paintDisks(rows, Bar) {
    var st = doc.getElementById("stats"); if (!st || !Bar) return;
    var box = doc.getElementById("statsDisks");
    if (!box) { box = doc.createElement("div"); box.id = "statsDisks"; box.className = "gpuframe"; box.innerHTML = '<div class="gtitle"><span>☁ Disks</span><b></b></div>';
      var ram = st.querySelector(".stat.wide"); if (ram && ram.nextSibling) st.insertBefore(box, ram.nextSibling); else st.appendChild(box); }
    rows.forEach(function (d) {
      var b = S.disks[d.label]; if (!b) { b = S.disks[d.label] = new Bar(d.label); b.el.title = d.title; box.appendChild(b.el); }
      b.push(d.pct, null, d.text);
    });
  }
  /** /api/stats -> what the left docker draws (the pod's in remote mode) */
  function apply(s, charts, Bar) {
    return get().then(function (r) {
      var src = r && r.remote && r.stats ? "pod:" + r.remote.pod_id : "local";
      if (src !== S.src) { reset(charts); S.src = src; }
      // written only when it changes (the language dropdown translates what is there - it is not put back to English each time)
      var h = head(); if (h) { var t = heading(r); if (S.head !== t.text) { S.head = t.text; h.textContent = t.text; } h.title = t.title;
        if (!h.dataset.rsOne) { h.dataset.rsOne = "1"; h.style.whiteSpace = "nowrap"; h.style.overflow = "hidden"; h.style.textOverflow = "ellipsis"; } }
      if (src === "local") return s;
      paintDisks(diskRows(r.stats.disks), Bar);
      return merge(s, r);
    });
  }
  root.H3RemoteStats = Object.assign({ apply: apply, state: function () { return S; } }, api);
})(typeof window !== "undefined" ? window : globalThis);

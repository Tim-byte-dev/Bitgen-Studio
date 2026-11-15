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
 * 2.783.0 (Tim: "when using a pod show pod stats, if using pod + local show all the stats of hardware being used including
 *   remote"): mixed (r.remote.mixed - Both, or one type still Local) = this computer's charts stay and the pod's figures come
 *   under them in their own "☁ <pod>" frame (CPU, RAM, each GPU's load / temperature / VRAM, the disks) - podRows().
 * Pure (Node: scripts/test-remotestats773.js, test-system783.js): merge, heading, diskRows, podRows.
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
    if (r.remote.mixed) return { text: "System", title: "this computer's figures, then ☁ " + r.remote.name + "'s - some work runs here, some on the pod" };
    return { text: "System · ☁ " + r.remote.name, title: "the pod's figures (its Jupyter) - the queue, the progress and ⚡ since start are this computer's" };
  }
  /** the disk bars (pure) -> [{label, pct, text, title}] */
  function diskRows(disks) {
    return (disks || []).filter(function (d) { return d.total > 0; }).map(function (d) {
      return { label: d.path === "/" ? "Disk /" : "Disk " + d.path, pct: 100 * d.used / d.total, text: gb(d.used) + "/" + gb(d.total) + "GB",
        title: d.path === "/" ? "the pod's container disk (wiped when the pod stops)" : d.path + " (kept while the pod is stopped)" };
    });
  }
  /** 2.783.0: the pod's figures as bar rows for its own frame in mixed mode (pure) -> [{label, pct, text, title}] */
  function podRows(x) {
    var o = x || {}, rows = [];
    if (o.cpu != null) rows.push({ label: "CPU", pct: +o.cpu || 0, text: (+o.cpu || 0) + "%", title: "the pod's CPU load" });
    if (o.ram_total) rows.push({ label: "RAM", pct: 100 * (o.ram_used || 0) / o.ram_total, text: ((o.ram_used || 0) / 1024).toFixed(1) + "/" + (o.ram_total / 1024).toFixed(0) + "GB", title: "the pod's RAM" });
    (o.gpus || []).forEach(function (g, i) {
      var nm = "GPU" + i + " · " + String(g.name || "GPU").replace(/NVIDIA |GeForce (RTX )?/g, "").trim();
      rows.push({ label: nm, pct: g.util == null ? 0 : +g.util, text: (g.util == null ? "n/a" : g.util + "%") + (g.temp == null ? "" : " · " + g.temp + "°C"), title: "the pod's " + (g.name || "GPU") + " - load and temperature" });
      if (g.mem_total) rows.push({ label: "GPU" + i + " VRAM", pct: 100 * (g.mem_used || 0) / g.mem_total, text: ((g.mem_used || 0) / 1024).toFixed(1) + "/" + (g.mem_total / 1024).toFixed(0) + "GB", title: "the pod's GPU memory" });
    });
    return rows.concat(diskRows(o.disks));
  }
  var api = { merge: merge, heading: heading, diskRows: diskRows, podRows: podRows };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  var doc = root.document, S = { src: "local", r: null, at: 0, busy: null, disks: {}, pod: {}, head: "System" };
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
    var pb = doc.getElementById("statsPod"); if (pb) pb.parentNode.removeChild(pb);
    S.disks = {}; S.pod = {};
  }
  /** 2.783.0: mixed - the pod's frame under this computer's charts */
  function paintPod(r, Bar) {
    var st = doc.getElementById("stats"); if (!st || !Bar) return;
    var box = doc.getElementById("statsPod");
    if (!box) { box = doc.createElement("div"); box.id = "statsPod"; box.className = "gpuframe"; box.innerHTML = '<div class="gtitle"><span></span><b></b></div>'; }
    st.appendChild(box);   // kept last (this computer's GPU frames are added as they are found)
    box.querySelector(".gtitle span").textContent = "☁ " + r.remote.name;
    box.title = "the pod's figures (its Jupyter)";
    var seen = {};
    podRows(r.stats).forEach(function (d) {
      seen[d.label] = 1;
      var b = S.pod[d.label]; if (!b) { b = S.pod[d.label] = new Bar(d.label); box.appendChild(b.el); }
      b.el.title = d.title; b.push(d.pct, null, d.text);
    });
    Object.keys(S.pod).forEach(function (k) { if (!seen[k]) { var e = S.pod[k].el; if (e.parentNode) e.parentNode.removeChild(e); delete S.pod[k]; } });
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
      var src = r && r.remote && r.stats ? (r.remote.mixed ? "mixed:" : "pod:") + r.remote.pod_id : "local";
      if (src !== S.src) { reset(charts); S.src = src; }
      // written only when it changes (the language dropdown translates what is there - it is not put back to English each time)
      var h = head(); if (h) { var t = heading(r); if (S.head !== t.text) { S.head = t.text; h.textContent = t.text; } h.title = t.title;
        if (!h.dataset.rsOne) { h.dataset.rsOne = "1"; h.style.whiteSpace = "nowrap"; h.style.overflow = "hidden"; h.style.textOverflow = "ellipsis"; } }
      if (src === "local") return s;
      if (r.remote.mixed) { paintPod(r, Bar); return s; }   // 2.783.0: this computer's charts as they are + the pod's frame
      paintDisks(diskRows(r.stats.disks), Bar);
      return merge(s, r);
    });
  }
  root.H3RemoteStats = Object.assign({ apply: apply, state: function () { return S; } }, api);
})(typeof window !== "undefined" ? window : globalThis);

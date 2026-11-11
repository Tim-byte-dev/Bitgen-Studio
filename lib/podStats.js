// bitGen Studio — lib/podStats.js (2.763.4): WHAT A RUNNING POD IS DOING - GPU load, GPU memory, RAM, CPU and disks.
// Tim (verbatim): "in the pods docker show utilization, memory and disk visualizations and usage"
//   stats(pod, port) -> {at, gpus: [{name, util, mem_used, mem_total}], ram: {used, total}, cpu: {load, cores},
//                        disks: [{path, used, total}], how: "jupyter" | "comfy", error?}   (bytes; util / load in %)
//   The pod's own Jupyter runs one short Python (nvidia-smi, /proc/meminfo, the load average, disk_usage of / and /workspace)
//   - the kernel is shut down after it (lib/podModels.js runKernel); without Jupyter, its ComfyUI's /system_stats gives the
//   RAM and the GPU memory (no load, no disks). Kept 4 s per pod, so a docker asking often costs the pod nothing much.
// Pure (scripts/test-podstats7634.js): parse, fromComfy, CODE.
"use strict";
const CODE = [
  "import json, os, shutil, subprocess",
  "o = {'gpus': [], 'disks': []}",
  "try:",
  "    q = subprocess.run(['nvidia-smi', '--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=10).stdout",
  "    for l in q.strip().splitlines():",
  "        p = [x.strip() for x in l.split(',')]",
  "        if len(p) >= 4: o['gpus'].append({'name': p[0], 'util': float(p[1] or 0), 'mem_used': float(p[2] or 0) * 1048576, 'mem_total': float(p[3] or 0) * 1048576})",
  "except Exception: pass",
  "try:",
  "    m = {}",
  "    for l in open('/proc/meminfo'):",
  "        k, v = l.split(':', 1); m[k] = int(v.strip().split()[0]) * 1024",
  "    o['ram'] = {'total': m.get('MemTotal', 0), 'used': m.get('MemTotal', 0) - m.get('MemAvailable', 0)}",
  "except Exception: pass",
  "try: o['cpu'] = {'load': os.getloadavg()[0], 'cores': os.cpu_count() or 1}",
  "except Exception: pass",
  "for d in ('/', '/workspace'):",
  "    try:",
  "        u = shutil.disk_usage(d); o['disks'].append({'path': d, 'used': u.used, 'total': u.total})",
  "    except Exception: pass",
  "print('bitgen-stats ' + json.dumps(o))",
].join("\n");
const num = (v) => (isFinite(+v) ? +v : 0);
/** the kernel's answer -> stats (pure); null when it said nothing usable */
function parse(said) {
  const m = /bitgen-stats (\{.*\})/.exec(String(said || ""));
  if (!m) return null;
  let o; try { o = JSON.parse(m[1]); } catch { return null; }
  const cpu = o.cpu ? { load: Math.round(Math.min(100, 100 * num(o.cpu.load) / Math.max(1, num(o.cpu.cores))) ), cores: num(o.cpu.cores) } : null;
  return { gpus: (o.gpus || []).map((g) => ({ name: String(g.name || ""), util: Math.round(num(g.util)), mem_used: num(g.mem_used), mem_total: num(g.mem_total) })),
    ram: o.ram ? { used: num(o.ram.used), total: num(o.ram.total) } : null, cpu, disks: (o.disks || []).map((d) => ({ path: String(d.path), used: num(d.used), total: num(d.total) })), how: "jupyter" };
}
/** ComfyUI's /system_stats -> stats (pure): RAM + each GPU's memory (no load, no disks) */
function fromComfy(j) {
  const s = (j && j.system) || {}, devs = (j && j.devices) || [];
  return { gpus: devs.filter((d) => d && d.type !== "cpu").map((d) => ({ name: String(d.name || "").replace(/^cuda:\d+\s*/, "").replace(/\s*:\s*\w+$/, ""), util: null, mem_used: num(d.vram_total) - num(d.vram_free), mem_total: num(d.vram_total) })),
    ram: s.ram_total ? { used: num(s.ram_total) - num(s.ram_free), total: num(s.ram_total) } : null, cpu: null, disks: [], how: "comfy" };
}

/* ---------------- live */
const CACHE = {}, BUSY = {};
async function stats(id, port) {
  const pod = String(id || "").replace(/[^A-Za-z0-9]/g, "");
  const c = CACHE[pod];
  if (c && Date.now() - c.at < 4000) return c;
  if (BUSY[pod]) return BUSY[pod];
  const PM = require("./podModels");
  const run = (async () => {
    let out = null;
    try {
      const pw = PM.jupyterOf(pod);
      if (pw) out = parse(await PM.runKernel(require("./runpodApi").proxyUrl(pod, 8888), pw, CODE));
    } catch { out = null; }
    if (!out) {
      try { const r = await PM.hit(require("./runpodApi").proxyUrl(pod, +port || 8188) + "/system_stats", { ms: 10000 }); if (r.status === 200) out = fromComfy(r.j); } catch { out = null; }
    }
    const res = Object.assign(out || { gpus: [], ram: null, cpu: null, disks: [], how: "", error: "the pod is not answering yet" }, { at: Date.now() });
    CACHE[pod] = res;
    return res;
  })();
  BUSY[pod] = run;
  try { return await run; } finally { delete BUSY[pod]; }
}
module.exports = { CODE, parse, fromComfy, stats };

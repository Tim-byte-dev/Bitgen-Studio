#!/usr/bin/env node
/* bitGen Studio — 3.5.0: π pi-H3 (MiniMax H3 in 2 or 4 steps) - the add-on you tick, the styles, the box that asks.
 * (The graphs + scripts/pih3.py: scripts/test-pih3-3500.py.)
 * Tim: "can u add https://hanshengchen.com/blog/pi-h3/ , when asking the user to download, let user choose which model to dl" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PA = require(path.join(ROOT, "lib/pih3Addon.js")), Models = require(path.join(ROOT, "lib/setupModels.js"));

(async () => {
  const cat = JSON.parse(src("lib/modelCatalog.json")), by = (id) => cat.models.find((m) => m.id === id);
  check("catalog: the four DWD adapters from Lakonik/pi-H3 into models/loras (bf16 saved under its own name)",
    by("pih3_dwd2").repo === "Lakonik/pi-H3" && by("pih3_dwd2").file === "pi_h3_2step_dwd_adapter_int8_convrot.safetensors" && by("pih3_dwd4").dest === "comfy/loras"
    && by("pih3_dwd4_bf16").file === "pi_h3_4step_dwd_adapter/diffusion_pytorch_model.safetensors" && by("pih3_dwd4_bf16").as === "pi_h3_4step_dwd_adapter.safetensors");
  check("wanted: what you tick + what is always needed (nodes, H3's model, encoder, VAEs); default = the 2-step int8",
    PA.wanted([]).join() === "nodes,dwd2,base,te,vae" && PA.wanted(["dwd4", "kjsol"]).join() === "nodes,dwd4,kjsol,base,te,vae" && PA.wanted(["dwd2_bf16"]).join() === "nodes,dwd2_bf16,base,te,vae");
  check("haveOf: a step count is there with its int8 OR bf16 adapter", JSON.stringify(PA.haveOf({ dwd2_bf16: true })) === '{"dwd2":true,"dwd4":false}' && JSON.stringify(PA.haveOf({ dwd4: true })) === '{"dwd2":false,"dwd4":true}');
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "pih3_"));
  try {
    const pl = { ok: true, customNodes: path.join(t, "custom_nodes"), models: path.join(t, "models"), python: "" };
    fs.mkdirSync(pl.customNodes, { recursive: true });
    const put = (id) => { const p = Models.destPath(Models.byId(id), { comfyModels: pl.models, app: ROOT }); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "x"); };
    let s = PA.status(pl);
    check("status: not installed; every item listed with its size", !s.installed && s.items.length === PA.ITEMS.length && s.items.find((i) => i.id === "dwd2").size === "2.2 GB" && s.note === "not installed", s);
    const r0 = await PA.install(() => {}, ["kjsol"], { place: pl, git: "", fetchRepo: async () => ({ ok: true }), download: async () => ({ ok: true }) });
    check("install with no adapter ticked: refused in words", !r0.ok && /tick an adapter/.test(r0.error), r0);
    const got = [], L = [];
    const r = await PA.install((l) => L.push(l), ["dwd4"], { place: pl, git: "", base: ROOT, styles: () => ["pi-H3 (2 steps)"],
      fetchRepo: async (url, dir) => { got.push(url); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "lakonlab_loaders.py"), ""); return { ok: true }; },
      download: async (m) => { got.push(m.id); put(m.id); return { ok: true }; } });
    check("install (4 steps ticked): ComfyUI-piFlow, then ONLY the 4-step adapter + H3's model / encoder / VAEs - not the 2-step one; the licence said",
      r.ok && got.join() === "https://github.com/Lakonik/ComfyUI-piFlow,pih3_dwd4,h3_fl2va,h3_te,h3_vvae,h3_avae" && L.some((l) => /MiniMax H3 Community License/.test(l)), { r, got });
    s = PA.status(pl);
    check("status: installed with 4 steps, not 2", s.installed && s.have.dwd4 && !s.have.dwd2 && /ready: 4 steps/.test(s.note), s);
    await PA.remove(() => {}, pl);
    check("remove: the nodes + adapters go, H3's shared files stay", !fs.existsSync(path.join(pl.customNodes, "ComfyUI-piFlow")) && !PA.status(pl).have.dwd4 && PA.status(pl).items.find((i) => i.id === "base").present);
  } finally { fs.rmSync(t, { recursive: true, force: true }); }

  const A = require(path.join(ROOT, "lib/addons.js")), ad = A.list().find((a) => a.id === "pih3");
  check("Settings ▸ Add-ons ▸ π pi-H3: listed with its items to tick", ad && /pi-H3/.test(ad.label) && ad.items.length === PA.ITEMS.length && /Community License/.test(ad.needs));
  const S = require(path.join(ROOT, "lib/styles.js"));
  const sts = S.STARTER_STYLES.filter((x) => /^pi-H3/.test(x.name));
  check("styles: pi-H3 (2 steps) / (4 steps) - MiniMax H3 video styles on the shipped graphs", sts.length === 2 && sts.every((x) => x.kind === "video" && x.arch === "minimax-h3")
    && sts[0].workflow === "comfy_workflows/pi_h3_dwd_2step.json" && sts[1].workflow === "comfy_workflows/pi_h3_dwd_4step.json" && sts.every((x) => fs.existsSync(path.join(ROOT, x.workflow))));
  const Packs = require(path.join(ROOT, "lib/setupPacks.js"));
  check("node pack: ComfyUI-piFlow provides the pi-H3 nodes", Packs.packFor("Load LakonLab Adapter") && Packs.packFor("DWD Decode").url === "https://github.com/Lakonik/ComfyUI-piFlow" && Packs.packFor("pi-Flow Scheduler").id === "piflow");
  check("GET /api/pih3 (routes/pih3.js, mounted from routes/index.js)", /app\.get\("\/api\/pih3"/.test(src("routes/pih3.js")) && /require\("\.\/pih3"\)\.mount\(app\)/.test(src("routes/index.js")));
  const G = require(path.join(ROOT, "static/pih3gen.js"));
  check("page (pure): a pi-H3 style is known by its graph / name, its steps, ready only with THAT step's adapter",
    G.isPi({ workflow: "comfy_workflows/pi_h3_dwd_4step.json" }) && G.isPi({ name: "pi-H3 (2 steps)" }) && !G.isPi({ name: "MiniMax H3" })
    && G.stepsOf({ workflow: "comfy_workflows/pi_h3_dwd_4step.json" }) === 4 && G.stepsOf({ name: "pi-H3 (2 steps)" }) === 2
    && G.readyFor({ installed: true, have: { dwd2: true } }, 2) && !G.readyFor({ installed: true, have: { dwd2: true } }, 4) && !G.readyFor({ installed: false, have: { dwd4: true } }, 4));
  const ni = src("static/needinstall.js"), html = src("static/index.html"), gen = src("static/pih3gen.js");
  check("the box lets you choose: needinstall's pih3 part (choose) lists the add-on's items as ticks, sends the ticked ones",
    /pih3: \{ name: "pi-H3/.test(ni) && /addon: "pih3", choose: true/.test(ni) && /function picker\(P, opts\)/.test(ni) && /items: pick \? pick\.items : null/.test(ni)
    && /var items = ui && ui\.items \? ui\.items\(\) : P\.items;/.test(ni) && /function pickedOf\(items, pick\)/.test(ni));
  check("…opened before a pi-H3 render (submitJob), this style's adapter ticked first; the hint beside the style",
    /if \(window\.H3PiH3 && H3PiH3\.style\(\) && !\(await H3PiH3\.ensure\(\)\)\) return null;/.test(html) && /<script src="\/static\/pih3gen\.js"><\/script>/.test(html)
    && /pick: \["dwd" \+ n\], ready: function \(j\) \{ return readyFor\(j, n\); \}/.test(gen) && /H3PiH3\.paint\(\)/.test(html));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

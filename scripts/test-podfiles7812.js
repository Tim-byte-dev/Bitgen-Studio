#!/usr/bin/env node
/* bitGen Studio — 2.781.2: A POD'S MODEL FILES LISTED AND DELETED (lib/podFiles.js, routes/podFiles.js, static/podfiles.js) and
 * HOW ITS COMFYUI USES THE CARD (lib/podVram.js: the models kept on the card - --disable-dynamic-vram on 24 GB+ when that
 * ComfyUI knows it; ⟳ Apply restarts it that way); ComfyUI's own time + model-loading lines in the render's log
 * (scripts/comfy_client.py load_report). The Python itself runs in test-podfiles7812-py.js (gate).
 * Tim (verbatim): "add model files available on pod, allow user to delete model files from pod" + "I think comfy is not using
 * vram thats why the renders are so slow" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "pf7812-")); process.env.H3_REMOTE_MODELS = path.join(TMP, "remote_models.json");
const PF = require("../lib/podFiles"), PV = require("../lib/podVram"), PG = require("../static/podfiles.js");

(async () => {
  check("cleanPaths: inside models only - no absolute, no .., no hidden parts, a folder + a name, once each",
    JSON.stringify(PF.cleanPaths(["loras/a.safetensors", "/etc/passwd", "../x/y.safetensors", "loras/../../z.bin", "checkpoints/.cache/q.gguf", "a.safetensors", "loras/a.safetensors", "checkpoints\\Krea2\\k.gguf", "loras/x\u0000.bin"]))
    === JSON.stringify(["loras/a.safetensors", "checkpoints/Krea2/k.gguf"]), PF.cleanPaths(["loras/a.safetensors", "checkpoints\\Krea2\\k.gguf"]));
  const sh = PF.shape({ files: [{ path: "checkpoints/krea2.safetensors", size: 17.8e9 }, { path: "loras/flux krea/B.safetensors", size: 229e6 }, { path: "diffusion_models/k.safetensors", size: 17.8e9, link: true, target: "/workspace/x" }], disk: { total: 54e9, used: 43e9, free: 11e9 } });
  check("shape: folder + name from the path, a link counts no room in the total", sh.files[1].folder === "loras/flux krea" && sh.files[1].name === "B.safetensors" && sh.total === 17.8e9 + 229e6 && sh.files[2].link, sh);
  // list / remove through stand-in deps (the pod's Python answer)
  const asked = [];
  PF.setDeps({ ways: async () => ({ pod_id: "p1", jupyter: true, comfy_dir: "/workspace/ComfyUI", jupyter_url: "x" }),
    kernel: async (w, code) => { asked.push(code); return /bitgen-deleted/.test(code) ? 'bitgen-deleted {"deleted": ["checkpoints/krea2.safetensors"], "failed": [{"path": "loras/gone.bin", "why": "not on the pod"}], "disk": {"total": 54, "used": 25, "free": 29}}'
      : 'bitgen-files {"files": [{"path": "checkpoints/krea2.safetensors", "size": 5}], "disk": null}'; } });
  const L = await PF.list("p1", {});
  check("list: the pod's Python walks <ComfyUI>/models and answers its files + disk", L.files.length === 1 && L.comfy_dir === "/workspace/ComfyUI" && /os\.walk\(root\)/.test(asked[0]) && /\/workspace\/ComfyUI/.test(asked[0]), L);
  fs.writeFileSync(process.env.H3_REMOTE_MODELS, JSON.stringify({ v: 1, models: [{ id: "m1", label: "Krea", folder: "checkpoints", name: "krea2.safetensors", url: "https://civitai.com/api/download/models/1", pods: { p1: "done", p2: "done" } }] }));
  const R = await PF.remove("p1", { paths: ["checkpoints/krea2.safetensors", "../../etc/x", "loras/gone.bin"] });
  check("remove: only safe paths go to the pod; deleted + failed said", /"checkpoints\/krea2.safetensors", "loras\/gone.bin"|\["checkpoints\/krea2\.safetensors","loras\/gone\.bin"\]/.test(asked[1]) && !/etc/.test(asked[1]) && R.deleted.length === 1 && R.failed[0].why === "not on the pod", { R, code: asked[1].slice(0, 300) });
  const RM = JSON.parse(fs.readFileSync(process.env.H3_REMOTE_MODELS, "utf8")).models[0];
  check("…bitGen forgets it for THAT pod (remote_models.json) - the other pod keeps it", !RM.pods.p1 && RM.pods.p2 === "done", RM.pods);
  let threw = ""; try { await PF.remove("p1", { paths: ["/abs"] }); } catch (e) { threw = e.message; }
  check("…nothing safe to delete = refused before the pod is asked", /pick the files/.test(threw));
  PF.setDeps({ ways: async () => ({ pod_id: "p1", jupyter: false }) });
  threw = ""; try { await PF.list("p1", {}); } catch (e) { threw = e.message + e.status; }
  check("a pod whose Jupyter does not answer: said (409)", /Jupyter does not answer/.test(threw) && /409$/.test(threw));
  PF.setDeps(null);
  check("the delete code checks the real folder on the pod too (a link's folder outside models refused) and deletes a link, never its target",
    /os\.path\.realpath\(os\.path\.dirname\(p\)\)\.startswith\(root \+ os\.sep\)/.test(PF.DEL_PY("/c", ["a/b"])) && /os\.remove\(p\)/.test(PF.DEL_PY("/c", ["a/b"])) && !/rmtree/.test(PF.DEL_PY("/c", ["a/b"])));

  // GPU memory
  check("podVram: the models kept on the card by default; dynamic on request; anything else = the default", PV.modeOf({}) === "gpu" && PV.modeOf({ rgpu: { pod_vram: "dynamic" } }) === "dynamic" && PV.modeOf({ rgpu: { pod_vram: "x" } }) === "gpu");
  const py = PV.PY.join("\n");
  check("…--disable-dynamic-vram only on a card of 24 GB+ and only when that ComfyUI's cli_args.py knows it (an unknown flag stops ComfyUI)",
    /_gpu_gb\(\) < 24/.test(py) && /_knows\(comfy_dir, '--disable-dynamic-vram'\)/.test(py) && /cli_args\.py/.test(py) && /nvidia-smi/.test(py));
  const IC = require("../lib/podInstall").installCode({ dir: "/x", vram: "gpu" }), UC = require("../lib/podComfyUpdate").updateCode("/x", 8188);
  check("a ComfyUI bitGen installs / starts on a pod gets those arguments (podInstall + podComfyUpdate)", /'--port', str\(J\['port'\]\)\] \+ xa/.test(IC) && /\\"vram\\":\\"gpu\\"/.test(IC) && /def comfy_extra/.test(IC) && /\] \+ comfy_extra\(c, J\.get\('vram', 'gpu'\)\)/.test(UC) && /def comfy_extra/.test(UC));
  const AC = PV.applyCode("/x", 8188, "gpu");
  check("⟳ Apply: the running ComfyUI's own command kept, the mode's flag added / taken away, restarted only when it changes; ComfyUI as the pod's first process is not stopped",
    /keep = \[a for a in argv if a not in \["--disable-dynamic-vram"\]\]/.test(AC) && /if new == argv and not FORCE: out\(\{'ok': True, 'same': True/.test(AC) && /elif pid == 1/.test(AC) && /subprocess\.Popen\(new, cwd=cwd, env=env/.test(AC));
  // the page
  check("page: sizes, files by folder (a link counts no room), the picked ones", PG.gb(17.8e9) === "17.8 GB" && PG.gb(229e6) === "229 MB" && PG.groups(sh.files).map((g) => g.folder).join("|") === "checkpoints|diffusion_models|loras/flux krea"
    && PG.groups(sh.files)[1].size === 0 && JSON.stringify(PG.picked(sh.files, { "loras/flux krea/B.safetensors": true, "x": true })) === JSON.stringify({ n: 1, size: 229e6, paths: ["loras/flux krea/B.safetensors"] }));
  check("…the GPU memory line", /stay on the card/.test(PG.vramLine("gpu")) && /RAM/.test(PG.vramLine("dynamic")) && /⏳ restarting/.test(PG.vramLine("gpu", { running: true, note: "restarting ComfyUI" })));
  const PD = rd("static/podsdock.js"), IX = rd("static/index.html"), RI = rd("routes/index.js");
  check("PODS ▸ My pods: 📁 Files on a running pod (beside ⬇ Models) opens the list; the script loaded; the routes mounted (not in server.js)",
    /data-pdfiles[^>]*>📁 Files/.test(PD) && /H3PodFiles\.open\(host, p/.test(PD) && /<script src="\/static\/podfiles\.js">/.test(IX) && /require\("\.\/podFiles"\)\.mount\(app\)/.test(RI) && !/podFiles/.test(rd("misc/server.js")));
  const CC = rd("scripts/comfy_client.py"), WK = rd("misc/worker.py");
  check("the render's log: ComfyUI's own time + its model-loading lines (picture and video workers)",
    /def load_report\(base, hist=None, say=print\)/.test(CC) && /ComfyUI ran it in/.test(CC) && /internal\/logs\/raw/.test(CC) && /load_report\(base, hist\)/.test(CC) && /mark_log\(base\)/.test(CC) && /_cc\.load_report\(base, hist, say=say\)/.test(WK) && /_cc\.mark_log\(base\)/.test(WK));
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

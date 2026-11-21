// bitGen Studio — lib/podImage.js (2.900.0): THE BITGEN POD TEMPLATE - RunPod's PyTorch image with ComfyUI, its Python
// environment, ComfyUI-Manager and the node packs bitGen's styles use most already installed (misc/pod-image, built and
// published by GitHub as ghcr.io/tim-byte-dev/bitgen-pod - .github/workflows/pod-image.yml). A new pod made from it is ready
// in a few minutes: bitGen's install job (lib/podInstall.js) finds every step done ("already there") and only starts ComfyUI.
//
// Tim: "is it possible to create a community template for bitgen-studio in runpod?" -> "yes please"
//
// The template is found by its IMAGE (anyone may make a template from the image - each is fine), first of:
//   1. config rgpu.bitgen_template   a template id set by hand (PODS ▸ the template to use)
//   2. TEMPLATE_ID                   the public "bitGen Studio pod" template Tim published on RunPod
//   3. the RunPod account's own templates (GET /templates) - a template made from the image there
//   4. RunPod's public template lists (community) - when it shows there
//   5. 2.901.0 (Tim: "can we use this template as our template in bitgen instead of the current one - 3 minute startup is
//      much better"): none of those = the IMAGE itself, no template (RunPod v2 creates a pod from `image` when no templateId is
//      sent) - so every bitGen user gets the 3-minute pod. A template is still preferred when there is one (Tim's public
//      template earns him RunPod's creator credits). config rgpu.bitgen_image = false = the old way: RunPod's PyTorch
//      template, bitGen installing ComfyUI on it (lib/pods.js bitgenTemplate).
// A pod from it is made like a blank one (install: true - bitGen's install job, the pod's 8188 port, a CUDA 12.8 host).
//
// Pure (scripts/test-900.js, test-901.js): IMAGE_RE, isOurs, view, imageView, pick.
"use strict";

const IMAGE = "ghcr.io/tim-byte-dev/bitgen-pod";
const IMAGE_RE = /^(ghcr\.io\/)?tim-byte-dev\/bitgen-pod(?=[:@]|$)/i;
/** the public RunPod template made from the image ("" until it is published - then the id from its runpod.io page) */
const TEMPLATE_ID = "";
const CUDA = "12.8";   // misc/pod-image/bases.txt: RunPod's CUDA 12.8 PyTorch images
const PORTS = ["8188/http", "8888/http", "22/tcp"];

const imageOf = (t) => String((t && (t.image || t.imageName || (t.template || {}).imageName)) || "");
/** a template made from the bitGen pod image? (pure) */
function isOurs(t) { return !!t && IMAGE_RE.test(imageOf(t).trim()); }
/** a template -> what lib/pods.js makes a pod from (pure) {id, name, image, ports, disk, comfy, install, cuda, ours, source} */
function view(t, source) {
  const ps = Array.isArray(t.ports) ? t.ports.map(String) : String(t.ports || "").split(",").map((s) => s.trim()).filter(Boolean);
  return { id: String(t.id || ""), name: String(t.name || "bitGen Studio pod"), image: imageOf(t), ports: [...new Set(ps.concat(PORTS))],
    disk: Math.max(+t.disk || +t.containerDiskInGb || 0, 50), comfy: false, install: true, cuda: CUDA, ours: true, source: source || "" };
}
/** the bitGen pod made from the image alone, no template (pure) */
function imageView() { return Object.assign(view({ id: "", name: "bitGen Studio pod", image: IMAGE + ":latest" }, "image"), { id: "" }); }
/** which one (pure): the id set by hand, the published one, the account's own, a public one - each only when it is ours */
function pick(o) {
  const x = o || {}, want = [String(x.configured || ""), String(x.published || TEMPLATE_ID)].filter(Boolean);
  const all = [].concat((x.byId || []).map((t) => [t, "set"]), (x.own || []).map((t) => [t, "own"]), (x.catalog || []).map((t) => [t, String(t.source || "public")]));
  for (const id of want) { const f = all.find(([t]) => t && String(t.id) === id && isOurs(t)); if (f) return view(f[0], f[1]); }
  const own = all.find(([t, s]) => s === "own" && isOurs(t)); if (own) return view(own[0], "own");
  const pub = all.find(([t, s]) => s !== "set" && s !== "own" && isOurs(t)); if (pub) return view(pub[0], pub[1]);
  return null;
}

/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
const key = () => String((rg().runpod || {}).key || "").trim();
let CACHE = null;
/** the bitGen pod template, or null (RunPod's lists cached 10 minutes; any call that fails is passed over) */
async function find(o) {
  const opt = o || {};
  if (CACHE && Date.now() - CACHE.at < 600000 && !opt.refresh) return CACHE.v;
  const A = require("./runpodApi"), k = key(), configured = String(rg().bitgen_template || "").trim();
  const ids = [...new Set([configured, TEMPLATE_ID].filter(Boolean))];
  const [byId, own, cat] = await Promise.all([
    Promise.all(ids.map((id) => A.template(id, k, { timeout: 15000 }).then((t) => (t ? Object.assign({ id }, t) : null)).catch(() => null))).then((l) => l.filter(Boolean)),
    k ? A.myTemplates(k, { timeout: 15000 }).catch(() => []) : [],
    require("./pods").templates({}).then((r) => r.templates || []).catch(() => []),
  ]);
  const v = pick({ configured, byId, own, catalog: cat }) || (rg().bitgen_image === false ? null : imageView());
  CACHE = { at: Date.now(), v };
  return v;
}
function forget() { CACHE = null; }

module.exports = { IMAGE, IMAGE_RE, TEMPLATE_ID, CUDA, PORTS, isOurs, view, imageView, pick, find, forget };

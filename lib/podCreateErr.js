/* bitGen Studio — lib/podCreateErr.js (2.779.0): WHY A POD COULD NOT BE CREATED, IN WORDS - FOR THE DIALOG.
 * Tim (verbatim): "when creating a pod, it asks me to create a template first...can you report the real error in a dialog so the
 * user can see that there is a problem. i suspect it is because the gpu i selected was busy".
 *   The "pick a template first" was bitGen's own check (lib/pods.js createBody): it took a template id as 4-20 letters and
 *   digits, and RunPod's own templates have ids like runpod-torch-v280 / tpl_abc - RunPod was never asked. That check now takes
 *   RunPod's ids; when RunPod refuses a pod, its own words come back (lib/runpodApi.js e.said / e.httpStatus) and are put here
 *   with what was asked for and what to do - a busy GPU said as busy.
 *   explain(err, body) -> {title, kind: busy | money | key | template | cuda | asked | other, said, status, hint, asked: [[k, v]]}
 * Pure (scripts/test-podcreate779.js).
 */
"use strict";

const KINDS = [
  ["busy", /no longer any instances|no instances|not enough (free )?(gpus?|machines|capacity)|insufficient capacity|out of capacity|no available|not available|unavailable|could not find any (pods|machines|hosts)|no (gpu|machine)s? (is |are )?(free|available)|sold out|capacity/i],
  ["money", /balance|insufficient funds|credits?|spend limit|payment|billing/i],
  ["key", /api key|unauthori[sz]ed|forbidden|refused the api key/i],
  ["template", /template/i],
  ["cuda", /cuda|driver/i],
];
function kindOf(text, status) {
  const t = String(text || "");
  if (status === 401 || status === 403) return "key";
  for (const [k, re] of KINDS) if (re.test(t)) return k;
  return "other";
}
/** what was asked of RunPod (pure) - rows for the dialog */
function askedOf(b) {
  const o = b || {}, g = o.gpu || {};
  const rows = [];
  if (o.templateId) rows.push(["Template", String(o.template_name || o.templateId)]);
  if (g.id || o.gpuName) rows.push(["GPU", (+g.count > 1 ? g.count + " × " : "") + String(o.gpuName || g.id)]);
  if (o.cloud) rows.push(["Cloud", o.cloud === "COMMUNITY" ? "Community" : "Secure"]);
  if (g.minCudaVersion) rows.push(["Host", "CUDA " + g.minCudaVersion + " or newer only"]);
  if (o.disk) rows.push(["Disks", (+o.disk || 0) + " GB container + " + (+(((o.mounts || {}).persistent || {}).size) || 0) + " GB /workspace"]);
  return rows;
}
function explain(err, body) {
  const e = err || {}, b = body || {}, g = b.gpu || {};
  const said = String(e.said || e.message || e || "").slice(0, 1200), status = +e.httpStatus || +e.status || 0;
  const kind = e.local ? (e.local === "template" ? "template" : "asked") : kindOf(said, e.httpStatus);
  const gpu = String(b.gpuName || g.id || "the GPU you picked"), cloud = b.cloud === "COMMUNITY" ? "Community" : "Secure";
  const H = {
    busy: { title: "The GPU you picked is busy", hint: `RunPod has no free ${gpu} on ${cloud} cloud right now${g.minCudaVersion ? " with CUDA " + g.minCudaVersion + " or newer" : ""}${+g.count > 1 ? " for " + g.count + " GPUs at once" : ""}. Pick another GPU (the list shows which are offered), try ${cloud === "Secure" ? "Community" : "Secure"} cloud, ask for fewer GPUs, or try again in a few minutes - nothing was charged.` },
    money: { title: "RunPod refused it: your balance", hint: "Your RunPod balance or spend limit does not cover this pod. Add credit on runpod.io (Billing) or raise the limit, then create it again - nothing was charged." },
    key: { title: "RunPod refused the API key", hint: "Pods need an \"All\" API key: runpod.io ▸ Settings ▸ API Keys, then paste it in Settings ▸ Remote generation ▸ RunPod." },
    template: { title: "RunPod did not take the template", hint: "A bitGen pod is made from RunPod's PyTorch template (bitGen installs ComfyUI on it). RunPod may have changed or removed it - press 🔄 in the PODS docker and try again; if it keeps failing, send a 🐞 bug report." },
    cuda: { title: "No machine with the CUDA this template needs", hint: `This template needs a host whose driver runs CUDA ${g.minCudaVersion || "of its image"} - none with ${gpu} has it free now. Pick another GPU (newer cards are on newer drivers) or try again later.` },
    asked: { title: "The pod could not be asked for", hint: "Something the pod needs was not filled in - see what RunPod would have been asked for below." },
    other: { title: "RunPod did not create the pod", hint: "RunPod's own answer is below. Nothing was charged. Try again, or pick another GPU / cloud." },
  }[kind];
  return { title: H.title, kind, said, status, hint: H.hint, asked: askedOf(b) };
}
module.exports = { explain, kindOf, askedOf };

/* bitGen Studio — routes/llmRepos.js (2.782.0): YOUR LLMs FROM HUGGING FACE FOR YOUR POD (lib/llmRepos.js) + which pod runs them
 * (rgpu.llm_pod) + how far the pod is (lib/podLlm.js).
 *   GET  /api/llmrepos                  -> {repos, pick, pods: [{id, name, status, gpu, volume_gb}], pod: {llm, vlm}, share, state}
 *   GET  /api/llmrepos/hf?repo=         -> the repo's GGUFs {repo, models: [{file, parts, size, quant}], mmprojs}
 *   POST /api/llmrepos/send             {kind, repo, file, parts, mmproj, size, mm_size, name, pod: "<id>" | "new"} -> sent: the
 *                                        pick made, the pod remembered, the pod set up (in the background) -> {entry, state}
 *                                        | pod "new" -> {entry, new_pod: true} (the page opens PODS ▸ Create pod)
 *   POST /api/llmrepos/save             {kind, repo, file, …, name} -> the saved entry (your list)
 *   POST /api/llmrepos/pick             {kind, id} -> a saved one picked; POST /api/llmrepos/remove {id}
 *   POST /api/llmrepos/share            {share: bool} - one pod: the card swapped between the LLMs and ComfyUI (default on)
 *   POST /api/llmrepos/grow             {pod, gb} -> RunPod makes the pod's volume that big
 */
"use strict";
function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  const LR = () => require("../lib/llmRepos"), PL = () => require("../lib/podLlm"), C = () => require("../lib/core");
  const rg = () => ((C().getConfig() || {}).rgpu) || {};
  const setRg = (fn) => { const c = C().getConfig(); c.rgpu = c.rgpu || {}; fn(c.rgpu); C().setConfig(c); };
  const kindOf = (k) => (k === "vlm" ? "vlm" : "llm");
  app.get("/api/llmrepos", wrap(async () => {
    let pods = [];
    try { pods = (await require("../lib/pods").mine()).pods.filter((p) => p.bitgen && !/TERMINATED/.test(p.status)).map((p) => ({ id: p.id, name: p.name, status: p.status, gpu: p.gpu, gpus: p.gpus })); } catch { pods = []; }
    const r = rg();
    return { repos: LR().list(), pick: r.llm_repo_pick || {}, picked: { llm: LR().picked("llm"), vlm: LR().picked("vlm") }, pods,
      pod: { llm: PL().podFor("llm"), vlm: PL().podFor("vlm") }, share: r.pod_share !== false, state: { llm: PL().view("llm"), vlm: PL().view("vlm") } };
  }));
  app.get("/api/llmrepos/state", wrap(() => ({ llm: PL().view("llm"), vlm: PL().view("vlm") })));
  app.get("/api/llmrepos/hf", wrap((req) => LR().hfFiles(String(req.query.repo || ""))));
  app.post("/api/llmrepos/send", wrap((req) => {
    const b = req.body || {}, k = kindOf(b.kind), e = LR().use(k, b), pod = String(b.pod || "");
    if (pod === "new") return { entry: e, new_pod: true };
    if (pod) {
      const id = pod.replace(/[^A-Za-z0-9]/g, "");
      setRg((r) => { r.llm_pod = Object.assign({}, r.llm_pod || {}, { [k]: { pod_id: id, pod_name: String(b.pod_name || "").slice(0, 80) } }); });
    }
    return { entry: e, state: PL().prepare(k, { force: true }) };
  }));
  app.post("/api/llmrepos/save", wrap((req) => { const b = req.body || {}; return { entry: LR().save(kindOf(b.kind), b) }; }));
  app.post("/api/llmrepos/pick", wrap((req) => { const b = req.body || {}, k = kindOf(b.kind); if (b.id !== "hf" && !LR().list(k).some((e) => e.id === b.id)) { const e = new Error("not in your list"); e.status = 404; throw e; } LR().pick(k, String(b.id || "")); return { pick: rg().llm_repo_pick }; }));
  app.post("/api/llmrepos/remove", wrap((req) => LR().remove(String((req.body || {}).id || ""))));
  app.post("/api/llmrepos/share", wrap((req) => { const on = (req.body || {}).share !== false; setRg((r) => { r.pod_share = on; }); return { share: on }; }));
  app.post("/api/llmrepos/grow", wrap((req) => { const b = req.body || {}; return LR().grow(b.pod, b.gb); }));
}
module.exports = { mount };

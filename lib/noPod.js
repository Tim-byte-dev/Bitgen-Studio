/* bitGen Studio — lib/noPod.js (2.789.0): A TERMINATED POD'S FILES KEPT AS "NO_Pod (<old name>)/<file>", AND THE POD MADE AGAIN.
 * Tim (verbatim, the agreed design): "if pod is terminated ask user if they want to remove models from the list, if no, change
 * the podname to NO_Pod, but keep all the model details in a file so if user clicks a nopod/model name, the pod will be
 * recreated and the models uploaded to the new pod, if a pod is stopped , start the pod before rendering"
 *   terminated(id, recipe)  lib/pods.js act("terminate") - the inventory (lib/podInv.js) marked gone with how the pod was made,
 *                           asked about (static/nopod.js: Keep as NO_Pod / Remove from the lists)
 *   remake(oldId, say)      a render with a NO_Pod file, after you pressed "Make the pod again" (the box shows the recipe -
 *                           2.763.4: a gone pod is never made again unasked): the same template / GPU / count / cloud / disk /
 *                           volume (lib/pods.js create), its styles follow (podRevive.moveStyles), its inventory goes over
 *                           (podInv.moveTo - files "todo") -> {id, name, port}
 *   putBack(id, port, say)  after the pod is ready (lib/stylePods.js ready): every model / LoRA of its inventory still "todo" is put
 *                           on it - found on the pod, online (remote_models.json, Civitai / Hugging Face), else sent from this
 *                           computer (lib/podSend.js ensure); one at a time, in the background; what could not be put back said
 *                           in the PODS docker (lib/podActivity.js)
 *   recipeLine(rc)          the recipe in words (pure) - the box and the log
 * Pure parts: scripts/test-nopod789.js.
 *
 * 2.793.0 NO_POD PART 2 (Tim, verbatim: "also ask the user if the model + vae + textencoder should be added to an existing pod.
 * show user running pods and stopped pods. check if the files exist, only upload necessary files that don't exist on the pod" +
 * "if user chooses new pod or uses an existing one then change the name of the model to pod name/model name so it is assigned a
 * new name. check the full list of pods and models in the pods to see if the model exists in any other pod - advise the user of
 * which pod has it and ask if it should start that pod, create a new pod or add the model to a different pod"):
 *   todo(inv)               + the VAE and text encoders (a model does not render without them); putBack sends each to its own
 *                           folders (catsFor)
 *   useOn(ref, podId, o)    the picked NO_Pod file goes to a pod you have (lib/noPodWhere.js found which pods have it): that pod
 *                           started when stopped (o.stopped - RunPod's own words when it cannot), the file + its VAE / text
 *                           encoders the pod does not have added to its inventory as "todo" (only those are sent - putBack in
 *                           the background, after the pod loads), the file leaves the NO_Pod (dropped when none of its models /
 *                           LoRAs is left), the pick renamed everywhere it is kept to "<pod name>/<file>" (renameRefs), the
 *                           styles linked to the gone pod follow (podRevive.moveStyles) -> {name, pod_id, pod_name, started,
 *                           sending, dropped}
 *   renameRefs(map)         basic.cfg (Basic Settings), misc/basic_settings.tmp (each style's Basic Settings), the open project's
 *                           temporary LoRAs - every value map() changes; remake() renames "NO_Pod (<name>)/…" -> "<name>/…"
 */
"use strict";
const PI = () => require("./podInv");

function recipeLine(rc) {
  if (!rc) return "";
  const gb = (n) => (+n ? n + " GB" : "");
  return [rc.template_name || rc.template_id || "", (rc.count > 1 ? rc.count + " × " : "") + (rc.gpu || "a GPU"), rc.cloud === "COMMUNITY" ? "Community cloud" : "Secure cloud",
    rc.disk ? "disk " + gb(rc.disk) : "", rc.volume ? "volume " + gb(rc.volume) : ""].filter(Boolean).join(" · ");
}
/** the files to put back (pure): models, LoRAs + (2.793.0) the VAE and text encoders still "todo" */
const PUT = ["model", "lora", "vae", "te"];
function todo(inv) { return ((inv && inv.files) || []).filter((f) => f.state === "todo" && PUT.includes(f.kind)); }
/** the ComfyUI folders a file of that kind is looked for in / sent to (pure) */
function catsFor(f) {
  const k = (f && f.kind) || "";
  return k === "lora" ? ["loras"] : k === "vae" ? ["vae"] : k === "te" ? ["text_encoders", "clip"] : k === "model" ? require("./podSend").CKPT_CATS : [String((f && f.cat) || "checkpoints")];
}

function terminated(id, recipe) { try { return PI().markGone(id, recipe); } catch { return null; } }

const BUSY = {};
async function remake(oldId, say) {
  const tell = (t) => { if (say) try { say(t); } catch { /* fine */ } };
  const inv = PI().load(oldId);
  if (!inv || !inv.gone) throw new Error("bitGen knows no terminated pod " + oldId);
  if (!inv.remake_ok) throw new Error(`NO_Pod (${PI().baseLabel(inv)}) is not made again until you say so - pick one of its files in Basic Settings and press Make the pod again`);
  const RV = require("./podRevive"), rc = RV.cleanRecipe(inv.recipe);
  if (!rc) throw new Error(`bitGen does not know how NO_Pod (${PI().baseLabel(inv)}) was made - make a pod in 🖥 PODS ▸ ＋ Create pod and send its files there (Basic Settings ▸ Remote)`);
  tell("making NO_Pod (" + PI().baseLabel(inv) + ") again: " + recipeLine(rc));
  const port = rc.port || 8188;
  const made = await require("./pods").create({ templateId: rc.template_id, name: rc.name || inv.name || "bitGen pod", gpu: rc.gpu, count: rc.count, cloud: rc.cloud,
    disk: rc.disk, volume: rc.volume, port, cuda: rc.cuda });   // create decides the ComfyUI install from the template
  const id = made.pod.id, name = made.pod.name || inv.name;
  PI().moveTo(inv.id, id, name);
  try { RV.moveStyles(inv.id, id, name); } catch { /* links are a nicety */ }
  // 2.793.0 (Tim: "change the name of the model to pod name/model name"): "NO_Pod (<name>)/<file>" -> "<name>/<file>" wherever kept
  try { renameRefs(require("./noPodWhere").refMap("NO_Pod (" + PI().baseLabel(inv) + ")/", PI().labelOf(PI().load(id) || { id, name }) + "/", true)); } catch { /* the old name still resolves */ }
  tell("made again as " + name + " (" + id + ") - waiting for it to load");
  return { id, name, port: made.port || port };
}
/** in the background: the inventory's models + LoRAs onto the new pod */
function putBack(id, port) {
  const k = String(id);
  if (BUSY[k]) return BUSY[k];
  const PA = () => require("./podActivity"), SD = require("./podSend");
  BUSY[k] = (async () => {
    const inv = PI().load(id), L = todo(inv), missed = [];
    for (let i = 0; i < L.length; i++) {
      const f = L[i], short = f.rel.split("/").pop();
      try { PA().note(id, `putting its files back (${i + 1} of ${L.length}): ${short}`); } catch { /* fine */ }
      try { await SD.ensure(id, port, catsFor(f), f.rel, (t) => { try { PA().note(id, short + ": " + t); } catch { /* fine */ } }); }
      catch (e) { missed.push(short + " (" + String((e && e.message) || e).slice(0, 160) + ")"); }
    }
    try { PA().note(id, L.length ? (missed.length ? "files put back - not: " + missed.join("; ") : "its " + L.length + " files are back on the pod") : "no files to put back"); } catch { /* fine */ }
    return { missed };
  })().finally(() => { delete BUSY[k]; });
  return BUSY[k];
}
/** 2.793.0: every kept value map() changes (Basic Settings' basic.cfg, each style's Basic Settings, the project's temporary
 *  LoRAs) -> how many */
function renameRefs(map) {
  const W = require("./noPodWhere");
  let n = 0;
  try { const L = require("./layoutCfg"), o = L.read("basic"), k = W.renameIn(o, map); if (k) { L.write("basic", o); n += k; } } catch { /* fine */ }
  try { const B = require("./basicTmp"), o = B.read(), k = W.renameIn(o.styles, map); if (k) { B.write(o); n += k; } } catch { /* fine */ }
  try {
    const C = require("./core"), TL = require("./tempLoras"), pdir = C.projDir(C.getProject());
    for (const kind of ["image", "video"]) { const L = TL.read(pdir, kind), k = W.renameIn(L, map); if (k) { TL.write(pdir, kind, L); n += k; } }
  } catch { /* fine */ }
  return n;
}
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
/** 2.793.0: the picked NO_Pod file onto a pod you have (see the header). o = {stopped, port, start (pods.act - tests),
 *  wait (podRevive.waitReady - tests), put (putBack - tests)} -> what happened; the sending goes on in the background */
async function useOn(ref, podId, o) {
  const x = o || {}, W = require("./noPodWhere");
  const r = PI().resolve(ref, PI().live(), null);
  if (!r || !r.nopod) throw bad("no NO_Pod file of that name", 404);
  const old = PI().load(r.pod_id), tgt = PI().load(podId);
  if (!tgt || tgt.gone) throw bad("bitGen knows no pod " + String(podId || "") + " - pick one of your pods", 404);
  const f = (old.files || []).find((y) => y.cat === r.cat && y.rel === r.rel);
  if (!f) throw bad("NO_Pod (" + PI().baseLabel(old) + ") no longer has " + r.rel, 404);
  const port = +x.port || 8188;
  let started = false;
  if (x.stopped) {            // started first - nothing is renamed when RunPod cannot start it
    try { await (x.start || ((id) => require("./pods").act(id, "start")))(tgt.id); started = true; }
    catch (e) { throw bad("RunPod did not start " + tgt.name + ": " + String((e && (e.said || e.message)) || e).slice(0, 300) + " - a stopped pod may get no GPU back; put the file on another pod or make the pod again", 409); }
  }
  // the file + its VAE / text encoders: the ones the pod has under any folder are used, only the rest go on it
  const want = [f].concat(W.companions(old, f)), add = want.filter((y) => !W.findIn(tgt, y));
  const own = W.findIn(tgt, f);
  tgt.files = W.mergeTodo(tgt.files, add);
  PI().save(tgt);
  // the NO_Pod loses the file (its VAE / text encoders stay - its other models use them); none of its models / LoRAs left = it goes
  old.files = (old.files || []).filter((y) => y !== f);
  const left = old.files.some((y) => PI().LIST_CATS.includes(y.cat));
  if (left) PI().save(old); else PI().decide(old.id, false);
  const name = PI().labelOf(PI().load(tgt.id) || tgt) + "/" + (own ? own.rel : f.rel);
  const renamed = renameRefs(W.refMap(ref, name));
  try { require("./podRevive").moveStyles(old.id, tgt.id, tgt.name); } catch { /* links are a nicety */ }
  const sending = add.map((y) => y.rel.split("/").pop());
  if (sending.length || started) {
    const say = (t) => { try { require("./podActivity").note(tgt.id, t); } catch { /* fine */ } };
    (async () => {
      if (started) say("started for " + f.rel.split("/").pop() + " (from NO_Pod (" + PI().baseLabel(old) + "))");
      await (x.wait || require("./podRevive").waitReady)(tgt.id, port, say);
      if (sending.length) await (x.put || putBack)(tgt.id, port);
    })().catch((e) => say("could not put " + sending.join(", ") + " on it: " + String((e && e.message) || e).slice(0, 200)));
  }
  return { ok: true, name, pod_id: tgt.id, pod_name: tgt.name, started, sending, there: want.length - add.length, dropped: !left, renamed };
}
module.exports = { recipeLine, todo, catsFor, terminated, remake, putBack, renameRefs, useOn };

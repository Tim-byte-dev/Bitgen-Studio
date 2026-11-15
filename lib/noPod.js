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
 */
"use strict";
const PI = () => require("./podInv");

function recipeLine(rc) {
  if (!rc) return "";
  const gb = (n) => (+n ? n + " GB" : "");
  return [rc.template_name || rc.template_id || "", (rc.count > 1 ? rc.count + " × " : "") + (rc.gpu || "a GPU"), rc.cloud === "COMMUNITY" ? "Community cloud" : "Secure cloud",
    rc.disk ? "disk " + gb(rc.disk) : "", rc.volume ? "volume " + gb(rc.volume) : ""].filter(Boolean).join(" · ");
}
/** the files to put back (pure): models + LoRAs still "todo" */
function todo(inv) { return ((inv && inv.files) || []).filter((f) => f.state === "todo" && (f.kind === "model" || f.kind === "lora")); }

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
      try { await SD.ensure(id, port, f.kind === "lora" ? ["loras"] : SD.CKPT_CATS, f.rel, (t) => { try { PA().note(id, short + ": " + t); } catch { /* fine */ } }); }
      catch (e) { missed.push(short + " (" + String((e && e.message) || e).slice(0, 160) + ")"); }
    }
    try { PA().note(id, L.length ? (missed.length ? "files put back - not: " + missed.join("; ") : "its " + L.length + " files are back on the pod") : "no files to put back"); } catch { /* fine */ }
    return { missed };
  })().finally(() => { delete BUSY[k]; });
  return BUSY[k];
}
module.exports = { recipeLine, todo, terminated, remake, putBack };

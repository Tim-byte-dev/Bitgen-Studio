#!/usr/bin/env node
/* bitGen Studio — 2.789.0 units: a terminated pod's files kept as "NO_Pod (<old name>)/<file>" or removed (lib/podInv.js), the
 * pick needs "Make the pod again" (lib/podPick.js), the pod made again from its recipe + its files put back (lib/noPod.js), the
 * wiring (lib/pods.js act, lib/stylePods.js ready, routes/podInv.js, static/nopod.js). A temporary folder; RunPod / the pod
 * stubbed - no studio, no network. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nopod789-"));
process.env.H3_POD_INV_DIR = TMP;
const ROOT = path.join(__dirname, "..");
const PI = require("../lib/podInv"), PK = require("../lib/podPick"), NP = require("../lib/noPod"), NS = require("../static/nopod.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

(async () => {
  // ---- pure
  const files = [{ cat: "checkpoints", rel: "Models/krea2_mine.safetensors", kind: "model", state: "on" }, { cat: "loras", rel: "grain.safetensors", kind: "lora", state: "on" }, { cat: "vae", rel: "ae.safetensors", kind: "vae", state: "on" }];
  const alive = { id: "podA1", name: "Krea pod", files }, kept = { id: "podB2", name: "Old pod", gone: true, keep: true, files }, dropped = { id: "podC3", name: "Gone", gone: true, files };
  check("labelOf: a gone pod whose files you kept = NO_Pod (<old name>)", PI.labelOf(kept) === "NO_Pod (Old pod)" && PI.labelOf(alive) === "Krea pod" && PI.labelOf(dropped) === "Gone");
  const E = PI.entries([alive, kept, dropped]);
  check("entries: NO_Pod files listed (marked nopod), a gone pod with nothing decided is not", E.checkpoints.map((x) => x.name).join() === "Krea pod/Models/krea2_mine.safetensors,NO_Pod (Old pod)/Models/krea2_mine.safetensors"
    && E.checkpoints[1].nopod === true && !E.checkpoints[0].nopod && E.checkpoints[1].folder === "NO_Pod (Old pod)/Models" && E.loras.length === 2, E);
  const r1 = PI.resolve("NO_Pod (Old pod)/Models/krea2_mine.safetensors", [alive, kept, dropped], PI.MODEL_CATS);
  check("resolve: a NO_Pod file -> its pod, nopod", r1 && r1.pod_id === "podB2" && r1.nopod === true && r1.rel === "Models/krea2_mine.safetensors" && r1.name === "NO_Pod (Old pod)", r1);
  check("resolve: a dropped gone pod's files are not found", PI.resolve("Gone/grain.safetensors", [dropped], ["loras"]) === null);
  const remade = { id: "podN9", name: "Old pod", remade_from: "podB2", files };
  const r2 = PI.resolve("NO_Pod (Old pod)/grain.safetensors", [alive, remade], ["loras"]);
  check("resolve: a pod made again still answers to its NO_Pod name (a stored pick keeps working), not as nopod", r2 && r2.pod_id === "podN9" && !r2.nopod && r2.name === "Old pod"
    && PI.resolve("Old pod/grain.safetensors", [remade], ["loras"]).pod_id === "podN9", r2);
  const g1 = PI.gonePatch({ id: "x", files }, { template_id: "t" }, 5);
  check("gonePatch: gone + when + recipe + ask (it had files, nothing decided)", g1.gone === true && g1.gone_at === 5 && g1.recipe.template_id === "t" && g1.ask === true, g1);
  check("gonePatch: no files = no question; already gone = nothing; decided = no question", !PI.gonePatch({ id: "x", files: [] }).ask && JSON.stringify(PI.gonePatch({ gone: true, files })) === "{}" && !PI.gonePatch({ files, keep: true }).ask);
  const rc = { template_id: "runpod-torch-v280", template_name: "RunPod Pytorch 2.8.0", gpu: "NVIDIA A40", count: 2, cloud: "COMMUNITY", disk: 50, volume: 120, port: 8188 };
  check("recipeLine: template · GPUs · cloud · disk · volume", NP.recipeLine(rc) === "RunPod Pytorch 2.8.0 · 2 × NVIDIA A40 · Community cloud · disk 50 GB · volume 120 GB", NP.recipeLine(rc));
  // 2.793.0: the VAE / text encoders go back too (a model does not render without them)
  check("todo: the models, LoRAs + (2.793.0) the VAE still to put back", NP.todo({ files: files.map((f) => Object.assign({}, f, { state: "todo" })) }).map((f) => f.rel).join() === "Models/krea2_mine.safetensors,grain.safetensors,ae.safetensors");

  // ---- live (the temporary folder)
  PI.save({ id: "podT1", name: "Test pod", files });
  PI.markGone("podT1", rc);
  let inv = PI.load("podT1");
  check("markGone: gone, asked, the recipe kept in runpod/pods/<id>.json", inv.gone && inv.ask && inv.recipe && inv.recipe.gpu === "NVIDIA A40" && inv.gone_at > 0, inv);
  check("asks: the terminated pod waits for your answer; not listed yet", PI.asks().map((i) => i.id).join() === "podT1" && !PI.live().some((i) => i.id === "podT1"));
  PI.decide("podT1", true);
  inv = PI.load("podT1");
  check("decide keep: no question, listed as NO_Pod (Test pod)", inv.keep === true && !inv.ask && PI.asks().length === 0 && PI.live().some((i) => i.id === "podT1") && PI.labelOf(inv) === "NO_Pod (Test pod)");
  PI.save({ id: "podT2", name: "Other", files }); PI.markGone("podT2", null);
  const rm = PI.decide("podT2", false);
  check("decide remove: the inventory deleted - nothing left in the lists", rm.removed === true && !PI.load("podT2") && !fs.existsSync(path.join(TMP, "podT2.json")));

  // the pick needs "Make the pod again"
  const job = () => ({ mode: "image", style: { id: "s1", name: "Krea 2 Raw", arch: "krea2", model_override: true, model: "NO_Pod (Test pod)/Models/krea2_mine.safetensors" } });
  const q1 = job(); const a1 = PK.apply(q1);
  check("a NO_Pod pick before Make the pod again: the render is refused with what to do", a1 && a1.error && /terminated/.test(a1.error) && /Make the pod again/.test(a1.error), a1);
  PI.okRemake("podT1", true);
  const q2 = job(); const a2 = PK.apply(q2);
  check("after Make the pod again: the pick = that pod, nopod, the plain file name", a2 && a2.pod_id === "podT1" && a2.nopod === true && /made again from its recipe/.test(a2.why) && q2.style.model === "Models/krea2_mine.safetensors", a2);

  // remake (RunPod stubbed)
  const P = require("../lib/pods"), RV = require("../lib/podRevive"), SD = require("../lib/podSend"), PA = require("../lib/podActivity");
  const made = []; P.create = async (o) => { made.push(o); return { pod: { id: "podNEW1", name: o.name }, port: o.port }; };
  const moved = []; RV.moveStyles = (a, b, n) => moved.push([a, b, n]);
  let err = ""; try { await NP.remake("podT2", null); } catch (e) { err = e.message; }
  check("remake: an unknown pod refused", /no terminated pod/.test(err), err);
  PI.save({ id: "podT3", name: "No recipe", gone: true, keep: true, remake_ok: true, files });
  err = ""; try { await NP.remake("podT3", null); } catch (e) { err = e.message; }
  check("remake: no recipe = said, nothing made", /does not know how/.test(err) && made.length === 0, err);
  const says = [];
  const m = await NP.remake("podT1", (t) => says.push(t));
  check("remake: the same template / GPU / count / cloud / disk / volume / port, the old name", made.length === 1 && made[0].templateId === "runpod-torch-v280" && made[0].gpu === "NVIDIA A40" && made[0].count === 2 && made[0].cloud === "COMMUNITY" && made[0].disk === 50 && made[0].volume === 120 && made[0].port === 8188 && made[0].name === "Test pod" && m.id === "podNEW1", made);
  inv = PI.load("podNEW1");
  check("remake: the inventory went over (files todo, remade_from), the old one gone, the styles follow", inv && inv.remade_from === "podT1" && inv.files.every((f) => f.state === "todo") && !PI.load("podT1") && moved[0][0] === "podT1" && moved[0][1] === "podNEW1" && says.some((t) => /making NO_Pod \(Test pod\) again/.test(t)), { inv, moved, says });
  check("after the remake the stored NO_Pod pick resolves to the new pod", (PI.resolve("NO_Pod (Test pod)/grain.safetensors", PI.live(), ["loras"]) || {}).pod_id === "podNEW1");

  // put back (the pod stubbed)
  const sent = [], notes = []; SD.ensure = async (id, port, cats, name) => { sent.push([id, cats.join("+"), name]); if (/grain/.test(name)) throw new Error("found nowhere"); return { name, sent: true }; };
  PA.note = (pod, t) => notes.push(t);
  const pb = await NP.putBack("podNEW1", 8188);
  check("putBack: each model / LoRA / (2.793.0) VAE put on the new pod in turn, each in its own folders", sent.length === 3 && sent[0][0] === "podNEW1" && /checkpoints/.test(sent[0][1]) && sent[1][1] === "loras" && sent[2][1] === "vae", sent);
  check("putBack: what could not be put back is said", pb.missed.length === 1 && /grain/.test(pb.missed[0]) && notes.some((t) => /not: grain/.test(t)), { pb, notes });

  // the page's words
  const ah = NS.askHtml({ id: "p", label: "Krea pod", count: 3, groups: [{ label: "Models", n: 1 }, { label: "LoRAs", n: 2 }], recipe_line: "RunPod Pytorch · NVIDIA A40" });
  check("the question: what it had, NO_Pod (<name>)/<file>, Keep / Remove", /Krea pod was terminated/.test(ah) && /1 Model, 2 LoRAs/.test(ah) && /NO_Pod \(Krea pod\)\/&lt;file&gt;/.test(ah) && /data-npkeep="1"/.test(ah) && /data-npkeep="0"/.test(ah));
  const ph = NS.pickHtml({ file: "Models/k.safetensors", pod: { id: "p", name: "Krea pod", label: "NO_Pod (Krea pod)", recipe: rc, recipe_line: NP.recipeLine(rc), count: 2 } });
  check("the pick box: the recipe shown, RunPod charges said, Make the pod again / Not now", /Make Krea pod again\?/.test(ph) && /2 × NVIDIA A40/.test(ph) && /charges/.test(ph) && /data-npmake="1"/.test(ph) && /data-npmake="0"/.test(ph));
  check("the pick box without a recipe: cannot be made again, only OK", /cannot be made again/.test(NS.pickHtml({ file: "x", pod: { label: "NO_Pod (x)" } })) && !/data-npmake="1"/.test(NS.pickHtml({ file: "x", pod: { label: "NO_Pod (x)" } })));
  check("isNoPod", NS.isNoPod("NO_Pod (Krea pod)/a.safetensors") && !NS.isNoPod("Krea pod/a.safetensors") && !NS.isNoPod(""));

  const WP = require("../routes/podInv").withPods;
  const wj = WP({ categories: { checkpoints: { files: [] } } }, [kept]);
  check("/api/comfymodels: a NO_Pod alone still adds its files (no live pod needed)", wj.pod_models === true && wj.categories.checkpoints.files.some((f) => f.name === "NO_Pod (Old pod)/Models/krea2_mine.safetensors"), wj);
  // wiring
  const PO = src("lib/pods.js"), SP = src("lib/stylePods.js"), RP = src("routes/podInv.js"), IX = src("static/index.html"), PD = src("static/podsdock.js");
  check("pods.act terminate: the recipe first, then noPod.terminated", /if \(action === "terminate"\) \{ try \{ rc = await require\("\.\/podRevive"\)\.recipe\(id\)/.test(PO) && /require\("\.\/noPod"\)\.terminated\(id, rc\)/.test(PO));
  check("stylePods.ready: a NO_Pod pick makes the pod again (not the 2.763.4 'gone - make one' path), files put back when ready", /opt && opt\.nopod/.test(SP) && /NP\.remake\(pod/.test(SP) && /noPod"\)\.putBack\(id, port\)/.test(SP) && /nopod: !!\(pick && pick\.nopod\)/.test(SP));
  check("routes: asks / keep / nopod / remake before /api/podinv/:id", RP.indexOf('"/api/podinv/asks"') > 0 && RP.indexOf('"/api/podinv/asks"') < RP.indexOf('"/api/podinv/:id"') && RP.indexOf('"/api/podinv/nopod"') < RP.indexOf('"/api/podinv/:id"') && /\/api\/podinv\/:id\/keep/.test(RP) && /\/api\/podinv\/:id\/remake/.test(RP));
  check("index.html loads nopod.js; PODS tells the page after a terminate", /<script src="\/static\/nopod\.js"><\/script>/.test(IX) && /h3:podinv[\s\S]{0,80}2\.789\.0/.test(PD));

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

#!/usr/bin/env node
/* bitGen Studio — 2.686.0 against the RUNNING app (+ a real browser): THE IMAGE PREVIEW'S 🎨 CHANGE STYLE WITH A STYLE THAT IS
 * NO EDIT MODEL = ✏ THE PICTURE'S LINE ART FIRST, THEN THE LOOK GENERATED FROM IT THROUGH A LINE-ART CONTROLNET OF THE
 * STYLE'S FAMILY. A temporary ComfyUI folder holds a stand-in SDXL union ControlNet; the real routes make the jobs (the
 * browser part stubs only the two jobs' progress and their pictures).
 *   GET /api/aiedit/lineart-net: Illustrious -> the SDXL union (told "line art"); Krea 2 -> none, said
 *   POST /api/aiedit lineart=1: Generate over the whole picture with the style's own graph + the ControlNet on the line
 *   art (aiedit_controls), Override's values ride; an edit model refused; the graph the worker sends has
 *   SetUnionControlNetType + ControlNetApplyAdvanced on the line art
 *   the preview: line art -> shown after the picture, the result after it; no ControlNet = picture to picture, said
 * Tim (verbatim): "if the style is not an edit style in preview image change style, create a lineart drawing first then use
 * controlnet to generate the image"
 * Against the running app (H3_URL). No Playwright = the browser part SKIPs. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAT0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyD0aJPaIiU1OTAAAAABJRU5ErkJggg==";
const get = async (u) => (await fetch(URL_ + u.replace(/^\//, ""))).json();
const post = async (u, b) => (await fetch(URL_ + u.replace(/^\//, ""), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json();
const NET = "xinsir-union-promax-sdxl.safetensors";
async function aiedit(fields) {
  const fd = new FormData(), png = new Blob([Buffer.from(PNG, "base64")], { type: "image/png" });
  fd.append("crop", png, "restyle.png"); fd.append("mask", png, "mask.png"); fd.append("rgba", png, "hole.png");
  if (fields.lineart === "1") fd.append("ctl0", png, "lineart.png");
  Object.keys(fields).forEach((k) => fd.append(k, String(fields[k])));
  const r = await fetch(URL_ + "api/aiedit", { method: "POST", body: fd }); return { ok: r.ok, j: await r.json() };
}
const cancel = async (id) => { for (const u of ["api/jobs/" + id + "/cancel", "api/cancel/" + id]) { try { const r = await fetch(URL_ + u, { method: "POST" }); if (r.ok) return; } catch { /* next */ } } };

(async () => {
  const cfg0 = await get("/api/config"), dir0 = (((cfg0 || {}).engine || {}).comfy || {}).dir || "";
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e2e686-")), cnDir = path.join(tmp, "ComfyUI", "models", "controlnet");
  fs.mkdirSync(cnDir, { recursive: true }); fs.writeFileSync(path.join(cnDir, NET), "");
  fs.writeFileSync(path.join(tmp, "ComfyUI", "main.py"), "");
  await post("/api/config", { engine: { comfy: { dir: path.join(tmp, "ComfyUI") } } });
  const made = [];
  try {
    const E = await get("/api/aiedit/engines");
    const ill = (E.inpaint || []).find((s) => /^(Illustrious|Pony|SDXL)$/.test(s.name)), ed = (E.edit || []).find((s) => /Klein.*edit/i.test(s.name));
    const all = [...(E.inpaint || []), ...(E.edit || [])], krea = all.find((s) => /krea/i.test(s.name));
    const n1 = await get("/api/aiedit/lineart-net?style_id=" + ill.id);
    check(ill.name + ": its line-art ControlNet = the SDXL union in ComfyUI's models/controlnet, told it gets line art", n1.model === NET && n1.union === true && /SDXL/.test(n1.label), n1);
    if (krea) { const n2 = await get("/api/aiedit/lineart-net?style_id=" + krea.id); check(krea.name + ": no line-art ControlNet for its family - said (picture to picture instead)", !n2.model && /no line-art ControlNet works with this style's model family/.test(n2.error || ""), n2); }
    const a = await aiedit({ mode: "generate", whole: "1", restyle: "1", lineart: "1", prompt: "anime style", style_id: ill.id, strength: 100, count: 1, width: 512, height: 512, seed: 7, ovr: JSON.stringify({ steps: 31, cfg: 5 }) });
    const ja = a.j.jobs && a.j.jobs[0] ? await get("/api/jobs/" + a.j.jobs[0].id) : {}, pa = ja.params || {}; if (ja.id) made.push(ja.id);
    const c0 = (pa.aiedit_controls || [])[0] || {};
    check("POST /api/aiedit lineart=1: Generate over the whole picture with the style's own graph (full strength) + the ControlNet on the line art",
      a.ok && /style's own graph/.test(a.j.note || "") && /line art through xinsir-union-promax-sdxl/.test(a.j.note || "") && a.j.denoise == null && c0.type === "lineart" && c0.model === NET && c0.union_type === "canny/lineart/anime_lineart/mlsd" && fs.existsSync(c0.image || ""),
      { ok: a.ok, note: a.j.note, err: a.j.error, d: a.j.denoise, c0 });
    check("…Basic Settings' Override rides it (steps 31, CFG 5), strength 0.85 / ends at 90 %", pa.steps === 31 && pa.cfg === 5 && c0.strength === 0.85 && c0.end === 0.9, { steps: pa.steps, cfg: pa.cfg, c0 });
    // the graph the worker sends: the style's own graph patched + the ControlNet (scripts/cn_stage.apply_controlnet)
    const py = execFileSync("python3", ["-I", "-c", `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_image as C, cn_stage as N
p = json.load(sys.stdin); st = p.pop("style")
g, rep = C.patch(C.load_workflow(p["workflow"]), st, p)
c = p["aiedit_controls"][0]
g, notes = N.apply_controlnet(g, "lineart.png", c["model"], c["strength"], c["end"], start=c["start"], first_only=True, union_type=c.get("union_type"))
cls = {v["class_type"] for v in g.values()}
u = [v for v in g.values() if v["class_type"] == "SetUnionControlNetType"]
ap = [v for v in g.values() if v["class_type"] == "ControlNetApplyAdvanced"]
ks = [v for v in g.values() if v["class_type"] == "KSampler"]
print(json.dumps({"union": u[0]["inputs"]["type"] if u else None, "apply": len(ap), "fed": bool(ap) and ap[0]["inputs"]["control_net"][0] in [k for k, v in g.items() if v["class_type"] == "SetUnionControlNetType"],
  "pos": bool(ks) and ks[0]["inputs"]["positive"][0] in [k for k, v in g.items() if v["class_type"] == "ControlNetApplyAdvanced"], "steps": ks[0]["inputs"]["steps"] if ks else None,
  "denoise": ks[0]["inputs"].get("denoise") if ks else None, "vaeenc": "VAEEncode" in cls, "notes": notes}))
`], { input: JSON.stringify(pa), encoding: "utf8" });
    const G = JSON.parse(py.trim().split("\n").pop());
    check("…the graph for ComfyUI: the ControlNet loader -> SetUnionControlNetType (line art) -> ControlNetApplyAdvanced on the sampler's conditioning, steps 31, denoise 1",
      G.union === "canny/lineart/anime_lineart/mlsd" && G.apply === 1 && G.fed && G.pos && G.steps === 31 && (G.denoise == null || G.denoise === 1), G);
    const b = await aiedit({ mode: "edit", whole: "1", lineart: "1", prompt: "anime", style_id: ed.id, count: 1, width: 512, height: 512 });
    check("an edit model with lineart=1: refused in words (it follows the instruction itself)", !b.ok && /no edit model/.test(b.j.error || ""), b.j);
    // the browser: line art -> shown -> the result after it
    if (!chromium) console.log("SKIP: playwright is not installed here - the browser part did not run");
    else {
      const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 1500, height: 950 } });
      const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
      const ev = (f, x) => p.evaluate(f, x);
      let sent = [], pre = 0;
      await p.route("**/api/aiedit/preprocess", async (r) => { pre++; await r.fulfill({ json: { job: "e2e686_pre", type: "lineart" } }); });
      await p.route("**/outputs/e2e686_*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(PNG, "base64") }));
      await p.route("**/api/aiedit", async (r) => { const res = await r.fetch(), j = await res.json(); sent.push({ body: r.request().postDataBuffer().toString("latin1"), j }); if (j.jobs && j.jobs[0]) made.push(j.jobs[0].id); await r.fulfill({ response: res, json: j }); });
      await p.route("**/api/jobs/*", (r) => { const u = r.request().url(), s = sent[sent.length - 1]; if (u.endsWith("/e2e686_pre")) return r.fulfill({ json: { status: "done", outputs: ["e2e686_line.png"] } }); if (s && s.j.jobs && u.endsWith("/" + s.j.jobs[0].id)) return r.fulfill({ json: { status: "done", outputs: ["e2e686_result" + sent.length + ".png"] } }); return r.continue(); });
      const field = (s, k) => { const m = new RegExp('name="' + k + '"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--').exec(s.body); return m ? m[1] : null; };
      try {
        await p.goto(URL_, { waitUntil: "domcontentloaded" });
        await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Restyle && document.getElementById("lb_restyle") && document.getElementById("styleSel").options.length > 2, null, { timeout: 40000 });
        await p.waitForTimeout(3500);
        await ev((id) => { const s = document.getElementById("styleSel"); s.value = id; s.dispatchEvent(new Event("change", { bubbles: true })); const o = document.getElementById("ovrStyle"); if (o.checked) { o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); } }, ill.id);
        await ev((png) => lbOpen([{ url: "data:image/png;base64," + png, kind: "image", name: "e2e686_source.png" }], 0), PNG);
        await p.selectOption("#lb_rslook", "anime"); await p.click("#lb_restyle");
        await p.waitForFunction(() => /e2e686_result/.test(document.getElementById("lb_name").textContent), null, { timeout: 20000 })
          .catch(async (e) => { console.log("      (the bar: " + await ev(() => document.getElementById("lb_rsmsg").textContent + " | " + document.querySelector("#lb_rsbar .tx").textContent) + "; sent " + sent.length + ", preprocess " + pre + ")"); throw e; });
        const s0 = sent[0], st = await ev(() => ({ names: lb.items.map((x) => x.name), i: lb.i, msg: document.getElementById("lb_rsmsg").textContent }));
        check("the preview: ✏ the line art made first (the preprocessor job), then /api/aiedit lineart=1 Generate with it as ctl0 + the look's words",
          pre === 1 && s0 && field(s0, "lineart") === "1" && field(s0, "mode") === "generate" && /name="ctl0"; filename=/.test(s0.body) && /^anime style/.test(field(s0, "prompt") || "") && s0.j && /line art through/.test(s0.j.note || ""), s0 && { pre, mode: field(s0, "mode"), note: s0.j.note, err: s0.j.error });
        check("…the preview shows: the picture, its line art, the result (shown)", st.names.join("|") === "e2e686_source.png|e2e686_line.png|e2e686_result1.png" && st.i === 2 && /done/.test(st.msg), st);
        // no ControlNet any more: picture to picture, said
        fs.rmSync(path.join(cnDir, NET));
        await ev(() => { lb.i = 0; lbShow(); }); await p.waitForTimeout(200);
        await p.click("#lb_restyle");
        await p.waitForFunction(() => /e2e686_result2/.test(document.getElementById("lb_name").textContent), null, { timeout: 20000 });
        const s1 = sent[1], msgs = await ev(() => document.getElementById("lb_rsmsg").title + " | " + document.getElementById("lb_rsmsg").textContent);
        check("no line-art ControlNet: no line art drawn, remade picture to picture (Refine) instead", pre === 1 && s1 && field(s1, "mode") === "refine" && field(s1, "lineart") === null, s1 && { mode: field(s1, "mode") });
        check("no page errors", errs.length === 0, errs);
        void msgs;
      } catch (e) { fail++; console.log("FAIL: the browser part stopped - " + (e.stack || e.message)); }
      await br.close();
    }
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  for (const id of made) await cancel(id);
  await post("/api/config", { engine: { comfy: { dir: dir0 } } });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();

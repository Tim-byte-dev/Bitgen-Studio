// bitGen Studio — lib/sheetStyles.js: which image styles can render a
// character sheet, and what LoRAs each will ACTUALLY load (2.206.0, Tim:
// "hybrid horses ... only load loras when there are loras in the style").
// Run from repo root: node scripts/test-sheetstyles.js
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgsheet-"));
process.env.H3_WORKSPACE = tmp;                 // before core is loaded
const core = require(path.join(__dirname, "..", "lib", "core"));
const styles = require(path.join(__dirname, "..", "lib", "styles"));
const SS = require(path.join(__dirname, "..", "lib", "sheetStyles"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

// The workspace's styles dir starts with the STARTER_STYLES (written on the
// first read of an empty folder); the repo root is the baseDir whose bundled
// comfy_workflows the Klein swap resolves against — the real files, not
// fixtures, so a renamed template breaks THIS test before it breaks a render.
const DIR = core.STYLES_DIR;
const BASE = path.join(__dirname, "..");

// ---- lorasOf: exactly the patcher's filter ------------------------------
check("lorasOf keeps only entries with a non-empty path, weight defaults 1",
      (() => { const l = SS.lorasOf({ loras: [{ path: " a.safetensors ", weight: "" },
                                              { path: "" }, null,
                                              { path: "b.st", weight: 0.7 }] });
               return l.length === 2 && l[0].path === "a.safetensors" && l[0].weight === 1
                 && l[1].weight === 0.7; })(), SS.lorasOf({ loras: [{ path: "x" }] }));
check("lorasOf of a style with no loras key is empty, not a crash",
      SS.lorasOf({}).length === 0 && SS.lorasOf(null).length === 0);

// ---- list: eligibility is "the rendering workflow can take the picture" --
const rows0 = SS.list(DIR, BASE);
check("the starter Klein t2i style is listed (it swaps to its edit sibling)",
      rows0.some((r) => /FLUX\.2 9B \(verified\)/.test(r.name) && r.swapped === true),
      rows0.map((r) => r.name));
// 2.332.0: the Qwen Image Edit 2511 starter carries ONE LoRA by design - its
// Lightning 4-step LoRA (the patcher bypasses unfilled LoRA slots, so the
// style must name it); every other starter carries none
check("every starter row reports ZERO LoRAs, except Qwen Image Edit 2511's one Lightning LoRA",
      rows0.length > 0 && rows0.every((r) => (r.name === "Qwen Image Edit 2511" ? r.loras === 1 : r.loras === 0)),
      rows0.map((r) => [r.name, r.loras]));
check("a plain SDXL t2i style is NOT listed (no slots, no sibling — the 2.199.0 lesson)",
      !rows0.some((r) => r.name === "SDXL" || r.name === "Pony"),
      rows0.map((r) => r.name));
check("the SDXL img2img style IS listed by its own LoadImage slot, unswapped",
      rows0.some((r) => /SDXL img2img/.test(r.name) && r.swapped === false && r.slots > 0),
      rows0.map((r) => [r.name, r.slots, r.swapped]));

// ---- a style WITH LoRAs reports them by name ----------------------------
const withL = styles.save(DIR, { name: "AAA Klein charactered", kind: "image",
  arch: "flux2klein9b", engine: "comfy",
  workflow: "comfy_workflows/img_flux2_klein_9b_t2i.json",
  loras: [{ path: "people/waifu-v3.safetensors", weight: 0.8 }, { path: "  " }] });
const rows1 = SS.list(DIR, BASE);
const mine = rows1.find((r) => r.id === withL.id);
check("a saved style's live LoRAs ride the row: count 1, blank path dropped, basename reported",
      mine && mine.loras === 1 && mine.lora_names[0] === "waifu-v3.safetensors", mine);

// ---- pick: explicit id is Tim's truth; no id = old auto-pick ------------
const p1 = SS.pick(DIR, BASE, withL.id);
check("pick honors an explicit style_id and reports ITS loras",
      p1 && p1.style.id === withL.id && p1.loras.length === 1
      && p1.loras[0].path === "people/waifu-v3.safetensors", p1 && p1.loras);
const p0 = SS.pick(DIR, BASE, "");
check("with no id the first SWAPPING style wins alphabetically — which is the LoRA'd 'AAA…' style: the hybrid-horse mechanism, demonstrated",
      p0 && p0.style.id === withL.id && p0.loras.length === 1, p0 && p0.style.name);
check("pick's styled copy carries the loras the patcher will read (style.loras intact)",
      p0 && Array.isArray(p0.styled.loras) && p0.styled.loras.length >= 1);
check("pick resolves the render workflow: the Klein t2i SWAPS for one reference",
      p0 && p0.rw && p0.rw.swapped === true && /edit/.test(p0.rw.workflow), p0 && p0.rw);
styles.remove(DIR, withL.id);
const p2 = SS.pick(DIR, BASE, "");
check("with the LoRA'd style removed the auto-pick lands on a NO-LoRA starter again",
      p2 && p2.loras.length === 0, p2 && [p2.style.name, p2.loras]);
check("pick of an unknown id falls back to the auto-pick rather than null",
      (() => { const p = SS.pick(DIR, BASE, "no-such-id"); return p && p.loras.length === 0; })());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

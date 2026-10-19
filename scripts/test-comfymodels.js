#!/usr/bin/env node
// Unit tests for lib/comfyModels.js — the list of models ComfyUI can load.
// Run: node scripts/test-comfymodels.js
//
// THE FAILURE THIS GUARDS: a style's model/VAE/LoRA field in comfy mode is a
// string ComfyUI must recognise in its own dropdown. A name that is nearly
// right produces "Value not in list" (or worse, a perfect picture of the wrong
// model), which the handover records costing several rounds to diagnose. So
// most of these checks are about the NAME being exactly what ComfyUI would say,
// and about the scan never lying by omission when it cannot read something.
const fs = require("fs");
const os = require("os");
const path = require("path");
const M = require(path.join(__dirname, "..", "lib", "comfyModels"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

const mk = (p) => { fs.mkdirSync(p, { recursive: true }); return p; };
const touch = (dir, rel, body) => {
  const full = path.join(dir, rel);
  mk(path.dirname(full));
  fs.writeFileSync(full, body || "x");
  return full;
};
function fresh() { return fs.mkdtempSync(path.join(os.tmpdir(), "comfymodels-")); }

// ==================================================================== yaml
{
  // ComfyUI's own example file, which is the shape that actually has to work.
  const { groups, warnings } = M.parseExtraPaths(`
#Rename this to extra_model_paths.yaml and ComfyUI will load it
comfyui:
    base_path: D:/AI/
    is_default: true
    checkpoints: models/checkpoints/
    text_encoders: |
        models/text_encoders/
        models/clip/    # legacy location still supported
    diffusion_models: |
        models/diffusion_models
        models/unet
    loras: models/loras/
`);
  check("yaml: the group is found", !!groups.comfyui, Object.keys(groups));
  check("yaml: a scalar value is read", groups.comfyui.checkpoints[0] === "models/checkpoints/", groups.comfyui);
  check("yaml: a block scalar becomes every path in it",
    groups.comfyui.text_encoders.length === 2
    && groups.comfyui.text_encoders[0] === "models/text_encoders/", groups.comfyui.text_encoders);
  // ComfyUI's own example puts a comment on a block-scalar LINE. Keeping it
  // would produce a folder called "models/clip/    # legacy location..."
  check("yaml: a trailing comment inside a block scalar is stripped",
    groups.comfyui.text_encoders[1] === "models/clip/", groups.comfyui.text_encoders);
  check("yaml: is_default is read", M.truthy(groups.comfyui.is_default), groups.comfyui.is_default);
  check("yaml: base_path is read", groups.comfyui.base_path[0] === "D:/AI/", groups.comfyui.base_path);
  check("yaml: a clean file produces no warnings", warnings.length === 0, warnings);
}
{
  // real-world variants: quoted booleans, Windows separators, CRLF, tabs
  const { groups } = M.parseExtraPaths(
    'comfyui_desktop:\r\n\tis_default: "true"\r\n\tcheckpoints: models\\checkpoints\\\r\n');
  check("yaml: CRLF and tab indentation parse", !!groups.comfyui_desktop, Object.keys(groups));
  check("yaml: a quoted boolean is still true", M.truthy(groups.comfyui_desktop.is_default), null);
  check("yaml: a Windows value survives intact",
    groups.comfyui_desktop.checkpoints[0] === "models\\checkpoints\\", groups.comfyui_desktop);
}
{
  // THE most common way this file is written wrong (ComfyUI issue #11404):
  // keys at the top level with no group. Silently ignoring it means the user
  // sees an empty dropdown and no reason.
  const { warnings } = M.parseExtraPaths("base_path: D:/AI\ncheckpoints: models/checkpoints\n");
  check("yaml: top-level keys outside a group are reported, not ignored",
    warnings.some((w) => /nested under a group/.test(w)), warnings);
}
{
  const { warnings } = M.parseExtraPaths("comfyui:\n    loras: [a, b]\n");
  check("yaml: an unsupported inline list is refused loudly rather than misread",
    warnings.some((w) => /inline lists/.test(w)), warnings);
}
{
  const { groups } = M.parseExtraPaths("comfyui:\n    checkpoints: C:/models/ck#1\n");
  check("yaml: a '#' inside a value is not treated as a comment",
    groups.comfyui.checkpoints[0] === "C:/models/ck#1", groups.comfyui);
}

// ================================================================== roots
{
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  mk(path.join(comfy, "models", "checkpoints"));
  mk(path.join(comfy, "models", "loras"));
  const { roots } = M.searchRoots(comfy);
  const ck = roots.filter((r) => r.category === "checkpoints");
  check("roots: the default models tree is searched",
    ck.some((r) => r.dir === path.join(comfy, "models", "checkpoints") && r.exists), ck);
  // unet and diffusion_models are the SAME category under two names ComfyUI
  // both still accept; a scanner that knew only one would miss half an install
  const dm = roots.filter((r) => r.category === "diffusion_models").map((r) => path.basename(r.dir));
  check("roots: unet and diffusion_models are one category",
    dm.includes("unet") && dm.includes("diffusion_models"), dm);
  const te = roots.filter((r) => r.category === "text_encoders").map((r) => path.basename(r.dir));
  check("roots: clip and text_encoders are one category",
    te.includes("clip") && te.includes("text_encoders"), te);
}
{
  // extra paths, with a relative base_path and an absolute override
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  const shared = mk(path.join(root, "shared", "models", "loras"));
  const far = mk(path.join(root, "elsewhere", "ck"));
  fs.writeFileSync(path.join(comfy, "extra_model_paths.yaml"),
    `a111:\n    base_path: ../shared\n    loras: models/loras\n    checkpoints: ${far}\n`);
  const { roots, yamlPath } = M.searchRoots(comfy);
  check("roots: the yaml beside main.py is found", !!yamlPath, yamlPath);
  const lo = roots.find((r) => r.category === "loras" && r.dir === shared);
  check("roots: a relative base_path resolves against the yaml's folder", !!lo && lo.exists, roots.filter(r => r.category === "loras"));
  check("roots: the source names the group it came from", lo && lo.source === "yaml:a111", lo);
  const ck = roots.find((r) => r.category === "checkpoints" && r.dir === path.resolve(far));
  check("roots: an absolute value is used as-is, not joined to base_path", !!ck, ck);
}
{
  // is_default means "list these first"
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  const pref = mk(path.join(root, "pref"));
  mk(path.join(comfy, "models", "loras"));
  fs.writeFileSync(path.join(comfy, "extra_model_paths.yaml"),
    `mine:\n    is_default: true\n    base_path: ${root}\n    loras: pref\n`);
  const { roots } = M.searchRoots(comfy);
  const lo = roots.filter((r) => r.category === "loras");
  check("roots: an is_default group is listed first", lo[0].dir === pref, lo.map(r => r.dir));
}

// ================================================================== scan
{
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  touch(comfy, path.join("models", "checkpoints", "sd_xl_base.safetensors"));
  touch(comfy, path.join("models", "checkpoints", "SDXL", "juggernaut.safetensors"));
  touch(comfy, path.join("models", "checkpoints", "readme.txt"));
  touch(comfy, path.join("models", "loras", "flux", "filmgrain.safetensors"));
  touch(comfy, path.join("models", "loras", "detail.safetensors"));
  touch(comfy, path.join("models", "vae", "ae.safetensors"));
  touch(comfy, path.join("models", "unet", "flux1-dev.gguf"));

  const s = M.scan(comfy);
  check("scan: it succeeded", s.ok && s.dir_exists, s.warnings);
  const ck = s.categories.checkpoints.files.map((f) => f.name);
  // THE NAME IS THE VALUE: relative to the root, extension kept, subfolder kept
  check("scan: a loose file is named bare",
    ck.includes("sd_xl_base.safetensors"), ck);
  check("scan: a file in a subfolder keeps the subfolder, as ComfyUI's dropdown does",
    ck.includes("SDXL/juggernaut.safetensors"), ck);
  /* THE 2.72.0 REGRESSION. 2.71.0 built these names with the platform separator,
     reasoning that ComfyUI derives its own with os.path.relpath. A real render
     died on it:
       node 70: Value not in list [unet_name] =
         flux_klein_9B\aisha....safetensors ... not in (list of length 24)
     with the file sitting exactly where it should. Only names with a SUBFOLDER
     can carry the bug, so a test that only ever checked loose files would have
     stayed green through the whole thing. */
  check("scan: names use FORWARD slashes, which is what ComfyUI matches against",
    ck.every((n) => !n.includes("\\")) && ck.some((n) => n.includes("/")), ck);
  check("scan: the folder field agrees with the name's own separator",
    s.categories.checkpoints.files.every((f) =>
      f.folder === "" || f.name.startsWith(f.folder + "/")),
    s.categories.checkpoints.files);
  check("scan: a non-model file is not offered", !ck.some((n) => /readme/.test(n)), ck);
  check("scan: a .gguf under unet lands in diffusion_models",
    s.categories.diffusion_models.files.some((f) => f.name === "flux1-dev.gguf"),
    s.categories.diffusion_models.files);
  check("scan: vae is scanned",
    s.categories.vae.files.some((f) => f.name === "ae.safetensors"), s.categories.vae.files);

  // the folder filter's option list
  check("scan: folders lists the subfolders present",
    s.categories.checkpoints.folders.includes("SDXL"), s.categories.checkpoints.folders);
  check("scan: a loose file is reported under the empty folder",
    s.categories.checkpoints.folders.includes(""), s.categories.checkpoints.folders);
  check("scan: loras folders cover both loose and nested",
    s.categories.loras.folders.includes("") && s.categories.loras.folders.includes("flux"),
    s.categories.loras.folders);
  check("scan: every file carries the folder it is in",
    s.categories.loras.files.every((f) => typeof f.folder === "string"), s.categories.loras.files);
  check("scan: files are sorted",
    JSON.stringify(ck) === JSON.stringify([...ck].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }))), ck);
}
{
  // the same relative name in two roots: ComfyUI shows ONE row and resolves it
  // by search order, so two identical strings would be an unusable menu
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  const other = mk(path.join(root, "other"));
  touch(comfy, path.join("models", "loras", "dup.safetensors"));
  touch(other, "dup.safetensors");
  fs.writeFileSync(path.join(comfy, "extra_model_paths.yaml"),
    `x:\n    base_path: ${root}\n    loras: other\n`);
  const s = M.scan(comfy);
  const names = s.categories.loras.files.map((f) => f.name);
  check("scan: a name present in two roots appears once",
    names.filter((n) => n === "dup.safetensors").length === 1, names);
}

// ============================================================== never lies
{
  const s = M.scan("");
  check("scan: no ComfyUI folder set is reported, not silently empty",
    s.ok && s.warnings.some((w) => /No ComfyUI folder/.test(w)), s.warnings);
  const s2 = M.scan(path.join(os.tmpdir(), "definitely-not-here-" + Date.now()));
  check("scan: a missing folder is reported with the path",
    s2.warnings.some((w) => /does not exist/.test(w)), s2.warnings);
  check("scan: it still returns the full category shape when it found nothing",
    Object.keys(s2.categories).length === Object.keys(M.CATEGORIES).length
    && s2.categories.loras.files.length === 0, Object.keys(s2.categories));
}
{
  // an unreadable yaml must not take the dialog down with it
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  fs.writeFileSync(path.join(comfy, "extra_model_paths.yaml"), ":\n\t\t- [[[\n");
  let threw = null, s = null;
  try { s = M.scan(comfy); } catch (e) { threw = e.message; }
  check("scan: a malformed yaml never throws", threw === null && s && s.ok === true, threw);
}
{
  for (const [n, arg] of [["null", null], ["undefined", undefined],
                          ["a number", 42], ["an object", {}]]) {
    let threw = null, s = null;
    try { s = M.scan(arg); } catch (e) { threw = e.message; }
    check("scan: never throws on " + n, threw === null && s && typeof s === "object", threw);
  }
}
{
  check("MODEL_CATEGORIES is what a style's Model field may draw from",
    M.MODEL_CATEGORIES.every((c) => c in M.CATEGORIES), M.MODEL_CATEGORIES);
}

// ================================================= asking ComfyUI directly
// The folder scan MIRRORS ComfyUI's conventions; /object_info IS the dropdown.
// 2.72.0 exists because a mirror was wrong, so these pin that the live answer
// wins and that an absent ComfyUI degrades to the scan rather than to nothing.
{
  const objectInfo = {
    "UNETLoader": { input: { required: { unet_name: [["flux_klein_9B/aisha.safetensors",
                                                      "flux1-dev.gguf"], {}] } } },
    "CheckpointLoaderSimple": { input: { required: { ckpt_name: [["only_comfy_knows.safetensors"], {}] } } },
    /* BACKSLASH ON PURPOSE. ComfyUI's /object_info spells a subfolder with
       os.path.relpath, so on Windows its combo values contain backslashes.
       folderOf() split on "/" alone, so every live entry got an empty folder
       and the filter dropdowns listed NOTHING on a machine with 433 LoRAs in
       subfolders. This fixture used to say "flux/filmgrain" and therefore could
       never have caught it. */
    "LoraLoader": { input: { required: { lora_name: [["flux\\filmgrain.safetensors"], {}] } } },
  };
  const fakeFetch = async (u) => {
    const cls = u.split("/object_info/")[1];
    if (!objectInfo[cls]) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ [cls]: objectInfo[cls] }) };
  };

  check("live: the combo list is pulled out of an /object_info answer",
    JSON.stringify(M.comboFrom({ UNETLoader: objectInfo.UNETLoader }, "UNETLoader", "unet_name"))
      === JSON.stringify(["flux_klein_9B/aisha.safetensors", "flux1-dev.gguf"]), null);
  check("live: a shape it does not recognise gives null, not a crash",
    M.comboFrom({}, "UNETLoader", "unet_name") === null
    && M.comboFrom({ UNETLoader: { input: { required: {} } } }, "UNETLoader", "unet_name") === null, null);

  (async () => {
    const live = await M.liveLists("http://comfy.test", { fetch: fakeFetch });
    check("live: every configured loader class is asked",
      live.categories.diffusion_models.includes("flux1-dev.gguf")
      && live.categories.loras.includes("flux\\filmgrain.safetensors"), live.categories);
    // a class the install does not have must not take the rest down with it
    check("live: a missing loader class is skipped, not fatal",
      !("vae" in live.categories) && live.categories.checkpoints.length === 1, live.categories);

    const root = fresh();
    const comfy = mk(path.join(root, "ComfyUI"));
    touch(comfy, path.join("models", "checkpoints", "on_disk_only.safetensors"));
    touch(comfy, path.join("models", "loras", "flux", "filmgrain.safetensors"));

    const merged = await M.list(comfy, "http://comfy.test", { fetch: fakeFetch });
    check("list: when ComfyUI answers, its list wins", merged.source === "comfyui", merged.source);
    const ck2 = merged.categories.checkpoints.files.map((f) => f.name);
    // THE POINT: a name ComfyUI does not offer cannot be selected, however sure
    // the folder scan is that the file is there
    check("list: a file on disk that ComfyUI does not list is not offered",
      !ck2.includes("on_disk_only.safetensors") && ck2.includes("only_comfy_knows.safetensors"), ck2);
    const lo = merged.categories.loras.files.find((f) => f.name === "flux\\filmgrain.safetensors");
    check("list: a live name still picks up its folder, for the filter",
      lo && lo.folder === "flux", lo);
    check("list: and its size and root from the scan, when the scan saw it too",
      lo && lo.root, lo);

    const off = await M.list(comfy, "http://comfy.test", { fetch: async () => { throw new Error("down"); } });
    check("list: an unreachable ComfyUI falls back to the folder scan",
      off.source === "folders"
      && off.categories.checkpoints.files.some((f) => f.name === "on_disk_only.safetensors"), off.source);
    check("list: and SAYS the list is derived rather than authoritative",
      off.warnings.some((w) => /not answering/.test(w)), off.warnings);

    const nourl = await M.list(comfy, "", { fetch: fakeFetch });
    check("list: no url configured is not an error", nourl.source === "folders", nourl.source);

    // ============================================================ diffusers
// A diffusers model is a FOLDER (model_index.json + unet/ + vae/ + ...), and
// ComfyUI's DiffusersLoader offers the relative DIRECTORY. Listing the
// .safetensors inside one would offer "sdxl/unet/diffusion_pytorch_model.safetensors"
// — a real file, and a value ComfyUI will never accept.
{
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  touch(comfy, path.join("models", "diffusers", "sdxl-base", "model_index.json"), "{}");
  touch(comfy, path.join("models", "diffusers", "sdxl-base", "unet", "diffusion_pytorch_model.safetensors"));
  touch(comfy, path.join("models", "diffusers", "sdxl-base", "vae", "diffusion_pytorch_model.safetensors"));
  touch(comfy, path.join("models", "diffusers", "vendor", "nested", "model_index.json"), "{}");
  touch(comfy, path.join("models", "diffusers", "loose.safetensors"));
  const s = M.scan(comfy);
  const d = s.categories.diffusers.files.map((f) => f.name);
  check("diffusers: the FOLDER is the entry", d.includes("sdxl-base"), d);
  check("diffusers: a nested one keeps its subfolder path",
    d.includes("vendor/nested"), d);
  // the whole point — descending would offer sub-models as models
  check("diffusers: the weights INSIDE a model are not offered",
    !d.some((n) => n.includes("unet") || n.includes("diffusion_pytorch")), d);
  check("diffusers: a loose file with no model_index.json is not a diffusers model",
    !d.some((n) => /loose/.test(n)), d);
  check("diffusers: the folder filter can still separate them",
    s.categories.diffusers.folders.includes("vendor"), s.categories.diffusers.folders);
  // and it must NOT have polluted the checkpoints category
  check("diffusers: they are their own category, not folded into checkpoints",
    s.categories.checkpoints.files.length === 0, s.categories.checkpoints.files);
  check("diffusers: but the Model dropdown draws from both",
    M.MODEL_CATEGORIES.includes("checkpoints") && M.MODEL_CATEGORIES.includes("diffusers")
    && M.MODEL_CATEGORIES.includes("diffusion_models"), M.MODEL_CATEGORIES);
  // folding them into checkpoints would have been erased by the live merge,
  // because CheckpointLoaderSimple's dropdown does not contain them
  check("diffusers: it has its own loader class for the live list",
    (M.LIVE_CLASSES.diffusers || []).some(([c, k]) =>
      c === "DiffusersLoader" && k === "model_path"), M.LIVE_CLASSES.diffusers);
}
{
  // yaml-declared diffusers folders count too
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  touch(root, path.join("shared", "dif", "extra-model", "model_index.json"), "{}");
  fs.writeFileSync(path.join(comfy, "extra_model_paths.yaml"),
    `x:\n    base_path: ${root}/shared\n    diffusers: dif\n`);
  const s = M.scan(comfy);
  check("diffusers: an extra_model_paths.yaml diffusers folder is scanned",
    s.categories.diffusers.files.some((f) => f.name === "extra-model"),
    s.categories.diffusers.files);
}

// ======================================================= extension set
{
  // ComfyUI's own supported_pt_extensions. A file it WILL load must not be
  // missing from a dropdown, and one it will not must not appear.
  for (const e of [".ckpt", ".pt", ".pt2", ".bin", ".pth", ".safetensors", ".pkl", ".sft"])
    check(`extensions: ComfyUI loads ${e}, so it is listed`, M.MODEL_EXT.has(e), e);
  for (const e of [".txt", ".json", ".yaml", ".md", ".png"])
    check(`extensions: ${e} is not a model and is not listed`, !M.MODEL_EXT.has(e), e);
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  touch(comfy, path.join("models", "vae", "ae.safetensors"));
  touch(comfy, path.join("models", "vae", "legacy.pt"));
  touch(comfy, path.join("models", "vae", "newer.pt2"));
  touch(comfy, path.join("models", "vae", "notes.md"));
  touch(comfy, path.join("models", "clip", "t5xxl.safetensors"));
  touch(comfy, path.join("models", "text_encoders", "clip_l.safetensors"));
  const s = M.scan(comfy);
  const v = s.categories.vae.files.map((f) => f.name);
  check("vae: every model file in the vae folder is listed",
    v.includes("ae.safetensors") && v.includes("legacy.pt") && v.includes("newer.pt2"), v);
  check("vae: a non-model file is still not offered", !v.includes("notes.md"), v);
  const te = s.categories.text_encoders.files.map((f) => f.name);
  check("text encoders: both the clip and text_encoders folders are listed",
    te.includes("t5xxl.safetensors") && te.includes("clip_l.safetensors"), te);
}

// ============ where an extra_model_paths.yaml can live (2.77.0) ============
// "Is it reading my yaml?" must be answerable by LOOKING. The scan now reports
// every candidate location, which one it used, and any others that exist.
{
  const root = fresh();
  const comfy = mk(path.join(root, "ComfyUI"));
  const s0 = M.scan(comfy);
  check("candidates are reported even when none exists",
    Array.isArray(s0.yaml_candidates) && s0.yaml_candidates.length > 0
    && s0.yaml_candidates.every((c) => c.exists === false), s0.yaml_candidates);
  check("the default location beside main.py is a candidate",
    s0.yaml_candidates.some((c) => c.path === path.join(comfy, "extra_model_paths.yaml")),
    s0.yaml_candidates.map((c) => c.path));

  fs.writeFileSync(path.join(comfy, "extra_model_paths.yaml"), "x:\n    loras: l\n");
  const s1 = M.scan(comfy);
  const used = s1.yaml_candidates.filter((c) => c.used);
  check("exactly one candidate is marked used", used.length === 1, used);
  check("...and it is the one that was actually read",
    used[0].path === s1.yaml, [used[0], s1.yaml]);

  // An explicit override is the answer when ComfyUI is launched with
  // --extra-model-paths-config and the file is somewhere unguessable.
  const far = path.join(root, "elsewhere.yaml");
  mk(path.join(root, "far", "loras"));
  fs.writeFileSync(far, `y:\n    base_path: ${root}/far\n    loras: loras\n`);
  const s2 = M.scan(comfy, { extraPaths: far });
  check("an explicit override wins over the default location",
    s2.yaml === far, s2.yaml);
  check("...and its folders are actually searched",
    s2.categories.loras.roots.some((r) => r.dir === path.join(root, "far", "loras")),
    s2.categories.loras.roots);
  // ComfyUI reads ONE file. A second one existing must be REPORTED, not merged
  // in — listing models the running ComfyUI cannot see is the "Value not in
  // list" failure this whole area keeps producing.
  check("a second yaml that exists is reported rather than merged",
    (s2.yaml_also_found || []).includes(path.join(comfy, "extra_model_paths.yaml")),
    s2.yaml_also_found);
  check("...and it is surfaced as a warning, not buried",
    s2.warnings.some((w) => /more than one extra_model_paths/.test(w)), s2.warnings);
  check("yamlCandidates never throws without a folder",
    Array.isArray(M.yamlCandidates("", "")) , null);
}

// ====== WINDOWS SEPARATORS IN THE LIVE LIST (2.77.1) ======
// ComfyUI's /object_info on Windows returns names built with os.path.relpath,
// so they contain BACKSLASHES. folderOf() split on "/" only, so every live
// entry got a folder of "" and the filter dropdowns listed nothing at all on a
// machine with 190 checkpoints and 433 LoRAs in subfolders. The FOLDER SCAN
// emits forward slashes, which is why this only appeared once ComfyUI became
// the authoritative source.
check("folderOf handles a Windows name from /object_info",
  M.folderOf("flux_klein_9B\\aisha.safetensors") === "flux_klein_9B",
  M.folderOf("flux_klein_9B\\aisha.safetensors"));
check("folderOf still handles a scanned forward-slash name",
  M.folderOf("flux/grain.safetensors") === "flux", null);
check("folderOf normalises a nested Windows path to one grouping key",
  M.folderOf("a\\b\\c.safetensors") === "a/b",
  "otherwise the same folder appears twice, once per spelling");
check("folderOf answers empty for a loose file",
  M.folderOf("loose.safetensors") === "" && M.folderOf("") === "", null);

// ===== the separator a Windows ComfyUI actually uses (2.84.2) ==============
// This suite runs on Linux, where path.sep is already "/" — so the bug that
// cost Tim two rejected renders (a scan-derived name with forward slashes,
// against a validator holding backslashes) is INVISIBLE here unless the
// separator is passed in. That is why entryName() takes one.
{
  const p2 = require("path");
  check("an entry is named relative to its search root",
    M.entryName("/m/loras", "/m/loras/flux/grain.safetensors") === "flux/grain.safetensors",
    M.entryName("/m/loras", "/m/loras/flux/grain.safetensors"));
  check("ON WINDOWS it is spelled with backslashes, exactly as os.path.relpath "
    + "gives ComfyUI — combo validation is an exact string match",
    M.entryName("/m/loras", "/m/loras/flux/grain.safetensors", "\\")
    === "flux\\grain.safetensors",
    M.entryName("/m/loras", "/m/loras/flux/grain.safetensors", "\\"));
  check("a top-level file has no separator either way",
    M.entryName("/m", "/m/a.safetensors") === "a.safetensors"
    && M.entryName("/m", "/m/a.safetensors", "\\") === "a.safetensors", null);
  check("nesting deeper than one folder keeps every separator",
    M.entryName("/m", "/m/a/b/c.safetensors", "\\") === "a\\b\\c.safetensors",
    M.entryName("/m", "/m/a/b/c.safetensors", "\\"));
  check("the default is the platform's own separator, which is what ComfyUI "
    + "running on the SAME machine will have used",
    M.entryName("/m", "/m/a/b.safetensors") ===
    ["a", "b.safetensors"].join(p2.sep), null);
  // The grouping key must NOT follow: it is a label, and a category fed by both
  // sources would otherwise show the same folder twice under two spellings.
  check("...while the derived folder key stays forward-slashed either way",
    M.folderOf("a\\b\\c.safetensors") === "a/b" && M.folderOf("a/b/c.safetensors") === "a/b",
    [M.folderOf("a\\b\\c.safetensors"), M.folderOf("a/b/c.safetensors")]);
}

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);


console.log("=======================");
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
}

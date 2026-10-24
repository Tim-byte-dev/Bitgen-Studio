// bitGen Studio — lib/miscMigrate.js (2.591.0): THE APP ROOT IS TIDY - its files live in misc/.
//
// Tim: "can we put all the files that are in the app root except for start.bat in a folder call it misc" (picked: the
// root keeps start.bat, package.json + package-lock.json (npm needs them beside node_modules), README.md and LICENSE (the
// GitHub page shows them from there) and the hidden .gitignore). An install updated from the full / repo zip (not git)
// still has the OLD copies in its root - they are tidied away at start:
//   quick_prompts.json  (the user's own prompts) -> misc/quick_prompts.json (it replaces the shipped one), then removed
//   every other moved file -> removed when misc/ has its own (an old copy), else moved into misc/
// Never anything else: only the names in MOVED, only in the app folder itself. A file that will not go (open, read-only)
// stays - next start tries again.
//   run(base?) -> {moved: [], removed: [], kept: []}       MOVED (the names)
"use strict";
const fs = require("fs");
const path = require("path");

const MOVED = ["CHANGELOG.md", "CONTINUATION-NOTES-2_137_1.md", "CONTINUE.md", "CONTRIBUTING.md", "FOLDER-STRUCTURE.md", "HANDOVER-ARCHIVE.md",
  "HANDOVER.md", "NOTICE.md", "SECURITY.md", "WORKING-VERSIONS.md", "_gitignore", "bitgen-studio.sh", "bridge_worker.py", "cad_worker.py",
  "clear-comfy.bat", "default.settings", "dlss5_worker.py", "download-models.ps1", "finetune_worker.py", "get-comfy.ps1", "get-electron.ps1",
  "get-llama.ps1", "get-qwen3vl.ps1", "get-sd-cli.ps1", "get-yue2.ps1", "graph_worker.py", "image_worker.py", "karaoke_worker.py", "lora_worker.py",
  "ltx_worker.py", "mesh3d_worker.py", "minimax-fixed.txt", "music_worker.py", "push-to-github.bat", "quick_prompts.json", "requirements.txt",
  "reset-layout.bat", "ripple_worker.py", "seedvr2_worker.py", "server.js", "swap_worker.py", "unflatten.ps1", "viggle_native_worker.py",
  "viggle_worker.py", "vr_world_worker.py", "wan_worker.py", "worker.py"];
const USER = ["quick_prompts.json"];                      // the user's copy wins over the shipped one

function run(base) {
  const b = base || require("./core").BASE, misc = path.join(b, "misc");
  const out = { moved: [], removed: [], kept: [] };
  if (!fs.existsSync(misc)) return out;                    // not this layout (a test folder, an old tree)
  for (const n of MOVED) {
    const old = path.join(b, n), now = path.join(misc, n);
    let st = null; try { st = fs.lstatSync(old); } catch { continue; }
    if (!st.isFile()) continue;
    try {
      if (USER.includes(n) || !fs.existsSync(now)) { fs.copyFileSync(old, now); fs.rmSync(old, { force: true }); out.moved.push(n); }
      else { fs.rmSync(old, { force: true }); out.removed.push(n); }
    } catch { out.kept.push(n); }
  }
  if (out.moved.length || out.removed.length) console.log(`[bitgen-studio] tidied the app folder into misc/: ${out.moved.length} moved, ${out.removed.length} old copies removed`);
  return out;
}
module.exports = { MOVED, USER, run };

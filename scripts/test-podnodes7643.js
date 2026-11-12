#!/usr/bin/env node
/* bitGen Studio — 2.764.3 units: A STYLE'S CUSTOM NODES ARE CLONED ON THE POD FROM THEIR GIT ADDRESS, not uploaded from this
 * computer (lib/podNodes.js repoUrl, fromPyproject, fromManagerList, refsOf, findRepo, mirrorCode refs, mirror).
 * Tim (verbatim): "add the custom nodes needed from their git repos to the pod if the style needs it. it is tooo slow from the pc" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http"), { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const N = require("../lib/podNodes");

(async () => {
  check("repoUrl: a known git host -> https://host/owner/repo (no .git, no /tree/…); other sites -> \"\"",
    N.repoUrl("https://github.com/kijai/ComfyUI-KJNodes.git") === "https://github.com/kijai/ComfyUI-KJNodes" && N.repoUrl("git+https://www.github.com/a/b/tree/main/x") === "https://github.com/a/b"
    && N.repoUrl("https://gitlab.com/o/r") === "https://gitlab.com/o/r" && N.repoUrl("https://example.com/a/b") === "" && N.repoUrl("") === "");
  const pp = N.fromPyproject('[project]\nname = "comfyui-kjnodes"\nversion = "1.1.7"\n\n[project.urls]\nRepository = "https://github.com/kijai/ComfyUI-KJNodes"\n\n[tool.comfy]\nPublisherId = "kijai"\n');
  check("fromPyproject: [project.urls] Repository + [project] version", pp.url === "https://github.com/kijai/ComfyUI-KJNodes" && pp.version === "1.1.7", pp);
  check("…Homepage / Source too; a github address anywhere as the last resort; nothing = \"\"",
    N.fromPyproject('[project.urls]\nHomepage = "https://github.com/a/b"').url === "https://github.com/a/b" && N.fromPyproject('description = "see https://github.com/c/d for more"').url === "https://github.com/c/d" && N.fromPyproject("[project]\nname='x'").url === "");
  const ml = [{ title: "KJNodes", reference: "https://github.com/kijai/ComfyUI-KJNodes", files: ["https://github.com/kijai/ComfyUI-KJNodes"], install_type: "git-clone" }, { id: "comfyui-foo", reference: "https://github.com/x/ComfyUI-Foo", files: [] }];
  check("fromManagerList: by the repo's name (any case) or the registry id", N.fromManagerList(ml, "comfyui-kjnodes") === "https://github.com/kijai/ComfyUI-KJNodes" && N.fromManagerList(ml, "comfyui-foo") === "https://github.com/x/ComfyUI-Foo" && N.fromManagerList(ml, "nope") === "");
  check("refsOf: v1.2.3 and 1.2.3 (no version = none)", JSON.stringify(N.refsOf("1.2.3")) === '["v1.2.3","1.2.3"]' && JSON.stringify(N.refsOf("v2")) === '["v2","2"]' && N.refsOf("").length === 0);

  /* ---- findRepo on real folders: bitGen's list, pyproject, Manager's list, the Comfy Registry (a stand-in), none */
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "pn7643-")), CN = path.join(T, "ComfyUI", "custom_nodes");
  const mk = (n, files) => { fs.mkdirSync(path.join(CN, n), { recursive: true }); for (const [f, t] of Object.entries(files || {})) fs.writeFileSync(path.join(CN, n, f), t); return { folder: n, git: "", commit: "", local: path.join(CN, n) }; };
  const a = mk("ComfyUI-H3-NativeAudioLock", { "__init__.py": "" });
  const b = mk("comfyui-somepack", { "pyproject.toml": '[project]\nversion = "1.1.7"\n[project.urls]\nRepository = "https://github.com/some/ComfyUI-SomePack"\n' });
  const b2 = mk("comfyui-kjnodes", {});
  const c = mk("ComfyUI-Foo", { "__init__.py": "" });
  fs.mkdirSync(path.join(CN, "ComfyUI-Manager"), { recursive: true });
  fs.writeFileSync(path.join(CN, "ComfyUI-Manager", "custom-node-list.json"), JSON.stringify({ custom_nodes: ml }));
  const d = mk("comfyui-reg", { ".tracking": "x" });
  const e = mk("MyPrivateNodes", { "__init__.py": "" });
  const reg = http.createServer((q, s) => { s.writeHead(/\/nodes\/comfyui-reg$/.test(q.url) ? 200 : 404, { "Content-Type": "application/json" }); s.end(/comfyui-reg/.test(q.url) ? JSON.stringify({ id: "comfyui-reg", repository: "https://github.com/reg/ComfyUI-Reg" }) : "{}"); });
  await new Promise((r) => reg.listen(0, "127.0.0.1", r));
  process.env.H3_COMFY_REGISTRY = "http://127.0.0.1:" + reg.address().port;
  const fa = await N.findRepo(a, CN), fb = await N.findRepo(b, CN), fb2 = await N.findRepo(b2, CN), fc = await N.findRepo(c, CN), fd = await N.findRepo(d, CN), fe = await N.findRepo(e, CN);
  reg.close();
  check("findRepo: in bitGen's node list (lib/nodePacks.json) -> its address (NativeAudioLock: the folder inside its repo; KJNodes by any case)", fa.url === "https://github.com/Shrek3OnVH5/MiniMax-H3-NativeAudio-MusicVideo-Workflow" && fa.subdir === "custom_nodes/ComfyUI-H3-NativeAudioLock" && fa.from === "bitGen's node list" && fb2.url === "https://github.com/kijai/ComfyUI-KJNodes", { fa, fb2 });
  check("…its pyproject.toml -> its address + its version's tags", fb.url === "https://github.com/some/ComfyUI-SomePack" && fb.refs.join() === "v1.1.7,1.1.7" && fb.from === "its pyproject.toml", fb);
  check("…ComfyUI-Manager's node list on this computer", fc.url === "https://github.com/x/ComfyUI-Foo" && fc.from === "ComfyUI-Manager's list", fc);
  check("…installed from the Comfy Registry (.tracking): the registry's repository", fd.url === "https://github.com/reg/ComfyUI-Reg" && fd.from === "the Comfy Registry", fd);
  check("…nowhere (homemade) -> \"\" (only then uploaded); a single .py is uploaded", fe.url === "" && (await N.findRepo({ folder: "x.py", file: true, local: "/nope" }, CN)).url === "");

  /* ---- the pod's side: a clone checks out the version's tag (a real git repo here, file://) */
  const git = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8", env: Object.assign({}, process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" }) });
  const R = path.join(T, "repo"); fs.mkdirSync(R);
  if (git(["--version"]).status === 0) {
    git(["init", "-q"], R); fs.writeFileSync(path.join(R, "a.txt"), "1"); git(["add", "."], R); git(["commit", "-qm", "one"], R); git(["tag", "v1.0.0"], R);
    const tagSha = git(["rev-parse", "HEAD"], R).stdout.trim();
    fs.writeFileSync(path.join(R, "a.txt"), "2"); git(["commit", "-qam", "two"], R);
    const POD = path.join(T, "pod"), cwd = path.join(T, "cwd"); fs.mkdirSync(path.join(POD, "custom_nodes"), { recursive: true }); fs.mkdirSync(cwd);
    fs.mkdirSync(path.join(R, "custom_nodes", "Inner"), { recursive: true }); fs.writeFileSync(path.join(R, "custom_nodes", "Inner", "__init__.py"), "X = 1\n"); git(["add", "."], R); git(["commit", "-qm", "three"], R);
    const code = N.mirrorCode([{ folder: "Tagged", git: "file://" + R, commit: "", refs: ["v1.0.0", "1.0.0"] }, { folder: "Untagged", git: "file://" + R, commit: "", refs: ["v9.9.9"] }, { folder: "Inner", git: "file://" + R, commit: "", refs: [], subdir: "custom_nodes/Inner" }], POD)
      .replace("save(); threading.Thread(target=run, daemon=True).start()", "save(); run()");
    const py = spawnSync("python3", ["-c", code], { cwd, encoding: "utf8", timeout: 60000 });
    const st = JSON.parse(fs.readFileSync(path.join(cwd, ".bitgen_mirror.json"), "utf8"));
    const at = git(["rev-parse", "HEAD"], path.join(POD, "custom_nodes", "Tagged")).stdout.trim();
    check("on the pod: cloned, then its version's tag checked out (v1.0.0, not the newest)", py.status === 0 && st.packs[0].state === "done" && at === tagSha, { st, at, tagSha, err: py.stderr });
    check("…a tag that is not there: the newest one, and it says so", st.packs[1].state === "done" && /version tag was not found/.test(st.packs[1].note), st.packs[1]);
    check("…a pack inside a bigger repo (NativeAudioLock): the repo cloned aside, its folder linked into custom_nodes", st.packs[2].state === "done" && fs.existsSync(path.join(POD, "custom_nodes", "Inner", "__init__.py")) && fs.lstatSync(path.join(POD, "custom_nodes", "Inner")).isSymbolicLink(), st.packs[2]);
  } else check("(no git here - the clone on the pod not tried)", true);

  const PN = fs.readFileSync(path.join(ROOT, "lib", "podNodes.js"), "utf8");
  check("mirror: every pack without a checkout is looked up first - cloned on the pod when found (the log says from where), uploaded only when nowhere / the clone fails (private)",
    /const f = await findRepo\(k, o\.dir\)/.test(PN) && /": cloning it on the pod from " \+ f\.url \+ " \(found in " \+ f\.from \+ "\)"/.test(PN) && /no git address found anywhere for it - uploading it from this computer/.test(PN) && /\(private or not reachable\) - uploading from this computer/.test(PN));
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env python3
"""bitGen Studio 2.900.0 - the bitGen pod image's scripts (misc/pod-image) run for real against stand-ins.

GitHub builds the real image (.github/workflows/pod-image.yml: RunPod's PyTorch image, a real ComfyUI, a start-up test). Here
the three scripts run in a temporary folder (POD_ROOT) with git's addresses pointed at stand-in repos (a ComfyUI with a
main.py that answers --quick-test-for-ci, the node packs from lib/nodePacks.json), so no download and no graphics card:
  bake.sh       ComfyUI at workspace/ComfyUI with its venv, the markers lib/podInstall.js reads (.bitgen_pip_ok = the commit,
                .bitgen_install.json by bitGen), ComfyUI-Manager + the packs in custom_nodes, then moved to opt/bitgen
  pre_start.sh  copies it to workspace/ComfyUI on the first start only; a later start leaves it (and what bitGen added);
                a workspace/ComfyUI that is not a ComfyUI is moved aside, never deleted
  post_start.sh starts ComfyUI in the background with bitGen's arguments (24 GB+ card: --disable-dynamic-vram --highvram when
                its cli_args knows them), leaves a pod bitGen made to bitGen (BITGEN_MADE=1), BITGEN_NO_COMFY / _ARGS
Run: python3 scripts/test-podimage900.py
"""
import json, os, subprocess, sys, tempfile, time, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PI = os.path.join(REPO, "misc", "pod-image")
ok = fail = 0


def check(name, cond, extra=""):
    global ok, fail
    if cond:
        ok += 1; print("ok   ", name)
    else:
        fail += 1; print("FAIL ", name, extra)


def sh(cmd, cwd=None, env=None, check_rc=True):
    r = subprocess.run(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600)
    if check_rc and r.returncode != 0:
        print(r.stdout); raise SystemExit("command failed: " + " ".join(cmd))
    return r


def git_repo(path, files):
    os.makedirs(path, exist_ok=True)
    for name, text in files.items():
        p = os.path.join(path, name); os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "w").write(text)
    g = ["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "init.defaultBranch=master"]
    sh(g + ["init", "-q"], cwd=path); sh(g + ["add", "-A"], cwd=path); sh(g + ["commit", "-qm", "x"], cwd=path)


T = tempfile.mkdtemp(prefix="podimage900-")
try:
    stand = os.path.join(T, "stand")
    # a stand-in ComfyUI: answers --quick-test-for-ci, writes its arguments when started for real (post_start), and knows the
    # GPU-memory flags in comfy/cli_args.py
    main = (
        "import sys, os, json, time\n"
        "if '--quick-test-for-ci' in sys.argv:\n"
        "    print('Import times for custom nodes:'); print('quick test ok'); sys.exit(0)\n"
        "open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'started.json'), 'w').write(json.dumps({'argv': sys.argv[1:], 'py': sys.executable}))\n"
        "time.sleep(2)\n"
    )
    git_repo(os.path.join(stand, "comfyanonymous", "ComfyUI"), {
        "main.py": main, "requirements.txt": "", "comfyui_version.py": '__version__ = "0.9.1"\n',
        "comfy/cli_args.py": "parser.add_argument('--highvram')\nparser.add_argument('--disable-dynamic-vram')\n",
        "custom_nodes/example_node.py.example": "",
    })
    packs = json.load(open(os.path.join(REPO, "lib", "nodePacks.json")))["packs"]
    want = [l.split("#")[0].strip() for l in open(os.path.join(PI, "packs.txt")) if l.split("#")[0].strip()]
    check("packs.txt names packs that are all in lib/nodePacks.json", all(any(p["id"] == w for p in packs) for w in want), str(want))
    check("ComfyUI-Manager is one of them (bitGen's install step 'manager' then finds it)", "manager" in want)
    for w in want:
        p = next(x for x in packs if x["id"] == w)
        path = p["url"].replace("https://github.com/", "")
        if path.endswith(".git"): path = path[:-4]
        files = {"__init__.py": "NODE_CLASS_MAPPINGS = {}\n"}
        if w == "kjnodes": files["requirements.txt"] = ""   # a pack with (empty) requirements: pip runs for it
        git_repo(os.path.join(stand, path), files)
    # git's GitHub addresses -> the stand-ins (both with and without .git)
    env = dict(os.environ, GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="url." + stand + "/.insteadOf", GIT_CONFIG_VALUE_0="https://github.com/",
               POD_ROOT=os.path.join(T, "root"), POD_HERE=os.path.join(T, "here"), PIP_NO_INDEX="1", PIP_DISABLE_PIP_VERSION_CHECK="1",
               BITGEN_IMAGE="ghcr.io/tim-byte-dev/bitgen-pod:test")
    for p in packs:   # the stand-ins answer to "x.git" too
        u = p["url"].replace("https://github.com/", "")
        if u.endswith(".git"):
            d = os.path.join(stand, u)
            if not os.path.exists(d): os.symlink(os.path.join(stand, u[:-4]), d)
    os.makedirs(env["POD_HERE"])
    shutil.copy(os.path.join(REPO, "lib", "nodePacks.json"), env["POD_HERE"]); shutil.copy(os.path.join(PI, "packs.txt"), env["POD_HERE"])
    R = env["POD_ROOT"]

    # ---------------- bake.sh
    r = sh(["bash", os.path.join(PI, "bake.sh")], env=env, check_rc=False)
    check("bake.sh runs to the end", r.returncode == 0, r.stdout[-1500:])
    seed = os.path.join(R, "opt", "bitgen", "ComfyUI")
    check("ComfyUI moved out of workspace to opt/bitgen (RunPod mounts the pod's disk over /workspace)",
          os.path.isfile(os.path.join(seed, "main.py")) and not os.path.exists(os.path.join(R, "workspace", "ComfyUI")))
    head = sh(["git", "-C", seed, "rev-parse", "HEAD"]).stdout.strip()
    check(".bitgen_pip_ok = ComfyUI's commit (bitGen's pip step: 'already installed')", open(os.path.join(seed, ".bitgen_pip_ok")).read().strip() == head)
    j = json.load(open(os.path.join(seed, ".bitgen_install.json")))
    check(".bitgen_install.json by bitGen, its version, the python at /workspace", j.get("by") == "bitGen" and j.get("version") == "0.9.1"
          and j.get("python") == os.path.join(R, "workspace", "ComfyUI", "venv", "bin", "python") and j.get("image") == "ghcr.io/tim-byte-dev/bitgen-pod:test", str(j))
    check("every pack baked in (none left out)", len(j.get("packs", [])) == len(want) and not j.get("packs_left_out"), str(j))
    check("the venv reuses the image's PyTorch (--system-site-packages)",
          "include-system-site-packages = true" in open(os.path.join(seed, "venv", "pyvenv.cfg")).read())
    folders = {p["id"]: p["folder"] for p in packs}
    check("ComfyUI-Manager in custom_nodes", os.path.isdir(os.path.join(seed, "custom_nodes", "ComfyUI-Manager")))
    check("each pack in its lib/nodePacks.json folder", all(os.path.isfile(os.path.join(seed, "custom_nodes", folders[w], "__init__.py")) for w in want))
    check("the start-up test ran (--cpu --quick-test-for-ci)", "start-up test" in r.stdout and "quick test ok" in r.stdout)
    check("comfy-commit.txt says which ComfyUI", open(os.path.join(R, "opt", "bitgen", "comfy-commit.txt")).read().strip() == head)

    # a pack that cannot be cloned is said and left out - the rest still bake
    shutil.rmtree(R)
    open(os.path.join(env["POD_HERE"], "packs.txt"), "a").write("nosuchpack\n")
    gone = os.path.join(stand, "rgthree", "rgthree-comfy"); shutil.move(gone, gone + ".x")
    r2 = sh(["bash", os.path.join(PI, "bake.sh")], env=dict(env, POD_SKIP_TEST="1"), check_rc=False)
    shutil.move(gone + ".x", gone)
    j2 = json.load(open(os.path.join(seed, ".bitgen_install.json")))
    check("a pack that will not clone + one not in nodePacks.json: left out, the bake goes on",
          r2.returncode == 0 and set(j2["packs_left_out"]) == {"rgthree", "nosuchpack"} and len(j2["packs"]) == len(want) - 1, str(j2) + r2.stdout[-600:])
    check("POD_SKIP_TEST=1: no start-up test", "start-up test" not in r2.stdout)
    shutil.copy(os.path.join(PI, "packs.txt"), env["POD_HERE"])

    # ---------------- pre_start.sh
    ws = os.path.join(R, "workspace"); D = os.path.join(ws, "ComfyUI")
    shutil.rmtree(ws, ignore_errors=True)
    r = sh(["bash", os.path.join(PI, "pre_start.sh")], env=env)
    check("first start: ComfyUI copied to the pod's disk", os.path.isfile(os.path.join(D, "main.py")) and "copying ComfyUI" in r.stdout)
    check("…with its venv, markers and packs", os.path.isfile(os.path.join(D, ".bitgen_pip_ok")) and os.path.isdir(os.path.join(D, "custom_nodes", "ComfyUI-Manager"))
          and os.path.exists(os.path.join(D, "venv", "bin", "python")))
    check("…still a git checkout (bitGen reads its commit)", sh(["git", "-C", D, "rev-parse", "HEAD"]).stdout.strip() == head)
    check("the ComfyUI log reachable from / and /workspace", os.path.isfile(os.path.join(ws, ".bitgen_comfy.log")) and os.path.islink(os.path.join(R, ".bitgen_comfy.log")))
    open(os.path.join(D, "custom_nodes", "added-by-bitgen.txt"), "w").write("x")
    r = sh(["bash", os.path.join(PI, "pre_start.sh")], env=env)
    check("a later start leaves it (and what bitGen added) alone", "already on the pod" in r.stdout and os.path.isfile(os.path.join(D, "custom_nodes", "added-by-bitgen.txt")))
    shutil.rmtree(D); os.makedirs(D); open(os.path.join(D, "mine.txt"), "w").write("keep")
    r = sh(["bash", os.path.join(PI, "pre_start.sh")], env=env)
    aside = [x for x in os.listdir(ws) if x.startswith("ComfyUI.before-bitgen-")]
    check("a /workspace/ComfyUI that is not a ComfyUI is moved aside (kept), then the copy made",
          len(aside) == 1 and os.path.isfile(os.path.join(ws, aside[0], "mine.txt")) and os.path.isfile(os.path.join(D, "main.py")))
    r = sh(["bash", os.path.join(PI, "pre_start.sh")], env=dict(env, POD_ROOT=os.path.join(T, "noseed")))
    check("no ComfyUI in the image: said, nothing breaks", r.returncode == 0 and "installs it when it first uses the pod" in r.stdout)

    # ---------------- post_start.sh (ComfyUI answers nowhere here: curl finds no port 8188 server unless one runs)
    def started(extra_env, wait=True):
        sj = os.path.join(D, "started.json")
        if os.path.exists(sj): os.remove(sj)
        rr = sh(["bash", os.path.join(PI, "post_start.sh")], env=dict(env, **extra_env))
        t0 = time.time()
        while wait and not os.path.exists(sj) and time.time() - t0 < 15: time.sleep(0.2)
        return rr, (json.load(open(sj)) if os.path.exists(sj) else None)
    rr, s = started({"POD_NO_GPU_GB": str(48 * 1024)})
    check("starts ComfyUI with its own venv python on 0.0.0.0:8188", s and s["argv"][:4] == ["--listen", "0.0.0.0", "--port", "8188"]
          and s["py"].endswith(os.path.join("ComfyUI", "venv", "bin", "python")), str(s) + rr.stdout)
    check("a 48 GB card: the models kept on it (--disable-dynamic-vram --highvram, as bitGen does)", s and s["argv"][4:] == ["--disable-dynamic-vram", "--highvram"], str(s))
    check("in the background (the script returns; ComfyUI is not the pod's main process)", "started (pid" in rr.stdout)
    check("its output goes to /workspace/.bitgen_comfy.log", "log: " + os.path.join(ws, ".bitgen_comfy.log") in rr.stdout)
    rr, s = started({"POD_NO_GPU_GB": str(16 * 1024)})
    check("a 16 GB card: no extra arguments", s and s["argv"] == ["--listen", "0.0.0.0", "--port", "8188"], str(s))
    rr, s = started({"POD_NO_GPU_GB": "0", "BITGEN_COMFY_ARGS": "--lowvram --preview-method auto"})
    check("BITGEN_COMFY_ARGS replaces bitGen's arguments", s and s["argv"][4:] == ["--lowvram", "--preview-method", "auto"], str(s))
    rr, s = started({"BITGEN_MADE": "1"}, wait=False)
    time.sleep(1)
    check("a pod bitGen made: left to bitGen (it starts ComfyUI with the PODS memory setting)", s is None and "made by bitGen Studio" in rr.stdout, rr.stdout)
    rr, s = started({"BITGEN_MADE": "1", "BITGEN_START_COMFY": "1", "POD_NO_GPU_GB": "0"})
    check("…unless BITGEN_START_COMFY=1", s is not None, rr.stdout)
    rr, s = started({"BITGEN_NO_COMFY": "1"}, wait=False)
    time.sleep(1)
    check("BITGEN_NO_COMFY=1: not started", s is None and "not started" in rr.stdout)
    rr = sh(["bash", os.path.join(PI, "post_start.sh")], env=dict(env, POD_ROOT=os.path.join(T, "noseed")))
    check("no ComfyUI on the pod: said, nothing breaks", rr.returncode == 0 and "not started" in rr.stdout)

    # ---------------- the image and the build agree with bitGen
    df = open(os.path.join(PI, "Dockerfile")).read()
    check("Dockerfile: the start scripts where RunPod's /start.sh runs them", "/pre_start.sh" in df and "/post_start.sh" in df)
    check("Dockerfile: the image linked to the repo (ghcr shows it, the package inherits the repo)", "org.opencontainers.image.source=\"https://github.com/Tim-byte-dev/Bitgen-Studio\"" in df)
    wf = open(os.path.join(REPO, ".github", "workflows", "pod-image.yml")).read()
    check("the workflow publishes ghcr.io/tim-byte-dev/bitgen-pod (lib/podImage.js finds the template by it)", "ghcr.io/tim-byte-dev/bitgen-pod" in wf and "packages: write" in wf)
    pi = open(os.path.join(REPO, "lib", "podInstall.js")).read()
    check("the markers are lib/podInstall.js's own", ".bitgen_pip_ok" in pi and ".bitgen_install.json" in pi and "'ComfyUI-Manager'" in pi and ".bitgen_comfy.log" in pi)
    bases = [l.strip() for l in open(os.path.join(PI, "bases.txt")) if l.strip() and not l.startswith("#")]
    check("bases.txt: RunPod PyTorch images with CUDA 12.8", bases and all(b.startswith("runpod/pytorch:") and ("cu1281" in b or "cuda12.8" in b) for b in bases), str(bases))
finally:
    subprocess.run(["pkill", "-f", os.path.join(T, "root")], stderr=subprocess.DEVNULL)
    shutil.rmtree(T, ignore_errors=True)

print("\nRESULT: %d passed, %d failed" % (ok, fail))
sys.exit(1 if fail else 0)

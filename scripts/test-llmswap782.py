"""bitGen Studio — 2.782.0: ONE POD FOR THE LLM AND COMFYUI - the pod's ComfyUI node (lib/podLlm.js proxyNodeCode) run for real
under a stand-in ComfyUI (PromptServer, its prompt handlers and queue, comfy.model_management) with a stand-in llama-server:
  a chat to a stopped LLM server -> ComfyUI's models unloaded, the server started from <root>/llm.cmd.json, the chat passed on;
  a picture / video queued (the prompt handler) -> the LLM server stopped (its VRAM free);
  the next chat -> unloaded + started again; share.json off -> a render leaves it running.
Tim (verbatim): "we should be able to run our llm, vllm,image and video of 1 pod by clearing vram before a new model loads"
Run: python3 scripts/test-llmswap782.py (needs aiohttp - ComfyUI has it)."""
import asyncio, json, os, socket, subprocess, sys, tempfile, time, types

try:
    from aiohttp import web, ClientSession
except ImportError:
    print("SKIP: aiohttp not installed"); print("\n0 passed, 0 failed"); sys.exit(0)

HERE = os.path.dirname(os.path.abspath(__file__))
PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1; print("PASS: " + name)
    else:
        FAIL += 1; print("FAIL: " + name + ("\n      " + repr(got) if got is not None else ""))


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


ROOT = tempfile.mkdtemp(prefix="llmswap-")
LLM_PORT = free_port()
node = subprocess.run(["node", "-e", "process.stdout.write(require('" + os.path.join(HERE, "..", "lib", "podLlm.js").replace("\\", "/") + "').proxyNodeCode())"], stdout=subprocess.PIPE, text=True).stdout
node = node.replace('ROOT = "/workspace/bitgen_llm"', "ROOT = " + json.dumps(ROOT)).replace('PORTS = {"llm":8080,"vlm":8081}', "PORTS = " + json.dumps({"llm": LLM_PORT, "vlm": free_port()}))
# the stand-in ComfyUI
UNLOADS = []
class Q:
    n = 0
    def get_tasks_remaining(self): return Q.n
class PS:
    pass
PS.instance = PS(); PS.instance.routes = web.RouteTableDef(); PS.instance.handlers = []; PS.instance.prompt_queue = Q()
PS.instance.add_on_prompt_handler = lambda f: PS.instance.handlers.append(f)
sys.modules["server"] = types.SimpleNamespace(PromptServer=PS)
mm = types.SimpleNamespace(unload_all_models=lambda: UNLOADS.append("unload"), soft_empty_cache=lambda force=False: UNLOADS.append("empty"))
sys.modules["comfy"] = types.SimpleNamespace(model_management=mm); sys.modules["comfy.model_management"] = mm
G = {}; exec(compile(node, "bitgen_llm_proxy", "exec"), G)
# the stand-in llama-server
FAKE = os.path.join(ROOT, "fake_llama.py")
open(FAKE, "w").write("""import http.server, json, sys
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        self.send_response(200 if self.path == '/health' else 404); self.end_headers(); self.wfile.write(b'{}')
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0); b = self.rfile.read(n)
        out = json.dumps({'choices': [{'message': {'content': 'hello from the pod'}}], 'asked': json.loads(b or b'{}')}).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(out)
http.server.HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
""")
json.dump({"share": True}, open(os.path.join(ROOT, "share.json"), "w"))
json.dump({"cmd": [sys.executable, FAKE, str(LLM_PORT)], "log": os.path.join(ROOT, "llm.log"), "health": "/health"}, open(os.path.join(ROOT, "llm.cmd.json"), "w"))


def alive_pid():
    try: p = int(open(os.path.join(ROOT, "llm.pid")).read())
    except Exception: return 0
    try: os.waitpid(p, os.WNOHANG)
    except Exception: pass
    try: st = open("/proc/%d/stat" % p).read().rsplit(")", 1)[1].split()[0]
    except Exception: return 0
    return p if st not in ("Z", "X") else 0


async def main():
    app = web.Application(); app.add_routes(PS.instance.routes)
    run = web.AppRunner(app); await run.setup(); port = free_port(); await web.TCPSite(run, "127.0.0.1", port).start()
    base = "http://127.0.0.1:%d" % port
    async with ClientSession() as s:
        async with s.get(base + "/bitgen_llm/state") as r: st = await r.json()
        check("state: the node's version, shared, the LLM set up and not running", st["v"] >= 2 and st["share"] and st["kinds"]["llm"] == {"set_up": True, "running": False}, st)
        async with s.post(base + "/bitgen_llm/llm/v1/chat/completions", json={"messages": [{"role": "user", "content": "hi"}]}) as r: j = await r.json(); code = r.status
        check("a chat to the stopped LLM server: ComfyUI's models unloaded first, the server started from its command, the chat passed on",
              code == 200 and j["choices"][0]["message"]["content"] == "hello from the pod" and UNLOADS == ["unload", "empty"] and alive_pid(), (code, j, UNLOADS))
        pid1 = alive_pid()
        async with s.post(base + "/bitgen_llm/llm/v1/chat/completions", json={}) as r: code = r.status
        check("…the next chat goes straight there (nothing unloaded again, the same server)", code == 200 and UNLOADS == ["unload", "empty"] and alive_pid() == pid1)
        PS.instance.handlers[0]({"prompt": {}})
        await asyncio.sleep(0.3)
        check("a picture / video queued (ComfyUI's prompt handler): the LLM server stopped - its VRAM free for the render", len(PS.instance.handlers) == 1 and not alive_pid())
        Q.n = 1
        t = asyncio.ensure_future(s.post(base + "/bitgen_llm/llm/v1/chat/completions", json={}))
        await asyncio.sleep(1.5)
        check("a chat while ComfyUI still renders waits (nothing unloaded mid-render)", not t.done() and UNLOADS == ["unload", "empty"] and not alive_pid())
        Q.n = 0
        r = await t; code = r.status; r.release()
        check("…the render done: ComfyUI unloaded, the LLM loaded again, the chat answered", code == 200 and UNLOADS == ["unload", "empty", "unload", "empty"] and alive_pid())
        json.dump({"share": False}, open(os.path.join(ROOT, "share.json"), "w"))
        PS.instance.handlers[0]({"prompt": {}})
        check("sharing off (a pod just for the LLM): a render leaves the LLM server running", alive_pid())
        os.remove(os.path.join(ROOT, "llm.cmd.json"))
        async with s.post(base + "/bitgen_llm/vlm/v1/chat/completions", json={}) as r: code = r.status; j = await r.json()
        check("a kind not set up on the pod: 503 with why", code == 503 and "not set up" in j["error"], (code, j))
    try:
        p = alive_pid()
        if p: os.kill(p, 15)
    except Exception: pass
    await run.cleanup()

asyncio.run(main())
print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)

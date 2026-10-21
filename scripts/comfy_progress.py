"""bitGen Studio — LIVE STEP PROGRESS FROM COMFYUI'S WEBSOCKET, for every worker (2.401.3).

Tim (verbatim): "wan2.2 is not creating a step ... after 3 minutes".

worker.py (the H3 renders) has listened on ComfyUI's /ws since early on and printed "[comfy] step v/m - <node>" lines
the job's progress (lib/jobMeta: "step n of total"), the queue's running card and the status bar read. The newer
workers (Wan, LTX, Ripple, the swap, Viggle, SeedVR2, the graph and music workers) only polled /history - their jobs
said "loading" from queue to finish, which reads exactly like a hang. This is that listener, moved here unchanged
(worker.py's _comfy_ws_progress now calls it), plus run(): listen, queue with the listener's client id, wait, stop.

  listen(base, client_id, stop, pidbox, graph, seen, say)   the thread body (best effort: any failure just ends it)
  run(cc, base, graph, say, label="rendering", timeout=7200) -> (prompt_id, outputs)
        cc = scripts/comfy_client (its queue / wait / ComfyError); a "[worker] <label>... Ns" heartbeat every 10 s
        while ComfyUI says nothing (loading a model), so a long load is visibly alive too
"""
import base64
import json
import os
import socket
import threading
import time
import urllib.parse
import uuid


def listen(base, client_id, stop, pidbox, g, seen, say):
    """Live progress from ComfyUI's WebSocket (/ws?clientId=...), stdlib-only.
    Emits '[comfy] step v/m — <node>' lines that the UI progress bar parses
    (the x/y regex) and 'running <node>' on node changes. Any failure exits
    silently — the elapsed-time heartbeat in the wait loop still covers us."""
    s = None
    try:
        u = urllib.parse.urlparse(base)
        host, port = u.hostname, u.port or (443 if u.scheme == "https" else 80)
        key = base64.b64encode(os.urandom(16)).decode()
        s = socket.create_connection((host, port), timeout=10)
        s.sendall((f"GET /ws?clientId={client_id} HTTP/1.1\r\n"
                   f"Host: {host}:{port}\r\n"
                   "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                   f"Sec-WebSocket-Key: {key}\r\n"
                   "Sec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            c = s.recv(4096)
            if not c:
                return
            buf += c
        head, buf = buf.split(b"\r\n\r\n", 1)
        if b" 101 " not in head.split(b"\r\n", 1)[0]:
            return                              # server has no WS - fall back
        s.settimeout(1.0)

        def read(n):
            nonlocal buf
            while len(buf) < n:
                try:
                    c = s.recv(65536)
                except socket.timeout:
                    if stop.is_set():
                        raise ConnectionError
                    continue
                if not c:
                    raise ConnectionError
                buf += c
            out, buf = buf[:n], buf[n:]
            return out

        last_step = None
        last_node = None
        while not stop.is_set():
            b0, b1 = read(2)
            op = b0 & 0x0F
            ln = b1 & 0x7F
            if ln == 126:
                ln = int.from_bytes(read(2), "big")
            elif ln == 127:
                ln = int.from_bytes(read(8), "big")
            if b1 & 0x80:                       # masked (unusual server->client)
                mask = read(4)
                payload = bytes(x ^ mask[i % 4] for i, x in enumerate(read(ln)))
            else:
                payload = read(ln)
            if op == 8:                         # close
                return
            if op == 9:                         # ping -> masked pong
                m = os.urandom(4)
                s.sendall(bytes([0x8A, 0x80 | len(payload)]) + m
                          + bytes(x ^ m[i % 4] for i, x in enumerate(payload)))
                continue
            if op != 1:                         # binary previews etc: skip
                continue
            try:
                msg = json.loads(payload.decode("utf-8", "replace"))
            except Exception:
                continue
            d = msg.get("data") or {}
            mpid = d.get("prompt_id")
            if mpid and pidbox.get("pid") and mpid != pidbox["pid"]:
                continue                        # someone else's job
            t = msg.get("type")
            if t == "progress":
                v, m = d.get("value"), d.get("max")
                if v is None or m is None or (v, m) == last_step:
                    continue
                last_step = (v, m)
                nid = str(d.get("node") or "")
                ct = (g.get(nid) or {}).get("class_type", "")
                say(f"[comfy] step {v}/{m}" + (f" — {ct}" if ct else ""))
                seen["t"] = time.time()
            elif t == "executing" and d.get("node") is not None:
                nid = str(d["node"])
                if nid == last_node:
                    continue
                last_node = nid
                ct = (g.get(nid) or {}).get("class_type", "") or f"node {nid}"
                say(f"[comfy] running {ct}")
                seen["t"] = time.time()
            elif t == "progress_state" and isinstance(d.get("nodes"), dict):
                # ComfyUI >= 0.33 batches per-node progress into one message
                run = [n for n in d["nodes"].values()
                       if isinstance(n, dict) and n.get("state") == "running"
                       and n.get("max")]
                if not run:
                    continue
                n0 = max(run, key=lambda n: n.get("value") or 0)
                v, m = int(n0.get("value") or 0), int(n0["max"])
                if (v, m) == last_step:
                    continue
                last_step = (v, m)
                nid = str(n0.get("display_node_id") or n0.get("node_id") or "")
                ct = (g.get(nid) or {}).get("class_type", "")
                say(f"[comfy] step {v}/{m}" + (f" — {ct}" if ct else ""))
                seen["t"] = time.time()
            elif t == "status":
                q = (((d.get("status") or {}).get("exec_info") or {})
                     .get("queue_remaining"))
                if isinstance(q, int) and q > 1 and q != seen.get("q"):
                    seen["q"] = q
                    say(f"[comfy] waiting in ComfyUI's queue ({q} jobs pending)")
                    seen["t"] = time.time()
            elif t == "execution_cached" and d.get("nodes"):
                say(f"[comfy] {len(d['nodes'])} node(s) served from cache")
                seen["t"] = time.time()
    except Exception:
        pass                                    # progress is best-effort
    finally:
        try:
            if s is not None:
                s.close()
        except Exception:
            pass


def run(cc, base, graph, say, label="rendering", timeout=7200):
    """Queue `graph` on ComfyUI with live step lines; -> (prompt_id, outputs). Raises cc.ComfyError like cc.wait."""
    client = uuid.uuid4().hex
    stop = threading.Event()
    pidbox = {"pid": None}
    seen = {"t": time.time()}
    th = threading.Thread(target=listen, args=(base, client, stop, pidbox, graph, seen, say), daemon=True)
    th.start()
    try:
        pid = cc.queue(base, graph, client_id=client)
        pidbox["pid"] = pid
        say(f"[worker] queued as {pid}")

        def tick(el):
            # the heartbeat only while the socket is quiet (a model loading, a node without a progress bar)
            if el and el % 10 == 0 and time.time() - seen.get("t", 0) >= 9:
                say(f"[worker] {label}... {el}s")
        outputs = cc.wait(base, pid, on_tick=tick, timeout=timeout)
        return pid, outputs
    finally:
        stop.set()


# 2.574.0 (Tim: "show step number of steps for all generations(image,music,video) in all places that show it"): the same
# live listener for callers that queue and wait in two places (image_worker's ControlNet stage hands a {queue, wait}
# pair to scripts/cn_stage.py). queue_live starts the listener and queues; wait_live waits and stops it.
_LIVE = {}


def queue_live(cc, base, graph, say):
    client = uuid.uuid4().hex
    stop = threading.Event()
    pidbox = {"pid": None}
    seen = {"t": time.time()}
    th = threading.Thread(target=listen, args=(base, client, stop, pidbox, graph, seen, say), daemon=True)
    th.start()
    try:
        pid = cc.queue(base, graph, client_id=client)
    except Exception:
        stop.set()
        raise
    pidbox["pid"] = pid
    _LIVE[pid] = (stop, seen)
    say(f"[worker] queued as {pid}")
    return pid


def wait_live(cc, base, pid, say, label="rendering", timeout=7200):
    stop, seen = _LIVE.pop(pid, (None, {"t": 0}))

    def tick(el):
        if el and el % 10 == 0 and time.time() - seen.get("t", 0) >= 9:
            say(f"[worker] {label}... {el}s")
    try:
        return cc.wait(base, pid, on_tick=tick, timeout=timeout)
    finally:
        if stop is not None:
            stop.set()

#!/usr/bin/env python3
"""bitGen Studio — misc/api_worker.py (2.757.0): AN API_ STYLE RENDERED BY AN ONLINE SERVICE (Settings ▸ API).

Tim (verbatim): "can you add an api tab to bitgen ... if api is checked add it to styles with prefix API_ so bitgen can
truly work without good hardware" + "add runninghub too". lib/core.js workerFor() runs this for a picture, video or song
job whose style has runs_on "api". Python's own library only (urllib) - nothing imported, no ComfyUI, no GPU.

    job.json  params.style / params.video_style (runs_on api, api_id, api_model, api_extra), config.apis[api_id]
              (name, service, key - decrypted by the app, base), output_dir
    services  openrouter  POST /images (b64) · POST /videos -> poll -> /videos/{id}/content
              fal         POST queue.fal.run/<model> -> status_url -> response_url (images[].url / video.url / audio.url)
              replicate   POST /v1/models/<owner>/<name>/predictions (or /v1/predictions + version) -> poll urls.get
              openai      POST /v1/images/generations (or /v1/images/edits with the references, multipart)
              gemini      POST /v1beta/models/<model>:generateContent (responseModalities IMAGE, references inline)
              runninghub  getJsonApiFormat (the workflow's nodes) -> upload references -> /task/openapi/create with
                          nodeInfoList (prompt, size, seed, pictures) -> /status -> /outputs (fileUrl)
    api_extra  a JSON object from the style, merged into the request's input (a model's own options); for RunningHub a
              list of {nodeId, fieldName, fieldValue} added to nodeInfoList
    H3_API_BASE_<SERVICE>  another address for a service (the tests' stand-ins)
Prints the usual @@OUT / @@OUTS lines (lib/core.js) and "[api] ..." lines; exit 1 with "[worker] ERROR: ..." in words.
"""
import base64
import json
import mimetypes
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import image_name as _iname  # noqa: E402

FPS = 24
UA = "bitGen-Studio"


def say(line):
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg):
    say("[worker] ERROR: " + msg)
    sys.exit(1)


class ApiError(Exception):
    pass


def http(method, url, headers=None, body=None, timeout=120, raw=False):
    """-> (status, parsed JSON | bytes, headers). A JSON body (dict) is sent as JSON; bytes as they are."""
    h = {"User-Agent": UA}
    h.update(headers or {})
    data = None
    if isinstance(body, (dict, list)):
        data = json.dumps(body).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    elif isinstance(body, (bytes, bytearray)):
        data = bytes(body)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            b = r.read()
            st, hd = r.status, dict(r.headers)
    except urllib.error.HTTPError as e:
        b, st, hd = e.read(), e.code, dict(e.headers or {})
    except Exception as e:                                     # noqa: BLE001
        raise ApiError(f"could not reach {url.split('/')[2]} ({e})")
    if raw:
        return st, b, hd
    try:
        return st, json.loads(b.decode("utf-8") or "null"), hd
    except Exception:                                          # noqa: BLE001
        return st, b.decode("utf-8", "replace")[:400], hd


def why(service, st, j):
    if st in (401, 403):
        return f"{service} refused the API key (Settings ▸ API ▸ ✓ Test)"
    if st == 402:
        return f"{service}: no credit left on the account"
    if st == 429:
        return f"{service}: too many requests right now - try again in a minute"
    msg = ""
    if isinstance(j, dict):
        e = j.get("error") or j.get("detail") or j.get("message") or j.get("msg")
        if isinstance(e, dict):
            e = e.get("message") or json.dumps(e)[:200]
        if isinstance(e, list):
            e = json.dumps(e)[:300]
        msg = str(e or "")
    elif isinstance(j, str):
        msg = j
    return f"{service} answered HTTP {st}" + (": " + msg[:300] if msg else "")


def data_url(p):
    mt = mimetypes.guess_type(str(p))[0] or "image/png"
    return f"data:{mt};base64," + base64.b64encode(Path(p).read_bytes()).decode("ascii")


def multipart(fields, files):
    """fields {name: str}, files [(name, filename, bytes, mime)] -> (body, content type)"""
    b = "----bitgen" + uuid.uuid4().hex
    out = bytearray()
    for k, v in fields.items():
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode("utf-8")
    for name, fn, data, mt in files:
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{fn}\"\r\nContent-Type: {mt}\r\n\r\n".encode("utf-8")
        out += data + b"\r\n"
    out += f"--{b}--\r\n".encode("utf-8")
    return bytes(out), "multipart/form-data; boundary=" + b


def fetch_bytes(url, headers=None, timeout=600):
    st, b, hd = http("GET", url, headers, raw=True, timeout=timeout)
    if st >= 400:
        raise ApiError(f"the finished file could not be downloaded (HTTP {st})")
    return b, (hd.get("Content-Type") or hd.get("content-type") or "")


def aspect(w, h):
    """the nearest of the aspect ratios the services take"""
    if not w or not h:
        return "1:1"
    r = w / h
    best = min(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "9:21", "5:4", "4:5"],
               key=lambda a: abs(r - int(a.split(":")[0]) / int(a.split(":")[1])))
    return best


def base_of(svc, default, api):
    return (os.environ.get("H3_API_BASE_" + svc.upper()) or api.get("base") or default).rstrip("/")


def poll(label, fn, every=3.0, limit=3600):
    """call fn() until it returns something not None; say the state now and then"""
    t0, last = time.time(), ""
    while True:
        r, state = fn()
        if r is not None:
            return r
        if state != last:
            say(f"[api] {label}: {state}")
            last = state
        if time.time() - t0 > limit:
            raise ApiError(f"{label}: no result after {limit // 60} minutes")
        time.sleep(every)


def urls_in(out):
    """every http(s) address in a service's output (strings, lists, {url: ...}) in order"""
    found = []

    def walk(x):
        if isinstance(x, str):
            if x.startswith("http://") or x.startswith("https://") or x.startswith("data:"):
                found.append(x)
        elif isinstance(x, list):
            for y in x:
                walk(y)
        elif isinstance(x, dict):
            for k in ("url", "file_url", "fileUrl", "audio_url", "video_url", "image_url"):
                if isinstance(x.get(k), str):
                    walk(x[k])
            for k in ("images", "image", "video", "videos", "audio", "audio_file", "output", "outputs", "data", "files"):
                if k in x:
                    walk(x[k])
    walk(out)
    seen, res = set(), []
    for u in found:
        if u not in seen:
            seen.add(u)
            res.append(u)
    return res


def get_any(u, headers=None):
    if u.startswith("data:"):
        head, b64 = u.split(",", 1)
        return base64.b64decode(b64), head[5:].split(";")[0]
    return fetch_bytes(u, headers)


# ---------------------------------------------------------------- the services
def run_openrouter(api, kind, model, job, extra):
    base = base_of("openrouter", "https://openrouter.ai/api/v1", api)
    hd = {"Authorization": "Bearer " + api["key"], "HTTP-Referer": "https://tigerart.com.au", "X-OpenRouter-Title": "bitGen Studio"}
    if kind == "image":
        body = {"model": model, "prompt": job["prompt"], "aspect_ratio": aspect(job["w"], job["h"]), "n": job["batch"]}
        if job["seed"] is not None:
            body["seed"] = job["seed"]
        if job["images"]:
            body["input_references"] = [{"type": "image_url", "image_url": {"url": data_url(p)}} for p in job["images"][:16]]
        body.update(extra)
        st, j, _ = http("POST", base + "/images", hd, body, timeout=600)
        if st >= 400 or not isinstance(j, dict):
            raise ApiError(why("OpenRouter", st, j))
        cost = (j.get("usage") or {}).get("cost")
        if cost is not None:
            say(f"[api] OpenRouter: about ${cost} for this")
        return [(base64.b64decode(d["b64_json"]), d.get("media_type") or "image/png") for d in (j.get("data") or []) if d.get("b64_json")]
    if kind == "video":
        body = {"model": model, "prompt": job["prompt"], "duration": max(1, round(job["seconds"])), "aspect_ratio": aspect(job["w"], job["h"])}
        if job["seed"] is not None:
            body["seed"] = job["seed"]
        fr = []
        if job["first"]:
            fr.append({"type": "image_url", "image_url": {"url": data_url(job["first"])}, "frame_type": "first_frame"})
        if job["last"]:
            fr.append({"type": "image_url", "image_url": {"url": data_url(job["last"])}, "frame_type": "last_frame"})
        if fr:
            body["frame_images"] = fr
        elif job["images"]:
            body["input_references"] = [{"type": "image_url", "image_url": {"url": data_url(p)}} for p in job["images"][:8]]
        body.update(extra)
        st, j, _ = http("POST", base + "/videos", hd, body, timeout=120)
        if st >= 400 or not isinstance(j, dict) or not j.get("id"):
            raise ApiError(why("OpenRouter", st, j))
        vid = j["id"]

        def check():
            s, r, _ = http("GET", base + "/videos/" + vid, hd, timeout=60)
            if s >= 400:
                raise ApiError(why("OpenRouter", s, r))
            stt = (r or {}).get("status", "")
            if stt == "completed":
                return r, stt
            if stt in ("failed", "cancelled", "expired"):
                raise ApiError("OpenRouter: the video " + stt + (": " + str((r or {}).get("error")) if (r or {}).get("error") else ""))
            return None, stt or "waiting"
        done = poll("OpenRouter video", check, every=5)
        cost = (done.get("usage") or {}).get("cost")
        if cost is not None:
            say(f"[api] OpenRouter: about ${cost} for this")
        b, mt = fetch_bytes(base + "/videos/" + vid + "/content", hd)
        return [(b, mt or "video/mp4")]
    raise ApiError("OpenRouter has no " + kind + " models bitGen can use")


def run_fal(api, kind, model, job, extra):
    base = base_of("fal", "https://queue.fal.run", api)
    hd = {"Authorization": "Key " + api["key"]}
    if not model:
        raise ApiError("the style has no fal.ai model - set it in the style (for example fal-ai/flux/schnell)")
    inp = {"prompt": job["prompt"]}
    if job["seed"] is not None:
        inp["seed"] = job["seed"]
    if kind == "image":
        inp.update({"image_size": {"width": job["w"], "height": job["h"]}, "num_images": job["batch"]})
        if job["images"]:
            inp["image_url"] = data_url(job["images"][0])
            inp["image_urls"] = [data_url(p) for p in job["images"][:8]]
    elif kind == "video":
        inp["aspect_ratio"] = aspect(job["w"], job["h"])
        if job["first"]:
            inp["image_url"] = data_url(job["first"])
        if job["last"]:
            inp["end_image_url"] = data_url(job["last"])
    elif kind == "music":
        inp = {"tags": job["tags"], "lyrics": job["prompt"], "duration": job["seconds"]}
        if job["seed"] is not None:
            inp["seed"] = job["seed"]
    inp.update(extra)
    st, j, _ = http("POST", base + "/" + model.strip("/"), hd, inp, timeout=120)
    if st >= 400 or not isinstance(j, dict) or not j.get("request_id"):
        raise ApiError(why("fal.ai", st, j))
    status_url, result_url = j.get("status_url"), j.get("response_url")

    def check():
        s, r, _ = http("GET", status_url, hd, timeout=60)
        if s >= 400 and s != 202:
            raise ApiError(why("fal.ai", s, r))
        stt = (r or {}).get("status", "") if isinstance(r, dict) else ""
        if stt == "COMPLETED":
            if (r or {}).get("error"):
                raise ApiError("fal.ai: " + str(r.get("error"))[:300])
            return True, stt
        return None, (stt or "waiting").lower().replace("_", " ")
    poll("fal.ai " + model, check, every=2.5)
    s, r, _ = http("GET", result_url, hd, timeout=120)
    if s >= 400:
        raise ApiError(why("fal.ai", s, r))
    return [get_any(u) for u in urls_in(r)][: max(1, job["batch"]) if kind == "image" else 1]


def run_replicate(api, kind, model, job, extra):
    base = base_of("replicate", "https://api.replicate.com/v1", api)
    hd = {"Authorization": "Bearer " + api["key"], "Prefer": "wait=55"}
    if not model:
        raise ApiError("the style has no Replicate model - set it in the style (owner/name)")
    inp = {"prompt": job["prompt"]}
    if job["seed"] is not None:
        inp["seed"] = job["seed"]
    if kind == "image":
        inp.update({"aspect_ratio": aspect(job["w"], job["h"]), "num_outputs": job["batch"]})
        if job["images"]:
            inp["image"] = data_url(job["images"][0])
    elif kind == "video":
        inp["aspect_ratio"] = aspect(job["w"], job["h"])
        if job["first"]:
            inp["image"] = data_url(job["first"])
        if job["last"]:
            inp["last_image"] = data_url(job["last"])
    elif kind == "music":
        inp = {"prompt": job["tags"], "lyrics": job["prompt"]}
    inp.update(extra)
    if ":" in model:
        url, body = base + "/predictions", {"version": model.split(":", 1)[1], "input": inp}
    else:
        url, body = base + "/models/" + model.strip("/") + "/predictions", {"input": inp}
    st, j, _ = http("POST", url, hd, body, timeout=120)
    if st >= 400 or not isinstance(j, dict):
        raise ApiError(why("Replicate", st, j))
    get_url = (j.get("urls") or {}).get("get")

    def check(r=None):
        if r is None:
            s, r, _ = http("GET", get_url, {"Authorization": hd["Authorization"]}, timeout=60)
            if s >= 400:
                raise ApiError(why("Replicate", s, r))
        stt = (r or {}).get("status", "")
        if stt in ("succeeded", "successful"):
            return r, stt
        if stt in ("failed", "canceled", "cancelled", "aborted"):
            raise ApiError("Replicate: the run " + stt + (": " + str(r.get("error"))[:300] if r.get("error") else ""))
        return None, stt or "waiting"
    first, _ = check(j)
    done = first or poll("Replicate " + model, check, every=2.5)
    return [get_any(u) for u in urls_in(done.get("output"))][: max(1, job["batch"]) if kind == "image" else 1]


def run_openai(api, kind, model, job, extra):
    base = base_of("openai", "https://api.openai.com/v1", api)
    if kind != "image":
        raise ApiError("OpenAI ended its video API (Sora) in September 2026 - pick another service for video")
    hd = {"Authorization": "Bearer " + api["key"]}
    w, h = job["w"], job["h"]
    size = "1024x1024" if abs(w - h) < max(w, h) * 0.15 else ("1536x1024" if w > h else "1024x1536")
    if job["images"]:
        fields = {"model": model, "prompt": job["prompt"], "n": str(job["batch"]), "size": size}
        fields.update({k: (json.dumps(v) if isinstance(v, (dict, list)) else str(v)) for k, v in extra.items()})
        files = [("image[]", Path(p).name, Path(p).read_bytes(), mimetypes.guess_type(str(p))[0] or "image/png") for p in job["images"][:16]]
        body, ct = multipart(fields, files)
        st, j, _ = http("POST", base + "/images/edits", dict(hd, **{"Content-Type": ct}), body, timeout=600)
    else:
        body = {"model": model, "prompt": job["prompt"], "n": job["batch"], "size": size}
        body.update(extra)
        st, j, _ = http("POST", base + "/images/generations", hd, body, timeout=600)
    if st >= 400 or not isinstance(j, dict):
        raise ApiError(why("OpenAI", st, j))
    out = []
    for d in j.get("data") or []:
        if d.get("b64_json"):
            out.append((base64.b64decode(d["b64_json"]), "image/png"))
        elif d.get("url"):
            out.append(get_any(d["url"]))
    return out


def run_gemini(api, kind, model, job, extra):
    base = base_of("gemini", "https://generativelanguage.googleapis.com/v1beta", api)
    if kind != "image":
        raise ApiError("Google Gemini's video and music models are not offered through the API keys bitGen uses - pick another service")
    hd = {"x-goog-api-key": api["key"]}
    parts = [{"text": job["prompt"]}]
    for p in job["images"][:8]:
        parts.append({"inline_data": {"mime_type": mimetypes.guess_type(str(p))[0] or "image/png", "data": base64.b64encode(Path(p).read_bytes()).decode("ascii")}})
    out = []
    for _i in range(max(1, job["batch"])):
        body = {"contents": [{"parts": parts}], "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect(job["w"], job["h"])}}}
        if job["seed"] is not None:
            body["generationConfig"]["seed"] = job["seed"] + _i
        body.update(extra)
        st, j, _ = http("POST", base + "/models/" + model + ":generateContent", hd, body, timeout=600)
        if st >= 400 or not isinstance(j, dict):
            raise ApiError(why("Google Gemini", st, j))
        got = False
        for c in j.get("candidates") or []:
            for prt in ((c.get("content") or {}).get("parts") or []):
                d = prt.get("inlineData") or prt.get("inline_data")
                if d and d.get("data"):
                    out.append((base64.b64decode(d["data"]), d.get("mimeType") or d.get("mime_type") or "image/png"))
                    got = True
        if not got:
            fb = (j.get("promptFeedback") or {}).get("blockReason") or ((j.get("candidates") or [{}])[0].get("finishReason"))
            raise ApiError("Google Gemini gave no picture" + (f" ({fb})" if fb else ""))
    return out


def run_runninghub(api, kind, model, job, extra):
    base = base_of("runninghub", "https://www.runninghub.ai", api)
    key = api["key"]
    wf = str(model or "").strip()
    if not wf.isdigit():
        raise ApiError("the style needs a RunningHub workflow ID as its Model (the number in the workflow's address on runninghub.ai)")
    hd = {"Host": base.split("/")[2]}

    def call(path, body):
        s, j, _ = http("POST", base + path, hd, body, timeout=120)
        if s >= 400 or not isinstance(j, dict):
            raise ApiError(why("RunningHub", s, j))
        if j.get("code") != 0:
            raise ApiError("RunningHub: " + str(j.get("msg") or j.get("code"))[:300])
        return j.get("data")
    d = call("/api/openapi/getJsonApiFormat", {"apiKey": key, "workflowId": wf})
    graph = json.loads(d.get("prompt") if isinstance(d, dict) and isinstance(d.get("prompt"), str) else "{}")
    info, used = [], set()

    def put(nid, field, value):
        info.append({"nodeId": str(nid), "fieldName": field, "fieldValue": value})
    # the prompt: the first text-encoder text (the positive), a song's tags + lyrics
    for nid, n in sorted(graph.items(), key=lambda kv: int(kv[0]) if str(kv[0]).isdigit() else 0):
        ct, ins = str(n.get("class_type", "")), n.get("inputs") or {}
        if kind == "music" and "AceStep" in ct:
            if isinstance(ins.get("tags"), str):
                put(nid, "tags", job["tags"])
            if isinstance(ins.get("lyrics"), str):
                put(nid, "lyrics", job["prompt"])
            if isinstance(ins.get("duration"), (int, float)):
                put(nid, "duration", job["seconds"])
            continue
        if "text" in ins and isinstance(ins["text"], str) and ("TextEncode" in ct or "Prompt" in ct) and "prompt" not in used:
            put(nid, "text", job["prompt"])
            used.add("prompt")
        if ct.startswith("Empty") and "Latent" in ct and isinstance(ins.get("width"), int):
            put(nid, "width", job["w"])
            put(nid, "height", job["h"])
        if job["seed"] is not None:
            for f in ("seed", "noise_seed"):
                if isinstance(ins.get(f), int):
                    put(nid, f, job["seed"])
        if kind == "video" and isinstance(ins.get("length"), int) and ct.startswith("Empty"):
            put(nid, "length", max(1, int(round(job["seconds"] * FPS))))
    loaders = [nid for nid, n in sorted(graph.items(), key=lambda kv: int(kv[0]) if str(kv[0]).isdigit() else 0) if n.get("class_type") == "LoadImage"]
    pics = ([job["first"]] if job["first"] else []) + ([job["last"]] if job["last"] else []) + list(job["images"])
    for nid, p in zip(loaders, pics):
        body, ct = multipart({"apiKey": key}, [("file", Path(p).name, Path(p).read_bytes(), mimetypes.guess_type(str(p))[0] or "image/png")])
        s, j, _ = http("POST", base + "/task/openapi/upload", dict(hd, **{"Content-Type": ct}), body, timeout=300)
        if s >= 400 or not isinstance(j, dict) or j.get("code") != 0:
            raise ApiError("RunningHub: the picture could not be uploaded - " + why("RunningHub", s, j))
        put(nid, "image", (j.get("data") or {}).get("fileName") or (j.get("data") or {}).get("url"))
    if isinstance(extra, list):
        info += [x for x in extra if isinstance(x, dict) and x.get("nodeId")]
    elif isinstance(extra, dict) and isinstance(extra.get("nodeInfoList"), list):
        info += extra["nodeInfoList"]
    say(f"[api] RunningHub workflow {wf}: {len(info)} value(s) set")
    t = call("/task/openapi/create", {"apiKey": key, "workflowId": wf, "nodeInfoList": info})
    task = (t or {}).get("taskId")
    if not task:
        raise ApiError("RunningHub did not start the task")

    def check():
        stt = call("/task/openapi/status", {"apiKey": key, "taskId": task})
        if stt == "SUCCESS":
            return True, stt
        if stt == "FAILED":
            raise ApiError("RunningHub: the task failed (see the task on runninghub.ai)")
        return None, str(stt or "waiting").lower()
    poll("RunningHub task " + str(task), check, every=4)
    outs = call("/task/openapi/outputs", {"apiKey": key, "taskId": task}) or []
    want = {"image": ("png", "jpg", "jpeg", "webp"), "video": ("mp4", "webm", "mov", "gif"), "music": ("mp3", "wav", "flac", "ogg", "m4a")}[kind]
    files = [o for o in outs if str(o.get("fileType", "")).lower().lstrip(".") in want] or outs
    return [get_any(o["fileUrl"]) for o in files if o.get("fileUrl")]


SERVICES = {"openrouter": run_openrouter, "fal": run_fal, "replicate": run_replicate, "openai": run_openai, "gemini": run_gemini, "runninghub": run_runninghub}
NAMES = {"openrouter": "OpenRouter", "fal": "fal.ai", "replicate": "Replicate", "openai": "OpenAI", "gemini": "Google Gemini", "runninghub": "RunningHub"}
EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/webp": ".webp", "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
       "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/flac": ".flac", "audio/ogg": ".ogg", "audio/mp4": ".m4a"}


def ext_of(data, mt, kind):
    mt = (mt or "").split(";")[0].strip().lower()
    if mt in EXT:
        return EXT[mt]
    h = data[:16]
    if h.startswith(b"\x89PNG"):
        return ".png"
    if h[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if h[:4] == b"RIFF" and h[8:12] == b"WEBP":
        return ".webp"
    if h[:4] == b"RIFF":
        return ".wav"
    if h[4:8] == b"ftyp":
        return ".mp4"
    if h[:4] == b"\x1a\x45\xdf\xa3":
        return ".webm"
    if h[:3] == b"ID3" or h[:2] == b"\xff\xfb":
        return ".mp3"
    if h[:4] == b"fLaC":
        return ".flac"
    return {"image": ".png", "video": ".mp4", "music": ".mp3"}[kind]


def main():
    if len(sys.argv) < 2:
        fail("usage: api_worker.py <job.json>")
    jf = Path(sys.argv[1])
    J = json.loads(jf.read_text(encoding="utf-8"))
    params, cfg = J.get("params") or {}, J.get("config") or {}
    out_dir = Path(J.get("output_dir") or ".")
    out_dir.mkdir(parents=True, exist_ok=True)
    mode = str(params.get("mode") or "")
    style = params.get("video_style") or params.get("style") or {}
    kind = "image" if mode == "image" else "music" if mode == "music" else "video"
    api = ((cfg.get("apis") or {}).get(style.get("api_id") or "") or {})
    if not api:
        fail(f"the style {style.get('name', '')} runs on an API that is not in Settings ▸ API any more - pick another in the style")
    svc = api.get("service", "")
    if svc == "claude":
        fail(f"Settings ▸ API ▸ {api.get('name')} is Claude - it is the LLM only and makes no pictures, video or songs; pick another API in the style")
    if svc not in SERVICES:
        fail(f"bitGen does not know the service {svc!r}")
    if not api.get("key"):
        fail(f"Settings ▸ API ▸ {api.get('name')} has no key")
    if not api.get("use"):
        say(f"[api] note: Settings ▸ API ▸ {api.get('name')} is not ticked Use - rendering anyway, the style asked for it")
    model = str(style.get("api_model") or "").strip()
    extra = style.get("api_extra") or {}
    if not isinstance(extra, (dict, list)):
        extra = {}
    seed = params.get("seed")
    try:
        seed = int(seed) if seed is not None and int(seed) >= 0 else None
    except Exception:                                          # noqa: BLE001
        seed = None
    w = int(params.get("width") or style.get("width") or 1024)
    h = int(params.get("height") or style.get("height") or 1024)
    refs = [p for p in (params.get("reference_files") or []) if p and Path(p).is_file()]
    images = [p for p in (params.get("images") or []) if p and Path(p).is_file()]
    first = last = None
    if mode == "fl2va":
        first = refs[0] if refs else None
        last = refs[1] if len(refs) > 1 else None
    elif mode in ("i2va",):
        first = refs[0] if refs else None
    elif kind == "video":
        images = refs
    frames = int(params.get("frames") or 0)
    seconds = round(frames / FPS, 2) if frames else float(params.get("seconds") or params.get("duration") or style.get("max_duration") or (60 if kind == "music" else 5))
    if kind == "music":
        seconds = max(5.0, min(240.0, float(params.get("duration") or style.get("max_duration") or 60)))
    job = {"prompt": str(params.get("prompt") or "").strip(), "tags": str(style.get("caption") or style.get("prompt") or ""),
           "seed": seed, "w": w, "h": h, "batch": max(1, min(8, int(params.get("batch") or 1))), "images": images,
           "first": first, "last": last, "seconds": seconds}
    if not job["prompt"]:
        fail("the prompt is empty")
    say(f"[api] {NAMES[svc]} ({api.get('name')}) · {kind} · model {model or '(none)'} · {w}x{h}" + (f" · {seconds:g} s" if kind != "image" else "")
        + (f" · {len(images) + bool(first) + bool(last)} picture(s)" if images or first or last else ""))
    say("[api] this renders on the service's computers - nothing runs on this graphics card; the service charges your account")
    started = time.time()
    try:
        got = SERVICES[svc](api, kind, model, job, extra)
    except ApiError as e:
        fail(str(e))
    if not got:
        fail(NAMES[svc] + " finished but sent nothing back")
    say(f"[api] done in {time.time() - started:.0f} s")
    workdir = jf.parent
    if kind == "video":
        data, mt = got[0]
        ext = ext_of(data, mt, kind)
        fmt = str(params.get("format") or "mp4")
        out_name = f"{time.strftime('%Y%m%d-%H%M%S')}_{workdir.name}.{fmt}"
        tmp = out_dir / (out_name + ".part" + ext)
        tmp.write_bytes(data)
        if ext != "." + fmt and shutil.which("ffmpeg"):
            r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(out_dir / out_name)], capture_output=True)
            tmp.unlink(missing_ok=True)
            if r.returncode != 0:
                fail("the video came back as " + ext + " and could not be turned into ." + fmt)
        else:
            if ext != "." + fmt:
                out_name = out_name.rsplit(".", 1)[0] + ext
            tmp.replace(out_dir / out_name)
        say("@@OUT " + out_name)
        return
    stem = _iname.build_stem(workdir.name, seed, started)
    names = []
    for i, (data, mt) in enumerate(got):
        name = _iname.reserve(out_dir, _iname.image_name(stem, i, len(got), ext=ext_of(data, mt, kind)))
        (out_dir / name).write_bytes(data)
        names.append(name)
    say("@@OUTS " + json.dumps(names))
    say("@@OUT " + names[-1])


if __name__ == "__main__":
    main()

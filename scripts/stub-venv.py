#!/usr/bin/env python3
"""Stub venv python for the e2e suite.

Stands in for venvs/<tool>/bin/python: it is invoked exactly as the real venv
python would be — `python <helper.py> <job.json>` — and emits the same single
JSON line, so lib/venv.js's runJson contract is exercised for real without
installing torch or downloading a model.
"""
import json, os, struct, sys, math

def wav_bytes(seconds=0.5, rate=16000):
    n = int(seconds * rate)
    frames = b"".join(struct.pack("<h", int(9000 * math.sin(i * 0.03))) for i in range(n))
    return (b"RIFF" + struct.pack("<I", 36 + len(frames)) + b"WAVEfmt "
            + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
            + b"data" + struct.pack("<I", len(frames)) + frames)

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "stub-venv: expected <helper> <job.json>"}))
        return 2
    helper, jobfile = sys.argv[1], sys.argv[2]
    with open(jobfile, "r", encoding="utf-8") as fh:
        job = json.load(fh)
    sys.stderr.write(f"STUBVENV helper={os.path.basename(helper)}\n")
    sys.stderr.flush()

    # (2.264.0: the openaudio_checkpoint branch left with the doctor)
    if "stems_local" in helper:
        # 2.269.0: demucs stand-in - two tiny wavs where the real thing
        # would put them, same names, same JSON line
        sys.stderr.write(f"[stems] separating {os.path.basename(job.get('file',''))} "
                         f"with {job.get('model')} on {job.get('device')}\n")
        out = job.get("out_dir") or "."
        os.makedirs(out, exist_ok=True)
        stem = job.get("stem") or "song"
        pair = {}
        for key, suffix in (("vocals", "_vocals"), ("instrumental", "_instrumental")):
            p = os.path.join(out, stem + suffix + ".wav")
            with open(p, "wb") as fh:
                fh.write(wav_bytes(0.3))
            pair[key] = p
        print(json.dumps(pair))
        return 0

    if "asr_live" in helper:
        # 2.564.0: the live transcriber's stand-in - "ready", then one answer per JSON line on stdin (the words say how
        # long the wav was, so a test can tell its utterance arrived whole)
        print(json.dumps({"ready": True, "device": "cpu", "model": job.get("model") or "base"}), flush=True)
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            j = json.loads(line)
            secs = 0.0
            try:
                with open(j.get("audio", ""), "rb") as fh:
                    data = fh.read()
                rate = struct.unpack("<I", data[24:28])[0] if data[:4] == b"RIFF" else 16000
                secs = max(0.0, (len(data) - 44) / 2.0 / (rate or 16000))
                text = "make the prompt a red fox in the snow" if secs > 0.3 else ""
                print(json.dumps({"id": j.get("id"), "text": text, "language": "en", "device": "cpu", "secs": round(secs, 2), "rate": rate}), flush=True)
            except OSError as e:
                print(json.dumps({"id": j.get("id"), "error": f"stub: {e}"}), flush=True)
        return 0

    if "asr_local" in helper:
        sys.stderr.write(f"[asr] loading {job.get('model')} on {job.get('device')}\n")
        segs = [{"start": 0.0, "end": 1.5, "text": "first line",
                 "words": [{"start": 0.0, "end": 0.7, "text": "first"},
                           {"start": 0.7, "end": 1.5, "text": "line"}]},
                {"start": 1.5, "end": 3.0, "text": "second line", "words": []}]
        print(json.dumps({"text": "first line second line", "language": "en",
                          "duration": 3.0, "segments": segs}))
        return 0
    if "omnivoice_local" in helper:
        if job.get("op") == "check":
            print(json.dumps({"ok": True, "torch": "stub", "cuda": False, "omnivoice": "stub"})); return 0
        if not job.get("text"):
            print(json.dumps({"error": "no text"})); return 1
        with open(job["out"], "wb") as fh:
            fh.write(wav_bytes(rate=24000))
        mode = "clone" if job.get("ref_audio") else ("design" if job.get("instruct") else "auto")
        sys.stderr.write(f"STUBOMNI mode={mode} instruct={job.get('instruct','')!r} "
                         f"steps={job.get('num_step')} cache={bool(job.get('prompt_cache'))}\n")
        print(json.dumps({"out": job["out"], "engine": "omnivoice", "mode": mode, "rate": 24000}))
        return 0
    if "tts_local" in helper:
        if not job.get("text"):
            print(json.dumps({"error": "no text"})); return 1
        with open(job["out"], "wb") as fh:
            fh.write(wav_bytes())
        sys.stderr.write(f"STUBTTS ref={bool(job.get('ref_audio'))} "
                         f"reftext={job.get('ref_text','')!r}\n")
        print(json.dumps({"out": job["out"], "engine": "stub"}))
        return 0
    print(json.dumps({"error": "stub-venv: unknown helper " + helper}))
    return 1

if __name__ == "__main__":
    sys.exit(main())

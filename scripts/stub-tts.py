#!/usr/bin/env python3
"""Stub OpenAudio TTS + Whisper transcription server for the e2e suite.

Answers the three dialects lib/tts.js can speak and returns a real (tiny) WAV
so the whole path — request shape, binary body, save into the project's Sound
folder, duration probe — is exercised without the actual model.
"""
import json, struct, sys, math
from http.server import BaseHTTPRequestHandler, HTTPServer

def wav(seconds=0.5, rate=8000):
    n = int(seconds * rate)
    frames = b"".join(struct.pack("<h", int(12000 * math.sin(i * 0.05))) for i in range(n))
    return (b"RIFF" + struct.pack("<I", 36 + len(frames)) + b"WAVEfmt "
            + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
            + b"data" + struct.pack("<I", len(frames)) + frames)

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith("/v1/models"):
            self._send(200, b'{"data":[{"id":"openaudio-s1-mini"}]}', "application/json")
        else:
            self._send(404, b"{}", "application/json")
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        try: req = json.loads(body or b"{}")
        except Exception: req = {}
        if self.path.startswith("/v1/chat/completions"):
            # stand in for llama-server: echo one prompt per requested shot so
            # the quick-prompt chain can be exercised end to end
            user = ""
            for m in req.get("messages", []):
                if m.get("role") == "user":
                    user = m.get("content", "")
            import re as _re
            # 2.354.0: the prompt chat with the reference dock (same answer as scripts/stub-llm.py) - Tim's
            # model's habit (file names as tags, <sound 1>) + what the system context carried
            alltext = " ".join(str(m.get("content", "")) for m in req.get("messages", []))
            # 2.395.0: Append / Prepend - echo what the LLM was told (the system context + the user turn), so the e2e
            # can check the fl2va dock: <Picture 1> = the video's frame, <Picture 2> = the dock's picture
            if "FRAMEOP_TEST" in alltext:
                sysmsg = " ".join(str(m.get("content", "")) for m in req.get("messages", []) if m.get("role") == "system")
                usr = " ".join(str(m.get("content", "")) for m in req.get("messages", []) if m.get("role") == "user")
                out = {"choices": [{"message": {"role": "assistant", "content": "FRAMEOP-ECHO " + sysmsg[-5000:] + " ||USER|| " + usr[-3000:]}}]}
                return self._send(200, json.dumps(out).encode(), "application/json")
            if "REFDOCK_TEST" in alltext:
                sysmsg = " ".join(str(m.get("content", "")) for m in req.get("messages", []) if m.get("role") == "system")
                content = ("```video\n<subject 1> is the woman in <ava_face.png>. Keep the head, face and hair of the woman "
                           "in <ava_face.png>, keep the body of the woman in <ava_body.png>. She does the action in "
                           "<dance.mp4>, her voice is <sound 1>.\n```\n"
                           + ("DOCK-SEEN " if "THE REFERENCE DOCK" in sysmsg and "<Picture 2> - subject 1" in sysmsg
                              and "<Video 1> - reference video, file dance.mp4" in sysmsg and "<Audio 1> - reference sound" in sysmsg
                              else "DOCK-MISSING"))
                out = {"choices": [{"message": {"role": "assistant", "content": content}}]}
                return self._send(200, json.dumps(out).encode(), "application/json")
            n = _re.search(r"exactly (\d+) prompt", user)
            n = int(n.group(1)) if n else 1
            arr = [f"shot {i+1}: a wide cinematic shot, slow dolly in" for i in range(n)]
            out = {"choices": [{"message": {"role": "assistant",
                                            "content": "```json\n" + json.dumps(arr) + "\n```"}}]}
            system = " ".join(m.get("content", "") for m in req.get("messages", []) if m.get("role") == "system")
            guide = "guide=" + (_re.search(r"PROMPTING GUIDE — ([^:\n]+)", system).group(1).strip() if "PROMPTING GUIDE" in system else "none")
            sys.stderr.write(f"LLMREQ shots={n} {guide}\n"); sys.stderr.flush()
            return self._send(200, json.dumps(out).encode(), "application/json")
        if self.path.startswith("/v1/audio/transcriptions"):
            # multipart — we only care that a wav arrived and echo fixed segments
            got_wav = b"RIFF" in body
            sys.stderr.write(f"ASRREQ bytes={len(body)} wav={got_wav}\n"); sys.stderr.flush()
            if not got_wav:
                return self._send(400, b'{"error":"no audio"}', "application/json")
            out = {"text": "first line second line", "language": "en",
                   "segments": [{"start": 0.0, "end": 1.5, "text": "first line"},
                                {"start": 1.5, "end": 3.0, "text": "second line"}]}
            return self._send(200, json.dumps(out).encode(), "application/json")
        if self.path.startswith("/v1/tts"):
            text, refs = req.get("text"), req.get("references") or []
        elif self.path.startswith("/v1/audio/speech"):
            text, refs = req.get("input"), ([{"text": req.get("ref_text")}] if req.get("ref_audio") else [])
        else:
            return self._send(404, b'{"error":"no such endpoint"}', "application/json")
        if not text:
            return self._send(400, b'{"error":"no text"}', "application/json")
        # echo what we understood so the tests can assert the request shape
        sys.stderr.write(f"TTSREQ path={self.path} refs={len(refs)} "
                         f"reftext={(refs[0].get('text') if refs else '')!r} len={len(text)}\n")
        sys.stderr.flush()
        self._send(200, wav(), "audio/wav")
    def _send(self, code, payload, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    HTTPServer(("127.0.0.1", port), H).serve_forever()

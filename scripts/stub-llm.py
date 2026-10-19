#!/usr/bin/env python3
"""bitGen Studio e2e — stub llama-server (2.142.3).

The screenplay writer broke in production while every test stayed green,
because nothing ever drove POST /api/screenplay through an actual chat
completion: the route double-unwrapped the reply into "[object Object]" and
no suite noticed. This stub is that missing seam.

Faithful-mock rules: it RECORDS every request body to OUTDIR/llm_request_N.json
(so the suite can assert what the app actually sent — e.g. the 4096-token
budget), and its reply wears everything a real local model wears: a <think>
block that itself contains braces, a code fence, prose, and a trailing comma —
the exact clothing the parser must see through. A stub politer than the real
thing lets bugs through; this one is deliberately as rude as llama-server.

Usage: stub-llm.py PORT OUTDIR
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8391
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/stub-llm-out")
OUT.mkdir(parents=True, exist_ok=True)

PLAN = ('{ "prompt_prefix": ["subject_definitions:"],\n'
        '  "shots": [\n'
        '    { "id": "clip_01", "prompt": ["[Shot 1] @jinx waits in the dark.",],'
        ' "length": 39, "seed": "7" },\n'
        '  ],\n}')

CONTENT = ("<think>The user wants a screenplay. The shape is { \"shots\": [...] } "
           "with @tags... let me draft it.</think>\n"
           "Here is the plan you asked for:\n"
           "```json\n" + PLAN + "\n```\nHope this helps!")


class H(BaseHTTPRequestHandler):
    n = 0

    def log_message(self, *a):
        pass

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0) or 0))
        H.n += 1
        (OUT / f"llm_request_{H.n}.json").write_bytes(body or b"{}")
        # 2.152.0 (Tim: "the majority of my llms ... are not populating the
        # scenes, only one of them does"): many chat templates — the Gemma
        # family most famously — RAISE on a system message, and llama-server
        # answers 500 with the template's own exception text. When the brief
        # carries SYSROLE_TEST this stub wears exactly that behavior, so the
        # suite proves the fold-and-retry actually rescues those models.
        try:
            req = json.loads(body or b"{}")
            msgs = req.get("messages") or []
            wants = any("SYSROLE_TEST" in str(m.get("content", "")) for m in msgs)
            has_system = any(m.get("role") == "system" for m in msgs)
        except Exception:
            req, msgs = {}, []
            wants, has_system = False, False
        # 2.188.0 (Tim's card verbatim: "Unable to generate parser for this
        # template ... raise_exception('After the optional system message,
        # con..."): strict chat templates — Mistral and Gemma among them —
        # refuse a conversation whose roles do not alternate user/assistant
        # after the optional system message. A REAL llama-server with such a
        # template 400s exactly like this, so the stub does too, on EVERY
        # request — an unfaithful stub that accepted [system, user, user]
        # is precisely how the iterative retry's shape shipped broken.
        roles = [str(m.get("role", "")) for m in msgs]
        core = roles[1:] if roles and roles[0] == "system" else roles
        bad_alt = ("system" in core) or any(
            core[i] == core[i + 1] for i in range(len(core) - 1)) \
            or (core and core[0] != "user")
        if msgs and bad_alt:
            err = json.dumps({"error": {"code": 400, "message":
                "Unable to generate parser for this template. Automatic "
                "parser generation failed: raise_exception('After the "
                "optional system message, conversation roles must alternate "
                "user/assistant/user/assistant/...')"}}).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)
            return
        # 2.188.0 GARBLE_ONCE_TEST: the first per-scene attempt answers
        # useless prose (no JSON at all); only the RETRY — recognisable by
        # the assistant turn carrying the garbage back plus "Reply with ONLY
        # the JSON" — gets the real plan. Combined with the alternation rule
        # above, this proves the iterative retry survives a strict template.
        wants_garble = any("GARBLE_ONCE_TEST" in str(m.get("content", ""))
                           for m in msgs)
        is_garble_retry = any(m.get("role") == "assistant" for m in msgs) \
            and any("Reply with ONLY the JSON" in str(m.get("content", ""))
                    for m in msgs)
        if wants_garble and not is_garble_retry:
            content = ("I'm sorry, I got carried away thinking about the "
                       "story and forgot to write the JSON. Ask me again!")
            reply = {"choices": [{"finish_reason": "stop",
                                  "message": {"role": "assistant", "content": content}}]}
            data = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        # 2.190.0 (Tim: "all the scenes are identical ... it should read all
        # the previous scenes and create new scenes"): the canned PLAN has
        # ONE shot, so the iterative legs produced two IDENTICAL scenes and
        # the suite passed — the unfaithful-stub lesson, again. A per-scene
        # request ("Write ONLY scene i of N") now answers a DISTINCT
        # one-shot scene i. COPYCAT_TEST wears Tim's model's habit: every
        # per-scene attempt answers scene 1's text regardless of i — only a
        # retry that names the COPY gets the real scene i.
        import re as _re
        alltext = " ".join(str(m.get("content", "")) for m in msgs)
        # 2.335.0: the swap dialog's ✎ Write prompt - answered wearing a
        # think block, a lead-in, a fence, H3's WRONG tag (<Image 1>) and a
        # sign-off, the clothing lib/swapPrompt.clean must see through.
        # SWAP_GARBLE_TEST answers chat with no swap prompt at all.
        # 2.354.0: the prompt chat with the reference dock - answered the way Tim's model did (file names
        # as tags, <sound 1>), plus what the system context carried, so the e2e sees the dock AND the retag
        # 2.395.0: Append / Prepend - echo what the LLM was told (the system context + the user turn), so the e2e
        # can check the fl2va dock: <Picture 1> = the video's frame, <Picture 2> = the dock's picture
        # 2.404.0: ✨ Build a scene with AI - the plan answered the way chat models do: a lead-in, a ```json fence, a
        # trailing comma (lib/scenePlan.parse sees through them); SCENEPLAN_GARBLE_TEST answers prose first, the plan
        # only on the retry that names the fault; SCENEPLAN_NOMODEL_TEST asks for no detailed model
        if "BITGEN_SCENE_PLAN" in alltext:
            retry = any(m.get("role") == "assistant" for m in msgs) and "That was not the JSON plan" in alltext
            if "SCENEPLAN_GARBLE_TEST" in alltext and not retry:
                content = "What a lovely idea for a scene! A quiet street, a dog and a red car. Shall I describe it?"
            else:
                objs = [
                    {"name": "Street", "kind": "road", "at": [0, 10, 0], "size": [7, 40, 0.02]},
                    {"name": "Red car", "kind": "car", "color": "red", "at": [-1.7, 18, 0], "turn": 0,
                     "moves": [{"t": 0, "at": [-1.7, 18, 0]}, {"t": 4, "at": [-1.7, 2, 0]}]},
                    {"name": "Lamp", "kind": "lamp_post", "at": [4, 6, 0]},
                    {"name": "Old oak", "kind": "tree", "at": [-6, 8, 0], "size": [4, 4, 6]},
                    {"name": "Walker", "kind": "person", "color": "blue", "at": [3.5, 3, 0], "turn": 180},
                    {"name": "Ufo", "kind": "flying saucer", "at": [0, 30, 12]},
                ]
                if "SCENEPLAN_NOMODEL_TEST" not in alltext:
                    objs.append({"name": "Dog", "kind": "model", "describe": "a golden retriever standing, side view",
                                 "at": [4.2, 3, 0], "size": [0.35, 0.9, 0.65]})
                plan = {"title": "Quiet street", "seconds": 4, "sky": "#8fa8c8", "ground": {"size": 50, "color": "grass"},
                        "sun": {"elevation": 30, "azimuth": 200, "strength": 3}, "objects": objs,
                        "camera": {"lens": 35, "keys": [{"t": 0, "at": [0.5, -10, 1.7], "look": [0, 8, 1.2]},
                                                        {"t": 4, "at": [1.5, -5, 1.7], "look": [0, 10, 1.2]}]}}
                content = "Here is your scene:\n```json\n" + json.dumps(plan, indent=1)[:-1] + ",\n}\n```\nEnjoy!"
            data = json.dumps({"choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": content}}]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if "FRAMEOP_TEST" in alltext:
            sysmsg = " ".join(str(m.get("content", "")) for m in msgs if m.get("role") == "system")
            usr = " ".join(str(m.get("content", "")) for m in msgs if m.get("role") == "user")
            data = json.dumps({"choices": [{"finish_reason": "stop", "message": {"role": "assistant",
                "content": "FRAMEOP-ECHO " + sysmsg[-5000:] + " ||USER|| " + usr[-3000:]}}]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if "REFDOCK_TEST" in alltext:
            sysmsg = " ".join(str(m.get("content", "")) for m in msgs if m.get("role") == "system")
            content = ("```video\n<subject 1> is the woman in <ava_face.png>. Keep the head, face and hair of the woman "
                       "in <ava_face.png>, keep the body of the woman in <ava_body.png>. She does the action in "
                       "<dance.mp4>, her voice is <sound 1>.\n```\n"
                       + ("DOCK-SEEN " if "THE REFERENCE DOCK" in sysmsg and "<Picture 2> - subject 1" in sysmsg
                          and "<Video 1> - reference video, file dance.mp4" in sysmsg and "<Audio 1> - reference sound" in sysmsg else "DOCK-MISSING"))
            reply = {"choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": content}}]}
            data = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if "Write the character-swap prompt." in alltext:
            if "SWAP_GARBLE_TEST" in alltext:
                content = "Sure! Character swaps are such a fun idea. What would you like to swap?"
            else:
                wish = " Keep his red cap from <Picture 1>." if "red cap" in alltext else ""
                content = ("<think>They want {a swap}. Tags: <Video 1>, <Picture 1>.</think>\n"
                           "Here is the prompt:\n```\nReplace only the man in the purple shirt in <Video 1> "
                           "with the character in <Image 1>. Keep the replacement character's identity, outfit, "
                           "and art style from <Picture 1>: a stub character in a yellow raincoat." + wish +
                           " Retain the full-body motion, timing and lip movement from <Video 1> exactly. "
                           "Preserve the source video's camera, background, lighting, objects, and all other "
                           "people.\n```\n\nHope this helps!")
            reply = {"choices": [{"finish_reason": "stop",
                                  "message": {"role": "assistant", "content": content}}]}
            data = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        sm = _re.search(r"Write ONLY scene (\d+) of (\d+)", alltext)
        if sm:
            i = int(sm.group(1))
            # 2.293.0 SLOW_SCENES_TEST: a real 26B takes a while per scene -
            # scene 2+ answers after a pause, so the suite can SEE a scene
            # render while the writer is still writing ("▶ as written")
            if "SLOW_SCENES_TEST" in alltext and i >= 2:
                import time as _t
                _t.sleep(4)
            copycat = "COPYCAT_TEST" in alltext
            named_copy = "COPY of an earlier scene" in alltext
            k = 1 if (copycat and not named_copy) else i
            # 2.294.0 NATIVE_BAD_ONCE_TEST / NATIVE_BAD_ALWAYS_TEST: the habit
            # Tim saw on the native-audio board - the chain's (S1) + <d>
            # dialogue and an invented @drummer. ONCE: only the retry that
            # names the music-video rules gets a clean scene. ALWAYS: the
            # retry is bad too (the deterministic repair must land it).
            bad_once = "NATIVE_BAD_ONCE_TEST" in alltext
            bad_always = "NATIVE_BAD_ALWAYS_TEST" in alltext
            named_rules = "breaks the music-video rules" in alltext
            if bad_always or (bad_once and not named_rules):
                content = json.dumps({"shots": [{"id": "clip_%02d" % i, "prompt": [
                    "[Shot %d] @jinx (S1), a smoky alt-rock vocalist, sings directly to camera:" % i,
                    "<d>[English] I burned the map you drew for me, part %d.</d>" % i,
                    "",
                    "@drummer pounds the kit in the dark behind her."]}]})
                reply = {"choices": [{"finish_reason": "stop",
                                      "message": {"role": "assistant", "content": content}}]}
                data = json.dumps(reply).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            if bad_once and named_rules:
                content = json.dumps({"shots": [{"id": "clip_%02d" % i, "prompt": [
                    "[Shot %d] A rain-soaked rooftop at night, neon across the puddles." % i,
                    "",
                    "@jinx walks toward the lens along the parapet, part %d." % i,
                    "",
                    "@jinx sings the exact supplied vocal audio with natural, precise lip "
                    "synchronization; mouth fully visible and unobstructed, facing the camera.",
                    "",
                    "Maintain the neon palette, night.",
                    "No other people, no cuts."]}]})
                reply = {"choices": [{"finish_reason": "stop",
                                      "message": {"role": "assistant", "content": content}}]}
                data = json.dumps(reply).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            content = json.dumps({
                "prompt_prefix": ["subject_definitions:"],
                "shots": [{"id": "clip_%02d" % k,
                           "prompt": ["[Shot %d] @jinx waits in the dark, part %d." % (k, k)],
                           "length": 39, "seed": "7"}]})
            reply = {"choices": [{"finish_reason": "stop",
                                  "message": {"role": "assistant", "content": content}}]}
            data = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if wants and has_system:
            err = json.dumps({"error": {"message": "System role not supported",
                                        "type": "server_error", "code": 500}}).encode()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)
            return
        # 2.154.0 (Tim: supergemma4 "returns ⚠ the screenplay would not
        # render ... it does not populate the scenes"): a big creative model
        # often misses ONE validation rule on the first pass and fixes it
        # cleanly when handed the errors. With REPAIR_TEST in the brief this
        # stub answers a plan with an invented @stranger tag; only a request
        # that carries the validator's errors back gets the corrected plan.
        try:
            wants_repair = any("REPAIR_TEST" in str(m.get("content", "")) for m in msgs)
            is_repair = any("failed validation" in str(m.get("content", "")) for m in msgs)
        except Exception:
            wants_repair, is_repair = False, False
        # 2.162.0: the one-shot REWRITE contract ("edit scene N ..."). The
        # system message says rewrite ONE shot and return {"prompt": [...]};
        # this stub obeys, folding the user's instruction into the line so
        # the suite can assert the instruction actually reached the model.
        try:
            is_rewrite = any("rewrite ONE shot" in str(m.get("content", ""))
                             for m in msgs)
        except Exception:
            is_rewrite = False
        if is_rewrite:
            inst = ""
            for m in msgs:
                c = str(m.get("content", ""))
                if "Rewrite it per this instruction:" in c:
                    inst = c.split("Rewrite it per this instruction:")[-1].strip()
            content = json.dumps({"prompt": [
                "[Shot 1] @jinx waits in the dark, rewritten: " + inst[:60] + "."]})
            reply = {"choices": [{"finish_reason": "stop",
                                  "message": {"role": "assistant", "content": content}}]}
            data = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        # 2.281.0: TAGFIX_TEST — a plan whose ONLY sin is an invented tag.
        # The app now repairs this DETERMINISTICALLY (no second round), so
        # the suite asserts exactly ONE request and the 'tag repair:' note.
        try:
            wants_tagfix = any("TAGFIX_TEST" in str(m.get("content", ""))
                               for m in msgs)
        except Exception:
            wants_tagfix = False
        if wants_tagfix:
            content = ('{ "prompt_prefix": ["subject_definitions:"], "shots": ['
                       '{ "id": "clip_01", "prompt": ["[Shot 1] @figment waits '
                       'in the dark."], "length": 141, "seed": "7" }] }')
            reply = {"choices": [{"finish_reason": "stop",
                                  "message": {"role": "assistant", "content": content}}]}
            data = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        try:
            wants_prose = any("REPAIR_PROSE_TEST" in str(m.get("content", ""))
                              for m in msgs)
        except Exception:
            wants_prose = False
        if wants_prose:
            # 2.157.0 (Tim: "a repair pass was attempted but the model's
            # second reply was not a JSON plan"): some models answer the
            # correction with an APOLOGY instead of the plan. First reply:
            # the broken @stranger plan; the repair round: pure prose.
            if is_repair:
                content = ("I apologize for the confusion in my previous "
                           "response. Let me explain what went wrong with "
                           "the character assignments...")
            else:
                content = ('{ "prompt_prefix": ["subject_definitions:"], "shots": ['
                           '{ "id": "clip_01", "prompt": ["[Shot 1] @stranger waits."],'
                           ' "length": 141, "seed": "7" },'
                           '{ "id": "clip_01", "prompt": ["[Shot 1b] the echo."],'
                           ' "length": 141, "seed": "8" }] }')
            reply = {"choices": [{"finish_reason": "stop",
                                  "message": {"role": "assistant", "content": content}}]}
            data = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if wants_repair:
            if is_repair:
                content = ('{ "prompt_prefix": ["subject_definitions:"], "shots": ['
                           '{ "id": "clip_01", "prompt": ["[Shot 1] @jinx waits in the dark."],'
                           ' "length": 141, "seed": "7" }] }')
            else:
                content = ("Here you go:\n"
                           '{ "prompt_prefix": ["subject_definitions:"], "shots": ['
                           '{ "id": "clip_01", "prompt": ["[Shot 1] @stranger waits in the dark."],'
                           ' "length": 141, "seed": "7" },'
                           '{ "id": "clip_01", "prompt": ["[Shot 1b] the echo."],'
                           ' "length": 141, "seed": "8" }] }')
            reply = {"choices": [{"finish_reason": "stop",
                                  "message": {"role": "assistant", "content": content}}]}
            data = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        reply = {"choices": [{"finish_reason": "stop",
                              "message": {"role": "assistant", "content": CONTENT}}]}
        data = json.dumps(reply).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", PORT), H).serve_forever()

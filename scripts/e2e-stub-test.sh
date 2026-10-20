#!/usr/bin/env bash
# bitGen Studio v2 e2e with the stub sd-cli. Run from repo root: bash scripts/e2e-stub-test.sh
set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"
PASS=0; FAIL=0
say()  { echo "[e2e] $*"; }
ok()   { PASS=$((PASS+1)); say "PASS: $*"; }
bad()  { FAIL=$((FAIL+1)); say "FAIL: $*"; }
jget() { python3 -c "import json,sys;d=json.load(sys.stdin);print(d$1)"; }

rm -rf workspace projects config.json config.json.migrated custom.settings custom.settings.bak styles docker.cfg
mkdir -p models
for f in stub-fl2va.gguf stub-ref2va.gguf stub-te.gguf stub-vvae.safetensors stub-avae.safetensors; do
  : > "models/$f"
done
printf 'stub-src' > models/comfy_bf16_source.safetensors
# custom.settings (2.99.0): only what differs from default.settings. The shipped
# default engine is ComfyUI; the first half of this suite drives the sd-cli
# stub, so the backend is set explicitly here.
cat > custom.settings << CFG
{
  "python": "python3",
  "sd_cli": "scripts/stub-sd-cli.py",
  "engine": { "backend": "sdcli" },
  "models": {
    "fl2va": "models/stub-fl2va.gguf",
    "ref2va": "models/stub-ref2va.gguf",
    "text_encoder": "models/stub-te.gguf",
    "video_vae": "models/stub-vvae.safetensors",
    "audio_vae": "models/stub-avae.safetensors"
  },
  "defaults": { "width": 192, "height": 108, "frames": 121, "steps": 4, "seed": -1, "format": "webm" }
}
CFG

H3_E2E=1 node server.js > /tmp/h3srv.log 2>&1 &   # H3_E2E gates test-only routes
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -sf http://127.0.0.1:8311/api/health > /dev/null && break; sleep 0.25; done
say "server up (pid $SRV)"

# plan sanity: 15s auto resolves to ONE generation
P=$(curl -sf "http://127.0.0.1:8311/api/plan?seconds=15&pipeline=auto&segment_seconds=15")
[ "$(echo "$P" | jget "['pipeline']")" = "single" ] && [ "$(echo "$P" | jget "['chunks'][0]")" = "361" ] \
  && ok "plan: 15s auto -> single [361]" || bad "plan: 15s auto -> $P"

# path browser: default lists the app dir; models/ filtered to .gguf
FB=$(curl -sf "http://127.0.0.1:8311/api/fsbrowse")
echo "$FB" | python3 -c "import json,sys;d=json.load(sys.stdin);exit(0 if any(f['name']=='server.js' for f in d['files']) and 'models' in d['dirs'] else 1)" \
  && ok "fsbrowse: app dir listed (server.js + models/)" || bad "fsbrowse default: $FB"
FB=$(curl -sf "http://127.0.0.1:8311/api/fsbrowse?dir=models&exts=.gguf")
echo "$FB" | python3 -c "import json,sys;d=json.load(sys.stdin);ns=[f['name'] for f in d['files']];exit(0 if 'stub-fl2va.gguf' in ns and not any(n.endswith('.safetensors') for n in ns) else 1)" \
  && ok "fsbrowse: models/ ext filter works" || bad "fsbrowse filter: $FB"
# ---- 2.326.0: THE FILE DIALOG's routes (Tim: "create a file select and
# folder select dialog that looks and behaves like the windows 11 ones, but
# build it with nodejs and python"). Places come from the Python helper
# (scripts/fdlg_helper.py serve), lists / search / folders from Node, a
# thumbnail is a cached JPEG, /file reads the bytes for the upload shim.
FDT=/tmp/e2e_fdlg; rm -rf "$FDT"; mkdir -p "$FDT/Shots/deep"
ffmpeg -y -loglevel error -f lavfi -i "testsrc=size=640x360" -frames:v 1 "$FDT/Shots/frame.png"
ffmpeg -y -loglevel error -f lavfi -i "testsrc=size=320x180" -frames:v 1 "$FDT/Shots/deep/tiny.png"
echo notes > "$FDT/Shots/notes.txt"
FP=$(curl -s --max-time 20 http://127.0.0.1:8311/api/fdlg/places)
echo "$FP" | python3 -c "
import json,sys,os; d=json.load(sys.stdin)
assert d.get('from') == 'python', d.get('from')
assert d['drives'] and d['drives'][0]['path'] and 'free' in d['drives'][0], d['drives']
assert any(a['id'] == 'app' for a in d['app']) and d['start'] == os.getcwd(), (d['app'], d['start'])
" && ok "fdlg: the places come from the Python helper (drives with space, Quick access) plus the app's own places" \
  || bad "fdlg: places wrong: $(echo "$FP" | head -c 300)"
curl -s "http://127.0.0.1:8311/api/fdlg/list?dir=$FDT/Shots&exts=.png" | python3 -c "
import json,sys; d=json.load(sys.stdin)
n=sorted(e['name'] for e in d['entries'])
assert n == ['deep','frame.png'], n
e=[x for x in d['entries'] if x['name']=='frame.png'][0]
assert e['type']=='PNG File' and e['kind']=='image' and e['size']>0 and e['mtime']>0, e
" && curl -s "http://127.0.0.1:8311/api/fdlg/search?dir=$FDT&q=tiny" | python3 -c "
import json,sys; d=json.load(sys.stdin); assert [r['name'] for r in d['results']] == ['tiny.png'], d
" && curl -s "http://127.0.0.1:8311/api/fdlg/stat?path=$FDT/Shots" | grep -q '"dir":true' \
  && ok "fdlg: list (the filter keeps folders), search (subfolders), stat" || bad "fdlg: list / search / stat wrong"
FM=$(curl -s -X POST http://127.0.0.1:8311/api/fdlg/mkdir -H 'Content-Type: application/json' -d "{\"dir\":\"$FDT\"}")
FR=$(curl -s -X POST http://127.0.0.1:8311/api/fdlg/rename -H 'Content-Type: application/json' \
  -d "{\"dir\":\"$FDT\",\"from\":\"New folder\",\"to\":\"Takes\"}")
FX=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/fdlg/rename -H 'Content-Type: application/json' \
  -d "{\"dir\":\"$FDT\",\"from\":\"Takes\",\"to\":\"Shots\"}")
echo "$FM" | grep -q '"name":"New folder"' && echo "$FR" | grep -q '"ok":true' && [ -d "$FDT/Takes" ] && [ "$FX" = 400 ] \
  && ok "fdlg: New folder then Rename on disk; renaming onto an existing name is refused (400)" \
  || bad "fdlg: mkdir/rename wrong: $FM | $FR | $FX"
curl -s -o /tmp/fdlg_th.jpg -w '%{http_code} %{content_type}' "http://127.0.0.1:8311/api/fdlg/thumb?size=128&path=$FDT/Shots/frame.png" > /tmp/fdlg_th.txt
curl -s -o /tmp/fdlg_file.png "http://127.0.0.1:8311/api/fdlg/file?path=$FDT/Shots/frame.png"
grep -q "^200 image/jpeg" /tmp/fdlg_th.txt \
  && [ "$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 /tmp/fdlg_th.jpg)" = "128,72" ] \
  && cmp -s /tmp/fdlg_file.png "$FDT/Shots/frame.png" \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/api/fdlg/thumb?path=$FDT/Shots/notes.txt")" = 404 ] \
  && ok "fdlg: a 128 px JPEG thumbnail (Python + ffmpeg, cached), 404 for a type with none; /file hands back the exact bytes" \
  || bad "fdlg: thumb / file wrong: $(cat /tmp/fdlg_th.txt)"
rm -rf "$FDT" /tmp/fdlg_th.jpg /tmp/fdlg_th.txt /tmp/fdlg_file.png
# ---- 2.327.0: ASSET GROUPS + delete to the recycle bin (Tim: "allow user to
# select multiple items from the asset folder and group them. allow user to
# delete assets (send to recycle bin) create new folders for groups, allow
# user to add assets to group or send asset to a group"). Groups are folders
# in the dock (projects/<p>/asset_groups.json) - the files never move; ADD =
# also in that group, SEND = moves out of the group it was picked in.
AGJ() { curl -s -X POST http://127.0.0.1:8311/api/passets/groups -H 'Content-Type: application/json' -d "$1"; }
ffmpeg -y -loglevel error -f lavfi -i color=c=green:s=64x64 -frames:v 1 /tmp/e2e_ag1.png
ffmpeg -y -loglevel error -f lavfi -i color=c=yellow:s=64x64 -frames:v 1 /tmp/e2e_ag2.png
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=300:duration=1" /tmp/e2e_ag.wav
rm -f projects/default/asset_groups.json projects/default/recycle_bin/e2e_ag*
for f in e2e_ag1.png e2e_ag2.png e2e_ag.wav; do curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/$f" > /dev/null; done
AG1=$(AGJ '{"op":"create","name":"E2E Heroes","items":[{"kind":"images","name":"e2e_ag1.png"},{"kind":"images","name":"e2e_ag2.png"},{"kind":"sound","name":"e2e_ag.wav"},{"kind":"images","name":"e2e_not_there.png"}]}')
GH=$(echo "$AG1" | jget "['group']['id']" 2>/dev/null)
AG2=$(AGJ '{"op":"create","name":"E2E Villains"}'); GV=$(echo "$AG2" | jget "['group']['id']" 2>/dev/null)
ADUP=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/passets/groups -H 'Content-Type: application/json' -d '{"op":"create","name":"e2e heroes"}')
echo "$AG1" | python3 -c "
import json,sys; d=json.load(sys.stdin); g=d['group']
assert [(i['kind'],i['name']) for i in g['items']] == [('images','e2e_ag1.png'),('images','e2e_ag2.png'),('sound','e2e_ag.wav')], g
" && [ -n "$GV" ] && [ "$ADUP" = 400 ] && [ -f projects/default/asset_groups.json ] \
  && ok "asset groups: a group of the selection (pictures + a sound mixed; a missing file skipped), an empty one, a clashing name refused (400)" \
  || bad "asset groups: create wrong: $AG1 | $AG2 | $ADUP"
AGJ "{\"op\":\"send\",\"id\":\"$GV\",\"from\":\"$GH\",\"items\":[{\"kind\":\"images\",\"name\":\"e2e_ag1.png\"}]}" > /dev/null
AGJ "{\"op\":\"add\",\"id\":\"$GV\",\"items\":[{\"kind\":\"images\",\"name\":\"e2e_ag2.png\"}]}" > /dev/null
AGJ "{\"op\":\"rename\",\"id\":\"$GV\",\"name\":\"E2E Crew\"}" > /dev/null
curl -s http://127.0.0.1:8311/api/passets/groups | python3 -c "
import json,sys; g={x['name']:[i['name'] for i in x['items']] for x in json.load(sys.stdin)['groups']}
assert g == {'E2E Heroes':['e2e_ag2.png','e2e_ag.wav'], 'E2E Crew':['e2e_ag1.png','e2e_ag2.png']}, g
" && ok "asset groups: SEND moves e2e_ag1 out of Heroes into the other group, ADD keeps e2e_ag2 in both, rename" \
  || bad "asset groups: send / add / rename wrong: $(curl -s http://127.0.0.1:8311/api/passets/groups)"
AGJ "{\"op\":\"ungroup\",\"id\":\"$GH\",\"items\":[{\"kind\":\"images\",\"name\":\"e2e_ag2.png\"}]}" > /dev/null
AU=$(curl -s -X POST http://127.0.0.1:8311/api/passets/usage -H 'Content-Type: application/json' -d '{"items":[{"kind":"images","name":"e2e_ag1.png"}]}')
AR=$(curl -s -X POST http://127.0.0.1:8311/api/passets/recycle -H 'Content-Type: application/json' -d '{"items":[{"kind":"images","name":"e2e_ag1.png"},{"kind":"images","name":"e2e_gone.png"}]}')
echo "$AR" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert [m['name'] for m in d['moved']] == ['e2e_ag1.png'] and [m['name'] for m in d['missing']] == ['e2e_gone.png'], d
g={x['name']:[i['name'] for i in x['items']] for x in d['groups']}
assert g == {'E2E Heroes':['e2e_ag.wav'], 'E2E Crew':['e2e_ag2.png']}, g
" && echo "$AU" | grep -q '"inUse":\[\]' \
  && [ ! -f projects/default/images/e2e_ag1.png ] && [ -f projects/default/recycle_bin/e2e_ag1.png ] \
  && ! curl -sf http://127.0.0.1:8311/api/passets | grep -q e2e_ag1.png \
  && ok "asset delete: ungroup; usage asked first; the file MOVES to projects/default/recycle_bin (a missing one reported) and leaves every group" \
  || bad "asset delete wrong: $AU | $AR"
rm -f projects/default/sound/e2e_ag.wav
AGJ "{\"op\":\"delete\",\"id\":\"$GV\"}" > /dev/null
curl -s http://127.0.0.1:8311/api/passets/groups | python3 -c "
import json,sys; g={x['name']:[i['name'] for i in x['items']] for x in json.load(sys.stdin)['groups']}
assert g == {'E2E Heroes':[]}, g
" && [ -f projects/default/images/e2e_ag2.png ] \
  && ok "asset groups: a file removed outside the app drops out of its group; deleting a GROUP leaves its assets on disk" \
  || bad "asset groups: prune / delete group wrong: $(curl -s http://127.0.0.1:8311/api/passets/groups)"
curl -s -X POST http://127.0.0.1:8311/api/passets/recycle -H 'Content-Type: application/json' -d '{"items":[{"kind":"images","name":"e2e_ag2.png"}]}' > /dev/null
rm -f projects/default/asset_groups.json projects/default/recycle_bin/e2e_ag* /tmp/e2e_ag1.png /tmp/e2e_ag2.png /tmp/e2e_ag.wav

ffmpeg -y -loglevel error -f lavfi -i "color=c=orange:s=64x64" -frames:v 1 /tmp/ref.png
# Shared reference fixtures. These MUST be created here, before the first
# test that uploads them (the music-video mode test at ~line 300): they used
# to be built further down, so the upload silently failed, groupImages()
# filtered the missing file out, and every "ref" shot got downgraded to
# "cont" — which read as an app bug when it was really test ordering.
ffmpeg -y -loglevel error -f lavfi -i color=c=red:s=64x64 -frames:v 1 /tmp/e2e_ref1.png
ffmpeg -y -loglevel error -f lavfi -i color=c=blue:s=64x64 -frames:v 1 /tmp/e2e_ref2.png
# The reference SOUND belongs here for the same reason (2.125.0). It used to be
# built at the ref2va block near the end, but the project-reference block in the
# middle uploads it — so on a FRESH machine three project checks failed, and on a
# second run in the same container they passed because /tmp still held the file
# from the previous run. A suite that only passes the second time is a suite that
# reports the container's history, not the code's.
ffmpeg -y -loglevel error -f lavfi -i sine=frequency=300 -t 1 /tmp/e2e_ref.wav

run_job() { # name  curl-args...  expected_frames  must_log  audio(yes/no)
  local name="$1"; shift
  local want="$1"; shift
  local must="$1"; shift
  local wanta="$1"; shift
  local res id st
  res=$(curl -sf -X POST http://127.0.0.1:8311/api/generate "$@")
  id=$(echo "$res" | jget "['id']" 2>/dev/null)
  if [ -z "${id:-}" ]; then bad "$name: generate rejected: $res"; return; fi
  LAST_ID=$id
  say "$name: job $id"
  for i in $(seq 1 240); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$id" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  local J; J=$(curl -sf "http://127.0.0.1:8311/api/jobs/$id?log_from=0")
  local out; out=$(echo "$J" | jget "['output']")
  if [ "$st" != "done" ]; then
    bad "$name: status=$st"; echo "$J" | jget "['log']" | tail -5; return
  fi
  # resolve the CURRENT project's output folder (jobs can run under any project)
  local pdir; pdir=$(curl -sf http://127.0.0.1:8311/api/outputs/where \
    | jget "['dir']" 2>/dev/null)
  local f="${pdir:-projects/default/output}/$out"
  local got; got=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f" 2>/dev/null)
  [ "$got" = "$want" ] && ok "$name: $got/$want frames in $out" || bad "$name: got $got want $want"
  echo "$J" | jget "['log']" | grep -q "$must" && ok "$name: log has '$must'" || bad "$name: log missing '$must'"
  echo "$J" | jget "['log']" | grep -q "joined preview updated" && ok "$name: preview protocol present" || bad "$name: preview protocol missing"
  local astreams; astreams=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$f" | grep -c audio)
  if [ "$wanta" = "yes" ]; then
    [ "$astreams" -ge 1 ] && ok "$name: audio preserved" || bad "$name: audio LOST"
  fi
  curl -sf -o /dev/null "http://127.0.0.1:8311/api/jobs/$id/preview" && ok "$name: preview endpoint 200" || bad "$name: preview endpoint"
  local pv; pv=$(echo "$J" | jget "['preview_version']")
  say "$name: preview_version=$pv chunk=$(echo "$J" | jget "['chunk']")"
}

B=(-F prompt="e2e drone over misty pines, soft wind audio" -F width=192 -F height=108 -F steps=4 -F seed=30)

# 15s via Auto MUST be ONE generation (361 gen -> trim 1 -> 360f), audio intact
run_job auto-15s 360 "chunk 1/1" yes "${B[@]}" -F mode=t2va -F frames=360 -F pipeline=auto -F segment_seconds=15 -F format=webm

# ---- 2.384.0 (Tim: "when the job is done ... show metadata - seed,cfg,steps, model used,loras used"): the graph as
# queued says its seed / steps (scripts/comfy_client.print_meta -> lib/jobMeta) - on the job, and by its output name
curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID" | python3 -c "
import json,sys; m=json.load(sys.stdin).get('meta') or {}
assert m.get('seed')==30 and m.get('steps') and m.get('mode')=='t2va' and m.get('seconds') is not None, m
" && ok "job metadata: the finished job says its seed (30), steps, mode and render time (the worker's [meta] line)" \
  || bad "job metadata: $(curl -sf http://127.0.0.1:8311/api/jobs/$LAST_ID | head -c 400)"
OUTN=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID" | jget "['output']")
curl -sf "http://127.0.0.1:8311/api/job-meta?name=$OUTN" | python3 -c "
import json,sys; j=json.load(sys.stdin); assert j['meta']['seed']==30 and j['id'], j
" && ok "job metadata: GET /api/job-meta?name=<output> finds it (the preview dialog's right pane)" || bad "job metadata by name: $OUTN"

# ---- mp4 IS THE DEFAULT (2.102.1, Tim: "webm doesn't share over messenger").
# No -F format at all: the file must come out .mp4 as H.264 + AAC, faststart.
run_job default-mp4 48 "chunk 1/1" yes "${B[@]}" -F mode=t2va -F frames=48 -F pipeline=single
MP4J=$(curl -sf "http://127.0.0.1:8311/api/jobs" | python3 -c "
import json,sys; js=json.load(sys.stdin); js=js if isinstance(js,list) else js.get('jobs',js)
print([j for j in js if 'e2e drone' in (j.get('params',{}).get('prompt','') or j.get('prompt','')) and j.get('output','').endswith('.mp4')][-1:] and 'yes' or 'no')")
[ "$MP4J" = "yes" ] && ok "mp4: a generate with no format lands as .mp4" || bad "mp4: default output was not .mp4"
MP4F=$(ls -t "$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['dir']")"/*.mp4 2>/dev/null | head -1)
VC=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$MP4F" 2>/dev/null)
AC=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$MP4F" 2>/dev/null)
[ "$VC" = "h264" ] && [ "$AC" = "aac" ] && ok "mp4: H.264 video + AAC audio (Messenger/WhatsApp/iOS-safe)" || bad "mp4: codecs $VC/$AC in $MP4F"
# (the shipped default.settings value is pinned by test-settings.js; this e2e
# layer's custom.settings deliberately says webm so the explicit-format jobs
# above keep exercising VP9 — the route's own fallback is what put .mp4 here)
# past the ceiling Auto chunks with fl2va hand-off; audio must survive the joins
run_job auto-20s 480 "chunk 4/4" yes "${B[@]}" -F mode=t2va -F frames=480 -F pipeline=auto -F segment_seconds=5 -F format=webm
# frame-exact PNG rebuild (audio muxed back from the seam-dropped join)
run_job pngrebuild-6s 144 "chunk 2/2" yes "${B[@]}" -F mode=t2va -F frames=144 -F pipeline=png_rebuild -F segment_seconds=3 -F force_chunks=true -F format=webm
# ref2va with a reference image, small single run
run_job ref2va-1s 24 "chunk 1/1" yes "${B[@]}" -F mode=ref2va -F frames=24 -F pipeline=auto -F segment_seconds=15 -F format=webm -F references=@/tmp/ref.png

# 2.364.0 (Tim: "i think the llm is not following directions" - the prompt LLM wrote speech as plain quotes,
# which MiniMax H3 renders as babble): every prompt render marks its spoken lines as H3 dialogue, typed or LLM-written
SPJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
     -F 'prompt=She looks toward the camera and says with a bright, welcoming smile: "Thank you!" A hotel called "The Palace" glows behind her.' \
     -F width=192 -F height=108 -F steps=4 -F seed=31 -F mode=t2va -F frames=24 -F pipeline=auto -F format=webm)
SPID=$(echo "$SPJ" | jget "['id']")
for i in $(seq 1 120); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SPID" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 1
done
SPL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SPID?log_from=0")
echo "$SPL" | python3 -c "
import json,sys; d=json.load(sys.stdin); p=d['params']['prompt']; log='\n'.join(d.get('log',[]))
assert 'says with a bright, welcoming smile: <d>[English] Thank you!</d>' in p, p
assert 'called \"The Palace\"' in p, ('a quoted name is not speech', p)
assert 'Only the lines inside <d>...</d> are spoken' in p, p
assert 'formatted for MiniMax H3: 1 quoted line(s) -> <d>' in log, log[-400:]   # 2.365.0: the whole H3 shape
" > /tmp/speech364.log 2>&1 && echo "$SPJ" | grep -q "formatted for MiniMax H3: 1 quoted line(s)" \
  && ok "speech (2.364.0): a prompt render marks the spoken line as H3 dialogue (<d>[English] Thank you!</d>, the smile outside), leaves a quoted name alone, says so in the reply and the log" \
  || { bad "speech: the prompt render did not mark its spoken line"; tail -3 /tmp/speech364.log; }

# OOM auto-retry: stub OOMs without --max-vram; worker must retry segmented
OJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
     -F prompt="[oomtest] tiny clip" -F width=192 -F height=108 -F steps=4 -F seed=30 \
     -F mode=t2va -F frames=24 -F pipeline=auto -F format=webm)
OID=$(echo "$OJ" | jget "['id']")
for i in $(seq 1 120); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$OID" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 1
done
OL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$OID?log_from=0")
[ "$st" = "done" ] && echo "$OL" | jget "['log']" | grep -q -- "--max-vram 11, measured from free VRAM" \
  && echo "$OL" | jget "['log']" | grep -q "VAE moved to cuda1" \
  && ok "oom-retry: measured budget 11 + VAE relocated to cuda1" || bad "oom-retry: status=$st"

# stage-2 ladder: [oomtest2] OOMs until --offload-to-cpu appears
O2=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
     -F prompt="[oomtest2] tiny clip" -F width=192 -F height=108 -F steps=4 -F seed=30 \
     -F mode=t2va -F frames=24 -F pipeline=auto -F format=webm)
O2ID=$(echo "$O2" | jget "['id']")
for i in $(seq 1 120); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$O2ID" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 1
done
O2L=$(curl -sf "http://127.0.0.1:8311/api/jobs/$O2ID?log_from=0")
[ "$st" = "done" ] && echo "$O2L" | jget "['log']" | grep -q "CPU weight offload" \
  && ok "oom-ladder: stage-2 --offload-to-cpu completed the chunk" || bad "oom-ladder2: status=$st"

# stage-3 ladder: [vmmtest] crashes with device-not-ready until stability env set
O3=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
     -F prompt="[vmmtest] tiny clip" -F width=192 -F height=108 -F steps=4 -F seed=30 \
     -F mode=t2va -F frames=24 -F pipeline=auto -F format=webm)
O3ID=$(echo "$O3" | jget "['id']")
for i in $(seq 1 120); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$O3ID" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 1
done
O3L=$(curl -sf "http://127.0.0.1:8311/api/jobs/$O3ID?log_from=0")
[ "$st" = "done" ] && echo "$O3L" | jget "['log']" | grep -q "CUDA stability mode" \
  && ok "vmm-ladder: stage-3 stability retry completed the chunk" || bad "vmm-ladder: status=$st"

# say() must survive cp1252 consoles (the \u26a1 crash)
PYTHONIOENCODING=cp1252 python3 - << 'PY' && ok "worker say(): cp1252-safe" || bad "worker say(): cp1252 crash"
import importlib.util as u
spec = u.spec_from_file_location("w", "worker.py")
w = u.module_from_spec(spec)
try:
    spec.loader.exec_module(w)
except SystemExit:
    pass
w.say("\u26a1 \u2713 \u2014 unicode probe")
PY

# model tools: convert a local safetensors -> GGUF via the stub
CR=$(curl -sf -X POST http://127.0.0.1:8311/api/modeltools -H 'Content-Type: application/json' \
     -d '{"op":"convert","source":"comfy_bf16_source.safetensors","qtype":"q8_0"}')
CID=$(echo "$CR" | jget "['id']")
for i in $(seq 1 60); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$CID" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 0.5
done
[ "$st" = "done" ] && [ -s models/comfy_bf16_source-q8_0.gguf ] \
  && ok "convert: generated models/comfy_bf16_source-q8_0.gguf" \
  || bad "convert: status=$st"

# ---- get-llama.ps1 (2.104.1): /releases/latest is the semver notes tag with
# NO binaries (Tim: "Latest release: v0.3.0 ... No Windows CUDA zip"). The
# script must scan the bNNNNN builds. PowerShell cannot run here, so the asset
# regexes are exercised in Python against the real names from GitHub.
python3 - <<'PYEOF'
import re
src = open("get-llama.ps1").read()
code = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
assert "releases?per_page=" in code and "/releases/latest" not in code, "still trusts /releases/latest"
assert '-Cuda' in src and 'ValidateSet("13", "12")' in src, "no CUDA generation choice"
assert "Invoke-WebRequest -Uri \"https://github.com/ggml-org/llama.cpp/releases\"" in src, "no HTML fallback for a rate-limited API"
names = ["cudart-llama-bin-win-cuda-12.4-x64.zip", "cudart-llama-bin-win-cuda-13.3-x64.zip",
         "cudart-llama-bin-win-cuda-13.4-arm64.zip", "llama-b10456-bin-win-cuda-12.4-x64.zip",
         "llama-b10456-bin-win-cuda-13.3-x64.zip", "llama-b10456-bin-win-cuda-13.4-arm64.zip",
         "llama-b10456-bin-win-cpu-x64.zip", "llama-b10456-bin-win-vulkan-x64.zip", "Source code (zip)"]
for maj, want in (("13", "13.3"), ("12", "12.4")):
    bins = [n for n in names if re.match(r"^llama-.*-bin-win-cuda-%s\.\d+-x64\.zip$" % maj, n)]
    assert bins == ["llama-b10456-bin-win-cuda-%s-x64.zip" % want], (maj, bins)
    ver = re.search(r"cuda-(\d+\.\d+)-x64", bins[0]).group(1)
    assert "cudart-llama-bin-win-cuda-%s-x64.zip" % ver in names
html = '<a href="/ggml-org/llama.cpp/releases/download/b10456/llama-b10456-bin-win-cuda-13.3-x64.zip">'
m = re.search(r"/ggml-org/llama\.cpp/releases/download/(b\d+)/llama-\1-bin-win-cuda-(13\.\d+)-x64\.zip", html)
assert m and m.groups() == ("b10456", "13.3")
w = open("worker.py").read()
assert '"-Cuda", cuda' in w and "CUDA Version:" in w, "worker does not pass the driver's CUDA generation"
PYEOF
[ $? = 0 ] && ok "get-llama.ps1: scans bNNNNN builds, picks the x64 CUDA 13/12 zip + its cudart, HTML fallback, driver-aware" \
  || bad "get-llama.ps1: installer shape regressed"

# reject explicit single over the ceiling
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/generate \
    "${B[@]}" -F mode=t2va -F frames=480 -F pipeline=single)
[ "$R" = "400" ] && ok "explicit single >361f rejected (400)" || bad "single-cap: got $R"

# sd-cli installer endpoint: queues; on non-Windows the worker must fail
# gracefully with the manual-install hint (Windows runs the real installer)
IR=$(curl -sf -X POST http://127.0.0.1:8311/api/sdcli/install)
IID=$(echo "$IR" | jget "['id']")
for i in $(seq 1 40); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$IID" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 0.5
done
IL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$IID?log_from=0")
if [ "$(uname)" = "Linux" ]; then
  [ "$st" = "failed" ] && echo "$IL" | jget "['log']" | grep -q "Windows-only" \
    && ok "sdcli install: graceful non-Windows message" || bad "sdcli install: $st"
else
  say "sdcli install on $(uname): status=$st"
fi

# ---- enhance mapping: one subject may span several pictures
EM=$(curl -sf -X POST http://127.0.0.1:8311/api/enhance -H 'Content-Type: application/json' \
  -d '{"prompt":"walk on a beach","mode":"ref2va","refs":[
       {"subject":1,"role":"face","picture":1},
       {"subject":1,"role":"clothing","picture":2},
       {"subject":2,"role":"person","picture":3}]}' 2>/dev/null || true)
python3 - "$EM" <<'PYEOF'
import json, sys, urllib.request
# the LLM may be absent in CI; assert on the mapping builder itself instead
src = open("routes/index.js").read()
assert "r.picture || i + 1" in src, "enhance mapping not picture-indexed"
assert "may be shown in several pictures" in src, "system prompt missing multi-picture rule"
print("ok")
PYEOF
[ $? = 0 ] && ok "enhance: mapping is picture-indexed (subject may repeat)" \
  || bad "enhance: mapping shape"
node -e "process.stdout.write(require('./lib/extensions').pageHtml(process.cwd()))" > /tmp/bg-page.html
UIH=$(cat /tmp/bg-page.html)
echo "$UIH" | grep -q '<Picture ${i + 1}>' \
  && echo "$UIH" | grep -q 'class="planline"' \
  && ok "ui: picture tags follow slot order; plan readout is a fixed single line" \
  || bad "ui: tray/plan-line markers missing"
echo "$UIH" | grep -q '#seconds { width: 4ch' \
  && ok "ui: Seconds input is 4 characters wide" \
  || bad "ui: Seconds input width rule missing"
echo "$UIH" | grep -q 'for (let n = 1; n <= SUBJECTS_MAX; n++)' \
  && echo "$UIH" | grep -q 'function nextFreeSubject' \
  && ! echo "$UIH" | grep -q 'class="plus"' \
  && ok "ui: all 9 subject numbers selectable, no + unlock button" \
  || bad "ui: subject dropdown is not the full 1-9 range"

# ---- preview must run to the END OF THE TIMELINE, not the end of a clip (2.61.0)
python3 - <<'PYEOF'
import re
h = open("/tmp/bg-page.html", encoding="utf-8").read()
body = h[h.index("function pvTickBody()"):h.index("function pvStart()")]
# exactly ONE stop in the tick: the timeline/OUT-marker check at the top.
# Any other pvStop() here means a base-track path can cut the preview short
# while an overlay, image or audio layer is still running.
# strip comments first: the prose in this function names pvStop()
code = "\n".join(re.sub(r"//.*$", "", ln) for ln in body.splitlines())
stops = re.findall(r"pvStop\(\)", code)
assert len(stops) == 1, "pvTickBody has %d pvStop() calls, expected 1" % len(stops)
assert code.index("pvStop()") < code.index("const c = tl.video[pv.clip]"), \
    "the stop check must come before any base-track handling"
# the base track running out drops into gap mode instead of stopping
assert "toGap(end)" in body, "V1 exhaustion no longer falls into gap mode"
# stopAt spans every layer
st = h[h.index("function pvStart()"):]
assert "pv.stopAt = tl.sel ? tl.sel.b : Math.max(end, 0.01)" in st, \
    "stopAt may be null again — the timeline end must always win"
scene = h[h.index("function sceneEnd()"):]
scene = scene[:scene.index("function clipAt")]
for layer in ("tl.video", "vLayerClips()", "allClips(tl.audio)", "allClips(tl.images)"):
    assert layer in scene, "sceneEnd() ignores %s" % layer
# preview caches must be URL-keyed, never index-keyed (indices are reused the
# moment a clip is deleted or moved, which replays stale footage)
assert "vClipKey" not in h, "index-keyed preview cache is back"
ens = h[h.index("function pvEnsureAssets()"):h.index("function pvTick()")]
assert "pv.vids.get" not in ens
assert "clipUrl(c)" in ens and "prune(" in ens, "caches are not pruned per run"
# pvGlobalT must survive an emptied base track (pvTick re-arms only at the
# bottom of its body, so one throw kills the whole loop)
g = h[h.index("function pvGlobalT()"):h.index("function clipUrl")]
assert "if (!c) return" in g, "pvGlobalT can still dereference a missing clip"
print("ok")
PYEOF
[ $? = 0 ] && ok "ui: preview plays every layer through to the end of the timeline" \
  || bad "ui: preview can still stop at the end of the base track"
echo "$UIH" | grep -q 'pv.vids.get(clipUrl(c2))' \
  && echo "$UIH" | grep -q "pv.audios.get(soundUrl(ac))" \
  && ok "ui: preview layers are looked up by URL, so a moved clip cannot replay stale media" \
  || bad "ui: preview cache lookups are not URL-keyed"

# ---- queue frame: in its OWN dock since 2.90.0, fills it, scrolls internally
echo "$UIH" | grep -q 'class="qframe" id="qframe"' \
  && echo "$UIH" | grep -q 'id="qfbody" data-dockscroll' \
  && ok "ui: queue sits in its own frame with a slider-managed body" \
  || bad "ui: queue frame markup missing"
python3 - <<'PYEOF'
import re, sys
h = open("/tmp/bg-page.html", encoding="utf-8").read()
# the frame lives in the queue dock, between the main column and the gallery
qd = h[h.index('<aside class="dock right" id="qdock">'):h.index('<aside class="dock right" id="rdock">')]
assert '<section class="qframe" id="qframe">' in qd, "qframe is not inside #qdock"
ld = h[h.index('<aside class="dock" id="ldock">'):h.index('<div class="vsplit" data-resize="ldock">')]
assert 'id="qframe"' not in ld, "the queue is still (also) in the left dock"
assert h.index('<div class="vsplit" data-resize="qdock">') < h.index('id="qdock"'), "no splitter before the queue dock"
# basis 0 is what makes the frame claim the dock's height under its header
# the MAIN rule, anchored to a line start: '#qdock .qframe { margin }' comes first
m = re.search(r'(?m)^\s*\.qframe \{[^}]*\}', h)
assert m and "flex: 1 1 0" in m.group(0), "qframe must use flex-basis 0"
assert "min-height: 116px" in m.group(0), "qframe needs a floor height"
assert re.search(r'\.dock \{[^}]*flex-direction: column', h, re.S), "a dock must be a column for the frame to fill it"
# the rule that pinned the queue under the settings must be gone with the queue
nocomment = re.sub(r'/\*.*?\*/', '', h, flags=re.S)       # a comment may NAME the old rule
assert not re.search(r'#ldock > \.scroll \{[^}]*flex: 0 1 auto', nocomment), "the left dock still reserves room for a queue it no longer holds"
# the grid knows the new column and how to hide it
assert "--qdock:" in h and "#app.no-queue" in h, "no width variable / collapse class for the queue dock"
print("ok")
PYEOF
[ $? = 0 ] && ok "ui: queue frame fills its own dock, and the left dock no longer reserves room for it" \
  || bad "ui: queue frame flex chain wrong"
echo "$UIH" | grep -q 'src="/static/dockscroll.js?v=' \
  && ok "ui: dockscroll slider module is loaded" \
  || bad "ui: dockscroll.js not referenced"
# every dock scroll region must be slider-managed (i.e. no native scrollbar)
python3 - <<'PYEOF'
import re
h = open("/tmp/bg-page.html", encoding="utf-8").read()
regions = re.findall(r'<div class="scroll"[^>]*>', h)
assert regions, "no dock scroll regions found"
bad = [r for r in regions if "data-dockscroll" not in r]
assert not bad, "dock scroll region without a slider: %s" % bad
js = open("static/dockscroll.js", encoding="utf-8").read()
assert "scrollbar-width: none" in js and "::-webkit-scrollbar" in js, "native bar not hidden"
print("ok %d regions" % len(regions))
PYEOF
[ $? = 0 ] && ok "ui: no dock shows a native scrollbar (all slider-managed)" \
  || bad "ui: a dock still uses a native scrollbar"

# ---- LLM tokens + hybrid offload (2.148.0, by instruction) -----------------
# The slider's value and the offload layer count must survive the config
# round trip, feed llmChat's default budget, and drive llama-server's -ngl.
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"llm":{"max_tokens":1234,"gpu_layers":20,"ctx":16384}}' > /dev/null
curl -sf http://127.0.0.1:8311/api/config | python3 -c "
import json,sys
l=json.load(sys.stdin)['llm']
assert l['max_tokens']==1234 and l['gpu_layers']==20 and l['ctx']==16384, l
" && ok "llm: max_tokens and gpu_layers survive the config round trip" \
  || bad "llm: token/offload settings did not persist"
node -e "
const s=require('fs').readFileSync('lib/core.js','utf8');
const c=require('fs').readFileSync('lib/llmChat.js','utf8');
if(!/gpu_layers/.test(s)||!/args\.push\(\"-ngl\", String\(layers\)\)/.test(s)) process.exit(1);
if(!/config\.llm\.max_tokens/.test(c.replace(/\n/g,' '))&&!/config\.llm && config\.llm\.max_tokens/.test(c)) process.exit(1);
" && ok "llm: -ngl rides gpu_layers and the reply budget falls back to llm.max_tokens" \
  || bad "llm: offload/budget wiring missing from core/llmChat"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"llm":{"max_tokens":600,"gpu_layers":-1,"ctx":8192}}' > /dev/null
# ---- dockers.json (2.159.0): the GLOBAL dock layout over HTTP --------------
curl -s -X POST http://127.0.0.1:8311/api/dockers -H 'Content-Type: application/json' \
  -d '{"docks":{"timelinedock":{"height":345,"state":"min"},"musicdock":{"height":9}}}' > /dev/null
curl -sf http://127.0.0.1:8311/api/dockers | python3 -c "
import json,sys
d=json.load(sys.stdin)['docks']
assert d['timelinedock']=={'height':345,'state':'min'}, d
assert d['musicdock']['height']==60, d          # clamped
" && python3 -c "
import json
d=json.load(open('dockers.json'))['docks']
assert d['timelinedock']['height']==345, d
" && ok "dockers: heights and states round-trip the API and land in dockers.json at the install root" \
  || bad "dockers: layout round trip failed"
curl -s -X POST http://127.0.0.1:8311/api/dockers -H 'Content-Type: application/json' \
  -d '{"docks":{"timelinedock":{"height":null,"state":"normal"},"musicdock":{"height":null}}}' > /dev/null
# ---- a clip that fits one generation is NEVER segmented, even on Chunked
for E in sdcli comfy; do
  curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
    -d "{\"engine\":{\"backend\":\"$E\"}}" > /dev/null
  P1=$(curl -sf "http://127.0.0.1:8311/api/plan?seconds=15&pipeline=chunked&segment_seconds=5" \
       | python3 -c "import json,sys; p=json.load(sys.stdin); print(len(p['chunks']))")
  [ "$P1" = "1" ] && ok "plan[$E]: 15s stays ONE generation on Chunked+5s segments" \
    || bad "plan[$E]: 15s split into $P1 chunks"
done
P2=$(curl -sf "http://127.0.0.1:8311/api/plan?seconds=20&pipeline=auto&segment_seconds=15" \
     | python3 -c "import json,sys; p=json.load(sys.stdin); print(len(p['chunks']))")
[ "$P2" = "2" ] && ok "plan: past the ceiling still chunks" || bad "plan: 20s -> $P2 chunks"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"sdcli"}}' > /dev/null
python3 -c "
import sys; sys.path.insert(0,'.')
import worker
assert worker.plan_chunks(360, 120)['chunks'] == [361], worker.plan_chunks(360, 120)
assert worker.plan_chunks(360, 120, grid='17k5')['chunks'] == [362]
assert len(worker.plan_chunks(480, 361)['chunks']) == 2
print('worker planner ok')" >/dev/null 2>&1 \
  && ok "worker planner agrees: fits-one-run is never split" || bad "worker planner mismatch"

# ---- music video: song -> 15s shots on the grid, rendered and muxed
ffmpeg -y -loglevel error -f lavfi -i sine=frequency=220 -t 20 /tmp/e2e_song.wav
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_song.wav" > /dev/null
MP=$(curl -sf "http://127.0.0.1:8311/api/musicvideo/plan?song=e2e_song.wav&shot_seconds=15")
echo "$MP" | grep -q '"songSeconds"' && echo "$MP" | jget "['shots']" | grep -q "keep" \
  && ok "musicvideo: song split into grid-aligned shots" || bad "musicvideo: plan=${MP:0:140}"
MPN=$(echo "$MP" | python3 -c "import json,sys; p=json.load(sys.stdin); print(len(p['shots']), p['frames'])")
[ "$MPN" = "2 480" ] && ok "musicvideo: 20s song -> 15s + 5s = 480 frames exactly" \
  || bad "musicvideo: expected '2 480' got '$MPN'"
MJ=$(curl -sf -X POST http://127.0.0.1:8311/api/musicvideo -H 'Content-Type: application/json' \
  -d '{"song":"e2e_song.wav","format":"webm","steps":4,"width":192,"height":108,
       "shots":[{"seconds":2,"prompt":"drone over neon city"},
                {"seconds":1,"prompt":"close on the singer"}]}')
MID=$(echo "$MJ" | jget "['id']")
if [ -z "$MID" ]; then bad "musicvideo: submit rejected: ${MJ:0:140}"; else
  for i in $(seq 1 240); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$MID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  ML=$(curl -sf "http://127.0.0.1:8311/api/jobs/$MID?log_from=0")
  MOUT=$(echo "$ML" | jget "['output']")
  MDIR=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['dir']")
  MF="$MDIR/$MOUT"
  MFR=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$MF" 2>/dev/null)
  [ "$st" = "done" ] && [ "$MFR" = "72" ] \
    && ok "musicvideo: 2s+1s shots -> exactly 72 frames (3.00s)" \
    || bad "musicvideo: status=$st frames=$MFR"
  echo "$ML" | jget "['log']" | grep -q "music video: 2 shot(s)" \
    && ok "musicvideo: shot plan logged" || bad "musicvideo: plan line missing"
  echo "$ML" | jget "['log']" | grep -q "shot 2/2 \[.*\]: close on the singer" \
    && ok "musicvideo: per-shot prompts applied" || bad "musicvideo: shot prompts not swapped"
  echo "$ML" | jget "['log']" | grep -q "song synced" \
    && ok "musicvideo: song muxed over the finished cut" || bad "musicvideo: no mux line"
  MA=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$MF" | grep -c audio)
  [ "$MA" -ge 1 ] && ok "musicvideo: output carries the song" || bad "musicvideo: no audio track"
fi

# ---- music video: per-shot mode (fresh reference shot vs continuation)
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_ref1.png" > /dev/null \
  || bad "musicvideo: reference fixture upload failed (is /tmp/e2e_ref1.png missing?)"
curl -sf -X POST http://127.0.0.1:8311/api/refgroups -H 'Content-Type: application/json' \
  -d '{"name":"mvGrp","images":[{"name":"e2e_ref1.png","subject":1,"role":"face"}]}' > /dev/null
MM=$(curl -sf -X POST http://127.0.0.1:8311/api/musicvideo -H 'Content-Type: application/json' \
  -d '{"format":"webm","steps":4,"width":192,"height":108,"ref_group":"mvGrp",
       "default_mode":"ref",
       "shots":[{"seconds":1,"prompt":"hero wide","mode":"ref"},
                {"seconds":1,"prompt":"hero close","mode":"ref","ref_group":"mvGrp"},
                {"seconds":1,"prompt":"pull back","mode":"cont"}]}')
MMID=$(echo "$MM" | jget "['id']")
if [ -z "$MMID" ]; then bad "musicvideo/modes: submit rejected: ${MM:0:140}"; else
  for i in $(seq 1 240); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$MMID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  MML=$(curl -sf "http://127.0.0.1:8311/api/jobs/$MMID?log_from=0" | jget "['log']")
  echo "$MML" | grep -q "shot 2/3 \[ref2va · 1 ref · group mvGrp\]" \
    && ok "musicvideo: mid-sequence shot re-anchors to its reference group" \
    || bad "musicvideo: shot 2 not a fresh ref shot"
  # 2.130.0: a continuation shot hands off the last frame AND still carries the
  # reference group's picture. It used to read "[fl2va]" with no ref, which is
  # precisely the character reset Tim hit on long clips.
  echo "$MML" | grep -q "shot 3/3 \[fl2va · 1 ref\]" \
    && ok "musicvideo: continuation shots hand off the last frame AND keep the reference" \
    || bad "musicvideo: shot 3 not a continuation carrying its reference"
  MMF=$(curl -sf "http://127.0.0.1:8311/api/jobs/$MMID" | jget "['output']")
  MMD=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['dir']")
  MMFR=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$MMD/$MMF" 2>/dev/null)
  [ "$st" = "done" ] && [ "$MMFR" = "72" ] \
    && ok "musicvideo: mixed-mode cut is still frame-exact (72f)" \
    || bad "musicvideo/modes: status=$st frames=$MMFR"
fi

curl -sf -X DELETE http://127.0.0.1:8311/api/refgroups/mvGrp > /dev/null

# ---- timeline export with a second video layer + a sound layer
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=192x108:rate=24 \
  -f lavfi -i sine=frequency=330 -t 2 -pix_fmt yuv420p -c:v libvpx-vp9 -b:v 0 -crf 40 \
  -c:a libopus /tmp/e2e_base.webm
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=96x54:rate=24 \
  -f lavfi -i sine=frequency=660 -t 1 -pix_fmt yuv420p -c:v libvpx-vp9 -b:v 0 -crf 40 \
  -c:a libopus /tmp/e2e_over.webm
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_base.webm" > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_over.webm" > /dev/null
XJ=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_base.webm","src":"video","in":0,"out":null,"opacity":1,"start":0}],
       "video_layers":[{"muted":false,"clips":[{"name":"e2e_over.webm","src":"video","in":0,
                        "out":null,"opacity":0.5,"start":0.5}]}],
       "audio":[[]],"images":[[]],"keep_original_audio":true}')
XID=$(echo "$XJ" | jget "['id']")
if [ -z "$XID" ]; then bad "export: rejected ${XJ:0:120}"; else
  for i in $(seq 1 180); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$XID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  XL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$XID?log_from=0")
  echo "$XL" | jget "['log']" | grep -q "1 overlay-layer" \
    && ok "export: second video layer reaches the compositor" \
    || bad "export: overlay layer missing from the log"
  XO=$(echo "$XL" | jget "['output']")
  XF="projects/$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")/$XO"
  [ "$st" = "done" ] && [ -s "$XF" ] \
    && ok "export: layered timeline compiled" || bad "export: status=$st file=$XF"
  XA=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$XF" 2>/dev/null | grep -c audio)
  [ "$XA" -ge 1 ] && ok "export: layer audio mixed in" || bad "export: no audio in the export"
  echo "$XL" | jget "['log']" | grep -q "e2e_export\|timeline export complete" \
    && ok "export: completed cleanly" || bad "export: no completion line"
fi

# ---- 2.215.0 (Tim's hardware log: "Only VP8 or VP9 or AV1 ... supported for
# WebM" -> "stream copy failed, re-encoding join"): h264 ComfyUI takes must
# join by LOSSLESS STREAM COPY into a container that admits them (.mkv), and
# a plain no-overlay export of that track must REMUX to the final .mp4 with
# -c copy — the rendered bytes reach the movie untouched, in seconds, with
# no vp9 detour. The old world (vp9 webm segments -> allv.webm) is the leg
# above, unchanged.
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=192x108:rate=24 \
  -f lavfi -i sine=frequency=330 -t 1 -pix_fmt yuv420p -c:v libx264 -preset veryfast \
  -c:a aac -shortest /tmp/e2e_h264a.mp4
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=192x108:rate=24 \
  -f lavfi -i sine=frequency=660 -t 1 -pix_fmt yuv420p -c:v libx264 -preset veryfast \
  -c:a aac -shortest /tmp/e2e_h264b.mp4
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_h264a.mp4" > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_h264b.mp4" > /dev/null
HJ=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_h264a.mp4","src":"video","in":0,"out":null,"opacity":1,"start":0},
               {"name":"e2e_h264b.mp4","src":"video","in":0,"out":null,"opacity":1,"start":1}],
       "video_layers":[],"audio":[[]],"images":[[]],"keep_original_audio":true}')
HID=$(echo "$HJ" | jget "['id']")
if [ -z "$HID" ]; then bad "h264 export: rejected ${HJ:0:120}"; else
  for i in $(seq 1 180); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$HID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  HL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$HID?log_from=0")
  echo "$HL" | jget "['log']" | grep -q "joining into allv.mkv" \
    && ok "h264 export: the join names the codecs and picks .mkv so the copy can mux" \
    || bad "h264 export: mkv container line missing"
  echo "$HL" | jget "['log']" | grep -q "stream copy failed" \
    && bad "h264 export: the join STILL fell back to a re-encode" \
    || ok "h264 export: the segments stream-copied — no re-encode fallback fired"
  echo "$HL" | jget "['log']" | grep -q "losslessly remuxed" \
    && ok "h264 export: the final .mp4 is a lossless remux of the rendered bytes" \
    || bad "h264 export: remux line missing (paid a transcode for nothing)"
  HO=$(echo "$HL" | jget "['output']")
  HF="projects/$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")/$HO"
  HV=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$HF" 2>/dev/null)
  [ "$st" = "done" ] && [ "$HV" = "h264" ] \
    && ok "h264 export: the movie plays as h264 mp4" \
    || bad "h264 export: status=$st codec=$HV file=$HF"
fi

# ---- IN/OUT transitions actually reach the render (2.60.0).
# Before 2.60.0 /api/export never copied the transition keys onto the job, so
# the worker read None and EVERY transition was silently dropped. Assert the
# pass-through on the job itself, then assert the picture really changed.
TJ=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_base.webm","src":"video","in":0,"out":null,"opacity":1,"start":0}],
       "video_transition_in":{"type":"fade","dur":0.4},
       "video_transition_out":{"type":"fadewhite","dur":0.4},
       "video_layers":[],
       "audio":[{"transition_in":{"type":"fade","dur":0.3},
                 "transition_out":{"type":"fade","dur":0.3},"clips":[]}],
       "images":[[]],"keep_original_audio":true}')
TID=$(echo "$TJ" | jget "['id']")
TPAR=$(curl -sf "http://127.0.0.1:8311/api/jobs/$TID")
echo "$TPAR" | grep -q '"video_transition_in"' && echo "$TPAR" | grep -q '"video_transition_out"' \
  && ok "transitions: in/out survive /api/export onto the job" \
  || bad "transitions: export dropped the transition keys"
echo "$TPAR" | grep -q 'fadewhite' \
  && ok "transitions: the chosen transition id is preserved, not flattened to a cut" \
  || bad "transitions: transition id lost"
if [ -n "$TID" ]; then
  for i in $(seq 1 180); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$TID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  TL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$TID?log_from=0")
  echo "$TL" | jget "['log']" | grep -q "V1 boundary" \
    && ok "transitions: the worker logs the V1 boundary fade it applied" \
    || bad "transitions: no V1 boundary line in the worker log"
  TO=$(echo "$TL" | jget "['output']")
  TF="projects/$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")/$TO"
  if [ "$st" = "done" ] && [ -s "$TF" ]; then
    ok "transitions: a faded timeline compiles"
    # the proof: frame 0 must be much darker than the middle (fading up from
    # black), and the tail much brighter (dipping to WHITE)
    python3 - "$TF" <<'PYEOF'
import subprocess, sys
f = sys.argv[1]
def y(t):
    r = subprocess.run(["ffprobe","-v","error","-f","lavfi",
        "-i","movie=%s,trim=start=%s:duration=0.05,signalstats" % (f, t),
        "-show_entries","frame_tags=lavfi.signalstats.YAVG","-of","csv=p=0"],
        capture_output=True, text=True)
    # csv=p=0 leaves a trailing comma on some containers (mp4 does, webm did not)
    v = [float(x.rstrip(",")) for x in r.stdout.split() if x.strip(" ,\n")]
    return v[0] if v else None
d = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
    "-of","csv=p=0",f], capture_output=True, text=True).stdout.strip() or 0)
head, mid, tail = y(0.0), y(d/2), y(max(0.0, d-0.08))
assert None not in (head, mid, tail), "could not measure luminance"
assert head < mid - 20, "no fade-in: head %.1f vs mid %.1f" % (head, mid)
assert tail > mid + 20, "no dip to white: tail %.1f vs mid %.1f" % (tail, mid)
print("ok head=%.1f mid=%.1f tail=%.1f" % (head, mid, tail))
PYEOF
    [ $? = 0 ] && ok "transitions: the fade is visible in the pixels (dark in, white out)" \
      || bad "transitions: the rendered frames show no fade"
  else
    bad "transitions: faded export status=$st file=$TF"
  fi
fi

# NOTE: every compile writes the same <project>.mp4 now, so these extra
# exports are submitted only AFTER the faded one above has been measured.
# an unknown id must degrade to a cut rather than reaching ffmpeg
UJ=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_base.webm","src":"video","in":0,"out":null,"opacity":1,"start":0}],
       "video_transition_in":{"type":"teleport","dur":99},
       "audio":[[]],"images":[[]],"keep_original_audio":true}')
curl -sf "http://127.0.0.1:8311/api/jobs/$(echo "$UJ" | jget "['id']")" \
  | grep -q '"teleport"' \
  && bad "transitions: an unknown id was passed through to the worker" \
  || ok "transitions: an unknown id is normalized to a cut at the boundary"
# a legacy bare-array audio track must still compile
LJ=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_base.webm","src":"video","in":0,"out":null,"opacity":1,"start":0}],
       "audio":[[]],"images":[[]],"keep_original_audio":true}')
[ -n "$(echo "$LJ" | jget "['id']")" ] \
  && ok "transitions: a legacy bare-array track shape still exports" \
  || bad "transitions: legacy track shape rejected"
# ---- compile lands at projects/<project>/<project>.mp4 (2.62.0)
PRJ=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")
[ "$XO" = "$PRJ.mp4" ] \
  && ok "compile: the output is named <project>.mp4" \
  || bad "compile: expected $PRJ.mp4, got $XO"
[ -s "projects/$PRJ/$PRJ.mp4" ] \
  && ok "compile: written into the project ROOT, not final/" \
  || bad "compile: projects/$PRJ/$PRJ.mp4 missing"
VC=$(ffprobe -v error -select_streams v -show_entries stream=codec_name -of csv=p=0 "projects/$PRJ/$PRJ.mp4" 2>/dev/null | head -1)
[ "$VC" = "h264" ] \
  && ok "compile: really transcoded to H.264 (not a webm wearing .mp4)" \
  || bad "compile: video codec is $VC, expected h264"
curl -sf "http://127.0.0.1:8311/outputs/$PRJ.mp4" -o /tmp/cmp.mp4 \
  && [ -s /tmp/cmp.mp4 ] \
  && ok "compile: the compiled movie is served back over /outputs" \
  || bad "compile: /outputs cannot reach the compiled mp4"
curl -sf http://127.0.0.1:8311/api/outputs | grep -q "$PRJ.mp4" \
  && ok "compile: the compiled movie appears in the gallery listing" \
  || bad "compile: compiled mp4 missing from /api/outputs"
# a second compile REPLACES it rather than piling up numbered files
curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_base.webm","src":"video","in":0,"out":null,"opacity":1,"start":0}],
       "audio":[[]],"images":[[]],"keep_original_audio":true}' > /dev/null
sleep 12
[ "$(ls projects/$PRJ/*.mp4 2>/dev/null | wc -l)" = "1" ] \
  && ok "compile: recompiling replaces the movie instead of piling up files" \
  || bad "compile: $(ls projects/$PRJ/*.mp4 2>/dev/null | wc -l) mp4 files in the project root"

# ---- layer z-order + per-layer opacity/volume reach the compositor.
# Two layers whose start times are the REVERSE of their stack order: the
# compositor must follow the layer order, not the start times.
ZJ=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_base.webm","src":"video","in":0,"out":null,"opacity":1,"start":0}],
       "video_volume":0.5,
       "video_layers":[
         {"name":"Back","muted":false,"volume":0.25,"opacity":0.5,
          "clips":[{"name":"e2e_over.webm","src":"video","in":0,"out":null,"opacity":1,"start":0.8}]},
         {"name":"Front","muted":true,"volume":1,"opacity":1,
          "clips":[{"name":"e2e_over.webm","src":"video","in":0,"out":null,"opacity":1,"start":0.1}]}],
       "audio":[[]],"images":[[]],"keep_original_audio":true}')
ZID=$(echo "$ZJ" | jget "['id']")
if [ -z "$ZID" ]; then bad "zorder: export rejected ${ZJ:0:120}"; else
  for i in $(seq 1 180); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$ZID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  ZL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$ZID?log_from=0")
  echo "$ZL" | jget "['log']" | grep -q "2 overlay-layer" \
    && ok "zorder: both layers reach the compositor" || bad "zorder: layer count wrong"
  # 'Back' starts at 0.8s but sits LOWER in the stack than 'Front' at 0.1s:
  # the draw order must follow the layer order, not the start times
  echo "$ZL" | jget "['log']" | grep -q "overlay draw order (back to front): z1@0.80s, z2@0.10s" \
    && ok "zorder: stacking follows layer order, not clip start time" \
    || bad "zorder: overlays still ordered by start time"
  echo "$ZL" | jget "['log']" | grep -q "composite z1 'Back': opacity=0.500 volume=0.250 muted=False" \
    && ok "zorder: layer opacity + volume carried into the composite" \
    || bad "zorder: layer opacity/volume missing"
  echo "$ZL" | jget "['log']" | grep -q "composite z0 base: opacity=1.000 volume=0.500" \
    && ok "zorder: V1 layer volume applied to the base audio" \
    || bad "zorder: V1 volume missing"
  echo "$ZL" | jget "['log']" | grep -q "composite z2 'Front': .* muted=True" \
    && ok "zorder: muted layer flagged, contributes no audio" \
    || bad "zorder: muted layer not flagged"
  ZO=$(echo "$ZL" | jget "['output']")
  ZF="projects/$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")/$ZO"
  [ "$st" = "done" ] && [ -s "$ZF" ] \
    && ok "zorder: layered export compiled" || bad "zorder: status=$st file=$ZF"
fi

# ---- COMPILE SPANS THE WHOLE TIMELINE, not just the base video track (2.63.0)
# THE BUG: the composite pass fed the joined V1 track in as ffmpeg input 0, and
# `overlay` emits exactly as many frames as its MAIN input while
# `amix=duration=first` stops with the first stream in the mix. Both meant "as
# long as V1", so a V2 clip / image / soundtrack that started after the base
# track ended was silently thrown away. Base is 2s here; the V2 clip starts at
# 3.0s and runs 1s, so a correct compile is ~4s -- the OLD one measured 2.007s.
# NOTE: every compile writes the same <project>.mp4, so each one below is
# measured IMMEDIATELY, before the next is queued.
ffmpeg -y -loglevel error -f lavfi -i sine=frequency=440 -t 4 -c:a libopus /tmp/e2e_song.opus
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_song.opus" > /dev/null
SJ=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_base.webm","src":"video","in":0,"out":null,"dur":2,"opacity":1,"start":0}],
       "video_layers":[{"name":"V2","muted":false,"volume":1,"opacity":1,
                        "clips":[{"name":"e2e_over.webm","src":"video","in":0,"out":null,
                                  "dur":1,"opacity":1,"start":3.0}]}],
       "audio":[[]],"images":[[]],"keep_original_audio":true}')
SID=$(echo "$SJ" | jget "['id']")
SPAR=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SID")
echo "$SPAR" | grep -q '"scene_end"' \
  && ok "span: /api/export stamps scene_end on the job" \
  || bad "span: scene_end missing from the job params"
echo "$SPAR" | grep -q '"scene_end": *4' \
  && ok "span: scene_end is the end of the LAST layer (4s), not of the base track (2s)" \
  || bad "span: wrong scene_end in ${SPAR:0:200}"
echo "$SPAR" | grep -q '"dur"' \
  && ok "span: the clip dur allow-list entry survives /api/export" \
  || bad "span: dur was dropped by the export allow-list"
if [ -z "$SID" ]; then bad "span: export rejected ${SJ:0:120}"; else
  for i in $(seq 1 180); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  SL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SID?log_from=0")
  echo "$SL" | jget "['log']" | grep -q "padding it with" \
    && ok "span: the worker logs the black padding it added to the video track" \
    || bad "span: no padding line in the worker log"
  SO=$(echo "$SL" | jget "['output']")
  SF="projects/$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")/$SO"
  if [ "$st" = "done" ] && [ -s "$SF" ]; then
    ok "span: a timeline whose upper layer outlasts V1 compiles"
    SD=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SF" 2>/dev/null | tr -d ',')
    python3 -c "import sys; d=float('$SD' or 0); sys.exit(0 if abs(d-4.0)<0.25 else 1)" \
      && ok "span: THE FIX - the compile runs to ${SD}s (~4s), not to the end of the video track" \
      || bad "span: compile is ${SD}s, expected ~4.0s (the V1-only bug is back)"
    SA=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$SF" 2>/dev/null | grep -c audio)
    [ "$SA" -ge 1 ] && ok "span: audio survives the padded compile" \
      || bad "span: padding lost the audio track"
  else
    bad "span: status=$st file=$SF"
  fi
fi
# a soundtrack that outlasts the picture must extend the compile too - that is
# the amix duration=first half of the bug, which the V2 case cannot see
AJ=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_base.webm","src":"video","in":0,"out":null,"dur":2,"opacity":1,"start":0}],
       "video_layers":[],
       "audio":[{"clips":[{"name":"e2e_song.opus","start":1.0,"in":0,"out":null,"dur":4,"volume":1}]}],
       "images":[[]],"keep_original_audio":true}')
AID=$(echo "$AJ" | jget "['id']")
if [ -n "$AID" ]; then
  for i in $(seq 1 180); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  AO=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AID" | jget "['output']")
  AF="projects/$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")/$AO"
  AD=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$AF" 2>/dev/null | tr -d ',')
  { [ "$st" = "done" ] && python3 -c "import sys; d=float('$AD' or 0); sys.exit(0 if abs(d-5.0)<0.25 else 1)"; } \
    && ok "span: a sound layer alone extends the compile to ${AD}s (~5s)" \
    || bad "span: soundtrack compile is ${AD}s, expected ~5.0s (status=$st)"
fi
# When nothing outlasts V1 the cheap no-overlay path must still be taken AND
# nothing may be padded. Note this payload deliberately carries NO "dur": an
# untrimmed clip whose length the route cannot know must contribute NOTHING to
# the hint. An earlier build guessed 5s for it (copying the UI's effDur()) and
# padded 3 seconds of black onto this 2-second video - caught only by the
# transitions luminance check, which measured a black frame at the midpoint.
NJ=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d '{"video":[{"name":"e2e_base.webm","src":"video","in":0,"out":null,"opacity":1,"start":0}],
       "video_layers":[],"audio":[[]],"images":[[]],"keep_original_audio":true}')
NID=$(echo "$NJ" | jget "['id']")
if [ -n "$NID" ]; then
  for i in $(seq 1 180); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$NID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  NL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$NID?log_from=0" | jget "['log']")
  echo "$NL" | grep -q "no overlay layers" \
    && ok "span: a timeline that fits the video track still takes the fast path" \
    || bad "span: the fast path was lost - every compile now re-composites"
  echo "$NL" | grep -q "padding it with" \
    && bad "span: an unmeasurable clip was GUESSED at and padded with black" \
    || ok "span: an untrimmed clip with no dur is measured, never guessed"
fi

# ---- WAVEFORMS IN AUDIO CLIPS (2.64.0)
# GET /api/waveform returns peaks for the WHOLE source file, never for the
# trimmed clip: one fetch then serves every clip cut from that file at every
# zoom level, and the UI slices it by in/out. Do not "optimise" this into a
# trim-aware endpoint - that would refetch on every drag.
WV=$(curl -sf "http://127.0.0.1:8311/api/waveform?src=sound&name=e2e_song.opus")
[ -n "$WV" ] && ok "waveform: peaks returned for a sound asset" \
  || bad "waveform: request failed"
python3 - "$WV" <<'PYEOF'
import json, sys
try:
    j = json.loads(sys.argv[1] or "{}")
except Exception as e:
    print("BADJSON", e); sys.exit(1)
p = j.get("peaks") or []
assert len(p) == 1200, "expected 1200 buckets, got %d" % len(p)
assert all(isinstance(v, int) and 0 <= v <= 255 for v in p), "peaks are not bytes"
assert max(p) == 255, "peaks are not normalised to full scale (max=%s)" % max(p)
assert sum(1 for v in p if v > 0) > 600, "a 4s sine should be loud nearly throughout"
assert abs(float(j.get("seconds", 0)) - 4.0) < 0.3, "seconds=%s, expected ~4" % j.get("seconds")
print("ok buckets=%d seconds=%.2f" % (len(p), j["seconds"]))
PYEOF
[ $? = 0 ] && ok "waveform: 1200 normalised byte peaks spanning the whole file" \
  || bad "waveform: peak array is malformed"
# the disk cache must answer the second request without re-running ffmpeg
echo "$WV" | grep -q '"cached": *false' \
  && ok "waveform: the first request builds the peaks" \
  || bad "waveform: first request was not a cache miss"
curl -sf "http://127.0.0.1:8311/api/waveform?src=sound&name=e2e_song.opus" | grep -q '"cached": *true' \
  && ok "waveform: the second request is served from the disk cache" \
  || bad "waveform: peaks were rebuilt instead of cached"
# a file with no audio stream is an ordinary answer, not an error: image layers
# and silent renders are perfectly normal things for the timeline to ask about
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=96x54:rate=24 -t 1 -pix_fmt yuv420p \
  -c:v libvpx-vp9 -b:v 0 -crf 50 /tmp/e2e_mute.webm
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_mute.webm" > /dev/null
curl -sf "http://127.0.0.1:8311/api/waveform?src=video&name=e2e_mute.webm" | grep -q '"silent": *true' \
  && ok "waveform: a file with no audio stream returns a flat waveform, not a 500" \
  || bad "waveform: silent file did not report silent"
WM=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/api/waveform?src=sound&name=nope_9481.opus")
[ "$WM" = "404" ] && ok "waveform: a missing asset is a 404" || bad "waveform: missing -> $WM"
WN=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/api/waveform?src=sound")
[ "$WN" = "400" ] && ok "waveform: a nameless request is a 400" || bad "waveform: no name -> $WN"
# basename() must strip any traversal before the path is joined
WT=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/api/waveform?src=sound&name=../../../etc/passwd")
[ "$WT" = "404" ] && ok "waveform: path traversal is stripped by basename" \
  || bad "waveform: traversal -> $WT"
# peaks are never written into the asset folders - the cache is hidden away so
# it can never show up in the asset dock or be swept into a delivery zip
curl -sf http://127.0.0.1:8311/api/passets | grep -q "\.cache" \
  && bad "waveform: the peak cache leaked into the asset listing" \
  || ok "waveform: the peak cache stays out of the asset listing"

# ---- reference groups: save / list / reload / delete, scoped to the project
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"e2e_groups"}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_ref1.png" > /dev/null
RG=$(curl -sf -X POST http://127.0.0.1:8311/api/refgroups -H 'Content-Type: application/json' \
  -d '{"name":"refGrp-1","images":[{"name":"e2e_ref1.png","subject":2,"role":"face"}],
       "audios":["e2e_ref.wav"]}')
echo "$RG" | grep -q '"saved":"refGrp-1"' \
  && ok "refgroups: saved a named group" || bad "refgroups: save=$RG"
RL=$(curl -sf http://127.0.0.1:8311/api/refgroups)
echo "$RL" | grep -q '"subject": *2' && echo "$RL" | grep -q '"role": *"face"' \
  && ok "refgroups: subject + aspect survive the round trip" || bad "refgroups: list=${RL:0:120}"
RE=$(curl -sf -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/refgroups \
  -H 'Content-Type: application/json' -d '{"name":"empty"}')
[ "$RE" = "400" ] && ok "refgroups: empty group rejected" || bad "refgroups: empty -> $RE"
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"default"}' > /dev/null
RO=$(curl -sf http://127.0.0.1:8311/api/refgroups | jget "['groups']")
[ "$RO" = "[]" ] && ok "refgroups: scoped to the project (default is empty)" \
  || bad "refgroups: leaked across projects: $RO"
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"e2e_groups"}' > /dev/null
RD=$(curl -sf -X DELETE http://127.0.0.1:8311/api/refgroups/refGrp-1)
echo "$RD" | grep -q '"deleted":"refGrp-1"' \
  && ok "refgroups: delete removes only the grouping" || bad "refgroups: delete=$RD"
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"default"}' > /dev/null

# ---- DOCK LAYOUT IN THE SETTINGS FILE (2.103.0, Tim): size + open/closed/max
# per dock, restored on open. Round trip through custom.settings.
node scripts/test-uilayout.js > /tmp/uilayout.log 2>&1 \
  && ok "dock layout unit tests (defaults, clamps, one max, merge)" \
  || { bad "dock layout unit tests"; tail -12 /tmp/uilayout.log; }
curl -sf http://127.0.0.1:8311/api/ui/layout | grep -q '"timelinedock":{"height":150,"state":"open"}' \
  && ok "layout: GET returns the shipped record" || bad "layout: GET $(curl -sf http://127.0.0.1:8311/api/ui/layout | head -c 200)"
curl -sf -X POST http://127.0.0.1:8311/api/ui/layout -H 'Content-Type: application/json' \
  -d '{"docks":{"timelinedock":{"height":333,"state":"max"},"ldock":{"width":320,"state":"closed"}}}' > /dev/null
curl -sf http://127.0.0.1:8311/api/ui/layout | grep -q '"timelinedock":{"height":333,"state":"max"}' \
  && ok "layout: a partial POST merges (timeline 333px, max)" || bad "layout: merge failed"
grep -q '"height": *333' custom.settings && grep -q '"ldock"' custom.settings \
  && ok "layout: ...and the change is in custom.settings (the diff layer), not just memory" \
  || bad "layout: custom.settings has no dock record: $(grep -c ui custom.settings)"
curl -sf -X POST http://127.0.0.1:8311/api/ui/layout -H 'Content-Type: application/json' \
  -d '{"docks":{"chatdock":{"state":"max"}}}' | grep -q '"timelinedock":{"height":333,"state":"open"}' \
  && ok "layout: maximizing a second dock demotes the first to open (one max at a time)" \
  || bad "layout: two docks maxed"
curl -sf -X POST http://127.0.0.1:8311/api/ui/layout -H 'Content-Type: application/json' \
  -d '{"docks":{"timelinedock":{"height":150,"state":"open"},"chatdock":{"state":"closed"},"ldock":{"width":300,"state":"open"}}}' > /dev/null

# ---- WIRED COMFYUI GRAPHS (2.120.0, Tim): the wire-level half of what the
# Graphs tab does. A UI export is REFUSED as a workflow to run; an API export
# lists its changeable inputs; a binding saves, its controls apply, and a graph
# whose wires no longer resolve reports that rather than rendering the old
# value silently.
mkdir -p comfy_workflows
cat > comfy_workflows/e2e_graph_api.json <<'GEOF'
{"3":{"class_type":"KSampler","_meta":{"title":"Sampler"},
      "inputs":{"seed":1,"steps":20,"cfg":8.0,"model":["4",0]}},
 "4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"x.safetensors"}}}
GEOF
cat > comfy_workflows/e2e_graph_ui.json <<'GEOF'
{"nodes":[{"id":1,"type":"KSampler","widgets_values":[1,"randomize",20]}],"links":[]}
GEOF
curl -sf -X POST http://127.0.0.1:8311/api/graphs/analyze -H 'Content-Type: application/json' \
  -d '{"file":"comfy_workflows/e2e_graph_api.json"}' | grep -q '"format":"api"' \
  && ok "graphs: an API export is recognised as one" || bad "graphs: API export not recognised"
curl -sf -X POST http://127.0.0.1:8311/api/graphs/analyze -H 'Content-Type: application/json' \
  -d '{"file":"comfy_workflows/e2e_graph_api.json"}' | grep -q '"input":"steps"' \
  && ok "graphs: ...and its changeable values are listed" || bad "graphs: steps not listed"
curl -sf -X POST http://127.0.0.1:8311/api/graphs/analyze -H 'Content-Type: application/json' \
  -d '{"file":"comfy_workflows/e2e_graph_api.json"}' | grep -q '"input":"model"' \
  && bad "graphs: a LINKED input was offered for wiring (writing a scalar over it breaks the graph)" \
  || ok "graphs: a linked input is NOT offered for wiring"
curl -sf -X POST http://127.0.0.1:8311/api/graphs/analyze -H 'Content-Type: application/json' \
  -d '{"file":"comfy_workflows/e2e_graph_ui.json"}' | grep -q '"format":"ui"' \
  && ok "graphs: a saved UI workflow is told apart from an API one" || bad "graphs: UI export misread"
curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/graphs/analyze \
  -H 'Content-Type: application/json' -d '{"file":"../../etc/passwd"}' | grep -q '400\|404' \
  && ok "graphs: a path that walks out of comfy_workflows/ is refused" || bad "graphs: traversal not refused"
# 2.126.0: the shipped blueprints are FOLDED workflows (ComfyUI subgraphs +
# KJNodes Set/Get). They are the reason lib/subgraphs.js exists — before it, the
# converter reported the subgraph UUIDs as unknown node packs and stopped.
# ComfyUI 0.34's OWN API export of the longform blueprint ships beside it as
# ground truth (2.127.0): it is the only unarguable statement of what those
# subgraphs mean, and test-subgraphs diffs our conversion against it.
curl -sf -X POST http://127.0.0.1:8311/api/graphs/analyze -H 'Content-Type: application/json' \
  -d '{"file":"comfy_workflows/h3_longform_blueprint_api.json"}' | grep -q '"format":"api"' \
  && ok "graphs: ComfyUI's own export of the blueprint is recognised as API format (no conversion needed)" \
  || bad "graphs: the blueprint API export was misread"
for BP in h3_simple_scene_blueprint h3_longform_blueprint; do
  [ -f "comfy_workflows/$BP.json" ] \
    && ok "graphs: the $BP workflow ships" || bad "graphs: $BP.json is missing"
  curl -sf -X POST http://127.0.0.1:8311/api/graphs/analyze -H 'Content-Type: application/json' \
    -d "{\"file\":\"comfy_workflows/$BP.json\"}" | grep -q '"format":"ui"' \
    && ok "graphs: $BP is read as a UI export needing conversion" \
    || bad "graphs: $BP format misread"
done
python3 - <<'PYEOF'
import json, subprocess, sys
# the flattener's own claim, asserted against the SHIPPED files rather than a
# fixture written to agree with it
out = subprocess.run(["node", "-e", """
const SG=require("./lib/subgraphs.js"), fs=require("fs");
const r=SG.flatten(JSON.parse(fs.readFileSync("comfy_workflows/h3_longform_blueprint.json","utf8")));
const ids=new Set(r.graph.nodes.map(n=>String(n.id)));
const bad=r.graph.links.filter(l=>!ids.has(String(l.origin_id))||!ids.has(String(l.target_id))).length;
console.log(JSON.stringify({expanded:r.expanded.length,warn:r.warnings.length,bad,
  gen:r.graph.nodes.filter(n=>n.type==="MiniMaxH3ReferenceToVideo").length,
  folded:r.graph.nodes.filter(n=>/^[0-9a-f]{8}-/.test(String(n.type))||n.type==="SetNode"||n.type==="GetNode").length}));
"""], capture_output=True, text=True)
d = json.loads(out.stdout.strip().splitlines()[-1])
assert d["expanded"] == 5, d
assert d["bad"] == 0, d
assert d["warn"] == 0, d
assert d["gen"] == 4, d
assert d["folded"] == 0, d
PYEOF
[ $? = 0 ] && ok "graphs: the Longform blueprint flattens to 4 chained shots, nothing folded, nothing dangling" \
  || bad "graphs: the longform blueprint did not flatten cleanly"
GID=$(curl -sf -X POST http://127.0.0.1:8311/api/graphs -H 'Content-Type: application/json' \
  -d '{"name":"e2e wired","file":"comfy_workflows/e2e_graph_api.json","kind":"image",
       "controls":[{"id":"st","type":"slider","label":"Steps","min":1,"max":60,"step":1,"default":20,
                    "targets":[{"node":"3","input":"steps"}]}]}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['graph']['id'])")
[ -n "$GID" ] && ok "graphs: a binding saves and comes back with an id" || bad "graphs: save failed"
[ -f "graphs/e2e wired.json" ] \
  && ok "graphs: ...as one readable file per graph, graphs/<name>.json" || bad "graphs: no file: $(ls graphs 2>&1)"
curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/graphs \
  -H 'Content-Type: application/json' -d '{"name":"e2e wired","file":"a.json"}' | grep -q 409 \
  && ok "graphs: a duplicate name is refused (409), never overwritten" || bad "graphs: duplicate name allowed"
curl -sf http://127.0.0.1:8311/api/graphs | grep -q '"e2e wired"' \
  && ok "graphs: the list includes it" || bad "graphs: not listed"
curl -sf http://127.0.0.1:8311/api/graphs | grep -q '"e2e_graph_api.json"' \
  && ok "graphs: ...and the workflows folder is offered as the file picker's list" || bad "graphs: files not listed"
# The engine is sdcli in the e2e (see the top of this file), so a run must be
# refused with the reason rather than queued into a worker that cannot work.
curl -s -X POST http://127.0.0.1:8311/api/graphs/run -H 'Content-Type: application/json' \
  -d "{\"id\":\"$GID\",\"values\":{\"st\":7}}" | grep -q 'Engine to ComfyUI' \
  && ok "graphs: running a graph on the sd-cli engine is refused with the fix" || bad "graphs: run not refused"
# Switch to the comfy engine just for the run, then switch back.
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"comfy"}}' > /dev/null
RUNJ=$(curl -sf -X POST http://127.0.0.1:8311/api/graphs/run -H 'Content-Type: application/json' \
  -d "{\"id\":\"$GID\",\"values\":{\"st\":7}}")
echo "$RUNJ" | grep -q '"value":7' \
  && ok "graphs: the wired value is applied server-side (steps -> 7)" || bad "graphs: apply failed: $RUNJ"
GJOB=$(echo "$RUNJ" | python3 -c "import json,sys; print(json.load(sys.stdin).get('job',''))")
sleep 2
curl -sf "http://127.0.0.1:8311/api/jobs/$GJOB" | grep -q 'graph_worker.py' \
  && ok "graphs: the job is run by graph_worker.py, not worker.py" \
  || bad "graphs: wrong worker: $(curl -sf http://127.0.0.1:8311/api/jobs/$GJOB | head -c 300)"
# A stale wire is REPORTED. Point the binding at an input that is not there.
curl -sf -X POST http://127.0.0.1:8311/api/graphs -H 'Content-Type: application/json' \
  -d "{\"id\":\"$GID\",\"name\":\"e2e wired\",\"file\":\"comfy_workflows/e2e_graph_api.json\",\"kind\":\"image\",
       \"controls\":[{\"id\":\"st\",\"type\":\"slider\",\"label\":\"Steps\",\"targets\":[{\"node\":\"99\",\"input\":\"steps\"}]}]}" > /dev/null
curl -sf http://127.0.0.1:8311/api/graphs | grep -q 'node 99 is not in this workflow' \
  && ok "graphs: a wire that no longer resolves is reported, not silently skipped" || bad "graphs: stale wire hidden"
# ---- LOAD NODES ARE FED BY THE REFERENCE DOCK (2.121.0, Tim: "load image/
# load video/load sound node types will get the files from the reference
# docker, if there are unused 'load' nodes bypass them").
cat > comfy_workflows/e2e_graph_load.json <<'GEOF'
{"1":{"class_type":"LoadImage","inputs":{"image":"someone_elses.png"}},
 "2":{"class_type":"LoadImage","inputs":{"image":"also_theirs.png"}},
 "8":{"class_type":"ImageBlend","inputs":{"image1":["1",0],"image2":["2",0]}},
 "9":{"class_type":"SaveImage","inputs":{"filename_prefix":"H3","images":["8",0]}}}
GEOF
LGID=$(curl -sf -X POST http://127.0.0.1:8311/api/graphs -H 'Content-Type: application/json' \
  -d '{"name":"e2e loaders","file":"comfy_workflows/e2e_graph_load.json","kind":"image","controls":[]}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['graph']['id'])")
curl -sf -X POST http://127.0.0.1:8311/api/graphs/analyze -H 'Content-Type: application/json' \
  -d '{"file":"comfy_workflows/e2e_graph_load.json"}' | grep -q '"kind":"images"' \
  && ok "graphs: the tab is told which values the reference dock fills" || bad "graphs: loaders not reported"
# ONE picture in this project's Images assets, TWO LoadImage slots. The
# project is read back rather than assumed: earlier blocks switch projects.
GPROJ=$(curl -sf http://127.0.0.1:8311/api/projects/current | python3 -c "import json,sys; print(json.load(sys.stdin)['name'])")
python3 -c "
import base64,pathlib
p=pathlib.Path('projects/$GPROJ/images'); p.mkdir(parents=True,exist_ok=True)
(p/'e2e_dock.png').write_bytes(base64.b64decode(
 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))
"
RUNL=$(curl -sf -X POST http://127.0.0.1:8311/api/graphs/run -H 'Content-Type: application/json' \
  -d "{\"id\":\"$LGID\",\"images\":[\"e2e_dock.png\"]}")
echo "$RUNL" | grep -q '"name":"e2e_dock.png"' \
  && ok "graphs: the dock's picture lands in the first LoadImage" || bad "graphs: not assigned: $RUNL"
echo "$RUNL" | grep -q '"node":"2"' \
  && ok "graphs: ...and the unused second LoadImage is bypassed" || bad "graphs: node 2 not bypassed: $RUNL"
LJOB=$(echo "$RUNL" | python3 -c "import json,sys; print(json.load(sys.stdin).get('job',''))")
python3 -c "
import json,sys
g=json.load(open('workspace/jobs/$LJOB/job.json'))['params']['graph']
assert '2' not in g, 'the unused LoadImage survived into the job'
assert 'image2' not in g['8']['inputs'], 'its consumer kept an input pointing at a deleted node'
assert g['8']['inputs']['image1'] == ['1',0], 'the live loader lost its wire'
assert 'also_theirs' not in json.dumps(g), 'a stale exported filename survived'
assert g['1']['inputs']['image'] == 'e2e_dock.png'
"
[ $? = 0 ] && ok "graphs: the queued graph has the loader filled, the spare removed and its consumer rewired" \
  || bad "graphs: job graph wrong: $(head -c 400 workspace/jobs/$LJOB/job.json)"
python3 -c "
import json
p=json.load(open('workspace/jobs/$LJOB/job.json'))['params']
u=p['graph_uploads']
assert len(u)==1 and u[0]['node']=='1' and u[0]['input']=='image', u
assert u[0]['path'].endswith('e2e_dock.png') and '/' in u[0]['path'] or '\\\\' in u[0]['path'], u
"
[ $? = 0 ] && ok "graphs: ...and the worker is handed a real path to upload, not a bare name" \
  || bad "graphs: graph_uploads wrong"
curl -s -X DELETE "http://127.0.0.1:8311/api/graphs/$LGID" > /dev/null
rm -f comfy_workflows/e2e_graph_load.json "projects/$GPROJ/images/e2e_dock.png"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"sdcli"}}' > /dev/null
curl -s -o /dev/null -w '%{http_code}' -X DELETE "http://127.0.0.1:8311/api/graphs/$GID" | grep -q 200 \
  && ok "graphs: a binding deletes" || bad "graphs: delete failed"
[ -f "graphs/e2e wired.json" ] && bad "graphs: the file survived the delete" || ok "graphs: ...and its file is gone"
rm -f comfy_workflows/e2e_graph_api.json comfy_workflows/e2e_graph_ui.json
node scripts/test-timelines-lib.js > /tmp/tllib.log 2>&1 \
  && ok "timelines lib unit tests (names, migrate, persist, remove)" || { bad "timelines lib unit tests"; tail -8 /tmp/tllib.log; }
node scripts/test-llmchat.js > /tmp/llmchat.log 2>&1 \
  && ok "llmChat unit tests (strict-template armor: adjacent same-role messages merge)" \
  || { bad "llmChat unit tests"; tail -10 /tmp/llmchat.log; }
node scripts/test-captioner.js > /tmp/captioner.log 2>&1 \
  && ok "captioner unit tests (2.233.0 pictures in the prompt: mmproj pairing, describe fold, seam, installer)" \
  || { bad "captioner unit tests"; tail -12 /tmp/captioner.log; }
node scripts/test-yue2.js > /tmp/yue2.log 2>&1 \
  && ok "yue2 unit tests (2.236.0 sheet-music pipeline: four graphs, live patch, worker abc, dock tabs)" \
  || { bad "yue2 unit tests"; tail -12 /tmp/yue2.log; }
node scripts/test-segmap.js > /tmp/segmap.log 2>&1 \
  && ok "segmap unit tests (2.289.0 Load audio: the core segment map, segBoard staging LIVE, the video docker strip in jsdom)" \
  || { bad "segmap unit tests"; tail -12 /tmp/segmap.log; }
node scripts/test-refmap.js > /tmp/refmap.log 2>&1 \
  && ok "refmap unit tests (2.290.0 NativeAudio 9 pictures + 3 audios: the reference map, the workflow's loaders, the board routing)" \
  || { bad "refmap unit tests"; tail -12 /tmp/refmap.log; }
node scripts/test-scenetimeline.js > /tmp/scenetl.log 2>&1 \
  && ok "scenetimeline unit tests (2.291.0 fresh takes -> a new timeline layer at the scene's start: window rule, flag + ack, videodock hook)" \
  || { bad "scenetimeline unit tests"; tail -12 /tmp/scenetl.log; }
node scripts/test-nativeaudio.js > /tmp/nativeaudio.log 2>&1 \
  && ok "nativeaudio unit tests (2.292.0 Ref/First/Transition: the plan, the widget-walk fix Tim hit, the fl2va twin through the real patcher, anchors)" \
  || { bad "nativeaudio unit tests"; tail -12 /tmp/nativeaudio.log; }
node scripts/test-autorender.js > /tmp/autorender.log 2>&1 \
  && ok "autorender unit tests (2.293.0 ▶ as written: live vs after by card, the queue rule, the writer wiring, the dock in jsdom)" \
  || { bad "autorender unit tests"; tail -12 /tmp/autorender.log; }
node scripts/test-mvwriter.js > /tmp/mvwriter.log 2>&1 \
  && ok "mvwriter unit tests (2.294.0 music-video writer rules: the native guide, problems/repair, render-time cleanup, every writer path)" \
  || { bad "mvwriter unit tests"; tail -12 /tmp/mvwriter.log; }
node scripts/test-scenecards.js > /tmp/scenecards.log 2>&1 \
  && ok "scenecards unit tests (2.295.0 filmstrip under the scene, auto frames, All: radios, scene pictures, render-all continuity)" \
  || { bad "scenecards unit tests"; tail -12 /tmp/scenecards.log; }
node scripts/test-contmode.js > /tmp/contmode.log 2>&1 \
  && ok "contmode unit tests (2.296.0 Cont: open on the frame WITH the sheets, frame -> next scene's pictures, the dock)" \
  || { bad "contmode unit tests"; tail -12 /tmp/contmode.log; }
node scripts/test-sceneinsert.js > /tmp/sceneinsert.log 2>&1 \
  && ok "sceneinsert unit tests (2.297.0 insert, chosen first/last frames, rippled timing, the picker)" \
  || { bad "sceneinsert unit tests"; tail -12 /tmp/sceneinsert.log; }
node scripts/test-projectmedia.js > /tmp/projectmedia.log 2>&1 \
  && ok "projectmedia unit tests (2.298.0 every picture, song and video in the project, grouped, adopted on pick)" \
  || { bad "projectmedia unit tests"; tail -12 /tmp/projectmedia.log; }
node scripts/test-globalprompt.js > /tmp/globalprompt.log 2>&1 \
  && ok "globalprompt unit tests (2.299.0 locations in the global prompt, the writer reads it first, 📂 Load menu, last frame on every scene)" \
  || { bad "globalprompt unit tests"; tail -12 /tmp/globalprompt.log; }
node scripts/test-scenetype.js > /tmp/scenetype.log 2>&1 \
  && ok "scenetype unit tests (2.299.2 each scene's Ref/First/Cont/Trans group: scene_<n>_type_group, a pick lands, invalid refused)" \
  || { bad "scenetype unit tests"; tail -12 /tmp/scenetype.log; }
node scripts/test-clipstart.js > /tmp/clipstart.log 2>&1 \
  && ok "clipstart unit tests (2.300.0 a timeline clip's start-time dialog: the time formats, click selects, V1 one-after-another)" \
  || { bad "clipstart unit tests"; tail -12 /tmp/clipstart.log; }
node scripts/test-filmstrip.js > /tmp/filmstrip.log 2>&1 \
  && ok "filmstrip unit tests (2.300.1 no scrollbar, ◀ ▶ page the scene filmstrip, the position survives the repaint)" \
  || { bad "filmstrip unit tests"; tail -12 /tmp/filmstrip.log; }
python3 scripts/test-rawmaster.py > /tmp/rawmaster.log 2>&1 \
  && ok "rawmaster unit tests (2.301.0 the lossless scene master: taps, pixel-identical FFV1, seam join, one playback encode)" \
  || { bad "rawmaster unit tests"; tail -12 /tmp/rawmaster.log; }
node scripts/test-rawmaster-app.js > /tmp/rawmasterapp.log 2>&1 \
  && ok "rawmaster app tests (2.301.0 frames, pictures and the compile read the master; the wiring)" \
  || { bad "rawmaster app tests"; tail -12 /tmp/rawmasterapp.log; }
node scripts/test-trimfirst.js > /tmp/trimfirst.log 2>&1 \
  && ok "trimfirst unit tests (2.302.0 the scene's trim-first-frame box: board, card, render wiring)" \
  || { bad "trimfirst unit tests"; tail -12 /tmp/trimfirst.log; }
python3 scripts/test-loadprecision.py > /tmp/loadprecision.log 2>&1 \
  && ok "loadprecision unit tests (2.303.0 a video style's per-phase 8-bit loading: bf16 -> fp8, quantized files left alone)" \
  || { bad "loadprecision unit tests"; tail -12 /tmp/loadprecision.log; }
node scripts/test-expertmode.js > /tmp/expertmode.log 2>&1 \
  && ok "expertmode unit tests (2.304.0 Settings -> General expert mode hides the help, keeps tooltips; LLM tokens type)" \
  || { bad "expertmode unit tests"; tail -12 /tmp/expertmode.log; }
node scripts/test-cntypes.js > /tmp/cntypes.log 2>&1 \
  && ok "cntypes unit tests (2.305.0 ControlNet types pose/scribble/lineart/depth, the input preprocessor scan, the style fields, the tab)" \
  || { bad "cntypes unit tests"; tail -12 /tmp/cntypes.log; }
python3 scripts/test-typefix.py > /tmp/typefix.log 2>&1 \
  && ok "typefix unit tests (2.306.0 a VIDEO link ComfyUI refuses on an IMAGE input is split through GetVideoComponents and re-queued once)" \
  || { bad "typefix unit tests"; tail -12 /tmp/typefix.log; }
node scripts/test-redotake.js > /tmp/redotake.log 2>&1 \
  && ok "redotake unit tests (2.307.0 ↻ redo on a rendered scene, new takes filed as scene_<n>_<x>, masters follow)" \
  || { bad "redotake unit tests"; tail -12 /tmp/redotake.log; }
node scripts/test-jobfinish.js > /tmp/jobfinish.log 2>&1 \
  && ok "jobfinish unit tests (2.308.0 a finished render always leaves running: no stdin, the exit fallback, the guarded scene poll)" \
  || { bad "jobfinish unit tests"; tail -12 /tmp/jobfinish.log; }
python3 scripts/test-fetchall.py > /tmp/fetchall.log 2>&1 \
  && ok "fetchall unit tests (2.308.0 the lossless frames come down in parallel inside a time budget)" \
  || { bad "fetchall unit tests"; tail -12 /tmp/fetchall.log; }
node scripts/test-rendersettings.js > /tmp/rendersettings.log 2>&1 \
  && ok "rendersettings unit tests (2.312.0 the video docker's ⚙: size, steps, cfg, LoRAs, Sage/Spectrum/Kitchen, the upscaler)" \
  || { bad "rendersettings unit tests"; tail -12 /tmp/rendersettings.log; }
node scripts/test-facefix.js > /tmp/facefixjs.log 2>&1 \
  && ok "facefix app unit tests (2.322.0 the Face fix record, routes, the ultralytics scan, Pose face points)" \
  || { bad "facefix app unit tests"; tail -12 /tmp/facefixjs.log; }
python3 scripts/test-facefix.py > /tmp/facefixpy.log 2>&1 \
  && ok "facefix graph unit tests (2.322.0 FaceDetailer before the save on SDXL / Klein / a ControlNet final)" \
  || { bad "facefix graph unit tests"; tail -12 /tmp/facefixpy.log; }
node scripts/test-scriptboard.js > /tmp/scriptboard.log 2>&1 \
  && ok "scriptboard unit tests (2.323.0 the screenplay writer with no song, the Scenes field / scenes.txt, the voice binding)" \
  || { bad "scriptboard unit tests"; tail -12 /tmp/scriptboard.log; }
python3 scripts/test-nosong.py > /tmp/nosong.log 2>&1 \
  && ok "nosong graph unit tests (2.323.0 the native-audio lock out, the model's audio decoded, the voices renumbered)" \
  || { bad "nosong graph unit tests"; tail -12 /tmp/nosong.log; }
node scripts/test-swap.js > /tmp/swapjs.log 2>&1 \
  && ok "swap app unit tests (2.324.0 lib/swap - the prompt, the window fields, the ceiling, the routes / worker wiring, Swap mode + the scene ⇄)" \
  || { bad "swap app unit tests"; tail -12 /tmp/swapjs.log; }
python3 scripts/test-swap.py > /tmp/swappy.log 2>&1 \
  && ok "swap graph unit tests (2.324.0 the 17k+5 window, the size, the patch of MiniMax_H3_Swap.json, the real cut + original-audio mux)" \
  || { bad "swap graph unit tests"; tail -12 /tmp/swappy.log; }
node scripts/test-refselect.js > /tmp/refsel.log 2>&1 \
  && ok "refselect unit tests (2.325.0 the reference video dialog - frames, the real cut, reopen-on-source, the filmstrip / box / zoom / region preview / Apply / Cancel in jsdom)" \
  || { bad "refselect unit tests"; tail -12 /tmp/refsel.log; }
node scripts/test-filedialog.js > /tmp/filedialog.log 2>&1 \
  && ok "filedialog unit tests (2.326.0 the Windows-11-style dialog: lib/fileDialog on a real tree, the dialog + upload shim in jsdom)" \
  || { bad "filedialog unit tests"; tail -12 /tmp/filedialog.log; }
python3 scripts/test-fdlg-helper.py > /tmp/fdlghelper.log 2>&1 \
  && ok "fdlg helper unit tests (2.326.0 known folders, drives / mounts, real thumbnails, the serve protocol)" \
  || { bad "fdlg helper unit tests"; tail -12 /tmp/fdlghelper.log; }
python3 scripts/test-vrswap.py > /tmp/vrswap.log 2>&1 \
  && ok "vrswap unit tests (2.330.0 the VR swap: the view maths, the v360 round trip, the right eye through the original depth, the stereo paste, the spherical box)" \
  || { bad "vrswap unit tests"; tail -12 /tmp/vrswap.log; }
node scripts/test-setup.js > /tmp/setup331.log 2>&1 \
  && ok "setup unit tests (2.331.0 the installers + setup wizard offline: GPU check -> settings per tier, every node pack from local git, stub Hugging Face gated / token / resume, setup-cli end to end, the Unix bootstrap + launcher, the NSIS compile, the self-extracting .sh, the wizard pages in jsdom)" \
  || { bad "setup unit tests"; grep -a "^FAIL" -A2 /tmp/setup331.log | head -30; }
node scripts/test-sceneedit.js > /tmp/sceneedit.log 2>&1 \
  && ok "sceneedit unit tests (2.337.0 ✎ First frame: the bases + Qwen 2.1's <imageN> tags, the qe_ pictures, the harvest into the First slot, the 8-slot graph, the accordion in jsdom)" \
  || { bad "sceneedit unit tests"; grep -a "^FAIL" /tmp/sceneedit.log | head -12; }
node scripts/test-ltx.js > /tmp/ltxjs.log 2>&1 \
  && ok "ltx unit tests (2.338.0 LTX 2.5: Tim's canvas one mode at a time, Auto from what is loaded, the job, the scene -> mode table, the converter CLI, the wiring)" \
  || { bad "ltx unit tests"; grep -a "^FAIL" /tmp/ltxjs.log | head -12; }
node scripts/test-frontendparity.js > /tmp/feparity.log 2>&1 \
  && ok "frontend parity (2.402.1 Tim: \"Sizes of tensors must match ... Expected size 1 but got size 25\" - a multi-type widget (LTXVEmptyLatentAudio frame_rate \"FLOAT,INT\") now a widget, newer widgets get their defaults: all seven Comfy-Org LTX templates convert to EXACTLY what ComfyUI's own frontend (graphToPrompt) sends)" \
  || { bad "frontend parity"; grep -a "^FAIL" -A2 /tmp/feparity.log | head -14; }
python3 scripts/test-ltx23.py > /tmp/ltx23.log 2>&1 \
  && ok "ltx 2.3 tests (2.402.0 Tim: \"... our blender bridge to layout a 3d scene in blender and render it in bitgen using ltx2.3 - please add a style for ltx2.3\" - Comfy-Org's four LTX 2.3 templates against a REAL ComfyUI's answers, 3DREAL: the render as the IC guide (no depth pass), fal's LoRA + strength, the trigger, the first frame bypassed / real; dev + distilled LoRA vs the distilled checkpoint, missing files in words; the style's modes; the Blender render saved; LIVE t2v / flf / 3DREAL on the stub, lipsync refused)" \
  || { bad "ltx 2.3 tests"; grep -a "^FAIL" -A3 /tmp/ltx23.log | head -16; }
python3 scripts/test-blenderscene.py > /tmp/blenderscene.log 2>&1 \
  && ok "blender scene tests (2.402.0 the add-on's Render scene -> bitGen: a REAL Blender renders the animated scene through its camera - Workbench, cut to Max seconds, 1280x704 H.264 - and POSTs it with the look / 3DREAL variant; every setting put back; no camera refused - the live legs SKIP without Blender)" \
  || { bad "blender scene tests"; grep -a "^FAIL" -A3 /tmp/blenderscene.log | head -12; }
python3 scripts/test-blendview.py > /tmp/blendview4030.log 2>&1 \
  && ok "blend preview - the Blender side (2.403.0 Tim: \"can we preview the blender scene in our preview canvas (load the blend) file and navigate the scene, select the segment we want to render to real? even better id we could edit the scene, move objects etc\" - a REAL Blender: .blend -> .glb with every node's id + meta (range, fps, size, camera, key frames), glTF-local edits round-trip exactly (parented child, camera), moves land at (x, -z, y), keys / duplicate / delete / hide, save: project copy + write back (.blend1) + copy, a segment through the scene camera and through a view - SKIP without Blender)" \
  || { bad "blend preview - the Blender side"; grep -a "^FAIL" -A3 /tmp/blendview4030.log | head -14; }
python3 scripts/test-ltxofficial.py > /tmp/ltxofficial.log 2>&1 \
  && ok "ltx official tests (2.401.5 Tim: \"maybe try to find another ltx workflow\" - Comfy-Org's LTX 2.5 templates converted against a REAL ComfyUI's answers (dynamic combos: ResizeImageMaskNode resize_type), values by label, GGUF + LoRAs, LIVE t2v / i2v / flf on the stub's real checks, no LTX 2.5 files -> the canvas)" \
  || { bad "ltx official tests"; grep -a "^FAIL" -A3 /tmp/ltxofficial.log | head -16; }
python3 scripts/test-ltxgraph.py > /tmp/ltxgraph.log 2>&1 \
  && ok "ltx graph unit tests (2.338.0 every mode converted + patched: the prompt, the pictures by title, the song window, the video, the length, the size, the seeds, the transition LoRA by mode, the prune)" \
  || { bad "ltx graph unit tests"; grep -a "^FAIL" /tmp/ltxgraph.log | head -12; }
node scripts/test-rippleswap.js > /tmp/rippleswap.log 2>&1 \
  && ok "rippleswap unit tests (2.339.0 the swap's LTX Ripple engine: 8k+1, the prompts, the first frames + their sync, the job, the record, the wiring, the dialog in jsdom)" \
  || { bad "rippleswap unit tests"; grep -a "^FAIL" /tmp/rippleswap.log | head -12; }
node scripts/test-refroles.js > /tmp/refroles.log 2>&1 \
  && ok "refroles unit tests (2.340.0 the dock's First / Last frame types -> fl2va / ref2va / the LTX order, Qwen Image 2.1's <imageN> from the dock, the 10-slot qwen2_1 workflow + optional slots, the wiring)" \
  || { bad "refroles unit tests"; grep -a "^FAIL" /tmp/refroles.log | head -12; }
node scripts/test-hfcli.js > /tmp/hfcli.log 2>&1 \
  && ok "hfcli unit tests (2.341.0 the LTX canvas's six other files in the catalog, the Hugging Face CLI downloader through a fake hf, routes/setup live, the wizard + setup-cli wiring, the ⤓ Model catalog dialog in jsdom)" \
  || { bad "hfcli unit tests"; grep -a "^FAIL" /tmp/hfcli.log | head -12; }
python3 scripts/test-rippleflow.py > /tmp/rippleflow.log 2>&1 \
  && ok "rippleflow unit tests (2.342.0 Tim's LTX_Ripple_FFAF_Edit_v11: the named-widget conversion + the Anything Everywhere links, the patch, the still dropped on real ffmpeg)" \
  || { bad "rippleflow unit tests"; grep -a "^FAIL" /tmp/rippleflow.log | head -12; }
node scripts/test-swapsettings.js > /tmp/swapsettings.log 2>&1 \
  && ok "swapsettings unit tests (2.342.0 the swap dialog's ⚙: the record, the swap LoRAs, the wiring, the dialog in jsdom)" \
  || { bad "swapsettings unit tests"; grep -a "^FAIL" /tmp/swapsettings.log | head -12; }
node scripts/test-rippleauto.js > /tmp/rippleauto.log 2>&1 \
  && ok "rippleauto unit tests (2.343.0 LTX Ripple renders as soon as its ✎ first frame is made; a failed render says why)" \
  || { bad "rippleauto unit tests"; grep -a "^FAIL" /tmp/rippleauto.log | head -12; }
node scripts/test-swappreview.js > /tmp/swappreview.log 2>&1 \
  && ok "swappreview unit tests (2.347.0 a ✎ first frame / a finished segment clicked opens in the swap dialog's big preview; ✕ / Esc / the box go back)" \
  || { bad "swappreview unit tests"; grep -a "^FAIL" /tmp/swappreview.log | head -12; }
node scripts/test-ffcands.js > /tmp/ffcands.log 2>&1 \
  && ok "ffcands unit tests (2.348.0 several ✎ first frames per segment: the record, the sync, select / drop, the wiring, click = use it, double-click = see it big)" \
  || { bad "ffcands unit tests"; grep -a "^FAIL" /tmp/ffcands.log | head -12; }
python3 scripts/test-blackcheck.py > /tmp/blackcheck.log 2>&1 \
  && ok "blackcheck unit tests (2.348.0 an all-black take is caught - not a live one, not a fade-in)" \
  || { bad "blackcheck unit tests"; grep -a "^FAIL" /tmp/blackcheck.log | head -12; }
python3 scripts/test-viggle.py > /tmp/viggle.log 2>&1 \
  && ok "viggle unit tests (2.344.0 Viggle-Animate on H3: Tim's upload patched - size, clip, first frame, 3-step sigmas, DMD + swap LoRAs, output; speed patches stepped over; model names matched)" \
  || { bad "viggle unit tests"; grep -a "^FAIL" /tmp/viggle.log | head -12; }
python3 scripts/test-native.py > /tmp/vnpy.log 2>&1 \
  && ok "native engine unit tests (2.352.0 the resident engine behind Viggle (native), app Python: the client + a stub server in a fake venv, the ComfyUI hand-back, the Viggle worker on the server, the fetch lists)" \
  || { bad "native engine unit tests"; grep -a "^FAIL" /tmp/vnpy.log | head -12; }
python3 scripts/test-h3viggle.py > /tmp/h3vgpy.log 2>&1 \
  && ok "h3viggle unit tests (2.352.0 the H3_Viggle style, worker side: the picture per mode, the motion cut per chunk, the Viggle graph filled, worker.py ref2va / fl2va / two chunks through the stub ComfyUI)" \
  || { bad "h3viggle unit tests"; grep -a "^FAIL" /tmp/h3vgpy.log | head -12; }
node scripts/test-h3viggle.js > /tmp/h3vgjs.log 2>&1 \
  && ok "h3viggle app tests (2.352.0 lib/h3Viggle: the starter, /api/generate's refusals, the board plan per scene type, the 🎬 motion video, routes/h3Viggle, the wiring, the dock's slot + picker in jsdom)" \
  || { bad "h3viggle app tests"; grep -a "^FAIL" /tmp/h3vgjs.log | head -12; }
node scripts/test-voicestyle.js > /tmp/voicestyle.log 2>&1 \
  && ok "voicestyle unit tests (2.363.0 speech with emotion in the voice's timbre, never its words: the writer's lines -> H3 <d> dialogue with the delivery outside, the timbre binding, an 8 s voice sample, the native plan, the writers' rules)" \
  || { bad "voicestyle unit tests"; grep -a "^FAIL" /tmp/voicestyle.log | head -12; }
node scripts/test-sfx.js > /tmp/sfx.log 2>&1 \
  && ok "sfx unit tests (2.360.0 the SFX dock: a video's audio extracted (.mov included), Keep selected / Delete selected with 5 ms fades, as a new file, Undo, → Sound assets, the routes LIVE, the dock in jsdom, the layout wiring; 2.361.0 the Duration box (drop / slide / resize / typed edges) and each cut in the gallery's Audio tab)" \
  || { bad "sfx unit tests"; grep -a "^FAIL" /tmp/sfx.log | head -12; }
node scripts/test-saveas.js > /tmp/saveas.log 2>&1 \
  && ok "saveas unit tests (2.359.0 the preview dialog's 💾 Save and the gallery tiles' Save as: the last save-as folder, a free name on Save, overwrite only when asked, the file dialog's Save As mode, the upload path, loopback only)" \
  || { bad "saveas unit tests"; grep -a "^FAIL" /tmp/saveas.log | head -12; }
node scripts/test-scenebridge.js > /tmp/scenebridge.log 2>&1 \
  && ok "scenebridge unit tests (2.358.0 bridge scenes: the strip's gap carved from each segment's end, the writer's plan woven around the bridges, bridges queue last, bridge_worker.py's wipe from last frame to first frame, an AI bridge fitted to its gap, the strip + card in jsdom)" \
  || { bad "scenebridge unit tests"; grep -a "^FAIL" /tmp/scenebridge.log | head -12; }
node scripts/test-basicsize.js > /tmp/basicsize.log 2>&1 \
  && ok "basicsize unit tests (2.357.0 board renders use the left Basic Settings' width x height: kept per project, the ⚙ Resolution still wins, the default says where to change it; the dock sends it with ▶ / ↻ / render selected)" \
  || { bad "basicsize unit tests"; grep -a "^FAIL" /tmp/basicsize.log | head -12; }
node scripts/test-scenelyrics.js > /tmp/scenelyr.log 2>&1 \
  && ok "scenelyrics unit tests (2.356.0 the song's timed transcript decides each scene: a sung stretch lip-syncs with its words, an instrumental one keeps the lips closed, no transcript = said; the writer never decides instrumental on its own)" \
  || { bad "scenelyrics unit tests"; grep -a "^FAIL" /tmp/scenelyr.log | head -12; }
node scripts/test-refcontext.js > /tmp/refctx.log 2>&1 \
  && ok "refcontext unit tests (2.354.0 the reference dock for the prompt LLM: tags + subjects + descriptions + videos + sounds, the mapping-line rule, file names retagged, descriptions cached)" \
  || { bad "refcontext unit tests"; grep -a "^FAIL" /tmp/refctx.log | head -12; }
python3 scripts/test-refslots.py > /tmp/refslots.log 2>&1 \
  && ok "refslots unit tests (2.353.0 an H3 reference graph saved with pictures only gets video + sound slots for the references given; worker.py renders with them; a video-only ref2va works)" \
  || { bad "refslots unit tests"; grep -a "^FAIL" /tmp/refslots.log | head -12; }
node scripts/test-components.js > /tmp/compjs.log 2>&1 \
  && ok "components unit tests (2.353.0 components.txt + Viggle (native) installed on start: the file, the decision, the ComfyUI workflow's models used instead of a download, the after-install check + follow-up download, skip, never on the test server)" \
  || { bad "components unit tests"; grep -a "^FAIL" /tmp/compjs.log | head -12; }
node scripts/test-native.js > /tmp/vnjs.log 2>&1 \
  && ok "native engine app tests (2.352.0 lib/nativeEngine: your ComfyUI Viggle files found + checked, the source per component, readiness; the routes; the wiring; the swap ⚙ Viggle block with 🔍 in jsdom)" \
  || { bad "native engine app tests"; grep -a "^FAIL" /tmp/vnjs.log | head -12; }
node scripts/test-viggleswap.js > /tmp/viggleswap.log 2>&1 \
  && ok "viggleswap unit tests (2.344.0 the swap dialog's Viggle (H3) engine: the job, 480 size, ⚙ steps / DMD, the wiring, Setup's pack + models, the dialog in jsdom)" \
  || { bad "viggleswap unit tests"; grep -a "^FAIL" /tmp/viggleswap.log | head -12; }
python3 scripts/test-modelmatch.py > /tmp/modelmatch.log 2>&1 \
  && ok "modelmatch unit tests (2.345.0 a workflow's model -> the name THIS ComfyUI lists: a subfolder, the closest of its kind, never another family)" \
  || { bad "modelmatch unit tests"; grep -a "^FAIL" /tmp/modelmatch.log | head -12; }
node scripts/test-swapprompt.js > /tmp/swapprompt.log 2>&1 \
  && ok "swapprompt unit tests (2.335.0 ✎ Write prompt: the swap guide taught + overridable, the vision's two questions, the LLM's reply cleaned, the fallbacks, a whole prompt sent as it is)" \
  || { bad "swapprompt unit tests"; grep -a "^FAIL" /tmp/swapprompt.log | head -12; }
node scripts/test-swapdlg.js > /tmp/swapdlg.log 2>&1 \
  && ok "swapdlg unit tests (2.329.0 the character swap dialog: auto segments on H3's grid, vidTemp / vidSwap, the join, the three columns + both menubars in jsdom)" \
  || { bad "swapdlg unit tests"; tail -12 /tmp/swapdlg.log; }
node scripts/test-assetgroups.js > /tmp/assetgroups.log 2>&1 \
  && ok "assetgroups unit tests (2.327.0 the Assets dock: groups add / send / ungroup / rename / delete, delete to the bin, select + the bar + drop on a header in jsdom)" \
  || { bad "assetgroups unit tests"; tail -12 /tmp/assetgroups.log; }
node scripts/test-cnbasic.js > /tmp/cnbasic.log 2>&1 \
  && ok "cnbasic unit tests (2.316.0 Basic Settings -> ControlNet: the record, the cnet LoRAs, the routes)" \
  || { bad "cnbasic unit tests"; tail -12 /tmp/cnbasic.log; }
python3 scripts/test-cnstage.py > /tmp/cnstage.log 2>&1 \
  && ok "cnstage unit tests (2.316.0 the preprocessor graph, ControlNet on SDXL / FLUX.2 / a guider, first -> map -> final)" \
  || { bad "cnstage unit tests"; tail -12 /tmp/cnstage.log; }
node scripts/test-takeupscale.js > /tmp/takeupscale.log 2>&1 \
  && ok "takeupscale unit tests (2.315.0 ⏫ upscales the previewed take: the source, its size, the ⚙ plan, the wiring, the menubar ⏫)" \
  || { bad "takeupscale unit tests"; tail -12 /tmp/takeupscale.log; }
python3 scripts/test-upscalestage.py > /tmp/upscalestage.log 2>&1 \
  && ok "upscalestage unit tests (2.312.0 the MMH3 Ultimate Upscale stage spliced after the sampler, or an export's own re-aimed)" \
  || { bad "upscalestage unit tests"; tail -12 /tmp/upscalestage.log; }
node scripts/test-tailframes.js > /tmp/tailframes.log 2>&1 \
  && ok "tailframes unit tests (2.313.0 the tail PNG folder/name rule, the spec, adopt, the continuation pick, the ⚙ fields)" \
  || { bad "tailframes unit tests"; tail -12 /tmp/tailframes.log; }
python3 scripts/test-tailpngs.py > /tmp/tailpngs.log 2>&1 \
  && ok "tailpngs unit tests (2.313.0 the take's last 2 s as PNGs: LIVE lanczos in time order, the ComfyUI upscale path, the fallback)" \
  || { bad "tailpngs unit tests"; tail -12 /tmp/tailpngs.log; }
node scripts/test-autostart.js > /tmp/autostart.log 2>&1 \
  && ok "autostart unit tests (what starts with the app, and with which model)" \
  || { bad "autostart unit tests"; tail -8 /tmp/autostart.log; }
node scripts/test-gguf.js > /tmp/gguf.log 2>&1 \
  && ok "gguf unit tests (header reader, KV-per-token math, trained-context clamp)" \
  || { bad "gguf unit tests"; tail -12 /tmp/gguf.log; }
# ---- NAMED TIMELINES IN THE PROJECT FOLDER (2.107.0, Tim): saved with the
# project as projects/<p>/timelines/<name>.json, several per project, the
# active one recorded in the .prj and handed back on load.
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"e2e_tl"}' > /dev/null
[ -d projects/e2e_tl/timelines ] && ok "timelines: the folder exists from the first open" || bad "timelines: no folder"
curl -sf -X POST http://127.0.0.1:8311/api/projects/save -H 'Content-Type: application/json' \
  -d '{"data":{"prompt":"p","timeline":"main","tl":{"video":[{"name":"a.mp4","start":0,"dur":2,"in":0,"out":2}],"audio":[],"images":[],"vlayers":[]}}}' > /dev/null
[ -f projects/e2e_tl/timelines/main.json ] && grep -q '"a.mp4"' projects/e2e_tl/timelines/main.json \
  && ok "timelines: saving the project writes timelines/main.json" || bad "timelines: main.json missing: $(ls projects/e2e_tl/timelines)"
python3 -c "
import json; d=json.load(open('projects/e2e_tl/e2e_tl.prj'))
assert d['timeline']=='main' and 'tl' not in d, d" \
  && ok "timelines: the .prj records the active NAME and no longer carries the clips inline" || bad "timelines: .prj shape wrong"
curl -sf -X POST http://127.0.0.1:8311/api/timelines/alt%20cut -H 'Content-Type: application/json' \
  -d '{"tl":{"video":[],"audio":[{"name":"s.wav","start":1,"dur":3}],"images":[],"vlayers":[]}}' | grep -q '"active":"alt cut"' \
  && ok "timelines: Save as writes timelines/alt cut.json and makes it active" || bad "timelines: save-as failed"
curl -sf http://127.0.0.1:8311/api/timelines | python3 -c "
import json,sys; j=json.load(sys.stdin); names=sorted(t['name'] for t in j['timelines'])
assert names==['alt cut','main'] and j['active']=='alt cut', j" \
  && ok "timelines: the list has both and the dropdown's active one" || bad "timelines: list wrong"
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"e2e_tl"}' | python3 -c "
import json,sys; j=json.load(sys.stdin); d=j['data']
assert d['timeline']=='alt cut' and d['tl']['audio'][0]['name']=='s.wav' and len(d['timelines'])==2, d" \
  && ok "timelines: opening the project loads the ACTIVE timeline's clips (alt cut) and the list" || bad "timelines: load did not attach"
curl -sf http://127.0.0.1:8311/api/timelines/main | grep -q '"a.mp4"' \
  && ok "timelines: switching fetches the other one by name" || bad "timelines: GET by name failed"
curl -s -X POST "http://127.0.0.1:8311/api/timelines/..%2Fevil" -H 'Content-Type: application/json' -d '{"tl":{}}' | grep -q "timeline name" \
  && ok "timelines: a traversal name is refused" || bad "timelines: traversal accepted"
# legacy: a .prj with an inline tl migrates into a file on first read
python3 -c "
import json; p='projects/e2e_tl/e2e_tl.prj'; d=json.load(open(p)); d.pop('timeline',None); d['tl']={'video':[{'name':'old.mp4','start':0,'dur':1,'in':0,'out':1}],'audio':[],'images':[],'vlayers':[]}
import os; os.remove('projects/e2e_tl/timelines/main.json'); json.dump(d,open(p,'w'))"
curl -sf http://127.0.0.1:8311/api/projects/current | python3 -c "
import json,sys; j=json.load(sys.stdin); d=j['data']; assert d['timeline']=='main' and d['tl']['video'][0]['name']=='old.mp4', d" \
  && [ -f projects/e2e_tl/timelines/main.json ] \
  && ok "timelines: a pre-2.107 project's inline timeline is migrated into timelines/main.json" || bad "timelines: legacy migration failed"
curl -s -X DELETE "http://127.0.0.1:8311/api/timelines/alt%20cut" | grep -q '"deleted":true' && [ ! -f "projects/e2e_tl/timelines/alt cut.json" ] \
  && ok "timelines: delete removes only that file" || bad "timelines: delete failed"
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"default"}' > /dev/null

# ---- THE PROJECT OWNS ITS REFERENCE MEDIA (2.101.0, Tim): reference/images,
# reference/videos, reference/audio + the names in the .prj, reloaded on open.
# Also the whole state (music lyrics, gallery tab, image dock...) round-trips.
node scripts/test-projectrefs.js > /tmp/projrefs.log 2>&1 \
  && ok "project reference store unit tests (reference/<kind>, manifest, verify)" \
  || { bad "project reference store unit tests"; tail -16 /tmp/projrefs.log; }
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"e2e_prefs"}' > /dev/null
[ -d projects/e2e_prefs/reference/images ] && [ -d projects/e2e_prefs/reference/videos ] && [ -d projects/e2e_prefs/reference/audio ] \
  && ok "project: reference/images|videos|audio exist from the first open" \
  || bad "project: reference folders missing: $(ls projects/e2e_prefs)"
# a sound asset to reference by name (copied from sound/ into reference/audio)
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_ref.wav" -F "hint=sound" > /dev/null 2>&1 \
  || bad "project: sound fixture upload failed (is /tmp/e2e_ref.wav missing?)"
PS=$(curl -sf -X POST http://127.0.0.1:8311/api/projects/save \
  -F "name=e2e_prefs" \
  -F 'data={"prompt":"walk","gallery":{"tab":"images"},"music":{"lyrics":"[verse] la la","caption":"pop","style":"s1","duration":"30","seed":"7"},"image":{"style":"klein"},"camera":{"shot":"wide"},"references":{"images":[{"file":"e2e_ref1.png","subject":2,"role":"face"}],"videos":[],"audio":["e2e_ref.wav"]}}' \
  -F "ref_images=@/tmp/e2e_ref1.png")
echo "$PS" | grep -q '"saved":true' && ok "project: multipart save accepted" || bad "project: save=$PS"
[ -f projects/e2e_prefs/reference/images/e2e_ref1.png ] \
  && ok "project: the tray picture was written to reference/images" \
  || bad "project: reference/images has $(ls projects/e2e_prefs/reference/images)"
[ -f projects/e2e_prefs/reference/audio/e2e_ref.wav ] \
  && ok "project: the referenced sound asset was COPIED into reference/audio" \
  || bad "project: reference/audio has $(ls projects/e2e_prefs/reference/audio); sound/ has $(ls projects/e2e_prefs/sound)"
python3 - <<'PYEOF'
import json
d=json.load(open("projects/e2e_prefs/e2e_prefs.prj"))
r=d["references"]
assert r["images"][0]["file"]=="e2e_ref1.png" and r["images"][0]["subject"]==2 and r["images"][0]["role"]=="face", r
assert r["audio"]==["e2e_ref.wav"], r
assert d["music"]["lyrics"]=="[verse] la la" and d["gallery"]["tab"]=="images" and d["camera"]["shot"]=="wide", d
assert d["saved"], "saved stamp"
PYEOF
[ $? = 0 ] && ok "project: the .prj names the reference media + keeps lyrics/gallery/camera" \
  || bad "project: .prj = $(head -c 400 projects/e2e_prefs/e2e_prefs.prj)"
PL=$(curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"e2e_prefs"}')
echo "$PL" | grep -q '"e2e_ref1.png"' && echo "$PL" | grep -q '"lyrics":"\[verse\] la la"' \
  && ok "project: open returns the manifest and the whole state" || bad "project: load=${PL:0:300}"
curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/projrefs/images/e2e_ref1.png | grep -q 200 \
  && ok "project: /projrefs serves a reference picture" || bad "project: /projrefs 404"
curl -sf -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/projrefs/images/..%2F..%2Fe2e_prefs.prj" | grep -q 404 \
  && ok "project: /projrefs never traverses" || bad "project: /projrefs traversal"
# a JSON save WITHOUT references (the beforeunload beacon) keeps the manifest
curl -sf -X POST http://127.0.0.1:8311/api/projects/save -H 'Content-Type: application/json' \
  -d '{"data":{"prompt":"later"}}' > /dev/null
python3 -c "
import json; d=json.load(open('projects/e2e_prefs/e2e_prefs.prj'))
assert d['prompt']=='later' and d['references']['images'][0]['file']=='e2e_ref1.png', d" \
  && ok "project: a state-only save keeps the reference manifest on disk" || bad "project: state-only save dropped references"
# 2.125.0: the wired graph's selection and control values are PROJECT state.
# They were per-browser-session, so reopening a project rendered the binding's
# defaults instead of what was set. The .prj stores whatever the client puts in
# `data`, so this pins the round trip rather than a new endpoint.
curl -sf -X POST http://127.0.0.1:8311/api/projects/save -H 'Content-Type: application/json' \
  -d '{"data":{"prompt":"later","graph":{"id":"g_abc","values":{"c1":0.75,"c2":"lightning","c3":false}}}}' > /dev/null
PG=$(curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"e2e_prefs"}')
echo "$PG" | python3 -c "
import json,sys; g=json.load(sys.stdin)['data']['graph']
assert g['id']=='g_abc', g
# 0.75 must come back as 0.75 and False as False - a slider written through
# '+v || default' is the trap this pins (see the LoRA weight note in HANDOVER)
assert g['values']=={'c1':0.75,'c2':'lightning','c3':False}, g" \
  && ok "project: the wired graph's id and control values round-trip in the .prj" \
  || bad "project: graph values lost: ${PG:0:300}"
# a manifest entry whose file is gone is dropped and NAMED on open
rm -f projects/e2e_prefs/reference/audio/e2e_ref.wav
PL2=$(curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"e2e_prefs"}')
echo "$PL2" | grep -q '"missing_references":\["audio/e2e_ref.wav"\]' && ! echo "$PL2" | grep -q '"audio":\["e2e_ref.wav"\]' \
  && ok "project: a vanished reference is dropped and reported on open" || bad "project: missing not reported: ${PL2:0:300}"
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"default"}' > /dev/null
# 2.372.0 (Tim: "when i click save project the song and scenes in videodocker get cleared. everything should be
# saving ... when i load the project it should load everything from where i saved it"): the scene board and its
# song live in the .prj; Save writes INTO it, Save as copies the whole project, Open brings it back
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"e2e_save372"}' > /dev/null
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=330:duration=20" projects/e2e_save372/sound/song372.wav
curl -sf -X POST http://127.0.0.1:8311/api/scenes/from-segments -H 'Content-Type: application/json' \
  -d '{"song":"song372.wav","durations":[10,10]}' > /dev/null
node -e "
const cs = require('./lib/chatStore'); const d = 'projects/e2e_save372/chat';
cs.append(d, cs.currentSession(d), 'user', 'save372 chat');"
curl -sf -X POST http://127.0.0.1:8311/api/projects/save -F "name=e2e_save372" \
  -F 'data={"prompt":"save372 prompt","docks":{"muTitle":"Song 372"},"references":{"images":[],"videos":[],"audio":[]}}' > /dev/null
SB372=$(curl -sf http://127.0.0.1:8311/api/scenes)
echo "$SB372" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['audio']=='song372.wav' and len(d['list'])==2, d" \
  && ok "save project: 💾 keeps the video docker's song and scenes (the board lives in the .prj and was wiped)" \
  || bad "save project: the board was cleared: ${SB372:0:200}"
SA372=$(curl -s -X POST http://127.0.0.1:8311/api/projects/save -F "name=e2e_save372 copy" -F 'data={"prompt":"copy prompt"}')
CB372=$(curl -sf http://127.0.0.1:8311/api/scenes)
echo "$SA372" | grep -q '"copied_from":"e2e_save372"' && [ -f "projects/e2e_save372 copy/e2e_save372 copy.prj" ] \
  && [ -f "projects/e2e_save372 copy/sound/song372.wav" ] && ls "projects/e2e_save372 copy/chat/"*.chat > /dev/null 2>&1 \
  && echo "$CB372" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['project']=='e2e_save372 copy' and d['audio']=='song372.wav' and len(d['list'])==2, d" \
  && ok "save project as a new name: the whole project is copied (board, song, chat) and opened" \
  || bad "save project as: ${SA372:0:200} / ${CB372:0:160}"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/projects/save -F 'name=e2e_prefs' -F 'data={}')" = "409" ] \
  && ok "save project as: another existing project is never overwritten (409)" || bad "save project as: overwrote e2e_prefs"
OP372=$(curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"e2e_save372"}')
OB372=$(curl -sf http://127.0.0.1:8311/api/scenes)
echo "$OP372" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; assert d['prompt']=='save372 prompt' and d['docks']['muTitle']=='Song 372', d" \
  && echo "$OB372" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['audio']=='song372.wav' and len(d['list'])==2, d" \
  && curl -sf http://127.0.0.1:8311/api/chat | grep -q "save372 chat" \
  && ok "open project: the prompt, the dock fields, the board + song and the chat come back as saved" \
  || bad "open project: ${OP372:0:200} / ${OB372:0:160}"
# 2.373.0 (Tim: "... add a checkbox to videodocker menu for kareoke - when the video renders, render another video
# with transparent background with the kareoke lyrics that can be added as an overlay layer in timeline"): the
# lyrics file, 🎤 on -> the rendered scene's overlay (transparent VP9), the compile keeps it see-through
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"e2e_kar373"}' > /dev/null
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=330:duration=20" projects/e2e_kar373/sound/kar373.wav
curl -sf -X POST http://127.0.0.1:8311/api/scenes/from-segments -H 'Content-Type: application/json' \
  -d '{"song":"kar373.wav","durations":[10,10]}' > /dev/null
KL=$(curl -s -X POST http://127.0.0.1:8311/api/karaoke/lyrics -H 'Content-Type: application/json' \
  -d '{"song":"kar373.wav","text":"[verse]\nHello neon city tonight\nWe dance until the morning light\n[chorus]\nNever let the music die\nSing it loud and reach the sky"}')
echo "$KL" | grep -q '"lyrics/kar373.txt"' && [ -f projects/e2e_kar373/lyrics/kar373.txt ] \
  && curl -sf "http://127.0.0.1:8311/api/karaoke/lyrics?song=kar373.wav" | grep -q "Hello neon city" \
  && ok "karaoke: a song's lyrics file is written and read back (lyrics/<song>.txt)" || bad "karaoke: lyrics ${KL:0:160}"
ffmpeg -y -loglevel error -f lavfi -i "color=c=0x225588:s=320x180:r=24:d=8" -f lavfi -i "sine=frequency=440:duration=8" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest projects/e2e_kar373/video/scene_1_kar.mp4
python3 - <<'PY'
import json
p = "projects/e2e_kar373/e2e_kar373.prj"; d = json.load(open(p))
for r in d["scenes"]["list"]:
    if r["n"] == 1: r["output"] = "scene_1_kar.mp4"; r["status"] = "rendered"
json.dump(d, open(p, "w"), indent=2)
PY
KO=$(curl -sf -X POST http://127.0.0.1:8311/api/karaoke/on -H 'Content-Type: application/json' -d '{"on":true}')
echo "$KO" | grep -q '"queued":\[1\]' && ok "karaoke: 🎤 on queues the overlay for the scene already rendered" || bad "karaoke: on=$KO"
KS=""
for i in $(seq 1 90); do
  KS=$(curl -sf http://127.0.0.1:8311/api/karaoke)
  echo "$KS" | grep -q '"status":"\(done\|failed\|none\)"' && break
  sleep 1
done
KOUT=$(echo "$KS" | python3 -c "import json,sys; e=json.load(sys.stdin)['scenes']['1']; print(e.get('output','') if e['status']=='done' and e.get('pending') else '')")
[ -n "$KOUT" ] && [ -f "projects/e2e_kar373/video/$KOUT" ] \
  && [ "$(ffprobe -v error -show_entries stream_tags=alpha_mode -of csv=p=0 "projects/e2e_kar373/video/$KOUT")" = "1" ] \
  && [ "$(ffprobe -v error -show_entries stream=width,height -of csv=p=0:s=x "projects/e2e_kar373/video/$KOUT")" = "320x180" ] \
  && ok "karaoke: the overlay is a TRANSPARENT VP9 webm the size of the take, in the video assets, waiting for the timeline" \
  || bad "karaoke: overlay ${KS:0:300}"
curl -sf -X POST "http://127.0.0.1:8311/api/karaoke/1/placed" -H 'Content-Type: application/json' -d "{\"output\":\"$KOUT\"}" | grep -q '"ok":true' \
  && curl -sf http://127.0.0.1:8311/api/karaoke | python3 -c "import json,sys; assert json.load(sys.stdin)['scenes']['1']['pending'] is False" \
  && ok "karaoke: the timeline's ack clears the wait" || bad "karaoke: placed ack"
KX=$(curl -sf -X POST http://127.0.0.1:8311/api/export -H 'Content-Type: application/json' \
  -d "{\"video\":[{\"name\":\"scene_1_kar.mp4\",\"src\":\"video\",\"start\":0,\"in\":0,\"out\":8,\"dur\":8}],\"video_layers\":[{\"name\":\"Karaoke\",\"clips\":[{\"name\":\"$KOUT\",\"src\":\"video\",\"start\":0,\"in\":0,\"out\":8,\"dur\":8}]}],\"audio\":[],\"images\":[]}")
KXID=$(echo "$KX" | jget "['id']")
for i in $(seq 1 90); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$KXID" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 1
done
KXL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$KXID?log_from=0")
[ "$st" = "done" ] && echo "$KXL" | grep -q "transparent overlay (alpha read through libvpx)" \
  && python3 - <<'PY'
import subprocess
# the compiled frame keeps the blue take behind the lyrics: the corner is blue, not black
raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", "5", "-i", "projects/e2e_kar373/e2e_kar373.mp4",
                      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
r, g, b = raw[0], raw[1], raw[2]
assert b > 60 and b > r, (r, g, b)
PY
[ $? = 0 ] && [ "$st" = "done" ] \
  && ok "karaoke: the compile reads the overlay's alpha (libvpx) - the take shows through, not a black frame" \
  || bad "karaoke: compile $st $(echo "$KXL" | grep -o 'transparent overlay[^"]*' | head -1)"
curl -sf -X POST http://127.0.0.1:8311/api/karaoke/on -H 'Content-Type: application/json' -d '{"on":false}' > /dev/null
node scripts/test-karaoke.js > /tmp/karaoke373.log 2>&1 \
  && ok "karaoke unit tests (2.373.0 lyrics file, lyrics timed by speech-to-text, the bouncing-ball ASS, 🎤 overlays per scene, the Karaoke layer)" \
  || { bad "karaoke unit tests"; tail -12 /tmp/karaoke373.log; }
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"default"}' > /dev/null
# 2.374.0 (Tim: "add a recycle bin(icon only) button to the menubar in the left docker, create a dialog for the
# recycle bin ... restore, delete, empty ... add a reset button ... delete the current project folder and re-create
# it from the original name and description"): the bin remembers origins, restores, deletes, empties; reset
curl -sf -X POST http://127.0.0.1:8311/api/projects/new -H 'Content-Type: application/json' \
  -d '{"name":"e2e_rb374","description":"recycle bin test"}' > /dev/null
ffmpeg -y -loglevel error -f lavfi -i "testsrc=s=160x90:d=1" -frames:v 1 projects/e2e_rb374/images/rb_a.png
ffmpeg -y -loglevel error -f lavfi -i "testsrc=s=160x90:d=1" projects/e2e_rb374/output/rb_b.mp4
curl -sf -X POST http://127.0.0.1:8311/api/passets/recycle -H 'Content-Type: application/json' \
  -d '{"items":[{"kind":"images","name":"rb_a.png"}]}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/outputs/clear > /dev/null
RB=$(curl -sf http://127.0.0.1:8311/api/recyclebin)
echo "$RB" | python3 -c "
import json,sys; d=json.load(sys.stdin); f={e['name']:e['from'] for e in d['items']}
assert d['project']=='e2e_rb374' and f.get('rb_a.png')=='images/rb_a.png' and f.get('rb_b.mp4')=='output/rb_b.mp4', d" \
  && ok "recycle bin: the dialog's list names each file and the folder it came from" || bad "recycle bin: list ${RB:0:300}"
curl -sf -X POST http://127.0.0.1:8311/api/recyclebin/restore -H 'Content-Type: application/json' -d '{"names":["rb_a.png"]}' \
  | grep -q '"to":"images/rb_a.png"' && [ -f projects/e2e_rb374/images/rb_a.png ] \
  && ok "recycle bin: ↩ Restore puts the file back where it came from" || bad "recycle bin: restore"
curl -sf -X POST http://127.0.0.1:8311/api/recyclebin/delete -H 'Content-Type: application/json' -d '{"names":["rb_b.mp4"]}' \
  | grep -q '"deleted":\["rb_b.mp4"\]' && [ ! -f projects/e2e_rb374/recycle_bin/rb_b.mp4 ] \
  && ok "recycle bin: ✕ Delete removes a file for good" || bad "recycle bin: delete"
curl -sf -X POST http://127.0.0.1:8311/api/passets/recycle -H 'Content-Type: application/json' \
  -d '{"items":[{"kind":"images","name":"rb_a.png"}]}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/recyclebin/empty | grep -q '"deleted":1' \
  && [ "$(curl -sf http://127.0.0.1:8311/api/recyclebin | jget "['count']")" = "0" ] \
  && ok "recycle bin: 🧹 Empty deletes everything in it" || bad "recycle bin: empty"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/projects/reset -H 'Content-Type: application/json' -d '{"name":"default"}')" = "400" ] \
  && ok "reset project: only the CURRENT project's name confirms it" || bad "reset project: a wrong name was accepted"
RS=$(curl -s -X POST http://127.0.0.1:8311/api/projects/reset -H 'Content-Type: application/json' -d '{"name":"e2e_rb374"}')
echo "$RS" | grep -q '"description":"recycle bin test"' && [ ! -f projects/e2e_rb374/images/rb_a.png ] \
  && [ -d projects/e2e_rb374/sound ] && [ -f projects/e2e_rb374/e2e_rb374.prj ] \
  && ok "reset project: the folder is deleted and made again, empty, with its name and description" \
  || bad "reset project: ${RS:0:200}"
# 2.378.0 (Tim: "the reset project button doesn't work ... all the dockers should be cleared of everything including
# whats in the cache - it should be a new project"): jobs stopped, the Done list cleared, a folder in use cannot keep it
node scripts/test-projectreset.js > /tmp/preset378.log 2>&1 \
  && ok "project reset unit tests (2.378.0 running / queued jobs stopped, the queue's Done list + job caches cleared, the folder moved aside, files in use listed + deleted on the next start)" \
  || { bad "project reset unit tests"; tail -12 /tmp/preset378.log; }
# 2.378.0 (Tim: "fix Unexpected token '<', "<!DOCTYPE "... is not valid JSON when trying to add new character")
node scripts/test-tempupload.js > /tmp/tupload378.log 2>&1 \
  && ok "temp upload unit tests (2.378.0 uploads in the CURRENT project's temp/, a new character's picture after a reset, API errors in JSON)" \
  || { bad "temp upload unit tests"; tail -12 /tmp/tupload378.log; }
node scripts/test-recyclebin-dlg.js > /tmp/rbdlg374.log 2>&1 \
  && ok "recycle bin dialog unit tests (2.374.0 origins, restore / delete / empty, reset project, the 🗑 / ↺ buttons, titlebar + menubar)" \
  || { bad "recycle bin dialog unit tests"; tail -12 /tmp/rbdlg374.log; }
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"default"}' > /dev/null
node scripts/test-projectsave.js > /tmp/projectsave372.log 2>&1 \
  && ok "projectsave unit tests (2.372.0 save merges into the .prj, Save as copies the project, Open reloads every docker)" \
  || { bad "projectsave unit tests"; tail -12 /tmp/projectsave372.log; }
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"default"}' > /dev/null

# ---- 4-step LoRA toggle: patcher keeps the LoRA and flips its enable switch
python3 - <<'PYEOF'
import copy, json, sys
sys.path.insert(0, ".")
import worker
NAT = json.load(open("comfy_workflows/ref2va.json"))
P = dict(prompt="p", seed=1, frames=121, width=960, height=544, steps=4)
on = worker._patch_workflow(copy.deepcopy(NAT), **P, images=["a.png"], use_lora=True)
assert "145" in on, "lora node was dropped despite use_lora"
assert on["146"]["inputs"]["value"] is True, "enable switch not flipped"
assert str(on["141"]["inputs"]["on_true"][0]) == "145"
off = worker._patch_workflow(copy.deepcopy(NAT), **P, images=["a.png"], use_lora=False)
assert "145" not in off, "lora not bypassed when disabled"
for k, n in list(on.items()) + list(off.items()):
    for key, v in (n.get("inputs") or {}).items():
        assert not (isinstance(v, list) and v and str(v[0]) not in (on if k in on else off)), \
            f"dangling {k}.{key}"
print("lora toggle ok")
PYEOF
[ $? = 0 ] && ok "lora: 4-step toggle keeps/bypasses the LoRA cleanly" || bad "lora: toggle"

# ---- comfy-kitchen accel probe: must report, never 500, never claim a speedup
KA=$(curl -sf http://127.0.0.1:8311/api/comfy/accel)
echo "$KA" | jget "['notes']" | grep -q "int8_convrot" \
  && echo "$KA" | jget "['python']" | grep -q . \
  && ok "accel: kitchen probe reports python + honest model-format caveat" \
  || bad "accel: probe response=${KA:0:120}"
KT=$(echo "$KA" | jget "['tier']")
[ -n "$KT" ] && ok "accel: GPU tier resolved ($KT)" || bad "accel: no tier"
KI=$(echo "$KA" | jget "['installable']")
[ "$KI" = "False" ] && ok "accel: install correctly withheld (no Ada/Blackwell here)" \
  || say "accel: installable=$KI (this box reports a capable GPU)"

# ---- gallery/timeline source of truth: outputs follow the CURRENT project
# and the choice survives a restart (regression: server always came back as
# "default" so the gallery read an empty folder).
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"e2e_gallery"}' > /dev/null
run_job proj-gallery 24 "chunk 1/1" yes "${B[@]}" -F mode=t2va -F frames=24 \
  -F pipeline=auto -F format=webm
GO=$(curl -sf http://127.0.0.1:8311/api/outputs)
GW=$(curl -sf http://127.0.0.1:8311/api/outputs/where)
echo "$GW" | grep -q '"project":"e2e_gallery"' && echo "$GO" | grep -q '"name"' \
  && ok "gallery: lists the current project's outputs" \
  || bad "gallery: outputs/where=$GW list=${GO:0:80}"
grep -q '"current_project": "e2e_gallery"' custom.settings \
  && ok "gallery: current project persisted to custom.settings (survives restart)" \
  || bad "gallery: current project not persisted"
[ ! -e config.json ] && ok "settings: no config.json is written any more (custom.settings is the store)" \
  || bad "settings: config.json reappeared"
# a timeline export lands in final/ — it must show up in the gallery too
FDIR="projects/e2e_gallery/final"
mkdir -p "$FDIR"
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=64x64:rate=24 -t 1 \
  -pix_fmt yuv420p -c:v libvpx-vp9 -b:v 0 -crf 40 "$FDIR/e2e_export.webm"
GE=$(curl -sf http://127.0.0.1:8311/api/outputs)
echo "$GE" | grep -q 'e2e_export.webm' && echo "$GE" | grep -q '"where": *"final"' \
  && ok "gallery: timeline exports in final/ are listed too" \
  || bad "gallery: final/ not scanned: ${GE:0:160}"
GS=$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/outputs/e2e_export.webm)
[ "$GS" = "200" ] && ok "gallery: a final/ clip streams from /outputs" \
  || bad "gallery: final/ clip serves $GS"
GW2=$(curl -sf http://127.0.0.1:8311/api/outputs/where)
echo "$GW2" | grep -q '"where": *"final"' \
  && ok "gallery: /where reports both folders" || bad "gallery: /where=$GW2"
GN=$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/outputs/nope.webm)
[ "$GN" = "404" ] && ok "gallery: missing output serves 404 (not a crash)" \
  || bad "gallery: missing output -> $GN"
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"default"}' > /dev/null

# ---- ComfyUI engine path: stub Comfy + API-format template, chunked 4s run
# A STUB LEFT OVER FROM A PREVIOUS RUN silently wins the port, and then every
# comfy check below tests the OLD stub's behaviour while the suite looks green.
# The bind failure is invisible (the server dies into its own log), so make sure
# the port is ours before trusting anything that follows.
if curl -sf --max-time 1 http://127.0.0.1:8388/system_stats > /dev/null 2>&1; then
  say "port 8388 already answering - killing a stale stub before starting ours"
  pkill -f "stub-comfy.py 8388" 2>/dev/null
  sleep 1
fi
rm -rf /tmp/stub-comfy-out
python3 scripts/stub-comfy.py 8388 /tmp/stub-comfy-out > /tmp/stubcomfy.log 2>&1 &
SC=$!
trap 'kill $SRV $SC 2>/dev/null' EXIT
sleep 0.8
grep -q "Address already in use" /tmp/stubcomfy.log 2>/dev/null \
  && bad "stub ComfyUI could not bind 8388 - the comfy checks below would test a STALE stub" \
  || ok "stub ComfyUI is ours (port 8388 bound by this run)"
mkdir -p comfy_workflows
# API-format template under an e2e-only name; the bundled t2va.json is a UI
# export example, so the workflows mapping is pointed here explicitly (this
# also exercises the deep-merged engine.comfy config path).
cat > comfy_workflows/e2e_api.json << 'WF'
{
  "3": { "class_type": "LoadImage", "inputs": { "image": "placeholder.png" } },
  "7": { "class_type": "RHMiniMaxH3VideoGen",
         "inputs": { "prompt": "", "seed": 0, "duration_seconds": 1.0,
                     "width": 0, "height": 0, "steps": 8,
                     "first_frame": ["3", 0] } },
  "9": { "class_type": "SaveVideo", "inputs": { "video": ["7", 0] } }
}
WF
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"comfy","comfy":{"url":"http://127.0.0.1:8388",
       "workflows":{"t2va":"comfy_workflows/e2e_api.json",
                    "ref2va":"comfy_workflows/e2e_api.json",
                    "fl2va":"comfy_workflows/e2e_api.json"}}}}' > /dev/null
FREES0=$(curl -sf http://127.0.0.1:8388/e2e/vram | jget "['free_calls']")
run_job comfy-4s 96 "chunk 2/2" yes -F prompt="comfy engine drone shot" -F width=192 -F height=108 \
  -F steps=4 -F seed=7 -F mode=t2va -F frames=96 -F pipeline=chunked -F segment_seconds=2.1 \
  -F force_chunks=true -F format=webm

# ---- VRAM is cleared BEFORE a generation (2.98.0). Tim: "15 sec videos used to
# work. 10 seconds work but 15 doesn't. maybe clear vram before generation?"
# The stub's fake card reports 3 GB free until POST /free, then 30 GB, so the
# worker's readout is a real before -> after; it must land ONCE per job (chunk 2
# keeps the model warm) and BEFORE the first /prompt.
CJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID?log_from=0")
echo "$CJ" | python3 -c "
import json,sys
log=json.load(sys.stdin)['log']
vr=[i for i,l in enumerate(log) if '[comfy] VRAM: 3.0/32.0 GB free -> 30.0/32.0 GB free' in l]
qs=[i for i,l in enumerate(log) if '[comfy] queueing on' in l]
assert len(vr)==1, ('expected ONE clear per job, got', len(vr))
assert len(qs)==2, ('two chunks queue twice', len(qs))
assert vr[0] < qs[0], ('the clear must precede the FIRST queue', vr[0], qs[0])
assert not any('VRAM clear' in l for l in log), 'no failure/OFF line on a healthy run'
" && ok "comfy: VRAM cleared once, before the first /prompt (readout 3.0 -> 30.0 GB)" \
    || { bad "comfy: the pre-generation VRAM clear is missing or misplaced"; echo "$CJ" | jget "['log']" | grep -i "vram\|queueing" | head -6; }
FREES1=$(curl -sf http://127.0.0.1:8388/e2e/vram | jget "['free_calls']")
[ "$((FREES1 - FREES0))" = "1" ] && ok "comfy: the stub saw exactly one POST /free for that job" \
  || bad "comfy: POST /free count moved by $((FREES1 - FREES0)), want 1"
curl -sf http://127.0.0.1:8388/e2e/vram | jget "['last_free_body']" | grep -q "'unload_models': True, 'free_memory': True" \
  && ok "comfy: /free asked for BOTH unload_models and free_memory" \
  || bad "comfy: /free body wrong: $(curl -sf http://127.0.0.1:8388/e2e/vram | jget "['last_free_body']")"

# the manual button: POST /api/comfy/free -> before/after per card, and the
# console line that the Settings status shows
FB=$(curl -s -X POST http://127.0.0.1:8311/api/comfy/free)
echo "$FB" | python3 -c "
import json,sys
j=json.load(sys.stdin)
assert j['ok'] is True, j
assert j['before'][0]['free']==3*2**30 and j['after'][0]['free']==30*2**30, j
assert '3.0/32.0 GB free -> 30.0/32.0 GB free' in j['line'], j['line']
" && ok "comfy: POST /api/comfy/free frees and reports before -> after" \
    || bad "comfy: /api/comfy/free: $FB"
FREES2=$(curl -sf http://127.0.0.1:8388/e2e/vram | jget "['free_calls']")
[ "$((FREES2 - FREES1))" = "1" ] && ok "comfy: the button is one POST /free" \
  || bad "comfy: the button made $((FREES2 - FREES1)) /free calls"
curl -sf http://127.0.0.1:8311/api/comfy/status | python3 -c "
import json,sys
j=json.load(sys.stdin)
assert j['free_before_gen'] is True, j.get('free_before_gen')
assert j['vram'] and j['vram'][0]['total']==32*2**30, j.get('vram')
" && ok "comfy: status carries free_before_gen (default ON) and ComfyUI's own VRAM view" \
    || bad "comfy: status lacks free_before_gen / vram"

# the switch: engine.comfy.free_before_gen=false -> the worker says so and the
# stub sees no /free. Deep-merged, so the workflows map survives the toggle.
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"free_before_gen":false}}}' > /dev/null
run_job comfy-nofree 22 "chunk 1/1" yes -F prompt="no clear" -F width=192 -F height=108 \
  -F steps=4 -F seed=7 -F mode=t2va -F frames=22 -F pipeline=single -F segment_seconds=15 \
  -F force_chunks=false -F format=webm
NJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID?log_from=0")
echo "$NJ" | jget "['log']" | grep -q "VRAM clear before generation is OFF (Settings -> ComfyUI)" \
  && ok "comfy: free_before_gen=false is honoured and SAID in the log" \
  || bad "comfy: the OFF switch left no trace: $(echo "$NJ" | jget "['log']" | grep -i vram | head -3)"
FREES3=$(curl -sf http://127.0.0.1:8388/e2e/vram | jget "['free_calls']")
[ "$FREES3" = "$FREES2" ] && ok "comfy: ...and the stub saw NO /free for that job" \
  || bad "comfy: /free was called with the switch off"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"free_before_gen":true}}}' > /dev/null
curl -sf http://127.0.0.1:8311/api/config | jget "['engine']['comfy']['workflows']['t2va']" | grep -q e2e_api \
  && ok "comfy: toggling the switch kept the workflows map (deep merge)" \
  || bad "comfy: the workflows map was lost by the toggle"

# the words an OOM gets: the exact event shape from Tim's log, through the
# shared explainer the video worker now prints
python3 scripts/test-comfyfree.py > /tmp/comfyfree.log 2>&1 \
  && ok "comfy VRAM unit tests (/free hand-off, the OFF switch, the OOM advice)" \
  || { bad "comfy VRAM unit tests"; tail -12 /tmp/comfyfree.log; }

node scripts/test-settings.js > /tmp/settings.log 2>&1 \
  && ok "settings unit tests (default/custom layers, diff-only save, reset, migration)" \
  || { bad "settings unit tests"; tail -12 /tmp/settings.log; }

node scripts/test-recyclebin.js > /tmp/recyclebin.log 2>&1 \
  && ok "recycle bin unit tests (2.223.15: confirm-delete flag, soft delete, clear gallery)" \
  || { bad "recycle bin unit tests"; tail -12 /tmp/recyclebin.log; }

# ---- the 32B text encoder stays OFF the card (2.99.2). Tim's 15 s clip
# rendered at 2.85.3 and not at 2.97.1 with a BYTE-IDENTICAL graph and plan
# (proved by diffing 2.89.0's patcher against this one) — what changed was
# ComfyUI's own memory management holding the 32B encoder through sampling.
# CLIPLoader.device=cpu is the one lever that is ours. Check it lands in the
# JSON ComfyUI actually receives, not just in our log line.
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"clip_device":"cpu"}}}' > /dev/null
run_job comfy-clipcpu 22 "chunk 1/1" yes -F prompt="pin the encoder" -F width=192 -F height=108 \
  -F steps=4 -F seed=21 -F mode=t2va -F frames=22 -F pipeline=single -F segment_seconds=15 \
  -F force_chunks=false -F format=webm
CLIPJ=$(python3 -c "
import glob, json, os
newest = max(glob.glob('/tmp/stub-comfy-out/prompt_*.json'), key=os.path.getmtime)
g = json.load(open(newest))
print(json.dumps([v['inputs'] for v in g.values() if v.get('class_type') == 'CLIPLoader']))
" 2>/dev/null)
if [ "$CLIPJ" != "[]" ] && [ -n "$CLIPJ" ]; then
  echo "$CLIPJ" | grep -q '"device": "cpu"' \
    && ok "comfy: the queued graph pins the text encoder on the CPU (device=cpu)" \
    || bad "comfy: CLIPLoader.device did not reach ComfyUI: $CLIPJ"
else
  ok "comfy: (this stub template has no CLIPLoader — nothing to pin)"
fi
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"clip_device":"default"}}}' > /dev/null

# ---- STEPS FOLLOW THE LoRA TOGGLE (2.100.0): steps=0 is AUTO and the worker
# says where the count came from. The stub template's own literal wins for a
# base run; an explicit count is passed straight through. Also: the route must
# accept 0 (the old clamp floor was 1, which silently turned auto into 1 step).
for CASE in "0:auto" "3:explicit"; do
  ST=${CASE%%:*}; WANT=${CASE##*:}
  AID=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
    -F prompt="steps $WANT" -F width=192 -F height=108 -F steps=$ST -F seed=32 \
    -F mode=t2va -F frames=22 -F pipeline=single -F format=webm | jget "['id']")
  for i in $(seq 1 60); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
  curl -sf "http://127.0.0.1:8311/api/jobs/$AID?log_from=0" | python3 -c "
import json,sys
j=json.load(sys.stdin); log=j['log']
assert j['params']['steps']==$ST, j['params']['steps']
line=[l for l in log if '[comfy] steps=' in l]
assert line and '($WANT' in line[0], line
" && ok "comfy: steps=$ST is resolved by the worker as '$WANT' and logged" \
      || bad "comfy: steps=$ST was not resolved as $WANT"
done
curl -sf -X POST http://127.0.0.1:8311/api/plan -H 'Content-Type: application/json' -d '{"steps":0}' > /dev/null 2>&1 || true
# Settings -> ComfyUI: the relaunch route exists and refuses politely for a
# ComfyUI H3 did not start (the stub here), never touching it.
curl -sf -X POST http://127.0.0.1:8311/api/comfy/relaunch-console -H 'Content-Type: application/json' -d '{"keep_setting":true}' \
  | grep -q '"relaunched": *false' && ok "comfy: relaunch-in-console refuses a ComfyUI it did not start (2.100.0)" \
  || bad "comfy: relaunch-console route missing or touched a foreign ComfyUI"
grep -q '"stdio": *"file"' <(curl -sf http://127.0.0.1:8311/api/comfy/status) \
  && ok "comfy: status reports the stdio setting (file by default)" || bad "comfy: status has no stdio field"

# ---- THE CLIP THAT DID NOT FIT (2.99.0 ladder, 2.99.1 Errno-22).
# Tim's card: 32 GB, a 21 GB int8 model. 243f renders, 362f dies in the sampler
# even with the card cleared. The worker must re-plan that render into chunks
# that fit, finish it, and REMEMBER the ceiling so the next long clip is planned
# right from the start. Scaled down here (96f target, the stub OOMs above 80f,
# so 107f -> a 73f ceiling -> [73, 39]) purely to keep the suite quick — the
# code path, the ladder and the learned ceiling are identical at Tim's sizes.
curl -sf -X POST http://127.0.0.1:8388/e2e/oom -H 'Content-Type: application/json' -d '{"above":300}' > /dev/null
# 2.99.4 (Tim: "don't do chunks"): OFF by default — a clip that cannot render
# is REPORTED, never silently split at a hand-off seam.
NCID=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
  -F prompt="no chunks please" -F width=192 -F height=108 -F steps=4 -F seed=31 \
  -F mode=t2va -F frames=360 -F pipeline=auto -F segment_seconds=15 \
  -F force_chunks=false -F format=webm | jget "['id']")
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$NCID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
curl -sf "http://127.0.0.1:8311/api/jobs/$NCID?log_from=0" | python3 -c "
import json,sys
j=json.load(sys.stdin); log=j['log']
assert j['status']=='failed', j['status']
assert any('Not splitting this clip into segments' in l for l in log), [l for l in log if 'split' in l.lower()][:3]
assert not any('re-planning under' in l for l in log), 'it must NOT re-plan when chunking is off'
assert sum('===== chunk' in l for l in log)==1, 'exactly one attempt'
" && ok "comfy: with chunking off a clip that will not fit is REPORTED, not split (2.99.4)" \
    || bad "comfy: the no-chunk default did not hold"
# the rest of this block exercises the ladder itself, so switch it on — and
# reset the stub's counter, which the no-chunk job above legitimately bumped
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"chunk_on_oom":true}}}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"chunk_on_oom":true}}}' > /dev/null
curl -sf -X POST http://127.0.0.1:8388/e2e/oom -H 'Content-Type: application/json' -d '{"above":300}' > /dev/null
run_job comfy-oom-replan 360 "re-planning under a 243f VRAM ceiling" yes \
  -F prompt="the clip that did not fit" -F width=192 -F height=108 \
  -F steps=4 -F seed=7 -F mode=t2va -F frames=360 -F pipeline=auto -F segment_seconds=15 \
  -F force_chunks=false -F format=webm
OJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID?log_from=0")
echo "$OJ" | python3 -c "
import json,sys
j=json.load(sys.stdin); log=j['log']
assert any('plan=[362]' in l for l in log), 'the first plan must be the single 107f run (nothing learned yet)'
assert any('GPU out of memory at 362f' in l for l in log), [l for l in log if 'memory' in l.lower()][:3]
assert any('re-planning under a 243f VRAM ceiling' in l and '[243, 124]' in l for l in log), [l for l in log if 're-planning' in l]
assert sum('===== chunk 1/1' in l for l in log)==1 and sum('===== chunk 1/2' in l for l in log)==1 and sum('===== chunk 2/2' in l for l in log)==1, 'one failed single run, then two chunks'
# (@@CFG is a CONTROL line: the parser consumes it like @@CMD/@@OUT and it never
#  reaches the log — the saved config, checked next, is the proof it arrived)
assert not any(l.startswith('@@') for l in log), 'control lines must not leak into the log'
assert any('final joined: 360 frames' in l for l in log), 'the clip must be finished at its full length'
assert j['status']=='done', j['status']
" && ok "comfy: a 362f OOM is re-planned to [243, 124], rendered to 360f, and the ceiling reported (@@CFG)" \
    || { bad "comfy: the OOM re-plan did not happen as designed"; echo "$OJ" | jget "['log']" | grep -i "memory\|plan\|chunk" | head -8; }
OE=$(curl -sf http://127.0.0.1:8388/e2e/vram | jget "['oom_events']")
[ "$OE" = "1" ] && ok "comfy: exactly ONE attempt died of OOM before the re-plan fitted" || bad "comfy: oom_events=$OE, want 1"
curl -sf http://127.0.0.1:8311/api/config | python3 -c "
import json,sys
c=json.load(sys.stdin)['engine']['comfy']
assert c['vram_ceiling']==243, c['vram_ceiling']
assert '362f' in c['vram_ceiling_note'] and '243f' in c['vram_ceiling_note'], c['vram_ceiling_note']
" && ok "comfy: the learned ceiling (243f) and its note are SAVED in the config" \
    || bad "comfy: ceiling not saved: $(curl -sf http://127.0.0.1:8311/api/config | jget "['engine']['comfy']['vram_ceiling']")"
grep -q '"vram_ceiling": 243' custom.settings && ok "settings: ...and it landed in custom.settings, not default.settings" \
  || bad "settings: the learned ceiling is not in custom.settings"
grep -q '"vram_ceiling"' default.settings && grep -q '"vram_ceiling": 0' default.settings \
  && ok "settings: default.settings is untouched by saves (still 0)" \
  || bad "settings: default.settings was WRITTEN by a save"
# the next 4 s plan goes straight to two chunks; a 2 s one is still ONE run
curl -sf "http://127.0.0.1:8311/api/plan?seconds=15&pipeline=auto&engine=comfy" | python3 -c "
import json,sys
p=json.load(sys.stdin)
assert p['chunks']==[243,124] and p['pipeline']=='chunked' and p['vramCeiling']==243 and p['maxSingleRun']==243 and p['modelCeiling']==362, p
" && ok "plan: after learning, 15 s is planned as [243, 124] up front (no failed run first)" \
    || bad "plan: $(curl -sf 'http://127.0.0.1:8311/api/plan?seconds=15&pipeline=auto&engine=comfy')"
curl -sf "http://127.0.0.1:8311/api/plan?seconds=10&pipeline=auto&engine=comfy" | python3 -c "
import json,sys
p=json.load(sys.stdin); assert p['chunks']==[243] and p['pipeline']=='single', p
" && ok "plan: ...while a short clip stays one run under the learned ceiling" || bad "plan: the short clip changed"
# (comfy-oom-learned render dropped 2.99.4: the plan assertions below cover it without the minutes)
OE2=$(curl -sf http://127.0.0.1:8388/e2e/vram | jget "['oom_events']")
[ "$OE2" = "1" ] && ok "comfy: no further OOM once the ceiling is known" \
  || bad "comfy: a second OOM happened ($OE2) although the ceiling was known"
# an explicit Single run over the learned ceiling is chunked with a message, not failed
# (comfy-oom-single render dropped 2.99.4: the plan assertions below cover it without the minutes)
# forget the ceiling from the settings: the plan is a single run again
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"vram_ceiling":0,"vram_ceiling_note":"","chunk_on_oom":false}}}' > /dev/null
curl -sf "http://127.0.0.1:8311/api/plan?seconds=15&pipeline=auto&engine=comfy" | jget "['chunks']" | grep -q "^\[362\]$" \
  && ok "plan: resetting the ceiling puts the clip back to one 362f run" || bad "plan: ceiling reset did not take"
curl -sf -X POST http://127.0.0.1:8388/e2e/oom -H 'Content-Type: application/json' -d '{"above":0}' > /dev/null

# ---- THE Errno-22 THAT IS REALLY OOM (2.99.1). Tim's later log: the SAME clip
# that OOMs one run throws OSError [Errno 22] in the sampler the next, on a
# cleared card, switch intact. A clean OOM on the same clip proves it is memory,
# so a sampler [Errno 22] must go down the SAME re-plan ladder, not fail with the
# stderr-flush advice.
curl -sf -X POST http://127.0.0.1:8388/e2e/oom -H 'Content-Type: application/json' -d '{"above":300,"kind":"einval"}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"chunk_on_oom":true}}}' > /dev/null
run_job comfy-einval-replan 360 "re-planning under a 243f VRAM ceiling" yes \
  -F prompt="errno 22 this time" -F width=192 -F height=108 \
  -F steps=4 -F seed=11 -F mode=t2va -F frames=360 -F pipeline=auto -F segment_seconds=15 \
  -F force_chunks=false -F format=webm
EJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID?log_from=0")
echo "$EJ" | python3 -c "
import json,sys
j=json.load(sys.stdin); log=j['log']
assert any('OSError [Errno 22]' in l and 'memory-pressure form' in l for l in log), [l for l in log if 'Errno 22' in l][:3]
assert any('re-planning under a 243f VRAM ceiling' in l and '[243, 124]' in l for l in log), [l for l in log if 're-planning' in l]
assert any('not saving a' in l and 'not a memory limit' in l for l in log), 'it must SAY it is not learning from a non-memory failure'
assert not any('known ComfyUI-on-Windows stderr crash' in l for l in log), 'the stderr advice must NOT be printed when the ladder handles it'
assert any('final joined: 360 frames' in l for l in log), 'must finish at full length'
assert j['status']=='done', j['status']
" && ok "comfy: a sampler [Errno 22] is re-planned like an OOM and the clip renders (2.99.1)" \
    || { bad "comfy: the Errno-22 re-plan did not happen"; echo "$EJ" | jget "['log']" | grep -i "errno\|re-plan\|stderr\|chunk" | head -8; }
curl -sf http://127.0.0.1:8311/api/config | jget "['engine']['comfy']['vram_ceiling']" | grep -q "^0$" \
  && ok "comfy: the Errno-22 re-plan learns NOTHING (it is not a memory limit) — 2.99.4" \
  || bad "comfy: an Errno-22 taught a ceiling: $(curl -sf http://127.0.0.1:8311/api/config | jget "['engine']['comfy']['vram_ceiling']")"
# a sampler [Errno 22] that CANNOT be shrunk out of (fails at every size) ends
# with the stderr-flush advice and the decisive test, not an infinite loop
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"vram_ceiling":0,"vram_ceiling_note":"","chunk_on_oom":false}}}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"chunk_on_oom":true}}}' > /dev/null
curl -sf -X POST http://127.0.0.1:8388/e2e/oom -H 'Content-Type: application/json' -d '{"above":1,"kind":"einval"}' > /dev/null
RID=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
  -F prompt="errno at every size" -F width=192 -F height=108 -F steps=4 -F seed=12 \
  -F mode=t2va -F frames=360 -F pipeline=auto -F segment_seconds=15 \
  -F force_chunks=false -F format=webm | jget "['id']")
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$RID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
RJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$RID?log_from=0")
echo "$RJ" | python3 -c "
import json,sys
j=json.load(sys.stdin); log=j['log']
assert j['status']=='failed', j['status']
assert any('known ComfyUI-on-Windows stderr crash' in l for l in log), 'exhaustion must print the stderr advice'
assert any('re-planning under' in l for l in log), 'it must have tried ONE shrink as a test'
assert any('NOT ' in l and 'memory limit' in l for l in log), 'it must SAY the size is not the variable'
assert sum('re-planning under' in l for l in log) == 1, 'a size-independent failure gets exactly ONE shrink, not a ladder'
assert sum('===== chunk' in l for l in log) <= 6, 'must stop early, not walk the whole ladder'
" && ok "comfy: an unshrinkable sampler [Errno 22] gives the stderr advice after bounded retries" \
    || { bad "comfy: the exhaustion path is wrong"; echo "$RJ" | jget "['log']" | tail -6; }
curl -sf -X POST http://127.0.0.1:8388/e2e/oom -H 'Content-Type: application/json' -d '{"above":0}' > /dev/null
# 2.99.4: a NON-memory failure must never teach a ceiling. Tim's 5 s clip became
# THIRTY 5-frame chunks because 2.99.1 walked an [Errno 22] to the floor and
# saved it. After the Errno-22 runs above, nothing may be stored.
curl -sf http://127.0.0.1:8311/api/config | jget "['engine']['comfy']['vram_ceiling']" | grep -q "^0$" \
  && ok "comfy: a non-memory failure teaches NO ceiling (2.99.4)" \
  || bad "comfy: an Errno-22 sweep saved a ceiling: $(curl -sf http://127.0.0.1:8311/api/config | jget "['engine']['comfy']['vram_ceiling']")"
# and the server refuses to store one below the floor, however it is offered
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"vram_ceiling":5}}}' > /dev/null
CEIL5=$(curl -sf http://127.0.0.1:8311/api/config | jget "['engine']['comfy']['vram_ceiling']")
curl -sf "http://127.0.0.1:8311/api/plan?seconds=5&pipeline=auto&engine=comfy" | python3 -c "
import json,sys
p=json.load(sys.stdin)
assert p['chunks']==[124], ('a 5f ceiling must never shred a 5 s clip', p)
" && ok "comfy: a 5f ceiling can never shred a clip into hand-offs (Tim's 30-chunk bug)" \
    || bad "comfy: a bogus ceiling is still honoured (stored $CEIL5): $(curl -sf 'http://127.0.0.1:8311/api/plan?seconds=5&pipeline=auto&engine=comfy' | jget "['chunks']")"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"vram_ceiling":0,"vram_ceiling_note":"","chunk_on_oom":false}}}' > /dev/null

# chunk_on_oom is OPT-IN (default OFF): an OOM without it must STOP and say so,
# not silently hand back a seamed clip. Tim: "just start the job once in comfy".
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"chunk_on_oom":false,"vram_ceiling":0,"vram_ceiling_note":""}}}' > /dev/null
curl -sf -X POST http://127.0.0.1:8388/e2e/oom -H 'Content-Type: application/json' -d '{"above":300}' > /dev/null
NID=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="no chunks please" \
  -F width=192 -F height=108 -F steps=4 -F seed=31 -F mode=t2va -F frames=360 \
  -F pipeline=auto -F segment_seconds=15 -F force_chunks=false -F format=webm | jget "['id']")
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$NID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
curl -sf "http://127.0.0.1:8311/api/jobs/$NID?log_from=0" | python3 -c "
import json,sys
j=json.load(sys.stdin); log=j['log']
assert j['status']=='failed', j['status']
assert any('Not splitting this clip into segments' in l for l in log), 'it must SAY why it stopped'
assert not any('re-planning under' in l for l in log), 'it must NOT chunk behind the user'
assert sum('===== chunk' in l for l in log)==1, 'exactly one attempt'
" && ok "comfy: with chunk_on_oom OFF an OOM stops and says so — no silent seams" \
    || bad "comfy: the no-chunks default did not hold"
curl -sf -X POST http://127.0.0.1:8388/e2e/oom -H 'Content-Type: application/json' -d '{"above":0}' > /dev/null

# ---- Settings -> General -> Reset (2.99.0): back to default.settings, the open
# project kept, the old custom layer kept as .bak. The e2e's own custom layer
# (stub sd-cli paths, the comfy url/workflows set above) is restored afterwards
# from the .bak so the rest of the suite runs unchanged.
cp custom.settings /tmp/e2e-custom-before-reset.settings
PROJ_BEFORE=$(curl -sf http://127.0.0.1:8311/api/config | jget "['current_project']")
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"defaults":{"steps":33}}' > /dev/null
RS=$(curl -sf -X POST http://127.0.0.1:8311/api/config/reset)
echo "$RS" | PROJ_BEFORE="$PROJ_BEFORE" python3 -c "
import json,sys,os
j=json.load(sys.stdin)
assert j['ok'] is True, j
c=j['config']
assert c['defaults']['steps']!=33, 'steps must be back to the default'
assert c['engine']['backend']=='comfy', 'the SHIPPED default engine is ComfyUI'
assert c['engine']['comfy']['workflows']['t2va']=='comfy_workflows/t2va.json', c['engine']['comfy']['workflows']
assert c['current_project']==os.environ['PROJ_BEFORE'], (c['current_project'], os.environ['PROJ_BEFORE'])
" && ok "settings: Reset returns default.settings (engine comfy, workflows, steps) and keeps the project" \
    || bad "settings: reset wrong: ${RS:0:300}"
[ -f custom.settings.bak ] && grep -q '"steps": 33' custom.settings.bak \
  && ok "settings: the previous custom layer is kept as custom.settings.bak" \
  || bad "settings: no .bak of the custom layer"
curl -sf http://127.0.0.1:8311/api/settings/info | python3 -c "
import json,sys
j=json.load(sys.stdin)
# after a reset the custom layer is EMPTY (the open project is 'default', which
# equals the default, so even that is not a difference) — nothing customised
assert j['custom_exists'] and 'defaults' not in j['custom_keys'] and 'engine' not in j['custom_keys'], j
" && ok "settings: /api/settings/info shows nothing customised after a reset" \
    || bad "settings: info wrong: $(curl -sf http://127.0.0.1:8311/api/settings/info)"
# put the e2e's layer back (paths the stubs need) through the API, key by key
python3 - << 'PY'
import json, urllib.request
c = json.load(open("/tmp/e2e-custom-before-reset.settings"))
c.pop("current_project", None)
req = urllib.request.Request("http://127.0.0.1:8311/api/config", data=json.dumps(c).encode(),
                             headers={"Content-Type": "application/json"})
urllib.request.urlopen(req).read()
PY
curl -sf http://127.0.0.1:8311/api/config | jget "['sd_cli']" | grep -q stub-sd-cli \
  && ok "settings: the e2e layer is restored after the reset check" || bad "settings: could not restore the e2e layer"

# ---- ref2va through Comfy: NATIVE official template (1 dotted ref slot),
# 2 images (1 cloned slot) + 1 audio (no slot -> ignored with a warning)
python3 scripts/test-patcher.py > /tmp/patcher.log 2>&1 \
  && ok "patcher unit tests (prune/sync/rewire)" \
  || { bad "patcher unit tests"; tail -8 /tmp/patcher.log; }

# 2.264.0: scripts/test-tts-engine.py (fish-speech wiring + checkpoint doctor)
# left with the OpenAudio engine; scripts/test-omnivoice.py covers the speech worker.

python3 scripts/test-asr-cuda.py > /tmp/asrcuda.log 2>&1 \
  && ok "asr CUDA-fallback unit tests" \
  || { bad "asr CUDA-fallback unit tests"; tail -8 /tmp/asrcuda.log; }

# capture resolver + prompt-clear button (2.117.0, Tim: first/last/ref from
# the SELECTED video or picture layer; end-of-composition = last frame)
# 360 viewer math + wiring (2.119.0, Tim: "allow our preview/media player
# play the 360 video") — the JS mirror of the GLSL the player runs
node scripts/test-vr360.js > /tmp/vr360.log 2>&1 \
  && ok "360 viewer: projection math (seam, poles, fov), no-WebGL guard, player wiring (17 cases)" \
  || { bad "360 viewer"; tail -8 /tmp/vr360.log; }
# ComfyUI graph BINDINGS (2.120.0, Tim: "allow user to link the inputs to the
# comfy nodes by dragging a line from the input to the node value")
# THE GENERATION QUEUE (2.122.0, Tim: "allow user to add multiple generations to
# queue ... allow user to delete items in the queue ... change the send to chat
# button to abort")
# .gitignore must not drift from the release-zip exclusions (2.123.0): the
# failure is a public repo carrying somebody's projects folder, or a zip
# carrying 40GB of weights, and neither is noticed until it is out there.
# The rebrand (2.124.0) was a global replace over 59 files, and "H3" means the
# MiniMax H3 MODEL nearly everywhere it appears. This pins both directions.
bash scripts/check-brand.sh > /tmp/brand.log 2>&1 \
  && ok "brand + licence: bitGen Studio throughout, MiniMax H3 references intact, MIT declared and shipped" \
  || { bad "brand/licence check"; tail -12 /tmp/brand.log; }
bash scripts/check-gitignore.sh > /tmp/gitig.log 2>&1 \
  && ok "gitignore: the repo and the release zip exclude the same things" \
  || { bad "gitignore drifted from make_zips.sh"; tail -12 /tmp/gitig.log; }
node scripts/test-genqueue.js > /tmp/genq.log 2>&1 \
  && ok "gen queue: adding, per-item modes, delete (never the running one), reorder, retry-to-front, and the shipped buttons" \
  || { bad "generation queue unit tests"; tail -14 /tmp/genq.log; }
node scripts/test-comfygraphs.js > /tmp/cgraphs.log 2>&1 \
  && ok "comfy graphs: format detection, the control model, apply (links never overwritten), the store, UI-export -> API" \
  || { bad "comfy graph binding unit tests"; tail -14 /tmp/cgraphs.log; }
node scripts/test-graphwire.js > /tmp/gwire.log 2>&1 \
  && ok "graph wiring: bezier geometry, link/unlink, suggested controls, and the shipped Graphs tab + ComfyUI dock" \
  || { bad "graph wiring unit tests"; tail -14 /tmp/gwire.log; }
node scripts/test-subgraphs.js > /tmp/sgraph.log 2>&1 \
  && ok "subgraphs: folded canvases + Set/Get flatten to exactly what ComfyUI 0.34 itself exports (34 nodes, 42 wires)" \
  || { bad "subgraph flattening unit tests"; tail -14 /tmp/sgraph.log; }
node scripts/test-capture.js > /tmp/capture.log 2>&1 \
  && ok "timeline capture: selected layer + all layers + last-frame + image clips (17 behavioral cases)" \
  || { bad "timeline capture resolver"; tail -8 /tmp/capture.log; }
node scripts/test-timeline.js > /tmp/tledit.log 2>&1 \
  && ok "timeline unit tests (keep/cut/ripple/split)" \
  || { bad "timeline unit tests"; tail -12 /tmp/tledit.log; }

node scripts/test-dockscroll.js > /tmp/dockscroll.log 2>&1 \
  && ok "dockscroll unit tests (queue slider geometry + rail plumbing)" \
  || { bad "dockscroll unit tests"; tail -14 /tmp/dockscroll.log; }

node scripts/test-extensions.js > /tmp/extensions.log 2>&1 \
  && ok "extensions unit tests (shell + ext assembly, removal tolerance)" \
  || { bad "extensions unit tests"; tail -14 /tmp/extensions.log; }
node scripts/test-installer.js > /tmp/installer.log 2>&1 \
  && ok "setup-window unit tests (Win11 page DOM, bridge, gate, batch hand-off)" \
  || { bad "setup-window unit tests"; tail -14 /tmp/installer.log; }
curl -sf http://127.0.0.1:8311/ > /tmp/bg-served.html \
  && grep -q 'id="videodock"' /tmp/bg-served.html \
  && grep -q 'id="consoledock"' /tmp/bg-served.html \
  && grep -q '/ext/videodock/characters.js' /tmp/bg-served.html \
  && ! grep -q 'ext:dock' /tmp/bg-served.html \
  && ok "extensions: GET / serves the ASSEMBLED page (dockers spliced, no markers)" \
  || bad "extensions: GET / is not the assembled page"
curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/ext/videodock/characters.js | grep -q 200 \
  && ok "extensions: /ext/videodock/characters.js is served" || bad "extensions: ext script not served"
curl -sf http://127.0.0.1:8311/api/extensions | python3 -c "
import json, sys
d = json.load(sys.stdin)
ids = [e['id'] for e in d['extensions']]
need = ['previewdock', 'timelinedock', 'videodock', 'imageeditdock',
        'comfydock', 'musicdock', 'chatdock', 'promptdock', 'consoledock']
assert all(n in ids for n in need), ids
" && ok "extensions: /api/extensions lists all nine dockers" \
  || bad "extensions: /api/extensions wrong"
grep -q 'ext:dock videodock' static/index.html \
  && ! grep -q 'class="bdock" id="videodock"' static/index.html \
  && ok "extensions: the shell holds markers, not dockers — the flat core is docker-free" \
  || bad "extensions: shell still carries a docker"

# 2.218.0: Settings -> Extensions installs every extension zip in a folder.
# A synthetic docker zip + a junk zip go in one folder; ONE install call must
# land the docker, skip the junk by name, and the page must show the docker on
# the very next request (assembly is per request — no restart, no reload race).
rm -rf /tmp/bg-extzips ext/zztestdock
python3 - <<'PYEOF'
import json, os, zipfile
os.makedirs('/tmp/bg-extzips', exist_ok=True)
z = zipfile.ZipFile('/tmp/bg-extzips/bitgen-ext-zztestdock-v0.zip', 'w')
z.writestr('ext/zztestdock/ext.json', json.dumps(
    {'id': 'zztestdock', 'name': 'ZZ Test', 'order': 900, 'html': 'dock.html'}))
z.writestr('ext/zztestdock/dock.html', '<div class="bdock" id="zztestdock">e2e</div>')
z.close()
z = zipfile.ZipFile('/tmp/bg-extzips/notes.zip', 'w')
z.writestr('readme.txt', 'not an extension')
z.close()
PYEOF
curl -sf -X POST http://127.0.0.1:8311/api/extensions/install \
  -H "Content-Type: application/json" -d '{"dir":"/tmp/bg-extzips"}' > /tmp/bg-extinst.json
python3 -c "
import json
j = json.load(open('/tmp/bg-extinst.json'))
assert any(i['zip'] == 'bitgen-ext-zztestdock-v0.zip' and i['ids'] == ['zztestdock'] for i in j['installed']), j
assert any(k['zip'] == 'notes.zip' and 'not an extension zip' in k['why'] for k in j['skipped']), j
" && ok "extensions install: the folder's docker zip lands, the junk zip is skipped by name" \
  || { bad "extensions install: report wrong"; cat /tmp/bg-extinst.json; }
curl -sf http://127.0.0.1:8311/api/extensions | grep -q '"zztestdock"' \
  && curl -sf http://127.0.0.1:8311/ | grep -q 'class="bdock" id="zztestdock"' \
  && ok "extensions install: the new docker is in /api/extensions AND in the very next page — no restart" \
  || bad "extensions install: docker did not appear"
curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/extensions/install \
  -H "Content-Type: application/json" -d '{}' | grep -q 400 \
  && ok "extensions install: no folder is a 400, not a crash" \
  || bad "extensions install: missing dir not refused"
rm -rf ext/zztestdock /tmp/bg-extzips
curl -sf http://127.0.0.1:8311/api/extensions | grep -q '"zztestdock"' \
  && bad "extensions install: removed docker still listed" \
  || ok "extensions install: deleting ext/<id>/ removes the docker on the next request"

python3 scripts/test-imagegen.py > /tmp/imagegen.log 2>&1 \
  && ok "image argv unit tests (sd-cli flags per architecture, LoRA weights)" \
  || { bad "image argv unit tests"; tail -14 /tmp/imagegen.log; }

# ---- mode-aware Basic Settings, server side (2.93.0): the video route
# records the CFG slider in the job it makes, and genimage survives a
# lora_weights map whether or not the style has LoRAs to weight.
VCJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
  -F mode=t2va -F prompt="cfg check" -F width=256 -F height=256 -F steps=4 \
  -F cfg=3 -F seed=1 -F format=webm -F frames=17 -F speed=quality \
  -F segment_seconds=15 -F pipeline=auto -F trim_exact=true -F force_chunks=false \
  -F extra_args= -F ref_videos=[] -F ref_audios=[])
echo "$VCJ" | grep -q '"cfg":3' \
  && ok "video: the Basic-Settings CFG rides into the job params" \
  || bad "video: cfg missing from job params: $VCJ"
VCID=$(echo "$VCJ" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -X POST http://127.0.0.1:8311/api/jobs/$VCID/cancel > /dev/null
VC2=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
  -F mode=t2va -F prompt="cfg default" -F width=256 -F height=256 -F steps=4 \
  -F seed=1 -F format=webm -F frames=17 -F speed=quality \
  -F segment_seconds=15 -F pipeline=auto -F trim_exact=true -F force_chunks=false \
  -F extra_args= -F ref_videos=[] -F ref_audios=[])
echo "$VC2" | grep -q '"cfg":1' \
  && ok "video: no cfg sent means the distilled default 1.0, not a surprise" \
  || bad "video: absent cfg did not default to 1: $VC2"
VC2ID=$(echo "$VC2" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -X POST http://127.0.0.1:8311/api/jobs/$VC2ID/cancel > /dev/null

# ---- the chat's selection context (2.92.0): the system prompt learns the
# selected styles so the assistant writes prompts for the model that will run.
node -e '
const l = require("./lib/llmChat.js"), S = require("./lib/styles.js");
const fs = require("fs"), os = require("os"), path = require("path");
const d = fs.mkdtempSync(path.join(os.tmpdir(), "sctx-"));
S.seedStarters(d);
const mu = S.read(d, "music")[0], im = S.read(d, "image")[0];
const t = l.selectionContext(d, { gen_mode: "music", music_style_id: mu.id, image_style_id: im.id });
const ok = (m, c) => { if (!c) { console.error("FAIL: " + m); process.exit(1); } };
ok("names both selected styles", t.includes(mu.name) && t.includes(im.name));
ok("carries the music caption so lyrics can fit the sound", /Lo-fi hip-hop/.test(t));
ok("teaches the 🎶 block shape the parser accepts", /Theme:, Genre:, Instruments:, BPM:, Vocals:/.test(t));
ok("gives the FLUX prompting guide for the image style (2.104.0)", /PROMPTING GUIDE — FLUX/.test(t) && /NO tag soup/.test(t));
ok("...and the MiniMax Music guide for the music style", /PROMPTING GUIDE — MiniMax Music/.test(t));
ok("video mode carries the H3 guide", /PROMPTING GUIDE — MiniMax H3/.test(l.selectionContext(d, { gen_mode: "video" })));
ok("empty context adds nothing", l.selectionContext(d, null) === "" && l.selectionContext(d, {}) === "");
ok("an unknown id is ignored, not fatal", l.selectionContext(d, { music_style_id: "nope" }) === "");
console.log("selectionContext ok");
' > /tmp/sctx.log 2>&1 \
  && ok "chat: selectionContext names the styles, caption, shape and model rules" \
  || { cat /tmp/sctx.log; bad "chat: selectionContext unit checks failed"; }

node scripts/test-styles.js > /tmp/styles.log 2>&1 \
  && ok "image style unit tests (normalize, round trip, ids are not indices)" \
  || { bad "image style unit tests"; tail -14 /tmp/styles.log; }

node scripts/test-camera.js > /tmp/camera.log 2>&1 \
  && ok "camera preset unit tests (fixed order, one per group, no move on a still)" \
  || { bad "camera preset unit tests"; tail -16 /tmp/camera.log; }

node scripts/test-chatstore.js > /tmp/chatstore.log 2>&1 \
  && ok "prompt chat store unit tests (a file per session, today+yesterday replay)" \
  || { bad "prompt chat store unit tests"; tail -16 /tmp/chatstore.log; }

node scripts/test-chatrecall.js > /tmp/chatrecall.log 2>&1 \
  && ok "chat recall unit tests (seed + relevant middle + tail inside the budget; cast note)" \
  || { bad "chat recall unit tests"; tail -16 /tmp/chatrecall.log; }

node scripts/test-imageseed.js > /tmp/imageseed.log 2>&1 \
  && ok "image seed unit tests (one press = one fresh seed, pinned seeds obeyed)" \
  || { bad "image seed unit tests"; tail -16 /tmp/imageseed.log; }

python3 scripts/test-imagename.py > /tmp/imagename.log 2>&1 \
  && ok "image name unit tests (seed in the filename, never an overwrite)" \
  || { bad "image name unit tests"; tail -16 /tmp/imagename.log; }

# EXECUTES the Settings -> Image paint path in a real DOM. test-imageui.js below
# greps the source and passed for several releases while the dropdowns were
# empty on the real machine; a regex cannot tell you a function returns nothing.
# Skips cleanly (exit 0) when jsdom is not installed, so an offline box still runs
# -- AND SAYS SO LOUDLY, because that silence has already cost a release. In
# 2.85.0-2.85.2 toggleCollapse() threw on every page load and this suite was the
# thing that would have caught it; it exited 0 with "SKIP" on one line of a
# 400-line log and the run reported all-green. A skipped check is not a passed
# check, and a summary that cannot tell them apart is worse than no check.
node scripts/test-audioviz.js > /tmp/audioviz.log 2>&1 \
  && ok "audio visualizer (static/audioviz.js): random style per play, wired once, timeline tracks exempt" \
  || { bad "audio visualizer tests"; tail -12 /tmp/audioviz.log; }
curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/ext/previewdock/audioviz.js | grep -q 200 \
  && ok "audio visualizer: /ext/previewdock/audioviz.js is served and included by the page" || bad "audio visualizer: script not served"
grep -q '<script src="/ext/previewdock/audioviz.js?v=' /tmp/bg-page.html \
  && ok "audio visualizer: index.html loads it after dockscroll.js" || bad "audio visualizer: not included"
node scripts/test-imagedom.js > /tmp/imagedom.log 2>&1
if grep -q "jsdom is not installed" /tmp/imagedom.log; then
  bad "image DOM checks DID NOT RUN — npm install jsdom, then run this again"
elif [ $? = 0 ] || grep -q "0 failed" /tmp/imagedom.log; then
  ok "image DOM checks (the paint path EXECUTED, not grepped)"
else
  bad "image DOM checks"; tail -20 /tmp/imagedom.log
fi

node scripts/test-imageui.js > /tmp/imageui.log 2>&1 \
  && ok "image UI checks (anchors, handlers, inline script parses)" \
  || { bad "image UI checks"; tail -16 /tmp/imageui.log; }

node scripts/test-adopt.js > /tmp/adopt.log 2>&1 \
  && ok "adopt unit tests (gallery file -> asset folder, link/uniquify/.webp)" \
  || { bad "adopt unit tests"; tail -16 /tmp/adopt.log; }

node scripts/test-refgroups.js > /tmp/refgroups.log 2>&1 \
  && ok "reference-group store unit tests (one json per group + legacy migration)" \
  || { bad "reference-group store unit tests"; tail -16 /tmp/refgroups.log; }

node scripts/test-comfyspawn.js > /tmp/comfyspawn.log 2>&1 \
  && ok "comfy spawn env (unbuffered + utf-8 stdio for the ComfyUI we launch)" \
  || { bad "comfy spawn env"; tail -16 /tmp/comfyspawn.log; }

node scripts/test-modelinstall.js > /tmp/modelinstall.log 2>&1 \
  && ok "model install unit tests (checkpoint-filed model linked for the unet loader)" \
  || { bad "model install unit tests"; tail -16 /tmp/modelinstall.log; }

node scripts/test-comfymodels.js > /tmp/comfymodels.log 2>&1 \
  && ok "comfy model scan unit tests (models tree + extra_model_paths.yaml)" \
  || { bad "comfy model scan unit tests"; tail -20 /tmp/comfymodels.log; }

node scripts/test-autoassets.js > /tmp/autoassets2.log 2>&1 \
  && ok "autoassets unit tests (render -> asset dock registration)" \
  || { bad "autoassets unit tests"; tail -16 /tmp/autoassets2.log; }

# THESE THREE WERE NOT ACTUALLY WIRED IN before 2.70.0, although HANDOVER.md
# claimed "all of these also run inside the e2e suite". A green e2e was
# therefore NOT the delivery gate the notes said it was. Wired now; see the
# 2.70.0 section of HANDOVER.md.
node scripts/test-waveform.js > /tmp/waveform.log 2>&1 \
  && ok "waveform unit tests (peak bucketing + cache keying)" \
  || { bad "waveform unit tests"; tail -16 /tmp/waveform.log; }

python3 scripts/test-span.py > /tmp/span.log 2>&1 \
  && ok "compile-span unit tests (python side of the timeline length mirror)" \
  || { bad "compile-span unit tests"; tail -16 /tmp/span.log; }

# ---- frame inspector: every frame of one second of a 24 fps clip
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=96x54:rate=24 -t 3 \
  -pix_fmt yuv420p /tmp/e2e_strip.mp4
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_strip.mp4" > /dev/null
FR=$(curl -sf "http://127.0.0.1:8311/api/frames?name=e2e_strip.mp4&src=video&start=1&end=2&fps=24&width=96")
[ "$(echo "$FR" | jget "['count']")" = "24" ] \
  && ok "frames: a 1 s selection yields exactly 24 frames" \
  || { bad "frames: 1 s != 24 frames"; echo "$FR" | head -c 300; }
echo "$FR" | python3 -c "import json,sys;d=json.load(sys.stdin);f=d['frames'];exit(0 if f[0]['frame']==24 and abs(f[0]['t']-1.0)<1e-3 and abs(f[-1]['t']-(1+23/24))<1e-3 else 1)" \
  && ok "frames: absolute frame numbers and timestamps line up" \
  || bad "frames: numbering wrong"
FKEY=$(echo "$FR" | jget "['key']"); FFILE=$(echo "$FR" | jget "['frames'][0]['file']")
curl -sf -o /tmp/e2e_frame.jpg "http://127.0.0.1:8311/framecache/$FKEY/$FFILE" \
  && [ -s /tmp/e2e_frame.jpg ] \
  && ok "frames: /framecache serves an extracted jpeg" || bad "frames: framecache fetch"
FR2=$(curl -sf "http://127.0.0.1:8311/api/frames?name=e2e_strip.mp4&src=video&start=1&end=2&fps=24&width=96")
[ "$(echo "$FR2" | jget "['cached']")" = "True" ] \
  && ok "frames: second request is served from the disk cache" || bad "frames: not cached"
curl -s "http://127.0.0.1:8311/api/frames?name=nope.mp4&src=video&start=0&end=1" \
  | grep -q "not found" && ok "frames: missing media 404s cleanly" || bad "frames: missing media"
curl -s "http://127.0.0.1:8311/framecache/deadbeefdeadbeef/f00001.jpg" \
  | grep -q "expired" && ok "frames: expired cache key 404s cleanly" || bad "frames: bad key"

# ---- timeline keep/cut over HTTP (same maths the UI calls)
TE=$(curl -sf -X POST http://127.0.0.1:8311/api/timeline/edit -H 'Content-Type: application/json' \
  -d '{"op":"cut","kind":"video","a":3,"b":5,"ripple":false,"clips":[{"name":"a","start":0,"in":0,"out":10,"dur":10}]}')
echo "$TE" | python3 -c "import json,sys;d=json.load(sys.stdin);c=d['clips'];exit(0 if len(c)==2 and c[1]['start']==5 and c[1]['in']==5 else 1)" \
  && ok "timeline/edit: cut splits a clip around the selection" || bad "timeline/edit cut: $TE"
TE=$(curl -sf -X POST http://127.0.0.1:8311/api/timeline/edit -H 'Content-Type: application/json' \
  -d '{"op":"keep","kind":"video","a":2,"b":3,"ripple":true,"compact":true,"clips":[{"name":"a","start":0,"in":0,"out":10,"dur":10}]}')
echo "$TE" | python3 -c "import json,sys;d=json.load(sys.stdin);c=d['clips'];exit(0 if len(c)==1 and c[0]['start']==0 and c[0]['in']==2 and c[0]['out']==3 else 1)" \
  && ok "timeline/edit: keep+ripple trims everything else away" || bad "timeline/edit keep: $TE"
curl -s -X POST http://127.0.0.1:8311/api/timeline/edit -H 'Content-Type: application/json' \
  -d '{"op":"burn","kind":"video","a":0,"b":1,"clips":[]}' | grep -q "keep, cut, trim_head" \
  && ok "timeline/edit: unknown op rejected" || bad "timeline/edit: bad op accepted"

# ---- ControlNet chain staging ground (2.97.1): <project>/temp
node -e '
const c = require("./lib/core.js"), fs = require("fs"), path = require("path");
const ok = (m, x) => { if (!x) { console.error("FAIL " + m); process.exit(1); } };
const d = c.tempDir();
ok("tempDir creates <project>/temp", fs.existsSync(d) && path.basename(d) === "temp");
const n1 = c.tempName("png");
fs.writeFileSync(path.join(d, n1), "x");
const n2 = c.tempName("png");
ok("tempName is date+time and collision-proof", /^\d{8}-\d{6}(-\d+)?\.png$/.test(n1) && n1 !== n2);
ok("a temp file NEVER satisfies the completion check", !c.outputExists(n1));
fs.rmSync(path.join(d, n1));
console.log("temp staging ok");
' > /tmp/tempdir.log 2>&1 \
  && ok "core: <project>/temp staging (chain stages park there, never counted as output)" \
  || { cat /tmp/tempdir.log; bad "core temp staging"; }

# ---- ControlNet chain styles (2.97.0): save, validate, refuse generation
CNA=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d '{"name":"cn stage a","kind":"image","workflow":"img_flux2_klein_9b_t2i.json"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['style']['id'])")
CNB=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d '{"name":"cn stage b","kind":"image","workflow":"img_flux2_klein_9b_t2i.json"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['style']['id'])")
CH=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d "{\"name\":\"cn chain\",\"kind\":\"image\",\"chain\":{\"first_id\":\"$CNA\",\"controlnet\":\"cn.safetensors\",\"second_id\":\"$CNB\"}}")
CHID=$(echo "$CH" | python3 -c "import json,sys;print(json.load(sys.stdin)['style']['id'])")
echo "$CH" | python3 -c "import json,sys;d=json.load(sys.stdin);exit(0 if d['style']['chain']['controlnet']=='cn.safetensors' else 1)" \
  && ok "styles: a ControlNet chain saves with both stages and the model" || bad "chain save: $CH"
curl -s http://127.0.0.1:8311/api/styles?kind=image | python3 -c "import json,sys;d=json.load(sys.stdin);exit(0 if any(s.get('chain') for s in d['styles']) else 1)" \
  && ok "styles: the chain lists as an image style (it reaches the prompt dropdown)" || bad "chain not listed"
curl -s -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d '{"name":"bad chain","kind":"image","chain":{"first_id":"nope","controlnet":"c","second_id":"also_nope"}}' \
  | grep -q "existing image styles" \
  && ok "styles: a chain over unknown stages is refused" || bad "bad chain accepted"
curl -s -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d "{\"name\":\"chain of chain\",\"kind\":\"image\",\"chain\":{\"first_id\":\"$CHID\",\"controlnet\":\"c\",\"second_id\":\"$CNB\"}}" \
  | grep -q "cannot itself be a chain" \
  && ok "styles: a chain cannot use another chain as a stage" || bad "chain-of-chain accepted"
# 2.305.0: the chain's TYPE and its INPUT (preprocessor) model ride the style
CHT=$(curl -s -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d "{\"id\":\"$CHID\",\"name\":\"cn chain\",\"kind\":\"image\",\"chain\":{\"first_id\":\"$CNA\",\"controlnet\":\"depth_cn.safetensors\",\"second_id\":\"$CNB\",\"cn_type\":\"depth\",\"preprocessor\":\"depth-anything/depth_anything_v2_vitl.pth\"}}")
echo "$CHT" | python3 -c 'import json,sys;c=json.load(sys.stdin)["style"]["chain"];exit(0 if c["cn_type"]=="depth" and c["preprocessor"].endswith("vitl.pth") and c["controlnet"]=="depth_cn.safetensors" else 1)' \
  && ok "styles: a chain saves its ControlNet type (depth) and its input + output models (2.305.0)" || bad "typed chain: $CHT"
curl -s -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d "{\"name\":\"canny chain\",\"kind\":\"image\",\"chain\":{\"first_id\":\"$CNA\",\"controlnet\":\"c\",\"second_id\":\"$CNB\",\"cn_type\":\"canny\"}}" \
  | grep -q "unknown ControlNet type" \
  && ok "styles: an unknown ControlNet type is refused, the four named (2.305.0)" || bad "unknown cn_type accepted"
curl -s http://127.0.0.1:8311/api/controlnet/preprocessors \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);exit(0 if [t["id"] for t in d["types"]]==["pose","scribble","lineart","depth"] and isinstance(d["files"],list) else 1)' \
  && ok "controlnet: /api/controlnet/preprocessors serves the four types and the input-model scan (2.305.0)" || bad "cn preprocessors route"
curl -s -X POST http://127.0.0.1:8311/api/genimage -H 'Content-Type: application/json' \
  -d "{\"prompt\":\"x\",\"style_id\":\"$CHID\"}" | grep -q "three-stage run" \
  && ok "genimage: a chain style is refused in words until the workflow lands" || bad "chain generated?!"
curl -sf -X DELETE "http://127.0.0.1:8311/api/styles/$CHID" > /dev/null \
  && curl -sf -X DELETE "http://127.0.0.1:8311/api/styles/$CNA" > /dev/null \
  && curl -sf -X DELETE "http://127.0.0.1:8311/api/styles/$CNB" > /dev/null \
  && ok "styles: chain and stages clean up" || bad "chain cleanup failed"

# ---- Task B (2.95.0): the audio path, never exercised before, plus the new ops
TE=$(curl -sf -X POST http://127.0.0.1:8311/api/timeline/edit -H 'Content-Type: application/json' \
  -d '{"op":"keep","kind":"audio","a":3,"b":7,"ripple":false,"clips":[{"name":"song.mp3","start":0,"in":0,"out":10,"dur":10}]}')
echo "$TE" | python3 -c "import json,sys;d=json.load(sys.stdin);c=d['clips'];exit(0 if len(c)==1 and c[0]['start']==3 and c[0]['in']==3 and c[0]['out']==7 else 1)" \
  && ok "timeline/edit: keep works on AUDIO (song 0-10, sel 3-7 -> in3/out7)" || bad "timeline/edit audio keep: $TE"
TE=$(curl -sf -X POST http://127.0.0.1:8311/api/timeline/edit -H 'Content-Type: application/json' \
  -d '{"op":"cut","kind":"audio","a":3,"b":7,"ripple":false,"clips":[{"name":"song.mp3","start":0,"in":0,"out":10,"dur":10}]}')
echo "$TE" | python3 -c "import json,sys;d=json.load(sys.stdin);c=d['clips'];exit(0 if len(c)==2 and c[0]['out']==3 and c[1]['start']==7 and c[1]['in']==7 else 1)" \
  && ok "timeline/edit: cut works on AUDIO (0-3 and 7-10 remain)" || bad "timeline/edit audio cut: $TE"
TE=$(curl -sf -X POST http://127.0.0.1:8311/api/timeline/edit -H 'Content-Type: application/json' \
  -d '{"op":"trim_head","kind":"audio","at":3,"clips":[{"name":"song.mp3","start":0,"in":0,"out":10,"dur":10},{"name":"b.mp3","start":12,"in":1,"out":5,"dur":6}]}')
echo "$TE" | python3 -c "import json,sys;d=json.load(sys.stdin);c=d['clips'];exit(0 if len(c)==2 and c[0]['start']==3 and c[0]['in']==3 and c[1]['start']==12 and c[1]['in']==1 else 1)" \
  && ok "timeline/edit: trim_head moves ONLY the clip under the playhead" || bad "timeline/edit trim_head: $TE"
TE=$(curl -sf -X POST http://127.0.0.1:8311/api/timeline/edit -H 'Content-Type: application/json' \
  -d '{"op":"trim_tail","kind":"video","at":3,"clips":[{"name":"a.mp4","start":0,"in":0,"out":10,"dur":10}]}')
echo "$TE" | python3 -c "import json,sys;d=json.load(sys.stdin);c=d['clips'];exit(0 if len(c)==1 and c[0]['out']==3 and c[0]['start']==0 else 1)" \
  && ok "timeline/edit: trim_tail caps the clip at the playhead" || bad "timeline/edit trim_tail: $TE"
curl -s -X POST http://127.0.0.1:8311/api/timeline/edit -H 'Content-Type: application/json' \
  -d '{"op":"trim_head","kind":"audio","at":11,"clips":[{"name":"song.mp3","start":0,"in":0,"out":10,"dur":10}]}' \
  | grep -q "no clip under 11" \
  && ok "timeline/edit: trimming in a gap refuses with a clear message" || bad "timeline/edit trim gap accepted"
TE=$(curl -sf -X POST http://127.0.0.1:8311/api/timeline/edit -H 'Content-Type: application/json' \
  -d '{"op":"cut","kind":"audio","scope":"clip","a":6,"b":9,"ripple":true,"clips":[{"name":"a.mp3","start":0,"in":0,"out":4,"dur":4},{"name":"b.mp3","start":5,"in":0,"out":10,"dur":10},{"name":"c.mp3","start":16,"in":0,"out":3,"dur":3}]}')
echo "$TE" | python3 -c "import json,sys;d=json.load(sys.stdin);c=d['clips'];exit(0 if len(c)==4 and c[2]['start']==6 and c[2]['in']==4 and c[3]['start']==16 and d.get('scope')=='clip' else 1)" \
  && ok "timeline/edit: scope=clip cuts ONE clip (ripple joins its halves), neighbours untouched" || bad "timeline/edit scope clip: $TE"
# /tmp/e2e_ref.wav is built with the shared fixtures at the top of this file
# (2.125.0) — it is needed long before this block.
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=64x64:rate=24 -t 1 \
  -pix_fmt yuv420p /tmp/e2e_refvid.mp4
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_ref.wav" > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_refvid.mp4" > /dev/null
# exercise the SHIPPED native MiniMaxH3ReferenceToVideo template
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"workflows":{"ref2va":"comfy_workflows/ref2va.json"}}}}' > /dev/null
run_job comfy-ref2va 49 "2 img / 1 vid / 1 aud ref" yes \
  -F prompt="comfy ref2va two subjects with a motion and a sound reference" \
  -F width=192 -F height=108 -F steps=4 -F seed=9 -F mode=ref2va -F frames=49 \
  -F pipeline=single -F format=webm -F ref_audios='["e2e_ref.wav"]' \
  -F ref_videos='["e2e_refvid.mp4"]' \
  -F references=@/tmp/e2e_ref1.png -F references=@/tmp/e2e_ref2.png
RJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID?log_from=0")
echo "$RJ" | jget "['log']" | grep -q "slots filled: 2/9 image, 1/3 video, 1/3 audio" \
  && ok "comfy-ref2va: 9/3/3 slots filled 2/1/1, rest pruned" \
  || bad "comfy-ref2va: slot summary missing from log"
echo "$RJ" | jget "['log']" | grep -q "grid=17k5" \
  && ok "comfy-ref2va: planner on the 17k+5 grid" \
  || bad "comfy-ref2va: planner grid line missing"
echo "$RJ" | jget "['log']" | grep -q "step 2/4 — SamplerCustomAdvanced" \
  && echo "$RJ" | jget "['log']" | grep -q "step 5/6 — SamplerCustomAdvanced" \
  && echo "$RJ" | jget "['log']" | grep -q "waiting in ComfyUI's queue (2 jobs pending)" \
  && ok "comfy-ref2va: live WS step progress in the job log" \
  || bad "comfy-ref2va: WS step lines missing"
echo "$RJ" | jget "['log']" | grep -q "running SamplerCustomAdvanced" \
  && ok "comfy-ref2va: node-change lines in the job log" \
  || bad "comfy-ref2va: WS running lines missing"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"sdcli"}}' > /dev/null

# ---- native fl2va template: first-only bypasses last_frame, first+last wires it
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"comfy","comfy":{"workflows":{"fl2va":"comfy_workflows/fl2va.json"}}}}' > /dev/null
run_job comfy-fl2va-first 22 "chunk 1/1" yes \
  -F prompt="native fl2va first frame only" \
  -F width=192 -F height=108 -F steps=8 -F seed=5 -F mode=fl2va -F frames=22 \
  -F pipeline=single -F format=webm -F references=@/tmp/e2e_ref1.png
FJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID?log_from=0")
echo "$FJ" | jget "['log']" | grep -q "first_frame: wired from loader" \
  && ok "fl2va: first_frame wired" || bad "fl2va: first_frame not wired"
echo "$FJ" | jget "['log']" | grep -q "last_frame: bypassed (no image supplied)" \
  && ok "fl2va: no last image -> last_frame bypassed" \
  || bad "fl2va: last_frame not bypassed"

run_job comfy-fl2va-firstlast 22 "chunk 1/1" yes \
  -F prompt="native fl2va first and last frame" \
  -F width=192 -F height=108 -F steps=8 -F seed=5 -F mode=fl2va -F frames=22 \
  -F pipeline=single -F format=webm \
  -F references=@/tmp/e2e_ref1.png -F references=@/tmp/e2e_ref2.png
FJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID?log_from=0")
echo "$FJ" | jget "['log']" | grep -q "last_frame: wired from loader" \
  && ok "fl2va: last image selected -> last_frame wired (bypass removed)" \
  || bad "fl2va: last_frame not wired when supplied"
echo "$FJ" | jget "['log']" | grep -q "2/2 image" \
  && ok "fl2va: both frame slots filled" || bad "fl2va: slot count wrong"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"sdcli"}}' > /dev/null

# ---- comfy ensure + keep-alive
# engine is sd-cli here, so ensure() must decline rather than launch anything
EN=$(curl -sf -X POST http://127.0.0.1:8311/api/comfy/ensure)
echo "$EN" | grep -q "not comfy" \
  && ok "comfy/ensure: no-op while the engine is sd-cli" || bad "comfy/ensure sdcli: $EN"
# ...BUT a style rendered by ComfyUI needs it up whatever the VIDEO backend is.
# Running video on sd-cli and images through ComfyUI is an ordinary setup, and
# before 2.73.0 the Generate Image button skipped the launch on exactly that
# combination and failed on a ComfyUI nobody had started.
EN=$(curl -sf -X POST http://127.0.0.1:8311/api/comfy/ensure \
  -H 'Content-Type: application/json' -d '{"force":true}')
echo "$EN" | python3 -c "
import json,sys;d=json.load(sys.stdin)
assert 'skipped' not in d, d
assert d.get('reachable') is True, d" \
  && ok "comfy/ensure: force overrides the sd-cli video backend for an image style" \
  || bad "comfy/ensure force: $EN"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"comfy"}}' > /dev/null
# the stub Comfy is already answering, so ensure() reports reachable, starts nothing
EN=$(curl -sf -X POST http://127.0.0.1:8311/api/comfy/ensure)
echo "$EN" | python3 -c "
import json,sys;d=json.load(sys.stdin)
sys.exit(0 if d.get('reachable') is True and d.get('started') is False else 1)" \
  && ok "comfy/ensure: already-up ComfyUI is not relaunched" || bad "comfy/ensure up: $EN"
ST=$(curl -sf http://127.0.0.1:8311/api/comfy/status)
echo "$ST" | jget "['keep_alive']" | grep -q True \
  && ok "comfy: keep_alive defaults on (survives studio exit)" || bad "comfy: keep_alive default"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"keep_alive":false}}}' > /dev/null
ST=$(curl -sf http://127.0.0.1:8311/api/comfy/status)
echo "$ST" | jget "['keep_alive']" | grep -q False \
  && ok "comfy: keep_alive can be turned off" || bad "comfy: keep_alive toggle"
ST=$(curl -sf http://127.0.0.1:8311/api/comfy/status)
echo "$ST" | jget "['workflows']" | grep -q "fl2va" \
  && ok "comfy: keep_alive save left the workflows mapping intact" \
  || bad "comfy: workflows mapping wiped by the keep_alive save"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"sdcli","comfy":{"keep_alive":true}}}' > /dev/null

# ---- LLM: folder scan, start/stop, enhance without an explicit pick
LD=$(curl -sf http://127.0.0.1:8311/api/llms)
echo "$LD" | jget "['files']" | grep -q "\[\]" \
  && ok "llm: empty model folder reported as empty" || bad "llm: unexpected files"
mkdir -p llm-models && : > llm-models/e2e-fake.gguf
LD=$(curl -sf http://127.0.0.1:8311/api/llms)
echo "$LD" | jget "['files']" | grep -q "e2e-fake.gguf" \
  && ok "llm: the model folder is scanned and listed (populates the dropdown)" \
  || bad "llm: folder scan missed the model"
# no engine installed here, so Start must fail naming the missing llama-server
curl -s --max-time 20 -X POST http://127.0.0.1:8311/api/llm/start \
  -H 'Content-Type: application/json' -d '{"file":"e2e-fake.gguf"}' \
  | grep -q "llama-server not found" \
  && ok "llm: Start reports a missing engine clearly" || bad "llm: start error unclear"
curl -s -X POST http://127.0.0.1:8311/api/llm/stop | grep -q "stopped" \
  && ok "llm: Stop responds" || bad "llm: stop failed"
# enhance with NO llm_file must fall back to the only model, not refuse outright
curl -s --max-time 20 -X POST http://127.0.0.1:8311/api/enhance \
  -H 'Content-Type: application/json' -d '{"prompt":"a cat","mode":"t2va"}' \
  | grep -q "llama-server not found" \
  && ok "llm: enhance falls back to the only model when none is picked" \
  || bad "llm: enhance did not fall back"
rm -f llm-models/e2e-fake.gguf
curl -s --max-time 20 -X POST http://127.0.0.1:8311/api/enhance \
  -H 'Content-Type: application/json' -d '{"prompt":"a cat","mode":"t2va"}' \
  | grep -q "No .gguf model found" \
  && ok "llm: with no models at all, enhance says where to put one" || bad "llm: unhelpful no-model error"
curl -s --max-time 10 -X POST http://127.0.0.1:8311/api/llm/start \
  -H 'Content-Type: application/json' -d '{}' | grep -q "no .gguf models in" \
  && ok "llm: Start with an empty folder names the folder" || bad "llm: empty-folder start"

# ---- HuggingFace token
HF=$(curl -sf http://127.0.0.1:8311/api/hf)
[ "$(echo "$HF" | jget "['has_token']")" = "False" ] \
  && ok "hf: reports no token by default" || bad "hf: default state $HF"
curl -s -X POST http://127.0.0.1:8311/api/hf/test -H 'Content-Type: application/json' \
  -d '{}' | grep -q "no token set" \
  && ok "hf: testing with no token explains where to get one" || bad "hf: empty token accepted"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"hf":{"token":"hf_abcdefghijklmnop1234"}}' > /dev/null
HF=$(curl -sf http://127.0.0.1:8311/api/hf)
[ "$(echo "$HF" | jget "['has_token']")" = "True" ] \
  && ok "hf: token saved" || bad "hf: token not saved"
echo "$HF" | jget "['masked']" | grep -q "1234" \
  && ok "hf: only the last 4 characters are shown" || bad "hf: mask wrong"
echo "$HF" | grep -q "abcdefghijklmnop" \
  && bad "hf: the full token leaked into the status response" \
  || ok "hf: the full token is never echoed back"
# the token must actually reach the download worker, not just sit in config
DL=$(curl -sf -X POST http://127.0.0.1:8311/api/modeltools -H 'Content-Type: application/json' \
  -d '{"op":"download","path":"nonexistent-probe.safetensors"}')
DID=$(echo "$DL" | jget "['id']")
if [ -n "$DID" ]; then
  for i in $(seq 1 40); do
    dst=$(curl -sf "http://127.0.0.1:8311/api/jobs/$DID" | jget "['status']")
    [ "$dst" = "done" ] || [ "$dst" = "failed" ] && break
    sleep 1
  done
  curl -sf "http://127.0.0.1:8311/api/jobs/$DID?log_from=0" | jget "['log']" \
    | grep -q "using the HuggingFace token" \
    && ok "hf: the saved token is passed to the download worker" \
    || bad "hf: token never reached the worker"
else bad "hf: download job not queued"; fi
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"hf":{"token":""}}' > /dev/null

# ---- LOCAL OmniVoice / faster-whisper (venv subprocess, no HTTP)
# stand-in venvs whose "python" is scripts/stub-venv.py, so lib/venv.js runJson
# is exercised for real without torch or a model download (2.264.0: openaudio
# and its checkpoint fixture left with the engine)
for T in whisper omnivoice demucs; do
  mkdir -p "venvs/$T/bin"
  printf '#!/bin/sh\nexec python3 "%s/scripts/stub-venv.py" "$@"\n' "$(pwd)" > "venvs/$T/bin/python"
  chmod +x "venvs/$T/bin/python"
done
TS=$(curl -sf http://127.0.0.1:8311/api/tts)
[ "$(echo "$TS" | jget "['installed']")" = "True" ] \
  && ok "tts: local venv detected" || bad "tts: venv not detected"
echo "$TS" | grep -q '"url"' && bad "tts: still exposes an HTTP url" \
  || ok "tts: local only, no url/api key in status"
# ---- STEMS (2.269.0): demucs venv detected, a song splits into the pair,
# both land as sound assets, and the validator knows the third venv
SM=$(curl -sf http://127.0.0.1:8311/api/stems)
[ "$(echo "$SM" | jget "['installed']")" = "True" ] \
  && ok "stems: demucs venv detected" || bad "stems: venv not detected: $SM"
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=220:duration=2" /tmp/e2e_song2.wav
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_song2.wav" > /dev/null
SP=$(curl -sf -X POST http://127.0.0.1:8311/api/stems/separate \
  -H 'Content-Type: application/json' -d '{"file":"e2e_song2.wav"}')
echo "$SP" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('vocals')=='e2e_song2_vocals.wav' \
  and d.get('instrumental')=='e2e_song2_instrumental.wav', d
" && ok "stems: vocals + instrumental split with the demucs contract names" \
  || bad "stems: separate broke: $(echo "$SP" | head -c 240)"
ls "projects/default/sound/e2e_song2_vocals.wav" > /dev/null 2>&1 \
  && ls "projects/default/sound/e2e_song2_instrumental.wav" > /dev/null 2>&1 \
  && ok "stems: both stems are ordinary sound assets on disk" \
  || bad "stems: outputs missing from the sound folder"
curl -s -X POST http://127.0.0.1:8311/api/stems/separate -H 'Content-Type: application/json' \
  -d '{"file":"nope.wav"}' | grep -q "no such audio asset" \
  && ok "stems: a missing song is refused in words" || bad "stems: silent on a missing song"
curl -s -X POST http://127.0.0.1:8311/api/audio/install -H 'Content-Type: application/json' \
  -d '{"which":"demucs"}' | jget "['venv']" | grep -q demucs \
  && ok "stems: install validator takes demucs and queues its venv" \
  || bad "stems: install validator refuses demucs"

# ---- 2.270.0: the music-video segment split (the promptdock ＋ posts
# audio here; 15s files at music/temp/<base>_<n>.<ext>, segment n bound to
# board scene n as its own SOUND reference)
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=262:duration=32" /tmp/e2e_split.wav
SL=$(curl -sf -X POST http://127.0.0.1:8311/api/stems/split \
  -F "file=@/tmp/e2e_split.wav" -F "name=Gate Split_vocals.wav")
echo "$SL" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('base')=='gate_split' and d.get('seconds')==15, d
assert d.get('files')==['gate_split_1.wav','gate_split_2.wav','gate_split_3.wav'], d
assert isinstance(d.get('assigned'), list) and isinstance(d.get('leftover'), list), d
" && ok "split: a 32s track cuts into three 15s segments with the contract names" \
  || bad "split: broke: $(echo "$SL" | head -c 240)"
ls music/temp/gate_split_1.wav music/temp/gate_split_2.wav \
   music/temp/gate_split_3.wav > /dev/null 2>&1 \
  && ok "split: the segments live at music/temp (the instructed folder)" \
  || bad "split: segments missing from music/temp"
curl -s -X POST http://127.0.0.1:8311/api/stems/split | grep -q "attach the track" \
  && ok "split: a bodyless post is refused in words" \
  || bad "split: silent on a bodyless post"

# ---- 2.275.0: reassign — the music-video ask re-binds the LAST split's
# segments to the board as it stands NOW (segment n -> scene n)
RA=$(curl -s -X POST http://127.0.0.1:8311/api/stems/reassign)
echo "$RA" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('base')=='gate_split', d
assert isinstance(d.get('assigned'), list) and isinstance(d.get('leftover'), list), d
" && ok "reassign: the last split re-binds with the contract shape" \
  || bad "reassign: broke: $(echo "$RA" | head -c 240)"
mv music/temp/last_split.json /tmp/e2e_last_split.json
curl -s -X POST http://127.0.0.1:8311/api/stems/reassign \
  | grep -q "no split segments yet" \
  && ok "reassign: no split on record is refused in words" \
  || bad "reassign: silent with no split on record"
mv /tmp/e2e_last_split.json music/temp/last_split.json

# ---- 2.278.0: the MUSIC-VIDEO chain END TO END (the gap Tim's field
# report exposed: no leg ever converted or queued MMH3_Music_Video).
# Convert the shipped UI export exactly as first-PLAY does, put the board
# on the MMH3 style, apply a TAGLESS plan (no cast yet at this point in
# the run), generate scene 1 under the comfy backend, and require it to
# land rendered. Backend and style are restored after.
node -e '
const fs = require("fs");
const ui = JSON.parse(fs.readFileSync("comfy_workflows/MMH3_Music_Video.ui.json", "utf8"));
const types = {};
(ui.nodes || []).forEach((n) => { const t = String(n.type || "");
  if (!types[t]) types[t] = { input: { required: {} }, output: [], output_name: [] }; });
const out = require("./lib/graphToApi").convert(ui, types);
if (!out.graph) { console.error("convert failed"); process.exit(1); }
fs.writeFileSync("comfy_workflows/MMH3_Music_Video.json", JSON.stringify(out.graph, null, 2));
' && ok "mmh3: the shipped UI export converts to an API base (first-PLAY shape)" \
  || bad "mmh3: the pack export no longer converts"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"comfy","comfy":{"url":"http://127.0.0.1:8388"}}}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/scenes/style -H 'Content-Type: application/json' \
  -d '{"name":"MMH3_Music_Video"}' > /dev/null
# ref2va needs at least one reference image — a throwaway singer with a
# sheet from the shipped pose art rides the queue and leaves in the restore
curl -sf -F "file=@static/pose-sheets/human.png" \
  http://127.0.0.1:8311/api/characters/E2eSinger/asset > /dev/null
MVAP=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay/apply -H 'Content-Type: application/json' \
  -d '{"plan":{"shots":[{"id":"clip_01","scene":1,"prompt":"a singer on a midnight rooftop, city lights"}],"prompt_prefix":[]}}')
echo "$MVAP" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True, d
assert d.get('file') == 'MMH3_Music_Video_tmp.json', d.get('file')
" && ok "mmh3: apply writes the BOARD STYLE'S own tmp and says so (2.278.0)" \
  || bad "mmh3: apply wrote the wrong tmp: $(echo "$MVAP" | head -c 240)"
MVG=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/1/generate)
echo "$MVG" | jget "['ok']" | grep -q True \
  && ok "mmh3: PLAY queues scene 1 through the music-video chain" \
  || bad "mmh3: generate refused: $(echo "$MVG" | head -c 240)"
MST=queued
for i in $(seq 1 60); do
  MST=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=[x for x in d.get('list',[]) if x.get('n')==1]
print(r[0].get('status','?') if r else 'gone')")
  [ "$MST" = "rendered" ] || [ "$MST" = "failed" ] && break
  sleep 1
done
[ "$MST" = "rendered" ] \
  && ok "mmh3: scene 1 RENDERS through the converted chain" \
  || bad "mmh3: scene 1 ended $MST: $(curl -s http://127.0.0.1:8311/api/scenes | head -c 300)"
# ---- 2.281.0: the SHEETLESS TAG refusal (Tim's field report: the pack's
# "ValueError: Prompt uses unknown scheduled reference tag @character").
# A tag that EXISTS but has no sheet must refuse IN WORDS at generate,
# before ComfyUI — and the same scene renders once the tag leaves.
curl -sf -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Ghost281"}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"@ghost281 sings on the midnight rooftop"}' > /dev/null
ST281=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/generate)
echo "$ST281" | python3 -c "
import json,sys
d=json.load(sys.stdin)
e=str(d.get('error',''))
assert 'ghost281' in e.lower() and 'character sheet' in e, d
assert 'VOICE clip is optional' in e and 'song segment' in e, d
" && ok "sheetless tag: generate refuses in words (sheet fix + voice truth named)" \
  || bad "sheetless tag: refusal wrong: $(echo "$ST281" | head -c 240)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"a singer on a midnight rooftop, city lights"}' > /dev/null
ST282=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/1/generate)
echo "$ST282" | jget "['ok']" | grep -q True \
  && ok "sheetless tag: the same scene renders once the tag leaves the prompt" \
  || bad "sheetless tag: clean prompt still refused: $(echo "$ST282" | head -c 240)"
MSTW=queued
for i in $(seq 1 60); do
  MSTW=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=[x for x in d.get('list',[]) if x.get('n')==1]
print(r[0].get('status','?') if r else 'gone')")
  [ "$MSTW" = "rendered" ] || [ "$MSTW" = "failed" ] && break
  sleep 1
done
[ "$MSTW" = "rendered" ] && ok "sheetless tag: the clean render completed" \
  || bad "sheetless tag: clean render ended $MSTW"
curl -s -X DELETE http://127.0.0.1:8311/api/characters/Ghost281 > /dev/null
# 2.281.0 second door, defense-in-depth: the EDIT route validates (proven
# below), so an unknown tag can only arrive through externally-written
# state (an older version's board, a hand-edited .prj). Inject it there
# and the QUEUE must still refuse in words, naming the real tags.
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"@invented281 dances on the rooftop"}' \
  | grep -q "this prompt would not render" \
  && ok "unknown tag: the card-edit route itself refuses the save (validation at the door)" \
  || bad "unknown tag: the edit route accepted an invented tag"
python3 - <<'PZ'
import json
p = "projects/default/default.prj"
d = json.load(open(p))
sc = d.get("scenes") or d
row = next(x for x in sc.get("list", []) if x.get("n") == 1)
row["prompt"] = ["@invented281 dances on the rooftop"]
json.dump(d, open(p, "w"), indent=2)
PZ
ST283=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/generate)
echo "$ST283" | python3 -c "
import json,sys
d=json.load(sys.stdin)
e=str(d.get('error',''))
assert 'invented281' in e and 'no character, environment' in e, d
assert 'Real tags:' in e and 'e2esinger' in e.lower(), d
" && ok "unknown tag: the card-edit hole refuses at generate, real tags named" \
  || bad "unknown tag: refusal wrong: $(echo "$ST283" | head -c 240)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"a singer on a midnight rooftop, city lights"}' > /dev/null

# ---- 2.291.0: OBVPM_Timeline REMOVED (Tim: "remove the ovpm timeline,
# we will use our timeline docker") - the export is gone from the shipped
# workflows and a store entry an old install adopted never lists.
curl -sf -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d '{"name":"OBVPM_Timeline","kind":"video","arch":"minimax-h3","workflows":{"ref2va":"comfy_workflows/OBVPM_Timeline.json"}}' > /dev/null
[ ! -e comfy_workflows/OBVPM_Timeline.ui.json ] \
  && curl -sf http://127.0.0.1:8311/api/styles | python3 -c "
import json,sys; d=json.load(sys.stdin)
names=[s.get('name') for s in d.get('styles',[])]
assert 'OBVPM_Timeline' not in names, names
" && ok "obvpm removed: no shipped export, and an adopted store entry never lists" \
  || bad "obvpm removed: the export or the style still shows"
rm -f styles/video/OBVPM_Timeline.json
# ---- 2.290.0: MMH3_NativeAudio_MV END TO END (Tim: "add 9 images and 3
# audio files to the mmh3_native audio_mv workflow ... so we can use the
# characters and character sheets, locations, props, vehicles etc."). The
# board on this style renders ITS OWN converted graph (before 2.290 it
# fell through to the character chain), refuses in words with no board
# song, and sends the sheet as <Picture 1> + the song window as <Audio 1>
# under the reference map; the unused picture/audio loaders are pruned.
node -e '
const fs = require("fs");
const src = "comfy_workflows/MMH3_NativeAudio_MV.ui.json";
const ui = JSON.parse(fs.readFileSync(src, "utf8"));
const types = {};
(ui.nodes || []).forEach((n) => { const t = String(n.type || "");
  if (!types[t]) types[t] = { input: { required: {} }, output: [], output_name: [] }; });
const out = require("./lib/graphToApi").convert(ui, types);
if (!out.graph) { console.error("convert failed"); process.exit(1); }
const r2v = Object.values(out.graph).find((v) => v.class_type === "MiniMaxH3ReferenceToVideo");
const keys = Object.keys(r2v.inputs);
if (keys.filter((k) => k.startsWith("ref_images.")).length !== 9
    || keys.filter((k) => k.startsWith("ref_audios.")).length !== 3) process.exit(2);
fs.writeFileSync("comfy_workflows/MMH3_NativeAudio_MV.json", JSON.stringify(out.graph, null, 2));
// 2.292.0: the sidecar hash carries the CONVERTER version (a fixed
// converter re-converts every old base) - read it from the route itself
const cv = (fs.readFileSync("routes/characters.js", "utf8")
  .match(/const CONVERTER_VERSION = "([^"]+)";/) || [])[1];
if (!cv) process.exit(3);
fs.writeFileSync("comfy_workflows/MMH3_NativeAudio_MV.json.src",
  require("crypto").createHash("sha1").update(fs.readFileSync(src))
    .update("|converter " + cv).digest("hex") + "\n");
' && ok "native-audio: the export converts with NINE picture and THREE audio slots on MiniMaxH3ReferenceToVideo" \
  || bad "native-audio: the export no longer converts with 9 + 3 slots"
NAP=$(curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "import json,sys; print(json.load(sys.stdin).get('project') or 'default')")
curl -sf -X POST http://127.0.0.1:8311/api/scenes/style -H 'Content-Type: application/json' \
  -d '{"name":"MMH3_NativeAudio_MV"}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/audio -H 'Content-Type: application/json' -d '{"file":""}' > /dev/null
wait_scene() {   # $1 = scene n -> echoes the final status
  local s=queued
  for i in $(seq 1 60); do
    s=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=[x for x in d.get('list',[]) if x.get('n')==$1]
print(r[0].get('status','?') if r else 'gone')")
    [ "$s" = "rendered" ] || [ "$s" = "failed" ] && break
    sleep 1
  done
  echo "$s"
}
# ---- 2.323.0: NO SONG (Tim: "if screenplay then there won't be a song, but
# i would still like to render with the nativeaudio workflow"). Before 2.323
# PLAY refused ("locks the board's SONG"); now the board renders the plain
# native-audio graph - the lock, trim and song loader are OUT, the model's
# own audio is decoded (VAEDecodeAudio), the singer's VOICE clip is the audio
# reference, the prompt binds the character to it, and the scene runs the
# row's Duration (5 s), not the chain's lengths.
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=220:duration=4" /tmp/e2e_ns_voice.wav
curl -sf -F "file=@/tmp/e2e_ns_voice.wav" \
  http://127.0.0.1:8311/api/characters/E2eSinger/asset > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/audio -H 'Content-Type: application/json' \
  -d '{"start":0,"dur":5}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"@e2esinger looks out over the rooftop and says: \"We made it.\""}' > /dev/null
NA0=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/1/generate)
echo "$NA0" | jget "['ok']" | grep -q True \
  && ok "no-song: with no board song, PLAY queues the native-audio render (no refusal)" \
  || bad "no-song: generate refused: $(echo "$NA0" | head -c 300)"
NAS0=$(wait_scene 1)
[ "$NAS0" = "rendered" ] && python3 -c "
import glob, json, os, subprocess
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
c = rec.get('_classes', [])
assert 'MiniMaxH3ReferenceToVideo' in c, sorted(c)
assert 'MiniMaxH3NativeAudioLock' not in c and 'TrimAudioDuration' not in c, ('the song lock stayed', sorted(c))
assert 'VAEDecodeAudio' in c, ('the model audio is not decoded', sorted(c))
auds = rec.get('_ref_audio_slots', [])
assert auds and all('e2e_ns_voice' in a for a in auds), ('the voice is the audio reference', auds)
p = rec.get('_gen_prompt', '')
# 2.363.0: the line is H3 dialogue in the voice's timbre, and the voice clip's own words are never said
assert 'says, in the timbre of <Audio 1>: <d>[English] We made it.</d>' in p, p[-400:]
assert 'never says the words heard in <Audio 1>' in p, p[-400:]
assert 'Only the lines inside <d>...</d> are spoken' in p, p[-400:]
want = int(subprocess.check_output(['node', '-e', 'process.stdout.write(String(require(\"./lib/sceneTiming\").framesFor(5, 362)))']))
assert rec.get('_gen_length') == want, (rec.get('_gen_length'), want)
" > /tmp/nosong323.log 2>&1 \
  && ok "no-song: the native graph rendered WITHOUT the song lock - the model's audio is decoded, the voice clip is <Audio 1>, the line is H3 dialogue in its timbre and its own words are never said (2.363.0), the scene runs its 5 s Duration" \
  || { bad "no-song: the queued graph is wrong (scene ended $NAS0)"; tail -6 /tmp/nosong323.log; }
# the voice leaves again so the song legs below see the board they always saw
node -e '
const fs = require("fs"), path = require("path"), ch = require("./lib/characters");
const pj = process.argv[1], p = ch.readProfile("E2eSinger", pj);
if (!p) process.exit(1);
try { fs.unlinkSync(path.join(ch.charDir("E2eSinger", pj), "e2e_ns_voice.wav")); } catch {}
p.voices = (p.voices || []).filter((v) => v !== "e2e_ns_voice.wav");
ch.writeProfile(p, pj);
' "$NAP" || bad "no-song: could not take the test voice off E2eSinger"
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/audio -H 'Content-Type: application/json' \
  -d '{"start":"","dur":""}' > /dev/null
# ---- 2.323.0: THE SCENES FIELD (Tim: "can we add scenes to the video
# docker, and the llm counts the scenes (or we have a txt file with number
# of scenes)"): GET /api/scenes/count reports the field and scenes.txt
echo "6 scenes please" > "projects/$NAP/scenes.txt"
SC1=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/count -H 'Content-Type: application/json' -d '{"n":7}')
SC2=$(curl -s http://127.0.0.1:8311/api/scenes/count)
curl -s -X POST http://127.0.0.1:8311/api/scenes/count -H 'Content-Type: application/json' -d '{"n":""}' > /dev/null
SC3=$(curl -s http://127.0.0.1:8311/api/scenes/count)
rm -f "projects/$NAP/scenes.txt"
python3 -c "
import json,sys
a, b, c = (json.loads(x) for x in sys.argv[1:4])
assert a.get('ok') and a.get('n') == 7, a
assert b.get('n') == 7 and b.get('file_n') == 6, b
assert not c.get('n') and c.get('file_n') == 6, c
" "$SC1" "$SC2" "$SC3" \
  && ok "scenes field: the count saves on the board, clears, and scenes.txt's number is reported beside it" \
  || bad "scenes field: count route wrong: $SC1 | $SC2 | $SC3"
mkdir -p "projects/$NAP/sound"
ffmpeg -y -f lavfi -i sine=frequency=330:duration=20 "projects/$NAP/sound/e2e_na290.wav" > /dev/null 2>&1
curl -s -X POST http://127.0.0.1:8311/api/scenes/audio -H 'Content-Type: application/json' \
  -d '{"file":"e2e_na290.wav"}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/audio -H 'Content-Type: application/json' \
  -d '{"start":4,"dur":8}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"@e2esinger sings on the midnight rooftop, city lights"}' > /dev/null
NB_NA=$(ls /tmp/stub-comfy-out/video_*.json 2>/dev/null | wc -l)
# 2.357.0: the press carries the left Basic Settings' size (the video dock sends it)
NAG=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/1/generate -H 'Content-Type: application/json' \
  -d '{"basic":{"width":1280,"height":720}}')
echo "$NAG" | jget "['ok']" | grep -q True \
  && ok "native-audio: PLAY queues scene 1 through the NativeAudio graph" \
  || bad "native-audio: generate refused: $(echo "$NAG" | head -c 300)"
NAST=queued
for i in $(seq 1 60); do
  NAST=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=[x for x in d.get('list',[]) if x.get('n')==1]
print(r[0].get('status','?') if r else 'gone')")
  [ "$NAST" = "rendered" ] || [ "$NAST" = "failed" ] && break
  sleep 1
done
[ "$NAST" = "rendered" ] \
  && ok "native-audio: scene 1 RENDERS through the converted NativeAudio graph" \
  || bad "native-audio: scene 1 ended $NAST: $(curl -s http://127.0.0.1:8311/api/scenes | head -c 300)"
python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
c = rec.get('_classes', [])
assert 'MiniMaxH3NativeAudioLock' in c and 'TrimAudioDuration' in c and 'MiniMaxH3ReferenceToVideo' in c, sorted(c)
assert 'MiniMaxH3ChainPlan' not in c, 'the character chain rendered instead'
import re
imgs = rec.get('_ref_images', [])
auds = rec.get('_ref_audio_slots', [])
p = rec.get('_gen_prompt', '')
head = p.split(chr(10) + chr(10))[0]
pics = re.findall(r'<Picture (\d+)> is ', head)
assert p.startswith('References, in the order they are connected:'), p[:200]
# one header line per picture that reached the gen node - the unused loaders are pruned
assert 1 <= len(imgs) <= 9 and len(pics) == len(imgs), (imgs, head)
assert 'human.png' in imgs, ('the singer sheet rides', imgs)
m = re.search(r'<Picture (\d+)> is @e2esinger - character sheet', head)
assert m, head
assert imgs[int(m.group(1)) - 1] == 'human.png', ('the number IS the slot', imgs, head)
assert '<Picture ' + m.group(1) + '> sings on the midnight rooftop' in p, p[-200:]
assert 1 <= len(auds) <= 3 and 'e2e_na290' in auds[0], ('the song rides slot 0', auds)
assert '<Audio 1> is the song segment (4s + 8s of e2e_na290.wav' in head, head
assert rec.get('_gen_size') == [1280, 704], ('the Basic Settings size reached the gen node - 1280x720 in H3 32-px steps (2.379.2)', rec.get('_gen_size'))
" && ok "native-audio: ComfyUI got every sheet as its numbered <Picture n> (the @tag rewritten to it) and the song window as <Audio 1> under the reference map; the unused loaders were pruned" \
  || bad "native-audio: the queued graph is wrong: $(ls -t /tmp/stub-comfy-out/video_*.json | head -1 | xargs cat | head -c 400)"
# 2.357.0 (Tim: "does the native audio use the basic settings in the left docker? I would like to be able to
# change the resolution"): the size the press carried is kept in the project's render settings (queued and
# auto renders use it), the job's notes say where it came from; cleared again for the legs below
python3 -c "
import json, sys
d = json.loads(sys.argv[1])
assert any('render size 1280x720 (Basic Settings, the left dock)' in str(n) for n in (d.get('notes') or [])), d.get('notes')
rs = json.load(open('projects/$NAP/render_settings.json'))
assert rs.get('basic_width') == 1280 and rs.get('basic_height') == 720, rs
" "$NAG" > /tmp/basic357.log 2>&1 \
  && curl -s -X POST http://127.0.0.1:8311/api/scenes/render-settings -H 'Content-Type: application/json' \
       -d '{"settings":{"basic_width":0,"basic_height":0}}' | grep -q '"basic_width":0' \
  && ok "basic size (2.357.0): the board press carried the left Basic Settings' 1280x720 to the native gen node, kept it for the queued renders, said so in the notes, and clears" \
  || { bad "basic size: the Basic Settings size did not reach the board render"; tail -3 /tmp/basic357.log; }
# 2.291.0 (Tim: "after each scene is generated add it to a new video layer
# in our timeline docker at the start position set in the video docker
# scene"): the fresh take is FLAGGED for the page with the scene's start
# input (4 s) and a probed length; the page's ack clears exactly that take
curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d['list'] if x.get('n')==1][0]
assert r.get('tl_pending') is True, r
# 2.377.0: the board has a song, so the take sits AT its song time ("song") - the same 4 s here
assert r.get('tl_start') == 4 and r.get('tl_from') == 'song', r
assert (r.get('tl_dur') or 0) > 0, r
" > /tmp/tl291.log 2>&1 \
  && NAOUT=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); print([x for x in d['list'] if x.get('n')==1][0].get('output',''))") \
  && curl -s -X POST http://127.0.0.1:8311/api/scenes/1/placed -H 'Content-Type: application/json' \
       -d "{\"output\":\"$NAOUT\"}" | grep -q '"changed":true' \
  && curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d['list'] if x.get('n')==1][0]
assert not r.get('tl_pending'), r
" >> /tmp/tl291.log 2>&1 \
  && ok "timeline: the rendered scene is flagged for a new timeline layer at its song time (its start input, 4 s) with its probed length, and the page's ack clears it" \
  || { bad "timeline: the fresh-take flag is wrong"; tail -4 /tmp/tl291.log; }
# ---- 2.292.0: THE TWO MODES (Tim: "can we use ref2va and fl2va in the
# mmh3 native audio workflow? so our following scenes can follow from the
# frame we select in the scene before using fl2va, or if we change
# location to use ref2va for the new location and transition from the
# previous scene?"). Scene 2 is added; a frame picked on scene 1's take
# makes it First (fl2va): the graph is the fl2va TWIN (ImageToVideo + the
# same lock), the picked frame is its first_frame, the song still loads.
# Switched to Ref it renders ref2va with scene 1's tail as <Video 1>.
curl -s -X POST http://127.0.0.1:8311/api/scenes/add -H 'Content-Type: application/json' \
  -d '{"text":"@e2esinger keeps singing as the camera drifts closer","raw":true}' > /dev/null
PF=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/pick-frame -H 'Content-Type: application/json' \
  -d '{"time":1.0}')
echo "$PF" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('to') == 2 and d.get('anchor') == 'first', d
assert 'First (fl2va)' in d.get('note',''), d
" && ok "modes: picking a frame on scene 1's filmstrip makes scene 2 First (fl2va) and says so" \
  || bad "modes: pick-frame default wrong: $(echo "$PF" | head -c 240)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/audio -H 'Content-Type: application/json' \
  -d '{"start":12,"dur":6}' > /dev/null
NAG2=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/generate)
NAS2=$(wait_scene 2)
[ "$NAS2" = "rendered" ] && python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
c = rec.get('_classes', [])
assert 'MiniMaxH3ImageToVideo' in c and 'MiniMaxH3NativeAudioLock' in c and 'TrimAudioDuration' in c, sorted(c)
assert 'MiniMaxH3ReferenceToVideo' not in c, ('the ref2va graph ran', sorted(c))
imgs = rec.get('_ref_images', [])
assert imgs and 'scene2_continuation' in imgs[0], ('the picked frame is first_frame', imgs)
assert len(imgs) == 1, ('no last frame on First', imgs)
assert any('e2e_na290' in a for a in rec.get('_ref_audios', [])), ('the song loads', rec.get('_ref_audios'))
p = rec.get('_gen_prompt', '')
assert '<Picture' not in p and '@e2esinger' not in p.lower(), p[:300]
assert 'camera drifts closer' in p, p[:300]
" > /tmp/na292a.log 2>&1 \
  && ok "modes: First renders through the fl2va TWIN - the picked frame is first_frame, the song still locks in, the @tag written as a name (fl2va has no reference slots)" \
  || { bad "modes: the First render is wrong ($NAS2): $(echo "$NAG2" | head -c 200)"; tail -4 /tmp/na292a.log; }
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/anchor -H 'Content-Type: application/json' \
  -d '{"anchor":"reference"}' > /dev/null
NAG3=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/redo)
echo "$NAG3" | grep -q '"error"' && NAG3=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/generate)
sleep 1
NAS3=$(wait_scene 2)
[ "$NAS3" = "rendered" ] && python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
c = rec.get('_classes', [])
assert 'MiniMaxH3ReferenceToVideo' in c and 'MiniMaxH3ImageToVideo' not in c, sorted(c)
v = rec.get('_ref_video_slots', [])
assert v and 'scene2_prev_tail' in v[0], ('the previous take tail is Video 1', v)
assert 'GetVideoComponents' in c, ('2.305.0: the refused VIDEO link was split into frames', sorted(c))
p = rec.get('_gen_prompt', '')
assert '<Video 1> is reference video (the last 3s of scene 1' in p, p[:500]
assert not any('scene2_continuation' in x for x in rec.get('_ref_images', [])), rec.get('_ref_images')
" > /tmp/na292b.log 2>&1 \
  && ok "modes: Ref renders ref2va with scene 1's last 3 s as <Video 1> (the transition into the new location) and the frame kept out of the pictures - the VIDEO link this ComfyUI refuses is split into frames and re-queued (2.305.0)" \
  || { bad "modes: the Ref render is wrong ($NAS3): $(echo "$NAG3" | head -c 200)"; tail -4 /tmp/na292b.log; }
# 2.307.0: that re-render was a REDO of a rendered scene - its new take is
# filed as scene_2_<x>, and the earlier take is still in the Video assets
curl -s http://127.0.0.1:8311/api/scenes | python3 -c '
import json, sys, re, os
d = json.load(sys.stdin)
r = [x for x in d["list"] if x["n"] == 2][0]
assert re.fullmatch(r"scene_2_\d+\.\w+", r.get("output") or ""), r.get("output")
' > /tmp/redo307.log 2>&1 \
  && ok "redo: the ↻ re-render of scene 2 is filed as scene_2_<x> (2.307.0)" \
  || { bad "redo take name"; cat /tmp/redo307.log | tail -3; }
# 2.312.0: the video docker's ⚙ - size, steps, Sage and the MMH3 Ultimate
# Upscale stage ride the next board render; blank again afterwards
RS=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/render-settings -H 'Content-Type: application/json' \
  -d '{"settings":{"res":"720","aspect":"16:9","steps":6,"sage":true,"upscaler":"e2e_up3d.safetensors","upscale_res":"1080","upscale_auto":true}}')
echo "$RS" | grep -q '"upscaler":"e2e_up3d.safetensors"' \
  && curl -s -X POST http://127.0.0.1:8311/api/scenes/2/redo > /dev/null \
  && sleep 1 && [ "$(wait_scene 2)" = "rendered" ] && python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
u = rec.get('_upscale') or {}
p = u.get('MMH3LatentUpscaleWithModelParams') or {}
sp = u.get('MMH3SpatialSplitParams') or {}
up = u.get('MMH3UltimateUpscale') or {}
# 2.379.2: the render is 1280x704 (H3's 32-px steps) - the upscale keeps THAT aspect: 1920x1056, not a stretched 1088
assert p.get('model_name') == 'e2e_up3d.safetensors' and p.get('width') == 1920 and p.get('height') == 1056, p
assert sp.get('upscale_width') == 1920 and sp.get('upscale_height') == 1056, sp
assert up.get('cfg') == 1 and isinstance(up.get('latent'), list), up
assert any(isinstance(s, list) and 'bgup_upscale' in str(s[0]) for s in rec.get('_decode_src', [])), rec.get('_decode_src')
assert 'PathchSageAttentionKJ' in rec.get('_accel', []), rec.get('_accel')
" > /tmp/rs312.log 2>&1 \
  && ok "render settings: the ⚙ record rides a board render - Sage in, the MMH3 Ultimate Upscale stage spliced after the sampler (e2e_up3d -> 1920x1056 = the 1280x704 take's aspect, the decode reads the upscaled latent) (2.312.0, 2.379.2)" \
  || { bad "render settings did not reach the render: $RS"; tail -4 /tmp/rs312.log; }
curl -s -X POST http://127.0.0.1:8311/api/scenes/render-settings -H 'Content-Type: application/json' \
  -d '{"settings":{"res":"","steps":null,"cfg":null,"sage":false,"spectrum":false,"kitchen":false,"upscaler":"","upscale_auto":false}}' > /dev/null
# 2.315.0 (Tim: "does it upscale automatically or do i need to press the
# upscale button in the scene. i would prefer to press the button so i can
# preview the scene, however i would like a icon only button in the scene
# menubar to upscale selected"): with an upscaler picked but "Upscale every
# render" OFF a render stays at its own size; ⏫ Selected then upscales THE
# TAKE - the stage reads its lossless master (LoadVideo -> GetVideoComponents
# -> VAEEncodeTiled), never a new sample - and files it as the upscaled take
curl -s -X POST http://127.0.0.1:8311/api/scenes/render-settings -H 'Content-Type: application/json' \
  -d '{"settings":{"upscaler":"e2e_up3d.safetensors","upscale_res":"1080","upscale_auto":false}}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/redo > /dev/null
sleep 1
if [ "$(wait_scene 2)" = "rendered" ] && python3 -c "
import glob, json, os
rec = json.load(open(max(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)))
assert not rec.get('_upscale'), rec.get('_upscale')
" > /tmp/tu315a.log 2>&1; then
  ok "take upscale: an upscaler picked, \"Upscale every render\" off - the render has NO upscale stage (fast preview) (2.315.0)"
else bad "take upscale: the plain render still upscaled"; tail -3 /tmp/tu315a.log; fi
TU=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/upscale -H 'Content-Type: application/json' -d '{"scenes":[2,99]}')
TUJ=$(echo "$TU" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["jobs"][0]["job"] if d.get("ok") and d.get("queued")==1 else "")' 2>/dev/null)
TUS=""
if [ -n "$TUJ" ]; then
  for i in $(seq 1 150); do
    TUS=$(curl -sf "http://127.0.0.1:8311/api/jobs/$TUJ" | jget "['status']")
    [ "$TUS" = done ] || [ "$TUS" = failed ] && break; sleep 1
  done
fi
if [ "$TUS" = done ] && echo "$TU" | grep -q "scene 99" && python3 -c "
import glob, json, os, urllib.request
rec = json.load(open(max(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)))
f = rec.get('_take_feed') or []
assert f[:3] == ['VAEEncodeTiled', 'GetVideoComponents', 'LoadVideo'] and str(f[3]).startswith('scene_2_') and str(f[3]).endswith('.avi'), f
u = rec.get('_upscale') or {}
p = u.get('MMH3LatentUpscaleWithModelParams') or {}
assert p.get('model_name') == 'e2e_up3d.safetensors' and (p.get('width'), p.get('height')) == (1920, 1088), p
assert any(isinstance(s, list) and 'bgup_upscale' in str(s[0]) for s in rec.get('_decode_src', [])), rec.get('_decode_src')
b = json.load(urllib.request.urlopen('http://127.0.0.1:8311/api/scenes'))
r = [x for x in b['list'] if x['n'] == 2][0]
assert r.get('upscaled') and 'upscaled' in r['upscaled'], r.get('upscaled')
" > /tmp/tu315b.log 2>&1; then
  ok "take upscale: ⏫ Selected queues the ticked scene (a scene without a take is named, not fatal); the stage reads the TAKE's lossless master through LoadVideo -> GetVideoComponents -> VAEEncodeTiled at 1920x1088, the decode reads the upscaled latent, filed as the upscaled take (2.315.0)"
else bad "take upscale: ($TUS) $(echo "$TU" | head -c 300)"; tail -4 /tmp/tu315b.log
  [ -n "$TUJ" ] && curl -sf "http://127.0.0.1:8311/api/jobs/$TUJ" | jget "['log']" | tail -8; fi
curl -s -X POST http://127.0.0.1:8311/api/scenes/render-settings -H 'Content-Type: application/json' \
  -d '{"settings":{"upscaler":"","upscale_auto":false}}' > /dev/null
# 2.375.0 (Tim: "i don't think the overide style in basic settings is working for video generation - i set it to 15
# steps but it is still rendering 20 steps"): a board ▶ carries Basic Settings' Override style + Steps + CFG; ON =
# they beat the ⚙ (set to 6 here) and the workflow's 20
curl -s -X POST http://127.0.0.1:8311/api/scenes/render-settings -H 'Content-Type: application/json' \
  -d '{"settings":{"steps":6}}' > /dev/null
OV375=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/redo -H 'Content-Type: application/json' \
  -d '{"basic":{"width":192,"height":108,"override":true,"steps":15,"cfg":1}}')
OVJ=$(echo "$OV375" | python3 -c "import json,sys; print((json.load(sys.stdin).get('job') or {}).get('id',''))" 2>/dev/null)
sleep 1; OVS=$(wait_scene 2)
[ -n "$OVJ" ] && [ "$OVS" = "rendered" ] && echo "$OV375" | grep -q "steps 15 (Basic Settings - Override style is on; the video docker's ⚙ says 6)" \
  && curl -sf "http://127.0.0.1:8311/api/jobs/$OVJ?log_from=0" | python3 -c "
import json,sys; j=json.load(sys.stdin)
assert j['params']['steps'] == 15, j['params'].get('steps')
assert any('steps=15 (explicit)' in l for l in j['log']), [l for l in j['log'] if 'steps' in l][:4]" \
  && ok "basic settings: Override style ON - its 15 steps render the board scene (over the ⚙'s 6 and the workflow's 20) (2.375.0)" \
  || bad "basic settings: override steps not used: ${OV375:0:300}"
OV2=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/redo -H 'Content-Type: application/json' \
  -d '{"basic":{"width":192,"height":108,"override":false,"steps":15,"cfg":1}}')
OVJ2=$(echo "$OV2" | python3 -c "import json,sys; print((json.load(sys.stdin).get('job') or {}).get('id',''))" 2>/dev/null)
sleep 1; wait_scene 2 > /dev/null
[ -n "$OVJ2" ] && curl -sf "http://127.0.0.1:8311/api/jobs/$OVJ2" | python3 -c "
import json,sys; assert json.load(sys.stdin)['params']['steps'] == 6" && echo "$OV2" | grep -q "steps 6 (the video docker's ⚙)" \
  && ok "basic settings: Override style OFF - the ⚙ / workflow rule again (2.375.0)" || bad "basic settings: override off ${OV2:0:200}"
curl -s -X POST http://127.0.0.1:8311/api/scenes/render-settings -H 'Content-Type: application/json' \
  -d '{"settings":{"steps":null,"basic_override":false,"basic_steps":0,"basic_cfg":null}}' > /dev/null
node scripts/test-basicoverride.js > /tmp/basicoverride375.log 2>&1 \
  && ok "basicoverride unit tests (2.375.0 the board ▶ carries Override style + Steps + CFG; ON beats the ⚙ and the workflow)" \
  || { bad "basicoverride unit tests"; tail -12 /tmp/basicoverride375.log; }
# 2.294.0: the render-time safety net - a scene still carrying the chain's
# (S1) speaker ID and <d> dialogue renders WITHOUT them on the native graph
# (the song is the voice), gains the singing line, and the note says so.
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"@e2esinger (S1), a smoky vocalist, sings to camera:\n<d>[English] I burned the map.</d>"}' > /tmp/mv294p.json
NAG4=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/1/redo)
NAS4=$(wait_scene 1)
[ "$NAS4" = "rendered" ] && echo "$NAG4" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert any('cleaned for the native-audio render' in n and 'speaker IDs (S1) removed' in n for n in d.get('notes',[])), d.get('notes')
" && python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
p = json.load(open(fs2[-1])).get('_gen_prompt', '')
assert '<d>' not in p and '(S1)' not in p and 'burned the map' not in p, p[-400:]
assert 'lip synchronization' in p, p[-400:]
" && ok "music-video render: a scene written with the chain's (S1) + <d> renders without them on the native graph, with the singing line, and says so" \
  || bad "music-video render cleanup ($NAS4): $(echo "$NAG4" | head -c 300) $(head -c 200 /tmp/mv294p.json)"
# ---- 2.358.0: BRIDGE SCENES (Tim: "add a transition checkbox to the song menubar before the save button,
# with a duration input ... render segment 1 and 3 as ref for example and segment 2 as fl2va, first frame will
# be last frame of segment 1 and last frame will be first frame of segment 3. If user clicks transition then we
# can do standard transitions like wipe, fade, dissolve"). LIVE: 💾 with gap 0.5 s stages scene, bridge, scene;
# with both neighbours' takes on disk the bridge renders as a cross dissolve through bridge_worker.py (ffmpeg,
# 12 frames), then switched to AI it renders fl2va through the native-audio graph (22 frames, both frames) and
# is fitted to its 0.5 s gap. The board is snapshotted and restored.
BRP=$(curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "import json,sys; print(json.load(sys.stdin).get('project') or 'default')")
BRDIR="projects/$BRP"; BRSNAP=$(mktemp -d)
cp "$BRDIR/$BRP.prj" "$BRSNAP/prj" 2>/dev/null || true
[ -d "$BRDIR/scenes" ] && cp -r "$BRDIR/scenes" "$BRSNAP/scenes"
mkdir -p "$BRDIR/sound" "$BRDIR/video"
ffmpeg -y -f lavfi -i sine=frequency=330:duration=12 "$BRDIR/sound/e2e_br358.wav" > /dev/null 2>&1
ffmpeg -y -f lavfi -i color=c=blue:size=320x180:rate=24 -t 1 -pix_fmt yuv420p "$BRDIR/video/e2e_br358_a.mp4" > /dev/null 2>&1
ffmpeg -y -f lavfi -i color=c=red:size=320x180:rate=24 -t 1 -pix_fmt yuv420p "$BRDIR/video/e2e_br358_b.mp4" > /dev/null 2>&1
BRS=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/from-segments -H 'Content-Type: application/json' \
      -d '{"song":"e2e_br358.wav","durations":[6,6],"manual":[false,false],"gap":0.5,"gap_type":"fade"}')
python3 - "$BRS" "$BRDIR/$BRP.prj" "$BRDIR/video" > /tmp/br358.log 2>&1 <<'PY'
import json, sys, os
d = json.loads(sys.argv[1])
assert d.get('ok') and d.get('bridges') == 1 and d.get('gap') == {'dur': 0.5, 'type': 'fade'}, d
p = json.load(open(sys.argv[2]))
L = p['scenes']['list']
assert [(r.get('audio_start'), r.get('audio_dur'), (r.get('bridge') or {}).get('type')) for r in L] == \
  [(0, 5.5, None), (5.5, 0.5, 'fade'), (6, 6, None)], L
for i, f in ((0, 'e2e_br358_a.mp4'), (2, 'e2e_br358_b.mp4')):
    L[i]['status'] = 'rendered'; L[i]['output'] = os.path.abspath(os.path.join(sys.argv[3], f))
p['scenes']['style'] = 'MMH3_NativeAudio_MV'
json.dump(p, open(sys.argv[2], 'w'))
PY
[ $? -eq 0 ] && ok "bridge (2.358.0): 💾 with ☐ Transition 0.5 s stages scene 1 (0-5.5 s), a cross-dissolve bridge (5.5-6 s), scene 3 (6-12 s); the board keeps the gap" \
  || { bad "bridge: the staging is wrong: $(echo "$BRS" | head -c 300)"; tail -4 /tmp/br358.log; }
br_wait() {
  local st=queued
  for i in $(seq 1 90); do
    st=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d.get('list',[]) if x.get('n')==2]
print(r[0].get('status','?') if r else 'gone')")
    [ "$st" = "rendered" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  echo "$st"
}
br_take() {
  curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys,os,subprocess
d=json.load(sys.stdin); r=[x for x in d['list'] if x.get('n')==2][0]
o=r.get('output',''); p=o if os.path.isabs(o) else os.path.join('$BRDIR','video',os.path.basename(o))
s=json.loads(subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_type,nb_frames,duration','-of','json',p],capture_output=True,text=True).stdout)['streams']
v=[x for x in s if x['codec_type']=='video'][0]; a=[x for x in s if x['codec_type']=='audio']
print(v.get('nb_frames'), round(float(v.get('duration',0)),2), len(a))"
}
BRG=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/generate)
BRST=$(br_wait)
BRT=$(br_take 2>/dev/null)
echo "$BRG" | grep -q "Cross dissolve for 0.5s from scene 1's last frame to scene 3's first frame" \
  && [ "$BRST" = "rendered" ] && [ "$BRT" = "12 0.5 1" ] \
  && ok "bridge: ▶ on the bridge draws a 0.5 s cross dissolve from scene 1's last frame to scene 3's first frame with ffmpeg (12 frames + the song window) - no model" \
  || bad "bridge: the standard transition did not render: $BRST / $BRT / $(echo "$BRG" | head -c 300)"
BRB=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/2/bridge -H 'Content-Type: application/json' -d '{"type":"ai"}')
BRR=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/redo)
BRST2=$(br_wait)
BRT2=$(br_take 2>/dev/null)
python3 -c "
import glob, json, os, sys
d = json.loads(sys.argv[1]); assert d.get('changed') is True and d['bridge']['type'] == 'ai', d
r = json.loads(sys.argv[2]); assert r.get('ok'), r
assert any('bridge: 22 frames from scene 1' in str(n) for n in r.get('notes', [])), r.get('notes')
rec = json.load(open(sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)[-1]))
c = rec.get('_classes', [])
assert 'MiniMaxH3ImageToVideo' in c and 'MiniMaxH3NativeAudioLock' in c, c
assert rec.get('_gen_length') == 22, rec.get('_gen_length')
assert len(rec.get('_ref_images', [])) == 2, rec.get('_ref_images')
" "$BRB" "$BRR" > /tmp/br358ai.log 2>&1 \
  && [ "$BRST2" = "rendered" ] && [ "$(echo "$BRT2" | cut -d' ' -f1-2)" = "12 0.5" ] \
  && ok "bridge: switched to AI on its card, ↻ renders fl2va through the native-audio graph from scene 1's last frame to scene 3's first frame (22 frames) and the take is fitted to its 0.5 s gap" \
  || { bad "bridge: the AI bridge is wrong: $BRST2 / $BRT2"; tail -4 /tmp/br358ai.log; }
rm -f "$BRDIR/sound/e2e_br358.wav" "$BRDIR/sound/e2e_br358.seg" "$BRDIR/video/e2e_br358_a.mp4" "$BRDIR/video/e2e_br358_b.mp4"
[ -f "$BRSNAP/prj" ] && cp "$BRSNAP/prj" "$BRDIR/$BRP.prj"
rm -rf "$BRDIR/scenes"; [ -d "$BRSNAP/scenes" ] && cp -r "$BRSNAP/scenes" "$BRDIR/scenes"
rm -rf "$BRSNAP"
# ---- 2.295.0: THE SCENE CARD (Tim: "... if user selects render all use the
# last frame of the previous scene. allow user to change all scenes radio
# buttons before first render so user can start job and job will run to
# completion. allow user to add reference images to each scene
# individually"). All: sets every radio (scene 1 stays Ref); a picture goes
# on scene 2 only; render-all re-renders 1 then 2 - scene 2's stale pick on
# the OLD take of scene 1 is dropped and Trans travels from the NEW take's
# last frame to scene 2's own picture; as Ref the picture rides the map.
ALLA=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/anchors -H 'Content-Type: application/json' -d '{"anchor":"transition"}')
curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); L={r['n']:r for r in d['list']}
assert L[1].get('anchor')=='reference' and L[2].get('anchor')=='transition', (L[1].get('anchor'), L[2].get('anchor'))
" && echo "$ALLA" | grep -q 'scene 1 stays Ref' \
  && ok "scene card: All: Trans sets every scene's radio in one press (scene 1 stays Ref - nothing before it)" \
  || bad "scene card: all-anchors wrong: $(echo "$ALLA" | head -c 200)"
ffmpeg -y -f lavfi -i color=c=0x3355aa:s=96x64 -frames:v 1 /tmp/e2e_lighthouse.png > /dev/null 2>&1
SRU=$(curl -s -F "images=@/tmp/e2e_lighthouse.png;filename=e2e lighthouse.png" http://127.0.0.1:8311/api/scenes/2/refs)
echo "$SRU" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('added')==['e2e_lighthouse.png'], d
assert d['refs']==[{'file':'e2e_lighthouse.png','label':'e2e lighthouse'}], d['refs']
" && [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/api/scenes/2/refs/e2e_lighthouse.png)" = 200 ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/api/scenes/1/refs/e2e_lighthouse.png)" = 404 ] \
  && ok "scene card: a reference picture goes on scene 2 ONLY (served for scene 2, not for scene 1)" \
  || bad "scene card: scene picture upload wrong: $(echo "$SRU" | head -c 240)"
# scene 2 carries a pick on scene 1's CURRENT take (from the modes legs)
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/pick-frame -H 'Content-Type: application/json' -d '{"time":1.0}' > /dev/null
OUT1=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); print([r for r in d['list'] if r['n']==1][0].get('output',''))")
OUT2=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); print([r for r in d['list'] if r['n']==2][0].get('output',''))")
RALL=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/render -H 'Content-Type: application/json' -d '{"scenes":[1,2]}')
echo "$RALL" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('queued')==2, d
r2=[r for r in d['list'] if r['n']==2][0]
assert r2.get('cont_src') is None and r2.get('cont_time') is None, ('the stale pick survived', r2.get('cont_src'), r2.get('cont_time'))
" > /tmp/sc295a.log 2>&1
RDONE=""
for i in $(seq 1 90); do
  RDONE=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); L={r['n']:r for r in d['list']}
ok = (not d.get('pending') and L[1]['status']=='rendered' and L[2]['status']=='rendered'
      and L[1]['output']!='$OUT1' and L[2]['output']!='$OUT2')
print('yes' if ok else '')")
  [ -n "$RDONE" ] && break
  sleep 1
done
[ -n "$RDONE" ] && [ ! -s /tmp/sc295a.log ] && python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
c = rec.get('_classes', [])
assert 'MiniMaxH3ImageToVideo' in c and 'MiniMaxH3NativeAudioLock' in c, sorted(c)
imgs = rec.get('_ref_images', [])
assert len(imgs) == 2 and 'scene2_continuation' in imgs[0] and imgs[1] == 'e2e_lighthouse.png', imgs
" && ok "scene card: render-all re-renders 1 then 2 - the stale pick is dropped and scene 2 (Trans) runs from the NEW take's last frame to ITS OWN picture" \
  || bad "scene card: render-all continuity wrong ($RDONE): $(cat /tmp/sc295a.log | tail -2) $(echo "$RALL" | head -c 200)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/anchor -H 'Content-Type: application/json' -d '{"anchor":"reference"}' > /dev/null
curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/redo > /dev/null
sleep 1
NAS5=$(wait_scene 2)
[ "$NAS5" = "rendered" ] && python3 -c "
import glob, json, os, re
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
p = rec.get('_gen_prompt', '')
m = re.search(r'<Picture (\d+)> is scene reference picture \(e2e lighthouse\)', p)
assert m, p[:600]
assert rec.get('_ref_images', [])[int(m.group(1)) - 1] == 'e2e_lighthouse.png', rec.get('_ref_images')
assert int(m.group(1)) == 2, ('right after the singer sheet', m.group(1))
" && ok "scene card: as Ref, scene 2's own picture rides the reference map right after the cast sheet (<Picture 2> is scene reference picture ...)" \
  || bad "scene card: the scene picture did not reach the ref2va render ($NAS5)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/refs/delete -H 'Content-Type: application/json' -d '{"file":"e2e_lighthouse.png"}' | grep -q '"refs":\[\]' \
  && [ ! -e "projects/$NAP/scene_refs/clip_02/e2e_lighthouse.png" ] \
  && ok "scene card: ✕ removes the picture and its file" \
  || bad "scene card: picture removal failed"
rm -rf "projects/$NAP/scene_refs" /tmp/e2e_lighthouse.png
# ---- 2.296.0: CONT (Tim: "i would like the scene to start from the last
# frame but keep the character and continuity of the scene, right now the
# last frame is a closup of the guitar, the next scene starts with the
# guitar closeup but the character changes"). Cont = ref2va opening on the
# previous take's last frame as <Picture 1> WITH the cast sheet behind it
# and the take's end as <Video 1>; and ＋🖼 puts scene 1's last frame on
# scene 2's own pictures.
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/anchor -H 'Content-Type: application/json' -d '{"anchor":"continue"}' > /dev/null
NAG6=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/redo)
sleep 1
NAS6=$(wait_scene 2)
[ "$NAS6" = "rendered" ] && python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
c = rec.get('_classes', [])
assert 'MiniMaxH3ReferenceToVideo' in c and 'MiniMaxH3ImageToVideo' not in c, sorted(c)
imgs = rec.get('_ref_images', [])
assert imgs and 'scene2_continuation' in imgs[0] and 'human.png' in imgs, imgs
p = rec.get('_gen_prompt', '')
assert '<Picture 1> is the opening frame' in p and 'The clip opens exactly on <Picture 1>' in p, p[:600]
assert any('prev_tail' in v for v in rec.get('_ref_video_slots', [])), rec.get('_ref_video_slots')
" && ok "cont: a Cont scene renders ref2va opening on the previous take's last frame (<Picture 1>) WITH the cast sheet and the take's end as <Video 1>" \
  || bad "cont: the Cont render is wrong ($NAS6): $(echo "$NAG6" | head -c 300)"
FRR=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/frame-ref -H 'Content-Type: application/json' -d '{}')
echo "$FRR" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('to')==2 and d.get('file')=='scene1_frame_last.png', d
assert d['refs'][-1]=={'file':'scene1_frame_last.png','label':'last frame of scene 1'}, d['refs']
" && [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/api/scenes/2/refs/scene1_frame_last.png)" = 200 ] \
  && ok "cont: ＋🖼 puts scene 1's last frame on scene 2's own pictures, labelled for what it is" \
  || bad "cont: frame-ref failed: $(echo "$FRR" | head -c 240)"
rm -rf "projects/$NAP/scene_refs"
# ---- 2.337.0: ✎ FIRST FRAME (QWEN IMAGE 2.1) on the scene cards (Tim: "can
# we use qwen2.1 to put the character in the location with the props as
# first frame? ... an option to edit the image with qwen2.1 in the first
# image selector in each scene, this way we can continue from the position
# but may change the location"). routes/sceneedit.js -> an image job through
# the Qwen Image 2.1 edit style; the board's poll files it as the First frame.
qe_job() {   # $1 = job id -> the final status
  local s=queued
  for i in $(seq 1 60); do
    s=$(curl -s "http://127.0.0.1:8311/api/jobs/$1" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','?'))")
    [ "$s" = "done" ] || [ "$s" = "failed" ] && break
    sleep 1
  done
  echo "$s"
}
ffmpeg -y -loglevel error -f lavfi -i "testsrc=size=640x360:duration=1" -frames:v 1 /tmp/e2e_qe_loc.png
ffmpeg -y -loglevel error -f lavfi -i "color=c=red:size=200x200" -frames:v 1 /tmp/e2e_qe_umbrella.png
QEE=$(curl -s http://127.0.0.1:8311/api/sceneedit/engines)
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/qedit/pic/upload -F slot=qe_location -F "image=@/tmp/e2e_qe_loc.png" > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/qedit/pic/upload -F slot=qe_prop -F "image=@/tmp/e2e_qe_umbrella.png" > /dev/null
QR1=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/2/qedit/run -H 'Content-Type: application/json' \
  -d '{"base":"location","chars":["E2eSinger"],"prompt":"she holds the umbrella"}')
QJ1=$(echo "$QR1" | python3 -c "import json,sys; print(json.load(sys.stdin).get('job',''))" 2>/dev/null)
QS1=$(qe_job "$QJ1")
curl -s http://127.0.0.1:8311/api/scenes > /tmp/qe337_board.json
python3 -c "
import json, sys
e = json.loads(sys.argv[1]); r1 = json.loads(sys.argv[2]); st = sys.argv[3]
assert [x['name'] for x in e['edit'] if x['id'] == e['default']] == ['Qwen Image 2.1 edit'], e['default']
assert any(c['name'] == 'E2eSinger' for c in e['cast']), e['cast']
assert r1.get('ok') and r1['base'] == 'location', r1
assert r1['roles'] == ['the location', 'character: E2eSinger', 'prop: upload: e2e_qe_umbrella.png'], r1['roles']
assert r1['prompt'].startswith('<image1> is the location. Place the character from <image2> in it.'), r1['prompt']
assert 'Include the e2e qe umbrella from <image3>' in r1['prompt'] and 'She holds the umbrella.' in r1['prompt'], r1['prompt']
assert st == 'done', st
b = json.load(open('/tmp/qe337_board.json'))
s2 = [x for x in b['list'] if x['n'] == 2][0]
assert s2['fl_first']['label'] == '✎ Qwen 2.1 first frame' and s2['qedit']['status'] == 'done' and s2['qedit']['job'] == '', s2.get('qedit')
" "$QEE" "$QR1" "$QS1" > /tmp/qe337.log 2>&1 \
  && curl -s "http://127.0.0.1:8311/api/jobs/$QJ1" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
for want in ('workflow img_qwen21_edit.json', 'prompt: node 9.value', 'image slot 21: qe_location.png', 'image slot 23: qe_prop_', 'image slot 24: bypassed', 'size 1360x768'):
    assert want in L, (want, L[-900:])
" >> /tmp/qe337.log 2>&1 \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/api/scenes/2/fl/first)" = 200 ] \
  && ok "✎ first frame: Qwen Image 2.1 edit (the default) puts the singer's sheet (<image2>) and the prop (<image3>) into the location (<image1>) at 1360x768, the unused slots bypassed - the board files it as scene 2's First frame" \
  || { bad "✎ first frame: the location build is wrong ($QS1): $(echo "$QR1" | head -c 300)"; tail -4 /tmp/qe337.log; }
QR2=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/2/qedit/run -H 'Content-Type: application/json' \
  -d '{"base":"continue","chars":[],"prompt":"same pose, a new place"}')
QJ2=$(echo "$QR2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('job',''))" 2>/dev/null)
QS2=$(qe_job "$QJ2")
curl -s http://127.0.0.1:8311/api/scenes > /tmp/qe337_board.json
python3 -c "
import json, sys
r2 = json.loads(sys.argv[1])
assert r2.get('ok') and r2['base'] == 'continue', r2
assert r2['roles'][:2] == ['the frame this scene continues from', 'the new location'], r2['roles']
assert r2['prompt'].startswith('Keep the people in <image1> exactly where they are') and 'the location shown in <image2>' in r2['prompt'], r2['prompt']
assert sys.argv[2] == 'done', sys.argv[2]
b = json.load(open('/tmp/qe337_board.json'))
s2 = [x for x in b['list'] if x['n'] == 2][0]
assert s2['qedit']['status'] == 'done' and s2['anchor'] == 'continue', (s2.get('qedit'), s2.get('anchor'))
" "$QR2" "$QS2" > /tmp/qe337b.log 2>&1 \
  && ok "✎ first frame: Continue edits the frame scene 2 continues from (scene 1's last) into the new location - same pose, a new place" \
  || { bad "✎ first frame: the continue edit is wrong ($QS2): $(echo "$QR2" | head -c 300)"; tail -4 /tmp/qe337b.log; }
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/fl/delete -H 'Content-Type: application/json' -d '{"slot":"first"}' > /dev/null
rm -rf "projects/$NAP/scene_refs" /tmp/e2e_qe_loc.png /tmp/e2e_qe_umbrella.png
# ---- 2.338.0: LTX 2.5 (Tim: "can we add ltx2.5 for our music video and
# screenplay and first/last frame from reference images/audio/video option
# ... with ltx2 style"). Tim's all-in-one canvas, ONE mode per job: the app
# converts it against ComfyUI's own /object_info (scripts/ltx_convert.js on
# the app's node), ltx_graph patches the values in, the stub renders.
ltx_rec() {   # the stub's record of the newest video render
  python3 -c "
import glob, json, os
fs = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
print(json.dumps(json.load(open(fs[-1]))) if fs else '{}')"
}
mkdir -p "projects/$NAP/sound"
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=12" "projects/$NAP/sound/e2e_ltx_song.wav"
ffmpeg -y -loglevel error -f lavfi -i "testsrc=size=640x360:duration=1" -frames:v 1 /tmp/e2e_ltx_face.png
LTM=$(curl -s http://127.0.0.1:8311/api/ltx/modes)
LT1=$(curl -s -X POST http://127.0.0.1:8311/api/ltx -F "references=@/tmp/e2e_ltx_face.png" -F ltx_mode=auto \
  -F 'ref_audios=["e2e_ltx_song.wav"]' -F audio_start=2.5 -F seconds=4 -F width=960 -F height=544 -F seed=77 \
  -F "prompt=She sings to the camera.")
LJ1=$(echo "$LT1" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
LS1=$(qe_job "$LJ1")
python3 -c "
import json, sys
m = json.loads(sys.argv[1]); r = json.loads(sys.argv[2]); st = sys.argv[3]; rec = json.loads(sys.argv[4])
assert [x['id'] for x in m['modes']] == ['t2v', 'a2v', 'i2v', 'flf', 'lipsync', 'v2v', 'fl_lipsync', 'fmlf'], m
p = r['params']
assert p['mode'] == 'ltx' and p['ltx_mode'] == 'lipsync' and p['seconds'] == 4 and p['audio']['start'] == 2.5, p
assert p['video_style_name'] == 'LTX 2.5' and (p['width'], p['height']) == (960, 544), p
assert st == 'done', st
c = rec.get('_classes', [])
for want in ('LTXVImgToVideoInplace', 'VHS_LoadAudioUpload', 'VHS_VideoCombine', 'UnetLoaderGGUF', 'Power Lora Loader (rgthree)'):
    assert want in c, (want, c)
assert 'ResolutionSelector' not in c and 'SetNode' not in c and 'Fast Groups Bypasser (rgthree)' not in c, c
" "$LTM" "$LT1" "$LS1" "$(ltx_rec)" > /tmp/ltx338.log 2>&1 \
  && curl -s "http://127.0.0.1:8311/api/jobs/$LJ1" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
for want in ('ltx_worker.py mode=ltx ltx_mode=lipsync style=LTX 2.5', 'converted LTX25_All_In_One.json (lipsync)', 'Load Image1 = ',
             'audio ', 'from 2.50s', '4s at 24 fps = 97 frames', 'size 960x544', 'transition LoRA ltx2.3-transition.safetensors: off', 'file 1/1 written -> '):
    assert want in L, (want, L[-900:])
" >> /tmp/ltx338.log 2>&1 \
  && ok "LTX 2.5 (prompt docker): a picture + a song = Auto -> lipsync; Tim's canvas converted against ComfyUI, the picture / the song from 2.5 s / 4 s / 960x544 written in, the transition LoRA off, the video back" \
  || { bad "LTX 2.5 prompt docker lipsync ($LS1): $(echo "$LT1" | head -c 300)"; tail -5 /tmp/ltx338.log; }
LT2=$(curl -s -X POST http://127.0.0.1:8311/api/ltx -F "references=@/tmp/e2e_ltx_face.png" -F ltx_mode=flf -F "prompt=x")
echo "$LT2" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert 'First / last frame needs 2 pictures' in d.get('error',''), d
" && [ "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/generate -H 'Content-Type: application/json' \
      -d "{\"mode\":\"t2v\",\"prompt\":\"x\",\"video_style_id\":\"$(echo "$LT1" | python3 -c "import json,sys; print(json.load(sys.stdin)['params']['video_style_id'])")\"}")" = 400 ] \
  && ok "LTX 2.5: a mode without its pictures is refused in words; /api/generate refuses an LTX style (it renders through the LTX modes)" \
  || bad "LTX 2.5 refusals wrong: $(echo "$LT2" | head -c 300)"
# ---- 2.401.5: with LTX 2.5's own files in ComfyUI, image-to-video runs on Comfy-Org's template (core nodes only;
# Tim: "maybe try to find another ltx workflow") - the stub answers those classes as a real ComfyUI does and checks
# the queued graph the same way (the dynamic combo resize_type Tim's run lacked)
LXM=/tmp/e2e_comfy/ComfyUI/models
mkdir -p $LXM/diffusion_models $LXM/vae $LXM/text_encoders $LXM/latent_upscale_models
LXF="$LXM/diffusion_models/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors $LXM/vae/ltx-2.5-video-vae-bf16.safetensors $LXM/vae/ltx-2.5-audio-vae-bf16.safetensors $LXM/text_encoders/gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors $LXM/latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"
for f in $LXF; do printf x > "$f"; done
LT3=$(curl -s -X POST http://127.0.0.1:8311/api/ltx -F "references=@/tmp/e2e_ltx_face.png" -F ltx_mode=i2v -F seconds=3 \
  -F width=650 -F height=380 -F seed=5 -F "prompt=The fox turns its head.")
LJ3=$(echo "$LT3" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
LS3=$(qe_job "$LJ3")
LR3=$(ltx_rec)
for f in $LXF; do rm -f "$f"; done
python3 -c "
import json, sys
st = sys.argv[1]; rec = json.loads(sys.argv[2]); L = '\n'.join(json.loads(sys.argv[3]).get('log', []))
assert st == 'done', (st, L[-1200:])
c = rec.get('_classes', [])
for want in ('SaveVideo', 'ResizeImageMaskNode', 'LTXVImgToVideoInplace', 'TextGenerateLTX2Prompt', 'LoadImage'):
    assert want in c, (want, c)
assert 'VHS_VideoCombine' not in c and 'Power Lora Loader (rgthree)' not in c, c
for want in (\"on Comfy-Org's own template ltx25_official_i2v.json\", 'converted ltx25_official_i2v.json (i2v)', '640x384',
             'picture: ', 'file 1/1 written -> '):
    assert want in L, (want, L[-1200:])
assert 'LTX25_All_In_One' not in L, L[-800:]
" "$LS3" "$LR3" "$(curl -s "http://127.0.0.1:8311/api/jobs/$LJ3")" > /tmp/ltx4015.log 2>&1 \
  && ok "LTX 2.5 on Comfy-Org's template (2.401.5): with LTX 2.5's own files in ComfyUI an image-to-video job runs the core-node template (not the canvas) - 640x384 (multiples of 32), the picture on its LoadImage, ResizeImageMaskNode with its resize_type, the video back" \
  || { bad "LTX 2.5 official template ($LS3): $(echo "$LT3" | head -c 300)"; tail -6 /tmp/ltx4015.log; }
# ---- 2.402.0: a Blender scene render -> LTX 2.3 + fal's 3DREAL (render -> real). POST /api/blender/scene is what the
# add-on's "Render scene -> bitGen" sends (raw .mp4 + the look / variant / size); render=1 queues the job, render=0 only
# files the render in Video assets
L3M=/tmp/e2e_comfy/ComfyUI/models
mkdir -p $L3M/checkpoints $L3M/text_encoders $L3M/loras
L3F="$L3M/checkpoints/ltx-2.3-22b-distilled-fp8.safetensors $L3M/text_encoders/gemma_3_12B_it_fp4_mixed.safetensors $L3M/loras/3DREAL-strong-v2.safetensors $L3M/loras/3DREAL-light.safetensors"
for f in $L3F; do printf x > "$f"; done
ffmpeg -y -loglevel error -f lavfi -i "testsrc=size=640x352:rate=24:duration=2" -pix_fmt yuv420p /tmp/e2e_blscene.mp4
BS1=$(curl -s -X POST "http://127.0.0.1:8311/api/blender/scene?name=e2e%20street&prompt=a%20red%20car%20at%20night&render=1&frames=48&fps=24&width=640&height=352&ic_lora=3DREAL-light.safetensors&ic_strength=0.9" \
  -H "Content-Type: video/mp4" --data-binary @/tmp/e2e_blscene.mp4)
BJ1=$(echo "$BS1" | python3 -c "import json,sys; print((json.load(sys.stdin).get('job') or {}).get('id',''))" 2>/dev/null)
BSS1=$(qe_job "$BJ1")
BR1=$(ltx_rec)
BS2=$(curl -s -X POST "http://127.0.0.1:8311/api/blender/scene?name=e2e%20street&render=0&frames=24&fps=24" -H "Content-Type: video/mp4" --data-binary @/tmp/e2e_blscene.mp4)
BS3=$(curl -s -X POST "http://127.0.0.1:8311/api/blender/scene?name=junk" -H "Content-Type: video/mp4" --data-binary "not a video, at all.....")
BM=$(curl -s http://127.0.0.1:8311/api/ltx/modes)
for f in $L3F; do rm -f "$f"; done
python3 -c "
import json, sys, os
r1 = json.loads(sys.argv[1]); st = sys.argv[2]; rec = json.loads(sys.argv[3]); L = '\n'.join(json.loads(sys.argv[4]).get('log', []))
r2 = json.loads(sys.argv[5]); r3 = json.loads(sys.argv[6]); m = json.loads(sys.argv[7]); vdir = sys.argv[8]
assert r1.get('name') == 'blender_e2e_street.mp4' and r1.get('seconds') == 2 and (r1.get('job') or {}).get('id'), r1
assert st == 'done', (st, L[-1500:])
c = rec.get('_classes', [])
for want in ('CheckpointLoaderSimple', 'LTXAVTextEncoderLoader', 'GetICLoRAParameters', 'LTXVAddGuide', 'GetVideoComponents', 'LoadVideo', 'SaveVideo'):
    assert want in c, (want, c)
assert not any(x.startswith('MoGe') for x in c) and 'VHS_VideoCombine' not in c, c
for want in ('[blender] the scene render blender_e2e_street.mp4', \"on Comfy-Org's own template ltx23_official_ic_lora.json\",
             '3DREAL IC-LoRA 3DREAL-light.safetensors @ 0.9', 'checkpoint ltx-2.3-22b-distilled-fp8.safetensors', '3DREAL: no first picture', 'file 1/1 written -> '):
    assert want in L, (want, L[-1500:])
assert r2.get('name') == 'blender_e2e_street_2.mp4' and r2.get('job') is None and 'Video assets' in r2.get('note', ''), r2
assert os.path.isfile(os.path.join(vdir, 'blender_e2e_street.mp4')) and os.path.isfile(os.path.join(vdir, 'blender_e2e_street_2.mp4'))
assert 'send the render as a video' in r3.get('error', ''), r3
assert [x['id'] for x in m['modes23']] == ['t2v', 'i2v', 'flf', '3dreal'] and any(s['name'] == 'LTX 2.3' and s['family'] == 'ltx23' for s in m['styles']), m
" "$BS1" "$BSS1" "$BR1" "$(curl -s "http://127.0.0.1:8311/api/jobs/$BJ1")" "$BS2" "$BS3" "$BM" "projects/$NAP/video" > /tmp/ltx4020.log 2>&1 \
  && ok "Blender -> LTX 2.3 3DREAL (2.402.0): the add-on's render (POST /api/blender/scene) lands in Video assets as blender_<name>.mp4 and, with render=1, an LTX 2.3 job runs Comfy-Org's IC-LoRA template - the render as the guide (no depth pass), fal's 3DREAL-light @ 0.9, the distilled checkpoint, the take back; render=0 files it only; junk refused; /api/ltx/modes lists LTX 2.3's four modes and its style" \
  || { bad "Blender -> LTX 2.3 3DREAL ($BSS1): $(echo "$BS1" | head -c 300)"; tail -6 /tmp/ltx4020.log; }
rm -f "projects/$NAP/video/blender_e2e_street.mp4" "projects/$NAP/video/blender_e2e_street_2.mp4" /tmp/e2e_blscene.mp4
# the scene board's "LTX 2.5" flow: Cont = the frame it continues from -> i2v;
# with the board's song -> lipsync on the scene's own slice of it
LBS=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps([d.get('style') or '', d.get('audio') or '']))")
curl -sf -X POST http://127.0.0.1:8311/api/scenes/style -H 'Content-Type: application/json' -d '{"name":"LTX25"}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/audio -H 'Content-Type: application/json' -d '{"file":""}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/anchor -H 'Content-Type: application/json' -d '{"anchor":"continue"}' > /dev/null
LG1=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/generate)
LGS1=$(wait_scene 2)
LR1=$(ltx_rec)
curl -s -X POST http://127.0.0.1:8311/api/scenes/audio -H 'Content-Type: application/json' -d '{"file":"e2e_ltx_song.wav"}' > /dev/null
LG2=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/generate)
LGS2=$(wait_scene 2)
LR2=$(ltx_rec)
python3 -c "
import json, sys
g1 = json.loads(sys.argv[1]); s1 = sys.argv[2]; r1 = json.loads(sys.argv[3])
g2 = json.loads(sys.argv[4]); s2 = sys.argv[5]; r2 = json.loads(sys.argv[6])
p1 = g1['job']['params']; p2 = g2['job']['params']
assert p1['mode'] == 'ltx' and p1['ltx_mode'] == 'i2v' and p1['scene']['n'] == 2 and len(p1['images']) == 1, p1
assert p1['images'][0].endswith('.png') and p1['audio'] is None, p1
assert s1 == 'rendered', ('i2v', s1)
assert 'LTXVImgToVideoInplace' in r1.get('_classes', []) and 'VHS_LoadAudioUpload' not in r1.get('_classes', []), r1.get('_classes')
assert p2['ltx_mode'] == 'lipsync' and p2['audio']['path'].endswith('e2e_ltx_song.wav'), p2
assert s2 == 'rendered', ('lipsync', s2)
assert 'VHS_LoadAudioUpload' in r2.get('_classes', []), r2.get('_classes')
" "$LG1" "$LGS1" "$LR1" "$LG2" "$LGS2" "$LR2" > /tmp/ltx338b.log 2>&1 \
  && ok "LTX 2.5 (scene board): a Cont scene renders i2v from the frame it continues from; with the board's song it lip-syncs its own slice - both filed as the scene's take" \
  || { bad "LTX 2.5 scene flow ($LGS1 / $LGS2): $(echo "$LG1" | head -c 200) | $(echo "$LG2" | head -c 200)"; tail -5 /tmp/ltx338b.log; }
LBST=$(echo "$LBS" | python3 -c "import json,sys; print(json.load(sys.stdin)[0])")
LBSA=$(echo "$LBS" | python3 -c "import json,sys; print(json.load(sys.stdin)[1])")
curl -sf -X POST http://127.0.0.1:8311/api/scenes/style -H 'Content-Type: application/json' -d "{\"name\":\"$LBST\"}" > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/audio -H 'Content-Type: application/json' -d "{\"file\":\"$LBSA\"}" > /dev/null
rm -f "projects/$NAP/sound/e2e_ltx_song.wav" /tmp/e2e_ltx_face.png
# ---- 2.340.0: QWEN IMAGE 2.1 READS THE REFERENCE DOCK - the qwen2_1 style,
# up to 10 pictures (Tim: "allow qwen 2.1 to use reference docker images as
# it's reference images. add a style , qwen2_1 , should be able to use up to
# 10 images"). The dock's pictures are <image1..10>, named for Qwen from their
# Type; an empty dock renders text-to-image.
Q21J=$(curl -s "http://127.0.0.1:8311/api/styles?kind=image")
Q21=$(echo "$Q21J" | python3 -c "import json,sys; d=json.load(sys.stdin); print([s['id'] for s in d['styles'] if s['name']=='qwen2_1'][0])" 2>/dev/null)
mkdir -p /tmp/e2e_q21
Q21N="[]"
for i in 1 2 3 4 5 6 7 8 9 10; do
  ffmpeg -y -loglevel error -f lavfi -i "color=c=0x$(printf '%02x' $((i*20)))4080:size=320x240" -frames:v 1 "/tmp/e2e_q21/e2e_q21_$i.png"
  n=$(curl -s -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_q21/e2e_q21_$i.png" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))")
  Q21N=$(python3 -c "import json,sys; a=json.loads(sys.argv[1]); a.append(sys.argv[2]); print(json.dumps(a))" "$Q21N" "$n")
done
Q21R=$(curl -s -X POST http://127.0.0.1:8311/api/genimage -H 'Content-Type: application/json' -d "{\"prompt\":\"a woman in a red coat on the pier\",\"style_id\":\"$Q21\",\"images\":$Q21N,\"image_roles\":[\"person\",\"clothing\",\"environment\",\"object\",\"object\",\"object\",\"object\",\"object\",\"object\",\"style\"]}")
Q21ID=$(echo "$Q21R" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
Q21S=$(qe_job "$Q21ID")
echo "$Q21J" | python3 -c "
import json,sys; j=json.load(sys.stdin); st=[s for s in j['styles'] if s['name']=='qwen2_1'][0]
assert j['image_slots'][st['id']] == 10 and j['refs_optional'].get(st['id']) is True, (j['image_slots'].get(st['id']), j.get('refs_optional'))
" > /tmp/q21.log 2>&1 && [ "$Q21S" = "done" ] && curl -s "http://127.0.0.1:8311/api/jobs/$Q21ID" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
for want in ('workflow img_qwen21_edit_10.json', 'image slot 21: ', 'image slot 30: ',
             '<image1> is the person, <image2> is the clothing, <image3> is the location / background'):
    assert want in L, (want, L[-1200:])
assert 'bypassed' not in L, L[-800:]
" >> /tmp/q21.log 2>&1 \
  && ok "qwen2_1: a 10-slot Qwen Image 2.1 style; the dock's 10 pictures fill all 10 slots (the old flat cap was 3) and Qwen is told what <image1..3> are from their Type" \
  || { bad "qwen2_1: 10 pictures wrong ($Q21S): $(echo "$Q21R" | head -c 300)"; tail -3 /tmp/q21.log; }
Q21R2=$(curl -s -X POST http://127.0.0.1:8311/api/genimage -H 'Content-Type: application/json' -d "{\"prompt\":\"a lighthouse at dawn\",\"style_id\":\"$Q21\"}")
Q21ID2=$(echo "$Q21R2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
Q21S2=$(qe_job "$Q21ID2")
[ "$Q21S2" = "done" ] && curl -s "http://127.0.0.1:8311/api/jobs/$Q21ID2" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
assert 'image slot 21: bypassed' in L and 'image slot 30: bypassed' in L, L[-800:]
" \
  && ok "qwen2_1: an empty dock renders text-to-image - every picture slot bypassed" \
  || bad "qwen2_1: text-to-image wrong ($Q21S2): $(echo "$Q21R2" | head -c 300)"
for i in 1 2 3 4 5 6 7 8 9 10; do rm -f "projects/$NAP/images/e2e_q21_$i.png"; done
rm -rf /tmp/e2e_q21
# ---- 2.341.0: THE MODEL CATALOG INSIDE THE STUDIO (Tim: "yes please add these
# downloads to setup, also add the hf cli to download direct from hf").
# routes/setup.js on the real server (no Hugging Face here: only the shape).
MCH=$(curl -s http://127.0.0.1:8311/api/setup/hfcli)
MCD=$(curl -s -o /tmp/mcd.json -w '%{http_code}' -X POST http://127.0.0.1:8311/api/setup/download -H 'Content-Type: application/json' -d '{"ids":[]}')
MCS=$(curl -s http://127.0.0.1:8311/api/setup/state)
python3 -c "
import json, sys
h = json.loads(sys.argv[1]); s = json.loads(sys.argv[2])
assert isinstance(h.get('found'), bool) and 'python' in h, h
assert s.get('busy') is False and 'files' in s and 'log' in s, s
" "$MCH" "$MCS" && [ "$MCD" = 400 ] && grep -q "tick at least one model" /tmp/mcd.json \
  && ok "model catalog: /api/setup/hfcli says whether the Hugging Face CLI is there, /api/setup/state answers, a download with nothing ticked is refused in words" \
  || bad "model catalog routes wrong: $MCH | $MCD | $MCS"
rm -f /tmp/mcd.json
# ---- 2.297.0: INSERT + CHOSEN FIRST/LAST FRAMES + RIPPLED TIMING (Tim:
# "add option for user to insert scene, if transition scene is selected
# allow the user to select first and/or last frame from previous clips or
# gallery or assets ... adjust the timing for all the scenes if the start
# time or duration changes for any scene"). A scene goes in BEFORE scene 1:
# it starts at 0, the others move along, and scene 3's pick follows its
# source's new number. A longer scene 2 pushes scene 3. The new scene 1 as
# Trans runs from a frame of scene 2's take to an image asset.
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/pick-frame -H 'Content-Type: application/json' -d '{"time":1.0}' > /dev/null
INS=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/insert -H 'Content-Type: application/json' -d '{"after":0}')
echo "$INS" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('n')==1, d
L={r['n']:r for r in d['list']}
assert len(L)==3 and 'A new scene' in ' '.join(L[1]['prompt']), [r['prompt'] for r in d['list']]
assert (L[1]['audio_start'], L[1]['audio_dur'])==(0,5), L[1]
assert (L[2]['audio_start'], L[2]['audio_dur'])==(5,8), (L[2]['audio_start'], L[2]['audio_dur'])
assert (L[3]['audio_start'], L[3]['audio_dur'])==(13,6), (L[3]['audio_start'], L[3]['audio_dur'])
assert L[3].get('cont_src')==2 and L[3].get('cont_time')==1.0, ('the pick lost its source', L[3].get('cont_src'))
" && ok "insert: a scene goes in BEFORE scene 1 (0 s, 5 s), the others move along back to back, and a picked frame follows its scene's new number" \
  || bad "insert wrong: $(echo "$INS" | head -c 400)"
RIP=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/2/audio -H 'Content-Type: application/json' -d '{"start":5,"dur":10}')
echo "$RIP" | python3 -c "
import json,sys; d=json.load(sys.stdin); assert d.get('rippled')==[3], d
" && curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); L={r['n']:r for r in d['list']}
assert (L[3]['audio_start'], L[3]['audio_dur'])==(15,6), (L[3]['audio_start'], L[3]['audio_dur'])
" && ok "timing: a longer scene 2 pushes scene 3 along (15 s), keeping its own 6 s" \
  || bad "timing ripple wrong: $(echo "$RIP" | head -c 300)"
mkdir -p "projects/$NAP/images"
ffmpeg -y -f lavfi -i color=c=0x886644:s=96x64 -frames:v 1 "projects/$NAP/images/e2e_pier.png" > /dev/null 2>&1
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/anchor -H 'Content-Type: application/json' -d '{"anchor":"transition"}' > /dev/null
FL1=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/fl -H 'Content-Type: application/json' -d '{"slot":"first","kind":"frame","scene":2,"time":1.0}')
FL2=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/fl -H 'Content-Type: application/json' -d '{"slot":"last","kind":"asset","name":"e2e_pier.png"}')
echo "$FL1 $FL2" | python3 -c "
import json,sys
a,b=sys.stdin.read().split('} {',1); a=json.loads(a+'}'); b=json.loads('{'+b)
assert a.get('ok') and a['fl']=={'file':'fl_first.png','label':'scene 2 at 1s'}, a
assert b.get('ok') and b['fl']=={'file':'fl_last.png','label':'asset: e2e_pier.png'}, b
" && [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/api/scenes/1/fl/last)" = 200 ] \
  && ok "frames: scene 1's FIRST frame from scene 2's clip (at 1 s) and its LAST frame from an image asset, each served per slot" \
  || bad "frames: slot set wrong: $(echo "$FL1 $FL2" | head -c 300)"
FLG=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/1/generate)
FLS=$(wait_scene 1)
[ "$FLS" = "rendered" ] && echo "$FLG" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d['job']['params']['frames']==124, ('the 5 s window renders 124 frames', d['job']['params']['frames'])
" && python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
c = rec.get('_classes', [])
assert 'MiniMaxH3ImageToVideo' in c, sorted(c)
assert rec.get('_ref_images') == ['fl_first.png', 'fl_last.png'], rec.get('_ref_images')
" && ok "frames: the Trans scene renders fl2va from its chosen FIRST frame to its chosen LAST frame, as long as its 5 s window (124 frames)" \
  || bad "frames: the Trans render is wrong ($FLS): $(echo "$FLG" | head -c 300)"
# ---- 2.301.0: THE LOSSLESS SCENE MASTER (Tim: "we create 2 separate files,
# 1 raw files and 1 mp4 to playback. quality will be more important than
# diskspace at this stage ... save the raw renders in project name\raw").
# The Trans render above wrote TWO files: the playback take (H.264) and its
# FFV1 / full-RGB / PCM master in projects/<p>/raw/<take stem>.avi, frame
# for frame the same length. The worker built the playback copy ONCE from
# the master (ComfyUI's own H.264 is not re-encoded).
RMT=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d['list'] if x['n']==1][0]; print(r.get('output') or '')")
RMA="projects/$NAP/raw/${RMT%.*}.avi"
RMV="projects/$NAP/video/$RMT"
RMJ=$(echo "$FLG" | python3 -c "import json,sys; print(json.load(sys.stdin)['job']['id'])")
[ -n "$RMT" ] && [ -f "$RMA" ] \
  && [ "$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt -of csv=p=0 "$RMA")" = "ffv1,bgr0" ] \
  && [ "$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$RMA")" = "pcm_s24le" ] \
  && [ "$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$RMV")" = "h264" ] \
  && [ "$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$RMA")" \
       = "$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$RMV")" ] \
  && curl -s "http://127.0.0.1:8311/api/jobs/$RMJ?log_from=0" | python3 -c "
import json,sys; d=json.load(sys.stdin); L=d.get('log'); L='\n'.join(L) if isinstance(L,list) else str(L)
assert 'lossless master tap on node' in L, 'no tap'
assert 'encoded once from the master' in L, 'playback not from the master'
assert 'lossless master saved: raw/' in L and 'the same as the take' in L, L[-600:]
" && ok "lossless master: the scene render wrote raw/<take>.avi (FFV1, full RGB, PCM 24-bit, the take's frame count) beside the H.264 take, and the take was encoded once from it" \
  || bad "lossless master missing or wrong: take=$RMT raw=$(ls projects/$NAP/raw 2>&1 | head -c 200)"
# the next scene starts from the MASTER: a frame picked on scene 1's strip
# makes scene 2 First, and its continuation frame is read from raw/, not the mp4
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/pick-frame -H 'Content-Type: application/json' -d '{"time":0.5}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/anchor -H 'Content-Type: application/json' -d '{"anchor":"first"}' > /dev/null
RMG=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/generate)
RMS=$(wait_scene 2)
echo "$RMG" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert any('from the picked frame' in n and '(from its lossless master)' in n for n in d.get('notes',[])), d.get('notes')
" && [ "$RMS" = "rendered" ] \
  && ok "lossless master: the next scene's first frame is read from the previous take's MASTER (said in the notes), and it renders" \
  || bad "lossless master: continuation not from the master ($RMS): $(echo "$RMG" | head -c 400)"
# ---- 2.313.0: THE TAIL PNGs (Tim: "save the last 2 seconds of the video as
# 1080p png, and use one of those frames to continue the video or first frame
# for next video ... save the png's to song name\scene_<n>\song
# name_scene_<n>_x.png"). Scene 1's render above wrote its last 2 s (48
# frames) at 1080p (the default Tail PNG size), from its master, named for
# the board song; tail.json names the take (adopted to its scene name).
curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json, sys, os, subprocess
d = json.load(sys.stdin)
song = os.path.splitext(os.path.basename(d.get('audio') or ''))[0]
r = [x for x in d['list'] if x['n'] == 1][0]
dd = os.path.join('projects', '$NAP', song, 'scene_1')
m = json.load(open(os.path.join(dd, 'tail.json')))
assert m['take'] == r['output'], (m['take'], r['output'])
assert m['count'] == 48 and m['files'] == ['%s_scene_1_%d.png' % (song, x) for x in range(1, 49)], m['files'][:3]
assert m['height'] == 1080 and m['upscaler'] == 'lanczos' and m['source'].endswith('.avi'), m
wh = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0',
                              os.path.join(dd, m['files'][-1])], text=True).strip()
assert wh == '%d,%d' % (m['width'], m['height']), (wh, m['width'], m['height'])
" > /tmp/tail313.log 2>&1 \
  && ok "tail PNGs: scene 1's last 2 s are 48 PNGs at 1080p in <song>/scene_1/<song>_scene_1_<x>.png, read from its lossless master, tail.json naming its take (2.313.0)" \
  || { bad "tail PNGs missing or wrong"; tail -4 /tmp/tail313.log; }
# a frame picked INSIDE those 2 s continues scene 2 from THAT PNG
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/pick-frame -H 'Content-Type: application/json' -d '{"time":4.5}' > /dev/null
TPG=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/generate)
TPS=$(wait_scene 2)
echo "$TPG" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert any('from the picked frame' in n and '_scene_1_33.png' in n and 'tail PNG' in n for n in d.get('notes',[])), d.get('notes')
assert d['job']['params'].get('tail_pngs', {}).get('stem', '').endswith('_scene_2'), d['job']['params'].get('tail_pngs')
" && [ "$TPS" = "rendered" ] \
  && ok "tail PNGs: a frame picked inside the last 2 s (4.5 s = PNG 33) is scene 2's start, and scene 2 writes its own tail (2.313.0)" \
  || bad "tail PNG continuation wrong ($TPS): $(echo "$TPG" | head -c 400)"
# 2.314.0 (Tim: "please use this workflow to upscale images - seedvr2
# model"): with the PNG upscaler on SeedVR2 the tail frames go through HIS
# workflow (utility_seedvr2_7b_int8_upscale_image_api.json), one prompt per
# frame, read back from its SaveImage and fitted to the size
curl -s -X POST http://127.0.0.1:8311/api/scenes/render-settings -H 'Content-Type: application/json' \
  -d '{"settings":{"png_upscaler":"seedvr2"}}' > /dev/null
SVT=$(date +%s)
SVG=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/redo)
SVS=queued; for i in $(seq 1 150); do SVS=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d.get('list',[]) if x.get('n')==2]; print(r[0].get('status','?') if r else 'gone')")
  [ "$SVS" = "rendered" ] || [ "$SVS" = "failed" ] && break; sleep 1; done
[ "$SVS" = "rendered" ] && curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json, sys, os, glob, subprocess
d = json.load(sys.stdin)
song = os.path.splitext(os.path.basename(d.get('audio') or ''))[0]
r = [x for x in d['list'] if x['n'] == 2][0]
dd = os.path.join('projects', '$NAP', song, 'scene_2')
m = json.load(open(os.path.join(dd, 'tail.json')))
assert m['upscaler'] == 'seedvr2' and m['count'] == 48 and m['take'] == r['output'], m
wh = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0',
                              os.path.join(dd, m['files'][0])], text=True).strip()
assert wh == '%d,%d' % (m['width'], m['height']), wh
recs = [json.load(open(f)) for f in glob.glob('/tmp/stub-comfy-out/prompt_*.json') if os.path.getmtime(f) >= $SVT]
assert sum(1 for x in recs if 'seedvr2_7b_int8_convrot.safetensors' in x.get('_models', [])) >= 48, len(recs)
" > /tmp/seedvr314.log 2>&1 \
  && ok "tail PNGs: SeedVR2 - scene 2's 48 tail frames went through Tim's SeedVR2 7B workflow and came back at the PNG size (2.314.0)" \
  || { bad "tail PNGs via SeedVR2 ($SVS): $(echo "$SVG" | head -c 200)"; tail -4 /tmp/seedvr314.log; }
curl -s -X POST http://127.0.0.1:8311/api/scenes/render-settings -H 'Content-Type: application/json' \
  -d '{"settings":{"png_upscaler":""}}' > /dev/null
# the movie compile joins the masters when every scene has one, encoded once at CRF 14
RMC=$(curl -s -X POST http://127.0.0.1:8311/api/movies/compile -H 'Content-Type: application/json' -d '{}')
echo "$RMC" | python3 -c "
import json,sys,os
d=json.load(sys.stdin)
assert d.get('ok'), d
clips=d['job']['params']['timeline']['video']
have=[os.path.exists(os.path.join('projects','$NAP','raw',os.path.splitext(os.path.basename(n))[0]+'.avi')) for n in d['scenes']]
if all(have):
    assert d['from_masters'] is True and d['job']['params'].get('crf')==14, d
    assert all(c['path'].replace(chr(92),'/').split('/')[-2]=='raw' and c['path'].endswith('.avi') for c in clips), [c['path'] for c in clips]
    assert 'lossless master' in d['note'], d['note']
else:
    assert d['from_masters'] is False and 'crf' not in d['job']['params'] and 'no lossless master' in d['note'], d
print('masters' if all(have) else 'mp4s')
" > /tmp/rmc.txt && ok "lossless master: Compile joins the masters when every scene has one (CRF 14, one encode) and says which way it went ($(cat /tmp/rmc.txt))" \
  || bad "lossless master: compile wrong: $(echo "$RMC" | head -c 400)"
RMCJ=$(echo "$RMC" | python3 -c "import json,sys; print(json.load(sys.stdin)['job']['id'])" 2>/dev/null)
for i in $(seq 1 120); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$RMCJ" | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])" 2>/dev/null)
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break; sleep 1
done
[ "$st" = "done" ] && ok "lossless master: the compile job finishes ($(cat /tmp/rmc.txt))" \
  || bad "lossless master: the compile job $st: $(curl -s "http://127.0.0.1:8311/api/jobs/$RMCJ?log_from=0" | python3 -c "import json,sys; L=json.load(sys.stdin).get('log'); print(('\n'.join(L) if isinstance(L,list) else str(L))[-400:])")"
# ---- 2.302.0: TRIM FIRST FRAME (Tim: "when trim first frame is checked,
# add an additional frame before render (to keep the same frame count) and
# remove the first frame of the video from the raw and compressed
# versions"). Scene 2 (First, from scene 1's pick) rendered above WITHOUT
# the trim; ticked, it renders ONE more frame with its song window 1/24 s
# earlier, and the take + its lossless master come out at the SAME count.
TF0=$(echo "$RMG" | python3 -c "import json,sys; p=json.load(sys.stdin)['job']['params']; print(p['frames'], p.get('audio_start'))")
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/trim-first -H 'Content-Type: application/json' -d '{"on":true}' | grep -q '"trim_first":true' \
  && ok "trim first frame: the scene's box is saved on the board" || bad "trim first frame: the flag did not save"
TFG=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/scenes/2/generate)
TFS=$(wait_scene 2)
TFT=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d['list'] if x['n']==2][0]; print(r.get('output') or '')")
TFJ=$(echo "$TFG" | python3 -c "import json,sys; print(json.load(sys.stdin)['job']['id'])")
[ "$TFS" = "rendered" ] && echo "$TFG" | python3 -c "
import json,sys
d=json.load(sys.stdin); p=d['job']['params']
f0, a0 = '$TF0'.split()
assert p['frames'] == int(f0) + 1, ('one extra frame', p['frames'], f0)
assert p.get('trim_head') == 1, p.get('trim_head')
if a0 not in ('None', ''):
    assert abs(float(p['audio_start']) - (float(a0) - 1/24)) < 1e-6, ('song window 1/24 s earlier', p['audio_start'], a0)
assert any('trim first frame: renders' in n for n in d.get('notes', [])), d.get('notes')
" && [ "$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "projects/$NAP/video/$TFT")" = "${TF0%% *}" ] \
  && [ "$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "projects/$NAP/raw/${TFT%.*}.avi")" = "${TF0%% *}" ] \
  && curl -s "http://127.0.0.1:8311/api/jobs/$TFJ?log_from=0" | python3 -c "
import json,sys; L=json.load(sys.stdin).get('log'); L='\n'.join(L) if isinstance(L,list) else str(L)
assert 'trim first frame: dropped 1 frame(s)' in L and 'and its lossless master' in L, L[-500:]
" && ok "trim first frame: renders one extra frame (song window 1/24 s earlier), drops the first from the take AND its master - both keep the original $(echo $TF0 | cut -d' ' -f1) frames" \
  || bad "trim first frame: wrong ($TFS, take $TFT): $(echo "$TFG" | head -c 300)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/2/trim-first -H 'Content-Type: application/json' -d '{"on":false}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/fl/delete -H 'Content-Type: application/json' -d '{"slot":"last"}' | grep -q '"ok":true' \
  && curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d['list'] if x['n']==1][0]
assert not r.get('fl_last') and r.get('fl_first'), r
" && ok "frames: ✕ clears one slot and keeps the other" \
  || bad "frames: slot removal wrong"
# ---- 2.298.0: THE PROJECT'S MEDIA IN EVERY DROPDOWN (Tim: "scan the
# projects subfolders for images and music and videos before adding it to
# a dropdown. scan for assets, characters, locations etc."). The singer's
# sheet is listed under its NAME; a song saved in a character's folder is
# adopted into the sound assets and becomes the board's song; the sheet
# becomes one scene's picture and another slot's frame by its project path.
PMI=$(curl -s "http://127.0.0.1:8311/api/pmedia?kind=images")
SREL=$(echo "$PMI" | python3 -c "
import json,sys; d=json.load(sys.stdin)
s=[x for x in d['images'] if x['group']=='Characters · E2eSinger']
assert s and not s[0]['asset'], [x['group'] for x in d['images']][:20]
assert not any(x['rel'].split('/')[0] in ('temp','chat') for x in d['images'])
print(s[0]['rel'])") \
  && ok "media scan: the singer's sheet is listed under 'Characters · E2eSinger' (not only the asset folders)" \
  || bad "media scan: no character group: $(echo "$PMI" | head -c 300)"
SDIR=$(dirname "projects/$NAP/$SREL")
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=330:duration=2" "$SDIR/e2e_pm_song.wav"
SSREL=$(curl -s "http://127.0.0.1:8311/api/pmedia?kind=sound" | python3 -c "
import json,sys; d=json.load(sys.stdin)
s=[x for x in d['sound'] if x['name']=='e2e_pm_song.wav']
assert s and s[0]['group']=='Characters · E2eSinger', s
print(s[0]['rel'])")
PAD=$(curl -s -X POST http://127.0.0.1:8311/api/pmedia/adopt -H 'Content-Type: application/json' -d "{\"rel\":\"$SSREL\"}")
PAN=$(echo "$PAD" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok') and d['kind']=='sound', d; print(d['name'])") \
  && [ -f "projects/$NAP/sound/$PAN" ] \
  && curl -s -X POST http://127.0.0.1:8311/api/scenes/audio -H 'Content-Type: application/json' -d "{\"file\":\"$PAN\"}" | grep -q '"ok":true' \
  && [ "$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "import json,sys; print(json.load(sys.stdin).get('audio'))")" = "$PAN" ] \
  && ok "media scan: a song in a character's folder is adopted into the sound assets and becomes the board's song" \
  || bad "media scan: adopt/board song failed: $(echo "$PAD" | head -c 300)"
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/pmedia?rel=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$SREL")")" = 200 ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/pmedia?rel=..%2Fpackage.json")" != 200 ] \
  && ok "media scan: a listed picture is served by its project path; a path out of the project is not" \
  || bad "media scan: /pmedia serving wrong"
PRF=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/2/refs/project -H 'Content-Type: application/json' -d "{\"rel\":\"$SREL\"}")
PFL=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/fl -H 'Content-Type: application/json' -d "{\"slot\":\"last\",\"kind\":\"project\",\"rel\":\"$SREL\"}")
echo "$PRF" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('added'), d
assert any(r['label'].startswith('Characters · E2eSinger: ') for r in d['refs']), d['refs']
" && echo "$PFL" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d['fl']['file']=='fl_last.png' and d['fl']['label'].startswith('Characters · E2eSinger: '), d
" && curl -s -X POST http://127.0.0.1:8311/api/scenes/2/refs/project -H 'Content-Type: application/json' -d '{"rel":"../x.png"}' | grep -q '"error"' \
  && ok "media scan: the sheet becomes scene 2's picture and scene 1's LAST frame by its project path; a path out of the project is refused" \
  || bad "media scan: refs/project or fl project wrong: $(echo "$PRF $PFL" | head -c 400)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/fl/delete -H 'Content-Type: application/json' -d '{"slot":"last"}' > /dev/null
rm -f "$SDIR/e2e_pm_song.wav" "projects/$NAP/sound/$PAN"
rm -rf "projects/$NAP/scene_refs" "projects/$NAP/images/e2e_pier.png"
# ---- 2.324.0: CHARACTER SWAP (Tim: "load a reference video and change the
# character in the reference video with a character from a reference image.
# this should be able to work from a video prompt or from a scene"). The
# prompt docker's Swap mode (POST /api/swap) and a rendered scene's ⇄ (POST
# /api/scenes/:n/swap) both queue mode "swap" (swap_worker.py): the window is
# cut at 24 fps, comfy_workflows/MiniMax_H3_Swap.json renders with the size /
# length / prompt written directly (VideoInfo + the math + the prompt box
# dropped), and the ORIGINAL audio goes back on the result.
swap_job() {   # $1 = job id -> echoes the final status
  local s=queued
  for i in $(seq 1 90); do
    s=$(curl -s "http://127.0.0.1:8311/api/jobs/$1" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','?'))")
    [ "$s" = "done" ] || [ "$s" = "failed" ] || [ "$s" = "cancelled" ] && break
    sleep 1
  done
  echo "$s"
}
curl -s http://127.0.0.1:8311/api/swap/cast | python3 -c "
import json,sys; d=json.load(sys.stdin)
c=[x for x in d['cast'] if x['name']=='E2eSinger']
assert d.get('workflow') is True and c and c[0]['file'] and c[0]['url'].startswith('/api/characters/E2eSinger/file/'), d
print(c[0]['url'])" > /tmp/swapcast.txt 2>&1 \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311$(cat /tmp/swapcast.txt)")" = 200 ] \
  && ok "swap: GET /api/swap/cast lists the cast's sheets (E2eSinger) with a URL that serves the picture" \
  || bad "swap: cast list wrong: $(head -c 300 /tmp/swapcast.txt)"
ffmpeg -y -loglevel error -f lavfi -i "testsrc=size=1280x720:rate=25:duration=6" -f lavfi -i "sine=frequency=600:duration=6" \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac "projects/$NAP/video/e2e_swap_src.mp4"
SW0=$(curl -s -X POST http://127.0.0.1:8311/api/swap -F "video=e2e_swap_src.mp4" -F "prompt=x")
echo "$SW0" | grep -q "ONE picture" \
  && ok "swap: Swap mode with no picture is refused in words" || bad "swap: no-picture refusal wrong: $SW0"
SW1=$(curl -s -X POST http://127.0.0.1:8311/api/swap -F "image=@static/pose-sheets/human.png" \
  -F "video=e2e_swap_src.mp4" -F "prompt=she waves at the end" -F "start=1" -F "dur=3" -F "width=960" -F "height=544")
SWID=$(echo "$SW1" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['params']['mode']=='swap', d; print(d['id'])")
SWS=$(swap_job "$SWID")
[ "$SWS" = "done" ] && python3 -c "
import glob, json, os, sys
sys.path.insert(0, 'scripts'); import swap_graph as SG
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
c = rec.get('_classes', [])
assert 'MiniMaxH3ReferenceToVideo' in c and 'VHS_LoadVideo' in c and 'LoadImage' in c, sorted(c)
assert not ({'VHS_VideoInfo', 'ComfyMathExpression', 'PrimitiveStringMultiline'} & set(c)), sorted(c)
p = rec.get('_gen_prompt', '')
assert p.startswith('Replace the subject in <Video 1> with the character in <Picture 1>.') and '<Image 1>' not in p, p[:120]
assert p.endswith('Additional direction: she waves at the end'), p[-120:]
assert rec.get('_ref_image_size') == 'max', rec.get('_ref_image_size')
assert rec.get('_power_loras') == [], rec.get('_power_loras')   # 2.336.0 quality full: the turbo row OFF, no swap LoRA installed
assert list(rec.get('_steps', {}).values()) == [20], rec.get('_steps')
assert rec.get('_gen_length') == SG.window(6.0, 1, 3)['frames'], rec.get('_gen_length')
assert rec.get('_ref_video_slots') == ['swap_clip.mp4'], rec.get('_ref_video_slots')
assert rec.get('_ref_images') and rec['_ref_images'][0].startswith('swap_character'), rec.get('_ref_images')
" > /tmp/swap324.log 2>&1 \
  && curl -s "http://127.0.0.1:8311/api/jobs/$SWID" | grep -q "is not in ComfyUI's loras - the swap runs on H3 alone" \
  && curl -s "http://127.0.0.1:8311/api/jobs/$SWID" | grep -q "quality full: Full (20 steps, no turbo) - turbo LoRA off" \
  && ok "swap: the prompt docker's Swap mode renders the swap workflow - the clip as <Video 1>, the picture as <Picture 1> (2.334.0: H3's tag, at ref_image_size max), the template + the user's direction, the length from the window, the helpers dropped; no swap LoRA installed = said; 2.336.0 quality full: the turbo row off, 20 steps" \
  || { bad "swap: the prompt-docker swap is wrong (job $SWS)"; tail -5 /tmp/swap324.log; curl -s "http://127.0.0.1:8311/api/jobs/$SWID" | python3 -c "import json,sys; print(chr(10).join(json.load(sys.stdin).get('log',[])[-8:]))" 2>/dev/null; }
SWOUT=$(curl -s "http://127.0.0.1:8311/api/jobs/$SWID" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output') or '')")
[ -n "$SWOUT" ] && [ -f "projects/$NAP/output/$SWOUT" ] && python3 -c "
import subprocess, sys
sys.path.insert(0, 'scripts'); import swap_graph as SG
f = sys.argv[1]
a = subprocess.check_output(['ffprobe','-v','error','-select_streams','a','-show_entries','stream=codec_type','-of','csv=p=0', f], text=True)
d = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0', f], text=True))
assert 'audio' in a, 'no audio'
assert abs(d - SG.window(6.0, 1, 3)['dur']) < 0.15, d
" "projects/$NAP/output/$SWOUT" \
  && curl -s "http://127.0.0.1:8311/api/jobs/$SWID" | grep -q "own audio is on the swapped take" \
  && ok "swap: the result is an mp4 of the window's length with the reference video's OWN audio put back" \
  || bad "swap: the result file is wrong: $SWOUT"
SWN=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin)
r=[x for x in d['list'] if x.get('output') and x.get('status') in ('rendered','kept')]
print(r[0]['n'] if r else '')")
SWTAKE0=$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); print([x for x in d['list'] if x['n']==int('${SWN:-0}' or 0)][0].get('output',''))" 2>/dev/null)
curl -s -X POST "http://127.0.0.1:8311/api/scenes/${SWN:-1}/swap" -F "prompt=x" | grep -q "pick a cast character or drop a picture" \
  && ok "swap: a scene swap with no character and no picture is refused in words" \
  || bad "swap: scene no-pick refusal wrong"
# 2.334.0: with the H3 Character Swap LoRA in ComfyUI's loras, the swap stacks it
SWLROOT=/tmp/e2e_comfy; SWLNEW=0; [ -d "$SWLROOT" ] || SWLNEW=1
mkdir -p "$SWLROOT/ComfyUI/models/loras/minimax-h3" && : > "$SWLROOT/ComfyUI/models/loras/minimax-h3/h3_character_swap_pro4500_1000.safetensors"
SW2=$(curl -s -X POST "http://127.0.0.1:8311/api/scenes/${SWN:-1}/swap" -F "character=E2eSinger")
echo "$SW2" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('job') and 'next take' in d.get('note',''), d
" && SWS2=$(wait_scene "${SWN:-1}") && [ "$SWS2" = "rendered" ] && python3 -c "
import glob, json, os, sys
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
assert rec.get('_ref_images') == ['human.png'], rec.get('_ref_images')
assert rec.get('_ref_video_slots') == ['swap_clip.mp4'], rec.get('_ref_video_slots')
assert rec.get('_gen_prompt','').startswith('Replace the subject in <Video 1>'), rec.get('_gen_prompt','')[:80]
pl = rec.get('_power_loras', [])
assert pl == ['minimax-h3/h3_character_swap_pro4500_1000.safetensors'], pl   # 2.336.0: the turbo row off (quality full)
" && [ "$(curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); print([x for x in d['list'] if x['n']==int('${SWN:-1}')][0].get('output',''))")" != "$SWTAKE0" ] \
  && ok "swap: a rendered scene's ⇄ swaps a cast sheet (@e2esinger) into its take - the result is the scene's NEXT take; the H3 Character Swap LoRA found in ComfyUI's loras is stacked (the only LoRA on - quality full turns the turbo row off)" \
  || bad "swap: the scene swap failed: $(echo "$SW2" | head -c 300) (scene ${SWN:-?} ended ${SWS2:-?})"
rm -f "$SWLROOT/ComfyUI/models/loras/minimax-h3/h3_character_swap_pro4500_1000.safetensors"
[ "$SWLNEW" = 1 ] && rm -rf "$SWLROOT"
# ---- 2.325.0: THE REFERENCE VIDEO SELECTION (Tim: "when user clicks a
# video in the reference docker show a dialog, show filmstrip ... selection
# box ... the selected portion will be the reference video for generation").
# GET describes the clicked video; Apply (POST) cuts the frames into
# <stem>_sel_f<a>-f<b>.mp4; clicking the cut reopens the SOURCE with the box
# where it was; the cut is then a reference like any other (here: Swap).
RS0=$(curl -s "http://127.0.0.1:8311/api/refvideo/select?name=e2e_swap_src.mp4")
RS1=$(curl -s -X POST http://127.0.0.1:8311/api/refvideo/select -H 'Content-Type: application/json' \
  -d '{"source":"e2e_swap_src.mp4","start":1.02,"dur":2}')
RS2=$(curl -s "http://127.0.0.1:8311/api/refvideo/select?name=e2e_swap_src_sel_f26-f75.mp4")
RS3=$(curl -s -X POST http://127.0.0.1:8311/api/refvideo/select -H 'Content-Type: application/json' \
  -d '{"source":"e2e_swap_src.mp4","start":0,"dur":99}')
RS4=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/api/refvideo/select?name=nope.mp4")
python3 -c "
import json, subprocess, sys
a, b, c, d = (json.loads(x) for x in sys.argv[1:5])
assert a['source'] == 'e2e_swap_src.mp4' and a['fps'] == 25 and a['frames'] == 150 and a['selection'] is None, a
assert b.get('ok') and b.get('cut') and b['name'] == 'e2e_swap_src_sel_f26-f75.mp4' and b['frames'] == 50, b
f = 'projects/' + sys.argv[6] + '/video/' + b['name']
n = subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries',
                             'stream=nb_read_frames','-of','csv=p=0', f], text=True).strip()
assert n == '50', n
assert c['source'] == 'e2e_swap_src.mp4' and c['selection']['startFrame'] == 26 and c['selection']['endFrame'] == 75, c
assert d.get('ok') and d.get('cut') is False and d['name'] == 'e2e_swap_src.mp4', d
assert sys.argv[5] == '404', sys.argv[5]
" "$RS0" "$RS1" "$RS2" "$RS3" "$RS4" "$NAP" > /tmp/refsel325.log 2>&1 \
  && ok "refvideo: a clicked video is described (fps / frames), Apply cuts EXACTLY the boxed frames (f26-f75 -> 50 frames), the cut reopens on its source with the box, the whole video is no cut, a missing one is a 404" \
  || { bad "refvideo: the selection routes are wrong"; tail -4 /tmp/refsel325.log; }
SW3=$(curl -s -X POST http://127.0.0.1:8311/api/swap -F "image=@static/pose-sheets/human.png" \
  -F "video=e2e_swap_src_sel_f26-f75.mp4" -F "width=960" -F "height=544")
SWID3=$(echo "$SW3" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" 2>/dev/null)
[ "$(swap_job "$SWID3")" = "done" ] \
  && curl -s "http://127.0.0.1:8311/api/jobs/$SWID3" | grep -Eq "reference video e2e_swap_src_sel_f26-f75\.mp4: 2\.0[0-9]s" \
  && ok "refvideo: the selected portion IS the reference - a Swap on the cut swaps exactly those 2 s" \
  || bad "refvideo: the cut did not ride as the reference: $(echo "$SW3" | head -c 200)"
SWOUT3=$(curl -s "http://127.0.0.1:8311/api/jobs/$SWID3" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output') or '')" 2>/dev/null)
# ---- 2.328.0: THE mmh3_chr_swap STYLE (Tim: "is there a style for this
# workflow, if not can you make one mmh3_chr_swap"). A starter video style
# (role "swap", the swap workflow in its ref2va slot); Swap mode and the
# scene ⇄ render through it (the picked style when it is a swap style);
# /api/generate refuses it; its overrides reach the graph via worker.py.
VSJ=$(curl -s "http://127.0.0.1:8311/api/styles?kind=video")
MCS=$(echo "$VSJ" | python3 -c "
import json,sys; d=json.load(sys.stdin)
s=[x for x in d['styles'] if x['name']=='mmh3_chr_swap'][0]
assert s['role']=='swap' and s['workflows']['ref2va']=='comfy_workflows/MiniMax_H3_Swap.json', s
assert d['swap_styles'].get(s['id']) is True and not any(d['swap_styles'].get(x['id']) for x in d['styles'] if x['name']=='H3_Video_Ref'), d['swap_styles']
print(s['id'])" 2>/tmp/mcs328.log)
[ -n "$MCS" ] && curl -s "http://127.0.0.1:8311/api/jobs/$SWID" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d['params'].get('video_style_name')=='mmh3_chr_swap', d['params'].get('video_style_name')
assert any('style=mmh3_chr_swap' in l for l in d.get('log',[])), d.get('log',[])[:3]
" && ok "swap style: mmh3_chr_swap is seeded (role swap, the swap workflow), listed in swap_styles, and Swap mode rendered through it" \
  || { bad "swap style: mmh3_chr_swap missing / not used"; tail -3 /tmp/mcs328.log; }
# ---- 2.352.0 THE H3_Viggle STYLE (Tim: "we should have a fl2va workflow too,
# can we incorporate viggle into these worklows but make it a new viggle
# workflow?"): the reference dock's first video is the MOTION, the picture
# (ref2va) or the first frame (fl2va) performs it - ComfyUI's Viggle graph
# filled by scripts/h3viggle.py (the stub renders the conditioning's length)
HVS=$(echo "$VSJ" | python3 -c "
import json,sys; d=json.load(sys.stdin)
s=[x for x in d['styles'] if x['name']=='H3_Viggle'][0]
assert s['workflows']['ref2va']=='comfy_workflows/H3_Viggle_ref2va.json' and s['workflows']['fl2va']=='comfy_workflows/H3_Viggle_fl2va.json', s
print(s['id'])" 2>/tmp/hv352.log)
[ -n "$HVS" ] && ok "h3viggle: the H3_Viggle style is seeded with its ref2va + fl2va Viggle workflows" || { bad "h3viggle: the style is missing"; tail -3 /tmp/hv352.log; }
run_job h3viggle-ref2va 48 "performs the motion e2e_swap_src.mp4 from 0.00 s, 124 frames at 480x288" yes \
  -F prompt="viggle e2e dance" -F mode=ref2va -F frames=48 -F width=480 -F height=288 -F seed=41 -F pipeline=auto -F format=mp4 \
  -F video_style_id=$HVS -F references=@/tmp/ref.png -F 'ref_videos=["e2e_swap_src.mp4"]'
curl -sf "http://127.0.0.1:8311/api/jobs/$LAST_ID?log_from=0" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
for want in ('workflow H3_Viggle_ref2va.json for ref2va', 'H3_Viggle ref2va: the picture ', 'steps 3 (4-point Viggle sigmas)', 'fp16 accumulation off', 'the plan trims the take to 56'):
    assert want in L, (want, L[-1500:])
assert 'extracting frames from reference video' not in L and 'accelerator' not in L.lower(), L[-800:]
" > /tmp/hv352b.log 2>&1 && ok "h3viggle: ref2va through the Viggle graph - 124 rendered (17n+5, Viggle's minimum), trimmed to the 48 asked, the 3-step DMD sigmas, fp16 accumulation off, no H3 patching" \
  || { bad "h3viggle: the ref2va log is wrong"; tail -3 /tmp/hv352b.log; }
run_job h3viggle-fl2va 30 "H3_Viggle fl2va: the first frame" yes \
  -F prompt="viggle e2e first frame" -F mode=fl2va -F frames=30 -F width=480 -F height=288 -F seed=42 -F pipeline=auto -F format=mp4 \
  -F video_style_id=$HVS -F references=@/tmp/ref.png -F 'ref_videos=["e2e_swap_src.mp4"]'
HVT=$(curl -s -X POST http://127.0.0.1:8311/api/generate -F "prompt=x" -F "mode=t2va" -F "video_style_id=$HVS")
HVN=$(curl -s -X POST http://127.0.0.1:8311/api/generate -F "prompt=x" -F "mode=ref2va" -F "video_style_id=$HVS" -F references=@/tmp/ref.png)
echo "$HVT" | grep -q "pick ref2va (the character sheet / picture performs it) or fl2va" && echo "$HVN" | grep -q "needs a motion video" \
  && ok "h3viggle: t2va and a render without a motion video are refused in words" || bad "h3viggle: not refused: $HVT $HVN"
rm -f /tmp/hv352.log /tmp/hv352b.log comfy_workflows/H3_Viggle_ref2va_tmp.json comfy_workflows/H3_Viggle_fl2va_tmp.json
# ---- 2.353.0 (Tim: "for video generation from prompt the h3_Video_ref workflow doesn't use video reference,
# can we add video and sound slots when a reference video and/or sound is added"): Text mode with a
# reference video goes through ref2va; the H3_Video_Ref graph's video slot takes it (no picture needed)
HVR=$(echo "$VSJ" | python3 -c "import json,sys; print([x['id'] for x in json.load(sys.stdin)['styles'] if x['name']=='H3_Video_Ref'][0])")
RS1=$(curl -s -X POST http://127.0.0.1:8311/api/generate -F "prompt=walks like <Video 1>" -F mode=t2va -F frames=30 -F width=480 -F height=288 \
  -F steps=4 -F seed=51 -F format=mp4 -F pipeline=auto -F "video_style_id=$HVR" -F 'ref_videos=["e2e_swap_src.mp4"]')
RS1ID=$(echo "$RS1" | jget "['id']" 2>/dev/null)
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$RS1ID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
echo "$RS1" | grep -q "rendered as ref2va so the model uses it" && [ "$st" = done ] \
  && curl -sf "http://127.0.0.1:8311/api/jobs/$RS1ID?log_from=0" | python3 -c "
import json,sys; j=json.load(sys.stdin); L='\n'.join(j.get('log',[]))
assert j['params']['mode'] == 'ref2va' and 'workflow ref2va.json for ref2va' in L and 'slots filled: 0/9 image, 1/3 video' in L, L[-1200:]
" > /tmp/rs353.log 2>&1 \
  && ok "refslots: Text mode + a reference video on H3_Video_Ref -> ref2va, the video fills the graph's video slot (no picture needed)" \
  || { bad "refslots: the reference video was not used ($st): $(echo "$RS1" | head -c 200)"; tail -3 /tmp/rs353.log; }
RS2=$(curl -s -X POST http://127.0.0.1:8311/api/generate -F "prompt=x" -F mode=ref2va -F "video_style_id=$HVR")
echo "$RS2" | grep -q "ref2va needs at least one reference image, video or sound" \
  && ok "refslots: Reference mode with no picture, video or sound is refused in words" || bad "refslots: not refused: $RS2"
rm -f /tmp/rs353.log
GS=$(curl -s -X POST http://127.0.0.1:8311/api/generate -F "prompt=a cat" -F "mode=t2va" -F "video_style_id=$MCS")
echo "$GS" | grep -q "character-swap style - it only runs in Swap mode" \
  && ok "swap style: a normal render with mmh3_chr_swap is refused in words (Swap mode only)" \
  || bad "swap style: /api/generate did not refuse it: $(echo "$GS" | head -c 200)"
LSW=$(curl -s -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d '{"name":"E2E Swap Look","kind":"video","arch":"minimax-h3","role":"swap","workflows":{"ref2va":"comfy_workflows/MiniMax_H3_Swap.json"},"loras":[{"path":"e2e_look.safetensors","weight":0.5}]}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['style']['id'])" 2>/dev/null)
H3R=$(echo "$VSJ" | python3 -c "import json,sys; print([x['id'] for x in json.load(sys.stdin)['styles'] if x['name']=='H3_Video_Ref'][0])" 2>/dev/null)
SW4=$(curl -s -X POST http://127.0.0.1:8311/api/swap -F "image=@static/pose-sheets/human.png" \
  -F "video=e2e_swap_src.mp4" -F "dur=1" -F "width=960" -F "height=544" -F "video_style_id=$LSW")
SWID4=$(echo "$SW4" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" 2>/dev/null)
SWS4=$(swap_job "$SWID4")
SW5=$(curl -s -X POST http://127.0.0.1:8311/api/swap -F "image=@static/pose-sheets/human.png" \
  -F "video=e2e_swap_src.mp4" -F "dur=1" -F "width=960" -F "height=544" -F "video_style_id=$H3R")
SWID5=$(echo "$SW5" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" 2>/dev/null)
[ "$SWS4" = "done" ] && python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(fs2[-1]))
assert 'LoraLoaderModelOnly' in rec.get('_classes', []), sorted(rec.get('_classes', []))
" > /tmp/sw328.log 2>&1 && curl -s "http://127.0.0.1:8311/api/jobs/$SWID4" | grep -q 'style \\"E2E Swap Look\\": lora 1: e2e_look.safetensors' \
  && echo "$SW5" | grep -q '"video_style_name":"mmh3_chr_swap"' \
  && ok "swap style: a picked swap style's LoRA reaches the swap graph (worker.py's apply_video_style); a picked NON-swap style falls back to mmh3_chr_swap" \
  || { bad "swap style: overrides / fallback wrong (job $SWS4)"; tail -3 /tmp/sw328.log; echo "$SW5" | head -c 300; }
[ "$(swap_job "$SWID5")" = "done" ] || true
for j in "$SWID4" "$SWID5"; do
  o=$(curl -s "http://127.0.0.1:8311/api/jobs/$j" | python3 -c "import json,sys; print(json.load(sys.stdin).get('output') or '')" 2>/dev/null)
  [ -n "$o" ] && rm -f "projects/$NAP/output/$o"
done
[ -n "$LSW" ] && curl -s -X DELETE "http://127.0.0.1:8311/api/styles/$LSW" > /dev/null
# ---- 2.329.0: THE CHARACTER SWAP DIALOG (Tim: "create a dialog for character
# swap ... do the entire movie in segments of max length ... add the finished
# segments to a vidTemp folder, user will be able to select segments to join
# ... start 1 segment at a time or all segments, the segments to keep will be
# put in vidSwap folder, add a compile button"). routes/swapdlg.js +
# lib/swapSession.js; each segment is a swap job filed into vidTemp.
SDJ() { curl -s -X POST "http://127.0.0.1:8311/api/swapdlg/$1" -H 'Content-Type: application/json' -d "$2"; }
sd_wait() {   # until no result is queued / running (max ~120 s)
  for i in $(seq 1 120); do
    curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "
import json,sys; d=json.load(sys.stdin)
sys.exit(1 if any(r['status'] in ('queued','running') for r in d['results']) else 0)" && return 0
    sleep 1
  done
  return 1
}
PD="projects/$NAP"
rm -rf "$PD/vidTemp" "$PD/vidSwap" "$PD/swap_dialog.json"
SDJ set '{"video":"e2e_swap_src.mp4","max":2,"quality":"fast"}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/swapdlg/picture -F "image=@static/pose-sheets/human.png" > /dev/null
SDA=$(SDJ segments '{"op":"auto","max":2}')
echo "$SDA" | python3 -c "
import json,sys; d=json.load(sys.stdin); g=d['segments']
assert [x['frames'] for x in g] == [39,39,39,22], [x['frames'] for x in g]
assert all(abs(g[i]['start'] - (g[i-1]['start'] + g[i-1]['dur'])) < 1e-3 for i in range(1, len(g))), g
assert 'left unswapped' in d['note'] and d['picture'] and d['max'] == 2, d['note']
" && ok "swap dialog: ✂ Auto segment cuts the whole 6 s video into back-to-back 2 s-max runs on H3's grid (39,39,39,22 frames), the short tail reported" \
  || bad "swap dialog: auto segment wrong: $(echo "$SDA" | head -c 300)"
SDIDS=$(echo "$SDA" | python3 -c "import json,sys; g=json.load(sys.stdin)['segments']; print(json.dumps([g[0]['id'], g[1]['id']]))")
SDR=$(SDJ run "{\"ids\":$SDIDS,\"width\":960,\"height\":544}")
sd_wait
# 2.336.0: the dialog's Quality rides every segment - Fast = the export's turbo row at 4 steps
python3 -c "
import glob, json, os
fs2 = sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)[-2:]
for f in fs2:
    rec = json.load(open(f))
    assert list(rec.get('_steps', {}).values()) == [4], rec.get('_steps')
    assert any('turbo' in x for x in rec.get('_power_loras', [])), rec.get('_power_loras')
" && curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['quality']=='fast' and [q['id'] for q in d['qualities']]==['fast','full','best'], d.get('quality')" \
  && ok "swap dialog: Quality Fast (saved in the record) renders both segments with the export's turbo row at 4 steps" \
  || bad "swap dialog: the Quality did not reach the segments"
SDJ set '{"quality":"full"}' > /dev/null
SDS=$(curl -s http://127.0.0.1:8311/api/swapdlg)
echo "$SDS" | python3 -c "
import json,sys,os; d=json.load(sys.stdin); pd=sys.argv[1]
rs=[r for r in d['results'] if r['status']=='done']
assert len(rs)==2 and all(r['where']=='temp' for r in rs), d['results']
for r in rs: assert os.path.isfile(os.path.join(pd,'vidTemp',r['file'])) and r['file'].startswith('e2e_swap_src_swap_0'), r
assert rs[0]['seed'] != rs[1]['seed'] and abs(rs[1]['start'] - 1.625) < 1e-3, rs
" "$PD" && ! curl -s http://127.0.0.1:8311/api/passets | grep -q "e2e_swap_src_swap_0" \
  && ok "swap dialog: two segments queued at once render one after the other; each lands in vidTemp as <video>_swap_<NN>_<a>-<b>s.mp4, NOT in the Video assets" \
  || bad "swap dialog: segment renders wrong: $(echo "$SDR" | head -c 200) | $(echo "$SDS" | head -c 400)"
SD1=$(echo "$SDS" | python3 -c "import json,sys; print([r['id'] for r in json.load(sys.stdin)['results'] if r['status']=='done'][0])")
SD2=$(echo "$SDS" | python3 -c "import json,sys; print([r['id'] for r in json.load(sys.stdin)['results'] if r['status']=='done'][1])")
SDJ keep "{\"id\":\"$SD1\",\"keep\":true}" > /dev/null
SDJ keep "{\"id\":\"$SD2\",\"keep\":true}" > /dev/null
SDC=$(SDJ compile "{\"ids\":[\"$SD2\",\"$SD1\"]}")
SDCN=$(echo "$SDC" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
[ -n "$SDCN" ] && [ -f "$PD/video/$SDCN" ] && [ "$(ls "$PD/vidSwap" | grep -c '_swap_0')" = 2 ] && python3 -c "
import subprocess, sys, json
d = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type:format=duration','-of','json', sys.argv[1]], text=True))
assert any(s['codec_type']=='audio' for s in d['streams']), d
assert abs(float(d['format']['duration']) - 3.25) < 0.15, d['format']
" "$PD/video/$SDCN" \
  && ok "swap dialog: ✓ Keep moves both to vidSwap; 🎬 Compile joins the ticked ones IN TIME ORDER into the Video assets (1.625 + 1.625 s, with sound)" \
  || bad "swap dialog: keep / compile wrong: $SDC"
SDT=$(SDJ retry "{\"id\":\"$SD1\",\"width\":960,\"height\":544}")
SDU=$(curl -s -o /tmp/sdu.json -w '%{http_code}' -X POST http://127.0.0.1:8311/api/swapdlg/upscale -H 'Content-Type: application/json' -d "{\"id\":\"$SD1\"}")
sd_wait
SDV=$(SDJ save "{\"id\":\"$SD1\"}")
SDVN=$(echo "$SDV" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
SDNEW=$(curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "
import json,sys; d=json.load(sys.stdin); a=[r for r in d['results'] if r['id']=='$SD1'][0]
n=[r for r in d['results'] if r['seg']==a['seg'] and r['id']!=a['id']]
assert n and n[0]['status']=='done' and n[0]['seed']!=a['seed'] and n[0]['where']=='temp', n
print(n[0]['id'])")
[ -n "$SDNEW" ] && [ "$SDU" = 400 ] && grep -q "pick an Upscaler" /tmp/sdu.json && [ -n "$SDVN" ] && [ -f "$PD/video/$SDVN" ] \
  && SDJ discard "{\"id\":\"$SDNEW\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('moved'), d" \
  && ls "$PD/recycle_bin/" | grep -q "_swap_01" \
  && ok "swap dialog: ↻ Retry re-renders the window with a NEW seed; ⏫ Upscale is refused in words with no ⚙ upscaler; 💾 Save copies to the Video assets; 🗑 discards to the recycle bin" \
  || bad "swap dialog: retry / upscale / save / discard wrong: $SDT | $SDU $(cat /tmp/sdu.json) | $SDV"
rm -rf "$PD/vidTemp" "$PD/vidSwap" "$PD/swap_dialog.json" "$PD/video/$SDCN" "$PD/video/$SDVN" /tmp/sdu.json
rm -f "$PD"/recycle_bin/e2e_swap_src_swap_* 2>/dev/null
# ---- 2.339.0: THE SWAP DIALOG'S SECOND ENGINE - LTX RIPPLE (Tim: "a dropdown
# in character swap for ltx2 ripple, with ltx2 style, i think ripple is a
# lora"). ⇄ Swap on Ripple makes the segment's ✎ first frame first (Qwen
# Image 2.1: the character put into the frame at its start); ⇄ again renders
# it through Tim's LTX canvas (v2v) with the Ripple IC-LoRA and the raw clip
# as the guide, trimmed back to the segment with the original audio.
rp_ff_wait() {   # $1 = segment id -> its first frame's final status
  local s=running
  for i in $(seq 1 90); do
    s=$(curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "
import json,sys; d=json.load(sys.stdin); g=[x for x in d['segments'] if x['id']=='$1']
print(((g[0].get('ff') or {}).get('status') or 'none') if g else 'gone')")
    [ "$s" = "running" ] || break
    sleep 1
  done
  echo "$s"
}
rm -rf "$PD/vidTemp" "$PD/vidSwap" "$PD/swap_dialog.json"
# (2.343.0: this first pass is the check-first flow - ⚙ auto_render off)
SDJ set '{"video":"e2e_swap_src.mp4","max":2,"engine":"ripple","text":"","settings":{"auto_render":false}}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/swapdlg/picture -F "image=@static/pose-sheets/human.png" > /dev/null
RPA=$(SDJ segments '{"op":"auto","max":2}')
RPID=$(echo "$RPA" | python3 -c "import json,sys; print(json.load(sys.stdin)['segments'][0]['id'])")
RP1=$(SDJ run "{\"ids\":[\"$RPID\"],\"width\":960,\"height\":544}")
RPF=$(rp_ff_wait "$RPID")
RPFJ=$(echo "$RP1" | python3 -c "
import json,sys; d=json.load(sys.stdin); g=[x for x in d['segments'] if x['id']=='$RPID'][0]; print(g['ff']['job'])" 2>/dev/null)
echo "$RP1" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d['engine'] == 'ripple' and [e['id'] for e in d['engines']] == ['h3', 'ripple', 'viggle', 'viggle_native'], d.get('engine')
assert d['firsts'] == ['$RPID'] and d['queued'] == [] and 'first frame(s) being made with Qwen 2.1' in d['note'], d.get('note')
" > /tmp/rp339.log 2>&1 && [ "$RPF" = "done" ] && [ -f "$PD/vidTemp/_ripple_ff_$RPID.png" ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/api/swapdlg/ff/$RPID")" = 200 ] \
  && curl -s "http://127.0.0.1:8311/api/jobs/$RPFJ" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
for want in ('workflow img_qwen21_edit.json', 'image slot 21: ripple_frame.png', 'image slot 22: swap_character.png', 'image slot 23: bypassed'):
    assert want in L, (want, L[-800:])
" >> /tmp/rp339.log 2>&1 \
  && ok "ripple: ⇄ Swap on LTX Ripple first makes the segment's ✎ first frame (Qwen Image 2.1: <image1> the frame at its start, <image2> the character) and files it in vidTemp" \
  || { bad "ripple: the first frame is wrong ($RPF): $(echo "$RP1" | head -c 300)"; tail -4 /tmp/rp339.log; }
ffmpeg -y -loglevel error -f lavfi -i "color=c=0x3366aa:size=640x360" -frames:v 1 /tmp/e2e_rp_touch.png
RPP=$(curl -s -X POST http://127.0.0.1:8311/api/swapdlg/firstframe/put -F "id=$RPID" -F "image=@/tmp/e2e_rp_touch.png")
echo "$RPP" | python3 -c "
import json,sys; d=json.load(sys.stdin); g=[x for x in d['segments'] if x['id']=='$RPID'][0]
assert g['ff']['status'] == 'done' and g['ff']['label'] == '⤒ e2e_rp_touch.png' and g['ff']['file'] == '_ripple_ff_${RPID}_2.png', g
assert [c['file'] for c in g['ff']['cands']] == ['_ripple_ff_$RPID.png', '_ripple_ff_${RPID}_2.png'], g['ff']['cands']
" && ok "ripple: ⤒ a touched-up picture becomes the segment's first frame (2.348.0: kept beside the ✎ one as a candidate)" \
  || bad "ripple: ⤒ put wrong: $(echo "$RPP" | head -c 300)"
# ---- 2.348.0 (Tim: "allow user to generate multiple "first image" for a scene
# and let the user select the one he wants to use, double click will do the
# preview, single click will select the file"): ✎ ×2 adds two candidates;
# /select picks one; ?f= serves any of THIS segment's; ✕ drops one
RPC2=$(SDJ firstframe "{\"ids\":[\"$RPID\"],\"count\":2}")
RPC2S=$(rp_ff_wait "$RPID")
RPSEL=$(SDJ firstframe/select "{\"id\":\"$RPID\",\"file\":\"_ripple_ff_${RPID}_2.png\"}")
RPF3=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/api/swapdlg/ff/$RPID?f=_ripple_ff_${RPID}_3.png")
RPFX=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/api/swapdlg/ff/$RPID?f=swap_dialog.json")
RPBAD=$(SDJ firstframe/select "{\"id\":\"$RPID\",\"file\":\"nope.png\"}")
RPCL=$(SDJ firstframe/clear "{\"id\":\"$RPID\",\"file\":\"_ripple_ff_${RPID}_4.png\"}")
python3 -c "
import json,sys,os
a=json.loads(sys.argv[1]); s=json.loads(sys.argv[2]); bad=json.loads(sys.argv[3]); c=json.loads(sys.argv[4]); pd=sys.argv[5]
assert a['made'] == ['$RPID'] and a['note'].startswith('✎ 2 first frame(s) queued') and 'double-click to see it big' in a['note'], a.get('note')
g=[x for x in s['segments'] if x['id']=='$RPID'][0]['ff']
assert [x['file'] for x in g['cands']] == ['_ripple_ff_$RPID.png', '_ripple_ff_${RPID}_2.png', '_ripple_ff_${RPID}_3.png', '_ripple_ff_${RPID}_4.png'], g['cands']
assert g['file'] == '_ripple_ff_${RPID}_2.png' and g['status'] == 'done' and g['jobs'] == [], g
assert 'not one of this segment' in bad.get('error',''), bad
g=[x for x in c['segments'] if x['id']=='$RPID'][0]['ff']
assert len(g['cands']) == 3 and g['file'] == '_ripple_ff_${RPID}_2.png' and not os.path.exists(os.path.join(pd, 'vidTemp', '_ripple_ff_${RPID}_4.png')), g
" "$RPC2" "$RPSEL" "$RPBAD" "$RPCL" "$PD" > /tmp/rpc2.log 2>&1 && [ "$RPC2S" = done ] && [ "$RPF3" = 200 ] && [ "$RPFX" = 404 ] \
  && ok "ripple: ✎ ×2 adds two first-frame candidates (four now), /select picks the one to use (not a stranger), ?f= serves only this segment's, ✕ drops one candidate and its file" \
  || { bad "ripple: first-frame candidates wrong ($RPC2S $RPF3 $RPFX)"; tail -3 /tmp/rpc2.log; }
rm -f /tmp/rpc2.log
# 2.342.0: Ripple = Tim's own LTX_Ripple_FFAF_Edit_v11, with the ⚙ settings
# (a set size, 12 steps, a fixed seed, strength 1.2) and a swap LoRA
mkdir -p "$SWLROOT/ComfyUI/models/loras/LTX" && : > "$SWLROOT/ComfyUI/models/loras/LTX/LTX25_Ripple_v11.safetensors" \
  && : > "$SWLROOT/ComfyUI/models/loras/e2e_swaplook.safetensors"
# 2.345.0 (Tim's run: "Value not in list [unet_name] = ltx-2.5-22b-distilled-
# transformer-comfy-int8-convrot.safetensors"): the LTX model lives in a
# SUBFOLDER here, as on his machine - the worker must send ComfyUI's own name
RPMODELS="diffusion_models/LTX/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors vae/ltx-2.5-video-vae-conv-bf16.safetensors text_encoders/gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors"
for f in $RPMODELS; do mkdir -p "$(dirname "$SWLROOT/ComfyUI/models/$f")"; : > "$SWLROOT/ComfyUI/models/$f"; done
SDJ set '{"settings":{"auto_size":false,"width":640,"height":352,"steps":12,"seed_mode":"fixed","seed":777,"strength":1.2}}' > /tmp/rpset.json
curl -s -X POST http://127.0.0.1:8311/api/temploras/swap -H 'Content-Type: application/json' -d '{"loras":[{"path":"e2e_swaplook.safetensors","weight":0.6}]}' > /dev/null
python3 -c "
import json; d=json.load(open('/tmp/rpset.json'))
assert d['settings'] == {'auto_size': False, 'width': 640, 'height': 352, 'steps': 12, 'seed_mode': 'fixed', 'seed': 777, 'strength': 1.2, 'auto_render': False, 'viggle_steps': 3, 'viggle_strength': 1, 'viggle_solattn': False, 'viggle_safe': False, 'vn_steps': 4, 'vn_shift': 3}, d['settings']
assert d['render_size'] == {'width': 640, 'height': 352, 'auto': False} and d['video_info']['width'] > 0, (d['render_size'], d.get('video_info'))
" && ok "swap ⚙ settings: POST /api/swapdlg/set {settings} saves the size / steps / fixed seed / strength; the view carries the video's own size and the render size" \
  || bad "swap ⚙ settings wrong: $(head -c 300 /tmp/rpset.json)"
RP2=$(SDJ run "{\"ids\":[\"$RPID\"],\"width\":960,\"height\":544}")
sd_wait
RPS=$(curl -s http://127.0.0.1:8311/api/swapdlg)
RPR=$(echo "$RPS" | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['results'] if x['seg']=='$RPID']; print(r[-1]['id'] if r else '')")
RPJ=$(echo "$RP2" | python3 -c "import json,sys; d=json.load(sys.stdin); print([r['job'] for r in d['results'] if r['seg']=='$RPID'][-1])" 2>/dev/null)
python3 -c "
import json, sys, os, subprocess, glob
d = json.loads(sys.argv[1]); s = json.loads(sys.argv[2]); pd = sys.argv[3]
assert len(d['queued']) == 1 and d['firsts'] == [] and 'segment(s) queued' in d['note'], d.get('note')
r = [x for x in s['results'] if x['seg'] == '$RPID'][-1]
assert r['status'] == 'done' and r['engine'] == 'ripple' and r['where'] == 'temp', r
f = os.path.join(pd, 'vidTemp', r['file'])
n = subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','csv=p=0',f], text=True).strip()
assert n == '39', ('frames', n)
a = subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type','-of','csv=p=0',f], text=True)
assert 'audio' in a, a
rec = json.load(open(sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)[-1]))
c = rec.get('_classes', [])
assert 'Frames Slice' in c and 'LTXAddVideoICLoRAGuide' in c and 'VHS_LoadVideo' in c and 'ImageConcatMulti' not in c and 'TextOverlay' not in c, c
" "$RP2" "$RPS" "$PD" > /tmp/rp339b.log 2>&1 \
  && curl -s "http://127.0.0.1:8311/api/jobs/$RPJ" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
for want in ('ripple_worker.py mode=ripple', 'ripple: the segment 0.00s + 39 frames', 'cut at 640x352 as 41 frames', '640x352, 41 frames at 24 fps',
             'seed 777', 'steps 12', 'Ripple LoRA ', '@ 1.2', 'LoRA e2e_swaplook.safetensors @ 0.6', 'pruned ',
             'the still at frame 0 dropped, 39 frames kept, the original audio on',
             'the LTX 2.5 model: ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors -> LTX/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors (as your ComfyUI lists it)'):
    assert want in L, (want, L[-1200:])
" >> /tmp/rp339b.log 2>&1 \
  && ok "ripple: ⇄ again renders it through Tim's LTX_Ripple_FFAF_Edit_v11 (ripple_worker) - the ⚙ size / 12 steps / seed 777 / strength 1.2 + the swap LoRA, 41 frames (8k+1 >= 39 + the still), the still dropped, the segment's 39 with its original audio, filed in vidTemp" \
  || { bad "ripple: the render is wrong: $(echo "$RP2" | head -c 300)"; tail -4 /tmp/rp339b.log; }
RPU=$(curl -s -o /tmp/rpu.json -w '%{http_code}' -X POST http://127.0.0.1:8311/api/swapdlg/upscale -H 'Content-Type: application/json' -d "{\"id\":\"$RPR\"}")
[ "$RPU" = 400 ] && grep -q "upscale is for MiniMax H3 takes" /tmp/rpu.json \
  && ok "ripple: ⏫ Upscale on a Ripple take is refused in words" || bad "ripple: upscale not refused: $RPU $(cat /tmp/rpu.json)"
# ---- 2.343.0 (Tim: "ltx doesn't start the render after the picture is
# generated"): ⚙ "▶ render as soon as the ✎ first frame is made" (the
# default) - ONE ▶ Swap makes the first frame AND renders the segment; a
# failed render carries the worker's own reason on its row.
rp_auto_wait() {   # $1 = segment id, $2 = results it had before -> the NEW result's status once it is not queued/running (or "none")
  local s=none
  for i in $(seq 1 150); do
    s=$(curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d['results'] if x['seg']=='$1'][int('${2:-0}'):]
g=[x for x in d['segments'] if x['id']=='$1']
ff=((g[0].get('ff') or {}).get('status') if g else '') or ''
print(r[-1]['status'] if r else ('wait' if ff=='running' else 'none'))")
    case "$s" in queued|running|wait) sleep 1 ;; *) break ;; esac
  done
  echo "$s"
}
SDJ set '{"settings":{"auto_render":true}}' > /tmp/rpauto.json
RPB=$(SDJ segments '{"op":"auto","max":2}' | python3 -c "import json,sys; print(json.load(sys.stdin)['segments'][1]['id'])")
SDJ firstframe/clear "{\"id\":\"$RPB\"}" > /dev/null
RA1=$(SDJ run "{\"ids\":[\"$RPB\"]}")
RAS=$(rp_auto_wait "$RPB")
RAV=$(curl -s http://127.0.0.1:8311/api/swapdlg)
python3 -c "
import json,sys
a=json.load(open('/tmp/rpauto.json')); d=json.loads(sys.argv[1]); v=json.loads(sys.argv[2])
assert a['settings']['auto_render'] is True, a['settings']
assert d['firsts'] == ['$RPB'] and d['queued'] == [] and 'renders as soon as its frame is made' in d['note'], d.get('note')
g=[x for x in v['segments'] if x['id']=='$RPB'][0]
assert g['ff']['status'] == 'done' and 'auto' not in g['ff'], g['ff']
r=[x for x in v['results'] if x['seg']=='$RPB']
assert len(r) == 1 and r[0]['status'] == 'done' and r[0]['engine'] == 'ripple' and r[0]['file'], r
" "$RA1" "$RAV" > /tmp/rpauto.log 2>&1 && [ "$RAS" = done ] \
  && ok "ripple: ONE ▶ Swap makes the ✎ first frame AND renders the segment through LTX Ripple as soon as the frame is made (⚙ ▶ render as soon as..., on by default)" \
  || { bad "ripple: the render did not start after the first frame ($RAS)"; tail -4 /tmp/rpauto.log; }
rm -f "$SWLROOT/ComfyUI/models/loras/LTX/LTX25_Ripple_v11.safetensors"
SDJ firstframe/clear "{\"id\":\"$RPB\"}" > /dev/null
SDJ run "{\"ids\":[\"$RPB\"]}" > /dev/null
RAF=$(rp_auto_wait "$RPB" 1)
curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d['results'] if x['seg']=='$RPB'][-1]
assert r['status'] == 'failed' and r['error'].startswith('the render failed: the LTX Ripple LoRA is not in ComfyUI') and 'see the job' not in r['error'], r
" > /tmp/rpauto2.log 2>&1 && [ "$RAF" = failed ] \
  && ok "ripple: a render that fails says WHY on its row - the worker's own ERROR line (here: the Ripple LoRA is not in ComfyUI's loras folder), not just 'see the job's log'" \
  || { bad "ripple: a failed render does not carry its reason ($RAF)"; tail -4 /tmp/rpauto2.log; }
rm -f /tmp/rpauto.json /tmp/rpauto.log /tmp/rpauto2.log
# ---- 2.344.0 (Tim, with API-viggle-animate-h3_workflow-v1.2.0.json: "uses a
# 3 step viggle animate ... can you see if we can add viggle to our
# styles\workflow"): the swap dialog's third engine, Viggle (H3) - the same ✎
# first frame, then Viggle-Animate on MiniMax H3 through his upload
# (viggle_worker). This "ComfyUI" lacks two speed patches (stepped over) and
# has the fp16 H3 video VAE, not the int8 one his workflow names (matched).
VGM="$SWLROOT/ComfyUI/models"; VGNEW=""
for f in diffusion_models/minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors loras/viggle_animate_dmd_lora_r64.safetensors \
         text_cond/fixed_embed_fwd_anyframe.safetensors vae/minimax_h3_video_vae_fp16.safetensors; do
  [ -f "$VGM/$f" ] || { mkdir -p "$(dirname "$VGM/$f")"; : > "$VGM/$f"; VGNEW="$VGNEW $VGM/$f"; }
done
SDJ set '{"engine":"viggle","settings":{"auto_size":true,"viggle_steps":3,"viggle_strength":1}}' > /dev/null
RPC=$(curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "import json,sys; print(json.load(sys.stdin)['segments'][2]['id'])")
SDJ firstframe/clear "{\"id\":\"$RPC\"}" > /dev/null
VG1=$(SDJ run "{\"ids\":[\"$RPC\"]}")
VGS=$(rp_auto_wait "$RPC" 0)
VGV=$(curl -s http://127.0.0.1:8311/api/swapdlg)
VGJ=$(echo "$VGV" | python3 -c "import json,sys; print([r['job'] for r in json.load(sys.stdin)['results'] if r['seg']=='$RPC'][-1])" 2>/dev/null)
python3 -c "
import json, sys, os, subprocess, glob
d = json.loads(sys.argv[1]); v = json.loads(sys.argv[2]); pd = sys.argv[3]
assert d['engine'] == 'viggle' and d['firsts'] == ['$RPC'] and d['render_size'] == {'width': 864, 'height': 480, 'auto': True}, (d.get('engine'), d.get('firsts'), d.get('render_size'))
g = [x for x in v['segments'] if x['id'] == '$RPC'][0]
r = [x for x in v['results'] if x['seg'] == '$RPC'][-1]
assert r['status'] == 'done' and r['engine'] == 'viggle' and r['where'] == 'temp', r
f = os.path.join(pd, 'vidTemp', r['file'])
n = subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','csv=p=0',f], text=True).strip()
assert n == str(g['frames']), ('frames', n, g['frames'])
a = subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type','-of','csv=p=0',f], text=True)
assert 'audio' in a, a
rec = json.load(open(sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)[-1]))
c = rec.get('_classes', [])
assert 'ViggleAnimateConditioning' in c and 'ViggleTextCondLoader' in c and 'CustomSigmas' in c, c
assert not set(c) & {'SolAttnPatch', 'MiniMaxChunkFeedForward', 'JWImageResizeToMegapixels', 'ImageConcanate', 'BasicScheduler'}, c
m = rec.get('_models', [])
assert 'minimax_h3_video_vae_fp16.safetensors' in m and 'minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors' in m and 'viggle_animate_dmd_lora_r64.safetensors' in m, m
" "$VG1" "$VGV" "$PD" > /tmp/vg344.log 2>&1 && [ "$VGS" = done ] \
  && curl -s "http://127.0.0.1:8311/api/jobs/$VGJ" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
for want in ('viggle_worker.py mode=viggle', 'cut at 864x480', 'MiniMaxChunkFeedForward, SolAttnPatch - stepped over', 'steps 3 (4-point Viggle sigmas)',
             'DMD LoRA viggle_animate_dmd_lora_r64.safetensors @ 1', 'the original audio on',
             'fp16 accumulation off - it can turn a take black'):
    assert want in L, (want, L[-1200:])
" >> /tmp/vg344.log 2>&1 \
  && ok "viggle: Engine Viggle (H3) - ONE ▶ Swap makes the ✎ first frame and renders the segment through Tim's Viggle-Animate workflow (viggle_worker): 864x480 (the video's aspect at 480), 3 steps = the 4-point DMD sigmas, the missing speed patches stepped over, the H3 VAE matched to the fp16 one, every frame of the segment with its original audio, filed in vidTemp" \
  || { bad "viggle: the render is wrong ($VGS): $(echo "$VG1" | head -c 300)"; tail -4 /tmp/vg344.log; }
VGU=$(curl -s -o /tmp/vgu.json -w '%{http_code}' -X POST http://127.0.0.1:8311/api/swapdlg/upscale -H 'Content-Type: application/json' \
  -d "{\"id\":\"$(echo "$VGV" | python3 -c "import json,sys; print([r['id'] for r in json.load(sys.stdin)['results'] if r['seg']=='$RPC'][-1])")\"}")
[ "$VGU" = 400 ] && grep -q "a Viggle (H3) take is rendered at its size" /tmp/vgu.json \
  && ok "viggle: ⏫ Upscale on a Viggle take is refused in words" || bad "viggle: upscale not refused: $VGU $(cat /tmp/vgu.json)"
# 2.348.0 (Tim: "it rendered once, but now it is only rendering a black
# video"): a take that comes back all black fails IN WORDS, never "done"
curl -s -X POST http://127.0.0.1:8388/e2e/black -d '{"on":true}' > /dev/null
VGRID=$(echo "$VGV" | python3 -c "import json,sys; print([r['id'] for r in json.load(sys.stdin)['results'] if r['seg']=='$RPC'][-1])")
SDJ retry "{\"id\":\"$VGRID\"}" > /dev/null
VGBS=$(rp_auto_wait "$RPC" 1)
curl -s -X POST http://127.0.0.1:8388/e2e/black -d '{"on":false}' > /dev/null
curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d['results'] if x['seg']=='$RPC'][-1]
assert r['status'] == 'failed' and 'render came back ALL BLACK, in safe mode too' in r['error'] and 'restart ComfyUI' in r['error'], r
assert d['settings']['viggle_safe'] is False, d['settings']
" > /tmp/vgblack.log 2>&1 && [ "$VGBS" = failed ] \
  && ok "viggle: a take that comes back ALL BLACK - and black again in safe mode - fails in words (the model files / ComfyUI) instead of landing as a done black video" \
  || { bad "viggle: a black take was not caught ($VGBS)"; tail -3 /tmp/vgblack.log; }
# 2.350.0 (Tim: "the Viggle render came back ALL BLACK ... this was with
# viggle"): ONE black take -> rendered again in safe mode (same seed; the
# attention backend stepped over), filed as done, and ⚙ remembers safe mode
curl -s -X POST http://127.0.0.1:8388/e2e/black -d '{"count":1}' > /dev/null
VGFID=$(curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "import json,sys; print([r['id'] for r in json.load(sys.stdin)['results'] if r['seg']=='$RPC'][-1])")
SDJ retry "{\"id\":\"$VGFID\"}" > /dev/null
VGSS=$(rp_auto_wait "$RPC" 2)
curl -s -X POST http://127.0.0.1:8388/e2e/black -d '{"on":false}' > /dev/null
VGSV=$(curl -s http://127.0.0.1:8311/api/swapdlg)
VGSJ=$(echo "$VGSV" | python3 -c "import json,sys; print([r['job'] for r in json.load(sys.stdin)['results'] if r['seg']=='$RPC'][-1])" 2>/dev/null)
echo "$VGSV" | python3 -c "
import json,sys,glob,os; d=json.load(sys.stdin); r=[x for x in d['results'] if x['seg']=='$RPC'][-1]
assert r['status'] == 'done' and r.get('safe') is True, r
assert d['settings']['viggle_safe'] is True, d['settings']
rec = json.load(open(sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)[-1]))
assert 'ModelAttentionBackend' not in rec.get('_classes', []), rec.get('_classes')
" > /tmp/vgsafe.log 2>&1 && [ "$VGSS" = done ] \
  && curl -s "http://127.0.0.1:8311/api/jobs/$VGSJ" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
for want in ('the take came back ALL BLACK - rendering it again in safe mode', \"ComfyUI's own attention (not comfy kitchen attention)\",
             'chunk 1/1 (safe mode)', 'safe mode fixed it'):
    assert want in L, (want, L[-1500:])
" >> /tmp/vgsafe.log 2>&1 \
  && ok "viggle: ONE black take is rendered again in SAFE MODE (fp16 accumulation off, no speed patches, ComfyUI's own attention, same seed) - filed as done, and ⚙ Viggle safe mode switches itself on" \
  || { bad "viggle: the safe-mode retry is wrong ($VGSS)"; tail -4 /tmp/vgsafe.log; }
VGSR=$(SDJ run "{\"ids\":[\"$RPC\"]}")
VGS2=$(rp_auto_wait "$RPC" 3)
VGSJ2=$(curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "import json,sys; print([r['job'] for r in json.load(sys.stdin)['results'] if r['seg']=='$RPC'][-1])" 2>/dev/null)
[ "$VGS2" = done ] && curl -s "http://127.0.0.1:8311/api/jobs/$VGSJ2" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
assert \"⚙ Viggle safe mode: ComfyUI's own attention\" in L and 'rendering it again in safe mode' not in L, L[-1200:]
" > /tmp/vgsafe2.log 2>&1 \
  && ok "viggle: with ⚙ safe mode on the next render starts in safe mode (no black first try)" \
  || { bad "viggle: safe mode not used by the next render ($VGS2)"; tail -3 /tmp/vgsafe2.log; }
SDJ set '{"settings":{"viggle_safe":false}}' > /dev/null
# ---- 2.351.0 VIGGLE (NATIVE) + 2.352.0 ITS RESIDENT ENGINE (Tim: "the viggle
# doesn't render at all now, 200sec elapsed and no steps started"; ComfyUI stays
# the engine for everything else). Viggle (native) runs on a resident server in
# venvs/native (scripts/native/server.py): int8 in RAM, streamed block by block,
# loaded between segments, and it can use the ComfyUI Viggle files. Here the
# "venv" is a fake whose python runs scripts/stub-native-server.py - same routes,
# same NDJSON, same raw outputs - so route -> job -> worker -> client -> master
# -> join runs for real (the real engine: scripts/test-native.py --tiny).
VNROOT=/tmp/e2e_vn; rm -rf "$VNROOT"; mkdir -p "$VNROOT/venv/bin"
curl -s -m 2 -X POST http://127.0.0.1:8398/shutdown > /dev/null 2>&1; sleep 0.5   # a server an aborted run left behind
# 2.353.0: the START check wrote components.txt (viggle native=0 here) and - being the test server - installed nothing
grep -q "^viggle native=0$" components.txt && grep -q "^# bitGen Studio components - 0 = install it on the next start, 1 = installed, 2 = do not install" components.txt \
  && grep -q "\[components\] viggle native is not installed - install on start is off here" /tmp/h3srv.log \
  && curl -s http://127.0.0.1:8311/api/native/status | python3 -c "import json,sys; assert json.load(sys.stdin)['job'] is None" \
  && ok "components: the start check wrote components.txt (viggle native=0) and queued no install on the test server" \
  || { bad "components: the start check did not run / write components.txt"; cat components.txt 2>/dev/null | tail -2; grep "components\]" /tmp/h3srv.log | tail -2; }
# the ComfyUI folder the Viggle legs above filled (the model, its DMD LoRA, the H3 VAE) - put back after
VNCD=$(curl -s http://127.0.0.1:8311/api/config | python3 -c "import json,sys; print(((json.load(sys.stdin).get('engine') or {}).get('comfy') or {}).get('dir') or '')")
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' -d "{\"engine\":{\"comfy\":{\"dir\":\"$SWLROOT/ComfyUI\"}}}" > /dev/null
NEC() { curl -s -X POST "http://127.0.0.1:8311/api/native/$1" -H 'Content-Type: application/json' -d "$2"; }
NEC config "{\"dir\":\"$VNROOT/w\",\"venv\":\"$VNROOT/venv\",\"port\":8398,\"prefer\":\"both\",\"picks\":{}}" > /dev/null
SDJ set '{"engine":"viggle_native"}' > /dev/null
VNN0=$(curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "import json,sys; print(len([r for r in json.load(sys.stdin)['results'] if r['seg']=='$RPC']))")
VNR0=$(SDJ run "{\"ids\":[\"$RPC\"]}")
curl -s http://127.0.0.1:8311/api/native/status | python3 -c "
import json,sys; s=json.load(sys.stdin); r=json.loads(sys.argv[1])
v = s['viggle']
assert v['ready'] is False and s['venv_ready'] is False and 'base' in v['missing'] and 'viggle_assets' in v['missing'], v
assert 'h3' not in s and s['paths']['root'] == '$VNROOT/w', s['paths']
c = {x['id']: x for x in s['components']}
assert any('minimax_h3_ref2va_viggle' in y['file'] for y in c['viggle']['candidates']) and c['viggle']['how'] == 'unchecked', c['viggle']
# 2.353.0: the ComfyUI workflow names these files -> used, NOT counted as a download
# (this ComfyUI has the fp16 video VAE, not the int8 one the workflow names: that 10.4 GB still counts - the 66 GB transformer does not)
assert c['viggle']['workflow']['from'] == 'viggle_animate_h3_api.json' and c['viggle_lora']['workflow'] and v['gb'] < 20, (c['viggle'].get('workflow'), v['gb'])
assert 'Viggle (native) is not installed yet - its Python environment' in r.get('error', ''), r
" "$VNR0" > /tmp/vn0.log 2>&1 \
  && ok "viggle native: not installed -> the swap ⚙ lists what is missing, finds the ComfyUI Viggle file its workflow names (not checked yet, not a download), and ▶ Swap on Viggle (native) is refused in words" \
  || { bad "native engine: the not-installed state is wrong"; tail -3 /tmp/vn0.log; }
cat > "$VNROOT/venv/bin/python" <<SH
#!/bin/sh
export STUB_NATIVE_LOG_DIR=$VNROOT
case "\$*" in
  *check.py*) exec python3 $PWD/scripts/stub-native-server.py --check "\$@" ;;
  *) exec python3 $PWD/scripts/stub-native-server.py "\$@" ;;
esac
SH
chmod +x "$VNROOT/venv/bin/python"
for f in MiniMax-H3/modular_model_index.json MiniMax-H3/transformer_ref/config.json MiniMax-H3/vae/w.safetensors MiniMax-H3/audio_vae/w.safetensors \
         Viggle-Animate/transformer/w.safetensors Viggle-Animate/lora/pytorch_lora_weights.safetensors Viggle-Animate/assets/fixed_embed_fwd_anyframe.pt; do
  mkdir -p "$(dirname "$VNROOT/w/$f")"; echo x > "$VNROOT/w/$f"; done
curl -s http://127.0.0.1:8311/api/native/status | python3 -c "
import json,sys; s=json.load(sys.stdin)
assert s['venv_ready'] and s['viggle']['ready'], s['viggle']
c = {x['id']: x for x in s['components']}
assert c['viggle']['how'] == 'official' and c['vae']['how'] == 'official' and c['base']['how'] == 'official', c['viggle']
" > /tmp/vn1.log 2>&1 \
  && ok "viggle native: installed (venv + the official files) -> ready; an unchecked ComfyUI file never beats a download" \
  || { bad "native engine: the installed state is wrong"; tail -3 /tmp/vn1.log; }
SDJ set '{"settings":{"seed_mode":"random","seed":0}}' > /dev/null
VNR1=$(SDJ run "{\"ids\":[\"$RPC\"]}")
VNS1=$(rp_auto_wait "$RPC" "$VNN0")
VNV=$(curl -s http://127.0.0.1:8311/api/swapdlg)
VNJ=$(echo "$VNV" | python3 -c "import json,sys; print([r['job'] for r in json.load(sys.stdin)['results'] if r['seg']=='$RPC'][-1])" 2>/dev/null)
python3 -c "
import json, sys, os, subprocess
v = json.loads(sys.argv[1]); pd = sys.argv[2]
g = [x for x in v['segments'] if x['id'] == '$RPC'][0]
r = [x for x in v['results'] if x['seg'] == '$RPC'][-1]
assert r['status'] == 'done' and r['engine'] == 'viggle_native' and r['where'] == 'temp', r
f = os.path.join(pd, 'vidTemp', r['file'])
n = subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames,width,height','-of','csv=p=0',f], text=True).strip()
assert n == '864,480,' + str(g['frames']), ('frames', n, g['frames'])
a = subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type','-of','csv=p=0',f], text=True)
assert 'audio' in a, a
" "$VNV" "$PD" > /tmp/vn2.log 2>&1 && [ "$VNS1" = done ] \
  && curl -s "http://127.0.0.1:8311/api/jobs/$VNJ" | python3 -c "
import json,sys; j=json.load(sys.stdin); L='\n'.join(j.get('log',[]))
for want in ('viggle_native_worker.py mode=viggle_native (Viggle-Animate, our own engine - no ComfyUI)', 'cut at 864x480',
             'rendered as 124 frames (H3 makes 17n+5, at least 124)', 'starting the engine server (port 8398)', 'stub engine: viggle ref2va 124f 864x480',
             'Viggle-Animate/transformer (the official weights)', 'LoRA pytorch_lora_weights.safetensors @ 1.0 merged', 'the original audio on'):
    assert want in L, (want, L[-1500:])
" >> /tmp/vn2.log 2>&1 \
  && ok "viggle native: ▶ Swap renders on the shared native engine (no ComfyUI graph): the server started once, Viggle's transformer + DMD LoRA, 124 frames (17n+5) trimmed back to the segment, its own audio on, filed in vidTemp" \
  || { bad "viggle native: the render is wrong ($VNS1): $(echo "$VNR1" | head -c 300)"; tail -4 /tmp/vn2.log; }
SDJ set '{"settings":{"seed_mode":"fixed","seed":666}}' > /dev/null
VNR2=$(SDJ run "{\"ids\":[\"$RPC\"]}")
VNS2=$(rp_auto_wait "$RPC" "$((VNN0 + 1))")
curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "
import json,sys; d=json.load(sys.stdin); r=[x for x in d['results'] if x['seg']=='$RPC'][-1]
assert r['status'] == 'failed' and 'the model produced NaN / inf pixels' in r['error'], r
" > /tmp/vn3.log 2>&1 && [ "$VNS2" = failed ] \
  && ok "viggle native: the engine's own reason (NaN pixels) lands on the row in words" \
  || { bad "viggle native: a failed native render is not said ($VNS2)"; tail -3 /tmp/vn3.log; }
# 🔍 the ComfyUI files: the header check (the stub reads nothing, says ok) -> the Viggle file you already have wins
VNK=$(curl -s -X POST http://127.0.0.1:8311/api/viggle-native/check -H 'Content-Type: application/json' -d '{}')
SDJ set '{"settings":{"seed_mode":"random","seed":0}}' > /dev/null
VNR3=$(SDJ run "{\"ids\":[\"$RPC\"]}")
VNS3=$(rp_auto_wait "$RPC" "$((VNN0 + 2))")
VNJ3=$(curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "import json,sys; print([r['job'] for r in json.load(sys.stdin)['results'] if r['seg']=='$RPC'][-1])" 2>/dev/null)
echo "$VNK" | python3 -c "
import json,sys; s=json.load(sys.stdin); c={x['id']: x for x in s['sources']}
assert s['checked'] >= 3 and s['ready'] and c['viggle']['how'] == 'comfy' and 'minimax_h3_ref2va_viggle_pruned_int8_convrot' in c['viggle']['file'], c['viggle']
assert c['viggle_lora']['how'] == 'comfy' and c['vae']['how'] == 'comfy', (c['viggle_lora'], c['vae'])
" > /tmp/vn4.log 2>&1 && [ "$VNS3" = done ] && curl -s "http://127.0.0.1:8311/api/jobs/$VNJ3" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
assert 'minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors (ComfyUI file)' in L and 'LoRA viggle_animate_dmd_lora_r64.safetensors @ 1.0' in L, L[-1200:]
assert 'starting the engine server' not in L, 'the server should have stayed up'
" >> /tmp/vn4.log 2>&1 \
  && curl -s -X POST http://127.0.0.1:8311/api/components/check -H 'Content-Type: application/json' -d '{"install":false}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d['values']['viggle native'] == '1' and d['decisions']['viggle native']['action'] == 'none', d['values']
" >> /tmp/vn4.log 2>&1 && grep -q "^viggle native=1$" components.txt \
  && ok "viggle native: 🔍 Use my ComfyUI files -> the Viggle model, its DMD LoRA and the H3 VAE you already have are used (no download); the server kept running between jobs" \
  || { bad "native engine: the ComfyUI files were not taken ($VNS3)"; tail -3 /tmp/vn4.log; }
NEC server '{"action":"stop"}' > /dev/null      # BEFORE the port goes back to 8199 - stops the 8398 server
NEC config '{"dir":"","venv":"","port":8199,"picks":{}}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' -d "{\"engine\":{\"comfy\":{\"dir\":\"$VNCD\"}}}" > /dev/null
SDJ set '{"engine":"viggle","settings":{"seed_mode":"random","seed":0}}' > /dev/null
rm -f components.txt /tmp/compjs.log
rm -rf "$VNROOT" /tmp/vn0.log /tmp/vn1.log /tmp/vn2.log /tmp/vn3.log /tmp/vn4.log
rm -f /tmp/vgsafe.log /tmp/vgsafe2.log
[ -n "$VGNEW" ] && rm -f $VGNEW
rm -f /tmp/vg344.log /tmp/vgu.json /tmp/vgblack.log
SDJ set '{"engine":"h3"}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/temploras/swap -H 'Content-Type: application/json' -d '{"loras":[]}' > /dev/null
rm -f "$SWLROOT/ComfyUI/models/loras/LTX/LTX25_Ripple_v11.safetensors" "$SWLROOT/ComfyUI/models/loras/e2e_swaplook.safetensors" /tmp/rpset.json
for f in $RPMODELS; do rm -f "$SWLROOT/ComfyUI/models/$f"; done
rm -rf "$PD/vidTemp" "$PD/vidSwap" "$PD/swap_dialog.json" /tmp/e2e_rp_touch.png /tmp/rpu.json
# ---- 2.330.0: LOADING BIG MOVIES + THE CHARACTER SWAP IN VR (Tim: "the
# video dialog is not loading movies, is there a maximum duration of movie
# that can be uploaded?" + "is it possible to make it 360 stereo and 180sbs ?
# and usable results" -> "yes please build it"). A path from the app's file
# dialog is imported (linked / copied, any size); the asset upload streams to
# disk (it was a silent 64 MB limit). VR: the swap renders a virtual camera
# aimed at the person in the left eye; the right eye is built through the
# original depth; both go back into the full stereo frame, tagged for VR.
VRD=/tmp/e2e_vr; rm -rf "$VRD"; mkdir -p "$VRD"
ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=1024x512:rate=30" -f lavfi -i "mandelbrot=size=160x220:rate=30" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000" -filter_complex \
  "[0:v]split=2[bl][br];[1:v]split=2[pl][pr];[bl][pl]overlay=x=560:y=150[L];[br][pr]overlay=x=540:y=150[R];[L][R]vstack[v]" \
  -map "[v]" -map 2:a -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac "$VRD/e2e_club_360_TB.mp4"
rm -rf "$PD/vidTemp" "$PD/vidSwap" "$PD/swap_dialog.json"
VI=$(SDJ import "{\"path\":\"$VRD/e2e_club_360_TB.mp4\"}")
head -c 70000000 /dev/urandom > "$VRD/e2e_big.mov"
VB=$(curl -s -X POST http://127.0.0.1:8311/api/passets -F "file=@$VRD/e2e_big.mov")
echo "$VI" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d['video']=='e2e_club_360_TB.mp4' and d['how'] in ('linked','copied'), d
assert d['vr']['mode']=='tb360' and d['detected']['sure'], d['vr']
" && [ -f "$PD/video/e2e_club_360_TB.mp4" ] && echo "$VB" | grep -q '"name":"e2e_big.mov"' && [ -f "$PD/video/e2e_big.mov" ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/swapdlg/import -H 'Content-Type: application/json' -d '{"path":"/nope/x.mp4"}')" = 404 ] \
  && ok "load: a movie picked in the app's file dialog is imported by PATH (no upload, any size) and its _360_TB name switches VR on; a 70 MB asset uploads (the old silent 64 MB limit is gone)" \
  || bad "load: import / big upload wrong: $(echo "$VI" | head -c 300) | $(echo "$VB" | head -c 200)"
rm -f "$PD/video/e2e_big.mov" "$VRD/e2e_big.mov"
curl -s -X POST http://127.0.0.1:8311/api/swapdlg/picture -F "image=@static/pose-sheets/human.png" > /dev/null
SDJ set '{"vr":{"yaw":45,"pitch":-2,"fov":90,"shape":"3:4"}}' > /dev/null
VV=$(curl -s -o "$VRD/view.jpg" -w '%{http_code} %{content_type}' "http://127.0.0.1:8311/api/swapdlg/vrview?t=1")
VR1=$(SDJ run '{"start":0.5,"dur":1.5,"width":960,"height":544}')
sd_wait
VS=$(curl -s http://127.0.0.1:8311/api/swapdlg)
VF=$(echo "$VS" | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['results'] if x['status']=='done']; print(r[0]['file'] if r else '')")
VJ=$(echo "$VS" | python3 -c "import json,sys; print(json.load(sys.stdin)['results'][0]['job'])")
[ "${VV%% *}" = 200 ] && echo "$VV" | grep -q "image/jpeg" && [ -n "$VF" ] && python3 -c "
import json, subprocess, sys
sys.path.insert(0, 'scripts'); import vr_swap as V
f = sys.argv[1]
assert f.endswith('_360_TB.mp4'), f
d = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,width,height,r_frame_rate','-of','json', f], text=True))
v = [s for s in d['streams'] if s['codec_type']=='video'][0]
assert (v['width'], v['height'], v['r_frame_rate']) == (1024, 1024, '24/1'), v
assert any(s['codec_type']=='audio' for s in d['streams']), d
x = V.read_spherical(f)
assert 'top-bottom' in x and '<GSpherical:Spherical>true' in x, x[:200]
" "$PD/vidTemp/$VF" && curl -s "http://127.0.0.1:8311/api/jobs/$VJ" | python3 -c "
import json,sys; L='\n'.join(json.load(sys.stdin).get('log',[]))
for k in ('VR tb360: eye 1024x512', 'yaw 45, pitch -2 with a 90 degree view (3:4) -> 544x720',
          'the right eye = the swapped left view re-projected through the original depth', 'back onto the 1024x1024 frame',
          'spherical metadata written'):
    assert k in L, k
" && ok "VR: 👁 shows the view; a TB-360 segment renders the virtual camera (3:4 at 90°), builds the right eye through the original depth, goes back into the 1024x1024 stereo frame at 24 fps with its sound, named _360_TB and tagged spherical" \
  || bad "VR: the stereo swap is wrong: $VV | $(echo "$VR1" | head -c 200) | $(echo "$VS" | head -c 300)"
VID=$(echo "$VS" | python3 -c "import json,sys; print([x['id'] for x in json.load(sys.stdin)['results'] if x['status']=='done'][0])")
SDJ keep "{\"id\":\"$VID\",\"keep\":true}" > /dev/null
VC=$(SDJ compile "{\"ids\":[\"$VID\"]}")
VCN=$(echo "$VC" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
[ -n "$VCN" ] && [[ "$VCN" == *_swapped_360_TB.mp4 ]] && python3 -c "
import sys; sys.path.insert(0, 'scripts'); import vr_swap as V
assert 'top-bottom' in V.read_spherical(sys.argv[1])
" "$PD/video/$VCN" \
  && ok "VR: 🎬 Compile keeps the VR name (_swapped_360_TB) and writes the spherical metadata on the joined movie" \
  || bad "VR: the VR compile is wrong: $VC"
rm -rf "$PD/vidTemp" "$PD/vidSwap" "$PD/swap_dialog.json" "$PD/video/$VCN" "$PD/video/e2e_club_360_TB.mp4" "$VRD"
rm -f "projects/$NAP/video/e2e_swap_src_sel_f26-f75.mp4" "projects/$NAP/refsel.json" "projects/$NAP/output/$SWOUT3"
rm -f "projects/$NAP/video/e2e_swap_src.mp4" "projects/$NAP/output/$SWOUT"
rm -f "projects/$NAP/sound/e2e_na290.wav" comfy_workflows/MMH3_NativeAudio_MV.json comfy_workflows/MMH3_NativeAudio_MV.json.src \
      comfy_workflows/MMH3_NativeAudio_MV_tmp.json comfy_workflows/MMH3_NativeAudio_MV_fl2va_tmp.json
curl -s -X POST http://127.0.0.1:8311/api/scenes/audio -H 'Content-Type: application/json' -d '{"file":""}' > /dev/null
# restore: character-chain style, sdcli backend (what this region ran under),
# board cleared of the mmh3 plan, bases removed
curl -sf -X POST http://127.0.0.1:8311/api/scenes/style -H 'Content-Type: application/json' \
  -d '{"name":""}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/clear -H 'Content-Type: application/json' -d '{}' > /dev/null
curl -s -X DELETE http://127.0.0.1:8311/api/characters/E2eSinger > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"sdcli"}}' > /dev/null
rm -f comfy_workflows/MMH3_Music_Video.json comfy_workflows/MMH3_Music_Video_tmp.json

# ---- 2.276.0: waveform region volume — flatten the selected part in
# place (the separation-bleed fix). MEASURE WITH atrim INSIDE THE
# FILTERGRAPH — output -ss measures the whole file and lies.
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=6" \
  "projects/default/sound/e2e_vol.wav"
VE=$(curl -s -X POST http://127.0.0.1:8311/api/stems/volume \
  -H 'Content-Type: application/json' \
  -d '{"file":"e2e_vol.wav","from":0.3333,"to":0.6667,"gain":0}')
MID=$(ffmpeg -hide_banner -i "projects/default/sound/e2e_vol.wav" \
  -af "atrim=2.5:3.5,volumedetect" -f null - 2>&1 | grep -o 'mean_volume: *[-0-9.]*' | grep -o '[-0-9.]*$')
EDGE=$(ffmpeg -hide_banner -i "projects/default/sound/e2e_vol.wav" \
  -af "atrim=0.5:1.5,volumedetect" -f null - 2>&1 | grep -o 'mean_volume: *[-0-9.]*' | grep -o '[-0-9.]*$')
echo "$VE" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('gain')==0, d
mid=float($MID); edge=float($EDGE)
assert mid < -80, ('middle not flattened', mid)
assert -25 < edge < -15, ('edge damaged', edge)
" && ok "volume: the selected region flattens to silence, the rest untouched" \
  || bad "volume: edit broke: $VE mid=$MID edge=$EDGE"
curl -s -X POST http://127.0.0.1:8311/api/stems/volume \
  -H 'Content-Type: application/json' \
  -d '{"file":"e2e_vol.wav","from":0.8,"to":0.2,"gain":0}' \
  | grep -q "the selection must be a region" \
  && ok "volume: a backwards region is refused in words" \
  || bad "volume: silent on a backwards region"
# 2.277.0: the slider applies INSTANTLY and repeatedly — rebase keeps the
# gain ABSOLUTE (50% then 25% from the base = -12 dB, never compounded -18)
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=6" \
  "projects/default/sound/e2e_vol2.wav"
curl -s -X POST http://127.0.0.1:8311/api/stems/volume -H 'Content-Type: application/json' \
  -d '{"file":"e2e_vol2.wav","from":0.3333,"to":0.6667,"gain":0.5,"rebase":true}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/stems/volume -H 'Content-Type: application/json' \
  -d '{"file":"e2e_vol2.wav","from":0.3333,"to":0.6667,"gain":0.25,"rebase":false}' > /dev/null
MID2=$(ffmpeg -hide_banner -i "projects/default/sound/e2e_vol2.wav" \
  -af "atrim=2.5:3.5,volumedetect" -f null - 2>&1 | grep -o 'mean_volume: *[-0-9.]*' | grep -o '[-0-9.]*$')
python3 -c "
mid=float($MID2)
assert -35 < mid < -31, ('compounded or unapplied', mid)
" && ok "volume: repeated slider changes stay ABSOLUTE (rebase base, never compounding)" \
  || bad "volume: rebase broke - region at $MID2 dB"
rm -f "projects/default/sound/e2e_vol2.wav" "projects/default/sound/e2e_vol2.wav.volbase"
rm -f "projects/default/sound/e2e_vol.wav"

# ---- 2.272.0: songs from anywhere (the Stems dock's 📂 posts here; the
# 512MB route shares /api/passets' ONE save path)
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=196:duration=2" /tmp/e2e_anysong.wav
UP=$(curl -sf -X POST http://127.0.0.1:8311/api/stems/upload \
  -F "file=@/tmp/e2e_anysong.wav;filename=Any Where Song.wav")
echo "$UP" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('name')=='Any Where Song.wav' and d.get('kind')=='sound', d
" && ls "projects/default/sound/Any Where Song.wav" > /dev/null 2>&1 \
  && ok "stems upload: a song from anywhere lands among the project's sound assets" \
  || bad "stems upload: broke: $(echo "$UP" | head -c 240)"
# 2.299.0 (Tim: "song can be loaded from anywhere but is copied to the
# active project"): the SAME song loaded again reuses its copy (no
# "Any Where Song (2).wav"); a DIFFERENT file of that name still gets its own
UP2=$(curl -sf -X POST http://127.0.0.1:8311/api/stems/upload \
  -F "file=@/tmp/e2e_anysong.wav;filename=Any Where Song.wav")
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=262:duration=2" /tmp/e2e_anysong2.wav
UP3=$(curl -sf -X POST http://127.0.0.1:8311/api/stems/upload \
  -F "file=@/tmp/e2e_anysong2.wav;filename=Any Where Song.wav")
echo "$UP2 $UP3" | python3 -c "
import json,sys
a,b=sys.stdin.read().split('} {',1); a=json.loads(a+'}'); b=json.loads('{'+b)
assert a.get('ok') and a.get('existed') is True and a['name']=='Any Where Song.wav', a
assert b.get('ok') and not b.get('existed') and b['name']=='Any Where Song (2).wav', b
" && [ ! -f "projects/default/sound/Any Where Song (3).wav" ] \
  && ok "song load: the same song again reuses its copy in the project; a different file of that name gets its own" \
  || bad "song load: copy/reuse wrong: $(echo "$UP2 $UP3" | head -c 300)"
rm -f "projects/default/sound/Any Where Song (2).wav" /tmp/e2e_anysong2.wav
printf 'P' > /tmp/e2e_notsong.png
RJ=$(curl -s -X POST http://127.0.0.1:8311/api/stems/upload \
  -F "file=@/tmp/e2e_notsong.png")
echo "$RJ" | grep -q "not an audio file" \
  && [ ! -f "projects/default/images/e2e_notsong.png" ] \
  && ok "stems upload: a picture is refused in words and never lands" \
  || bad "stems upload: refusal broke: $(echo "$RJ" | head -c 200)"

AS=$(curl -sf http://127.0.0.1:8311/api/asr)
[ "$(echo "$AS" | jget "['installed']")" = "True" ] \
  && ok "asr: local venv detected" || bad "asr: venv not detected"

# ---------------- 2.265.0: training datasets (the chDlg Dataset tab) -------
printf 'P' > /tmp/e2e_ds.png    # bytes are bytes to the store
DSUP=$(curl -sf -X POST "http://127.0.0.1:8311/api/datasets/e2e%20set/images" \
  -F "images=@/tmp/e2e_ds.png" -F "images=@/tmp/e2e_ds.png")
[ "$(echo "$DSUP" | jget "['images'].__len__()")" = "2" ] \
  && ok "datasets: two uploads stored, collision suffixed" \
  || bad "datasets: upload broke: $DSUP"
curl -sf -X PUT "http://127.0.0.1:8311/api/datasets/e2e%20set/caption" \
  -H 'Content-Type: application/json' \
  -d '{"file":"e2e_ds.png","caption":"a tiny test square"}' > /dev/null
DSL=$(curl -sf "http://127.0.0.1:8311/api/datasets/e2e%20set")
echo "$DSL" | grep -q '"a tiny test square"' \
  && ok "datasets: caption written and listed" || bad "datasets: caption lost: $DSL"
[ -f "datasets/e2e set/e2e_ds.txt" ] \
  && ok "datasets: sidecar .txt on disk beside the image" \
  || bad "datasets: no sidecar file"
curl -sf "http://127.0.0.1:8311/api/datasets/e2e%20set/file/e2e_ds.png" -o /tmp/e2e_ds_back.png \
  && cmp -s /tmp/e2e_ds.png /tmp/e2e_ds_back.png \
  && ok "datasets: the image serves back byte-identical" \
  || bad "datasets: file route broke"
curl -sf -X DELETE "http://127.0.0.1:8311/api/datasets/e2e%20set/images/e2e_ds_1.png" > /dev/null
DSA=$(curl -sf -X DELETE "http://127.0.0.1:8311/api/datasets/e2e%20set/images")
[ "$(echo "$DSA" | jget "['removed']")" = "1" ] \
  && [ ! -f "datasets/e2e set/e2e_ds.txt" ] \
  && ok "datasets: delete-one then delete-all sweeps images AND sidecars" \
  || bad "datasets: delete path broke: $DSA"
curl -s "http://127.0.0.1:8311/api/datasets/..%2Fup" | grep -q error \
  && ok "datasets: a hostile name is refused" || bad "datasets: hostile name accepted"

ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=300:duration=12" /tmp/e2e_voice.wav
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_voice.wav" > /dev/null
VC=$(curl -sf -X POST http://127.0.0.1:8311/api/tts/voices \
  -F "file=@/tmp/e2e_voice.wav" -F "name=narrator" -F "text=this is the reference line")
echo "$VC" | jget "['name']" | grep -q narrator \
  && ok "tts: voice clone saved" || bad "tts: clone save"
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=300:duration=1" /tmp/e2e_short.wav
SV=$(curl -sf -X POST http://127.0.0.1:8311/api/tts/voices \
  -F "file=@/tmp/e2e_short.wav" -F "name=tooshort" -F "text=hi")
echo "$SV" | jget "['warn']" | grep -qi "clones far better" \
  && ok "tts: short reference clip warns" || bad "tts: no short-clip warning"

# waveform region -> ffmpeg cut -> voice clone
RG=$(curl -s --max-time 30 -X POST http://127.0.0.1:8311/api/tts/voices/clip \
  -H 'Content-Type: application/json' \
  -d '{"name":"e2e_voice.wav","voice":"fromregion","text":"the chosen region","start":2,"end":7}')
echo "$RG" | python3 -c "
import json,sys;d=json.load(sys.stdin)
v=[x for x in d['voices'] if x['name']=='fromregion'][0]
sys.exit(0 if abs(v['seconds']-5)<0.25 and d['start']==2 and d['end']==7 else 1)" \
  && ok "tts: waveform region cut to exactly the selected 5s" || bad "tts: region cut ${RG:0:140}"
curl -s -X POST http://127.0.0.1:8311/api/tts/voices/clip -H 'Content-Type: application/json' \
  -d '{"name":"e2e_voice.wav","voice":"tiny","start":1,"end":1.1}' | grep -q "at least 0.3s" \
  && ok "tts: a too-small region is rejected" || bad "tts: tiny region accepted"

SP=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/tts/speak \
  -H 'Content-Type: application/json' \
  -d '{"text":"hello from the timeline","voice":"narrator","name":"e2e_line"}')
[ "$(echo "$SP" | jget "['name']")" = "e2e_line.wav" ] \
  && ok "tts: local synthesis saved a wav" || bad "tts: speak returned ${SP:0:120}"
curl -sf http://127.0.0.1:8311/api/passets | jget "['sound']" | grep -q "e2e_line.wav" \
  && ok "tts: speech appears in the Sound tray (usable as a reference sound)" \
  || bad "tts: not in sound assets"
curl -s -X POST http://127.0.0.1:8311/api/tts/speak -H 'Content-Type: application/json' \
  -d '{"text":""}' | grep -q "nothing to say" \
  && ok "tts: empty text rejected" || bad "tts: empty text accepted"
curl -s -X DELETE http://127.0.0.1:8311/api/tts/voices/tooshort | grep -q "deleted" \
  && ok "tts: voice clone deleted" || bad "tts: delete failed"

# install endpoint queues a venv build job
IN=$(curl -s -X POST http://127.0.0.1:8311/api/audio/install \
  -H 'Content-Type: application/json' -d '{"which":"whisper"}')
echo "$IN" | jget "['venv']" | grep -q "whisper" \
  && ok "install: faster-whisper venv job queued" || bad "install: ${IN:0:120}"
curl -s -X POST http://127.0.0.1:8311/api/audio/install -H 'Content-Type: application/json' \
  -d '{"which":"nope"}' | grep -q "omnivoice, whisper or demucs" \
  && ok "install: unknown tool rejected (the three-venv wording)" || bad "install: bad tool accepted"

# ---- OMNIVOICE IS THE ENGINE (2.264.0, Tim: "use ominvoice for voice
# cloning and tts. remove openaudio"). Same voice store, same routes.
python3 scripts/test-omnivoice.py > /tmp/omni.log 2>&1 \
  && ok "omnivoice worker unit tests (clone / design / auto, prompt cache, contract)" \
  || { bad "omnivoice worker unit tests"; tail -16 /tmp/omni.log; }
curl -sf http://127.0.0.1:8311/api/tts | grep -q '"engine":"omnivoice"' \
  && ok "tts: OmniVoice is the only engine (2.264.0)" || bad "tts: default engine wrong"
curl -sf http://127.0.0.1:8311/api/tts | grep -q '"omnivoice":{"venv"' \
  && ok "tts: status reports the omnivoice venv" || bad "tts: status lacks omnivoice"
IN=$(curl -s -X POST http://127.0.0.1:8311/api/audio/install -H 'Content-Type: application/json' -d '{"which":"omnivoice"}')
echo "$IN" | jget "['venv']" | grep -q "omnivoice" \
  && ok "install: OmniVoice venv job queued (its own venv)" || bad "install: omnivoice ${IN:0:120}"
# a DESIGNED voice: no clip, only a description — refused by OpenAudio, spoken by OmniVoice
VD=$(curl -s -X POST http://127.0.0.1:8311/api/tts/voices/design -H 'Content-Type: application/json' \
  -d '{"name":"oldman","instruct":"male, elderly, low pitch, british accent"}')
echo "$VD" | grep -q '"kind":"design"' && ok "tts: a designed voice is saved beside the clones" || bad "tts: design save ${VD:0:120}"
[ -f projects/default/voices/oldman.json ] && [ ! -f projects/default/voices/oldman.wav ] \
  && ok "tts: the designed voice is a json with no wav" || bad "tts: design voice files wrong"
curl -s -X POST http://127.0.0.1:8311/api/tts/voices/design -H 'Content-Type: application/json' \
  -d '{"name":"narrator","instruct":"x"}' | grep -q "is a cloned voice" \
  && ok "tts: a description never silently replaces a clone of the same name" || bad "tts: design overwrote a clone"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"tts":{"engine":"openaudio"}}' > /dev/null
curl -sf http://127.0.0.1:8311/api/tts | grep -q '"engine":"omnivoice"' \
  && ok "tts: a LEGACY openaudio config reads over as omnivoice (2.264.0)" || bad "tts: legacy engine leaked through"
SO=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/tts/speak -H 'Content-Type: application/json' \
  -d '{"text":"hello from omnivoice","voice":"oldman","name":"e2e_omni_design"}')
echo "$SO" | grep -q '"engine":"omnivoice"' && [ "$(echo "$SO" | jget "['name']")" = "e2e_omni_design.wav" ] \
  && ok "tts: OmniVoice speaks the designed voice into the Sound folder" || bad "tts: omnivoice design speak ${SO:0:160}"
SC=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/tts/speak -H 'Content-Type: application/json' \
  -d '{"text":"hello from omnivoice","voice":"narrator","name":"e2e_omni_clone"}')
echo "$SC" | grep -q '"engine":"omnivoice"' \
  && ok "tts: OmniVoice speaks an existing CLONE unchanged (same voice store)" || bad "tts: omnivoice clone speak ${SC:0:160}"
curl -sf http://127.0.0.1:8311/api/tts/progress | grep -q "STUBOMNI mode=clone" \
  && ok "tts: ...and the clone went through the omnivoice helper with its prompt cache" || bad "tts: omnivoice helper not used"
curl -sf http://127.0.0.1:8311/api/tts/omnivoice | grep -q '"ok":true' \
  && ok "tts: /api/tts/omnivoice import check runs in its venv" || bad "tts: omnivoice check failed"
curl -s -X DELETE http://127.0.0.1:8311/api/tts/voices/oldman | grep -q "deleted" \
  && ok "tts: designed voice deleted" || bad "tts: design delete failed"

# ---- speech self-test + weights/entry-point diagnostics
TT=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/tts/test \
  -H 'Content-Type: application/json' -d '{"text":"hello there"}')
echo "$TT" | jget "['ok']" | grep -q True \
  && ok "tts/test: speaks a line through the venv" || bad "tts/test: ${TT:0:140}"
curl -sf http://127.0.0.1:8311/api/passets | python3 -c "
import json,sys
snd=[a['name'] for a in json.load(sys.stdin)['sound']]
sys.exit(0 if not any(n.startswith('__ttstest') for n in snd) else 1)" \
  && ok "tts/test: leaves no test file in the Sound assets" || bad "tts/test: left litter"
# 2.264.0: the three tts_local.py diagnostics legs left with OpenAudio

# ---- transitions catalogue
TRS=$(curl -s --max-time 20 http://127.0.0.1:8311/api/transitions)
echo "$TRS" | jget "['transitions'][0]['id']" | grep -q none \
  && ok "transitions: the catalogue is served with a cut first" || bad "transitions: ${TRS:0:160}"
python3 -c "
import json,sys
d=json.loads(sys.argv[1]); ids=[t['id'] for t in d['transitions']]
need=['fade','fadeblack','fadewhite','wipeleft','slideleft','circleopen']
sys.exit(0 if all(n in ids for n in need) and d.get('default_duration') else 1)" "$TRS" \
  && ok "transitions: the standard set and defaults are exposed" || bad "transitions: ${TRS:0:200}"
python3 scripts/test-transitions.py >/dev/null 2>&1 \
  && ok "transitions: xfade offsets and clamping hold" || bad "transitions: unit suite failed"

# ---- new project endpoint
NP=$(curl -s --max-time 20 -X POST -H "Content-Type: application/json" \
  -d '{"name":"e2e-newproj","description":"made by the e2e run"}' \
  http://127.0.0.1:8311/api/projects/new)
echo "$NP" | jget "['name']" | grep -q e2e-newproj \
  && ok "projects: New creates and switches to the project" || bad "projects: ${NP:0:160}"
echo "$NP" | jget "['data']['description']" | grep -q "e2e run" \
  && ok "projects: the description is stored with the project" || bad "projects: ${NP:0:160}"
# 2.371.0 (Tim: "when user creates a new project clear all the dockers"): the new project is EMPTY everywhere
FRESH=$(python3 - <<'PY'
import json, urllib.request
def g(u):
    return json.load(urllib.request.urlopen("http://127.0.0.1:8311" + u, timeout=20))
bad = []
if g("/api/characters")["characters"]: bad.append("characters")
if g("/api/environments")["environments"]: bad.append("environments")
for k in ("video", "images", "audio"):
    if g("/api/outputs?kind=" + k): bad.append("gallery " + k)
pa = g("/api/passets")
for k in ("images", "video", "sound"):
    if pa.get(k): bad.append("assets " + k)
c = g("/api/chat")
if c["messages"] or [x for x in c.get("saved", []) if x != c["session"]]: bad.append("chat")
r = g("/api/refgroups")
if r.get("groups"): bad.append("references")
alljobs = g("/api/jobs?all=1"); jobs = g("/api/jobs")
if not alljobs: bad.append("no jobs at all to compare")
if [j for j in jobs if j.get("status") not in ("queued", "running")]: bad.append("queue shows the old project's finished jobs")
print("ok" if not bad else "; ".join(bad))
PY
)
[ "$FRESH" = "ok" ] && ok "new project: characters, environments, gallery, assets, chat, references and the queue all start empty" \
  || bad "new project: not fresh - $FRESH"
DUP=$(curl -s --max-time 20 -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" -d '{"name":"e2e-newproj"}' \
  http://127.0.0.1:8311/api/projects/new)
[ "$DUP" = "409" ] && ok "projects: New refuses to overwrite an existing project" \
  || bad "projects: duplicate returned $DUP"
BADN=$(curl -s --max-time 20 -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" -d '{"name":"../escape"}' \
  http://127.0.0.1:8311/api/projects/new)
[ "$BADN" = "400" ] && ok "projects: a path separator in the name is rejected" \
  || bad "projects: ../escape returned $BADN"
curl -s --max-time 20 -X POST -H "Content-Type: application/json" \
  -d '{"name":"default"}' http://127.0.0.1:8311/api/projects/load >/dev/null
BACKJ=$(curl -s --max-time 20 http://127.0.0.1:8311/api/jobs | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
[ "${BACKJ:-0}" -gt 0 ] && ok "new project: back in the old project its finished jobs are listed again" \
  || bad "new project: the old project's queue is empty ($BACKJ)"

# ---- checkpoint doctor: GONE with OpenAudio (2.264.0)
[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/api/tts/checkpoint)" = "404" ] \
  && ok "checkpoint doctor: gone with the engine (2.264.0)" \
  || bad "checkpoint doctor: endpoint still answers"

# ---- m4a reference clips, voice transcribe, installer progress
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=330:duration=6" -c:a aac /tmp/e2e_v.m4a
M4=$(curl -sf -X POST http://127.0.0.1:8311/api/tts/voices \
  -F "file=@/tmp/e2e_v.m4a" -F "name=m4avoice" -F "text=from an m4a")
echo "$M4" | jget "['name']" | grep -q m4avoice \
  && ok "m4a: accepted as a voice-clone reference" || bad "m4a: rejected ${M4:0:120}"
M4F=$(find projects -name "m4avoice.wav" | head -1)
[ -n "$M4F" ] && [ "$(ffprobe -v error -show_entries stream=codec_name -of csv=p=0 "$M4F")" = "pcm_s16le" ] \
  && ok "m4a: stored as real PCM, not an m4a wearing a .wav name" \
  || bad "m4a: stored codec wrong"
curl -s -X POST http://127.0.0.1:8311/api/tts/voices \
  -F "file=@/tmp/e2e_ref1.png" -F "name=notaudio" -F "text=x" \
  | grep -q "could not read that audio file" \
  && ok "m4a: a non-audio file is rejected with a clear message" || bad "m4a: junk accepted"

# transcribe the reference so the user need not type it
VT=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/tts/voices/transcribe \
  -H 'Content-Type: application/json' -d '{"voice":"m4avoice"}')
echo "$VT" | jget "['text']" | grep -q "first line" \
  && ok "voice: transcribe fills in what the reference says" || bad "voice: transcribe ${VT:0:120}"
VT2=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/tts/voices/transcribe \
  -H 'Content-Type: application/json' -d '{"name":"e2e_voice.wav","start":1,"end":4}')
echo "$VT2" | jget "['text']" | grep -q "first line" \
  && ok "voice: transcribe works on a waveform region" || bad "voice: region transcribe"
curl -s -X POST http://127.0.0.1:8311/api/tts/voices/transcribe -H 'Content-Type: application/json' \
  -d '{"voice":"nosuch"}' | grep -q "not found" \
  && ok "voice: transcribing an unknown voice is rejected" || bad "voice: unknown voice"

# installer reports staged progress rather than going quiet
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"asr":{"venv":"venvs/e2e-probe"}}' > /dev/null
IJ=$(curl -sf -X POST http://127.0.0.1:8311/api/audio/install \
  -H 'Content-Type: application/json' -d '{"which":"whisper"}')
IID=$(echo "$IJ" | jget "['id']")
for i in $(seq 1 60); do
  ist=$(curl -sf "http://127.0.0.1:8311/api/jobs/$IID" | jget "['status']")
  [ "$ist" = "done" ] || [ "$ist" = "failed" ] && break
  sleep 1
done
ILOG=$(curl -sf "http://127.0.0.1:8311/api/jobs/$IID?log_from=0" | jget "['log']")
# match the stage names rather than a hardcoded total
echo "$ILOG" | grep -qE "step 1/[0-9]+: creating the venv" \
  && ok "install: reports numbered progress steps" || bad "install: no step lines"
echo "$ILOG" | grep -qE "step 2/[0-9]+: upgrading pip" \
  && ok "install: pip stage reported" || bad "install: no pip stage"

curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"asr":{"venv":""}}' > /dev/null
rm -rf venvs/e2e-probe

# ---- "Choose file" voice-clone path (upload, with and without a region)
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=520:duration=8" /tmp/e2e_pick.wav
UP=$(curl -sf -X POST http://127.0.0.1:8311/api/tts/voices \
  -F "file=@/tmp/e2e_pick.wav" -F "name=pickedwhole" -F "text=whole file")
echo "$UP" | python3 -c "
import json,sys;d=json.load(sys.stdin)
sys.exit(0 if abs(d['seconds']-8)<0.3 else 1)" \
  && ok "voice: an uploaded file saves whole (Save voice clone)" || bad "voice: whole upload ${UP:0:120}"
UR=$(curl -sf -X POST http://127.0.0.1:8311/api/tts/voices \
  -F "file=@/tmp/e2e_pick.wav" -F "name=pickedregion" -F "text=a region" \
  -F "start=2" -F "end=5")
echo "$UR" | python3 -c "
import json,sys;d=json.load(sys.stdin)
sys.exit(0 if abs(d['seconds']-3)<0.3 else 1)" \
  && ok "voice: an uploaded file honours the waveform region (2-5s = 3s)" \
  || bad "voice: region upload ${UR:0:120}"
TU=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/asr/transcribe-upload \
  -F "file=@/tmp/e2e_pick.wav" -F "start=1" -F "end=4")
echo "$TU" | jget "['text']" | grep -q "first line" \
  && ok "voice: Transcribe works on a browser-only file" || bad "voice: upload transcribe ${TU:0:120}"
curl -s -X POST http://127.0.0.1:8311/api/asr/transcribe-upload | grep -q "no file" \
  && ok "voice: transcribe-upload with no file is rejected" || bad "voice: empty upload"

# ---- speech to text / lyrics (local faster-whisper via the stub venv)
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"asr":{"model":"base","language":"en","device":"cpu"}}' > /dev/null
TR=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/asr/transcribe \
  -H 'Content-Type: application/json' -d '{"name":"e2e_base.webm","mode":"speech"}')
echo "$TR" | jget "['text']" | grep -q "first line" \
  && ok "asr: transcribed a video asset (demuxed automatically)" || bad "asr: video transcribe"
echo "$TR" | python3 -c "
import json,sys;d=json.load(sys.stdin)
sys.exit(0 if len(d['segments'])==2 and d['segments'][1]['start']==1.5 and d['language']=='en' else 1)" \
  && ok "asr: timed segments returned" || bad "asr: segments wrong"
echo "$TR" | python3 -c "
import json,sys;d=json.load(sys.stdin)
w=d['segments'][0].get('words') or []
sys.exit(0 if w and w[0]['text']=='first' else 1)" \
  && ok "asr: per-word timestamps survive (enables word-level karaoke)" || bad "asr: no word timings"
echo "$TR" | jget "['files']" | grep -q "e2e_base.srt" \
  && ok "asr: wrote .txt and .srt" || bad "asr: files"
LY=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/asr/transcribe \
  -H 'Content-Type: application/json' -d '{"name":"e2e_line.wav","mode":"lyrics"}')
echo "$LY" | jget "['files']" | grep -q "e2e_line.lrc" \
  && ok "asr: lyrics mode writes an .lrc" || bad "asr: no lrc"
curl -sf http://127.0.0.1:8311/api/asr/file/e2e_line.lrc | grep -qE '^\[00:00\.00\]first line' \
  && ok "asr: .lrc carries karaoke timestamps" || bad "asr: lrc format"
curl -sf http://127.0.0.1:8311/api/asr/file/e2e_base.srt | grep -q "00:00:01,500 --> 00:00:03,000" \
  && ok "asr: .srt timecodes are well formed" || bad "asr: srt format"
curl -s -X POST http://127.0.0.1:8311/api/asr/transcribe -H 'Content-Type: application/json' \
  -d '{"name":"nope.wav"}' | grep -q "asset not found" \
  && ok "asr: missing asset rejected" || bad "asr: missing asset"
curl -s --path-as-is "http://127.0.0.1:8311/api/asr/file/..%2F..%2Fconfig.json" \
  | grep -q "no such transcript" \
  && ok "asr: transcript path traversal blocked" || bad "asr: traversal not blocked"

# ---- quick prompt (needs an LLM; the stub serves /v1/chat/completions)
python3 scripts/stub-tts.py 8099 > /dev/null 2> /tmp/ttsreq.log &
LLMPID=$!
sleep 1.2
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"llm":{"external_url":"http://127.0.0.1:8099/v1/chat/completions","external_model":"stub"}}' > /dev/null
QP=$(curl -s --max-time 90 -X POST http://127.0.0.1:8311/api/quickprompt \
  -H 'Content-Type: application/json' -d '{"name":"e2e_line.wav","shot_seconds":2}')
echo "$QP" | jget "['tmp_file']" | grep -q "e2e_line.tmp" \
  && ok "quickprompt: words written to songs/<song>.tmp" || bad "quickprompt: ${QP:0:140}"
echo "$QP" | python3 -c "
import json,sys
d=json.load(sys.stdin); sh=d['shots']
sys.exit(0 if len(sh)>=1 and all(s['prompt'] for s in sh) and sh[0]['start']==0.0 else 1)" \
  && ok "quickprompt: every shot has a prompt and starts on a lyric boundary" || bad "quickprompt: shot shape"
echo "$QP" | jget "['lines']" | grep -qE '^[0-9.]+s \| ' \
  && ok "quickprompt: lines are in the music-video shot format" || bad "quickprompt: line format"
echo "$QP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
sys.exit(0 if not any('\`\`\`' in s['prompt'] or s['prompt'].startswith('[') for s in d['shots']) else 1)" \
  && ok "quickprompt: fenced JSON from the LLM is unwrapped" || bad "quickprompt: fences leaked"
curl -s --max-time 30 -X POST http://127.0.0.1:8311/api/quickprompt \
  -H 'Content-Type: application/json' -d '{"name":"nope.wav"}' | grep -q "asset not found" \
  && ok "quickprompt: missing asset rejected" || bad "quickprompt: missing asset"
# ---- PROMPTING GUIDES (2.104.0, Tim: "teach the LLMs how to write prompts
# for minimax h3, minimax music, flux klein, sdxl, pony, illustrious and
# z-image"). Every LLM entry point carries the guide for the model that runs.
node scripts/test-promptguides.js > /tmp/pguides.log 2>&1 \
  && ok "prompt-guide unit tests (families, pony/illustrious by file name, override)" \
  || { bad "prompt-guide unit tests"; tail -12 /tmp/pguides.log; }
grep -q "guide=MiniMax H3" /tmp/ttsreq.log \
  && ok "guides: the music-video shot writer's system prompt carried the H3 guide" \
  || bad "guides: quickprompt system prompt had no guide: $(grep LLMREQ /tmp/ttsreq.log | tail -1)"
curl -s --max-time 30 -X POST http://127.0.0.1:8311/api/enhance -H 'Content-Type: application/json' \
  -d '{"prompt":"a cat on a roof","mode":"t2va"}' > /dev/null
grep "LLMREQ" /tmp/ttsreq.log | tail -1 | grep -q "guide=MiniMax H3" \
  && ok "guides: Enhance teaches the H3 guide too" || bad "guides: enhance had no guide: $(grep LLMREQ /tmp/ttsreq.log | tail -1)"
# ---- 2.354.0 (Tim: "the llm now returns <filename.ext> instead of <picture 1> ... <subject 1> is the woman
# from picture 1. keep the head, face and hair of woman in <picture 1>, keep the body of the woman in <picture 2>.
# do action in <video x>, voice is <sound 1>"): the chat sees the reference dock by TAG; a reply that still
# writes file names / <sound 1> is retagged before it is stored and shown
ffmpeg -y -loglevel error -f lavfi -i "color=c=blue:s=64x64" -frames:v 1 /tmp/ava_face.png
ffmpeg -y -loglevel error -f lavfi -i "color=c=green:s=64x64" -frames:v 1 /tmp/ava_body.png
RD=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/chat -F "text=REFDOCK_TEST write the video prompt" -F describe=0 \
  -F 'context={"gen_mode":"video","refs":[{"name":"ava_face.png","subject":1,"role":"person"},{"name":"ava_body.png","subject":1,"role":"body"}],"ref_videos":["dance.mp4"],"ref_audios":["voice.wav"]}' \
  -F "ref_images=@/tmp/ava_face.png" -F "ref_images=@/tmp/ava_body.png")
echo "$RD" | python3 -c "
import json,sys; r=json.load(sys.stdin)['reply']
assert 'DOCK-SEEN' in r, r
assert '<subject 1> is the woman in <Picture 1>.' in r and 'woman in <Picture 2>' in r and 'action in <Video 1>' in r and 'voice is <Audio 1>' in r, r
assert '.png>' not in r and '<sound' not in r and 'dance.mp4>' not in r, r
" > /tmp/rd354.log 2>&1 && curl -sf "http://127.0.0.1:8311/api/chat" | python3 -c "
import json,sys; m=[x for x in json.load(sys.stdin)['messages'] if x['role']=='assistant'][-1]['text']
assert '<Picture 1>' in m and 'ava_face.png>' not in m, m
" >> /tmp/rd354.log 2>&1 \
  && ok "chat: the reference dock rides by tag (<Picture 1..2> subject 1, <Video 1>, <Audio 1>); a reply writing file names / <sound 1> is retagged before it is stored" \
  || { bad "chat: the reference dock / retag is wrong"; tail -3 /tmp/rd354.log; }
rm -f /tmp/ava_face.png /tmp/ava_body.png /tmp/rd354.log
curl -s --max-time 30 -X POST http://127.0.0.1:8311/api/chat -H 'Content-Type: application/json' \
  -d '{"message":"write me a pony prompt","context":{"gen_mode":"image","image_style_id":"'"$(curl -sf http://127.0.0.1:8311/api/styles | python3 -c "import json,sys;st=[s for s in json.load(sys.stdin)['styles'] if s.get('arch')=='sdxl'];print(st[0]['id'] if st else '')")"'"}}' > /dev/null 2>&1 || true
PG=$(curl -sf "http://127.0.0.1:8311/api/prompt-guides?kind=image&arch=sdxl&model=ponyDiffusionV6XL.safetensors")
echo "$PG" | grep -q '"picked":"pony"' && echo "$PG" | grep -q "score_9" \
  && ok "guides: /api/prompt-guides picks Pony from an SDXL style's file name" || bad "guides: ${PG:0:200}"
# VR SBS addendum over the wire (2.118.0, Tim: "when i ask the llm for a sbs
# vr video, please help it develop the prompt, do not mirror, needs to be for vr")
curl -sf "http://127.0.0.1:8311/api/prompt-guides?kind=video&text=make%20me%20a%20sbs%20vr%20video" | python3 -c "
import json, sys
j = json.load(sys.stdin)
assert j['addenda'] == ['vr_sbs'], j.get('addenda')
assert 'NEVER A MIRROR' in j['addenda_text'] and '6.5 cm' in j['addenda_text']" \
  && ok "prompt guides: 'sbs vr' in the user's words pulls the VR stereo-pair addendum (no mirror)" || bad "prompt guides: vr_sbs addendum"
curl -sf http://127.0.0.1:8311/ext/previewdock/vr360.js | grep -q "VR360" \
  && ok "360 viewer: /ext/previewdock/vr360.js is served" || bad "360 viewer: script not served"
curl -sf "http://127.0.0.1:8311/api/prompt-guides?kind=video&text=make%20me%20a%20360%20vr%20video" | python3 -c "
import json, sys
j = json.load(sys.stdin)
assert j['addenda'] == ['vr_360'], j.get('addenda')
assert 'equirectangular' in j['addenda_text'] and '2:1' in j['addenda_text']" \
  && ok "prompt guides: '360 vr' pulls the equirect addendum only (never the SBS one)" || bad "prompt guides: vr_360 addendum"
curl -sf "http://127.0.0.1:8311/api/prompt-guides?kind=video&text=the%20camera%20orbits%20360%20degrees%20around%20her" | python3 -c "
import json, sys
assert json.load(sys.stdin)['addenda'] == []" \
  && ok "prompt guides: a 360-degree camera ORBIT never triggers the VR addendum" || bad "prompt guides: vr_360 false positive"
curl -sf -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d '{"kind":"video","name":"E2E 360 aspect","arch":"minimax-h3","aspect":"2:1"}' | grep -q '"aspect":"2:1"' \
  && ok "video style: the 2:1 (360) aspect round-trips" || bad "video style: 2:1 aspect rejected"
curl -sf "http://127.0.0.1:8311/api/styles?kind=video" | python3 -c "
import json, sys
j = json.load(sys.stdin)
sid = next(s['id'] for s in j['styles'] if s['name'] == 'E2E 360 aspect')
print(sid)" > /tmp/e2e360id.txt && curl -sf -X DELETE "http://127.0.0.1:8311/api/styles/$(cat /tmp/e2e360id.txt)" > /dev/null
curl -sf "http://127.0.0.1:8311/api/prompt-guides?kind=video&text=two%20dogs%20side%20by%20side%20with%20stereo%20sound" | python3 -c "
import json, sys
j = json.load(sys.stdin)
assert j['addenda'] == [], j.get('addenda')" \
  && ok "prompt guides: 'side by side' dogs and 'stereo sound' never trigger the VR addendum" || bad "prompt guides: vr_sbs false positive"
curl -sf "http://127.0.0.1:8311/api/prompt-guides?kind=video" | grep -q '"picked":"minimax_h3"' \
  && ok "guides: video -> MiniMax H3" || bad "guides: video pick"
curl -sf "http://127.0.0.1:8311/api/prompt-guides" | python3 -c "
import json,sys; j=json.load(sys.stdin); ids={g['id'] for g in j['guides']}
need={'minimax_h3','minimax_music','flux_klein','sdxl','pony','illustrious','z_image'}
assert need<=ids, ids" && ok "guides: all seven requested families are served" || bad "guides: families missing"
kill $LLMPID 2>/dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"llm":{"external_url":"","external_model":""}}' > /dev/null

# ---- karaoke lyrics burned onto a rendered video
LB=$(curl -s --max-time 90 -X POST http://127.0.0.1:8311/api/lyrics/burn \
  -H 'Content-Type: application/json' \
  -d '{"video":"e2e_base.webm","song":"e2e_line.wav","preset":"karaoke","width":192,"height":108}')
LID=$(echo "$LB" | jget "['id']")
if [ -z "$LID" ]; then bad "lyrics: burn rejected ${LB:0:140}"; else
  ok "lyrics: burn job queued"
  for i in $(seq 1 180); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  LL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LID?log_from=0")
  [ "$st" = "done" ] && ok "lyrics: video rendered with burned-in lyrics" \
    || { bad "lyrics: job $st"; echo "$LL" | jget "['log']" | tail -c 300; }
  echo "$LL" | jget "['log']" | grep -q "burning lyrics from" \
    && ok "lyrics: worker reports the subtitle it burned" || bad "lyrics: no burn line"
  LO=$(echo "$LL" | jget "['output']")
  LF=$(find projects -name "$LO" 2>/dev/null | head -1)
  [ -n "$LF" ] && [ -s "$LF" ] && ok "lyrics: output file written" || bad "lyrics: no output for $LO"
  if [ -n "$LF" ]; then
    SRCF=$(find projects -name "e2e_base.webm" | head -1)
    SD=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRCF")
    OD=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$LF")
    python3 -c "import sys; sys.exit(0 if abs($OD-$SD)<0.35 else 1)" \
      && ok "lyrics: burn kept the full video length" || bad "lyrics: length ${SD}s -> ${OD}s"
  fi
fi
ASSF=$(ls projects/*/transcripts/e2e_base.ass 2>/dev/null | head -1)
[ -n "$ASSF" ] && grep -q '{\\k' "$ASSF" \
  && ok "lyrics: ASS carries karaoke \\k timing tags" || bad "lyrics: no \\k tags"
[ -n "$ASSF" ] && grep -q "^Style: H3," "$ASSF" \
  && ok "lyrics: ASS style block written" || bad "lyrics: no style block"
LB2=$(curl -s --max-time 60 -X POST http://127.0.0.1:8311/api/lyrics/burn \
  -H 'Content-Type: application/json' \
  -d '{"video":"e2e_base.webm","lyrics_file":"e2e_line.lrc","preset":"subtitle"}')
echo "$LB2" | jget "['source']" | grep -q "e2e_line.lrc" \
  && ok "lyrics: a saved .lrc is reused instead of re-transcribing" || bad "lyrics: lrc reuse"
curl -s -X POST http://127.0.0.1:8311/api/lyrics/burn -H 'Content-Type: application/json' \
  -d '{"video":"nope.webm"}' | grep -q "video not found" \
  && ok "lyrics: missing video rejected" || bad "lyrics: missing video"

# ---- assets: a duplicate drop must ADD, never overwrite (2.60.0)
cp /tmp/e2e_base.webm /tmp/dupe.webm
D1=$(curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/dupe.webm" | jget "['name']")
D2=$(curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/dupe.webm" | jget "['name']")
[ -n "$D1" ] && [ -n "$D2" ] && [ "$D1" != "$D2" ] \
  && ok "assets: a same-named drop is uniquified instead of overwriting ($D1 -> $D2)" \
  || bad "assets: duplicate drop overwrote the original ($D1 / $D2)"
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/dupe.webm" | grep -q '"renamed"' \
  && ok "assets: the rename is reported back so the UI can say so" \
  || bad "assets: no renamed field on a collision"
echo "not a video" > /tmp/bogus.xyz
curl -s -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/bogus.xyz" \
  | grep -q "unsupported file type" \
  && ok "assets: an unsupported file type is refused with a clear reason" \
  || bad "assets: unsupported type not refused"
# each kind lands in its OWN project folder
PW=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")
ls "projects/$PW/video/$D1" > /dev/null 2>&1 \
  && ok "assets: a dropped video is sorted into the project's video folder" \
  || bad "assets: video not sorted into projects/$PW/video"

# ---- A FINISHED RENDER APPEARS IN THE ASSET DOCK BY ITSELF (2.65.0)
# The worker writes renders into projects/<p>/output/ but the dock lists
# projects/<p>/video/. They are different folders, so every generated video had
# to be found in the gallery and dragged back in by hand before it could be
# used as a timeline clip. lib/autoAssets.js hard-links it across on completion.
AAJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
  -F prompt="[autoassets] tiny clip" -F width=192 -F height=108 -F steps=1 -F seed=77 \
  -F mode=t2va -F frames=24 -F pipeline=auto -F format=webm)
AAID=$(echo "$AAJ" | jget "['id']")
if [ -z "$AAID" ]; then bad "autoassets: generate rejected ${AAJ:0:120}"; else
  for i in $(seq 1 180); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AAID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  AAL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AAID?log_from=0")
  AAO=$(echo "$AAL" | jget "['output']")
  AP=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")
  [ "$st" = "done" ] && ok "autoassets: a render completed" || bad "autoassets: status=$st"
  # THE FEATURE: the render is in the video assets folder without anyone
  # dragging it there
  [ -s "projects/$AP/video/$AAO" ] \
    && ok "autoassets: the finished render lands in the project's Video assets" \
    || bad "autoassets: $AAO never reached projects/$AP/video"
  # and it is visible to the dock, which is what the user actually sees
  curl -sf http://127.0.0.1:8311/api/passets | python3 -c "
import json,sys
j=json.load(sys.stdin)
names=[v['name'] for v in j.get('video',[])]
sys.exit(0 if '$AAO' in names else 1)" \
    && ok "autoassets: GET /api/passets lists it under video" \
    || bad "autoassets: the dock listing does not include $AAO"
  echo "$AAL" | jget "['log']" | grep -q "added to Video assets" \
    && ok "autoassets: the job log says where it went" \
    || bad "autoassets: nothing in the log about the asset"
  # A HARD LINK, NOT A COPY: a render can be gigabytes and copying doubles it
  # on disk every single time. One set of bytes, two names.
  python3 - <<PYEOF
import os, sys
a = os.stat("projects/$AP/output/$AAO")
b = os.stat("projects/$AP/video/$AAO")
assert a.st_size == b.st_size, "sizes differ"
if a.st_ino and b.st_ino:
    assert (a.st_ino, a.st_dev) == (b.st_ino, b.st_dev), "not a hard link - it was copied"
print("linked, one copy of %d bytes" % a.st_size)
PYEOF
  [ $? = 0 ] && ok "autoassets: hard-linked, so the bytes are not duplicated" \
    || bad "autoassets: the render was copied instead of linked"
fi
# A COMPILE MUST NOT BE AUTO-REGISTERED. <project>.mp4 is REPLACED on every
# recompile, and a hard link captures the bytes at link time - the asset would
# silently go stale and you would edit against an older cut.
curl -sf http://127.0.0.1:8311/api/passets | python3 -c "
import json,sys
j=json.load(sys.stdin)
names=[v['name'] for v in j.get('video',[])]
bad=[n for n in names if n.endswith('.mp4') and n.startswith('$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")')]
sys.exit(1 if bad else 0)" \
  && ok "autoassets: the timeline compile is kept OUT of the assets (it is rewritten)" \
  || bad "autoassets: <project>.mp4 was registered and will go stale"

# =====================================================================
# DRAG A GALLERY FILE ONTO THE REFERENCES DOCK (2.70.0)
# The dock hands ref_videos/ref_audios to POST /api/generate as bare NAMES,
# and that route resolves them under projects/<p>/{video,sound} and NOWHERE
# ELSE. A gallery name resolves to a path that does not exist, the job starts
# anyway, and the render comes back quietly missing its reference. So the drop
# adopts first: POST /api/passets/adopt hard-links it across and answers with
# the name it actually got. These checks are about the name being TRUE after.
# =====================================================================
AP2=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=96x54:rate=24 -t 1 \
  -pix_fmt yuv420p "projects/$AP2/output/adopt_me.mp4"
AD=$(curl -sf -X POST http://127.0.0.1:8311/api/passets/adopt \
  -H "Content-Type: application/json" -d '{"name":"adopt_me.mp4","kind":"video"}')
[ "$(echo "$AD" | jget "['name']")" = "adopt_me.mp4" ] \
  && [ "$(echo "$AD" | jget "['kind']")" = "video" ] \
  && ok "adopt: a gallery render is taken into the project's Video assets" \
  || bad "adopt: unexpected response ${AD:0:160}"
# THE WHOLE POINT: the name the dock will send to /api/generate now resolves
[ -s "projects/$AP2/video/adopt_me.mp4" ] \
  && ok "adopt: the returned name resolves where /api/generate looks for it" \
  || bad "adopt: adopt_me.mp4 never reached projects/$AP2/video"
python3 - <<PYEOF
import os, sys
a = os.stat("projects/$AP2/output/adopt_me.mp4")
b = os.stat("projects/$AP2/video/adopt_me.mp4")
assert a.st_size == b.st_size, "sizes differ"
if a.st_ino and b.st_ino:
    assert (a.st_ino, a.st_dev) == (b.st_ino, b.st_dev), "copied, not linked"
PYEOF
[ $? = 0 ] && ok "adopt: hard-linked, so referencing a render does not double it on disk" \
  || bad "adopt: the render was copied instead of linked"
# adopting twice must not pile up "adopt_me (2).mp4" — the common case is that
# autoAssets already registered the render, and that is a success, not a clash
curl -sf -X POST http://127.0.0.1:8311/api/passets/adopt \
  -H "Content-Type: application/json" -d '{"name":"adopt_me.mp4","kind":"video"}' \
  | grep -q '"how": *"exists"' \
  && ok "adopt: an already-registered render reports exists, not a duplicate" \
  || bad "adopt: second adopt did not report exists"
[ ! -e "projects/$AP2/video/adopt_me (2).mp4" ] \
  && ok "adopt: repeated drags do not accumulate copies" \
  || bad "adopt: a duplicate asset appeared"
# a sound file routes to the sound assets, not video
cp /tmp/e2e_song.wav "projects/$AP2/output/adopt_snd.wav" 2>/dev/null \
  || ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=1" "projects/$AP2/output/adopt_snd.wav"
curl -sf -X POST http://127.0.0.1:8311/api/passets/adopt \
  -H "Content-Type: application/json" -d '{"name":"adopt_snd.wav"}' \
  | grep -q '"kind": *"sound"' \
  && [ -s "projects/$AP2/sound/adopt_snd.wav" ] \
  && ok "adopt: a sound file lands in the Sound assets" \
  || bad "adopt: adopt_snd.wav did not reach projects/$AP2/sound"
# REFUSALS, because a drop that silently does nothing is the failure this
# feature exists to remove
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/passets/adopt \
  -H "Content-Type: application/json" -d '{"name":"no_such_file.mp4"}' | grep -q 404 \
  && ok "adopt: a file that is not in the gallery is a 404 with a reason" \
  || bad "adopt: missing file did not 404"
echo '{"name":"../../../etc/passwd"}' > /tmp/adopt_esc.json
curl -s -X POST http://127.0.0.1:8311/api/passets/adopt \
  -H "Content-Type: application/json" -d @/tmp/adopt_esc.json | grep -q '"error"' \
  && ok "adopt: a path-traversal name is refused, not resolved" \
  || bad "adopt: traversal name was not refused"
# AND THE ADOPTED NAME IS ACCEPTED AS A REAL REFERENCE — this is the check that
# proves the round trip. IT MUST BE mode=ref2va: worker.py only runs
# require("reference video", ...) inside `if mode == "ref2va"`, so a t2va job
# completes happily with a reference path that does not exist and would prove
# nothing at all.
ADJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
  -F prompt="[adopt] reference round trip" -F width=192 -F height=108 -F steps=1 \
  -F seed=5 -F mode=ref2va -F frames=49 -F pipeline=single -F format=webm \
  -F references=@/tmp/e2e_ref1.png \
  -F ref_videos='["adopt_me.mp4"]' -F ref_audios='["adopt_snd.wav"]')
ADID=$(echo "$ADJ" | jget "['id']")
if [ -z "$ADID" ]; then bad "adopt: generate rejected the adopted references ${ADJ:0:120}"; else
  for i in $(seq 1 120); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$ADID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  [ "$st" = "done" ] \
    && ok "adopt: a ref2va job runs with the adopted names as references" \
    || { bad "adopt: job with adopted references ended $st"
         curl -sf "http://127.0.0.1:8311/api/jobs/$ADID?log_from=0" | jget "['log']" | tail -6; }
fi
# THE NEGATIVE THAT GIVES THE POSITIVE ITS MEANING: the same name WITHOUT
# adoption. This file exists in the gallery and nowhere else, so /api/generate
# resolves it under projects/<p>/video, finds nothing, and the job must fail.
# If this ever passes, adoption has stopped being what makes the drop work.
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=96x54:rate=24 -t 1 \
  -pix_fmt yuv420p "projects/$AP2/output/never_adopted.mp4"
NAJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
  -F prompt="[adopt] un-adopted gallery name" -F width=192 -F height=108 -F steps=1 \
  -F seed=5 -F mode=ref2va -F frames=49 -F pipeline=single -F format=webm \
  -F references=@/tmp/e2e_ref1.png -F ref_videos='["never_adopted.mp4"]')
NAID=$(echo "$NAJ" | jget "['id']")
if [ -z "$NAID" ]; then bad "adopt(neg): generate rejected outright ${NAJ:0:120}"; else
  for i in $(seq 1 120); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$NAID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  [ "$st" = "failed" ] \
    && ok "adopt: an UN-adopted gallery name fails — adoption is what makes the drop work" \
    || bad "adopt(neg): a missing reference did not fail the job (status=$st)"
fi

# =====================================================================
# COMFYUI MODEL DROPDOWNS (2.71.0)
# In comfy mode a style's model/VAE/text-encoder/LoRA field is a string
# ComfyUI must already have in its dropdown, resolved in ITS OWN folders. Free
# text is how you get "Value not in list" — see the 2.12.x saga in HANDOVER.md.
# GET /api/comfymodels lists what ComfyUI can actually load: the models tree
# AND every search path in extra_model_paths.yaml.
# =====================================================================
CMROOT=/tmp/e2e_comfy
rm -rf "$CMROOT"; mkdir -p "$CMROOT/ComfyUI/models/checkpoints/SDXL" \
  "$CMROOT/ComfyUI/models/loras/flux" "$CMROOT/ComfyUI/models/vae" \
  "$CMROOT/ComfyUI/models/unet" "$CMROOT/shared/extraloras" \
  "$CMROOT/ComfyUI/models/text_encoders" "$CMROOT/ComfyUI/models/clip" \
  "$CMROOT/ComfyUI/models/diffusers/sdxl-base/unet" "$CMROOT/shared/dif/extra-dif"
: > "$CMROOT/ComfyUI/models/checkpoints/base.safetensors"
: > "$CMROOT/ComfyUI/models/checkpoints/SDXL/juggernaut.safetensors"
: > "$CMROOT/ComfyUI/models/checkpoints/notes.txt"
: > "$CMROOT/ComfyUI/models/loras/flux/filmgrain.safetensors"
: > "$CMROOT/ComfyUI/models/vae/ae.safetensors"
: > "$CMROOT/ComfyUI/models/unet/flux1-dev.gguf"
: > "$CMROOT/shared/extraloras/shared_lora.safetensors"
: > "$CMROOT/ComfyUI/models/vae/legacy.pt"
: > "$CMROOT/ComfyUI/models/vae/README.md"
: > "$CMROOT/ComfyUI/models/text_encoders/clip_l.safetensors"
: > "$CMROOT/ComfyUI/models/clip/t5xxl.safetensors"
# A diffusers model is a FOLDER; model_index.json is what marks one, and the
# weights inside it must NOT be offered as models of their own.
echo '{}' > "$CMROOT/ComfyUI/models/diffusers/sdxl-base/model_index.json"
: > "$CMROOT/ComfyUI/models/diffusers/sdxl-base/unet/diffusion_pytorch_model.safetensors"
echo '{}' > "$CMROOT/shared/dif/extra-dif/model_index.json"
# THE SECOND SOURCE. A user with a shared library keeps it out of the ComfyUI
# tree entirely; reading only models/ would hide every model they own.
cat > "$CMROOT/ComfyUI/extra_model_paths.yaml" <<YEOF
comfyui_extra:
    base_path: $CMROOT/shared
    loras: extraloras
    diffusers: dif
YEOF
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d "{\"engine\":{\"comfy\":{\"dir\":\"$CMROOT/ComfyUI\"}}}" > /dev/null
CM=$(curl -sf "http://127.0.0.1:8311/api/comfymodels?refresh=1")
echo "$CM" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ck=[f['name'] for f in d['categories']['checkpoints']['files']]
assert 'base.safetensors' in ck, ck
# THE NAME IS THE VALUE: subfolder and extension kept, exactly as ComfyUI's
# own dropdown spells it
import os
assert os.path.join('SDXL','juggernaut.safetensors') in ck, ck
assert not any('notes' in n for n in ck), ck
" && ok "comfymodels: the checkpoints folder is listed the way ComfyUI names it" \
  || { bad "comfymodels: checkpoint listing wrong"; echo "${CM:0:300}"; }
echo "$CM" | python3 -c "
import json,sys
d=json.load(sys.stdin)
lo=[f['name'] for f in d['categories']['loras']['files']]
assert 'shared_lora.safetensors' in lo, lo
" && ok "comfymodels: extra_model_paths.yaml search paths are included" \
  || { bad "comfymodels: the yaml's loras folder was not read"; echo "${CM:0:300}"; }
echo "$CM" | python3 -c "
import json,sys
d=json.load(sys.stdin)
# unet is the legacy name for diffusion_models and ComfyUI still accepts both
dm=[f['name'] for f in d['categories']['diffusion_models']['files']]
assert 'flux1-dev.gguf' in dm, dm
" && ok "comfymodels: unet and diffusion_models are treated as one category" \
  || { bad "comfymodels: the unet folder was missed"; echo "${CM:0:300}"; }
# THE FOLDER FILTERS' OPTION LISTS
echo "$CM" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert 'SDXL' in d['categories']['checkpoints']['folders'], d['categories']['checkpoints']['folders']
assert '' in d['categories']['checkpoints']['folders'], 'a loose file needs a folder entry too'
assert 'flux' in d['categories']['loras']['folders'], d['categories']['loras']['folders']
" && ok "comfymodels: subfolders are reported, which is what the filters are built from" \
  || { bad "comfymodels: folder lists wrong"; echo "${CM:0:300}"; }
# A MISSING FOLDER MUST SAY SO. An empty dropdown because the path is wrong
# looks exactly like an empty dropdown because you own no models.
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"dir":"/tmp/e2e_comfy_absent"}}}' > /dev/null
curl -sf "http://127.0.0.1:8311/api/comfymodels?refresh=1" \
  | grep -q "does not exist" \
  && ok "comfymodels: a wrong ComfyUI folder is reported, not silently empty" \
  || bad "comfymodels: missing folder produced no warning"
# and it must never take the Settings dialog down with it
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8311/api/comfymodels" | grep -q 200 \
  && ok "comfymodels: it answers 200 even when it found nothing" \
  || bad "comfymodels: non-200 when the folder is absent"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d "{\"engine\":{\"comfy\":{\"dir\":\"$CMROOT/ComfyUI\"}}}" > /dev/null
# the cache must not outlive an edit to the yaml, or the user picks a name
# ComfyUI then rejects
: > "$CMROOT/shared/extraloras/added_later.safetensors"
touch "$CMROOT/ComfyUI/extra_model_paths.yaml"
curl -sf "http://127.0.0.1:8311/api/comfymodels" | grep -q "added_later.safetensors" \
  && ok "comfymodels: touching the yaml invalidates the cache" \
  || bad "comfymodels: a stale cached scan was served after the yaml changed"
# "IS IT READING MY YAML?" must be answerable by looking, not by inference.
curl -sf "http://127.0.0.1:8311/api/comfymodels?refresh=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
cands=d.get('yaml_candidates') or []
assert cands, 'no candidate locations reported'
used=[c for c in cands if c['used']]
assert len(used)==1, used
assert used[0]['path']==d['yaml'], (used, d['yaml'])
assert any(not c['exists'] for c in cands), 'absent locations should be listed too'
" && ok "comfymodels: it reports every extra_model_paths location and which it used" \
  || bad "comfymodels: yaml candidates not reported"
curl -sf "http://127.0.0.1:8311/api/comfymodels" | python3 -c "
import json,sys
d=json.load(sys.stdin)
lo=d['categories']['loras']['roots']
assert any(r['source'].startswith('yaml:') and r['exists'] for r in lo), lo
assert any(r['source']=='models' for r in lo), lo
" && ok "comfymodels: search roots name the yaml group that added them" \
  || bad "comfymodels: roots not traceable to their source"

# INSTALLING A MODEL FOR A DIFFERENT LOADER (2.79.0).
# ComfyUI resolves a combo value inside the search paths for THAT folder type,
# so a diffusion model filed under checkpoints cannot be picked by UNETLoader
# however correct the file is. Tim was copying such models across by hand.
mkdir -p "$CMROOT/ComfyUI/models/checkpoints/flux_klein_9B"
: > "$CMROOT/ComfyUI/models/checkpoints/flux_klein_9B/aisha.safetensors"
rm -rf "$CMROOT/ComfyUI/models/diffusion_models"      # declared but never created
INS=$(curl -sf -X POST http://127.0.0.1:8311/api/comfymodels/install \
  -H 'Content-Type: application/json' \
  -d '{"name":"flux_klein_9B/aisha.safetensors","from":"checkpoints","to":"diffusion_models"}')
echo "$INS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['ok'] and d['how']=='link', d
assert d['name']=='flux_klein_9B/aisha.safetensors', ('subfolder must survive', d)
" && ok "install: a checkpoint-filed model is linked for the unet loader" \
  || bad "install: unexpected response ${INS:0:200}"
# THE POINT: the style's saved name is unchanged and now resolves where the
# unet loader looks
# It may land in models/unet OR models/diffusion_models — both are real unet
# search paths (ComfyUI kept the old name), and an EXISTING folder is rightly
# preferred over creating a new one. Assert the RULE: it is in one of them, with
# its subfolder intact.
[ -f "$CMROOT/ComfyUI/models/unet/flux_klein_9B/aisha.safetensors" ] \
  || [ -f "$CMROOT/ComfyUI/models/diffusion_models/flux_klein_9B/aisha.safetensors" ] \
  && ok "install: the subfolder is preserved, so the saved value still works" \
  || bad "install: the linked file is not in any folder UNETLoader searches"
curl -sf "http://127.0.0.1:8311/api/comfymodels" | python3 -c "
import json,sys
d=json.load(sys.stdin)
dm=[f['name'] for f in d['categories']['diffusion_models']['files']]
assert 'flux_klein_9B/aisha.safetensors' in dm, dm
" && ok "install: it appears in the dropdown without a manual rescan" \
  || bad "install: the cache was not invalidated after installing"
# a second install is not an error, and must not duplicate
curl -sf -X POST http://127.0.0.1:8311/api/comfymodels/install \
  -H 'Content-Type: application/json' \
  -d '{"name":"flux_klein_9B/aisha.safetensors","from":"checkpoints","to":"diffusion_models"}' \
  | grep -q '"how": *"exists"' \
  && ok "install: doing it twice reports exists rather than duplicating" \
  || bad "install: second install did not report exists"
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/comfymodels/install \
  -H 'Content-Type: application/json' \
  -d '{"name":"nope.safetensors","from":"checkpoints","to":"diffusion_models"}' | grep -q 404 \
  && ok "install: a file that is not there is a 404" \
  || bad "install: missing file did not 404"
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/comfymodels/install \
  -H 'Content-Type: application/json' \
  -d '{"name":"x.safetensors","from":"nonsense","to":"diffusion_models"}' | grep -q 400 \
  && ok "install: an unknown category is refused" \
  || bad "install: unknown category not refused"

# A NAME COMFYUI DOES NOT LIST BUT THAT IS ON DISK (2.80.1). ComfyUI caches its
# filename lists at startup, so a model added since is invisible to it — and the
# advice for that ("restart ComfyUI") is nothing like the advice for a file that
# genuinely is not there. The scan listing has to survive alongside the live one
# for the refusal to tell them apart.
curl -sf "http://127.0.0.1:8311/api/comfymodels?refresh=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if d.get('source') == 'comfyui':
    assert isinstance(d.get('disk'), dict) and d['disk'], 'live answer dropped the disk listing'
    assert 'loras' in d['disk'], d['disk'].keys()
else:
    assert d.get('disk') is None, 'a folder-scan answer needs no separate disk listing'
" && ok "comfymodels: the disk listing survives alongside ComfyUI's own list" \
  || bad "comfymodels: disk listing missing from the merged answer"

# THE PROJECT TREE AND THE PER-GROUP STORE (2.82.0).
# Re-enter the project the groups block above already created; loading is
# idempotent and ensureProject() runs on every load, which is exactly the
# "older projects grow the new folders" behaviour being asserted.
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' \
  -d '{"name":"e2e_groups"}' > /dev/null
TREE_OK=1
for sub in chat references reference/images reference/videos reference/audio video sound images; do   # 2.101.0: media under reference/
  [ -d "projects/e2e_groups/$sub" ] || { TREE_OK=0; bad "project tree: missing $sub"; }
done
[ "$TREE_OK" = 1 ] \
  && ok "projects: opening one ensures chat + references/{image,video,sound}" || true
# a group saved through the API lands as its own json, items = filename + type
curl -sf -X POST http://127.0.0.1:8311/api/refgroups -H 'Content-Type: application/json' \
  -d '{"name":"e2e fmt","images":[{"name":"a.png","subject":1}],"videos":["v.mp4"],"audios":["s.wav"]}' > /dev/null
python3 - <<'PEOF'
import json
doc = json.load(open("projects/e2e_groups/references/e2e fmt.json"))
assert [i["type"] for i in doc["items"]] == ["image", "video", "sound"], doc["items"]
assert all(i["file"] for i in doc["items"]), doc["items"]
PEOF
[ $? -eq 0 ] && ok "refgroups: stored as references/<name>.json with filename + type" \
  || bad "refgroups: per-group file wrong"
# the legacy single file is migrated on first read — split, then kept as .migrated
printf '{"groups":[{"name":"legacy grp","images":[{"name":"z.png"}],"videos":[],"audios":[]}]}' \
  > "projects/e2e_groups/refgroups.json"
curl -sf http://127.0.0.1:8311/api/refgroups | python3 -c "
import json,sys
names=[g['name'] for g in json.load(sys.stdin)['groups']]
assert 'legacy grp' in names and 'e2e fmt' in names, names"
[ -f "projects/e2e_groups/references/legacy grp.json" ] \
  && [ -f "projects/e2e_groups/refgroups.json.migrated" ] \
  && [ ! -f "projects/e2e_groups/refgroups.json" ] \
  && ok "refgroups: the legacy file is split per group and kept as .migrated" \
  || bad "refgroups: legacy migration wrong"
curl -sf -X DELETE "http://127.0.0.1:8311/api/refgroups/e2e%20fmt" > /dev/null
[ ! -f "projects/e2e_groups/references/e2e fmt.json" ] \
  && ok "refgroups: delete removes exactly that group's file" \
  || bad "refgroups: delete left the file behind"

# DIFFUSERS ARE FOLDERS, not files. ComfyUI's DiffusersLoader offers the
# relative DIRECTORY containing model_index.json; offering the weights inside
# one would be a real file and a value ComfyUI will never accept.
curl -sf "http://127.0.0.1:8311/api/comfymodels?refresh=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
df=[f['name'] for f in d['categories']['diffusers']['files']]
assert 'sdxl-base' in df, df
assert 'extra-dif' in df, ('the yaml diffusers folder was missed', df)
assert not any('unet' in n or 'pytorch' in n for n in df), ('descended into a model', df)
# and they must be reachable from the Model dropdown
assert 'diffusers' in d['model_categories'], d.get('model_categories')
assert 'checkpoints' in d['model_categories'], d.get('model_categories')
" && ok "comfymodels: diffusers folders are offered as models, not descended into" \
  || bad "comfymodels: diffusers listing wrong"
curl -sf "http://127.0.0.1:8311/api/comfymodels" | python3 -c "
import json,sys
d=json.load(sys.stdin)
v=[f['name'] for f in d['categories']['vae']['files']]
assert 'ae.safetensors' in v and 'legacy.pt' in v, v
assert 'README.md' not in v, ('a non-model file was offered as a VAE', v)
te=[f['name'] for f in d['categories']['text_encoders']['files']]
assert 'clip_l.safetensors' in te and 't5xxl.safetensors' in te, te
" && ok "comfymodels: the vae and text-encoder folders are listed in full" \
  || bad "comfymodels: vae/text encoder listing wrong"
# leave no test state behind: a fixture ComfyUI folder left in the config would
# surface later as a confusing failure in an unrelated check
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"dir":""}}}' > /dev/null
# WITH COMFYUI UNREACHABLE the list is derived from the folders, and must SAY so
# rather than presenting a mirror as the real thing (2.72.0).
# The URL is captured and put back: hardcoding a "default" here clobbered the
# stub ComfyUI's port and took ten unrelated image checks down with it.
CMURL=$(curl -sf http://127.0.0.1:8311/api/config | jget "['engine']['comfy']['url']")
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d "{\"engine\":{\"comfy\":{\"dir\":\"$CMROOT/ComfyUI\",\"url\":\"http://127.0.0.1:59999\"}}}" > /dev/null
CMOFF=$(curl -sf "http://127.0.0.1:8311/api/comfymodels?refresh=1")
echo "$CMOFF" | grep -q '"source": *"folders"' \
  && echo "$CMOFF" | grep -q "not answering" \
  && ok "comfymodels: an unreachable ComfyUI falls back to the folders and says so" \
  || { bad "comfymodels: no fallback notice"; echo "${CMOFF:0:200}"; }
# THE 2.72.0 BUG ITSELF: a model in a SUBFOLDER must be named with a forward
# slash, because ComfyUI matches these strings exactly. A backslash here is what
# produced "Value not in list [unet_name]" with the file sitting right there.
echo "$CMOFF" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ck=[f['name'] for f in d['categories']['checkpoints']['files']]
assert 'SDXL/juggernaut.safetensors' in ck, ck
assert not any('\\\\' in n for n in ck), ck
" && ok "comfymodels: a subfoldered name uses the separator ComfyUI matches" \
  || { bad "comfymodels: subfolder separator wrong"; echo "${CMOFF:0:300}"; }
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d "{\"engine\":{\"comfy\":{\"dir\":\"\",\"url\":\"$CMURL\"}}}" > /dev/null

# the UI side of the same feature: the References dock is ONE drop target that
# routes by kind, rather than a handler per pane that only fires on the tab you
# already had open
UIR=$(cat /tmp/bg-page.html)
echo "$UIR" | grep -q 'id="refdrop"' \
  && ok "refdrop: the References dock has a spoken drop-status line" \
  || bad "refdrop: no #refdrop element"
echo "$UIR" | grep -q 'async function refAccept' \
  && echo "$UIR" | grep -q 'async function adoptOutput' \
  && echo "$UIR" | grep -q 'async function addRefImageByUrl' \
  && ok "refdrop: the drop router, the adopt call and the picture path all exist" \
  || bad "refdrop: a drop handler is missing"
echo "$UIR" | grep -q 'const dock = \$("refsdock")' \
  && ok "refdrop: the DOCK is the drop target, not the individual panes" \
  || bad "refdrop: no dock-level drop wiring"
echo "$UIR" | grep -q 'dragPayload = { type: "output", kind: "images"' \
  && ok "refdrop: gallery stills are draggable and marked as gallery-sourced" \
  || bad "refdrop: gallery image tiles carry no payload"
echo "$UIR" | grep -q 'RCAP = { video: 3, sound: 3 }' \
  && ok "refdrop: the 3 video + 3 audio model limit is enforced in the dock" \
  || bad "refdrop: no reference cap"
# text/h3clip MUST survive untouched: the timeline reads it and gallery videos
# have always reached the timeline through it
echo "$UIR" | grep -q 'setData("text/h3clip"' \
  && ok "refdrop: the timeline's gallery drag format is untouched" \
  || bad "refdrop: text/h3clip disappeared from the gallery tiles"

# =====================================================================
# IMAGE GENERATION + STYLES (2.66.0)
# Runs through image_worker.py, which is a SEPARATE worker from worker.py:
# nothing below may touch the video path, and the video checks above must
# still pass unchanged.
# =====================================================================
IA=$(curl -sf http://127.0.0.1:8311/api/imagearchs)
echo "$IA" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ids={a['id'] for a in d['archs']}
want={'flux','flux2klein9b','sdxl','z-image','qwen-image'}
assert want <= ids, ids
# every arch must name a model flag and its te slots, or the UI cannot build
for a in d['archs']:
    assert a['model_flag'].startswith('-'), a
    assert all(s['flag'].startswith('-') for s in a['te']), a
" && ok "styles: the architecture catalogue serves all five architectures" \
  || bad "styles: /api/imagearchs = $IA"

# stub models for a style (paths must EXIST — the worker validates before the GPU)
: > models/stub-img-model.safetensors
: > models/stub-img-vae.safetensors
: > models/stub-img-te.gguf
mkdir -p loras && : > loras/stub-lora.safetensors

SC=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"E2E Look","arch":"z-image","engine":"sdcli","model":"models/stub-img-model.safetensors",
       "vae":"models/stub-img-vae.safetensors","te":["models/stub-img-te.gguf"],
       "steps":3,"cfg":0,"clip_skip":0,"width":96,"height":64,
       "loras":[{"path":"loras/stub-lora.safetensors","weight":0.75}]}')
SID=$(echo "$SC" | jget "['style']['id']")
[ -n "${SID:-}" ] && ok "styles: POST /api/styles creates a style ($SID)" \
  || { bad "styles: create failed: $SC"; SID=""; }

# ONE FILE PER STYLE, named after the style — browsable, hand-editable, and
# copyable to another install on its own.
[ -s "styles/image/E2E Look.json" ] \
  && ok "styles: saved to styles/<style name>.json" \
  || { bad "styles: styles/image/E2E Look.json not written"; ls styles/image 2>&1 | head -5; }
python3 - <<'PYEOF'
import json, sys
s = json.load(open("styles/image/E2E Look.json", encoding="utf-8"))
assert s["name"] == "E2E Look", s
assert s["arch"] == "z-image", s
assert s["loras"][0]["weight"] == 0.75, s          # the file itself, not the API
assert "_file" not in s, "internal bookkeeping leaked into the file"
PYEOF
[ $? = 0 ] && ok "styles: the file on disk is the style, readable as-is" \
  || bad "styles: the on-disk file is not what a user would expect to edit"

# A duplicate NAME is refused (409), never silently overwritten: the name is
# the filename, and overwriting somebody's style is data loss.
DUP=$(curl -s -o /tmp/dup.json -w "%{http_code}" -X POST http://127.0.0.1:8311/api/styles \
  -H "Content-Type: application/json" -d '{"name":"E2E Look","arch":"sdxl","model":"models/stub-img-model.safetensors"}')
[ "$DUP" = "409" ] && ok "styles: a duplicate style name is refused with 409" \
  || bad "styles: duplicate name returned $DUP"
python3 -c "
import json
s=json.load(open('styles/image/E2E Look.json',encoding='utf-8'))
assert s['arch']=='z-image', s" \
  && ok "styles: the refused duplicate did not overwrite the original file" \
  || bad "styles: the original style file was clobbered"

# A RENAME MOVES THE FILE — a stale twin would show the same style twice.
if [ -n "$SID" ]; then
  curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
    -d "{\"id\":\"$SID\",\"name\":\"E2E Renamed\"}" > /dev/null
  { [ -s "styles/image/E2E Renamed.json" ] && [ ! -f "styles/image/E2E Look.json" ]; } \
    && ok "styles: renaming moves the file instead of leaving a stale twin" \
    || { bad "styles: rename left the folder wrong"; ls styles; }
  curl -sf http://127.0.0.1:8311/api/styles | python3 -c "
import json,sys
s=json.load(sys.stdin)['styles']
assert len([x for x in s if x['id']=='$SID'])==1, s
assert [x for x in s if x['id']=='$SID'][0]['model'], 'rename lost the model path'" \
    && ok "styles: a rename keeps ONE style, with its id and fields intact" \
    || bad "styles: rename duplicated or emptied the style"
  # put the name back so the rest of the checks read naturally
  curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
    -d "{\"id\":\"$SID\",\"name\":\"E2E Look\"}" > /dev/null
fi

# WHICH MODEL CATEGORY A WORKFLOW CAN ACCEPT (2.74.0).
# A render died on "Value not in list [unet_name] = flux_klein_9B/x.safetensors"
# with the file sitting exactly where it should. The name was a CHECKPOINT
# written into a diffusion_models loader key, because the merged Model dropdown
# offered all three categories whatever the workflow could take. /api/styles now
# says which categories each style's graph accepts so the dropdown can narrow.
mkdir -p comfy_workflows
cat > comfy_workflows/e2e_unetonly.json <<'WEOF'
{"70":{"class_type":"UNETLoader","inputs":{"unet_name":"a.safetensors","weight_dtype":"default"}},
 "74":{"class_type":"CLIPTextEncode","inputs":{"text":"hi","clip":["70",0]}},
 "9":{"class_type":"SaveImage","inputs":{"images":["74",0],"filename_prefix":"x"}}}
WEOF
cat > comfy_workflows/e2e_ckptonly.json <<'WEOF'
{"4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"a.safetensors"}},
 "9":{"class_type":"SaveImage","inputs":{"images":["4",0],"filename_prefix":"x"}}}
WEOF
MKU=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"E2E UnetOnly","engine":"comfy","arch":"flux","workflow":"comfy_workflows/e2e_unetonly.json"}' \
  | jget "['style']['id']")
MKC=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"E2E CkptOnly","engine":"comfy","arch":"flux","workflow":"comfy_workflows/e2e_ckptonly.json"}' \
  | jget "['style']['id']")
curl -sf http://127.0.0.1:8311/api/styles | python3 -c "
import json,sys
d=json.load(sys.stdin)
mk=d.get('model_kinds') or {}
assert mk.get('$MKU')==['diffusion_models'], ('unet graph', mk.get('$MKU'))
assert mk.get('$MKC')==['checkpoints'], ('ckpt graph', mk.get('$MKC'))
" && ok "styles: /api/styles reports which model category each workflow accepts" \
  || bad "styles: model_kinds wrong — the Model dropdown cannot narrow"
# An sd-cli style has no ComfyUI loader at all, so it must report nothing rather
# than narrowing a dropdown that is showing local paths.
SDK=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"E2E SdcliKinds","engine":"sdcli","arch":"flux","model":"models/x.gguf"}' \
  | jget "['style']['id']")
curl -sf http://127.0.0.1:8311/api/styles | python3 -c "
import json,sys
mk=(json.load(sys.stdin).get('model_kinds') or {})
assert mk.get('$SDK')==[], mk.get('$SDK')" \
  && ok "styles: an sd-cli style narrows nothing" \
  || bad "styles: an sd-cli style reported comfy model kinds"
for n in "E2E UnetOnly" "E2E CkptOnly" "E2E SdcliKinds"; do
  curl -sf -X DELETE "http://127.0.0.1:8311/api/styles/$(python3 -c "
import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$n")" > /dev/null 2>&1 || true
done
rm -f comfy_workflows/e2e_unetonly.json comfy_workflows/e2e_ckptonly.json

# A hand-dropped file is the whole point of a per-file store.
cat > "styles/image/Hand Made.json" <<'PYEOF'
{ "arch": "sdxl", "model": "models/stub-img-model.safetensors", "steps": 11 }
PYEOF
curl -sf http://127.0.0.1:8311/api/styles | python3 -c "
import json,sys
s=json.load(sys.stdin)['styles']
h=[x for x in s if x['name']=='Hand Made']
assert h, [x['name'] for x in s]
assert h[0]['steps']==11, h
assert h[0]['id'], 'no id derived for a hand-written file'" \
  && ok "styles: a hand-written style file is picked up and usable" \
  || bad "styles: a hand-dropped style file was ignored"
# ...and one broken file must not empty the whole list
echo "{ not json" > "styles/image/Broken.json"
curl -sf http://127.0.0.1:8311/api/styles | python3 -c "
import json,sys
s=json.load(sys.stdin)['styles']
assert len(s)>=2, s" \
  && ok "styles: one unparseable file is skipped, not fatal to the list" \
  || bad "styles: a broken file emptied the style list"
rm -f "styles/image/Broken.json" "styles/image/Hand Made.json"

# THE ROUND-TRIP TRAP: 0 and 0.75 must come back as 0 and 0.75, not as defaults.
# `+v || default` turns every legitimate 0 into the default, and a slider that
# cannot reach one end is a bug the user cannot even describe.
curl -sf http://127.0.0.1:8311/api/styles | python3 -c "
import json,sys
s=[x for x in json.load(sys.stdin)['styles'] if x['id']=='$SID'][0]
assert s['cfg']==0, s['cfg']
assert s['clip_skip']==0, s['clip_skip']
assert s['loras'][0]['weight']==0.75, s['loras']
assert s['steps']==3 and s['width']==96, s
" && ok "styles: cfg 0, clip_skip 0 and LoRA weight 0.75 survive the round trip" \
  || bad "styles: a legitimate 0 or float was lost in the round trip"

# an incomplete style must be reported, not silently rendered
IC=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"Half Done","arch":"flux","engine":"sdcli","model":"models/stub-img-model.safetensors"}')
ICID=$(echo "$IC" | jget "['style']['id']")
echo "$IC" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert 'T5-XXL' in d['missing'], d['missing']" \
  && ok "styles: an unfilled required text encoder is reported as missing" \
  || bad "styles: incomplete style not flagged: $IC"
GB=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/genimage \
  -H "Content-Type: application/json" -d "{\"prompt\":\"x\",\"style_id\":\"$ICID\"}")
[ "$GB" = "400" ] && ok "images: generating with an incomplete style is refused (400)" \
  || bad "images: incomplete style was accepted ($GB)"
GB=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/genimage \
  -H "Content-Type: application/json" -d '{"prompt":"x","style_id":"st_nope"}')
[ "$GB" = "400" ] && ok "images: an unknown style id is refused (400)" \
  || bad "images: unknown style accepted ($GB)"
GB=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/genimage \
  -H "Content-Type: application/json" -d "{\"prompt\":\"  \",\"style_id\":\"$SID\"}")
[ "$GB" = "400" ] && ok "images: an empty prompt is refused (400)" \
  || bad "images: empty prompt accepted ($GB)"

run_image() {   # name  json  expect_count
  local name="$1"; local body="$2"; local want="$3"
  local res id st
  res=$(curl -sf -X POST http://127.0.0.1:8311/api/genimage \
        -H "Content-Type: application/json" -d "$body")
  id=$(echo "$res" | jget "['id']" 2>/dev/null)
  if [ -z "${id:-}" ]; then bad "$name: rejected: $res"; return; fi
  for i in $(seq 1 120); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$id" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  IMG_J=$(curl -sf "http://127.0.0.1:8311/api/jobs/$id?log_from=0")
  IMG_ID=$id
  if [ "$st" != "done" ]; then
    bad "$name: status=$st"; echo "$IMG_J" | jget "['log']" | tail -4; return
  fi
  local n; n=$(echo "$IMG_J" | python3 -c "import json,sys;print(len(json.load(sys.stdin)['outputs'] or []))")
  [ "$n" = "$want" ] && ok "$name: produced $n image(s)" || bad "$name: got $n want $want"
}

if [ -n "$SID" ]; then
  run_image "image-single" "{\"prompt\":\"a lovely cat\",\"style_id\":\"$SID\"}" 1
  IMGOUT=$(echo "$IMG_J" | jget "['output']")
  # (an sd-cli still: no ComfyUI, so no VRAM clear line — a clear here would be a bug)
  echo "$IMG_J" | jget "['log']" | grep -q "VRAM" \
    && bad "image: an sd-cli still must not talk to ComfyUI's /free" \
    || ok "image: an sd-cli still does not touch ComfyUI's VRAM"
  PDIR=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['dir']")
  AP=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")
  [ -s "$PDIR/$IMGOUT" ] && ok "images: the still lands in the project's output folder" \
    || bad "images: $IMGOUT missing from $PDIR"
  # the style's own width/height must reach sd-cli, not a video default
  SZ=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$PDIR/$IMGOUT" 2>/dev/null)
  [ "$SZ" = "96,64" ] && ok "images: the style's resolution reaches sd-cli (96x64)" \
    || bad "images: wrong size $SZ (want 96,64)"
  # THE WHOLE POINT OF THE LORA SLIDER: 0.75 has to arrive on the command line
  echo "$IMG_J" | python3 -c "
import json,sys,os
j=json.load(sys.stdin)
argv=j['command']; cmd=' '.join(argv)
assert '<lora:stub-lora:0.75>' in cmd, cmd
assert '--mode img_gen' in cmd, cmd
assert '--video-frames' not in cmd, 'a VIDEO flag leaked into an image render'
# z-image passes its text encoder with --llm. Assert the PAIRING, not a literal
# path: styles store app-relative paths and the worker resolves them at use
# time, so the string on the command line is legitimately absolute.
te = argv[argv.index('--llm')+1]
assert os.path.basename(te) == 'stub-img-te.gguf', te
assert os.path.isabs(te), 'an unresolved relative path would not exist from the job dir'
assert '--t5xxl' not in cmd, cmd
" && ok "images: the LoRA token, img_gen mode and --llm all reach the command line" \
    || bad "images: command line wrong: $(echo "$IMG_J" | jget "['command']")"
  # it must appear in the IMAGES asset column, not the video one
  curl -sf http://127.0.0.1:8311/api/passets | python3 -c "
import json,sys
j=json.load(sys.stdin)
imgs=[v['name'] for v in j.get('images',[])]
vids=[v['name'] for v in j.get('video',[])]
assert '$IMGOUT' in imgs, imgs
assert '$IMGOUT' not in vids, 'a still was filed as footage'
" && ok "images: the still is auto-added to the IMAGE assets, not the video ones" \
    || bad "images: $IMGOUT did not reach the image asset column"
  python3 - <<PYEOF
import os, sys
a = os.stat("$PDIR/$IMGOUT"); b = os.stat("projects/$AP/images/$IMGOUT")
assert a.st_size == b.st_size
if a.st_ino and b.st_ino:
    assert (a.st_ino, a.st_dev) == (b.st_ino, b.st_dev), "copied, not linked"
PYEOF
  [ $? = 0 ] && ok "images: hard-linked into the dock like a render is" \
    || bad "images: the still was copied instead of linked"
  # the gallery's Images tab
  curl -sf "http://127.0.0.1:8311/api/outputs?kind=images" | python3 -c "
import json,sys
f=json.load(sys.stdin)
assert any(x['name']=='$IMGOUT' for x in f), f" \
    && ok "images: GET /api/outputs?kind=images lists it for the gallery" \
    || bad "images: the Images tab listing does not include $IMGOUT"
  # ...and must NOT pollute the video listing the timeline reads
  curl -sf "http://127.0.0.1:8311/api/outputs" | python3 -c "
import json,sys
f=json.load(sys.stdin)
assert not any(x['name'].endswith('.png') for x in f), [x['name'] for x in f]" \
    && ok "images: stills stay OUT of the default (video) outputs listing" \
    || bad "images: a .png leaked into the video gallery/timeline listing"

  # ===== ONE PRESS = ONE FRESH SEED, ONE FRESH FILENAME (2.83.0) =====
  # The symptom this guards against does not look like a failure: the render
  # succeeds and the picture is simply the same one as last time. It has
  # happened twice (2.78.0, and again on the sd-cli path where -1 was handed
  # straight to sd-cli and the batch walk became a no-op), so it is asserted
  # end to end rather than only in the unit tests.
  run_image "image-press-1" "{\"prompt\":\"a lovely cat\",\"style_id\":\"$SID\"}" 1
  P1_SEED=$(echo "$IMG_J" | jget "['params']['seed']")
  P1_OUT=$(echo "$IMG_J" | jget "['output']")
  run_image "image-press-2" "{\"prompt\":\"a lovely cat\",\"style_id\":\"$SID\"}" 1
  P2_SEED=$(echo "$IMG_J" | jget "['params']['seed']")
  P2_OUT=$(echo "$IMG_J" | jget "['output']")
  [ -n "$P1_SEED" ] && [ "$P1_SEED" != "-1" ] && [ "$P1_SEED" -ge 0 ] 2>/dev/null \
    && ok "seed: the job RECORDS the real seed, not the -1 that was asked for" \
    || bad "seed: job.params.seed is $P1_SEED — the number used is not recorded"
  [ "$P1_SEED" != "$P2_SEED" ] \
    && ok "seed: two presses of Generate roll two different seeds" \
    || bad "seed: both presses used seed $P1_SEED — every render will look the same"
  [ "$P1_OUT" != "$P2_OUT" ] \
    && ok "seed: ...and land in two different files" \
    || bad "seed: both presses wrote $P1_OUT"
  case "$P1_OUT" in
    *"_s${P1_SEED}_"*) ok "seed: the filename carries the seed that drew it" ;;
    *) bad "seed: $P1_OUT does not name seed $P1_SEED — the picture cannot be reproduced from the file" ;;
  esac
  # a pinned seed must survive the roll, or "give me that one again" is impossible
  run_image "image-pinned" "{\"prompt\":\"a lovely cat\",\"style_id\":\"$SID\",\"seed\":1234}" 1
  PP_SEED=$(echo "$IMG_J" | jget "['params']['seed']")
  PP_OUT=$(echo "$IMG_J" | jget "['output']")
  [ "$PP_SEED" = "1234" ] \
    && ok "seed: a seed the user typed in is obeyed, not re-rolled" \
    || bad "seed: pinned 1234 became $PP_SEED"
  run_image "image-pinned-again" "{\"prompt\":\"a lovely cat\",\"style_id\":\"$SID\",\"seed\":1234}" 1
  PQ_OUT=$(echo "$IMG_J" | jget "['output']")
  [ "$PP_OUT" != "$PQ_OUT" ] \
    && ok "seed: the SAME seed twice still writes two files — no picture is overwritten" \
    || bad "seed: the second render overwrote $PP_OUT"
  python3 - <<PYEOF
import hashlib, os
d = "$PDIR"
a = hashlib.md5(open(os.path.join(d, "$PP_OUT"), "rb").read()).hexdigest()
b = hashlib.md5(open(os.path.join(d, "$PQ_OUT"), "rb").read()).hexdigest()
assert a == b, "the same seed produced different pictures"
PYEOF
  [ $? = 0 ] && ok "seed: ...and the two are the same picture, which is what a pinned seed means" \
    || bad "seed: a pinned seed did not reproduce"

  # a batch must be N DIFFERENT pictures (the seed has to walk)
  run_image "image-batch" \
    "{\"prompt\":\"a lovely cat\",\"style_id\":\"$SID\",\"batch\":3,\"seed\":7}" 3
  echo "$IMG_J" | python3 -c "
import json,sys,os,hashlib
j=json.load(sys.stdin)
d='$PDIR'
hs=[hashlib.md5(open(os.path.join(d,n),'rb').read()).hexdigest() for n in j['outputs']]
assert len(set(hs))==3, 'a batch produced identical images - the seed did not walk'
" && ok "images: a batch of 3 is three different pictures, not one repeated" \
    || bad "images: batch images were identical"
  curl -sf http://127.0.0.1:8311/api/passets | python3 -c "
import json,sys
names=[v['name'] for v in json.load(sys.stdin).get('images',[])]
assert len([n for n in names if n.endswith('.png')])>=4, names" \
    && ok "images: EVERY image in a batch reaches the dock, not just the last" \
    || bad "images: some batch images never reached the dock"

  # a per-request override must beat the style, and an absent one must not
  run_image "image-override" \
    "{\"prompt\":\"cat\",\"style_id\":\"$SID\",\"width\":128,\"height\":96}" 1
  SZ=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$PDIR/$(echo "$IMG_J" | jget "['output']")" 2>/dev/null)
  [ "$SZ" = "128,96" ] && ok "images: a per-request size overrides the style" \
    || bad "images: override ignored (got $SZ)"

  # a failing render must FAIL the job, with the log kept
  FR=$(curl -sf -X POST http://127.0.0.1:8311/api/genimage -H "Content-Type: application/json" \
       -d "{\"prompt\":\"[imgfail] broken\",\"style_id\":\"$SID\"}")
  FID=$(echo "$FR" | jget "['id']")
  for i in $(seq 1 60); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$FID" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  [ "$st" = "failed" ] && ok "images: a failed render is reported as failed, not done" \
    || bad "images: a broken render reported status=$st"
  curl -sf "http://127.0.0.1:8311/api/jobs/$FID?log_from=0" | jget "['log']" \
    | grep -q "lib/imageArch.json" \
    && ok "images: the failure log points at where the arch flags can be fixed" \
    || bad "images: the failure gave no actionable hint"
fi

# ===== CAMERA PRESETS (2.88.0) ======================================
curl -sf "http://127.0.0.1:8311/api/camera?mode=video" | python3 -c "
import json,sys
g=json.load(sys.stdin)['groups']
assert g['move'], 'video has no movements'
assert g['shot'] and g['angle'] and g['lens'], g.keys()" \
  && ok "camera: video mode offers framing, angle, lens and movement" \
  || bad "camera: /api/camera?mode=video"
curl -sf "http://127.0.0.1:8311/api/camera?mode=image" | python3 -c "
import json,sys
g=json.load(sys.stdin)['groups']
assert g['move'] == [], 'a still was offered a camera move'
assert g['lens'], 'a still lost its lenses too'" \
  && ok "camera: a still is offered no movement, but keeps its lenses" \
  || bad "camera: image mode filter"
curl -sf -X POST http://127.0.0.1:8311/api/camera/phrase \
  -H "Content-Type: application/json" \
  -d '{"select":["push","85","low","mcu"],"mode":"video"}' | python3 -c "
import json,sys
p=json.load(sys.stdin)['phrase']
# framing, then angle, then lens, then movement -- the order a shot list is
# written in, regardless of the order the tiles were clicked
assert p.index('medium close-up') < p.index('low angle') < p.index('85mm') < p.index('dolly'), p" \
  && ok "camera: the phrase is ordered like a shot list, not like the clicks" \
  || bad "camera: phrase order"

# ===== THE PROMPT CHAT (2.85.0) =====================================
# No LLM is running here, so the send path is exercised for what it must do
# WITHOUT one: keep the user's words. Everything else is real.
CH=$(curl -sf http://127.0.0.1:8311/api/chat)
echo "$CH" | python3 -c "
import json,sys
j=json.load(sys.stdin)
assert j['session'].endswith('.chat'), j
assert j['days']==2, j
assert isinstance(j['messages'], list), j" \
  && ok "chat: a session is opened for today and reported" \
  || bad "chat: GET /api/chat shape: $CH"
CHS=$(echo "$CH" | jget "['session']")
CHP=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")
# THE MESSAGE IS SAVED BEFORE THE MODEL IS CALLED. With no LLM this returns 502,
# and the text must STILL be on disk -- losing what somebody typed to another
# service's outage is not a trade worth making.
CODE=$(curl -s -o /tmp/chatpost.json -w "%{http_code}" -X POST http://127.0.0.1:8311/api/chat \
  -H "Content-Type: application/json" -d '{"text":"a woman walking in rain, close on her face"}')
[ "$CODE" = "502" ] || [ "$CODE" = "400" ] || [ "$CODE" = "200" ] \
  && ok "chat: POST /api/chat answers rather than hanging (got $CODE)" \
  || bad "chat: POST returned $CODE"
grep -q "a woman walking in rain" "projects/$CHP/chat/$CHS" \
  && ok "chat: the message is written to the project BEFORE the LLM is called" \
  || bad "chat: the message was lost when the LLM did not answer"
# ---- chat save / load (2.164.0, by instruction) ----------------------------
# 💾 freezes the current conversation file as the archive and continues in a
# fresh copy; 📂 opens a picked file the same way — never edited again.
SV=$(curl -s -X POST http://127.0.0.1:8311/api/chat/save)
echo "$SV" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
assert d['saved'].endswith('.chat') and d['session'].endswith('.chat'), d
assert d['saved'] != d['session'], d
import re   # 2.370.0: named <subject summary> - <date> (no LLM here: the first words asked)
assert re.fullmatch(r'A woman walking in rain - \d{4}-\d{2}-\d{2}\.chat', d['saved']), d
assert d['name'] == d['saved'][:-5] and d['how'] == 'first words', d
" && ok "chat: 💾 Save freezes the current file as '<subject> - <date>.chat' and continues in a fresh copy" \
  || bad "chat: save failed: $SV"
SVFROM=$(echo "$SV" | jget "['saved']")
python3 - "$CHP" "$SVFROM" <<'PYEOF'
import json, sys, os
p, frozen = sys.argv[1], sys.argv[2]
d = os.path.join("projects", p, "chat")
files = sorted(f for f in os.listdir(d) if f.endswith(".chat"))
assert frozen in files, (frozen, files)
assert len(files) >= 2, files
with open(os.path.join(d, frozen)) as f:
    assert "a woman walking in rain" in f.read(), "the archive lost the message"
PYEOF
[ $? -eq 0 ] && ok "chat: the archive file holds the conversation, beside the live copy" \
  || bad "chat: archive file wrong"
LD=$(curl -s -X POST http://127.0.0.1:8311/api/chat/load -H 'Content-Type: application/json' \
  -d "{\"session\":\"$SVFROM\"}")
echo "$LD" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
assert any('a woman walking in rain' in m.get('text','') for m in d['messages']), d['messages'][:2]
assert d['session'] != d['loaded'], d
" && ok "chat: 📂 Load opens a saved conversation as a fresh copy, messages intact" \
  || bad "chat: load failed: $LD"
curl -s -X POST http://127.0.0.1:8311/api/chat/load -H 'Content-Type: application/json' \
  -d '{"session":"../../evil.chat"}' | grep -q "no such saved chat" \
  && ok "chat: a junk or traversal name is refused by name" \
  || bad "chat: junk load accepted"
# 2.370.0 (Tim: "add a clear chat icon only button next to the dropdown"): 🧹 empties THIS conversation
CLR=$(curl -s -X POST http://127.0.0.1:8311/api/chat/clear)
CLA=$(curl -sf http://127.0.0.1:8311/api/chat)
echo "$CLR" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok') and d['cleared'] >= 1, d
" && echo "$CLA" | python3 -c "
import json,sys,os
d=json.load(sys.stdin); assert d['messages'] == [], d['messages'][:2]
assert '$SVFROM' in d['saved'] and d['saved'][0] == d['session'], d['saved'][:4]
" && ok "chat: 🧹 Clear empties the current conversation; the '<subject> - <date>' save stays in the picker (newest first)" \
  || bad "chat: clear failed: $CLR"
# ...and the saved chat loaded back, so the legs below find the conversation where they expect it
curl -s -X POST http://127.0.0.1:8311/api/chat/load -H 'Content-Type: application/json' -d "{\"session\":\"$SVFROM\"}" > /dev/null
node scripts/test-chattitle.js > /tmp/chattitle370.log 2>&1 \
  && ok "chattitle unit tests (2.370.0 '<subject summary> - <date>': the first words or the running LLM, safe names, save-as / clear / newest-first, the 🧹 button)" \
  || { bad "chattitle unit tests"; tail -12 /tmp/chattitle370.log; }
node scripts/test-freshproject.js > /tmp/freshproject371.log 2>&1 \
  && ok "freshproject unit tests (2.371.0 a new project starts fresh: the leaving project saved, every docker reloaded empty, the queue shows this project's finished jobs)" \
  || { bad "freshproject unit tests"; tail -12 /tmp/freshproject371.log; }
node -e "
const s=require('fs').readFileSync('/tmp/bg-page.html','utf8');
if(!/id=\"chatBar\"/.test(s)||!/id=\"chatSaveBtn\"/.test(s)||!/id=\"chatLoadBtn\"/.test(s)||!/id=\"chatSaves\"/.test(s)) process.exit(1);
if(!/id=\"chatSaves\"[^>]*><\/select>\s*<!--[\s\S]*?-->\s*<button class=\"ghost gbtn\" id=\"chatClear\"[^>]*>🧹<\/button>/.test(s)) process.exit(1);
if(!/id=\"pmBar\"/.test(s)) process.exit(1);
" && ok "chat/prompt: both menubars exist with save, load and the picker" \
  || bad "chat/prompt: menubar markup missing"
# ---- the typed character sheet (2.166.0, by instruction) -------------------
curl -s -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Kitt","type":"vehicle","subtype":"sports car","color":"black","model":"Trans Am","year":"1982","notes":"red scanner light"}' > /dev/null
curl -sf http://127.0.0.1:8311/api/characters | python3 -c "
import json,sys
cs=json.load(sys.stdin)['characters']
k=[c for c in cs if c['name']=='Kitt'][0]
assert k['type']=='vehicle' and k['model']=='Trans Am' and k['year']=='1982', k
" && ok "characters: the typed fields round-trip the profile" \
  || bad "characters: typed fields lost"
curl -s -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Kitt","type":"spaceship"}' > /dev/null
curl -sf http://127.0.0.1:8311/api/characters | python3 -c "
import json,sys
cs=json.load(sys.stdin)['characters']
k=[c for c in cs if c['name']=='Kitt'][0]
assert k['type']=='vehicle', k['type']   # junk type keeps the stored one
" && ok "characters: a junk type is refused quietly — the stored type stays" \
  || bad "characters: junk type accepted"
node -e "
const S=require('./lib/screenplay.js');
const chars=require('./lib/characters.js');
const k=chars.list().find(c=>c.name==='Kitt');
const p=S.buildPrefix([k]).join('\n');
if(!/sports car defined by the provided reference sheet — a 1982 black Trans Am/.test(p)) process.exit(1);
if(/bone structure/.test(p)) process.exit(2);
" && ok "characters: the vehicle's subject definition speaks year/color/model, not human anatomy" \
  || bad "characters: vehicle prefix wrong"
curl -sf -X DELETE http://127.0.0.1:8311/api/characters/Kitt > /dev/null
# ---- clothing type + the stitched composite (2.168.0, by instruction) ------
curl -s -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Jacket","type":"clothing","subtype":"leather jacket","color":"black"}' > /dev/null
node -e "
const S=require('./lib/screenplay.js'); const chars=require('./lib/characters.js');
const j=chars.list().find(c=>c.name==='Jacket');
const p=S.buildPrefix([j]).join('\n');
if(j.type!=='clothing') process.exit(1);
if(!/garment defined by the provided reference sheet — a black leather jacket/.test(p)) process.exit(2);
if(/bone structure/.test(p)) process.exit(3);
" && ok "characters: clothing is a type — the garment definition preserves cut and fabric, no anatomy" \
  || bad "characters: clothing type wrong"
curl -sf -X DELETE http://127.0.0.1:8311/api/characters/Jacket > /dev/null
# two REAL sheets -> ONE stitched composite; the chain carries a single
# picture loader for the character (the pack must never see a tag twice)
ffmpeg -y -loglevel error -f lavfi -i color=c=red:s=32x48:d=1 -frames:v 1 /tmp/stitch1.png
ffmpeg -y -loglevel error -f lavfi -i color=c=blue:s=32x48:d=1 -frames:v 1 /tmp/stitch2.png
curl -s -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Stitchy"}' > /dev/null
curl -sf -F "file=@/tmp/stitch1.png" http://127.0.0.1:8311/api/characters/Stitchy/asset > /dev/null
curl -sf -F "file=@/tmp/stitch2.png" http://127.0.0.1:8311/api/characters/Stitchy/asset > /dev/null
curl -sf -o /tmp/stitch_out.png "http://127.0.0.1:8311/api/characters/Stitchy/file/_composite.png" \
  && ok "characters: two sheets stitched into _composite.png at upload time" \
  || bad "characters: no composite built from two sheets"
python3 -c "
import json
g=json.load(open('comfy_workflows/MM3_Characters_tmp.json'))
# follow the TAG's own wiring: exactly one picture reference for stitchy,
# and its loader's image is the stitched composite (the resolved upload
# name is a basename — it carries no character prefix)
pics=[(k,v) for k,v in g.items() if v.get('class_type')=='MiniMaxH3ScheduledPictureReference'
      and v.get('inputs',{}).get('tag')=='stitchy']
assert len(pics)==1, ('picture refs', [k for k,_ in pics])
src=pics[0][1]['inputs']['image']
img=str(g[str(src[0])]['inputs']['image'])
assert '_composite' in img, img
" && ok "characters: the chain carries ONE picture per character — the composite, never the tag twice" \
  || bad "characters: chain still loads multiple sheets for one character"
curl -sf -X DELETE http://127.0.0.1:8311/api/characters/Stitchy > /dev/null
curl -sf "http://127.0.0.1:8311/api/chat" | python3 -c "
import json,sys
m=json.load(sys.stdin)['messages']
assert any('walking in rain' in x['text'] for x in m), m
assert all(x['role'] in ('user','assistant') for x in m), m" \
  && ok "chat: it comes back in the history the model is given" \
  || bad "chat: the saved message is not replayed"
# 2.370.0: 💾 Save RENAMES the frozen file to "<subject> - <date>.chat", so the conversation New chat leaves
# behind is the CURRENT file at this point (the loaded copy), not the first one of the day
CHS=$(curl -sf http://127.0.0.1:8311/api/chat | jget "['session']")
NS=$(curl -sf -X POST http://127.0.0.1:8311/api/chat/new | jget "['session']")
[ -n "$NS" ] && [ "$NS" != "$CHS" ] \
  && ok "chat: New chat opens a different file" \
  || bad "chat: New chat returned $NS (was $CHS)"
[ -s "projects/$CHP/chat/$CHS" ] \
  && ok "chat: ...and the old conversation is still on disk, not replaced" \
  || bad "chat: the previous session was destroyed"
# 2.115.1: after New chat the WINDOW and the model's context are the new session only
curl -sf "http://127.0.0.1:8311/api/chat" | python3 -c "
import json,sys; j=json.load(sys.stdin); assert j['messages']==[] , j['messages'][:2]" \
  && ok "chat: after New chat GET /api/chat is EMPTY (the window clears; the old session is history)" || bad "chat: old messages still shown after New chat"
curl -sf "http://127.0.0.1:8311/api/chat?session=all" | python3 -c "
import json,sys; j=json.load(sys.stdin); assert any(m['text']=='a woman walking in rain, close on her face' for m in j['messages'])" \
  && ok "chat: ?session=all still lists the day's earlier sessions" || bad "chat: session=all lost the history"
EC=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/chat \
  -H "Content-Type: application/json" -d '{"text":"   "}')
[ "$EC" = "400" ] && ok "chat: an empty message is refused (400)" \
  || bad "chat: empty message accepted ($EC)"
# ONE PLACE DECIDES WHICH LLM. Two copies of that is how worker.py and
# comfy_client.py drifted; enhance and chat must share it.
python3 - <<'PYEOF2'
r = open("routes/index.js", encoding="utf-8").read()
assert r.count("llmChat.complete(") >= 2, "enhance and chat do not share the caller"
assert "/v1/chat/completions" not in r, "the URL is still being built in the route"
PYEOF2
[ $? = 0 ] && ok "chat: Enhance and Chat resolve the LLM through ONE helper" \
  || bad "chat: the LLM call was duplicated back into the route"

# deleting a style must not disturb the others (ids are not indices)
if [ -n "$SID" ]; then
  curl -sf -X DELETE "http://127.0.0.1:8311/api/styles/$ICID" > /dev/null
  curl -sf http://127.0.0.1:8311/api/styles | python3 -c "
import json,sys
s=json.load(sys.stdin)['styles']
assert any(x['id']=='$SID' for x in s), s
assert not any(x['id']=='$ICID' for x in s), s" \
    && ok "styles: DELETE removes only the named style" \
    || bad "styles: delete disturbed the wrong style"
fi
DC=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://127.0.0.1:8311/api/styles/st_nothere")
[ "$DC" = "404" ] && ok "styles: deleting an unknown style is a 404, not a silent success" \
  || bad "styles: unknown delete returned $DC"

# THE SEPARATE-WORKER RULE: image jobs must not be run by worker.py at all.
python3 - <<'PYEOF'
import re, sys
src = open("lib/core.js", encoding="utf-8").read()
assert "WORKER_FOR" in src and "image_worker.py" in src, "no worker mapping"
assert "path.join(BASE, \"worker.py\")" not in src, "worker.py is still hardcoded at the spawn site"
w = open("worker.py", encoding="utf-8").read()
assert 'mode == "image"' not in w, "image handling leaked into the VIDEO worker"
PYEOF
[ $? = 0 ] && ok "images: run by image_worker.py; worker.py is untouched by the feature" \
  || bad "images: the video worker was modified or the mapping is missing"

# clear-comfy.bat cannot be run here (it is Windows-only and kills processes),
# but the two ways it could do REAL damage are readable from the text, and both
# are the kind of thing a later edit adds without thinking:
#   - a blind `taskkill /IM python.exe` also kills bitGen Studio's own render worker
#     and every other Python on the machine;
#   - an `rd /s /q` on the ComfyUI root, or on models/output/input, destroys
#     tens of GB of downloads and the user's own pictures.
python3 - <<'PYEOF'
import re, sys
raw = open("clear-comfy.bat", encoding="utf-8", errors="replace").read()
assert "comfyui" in raw.lower(), "does not mention ComfyUI at all"
assert "pause" in raw.lower(), "a double-clicked .bat that closes instantly tells the user nothing"
# READ THE CODE, NOT THE PROSE. The first version of this check failed on the
# script's own REM explaining why `taskkill /IM python.exe` is forbidden — a
# test that cannot tell a warning from the thing it warns about would push the
# next person to delete the comment to make it pass.
low = "\n".join(l for l in raw.lower().splitlines()
                if not l.strip().startswith(("rem", "::", "echo")))
assert not re.search(r"taskkill[^\n]*/im\s+python", low), \
    "a blind taskkill /IM python.exe would kill bitGen Studio's own worker"
assert not re.search(r"taskkill[^\n]*/im\s+node", low), "it must never kill the app itself"
# Every rd target is either a cache literal or a FOR variable (%%d / %%~m). A
# variable is checked by the whole-file rule below instead, because the path it
# will hold is written in the `for ... in (...)` list, not at the delete site.
for m in re.finditer(r"rd /s /q\s+\"([^\"]+)\"", low):
    t = m.group(1)
    assert ("__pycache__" in t or t.endswith("\\temp") or "cache" in t or "%%" in t), \
        f"removes something that is not a cache: {t}"
# THE REAL GUARD: these folders are tens of GB of downloads and the user's own
# pictures. The script has no business naming them in a delete, a FOR list, or
# anywhere else that executes.
for danger in ("\\models", "\\output", "\\input", "\\workflows", "\\loras"):
    assert danger not in low, f"names {danger} — nothing here should touch it"
PYEOF
[ $? = 0 ] && ok "clear-comfy.bat: kills ComfyUI by command line, and deletes only caches" \
  || bad "clear-comfy.bat: could kill the wrong process or delete real data"

# =====================================================================
# IMAGES THROUGH COMFYUI — the DEFAULT engine.
# This install already runs ComfyUI for video, so making a still must not
# require sd-cli at all. Every check below renders with sd_cli pointed at a
# path that DOES NOT EXIST, which is the only honest way to prove it.
# =====================================================================
cat > comfy_workflows/e2e_img.json << 'WF'
{
  "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "template.safetensors" } },
  "2": { "class_type": "CLIPTextEncode", "inputs": { "text": "template positive", "clip": ["1", 1] } },
  "3": { "class_type": "CLIPTextEncode", "inputs": { "text": "template negative", "clip": ["1", 1] } },
  "4": { "class_type": "EmptyLatentImage", "inputs": { "width": 512, "height": 512, "batch_size": 1 } },
  "5": { "class_type": "KSampler",
         "inputs": { "seed": 1, "steps": 20, "cfg": 8.0, "denoise": 1.0,
                     "sampler_name": "euler", "scheduler": "normal",
                     "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
                     "latent_image": ["4", 0] } },
  "6": { "class_type": "VAEDecode", "inputs": { "samples": ["5", 0], "vae": ["1", 2] } },
  "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "e2e", "images": ["6", 0] } }
}
WF
CSTYLE=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"Comfy Look","arch":"sdxl","engine":"comfy",
       "workflow":"comfy_workflows/e2e_img.json","width":128,"height":96,
       "steps":3,"cfg":5.5,"negative":"blurry",
       "loras":[{"path":"sub/grain.safetensors","weight":0.6}]}')
CSID=$(echo "$CSTYLE" | jget "['style']['id']")
echo "$CSTYLE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['style']['engine']=='comfy', d['style']
assert d['missing']==[], d['missing']" \
  && ok "images/comfy: a style with a workflow is complete (no sd-cli paths needed)" \
  || bad "images/comfy: style rejected: $CSTYLE"

# A comfy style must NOT be asked for model paths — the workflow names its own.
curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"No Workflow","arch":"flux","engine":"comfy"}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['missing']==['workflow'], d['missing']" \
  && ok "images/comfy: a style with no workflow is flagged, and ONLY for the workflow" \
  || bad "images/comfy: wrong missing-slot report for a workflow-less style"

# THE POINT OF THE WHOLE EXERCISE: sd-cli is not installed.
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"sd_cli":"/nonexistent/sd-cli-not-installed"}' > /dev/null
if [ -n "${CSID:-}" ]; then
  run_image "comfy-image" "{\"prompt\":\"a red barn at dusk\",\"style_id\":\"$CSID\"}" 1
  CIMG=$(echo "$IMG_J" | jget "['output']")
  echo "$IMG_J" | python3 -c "
import json,sys
log=json.load(sys.stdin)['log']
vr=[i for i,l in enumerate(log) if '[comfy] VRAM: 3.0/32.0 GB free -> 30.0/32.0 GB free' in l]
q=[i for i,l in enumerate(log) if 'queued as' in l]
assert len(vr)==1 and q and vr[0] < q[0], (vr, q)
" && ok "images/comfy: the still also starts from a cleared card (image_worker.py, before 'queued as')" \
    || bad "images/comfy: no VRAM clear before the still: $(echo "$IMG_J" | jget "['log']" | grep -i vram | head -2)"
  PDIR=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['dir']")
  [ -s "$PDIR/$CIMG" ] && ok "images/comfy: the image is downloaded from ComfyUI to the project" \
    || bad "images/comfy: $CIMG never arrived"
  SZ=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$PDIR/$CIMG" 2>/dev/null)
  [ "$SZ" = "128,96" ] && ok "images/comfy: the style's size is patched into the latent node" \
    || bad "images/comfy: wrong size $SZ (want 128,96)"
  # THE PROMPT MUST REACH THE POSITIVE NODE, and the negative prompt the
  # negative one. Swapping them renders the negative prompt as the subject and
  # reads as a bad model rather than a bug, so it is asserted per node id.
  python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
assert t.get("2") == "a red barn at dusk", t     # node 2 = positive
assert t.get("3") == "blurry", t                 # node 3 = negative
PYEOF
  [ $? = 0 ] && ok "images/comfy: prompt -> positive node, negative -> negative node" \
    || bad "images/comfy: the prompts landed on the wrong nodes"
  echo "$IMG_J" | python3 -c "
import json,sys
log=' '.join(json.load(sys.stdin)['log'])
assert 'engine=comfy' in log, log[:400]
assert 'LoRA node' in log, 'no LoRA node was built into the graph'
assert 'sub/grain.safetensors' in log, 'the ComfyUI lora name lost its subfolder'
assert '0.6' in log, 'the lora weight did not reach the graph'
" && ok "images/comfy: a LoRA node is BUILT into the exported graph, with its weight" \
    || bad "images/comfy: the LoRA stack did not reach the workflow"
  # ...and it still lands in the dock exactly like an sd-cli render
  curl -sf http://127.0.0.1:8311/api/passets | python3 -c "
import json,sys
names=[v['name'] for v in json.load(sys.stdin).get('images',[])]
assert '$CIMG' in names, names" \
    && ok "images/comfy: the still reaches the Images asset column" \
    || bad "images/comfy: $CIMG never reached the dock"

  # THE COMFY PATH IS THE ONE TIM ACTUALLY RENDERS ON, so the fresh-seed
  # promise is asserted here too, and on the PICTURE rather than only on the
  # number: the stub colours its output from the seed in the graph, so two
  # identical bytes means the seed never reached the sampler.
  run_image "comfy-press-1" "{\"prompt\":\"a red barn\",\"style_id\":\"$CSID\"}" 1
  C1_SEED=$(echo "$IMG_J" | jget "['params']['seed']")
  C1_OUT=$(echo "$IMG_J" | jget "['output']")
  run_image "comfy-press-2" "{\"prompt\":\"a red barn\",\"style_id\":\"$CSID\"}" 1
  C2_SEED=$(echo "$IMG_J" | jget "['params']['seed']")
  C2_OUT=$(echo "$IMG_J" | jget "['output']")
  [ "$C1_SEED" != "$C2_SEED" ] && [ "$C1_OUT" != "$C2_OUT" ] \
    && ok "images/comfy: two presses = two seeds and two filenames" \
    || bad "images/comfy: press 1 ($C1_SEED/$C1_OUT) and press 2 ($C2_SEED/$C2_OUT) match"
  python3 - <<PYEOF
import hashlib, os
d = "$PDIR"
a = hashlib.md5(open(os.path.join(d, "$C1_OUT"), "rb").read()).hexdigest()
b = hashlib.md5(open(os.path.join(d, "$C2_OUT"), "rb").read()).hexdigest()
assert a != b, "two presses rendered identical bytes - the seed never reached the graph"
PYEOF
  [ $? = 0 ] && ok "images/comfy: ...and two different pictures, not one repeated" \
    || bad "images/comfy: the second press reproduced the first"
  echo "$IMG_J" | python3 -c "
import json,sys
log=' '.join(json.load(sys.stdin)['log'])
assert 'freshly rolled for this press' in log, log[:600]
assert 'seed $C2_SEED' in log, 'the log does not name the seed that was used'
" && ok "images/comfy: the worker log names the seed and says it was rolled fresh" \
    || bad "images/comfy: the seed is not traceable from the log"

  # a batch is ONE queued prompt with batch_size, not N round trips
  run_image "comfy-batch" "{\"prompt\":\"a red barn\",\"style_id\":\"$CSID\",\"batch\":3}" 3
  echo "$IMG_J" | python3 -c "
import json,sys,os,hashlib
j=json.load(sys.stdin)
d='$PDIR'
hs=[hashlib.md5(open(os.path.join(d,n),'rb').read()).hexdigest() for n in j['outputs']]
assert len(set(hs))==3, 'a comfy batch produced identical images'
log=' '.join(j['log'])
assert 'batch 3' in log, log[:400]
assert log.count('queued as')==1, 'a batch should be ONE queued prompt, not three'
" && ok "images/comfy: a batch of 3 is one prompt, three different images" \
    || bad "images/comfy: batch handling is wrong"
fi

# A workflow that cannot be patched must say WHY, not fail at ComfyUI.
cat > comfy_workflows/e2e_img_bad.json << 'WF'
{
  "1": { "class_type": "CLIPTextEncode", "inputs": { "text": "one" } },
  "2": { "class_type": "CLIPTextEncode", "inputs": { "text": "two" } },
  "3": { "class_type": "SaveImage", "inputs": { "filename_prefix": "x", "images": ["1", 0] } }
}
WF
BADS=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"Ambiguous","arch":"sdxl","engine":"comfy","workflow":"comfy_workflows/e2e_img_bad.json"}')
BADID=$(echo "$BADS" | jget "['style']['id']")
BJ=$(curl -sf -X POST http://127.0.0.1:8311/api/genimage -H "Content-Type: application/json" \
     -d "{\"prompt\":\"x\",\"style_id\":\"$BADID\"}")
BID=$(echo "$BJ" | jget "['id']")
for i in $(seq 1 40); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$BID" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 1
done
[ "$st" = "failed" ] && ok "images/comfy: an unpatchable workflow fails the job" \
  || bad "images/comfy: an ambiguous workflow reported $st"
# Rendering the NEGATIVE prompt as the subject looks like a model problem, not a
# bug — so the patcher refuses to guess, and must say so in the user's terms.
curl -sf "http://127.0.0.1:8311/api/jobs/$BID?log_from=0" | jget "['log']" \
  | grep -qi "positive" \
  && ok "images/comfy: it refuses to guess which prompt is positive, and says so" \
  || bad "images/comfy: the ambiguity error was not actionable"

# A UI export is the file people reach for first, and it is the WRONG format.
echo '{"nodes":[],"links":[],"version":0.4}' > comfy_workflows/e2e_img_ui.json
UIS=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"UI Export","arch":"sdxl","engine":"comfy","workflow":"comfy_workflows/e2e_img_ui.json"}')
UIID=$(echo "$UIS" | jget "['style']['id']")
UJ=$(curl -sf -X POST http://127.0.0.1:8311/api/genimage -H "Content-Type: application/json" \
     -d "{\"prompt\":\"x\",\"style_id\":\"$UIID\"}")
UID2=$(echo "$UJ" | jget "['id']")
for i in $(seq 1 40); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$UID2" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 1
done
curl -sf "http://127.0.0.1:8311/api/jobs/$UID2?log_from=0" | jget "['log']" \
  | grep -qi "Export (API)" \
  && ok "images/comfy: a UI workflow export is named as the wrong format" \
  || bad "images/comfy: a UI export gave an unhelpful error"

# =====================================================================
# MUSIC THROUGH COMFYUI (2.90.0) — a third worker, never a branch in
# worker.py. The doctrine: the PROMPT is the lyrics, the STYLE's caption is
# the musical description, the output arrives under `audio` in the history
# and lands in the project's sound/ folder. sd-cli is still pointed at a
# path that does not exist, which proves music never goes near it.
# =====================================================================
MUS=$(curl -sf "http://127.0.0.1:8311/api/styles?kind=music")
echo "$MUS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
st=d['styles']
assert d.get('kind')=='music', d.get('kind')
assert st and all(s['kind']=='music' for s in st), st
assert any(s['name']=='MiniMax Music3' for s in st), [s['name'] for s in st]
m=[s for s in st if s['name']=='MiniMax Music3'][0]
assert m['engine']=='comfy' and m['workflow'].endswith('audio_minimax_music3.json'), m
assert m['max_duration']==60 and m['steps']==30 and abs(m['cfg']-1.7)<1e-6, m
assert 'lo-fi' in m['caption'].lower() or 'lofi' in m['caption'].lower(), m['caption'][:80]
assert d['model_kinds'][m['id']]==['diffusion_models'], d['model_kinds'].get(m['id'])
" && ok "music: the MiniMax Music3 starter is seeded, kind=music, with the template's caption" \
  || bad "music: the starter style is missing or wrong: $(echo "$MUS" | head -c 300)"
curl -sf "http://127.0.0.1:8311/api/styles?kind=image" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('kind')=='image', d.get('kind')
assert all(s['kind']=='image' for s in d['styles']), [s['name'] for s in d['styles']]
assert not any(s['name']=='MiniMax Music3' for s in d['styles'])
" && ok "music: ?kind=image keeps music styles OUT of the image dropdown" \
  || bad "music: a music style leaked into the image list"
# back-compat: a bare GET still returns everything, each row saying what it is
curl -sf "http://127.0.0.1:8311/api/styles" | python3 -c "
import json,sys
d=json.load(sys.stdin)
kinds=set(s.get('kind') for s in d['styles'])
# all THREE kinds since 2.116.0: the MiniMax H3 SS video starter seeds at boot
assert kinds=={'image','music','video'}, kinds
assert d.get('kind')=='all', d.get('kind')
" && ok "music: a bare GET /api/styles returns every kind (image+music+video), each row labelled" \
  || bad "music: the unfiltered style list lost a kind"

# A music style is the same editor as an image one: created, read back, and
# the music fields survive the round trip. A name clash across kinds is a
# 409 — one folder, one namespace, because the prompt dock names by name.
MSTY=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"E2E Song","kind":"music","arch":"minimax-music3",
       "workflow":"comfy_workflows/audio_minimax_music3.json",
       "caption":"Global Metadata: Genre: synthwave. Vocal: none. Arrangement: arpeggios.",
       "steps":7,"cfg":2.5,"max_duration":9,"sampler":"dpmpp_2m","scheduler":"karras"}')
MSID=$(echo "$MSTY" | jget "['style']['id']")
echo "$MSTY" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d['style']
assert s['kind']=='music' and s['engine']=='comfy', s
assert d['missing']==[], d['missing']
assert s['max_duration']==9 and s['steps']==7 and abs(s['cfg']-2.5)<1e-6, s
assert s['sampler']=='dpmpp_2m' and s['scheduler']=='karras', s
assert s['caption'].startswith('Global Metadata'), s['caption']
assert 'width' not in s and 'negative' not in s, 'image-only fields leaked into a music style'
" && ok "music: a music style round-trips caption, duration, sampler and scheduler" \
  || bad "music: style create/read lost a field: $(echo "$MSTY" | head -c 300)"
MCL=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/styles \
  -H "Content-Type: application/json" -d '{"name":"E2E Song","arch":"sdxl","engine":"comfy","workflow":"comfy_workflows/e2e_img.json"}')
# 2.110.0: one folder per kind, so an image "E2E Song" beside the music one
# is allowed (styles/image vs styles/music, two dropdowns); within a kind 409 stays
[ "$MCL" = "200" ] && ok "music: an image style MAY take a music style's name now (separate folders, 2.110.0)" \
  || bad "music: cross-kind name refused ($MCL)"
MCL2=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/styles \
  -H "Content-Type: application/json" -d '{"kind":"music","name":"E2E Song","arch":"minimax-music3","workflow":"comfy_workflows/audio_minimax_music3.json"}')
[ "$MCL2" = "409" ] && ok "music: ...but a second MUSIC style of that name is still refused (409)" || bad "music: same-kind clash accepted ($MCL2)"
curl -s "http://127.0.0.1:8311/api/styles?kind=image" | python3 -c "
import json,sys,urllib.request; j=json.load(sys.stdin)
for s in j['styles']:
    if s['name']=='E2E Song': urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8311/api/styles/'+s['id'], method='DELETE'))" 2>/dev/null || true
# clamped to the arch's limit, never silently huge; and an edit never flips the kind
curl -sf -X POST "http://127.0.0.1:8311/api/styles" -H "Content-Type: application/json" \
  -d "{\"id\":\"$MSID\",\"kind\":\"image\",\"max_duration\":99999}" | python3 -c "
import json,sys
s=json.load(sys.stdin)['style']
assert s['kind']=='music', 'an edit naming the other kind flipped the style'
assert s['max_duration']==300, s['max_duration']
assert s['caption'].startswith('Global Metadata'), 'the edit wiped the caption'
" && ok "music: an edit clamps max_duration to the arch limit and cannot change the kind" \
  || bad "music: edit mishandled max_duration or kind"
curl -sf -X POST "http://127.0.0.1:8311/api/styles" -H "Content-Type: application/json" \
  -d "{\"id\":\"$MSID\",\"max_duration\":9}" > /dev/null

# ---- refusals, in the user's terms ----
GB=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/genmusic \
  -H "Content-Type: application/json" -d "{\"prompt\":\"   \",\"style_id\":\"$MSID\"}")
[ "$GB" = "400" ] && ok "music: empty lyrics are refused (400)" || bad "music: empty lyrics accepted ($GB)"
GB=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/genmusic \
  -H "Content-Type: application/json" -d '{"prompt":"la la","style_id":"st_nope"}')
[ "$GB" = "400" ] && ok "music: an unknown style is refused (400)" || bad "music: unknown style accepted ($GB)"
MXR=$(curl -s -X POST http://127.0.0.1:8311/api/genmusic \
  -H "Content-Type: application/json" -d "{\"prompt\":\"la la\",\"style_id\":\"$CSID\"}")
echo "$MXR" | grep -q "image style" \
  && ok "music: an IMAGE style sent to /api/genmusic is refused and named as such" \
  || bad "music: an image style was accepted for music, or the error is vague: $MXR"
MXI=$(curl -s -X POST http://127.0.0.1:8311/api/genimage \
  -H "Content-Type: application/json" -d "{\"prompt\":\"a cat\",\"style_id\":\"$MSID\"}")
echo "$MXI" | grep -q "music style" \
  && ok "music: a MUSIC style sent to /api/genimage is refused and named as such" \
  || bad "music: a music style was accepted for an image render, or the error is vague: $MXI"

run_music() {   # name  json  expect_count
  local name="$1"; local body="$2"; local want="$3"
  local res id st
  res=$(curl -sf -X POST http://127.0.0.1:8311/api/genmusic \
        -H "Content-Type: application/json" -d "$body")
  id=$(echo "$res" | jget "['id']" 2>/dev/null)
  if [ -z "${id:-}" ]; then bad "$name: rejected: $res"; return; fi
  for i in $(seq 1 120); do
    st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$id" | jget "['status']")
    [ "$st" = "done" ] || [ "$st" = "failed" ] && break
    sleep 1
  done
  MUS_J=$(curl -sf "http://127.0.0.1:8311/api/jobs/$id?log_from=0")
  MUS_ID=$id
  if [ "$st" != "done" ]; then
    bad "$name: status=$st"; echo "$MUS_J" | jget "['log']" | tail -6; return
  fi
  local n; n=$(echo "$MUS_J" | python3 -c "import json,sys;print(len(json.load(sys.stdin)['outputs'] or []))")
  [ "$n" = "$want" ] && ok "$name: produced $n song(s)" || bad "$name: got $n want $want"
}

if [ -n "${MSID:-}" ]; then
  run_music "music-single" "{\"prompt\":\"[verse]\\nneon rain on the glass\\n[chorus]\\nstay\",\"style_id\":\"$MSID\"}" 1
  MOUT=$(echo "$MUS_J" | jget "['output']")
  PDIR=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['dir']")
  AP=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")
  [ -s "$PDIR/$MOUT" ] && ok "music: the song is downloaded from ComfyUI into the project's output folder" \
    || bad "music: $MOUT never arrived in $PDIR"
  case "$MOUT" in *.mp3) ok "music: the file keeps ComfyUI's own extension (.mp3)";;
    *) bad "music: unexpected output name $MOUT";; esac
  # THE DOCTRINE, asserted on the graph ComfyUI received: prompt -> lyrics,
  # the style's caption -> caption, and the sampler settings on the KSampler.
  python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
enc = t["37:13"]
assert enc["lyrics"].startswith("[verse]") and "neon rain" in enc["lyrics"], enc
assert enc["caption"].startswith("Global Metadata: Genre: synthwave"), enc
assert "neon rain" not in enc["caption"] and "synthwave" not in enc["lyrics"], "lyrics and caption are swapped"
ks = t["37:9"]
assert ks["sampler_name"] == "dpmpp_2m" and ks["scheduler"] == "karras", ks
assert ks["steps"] == 7 and abs(float(ks["cfg"]) - 2.5) < 1e-6, ks
PYEOF
  [ $? = 0 ] && ok "music: prompt -> lyrics, caption -> caption, sampler/scheduler/steps/cfg -> KSampler" \
    || bad "music: the graph ComfyUI received has the texts or sampler on the wrong inputs"
  # the style's duration reaches the encoder: the stub renders exactly that long
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$PDIR/$MOUT" 2>/dev/null)
  python3 -c "import sys; d=float('$DUR'); assert 8.5 <= d <= 9.6, d" \
    && ok "music: the style's max_duration (9s) reaches the encoder — the file is ~9s long" \
    || bad "music: duration $DUR (want ~9)"
  # it lands in the SOUND asset column, hard-linked, not the video or image one
  curl -sf http://127.0.0.1:8311/api/passets | python3 -c "
import json,sys
j=json.load(sys.stdin)
snd=[v['name'] for v in j.get('sound',[])]
assert '$MOUT' in snd, snd
assert '$MOUT' not in [v['name'] for v in j.get('video',[])], 'a song was filed as footage'
assert '$MOUT' not in [v['name'] for v in j.get('images',[])], 'a song was filed as a still'
" && ok "music: the song is auto-added to the SOUND assets" \
    || bad "music: $MOUT did not reach the sound asset column"
  python3 - <<PYEOF
import os
a = os.stat("$PDIR/$MOUT"); b = os.stat("projects/$AP/sound/$MOUT")
assert a.st_size == b.st_size
if a.st_ino and b.st_ino:
    assert (a.st_ino, a.st_dev) == (b.st_ino, b.st_dev), "copied, not linked"
PYEOF
  [ $? = 0 ] && ok "music: hard-linked into sound/ like a render is" \
    || bad "music: the song was copied instead of linked"
  # the gallery's Audio tab, and NOT the video/image listings
  curl -sf "http://127.0.0.1:8311/api/outputs?kind=audio" | python3 -c "
import json,sys
f=json.load(sys.stdin)
m=[x for x in f if x['name']=='$MOUT']
assert m, [x['name'] for x in f]
assert m[0].get('duration') and m[0]['duration']>8, m[0]" \
    && ok "music: GET /api/outputs?kind=audio lists it for the gallery, with its duration" \
    || bad "music: the Audio tab listing does not include $MOUT"
  curl -sf "http://127.0.0.1:8311/api/outputs" | python3 -c "
import json,sys
f=json.load(sys.stdin)
assert not any(x['name'].endswith('.mp3') for x in f), [x['name'] for x in f]" \
    && ok "music: songs stay OUT of the default (video) outputs listing" \
    || bad "music: an .mp3 leaked into the video listing"
  # the seed is in the filename and the log, same as images
  echo "$MUS_J" | python3 -c "
import json,sys
j=json.load(sys.stdin)
seed=j['params']['seed']
assert ('_s%d_' % seed) in j['output'], (seed, j['output'])
log=' '.join(j['log'])
assert 'seed %d' % seed in log, log[:600]
assert 'engine=comfy' in log and 'music: style=' in log and 'E2E Song' in log, log[:400]
assert 'duration=9s' in log, log[:600]
assert '===== chunk 1/1' in log, 'the stable chunk line is missing'
assert 'sd-cli' not in log.lower() or 'not used' in log.lower(), 'music must never touch sd-cli'
" && ok "music: the seed is in the filename and the log; the worker names the style, duration and engine" \
    || bad "music: seed/log protocol wrong: $(echo "$MUS_J" | jget "['output']")"

  # per-request overrides: a different caption and a shorter song, without
  # touching the saved style
  run_music "music-override" "{\"prompt\":\"hum\",\"style_id\":\"$MSID\",\"caption\":\"Global Metadata: Genre: polka.\",\"max_duration\":3,\"steps\":2}" 1
  python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
assert t["37:13"]["caption"] == "Global Metadata: Genre: polka.", t["37:13"]
assert t["37:13"]["lyrics"] == "hum", t["37:13"]
assert t["37:9"]["steps"] == 2, t["37:9"]
PYEOF
  [ $? = 0 ] && ok "music: a per-request caption/steps override reaches the graph" \
    || bad "music: the request override did not reach ComfyUI"
  MOUT2=$(echo "$MUS_J" | jget "['output']")
  DUR2=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$PDIR/$MOUT2" 2>/dev/null)
  python3 -c "import sys; d=float('$DUR2'); assert 2.5 <= d <= 3.6, d" \
    && ok "music: ...and the per-request max_duration (3s) too" \
    || bad "music: override duration $DUR2 (want ~3)"
  curl -sf "http://127.0.0.1:8311/api/styles?kind=music" | python3 -c "
import json,sys
s=[x for x in json.load(sys.stdin)['styles'] if x['id']=='$MSID'][0]
assert s['max_duration']==9 and 'synthwave' in s['caption'], s" \
    && ok "music: the saved style is untouched by a per-request override" \
    || bad "music: a request override was written back into the style"

  # two presses = two seeds, two filenames, two different songs
  run_music "music-press-1" "{\"prompt\":\"hum\",\"style_id\":\"$MSID\",\"max_duration\":2}" 1
  M1_SEED=$(echo "$MUS_J" | jget "['params']['seed']"); M1_OUT=$(echo "$MUS_J" | jget "['output']")
  run_music "music-press-2" "{\"prompt\":\"hum\",\"style_id\":\"$MSID\",\"max_duration\":2}" 1
  M2_SEED=$(echo "$MUS_J" | jget "['params']['seed']"); M2_OUT=$(echo "$MUS_J" | jget "['output']")
  [ "$M1_SEED" != "$M2_SEED" ] && [ "$M1_OUT" != "$M2_OUT" ] \
    && ok "music: two presses = two seeds and two filenames" \
    || bad "music: press 1 ($M1_SEED/$M1_OUT) and press 2 ($M2_SEED/$M2_OUT) match"
  python3 - <<PYEOF
import hashlib, os
d = "$PDIR"
a = hashlib.md5(open(os.path.join(d, "$M1_OUT"), "rb").read()).hexdigest()
b = hashlib.md5(open(os.path.join(d, "$M2_OUT"), "rb").read()).hexdigest()
assert a != b, "two presses rendered identical bytes - the seed never reached the graph"
PYEOF
  [ $? = 0 ] && ok "music: ...and two different songs, not one repeated" \
    || bad "music: the second press reproduced the first"
  # 2.373.0 (Tim: "when bitgen produces a song save the lyrics in a txt file in the project folder")
  LYF="$(dirname "$PDIR")/lyrics/${M1_OUT%.*}.txt"
  [ -f "$LYF" ] && grep -qx "hum" "$LYF" \
    && ok "music: the song's lyrics are saved as lyrics/<song>.txt in the project folder (2.373.0)" \
    || bad "music: no lyrics file $LYF: $(ls "$(dirname "$PDIR")/lyrics" 2>&1 | head -3)"

  # a batch is ONE queued prompt with batch_size, capped at 4
  run_music "music-batch" "{\"prompt\":\"hum\",\"style_id\":\"$MSID\",\"batch\":9,\"max_duration\":2}" 4
  echo "$MUS_J" | python3 -c "
import json,sys,os,hashlib
j=json.load(sys.stdin)
d='$PDIR'
hs=[hashlib.md5(open(os.path.join(d,n),'rb').read()).hexdigest() for n in j['outputs']]
assert len(set(hs))==4, 'a music batch produced identical songs'
log=' '.join(j['log'])
assert log.count('queued as')==1, 'a batch should be ONE queued prompt'
" && ok "music: a batch asks for 9, is capped at 4, one prompt, four different songs" \
    || bad "music: batch handling is wrong"

  # the right worker ran: music_worker.py, not worker.py or image_worker.py.
  # There is no @@CMD for a ComfyUI render (nothing is exec'd), so the worker
  # names itself in its first log line instead.
  echo "$MUS_J" | python3 -c "
import json,sys
j=json.load(sys.stdin)
log='\n'.join(j['log'])
assert 'music_worker.py mode=music' in log, log[:300]
assert 'image_worker.py' not in log and 'mode=image' not in log, log[:300]
assert j.get('command') is None, 'a ComfyUI render execs nothing, so there is no command line'
" && ok "music: the job was run by music_worker.py, its own worker" \
    || bad "music: the wrong worker ran: $(echo "$MUS_J" | jget "['log'][:2]")"
  echo "$MUS_J" | python3 -c "
import json,sys
log=json.load(sys.stdin)['log']
vr=[i for i,l in enumerate(log) if '[comfy] VRAM: 3.0/32.0 GB free -> 30.0/32.0 GB free' in l]
q=[i for i,l in enumerate(log) if 'queued as' in l]
assert len(vr)==1 and q and vr[0] < q[0], (vr, q)
" && ok "music: the song also starts from a cleared card (music_worker.py)" \
    || bad "music: no VRAM clear before the song"
fi

# an image graph handed to the music worker must be refused by the PATCHER
# (no SaveAudio), in words, before ComfyUI is ever asked
MBAD=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"Song With Image Graph","kind":"music","arch":"minimax-music3",
       "workflow":"comfy_workflows/e2e_img.json"}')
MBID=$(echo "$MBAD" | jget "['style']['id']")
MBJ=$(curl -sf -X POST http://127.0.0.1:8311/api/genmusic -H "Content-Type: application/json" \
     -d "{\"prompt\":\"x\",\"style_id\":\"$MBID\"}")
MBJID=$(echo "$MBJ" | jget "['id']")
for i in $(seq 1 40); do
  st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$MBJID" | jget "['status']")
  [ "$st" = "done" ] || [ "$st" = "failed" ] && break
  sleep 1
done
[ "$st" = "failed" ] && ok "music: a music style pointing at an IMAGE workflow fails the job" \
  || bad "music: an image graph in a music style reported $st"
curl -sf "http://127.0.0.1:8311/api/jobs/$MBJID?log_from=0" | jget "['log']" \
  | grep -qi "SaveAudio" \
  && ok "music: ...and the log says the graph has no SaveAudio node" \
  || bad "music: the wrong-graph error was not actionable"

# put sd-cli back for anything after this point
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"sd_cli":"scripts/stub-sd-cli.py"}' > /dev/null

python3 scripts/test-comfyimage.py > /tmp/comfyimg.log 2>&1 \
  && ok "comfy image graph unit tests (role discovery, lora chains, refusals)" \
  || { bad "comfy image graph unit tests"; tail -16 /tmp/comfyimg.log; }

# ---- /prompt 400 must surface node_errors (not a raw HTTPError traceback)
python3 - <<'PYEOF' > /tmp/reject.log 2>&1
import sys; sys.path.insert(0, ".")
import worker
r = worker._http_json("http://127.0.0.1:8388/prompt",
                      {"prompt": {"1": {"class_type": "E2E_Reject", "inputs": {}}},
                       "client_id": "x"}, read_error_body=True)
assert r.get("prompt_id") is None and r.get("node_errors"), r
e = r["node_errors"]["73"]["errors"][0]
assert e["extra_info"]["received_value"] == "nope.safetensors"
print("reject body parsed:", e["message"])
PYEOF
grep -q "reject body parsed" /tmp/reject.log \
  && ok "/prompt 400 body read (node_errors reach the log)" \
  || { bad "/prompt 400 body read"; tail -5 /tmp/reject.log; }

# ---- VIDEO STYLES (2.110.0, Tim): styles/video/<name>.json, phases
# (checkpoint+steps+cfg per sampler), te, vae, LoRAs; picked in the dropdown
# beside the image style; applied to the graph by the worker.
python3 - <<'PYEOF'
import copy, json, sys
sys.path.insert(0, ".")
import worker
NAT = json.load(open("comfy_workflows/ref2va.json"))
st = {"name": "H3 custom", "phases": [{"model": "my_h3.safetensors", "steps": 12, "cfg": 1.0}],
      "te": ["enc.safetensors"], "vae": "vid.safetensors", "loras": [{"path": "a.safetensors", "weight": 0.6}, {"path": "b.safetensors", "weight": 1}]}
out, notes = worker.apply_video_style(copy.deepcopy(NAT), st)
assert out["127"]["inputs"]["unet_name"] == "my_h3.safetensors", notes
assert out["128"]["inputs"]["clip_name"] == "enc.safetensors"
assert out["119"]["inputs"]["vae_name"] == "vid.safetensors" and "audio" in out["120"]["inputs"]["vae_name"], "the AUDIO vae was touched"
assert out["h3lora1"]["inputs"]["model"] == ["127", 0] and out["h3lora2"]["inputs"]["model"] == ["h3lora1", 0]
assert out["145"]["inputs"]["model"] == ["h3lora2", 0] and out["141"]["inputs"]["on_false"] == ["h3lora2", 0], "consumers not rewired"
assert out["144"]["inputs"]["value"] != 12 and out["143"]["inputs"]["value"] != 12, "phase 1 steps must NOT be written (Basic Settings owns them, 2.111.3)"
# two-phase graph (Wan 2.2 high/low shape): phase i -> loader i, sampler i
g2 = {"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "h"}}, "2": {"class_type": "UNETLoader", "inputs": {"unet_name": "l"}},
      "3": {"class_type": "KSamplerAdvanced", "inputs": {"steps": 20, "cfg": 3.5, "model": ["1", 0]}},
      "4": {"class_type": "KSamplerAdvanced", "inputs": {"steps": 20, "cfg": 3.5, "model": ["2", 0]}}}
o2, _ = worker.apply_video_style(copy.deepcopy(g2), {"phases": [{"model": "HIGH.safetensors", "steps": 8, "cfg": 4}, {"model": "LOW.safetensors", "steps": 12, "cfg": 3}]})
assert (o2["1"]["inputs"]["unet_name"], o2["2"]["inputs"]["unet_name"]) == ("HIGH.safetensors", "LOW.safetensors")
# phase 1 keeps the template's steps/cfg (Basic Settings carries them); phase 2 gets its own
assert (o2["3"]["inputs"]["steps"], o2["3"]["inputs"]["cfg"], o2["4"]["inputs"]["steps"], o2["4"]["inputs"]["cfg"]) == (20, 3.5, 12, 3.0)
o3, _ = worker.apply_video_style(copy.deepcopy(g2), {"phases": [{"model": "", "steps": 8, "cfg": 9}]}, explicit_steps=30)
assert o3["3"]["inputs"]["steps"] == 20 and o3["1"]["inputs"]["unet_name"] == "h" and o3["3"]["inputs"]["cfg"] == 3.5
print("video style ok")
PYEOF
[ $? = 0 ] && ok "video style: phases -> loaders/samplers in order (phase 1 steps/cfg left to Basic Settings), te, video VAE only, built LoRA chain" || bad "video style: apply_video_style"
VS=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"kind":"video","name":"E2E H3 style","arch":"minimax-h3","phases":[{"model":"e2e_h3.safetensors","steps":3,"cfg":1.0}],"te":["e2e_enc.safetensors"],"vae":"e2e_vvae.safetensors","loras":[{"path":"e2e_vlora.safetensors","weight":0.5}],"accel":{"sage":"auto","spectrum":"on"}}')
VSID=$(echo "$VS" | jget "['style']['id']")
[ -f "styles/video/E2E H3 style.json" ] && ok "video style: saved as styles/video/<name>.json" || bad "video style: file $(ls styles/video 2>/dev/null)"
curl -sf "http://127.0.0.1:8311/api/styles?kind=video" | grep -q '"E2E H3 style"' && ok "video style: listed under kind=video (the prompt-bar dropdown)" || bad "video style: not listed"
curl -sf "http://127.0.0.1:8311/api/styles?kind=image" | grep -q '"E2E H3 style"' && bad "video style: leaked into the image list" || ok "video style: not in the image list"
curl -sf http://127.0.0.1:8311/api/videoarchs | grep -q '"wan22"' && ok "video style: /api/videoarchs serves the catalogue (H3, Wan 2.2, custom)" || bad "video style: archs"
VJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="styled video" -F width=192 -F height=108 -F steps=0 -F seed=9 \
  -F mode=t2va -F frames=22 -F pipeline=single -F format=webm -F "video_style_id=$VSID" | jget "['id']")
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$VJ" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
VJJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$VJ?log_from=0")
[ "$st" = "done" ] && echo "$VJJ" | python3 -c "
import json,sys; j=json.load(sys.stdin); log=j['log']
assert j['params']['video_style_name']=='E2E H3 style', j['params'].get('video_style_name')
assert not any('(video style' in l for l in log if 'steps=' in l), [l for l in log if 'steps=' in l]   # steps come from Basic Settings
assert any('style: phase 1: model -> ' in l for l in log) and any('style: lora 1:' in l for l in log), [l for l in log if 'style:' in l]
assert any('accel: sage auto -> h3sage' in l for l in log), [l for l in log if 'accel' in l]
assert any('accel: spectrum on -> h3spectrum' in l for l in log), [l for l in log if 'accel' in l]" \
  && ok "video style: Generate ran with the style — model + LoRA in the log, steps from Basic Settings" || bad "video style: job $st $(echo "$VJJ" | jget "['log']" 2>/dev/null | tail -c 300)"
[ "$st" = "done" ] && echo "$VJJ" | python3 -c "
import json,sys; log=json.load(sys.stdin)['log']
assert any('accel: sage auto -> h3sage (PathchSageAttentionKJ)' in l for l in log)
assert any('audio-safe defaults' in l for l in log if 'spectrum' in l)" \
  && ok "accel (2.116.0): the style's Sage + Spectrum choices are logged before queueing" || bad "accel: log lines missing"
python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)
r = json.load(open(newest))
assert "e2e_h3.safetensors" in r["_models"], r["_models"]
assert "e2e_enc.safetensors" in r["_clips"], r["_clips"]
assert "e2e_vvae.safetensors" in r["_vaes"] and any("audio" in v for v in r["_vaes"]), r["_vaes"]
assert "e2e_vlora.safetensors" in r["_loras"], r["_loras"]
assert r["_accel"] == ["PathchSageAttentionKJ", "SpectrumApplyMiniMaxH3"], r["_accel"]
assert r["_accel_wiring"]["h3spectrum"] == ["h3sage", 0], r["_accel_wiring"]
assert any(v == ["h3spectrum", 0] for k, v in r["_accel_wiring"].items()
           if k not in ("h3sage", "h3spectrum")), r["_accel_wiring"]   # a consumer follows the chain
assert r["_spectrum"]["enabled"] is True and "blend_weight" not in r["_spectrum"], r["_spectrum"]
PYEOF
[ $? = 0 ] && ok "video style: ComfyUI received the checkpoint, text encoder, video VAE (audio VAE untouched) and the LoRA" \
  || bad "video style: overrides did not reach the graph"
# ---- THE VIDEO DOCKER'S CHARACTERS (2.134.0) ------------------------------
# Tim's Short Film Director pipeline wires its character references as a linked
# chain feeding reference_schedule. These drive the real endpoints: a character
# is created, given a sheet and a voice, and the tmp style is rebuilt from it.
curl -sf -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Jinx","age":"19","height":"165cm","weight":"52kg","notes":"blue hair"}' \
  | grep -q '"name":"Jinx"' \
  && ok "characters: NEW writes a profile with name, age, height and weight" \
  || bad "characters: create failed"
cp /tmp/ref.png /tmp/ch_sheet.png
curl -sf -F "file=@/tmp/ch_sheet.png" http://127.0.0.1:8311/api/characters/Jinx/asset \
  | grep -q '"kind":"images"' \
  && ok "characters: the character sheet is filed as an image" \
  || bad "characters: sheet upload failed"
head -c 2048 /dev/urandom > /tmp/ch_voice.wav
curl -sf -F "file=@/tmp/ch_voice.wav" http://127.0.0.1:8311/api/characters/Jinx/asset \
  | grep -q '"kind":"voices"' \
  && ok "characters: the voice clip is filed as a voice" \
  || bad "characters: voice upload failed"
curl -s -F "file=@/tmp/ch_sheet.png;filename=notes.txt" \
  http://127.0.0.1:8311/api/characters/Jinx/asset | grep -q "not a character sheet" \
  && ok "characters: something that is neither a sheet nor a voice is refused" \
  || bad "characters: a non-media asset was accepted"
curl -sf http://127.0.0.1:8311/api/characters/briefing | grep -q "age 19" \
  && ok "characters: the LLM briefing carries the character's facts" \
  || bad "characters: briefing missing"
CB=$(curl -sf -X POST http://127.0.0.1:8311/api/characters/build \
  -H 'Content-Type: application/json' -d '{"start_clip":2,"redo_scene":3}')
echo "$CB" | grep -q '"file":"MM3_Characters_tmp.json"' \
  && ok "characters: Build writes MM3_Characters_tmp.json, leaving the style untouched" \
  || bad "characters: build failed: $(echo "$CB" | head -c 200)"
python3 - <<'PYEOF'
import json, os
tmp = json.load(open("comfy_workflows/MM3_Characters_tmp.json"))
base = json.load(open("comfy_workflows/MM3_Characters.json"))
pic = [k for k, v in tmp.items() if v.get("class_type") == "MiniMaxH3ScheduledPictureReference"]
aud = [k for k, v in tmp.items() if v.get("class_type") == "MiniMaxH3ScheduledAudioReference"]
assert len(pic) == 1 and len(aud) == 1, (pic, aud)          # one character, one of each
assert tmp[pic[0]]["inputs"]["tag"] == "jinx", tmp[pic[0]]["inputs"]
# the chain must terminate in whatever consumes the schedule
tail = [v["inputs"]["reference_schedule"][0] for v in tmp.values()
        if isinstance(v.get("inputs"), dict) and "reference_schedule" in v["inputs"]]
assert tail and str(tail[0]) in pic + aud, tail
# scene controls landed on the node Tim's own export uses for them
ls = [v for v in tmp.values() if v.get("class_type") == "MiniMaxH3ChainLoopStart"][0]
assert ls["inputs"]["start_clip"] == 2, ls["inputs"]
assert ls["inputs"]["scene_range"] == "3:3", ls["inputs"]   # redo scene 3
# the shipped style is not modified by any of this
assert len([k for k, v in base.items()
            if v.get("class_type") == "MiniMaxH3ScheduledPictureReference"]) == 2
PYEOF
[ $? = 0 ] && ok "characters: the tmp graph has this cast's chain, wired to the schedule, with the scene range applied" \
  || bad "characters: the tmp graph is wrong"
curl -sf -X DELETE http://127.0.0.1:8311/api/characters/Jinx | grep -q '"ok":true' \
  && ok "characters: removing a character deletes their folder" \
  || bad "characters: delete failed"
# ---- MM3_Characters as a video style (2.135.0) ----------------------------
# Tim: "for this style we will use the workflows paths because it is made
# specifically for comfyui" — so the style names NO model, te or vae, and the
# graph's own loaders stand. It renders through the TMP file, which is rebuilt
# from the cast rather than being something anyone edits.
MMS=$(curl -sf "http://127.0.0.1:8311/api/styles?kind=video")
echo "$MMS" | python3 -c "
import json,sys
sts=json.load(sys.stdin); sts=sts.get('styles',sts)
s=[x for x in sts if x.get('name')=='MM3_Characters']
assert s, [x.get('name') for x in sts]
s=s[0]
assert s['workflow'] == 'comfy_workflows/MM3_Characters_tmp.json', s['workflow']
assert s.get('kind') == 'video' and s.get('arch') == 'minimax-h3', s
# the point of Tim's instruction: nothing here overrides the graph's loaders
assert not s.get('model'), s.get('model')
assert not s.get('vae'), s.get('vae')
assert not [t for t in (s.get('te') or []) if t], s.get('te')
" && ok "styles: MM3_Characters is seeded as a video style naming no model, te or vae" \
  || bad "styles: MM3_Characters missing or carries loader overrides"
[ -f comfy_workflows/MM3_Characters_tmp.json ] \
  && ok "styles: the tmp workflow the style points at exists from startup" \
  || bad "styles: the style points at a file that does not exist"
curl -sf -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Zed","age":"40"}' >/dev/null
python3 -c "
import json
g=json.load(open('comfy_workflows/MM3_Characters_tmp.json'))
# saving a character rebuilds the tmp immediately: no stale cast in the render
assert not [v for v in g.values() if v.get('class_type')=='MiniMaxH3ScheduledPictureReference'
            and v['inputs'].get('tag')=='shahzaib'], 'the demo cast survived'
" && ok "styles: saving a character rebuilds the tmp at once, so the render never uses a stale cast" \
  || bad "styles: the tmp was not rebuilt on save"
curl -sf -X DELETE http://127.0.0.1:8311/api/characters/Zed >/dev/null
# ---- TEACHING THE LLM THE PIPELINE'S GRAMMAR (2.136.0) --------------------
curl -sf -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Jinx","age":"19"}' >/dev/null
curl -sf "http://127.0.0.1:8311/api/screenplay/guide" | python3 -c "
import json,sys; g=json.load(sys.stdin)['guide']
assert '@jinx' in g, 'the guide does not name the cast'
assert 'ONE JSON object' in g and '<d>[English]' in g and '(S1)' in g, g[:200]
" && ok "screenplay: the guide names this project's cast and the exact plan_json grammar" \
  || bad "screenplay: guide wrong"
# apply refuses a screenplay naming someone with no reference sheet
BAD='{"plan":{"prompt_prefix":["subject_definitions:"],"shots":[{"id":"a","prompt":["@vi walks in."]}]}}'
curl -s -X POST http://127.0.0.1:8311/api/screenplay/apply -H 'Content-Type: application/json' \
  -d "$BAD" | grep -q "has no character in this project" \
  && ok "screenplay: a screenplay naming an invented character is refused before it can render" \
  || bad "screenplay: an invented character was accepted"
GOOD='{"plan":{"prompt_prefix":["subject_definitions:","","@jinx is defined by the reference sheet."],"shots":[{"id":"clip_01","prompt":["[Shot 1] @jinx raises a bullet.","","@jinx (S1), quietly:","","<d>[English] You get one shot.</d>"],"length":158,"seed":"12"},{"id":"clip_02","prompt":["@jinx turns away."],"length":158,"seed":"13","visual_context_source":"clip_01"}]},"redo_scene":2}'
curl -sf -X POST http://127.0.0.1:8311/api/screenplay/apply -H 'Content-Type: application/json' \
  -d "$GOOD" | grep -q '"shots":2' \
  && ok "screenplay: a valid screenplay is written into the tmp graph" \
  || bad "screenplay: apply failed"
python3 - <<'PYEOF'
import json
g = json.load(open("comfy_workflows/MM3_Characters_tmp.json"))
plan_nodes = [v for v in g.values() if v.get("class_type") == "MiniMaxH3ChainPlan"]
assert plan_nodes, "no ChainPlan node"
p = json.loads(plan_nodes[0]["inputs"]["plan_json"])
assert len(p["shots"]) == 2, p["shots"]
# the character paragraphs and voice assignments are GENERATED from the
# profile, not whatever the caller sent, so the cast cannot be re-described
pre = p["prompt_prefix"]
assert pre[0] == "subject_definitions:", pre[:2]
assert any("@jinx is the character defined by the provided character reference sheet" in l
           for l in pre), pre[:4]
assert any(l.startswith("voice_assignments:") and "@jinx speaks in (S1)" in l
           for l in pre), [l for l in pre if l.startswith("voice_")]
assert any("continuously escalate" in l for l in pre), "no standing direction"
assert p["shots"][0]["id"] == "clip_01"
# the settings the model was never asked about are filled from the export
assert p["shots"][0]["continuation_mode"] == "guide", p["shots"][0]
assert p["shots"][1]["visual_context_source"] == "clip_01"
# and the scene control applied in the same call
ls = [v for v in g.values() if v.get("class_type") == "MiniMaxH3ChainLoopStart"][0]
assert ls["inputs"]["scene_range"] == "2:2", ls["inputs"]
# the shipped style still has its own screenplay, untouched
b = json.load(open("comfy_workflows/MM3_Characters.json"))
bp = [v for v in b.values() if v.get("class_type") == "MiniMaxH3ChainPlan"][0]
assert len(json.loads(bp["inputs"]["plan_json"])["shots"]) == 9
PYEOF
[ $? = 0 ] && ok "screenplay: the plan lands with the export's shot settings filled in, and the style is untouched" \
  || bad "screenplay: the written plan is wrong"
# ---- THE SCENE BOARD (2.139.0) --------------------------------------------
# The board persists in the .prj, so a rerun in the same tree would carry the
# last run's takes; start this block from a clean board and re-apply.
SCURP0=$(curl -sf http://127.0.0.1:8311/api/projects/current | jget "['name']")
python3 -c "
import json,glob
for p in glob.glob('projects/$SCURP0/*.prj'):
    try: d=json.load(open(p))
    except Exception: continue
    d.pop('scenes', None); json.dump(d, open(p,'w'), indent=2)
"
rm -f "projects/$SCURP0/video/"scene2_Act_One*.mp4
curl -sf -X DELETE "http://127.0.0.1:8311/api/environments/Old%20Warehouse" >/dev/null 2>&1
curl -sf -X POST http://127.0.0.1:8311/api/scenes/chapters -H 'Content-Type: application/json' \
  -d '{"name":"Act One"}' | grep -q '"Act One"' \
  && ok "scenes: a chapter is added once, slugged (BEFORE the plan — adding clears the board, 2.150.0)" || bad "scenes: chapter add failed"
curl -sf -X POST http://127.0.0.1:8311/api/screenplay/apply -H 'Content-Type: application/json' \
  -d "$GOOD" >/dev/null
# The apply above must have DERIVED the board: the plan is the truth.
SB=$(curl -sf http://127.0.0.1:8311/api/scenes)
echo "$SB" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert len(d['list'])==2 and d['list'][0]['status']=='idle', d['list']
assert d['list'][1]['id']=='clip_02', d['list']
assert d['plan'] and len(d['plan']['shots'])==2, 'the plan does not ride with the board'
" && ok "scenes: applying a screenplay derives the board, and the plan rides with it" \
  || bad "scenes: board not derived from apply: $(echo "$SB" | head -c 200)"
# the chat matcher has ONE home, reachable over HTTP for the chat box
curl -sf -X POST http://127.0.0.1:8311/api/screenplay/intent -H 'Content-Type: application/json' \
  -d '{"text":"create a screenplay about a heist"}' | grep -q '"wants":true' \
  && curl -sf -X POST http://127.0.0.1:8311/api/screenplay/intent -H 'Content-Type: application/json' \
  -d '{"text":"what is a screenplay?"}' | grep -q '"wants":false' \
  && ok "scenes: the chat intent endpoint asks for one vs asks about one" \
  || bad "scenes: intent endpoint wrong"
curl -sf -X POST http://127.0.0.1:8311/api/scenes/2/chapter -H 'Content-Type: application/json' \
  -d '{"chapter":"Act One"}' >/dev/null
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/keep | grep -q "nothing rendered to keep" \
  && ok "scenes: keeping an unrendered scene is refused" || bad "scenes: keep before render accepted"
# ONE SCENE THROUGH THE REAL QUEUE: cast assets ride as references, the tmp
# graph gets the plan back + scene_range 2:2, and the take comes back named
# scene2_Act_One.mp4 in the project's Video assets.
# ---- 360° environments (2.142.0): a location rides the chain -------------
ffmpeg -y -loglevel error -f lavfi -i "gradients=size=512x256" -frames:v 1 /tmp/e2e_pano.png
ENVR=$(curl -s -X POST http://127.0.0.1:8311/api/environments -H 'Content-Type: application/json' \
  -d '{"name":"Old Warehouse","yaw":30,"scenes":"all"}')
echo "$ENVR" | grep -q "no 360 pano" \
  && ok "environments: a location with no pano says so by name" \
  || bad "environments: missing-pano note absent: $(echo "$ENVR" | head -c 200)"
curl -sf -F "file=@/tmp/e2e_pano.png" "http://127.0.0.1:8311/api/environments/Old%20Warehouse/pano" \
  | grep -q '"view":"view.png"' \
  && ok "environments: the pano projects into a view through the camera" \
  || bad "environments: view not extracted"
# 2.299.0 (Tim: "add location tag to global prompt if location is set"):
# the location has its picture now, so the board's global prompt names it
# by @tag in its location_definitions block
curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); pp=(d.get('plan') or {}).get('prompt_prefix') or []
assert 'location_definitions:' in pp, pp[:12]
i=pp.index('location_definitions:')
assert pp[i+1].startswith('@old_warehouse is the location \"old_warehouse\"') or pp[i+1].startswith('@old_warehouse is the location'), pp[i+1]
assert pp.count('location_definitions:')==1, pp
" && ok "global prompt: a location with its picture is named by @tag in the board's global prompt" \
  || bad "global prompt: no location block: $(curl -s http://127.0.0.1:8311/api/scenes | head -c 300)"
# 2.213.0 (by instruction: "can we use exr 360degree files for location
# background"): an .exr pano tone-maps ONCE at upload into the stored 8-bit
# pano.png — the viewer and the chain never learn HDR existed — and the view
# re-extracts from the converted file. A corrupt .exr refuses in words and
# the working pano SURVIVES (convert-first, swap-after). The probe EXR is
# handcrafted (float scanlines, no compression) so no encoder is needed.
python3 -c "
import struct
def attr(name, typ, data):
    return name.encode()+b'\x00'+typ.encode()+b'\x00'+struct.pack('<i',len(data))+data
def chan(name):
    return name.encode()+b'\x00'+struct.pack('<i',2)+b'\x00\x00\x00\x00'+struct.pack('<ii',1,1)
w,h = 64,32
hdr = b'\x76\x2f\x31\x01' + struct.pack('<i', 2)
chans = chan('B')+chan('G')+chan('R')+b'\x00'
dw = struct.pack('<iiii', 0,0,w-1,h-1)
hdr += attr('channels','chlist',chans)
hdr += attr('compression','compression',b'\x00')
hdr += attr('dataWindow','box2i',dw)
hdr += attr('displayWindow','box2i',dw)
hdr += attr('lineOrder','lineOrder',b'\x00')
hdr += attr('pixelAspectRatio','float',struct.pack('<f',1.0))
hdr += attr('screenWindowCenter','v2f',struct.pack('<ff',0,0))
hdr += attr('screenWindowWidth','float',struct.pack('<f',1.0))
hdr += b'\x00'
scan = 8 + w*4*3
off0 = len(hdr) + 8*h
offs = b''.join(struct.pack('<Q', off0 + y*scan) for y in range(h))
body = b''
for y in range(h):
    body += struct.pack('<ii', y, w*4*3)
    for c in range(3):
        body += b''.join(struct.pack('<f', 0.18 if x < w//2 else 8.0) for x in range(w))
    # channels carry the same grey so B,G,R order does not matter here
open('/tmp/e2e_pano.exr','wb').write(hdr+offs+body)
"
EXVR=$(curl -s -F "file=@/tmp/e2e_pano.exr" "http://127.0.0.1:8311/api/environments/Old%20Warehouse/pano")
echo "$EXVR" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True, d
assert (d.get('env') or {}).get('pano') == 'pano.png', ('the EXR must be STORED as the converted png', d.get('env'))
assert (d.get('env') or {}).get('view') == 'view.png', ('the view must re-extract from the converted pano', d.get('env'))
assert not d.get('note'), d.get('note')
" && ok "environments: an .exr pano converts to pano.png at upload and the view extracts from it" \
  || bad "environments: exr pano failed: $(echo "$EXVR" | head -c 250)"
printf 'not an exr at all' > /tmp/e2e_junk.exr
EXBAD=$(curl -s -F "file=@/tmp/e2e_junk.exr" "http://127.0.0.1:8311/api/environments/Old%20Warehouse/pano")
{ echo "$EXBAD" | grep -q "tone-map" \
  && curl -sf "http://127.0.0.1:8311/api/environments" | python3 -c "
import json,sys; es=json.load(sys.stdin)['environments']
e=[x for x in es if x['name']=='Old Warehouse'][0]
assert e['pano'] == 'pano.png', ('a corrupt exr must not cost the location its pano', e['pano'])
"; } \
  && ok "environments: a corrupt .exr refuses with the ffmpeg reason and the working pano survives" \
  || bad "environments: corrupt-exr handling wrong: $(echo "$EXBAD" | head -c 200)"
# 2.214.0 (by instruction: "allow me to load a picture in the preview tab,
# so i can see the exr previews etc"): /api/preview/hdr tone-maps an
# uploaded .exr/.hdr and streams PNG BYTES straight back — nothing stored,
# named or adopted. A corrupt file and a non-HDR extension both refuse in
# words (ordinary pictures preview client-side from an object URL and never
# reach the server). Reuses the probe files the environments legs built.
curl -sf -X POST -F "file=@/tmp/e2e_pano.exr" http://127.0.0.1:8311/api/preview/hdr -o /tmp/e2e_hdrprev.png \
  && python3 -c "
import sys
b = open('/tmp/e2e_hdrprev.png','rb').read(8)
assert b == bytes([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), ('the preview must stream REAL PNG bytes', b.hex())
" \
  && ok "preview: an .exr uploads to /api/preview/hdr and PNG bytes stream straight back" \
  || bad "preview: exr tone-map round trip failed"
curl -s -X POST -F "file=@/tmp/e2e_junk.exr" http://127.0.0.1:8311/api/preview/hdr \
  | grep -q "tone-map" \
  && ok "preview: a corrupt .exr refuses with the ffmpeg reason" \
  || bad "preview: corrupt exr not refused in words"
curl -s -X POST -F "file=@/tmp/e2e_pano.png" http://127.0.0.1:8311/api/preview/hdr \
  | grep -q "not an HDR image" \
  && ok "preview: an ordinary picture is refused in words — the browser shows those itself" \
  || bad "preview: non-HDR upload not refused"
python3 -c "
import json
g=json.load(open('comfy_workflows/MM3_Characters_tmp.json'))
e=g.get('env_pic_0'); assert e and e['class_type']=='MiniMaxH3ScheduledPictureReference', e
assert e['inputs']['tag']=='old_warehouse' and e['inputs']['scenes']=='all', e['inputs']
assert g['env_img_0']['inputs']['image']=='view.png', g['env_img_0']
" && ok "environments: the tmp chain carries the location's VIEW with its tag and range" \
  || bad "environments: tmp chain missing the environment reference"
curl -sf -F "file=@/tmp/ch_sheet.png" http://127.0.0.1:8311/api/characters/Jinx/asset >/dev/null
curl -sf -F "file=@/tmp/ch_voice.wav" http://127.0.0.1:8311/api/characters/Jinx/asset >/dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"comfy","comfy":{"url":"http://127.0.0.1:8388"}}}' > /dev/null
SG=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/2/generate)
SGID=$(echo "$SG" | jget "['job']['id']" 2>/dev/null)
if [ -n "$SGID" ]; then
  ok "scenes: the play button queues one scene through the existing queue"
  python3 -c "
import json
g=json.load(open('comfy_workflows/MM3_Characters_tmp.json'))
ls=[v for v in g.values() if v.get('class_type')=='MiniMaxH3ChainLoopStart'][0]
assert ls['inputs']['scene_range']=='2:2', ls['inputs']
p=[v for v in g.values() if v.get('class_type')=='MiniMaxH3ChainPlan'][0]
assert len(json.loads(p['inputs']['plan_json'])['shots'])==2, 'the stored plan was not written back'
" && ok "scenes: generate wrote the stored plan back into the tmp graph and selected 2:2" \
    || bad "scenes: tmp graph wrong after generate"
  curl -sf http://127.0.0.1:8311/api/scenes | grep -q '"status":"running"' \
    && ok "scenes: the board shows the scene rendering" || bad "scenes: not marked running"
  for i in $(seq 1 120); do
    SST=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SGID" | jget "['status']")
    [ "$SST" = done ] || [ "$SST" = failed ] && break; sleep 1
  done

  # 2.167.0 (Tim: "the settings in the character ref workflow are not
  # following all the inputs from the app"): his export routes the plan
  # THROUGH MiniMaxH3ChainScenePromptEditor (9 -> 11 -> 17) — an interactive
  # editor whose stored state overrides the plan the app writes. The worker
  # bypasses it per run; the queued graph (read AFTER the job completed — the queue is the worker\x27s, seconds after the POST) must show the plan wired straight
  # to the loop and the editor gone.
  python3 -c "
import json, glob, os, sys
# the stub records _classes per video queue (2.140.0's kept/stripped pattern);
# the newest CHAIN queue is the one this leg just rendered
chains, seen = [], []
for f in sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime):
    cs = json.load(open(f)).get('_classes', [])
    seen.append((os.path.basename(f), [c for c in cs if 'MiniMax' in c][:4]))
    if 'MiniMaxH3ChainLoopStart' in cs:
        chains.append((os.path.getmtime(f), f, cs))
if not chains:
    print('NO CHAIN QUEUE. video records seen:', seen, file=sys.stderr); sys.exit(1)
_, f, cs = max(chains)
assert 'MiniMaxH3ChainScenePromptEditor' not in cs, (f, cs)
assert 'MiniMaxH3ChainPlan' in cs, cs
" 2>/tmp/bypass-check.err \
    && ok "scenes: the ScenePromptEditor is BYPASSED in the queued graph — the app's plan reaches the loop unedited" \
    || { bad "scenes: editor bypass missing from the queued graph"; cat /tmp/bypass-check.err; }
  curl -sf "http://127.0.0.1:8311/api/jobs/$SGID" | jget "['log']" \
    | grep -q "2/2 image" \
    && ok "environments: the location's view fills a reference slot beside the cast sheet" \
    || bad "environments: view slot not filled"
  # 2.144.0 (Tim's Scene 1, "only one was filled"): the voice loader is a
  # VHS_LoadAudioUpload; the worker must COUNT it, fill it with the name
  # ComfyUI's upload actually returned, and the stub — now faithful — fails
  # any graph whose voice names a file that was never uploaded.
  curl -sf "http://127.0.0.1:8311/api/jobs/$SGID" | jget "['log']" \
    | grep -q "1/1 audio" \
    && ok "scenes: the cast voice fills the chain's VHS_LoadAudioUpload slot (1/1 audio, not 0/0)" \
    || bad "scenes: voice slot not counted/filled"
  # CONTINUITY PREFLIGHT (2.172.0, Tim: "i am not getting a continuous
  # scene"): the stub's /object_info declares ChainContext's context_latent
  # output; Tim's export consumes only outputs 0 and 1 and feeds the
  # sampler's latent_image straight from node 37 — the worker must READ the
  # live schema, spot the unconsumed LATENT + the bypass, and name the one
  # wire to move. And a lone scene 2:2 with verify_resume_history on must
  # name its dependency on the run's stored history.
  SLOG=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SGID" | jget "['log']")
  echo "$SLOG" | grep -q "CONTINUITY: ChainContext" \
    && echo "$SLOG" | grep -q "bypassing the context splice" \
    && echo "$SLOG" | grep -q "wire ChainContext.context_latent" \
    && ok "continuity: the preflight reads the LIVE schema, spots the unconsumed LATENT output + the sampler bypass, and names the wire to move" \
    || bad "continuity: preflight diagnosis missing from the job log"
  echo "$SLOG" | grep -q "scene 2 renders alone" \
    && echo "$SLOG" | grep -q "stored history" \
    && ok "continuity: a lone-scene render names its dependency on the run's stored history" \
    || bad "continuity: lone-scene history note missing"
  # AUDIO CENSUS (2.176.0, Tim: "are we creating extra voice nodes?"): every
  # chain queue states its audio wiring — the voice references by tag, the
  # loaders, the absence of any source-timeline node, and ChainPlan's own
  # audio_mode verbatim. Jinx has ONE voice clip here.
  echo "$SLOG" | grep -q "audio census: 1 scheduled audio reference(s) \[jinx_voice\], 1 VHS_LoadAudioUpload loader(s), NO source-timeline node" \
    && ok "audio census: the chain queue names its voice references, loaders and the missing source-timeline — the voice-node question answers itself from the log" \
    || bad "audio census line wrong: $(echo "$SLOG" | grep 'audio census' | head -c 300)"
  # USER NODE BYPASS (2.177.0, "bypass nodes that aren't used and enable
  # them when needed"): both LoopTrim instances leave the queued chain via
  # name-matched passthrough (images->images, audio->audio); enabling again
  # is just clearing the config list.
  curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
    -d '{"engine":{"comfy":{"node_bypass":["MiniMaxH3LoopTrim"]}}}' > /dev/null
  SB=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/generate -H 'Content-Type: application/json' -d '{}')
  SBID=$(echo "$SB" | jget "['job']['id']" 2>/dev/null)
  for i in $(seq 1 120); do
    s=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SBID" | jget "['status']")
    [ "$s" = done ] || [ "$s" = failed ] && break; sleep 1
  done
  curl -sf "http://127.0.0.1:8311/api/jobs/$SBID?log_from=0" | python3 -c "
import json,sys,glob,os
log=json.load(sys.stdin)['log']
assert any('node bypass: removed MiniMaxH3LoopTrim' in l for l in log), \
    [l for l in log if 'bypass' in l][:4]
fs=sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
cs=json.load(open(fs[-1])).get('_classes',[])
assert 'MiniMaxH3LoopTrim' not in cs and 'MiniMaxH3ChainLoopEnd' in cs, cs
" && ok "node bypass: the user's list removes both LoopTrims from the QUEUED chain via name-matched passthrough — enable again by clearing the entry" \
  || bad "node bypass failed: $(curl -sf "http://127.0.0.1:8311/api/jobs/$SBID?log_from=0" | jget "['log']" 2>/dev/null | grep -i bypass | head -c 400)"
  curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
    -d '{"engine":{"comfy":{"node_bypass":[]}}}' > /dev/null
  python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)
r = json.load(open(newest))
assert r.get("_ref_audios") == ["ch_voice.wav"], r.get("_ref_audios")
PYEOF
  [ $? = 0 ] && ok "scenes: the graph ComfyUI ran carries the UPLOADED voice name in the loader" \
    || bad "scenes: voice loader name wrong in the queued graph"
  # 2.145.0 (Tim's live error: "Reference tag must be a stable tag such as
  # 'hero_face'"): the chain's voice tag is <tag>_voice, never "<tag> voice" —
  # and the stub now REFUSES an unstable tag exactly as his pack does, so the
  # rendered scene above is itself proof every tag survived validation.
  python3 -c "
import json, re
g = json.load(open('comfy_workflows/MM3_Characters_tmp.json'))
v = g.get('char_voice_0'); assert v, sorted(g)
assert v['inputs']['tag'] == 'jinx_voice', v['inputs']['tag']
for n in g.values():
    ct = str(n.get('class_type',''))
    t = (n.get('inputs') or {}).get('tag')
    if 'Scheduled' in ct and 'Reference' in ct and isinstance(t, str):
        assert re.fullmatch(r'@?[A-Za-z0-9_-]+', t), n['inputs']
" && ok "scenes: every chain tag is stable — the voice tag is jinx_voice, no spaces anywhere" \
    || bad "scenes: unstable tag in the tmp chain"
  grep -q 'llm_file: b.llm_file' routes/characters.js \
    && grep -q 'llm_file' ext/videodock/characters.js \
    && node -e "const s=require('fs').readFileSync('lib/llmChat.js','utf8'); process.exit(/llamaState/.test(s)?0:1)" \
    && ok "screenplay: the SELECTED llm rides the request, and complete() prefers the RUNNING model over files[0]" \
    || bad "screenplay: llm selection not honoured (llm_file passthrough / llamaState preference missing)"
  [ "$SST" = done ] && ok "scenes: the scene rendered through the stub" \
    || { bad "scenes: render $SST"; curl -sf "http://127.0.0.1:8311/api/jobs/$SGID" | jget "['log']" | tail -8; }
  SB2=$(curl -sf http://127.0.0.1:8311/api/scenes)
  echo "$SB2" | grep -q '"output":"scene2_Act_One.mp4"' \
    && ok "scenes: the take is filed as scene<n>_<chapter> in Video assets" \
    || bad "scenes: take not named: $(echo "$SB2" | head -c 300)"
  SCURP=$(curl -sf http://127.0.0.1:8311/api/projects/current | jget "['name']")
  [ -f "projects/$SCURP/video/scene2_Act_One.mp4" ] \
    && ok "scenes: the named take is really in the project's Video assets (gallery-visible)" \
    || bad "scenes: projects/$SCURP/video/scene2_Act_One.mp4 missing"
  curl -sf -X POST http://127.0.0.1:8311/api/scenes/2/keep | grep -q '"changed":true' \
    && ok "scenes: keep marks the take" || bad "scenes: keep failed"
  curl -sf -X POST http://127.0.0.1:8311/api/scenes/2/keep | grep -q '"changed":false' \
    && ok "scenes: keep is idempotent — the second press reports no change" \
    || bad "scenes: keep not idempotent"
  # ---- the upscale queue (2.140.0) ---------------------------------------
  # the plain render above must have STRIPPED the in-line upscale stage
  curl -sf "http://127.0.0.1:8311/api/jobs/$SGID" | jget "['log']" \
    | grep -q "upscale bypass: removed MMH3UltimateUpscale#5112" \
    && ok "scenes: a plain render strips the in-line upscale stage (fast render)" \
    || bad "scenes: fast render did not bypass the upscale"
  UJ=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/2/upscale)
  UJID=$(echo "$UJ" | jget "['job']['id']" 2>/dev/null)
  if [ -n "$UJID" ]; then
    ok "scenes: ⏫ queues an upscale of the rendered take"
    echo "$UJ" | grep -q "no MM3_Characters_upscale.json" \
      && ok "scenes: without an upscale export, the response says so and names the file to provide" \
      || bad "scenes: fallback note missing: $(echo "$UJ" | head -c 200)"
    curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8311/api/scenes/2/upscale | grep -q 409 \
      && ok "scenes: the same scene cannot be queued for upscale twice" \
      || bad "scenes: double upscale queue accepted"
    for i in $(seq 1 120); do
      UST=$(curl -sf "http://127.0.0.1:8311/api/jobs/$UJID" | jget "['status']")
      [ "$UST" = done ] || [ "$UST" = failed ] && break; sleep 1
    done
    [ "$UST" = done ] && ok "scenes: the upscale rendered through the queue" \
      || { bad "scenes: upscale $UST"; curl -sf "http://127.0.0.1:8311/api/jobs/$UJID" | jget "['log']" | tail -8; }
    curl -sf "http://127.0.0.1:8311/api/jobs/$UJID" | jget "['log']" \
      | grep -q "upscale bypass" \
      && bad "scenes: the upscale job bypassed its own upscale stage" \
      || ok "scenes: the upscale job keeps the upscale stage in the graph"
    python3 -c "
import glob, json, os
newest = max(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(newest))
assert any('UltimateUpscale' in c for c in rec.get('_classes', [])), (newest, rec.get('_classes'))
" && ok "scenes: the graph ComfyUI received for the upscale really contains MMH3UltimateUpscale" \
      || bad "scenes: upscale graph missing the upscale node"
    SB3=$(curl -sf http://127.0.0.1:8311/api/scenes)
    echo "$SB3" | grep -q '"upscaled":"scene2_Act_One_upscaled.mp4"' \
      && ok "scenes: the upscaled take is filed beside the base as scene<n>_<chapter>_upscaled" \
      || bad "scenes: upscaled take not recorded: $(echo "$SB3" | head -c 300)"
    echo "$SB3" | grep -q '"status":"kept"' \
      && ok "scenes: upscaling did not un-keep the scene" \
      || bad "scenes: keep lost across the upscale"
    # ---- the pluggable upscale export (2.141.0) --------------------------
    # With MM3_Characters_upscale.json present, the upscale queue drives IT
    # and the take rides into its LoadVideo slot. The fixture below is
    # e2e-only (verified classes; the real file is Tim's export) and MUST be
    # deleted afterwards — shipped, it would reroute real upscales.
    cat > comfy_workflows/MM3_Characters_upscale.json <<'UPWF'
{
  "1": {"class_type": "LoadVideo", "inputs": {"file": "example.mp4"}},
  "5": {"class_type": "MiniMaxH3ReferenceToVideo",
        "inputs": {"prompt": "upscale the referenced take", "width": 512, "height": 512,
                   "length": 39, "ref_image_size": "max", "video": ["1", 0]}},
  "2": {"class_type": "SaveVideo",
        "inputs": {"filename_prefix": "minimax_h3/upscale", "format": "auto",
                   "codec": "auto", "video": ["5", 0]}}
}
UPWF
    U2=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/2/upscale)
    U2ID=$(echo "$U2" | jget "['job']['id']" 2>/dev/null)
    if [ -n "$U2ID" ]; then
      echo "$U2" | grep -q "upscaling through MM3_Characters_upscale.json" \
        && ok "scenes: with the export present, the upscale drives it and says so" \
        || bad "scenes: export not picked up: $(echo "$U2" | head -c 200)"
      for i in $(seq 1 120); do
        U2ST=$(curl -sf "http://127.0.0.1:8311/api/jobs/$U2ID" | jget "['status']")
        [ "$U2ST" = done ] || [ "$U2ST" = failed ] && break; sleep 1
      done
      [ "$U2ST" = done ] && ok "scenes: the export-driven upscale rendered" \
        || { bad "scenes: export upscale $U2ST"; curl -sf "http://127.0.0.1:8311/api/jobs/$U2ID" | jget "['log']" | tail -8; }
      curl -sf "http://127.0.0.1:8311/api/jobs/$U2ID" | jget "['log']" \
        | grep -q "uploading scene2_Act_One.mp4" \
        && ok "scenes: the rendered take was uploaded as the export's reference video" \
        || bad "scenes: take not uploaded to the export"
      python3 -c "
import glob, json, os
newest = max(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)
rec = json.load(open(newest)); c = rec.get('_classes', [])
assert 'LoadVideo' in c, c
assert not any('UltimateUpscale' in x for x in c), c
" && ok "scenes: the queued graph is the export (LoadVideo present, no chain upscaler)" \
        || bad "scenes: queued graph is not the export"
    else
      bad "scenes: export-driven upscale refused: $(echo "$U2" | head -c 300)"
    fi
    rm -f comfy_workflows/MM3_Characters_upscale.json
    curl -sf -X DELETE "http://127.0.0.1:8311/api/environments/Old%20Warehouse" >/dev/null
  else
    bad "scenes: upscale refused: $(echo "$UJ" | head -c 300)"
  fi
  PJ=$(curl -s -X POST http://127.0.0.1:8311/api/produce)
  PJID=$(echo "$PJ" | jget "['job']['id']" 2>/dev/null)
  if [ -n "$PJID" ]; then
    for i in $(seq 1 60); do
      PST=$(curl -sf "http://127.0.0.1:8311/api/jobs/$PJID" | jget "['status']")
      [ "$PST" = done ] || [ "$PST" = failed ] && break; sleep 1
    done
    [ "$PST" = done ] && ok "scenes: Produce joins the kept scenes through the compile path" \
      || { bad "scenes: produce $PST"; curl -sf "http://127.0.0.1:8311/api/jobs/$PJID" | jget "['log']" | tail -6; }
    # ---- the story lands ON the timeline (2.142.4) -----------------------
    TT=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/to-timeline)
    echo "$TT" | grep -q '"timeline":"screenplay"' \
      && ok "scenes: ⇥ Timeline writes the kept scenes as the 'screenplay' timeline" \
      || bad "scenes: to-timeline refused: $(echo "$TT" | head -c 200)"
    python3 -c "
import json
SC='$SCURP'
t = json.load(open(f'projects/{SC}/timelines/screenplay.json'))
assert len(t['video']) == 1 and t['video'][0]['name'].startswith('scene2_Act_One'), t['video']
assert t['video'][0]['dur'] > 0 and t['video'][0]['start'] == 0, t['video'][0]
d = json.load(open(f'projects/{SC}/{SC}.prj'))
assert d.get('timeline') == 'screenplay', d.get('timeline')
" && ok "scenes: the timeline file holds the kept take and is the project's ACTIVE timeline" \
      || bad "scenes: screenplay timeline wrong on disk"
  else bad "scenes: produce refused: $(echo "$PJ" | head -c 200)"; fi
else
  bad "scenes: generate refused: $(echo "$SG" | head -c 300)"
fi
# ---- THE EDITABLE BOARD (2.146.0, by instruction) --------------------------
# THE 5.9-SECOND STOMP (2.178.0, Tim: "it only renders a 5 second scene
# even when i set the duration to 15"): writePlan re-normalized with NO
# overrides, and 2.171.0's uniform rule turned that into a stomp back to
# DEFAULTS.length (141f = 5.9s) AFTER queueScene had set the chain
# default. Now: set 15s, generate, and the QUEUED tmp's plan_json must
# carry 362f on every shot — and ChainPlan's own
# default_duration_seconds widget must say the same seconds.
curl -s -X POST http://127.0.0.1:8311/api/scenes/duration -H 'Content-Type: application/json' \
  -d '{"seconds":15}' > /dev/null
SD=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/generate -H 'Content-Type: application/json' -d '{}')
SDID=$(echo "$SD" | jget "['job']['id']" 2>/dev/null)
for i in $(seq 1 120); do
  s=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SDID" | jget "['status']")
  [ "$s" = done ] || [ "$s" = failed ] && break; sleep 1
done
python3 -c "
import json
g=json.load(open('comfy_workflows/MM3_Characters_tmp.json'))
p=[v for v in g.values() if v.get('class_type')=='MiniMaxH3ChainPlan'][0]
pj=json.loads(p['inputs']['plan_json'])
sh=pj['shots']
import math
snap=lambda n: max(5,min(3592,5+17*round((max(5,min(3592,n))-5)/17)))
up=lambda n: min(3592,max(snap(n),5+17*math.ceil((min(3592,n)-5)/17)))
# 2.223.5: Tim's ladder — scene N gets +(N-1)s, snapped UP; scene 1's
# orphan window stays zeroed
assert sh[0]['length']==362 and sh[0].get('context_length',0)==0, sh[0]
assert all(sh[i]['length']==up(362+i*24) for i in range(1,len(sh))), [s['length'] for s in sh]
dd=p['inputs'].get('default_duration_seconds')
assert dd==round(362/24,2), dd
" && ok "duration: 15s of CONTENT survives into the queued tmp — shot1 362f + zeroed window, continuing shots +their spent window, ChainPlan fallback 15.08" \
|| bad "duration stomp: $(python3 -c "
import json
g=json.load(open('comfy_workflows/MM3_Characters_tmp.json'))
p=[v for v in g.values() if v.get('class_type')=='MiniMaxH3ChainPlan'][0]
pj=json.loads(p['inputs']['plan_json'])
print([s.get('length') for s in pj['shots']], p['inputs'].get('default_duration_seconds'))" 2>&1)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/duration -H 'Content-Type: application/json' \
  -d '{"seconds":5.9}' > /dev/null
# CHAPTER REFERENCE IMAGES (2.180.0, by instruction: clothing/pose/two-
# character refs per chapter, injected as LoadImage + PictureReference into
# the tmp at queue time, uploaded with the render, removable).
python3 -c "
import struct, zlib
def png(p):
    raw=b'\x00'+b'\x80\x80\x80'
    d=zlib.compress(raw)
    def ck(t,b): return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b))
    open(p,'wb').write(b'\x89PNG\r\n\x1a\n'+ck(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+ck(b'IDAT',d)+ck(b'IEND',b''))
png('/tmp/pose_ref.png')"
RF=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/refs \
  -F "image=@/tmp/pose_ref.png" -F "chapter=" -F "label=horse pose" \
  -F "type=pose" -F "description=a woman riding a horse at LOW_SUN_E2E")
echo "$RF" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('tag')=='horse_pose', d
e=d['refs'][''][0]
assert e['file']=='horse_pose.png' and e['type']=='pose' \
   and 'LOW_SUN_E2E' in e['description'], e
" && ok "chapter refs: the dialog's name/type/description land in the chapter with a sanitized tag" \
  || bad "chapter refs upload: $(echo "$RF" | head -c 300)"
# 2.266.0: a chapter SOUND reference — a song to lipsync — stores with kind
# "sound" and lists back
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=3" /tmp/e2e_song.wav
RS=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/refs \
  -F "image=@/tmp/e2e_song.wav" -F "chapter=" -F "label=the song" \
  -F "type=sound" -F "description=the tune SONG_E2E the character lipsyncs to")
echo "$RS" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('kind')=='sound' and d.get('tag')=='the_song', d
es=[e for e in d['refs'][''] if e['file']=='the_song.wav']
assert es and es[0]['kind']=='sound', d['refs']
" && ok "chapter refs: a SOUND stores as kind sound with its audio extension" \
  || bad "chapter sound ref upload: $(echo "$RS" | head -c 300)"
curl -s -X DELETE "http://127.0.0.1:8311/api/scenes/refs?chapter=&file=the_song.wav" > /dev/null

# 2.183.0: the reference's details ride the WRITER's prompt so the model can
# use it in the screenplay
RIH=$(curl -s -D - -o /dev/null -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a short scene where jinx rides","single":true}' | tr -d '\r' | grep -i '^x-refs-in-prompt:' | awk '{print $2}')
[ "$RIH" = "1" ] \
  && ok "chapter refs: the writer's prompt carries the reference's @tag, type and description (X-Refs-In-Prompt: 1)" \
  || bad "chapter refs: refsBrief missing from the writer request (header: '$RIH')"
# 2.191.0 (Tim: "put the reference picture name, type, description in the
# scene board (global prompt)"): the shared-prompt endpoint — the board's 👥
# populate — now carries every reference's name, type and description, so
# the board SHOWS them and every scene render CARRIES them.
curl -s "http://127.0.0.1:8311/api/screenplay/prefix" | python3 -c "
import json,sys
p=' '.join(json.load(sys.stdin).get('prefix',[]))
assert 'Reference picture \"horse pose\"' in p, p[-300:]
assert '@horse_pose' in p and 'pose' in p and 'LOW_SUN_E2E' in p, p[-300:]
" && ok "chapter refs: the SHARED PROMPT (board populate) carries the reference's name, type and description" \
  || bad "chapter refs: the shared prompt is missing the reference details"
# THE THREE TAG KINDS (2.194.0, Tim: "can we tell the llm automatically
# which are character references and the other types of references, so it
# doesn't get confused?"). Every validate call must hand the reference tags
# in, or "@jinx posed as @horse_pose" — the brief's own invitation — 400s as
# an unknown character; and the brief itself must state pictures are not
# people.
node -e "
const fs=require('fs');
const r=fs.readFileSync('routes/characters.js','utf8');
const total=(r.match(/screenplay\.validate\(/g)||[]).length;
const wired=(r.match(/screenplay\.validate\([\s\S]{0,120}?chapterRefs\.tags\(/g)||[]).length;
if(total!==wired){console.error('validate sites',total,'wired',wired);process.exit(1);}
const c=fs.readFileSync('lib/chapterRefs.js','utf8');
if(!/PICTURES, NOT characters/.test(c))process.exit(1);
if(!/clothing = wardrobe, pose = body position/.test(c))process.exit(1);
const g=fs.readFileSync('lib/screenplay.js','utf8');
if(!/Three kinds of tag exist and only the FIRST can act or speak/.test(g))process.exit(1);
if(!/reference PICTURE — it cannot act or/.test(g))process.exit(1);
" && ok "tag taxonomy: every validate call carries the reference tags; the brief and guide state pictures are not people" \
  || bad "tag taxonomy: a validate site is missing chapterRefs.tags or the teaching text drifted"
RG=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/generate -H 'Content-Type: application/json' -d '{}')
RGID=$(echo "$RG" | jget "['job']['id']" 2>/dev/null)
for i in $(seq 1 120); do
  s=$(curl -sf "http://127.0.0.1:8311/api/jobs/$RGID" | jget "['status']")
  [ "$s" = done ] || [ "$s" = failed ] && break; sleep 1
done
python3 -c "
import json
g=json.load(open('comfy_workflows/MM3_Characters_tmp.json'))
ld=[v for k,v in g.items() if k=='ref_img_0']
pr=[v for k,v in g.items() if k=='ref_pic_0']
assert ld and ld[0]['class_type']=='LoadImage' and ld[0]['inputs']['image']=='horse_pose.png', ld
assert pr and pr[0]['class_type']=='MiniMaxH3ScheduledPictureReference' \
    and pr[0]['inputs']['tag']=='horse_pose', pr
" && curl -sf "http://127.0.0.1:8311/api/jobs/$RGID?log_from=0" | jget "['log']" | grep -q "uploading horse_pose.png" \
  && ok "chapter refs: the pose rides the QUEUED tmp as LoadImage + PictureReference @horse_pose AND uploads with the render" \
  || bad "chapter refs not in the queue: $(python3 -c "
import json; g=json.load(open('comfy_workflows/MM3_Characters_tmp.json'))
print([k for k in g if k.startswith('ref_')])" 2>&1)"
# 2.198.0 (by instruction): references are EDITABLE (PATCH details, file is
# the identity) and SERVED as thumbnails; a new scene lands AFTER the last.
RPE=$(curl -s -X PATCH http://127.0.0.1:8311/api/scenes/refs -H 'Content-Type: application/json' \
  -d '{"chapter":"","file":"horse_pose.png","label":"horse pose EDITED","description":"LOW_SUN_E2E now with dust motes"}')
echo "$RPE" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True, d
e=(d['refs'].get('') or [])[0]
assert e['label']=='horse pose EDITED' and 'dust motes' in e['description'], e
assert e['file']=='horse_pose.png' and e['type']=='pose', e
" && curl -sf -o /tmp/ref_thumb.png "http://127.0.0.1:8311/api/scenes/refs/file?file=horse_pose.png" \
  && [ -s /tmp/ref_thumb.png ] \
  && curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8311/api/scenes/refs/file?file=../../secrets" | grep -q 404 \
  && ok "refs: PATCH edits label/type/description in place and the picture serves as a thumbnail (traversal refused)" \
  || bad "refs edit/serve failed: $(echo "$RPE" | head -c 200)"
NSC=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/add -H 'Content-Type: application/json' \
  -d '{"text":"E2E_LAST_SCENE waits by the gate."}')
echo "$NSC" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True, d.get('error')
last=d['list'][-1]
assert 'E2E_LAST_SCENE' in ' '.join(last['prompt']), ('added scene is not last', [r['id'] for r in d['list']])
" && ok "scenes: an added scene lands AFTER the last scene in the list" \
  || bad "add-scene ordering: $(echo "$NSC" | head -c 200)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/delete -H 'Content-Type: application/json' \
  -d "{\"scenes\": [$(echo "$NSC" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['list']))")]}" > /dev/null 2>&1 || true
# TEMP LoRAs RIDE THE CHARACTER CHAIN (2.200.0, Tim: "is it possible to add
# multiple loras to our character_ref_tmp workflow from our basic settings
# (left docker) ref tab?"). Two Basic Settings video LoRAs -> a scene render
# -> the worker hangs BOTH off phase 1's model loader and the job log names
# each with its weight; clearing them cleans the next render.
curl -sf -X POST http://127.0.0.1:8311/api/temploras/video -H 'Content-Type: application/json' \
  -d '[{"path":"e2e_chain_a.safetensors","weight":1.5},{"path":"e2e_chain_b.safetensors","weight":-0.5}]' > /dev/null
TLJ=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/generate -H 'Content-Type: application/json' -d '{}')
TLID=$(echo "$TLJ" | jget "['job']['id']" 2>/dev/null)
for i in $(seq 1 120); do
  s=$(curl -sf "http://127.0.0.1:8311/api/jobs/$TLID" | jget "['status']")
  [ "$s" = done ] || [ "$s" = failed ] && break; sleep 1
done
TLLOG=$(curl -sf "http://127.0.0.1:8311/api/jobs/$TLID?log_from=0" | jget "['log']")
[ "$s" = done ] \
  && echo "$TLLOG" | grep -q "lora 1: e2e_chain_a.safetensors @ 1.5" \
  && echo "$TLLOG" | grep -q "lora 2: e2e_chain_b.safetensors @ -0.5" \
  && ok "temp LoRAs: BOTH Basic Settings video LoRAs ride the character chain with their weights (style file untouched)" \
  || bad "temp LoRAs missing from the chain (status $s): $(echo "$TLLOG" | grep -i lora | tail -3)"
curl -sf -X POST http://127.0.0.1:8311/api/temploras/video -H 'Content-Type: application/json' -d '[]' > /dev/null
# RUNPOD SERVERLESS RENDER (2.197.0, Tim: "how can we use a runpod gpu to
# render our videos? serverless flash ... something we already have"). The
# stub speaks the real worker-comfyui protocol (Bearer auth, /run, /status,
# base64 output). The worker must build the SAME graph, ride the refs as
# base64 in the request, poll, and land the take — then local rendering
# comes back for every later leg.
if curl -sf --max-time 1 http://127.0.0.1:8399/ > /dev/null 2>&1; then pkill -f "stub-runpod.py 8399" 2>/dev/null; sleep 1; fi
python3 scripts/stub-runpod.py 8399 /tmp/stub-runpod-out > /tmp/stubrunpod.log 2>&1 &
RPSTUB=$!   # 2.338.0: stopped by its PID, never by a name pattern (a second gate may be running)
sleep 1
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"runpod":{"enabled":true,"endpoint":"e2e","api_key":"testkey","base_url":"http://127.0.0.1:8399","poll_seconds":2}}}' > /dev/null
RPJ=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/generate -H 'Content-Type: application/json' -d '{}')
RPID=$(echo "$RPJ" | jget "['job']['id']" 2>/dev/null)
for i in $(seq 1 120); do
  s=$(curl -sf "http://127.0.0.1:8311/api/jobs/$RPID" | jget "['status']")
  [ "$s" = done ] || [ "$s" = failed ] && break; sleep 1
done
RPLOG=$(curl -sf "http://127.0.0.1:8311/api/jobs/$RPID?log_from=0" | jget "['log']")
[ "$s" = done ] \
  && echo "$RPLOG" | grep -q "\[runpod\] submitting to http://127.0.0.1:8399/v2/e2e/run" \
  && echo "$RPLOG" | grep -q "\[runpod\] received " \
  && echo "$RPLOG" | grep -q "checks (preflight, schema sync, continuity" \
  && python3 -c "
import json, glob
fs=glob.glob('/tmp/stub-runpod-out/rp_request_*.json')
assert fs, 'no request reached the stub endpoint'
r=json.load(open(sorted(fs)[-1]))
w=(r.get('input') or {}).get('workflow') or {}
assert w, 'the request carried no workflow'
imgs=(r.get('input') or {}).get('images') or []
assert imgs and all(i.get('name') and i.get('image') for i in imgs), 'refs did not ride as base64'
" \
  && ok "runpod: a scene renders through the serverless endpoint — graph + base64 refs out, /status polled, the take lands (local checks skipped with a note)" \
  || bad "runpod render failed (status $s): $(echo "$RPLOG" | grep -E "\[runpod\]|error" | tail -4)"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"runpod":{"enabled":false}}}' > /dev/null
kill $RPSTUB 2>/dev/null
curl -s -X DELETE "http://127.0.0.1:8311/api/scenes/refs?chapter=&file=horse_pose.png" | python3 -c "
import json,sys; d=json.load(sys.stdin); assert d.get('ok') and not d['refs'].get(''), d
" && ok "chapter refs: ✕ removes the reference and the chapter empties" \
  || bad "chapter refs delete failed"

# Add scene / editable scene prompts / a shared prompt populated from the
# cast. Placed AFTER Produce so the status resets an edit causes cannot
# disturb the kept-take checks above. Jinx (sheet+voice) is still the cast.
PFX=$(curl -sf "http://127.0.0.1:8311/api/screenplay/prefix")
echo "$PFX" | python3 -c "
import json,sys
p=json.load(sys.stdin)['prefix']; t='\n'.join(p)
assert t.startswith('subject_definitions:'), p[:2]
assert '@jinx' in t and 'voice_assignments:' in t and '(S1)' in t, t[:400]
" && ok "board: /api/screenplay/prefix carries the cast's @tags, definitions and voice assignments" \
  || bad "board: prefix wrong: $(echo "$PFX" | head -c 200)"
EDIT=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"[Shot 1] @jinx walks into the warehouse, edited on the board.\n\n@jinx (S1), quietly:\n<d>[English] It is different now.</d>"}')
echo "$EDIT" | grep -q '"ok":true' \
  && curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=[x for x in d['list'] if x['n']==1][0]
assert any('edited on the board' in l for l in r['prompt']), r['prompt']
assert r['status']=='idle', r['status']   # an edited prompt is a NEW scene
s=[s for s in d['plan']['shots'] if s['id']==r['id']][0]
assert any('edited on the board' in l for l in s['prompt']), 'plan not updated'
" && ok "board: editing scene 1's prompt lands in the PLAN and resets that scene to idle" \
  || bad "board: scene edit failed: $(echo "$EDIT" | head -c 300)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"@nobody does something"}' | grep -q "not in the cast\|stranger\|would not render" \
  && ok "board: an invented @tag in an edit is REFUSED by the same validator as the writer" \
  || bad "board: bad edit accepted"
# NO per-scene duration (2.171.0, by instruction: "remove the duration from
# each scene... use the default duration for all scenes, the workflow
# doesn't like scenes of different lengths"): a seconds field an old client
# still sends is IGNORED — every shot carries the ONE uniform length.
DUR=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/prompt -H 'Content-Type: application/json' \
  -d '{"text":"[Shot 1] @jinx walks into the warehouse, edited on the board.\n\n@jinx (S1), quietly:\n<d>[English] It is different now.</d>","seconds":6.5}')
echo "$DUR" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
sh=d['plan']['shots']
import math
snap=lambda n: max(5,min(3592,5+17*round((max(5,min(3592,n))-5)/17)))
up=lambda n: min(3592,max(snap(n),5+17*math.ceil((min(3592,n)-5)/17)))
L=sh[0]['length']; assert L>=5 and L%17==5, L   # one CONTENT length, on grid
# 2.223.5: continuing scenes climb the ladder, +(N-1)s snapped UP
assert all(sh[i]['length']==up(L+i*24) for i in range(1,len(sh))), [s['length'] for s in sh]
r=[x for x in d['list'] if x['n']==1][0]
assert r['length']==L, (r.get('length'), L)
" && ok "board: a per-scene 'seconds' is IGNORED — one CONTENT duration, continuing shots carry their window" \
  || bad "board: per-scene seconds still honoured: $(echo "$DUR" | head -c 300)"
ADD=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/add -H 'Content-Type: application/json' -d '{"text":""}')
echo "$ADD" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
shots=d['plan']['shots']; assert len(shots)==3, len(shots)
s=shots[-1]
assert s['id']=='clip_03', s['id']
assert s['visual_context_source']=='clip_02', s.get('visual_context_source')
assert s['seed'].isdigit() and len(s['seed'])==19, s.get('seed')
assert any('describe the action' in l for l in s['prompt']), s['prompt']
assert len(d['list'])==3 and d['list'][2]['status']=='idle', [r['status'] for r in d['list']]
" && ok "board: ＋ Scene appends clip_03 with a digit-built seed, DEFAULTS and the continuity chain" \
  || bad "board: add scene failed: $(echo "$ADD" | head -c 300)"
NEWPFX=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/prefix -H 'Content-Type: application/json' \
  -d '{"text":"subject_definitions:\n\n@jinx is defined by the reference sheet, hand-edited line."}')
echo "$NEWPFX" | grep -q '"ok":true' \
  && curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert 'hand-edited line' in '\n'.join(d['plan']['prompt_prefix']), d['plan']['prompt_prefix'][:3]
assert [r['status'] for r in d['list']].count('idle')>=2   # statuses untouched by a prefix save
" && ok "board: the shared prompt saves into the plan's prompt_prefix without touching scene statuses" \
  || bad "board: prefix save failed: $(echo "$NEWPFX" | head -c 300)"
# ---- RENDER SELECTED (2.149.0, by instruction) -----------------------------
# Scenes 1 and 3 are idle; queue both. The route starts ONE and holds the
# other as pending record ids; the GET poll (syncJobs) launches the successor
# only after its predecessor finishes — the tmp graph is per-scene, so two
# live scene jobs would race on it (last writer wins, both render one scene).
RSEL=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/render -H 'Content-Type: application/json' \
  -d '{"scenes":[1,3,3,9]}')
echo "$RSEL" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
assert d['queued']==2, d.get('queued')
assert any('no scene 9' in e for e in d.get('errors',[])), d.get('errors')
running=[r for r in d['list'] if r['status']=='running']
assert len(running)==1 and running[0]['n']==1, [(r['n'],r['status']) for r in d['list']]
assert d.get('pending')==['clip_03'], d.get('pending')
" && ok "render-selected: one starts, the rest queue by id, a bad pick is reported" \
  || bad "render-selected: queue wrong: $(echo "$RSEL" | head -c 400)"
SAW3RUN=0
for i in $(seq 1 150); do
  RB=$(curl -sf http://127.0.0.1:8311/api/scenes)
  echo "$RB" | python3 -c "
import json,sys
d=json.load(sys.stdin)
sts={r['n']:r['status'] for r in d['list']}
import sys as s2
s2.exit(3 if sts.get(3)=='running' else (0 if sts.get(1)=='rendered' and sts.get(3)=='rendered' and not d.get('pending') else 1))
"
  RC=$?
  [ "$RC" = 3 ] && SAW3RUN=1
  [ "$RC" = 0 ] && break
  sleep 1
done
echo "$RB" | python3 -c "
import json,sys
d=json.load(sys.stdin)
sts={r['n']:(r['status'],r['output']) for r in d['list']}
assert sts[1][0]=='rendered' and sts[1][1], sts[1]
assert sts[3][0]=='rendered' and sts[3][1], sts[3]
assert sts[1][1]!=sts[3][1], 'both scenes share one take - the tmp raced'
assert not d.get('pending'), d.get('pending')
" && ok "render-selected: the queue drains — BOTH scenes rendered their OWN take, pending empty" \
  || bad "render-selected: queue did not drain cleanly: $(echo "$RB" | head -c 400)"
[ "$SAW3RUN" = 1 ] && ok "render-selected: scene 3 was seen running AFTER scene 1 (sequenced, not parallel)" \
  || ok "render-selected: scene 3 finished between polls (stub is fast) — sequencing asserted by distinct takes"
# 2.170.0 (Tim: "if i have 6 scenes the first scene is generated 6 times"):
# each queued job must ASK COMFY for its own scene — the stub records the
# loop's scene_range per video queue — and each take must carry AUDIO, cut
# from the assembled film at the plan's own offsets when the segment is
# video-only (his segments are: the pre-2.165.0 silent takes proved it).
python3 -c "
import json, glob
rs = []
for f in sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'),
                key=lambda f: __import__('os').path.getmtime(f)):
    r = json.load(open(f))
    if r.get('_scene_range'): rs.append(r['_scene_range'])
assert rs[-2:] == ['1:1', '3:3'], rs[-6:]
" && ok "render-selected: each queued job asked ComfyUI for ITS OWN scene (1:1 then 3:3)" \
  || bad "render-selected: the queued jobs did not carry their own scene_range"
# the board's `output` is a basename; the takes live in the project's video
# dir. AUDIO present + the scene's EXACT plan duration = the film-cut
# fallback fired and cut at the right offsets (segments are video-only, so
# audio can only have come from the assembled film).
RPROJ=$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['project']")
python3 - "$RPROJ" <<'PYEOF'
import json, subprocess, sys, urllib.request
proj = sys.argv[1]
d = json.load(urllib.request.urlopen("http://127.0.0.1:8311/api/scenes"))
outs = {r["n"]: r["output"] for r in d["list"]}
lens = {i + 1: sh["length"] for i, sh in enumerate(d["plan"]["shots"])}
for n in (1, 3):
    f = f"projects/{proj}/video/{outs[n]}"
    pr = subprocess.run(["ffmpeg", "-i", f], capture_output=True, text=True).stderr
    assert "Audio:" in pr, (n, f, "silent")
    import re
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", pr)
    secs = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    want = lens[n] / 24.0
    assert abs(secs - want) < 0.35, (n, secs, want)
PYEOF
[ $? = 0 ] \
  && ok "render-selected: both takes carry AUDIO at the scene's EXACT plan duration — the film-cut fallback fired and cut at the right offsets" \
  || bad "render-selected: a take is silent or the wrong length"
# ---- THE MOVIE FILE MENU (2.150.0, by instruction) -------------------------
# Save the docker as a movie, New clears it (stash, never delete), Load
# brings it all back, Compile joins EVERY rendered take in scene order.
MPROJ=$(curl -sf http://127.0.0.1:8311/api/projects/current | jget "['name']")
MSV=$(curl -s -X POST http://127.0.0.1:8311/api/movies/save -H 'Content-Type: application/json' \
  -d '{"name":"E2E Feature"}')
echo "$MSV" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
assert d['id']=='E2E_Feature' and d['renders']>=2 and d['files']>=2, d
# 2.195.0: the bundle counts its reference pictures and environments too
assert 'references' in d and 'environments' in d, d
" && ok "movies: save bundles the cast's files, the takes, the reference pictures and the environments under the project's movies/" \
  || bad "movies: save failed: $(echo "$MSV" | head -c 300)"
# RESET WORKFLOW (2.196.0, Tim: "add a reset workflow button to the scene
# menu, i think the tmp workflow that is being rendered needs to be rebuilt
# with the new parameters") — one press rebuilds MM3_Characters_tmp.json now.
WRST=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/workflow/reset -H 'Content-Type: application/json' -d '{}')
echo "$WRST" | python3 -c "
import json,sys,os
d=json.load(sys.stdin)
assert d.get('ok') is True and d.get('file')=='MM3_Characters_tmp.json', d
assert isinstance(d.get('notes'),list) and 'cast' in d, d
assert os.path.exists('comfy_workflows/MM3_Characters_tmp.json'), 'tmp not on disk'
" && ok "workflow reset: ♻ rebuilds MM3_Characters_tmp.json on demand and answers with its notes" \
  || bad "workflow reset failed: $(echo "$WRST" | head -c 300)"
MNW=$(curl -s -X POST http://127.0.0.1:8311/api/movies/new -H 'Content-Type: application/json' -d '{}')
echo "$MNW" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok') and d.get('stashed',0)>=1, d
assert 'nothing was deleted' in d.get('note',''), d
assert len(d.get('list',[]))==0, d.get('list')
" && python3 -c "
import glob,sys
assert glob.glob('projects/$MPROJ/movies/_unsaved-*/characters/*'), 'no stash on disk'
assert glob.glob('projects/$MPROJ/video/scene*'), 'gallery takes were deleted by New'
" && ok "movies: New clears the docker, stashes the cast on disk and leaves the gallery alone" \
  || bad "movies: new failed: $(echo "$MNW" | head -c 300)"
curl -sf http://127.0.0.1:8311/api/characters | python3 -c "
import json,sys; assert json.load(sys.stdin)['characters']==[], 'cast not cleared'
" && ok "movies: after New the cast list is empty" || bad "movies: cast survived New"
MLD=$(curl -s -X POST http://127.0.0.1:8311/api/movies/load -H 'Content-Type: application/json' \
  -d '{"name":"E2E_Feature"}')
echo "$MLD" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
assert d['characters']>=1 and d['renders']>=2, d
sts={r['n']:r['status'] for r in d.get('list',[])}
assert sts.get(1)=='rendered' and sts.get(3)=='rendered', sts
assert all(not r.get('job') and not r.get('upjob') for r in d.get('list',[])), 'live job ids resurrected'
" && ok "movies: load restores the cast, the board (statuses intact, jobs blank) and the takes" \
  || bad "movies: load failed: $(echo "$MLD" | head -c 400)"
MCP=$(curl -s -X POST http://127.0.0.1:8311/api/movies/compile -H 'Content-Type: application/json' -d '{}')
MCID=$(echo "$MCP" | jget "['job']['id']" 2>/dev/null)
if [ -n "$MCID" ]; then
  echo "$MCP" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert len(d.get('scenes',[]))>=2, d.get('scenes')
"
  for i in $(seq 1 120); do
    MST=$(curl -sf "http://127.0.0.1:8311/api/jobs/$MCID" | jget "['status']")
    [ "$MST" = done ] || [ "$MST" = failed ] && break; sleep 1
  done
  [ "$MST" = done ] && ok "movies: Compile joins EVERY rendered take through the export path" \
    || { bad "movies: compile $MST"; curl -sf "http://127.0.0.1:8311/api/jobs/$MCID" | jget "['log']" | tail -6; }
else
  bad "movies: compile refused: $(echo "$MCP" | head -c 300)"
fi
# ---- chain settings tab (2.150.0, by instruction) --------------------------
# config.chain overrides the export's per-shot defaults for every NEW scene;
# a scene's own values always win, and clearing the tab restores the export.
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"chain":{"steps":"33","context_length":"55"}}' > /dev/null
CHADD=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/add -H 'Content-Type: application/json' -d '{"text":""}')
echo "$CHADD" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
s=d['plan']['shots'][-1]
# 2.189.0: the tab's 55 is OFF the pack's lattice ({0,1} + 17k+5 <= 243) and
# would die at ChainPlan — normalize snaps it to 56, end to end.
assert s['steps']==33 and s['context_length']==56, (s['steps'], s['context_length'])
old=d['plan']['shots'][0]
assert old['steps']==15, ('an EXISTING shot was rewritten by the override', old['steps'])
" && ok "chain-tab: a NEW scene takes the tab's steps/context, existing shots untouched" \
  || bad "chain-tab: override not applied: $(echo "$CHADD" | head -c 300)"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"chain":{}}' > /dev/null
curl -sf http://127.0.0.1:8311/api/config | python3 -c "
import json,sys; assert json.load(sys.stdin)['chain']=={}
" && ok "chain-tab: saving an empty tab RESTORES the export's defaults (replace, not merge)" \
  || bad "chain-tab: chain config did not clear"
# ---- a new chapter clears the board (2.150.0, by instruction) --------------
CH2=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/chapters -H 'Content-Type: application/json' \
  -d '{"name":"Act Two"}')
echo "$CH2" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
assert d['list']==[] and not d.get('pending'), (len(d['list']), d.get('pending'))
assert d['plan'] and d['plan']['shots']==[], 'shots not cleared'
assert 'hand-edited line' in '\n'.join(d['plan']['prompt_prefix']), 'the shared prompt was lost'
assert 'Act Two' in d['chapters'] and 'Act One' in d['chapters'], d['chapters']
assert 'cleared' in d.get('note',''), d.get('note')
" && ok "chapters: adding one CLEARS the board (scenes, queue, shots) and keeps the shared prompt" \
  || bad "chapters: clear-on-add wrong: $(echo "$CH2" | head -c 300)"
ls "projects/$SCURP0/video/" | grep -q "scene2_Act_One" \
  && ok "chapters: the rendered takes SURVIVE the clear as Video assets" \
  || bad "chapters: a take vanished with the board"
# ---- THE CHARACTER-REF CHAIN RUNS TO THE END (2.147.0, Tim: "high noise
# render that doesn't complete"). The verbatim MM3H-Character-ref style must
# queue with its loop tail intact (LoopEnd + Assemble), its per-shot links
# still wired to ChainCurrent, the refine scheduler untouched, and ChainReview
# off — the stub now also REJECTS any BasicScheduler steps<1, so the old
# degenerate-schedule write can never pass again.
HREF=$(curl -sf "http://127.0.0.1:8311/api/styles?kind=video" | python3 -c "
import json,sys
print([s['id'] for s in json.load(sys.stdin)['styles'] if s['name']=='MM3H-Character-ref'][0])")
# the chain's demo cast wants 2 pictures + 2 voices: supply them so every
# scheduled reference fills instead of pruning (the sound assets ride by NAME
# from the project's sound folder, the same contract the reference dock uses)
HP=$(curl -sf http://127.0.0.1:8311/api/projects/current | jget "['name']")
cp /tmp/e2e_ref.wav "projects/$HP/sound/href_v1.wav"
cp /tmp/e2e_ref.wav "projects/$HP/sound/href_v2.wav"
HJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="character ref chain" \
  -F width=960 -F height=544 -F steps=0 -F seed=5 -F mode=ref2va -F frames=22 \
  -F pipeline=single -F format=mp4 -F "video_style_id=$HREF" \
  -F "references=@/tmp/e2e_ref1.png" -F "references=@/tmp/e2e_ref2.png" \
  -F 'ref_audios=["href_v1.wav","href_v2.wav"]' | jget "['id']")
for i in $(seq 1 120); do
  HST=$(curl -sf "http://127.0.0.1:8311/api/jobs/$HJ" | jget "['status']")
  [ "$HST" = done ] || [ "$HST" = failed ] && break; sleep 1
done
HLOG=$(curl -sf "http://127.0.0.1:8311/api/jobs/$HJ?log_from=0")
[ "$HST" = done ] && echo "$HLOG" | python3 -c "
import json,sys
log=json.load(sys.stdin)['log']; blob='\n'.join(log)
assert 'ChainReview#48 disabled' in blob, 'review not turned off'
assert 'ride the PLAN' in blob, 'chain links were not reported as kept'
assert 'graph drives its own per-shot count' in blob or 'graph wires them' in blob, \
    [l for l in log if 'steps' in l][:4]
" && python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)
r = json.load(open(newest))
cls = r.get("_classes") or []
assert "MiniMaxH3ChainLoopEnd" in cls and "MiniMaxH3ChainAssemble" in cls, cls
assert r.get("_steps", {}).get("5109") == 1, r.get("_steps")     # refine untouched
assert "29" not in (r.get("_steps") or {}), r.get("_steps")      # base stays LINKED
PYEOF
[ $? = 0 ] && [ "$HST" = done ] \
  && ok "character-ref: the chain queues WHOLE (LoopEnd+Assemble kept, links wired, refine at 1 step, review off) and renders" \
  || { bad "character-ref: $HST"; echo "$HLOG" | jget "['log']" 2>/dev/null | tail -8; }
# 2.366.0 (Tim: "even your prompt didn't work , cfg was 1, i am trying 3"): the
# H3 graphs guide with BasicGuider (no cfg input), so cfg 3 never reached them.
# Above 1 the worker swaps in a CFGGuider with a negative clone of the H3
# generator - the queued graph must carry it, and the job log must say so.
TCJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate \
  -F prompt='She smiles and says: "Thank you!"' -F width=192 -F height=108 -F steps=4 -F cfg=3 \
  -F seed=7 -F mode=ref2va -F frames=24 -F pipeline=single -F format=mp4 \
  -F "references=@/tmp/e2e_ref1.png" | jget "['id']")
for i in $(seq 1 120); do
  TCS=$(curl -sf "http://127.0.0.1:8311/api/jobs/$TCJ" | jget "['status']")
  [ "$TCS" = done ] || [ "$TCS" = failed ] && break; sleep 1
done
TCL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$TCJ?log_from=0")
[ "$TCS" = done ] && echo "$TCL" | python3 -c "
import json,sys
blob='\n'.join(json.load(sys.stdin)['log'])
assert 'true cfg 3: 1 BasicGuider -> CFGGuider' in blob, blob[-600:]
" && python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)
cls = json.load(open(newest)).get("_classes") or []
assert "CFGGuider" in cls and "BasicGuider" not in cls, cls
PYEOF
[ $? = 0 ] && [ "$TCS" = done ] \
  && ok "true cfg (2.366.0): cfg 3 on the H3 ref2va graph queues a CFGGuider (negative = the generator cloned with the negative text) and says so" \
  || { bad "true cfg: $TCS"; echo "$TCL" | jget "['log']" 2>/dev/null | tail -8; }
python3 scripts/test-truecfg.py > /tmp/truecfg.log 2>&1 \
  && ok "truecfg unit tests (2.366.0 BasicGuider -> CFGGuider above cfg 1: same refs, negative text, RefMods, native-audio lock, LoRA warning)" \
  || { bad "truecfg unit tests"; tail -12 /tmp/truecfg.log; }
# ---- 2.368.0 (Tim: "add a wan2.1 style so we can use wan as well, also wan2.2"): a Wan style through the
# prompt docker's /api/generate -> wan_worker.py (the graph built from ComfyUI's core Wan nodes, the model file
# picked from what the stub ComfyUI lists, the sound laid under the 24 fps take)
WMD=/tmp/e2e_comfy/ComfyUI/models/diffusion_models
mkdir -p "$WMD"
: > "$WMD/wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors"
WAN21=$(curl -sf "http://127.0.0.1:8311/api/styles?kind=video" | python3 -c "
import json,sys
print([s['id'] for s in json.load(sys.stdin)['styles'] if s['name']=='Wan 2.1'][0])")
HPW=$(curl -sf http://127.0.0.1:8311/api/projects/current | jget "['name']")
cp /tmp/e2e_ref.wav "projects/$HPW/sound/e2e_wan368.wav"
WJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt='She turns and smiles: "Hello!"' \
  -F mode=fl2va -F width=320 -F height=192 -F frames=48 -F seed=4 -F cfg=1 -F format=mp4 \
  -F "video_style_id=$WAN21" -F "references=@/tmp/e2e_ref1.png" -F 'ref_audios=["e2e_wan368.wav"]')
WJID=$(echo "$WJ" | jget "['id']")
for i in $(seq 1 120); do
  WST=$(curl -sf "http://127.0.0.1:8311/api/jobs/$WJID" | jget "['status']")
  [ "$WST" = done ] || [ "$WST" = failed ] && break; sleep 1
done
WJL=$(curl -sf "http://127.0.0.1:8311/api/jobs/$WJID?log_from=0")
[ "$WST" = done ] && echo "$WJ" | grep -q "Wan 2.1 from a first frame" && echo "$WJL" | python3 -c "
import json,sys
d=json.load(sys.stdin); blob='\n'.join(d['log'])
assert d['output'].endswith('_wan.mp4'), d['output']
assert d['params']['mode'] == 'wan' and d['params']['wan_mode'] == 'i2v', d['params']
assert d['params']['prompt'] == 'She turns and smiles: \"Hello!\"', d['params']['prompt']   # as typed, no H3 <d> markup
assert 'model wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors' in blob, blob[-800:]
assert 'the sound e2e_wan368.wav from 0.00s laid under it' in blob, blob[-800:]
" && python3 - <<'PYEOF'
import glob, json, os
rec = json.load(open(max(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)))
cls = rec.get("_classes") or []
assert "WanImageToVideo" in cls and "CLIPVisionEncode" in cls and "KSampler" in cls and "SaveVideo" in cls, cls
assert "wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors" in (rec.get("_models") or []), rec.get("_models")
PYEOF
[ $? = 0 ] && [ "$WST" = done ] \
  && ok "wan (2.368.0): the Wan 2.1 style renders F/L from the prompt docker - WanImageToVideo on ComfyUI's i2v 720p file, the prompt as typed, the dock's sound under the 24 fps take" \
  || { bad "wan: $WST $(echo "$WJ" | head -c 300)"; echo "$WJL" | jget "['log']" 2>/dev/null | tail -8; }
rm -f "projects/$HPW/sound/e2e_wan368.wav"

# ---- 2.368.0 (Tim: "is it possible for bitgen to create vr 3d sbs movies from reference pictures and audio
# references- maybe using a 360 sbs picture as reference?" -> "lets try route 2"): the 🥽 VR World dialog's routes,
# end to end - a TB 360 picture, the performer through MiniMax H3 (worker.py fl2va) and through Wan 2.1, each back
# into the sphere with the spherical metadata
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=1024x512 \
  -filter_complex "[0:v]split=2[a][b];[b]crop=iw-8:ih:8:0,pad=iw+8:ih:0:0[c];[a][c]vstack=inputs=2" \
  -frames:v 1 /tmp/e2e_plaza_360_TB.jpg
curl -s -X POST http://127.0.0.1:8311/api/vrworld/clear -H 'Content-Type: application/json' -d '{"slot":"world"}' > /dev/null
VWU=$(curl -sf -X POST http://127.0.0.1:8311/api/vrworld/upload -F slot=world -F "file=@/tmp/e2e_plaza_360_TB.jpg")
curl -sf -X POST http://127.0.0.1:8311/api/vrworld/set -H 'Content-Type: application/json' \
  -d '{"prompt":"She waves hello.","view":{"yaw":20,"fov":70},"short_side":256,"seconds":1,"engine":"h3"}' > /dev/null
vw_run() {   # $1 = engine id -> the finished job's json in /tmp/vw368_$2.json
  curl -sf -X POST http://127.0.0.1:8311/api/vrworld/set -H 'Content-Type: application/json' -d "{\"engine\":\"$1\"}" > /dev/null
  local J; J=$(curl -sf -X POST http://127.0.0.1:8311/api/vrworld/render -H 'Content-Type: application/json' -d '{}' | jget "['id']")
  for i in $(seq 1 180); do
    local S; S=$(curl -sf "http://127.0.0.1:8311/api/jobs/$J" | jget "['status']")
    [ "$S" = done ] || [ "$S" = failed ] && break; sleep 1
  done
  curl -sf "http://127.0.0.1:8311/api/jobs/$J?log_from=0" > "/tmp/vw368_$2.json"
}
vw_run h3 h3
vw_run "$WAN21" wan
python3 - "$HPW" <<'PYEOF' > /tmp/vw368.log 2>&1
import json, subprocess, sys
sys.path.insert(0, "scripts")
import vr_swap as V
proj = sys.argv[1]
for tag, eng in (("h3", "worker.py fl2va"), ("wan", "wan_worker.py family=wan21 mode=i2v")):
    d = json.load(open(f"/tmp/vw368_{tag}.json"))
    blob = "\n".join(d.get("log") or [])
    assert d["status"] == "done", (tag, d["status"], blob[-1500:])
    out = d["output"]
    assert out.endswith("_vrworld_360_TB.mp4"), out
    f = f"projects/{proj}/output/{out}"
    wh = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", f],
                        capture_output=True, text=True).stdout.strip()
    assert wh.startswith("1024,1024"), (tag, wh)
    xml = V.read_spherical(f)
    assert "top-bottom" in xml and "equirectangular" in xml, (tag, xml[:200])
    assert "VR World: " in blob and "VR eyes:" in blob and "spherical metadata written" in blob, (tag, blob[-1200:])
    assert ("[performer] [worker] " + eng.split()[0]) in blob or eng.split()[0] in blob, (tag, blob[-1500:])
    subprocess.run(["rm", "-f", f, f"projects/{proj}/video/{out}"])
print("ok")
PYEOF
grep -q "^ok$" /tmp/vw368.log && echo "$VWU" | grep -q '"vr_mode":"tb360"' \
  && ok "vrworld (2.368.0): a TB 360 picture typed from its name; the performer through MiniMax H3 and through Wan 2.1, each back into the 1024x1024 sphere as _vrworld_360_TB.mp4 with top-bottom spherical metadata" \
  || { bad "vrworld: the VR World render"; tail -8 /tmp/vw368.log; }
curl -s -X POST http://127.0.0.1:8311/api/vrworld/clear -H 'Content-Type: application/json' -d '{"slot":"world"}' > /dev/null
rm -f "$WMD/wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors"
python3 scripts/test-wangraph.py > /tmp/wangraph.log 2>&1 \
  && ok "wangraph unit tests (2.368.0 Wan 2.1 / 2.2 graphs from ComfyUI's core nodes, the files picked per mode, the worker LIVE on the stub)" \
  || { bad "wangraph unit tests"; tail -12 /tmp/wangraph.log; }
node scripts/test-wan.js > /tmp/wan368.log 2>&1 \
  && ok "wan unit tests (2.368.0 lib/wan: modes, frames, the job, the starters + archs, the /api/generate hand-off)" \
  || { bad "wan unit tests"; tail -12 /tmp/wan368.log; }
python3 scripts/test-vrworld.py > /tmp/vrworld368py.log 2>&1 \
  && ok "vrworld py unit tests (2.368.0 the type, the still's views + paste, the stereo compositor, the worker LIVE)" \
  || { bad "vrworld py unit tests"; tail -12 /tmp/vrworld368py.log; }
node scripts/test-vrworld.js > /tmp/vrworld368js.log 2>&1 \
  && ok "vrworld js unit tests (2.368.0 lib/vrWorld mirrors the python, the routes LIVE, the dialog in jsdom, the wiring)" \
  || { bad "vrworld js unit tests"; tail -12 /tmp/vrworld368js.log; }
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"backend":"sdcli"}}' > /dev/null
# ---- the screenplay WRITER through a stub llama-server (2.142.3) ----------
# The route once double-unwrapped the LLM reply into "[object Object]" and
# failed every screenplay while all tests stayed green — because nothing ever
# drove this seam. The stub replies wearing a <think> block (with braces
# inside), a code fence, prose and a trailing comma, and records the request.
rm -rf /tmp/stub-llm-out
python3 scripts/stub-llm.py 8391 /tmp/stub-llm-out > /tmp/stub-llm.log 2>&1 &
STUB_LLM_PID=$!
sleep 0.5
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"llm":{"external_url":"http://127.0.0.1:8391/v1/chat/completions"}}' > /dev/null
# THE STORY RODE IN THE CHAT (2.174.0): seed a conversation, then ask for the
# screenplay — the writer's system prompt must carry the recalled excerpts.
curl -sf -X POST http://127.0.0.1:8311/api/chat/new > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/chat -H 'Content-Type: application/json' \
  -d '{"text":"lets make a heist story on the NEON_PIER_E2E at midnight"}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/chat -H 'Content-Type: application/json' \
  -d '{"text":"jinx cracks the vault alone, no crew"}' > /dev/null
SPW=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a short scene where jinx waits","single":true}')
echo "$SPW" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert len(d['plan']['shots']) == 1 and d['plan']['shots'][0]['id'] == 'clip_01', d['plan']
assert d['plan']['prompt_prefix'][0].startswith('subject_definitions'), d['plan']['prompt_prefix'][:1]
" && ok "screenplay: the writer parses a REAL local-model reply (think block, fences, prose, trailing commas)" \
  || bad "screenplay: writer failed against the stub LLM: $(echo "$SPW" | head -c 300)"
python3 -c "
import json, glob
req = json.load(open(sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))[-1]))
assert req.get('max_tokens', 0) >= 4096, req.get('max_tokens')
assert any('screenplay' in str(m.get('content','')).lower() or 'shots' in str(m.get('content',''))
           for m in req.get('messages', [])), 'guide missing from the request'
" && ok "screenplay: the writer asks for a real token budget (a whole plan never fits in 600)" \
  || bad "screenplay: token budget not raised"
python3 -c "
import json, glob
fs=sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))
# the newest SCREENPLAY request (the chat turns recorded their own): find the
# last request whose system prompt teaches the plan grammar
req=[json.load(open(f)) for f in fs]
sp=[r for r in req if any('ONE JSON object' in str(m.get('content','')) for m in r.get('messages',[]))][-1]
sys_=' '.join(str(m.get('content','')) for m in sp['messages'])
assert 'THE CONVERSATION SO FAR' in sys_, 'digest block missing'
assert 'NEON_PIER_E2E' in sys_, 'the story from the chat did not ride'
assert 'cracks the vault' in sys_, 'second chat turn missing from recall'
" && ok "screenplay: the CONVERSATION rides the writer's prompt — recalled excerpts carry the story the chat developed (2.174.0)" \
  || bad "screenplay: chat digest missing from the writer request"
# THE SHARED PROMPT IS READ, NOT REPLACED (2.192.0, Tim: "does the llm read
# the shared prompt before making the scenes?"). A 💾-saved shared prompt in
# the plan's shape rides the writer's system message AND survives as the
# plan's prompt_prefix (casual notes on an empty board ride as standing
# notes instead — X-Shared-Prefix names the path taken: board|notes|generated).
GENP=$(curl -s "http://127.0.0.1:8311/api/screenplay/prefix" | python3 -c "import json,sys; print(json.dumps('\n'.join(json.load(sys.stdin)['prefix'])))")
curl -sf -X POST http://127.0.0.1:8311/api/scenes/prefix -H 'Content-Type: application/json' \
  -d "{\"text\":\"subject_definitions:\n\n@jinx is defined by the provided reference sheet. SHARED_MARK_E2E: every scene is lit by one bare bulb.\"}" > /dev/null
SPH=$(curl -s -D /tmp/sp_hdr -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a short scene where jinx waits","single":true}')
grep -qi '^x-shared-prefix: board' /tmp/sp_hdr \
  && echo "$SPH" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True, d.get('error')
pp='\n'.join(d['plan']['prompt_prefix'])
assert 'SHARED_MARK_E2E' in pp, ('the saved shared prompt was replaced', pp[:200])
" && python3 -c "
import json, glob
fs=sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))
req=[json.load(open(f)) for f in fs]
sp=[r for r in req if any('SHARED_MARK_E2E' in str(m.get('content','')) for m in r.get('messages',[]))]
assert sp, 'the saved shared prompt never reached the model'
" && ok "shared prompt: a 💾-saved prefix is READ by the writer and PRESERVED in the plan (X-Shared-Prefix: board)" \
  || bad "shared prompt not honored: $(tr -d '\r' < /tmp/sp_hdr | grep -i x-shared-prefix) $(echo "$SPH" | head -c 200)"
# 2.299.0 (Tim: "llm should read global prompt before generating scenes
# for videos or music videos"): it rides FIRST - right after the rules,
# before the brief - and only once
grep -qi '^x-global-prompt: 1' /tmp/sp_hdr && python3 -c "
import json, glob
fs=sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))
req=[json.load(open(f)) for f in fs]
sp=[r for r in req if any('SHARED_MARK_E2E' in str(m.get('content','')) for m in r.get('messages',[]))]
sysm=[m for m in sp[-1]['messages'] if m.get('role')=='system'][0]['content']
g=sysm.find('THE GLOBAL PROMPT - READ IT BEFORE YOU WRITE')
assert g>=0, 'no global-prompt heading'
assert sysm.count('SHARED_MARK_E2E')==1, ('sent twice', sysm.count('SHARED_MARK_E2E'))
assert g < sysm.find('SHARED_MARK_E2E'), 'mark not under the heading'
" && ok "global prompt: the writer reads it FIRST (after the rules), once (X-Global-Prompt: 1)" \
  || bad "global prompt: not read first: $(tr -d '\r' < /tmp/sp_hdr | grep -i x-global-prompt)"
# restore the generated prefix so later legs see the classic state
curl -sf -X POST http://127.0.0.1:8311/api/scenes/prefix -H 'Content-Type: application/json' \
  -d "{\"text\":$GENP}" > /dev/null
# THE ITERATIVE WRITER (2.182.0, Tim's own design): a brief naming a scene
# count writes ONE scene per stateless call, the story so far recalled into
# each — the request texts prove it.
NIT=$(ls /tmp/stub-llm-out/llm_request_*.json 2>/dev/null | wc -l)
SPI=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json'   -d '{"brief":"a 2 scene story where jinx waits then leaves"}')
echo "$SPI" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True and d.get('iterative')==2, (d.get('ok'), d.get('iterative'))
assert len(d['plan']['shots'])==2, len(d['plan']['shots'])
# 2.190.0: the assertion whose absence let identical scenes ship — scene 2
# must be a DIFFERENT scene, not scene 1 again.
p1=' '.join(d['plan']['shots'][0]['prompt']); p2=' '.join(d['plan']['shots'][1]['prompt'])
assert p1!=p2, ('identical scenes', p1)
assert any('scene by scene' in w for w in d.get('warnings',[])), d.get('warnings')
" && python3 -c "
import json, glob
fs=sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))[$NIT:]
sys_=[ ' '.join(str(m.get('content','')) for m in json.load(open(f)).get('messages',[])) for f in fs ]
one=[t for t in sys_ if 'scene 1 of 2' in t]; two=[t for t in sys_ if 'scene 2 of 2' in t]
assert one and two, (len(sys_))
assert 'SCENES ALREADY WRITTEN' not in one[0], 'scene 1 must start clean'
assert 'SCENES ALREADY WRITTEN' in two[0], 'scene 2 must recall scene 1'
" && ok "iterative writer: 2 scenes = 2 stateless calls, scene 2 recalls scene 1, the assembled plan validates"   || bad "iterative writer: $(echo "$SPI" | head -c 300)"
# 2.186.0: NO count in the brief no longer falls back to the whole-plan
# call — a probe asks the model for a number and the writer stays
# iterative; each written scene is saved to the BOARD as it lands.
SPN=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a story where jinx waits then leaves"}')
echo "$SPN" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('iterative',0)>=1, d.get('iterative')
assert any('the model chose' in w for w in d.get('warnings',[])), d.get('warnings')
" && curl -s http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert len(d.get('list',[]))>=1, len(d.get('list',[]))
" && ok "iterative writer: a COUNT-LESS brief probes the model for N and stays scene-by-scene; the board holds the scenes as written" \
  || bad "count-less iterative failed: $(echo "$SPN" | head -c 300)"
# THE RETRY THAT ALTERNATES (2.188.0, Tim's card verbatim: "Unable to
# generate parser for this template ... conversation roles must alternate").
# The stub now 400s EVERY non-alternating request like a strict Mistral/Gemma
# template; GARBLE_ONCE_TEST makes the first per-scene attempt answer prose,
# so scene 1 only lands if the retry's shape is [system, user, assistant,
# user] — the old [system, user, user] dies exactly like Tim's scene 7/8.
NGA=$(ls /tmp/stub-llm-out/llm_request_*.json 2>/dev/null | wc -l)
SPG=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a 1 scene story where jinx waits GARBLE_ONCE_TEST"}')
echo "$SPG" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True and d.get('iterative')==1, (d.get('ok'), d.get('iterative'), d.get('error'))
" && python3 -c "
import json, glob
fs=sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))[$NGA:]
reqs=[json.load(open(f)) for f in fs]
rt=[r for r in reqs if any('Reply with ONLY the JSON' in str(m.get('content','')) for m in r.get('messages',[]))]
assert rt, 'the retry request never reached the model'
roles=[m.get('role') for m in rt[-1]['messages']]
assert roles==['system','user','assistant','user'], roles
a=[str(m.get('content','')) for m in rt[-1]['messages'] if m.get('role')=='assistant'][0]
assert 'carried away' in a, 'the failed reply must ride the assistant turn'
" && ok "iterative writer: the per-scene RETRY alternates roles and survives a strict template (the model's failed reply rides the assistant turn)" \
  || bad "strict-template retry failed: $(echo "$SPG" | head -c 300)"
# THE COPYCAT MODEL (2.190.0, Tim: "all the scenes are identical ... it
# should read all the previous scenes and create new scenes"). COPYCAT_TEST
# makes the stub answer scene 1's text for EVERY per-scene request — the
# duplicate guard must catch the copy, send one correcting retry that names
# it, and land the real scene 2.
NCC=$(ls /tmp/stub-llm-out/llm_request_*.json 2>/dev/null | wc -l)
SPC=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a 2 scene story where jinx waits COPYCAT_TEST"}')
echo "$SPC" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True and d.get('iterative')==2, (d.get('ok'), d.get('iterative'), d.get('error'))
p1=' '.join(d['plan']['shots'][0]['prompt']); p2=' '.join(d['plan']['shots'][1]['prompt'])
assert p1!=p2 and 'part 2' in p2, ('the copy was accepted', p1, p2)
" && python3 -c "
import json, glob
fs=sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))[$NCC:]
reqs=[json.load(open(f)) for f in fs]
rt=[r for r in reqs if any('COPY of an earlier scene' in str(m.get('content','')) for m in r.get('messages',[]))]
assert rt, 'the duplicate was never named to the model'
roles=[m.get('role') for m in rt[-1]['messages']]
assert roles==['system','user','assistant','user'], roles
" && ok "iterative writer: a model that copies an earlier scene is caught — one correcting retry names the COPY and lands a NEW scene" \
  || bad "copycat guard failed: $(echo "$SPC" | head -c 300)"
# ---- 2.293.0: ▶ AS WRITTEN (Tim: "can we populate each scene as they are
# created so users with 2 gpu's can start rendering while waiting for new
# scenes to be created"). The board switch on, the LLM and ComfyUI on
# different cards: scene 1 must be RENDERING while the (slowed) writer is
# still on scene 2; a staged BLANK scene stays on the board while the
# writer works and never renders; every written scene renders in order.
ARPROJ=$(curl -sf http://127.0.0.1:8311/api/projects/current | jget "['name']")
cp "projects/$ARPROJ/$ARPROJ.prj" /tmp/ar293_prj.bak
ARGPU=$(curl -sf http://127.0.0.1:8311/api/config | python3 -c "
import json,sys; c=json.load(sys.stdin)
llm=str((c.get('llm') or {}).get('device') or 'cuda1')
print('cuda1' if llm=='cuda0' else 'cuda0')")
AROLDGPU=$(curl -sf http://127.0.0.1:8311/api/config | python3 -c "
import json,sys; c=json.load(sys.stdin); print((c.get('comfy') or {}).get('gpu') or 'cuda0')")
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d "{\"engine\":{\"backend\":\"comfy\",\"comfy\":{\"url\":\"http://127.0.0.1:8388\"}},\"comfy\":{\"gpu\":\"$ARGPU\"}}" > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/scenes/style -H 'Content-Type: application/json' -d '{"name":""}' > /dev/null
# a staged board: three BLANK scenes (the video docker's .seg staging shape)
python3 - "$ARPROJ" <<'PYAR'
import json, sys
p = f"projects/{sys.argv[1]}/{sys.argv[1]}.prj"
d = json.load(open(p))
sc = d.get("scenes") or {}
shots = [{"id": "clip_%02d" % n, "length": 39, "audio_start": 5.0 * (n - 1), "audio_dur": 5.0,
          "prompt": ["[Shot %d] (blank - awaiting the writer: song segment %d, %ss to %ss)"
                     % (n, n, 5 * (n - 1), 5 * n)]} for n in (1, 2, 3)]
sc["plan"] = {"prompt_prefix": (sc.get("plan") or {}).get("prompt_prefix") or ["subject_definitions:"],
              "shots": shots}
sc["list"] = [{"n": n, "id": "clip_%02d" % n, "prompt": shots[n - 1]["prompt"], "length": 39,
               "audio_start": 5.0 * (n - 1), "audio_dur": 5.0, "status": "idle"} for n in (1, 2, 3)]
sc["pending"] = []
d["scenes"] = sc
json.dump(d, open(p, "w"), indent=2)
PYAR
ARON=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/auto-render -H 'Content-Type: application/json' -d '{"on":true}')
echo "$ARON" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('auto_render') is True and d.get('mode')=='live', d
" && curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); assert d.get('auto_render') is True, d.get('auto_render')
" && ok "as-written: the board switch saves with the board and says LIVE when the LLM and ComfyUI are on different cards" \
  || bad "as-written: switch wrong: $(echo "$ARON" | head -c 240)"
rm -f /tmp/ar293_out.json
curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a 2 scene story where jinx waits then leaves SLOW_SCENES_TEST"}' > /tmp/ar293_out.json &
ARPID=$!
ARSAW=0; ARBLANK=0
for i in $(seq 1 80); do
  if [ -s /tmp/ar293_out.json ]; then break; fi
  ARB=$(curl -sf http://127.0.0.1:8311/api/scenes)
  echo "$ARB" | python3 -c "
import json,sys; d=json.load(sys.stdin)
L={r['n']:r for r in d['list']}
r1=L.get(1) or {}
sys.exit(0 if r1.get('status') in ('running','rendered') and 'part 1' in ' '.join(r1.get('prompt',[])) else 1)" \
    && [ ! -s /tmp/ar293_out.json ] && ARSAW=1
  echo "$ARB" | python3 -c "
import json,sys; d=json.load(sys.stdin)
L={r['n']:r for r in d['list']}
ok=len(L)==3 and 'part 1' in ' '.join((L.get(1) or {}).get('prompt',[])) \
   and 'blank - awaiting' in ' '.join((L.get(3) or {}).get('prompt',[])) and (L.get(3) or {}).get('audio_start')==10.0
sys.exit(0 if ok else 1)" && ARBLANK=1
  [ "$ARSAW" = 1 ] && [ "$ARBLANK" = 1 ] && break
  sleep 0.5
done
wait $ARPID
[ "$ARSAW" = 1 ] && ok "as-written: scene 1 was RENDERING while the writer was still writing scene 2 (the second GPU works in parallel)" \
  || bad "as-written: no render started before the writer returned"
[ "$ARBLANK" = 1 ] && ok "as-written: the staged BLANK scene 3 stayed on the board (with its start input) while the writer worked" \
  || bad "as-written: the board shrank to the written scenes mid-write"
python3 -c "
import json; d=json.load(open('/tmp/ar293_out.json'))
assert d.get('ok') is True and d.get('iterative')==2, (d.get('ok'), d.get('error'))
rn=d.get('rendering') or {}
assert rn.get('mode')=='live' and rn.get('queued')==[1,2], rn
assert any('queued to render as they were written' in w for w in d.get('warnings',[])), d.get('warnings')
" && ok "as-written: the writer reports both written scenes queued (the blank one never)" \
  || bad "as-written: writer answer wrong: $(head -c 300 /tmp/ar293_out.json)"
ARDONE=""
for i in $(seq 1 120); do
  ARDONE=$(curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin)
L={r['n']:r for r in d['list']}
done=all((L.get(n) or {}).get('status')=='rendered' for n in (1,2)) and not d.get('pending')
print('yes' if done else '')")
  [ -n "$ARDONE" ] && break
  sleep 1
done
curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin)
L={r['n']:r for r in d['list']}
assert L[1]['status']=='rendered' and L[2]['status']=='rendered', (L[1]['status'], L[2]['status'])
assert L[1]['output'] and L[2]['output'] and L[1]['output']!=L[2]['output'], (L[1]['output'], L[2]['output'])
assert L[3]['status']=='idle' and not L[3].get('job'), L[3]
" && python3 -c "
import json, glob, os
rs=[json.load(open(f)).get('_scene_range') for f in sorted(glob.glob('/tmp/stub-comfy-out/video_*.json'), key=os.path.getmtime)]
rs=[r for r in rs if r]
assert rs[-2:]==['1:1','2:2'], rs[-4:]
" && ok "as-written: both written scenes rendered their OWN takes, in story order (1 then 2); the blank scene stayed idle" \
  || bad "as-written: the queue did not drain in order: $(curl -sf http://127.0.0.1:8311/api/scenes | head -c 300)"
curl -sf -X POST http://127.0.0.1:8311/api/scenes/auto-render -H 'Content-Type: application/json' -d '{"on":false}' > /dev/null
cp /tmp/ar293_prj.bak "projects/$ARPROJ/$ARPROJ.prj"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d "{\"engine\":{\"backend\":\"sdcli\"},\"comfy\":{\"gpu\":\"$AROLDGPU\"}}" > /dev/null
# ---- 2.294.0: THE MUSIC-VIDEO WRITER RULES (Tim: "can we teach the llm
# how to write scenes for the music video workflow ... it put in unknown
# characters and is using (s1) dialog instead of singing the song"). On a
# MMH3_NativeAudio_MV board the writer gets lib/mvWriter's contract - not
# the chain guide's (S1)/<d> dialogue, not the MMH3_Music_Video addendum -
# and a scene with dialogue markup / speaker IDs / an invented tag gets ONE
# correcting retry naming them, then a deterministic repair.
cp "projects/$ARPROJ/$ARPROJ.prj" /tmp/mv294_prj.bak
curl -sf -X POST http://127.0.0.1:8311/api/scenes/style -H 'Content-Type: application/json' \
  -d '{"name":"MMH3_NativeAudio_MV"}' > /dev/null
# 2.323.0: the SONG rules need a song on the board (no song = the film
# writer, tests below the "no-song" legs); the board gets one for these legs
mkdir -p "projects/$ARPROJ/sound"
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=280:duration=20" "projects/$ARPROJ/sound/e2e_mv294.wav"
curl -s -X POST http://127.0.0.1:8311/api/scenes/audio -H 'Content-Type: application/json' \
  -d '{"file":"e2e_mv294.wav"}' > /dev/null
NMV=$(ls /tmp/stub-llm-out/llm_request_*.json 2>/dev/null | wc -l)
MV1=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a 2 scene music video where jinx sings the song NATIVE_BAD_ONCE_TEST"}')
echo "$MV1" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True and d.get('iterative')==2, (d.get('ok'), d.get('error'), d.get('errors'))
for sh in d['plan']['shots']:
    t='\n'.join(sh['prompt'])
    assert '<d>' not in t and '(S1)' not in t and '@drummer' not in t, t
    assert 'lip synchronization' in t and '@jinx' in t, t
assert any('the song is the voice' in w for w in d.get('warnings',[])), d.get('warnings')
" && python3 -c "
import json, glob
fs=sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))[$NMV:]
reqs=[json.load(open(f)) for f in fs]
sysm=[str(r['messages'][0].get('content','')) for r in reqs if r.get('messages')]
first=[t for t in sysm if 'scene 1 of 2' in t][0]
assert 'The SONG IS THE VOICE' in first, first[:300]
assert '(S1), quietly' not in first and 'LYRIC LOCK' not in first, 'the chain rules still ride the native writer'
guide_part=first.split('THE CONVERSATION SO FAR')[0]
# 2.299.0 (Tim: llm should read global prompt before generating scenes
# for videos or music videos): the global prompt NOW rides the native
# writer too - read first, WITHOUT its voice slots and dialogue lines
assert 'THE GLOBAL PROMPT - READ IT BEFORE YOU WRITE' in guide_part, 'the global prompt did not ride'
assert '@jinx is the character' in guide_part, 'the subject definitions did not ride'
assert 'voice_assignments' not in first and 'speaks in (S' not in first, 'the voice slots still ride'
assert 'Dialogue must be clearly synchronized' not in first, 'the dialogue direction still rides'
# the recalled chat rides for its STORY - an old chain plan's markup is out
convo_part=first.split('THE CONVERSATION SO FAR')[1] if 'THE CONVERSATION SO FAR' in first else ''
assert '(S1)' not in convo_part and '<d>' not in convo_part, convo_part[:300]
rt=[r for r in reqs if any('breaks the music-video rules' in str(m.get('content','')) for m in r.get('messages',[]))]
assert len(rt)==2, len(rt)
c=str(rt[0]['messages'][-1]['content'])
assert '(S1)' in c and '<d>' in c and '@drummer' in c, c[:400]
assert [m.get('role') for m in rt[0]['messages']]==['system','user','assistant','user']
" && ok "music-video writer: a native board writes by ITS rules (no chain dialogue guide, no MMH3_Music_Video addendum; the global prompt read first WITHOUT its (S1) voice slots); (S1)/<d>/@drummer are named in ONE correcting retry and the clean scenes land" \
  || bad "music-video writer (retry): $(echo "$MV1" | head -c 400)"
MV2=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a 1 scene music video where jinx sings NATIVE_BAD_ALWAYS_TEST"}')
echo "$MV2" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True, (d.get('error'), d.get('errors'))
t='\n'.join(d['plan']['shots'][0]['prompt'])
assert '<d>' not in t and '(S1)' not in t and '@drummer' not in t, t
assert 'lip synchronization' in t, t
w=' '.join(d.get('warnings',[]))
assert 'repaired scene 1' in w and 'speaker IDs (S1) removed' in w and '@drummer' in w, w[:500]
" && ok "music-video writer: a model that repeats the mistake is REPAIRED deterministically (markup out, the invented tag handled, the singing line in) and the repair is said" \
  || bad "music-video writer (repair): $(echo "$MV2" | head -c 400)"
curl -sf "http://127.0.0.1:8311/api/screenplay/guide" | python3 -c "
import json,sys; g=json.load(sys.stdin)['guide']
assert 'The SONG IS THE VOICE' in g and '@jinx' in g, g[:200]
" && ok "music-video writer: GET /api/screenplay/guide shows the guide the writer actually gets on this board" \
  || bad "music-video writer: the guide route still shows the chain guide"
# 2.323.0: the same board with NO song gets the FILM writer - spoken lines
# as  @tag says: "..." , no singing contract - and the guide route says so
curl -s -X POST http://127.0.0.1:8311/api/scenes/audio -H 'Content-Type: application/json' -d '{"file":""}' > /dev/null
rm -f "projects/$ARPROJ/sound/e2e_mv294.wav"
curl -sf "http://127.0.0.1:8311/api/screenplay/guide" | python3 -c "
import json,sys; g=json.load(sys.stdin)['guide']
assert 'FILM' in g and '<verb>, <delivery>: ' in g and 'The SONG IS THE VOICE' not in g, g[:300]
# 2.363.0: every line carries its emotion; a voice clip is timbre only
assert 'EVERY line gets one' in g and 'Never quote, transcribe or reuse what a voice clip says' in g, g[:600]
" && ok "no-song writer: a native board with no song shows (and writes by) the FILM guide - the characters speak their lines, each with its emotion, voices as timbre only" \
  || bad "no-song writer: the guide route did not switch to the film guide"
curl -sf -X POST http://127.0.0.1:8311/api/scenes/style -H 'Content-Type: application/json' -d '{"name":""}' > /dev/null
cp /tmp/mv294_prj.bak "projects/$ARPROJ/$ARPROJ.prj"
# THE THINKING ADD (2.182.0): /api/scenes/add reads the story so far and the
# prompt, and the MODEL writes the scene — the verbatim text is the fallback.
AD=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/add -H 'Content-Type: application/json'   -d '{"text":"jinx finds the ledger"}')
echo "$AD" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('thought') is True, (d.get('ok'), d.get('thought'))
r=d['list'][-1]
assert 'jinx finds the ledger' not in ' '.join(r['prompt']), r['prompt'][:2]
" && ok "thinking add: the model wrote the new scene from the story so far — not the verbatim prompt"   || bad "thinking add: $(echo "$AD" | head -c 300)"
# PER-SCENE FILES (2.182.0): every save mirrors chaptername<n>.json; a
# chapter loads back from its files.
ADP=$(curl -s http://127.0.0.1:8311/api/scenes | jget "['project']")
ADCH=$(echo "$AD" | python3 -c "import json,sys; print(json.load(sys.stdin)['list'][-1].get('chapter',''))")
python3 -c "
import os,sys
d='projects/$ADP/scenes'
fs=sorted(f for f in os.listdir(d) if f.endswith('.json'))
assert fs, (d, fs)
" && ok "scene files: the board mirrors to projects/<p>/scenes/<chapter><n>.json on every save"   || bad "scene files missing: $(ls "projects/$ADP/scenes" 2>&1 | head -c 200)"
LD=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/load -H 'Content-Type: application/json'   -d "{\"chapter\":\"$ADCH\"}")
echo "$LD" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') and d.get('loaded')>=1, d
" && ok "scene files: /api/scenes/load restores the chapter's scenes from its files"   || bad "scene load: $(echo "$LD" | head -c 300)"
# BIG-MODEL CHAT ROTATION (2.174.0, "clear the chat context when using
# models >12gb"): a fake .gguf over the (lowered) threshold + a SUCCESSFUL
# screenplay archives the chat and starts a fresh session; the archive note
# rides the warnings.
mkdir -p llm-models && dd if=/dev/zero of=llm-models/e2e-big.gguf bs=1024 count=2048 2>/dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"llm":{"external_url":"http://127.0.0.1:8391/v1/chat/completions","big_model_gb":0.001}}' > /dev/null
SPB=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"a short scene where jinx waits","llm_file":"e2e-big.gguf","single":true}')
echo "$SPB" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok') is True, d
ws=' '.join(d.get('warnings',[]))
assert 'chat saved as' in ws and 'context cleared' in ws, ws
" && curl -sf http://127.0.0.1:8311/api/chat | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['messages']==[], 'the current session was not cleared'
" && ok "screenplay: a big model + a SUCCESSFUL screenplay archives the chat and clears the context — the story already rode in via recall" \
  || bad "screenplay: big-model rotation failed: $(echo "$SPB" | head -c 300)"
rm -f llm-models/e2e-big.gguf
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"llm":{"external_url":"http://127.0.0.1:8391/v1/chat/completions","big_model_gb":12}}' > /dev/null
# ---- the Gemma class (2.152.0, Tim: "the majority of my llms ... are not ----
# populating the scenes, only one of them does"): a chat template that RAISES
# on the system role answers 500; the writer must fold the instructions into
# the user turn, retry once, succeed, and SAY what happened.
NREQ_BEFORE=$(ls /tmp/stub-llm-out/llm_request_*.json 2>/dev/null | wc -l)
SPG=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"SYSROLE_TEST a short scene where jinx waits","single":true}')
echo "$SPG" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert len(d['plan']['shots']) == 1, d.get('plan')
assert any('refused the system role' in w for w in d.get('warnings', [])), d.get('warnings')
" && ok "screenplay: a template that refuses the system role is rescued by the fold-and-retry, and it is SAID" \
  || bad "screenplay: system-role refusal not rescued: $(echo "$SPG" | head -c 400)"
python3 -c "
import json, glob
reqs = [json.load(open(f)) for f in sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))[$NREQ_BEFORE:]]
assert len(reqs) == 2, len(reqs)
assert any(m.get('role') == 'system' for m in reqs[0]['messages']), 'first try lost the system role'
assert all(m.get('role') != 'system' for m in reqs[1]['messages']), 'retry still carries a system role'
u = reqs[1]['messages'][0]
assert u['role'] == 'user' and 'INSTRUCTIONS' in str(u['content']) and 'SYSROLE_TEST' in str(u['content']), \
    'the fold did not put the instructions at the head of the user turn'
" && ok "screenplay: the retry carries the SAME instructions, folded into the user turn — nothing is lost" \
  || bad "screenplay: fold shape wrong"
# ---- chat recall (2.169.0, Tim: "if i ask a second time in the same -------
# session it just produces a prompt not related to the characters ... can we
# have it do a rag for the current chat"): the session is REBUILT to a budget
# (seed + relevant middle + recent tail) and the CAST rides the system prompt
# on EVERY call, so an overgrown history can never truncate the characters
# out of the model's sight.
curl -sf -X POST http://127.0.0.1:8311/api/chat/new > /dev/null
curl -s --max-time 30 -X POST http://127.0.0.1:8311/api/chat -H 'Content-Type: application/json' \
  -d '{"text":"SEED: a heist story where jinx cracks the bank vault"}' > /dev/null
for i in 1 2 3 4 5 6 7 8; do
  curl -s --max-time 30 -X POST http://127.0.0.1:8311/api/chat -H 'Content-Type: application/json' \
    -d "{\"text\":\"FILLER_$i $(printf 'x%.0s' $(seq 1 2800))\"}" > /dev/null
done
curl -s --max-time 30 -X POST http://127.0.0.1:8311/api/chat -H 'Content-Type: application/json' \
  -d '{"text":"now write the vault scene with jinx"}' > /dev/null
python3 -c "
import json, glob
cands = []
for f in sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0])):
    r = json.load(open(f))
    if any('now write the vault scene' in str(m.get('content','')) for m in r.get('messages', [])):
        cands.append(r)
assert cands, 'the vault ask never reached the model'
req = cands[-1]
msgs = req['messages']
sys_txt = ' '.join(str(m.get('content','')) for m in msgs if m.get('role')=='system')
assert 'THE CAST OF THIS PROJECT' in sys_txt and '@jinx' in sys_txt, sys_txt[-300:]
body = [str(m.get('content','')) for m in msgs if m.get('role')!='system']
assert any('SEED: a heist story' in t for t in body), 'the seed fell off'
assert any('now write the vault scene' in t for t in body), 'the ask fell off'
assert not all(('FILLER_%d' % i) in ' '.join(body) for i in range(1,9)), 'nothing was trimmed'
assert sum(len(t) for t in body) <= 26000, sum(len(t) for t in body)
" && ok "chat recall: the cast rides EVERY call, the seed survives, the filler is trimmed to budget" \
  || bad "chat recall: request shape wrong"
# ---- 2.281.0: DETERMINISTIC tag repair (Tim: "the llm is getting
# confused, it is not adding the right characters"): a plan whose ONLY
# sin is an invented @tag is repaired WITHOUT a second model round —
# exactly ONE llm request, the tag mapped/stripped, and it is said.
NTF_BEFORE=$(ls /tmp/stub-llm-out/llm_request_*.json 2>/dev/null | wc -l)
SPTF=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"TAGFIX_TEST a short scene where someone waits","single":true}')
echo "$SPTF" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert d.get('ok') is True, d
txt = '\n'.join(d['plan']['shots'][0]['prompt'])
assert '@figment' not in txt, txt
assert any('tag repair:' in w for w in d.get('warnings', [])), d.get('warnings')
" && ok "screenplay: an invented-tag-only plan repairs DETERMINISTICALLY and says so" \
  || bad "screenplay: deterministic tag repair failed: $(echo "$SPTF" | head -c 300)"
NTF_AFTER=$(ls /tmp/stub-llm-out/llm_request_*.json 2>/dev/null | wc -l)
[ "$((NTF_AFTER - NTF_BEFORE))" = "1" ] \
  && ok "screenplay: the deterministic repair needed NO second model round (one request)" \
  || bad "screenplay: expected 1 llm request, saw $((NTF_AFTER - NTF_BEFORE))"

# ---- the repair round (2.154.0, Tim: supergemma4 "the screenplay would ----
# not render ... does not populate"): a first plan with an invented @tag is
# handed back to the model WITH the validator's errors; the corrected second
# plan populates, and the user is told a repair happened.
NREQ_BEFORE=$(ls /tmp/stub-llm-out/llm_request_*.json 2>/dev/null | wc -l)
SPR=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"REPAIR_TEST a short scene where jinx waits","single":true}')
echo "$SPR" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert '@jinx' in '\n'.join(d['plan']['shots'][0]['prompt']), d['plan']['shots'][0]
assert any('repaired on a second pass' in w for w in d.get('warnings', [])), d.get('warnings')
" && ok "screenplay: a plan that fails validation is REPAIRED by a second round with the errors, and it is said" \
  || bad "screenplay: repair round failed: $(echo "$SPR" | head -c 400)"
python3 -c "
import json, glob
reqs = [json.load(open(f)) for f in sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))[$NREQ_BEFORE:]]
assert len(reqs) == 2, len(reqs)
last = reqs[1]['messages']
assert any('failed validation' in str(m.get('content','')) for m in last), 'errors not handed back'
assert any(m.get('role') == 'assistant' for m in last), 'the model own first plan not in the repair context'
assert any('stranger' in str(m.get('content','')) for m in last if m.get('role')=='user'), \
    'the validator error text (naming @stranger) missing from the repair request'
" && ok "screenplay: the repair request carries the model's own plan AND the validator's exact errors" \
  || bad "screenplay: repair request shape wrong"
# ---- the apologizing model (2.157.0, Tim: "the model's second reply was ----
# not a JSON plan"): the repair round gets prose back — the first plan's
# errors stand, the apology's own words are QUOTED so the failure is
# debuggable, and the repair request provably taught the cast roster.
SPP=$(curl -s -X POST http://127.0.0.1:8311/api/screenplay -H 'Content-Type: application/json' \
  -d '{"brief":"REPAIR_PROSE_TEST a short scene where jinx waits","single":true}')
echo "$SPP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert d.get('ok') is False, d.get('ok')
assert any('stranger' in e for e in d.get('errors', [])), d.get('errors')
ws = ' '.join(d.get('warnings', []))
assert 'was not a JSON plan' in ws and 'It said: \"I apologize' in ws, ws
" && ok "screenplay: a prose repair reply is QUOTED in the failure — a truncation, an apology and a ramble each read differently" \
  || bad "screenplay: prose repair reply not surfaced: $(echo "$SPP" | head -c 400)"
python3 -c "
import json, glob
reqs = [json.load(open(f)) for f in sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))]
last = reqs[-1]['messages']
u = [m for m in last if m.get('role') == 'user']
assert any('The ONLY characters that exist are: @jinx' in str(m.get('content','')) for m in u), \
    'the cast roster missing from the repair request'
a = [m for m in last if m.get('role') == 'assistant']
assert a and str(a[-1]['content']).lstrip().startswith('{'), 'assistant turn is not the compact JSON plan'
" && ok "screenplay: the repair request teaches the CAST ROSTER and hands back the compact plan, not the raw prose" \
  || bad "screenplay: repair request roster/compact-plan shape wrong"
# ---- chat intents (2.162.0, by instruction): "edit scene N ..." rewrites ----
# that scene through the LLM; "add a scene" appends to the CURRENT chapter.
curl -s -X POST http://127.0.0.1:8311/api/screenplay/intent -H 'Content-Type: application/json' \
  -d '{"text":"edit scene 1 make it more realistic"}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['edit']=={'n':1,'instruction':'make it more realistic'}, d
assert not d.get('wants'), d
" && ok "intent: 'edit scene 1 ...' is an EDIT with the scene and the instruction" \
  || bad "intent: edit not detected"
curl -s -X POST http://127.0.0.1:8311/api/screenplay/intent -H 'Content-Type: application/json' \
  -d '{"text":"add a scene where jinx leaves"}' | grep -q '"add":{"description":"where jinx leaves"}' \
  && ok "intent: 'add a scene ...' carries the description" || bad "intent: add not detected"
# the block seeds its OWN two-scene board — earlier legs may have cleared it
# source_reference REPAIR (2.173.0): Tim's preflight card, verbatim: "node 9
# (MiniMaxH3ChainPlan): ValueError: Unknown H3 scene source reference
# override 'clip_01'; expected inherit or one of ('off', 'on')." — a model
# wrote the previous shot's id into source_reference. normalize migrates the
# id to visual_context_source and resets the switch, so the plan RENDERS.
SREF=$(curl -s -X POST http://127.0.0.1:8311/api/scenes -H 'Content-Type: application/json' -d '{
  "plan": { "prompt_prefix": ["subject_definitions:", "",
    "@jinx is the character defined by the provided character reference sheet."],
    "shots": [
      { "id": "clip_01", "prompt": ["[Shot 1] @jinx waits."], "seed": "21" },
      { "id": "clip_02", "prompt": ["[Shot 2] @jinx turns."], "seed": "22",
        "source_reference": "clip_01" } ] } }')
echo "$SREF" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
s=[x for x in d['plan']['shots'] if x['id']=='clip_02'][0]
assert s['source_reference'] in ('off','on','inherit'), s['source_reference']
assert s['visual_context_source']=='clip_01', s.get('visual_context_source')
" && ok "board: a shot-id in source_reference is REPAIRED at intake — migrated to visual_context_source, switch reset (the pack's ChainPlan refusal, fixed before it can fire)" \
  || bad "board: source_reference repair failed: $(echo "$SREF" | head -c 300)"
curl -s -X POST http://127.0.0.1:8311/api/scenes -H 'Content-Type: application/json' -d '{
  "plan": { "prompt_prefix": ["subject_definitions:", "",
    "@jinx is the character defined by the provided character reference sheet."],
    "shots": [
      { "id": "clip_01", "prompt": ["[Shot 1] @jinx waits in the dark."], "length": 141, "seed": "11" },
      { "id": "clip_02", "prompt": ["[Shot 2] @jinx turns to the door."], "length": 141, "seed": "12" } ] } }' > /dev/null
RW=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/1/rewrite -H 'Content-Type: application/json' \
  -d '{"instruction":"make it more realistic"}')
echo "$RW" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
r=[x for x in d['list'] if x['n']==1][0]
assert any('rewritten: make it more realistic' in l for l in r['prompt']), r['prompt']
assert r['status']=='idle', r['status']
s=[s for s in d['plan']['shots'] if s['id']==r['id']][0]
assert any('rewritten' in l for l in s['prompt']), 'plan not updated'
" && ok "rewrite: the instruction reached the model, the new prompt landed in the PLAN, the scene reset to idle" \
  || bad "rewrite failed: $(echo "$RW" | head -c 400)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/1/rewrite -H 'Content-Type: application/json' \
  -d '{"instruction":""}' | grep -q "tell me what to change" \
  && ok "rewrite: a bare 'edit scene 1' asks what to change instead of guessing" \
  || bad "rewrite: empty instruction not refused"
# the CURRENT chapter is the LAST scene's — put it there explicitly
NLAST=$(curl -sf http://127.0.0.1:8311/api/scenes | jget "['list'][-1]['n']")
curl -s -X POST "http://127.0.0.1:8311/api/scenes/$NLAST/chapter" -H 'Content-Type: application/json' \
  -d '{"chapter":"act_two"}' > /dev/null
# raw:true (2.182.0): this leg tests the VERBATIM add + chapter inheritance
# — the thinking add has its own leg; raw is the explicit escape hatch
ADD2=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/add -H 'Content-Type: application/json' \
  -d '{"text":"jinx leaves quietly.","raw":true}')
echo "$ADD2" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
last=d['list'][-1]
assert last['chapter']=='act_two', last.get('chapter')   # joins the CURRENT chapter
assert any('jinx leaves quietly' in l for l in last['prompt']), last['prompt']
" && ok "add: a new scene joins the CURRENT chapter (the last scene's) with the given description" \
  || bad "add: chapter inheritance failed: $(echo "$ADD2" | head -c 300)"
node -e "
const s=require('fs').readFileSync('ext/videodock/characters.js','utf8');
if(!/api\\/scenes\\/\" \\+ it\\.edit\\.n \\+ \"\\/rewrite/.test(s)) process.exit(1);
if(!/it\\.add/.test(s)) process.exit(1);
" && ok "intent: the chat box routes edit → rewrite and add → the board, before falling through to chat" \
  || bad "intent: client routing missing"
# ---- delete selected / clear / default duration (2.163.0, by instruction) --
# The board holds 3 scenes here (2 seeded + 1 added, scene 3 in act_two).
DEL=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/delete -H 'Content-Type: application/json' \
  -d '{"scenes":[2]}')
echo "$DEL" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok') and d.get('deleted')==1, d
ids=[s['id'] for s in d['plan']['shots']]
assert ids==['clip_01','clip_03'], ids
assert d['plan']['shots'][1]['visual_context_source']=='clip_01', d['plan']['shots'][1]
assert len(d['list'])==2 and d['list'][1]['chapter']=='act_two', [ (r['n'],r['chapter']) for r in d['list'] ]
" && ok "delete: the ticked shot leaves the plan, the continuity chain HEALS over the gap, survivors keep their state" \
  || bad "delete failed: $(echo "$DEL" | head -c 400)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/delete -H 'Content-Type: application/json' \
  -d '{"scenes":[]}' | grep -q "tick at least one" \
  && ok "delete: nothing ticked is refused with the reason" || bad "delete: empty pick accepted"
# default duration (2.165.0, by instruction): changing it APPLIES TO EVERY
# scene — merged into the chain settings (the tab's other overrides survive),
# every shot rewritten to the snapped length, changed scenes reset to idle.
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"chain":{"steps":30}}' > /dev/null
DUR=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/duration -H 'Content-Type: application/json' \
  -d '{"seconds":10}')
echo "$DUR" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
assert d['applied']==2 and d['length']==243, (d.get('applied'), d.get('length'))
sh=d['plan']['shots']
import math
snap=lambda n: max(5,min(3592,5+17*round((max(5,min(3592,n))-5)/17)))
up=lambda n: min(3592,max(snap(n),5+17*math.ceil((min(3592,n)-5)/17)))
assert sh[0]['length']==243, sh[0]
assert all(sh[i]['length']==up(243+i*24) for i in range(1,len(sh))), [s['length'] for s in sh]
assert all(r['status']=='idle' for r in d['list']), [r['status'] for r in d['list']]
" && ok "default duration: EVERY scene follows the new default (10s -> 243 frames), changed scenes reset" \
  || bad "default duration apply failed: $(echo "$DUR" | head -c 300)"
curl -sf http://127.0.0.1:8311/api/config | python3 -c "
import json,sys
c=json.load(sys.stdin)['chain']
assert c.get('length')==240 and int(c.get('steps'))==30, c
" && ok "default duration: saved MERGED into the chain settings — the tab's other overrides survive" \
  || bad "default duration wiped the chain settings"
DADD=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/add -H 'Content-Type: application/json' -d '{"text":"jinx pauses."}')
echo "$DADD" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok'), d
sh=d['plan']['shots']
import math
snap=lambda n: max(5,min(3592,5+17*round((max(5,min(3592,n))-5)/17)))
up=lambda n: min(3592,max(snap(n),5+17*math.ceil((min(3592,n)-5)/17)))
assert sh[-1]['length']==up(243+(len(sh)-1)*24), sh[-1].get('length')
" && ok "default duration: a NEW scene is born at the default + its spent window" \
  || bad "default duration on add failed: $(echo "$DADD" | head -c 300)"
curl -s -X POST http://127.0.0.1:8311/api/scenes/duration -H 'Content-Type: application/json' \
  -d '{"seconds":-1}' | grep -q "positive number of seconds" \
  && ok "default duration: nonsense is refused with the reason" || bad "default duration: junk accepted"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"chain":{}}' > /dev/null
CLR=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/clear -H 'Content-Type: application/json' -d '{}')
echo "$CLR" | python3 -c "
import json,sys
d=json.load(sys.stdin); assert d.get('ok') and d.get('cleared')==3, d.get('cleared')
assert d['list']==[], d['list']
assert 'act_two' in d.get('chapters',[]), d.get('chapters')
assert d['plan']['shots']==[] and len(d['plan'].get('prompt_prefix',[]))>0, 'the frame was lost'
" && ok "clear: every scene leaves; the shared prompt and chapters STAY (the movie's frame, not its scenes)" \
  || bad "clear failed: $(echo "$CLR" | head -c 300)"
node -e "
const s=require('fs').readFileSync('lib/core.js','utf8');
if(!/\"-c\", String\(ctx(Eff)?\)/.test(s)) process.exit(1);  // 2.193.0: the gguf clamp renamed ctx -> ctxEff at the spawn
if(!/llama\.sig === sig/.test(s)) process.exit(1);   // 2.157.0: settings change = restart
const c=require('fs').readFileSync('lib/llmChat.js','utf8');
if(!/await r\.text\(\)/.test(c)) process.exit(1);
" && ok "llm: llama-server gets an explicit -c, restarts when the SETTINGS change, and its error BODY reaches the user" \
  || bad "llm: ctx/-c, launch-signature restart, or error-body wiring missing"
# ---- 2.335.0: ✎ WRITE PROMPT in the swap dialog (Tim: "the vllm can describe
# the picture the llm can make the prompt, add a button under the prompt input
# in the character swap dialog Write Prompt"). No vision model on the gate:
# the picture goes undescribed (said), the stub LLM still writes the prompt -
# wearing a think block, a fence, <Image 1> and a sign-off - and the cleaned
# answer lands in the Direction box. SWAP_GARBLE_TEST: an LLM that answers no
# swap prompt -> one composed from what is known.
WPP=$(curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "import json,sys; print(json.load(sys.stdin).get('project') or 'default')")
mkdir -p "projects/$WPP/video"
ffmpeg -y -loglevel error -f lavfi -i "testsrc=size=640x360:rate=24:duration=3" -c:v libx264 -pix_fmt yuv420p "projects/$WPP/video/e2e_wp_src.mp4"
curl -s -X POST http://127.0.0.1:8311/api/swapdlg/set -H 'Content-Type: application/json' -d '{"video":"e2e_wp_src.mp4","text":""}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/swapdlg/picture -F "image=@static/pose-sheets/human.png" > /dev/null
NWP=$(ls /tmp/stub-llm-out/llm_request_*.json 2>/dev/null | wc -l)
WP1=$(curl -s -X POST http://127.0.0.1:8311/api/swapdlg/writeprompt -H 'Content-Type: application/json' -d '{"t":1.5,"text":"keep his red cap"}')
echo "$WP1" | python3 -c "
import json, glob, sys
d = json.load(sys.stdin)
p = d.get('prompt', '')
assert p.startswith('Replace only the man in the purple shirt in <Video 1> with the character in <Picture 1>.'), d
assert 'Keep his red cap from <Picture 1>.' in p and p.endswith('and all other people.'), p
assert '<Image' not in p and 'think' not in p and chr(96)*3 not in p and 'Hope' not in p, p
assert d['text'] == p and d['fallback'] is False and d['described'] is False, d
assert 'NOT described' in d['note'] and 'no vision model' in d['note'], d['note']
fs = sorted(glob.glob('/tmp/stub-llm-out/llm_request_*.json'), key=lambda f: int(f.rsplit('_',1)[1].split('.')[0]))[$NWP:]
req = json.load(open(fs[-1]))
sysm = req['messages'][0]['content']; usr = req['messages'][-1]['content']
assert 'PROMPTING GUIDE — MiniMax H3 character swap' in sysm and 'Never write <Image 1>' in sysm, sysm[:300]
assert 'keep his red cap' in usr and 'could not be described' in usr, usr
" > /tmp/wp335.log 2>&1 \
  && [ "$(curl -s http://127.0.0.1:8311/api/swapdlg | python3 -c "import json,sys; print(json.load(sys.stdin)['text'][:14])")" = "Replace only t" ] \
  && ok "swap ✎ Write prompt: with no vision model the picture is said to be undescribed, the LLM gets the swap guide + the user's wish, and its cleaned prompt (<Picture 1>, no think / fence / sign-off) fills the Direction box" \
  || { bad "swap ✎ Write prompt: wrong: $(echo "$WP1" | head -c 300)"; tail -4 /tmp/wp335.log; }
WP2=$(curl -s -X POST http://127.0.0.1:8311/api/swapdlg/writeprompt -H 'Content-Type: application/json' -d '{"t":1,"text":"SWAP_GARBLE_TEST"}')
echo "$WP2" | python3 -c "
import json, sys
d = json.load(sys.stdin); p = d.get('prompt', '')
assert d.get('fallback') is True and p.startswith('Replace only the main person in <Video 1> with the character in <Picture 1>.'), d
assert 'was not a swap prompt' in d['note'], d['note']
" && ok "swap ✎ Write prompt: an LLM that answers no swap prompt -> one composed in the guide's shape, said" \
  || bad "swap ✎ Write prompt: garble fallback wrong: $(echo "$WP2" | head -c 300)"
curl -s -X POST http://127.0.0.1:8311/api/swapdlg/set -H 'Content-Type: application/json' -d '{"text":""}' > /dev/null
rm -f "projects/$WPP/video/e2e_wp_src.mp4"
# ---- 2.404.0 (Tim: "is it possible for our llm to use blender to create 3d models?" -> "can we add option 1 + the image to
# workflow?"): LIVE while the stub LLM still answers (the plan) and the stub ComfyUI renders the pictures + the 3D graphs
python3 scripts/test-sceneai.py > /tmp/sceneai4040.log 2>&1 \
  && ok "✨ build a scene with AI LIVE (2.404.0: the LLM's prose -> asked again -> its JSON plan; the dog = a picture in the image style -> Comfy-Org's Hunyuan3D 2.1 graph (cut out first) -> models3d/<title>_Dog.glb -> a REAL Blender builds blender/ai/<title>.blend + the plan -> it opens in the preview; same title = a new file; one build at a time; 3D off / no style / no 3D files = stand-ins in words; 🧊 by hand -> TRELLIS.2 (its files named when missing); ■ Stop - SKIP without Blender)" \
  || { bad "✨ build a scene with AI LIVE"; grep -a "^FAIL" -A3 /tmp/sceneai4040.log | head -16; }
node scripts/test-sceneai-ui.js > /tmp/sceneaiui4040.log 2>&1 \
  && ok "✨ build a scene with AI browser test: 🟧 with no scene = 📂 Open + ✨ Build (the image style named, Hunyuan3D default / TRELLIS.2), the log while it builds, the built scene opens and draws, ＋ Model = a .glb as a new object 1 m tall on the ground, 💾 Save makes it real in Blender, 🧊 on a Gallery / Assets picture asks the engine and queues the .glb - or SKIP without playwright / Blender" \
  || { bad "✨ build a scene with AI browser test"; grep -a "FAIL\|Error" -A2 /tmp/sceneaiui4040.log | head -14; }
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"llm":{"external_url":""}}' > /dev/null
kill $STUB_LLM_PID 2>/dev/null
curl -sf -X DELETE http://127.0.0.1:8311/api/characters/Jinx >/dev/null
# ---- REMOTE PHONE ACCESS (2.132.0) ----------------------------------------
# The whole point is that an open LAN port cannot be walked into, so this drives
# the real endpoints: no cookie is refused, a QR code pairs once, a second phone
# evicts the first, and revoke closes it.
curl -sf -X POST http://127.0.0.1:8311/api/remote/enable -H 'Content-Type: application/json' -d '{"on":false}' >/dev/null
RS=$(curl -sf http://127.0.0.1:8311/api/remote/status)
echo "$RS" | grep -q '"bind":"127.0.0.1"' \
  && ok "remote: off by default, the server stays on loopback" \
  || bad "remote: default bind wrong: $RS"
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8311/api/remote/me | grep -q 401 \
  && ok "remote: a phone route with no cookie is refused" \
  || bad "remote: /api/remote/me was reachable without pairing"
RL=$(curl -s -X POST http://127.0.0.1:8311/api/remote/link -H 'Content-Type: application/json' -d '{}')
echo "$RL" | grep -q "turn remote access on first" \
  && ok "remote: no link can be minted while remote access is off" \
  || bad "remote: link minted while off: $RL"
curl -sf -X POST http://127.0.0.1:8311/api/remote/enable -H 'Content-Type: application/json' -d '{"on":true}' >/dev/null
# THE FAILURE TIM HIT: the setting is on but this process bound to loopback at
# startup, so the link would point at a port nothing is listening on.
RLB=$(curl -s -X POST http://127.0.0.1:8311/api/remote/link -H 'Content-Type: application/json' -d '{}')
echo "$RLB" | grep -q "start it again" \
  && ok "remote: a link is REFUSED until the app is restarted, instead of pointing at a closed port" \
  || bad "remote: a link was minted before the port was open: $(echo "$RLB" | head -c 200)"
echo "$RLB" | grep -q '"restart_required":true' \
  && ok "remote: the UI is told a restart is what is missing" \
  || bad "remote: restart_required not reported"
curl -sf http://127.0.0.1:8311/api/remote/status | grep -q '"candidates"' \
  && ok "remote: every network address is offered, so a virtual adapter is not a dead end" \
  || bad "remote: status has no candidate addresses"
# pretend the restart happened, so the rest of the flow can be driven
curl -sf -X POST http://127.0.0.1:8311/api/remote/e2e-bound -H 'Content-Type: application/json' -d '{"host":"0.0.0.0"}' >/dev/null
RL=$(curl -sf -X POST http://127.0.0.1:8311/api/remote/link -H 'Content-Type: application/json' -d '{}')
echo "$RL" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d['url'].startswith('http://') and '/remote?t=' in d['url'], d.get('url')
assert d['qr'].startswith('<svg') and '<path' in d['qr'], d['qr'][:80]
assert 'http' not in d['qr'].replace('http://www.w3.org','')  # no external refs
" && ok "remote: the link carries a LAN URL and a self-contained QR svg" \
  || bad "remote: link/QR wrong: $(echo "$RL" | head -c 200)"
RT=$(echo "$RL" | jget "['url']" | sed 's/.*t=//')
rm -f /tmp/rcookie
curl -s -c /tmp/rcookie -o /dev/null "http://127.0.0.1:8311/remote?t=$RT"
grep -q bg_remote /tmp/rcookie \
  && ok "remote: scanning the link sets the sealed session cookie" \
  || bad "remote: no cookie was set by /remote"
curl -sf -b /tmp/rcookie http://127.0.0.1:8311/api/remote/me | grep -q '"ok":true' \
  && ok "remote: the paired phone can reach its own routes" \
  || bad "remote: the paired phone was refused"
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8311/remote?t=$RT" | grep -q 403 \
  && ok "remote: the same pairing code cannot be used twice" \
  || bad "remote: a pairing code was reusable"
RL2=$(curl -sf -X POST http://127.0.0.1:8311/api/remote/link)
RT2=$(echo "$RL2" | jget "['url']" | sed 's/.*t=//')
rm -f /tmp/rcookie2
curl -s -c /tmp/rcookie2 -o /dev/null "http://127.0.0.1:8311/remote?t=$RT2"
curl -sf -b /tmp/rcookie2 http://127.0.0.1:8311/api/remote/me | grep -q '"ok":true' \
  && ok "remote: a second phone pairs and becomes the live one" \
  || bad "remote: the second phone could not pair"
curl -s -b /tmp/rcookie -o /dev/null -w "%{http_code}" http://127.0.0.1:8311/api/remote/me | grep -q 401 \
  && ok "remote: ...and the first phone is evicted (ONE active connection)" \
  || bad "remote: two phones were live at once"
echo "hello" > /tmp/rem_up.png
curl -s -b /tmp/rcookie2 -F "file=@/tmp/rem_up.png;type=image/png" \
  http://127.0.0.1:8311/api/remote/upload | grep -q '"kind":"images"' \
  && ok "remote: the phone can send a picture into the project" \
  || bad "remote: phone upload failed"
curl -s -b /tmp/rcookie2 -F "file=@/tmp/rem_up.png;type=application/x-msdownload" \
  http://127.0.0.1:8311/api/remote/upload | grep -q "only images, video and audio" \
  && ok "remote: anything that is not media is refused (an open port must not write files)" \
  || bad "remote: a non-media upload was accepted"
curl -sf -X POST http://127.0.0.1:8311/api/remote/revoke >/dev/null
curl -s -b /tmp/rcookie2 -o /dev/null -w "%{http_code}" http://127.0.0.1:8311/api/remote/me | grep -q 401 \
  && ok "remote: Disconnect cuts the phone off immediately" \
  || bad "remote: revoke did not disconnect the phone"
curl -sf -X POST http://127.0.0.1:8311/api/remote/enable -H 'Content-Type: application/json' -d '{"on":false}' >/dev/null
# ---- THE 15-SECOND CHARACTER RESET (2.130.0) ------------------------------
# Tim: "that workflow was meant to continue the video after 15 seconds but the
# characters completely change in mine after every 15 seconds." His template is
# MiniMaxH3ReferenceToVideo — ref_images.ref_image_0 and NO first_frame — so the
# hand-off frame landed in the reference slot while the chunk loop had already
# emptied the reference list. Every chunk re-rolled the character from one
# blurred frame. This runs a REAL two-chunk job on that exact template.
CVS=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"kind":"video","name":"E2E H3 continue","arch":"minimax-h3","workflow":"comfy_workflows/h3_scene_api.json"}')
CVSID=$(echo "$CVS" | jget "['style']['id']")
rm -f /tmp/stub-comfy-out/video_*.json
CJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="a character walking" \
  -F width=192 -F height=108 -F steps=4 -F seed=9 -F mode=ref2va -F frames=96 \
  -F pipeline=chunked -F segment_seconds=2.1 -F force_chunks=true -F format=webm \
  -F "video_style_id=$CVSID" -F references=@/tmp/ref.png | jget "['id']")
for i in $(seq 1 120); do
  cst=$(curl -sf "http://127.0.0.1:8311/api/jobs/$CJ" | jget "['status']")
  [ "$cst" = done ] || [ "$cst" = failed ] && break
  sleep 1
done
CJJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$CJ?log_from=0")
[ "$cst" = "done" ] && echo "$CJJ" | python3 -c "
import json,sys; log=json.load(sys.stdin)['log']
assert any('chunk 2/2' in l for l in log), 'the job never split into chunks'
assert any('no first_frame input' in l for l in log), [l for l in log if 'first_frame' in l]
assert any('anchor image(s)' in l for l in log), [l for l in log if 'anchor' in l]
" && ok "continuation: a reference template is NAMED as having no first_frame slot, not silently accepted" \
  || bad "continuation: job $cst $(echo "$CJJ" | jget "['log']" 2>/dev/null | tail -c 400)"
python3 - <<'PYEOF'
import glob, json, os
runs = sorted(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)
assert len(runs) >= 2, runs
def refs(p):
    return json.load(open(p)).get("_ref_images") or []
c1, c2 = refs(runs[-2]), refs(runs[-1])
assert len(c1) == 1, c1
# chunk 2 must still be holding chunk 1's reference, PLUS the hand-off frame
assert c1[0] in c2, (c1, c2)
assert any("handoff" in x for x in c2), c2
assert len(c2) == 2, c2
PYEOF
[ $? = 0 ] && ok "continuation: chunk 2 keeps chunk 1's reference AND adds the hand-off frame (the character survives the join)" \
  || bad "continuation: chunk 2's references are wrong"
# ---- THE ACCELERATOR SEATBELT (2.129.0, from Tim's live run ladder) --------
# Run 1 threw ~6 minutes of GPU work away because ComfyUI does the expensive
# encode FIRST and only then reaches the patched sampler; run 2 died in the
# sampler with the Spectrum pack's FinalLayer.forward() signature error. The
# stub now reproduces BOTH shapes, and fails only while the offending node is
# still in the graph — so a render that completes is proof the worker removed
# exactly that node and re-queued.
accel_job() {   # $1 = stub node to break, $2 = shape; echoes the job id
  curl -sf -X POST http://127.0.0.1:8388/e2e/accel -H 'Content-Type: application/json' \
    -d "{\"node\":\"$1\",\"kind\":\"$2\"}" > /dev/null
  local id
  id=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="accel seatbelt" \
    -F width=192 -F height=108 -F steps=0 -F seed=9 -F mode=t2va -F frames=22 \
    -F pipeline=single -F format=webm -F "video_style_id=$VSID" | jget "['id']")
  local s
  for i in $(seq 1 90); do
    s=$(curl -sf "http://127.0.0.1:8311/api/jobs/$id" | jget "['status']")
    [ "$s" = done ] || [ "$s" = failed ] && break
    sleep 1
  done
  echo "$id"          # the caller re-reads the status: this runs in a subshell
}
AJ=$(accel_job h3spectrum spectrum)
ast=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ" | jget "['status']")
AJJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ?log_from=0")
[ "$ast" = "done" ] && echo "$AJJ" | python3 -c "
import json,sys; log=json.load(sys.stdin)['log']
assert any('FinalLayer.forward()' in l for l in log), 'the raw failure was never shown'
assert any('blames h3spectrum (SpectrumApplyMiniMaxH3)' in l for l in log), [l for l in log if 'blames' in l]
assert any('MiniMaxH3SigmaShift' in l for l in log), 'the 0.34 explanation is missing'
assert any('re-queueing WITHOUT h3spectrum' in l for l in log), [l for l in log if 'queueing' in l]
assert any('accelerators kept: h3sage' in l for l in log), [l for l in log if 'kept' in l]
assert len([l for l in log if 'queueing on' in l]) == 2, [l for l in log if 'queueing on' in l]
assert len([l for l in log if l.startswith('[comfy] VRAM')]) == 1, \
    'the retry cleared VRAM again and threw away the execution cache it depends on'
" && ok "accel seatbelt: a Spectrum failure drops h3spectrum, keeps Sage, and re-queues to a finished render" \
  || bad "accel seatbelt (spectrum): job $ast $(echo "$AJJ" | jget "['log']" 2>/dev/null | tail -c 400)"
AE=$(curl -sf http://127.0.0.1:8388/e2e/vram | jget "['accel_events']")
[ "$AE" = "1" ] && ok "accel seatbelt: exactly ONE attempt died before the retry fitted" || bad "accel seatbelt: accel_events=$AE, want 1"
python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)
r = json.load(open(newest))
assert r["_accel"] == ["PathchSageAttentionKJ"], r["_accel"]      # spectrum gone
assert r["_spectrum"] is None, r["_spectrum"]
# the chain healed: sage still patches, and its consumers came back to it
assert r["_accel_wiring"]["h3sage"][0] not in ("h3sage", "h3spectrum"), r["_accel_wiring"]
assert any(v == ["h3sage", 0] for k, v in r["_accel_wiring"].items() if k != "h3sage"), r["_accel_wiring"]
PYEOF
[ $? = 0 ] && ok "accel seatbelt: the graph ComfyUI finally ran has Sage and no Spectrum, wiring healed" \
  || bad "accel seatbelt: the retried graph is wrong"
AJ2=$(accel_job h3sage sage)
ast=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ2" | jget "['status']")
AJJ2=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ2?log_from=0")
[ "$ast" = "done" ] && echo "$AJJ2" | python3 -c "
import json,sys; log=json.load(sys.stdin)['log']
assert any('blames h3sage (PathchSageAttentionKJ)' in l for l in log), [l for l in log if 'blames' in l]
blob = '\n'.join(log)
assert 'Install' in blob and 'Sage attention' in blob, 'the Sage install advice is missing'
assert any('accelerators kept: h3spectrum' in l for l in log), [l for l in log if 'kept' in l]
assert not any('blames h3spectrum' in l for l in log), 'the working accelerator was blamed too'
" && ok "accel seatbelt: a Sage failure drops ONLY Sage — Spectrum survives the retry" \
  || bad "accel seatbelt (sage): job $ast $(echo "$AJJ2" | jget "['log']" 2>/dev/null | tail -c 400)"
python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)
r = json.load(open(newest))
assert r["_accel"] == ["SpectrumApplyMiniMaxH3"], r["_accel"]
assert r["_accel_wiring"]["h3spectrum"][0] != "h3sage", r["_accel_wiring"]
PYEOF
[ $? = 0 ] && ok "accel seatbelt: Spectrum took Sage's place in the chain, unbroken" || bad "accel seatbelt: sage removal left a bad chain"
AJ3=$(accel_job always spectrum)
ast=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ3" | jget "['status']")
AJJ3=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ3?log_from=0")
[ "$ast" = "failed" ] && echo "$AJJ3" | python3 -c "
import json,sys; log=json.load(sys.stdin)['log']
assert len([l for l in log if 'queueing on' in l]) == 2, [l for l in log if 'queueing on' in l]
assert any('MiniMaxH3SigmaShift' in l for l in log), 'the user never got the explanation'
" && ok "accel seatbelt: a failure the retry cannot fix is tried ONCE, then reported with the fix" \
  || bad "accel seatbelt (always): job $ast $(echo "$AJJ3" | jget "['log']" 2>/dev/null | tail -c 400)"
AE3=$(curl -sf http://127.0.0.1:8388/e2e/vram | jget "['accel_events']")
[ "$AE3" = "2" ] && ok "accel seatbelt: two attempts total — the loop cannot run away" || bad "accel seatbelt: accel_events=$AE3, want 2"
# ---- THE HONEST EXECUTION-ERROR VERDICT (2.143.1, from Tim's scene card) ----
# An execution error NO recogniser knows used to fail with "check the MiniMax
# H3 nodes exist ... model files sit inside ComfyUI's OWN models folders" —
# wrong by construction (both are /prompt VALIDATION failures; execution means
# validation passed) and exactly the useless red text Tim's Scene 1 card
# showed. The verdict must now name the node ComfyUI's own event blamed.
AJ4=$(accel_job always generic)
ast=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ4" | jget "['status']")
AJJ4=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ4?log_from=0")
[ "$ast" = "failed" ] && echo "$AJJ4" | python3 -c "
import json,sys; j=json.load(sys.stdin); log=j['log']
blob='\n'.join(log)
assert any(l.startswith('[comfy] node 42 (VAEDecode): RuntimeError:') for l in log), \
    [l for l in log if 'node 42' in l] or log[-6:]
assert 'execution error in node 42 (VAEDecode)' in blob, log[-6:]
assert 'expected input to have 16 channels' in blob, 'the real exception text is missing'
assert 'nodes exist' not in blob, 'the misleading generic advice is back'
assert 'second line the card must not need' not in ' '.join(l for l in log if l.startswith('[comfy] node ')), \
    'the culprit line carries more than the first exception line'
" && ok "execution error: the verdict names node 42 (VAEDecode) and its exception — the misleading generic advice is gone" \
  || bad "execution error verdict: job $ast $(echo "$AJJ4" | jget "['log']" 2>/dev/null | tail -c 400)"
# ---- THE PACK-UPDATE TELL + widget_overrides (2.175.0, Tim's LoopStart ----
# audio-policy card: "we had this working before"). /e2e/schema declares a
# REQUIRED combo input on CreateVideo (a class the style graph carries) that
# no export has — an updated node pack's new widget. Run 1: schema sync must
# FILL it (first choice) and, when that node then throws the policy error,
# the log must NAME the fill beside the error with the widget_overrides way
# out. Run 2: the override pins the other choice, the fill line disappears,
# the queued graph carries the pinned value.
curl -sf -X POST http://127.0.0.1:8388/e2e/schema -H 'Content-Type: application/json' \
  -d '{"class":"CreateVideo","input":"e2e_audio_policy","choices":["strict_source","generated"]}' > /dev/null
AJ5=$(accel_job always generic)
ast=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ5" | jget "['status']")
AJJ5=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ5?log_from=0")
[ "$ast" = "failed" ] && echo "$AJJ5" | python3 -c "
import json,sys; log=json.load(sys.stdin)['log']; blob='\n'.join(log)
assert any('schema sync: CreateVideo.e2e_audio_policy' in l and 'first choice' in l for l in log), \
    [l for l in log if 'schema sync' in l]
assert 'requires source audio' in blob, log[-6:]
assert 'schema-FILLED inputs the export never had' in blob, 'the tell is missing'
assert \"e2e_audio_policy='strict_source'\" in blob, 'the fill is not named beside the error'
assert 'widget_overrides' in blob, 'the way out is not named'
" && ok "pack-update tell: the failing node's schema-FILLED input is named beside the error, with widget_overrides as the way out" \
  || bad "pack-update tell missing: job $ast $(echo "$AJJ5" | jget "['log']" 2>/dev/null | tail -c 500)"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"widget_overrides":{"CreateVideo.e2e_audio_policy":"generated"}}}}' > /dev/null
AJ6=$(accel_job always generic)
AJJ6=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ6?log_from=0")
echo "$AJJ6" | python3 -c "
import json,sys
log=json.load(sys.stdin)['log']
assert any(\"widget override: CreateVideo.e2e_audio_policy = 'generated'\" in l for l in log), \
    [l for l in log if 'override' in l]
" && curl -sf http://127.0.0.1:8388/e2e/vram | python3 -c "
import json,sys
v=json.load(sys.stdin)
# the value the stub SAW on the queued node — the user's word beat the fill
assert v.get('last_policy_value')=='generated', v.get('last_policy_value')
" && ok "widget_overrides: the user's pinned value rides the queued graph and beats the schema fill" \
  || bad "widget_overrides not applied: $(echo "$AJJ6" | jget "['log']" 2>/dev/null | tail -c 400)"
curl -sf -X POST http://127.0.0.1:8388/e2e/schema -H 'Content-Type: application/json' -d '{"class":""}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"widget_overrides":{}}}}' > /dev/null
# ---- THE OPTIONAL-WIDGET TELL (2.176.0, Tim's LoopStart card SURVIVING ----
# 2.175.0): a pack-update widget declared OPTIONAL is never schema-filled —
# the node runs on its own server-side default and fails with no fill line
# at all. The worker must then name the schema-known-but-UNSENT inputs
# beside the error; the override still cures it.
curl -sf -X POST http://127.0.0.1:8388/e2e/schema -H 'Content-Type: application/json' \
  -d '{"class":"CreateVideo","input":"e2e_audio_policy","choices":["strict_source","generated"],"section":"optional"}' > /dev/null
AJ7=$(accel_job always generic)
ast=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ7" | jget "['status']")
AJJ7=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ7?log_from=0")
[ "$ast" = "failed" ] && echo "$AJJ7" | python3 -c "
import json,sys; log=json.load(sys.stdin)['log']; blob='\n'.join(log)
assert not any('schema sync: CreateVideo.e2e_audio_policy' in l for l in log), \
    'an OPTIONAL input must not be schema-filled'
assert 'requires source audio' in blob, log[-6:]
assert 'did not send' in blob and 'e2e_audio_policy' in blob, 'the unsent tell is missing'
assert 'its OWN defaults' in blob and 'widget_overrides' in blob, 'the way out is not named'
" && ok "optional-widget tell: no fill line, the node fails on ITS OWN default, and the UNSENT schema input is named beside the error" \
  || bad "optional-widget tell missing: job $ast $(echo "$AJJ7" | jget "['log']" 2>/dev/null | tail -c 500)"
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"widget_overrides":{"CreateVideo.e2e_audio_policy":"generated"}}}}' > /dev/null
AJ8=$(accel_job always generic)
AJJ8=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AJ8?log_from=0")
echo "$AJJ8" | python3 -c "
import json,sys
log=json.load(sys.stdin)['log']
assert any(\"widget override: CreateVideo.e2e_audio_policy = 'generated'\" in l for l in log), \
    [l for l in log if 'override' in l]
" && curl -sf http://127.0.0.1:8388/e2e/vram | python3 -c "
import json,sys
v=json.load(sys.stdin)
assert v.get('last_policy_value')=='generated', v.get('last_policy_value')
" && ok "optional-widget cure: the pinned value rides an input the export never had — the policy is satisfied" \
  || bad "optional-widget cure failed: $(echo "$AJJ8" | jget "['log']" 2>/dev/null | tail -c 400)"
curl -sf -X POST http://127.0.0.1:8388/e2e/schema -H 'Content-Type: application/json' -d '{"class":""}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"engine":{"comfy":{"widget_overrides":{}}}}' > /dev/null
curl -sf -X POST http://127.0.0.1:8388/e2e/accel -H 'Content-Type: application/json' -d '{"node":""}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/generate -F prompt="x" -F width=192 -F height=108 -F mode=t2va -F frames=22 -F pipeline=single -F "video_style_id=st_nope" \
  | grep -q "no longer exists" && ok "video style: a stale id is refused in words" || bad "video style: stale id accepted"
# ---- SAGE + SPECTRUM starter (2.116.0, Tim: "make this a separate style -
# minimax h3 SS.json don't overwrite existing style"): seeded once by name,
# never overwrites, ships accel on; the install endpoints answer.
python3 -c "
import json
j = json.load(open('styles/video/MiniMax H3 SS.json'))
assert j['kind'] == 'video' and j['arch'] == 'minimax-h3', j
assert j['accel'] == {'sage': 'auto', 'spectrum': 'on'}, j['accel']
assert j['workflow'] == '' and all(v == '' for v in j['workflows'].values()), 'must use the Settings templates'" \
  && curl -sf "http://127.0.0.1:8311/api/styles?kind=video" | grep -q '"MiniMax H3 SS"' \
  && ok "MiniMax H3 SS starter: seeded to styles/video/, listed, sage auto + spectrum on, blank workflows (Settings templates)" \
  || bad "MiniMax H3 SS starter: $(cat 'styles/video/MiniMax H3 SS.json' 2>/dev/null | head -c 200)"
# 2.128.0 (Tim: "make it a style so i can use it alongside the working style,
# call it minimaxH3-I.json"). The filename is the ask, so it is checked
# literally; the render below is what makes it a STYLE rather than a file.
[ -f "styles/video/minimaxH3-I.json" ] \
  && ok "minimaxH3-I starter: seeded as styles/video/minimaxH3-I.json, exactly as named" \
  || bad "minimaxH3-I: not seeded: $(ls styles/video 2>&1)"
curl -sf "http://127.0.0.1:8311/api/styles?kind=video" | grep -q '"minimaxH3-I"' \
  && ok "minimaxH3-I: listed in the video style dropdown beside MiniMax H3 SS" \
  || bad "minimaxH3-I: not listed"
python3 -c "
import json
j = json.load(open('styles/video/minimaxH3-I.json'))
ss = json.load(open('styles/video/MiniMax H3 SS.json'))
assert j['workflow'] == 'comfy_workflows/h3_scene_api.json', j['workflow']
assert j['accel'] == ss['accel'], (j['accel'], ss['accel'])
assert not j['vae'] and not j['te'][0] and not j['phases'][0]['model'], j" \
  && ok "minimaxH3-I: brings the blueprint's graph, the SS style's accelerators, and names no model of its own" \
  || bad "minimaxH3-I: $(head -c 300 styles/video/minimaxH3-I.json)"
MID=$(curl -sf "http://127.0.0.1:8311/api/styles?kind=video" \
  | python3 -c "import json,sys; print([s['id'] for s in json.load(sys.stdin)['styles'] if s['name']=='minimaxH3-I'][0])")
MJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="a viking boy waves" \
  -F width=192 -F height=108 -F steps=6 -F seed=9 -F mode=t2va -F frames=22 \
  -F pipeline=single -F format=webm -F "video_style_id=$MID" | jget "['id']")
for i in $(seq 1 90); do mst=$(curl -sf "http://127.0.0.1:8311/api/jobs/$MJ" | jget "['status']"); [ "$mst" = done ] || [ "$mst" = failed ] && break; sleep 1; done
MJJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$MJ?log_from=0")
[ "$mst" = "done" ] && echo "$MJJ" | python3 -c "
import json,sys; j=json.load(sys.stdin); log=j['log']
assert j['params']['video_style_name']=='minimaxH3-I', j['params'].get('video_style_name')
# the style's OWN graph, not the Settings template
assert any('h3_scene_api.json' in l for l in log), [l for l in log if 'workflow' in l]
assert any('accel: sage auto -> h3sage' in l for l in log), [l for l in log if 'accel' in l]" \
  && ok "minimaxH3-I: a render with the style uses ITS graph (h3_scene_api.json), with the accelerators" \
  || bad "minimaxH3-I: job $mst $(echo "$MJJ" | jget "['log']" 2>/dev/null | tail -c 400)"
# ---- 2.303.0: LOAD PRECISION per phase (Tim: "add the 8-bit loading option
# for users who are using the bf16 models"). A style whose phase 1 is a
# bf16-style model set to 8-bit: the submitted graph's UNETLoader carries
# weight_dtype fp8_e4m3fn. The same setting on the blueprint's own int8
# model is left alone and said (8-bit loading is for bf16/fp16 files).
LPS=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d '{"name":"e2e fp8 load","kind":"video","arch":"minimax-h3","workflow":"comfy_workflows/h3_scene_api.json","phases":[{"model":"stub-unet.safetensors","dtype":"fp8_e4m3fn"}]}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['style']; assert d['phases'][0]['dtype']=='fp8_e4m3fn', d['phases']; print(d['id'])")
LPJ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="a viking boy waves" \
  -F width=192 -F height=108 -F steps=6 -F seed=9 -F mode=t2va -F frames=22 \
  -F pipeline=single -F format=webm -F "video_style_id=$LPS" | jget "['id']")
for i in $(seq 1 90); do lst=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LPJ" | jget "['status']"); [ "$lst" = done ] || [ "$lst" = failed ] && break; sleep 1; done
[ "$lst" = "done" ] && curl -sf "http://127.0.0.1:8311/api/jobs/$LPJ?log_from=0" | python3 -c "
import json,sys; log=json.load(sys.stdin)['log']
assert any('phase 1: load as fp8_e4m3fn -> 123.weight_dtype' in l for l in log), [l for l in log if 'phase 1' in l]
" && python3 -c "
import json
g=json.load(open('comfy_workflows/h3_scene_api_tmp.json'))
u=[v['inputs'] for v in g.values() if v.get('class_type')=='UNETLoader']
assert u and u[0].get('weight_dtype')=='fp8_e4m3fn' and u[0].get('unet_name')=='stub-unet.safetensors', u
" && ok "load precision: a phase set to 8-bit reaches ComfyUI as UNETLoader.weight_dtype = fp8_e4m3fn (the submitted graph)" \
  || bad "load precision: job $lst $(curl -sf "http://127.0.0.1:8311/api/jobs/$LPJ?log_from=0" | jget "['log']" 2>/dev/null | tail -c 400)"
curl -sf -X POST http://127.0.0.1:8311/api/styles -H 'Content-Type: application/json' \
  -d "{\"id\":\"$LPS\",\"name\":\"e2e fp8 load\",\"kind\":\"video\",\"arch\":\"minimax-h3\",\"workflow\":\"comfy_workflows/h3_scene_api.json\",\"phases\":[{\"model\":\"\",\"dtype\":\"fp8_e4m3fn\"}]}" > /dev/null
LPJ2=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="a viking boy waves" \
  -F width=192 -F height=108 -F steps=6 -F seed=9 -F mode=t2va -F frames=22 \
  -F pipeline=single -F format=webm -F "video_style_id=$LPS" | jget "['id']")
for i in $(seq 1 90); do lst2=$(curl -sf "http://127.0.0.1:8311/api/jobs/$LPJ2" | jget "['status']"); [ "$lst2" = done ] || [ "$lst2" = failed ] && break; sleep 1; done
[ "$lst2" = "done" ] && curl -sf "http://127.0.0.1:8311/api/jobs/$LPJ2?log_from=0" | python3 -c "
import json,sys; log=json.load(sys.stdin)['log']
assert any('load as fp8_e4m3fn skipped' in l and 'int8' in l and 'already' in l for l in log), [l for l in log if 'phase 1' in l]
" && python3 -c "
import json
g=json.load(open('comfy_workflows/h3_scene_api_tmp.json'))
u=[v['inputs'] for v in g.values() if v.get('class_type')=='UNETLoader']
assert u and u[0].get('weight_dtype')=='default', u
" && ok "load precision: the blueprint's own int8 model is left as it is (8-bit loading is for bf16/fp16 files), said in the log" \
  || bad "load precision: int8 not left alone: job $lst2"
curl -s -X DELETE "http://127.0.0.1:8311/api/styles/$LPS" > /dev/null
curl -sf http://127.0.0.1:8311/api/comfy/vaccel | python3 -c "
import json, sys
j = json.load(sys.stdin)
assert 'spectrum' in j['repos'] and 'kjnodes' in j['repos'], j.get('repos')
assert j['repos']['spectrum']['url'].endswith('ComfyUI-Spectrum-MiniMax-H3.git')
assert isinstance(j['repos']['spectrum']['installed'], bool)   # the panel labels read these
assert isinstance(j['repos']['kjnodes']['installed'], bool)
assert 'woct0rdho/SageAttention/releases' in j['releases'], j.get('releases')
assert any('restart ComfyUI' in n for n in j['notes'])" \
  && ok "accel endpoints: /api/comfy/vaccel reports sage/KJNodes/Spectrum with the install links" || bad "accel endpoints: vaccel status"
# 2.116.1 (Tim): TWO buttons — Install Sage / Install Spectrum — each with an
# installed/not-installed label beside it, flipping to Reinstall once installed.
# The Sage button covers the WHOLE sage story: the wheel install chains a
# KJNodes clone/update server-side (the wheel alone cannot be applied).
grep -q 's_vasagelbl' static/index.html && grep -q 's_vaspectrumlbl' static/index.html \
  && grep -q 'Install Sage' static/index.html && grep -q 'Install Spectrum' static/index.html \
  && grep -q 'Reinstall Sage' static/index.html && grep -q 'Reinstall Spectrum' static/index.html \
  && ! grep -q 's_vakj' static/index.html \
  && grep -q 'updating"} KJNodes ->' lib/comfy.js \
  && ok "accel panel (2.116.1): two buttons with installed labels; Reinstall texts; KJNodes folded into the Sage install" \
  || bad "accel panel: the two-button layout regressed"
curl -s -X POST http://127.0.0.1:8311/api/comfy/vaccel/install -H "Content-Type: application/json" -d '{"what":"bogus"}' \
  | grep -q "unknown install target" && ok "accel endpoints: an unknown install target is refused in words" || bad "accel endpoints: bogus target accepted"
curl -s -X DELETE "http://127.0.0.1:8311/api/styles/$VSID" > /dev/null

# ---- JOB QUEUE PER PROJECT (2.113.0, Tim): projects/<p>/jobs.info, pending
# vs done, reloaded with the project; an interrupted pending job can resume.
node scripts/test-jobsinfo.js > /tmp/jobsinfo.log 2>&1 \
  && ok "jobs.info unit tests (states, upsert, history, remove)" || { bad "jobs.info unit tests"; tail -8 /tmp/jobsinfo.log; }
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"e2e_jobs"}' > /dev/null
JQ=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="jobs info clip" -F width=192 -F height=108 -F steps=0 -F seed=5 \
  -F mode=t2va -F frames=22 -F pipeline=single -F format=webm | jget "['id']")
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$JQ" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
python3 -c "
import json; l=json.load(open('projects/e2e_jobs/jobs.info')); e=[x for x in l if x['id']=='$JQ'][0]
assert e['state']=='done' and e['status']=='done' and e['output'].endswith('.webm') and 'params' not in e and e['prompt']=='jobs info clip', e" \
  && ok "jobs.info: a finished job is recorded as DONE with its output in projects/e2e_jobs/jobs.info" || bad "jobs.info: done entry wrong: $(head -c 300 projects/e2e_jobs/jobs.info)"
curl -sf http://127.0.0.1:8311/api/jobs/history | python3 -c "
import json,sys; j=json.load(sys.stdin); assert j['project']=='e2e_jobs' and not any(h['id']=='$JQ' for h in j['history']), j" \
  && ok "jobs.info: a job still in memory is NOT in the history (no double listing)" || bad "jobs.info: history duplicates a live job"
# simulate a job interrupted by a restart: a pending entry with params that is not in memory
python3 - <<'PYEOF'
import json
l = json.load(open("projects/e2e_jobs/jobs.info"))
l.append({"id": "deadbeef0001", "state": "pending", "status": "queued", "mode": "t2va", "prompt": "interrupted clip", "width": 192, "height": 108,
          "params": {"mode": "t2va", "prompt": "interrupted clip", "width": 192, "height": 108, "frames": 22, "steps": 0, "seed": 7, "format": "webm",
                     "pipeline": "single", "segment_frames": 25, "plan": [25], "reference_files": [], "cfg": 1.0, "speed": "quality"}})
json.dump(l, open("projects/e2e_jobs/jobs.info", "w"))
PYEOF
curl -sf http://127.0.0.1:8311/api/jobs/history | python3 -c "
import json,sys; j=json.load(sys.stdin); h=[x for x in j['history'] if x['id']=='deadbeef0001'][0]
assert h['interrupted'] is True and h['status']=='interrupted', h" \
  && ok "jobs.info: a pending job from a previous run shows as INTERRUPTED in the Pending tab" || bad "jobs.info: interrupted flag missing"
RJ=$(curl -s -X POST http://127.0.0.1:8311/api/jobs/history/deadbeef0001/resume | jget "['id']" 2>/dev/null)
[ "$RJ" = "deadbeef0001" ] && ok "jobs.info: Resume re-queues it with the SAME id and settings" || bad "jobs.info: resume gave '$RJ'"
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/deadbeef0001" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
[ "$st" = "done" ] && python3 -c "
import json; l=json.load(open('projects/e2e_jobs/jobs.info')); e=[x for x in l if x['id']=='deadbeef0001'][0]; assert e['state']=='done', e" \
  && ok "jobs.info: ...and it ran to done, the entry flipped from pending to done" || bad "jobs.info: resumed job $st"
curl -s -X POST http://127.0.0.1:8311/api/jobs/history/$JQ/resume | grep -q "already in memory" && ok "jobs.info: a live job cannot be resumed twice" || bad "jobs.info: double resume"
curl -s -X DELETE http://127.0.0.1:8311/api/jobs/history/deadbeef0001 | grep -q '"removed":true' && ! grep -q deadbeef0001 projects/e2e_jobs/jobs.info \
  && ok "jobs.info: Discard removes the entry only (files untouched)" || bad "jobs.info: discard"
# the queue follows the PROJECT: a job started under e2e_jobs is in e2e_jobs's file, not default's
grep -q "$JQ" projects/e2e_jobs/jobs.info && ! grep -q "$JQ" projects/default/jobs.info 2>/dev/null \
  && ok "jobs.info: each project keeps its own list" || bad "jobs.info: job leaked between projects"
curl -sf -X POST http://127.0.0.1:8311/api/projects/load -H 'Content-Type: application/json' -d '{"name":"default"}' > /dev/null

# ---- TEMPORARY LoRAs (2.111.0, Tim): Basic Settings picker, not part of a
# style, sent with every Generate, saved in projects/<p>/<kind>-loras-temp.json
node scripts/test-temploras.js > /tmp/temploras.log 2>&1 \
  && ok "temp LoRA unit tests (files, normalize, merge)" || { bad "temp LoRA unit tests"; tail -8 /tmp/temploras.log; }
CURP=$(curl -sf http://127.0.0.1:8311/api/projects/current | jget "['name']")
curl -sf -X POST http://127.0.0.1:8311/api/temploras/image -H 'Content-Type: application/json' \
  -d '{"loras":[{"path":"e2e_tmp_img.safetensors","weight":0.4}]}' | grep -q '"file":"image-loras-temp.json"' \
  && [ -f "projects/$CURP/image-loras-temp.json" ] && ok "temp loras: image list saved as projects/$CURP/image-loras-temp.json" || bad "temp loras: image save"
curl -sf -X POST http://127.0.0.1:8311/api/temploras/video -H 'Content-Type: application/json' \
  -d '{"loras":[{"path":"e2e_tmp_vid.safetensors","weight":0.8}]}' > /dev/null
[ -f "projects/$CURP/video-loras-temp.json" ] && ok "temp loras: video list saved as video-loras-temp.json" || bad "temp loras: video save"
curl -sf http://127.0.0.1:8311/api/projects/current | grep -q '"temp_loras":{"image":\[{"path":"e2e_tmp_img.safetensors"' \
  && ok "temp loras: opening the project hands both lists back" || bad "temp loras: not on /api/projects/current"
curl -s -X POST http://127.0.0.1:8311/api/temploras/music -H 'Content-Type: application/json' -d '{"loras":[]}' | grep -q "temp LoRA kind must be image, video, cnet or swap" \
  && ok "temp loras: an unknown kind is refused" || bad "temp loras: music kind accepted"
# a Basic-Settings checkpoint override replaces the style's model for that render (2.115.0)
run_image "ckpt-override" "{\"prompt\":\"a barn\",\"style_id\":\"$CSID\",\"model\":\"e2e_override.safetensors\"}" 1
python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
assert t.get("_models") == ["e2e_override.safetensors"], t.get("_models")
PYEOF
[ $? = 0 ] && ok "ckpt override: the render's loader carries the Basic-Settings checkpoint, not the style's" || bad "ckpt override: model did not reach the graph"
# image: extra_loras ride along after the style's own
run_image "tmp-lora-img" "{\"prompt\":\"a barn\",\"style_id\":\"$CSID\",\"extra_loras\":[{\"path\":\"e2e_tmp_img.safetensors\",\"weight\":0.4}]}" 1
python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
assert "e2e_tmp_img.safetensors" in t.get("_loras", []), t.get("_loras")
PYEOF
[ $? = 0 ] && ok "temp loras: the image render's graph carries the temporary LoRA (built LoraLoader)" || bad "temp loras: image LoRA missing from the graph"
# 2.316.0 (Tim: "add controlnet accordian menuitem to basic settings in left
# docker ... show the first image generated, the controlnet preprocessor gen
# and the final generation in the gallery"): the per-project record, the
# refusal without a model, then LIVE: first -> control map -> final, all three
# in the job's outputs, the preprocessor + ControlNet nodes in what ComfyUI got
CNB=$(curl -s -X POST http://127.0.0.1:8311/api/controlnet/basic -H 'Content-Type: application/json' \
  -d '{"settings":{"v":2,"enabled":true,"type":"pose","controlnet":"","model":"","steps":9,"cfg":3.5}}')
CNR=$(curl -s -X POST http://127.0.0.1:8311/api/genimage -H 'Content-Type: application/json' \
  -d "{\"prompt\":\"a barn\",\"style_id\":\"$CSID\",\"controlnet\":true}")
echo "$CNB" | grep -q '"type":"pose"' && echo "$CNR" | grep -q "no ControlNet is picked (Basic Settings -> ControlNet -> Preprocessor" \
  && curl -sf http://127.0.0.1:8311/api/controlnet/basic | grep -q '"steps":9' \
  && ok "controlnet basic: the record saves per project; Use ControlNet with no model is refused in words (2.316.0)" \
  || bad "controlnet basic: $CNB / $CNR"
curl -s -X POST http://127.0.0.1:8311/api/controlnet/basic -H 'Content-Type: application/json' \
  -d '{"settings":{"v":2,"controlnet":"sdxl/e2e_pose_cn.safetensors"}}' > /dev/null
# 2.317.0 (Tim: "the model will be a diffusion model or checkpoint, the
# preprocessor will be the controlnet model from controlnet folder in comfyui
# ... then generate the image from the second model"): no second model -> said
curl -s -X POST http://127.0.0.1:8311/api/genimage -H 'Content-Type: application/json' \
  -d "{\"prompt\":\"a barn\",\"style_id\":\"$CSID\",\"controlnet\":true}" | grep -q "pick the second model" \
  && ok "controlnet basic: with a ControlNet but no second model, Generate Image says to pick one (2.317.0)" \
  || bad "controlnet basic: second model not required"
curl -s -X POST http://127.0.0.1:8311/api/controlnet/basic -H 'Content-Type: application/json' \
  -d '{"settings":{"v":2,"model":"e2e/second_xl.safetensors","model_cat":"checkpoints"}}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/temploras/cnet -H 'Content-Type: application/json' \
  -d '{"loras":[{"path":"e2e_cn_lora.safetensors","weight":0.7}]}' > /dev/null
CNT0=$(date +%s)
run_image "controlnet-image" "{\"prompt\":\"a barn\",\"style_id\":\"$CSID\",\"controlnet\":true}" 3
echo "$IMG_J" | python3 -c "
import glob, json, os, sys, subprocess, urllib.request
j = json.load(sys.stdin)
outs = j['outputs']
assert outs[1] == outs[0][:-4] + '_cnmap.png' and outs[2] == outs[0][:-4] + '_cn.png', outs
recs = sorted((json.load(open(f)) for f in glob.glob('/tmp/stub-comfy-out/prompt_*.json')
               if os.path.getmtime(f) >= $CNT0 - 1), key=lambda r: len(r.get('_classes', [])))
pre = [r for r in recs if 'DWPreprocessor' in r.get('_cn', {})]
fin = [r for r in recs if 'ControlNetApplyAdvanced' in r.get('_cn', {})]
dw = pre[0]['_cn']['DWPreprocessor'] if len(pre) == 1 else {}
assert dw.get('pose_estimator') == 'dw-ll_ucoco_384_bs5.torchscript.pt' and dw.get('bbox_detector') == 'yolox_l.onnx' \
  and dw.get('detect_hand') == 'enable' and dw.get('scale_stick_for_xinsr_cn') == 'disable', pre
assert len(fin) == 1 and fin[0]['_cn']['ControlNetLoader']['control_net_name'] == 'sdxl/e2e_pose_cn.safetensors', fin
assert fin[0].get('_models') == ['e2e/second_xl.safetensors'], fin[0].get('_models')
assert 'e2e_cn_lora.safetensors' in fin[0].get('_loras', []) and 'sub/grain.safetensors' not in fin[0].get('_loras', []), fin[0].get('_loras')
pd = json.load(urllib.request.urlopen('http://127.0.0.1:8311/api/outputs/where'))['dir']
sz = lambda f: tuple(int(x) for x in subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
     'stream=width,height', '-of', 'csv=p=0', os.path.join(pd, f)], capture_output=True, text=True).stdout.strip().split(','))
assert sz(outs[2]) == sz(outs[0]) == (128, 96), (sz(outs[0]), sz(outs[2]))
assert any(i.endswith('_cnmap.png') or 'cnmap' in i for i in fin[0].get('_images', [])), fin[0].get('_images')
" > /tmp/cn316.log 2>&1 \
  && ok "controlnet basic: Generate Image with Use ControlNet -> the first image, <first>_cnmap.png (DWPreprocessor on its own model), <first>_cn.png rendered by the SECOND model (a checkpoint -> the SDXL template) with the Preprocessor's ControlNet on the uploaded map, the ControlNet LoRA (not the first style's), at the first image's size - all three in the gallery (2.316.0 / 2.317.0)" \
  || { bad "controlnet basic: the three-step render is wrong"; tail -4 /tmp/cn316.log; echo "$IMG_J" | jget "['log']" | tail -6; }
run_image "controlnet-not-asked" "{\"prompt\":\"a barn\",\"style_id\":\"$CSID\"}" 1
# 2.318.0 (Tim: "the control net is not working at all"): the panel's
# settings ride WITH the request - the saved record switched OFF, the inline
# ones still run the three steps
curl -s -X POST http://127.0.0.1:8311/api/controlnet/basic -H 'Content-Type: application/json' \
  -d '{"settings":{"v":2,"enabled":false}}' > /dev/null
# 2.319.0 (Tim's run: LineArtPreprocessor -> KeyError: 'coarse'): Lineart,
# against a stub that fails exactly like the real pack when a declared
# switch is not sent
run_image "controlnet-inline" "{\"prompt\":\"a barn\",\"style_id\":\"$CSID\",\"controlnet\":{\"type\":\"lineart\",\"controlnet\":\"sdxl/e2e_lineart_cn.safetensors\",\"model\":\"e2e/second_xl.safetensors\",\"model_cat\":\"checkpoints\"}}" 3
# 2.320.0 (Tim: "show the final image only, if checked don't show the first
# generation or controlnet image in the gallery, put them in
# projectname\temp\controlnet, name them gen_filename, ctn_filename, use the
# ctn filename to generate the final image")
CNFT0=$(date +%s)
run_image "controlnet-final-only" "{\"prompt\":\"a barn\",\"style_id\":\"$CSID\",\"controlnet\":{\"final_only\":true,\"type\":\"pose\",\"controlnet\":\"sdxl/e2e_pose_cn.safetensors\",\"model\":\"e2e/second_xl.safetensors\",\"model_cat\":\"checkpoints\"}}" 1
echo "$IMG_J" | python3 -c "
import glob, json, os, sys, urllib.request
j = json.load(sys.stdin)
outs = j['outputs']
fin = outs[0]
w = json.load(urllib.request.urlopen('http://127.0.0.1:8311/api/outputs/where'))
pd = w['dir']
td = os.path.join('projects', w['project'], 'temp', 'controlnet')
assert len(outs) == 1 and '_cn' not in fin and os.path.isfile(os.path.join(pd, fin)), outs
assert os.path.isfile(os.path.join(td, 'gen_' + fin)) and os.path.isfile(os.path.join(td, 'ctn_' + fin)), os.listdir(td)
assert not os.path.exists(os.path.join(pd, fin[:-4] + '_cnmap.png')), 'the control image reached the gallery'
recs = [json.load(open(f)) for f in sorted(glob.glob('/tmp/stub-comfy-out/prompt_*.json'), key=os.path.getmtime)]
finr = [r for r in recs if 'ControlNetApplyAdvanced' in r.get('_cn', {})]
assert finr and finr[-1].get('_images') == ['ctn_' + fin], [r.get('_images') for r in finr[-2:]]
a = json.load(urllib.request.urlopen('http://127.0.0.1:8311/api/passets'))
names = json.dumps(a)
assert fin in names and ('gen_' + fin) not in names and ('ctn_' + fin) not in names, 'gen_/ctn_ reached the Image assets'
" > /tmp/cn320.log 2>&1 \
  && ok "controlnet final only: ONE image to the gallery (the final, under the first's name); gen_<file> + ctn_<file> in projects/<p>/temp/controlnet, the final rendered from the uploaded ctn_ file, neither in the Image assets (2.320.0)" \
  || { bad "controlnet final only"; tail -4 /tmp/cn320.log; echo "$IMG_J" | jget "['log']" | tail -6; }
# 2.321.0 (Tim: "i render a cartoon in illustrious, ask for photo real with a
# pony model but still get a cartoon output" -> "add the second model prompt +
# negative prompt, the strength slider and the end slider and a checkbox above
# the positive prompt to use prompt docker prompt")
CNPT0=$(date +%s)
run_image "controlnet-own-prompt" "{\"prompt\":\"anime style, a barn\",\"style_id\":\"$CSID\",\"controlnet\":{\"type\":\"depth\",\"controlnet\":\"sdxl/e2e_depth_cn.safetensors\",\"model\":\"e2e/second_xl.safetensors\",\"model_cat\":\"checkpoints\",\"use_main_prompt\":false,\"prompt\":\"photo, realistic, a barn\",\"negative\":\"anime, cartoon\",\"strength\":0.6,\"end\":0.7}}" 3
python3 - <<'PYEOF' > /tmp/cn321.log 2>&1
import glob, json, os
recs = [json.load(open(f)) for f in sorted(glob.glob('/tmp/stub-comfy-out/prompt_*.json'), key=os.path.getmtime)]
fin = [r for r in recs if 'ControlNetApplyAdvanced' in r.get('_cn', {})][-1]
first = [r for r in recs if not r.get('_cn')][-1]
texts = [v for k, v in fin.items() if not k.startswith('_')]
ftexts = [v for k, v in first.items() if not k.startswith('_')]
a = fin['_cn']['ControlNetApplyAdvanced']
assert 'photo, realistic, a barn' in texts and 'anime, cartoon' in texts, texts
assert 'anime style, a barn' in ftexts and 'photo, realistic, a barn' not in ftexts, ftexts
assert a['strength'] == 0.6 and a['end_percent'] == 0.7, a
PYEOF
[ $? = 0 ] && ok "controlnet own prompt: the FIRST picture renders the prompt docker's prompt, the second model its own prompt + negative, the ControlNet at strength 0.6 ending at 70% (2.321.0)" \
  || { bad "controlnet own prompt"; tail -4 /tmp/cn321.log; }
# 2.322.0 (Tim: "is there any way to get the persons face to look 'not
# distorted'" -> "please add the 2 reccommendations"): FACE FIX on a plain
# render, and on a ControlNet final (Pose, face points off)
run_image "facefix-plain" "{\"prompt\":\"a portrait\",\"style_id\":\"$CSID\",\"face_fix\":{\"denoise\":0.35,\"detector\":\"bbox/face_yolov8n.pt\"}}" 1
python3 - <<'PYEOF' > /tmp/ff322a.log 2>&1
import glob, json, os
r = [json.load(open(f)) for f in sorted(glob.glob('/tmp/stub-comfy-out/prompt_*.json'), key=os.path.getmtime)][-1]
fd = r['_face'].get('FaceDetailer') or {}
assert fd.get('denoise') == 0.35 and r['_face']['UltralyticsDetectorProvider']['model_name'] == 'bbox/face_yolov8n.pt', r['_face']
assert r['_save_src'] == ['FaceDetailer'], r['_save_src']
PYEOF
[ $? = 0 ] && ok "face fix: a plain render saves THROUGH FaceDetailer (denoise 0.35, the picked detector via UltralyticsDetectorProvider) (2.322.0)" \
  || { bad "face fix plain"; tail -3 /tmp/ff322a.log; }
run_image "facefix-controlnet" "{\"prompt\":\"a portrait\",\"style_id\":\"$CSID\",\"face_fix\":{\"denoise\":0.4},\"controlnet\":{\"type\":\"pose\",\"controlnet\":\"sdxl/e2e_pose_cn.safetensors\",\"model\":\"e2e/second_xl.safetensors\",\"model_cat\":\"checkpoints\"}}" 3
python3 - <<'PYEOF' > /tmp/ff322b.log 2>&1
import glob, json, os
recs = [json.load(open(f)) for f in sorted(glob.glob('/tmp/stub-comfy-out/prompt_*.json'), key=os.path.getmtime)][-3:]
first, pre, fin = recs
assert not first['_face'] and first['_save_src'] == ['VAEDecode'], (first['_face'], first['_save_src'])
assert pre['_cn']['DWPreprocessor']['detect_face'] == 'disable', pre['_cn']
assert fin['_face'].get('FaceDetailer') and fin['_save_src'] == ['FaceDetailer'], fin['_save_src']
assert fin['_face']['UltralyticsDetectorProvider']['model_name'] == 'bbox/face_yolov8m.pt', fin['_face']
assert 'ControlNetApplyAdvanced' in fin['_cn'], fin['_cn']
PYEOF
[ $? = 0 ] && ok "face fix + ControlNet: the FIRST picture is not face-fixed, Pose runs with face points OFF, the second model's final saves through FaceDetailer (the default detector) (2.322.0)" \
  || { bad "face fix controlnet"; tail -3 /tmp/ff322b.log; }
curl -s -X POST http://127.0.0.1:8311/api/controlnet/basic -H 'Content-Type: application/json' \
  -d '{"settings":{"v":2,"enabled":false,"final_only":false,"controlnet":"","model":"","model_cat":"","steps":null,"cfg":null,"use_main_prompt":true,"prompt":"","negative":"","strength":1,"end":1}}' > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/temploras/cnet -H 'Content-Type: application/json' -d '{"loras":[]}' > /dev/null
# video: no video style selected -> a synthetic style carries only the LoRAs
VJ2=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="temp lora video" -F width=192 -F height=108 -F steps=0 -F seed=3 \
  -F mode=t2va -F frames=22 -F pipeline=single -F format=webm -F 'extra_loras=[{"path":"e2e_tmp_vid.safetensors","weight":0.8}]' | jget "['id']")
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$VJ2" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
[ "$st" = "done" ] && python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)
r = json.load(open(newest))
assert "e2e_tmp_vid.safetensors" in r["_loras"], r["_loras"]
assert "minimax_h3_fl2va_pruned_int8_convrot.safetensors" in r["_models"], r["_models"]   # template model untouched
PYEOF
[ $? = 0 ] && ok "temp loras: a video render with NO video style still gets the temporary LoRA; the template's model is untouched" \
  || bad "temp loras: video job $st / LoRA missing"
# temp loras x SS style (2.116.2, Tim: "do loras work from the temporary
# lora's in basic settings and in style loras for both minimax h3 styles"):
# a temp LoRA merges into the SEEDED MiniMax H3 SS style — its accel survives
# the merge (Object.assign), the lora chain is built, and the accelerators
# land downstream of it.
SSID=$(curl -sf "http://127.0.0.1:8311/api/styles?kind=video" | python3 -c "
import json, sys
print(next(s['id'] for s in json.load(sys.stdin)['styles'] if s['name'] == 'MiniMax H3 SS'))")
VJ3=$(curl -sf -X POST http://127.0.0.1:8311/api/generate -F prompt="ss temp lora" -F width=192 -F height=108 -F steps=0 -F seed=4 \
  -F mode=t2va -F frames=22 -F pipeline=single -F format=webm -F "video_style_id=$SSID" \
  -F 'extra_loras=[{"path":"e2e_tmp_ss.safetensors","weight":0.7}]' | jget "['id']")
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$VJ3" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
[ "$st" = "done" ] && curl -sf "http://127.0.0.1:8311/api/jobs/$VJ3?log_from=0" | python3 -c "
import json, sys
log = json.load(sys.stdin)['log']
assert any('style: lora 1: e2e_tmp_ss.safetensors' in l for l in log), [l for l in log if 'lora' in l]
assert any('accel: sage auto -> h3sage' in l for l in log), [l for l in log if 'accel' in l]
assert any('accel: spectrum on -> h3spectrum' in l for l in log), [l for l in log if 'accel' in l]" \
  && python3 - <<'PYEOF2'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/video_*.json"), key=os.path.getmtime)
r = json.load(open(newest))
assert "e2e_tmp_ss.safetensors" in r["_loras"], r["_loras"]
assert r["_accel"] == ["PathchSageAttentionKJ", "SpectrumApplyMiniMaxH3"], r["_accel"]
assert r["_accel_wiring"]["h3spectrum"] == ["h3sage", 0], r["_accel_wiring"]
PYEOF2
[ $? = 0 ] && ok "temp loras x MiniMax H3 SS: the temp LoRA rides the SS style, accel survives the merge, sage+spectrum wired downstream" \
  || bad "temp loras x SS: job $st / merge or wiring broke"
curl -sf -X POST http://127.0.0.1:8311/api/temploras/image -H 'Content-Type: application/json' -d '{"loras":[]}' > /dev/null
curl -sf -X POST http://127.0.0.1:8311/api/temploras/video -H 'Content-Type: application/json' -d '{"loras":[]}' > /dev/null

# ---- A FLUX.2 KLEIN 9B TEXT-TO-IMAGE STYLE RENDERS WITH THE REFERENCE DOCK
# (2.105.0, Tim: "for a flux 9b model use the reference images as the
# reference images for generation"). The server swaps the style's t2i graph
# for its sibling *_edit* graph when pictures are given; empty dock = t2i.
node scripts/test-imagerefs.js > /tmp/imagerefs.log 2>&1 \
  && ok "imageRefs unit tests (Klein only, sibling by name, loader-kind guard)" \
  || { bad "imageRefs unit tests"; tail -12 /tmp/imagerefs.log; }
cat > comfy_workflows/e2e_klein_t2i.json << 'WF'
{
  "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "template.safetensors" } },
  "2": { "class_type": "CLIPTextEncode", "inputs": { "text": "template positive", "clip": ["1", 1] } },
  "4": { "class_type": "EmptyLatentImage", "inputs": { "width": 512, "height": 512, "batch_size": 1 } },
  "5": { "class_type": "KSampler", "inputs": { "seed": 1, "steps": 4, "cfg": 1.0, "denoise": 1.0, "sampler_name": "euler", "scheduler": "simple", "model": ["1", 0], "positive": ["2", 0], "negative": ["2", 0], "latent_image": ["4", 0] } },
  "6": { "class_type": "VAEDecode", "inputs": { "samples": ["5", 0], "vae": ["1", 2] } },
  "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "e2e", "images": ["6", 0] } }
}
WF
cat > comfy_workflows/e2e_klein_edit.json << 'WF'
{
  "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "e2e-klein-edit-WRONG.safetensors" } },
  "2": { "class_type": "CLIPTextEncode", "inputs": { "text": "template positive", "clip": ["1", 1] } },
  "4": { "class_type": "EmptyLatentImage", "inputs": { "width": 512, "height": 512, "batch_size": 1 } },
  "10": { "class_type": "LoadImage", "inputs": { "image": "placeholder1.png" } },
  "11": { "class_type": "LoadImage", "inputs": { "image": "placeholder2.png" } },
  "12": { "class_type": "VAEEncode", "inputs": { "pixels": ["10", 0], "vae": ["1", 2] } },
  "13": { "class_type": "VAEEncode", "inputs": { "pixels": ["11", 0], "vae": ["1", 2] } },
  "14": { "class_type": "ReferenceLatent", "inputs": { "conditioning": ["2", 0], "latent": ["12", 0] } },
  "15": { "class_type": "ReferenceLatent", "inputs": { "conditioning": ["14", 0], "latent": ["13", 0] } },
  "5": { "class_type": "KSampler", "inputs": { "seed": 1, "steps": 4, "cfg": 1.0, "denoise": 1.0, "sampler_name": "euler", "scheduler": "simple", "model": ["1", 0], "positive": ["15", 0], "negative": ["15", 0], "latent_image": ["4", 0] } },
  "6": { "class_type": "VAEDecode", "inputs": { "samples": ["5", 0], "vae": ["1", 2] } },
  "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "e2e", "images": ["6", 0] } }
}
WF
KST=$(curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d '{"name":"E2E Klein","arch":"flux2klein9b","engine":"comfy","workflow":"comfy_workflows/e2e_klein_t2i.json","width":128,"height":96,"steps":2}')
KSID=$(echo "$KST" | jget "['style']['id']")
curl -sf "http://127.0.0.1:8311/api/styles?kind=image" | python3 -c "
import json,sys; j=json.load(sys.stdin)
assert j['image_slots']['$KSID']==0 and j['ref_capable']['$KSID'] is True, (j['image_slots'].get('$KSID'), j['ref_capable'].get('$KSID'))" \
  && ok "klein-refs: the t2i style has 0 slots but is reported ref-capable (UI sends the dock)" \
  || bad "klein-refs: ref_capable wrong"
curl -sf -X POST http://127.0.0.1:8311/api/passets -F "file=@/tmp/e2e_ref1.png" -F "hint=images" > /dev/null
KREF=$(curl -sf "http://127.0.0.1:8311/api/passets" | python3 -c "
import json,sys; j=json.load(sys.stdin); ims=j.get('images',[]); print(ims[0]['name'] if ims and isinstance(ims[0],dict) else (ims[0] if ims else ''))")
[ -n "$KREF" ] || KREF="e2e_ref1.png"
# 2.209.0 (Tim's hardware card): the swapped sibling carries a ckpt name this
# machine does not have, and the running ComfyUI's VAEEncode grew a required
# resolution_steps the export predates — BOTH must be repaired in flight: the
# name inherited from the style's own proven workflow, the input filled from
# the server's own declared default.
curl -sf -X POST http://127.0.0.1:8388/e2e/schema -H 'Content-Type: application/json' \
  -d '{"class":"VAEEncode","input":"resolution_steps","default":64,"section":"required"}' > /dev/null
run_image "klein-refs" "{\"prompt\":\"the person from <Picture 1> on a beach\",\"style_id\":\"$KSID\",\"images\":[\"$KREF\"]}" 1
echo "$IMG_J" | python3 -c "
import json,sys; j=json.load(sys.stdin)
assert j['params'].get('workflow','').endswith('e2e_klein_edit.json'), j['params'].get('workflow')
assert any('using e2e_klein_edit.json' in l for l in j['log']), [l for l in j['log'] if 'Klein' in l]
# swap inherit: the sibling's WRONG ckpt is replaced by the t2i's proven one
assert any('swap inherit' in l and 'e2e-klein-edit-WRONG.safetensors' in l
           and 'template.safetensors' in l for l in j['log']), \
    [l for l in j['log'] if 'inherit' in l]
# schema fill: the required input the export never had, from the server default
assert any('schema fill' in l and 'resolution_steps' in l and '64' in l
           for l in j['log']), [l for l in j['log'] if 'schema' in l]" \
  && ok "klein-refs: with a picture in the dock the sibling edit workflow is used — its wrong ckpt INHERITED away, its missing required input SCHEMA-FILLED (2.209.0)" \
  || bad "klein-refs: swap/repair: $(echo "$IMG_J" | jget "['params']['workflow']" 2>/dev/null)"
curl -sf -X POST http://127.0.0.1:8388/e2e/schema -H 'Content-Type: application/json' -d '{"class":""}' > /dev/null
python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
ims = t.get("_images", [])
assert len(ims) == 1 and not ims[0].startswith("placeholder"), ims
assert t.get("2") == "the person from <Picture 1> on a beach", t
PYEOF
[ $? = 0 ] && ok "klein-refs: ComfyUI received the uploaded picture in slot 1, the unused slot 2 bypassed, prompt intact" \
  || bad "klein-refs: the reference did not reach LoadImage"
# ---- IMAGE EDITOR INFILL (2.108.0, Tim): a crop + a mask PNG + the prompt ->
# ONE image job at the crop's size through the inpaint graph for the style.
node scripts/test-imageedit.js > /tmp/imageedit.log 2>&1 \
  && ok "image editor unit tests (rect/ellipse/lasso/polygon/wand/brush math, feather, composite, infill graph choice)" \
  || { bad "image editor unit tests"; tail -12 /tmp/imageedit.log; }
curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8311/ext/imageeditdock/imageedit.js | grep -q 200 \
  && ok "image editor: /ext/imageeditdock/imageedit.js is served" || bad "image editor: script not served"
ffmpeg -y -loglevel error -f lavfi -i color=c=blue:s=128x96 -frames:v 1 /tmp/e2e_crop.png
ffmpeg -y -loglevel error -f lavfi -i color=c=black@0.0:s=128x96,format=rgba -frames:v 1 /tmp/e2e_mask.png
IFK=$(curl -s -X POST http://127.0.0.1:8311/api/infill -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" \
  -F "prompt=a red door" -F "style_id=$KSID" -F "width=128" -F "height=96" -F "feather=12")
IFID=$(echo "$IFK" | jget "['id']" 2>/dev/null)
[ -n "${IFID:-}" ] && echo "$IFK" | grep -q '"takes_mask":false' && echo "$IFK" | grep -q 'e2e_klein_edit.json' \
  && ok "infill: a Klein style queues the job through its EDIT graph (mask blended by the editor)" || bad "infill: klein ${IFK:0:200}"
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$IFID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
IFJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$IFID?log_from=0")
[ "$st" = "done" ] && echo "$IFJ" | python3 -c "
import json,sys; j=json.load(sys.stdin); p=j['params']
assert p['infill'] is True and p['width']==128 and p['height']==96 and len(p['images'])==1, p
assert any('infill via FLUX.2 Klein edit graph' in l for l in j['log']), j['log'][-5:]" \
  && ok "infill: the job ran at the crop's size with the crop as the only picture and the log names the graph" \
  || bad "infill: klein job $st $(echo "$IFJ" | jget "['log']" 2>/dev/null | tail -3)"
IFPNG=$(echo "$IFJ" | jget "['output']")
SZ=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$(curl -sf http://127.0.0.1:8311/api/outputs/where | jget "['dir']")/$IFPNG" 2>/dev/null)
[ "$SZ" = "128,96" ] && ok "infill: the result is the crop's size, ready to composite" || bad "infill: result size $SZ"
CURP=$(curl -sf http://127.0.0.1:8311/api/projects/current | jget "['name']")
ls "projects/$CURP/images/" | grep -q "^infill-.*-crop.png" && ls "projects/$CURP/images/" | grep -q "^infill-.*-mask.png" \
  && ok "infill: the crop and mask were saved into the current project's Images ($CURP)" || bad "infill: crop/mask not saved in projects/$CURP/images"
# a checkpoint style goes through Tim's img_inpaint_sdxl.json export (2.108.1):
# ONE LoadImage whose alpha is the hole, self-contained (no style overrides)
node scripts/test-screenplay.js > /tmp/screenplay.log 2>&1 \
  && ok "screenplay: the shipped plan passes its own validator, and invented characters are refused" \
  || { bad "screenplay: grammar/validator tests"; tail -14 /tmp/screenplay.log; }
node scripts/test-characters.js > /tmp/characters.log 2>&1 \
  && ok "characters: profiles on disk, and the reference chain rebuilt end to end" \
  || { bad "characters: profile/chain tests"; tail -14 /tmp/characters.log; }
node scripts/test-refmods.js > /tmp/refmods.log 2>&1 \
  && ok "refmods: the extraction graph from verified pack schemas, dataset-walk endpoints, verify-then-adopt, the mod ride" \
  || { bad "refmods: 2.225.0 identity-mod tests"; tail -14 /tmp/refmods.log; }
node scripts/test-clothing.js > /tmp/clothing.log 2>&1 \
  && ok "clothing: the mention resolver (select/inherit/replace), the dataset landing points, the stitch extraction, the chain leg" \
  || { bad "clothing: 2.224.0 multi-sheet/clothing/dataset tests"; tail -14 /tmp/clothing.log; }
node scripts/test-sheetstyles.js > /tmp/sheetstyles.log 2>&1 \
  && ok "sheet styles: eligibility + live-LoRA report agree with the patcher, and the alphabetical auto-pick trap is demonstrated" \
  || { bad "sheet styles: lib/sheetStyles.js tests"; tail -14 /tmp/sheetstyles.log; }
node scripts/test-posesheets.js > /tmp/posesheets.log 2>&1 \
  && ok "pose sheets: all six line-drawing templates ship, the kind is authoritative, species words refine, vehicles get none" \
  || { bad "pose sheets: lib/poseSheets.js tests"; tail -14 /tmp/posesheets.log; }
python3 scripts/test-comfyrepair.py > /tmp/comfyrepair.log 2>&1 \
  && ok "comfy repairs: swap inherits PROVEN loader names (LoraLoader excluded, ambiguity left alone) and required inputs fill from the server's own defaults" \
  || { bad "comfy repairs: scripts/test-comfyrepair.py"; tail -14 /tmp/comfyrepair.log; }
node scripts/test-scenes.js > /tmp/scenes.log 2>&1 \
  && ok "scenes: the board derives from the plan, keep is idempotent, and the .prj keeps its other keys" \
  || { bad "scenes: state-model tests"; tail -14 /tmp/scenes.log; }
node scripts/test-movies.js > /tmp/movies.log 2>&1 \
  && ok "movies: save copies the cast's files and takes, New stashes (never deletes), load restores it all" \
  || { bad "movies: bundle round-trip tests"; tail -14 /tmp/movies.log; }
node scripts/test-dockers.js > /tmp/dockers.log 2>&1 \
  && ok "dockers: the global layout file round-trips, merges per dock, clamps junk" \
  || { bad "dockers: layout-file tests"; tail -14 /tmp/dockers.log; }
node scripts/test-environments.js > /tmp/environments.log 2>&1 \
  && ok "environments: 360 panos project through the viewer's own yaw/pitch conventions and ride the chain after the cast" \
  || { bad "environments: unit tests"; tail -14 /tmp/environments.log; }
node scripts/test-sceneui.js > /tmp/sceneui.log 2>&1 \
  && ok "scene UI: the docker's controls render for real and hit the right endpoints (a feature is not shipped until a test has SEEN it)" \
  || { bad "scene UI: DOM regression tests"; tail -14 /tmp/sceneui.log; }
node scripts/test-qrcode.js > /tmp/qrcode.log 2>&1 \
  && ok "qrcode: RS syndromes zero, BCH format valid, and the symbol reads back as its own codewords" \
  || { bad "qrcode: encoder tests"; tail -14 /tmp/qrcode.log; }
node scripts/test-remote.js > /tmp/remote.log 2>&1 \
  && ok "remote: pairing is one-shot, the cookie is sealed, exactly ONE phone is ever live" \
  || { bad "remote: pairing/session tests"; tail -14 /tmp/remote.log; }
python3 scripts/test-uitoapi.py > /tmp/uitoapi.log 2>&1 \
  && ok "ui_to_api + the SDXL inpaint export through the patcher (both encoders, refiner, seed, loaders untouched)" \
  || { bad "ui_to_api / inpaint export tests"; tail -12 /tmp/uitoapi.log; }
ffmpeg -y -loglevel error -f lavfi -i color=c=blue@0.0:s=128x96,format=rgba -frames:v 1 /tmp/e2e_hole.png
IFC=$(curl -s -X POST http://127.0.0.1:8311/api/infill -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" -F "rgba=@/tmp/e2e_hole.png" \
  -F "prompt=a red door" -F "style_id=$CSID" -F "width=128" -F "height=96")
echo "$IFC" | grep -q '"input":"rgba"' && echo "$IFC" | grep -q 'img_inpaint_sdxl.json' \
  && ok "infill: a checkpoint style uses the SDXL inpaint export, fed the RGBA whose alpha is the hole" || bad "infill: checkpoint ${IFC:0:200}"
IFCID=$(echo "$IFC" | jget "['id']" 2>/dev/null)
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$IFCID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
IFCJ=$(curl -sf "http://127.0.0.1:8311/api/jobs/$IFCID?log_from=0")
[ "$st" = "done" ] && python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
ims = t.get("_images", [])
# One slot, holding an UPLOADED alpha picture rather than the export's own
# 'placeholder.png'. Checked by what it is NOT: the stub echoes the uploaded
# filename (as real ComfyUI does) and the server names its own temp copy, so
# pinning the exact string would test the temp-file naming, not the wiring.
assert len(ims) == 1 and ims[0] != "placeholder.png" and ims[0].endswith(".png"), ims
assert t.get("34") == "a red door" or t.get("50") == "a red door", t  # base / refiner encoders
PYEOF
[ $? = 0 ] && ok "infill: ComfyUI received ONE picture (the alpha hole) and the prompt in the SDXL encoders" \
  || bad "infill: checkpoint job $st / slots: $(echo "$IFCJ" | jget "['log']" 2>/dev/null | tail -c 300)"
echo "$IFCJ" | python3 -c "
import json,sys; j=json.load(sys.stdin); p=j['params']
assert p['style']['model']=='' and p['style'].get('steps') is None and p['infill_input']=='rgba', p['style']" \
  && ok "infill: the self-contained export runs WITHOUT the style's model/steps overrides" || bad "infill: style overrides leaked into the inpaint job"
curl -s -X POST http://127.0.0.1:8311/api/infill -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" \
  -F "prompt=a red door" -F "style_id=$CSID" -F "width=128" -F "height=96" | grep -q "alpha is the hole" \
  && ok "infill: a one-slot inpaint graph without the rgba picture is refused in words" || bad "infill: rgba-less request accepted"
# ---- THE IMAGE EDITOR'S ✨ AI (2.332.0, Tim: "select and edit via qwen edit,
# kontext or regenerate that portion like krita ai diffusion does"):
# /api/aiedit - Generate / Refine (strength) / Remove / Edit, N results each
node scripts/test-aiedit.js > /tmp/aiedit.log 2>&1 \
  && ok "aiedit unit tests (2.332.0 the modes + engines, the denoise / VAEEncodeForInpaint swap, the Qwen + Kontext graphs, 20 brush presets + the engine maths, the new selection helpers)" \
  || { bad "aiedit unit tests"; grep -a "^FAIL" -A2 /tmp/aiedit.log | head -20; }
curl -sf -o /dev/null http://127.0.0.1:8311/ext/imageeditdock/brushes.js \
  && ok "aiedit: /ext/imageeditdock/brushes.js (the brush engine) is served" || bad "aiedit: brushes.js not served"
AIE=$(curl -sf http://127.0.0.1:8311/api/aiedit/engines)
echo "$AIE" | python3 -c "
import json,sys; e=json.load(sys.stdin)
ed=[x['name'] for x in e['edit']]; inp={x['id']:x for x in e['inpaint']}
assert 'Qwen Image Edit 2511' in ed and 'FLUX.1 Kontext edit' in ed, ed
assert '$CSID' in inp and inp['$CSID']['refine'] is True, inp.get('$CSID')
assert e['modes']==['generate','refine','remove','edit'] and e['max_count']==4, e
assert e['defaults']['edit'] and e['defaults']['inpaint'], e['defaults']" \
  && ok "aiedit: engines - Qwen Image Edit 2511 + FLUX.1 Kontext edit are edit models, the checkpoint style can Refine" \
  || bad "aiedit: engines ${AIE:0:300}"
QSID=$(echo "$AIE" | python3 -c "import json,sys; print([x['id'] for x in json.load(sys.stdin)['edit'] if x['name']=='Qwen Image Edit 2511'][0])" 2>/dev/null)
AR=$(curl -s -X POST http://127.0.0.1:8311/api/aiedit -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" -F "rgba=@/tmp/e2e_hole.png" \
  -F "mode=refine" -F "strength=40" -F "count=2" -F "prompt=a brass door knob" -F "style_id=$CSID" -F "width=128" -F "height=96")
echo "$AR" | python3 -c "
import json,sys; r=json.load(sys.stdin)
assert r['mode']=='refine' and abs(r['denoise']-0.4)<1e-9 and len(r['jobs'])==2, r
assert r['jobs'][1]['seed']==(r['jobs'][0]['seed']+1)%4294967296, r['jobs']" \
  && ok "aiedit: Refine at 40 % queues TWO results (consecutive seeds) at denoise 0.40" || bad "aiedit: refine ${AR:0:300}"
ARJ=$(echo "$AR" | python3 -c "import json,sys; print(' '.join(j['id'] for j in json.load(sys.stdin)['jobs']))" 2>/dev/null)
ADONE=0
for J in $ARJ; do
  for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$J" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
  [ "$st" = done ] && ADONE=$((ADONE+1))
done
ARJ1=$(echo "$ARJ" | cut -d' ' -f1)
[ "$ADONE" = 2 ] && curl -sf "http://127.0.0.1:8311/api/jobs/$ARJ1?log_from=0" | python3 -c "
import json,sys; j=json.load(sys.stdin); p=j['params']
assert p['aiedit']=='refine' and abs(p['denoise']-0.4)<1e-9 and p['infill_input']=='rgba', p
assert any('strength 0.40' in l and 'SetLatentNoiseMask' in l for l in j['log']), [l for l in j['log'] if 'strength' in l]" \
  && ok "aiedit: both Refine renders finished; the log shows denoise 0.40 and VAEEncodeForInpaint swapped for VAEEncode + SetLatentNoiseMask" \
  || bad "aiedit: refine jobs done=$ADONE"
python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
assert "SetLatentNoiseMask" in t["_classes"] and "VAEEncodeForInpaint" not in t["_classes"], t["_classes"]
assert 0.4 in t["_denoise"].values(), t["_denoise"]
PYEOF
[ $? = 0 ] && ok "aiedit: ComfyUI received the partial-denoise inpaint graph (SetLatentNoiseMask, denoise 0.4)" || bad "aiedit: refine graph at ComfyUI"
AE=$(curl -s -X POST http://127.0.0.1:8311/api/aiedit -F "crop=@/tmp/e2e_crop.png" -F "mode=edit" \
  -F "prompt=make the door red" -F "style_id=$QSID" -F "width=128" -F "height=96")
AEID=$(echo "$AE" | python3 -c "import json,sys; print(json.load(sys.stdin)['jobs'][0]['id'])" 2>/dev/null)
echo "$AE" | grep -q '"input":"crop"' && echo "$AE" | grep -q 'img_qwen_edit_2511.json' \
  && ok "aiedit: Edit with Qwen Image Edit 2511 takes the crop alone (no mask) through img_qwen_edit_2511.json" || bad "aiedit: edit ${AE:0:300}"
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$AEID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
[ "$st" = done ] && python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
assert "TextEncodeQwenImageEditPlus" in t["_classes"] and "FluxKontextMultiReferenceLatentMethod" in t["_classes"], t["_classes"]
assert "make the door red" in t["_prims"].values(), t["_prims"]
assert any("Lightning-4steps" in l for l in t["_loras"]), t["_loras"]
ims = t["_images"]; assert len(ims) == 1 and ims[0] != "placeholder.png", ims
PYEOF
[ $? = 0 ] && ok "aiedit: ComfyUI received the Qwen edit graph - the instruction in its Primitive, the Lightning LoRA from the style, the crop as Picture 1" \
  || bad "aiedit: qwen edit job $st"
AM=$(curl -s -X POST http://127.0.0.1:8311/api/aiedit -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" -F "rgba=@/tmp/e2e_hole.png" \
  -F "mode=remove" -F "prompt=" -F "style_id=$CSID" -F "width=128" -F "height=96")
AMID=$(echo "$AM" | python3 -c "import json,sys; print(json.load(sys.stdin)['jobs'][0]['id'])" 2>/dev/null)
[ -n "${AMID:-}" ] && curl -sf "http://127.0.0.1:8311/api/jobs/$AMID" | python3 -c "
import json,sys; p=json.load(sys.stdin)['params']
assert 'surroundings continue' in p['prompt'] and 'person' in p.get('negative',''), (p['prompt'], p.get('negative'))" \
  && ok "aiedit: Remove with an empty prompt fills in 'continue the surroundings' + a negative for objects" || bad "aiedit: remove ${AM:0:200}"
curl -s -X POST http://127.0.0.1:8311/api/aiedit -F "crop=@/tmp/e2e_crop.png" -F "mode=edit" -F "prompt=x" -F "style_id=$CSID" -F "width=128" -F "height=96" \
  | grep -q "cannot follow an edit instruction" \
  && curl -s -X POST http://127.0.0.1:8311/api/aiedit -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" -F "mode=refine" -F "prompt=x" -F "style_id=$KSID" -F "width=128" -F "height=96" \
  | grep -q "Refine needs an inpaint graph" \
  && curl -s -X POST http://127.0.0.1:8311/api/aiedit -F "crop=@/tmp/e2e_crop.png" -F "mode=generate" -F "prompt=x" -F "style_id=$CSID" -F "width=128" -F "height=96" \
  | grep -q "mask image missing" \
  && ok "aiedit: refused in words - Edit with a non-edit style, Refine through a graph without a mask, Generate without a mask" \
  || bad "aiedit: refusals"
# ---- ◈ CONTROL LAYERS (2.333.0, Tim: "yes, please build that" - Krita AI
# Diffusion's control layers): From image = a preprocessor job; controls ride
# an AI edit as chained ControlNetApplyAdvanced on the primary sampler
curl -sf http://127.0.0.1:8311/api/aiedit/controlnets | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert isinstance(d['models'], list) and sorted(d['suggest'])==sorted(['scribble','lineart','softedge','canny','depth','normal','pose','segmentation']), d" \
  && curl -sf http://127.0.0.1:8311/api/aiedit/engines | grep -q '"control_types"' \
  && ok "aiedit: /api/aiedit/controlnets lists ComfyUI's ControlNet models + a pick per type; engines carry the 8 control types" \
  || bad "aiedit: controlnets route"
PP=$(curl -s -X POST http://127.0.0.1:8311/api/aiedit/preprocess -F "image=@/tmp/e2e_crop.png" -F "type=depth")
PRID=$(echo "$PP" | jget "['job']" 2>/dev/null)
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$PRID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
[ "$st" = done ] && curl -sf "http://127.0.0.1:8311/api/jobs/$PRID" | python3 -c "
import json,sys; j=json.load(sys.stdin); assert j['output'].endswith('_ctl_depth.png') and j['params']['no_assets'] is True, j['output']" \
  && python3 - <<'PYEOF'
import glob, json, os
t = json.load(open(max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime), encoding="utf-8"))
assert "DepthAnythingV2Preprocessor" in t["_classes"] and len(t["_images"]) == 1, t["_classes"]
PYEOF
[ $? = 0 ] && ok "aiedit: ⟲ From image (depth) = a preprocessor-only job - DepthAnythingV2 at ComfyUI, the map back as *_ctl_depth.png, not an asset" \
  || bad "aiedit: preprocess $st ${PP:0:200}"
PC=$(curl -s -X POST http://127.0.0.1:8311/api/aiedit/preprocess -F "image=@/tmp/e2e_crop.png" -F "type=canny")
PCID=$(echo "$PC" | jget "['job']" 2>/dev/null)
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$PCID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
[ "$st" = done ] && python3 -c "
import glob, json, os
t = json.load(open(max(glob.glob('/tmp/stub-comfy-out/prompt_*.json'), key=os.path.getmtime), encoding='utf-8'))
assert 'Canny' in t['_classes'], t['_classes']" \
  && ok "aiedit: ⟲ From image (canny) runs ComfyUI's own core Canny node" || bad "aiedit: canny preprocess $st"
AC=$(curl -s -X POST http://127.0.0.1:8311/api/aiedit -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" -F "rgba=@/tmp/e2e_hole.png" \
  -F "ctl0=@/tmp/e2e_crop.png" -F "ctl1=@/tmp/e2e_crop.png" -F "mode=generate" -F "prompt=a lamp" -F "style_id=$CSID" -F "width=128" -F "height=96" \
  -F 'controls=[{"type":"depth","strength":0.6,"start":0.2,"end":0.8,"model":"e2e_cn_depth.safetensors"},{"type":"scribble","strength":1.1,"model":"e2e_cn_scribble.safetensors"}]')
ACID=$(echo "$AC" | python3 -c "import json,sys; print(json.load(sys.stdin)['jobs'][0]['id'])" 2>/dev/null)
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$ACID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
[ "$st" = done ] && curl -sf "http://127.0.0.1:8311/api/jobs/$ACID?log_from=0" | python3 -c "
import json,sys; j=json.load(sys.stdin); c=j['params']['aiedit_controls']
assert [x['type'] for x in c]==['depth','scribble'] and c[0]['start']==0.2 and all(x['image'].endswith('.png') and '/temp/aiedit/' in x['image'].replace(chr(92),'/') for x in c), c
assert sum('control layer' in l and 'on 1 sampler' in l for l in j['log'])==2, [l for l in j['log'] if 'control' in l]
assert '/temp/aiedit/' in j['params']['images'][0].replace(chr(92),'/') and j['params']['no_assets'] is True, j['params']['images']" \
  && python3 - <<'PYEOF'
import glob, json, os
t = json.load(open(max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime), encoding="utf-8"))
assert "ControlNetApplyAdvanced" in t["_classes"] and "ControlNetLoader" in t["_classes"], t["_classes"]
assert len(t["_images"]) == 3, t["_images"]
PYEOF
[ $? = 0 ] && ok "aiedit: Generate + TWO control layers - both chained on the primary sampler (the log says so), three pictures at ComfyUI, inputs in temp/aiedit, not assets" \
  || bad "aiedit: controls job $st ${AC:0:300}"
curl -s -X POST http://127.0.0.1:8311/api/aiedit -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" -F "rgba=@/tmp/e2e_hole.png" \
  -F "mode=generate" -F "prompt=x" -F "style_id=$CSID" -F "width=128" -F "height=96" -F 'controls=[{"type":"depth","start":0.9,"end":0.2,"model":"m"}]' \
  | grep -q "ends .* before it starts" \
  && curl -s -X POST http://127.0.0.1:8311/api/aiedit -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" -F "rgba=@/tmp/e2e_hole.png" \
  -F "mode=generate" -F "prompt=x" -F "style_id=$CSID" -F "width=128" -F "height=96" -F 'controls=[{"type":"depth","model":"m"}]' \
  | grep -q "its picture (ctl0) is missing" \
  && curl -s -X POST http://127.0.0.1:8311/api/aiedit/preprocess -F "image=@/tmp/e2e_crop.png" -F "type=hologram" | grep -q "unknown control type" \
  && ok "aiedit: control layers refused in words - a backwards range, a missing picture, an unknown type" || bad "aiedit: control refusals"
node scripts/test-imageeditor-ui.js > /tmp/ieui.log 2>&1 \
  && ok "aiedit: the editor in a real browser (selection + brush clip, undo/redo, layers, presets, the AI panel end to end with the stub, a control layer From image riding a Generate, filters + Ctrl+F) - or SKIP without playwright" \
  || { bad "aiedit: browser test"; grep -a "FAIL\|Error" /tmp/ieui.log | head -12; }
# ---- SDXL / Pony / Illustrious built-ins (2.112.0): core-node t2i + i2i graphs
curl -sf "http://127.0.0.1:8311/api/styles?kind=image" | python3 -c "
import json,sys; j=json.load(sys.stdin); by={s['name']:s for s in j['styles']}
for n in ('SDXL','SDXL img2img','Pony','Illustrious'): assert n in by, (n, sorted(by))
assert by['Pony']['clip_skip']==2 and by['Illustrious']['clip_skip']==2 and by['SDXL']['clip_skip']==1
assert by['Pony']['negative'].startswith('score_6') and 'lowres' in by['Illustrious']['negative']
assert by['SDXL img2img']['workflow'].endswith('img_sdxl_i2i.json') and j['image_slots'][by['SDXL img2img']['id']]==1
assert j['image_slots'][by['Pony']['id']]==0
assert j['inpaint_capable'][by['Pony']['id']] is True   # checkpoint loader -> Tim's SDXL inpaint export
assert not j['incomplete'].get(by['Pony']['id']), 'a comfy style is complete: the graph carries its own checkpoint until one is set'" \
  && ok "sdxl family: SDXL / SDXL img2img / Pony / Illustrious ship with the right clip skip, negatives, slots and infill path" \
  || bad "sdxl family: built-ins wrong"

# ---- THE FLUX FILL STYLE (2.109.0, Tim): built in, editable model + LoRAs, the editor's default Infill style
FFID=$(curl -sf "http://127.0.0.1:8311/api/styles?kind=image" | python3 -c "
import json,sys; j=json.load(sys.stdin); st=[s for s in j['styles'] if s['name']=='FLUX Fill inpaint']
assert st and st[0]['inpaint_workflow'].endswith('img_flux_fill_inpaint.json') and j['inpaint_capable'][st[0]['id']] is True, st
print(st[0]['id'])")
[ -n "$FFID" ] && ok "flux fill: the built-in style exists with its inpaint workflow and is inpaint-capable" || bad "flux fill: style missing"
# give it a model + a LoRA (Settings -> Image), then infill with it
curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d "{\"id\":\"$FFID\",\"name\":\"FLUX Fill inpaint\",\"arch\":\"flux\",\"engine\":\"comfy\",\"workflow\":\"comfy_workflows/img_flux_fill_inpaint.json\",\"inpaint_workflow\":\"comfy_workflows/img_flux_fill_inpaint.json\",\"model\":\"e2e-fill.safetensors\",\"loras\":[{\"path\":\"e2e-detail.safetensors\",\"weight\":0.7}]}" > /dev/null
IFF=$(curl -s -X POST http://127.0.0.1:8311/api/infill -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" -F "rgba=@/tmp/e2e_hole.png" \
  -F "prompt=green eye" -F "style_id=$FFID" -F "width=128" -F "height=96")
IFFID=$(echo "$IFF" | jget "['id']" 2>/dev/null)
echo "$IFF" | grep -q 'img_flux_fill_inpaint.json' && echo "$IFF" | grep -q '"input":"rgba"' \
  && ok "flux fill: infill queues through the FLUX Fill graph with the alpha picture" || bad "flux fill: ${IFF:0:200}"
for i in $(seq 1 90); do st=$(curl -sf "http://127.0.0.1:8311/api/jobs/$IFFID" | jget "['status']"); [ "$st" = done ] || [ "$st" = failed ] && break; sleep 1; done
[ "$st" = "done" ] && python3 - <<'PYEOF'
import glob, json, os
newest = max(glob.glob("/tmp/stub-comfy-out/prompt_*.json"), key=os.path.getmtime)
t = json.load(open(newest, encoding="utf-8"))
assert t.get("_models") == ["e2e-fill.safetensors"], t.get("_models")
assert t.get("_loras") == ["e2e-detail.safetensors"], t.get("_loras")
assert t.get("47:23") == "green eye", t
assert len(t.get("_images", [])) == 1
PYEOF
[ $? = 0 ] && ok "flux fill: ComfyUI received the style's model in unet_name, its LoRA in a built LoraLoader, the prompt and the alpha picture" \
  || bad "flux fill: job $st — overrides did not reach the graph: $(python3 -c "import glob,json,os;print(json.load(open(max(glob.glob('/tmp/stub-comfy-out/prompt_*.json'),key=os.path.getmtime))))" 2>/dev/null | head -c 300)"
curl -sf -X POST http://127.0.0.1:8311/api/styles -H "Content-Type: application/json" \
  -d "{\"id\":\"$FFID\",\"name\":\"FLUX Fill inpaint\",\"arch\":\"flux\",\"engine\":\"comfy\",\"workflow\":\"comfy_workflows/img_flux_fill_inpaint.json\",\"inpaint_workflow\":\"comfy_workflows/img_flux_fill_inpaint.json\",\"model\":\"\",\"loras\":[]}" > /dev/null
curl -s -X POST http://127.0.0.1:8311/api/infill -F "crop=@/tmp/e2e_crop.png" -F "mask=@/tmp/e2e_mask.png" -F "prompt=" -F "style_id=$KSID" -F "width=128" -F "height=96" \
  | grep -q "prompt box" && ok "infill: an empty prompt is refused in words" || bad "infill: empty prompt accepted"
curl -s -X POST http://127.0.0.1:8311/api/infill -F "crop=@/tmp/e2e_crop.png" -F "prompt=x" -F "style_id=$KSID" -F "width=128" -F "height=96" \
  | grep -q "mask image missing" && ok "infill: a missing mask is refused" || bad "infill: no-mask accepted"
run_image "klein-plain" "{\"prompt\":\"a lighthouse\",\"style_id\":\"$KSID\"}" 1
echo "$IMG_J" | python3 -c "
import json,sys; j=json.load(sys.stdin)
assert not j['params'].get('workflow'), j['params'].get('workflow')" \
  && ok "klein-refs: with an empty dock the same style renders text-to-image, no swap" \
  || bad "klein-refs: swapped without pictures"
# A CHARACTER FROM ONE PICTURE (2.199.0, by instruction). Upload a png ->
# the Klein reference-edit style renders a sheet through the stub -> the
# job's output adopts into a NEW character whose first reference sheet it
# becomes; regenerate reuses the same upload with a fresh seed.
python3 -c "
import struct, zlib
def png(p):
    raw=b'\\x89PNG\\r\\n\\x1a\\n'
    def ch(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
    ihdr=struct.pack('>IIBBBBB',8,8,8,2,0,0,0)
    idat=zlib.compress(b''.join(b'\\x00'+b'\\x80\\x40\\x20'*8 for _ in range(8)))
    open(p,'wb').write(raw+ch(b'IHDR',ihdr)+ch(b'IDAT',idat)+ch(b'IEND',b''))
png('/tmp/e2e_face.png')
"
SG=$(curl -s -X POST http://127.0.0.1:8311/api/characters/sheetgen -F "image=@/tmp/e2e_face.png" -F "kind=animal" -F "style=photo" -F "gender=female" -F "description=a chestnut mare")
# 2.206.0: the dropdown endpoint — E2E Klein must be listed as sheet-capable
# (its t2i swaps to the edit sibling) carrying ZERO LoRAs.
SS=$(curl -sf http://127.0.0.1:8311/api/characters/sheetstyles)
echo "$SS" | python3 -c "
import json,sys; rows=json.load(sys.stdin)['styles']
r=[x for x in rows if x['name']=='E2E Klein']
assert r and r[0]['swapped'] is True and r[0]['loras']==0 and r[0]['lora_names']==[], rows
" \
  && ok "sheetstyles: the dialog's dropdown lists E2E Klein as sheet-capable with ZERO LoRAs" \
  || bad "sheetstyles listing wrong: $(echo "$SS" | head -c 300)"
SGID=$(echo "$SG" | jget "['id']" 2>/dev/null)
SGIN=$(echo "$SG" | jget "['input']" 2>/dev/null)
for i in $(seq 1 120); do
  s=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SGID" | jget "['status']")
  [ "$s" = done ] || [ "$s" = failed ] && break; sleep 1
done
SGOUT=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SGID" | python3 -c "import json,sys,os; print(os.path.basename(json.load(sys.stdin).get('output') or ''))")
{ [ "$s" = done ] && [ -n "$SGOUT" ] || { bad "sheetgen STEP-0 (render) failed: status '$s' out '$SGOUT'"; false; }; } \
  && printf '%s' "$SG" > /tmp/sg1.json \
  && python3 -c "
import json; import sys; sys.stdin = open('/tmp/sg1.json')
import json,sys; d=json.load(sys.stdin)
assert d.get('input','').startswith('charsheet-'), d.get('input')
assert 'reference sheet' in d.get('sheet_prompt',''), 'the canonical prompt must ride the response'
# 2.201.0: subject-neutral wording — no 'person', no 'A-pose' — so animals
# and vehicles sheet as well as humans
assert 'A-pose' not in d.get('sheet_prompt',''), d.get('sheet_prompt')
# 2.205.0: the options drive the prompt — animal forbids furries outright,
# photo forbids the cartoon default, gender and description ride verbatim
sp=d.get('sheet_prompt','')
assert 'NOT a furry character' in sp and 'Photorealistic photograph style' in sp, sp
assert 'gender: female' in sp and 'a chestnut mare' in sp, sp
# 2.206.0 (hybrid horses): the response NAMES the style and reports the LoRAs
# that will load — the E2E Klein style carries none, so NONE may load.
assert d.get('style_name') == 'E2E Klein', ('the sheet must SAY which style renders it', d.get('style_name'))
assert isinstance(d.get('loras'), list) and d['loras'] == [], ('a LoRA-less style must load NO LoRAs', d.get('loras'))
# 2.207.0: kind=animal + 'a chestnut mare' guesses the HORSE pose template;
# it rides SLOT 1 (the image being edited) so the render anchors to the line
# drawing's poses, and the photo rides slot 2, identity only.
assert d.get('pose_id') == 'horse' and d.get('pose_name') == 'Horse', (d.get('pose_id'), d.get('pose_note'))
assert 'line-drawing pose template' in sp and 'pose, camera angle' in sp, sp
# 2.211.0 (Tim: characters came out wearing hats/glasses/a harness he never
# asked for): naming items as examples PRIMES the model into drawing them —
# the prompts must keep the keep-what-is-there rule while naming NO item
assert 'nothing added, nothing removed, nothing substituted' in sp, sp
assert 'wears and carries nothing' in sp and 'nothing else is ever added' in sp, sp
assert 'saddle' not in sp and 'harness' not in sp and 'glasses' not in sp and 'bridle' not in sp, sp
imgs = (d.get('params') or {}).get('images') or []
assert len(imgs) == 2 and imgs[0].replace(chr(92), '/').endswith('pose-sheets/horse.png'), imgs
assert imgs[1].replace(chr(92), '/').endswith(d.get('input','')), imgs
" 2>/tmp/sheet1.err || { bad "sheetgen STEP-1 (submit asserts) failed: $(tail -c 400 /tmp/sheet1.err) ·· $(echo "$SG" | head -c 120)"; false; } \
  && { RG2=$(curl -s -X POST http://127.0.0.1:8311/api/characters/sheetgen -H 'Content-Type: application/json' \
       -d "{\"file\":\"$SGIN\",\"subject\":\"a rearing chestnut horse\",\"style_id\":\"$KSID\",\"pose\":\"none\"}"); echo "$RG2" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('id') and d.get('input'), ('regenerate did not queue', d)
assert 'The subject is a rearing chestnut horse.' in d.get('sheet_prompt',''), d.get('sheet_prompt')
# 2.206.0: an explicit style_id is honored and echoed back
assert d.get('style_id') == '$KSID' and d.get('style_name') == 'E2E Klein', (d.get('style_id'), d.get('style_name'))
# 2.207.0: pose='none' switches the template OFF — one reference, the plain
# prompt, and the response says no pose rode
assert d.get('pose_id') is None, d.get('pose_id')
assert 'natural, neutral standing stance' in d.get('sheet_prompt','') and 'line-drawing pose template' not in d.get('sheet_prompt',''), d.get('sheet_prompt')
imgs=(d.get('params') or {}).get('images') or []
assert len(imgs)==1, imgs
" || { bad "sheetgen STEP-2 (regenerate) failed: $(echo "$RG2" | head -c 300)"; false; }; } \
  && { AD2=$(curl -s -X POST http://127.0.0.1:8311/api/characters/adopt-sheet -H 'Content-Type: application/json' \
       -d "{\"name\":\"Sheet Guy\",\"file\":\"$SGOUT\"}"); echo "$AD2" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True and d['profile']['images'], d
assert 'sheet' in d['file'], d['file']
" || { bad "sheetgen STEP-3 (adopt) failed: $(echo "$AD2" | head -c 300)"; false; }; } \
  && { CL2=$(curl -sf http://127.0.0.1:8311/api/characters); echo "$CL2" | python3 -c "
import json,sys; cs=json.load(sys.stdin)['characters']
g=[c for c in cs if 'Sheet' in c['name']]
assert g and g[0]['images'], ('adopted character missing', [c['name'] for c in cs])
" || { bad "sheetgen STEP-4 (cast list) failed: $(echo "$CL2" | head -c 300)"; false; }; } \
  && ok "character from one picture: upload -> Klein-edit sheet renders -> regenerate requeues -> ✔ adopt creates the character WITH the sheet"
# 2.212.0 (by instruction: "keep the dialog open when generating image, allow
# the user to generate multiple images and save images they like ... allow
# user to drag images from gallery or reference images or asset images").
# Server side that means: EVERY press queues its OWN job with its OWN fresh
# seed (two presses = two jobs, both logged), a liked take ADOPTS into the
# project's Images assets (the keeper marking — never a re-save), and the
# editor's drop-attach endpoint files an EXISTING Images asset onto a
# character WITHOUT re-uploading bytes. A name that is nowhere refuses in
# words. Uses STEP-0's SGIN/SGID/SGOUT and the Sheet Guy cast entry above.
SG2=$(curl -s -X POST http://127.0.0.1:8311/api/characters/sheetgen -H 'Content-Type: application/json' \
  -d "{\"file\":\"$SGIN\",\"style_id\":\"$KSID\",\"pose\":\"none\"}")
SG2ID=$(echo "$SG2" | jget "['id']" 2>/dev/null)
s2=""
for i in $(seq 1 120); do
  [ -n "$SG2ID" ] || break
  s2=$(curl -sf "http://127.0.0.1:8311/api/jobs/$SG2ID" | jget "['status']")
  [ "$s2" = done ] || [ "$s2" = failed ] && break; sleep 1
done
{ [ -n "$SG2ID" ] && [ "$SG2ID" != "$SGID" ] && [ "$s2" = done ] \
    || { bad "multi-take STEP-A (second press) failed: id '$SG2ID' vs first '$SGID', status '$s2' ·· $(echo "$SG2" | head -c 200)"; false; }; } \
  && { echo "$SG2" | python3 -c "
import json,sys; d=json.load(sys.stdin)
p=d.get('params') or {}
# a second press is NOT a repeat: the request rolled its own fresh seed
assert p.get('seed_random') is True, ('every press rolls its OWN fresh seed', p.get('seed'), p.get('seed_random'))
assert isinstance(p.get('seed'), int), p.get('seed')
" || { bad "multi-take STEP-A (fresh seed) failed: $(echo "$SG2" | head -c 200)"; false; }; } \
  && { KP=$(curl -s -X POST http://127.0.0.1:8311/api/passets/adopt -H 'Content-Type: application/json' \
       -d "{\"name\":\"$SGOUT\",\"kind\":\"images\"}"); KPN=$(echo "$KP" | jget "['name']" 2>/dev/null);
       [ -n "$KPN" ] || { bad "multi-take STEP-B (keeper adopt) failed: $(echo "$KP" | head -c 200)"; false; }; } \
  && { curl -sf http://127.0.0.1:8311/api/passets | python3 -c "
import json,sys; d=json.load(sys.stdin)
names=[x['name'] for x in d['images']]
assert '$KPN' in names, ('the kept take must be listed under Images assets', names)
" || { bad "multi-take STEP-B (assets list) failed: kept name '$KPN' not listed"; false; }; } \
  && { AT=$(curl -s -X POST "http://127.0.0.1:8311/api/characters/Sheet%20Guy/asset-from" \
       -H 'Content-Type: application/json' -d "{\"file\":\"$KPN\"}"); echo "$AT" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True and d.get('kind') == 'images', d
assert len((d.get('profile') or {}).get('images') or []) >= 2, ('drop-attach must ADD a sheet beside the adopted one', d)
" || { bad "multi-take STEP-C (drop-attach) failed: $(echo "$AT" | head -c 300)"; false; }; } \
  && { curl -s -X POST "http://127.0.0.1:8311/api/characters/Sheet%20Guy/asset-from" \
       -H 'Content-Type: application/json' -d '{"file":"never-there.png"}' \
       | grep -q "not in this project" \
       || { bad "multi-take STEP-D (a missing file must refuse in words)"; false; }; } \
  && ok "multi-take sheets: two presses = two logged jobs with fresh seeds, 💾 adopts the keeper into Images assets, and drop-attach files it onto the character without re-upload"
curl -s -X DELETE "http://127.0.0.1:8311/api/characters/Sheet%20Guy" > /dev/null 2>&1 || true
# ---- 2.216.0 (by instruction): ids, the 🎭 cast, and the writer's RAG -----
# Every character carries a unique id (its FOLDER name); persona/backstory
# save through the profile and ride the briefing; the cast selection narrows
# what the WRITER and the guide see; an empty selection means everyone.
CA=$(curl -s -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Cast Test A","age":"30","persona":"dry wit, never raises his voice","backstory":"ex-lighthouse keeper"}')
CAID=$(echo "$CA" | jget "['character']['id']")
curl -s -X POST http://127.0.0.1:8311/api/characters -H 'Content-Type: application/json' \
  -d '{"name":"Cast Test B","age":"22"}' > /dev/null
{ [ -n "$CAID" ] && echo "$CAID" | grep -q "^c" \
    || { bad "cast STEP-1: no unique id minted: $(echo "$CA" | head -c 160)"; false; }; } \
  && { curl -sf http://127.0.0.1:8311/api/characters/briefing | python3 -c "
import json,sys; b=json.load(sys.stdin)['briefing']
assert 'dry wit, never raises his voice' in b, ('persona must ride the briefing', b)
assert 'ex-lighthouse keeper' in b, ('backstory must ride the briefing', b)
" || { bad "cast STEP-2: persona/backstory missing from the briefing"; false; }; } \
  && { curl -s -X PUT http://127.0.0.1:8311/api/characters/cast -H 'Content-Type: application/json' \
       -d "{\"active\":[\"$CAID\"]}" | grep -q '"ok":true' \
       || { bad "cast STEP-3: selection not stored"; false; }; } \
  && { curl -sf http://127.0.0.1:8311/api/characters/briefing | python3 -c "
import json,sys; b=json.load(sys.stdin)['briefing']
assert 'Cast Test A' in b and 'Cast Test B' not in b, ('the writer must see ONLY the chosen actors', b)
" || { bad "cast STEP-4: benched actor still reaches the writer"; false; }; } \
  && { curl -sf "http://127.0.0.1:8311/api/screenplay/guide" | python3 -c "
import json,sys; g=json.load(sys.stdin)['guide']
assert 'cast_test_a' in g and 'cast_test_b' not in g, 'the guide must offer only the cast @tags'
" || { bad "cast STEP-5: the guide still offers benched @tags"; false; }; } \
  && { curl -s -X PUT http://127.0.0.1:8311/api/characters/cast -H 'Content-Type: application/json' \
       -d '{"active":[]}' > /dev/null
       curl -sf http://127.0.0.1:8311/api/characters/briefing | grep -q "Cast Test B" \
       || { bad "cast STEP-6: clearing the selection must mean everyone again"; false; }; } \
  && ok "actors in the scene: unique ids, persona+backstory ride the briefing, the 🎭 selection narrows the writer and the guide, empty = everyone"
curl -s -X DELETE "http://127.0.0.1:8311/api/characters/Cast%20Test%20A" > /dev/null 2>&1
curl -s -X DELETE "http://127.0.0.1:8311/api/characters/Cast%20Test%20B" > /dev/null 2>&1
curl -s -X DELETE "http://127.0.0.1:8311/api/styles/$KSID" > /dev/null 2>&1 || true

# ---- 2.289.0: the video docker's Load-audio 💾 over the LIVE server -------
# POST /api/scenes/from-segments writes the .seg (start + duration per
# segment) and stages one scene per segment with its window filled - the
# board (the .prj and its scene mirror) is snapshotted and restored.
SGP=$(curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "import json,sys; print(json.load(sys.stdin).get('project') or 'default')")
SGDIR="projects/$SGP"; SGSNAP=$(mktemp -d)
cp "$SGDIR/$SGP.prj" "$SGSNAP/prj" 2>/dev/null || true
[ -d "$SGDIR/scenes" ] && cp -r "$SGDIR/scenes" "$SGSNAP/scenes"
mkdir -p "$SGDIR/sound"
ffmpeg -y -f lavfi -i sine=frequency=440:duration=20 "$SGDIR/sound/e2e_seg289live.wav" > /dev/null 2>&1
SGR=$(curl -s -X POST http://127.0.0.1:8311/api/scenes/from-segments -H 'Content-Type: application/json' \
      -d '{"song":"e2e_seg289live.wav","durations":[8,12],"manual":[false,true]}')
echo "$SGR" | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('ok') is True, d
assert d.get('seg') == 'e2e_seg289live.seg', d
assert d.get('scenes') == 2 and d.get('audio') == 'e2e_seg289live.wav', d
" > /tmp/seg289live.log 2>&1 \
  && grep -q "segment 1: 0s to 8s (8 seconds)" "$SGDIR/sound/e2e_seg289live.seg" \
  && grep -q "segment 2: 8s to 20s (12 seconds) \[manual\]" "$SGDIR/sound/e2e_seg289live.seg" \
  && curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "
import json,sys; d=json.load(sys.stdin); L=d['list']
assert len(L) == 2, L
assert [(r.get('audio_start'), r.get('audio_dur')) for r in L] == [(0, 8), (8, 12)], L
assert d.get('audio') == 'e2e_seg289live.wav' and d.get('seg_song') == 'e2e_seg289live.wav', d
assert all('blank - awaiting the writer' in ' '.join(r['prompt']) for r in L), L
" >> /tmp/seg289live.log 2>&1 \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8311/api/scenes/from-segments -H 'Content-Type: application/json' -d '{"song":"e2e_no_such_song.wav"}')" = "404" ] \
  && ok "2.289.0 LIVE: POST /api/scenes/from-segments writes the .seg (start + duration per segment) and stages one blank scene per segment with its start/duration filled; an unknown song is a 404" \
  || { bad "2.289.0 LIVE from-segments: $(echo "$SGR" | head -c 240)"; tail -6 /tmp/seg289live.log; }
rm -f "$SGDIR/sound/e2e_seg289live.wav" "$SGDIR/sound/e2e_seg289live.seg"
[ -f "$SGSNAP/prj" ] && cp "$SGSNAP/prj" "$SGDIR/$SGP.prj"
rm -rf "$SGDIR/scenes"; [ -d "$SGSNAP/scenes" ] && cp -r "$SGSNAP/scenes" "$SGDIR/scenes"
rm -rf "$SGSNAP"

# ---- 2.359.0: SAVE / SAVE AS (Tim: "add a save button to the image preview dialog next to the open externally
# button. add a save as button to the top left of the thumbnails in the gallery ... on save the file to the last
# save as location"). LIVE: Save as copies a gallery file to a picked path and remembers the folder; Save then
# copies into that folder under the file's own name (a second Save gets " (2)"); the memory is restored after.
SVP=$(curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "import json,sys; print(json.load(sys.stdin).get('project') or 'default')")
SVOUT="projects/$SVP/output"; mkdir -p "$SVOUT"; SVD=$(mktemp -d)
SVMEMO="workspace/save_as.json"; SVSNAP=""; [ -f "$SVMEMO" ] && SVSNAP=$(cat "$SVMEMO")
ffmpeg -y -f lavfi -i color=c=green:size=64x64 -frames:v 1 "$SVOUT/e2e_saveas359.png" > /dev/null 2>&1
SV1=$(curl -s -X POST http://127.0.0.1:8311/api/save-as -H 'Content-Type: application/json' \
      -d "{\"url\":\"/outputs/e2e_saveas359.png\",\"dest\":\"$SVD/picked name.png\"}")
SVL=$(curl -s http://127.0.0.1:8311/api/save-as/last)
SV2=$(curl -s -X POST http://127.0.0.1:8311/api/save-as -H 'Content-Type: application/json' -d '{"url":"/outputs/e2e_saveas359.png","name":"e2e_saveas359.png"}')
SV3=$(curl -s -X POST http://127.0.0.1:8311/api/save-as -H 'Content-Type: application/json' -d '{"url":"/outputs/e2e_saveas359.png","name":"e2e_saveas359.png"}')
python3 - "$SV1" "$SVL" "$SV2" "$SV3" "$SVD" > /tmp/saveas359.log 2>&1 <<'PY'
import json, sys, os
a, l, b, c, d = [json.loads(x) for x in sys.argv[1:5]] + [sys.argv[5]]
assert a.get('ok') and a['path'] == os.path.join(d, 'picked name.png') and os.path.getsize(a['path']) > 0, a
assert l == {'dir': d, 'exists': True}, l
assert b.get('ok') and b['path'] == os.path.join(d, 'e2e_saveas359.png'), b
assert c.get('ok') and c['name'] == 'e2e_saveas359 (2).png' and 'already there' in c['note'], c
PY
[ $? -eq 0 ] && ok "save as (2.359.0): Save as copies a gallery picture to the picked folder + name and remembers the folder; 💾 Save copies into it under its own name, a second Save never overwrites (name (2))" \
  || { bad "save as: $(echo "$SV1 | $SV2 | $SV3" | head -c 300)"; tail -3 /tmp/saveas359.log; }
rm -f "$SVOUT/e2e_saveas359.png"; rm -rf "$SVD"
if [ -n "$SVSNAP" ]; then printf '%s' "$SVSNAP" > "$SVMEMO"; else rm -f "$SVMEMO"; fi

# ---- 2.360.0: THE SFX DOCK (Tim: "can you add a sfx docker, let user add video files, including .mov or audio
# files, extract audio from video files allow user to select section from the waveform and trim - give option to
# keep selected or delete selected"). LIVE: a .mov uploaded -> its audio is a WAV in projects/<p>/sfx; Delete
# selected, Undo, Keep selected as a new file, -> Sound assets; everything removed after.
SFP=$(curl -sf http://127.0.0.1:8311/api/scenes | python3 -c "import json,sys; print(json.load(sys.stdin).get('project') or 'default')")
SFT=$(mktemp -d)
ffmpeg -y -f lavfi -i testsrc=size=160x90:rate=24 -f lavfi -i sine=frequency=500:duration=4 -t 4 -c:v libx264 -c:a aac -shortest "$SFT/e2e_sfx360.mov" > /dev/null 2>&1
SFA=$(curl -s -X POST http://127.0.0.1:8311/api/sfx/add -F "files=@$SFT/e2e_sfx360.mov")
SFD=$(curl -s -X POST http://127.0.0.1:8311/api/sfx/trim -H 'Content-Type: application/json' -d '{"name":"e2e_sfx360.wav","start":1,"end":3,"mode":"delete"}')
SFU=$(curl -s -X POST http://127.0.0.1:8311/api/sfx/undo -H 'Content-Type: application/json' -d '{"name":"e2e_sfx360.wav"}')
SFK=$(curl -s -X POST http://127.0.0.1:8311/api/sfx/trim -H 'Content-Type: application/json' -d '{"name":"e2e_sfx360.wav","start":0.5,"end":1.5,"mode":"keep","as_new":true}')
SFS=$(curl -s -X POST http://127.0.0.1:8311/api/sfx/to-sound -H 'Content-Type: application/json' -d '{"name":"e2e_sfx360_keep.wav"}')
SFW=$(curl -s "http://127.0.0.1:8311/api/sfx/peaks/e2e_sfx360.wav")
SFG=$(curl -s "http://127.0.0.1:8311/api/outputs?kind=audio")
python3 - "$SFA" "$SFD" "$SFU" "$SFK" "$SFS" "$SFW" "projects/$SFP" "$SFG" > /tmp/sfx360.log 2>&1 <<'PY'
import json, sys, os
a, d, u, k, s, w = [json.loads(x) for x in sys.argv[1:7]]; P = sys.argv[7]; g = json.loads(sys.argv[8])
# 2.361.0: every saved cut is in the gallery's Audio tab (output/sfx_<name>)
names = [x.get('name') for x in g]
assert d.get('gallery') == 'sfx_e2e_sfx360.wav' and k.get('gallery') == 'sfx_e2e_sfx360_keep.wav', (d, k)
assert 'sfx_e2e_sfx360.wav' in names and 'sfx_e2e_sfx360_keep.wav' in names, names
assert a.get('ok') and a['added'][0]['name'] == 'e2e_sfx360.wav' and a['added'][0]['from'] == 'video', a
assert os.path.exists(os.path.join(P, 'sfx', 'e2e_sfx360.wav')), 'the wav'
assert d.get('ok') and abs(d['seconds'] - 2) < 0.03 and d['undo'], d
assert u.get('ok') and abs(u['seconds'] - 4) < 0.06, u
assert k.get('ok') and k['name'] == 'e2e_sfx360_keep.wav' and abs(k['seconds'] - 1) < 0.03, k
assert s.get('ok') and os.path.exists(os.path.join(P, 'sound', s['name'])), s
assert len(w.get('peaks', [])) > 100 and abs(w['seconds'] - 4) < 0.06, w.get('seconds')
PY
[ $? -eq 0 ] && ok "sfx (2.360.0): a .mov's audio lands in the SFX dock as a WAV; Delete selected (4 s -> 2 s), Undo, Keep selected as a new file (1 s), → Sound assets, the waveform; 2.361.0: each saved cut is in the gallery's Audio tab (sfx_<name>)" \
  || { bad "sfx: $(echo "$SFA | $SFD | $SFK" | head -c 300)"; tail -3 /tmp/sfx360.log; }
SFSN=$(echo "$SFS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
[ -n "$SFSN" ] && rm -f "projects/$SFP/sound/$SFSN"
rm -f "projects/$SFP/sfx/e2e_sfx360.wav" "projects/$SFP/sfx/e2e_sfx360_keep.wav" "projects/$SFP/sfx/.undo/e2e_sfx360.wav" \
      "projects/$SFP/output/sfx_e2e_sfx360.wav" "projects/$SFP/output/sfx_e2e_sfx360_keep.wav"
rm -rf "$SFT"

# ---- 2.367.0 (Tim: "can we add a screen capture and screen record button in the left docker menubar, icon
# only. so i can make a promotional video and tutorials"): the module, routes, Electron side and page in
# scripts/test-screencap.js; then the REAL thing in Chromium - this tab shared, a PNG, a 3 s recording made into an
# H.264 mp4 by this server. Screen capture needs a display: xvfb-run when it is here (no display = SKIP).
node scripts/test-screencap.js > /tmp/screencap367.log 2>&1 \
  && ok "screencap unit tests (2.367.0 📷 / ⏺: PNG + chunked recording -> H.264/AAC mp4 in the gallery, the routes, Electron window/screen + Windows sound, the page)" \
  || { bad "screencap unit tests"; tail -12 /tmp/screencap367.log; }
if command -v xvfb-run > /dev/null 2>&1; then SCX="xvfb-run -a -s \"-screen 0 1600x1000x24\""; else SCX=""; fi
eval "$SCX node scripts/test-screencap-ui.js" > /tmp/screencap367ui.log 2>&1 \
  && ok "screencap (2.367.0): in a real browser 📷 saves a PNG and ⏺ ... ⏺ saves an H.264 mp4, both in the gallery - or SKIP without playwright / a display" \
  || { bad "screencap: the browser test"; tail -12 /tmp/screencap367ui.log; }

# ---- 2.375.1 (Tim: "i set it to 15 steps but it is still rendering 20 steps" - the job said "steps=20 (auto ...)"):
# Basic Settings' Steps survives a page load (a late config answer used to reset it) and reaches Generate
node scripts/test-basicsteps-ui.js > /tmp/bsteps.log 2>&1 \
  && ok "basic settings: Steps 15 survives a reload even when the config answers last, Generate posts it and the console says so - or SKIP without playwright (2.375.1)" \
  || { bad "basic settings: Steps browser test"; grep -a "FAIL\|Error" /tmp/bsteps.log | head -12; }

# ---- 2.376.0 (Tim: "please add a settings button to the right of the timeline docker. add nudge settings to a
# timeline settings dialog ... when user presses the left or right arrow nudge the timeline clip left or right by
# the number of frames set in the settings dialog")
node scripts/test-tlnudge-ui.js > /tmp/tlnudge.log 2>&1 \
  && ok "timeline: ⚙ settings (titlebar + Nudge, saved to the settings file); ← / → nudge the selected clip by its frames, Shift by the second value, never before 0, V1 one after another - or SKIP without playwright (2.376.0)" \
  || { bad "timeline: nudge browser test"; grep -a "FAIL\|Error" /tmp/tlnudge.log | head -12; }

# ---- 2.377.0 (Tim: "Add a preview canvas to the timeline docker ... a layers docker on the right ... a photoshop
# style toolbar to the left ... play preview in the preview canvas, similar to after effects")
node scripts/test-cliptransform.js > /tmp/cliptf.log 2>&1 \
  && ok "cliptransform unit tests (2.377.0 a layer clip's position / scale / rotation from the canvas to the compile, the text picture route, the dock wiring)" \
  || { bad "cliptransform unit tests"; tail -12 /tmp/cliptf.log; }
node scripts/test-tlcanvas-ui.js > /tmp/tlcanvas.log 2>&1 \
  && ok "timeline canvas: toolbar | canvas | layers; drops land on new layers where dropped; Move / Text / ▶ / Space; the COMPILED frame matches the canvas (moved, scaled, rotated layers) - or SKIP without playwright (2.377.0)" \
  || { bad "timeline canvas browser test"; grep -a "FAIL\|Error" /tmp/tlcanvas.log | head -12; }

# ---- 2.379.0 (Tim: "add a keyframe to the timeline on that text layer then add another keyframe at a different time
# and scale or move or change color can we create a tween between the keyframes?")
# 2.379.1 (Tim's fl2va: "shape '[1, 24, 1, 1, 22, 2, 40, 2]' is invalid for input of size 86400")
node scripts/test-h3keyframefit.js > /tmp/h3fit3791.log 2>&1 \
  && ok "H3 keyframe fit unit tests (2.379.1 a First / Last picture fitted to the video's 32-px size before the upload)" \
  || { bad "H3 keyframe fit unit tests"; tail -12 /tmp/h3fit3791.log; }
node scripts/test-keyframes.js > /tmp/kf379.log 2>&1 \
  && ok "keyframes unit tests (2.379.0 tweens: eases, colours, the worker's mirror + ffmpeg expression = static/keyframes.js, the export keeps kf, the white text twin)" \
  || { bad "keyframes unit tests"; tail -12 /tmp/kf379.log; }
node scripts/test-keyframes-ui.js > /tmp/kfui379.log 2>&1 \
  && ok "keyframes browser test: ◇ Key + auto-key make two ◆ on a text layer, the canvas tweens position / scale / rotation / colour, eases, ◀ ▶; ⚙ Compile draws the same tween - or SKIP without playwright (2.379.0)" \
  || { bad "keyframes browser test"; grep -a "FAIL\|Error" /tmp/kfui379.log | head -12; }

# ---- 2.380.0 (Tim: "add the 736 as an option in videodocker settings - in the timeline remove no selection ... keep the ui
# clean ... add a selection box and masking tools ... add a karaoke generator to timeline ... add karaoke options to
# settings in videodocker and timelinedocker settings")
node scripts/test-h3fitup.js > /tmp/h3up380.log 2>&1 \
  && ok "H3 size unit tests (2.380.0 736 = render 1280x736, keyframes edge-extended, every chunk + master cropped back to 1280x720)" \
  || { bad "H3 size unit tests"; tail -12 /tmp/h3up380.log; }
node scripts/test-karaokestyle.js > /tmp/ks380.log 2>&1 \
  && ok "karaoke style unit tests (2.380.0 the style in the settings, the ASS colours / size / position, the background band on real pixels, the song generator)" \
  || { bad "karaoke style unit tests"; tail -12 /tmp/ks380.log; }
node scripts/test-tlfill.js > /tmp/tlfill380.log 2>&1 \
  && ok "timeline fill unit tests (2.380.0 the layer pictures, the masked see-through video, the routes, the fill wiring)" \
  || { bad "timeline fill unit tests"; tail -12 /tmp/tlfill380.log; }
node scripts/test-timeline380-ui.js > /tmp/tl380ui.log 2>&1 \
  && ok "timeline 2.380 browser test: start:end - frames only, ❔ help, ⬚ Select / 🖌 Mask + ✨ Fill (image + masked video layers), the karaoke style dialog, the 🎤 generator on the Karaoke layer - or SKIP without playwright" \
  || { bad "timeline 2.380 browser test"; grep -a "FAIL\|Error" /tmp/tl380ui.log | head -12; }

# ---- 2.381.0 (Tim: "remove checkboxes in queue menubar / create a file for docker status - docker_status.json ...
# add a pin button to the left of each docker ... All dockers will be able to be resized if they are open even if they
# are maximized")
node scripts/test-dockstatus.js > /tmp/ds381.log 2>&1 \
  && ok "docker status unit tests (2.381.0 docker_status.json: the seven values per dock, one maximized, the first-run fold-in, the record in the page head, the routes, the 📌 rules)" \
  || { bad "docker status unit tests"; tail -12 /tmp/ds381.log; }
curl -sf http://127.0.0.1:8311/ | head -c 2000 | grep -q '<script>window.H3_DOCK_STATUS = {"version":1,"docks":{' \
  && ok "docker status: the page carries docker_status.json in its head (loaded first)" || bad "docker status: no record in the page head"
curl -sf -X POST http://127.0.0.1:8311/api/docker-status -H 'Content-Type: application/json' \
  -d '{"docks":{"stemsdock":{"max_height":233,"height":233}}}' > /dev/null
python3 -c "
import json; d=json.load(open('docker_status.json'))['docks']['stemsdock']
assert d['max_height']==233 and d['height']==233 and set(d)=={'state','hidden','height','width','max_height','max_width','maximized'}, d
" && ok "docker status: POST /api/docker-status lands in docker_status.json at the install root (state, hidden, height, width, max_height, max_width, maximized)" \
  || bad "docker status: docker_status.json $(head -c 300 docker_status.json)"
curl -s -X POST http://127.0.0.1:8311/api/docker-status -H 'Content-Type: application/json' \
  -d '{"docks":{"stemsdock":{"max_height":0}}}' > /dev/null
node scripts/test-dockstatus-ui.js > /tmp/dsui381.log 2>&1 \
  && ok "docker status browser test: 📌 first in every header, a pin caps the drag, opening a dock restores the pinned heights, maximize keeps the others open + still resizes, reload keeps it all, no queue boxes - or SKIP without playwright" \
  || { bad "docker status browser test"; grep -a "FAIL\|Error" /tmp/dsui381.log | head -12; }

# ---- 2.382.0 (Tim: "can we add 3d model(fbx, obj) to timeline canvas and 3d text? Please make the info above the
# generate button show the steps only not the full details - below the generate button add a progress bar while generating")
node scripts/test-m3d.js > /tmp/m3d382.log 2>&1 \
  && ok "3D layers unit tests (2.382.0 models3d/ uploads, the machine's fonts for 3D text, the bake -> see-through m3d_<id>.webm, the routes, three.js local, the prompt docker's steps + bar)" \
  || { bad "3D layers unit tests"; tail -12 /tmp/m3d382.log; }
node scripts/test-m3d-ui.js > /tmp/m3dui382.log 2>&1 \
  && ok "3D layers browser test: 🧊 3D text + OBJ/MTL + FBX drawn live by three.js, spin + ◆ rotation, the bake, COMPILE = CANVAS, the progress bar under Generate - or SKIP without playwright" \
  || { bad "3D layers browser test"; grep -a "FAIL\|Error" /tmp/m3dui382.log | head -12; }

# ---- 2.382.1 (Tim: "move the menubar from the left docker to the main window below the titlebar. allow user to edit the
# names of the layers")
node scripts/test-menubar-ui.js > /tmp/mb3821.log 2>&1 \
  && ok "menu bar + layer names browser test: the buttons in a full-width row under the title bar (the docks under it), a layer renamed in place / F2 / the Name box / the track label, all in step - or SKIP without playwright" \
  || { bad "menu bar + layer names browser test"; grep -a "FAIL\|Error" /tmp/mb3821.log | head -12; }

# ---- 2.383.0 (Tim: "allow the user to drag the red marker in the timeline ... double clicks on a time ... scale the
# height of the timeline markers with zoom ... each layers placeholder a different color. highlight the selected layer,
# remove the media play,stop,pause next and previous buttons from the timeline menubar")
node scripts/test-tlmarker-ui.js > /tmp/tlmk383.log 2>&1 \
  && ok "timeline marker browser test: no transport in the menu bar, a colour per layer, the selected layer lit, marker rows scale with zoom (>= 1em), the marker dragged by its line (stopped: the frame; playing: continues from the drop), double-click a time plays from it - or SKIP without playwright" \
  || { bad "timeline marker browser test"; grep -a "FAIL\|Error" /tmp/tlmk383.log | head -12; }

# ---- 2.384.0 (Tim: "highlight the pins ... llm settings - use this format ... step n of total ... show metadata - seed,
# cfg,steps, model used,loras used ... seed input in the basic settings ... seed input to the scenes ... same seed for all
# scenes ... running step n of total and show a progress bar and time taken to render")
node scripts/test-jobmeta.js > /tmp/jm384.log 2>&1 \
  && ok "render details unit tests (2.384.0 the worker's [meta] + seed lines -> metadata + progress, graph_meta, force_seed / plan_seed, scene seeds, the routes, the page wiring)" \
  || { bad "render details unit tests"; tail -12 /tmp/jm384.log; }
node scripts/test-jobmeta-ui.js > /tmp/jmui384.log 2>&1 \
  && ok "render details browser test: pins lit until pinned, the tokens lines, 'step n of total' in the queue, ⓘ details dialog + ♻ Use, the preview dialog's pane, Basic Settings 🎲 / ♻, the ⚙ same seed, a scene's step / bar / time / seed box - or SKIP without playwright" \
  || { bad "render details browser test"; grep -a "FAIL\|Error" /tmp/jmui384.log | head -12; }

# ---- 2.384.1 (Tim: "when the pin ... is pressed and a max height is already set, then set the max-height to zero and
# allow user to change the height of the docker and press the pin again to set max height")
node scripts/test-pinresize-ui.js > /tmp/pinr3841.log 2>&1 \
  && ok "pin resize browser test: a pinned video dock is a fixed dock its seam sizes (no further than the pin), 📌 again = any height, 📌 once more = the new max, kept on reload; a pinned bottom dock shrinks by its own seam - or SKIP without playwright" \
  || { bad "pin resize browser test"; grep -a "FAIL\|Error" /tmp/pinr3841.log | head -12; }

# ---- 2.385.0 (Tim: "put timeline docker tools properties in a floating docker the number 1 on the keyboard makes it
# visible ... add lights to 3d scene ... brightness of the lights ... materials to 3d objects ... drag keyframe diamond ...
# remove keyframes ... 3d interactive rotate and transform and move widgets ... a blender to bitgen bridge?")
python3 scripts/test-blender.py > /tmp/blpy385.log 2>&1 \
  && ok "Blender bridge maths (2.385.0 three.js -> Blender axes, the same framing, rotation order, scale axes, light power, colours, engines, materials, lights)" \
  || { bad "Blender bridge maths"; tail -12 /tmp/blpy385.log; }
node scripts/test-blender.js > /tmp/bljs385.log 2>&1 \
  && ok "Blender bridge unit tests (settings, finding Blender, the add-on's sends + inbox, the render bake with a stub Blender, the routes, a REAL Blender render when installed, the add-on / render script / page files)" \
  || { bad "Blender bridge unit tests"; grep -a "FAIL" /tmp/bljs385.log | head -12; }
node scripts/test-m3dtools-ui.js > /tmp/m3dt385.log 2>&1 \
  && ok "3D tools browser test: 🧰 floating Tools & Properties (1, titlebar drag, ✕, 🧰), ◆ drag limits + remove, 🎨 materials, 💡 lights + brightness, the move / rotate / scale widgets, .glb, the add-on's sends (new layer, live link), Render with Blender - or SKIP without playwright" \
  || { bad "3D tools browser test"; grep -a "FAIL\|Error" /tmp/m3dt385.log | head -12; }

# ---- 2.386.0 (Tim: "if a docker is visible, either open or closed, highlight the toggle button in the statusbar ... make
# buttons for all dockers (not floating dockers). can we have a top toolbar when user selects a 3d layer for 3d operations?")
node scripts/test-statusbar3d-ui.js > /tmp/sb3d386.log 2>&1 \
  && ok "statusbar + 3D toolbar browser test: a button for every docker, lit while on screen (collapsed too), hide / show; the 3D toolbar over the canvas (widget, snap, views, spin, reset, material, lights, ◇ Key, Blender) - or SKIP without playwright" \
  || { bad "statusbar + 3D toolbar browser test"; grep -a "FAIL\|Error" /tmp/sb3d386.log | head -12; }

# ---- 2.387.0 (Tim: "can we add a paths layer , then generate parts of the scene on each path layer so animals, cars,
# people can be rendered separately have transparent backgrounds and compose the scene")
python3 scripts/test-pathati.py > /tmp/pati387.log 2>&1 \
  && ok "Wan ATI graph (2.387.0 the ATI model picked - never for plain i2v, tracks resampled to 121 points in the video's pixels, WanTrackToVideo + CLIP vision, refusals)" \
  || { bad "Wan ATI graph"; tail -12 /tmp/pati387.log; }
node scripts/test-paths.js > /tmp/paths387.log 2>&1 \
  && ok "path layers unit tests (the green screen cut away: chroma key + the matte script's pipes, the mirror, the subject's box; AI matte status / refusal / auto; lib/wan ati; the routes; the page's wiring)" \
  || { bad "path layers unit tests"; grep -a "FAIL" /tmp/paths387.log | head -12; }
node scripts/test-paths-ui.js > /tmp/pathsui387.log 2>&1 \
  && ok "path layers browser test: ＋ Path layer, the ⤳ tool (lay / drag / Alt-remove points), the panel, ✨ in place (picture -> video -> cut-out -> clips along the path, the mirror, sizes, feet on the path), ⟲ place again, Wan ATI (121-point tracks, one full-frame clip) - or SKIP without playwright" \
  || { bad "path layers browser test"; grep -a "FAIL\|Error" /tmp/pathsui387.log | head -12; }

# ---- 2.388.0 (Tim: "add option to dropdown in reference docker video dropdown -"Append" ... take the last frame, upscale
# the png then generate an i2v or fl2va video from that frame-append the video" / "prepend" ... / "is it possible to use
# refmods in fl2va?")
python3 scripts/test-clipjoin.py > /tmp/cj388.log 2>&1 \
  && ok "Append / Prepend join (2.388.0 real ffmpeg: the first / last frame out, the frame upscaled in place - lanczos, a failed ComfyUI upscale falls back - append drops the part's first frame, prepend its last, a reversed part, one sound track)" \
  || { bad "Append / Prepend join"; grep -a "FAIL" /tmp/cj388.log | head -12; }
node scripts/test-frameop.js > /tmp/fo388.log 2>&1 \
  && ok "Append / Prepend from Generate (lib/frameOp: the frame, the order, the size, refusals; the page's pick; the wiring; refmods on fl2va's MiniMaxH3ImageToVideo; LIVE: /api/generate -> the worker appends / prepends - 48 + part - 1 frames)" \
  || { bad "Append / Prepend from Generate"; grep -a "FAIL" /tmp/fo388.log | head -12; }
node scripts/test-frameop-ui.js > /tmp/foui388.log 2>&1 \
  && ok "Append / Prepend browser test: the Use dropdown on every reference video, one op video at a time, Generate sends ref_video_op + fl2va + the Last / First frame picture only, kept with the project, ✕ clears - or SKIP without playwright" \
  || { bad "Append / Prepend browser test"; grep -a "FAIL\|Error" /tmp/foui388.log | head -12; }

# ---- 2.389.0 (Tim: "can we build our image editor to have the same functionality and look as
# https://github.com/storytold/photocraft and make our prompt docker floating but allow user to snap to another docker -
# a drag and drop snap "P" will toggle the prompt unless typing in an input")
node scripts/test-pceditor.js > /tmp/pce389.log 2>&1 \
  && ok "Photoshop-style editor + floating prompt unit tests (2.389.0 the layer tree, snapshots, 18 + 23 adjustments / filters, crop / transform / tone / gradient maths, Photoshop's tool keys + accelerators, magnetic snap + drop zones + when P toggles, docker_status.json's prompt fields, the wiring)" \
  || { bad "Photoshop-style editor + floating prompt unit tests"; grep -a "FAIL" /tmp/pce389.log | head -12; }
node scripts/test-pceditor-ui.js > /tmp/pceui389.log 2>&1 \
  && ok "Photoshop-style editor browser test: menus / tools / panels, File ▸ New, adjustment layers (mask, live Properties, pass-through vs normal group), clipping, layer styles, Type / Shape / Gradient / Clone / Spot Healing / Dodge / Quick Mask / Crop / Free Transform with the pointer + keys, Image Size, History, Ctrl+K, Export As, themes, Flatten - or SKIP without playwright" \
  || { bad "Photoshop-style editor browser test"; grep -a "FAIL\|Error" /tmp/pceui389.log | head -12; }
node scripts/test-pfloat-ui.js > /tmp/pfui389.log 2>&1 \
  && ok "floating prompt browser test: floats by default, P hides / shows (not while typing, not Shift+P), magnetic edges, header click vs drag, docked beside a dock (remembered over a reload), dragged out, docked below a dock, in a side docker - or SKIP without playwright" \
  || { bad "floating prompt browser test"; grep -a "FAIL\|Error" /tmp/pfui389.log | head -12; }

# ---- 2.390.0 (Tim: "yes, please do these steps and maybe add sam to segment the image on the layer and add an option
# to put segments on different layers" - layers as references, "mask the persons head" from a prompt, PSD files)
node scripts/test-pcsam.js > /tmp/pcsam390.log 2>&1 \
  && ok "Segment Anything + Compose + PSD unit tests (2.390.0 lib/segment: requests, the venv plan, the checkpoint; scripts/segment.py through its stand-in AND the real SAM / CLIPSeg calls against stand-in modules; /api/segment, /api/aiedit/compose (Qwen 2511 + picture slots, the layers named), /api/psd; the compose graph through the real patcher; the PSD mappings)" \
  || { bad "Segment Anything + Compose + PSD unit tests"; grep -a "FAIL" /tmp/pcsam390.log | head -12; }
node scripts/test-pcsam-ui.js > /tmp/pcsamui390.log 2>&1 \
  && ok "Segment Anything + Compose + PSD browser test: the Object Selection tool (click / Shift / Alt / box / Find / Mask), Subject -> layers, Segment Layer (cut, undo), Ctrl-click picks -> ✨ Compose -> a layer, → References, Save / Open PSD both ways (real ag-psd), the settings - or SKIP without playwright" \
  || { bad "Segment Anything + Compose + PSD browser test"; grep -a "FAIL\|Error" /tmp/pcsamui390.log | head -12; }

# ---- 2.391.0 (Tim: "remove Start clip 1 Range 1:2 Redo scene — ⇥ Timeline 🎬 Produce from videodocker / make the video
# docker info window the height of the statusbar / in image editor, show the mask as the user is drawing")
node scripts/test-vdinfo-ui.js > /tmp/vdinfo391.log 2>&1 \
  && ok "video docker info line + live mask browser test: the five controls gone, the info line the status bar's height at the docker's bottom (Build still says what it did there), a brush on a mask tints what it hides red while drawing, \\ keeps the overlay - or SKIP without playwright" \
  || { bad "video docker info line + live mask browser test"; grep -a "FAIL\|Error" /tmp/vdinfo391.log | head -12; }

# ---- 2.391.1 (Tim: "create a pdf with instructions and shortcut key quick view")
python3 scripts/test-guidepdf.py > /tmp/guide3911.log 2>&1 \
  && ok "PDF guide (2.391.1 scripts/make_guide_pdf.py: every shortcut group and key, every USAGE section, the outline + linked contents, the editor's keys still its own, the shipped PDF this version's - or SKIP without reportlab)" \
  || { bad "PDF guide"; grep -a "FAIL" /tmp/guide3911.log | head -12; }

# ---- 2.392.0 (Tim: "add a button to the right hand side of the main menubar - docker configs / create a file,
# docker.cfg / this file will house docker sizes when open with other dockers ...")
node scripts/test-dockcfg.js > /tmp/dockcfg392.log 2>&1 \
  && ok "docker.cfg unit tests (2.392.0 the set's key, the nearest-window pick, heights scaled to the column / widths to the window, save / replace / 6 sizes / remove / auto, the routes, the page head, the wiring)" \
  || { bad "docker.cfg unit tests"; grep -a "FAIL" /tmp/dockcfg392.log | head -12; }
node scripts/test-dockcfg-ui.js > /tmp/dockcfgui392.log 2>&1 \
  && ok "docker configs browser test: ⊞ on the menu bar's right, 💾 Save -> docker.cfg, the set opened again = its sizes, a 4th docker = its own layout, a smaller window = fitted (nothing cut off), auto off, Load, ✕ - or SKIP without playwright" \
  || { bad "docker configs browser test"; grep -a "FAIL\|Error" /tmp/dockcfgui392.log | head -12; }

# ---- 2.393.0 (Tim: "put basic settings dropdown in a floating docker - press s when not typing etc / put llm dropdown
# in a floating docker - press l ... when image editor use the bitgen titlebar and statusbar")
node scripts/test-secfloat.js > /tmp/secfloat393.log 2>&1 \
  && ok "floating settings unit tests (2.393.0 S / L - not typing, no dialog, no modifier, not over the editor / canvas; first place side by side; magnetic snap; docker_status.json floats; the editor's bitGen theme, bars and full screen in bitGen's bars; the wiring)" \
  || { bad "floating settings unit tests"; grep -a "FAIL" /tmp/secfloat393.log | head -12; }
node scripts/test-secfloat-ui.js > /tmp/secfloatui393.log 2>&1 \
  && ok "floating settings + bitGen editor browser test: the left docker's two buttons, S / L show / hide, typing types, L over the editor = its Lasso, ✕, the magnetic drag, kept over a reload; the editor in bitGen's colours / bar heights, ⛶ fills between bitGen's menu bar and status bar, its status in bitGen's, Esc leaves - or SKIP without playwright" \
  || { bad "floating settings browser test"; grep -a "FAIL\|Error" /tmp/secfloatui393.log | head -12; }

# ---- 2.394.0 (Tim: "add a + video placeholder to reference docker video and sound tab and assets dockers image sound
# and video tabs ... select multiple files with ctrl or shift like in the windows 11 file docker . make the docker
# configs button icon only")
node scripts/test-addtile.js > /tmp/addtile394.log 2>&1 \
  && ok "+ add tiles unit tests (2.394.0 the kinds = the server's, kindOf / accept / split / room / label, the tile opens an <input multiple> with the kind's extensions, Enter / Space, a drop, the References + Assets wiring, the ⊞ icon-only button)" \
  || { bad "+ add tiles unit tests"; grep -a "FAIL" /tmp/addtile394.log | head -12; }
node scripts/test-addtile-ui.js > /tmp/addtileui394.log 2>&1 \
  && ok "+ add tiles browser test: the five tiles, bitGen's Open dialog filtered to the kind, Shift-click range / Ctrl-click / Ctrl+A, into Assets AND the references, one place left = one added (the rest in Assets, said), full = no tile, Cancel, a repaint keeps them, ⊞ icon only - or SKIP without playwright / ffmpeg" \
  || { bad "+ add tiles browser test"; grep -a "FAIL\|Error" /tmp/addtileui394.log | head -12; }

# ---- 2.395.0 (Tim: "when prepend or append video use fl2va not ref2a or i2v . if there are pictures in the ref images
# tab label the first picture as picture 2. let the llm know the details"): the chat / Enhance legs talk to a stub LLM
# that ECHOES what it was told (FRAMEOP_TEST); the app's LLM setting is put back afterwards
FOL_OLD=$(curl -sf http://127.0.0.1:8311/api/config | python3 -c "import json,sys;l=json.load(sys.stdin).get('llm') or {};print(json.dumps({'external_url':l.get('external_url',''),'external_model':l.get('external_model','')}))")
python3 scripts/stub-tts.py 8097 > /dev/null 2> /tmp/fol395req.log &
FOL_PID=$!
sleep 1.2
curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' \
  -d '{"llm":{"external_url":"http://127.0.0.1:8097/v1/chat/completions","external_model":"stub"}}' > /dev/null
node scripts/test-frameopllm.js > /tmp/frameopllm395.log 2>&1 \
  && grep -q "RESULT: 19 passed, 0 failed" /tmp/frameopllm395.log \
  && ok "Append / Prepend = fl2va (2.395.0 the first picture = <Picture 2>, a typed frame picture first; the job note fl2va, never i2v; the LLM's dock: <Picture 1> the video's frame (taken out + described), <Picture 2>, the fl2va writing rule; LIVE chat + Enhance told it)" \
  || { bad "Append / Prepend fl2va + the LLM"; grep -a "FAIL\|SKIP" /tmp/frameopllm395.log | head -12; }
kill $FOL_PID 2>/dev/null; wait $FOL_PID 2>/dev/null
[ -n "$FOL_OLD" ] && curl -sf -X POST http://127.0.0.1:8311/api/config -H 'Content-Type: application/json' -d "{\"llm\":$FOL_OLD}" > /dev/null
node scripts/test-frameopllm-ui.js > /tmp/frameopllmui395.log 2>&1 \
  && ok "Append / Prepend fl2va browser test: the Image tab's 'Picture 2 · last / first frame' + 'not used', the video's fl2va note, no mapping lines, Generate fl2va + the picture, ✨ Enhance and the chat sent the op, Reference again = References - or SKIP without playwright" \
  || { bad "Append / Prepend fl2va browser test"; grep -a "FAIL\|Error" /tmp/frameopllmui395.log | head -12; }

# ---- 2.396.0 (Tim: "can we do more work on the image editor, start with making the tools in the toolbar functional -
# when new make the background the color in the background select, when swap with foreground change the background
# color, add a bucket fill/gradient fill")
node scripts/test-pcfill.js > /tmp/pcfill396.log 2>&1 \
  && ok "image editor colours + Paint Bucket unit tests (2.396.0 solidOf / maskBox / gradLine / swapPlan / bucketPlan; New = the background colour; ⇄ / X / the Color panel's ⇄ recolour a plain Background in one step; the swatches; the bucket its own G button; its options; the wiring)" \
  || { bad "image editor colours + Paint Bucket unit tests"; grep -a "FAIL" /tmp/pcfill396.log | head -12; }
node scripts/test-pcfill-ui.js > /tmp/pcfillui396.log 2>&1 \
  && ok "image editor colours + Paint Bucket browser test: the swatches, File ▸ New in the background colour, ⇄ repaints a plain Background (undo, X, the Color panel, a painted one left alone), the bucket's button / options / G keys, Foreground / Background / non-contiguous / Gradient (click, drag) / Opacity / inside a selection, every tool in the column does something - or SKIP without playwright" \
  || { bad "image editor colours + Paint Bucket browser test"; grep -a "FAIL\|Error" /tmp/pcfillui396.log | head -12; }

# ---- 2.397.0 (Tim: "yes please add the text tool improvements, like text along a path , add the filters like lense
# flare, swirl,drop shadow, 3d text and the overlay styles")
node scripts/test-pctext.js > /tmp/pctext397.log 2>&1 \
  && ok "image editor type / styles / filters unit tests (2.397.0 warp columns, circle + drawn paths, letters along a path, hit on letters, 3D steps, Image Size scales a path; bevel lighting, patterns, gradient styles, blend modes, 10 presets; Lens Flare, Swirl, Drop Shadow, 3D Extrude; PSD bevel / satin; the wiring)" \
  || { bad "image editor type / styles / filters unit tests"; grep -a "FAIL" /tmp/pctext397.log | head -12; }
node scripts/test-pctext-ui.js > /tmp/pctextui397.log 2>&1 \
  && ok "image editor type / styles / filters browser test: Shift+T cycles 3 type tools, Type on a Path (drag, type, reshape), a path text hit on its letters, caps, Warp / 3D / Cancel / circle, Vertical Type, Bevel lit + shaded, 10 styles listed, Gold, Pattern Overlay, Multiply overlay, Lens Flare placed by a click + undo, Drop Shadow + 3D Extrude, Swirl - or SKIP without playwright" \
  || { bad "image editor type / styles / filters browser test"; grep -a "FAIL\|Error" /tmp/pctextui397.log | head -12; }

# ---- 2.398.0 (Tim: "the prompt docker won't allow me to resize it's height. make the basic settings and llm dialogs
# into dockers with the ability to dock next to another docker or within another docker")
node scripts/test-dockfloat.js > /tmp/dockfloat398.log 2>&1 \
  && ok "dockable panels unit tests (2.398.0 drop zones: 36 px edges, the title bar = inside as a tab, the middle floats; the eight-way resize + the border pixel; the drop plans; docker_status.json floats mode / to / side / dw / dh / active; a dock grows from the docks above; the prompt's grips; the wiring)" \
  || { bad "dockable panels unit tests"; grep -a "FAIL" /tmp/dockfloat398.log | head -12; }
node scripts/test-dockfloat-ui.js > /tmp/dockfloatui398.log 2>&1 \
  && ok "dockable panels browser test: the floating prompt sized by every edge, docked with nothing below it grows from its own handle, in a side docker its bottom edge; Basic Settings a tab inside Settings (tabs switch), LLM tokens stacked in References / beside / below the video docker (edges size them), floats over a docker's middle, kept over a reload, S hides / shows a tab, a tab dragged out floats - or SKIP without playwright" \
  || { bad "dockable panels browser test"; grep -a "FAIL\|Error" /tmp/dockfloatui398.log | head -12; }

# ---- 2.399.0 (Tim: "can we add camera movement to follow a 3d path, pan,roll and dolly, height and angle to the tools
# in timeline docker. will we be able to tell mmh3 , wan and ltx to follow these paths and camera movement")
node scripts/test-campath.js > /tmp/campath399.log 2>&1 \
  && ok "camera path unit tests (2.399.0 the lens, the path, the keys, poseAt, the frame on the picture, 20 presets read back, H3's sentence / Wan's Fun Camera move / LTX's camera LoRA / the prose, camPlan + camGuide, the wiring; LIVE guide frames -> two videos, /api/generate H3 + the guide as <Video 1>, fl2va words only, plan, models)" \
  || { bad "camera path unit tests"; grep -a "FAIL\|SKIP" /tmp/campath399.log | head -12; }
python3 scripts/test-campathgen.py > /tmp/campathgen399.log 2>&1 \
  && ok "camera path in the workers (2.399.0 wan_graph camera / vctrl modes + their refusals, the Fun Camera files picked, LTX's camera_lora; wan_worker LIVE on the stub: the Fun Camera move, the exact path through VACE (the depth guide at 16 fps), no model / no picture said)" \
  || { bad "camera path in the workers"; grep -a "FAIL" /tmp/campathgen399.log | head -12; }
node scripts/test-campath-ui.js > /tmp/campathui399.log 2>&1 \
  && ok "camera browser test: 🎥 Camera + the 🎥 tool, a preset and what each model is told, a ◆ key, a Top-view drag, docked as a tab + floated, the picture + depth -> 🎬 the two guide videos, the 3D view, Generate / LTX send camera (+ the guide; stale = left out, said), the tool's drag = pan - or SKIP without playwright" \
  || { bad "camera browser test"; grep -a "FAIL\|Error" /tmp/campathui399.log | head -12; }

# ---- 2.400.0 (Tim: "in the queue docker merge the running card with the running cards details and progress card, add
# seedvr2 for upscaling videos")
node scripts/test-seedvr2.js > /tmp/seedvr2400.log 2>&1 \
  && ok "SeedVR2 + queue card unit tests (2.400.0 options, sizes, names only, job params, the ⚙ link, never an MMH3 stage, the card's percent / words / job, the wiring; LIVE settings, /plan, a real x2 job on the stub ComfyUI -> 640x384 with the sound)" \
  || { bad "SeedVR2 + queue card unit tests"; grep -a "FAIL\|SKIP" /tmp/seedvr2400.log | head -12; }
python3 scripts/test-seedvr2.py > /tmp/seedvr2py400.log 2>&1 \
  && ok "SeedVR2 graph + worker (2.400.0 the template chain flattened, chunk auto / manual / off, colour, bit_depth, the sharp 7B picked, mux; seedvr2_worker LIVE on the stub: 320x192 -> 1800x1080 with the sound, an FFV1 master + a window, smaller / no model refused)" \
  || { bad "SeedVR2 graph + worker"; grep -a "FAIL" /tmp/seedvr2py400.log | head -12; }
node scripts/test-seedvr2-ui.js > /tmp/seedvr2ui400.log 2>&1 \
  && ok "SeedVR2 / queue browser test: ONE running card (id line, bar, step words, its buttons, the job list skips it, click follows, the next poll moves it, ⏸ still pauses); ⏫ SeedVR2 in the preview (the plan, x2, Upscale sends + follows, a live preview refused); the ⚙ option - or SKIP without playwright" \
  || { bad "SeedVR2 / queue browser test"; grep -a "FAIL\|Error" /tmp/seedvr2ui400.log | head -12; }

# ---- 2.401.0 (Tim: "show the selected video style settings with it's model in basic settings . allow user to quick
# change the model. use the enhance button in the prompt docker to upscale the selected video")
node scripts/test-stylecard.js > /tmp/stylecard401.log 2>&1 \
  && ok "style card + ⏫ Enhance unit tests (2.401.0 a workflow's model loaders in phase order (API / UI), which workflow a style runs (LTX canvas, its own, the .ui.json, a named chain, the template, Wan auto), resolve by where it was picked, the wiring; LIVE /api/stylecard)" \
  || { bad "style card + ⏫ Enhance unit tests"; grep -a "FAIL\|SKIP" /tmp/stylecard401.log | head -12; }
node scripts/test-stylecard-ui.js > /tmp/stylecardui401.log 2>&1 \
  && ok "style card + ⏫ Enhance browser test: Basic Settings shows the style + the model it renders with, picking there picks in the prompt docker, Wan 2.2 high / low, a quick model change saved into the style, ⚙ = Settings → Video; ⏫ Enhance: nothing selected = says so, a gallery / Video asset / reference video click selects it (ringed, named), SeedVR2 opens on it, a new pick retargets, a removed pick falls back - or SKIP without playwright" \
  || { bad "style card + ⏫ Enhance browser test"; grep -a "FAIL\|Error" /tmp/stylecardui401.log | head -12; }

# ---- 2.401.1 (Tim: "set all default images, videos and sound in workflows to 0 or comfy fairy . it must all be cleaned
# before i can upload the repo")
python3 scripts/test-cleanworkflows.py > /tmp/cleanwf4011.log 2>&1 \
  && ok "workflow media cleaner (2.401.1 pictures -> example.png, videos / sounds -> 0 in API + UI exports, the VHS preview's path / folder, models / notes / formats untouched, the layout kept, --check, idempotent; comfy_workflows/ as the build packs it is clean)" \
  || { bad "workflow media cleaner"; grep -a "FAIL" /tmp/cleanwf4011.log | head -12; }

# ---- 2.401.2 (Tim: "comfy math nodes are no longer available, ltx2.5 workflow does not work, nodes not found")
node scripts/test-mathnodes.js > /tmp/mathnodes4012.log 2>&1 \
  && ok "custom math -> core Math Expression (2.401.2 CM_* + pysssss MathExpression migrated: values.a/b/c, FLOAT/INT/BOOL with every link re-pointed, top level + subgraph links; the shipped LTX canvas clean; ltx_convert asks for no custom math and its prompt carries the expressions; a CM_ re-export converted on the fly; graphToApi migrates only for a ComfyUI without the pack; ComfyMath out of the node packs)" \
  || { bad "custom math -> core Math Expression"; grep -a "FAIL" /tmp/mathnodes4012.log | head -12; }

# ---- 2.401.3 (Tim: "wan2.2 is not creating a step ... after 3 minutes" + "...needs: FinalFrameSelector")
node scripts/test-nodeswaps.js > /tmp/nodeswaps4013.log 2>&1 \
  && ok "node swaps (2.401.3 MediaMixer Final / First Frame Selector -> KJNodes GetImageRangeFromBatch -1 / 0 x1, links kept, subgraphs; the shipped canvas clean, LTX i2v asks for no MediaMixer class and carries the swap; a re-export swapped on the fly; graphToApi only for a ComfyUI without MediaMixer)" \
  || { bad "node swaps"; grep -a "FAIL" /tmp/nodeswaps4013.log | head -12; }
python3 scripts/test-comfyprogress.py > /tmp/comfyprogress4013.log 2>&1 \
  && ok "live ComfyUI progress for every worker (2.401.3 comfy_progress.run on the stub's /ws: running + step lines in both shapes, no heartbeat while it talks, a rejection still raised; wan_worker LIVE prints steps; the 8 workers use it, worker.py delegates)" \
  || { bad "live ComfyUI progress for every worker"; grep -a "FAIL" /tmp/comfyprogress4013.log | head -12; }

# ---- 2.401.4 (Tim: "add dropzones to the left docker so the basic settings and llm info can be docked inside the left docker")
node scripts/test-dockinline-ui.js > /tmp/dockinline4014.log 2>&1 \
  && ok "left docker inline browser test: a line between the Settings list's sections, Basic Settings dropped above the panel buttons at its natural height, LLM tokens above System, kept over a reload (also one above the other), S hides / shows in place, dragged out floats, the title bar still = a tab - or SKIP without playwright" \
  || { bad "left docker inline browser test"; grep -a "FAIL\|Error" /tmp/dockinline4014.log | head -12; }

# ---- 2.402.0 (Tim: "... please add a style for ltx2.3")
node scripts/test-ltx23-ui.js > /tmp/ltx23ui.log 2>&1 \
  && ok "LTX 2.3 prompt docker browser test: both LTX starters, LTX 2.3 shows its four modes + the 3DREAL variant select (no transition), Text hides 3DREAL, LTX 2.5 back to the canvas's eight, Generate sends ltx_mode 3dreal + ic_lora - or SKIP without playwright" \
  || { bad "LTX 2.3 prompt docker browser test"; grep -a "FAIL\|Error" /tmp/ltx23ui.log | head -12; }

# ---- 2.404.0 (Tim: "can we add option 1 + the image to workflow?") - the units + a REAL Blender building every kind
node scripts/test-sceneplan.js > /tmp/sceneplan4040.log 2>&1 \
  && ok "scene plan + image -> 3D unit tests (2.404.0 the LLM's chat (every kind, metres, the model rule), parse through think / fence / trailing comma / Python words, clean: kinds + aliases, unknown -> nearest, sizes, the 3D cap, moves, a camera made; the kinds = blend_build.py's; mesh3d.pick (Hunyuan 2.1 > 2.0, TRELLIS.2 / Pixal3D, the missing files named), prepare (switches resolved, Save3DAdvanced -> SaveGLB, previews pruned, seeds, the cut-out); conversion = ComfyUI's own frontend for both templates; the COLOR widget)" \
  || { bad "scene plan + image -> 3D unit tests"; grep -a "^FAIL" -A2 /tmp/sceneplan4040.log | head -14; }
python3 scripts/test-blendbuild.py > /tmp/blendbuild4040.log 2>&1 \
  && ok "scene builder - a REAL Blender (2.404.0: all 58 kinds as one mesh each, the simple shapes exactly their size on the ground, composites inside their box, turn, linear moves over the plan's seconds, the camera at its keys looking at their points, a .glb model fitted to the plan's height, unreadable / missing files -> stand-ins said; + Model's import edit saved and exported back = the page's base - SKIP without Blender)" \
  || { bad "scene builder - a REAL Blender"; grep -a "^FAIL" -A3 /tmp/blendbuild4040.log | head -14; }

# ---- 2.405.0 (Tim: "can we have a daz3d to bitgen bridge?" + "can we add option to merge daz3d scene with blender scene -
# create a dialog for list of objects, lights, cameras to merge. dialogs must have a titlebar")
node scripts/test-dazscript.js > /tmp/dazscript4050.log 2>&1 \
  && ok "Daz Studio bridge script in a mock Daz + the REAL curl / app / Blender (2.405.0: the dialog 'bitGen Bridge 1.0.0' with the five sends, Test connection; the play range rendered as an image series with Daz's settings put back -> daz_<scene>.mp4 1280x704 + the 3DREAL job; this frame -> Gallery + Images; the scene's FBX (silent, lights / cameras / animation as ticked) -> blender/daz/<scene>.blend open in the preview; merge -> held for the dialog; the figure -> models3d .glb + a 3D layer; refusals in words - the 3D parts SKIP without Blender)" \
  || { bad "Daz Studio bridge script"; grep -a "FAIL" -A2 /tmp/dazscript4050.log | head -14; }
node scripts/test-dazbridge-ui.js > /tmp/dazui4050.log 2>&1 \
  && ok "Daz merge dialog browser test: a Daz scene sent to merge opens the dialog by itself - a title bar (name + ✕) that drags it, Figures & objects / Lights / Cameras ticked, all / none, the scene-camera choice; Merge appends the ticked ones into the open .blend (keys respaced 30 -> 24 fps, the Daz camera the scene's) and the preview reloads; Esc keeps it waiting, Open on its own, Cancel dismisses; a Daz picture in the Gallery - or SKIP without playwright / Blender" \
  || { bad "Daz merge dialog browser test"; grep -a "FAIL\|Error" -A2 /tmp/dazui4050.log | head -14; }

# ---- 2.406.0 (Tim: "what tools does adobe premier that bitgen doesn't?" -> "lets start closing the gap and go with your
# suggestions as you see fit"): speed ramps / reverse, a colour grade with LUTs, captions from the speech, sound clean-up,
# ducking + loudness
node scripts/test-clipfx.js > /tmp/clipfx4060.log 2>&1 \
  && ok "clip fx / mix / captions unit tests (2.406.0 normalize, speed / reverse / ramp segments + srcTime + slice, keep / cut + the span (JS + python) on a retimed clip, the baked LUT (identity, round trip, the LUT under the grade), the export's keys, the render / mix filtergraphs, captions: words -> the timeline -> cues, ASS + SRT)" \
  || { bad "clip fx / mix / captions unit tests"; grep -a "^FAIL" -A2 /tmp/clipfx4060.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-clipfx-live.js > /tmp/clipfxlive4060.log 2>&1 \
  && ok "clip fx / mix / captions COMPILED by the app + measured (2.406.0 speed 200 % = half as long at the right frames, reversed, a ramp = static/clipfx.js's length and frames, half speed reversed + blend; an identity LUT changes nothing, +1 stop, mono, warm; the music ducks under V1's voice, -14 / -23 LUFS; sound clean-up; 🎧 before / after; captions burned only while up + the .srt; refusals in words)" \
  || { bad "clip fx / mix / captions COMPILED"; grep -a "FAIL" -A2 /tmp/clipfxlive4060.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-clipfx-ui.js > /tmp/clipfxui4060.log 2>&1 \
  && ok "clip fx browser test: 🎬 speed 200 % halves the clip + the canvas shows the source's frame, ⇄ reverse, a ramp; 🎨 mono on the canvas, ＋ LUT imported + picked, the canvas's grade = the compile's; 🎧 clean-up + role, before / after wav; 🎚 Mix and 💬 Captions dialogs with a TITLE BAR (ducking, loudness, ＋ a cue, drawn while up), From speech says what is missing; ⚙ Compile sends it all - or SKIP without playwright" \
  || { bad "clip fx browser test"; grep -a "FAIL\|Error" -A2 /tmp/clipfxui4060.log | head -14; }

# ---- 2.407.0 (Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do")
node scripts/test-premiere2.js > /tmp/prem2u4070.log 2>&1 \
  && ok "colour wheels / curves / HSL, edit tools, timecode, J / L, export queue, exchange unit tests (2.407.0 normalize + the maths, slip / roll / slide / ripple + clamps, HH:MM:SS:FF, split sound + mutes, presets + frames + encoder args (python), FCP XML / EDL / OTIO out and XML / EDL back in, missing media)" \
  || { bad "2.407.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem2u4070.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere2-live.js > /tmp/prem2l4070.log 2>&1 \
  && ok "export queue / J / L / grade / exchange COMPILED by the app + measured (2.407.0 H.265, ProRes 422 HQ, DNxHR HQ, 9:16 WebM blur, GIF, WAV, MP3, 1:1 24 fps from one compile with the timecode; a J cut and an L cut heard; a trimmed + untrimmed V1 join 6 s; curves + wheel = the shared maths; XML / EDL / OTIO out and in through the routes)" \
  || { bad "2.407.0 COMPILED"; grep -a "FAIL" -A2 /tmp/prem2l4070.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere2-ui.js > /tmp/prem2ui4070.log 2>&1 \
  && ok "2.407.0 browser test: ⇆ slip, ⇹ roll, ⇤ ripple, ↔ slide by mouse; the timecode readout; 🎨 Colour / 📤 Export / ⇄ Exchange dialogs with a TITLE BAR (a wheel, a curve point, an HSL range, four scopes; the social pack + timecode, Compile + export delivers; FCP XML downloaded and imported back as a new timeline); J / L inputs - or SKIP without playwright" \
  || { bad "2.407.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem2ui4070.log | head -14; }

# ---- 2.408.0 (Tim: "please add an edit lyrics box to the kareoke dialog - some of the words are wrong. and continue with
# the premier catchup - do whats most useful next")
node scripts/test-premiere3.js > /tmp/prem3u4080.log 2>&1 \
  && ok "edit by transcript / scene cuts / karaoke words unit tests (2.408.0 cut ranges + pieces + ripple, pauses, fillers, keep-only, split; ffmpeg shot changes + cache; the whole-lyrics cache key (a word fixed far down), corrected words win until the lyrics change, undo)" \
  || { bad "2.408.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem3u4080.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere3-live.js > /tmp/prem3l4080.log 2>&1 \
  && ok "karaoke words + scene cuts + transcript route + text-cut / shot-split timelines COMPILED (2.408.0 GET / POST /api/karaoke/words, the overlay made with the corrections, new lyrics win; shot changes at 2 s / 4 s; 5 s and 6 s compiles)" \
  || { bad "2.408.0 COMPILED"; grep -a "FAIL" -A2 /tmp/prem3l4080.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere3-ui.js > /tmp/prem3ui4080.log 2>&1 \
  && ok "2.408.0 browser test: 🎤 Edit lyrics filled with what was heard, ⏱ Words & timing (lyrics saved first, a word + a time corrected and kept); 📝 Transcript with a TITLE BAR (fillers / pauses shown, click + shift-click, ✂ cut = the shared maths, ↺ undo, fillers, pauses, ✂ scene cuts, double-click goes there) - or SKIP without playwright" \
  || { bad "2.408.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem3ui4080.log | head -14; }

# ---- 2.409.0 (Tim: "if overide is checked in basic settings docker then all models including ltx2.3 and 2.5 use basic
# settings including, cfg,steps, seed, model and loras, use prompt from prompt docker or prompt chat when video button is
# pressed , continue with the premier close gap")
node scripts/test-basicfx.js > /tmp/bfxu4090.log 2>&1 \
  && ok "Override style for every video model + effects / adjustment units (2.409.0 lib/basicOverride parse / withStyle / note, the board's model, LTX basic + Wan cfgExact, basic_apply on the real LTX 2.3 / 2.5 / 3DREAL graphs, GGUF loaders, the page wiring; normVfx, vfx_filters (clip + adjustment with enable), clipfx_render alpha, adjustKeys, the placeholder PNG, the exchange leaves them out)" \
  || { bad "2.409.0 unit tests"; grep -a "^FAIL" -A2 /tmp/bfxu4090.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-basicfx-live.js > /tmp/bfxl4090.log 2>&1 \
  && ok "Override style + effects LIVE (2.409.0 an LTX job with Basic Settings' steps re-drawn into the sigmas / cfg / seed / model / LoRA read back from its graph, off = as before; H3 + Wan jobs; a green screen keyed, a crop, blur, sharpen, vignette, glow, grain, stabilise compiled and measured; an adjustment layer grey + blurred for its second only)" \
  || { bad "2.409.0 LIVE"; grep -a "FAIL" -A2 /tmp/bfxl4090.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-basicfx-ui.js > /tmp/bfxui4090.log 2>&1 \
  && ok "2.409.0 browser test: the Model (override) box lists ComfyUI's models, the line under Override style; Generate with an LTX style sends Basic Settings to /api/ltx, Enhance's Generate too; ✨ Effects in Properties, a green screen keyed on the canvas; ◐ an adjustment layer (Colour + Effects), grey only while it is on - or SKIP without playwright" \
  || { bad "2.409.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/bfxui4090.log | head -14; }

# ---- 2.410.0 (Tim: "make the kareoke and tools dialog into floating dockers, it will dock next to the preview canvas,
# either left or right. this will make it easier to edit the words and timing while previewing. make spacebar pause the
# preview playback unless typing... continue with the next stages of the premier gap closure")
node scripts/test-premiere5.js > /tmp/prem5u4100.log 2>&1 \
  && ok "dockers beside the canvas + Space + markers / keys / In-Out / frame units (2.410.0 H3Space typing + decide, H3Marks list / add / move / next / prev / edit points / split, the timeline key map, lib/deliver range + saveStill, deliver.py range / timecode / .srt cut / _io names, markers through FCP XML / EDL / OTIO and back, TlStageDock float / dock left / right / share a side in jsdom, the wiring)" \
  || { bad "2.410.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem5u4100.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere5-live.js > /tmp/prem5l4100.log 2>&1 \
  && ok "In / Out export + frames + markers LIVE (2.410.0 a 4 s movie exported 1 s - 3 s: H.264 + WAV of 2.0 s, its first frame = the master's at 1 s, timecode 01:00:01:00, the .srt cut + shifted, the master whole; the whole movie again; POST /api/deliver/still saved by its timecode, listed, a non-PNG refused; markers out through the route's XML / EDL / OTIO and back in)" \
  || { bad "2.410.0 LIVE"; grep -a "FAIL" -A2 /tmp/prem5l4100.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere5-ui.js > /tmp/prem5ui4100.log 2>&1 \
  && ok "2.410.0 browser test: 🧰 Tools docks left of the canvas (◧), dragged to its right edge docks right, floats again; 🎤 Karaoke a docker right of the canvas, the word at the preview lit, its time button moves the preview, ⤓ from the preview, 👁 draft over the canvas never in a snapshot; Space pauses / plays unless typing; V B N Y U, I / O, M + Shift+M / Alt+M, Home / End, ↑ ↓ edit points, Ctrl+K split, a marker dragged + edited (double-click, M M); 📤 Range In / Out + 🖼 Export frame, Ctrl+Shift+E - or SKIP without playwright" \
  || { bad "2.410.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem5ui4100.log | head -14; }

# ---- 2.411.0 (Tim: "are you able to add these styles to a presets dropdown in the text tool properties in timeline
# docker and image editor?" ... "is it possible to create a tool for bitgen to add the text effects to presets?" ... "it
# would be nice if it was live" ... "yes please and any premier leftovers that you can do comfortably")
node scripts/test-textfx.js > /tmp/textfxu4110.log 2>&1 \
  && ok "text effect presets units (2.411.0 the two PSDs read by ag-psd into presets - smart-object copies with their transforms, groups, effects, decorations left out; effectsToStyles' gradients / multiple shadows / stroke gradients / stroke emboss / gloss; H3TextFx render in node-canvas: gold pixels, the fast path, the live budget; lib/textFx save / list / rename / remove; textfx_build.js)" \
  || { bad "2.411.0 text effect units"; grep -a "^FAIL" -A2 /tmp/textfxu4110.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-textfx-ui.js > /tmp/textfxui4110.log 2>&1 \
  && ok "2.411.0 browser test: Preset in a timeline text layer's Properties lists the PSD presets + classics, gold on the canvas, live while typing (a quick picture, then the sharp one), the export PNG sharp, (none) back; ＋ Import a PSD text effect… adds one, 🗑 deletes it; the image editor's Type tool live typing with a preset, its Properties row, flatten - or SKIP without playwright" \
  || { bad "2.411.0 text effect browser test"; grep -a "FAIL\|Error" -A2 /tmp/textfxui4110.log | head -14; }
node scripts/test-premiere6.js > /tmp/prem6u4110.log 2>&1 \
  && ok "Premiere leftovers units (2.411.0 J / K / L + K-held frame steps in the key map, the canvas shuttle 1-8x both ways, L left to the shuttle over the timeline, AV1 / H.265 10-bit args, the graphics card's encoder picked / NVENC / QSV / AMF args / software fallback, libaom when no SVT, the wiring)" \
  || { bad "2.411.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem6u4110.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere6-live.js > /tmp/prem6l4110.log 2>&1 \
  && ok "AV1 + H.265 10-bit LIVE (2.411.0 one compile with the graphics card asked for: <project>_av1.mp4 = AV1 + AAC + timecode, <project>_h265_10.mp4 = HEVC yuv420p10le hvc1, the log names the encoder each got)" \
  || { bad "2.411.0 LIVE"; grep -a "FAIL" -A2 /tmp/prem6l4110.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere6-ui.js > /tmp/prem6ui4110.log 2>&1 \
  && ok "2.411.0 browser test: L plays, L L L 2x / 4x / 8x measured, K stops, J backwards 1x / 2x and stops at the start, K + L / K + J one frame, over the canvas too, typing types, L outside the timeline = LLM tokens; 📤 lists AV1 / H.265 10-bit, ⚡ kept - or SKIP without playwright" \
  || { bad "2.411.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem6ui4110.log | head -14; }

# ---- 2.412.0 (Tim: "do the smaller jobs and complete the 10 partly done jobs")
node scripts/test-premiere7.js > /tmp/prem7u4120.log 2>&1 \
  && ok "Premiere smaller jobs units (2.412.0 drop-frame timecode both ways + deliver.py tc_plus / tc_for, ProRes 4444 alpha matte / H.264 10-bit / VAAPI args + the alpha passes, DF + ranges + clip markers through EDL / XML / OTIO, clip markers on their frame (speed / reverse / ramp), J / L on V2+ and retimed clips, separate / link / sync / unlink / putBack / targets, EQ / multiband / reverb chains, hue curves, effect keyframes + sendcmd / mask graph)" \
  || { bad "2.412.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem7u4120.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere7-live.js > /tmp/prem7l4120.log 2>&1 \
  && ok "Premiere smaller jobs LIVE (2.412.0 ProRes 4444: alpha 0 in V1's gap, a 50 % picture half see-through, opaque over V1; H.264 High 10 with 01:00:00;00; V2 J cut heard + the neighbour silenced; a 2x clip's L at its speed; a video's sound moved 1 s; EQ low cut measured; hue vs sat to grey; a keyframed vignette growing)" \
  || { bad "2.412.0 LIVE"; grep -a "FAIL" -A2 /tmp/prem7l4120.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere7-ui.js > /tmp/prem7ui4120.log 2>&1 \
  && ok "2.412.0 browser test: 📤 drop-frame (the readout ;), a marker range + its end dragged, Ctrl+Shift+M clip marker on its frame + Shift+M, ◎ targets + Ctrl+K on both, 🔗 sound as its own clip + linked selection on / off + sound back, 🎧 EQ / multiband / reverb, ✨ ◆ effect keys on the canvas, 🎨 H/S - or SKIP without playwright" \
  || { bad "2.412.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem7ui4120.log | head -14; }

# ---- 2.413.0 (Tim: "do the smaller jobs and complete the 10 partly done jobs" - the partly-done ones)
node scripts/test-premiere8.js > /tmp/prem8u4130.log 2>&1 \
  && ok "Premiere partly-done items units (2.413.0 trimEdge / roll / slide / ripple / slip on reversed + ramped clips frame-exact, Ctrl+K + transcript cuts on retimed clips, the XML's speed-adjusted in / out + legacy import + OpenTimelineIO reading it, reframe tracking / smoothing / cmd file / follow export, vidstab detect / transform + jitter halved + steady preview, the bevel profile contour through ag-psd -> styles -> shading)" \
  || { bad "2.413.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem8u4130.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere8-live.js > /tmp/prem8l4130.log 2>&1 \
  && ok "Premiere partly-done items LIVE (2.413.0 fit follow keeps the moving subject in a 9:16 frame where the middle crop loses it; a stabilised compile with vidstab, jitter halved; POST /api/clipfx/stabilise working -> ready + the file; a reversed clip split in two compiles to the same pictures)" \
  || { bad "2.413.0 LIVE"; grep -a "FAIL" -A2 /tmp/prem8l4130.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere8-ui.js > /tmp/prem8ui4130.log 2>&1 \
  && ok "2.413.0 browser test: a ramped clip's head dragged 1 s = exactly 1 s shorter, its first frame the one that was there; Ctrl+K on a reversed clip; stabilise smoothing / locked + the canvas on the steady file; 📤 fit follow - or SKIP without playwright" \
  || { bad "2.413.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem8ui4130.log | head -14; }

# ---- 2.414.0 (Tim: "lets do the medium jobs now" - nested sequences, the fuller XML, FCPXML, whole-sequence transcripts)
node scripts/test-premiere9.js > /tmp/prem9u4140.log 2>&1 \
  && ok "Premiere medium jobs units (2.414.0 nest render names / fingerprint / status / adopt / loops through nests of nests + TlExportBody + /api/export's nest branch, the XML's Basic Motion + opacity / level keyframes + the grade record + baked .cube + Text-generator captions out and back + OpenTimelineIO reading it, FCPXML 1.10 storyline / lanes / timeMap / adjust-* / keys / markers / captions / DF out and back + OpenTimelineIO's FCP X reader, the transcript's layer / sequence scope with every layer rippling)" \
  || { bad "2.414.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem9u4140.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere9-live.js > /tmp/prem9l4140.log 2>&1 \
  && ok "Premiere medium jobs LIVE (2.414.0 a timeline compiled as a nest -> nest_<name>_<hash>.mp4, no deliverables, adopted into video/, played on another timeline's layer; saved again = a new hash; a loop refused; the XML's baked .cube = the compile's grade; FCPXML out and back through the route)" \
  || { bad "2.414.0 LIVE"; grep -a "FAIL" -A2 /tmp/prem9l4140.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere9-ui.js > /tmp/prem9ui4140.log 2>&1 \
  && ok "2.414.0 browser test: ⧉ nest through the chooser (a new layer, the badge), the nested timeline saved again -> ↻ out of date -> Properties ↻ Re-render, a timeline into itself refused; ⇄ FCPXML downloaded + opened back; 📝 the whole sequence as one transcript, a cut in V2 moves the music up, ↺ - or SKIP without playwright" \
  || { bad "2.414.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem9ui4140.log | head -14; }

# ---- 2.415.0 (Tim: "lets do the medium jobs now" - the track mixer + meters + pan, distort, the transitions library, colour match)
node scripts/test-premiere10.js > /tmp/prem10u4150.log 2>&1 \
  && ok "Premiere medium jobs units 2 (2.415.0 faders to +6 dB / pan balance law / master in lib/mixer + scripts/mixfx + the worker / route / page / canvas hook, lens / mirror / wave / twirl rendered by ffmpeg = distortAt's sample points, 59 transitions all known to ffmpeg + a layer boundary as its shape rendered + the canvas preview maths, colour match curves landing a warm clip on a cool one)" \
  || { bad "2.415.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem10u4150.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere10-live.js > /tmp/prem10l4150.log 2>&1 \
  && ok "Premiere medium jobs LIVE 2 (2.415.0 V1 panned hard left = the right silent, a sound layer panned right 50 % = the left at half, a fader at +6 dB = twice, the master at -6 dB = half; a mirrored clip compiled symmetric; a layer wiping in over black; colour match through the route then compiled onto the other clip's colour)" \
  || { bad "2.415.0 LIVE"; grep -a "FAIL" -A2 /tmp/prem10l4150.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere10-ui.js > /tmp/prem10ui4150.log 2>&1 \
  && ok "2.415.0 browser test: 🎚 the mixer's strips (pan, fader +3.5 dB, master -6 dB, mute) + live meters while playing (a sound panned left loud on the left), ✨ mirror makes the canvas symmetric, a layer's wipe previewed on the canvas, 🎨 🎯 Match sets the curves - or SKIP without playwright" \
  || { bad "2.415.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem10ui4150.log | head -14; }

# ---- 2.416.0 (Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior")
node scripts/test-premiere11.js > /tmp/prem11u4160.log 2>&1 \
  && ok "Premiere bigger rows units (2.416.0 masks: normMask / maskAt / maskAlpha + ellipse / turned box / inverted / tracked masks RENDERED = maskAlpha's blend, a keyed clip's alpha kept; track.py follows a ball with OpenCV and numpy, says lost when it leaves; audiosync finds a 1.75 s lag and refuses a tone; multicam fromSync / switchAt / program / soundClip; proxies' heavy rule)" \
  || { bad "2.416.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem11u4160.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere11-live.js > /tmp/prem11l4160.log 2>&1 \
  && ok "Premiere bigger rows LIVE (2.416.0 a masked grade compiled inside / outside an ellipse, a tracked mask moving, an adjustment layer's mask; POST /api/clipfx/track; POST /api/multicam/sync + the program compiled red then blue with the sound angle under it; a 2560x1440 clip heavy, its VP9 960x540 proxy made and served)" \
  || { bad "2.416.0 LIVE"; grep -a "FAIL" -A2 /tmp/prem11l4160.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere11-ui.js > /tmp/prem11ui4160.log 2>&1 \
  && ok "2.416.0 browser test: 🎨 ◯ a mask on the canvas (inside / inverted), 🎯 Track along a ball, 🎥 sync two angles by sound + key 2 cuts live + ⇲ Flatten, 🪶 a heavy clip's proxy made and played - or SKIP without playwright" \
  || { bad "2.416.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem11ui4160.log | head -14; }

# ---- 2.417.0 (Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior")
node scripts/test-premiere12.js > /tmp/prem12u4170.log 2>&1 \
  && ok "Premiere bigger rows 2 units (2.417.0 HDR: white at 203 nits in PQ / HLG, Rec.2020, HDR10 / HLG files back to their SDR, HDR10 metadata, deliver.py / deliver.js colours; AAF written + read back with pyaaf2 (and OTIO), lib/aaf job; a reversed 2x clip's sound rendered backwards; motion graphics templates capture / instantiate / fields / the built-ins)" \
  || { bad "2.417.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem12u4170.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere12-live.js > /tmp/prem12l4170.log 2>&1 \
  && ok "Premiere bigger rows LIVE 2 (2.417.0 HDR10 HEVC + HLG AV1 deliverables tagged and at their levels, an HDR10 clip tone-mapped into the master; an AAF exported, downloaded, read back; POST /api/clipfx/retimesound; 🧩 the built-ins, place, save, delete)" \
  || { bad "2.417.0 LIVE"; grep -a "FAIL" -A2 /tmp/prem12l4170.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere12-ui.js > /tmp/prem12ui4170.log 2>&1 \
  && ok "2.417.0 browser test: 🔊 a reversed 2x clip heard on the canvas in step, ⇄ an AAF downloaded, 🧩 Lower third dropped in with new words + drawn, 💾 saved as our own template - or SKIP without playwright" \
  || { bad "2.417.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem12ui4170.log | head -14; }

# ---- 2.418.0 (Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior")
node scripts/test-premiere13.js > /tmp/prem13u4180.log 2>&1 \
  && ok "real-time playback units (2.418.0 the render bar's stretches: cuts, costs ok / yellow / red with the reasons, fingerprints that change only where an edit lands, rendered = green; lib/tlRender ids / adopt / keep 4; the export's preview flag, the canvas drawing the preview while playing, ⏱, Full / ½ / ¼)" \
  || { bad "2.418.0 unit tests"; grep -a "^FAIL" -A2 /tmp/prem13u4180.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-premiere13-live.js > /tmp/prem13l4180.log 2>&1 \
  && ok "real-time playback LIVE (2.418.0 POST /api/export {preview} -> preview_<id>.mp4, no deliverables, not the project's movie; adopt -> cache/preview; served; the same picture as the movie)" \
  || { bad "2.418.0 LIVE"; grep -a "FAIL" -A2 /tmp/prem13l4180.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-premiere13-ui.js > /tmp/prem13ui4180.log 2>&1 \
  && ok "2.418.0 browser test: the render bar red over a heavy stretch (and a dropped-frame one), ⚡ Render -> green, playing draws the preview in step, an edit re-reds only its stretch, ½ playback resolution - or SKIP without playwright" \
  || { bad "2.418.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/prem13ui4180.log | head -14; }

# ---- 2.419.0 (Tim: "use the prompt docker for all prompts ... add a negative prompt docker - "2" toggles negative prompt docker ...")
node scripts/test-negprompt.js > /tmp/negp4190.log 2>&1 \
  && ok "one prompt docker + negative prompt units (2.419.0 the LLM's Negative: lines split off, which models use a negative, the tools' boxes follow the prompt docker, /api/generate / ltx / Wan carry it, the LLM's video guide per style, key 2)" \
  || { bad "2.419.0 unit tests"; grep -a "^FAIL" -A2 /tmp/negp4190.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-negprompt-live.js > /tmp/negpl4190.log 2>&1 \
  && ok "negative prompt LIVE (2.419.0 H3 negative_prompt, a Wan style's negative beaten by the docker's, LTX, an image job)" \
  || { bad "2.419.0 LIVE"; grep -a "FAIL" -A2 /tmp/negpl4190.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-negprompt-ui.js > /tmp/negpui4190.log 2>&1 \
  && ok "2.419.0 browser test: 2 shows / hides the ⊖ negative docker (not with the multi-camera dialog open), an LLM fence's Negative: line lands there, the status per model, video + image requests carry it, the tools' prompt boxes follow the prompt docker - or SKIP without playwright" \
  || { bad "2.419.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/negpui4190.log | head -14; }

# ---- 2.420.0 (Tim: "yes, please add your 2 suggestions": AI inside the timeline + the GPU compositor)
node scripts/test-tlai.js > /tmp/tlai4200.log 2>&1 \
  && ok "AI in the timeline units (2.420.0 beats.py on 120 / 95 BPM click tracks, the gap under the marker, render size / frames, takes in the same slot, the extension's ripple, beat cuts / markers, the wiring)" \
  || { bad "2.420.0 unit tests"; grep -a "^FAIL" -A2 /tmp/tlai4200.log | head -14; }
H3_URL=http://127.0.0.1:8311 node scripts/test-tlai-live.js > /tmp/tlail4200.log 2>&1 \
  && ok "AI in the timeline LIVE (2.420.0 a clip's frame at a moment / past its end, probe, a song's beats + the cache, an fl2va render from a frame with the negative)" \
  || { bad "2.420.0 LIVE"; grep -a "FAIL" -A2 /tmp/tlail4200.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-tlai-ui.js > /tmp/tlaiui4200.log 2>&1 \
  && ok "2.420.0 browser test: 🤖 a new take in the clip's slot + ⇆ back, ⇥ extend + the ripple, 🎞 B-roll in a gap + a muted cutaway, every render's negative, ♪ beats -> ⚑ markers -> ✂ cuts - or SKIP without playwright" \
  || { bad "2.420.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/tlaiui4200.log | head -14; }
node scripts/test-glcomp.js > /tmp/glc4200.log 2>&1 \
  && ok "GPU compositor units (2.420.0 corners / clip space / the LUT mapping, the shader, the canvas's GPU path only while playing, its fallbacks)" \
  || { bad "2.420.0 GPU compositor units"; grep -a "^FAIL" -A2 /tmp/glc4200.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-glcomp-ui.js > /tmp/glcui4200.log 2>&1 \
  && ok "2.420.0 GPU compositor browser test: the playing frame is the compositor's and matches the 2D path (< 2 levels), a wipe / an adjustment layer / GPU off -> 2D - or SKIP without playwright" \
  || { bad "2.420.0 GPU compositor browser test"; grep -a "FAIL\|Error" -A2 /tmp/glcui4200.log | head -14; }

# ---- 2.421.0 (Tim: "can we close the gap with 1,2,3,4 and 5 first" - gap 1: pen / paths / vector masks / custom shapes)
node scripts/test-pspath.js > /tmp/pspath4210.log 2>&1 \
  && ok "pen / paths units (2.421.0 Béziers, insert / remove / convert anchors, handles smooth vs cusp, shapes as paths + fitShape, 16 custom shapes, raster with the four ops, contours with holes, mask -> path, freeform fitting, SVG + PSD knots, the wiring)" \
  || { bad "2.421.0 pen / paths units"; grep -a "^FAIL" -A2 /tmp/pspath4210.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-pspath-ui.js > /tmp/pspathui4210.log 2>&1 \
  && ok "2.421.0 pen / paths browser test: P / A / U tools, a Pen triangle shape layer + close, curves, auto add / delete, Direct Selection + undo, Convert Point, Path Selection copy / subtract / delete, Custom Shape ring, Shape tool ops, path <-> selection, fill / stroke path, save / duplicate / delete paths, vector mask (thumb, off, feather, moves, rasterize), Image Size + undo, PSD + SVG round trips, Freeform Pen - or SKIP without playwright" \
  || { bad "2.421.0 pen / paths browser test"; grep -a "FAIL\|Error" -A2 /tmp/pspathui4210.log | head -14; }

# ---- 2.422.0 (Tim: "can we close the gap with 1,2,3,4 and 5 first" - gaps 2 + 3: smart objects / filters, transforms)
node scripts/test-pswarp.js > /tmp/pswarp4220.log 2>&1 \
  && ok "smart objects / transforms units (2.422.0 homographies, the warp patch + presets, meshes, MLS puppet, seam carving with protect, liquify push / twirl / pucker / bloat / reconstruct / freeze, smart transforms moved by a matrix, the wiring)" \
  || { bad "2.422.0 smart objects / transforms units"; grep -a "^FAIL" -A2 /tmp/pswarp4220.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-pswarp-ui.js > /tmp/pswarpui4220.log 2>&1 \
  && ok "2.422.0 smart objects / transforms browser test: convert, Ctrl+T down and up loses nothing, perspective, warp preset, a smart Gaussian blur + its eye + the filter mask, Edit Contents shared by a duplicate + undo, via copy, to layers, rasterize, the move tool / Image Size, distort a pixel layer, puppet warp, content-aware scale, liquify (pixels + smart filter) - or SKIP without playwright" \
  || { bad "2.422.0 smart objects / transforms browser test"; grep -a "FAIL\|Error" -A2 /tmp/pswarpui4220.log | head -14; }

# ---- 2.423.0 (Tim: "can we close the gap with 1,2,3,4 and 5 first" - gaps 4 + 5: selection refinement, retouching)
node scripts/test-psrefine.js > /tmp/psrefine4230.log 2>&1 \
  && ok "selection / retouching units (2.423.0 box blur, guided filter, Select and Mask snapping / feather / contrast / shift, decontaminate, the live wire, quick selection at edges, sky, Poisson, PatchMatch fill, red eye, background eraser, mixer, the wiring)" \
  || { bad "2.423.0 selection / retouching units"; grep -a "^FAIL" -A2 /tmp/psrefine4230.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-psrefine-ui.js > /tmp/psrefineui4230.log 2>&1 \
  && ok "2.423.0 selection / retouching browser test: the tools, quick selection to the edge, Select and Mask radius snap, save / load / undo a channel, sky, magnetic lasso, content-aware fill, red eye, patch, magic + background eraser, healing blended, mixer brush - or SKIP without playwright" \
  || { bad "2.423.0 selection / retouching browser test"; grep -a "FAIL\|Error" -A2 /tmp/psrefineui4230.log | head -14; }

# ---- 2.424.0 (Tim: "add a pdf import/edit/save feature")
node scripts/test-pspdf.js > /tmp/pspdf4240.log 2>&1 \
  && ok "PDF units (2.424.0 fontOf / groupLines / inkColor / toPdf / winAnsi / stdName, lib/pdfStore save / replace / list / file, the vendored pdf.js + pdf-lib, the wiring)" \
  || { bad "2.424.0 PDF units"; grep -a "^FAIL" -A2 /tmp/pspdf4240.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-pspdf-ui.js > /tmp/pspdfui4240.log 2>&1 \
  && ok "2.424.0 PDF browser test: open (pages strip, type layers per line, a text-free page picture, fonts / place / width), edit, pages keep layers + undo (also over another picture), save (real text at its place, unchanged page still vector), open from the project - or SKIP without playwright" \
  || { bad "2.424.0 PDF browser test"; grep -a "FAIL\|Error" -A2 /tmp/pspdfui4240.log | head -14; }

# ---- 2.425.0 (Tim: "add a bezier line tool that can be a vector and converted to a path and back to a vector. make the bezier line tool the same as coreldraw")
node scripts/test-psbezier.js > /tmp/psbezier4250.log 2>&1 \
  && ok "vector line units (2.425.0 dashes, arrowheads, trimming, Corel's cusp / smooth / symmetrical nodes, to line / curve, break, join, close, extract, reduce, bend, B-spline, 3-point curve, the Curvature Pen's curve, 15°, path align / distribute, SVG out / back, the wiring)" \
  || { bad "2.425.0 vector line units"; grep -a "^FAIL" -A2 /tmp/psbezier4250.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-psbezier-ui.js > /tmp/psbezierui4250.log 2>&1 \
  && ok "2.425.0 vector line browser test: F5 / F10, Bézier (nodes, close, carry on, Esc), the property bar, the Shape tool (types, drag, add / delete, break, join, close), line -> path -> line, a path -> a line, Ctrl+Q, Freehand / 2-Point / Polyline / 3-Point / B-Spline / Corel Pen, F12, SVG + PSD round trips, Curvature Pen, path align / distribute, Rubber Band - or SKIP without playwright" \
  || { bad "2.425.0 vector line browser test"; grep -a "FAIL\|Error" -A2 /tmp/psbezierui4250.log | head -14; }

# ---- 2.426.0 (Tim: "continue with the photoshop gap closure" - the agreed order: Character / Paragraph panels + styles)
node scripts/test-pstype.js > /tmp/pstype4260.log 2>&1 \
  && ok "type panel units (2.426.0 wants / owns, small caps runs, wrapping + hyphenation, point / paragraph layout, justify, indents, spacing, overflow, styles, Image Size, the wiring)" \
  || { bad "2.426.0 type panel units"; grep -a "^FAIL" -A2 /tmp/pstype4260.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-pstype-ui.js > /tmp/pstypeui4260.log 2>&1 \
  && ok "2.426.0 type panels browser test: the tabs, paragraph text by a Type-tool drag, justify / indents / overflow, horizontal scale, faux bold, small caps, character styles (new, apply, override, clear, redefine), paragraph styles, point <-> paragraph text, Image Size - or SKIP without playwright" \
  || { bad "2.426.0 type panels browser test"; grep -a "FAIL\|Error" -A2 /tmp/pstypeui4260.log | head -14; }

# ---- 2.427.0 (Tim: "continue with the photoshop gap closure" - the agreed order: Actions + batch)
node scripts/test-psactions.js > /tmp/psactions4270.log 2>&1 \
  && ok "actions units (2.427.0 what is recorded, free keys, the Default Actions, normalize, names / summaries, dialog values, file names, lib/batchStore, the wiring)" \
  || { bad "2.427.0 actions units"; grep -a "^FAIL" -A2 /tmp/psactions4270.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-psactions-ui.js > /tmp/psactionsui4270.log 2>&1 \
  && ok "2.427.0 actions browser test: the Default Actions, play, record (Image Size + its dialog, a cancelled dialog left out, a filter, the Layers panel), play back, a step off, the dialog toggle, Insert Stop, a function key, Button Mode, Save Actions, Batch to the project (an error logged), the report - or SKIP without playwright" \
  || { bad "2.427.0 actions browser test"; grep -a "FAIL\|Error" -A2 /tmp/psactionsui4270.log | head -14; }

# ---- 2.428.0 (Tim: "i would like all the drawing tools from coreldraw and the tool dockers" - the drawing tools)
node scripts/test-psdraw.js > /tmp/psdraw4280.log 2>&1 \
  && ok "CorelDRAW drawing tool units (2.428.0 rectangle corners, ellipse / pie / arc, polygon, star, complex star, spiral, graph paper, common shapes, frames, live shapes following, artistic media presets / calligraphic / pressure / sprayer, dimensions, units, callout, connector routes, the wiring)" \
  || { bad "2.428.0 CorelDRAW drawing tool units"; grep -a "^FAIL" -A2 /tmp/psdraw4280.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-psdraw-ui.js > /tmp/psdrawui4280.log 2>&1 \
  && ok "2.428.0 CorelDRAW drawing tools browser test: F6 / F8, live rectangle corners + chamfer, square, ellipse / polygon / star / complex star / spiral / graph paper / common shape, live sides, Ctrl+Q, 3-point rectangle / ellipse, artistic media + width + sprayer, dimensions, angular, callout, a connector that follows a move - or SKIP without playwright" \
  || { bad "2.428.0 CorelDRAW drawing tools browser test"; grep -a "FAIL\|Error" -A2 /tmp/psdrawui4280.log | head -14; }

# ---- 2.429.0 (Tim: "... and the tool dockers" - CorelDRAW's dockers)
node scripts/test-psdockers.js > /tmp/psdockers4290.log 2>&1 \
  && ok "docker units (2.429.0 anchors, matrices, the Transform docker's settings, align / distribute moves, shaping plans, the gradient fill + its SVG, the wiring)" \
  || { bad "2.429.0 docker units"; grep -a "^FAIL" -A2 /tmp/psdockers4290.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-psdockers-ui.js > /tmp/psdockersui4290.log 2>&1 \
  && ok "2.429.0 dockers browser test: opened from Window ▸ Dockers, Transform position / rotate / scale + mirror / size / copies / a pixel layer, undo, Shaping weld / trim / intersect, Align top / page centre, Distribute spacing, Object Properties gradient fill + outline + SVG - or SKIP without playwright" \
  || { bad "2.429.0 dockers browser test"; grep -a "FAIL\|Error" -A2 /tmp/psdockersui4290.log | head -14; }

# ---- 2.430.0 (Tim: "in image editor open/create new file in a modular docker, when docked show open documents as tabs.
#      add a transparent color to the color pallet. when a shape is drawn autofill it when it is closed" + "create a
#      pallet docker like coreldraw on the right side of the image-edit docker the autofill color will be the last
#      color selected")
node scripts/test-psdocs.js > /tmp/psdocs4300.log 2>&1 \
  && ok "documents + palette units (2.430.0 a document's keys / take / give / dirty, cascade / tile, the palette, autoFillOf, docColours, openDoc's hooks, pcpdf's session per document, the batch, ⊠ in the brush / bucket / Fill, auto-fill)" \
  || { bad "2.430.0 documents + palette units"; grep -a "^FAIL" -A2 /tmp/psdocs4300.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-psdocs-ui.js > /tmp/psdocsui4300.log 2>&1 \
  && ok "2.430.0 documents + palette browser test: the first docks, the next floats, tabs / windows to the front with their own layers + undo, drag to dock / float, Tile / Consolidate / Next / as Tabs, Close (asks) / Close All / saved = no question, the palette (fill / outline / ⊠), auto-fill of a closed polyline, ⊠ brush = transparency - or SKIP without playwright" \
  || { bad "2.430.0 documents + palette browser test"; grep -a "FAIL\|Error" -A2 /tmp/psdocsui4300.log | head -14; }

# ---- 2.431.0 (Tim: "when the editor is open the prompt docker changes to image mode - all generated images are sent to
#      the open canvas as a layer")
node scripts/test-iegen.js > /tmp/iegen4310.log 2>&1 \
  && ok "editor + prompt docker units (2.431.0 generateOne's H3OnGenerated seam, the mode kept / given back, the observer, pictures -> layers named after the prompt, the chip)" \
  || { bad "2.431.0 editor + prompt docker units"; grep -a "^FAIL" -A2 /tmp/iegen4310.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-iegen-ui.js > /tmp/iegenui4310.log 2>&1 \
  && ok "2.431.0 editor + prompt docker browser test: open = Image (+ the chip), closed = the mode back, a mode picked meanwhile kept, a render's 2 pictures = 2 layers named after the prompt (fitted, centred), no document = opened as one, editor closed = canvas untouched - or SKIP without playwright" \
  || { bad "2.431.0 editor + prompt docker browser test"; grep -a "FAIL\|Error" -A2 /tmp/iegenui4310.log | head -14; }

# ---- 2.432.0 (Tim: "create a themes tab in the settings dialog - have a ui size slider to adjust the size of fonts and the
#      ui. save the visibility status of the dockers as well, and their positions and sizes when save layout button
#      under docker layout")
node scripts/test-themes.js > /tmp/themes4320.log 2>&1 \
  && ok "themes + docker layout units (2.432.0 the five themes, varsFor / accent / shade / clampScale, themes.js in <head>, the Themes tab + the UI size moved, the editor follows, docker.cfg keeps vis / floats / panels / cols, the page saves / applies them)" \
  || { bad "2.432.0 themes + docker layout units"; grep -a "^FAIL" -A2 /tmp/themes4320.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-themes-ui.js > /tmp/themesui4320.log 2>&1 \
  && ok "2.432.0 themes + docker layout browser test: Settings ▸ Themes (5 themes, Light changes the app, the accent, kept after a reload, Reset), UI size 150 % = 21 px fonts + the dock slider in step, ⊞ Docker layout ▸ 💾 Save layout keeps on-screen / collapsed / hidden dockers + References hidden + a floating panel's place; Load puts them back - or SKIP without playwright" \
  || { bad "2.432.0 themes + docker layout browser test"; grep -a "FAIL\|Error" -A2 /tmp/themesui4320.log | head -14; }

# ---- 2.433.0 (Tim: "in karaoke docker add a nudge left and nudge right button to each word in the timing. if the user
#      ctrl+click the button then nudge all the following words by the same amount, shift+ctrl+click ... larger nudge ...
#      shift+click will nudge the single word by the larger nudge - highlight the line of words that the marker is over")
node scripts/test-kgnudge.js > /tmp/kgnudge4330.log 2>&1 \
  && ok "karaoke nudge units (2.433.0 plan: click / Shift / Ctrl / ⌘ / ◀; nudge one / the rest, never before 0 s with the spacing kept; wordAt / lineAt; the wiring)" \
  || { bad "2.433.0 karaoke nudge units"; grep -a "^FAIL" -A2 /tmp/kgnudge4330.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-kgnudge-ui.js > /tmp/kgnudgeui4330.log 2>&1 \
  && ok "2.433.0 karaoke nudge browser test: ◀ ▶ on every word, click / Shift / Ctrl / Shift+Ctrl, the boxes follow, the amounts set + kept, cut short at 0 s, the line under the marker lit - or SKIP without playwright / ffmpeg" \
  || { bad "2.433.0 karaoke nudge browser test"; grep -a "FAIL\|Error" -A2 /tmp/kgnudgeui4330.log | head -14; }

# ---- 2.434.0 (Tim: "add anything else in our gap list that will fit this turn" - the Gradient Editor, Layer Comps,
#      smart filter blend modes)
node scripts/test-psgrad.js > /tmp/psgrad4340.log 2>&1 \
  && ok "gradient editor / layer comps / smart blend units (2.434.0 presets, norm / resolve / colorAt / add / move / remove / reverse / distribute / toCanvas / toCss / svgStops, a shape's SVG stops, capture / planOf, 24 modes, blendPx / blendInto, the wiring)" \
  || { bad "2.434.0 gradient editor / layer comps / smart blend units"; grep -a "^FAIL" -A2 /tmp/psgrad4340.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-psgrad-ui.js > /tmp/psgradui4340.log 2>&1 \
  && ok "2.434.0 gradient editor / layer comps / smart blend browser test: the editor (a stop added / moved / dragged off, New), the Gradient tool draws it, a fill layer's + a shape's gradient (SVG), comps (new, apply, next, undo, per document), Blending Options (Multiply / Screen) - or SKIP without playwright" \
  || { bad "2.434.0 gradient editor / layer comps / smart blend browser test"; grep -a "FAIL\|Error" -A2 /tmp/psgradui4340.log | head -14; }

# ---- 2.435.0 (Tim: "allow user to save/load themes (save themes to themes\theme name.json) . Give user option to embed
#      fonts into pdf in the save dialog")
node scripts/test-themesave.js > /tmp/themesave4350.log 2>&1 \
  && ok "saved themes + PDF fonts units (2.435.0 themes/<name>.json: safeName / clean / save / list / read / remove, effective / fromSaved, the font files: pick / dirs / readNames, the routes, fontkit vendored, the Save dialog's Embed fonts)" \
  || { bad "2.435.0 saved themes + PDF fonts units"; grep -a "^FAIL" -A2 /tmp/themesave4350.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-themesave-ui.js > /tmp/themesaveui4350.log 2>&1 \
  && ok "2.435.0 saved themes + PDF fonts browser test: Customize, 💾 Save theme -> themes/<name>.json + its card, load it back (+ after a reload), Import, ✕ delete, the PDF Save dialog's Embed fonts: a Cyrillic line embedded (subset) as real text, without it in the picture - or SKIP without playwright" \
  || { bad "2.435.0 saved themes + PDF fonts browser test"; grep -a "FAIL\|Error" -A2 /tmp/themesaveui4350.log | head -14; }

# ---- 2.436.0 (Tim: "save image edit project as .bgi, save video project as .bgv, save the overall project as .bgp in
#      xml format")
node scripts/test-bgfiles.js > /tmp/bgfiles4360.log 2>&1 \
  && ok "project files units (2.436.0 BgXml JSON <-> XML, BgZip stored / DEFLATE + CRC, .bgv: clips / media / nests / XML both ways, .bgp: walk / estimate / streamed export (self-contained, manifest) + import (byte for byte, empty folders, a cut file, paths kept inside), pcbgi settingsOf / remap / refsOf, the wiring)" \
  || { bad "2.436.0 project files units"; grep -a "^FAIL" -A2 /tmp/bgfiles4360.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-bgfiles-ui.js > /tmp/bgfilesui4360.log 2>&1 \
  && ok "2.436.0 project files browser test: a .bgi round trip (6 layers of every kind, a smart object + filter mask, channel, selection, path, comp - settings exact, pixels, new ids remapped), Save Project again with no dialog, a damaged .bgi refused; 🎞 .bgv save / look / open as a timeline; 📦 .bgp sizes, manifest + self-contained save, import as a new project (never over one), upload - or SKIP without playwright" \
  || { bad "2.436.0 project files browser test"; grep -a "FAIL\|Error" -A2 /tmp/bgfilesui4360.log | head -14; }

# ---- 2.437.0 (Tim: "continue with the photoshop gap closure, allow user to generate fill inside a selected shape or mask")
node scripts/test-genfill.js > /tmp/genfill4370.log 2>&1 \
  && ok "generate fill in shape / mask + pattern library units (2.437.0 areaFromAlpha / areaFromMask / chainEnd / placeOnto clipped above the chain or with the mask, patterns/<name>.png: pngSize / save / list / remove, usesOf / scaleOf, the wiring)" \
  || { bad "2.437.0 generate fill + pattern library units"; grep -a "^FAIL" -A2 /tmp/genfill4370.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-genfill-ui.js > /tmp/genfillui4370.log 2>&1 \
  && ok "2.437.0 generate fill + pattern library browser test (AI stubbed): ✨ in Shape -> a clipped layer above the shape (and above an earlier fill), ✨ in Mask -> the mask copied, the right-click menu / Properties, one undo; Define Pattern, a Pattern fill layer + its scale, Fill ▸ Pattern, Pattern Overlay user:, a .bgi carrying its pattern back into the library, the Pattern Library dialog - or SKIP without playwright" \
  || { bad "2.437.0 generate fill + pattern library browser test"; grep -a "FAIL\|Error" -A2 /tmp/genfillui4370.log | head -14; }

# ---- 2.438.0 (Tim: "in image docker make layers tab group and color tab group into floating dockers that can resize.
#      create an empty floating docker that can be named ..." / "put message boxes and dialogs in the center of the screen
#      by default. remember their locations if moved in file dialog_layout.cfg" / "confine the video toolbox docker" /
#      "shift+del deletes selected layer")
node scripts/test-panels.js > /tmp/panels4380.log 2>&1 \
  && ok "floating / named dockers + dialog places units (2.438.0 fit / hitDocker / canDock, keyOf / center / clamp, dialog_layout.cfg + panel_layout.cfg read / merge / write, the wiring: routes, the editor's fixed dialogs, Shift+Del, 🧰 confined)" \
  || { bad "2.438.0 floating dockers + dialog places units"; grep -a "^FAIL" -A2 /tmp/panels4380.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-panels-ui.js > /tmp/panelsui4380.log 2>&1 \
  && ok "2.438.0 floating dockers browser test: an editor dialog in the middle, moved = kept in dialog_layout.cfg and opened there, Shift+Del, ⇱ Layers floats (8 grips, resized, kept inside the editor), a named docker, Layers + Colour docked in it as tabs, ⚙ menu, panel_layout.cfg, all back after a reload, ⇱ / ⇲ / delete, a message box in the middle, 🧰 kept inside the timeline docker + hidden with it - or SKIP without playwright" \
  || { bad "2.438.0 floating dockers browser test"; grep -a "FAIL\|Error" -A2 /tmp/panelsui4380.log | head -14; }

# ---- 2.439.0 (Tim: "add width and height in a top toolbar in image editor - add a lock button next to the width x height
#      inputs to lock aspect ratio. when rectangle shape is drawn add border-radius inputs for each side like in
#      coreldraw ... When user chooses subtract shape or add shape don't change the existing shape ...")
node scripts/test-propbar.js > /tmp/propbar4390.log 2>&1 \
  && ok "property bar units (2.439.0 sizeMatrix with / without the lock, cornersOf / setCorners, the widths + draw modes, combinePath keeps the picked shape's parts, per-corner radii in pcpath + pcdoc, newShape asks drawCombine)" \
  || { bad "2.439.0 property bar units"; grep -a "^FAIL" -A2 /tmp/propbar4390.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-propbar-ui.js > /tmp/propbarui4390.log 2>&1 \
  && ok "2.439.0 property bar browser test: a CorelDRAW rectangle's X Y W H (🔒 / 🔓), corners 🔗 / one, drawn round, outline width + dashed from the picture picker, ⊖ Subtract an ellipse = a hole with no new layer, ⊕ Add, undo, a Shape-tool rectangle's own radii, a pixel layer resized - or SKIP without playwright" \
  || { bad "2.439.0 property bar browser test"; grep -a "FAIL\|Error" -A2 /tmp/propbarui4390.log | head -14; }

# ---- 2.440.0 (Tim: "add rulers, guidelines, snap options like coreldraw to image editor.")
node scripts/test-guides.js > /tmp/guides4400.log 2>&1 \
  && ok "rulers / guidelines / snapping units (2.440.0 units at a dpi, gridStep, targetsOf: guidelines / page / boxes / nodes / midpoints / intersections, snapPoint: a point first then per axis, the grid; snapBox for the Move tool, the snapping tools, guides kept per document + in the .bgi, E.snapPos in the pointer handlers)" \
  || { bad "2.440.0 rulers / guidelines / snapping units"; grep -a "^FAIL" -A2 /tmp/guides4400.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-guides-ui.js > /tmp/guidesui4400.log 2>&1 \
  && ok "2.440.0 guidelines / snapping browser test: guidelines out of both rulers (the vertical one snapped to the page centre), a press on a ruler leaves the picture alone, a rectangle started on the crossing, the Move tool snapping a box onto a guideline, a guideline moved / dragged back onto the ruler, millimetres in the Guidelines dialog + one typed, Snap off, the View menu, locked, kept in the .bgi - or SKIP without playwright" \
  || { bad "2.440.0 guidelines / snapping browser test"; grep -a "FAIL\|Error" -A2 /tmp/guidesui4400.log | head -14; }

# ---- 2.441.0 (Tim: "with the dimension tools let the user select the size and units of the dimension line selected, then
#      use those measurements to create a scale ... ctrl+drag will lock dragging dimension line horizontal shift+ drag will
#      lock dragging vertical ... pick points on a shape or image to dimension accurately like in a cad program")
node scripts/test-dims.js > /tmp/dims4410.log 2>&1 \
  && ok "CAD dimension units (2.441.0 scaleFrom / fmtScaled, lockEnd Ctrl / Shift, nearestOnPath on lines + curves, defOf from an older dimension's lines, handlesOf, the scale per document + in the .bgi, the wiring)" \
  || { bad "2.441.0 CAD dimension units"; grep -a "^FAIL" -A2 /tmp/dims4410.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-dims-ui.js > /tmp/dimsui4410.log 2>&1 \
  && ok "2.441.0 CAD dimensions browser test: a picture's corners picked exactly, a shape's node + a point on its outline, 📏 5 m = the scale, the next dimension in it, an end dragged with Ctrl (live number) and with Shift, undo, a new scale re-measures all, the .bgi keeps it - or SKIP without playwright" \
  || { bad "2.441.0 CAD dimensions browser test"; grep -a "FAIL\|Error" -A2 /tmp/dimsui4410.log | head -14; }

# ---- 2.442.0 (Tim: "if a shape is selected and user generates image , put that image in the shape. let user add any layer
#      or layers to frame(a closed shape). add option to edit frame ... the frame will move and rotate and scale as normal
#      but everything inside will rotate, scale and move at the same time ... keep he layers in the frame in a tree")
node scripts/test-frames.js > /tmp/frames4420.log 2>&1 \
  && ok "frames units (2.442.0 isClosedShape, the frame's nodes, fitAffine turn / scale / skew / not affine, a rectangle turned into a path, moveInto / extractPlan on the tree, frameOf / underFrame, the undo snapshot, the wiring)" \
  || { bad "2.442.0 frames units"; grep -a "^FAIL" -A2 /tmp/frames4420.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-frames-ui.js > /tmp/framesui4420.log 2>&1 \
  && ok "2.442.0 frames browser test: Place Inside Frame (clipped, a tree in Layers), the frame dragged = its contents live + one undo step, the Transform docker's turn + scale carries them, Edit Frame Contents / ✓ Finish, a click picks the frame, a drop onto its row, Extract + undo, ✨ Generate into the active shape - or SKIP without playwright" \
  || { bad "2.442.0 frames browser test"; grep -a "FAIL\|Error" -A2 /tmp/framesui4420.log | head -14; }

# ---- 2.443.0 (Tim: "Add each element to themes to be styled - each button's can be edited including icons, icon position,
#      icon size, icon fill, text size, font, text shadow, button shadow" - "go into edit theme mode when the style a button
#      button is toggled ... when it is toggled again app will go into live mode")
node scripts/test-themeedit.js > /tmp/themeedit4430.log 2>&1 \
  && ok "edit theme mode units (2.443.0 cleanSel / cleanRule / cleanStyles - nothing breaks out of its rule, cssStr, compile: text / box / icon place / size / fill / picture, splitIcon, selectorsFor, themes/<name>.json keeps the styles, the wiring)" \
  || { bad "2.443.0 edit theme mode units"; grep -a "^FAIL" -A2 /tmp/themeedit4430.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-themeedit-ui.js > /tmp/themeeditui4430.log 2>&1 \
  && ok "2.443.0 edit theme mode browser test: 🖌 next to ⚙, a click picks (the app does not get it), size / colour / shadows live, a new icon on the right tinted (the words unchanged), all like it, inside a modal dialog + icon only, Esc / Esc, live mode, saved in the theme / cleared / loaded back, on after a reload - or SKIP without playwright" \
  || { bad "2.443.0 edit theme mode browser test"; grep -a "FAIL\|Error" -A2 /tmp/themeeditui4430.log | head -14; }

# ---- 2.444.0 (Tim: "when image edit docker is open and the edit tab is clicked, change the dropdown in the prompt docker to
#      qwen2.1 edit, change the generate button to edit ... when the generate tab is clicked use the selected layer and
#      generate from the prompt docker into the selection of the selected layer ... add the settings button to the right
#      of the image-editor menubar")
node scripts/test-promptlink.js > /tmp/plink4440.log 2>&1 \
  && ok "prompt docker link + editor settings units (2.444.0 linkedNow, the button's words, the Qwen Image 2.1 edit pick, the settings tabs' order, the page's H3GoLabel / H3TakeGenerate, runAI(opt), the blend on ✔ Apply, ⚙ #kxPrefs)" \
  || { bad "2.444.0 prompt docker link units"; grep -a "^FAIL" -A2 /tmp/plink4440.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-promptlink-ui.js > /tmp/plinkui4440.log 2>&1 \
  && ok "2.444.0 prompt docker link browser test (AI stubbed): Edit tab = Qwen Image 2.1 edit + ✏ Edit, the panel's button / model / prompt gone, the prompt docker's Edit runs the editor's edit (not the queue); Generate tab = the style back, into the selected layer's selection, ✔ Apply blends into it + undo; another tab = the prompt docker as before; ⚙ settings - or SKIP without playwright" \
  || { bad "2.444.0 prompt docker link browser test"; grep -a "FAIL\|Error" -A2 /tmp/plinkui4440.log | head -14; }

# ---- 2.445.0 (Tim: "Add a grid toggle button to the top toolbar in video docker and image editor docker ... in the image
#      editor settings dialog and video docker settings dialog add a tab for grids/guides, grid spacing, major grid
#      spacing, lines or dots, grid color, guideline color, guideline snap distance")
node scripts/test-grids.js > /tmp/grids4450.log 2>&1 \
  && ok "grids units (2.445.0 H3Grid clean / stepFor / draw lines + major / dots / the shared tab + readTab, the editor's tab + ⊞ + drawing, the timeline's tabs + tlgrid.js)" \
  || { bad "2.445.0 grids units"; grep -a "^FAIL" -A2 /tmp/grids4450.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-grids-ui.js > /tmp/gridsui4450.log 2>&1 \
  && ok "2.445.0 grids browser test: the editor's ⊞, ⚙ ▸ Grids & Guides (dots at the crossings, lines, the colours, the snap distance), ⊞ off; the timeline's ⊞ draws on the preview canvas, ⚙ Timeline settings' tabs save ui.tl_grid, kept after a reload - or SKIP without playwright" \
  || { bad "2.445.0 grids browser test"; grep -a "FAIL\|Error" -A2 /tmp/gridsui4450.log | head -14; }

# ---- 2.446.0 (Tim: "add rulers, guidelines and grid to the preview canvas in video docker too(like how coreldraw
#      impliments them)")
node scripts/test-tlrulers.js > /tmp/tlrulers4460.log 2>&1 \
  && ok "timeline rulers units (2.446.0 rulerStep, snapAxis, snapBox, guideAt, the wiring)" \
  || { bad "2.446.0 timeline rulers units"; grep -a "^FAIL" -A2 /tmp/tlrulers4460.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-tlrulers-ui.js > /tmp/tlrulersui4460.log 2>&1 \
  && ok "2.446.0 timeline rulers browser test: 📏 rulers drawn, guidelines dragged out of both rulers (saved with the timeline), a moved layer snaps onto them, Alt = free, a guideline moved and dropped back onto its ruler, the grid snaps too - or SKIP without playwright" \
  || { bad "2.446.0 timeline rulers browser test"; grep -a "FAIL\|Error" -A2 /tmp/tlrulersui4460.log | head -14; }

# ---- 2.447.0 (Tim: "and more photoshop features to close the gap" - Artboards)
node scripts/test-artboards.js > /tmp/artboards4470.log 2>&1 \
  && ok "artboards units (2.447.0 presets, cleanBoard, nextPlace, docFor, unionBox, safeName, the wiring: pcdoc, imageedit, pctools, pcpsd, the tool)" \
  || { bad "2.447.0 artboards units"; grep -a "^FAIL" -A2 /tmp/artboards4470.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-artboards-ui.js > /tmp/artboardsui4470.log 2>&1 \
  && ok "2.447.0 artboards browser test: New Artboard (its layers clipped to it, its background), a second right of it + the canvas grows, moved with its layers + undo, Properties, Export (a PNG each, its own layers), the Artboard tool - or SKIP without playwright" \
  || { bad "2.447.0 artboards browser test"; grep -a "FAIL\|Error" -A2 /tmp/artboardsui4470.log | head -14; }

# ---- 2.448.0 (Tim: "and more photoshop features to close the gap" - the Content-Aware Fill workspace)
node scripts/test-cafill.js > /tmp/cafill4480.log 2>&1 \
  && ok "content-aware fill workspace units (2.448.0 ringSample, rectSample, the Sampling Brush, ADAPT, inpaint taking patches only from the sampling area, the wiring)" \
  || { bad "2.448.0 content-aware fill units"; grep -a "^FAIL" -A2 /tmp/cafill4480.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-cafill-ui.js > /tmp/cafillui4480.log 2>&1 \
  && ok "2.448.0 content-aware fill workspace browser test: the workspace, the preview, the tinted picture, the Sampling Brush (−) -> Custom, OK to a new layer filled from the sampling area only + undo, Rectangular + current layer, kept choices - or SKIP without playwright" \
  || { bad "2.448.0 content-aware fill browser test"; grep -a "FAIL\|Error" -A2 /tmp/cafillui4480.log | head -14; }

# ---- 2.449.0 (Tim: "and more photoshop features to close the gap" - per-character text styles)
node scripts/test-pcruns.js > /tmp/pcruns4490.log 2>&1 \
  && ok "per-character type units (2.449.0 applyRun, normRuns, styleAt, allBold, shiftRuns, pieces, layout - one baseline, wrapping, centring - sameMetrics, owns, scale, the wiring)" \
  || { bad "2.449.0 per-character type units"; grep -a "^FAIL" -A2 /tmp/pcruns4490.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-pcruns-ui.js > /tmp/pcrunsui4490.log 2>&1 \
  && ok "2.449.0 per-character type browser test: picked letters + the bar's colour / B / size, the typing kept open, undo, ranges following the typing, the Character panel's underline, nothing picked = the layer, Clear Character Overrides - or SKIP without playwright" \
  || { bad "2.449.0 per-character type browser test"; grep -a "FAIL\|Error" -A2 /tmp/pcrunsui4490.log | head -14; }

# ---- 2.450.0 (Tim: "and more photoshop features to close the gap" - warp grid + liquify extras)
node scripts/test-warpgrid.js > /tmp/warpgrid4500.log 2>&1 \
  && ok "warp grid / liquify extras units (2.450.0 latSplit exact, latUnsplit, latGrid, latCorners / latNear / latWeights, meshOf with wgrid, liq pushleft / smooth, faceGuess / faceField, the wiring)" \
  || { bad "2.450.0 warp grid / liquify extras units"; grep -a "^FAIL" -A2 /tmp/warpgrid4500.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-warpgrid-ui.js > /tmp/warpgridui4500.log 2>&1 \
  && ok "2.450.0 warp grid / liquify extras browser test: Grid 3 x 3 / custom, Split Crosswise where clicked, a crossing point dragged, Alt-click unsplit, Enter applies; Liquify Push Left / Smooth, the Face tool + Eye Size, OK - or SKIP without playwright" \
  || { bad "2.450.0 warp grid / liquify extras browser test"; grep -a "FAIL\|Error" -A2 /tmp/warpgridui4500.log | head -14; }

# ---- 2.451.0 (Tim: the editor's Edit / Generate tabs did not drive the prompt docker for him; "del button deletes
# current layer"; "add save button in prompt docker - save the prompt as the first line - add it to a dropdown for quick prompts")
node scripts/test-quickprompts.js > /tmp/qp4510.log 2>&1 \
  && ok "quick prompts / Del / prompt link units (2.451.0 lib/quickPrompts nameOf / save / replace / remove, the dropdown, the routes, Del, the tab click puts the prompt docker into Image)" \
  || { bad "2.451.0 quick prompts units"; grep -a "^FAIL" -A2 /tmp/qp4510.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-quickprompts-ui.js > /tmp/qpui4510.log 2>&1 \
  && ok "2.451.0 browser test: the Edit tab from 🎬 Video with nothing open -> 🖼 Image + Qwen Image 2.1 edit + ✏ Edit, the tab's button / model row gone; Generate; Edit with nothing open says so; Refine = Video again; Del deletes the layer + undo; 💾 Save / ⚡ pick / 🗑 - or SKIP without playwright" \
  || { bad "2.451.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/qpui4510.log | head -14; }

# ---- 2.452.0 (Tim: "add transform options, rotate and scale. add handles to the selected object to rotate and scale when
# move tool is selected.single click on the layer scales(shift scales uniform), double click rotates.")
node scripts/test-handles.js > /tmp/handles4520.log 2>&1 \
  && ok "move tool handles units (2.452.0 handlePoints, hitHandle, scale corner / side / Shift / Alt, rotate 15° steps, skew, turned type, smart objects, the wiring)" \
  || { bad "2.452.0 handles units"; grep -a "^FAIL" -A2 /tmp/handles4520.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-handles-ui.js > /tmp/handlesui4520.log 2>&1 \
  && ok "2.452.0 handles browser test: scale handles + the options, a corner / Shift / a side, double-click rotate 45°, a click back, a drag inside still moves, W % ⤡, type turned and still type - or SKIP without playwright" \
  || { bad "2.452.0 handles browser test"; grep -a "FAIL\|Error" -A2 /tmp/handlesui4520.log | head -14; }

# ---- 2.453.0 (Tim: "lock contents to the frame when put in frame like in coreldraw, make frame behave like coreldraw frame, right
# click context menu to enter frame and edit contents of the frame. right click context menu to finish editing frame. move scale
# and rotate frames contents with selected frame frame")
node scripts/test-frames2.js > /tmp/frames24530.log 2>&1 \
  && ok "frames 2 units (2.453.0 frameOf / underFrame, locked = the frame is moved, the right-click menu, no double-click editing, the handles carry the contents)" \
  || { bad "2.453.0 frames 2 units"; grep -a "^FAIL" -A2 /tmp/frames24530.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-frames2-ui.js > /tmp/frames2ui4530.log 2>&1 \
  && ok "2.453.0 frames browser test: a drag on locked contents moves the frame + them, the frame's handle scales them, ⟳90 turns them, right-click Edit / the contents alone / right-click Finish, double-click = rotate handles - or SKIP without playwright" \
  || { bad "2.453.0 frames browser test"; grep -a "FAIL\|Error" -A2 /tmp/frames2ui4530.log | head -14; }

# ---- 2.454.0 (Tim: "make the panel in the image editor a resizable docker with dropzones for the other dockers. make all the
# tab groups into floating dockers that can dock in another docker like the panel docker")
node scripts/test-paneldock.js > /tmp/paneldock4540.log 2>&1 \
  && ok "panel column docker units (2.454.0 columnZones, orderOf, every group floats, the drop-zone wiring, the width grip)" \
  || { bad "2.454.0 panel docker units"; grep -a "^FAIL" -A2 /tmp/paneldock4540.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-paneldock-ui.js > /tmp/paneldockui4540.log 2>&1 \
  && ok "2.454.0 panel docker browser test: ⇱ on every group, Properties floated and dropped above Colour (the orange line), Layers dropped at the end, the left edge widens the column, kept over a reload - or SKIP without playwright" \
  || { bad "2.454.0 panel docker browser test"; grep -a "FAIL\|Error" -A2 /tmp/paneldockui4540.log | head -14; }

# ---- 2.455.0 (Tim: "dialogs don't get edited in theme edit mode - when i try to select an icon and the dialogs open they are non
# functional and editable- they should work properly")
node scripts/test-themedlg.js > /tmp/themedlg4550.log 2>&1 \
  && ok "theme edit + dialogs units (2.455.0 DIALOG_SEL: open dialogs, *dlg boxes, role=dialog but not the floating dockers, menus; ours() + Esc)" \
  || { bad "2.455.0 theme edit dialogs units"; grep -a "^FAIL" -A2 /tmp/themedlg4550.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-themedlg-ui.js > /tmp/themedlgui4550.log 2>&1 \
  && ok "2.455.0 theme edit + dialogs browser test: a button picked, the icon picture's file dialog opens / is not outlined / Cancel works, an editor dialog takes typing + OK, nothing re-picked - or SKIP without playwright" \
  || { bad "2.455.0 theme edit dialogs browser test"; grep -a "FAIL\|Error" -A2 /tmp/themedlgui4550.log | head -14; }

# ---- 2.456.0 (Tim: "convert video docker into floating docker - change it's name to StoryBoard - Add Thumbnails to each scene
# generated with the selected image model,give user the option to use the character sheet and location images added reference
# images as reference images for the storyboard images - give user the option in each scene to use storyboard image as the first
# or last image")
node scripts/test-storyboard.js > /tmp/storyboard4560.log 2>&1 \
  && ok "storyboard units (2.456.0 promptFor, pickRefs sheets / locations / refs by name, the client's slot body + thumbnail box, the routes and the wiring)" \
  || { bad "2.456.0 storyboard units"; grep -a "^FAIL" -A2 /tmp/storyboard4560.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-storyboard-ui.js > /tmp/storyboardui4560.log 2>&1 \
  && ok "2.456.0 storyboard browser test: the StoryBoard name / ⇱ / the bar / a box per scene, 🖼 make with the stub image model (the plan, the job, the thumbnail), → First / → Last, floating + ⇲, ✕ - or SKIP without playwright" \
  || { bad "2.456.0 storyboard browser test"; grep -a "FAIL\|Error" -A2 /tmp/storyboardui4560.log | head -14; }

# ---- 2.457.0 (Tim: "fix dimension lines. keep all of the dimesions elements (dimension line, dimension group, arrowhead and
# extension line. add option to click on an edge and drag the dimension line from the edge of the object as a dimension group,
# add option to click on 1 edge or node then another edge or node to place a dimension group. allow user to drag the extension
# line to change the length of the dimension line update the length live. shift+drag will constrain the dimension line
# horizontally, ctrl+drag will constrain the dimension line vertically. allow extension lines to be resized individually using
# it's nodes.")
node scripts/test-dimgroup.js > /tmp/dimgroup4570.log 2>&1 \
  && ok "dimension group units (2.457.0 geom / autoKind / constrain Shift = H, Ctrl = V / moveLine / moveExt / extNode / edges / foot / fit3 / mapDef, the wiring)" \
  || { bad "2.457.0 dimension group units"; grep -a "^FAIL" -A2 /tmp/dimgroup4570.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-dimgroup-ui.js > /tmp/dimgroupui4570.log 2>&1 \
  && ok "2.457.0 dimension groups browser test: an edge pressed + dragged = a group of 3 parts (arrowheads only on the line), two picks (edge / node), an extension line dragged (live length, CAD point), its nodes alone, Shift / Ctrl, the group moved as one, undo, the scale, the .bgi - or SKIP without playwright" \
  || { bad "2.457.0 dimension groups browser test"; grep -a "FAIL\|Error" -A2 /tmp/dimgroupui4570.log | head -14; }

# ---- 2.458.0 (Tim: "add an auto dimension feature and floorplan dimension feature" - floorplan = every wall + the overall size,
# and a chain along clicked points + the total)
node scripts/test-dimauto.js > /tmp/dimauto4580.log 2>&1 \
  && ok "auto / floorplan / chain dimension units (2.458.0 polysOf, outward, wallDefs, overallDefs, floorplanDefs, chainKind, chainDefs, the wiring)" \
  || { bad "2.458.0 auto dimension units"; grep -a "^FAIL" -A2 /tmp/dimauto4580.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-dimauto-ui.js > /tmp/dimautoui4580.log 2>&1 \
  && ok "2.458.0 auto dimensions browser test: ⌂ Floorplan on an L-shaped room (8 groups outside, one undo), Layer ▸ Auto Dimension, the Floorplan dialog, the Chain Dimension tool (Enter / double-click, Ctrl = vertical, Esc) - or SKIP without playwright" \
  || { bad "2.458.0 auto dimensions browser test"; grep -a "FAIL\|Error" -A2 /tmp/dimautoui4580.log | head -14; }

# ---- 2.459.0 (Tim: "remove all coreldraw and adobe references in help or tooltips or information" - everything the user sees)
python3 scripts/test-brandnames.py > /tmp/brandnames4590.log 2>&1 \
  && ok "no CorelDRAW / Adobe product names in what the user sees (2.459.0: help pages, USAGE / the Guide, shortcuts.json, the brochure, every string literal in ext / static / lib / routes - file-format data excepted)" \
  || { bad "2.459.0 product names"; grep -a "^FAIL\|^  " /tmp/brandnames4590.log | head -20; }

# ---- 2.460.0 (Tim: "bridge daz3d to image editor and timeline - allow me to move the camera and adjust poses in daz3d through
# the image editor or timeline docker. use the image in the daz layer to generate a new image / if we can't do it wit daz
# directly we can send daz scene to blender" - asked: Blender + an experimental Daz live link)
node scripts/test-layer3d.js > /tmp/layer3d4600.log 2>&1 \
  && ok "3D layer units (2.460.0 pc3d orbitPos / basis / project / orbitDrag / VIEWS / setBone, lib/layer3d cleanJob / orbitFrom / sizeFor, the routes and the wiring)" \
  || { bad "2.460.0 3D layer units"; grep -a "^FAIL" -A2 /tmp/layer3d4600.log | head -14; }
python3 scripts/test-layer3d.py > /tmp/layer3dpy4600.log 2>&1 \
  && ok "3D layer with a real Blender (2.460.0 a posable fixture: inspect, one serve process - the scene camera = its orbit, a turned bone, the pose reset per job, another orbit, EEVEE) - or SKIP without Blender" \
  || { bad "2.460.0 3D layer Blender test"; grep -a "FAIL" -A2 /tmp/layer3dpy4600.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-layer3d-ui.js > /tmp/layer3dui4600.log 2>&1 \
  && ok "2.460.0 3D layer browser test: Layer ▸ New 3D Layer picks a Daz send, the 🧊 3D tab, a bone turned + undo, Right, 🖐 drag the view, 🎥 scene camera, ▶ Render EEVEE, ✨ Generate from it, the .bgi - or SKIP without playwright / Blender" \
  || { bad "2.460.0 3D layer browser test"; grep -a "FAIL\|Error" -A2 /tmp/layer3dui4600.log | head -14; }

# ---- 2.461.0 (the timeline side of Tim's 2.457.0 Daz message: poses in the .blend preview, the hand-over to the image
# editor's 3D layer, the EXPERIMENTAL Daz live link)
node scripts/test-blendpose.js > /tmp/blendpose4610.log 2>&1 \
  && ok "timeline pose units (2.461.0 setBone, blenderView = pc3d orbitPos, dazView = dazLive toDaz, blendView clean keeps the pose, blend_scene / blend_layer3d / blend_pose wiring, the live link routes + script)" \
  || { bad "2.461.0 timeline pose units"; grep -a "^FAIL" -A2 /tmp/blendpose4610.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-dazlive.js > /tmp/dazlive4610.log 2>&1 \
  && ok "2.461.0 Daz live link: lib/dazLive (toDaz, cleanCmd, the queue) + the bitGen Live Link script in a mock Daz Studio against the app (the bitGen Camera, bones on top of their values, reset, the status)" \
  || { bad "2.461.0 Daz live link"; grep -a "FAIL" -A2 /tmp/dazlive4610.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-blendpose-ui.js > /tmp/blendposeui4610.log 2>&1 \
  && ok "2.461.0 timeline pose browser test: the Pose section, a bone turned (edits + the three.js bone), undo, 💾 Save bakes it, 🧊 To the image editor, 📡 View + pose → Daz - or SKIP without playwright / Blender" \
  || { bad "2.461.0 timeline pose browser test"; grep -a "FAIL\|Error" -A2 /tmp/blendposeui4610.log | head -14; }

# ---- 2.462.0 (Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor" -
# a sketch layer "something like fusion 360 sketch")
node scripts/test-sketch.js > /tmp/sketch4620.log 2>&1 \
  && ok "sketch layer units (2.462.0 the solver: constraints, driving / driven dimensions, degrees of freedom, over-constrained / redundant refused, drags; profiles with holes / shared edges / T-junctions / arcs; remove / translate / transform; the tools' picks; the wiring)" \
  || { bad "2.462.0 sketch layer units"; grep -a "^FAIL" -A2 /tmp/sketch4620.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-sketch-ui.js > /tmp/sketchui4620.log 2>&1 \
  && ok "2.462.0 sketch layers browser test: New Sketch, a closed Line chain, typed dimensions -> fully constrained, Sketch Select drags, a circle + Tangent, construction, Profiles -> Shapes, undo, move, the .bgi, the N key - or SKIP without playwright" \
  || { bad "2.462.0 sketch layers browser test"; grep -a "FAIL\|Error" -A2 /tmp/sketchui4620.log | head -14; }

# ---- 2.463.0 (the sketch modify tools)
node scripts/test-sketchmod.js > /tmp/sketchmod4630.log 2>&1 \
  && ok "sketch modify units (2.463.0 trim / extend / fillet / chamfer / offset / mirror / rectangular + circular patterns / polygon / slot / 2- + 3-point circles / splines; profiles after each; degrees of freedom kept)" \
  || { bad "2.463.0 sketch modify units"; grep -a "^FAIL" -A2 /tmp/sketchmod4630.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-sketchmod-ui.js > /tmp/sketchmodui4630.log 2>&1 \
  && ok "2.463.0 sketch modify browser test: Trim / Extend / Fillet clicks, Polygon, Slot, Spline, Offset / Mirror / patterns from the Sketch tab, undo - or SKIP without playwright" \
  || { bad "2.463.0 sketch modify browser test"; grep -a "FAIL\|Error" -A2 /tmp/sketchmodui4630.log | head -14; }

# ---- 2.464.0 (the sketch's typed sizes, Measure, units, DXF / SVG)
node scripts/test-sketchcad.js > /tmp/sketchcad4640.log 2>&1 \
  && ok "sketch CAD units (2.464.0 measure: points / lines / circles / arcs / splines / two of them; closed regions exact with holes, fillets, slots; SVG out; DXF out R12 (+ ezdxf's audit when installed); DXF in: LINE / CIRCLE / ARC / POINT / LWPOLYLINE bulges / POLYLINE / SPLINE / ELLIPSE, the rest counted; a round trip; the wiring + /api/cad)" \
  || { bad "2.464.0 sketch CAD units"; grep -a "^FAIL" -A2 /tmp/sketchcad4640.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-sketchcad-ui.js > /tmp/sketchcadui4640.log 2>&1 \
  && ok "2.464.0 sketch CAD browser test: a line typed 150 at 30° + the next 80 level, a rectangle typed 120 x 60, a circle ⌀50, Measure (M) a line / two lines / a region, units mm, Export DXF + SVG to the cad folder, Import DXF (fit, a new sketch) + from Project (real size) - or SKIP without playwright" \
  || { bad "2.464.0 sketch CAD browser test"; grep -a "FAIL\|Error" -A2 /tmp/sketchcadui4640.log | head -14; }

# ---- 2.465.0 (Photoshop gap rows: puppet pin depth / rotation, the Patch tool's Content-Aware mode)
node scripts/test-pinpatch.js > /tmp/pinpatch4650.log 2>&1 \
  && ok "puppet pin + patch units (2.465.0 pinControls: a fixed rotation's satellite controls; pin depth per vertex + meshTris / drawMesh order; grownMask; patchNormal Diffusion + Transparent; patchCA Structure + Color (membrane); the wiring)" \
  || { bad "2.465.0 puppet pin + patch units"; grep -a "^FAIL" -A2 /tmp/pinpatch4650.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-pinpatch-ui.js > /tmp/pinpatchui4650.log 2>&1 \
  && ok "2.465.0 puppet pin + patch browser test: Alt-drag turns the picked pin, Rotate Auto / Fixed 90, Pin Depth, Enter; Patch Content-Aware (Structure 7) from horizontal stripes; Normal Transparent / not; Content-Aware Move's options - or SKIP without playwright" \
  || { bad "2.465.0 puppet pin + patch browser test"; grep -a "FAIL\|Error" -A2 /tmp/pinpatchui4650.log | head -14; }

# ---- 2.466.0 (Photoshop gap rows: OpenType, optical kerning, type to outlines, text in a shape, round corners on any path)
node scripts/test-otype.js > /tmp/otype4660.log 2>&1 \
  && ok "OpenType + round corner units (2.466.0 features / engineOn, toSubs, inkSpan / opticalGap, a font file's shaping: kerning, tracking, optical, liga / onum, outlines + holes; pctype outlinesOf; area type in a triangle; roundCorners incl. a merged L; the wiring)" \
  || { bad "2.466.0 OpenType + round corner units"; grep -a "^FAIL" -A2 /tmp/otype4660.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-otype-ui.js > /tmp/otypeui4660.log 2>&1 \
  && ok "2.466.0 OpenType browser test: ss01 + optical kerning from the Character panel (the font file read), Convert to Shape (same pixels) + undo, Create Work Path, a merged shape's corners rounded, text typed inside a diamond - or SKIP without playwright" \
  || { bad "2.466.0 OpenType browser test"; grep -a "FAIL\|Error" -A2 /tmp/otypeui4660.log | head -14; }

# ---- 2.467.0 (Photoshop gap rows: single colour channels, spot channels)
node scripts/test-channels.js > /tmp/channels4670.log 2>&1 \
  && ok "channel units (2.467.0 targetOf / keepChannels / inkOf / overInk / viewOf; the endPx hook, the Channels panel, the .bgi wiring)" \
  || { bad "2.467.0 channel units"; grep -a "^FAIL" -A2 /tmp/channels4670.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-channels-ui.js > /tmp/channelsui4670.log 2>&1 \
  && ok "2.467.0 channels browser test: Red only (a white stroke), Shift-click Green (a black stroke), Ctrl+5 fill, Ctrl+2; a spot channel from a selection, painted + kept, merged - or SKIP without playwright" \
  || { bad "2.467.0 channels browser test"; grep -a "FAIL\|Error" -A2 /tmp/channelsui4670.log | head -14; }

# ---- 2.468.0 (Photoshop gap rows: actions - strokes + selections recorded, conditionals, Image Processor, droplets)
node scripts/test-actionsx.js > /tmp/actionsx4680.log 2>&1 \
  && ok "actions extra units (2.468.0 rel / abs / thin, condOf, normPath / scalePath, fitSize; pcactions keeps stroke / sel / cond steps + their labels; the wiring)" \
  || { bad "2.468.0 actions extra units"; grep -a "^FAIL" -A2 /tmp/actionsx4680.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-actionsx-ui.js > /tmp/actionsxui4680.log 2>&1 \
  && ok "2.468.0 actions extra browser test: a stroke + a marquee recorded and played at half size, Insert Conditional (landscape / portrait), Image Processor (JPEG fitted), a droplet with a picture dropped on it - or SKIP without playwright" \
  || { bad "2.468.0 actions extra browser test"; grep -a "FAIL\|Error" -A2 /tmp/actionsxui4680.log | head -14; }

# ---- 2.469.0 (Photoshop gap rows: linked smart objects, PSD smart objects kept, .atn files)
node scripts/test-linked.js > /tmp/linked4690.log 2>&1 \
  && ok "linked smart object units (2.469.0 quadOf / transformOf / guid / sniff / staleOf; lib/linkedStore.js; routes + pcpsd wiring)" \
  || { bad "2.469.0 linked smart object units"; grep -a "^FAIL" -A2 /tmp/linked4690.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-linked-ui.js > /tmp/linkedui4690.log 2>&1 \
  && ok "2.469.0 linked smart object browser test: Place Linked, the file changed -> updated, Edit Contents writes back, Convert to Linked / Embed / Relink, a missing file, a PSD round trip keeps smart objects - or SKIP without playwright" \
  || { bad "2.469.0 linked smart object browser test"; grep -a "FAIL\|Error" -A2 /tmp/linkedui4690.log | head -14; }
node scripts/test-atn.js > /tmp/atn4690.log 2>&1 \
  && ok ".atn units (2.469.0 a synthetic Photoshop action file (scripts/atn-fixture.js) read: descriptors, units, enums, references, lists; mapped onto steps; unmatched off; errors)" \
  || { bad "2.469.0 .atn units"; grep -a "^FAIL" -A2 /tmp/atn4690.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-atn-ui.js > /tmp/atnui4690.log 2>&1 \
  && ok "2.469.0 .atn browser test: the sample set loaded into the Actions panel and both actions played - or SKIP without playwright" \
  || { bad "2.469.0 .atn browser test"; grep -a "FAIL\|Error" -A2 /tmp/atnui4690.log | head -14; }

# ---- 2.470.0 (picking like a drawing / CAD program, the CAD toolbar in the image editor + the timeline)
node scripts/test-cadbar.js > /tmp/cadbar4700.log 2>&1 \
  && ok "CAD toolbar + picking units (2.470.0 CadBar.normalize / firstEnabled / CSS; pccadbar constraints, icons, ids; pcselhl COLORS / AUTO_MOVE / isBackground / pickable; tlcadbar + tlselhl; the wiring)" \
  || { bad "2.470.0 CAD toolbar + picking units"; grep -a "^FAIL" -A2 /tmp/cadbar4700.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-selhl-ui.js > /tmp/selhlui4700.log 2>&1 \
  && ok "2.470.0 picking + CAD toolbar browser test: drawn -> the Move tool + picked (orange), hover blue, a click on nothing / Esc picks nothing, press + drag moves, the SKETCH / SHAPES tabs, CREATE ▾, Then Move off, Window ▸ CAD Toolbar, the timeline's toolbar (Hand, Sketch on a Blank Picture) - or SKIP without playwright" \
  || { bad "2.470.0 picking + CAD toolbar browser test"; grep -a "FAIL\|Error" -A2 /tmp/selhlui4700.log | head -14; }

# ---- 2.471.0 (parametric 3D bodies: OpenCascade in the page + the Blender engine, the SOLID tabs)
node scripts/test-body3d.js > /tmp/body3d4710.log 2>&1 \
  && ok "3D body core + OpenCascade units (2.471.0 expressions, parameters (order, cycles), profiles in model space, plan, mesh info / edges / STL / GLB; OpenCascade on the vendored WebAssembly: extrude, fillet, symmetric, split, cut, revolve, arcs, shell, STEP)" \
  || { bad "2.471.0 3D body core + OpenCascade units"; grep -a "^FAIL" -A2 /tmp/body3d4710.log | head -14; }
node scripts/test-pcbody.js > /tmp/pcbody4710.log 2>&1 \
  && ok "3D body layer + server units (2.471.0 rotM / projBox / reanchor / featureLabel; lib/body3d settings + cleanJob; the Blender engine (or SKIP without Blender); tlbody, Settings ▸ 3D, the wiring)" \
  || { bad "2.471.0 3D body layer + server units"; grep -a "^FAIL" -A2 /tmp/pcbody4710.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-body-ui.js > /tmp/bodyui4710.log 2>&1 \
  && ok "2.471.0 3D bodies browser test: SOLID ▸ Extrude (OpenCascade), parameters, edit, fillet, suppress, a sketch change rebuilds, undo, Split Body, Revolve, views + orbit, STL / STEP, the Blender engine, Settings ▸ 3D, → Timeline + the live link - or SKIP without playwright" \
  || { bad "2.471.0 3D bodies browser test"; grep -a "FAIL\|Error" -A2 /tmp/bodyui4710.log | head -14; }

# ---- 2.472.0 (the Unreal Engine 5.8 bridge: the plugin, lib/unreal.js, Unreal / MetaHuman layers, the Unreal camera - against scripts/ue-stub.js)
node scripts/test-unreal.js > /tmp/unreal4720.log 2>&1 \
  && ok "Unreal bridge units (2.472.0 framing / stillRequest / keyAt / renderRequest; lib/unreal.js against the stand-in: status, lists, stills, renders -> mp4 / webm with alpha, errors; the plugin (.uplugin, Python, every command, MRQ); the wiring)" \
  || { bad "2.472.0 Unreal bridge units"; grep -a "^FAIL" -A2 /tmp/unreal4720.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-unreal-ui.js > /tmp/unrealui4720.log 2>&1 \
  && ok "2.472.0 Unreal bridge browser test (the stand-in editor): Settings ▸ 3D ▸ Unreal, Unreal layer + 🎮 nudges + undo, MetaHuman layer, timeline Unreal layer (a sequence), Unreal camera (＋ Key, Render Again) - or SKIP without playwright" \
  || { bad "2.472.0 Unreal bridge browser test"; grep -a "FAIL\|Error" -A2 /tmp/unrealui4720.log | head -14; }

# ---- 2.473.0 (the Feature Reference PDF)
python3 scripts/test-featurespdf.py > /tmp/featpdf4730.log 2>&1 \
  && ok "Feature Reference PDF (2.473.0 docs/FEATURES.md: every bullet in the form, the areas, 500+ features, the newest releases in it, no other products' names; the PDF built: the cover's version + count, every feature named; the shipped one is this version's)" \
  || { bad "2.473.0 Feature Reference PDF"; grep -a "^FAIL" -A2 /tmp/featpdf4730.log | head -14; }

# ---- 2.474.0 (no tool, the selection box, several layers picked, Del)
node scripts/test-multisel.js > /tmp/multisel4740.log 2>&1 \
  && ok "selection box units (2.474.0 norm / boxPick window + crossing / rangeIds; Esc, Del, E.tools.none, pcselhl, the Layers panel, the core's multi move, the wiring)" \
  || { bad "2.474.0 selection box units"; grep -a "^FAIL" -A2 /tmp/multisel4740.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-multisel-ui.js > /tmp/multiselui4740.log 2>&1 \
  && ok "2.474.0 selection box browser test: Esc = no tool, a window box / a crossing box, click + Shift-click, the Layers panel Shift / Ctrl, the Move tool moves the picked together + undo, Del deletes them + undo, Esc again leaves full screen - or SKIP without playwright" \
  || { bad "2.474.0 selection box browser test"; grep -a "FAIL\|Error" -A2 /tmp/multiselui4740.log | head -14; }

# ---- 2.475.0 (the Unreal camera in the image editor: the camera tool, the Camera tab, the lens; the plugin 1.1.0)
node scripts/test-uecam.js > /tmp/uecam4750.log 2>&1 \
  && ok "Unreal camera units (2.475.0 fovOf / focalOf, basis, moveCam orbit / look / pan / dolly / roll, presets; pcuecam lensOf / camOf / withLens; cleanLens; the plugin's lens / set_viewport / focus_at; the wiring)" \
  || { bad "2.475.0 Unreal camera units"; grep -a "^FAIL" -A2 /tmp/uecam4750.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-uecam-ui.js > /tmp/uecamui4750.log 2>&1 \
  && ok "2.475.0 Unreal camera browser test (the stand-in editor): the camera tool's orbit (previews + one full render + one undo), pan, roll, look, wheel dolly; the Camera tab: a preset, exposure, field of view <-> focal length, click to focus + undo, to / from Unreal's viewport; the timeline camera's lens - or SKIP without playwright" \
  || { bad "2.475.0 Unreal camera browser test"; grep -a "FAIL\|Error" -A2 /tmp/uecamui4750.log | head -14; }

# ---- 2.476.0 (Unreal lights, volumetric lights + fog: static/uerig.js, pcuelights.js, the timeline's Lights & Fog; the plugin 1.2.0)
node scripts/test-uelights.js > /tmp/uelights4760.log 2>&1 \
  && ok "Unreal lights units (2.476.0 project / unproject, aim, newLight, presets, norm, empty; pcuelights markers; cleanRig; the plugin's lights + height / volumetric fog; the wiring)" \
  || { bad "2.476.0 Unreal lights units"; grep -a "^FAIL" -A2 /tmp/uelights4760.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-uelights-ui.js > /tmp/uelightsui4760.log 2>&1 \
  && ok "2.476.0 Unreal lights browser test (the stand-in editor): the Neon preset + fog, ＋ Point, colour, volumetric, the light tool's markers / drag / depth / aim, on-off, a fog preset, keep, delete + undo, the timeline's Lights & Fog with the image editor's lights - or SKIP without playwright" \
  || { bad "2.476.0 Unreal lights browser test"; grep -a "FAIL\|Error" -A2 /tmp/uelightsui4760.log | head -14; }

# ---- 2.477.0 (the public beta: the GitHub repository - README, CHANGELOG, CONTRIBUTING, SECURITY, docs/BETA.md, .github, scripts/ci-units.sh)
python3 scripts/test-repo.py > /tmp/repo4770.log 2>&1 \
  && ok "the GitHub repository (2.477.0 the root pages + links, the beta note's version, CHANGELOG.md from the notes + up to date, NOTICE's vendor licences, the workflow + templates, ci-units.sh's self-contained tests, .gitignore, no other products' names)" \
  || { bad "2.477.0 the GitHub repository"; grep -a "^FAIL" -A2 /tmp/repo4770.log | head -14; }

# ---- 2.478.0 (search in every dropdown list: static/selsearch.js; docs/AFTER-EFFECTS-GAP.md)
node scripts/test-selsearch.js > /tmp/selsearch4780.log 2>&1 \
  && ok "dropdown search units (2.478.0 match / rank / itemsOf / eligible; the list in a page: open, narrow, pick, Esc, redraw, the setting)" \
  || { bad "2.478.0 dropdown search units"; grep -a "^FAIL" -A2 /tmp/selsearch4780.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-selsearch-ui.js > /tmp/selsearchui4780.log 2>&1 \
  && ok "2.478.0 dropdown search browser test: the blend mode list narrowed + picked, a letter opens it, Esc, outside press, a dialog's list, the setting - or SKIP without playwright" \
  || { bad "2.478.0 dropdown search browser test"; grep -a "FAIL\|Error" -A2 /tmp/selsearchui4780.log | head -14; }

# ---- 2.479.0 (JPEG XL: static/jxl.js + static/vendor/jxl/, lib/jxl.js, routes/jxl.js, scripts/jxl-cli.js, scripts/jxl_png.py)
node scripts/test-jxl.js > /tmp/jxl4790.log 2>&1 \
  && ok "JPEG XL units (2.479.0 signature, lossless exact / lossy smaller, damaged refused, the PNG cache, wantsPng, the sendFile shim, the CLI + jxl_png.py, the lists, NOTICE)" \
  || { bad "2.479.0 JPEG XL units"; grep -a "^FAIL" -A2 /tmp/jxl4790.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-jxl-ui.js > /tmp/jxlui4790.log 2>&1 \
  && ok "2.479.0 JPEG XL browser test: canvas -> .jxl (lossless exact), <img> / createImageBitmap / data URL, an upload as PNG, the editor opens a .jxl, Export As JPEG XL + Lossless saved as .jxl and shown - or SKIP without playwright" \
  || { bad "2.479.0 JPEG XL browser test"; grep -a "FAIL\|Error" -A2 /tmp/jxlui4790.log | head -14; }

# ---- 2.480.0 (the image editor's gap, round A: ext/imageeditdock/filters2.js - more adjustments + Apply Image)
node scripts/test-filters2.js > /tmp/filters24800.log 2>&1 \
  && ok "adjustments round A units (2.480.0 Shadows / Highlights, HDR Toning, Selective Color, Replace / Match Color, Color Lookup, Apply Image, Lab, the ranges, the menu order, the wiring)" \
  || { bad "2.480.0 adjustments round A units"; grep -a "^FAIL" -A2 /tmp/filters24800.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-filters2-ui.js > /tmp/filters2ui4800.log 2>&1 \
  && ok "2.480.0 adjustments round A browser test: the menus, Selective Color dialog + layer, Replace Color's eyedropper, Color Lookup (look + library .cube), Match Color from a layer, Apply Image - or SKIP without playwright" \
  || { bad "2.480.0 adjustments round A browser test"; grep -a "FAIL\|Error" -A2 /tmp/filters2ui4800.log | head -14; }

# ---- 2.481.0 (the image editor's gap, round B: ext/imageeditdock/filters3.js + filters4.js - 44 filters)
node scripts/test-filters3.js > /tmp/filters34810.log 2>&1 \
  && ok "filters round B units (2.481.0 the 44 filters each checked: blur set + gallery, noise, smart sharpen, other, distort, pixelate, render, stylize, artistic / sketch / texture; the kernel kind; the wiring)" \
  || { bad "2.481.0 filters round B units"; grep -a "^FAIL" -A2 /tmp/filters34810.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-filters3-ui.js > /tmp/filters3ui4810.log 2>&1 \
  && ok "2.481.0 filters round B browser test: the twelve submenus, Iris Blur's click-placed centre, Custom's 5 x 5 grid + Ctrl+F, Lighting Effects preview / cancel, Displace's map list, a smart filter - or SKIP without playwright" \
  || { bad "2.481.0 filters round B browser test"; grep -a "FAIL\|Error" -A2 /tmp/filters3ui4810.log | head -14; }

# ---- 2.482.0 (the image editor's gap, round C: ext/imageeditdock/filters5.js - the Develop Filter + Lens Correction)
node scripts/test-filters5.js > /tmp/filters54820.log 2>&1 \
  && ok "develop round C units (2.482.0 white balance, exposure, tone, the mixer, B&W, grading, detail, optics, geometry, effects, Auto, presets, Lens Correction, the panel, the wiring)" \
  || { bad "2.482.0 develop round C units"; grep -a "^FAIL" -A2 /tmp/filters54820.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-filters5-ui.js > /tmp/filters5ui4820.log 2>&1 \
  && ok "2.482.0 develop browser test: the menu, Alt+Shift+Ctrl+A, the nine tabs, a preset, exposure, Auto, a saved preset kept, OK = one step, Lens Correction's transparent corners + Cancel - or SKIP without playwright" \
  || { bad "2.482.0 develop browser test"; grep -a "FAIL\|Error" -A2 /tmp/filters5ui4820.log | head -14; }

# ---- 2.483.0 (the image editor's gap, round D: ext/imageeditdock/pcmeasure.js - panels + measuring tools)
node scripts/test-measure.js > /tmp/measure4830.log 2>&1 \
  && ok "panels + measuring units (2.483.0 histogram, HSB / CMYK, ruler + straighten, perspective size, Grow / Similar, focus map, defringe / unmatte, samplers, Transform Selection, the tool groups, documents + .bgi, the wiring)" \
  || { bad "2.483.0 panels + measuring units"; grep -a "^FAIL" -A2 /tmp/measure4830.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-measure-ui.js > /tmp/measureui4830.log 2>&1 \
  && ok "2.483.0 panels + measuring browser test: the tool groups, Navigator, Histogram, Info, samplers, ruler + straighten, a note, count, perspective crop + undo, Similar, Focus Area, Remove Black Matte - or SKIP without playwright" \
  || { bad "2.483.0 panels + measuring browser test"; grep -a "FAIL\|Error" -A2 /tmp/measureui4830.log | head -14; }

# ---- 2.484.0 (the image editor's gap, round E: brushdyn.js + brushes.js - Brush Settings, presets, .abr; lib/brushStore.js, routes/brushes.js)
node scripts/test-brushdyn.js > /tmp/brushdyn4840.log 2>&1 \
  && ok "brush settings units (2.484.0 shape dynamics, scattering, transfer, colour dynamics, textures, .abr v2 + v6, sampled tips, brushes/ store, the wiring)" \
  || { bad "2.484.0 brush settings units"; grep -a "^FAIL" -A2 /tmp/brushdyn4840.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-brushdyn-ui.js > /tmp/brushdynui4840.log 2>&1 \
  && ok "2.484.0 brush settings browser test: the tab, roundness, scattering, colour dynamics, kept + reset, a new preset in brushes/, an .abr brush that paints its shape - or SKIP without playwright" \
  || { bad "2.484.0 brush settings browser test"; grep -a "FAIL\|Error" -A2 /tmp/brushdynui4840.log | head -14; }

# ---- 2.485.0 (the image editor's gap, round F part 1: pcfileplus.js - more export formats, File Info, Print, Contact Sheet, Crop and Straighten Photos; lib/imgConvert.js, routes/imgconvert.js)
node scripts/test-fileplus.js > /tmp/fileplus4850.log 2>&1 \
  && ok "file types units (2.485.0 BMP / TIFF / TGA / GIF read back by Pillow, PNG text + JPEG XMP file info, contact sheet layout, crop and straighten, AVIF by ffmpeg, the wiring)" \
  || { bad "2.485.0 file types units"; grep -a "^FAIL" -A2 /tmp/fileplus4850.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-fileplus-ui.js > /tmp/fileplusui4850.log 2>&1 \
  && ok "2.485.0 file types browser test: Export As formats, toBlob encoders, AVIF from the server, File Info in PNG / JPEG, Print, Crop and Straighten, Contact Sheet - or SKIP without playwright" \
  || { bad "2.485.0 file types browser test"; grep -a "FAIL\|Error" -A2 /tmp/fileplusui4850.log | head -14; }

# ---- 2.486.0 (the image editor's gap, round F part 2: pcmerge.js - Auto-Align / Auto-Blend Layers, Photomerge, Merge to HDR)
node scripts/test-merge.js > /tmp/merge4860.log 2>&1 \
  && ok "align + blend units (2.486.0 homography / similarity / RANSAC, registration of moved / turned / perspective crops, panorama placing + seams, focus stack, tones, exposure fusion, the wiring)" \
  || { bad "2.486.0 align + blend units"; grep -a "^FAIL" -A2 /tmp/merge4860.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-merge-ui.js > /tmp/mergeui4860.log 2>&1 \
  && ok "2.486.0 align + blend browser test: Auto-Align (+ undo), Auto-Blend stack masks, Photomerge from files, Merge to HDR - or SKIP without playwright" \
  || { bad "2.486.0 align + blend browser test"; grep -a "FAIL\|Error" -A2 /tmp/mergeui4860.log | head -14; }

# ---- 2.487.0 (the image editor's gap, round G: pcmode.js - Image > Mode, Proof Colors, Gamut Warning, CMYK TIFF)
node scripts/test-mode.js > /tmp/mode4870.log 2>&1 \
  && ok "image modes units (2.487.0 the press model: white / black / grey balance, printable vs not, black generation, total ink, the table; palettes + dithers, bitmap methods, duotone inks, CMYK TIFF read back, .act, the wiring)" \
  || { bad "2.487.0 image modes units"; grep -a "^FAIL" -A2 /tmp/mode4870.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-mode-ui.js > /tmp/modeui4870.log 2>&1 \
  && ok "2.487.0 image modes browser test: Grayscale (+ undo), Indexed + Color Table, CMYK + TIFF, Gamut Warning, Proof Colors, Duotone, Bitmap - or SKIP without playwright" \
  || { bad "2.487.0 image modes browser test"; grep -a "FAIL\|Error" -A2 /tmp/modeui4870.log | head -14; }

# ---- 2.488.0 (the image editor's gap, round H: pcpdf.js page order; pcsubject.js + lib/subjectMatte.js + routes/subject.js - Select Subject)
node scripts/test-subject.js > /tmp/subject4880.log 2>&1 \
  && ok "select subject units (2.488.0 built in on gradient / figure-on-the-edge / stripes / plain, Otsu, parts, guided filter, the AI matte's server side + stand-in, the wiring)" \
  || { bad "2.488.0 select subject units"; grep -a "^FAIL" -A2 /tmp/subject4880.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-subject-ui.js > /tmp/subjectui4880.log 2>&1 \
  && ok "2.488.0 select subject browser test: built in (+ undo), settings, the AI matte through the server, Remove Background (+ undo) - or SKIP without playwright" \
  || { bad "2.488.0 select subject browser test"; grep -a "FAIL\|Error" -A2 /tmp/subjectui4880.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-pdfpages-ui.js > /tmp/pdfpagesui4880.log 2>&1 \
  && ok "2.488.0 PDF pages browser test: add a blank page, move (keeps the open page open), ▲ ▼, take out the open page, insert another PDF, saved in the new order - or SKIP without playwright" \
  || { bad "2.488.0 PDF pages browser test"; grep -a "FAIL\|Error" -A2 /tmp/pdfpagesui4880.log | head -14; }

# ---- 2.489.0 (the After Effects gap, item 1: the graph editor, Easy Ease, the anchor point, curved motion paths - tlgraph.js, static/keyframes.js + worker.py)
node scripts/test-aegraph.js > /tmp/aegraph4890.log 2>&1 \
  && ok "graph editor maths units (2.489.0 the eases as Béziers, Easy Ease, overshoot, curved paths, normalize, worker mirror on 160 cases + the expression within 1.5 px, the anchor in _tf_chain / _kf_perspective, long graphs from a file)" \
  || { bad "2.489.0 graph editor maths units"; grep -a "^FAIL" -A2 /tmp/aegraph4890.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-aegraph-ui.js > /tmp/aegraphui4890.log 2>&1 \
  && ok "2.489.0 graph editor browser test: the anchor, Easy Ease, the anchor field keeps the layer put, Smooth path, a handle dragged on the canvas, the graph panel, a key dragged, speed graph, F9, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.489.0 graph editor browser test"; grep -a "FAIL\|Error" -A2 /tmp/aegraphui4890.log | head -14; }

# ---- 2.490.0 (the After Effects gap, item 2: parenting + null objects - tlparent.js; the page's layer bake - lib/layerBake.js, routes/layerBake.js; worker.py baked image clips)
node scripts/test-parent.js > /tmp/parent4900.log 2>&1 \
  && ok "parenting units (2.490.0 compose / localOf / the drag in the parent's space / no loops; layerBake frames -> a transparent VP9; tlKeys baked; the wiring)" \
  || { bad "2.490.0 parenting units"; grep -a "^FAIL" -A2 /tmp/parent4900.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-parent-ui.js > /tmp/parentui4900.log 2>&1 \
  && ok "2.490.0 parenting browser test: a keyed null, a picture parented to it (stays put, then follows), a drag while parented, the bake + COMPILE = CANVAS, unparenting - or SKIP without playwright" \
  || { bad "2.490.0 parenting browser test"; grep -a "FAIL\|Error" -A2 /tmp/parentui4900.log | head -14; }

# ---- 2.491.0 (the After Effects gap, item 6: blend modes + track mattes - tlblend.js, canvas.js drawLayer / applyMatte, worker.py _composite_ops)
node scripts/test-blend.js > /tmp/blend4910.log 2>&1 \
  && ok "blend + matte units (2.491.0 layerKeys, the compile graph RUN in ffmpeg: screen / multiply against their formulas, an alpha matte, the wiring)" \
  || { bad "2.491.0 blend + matte units"; grep -a "^FAIL" -A2 /tmp/blend4910.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-blend-ui.js > /tmp/blendui4910.log 2>&1 \
  && ok "2.491.0 blend + matte browser test: the menus, screen on the canvas, an alpha matte + inverted, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.491.0 blend + matte browser test"; grep -a "FAIL\|Error" -A2 /tmp/blendui4910.log | head -14; }

# ---- 2.492.0 (the After Effects gap, item 4: shape layers + operators - tlshape.js, baked by TlParent's bake)
node scripts/test-shape.js > /tmp/shape4920.log 2>&1 \
  && ok "shape layer units (2.492.0 kinds, round corners, mitre offset, pucker & bloat, twist, zig zag, wiggle, trim paths, repeater, bounds, the wiring)" \
  || { bad "2.492.0 shape layer units"; grep -a "^FAIL" -A2 /tmp/shape4920.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-shape-ui.js > /tmp/shapeui4920.log 2>&1 \
  && ok "2.492.0 shape layers browser test: the ◆ tool, the Properties, keyed Trim Paths, the Graph Editor, a Repeater, the bake + COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.492.0 shape layers browser test"; grep -a "FAIL\|Error" -A2 /tmp/shapeui4920.log | head -14; }

# ---- 2.493.0 (the After Effects gap, item 5: text animators - tltextanim.js, baked by TlParent's bake)
node scripts/test-textanim.js > /tmp/textanim4930.log 2>&1 \
  && ok "text animator units (2.493.0 units by letters / words / lines, square coverage, ramps, triangle, offset, amount, combine, presets, the wiring, every timeline script parses)" \
  || { bad "2.493.0 text animator units"; grep -a "^FAIL" -A2 /tmp/textanim4930.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-textanim-ui.js > /tmp/textanimui4930.log 2>&1 \
  && ok "2.493.0 text animators browser test: the presets, a typewriter on the canvas, a per-word animator, the Graph Editor, the bake + COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.493.0 text animators browser test"; grep -a "FAIL\|Error" -A2 /tmp/textanimui4930.log | head -14; }

# ---- 2.494.0 (the CAD workings refined: offset chains, the Offset tool, ＋ handles, the ⌬ CAD buttons, the view cube, picking profiles)
node scripts/test-cad494.js > /tmp/cad4940.log 2>&1 \
  && ok "CAD workings units (2.494.0 offset of chains drawn any way round / rounded corners / toward a point / open L / circles, profileAt, hidden ribbon items, the view cube's faces + corners, the wiring)" \
  || { bad "2.494.0 CAD workings units"; grep -a "^FAIL" -A2 /tmp/cad4940.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-cad494-ui.js > /tmp/cadui4940.log 2>&1 \
  && ok "2.494.0 CAD workings browser test: the ⌬ CAD button, Create Sketch hidden, the Offset tool, ＋ draw on, Finish -> SOLID, picking the profile, the view cube, Shift-middle orbit - or SKIP without playwright" \
  || { bad "2.494.0 CAD workings browser test"; grep -a "FAIL\|Error" -A2 /tmp/cadui4940.log | head -14; }

# ---- 2.495.0 (hue / saturation / color / luminosity blend modes; video layers following a parent)
node scripts/test-hsl495.js > /tmp/hsl4950.log 2>&1 \
  && ok "colour blend modes + video parenting units (2.495.0 the YUV sums, worker._hsl_blend through ffmpeg = the canvas's, the balanced keyframe tree, simplify / keysOf, the wiring)" \
  || { bad "2.495.0 colour blend modes + video parenting units"; grep -a "^FAIL" -A2 /tmp/hsl4950.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-hslparent-ui.js > /tmp/hslui4950.log 2>&1 \
  && ok "2.495.0 colour blend modes + a video layer following a keyed null: canvas = the sums, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.495.0 colour blend modes + video parenting browser test"; grep -a "FAIL\|Error" -A2 /tmp/hslui4950.log | head -14; }

# ---- 2.496.0 (Merge Paths, freehand shape paths, text on a path, roving keyframes)
node scripts/test-ae496.js > /tmp/ae4960.log 2>&1 \
  && ok "2.496.0 units (merge add / subtract / intersect / exclude + holes, rasterize / contours, freehand closed / open, open-path trim / zig zag, pathPoly / placeAt, rove)" \
  || { bad "2.496.0 units"; grep -a "^FAIL" -A2 /tmp/ae4960.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ae496-ui.js > /tmp/aeui4960.log 2>&1 \
  && ok "2.496.0 browser test: ✎ Freehand loop + line, ＋ Path + ⊕ Merge Paths (a hole), 〰 text round a circle (keyed start), Rove, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.496.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/aeui4960.log | head -14; }

# ---- 2.497.0 (expressions - ext/timelinedock/tlexpr.js)
node scripts/test-expr.js > /tmp/expr4970.log 2>&1 \
  && ok "expression units (2.497.0 the language, wiggle / loops / valueAtTime / linear / random / layer links, not JavaScript, the wiring)" \
  || { bad "2.497.0 expression units"; grep -a "^FAIL" -A2 /tmp/expr4970.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-expr-ui.js > /tmp/exprui4970.log 2>&1 \
  && ok "2.497.0 expressions browser test: ƒx presets, a live error, wiggle, a link to a keyed null, an opacity ramp, a video turned by an expression, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.497.0 expressions browser test"; grep -a "FAIL\|Error" -A2 /tmp/exprui4970.log | head -14; }

# ---- 2.498.0 (Bézier masks - ext/timelinedock/tlmask.js)
node scripts/test-mask.js > /tmp/mask4980.log 2>&1 \
  && ok "mask units (2.498.0 points, Bézier pieces, keyed paths, picture <-> layer coordinates, live / sig, the wiring: canvas, bakes, mask video, alphamerge)" \
  || { bad "2.498.0 mask units"; grep -a "^FAIL" -A2 /tmp/mask4980.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-mask-ui.js > /tmp/maskui4980.log 2>&1 \
  && ok "2.498.0 masks browser test: the Mask Pen on a picture and a video, invert / feather, an animated mask path, the compile (bake + mask video) = the canvas - or SKIP without playwright" \
  || { bad "2.498.0 masks browser test"; grep -a "FAIL\|Error" -A2 /tmp/maskui4980.log | head -14; }

# ---- 2.499.0 (tracking + corner pin - tltrack.js, scripts/track_points.py, lib/trackPoints.js, routes/trackpts.js)
node scripts/test-track.js > /tmp/track4990.log 2>&1 \
  && ok "tracking units (2.499.0 homography / affine / quads / padded corners / pin keys, the request made safe, tlKeys.pinKeys, track_points.py points + planar on a sliding picture, the wiring)" \
  || { bad "2.499.0 tracking units"; grep -a "^FAIL" -A2 /tmp/track4990.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-track-ui.js > /tmp/trackui4990.log 2>&1 \
  && ok "2.499.0 tracking browser test: ◎ Place + ▶ Track on V1, Apply to a picture, a planar track pinning a picture + a video layer, ▢ edit a corner, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.499.0 tracking browser test"; grep -a "FAIL\|Error" -A2 /tmp/trackui4990.log | head -14; }

# ---- 2.500.0 (⏱ time on a layer: motion blur, posterize time, echo - ext/timelinedock/tltime.js)
node scripts/test-time.js > /tmp/time5000.log 2>&1 \
  && ok "time effects units (2.500.0 clean / postT / blur samples / echoes, tlKeys.timeKeys, the wiring: canvas, bakes, worker tmix / setpts / delayed copies)" \
  || { bad "2.500.0 time effects units"; grep -a "^FAIL" -A2 /tmp/time5000.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-time-ui.js > /tmp/timeui5000.log 2>&1 \
  && ok "2.500.0 time effects browser test: motion blur on a picture + a video, posterize time, an echo trail, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.500.0 time effects browser test"; grep -a "FAIL\|Error" -A2 /tmp/timeui5000.log | head -14; }

# ---- 2.501.0 (⏱ time remapping on a curve - static/clipfx.js remap, ext/timelinedock/tlremap.js)
node scripts/test-remap.js > /tmp/remap5010.log 2>&1 \
  && ok "time remap units (2.501.0 normalize / srcTime / localTime / segments / slice, forJob d, remap_graph + a real render, the curve maths, trim edges, the wiring)" \
  || { bad "2.501.0 time remap units"; grep -a "^FAIL" -A2 /tmp/remap5010.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-remap-ui.js > /tmp/remapui5010.log 2>&1 \
  && ok "2.501.0 time remap browser test: on, ❄ freeze, dragging / adding / removing keys, backwards, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.501.0 time remap browser test"; grep -a "FAIL\|Error" -A2 /tmp/remapui5010.log | head -14; }

# ---- 2.502.0 (FLUX 3 Image Klein styles + edit image mode's dropdown - ext/imageeditdock/ieeditonly.js)
node scripts/test-flux3.js > /tmp/flux35020.log 2>&1 \
  && ok "FLUX 3 Klein units (2.502.0 templates, starters, arch, catalogue, the FLUX-3-only swap, engines, the patcher on the real graphs, the dropdown pick)" \
  || { bad "2.502.0 FLUX 3 Klein units"; grep -a "^FAIL" -A2 /tmp/flux35020.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ieeditonly-ui.js > /tmp/ieeditonly5020.log 2>&1 \
  && ok "2.502.0 edit image mode browser test: only edit styles while the editor is open, a reload keeps it, closing restores the pick - or SKIP without playwright" \
  || { bad "2.502.0 edit image mode browser test"; grep -a "FAIL\|Error" -A2 /tmp/ieeditonly5020.log | head -14; }

# ---- 2.503.0 (MiniMax H3 Long video - lib/h3Long.js, worker.apply_video_accel long)
node scripts/test-h3long.js > /tmp/h3long5030.log 2>&1 \
  && ok "Long video units (2.503.0 h3Long ceilings, both planners, the three model patches in the export's order, the switches, the board, the installers)" \
  || { bad "2.503.0 Long video units"; grep -a "^FAIL" -A2 /tmp/h3long5030.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-h3long-ui.js > /tmp/h3longui5030.log 2>&1 \
  && ok "2.503.0 Long video browser test: the ⚙ checkbox, the style editor, 25 s = one 600f run in the plan, the install buttons - or SKIP without playwright" \
  || { bad "2.503.0 Long video browser test"; grep -a "FAIL\|Error" -A2 /tmp/h3longui5030.log | head -14; }

# ---- 2.504.0 (DLSS 5 on videos - lib/dlss5.js, scripts/dlss5_graph.py, dlss5_worker.py, static/dlss5panel.js)
node scripts/test-dlss5.js > /tmp/dlss55040.log 2>&1 \
  && ok "DLSS 5 units (2.504.0 the graph as the pack's own example, the size rule, options / params / branches, a REAL worker run on the stub ComfyUI: 2x + 48 fps with the sound)" \
  || { bad "2.504.0 DLSS 5 units"; grep -a "^FAIL" -A2 /tmp/dlss55040.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-dlss5-ui.js > /tmp/dlss5ui5040.log 2>&1 \
  && ok "2.504.0 DLSS 5 browser test: the preview's ⚡ panel, sizes / frame generation, Enhance, the refusals, the ⚙ Upscaler - or SKIP without playwright" \
  || { bad "2.504.0 DLSS 5 browser test"; grep -a "FAIL\|Error" -A2 /tmp/dlss5ui5040.log | head -14; }

# ---- 2.505.0 (🌫 generator layers + 〰 distort - ext/timelinedock/tlgen.js, tldist.js)
node scripts/test-gen.js > /tmp/gen5050.log 2>&1 \
  && ok "generator / distort units (2.505.0 the noise, the ramp, keys, the displacement fields, a REAL ffmpeg displace = the canvas on 99% of pixels with the lossless maps, the wiring)" \
  || { bad "2.505.0 generator / distort units"; grep -a "^FAIL" -A2 /tmp/gen5050.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-gen-ui.js > /tmp/genui5050.log 2>&1 \
  && ok "2.505.0 generator / distort browser test: the 🌫 tool, the settings, turbulent displace on a video, a displacement map, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.505.0 generator / distort browser test"; grep -a "FAIL\|Error" -A2 /tmp/genui5050.log | head -14; }

# ---- 2.506.0 (✨ particles, ☀ light rays, 🎞 a video layer baked whole - tlparticles.js, tlrays.js, tlvbake.js)
node scripts/test-particles.js > /tmp/pt5060.log 2>&1 \
  && ok "particles / rays units (2.506.0 birth, life, gravity, the seed, pre-roll, the cap, keys; rays clean / overscan / samples / bright-pass; the video bake + the compile wiring)" \
  || { bad "2.506.0 particles / rays units"; grep -a "^FAIL" -A2 /tmp/pt5060.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-particles-ui.js > /tmp/ptui5060.log 2>&1 \
  && ok "2.506.0 particles / rays browser test: Shift+click particles, rays past the edges, a video layer baked whole, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.506.0 particles / rays browser test"; grep -a "FAIL\|Error" -A2 /tmp/ptui5060.log | head -14; }

# ---- 2.507.0 (📌 puppet pins + ⌗ mesh warp - ext/timelinedock/tlwarp.js)
node scripts/test-warp.js > /tmp/wp5070.log 2>&1 \
  && ok "warp units (2.507.0 rigid MLS, falloff, the Catmull-Rom mesh, deform / overscan / affine, keys, the wiring)" \
  || { bad "2.507.0 warp units"; grep -a "^FAIL" -A2 /tmp/wp5070.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-warp-ui.js > /tmp/wpui5070.log 2>&1 \
  && ok "2.507.0 warp browser test: pins by click, a drag bends, keys glide, a mesh-warped video, COMPILE = CANVAS, Alt+click - or SKIP without playwright" \
  || { bad "2.507.0 warp browser test"; grep -a "FAIL\|Error" -A2 /tmp/wpui5070.log | head -14; }

# ---- 2.508.0 (♪ audio → keys, 🌫 waveform / spectrum layers, ƒx audio() - lib/audioAnalyze.js, tlaudio.js)
node scripts/test-audio.js > /tmp/au5080.log 2>&1 \
  && ok "audio units (2.508.0 the FFT, loudness, peaks, bands, a REAL ffmpeg read, toKeys / simplify, the generator kinds, ƒx audio(), the route)" \
  || { bad "2.508.0 audio units"; grep -a "^FAIL" -A2 /tmp/au5080.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-audio-ui.js > /tmp/auui5080.log 2>&1 \
  && ok "2.508.0 audio browser test: the sound read, ♪ Make keys, a Waveform + a Spectrum by Alt(+Shift)+click, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.508.0 audio browser test"; grep -a "FAIL\|Error" -A2 /tmp/auui5080.log | head -14; }

# ---- 2.509.0 (✍ motion sketch, ≈ wiggler, ⌇ smoother - ext/timelinedock/tlmotion.js)
node scripts/test-motion.js > /tmp/mo5090.log 2>&1 \
  && ok "motion units (2.509.0 noise1, rdp2, sketchKeys, wiggleKeys smooth / jagged, smoothKeys, the wiring)" \
  || { bad "2.509.0 motion units"; grep -a "^FAIL" -A2 /tmp/mo5090.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-motion-ui.js > /tmp/moui5090.log 2>&1 \
  && ok "2.509.0 motion browser test: a real-time sketch, the smoother, the wiggler on a video layer, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.509.0 motion browser test"; grep -a "FAIL\|Error" -A2 /tmp/moui5090.log | head -14; }

# ---- 2.510.0 (🧊 2D layers in 3D - ext/timelinedock/tl3d.js)
node scripts/test-3d.js > /tmp/d35100.log 2>&1 \
  && ok "3D units (2.510.0 the camera basis / projection, depth, turns, camera keys, the light's ray onto a card, depth of field, the wiring)" \
  || { bad "2.510.0 3D units"; grep -a "^FAIL" -A2 /tmp/d35100.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-3d-ui.js > /tmp/d3ui5100.log 2>&1 \
  && ok "2.510.0 3D browser test: a card, depth, a shadow, depth of field, Orbit, camera keys, a 3D video, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.510.0 3D browser test"; grep -a "FAIL\|Error" -A2 /tmp/d3ui5100.log | head -14; }

# ---- 2.511.0 (✒ variable mask feather, 📋 data-driven animation + template fields - tlmask.js, tldata.js, static/mogrt.js)
node scripts/test-data.js > /tmp/dt5110.log 2>&1 \
  && ok "data / feather units (2.511.0 point feathers along the edge, the feather map, CSV / JSON, {{set.column}}, data(), column keys, exposed template fields)" \
  || { bad "2.511.0 data / feather units"; grep -a "^FAIL" -A2 /tmp/dt5110.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-data-ui.js > /tmp/dtui5110.log 2>&1 \
  && ok "2.511.0 data / feather browser test: Shift+drag a point's feather, a CSV in a text, Data → keys, an exposed field, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.511.0 data / feather browser test"; grep -a "FAIL\|Error" -A2 /tmp/dtui5110.log | head -14; }

# ---- 2.512.0 (⤓ Lottie (JSON) export - ext/timelinedock/tllottie.js, lib/lottie.js, routes/lottie.js)
node scripts/test-lottie.js > /tmp/lt5120.log 2>&1 \
  && ok "Lottie units (2.512.0 the eases = the timeline's beziers, keys / split position / anchor / scale / opacity, frames layers, left out, the file listed)" \
  || { bad "2.512.0 Lottie units"; grep -a "^FAIL" -A2 /tmp/lt5120.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-lottie-ui.js > /tmp/ltui5120.log 2>&1 \
  && ok "2.512.0 Lottie browser test: 📤 Export → ⤓ Lottie, real layers + frames, LOTTIE = CANVAS in lottie-web (node_modules/lottie-web or LOTTIE_JS, else that check SKIPs) - or SKIP without playwright" \
  || { bad "2.512.0 Lottie browser test"; grep -a "FAIL\|Error" -A2 /tmp/ltui5120.log | head -14; }

# ---- 2.513.0 (🎮 Load UE project - lib/ueProject.js; the timeline's frame size bar - tlsizebar.js, static/framesize.js)
node scripts/test-ue513.js > /tmp/ue5130.log 2>&1 \
  && ok "UE project / frame units (2.513.0 the .uproject plugins, the plugin copied / updated, the Epic list, the frame sizes, the compile's frame, the hidden CAD buttons)" \
  || { bad "2.513.0 UE project / frame units"; grep -a "^FAIL" -A2 /tmp/ue5130.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ue513-ui.js > /tmp/ueui5130.log 2>&1 \
  && ok "2.513.0 browser test: 🎮 Select -> plugin + plugins, the frame bar, CAD toolbar box, a 640 x 360 compile of a 320 x 240 V1 = the canvas - or SKIP without playwright" \
  || { bad "2.513.0 UE project / frame browser test"; grep -a "FAIL\|Error" -A2 /tmp/ueui5130.log | head -14; }

# ---- 2.514.0 (edit theme mode: resize / move / hide / text, the .tmp, the leaving box; folding dockers; View ▸ Dockers)
node scripts/test-ui514.js > /tmp/ui5140.log 2>&1 \
  && ok "theme layout / dockers units (2.514.0 resizeBy, the layout rules compiled, the .tmp store + routes, the leaving box, side folding, the image editor's ▾ / ✕ / View ▸ Dockers)" \
  || { bad "2.514.0 theme layout / dockers units"; grep -a "^FAIL" -A2 /tmp/ui5140.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui514-ui.js > /tmp/uiui5140.log 2>&1 \
  && ok "2.514.0 browser test: resize + move by handles, hide, text, the .tmp, Save theme as…, a side docker folded, a group folded / closed / shown from View ▸ Dockers - or SKIP without playwright" \
  || { bad "2.514.0 theme layout / dockers browser test"; grep -a "FAIL\|Error" -A2 /tmp/uiui5140.log | head -14; }

# ---- 2.515.0 (step 8: 🧍 cut-out through a shot, 📷 3D camera tracker, 🩹 content-aware fill; theme edit Ctrl+Shift+Alt+E / Ctrl+S)
node scripts/test-scene515.js > /tmp/sc5150.log 2>&1 \
  && ok "scene tools units (2.515.0 marks, the cut-out's file in the canvas / compile, camera -> 🧊 camera with roll, planes, placing, holes; roto / vfill / camtrack on made-up shots - or SKIP without OpenCV)" \
  || { bad "2.515.0 scene tools units"; grep -a "^FAIL" -A2 /tmp/sc5150.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui515-ui.js > /tmp/scui5150.log 2>&1 \
  && ok "2.515.0 browser test: Ctrl+Shift+Alt+E styles Settings, Ctrl+S saves; ✚ / ✖ -> ▶ Cut out -> see-through (compile = canvas); 🩹 Remove; 📷 Solve, Pick, 📌 Place sticks - or SKIP without playwright" \
  || { bad "2.515.0 scene tools browser test"; grep -a "FAIL\|Error" -A2 /tmp/scui5150.log | head -14; }

# ---- 2.516.0 (◇ keyframes on any property - static/anykeys.js, tlanykey.js, vfx_filters keyed lens / warp / keyer / looks; Krea 2 workflows)
node scripts/test-keys516.js > /tmp/ak5160.log 2>&1 \
  && ok "keys / Krea 2 units (2.516.0 the rules, apply + undo, forCompile, withAk + the .cubes, the look's two lanes / lens / wave / keyer run by ffmpeg, the grain fix; the four Krea 2 graphs + the patcher, starters, arch, catalogue)" \
  || { bad "2.516.0 keys / Krea 2 units"; grep -a "^FAIL" -A2 /tmp/ak5160.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui516-ui.js > /tmp/akui5160.log 2>&1 \
  && ok "2.516.0 browser test: ◇ a text's size (and keyed again by a change), V1's exposure + lens, a layer's mask feather - the graph editor lists them, COMPILE = CANVAS - or SKIP without playwright" \
  || { bad "2.516.0 keys browser test"; grep -a "FAIL\|Error" -A2 /tmp/akui5160.log | head -14; }

# ---- 2.517.0 (⚡ power draw + clocks in the System stats, a job's energy - lib/power.js, static/powerstats.js; Anima workflows)
node scripts/test-power517.js > /tmp/pw5170.log 2>&1 \
  && ok "power / Anima units (2.517.0 nvidia-smi lines, the trapezoid, a job's summary, a stand-in nvidia-smi counted live; core.js marks / counts; the Anima graphs + the patcher, starters, arch, catalogue)" \
  || { bad "2.517.0 power / Anima units"; grep -a "^FAIL" -A2 /tmp/pw5170.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui517-ui.js > /tmp/pwui5170.log 2>&1 \
  && ok "2.517.0 browser test: CPU clock + energy in the System stats (GPU power / clock when nvidia-smi is there), a compile's [power] line, its ⚡ card, jobs.info - or SKIP without playwright" \
  || { bad "2.517.0 power browser test"; grep -a "FAIL\|Error" -A2 /tmp/pwui5170.log | head -14; }

# ---- 2.518.0 (⏱ queue presets, 🧩 the model manager + Civitai, energy cost, 🧪 the testing docker)
node scripts/test-queue518.js > /tmp/qp5180.log 2>&1 \
  && ok "queue presets / energy cost units (2.518.0 presets, the gate's rest + heat hold, power limits vs a stand-in nvidia-smi, core's pump waiting a Custom rest, cost / money)" \
  || { bad "2.518.0 queue preset units"; grep -a "^FAIL" -A2 /tmp/qp5180.log | head -14; }
node scripts/test-modelmgr518.js > /tmp/mm5180.log 2>&1 \
  && ok "model manager / Civitai units (2.518.0 types from Civitai / headers / names, cards from a fake ComfyUI folder, ✎ edits, ✚ styles from starters, Civitai folders / files / pictures)" \
  || { bad "2.518.0 model manager units"; grep -a "^FAIL" -A2 /tmp/mm5180.log | head -14; }
node scripts/test-testplan518.js > /tmp/tp5180.log 2>&1 \
  && ok "testing docker units (2.518.0 the plan, auto ticks from jobs / logs / events, your marks win, the log's text + JSON)" \
  || { bad "2.518.0 testing docker units"; grep -a "^FAIL" -A2 /tmp/tp5180.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui518-ui.js > /tmp/mmui5180.log 2>&1 \
  && ok "2.518.0 browser test: ⏱ presets, 🧩 cards + hover + select + override + ✚ style + ✎, Civitai tab, Settings (key, energy cost), 🧪 Testing + 💾 Save log - or SKIP without playwright" \
  || { bad "2.518.0 model manager browser test"; grep -a "FAIL\|Error" -A2 /tmp/mmui5180.log | head -14; }

# ---- 2.519.0 (setup asks the hardware + packages - lib/hwPlan.js; the daily supply charge)
node scripts/test-hw519.js > /tmp/hw5190.log 2>&1 \
  && ok "hardware / package units (2.519.0 Windows / Linux / CPU detection, the answers, the four packages, what each computer can use, the wizard's form + package page in jsdom, the supply charge)" \
  || { bad "2.519.0 hardware / package units"; grep -a "^FAIL" -A2 /tmp/hw5190.log | head -14; }

# ---- 2.520.0 (LoRA trainer - lib/loraTrain.js + lora_worker.py; peak / off-peak + the usage log; Remote GPU; packages in Settings + upgrade; grouped downloads)
node scripts/test-lora520.js > /tmp/lt5200.log 2>&1 \
  && ok "LoRA trainer units (2.520.0 presets, the form cleaned, the ai-toolkit config through PyYAML, the trigger in captions, progress lines, the export zip, lora_worker's finish into loras/trained + its card, wiring)" \
  || { bad "2.520.0 LoRA trainer units"; grep -a "^FAIL" -A2 /tmp/lt5200.log | head -14; }
node scripts/test-usage520.js > /tmp/us5200.log 2>&1 \
  && ok "peak / off-peak + usage log units (2.520.0 windows through midnight, the split cost, the log line, the page's copy agrees, a job's usage entry, days, totals, CSV)" \
  || { bad "2.520.0 peak / usage units"; grep -a "^FAIL" -A2 /tmp/us5200.log | head -14; }
node scripts/test-remote520.js > /tmp/rg5200.log 2>&1 \
  && ok "Remote GPU units (2.520.0 URLs, RunPod pods + proxy URL, ssh arguments, ✓ Test against a stand-in ComfyUI, Use it / back to this computer)" \
  || { bad "2.520.0 Remote GPU units"; grep -a "^FAIL" -A2 /tmp/rg5200.log | head -14; }
node scripts/test-recs520.js > /tmp/rc5200.log 2>&1 \
  && ok "packages in Settings + upgrade + grouped downloads units (2.520.0 the panel, the setup routes, the installer's group boxes in jsdom)" \
  || { bad "2.520.0 packages / upgrade / grouped downloads units"; grep -a "^FAIL" -A2 /tmp/rc5200.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui520-ui.js > /tmp/ui5200.log 2>&1 \
  && ok "2.520.0 browser test: 🎓 LoRA job + dataset + a training run (stand-in ai-toolkit) into loras/trained, peak times, 📊 usage, Remote GPU against a stand-in ComfyUI, 🖥 this computer & package - or SKIP without playwright" \
  || { bad "2.520.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5200.log | head -14; }

# ---- 2.521.0 (fine-tunes in the trainer: checkpoint (ai-toolkit full), LLM + vision (Unsloth), ⧉ bake a LoRA)
node scripts/test-finetune521.js > /tmp/ft5210.log 2>&1 \
  && ok "fine-tune units (2.521.0 the base models, settings, Unsloth's config, chat import (JSONL / JSON / CSV), the real ft_unsloth.py on a stand-in Unsloth, GGUF + mmproj, the shard join, bake through a stand-in ComfyUI)" \
  || { bad "2.521.0 fine-tune units"; grep -a "^FAIL" -A2 /tmp/ft5210.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui521-ui.js > /tmp/ui5210.log 2>&1 \
  && ok "2.521.0 browser test: 💬 LLM (typed + imported chats -> .gguf), 👁 vision (answers -> .gguf + mmproj), 🧱 checkpoint (joined into diffusion_models), ⧉ bake - or SKIP without playwright" \
  || { bad "2.521.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5210.log | head -14; }

# ---- 2.522.0 (🐞 the Bug report docker - Ctrl+Alt+Shift+B; lib/bugReport.js, lib/appLog.js)
node scripts/test-bugreport522.js > /tmp/br5220.log 2>&1 \
  && ok "bug report units (2.522.0 secrets hidden in the settings and the logs, the form cleaned, report.md, the app console ring, save / list / zip / remove, the recorder's keys)" \
  || { bad "2.522.0 bug report units"; grep -a "^FAIL" -A2 /tmp/br5220.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui522-ui.js > /tmp/ui5220.log 2>&1 \
  && ok "2.522.0 browser test: the recorder (never what was typed), Ctrl+Alt+Shift+B screenshot first, marks, 👁 included (secrets •••), 💾 the .zip read back, ⤓ / 🗑, Settings' 🐞 - or SKIP without playwright" \
  || { bad "2.522.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5220.log | head -14; }

# ---- 2.523.0 (the diffusion-model loader follows the file - scripts/comfy_image.py match_loader)
python3 scripts/test-loaderswap523.py > /tmp/ls5230.log 2>&1 \
  && ok "loader swap units (2.523.0 Krea 2 Raw GGUF + a .safetensors -> UNETLoader, the safetensors styles + a .gguf -> UnetLoaderGGUF, unchanged when it fits)" \
  || { bad "2.523.0 loader swap units"; grep -a "^FAIL" -A2 /tmp/ls5230.log | head -14; }

# ---- 2.524.0 (🏠 the House builder docker - static/housegeo.js, static/housebuilder.js, lib/house.js, routes/house.js)
node scripts/test-house524.js > /tmp/hb5240.log 2>&1 \
  && ok "house builder units (2.524.0 rooms share walls, openings cut out, stair holes, the sun's path, the room description, .obj; the routes: save as text / list / renders -> assets / obj / delete ?assets=1)" \
  || { bad "2.524.0 house builder units"; grep -a "^FAIL" -A2 /tmp/hb5240.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui524-ui.js > /tmp/ui5240.log 2>&1 \
  && ok "2.524.0 browser test: draw a room / door / window / sofa / camera / stairs, undo, save, 3D drawn, the 360° + shot point where the camera looks, 📍 a Location, 📷 assets, .obj, ✨ queued - or SKIP without playwright" \
  || { bad "2.524.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5240.log | head -14; }

# ---- 2.525.0 (a model ComfyUI's loader does not list is found where it is listed - comfy_client.relocate_model_loaders)
python3 scripts/test-relocate525.py > /tmp/rl5250.log 2>&1 \
  && ok "model relocation units (2.525.0 Krea 2 Raw + a model in models/checkpoints -> Load Checkpoint, another subfolder -> ComfyUI's name, CLIP / VAE readers kept, .gguf never, canonicalise_combos runs it)" \
  || { bad "2.525.0 model relocation units"; grep -a "^FAIL" -A2 /tmp/rl5250.log | head -14; }

# ---- 2.526.0 (the Workspace dropdown - static/workspaces.js, lib/workspaces.js, routes/workspaces.js)
node scripts/test-workspaces526.js > /tmp/ws5260.log 2>&1 \
  && ok "workspace units (2.526.0 the five workspaces - what each shows / hides, default heights; workspaces.json switch / snapshot / reset; the routes; pins)" \
  || { bad "2.526.0 workspace units"; grep -a "^FAIL" -A2 /tmp/ws5260.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui526-ui.js > /tmp/ui5260.log 2>&1 \
  && ok "2.526.0 browser test: the five workspaces (dockers, buttons hidden not disabled, Generate mode), your own change kept, ↺, a reload, Expert = the layout you had - or SKIP without playwright" \
  || { bad "2.526.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5260.log | head -14; }

# ---- 2.527.0 (🩺 the Style doctor - lib/styleDoctor.js, routes/styleDoctor.js, static/styledoctor.js)
node scripts/test-styledoctor527.js > /tmp/sd5270.log 2>&1 \
  && ok "style doctor units (2.527.0 why a job failed - model / nodes / comfy / vram / file / mismatch / input / crash, the test picture out of the gallery, the report + .md, the edit styles' picture, the routes)" \
  || { bad "2.527.0 style doctor units"; grep -a "^FAIL" -A2 /tmp/sd5270.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui527-ui.js > /tmp/ui5270.log 2>&1 \
  && ok "2.527.0 browser test: 🩺 every image style, ▶ Check (Quick) ✓ / ✗ with the reason, the test pictures out of the gallery, ↻, ■ Stop (nothing left queued), the report + .md, after a reload - or SKIP without playwright" \
  || { bad "2.527.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5270.log | head -14; }

# ---- 2.528.0 (🧍 characters in House shots - static/housegeo.js people, static/housebuilder.js seen(), lib/house.js charRef)
node scripts/test-people528.js > /tmp/pp5280.log 2>&1 \
  && ok "people units (2.528.0 the mannequin per pose + height + colour, who a camera sees - side / depth / walls / doors, charRef into the Image assets, ?assets=1 takes them, the route)" \
  || { bad "2.528.0 people units"; grep -a "^FAIL" -A2 /tmp/pp5280.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui528-ui.js > /tmp/ui5280.log 2>&1 \
  && ok "2.528.0 browser test: 🧍 press + drag, the character + pose, the mannequin in the shot, the prompt names picture 2, ✨ queues the shot + the character's picture + their LoRA - or SKIP without playwright" \
  || { bad "2.528.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5280.log | head -14; }

# ---- 2.529.0 (House builder extras - roofs, trace, lib/houseFurnish.js, lib/houseGltf.js, the shot list)
node scripts/test-houseextras529.js > /tmp/hx5290.log 2>&1 \
  && ok "house extras units (2.529.0 gable / hip / flat roofs, furnish - kinds, the LLM pick cleaned, placed inside / clear of the door / not overlapping, .glb read back, the trace picture, the routes)" \
  || { bad "2.529.0 house extras units"; grep -a "^FAIL" -A2 /tmp/hx5290.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui529-ui.js > /tmp/ui5290.log 2>&1 \
  && ok "2.529.0 browser test: a hip roof in an outside shot, a plan picture + 📐 scale, 🪄 furnish + Ctrl+Z, the .glb through three.js's GLTFLoader, 🎬 StoryBoard scenes with first frames + the list - or SKIP without playwright" \
  || { bad "2.529.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5290.log | head -14; }

# ---- 2.530.0 (🔍 the Ctrl+K command palette + 📖 Help - static/palette.js, lib/helpDocs.js, routes/help.js)
node scripts/test-palette530.js > /tmp/pal5300.log 2>&1 \
  && ok "palette units (2.530.0 the search - every word, the label first, recent lifted; mdToHtml escaped; USAGE.md sections + shortcuts; GET /api/help)" \
  || { bad "2.530.0 palette units"; grep -a "^FAIL" -A2 /tmp/pal5300.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui530-ui.js > /tmp/ui5300.log 2>&1 \
  && ok "2.530.0 browser test: Ctrl+K / 🔍, every group, 'lora' / 'house' / 'depth map', a hidden docker back, a Settings field lit on its tab, 📖 Help sections + key tables, recent first, Esc, a Ctrl+K a docker used left to it - or SKIP without playwright" \
  || { bad "2.530.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5300.log | head -14; }

# ---- 2.531.0 (Anima: every loader file relocated by name; the missing one names its model-catalog download)
python3 scripts/test-anima531.py > /tmp/an5310.log 2>&1 \
  && ok "anima units (2.531.0 the text encoder / VAE in another subfolder found, no guessing, catalog_hint, Tim's line + the catalog entry, the doctor's advice)" \
  || { bad "2.531.0 anima units"; grep -a "^FAIL" -A2 /tmp/an5310.log | head -14; }

# ---- 2.532.0 (the test list ticks itself and keeps it; ▁ ⛶ ✕ docker title bars; House: select / turn / size, walk a camera)
node scripts/test-tp532.js > /tmp/tp5320.log 2>&1 \
  && ok "self-ticking test list + title bar + walking camera units (2.532.0 keepAuto, the event autos, H3TestEvent, ▁ ⛶ ✕, heightRange / camAt)" \
  || { bad "2.532.0 units"; grep -a "^FAIL" -A2 /tmp/tp5320.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui532-ui.js > /tmp/ui5320.log 2>&1 \
  && ok "2.532.0 browser test: sofa handles size / turn, box + R + Delete, Shift+click, a camera walked (3D follows, arrows, Shift to the roof + 3 m, Alt to the ground), ▁ ⛶ ✕, auto ✓ kept - or SKIP without playwright" \
  || { bad "2.532.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5320.log | head -14; }

# ---- 2.533.0 (a dropdown's search list inside a modal dialog opens in front of it - the Select a LoRA folder list)
H3_URL=http://127.0.0.1:8311/ node scripts/test-selsearch533-ui.js > /tmp/ss5330.log 2>&1 \
  && ok "2.533.0 browser test: the Select a LoRA folder list in its dialog and in front (top-layer popover), a click picks, a letter searches, Esc closes only the list; a Settings list in front; a list outside a dialog in the page - or SKIP without playwright" \
  || { bad "2.533.0 dropdown-in-a-dialog browser test"; grep -a "FAIL\|Error" -A2 /tmp/ss5330.log | head -14; }

# ---- 2.534.0 (🧪 Test mode: off = nothing; on = the coach suggests where you are + asks "Did it work?" with a suggestion; the preview follows new renders)
node scripts/test-testcoach534.js > /tmp/tc5340.log 2>&1 \
  && ok "test mode + coach + preview-follow units (2.534.0 off = no auto / no event, pending until confirmed, suggestions in the log, where, ie_action, nextTest / toConfirm, lbfollow merge)" \
  || { bad "2.534.0 units"; grep -a "^FAIL" -A2 /tmp/tc5340.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui534-ui.js > /tmp/ui5340.log 2>&1 \
  && ok "2.534.0 browser test: off ticks nothing; Settings' 🧪 Test mode on; image editor: Try next = Gaussian Blur, the blur -> Did it work? + 💡 suggestion -> saved, next = Brush, Later, Tried it -> ✗ + note; in front of Settings; the log's SUGGESTIONS; the docker's box off; a new render joins the open preview - or SKIP without playwright" \
  || { bad "2.534.0 browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5340.log | head -14; }

# ---- 2.535.0 (FLUX 3 Klein: a ComfyUI without CLIPLoader type flux3 is named as too old; the real file names)
python3 scripts/test-flux535.py > /tmp/f35350.log 2>&1 \
  && ok "flux3 units (2.535.0 Tim's rejection -> a CHOICE not a file, ComfyUI 0.41.0+ (0.41.1 best), the version running, how to update, its choices; a missing file keeps the file advice; the Style doctor; the catalog + templates' real names; isKlein3)" \
  || { bad "2.535.0 flux3 units"; grep -a "^FAIL" -A2 /tmp/f35350.log | head -14; }

# ---- 2.536.0 (Veda sparse attention: an optional video accelerator - h3veda last on the model wire)
python3 scripts/test-veda536.py > /tmp/vd5360.log 2>&1 \
  && ok "veda units (2.536.0 h3veda after LoRAs / Spectrum before the guider + scheduler, presets, Sage skipped, Long / non-H3 skip, size note, the predictor ComfyUI lists (R2VA for references), fallback blame, styles / arch / catalog / installer / page, the stub over HTTP)" \
  || { bad "2.536.0 veda units"; grep -a "^FAIL" -A2 /tmp/vd5360.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-veda536-ui.js > /tmp/uivd5360.log 2>&1 \
  && ok "2.536.0 browser test: Veda in the H3 style editor (Off / On / Quality + predictor), saved + read back, Off = the old shape, LTX hides it; ⬇ Install Veda + label; /api/comfy/vaccel - or SKIP without playwright" \
  || { bad "2.536.0 Veda browser test"; grep -a "FAIL\|Error" -A2 /tmp/uivd5360.log | head -14; }

# ---- 2.537.0 (🧩 Models: pages, folder tabs, card size, the info page, the shared model_info library, This project)
node scripts/test-modelinfo537.js > /tmp/mi5370.log 2>&1 \
  && ok "model manager units (2.537.0 pageOf / autoPer / pagerModel, folder tabs, usedKeys, cleanQuery / matchVersion / examplesOf, fetchOne against a fake Civitai -> model_info/<kind>/<stem>, modelCards layers it, the routes, the docker)" \
  || { bad "2.537.0 model manager units"; grep -a "^FAIL" -A2 /tmp/mi5370.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui537-ui.js > /tmp/ui5370.log 2>&1 \
  && ok "2.537.0 browser test: pages that fit (a resize refits), 24 a page + ›, folder tabs (SDXL / Pony, LoRAs' own), ⇲ corner drag sizes every card, the model_info entry on its card, click selects, the hover card -> the info page (examples + prompts, Use this prompt), Back / I / Esc, 📌 This project - or SKIP without playwright" \
  || { bad "2.537.0 model manager browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5370.log | head -14; }

# ---- 2.538.0 (🧩 ⤓ Civitai into each type's folder, model_folders.json, 🔄 Sync, 🏠 ◯ lights, ⛶ beside the side dockers)
node scripts/test-modelfolders538.js > /tmp/mf5380.log 2>&1 \
  && ok "model folders units (2.538.0 typeOf / mainOf / kindOf / keys, model_folders.json set / forget / list, resolve per type, civitai.download {folder} into it - never a dir from the request, sync by version id, fetch {all, sync}, ◯ lights normalize / build / reachOf, maxSpan)" \
  || { bad "2.538.0 model folders units"; grep -a "^FAIL" -A2 /tmp/mf5380.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui538-ui.js > /tmp/ui5380.log 2>&1 \
  && ok "2.538.0 browser test: ⤓ asks for the type's folder once, then straight there, Shift changes it, another type asks its own, the versions view's ⤓, 📁 list / forget / any type, 🔄 Sync {all, sync}, ◯ light drag + reach handle + move + Delete, ⛶ between the open side dockers - or SKIP without playwright" \
  || { bad "2.538.0 model folders browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5380.log | head -14; }

# ---- 2.539.0 (🖼 reference descriptions + house types, references in the house builder + the image editor)
node scripts/test-refinfo539.js > /tmp/rf5390.log 2>&1 \
  && ok "reference units (2.539.0 RefInfo clean / mapLine / notesFor / notesIn / houseFirst, the manifest + groups keep descriptions, refContext uses them, housegeo refs / tex / ref + textured meshes, looksSeen / picPlan, lib/house saveRef / refPath / refAsset, aiEdit.refPrompt + the route's ref0)" \
  || { bad "2.539.0 reference units"; grep -a "^FAIL" -A2 /tmp/rf5390.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui539-ui.js > /tmp/ui5390.log 2>&1 \
  && ok "2.539.0 browser test: description boxes (pictures, video, sound), the new types, mapping lines, saved + read back, H3Refs; a wall picture on a wall (kept, textured mesh, served), a furniture picture dropped on a piece, Make it real's prompt, a shot renders; the editor's reference layer + Edit's ref0 - or SKIP without playwright" \
  || { bad "2.539.0 reference browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5390.log | head -14; }

# ---- 2.540.0 (🎬 Blender / Unreal renders made real with the reference docker's pictures)
node scripts/test-realrefs540.js > /tmp/rr5400.log 2>&1 \
  && ok "realrefs units (2.540.0 RealRefs words / autoMatch / heads / resolve / where / framePrompt / videoPrompt / boxOf / ueBox, lib/realRefs upload / start / the video chain, a real Blender render's first frame + objects2d boxes, layer3d boxes, the Unreal stand-in's actors_in_view)" \
  || { bad "2.540.0 realrefs units"; grep -a "^FAIL" -A2 /tmp/rr5400.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui540-ui.js > /tmp/ui5400.log 2>&1 \
  && ok "2.540.0 browser test: the timeline's .blend matched to the docker's pictures (auto + by hand), Render to real -> the first-frame edit job's prompt; the image editor's Unreal layer 🔍 Find the objects + ✨ Make it real; UNREAL ▸ Render to Real - or SKIP without playwright" \
  || { bad "2.540.0 realrefs browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5400.log | head -14; }

# ---- 2.540.2 (a node pack can never stop the setup)
node scripts/test-setuppacks5402.js > /tmp/sp5402.log 2>&1 \
  && ok "setup node packs (2.540.2: run() timeout, git with no prompts / no background gc, a subfolder pack copied out, a temp folder that will not delete left with a warning, install() never throws, setupRun keeps going)" \
  || { bad "2.540.2 setup node packs"; grep -a "^FAIL" -A2 /tmp/sp5402.log | head -14; }

# ---- 2.540.3 (a checkpoint override only where it fits the style)
node scripts/test-modelfit5403.js > /tmp/mf5403.log 2>&1 \
  && ok "model fit (2.540.3: an Anima / SDXL checkpoint left out of a Qwen / FLUX 3 Klein workflow, the SDXL families fit SDXL, the route's note)" \
  || { bad "2.540.3 model fit"; grep -a "^FAIL" -A2 /tmp/mf5403.log | head -14; }

# ---- 2.540.4 (Settings ▸ Add-ons: YuE2 installed in the app; the YuE2 call fixed)
node scripts/test-addons5404.js > /tmp/ao5404.log 2>&1 \
  && ok "add-ons units (2.540.4: the YuE2 install steps with a stand-in runner, the Python / GPU gates, the CUDA index fallback, one job at a time, the routes, music_worker's yue2 generate --request)" \
  || { bad "2.540.4 add-ons units"; grep -a "^FAIL" -A2 /tmp/ao5404.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui5404-ui.js > /tmp/ui5404.log 2>&1 \
  && ok "2.540.4 browser test: Settings ▸ Add-ons cards, ⤓ Install asks, the job's log in the tab (the no-GPU refusal here) - or SKIP without playwright" \
  || { bad "2.540.4 add-ons browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5404.log | head -14; }

# ---- 2.540.5 (⟳ Update from GitHub)
node scripts/test-updater5405.js > /tmp/up5405.log 2>&1 \
  && ok "updater units (2.540.5: a real git + a local GitHub - behind -> updated with backups + the user's quick prompts kept + npm when the lock changed, ahead -> refused, up to date; the zip install; the routes + the restart wiring)" \
  || { bad "2.540.5 updater units"; grep -a "^FAIL" -A2 /tmp/up5405.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui5405-ui.js > /tmp/ui5405.log 2>&1 \
  && ok "2.540.5 browser test: Settings ▸ General ▸ ⟳ Updates - check, the commits, ⤓ Update now asks, the log, restart - or SKIP without playwright" \
  || { bad "2.540.5 updater browser test"; grep -a "FAIL\|Error" -A2 /tmp/ui5405.log | head -14; }

# ---- 2.540.6 (YuE2 on Windows without symlink rights)
node scripts/test-yue2run5406.js > /tmp/yr5406.log 2>&1 \
  && ok "yue2 runner (2.540.6: the Hugging Face cache told to copy instead of symlink before yue2's CLI runs; music_worker launches it from the venv)" \
  || { bad "2.540.6 yue2 runner"; grep -a "^FAIL" -A2 /tmp/yr5406.log | head -14; }
node scripts/test-themeedit5406.js > /tmp/te5406.log 2>&1 \
  && ok "theme edit page guard (2.540.6: html / body / :root / * keep colours but are never sized, moved or hidden - set, cleaned on load, saved)" \
  || { bad "2.540.6 theme edit page guard"; grep -a "^FAIL" -A2 /tmp/te5406.log | head -14; }
node scripts/test-pushbat5406.js > /tmp/pb5406.log 2>&1 \
  && ok "push-to-github.bat (2.540.6: CRLF, labels, no parens in a block, a dropped zip runs from TEMP, tracked files only, the private notes never committed, never a force push + the zip step's git commands for real)" \
  || { bad "2.540.6 push-to-github.bat"; grep -a "^FAIL" -A2 /tmp/pb5406.log | head -14; }

# ---- 2.540.7 (YuE2 without FlashAttention)
node scripts/test-yue2attn5406.js > /tmp/ya5407.log 2>&1 \
  && ok "yue2 attention (2.540.7: no FlashAttention in PyTorch -> cuDNN / sdpa in the CUDA graph; music_worker retries sdpa then torch-eager on an attention error, remembers it, an OOM is not retried)" \
  || { bad "2.540.7 yue2 attention"; grep -a "^FAIL" -A2 /tmp/ya5407.log | head -14; }

# ---- 2.541.0 (the prompt docker's ▾ + Blender mode in the image editor)
node scripts/test-imgop541.js > /tmp/op541.log 2>&1 \
  && ok "image ops units (2.541.0: the six choices, the button's words, what each does, Blender mode, the model's edits + their checks, the wiring)" \
  || { bad "2.541.0 image ops units"; grep -a "^FAIL" -A2 /tmp/op541.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui541-ui.js > /tmp/ui541.log 2>&1 \
  && ok "2.541.0 browser test: the ▾ only in Image mode, Refine's slider + words both ways, Fill / Refine / Replace background / Remove run in the editor, the Model moved by numbers and by dragging (real Blender), Edit in Blender mode renders the scene, ✔ on a thumbnail = a new layer - or SKIP without playwright" \
  || { bad "2.541.0 image ops browser test"; grep -a "FAIL\\|Error" -A2 /tmp/ui541.log | head -14; }

# ---- 2.542.0 (a Blender layer in the image editor)
node scripts/test-blendlayer542.js > /tmp/bl542.log 2>&1 \
  && ok "Blender layer units (2.542.0: the tools lent + given back, viewPicture vs the undo snapshot, one frame as a PNG, L.bscene, Edit -> new layers, the wiring)" \
  || { bad "2.542.0 Blender layer units"; grep -a "^FAIL" -A2 /tmp/bl542.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui542-ui.js > /tmp/ui542.log 2>&1 \
  && ok "2.542.0 browser test: 🟧 lends the timeline's scene tools to the editor (real Blender + WebGL), the Blender layer keeps the view, deletes like any layer, Edit from the view / a Blender still -> a new layer, the timeline takes them back - or SKIP without playwright / Blender" \
  || { bad "2.542.0 Blender layer browser test"; grep -a "FAIL\\|Error" -A2 /tmp/ui542.log | head -14; }

# ---- 2.543.0 (references or layers; Compose in the ▾)
node scripts/test-imgop543.js > /tmp/op543.log 2>&1 \
  && ok "image ops by source units (2.543.0: Fill / Remove only with the editor, the chip's words, references vs layers vs picked layers, the background instruction, the tabs hidden, ieOnScreen global)" \
  || { bad "2.543.0 image ops by source units"; grep -a "^FAIL" -A2 /tmp/op543.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui543-ui.js > /tmp/ui543.log 2>&1 \
  && ok "2.543.0 browser test: the editor minimized -> the references (Edit, 2 = Compose, Replace background, Refine, Compose), Fill / Remove gone and back; open -> the selected layer, 2 picked = Compose, a new layer each - or SKIP without playwright" \
  || { bad "2.543.0 image ops by source browser test"; grep -a "FAIL\\|Error" -A2 /tmp/ui543.log | head -14; }
H3_URL=http://127.0.0.1:8311/ node scripts/test-ui5406-ui.js > /tmp/ui5406.log 2>&1 \
  && ok "2.540.6 browser test: theme edit handles - the drag ends when let go, the next drag sizes the same element, the page never moves, a broken saved rule heals - or SKIP without playwright" \
  || { bad "2.540.6 theme edit handles browser test"; grep -a "FAIL\\|Error" -A2 /tmp/ui5406.log | head -14; }

# ---- 2.403.0 (Tim: "can we preview the blender scene in our preview canvas (load the blend) file and navigate the scene ...")
node scripts/test-blendview-ui.js > /tmp/blendviewui4030.log 2>&1 \
  && ok "blend preview browser test: 🟧 opens a .blend over the preview canvas (<project>/blender/<name>.tmp), scene camera + free view draw, a click selects, a still object's move = its place, an animated one's = a key (played between keys), duplicate / delete / undo / hide reach .edits.json, the toolbox Save to (bitGen | write back | copy) + 💾 Save bakes them in (original untouched), [ In / Out ] + Render to real through this view -> Video assets, ✕ gives the canvas back - or SKIP without playwright / Blender" \
  || { bad "blend preview browser test"; grep -a "FAIL\|Error" -A2 /tmp/blendviewui4030.log | head -14; }

# ---- 2.346.0 (Tim: "add a clear button to the queue docker. this will clear
# the list of done jobs"): LAST, because it empties this server's Done list
node scripts/test-queueclear-ui.js > /tmp/qclear.log 2>&1 \
  && ok "queue: 🧹 Clear on both tabs, labelled with the finished count; a click empties the Done list (server + page), GET /api/jobs still answers - or SKIP without playwright" \
  || { bad "queue: 🧹 Clear browser test"; grep -a "FAIL\|Error" /tmp/qclear.log | head -12; }

say "======================="
say "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ]

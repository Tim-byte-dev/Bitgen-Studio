#!/usr/bin/env python3
"""Unit tests for scripts/fdlg_helper.py (2.326.0) - the file dialog's
Python half: the user's known folders (xdg / the fixed names), the drives
(Linux mounts from a fake /proc/mounts), thumbnails (real ffmpeg on a
picture and a video) and the JSON-lines serve protocol."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import fdlg_helper as H  # noqa: E402

passed = failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok   {name}")
    else:
        failed += 1
        print(f"  FAIL {name} {detail}")


with tempfile.TemporaryDirectory() as td:
    home = Path(td) / "home"
    for d in ("Desktop", "Downloads", "Docs", "Pictures", "Movies", "Music", "Videos"):
        (home / d).mkdir(parents=True)
    (home / ".config").mkdir()
    (home / ".config" / "user-dirs.dirs").write_text(
        '# xdg\nXDG_DESKTOP_DIR="$HOME/Desktop"\nXDG_DOCUMENTS_DIR="$HOME/Docs"\nXDG_MUSIC_DIR="$HOME"\n', encoding="utf-8")
    old = os.environ.pop("XDG_CONFIG_HOME", None)
    q = H.known_folders(system="Linux", home=str(home))
    ids = {x["id"]: x["path"] for x in q}
    check("linux: the xdg user-dirs file decides (Documents = ~/Docs)", ids.get("documents") == str(home / "Docs"), ids)
    check("linux: an xdg dir set to $HOME itself falls back to ~/Music", ids.get("music") == str(home / "Music"), ids)
    check("linux: the six places, in Explorer's order", [x["id"] for x in q] == ["desktop", "downloads", "documents", "pictures", "videos", "music"], q)
    m = H.known_folders(system="Darwin", home=str(home))
    check("macOS: Videos is ~/Movies", {x["id"]: x["path"] for x in m}.get("videos") == str(home / "Movies"))
    shutil.rmtree(home / "Music")
    check("a place that does not exist is left out", "music" not in {x["id"] for x in H.known_folders(system="Darwin", home=str(home))})
    if old is not None:
        os.environ["XDG_CONFIG_HOME"] = old

    pm = Path(td) / "mounts"
    usb = Path(td) / "media" / "tim" / "USB STICK"
    usb.mkdir(parents=True)
    pm.write_text("proc /proc proc rw 0 0\n/dev/sda1 / ext4 rw 0 0\n"
                  "/dev/sdb1 " + str(usb).replace(" ", "\\040") + " vfat rw 0 0\n"
                  "tmpfs /run tmpfs rw 0 0\n/dev/sdc1 /mnt/data ext4 rw 0 0\n"
                  "/dev/sdd1 /media/tim/USB\\040STICK vfat rw 0 0\n/dev/loop0 /media/snap squashfs ro 0 0\n", encoding="utf-8")
    mnts = H._mounts(str(pm))
    check("linux mounts: only real filesystems under /media, /mnt, /run/media (\\040 = space)",
          str(usb) not in mnts and mnts == ["/mnt/data", "/media/tim/USB STICK"], mnts)   # the tmp path is not under /media
    dr = H.drives(system="Linux", proc_mounts=str(pm))
    check("drives: / is the File System, with total / free space",
          dr[0]["path"] == "/" and dr[0]["label"] == "File System" and dr[0]["total"] and dr[0]["free"] is not None, dr[:1])

    p = H.places()
    check("places: os, home, sep, quick[], drives[] - JSON-serialisable",
          set(p) >= {"os", "home", "sep", "quick", "drives"} and json.dumps(p))

    a = H.thumb_args("in.mp4", "out.jpg", 256, video=True, at=0.7)
    check("thumb args: fit into the box, one frame, a video sampled in", "-ss" in a and "0.70" in a
          and "scale=256:256:force_original_aspect_ratio=decrease" in a and a[-1] == "out.jpg")
    check("thumb: not a picture or a video is refused in words",
          "no thumbnail" in H.thumb(__file__, str(Path(td) / "x.jpg"), 128).get("error", ""))
    if shutil.which("ffmpeg"):
        img = Path(td) / "pic.png"
        vid = Path(td) / "clip.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=800x400",
                        "-frames:v", "1", str(img)], check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=25:duration=3",
                        "-pix_fmt", "yuv420p", str(vid)], check=True)
        for src, name in ((img, "picture"), (vid, "video")):
            out = Path(td) / "th" / (name + ".jpg")
            r = H.thumb(str(src), str(out), 128)
            wh = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "stream=width,height",
                                          "-of", "csv=p=0", str(out)], text=True).strip() if out.exists() else ""
            check(f"thumb: a real {name} -> a JPEG inside 128 px, aspect kept", r.get("ok") and wh in ("128,64", "128,72"), (r, wh))
        # the serve protocol
        pr = subprocess.run([sys.executable, str(ROOT / "scripts" / "fdlg_helper.py"), "serve"],
                            input="\n".join([json.dumps({"id": 1, "cmd": "ping"}), "not json",
                                             json.dumps({"id": 2, "cmd": "nope"}),
                                             json.dumps({"id": 3, "cmd": "thumb", "src": str(img), "dst": str(Path(td) / "s.jpg"), "size": 64}),
                                             json.dumps({"id": 4, "cmd": "places"})]) + "\n",
                            capture_output=True, text=True, timeout=60)
        replies = {}
        for line in pr.stdout.splitlines():
            m = json.loads(line)
            replies[m.get("id")] = m.get("result")
        check("serve: ping / bad json / unknown command / thumb / places each answered by id",
              replies.get(1) == {"pong": True} and "bad json" in (replies.get(None) or {}).get("error", "")
              and "unknown command" in replies.get(2, {}).get("error", "") and replies.get(3, {}).get("ok")
              and "drives" in replies.get(4, {}), replies)
    else:
        print("  (ffmpeg not on PATH - the real thumbnail checks are skipped)")

print(f"RESULT: {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

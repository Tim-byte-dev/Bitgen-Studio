#!/usr/bin/env python3
"""bitGen Studio — the FILE DIALOG's system helper (2.326.0).

Tim: "please create a file select and folder select dialog that looks and
behaves like the windows 11 ones, but build it with nodejs and python. we
will replace all the folder select and file select with these dialogs to try
and make the app cross platform compatible". Answer: Python does the
thumbnails + the system information; Node (lib/fileDialog.js) lists folders.

WHAT THIS KNOWS THAT NODE DOES NOT (without native modules):
  places   the user's REAL Desktop / Documents / Downloads / Pictures /
           Videos / Music (Windows: SHGetKnownFolderPath, so a Documents
           folder moved to D:\\ or into OneDrive is found; Linux: the
           xdg user-dirs file; macOS: the fixed ~/ names) and the drives
           with their labels, kind and free / total space (Windows:
           GetLogicalDrives + GetDriveTypeW + GetVolumeInformationW;
           macOS: / + /Volumes; Linux: / + the real mounts in /proc/mounts)
  thumb    a JPEG thumbnail of a picture or a video (ffmpeg; a video
           is sampled at 10% of its length, max 1 s in) - Pillow is the
           fallback for pictures when ffmpeg is missing

USE
  python fdlg_helper.py places                 -> one JSON object
  python fdlg_helper.py thumb SRC DST SIZE     -> {"ok": true} / {"error": ...}
  python fdlg_helper.py serve                  -> JSON lines on stdin/stdout:
      {"id": 1, "cmd": "places"}               -> {"id": 1, "result": {...}}
      {"id": 2, "cmd": "thumb", "src", "dst", "size"}
  serve runs thumbnails on 4 threads, so a folder of pictures fills in
  quickly; lib/fdlgHelper.js keeps ONE serve process alive for the app.
Stdlib only.
"""
import json
import os
import platform
import shutil
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".avif", ".heic", ".exr", ".jxl"}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v", ".mpg", ".mpeg", ".wmv", ".flv"}
REAL_FS = {"ext2", "ext3", "ext4", "xfs", "btrfs", "vfat", "exfat", "ntfs", "ntfs3", "fuseblk",
           "zfs", "f2fs", "hfsplus", "apfs", "drvfs", "9p", "nfs", "nfs4", "cifs", "smb3"}


# ------------------------------------------------------------------ places
def _win_known_folders():
    import ctypes
    from ctypes import wintypes
    import uuid

    class GUID(ctypes.Structure):
        _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD),
                    ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]

    def guid(s):
        u = uuid.UUID(s)
        g = GUID()
        g.Data1, g.Data2, g.Data3 = u.fields[0], u.fields[1], u.fields[2]
        for i, b in enumerate(u.bytes[8:]):
            g.Data4[i] = b
        return g

    ids = [("desktop", "Desktop", "{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}"),
           ("downloads", "Downloads", "{374DE290-123F-4565-9164-39C4925E467B}"),
           ("documents", "Documents", "{FDD39AD0-238F-46AF-ADB4-6C85480369C7}"),
           ("pictures", "Pictures", "{33E28130-4E1E-4676-835A-98395C3BC3BB}"),
           ("videos", "Videos", "{18989B1D-99B5-455B-841C-AB7C74E4DDFC}"),
           ("music", "Music", "{4BD8D571-6D19-48D3-BE97-422220080E43}")]
    shell32 = ctypes.windll.shell32
    ole32 = ctypes.windll.ole32
    out = []
    for key, name, gid in ids:
        p = ctypes.c_wchar_p()
        g = guid(gid)
        try:
            if shell32.SHGetKnownFolderPath(ctypes.byref(g), 0, None, ctypes.byref(p)) == 0:
                out.append({"id": key, "name": name, "path": p.value})
        except Exception:                                   # noqa: BLE001
            pass
        finally:
            try:
                ole32.CoTaskMemFree(p)
            except Exception:                               # noqa: BLE001
                pass
    return out


def _xdg_dirs(home):
    """~/.config/user-dirs.dirs -> {KEY: path} (XDG_DESKTOP_DIR="$HOME/Desktop")."""
    f = Path(os.environ.get("XDG_CONFIG_HOME") or (Path(home) / ".config")) / "user-dirs.dirs"
    out = {}
    try:
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line.startswith("XDG_") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip().strip('"').replace("$HOME", str(home))
            out[k.strip()] = v
    except OSError:
        pass
    return out


def known_folders(system=None, home=None):
    system = system or platform.system()
    home = str(home or Path.home())
    if system == "Windows":
        try:
            got = _win_known_folders()
            if got:
                return got
        except Exception:                                   # noqa: BLE001
            pass
    names = [("desktop", "Desktop", "Desktop", "XDG_DESKTOP_DIR"),
             ("downloads", "Downloads", "Downloads", "XDG_DOWNLOAD_DIR"),
             ("documents", "Documents", "Documents", "XDG_DOCUMENTS_DIR"),
             ("pictures", "Pictures", "Pictures", "XDG_PICTURES_DIR"),
             ("videos", "Videos", "Movies" if system == "Darwin" else "Videos", "XDG_VIDEOS_DIR"),
             ("music", "Music", "Music", "XDG_MUSIC_DIR")]
    xdg = _xdg_dirs(home) if system == "Linux" else {}
    out = []
    for key, label, sub, xkey in names:
        p = xdg.get(xkey) or os.path.join(home, sub)
        # xdg sets unused dirs to $HOME itself - that is not a folder of its own
        if os.path.normpath(p) == os.path.normpath(home):
            p = os.path.join(home, sub)
        out.append({"id": key, "name": label, "path": p})
    return [q for q in out if os.path.isdir(q["path"])]


def _usage(p):
    try:
        u = shutil.disk_usage(p)
        return u.total, u.free
    except OSError:
        return None, None


def _win_drives():
    import ctypes
    k32 = ctypes.windll.kernel32
    mask = k32.GetLogicalDrives()
    kinds = {2: "removable", 3: "fixed", 4: "network", 5: "optical", 6: "ram"}
    out = []
    for i in range(26):
        if not mask & (1 << i):
            continue
        root = f"{chr(65 + i)}:\\"
        kind = kinds.get(k32.GetDriveTypeW(ctypes.c_wchar_p(root)), "fixed")
        label = ctypes.create_unicode_buffer(261)
        fsname = ctypes.create_unicode_buffer(261)
        ok = k32.GetVolumeInformationW(ctypes.c_wchar_p(root), label, 261, None, None, None, fsname, 261)
        total, free = _usage(root)
        if not ok and total is None:            # an empty card reader / DVD drive
            continue
        name = label.value or ("Local Disk" if kind == "fixed" else
                               "USB Drive" if kind == "removable" else
                               "Network Drive" if kind == "network" else "Drive")
        out.append({"path": root, "label": f"{name} ({root[:2]})", "kind": kind,
                    "total": total, "free": free})
    return out


def _mounts(proc_mounts="/proc/mounts"):
    out = []
    try:
        lines = Path(proc_mounts).read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return out
    for line in lines:
        parts = line.split()
        if len(parts) < 3:
            continue
        mnt = parts[1].replace("\\040", " ")
        fstype = parts[2]
        if fstype not in REAL_FS:
            continue
        if mnt.startswith(("/media/", "/mnt/", "/run/media/")) and mnt not in out:
            out.append(mnt)
    return out


def drives(system=None, proc_mounts="/proc/mounts"):
    system = system or platform.system()
    if system == "Windows":
        try:
            return _win_drives()
        except Exception:                                   # noqa: BLE001
            pass
    out = []
    roots = [("/", "Macintosh HD" if system == "Darwin" else "File System")]
    if system == "Darwin":
        try:
            for v in sorted(os.listdir("/Volumes")):
                p = os.path.join("/Volumes", v)
                if os.path.isdir(p) and not os.path.realpath(p) == "/":
                    roots.append((p, v))
        except OSError:
            pass
    elif system == "Linux":
        for m in _mounts(proc_mounts):
            roots.append((m, os.path.basename(m) or m))
    for p, label in roots:
        total, free = _usage(p)
        out.append({"path": p, "label": label, "kind": "fixed" if p == "/" else "removable",
                    "total": total, "free": free})
    return out


def places():
    home = str(Path.home())
    return {"os": platform.system(), "home": home, "sep": os.sep,
            "quick": known_folders(home=home), "drives": drives()}


# ------------------------------------------------------------------ thumbs
def _ffmpeg():
    return shutil.which("ffmpeg")


def _duration(src):
    exe = shutil.which("ffprobe")
    if not exe:
        return 0.0
    r = subprocess.run([exe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                       capture_output=True, text=True, stdin=subprocess.DEVNULL)
    try:
        return float((r.stdout or "0").strip() or 0)
    except ValueError:
        return 0.0


def thumb_args(src, dst, size, video=False, at=0.0):
    vf = f"scale={int(size)}:{int(size)}:force_original_aspect_ratio=decrease"
    a = ["ffmpeg", "-y", "-loglevel", "error"]
    if video and at > 0:
        a += ["-ss", f"{at:.2f}"]
    return a + ["-i", str(src), "-frames:v", "1", "-vf", vf, "-q:v", "4", str(dst)]


def thumb(src, dst, size=256):
    src, dst = Path(src), Path(dst)
    size = max(32, min(1024, int(size or 256)))
    if not src.is_file():
        return {"error": f"not a file: {src}"}
    ext = src.suffix.lower()
    if ext not in IMAGE_EXT and ext not in VIDEO_EXT:
        return {"error": "no thumbnail for this type"}
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(dst.stem + ".part" + dst.suffix)
    if ext == ".jxl":                                   # 2.479.0: JPEG XL - its PNG (scripts/jxl_png.py), then as any picture
        try:
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            import jxl_png
            src, ext = Path(jxl_png.png_for(src)), ".png"
        except Exception as e:                          # noqa: BLE001
            return {"error": f"could not read the JPEG XL picture: {e}"}
    if _ffmpeg():
        video = ext in VIDEO_EXT
        at = min(1.0, _duration(src) * 0.1) if video else 0.0
        a = thumb_args(src, tmp, size, video, at)
        a[0] = _ffmpeg()
        r = subprocess.run(a, capture_output=True, text=True, stdin=subprocess.DEVNULL)
        if r.returncode == 0 and tmp.exists() and tmp.stat().st_size > 0:
            os.replace(tmp, dst)
            return {"ok": True}
        err = (r.stderr or "").strip().splitlines()[-1:] or ["ffmpeg failed"]
    else:
        err = ["ffmpeg not on PATH"]
    if ext in IMAGE_EXT:
        try:
            from PIL import Image                          # optional fallback
            with Image.open(src) as im:
                im.thumbnail((size, size))
                im.convert("RGB").save(tmp, "JPEG", quality=80)
            os.replace(tmp, dst)
            return {"ok": True}
        except Exception:                                   # noqa: BLE001
            pass
    try:
        tmp.unlink()
    except OSError:
        pass
    return {"error": err[0]}


# ------------------------------------------------------------------- serve
def serve(inp=sys.stdin, out=sys.stdout):
    lock = threading.Lock()
    pool = ThreadPoolExecutor(max_workers=4)

    def reply(obj):
        with lock:
            out.write(json.dumps(obj) + "\n")
            out.flush()

    def run(msg):
        mid = msg.get("id")
        try:
            cmd = msg.get("cmd")
            if cmd == "places":
                res = places()
            elif cmd == "thumb":
                res = thumb(msg.get("src"), msg.get("dst"), msg.get("size") or 256)
            elif cmd == "ping":
                res = {"pong": True}
            else:
                res = {"error": f"unknown command {cmd!r}"}
            reply({"id": mid, "result": res})
        except Exception as e:                              # noqa: BLE001
            reply({"id": mid, "result": {"error": str(e)}})

    for line in inp:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            reply({"id": None, "result": {"error": "bad json"}})
            continue
        if msg.get("cmd") == "quit":
            break
        if msg.get("cmd") == "thumb":
            pool.submit(run, msg)
        else:
            run(msg)
    pool.shutdown(wait=True)


def main(argv):
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:                                   # noqa: BLE001
            pass
    if len(argv) >= 2 and argv[1] == "places":
        print(json.dumps(places()))
        return 0
    if len(argv) >= 5 and argv[1] == "thumb":
        r = thumb(argv[2], argv[3], argv[4])
        print(json.dumps(r))
        return 0 if r.get("ok") else 1
    if len(argv) >= 2 and argv[1] == "serve":
        serve()
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))

#!/usr/bin/env python3
"""Run a gate in its own network + mount namespace (dev only, Linux, root):

    unshare -n -m --propagation private python3 scripts/nsrun.py <private tmp dir> bash scripts/e2e-stub-test.sh

Loopback + a TAP "LAN" address are brought up (the gate's servers bind 127.0.0.1:8311 / 8388 / ...
without clashing with another gate), <private tmp dir> is bound over /tmp (the
gate's logs + stub output stay apart), and git inside uses an unsigned global
config (a commit signer that talks to a service outside the namespace fails)."""
import fcntl, os, shutil, socket, struct, subprocess, sys
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
# a "LAN" address too (the remote / QR legs want a non-loopback IPv4): a
# persistent TAP device lan0 = 10.77.0.2
try:
    fd = os.open('/dev/net/tun', os.O_RDWR)
    fcntl.ioctl(fd, 0x400454ca, struct.pack('16sH', b'lan0', 0x0002 | 0x1000))   # TUNSETIFF tap, no pi
    os.set_inheritable(fd, True)          # held open by the gate: an fd-less TAP has no carrier,
                                          # and node's networkInterfaces() skips it
    fcntl.ioctl(s, 0x8916, struct.pack('16sH2s4s8s', b'lan0', socket.AF_INET, b'\0\0', socket.inet_aton('10.77.0.2'), b'\0' * 8))
    ifs = (b'lan0', b'lo')
except OSError as e:
    print(f"[nsrun] no LAN interface ({e}) - the remote legs will fail", file=sys.stderr)
    ifs = (b'lo',)
for n in ifs:
    r = fcntl.ioctl(s, 0x8913, struct.pack('16sH14s', n, 0, b'\0' * 14))
    fl = struct.unpack('16sH14s', r)[1] | 1
    fcntl.ioctl(s, 0x8914, struct.pack('16sH14s', n, fl, b'\0' * 14))
priv = os.path.abspath(sys.argv[1])
os.makedirs(priv, exist_ok=True)
os.chmod(priv, 0o1777)
gc = priv + ".gitconfig"
with open(gc, "w") as f:
    f.write("[user]\n\tname = gate\n\temail = gate@localhost\n[commit]\n\tgpgsign = false\n")
subprocess.run(['mount', '--bind', priv, '/tmp'], check=True)
os.environ["GIT_CONFIG_GLOBAL"] = gc
os.execvp(sys.argv[2], sys.argv[2:])

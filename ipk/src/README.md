# Future on-router helper (mipsel)

Python `keengen.py` stays on the PC. On Entware we need a small binary later:

- serve static files (or leave busybox httpd)
- optional: read/write `/opt/etc/xray/configs/*.json` and `.lst`
- optional: `sudo -n /opt/sbin/xkeen -restart` with a narrow sudoers rule

Language candidates: Go (`GOOS=linux GOARCH=mipsle GOMIPS=softfloat`) or C.
Nothing to build here yet — scaffold only.

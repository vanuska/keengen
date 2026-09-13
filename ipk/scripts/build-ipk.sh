#!/usr/bin/env bash
# Build Entware .ipk: static web + mipsel keengen-httpd.
# Cross-compile first (or pass prebuilt binary):
#   GOOS=linux GOARCH=mipsle GOMIPS=softfloat CGO_ENABLED=0 \
#     go build -trimpath -ldflags='-s -w' -o ipk/files/opt/sbin/keengen-httpd ./ipk/src/keengen-httpd
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IPK="$ROOT/ipk"
WEB="$ROOT/web"
DIST="$ROOT/dist"
STAGE="$DIST/stage"
BIN_SRC="$IPK/files/opt/sbin/keengen-httpd"
PKG_NAME=keengen
PKG_VER=0.1.1-1
ARCH=mipsel-3.4
OUT="$DIST/${PKG_NAME}_${PKG_VER}_${ARCH}.ipk"

if [[ ! -d "$WEB" ]]; then
  echo "missing web/" >&2
  exit 1
fi
if [[ ! -x "$BIN_SRC" && ! -f "$BIN_SRC" ]]; then
  echo "missing binary: $BIN_SRC" >&2
  echo "build with GOOS=linux GOARCH=mipsle GOMIPS=softfloat first" >&2
  exit 1
fi

rm -rf "$STAGE"
mkdir -p "$STAGE/control" "$STAGE/data" "$DIST" "$IPK/files/opt/sbin"

mkdir -p "$STAGE/data/opt/share/keengen"
cp -a "$IPK/files/opt/." "$STAGE/data/opt/"
rm -rf "$STAGE/data/opt/share/keengen/www"
cp -a "$WEB" "$STAGE/data/opt/share/keengen/www"
rm -f "$STAGE/data/opt/sbin/.gitkeep"
# Entware rejects shebangs with CR (#!/bin/sh\r → "not found").
# Sourced conf with CR breaks KEENGEN_WWW=...\r. Strip CR from all staged text
# (skip mipsel binary only). Git Bash sed -i is unreliable on Windows — use Python.
STAGE_DATA="$STAGE/data" python3 - <<'PY'
import os
from pathlib import Path
root = Path(os.environ["STAGE_DATA"])
n = 0
for p in root.rglob("*"):
    if not p.is_file() or p.name == "keengen-httpd":
        continue
    raw = p.read_bytes()
    if b"\r" not in raw:
        continue
    p.write_bytes(raw.replace(b"\r\n", b"\n").replace(b"\r", b"\n"))
    n += 1
print("stripped CR from", n, "files")
PY
# Match stock Entware modes (dirs/exec 755, data files 644).
find "$STAGE/data" -type d -exec chmod 755 {} +
find "$STAGE/data" -type f -exec chmod 644 {} +
chmod 755 "$STAGE/data/opt/etc/init.d/S99keengen" "$STAGE/data/opt/sbin/keengen-httpd"

# Entware opkg expects lowercase ./control inside control.tar.gz.
SIZE=$(du -sk "$STAGE/data" | awk '{print $1}')
{
  tr -d '\r' < "$IPK/control/CONTROL"
  printf '\nInstalled-Size: %s\n' "$SIZE"
} > "$STAGE/control/control"

(
  cd "$STAGE/control"
  tar --format=ustar --owner=0 --group=0 -czf "$STAGE/control.tar.gz" ./control
)
# Pack data.tar.gz with explicit Unix modes (Windows/Git Bash chmod is unreliable for ELF).
rm -f "$STAGE/data.tar.gz"
STAGE_DATA="$STAGE/data" STAGE_OUT="$STAGE/data.tar.gz" python3 - <<'PY'
import os
import tarfile
from pathlib import Path

stage = Path(os.environ["STAGE_DATA"])
out = Path(os.environ["STAGE_OUT"])
exec_names = {"keengen-httpd", "S99keengen"}

def fix_mode(ti: tarfile.TarInfo):
    name = ti.name.rstrip("/")
    base = name.rsplit("/", 1)[-1]
    ti.uid = ti.gid = 0
    ti.uname = ti.gname = ""
    if ti.isdir():
        ti.mode = 0o755
    elif base in exec_names or name.endswith(".sh"):
        ti.mode = 0o755
    else:
        ti.mode = 0o644
    return ti

with tarfile.open(out, "w:gz", format=tarfile.USTAR_FORMAT) as tar:
    tar.add(str(stage), arcname=".", recursive=True, filter=fix_mode)
print("packed", out, "bytes", out.stat().st_size)
PY
printf '2.0\n' > "$STAGE/debian-binary"

# Entware (bin.entware.net) ships .ipk as gzip(tar), NOT Debian ar.
# Member order and names match stock packages: ./debian-binary ./data.tar.gz ./control.tar.gz
rm -f "$OUT"
(
  cd "$STAGE"
  tar --format=ustar --owner=0 --group=0 -czf "$OUT" \
    ./debian-binary ./data.tar.gz ./control.tar.gz
)

echo "built $OUT"
# Stable name for releases/latest/download/keengen_mipsel-3.4.ipk
STABLE="$DIST/keengen_mipsel-3.4.ipk"
cp -f "$OUT" "$STABLE"
ls -la "$OUT" "$STABLE"
file "$OUT" 2>/dev/null || true
file "$STAGE/data/opt/sbin/keengen-httpd" 2>/dev/null || true
OUT_IPK="$OUT" python3 -c "import os; d=open(os.environ['OUT_IPK'],'rb').read(2); assert d==b'\\x1f\\x8b', d"

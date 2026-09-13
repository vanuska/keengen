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
PKG_VER=0.1.0-1
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
chmod 755 "$STAGE/data/opt/etc/init.d/S99keengen" "$STAGE/data/opt/sbin/keengen-httpd" || true

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
(
  cd "$STAGE/data"
  tar --format=ustar --owner=0 --group=0 -czf "$STAGE/data.tar.gz" ./opt
)
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
ls -la "$OUT"
file "$OUT" 2>/dev/null || true
file "$STAGE/data/opt/sbin/keengen-httpd" 2>/dev/null || true
python3 -c "d=open(r'''$OUT''','rb').read(2); assert d==b'\\x1f\\x8b', d"

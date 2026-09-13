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
chmod 755 "$STAGE/data/opt/etc/init.d/S99keengen" "$STAGE/data/opt/sbin/keengen-httpd" || true

cp "$IPK/control/CONTROL" "$STAGE/control/CONTROL"
SIZE=$(du -sk "$STAGE/data" | awk '{print $1}')
printf '\nInstalled-Size: %s\n' "$SIZE" >> "$STAGE/control/CONTROL"

(
  cd "$STAGE/control"
  tar --format=ustar -czf "$STAGE/control.tar.gz" .
)
(
  cd "$STAGE/data"
  tar --format=ustar -czf "$STAGE/data.tar.gz" .
)
printf '2.0\n' > "$STAGE/debian-binary"
(
  cd "$STAGE"
  tar --format=ustar -czf "$OUT" debian-binary control.tar.gz data.tar.gz
)

echo "built $OUT"
ls -la "$OUT"
file "$STAGE/data/opt/sbin/keengen-httpd" 2>/dev/null || true

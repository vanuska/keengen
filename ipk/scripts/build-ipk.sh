#!/usr/bin/env bash
# Build a scaffold Entware .ipk (static web + init + conf). No cross-compile.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IPK="$ROOT/ipk"
WEB="$ROOT/web"
DIST="$ROOT/dist"
STAGE="$DIST/stage"
PKG_NAME=keengen
PKG_VER=0.0.1-1
ARCH=mipsel-3.4
OUT="$DIST/${PKG_NAME}_${PKG_VER}_${ARCH}.ipk"

if [[ ! -d "$WEB" ]]; then
  echo "missing web/ next to ipk/" >&2
  exit 1
fi

rm -rf "$STAGE"
mkdir -p "$STAGE/control" "$STAGE/data" "$DIST"

# data tree
mkdir -p "$STAGE/data/opt/share/keengen"
cp -a "$IPK/files/opt/." "$STAGE/data/opt/"
rm -rf "$STAGE/data/opt/share/keengen/www"
cp -a "$WEB" "$STAGE/data/opt/share/keengen/www"
chmod 755 "$STAGE/data/opt/etc/init.d/S99keengen" || true

# control
cp "$IPK/control/CONTROL" "$STAGE/control/CONTROL"
# Installed-Size (approx)
SIZE=$(du -sk "$STAGE/data" | awk '{print $1}')
printf '\nInstalled-Size: %s\n' "$SIZE" >> "$STAGE/control/CONTROL"

# tarballs (ustar)
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

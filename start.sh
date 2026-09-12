#!/bin/sh
set -e
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  exec python3 start.py "$@"
fi
if command -v python >/dev/null 2>&1; then
  exec python start.py "$@"
fi
echo "Need Python 3 in PATH (python3)." >&2
echo "Linux: sudo apt install python3 python3-venv python3-pip" >&2
echo "macOS: brew install python" >&2
exit 1
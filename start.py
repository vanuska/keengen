#!/usr/bin/env python3
"""Bootstrap keengen on Windows, Linux, and macOS.

Creates .venv next to this file, installs requirements, opens the UI,
then runs keengen.py. Extra args go to keengen.py (--port, --bind).
"""
from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
import venv
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
VENV = HERE / ".venv"
REQ = HERE / "requirements.txt"
HELPER = HERE / "keengen.py"
URL = "http://127.0.0.1:8765/"
IS_WIN = os.name == "nt"
VENV_PY = VENV / ("Scripts/python.exe" if IS_WIN else "bin/python")


def _die(msg: str, code: int = 1) -> int:
    print(msg, file=sys.stderr)
    return code


def ensure_venv() -> int:
    if not REQ.is_file() or not HELPER.is_file():
        return _die("put start.py next to keengen.py and requirements.txt")
    if not VENV_PY.is_file():
        print("creating .venv ...")
        try:
            venv.create(VENV, with_pip=True)
        except Exception as exc:
            return _die(
                "venv failed (%s). Linux: sudo apt install python3-venv. "
                "macOS: brew install python. Windows: python.org + PATH."
                % exc
            )
    pip = [str(VENV_PY), "-m", "pip", "install", "-q", "-r", str(REQ)]
    try:
        subprocess.check_call(pip)
    except subprocess.CalledProcessError:
        return _die("pip install failed")
    return 0


def open_browser() -> None:
    time.sleep(1.2)
    try:
        webbrowser.open(URL)
    except Exception:
        pass


def main(argv: list[str] | None = None) -> int:
    os.chdir(HERE)
    extra = list(sys.argv[1:] if argv is None else argv)
    err = ensure_venv()
    if err:
        return err
    print("keengen UI %s" % URL)
    print("leave this window open. stop: Ctrl+C")
    threading.Thread(target=open_browser, daemon=True).start()
    return subprocess.call([str(VENV_PY), str(HELPER), *extra])


if __name__ == "__main__":
    raise SystemExit(main())

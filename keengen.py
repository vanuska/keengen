#!/usr/bin/env python3
"""Local keengen helper: static UI on 127.0.0.1 + optional SSH to Keenetic.

Does not log passwords or file bodies. SSH only to private IPs.
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import mimetypes
import os
import re
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"

USER_RE = re.compile(r"^[A-Za-z0-9._-]{1,32}$")
JSON_REMOTE = {
    "01_log.json": "/opt/etc/xray/configs/01_log.json",
    "02_dns.json": "/opt/etc/xray/configs/02_dns.json",
    "03_inbounds.json": "/opt/etc/xray/configs/03_inbounds.json",
    "04_outbounds.json": "/opt/etc/xray/configs/04_outbounds.json",
    "05_routing.json": "/opt/etc/xray/configs/05_routing.json",
    "06_policy.json": "/opt/etc/xray/configs/06_policy.json",
}
LIST_REMOTE = {
    "ip_exclude": "/opt/etc/xkeen/ip_exclude.lst",
    "port_exclude": "/opt/etc/xkeen/port_exclude.lst",
    "port_proxying": "/opt/etc/xkeen/port_proxying.lst",
    "xkeen": "/opt/etc/xkeen/xkeen.json",
}
ALLOWED_REMOTE = {**JSON_REMOTE, **LIST_REMOTE}
WRITE_LIMIT = 262144
AUTH_LIMIT = 4096
FILE_LIMIT = 120000
INSTALL_LIMIT = 8192
IPK_NAME = "keengen_0.1.0-1_mipsel-3.4.ipk"
IPK_URL = (
    "https://github.com/vanuska/keengen/releases/download/v0.1.0/" + IPK_NAME
)
INSTALL_TIMEOUT = 120


def _private_host(host: str) -> bool:
    try:
        return ipaddress.ip_address(host).is_private
    except ValueError:
        return False


def parse_auth(raw: dict | None) -> dict:
    src = raw if isinstance(raw, dict) else {}
    host = str(src.get("host") or "").strip()
    user = str(src.get("user") or src.get("login") or "").strip()
    try:
        port = int(src.get("port") or 22)
    except (TypeError, ValueError):
        port = 22
    password = src.get("password")
    password = str(password) if password is not None and str(password) != "" else ""
    if not host or not _private_host(host):
        raise ValueError("host")
    if not USER_RE.match(user):
        raise ValueError("user")
    if port < 1 or port > 65535:
        raise ValueError("port")
    if len(password) > 128:
        raise ValueError("password")
    return {"host": host, "user": user, "port": port, "password": password}


def _ssh_client(auth: dict):
    try:
        import paramiko
    except ImportError as exc:
        raise RuntimeError("need-paramiko") from exc
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kwargs = {
        "hostname": auth["host"],
        "port": auth["port"],
        "username": auth["user"],
        "timeout": 8,
        "allow_agent": False,
        "look_for_keys": False,
        "banner_timeout": 12,
        "auth_timeout": 12,
    }
    if auth["password"]:
        kwargs["password"] = auth["password"]
    else:
        key = os.environ.get("KEENGEN_SSH_KEY") or ""
        if not key:
            raise RuntimeError("need-key")
        kwargs["key_filename"] = os.path.expanduser(key)
    client.connect(**kwargs)
    return client


def ssh_exec(auth: dict, command: str, stdin: bytes | None = None, timeout: int = 20) -> tuple[int, bytes, str]:
    client = _ssh_client(auth)
    try:
        chan = client.get_transport().open_session()
        chan.settimeout(timeout)
        chan.exec_command(command)
        if stdin is not None:
            chan.sendall(stdin)
            chan.shutdown_write()
        out = b""
        err = b""
        while True:
            if chan.recv_ready():
                chunk = chan.recv(65536)
                if not chunk:
                    break
                out += chunk
                continue
            if chan.recv_stderr_ready():
                err += chan.recv_stderr(65536)
                continue
            if chan.exit_status_ready():
                while chan.recv_ready():
                    out += chan.recv(65536)
                while chan.recv_stderr_ready():
                    err += chan.recv_stderr(65536)
                break
            time.sleep(0.02)
        code = chan.recv_exit_status()
        return code, out, err.decode("utf-8", "replace").strip()
    finally:
        client.close()


def ssh_probe(auth: dict) -> dict:
    code, _body, _err = ssh_exec(auth, "id -un", timeout=12)
    if code == 0:
        print("probe ok host=%s user=%s" % (auth["host"], auth["user"]), file=sys.stderr, flush=True)
        return {"ok": True, "where": "lan", "host": auth["host"], "user": auth["user"]}
    print("probe fail host=%s" % auth["host"], file=sys.stderr, flush=True)
    return {"ok": False, "error": "ssh-failed"}


def parse_write_files(raw: dict) -> dict[str, str]:
    src = raw.get("files")
    if not isinstance(src, dict) or not src:
        raise ValueError("files")
    out: dict[str, str] = {}
    for name, value in src.items():
        if name not in ALLOWED_REMOTE:
            raise ValueError("name")
        if name in JSON_REMOTE or name == "xkeen":
            if isinstance(value, (dict, list)):
                text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
            elif isinstance(value, str):
                json.loads(value)
                text = value if value.endswith("\n") else value + "\n"
            else:
                raise ValueError("json")
        else:
            if not isinstance(value, str):
                raise ValueError("lst")
            text = value
        if len(text.encode("utf-8")) > FILE_LIMIT:
            raise ValueError("too-big")
        out[name] = text
    return out


def ssh_put(auth: dict, path: str, text: str) -> tuple[int, str]:
    q = path.replace("'", "'\\''")
    cmd = "umask 022; cat > '%s.new' && mv -f '%s.new' '%s'" % (q, q, q)
    code, _body, err = ssh_exec(auth, cmd, stdin=text.encode("utf-8"), timeout=20)
    return code, err


def apply_write(auth: dict, files: dict[str, str], restart: bool) -> dict:
    stamp = time.strftime("%Y%m%d-%H%M%S")
    bdir = "/tmp/keengen-backup-%s" % stamp
    code, _body, _err = ssh_exec(auth, "mkdir -p '%s'" % bdir, timeout=12)
    if code != 0:
        return {"ok": False, "error": "backup-failed"}
    written: list[str] = []
    for name, text in files.items():
        dest = ALLOWED_REMOTE[name]
        ssh_exec(auth, "cp -a '%s' '%s/' 2>/dev/null || true" % (dest, bdir), timeout=12)
        code, _err = ssh_put(auth, dest, text)
        if code != 0:
            print("write fail %s" % name, file=sys.stderr, flush=True)
            return {"ok": False, "error": "write-failed", "backup": bdir, "written": written}
        print("wrote %s bytes=%d" % (name, len(text.encode("utf-8"))), file=sys.stderr, flush=True)
        written.append(name)
    restarted = False
    if restart:
        code, _body, _err = ssh_exec(auth, "sudo -n /opt/sbin/xkeen -restart", timeout=50)
        restarted = code == 0
        if not restarted:
            print("restart fail", file=sys.stderr, flush=True)
            return {
                "ok": False,
                "error": "restart-failed",
                "backup": bdir,
                "written": written,
                "restarted": False,
            }
        print("restart ok", file=sys.stderr, flush=True)
    return {
        "ok": True,
        "where": "lan",
        "host": auth["host"],
        "written": written,
        "backup": bdir,
        "restarted": restarted,
    }


def collect(auth: dict) -> dict:
    files: dict = {}
    missing: list[str] = []
    errors: list[str] = []
    for name, path in {**JSON_REMOTE, **LIST_REMOTE}.items():
        code, body, err = ssh_exec(auth, "cat -- '%s'" % path.replace("'", "'\\''"), timeout=20)
        if code != 0:
            missing.append(name)
            if err:
                errors.append(name)
            print("miss %s bytes=0" % name, file=sys.stderr, flush=True)
            continue
        print("ok %s bytes=%d" % (name, len(body)), file=sys.stderr, flush=True)
        text = body.decode("utf-8", "replace")
        if name in JSON_REMOTE or name == "xkeen":
            try:
                files[name] = json.loads(text)
            except json.JSONDecodeError:
                files[name] = text
        else:
            files[name] = text
    return {
        "ok": True,
        "where": "lan",
        "host": auth["host"],
        "files": files,
        "missing": missing,
        "errors": len(errors),
    }


def install_ipk(auth: dict) -> dict:
    """Download Entware IPK from GitHub Release and install via opkg (needs root)."""
    steps: list[dict] = []
    stamp = time.strftime("%Y%m%d-%H%M%S")
    ipk_path = "/tmp/%s" % IPK_NAME

    def step(name: str, cmd: str, timeout: int = 40) -> tuple[int, str]:
        code, out, err = ssh_exec(auth, cmd, timeout=timeout)
        detail = (out.decode("utf-8", "replace") + ("\n" + err if err else "")).strip()
        if len(detail) > 2000:
            detail = detail[-2000:]
        steps.append({"step": name, "ok": code == 0, "code": code, "detail": detail})
        return code, detail

    # Prefer /opt/backup under root; fall back to keengen home.
    bdir = "/opt/backup/keengen-pre-%s" % stamp
    code, _ = step(
        "backup",
        "mkdir -p '%s' && cp -a /opt/etc/xray/configs '%s/' 2>/dev/null; "
        "cp -a /opt/etc/xkeen '%s/' 2>/dev/null; "
        "ls -la '%s' >/dev/null" % (bdir, bdir, bdir, bdir),
        timeout=30,
    )
    if code != 0:
        bdir = "/opt/home/keengen/backup/keengen-pre-%s" % stamp
        code, _ = step(
            "backup-fallback",
            "mkdir -p '%s' && cp -a /opt/etc/xray/configs '%s/' 2>/dev/null; "
            "cp -a /opt/etc/xkeen '%s/' 2>/dev/null; ls -la '%s'" % (bdir, bdir, bdir, bdir),
            timeout=30,
        )
        if code != 0:
            return {"ok": False, "error": "backup-failed", "steps": steps, "backup": bdir}

    code, _ = step(
        "download",
        "wget -O '%s' '%s'" % (ipk_path, IPK_URL),
        timeout=INSTALL_TIMEOUT,
    )
    if code != 0:
        return {"ok": False, "error": "download-failed", "steps": steps, "backup": bdir}

    # Reinstall if already present.
    step(
        "remove-old",
        "opkg list-installed keengen >/dev/null 2>&1 && opkg remove keengen || true",
        timeout=40,
    )
    code, detail = step(
        "opkg-install",
        "opkg install '%s'" % ipk_path,
        timeout=60,
    )
    if code != 0:
        print("install-ipk fail opkg: %s" % detail[:200], file=sys.stderr, flush=True)
        return {"ok": False, "error": "opkg-failed", "steps": steps, "backup": bdir}

    code, _ = step(
        "start",
        "/opt/etc/init.d/S99keengen stop 2>/dev/null; /opt/etc/init.d/S99keengen start",
        timeout=20,
    )
    if code != 0:
        return {"ok": False, "error": "start-failed", "steps": steps, "backup": bdir}

    code, health = step(
        "health",
        "sleep 1; wget -q -O - http://127.0.0.1:1001/api/health",
        timeout=15,
    )
    if code != 0 or "keengen" not in health:
        return {
            "ok": False,
            "error": "health-failed",
            "steps": steps,
            "backup": bdir,
            "ui": "http://%s:1001/" % auth["host"],
        }

    print("install-ipk ok host=%s backup=%s" % (auth["host"], bdir), file=sys.stderr, flush=True)
    return {
        "ok": True,
        "where": "lan",
        "host": auth["host"],
        "user": auth["user"],
        "backup": bdir,
        "ui": "http://%s:1001/" % auth["host"],
        "steps": steps,
    }


def _safe_web_path(url_path: str) -> Path | None:
    raw = unquote(url_path.split("?", 1)[0])
    if raw in ("", "/"):
        raw = "/index.html"
    rel = raw.lstrip("/")
    if ".." in Path(rel).parts:
        return None
    path = (WEB / rel).resolve()
    try:
        path.relative_to(WEB.resolve())
    except ValueError:
        return None
    if path.is_file():
        return path
    return None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send_json(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _ssh_error(self, exc: Exception) -> None:
        msg = str(exc)
        if msg == "need-paramiko":
            self._send_json(501, {"ok": False, "error": "pip install paramiko"})
            return
        if msg == "need-key":
            self._send_json(400, {"ok": False, "error": "need-password-or-KEENGEN_SSH_KEY"})
            return
        self._send_json(502, {"ok": False, "error": "ssh-failed"})

    def _read_json_body(self, limit: int) -> dict | None:
        n = int(self.headers.get("Content-Length") or "0")
        if n < 0 or n > limit:
            self._send_json(413, {"ok": False, "error": "too-large"})
            return None
        raw = self.rfile.read(n) if n else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._send_json(400, {"ok": False, "error": "bad-json"})
            return None
        if not isinstance(body, dict):
            self._send_json(400, {"ok": False, "error": "bad-json"})
            return None
        return body

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/keenetic/where":
            self._send_json(200, {"ok": True, "where": "lan"})
            return
        if path == "/api/health":
            self._send_json(200, {"ok": True, "service": "keengen"})
            return
        if path.startswith("/api/"):
            self._send_json(404, {"ok": False, "error": "not-found"})
            return
        file_path = _safe_web_path(path)
        if file_path is None:
            self.send_error(404)
            return
        data = file_path.read_bytes()
        ctype = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path.endswith("/write"):
            limit = WRITE_LIMIT
        elif path.endswith("/install-ipk"):
            limit = INSTALL_LIMIT
        else:
            limit = AUTH_LIMIT
        body = self._read_json_body(limit)
        if body is None:
            return
        if path == "/api/keenetic/probe":
            try:
                auth = parse_auth(body)
                result = ssh_probe(auth)
                self._send_json(200 if result.get("ok") else 401, result)
            except ValueError:
                self._send_json(400, {"ok": False, "error": "bad-auth"})
            except RuntimeError as exc:
                self._ssh_error(exc)
            except Exception:
                self._send_json(502, {"ok": False, "error": "probe-failed"})
            return
        if path == "/api/keenetic/read":
            try:
                auth = parse_auth(body)
                self._send_json(200, collect(auth))
            except ValueError:
                self._send_json(400, {"ok": False, "error": "bad-auth"})
            except RuntimeError as exc:
                self._ssh_error(exc)
            except Exception:
                self._send_json(502, {"ok": False, "error": "read-failed"})
            return
        if path == "/api/keenetic/write":
            try:
                auth = parse_auth(body)
                files = parse_write_files(body)
                restart = bool(body.get("restart", True))
                result = apply_write(auth, files, restart)
                self._send_json(200 if result.get("ok") else 502, result)
            except (ValueError, json.JSONDecodeError):
                self._send_json(400, {"ok": False, "error": "bad-write"})
            except RuntimeError as exc:
                self._ssh_error(exc)
            except Exception:
                self._send_json(502, {"ok": False, "error": "write-failed"})
            return
        if path == "/api/keenetic/install-ipk":
            try:
                auth = parse_auth(body)
                result = install_ipk(auth)
                self._send_json(200 if result.get("ok") else 502, result)
            except ValueError:
                self._send_json(400, {"ok": False, "error": "bad-auth"})
            except RuntimeError as exc:
                self._ssh_error(exc)
            except Exception:
                self._send_json(502, {"ok": False, "error": "install-failed"})
            return
        self._send_json(404, {"ok": False, "error": "not-found"})


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="keengen local helper")
    p.add_argument("--bind", default="127.0.0.1", help="bind address (default 127.0.0.1)")
    p.add_argument("--port", type=int, default=8765)
    args = p.parse_args(argv)
    if not WEB.is_dir():
        print("missing web/ next to keengen.py", file=sys.stderr)
        return 1
    httpd = ThreadingHTTPServer((args.bind, args.port), Handler)
    print("keengen UI http://%s:%s/" % (args.bind, args.port), flush=True)
    if args.bind not in ("127.0.0.1", "::1"):
        print("warning: bind is not loopback; SSH API is reachable on this address", file=sys.stderr)
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

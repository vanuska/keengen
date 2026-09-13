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
BACKUPS = HERE / "backups"
LAST_IPK = BACKUPS / "last-installed.ipk"

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
INSTALL_TIMEOUT = 120
GITHUB_REPO = "vanuska/keengen"
# Stable name on each Release (also versioned keengen_X.Y.Z-1_mipsel-3.4.ipk).
IPK_ASSET_STABLE = "keengen_mipsel-3.4.ipk"


def app_version() -> str:
    for path in (HERE / "VERSION", HERE.parent / "VERSION"):
        try:
            v = path.read_text(encoding="utf-8").strip().splitlines()[0].strip()
            if v:
                return v
        except OSError:
            continue
    return "0.0.0"


def _http_json(url: str, timeout: int = 20) -> dict:
    import urllib.error
    import urllib.request

    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "keengen/%s" % app_version(),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError("github-failed:%s" % exc) from exc


def resolve_latest_release() -> dict:
    """Return {tag, version, ipk_url, ipk_name} for latest GitHub Release."""
    data = _http_json("https://api.github.com/repos/%s/releases/latest" % GITHUB_REPO)
    tag = str(data.get("tag_name") or "").strip()
    version = tag[1:] if tag.startswith("v") else tag
    assets = data.get("assets") if isinstance(data.get("assets"), list) else []
    stable = None
    versioned = None
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        name = str(asset.get("name") or "")
        url = str(asset.get("browser_download_url") or "")
        if not name or not url:
            continue
        if name == IPK_ASSET_STABLE:
            stable = (name, url)
        if name.startswith("keengen_") and name.endswith("_mipsel-3.4.ipk"):
            versioned = (name, url)
    chosen = stable or versioned
    if not chosen:
        raise RuntimeError("no-ipk-asset")
    return {
        "tag": tag,
        "version": version or app_version(),
        "ipk_name": chosen[0],
        "ipk_url": chosen[1],
    }


def check_updates(auth: dict | None = None) -> dict:
    local = app_version()
    try:
        latest = resolve_latest_release()
    except RuntimeError as exc:
        return {
            "ok": False,
            "error": str(exc),
            "local_version": local,
            "service": "keengen",
        }
    remote_ver = latest["version"]
    out = {
        "ok": True,
        "service": "keengen",
        "local_version": local,
        "latest_version": remote_ver,
        "latest_tag": latest["tag"],
        "ipk_url": latest["ipk_url"],
        "ipk_name": latest["ipk_name"],
        "app_update": _ver_tuple(remote_ver) > _ver_tuple(local),
        "router_version": None,
        "router_installed": False,
        "ipk_update": False,
    }
    if auth:
        code, body, _err = ssh_exec(
            auth,
            "wget -q -O - http://127.0.0.1:1001/api/health 2>/dev/null || "
            "opkg list-installed keengen 2>/dev/null",
            timeout=15,
        )
        text = body.decode("utf-8", "replace").strip()
        if code == 0 and text:
            out["router_installed"] = True
            try:
                hj = json.loads(text)
                rv = str(hj.get("version") or "").strip()
                if rv:
                    out["router_version"] = rv
            except json.JSONDecodeError:
                # opkg list-installed: "keengen - 0.1.0-2"
                if "keengen" in text:
                    parts = text.replace("-", " ").split()
                    for p in parts:
                        if p[0:1].isdigit():
                            out["router_version"] = p.split("-")[0]
                            break
            rv = out.get("router_version") or "0"
            out["ipk_update"] = _ver_tuple(remote_ver) > _ver_tuple(rv)
    return out


def _ver_tuple(v: str) -> tuple:
    parts: list[int] = []
    for chunk in str(v).strip().split("."):
        num = ""
        for ch in chunk:
            if ch.isdigit():
                num += ch
            else:
                break
        parts.append(int(num) if num else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:4])


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


def snapshot_configs(auth: dict, reason: str = "manual") -> dict:
    """Always-on config backup: router dir + copy to local backups/<stamp>/."""
    stamp = time.strftime("%Y%m%d-%H%M%S")
    bdir = "/opt/backup/keengen-%s-%s" % (reason, stamp)
    code, _out, _err = ssh_exec(
        auth,
        "mkdir -p '%s' && cp -a /opt/etc/xray/configs '%s/' 2>/dev/null; "
        "cp -a /opt/etc/xkeen '%s/' 2>/dev/null; ls -la '%s'" % (bdir, bdir, bdir, bdir),
        timeout=30,
    )
    if code != 0:
        bdir = "/opt/home/keengen/backup/keengen-%s-%s" % (reason, stamp)
        code, _out, _err = ssh_exec(
            auth,
            "mkdir -p '%s' && cp -a /opt/etc/xray/configs '%s/' 2>/dev/null; "
            "cp -a /opt/etc/xkeen '%s/' 2>/dev/null; ls -la '%s'" % (bdir, bdir, bdir, bdir),
            timeout=30,
        )
        if code != 0:
            return {"ok": False, "error": "backup-failed", "reason": reason}
    ok_pull, pull_detail = pull_router_backup(auth, bdir, stamp)
    _save_local_backup_meta(
        stamp,
        reason=reason,
        router_backup=bdir,
        host=auth.get("host"),
        local_ok=ok_pull,
        local_path=pull_detail if ok_pull else None,
    )
    return {
        "ok": True,
        "reason": reason,
        "stamp": stamp,
        "router_backup": bdir,
        "local_backup": stamp if ok_pull else None,
        "local_ok": ok_pull,
        "detail": pull_detail,
    }


def remove_ipk(auth: dict) -> dict:
    steps: list[dict] = []
    # Snapshot configs before remove
    snap = snapshot_configs(auth, reason="pre-remove")
    steps.append({"step": "backup", "ok": snap.get("ok"), "detail": json.dumps(snap, ensure_ascii=False)[:500]})
    code, out, err = ssh_exec(
        auth,
        "/opt/etc/init.d/S99keengen stop 2>/dev/null; "
        "opkg list-installed keengen >/dev/null 2>&1 && opkg remove keengen || true",
        timeout=60,
    )
    detail = (out.decode("utf-8", "replace") + "\n" + err).strip()[-1500:]
    steps.append({"step": "remove", "ok": code == 0, "detail": detail})
    return {
        "ok": code == 0,
        "error": None if code == 0 else "remove-failed",
        "backup": snap,
        "steps": steps,
    }


def collect(auth: dict) -> dict:
    snap = snapshot_configs(auth, reason="read")
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
        "backup": snap,
    }


def _http_bytes(url: str, timeout: int = 120) -> bytes:
    import urllib.error
    import urllib.request

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "keengen/%s" % app_version()},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError("download-failed:%s" % exc) from exc
    if not data:
        raise RuntimeError("download-empty")
    return data


def _backup_dir(stamp: str) -> Path:
    d = BACKUPS / stamp
    d.mkdir(parents=True, exist_ok=True)
    return d


def _save_local_backup_meta(stamp: str, **extra: object) -> Path:
    meta = {
        "stamp": stamp,
        "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "app_version": app_version(),
    }
    meta.update(extra)
    path = _backup_dir(stamp) / "meta.json"
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def _sftp_download_tree(sftp, remote: str, local: Path) -> int:
    """Recursively download remote dir via SFTP. Returns file count."""
    import stat as _stat

    local.mkdir(parents=True, exist_ok=True)
    count = 0
    for entry in sftp.listdir_attr(remote):
        name = entry.filename
        if name in (".", ".."):
            continue
        rpath = remote.rstrip("/") + "/" + name
        lpath = local / name
        if _stat.S_ISDIR(entry.st_mode):
            count += _sftp_download_tree(sftp, rpath, lpath)
        elif _stat.S_ISREG(entry.st_mode):
            sftp.get(rpath, str(lpath))
            count += 1
    return count


def pull_router_backup(auth: dict, remote_dir: str, stamp: str) -> tuple[bool, str]:
    """SFTP-download remote backup dir; pack configs.tgz on the PC (BusyBox tar has no -c)."""
    import tarfile

    dest_dir = _backup_dir(stamp)
    tree_dir = dest_dir / "router-tree"
    if tree_dir.exists():
        import shutil

        shutil.rmtree(tree_dir, ignore_errors=True)
    tree_dir.mkdir(parents=True, exist_ok=True)

    client = _ssh_client(auth)
    try:
        sftp = client.open_sftp()
        try:
            try:
                sftp.stat(remote_dir)
            except OSError as exc:
                return False, "remote-missing:%s" % exc
            # Marker file so empty trees still produce a valid archive.
            marker = remote_dir.rstrip("/") + "/.keengen-backup"
            try:
                with sftp.file(marker, "w") as fh:
                    fh.write(b"")
            except OSError:
                pass
            nfiles = _sftp_download_tree(sftp, remote_dir, tree_dir)
        finally:
            sftp.close()
    except Exception as exc:  # noqa: BLE001 — surface any SFTP/SSH failure to caller
        return False, "sftp-failed:%s" % exc
    finally:
        client.close()

    tgz = dest_dir / "configs.tgz"
    with tarfile.open(tgz, "w:gz", format=tarfile.USTAR_FORMAT) as tar:
        # Archive contents of router-tree (configs/, xkeen/, …) at archive root.
        for child in sorted(tree_dir.iterdir()):
            tar.add(child, arcname=child.name)
    if not tgz.is_file() or tgz.stat().st_size < 20:
        return False, "empty-local-tgz"
    return True, "%s (files=%d)" % (tgz, nfiles)


def list_local_backups() -> dict:
    items: list[dict] = []
    if BACKUPS.is_dir():
        for child in sorted(BACKUPS.iterdir(), reverse=True):
            if not child.is_dir():
                continue
            meta: dict = {"stamp": child.name}
            mp = child / "meta.json"
            if mp.is_file():
                try:
                    meta.update(json.loads(mp.read_text(encoding="utf-8")))
                except (OSError, json.JSONDecodeError):
                    pass
            items.append({
                "id": child.name,
                "configs": (child / "configs.tgz").is_file(),
                "ipk": (child / "installed.ipk").is_file(),
                "previous_ipk": (child / "previous-ipk.ipk").is_file(),
                "meta": meta,
            })
    return {
        "ok": True,
        "dir": str(BACKUPS),
        "items": items,
        "has_last_ipk": LAST_IPK.is_file(),
    }


def restore_configs(auth: dict, stamp: str) -> dict:
    stamp = re.sub(r"[^0-9A-Za-z._-]", "", stamp)
    tgz = BACKUPS / stamp / "configs.tgz"
    if not tgz.is_file():
        return {"ok": False, "error": "no-configs-backup"}
    remote = "/tmp/keengen-restore-%s.tgz" % stamp
    code, _out, err = ssh_exec(
        auth,
        "cat > '%s'" % remote,
        stdin=tgz.read_bytes(),
        timeout=90,
    )
    if code != 0:
        return {"ok": False, "error": "upload-failed", "detail": err}
    cmd = (
        "set -e; U=/tmp/keengen-restore-unpack-%s; rm -rf \"$U\"; mkdir -p \"$U\"; "
        "tar -xzf '%s' -C \"$U\"; "
        "mkdir -p /opt/etc/xray/configs /opt/etc/xkeen; "
        "if [ -d \"$U/configs\" ]; then cp -a \"$U/configs/.\" /opt/etc/xray/configs/; fi; "
        "if [ -d \"$U/xkeen\" ]; then cp -a \"$U/xkeen/.\" /opt/etc/xkeen/; fi; "
        "rm -rf \"$U\" '%s'"
    ) % (stamp, remote, remote)
    code, out, err = ssh_exec(auth, cmd, timeout=60)
    if code != 0:
        return {"ok": False, "error": "restore-failed", "detail": (err or out.decode("utf-8", "replace"))[-1500:]}
    code_r, _b, _e = ssh_exec(auth, "sudo -n /opt/sbin/xkeen -restart || /opt/sbin/xkeen -restart", timeout=50)
    return {
        "ok": True,
        "stamp": stamp,
        "restarted": code_r == 0,
        "detail": "configs+xkeen restored from local backup",
    }


def restore_ipk(auth: dict, stamp: str = "", which: str = "previous") -> dict:
    """Reinstall IPK from local backup: previous (pre-upgrade) or installed (that run's package)."""
    stamp = re.sub(r"[^0-9A-Za-z._-]", "", stamp)
    which = which if which in ("previous", "installed", "last") else "previous"
    if which == "last":
        src = LAST_IPK
    elif stamp:
        name = "previous-ipk.ipk" if which == "previous" else "installed.ipk"
        src = BACKUPS / stamp / name
    else:
        src = LAST_IPK
    if not src.is_file():
        return {"ok": False, "error": "no-ipk-backup"}
    blob = src.read_bytes()
    remote = "/tmp/keengen-restore.ipk"
    steps: list[dict] = []
    code, _o, err = ssh_exec(auth, "cat > '%s'" % remote, stdin=blob, timeout=INSTALL_TIMEOUT)
    steps.append({"step": "upload", "ok": code == 0, "detail": err})
    if code != 0:
        return {"ok": False, "error": "upload-failed", "steps": steps}
    ssh_exec(auth, "opkg list-installed keengen >/dev/null 2>&1 && opkg remove keengen || true", timeout=40)
    code, out, err = ssh_exec(auth, "opkg install '%s'" % remote, timeout=60)
    detail = (out.decode("utf-8", "replace") + "\n" + err).strip()[-1500:]
    steps.append({"step": "opkg-install", "ok": code == 0, "detail": detail})
    if code != 0:
        return {"ok": False, "error": "opkg-failed", "steps": steps}
    code, out, err = ssh_exec(
        auth,
        "/opt/etc/init.d/S99keengen stop 2>/dev/null; /opt/etc/init.d/S99keengen start",
        timeout=20,
    )
    steps.append({"step": "start", "ok": code == 0, "detail": err})
    return {
        "ok": code == 0,
        "error": None if code == 0 else "start-failed",
        "source": str(src),
        "ui": "http://%s:1001/" % auth["host"],
        "steps": steps,
    }


def install_ipk(auth: dict) -> dict:
    """Download latest IPK on the PC (HTTPS), upload via SSH, opkg install (needs root).

    Entware busybox wget often has no HTTPS — do not wget on the router.
    Also saves a local backup under backups/<stamp>/ (configs + IPK snapshots).
    """
    steps: list[dict] = []
    stamp = time.strftime("%Y%m%d-%H%M%S")
    local_dir = _backup_dir(stamp)
    try:
        latest = resolve_latest_release()
    except RuntimeError as exc:
        return {"ok": False, "error": str(exc), "steps": steps}
    ipk_url = latest["ipk_url"]
    ipk_name = latest["ipk_name"]
    ipk_path = "/tmp/%s" % ipk_name.replace("'", "")
    steps.append({
        "step": "resolve-latest",
        "ok": True,
        "code": 0,
        "detail": "%s %s" % (latest.get("tag"), ipk_url),
    })

    def step(name: str, cmd: str, timeout: int = 40, stdin: bytes | None = None) -> tuple[int, str]:
        code, out, err = ssh_exec(auth, cmd, stdin=stdin, timeout=timeout)
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

    ok_pull, pull_detail = pull_router_backup(auth, bdir, stamp)
    steps.append({
        "step": "backup-local",
        "ok": ok_pull,
        "code": 0 if ok_pull else 1,
        "detail": pull_detail,
    })
    if LAST_IPK.is_file():
        prev = local_dir / "previous-ipk.ipk"
        prev.write_bytes(LAST_IPK.read_bytes())
        steps.append({
            "step": "snapshot-previous-ipk",
            "ok": True,
            "code": 0,
            "detail": str(prev),
        })

    try:
        blob = _http_bytes(ipk_url, timeout=INSTALL_TIMEOUT)
    except RuntimeError as exc:
        steps.append({"step": "download-pc", "ok": False, "code": 1, "detail": str(exc)})
        _save_local_backup_meta(stamp, router_backup=bdir, latest_tag=latest.get("tag"), failed="download")
        return {
            "ok": False,
            "error": "download-failed",
            "steps": steps,
            "backup": bdir,
            "local_backup": stamp,
        }
    steps.append({
        "step": "download-pc",
        "ok": True,
        "code": 0,
        "detail": "bytes=%d (HTTPS on PC; router wget has no SSL)" % len(blob),
    })
    (local_dir / "installed.ipk").write_bytes(blob)

    code, _ = step(
        "upload",
        "cat > '%s'" % ipk_path,
        timeout=INSTALL_TIMEOUT,
        stdin=blob,
    )
    if code != 0:
        _save_local_backup_meta(stamp, router_backup=bdir, latest_tag=latest.get("tag"), failed="upload")
        return {
            "ok": False,
            "error": "upload-failed",
            "steps": steps,
            "backup": bdir,
            "local_backup": stamp,
        }

    # Remove first so a same-version rebuild cannot leave a half-installed tree.
    step(
        "remove-old",
        "opkg list-installed keengen >/dev/null 2>&1 && opkg remove keengen || true; "
        "rm -rf /opt/share/keengen /opt/sbin/keengen-httpd /opt/etc/init.d/S99keengen",
        timeout=40,
    )
    code, detail = step(
        "opkg-install",
        "opkg install --force-reinstall --force-overwrite '%s'" % ipk_path,
        timeout=60,
    )
    if code != 0:
        print("install-ipk fail opkg: %s" % detail[:200], file=sys.stderr, flush=True)
        _save_local_backup_meta(stamp, router_backup=bdir, latest_tag=latest.get("tag"), failed="opkg")
        return {
            "ok": False,
            "error": "opkg-failed",
            "steps": steps,
            "backup": bdir,
            "local_backup": stamp,
        }

    code, detail = step(
        "verify-www",
        "test -d /opt/share/keengen/www && test -f /opt/share/keengen/www/index.html && "
        "test -x /opt/sbin/keengen-httpd && ls -la /opt/share/keengen/www",
        timeout=15,
    )
    if code != 0:
        _save_local_backup_meta(stamp, router_backup=bdir, latest_tag=latest.get("tag"), failed="verify-www")
        return {
            "ok": False,
            "error": "www-missing",
            "steps": steps,
            "backup": bdir,
            "local_backup": stamp,
        }

    code, _ = step(
        "start",
        "/opt/etc/init.d/S99keengen stop 2>/dev/null; /opt/etc/init.d/S99keengen start",
        timeout=20,
    )
    if code != 0:
        _save_local_backup_meta(stamp, router_backup=bdir, latest_tag=latest.get("tag"), failed="start")
        return {
            "ok": False,
            "error": "start-failed",
            "steps": steps,
            "backup": bdir,
            "local_backup": stamp,
        }

    code, health = step(
        "health",
        "sleep 1; wget -q -O - http://127.0.0.1:1001/api/health || "
        "curl -fsS http://127.0.0.1:1001/api/health",
        timeout=15,
    )
    if code != 0 or "keengen" not in health:
        _save_local_backup_meta(stamp, router_backup=bdir, latest_tag=latest.get("tag"), failed="health")
        return {
            "ok": False,
            "error": "health-failed",
            "steps": steps,
            "backup": bdir,
            "local_backup": stamp,
            "ui": "http://%s:1001/" % auth["host"],
            "installed_version": latest["version"],
        }

    LAST_IPK.write_bytes(blob)
    _save_local_backup_meta(
        stamp,
        router_backup=bdir,
        latest_tag=latest.get("tag"),
        installed_version=latest["version"],
        host=auth["host"],
    )
    print("install-ipk ok host=%s ver=%s local=%s" % (auth["host"], latest["version"], stamp), file=sys.stderr, flush=True)
    return {
        "ok": True,
        "where": "lan",
        "host": auth["host"],
        "user": auth["user"],
        "backup": bdir,
        "local_backup": stamp,
        "local_backup_dir": str(local_dir),
        "ui": "http://%s:1001/" % auth["host"],
        "installed_version": latest["version"],
        "latest_tag": latest["tag"],
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
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "keengen",
                    "version": app_version(),
                    "mode": "ssh",
                },
            )
            return
        if path == "/api/update/check":
            self._send_json(200, check_updates(None))
            return
        if path == "/api/backups":
            self._send_json(200, list_local_backups())
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
        if path == "/api/update/check":
            try:
                auth = None
                if body.get("host"):
                    auth = parse_auth(body)
                self._send_json(200, check_updates(auth))
            except ValueError:
                self._send_json(400, {"ok": False, "error": "bad-auth"})
            except RuntimeError as exc:
                self._ssh_error(exc)
            except Exception:
                self._send_json(502, {"ok": False, "error": "check-failed"})
            return
        if path == "/api/backups/restore-configs":
            try:
                auth = parse_auth(body)
                stamp = str(body.get("stamp") or body.get("id") or "").strip()
                result = restore_configs(auth, stamp)
                self._send_json(200 if result.get("ok") else 502, result)
            except ValueError:
                self._send_json(400, {"ok": False, "error": "bad-auth"})
            except RuntimeError as exc:
                self._ssh_error(exc)
            except Exception:
                self._send_json(502, {"ok": False, "error": "restore-failed"})
            return
        if path == "/api/backups/restore-ipk":
            try:
                auth = parse_auth(body)
                stamp = str(body.get("stamp") or body.get("id") or "").strip()
                which = str(body.get("which") or "previous").strip()
                result = restore_ipk(auth, stamp=stamp, which=which)
                self._send_json(200 if result.get("ok") else 502, result)
            except ValueError:
                self._send_json(400, {"ok": False, "error": "bad-auth"})
            except RuntimeError as exc:
                self._ssh_error(exc)
            except Exception:
                self._send_json(502, {"ok": False, "error": "restore-failed"})
            return
        if path == "/api/keenetic/remove-ipk":
            try:
                auth = parse_auth(body)
                result = remove_ipk(auth)
                self._send_json(200 if result.get("ok") else 502, result)
            except ValueError:
                self._send_json(400, {"ok": False, "error": "bad-auth"})
            except RuntimeError as exc:
                self._ssh_error(exc)
            except Exception:
                self._send_json(502, {"ok": False, "error": "remove-failed"})
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

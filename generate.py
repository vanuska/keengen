#!/usr/bin/env python3
"""XKeen (Keenetic) config generator.

Share-links → numbered files for /opt/etc/xray/configs/.
Parser matches Xkeen-UI ``services/xray_outbounds.py`` (Xray core):
vless / trojan / vmess / ss / hy2. Several links = several outbounds
in one 04_outbounds.json (pool), plus direct + block.
Secrets must not be printed. Default fp=edge, spiderX=/.
"""
from __future__ import annotations

import argparse
import copy
import json
import re
import sys
import zipfile
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
from xray_outbounds import build_proxy_outbound_from_link
TEMPLATES = HERE / "templates"
PROXY_PLACEHOLDER = "__PROXY_TAG__"
RESERVED_TAGS = {"direct", "block"}
LINK_SCHEMES = r"hysteria2|hysteria|vless|trojan|vmess|hy2|ss"
_TAG_OK = re.compile(r"[^\w.\-]+", re.UNICODE)
# ss:// must not match inside vless:// (the letters "ss").
_LINK_CHUNK = re.compile(
    rf"(?:hysteria2|hysteria|vless|trojan|vmess|hy2|(?<![A-Za-z0-9])ss)://[^\s<>\"']+",
    re.IGNORECASE,
)
_LINK_SPLIT = re.compile(
    r"(?=(?:hysteria2|hysteria|vless|trojan|vmess|hy2)://|(?<![A-Za-z0-9])ss://)",
    re.IGNORECASE,
)


def tag_from_fragment(frag: str, fallback: str) -> str:
    raw = unquote(frag or "").strip()
    raw = _TAG_OK.sub("-", raw).strip("-._")
    raw = re.sub(r"-{2,}", "-", raw)
    if not raw:
        raw = fallback
    if raw.lower() in RESERVED_TAGS:
        raw = f"{raw}-proxy"
    return raw[:64]


def _vmess_ps(url: str) -> str:
    raw = (url or "").strip()
    if not raw.lower().startswith("vmess://"):
        return ""
    try:
        from xray_outbounds import _b64_decode_relaxed

        data = json.loads(_b64_decode_relaxed(raw[8:]).decode("utf-8", errors="ignore"))
        return str(data.get("ps") or "")
    except Exception:
        return ""


def tag_from_link(url: str, fallback: str = "proxy") -> str:
    ps = _vmess_ps(url)
    if ps:
        return tag_from_fragment(ps, fallback)
    parsed = urlparse((url or "").strip())
    host = parsed.hostname or fallback
    fb = host.split(".")[0] if host else fallback
    return tag_from_fragment(parsed.fragment, fb)


def unique_tags(outbounds: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: dict[str, int] = {}
    result = []
    for ob in outbounds:
        tag = str(ob.get("tag") or "proxy")
        n = seen.get(tag.lower(), 0)
        if n:
            ob = copy.deepcopy(ob)
            ob["tag"] = f"{tag}-{n + 1}"
        seen[tag.lower()] = n + 1
        result.append(ob)
    return result


def load_template(name: str) -> Any:
    path = TEMPLATES / name
    return json.loads(path.read_text(encoding="utf-8"))


def build_bundle(outbounds: list[dict[str, Any]], proxy_tag: str) -> dict[str, Any]:
    if not outbounds:
        raise ValueError("нет outbound")
    tags = [str(o["tag"]) for o in outbounds]
    if proxy_tag not in tags:
        raise ValueError(f"proxy-тег {proxy_tag!r} не среди outbound: {tags}")
    routing = load_template("05_routing.json")
    for rule in routing["routing"]["rules"]:
        if rule.get("outboundTag") == PROXY_PLACEHOLDER:
            rule["outboundTag"] = proxy_tag
    files = {
        "01_log.json": load_template("01_log.json"),
        "02_dns.json": load_template("02_dns.json"),
        "03_inbounds.json": load_template("03_inbounds.json"),
        "04_outbounds.json": {
            "outbounds": outbounds
            + [
                {"tag": "direct", "protocol": "freedom"},
                {
                    "tag": "block",
                    "protocol": "blackhole",
                    "settings": {"response": {"type": "http"}},
                },
            ]
        },
        "05_routing.json": routing,
        "06_policy.json": load_template("06_policy.json"),
    }
    return files


def extract_links(text: str) -> list[str]:
    """All share-links: newlines, spaces, or glued scheme://…scheme://."""
    chunks = _LINK_CHUNK.findall(text or "")
    links: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        for part in _LINK_SPLIT.split(chunk):
            link = part.strip().rstrip(".,;")
            if not re.match(rf"^(?:{LINK_SCHEMES})://", link, re.IGNORECASE):
                continue
            if link in seen:
                continue
            seen.add(link)
            links.append(link)
    return links


def parse_link(url: str, tag: str | None = None) -> dict[str, Any]:
    chosen = tag or tag_from_link(url)
    return build_proxy_outbound_from_link(url, chosen)


def write_files(files: dict[str, Any], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, payload in files.items():
        (out_dir / name).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def write_zip(files: dict[str, Any], zip_path: Path) -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, payload in files.items():
            zf.writestr(name, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def self_test() -> None:
    a = (
        "vless://11111111-1111-1111-1111-111111111111@vpn.example.com:443"
        "?type=tcp&security=reality&encryption=none"
        "&pbk=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&fp=edge&spx=%2F"
        "&sni=www.example.com&sid=abcd1234&flow=xtls-rprx-vision#vpn-a"
    )
    b = (
        "vless://22222222-2222-2222-2222-222222222222@vpn.example.com:444"
        "?type=tcp&security=tls&encryption=none&fp=edge&sni=&flow=#vpn-b-tls"
    )
    c = (
        "hysteria2://auth-token@hy2.example.com:443"
        "?sni=hy2.example.com&fp=edge&alpn=h3#vpn-hy2"
    )
    oa = parse_link(a)
    ob = parse_link(b)
    oc = parse_link(c)
    assert oa["tag"] == "vpn-a", oa["tag"]
    assert ob["tag"] == "vpn-b-tls", ob["tag"]
    assert oc["tag"] == "vpn-hy2", oc["tag"]
    assert oa["protocol"] == "vless"
    assert oa["streamSettings"]["security"] == "reality"
    vnext = oa["settings"]["vnext"][0]
    assert vnext["address"] == "vpn.example.com"
    assert vnext["users"][0].get("flow") == "xtls-rprx-vision"
    assert oa["streamSettings"]["realitySettings"]["fingerprint"] == "edge"
    assert oa["streamSettings"]["realitySettings"]["spiderX"] == "/"
    assert ob["streamSettings"]["security"] == "tls"
    assert ob["streamSettings"]["tlsSettings"]["serverName"] == "vpn.example.com"
    assert ob["streamSettings"]["tlsSettings"]["fingerprint"] == "edge"
    assert oc["protocol"] == "hysteria"
    assert oc["settings"]["address"] == "hy2.example.com"
    assert oc["streamSettings"]["network"] == "hysteria"
    assert oc["streamSettings"]["hysteriaSettings"]["auth"] == "auth-token"
    glued = extract_links(a + b + "\n" + c)
    assert len(glued) == 3, glued
    files = build_bundle(unique_tags([oa, ob, oc]), "vpn-a")
    tags = [x["tag"] for x in files["04_outbounds.json"]["outbounds"]]
    assert tags == [
        "vpn-a",
        "vpn-b-tls",
        "vpn-hy2",
        "direct",
        "block",
    ], tags
    proto = [x["protocol"] for x in files["04_outbounds.json"]["outbounds"][:3]]
    assert proto == ["vless", "vless", "hysteria"], proto
    for rule in files["05_routing.json"]["routing"]["rules"]:
        if rule.get("outboundTag") not in ("block", "direct"):
            assert rule["outboundTag"] == "vpn-a"
    print("self-test ok", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="XKeen configs from share links")
    p.add_argument("--link", action="append", default=[], help="vless/hy2/trojan/… (repeatable)")
    p.add_argument("--file", action="append", default=[], help="txt with share links")
    p.add_argument("--proxy", default="", help="outbound tag used in routing")
    p.add_argument("--tag", action="append", default=[], help="override tags in link order")
    p.add_argument("--out", default="", help="directory for 01..06 json")
    p.add_argument("--zip", dest="zip_path", default="", help="write zip instead of dir")
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    links: list[str] = list(args.link)
    for fp in args.file:
        links.extend(extract_links(Path(fp).read_text(encoding="utf-8")))
    if not links and not sys.stdin.isatty():
        links.extend(extract_links(sys.stdin.read()))
    if not links:
        p.error("нужна хотя бы одна ссылка (--link / --file / stdin)")
    outbounds = []
    for i, link in enumerate(links):
        override = args.tag[i] if i < len(args.tag) else None
        outbounds.append(parse_link(link, tag=override))
    outbounds = unique_tags(outbounds)
    proxy = args.proxy or str(outbounds[0]["tag"])
    files = build_bundle(outbounds, proxy)
    if args.zip_path:
        write_zip(files, Path(args.zip_path))
        print(str(Path(args.zip_path).resolve()))
    else:
        out_dir = Path(args.out) if args.out else Path.cwd() / "xkeen-out"
        write_files(files, out_dir)
        print(str(out_dir.resolve()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

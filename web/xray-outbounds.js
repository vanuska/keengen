/* Xray outbound builders as in Xkeen-UI services/xray_outbounds.py.
   Share-link → compact outbound object (vnext только у vmess). */
(function (global) {
  const PROXY = "proxy";

  function unquote(s) {
    try { return decodeURIComponent(String(s == null ? "" : s)); } catch (_) { return String(s || ""); }
  }
  function first(qs, key, def) {
    if (!qs.has(key)) return def;
    const v = qs.get(key);
    return v == null ? def : v;
  }
  function toInt(v, def) {
    if (v == null || v === "") return def;
    const n = parseInt(String(v).trim(), 10);
    return Number.isFinite(n) ? n : def;
  }
  function toBool(v) {
    const s = String(v == null ? "" : v).trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on" || s === "y";
  }
  function b64decode(s) {
    const t = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (t.length % 4)) % 4);
    try { return atob(t + pad); } catch (_) { return ""; }
  }
  function qsFrom(url) {
    return url.searchParams;
  }

  /* Custom-scheme URLs: new URL() is strict and can swallow a second
     vless:// into hash/path if extract left them glued. */
  function parseUrl(raw) {
    const s = String(raw || "").trim();
    try {
      const u = new URL(s);
      if (u.hostname && !/:\/\/.+?:\/\//.test(s)) return u;
    } catch (_) {}
    const m = s.match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\/([\s\S]+)$/);
    if (!m) throw new Error("не ссылка");
    let rest = m[2];
    let hash = "";
    const hi = rest.indexOf("#");
    if (hi >= 0) {
      hash = rest.slice(hi);
      rest = rest.slice(0, hi);
    }
    let query = "";
    const qi = rest.indexOf("?");
    if (qi >= 0) {
      query = rest.slice(qi + 1);
      rest = rest.slice(0, qi);
    }
    let username = "";
    let password = "";
    let hostport = rest;
    const at = rest.lastIndexOf("@");
    if (at >= 0) {
      const ui = rest.slice(0, at);
      hostport = rest.slice(at + 1);
      const c = ui.indexOf(":");
      if (c >= 0) {
        username = unquote(ui.slice(0, c));
        password = unquote(ui.slice(c + 1));
      } else username = unquote(ui);
    }
    let hostname = hostport;
    let port = "";
    if (hostport.charAt(0) === "[") {
      const mm = hostport.match(/^\[([^\]]+)\](?::(\d+))?$/);
      if (!mm) throw new Error("нет host");
      hostname = mm[1];
      port = mm[2] || "";
    } else {
      const c = hostport.lastIndexOf(":");
      if (c >= 0 && /^\d+$/.test(hostport.slice(c + 1))) {
        hostname = hostport.slice(0, c);
        port = hostport.slice(c + 1);
      }
    }
    hostname = unquote(hostname);
    if (!hostname) throw new Error("нет host");
    return {
      protocol: m[1].toLowerCase() + ":",
      username: username,
      password: password,
      hostname: hostname,
      port: port,
      searchParams: new URLSearchParams(query),
      hash: hash,
    };
  }

  function streamFromQs(qs, hostFallback, defaultSecurity) {
    const network = String(first(qs, "type", first(qs, "net", "tcp")) || "tcp").trim().toLowerCase();
    let security = first(qs, "security", null);
    if (security == null || security === "") security = defaultSecurity;
    security = String(security || "").trim().toLowerCase();
    const fp = first(qs, "fp", "edge") || "edge";
    const sni = first(qs, "sni", null) || hostFallback;
    const stream = { network: network, security: security };
    if (security === "tls") {
      const alpnRaw = first(qs, "alpn", "") || "";
      const alpn = alpnRaw ? alpnRaw.split(",").map(function (x) { return x.trim(); }).filter(Boolean) : null;
      const tls = { fingerprint: fp, serverName: sni };
      if (alpn && alpn.length) tls.alpn = alpn;
      if (toBool(first(qs, "allowInsecure", null)) || toBool(first(qs, "insecure", null))) tls.allowInsecure = true;
      stream.tlsSettings = tls;
    } else if (security === "reality") {
      const reality = {
        publicKey: first(qs, "pbk", "") || "",
        fingerprint: fp,
        serverName: sni,
        shortId: first(qs, "sid", "") || "",
        spiderX: unquote(first(qs, "spx", "/") || "/"),
      };
      const pqv = first(qs, "pqv", "") || "";
      if (pqv) reality.mldsa65Verify = pqv;
      stream.realitySettings = reality;
    }
    const headerType = first(qs, "headerType", null);
    if (network === "tcp" && headerType) stream.tcpSettings = { header: { type: String(headerType) } };
    if (network === "raw" && headerType) stream.rawSettings = { header: { type: String(headerType) } };
    if (network === "ws") {
      const ws = { path: unquote(first(qs, "path", "/") || "/") };
      const hostHdr = first(qs, "host", null);
      if (hostHdr) ws.headers = { Host: unquote(hostHdr) };
      stream.wsSettings = ws;
    } else if (network === "grpc") {
      const service = first(qs, "serviceName", null) || first(qs, "path", null) || "";
      const grpc = { serviceName: service ? unquote(service) : "" };
      const authority = first(qs, "authority", null);
      if (authority) grpc.authority = unquote(authority);
      if (String(first(qs, "mode", "") || "").toLowerCase() === "multi") grpc.multiMode = true;
      stream.grpcSettings = grpc;
    } else if (network === "httpupgrade") {
      const hu = { path: unquote(first(qs, "path", "/") || "/") };
      const hostHdr = first(qs, "host", null);
      if (hostHdr) hu.host = unquote(hostHdr);
      stream.httpupgradeSettings = hu;
    } else if (network === "xhttp") {
      const xhttp = {
        path: unquote(first(qs, "path", "/") || "/"),
      };
      const xh = first(qs, "host", null);
      if (xh) xhttp.host = unquote(xh);
      const mode = first(qs, "mode", "auto");
      if (mode) xhttp.mode = String(mode);
      stream.xhttpSettings = xhttp;
    }
    return stream;
  }

  function fromVless(raw) {
    const u = parseUrl(raw);
    if (u.protocol.replace(":", "").toLowerCase() !== "vless") throw new Error("ожидается vless://");
    const uid = unquote(u.username || "");
    const host = u.hostname || "";
    const port = u.port ? parseInt(u.port, 10) : 443;
    if (!uid) throw new Error("нет uuid");
    if (!host) throw new Error("нет host");
    const qs = qsFrom(u);
    const enc = first(qs, "encryption", "none") || "none";
    const flow = first(qs, "flow", null);
    const user = { id: uid, encryption: enc, level: 0 };
    if (flow) user.flow = flow;
    return {
      tag: PROXY,
      protocol: "vless",
      settings: {
        vnext: [{ address: host, port: port, users: [user] }],
      },
      streamSettings: streamFromQs(qs, host, "reality"),
    };
  }

  function fromTrojan(raw) {
    const u = parseUrl(raw);
    if (u.protocol.replace(":", "").toLowerCase() !== "trojan") throw new Error("ожидается trojan://");
    const password = unquote(u.username || "");
    const host = u.hostname || "";
    const port = u.port ? parseInt(u.port, 10) : 443;
    if (!password) throw new Error("нет пароля trojan");
    if (!host) throw new Error("нет host");
    return {
      tag: PROXY,
      protocol: "trojan",
      settings: { servers: [{ address: host, port: port, password: password, level: 0 }] },
      streamSettings: streamFromQs(qsFrom(u), host, "tls"),
    };
  }

  function fromHy2(raw) {
    const u = parseUrl(raw);
    const host = u.hostname || "";
    const port = u.port ? parseInt(u.port, 10) : 443;
    const username = unquote(u.username || "");
    const password = unquote(u.password || "");
    if (!host) throw new Error("hy2: нет host");
    if (!username && !password) throw new Error("hy2: нет auth");
    let auth = username;
    if (password) auth = username + ":" + password;
    const qs = qsFrom(u);
    const sni = first(qs, "sni", null) || host;
    const fp = first(qs, "fp", null) || first(qs, "fingerprint", null) || "edge";
    const alpnRaw = first(qs, "alpn", null);
    const alpn = alpnRaw ? String(alpnRaw).split(",").map(function (x) { return x.trim(); }).filter(Boolean) : ["h3"];
    const insecure = toBool(first(qs, "insecure", null)) || toBool(first(qs, "allowInsecure", null));
    const tls = {
      serverName: String(sni),
      alpn: alpn,
      allowInsecure: !!insecure,
      fingerprint: String(fp),
      show: false,
    };
    const pin = first(qs, "pinSHA256", null);
    if (pin) tls.pinnedPeerCertificateChainSha256 = String(pin).split(/[\s,|]+/).filter(Boolean);
    const hyst = { version: 2, auth: auth };
    const stream = {
      network: "hysteria",
      hysteriaSettings: hyst,
      security: "tls",
      tlsSettings: tls,
    };
    const obfs = String(first(qs, "obfs", "") || "").trim().toLowerCase();
    const obfsPwd = first(qs, "obfs-password", null) || first(qs, "obfs_password", null);
    if (obfs === "salamander") {
      const m = { type: "salamander", settings: {} };
      if (obfsPwd) m.settings.password = String(obfsPwd);
      stream.finalmask = { udp: [m] };
    }
    return {
      tag: PROXY,
      protocol: "hysteria",
      settings: { version: 2, address: host, port: port },
      streamSettings: stream,
    };
  }

  function fromSs(raw) {
    let s = String(raw || "").trim();
    if (!/^ss:\/\//i.test(s)) throw new Error("ожидается ss://");
    const hash = s.indexOf("#");
    if (hash >= 0) s = s.slice(0, hash);
    const rest = s.slice(5);
    let method = "", password = "", host = "", port = "";
    if (rest.indexOf("@") >= 0) {
      const at = rest.lastIndexOf("@");
      let userinfo = rest.slice(0, at);
      const hostport = rest.slice(at + 1);
      if (userinfo.indexOf(":") < 0) {
        const dec = b64decode(userinfo);
        if (dec.indexOf(":") >= 0) userinfo = dec;
      }
      const colon = userinfo.indexOf(":");
      method = colon >= 0 ? unquote(userinfo.slice(0, colon)) : unquote(userinfo);
      password = colon >= 0 ? unquote(userinfo.slice(colon + 1)) : "";
      if (hostport.charAt(0) === "[") {
        const m = hostport.match(/^\[([^\]]+)\]:(\d+)$/);
        if (m) { host = m[1]; port = m[2]; }
      } else {
        const i = hostport.lastIndexOf(":");
        host = hostport.slice(0, i);
        port = hostport.slice(i + 1);
      }
    } else {
      const dec = b64decode(rest);
      const m = dec.match(/^(.*?):(.*)@(.*):(\d+)$/);
      if (!m) throw new Error("ss:// не разобран");
      method = m[1]; password = m[2]; host = m[3]; port = m[4];
    }
    if (!method || !host || !port) throw new Error("ss:// неполный");
    return {
      tag: PROXY,
      protocol: "shadowsocks",
      settings: {
        servers: [{ address: host, port: parseInt(port, 10), method: method, password: password || "", level: 0 }],
      },
    };
  }

  function fromVmess(raw) {
    const s = String(raw || "").trim();
    if (!/^vmess:\/\//i.test(s)) throw new Error("ожидается vmess://");
    const data = JSON.parse(b64decode(s.slice(8)));
    const host = String(data.add || data.address || "").trim();
    const port = toInt(data.port, 443);
    const uid = String(data.id || "").trim();
    if (!host) throw new Error("vmess: нет add");
    if (!uid) throw new Error("vmess: нет id");
    const network = String(data.net || data.type || "tcp").trim().toLowerCase();
    let security = String(data.tls || "").toLowerCase() === "tls" ? "tls" : String(data.security || "").trim().toLowerCase();
    if (!security) security = "none";
    const stream = { network: network, security: security };
    if (security === "tls") {
      const tls = {
        fingerprint: String(data.fp || "edge"),
        serverName: String(data.sni || data.host || host),
      };
      const alpnRaw = String(data.alpn || "");
      if (alpnRaw) tls.alpn = alpnRaw.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      stream.tlsSettings = tls;
    }
    if (network === "ws") {
      const ws = { path: String(data.path || "/").trim() || "/" };
      if (data.host) ws.headers = { Host: String(data.host) };
      stream.wsSettings = ws;
    }
    return {
      tag: String(data.ps || PROXY),
      protocol: "vmess",
      settings: {
        vnext: [{
          address: host,
          port: port,
          users: [{ id: uid, alterId: toInt(data.aid, 0) || 0, security: String(data.scy || data.cipher || "auto") }],
        }],
      },
      streamSettings: stream,
    };
  }

  function fromLink(raw) {
    const s = String(raw || "").trim();
    const scheme = (s.split(":")[0] || "").toLowerCase().replace("hysteria2", "hy2").replace("hysteria", "hy2");
    if (scheme === "vless") return fromVless(s);
    if (scheme === "trojan") return fromTrojan(s);
    if (scheme === "vmess") return fromVmess(s);
    if (scheme === "ss") return fromSs(s);
    if (scheme === "hy2") return fromHy2(s);
    throw new Error("поддерживаются vless://, trojan://, vmess://, ss://, hy2://");
  }

  const SCHEME_RE = /(?:hysteria2|hysteria|vless|trojan|vmess|hy2|(?<![A-Za-z0-9])ss):\/\/[^\s<>"']+/gi;
  const SPLIT_RE = /(?=(?:hysteria2|hysteria|vless|trojan|vmess|hy2):\/\/|(?<![A-Za-z0-9])ss:\/\/)/i;

  function pushLink(out, seen, part) {
    const link = String(part || "").trim().replace(/[.,;)\]]+$/, "");
    if (!/^(?:vless|trojan|vmess|ss|hy2|hysteria2|hysteria):\/\//i.test(link)) return;
    if (seen[link]) return;
    seen[link] = 1;
    out.push(link);
  }

  function extractFromBlob(src, out, seen) {
    const chunks = String(src || "").match(SCHEME_RE) || [];
    chunks.forEach(function (chunk) {
      chunk.split(SPLIT_RE).forEach(function (part) { pushLink(out, seen, part); });
    });
  }

  function extractLinks(text) {
    let src = String(text || "")
      .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
      .replace(/\|\s*(?=(?:hysteria2|hysteria|vless|trojan|vmess|hy2):\/\/)/gi, "\n");
    if (!/(?:vless|trojan|vmess|hy2|hysteria2|hysteria|ss):\/\//i.test(src)) {
      const dec = b64decode(src.replace(/\s+/g, ""));
      if (dec && /:\/\//.test(dec)) src = dec;
    }
    const out = [];
    const seen = {};
    String(src).split(/\r?\n/).forEach(function (line) {
      extractFromBlob(line, out, seen);
    });
    if (!out.length) extractFromBlob(src, out, seen);
    return out;
  }

  function endpoint(ob) {
    const st = ob.settings || {};
    if (st.address) return { address: st.address, port: st.port };
    if (st.vnext && st.vnext[0]) return { address: st.vnext[0].address, port: st.vnext[0].port };
    if (st.servers && st.servers[0]) return { address: st.servers[0].address, port: st.servers[0].port };
    return { address: "", port: "" };
  }

  function sniOf(ob) {
    const ss = ob.streamSettings || {};
    if (ss.realitySettings && ss.realitySettings.serverName) return ss.realitySettings.serverName;
    if (ss.tlsSettings && ss.tlsSettings.serverName) return ss.tlsSettings.serverName;
    return "";
  }

  /* XKeen-UI editor language: VLESS as vnext, not compact address/id. */
  function toPanel(ob) {
    const copy = JSON.parse(JSON.stringify(ob || {}));
    const proto = String(copy.protocol || "").toLowerCase();
    const st = copy.settings || {};
    if (proto === "vless" && !st.vnext && st.address) {
      const user = {
        id: st.id,
        encryption: st.encryption || "none",
        level: st.level == null ? 0 : st.level,
      };
      if (st.flow) user.flow = st.flow;
      copy.settings = {
        vnext: [{ address: st.address, port: st.port, users: [user] }],
      };
    }
    return copy;
  }

  global.XkeenXray = {
    fromLink: fromLink,
    extractLinks: extractLinks,
    endpoint: endpoint,
    sniOf: sniOf,
    toPanel: toPanel,
  };
})(window);

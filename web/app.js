/* keengen: parse vless:// + QR → XKeen 01..06 JSON. Secrets stay in-browser.
   Write to Keenetic only from LAN after SSH login, with backup + xkeen -restart. */
(function () {
  const PROXY_PLACEHOLDER = "__PROXY_TAG__";
  const RESERVED = { direct: 1, block: 1 };
  const JSON_TABS = [
    "01_log.json", "02_dns.json", "03_inbounds.json",
    "04_outbounds.json", "05_routing.json", "06_policy.json",
  ];
  const LIST_TABS = ["ip_exclude", "port_exclude", "port_proxying", "xkeen"];
  const TAB_LABEL = {
    "01_log.json": "01_log",
    "02_dns.json": "02_dns",
    "03_inbounds.json": "03_inbounds",
    "04_outbounds.json": "04_outbounds",
    "05_routing.json": "05_routing",
    "06_policy.json": "06_policy",
    ip_exclude: "ip_exclude",
    port_exclude: "port_exclude",
    port_proxying: "port_proxying",
    xkeen: "xkeen",
  };

  function t() { return window.kgT.apply(null, arguments); }
  function noFileErr() {
    var e = new Error(t.apply(null, arguments));
    e.noFile = true;
    return e;
  }
  function awayHint(h) {
    if (!h || /не дома|откройте из дом|из домашней|not at home|home network/i.test(String(h))) return t("notHome");
    return h;
  }

  const TEMPLATES = {
    "01_log.json": {
      log: {
        access: "/opt/var/log/xray/access.log",
        error: "/opt/var/log/xray/error.log",
        dnsLog: true,
        loglevel: "silent",
      },
    },
    "02_dns.json": {},
    "03_inbounds.json": {
      inbounds: [
        {
          tag: "redirect",
          port: 61219,
          protocol: "dokodemo-door",
          settings: { network: "tcp", followRedirect: true },
          sniffing: { enabled: true, routeOnly: true, destOverride: ["http", "tls"] },
        },
        {
          tag: "tproxy",
          port: 61219,
          protocol: "dokodemo-door",
          settings: { network: "udp", followRedirect: true },
          streamSettings: { sockopt: { tproxy: "tproxy" } },
          sniffing: { enabled: true, routeOnly: true, destOverride: ["http", "tls"] },
        },
      ],
    },
    "05_routing.json": {
      routing: {
        rules: [
          { port: "443", network: "udp", outboundTag: "block" },
          {
            domain: ["appstore.com", "apple.com", "icloud.com", "google.com", "github.com", "yahoo.com", "ui.com", "ubnt.com"],
            outboundTag: PROXY_PLACEHOLDER,
          },
          {
            domain: ["ext:zkeen.dat:domains", "ext:zkeen.dat:other", "ext:zkeen.dat:youtube"],
            outboundTag: PROXY_PLACEHOLDER,
          },
          {
            ip: [
              "ext:zkeenip.dat:akamai", "ext:zkeenip.dat:amazon", "ext:zkeenip.dat:cdn77",
              "ext:zkeenip.dat:cloudflare", "ext:zkeenip.dat:contabo", "ext:zkeenip.dat:digitalocean",
              "ext:zkeenip.dat:discord", "ext:zkeenip.dat:fastly", "ext:zkeenip.dat:gcore",
              "ext:zkeenip.dat:hetzner", "ext:zkeenip.dat:meta", "ext:zkeenip.dat:oracle",
              "ext:zkeenip.dat:ovh", "ext:zkeenip.dat:scaleway", "ext:zkeenip.dat:telegram",
              "ext:zkeenip.dat:vodafone", "ext:zkeenip.dat:vultr",
            ],
            outboundTag: PROXY_PLACEHOLDER,
          },
          { network: "tcp,udp", outboundTag: "direct" },
        ],
      },
    },
    "06_policy.json": { policy: { levels: { "0": { uplinkOnly: 0, downlinkOnly: 0 } } } },
  };

  const state = {
    servers: [],
    proxy: "",
    files: null,
    preview: "04_outbounds.json",
    baseJson: {},
    baseText: {},
    pendingNew: [],
    mode: "",
  };

  function toPanel(ob) {
    if (window.XkeenXray && window.XkeenXray.toPanel) return window.XkeenXray.toPanel(ob);
    return JSON.parse(JSON.stringify(ob || {}));
  }

  function isService(ob) {
    return !!RESERVED[String((ob && ob.tag) || "").toLowerCase()];
  }

  function proxyList(outbounds) {
    return (outbounds || []).filter(function (o) { return o && !isService(o); }).map(toPanel);
  }

  function serviceTail(outbounds) {
    const have = {};
    (outbounds || []).forEach(function (o) {
      if (isService(o)) have[String(o.tag).toLowerCase()] = o;
    });
    return [
      have.direct || { tag: "direct", protocol: "freedom" },
      have.block || { tag: "block", protocol: "blackhole", settings: { response: { type: "http" } } },
    ];
  }

  function uploaded04() {
    return state.baseJson["04_outbounds.json"] || null;
  }

  function tagFromFragment(frag, fallback) {
    let raw = String(frag || "");
    try { raw = decodeURIComponent(raw); } catch (_) {}
    raw = raw.trim();
    raw = raw.replace(/[^\w.\-]+/gu, "-").replace(/^[-._]+|[-._]+$/g, "").replace(/-{2,}/g, "-");
    if (!raw) raw = fallback;
    if (RESERVED[raw.toLowerCase()]) raw = raw + "-proxy";
    return raw.slice(0, 64);
  }

  function parseShareLink(url, tagOverride) {
    const text = (url || "").trim();
    if (!text) throw new Error(t("emptyLink"));
    if (!window.XkeenXray) throw new Error(t("noParser"));
    const outbound = toPanel(window.XkeenXray.fromLink(text));
    checkShareLink(outbound);
    let fallback = "proxy";
    try {
      const ep = window.XkeenXray.endpoint(outbound);
      fallback = String(ep.address || "proxy").split(".")[0] || "proxy";
    } catch (_) {}
    let frag = "";
    const hashAt = text.indexOf("#");
    if (hashAt >= 0) {
      try { frag = decodeURIComponent(text.slice(hashAt + 1)); }
      catch (_) { frag = text.slice(hashAt + 1); }
    }
    if (!frag && outbound.tag && outbound.tag !== "proxy") frag = outbound.tag;
    outbound.tag = tagOverride || tagFromFragment(frag, fallback);
    return outbound;
  }

  function checkShareLink(ob) {
    const ep = window.XkeenXray && window.XkeenXray.endpoint ? window.XkeenXray.endpoint(ob) : { address: "", port: "" };
    if (!ep.address) throw new Error(t("noAddr"));
    const port = Number(ep.port);
    if (!Number.isFinite(port) || port < 1 || port > 65535) throw new Error(t("badPort"));
    const proto = String((ob && ob.protocol) || "").toLowerCase();
    if (proto === "vless") {
      const users = ob.settings && ob.settings.vnext && ob.settings.vnext[0] && ob.settings.vnext[0].users;
      const id = (users && users[0] && users[0].id) || (ob.settings && ob.settings.id) || "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        throw new Error(t("badUuid"));
      }
    }
    const sec = ob.streamSettings && ob.streamSettings.security;
    if (sec === "reality") {
      const pbk = ob.streamSettings.realitySettings && ob.streamSettings.realitySettings.publicKey;
      if (!pbk) throw new Error(t("noPbk"));
    }
  }

  function uniqueTags(list) {
    const seen = {};
    return list.map(function (ob) {
      let tag = String(ob.tag || "proxy");
      const key = tag.toLowerCase();
      const n = seen[key] || 0;
      const copy = JSON.parse(JSON.stringify(ob));
      if (n) copy.tag = tag + "-" + (n + 1);
      seen[key] = n + 1;
      return copy;
    });
  }

  function extractLinks(text) {
    if (window.XkeenXray) return window.XkeenXray.extractLinks(text);
    return (text || "").match(/vless:\/\/[^\s]+/gi) || [];
  }

  function withActiveProxy(routing, proxyTag, serverTags) {
    const src = routing || TEMPLATES["05_routing.json"];
    const copy = JSON.parse(JSON.stringify(src));
    const known = {};
    (serverTags || []).forEach(function (t) { known[String(t)] = 1; });
    known[PROXY_PLACEHOLDER] = 1;
    const rules = copy.routing && copy.routing.rules;
    if (!Array.isArray(rules)) return copy;
    rules.forEach(function (rule) {
      if (!rule || rule.outboundTag == null || rule.outboundTag === "") return;
      const tag = String(rule.outboundTag);
      if (RESERVED[tag.toLowerCase()]) return;
      if (known[tag] || tag === PROXY_PLACEHOLDER) rule.outboundTag = proxyTag;
    });
    return copy;
  }

  function buildBundle(outbounds, proxyTag) {
    if (!outbounds.length) throw new Error(t("noOutbound"));
    const tags = outbounds.map(function (o) { return o.tag; });
    if (tags.indexOf(proxyTag) < 0) throw new Error(t("proxyMissing"));
    const base04 = uploaded04();
    const baseRouting = state.baseJson["05_routing.json"] || TEMPLATES["05_routing.json"];
    const files = {
      "01_log.json": TEMPLATES["01_log.json"],
      "02_dns.json": TEMPLATES["02_dns.json"],
      "03_inbounds.json": TEMPLATES["03_inbounds.json"],
      "04_outbounds.json": {
        outbounds: outbounds.concat(serviceTail(base04 && base04.outbounds)),
      },
      "05_routing.json": withActiveProxy(baseRouting, proxyTag, tags),
      "06_policy.json": TEMPLATES["06_policy.json"],
    };
    ["01_log.json", "02_dns.json", "03_inbounds.json", "06_policy.json"].forEach(function (n) {
      if (state.baseJson[n]) files[n] = state.baseJson[n];
    });
    LIST_TABS.forEach(function (n) {
      files[n] = state.baseText[n] != null ? state.baseText[n] : "";
    });
    return files;
  }

  /* ZIP STORE (no compression) */
  function crc32(buf) {
    let c = ~0 >>> 0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  }
  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) {
    return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  }
  function concat(parts) {
    let n = 0;
    parts.forEach(function (p) { n += p.length; });
    const out = new Uint8Array(n);
    let o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }
  function encodeFile(value) {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2) + "\n";
  }
  function zipStore(files) {
    const enc = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;
    Object.keys(files).forEach(function (name) {
      const nameB = enc.encode(name);
      const data = enc.encode(encodeFile(files[name]));
      const crc = crc32(data);
      const local = concat([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0),
        nameB, data,
      ]);
      const central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(nameB.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameB,
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    });
    const center = concat(centrals);
    const end = concat([
      u32(0x06054b50), u16(0), u16(0), u16(centrals.length), u16(centrals.length),
      u32(center.length), u32(offset), u16(0),
    ]);
    return concat(locals.concat([center, end]));
  }

  function setCopyEnabled(on) {
    const hasFiles = !!state.files;
    const ready = (typeof authGet === "function" && !!authGet()) || !!localEntware;
    const backup = document.getElementById("backup");
    if (backup) {
      backup.disabled = !hasFiles;
      backup.title = hasFiles ? t("tipBackupBtn") : t("tipNeedFiles");
    }
    const applyAll = document.getElementById("applyAll");
    if (applyAll) {
      applyAll.disabled = !hasFiles || !keeneticLan || !ready;
      if (!hasFiles) applyAll.title = t("tipNeedFiles");
      else if (!keeneticLan) applyAll.title = t("titleAway");
      else if (!ready) applyAll.title = t("titleNeedAuth");
      else applyAll.title = t("tipApplyAllBtn");
    }
  }

  function updateAuthButton() {
    const btn = document.getElementById("authKeenetic");
    if (!btn) return;
    btn.disabled = !!localEntware;
    btn.title = localEntware ? t("tipAuthPcOnly") : t("tipAuthBtn");
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function backupFilename(kind) {
    const d = new Date();
    return "keengen-" + (kind || "backup") + "-" +
      d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "-" +
      pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + ".zip";
  }
  function setBackupStatus(msg) {
    const st = document.getElementById("backupStatus");
    if (st) st.textContent = msg || "";
  }
  function downloadBackup(kind, btn) {
    if (!state.files || !Object.keys(state.files).length) return false;
    const name = backupFilename(kind);
    const blob = new Blob([zipStore(state.files)], { type: "application/zip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    setBackupStatus(t("downloaded", name));
    if (btn) {
      const old = btn.textContent;
      btn.textContent = t("downloadedOk");
      setTimeout(function () { btn.textContent = old; }, 1400);
    }
    return true;
  }

  function copyNamed(name, btn) {
    const text = fileText(name);
    if (!text) return;
    copyToClipboard(text).then(function () {
      flashCopied(btn);
      showErr("");
    }).catch(function (e) {
      showErr(t("copyFail", e && e.message ? e.message : e));
    });
  }

  function fileText(name) {
    if (!state.files || state.files[name] == null) return "";
    return encodeFile(state.files[name]);
  }

  function copyExec(text) {
    return new Promise(function (resolve, reject) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        if (!document.execCommand("copy")) throw new Error("execCommand");
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        ta.remove();
      }
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return copyExec(text);
      });
    }
    return copyExec(text);
  }

  function flashCopied(btn) {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = t("copiedOk");
    setTimeout(function () { btn.textContent = old; }, 1400);
  }

  function copyCurrent(btn) {
    copyNamed(state.preview, btn);
  }

  function showErr(msg) {
    var el = document.getElementById("err");
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function renderLoaded() {
    const box = document.getElementById("loaded");
    if (!box) return;
    box.hidden = true;
    box.innerHTML = "";
  }

  function rebuild() {
    const tbody = document.getElementById("rows");
    tbody.innerHTML = "";
    const hint = document.getElementById("hint");
    const hasBase = !!uploaded04() || Object.keys(state.baseJson).length || Object.keys(state.baseText).length;
    if (!state.servers.length && !hasBase) {
      hint.textContent = t("hintNone");
      hint.classList.remove("okish");
      setCopyEnabled(false);
      state.files = null;
      showPreview();
      renderLoaded();
      return;
    }
    const n = state.servers.length;
    if (!n) {
      hint.textContent = t("hintNo04");
    } else if (n === 1) {
      hint.textContent = t("hintOne");
    } else {
      hint.textContent = t("hintMany");
    }
    hint.classList.toggle("okish", n > 1 || state.mode === "merge");
    if (n && (!state.proxy || !state.servers.some(function (s) { return s.tag === state.proxy; }))) {
      state.proxy = state.servers[0].tag;
    }
    state.servers.forEach(function (s, i) {
      const tr = document.createElement("tr");
      const ep = window.XkeenXray ? window.XkeenXray.endpoint(s) : { address: "", port: "" };
      const sni = window.XkeenXray ? window.XkeenXray.sniOf(s) : "";
      const net = (s.streamSettings && s.streamSettings.network) || "";
      const sec = (s.streamSettings && s.streamSettings.security) || "";
      const proto = (s.protocol || "") + (net || sec ? " · " + [net, sec].filter(Boolean).join("/") : "");
      tr.innerHTML =
        '<td><input type="radio" name="proxy"></td>' +
        '<td><input type="text" data-i="' + i + '"></td>' +
        "<td>" + (ep.address || "—") + (ep.port ? ":" + ep.port : "") + "</td>" +
        "<td>" + proto + (sni ? " · " + sni : "") + "</td>";
      tr.querySelector('input[type="radio"]').checked = s.tag === state.proxy;
      tr.querySelector('input[type="radio"]').addEventListener("change", function () {
        state.proxy = s.tag;
        state.preview = "05_routing.json";
        tryPreview();
      });
      const tagInp = tr.querySelector('input[type="text"]');
      tagInp.value = s.tag;
      tagInp.addEventListener("change", function () {
        const old = s.tag;
        const next = tagFromFragment(tagInp.value, "proxy");
        s.tag = next;
        tagInp.value = next;
        if (state.proxy === old) state.proxy = next;
        rebuild();
      });
      tbody.appendChild(tr);
    });
    tryPreview();
    setCopyEnabled(!!state.files);
    renderLoaded();
    persistWork();
  }

  function filesFromBaseOnly() {
    const files = {};
    JSON_TABS.forEach(function (n) {
      if (n === "04_outbounds.json" && state.servers.length) return;
      if (state.baseJson[n]) files[n] = state.baseJson[n];
      else if (TEMPLATES[n]) files[n] = TEMPLATES[n];
    });
    if (state.servers.length && state.proxy) {
      try {
        const built = buildBundle(state.servers, state.proxy);
        Object.keys(built).forEach(function (k) { files[k] = built[k]; });
      } catch (_) {}
    }
    LIST_TABS.forEach(function (n) {
      files[n] = state.baseText[n] != null ? state.baseText[n] : "";
    });
    return files;
  }

  function tryPreview() {
    try {
      if (state.servers.length) state.files = buildBundle(state.servers, state.proxy);
      else state.files = filesFromBaseOnly();
      setCopyEnabled(!!state.files);
      showPreview();
      showErr("");
    } catch (e) {
      state.files = filesFromBaseOnly();
      setCopyEnabled(!!state.files);
      showPreview();
      showErr(String(e.message || e));
    }
  }

  var tabFlashTimer = 0;

  function hideTabMenu() {
    const m = document.getElementById("tabMenu");
    if (!m) return;
    m.hidden = true;
    m.setAttribute("aria-hidden", "true");
  }

  function showTabMenu(x, y, name) {
    const m = document.getElementById("tabMenu");
    if (!m) return;
    m.dataset.name = name;
    m.hidden = false;
    m.setAttribute("aria-hidden", "false");
    m.style.left = "0px";
    m.style.top = "0px";
    const pad = 8;
    const rect = m.getBoundingClientRect();
    const left = Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad));
    const top = Math.max(pad, Math.min(y + pad, window.innerHeight - rect.height - pad));
    m.style.left = left + "px";
    m.style.top = top + "px";
  }

  function downloadOne(name) {
    const text = fileText(name);
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function copyTab(name, btn) {
    const text = fileText(name);
    if (!text) return;
    copyToClipboard(text).then(function () {
      const label = TAB_LABEL[name] || name;
      if (btn) {
        btn.textContent = t("copiedBuf");
        clearTimeout(tabFlashTimer);
        tabFlashTimer = setTimeout(function () {
          if (btn.isConnected) btn.textContent = label;
        }, 1400);
      }
      showErr("");
    }).catch(function (e) {
      showErr(t("copyFail", e && e.message ? e.message : e));
    });
  }

  function syncTabClasses() {
    const tabs = document.getElementById("tabs");
    if (!tabs) return;
    Array.prototype.forEach.call(tabs.children, function (b) {
      const name = b.getAttribute("data-name");
      const on = name === state.preview;
      b.className = "tab" + (on ? " on" : "");
    });
  }

  function fillPreviewBody() {
    const body = state.files ? state.files[state.preview] : undefined;
    const pre = document.getElementById("preview");
    if (body == null || body === "") {
      pre.textContent = LIST_TABS.indexOf(state.preview) >= 0
        ? t("emptyLst")
        : "{}";
    } else if (typeof body === "string") {
      pre.textContent = body;
    } else {
      pre.textContent = JSON.stringify(body, null, 2);
    }
  }

  function showPreview() {
    const tabs = document.getElementById("tabs");
    const names = JSON_TABS.concat(LIST_TABS);
    if (state.preview && names.indexOf(state.preview) < 0) state.preview = "04_outbounds.json";
    if (!tabs.getAttribute("data-ready")) {
      tabs.innerHTML = "";
      names.forEach(function (name) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-name", name);
        b.textContent = TAB_LABEL[name] || name;
        b.title = t("tabTip");
        b.addEventListener("click", function () {
          hideTabMenu();
          if (state.preview === name) return;
          state.preview = name;
          syncTabClasses();
          fillPreviewBody();
          setCopyEnabled(!!state.files);
        });
        b.addEventListener("dblclick", function (e) {
          e.preventDefault();
          state.preview = name;
          syncTabClasses();
          fillPreviewBody();
          copyTab(name, b);
        });
        b.addEventListener("contextmenu", function (e) {
          e.preventDefault();
          state.preview = name;
          syncTabClasses();
          fillPreviewBody();
          setCopyEnabled(!!state.files);
          showTabMenu(e.clientX, e.clientY, name);
        });
        tabs.appendChild(b);
      });
      tabs.setAttribute("data-ready", "1");
    }
    syncTabClasses();
    fillPreviewBody();
    setCopyEnabled(!!state.files);
    const pre = document.getElementById("preview");
    if (pre && !pre.getAttribute("data-ctx")) {
      pre.setAttribute("data-ctx", "1");
      pre.addEventListener("contextmenu", function (e) {
        if (!state.files || !state.preview) return;
        e.preventDefault();
        showTabMenu(e.clientX, e.clientY, state.preview);
      });
    }
  }

  function applyChoice(mode) {
    state.mode = mode;
    const existing = uploaded04() ? proxyList(uploaded04().outbounds) : [];
    if (mode === "merge") {
      state.servers = uniqueTags(existing.concat(state.pendingNew.map(toPanel)));
    } else {
      state.servers = uniqueTags(state.pendingNew.map(toPanel));
    }
    hideMergeDlg();
    rebuild();
  }

  function showMergeDlg(nOld, nNew) {
    const dlg = document.getElementById("mergeDlg");
    const msg = document.getElementById("mergeMsg");
    if (msg) {
      msg.textContent = t("mergeBody", nOld, nOld === 1 ? t("conn1") : t("connN"), nNew);
    }
    if (dlg) {
      dlg.hidden = false;
      dlg.setAttribute("aria-hidden", "false");
    }
  }

  function hideMergeDlg() {
    const dlg = document.getElementById("mergeDlg");
    if (dlg) {
      dlg.hidden = true;
      dlg.setAttribute("aria-hidden", "true");
    }
  }

  function parseJsonStrict(text) {
    const t0 = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!t0) throw noFileErr("emptyJson");
    var body = t0.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").trim();
    if (!body) throw noFileErr("emptyJson");
    if (body.charAt(0) === "[") throw noFileErr("jsonArray");
    if (body.charAt(0) !== "{") throw noFileErr("jsonStart");
    try {
      const obj = JSON.parse(body);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        throw noFileErr("jsonObj");
      }
      return obj;
    } catch (e) {
      if (e && e.noFile) throw e;
      const open = (body.match(/\{/g) || []).length;
      const close = (body.match(/\}/g) || []).length;
      const a = (body.match(/\[/g) || []).length;
      const b = (body.match(/\]/g) || []).length;
      var hint = "";
      if (open !== close) hint += t("jsonBrace", open, close);
      if (a !== b) hint += t("jsonSquare", a, b);
      throw noFileErr("jsonBroken", hint || "", e && e.message ? e.message : e);
    }
  }

  function assertXkeenJson(obj, filename) {
    const key = guessJsonName(filename, obj);
    if (!key) throw noFileErr("notXkeen");
    const n = {
      log: !!(obj.log && typeof obj.log === "object"),
      dns: !!(obj.dns && typeof obj.dns === "object"),
      inbounds: Array.isArray(obj.inbounds),
      outbounds: Array.isArray(obj.outbounds),
      routing: !!(obj.routing && typeof obj.routing === "object"),
      policy: !!(obj.policy && typeof obj.policy === "object"),
    };
    const hits = Object.keys(n).filter(function (k) { return n[k]; });
    if (hits.length > 1 && !/0[1-6]/.test(String(filename || ""))) {
      throw noFileErr("multiSection", hits.join(", "));
    }
    if (key === "04_outbounds.json") {
      if (!Array.isArray(obj.outbounds) || !obj.outbounds.length) {
        throw noFileErr("noOutbounds");
      }
      obj.outbounds.forEach(function (o, i) {
        if (!o || !o.protocol) throw noFileErr("noProtocol", i + 1);
        if (!o.tag) throw noFileErr("noTag", i + 1);
      });
    }
    if (key === "05_routing.json" && !(obj.routing && Array.isArray(obj.routing.rules))) {
      throw noFileErr("noRules");
    }
    if (key === "03_inbounds.json" && !Array.isArray(obj.inbounds)) {
      throw noFileErr("noInbounds");
    }
    if (key === "01_log.json" && !(obj.log && typeof obj.log === "object")) {
      throw noFileErr("noLog");
    }
    if (key === "06_policy.json" && !(obj.policy && typeof obj.policy === "object")) {
      throw noFileErr("noPolicy");
    }
    return key;
  }

  function parseFromText(extraText) {
    const raw = [document.getElementById("links").value, extraText || ""].join("\n");
    const trimmed = raw.trim();
    if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
      try {
        const obj = parseJsonStrict(trimmed);
        loadJsonObject(obj, "pasted.json");
        renderLoaded();
        rebuild();
        showErr("");
        return;
      } catch (e) {
        showErr(String(e.message || e));
        return;
      }
    }
    const links = extractLinks(raw);
    if (!links.length) {
      const listName = guessListFromText(trimmed);
      if (listName) {
        loadListFile(listName, trimmed.replace(/\s*$/, "\n"));
        document.getElementById("links").value = "";
        state.preview = listName;
        renderLoaded();
        rebuild();
        showErr("");
        return;
      }
    }
    const errors = [];
    const parsed = [];
    links.forEach(function (link, i) {
      try { parsed.push(parseShareLink(link)); }
      catch (e) { errors.push(t("linkN", i + 1, String(e.message || e))); }
    });
    if (/https?:\/\//i.test(raw) && parsed.length < 2) {
      errors.push(t("httpNotShare"));
    }
    state.pendingNew = uniqueTags(parsed);
    if (errors.length) {
      state.pendingNew = [];
      showErr(t("linksRejected", errors.join("\n")));
      return;
    }
    if (!trimmed) return;
    if (!state.pendingNew.length && !links.length) {
      showErr(t("noShare"));
      return;
    }
    const old = uploaded04() ? proxyList(uploaded04().outbounds) : state.servers.slice();
    if (state.pendingNew.length && old.length) {
      showMergeDlg(old.length, state.pendingNew.length);
      showErr("");
      return;
    }
    if (state.pendingNew.length) {
      applyChoice("replace");
      showErr("");
      return;
    }
    showErr("");
  }

  function guessListFromText(text) {
    const raw = String(text || "").trim();
    if (!raw || raw.charAt(0) === "{") return null;
    if (LIST_TABS.indexOf(state.preview) >= 0) return state.preview;
    const lines = raw.split(/\r?\n/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s && s.charAt(0) !== "#"; });
    if (!lines.length) return null;
    let ip = 0;
    let port = 0;
    lines.forEach(function (l) {
      if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(l) || (l.indexOf(":") >= 0 && /^[0-9a-fA-F:.\/]+$/.test(l))) ip++;
      else if (/^\d{1,5}(-\d{1,5})?$/.test(l)) port++;
    });
    if (ip * 2 >= lines.length && ip > 0) return "ip_exclude";
    if (port * 2 >= lines.length && port > 0) {
      return state.preview === "port_proxying" ? "port_proxying" : "port_exclude";
    }
    return null;
  }

  function guessJsonName(filename, obj) {
    const n = String(filename || "").toLowerCase();
    if (/01[_-]?log/.test(n)) return "01_log.json";
    if (/02[_-]?dns/.test(n)) return "02_dns.json";
    if (/03[_-]?inbound/.test(n)) return "03_inbounds.json";
    if (/04[_-]?outbound/.test(n)) return "04_outbounds.json";
    if (/05[_-]?rout/.test(n)) return "05_routing.json";
    if (/06[_-]?polic/.test(n)) return "06_policy.json";
    if (obj && Array.isArray(obj.outbounds)) return "04_outbounds.json";
    if (obj && obj.routing) return "05_routing.json";
    if (obj && obj.inbounds) return "03_inbounds.json";
    if (obj && obj.log) return "01_log.json";
    if (obj && obj.policy) return "06_policy.json";
    if (obj && obj.dns) return "02_dns.json";
    return null;
  }

  function guessListName(filename) {
    const n = String(filename || "").toLowerCase().replace(/\\/g, "/").split("/").pop();
    const stem = n.replace(/\.(lst|txt|conf)$/i, "");
    if (LIST_TABS.indexOf(stem) >= 0) return stem;
    if (stem.indexOf("ip_exclude") >= 0) return "ip_exclude";
    if (stem.indexOf("port_exclude") >= 0) return "port_exclude";
    if (stem.indexOf("port_proxy") >= 0) return "port_proxying";
    if (stem === "xkeen") return "xkeen";
    return null;
  }

  function clearLoadedFile() {
    state.baseJson = {};
    state.baseText = {};
  }

  function loadJsonObject(obj, filename) {
    const key = assertXkeenJson(obj, filename);
    state.baseJson[key] = obj;
    state.mode = "";
    if (key === "04_outbounds.json") {
      state.servers = proxyList(obj.outbounds);
      state.proxy = state.servers[0] ? state.servers[0].tag : "";
    }
    state.preview = key;
    return key;
  }

  function loadListFile(name, text) {
    state.baseText[name] = text;
    state.mode = "";
    state.preview = name;
  }

  function asConfigObject(value) {
    if (!value) return null;
    if (typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value !== "string") return null;
    var t = String(value).replace(/^\uFEFF/, "").trim();
    if (!t) return null;
    try { return JSON.parse(t); } catch (_) {}
    t = t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    try { return JSON.parse(t); } catch (_) { return null; }
  }

  function loadSnapshot(files) {
    clearLoadedFile();
    state.mode = "";
    files = files || {};
    JSON_TABS.forEach(function (n) {
      const obj = asConfigObject(files[n] != null ? files[n] : files[n.replace(/\.json$/, "")]);
      if (obj) state.baseJson[n] = obj;
    });
    LIST_TABS.forEach(function (n) {
      if (typeof files[n] === "string") state.baseText[n] = files[n];
      else if (files[n] != null && typeof files[n] === "object") {
        state.baseText[n] = JSON.stringify(files[n], null, 2) + "\n";
      }
    });
    const o4 = state.baseJson["04_outbounds.json"];
    const listed = o4 ? proxyList(o4.outbounds) : [];
    state.servers = listed;
    state.proxy = listed[0] ? listed[0].tag : "";
    const routing = state.baseJson["05_routing.json"];
    const rules = routing && routing.routing && routing.routing.rules;
    if (Array.isArray(rules)) {
      rules.forEach(function (rule) {
        const tag = rule && rule.outboundTag;
        if (tag && listed.some(function (s) { return s.tag === tag; })) state.proxy = tag;
      });
    }
    state.preview = o4 ? "04_outbounds.json" : (JSON_TABS.find(function (n) { return state.baseJson[n]; }) || LIST_TABS[0]);
    rebuild();
  }

  function canvasFromImage(file) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, c.width, c.height));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { reject(new Error(t("notImage", file.name))); };
      img.src = URL.createObjectURL(file);
    });
  }

  async function decodeQr(file) {
    const idata = await canvasFromImage(file);
    if (window.BarcodeDetector) {
      try {
        const det = new BarcodeDetector({ formats: ["qr_code"] });
        const bmp = await createImageBitmap(file);
        const codes = await det.detect(bmp);
        if (codes && codes[0] && codes[0].rawValue) return codes[0].rawValue;
      } catch (_) { /* fall through */ }
    }
    if (typeof jsQR === "function") {
      const r = jsQR(idata.data, idata.width, idata.height);
      if (r && r.data) return r.data;
    }
    throw new Error(t("qrFail", file.name));
  }

  function isConfigFile(file) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".json") || name.endsWith(".lst") || name.endsWith(".conf")) return true;
    if (guessListName(file.name)) return true;
    return false;
  }

  async function ingestFiles(fileList) {
    const extra = [];
    const errs = [];
    let loadedJson = false;
    const files = [];
    for (let i = 0; i < fileList.length; i++) files.push(fileList[i]);
    const configs = files.filter(isConfigFile);
    const others = files.filter(function (f) { return !isConfigFile(f); });
    if (configs.length > 1) {
      showErr(t("oneFile"));
      return;
    }
    for (const file of configs.concat(others)) {
      const name = (file.name || "").toLowerCase();
      if (name.endsWith(".json")) {
        try {
          loadJsonObject(parseJsonStrict(await file.text()), file.name);
          loadedJson = true;
        } catch (e) { errs.push(file.name + ": " + String(e.message || e)); }
        continue;
      }
      const listName = guessListName(file.name);
      if (listName && (name.endsWith(".lst") || name.endsWith(".txt") || name.endsWith(".conf") || !name.includes("."))) {
        loadListFile(listName, await file.text());
        loadedJson = true;
        continue;
      }
      if (name.endsWith(".txt") || file.type === "text/plain") {
        const text = await file.text();
        const t = text.trim();
        if (t.charAt(0) === "{") {
          if (loadedJson) {
            showErr(t("oneFileShort"));
            return;
          }
          try {
            loadJsonObject(parseJsonStrict(t), file.name);
            loadedJson = true;
          } catch (e) { extra.push(text); }
        } else extra.push(text);
        continue;
      }
      try { extra.push(await decodeQr(file)); }
      catch (e) { errs.push(String(e.message || e)); }
    }
    renderLoaded();
    if (extra.length) {
      const ta = document.getElementById("links");
      const more = extra.join("\n");
      ta.value = (ta.value ? ta.value + "\n" : "") + more;
      parseFromText("");
    } else if (loadedJson) {
      rebuild();
    }
    if (errs.length) showErr(errs.join("\n"));
  }

  document.getElementById("parse").addEventListener("click", function () { parseFromText(""); });
  document.getElementById("clear").addEventListener("click", function () {
    document.getElementById("links").value = "";
    state.pendingNew = [];
    hideMergeDlg();
    showErr("");
  });
  var applyNames = [];
  function hideApplyDlg() {
    const dlg = document.getElementById("applyDlg");
    if (dlg) {
      dlg.hidden = true;
      dlg.setAttribute("aria-hidden", "true");
    }
  }

  function remotePath(name) {
    if (JSON_TABS.indexOf(name) >= 0) return "/opt/etc/xray/configs/" + name;
    if (name === "xkeen") return "/opt/etc/xkeen/xkeen.json";
    return "/opt/etc/xkeen/" + name + ".lst";
  }

  function openApplyDlg(names) {
    if (!keeneticLan || (!authGet() && !localEntware)) {
      showAuthDlg();
      showErr(t("needAuth"));
      return;
    }
    const dlg = document.getElementById("applyDlg");
    const title = document.getElementById("applyTitle");
    const msg = document.getElementById("applyMsg");
    const list = document.getElementById("applyList");
    const note = document.getElementById("applyNote");
    const doBtn = document.getElementById("applyDo");
    if (!dlg) return;
    applyNames = names.slice();
    const all = names.length > 1;
    if (title) title.textContent = all ? t("applyAllTitle") : t("applyOneTitle");
    if (doBtn) {
      doBtn.textContent = all ? t("applyAllDo") : t("applyOneDo");
      doBtn.disabled = false;
    }
    if (msg) {
      msg.textContent = all
        ? t("applyAllMsg")
        : t("applyOneMsg");
    }
    if (list) {
      list.innerHTML = names.map(function (n) {
        return "<li>" + (TAB_LABEL[n] || n) + " → " + remotePath(n) + "</li>";
      }).join("");
    }
    if (note) {
      note.textContent = (names.indexOf("04_outbounds.json") >= 0 && names.indexOf("05_routing.json") < 0)
        ? t("applyNote04")
        : t("applyNoteVpn");
    }
    dlg.hidden = false;
    dlg.setAttribute("aria-hidden", "false");
  }

  function applyToKeenetic() {
    const a = authPayload();
    const doBtn = document.getElementById("applyDo");
    if (!a || !applyNames.length || !state.files) {
      hideApplyDlg();
      showErr(t("needAuthFiles"));
      return;
    }
    const files = {};
    applyNames.forEach(function (n) {
      if (state.files[n] != null && state.files[n] !== "") files[n] = state.files[n];
    });
    if (!Object.keys(files).length) {
      hideApplyDlg();
      showErr(t("nothingWrite"));
      return;
    }
    if (doBtn) doBtn.disabled = true;
    showErr(t("writing"));
    fetch("/api/keenetic/write", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: a.host,
        port: parseInt(a.port, 10) || 22,
        user: a.user,
        password: a.password,
        restart: true,
        files: files,
      }),
    }).then(function (r) {
      return r.json().then(function (j) { return { r: r, j: j }; }).catch(function () {
        return { r: r, j: {} };
      });
    }).then(function (x) {
      const r = x.r;
      const j = x.j || {};
      if (r.status === 403 || j.where === "internet") {
        setKeeneticButton(false, j.hint);
        throw new Error(awayHint(j.hint));
      }
      if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
      const n = (j.written || applyNames).join(", ");
      showErr("");
      const st = document.getElementById("backupStatus");
      if (st) st.textContent = t("written", n) + (j.restarted ? t("writtenRestart") : "");
    }).catch(function (e) {
      showErr(t("writeFail", e && e.message ? e.message : e));
    }).finally(function () {
      hideApplyDlg();
      if (doBtn) doBtn.disabled = false;
    });
  }

  document.getElementById("backup").addEventListener("click", function () {
    downloadBackup("backup", document.getElementById("backup"));
  });
  var tabMenu = document.getElementById("tabMenu");
  if (tabMenu) {
    tabMenu.addEventListener("click", function (e) {
      e.stopPropagation();
      const act = e.target && e.target.getAttribute("data-act");
      const name = tabMenu.dataset.name;
      hideTabMenu();
      if (!act || !name) return;
      const btn = document.querySelector('#tabs [data-name="' + name + '"]');
      if (act === "copy") copyTab(name, btn);
      else if (act === "save") downloadOne(name);
      else if (act === "apply") openApplyDlg([name]);
    });
  }
  document.addEventListener("click", hideTabMenu);
  // fixed menu stays on screen while content scrolls — close it
  window.addEventListener("scroll", hideTabMenu, true);
  window.addEventListener("wheel", hideTabMenu, { capture: true, passive: true });
  window.addEventListener("touchmove", hideTabMenu, { capture: true, passive: true });
  window.addEventListener("resize", hideTabMenu);
  var applyAllBtn = document.getElementById("applyAll");
  if (applyAllBtn) {
    applyAllBtn.addEventListener("click", function () {
      const names = JSON_TABS.concat(LIST_TABS).filter(function (n) {
        const v = state.files && state.files[n];
        return v != null && v !== "";
      });
      if (!names.length) return;
      downloadBackup("before-apply");
      openApplyDlg(names);
    });
  }
  var applyCancel = document.getElementById("applyCancel");
  if (applyCancel) applyCancel.addEventListener("click", hideApplyDlg);
  var applyDo = document.getElementById("applyDo");
  if (applyDo) {
    applyDo.addEventListener("click", applyToKeenetic);
  }

  const drop = document.getElementById("drop");
  const input = document.getElementById("files");
  drop.addEventListener("click", function () { input.click(); });
  drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
  drop.addEventListener("drop", function (e) {
    e.preventDefault();
    drop.classList.remove("over");
    if (e.dataTransfer.files && e.dataTransfer.files.length) ingestFiles(e.dataTransfer.files);
  });
  input.addEventListener("change", function () {
    if (input.files && input.files.length) ingestFiles(input.files);
    input.value = "";
  });

  document.getElementById("doMerge").addEventListener("click", function () { applyChoice("merge"); });
  document.getElementById("doReplace").addEventListener("click", function () { applyChoice("replace"); });
  document.getElementById("doCancel").addEventListener("click", function () {
    state.pendingNew = [];
    hideMergeDlg();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      hideMergeDlg();
      hideAuthDlg();
      hideTabMenu();
      hideApplyDlg();
    }
  });

  var keeneticLan = false;
  var localEntware = false;
  var ipkInfo = null;
  var AUTH_STORE = "keengen.k.profiles";
  var AUTH_ACTIVE = "keengen.k.active";
  var WORK_STORE = "keengen.k.work";
  var AUTH_OLD = { host: "keengen.k.host", port: "keengen.k.port", user: "keengen.k.user", pass: "keengen.k.pass" };
  var authDraft = null;
  var authEditingId = "";

  function lsGet(key) {
    try { var v = localStorage.getItem(key); if (v) return v; } catch (_) {}
    try { return sessionStorage.getItem(key) || ""; } catch (_) { return ""; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (_) {}
    try { sessionStorage.removeItem(key); } catch (_) {}
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (_) {}
    try { sessionStorage.removeItem(key); } catch (_) {}
  }
  function persistWork() {
    if (!state.servers.length && !Object.keys(state.baseJson).length && !Object.keys(state.baseText).length) return;
    try {
      lsSet(WORK_STORE, JSON.stringify({
        v: 1,
        servers: state.servers,
        proxy: state.proxy,
        preview: state.preview,
        baseJson: state.baseJson,
        baseText: state.baseText,
      }));
    } catch (_) {}
  }
  function restoreWork() {
    try {
      var raw = lsGet(WORK_STORE);
      if (!raw) return;
      var w = JSON.parse(raw);
      if (!w || typeof w !== "object") return;
      state.baseJson = (w.baseJson && typeof w.baseJson === "object") ? w.baseJson : {};
      state.baseText = (w.baseText && typeof w.baseText === "object") ? w.baseText : {};
      state.servers = Array.isArray(w.servers) ? w.servers : [];
      state.proxy = w.proxy || "";
      if (w.preview) state.preview = w.preview;
    } catch (_) {}
  }
  function newAuthId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function migrateProfiles() {
    var list = [];
    try {
      var raw = lsGet(AUTH_STORE);
      list = raw ? JSON.parse(raw) : [];
    } catch (_) { list = []; }
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (p) { return p && p.id && p.host; });
    if (!list.length) {
      var host = lsGet(AUTH_OLD.host);
      var user = lsGet(AUTH_OLD.user);
      if (host && user) {
        list = [{
          id: newAuthId(),
          name: "Keenetic",
          host: host,
          port: lsGet(AUTH_OLD.port) || "22",
          user: user,
          password: lsGet(AUTH_OLD.pass) || "",
          ok: true,
        }];
      }
    }
    var act = lsGet(AUTH_ACTIVE) || (list[0] ? list[0].id : "");
    if (list.length) {
      lsSet(AUTH_STORE, JSON.stringify(list));
      if (act) lsSet(AUTH_ACTIVE, act);
      try {
        sessionStorage.removeItem(AUTH_OLD.host);
        sessionStorage.removeItem(AUTH_OLD.port);
        sessionStorage.removeItem(AUTH_OLD.user);
        sessionStorage.removeItem(AUTH_OLD.pass);
      } catch (_) {}
    }
    return list;
  }
  function loadProfiles() {
    try {
      const raw = lsGet(AUTH_STORE);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(function (p) { return p && p.id && p.host; }) : [];
    } catch (_) {
      return [];
    }
  }
  function saveProfiles(list, activeId) {
    try {
      lsSet(AUTH_STORE, JSON.stringify(list || []));
      if (activeId) lsSet(AUTH_ACTIVE, activeId);
      else lsDel(AUTH_ACTIVE);
    } catch (_) {}
  }
  function activeId() {
    return lsGet(AUTH_ACTIVE) || "";
  }
  function findProfile(id) {
    const list = loadProfiles();
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function authGet() {
    const list = loadProfiles();
    const id = activeId();
    let p = findProfile(id);
    if (!p) {
      for (let i = 0; i < list.length; i++) {
        if (list[i].ok) { p = list[i]; break; }
      }
    }
    return p && p.ok ? p : null;
  }
  function showAuthErr(msg) {
    const el = document.getElementById("authErr");
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }
  function formFromProfile(p) {
    const empty = !p;
    document.getElementById("authName").value = empty ? "" : (p.name || "");
    document.getElementById("authHost").value = empty ? "" : (p.host || "");
    document.getElementById("authPort").value = empty ? "" : String(p.port || "");
    document.getElementById("authUser").value = empty ? "" : (p.user || "");
    document.getElementById("authPass").value = empty ? "" : (p.password || "");
  }
  function readAuthForm() {
    const name = (document.getElementById("authName").value || "").trim();
    const host = (document.getElementById("authHost").value || "").trim();
    const port = String(parseInt(document.getElementById("authPort").value, 10) || 0);
    const user = (document.getElementById("authUser").value || "").trim();
    const password = document.getElementById("authPass").value || "";
    return { name: name, host: host, port: port, user: user, password: password };
  }
  function paintAuthPick() {
    const list = loadProfiles();
    const wrap = document.getElementById("authPickWrap");
    const pick = document.getElementById("authPick");
    const del = document.getElementById("authDel");
    const showPick = list.length > 1 || (list.length >= 1 && authDraft);
    wrap.hidden = !showPick;
    pick.innerHTML = "";
    list.forEach(function (p) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name || p.host || p.id;
      pick.appendChild(opt);
    });
    if (authDraft) {
      const opt = document.createElement("option");
      opt.value = authDraft.id;
      opt.textContent = authDraft.name || t("newConn");
      pick.appendChild(opt);
    }
    const cur = authDraft ? authDraft.id : (authEditingId || activeId() || (list[0] && list[0].id) || "");
    pick.value = cur;
    del.hidden = !!(authDraft || list.length === 0);
  }
  function openProfile(id) {
    authDraft = null;
    const list = loadProfiles();
    const p = findProfile(id) || list[0] || null;
    authEditingId = p ? p.id : "";
    formFromProfile(p);
    showAuthErr("");
    paintAuthPick();
  }
  function showAuthDlg() {
    const list = loadProfiles();
    if (list.length === 0) {
      authDraft = { id: newAuthId(), name: "", host: "", port: "", user: "", password: "", ok: false };
      authEditingId = authDraft.id;
      formFromProfile(authDraft);
    } else {
      openProfile(activeId() || list[0].id);
    }
    paintAuthPick();
    showAuthErr("");
    const dlg = document.getElementById("authDlg");
    if (dlg) {
      dlg.hidden = false;
      dlg.setAttribute("aria-hidden", "false");
    }
    const n = document.getElementById("authName");
    if (n) n.focus();
  }
  function hideAuthDlg() {
    authDraft = null;
    const dlg = document.getElementById("authDlg");
    if (dlg) {
      dlg.hidden = true;
      dlg.setAttribute("aria-hidden", "true");
    }
    showAuthErr("");
    setKeeneticButton(keeneticLan, null);
  }
  function setKeeneticButton(lan, hint) {
    keeneticLan = !!lan;
    const ready = !!authGet();
    const btn = document.getElementById("readKeenetic");
    const where = document.getElementById("keeneticWhere");
    updateAuthButton();
    if (btn) {
      btn.disabled = !keeneticLan || (!ready && !localEntware);
      if (!keeneticLan) btn.title = t("titleAway");
      else if (!ready && !localEntware) btn.title = t("titleNeedAuth");
      else btn.title = t("tipReadBtn");
    }
    if (where) {
      where.classList.toggle("lan", keeneticLan && (ready || localEntware));
      where.classList.toggle("away", !keeneticLan || (!ready && !localEntware));
      if (!keeneticLan) where.textContent = awayHint(hint);
      else if (!ready && !localEntware) where.textContent = t("whereNeedSave");
      else if (localEntware) where.textContent = t("whereOk", "local");
      else where.textContent = t("whereOk", authGet().name || authGet().host);
    }
    setCopyEnabled();
    refreshIpkPanel();
    updateBakButtons();
  }

  var bakItems = [];

  function backupStampFrom(j) {
    if (!j) return "";
    var bak = j.backup;
    if (bak && typeof bak === "object") {
      if (bak.ok === false) return "";
      return bak.local_backup || bak.stamp || bak.router_backup || "";
    }
    if (j.local_backup) return String(j.local_backup);
    if (typeof bak === "string" && bak) {
      var m = bak.match(/(\d{8}-\d{6})/);
      return m ? m[1] : bak;
    }
    return "";
  }

  function showBakNotice(stamp) {
    if (!stamp) return;
    var notice = document.getElementById("bakNotice");
    var st = document.getElementById("bakStatus");
    var ipkSt = document.getElementById("ipkStatus");
    var shortMsg = t("bakMadeShort", stamp);
    if (notice) notice.textContent = t("bakMade", stamp);
    if (st && !localEntware) st.textContent = shortMsg;
    // On router UI the restore box is hidden — keep a short note on ipkStatus too.
    if (localEntware && ipkSt && !ipkSt.textContent) ipkSt.textContent = shortMsg;
  }

  function selectedBak() {
    var pick = document.getElementById("backupPick");
    var id = pick && pick.value;
    if (!id) return null;
    for (var i = 0; i < bakItems.length; i++) {
      if (bakItems[i].id === id) return bakItems[i];
    }
    return null;
  }

  function updateBakButtons() {
    var box = document.getElementById("ipkRestoreBox");
    if (box) box.hidden = !!localEntware;
    if (localEntware) return;
    var auth = authGet();
    var isRoot = !!(auth && String(auth.user || "").toLowerCase() === "root");
    var item = selectedBak();
    var cfgBtn = document.getElementById("bakRestoreCfg");
    var ipkBtn = document.getElementById("bakRestoreIpk");
    var remBtn = document.getElementById("bakRemoveIpk");
    if (cfgBtn) {
      cfgBtn.disabled = !keeneticLan || !isRoot || !(item && item.configs);
      if (!keeneticLan) cfgBtn.title = t("titleAway");
      else if (!auth) cfgBtn.title = t("titleNeedAuth");
      else if (!isRoot) cfgBtn.title = t("bakNeedRoot");
      else if (!item) cfgBtn.title = t("bakNeedSnap");
      else if (!item.configs) cfgBtn.title = t("bakNeedSnapCfg");
      else cfgBtn.title = t("tipBakRestoreCfg");
    }
    if (ipkBtn) {
      ipkBtn.disabled = !keeneticLan || !isRoot || !(item && (item.previous_ipk || item.ipk));
      if (!keeneticLan) ipkBtn.title = t("titleAway");
      else if (!auth) ipkBtn.title = t("titleNeedAuth");
      else if (!isRoot) ipkBtn.title = t("bakNeedRoot");
      else if (!item) ipkBtn.title = t("bakNeedSnap");
      else if (!(item.previous_ipk || item.ipk)) ipkBtn.title = t("bakNeedSnapIpk");
      else ipkBtn.title = t("tipBakRestoreIpk");
    }
    if (remBtn) {
      remBtn.hidden = false;
      remBtn.disabled = !keeneticLan || !isRoot || !(ipkInfo && ipkInfo.router_installed);
      if (!keeneticLan) remBtn.title = t("titleAway");
      else if (!auth) remBtn.title = t("titleNeedAuth");
      else if (!isRoot) remBtn.title = t("bakNeedRoot");
      else if (!(ipkInfo && ipkInfo.router_installed)) remBtn.title = t("bakNeedPkg");
      else remBtn.title = t("tipBakRemoveIpk");
    }
  }

  function refreshBackupList() {
    var box = document.getElementById("ipkRestoreBox");
    if (localEntware) {
      if (box) box.hidden = true;
      return Promise.resolve();
    }
    if (box) box.hidden = false;
    return fetch("/api/backups", { cache: "no-store" }).then(function (r) {
      return r.json();
    }).then(function (j) {
      bakItems = (j && j.items) || [];
      var pick = document.getElementById("backupPick");
      if (!pick) return;
      var prev = pick.value;
      pick.innerHTML = "";
      if (!bakItems.length) {
        var empty = document.createElement("option");
        empty.value = "";
        empty.textContent = t("bakEmpty");
        pick.appendChild(empty);
      } else {
        bakItems.forEach(function (it) {
          var o = document.createElement("option");
          o.value = it.id;
          var bits = [];
          if (it.configs) bits.push("cfg");
          if (it.ipk) bits.push("ipk");
          if (it.previous_ipk) bits.push("prev");
          o.textContent = it.id + (bits.length ? " (" + bits.join(", ") + ")" : "");
          pick.appendChild(o);
        });
        if (prev) pick.value = prev;
      }
      updateBakButtons();
    }).catch(function () {
      updateBakButtons();
    });
  }

  function refreshIpkPanel() {
    const ipkBtn = document.getElementById("installIpk");
    const verLine = document.getElementById("ipkVerLine");
    if (!ipkBtn) return;
    const auth = authGet();
    const isRoot = !!(auth && String(auth.user || "").toLowerCase() === "root");
    const enable = localEntware ? !!keeneticLan : (!!keeneticLan && !!auth && isRoot);
    ipkBtn.disabled = !enable;
    if (!keeneticLan) ipkBtn.title = t("titleAway");
    else if (!localEntware && !auth) ipkBtn.title = t("titleNeedAuth");
    else if (!localEntware && !isRoot) ipkBtn.title = t("ipkNeedRoot");
    else ipkBtn.title = t("tipInstallIpk");

    var req;
    if (localEntware) {
      req = fetch("/api/update/check", { cache: "no-store" });
    } else if (auth && isRoot) {
      req = fetch("/api/update/check", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: auth.host,
          port: parseInt(auth.port, 10) || 22,
          user: auth.user,
          password: auth.password || "",
        }),
      });
    } else {
      req = fetch("/api/update/check", { cache: "no-store" });
    }

    req.then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) {
        ipkInfo = null;
        if (verLine) verLine.textContent = "";
        ipkBtn.textContent = t("ipkBtn");
        updateBakButtons();
        return;
      }
      ipkInfo = j;
      var extra = "";
      if (j.router_version) extra += t("ipkVerRouter", j.router_version);
      if (j.app_update && !localEntware) extra += t("ipkAppUpdate");
      if (verLine) verLine.textContent = t("ipkVer", j.local_version || "?", j.latest_version || "?", extra);
      if (j.router_installed && j.ipk_update) {
        ipkBtn.textContent = t("ipkBtnUpdate", j.latest_version || "");
      } else if (j.router_installed && !j.ipk_update) {
        ipkBtn.textContent = t("ipkUpToDate", j.latest_version || j.router_version || "");
      } else {
        ipkBtn.textContent = t("ipkBtn");
      }
      updateBakButtons();
    }).catch(function () {
      ipkInfo = null;
      updateBakButtons();
    });
  }
  function saveAuthForm() {
    const f = readAuthForm();
    if (!f.name || !f.host || !f.user || !parseInt(f.port, 10)) {
      showAuthErr(t("needFields"));
      return;
    }
    if (!keeneticLan) {
      showAuthErr(t("notHome"));
      return;
    }
    const btn = document.getElementById("authSave");
    btn.disabled = true;
    showAuthErr(t("probing"));
    fetch("/api/keenetic/probe", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: f.host,
        port: parseInt(f.port, 10),
        user: f.user,
        password: f.password,
      }),
    }).then(function (r) {
      return r.json().then(function (j) { return { r: r, j: j }; }).catch(function () {
        return { r: r, j: {} };
      });
    }).then(function (x) {
      const r = x.r;
      const j = x.j || {};
      if (r.status === 403 || j.where === "internet") {
        setKeeneticButton(false, j.hint);
        showAuthErr(awayHint(j.hint));
        return;
      }
      if (!r.ok || !j.ok) throw new Error(t("sshDenied"));
      const list = loadProfiles();
      const id = (authDraft && authDraft.id) || authEditingId || newAuthId();
      const next = {
        id: id,
        name: f.name,
        host: f.host,
        port: f.port,
        user: f.user,
        password: f.password,
        ok: true,
      };
      let found = false;
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) { list[i] = next; found = true; break; }
      }
      if (!found) list.push(next);
      authDraft = null;
      authEditingId = id;
      saveProfiles(list, id);
      hideAuthDlg();
      showErr("");
      setKeeneticButton(keeneticLan, null);
    }).catch(function (e) {
      showAuthErr(e && e.message ? e.message : t("probeFail"));
    }).finally(function () {
      btn.disabled = false;
    });
  }

  migrateProfiles();
  fetch("/api/health", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (h) {
    localEntware = !!(h && (h.service === "keengen-entware" || h.mode === "local"));
  }).catch(function () { localEntware = false; }).then(function () {
    return fetch("/api/keenetic/where", { cache: "no-store" }).then(function (r) { return r.json(); });
  }).then(function (j) {
    setKeeneticButton(j && j.where === "lan", j && j.hint);
    refreshBackupList();
  }).catch(function () {
    setKeeneticButton(false, t("notHome"));
    refreshBackupList();
  });
  document.getElementById("authKeenetic").addEventListener("click", function () {
    var btn = document.getElementById("authKeenetic");
    if (!btn || btn.disabled) return;
    showAuthDlg();
  });
  document.getElementById("authCancel").addEventListener("click", hideAuthDlg);
  document.getElementById("authSave").addEventListener("click", saveAuthForm);
  (function () {
    const ipkBtn = document.getElementById("installIpk");
    const ipkStatus = document.getElementById("ipkStatus");
    const ipkLog = document.getElementById("ipkLog");
    const ipkErr = document.getElementById("ipkErr");
    function showIpkErr(msg) {
      if (!ipkErr) return;
      ipkErr.textContent = msg || "";
      ipkErr.hidden = !msg;
    }
    if (!ipkBtn) return;
    ipkBtn.addEventListener("click", function () {
      if (ipkBtn.disabled) return;
      const auth = authGet();
      if (!localEntware) {
        if (!auth || !keeneticLan) return;
        if (String(auth.user || "").toLowerCase() !== "root") {
          showErr("");
          showIpkErr(t("ipkNeedRoot"));
          return;
        }
      }
      if (!window.confirm(t("ipkConfirm"))) return;
      ipkBtn.disabled = true;
      showErr("");
      showIpkErr("");
      if (ipkStatus) ipkStatus.textContent = t("ipkBusy");
      var ipkUiLink = document.getElementById("ipkUiLink");
      if (ipkUiLink) {
        ipkUiLink.hidden = true;
        ipkUiLink.removeAttribute("href");
      }
      if (ipkLog) {
        ipkLog.hidden = true;
        ipkLog.textContent = "";
      }
      var uiWin = null;
      try { uiWin = window.open("about:blank", "_blank"); } catch (eOpenPre) { uiWin = null; }
      function closeUiWin() {
        if (uiWin && !uiWin.closed) {
          try { uiWin.close(); } catch (eClose) { /* ignore */ }
        }
        uiWin = null;
      }
      const payload = localEntware ? {} : {
        host: auth.host,
        port: parseInt(auth.port, 10) || 22,
        user: auth.user,
        password: auth.password || "",
      };
      fetch("/api/keenetic/install-ipk", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(function (r) {
        return r.json().then(function (j) { return { r: r, j: j }; }).catch(function () {
          return { r: r, j: {} };
        });
      }).then(function (x) {
        const j = x.j || {};
        const steps = j.steps && j.steps.length ? j.steps : null;
        function paintIpkLog() {
          if (!ipkLog || !steps) return;
          ipkLog.hidden = false;
          ipkLog.textContent = steps.map(function (s) {
            return (s.ok ? "[ok] " : "[fail] ") + s.step + (s.detail ? "\n" + s.detail : "");
          }).join("\n\n");
        }
        function lastFailStep() {
          if (!steps) return null;
          for (var i = steps.length - 1; i >= 0; i--) {
            if (!steps[i].ok) return steps[i];
          }
          return null;
        }
        if (!x.r.ok || !j.ok) {
          closeUiWin();
          paintIpkLog();
          var fail = lastFailStep();
          var detail = fail && fail.detail ? String(fail.detail).replace(/\s+/g, " ").trim() : "";
          if (detail.length > 120) detail = detail.slice(0, 117) + "…";
          var stepBit = fail && fail.step
            ? t("ipkFailStep", fail.step, detail ? ": " + detail : "")
            : (j.error || ("HTTP " + x.r.status));
          if (ipkStatus) ipkStatus.textContent = stepBit;
          showIpkErr(steps ? t("ipkFailLog") : t("ipkFail", j.error || ("HTTP " + x.r.status)));
          return;
        }
        showIpkErr("");
        if (ipkLog) {
          ipkLog.hidden = true;
          ipkLog.textContent = "";
        }
        const ver = j.installed_version || (ipkInfo && ipkInfo.latest_version) || "";
        var uiUrl = j.ui || ("http://" + (auth && auth.host ? auth.host : "127.0.0.1") + ":1001/");
        var bakStamp = backupStampFrom(j);
        var opened = false;
        if (uiWin && !uiWin.closed) {
          try {
            uiWin.location.href = uiUrl;
            opened = true;
          } catch (eNav) {
            opened = false;
          }
        }
        if (!opened) closeUiWin();
        if (ipkUiLink) {
          if (opened) {
            ipkUiLink.hidden = true;
            ipkUiLink.removeAttribute("href");
          } else {
            ipkUiLink.href = uiUrl;
            ipkUiLink.textContent = t("ipkOpenUi");
            ipkUiLink.hidden = false;
          }
        }
        if (ipkStatus) {
          var okMsg = opened ? t("ipkOkOpen", ver) : t("ipkOk", ver, uiUrl);
          ipkStatus.textContent = bakStamp ? (okMsg + " · " + t("bakMadeShort", bakStamp)) : okMsg;
        }
        if (bakStamp) showBakNotice(bakStamp);
        refreshIpkPanel();
        refreshBackupList();
      }).catch(function (e) {
        closeUiWin();
        if (ipkLog) {
          ipkLog.hidden = true;
          ipkLog.textContent = "";
        }
        var msg = e && e.message ? e.message : e;
        if (ipkStatus) ipkStatus.textContent = t("ipkFail", msg);
        showIpkErr(t("ipkFail", msg));
      }).finally(function () {
        setKeeneticButton(keeneticLan, null);
      });
    });
  })();
  document.getElementById("authAdd").addEventListener("click", function () {
    authDraft = { id: newAuthId(), name: "", host: "", port: "", user: "", password: "", ok: false };
    authEditingId = authDraft.id;
    formFromProfile(authDraft);
    showAuthErr("");
    paintAuthPick();
    document.getElementById("authName").focus();
    setKeeneticButton(keeneticLan, null);
  });
  document.getElementById("authDel").addEventListener("click", function () {
    const id = authEditingId;
    if (!id || authDraft) return;
    const list = loadProfiles().filter(function (p) { return p.id !== id; });
    const next = list[0] ? list[0].id : "";
    saveProfiles(list, next);
    if (next) openProfile(next);
    else {
      authDraft = { id: newAuthId(), name: "", host: "", port: "", user: "", password: "", ok: false };
      authEditingId = authDraft.id;
      formFromProfile(authDraft);
      paintAuthPick();
    }
    setKeeneticButton(keeneticLan, null);
  });
  document.getElementById("authPick").addEventListener("change", function () {
    const id = document.getElementById("authPick").value;
    if (authDraft && id === authDraft.id) {
      formFromProfile(authDraft);
      authEditingId = authDraft.id;
      return;
    }
    openProfile(id);
    saveProfiles(loadProfiles(), id);
    setKeeneticButton(keeneticLan, null);
  });
  ["authName", "authHost", "authPort", "authUser", "authPass"].forEach(function (fid) {
    document.getElementById(fid).addEventListener("input", function () {
      if (authDraft) {
        const f = readAuthForm();
        authDraft.name = f.name;
        authDraft.host = f.host;
        authDraft.port = f.port;
        authDraft.user = f.user;
        authDraft.password = f.password;
        authDraft.ok = false;
        paintAuthPick();
      }
    });
  });
  function authPayload() {
    const a = authGet();
    if (a) {
      return {
        host: a.host,
        port: parseInt(a.port, 10) || 22,
        user: a.user,
        password: a.password || "",
      };
    }
    if (localEntware) {
      return { host: "127.0.0.1", port: 22, user: "local", password: "" };
    }
    return null;
  }

  document.getElementById("readKeenetic").addEventListener("click", function () {
    const btn = document.getElementById("readKeenetic");
    if (!keeneticLan || btn.disabled) return;
    const a = authPayload();
    if (!a) {
      showAuthDlg();
      showErr(t("needAuth"));
      return;
    }
    btn.disabled = true;
    showErr("");
    fetch("/api/keenetic/read", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a),
    }).then(function (r) {
      return r.json().then(function (j) { return { r: r, j: j }; }).catch(function () {
        return { r: r, j: {} };
      });
    }).then(function (x) {
      const r = x.r;
      const j = x.j || {};
      if (r.status === 403 || j.where === "internet") {
        setKeeneticButton(false, j.hint);
        showErr(awayHint(j.hint));
        return;
      }
      if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
      const pack = (j.files && typeof j.files === "object") ? j.files : j;
      loadSnapshot(pack);
      var bakStamp = backupStampFrom(j);
      if (bakStamp) showBakNotice(bakStamp);
      refreshBackupList();
      if (!state.servers.length) {
        showErr(j.missing && j.missing.indexOf("04_outbounds.json") >= 0
          ? t("readNo04file")
          : t("readNo04conn"));
      } else if (j.missing && j.missing.length) {
        showErr(t("readMissing", j.missing.join(", ")));
      } else {
        showErr("");
      }
    }).catch(function (e) {
      showErr(t("readFail", e && e.message ? e.message : e));
    }).finally(function () {
      setKeeneticButton(keeneticLan, null);
    });
  });

  (function wireBackupUi() {
    var pick = document.getElementById("backupPick");
    var refreshBtn = document.getElementById("bakRefresh");
    var cfgBtn = document.getElementById("bakRestoreCfg");
    var ipkBtn = document.getElementById("bakRestoreIpk");
    var remBtn = document.getElementById("bakRemoveIpk");
    var bakStatus = document.getElementById("bakStatus");
    if (pick) pick.addEventListener("change", updateBakButtons);
    if (refreshBtn) refreshBtn.addEventListener("click", function () {
      if (bakStatus) bakStatus.textContent = t("bakBusy");
      refreshBackupList().then(function () {
        if (bakStatus) bakStatus.textContent = t("bakOk");
      });
    });
    function bakAuthOrFail() {
      if (localEntware) return null;
      var auth = authGet();
      if (!auth || !keeneticLan) {
        showErr(t("needAuth"));
        return null;
      }
      if (String(auth.user || "").toLowerCase() !== "root") {
        showErr(t("bakNeedRoot"));
        return null;
      }
      return {
        host: auth.host,
        port: parseInt(auth.port, 10) || 22,
        user: auth.user,
        password: auth.password || "",
      };
    }
    if (cfgBtn) cfgBtn.addEventListener("click", function () {
      if (cfgBtn.disabled) return;
      var item = selectedBak();
      if (!item || !item.configs) return;
      var auth = bakAuthOrFail();
      if (!auth) return;
      if (!window.confirm(t("bakConfirmCfg", item.id))) return;
      if (bakStatus) bakStatus.textContent = t("bakBusy");
      cfgBtn.disabled = true;
      fetch("/api/backups/restore-configs", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ stamp: item.id }, auth)),
      }).then(function (r) {
        return r.json().then(function (j) { return { r: r, j: j }; }).catch(function () {
          return { r: r, j: {} };
        });
      }).then(function (x) {
        if (!x.r.ok || !(x.j && x.j.ok)) {
          showErr(t("bakFail", (x.j && x.j.error) || ("HTTP " + x.r.status)));
          if (bakStatus) bakStatus.textContent = "";
          return;
        }
        showErr("");
        if (bakStatus) bakStatus.textContent = t("bakOk");
      }).catch(function (e) {
        showErr(t("bakFail", e && e.message ? e.message : e));
        if (bakStatus) bakStatus.textContent = "";
      }).finally(function () {
        updateBakButtons();
      });
    });
    if (ipkBtn) ipkBtn.addEventListener("click", function () {
      if (ipkBtn.disabled) return;
      var item = selectedBak();
      if (!item) return;
      var which = item.previous_ipk ? "previous" : "installed";
      if (!item.previous_ipk && !item.ipk) return;
      var auth = bakAuthOrFail();
      if (!auth) return;
      if (!window.confirm(t("bakConfirmIpk", item.id + " / " + which))) return;
      if (bakStatus) bakStatus.textContent = t("bakBusy");
      ipkBtn.disabled = true;
      fetch("/api/backups/restore-ipk", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ stamp: item.id, which: which }, auth)),
      }).then(function (r) {
        return r.json().then(function (j) { return { r: r, j: j }; }).catch(function () {
          return { r: r, j: {} };
        });
      }).then(function (x) {
        if (!x.r.ok || !(x.j && x.j.ok)) {
          showErr(t("bakFail", (x.j && x.j.error) || ("HTTP " + x.r.status)));
          if (bakStatus) bakStatus.textContent = "";
          return;
        }
        showErr("");
        if (bakStatus) bakStatus.textContent = t("bakOk");
        refreshIpkPanel();
      }).catch(function (e) {
        showErr(t("bakFail", e && e.message ? e.message : e));
        if (bakStatus) bakStatus.textContent = "";
      }).finally(function () {
        updateBakButtons();
      });
    });
    if (remBtn) remBtn.addEventListener("click", function () {
      if (remBtn.disabled || localEntware) return;
      var auth = bakAuthOrFail();
      if (!auth) return;
      if (!window.confirm(t("bakConfirmRemove"))) return;
      if (bakStatus) bakStatus.textContent = t("bakBusy");
      remBtn.disabled = true;
      fetch("/api/keenetic/remove-ipk", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      }).then(function (r) {
        return r.json().then(function (j) { return { r: r, j: j }; }).catch(function () {
          return { r: r, j: {} };
        });
      }).then(function (x) {
        var j = x.j || {};
        if (!x.r.ok || !j.ok) {
          showErr(t("bakFail", j.error || ("HTTP " + x.r.status)));
          if (bakStatus) bakStatus.textContent = "";
          return;
        }
        showErr("");
        var bakStamp = backupStampFrom(j) || backupStampFrom({ backup: j.backup });
        if (bakStamp) showBakNotice(bakStamp);
        else if (bakStatus) bakStatus.textContent = t("bakOk");
        refreshIpkPanel();
        refreshBackupList();
      }).catch(function (e) {
        showErr(t("bakFail", e && e.message ? e.message : e));
        if (bakStatus) bakStatus.textContent = "";
      }).finally(function () {
        updateBakButtons();
      });
    });
  })();

  document.addEventListener("kg-lang", function () {
    rebuild();
    setKeeneticButton(keeneticLan, null);
    setCopyEnabled();
    refreshBackupList();
  });

  restoreWork();
  if (state.servers.length || Object.keys(state.baseJson).length || Object.keys(state.baseText).length) {
    rebuild();
  }
  showPreview();
})();

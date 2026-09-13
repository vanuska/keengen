# Что это

Кроссплатформенный автономный генератор конфигов **XKeen / Xray** с функцией чтения, мёрджа конфигов и заливки их на для Keenetic.

Crosspatform `vless://`, `hy2://`, … generator, reader and uploader for **Keenetic** [XKeen-UI](https://github.com/zxc-rv/XKeen-UI). Runs in the browser or as `python3 start.py` on Windows / Linux / macOS.

## Картинки

<p align="center">
  <img src="docs/screenshots/01-links.jpg" width="260" alt="links">
  <img src="docs/screenshots/02-login.jpg" width="260" alt="login">
  <img src="docs/screenshots/03-preview.jpg" width="260" alt="preview">
</p>

# Как пользоваться

XKeen-UI остаётся на Keenetic. keengen cxbnsdftn и готовит JSON который заливается на Луутуешс с XKeen-UI в ядро XRAY.

## Быстрый старт

Подробно: [docs/howto.md](docs/howto.md)

```bash
git clone https://github.com/vanuska/keengen.git
cd keengen
python3 start.py
```

Или просто скачиваете в папку. 

Вам нужно знать лоин, пароль и порт от Entware/dropbear, вы его задавали на этапе установки XKeen-UI. 
Обычно: root, keenetic, 22.

Windows: `start.bat`. Linux/macOS: `./start.sh` (нужен `python3`; на Debian ещё `python3-venv`).
Скрипт сам создаёт `.venv` и ставит `paramiko`. `.venv` между ОС не копируйте.

Откроется [http://127.0.0.1:8765/](http://127.0.0.1:8765/).  
`--bind` по умолчанию loopback. На `0.0.0.0` не слушайте без нужды: SSH API окажется в LAN.

Без helper (только ZIP): откройте `web/index.html` через любой статический сервер или GitHub Pages (каталог `web/`). Кнопки Keenetic без helper будут «не дома» — это ожидаемо.

## В интерфейсе

1. Вставьте ссылки (`vless://`, `hy2://`, `trojan://`, `vmess://`, `ss://`)
   QR / `.txt`.
   Подписку `https://` не вставлять её не принимает сам движок.
3. «Прочитать ссылки». В таблице — все outbound.
4. Radio — какой тег пойдёт в `05_routing.json`.
5. «Скачать все файлы разом» → `/opt/etc/xray/configs/` → restart XKeen.
6. Проверка: выбранные сайты через прокси, остальное `direct`.

Несколько ссылок = несколько outbound в **одном** `04_outbounds.json`
(+ `direct` + `block`).

Локально с SSH: `python3 start.py` → http://127.0.0.1:8765/

## Что Xray ест, а что нет

| Вход | Xray 26.1.23+ | Mihomo |
|---|---|---|
| `vless://` `hy2://` `trojan://` `vmess://` `ss://` | да → outbound JSON | да → YAML |
| `https://…` подписка | **нет** (ядро URL не тянет) | да, proxy-providers |

Hysteria2 в Xray — с v26.1.23. Старый Xray JSON примет — ядро может не поднять.

## Три слоя (не путать «роутинг»)

1. **iptables XKeen** (вкладка xkeen: `.lst`) — порт/IP вообще пускать в ядро?
2. **inbound :61219** (`03_inbounds.json`) — Xray принял пакет, sniffing вынул имя.
3. **routing → outbound** (`05` + `04`) — youtube в прокси или `direct`.

ZIP keengen = слои 2–3. Слой 1 и политику Keenetic `xkeen` keengen не создаёт.

## Файлы 01–06

| файл | зачем |
|---|---|
| `01_log.json` | журнал ядра; на роутере обычно `loglevel: silent` |
| `02_dns.json` | встроенный DNS Xray; у keengen обычно `{}` (DNS роутера) |
| `03_inbounds.json` | вход с роутера: redirect+tproxy на `:61219` |
| `04_outbounds.json` | прокси по ссылкам + `direct` + `block` |
| `05_routing.json` | правила сверху вниз; radio пишет активный тег |
| `06_policy.json` | таймауты сокетов (level 0) |

`02_transport.json` не создаём.

### 01_log
Дневник процесса `xray`. Болтливый лог на флэш Entware быстро съедает место.
Типично: access/error в `/opt/var/log/xray/`, `loglevel: silent`.
Для отладки на час — `warning`/`info`, потом снова `silent`.

### 02_dns
Пустой `{}` = системный DNS роутера. Непустой блок — второй резолвер рядом
с AdGuard; для дома часто лишний.

### 03_inbounds
Не сервер в интернет: принимает то, что перехватил XKeen.
Два inbound на порт **61219**: TCP redirect + UDP tproxy.
Sniffing `http`/`tls`, `routeOnly: true`. Порт 61219 не менять, пока
iptables XKeen смотрит туда же.

### 04_outbounds
Двери наружу: по одной на share-ссылку, плюс `direct` (freedom) и `block`
(blackhole; keengen душит UDP/443 QUIC).
Radio не удаляет остальные прокси — только выбирает тег для routing.
VLESS — язык панели (`vnext` / как у XKeen-UI). Hy2 → `protocol: hysteria`.

### 05_routing
Правила сверху вниз, первое совпадение побеждает.
Типичная лестница: UDP/443 → block; домены → proxy-тег;
`ext:zkeen.dat:…` / `ext:zkeenip.dat:…` → proxy; остальное → direct.
Опечатка в `outboundTag` = пакет в никуда.

### 06_policy
Не путать с политикой Keenetic `xkeen`. Здесь таймауты ядра.
keengen обычно ставит `uplinkOnly`/`downlinkOnly` = 0 для level 0.

## Вкладка XKeen-UI — три списка (слой 1)

| UI | файл | смысл |
|---|---|---|
| port-proxying | `/opt/etc/xkeen/port_proxying.lst` | белый список портов в Xray |
| port-exclude | `/opt/etc/xkeen/port_exclude.lst` | чёрный список (если белый пуст) |
| ip-exclude | `/opt/etc/xkeen/ip_exclude.lst` | IP/CIDR никогда не в прокси |

Формат: одна запись на строку; `#` — комментарий; порт `80`, диапазон `596:599`;
IP `192.0.2.8` или CIDR. После Save — `xkeen -restart`.

Если `port_proxying` не пустой — белый список, `port_exclude` игнор.
Иначе — чёрный список. `ip_exclude` работает всегда.

Сценарий «только веб»: proxying `80` и `443`, exclude пустой.
Сценарий «почти всё кроме SSH/RDP/торрента»: proxying пустой, exclude `22`,
`3389`, `6881:6889`.
Сценарий «этот хост мимо»: IP в `ip_exclude` (не домены).

## Политика Keenetic `xkeen`

В морде Keenetic нужна политика с **точным именем** `xkeen` и клиенты в ней.
Без этого слои 1–3 для устройства как выключены. keengen политику не создают.

## Типичная ошибка «outbound есть, youtube нет»

- клиент не в политике `xkeen`;
- 443 нет в `port_proxying` (или exclude съел порт);
- IP CDN в `ip_exclude`;
- в `05` другой tag, чем живой сервер в `04`;
- ядро старое и не ест hy2, хотя JSON зелёный.

## SSH с helper

`python3 start.py` (или `start.bat` / `./start.sh`).
Форма: LAN IP, порт Entware SSH, логин, пароль (пусто = `KEENGEN_SSH_KEY`).
Только private IP. «Залить» — бэкап на роутере, потом файлы, опционально
`xkeen -restart`.

## CLI без браузера

```bash
python generate.py --self-test
python generate.py --link "vless://…" --link "hy2://…" --proxy vpn-a --out ./out
```

Учебные UUID в `--self-test` вымышленные (`example.com`), не боевые.

## GitHub Pages

Workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) публикует `web/`.  
После включения Pages сайт: `https://vanuska.github.io/keengen/` — только ядро, без SSH.

## Чего здесь нет, но будет

- ipk на Entware/dropbear.

Архитектура: [docs/architecture.md](docs/architecture.md).  
Безопасность: [SECURITY.md](SECURITY.md).

## Лицензия

[MIT](LICENSE)
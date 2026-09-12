# keengen

Share-links (`vless://`, `hy2://`, …) → ZIP of Xray JSON `01_log`…`06_policy` for **Keenetic** [XKeen-UI](https://github.com/zxc-rv/XKeen-UI). Runs in the browser or as `python3 start.py` on Windows / Linux / macOS.

Русский: автономный генератор конфигов **XKeen / Xray** для Keenetic. Это не панель на роутере.
Домашний k8s-деплой — отдельный приватный git, сюда не входит.

Вход: share-ссылки `vless://`, `hy2://`, `trojan://`, `vmess://`, `ss://` и QR.  
Выход: ZIP с `01_log.json` … `06_policy.json` в `/opt/etc/xray/configs/`.  
Несколько ссылок → несколько outbound в одном `04_outbounds.json` (как пул XKeen-UI).

Это **не** панель на роутере и **не** замена [XKeen-UI](https://github.com/zxc-rv/XKeen-UI). keengen кормит XKeen-UI готовыми файлами.

`https://` подписка панели **не** вход: ядро Xray URL само не тянет. Нужны строки `vless://` / `hy2://`.

## Скриншоты

![Ссылки и файлы](docs/screenshots/01-links.jpg)
![Вход на Keenetic](docs/screenshots/02-login.jpg)
![Превью и заливка](docs/screenshots/03-preview.jpg)

## Два слоя

| Слой | Что | Зачем |
|---|---|---|
| **Ядро** `web/` | Статика, генерация **в браузере** | ZIP для XKeen-UI. Можно GitHub Pages, любой nginx, `python keengen.py` |
| **Helper** `keengen.py` | Тот же `web/` + `/api/keenetic/*` на `127.0.0.1` | «Прочитать / Залить» по SSH **с вашего ПК** |

k8s, SSO, Cloudflare и чужие домашние сайты сюда **не входят**.

## Одна команда

```bash
git clone https://github.com/vanuska/keengen.git
cd keengen
python3 start.py
```

Windows: `start.bat`. Linux/macOS: `./start.sh` (нужен `python3`; на Debian ещё `python3-venv`).
Скрипт сам создаёт `.venv` и ставит `paramiko`. `.venv` между ОС не копируйте.

Откроется [http://127.0.0.1:8765/](http://127.0.0.1:8765/).  
`--bind` по умолчанию loopback. На `0.0.0.0` не слушайте без нужды: SSH API окажется в LAN.

Без helper (только ZIP): откройте `web/index.html` через любой статический сервер или GitHub Pages (каталог `web/`). Кнопки Keenetic без helper будут «не дома» — это ожидаемо.

## Как настроить XKeen-UI

Подробно: [docs/howto.md](docs/howto.md). Кратко:

1. Вставить share-ссылки → «Прочитать ссылки».
2. Radio — какой тег в `05_routing.json`.
3. Скачать ZIP → файлы в `/opt/etc/xray/configs/` → restart XKeen.
4. SSH с helper: в форме LAN-адрес роутера, порт Entware SSH (часто 22), логин, пароль. Пустой пароль = ключ из `KEENGEN_SSH_KEY`. Пишет только на **private** IP.

## CLI без браузера

```bash
python generate.py --self-test
python generate.py --link "vless://…" --link "hy2://…" --proxy vpn-a --out ./out
```

Учебные UUID в `--self-test` вымышленные (`example.com`), не боевые.

## GitHub Pages

Workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) публикует `web/`.  
После включения Pages сайт: `https://vanuska.github.io/keengen/` — только ядро, без SSH.

## Чего здесь нет

- Манифесты Kubernetes, oauth2-proxy, туннель
- Привязки к чужому homelab
- ipk на Entware (это была бы вторая панель на роутере)

Архитектура: [docs/architecture.md](docs/architecture.md).  
Безопасность: [SECURITY.md](SECURITY.md).

## Лицензия

[MIT](LICENSE)

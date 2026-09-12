# Как пользоваться

XKeen-UI остаётся на Keenetic. keengen готовит JSON, который панель ест.

## Что вставлять

| Вход | Xray 26.1.23+ | Mihomo |
|---|---|---|
| `vless://` `hy2://` `trojan://` `vmess://` `ss://` | да → outbound JSON | да → YAML |
| `https://…` подписка | **нет** | да, proxy-providers |

Несколько ссылок = несколько outbound в **одном** `04_outbounds.json`, плюс `direct` и `block`.

## ZIP → роутер вручную

1. Откройте keengen (helper или Pages).
2. Вставьте ссылки, «Прочитать ссылки».
3. «Скачать все файлы разом».
4. Файлы в `/opt/etc/xray/configs/`:

| файл | смысл |
|---|---|
| `01_log.json` | уровень лога |
| `02_dns.json` | у keengen обычно `{}` |
| `03_inbounds.json` | куда Keenetic сбрасывает трафик (`:61219`) |
| `04_outbounds.json` | прокси + direct + block |
| `05_routing.json` | какой outbound по доменам/IP |
| `06_policy.json` | таймауты |

5. Restart XKeen. Проверка: выбранный тег идёт в прокси, остальное `direct`.

Списки `/opt/etc/xkeen/*.lst` и политику Keenetic `xkeen` keengen ZIP не создаёт — это XKeen-UI / NDM.

## SSH с helper

Нужен Python 3 и `pip install -r requirements.txt` (paramiko).

```bash
python keengen.py
```

В браузере только `http://127.0.0.1:8765/` (тот же origin, что API).

Форма входа: название, **LAN IP** роутера, порт SSH Entware, логин, пароль.  
Пустой пароль — ключ `KEENGEN_SSH_KEY`.  
Helper отказывается ходить на публичные адреса.

«Сохранить» = probe SSH. Пока probe не ок, «Прочитать с Keenetic» выключена.  
«Залить» делает бэкап в `/tmp/keengen-backup-*` на роутере, пишет файлы, опционально `sudo -n /opt/sbin/xkeen -restart`.

Пароль в git и в логи helper не попадает.

## GitHub Pages

Там только статика. SSH кнопок не будет — скачайте ZIP и примените в XKeen-UI.

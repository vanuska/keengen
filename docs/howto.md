# Как пользоваться

XKeen-UI остаётся на Keenetic. keengen готовит JSON 01–06 и списки XKeen, которые ядро Xray поднимает на роутере.

Два режима: **keengen на ПК** (`start.py` → `http://127.0.0.1:8765/`) и **keengen на Keenetic** (Entware IPK → `http://<router>:1001/`). Кратко в таблице — [README](../README.md).

## Что вставлять

| Вход | Xray 26.1.23+ | Mihomo |
|---|---|---|
| `vless://` `hy2://` `trojan://` `vmess://` `ss://` | да → outbound JSON | да → YAML |
| `https://…` подписка | **нет** | да, proxy-providers |

Несколько ссылок = несколько outbound в **одном** `04_outbounds.json`, плюс `direct` и `block`.

## ZIP → роутер вручную

1. Откройте keengen (на ПК, на Keenetic или GitHub Pages).
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

Списки `/opt/etc/xkeen/*.lst` и политику Keenetic `xkeen` ZIP не создаёт — это XKeen-UI / NDM. С keengen на ПК / на Keenetic их можно читать и писать отдельно.

## keengen на ПК (SSH)

Нужен Python 3. Удобнее через `start.py` / `start.bat` (создаёт `.venv`, ставит `paramiko`).

```bash
python3 start.py
```

В браузере только `http://127.0.0.1:8765/` (тот же origin, что API).

Форма «Настройка входа»: название, **LAN IP** роутера, порт SSH Entware (часто `22`, не KeeneticOS `:2222`), логин, пароль.  
Пустой пароль — ключ `KEENGEN_SSH_KEY`.  
keengen на ПК отказывается ходить на публичные адреса.

«Сохранить» = probe SSH. Пока probe не ок, «Прочитать с Keenetic» выключена.  
«Прочитать» подтягивает configs + списки и делает слепок на ПК в `backups/`.  
«Залить» делает бэкап в `/tmp/keengen-backup-*` на роутере, пишет файлы, опционально `xkeen -restart`.

Пароль в git и в логи не попадает.

## Бэкапы, Restore, снятие IPK

| Событие | На роутере | На ПК (`backups/`) |
|---|---|---|
| «Прочитать с Keenetic» | слепок configs + xkeen | да |
| Установка / обновление IPK | слепок перед `opkg` | да (+ `.ipk`, если с ПК) |
| «Залить» / Apply | `/tmp/keengen-backup-*` | нет |
| «Удалить IPK» (с ПК) | слепок перед remove | да |

**Restore** и **«Удалить IPK»** — только в keengen на ПК (на `:1001` секция скрыта: пакет не снимает сам себя). Нужен вход с логином **root**.

## keengen на Keenetic (IPK)

Пакет на порт **1001** рядом с XKeen-UI **:1000**. SSH с ПК для повседневной правки не обязателен.

- Ассет latest: `https://github.com/vanuska/keengen/releases/latest/download/keengen_mipsel-3.4.ipk`
- Из UI на ПК: кнопка «Установить / Обновить IPK» (качает GitHub по HTTPS на ПК — busybox `wget` на Entware часто без SSL).
- Сборка и one-liner: [ipk.md](ipk.md).

## Что не класть в git

Репозиторий на GitHub — зеркало Gitea. Не коммитить: журналы агента (`AGENT/`), `AGENTS.md`, пароли, токены, ключи, живые `vless://`, каталог `backups/`. Правки — на Gitea, не напрямую на GitHub. Подробнее: [SECURITY.md](../SECURITY.md).

## GitHub Pages

Там только статика. SSH и бэкапы на ПК недоступны — скачайте ZIP или запускайте keengen на ПК / на Keenetic.

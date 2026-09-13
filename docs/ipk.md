# keengen на Entware (IPK)

Пакет ставит UI + `keengen-httpd` на порт **1001**. JSON 01–06 и сценарии: [howto.md](howto.md), обзор: [README](../README.md).

> Официальный Release IPK — только **mipsel-3.4** (проверено на Keenetic Hopper). Другие arch (например aarch64-3.10) не в Release и не тестировались. Проверка установки на конкретном устройстве — у владельца роутера; в CI железа нет.

## Что в пакете `0.1.0-1`

| Часть | Путь на роутере |
|---|---|
| UI (статика) | `/opt/share/keengen/www/` |
| Helper `keengen-httpd` | `/opt/sbin/keengen-httpd` (mipsel, softfloat) |
| Init | `/opt/etc/init.d/S99keengen` |
| Conf | `/opt/etc/keengen/keengen.conf` (порт **1001**) |

API совместим с веб-UI: `/api/keenetic/where|probe|read|write`, но без SSH —
файлы читаются/пишутся локально. Бэкап при Apply: `/tmp/keengen-backup-*`.
При «Прочитать» — слепок на роутере (обычно `/opt/backup/keengen-…`).

XKeen-UI остаётся на **:1000**. keengen — на **:1001**.

Секция «Локальные бэкапы (на ПК)», Restore и «Удалить IPK» на `:1001` **скрыты** — снимать пакет нужно с keengen на ПК или вручную по SSH.

## Сборка (на Linux / WSL)

```bash
cd keengen   # ветка main
cd ipk/src/keengen-httpd
GOOS=linux GOARCH=mipsle GOMIPS=softfloat CGO_ENABLED=0 \
  go build -trimpath -ldflags='-s -w' -o ../../files/opt/sbin/keengen-httpd .
cd ../../..
bash ipk/scripts/build-ipk.sh
# → dist/keengen_0.1.0-1_mipsel-3.4.ipk
# → dist/keengen_mipsel-3.4.ipk  (то же содержимое, стабильное имя для latest)
```

## Формат `.ipk`

Entware (bin.entware.net) ждёт **gzip(tar)** с членами
`./debian-binary`, `./data.tar.gz`, `./control.tar.gz` — не Debian `ar`.
В `control.tar.gz` файл называется `./control` (lowercase). Скрипт:
[ipk/scripts/build-ipk.sh](../ipk/scripts/build-ipk.sh).

## Установка

### Из keengen на ПК (рекомендуется)

`POST /api/keenetic/install-ipk` (только Python / keengen на ПК): SSH как **root** →
бэкап → HTTPS-скачивание Release на ПК → `opkg install` → `S99keengen start` → health `:1001`.
В UI: кнопка после «Настройка входа» (логин **root**).

На самом роутере busybox `wget` часто **без HTTPS** — one-liner через wget с GitHub обычно не сработает. Если есть `curl`:

```sh
curl -fsSL -o /tmp/keengen_mipsel-3.4.ipk \
  "https://github.com/vanuska/keengen/releases/latest/download/keengen_mipsel-3.4.ipk" \
  && opkg install /tmp/keengen_mipsel-3.4.ipk \
  && /opt/etc/init.d/S99keengen start
```

### С ПК через scp

```sh
scp dist/keengen_mipsel-3.4.ipk root@192.168.1.1:/tmp/
ssh root@192.168.1.1
opkg install /tmp/keengen_mipsel-3.4.ipk
/opt/etc/init.d/S99keengen start
# браузер: http://<LAN-IP>:1001/
```

В UI на `:1001`: «Настройка входа» **серая** (не нужна) → сразу «Прочитать» / «Залить».

### Переустановка той же версии

Если Release пересобран с тем же тегом/версией (`0.1.0-1`), Entware может
считать пакет уже установленным. С ПК: «Удалить IPK», затем снова установка
с кнопки; или вручную `opkg remove keengen` и снова `opkg install …`.

Если `S99keengen start` пишет `not found`, а файл на месте — в init-скрипте
были CRLF (исправлено в сборке IPK). Нужна переустановка пакета с актуального
Release, не только `start`.

### Остановка и снятие

**С keengen на ПК:** кнопка «Удалить IPK» (бэкап → stop → `opkg remove`).

**Вручную:**

```sh
/opt/etc/init.d/S99keengen stop
opkg remove keengen
```

## Безопасность

Не публиковать `:1001` в интернет. WAN-фильтр Keenetic держать закрытым.
Перед Apply — бэкап; запись конфигов и restart — с LAN. См. [SECURITY.md](../SECURITY.md).

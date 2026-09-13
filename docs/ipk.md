# keengen на Entware (IPK)

Ветка git: `keengen-ipk`. JSON 01–06: [howto.md](howto.md).

## Что в пакете `0.1.0-1`

| Часть | Путь на роутере |
|---|---|
| UI (статика) | `/opt/share/keengen/www/` |
| Helper `keengen-httpd` | `/opt/sbin/keengen-httpd` (mipsel, softfloat) |
| Init | `/opt/etc/init.d/S99keengen` |
| Conf | `/opt/etc/keengen/keengen.conf` (порт **1001**) |

API совместим с веб-UI: `/api/keenetic/where|probe|read|write`, но без SSH —
файлы читаются/пишутся локально. Бэкап: `/tmp/keengen-backup-*`.

XKeen-UI остаётся на **:1000**. keengen — на **:1001**.

## Сборка (на Linux / agentbox)

```bash
cd keengen-public   # ветка keengen-ipk
cd ipk/src/keengen-httpd
GOOS=linux GOARCH=mipsle GOMIPS=softfloat CGO_ENABLED=0 \
  go build -trimpath -ldflags='-s -w' -o ../../files/opt/sbin/keengen-httpd .
cd ../../..
bash ipk/scripts/build-ipk.sh
# → dist/keengen_0.1.0-1_mipsel-3.4.ipk
```

## Формат `.ipk`

Entware (bin.entware.net) ждёт **gzip(tar)** с членами
`./debian-binary`, `./data.tar.gz`, `./control.tar.gz` — не Debian `ar`.
В `control.tar.gz` файл называется `./control` (lowercase). Скрипт:
[ipk/scripts/build-ipk.sh](../ipk/scripts/build-ipk.sh).

## Установка

### Из локального PC-helper

`POST /api/keenetic/install-ipk` (только Python helper): SSH как **root** →
бэкап → wget Release → `opkg install` → `S99keengen start` → health `:1001`.
В UI: секция «Установить keengen на Keenetic» после «Настройка входа».

Кратко для пользователя: [README.md](../README.md) → «Установка на Keenetic (Entware IPK)».

**Уже в SSH (Dropbear)** — одна строка, без `scp` с ПК (Release [v0.1.0](https://github.com/vanuska/keengen/releases/tag/v0.1.0); тег релиза должен быть и на Gitea — иначе push-mirror сотрёт GitHub-only tag):

```sh
wget -O /tmp/keengen_0.1.0-1_mipsel-3.4.ipk "https://github.com/vanuska/keengen/releases/download/v0.1.0/keengen_0.1.0-1_mipsel-3.4.ipk" && opkg install /tmp/keengen_0.1.0-1_mipsel-3.4.ipk && /opt/etc/init.d/S99keengen start
```

**С ПК через scp:**

```sh
scp dist/keengen_0.1.0-1_mipsel-3.4.ipk root@192.168.1.1:/tmp/
ssh root@192.168.1.1
opkg install /tmp/keengen_0.1.0-1_mipsel-3.4.ipk
/opt/etc/init.d/S99keengen start
# браузер: http://<LAN-IP>:1001/
```

В UI: «Настройка входа» → Save (local-режим: probe без SSH) → «Прочитать» / «Залить».
Бэкап перед записью: `/tmp/keengen-backup-*`. XKeen-UI на `:1000` не трогаем.

```sh
/opt/etc/init.d/S99keengen stop
opkg remove keengen
```

## Безопасность

Не публиковать `:1001` в интернет. WAN-фильтр Keenetic держать закрытым.
Перед Apply — бэкап; запись конфигов и restart — с LAN. См. [SECURITY.md](../SECURITY.md).

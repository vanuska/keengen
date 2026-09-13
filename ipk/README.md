# keengen IPK (Entware) — каркас

Ветка `keengen-ipk`. Цель: поставить **статический UI keengen** на Keenetic
рядом с XKeen-UI, не вместо него.

## Целевая платформа (снято с живого Entware)

| | |
|---|---|
| Arch | `mipsel-3.4` (MIPS 1004Kc, soft-float) |
| Entware | 2025.05 |
| Xray | 26.7.28 `linux/mipsle` |
| Уже занято | XKeen-UI на TCP **1000** |
| Свободно | предлагаем **1001** для keengen |
| Python на роутере | **нет** — helper `keengen.py` в ipk не входит |

`/opt` на USB — места достаточно. RAM ~256 Mi — тяжёлый интерпретатор не ставим.

## Что в пакете (план)

1. Статика из корневого `web/` → `/opt/share/keengen/www/`
2. Лёгкий HTTP (busybox httpd **или** крошечный бинарь) на `127.0.0.1:1001` / LAN
3. Опционально позже: mipsel-бинарь API read/write JSON + `xkeen -restart`
   (сейчас только заглушка в `src/`)

Это **не** замена XKeen-UI и **не** политика Keenetic `xkeen`.

## Сборка

См. [docs/ipk.md](../docs/ipk.md) и `scripts/build-ipk.sh`.

Пока скрипт собирает **каркасный** `.ipk` (статика + init + conf) без
кросс-компиляции бинаря. На роутер **не устанавливать**, пока не будет
осознанного `--apply` и бэкапа.

## Раскладка в этом каталоге

```
ipk/
  control/CONTROL     метаданные opkg
  files/opt/...       файлы, которые попадут в корень Entware
  scripts/build-ipk.sh
  src/                будущий helper (Go/C), пока README
```

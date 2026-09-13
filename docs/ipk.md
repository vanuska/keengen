# keengen на Entware (IPK) — дизайн

Ветка git: `keengen-ipk`. Канон для человека по JSON 01–06: [howto.md](howto.md).

## Зачем отдельный пакет

На ПК: `python3 start.py` / GitHub Pages.  
На роутере: XKeen-UI уже панель. keengen IPK — **вторая** витрина: те же
share-ссылки → ZIP/файлы 01–06, без k8s и без Python.

## Архитектура (цель)

```
браузер LAN ──► :1001  статическая web/ (+ позже API)
                    │
                    ▼
            /opt/etc/xray/configs/   (писать только после явного Apply)
            /opt/sbin/xkeen -restart (через sudoers, узкий NOPASSWD)
```

XKeen-UI остаётся на `:1000`. Порты не делить.

## Почему не Python

На целевом Keenetic (mipsel Entware) `python3` не установлен, RAM ~256 Mi.
Пакет тянет только статику и позже один маленький бинарь `mipsel`.

## Сборка каркаса

С машины с `bash` + `tar` + `gzip` (Linux/WSL/agentbox):

```bash
cd keengen-public
bash ipk/scripts/build-ipk.sh
# → dist/keengen_0.0.1-1_mipsel-3.4.ipk
```

Скрипт копирует `web/` в payload, кладёт init + conf, упаковывает
`control.tar.gz` + `data.tar.gz` + `debian-binary`.

Установка на роутер (когда решите, не сейчас):

```sh
opkg install ./keengen_0.0.1-1_mipsel-3.4.ipk
/opt/etc/init.d/S99keengen start
# UI: http://<LAN>:1001/
```

Снятие:

```sh
/opt/etc/init.d/S99keengen stop
opkg remove keengen
```

## Безопасность

- Слушать по умолчанию LAN / loopback — не выставлять в интернет.
- Запись конфигов и `xkeen -restart` — только после отдельного Apply и узкого sudoers.
- В git не класть боевые ссылки, пароли, журналы агента (см. [SECURITY.md](../SECURITY.md)).

## Статус каркаса

| Часть | Состояние |
|---|---|
| CONTROL / init / conf | черновик |
| упаковка статики в ipk | `build-ipk.sh` |
| HTTP-сервер | busybox `httpd` в init (если есть) иначе заглушка «не стартовал» |
| API SSH/write на роутере | не начат (`ipk/src/`) |
| Установка на боевой Keenetic | **не делать** без приказа |

# Архитектура

Три способа запуска, один репозиторий (`main`).

```
браузер ── web/ (ядро: разбор ссылок, ZIP)
              │
              ├── python keengen.py   127.0.0.1:8765   («keengen на ПК»)
              │         ├── GET  /                статика
              │         ├── GET  /api/keenetic/where
              │         └── POST /api/keenetic/probe|read|write|install-ipk|…
              │                   └── SSH (paramiko) → Keenetic LAN
              │
              └── keengen-httpd (Entware IPK)   :1001   («keengen на Keenetic»)
                        └── те же /api/… локально, без SSH
```

Ядро не знает про ваш дом: нет дефолтного IP, ключа и домена.  
keengen на ПК слушает loopback. SSH только на private IP из формы.

Публичный GitHub = этот каталог.  
Чужой homelab (k8s, gate, oauth2) — другой проект, файлы сюда не копируются.

## Entware IPK

Каркас пакета: каталог [`ipk/`](../ipk/), описание [`docs/ipk.md`](ipk.md).  
Статика `web/` на роутере (порт **1001** рядом с XKeen-UI **1000**).  
Python на Entware не используется. Ассеты релиза: GitHub Releases (`keengen_mipsel-3.4.ipk`).

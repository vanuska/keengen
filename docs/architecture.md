# Архитектура

Два слоя, один репозиторий.

```
браузер ── web/ (ядро: разбор ссылок, ZIP)
              │
              └── python keengen.py   127.0.0.1:8765
                        ├── GET  /                статика
                        ├── GET  /api/keenetic/where     {where: lan}
                        └── POST /api/keenetic/probe|read|write
                                  └── SSH (paramiko) → Keenetic LAN
```

Ядро не знает про ваш дом: нет дефолтного IP, ключа и домена.  
Helper слушает loopback. SSH только на private IP из формы.

Публичный GitHub = этот каталог.  
Чужой homelab (k8s, gate, oauth2) — другой проект, файлы сюда не копируются.

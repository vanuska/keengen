# keengen-httpd (Entware)

Small Go binary for the router: serves `web/` and the same
`/api/keenetic/*` JSON as keengen on PC, but reads/writes **local** files
under `/opt/etc/xray/configs` and `/opt/etc/xkeen` (no SSH, no Python).

## Build (cross-compile)

Needs Go 1.22+ on any amd64/arm64 host:

```bash
cd ipk/src/keengen-httpd
GOOS=linux GOARCH=mipsle GOMIPS=softfloat CGO_ENABLED=0 \
  go build -trimpath -ldflags='-s -w' -o ../../files/opt/sbin/keengen-httpd .
```

Then from repo root: `bash ipk/scripts/build-ipk.sh`

## API (local mode)

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/keenetic/where` | always `{where: lan}` |
| POST | `/api/keenetic/probe` | ignores SSH fields; checks config dirs |
| POST | `/api/keenetic/read` | reads allowed JSON/.lst from disk |
| POST | `/api/keenetic/write` | backup under `/tmp/keengen-backup-*`, write, optional `xkeen -restart` |

UI: open `http://<router>:1001/`, «Настройка входа» → Save once (probe always OK in local mode), then Read / Apply.

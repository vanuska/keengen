# keengen IPK (Entware)

Пакет **0.1.1-1** для `mipsel-3.4`: статика + `keengen-httpd` (ветка **`main`**).

Подробности: [docs/ipk.md](../docs/ipk.md). Исходник helper: [src/](src/).

## Быстрая сборка

```bash
cd ipk/src/keengen-httpd
GOOS=linux GOARCH=mipsle GOMIPS=softfloat CGO_ENABLED=0 \
  go build -trimpath -ldflags='-s -w' -o ../../files/opt/sbin/keengen-httpd .
cd ../../..
bash ipk/scripts/build-ipk.sh
```

Артефакт: `dist/keengen_0.1.1-1_mipsel-3.4.ipk` (в git не кладётся). Сборка снимает CRLF со всех текстовых файлов в stage.

На роутер ставить только по явному приказу (шаг 2).

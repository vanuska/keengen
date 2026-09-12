# Security

Public git (`admin/keengen` → GitHub) is a **full mirror**. Whatever is in the commit is on the internet.

## Never commit (Gitea or GitHub)

- Agent journals: `AGENT/`, `AGENT/CONTEXT.md`, chat dumps, transcripts
- `AGENTS.md` in the **public** tree (Cursor memo; not for users)
- Passwords, tokens, SSH keys, `.env`, `*pat*.txt`, `*secret*`
- Live `vless://` / `hy2://` (UUID, `pbk`), OIDC secrets
- Screenshots that show a password or a full share-link

Deleting a folder only on GitHub does nothing: the next Gitea push brings it back. Canonical edits: Gitea `admin/keengen`. Do not commit on GitHub.

`--self-test` uses fake `example.com` UUIDs only.

## Helper

- Binds to `127.0.0.1` by default. Do not publish `--bind 0.0.0.0`.
- SSH only to private IPs.
- UI passwords are for one SSH session; keengen does not log them or write them to disk.

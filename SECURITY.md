# Security

- Do not open GitHub issues with live `vless://` / `hy2://` links, UUID, pbk, or SSH passwords.
- The helper binds to `127.0.0.1` by default. Do not publish `--bind 0.0.0.0` to the internet.
- SSH is refused unless the host is a private IP address.
- Passwords from the UI are used for one SSH session and are not written to logs or disk by keengen.

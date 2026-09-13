// On-router keengen helper for Entware (mipsel).
// Serves web/ and local read/write of XKeen JSON/.lst — no SSH, no Python.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"
)

const (
	writeLimit = 262144
	authLimit  = 4096
	fileLimit  = 120000
)

var (
	jsonRemote = map[string]string{
		"01_log.json":       "/opt/etc/xray/configs/01_log.json",
		"02_dns.json":       "/opt/etc/xray/configs/02_dns.json",
		"03_inbounds.json":  "/opt/etc/xray/configs/03_inbounds.json",
		"04_outbounds.json": "/opt/etc/xray/configs/04_outbounds.json",
		"05_routing.json":   "/opt/etc/xray/configs/05_routing.json",
		"06_policy.json":    "/opt/etc/xray/configs/06_policy.json",
	}
	listRemote = map[string]string{
		"ip_exclude":   "/opt/etc/xkeen/ip_exclude.lst",
		"port_exclude": "/opt/etc/xkeen/port_exclude.lst",
		"port_proxying": "/opt/etc/xkeen/port_proxying.lst",
		"xkeen":        "/opt/etc/xkeen/xkeen.json",
	}
	allowedRemote map[string]string
	wwwRoot       string
	xkeenBin      = "/opt/sbin/xkeen"
)

func init() {
	allowedRemote = map[string]string{}
	for k, v := range jsonRemote {
		allowedRemote[k] = v
	}
	for k, v := range listRemote {
		allowedRemote[k] = v
	}
}

func main() {
	bind := flag.String("bind", envOr("KEENGEN_BIND", "0.0.0.0"), "listen address")
	port := flag.String("port", envOr("KEENGEN_PORT", "1001"), "listen port")
	www := flag.String("www", envOr("KEENGEN_WWW", "/opt/share/keengen/www"), "static web root")
	flag.Parse()
	wwwRoot = filepath.Clean(*www)
	if st, err := os.Stat(wwwRoot); err != nil || !st.IsDir() {
		log.Fatalf("missing www dir: %s", wwwRoot)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/keenetic/where", handleWhere)
	mux.HandleFunc("/api/keenetic/probe", handleProbe)
	mux.HandleFunc("/api/keenetic/read", handleRead)
	mux.HandleFunc("/api/keenetic/write", handleWrite)
	mux.HandleFunc("/", handleStatic)

	addr := *bind + ":" + *port
	log.Printf("keengen UI http://%s/ www=%s", addr, wwwRoot)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func envOr(k, def string) string {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		return v
	}
	return def
}

func writeJSON(w http.ResponseWriter, code int, payload any) {
	raw, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_, _ = w.Write(raw)
}

func readBody(r *http.Request, limit int64) (map[string]any, error) {
	defer r.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(raw)) > limit {
		return nil, fmt.Errorf("too-large")
	}
	if len(raw) == 0 {
		raw = []byte("{}")
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	return body, nil
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, 405, map[string]any{"ok": false, "error": "method"})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "service": "keengen-entware", "mode": "local"})
}

func handleWhere(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, 405, map[string]any{"ok": false, "error": "method"})
		return
	}
	// Running on the router = always LAN for the UI badge.
	writeJSON(w, 200, map[string]any{"ok": true, "where": "lan", "mode": "local"})
}

func handleProbe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]any{"ok": false, "error": "method"})
		return
	}
	if _, err := readBody(r, authLimit); err != nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad-json"})
		return
	}
	// Local mode: ignore SSH credentials; check config dirs are usable.
	if err := os.MkdirAll("/opt/etc/xray/configs", 0755); err != nil {
		writeJSON(w, 502, map[string]any{"ok": false, "error": "probe-failed"})
		return
	}
	writeJSON(w, 200, map[string]any{
		"ok":    true,
		"where": "lan",
		"host":  "local",
		"user":  "local",
		"mode":  "local",
	})
}

func handleRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]any{"ok": false, "error": "method"})
		return
	}
	if _, err := readBody(r, authLimit); err != nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad-json"})
		return
	}
	files := map[string]any{}
	missing := []string{}
	for name, p := range allowedRemote {
		raw, err := os.ReadFile(p)
		if err != nil {
			missing = append(missing, name)
			continue
		}
		if len(raw) > fileLimit {
			missing = append(missing, name)
			continue
		}
		text := string(raw)
		if _, isJSON := jsonRemote[name]; isJSON || name == "xkeen" {
			var v any
			if err := json.Unmarshal(raw, &v); err == nil {
				files[name] = v
			} else {
				files[name] = text
			}
		} else {
			files[name] = text
		}
	}
	writeJSON(w, 200, map[string]any{
		"ok":      true,
		"where":   "lan",
		"host":    "local",
		"files":   files,
		"missing": missing,
		"errors":  0,
		"mode":    "local",
	})
}

func handleWrite(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]any{"ok": false, "error": "method"})
		return
	}
	body, err := readBody(r, writeLimit)
	if err != nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad-write"})
		return
	}
	parsed, err := parseWriteFiles(body)
	if err != nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad-write"})
		return
	}
	restart := true
	if v, ok := body["restart"]; ok {
		if b, ok := v.(bool); ok {
			restart = b
		}
	}
	stamp := time.Now().Format("20060102-150405")
	bdir := "/tmp/keengen-backup-" + stamp
	if err := os.MkdirAll(bdir, 0755); err != nil {
		writeJSON(w, 502, map[string]any{"ok": false, "error": "backup-failed"})
		return
	}
	written := []string{}
	for name, text := range parsed {
		dest := allowedRemote[name]
		_ = copyFile(dest, filepath.Join(bdir, filepath.Base(dest)))
		if err := atomicWrite(dest, text); err != nil {
			writeJSON(w, 502, map[string]any{
				"ok": false, "error": "write-failed", "backup": bdir, "written": written,
			})
			return
		}
		written = append(written, name)
	}
	restarted := false
	if restart {
		cmd := exec.Command(xkeenBin, "-restart")
		if err := cmd.Run(); err != nil {
			// try sudo -n for non-root later
			cmd = exec.Command("sudo", "-n", xkeenBin, "-restart")
			if err2 := cmd.Run(); err2 != nil {
				writeJSON(w, 502, map[string]any{
					"ok": false, "error": "restart-failed", "backup": bdir,
					"written": written, "restarted": false,
				})
				return
			}
		}
		restarted = true
	}
	writeJSON(w, 200, map[string]any{
		"ok":        true,
		"where":     "lan",
		"host":      "local",
		"written":   written,
		"backup":    bdir,
		"restarted": restarted,
		"mode":      "local",
	})
}

func parseWriteFiles(body map[string]any) (map[string]string, error) {
	raw, ok := body["files"].(map[string]any)
	if !ok || len(raw) == 0 {
		return nil, fmt.Errorf("files")
	}
	out := map[string]string{}
	for name, value := range raw {
		dest, ok := allowedRemote[name]
		_ = dest
		if !ok {
			return nil, fmt.Errorf("name")
		}
		var text string
		if _, isJSON := jsonRemote[name]; isJSON || name == "xkeen" {
			switch v := value.(type) {
			case map[string]any, []any:
				b, err := json.MarshalIndent(v, "", "  ")
				if err != nil {
					return nil, err
				}
				text = string(b) + "\n"
			case string:
				if !json.Valid([]byte(v)) {
					return nil, fmt.Errorf("json")
				}
				text = v
				if !strings.HasSuffix(text, "\n") {
					text += "\n"
				}
			default:
				return nil, fmt.Errorf("json")
			}
		} else {
			s, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("lst")
			}
			text = s
		}
		if len(text) > fileLimit {
			return nil, fmt.Errorf("too-big")
		}
		out[name] = text
	}
	return out, nil
}

func atomicWrite(dest, text string) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
		return err
	}
	tmp := dest + ".new"
	if err := os.WriteFile(tmp, []byte(text), 0644); err != nil {
		return err
	}
	return os.Rename(tmp, dest)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func handleStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	urlPath := path.Clean("/" + strings.TrimPrefix(r.URL.Path, "/"))
	if urlPath == "/" {
		urlPath = "/index.html"
	}
	rel := strings.TrimPrefix(urlPath, "/")
	full := filepath.Join(wwwRoot, filepath.FromSlash(rel))
	full = filepath.Clean(full)
	if !strings.HasPrefix(full, wwwRoot+string(os.PathSeparator)) && full != wwwRoot {
		http.NotFound(w, r)
		return
	}
	st, err := os.Stat(full)
	if err != nil || st.IsDir() {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, full)
}

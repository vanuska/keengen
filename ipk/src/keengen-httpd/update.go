package main

// Local IPK install/update on the router (no SSH). Runs as root via S99keengen.

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	appVersion     = "0.1.5"
	githubRepo     = "vanuska/keengen"
	ipkAssetStable = "keengen_mipsel-3.4.ipk"
	minIpkBytes    = 50 << 10 // sanity floor for a real IPK
)

type ghRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

func handleUpdateCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]any{"ok": false, "error": "method"})
		return
	}
	latest, err := resolveLatestRelease()
	if err != nil {
		writeJSON(w, 200, map[string]any{
			"ok":            false,
			"error":         err.Error(),
			"local_version": appVersion,
			"service":       "keengen-entware",
		})
		return
	}
	verKnown := latest.version != "" && latest.version != "latest"
	writeJSON(w, 200, map[string]any{
		"ok":               true,
		"service":          "keengen-entware",
		"local_version":    appVersion,
		"router_version":   appVersion,
		"latest_version":   latest.version,
		"latest_tag":       latest.tag,
		"ipk_url":          latest.url,
		"ipk_name":         latest.name,
		"app_update":       false, // PC-only hint; never show standalone/git tip on :1001
		"ipk_update":       verKnown && verLess(appVersion, latest.version),
		"router_installed": true,
		"resolve_source":   latest.source,
	})
}

func handleInstallIpkLocal(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]any{"ok": false, "error": "method"})
		return
	}
	if _, err := readBody(r, authLimit); err != nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad-json"})
		return
	}
	result := installIpkLocal()
	code := 200
	ok, _ := result["ok"].(bool)
	if !ok {
		code = 502
	}
	// Never stop/restart before the client has the JSON body.
	writeJSON(w, code, result)
	if f, okFlush := w.(http.Flusher); okFlush {
		f.Flush()
	}
	if ok {
		if reload, _ := result["reloading"].(bool); reload {
			go func() {
				time.Sleep(500 * time.Millisecond)
				_ = exec.Command("/opt/etc/init.d/S99keengen", "restart").Run()
			}()
		}
	}
}

type latestIPK struct {
	tag, version, name, url, source string
}

func githubToken() string {
	if t := strings.TrimSpace(os.Getenv("KEENGEN_GITHUB_TOKEN")); t != "" {
		return t
	}
	return strings.TrimSpace(os.Getenv("GITHUB_TOKEN"))
}

func setGitHubHeaders(req *http.Request, api bool) {
	req.Header.Set("User-Agent", "keengen-entware/"+appVersion)
	if api {
		req.Header.Set("Accept", "application/vnd.github+json")
	} else {
		req.Header.Set("Accept", "*/*")
	}
	if t := githubToken(); t != "" {
		req.Header.Set("Authorization", "Bearer "+t)
	}
}

func versionFromDownloadURL(u string) (tag, ver string) {
	const marker = "/releases/download/"
	if i := strings.Index(u, marker); i >= 0 {
		rest := u[i+len(marker):]
		if j := strings.IndexByte(rest, '/'); j > 0 {
			tag = rest[:j]
			ver = strings.TrimPrefix(tag, "v")
			if k := strings.IndexByte(ver, '-'); k > 0 {
				ver = ver[:k]
			}
			if !strings.HasPrefix(tag, "v") {
				tag = "v" + ver
			}
			return tag, ver
		}
	}
	if i := strings.Index(u, "keengen_"); i >= 0 {
		frag := u[i+len("keengen_"):]
		end := strings.Index(frag, "_mipsel")
		if end > 0 {
			raw := frag[:end]
			if k := strings.IndexByte(raw, '-'); k > 0 {
				raw = raw[:k]
			}
			if raw != "" && raw[0] >= '0' && raw[0] <= '9' {
				return "v" + raw, raw
			}
		}
	}
	return "latest", appVersion
}

func resolveViaAPI() (*latestIPK, error) {
	req, err := http.NewRequest(http.MethodGet, "https://api.github.com/repos/"+githubRepo+"/releases/latest", nil)
	if err != nil {
		return nil, err
	}
	setGitHubHeaders(req, true)
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("github-http-%d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	var rel ghRelease
	if err := json.Unmarshal(raw, &rel); err != nil {
		return nil, err
	}
	tag := strings.TrimSpace(rel.TagName)
	ver := strings.TrimPrefix(tag, "v")
	var stable, versioned *latestIPK
	for _, a := range rel.Assets {
		if a.Name == ipkAssetStable && a.BrowserDownloadURL != "" {
			stable = &latestIPK{tag: tag, version: ver, name: a.Name, url: a.BrowserDownloadURL, source: "api"}
		}
		if strings.HasPrefix(a.Name, "keengen_") && strings.HasSuffix(a.Name, "_mipsel-3.4.ipk") && a.BrowserDownloadURL != "" {
			versioned = &latestIPK{tag: tag, version: ver, name: a.Name, url: a.BrowserDownloadURL, source: "api"}
		}
	}
	if stable != nil {
		return stable, nil
	}
	if versioned != nil {
		return versioned, nil
	}
	return nil, fmt.Errorf("no-ipk-asset")
}

func resolveViaStableURL() (*latestIPK, error) {
	ipkURL := "https://github.com/" + githubRepo + "/releases/latest/download/" + ipkAssetStable
	var firstRedirect string
	client := &http.Client{
		Timeout: 25 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if firstRedirect == "" && req.URL != nil {
				firstRedirect = req.URL.String()
			}
			if len(via) >= 10 {
				return fmt.Errorf("too-many-redirects")
			}
			return nil
		},
	}
	do := func(method string) (*http.Response, error) {
		req, err := http.NewRequest(method, ipkURL, nil)
		if err != nil {
			return nil, err
		}
		setGitHubHeaders(req, false)
		return client.Do(req)
	}
	resp, err := do(http.MethodHead)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusMethodNotAllowed || resp.StatusCode == http.StatusNotFound {
		_ = resp.Body.Close()
		firstRedirect = ""
		resp, err = do(http.MethodGet)
		if err != nil {
			return nil, err
		}
		_, _ = io.CopyN(io.Discard, resp.Body, 64)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("github-http-%d", resp.StatusCode)
	}
	hint := firstRedirect
	if hint == "" && resp.Request != nil && resp.Request.URL != nil {
		hint = resp.Request.URL.String()
	}
	if hint == "" {
		hint = ipkURL
	}
	tag, ver := versionFromDownloadURL(hint)
	name := ipkAssetStable
	if i := strings.LastIndex(hint, "/"); i >= 0 {
		base := hint[i+1:]
		if q := strings.IndexAny(base, "?#"); q > 0 {
			base = base[:q]
		}
		if strings.HasPrefix(base, "keengen_") && strings.HasSuffix(base, ".ipk") {
			name = base
		}
	}
	return &latestIPK{
		tag:     tag,
		version: ver,
		name:    name,
		url:     ipkURL,
		source:  "stable-url",
	}, nil
}

func resolveLatestRelease() (*latestIPK, error) {
	got, apiErr := resolveViaAPI()
	if apiErr == nil {
		return got, nil
	}
	got, directErr := resolveViaStableURL()
	if directErr == nil {
		return got, nil
	}
	return nil, fmt.Errorf("resolve-failed:api=%v;direct=%v", apiErr, directErr)
}

func downloadIPK(url, dest string) (int64, error) {
	client := &http.Client{Timeout: 180 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			time.Sleep(1500 * time.Millisecond)
		}
		req, err := http.NewRequest(http.MethodGet, url, nil)
		if err != nil {
			return 0, err
		}
		setGitHubHeaders(req, false)
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode != 200 {
			_ = resp.Body.Close()
			lastErr = fmt.Errorf("http-%d", resp.StatusCode)
			continue
		}
		f, err := os.Create(dest)
		if err != nil {
			_ = resp.Body.Close()
			return 0, err
		}
		n, err := io.Copy(f, io.LimitReader(resp.Body, 32<<20))
		_ = resp.Body.Close()
		_ = f.Close()
		if err != nil {
			lastErr = err
			_ = os.Remove(dest)
			continue
		}
		if n < minIpkBytes {
			_ = os.Remove(dest)
			lastErr = fmt.Errorf("too-small:%d", n)
			continue
		}
		// Entware IPK is gzip(tar); reject obvious HTML/error pages.
		raw, _ := os.ReadFile(dest)
		if len(raw) < 2 || raw[0] != 0x1f || raw[1] != 0x8b {
			_ = os.Remove(dest)
			lastErr = fmt.Errorf("not-gzip-ipk")
			continue
		}
		return n, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("download-failed")
	}
	return 0, lastErr
}

func verifyInstalled(wantVer string) (string, error) {
	checks := []struct {
		path string
		exec bool
	}{
		{"/opt/sbin/keengen-httpd", true},
		{"/opt/share/keengen/www/index.html", false},
		{"/opt/etc/init.d/S99keengen", true},
		{"/opt/etc/keengen/keengen.conf", false},
	}
	var parts []string
	for _, c := range checks {
		st, err := os.Stat(c.path)
		if err != nil {
			return "", fmt.Errorf("missing:%s", c.path)
		}
		if c.exec && st.Mode()&0111 == 0 {
			return "", fmt.Errorf("not-exec:%s", c.path)
		}
		parts = append(parts, c.path)
	}
	conf, err := os.ReadFile("/opt/etc/keengen/keengen.conf")
	if err != nil {
		return "", fmt.Errorf("conf-read:%v", err)
	}
	if strings.Contains(string(conf), "\r") {
		return "", fmt.Errorf("conf-has-cr")
	}
	out, err := exec.Command("opkg", "list-installed", "keengen").CombinedOutput()
	detail := strings.TrimSpace(string(out))
	if err != nil || !strings.Contains(detail, "keengen") {
		return detail, fmt.Errorf("opkg-list:%s", detail)
	}
	if wantVer != "" && wantVer != "latest" && !strings.Contains(detail, wantVer) {
		// Soft: package may use 0.1.4-1 while wantVer is 0.1.4 — prefix match.
		if !strings.Contains(detail, wantVer+"-") && !strings.Contains(detail, " - "+wantVer) {
			parts = append(parts, "opkg="+detail)
		}
	}
	parts = append(parts, "opkg="+detail)
	return strings.Join(parts, "; "), nil
}

func installIpkLocal() map[string]any {
	steps := []map[string]any{}
	add := func(name string, err error, detail string) {
		steps = append(steps, map[string]any{
			"step":   name,
			"ok":     err == nil,
			"detail": detail,
		})
	}
	latest, err := resolveLatestRelease()
	if err != nil {
		add("resolve-latest", err, err.Error())
		return map[string]any{"ok": false, "error": "resolve-failed", "steps": steps}
	}
	add("resolve-latest", nil, latest.tag+" "+latest.url)

	stamp := time.Now().Format("20060102-150405")
	bdir := "/opt/backup/keengen-pre-" + stamp
	if err := os.MkdirAll(bdir, 0755); err != nil {
		bdir = "/opt/home/keengen/backup/keengen-pre-" + stamp
		_ = os.MkdirAll(bdir, 0755)
	}
	_ = exec.Command("cp", "-a", "/opt/etc/xray/configs", bdir+"/").Run()
	_ = exec.Command("cp", "-a", "/opt/etc/xkeen", bdir+"/").Run()
	add("backup", nil, bdir)

	ipkPath := filepath.Join("/tmp", latest.name)
	n, err := downloadIPK(latest.url, ipkPath)
	if err != nil {
		add("download", err, err.Error())
		return map[string]any{"ok": false, "error": "download-failed", "steps": steps, "backup": bdir}
	}
	add("download", nil, fmt.Sprintf("bytes=%d via Go https (not busybox wget)", n))

	// Install without stopping httpd first — keep this request alive until response is sent.
	// force-reinstall replaces files on disk while the old process keeps running.
	cmd := exec.Command("opkg", "install", "--force-reinstall", "--force-overwrite", ipkPath)
	out, err := cmd.CombinedOutput()
	add("opkg-install", err, string(out))
	if err != nil {
		return map[string]any{"ok": false, "error": "opkg-failed", "steps": steps, "backup": bdir}
	}

	vdetail, verr := verifyInstalled(latest.version)
	add("verify-install", verr, vdetail)
	if verr != nil {
		// Do not restart — leave the old process running if still up.
		return map[string]any{"ok": false, "error": "verify-failed", "steps": steps, "backup": bdir}
	}

	ui := "http://127.0.0.1:1001/"
	if host := strings.TrimSpace(os.Getenv("KEENGEN_UI_HOST")); host != "" {
		ui = "http://" + host + ":1001/"
	}
	return map[string]any{
		"ok":                true,
		"reloading":         true,
		"backup":            bdir,
		"local_backup":      stamp,
		"installed_version": latest.version,
		"latest_tag":        latest.tag,
		"ui":                ui,
		"steps":             steps,
	}
}

func verLess(a, b string) bool {
	aa := verTuple(a)
	bb := verTuple(b)
	for i := 0; i < 3; i++ {
		if aa[i] != bb[i] {
			return aa[i] < bb[i]
		}
	}
	return false
}

func verTuple(v string) [3]int {
	v = strings.TrimSpace(strings.TrimPrefix(v, "v"))
	parts := strings.Split(v, ".")
	var nums [3]int
	for i := 0; i < len(parts) && i < 3; i++ {
		n := 0
		for _, ch := range parts[i] {
			if ch < '0' || ch > '9' {
				break
			}
			n = n*10 + int(ch-'0')
		}
		nums[i] = n
	}
	return nums
}

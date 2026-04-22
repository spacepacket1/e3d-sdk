package e3dclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type Client struct {
	BaseURL       string
	APIKey        string
	APIKeyHeader  string
	Timeout       time.Duration
	httpClient    *http.Client
}

func New() *Client {
	timeout := 30 * time.Second
	if raw := strings.TrimSpace(os.Getenv("E3D_TIMEOUT_MS")); raw != "" {
		if parsed, err := time.ParseDuration(raw + "ms"); err == nil && parsed > 0 {
			timeout = parsed
		}
	}

	return &Client{
		BaseURL:      firstNonEmpty(os.Getenv("E3D_BASE_URL"), "https://e3d.ai/api"),
		APIKey:       strings.TrimSpace(os.Getenv("E3D_API_KEY")),
		APIKeyHeader: firstNonEmpty(os.Getenv("E3D_API_KEY_HEADER"), "x-api-key"),
		Timeout:      timeout,
		httpClient:   &http.Client{Timeout: timeout},
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func (c *Client) buildURL(path string, query map[string]any) (string, error) {
	base := strings.TrimRight(strings.TrimSpace(c.BaseURL), "/")
	if base == "" {
		base = "https://e3d.ai/api"
	}
	cleanPath := path
	if !strings.HasPrefix(cleanPath, "/") {
		cleanPath = "/" + cleanPath
	}
	u, err := url.Parse(base + cleanPath)
	if err != nil {
		return "", err
	}
	if len(query) > 0 {
		values := u.Query()
		for key, value := range query {
			if value == nil {
				continue
			}
			switch v := value.(type) {
			case []string:
				for _, item := range v {
					if strings.TrimSpace(item) != "" {
						values.Add(key, item)
					}
				}
			case []any:
				for _, item := range v {
					if item == nil {
						continue
					}
					values.Add(key, fmt.Sprint(item))
				}
			default:
				values.Set(key, fmt.Sprint(v))
			}
		}
		u.RawQuery = values.Encode()
	}
	return u.String(), nil
}

func (c *Client) request(method, path string, query map[string]any, body any) (any, error) {
	urlStr, err := c.buildURL(path, query)
	if err != nil {
		return nil, err
	}

	var payload io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		payload = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, urlStr, payload)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if c.APIKey != "" {
		req.Header.Set(c.APIKeyHeader, c.APIKey)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d for %s: %s", resp.StatusCode, urlStr, string(raw))
	}
	if len(raw) == 0 {
		return nil, nil
	}

	var decoded any
	if err := json.Unmarshal(raw, &decoded); err == nil {
		return decoded, nil
	}
	return string(raw), nil
}

func (c *Client) Get(path string, query map[string]any) (any, error) {
	return c.request(http.MethodGet, path, query, nil)
}

func (c *Client) Post(path string, query map[string]any, body any) (any, error) {
	return c.request(http.MethodPost, path, query, body)
}

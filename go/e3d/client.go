package e3d

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const defaultBaseURL = "https://e3d.ai/api"

type Client struct {
	BaseURL      string
	APIKey       string
	APIKeyHeader string
	Timeout      time.Duration
	HTTPClient   *http.Client
	Payments     *PaymentsService
}

func New() *Client {
	timeout := 30 * time.Second
	if raw := strings.TrimSpace(os.Getenv("E3D_TIMEOUT_MS")); raw != "" {
		if parsed, err := time.ParseDuration(raw + "ms"); err == nil && parsed > 0 {
			timeout = parsed
		}
	}

	client := &Client{
		BaseURL:      firstNonEmpty(os.Getenv("E3D_BASE_URL"), defaultBaseURL),
		APIKey:       strings.TrimSpace(os.Getenv("E3D_API_KEY")),
		APIKeyHeader: firstNonEmpty(os.Getenv("E3D_API_KEY_HEADER"), "x-api-key"),
		Timeout:      timeout,
		HTTPClient:   &http.Client{Timeout: timeout},
	}
	client.Payments = &PaymentsService{client: client}
	return client
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func (c *Client) httpClient() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	timeout := c.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &http.Client{Timeout: timeout}
}

func (c *Client) resolvedBaseURL() string {
	if trimmed := strings.TrimSpace(c.BaseURL); trimmed != "" {
		return strings.TrimRight(trimmed, "/")
	}
	return defaultBaseURL
}

func (c *Client) resolvedAPIKeyHeader() string {
	if trimmed := strings.TrimSpace(c.APIKeyHeader); trimmed != "" {
		return trimmed
	}
	return "x-api-key"
}

func (c *Client) buildURL(path string) (string, error) {
	cleanPath := path
	if !strings.HasPrefix(cleanPath, "/") {
		cleanPath = "/" + cleanPath
	}
	u, err := url.Parse(c.resolvedBaseURL() + cleanPath)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func (c *Client) postJSON(ctx context.Context, path string, body any, target any) error {
	urlStr, err := c.buildURL(path)
	if err != nil {
		return err
	}

	data, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, urlStr, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	if apiKey := strings.TrimSpace(c.APIKey); apiKey != "" {
		req.Header.Set(c.resolvedAPIKeyHeader(), apiKey)
	}

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeServiceError(resp.StatusCode, raw)
	}

	if target == nil || len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, target); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

type serviceErrorPayload struct {
	Message string `json:"message"`
	Code    string `json:"code"`
	Error   string `json:"error"`
}

func decodeServiceError(status int, raw []byte) error {
	detail := ""
	var payload serviceErrorPayload
	if err := json.Unmarshal(raw, &payload); err == nil {
		switch {
		case strings.TrimSpace(payload.Message) != "":
			detail = strings.TrimSpace(payload.Message)
		case strings.TrimSpace(payload.Code) != "":
			detail = strings.TrimSpace(payload.Code)
		case strings.TrimSpace(payload.Error) != "":
			detail = strings.TrimSpace(payload.Error)
		}
	}
	if detail == "" {
		if trimmed := strings.TrimSpace(string(raw)); trimmed != "" {
			detail = trimmed
		}
	}
	if detail != "" {
		return fmt.Errorf("payments request failed with status %d: %s", status, detail)
	}
	return fmt.Errorf("payments request failed with status %d", status)
}

package e3d

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestNewInitializesPayments(t *testing.T) {
	client := New()
	if client.Payments == nil {
		t.Fatal("expected Payments service to be initialized")
	}
}

func TestQuoteCreditsShapesBodyAndPreservesExtra(t *testing.T) {
	var gotMethod string
	var gotPath string
	var gotHeader string
	var gotAuth string
	var gotBody map[string]interface{}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotHeader = r.Header.Get("X-Custom-Key")
		gotAuth = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"payment": {"id":"sol-usdc","chain":"solana","requiredAmount":"12","feeBps":25},
			"paymentOptions": [{"id":"sol-usdc","chain":"solana","requiredAmount":"12","rank":1}],
			"usage": {"kind":"quote"}
		}`))
	})

	client := New()
	client.BaseURL = "https://payments.example/api"
	client.APIKey = "secret"
	client.APIKeyHeader = "X-Custom-Key"
	client.HTTPClient = newLocalHTTPClient(handler)

	quote, err := client.Payments.QuoteCredits(context.Background(), QuoteCreditsRequest{
		Product:                " maps ",
		Wallet:                 " wallet-1 ",
		RequestedIssuedCredits: 5,
		PromotionCode:          " promo ",
		PaymentMethod:          "sol-usdc",
	})
	if err != nil {
		t.Fatalf("QuoteCredits error: %v", err)
	}

	if gotMethod != http.MethodPost || gotPath != "/api"+quotePath {
		t.Fatalf("unexpected request %s %s", gotMethod, gotPath)
	}
	if gotHeader != "secret" {
		t.Fatalf("expected custom api key header, got %q", gotHeader)
	}
	if gotAuth != "" {
		t.Fatalf("did not expect Authorization header, got %q", gotAuth)
	}
	if !reflect.DeepEqual(gotBody, map[string]interface{}{
		"product":                "maps",
		"wallet":                 "wallet-1",
		"requestedIssuedCredits": float64(5),
		"promotionCode":          "promo",
	}) {
		t.Fatalf("unexpected body: %#v", gotBody)
	}
	if _, ok := gotBody["paymentMethod"]; ok {
		t.Fatal("quote body should not include paymentMethod")
	}
	if quote.Product != "maps" || quote.Wallet != "wallet-1" || quote.RequestedIssuedCredits != 5 {
		t.Fatalf("unexpected normalized quote: %#v", quote)
	}
	if quote.Payment.RequiredAmount != "12" {
		t.Fatalf("expected selected payment requiredAmount, got %#v", quote.Payment.RequiredAmount)
	}
	if quote.Payment.Extra["rank"] != float64(1) {
		t.Fatalf("expected payment extra preservation, got %#v", quote.Payment.Extra)
	}
	if quote.Extra["usage"] == nil {
		t.Fatalf("expected quote extra preservation, got %#v", quote.Extra)
	}
	if len(quote.PaymentOptions) != 1 || quote.PaymentOptions[0].Extra["rank"] != float64(1) {
		t.Fatalf("expected payment options preservation, got %#v", quote.PaymentOptions)
	}
}

func TestQuoteCreditsOptionalFieldOmissionAndFallbackSelection(t *testing.T) {
	var gotBody map[string]interface{}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"product": "",
			"wallet": "",
			"requestedIssuedCredits": 0,
			"requiredWE3D": "44",
			"paymentOptions": [{"chain":"base","token":"WE3D"}]
		}`))
	})

	client := New()
	client.BaseURL = "https://payments.example/api"
	client.HTTPClient = newLocalHTTPClient(handler)

	quote, err := client.Payments.QuoteCredits(context.Background(), QuoteCreditsRequest{
		Product:                "credits",
		Wallet:                 "wallet-2",
		RequestedIssuedCredits: 3,
	})
	if err != nil {
		t.Fatalf("QuoteCredits error: %v", err)
	}
	if _, ok := gotBody["promotionCode"]; ok {
		t.Fatalf("did not expect promotionCode in body: %#v", gotBody)
	}
	if _, ok := gotBody["paymentMethod"]; ok {
		t.Fatalf("did not expect paymentMethod in body: %#v", gotBody)
	}
	if quote.Payment.Chain != "base" || quote.Payment.RequiredAmount != "44" {
		t.Fatalf("expected fallback-selected payment, got %#v", quote.Payment)
	}
	if quote.Product != "credits" || quote.Wallet != "wallet-2" || quote.RequestedIssuedCredits != 3 {
		t.Fatalf("expected request fallback values, got %#v", quote)
	}
}

func TestPurchaseCreditsOrdersCallsAndDoesNotMutateClient(t *testing.T) {
	var mu sync.Mutex
	var events []string
	apiKeyBefore := "sdk-key"

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		events = append(events, r.URL.Path)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api" + quotePath:
			_, _ = w.Write([]byte(`{
				"payment": {"id":"eth-usdc","chain":"ethereum","requiredAmount":"9"},
				"paymentOptions": [{"id":"eth-usdc","chain":"ethereum","requiredAmount":"9"}]
			}`))
		case "/api" + purchasePath:
			var body map[string]interface{}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode purchase body: %v", err)
			}
			if body["paymentMethod"] != "eth-usdc" || body["paymentChain"] != "ethereum" || body["txHash"] != "0xabc" {
				t.Fatalf("unexpected purchase body: %#v", body)
			}
			_, _ = w.Write([]byte(`{"creditKey":"e3d_maps_pay_123","issuedCredits":5,"usage":{"mode":"prod"}}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	})

	client := New()
	client.BaseURL = "https://payments.example/api"
	client.APIKey = apiKeyBefore
	client.HTTPClient = newLocalHTTPClient(handler)

	result, err := client.Payments.PurchaseCredits(context.Background(), PurchaseCreditsInput{
		Product:                "maps",
		Wallet:                 "wallet-3",
		RequestedIssuedCredits: 5,
	}, func(ctx context.Context, quote CreditQuote) (string, error) {
		mu.Lock()
		events = append(events, "transfer")
		mu.Unlock()
		if quote.Payment.ID != "eth-usdc" {
			t.Fatalf("unexpected quote in transfer: %#v", quote)
		}
		return " 0xabc ", nil
	})
	if err != nil {
		t.Fatalf("PurchaseCredits error: %v", err)
	}

	if result.CreditKey != "e3d_maps_pay_123" {
		t.Fatalf("unexpected result: %#v", result)
	}
	if result.Usage == nil {
		t.Fatalf("expected result usage preservation, got %#v", result)
	}
	if client.APIKey != apiKeyBefore {
		t.Fatalf("client API key mutated: %q", client.APIKey)
	}
	mu.Lock()
	defer mu.Unlock()
	if !reflect.DeepEqual(events, []string{"/api" + quotePath, "transfer", "/api" + purchasePath}) {
		t.Fatalf("unexpected call ordering: %#v", events)
	}
}

func TestPurchaseCreditsValidationBeforeSideEffects(t *testing.T) {
	client := New()
	client.BaseURL = "http://example.invalid"
	called := false

	_, err := client.Payments.PurchaseCredits(context.Background(), PurchaseCreditsInput{
		Product:                " ",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 1,
	}, func(ctx context.Context, quote CreditQuote) (string, error) {
		called = true
		return "0xabc", nil
	})
	if err == nil {
		t.Fatal("expected validation error")
	}
	if called {
		t.Fatal("transfer should not run on invalid input")
	}
}

func TestPurchaseCreditsContextCancellationBeforeQuoteTransferAndPurchase(t *testing.T) {
	t.Run("before quote", func(t *testing.T) {
		client := New()
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		called := false
		_, err := client.Payments.PurchaseCredits(ctx, PurchaseCreditsInput{
			Product:                "maps",
			Wallet:                 "wallet",
			RequestedIssuedCredits: 1,
		}, func(ctx context.Context, quote CreditQuote) (string, error) {
			called = true
			return "0xabc", nil
		})
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected context canceled, got %v", err)
		}
		if called {
			t.Fatal("transfer should not be called")
		}
	})

	t.Run("before transfer", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"payment":{"id":"pm","requiredAmount":"1"}}`))
			cancel()
		})

		client := New()
		client.BaseURL = "https://payments.example/api"
		client.HTTPClient = newLocalHTTPClient(handler)
		called := false
		_, err := client.Payments.PurchaseCredits(ctx, PurchaseCreditsInput{
			Product:                "maps",
			Wallet:                 "wallet",
			RequestedIssuedCredits: 1,
		}, func(ctx context.Context, quote CreditQuote) (string, error) {
			called = true
			return "0xabc", nil
		})
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected context canceled, got %v", err)
		}
		if called {
			t.Fatal("transfer should not be called")
		}
	})

	t.Run("before purchase", func(t *testing.T) {
		var purchaseCalls int
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/api" + quotePath:
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"payment":{"id":"pm","requiredAmount":"1"}}`))
			case "/api" + purchasePath:
				purchaseCalls++
				t.Fatal("purchase request should not execute")
			}
		})

		client := New()
		client.BaseURL = "https://payments.example/api"
		client.HTTPClient = newLocalHTTPClient(handler)
		ctx, cancel := context.WithCancel(context.Background())
		_, err := client.Payments.PurchaseCredits(ctx, PurchaseCreditsInput{
			Product:                "maps",
			Wallet:                 "wallet",
			RequestedIssuedCredits: 1,
		}, func(ctx context.Context, quote CreditQuote) (string, error) {
			cancel()
			return "0xabc", nil
		})
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected context canceled, got %v", err)
		}
		if purchaseCalls != 0 {
			t.Fatalf("unexpected purchase calls: %d", purchaseCalls)
		}
	})
}

func TestSelectionAndUnmatchedSelection(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"payment": {"id":"server-default","requiredAmount":"2"},
			"paymentOptions": [
				{"id":"sol-usdc","chain":"solana","token":"USDC","requiredAmount":"3"},
				{"id":"base-we3d","chain":"base","token":"WE3D","requiredAmount":"4"}
			]
		}`))
	})

	client := New()
	client.BaseURL = "https://payments.example/api"
	client.HTTPClient = newLocalHTTPClient(handler)

	quote, err := client.Payments.QuoteCredits(context.Background(), QuoteCreditsRequest{
		Product:                "maps",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 1,
		PaymentMethod:          "WE3D",
	})
	if err != nil {
		t.Fatalf("QuoteCredits error: %v", err)
	}
	if quote.Payment.ID != "base-we3d" {
		t.Fatalf("expected selected option, got %#v", quote.Payment)
	}

	_, err = client.Payments.QuoteCredits(context.Background(), QuoteCreditsRequest{
		Product:                "maps",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 1,
		PaymentMethod:          "missing",
	})
	if err == nil || !strings.Contains(err.Error(), "paymentMethod did not match") {
		t.Fatalf("expected unmatched selection error, got %v", err)
	}
}

func TestTransferErrorsAndInvalidHashesStopPurchase(t *testing.T) {
	var purchaseCalls int
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api" + quotePath:
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"payment":{"id":"pm","requiredAmount":"1"}}`))
		case "/api" + purchasePath:
			purchaseCalls++
			t.Fatal("purchase should not be called")
		}
	})

	client := New()
	client.BaseURL = "https://payments.example/api"
	client.HTTPClient = newLocalHTTPClient(handler)

	transferErr := errors.New("transfer failed")
	_, err := client.Payments.PurchaseCredits(context.Background(), PurchaseCreditsInput{
		Product:                "maps",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 1,
	}, func(ctx context.Context, quote CreditQuote) (string, error) {
		return "", transferErr
	})
	if !errors.Is(err, transferErr) {
		t.Fatalf("expected transfer error, got %v", err)
	}

	_, err = client.Payments.PurchaseCredits(context.Background(), PurchaseCreditsInput{
		Product:                "maps",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 1,
	}, func(ctx context.Context, quote CreditQuote) (string, error) {
		return "   ", nil
	})
	if err == nil || !strings.Contains(err.Error(), "txHash") {
		t.Fatalf("expected txHash validation error, got %v", err)
	}
	if purchaseCalls != 0 {
		t.Fatalf("unexpected purchase calls: %d", purchaseCalls)
	}
}

func TestSuppliedQuoteReuseAndMismatchRejection(t *testing.T) {
	var paths []string
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"creditKey":"e3d_maps_pay_456"}`))
	})

	client := New()
	client.BaseURL = "https://payments.example/api"
	client.HTTPClient = newLocalHTTPClient(handler)

	supplied := &CreditQuote{
		Product:                "maps",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 4,
		Payment: CreditPayment{
			ID:             "",
			Chain:          "base",
			RequiredAmount: "4",
		},
		PaymentOptions: []CreditPayment{{ID: "pm-1", Chain: "base", RequiredAmount: "4"}},
	}

	result, err := client.Payments.PurchaseCredits(context.Background(), PurchaseCreditsInput{
		Product:                "maps",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 4,
		PaymentMethod:          "base",
		Quote:                  supplied,
	}, func(ctx context.Context, quote CreditQuote) (string, error) {
		if quote.Payment.ID != "pm-1" {
			t.Fatalf("expected reselection from supplied quote, got %#v", quote.Payment)
		}
		return "0xdef", nil
	})
	if err != nil {
		t.Fatalf("PurchaseCredits error: %v", err)
	}
	if result.CreditKey != "e3d_maps_pay_456" {
		t.Fatalf("unexpected result: %#v", result)
	}
	if !reflect.DeepEqual(paths, []string{"/api" + purchasePath}) {
		t.Fatalf("expected supplied quote to skip quote request, got %#v", paths)
	}

	_, err = client.Payments.PurchaseCredits(context.Background(), PurchaseCreditsInput{
		Product:                "other",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 4,
		Quote:                  supplied,
	}, func(ctx context.Context, quote CreditQuote) (string, error) {
		return "0xdef", nil
	})
	if err == nil || !strings.Contains(err.Error(), "quote.product") {
		t.Fatalf("expected quote mismatch error, got %v", err)
	}
}

func TestNon2xxErrorsAreSafe(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"message":"quote rejected","code":"bad_quote"}`, http.StatusBadRequest)
	})

	client := New()
	client.BaseURL = "https://payments.example/api"
	client.APIKey = "super-secret"
	client.HTTPClient = newLocalHTTPClient(handler)

	_, err := client.Payments.QuoteCredits(context.Background(), QuoteCreditsRequest{
		Product:                "maps",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 1,
	})
	if err == nil {
		t.Fatal("expected error")
	}
	message := err.Error()
	if !strings.Contains(message, "status 400") || !strings.Contains(message, "quote rejected") {
		t.Fatalf("unexpected error message: %q", message)
	}
	if strings.Contains(message, "super-secret") || strings.Contains(message, "Authorization") {
		t.Fatalf("error leaked credentials: %q", message)
	}
}

func TestInjectedHTTPClientIsUsed(t *testing.T) {
	transport := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.String() != "https://custom.example/payments/credits/quote" {
			t.Fatalf("unexpected URL: %s", req.URL.String())
		}
		body := `{"payment":{"id":"pm","requiredAmount":"1"}}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       ioNopCloser(strings.NewReader(body)),
		}, nil
	})

	client := New()
	client.BaseURL = "https://custom.example"
	client.HTTPClient = &http.Client{Transport: transport, Timeout: time.Second}

	_, err := client.Payments.QuoteCredits(context.Background(), QuoteCreditsRequest{
		Product:                "maps",
		Wallet:                 "wallet",
		RequestedIssuedCredits: 1,
	})
	if err != nil {
		t.Fatalf("QuoteCredits error: %v", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

type nopCloser struct {
	*strings.Reader
}

func (nopCloser) Close() error { return nil }

func ioNopCloser(reader *strings.Reader) nopCloser {
	return nopCloser{Reader: reader}
}

func newLocalHTTPClient(handler http.Handler) *http.Client {
	return &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			recorder := httptest.NewRecorder()
			body := io.Reader(nil)
			if req.Body != nil {
				body = req.Body
			}
			localReq := httptest.NewRequest(req.Method, req.URL.String(), body)
			localReq = localReq.WithContext(req.Context())
			localReq.Header = req.Header.Clone()
			handler.ServeHTTP(recorder, localReq)
			return recorder.Result(), nil
		}),
		Timeout: time.Second,
	}
}

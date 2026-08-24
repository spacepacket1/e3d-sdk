package e3d

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

const (
	quotePath    = "/payments/credits/quote"
	purchasePath = "/payments/credits/purchase"
)

type QuoteCreditsRequest struct {
	Product                string `json:"product"`
	Wallet                 string `json:"wallet"`
	RequestedIssuedCredits int    `json:"requestedIssuedCredits"`
	PromotionCode          string `json:"promotionCode,omitempty"`
	PaymentMethod          string `json:"paymentMethod,omitempty"`
}

type CreditPayment struct {
	ID              string                 `json:"id,omitempty"`
	Chain           string                 `json:"chain,omitempty"`
	Network         string                 `json:"network,omitempty"`
	ChainID         interface{}            `json:"chainId,omitempty"`
	Token           string                 `json:"token,omitempty"`
	TokenAddress    string                 `json:"tokenAddress,omitempty"`
	TreasuryAddress string                 `json:"treasuryAddress,omitempty"`
	RequiredAmount  interface{}            `json:"requiredAmount,omitempty"`
	Extra           map[string]interface{} `json:"-"`
}

type CreditQuote struct {
	Product                string                 `json:"product"`
	Wallet                 string                 `json:"wallet"`
	RequestedIssuedCredits int                    `json:"requestedIssuedCredits"`
	Payment                CreditPayment          `json:"payment"`
	PaymentOptions         []CreditPayment        `json:"paymentOptions,omitempty"`
	Extra                  map[string]interface{} `json:"-"`
}

type TransferFunc func(ctx context.Context, quote CreditQuote) (txHash string, err error)

type PurchaseCreditsInput struct {
	Product                string       `json:"product"`
	Wallet                 string       `json:"wallet"`
	RequestedIssuedCredits int          `json:"requestedIssuedCredits,omitempty"`
	PromotionCode          string       `json:"promotionCode,omitempty"`
	PaymentMethod          string       `json:"paymentMethod,omitempty"`
	Quote                  *CreditQuote `json:"quote,omitempty"`
}

type PurchaseCreditsResult struct {
	CreditKey     string                 `json:"creditKey"`
	IssuedCredits interface{}            `json:"issuedCredits,omitempty"`
	BaseCredits   interface{}            `json:"baseCredits,omitempty"`
	PaymentTxHash string                 `json:"paymentTxHash,omitempty"`
	Usage         interface{}            `json:"usage,omitempty"`
	Extra         map[string]interface{} `json:"-"`
}

type PaymentsService struct {
	client *Client
}

func (p CreditPayment) MarshalJSON() ([]byte, error) {
	payload := make(map[string]interface{}, len(p.Extra)+8)
	for key, value := range p.Extra {
		payload[key] = value
	}
	if p.ID != "" {
		payload["id"] = p.ID
	}
	if p.Chain != "" {
		payload["chain"] = p.Chain
	}
	if p.Network != "" {
		payload["network"] = p.Network
	}
	if p.ChainID != nil {
		payload["chainId"] = p.ChainID
	}
	if p.Token != "" {
		payload["token"] = p.Token
	}
	if p.TokenAddress != "" {
		payload["tokenAddress"] = p.TokenAddress
	}
	if p.TreasuryAddress != "" {
		payload["treasuryAddress"] = p.TreasuryAddress
	}
	if p.RequiredAmount != nil {
		payload["requiredAmount"] = p.RequiredAmount
	}
	return json.Marshal(payload)
}

func (p *CreditPayment) UnmarshalJSON(data []byte) error {
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	p.ID = asString(raw["id"])
	p.Chain = asString(raw["chain"])
	p.Network = asString(raw["network"])
	p.ChainID = raw["chainId"]
	p.Token = asString(raw["token"])
	p.TokenAddress = asString(raw["tokenAddress"])
	p.TreasuryAddress = asString(raw["treasuryAddress"])
	p.RequiredAmount = raw["requiredAmount"]
	p.Extra = copyExtra(raw, "id", "chain", "network", "chainId", "token", "tokenAddress", "treasuryAddress", "requiredAmount")
	return nil
}

func (q *CreditQuote) UnmarshalJSON(data []byte) error {
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	q.Product = asString(raw["product"])
	q.Wallet = asString(raw["wallet"])
	q.RequestedIssuedCredits = asPositiveInt(raw["requestedIssuedCredits"])

	paymentBytes, err := json.Marshal(raw["payment"])
	if err == nil && raw["payment"] != nil {
		var payment CreditPayment
		if err := json.Unmarshal(paymentBytes, &payment); err != nil {
			return err
		}
		q.Payment = payment
	}

	if options, ok := raw["paymentOptions"].([]interface{}); ok {
		q.PaymentOptions = make([]CreditPayment, 0, len(options))
		for _, option := range options {
			optionBytes, err := json.Marshal(option)
			if err != nil {
				return err
			}
			var payment CreditPayment
			if err := json.Unmarshal(optionBytes, &payment); err != nil {
				return err
			}
			q.PaymentOptions = append(q.PaymentOptions, payment)
		}
	}

	q.Extra = copyExtra(raw, "product", "wallet", "requestedIssuedCredits", "payment", "paymentOptions")
	return nil
}

func (r *PurchaseCreditsResult) UnmarshalJSON(data []byte) error {
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	r.CreditKey = asString(raw["creditKey"])
	r.IssuedCredits = raw["issuedCredits"]
	r.BaseCredits = raw["baseCredits"]
	r.PaymentTxHash = asString(raw["paymentTxHash"])
	r.Usage = raw["usage"]
	r.Extra = copyExtra(raw, "creditKey", "issuedCredits", "baseCredits", "paymentTxHash", "usage")
	return nil
}

func (s *PaymentsService) QuoteCredits(ctx context.Context, request QuoteCreditsRequest) (CreditQuote, error) {
	if err := ctx.Err(); err != nil {
		return CreditQuote{}, err
	}
	validated, err := validateQuoteRequest(request)
	if err != nil {
		return CreditQuote{}, err
	}

	var rawQuote CreditQuote
	if err := s.client.postJSON(ctx, quotePath, buildQuoteBody(validated), &rawQuote); err != nil {
		return CreditQuote{}, err
	}
	return normalizeQuoteResponse(rawQuote, validated)
}

func (s *PaymentsService) PurchaseCredits(ctx context.Context, input PurchaseCreditsInput, transfer TransferFunc) (PurchaseCreditsResult, error) {
	validated, err := validatePurchaseInput(input)
	if err != nil {
		return PurchaseCreditsResult{}, err
	}
	if transfer == nil {
		return PurchaseCreditsResult{}, fmt.Errorf("transfer is required")
	}

	var quote CreditQuote
	if validated.Quote != nil {
		quote, err = validateSuppliedQuote(*validated.Quote, validated)
	} else {
		if err := ctx.Err(); err != nil {
			return PurchaseCreditsResult{}, err
		}
		quote, err = s.quoteForPurchase(ctx, validated)
	}
	if err != nil {
		return PurchaseCreditsResult{}, err
	}

	if err := ctx.Err(); err != nil {
		return PurchaseCreditsResult{}, err
	}
	txHash, err := transfer(ctx, quote)
	if err != nil {
		return PurchaseCreditsResult{}, err
	}
	txHash, err = validateRequiredString(txHash, "txHash")
	if err != nil {
		return PurchaseCreditsResult{}, err
	}

	if err := ctx.Err(); err != nil {
		return PurchaseCreditsResult{}, err
	}
	var result PurchaseCreditsResult
	if err := s.client.postJSON(ctx, purchasePath, buildPurchaseBody(validated, quote, txHash), &result); err != nil {
		return PurchaseCreditsResult{}, err
	}
	if _, err := validateRequiredString(result.CreditKey, "creditKey"); err != nil {
		return PurchaseCreditsResult{}, err
	}
	return result, nil
}

func (s *PaymentsService) quoteForPurchase(ctx context.Context, input PurchaseCreditsInput) (CreditQuote, error) {
	if input.RequestedIssuedCredits <= 0 {
		return CreditQuote{}, fmt.Errorf("requestedIssuedCredits is required when quote is not supplied")
	}
	return s.QuoteCredits(ctx, QuoteCreditsRequest{
		Product:                input.Product,
		Wallet:                 input.Wallet,
		RequestedIssuedCredits: input.RequestedIssuedCredits,
		PromotionCode:          input.PromotionCode,
		PaymentMethod:          input.PaymentMethod,
	})
}

func validateQuoteRequest(request QuoteCreditsRequest) (QuoteCreditsRequest, error) {
	product, err := validateRequiredString(request.Product, "product")
	if err != nil {
		return QuoteCreditsRequest{}, err
	}
	wallet, err := validateRequiredString(request.Wallet, "wallet")
	if err != nil {
		return QuoteCreditsRequest{}, err
	}
	if request.RequestedIssuedCredits <= 0 {
		return QuoteCreditsRequest{}, fmt.Errorf("requestedIssuedCredits must be a positive integer")
	}
	promotionCode, err := validateOptionalString(request.PromotionCode, "promotionCode")
	if err != nil {
		return QuoteCreditsRequest{}, err
	}
	paymentMethod, err := validateOptionalString(request.PaymentMethod, "paymentMethod")
	if err != nil {
		return QuoteCreditsRequest{}, err
	}
	return QuoteCreditsRequest{
		Product:                product,
		Wallet:                 wallet,
		RequestedIssuedCredits: request.RequestedIssuedCredits,
		PromotionCode:          promotionCode,
		PaymentMethod:          paymentMethod,
	}, nil
}

func validatePurchaseInput(input PurchaseCreditsInput) (PurchaseCreditsInput, error) {
	product, err := validateRequiredString(input.Product, "product")
	if err != nil {
		return PurchaseCreditsInput{}, err
	}
	wallet, err := validateRequiredString(input.Wallet, "wallet")
	if err != nil {
		return PurchaseCreditsInput{}, err
	}
	if input.RequestedIssuedCredits < 0 {
		return PurchaseCreditsInput{}, fmt.Errorf("requestedIssuedCredits must be a positive integer")
	}
	promotionCode, err := validateOptionalString(input.PromotionCode, "promotionCode")
	if err != nil {
		return PurchaseCreditsInput{}, err
	}
	paymentMethod, err := validateOptionalString(input.PaymentMethod, "paymentMethod")
	if err != nil {
		return PurchaseCreditsInput{}, err
	}
	if input.RequestedIssuedCredits == 0 && input.Quote == nil {
		return PurchaseCreditsInput{
			Product:       product,
			Wallet:        wallet,
			PromotionCode: promotionCode,
			PaymentMethod: paymentMethod,
			Quote:         input.Quote,
		}, nil
	}
	return PurchaseCreditsInput{
		Product:                product,
		Wallet:                 wallet,
		RequestedIssuedCredits: input.RequestedIssuedCredits,
		PromotionCode:          promotionCode,
		PaymentMethod:          paymentMethod,
		Quote:                  input.Quote,
	}, nil
}

func validateRequiredString(value string, field string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", fmt.Errorf("%s must be a non-empty string", field)
	}
	return trimmed, nil
}

func validateOptionalString(value string, field string) (string, error) {
	if value == "" {
		return "", nil
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", fmt.Errorf("%s must be a non-empty string when provided", field)
	}
	return trimmed, nil
}

func buildQuoteBody(request QuoteCreditsRequest) map[string]interface{} {
	body := map[string]interface{}{
		"product":                request.Product,
		"wallet":                 request.Wallet,
		"requestedIssuedCredits": request.RequestedIssuedCredits,
	}
	if request.PromotionCode != "" {
		body["promotionCode"] = request.PromotionCode
	}
	return body
}

func buildPurchaseBody(input PurchaseCreditsInput, quote CreditQuote, txHash string) map[string]interface{} {
	body := map[string]interface{}{
		"product": input.Product,
		"wallet":  input.Wallet,
		"txHash":  txHash,
	}
	if input.PromotionCode != "" {
		body["promotionCode"] = input.PromotionCode
	}
	if paymentID := strings.TrimSpace(quote.Payment.ID); paymentID != "" {
		body["paymentMethod"] = paymentID
	} else if input.PaymentMethod != "" {
		body["paymentMethod"] = input.PaymentMethod
	}
	if paymentChain := strings.TrimSpace(quote.Payment.Chain); paymentChain != "" {
		body["paymentChain"] = paymentChain
	}
	return body
}

func normalizeQuoteResponse(rawQuote CreditQuote, request QuoteCreditsRequest) (CreditQuote, error) {
	quoteMap := rawQuote.toMap()
	payment, err := selectPayment(quoteMap, rawQuote.Payment, rawQuote.PaymentOptions, request.PaymentMethod)
	if err != nil {
		return CreditQuote{}, err
	}

	product := strings.TrimSpace(rawQuote.Product)
	if product == "" {
		product = request.Product
	}
	wallet := strings.TrimSpace(rawQuote.Wallet)
	if wallet == "" {
		wallet = request.Wallet
	}
	credits := rawQuote.RequestedIssuedCredits
	if credits <= 0 {
		credits = request.RequestedIssuedCredits
	}

	normalized := rawQuote
	normalized.Product = product
	normalized.Wallet = wallet
	normalized.RequestedIssuedCredits = credits
	normalized.Payment = payment
	return normalized, nil
}

func validateSuppliedQuote(rawQuote CreditQuote, input PurchaseCreditsInput) (CreditQuote, error) {
	product, err := validateRequiredString(rawQuote.Product, "quote.product")
	if err != nil {
		return CreditQuote{}, err
	}
	wallet, err := validateRequiredString(rawQuote.Wallet, "quote.wallet")
	if err != nil {
		return CreditQuote{}, err
	}
	if rawQuote.RequestedIssuedCredits <= 0 {
		return CreditQuote{}, fmt.Errorf("quote.requestedIssuedCredits must be a positive integer")
	}
	if product != input.Product {
		return CreditQuote{}, fmt.Errorf("quote.product must match purchase product")
	}
	if wallet != input.Wallet {
		return CreditQuote{}, fmt.Errorf("quote.wallet must match purchase wallet")
	}
	if input.RequestedIssuedCredits > 0 && input.RequestedIssuedCredits != rawQuote.RequestedIssuedCredits {
		return CreditQuote{}, fmt.Errorf("requestedIssuedCredits must match the supplied quote")
	}

	quoteMap := rawQuote.toMap()
	payment, err := selectPayment(quoteMap, rawQuote.Payment, rawQuote.PaymentOptions, input.PaymentMethod)
	if err != nil {
		return CreditQuote{}, err
	}

	normalized := rawQuote
	normalized.Product = product
	normalized.Wallet = wallet
	normalized.RequestedIssuedCredits = rawQuote.RequestedIssuedCredits
	normalized.Payment = payment
	return normalized, nil
}

func selectPayment(rawQuote map[string]interface{}, payment CreditPayment, options []CreditPayment, selector string) (CreditPayment, error) {
	if selector != "" {
		for _, option := range options {
			if matchesPaymentSelector(option, selector) {
				return resolveRequiredAmount(option, rawQuote)
			}
		}
		return CreditPayment{}, fmt.Errorf("paymentMethod did not match any available payment option")
	}

	if hasPayment(payment) {
		return resolveRequiredAmount(payment, rawQuote)
	}
	if len(options) > 0 {
		return resolveRequiredAmount(options[0], rawQuote)
	}
	return CreditPayment{}, fmt.Errorf("quote payment is missing")
}

func hasPayment(payment CreditPayment) bool {
	return payment.ID != "" || payment.Chain != "" || payment.Network != "" || payment.ChainID != nil || payment.Token != "" || payment.TokenAddress != "" || payment.TreasuryAddress != "" || payment.RequiredAmount != nil || len(payment.Extra) > 0
}

func matchesPaymentSelector(payment CreditPayment, selector string) bool {
	return strings.TrimSpace(payment.ID) == selector || strings.TrimSpace(payment.Chain) == selector || strings.TrimSpace(payment.Token) == selector
}

func resolveRequiredAmount(payment CreditPayment, rawQuote map[string]interface{}) (CreditPayment, error) {
	if hasNonEmptyValue(payment.RequiredAmount) {
		return payment, nil
	}
	fallback := rawQuote["requiredWE3D"]
	if !hasNonEmptyValue(fallback) {
		fallback = rawQuote["requiredE3D"]
	}
	if !hasNonEmptyValue(fallback) {
		fallback = rawQuote["requiredWe3d"]
	}
	if !hasNonEmptyValue(fallback) {
		fallback = rawQuote["requiredE3d"]
	}
	if !hasNonEmptyValue(fallback) {
		return CreditPayment{}, fmt.Errorf("quote payment requiredAmount is missing")
	}
	payment.RequiredAmount = fallback
	return payment, nil
}

func hasNonEmptyValue(value interface{}) bool {
	if value == nil {
		return false
	}
	if str, ok := value.(string); ok {
		return strings.TrimSpace(str) != ""
	}
	return true
}

func asString(value interface{}) string {
	str, _ := value.(string)
	return str
}

func asPositiveInt(value interface{}) int {
	switch number := value.(type) {
	case float64:
		if number > 0 && number == float64(int(number)) {
			return int(number)
		}
	case int:
		if number > 0 {
			return number
		}
	}
	return 0
}

func copyExtra(raw map[string]interface{}, knownKeys ...string) map[string]interface{} {
	if len(raw) == 0 {
		return nil
	}
	known := make(map[string]struct{}, len(knownKeys))
	for _, key := range knownKeys {
		known[key] = struct{}{}
	}
	extra := make(map[string]interface{})
	for key, value := range raw {
		if _, ok := known[key]; ok {
			continue
		}
		extra[key] = value
	}
	if len(extra) == 0 {
		return nil
	}
	return extra
}

func (q CreditQuote) toMap() map[string]interface{} {
	payload := make(map[string]interface{}, len(q.Extra)+5)
	for key, value := range q.Extra {
		payload[key] = value
	}
	payload["product"] = q.Product
	payload["wallet"] = q.Wallet
	payload["requestedIssuedCredits"] = q.RequestedIssuedCredits
	payload["payment"] = q.Payment
	if q.PaymentOptions != nil {
		payload["paymentOptions"] = q.PaymentOptions
	}
	return payload
}

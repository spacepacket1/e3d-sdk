"""Payments support for purchasing E3D product credits."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Union

QUOTE_PATH = "/payments/credits/quote"
PURCHASE_PATH = "/payments/credits/purchase"

TransferCallback = Callable[["CreditQuote"], str]


@dataclass
class QuoteCreditsInput:
    product: str
    wallet: str
    requested_issued_credits: int
    promotion_code: Optional[str] = None
    payment_method: Optional[str] = None


@dataclass
class CreditPayment:
    id: Optional[str] = None
    chain: Optional[str] = None
    network: Optional[str] = None
    chain_id: Optional[Union[str, int]] = None
    token: Optional[str] = None
    token_address: Optional[str] = None
    treasury_address: Optional[str] = None
    required_amount: Optional[Union[str, int, float]] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CreditQuote:
    product: str
    wallet: str
    requested_issued_credits: int
    payment: CreditPayment
    payment_options: Optional[List[CreditPayment]] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PurchaseCreditsInput:
    product: str
    wallet: str
    requested_issued_credits: Optional[int] = None
    promotion_code: Optional[str] = None
    payment_method: Optional[str] = None
    quote: Optional[CreditQuote] = None


@dataclass
class PurchaseCreditsResult:
    credit_key: str
    issued_credits: Optional[int] = None
    base_credits: Optional[int] = None
    payment_tx_hash: Optional[str] = None
    usage: Optional[Any] = None
    extra: Dict[str, Any] = field(default_factory=dict)


def _trimmed_string(value: Any, field_name: str) -> str:
    if not isinstance(value, str):
        raise ValueError("%s must be a non-empty string" % field_name)
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("%s must be a non-empty string" % field_name)
    return trimmed


def _optional_non_empty_string(value: Any, field_name: str) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("%s must be a string" % field_name)
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("%s must be a non-empty string when provided" % field_name)
    return trimmed


def _normalize_optional_string(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _requested_issued_credits(value: Any, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError("%s must be a positive integer" % field_name)
    return value


def _has_non_empty_value(value: Any) -> bool:
    return value is not None and (not isinstance(value, str) or bool(value.strip()))


def _extract_payment_extra(raw_payment: Dict[str, Any]) -> Dict[str, Any]:
    extra = dict(raw_payment)
    for key in (
        "id",
        "chain",
        "network",
        "chainId",
        "token",
        "tokenAddress",
        "treasuryAddress",
        "requiredAmount",
    ):
        extra.pop(key, None)
    return extra


def _normalize_payment(raw_payment: Any) -> Optional[CreditPayment]:
    if not isinstance(raw_payment, dict):
        return None
    return CreditPayment(
        id=raw_payment.get("id") if isinstance(raw_payment.get("id"), str) else raw_payment.get("id"),
        chain=raw_payment.get("chain") if isinstance(raw_payment.get("chain"), str) else raw_payment.get("chain"),
        network=raw_payment.get("network") if isinstance(raw_payment.get("network"), str) else raw_payment.get("network"),
        chain_id=raw_payment.get("chainId"),
        token=raw_payment.get("token") if isinstance(raw_payment.get("token"), str) else raw_payment.get("token"),
        token_address=raw_payment.get("tokenAddress")
        if isinstance(raw_payment.get("tokenAddress"), str)
        else raw_payment.get("tokenAddress"),
        treasury_address=raw_payment.get("treasuryAddress")
        if isinstance(raw_payment.get("treasuryAddress"), str)
        else raw_payment.get("treasuryAddress"),
        required_amount=raw_payment.get("requiredAmount"),
        extra=_extract_payment_extra(raw_payment),
    )


def _normalize_payment_options(raw_options: Any) -> Optional[List[CreditPayment]]:
    if not isinstance(raw_options, list):
        return None
    payment_options = []
    for entry in raw_options:
        payment = _normalize_payment(entry)
        if payment is not None:
            payment_options.append(payment)
    return payment_options or None


def _quote_required_amount_fallback(raw_quote: Dict[str, Any]) -> Any:
    for key in ("requiredWE3D", "requiredE3D"):
        if key in raw_quote:
            return raw_quote.get(key)
    return None


def _resolve_required_amount(payment: CreditPayment, raw_quote: Dict[str, Any]) -> CreditPayment:
    if _has_non_empty_value(payment.required_amount):
        return payment

    fallback = _quote_required_amount_fallback(raw_quote)
    if not _has_non_empty_value(fallback):
        raise ValueError("quote payment required_amount is missing")

    return CreditPayment(
        id=payment.id,
        chain=payment.chain,
        network=payment.network,
        chain_id=payment.chain_id,
        token=payment.token,
        token_address=payment.token_address,
        treasury_address=payment.treasury_address,
        required_amount=fallback,
        extra=dict(payment.extra),
    )


def _matches_payment_selector(payment: CreditPayment, selector: str) -> bool:
    return selector in (
        _normalize_optional_string(payment.id),
        _normalize_optional_string(payment.chain),
        _normalize_optional_string(payment.token),
    )


def _select_payment(
    raw_quote: Dict[str, Any],
    payment: Optional[CreditPayment],
    payment_options: Optional[List[CreditPayment]],
    selector: Optional[str],
) -> CreditPayment:
    if selector is not None:
        if payment_options is None:
            raise ValueError("payment_method did not match any available payment option")
        for option in payment_options:
            if _matches_payment_selector(option, selector):
                return _resolve_required_amount(option, raw_quote)
        raise ValueError("payment_method did not match any available payment option")

    if payment is not None:
        return _resolve_required_amount(payment, raw_quote)

    if payment_options:
        return _resolve_required_amount(payment_options[0], raw_quote)

    raise ValueError("quote payment is missing")


def _quote_extra(raw_quote: Dict[str, Any]) -> Dict[str, Any]:
    extra = dict(raw_quote)
    for key in ("product", "wallet", "requestedIssuedCredits", "payment", "paymentOptions"):
        extra.pop(key, None)
    return extra


def _purchase_extra(raw_result: Dict[str, Any]) -> Dict[str, Any]:
    extra = dict(raw_result)
    for key in ("creditKey", "issuedCredits", "baseCredits", "paymentTxHash", "usage"):
        extra.pop(key, None)
    return extra


def _normalize_quote_response(raw_quote: Any, request: QuoteCreditsInput) -> CreditQuote:
    if not isinstance(raw_quote, dict):
        raise ValueError("quote response must be an object")

    payment_options = _normalize_payment_options(raw_quote.get("paymentOptions"))
    server_payment = _normalize_payment(raw_quote.get("payment"))
    selected_payment = _select_payment(raw_quote, server_payment, payment_options, request.payment_method)

    product = _normalize_optional_string(raw_quote.get("product")) or request.product
    wallet = _normalize_optional_string(raw_quote.get("wallet")) or request.wallet
    requested_issued_credits = raw_quote.get("requestedIssuedCredits")
    if isinstance(requested_issued_credits, bool) or not isinstance(requested_issued_credits, int) or requested_issued_credits <= 0:
        requested_issued_credits = request.requested_issued_credits

    return CreditQuote(
        product=product,
        wallet=wallet,
        requested_issued_credits=requested_issued_credits,
        payment=selected_payment,
        payment_options=payment_options,
        extra=_quote_extra(raw_quote),
    )


def _normalize_purchase_result(raw_result: Any) -> PurchaseCreditsResult:
    if not isinstance(raw_result, dict):
        raise ValueError("purchase response must be an object")

    return PurchaseCreditsResult(
        credit_key=_trimmed_string(raw_result.get("creditKey"), "credit_key"),
        issued_credits=raw_result.get("issuedCredits"),
        base_credits=raw_result.get("baseCredits"),
        payment_tx_hash=raw_result.get("paymentTxHash"),
        usage=raw_result.get("usage"),
        extra=_purchase_extra(raw_result),
    )


def _validate_quote_input(request: QuoteCreditsInput) -> QuoteCreditsInput:
    return QuoteCreditsInput(
        product=_trimmed_string(request.product, "product"),
        wallet=_trimmed_string(request.wallet, "wallet"),
        requested_issued_credits=_requested_issued_credits(
            request.requested_issued_credits,
            "requested_issued_credits",
        ),
        promotion_code=_optional_non_empty_string(request.promotion_code, "promotion_code"),
        payment_method=_optional_non_empty_string(request.payment_method, "payment_method"),
    )


def _validate_transfer(transfer: Any) -> TransferCallback:
    if not callable(transfer):
        raise ValueError("transfer must be callable")
    return transfer


def _validate_purchase_input(request: PurchaseCreditsInput) -> PurchaseCreditsInput:
    requested_issued_credits = request.requested_issued_credits
    if requested_issued_credits is not None:
        requested_issued_credits = _requested_issued_credits(
            requested_issued_credits,
            "requested_issued_credits",
        )

    return PurchaseCreditsInput(
        product=_trimmed_string(request.product, "product"),
        wallet=_trimmed_string(request.wallet, "wallet"),
        requested_issued_credits=requested_issued_credits,
        promotion_code=_optional_non_empty_string(request.promotion_code, "promotion_code"),
        payment_method=_optional_non_empty_string(request.payment_method, "payment_method"),
        quote=request.quote,
    )


def _quote_body(request: QuoteCreditsInput) -> Dict[str, Any]:
    body = {
        "product": request.product,
        "wallet": request.wallet,
        "requestedIssuedCredits": request.requested_issued_credits,
    }
    if request.promotion_code is not None:
        body["promotionCode"] = request.promotion_code
    return body


def _purchase_body(request: PurchaseCreditsInput, quote: CreditQuote, tx_hash: str) -> Dict[str, Any]:
    body = {
        "product": request.product,
        "wallet": request.wallet,
        "txHash": tx_hash,
    }
    if request.promotion_code is not None:
        body["promotionCode"] = request.promotion_code

    payment_id = _normalize_optional_string(quote.payment.id)
    if payment_id is not None:
        body["paymentMethod"] = payment_id
    elif request.payment_method is not None:
        body["paymentMethod"] = request.payment_method

    payment_chain = _normalize_optional_string(quote.payment.chain)
    if payment_chain is not None:
        body["paymentChain"] = payment_chain

    return body


def _validate_supplied_quote(raw_quote: CreditQuote, request: PurchaseCreditsInput) -> CreditQuote:
    if not isinstance(raw_quote, CreditQuote):
        raise ValueError("quote must be a CreditQuote")

    quote_product = _trimmed_string(raw_quote.product, "quote.product")
    quote_wallet = _trimmed_string(raw_quote.wallet, "quote.wallet")
    quote_credits = _requested_issued_credits(
        raw_quote.requested_issued_credits,
        "quote.requested_issued_credits",
    )

    if quote_product != request.product:
        raise ValueError("quote.product must match purchase product")
    if quote_wallet != request.wallet:
        raise ValueError("quote.wallet must match purchase wallet")
    if request.requested_issued_credits is not None and request.requested_issued_credits != quote_credits:
        raise ValueError("requested_issued_credits must match the supplied quote")

    raw_quote_payload = dict(raw_quote.extra)
    raw_quote_payload["product"] = quote_product
    raw_quote_payload["wallet"] = quote_wallet
    raw_quote_payload["requestedIssuedCredits"] = quote_credits
    raw_quote_payload["payment"] = _payment_to_payload(raw_quote.payment)
    if raw_quote.payment_options is not None:
        raw_quote_payload["paymentOptions"] = [
            _payment_to_payload(payment) for payment in raw_quote.payment_options
        ]

    payment_options = raw_quote.payment_options
    selected_payment = _select_payment(
        raw_quote_payload,
        raw_quote.payment,
        payment_options,
        request.payment_method,
    )

    return CreditQuote(
        product=quote_product,
        wallet=quote_wallet,
        requested_issued_credits=quote_credits,
        payment=selected_payment,
        payment_options=payment_options,
        extra=dict(raw_quote.extra),
    )


def _payment_to_payload(payment: CreditPayment) -> Dict[str, Any]:
    payload = dict(payment.extra)
    if payment.id is not None:
        payload["id"] = payment.id
    if payment.chain is not None:
        payload["chain"] = payment.chain
    if payment.network is not None:
        payload["network"] = payment.network
    if payment.chain_id is not None:
        payload["chainId"] = payment.chain_id
    if payment.token is not None:
        payload["token"] = payment.token
    if payment.token_address is not None:
        payload["tokenAddress"] = payment.token_address
    if payment.treasury_address is not None:
        payload["treasuryAddress"] = payment.treasury_address
    if payment.required_amount is not None:
        payload["requiredAmount"] = payment.required_amount
    return payload


class PaymentsModule:
    def __init__(self, client: Any) -> None:
        self._client = client

    def quote_credits(self, request: QuoteCreditsInput) -> CreditQuote:
        validated = _validate_quote_input(request)
        response = self._client.post(QUOTE_PATH, body=_quote_body(validated))
        return _normalize_quote_response(response, validated)

    def purchase_credits(
        self,
        request: PurchaseCreditsInput,
        transfer: TransferCallback,
    ) -> PurchaseCreditsResult:
        validated = _validate_purchase_input(request)
        transfer_fn = _validate_transfer(transfer)

        if validated.quote is not None:
            quote = _validate_supplied_quote(validated.quote, validated)
        else:
            quote = self._quote_for_purchase(validated)

        tx_hash = _trimmed_string(transfer_fn(quote), "tx_hash")
        response = self._client.post(
            PURCHASE_PATH,
            body=_purchase_body(validated, quote, tx_hash),
        )
        return _normalize_purchase_result(response)

    def _quote_for_purchase(self, request: PurchaseCreditsInput) -> CreditQuote:
        if request.requested_issued_credits is None:
            raise ValueError("requested_issued_credits is required when quote is not supplied")

        return self.quote_credits(
            QuoteCreditsInput(
                product=request.product,
                wallet=request.wallet,
                requested_issued_credits=request.requested_issued_credits,
                promotion_code=request.promotion_code,
                payment_method=request.payment_method,
            )
        )

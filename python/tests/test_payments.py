from __future__ import annotations

import unittest

from e3d import (
    CreditPayment,
    CreditQuote,
    E3DClient,
    PurchaseCreditsInput,
    QuoteCreditsInput,
)


class FakeE3DClient(E3DClient):
    def __init__(self):
        super().__init__(base_url="https://example.test/api", api_key="sdk-key")
        self.responses = []
        self.calls = []

    def queue_response(self, response):
        self.responses.append(response)

    def request(self, method, path, *, query=None, body=None):
        self.calls.append(
            {
                "method": method,
                "path": path,
                "query": query,
                "body": body,
            }
        )
        if not self.responses:
            raise AssertionError("unexpected request")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class PaymentsModuleTests(unittest.TestCase):
    def setUp(self):
        self.client = FakeE3DClient()

    def test_quote_credits_posts_camel_case_body_and_omits_client_only_fields(self):
        self.client.queue_response(
            {
                "payment": {"id": "sol", "chain": "solana", "requiredAmount": "10"},
                "paymentOptions": [{"id": "sol", "chain": "solana", "requiredAmount": "10"}],
                "serverField": "kept",
            }
        )

        quote = self.client.payments.quote_credits(
            QuoteCreditsInput(
                product=" maps ",
                wallet=" wallet-1 ",
                requested_issued_credits=3,
                promotion_code=" SAVE10 ",
                payment_method=" solana ",
            )
        )

        self.assertEqual(1, len(self.client.calls))
        self.assertEqual("POST", self.client.calls[0]["method"])
        self.assertEqual("/payments/credits/quote", self.client.calls[0]["path"])
        self.assertEqual(
            {
                "product": "maps",
                "wallet": "wallet-1",
                "requestedIssuedCredits": 3,
                "promotionCode": "SAVE10",
            },
            self.client.calls[0]["body"],
        )
        self.assertNotIn("paymentMethod", self.client.calls[0]["body"])
        self.assertEqual("maps", quote.product)
        self.assertEqual("wallet-1", quote.wallet)
        self.assertEqual(3, quote.requested_issued_credits)
        self.assertEqual("sol", quote.payment.id)
        self.assertEqual("kept", quote.extra["serverField"])

    def test_quote_credits_omits_optional_fields_and_unknown_quote_request_fields(self):
        self.client.queue_response(
            {
                "payment": {"id": "card", "requiredAmount": "9"},
            }
        )

        quote = self.client.payments.quote_credits(
            QuoteCreditsInput(
                product="maps",
                wallet="wallet-1",
                requested_issued_credits=1,
                promotion_code=None,
            )
        )

        self.assertEqual(
            {
                "product": "maps",
                "wallet": "wallet-1",
                "requestedIssuedCredits": 1,
            },
            self.client.calls[0]["body"],
        )
        self.assertIsNone(quote.payment_options)

    def test_quote_normalizes_missing_fields_and_resolves_required_amount_fallback(self):
        self.client.queue_response(
            {
                "paymentOptions": [
                    {
                        "id": "eth",
                        "chain": "ethereum",
                        "token": "WE3D",
                        "quoteOnly": True,
                    }
                ],
                "requiredWE3D": "42",
                "rootField": "preserved",
            }
        )

        quote = self.client.payments.quote_credits(
            QuoteCreditsInput(
                product="maps",
                wallet="wallet-1",
                requested_issued_credits=7,
                payment_method="WE3D",
            )
        )

        self.assertEqual("maps", quote.product)
        self.assertEqual("wallet-1", quote.wallet)
        self.assertEqual(7, quote.requested_issued_credits)
        self.assertEqual("42", quote.payment.required_amount)
        self.assertEqual(True, quote.payment.extra["quoteOnly"])
        self.assertEqual("preserved", quote.extra["rootField"])

    def test_quote_payment_selection_defaults_and_unmatched_selector(self):
        self.client.queue_response(
            {
                "paymentOptions": [
                    {"id": "first", "requiredAmount": "1"},
                    {"id": "second", "requiredAmount": "2"},
                ]
            }
        )

        quote = self.client.payments.quote_credits(
            QuoteCreditsInput(
                product="maps",
                wallet="wallet-1",
                requested_issued_credits=1,
            )
        )
        self.assertEqual("first", quote.payment.id)

        self.client.queue_response(
            {
                "paymentOptions": [{"id": "first", "requiredAmount": "1"}],
            }
        )
        with self.assertRaisesRegex(ValueError, "payment_method did not match"):
            self.client.payments.quote_credits(
                QuoteCreditsInput(
                    product="maps",
                    wallet="wallet-1",
                    requested_issued_credits=1,
                    payment_method="missing",
                )
            )

    def test_purchase_credits_orders_quote_transfer_purchase_and_preserves_api_key(self):
        self.client.queue_response(
            {
                "paymentOptions": [
                    {"id": "eth", "chain": "ethereum", "requiredAmount": "5"},
                ]
            }
        )
        self.client.queue_response(
            {
                "creditKey": "e3d_maps_pay_123",
                "issuedCredits": 5,
                "paymentTxHash": "0xtx",
                "usage": {"remaining": 5},
                "unexpected": "kept",
            }
        )
        seen = []

        def transfer(quote):
            seen.append(("transfer", quote.product, quote.payment.id, quote.payment.required_amount))
            return " 0xtx "

        result = self.client.payments.purchase_credits(
            PurchaseCreditsInput(
                product="maps",
                wallet="wallet-1",
                requested_issued_credits=5,
                promotion_code=" promo ",
            ),
            transfer,
        )

        self.assertEqual(
            [
                ("POST", "/payments/credits/quote"),
                ("POST", "/payments/credits/purchase"),
            ],
            [(call["method"], call["path"]) for call in self.client.calls],
        )
        self.assertEqual([("transfer", "maps", "eth", "5")], seen)
        self.assertEqual(
            {
                "product": "maps",
                "wallet": "wallet-1",
                "txHash": "0xtx",
                "promotionCode": "promo",
                "paymentMethod": "eth",
                "paymentChain": "ethereum",
            },
            self.client.calls[1]["body"],
        )
        self.assertEqual("e3d_maps_pay_123", result.credit_key)
        self.assertEqual("kept", result.extra["unexpected"])
        self.assertEqual("sdk-key", self.client.api_key)

    def test_purchase_credits_reuses_supplied_quote_and_rejects_mismatch(self):
        quote = CreditQuote(
            product="maps",
            wallet="wallet-1",
            requested_issued_credits=5,
            payment=CreditPayment(id="eth", chain="ethereum", required_amount="7"),
            payment_options=[
                CreditPayment(id="eth", chain="ethereum", required_amount="7"),
                CreditPayment(id="sol", chain="solana", required_amount="8"),
            ],
            extra={"quoteField": "kept"},
        )
        self.client.queue_response({"creditKey": "e3d_maps_pay_123"})
        transferred = []

        def transfer(selected_quote):
            transferred.append(selected_quote.payment.id)
            return "0xtx"

        result = self.client.payments.purchase_credits(
            PurchaseCreditsInput(
                product="maps",
                wallet="wallet-1",
                requested_issued_credits=5,
                payment_method="sol",
                quote=quote,
            ),
            transfer,
        )

        self.assertEqual(["sol"], transferred)
        self.assertEqual(1, len(self.client.calls))
        self.assertEqual("/payments/credits/purchase", self.client.calls[0]["path"])
        self.assertEqual("sol", self.client.calls[0]["body"]["paymentMethod"])
        self.assertEqual("e3d_maps_pay_123", result.credit_key)

        with self.assertRaisesRegex(ValueError, "must match purchase product"):
            self.client.payments.purchase_credits(
                PurchaseCreditsInput(
                    product="other",
                    wallet="wallet-1",
                    requested_issued_credits=5,
                    quote=quote,
                ),
                transfer,
            )

    def test_validation_happens_before_side_effects(self):
        with self.assertRaisesRegex(ValueError, "positive integer"):
            self.client.payments.quote_credits(
                QuoteCreditsInput(
                    product="maps",
                    wallet="wallet-1",
                    requested_issued_credits=True,
                )
            )
        self.assertEqual([], self.client.calls)

        with self.assertRaisesRegex(ValueError, "transfer must be callable"):
            self.client.payments.purchase_credits(
                PurchaseCreditsInput(
                    product="maps",
                    wallet="wallet-1",
                    requested_issued_credits=1,
                ),
                None,
            )
        self.assertEqual([], self.client.calls)

        with self.assertRaisesRegex(ValueError, "payment_method must be a non-empty string"):
            self.client.payments.purchase_credits(
                PurchaseCreditsInput(
                    product="maps",
                    wallet="wallet-1",
                    requested_issued_credits=1,
                    payment_method="   ",
                ),
                lambda quote: "0xtx",
            )
        self.assertEqual([], self.client.calls)

    def test_transfer_exceptions_and_invalid_hashes_do_not_trigger_purchase(self):
        self.client.queue_response(
            {"payment": {"id": "eth", "requiredAmount": "5"}}
        )

        with self.assertRaisesRegex(RuntimeError, "wallet failed"):
            self.client.payments.purchase_credits(
                PurchaseCreditsInput(
                    product="maps",
                    wallet="wallet-1",
                    requested_issued_credits=2,
                ),
                lambda quote: (_ for _ in ()).throw(RuntimeError("wallet failed")),
            )

        self.assertEqual(1, len(self.client.calls))
        self.assertEqual("/payments/credits/quote", self.client.calls[0]["path"])

        self.client.calls = []
        self.client.responses = []
        self.client.queue_response({"payment": {"id": "eth", "requiredAmount": "5"}})

        with self.assertRaisesRegex(ValueError, "tx_hash must be a non-empty string"):
            self.client.payments.purchase_credits(
                PurchaseCreditsInput(
                    product="maps",
                    wallet="wallet-1",
                    requested_issued_credits=2,
                ),
                lambda quote: "   ",
            )

        self.assertEqual(1, len(self.client.calls))
        self.assertEqual("/payments/credits/quote", self.client.calls[0]["path"])


if __name__ == "__main__":
    unittest.main()

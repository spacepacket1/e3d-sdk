"""E3D Python SDK — blockchain intelligence API client.

Full documentation: https://docs.e3d.ai/sdk/python
"""

from .client import E3DClient
from .payments import (
    CreditPayment,
    CreditQuote,
    PaymentsModule,
    PurchaseCreditsInput,
    PurchaseCreditsResult,
    QuoteCreditsInput,
    TransferCallback,
)

__all__ = [
    "CreditPayment",
    "CreditQuote",
    "E3DClient",
    "PaymentsModule",
    "PurchaseCreditsInput",
    "PurchaseCreditsResult",
    "QuoteCreditsInput",
    "TransferCallback",
]
__version__ = "0.1.0"

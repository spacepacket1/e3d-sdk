from decimal import Decimal


def quote_buy_e3d(amount_eth: str, slippage_bps: int = 100) -> dict:
    """Pure-Python quote helper that mirrors the JS example math.

    This does not submit transactions; it just prepares the numbers you would
    pass into the wallet-side swap flow.
    """
    amount_wei = int(Decimal(amount_eth) * Decimal(10 ** 18))
    amount_out_min = amount_wei * (10_000 - slippage_bps) // 10_000
    return {
        "direction": "buy",
        "inputToken": "ETH",
        "outputToken": "E3D",
        "amountInWei": str(amount_wei),
        "amountOutMinWei": str(amount_out_min),
        "slippageBps": slippage_bps,
    }


if __name__ == "__main__":
    print(quote_buy_e3d("0.05"))

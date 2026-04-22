package main

import (
	"fmt"
	"math/big"
)

func main() {
	amountWei := new(big.Int)
	amountWei.SetString("50000000000000000", 10)

	minOut := new(big.Int).Mul(amountWei, big.NewInt(9900))
	minOut.Div(minOut, big.NewInt(10000))

	fmt.Printf("%#v\n", map[string]any{
		"direction":     "buy",
		"inputToken":    "ETH",
		"outputToken":   "E3D",
		"amountInWei":   amountWei.String(),
		"amountOutMinWei": minOut.String(),
		"slippageBps":   100,
	})
}

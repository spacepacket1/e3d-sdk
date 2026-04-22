package main

import (
	"fmt"
	"log"

	"e3dexamples/e3dclient"
)

func main() {
	client := e3dclient.New()
	profile, err := client.Get("/token/0x6488861b401F427D13B6619C77C297366bCf6386", map[string]any{"chain": "ETH"})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%#v\n", profile)
}

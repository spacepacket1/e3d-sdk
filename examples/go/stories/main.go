package main

import (
	"fmt"
	"log"

	"e3dexamples/e3dclient"
)

func main() {
	client := e3dclient.New()
	stories, err := client.Get("/stories", map[string]any{"limit": 5})
	if err != nil {
		log.Fatal(err)
	}
	addresses, err := client.Get("/stories/addresses", nil)
	if err != nil {
		log.Fatal(err)
	}

	storyCount := 0
	if arr, ok := stories.([]any); ok {
		storyCount = len(arr)
	}
	fmt.Printf("Stories: %d\n", storyCount)
	fmt.Printf("Addresses sample: %#v\n", addresses)
}

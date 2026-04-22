package main

import (
	"fmt"
	"log"

	"e3dexamples/e3dclient"
)

func main() {
	client := e3dclient.New()

	openapi, err := client.Get("/openapi", nil)
	if err != nil {
		log.Fatal(err)
	}
	rate, err := client.Get("/rate", nil)
	if err != nil {
		log.Fatal(err)
	}

	title := "unknown"
	if m, ok := openapi.(map[string]any); ok {
		if info, ok := m["info"].(map[string]any); ok {
			if s, ok := info["title"].(string); ok && s != "" {
				title = s
			}
		}
	}

	fmt.Printf("OpenAPI title: %s\n", title)
	fmt.Printf("Current rate: %v\n", rate)
}

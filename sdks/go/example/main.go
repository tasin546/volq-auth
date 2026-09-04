package main

import (
	"fmt"
	"log"

	volqauth "github.com/tasin546/volq-auth/sdks/go"
)

func main() {
	fmt.Println("================================================================================")
	fmt.Println("          VOLQ-AUTH (OPENKEYAUTH) - GO CLIENT DEMONSTRATION")
	fmt.Println("================================================================================")

	client := volqauth.NewClient(
		"9f1c7d2e-4b6a-4d2c-9a1b-3f4e5a6b7c8d",
		"1.0.0",
		"G6h8Yt...MasterPublicKeyBase64...",
		"http://localhost:8080",
	)

	fmt.Printf("[+] Generated Machine HWID: %s\n", client.GetHWID())
	fmt.Println("[+] Performing Handshake (/init)...")

	if err := client.Init(); err != nil {
		log.Fatalf("[-] Handshake error: %v", err)
	}

	fmt.Println("[+] Handshake Successful! Session allocated.")
}

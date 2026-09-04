use volq_auth::Client;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("================================================================================");
    println!("          VOLQ-AUTH (OPENKEYAUTH) - RUST CLIENT DEMONSTRATION");
    println!("================================================================================");

    let mut client = Client::new(
        "9f1c7d2e-4b6a-4d2c-9a1b-3f4e5a6b7c8d",
        "1.0.0",
        "G6h8Yt...MasterPublicKeyBase64...",
        "http://localhost:8080",
    );

    println!("[+] Machine HWID: {}", client.hwid());
    println!("[+] Handshaking with VOLQ-Auth Gateway (/init)...");

    match client.init() {
        Ok(_) => println!("[+] Handshake Successful! Ephemeral session allocated."),
        Err(e) => eprintln!("[-] Handshake Error: {}", e),
    }

    Ok(())
}

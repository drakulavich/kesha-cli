use std::process::Command;

#[test]
fn capabilities_advertises_tts() {
    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let out = Command::new(bin)
        .arg("--capabilities-json")
        .output()
        .expect("run");
    assert!(out.status.success());
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("\"tts\""),
        "capabilities missing tts: {stdout}"
    );
}

#[test]
fn say_subcommand_exists() {
    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let out = Command::new(bin)
        .args(["say", "--help"])
        .output()
        .expect("run");
    assert!(
        out.status.success(),
        "say --help should exit 0, got {:?}\nstderr: {}",
        out.status,
        String::from_utf8_lossy(&out.stderr)
    );
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.contains("--voice"), "help missing --voice: {stdout}");
}

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
fn install_has_tts_flag() {
    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let out = Command::new(bin)
        .args(["install", "--help"])
        .output()
        .expect("run");
    assert!(out.status.success());
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("--tts"),
        "install --help missing --tts: {stdout}"
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

#[test]
fn say_with_explicit_paths_produces_wav() {
    let (model, voice) = match (std::env::var("KOKORO_MODEL"), std::env::var("KOKORO_VOICE")) {
        (Ok(m), Ok(v)) => (m, v),
        _ => {
            eprintln!("skipping: set KOKORO_MODEL + KOKORO_VOICE");
            return;
        }
    };
    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let out = Command::new(bin)
        .args([
            "say",
            "Hello, world",
            "--model",
            &model,
            "--voice-file",
            &voice,
            "--lang",
            "en-us",
        ])
        .output()
        .expect("run");
    assert!(
        out.status.success(),
        "exit {:?}\nstderr: {}",
        out.status,
        String::from_utf8_lossy(&out.stderr)
    );
    assert_eq!(&out.stdout[..4], b"RIFF", "stdout is not a WAV");
    assert!(
        out.stdout.len() > 10_000,
        "stdout too small: {} bytes",
        out.stdout.len()
    );
}

#[test]
fn say_reads_stdin_when_no_positional() {
    let (model, voice) = match (std::env::var("KOKORO_MODEL"), std::env::var("KOKORO_VOICE")) {
        (Ok(m), Ok(v)) => (m, v),
        _ => {
            eprintln!("skipping: set KOKORO_MODEL + KOKORO_VOICE");
            return;
        }
    };
    use std::io::Write;
    use std::process::Stdio;

    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let mut child = Command::new(bin)
        .args([
            "say",
            "--model",
            &model,
            "--voice-file",
            &voice,
            "--lang",
            "en-us",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn");
    child
        .stdin
        .as_mut()
        .unwrap()
        .write_all(b"Hello")
        .expect("write stdin");
    let out = child.wait_with_output().expect("wait");
    assert!(
        out.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert_eq!(&out.stdout[..4], b"RIFF");
}

#[test]
fn empty_text_exits_2() {
    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let out = Command::new(bin)
        .args([
            "say",
            "",
            "--model",
            "/nonexistent",
            "--voice-file",
            "/nonexistent",
        ])
        .output()
        .expect("run");
    assert_eq!(
        out.status.code(),
        Some(2),
        "expected exit 2 for empty text\nstderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
}

#[test]
fn missing_model_flag_exits_2() {
    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let out = Command::new(bin).args(["say", "Hi"]).output().expect("run");
    assert_eq!(
        out.status.code(),
        Some(2),
        "expected exit 2 for missing --model\nstderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
}

#[test]
fn text_too_long_exits_5() {
    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let huge = "a".repeat(10_000);
    let out = Command::new(bin)
        .args([
            "say",
            &huge,
            "--model",
            "/nonexistent",
            "--voice-file",
            "/nonexistent",
        ])
        .output()
        .expect("run");
    assert_eq!(
        out.status.code(),
        Some(5),
        "expected exit 5 for too-long text\nstderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
}

#[test]
fn synthesis_failure_exits_4() {
    // Missing model file at runtime -> SynthesisFailed -> exit 4
    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let voice_tmp = tempfile::NamedTempFile::new().unwrap();
    std::fs::write(voice_tmp.path(), vec![0u8; 510 * 256 * 4]).unwrap();
    let out = Command::new(bin)
        .args([
            "say",
            "Hi",
            "--model",
            "/nonexistent-model",
            "--voice-file",
            voice_tmp.path().to_str().unwrap(),
        ])
        .output()
        .expect("run");
    assert_eq!(
        out.status.code(),
        Some(4),
        "expected exit 4 for synthesis failure\nstderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
}

#[test]
fn say_writes_to_file_with_out_flag() {
    let (model, voice) = match (std::env::var("KOKORO_MODEL"), std::env::var("KOKORO_VOICE")) {
        (Ok(m), Ok(v)) => (m, v),
        _ => {
            eprintln!("skipping: set KOKORO_MODEL + KOKORO_VOICE");
            return;
        }
    };
    let tmp = tempfile::NamedTempFile::new().unwrap();
    let bin = env!("CARGO_BIN_EXE_kesha-engine");
    let out = Command::new(bin)
        .args([
            "say",
            "Hi",
            "--model",
            &model,
            "--voice-file",
            &voice,
            "--out",
            tmp.path().to_str().unwrap(),
        ])
        .output()
        .expect("run");
    assert!(
        out.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    // stdout should be empty when --out is set
    assert!(out.stdout.is_empty(), "stdout should be empty with --out");
    let written = std::fs::read(tmp.path()).unwrap();
    assert_eq!(&written[..4], b"RIFF");
}

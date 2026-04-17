use anyhow::Result;
use clap::{Parser, Subcommand};

mod audio;
mod backend;
mod capabilities;
mod lang_id;
mod models;
mod text_lang;
mod transcribe;
#[cfg(feature = "tts")]
mod tts;

#[derive(Parser)]
#[command(name = "kesha-engine", version)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Print capabilities as JSON
    #[arg(long = "capabilities-json")]
    capabilities_json: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Transcribe an audio file
    Transcribe {
        /// Path to audio file
        audio_path: String,
    },
    /// Detect spoken language from audio
    DetectLang {
        /// Path to audio file
        audio_path: String,
    },
    /// Detect language of text (macOS only)
    DetectTextLang {
        /// Text to analyze
        text: String,
    },
    /// Download models
    Install {
        /// Re-download even if cached
        #[arg(long)]
        no_cache: bool,
    },
    /// Synthesize speech from text (TTS)
    #[cfg(feature = "tts")]
    Say {
        /// Text to synthesize (omit to read from stdin)
        text: Option<String>,
        /// Voice id, e.g. `en-af_heart`
        #[arg(long)]
        voice: Option<String>,
        /// espeak language code for G2P, e.g. `en-us`
        #[arg(long, default_value = "en-us")]
        lang: String,
        /// Output file (default: stdout)
        #[arg(long)]
        out: Option<std::path::PathBuf>,
        /// Output format
        #[arg(long, default_value = "wav")]
        format: String,
        /// Speaking rate (0.5–2.0)
        #[arg(long, default_value_t = 1.0)]
        rate: f32,
        /// List installed voices and exit
        #[arg(long)]
        list_voices: bool,
        /// Explicit model path (testing override)
        #[arg(long, hide = true)]
        model: Option<std::path::PathBuf>,
        /// Explicit voice embedding file (testing override)
        #[arg(long = "voice-file", hide = true)]
        voice_file: Option<std::path::PathBuf>,
    },
}

/// Map a TTS error to the documented exit code for `kesha say`.
/// 1 = voice/model not installed, 2 = bad input, 4 = synthesis failure, 5 = text too long.
#[cfg(feature = "tts")]
fn exit_code_for_tts_err(e: &tts::TtsError) -> i32 {
    match e {
        tts::TtsError::VoiceNotInstalled(..) => 1,
        tts::TtsError::EmptyText => 2,
        tts::TtsError::TextTooLong { .. } => 5,
        tts::TtsError::SynthesisFailed(_) => 4,
    }
}

#[cfg(feature = "tts")]
fn run_say(
    text: Option<String>,
    lang: String,
    out: Option<std::path::PathBuf>,
    rate: f32,
    list_voices: bool,
    model: Option<std::path::PathBuf>,
    voice_file: Option<std::path::PathBuf>,
) -> i32 {
    use std::io::{Read, Write};

    if list_voices {
        println!("No voices installed. Run: kesha install --tts");
        return 0;
    }

    let text_joined = match text {
        Some(s) => s,
        None => {
            let mut buf = String::new();
            if let Err(e) = std::io::stdin().read_to_string(&mut buf) {
                eprintln!("error: failed to read stdin: {e}");
                return 4;
            }
            buf.trim().to_string()
        }
    };

    // M1: require explicit --model / --voice-file. Task 14 resolves from cache.
    let Some(model) = model else {
        eprintln!("error: --model required in M1");
        return 2;
    };
    let Some(voice_file) = voice_file else {
        eprintln!("error: --voice-file required in M1");
        return 2;
    };

    let wav = match tts::say(tts::SayOptions {
        text: &text_joined,
        lang: &lang,
        speed: rate,
        model_path: &model,
        voice_path: &voice_file,
    }) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("error: {e}");
            return exit_code_for_tts_err(&e);
        }
    };

    let write_result = match out {
        Some(p) => std::fs::write(&p, &wav).map_err(|e| e.to_string()),
        None => std::io::stdout().write_all(&wav).map_err(|e| e.to_string()),
    };
    if let Err(msg) = write_result {
        eprintln!("error: write failed: {msg}");
        return 4;
    }
    0
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.capabilities_json {
        let caps = capabilities::get_capabilities();
        println!("{}", serde_json::to_string(&caps)?);
        return Ok(());
    }

    match cli.command {
        Some(Commands::Transcribe { audio_path }) => {
            let text = transcribe::transcribe(&audio_path)?;
            println!("{}", text);
        }
        Some(Commands::DetectLang { audio_path }) => {
            let result = lang_id::detect_audio_language(&audio_path)?;
            println!("{}", serde_json::to_string(&result)?);
        }
        Some(Commands::DetectTextLang { text }) => {
            let result = text_lang::detect_text_language(&text)?;
            println!("{}", serde_json::to_string(&result)?);
        }
        Some(Commands::Install { no_cache }) => {
            models::install(no_cache)?;
            eprintln!("Install complete.");
        }
        #[cfg(feature = "tts")]
        Some(Commands::Say {
            text,
            voice: _voice,
            lang,
            out,
            format: _format,
            rate,
            list_voices,
            model,
            voice_file,
        }) => {
            std::process::exit(run_say(
                text,
                lang,
                out,
                rate,
                list_voices,
                model,
                voice_file,
            ));
        }
        None => {
            eprintln!("Usage: kesha-engine <command>");
            eprintln!("Run --help for usage information");
            std::process::exit(1);
        }
    }

    Ok(())
}

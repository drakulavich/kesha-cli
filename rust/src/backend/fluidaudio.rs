use std::io::{BufWriter, Write};

use anyhow::{Context, Result};
use fluidaudio_rs::FluidAudio;

use super::TranscribeBackend;

pub struct FluidAudioBackend {
    audio: FluidAudio,
}

impl FluidAudioBackend {
    pub fn new() -> Result<Self> {
        let audio = FluidAudio::new().context("failed to initialize FluidAudio bridge")?;
        audio
            .init_asr()
            .context("failed to initialize FluidAudio ASR (first run compiles models for ANE)")?;
        Ok(Self { audio })
    }
}

impl TranscribeBackend for FluidAudioBackend {
    fn transcribe(&mut self, audio_path: &str) -> Result<String> {
        let result = self
            .audio
            .transcribe_file(audio_path)
            .context("FluidAudio transcription failed")?;
        Ok(result.text)
    }

    /// `fluidaudio-rs 0.1.0` ships without `transcribe_samples` (available
    /// on main, not yet published), so this shim writes the slice to a
    /// temp WAV and calls `transcribe_file`. Temp I/O for a 16 kHz mono f32
    /// slice is negligible vs the ~50-200 ms ASR cost. Drop this shim and
    /// delegate to `transcribe_samples` directly once upstream cuts a
    /// release that exposes it.
    fn transcribe_samples(&mut self, samples: &[f32]) -> Result<String> {
        let tmp = tempfile::Builder::new()
            .prefix("kesha-vad-segment-")
            .suffix(".wav")
            .tempfile()
            .context("creating temp WAV for VAD segment")?;
        write_float_wav(tmp.path(), samples, 16_000).context("writing temp WAV for VAD segment")?;
        let path_str = tmp.path().to_str().context("temp WAV path was non-UTF-8")?;
        let result = self
            .audio
            .transcribe_file(path_str)
            .context("FluidAudio sample transcription failed")?;
        Ok(result.text)
    }
}

/// Write a 16 kHz mono IEEE float32 WAV. FluidAudio loads it via Apple's
/// `AVAudioFile`, which accepts format tag 3 (IEEE_FLOAT). We can't use
/// `hound` here because the `coreml` feature must build cleanly without
/// the `tts` feature that pulls it in.
fn write_float_wav(path: &std::path::Path, samples: &[f32], sample_rate: u32) -> Result<()> {
    let file = std::fs::File::create(path)?;
    let mut w = BufWriter::new(file);
    let channels: u16 = 1;
    let bits_per_sample: u16 = 32;
    let byte_rate = sample_rate * channels as u32 * (bits_per_sample as u32 / 8);
    let block_align = channels * (bits_per_sample / 8);
    let data_bytes = (samples.len() * 4) as u32;
    let fmt_chunk_size: u32 = 16;
    let riff_size = 4 + (8 + fmt_chunk_size) + (8 + data_bytes);

    w.write_all(b"RIFF")?;
    w.write_all(&riff_size.to_le_bytes())?;
    w.write_all(b"WAVE")?;

    w.write_all(b"fmt ")?;
    w.write_all(&fmt_chunk_size.to_le_bytes())?;
    w.write_all(&3u16.to_le_bytes())?; // format code 3 = IEEE_FLOAT
    w.write_all(&channels.to_le_bytes())?;
    w.write_all(&sample_rate.to_le_bytes())?;
    w.write_all(&byte_rate.to_le_bytes())?;
    w.write_all(&block_align.to_le_bytes())?;
    w.write_all(&bits_per_sample.to_le_bytes())?;

    w.write_all(b"data")?;
    w.write_all(&data_bytes.to_le_bytes())?;
    for &s in samples {
        w.write_all(&s.to_le_bytes())?;
    }
    w.flush()?;
    Ok(())
}

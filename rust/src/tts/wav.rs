//! WAV muxing: f32 samples → RIFF WAV byte buffer.

use std::io::Cursor;

/// Encode mono float32 samples as a RIFF WAV byte buffer at the given sample rate.
pub fn encode_wav(samples: &[f32], sample_rate: u32) -> anyhow::Result<Vec<u8>> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };
    let mut buf = Cursor::new(Vec::<u8>::new());
    {
        let mut w = hound::WavWriter::new(&mut buf, spec)?;
        for s in samples {
            w.write_sample(*s)?;
        }
        w.finalize()?;
    }
    Ok(buf.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_riff_header() {
        let samples = vec![0.0f32; 24_000];
        let wav = encode_wav(&samples, 24_000).unwrap();
        assert_eq!(&wav[..4], b"RIFF", "not a RIFF: {:?}", &wav[..4]);
        assert_eq!(&wav[8..12], b"WAVE");
    }

    #[test]
    fn round_trips_through_hound() {
        let samples: Vec<f32> = (0..2400).map(|i| (i as f32 * 0.1).sin()).collect();
        let wav = encode_wav(&samples, 24_000).unwrap();
        let reader = hound::WavReader::new(std::io::Cursor::new(&wav)).unwrap();
        assert_eq!(reader.spec().sample_rate, 24_000);
        assert_eq!(reader.spec().channels, 1);
        let decoded: Vec<f32> = reader.into_samples::<f32>().map(|s| s.unwrap()).collect();
        assert_eq!(decoded.len(), 2400);
        assert!((decoded[100] - samples[100]).abs() < 1e-6);
    }

    #[test]
    fn handles_empty_input() {
        let wav = encode_wav(&[], 24_000).unwrap();
        // Still a valid RIFF header, just no data.
        assert_eq!(&wav[..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
    }
}

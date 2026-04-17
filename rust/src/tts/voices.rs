//! Kokoro voice embedding files.
//!
//! Layout (from Task 0.2 spike): 510 rows × 256 cols, float32 little-endian,
//! contiguous. Row index selected by token count: `min(token_count - 1, 509)`.

use std::path::Path;

/// Number of rows in a Kokoro voice embedding file. Verified by spike.
pub const VOICE_ROWS: usize = 510;
/// Dimensions per row (voice embedding width).
pub const VOICE_COLS: usize = 256;
/// Expected voice file size in bytes.
pub const VOICE_FILE_BYTES: usize = VOICE_ROWS * VOICE_COLS * 4;

/// Load a Kokoro voice file into a flat Vec of [`VOICE_ROWS`] * [`VOICE_COLS`] floats.
pub fn load_voice(path: &Path) -> anyhow::Result<Vec<f32>> {
    let bytes = std::fs::read(path)?;
    if bytes.len() != VOICE_FILE_BYTES {
        anyhow::bail!(
            "voice file size {} != expected {} ({} rows × {} cols × 4 bytes)",
            bytes.len(),
            VOICE_FILE_BYTES,
            VOICE_ROWS,
            VOICE_COLS
        );
    }
    Ok(bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect())
}

/// Select the style embedding row for a given active-token count.
/// Indexes by `min(token_count - 1, VOICE_ROWS - 1)` (clamp both ends to valid range).
pub fn select_style(voice: &[f32], token_count: usize) -> &[f32] {
    let row = token_count.saturating_sub(1).min(VOICE_ROWS - 1);
    &voice[row * VOICE_COLS..(row + 1) * VOICE_COLS]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_bytes(bytes: &[u8]) -> tempfile::NamedTempFile {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        tmp.write_all(bytes).unwrap();
        tmp
    }

    #[test]
    fn load_rejects_wrong_size() {
        let tmp = write_bytes(&[0u8; 100]);
        let err = load_voice(tmp.path()).unwrap_err();
        assert!(err.to_string().contains("voice file size"));
    }

    #[test]
    fn load_ok_for_correct_size() {
        let tmp = write_bytes(&vec![0u8; VOICE_FILE_BYTES]);
        let voice = load_voice(tmp.path()).unwrap();
        assert_eq!(voice.len(), VOICE_ROWS * VOICE_COLS);
    }

    #[test]
    fn select_style_clamps_high_indices() {
        let voice = vec![0.0; VOICE_ROWS * VOICE_COLS];
        let s = select_style(&voice, 10_000);
        assert_eq!(s.len(), VOICE_COLS);
    }

    #[test]
    fn select_style_handles_zero() {
        let voice = vec![0.0; VOICE_ROWS * VOICE_COLS];
        let s = select_style(&voice, 0);
        assert_eq!(s.len(), VOICE_COLS);
    }

    #[test]
    fn select_style_picks_correct_row() {
        // Row i contains value = i as f32
        let mut voice = Vec::with_capacity(VOICE_ROWS * VOICE_COLS);
        for row in 0..VOICE_ROWS {
            for _ in 0..VOICE_COLS {
                voice.push(row as f32);
            }
        }
        // token_count = 8 should pick row 7
        let s = select_style(&voice, 8);
        assert_eq!(s[0], 7.0);
        assert_eq!(s[VOICE_COLS - 1], 7.0);
    }
}

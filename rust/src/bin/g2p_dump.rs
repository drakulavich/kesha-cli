// Throwaway: dump reference IPA for the parity-harness corpus. Run once,
// paste output into rust/tests/g2p_parity.rs, delete this file before PR.
use kesha_engine::tts::g2p::text_to_ipa;

const CORPUS: &[(&str, &str)] = &[
    ("en-us", "hello"),
    ("en-us", "world"),
    ("en-us", "cat"),
    ("en-us", "dog"),
    ("en-us", "phone"),
    ("en-us", "music"),
    ("en-us", "code"),
    ("en-us", "review"),
    ("en-us", "deploy"),
    ("en-us", "test"),
    ("en-gb", "colour"),
    ("en-gb", "theatre"),
    ("en-gb", "metre"),
    ("en-gb", "harbour"),
    ("fr", "bonjour"),
    ("fr", "merci"),
    ("fr", "oui"),
    ("fr", "non"),
    ("de", "hallo"),
    ("de", "danke"),
    ("de", "nein"),
    ("de", "eins"),
    ("ru", "привет"),
    ("ru", "спасибо"),
    ("ru", "нет"),
    ("ru", "мир"),
    ("es", "hola"),
    ("es", "gracias"),
    ("es", "adios"),
    ("es", "gato"),
    ("it", "ciao"),
    ("it", "grazie"),
    ("it", "pizza"),
    ("it", "casa"),
    ("pt-br", "obrigado"),
    ("pt-br", "ola"),
    ("pt-br", "adeus"),
    ("ja", "konnichiwa"),
    ("zh", "nihao"),
    ("hi", "namaste"),
];

fn main() {
    let start = std::time::Instant::now();
    for (lang, word) in CORPUS {
        let ipa = text_to_ipa(word, lang).unwrap_or_else(|e| format!("ERROR: {e}"));
        println!("    (\"{lang}\", \"{word}\", \"{ipa}\"),");
    }
    eprintln!(
        "\n{} words in {:.2}s ({:.1} ms/word)",
        CORPUS.len(),
        start.elapsed().as_secs_f32(),
        start.elapsed().as_secs_f32() * 1000.0 / CORPUS.len() as f32
    );
}

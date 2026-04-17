fn main() {
    // The `coreml` feature pulls in fluidaudio-rs, which links against the
    // macOS Swift runtime (libswift_Concurrency.dylib and friends). Without
    // an explicit rpath the dynamic linker fails at startup with
    // `Library not loaded: @rpath/libswift_Concurrency.dylib`. /usr/lib/swift
    // is the standard location on macOS 13+.
    #[cfg(feature = "coreml")]
    {
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
    }
}

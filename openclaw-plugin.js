// OpenClaw plugin entry stub for Kesha Voice Kit.
//
// The actual wiring lives in openclaw.plugin.json's configPatch, which
// installs `kesha --json {{MediaPath}}` under tools.media.audio. This
// file exists only to satisfy OpenClaw's requirement that native
// plugins declare at least one JavaScript extension in
// package.json#openclaw.extensions — Kesha has no hooks, tools, or
// services to register beyond the config patch itself.
export default {
  id: "kesha-voice-kit",
  register() {
    // intentionally empty — see openclaw.plugin.json
  },
};

---
name: twilio-gemini-live-voice-audio-fixes
description: Audio quality fixes for the Twilio + Gemini Live voice bridge. Anti-aliasing, gain normalization, and proper resampling.
---

# Twilio + Gemini Live Voice Bridge — Audio Quality Fixes

## Issues Reported by User
1. Voice sounds far / distant
2. Connection not clear
3. Radio wave artifacts in audio

## Root Causes & Fixes

### 1. Voice sounds far → Gain normalization
- Added **+6dB gain boost** on Gemini→Twilio audio path (outgoing to caller)
- Added **+3dB gain boost** on caller→Gemini audio path (incoming, so Gemini hears better)
- Implementation: multiply PCM samples by `1.995` (+6dB) or `1.413` (+3dB), clamp to [-32768, 32767]

### 2. Radio wave artifacts → Anti-aliasing filter
- Added **12-tap low-pass FIR filter** before 24kHz→8kHz downsampling
- Without this filter, high frequencies alias down into audible range, creating "radio" sound
- Filter applied to Gemini's 24kHz output before decimating to 8kHz μ-law

### 3. Bad audio quality → Proper resampling
- Replaced simple decimation (every 3rd sample) with filtered decimation
- Replaced linear interpolation with **cubic Hermite (Catmull-Rom)** for 8kHz→16kHz upsampling
- Better phase preservation and fewer artifacts

## Audio Pipeline
```
Caller → Twilio → μ-law 8kHz → PCM 16kHz (Catmull-Rom) → Gemini Live (24kHz)
Gemini Live → PCM 24kHz → Anti-alias filter → Decimate 8kHz → μ-law → Twilio → Caller
```

## Status (April 2026)
- Fixes incorporated into standalone voice server at `~/.hermes/services/voice-bridge/voice_server.py`
- Audio pipeline now: +3dB input gain, +8dB output gain, 21-tap anti-alias FIR
- Early disconnect root cause found and fixed (see `twilio-gemini-live-voice` skill v2)
- **Pending live test with user**

## Key Files
- `~/.hermes/services/voice-bridge/voice_server.py` — Standalone voice server (port 8081)
- `gateway/platforms/sms.py` — Proxy routes forwarding to voice server
- Twilio number: +1 (949) 919-7745
- Ngrok: `perjurer-foe-purebred.ngrok-free.dev` → :8080 → proxy → :8081

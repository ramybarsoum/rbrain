---
name: twilio-gemini-live-voice
description: Real-time duplex voice phone calls via Twilio Media Streams bridged to Google Gemini Live API. Node.js implementation from RBrain voice-agent/.
version: 3.0
---

# Twilio Media Streams ↔ Gemini Live API Voice Bridge

Real-time, full-duplex voice phone calls via Twilio Media Streams → Gemini Live API.

## Architecture (v3 — Node.js / RBrain voice-agent)

```
Caller → Twilio → Cloudflare Tunnel → Port 3001 (voice-agent/server.mjs)
                                            ↓
                                    Gemini Live API (WebSocket)
```

### Source

`/Users/cole/RBrain/voice-agent/` — Ramy's implementation (PR #1, commit 1f166af)

### Current live routing (updated Apr 25, 2026)

- Permanent public URL: `https://ws.ryancole.ai`
- Cloudflared named tunnel config: `~/.cloudflared/config.yml` routes `ws.ryancole.ai` → `http://127.0.0.1:3001`
- Voice agent must run on `PORT=3001` for the permanent domain to work.
- Twilio incoming number `PNf191fe1d2aa96ba1963463724d4a7e40` voice webhook should be `https://ws.ryancole.ai/voice`.
- `.env` must have `BASE_URL=https://ws.ryancole.ai`; if `VALIDATE_TWILIO_SIGNATURE=true` and `BASE_URL` points at ngrok/localhost, Twilio `/voice` requests are rejected with 403.
- Owner OTP verification currently uses Discord, not SMS, until Twilio A2P is approved: `DISCORD_BOT_TOKEN`, `DISCORD_OTP_CHANNEL_ID=1495328206608404581`, `OTP_ALLOW_SMS_FALLBACK=false`.
- Do **not** restart or kill Hermes gateway port 8080 while working on voice-agent.

### File Layout

| File | Purpose |
|------|---------|
| `server.mjs` | Express + WebSocket server. Handles Twilio Media Stream, μ-law↔PCM16 conversion, bridges to Gemini Live |
| `call.mjs` | Outbound call script. Usage: `node call.mjs <public-voice-url> [phone-number]` |
| `package.json` | Dependencies: ws, express, dotenv |
| `otp.mjs` | Owner verification code delivery. Sends OTP to Discord channel first; SMS fallback disabled unless explicitly enabled |
| `otp.test.mjs` | Node test coverage for Discord OTP routing and no-SMS behavior |

## Setup

```bash
cd /Users/cole/RBrain/voice-agent
npm install   # ws, express, dotenv

# .env file (auto-created from ~/.hermes/.env credentials)
# TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
# GOOGLE_API_KEY, USER_PHONE_NUMBER, PORT=3001
# BASE_URL=https://ws.ryancole.ai
# DISCORD_BOT_TOKEN, DISCORD_OTP_CHANNEL_ID=1495328206608404581, OTP_ALLOW_SMS_FALLBACK=false
```

## Running

### 1. Start the server

```bash
cd /Users/cole/RBrain/voice-agent
# .env must include PORT=3001 and BASE_URL=https://ws.ryancole.ai for the live named tunnel
node server.mjs
# Listens on PORT (live: 3001)
# Health check: GET /health → {"ok":true,"model":"...","voice":"...","mcp":true}
```

### 2. Verify public tunnel

The current live setup uses a Cloudflared **named tunnel**, not a quick tunnel:

```bash
curl -sS https://ws.ryancole.ai/health
# expect ok=true, voice/model, mcp=true

# Confirm tunnel config routes to the live port:
grep -A3 'hostname: ws.ryancole.ai' ~/.cloudflared/config.yml
# service should be http://127.0.0.1:3001
```

### 3. Verify or update Twilio webhook

```bash
cd /Users/cole/RBrain/voice-agent
node --input-type=module <<'NODE'
import 'dotenv/config';
import twilio from 'twilio';
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const nums = await client.incomingPhoneNumbers.list({limit: 10});
for (const n of nums) console.log(n.sid, n.phoneNumber, n.voiceUrl);
NODE
```

If needed, set the live voice webhook:

```bash
TWILIO_SID=$(grep TWILIO_ACCOUNT_SID /Users/cole/RBrain/voice-agent/.env | cut -d= -f2)
TWILIO_AUTH=$(grep TWILIO_AUTH_TOKEN /Users/cole/RBrain/voice-agent/.env | cut -d= -f2)
TWILIO_PN_SID=PNf191fe1d2aa96ba1963463724d4a7e40
curl -s -X POST \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/IncomingPhoneNumbers/$TWILIO_PN_SID.json" \
  -u "$TWILIO_SID:$TWILIO_AUTH" \
  -d "VoiceUrl=https://ws.ryancole.ai/voice"
```

### 4. Place outbound call (optional)

```bash
cd /Users/cole/RBrain/voice-agent
node call.mjs "https://ws.ryancole.ai/voice" +19499198075
```

Note: outbound calls to Ramy have previously failed on this Twilio account; inbound calls to the Twilio number are the reliable test path.

## Customization

### Voice & Persona (in server.mjs)

```javascript
// Voice name (line ~109)
prebuiltVoiceConfig: { voiceName: 'Charon' },  // male baritone
// Other voices: Orus, Puck, Aoede, Leda, Fenrir

// System prompt (line ~93)
const SYSTEM_PROMPT = `You are Max, a sharp and friendly AI voice assistant...`;
```

### Model (in server.mjs)

```javascript
const GEMINI_MODEL = 'models/gemini-2.5-flash-native-audio-latest';
```

## Audio Pipeline

```
Caller → Twilio → μ-law 8kHz → PCM16 24kHz (3x upsample + linear interpolation) → Gemini Live
Gemini Live → PCM16 24kHz → μ-law 8kHz (3x downsample) → Twilio → Caller
```

The implementation uses:
- **Lookup table** μ-law decode (256-entry `MULAW_DECODE_TABLE`) — zero runtime computation
- **Standard ITU-T G.711** μ-law encode with bias + exponent table
- **3x upsampling** with linear interpolation for 8kHz→24kHz
- **Simple 3x decimation** for 24kHz→8kHz (takes every 3rd sample)
- **100ms audio batching** — caller audio buffered and sent to Gemini every 100ms

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/voice` | POST | Twilio voice webhook — returns TwiML with `<Connect><Stream>` |
| `/ws` (any path) | WebSocket | Twilio Media Stream bidirectional audio |

## Key Design Decisions (vs old Python setup)

1. **Node.js not Python** — `ws` library handles WebSocket natively, no aiohttp complexity
2. **Single server** — Express serves HTTP + WebSocket on same port, no proxy needed
3. **μ-law lookup tables** — precomputed 256-entry decode table, faster than Python's per-sample computation
4. **No gateway dependency** — runs on port 3001, completely independent of Hermes gateway (port 8080)
5. **Stable named tunnel** — Cloudflared routes `ws.ryancole.ai` directly to `127.0.0.1:3001`; do not use the ngrok URL for voice-agent
6. **call.mjs** — standalone outbound call script, no need for shell scripts with .env sourcing

## Pitfalls

- **Cloudflare named tunnel must match `.env`** — live route is `ws.ryancole.ai -> http://127.0.0.1:3001`; stale `PORT=8765` breaks after restart
- **Tunnel takes ~5-10 seconds to become reachable** — wait after cloudflared/voice-agent starts before placing calls
- **Outbound calls to some numbers may fail** — Twilio trial/A2P restrictions; inbound works fine
- **WebSocket path is flexible** — server accepts WS upgrade on ANY path (`noServer` mode), Twilio sends to `/ws` from TwiML
- **Audio out skips if no streamSid** — Gemini audio may arrive before Twilio `start` event; those chunks are safely dropped
- **Latency sources** — startup RBrain context loading and RBrain MCP searches can block speech; watchdog logs like `No Gemini output for 20s, sending nudge` indicate unacceptable model/tool silence. Search calls measured around ~1.9–2.3s after schema fix; reduce silence/VAD waits and avoid repeated broad searches mid-call when optimizing.

## Previous Architecture (deprecated, kept for reference)

The old Python/aiohttp voice server on port 8081 (`~/.hermes/services/voice-bridge/voice_server.py`) is deprecated in favor of this Node.js implementation. It had issues with:
- Gateway proxy complexity (had to route through port 8080)
- Module shadowing (`gateway/platforms/email.py` shadowing stdlib)
- Greeting timing bugs (early disconnect)
- Required gateway restarts for changes

## Current Status (Apr 25, 2026)

- ✅ Node.js voice-agent installed and configured at `/Users/cole/RBrain/voice-agent/`
- ✅ Voice: Orus, Persona: Max/RBrain voice agent
- ✅ Server runs on port 3001 behind permanent Cloudflared named tunnel
- ✅ Public health endpoint verified: `https://ws.ryancole.ai/health`
- ✅ Twilio voice webhook points to `https://ws.ryancole.ai/voice`
- ✅ Signature validation works when `.env` has `BASE_URL=https://ws.ryancole.ai`
- ⚠️ Keep `.env` PORT aligned with Cloudflared config (`3001`). A stale `.env` with `PORT=8765` + `BASE_URL=https://perjurer-foe-purebred.ngrok-free.dev` breaks the live setup after restart.
- ✅ Owner verification code delivery uses Discord channel `1495328206608404581` via `DISCORD_BOT_TOKEN`; SMS fallback is disabled with `OTP_ALLOW_SMS_FALLBACK=false` until Twilio A2P registration is approved.
- ⚠️ Outbound calls to Ramy have previously failed on this Twilio account; inbound to the Twilio number is the reliable live test.

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';

const LOG_FILE = 'debug.log';
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  GOOGLE_API_KEY,
  USER_PHONE_NUMBER,
  PORT = '3000',
} = process.env;

// ─── Audio conversion: Twilio g711 μ-law 8kHz ↔ Gemini PCM16 24kHz ─────────

// Standard μ-law decode table (ITU-T G.711)
const MULAW_DECODE_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let mu = ~i & 0xff;
  const sign = mu & 0x80;
  const exponent = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0f;
  let magnitude = ((mantissa << 3) + 0x84) << exponent;
  magnitude -= 0x84;
  MULAW_DECODE_TABLE[i] = sign ? -magnitude : magnitude;
}

// Standard μ-law encode (ITU-T G.711)
const MULAW_CLIP = 32635;
const MULAW_ENCODE_BIAS = 0x84;
const MULAW_EXP_TABLE = [0,0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
  5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7];

function mulawEncode(sample) {
  let sign = 0;
  if (sample < 0) { sign = 0x80; sample = -sample; }
  if (sample > MULAW_CLIP) sample = MULAW_CLIP;
  sample += MULAW_ENCODE_BIAS;
  const exponent = MULAW_EXP_TABLE[(sample >> 7) & 0xff];
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

// μ-law 8kHz → PCM16 24kHz (3x upsample with linear interpolation)
function mulawToPcm24k(mulawBuf) {
  const inLen = mulawBuf.length;
  if (inLen === 0) return Buffer.alloc(0);
  const outBuf = Buffer.alloc(inLen * 6); // 3 samples per input × 2 bytes
  for (let i = 0; i < inLen; i++) {
    const cur = MULAW_DECODE_TABLE[mulawBuf[i]];
    const next = i + 1 < inLen ? MULAW_DECODE_TABLE[mulawBuf[i + 1]] : cur;
    outBuf.writeInt16LE(cur, i * 6);
    outBuf.writeInt16LE(Math.round(cur + (next - cur) / 3), i * 6 + 2);
    outBuf.writeInt16LE(Math.round(cur + 2 * (next - cur) / 3), i * 6 + 4);
  }
  return outBuf;
}

// PCM16 24kHz → μ-law 8kHz (3x downsample)
function pcm24kToMulaw(pcmBuf) {
  const totalSamples = Math.floor(pcmBuf.length / 2);
  const outLen = Math.floor(totalSamples / 3);
  if (outLen === 0) return Buffer.alloc(0);
  const outBuf = Buffer.alloc(outLen);
  for (let i = 0; i < outLen; i++) {
    const sample = pcmBuf.readInt16LE(i * 6);
    outBuf[i] = mulawEncode(sample);
  }
  return outBuf;
}

// ─── Gemini Live API ────────────────────────────────────────────────────────

const GEMINI_MODEL = 'models/gemini-2.5-flash-native-audio-latest';
const GEMINI_WS_URL =
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GOOGLE_API_KEY}`;

const SYSTEM_PROMPT = `You are Atlas, a friendly voice assistant on a phone call. Start by saying "Hey there! This is Atlas, your voice assistant. How can I help you today?" Keep responses short and conversational.`;

function connectGemini(onAudio, onError) {
  log('[Gemini] Connecting to', GEMINI_MODEL);
  const ws = new WebSocket(GEMINI_WS_URL);
  let setupDone = false;

  ws.on('open', () => {
    log('[Gemini] WebSocket open, sending setup');
    ws.send(JSON.stringify({
      setup: {
        model: GEMINI_MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
      },
    }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete) {
        setupDone = true;
        log('[Gemini] Setup complete!');
        // Trigger greeting
        ws.send(JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: 'Hello! The phone call just connected.' }] }],
            turnComplete: true,
          },
        }));
        log('[Gemini] Sent greeting trigger');
        return;
      }

      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            const pcmBuf = Buffer.from(part.inlineData.data, 'base64');
            log(`[Gemini] Audio chunk: ${pcmBuf.length} bytes PCM`);
            onAudio(pcmBuf);
          }
          if (part.text) {
            log(`[Gemini] Text: ${part.text.slice(0, 100)}`);
          }
        }
      }

      if (msg.serverContent?.turnComplete) {
        log('[Gemini] Turn complete');
      }
    } catch (e) {
      log('[Gemini] Parse error:', e.message);
    }
  });

  ws.on('error', (err) => {
    log('[Gemini] Error:', err.message);
    onError(err);
  });

  ws.on('close', (code, reason) => {
    log(`[Gemini] Closed: ${code} ${reason || ''}`);
  });

  return {
    ws,
    sendAudio(pcm16Base64) {
      if (ws.readyState === WebSocket.OPEN && setupDone) {
        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm;rate=24000',
              data: pcm16Base64,
            }],
          },
        }));
      }
    },
    close() {
      if (ws.readyState <= WebSocket.OPEN) ws.close();
    },
    get ready() { return setupDone && ws.readyState === WebSocket.OPEN; },
  };
}

// ─── Express ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'voice-agent', provider: 'gemini-live', model: GEMINI_MODEL });
});

app.post('/voice', (req, res) => {
  const caller = req.body?.From || 'unknown';
  log(`[Voice] Incoming call from ${caller}`);
  log(`[Voice] Headers host: ${req.headers.host}`);
  log(`[Voice] Headers x-forwarded-proto: ${req.headers['x-forwarded-proto']}`);

  const host = req.headers.host;
  const wsUrl = `wss://${host}/ws`;
  log(`[Voice] Stream URL: ${wsUrl}`);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="callerNumber" value="${caller}" />
    </Stream>
  </Connect>
</Response>`;

  log(`[Voice] TwiML sent`);
  res.type('text/xml').send(twiml);
});

// ─── WebSocket server ───────────────────────────────────────────────────────

const server = createServer(app);

// Accept WebSocket on any path (in case Twilio sends to /ws or /)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  log(`[WS] Upgrade request: ${request.url} from ${request.headers.origin || 'no-origin'}`);
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (twilioWs, req) => {
  log(`[Twilio WS] Connected on path: ${req.url}`);

  let streamSid = null;
  let gemini = null;
  let audioBuf = Buffer.alloc(0);
  let audioTimer = null;
  let mediaCount = 0;
  let audioOutCount = 0;

  function initGemini() {
    gemini = connectGemini(
      // onAudio: Gemini PCM16 24kHz → Twilio μ-law 8kHz
      (pcmBuf) => {
        if (!streamSid || twilioWs.readyState !== WebSocket.OPEN) {
          log(`[Audio Out] Skipped - streamSid: ${!!streamSid}, wsOpen: ${twilioWs.readyState === WebSocket.OPEN}`);
          return;
        }

        const mulawBuf = pcm24kToMulaw(pcmBuf);
        if (mulawBuf.length === 0) return;

        log(`[Audio Out] PCM ${pcmBuf.length}b → μ-law ${mulawBuf.length}b → sending to Twilio`);

        // Send as a single payload — Twilio handles buffering
        const payload = mulawBuf.toString('base64');
        twilioWs.send(JSON.stringify({
          event: 'media',
          streamSid,
          media: { payload },
        }));
        audioOutCount++;
      },
      (err) => {
        log('[Gemini] Fatal:', err.message);
      }
    );

    // Send caller audio to Gemini every 100ms
    audioTimer = setInterval(() => {
      if (audioBuf.length > 0 && gemini?.ready) {
        const pcmBuf = mulawToPcm24k(audioBuf);
        gemini.sendAudio(pcmBuf.toString('base64'));
        audioBuf = Buffer.alloc(0);
      }
    }, 100);
  }

  twilioWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.event) {
        case 'connected':
          log('[Twilio WS] connected event received');
          break;

        case 'start':
          streamSid = msg.start.streamSid;
          log(`[Twilio WS] Stream started: ${streamSid}`);
          log(`[Twilio WS] Call SID: ${msg.start.callSid}`);
          log(`[Twilio WS] Media format: ${JSON.stringify(msg.start.mediaFormat)}`);
          log(`[Twilio WS] Custom params: ${JSON.stringify(msg.start.customParameters)}`);
          initGemini();
          break;

        case 'media':
          mediaCount++;
          audioBuf = Buffer.concat([audioBuf, Buffer.from(msg.media.payload, 'base64')]);
          if (mediaCount % 100 === 0) {
            log(`[Twilio WS] Received ${mediaCount} media packets, audioOut: ${audioOutCount}`);
          }
          break;

        case 'stop':
          log('[Twilio WS] Stream stopped');
          break;

        default:
          log(`[Twilio WS] Unknown event: ${msg.event}`);
          break;
      }
    } catch (e) {
      log('[Twilio WS] Parse error:', e.message);
    }
  });

  twilioWs.on('close', () => {
    log(`[Twilio WS] Closed. Total media in: ${mediaCount}, audio out: ${audioOutCount}`);
    if (audioTimer) clearInterval(audioTimer);
    if (gemini) gemini.close();
  });

  twilioWs.on('error', (err) => {
    log('[Twilio WS] Error:', err.message);
    if (audioTimer) clearInterval(audioTimer);
    if (gemini) gemini.close();
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────

// Clear previous log
fs.writeFileSync(LOG_FILE, '');

server.listen(parseInt(PORT), '0.0.0.0', () => {
  log(`Voice Agent running on port ${PORT}`);
  log(`Model: ${GEMINI_MODEL}`);
  log(`Twilio: ${TWILIO_PHONE_NUMBER}`);
});

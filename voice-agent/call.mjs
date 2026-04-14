import 'dotenv/config';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  USER_PHONE_NUMBER,
} = process.env;

// The public URL where Twilio can reach our /voice endpoint
// Uses the sandbox URL on port 8765
const VOICE_URL = process.argv[2] || process.env.VOICE_URL;

if (!VOICE_URL) {
  console.error('Usage: node call.mjs <voice-url>');
  console.error('  e.g. node call.mjs https://sb-3evsk6ym6yit.vercel.run/voice');
  process.exit(1);
}

const TO = process.argv[3] || USER_PHONE_NUMBER;

console.log(`Calling ${TO} from ${TWILIO_PHONE_NUMBER}...`);
console.log(`Webhook URL: ${VOICE_URL}`);

const params = new URLSearchParams({
  To: TO,
  From: TWILIO_PHONE_NUMBER,
  Url: VOICE_URL,
});

const resp = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
  {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  }
);

const body = await resp.json();

if (resp.ok) {
  console.log(`\n✅ Call initiated!`);
  console.log(`   SID:    ${body.sid}`);
  console.log(`   Status: ${body.status}`);
  console.log(`   To:     ${body.to}`);
  console.log(`   From:   ${body.from}`);
  console.log(`\n📞 Your phone should ring any moment now...`);
} else {
  console.error(`\n❌ Call failed (${resp.status}):`);
  console.error(JSON.stringify(body, null, 2));
}

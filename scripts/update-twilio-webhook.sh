#!/bin/bash
set -e
cd /Users/cole/RBrain
source .env

# Update Twilio webhook to use ngrok domain
echo "Updating Twilio voice webhook to ngrok domain..."

RESPONSE=$(curl -s -X POST \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/PNf191fe1d2aa96ba1963463724d4a7e40.json" \
  --data-urlencode "VoiceUrl=https://perjurer-foe-purebred.ngrok-free.dev/webhooks/twilio/voice" \
  --data-urlencode "VoiceMethod=POST" \
  --data-urlencode "SmsUrl=https://perjurer-foe-purebred.ngrok-free.dev/webhooks/twilio" \
  --data-urlencode "SmsMethod=POST")

PHONE=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('phone_number','ERROR'))")
VOICE=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('voice_url','ERROR'))")
SMS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sms_url','ERROR'))")

echo "Phone: $PHONE"
echo "Voice URL: $VOICE"
echo "SMS URL: $SMS"
echo "Done!"

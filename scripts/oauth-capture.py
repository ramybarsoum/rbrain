#!/usr/bin/env python3
"""Google OAuth2 token generator for RBrain.
Starts a local server, captures the auth code, exchanges for tokens.
"""
import http.server
import urllib.parse
import json
import os
import sys
import threading
import urllib.request

def load_env():
    """Load GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from .env"""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    env = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                env[key.strip()] = val.strip()
    return env

REDIRECT_URI = 'http://localhost:8080/oauth2callback'
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/contacts.readonly',
]

env = load_env()
CLIENT_ID = env.get('GOOGLE_CLIENT_ID', '')
CLIENT_SECRET = env.get('GOOGLE_CLIENT_SECRET', '')

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in .env")
    sys.exit(1)

auth_code_holder = {'code': None}

class OAuthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if 'code' in params:
            auth_code_holder['code'] = params['code'][0]
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(b'<html><body style="font-family:sans-serif;text-align:center;padding-top:100px">'
                             b'<h1 style="color:#4CAF50">&#10004; Authorization Successful!</h1>'
                             b'<p>You can close this tab and go back to your terminal.</p>'
                             b'</body></html>')
            print(f"AUTH_CODE_CAPTURED")
            threading.Thread(target=self.server.shutdown).start()
        elif 'error' in params:
            self.send_response(400)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            error = params.get('error', ['unknown'])[0]
            self.wfile.write(f'<html><body><h1>Error: {error}</h1></body></html>'.encode())
            print(f"AUTH_ERROR: {error}")
            threading.Thread(target=self.server.shutdown).start()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


def exchange_code(code):
    """Exchange auth code for access + refresh tokens."""
    data = urllib.parse.urlencode({
        'code': code,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code',
    }).encode()

    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def save_tokens(tokens):
    """Save tokens to ~/.rbrain/google-tokens.json with 0600 permissions."""
    brain_home = os.path.expanduser('~/.rbrain')
    os.makedirs(brain_home, exist_ok=True)
    token_path = os.path.join(brain_home, 'google-tokens.json')

    token_data = {
        'access_token': tokens['access_token'],
        'refresh_token': tokens['refresh_token'],
        'scope': tokens.get('scope', ''),
        'token_type': tokens.get('token_type', 'Bearer'),
        'expiry': tokens.get('expires_in', 3600),
    }

    with open(token_path, 'w') as f:
        json.dump(token_data, f, indent=2)
    os.chmod(token_path, 0o600)
    return token_path


def main():
    # Generate consent URL
    params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': ' '.join(SCOPES),
        'access_type': 'offline',
        'prompt': 'consent',
    }
    consent_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode(params)

    print("=" * 60)
    print("GOOGLE OAUTH2 FLOW FOR RBRAIN")
    print("=" * 60)
    print()
    print("Opening browser for authorization...")
    print("If browser doesn't open, copy this URL:")
    print()
    print(consent_url)
    print()

    # Open browser
    os.system(f'open "{consent_url}"')

    # Start local server to capture callback
    server = http.server.HTTPServer(('localhost', 8080), OAuthHandler)
    print("Waiting for authorization... (listening on port 8080)")
    server.handle_request()  # Handle exactly one request

    if not auth_code_holder['code']:
        print("ERROR: No auth code received")
        sys.exit(1)

    print("Exchanging auth code for tokens...")
    tokens = exchange_code(auth_code_holder['code'])

    if 'refresh_token' not in tokens:
        print("ERROR: No refresh token in response. You may need to revoke and re-authorize.")
        print(f"Response: {json.dumps(tokens, indent=2)}")
        sys.exit(1)

    token_path = save_tokens(tokens)
    print()
    print("=" * 60)
    print(f"SUCCESS! Tokens saved to: {token_path}")
    print(f"Refresh token: {tokens['refresh_token'][:20]}...")
    print(f"Access scope: {tokens.get('scope', 'N/A')}")
    print("=" * 60)
    print()
    print("Credential gateway is now active.")
    print("Email-to-Brain and Calendar-to-Brain can use these tokens.")


if __name__ == '__main__':
    main()

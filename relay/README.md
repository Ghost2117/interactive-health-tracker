# iMessage Relay — Setup Guide

This relay script runs on your Mac and bridges iMessage with the health tracker app. When you send a message to the health tracker contact, the relay forwards it to the app's AI agent, which reads or writes your health data and replies.

## Architecture

```
Your iPhone
    ↕ iMessage (E2E)
Mac Messages.app → chat.db
    ↑ polls every 3s
relay.js
    ↕ HTTP POST
Next.js  /api/imessage
    ↕ tool use
Claude API (claude-opus-5)
    ↕ reads/writes
CSV data files
```

## Prerequisites

- **macOS** (Ventura 13+ recommended)
- **Node.js 18+** — `node --version`
- **iMessage signed in** on this Mac under your Apple ID
- **Full Disk Access** granted to Terminal (or whichever shell runs the relay)

## 1. Grant Full Disk Access

The relay reads `~/Library/Messages/chat.db`, which is protected.

1. Open **System Settings → Privacy & Security → Full Disk Access**
2. Click **+** and add **Terminal** (or iTerm2, whichever you use)
3. Restart Terminal

## 2. Configure the Next.js app

Add these to your app's `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
IMESSAGE_WEBHOOK_SECRET=pick-a-long-random-string
```

Generate a secret:
```bash
openssl rand -hex 32
```

Then restart the dev server: `npm run dev`

## 3. Set up the relay

```bash
cd relay
```

No npm install needed — the relay uses only Node.js built-ins.

## 4. Create a dedicated iMessage contact (optional but recommended)

On your iPhone, create a contact called **"Health Tracker"** with your own phone number (the same number signed into iMessage on this Mac). Messages you send to yourself from any device will be picked up by the relay.

Alternatively, set `SENDER_PHONE` to a different number if you want a friend or family member's messages to trigger the relay (security note: anyone who messages that number can query your health data).

## 5. Run the relay

```bash
SENDER_PHONE="+15550001234" \
WEBHOOK_URL="http://localhost:3000/api/imessage" \
WEBHOOK_SECRET="your-secret-here" \
node relay.js
```

Or create a `.env` file in this directory and use `env $(cat .env) node relay.js`.

**Example `.env`:**
```
SENDER_PHONE=+15550001234
WEBHOOK_URL=http://localhost:3000/api/imessage
WEBHOOK_SECRET=your-secret-here
```

## 6. Test it

Send yourself an iMessage:
- "How did I sleep this week?"
- "Log 70kg weight today"
- "I ran 5km in 28 minutes"
- "Add lunch: chicken rice bowl, 550 cal, 45g protein"
- "What did I eat yesterday?"

## Example conversations

**Querying data:**
> You: What's my average weight this month?
> Bot: Your average weight in August is 72.4 kg across 12 logged days. Highest: 73.1 kg (Aug 3), lowest: 71.8 kg (Aug 12).

**Logging a workout:**
> You: Just did 4 sets of 8 bench press at 80kg
> Bot: Logged — Bench Press: 4×8 @ 80 kg (today, Aug 15).

**Logging cardio:**
> You: Morning run, 6.2km, 34 mins, HR 158
> Bot: Logged — Running: 34 min, 6.2 km, avg HR 158 bpm (today).

**Logging food:**
> You: Breakfast: oats with banana, about 400 cal
> Bot: Logged — Breakfast: oats with banana, 400 cal (today).

## Running as a background service (optional)

To keep the relay running after you close Terminal, use `launchd`:

1. Edit `com.healthtracker.relay.plist` (see below) and save to `~/Library/LaunchAgents/`
2. Run: `launchctl load ~/Library/LaunchAgents/com.healthtracker.relay.plist`

**`com.healthtracker.relay.plist`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.healthtracker.relay</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/interactive-health-tracker/relay/relay.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SENDER_PHONE</key>
    <string>+15550001234</string>
    <key>WEBHOOK_URL</key>
    <string>http://localhost:3000/api/imessage</string>
    <key>WEBHOOK_SECRET</key>
    <string>your-secret-here</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/healthtracker-relay.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/healthtracker-relay.log</string>
</dict>
</plist>
```

## Troubleshooting

**"database is locked"** — Messages.app is writing. The relay skips the tick and retries in 3 s automatically.

**No messages detected** — Verify Full Disk Access is granted to the terminal you're using, and that `SENDER_PHONE` matches exactly (including country code, e.g. `+1555...`).

**401 Unauthorized from webhook** — `WEBHOOK_SECRET` in the relay doesn't match `IMESSAGE_WEBHOOK_SECRET` in `.env.local`.

**AppleScript error "Messages got an error"** — iMessage may not be signed in, or the buddy/service may not match. Ensure you're signed into iMessage on this Mac with the Apple ID associated with the recipient number.

**Relay works locally but not when deployed** — The relay must be able to reach the webhook URL. If the app is deployed remotely, use the public URL (e.g. `https://yourapp.vercel.app/api/imessage`). The Mac running the relay needs internet access.

## Security notes

- The webhook secret prevents anyone who knows your webhook URL from submitting arbitrary data. Keep it secret.
- Only messages from `SENDER_PHONE` are processed — all other senders are ignored.
- Health data is stored locally in CSV files; nothing is sent to Claude except the natural-language message and the data needed to answer it.

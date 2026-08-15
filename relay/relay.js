#!/usr/bin/env node
/**
 * Health Tracker — iMessage Relay (runs on your Mac)
 *
 * Polls ~/Library/Messages/chat.db for new messages from your phone number,
 * forwards them to the Next.js webhook, and sends replies back via iMessage.
 *
 * Requirements:
 *   - macOS (tested on Ventura / Sonoma / Sequoia)
 *   - Terminal (or the shell running this script) must have Full Disk Access
 *     System Settings → Privacy & Security → Full Disk Access
 *   - iMessage must be signed in on this Mac
 *   - ANTHROPIC_API_KEY set in the Next.js app's .env.local
 *   - IMESSAGE_WEBHOOK_SECRET must match between this relay and .env.local
 *
 * Usage:
 *   SENDER_PHONE="+15550001234" \
 *   WEBHOOK_URL="http://localhost:3000/api/imessage" \
 *   WEBHOOK_SECRET="your-secret" \
 *   node relay.js
 */

"use strict";

const https = require("https");
const http  = require("http");
const { execSync, exec } = require("child_process");
const os   = require("os");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const SENDER_PHONE   = process.env.SENDER_PHONE   || "+15550001234";
const WEBHOOK_URL    = process.env.WEBHOOK_URL    || "http://localhost:3000/api/imessage";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "change-me";
const POLL_MS        = Number(process.env.POLL_MS) || 3000;

const DB = path.join(os.homedir(), "Library", "Messages", "chat.db");

// ── State ─────────────────────────────────────────────────────────────────────
// Track the highest mac-absolute-time (nanoseconds) we've already handled.
// We set this to "now" at startup so we never replay old messages.
const MAC_EPOCH_OFFSET = 978307200; // seconds between Unix epoch and Mac Absolute Time epoch

function unixToMacNs(unixSec) {
  return BigInt(Math.floor((unixSec - MAC_EPOCH_OFFSET) * 1e9));
}

let lastMacNs = unixToMacNs(Date.now() / 1000);

// ── SQLite query ──────────────────────────────────────────────────────────────
function queryNewMessages() {
  // chat.db date column: nanoseconds since 2001-01-01 (Mac Absolute Time)
  const sql = [
    "SELECT m.text,",
    "       m.date AS mac_ns,",
    "       h.id   AS sender",
    "FROM   message m",
    "JOIN   handle  h ON m.handle_id = h.ROWID",
    `WHERE  m.is_from_me = 0`,
    `  AND  m.text IS NOT NULL`,
    `  AND  m.text != ''`,
    `  AND  m.date > ${lastMacNs}`,
    `  AND  h.id = '${SENDER_PHONE}'`,
    "ORDER BY m.date ASC",
  ].join(" ");

  try {
    const out = execSync(`sqlite3 -json "${DB}" "${sql}"`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (!out) return [];
    return JSON.parse(out).map((row) => ({
      text:   row.text,
      mac_ns: BigInt(row.mac_ns),
      sender: row.sender,
    }));
  } catch (err) {
    // SQLITE_BUSY is common when Messages.app is writing; just skip this tick
    if (!String(err.message).includes("database is locked")) {
      console.error("[relay] sqlite error:", err.message);
    }
    return [];
  }
}

// ── Webhook call ──────────────────────────────────────────────────────────────
function postWebhook(message, sender) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ sender, message });
    const u    = new URL(WEBHOOK_URL);
    const lib  = u.protocol === "https:" ? https : http;

    const req = lib.request(
      {
        hostname: u.hostname,
        port:     u.port || (u.protocol === "https:" ? 443 : 80),
        path:     u.pathname + u.search,
        method:   "POST",
        headers:  {
          "Content-Type":      "application/json",
          "Content-Length":    Buffer.byteLength(body),
          "x-webhook-secret":  WEBHOOK_SECRET,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ reply: "" });
          }
        });
      }
    );

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("Webhook timed out after 60 s"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── iMessage reply via AppleScript ────────────────────────────────────────────
function sendReply(text, recipient) {
  // Escape for AppleScript string literal
  const safe = text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");

  const script = `tell application "Messages" to send "${safe}" to buddy "${recipient}" of service "iMessage"`;
  exec(`osascript -e '${script.replace(/'/g, "'\\''")}' `, (err) => {
    if (err) console.error("[relay] osascript error:", err.message);
  });
}

// ── Poll loop ─────────────────────────────────────────────────────────────────
let busy = false;

async function poll() {
  if (busy) return;
  busy = true;
  try {
    const msgs = queryNewMessages();
    for (const msg of msgs) {
      lastMacNs = msg.mac_ns + 1n;
      console.log(`[${new Date().toISOString()}] ← ${msg.sender}: ${msg.text}`);

      let reply;
      try {
        const res = await postWebhook(msg.text, msg.sender);
        reply = res.reply || "Sorry, I couldn't process that.";
      } catch (err) {
        console.error("[relay] webhook error:", err.message);
        reply = "Sorry, the health tracker is unreachable right now.";
      }

      sendReply(reply, msg.sender);
      console.log(`[${new Date().toISOString()}] → ${msg.sender}: ${reply.slice(0, 100)}${reply.length > 100 ? "…" : ""}`);
    }
  } finally {
    busy = false;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
console.log("Health Tracker — iMessage Relay");
console.log(`  Watching : ${SENDER_PHONE}`);
console.log(`  Webhook  : ${WEBHOOK_URL}`);
console.log(`  Poll     : every ${POLL_MS} ms`);
console.log(`  DB       : ${DB}`);
console.log("");
console.log("Ready. Press Ctrl+C to stop.\n");

setInterval(poll, POLL_MS);

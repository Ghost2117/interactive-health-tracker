import { NextRequest, NextResponse } from "next/server";
import { runChatAgent } from "@/lib/chat-agent";

export async function POST(req: NextRequest) {
  // Validate shared secret to prevent unauthorized access
  const secret = req.headers.get("x-webhook-secret");
  if (!process.env.IMESSAGE_WEBHOOK_SECRET || secret !== process.env.IMESSAGE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sender?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message } = body;
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const reply = await runChatAgent(message.trim());
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[imessage] agent error:", err);
    return NextResponse.json(
      { error: "Agent failed", reply: "Sorry, something went wrong. Try again." },
      { status: 500 }
    );
  }
}

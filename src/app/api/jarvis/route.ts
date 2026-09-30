import { NextResponse } from "next/server";
import { submitCommand, listCommands } from "@/lib/jarvis/orchestrator";
import { listActivity } from "@/lib/jarvis/activity";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    demoMode: true,
    commands: listCommands(),
    activity: listActivity().slice(0, 30),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { input?: string };
    if (!body.input || typeof body.input !== "string") {
      return NextResponse.json({ error: "input required" }, { status: 400 });
    }
    // Privileged orchestration stays server-side — no API keys in client
    const command = await submitCommand(body.input);
    return NextResponse.json({
      command,
      activity: listActivity().slice(0, 30),
      note: "Simulated pipeline only. No external execution.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

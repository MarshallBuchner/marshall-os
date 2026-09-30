import { NextResponse } from "next/server";
import { listApprovals, resolveApproval } from "@/lib/jarvis/orchestrator";
import { listActivity } from "@/lib/jarvis/activity";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    demoMode: true,
    approvals: listApprovals(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      approvalId?: string;
      decision?: "approved" | "rejected";
    };
    if (!body.approvalId || !body.decision) {
      return NextResponse.json(
        { error: "approvalId and decision required" },
        { status: 400 },
      );
    }
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return NextResponse.json({ error: "invalid decision" }, { status: 400 });
    }

    const result = await resolveApproval(body.approvalId, body.decision);
    return NextResponse.json({
      ...result,
      activity: listActivity().slice(0, 30),
      note: "Approval state machine is simulated. Approved actions do not call live APIs.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

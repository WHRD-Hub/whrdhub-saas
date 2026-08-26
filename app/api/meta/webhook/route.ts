import { NextRequest, NextResponse } from "next/server";
import { META_VERIFY_TOKEN, verifyWebhookSignature, itemsFromWebhook } from "@/lib/meta";
import { ingestItems } from "@/lib/listening";

// Meta webhook for the connected Page. Configure this URL in the Meta App
// dashboard: App -> Webhooks -> Page (subscribe to "feed"). Use META_VERIFY_TOKEN
// as the Verify Token. Set the callback URL to https://<domain>/api/meta/webhook

export const runtime = "nodejs";

// Verification handshake (Meta sends a GET when you save the webhook).
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === META_VERIFY_TOKEN && META_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Event delivery: verify signature, match keywords, store hits.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, sig)) {
    return new NextResponse("Bad signature", { status: 401 });
  }
  try {
    const payload = JSON.parse(raw);
    await ingestItems(itemsFromWebhook(payload));
  } catch (err) {
    console.error("Meta webhook error:", err);
  }
  // Always ack quickly so Meta does not retry.
  return new NextResponse("", { status: 200 });
}

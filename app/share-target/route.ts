import { NextRequest, NextResponse } from "next/server";

/**
 * The share target, for when the service worker is not in charge yet.
 *
 * Normally the service worker handles a share itself, keeping any photos on the
 * device and opening the report form. This is the fallback for the first share
 * after installing, before the worker is active: it carries the link and the
 * words across in the address, and photos from that one share cannot be.
 */
export async function POST(request: NextRequest) {
  const to = new URL("/report", request.url);
  try {
    const form = await request.formData();
    const text = String(form.get("text") ?? "").slice(0, 2000);
    const title = String(form.get("title") ?? "").slice(0, 300);
    const url = String(form.get("url") ?? "").slice(0, 500);
    const words = [title, text].filter(Boolean).join("\n\n");
    if (words) to.searchParams.set("text", words);
    if (url) to.searchParams.set("link", url);
  } catch {
    /* an unreadable share still opens the form */
  }
  return NextResponse.redirect(to, 303);
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/report", request.url), 303);
}

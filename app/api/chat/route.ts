import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LANGUAGE_META, SUPPORTED, type Language } from "@/lib/i18n/translations";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Gemini 2.5 Flash Lite is the cheapest capable model on OpenRouter
// ($0.10/$0.40 per M tokens, below gpt-4o-mini) and strongly multilingual
// (helpful for Swahili / Kenyan-context replies). Override via OPENROUTER_MODEL.
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;

function systemPrompt(language: Language): string {
  const langName = LANGUAGE_META[language]?.label ?? "English";
  return [
    "You are the WHRD Hub Resource Assistant — a knowledgeable, warm, and relatable human-rights resource person.",
    "WHRD Hub is a platform for Women Human Rights Defenders (WHRDs) and community members in Kenya to report technology-facilitated gender-based violence (TFGBV) and other gender-based abuse, and to connect with support services.",
    "",
    "YOUR ROLE:",
    "- Provide clear, practical, empowering information about human rights, gender-based violence and TFGBV, digital safety and security, and the kinds of legal, medical, psychosocial, shelter, and referral support available — with an emphasis on the Kenyan context.",
    "- Speak like a trusted, approachable peer educator: plain language, non-judgemental, validating, never clinical or condescending.",
    "- Help people understand their options and rights so they feel more informed and less alone.",
    "",
    "STRICT SCOPE:",
    "- Only engage with topics related to human rights, GBV/TFGBV, safety, wellbeing, and support resources.",
    "- If asked about anything outside this scope (coding, general trivia, entertainment, unrelated tasks, etc.), gently and briefly decline and steer the conversation back to how you can help with rights, safety, or support.",
    "",
    "SAFETY & RESPONSIBILITY:",
    "- You provide general information, NOT professional legal, medical, or psychological advice. Say so when relevant and encourage connecting with a qualified professional or the assigned support services.",
    "- For any situation involving immediate danger, urge the person to contact emergency services right away: Kenya Police 999, GBV Helpline 1195, Childline Kenya 116.",
    "- Never ask for or store identifying personal information. Never make promises on behalf of WHRD Hub staff about case outcomes.",
    "- Be trauma-informed: keep responses calm, concise, and supportive.",
    "",
    `LANGUAGE: Detect the language of the user's MOST RECENT message and reply entirely in that same language, even if it differs from earlier messages — if the user switches language mid-conversation, switch with them. The user's current interface language is ${langName}; use it only as a fallback when the latest message is too short or ambiguous to identify a language.`,
    "",
    "FORMATTING: Use light Markdown to stay readable — short paragraphs, **bold** for key terms, and bullet lists for options or steps. Keep replies concise and scannable.",
  ].join("\n");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chat is not configured. Set OPENROUTER_API_KEY." },
      { status: 503 },
    );
  }

  let body: { messages?: ChatMessage[]; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const language: Language = (SUPPORTED as string[]).includes(body.language ?? "")
    ? (body.language as Language)
    : "en";

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://whrdhub.local",
        "X-Title": "WHRD Hub Resource Assistant",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt(language) },
          ...messages,
        ],
        temperature: 0.6,
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("OpenRouter error", res.status, detail);
      return NextResponse.json({ error: "Assistant is unavailable right now." }, { status: 502 });
    }

    const data = await res.json();
    const reply: string | undefined = data?.choices?.[0]?.message?.content;
    if (!reply) {
      return NextResponse.json({ error: "Empty response from assistant." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat route error", err);
    return NextResponse.json({ error: "Assistant is unavailable right now." }, { status: 502 });
  }
}

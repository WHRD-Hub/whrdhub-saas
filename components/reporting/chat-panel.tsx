"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Send, RotateCcw, ShieldAlert, Maximize2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { MarkdownLite } from "@/components/reporting/markdown-lite";

type Msg = { role: "user" | "assistant"; content: string };

const HISTORY_KEY = "whrd-chat-history";

const EMPTY: Msg[] = [];

function parseHistory(raw: string): Msg[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const msgs = parsed.filter(
        (m): m is Msg =>
          m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
      );
      return msgs.length ? msgs : EMPTY;
    }
  } catch {
    /* ignore corrupt history */
  }
  return EMPTY;
}

/** Read the saved transcript without a mount effect. */
const noopSubscribe = () => () => {};
function readStored(): string {
  try {
    return localStorage.getItem(HISTORY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function ChatPanel({ fullPage = false }: { fullPage?: boolean }) {
  const { t, language } = useLanguage();
  const c = t.chat;
  // `null` means "nothing typed yet this mount", so the saved transcript shows.
  const [local, setLocal] = useState<Msg[] | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const storedRaw = useSyncExternalStore(noopSubscribe, readStored, () => "");
  const messages = local ?? parseHistory(storedRaw);

  // Persist only once the transcript has actually changed, so an empty first
  // render can never overwrite saved history.
  const setMessages = useCallback((next: Msg[] | ((prev: Msg[]) => Msg[])) => {
    setLocal((prev) => {
      const base = prev ?? parseHistory(readStored());
      const value = typeof next === "function" ? next(base) : next;
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(value));
      } catch {
        /* storage full or unavailable — non-fatal */
      }
      return value;
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, language }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "request failed");
      setMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: c.errorMsg }]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
    if (typeof window !== "undefined") localStorage.removeItem(HISTORY_KEY);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-line shrink-0">
        <h2 className="font-semibold text-ink">{c.title}</h2>
        <div className="flex items-center gap-3">
          {!fullPage && (
            <Link
              href="/chat"
              className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors"
              aria-label={c.expand}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{c.expand}</span>
            </Link>
          )}
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{c.newChat}</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        <div className={fullPage ? "max-w-2xl mx-auto space-y-3" : "space-y-3"}>
          {messages.length === 0 && (
            <div className="bg-paper rounded-2xl p-4 text-sm text-muted leading-relaxed">
              {c.greeting}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-purple text-white whitespace-pre-wrap"
                    : "bg-paper text-ink"
                }`}
              >
                {m.role === "user" ? m.content : <MarkdownLite content={m.content} />}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-paper text-muted rounded-2xl px-3.5 py-2.5 text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-4 py-2 flex items-start gap-1.5 text-[11px] text-muted border-t border-line shrink-0">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{c.disclaimer}</span>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-line flex items-end gap-2 shrink-0">
        <div className={fullPage ? "flex items-end gap-2 w-full max-w-2xl mx-auto" : "flex items-end gap-2 w-full"}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={c.placeholder}
            className="flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple max-h-32"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            aria-label={c.send}
            className="shrink-0 w-9 h-9 rounded-xl bg-purple text-white flex items-center justify-center disabled:opacity-40 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? `${label} copied to clipboard` : `Copy ${label} to clipboard`}
      aria-live="polite"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border border-line bg-surface hover:bg-paper transition-colors shrink-0"
    >
      {copied
        ? <Check className="w-3 h-3 text-green-600" aria-hidden="true" />
        : <Copy className="w-3 h-3" aria-hidden="true" />}
      <span aria-hidden="true">{copied ? "Copied!" : label}</span>
    </button>
  );
}

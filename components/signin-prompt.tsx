"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart, MessageCircle, PenLine, X } from "lucide-react";
import { GUEST_LIMIT, SIGNIN_EVENT, type SignInReason } from "@/lib/guest-reactions";

/**
 * The prompt a signed-out visitor meets. Supporting posts is deliberately open
 * — up to GUEST_LIMIT of them, held in the browser and saved to the account on
 * sign-in — so this appears only when someone reaches that limit, or tries to
 * do something that genuinely needs an account.
 */
const COPY: Record<
  SignInReason,
  { icon: typeof Heart; title: string; body: string }
> = {
  "support-limit": {
    icon: Heart,
    title: "Keep supporting defenders",
    body: `You have supported ${GUEST_LIMIT} posts. Sign in to keep going — the support you have already given will be saved to your account.`,
  },
  comment: {
    icon: MessageCircle,
    title: "Sign in to comment",
    body: "Comments carry a name, so they need an account. Anything you have already supported will be saved when you sign in.",
  },
  post: {
    icon: PenLine,
    title: "Sign in to post",
    body: "Posting to the feed is for members of a county network. Sign in, or create an account and ask to join one.",
  },
};

export function SignInPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [reason, setReason] = useState<SignInReason | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      const detail = (e as CustomEvent<SignInReason>).detail;
      setReason(detail ?? "support-limit");
    };
    window.addEventListener(SIGNIN_EVENT, onPrompt);
    return () => window.removeEventListener(SIGNIN_EVENT, onPrompt);
  }, []);

  if (!reason) return null;

  const { icon: Icon, title, body } = COPY[reason];
  const close = () => setReason(null);
  const goSignIn = () => {
    close();
    router.push(`/login?next=${encodeURIComponent(pathname || "/")}`);
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-prompt-title"
        className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-magenta-050 text-magenta-700">
          <Icon className="h-7 w-7" />
        </div>
        <h2 id="signin-prompt-title" className="mt-4 text-xl font-black text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-5 space-y-2">
          <button
            onClick={goSignIn}
            className="h-11 w-full rounded-xl bg-purple text-sm font-bold text-white hover:bg-purple-600"
          >
            Sign in or create an account
          </button>
          <button
            onClick={close}
            className="h-11 w-full rounded-xl border border-line text-sm font-semibold text-ink hover:bg-purple-050"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

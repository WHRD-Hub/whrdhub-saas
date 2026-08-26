import { cn } from "@/lib/utils";

/**
 * Compatibility shim for the reporting console, which was written against
 * shadcn's Badge variants. Each variant maps onto the Hub's Pill palette so
 * the merged app has one visual language.
 */
type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "info"
  | "success"
  | "warning"
  | "destructive";

const variants: Record<Variant, string> = {
  default: "bg-purple text-white border-purple",
  secondary: "bg-slate-50 text-slate-600 border-slate-200",
  outline: "bg-transparent text-ink/70 border-line",
  info: "bg-cyan-050 text-cyan-700 border-cyan/30",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  destructive: "bg-rose-50 text-rose-700 border-rose-200",
};

export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

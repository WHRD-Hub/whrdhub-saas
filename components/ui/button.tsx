import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * One button for the whole product.
 *
 * The Hub's own variants (primary/outline/ghost/magenta/subtle) are the
 * canonical set. The reporting console was written against shadcn's names, so
 * `default`, `secondary`, `destructive`, `link`, the `default`/`icon` sizes and
 * `asChild` are all accepted too and mapped onto the same palette.
 */
type Variant =
  | "primary"
  | "outline"
  | "ghost"
  | "magenta"
  | "subtle"
  | "default"
  | "secondary"
  | "destructive"
  | "link";

type Size = "sm" | "md" | "lg" | "default" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple/40";

const variants: Record<Variant, string> = {
  primary: "bg-purple text-white hover:bg-purple-600 shadow-sm",
  default: "bg-purple text-white hover:bg-purple-600 shadow-sm",
  magenta: "bg-magenta text-white hover:brightness-95 shadow-sm",
  outline: "border border-line bg-surface text-ink hover:bg-purple-050 hover:border-purple/40",
  ghost: "text-ink/80 hover:bg-purple-050 hover:text-purple",
  subtle: "bg-purple-050 text-purple-700 hover:bg-purple/10",
  secondary: "bg-purple-050 text-purple-700 hover:bg-purple/10",
  destructive: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  link: "text-purple underline-offset-4 hover:underline px-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-11 px-5 text-sm",
  default: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-sm",
  icon: "h-9 w-9 p-0",
};

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
  /**
   * Render the single child element with the button's styling instead of a
   * <button>. Used by ported pages that wrap a <Link>.
   */
  asChild?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  href,
  asChild,
  className,
  children,
  ...props
}: Props) {
  const cls = cn(base, variants[variant], sizes[size], className);

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      className: cn(cls, child.props.className),
    });
  }

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

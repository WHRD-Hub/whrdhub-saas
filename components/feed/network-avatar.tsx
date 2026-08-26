import { cn } from "@/lib/utils";

/**
 * A network's mark.
 *
 * Posts are published by an organisation, so the card leads with the
 * organisation's logo rather than a personal avatar. Falling back to initials
 * on a brand tint means a CBO that has not uploaded a mark yet still reads as
 * itself, not as a broken image.
 */
export function NetworkAvatar({
  name,
  logoUrl,
  size = 40,
  isHub = false,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  isHub?: boolean;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full border border-line bg-surface object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  // Two letters of the network's name: "Kitui Women Peace and Security" → KW.
  const initials =
    name
      .replace(/^WHRD Hub.*$/i, "WHRD Hub")
      .split(/\s+/)
      .filter((w) => !/^(the|and|of|for|a)$/i.test(w))
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "W";

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        isHub ? "bg-purple text-white" : "bg-purple-050 text-purple-700",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      title={name}
    >
      {initials}
    </span>
  );
}

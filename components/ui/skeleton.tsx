import { cn } from "@/lib/utils";

/**
 * The shape a panel will take, shown while its data is still in flight.
 *
 * Streaming only helps if what arrives first is recognisable. A spinner tells
 * somebody to wait; an outline of the thing they asked for tells them it is
 * coming and roughly what it is, and stops the page jumping when it lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-purple-050/70", className)} aria-hidden />;
}

export function CardSkeleton() {
  return <Skeleton className="h-full min-h-[7rem] rounded-2xl" />;
}

export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

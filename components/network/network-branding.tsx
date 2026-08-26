"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { MediaUploader, type MediaItem } from "@/components/composer/media-uploader";
import { NetworkAvatar } from "@/components/feed/network-avatar";
import { updateOrganizationBranding } from "@/app/actions/membership";
import { toast } from "@/components/ui/toast";

/**
 * Setting the network's mark.
 *
 * Every post a member writes goes out under the organisation's name and this
 * image, so it is worth getting right. Without one, the card falls back to the
 * network's initials on a brand tint — legible, but anonymous.
 */
export function NetworkBranding({
  organizationId,
  name,
  logoUrl,
}: {
  organizationId: string;
  name: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [pending, start] = useTransition();

  const chosen = media[0]?.url ?? null;
  const preview = chosen ?? logoUrl;

  const save = (url: string | null) => {
    start(async () => {
      const res = await updateOrganizationBranding(organizationId, { logo_url: url });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(url ? "Your network's mark is set." : "Mark removed.");
      setMedia([]);
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-lg font-black text-ink">Your network&apos;s mark</h2>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Posts and stories from your members are published as{" "}
        <span className="font-semibold text-ink">{name}</span>, with this image beside
        them. A square logo works best.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <NetworkAvatar name={name} logoUrl={preview} size={64} />
        <div className="min-w-[16rem] flex-1">
          <MediaUploader
            value={media}
            onChange={(v) => setMedia(v.slice(-1))}
            accept="image/*"
            maxMb={5}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => save(chosen)}
          disabled={pending || !chosen}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-purple px-4 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-40"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save mark
        </button>
        {logoUrl && (
          <button
            onClick={() => save(null)}
            disabled={pending}
            className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-bold text-ink hover:bg-purple-050 disabled:opacity-40"
          >
            Remove
          </button>
        )}
      </div>
    </section>
  );
}

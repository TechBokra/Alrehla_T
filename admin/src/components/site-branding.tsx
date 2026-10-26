import { useCallback, useState } from "react";
import { BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSidebar } from "@/components/ui/sidebar";
import { useSiteBranding } from "@/features/site-branding/provider";
import type { SiteBrandingValues } from "@/features/site-branding/model";
import { cn } from "@/lib/utils";

function LogoImage({ src, name }: { src: string; name: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  // Cached images may already be complete when the element is attached.
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) setState(image.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  if (state === "error")
    return <span className="truncate font-semibold">{name}</span>;
  return (
    <div className="relative h-8 w-full" aria-busy={state === "loading"}>
      {state === "loading" && (
        <Skeleton
          className="absolute inset-0 h-full w-full"
          aria-label="جارٍ تحميل شعار الموقع"
          role="status"
        />
      )}
      <img
        ref={imageRef}
        src={src}
        alt={`شعار ${name}`}
        className={cn(
          "h-8 w-full object-contain",
          state !== "loaded" && "invisible",
        )}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </div>
  );
}

function SiteIcon({ src }: { src?: string }) {
  const [status, setStatus] = useState("idle");
  const loading = Boolean(src) && status !== "loaded" && status !== "error";
  return (
    <Avatar className="size-8 shrink-0 rounded-lg" aria-busy={loading}>
      <AvatarImage
        src={src}
        alt="أيقونة الموقع"
        className="object-contain"
        onLoadingStatusChange={setStatus}
      />
      <AvatarFallback className="rounded-lg">
        {loading ? (
          <Skeleton
            className="size-8 rounded-lg"
            role="status"
            aria-label="جارٍ تحميل أيقونة الموقع"
          />
        ) : (
          <BookOpen aria-hidden="true" />
        )}
      </AvatarFallback>
    </Avatar>
  );
}

export function SiteBrandingDisplay({
  branding,
  isLoading,
  collapsed,
}: {
  branding: SiteBrandingValues;
  isLoading: boolean;
  collapsed: boolean;
}) {
  if (isLoading)
    return (
      <Skeleton
        className={collapsed ? "size-8 shrink-0 rounded-lg" : "h-8 w-full"}
        role="status"
        aria-label="جارٍ تحميل هوية الموقع"
      />
    );
  if (collapsed)
    return (
      <SiteIcon key={branding.favicon ?? "missing"} src={branding.favicon} />
    );
  return (
    <div className="flex h-8 w-full min-w-0 items-center">
      {branding.logo ? (
        <LogoImage
          key={branding.logo}
          src={branding.logo}
          name={branding.name}
        />
      ) : (
        <span className="truncate font-semibold">{branding.name}</span>
      )}
    </div>
  );
}

export function SiteBranding() {
  const { branding, isLoading } = useSiteBranding();
  const { state, isMobile } = useSidebar();
  return (
    <SiteBrandingDisplay
      branding={branding}
      isLoading={isLoading}
      collapsed={state === "collapsed" && !isMobile}
    />
  );
}

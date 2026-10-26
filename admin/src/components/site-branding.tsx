import { useEffect, useState } from "react";
import { useGetIdentity, useOne } from "@refinedev/core";
import { BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type BrandSettings = {
  id: string;
  siteName: string | null;
  logo: string | null;
  favicon: string | null;
};

function imageUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function SiteBranding() {
  const { data: identity } = useGetIdentity<{ id: string }>();
  const { result } = useOne<BrandSettings>({
    resource: "site_settings",
    id: "general",
    dataProviderName: "siteSettings",
    meta: {
      idColumnName: "key",
      select:
        "id,siteName:value->>siteName,logo:value->images->>logo,favicon:value->images->>favicon",
    },
    queryOptions: {
      enabled: Boolean(identity?.id),
      staleTime: 300_000,
      retry: false,
    },
    errorNotification: false,
  });
  const branding = result;
  const name = branding?.siteName?.trim() || "الرحلة";
  const logo = imageUrl(branding?.logo);
  const favicon = imageUrl(branding?.favicon);
  const [failedLogo, setFailedLogo] = useState<string>();

  useEffect(() => {
    if (!favicon) return;
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = favicon;
    document.head.appendChild(icon);
    return () => icon.remove();
  }, [favicon]);

  return (
    <span className="flex w-full min-w-0 items-center gap-2">
      <Avatar className="size-8 shrink-0 rounded-lg">
        <AvatarImage
          src={favicon}
          alt="أيقونة الموقع"
          className="object-contain"
        />
        <AvatarFallback className="rounded-lg">
          <BookOpen aria-hidden="true" />
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 items-center group-data-[collapsible=icon]:hidden">
        {logo && failedLogo !== logo ? (
          <img
            src={logo}
            alt={`شعار ${name}`}
            className="h-8 w-full object-contain"
            onError={() => setFailedLogo(logo)}
          />
        ) : (
          <span className="truncate font-semibold">{name}</span>
        )}
      </span>
    </span>
  );
}

import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** Shared image and fallback treatment for catalog table rows. */
export function CatalogImageAvatar({
  src,
  fallback,
}: {
  src: string | null;
  fallback: ReactNode;
}) {
  return (
    <Avatar className="mt-0.5 size-[50px] shrink-0 rounded-lg after:rounded-lg">
      <AvatarImage
        src={src || undefined}
        alt=""
        loading="lazy"
        className="rounded-lg object-cover"
      />
      <AvatarFallback className="rounded-lg">{fallback}</AvatarFallback>
    </Avatar>
  );
}

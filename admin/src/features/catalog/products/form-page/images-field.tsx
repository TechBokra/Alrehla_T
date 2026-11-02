import { useState } from "react";
import { useList } from "@refinedev/core";
import { Images } from "lucide-react";
import { useResourceAuthorization } from "@/hooks/resources";
import { useAdminIdentity } from "@/hooks/auth/use-admin-access";
import { MEDIA_PROVIDER, MEDIA_RESOURCE, type MediaAsset, type MediaPage } from "@/features/uploads/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Product-specific media-library picker, composed by the shared image field. */
export function ProductImageLibraryPicker({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (asset: MediaAsset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState("");
  const identity = useAdminIdentity();
  const access = useResourceAuthorization("uploads", "list");
  const { query } = useList<MediaAsset>({
    resource: MEDIA_RESOURCE,
    dataProviderName: MEDIA_PROVIDER,
    pagination: { mode: "off" },
    sorters: [{ field: "createdAt", order: "desc" }],
    meta: {
      folder: "alrehla/products",
      search,
      cursor,
      identity: identity.data?.id,
    },
    queryOptions: {
      enabled: open && access.allowed && Boolean(identity.data?.id),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  const page = query.data as MediaPage | undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled || access.isPending || !access.allowed}>
          <Images data-icon="inline-start" />
          اختيار من المكتبة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>مكتبة صور المنتجات</DialogTitle>
          <DialogDescription>اختيار صورة موجودة يربطها بالمنتج ولا ينشئ نسخة جديدة.</DialogDescription>
        </DialogHeader>
        {access.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : !access.allowed ? (
          <p role="alert" className="text-sm text-destructive">لا تملك صلاحية عرض مكتبة الصور.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Input value={search} onChange={(event) => { setSearch(event.target.value); setCursor(""); }} placeholder="ابحث في صور المنتجات" aria-label="البحث في مكتبة الصور" />
            {query.isError ? (
              <p role="alert" className="text-sm text-destructive">تعذّر تحميل مكتبة الصور. حاول مرة أخرى.</p>
            ) : query.isPending ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div>
            ) : page?.data.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {page.data.map((asset) => (
                  <button key={asset.id} type="button" className="group overflow-hidden rounded-xl border text-start focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { onPick(asset); setOpen(false); }}>
                    <img src={asset.url} alt={asset.alt || asset.caption || ""} className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-[1.02]" />
                    <span className="block truncate px-2 py-1.5 text-xs">{asset.caption || asset.publicId.split("/").at(-1)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">لا توجد صور مطابقة في مجلد المنتجات.</p>
            )}
            {page?.nextCursor ? <Button type="button" variant="outline" onClick={() => setCursor(page.nextCursor!)} disabled={query.isFetching}>تحميل صور أقدم</Button> : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { useList } from "@refinedev/core";
import { Upload, UploadDropzone, UploadDropzoneDescription, UploadDropzoneTitle } from "@/components/ui/upload";
import { useUploadSelector } from "@uploadcn/react";
import type { CloudinaryUploadResult, Uploader } from "@uploadcn/core";
import { Images, ImagePlus, LoaderCircle, MoveDown, MoveUp, Star, X } from "lucide-react";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useResourceAuthorization } from "@/hooks/resources";
import { useAdminIdentity } from "@/hooks/auth/use-admin-access";
import { MEDIA_PROVIDER, MEDIA_RESOURCE, type MediaAsset, type MediaPage } from "@/features/uploads/model";
import type { ProductImageSelection } from "./schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ProductImagesField({
  value,
  onChange,
  uploader,
  disabled,
  uploadConfigured,
}: {
  value: ProductImageSelection[];
  onChange: (value: ProductImageSelection[]) => void;
  uploader: Uploader<CloudinaryUploadResult>;
  disabled: boolean;
  uploadConfigured: boolean;
}) {
  const uploadAccess = useResourceAuthorization("uploads", "upload");
  const items = useUploadSelector(uploader, (state) => state.items);
  const queueIds = items
    .filter((item) => item.status !== "rejected" && item.status !== "cancelled")
    .map((item) => item.id);
  const queueKey = queueIds.join("|");
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    const available = new Set(queueIds);
    const kept = valueRef.current.filter(
      (image) => image.kind === "saved" || (image.kind === "queued" && available.has(image.uploadId)),
    );
    const known = new Set(kept.filter((image) => image.kind === "queued").map((image) => image.uploadId));
    const added = queueIds
      .filter((id) => !known.has(id))
      .map((id) => {
        const item = items.find((entry) => entry.id === id)!;
        return { kind: "queued", uploadId: id, name: item.name } satisfies ProductImageSelection;
      });
    if (added.length || kept.length !== valueRef.current.length) {
      const next = [...kept, ...added];
      valueRef.current = next;
      onChangeRef.current(next);
    }
    // Queue IDs change only when files are added or removed, not during upload progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey]);

  const failedUpload = items.some((item) => ["error", "rejected", "cancelled"].includes(item.status));
  const uploadBusy = items.some((item) => ["queued", "validating", "uploading", "processing", "scanning", "paused"].includes(item.status));
  const savedCount = value.filter((image) => image.kind === "saved").length;
  useEffect(() => {
    uploader.setOptions({ maxFiles: Math.max(0, 9 - savedCount) });
  }, [savedCount, uploader]);
  const setImages = (next: ProductImageSelection[]) => {
    valueRef.current = next;
    onChange(next);
  };
  const moveImage = (index: number, target: number) => {
    const next = [...value];
    const [image] = next.splice(index, 1);
    next.splice(Math.max(0, Math.min(target, next.length)), 0, image);
    setImages(next);
  };
  const removeImage = (index: number) => {
    const image = value[index];
    if (image?.kind === "queued") uploader.remove(image.uploadId);
    setImages(value.filter((_, current) => current !== index));
  };
  return (
    <BaseFormField
      label="صور المنتج"
      description="الصورة الأولى هي الغلاف، ثم حتى ٨ صور للمعرض. حذف الصورة يزيل ربطها بالمنتج فقط ولا يحذف ملف Cloudinary."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {uploadAccess.allowed && uploadConfigured ? (
            <Upload
              uploader={uploader}
              multiple
              disabled={disabled || uploadBusy || value.length >= 9}
              className="w-auto"
            >
              <UploadDropzone size="sm" className="min-h-10 flex-row gap-2 px-3 py-2 text-start">
                <ImagePlus className="size-4" />
                <div className="flex flex-col items-start gap-0.5">
                  <UploadDropzoneTitle className="text-sm">إضافة صور من الجهاز</UploadDropzoneTitle>
                  <UploadDropzoneDescription className="text-xs">JPG أو PNG أو WebP أو AVIF، حتى ٥ م.ب للصورة.</UploadDropzoneDescription>
                </div>
              </UploadDropzone>
            </Upload>
          ) : null}
          <LibraryImagePicker
            disabled={disabled || value.length >= 9}
            onPick={(asset) => {
              if (value.length >= 9) return;
              setImages([...value, { kind: "saved", url: asset.url }]);
            }}
          />
        </div>
        {value.length ? (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {value.map((image, index) => (
              <ProductImageCard
                key={image.kind === "saved" ? `${image.url}-${index}` : image.uploadId}
                image={image}
                upload={image.kind === "queued" ? items.find((item) => item.id === image.uploadId) : undefined}
                index={index}
                count={value.length}
                disabled={disabled || uploadBusy}
                onMove={(target) => moveImage(index, target)}
                onRemove={() => removeImage(index)}
              />
            ))}
          </ol>
        ) : (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
            <Images className="size-5" />
            <span>لم تُضف صورًا بعد</span>
          </div>
        )}
        {failedUpload ? (
          <p role="alert" className="text-sm text-destructive">
            تعذّر رفع صورة. أزل الملف الفاشل ثم اختره مجددًا قبل حفظ المنتج.
          </p>
        ) : null}
        {items.filter((item) => item.status === "rejected" || item.status === "cancelled").map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 p-3 text-sm">
            <span className="min-w-0 truncate">{item.name}: {item.issues[0]?.message ?? "لم يكتمل الملف"}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => uploader.remove(item.id)}>إزالة الملف</Button>
          </div>
        ))}
        {uploadAccess.allowed && !uploadConfigured ? (
          <p role="status" className="text-sm text-muted-foreground">إعداد رفع الصور غير مكتمل؛ يمكنك استخدام مكتبة الصور.</p>
        ) : null}
        {!uploadAccess.isPending && !uploadAccess.allowed ? (
          <p className="text-sm text-muted-foreground">رفع صور جديدة غير متاح لهذه الصلاحية، ويمكنك اختيار صورة موجودة من المكتبة إذا كان لديك إذن عرضها.</p>
        ) : null}
      </div>
    </BaseFormField>
  );
}

function ProductImageCard({
  image,
  upload,
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  image: ProductImageSelection;
  upload?: ReturnType<Uploader<CloudinaryUploadResult>["getItem"]>;
  index: number;
  count: number;
  disabled: boolean;
  onMove: (target: number) => void;
  onRemove: () => void;
}) {
  const preview = useObjectUrl(image.kind === "saved" ? undefined : upload?.file);
  const src = image.kind === "saved" ? image.url : preview;
  const loading = upload && !["success", "error", "rejected", "cancelled"].includes(upload.status);
  return (
    <li className="relative overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-square bg-muted/30">
        {src ? <img src={src} alt={image.kind === "queued" ? image.name : "صورة المنتج"} className="size-full object-cover" /> : null}
        {index === 0 ? (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs shadow">
            <Star className="size-3 fill-current" /> الغلاف
          </span>
        ) : null}
        {loading ? (
          <span className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-lg bg-background/90 p-2 text-xs">
            <LoaderCircle className="size-3.5 animate-spin" />
            <span className="min-w-0 flex-1 truncate">جارٍ الرفع…</span>
            <span>{Math.round(upload.progress.percent)}%</span>
          </span>
        ) : null}
        {upload?.status === "error" ? (
          <span className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1 rounded-lg bg-destructive/90 p-1.5 text-xs text-destructive-foreground">
            فشل الرفع؛ أزل الملف لإعادة اختياره
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-1 p-1.5">
        <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">
          {image.kind === "queued" ? image.name : `صورة ${index + 1}`}
        </span>
        <div className="flex shrink-0">
          {index > 0 ? (
            <Button type="button" variant="ghost" size="icon-xs" disabled={disabled} aria-label="جعل الصورة غلافًا" onClick={() => onMove(0)}><Star /></Button>
          ) : null}
          {index > 0 ? (
            <Button type="button" variant="ghost" size="icon-xs" disabled={disabled} aria-label="تحريك الصورة لأعلى" onClick={() => onMove(index - 1)}><MoveUp /></Button>
          ) : null}
          {index < count - 1 ? (
            <Button type="button" variant="ghost" size="icon-xs" disabled={disabled} aria-label="تحريك الصورة لأسفل" onClick={() => onMove(index + 1)}><MoveDown /></Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon-xs" disabled={disabled} aria-label="إزالة ربط الصورة" onClick={onRemove}><X /></Button>
        </div>
      </div>
    </li>
  );
}

function useObjectUrl(file?: File) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function LibraryImagePicker({
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
            ) : page?.data.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {page.data.map((asset) => (
                  <button key={asset.id} type="button" className="group overflow-hidden rounded-xl border text-start focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { onPick(asset); setOpen(false); }}>
                    <img src={asset.url} alt={asset.alt || asset.caption || ""} className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]" />
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

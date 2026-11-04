import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import type { CloudinaryUploadResult, UploadItem } from "@uploadcn/core";
import { useUploadSelector } from "@uploadcn/react";
import { Images, ImagePlus, LoaderCircle, Star, X } from "lucide-react";
import { useResourceUploads } from "@/contexts/resource-page/uploads";
import { BaseFormField } from "../components/base-form-field";
import type { FieldProps } from "../types";
import { Button } from "@/components/ui/button";
import {
  Upload,
  UploadDropzone,
  UploadDropzoneDescription,
  UploadDropzoneTitle,
  UploadTrigger,
} from "@/components/ui/upload";
import type { ImageUploadSelection } from "@/hooks/uploads";

export interface ImageUploadSourcePickerProps {
  disabled: boolean;
  onPick: (url: string) => void;
}

export interface ImageUploadFieldProps extends FieldProps {
  /** The uploader slot declared by the resource's page definition. */
  uploadKey: string;
  /** Compact preview and full-width upload button used by the box plans form. */
  appearance?: "default" | "box-plan";
  renderSourcePicker?: (props: ImageUploadSourcePickerProps) => ReactNode;
}

/** Resource-backed image field: the resource page owns its uploader and signed adapter. */
export function ImageUploadField({
  uploadKey,
  appearance = "default",
  renderSourcePicker,
  label,
  description,
  disabled,
  ariaLabel,
  required,
  className,
  labelClassName,
}: ImageUploadFieldProps) {
  const field = useFieldContext<ImageUploadSelection[]>();
  const uploads = useResourceUploads();
  const upload = uploads[uploadKey];
  if (!upload) {
    throw new Error(`ImageUploadField refers to undeclared upload slot "${uploadKey}".`);
  }
  const items = useUploadSelector(upload.uploader, (state) => state.items);
  const value = field.state.value ?? [];
  const valueRef = useRef(value);
  const onChangeRef = useRef(field.handleChange);
  const queueIds = items
    .filter((item) => item.status !== "rejected" && item.status !== "cancelled")
    .map((item) => item.id);
  const queueKey = queueIds.join("|");
  const maxFiles = upload.uploader.getOptions().maxFiles ?? 1;
  const maxSizeMb = Math.ceil((upload.uploader.getOptions().maxSize ?? 0) / (1024 * 1024));

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = field.handleChange; }, [field.handleChange]);
  useEffect(() => {
    const available = new Set(queueIds);
    const kept = valueRef.current.filter(
      (image) => image.kind === "saved" || available.has(image.uploadId),
    );
    const known = new Set(
      kept.filter((image) => image.kind === "queued").map((image) => image.uploadId),
    );
    const added = queueIds
      .filter((id) => !known.has(id))
      .map((id) => {
        const item = items.find((entry) => entry.id === id)!;
        return { kind: "queued", uploadId: id, name: item.name } satisfies ImageUploadSelection;
      });
    if (appearance === "box-plan" && queueIds.length > 0) {
      const latestId = queueIds[queueIds.length - 1];
      const latest = items.find((item) => item.id === latestId);
      const next = latest
        ? [{ kind: "queued", uploadId: latest.id, name: latest.name } satisfies ImageUploadSelection]
        : [];
      for (const staleId of queueIds.slice(0, -1)) {
        upload.uploader.remove(staleId);
      }
      if (
        next.length !== valueRef.current.length ||
        (next[0]?.kind === "queued" && valueRef.current[0]?.kind !== "queued") ||
        (next[0]?.kind === "queued" && valueRef.current[0]?.kind === "queued" && next[0].uploadId !== valueRef.current[0].uploadId)
      ) {
        valueRef.current = next;
        onChangeRef.current(next);
      }
      return;
    }
    const next = [...kept, ...added].slice(0, maxFiles);
    if (added.length || next.length !== valueRef.current.length) {
      valueRef.current = next;
      onChangeRef.current(next);
    }
    // Queue IDs change only when a file is added or removed, not on progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey, appearance, maxFiles]);

  const canUpload = Boolean(upload.adapter && upload.allowed);
  const full = appearance !== "box-plan" && value.length >= maxFiles;
  const controlDisabled = Boolean(disabled || upload.uploading);
  const setImages = (next: ImageUploadSelection[]) => {
    valueRef.current = next;
    field.handleChange(next);
  };
  const removeImage = (index: number) => {
    const selected = value[index];
    if (selected?.kind === "queued") upload.uploader.remove(selected.uploadId);
    setImages(value.filter((_, current) => current !== index));
  };
  const pickSavedImage = (url: string) => {
    if (controlDisabled || full || value.some((image) => image.kind === "saved" && image.url === url)) return;
    setImages(
      appearance === "box-plan"
        ? [{ kind: "saved", url }]
        : [...value, { kind: "saved", url }],
    );
  };
  const selectedImage = value[0];
  const selectedUpload =
    selectedImage?.kind === "queued"
      ? items.find((item) => item.id === selectedImage.uploadId)
      : undefined;
  const imageAlt = typeof label === "string" ? label : "الصورة";
  const isSelectedUploading =
    selectedImage?.kind === "queued" &&
    upload.uploadingIds.has(selectedImage.uploadId);

  return (
    <BaseFormField
      label={label}
      description={description}
      required={required}
      disabled={disabled}
      ariaLabel={ariaLabel}
      className={className}
      labelClassName={labelClassName}
      labelTarget="labelledBy"
    >
      {(control) => (
        <div
          role="group"
          aria-labelledby={control["aria-labelledby"]}
          aria-label={control["aria-label"]}
          aria-invalid={control["aria-invalid"]}
          aria-describedby={control["aria-describedby"]}
          aria-disabled={disabled || undefined}
          className="flex flex-col gap-4"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              field.handleBlur();
            }
          }}
        >
          {appearance === "box-plan" ? (
            <div className="flex flex-col gap-2">
              {canUpload ? (
                <Upload
                  uploader={upload.uploader}
                  disabled={controlDisabled}
                  multiple={false}
                  className="gap-2"
                >
                  <BoxPlanImagePreview
                    image={selectedImage}
                    upload={selectedUpload}
                    uploading={isSelectedUploading}
                    alt={imageAlt}
                  />
                  <UploadTrigger
                    disabled={controlDisabled}
                    variant="secondary"
                    size="lg"
                    className="w-full rounded-xl text-sm font-bold"
                  >
                    {upload.uploading ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <ImagePlus />
                    )}
                    {upload.uploading
                      ? "جارٍ الرفع…"
                      : value.length
                        ? "تغيير"
                        : "رفع صورة"}
                  </UploadTrigger>
                </Upload>
              ) : (
                <BoxPlanImagePreview
                  image={selectedImage}
                  upload={selectedUpload}
                  uploading={isSelectedUploading}
                  alt={imageAlt}
                />
              )}
              {renderSourcePicker?.({
                disabled: controlDisabled,
                onPick: pickSavedImage,
              })}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {canUpload ? (
                  <Upload
                    uploader={upload.uploader}
                    disabled={controlDisabled || full}
                    className="w-auto"
                  >
                    <UploadDropzone size="sm" className="min-h-10 flex-row gap-2 px-3 py-2 text-start">
                      <ImagePlus className="size-4" />
                      <span className="flex flex-col items-start gap-0.5">
                        <UploadDropzoneTitle className="text-sm">اختيار صورة</UploadDropzoneTitle>
                        <UploadDropzoneDescription className="text-xs">
                          JPG أو PNG أو WebP أو AVIF{maxSizeMb ? ` — حتى ${maxSizeMb} ميجابايت` : ""}
                        </UploadDropzoneDescription>
                      </span>
                    </UploadDropzone>
                  </Upload>
                ) : null}
                {renderSourcePicker?.({ disabled: controlDisabled || full, onPick: pickSavedImage })}
              </div>

              {value.length ? (
                <ol className="flex flex-wrap gap-3">
                  {value.map((image, index) => (
                    <ImagePreview
                      key={image.kind === "saved" ? image.url : image.uploadId}
                      image={image}
                      upload={image.kind === "queued" ? items.find((item) => item.id === image.uploadId) : undefined}
                      isUploading={image.kind === "queued" && upload.uploadingIds.has(image.uploadId)}
                      disabled={controlDisabled}
                      alt={imageAlt}
                      onRemove={() => removeImage(index)}
                    />
                  ))}
                </ol>
              ) : (
                <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
                  <Images className="size-5" />
                  <span>لم تُضف صورة بعد</span>
                </div>
              )}
            </>
          )}

          {items.filter((item) => item.status === "rejected" || item.status === "cancelled").map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 p-3 text-sm">
              <span className="min-w-0 truncate">{item.name}: {item.issues[0]?.message ?? "لم يكتمل الملف"}</span>
              <Button type="button" variant="outline" size="sm" disabled={controlDisabled} onClick={() => upload.uploader.remove(item.id)}>إزالة الملف</Button>
            </div>
          ))}
          {upload.failed ? (
            <p role="alert" className="text-sm text-destructive">تعذّر رفع الصورة. أزل الملف الفاشل ثم اختره مجددًا قبل الحفظ.</p>
          ) : null}
          {upload.accessPending ? (
            <p role="status" className="text-sm text-muted-foreground">جارٍ التحقق من صلاحية رفع الصور…</p>
          ) : null}
          {upload.allowed && !upload.adapter ? (
            <p role="status" className="text-sm text-muted-foreground">إعداد رفع الصور غير مكتمل؛ يمكنك اختيار صورة موجودة من المكتبة.</p>
          ) : null}
          {!upload.accessPending && !upload.allowed ? (
            <p role="status" className="text-sm text-muted-foreground">رفع صور جديدة غير متاح بهذه الصلاحية.</p>
          ) : null}
        </div>
      )}
    </BaseFormField>
  );
}

function ImagePreview({
  image,
  upload,
  isUploading,
  disabled,
  alt,
  onRemove,
}: {
  image: ImageUploadSelection;
  upload?: UploadItem<CloudinaryUploadResult>;
  isUploading: boolean;
  disabled: boolean;
  alt: string;
  onRemove: () => void;
}) {
  const localUrl = useObjectUrl(image.kind === "queued" ? upload?.file : undefined);
  const src = image.kind === "saved" ? image.url : localUrl;
  return (
    <li className="relative w-44 overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-[3/4] bg-muted/30">
        {src ? <img src={src} alt={alt} className="size-full object-cover" /> : null}
        <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs shadow">
          <Star className="size-3 fill-current" /> الصورة
        </span>
        {isUploading && upload ? (
          <span className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-lg bg-background/90 p-2 text-xs">
            <LoaderCircle className="size-3.5 animate-spin" />
            <span className="min-w-0 flex-1 truncate">جارٍ الرفع…</span>
            <span>{Math.round(upload!.progress.percent)}%</span>
          </span>
        ) : null}
        {upload?.status === "error" ? (
          <span className="absolute inset-x-2 bottom-2 rounded-lg bg-destructive/90 p-1.5 text-center text-xs text-destructive-foreground">
            فشل الرفع؛ أزل الملف لإعادة اختياره
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-1 p-1.5">
        <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">
          {image.kind === "queued" ? image.name : "صورة من المكتبة"}
        </span>
        <Button type="button" variant="ghost" size="icon-xs" disabled={disabled} aria-label="إزالة الصورة" onClick={onRemove}><X /></Button>
      </div>
    </li>
  );
}

function BoxPlanImagePreview({
  image,
  upload,
  uploading,
  alt,
}: {
  image?: ImageUploadSelection;
  upload?: UploadItem<CloudinaryUploadResult>;
  uploading: boolean;
  alt: string;
}) {
  const localUrl = useObjectUrl(image?.kind === "queued" ? upload?.file : undefined);
  const src = image?.kind === "saved" ? image.url : localUrl;

  return (
    <div className="relative h-32 w-full overflow-hidden rounded-xl border bg-muted/40">
      {src ? (
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs font-bold text-muted-foreground">
          بدون صورة
        </div>
      )}
      {uploading && upload ? (
        <span className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-lg bg-background/90 p-2 text-xs shadow-sm">
          <LoaderCircle className="size-3.5 animate-spin" />
          <span className="min-w-0 flex-1 truncate">جارٍ الرفع…</span>
          <span>{Math.round(upload.progress.percent)}%</span>
        </span>
      ) : null}
    </div>
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

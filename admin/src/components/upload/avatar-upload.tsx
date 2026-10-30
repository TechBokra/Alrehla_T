"use client";

import * as React from "react";
import { type UploadAdapter, type UploadItem } from "@uploadcn/core";
import {
  Upload as UploadPrimitive,
  useUploadContext,
  useUploadSelector,
} from "@uploadcn/react";
import { cn } from "cn";
import { useCropQueue } from "@/hooks/use-crop-queue";
import { ImageCropper } from "@/components/ui/image-cropper";
import { NativeButton, Upload, UploadTrigger } from "@/components/ui/upload";
import { CameraIcon, UserIcon, CircleAlertIcon } from "lucide-react";

interface AvatarUploadProps<TResult> {
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
  accept?: string;
  adapter?: UploadAdapter<TResult>;
  /** Current avatar URL, shown until a new one is uploaded. */
  src?: string | null;
  /** Output size in pixels (square). Default 512. */
  maxSize?: number;
  size?: number;
  /** Called with the upload result, or `null` when the avatar is removed. */
  onChange?: (item: UploadItem<TResult> | null) => void;
  name?: string;
  className?: string;
}

function AvatarUpload<TResult = unknown>({
  disabled,
  onPendingChange,
  accept = "image/jpeg,image/png,image/webp,image/avif",
  adapter,
  src,
  size = 512,
  maxSize = 10 * 1000 * 1000,
  onChange,
  name,
  className,
}: AvatarUploadProps<TResult>) {
  const crops = useCropQueue();
  const { request } = crops;
  const transform = React.useCallback((file: File) => request(file), [request]);

  return (
    <Upload
      disabled={disabled}
      onPendingChange={onPendingChange}
      adapter={adapter}
      accept={accept}
      maxSize={maxSize}
      multiple={false}
      transform={transform}
      onSuccess={onChange}
      name={name}
      className={cn("w-auto flex-row items-center gap-4", className)}
    >
      <AvatarPreview fallbackSrc={src ?? null} disabled={disabled} />
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <UploadTrigger>
            <CameraIcon data-icon="inline-start" />
            {src ? "تغيير الصورة" : "رفع صورة"}
          </UploadTrigger>
          <AvatarRemove
            disabled={disabled}
            hasSaved={Boolean(src)}
            onRemove={() => onChange?.(null)}
          />
        </div>
        <AvatarHint />
      </div>
      <ImageCropper
        file={crops.current}
        cropShape="round"
        aspect={1}
        output={{
          maxWidth: size,
          maxHeight: size,
          type: "image/webp",
          quality: 0.9,
        }}
        onCrop={crops.complete}
        onCancel={crops.skip}
        title="قص الصورة الشخصية"
      />
    </Upload>
  );
}

function useAvatarItem() {
  const { uploader } = useUploadContext();
  return useUploadSelector(uploader, (state) => state.items.at(-1) ?? null);
}

function AvatarPreview({
  fallbackSrc,
  disabled,
}: {
  fallbackSrc: string | null;
  disabled?: boolean;
}) {
  const item = useAvatarItem();
  const { openFileDialog } = useUploadContext();
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const uploading =
    item &&
    (item.status === "uploading" ||
      item.status === "queued" ||
      item.status === "validating");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={openFileDialog}
      aria-label="تغيير الصورة الشخصية"
      className="group/avatar relative size-20 shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="absolute inset-1 flex items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
        {item && item.status !== "rejected" && item.status !== "cancelled" ? (
          <UploadPrimitive.Item
            item={item}
            render={<span className="contents" />}
          >
            <UploadPrimitive.Preview
              thumbnailSize={256}
              className="size-full animate-in object-cover duration-300 fade-in-0 motion-reduce:animate-none"
            />
          </UploadPrimitive.Item>
        ) : fallbackSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar URL of unknown origin
          <img src={fallbackSrc} alt="" className="size-full object-cover" />
        ) : (
          <UserIcon className="size-8" aria-hidden />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
          <CameraIcon className="size-5" aria-hidden />
        </span>
      </span>
      {item ? (
        <UploadPrimitive.Item
          item={item}
          render={<span className="contents" />}
        >
          <UploadPrimitive.Progress
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity",
              !uploading && "opacity-0",
            )}
            render={(props, state) => (
              <svg
                {...(props as React.ComponentProps<"svg">)}
                viewBox="0 0 100 100"
                aria-hidden={!uploading}
              >
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  strokeWidth="4"
                  className="stroke-muted"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - state.percent / 100)}
                  className="origin-center -rotate-90 stroke-primary transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none"
                />
              </svg>
            )}
          />
        </UploadPrimitive.Item>
      ) : null}
    </button>
  );
}

function AvatarRemove({
  onRemove,
  disabled,
  hasSaved,
}: {
  onRemove: () => void;
  disabled?: boolean;
  hasSaved: boolean;
}) {
  const item = useAvatarItem();
  const { uploader } = useUploadContext();
  if (!item && !hasSaved) return null;
  return (
    <NativeButton
      disabled={disabled}
      variant="ghost"
      size="sm"
      onClick={() => {
        uploader.remove();
        onRemove();
      }}
    >
      إزالة الصورة
    </NativeButton>
  );
}

function AvatarHint() {
  const item = useAvatarItem();
  if (item?.status === "error" || item?.status === "rejected") {
    return (
      <p className="inline-flex items-center gap-1 text-xs text-destructive">
        <CircleAlertIcon className="size-3" aria-hidden />
        {item.issues[0]?.message ?? item.error?.message}
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      اختر صورة؛ سيتم قصّها إلى مربع.
    </p>
  );
}

export { AvatarUpload, type AvatarUploadProps };

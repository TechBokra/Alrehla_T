import { useEffect } from "react";
import { useUploader, useUploadSelector } from "@uploadcn/react";
import type { UploadAdapter, CloudinaryUploadResult } from "@uploadcn/core";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import { FileUpload } from "@/components/upload/file-upload";
import type { CloudinaryImageValue } from "@/components/upload/cloudinary";
import { FieldDescription } from "@/components/ui/field";
import { BaseFormField } from "../components/base-form-field";
import type { FieldProps } from "../types";

type ImageUploadFieldProps = FieldProps & {
  adapter?: UploadAdapter<CloudinaryUploadResult>;
  maxSizeMb?: number;
  onUploadingChange?: (uploading: boolean) => void;
};

/** Store only completed Cloudinary results; upload bytes/progress stay in UploadCN. */
export function ImageUploadField({
  adapter,
  maxSizeMb = 5,
  onUploadingChange,
  ...presentation
}: ImageUploadFieldProps) {
  const field = useFieldContext<CloudinaryImageValue>();
  const value = field.state.value;
  const url = typeof value === "string" ? value : value?.secure_url;
  return (
    <BaseFormField {...presentation} labelTarget="labelledBy">
      {(control) => (
        <div
          role="group"
          aria-labelledby={control["aria-labelledby"]}
          aria-label={control["aria-label"]}
          aria-describedby={control["aria-describedby"]}
          aria-invalid={control["aria-invalid"]}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              field.handleBlur();
          }}
        >
          {url && (
            <img
              src={url}
              alt={
                typeof presentation.label === "string"
                  ? presentation.label
                  : "الصورة الحالية"
              }
              className="mb-3 max-h-48 rounded-md object-contain"
            />
          )}
          {adapter ? (
            <ImageUploadControl
              adapter={adapter}
              disabled={control.disabled}
              maxSizeMb={maxSizeMb}
              onUploadingChange={onUploadingChange}
              onSuccess={(result) => field.handleChange(result)}
            />
          ) : (
            <FieldDescription>
              يجب إعداد اتصال Cloudinary الموقّع لتفعيل رفع الصور.
            </FieldDescription>
          )}
        </div>
      )}
    </BaseFormField>
  );
}

function ImageUploadControl({
  adapter,
  disabled,
  maxSizeMb,
  onSuccess,
  onUploadingChange,
}: {
  adapter: UploadAdapter<CloudinaryUploadResult>;
  disabled: boolean;
  maxSizeMb: number;
  onSuccess: (result: CloudinaryUploadResult) => void;
  onUploadingChange?: (pending: boolean) => void;
}) {
  const uploader = useUploader({
    adapter,
    accept: "image/jpeg,image/png,image/webp,image/avif",
    maxSize: maxSizeMb * 1024 * 1024,
    maxFiles: 1,
    onSuccess: (item) => {
      if (item.result) onSuccess(item.result);
    },
  });
  const pending = useUploadSelector(uploader, (state) =>
    state.items.some(
      (item) =>
        !["success", "error", "rejected", "cancelled"].includes(item.status),
    ),
  );
  useEffect(() => {
    onUploadingChange?.(pending);
  }, [pending, onUploadingChange]);
  useEffect(() => () => onUploadingChange?.(false), [onUploadingChange]);
  return (
    <FileUpload
      uploader={uploader}
      multiple={false}
      disabled={disabled}
      title="اسحب الصورة هنا أو انقر لاختيارها"
      description={`صور JPG أو PNG أو WebP أو AVIF، حتى ${maxSizeMb} ميجابايت.`}
    />
  );
}

"use client";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FieldDescription } from "@/components/ui/field";
import { BaseFormField } from "../components/base-form-field";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import type { FieldProps } from "../types";

export function AttachmentsField({
  label,
  description,
  disabled,
  ariaLabel,
  required,
  className,
  labelClassName,
  maxFiles = 5,
}: FieldProps & { maxFiles?: number }) {
  const field = useFieldContext<File[]>();
  const files = field.state.value ?? [];
  return (
    <BaseFormField
      label={label}
      description={description}
      disabled={disabled}
      ariaLabel={ariaLabel}
      required={required}
      className={className}
      labelClassName={labelClassName}
    >
      {(control) => (
        <>
          <Input
            id={control.id}
            name={field.name}
            type="file"
            multiple
            accept="image/*,.pdf"
            disabled={disabled}
            aria-label={control["aria-label"]}
            aria-invalid={control["aria-invalid"]}
            aria-required={control["aria-required"]}
            aria-describedby={control["aria-describedby"]}
            onBlur={field.handleBlur}
            onChange={(event) => {
              field.handleChange(
                [...files, ...Array.from(event.target.files ?? [])].slice(
                  0,
                  maxFiles,
                ),
              );
              event.currentTarget.value = "";
            }}
          />
          {files.length > 0 ? (
            <AttachmentGroup aria-label="المرفقات المحددة">
              {files.map((file, index) => (
                <Attachment
                  key={file.name + "-" + file.lastModified + "-" + index}
                  state="idle"
                >
                  <AttachmentMedia>
                    <FileText />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{file.name}</AttachmentTitle>
                    <AttachmentDescription>
                      {file.type || "نوع غير معروف"} ·{" "}
                      {new Intl.NumberFormat("ar-EG").format(file.size)} بايت
                    </AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      type="button"
                      disabled={disabled}
                      aria-label={"إزالة " + file.name}
                      onClick={() =>
                        field.handleChange(
                          files.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                    >
                      <X />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              ))}
            </AttachmentGroup>
          ) : (
            <FieldDescription>لم يتم اختيار مرفقات.</FieldDescription>
          )}
        </>
      )}
    </BaseFormField>
  );
}

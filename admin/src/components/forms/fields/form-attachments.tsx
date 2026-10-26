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
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

export function FormAttachments({
  label,
  description,
  disabled,
  ariaLabel,
  maxFiles = 5,
}: FieldProps & { maxFiles?: number }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy } = presentation;
  const files = field.state.value as File[];

  return (
    <FieldFrame presentation={presentation}>
      <Input
        id={id}
        name={field.name}
        type="file"
        multiple
        accept="image/*,.pdf"
        disabled={disabled}
        aria-label={
          !presentation.label ? presentation.accessibleLabel : undefined
        }
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(
            [...files, ...Array.from(event.target.files ?? [])].slice(
              0,
              maxFiles
            )
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
                  {file.type || "نوع غير معروف"} · {new Intl.NumberFormat("ar-EG").format(file.size)} بايت
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  type="button"
                  aria-label={"إزالة " + file.name}
                  onClick={() =>
                    field.handleChange(
                      files.filter((_, fileIndex) => fileIndex !== index)
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
    </FieldFrame>
  );
}

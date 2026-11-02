import type { BaseRecord } from "@refinedev/core";
import type { ReactNode } from "react";
import type { ResourceUploadHandles, ResolveImages } from "@/hooks/uploads";
import type { ResourceFormSubmit } from "@/hooks/resources/page/form-submission";

export type ResourcePageMode = "create" | "edit" | "details";

export interface ResourcePageActionDescriptor<TInput = void> {
  label: string;
  disabled: boolean;
  isPending: boolean;
  error?: string;
  buttonProps: {
    type: "button";
    disabled: boolean;
    onClick: () => void;
  };
  menuItemProps: {
    disabled: boolean;
    onSelect: () => void;
  };
  open: () => void;
  execute: (input: TInput) => Promise<unknown>;
}

export interface ResourcePageRuntime<TRecord extends BaseRecord = BaseRecord> {
  kind: "form" | "details";
  resource: string;
  id?: string;
  record?: TRecord;
  mode: ResourcePageMode;
  title: string;
  disabled: boolean;
  pending: boolean;
  loading: boolean;
  error?: string;
  form?: unknown;
  feature?: unknown;
  uploads?: ResourceUploadHandles;
  resolveImages?: ResolveImages;
  submit?: ResourceFormSubmit<TRecord>;
  commandBlockReason?: string;
  refreshRecord?: () => Promise<TRecord | undefined>;
  retry?: () => Promise<void>;
  canRetry?: boolean;
  actions: Record<string, ResourcePageActionDescriptor<any>>;
  activeCommandKey?: string;
  closeCommand?: () => void;
  feedback?: { message: string; kind: "success" | "warning" | "error" };
  children?: ReactNode;
}

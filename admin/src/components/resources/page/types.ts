import type { BaseRecord } from "@refinedev/core";
import type { ComponentType, ReactNode } from "react";
import type { ResourceFormDialogContext } from "../forms/types";
import type { ResourceFormFieldsContext } from "../types";
import type { ResourceCommandMap } from "@/hooks/resources/page/use-resource-commands";
import type {
  ResourceUploadDefinition,
  ResourceUploadHandles,
  ResolveImages,
} from "@/hooks/uploads";

export interface ResourceFormFeatureContext<TRecord extends BaseRecord> {
  record?: TRecord;
  id?: string;
  mode: "create" | "edit";
  disabled: boolean;
  pending: boolean;
  uploads: ResourceUploadHandles;
  resolveImages: ResolveImages;
  save: (values: Record<string, unknown>) => Promise<TRecord | false>;
  refreshRecord: () => Promise<TRecord | undefined>;
  getLastError: () => unknown;
  redirectAfterCreate?: (record: TRecord) => void;
}

export type ResourceFormBaseContext<TRecord extends BaseRecord> = Omit<
  ResourceFormFeatureContext<TRecord>,
  "uploads" | "resolveImages"
>;

export interface ResourceFormFeatureState {
  form: unknown;
  isDirty?: boolean;
}

export interface ResourceFormPageDefinition<
  TRecord extends BaseRecord,
  TFeature extends ResourceFormFeatureState = ResourceFormFeatureState,
  TCommands extends ResourceCommandMap<TRecord> = ResourceCommandMap<TRecord>,
> {
  kind: "form";
  resource: string;
  dataProviderName?: string;
  dialog?: {
    title: string;
    canEdit?: (record: TRecord) => boolean;
    getErrorMessage?: (error: unknown) => string;
    onSaved?: (record: TRecord, action: "create" | "edit") => void;
    fields: (context: ResourceFormFieldsContext<TRecord>) => ReactNode;
  };
  page?: {
    title: (mode: "create" | "edit") => string;
    description?: (mode: "create" | "edit") => string | undefined;
    redirectAfterCreate?: "edit" | "list" | false;
    /** Query targets invalidated by Refine after save; omitted uses Refine defaults. */
    invalidates?: Array<"list" | "many" | "detail" | "resourceAll">;
    uploads?: Record<string, ResourceUploadDefinition>;
    canEdit?: (record: TRecord) => boolean;
    getErrorMessage?: (error: unknown) => string;
    commands?: TCommands;
    useFeatureForm: (context: ResourceFormFeatureContext<TRecord>) => TFeature;
    Content: ComponentType;
    Fields?: ComponentType;
  };
}

export interface ResourceDetailsPageDefinition<
  TRecord extends BaseRecord,
  TCommands extends ResourceCommandMap<TRecord> = ResourceCommandMap<TRecord>,
> {
  kind: "details";
  resource: string;
  dataProviderName: string;
  title: string;
  description?: string;
  commands: TCommands;
  Content: ComponentType;
}

export type ResourcePageDefinition<TRecord extends BaseRecord = BaseRecord> =
  | ResourceFormPageDefinition<TRecord, { form: unknown }>
  | ResourceDetailsPageDefinition<TRecord>;

export type BoundResourcePage<
  TRecord extends BaseRecord = BaseRecord,
  TCommandKey extends string = string,
> = {
    Page: ComponentType<{ id?: string }>;
    Fields: ComponentType;
    Footer: ComponentType<{
      onCancel?: () => void;
      saveLabel?: string;
      showCancel?: boolean;
      disabled?: boolean;
      className?: string;
    }>;
    DirtyGuard: ComponentType;
    Action: ComponentType<{ name: TCommandKey; children?: ReactNode }>;
    ActionMenuItem: ComponentType<{ name: TCommandKey; children?: ReactNode }>;
    CommandDialogs: ComponentType;
  };

export type ResourcePageFactory<
  TRecord extends BaseRecord = BaseRecord,
  TFeature extends { form: unknown } = { form: unknown },
  TCommands extends ResourceCommandMap<TRecord> = ResourceCommandMap<TRecord>,
> =
  | (ResourceFormPageDefinition<TRecord, TFeature, TCommands> & BoundResourcePage<TRecord, keyof TCommands & string>)
  | (ResourceDetailsPageDefinition<TRecord, TCommands> & BoundResourcePage<TRecord, keyof TCommands & string>);
export type ResourceFormFactory<
  TRecord extends BaseRecord = BaseRecord,
  TFeature extends { form: unknown } = { form: unknown },
  TCommands extends ResourceCommandMap<TRecord> = ResourceCommandMap<TRecord>,
> = ResourceFormPageDefinition<TRecord, TFeature, TCommands> & BoundResourcePage<TRecord, keyof TCommands & string>;

export type ResourcePageFeature = { form: unknown; [key: string]: unknown };
export type ResourceDialogFeature<TRecord extends BaseRecord> =
  ResourceFormDialogContext<TRecord>;

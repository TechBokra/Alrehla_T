import type {
  CloudinaryUploadResult,
  UploadAdapter,
  UploadItem,
  Uploader,
} from "@uploadcn/core";

export interface ResourceUploadDefinition {
  folder: string;
  accept: string;
  maxSize: number;
  maxFiles: number;
}

export type ImageUploadSelection =
  | { kind: "saved"; url: string }
  | { kind: "queued"; uploadId: string; name: string };

export interface ResourceUploadHandle {
  adapter?: UploadAdapter<CloudinaryUploadResult>;
  uploader: Uploader<CloudinaryUploadResult>;
  items: readonly UploadItem<CloudinaryUploadResult>[];
  allowed: boolean;
  accessPending: boolean;
  failed: boolean;
  uploading: boolean;
  /** Upload IDs started by the current save operation; queued files stay idle before save. */
  uploadingIds: ReadonlySet<string>;
  resolve: (ids: readonly string[]) => Promise<CloudinaryUploadResult[]>;
  clearCompleted: () => void;
}

export type ResourceUploadHandles = Record<string, ResourceUploadHandle>;
export type ImageSource = string | { url: string };
export type ResolveImages = (
  slot: string,
  images: readonly ImageUploadSelection[],
) => Promise<string[]>;


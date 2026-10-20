export type AttachmentResourceType = 'image' | 'raw';
export type AttachmentCleanupResourceType = AttachmentResourceType | 'video';

export type UploadTicket = {
  intentId: string;
  expiresAt: string;
  uploadUrl: string;
  fields: Record<string, string>;
};

export type UploadTarget = {
  intentId: string;
  /** Value sent as Cloudinary's public_id; folder is sent separately. */
  publicId: string;
  folder: string;
  tag: string;
  resourceType: AttachmentResourceType;
  extensions: string[];
};

export type StoredAttachmentAsset = {
  publicId: string;
  resourceType: string;
  deliveryType: string;
  folder: string;
  format: string;
  bytes: number;
  tags: string[];
};

export type StorageLocator = {
  public_id: string;
  resource_type: AttachmentCleanupResourceType;
  type: 'authenticated';
  folder?: string;
  tag?: string;
};

export type DeleteAssetResult = 'deleted' | 'not_found';

/** Provider-neutral boundary used by the attachment domain and server actions. */
export interface AttachmentStorageProvider {
  readonly name: string;
  isConfigured(): boolean;
  createUploadTicket(target: UploadTarget): UploadTicket['fields'] | null;
  uploadUrl(resourceType: AttachmentResourceType): string | null;
  getAsset(locator: StorageLocator): Promise<StoredAttachmentAsset | null>;
  createDownloadUrl(locator: StorageLocator, format: string | null): string | null;
  deleteAsset(locator: StorageLocator): Promise<DeleteAssetResult>;
  findAssetsByIntentTag(tag: string): Promise<Array<{ publicId: string; resourceType: AttachmentCleanupResourceType }>>;
}

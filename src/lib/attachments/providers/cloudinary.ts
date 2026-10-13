import 'server-only';

import { v2 as cloudinary } from 'cloudinary';
import type {
  AttachmentResourceType,
  AttachmentCleanupResourceType,
  AttachmentStorageProvider,
  DeleteAssetResult,
  StorageLocator,
  StoredAttachmentAsset,
  UploadTarget,
} from '../types';
const TIME_TO_EXP = Math.floor(Date.now() / 1000);
function credentials() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
}

function asResourceType(value: string): AttachmentCleanupResourceType | null {
  return value === 'image' || value === 'raw' || value === 'video' ? value : null;
}

export const cloudinaryAttachmentProvider: AttachmentStorageProvider = {
  name: 'cloudinary',

  isConfigured() {
    return Boolean(
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
    );
  },

  createUploadTicket(target: UploadTarget) {
    const config = credentials();
    if (!config) return null;
    const params = {
      allowed_formats: target.extensions.join(','),
      folder: target.folder,
      overwrite: false,
      public_id: target.publicId,
      tags: target.tag,
      timestamp:TIME_TO_EXP,
      type: 'authenticated',
    };
    const signature = cloudinary.utils.api_sign_request(params, config.apiSecret);
    return {
      api_key: config.apiKey,
      allowed_formats: params.allowed_formats,
      folder: params.folder,
      overwrite: 'false',
      public_id: params.public_id,
      signature,
      tags: params.tags,
      timestamp: String(TIME_TO_EXP),
      type: params.type,
    };
  },

  uploadUrl(resourceType: AttachmentResourceType) {
    const config = credentials();
    if (!config) return null;
    return `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`;
  },

  async getAsset(locator: StorageLocator): Promise<StoredAttachmentAsset | null> {
    if (!credentials()) throw new Error('Cloudinary private-file credentials are missing');
    try {
      const asset = await cloudinary.api.resource(locator.public_id, {
        resource_type: locator.resource_type,
        type: locator.type,
        timeout: 10_000,
      });
      const publicId = String(asset.public_id ?? '');
      return {
        publicId,
        resourceType: String(asset.resource_type ?? ''),
        deliveryType: String(asset.type ?? ''),
        // Public-ID paths are stable in both Cloudinary folder modes. A
        // Media Library folder can move without changing the asset identity.
        folder: publicId.slice(0, Math.max(0, publicId.lastIndexOf('/'))),
        format: String(asset.format || (asset.resource_type === 'raw'
          ? publicId.match(/\.([a-z0-9]+)$/i)?.[1] ?? '' : '')).toLowerCase(),
        bytes: Number(asset.bytes ?? 0),
        tags: Array.isArray(asset.tags) ? asset.tags.map(String) : [],
      };
    } catch (error) {
      const status = (error as { http_code?: number; error?: { http_code?: number } })?.http_code
        ?? (error as { error?: { http_code?: number } })?.error?.http_code;
      if (status === 404) return null;
      throw error;
    }
  },

  createDownloadUrl(locator: StorageLocator, format: string | null) {
    if (!credentials()) return null;
    return cloudinary.utils.private_download_url(locator.public_id, format ?? '', {
      resource_type: locator.resource_type,
      type: locator.type,
      expires_at: TIME_TO_EXP + 10 * 60,
      attachment: true,
    });
  },

  async deleteAsset(locator: StorageLocator): Promise<DeleteAssetResult> {
    if (!credentials()) throw new Error('Cloudinary private-file credentials are missing');
    const options = {
      resource_type: locator.resource_type,
      type: locator.type,
      invalidate: true,
      timeout: 10_000,
    };
    const result = await cloudinary.uploader.destroy(locator.public_id, options);
    // Upload API destroy confirms one asset with "ok" (the Admin bulk API
    // uses "deleted"). Neither means a bare HTTP-success response.
    if (result?.result === 'ok' || result?.result === 'deleted') return 'deleted';
    if (result?.result === 'not found' || result?.result === 'not_found') return 'not_found';
    throw new Error(`Cloudinary did not confirm deletion: ${String(result?.result ?? 'unknown result')}`);
  },

  async findAssetsByIntentTag(tag: string) {
    if (!credentials()) throw new Error('Cloudinary private-file credentials are missing');
    const results = await Promise.all(
      (['image', 'raw', 'video'] as const).map(async (resourceType) => {
        const assets: Array<{ publicId: string; resourceType: AttachmentCleanupResourceType }> = [];
        const cursors = new Set<string>();
        let cursor: string | undefined;
        do {
          const response = await cloudinary.api.resources_by_tag(tag, {
            resource_type: resourceType,
            max_results: 100,
            next_cursor: cursor,
            timeout: 10_000,
          });
          // resources_by_tag spans delivery types; the SDK ignores a type
          // option here. Only our authenticated assets belong to this flow.
          for (const asset of response.resources ?? []) {
            const actualType = asResourceType(String(asset.resource_type ?? resourceType));
            if (asset.type === 'authenticated' && asset.public_id && actualType) {
              assets.push({ publicId: String(asset.public_id), resourceType: actualType });
            }
          }
          cursor = response.next_cursor;
          if (cursor && cursors.has(cursor)) throw new Error('Cloudinary returned a repeated asset cursor');
          if (cursor) cursors.add(cursor);
        } while (cursor);
        return assets;
      }),
    );
    return results.flat();
  },
};

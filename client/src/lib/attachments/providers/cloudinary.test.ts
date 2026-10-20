import { afterEach, describe, expect, it, vi } from 'vitest';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryAttachmentProvider } from './cloudinary';

const oldEnv = {
  cloud: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY,
  secret: process.env.CLOUDINARY_API_SECRET,
};

afterEach(() => {
  vi.restoreAllMocks();
  if (oldEnv.cloud === undefined) delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  else process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = oldEnv.cloud;
  if (oldEnv.key === undefined) delete process.env.CLOUDINARY_API_KEY;
  else process.env.CLOUDINARY_API_KEY = oldEnv.key;
  if (oldEnv.secret === undefined) delete process.env.CLOUDINARY_API_SECRET;
  else process.env.CLOUDINARY_API_SECRET = oldEnv.secret;
});

describe('Cloudinary private attachment provider', () => {
  it('issues fresh signed upload timestamps after hours of server uptime', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_123);
    const sign = vi.spyOn(cloudinary.utils, 'api_sign_request').mockReturnValue('signature');
    const target = {
      intentId: 'intent-1', publicId: 'intent-1.pdf',
      folder: 'alrehla/private/orders/order-1', tag: 'intent-tag',
      resourceType: 'raw' as const, extensions: ['pdf'],
    };
    expect(cloudinaryAttachmentProvider.createUploadTicket(target)?.timestamp).toBe('1800000000');
    now.mockReturnValue(1_800_007_200_999);
    const ticket = cloudinaryAttachmentProvider.createUploadTicket(target);
    expect(ticket?.timestamp).toBe('1800007200');
    expect(sign).toHaveBeenLastCalledWith(expect.objectContaining({ timestamp: 1_800_007_200 }), 'test-secret');
  });

  it('gives each download link ten minutes from the current request time', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_123);
    const download = vi.spyOn(cloudinary.utils, 'private_download_url').mockReturnValue('signed-url');
    const locator = { public_id: 'private/file.pdf', resource_type: 'raw' as const, type: 'authenticated' as const };
    cloudinaryAttachmentProvider.createDownloadUrl(locator, 'pdf');
    expect(download).toHaveBeenLastCalledWith(locator.public_id, 'pdf', expect.objectContaining({ expires_at: 1_800_000_600 }));
    now.mockReturnValue(1_800_007_200_999);
    cloudinaryAttachmentProvider.createDownloadUrl(locator, 'pdf');
    expect(download).toHaveBeenLastCalledWith(locator.public_id, 'pdf', expect.objectContaining({ expires_at: 1_800_007_800 }));
  });

  it('signs the exact reserved destination and private upload fields', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    const sign = vi.spyOn(cloudinary.utils, 'api_sign_request').mockReturnValue('signed-value');
    const target = {
      intentId: 'intent-1',
      publicId: 'intent-1.pdf',
      folder: 'alrehla/private/orders/order-1',
      tag: 'private-file-intent-intent-1',
      resourceType: 'raw' as const,
      extensions: ['pdf'],
    };

    const fields = cloudinaryAttachmentProvider.createUploadTicket(target);

    expect(sign).toHaveBeenCalledWith(expect.objectContaining({
      allowed_formats: 'pdf',
      folder: target.folder,
      overwrite: false,
      public_id: target.publicId,
      tags: target.tag,
      type: 'authenticated',
    }), 'test-secret');
    expect(fields).toMatchObject({
      api_key: 'test-key',
      allowed_formats: 'pdf',
      folder: target.folder,
      overwrite: 'false',
      public_id: target.publicId,
      signature: 'signed-value',
      tags: target.tag,
      type: 'authenticated',
    });
    expect(fields).not.toHaveProperty('api_secret');
    expect(cloudinaryAttachmentProvider.uploadUrl('raw')).toBe(
      'https://api.cloudinary.com/v1_1/test-cloud/raw/upload',
    );
  });

  it('accepts only provider-confirmed per-asset deletion results', async () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    vi.spyOn(cloudinary.uploader, 'destroy')
      .mockResolvedValueOnce({ result: 'ok' } as never)
      .mockResolvedValueOnce({ result: 'not found' } as never);

    const locator = {
      public_id: 'alrehla/private/orders/order-1/intent-1',
      resource_type: 'image' as const,
      type: 'authenticated' as const,
    };
    await expect(cloudinaryAttachmentProvider.deleteAsset(locator)).resolves.toBe('deleted');
    await expect(cloudinaryAttachmentProvider.deleteAsset(locator)).resolves.toBe('not_found');
  });

  it('does not mistake an unconfirmed response for a completed deletion', async () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'pending' } as never);
    await expect(cloudinaryAttachmentProvider.deleteAsset({
      public_id: 'private/file', resource_type: 'image', type: 'authenticated',
    })).rejects.toThrow('did not confirm deletion');
  });

  it('normalizes raw metadata without relying on a Media Library folder field', async () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    vi.spyOn(cloudinary.api, 'resource').mockResolvedValue({
      public_id: 'private/order/intent.pdf', resource_type: 'raw', type: 'authenticated',
      asset_folder: 'moved-folder', bytes: 200, tags: ['intent-tag'],
    } as never);
    await expect(cloudinaryAttachmentProvider.getAsset({
      public_id: 'private/order/intent.pdf', resource_type: 'raw', type: 'authenticated',
    })).resolves.toMatchObject({ folder: 'private/order', format: 'pdf', bytes: 200 });
  });

  it('reads every tag page across resource types and filters public assets', async () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    const list = vi.spyOn(cloudinary.api, 'resources_by_tag').mockImplementation(async (_tag, options) => {
      const opts = options as unknown as { resource_type: string; next_cursor?: string };
      if (opts.resource_type === 'image' && !opts.next_cursor) {
        return { resources: [{ public_id: 'public', type: 'upload', resource_type: 'image' }], next_cursor: 'next' } as never;
      }
      if (opts.resource_type === 'image') {
        return { resources: [{ public_id: 'private/extra', type: 'authenticated', resource_type: 'image' }] } as never;
      }
      return { resources: [] } as never;
    });
    await expect(cloudinaryAttachmentProvider.findAssetsByIntentTag('intent-tag')).resolves.toEqual([
      { publicId: 'private/extra', resourceType: 'image' },
    ]);
    expect(list).toHaveBeenCalledWith('intent-tag', expect.objectContaining({ next_cursor: 'next' }));
    expect(list).toHaveBeenCalledWith('intent-tag', expect.objectContaining({ resource_type: 'video' }));
  });
});

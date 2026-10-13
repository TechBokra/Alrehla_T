import 'server-only';

import { cloudinaryAttachmentProvider } from './providers/cloudinary';
import type { AttachmentStorageProvider } from './types';

/** Provider selection stays at the infrastructure edge; domains use only this contract. */
export function getAttachmentStorageProvider(): AttachmentStorageProvider {
  const provider = process.env.PRIVATE_FILE_STORAGE_PROVIDER ?? 'cloudinary';
  if (provider !== 'cloudinary') throw new Error(`Unsupported private-file storage provider: ${provider}`);
  return cloudinaryAttachmentProvider;
}

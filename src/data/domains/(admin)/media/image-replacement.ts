import 'server-only';
import { publicIdFromUrl, deleteAssets } from '@/lib/cloudinary-admin';
import { getMediaScan } from './queries';

/** Called only with previous references read from an authorized database write. */
export async function cleanupReplacedImages(urls: (string | null | undefined)[]): Promise<void> {
  try {
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const ids = [...new Set(urls.flatMap((url) => {
      if (!url || !cloud) return [];
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' ||
          !parsed.pathname.startsWith(`/${cloud}/image/upload/`)) return [];
      const id = publicIdFromUrl(url);
      return id && /^(alrehla\/avatars\/|alrehla\/instructors\/(works|covers)\/)/.test(id) ? [id] : [];
    }))];
    if (!ids.length) return;
    const scan = await getMediaScan();
    if (!scan.complete) return;
    const unused = ids.filter((id) => !scan.usage.has(id));
    if (!unused.length) return;
    const result = await deleteAssets(unused);
    if (!result.ok || unused.some((id) => !result.data.deleted.includes(id))) {
      console.error('Image replacement cleanup pending; daily media scan will retry', result);
    }
  } catch (error) {
    // Saving the replacement succeeded. The daily media scan discovers old assets.
    console.error('Image replacement cleanup pending', error);
  }
}

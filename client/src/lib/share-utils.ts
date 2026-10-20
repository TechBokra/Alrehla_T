import { SITE_URL } from '@/lib/site-url';

/**
 * أدوات وروابط المشاركة لمنصة الرحلة
 */

export interface ShareData {
  title: string;
  description?: string;
  url: string; // الرابط النسبي أو الكامل
  shortPath?: string; // المسار المختصر مثل /s/b/123
}

/**
 * الحصول على الرابط الكامل والمختصر للبيئة الحالية
 */
export function resolveShareUrls(data: ShareData): { fullUrl: string; shortUrl: string } {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : SITE_URL;

  const fullUrl = data.url.startsWith('http') ? data.url : `${origin}${data.url}`;
  const shortUrl = data.shortPath
    ? data.shortPath.startsWith('http')
      ? data.shortPath
      : `${origin}${data.shortPath}`
    : fullUrl;

  return { fullUrl, shortUrl };
}

/**
 * إنشاء رابط مشاركة واتساب
 */
export function getWhatsAppShareUrl(title: string, shareUrl: string, description?: string): string {
  const parts = [title];
  if (description) {
    const trimmed = description.trim().slice(0, 100);
    parts.push(trimmed);
  }
  parts.push(shareUrl);
  const text = parts.join('\n\n');
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * إنشاء رابط مشاركة X (تويتر)
 */
export function getTwitterShareUrl(title: string, shareUrl: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`;
}

/**
 * إنشاء رابط مشاركة فيسبوك
 */
export function getFacebookShareUrl(shareUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
}

/**
 * إنشاء رابط مشاركة تيليجرام
 */
export function getTelegramShareUrl(title: string, shareUrl: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`;
}

/**
 * نسخ النص إلى الحافظة بأمان
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API failed, trying fallback:', err);
  }

  // Fallback for older contexts
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

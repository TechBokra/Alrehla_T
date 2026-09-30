'use client';

import { useEffect } from 'react';
import { isProtectedMedia } from '@/lib/image-guard';

/**
 * بيقفل «حفظ الصورة» في **الموقع كله** — قرار تامر: التحميل مش مسموح.
 *
 * ⚠️ **ده ردع لا حماية** — التفصيل في `lib/image-guard.ts`. لقطة
 *    الشاشة مستحيل تتمنع.
 *
 * ── ليه مستمع واحد على الصفحة مش خاصية على كل صورة ──────────
 *
 * الصور في الموقع جاية من أكتر من ١٥ مكوّن، وبعضها بيترسم جوّه
 * نوافذ بتفتح وتقفل (تكبير صورة المنتج). خاصية على كل صورة معناها إن
 * أول مكوّن جديد ينساها يبقى الثغرة — درس ٢٠ بالحرف. مستمع واحد على
 * `document` بيمسك أي صورة، حتى اللي لسه ماتكتبتش.
 *
 * ⚠️ **و`capture: true`**: المستمع بيشتغل قبل أي مكوّن تاني، فمكوّن
 *    بيوقف انتشار الحدث (`stopPropagation`) مايقدرش يعدّيه.
 *
 * ── وليه الضغط الطويل على الموبايل بيتقفل من هنا ─────────────
 *
 * أندرويد بيبعت نفس حدث الضغط يمين (`contextmenu`) مع الضغط الطويل،
 * فنفس السطر بيقفله. آيفون مابيبعتوش — وده متقفل من CSS
 * (`-webkit-touch-callout: none` في `globals.css`).
 */
export function ImageGuard() {
  useEffect(() => {
    const block = (event: Event) => {
      if (isProtectedMedia(event.target as Element)) event.preventDefault();
    };
    document.addEventListener('contextmenu', block, { capture: true });
    document.addEventListener('dragstart', block, { capture: true });
    return () => {
      document.removeEventListener('contextmenu', block, { capture: true });
      document.removeEventListener('dragstart', block, { capture: true });
    };
  }, []);

  return null;
}

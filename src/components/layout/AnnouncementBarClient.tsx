'use client';

import React from 'react';
import { Megaphone, X } from 'lucide-react';

/**
 * الزائر يقدر يقفل الشريط.
 *
 * القفل بيتخزّن في المتصفح ومربوط بنص التنبيه نفسه: لو غيّرت النص،
 * الشريط بيرجع يظهر لكل اللي قفلوه — وده المطلوب، لأنه تنبيه جديد.
 */
export function AnnouncementBarClient({ text }: { text: string }) {
  const [dismissed, setDismissed] = React.useState(false);

  // بصمة قصيرة للنص عشان ما نخزّنش النص كامل في المتصفح.
  const signature = React.useMemo(() => {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return `alr-announcement-${hash}`;
  }, [text]);

  React.useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(signature) === '1');
    } catch {
      // متصفح بيمنع التخزين — الشريط بيفضل ظاهر، وده أأمن من إخفائه.
    }
  }, [signature]);

  if (dismissed) return null;

  return (
    <div className="relative z-40 bg-slate-900 px-4 py-2.5 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Megaphone className="h-4 w-4 shrink-0 text-amber-300" />
        <p className="flex-1 text-sm font-bold">{text}</p>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(signature, '1');
            } catch {
              // مش مشكلة — الشريط هيرجع في الزيارة الجاية.
            }
          }}
          aria-label="إغلاق التنبيه"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

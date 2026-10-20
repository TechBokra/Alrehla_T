'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { User, Upload } from 'lucide-react';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { uploadImage } from '@/lib/upload-client';
import { useImageSelection } from '@/lib/use-image-selection';

/**
 * Choosing a profile or logo image.
 *
 * The old form had "تغيير الصورة" and "حذف" buttons with no handlers on
 * either — the picture could never be changed from inside the site.
 */
export function AvatarPicker({
  value,
  onChange,
  onError,
  label,
  folder,
  onFileChange,
  disabled = false,
  rounded = 'full',
}: {
  value: string;
  onChange: (url: string) => void;
  onError: (message: string) => void;
  label: string;
  folder: string;
  /** Select locally; the parent uploads only when submitting. */
  onFileChange?: (file: File | null) => void;
  rounded?: 'full' | 'xl';
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const { selection, select } = useImageSelection();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (onFileChange) {
      try {
        select(file);
        onFileChange(file);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'تعذّر اختيار الصورة');
      }
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadImage(file, folder);
      onChange(uploaded.url);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div
        className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-4 border-slate-100 bg-slate-50 shadow-sm ${
          rounded === 'full' ? 'rounded-full' : 'rounded-2xl'
        }`}
      >
        {selection || value ? (
          <Image
            src={selection?.preview ?? optimizedImageUrl(value, 200)}
            unoptimized={Boolean(selection)}
            alt={label}
            fill sizes="96px"
            className="object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <User className="h-10 w-10 text-slate-300" />
        )}
      </div>

      <div className="pt-2 text-center sm:text-right">
        <h3 className="text-lg font-bold text-slate-800">{label}</h3>
        <p className="mt-1 text-sm font-medium text-slate-500">
          يُفضل صورة مربعة واضحة، بحد أقصى 10 ميجابايت.
        </p>
        <div className="mt-4 flex justify-center gap-2 sm:justify-start">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">
            <Upload className="h-4 w-4" />
            {uploading ? 'جارٍ الرفع…' : 'تغيير الصورة'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled || uploading}
              onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }}
            />
          </label>
          {(selection || value) && (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => { select(null); onFileChange?.(null); onChange(''); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
            >
              حذف
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

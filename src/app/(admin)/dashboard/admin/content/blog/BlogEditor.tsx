'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, Trash2, Upload, Eye } from 'lucide-react';
import type { BlogPost } from '@/types';
import { saveBlogPost, deleteBlogPost } from '@/actions/blog';
import { uploadImage, optimizedImageUrl } from '@/lib/cloudinary';

const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

/**
 * Writing a post.
 *
 * The previous editor showed sample text instead of the article and its save
 * button did nothing, so the blog could only ever be changed in the database.
 */
export function BlogEditor({ post }: { post: BlogPost | null }) {
  const router = useRouter();
  const isDraft = post ? new Date(post.publishedAt) > new Date() : false;

  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(post?.coverImageUrl ?? '');
  const [authorName, setAuthorName] = useState(post?.authorName ?? 'فريق الرحلة');
  const [isPublished, setIsPublished] = useState(post ? !isDraft : false);

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const result = await saveBlogPost(post?.id ?? null, {
        title,
        slug,
        excerpt,
        content,
        coverImageUrl,
        authorName,
        isPublished,
        publishedAt: post?.publishedAt ?? '',
      });
      setSaved(true);
      if (!post) router.push(`/dashboard/admin/content/blog/${result.id}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ المقال');
    } finally {
      setBusy(false);
    }
  };

  const onPickCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await uploadImage(file, 'alrehla/blog');
      setCoverImageUrl(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <Check className="h-4 w-4" /> تم الحفظ.
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">عنوان المقال</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            الرابط (يُولَّد من العنوان إذا تُرك فارغًا)
          </label>
          <input
            className={inputClass}
            dir="ltr"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="how-to-encourage-reading"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">المقتطف</label>
          <textarea
            rows={2}
            className={inputClass}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">المحتوى</label>
          <textarea
            rows={16}
            className={inputClass}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="mt-2 text-xs font-medium text-slate-500">
            النص يظهر للقارئ كما تكتبه، بفقراته وأسطره.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">اسم الكاتب</label>
            <input
              className={inputClass}
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">صورة الغلاف</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                {uploading ? 'جارٍ الرفع…' : 'اختر صورة'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickCover(e.target.files?.[0])}
                />
              </label>
              {coverImageUrl && (
                <div className="relative h-14 w-20 overflow-hidden rounded-lg border border-slate-200">
                  <Image
                    src={optimizedImageUrl(coverImageUrl, 200)}
                    alt="غلاف المقال"
                    fill sizes="(max-width: 768px) 100vw, 480px"
                    className="object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-bold text-slate-700">مقال منشور (ظاهر للزوار)</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <div className="flex gap-2">
            {post && (
              <>
                <a
                  href={`/blog/${post.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4" /> معاينة
                </a>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirmDelete) void deleteBlogPost(post.id);
                    else setConfirmDelete(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {confirmDelete ? 'اضغط مرة أخرى للحذف' : 'حذف'}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={busy || uploading}
            className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'جارٍ الحفظ…' : 'حفظ المقال'}
          </button>
        </div>
      </div>
    </div>
  );
}

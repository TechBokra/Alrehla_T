'use client';
import { useNow } from '@/components/providers/ClientTimeProvider';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, Trash2, Upload, Eye } from 'lucide-react';
import type { BlogPost } from '@/types';
import { saveBlogPost, deleteBlogPost } from '@/actions/blog';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { uploadImage } from '@/lib/upload-client';
import { LibraryPicker } from '@/components/dashboard/LibraryPicker';
import { Field, TextInput, TextArea, Checkbox, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

const UNEXPECTED = 'حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.';

/**
 * Writing a post.
 *
 * The previous editor showed sample text instead of the article and its save
 * button did nothing, so the blog could only ever be changed in the database.
 */
export function BlogEditor({ post }: { post: BlogPost | null }) {
  const router = useRouter();
  const now = useNow();
  const isDraft = post ? new Date(post.publishedAt).getTime() > now : false;

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
  // الخانة اللي عليها الخطأ (لو الخادم حدّدها) — الرسالة بتظهر تحتها.
  const [errorField, setErrorField] = useState<string | undefined>();
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    setErrorField(undefined);
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
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
        return;
      }
      setSaved(true);
      if (!post) router.push(`/dashboard/admin/content/blog/${result.id}`);
      else router.refresh();
    } catch {
      setError(UNEXPECTED);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!post) return;
    setDeleting(true);
    setError('');
    setErrorField(undefined);
    try {
      // بعد النجاح الخادم بيحوّل لقايمة المقالات — فمفيش نتيجة غير لو فشل.
      const result = await deleteBlogPost(post.id);
      if (result && !result.ok) setError(result.error);
    } catch (err) {
      // تحويلات Next (`redirect`) بتيجي كاستثناء — لازم تعدّي.
      if ((err as { digest?: string } | null)?.digest?.startsWith('NEXT_')) throw err;
      setError(UNEXPECTED);
    } finally {
      setDeleting(false);
    }
  };

  const err = (f: string) => (errorField === f ? error : undefined);

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
      {!errorField && <FormError message={error} className="mb-6" />}
      {saved && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <Check className="h-4 w-4" /> تم الحفظ.
        </div>
      )}

      <div className="space-y-6">
        <Field label="عنوان المقال" name="title" required error={err('title')}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <Field label="الرابط (يُولَّد من العنوان إذا تُرك فارغًا)" name="slug" error={err('slug')}>
          <TextInput
            dir="ltr"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="how-to-encourage-reading"
          />
        </Field>

        <Field label="المقتطف" name="excerpt">
          <TextArea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </Field>

        <Field
          label="المحتوى"
          name="content"
          required
          hint="النص يظهر للقارئ كما تكتبه، بفقراته وأسطره."
          error={err('content')}
        >
          <TextArea rows={16} value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="اسم الكاتب" name="authorName">
            <TextInput value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
          </Field>

          {/* رفع الصورة/المكتبة مش خانة نص — فعنوانها مكتوب بإيدنا. */}
          <div>
            <p className="mb-2 block text-sm font-bold text-slate-700">صورة الغلاف</p>
            <div className="flex flex-wrap items-center gap-3">
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
              <LibraryPicker onPick={setCoverImageUrl} disabled={uploading} />
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

        <Checkbox
          label="مقال منشور (ظاهر للزوار)"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />

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
                <BusyButton
                  variant={confirmDelete ? 'danger' : 'secondary'}
                  busy={deleting}
                  pendingLabel="جارٍ الحذف…"
                  disabled={busy}
                  onClick={() => {
                    if (confirmDelete) void remove();
                    else setConfirmDelete(true);
                  }}
                  className="text-sm"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {confirmDelete ? 'اضغط مرة أخرى للحذف' : 'حذف'}
                </BusyButton>
              </>
            )}
          </div>

          <BusyButton busy={busy} onClick={save} disabled={uploading || deleting} className="px-8">
            حفظ المقال
          </BusyButton>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useNow } from '@/components/providers/ClientTimeProvider';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bold, Check, Eye, Heading1, Heading2, List, Trash2, Upload } from 'lucide-react';
import type { BlogPost } from '@/types';
import { saveBlogPost, deleteBlogPost } from '@/actions/blog';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { uploadImage } from '@/lib/upload-client';
import { LibraryPicker } from '@/components/dashboard/LibraryPicker';
import { Field, TextInput, TextArea, BusyButton, fieldClass } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';
import { RichText } from '@/components/ui/RichText';
import { PUBLISH_MODE_LABELS, postStatus, type PublishMode } from '@/lib/blog-publish';
import {
  HEADING_PREFIX,
  SUBHEADING_PREFIX,
  setHeading,
  toggleBold,
  toggleList,
  type Edit,
} from '@/lib/blog-format';
import { isoToCairoLocal } from '@/lib/promotions';

const UNEXPECTED = 'حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.';

const PUBLISH_OPTIONS: { value: PublishMode; hint: string }[] = [
  { value: 'published', hint: 'يظهر للزوار فورًا.' },
  { value: 'scheduled', hint: 'يظهر تلقائيًا في الموعد اللي تحدده.' },
  { value: 'draft', hint: 'محفوظ عندك ومخفي عن الزوار.' },
];

const TOOLBAR_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold ' +
  'text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none';

/**
 * Writing a post.
 *
 * The previous editor showed sample text instead of the article and its save
 * button did nothing, so the blog could only ever be changed in the database.
 */
export function BlogEditor({ post }: { post: BlogPost | null }) {
  const router = useRouter();
  const now = useNow();
  // الحالة المحفوظة فعلًا (منشور/مجدول/مسودة). المقال الجديد بيبدأ «منشور»
  // — كان بيبدأ مسودة، واللي ما يعلّمش على الخانة كان يحفظ مسودة من غير ما يدري.
  const savedStatus = post ? postStatus(post, new Date(now)) : null;

  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(post?.coverImageUrl ?? '');
  const [authorName, setAuthorName] = useState(post?.authorName ?? 'فريق الرحلة');
  const [publishMode, setPublishMode] = useState<PublishMode>(savedStatus ?? 'published');
  const [scheduledAt, setScheduledAt] = useState(
    post && savedStatus === 'scheduled' ? isoToCairoLocal(post.publishedAt) : '',
  );
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const contentRef = useRef<HTMLTextAreaElement>(null);

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
        seoDescription,
        content,
        coverImageUrl,
        authorName,
        publishMode,
        scheduledAt,
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

  const savedMessage =
    publishMode === 'published'
      ? 'تم الحفظ — المقال ظاهر للزوار.'
      : publishMode === 'scheduled'
        ? `تم الحفظ — سيظهر للزوار في ${scheduledAt.replace('T', ' ')} (بتوقيت القاهرة).`
        : 'تم حفظ المسودة — غير ظاهرة للزوار.';

  const saveLabel =
    publishMode === 'published'
      ? savedStatus === 'published'
        ? 'حفظ التعديلات'
        : 'نشر المقال'
      : publishMode === 'scheduled'
        ? 'جدولة المقال'
        : 'حفظ كمسودة';

  /** يطبّق تعديل تنسيق على النص ويرجّع التحديد في مكانه الصحيح. */
  const applyFormat = (edit: (text: string, start: number, end: number) => Edit) => {
    const el = contentRef.current;
    if (!el) return;
    const next = edit(content, el.selectionStart, el.selectionEnd);
    setContent(next.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
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
      {!errorField && <FormError message={error} className="mb-6" />}
      {saved && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <Check className="h-4 w-4" /> {savedMessage}
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

        <Field
          label="المقتطف"
          name="excerpt"
          hint="بيظهر للقارئ في بطاقة المقال داخل المدونة — مش في صفحة المقال نفسها."
        >
          <TextArea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </Field>

        <Field
          label="وصف محركات البحث (SEO)"
          name="seoDescription"
          hint="اللي بيظهر في جوجل وفي معاينة الرابط على واتساب وفيسبوك. سيبه فاضي عشان يستعمل المقتطف. الأفضل بين 120 و160 حرفًا."
        >
          <TextArea
            rows={2}
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            maxLength={200}
          />
        </Field>

        {/* المحتوى: أزرار تنسيق + معاينة. بيتخزّن نص عادي بعلامات بسيطة
            (# و## و** و-) بيعرضها `RichText` عناصر حقيقية — مفيش HTML. */}
        <div data-field="content">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="blog-content" className="block text-sm font-bold text-slate-700">
              المحتوى <span className="mr-1 text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="طريقة العرض">
              {(['write', 'preview'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                    tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'write' ? 'كتابة' : 'معاينة'}
                </button>
              ))}
            </div>
          </div>

          {tab === 'write' ? (
            <>
              <div className="mb-2 flex flex-wrap gap-2" role="toolbar" aria-label="تنسيق النص">
                <button type="button" className={TOOLBAR_BUTTON} onClick={() => applyFormat((t, start) => setHeading(t, start, HEADING_PREFIX))}>
                  <Heading1 className="h-4 w-4" aria-hidden="true" /> عنوان
                </button>
                <button type="button" className={TOOLBAR_BUTTON} onClick={() => applyFormat((t, start) => setHeading(t, start, SUBHEADING_PREFIX))}>
                  <Heading2 className="h-4 w-4" aria-hidden="true" /> عنوان فرعي
                </button>
                <button type="button" className={TOOLBAR_BUTTON} onClick={() => applyFormat(toggleBold)} title="Ctrl + B">
                  <Bold className="h-4 w-4" aria-hidden="true" /> عريض
                </button>
                <button type="button" className={TOOLBAR_BUTTON} onClick={() => applyFormat(toggleList)}>
                  <List className="h-4 w-4" aria-hidden="true" /> قائمة
                </button>
              </div>
              <textarea
                id="blog-content"
                ref={contentRef}
                rows={18}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyB') {
                    e.preventDefault();
                    applyFormat(toggleBold);
                  }
                }}
                aria-invalid={errorField === 'content' || undefined}
                aria-describedby="blog-content-hint"
                className={`${fieldClass} leading-loose`}
              />
            </>
          ) : (
            <div className="min-h-[18rem] rounded-xl border border-slate-200 bg-white p-6">
              {content.trim() ? (
                <RichText value={content} className="space-y-6 leading-loose text-slate-700" />
              ) : (
                <p className="text-sm font-medium text-slate-400">لا يوجد محتوى بعد.</p>
              )}
            </div>
          )}

          <p id="blog-content-hint" className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
            اكتب كالمعتاد، وحدّد الكلمة أو السطر واضغط الزر المناسب. الأزرار تضيف علامات بسيطة
            ({'#'} عنوان، {'##'} عنوان فرعي، {'**'}نص{'**'} عريض، {'-'} قائمة) وتقدر تكتبها بإيدك.
            زر «معاينة» يوريك الشكل اللي هيشوفه القارئ.
          </p>
          {err('content') && <p className="mt-2 text-xs font-bold text-red-600">{err('content')}</p>}
        </div>

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

        <fieldset>
          <legend className="mb-2 block text-sm font-bold text-slate-700">حالة النشر</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {PUBLISH_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  publishMode === o.value ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="publishMode"
                  value={o.value}
                  checked={publishMode === o.value}
                  onChange={() => setPublishMode(o.value)}
                  className="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block font-bold text-slate-800">{PUBLISH_MODE_LABELS[o.value]}</span>
                  <span className="block text-xs font-medium text-slate-500">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {savedStatus && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              الحالة الحالية المحفوظة: <strong>{PUBLISH_MODE_LABELS[savedStatus]}</strong>
            </p>
          )}
        </fieldset>

        {publishMode === 'scheduled' && (
          <Field
            label="موعد النشر (بتوقيت القاهرة)"
            name="scheduledAt"
            required
            error={err('scheduledAt')}
            hint="المقال يظهر للزوار تلقائيًا في هذا الموعد، من غير ما تفتح اللوحة. قد يتأخر ظهوره في القوائم عدة دقائق بعد الموعد."
          >
            <TextInput
              type="datetime-local"
              dir="ltr"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </Field>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <div className="flex gap-2">
            {post && (
              <>
                {savedStatus === 'published' && (
                  <a
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" /> عرض المقال
                  </a>
                )}
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
            {saveLabel}
          </BusyButton>
        </div>
      </div>
    </div>
  );
}

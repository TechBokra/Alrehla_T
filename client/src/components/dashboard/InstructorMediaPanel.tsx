'use client';

import React, { useRef, useState } from 'react';
import { uploadImage } from '@/lib/upload-client';
import { parseMediaInput } from '@/lib/instructor-media-input';
import Image from 'next/image';
import { Trash2, Plus } from 'lucide-react';
import { StatusBadge, type StatusBadgeType } from '@/components/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImageField } from '@/components/dashboard/ImageField';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, TextInput, SubmitButton } from '@/components/forms/Form';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { submitInstructorMedia, removeInstructorMedia } from '@/actions/instructor-media';
import type { InstructorMedia } from '@/data/domains/(shared)/instructors/media-types';

/**
 * لوحة المدرب: غلاف البروفايل وصور الأعمال.
 *
 * ── الحالة مش زينة، هي المعلومة ─────────────────────────────
 *
 * ⚠️ **الصورة المعلَّقة لازم تبان إنها معلَّقة.** من غير ده المدرب
 *    بيرفع صورة، بيشوفها في لوحته، وبيفتكر إنها ظاهرة للعملاء —
 *    وبيفضل فاكر كده أسابيع. وده أوحش من إن الرفع يفشل: الفشل
 *    بيتقال، والانتظار الصامت بيتقري غلط.
 *
 * ⚠️ **وسبب الرفض بيتعرض للمدرب.** الرفض بلا سبب بيخلّيه يرفع
 *    نفس الصورة تاني ومحدش مستفيد.
 *
 * ── وتغيير الصورة بيرجّع الموافقة ───────────────────────────
 *
 * مكتوب للمدرب صراحةً إن تعديل صورة معتمدة بيرجّعها للمراجعة.
 * ده سلوك القاعدة (المحفّز في ملف 127)، والشاشة بتقوله بدل ما
 * يكتشفه بنفسه.
 */

/**
 * ⚠️ **الشارة دي كانت مكتوبة محليًّا هنا، واتشالت.**
 *
 * المشروع فيه `StatusBadge` مشتركة مستعملة في **٤١ شاشة**. كتابة
 * نسخة تانية هنا كانت هتخلّي «في انتظار المراجعة» شكلها مختلف عن
 * «بانتظار الدفع» في شاشة الطلبات — ونفس القاعدة المسجَّلة عندنا:
 * **الحاجة اللي بتتوصف في مكانين بتتناقض.**
 *
 * الشارة المشتركة اتضاف لها `pending` عشان تغطّي الحالة دي.
 */
const MEDIA_STATUS: Record<
  InstructorMedia['status'],
  { label: string; type: StatusBadgeType }
> = {
  pending: { label: 'في انتظار المراجعة', type: 'pending' },
  approved: { label: 'ظاهرة في بروفايلك', type: 'success' },
  rejected: { label: 'مرفوضة', type: 'danger' },
};

function MediaTile({ item, onEdit }: { item: InstructorMedia; onEdit: () => void }) {
  return (
    <Card className="flex flex-col overflow-hidden p-0">
      {/* نسبة ثابتة و`contain`: الغلاف والأعمال أشكالها مختلفة،
          و`cover` كانت هتقصّ اللي المدرب رفعه بالظبط. */}
      <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-slate-50 to-white">
        <Image
          src={optimizedImageUrl(item.imageUrl, 500)}
          alt={item.title ?? 'صورة'}
          fill
          sizes="(max-width: 768px) 50vw, 260px"
          className="object-contain p-3"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <StatusBadge
          label={MEDIA_STATUS[item.status].label}
          type={MEDIA_STATUS[item.status].type}
        />

        {item.title && (
          <p className="text-sm font-bold text-slate-800">{item.title}</p>
        )}
        {item.contribution && (
          <p className="text-xs font-medium text-slate-600">{item.contribution}</p>
        )}

        {item.status === 'rejected' && item.adminFeedback && (
          <p className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-xs font-bold">
            {item.adminFeedback}
          </p>
        )}

        <button type="button" onClick={onEdit} className="min-h-[44px] text-sm font-bold text-blue-700">
          تعديل الصورة
        </button>
        <ActionForm action={removeInstructorMedia} className="mt-auto pt-2">
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            className="text-danger inline-flex min-h-[44px] items-center gap-1.5 text-xs font-bold"
          >
            <Trash2 className="h-4 w-4" />
            مسح
          </button>
        </ActionForm>
      </div>
    </Card>
  );
}

export function InstructorMediaPanel({ media }: { media: InstructorMedia[] }) {
  const [adding, setAdding] = useState<'cover' | 'work' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<InstructorMedia | null>(null);
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  const openForm = (kind: 'cover' | 'work' | null, item: InstructorMedia | null = null) => {
    setEditing(item);
    setFile(null);
    uploaded.current = null;
    setAdding(kind);
  };
  const submitMedia = async (data: FormData) => {
    if (!file && (!editing || !data.get('imageUrl'))) return { ok: false as const, error: 'اختار صورة أولًا' };
    // Validate text before creating an upload. The server validates again.
    data.set('imageUrl', 'https://res.cloudinary.com/validation/image/upload/selected.jpg');
    const parsed = parseMediaInput(data);
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    try {
      if (file && uploaded.current?.file !== file) {
        const result = await uploadImage(file, `alrehla/instructors/${adding === 'cover' ? 'covers' : 'works'}`);
        uploaded.current = { file, url: result.url };
      }
      data.set('imageUrl', file ? uploaded.current!.url : editing!.imageUrl);
      return await submitInstructorMedia(data);
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'تعذّر رفع الصورة' };
    }
  };

  const cover = media.filter((m) => m.kind === 'cover');
  const works = media.filter((m) => m.kind === 'work');

  return (
    <div className="space-y-10">
      {/* ══ الغلاف ══════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">غلاف البروفايل</h2>
            <p className="text-sm font-medium text-slate-600">
              الصورة العريضة أعلى صفحتك. تُراجَع قبل ما تظهر.
            </p>
          </div>
          {adding !== 'cover' && (
            <Button
              variant="secondary"
              accentColor="journey"
              onClick={() => openForm('cover')}
            >
              <Plus className="h-4 w-4" />
              {cover.length > 0 ? 'غلاف جديد' : 'ارفع غلافًا'}
            </Button>
          )}
        </div>

        {adding === 'cover' && (
          <Card className="p-5">
            <ActionForm
              key={editing?.id ?? adding}
              action={submitMedia}
              onDone={() => openForm(null)}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={editing?.id ?? ''} />
              <input type="hidden" name="kind" value="cover" />
              <ImageField
                name="imageUrl"
                onFileChange={setFile}
                value={editing?.imageUrl}
                label="صورة الغلاف"
                folder="alrehla/instructors/covers"
                aspect="wide"
                hint="الأفضل صورة عريضة (٢١:٩) بعرض ١٦٠٠ بكسل على الأقل — الصورة الصغيرة بتبان ناعمة في الشاشات الكبيرة."
              />
              <div className="flex gap-2">
                <SubmitButton pendingLabel="جارٍ الإرسال…">ابعتها للمراجعة</SubmitButton>
                <Button
                  type="button"
                  variant="secondary"
                  accentColor="journey"
                  onClick={() => openForm(null)}
                >
                  إلغاء
                </Button>
              </div>
            </ActionForm>
          </Card>
        )}

        {cover.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cover.map((m) => (
              <MediaTile key={m.id} item={m} onEdit={() => openForm(m.kind, m)} />
            ))}
          </div>
        ) : (
          adding !== 'cover' && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-medium text-slate-600">
              مفيش غلاف لسه — صفحتك بتظهر بالتصميم الافتراضي.
            </p>
          )
        )}
      </section>

      {/* ══ الأعمال ═════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">إصداراتك وأعمالك</h2>
            <p className="text-sm font-medium text-slate-600">
              أغلفة كتب ألّفتها أو رسمتها أو شاركت فيها. حد أقصى ١٢.
            </p>
          </div>
          {adding !== 'work' && (
            <Button
              variant="secondary"
              accentColor="journey"
              onClick={() => openForm('work')}
            >
              <Plus className="h-4 w-4" />
              أضف عملًا
            </Button>
          )}
        </div>

        {adding === 'work' && (
          <Card className="p-5">
            <ActionForm
              key={editing?.id ?? adding}
              action={submitMedia}
              onDone={() => openForm(null)}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={editing?.id ?? ''} />
              <input type="hidden" name="kind" value="work" />
              <ImageField
                name="imageUrl"
                onFileChange={setFile}
                value={editing?.imageUrl}
                label="صورة العمل"
                folder="alrehla/instructors/works"
                aspect="cover"
                hint="غلاف الكتاب أو صورة العمل."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم العمل" name="title">
                  <TextInput defaultValue={editing?.title ?? ''} maxLength={120} placeholder="مثال: رحلة إلى أعماق البحار" />
                </Field>
                <Field
                  label={
                    <>
                      دورك فيه{' '}
                      <span className="font-medium text-slate-500">(اختياري)</span>
                    </>
                  }
                  name="contribution"
                >
                  <TextInput defaultValue={editing?.contribution ?? ''} maxLength={80} placeholder="تأليف · رسم · مشاركة" />
                </Field>
              </div>
              <div className="flex gap-2">
                <SubmitButton pendingLabel="جارٍ الإرسال…">ابعته للمراجعة</SubmitButton>
                <Button
                  type="button"
                  variant="secondary"
                  accentColor="journey"
                  onClick={() => openForm(null)}
                >
                  إلغاء
                </Button>
              </div>
            </ActionForm>
          </Card>
        )}

        {works.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {works.map((m) => (
              <MediaTile key={m.id} item={m} onEdit={() => openForm(m.kind, m)} />
            ))}
          </div>
        ) : (
          adding !== 'work' && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-medium text-slate-600">
              مفيش أعمال مضافة لسه.
            </p>
          )
        )}
      </section>

      {/* ⚠️ القاعدة دي سلوك القاعدة نفسها (محفّز ملف 127) — مكتوبة
          هنا عشان المدرب مايكتشفهاش بنفسه بعد ما يعدّل. */}
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
        تعديل صورة معتمدة بيرجّعها للمراجعة من تاني — لأن الموافقة كانت على
        الصورة نفسها.
      </p>
    </div>
  );
}

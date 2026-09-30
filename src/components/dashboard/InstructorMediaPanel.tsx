'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Clock, CheckCircle2, XCircle, Trash2, Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImageField } from '@/components/dashboard/ImageField';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { submitInstructorMedia, removeInstructorMedia } from '@/actions/instructor-media';
import type { InstructorMedia } from '@/data/domains/instructor-media';

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

const STATUS = {
  pending: {
    label: 'في انتظار المراجعة',
    icon: Clock,
    cls: 'bg-pending-soft text-pending border-slate-200',
  },
  approved: {
    label: 'ظاهرة في بروفايلك',
    icon: CheckCircle2,
    cls: 'bg-success-soft text-success border-emerald-200',
  },
  rejected: {
    label: 'مرفوضة',
    icon: XCircle,
    cls: 'bg-danger-soft text-danger border-red-200',
  },
} as const;

function StatusBadge({ status }: { status: InstructorMedia['status'] }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${s.cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}

function MediaTile({ item }: { item: InstructorMedia }) {
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
        <StatusBadge status={item.status} />

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
              onClick={() => setAdding('cover')}
            >
              <Plus className="h-4 w-4" />
              {cover.length > 0 ? 'غلاف جديد' : 'ارفع غلافًا'}
            </Button>
          )}
        </div>

        {adding === 'cover' && (
          <Card className="p-5">
            <ActionForm
              action={submitInstructorMedia}
              onDone={() => setAdding(null)}
              className="space-y-4"
            >
              <input type="hidden" name="kind" value="cover" />
              <ImageField
                name="imageUrl"
                label="صورة الغلاف"
                folder="alrehla/instructors/covers"
                aspect="wide"
                hint="الأفضل صورة عريضة (٢١:٩) بعرض ١٦٠٠ بكسل على الأقل — الصورة الصغيرة بتبان ناعمة في الشاشات الكبيرة."
              />
              <div className="flex gap-2">
                <Button type="submit" accentColor="journey">
                  ابعتها للمراجعة
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  accentColor="journey"
                  onClick={() => setAdding(null)}
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
              <MediaTile key={m.id} item={m} />
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
              onClick={() => setAdding('work')}
            >
              <Plus className="h-4 w-4" />
              أضف عملًا
            </Button>
          )}
        </div>

        {adding === 'work' && (
          <Card className="p-5">
            <ActionForm
              action={submitInstructorMedia}
              onDone={() => setAdding(null)}
              className="space-y-4"
            >
              <input type="hidden" name="kind" value="work" />
              <ImageField
                name="imageUrl"
                label="صورة العمل"
                folder="alrehla/instructors/works"
                aspect="cover"
                hint="غلاف الكتاب أو صورة العمل."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block text-sm font-bold text-slate-700">
                    اسم العمل
                  </span>
                  <input
                    name="title"
                    maxLength={120}
                    placeholder="مثال: رحلة إلى أعماق البحار"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base font-medium outline-none focus:border-emerald-500 md:text-sm"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-sm font-bold text-slate-700">
                    دورك فيه{' '}
                    <span className="font-medium text-slate-500">(اختياري)</span>
                  </span>
                  <input
                    name="contribution"
                    maxLength={80}
                    placeholder="تأليف · رسم · مشاركة"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base font-medium outline-none focus:border-emerald-500 md:text-sm"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" accentColor="journey">
                  ابعته للمراجعة
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  accentColor="journey"
                  onClick={() => setAdding(null)}
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
              <MediaTile key={m.id} item={m} />
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

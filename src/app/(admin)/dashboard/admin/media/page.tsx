import React from 'react';
import Image from 'next/image';
import { AlertTriangle, HardDrive, ShieldCheck, Images } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getMediaScan, SCANNED_TABLES } from '@/data/domains/(admin)/media/queries';
import {
  FOLDER,
  isCloudinaryAdminConfigured,
  listFolderAssets,
} from '@/lib/cloudinary-admin';
import { formatCairo } from '@/lib/timezone';
import { OrphanGallery } from './OrphanGallery';
import { getOrphanLedger } from '@/data/domains/(admin)/media/cleanup';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { autoDeleteDate } from '@/lib/media-cleanup';

export const dynamic = 'force-dynamic';

/**
 * صور الموقع على Cloudinary.
 *
 * ── الحذف ────────────────────────────────────────────────
 *
 * «مش مستخدمة» استنتاج: بنقرا كل صف في كل جدول ممكن يكون فيه صورة
 * (`data/domains/media`). **لو أي جدول ماتقراش الحذف مقفول خالص.**
 * ولو الفحص كامل بس أكتر من نص الصور بلا رابط، الحذف محتاج تأكيد
 * «راجعت الصور» (ممكن تكون صور لسه ما رجعتش لأماكنها). والخادم بيعيد
 * الفحص قبل الحذف نفسه.
 *
 * ⚠️ **وكل حاجة مقيَّدة بمجلّد `alrehla/`.** حساب Cloudinary ده
 *    مشترك مع مشروع تاني (`Onlyhelio`)، ولولا القيد ده كانت صور
 *    المشروع التاني هتبان «مهجورة» لأنها مالهاش رابط في قاعدتنا.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  const ready = isCloudinaryAdminConfigured();

  const [listed, scan, ledger, settings] = await Promise.all([
    ready ? listFolderAssets() : Promise.resolve(null),
    getMediaScan(),
    getOrphanLedger(),
    getSiteSettings(),
  ]);
  const cleanup = settings.mediaCleanup;
  const usage = scan.usage;

  const assets = listed?.ok ? listed.data.assets : [];
  const used = assets.filter((a) => usage.has(a.publicId));
  // يوم المسح التلقائي لكل صورة متسابة (لو المسح شغّال والمهمة شافتها).
  //    (ومابيظهرش لو أكتر من النص متسابة: المهمة بتقف ساعتها.)
  const unused = assets.filter((a) => !usage.has(a.publicId));
  const autoRuns = cleanup.enabled && scan.complete && unused.length <= assets.length / 2;
  const orphans = unused.map((a) => ({
    ...a,
    autoDeleteOn: autoRuns
      ? autoDeleteDate(ledger[a.publicId], cleanup.days)?.toISOString()
      : undefined,
  }));

  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  const orphanBytes = orphans.reduce((sum, a) => sum + a.bytes, 0);
  const totalBytes = assets.reduce((sum, a) => sum + a.bytes, 0);

  // فحص ناقص (جدول ماتقراش) = الحذف مقفول خالص — زي الخادم بالظبط.
  const deleteLocked = !scan.complete;
  // ⚠️ أكتر من نص الصور بلا رابط والفحص **كامل**: مش قفل، تأكيد.
  //    كان قفل تام لحد ما الرقم يقل — بس في مرحلة التأسيس الرقم ده طبيعي
  //    (صور تجارب ورفع واستبدال كتير)، فالتنضيف كان مستحيل. دلوقتي الإدارة
  //    بتعلّم «راجعت الصور» وبعدها الحذف يتفتح. (قرار تامر، 9 أكتوبر.)
  const highRatio = scan.complete && assets.length > 0 && orphans.length > assets.length / 2;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title="صور الموقع على Cloudinary"
      />

      {!ready && (
        <p className="mb-6 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          إعدادات Cloudinary ناقصة على الخادم: `CLOUDINARY_API_KEY` و
          `CLOUDINARY_API_SECRET` في Vercel — **من غير `NEXT_PUBLIC_`** — وبعدها
          Redeploy.
        </p>
      )}

      {listed && !listed.ok && (
        <p className="mb-6 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {listed.error}
        </p>
      )}

      {/* ── الأرقام ──────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<Images className="h-5 w-5" />}
          label={`صور مجلّد ${FOLDER}/`}
          value={String(assets.length)}
          hint={`${mb(totalBytes)} ميجا`}
        />
        <Stat
          icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
          label="مستخدمة في الموقع"
          value={String(used.length)}
          hint="ليها رابط في القاعدة"
        />
        <Stat
          icon={<HardDrive className="h-5 w-5 text-amber-600" />}
          label="مش مستخدمة حاليًا"
          value={String(orphans.length)}
          hint={`${mb(orphanBytes)} ميجا`}
        />
      </div>

      {listed?.ok && listed.data.truncated && (
        <p className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
          القايمة اتقطعت عند {assets.length} صورة — فيه صور كمان في المجلّد.
        </p>
      )}

      {/* ⚠️ **فحص آلي على الفحص نفسه.**

          لو نص صور المجلّد أو أكتر بانت «مهجورة»، الاحتمال الأرجح
          مش إن نصّ المخزن زبالة — الاحتمال الأرجح إن **جدول ما
          اتقريش** فصوره كلها بانت بلا رابط. وده بالظبط السيناريو
          اللي بيخلّي ضغطة حذف تمسح شغل شهور. */}
      {highRatio && (
        <p className="mb-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            أكتر من نص صور المجلّد ({orphans.length} من {assets.length}) مش
            مستخدمة. الفحص قرا كل الجداول، فالرقم ده حقيقي — غالبًا صور تجارب
            أو صور اتبدّلت. بس راجعها الأول: لو فيها صورة المفروض تبقى في
            الموقع (منتج، صورة صفحة، مقال)، رجّعها لمكانها من زرار «من
            المكتبة» قبل ما تحذف. <strong>الحذف بيتفتح بعد ما تعلّم «راجعت
            الصور» تحت.</strong>
          </span>
        </p>
      )}

      {/* ── تحذير قبل أي حذف ─────────────────────────────── */}
      <section className="mb-10 rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-2 flex items-center gap-2 font-black text-amber-900">
          <AlertTriangle className="h-5 w-5" />
          اقرا ده قبل ما تحذف
        </h2>
        <p className="mb-4 text-sm leading-relaxed font-medium text-amber-900">
          «مالهاش رابط» استنتاج مش حقيقة: بنقرا كل صف في الجداول دي ونطلّع أي
          رابط صورة من أي خانة فيه. <strong>لو أي جدول ماتقراش، الحذف بيتقفل
          لوحده.</strong> ولو صورة إنت شايفها في الموقع ظاهرة في «مالهاش رابط»،
          قول قبل ما تحذف — الحذف نهائي.
        </p>
        {!scan.complete && (
          <p className="mb-4 rounded-xl bg-rose-100 p-3 text-sm font-bold text-rose-900">
            الفحص ماخلصش ({scan.failed.join('، ')}) — الحذف مقفول لحد ما يكمل.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {SCANNED_TABLES.map((entry) => (
            <span
              key={entry.table}
              className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-amber-900"
            >
              {entry.label}
            </span>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-black text-slate-800">
          مش مستخدمة حاليًا{' '}
          <span className="text-sm font-bold text-slate-400">
            ({orphans.length})
          </span>
        </h2>
        <p className="mb-4 text-sm font-medium text-slate-500">
          تقدر تستعملها تاني من زرار «من المكتبة» في أي خانة صورة. ولو متأكد إن
          صورة مالهاش لازمة، حدّدها واحذفها — الحذف نهائي.{' '}
          {cleanup.enabled
            ? `واللي تفضل متسابة ${cleanup.days} يوم بتتمسح لوحدها (التاريخ تحت كل صورة) — الإعداد من «الإعدادات العامة».`
            : 'المسح التلقائي مقفول من «الإعدادات العامة».'}
        </p>
        <OrphanGallery assets={orphans} deleteLocked={deleteLocked} needsAck={highRatio} />
      </section>

      <Gallery
        title="مستخدمة في الموقع"
        subtitle="بنقول مكان كل واحدة"
        assets={used}
        usage={usage}
        empty="مفيش صور مستخدمة."
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2 text-slate-400">{icon}</div>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-800">{value}</p>
      {hint && (
        <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p>
      )}
    </div>
  );
}

function Gallery({
  title,
  subtitle,
  assets,
  usage,
  empty,
}: {
  title: string;
  subtitle: string;
  assets: {
    publicId: string;
    url: string;
    bytes: number;
    createdAt: string;
    format: string;
  }[];
  usage: Map<string, string[]>;
  empty: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-black text-slate-800">
        {title}{' '}
        <span className="text-sm font-bold text-slate-400">
          ({assets.length})
        </span>
      </h2>
      <p className="mb-4 text-sm font-medium text-slate-500">{subtitle}</p>

      {assets.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center font-medium text-slate-400">
          {empty}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((asset) => (
            <figure
              key={asset.publicId}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="relative aspect-square bg-slate-100">
                <Image
                  src={asset.url}
                  alt=""
                  fill
                  sizes="220px"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              </div>
              <figcaption className="space-y-1 p-3">
                <p
                  dir="ltr"
                  className="truncate text-right font-mono text-[11px] text-slate-500"
                  title={asset.publicId}
                >
                  {asset.publicId}
                </p>
                <p className="text-xs font-bold text-slate-600">
                  {(asset.bytes / 1024).toFixed(0)} ك.ب · {asset.format}
                </p>
                {asset.createdAt && (
                  <p className="text-xs font-medium text-slate-400">
                    {formatCairo(asset.createdAt, { dateStyle: 'medium' })}
                  </p>
                )}
                {usage.get(asset.publicId)?.map((place) => (
                  <span
                    key={place}
                    className="me-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"
                  >
                    {place}
                  </span>
                ))}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

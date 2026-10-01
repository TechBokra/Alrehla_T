import { Download, ExternalLink, ImageOff } from 'lucide-react';
import { describeCustomization, hasCustomization } from '@/lib/order-customization';
import { privateImageUrl } from '@/lib/cloudinary-private';
import { formatPrice } from '@/lib/utils';

/**
 * تفاصيل تخصيص بند واحد — **اللي الإدارة بتنفّذ منه الطلب**.
 *
 * كانت مش ظاهرة في أي شاشة (التفاصيل في `@/lib/order-customization`).
 *
 * ⚠️ **الصور الخاصة بروابط بتنتهي بعد ساعة** — بتتعمل ساعة فتح الصفحة
 *    (الصفحة `force-dynamic`). لو الرابط انتهى: تحديث الصفحة.
 * ⚠️ و`data-allow-save`: حماية الصور في الموقع كله بتمنع الحفظ بالزرار
 *    اليمين — والإدارة **محتاجة** تحفظ صورة الطفل عشان الرسم والطباعة.
 */
export function OrderItemCustomization({
  productName,
  customization,
}: {
  productName: string;
  customization: unknown;
}) {
  const view = describeCustomization(customization);
  if (!hasCustomization(view)) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5" data-allow-save>
      <h4 className="mb-4 font-bold text-slate-800">تفاصيل التخصيص — {productName}</h4>

      {view.fields.length > 0 && (
        <dl className="grid gap-3 sm:grid-cols-2">
          {view.fields.map((f) => (
            <div key={f.label} className="rounded-xl bg-white p-3">
              <dt className="text-xs font-bold text-slate-600">{f.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {view.photos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4">
          {view.photos.map((photo) => {
            const viewUrl =
              photo.kind === 'private' ? privateImageUrl(photo) : photo.url;
            const downloadUrl =
              photo.kind === 'private' ? privateImageUrl(photo, { attachment: true }) : photo.url;
            return (
              <figure key={photo.label} className="w-40 rounded-xl bg-white p-2">
                {viewUrl ? (
                  <img
                    src={viewUrl}
                    alt={photo.label}
                    className="h-36 w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg bg-slate-100 text-center text-xs font-bold text-red-700">
                    <ImageOff className="h-5 w-5" aria-hidden />
                    مفاتيح Cloudinary ناقصة على الخادم
                  </div>
                )}
                <figcaption className="mt-2 text-xs font-bold text-slate-700">
                  {photo.label}
                  {photo.kind === 'public' && (
                    <span className="block font-medium text-amber-800">رابط عام (طلب قديم)</span>
                  )}
                </figcaption>
                {viewUrl && (
                  <div className="mt-2 flex gap-2 text-xs font-bold">
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden /> فتح
                    </a>
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden /> تحميل
                      </a>
                    )}
                  </div>
                )}
              </figure>
            );
          })}
        </div>
      )}

      {view.addons.length > 0 && (
        <div className="mt-4">
          <h5 className="mb-2 text-sm font-bold text-slate-700">الإضافات</h5>
          <ul className="space-y-1 text-sm text-slate-800">
            {view.addons.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.name}</span>
                {a.customized && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                    مخصّصة
                  </span>
                )}
                {a.price != null && <span className="text-slate-600">{formatPrice(a.price)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

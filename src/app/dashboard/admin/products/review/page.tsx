import Image from 'next/image';
import Link from 'next/link';
import { PackageCheck, Building2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth-guard';
import { getPendingProducts } from '@/data/domains/products';
import { reviewProduct } from '@/actions/products';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * مراجعة المنتجات المستنية (ملف 130).
 *
 * ⚠️ **الشاشة دي هي اللي بتخلّي «الموافقة» حقيقية.** من غيرها
 *    المنتج بيدخل «في الانتظار» ويفضل **واقفًا عن البيع للأبد**،
 *    والناشر يفتكر إن الموقع باظ.
 *
 * ⚠️ **والصور كلها بتتعرض، مش الغلاف وحده.** الموافقة على المنتج
 *    معناها الموافقة على **اللي العميل هيشوفه** — والإداري اللي
 *    شاف الغلاف وبس بيكون وافق على حاجة ما شافهاش.
 *
 * ⚠️ **و`object-contain`**: الإداري بيوافق على اللي هو شايفه. لو
 *    الشاشة قصّت الصورة، هو بيوافق على جزء والعميل بيشوف الكامل.
 */
export default async function ProductReviewPage() {
  await requireAdmin('canManageCatalog');
  const pending = await getPendingProducts();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-black text-slate-900">مراجعة المنتجات</h1>
        <p className="text-sm font-medium text-slate-600">
          المنتج — بصوره وتفاصيله — مايظهرش للعميل قبل الاعتماد. وأي تعديل من
          الناشر بيرجّعه هنا من تاني.
        </p>
      </header>

      {pending.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <PackageCheck className="h-12 w-12 text-slate-300" />
          <p className="text-lg font-black text-slate-800">مفيش منتجات مستنية</p>
          <p className="text-sm font-medium text-slate-600">
            أول ما ناشر يقدّم منتجًا أو يعدّل واحدًا، هتلاقيه هنا.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.map((product) => {
            // الغلاف أولًا والمكرّر بيتشال — زيّ صفحة المنتج بالظبط،
            // عشان الإداري يشوف نفس اللي العميل هيشوفه.
            const images = [
              ...new Set(
                [product.coverImageUrl, ...(product.galleryImageUrls ?? [])].filter(
                  (u): u is string => Boolean(u),
                ),
              ),
            ];

            return (
              <Card key={product.id} className="overflow-hidden p-0">
                <div className="grid gap-6 p-6 lg:grid-cols-[auto,1fr]">
                  {/* ══ كل الصور ══════════════════════════════ */}
                  <div className="flex flex-wrap gap-3 lg:w-64">
                    {images.length > 0 ? (
                      images.map((url) => (
                        <div
                          key={url}
                          className="relative aspect-[3/4] w-28 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white"
                        >
                          <Image
                            src={optimizedImageUrl(url, 400)}
                            alt=""
                            fill
                            sizes="112px"
                            className="object-contain p-2"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))
                    ) : (
                      <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-xs font-bold">
                        مفيش أي صورة — العميل هيشوف إطارًا فاضيًا.
                      </p>
                    )}
                  </div>

                  {/* ══ التفاصيل ══════════════════════════════ */}
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-black text-slate-900">{product.name}</h2>
                      <StatusBadge label="في انتظار المراجعة" type="pending" />
                      {!product.isActive && (
                        <StatusBadge label="موقوف" type="neutral" />
                      )}
                    </div>

                    {product.publisherName && (
                      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                        <Building2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {product.publisherName}
                      </p>
                    )}

                    <p className="text-sm font-medium text-slate-600">
                      {product.shortDescription || '— مفيش وصف مختصر —'}
                    </p>

                    {product.longDescription && (
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">
                        {product.longDescription}
                      </div>
                    )}

                    {product.features && product.features.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {product.features.map((f, i) => (
                          <li
                            key={i}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600"
                          >
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="text-lg font-black text-slate-900">
                      {formatPrice(product.price)}
                      {product.publisherCost ? (
                        <span className="mr-2 text-xs font-bold text-slate-500">
                          (نصيب الناشر {formatPrice(product.publisherCost)})
                        </span>
                      ) : null}
                    </p>

                    <Link
                      href={`/dashboard/admin/products/${product.id}`}
                      className="text-info inline-block text-sm font-bold hover:underline"
                    >
                      افتح للتعديل
                    </Link>

                    <ActionForm action={reviewProduct} className="space-y-3 pt-2">
                      <input type="hidden" name="id" value={product.id} />
                      {/* ⚠️ الخانة ظاهرة دايمًا لا بتظهر بعد الضغط:
                          الأكشن بيرفض الرفض بلا سبب، والخانة المخفية
                          كانت هتخلّي الرفض يفشل برسالة عن خانة
                          الإداري مش شايفها. */}
                      <textarea
                        name="note"
                        rows={2}
                        maxLength={400}
                        placeholder="سبب الرفض — بيوصل للناشر"
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-medium outline-none focus:border-amber-500 md:text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" name="decision" value="approved" accentColor="journey">
                          اعتماد ونشر
                        </Button>
                        <Button
                          type="submit"
                          name="decision"
                          value="rejected"
                          variant="secondary"
                          accentColor="enhaLak"
                        >
                          رفض
                        </Button>
                      </div>
                    </ActionForm>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

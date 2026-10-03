'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { getCurrentUser } from '@/data/domains/auth';
import { getMyPublisher } from '@/data/domains/products';
import { hasAdminPermission } from '@/lib/utils';
import { requireAdmin } from '@/lib/auth-guard';
import {
  isProductCategory,
  PUBLISHER_PRODUCT_CATEGORIES,
} from '@/lib/product-categories';
import {
  validateProductInput,
  slugFromName,
  parseFeatures,
  onlySentFields,
} from '@/lib/product-input';
import { parseAgeInput } from '@/lib/age-bands';
import {
  customerPriceFromCost,
  NEUTRAL_FORMULA,
  type PricingFormula,
} from '@/lib/publisher-pricing';

/**
 * حفظ منتج — من لوحة الإدارة أو من لوحة الناشر.
 *
 * التحقق هنا كان **مفقود بالكامل**: الدالة كانت بتاخد رقم الناشر من حقل
 * مخفي في الفورم وتكتب بيه من غير ما تسأل مين اللي بيحفظ. يعني أي حساب
 * مسجّل كان يقدر يعدّل أي منتج وينسبه لأي ناشر — والحماية الوحيدة كانت
 * صلاحيات قاعدة البيانات.
 *
 * دلوقتي: الإدارة تعدّل أي حاجة، والناشر منتجاته هو بس، وأي حد تاني
 * بيترفض.
 *
 * ⚠️ **والدالة بترجّع `{ ok:false, error }` ومابترميش.** كانت بترمي،
 *    وNext بيمسح نصّ الاستثناء في الإنتاج (قاعدة «هـ») — فالإداري
 *    بيشوف صفحة خطأ عامة **ويطلع برّه الشاشة اللي كان بيملاها**.
 *
 *    ⚠️ ولازم **كل** المخارج ترجّع، لا نصّها. الحارس على نصّ المسار
 *       أوحش من غيابه كله، لأنه بيدّي إحساسًا إن الموضوع متغطّى.
 */
export async function saveProduct(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get('id') as string;
  const isNew = !id;
  
  const nameRaw = formData.get('name');
  // ⚠️ **الخانة في الواجهة مش دليل** (قاعدة «ع»). النموذج بيعرض
  //    القيم الصالحة بس، لكن اللي بيوصل للخادم نص من المتصفح — وأي
  //    حد يقدر يبعت اللي هو عايزه. والقاعدة هترفض القيمة الغلط،
  //    لكن الرسالة اللي هتوصل للإداري ساعتها غير مفهومة.
  const categoryRaw = formData.get('category');
  if (!isProductCategory(categoryRaw)) {
    return { ok: false as const, error: 'التصنيف المختار غير صالح' };
  }
  const category = categoryRaw;
  // ⚠️ **الرقم اللي بيوصل من الناشر هو نصيبه، مش سعر العميل.**
  //    سعر العميل بيتحسب تحت من معادلة `publisher-default`. أما
  //    الإدارة فبتكتب سعر منتج المنصة مباشرة — مفيش ناشر ياخد منه.
  const publisherCostRaw = formData.get('publisherCost');
  const publisherCost =
    publisherCostRaw !== null && publisherCostRaw !== ''
      ? Number(publisherCostRaw)
      : null;

  // ── التحقّق ───────────────────────────────────────────────
  //
  // ⚠️ **سعر المنصة كان بيتقرا بـ`Number(...)` وخلاص.** و`Number`
  //    مابترفضش حاجة:
  //      • خانة فاضية → **صفر** → **منتج مجاني**
  //      • نص غير رقمي → `NaN`، و`numeric` في Postgres **بيقبله**،
  //        والشاشة بتعرض «NaN ج.م» للعميل
  //      • سالب → بيتحفظ زي ما هو
  //
  // ⚠️ **ونصيب الناشر كان متحقَّقًا منه فعلًا وسعر المنصة لأ** —
  //    يعني الحارس كان على نصّ المسار. وده أوحش من غيابه كله،
  //    لأنه بيدّي إحساسًا إن الموضوع متغطّى.
  //
  // ⚠️ **والخانة `required` في النموذج مش دليل** (قاعدة «ع»).
  //    منتج الناشر سعره بيتحسب من نصيبه تحت، فالسعر مش مطلوب منه.
  const isPublisherProduct = formData.get('ownerType') === 'publisher';
  const checked = validateProductInput({
    name: formData.get('name'),
    shortDescription: formData.get('shortDescription'),
    price: isPublisherProduct ? '1' : formData.get('price'),
    electronicPrice: formData.get('electronicPrice'),
  });
  if (!checked.ok) return { ok: false as const, error: checked.error };

  let price = isPublisherProduct ? 0 : checked.data.price;
  const electronicPrice = checked.data.electronicPrice ?? null;
  const shortDescription = checked.data.shortDescription || '';
  // ── تفاصيل المنتج ─────────────────────────────────────────
  //
  // 🔴 **العمود `features` كان في القاعدة، ومعروضًا في صفحة المنتج
  //    وفي كارت المكتبة — ومافيش مكان يتكتب فيه.** لا في نموذج
  //    الإضافة ولا في نموذج التعديل ولا في الأكشن ده. يعني خانة
  //    معروضة للعميل **ومستحيل تتملى**.
  //
  // ⚠️ ودي أوحش من خانة ناقصة: الشاشة بتوعد بتفاصيل، والفريق
  //    بيدوّر على مكان يكتبها فيه ومايلاقيش، فيفتكر إن الموقع باظ.
  //
  // **سطر لكل بند** — أبسط شكل للكتابة بالعربي، وأقل من أي محرّر
  // شرائح في احتمالات الخطأ. والفاضي بيتشال، والمكرّر بيتشال،
  // والسقف ٨ عشان الكارت مايتحوّلش لقايمة.
  const features = parseFeatures(formData.get('features') as string | null);
  const longDescription =
    ((formData.get('longDescription') as string | null) ?? '').trim() || null;

  // ── معرض الصور ────────────────────────────────────────────
  //
  // ⚠️ **نفس تنظيف التفاصيل** (`parseFeatures`): الفاضي بيتشال
  //    والمكرّر بيتشال. والمكرّر هنا بيحصل كتير — الإداري بيرفع
  //    نفس الصورة مرتين بالغلط فتطلع مرتين في الشريط.
  //
  // ⚠️ **والرابط لازم يكون من Cloudinary بتاعنا**: الخانة بتوصل
  //    كنصّ، وأي حد يقدر يبعت أي رابط — وساعتها صفحة عامة بتعرض
  //    صورة من سيرفر مش بتاعنا، بلا تحكّم فيها ولا في وقت
  //    اختفائها. (نفس الحارس اللي في صور المدربين.)
  const gallery = [
    ...new Set(
      ((formData.get('galleryImageUrls') as string | null) ?? '')
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => /^https:\/\/res\.cloudinary\.com\//.test(u)),
    ),
  ].slice(0, 8);

  // ── السنّ المناسب (ملف 132) ───────────────────────────────
  //
  // نفس قيود القاعدة بالحرف، عشان الرسالة تبقى مفهومة بدل رفض
  // القاعدة الخام («violates check constraint …»).
  const age = parseAgeInput(formData.get('minAge'), formData.get('maxAge'));
  if (!age.ok) return { ok: false as const, error: age.error };

  const coverImageUrl = formData.get('coverImageUrl') as string || null;
  const publisherId = formData.get('publisherId') as string || null;
  let ownerType: 'platform' | 'publisher' =
    formData.get('ownerType') === 'platform' ? 'platform' : 'publisher';

  const currentUser = await getCurrentUser();
  // ⚠️ شاشات المنتجات في اللوحة بصلاحية «الناشرون والمنتجات» — والحفظ
  //    كان بيفحص «الباقات والخدمات» بس، فالإداري اللي معاه الأولى بس
  //    كان بيتعامل كناشر وحفظه يترفض.
  const isAdmin =
    hasAdminPermission(currentUser, 'canManageCatalog') ||
    hasAdminPermission(currentUser, 'canManagePublishers');
  let effectivePublisherId = publisherId;

  // ══ المنصة ولا دار نشر — فصل كامل (ملاحظة تامر) ══════════════
  //
  // ⚠️ **المالك من القسم، والقسم من الخادم.** المنتج القائم مالكه
  //    بيتقري من القاعدة مش من النموذج — فمنتج ناشر مايتحوّلش
  //    للمنصة (ولا العكس) بتعديل خانة مخفية.
  // ⚠️ **منتج الناشر لازم ناشر حقيقي**: كان الإداري يقدر يحفظ «منتج
  //    ناشر» من غير ناشر (الخانة `required` في المتصفح بس)، فيطلع
  //    منتج يتيم في المكتبة مالوش حد يتحاسب.
  if (isAdmin) {
    if (!isNew) {
      const { data: existing } = await supabase
        .from('personalized_products')
        .select('owner_type, publisher_id')
        .eq('id', id)
        .maybeSingle();
      if (!existing) return { ok: false as const, error: 'المنتج مش موجود' };
      ownerType = existing.owner_type === 'platform' ? 'platform' : 'publisher';
    }
    if (ownerType === 'platform') {
      effectivePublisherId = null;
    } else {
      if (!PUBLISHER_PRODUCT_CATEGORIES.includes(category)) {
        return {
          ok: false as const,
          error: 'منتجات دور النشر بتتعرض في المكتبة بس — «مخصص» من المنصة.',
        };
      }
      const { data: pub } = publisherId
        ? await supabase.from('publishers').select('id').eq('id', publisherId).maybeSingle()
        : { data: null };
      if (!pub) return { ok: false as const, error: 'اختار دار النشر صاحبة المنتج' };
    }
  }

  if (!isAdmin) {
    // مش إداري؟ يبقى لازم يكون ناشر، والمنتج لازم يكون بتاعه.
    const myPublisher = await getMyPublisher();
    if (!myPublisher) return { ok: false as const, error: 'غير مصرح لك بحفظ المنتجات' };

    // رقم الناشر بيتاخد من الحساب، مش من الفورم.
    effectivePublisherId = myPublisher.id;

    // ⚠️ **الناشر ممنوع من «مخصص».** القصة المخصصة بتتكتب من الصفر
    //    في المنصة بعد الطلب — مش إصدارًا جاهزًا عند ناشر. ولو عدّت،
    //    المنتج بيظهر في «أنت البطل هنا» ومعالجه بيرفضه، فالعميل
    //    يوصل لصفحة «غير متاح للتخصيص». المنع هنا بيقفل الباب في
    //    الخادم، مش في القايمة وبس.
    if (!PUBLISHER_PRODUCT_CATEGORIES.includes(category)) {
      return {
        ok: false as const,
        error: 'التصنيف ده مش متاح للناشرين — منتجاتك بتتعرض في المكتبة.',
      };
    }
    // الناشر منتجاته منتجات ناشر — مهما اتبعت في النموذج.
    ownerType = 'publisher';

    if (!isNew) {
      const { data: existing } = await supabase
        .from('personalized_products')
        .select('publisher_id')
        .eq('id', id)
        .maybeSingle();

      if (!existing || existing.publisher_id !== myPublisher.id) {
        return { ok: false as const, error: 'غير مصرح لك بتعديل هذا المنتج' };
      }
    }
  }
  
  // ── الرابط ────────────────────────────────────────────────
  //
  // ⚠️ **كان `prod-${Date.now()}`** — رقم توليد تلقائي بيظهر للعميل
  //    في شريط العنوان وفي نتايج البحث وفي أي رابط بيتبعت على
  //    واتساب. وفيه منتجان على الإنتاج بالشكل ده فعلًا.
  //
  // ⚠️ **والرابط بيتعمل للجديد وبس.** تغيير رابط منتج قائم بيكسر
  //    كل رابط اتبعت له قبل كده، والزائر بيوصل لـ404 بلا سبب ظاهر.
  let slug = isNew
    ? slugFromName(checked.data.name)
    : ((formData.get('slug') as string) || slugFromName(checked.data.name));
  
  // ── سعر العميل من نصيب الناشر ─────────────────────────────
  //
  // ⚠️ **المعادلة بتتقري من القاعدة في كل حفظة، مش من المتصفح**
  //    (قاعدة «ف»). لو الناشر بعت المعامل مع الفورم، كان يقدر
  //    يبعت 1 ويلغي هامش المنصة كله من شاشته.
  let effectiveCost: number | null = null;

  if (ownerType === 'publisher') {
    if (publisherCost === null || !Number.isFinite(publisherCost) || publisherCost <= 0) {
      return {
        ok: false as const,
        error: 'اكتب نصيبك من النسخة الواحدة — رقم أكبر من صفر',
      };
    }

    const { data: formulaRow } = await supabase
      .from('pricing_formula_settings')
      .select('platform_multiplier, fixed_admin_fee')
      .eq('id', 'publisher-default')
      .maybeSingle();

    const formula: PricingFormula = formulaRow
      ? {
          platformMultiplier: formulaRow.platform_multiplier,
          fixedAdminFee: formulaRow.fixed_admin_fee,
        }
      : NEUTRAL_FORMULA;

    effectiveCost = Math.round(publisherCost);
    price = customerPriceFromCost(effectiveCost, formula);
  }

  // ══ 🔴 الخانة اللي ما جاتش من النموذج **ماتتكتبش** ══════════
  //
  // كانت التفاصيل والوصف الكامل والمعرض بيتكتبوا في كل حفظة — واللي
  // مش في النموذج بيتكتب `null`. ونموذج الناشر ماكانش فيه الخانات
  // دي، فأي تصحيح منه كان **بيمسح صور الإدارة ووصفها في صمت**.
  // التفصيل في `onlySentFields`.
  //
  // ⚠️ **ونموذج الناشر بقى فيه الخانات** — والحارس ده مش بديل عنها
  //    ولا هي بديل عنه: أي نموذج تالت يتعمل بعدين (أو خانة تتشال من
  //    نموذج) هيمسح بنفس الصمت لولاه.
  const optionalColumns = onlySentFields(formData, {
    // ⚠️ `null` لو فاضية لا `[]`: القاعدة بتفرّق بين «مفيش تفاصيل»
    //    و«قايمة فاضية»، والشاشات بتفحص `array_length` اللي بترجّع
    //    `null` للاتنين — فالتوحيد هنا بيمنع فرقًا مالوش معنى.
    features: { features: features.length > 0 ? features : null },
    longDescription: { long_description: longDescription },
    galleryImageUrls: { gallery_image_urls: gallery.length > 0 ? gallery : null },
    // خانتا السنّ بيتكتبوا مع بعض دايمًا: قيد القاعدة بيربطهم.
    minAge: { min_age: age.minAge, max_age: age.maxAge },
    // ⚠️ كانت بتتكتب دايمًا — وشاشة الإدارة ماكانش فيها الخانة، فأي
    //    حفظ من الإدارة كان بيمسح سعر النسخة الإلكترونية. الخانة دلوقتي
    //    في الإدارة لـ«مخصص» بس (`ElectronicPriceField`).
    electronicPrice: { electronic_price: electronicPrice },
  });

  const dbPayload = {
    slug,
    name: checked.data.name,
    category,
    price,
    publisher_cost: effectiveCost,
    short_description: shortDescription,
    ...optionalColumns,
    cover_image_url: coverImageUrl,
    publisher_id: effectivePublisherId,
    owner_type: ownerType,
    // ⚠️ **اللي الإدارة بتضيفه معتمد من أول لحظة.** كان المنتج الجديد
    //    من اللوحة بيدخل «مستني المراجعة» (القيمة الافتراضية في
    //    القاعدة) ومايظهرش في الموقع — والإداري هو المُراجِع أصلًا.
    //    ومنتج المنصة مالوش مراجعة خالص، فتعديله بيعتمده كمان. أما
    //    تعديل الإدارة لمنتج ناشر قائم فمابيلمسش حالة مراجعته.
    ...(isAdmin && (isNew || ownerType === 'platform')
      ? {
          review_status: 'approved',
          review_note: null,
          // الحارس بيختم الوقت في التعديل بس — الإدراج بنختمه هنا.
          ...(isNew ? { reviewed_at: new Date().toISOString() } : {}),
        }
      : {}),
  };

  let savedId = id;

  if (isNew) {
    // ⚠️ **الرابط لازم يكون فريد** (قيد في القاعدة). كتابين بنفس الاسم
    //    — من ناشرين مختلفين، أو نفس الكتاب بطبعة تانية — كان التاني
    //    بيترفض بـ«تعذّر إنشاء المنتج» من غير سبب مفهوم. لو الرابط
    //    متاخد بنزوّد رقم ونجرّب تاني.
    //
    //    ⚠️ بنجرّب الإدراج نفسه بدل ما نسأل «الرابط متاخد؟» الأول: الناشر
    //       مابيشوفش منتجات غيره المتوقفة، فالسؤال كان هيقول «فاضي» غلط.
    const baseSlug = slug;
    let attempt = await supabase
      .from('personalized_products')
      .insert([{ ...dbPayload, slug }])
      .select('id')
      .single();
    for (let n = 2; n <= 20 && attempt.error?.code === '23505'; n++) {
      if (!/slug/i.test(attempt.error.message ?? '')) break;
      slug = `${baseSlug}-${n}`;
      attempt = await supabase
        .from('personalized_products')
        .insert([{ ...dbPayload, slug }])
        .select('id')
        .single();
    }
    const { data, error } = attempt;

    if (error || !data) {
      console.error('Error inserting product:', error);
      return { ok: false as const, error: 'تعذّر إنشاء المنتج. جرّب تاني.' };
    }
    savedId = data.id;
  } else {
    // ══ 🔴 `.select()` — وده مش تجميل ═══════════════════
    //
    // كان `.update(...).eq('id', id)` وفحص `error` وبس. والصلاحيات
    // اللي بترفض **مابترجّعش خطأ** — بترجّع **صفر صفوف بلا خطأ**
    // (قاعدة «ك»).
    //
    // ⚠️ وتشخيص 129 كشف إن مكانش فيه ولا سياسة بتسمح للناشر يكتب
    //    على الجدول. يعني الناشر كان بيعدّل منتجه، والصلاحيات
    //    ترفض بصمت، **والشاشة تقول «اتحفظ»** ومفيش حاجة اتغيّرت.
    //
    // ⚠️ **والفحص ده بيفضل لازمًا حتى بعد ملف 130** اللي فتح
    //    الكتابة للناشر: أي سياسة تتضيّق بعدين هتفشل بنفس الصمت،
    //    والفحص هو اللي بيخلّيها تتكلم.
    const { data: updated, error } = await supabase
      .from('personalized_products')
      .update(dbPayload)
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error updating product:', error);
      return { ok: false as const, error: 'تعذّر حفظ التعديلات. جرّب تاني.' };
    }
    if (!updated) {
      return {
        ok: false as const,
        error: 'التعديل ما اتحفظش — المنتج مش موجود أو مش مصرّح لك بتعديله.',
      };
    }
  }

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: isNew ? 'product_created' : 'product_updated',
    entityType: 'PersonalizedProduct',
    entityId: savedId,
    // 🔴 كان `metadata: { name }` — **ومافيش متغيّر اسمه `name` في
    //    الدالة خالص**. TypeScript قبلها لأن `lib.dom` بتعرّف
    //    `declare const name: void` (خاصية `window.name` القديمة)،
    //    فالمترجم شافها متغيّرًا موجودًا. وعلى الخادم — نود مش
    //    متصفح — الاسم ده مش معرَّف، فبيرمي `ReferenceError`.
    //
    // ⚠️ **والرمية بتحصل بعد ما القاعدة تحفظ التعديل.** يعني
    //    الإداري بيعدّل، والتعديل **بيتحفظ فعلًا**، وNext بيمسح نصّ
    //    الاستثناء في الإنتاج (قاعدة «هـ») فبيشوف «حدث خطأ غير
    //    متوقع» — ويفتكر إن التعديل ضاع، فيعيده أو يسيبه.
    //
    //    ودي أوحش حالة ممكنة: **البيانات اتغيّرت والشاشة بتقول
    //    إنها ما اتغيّرتش.**
    metadata: { name: checked.data.name },
  });

  revalidatePath('/dashboard/admin/products');
  revalidatePath('/dashboard/admin/products/platform');
  revalidatePath('/dashboard/publisher/products');
  revalidatePath('/enha-lak/library');
  revalidatePath('/enha-lak/custom');
  // صفحة كل منتج وصفحة كل ناشر والصفحة الرئيسية للقسم بيتخزّنوا ساعة —
  // من غير دول، منتج اتوافق عليه أو اتوقف كان بيفضل بحالته القديمة لحد ساعة.
  revalidatePath('/enha-lak');
  revalidatePath('/enha-lak/product/[slug]', 'page');
  revalidatePath('/enha-lak/publisher/[slug]', 'page');
  return { ok: true as const };
}

export type ProductStateResult = { ok: true } | { ok: false; error: string };

/**
 * إيقاف منتج عن العرض — أو رجوعه.
 *
 * ── ليه إيقاف لا حذف ────────────────────────────────────────
 *
 * ⚠️ **الحذف بيضيّع تاريخ الطلبات.** بنود الطلبات القديمة مربوطة
 *    بالمنتج، فحذفه بيخلّي طلبًا اتدفع تمنه يبان بلا منتج.
 *
 *    والجدول كان **مالوش مفتاح إيقاف أصلًا** (SQL 121)، فالإدارة
 *    كانت بين اختيارين: تسيب الغلط ظاهر للعميل، أو تمسح تاريخ
 *    الطلبات. ودي مشكلة واقعة مش نظرية — فيه منتجان بنفس الاسم
 *    «اعماق البحار» بفرق 5,500 جنيه.
 *
 * ── والإيقاف بيعمل تلات حاجات ───────────────────────────────
 *
 *   ① بيختفي من المكتبة وصفحة الناشر وخريطة الموقع
 *   ② صفحته بترجّع 404 — لا صفحة بسعر وزرّ بيترفض
 *   ③ **وبيترفض في الطلبات الجديدة بمحفّز في القاعدة** — يعني
 *      حتى سلة قديمة مفتوحة في متصفح عميل مش هتعدّي
 *
 * ⚠️ **والتالتة هي اللي بتخلّيه إيقافًا حقيقيًّا.** من غيرها كان
 *    إخفاءً من الشاشة وبس، وأي نداء مباشر بيعدّي (قاعدة «ع»).
 */
export async function setProductActive(
  productId: string,
  isActive: boolean,
): Promise<ProductStateResult> {
  const currentUser = await getCurrentUser();
  if (!hasAdminPermission(currentUser, 'canManagePublishers')) {
    return { ok: false, error: 'غير مصرح لك بتعديل المنتجات' };
  }

  const supabase = await createClient();

  // ⚠️ بـ`select()`: الكتابة على صفر صفوف بتنجح في صمت (قاعدة «و»).
  //    والفحص على **القيمة** لا على رجوع الصف — الصف ممكن يرجع
  //    والقيمة تفضل قديمة لو محفّز تدخّل.
  const { data: saved, error } = await supabase
    .from('personalized_products')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select('id, is_active, name');

  if (error) {
    console.error('Error toggling product state', error);
    return { ok: false, error: 'تعذّر تنفيذ الإجراء.' };
  }
  if (!saved || saved.length === 0) {
    return { ok: false, error: 'المنتج مش موجود، أو القاعدة رفضت الإجراء.' };
  }
  if (saved[0].is_active !== isActive) {
    return { ok: false, error: 'القاعدة رجّعت القيمة القديمة — الإجراء ما تمّش.' };
  }

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: isActive ? 'إرجاع منتج للعرض' : 'إيقاف منتج عن العرض',
    entityType: 'PersonalizedProduct',
    entityId: productId,
    metadata: { name: saved[0].name },
  });

  revalidatePath('/dashboard/admin/products');
  revalidatePath('/dashboard/admin/products/platform');
  revalidatePath(`/dashboard/admin/products/${productId}`);
  revalidatePath('/enha-lak/library');
  revalidatePath('/enha-lak/custom');
  // صفحة كل منتج وصفحة كل ناشر والصفحة الرئيسية للقسم بيتخزّنوا ساعة —
  // من غير دول، منتج اتوافق عليه أو اتوقف كان بيفضل بحالته القديمة لحد ساعة.
  revalidatePath('/enha-lak');
  revalidatePath('/enha-lak/product/[slug]', 'page');
  revalidatePath('/enha-lak/publisher/[slug]', 'page');
  return { ok: true };
}

/**
 * مراجعة منتج — اعتماد أو رفض (ملف 130).
 *
 * ⚠️ **الشاشة دي هي اللي بتخلّي «الموافقة» حقيقية.** من غيرها
 *    المنتج بيدخل «في الانتظار» ويفضل واقفًا عن البيع للأبد،
 *    والناشر يفتكر إن الموقع باظ.
 */
export async function reviewProduct(formData: FormData) {
  let actorName = 'إداري';
  let actorId: string | undefined;
  try {
    const admin = await requireAdmin('canManageCatalog');
    actorName = admin.fullName ?? 'إداري';
    actorId = admin.id;
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'غير مصرح' };
  }

  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  if (!id) return { ok: false as const, error: 'المنتج غير محدد' };
  if (decision !== 'approved' && decision !== 'rejected') {
    return { ok: false as const, error: 'القرار غير معروف' };
  }
  // ⚠️ الرفض بلا سبب بيسيب الناشر يعيد نفس المنتج — ومحدش مستفيد.
  if (decision === 'rejected' && note.length < 3) {
    return { ok: false as const, error: 'اكتب سبب الرفض عشان الناشر يعرف يصلّح إيه' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('personalized_products')
    .update({
      review_status: decision,
      review_note: decision === 'rejected' ? note : null,
    })
    .eq('id', id)
    // ⚠️ **المعلَّق وحده.** من غير الشرط ده، ضغطتان على «اعتماد»
    //    من تبويبين مفتوحين بتعدّي الاتنين، والتانية بتعيد اعتماد
    //    منتج الناشر غيّره بعد الأولى — فالمحتوى الجديد بيتنشر
    //    بموافقة على القديم.
    .eq('review_status', 'pending')
    .select('id, name, slug')
    .maybeSingle();

  if (error) {
    console.error('تعذّر مراجعة المنتج', error);
    return { ok: false as const, error: 'تعذّر حفظ القرار' };
  }
  if (!data) {
    return { ok: false as const, error: 'تم البتّ في المنتج ده من قبل — حدّث الصفحة' };
  }

  await logAuditAction({
    actorProfileId: actorId,
    actorName,
    action: decision === 'approved' ? 'product_approved' : 'product_rejected',
    entityType: 'PersonalizedProduct',
    entityId: id,
    metadata: { name: data.name },
  });

  revalidatePath('/dashboard/admin/products');
  revalidatePath('/dashboard/admin/products/review');
  revalidatePath('/dashboard/publisher/products');
  revalidatePath('/enha-lak/library');
  revalidatePath('/enha-lak/custom');
  // صفحة كل منتج وصفحة كل ناشر والصفحة الرئيسية للقسم بيتخزّنوا ساعة —
  // من غير دول، منتج اتوافق عليه أو اتوقف كان بيفضل بحالته القديمة لحد ساعة.
  revalidatePath('/enha-lak');
  revalidatePath('/enha-lak/product/[slug]', 'page');
  revalidatePath('/enha-lak/publisher/[slug]', 'page');
  revalidatePath(`/enha-lak/product/${data.slug}`);
  return { ok: true as const };
}

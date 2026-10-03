'use client';

import { uploadPrivatePhoto, type PrivatePhoto } from '@/lib/private-upload-client';
import { addonsDisplayTotal, basePriceForFormat, electronicAvailable, FORMAT_LABELS, type ItemFormat } from '@/lib/item-format';
import React, { useEffect, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { wizardSchema, type WizardFormValues } from './personalization-schema';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { AddonProduct, PersonalizedProduct } from '@/types';

import { WizardStepper } from './wizard-steps/WizardStepper';
import { OrderSummarySidebar } from './wizard-steps/OrderSummarySidebar';
import { Step1ChildInfo } from './wizard-steps/Step1ChildInfo';
import { Step2Details } from './wizard-steps/Step2Details';
import { Step3Addons } from './wizard-steps/Step3Addons';
import { Step4Review } from './wizard-steps/Step4Review';
import { useCart } from '@/context/CartContext';
import { resolveWizardChild } from '@/app/actions/family';
import {
  checkExtraAnswers,
  snapshotAnswers,
  type CustomizationField,
} from '@/lib/customization-fields';

/**
 * كل حقل والخطوة اللي بيتملا فيها واسمه بالعربي.
 *
 * ── ليه الجدول ده موجود ─────────────────────────────────────
 *
 * زرار «إضافة للسلة» هو `type="submit"`، و`handleSubmit` في
 * react-hook-form **مبينفّذش حاجة** لو أي حقل في المخطّط كله باظ —
 * ومبيقولش. النتيجة: العميل بيدوس، والصفحة ساكتة، وهو فاكر إن الزر
 * اتعطّل. وده بالظبط اللي بلّغ عنه المستخدم.
 *
 * وأشهر سبب: الصورة الشخصية. الملفات **مش بتتحفظ** في
 * `sessionStorage` (مفيش طريقة)، فأي تحديث للصفحة وإنت في خطوة ٤
 * بيضيّع الصورة، والتحقق بيرفض، والزر بيسكت.
 *
 * الجدول ده بيخلّي الرفض يتحوّل لرسالة بإسم الحقل، والمعالج بيرجّع
 * العميل للخطوة اللي فيها المشكلة.
 */
const FIELD_STEP: Record<string, { step: number; label: string }> = {
  familyMemberId: { step: 1, label: 'اختيار الطفل' },
  newChildName: { step: 1, label: 'اسم الطفل' },
  newChildBirthDate: { step: 1, label: 'تاريخ ميلاد الطفل' },
  newChildGender: { step: 1, label: 'نوع الطفل' },
  heroDescription: { step: 2, label: 'وصف البطل' },
  familyMemberNames: { step: 2, label: 'أسماء أفراد العائلة' },
  storyGoal: { step: 2, label: 'الهدف التربوي' },
  customStoryGoal: { step: 2, label: 'الهدف اللي في بالك' },
  facePhotoFile: { step: 2, label: 'الصورة الشخصية' },
  secondPhotoFile: { step: 2, label: 'الصورة الإضافية' },
  dedicationText: { step: 2, label: 'الإهداء' },
  monthlyGoals: { step: 2, label: 'أهداف الشهور' },
  selectedAddonIds: { step: 3, label: 'الإضافات' },
  customizedAddonIds: { step: 3, label: 'تخصيص الإضافات' },
};


export function PersonalizationWizard({
  product,
  addons = [],
  subscription,
  addonDiscountPercent = 0,
  extraFields = [],
}: {
  product: PersonalizedProduct;
  /** خانات التخصيص اللي الإدارة ضافتها (ملف 06) — بتظهر في الخطوة ٢. */
  extraFields?: CustomizationField[];
  /** الإضافات المتاحة — بتيجي من القاعدة عن طريق الصفحة. */
  addons?: AddonProduct[];
  /**
   * اشتراك صندوق الرحلة (ملف 140): هدف لكل شهر، ومفيش خطوة إضافات
   * (قرار تامر: المجانية بس)، والطلب بيروح لدالة الاشتراك.
   */
  subscription?: { planId: string; months: number };
  /** خصم المشترك الحالي على الإضافات — للعرض (القاعدة بتحسبه لوحدها). */
  addonDiscountPercent?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { addItem } = useCart();
  
  const currentStep = parseInt(searchParams?.get('step') || '1', 10);
  const [isLoaded, setIsLoaded] = useState(false);

  const methods = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      selectedAddonIds: [],
      customizedAddonIds: [],
      format: 'printed',
      mode: subscription ? 'subscription' : 'single',
      monthlyGoals: subscription ? Array.from({ length: subscription.months }, () => '') : undefined,
      extraFields: {},
    },
    mode: 'onChange',
  });

  const {
    handleSubmit,
    trigger,
    getValues,
    reset,
    formState: { isSubmitting },
  } = methods;
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(`wizard_state_${product.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Exclude file objects from restoring
        const { facePhotoFile, secondPhotoFile, ...rest } = parsed;
        reset({ ...methods.getValues(), ...rest });
      } catch (e) {
        console.error("Failed to parse saved form state", e);
      }
    }
    setIsLoaded(true);
  }, [product.id, reset, methods]);

  const handleNext = async (stepFields: (keyof WizardFormValues)[]) => {
    setUploadError('');
    const isValid = await trigger(stepFields);
    if (!isValid) {
      // ⚠️ من غير السطر ده الزر بيرجع false ومبيعملش حاجة — وده اللي
      //    خلّى الخطوة ١ مقفولة على كل عميل عنده أطفال قبل كده.
      setUploadError(describeErrors(stepFields as string[]));
      return;
    }
    // خانات الإدارة (ملف 06) — برّه مخطّط zod لأنها جاية من القاعدة.
    if (currentStep === 2) {
      const problem = checkExtraAnswers(extraFields, getValues('extraFields'));
      if (problem) {
        setUploadError(problem);
        return;
      }
    }
    const values = getValues();
    const { facePhotoFile, secondPhotoFile, ...rest } = values;
    sessionStorage.setItem(`wizard_state_${product.id}`, JSON.stringify(rest));
    // الاشتراك مالوش خطوة إضافات: من ٢ على ٤ على طول.
    const next = subscription && currentStep === 2 ? 4 : currentStep + 1;
    router.push(`${pathname}?step=${next}`);
  };

  /** بيحوّل أخطاء التحقق لرسالة عربية فيها أسماء الحقول. */
  const describeErrors = (only?: string[]) => {
    const errors = methods.formState.errors as Record<string, { message?: string }>;
    const names = Object.keys(errors).filter((n) => !only || only.includes(n));
    if (names.length === 0) return 'في بيانات ناقصة — راجع الخطوات السابقة.';
    const parts = names.map((n) => {
      const label = FIELD_STEP[n]?.label ?? n;
      const message = errors[n]?.message;
      return message ? `${label}: ${message}` : label;
    });
    return `محتاجين نظبّط ده الأول — ${parts.join(' · ')}`;
  };

  /**
   * الضغطة اتستلمت والتحقق رفض.
   *
   * بنقول السبب **وبنرجّع العميل للخطوة اللي فيها المشكلة** بدل ما
   * يفضل في خطوة ٤ يبصّ على زر ساكت.
   */
  const onInvalid = (errors: Record<string, unknown>) => {
    const names = Object.keys(errors);
    const steps = names.map((n) => FIELD_STEP[n]?.step).filter(Boolean) as number[];
    setUploadError(describeErrors(names));
    const target = steps.length ? Math.min(...steps) : null;
    if (target && target !== currentStep) {
      router.push(`${pathname}?step=${target}`);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      const prev = subscription && currentStep === 4 ? 2 : currentStep - 1;
      router.push(`${pathname}?step=${prev}`);
    }
  };

  const onSubmit = async (data: WizardFormValues) => {
    // خانات الإدارة الإلزامية — جلسة قديمة في المتصفح ممكن تعدّي الخطوة ٢
    // من غير ما تتفحص (الإدارة ضافت خانة إلزامية بعدها).
    const extraProblem = checkExtraAnswers(extraFields, data.extraFields);
    if (extraProblem) {
      setUploadError(extraProblem);
      if (currentStep !== 2) router.push(`${pathname}?step=2`);
      return;
    }
    // إجابات خانات الإدارة **ومعاها اسم الخانة** — الطلب يفضل مقروء لو
    // الخانة اتغيّرت أو اتمسحت بعدين.
    const extraAnswers = snapshotAnswers(extraFields, data.extraFields);

    // 0. Upload the photos the customer chose.
    //
    // Only the file NAME used to be kept: the File itself was dropped, so the
    // book was ordered without the photo it is built from, while the review
    // step said "تم إرفاق صورة شخصية".
    //
    // ⚠️ **صور خاصة** (`@/lib/cloudinary-private`): كانت بتترفع برابط عام
    //    دائم. دلوقتي الطلب بيحفظ رقم الصورة بس، والإدارة وحدها تفتحها.
    let childPhoto: PrivatePhoto | undefined;
    let secondPhoto: PrivatePhoto | undefined;
    try {
      if (data.facePhotoFile) {
        childPhoto = await uploadPrivatePhoto(data.facePhotoFile, 'children');
      }
      if (data.secondPhotoFile) {
        secondPhoto = await uploadPrivatePhoto(data.secondPhotoFile, 'children');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
      return;
    }

    // المشارك: اختيار من العائلة أو إضافة جديد — والدالة بتعيد استخدام
    // الملف الموجود بدل ما تعمل نسخة جديدة مع كل طلب.
    let childName = '';
    let finalChildId = '';
    try {
      const resolved = await resolveWizardChild({
        familyMemberId: data.familyMemberId,
        newChildName: data.newChildName,
        newChildBirthDate: data.newChildBirthDate,
        newChildGender: data.newChildGender,
      });
      childName = resolved.childName;
      finalChildId = resolved.childId ?? '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'تعذّر حفظ بيانات المشارك');
      return;
    }

    // النوع: لو المنتج مالوش إلكتروني، أي قيمة غير «مطبوعة» بتتجاهل
    // (جلسة قديمة في المتصفح مثلًا) بدل ما القاعدة ترفض الطلب كله.
    // ── اشتراك الصندوق (ملف 140) ───────────────────────────
    if (subscription) {
      addItem({
        id: `box-${subscription.planId}-${Date.now()}`,
        productId: subscription.planId,
        name: product.name,
        // السعر للعرض — القاعدة بتسعّر من الخطة، والشحن × الشهور في الدفع.
        price: product.price,
        quantity: 1,
        type: 'subscription',
        boxPlanId: subscription.planId,
        boxMonths: subscription.months,
        customizationData: {
          recipientType: 'child',
          childId: finalChildId || undefined,
          childName,
          childPhoto,
          secondPhoto,
          heroDescription: data.heroDescription,
          dedicationText: data.dedicationText?.trim() || undefined,
          familyMemberNames: data.familyMemberNames,
          monthlyGoals: (data.monthlyGoals ?? []).map((g) => g.trim()),
          ...(extraAnswers.length > 0 ? { extraFields: extraAnswers } : {}),
        },
      });
      sessionStorage.removeItem(`wizard_state_${product.id}`);
      router.push('/cart');
      return;
    }

    const format: ItemFormat =
      electronicAvailable(product) && data.format ? data.format : 'printed';

    // 2. Add to cart
    addItem({
      id: product.id + '-' + Date.now(),
      productId: product.id,
      name: format === 'printed' ? product.name : `${product.name} — ${FORMAT_LABELS[format]}`,
      // للعرض بس — القاعدة بتسعّر من الجدول. ⚠️ **بالإضافات**: كان سعر
      // القصة لوحده، والعميل يتقاله «حوّل» رقمًا أقل من طلبه.
      price:
        basePriceForFormat(product, format) +
        addonsDisplayTotal(addons, data.selectedAddonIds, data.customizedAddonIds ?? [], addonDiscountPercent),
      format,
      quantity: 1,
      type: product.category === 'subscription' ? 'subscription' : 'custom',
      imageUrl: product.coverImageUrl || undefined,
      customizationData: {
        recipientType: 'child',
        childId: finalChildId || undefined,
        childName,
        childPhoto,
        secondPhoto,
        heroDescription: data.heroDescription,
        // «هدف آخر» بيتحفظ بنص العميل نفسه، مش بكلمة 'other'.
        storyGoal:
          data.storyGoal === 'other'
            ? (data.customStoryGoal ?? '').trim()
            : data.storyGoal,
        dedicationText: data.dedicationText?.trim() || undefined,
        familyMemberNames: data.familyMemberNames,
        ...(extraAnswers.length > 0 ? { extraFields: extraAnswers } : {}),
        selectedAddonIds: data.selectedAddonIds,
        customizedAddonIds: data.customizedAddonIds ?? [],
      },
      addonIds: data.selectedAddonIds,
      // القاعدة بتضيف سعر التخصيص للإضافات دي وحدها.
      customizedAddonIds: data.customizedAddonIds ?? [],
    });

    // Clear session storage
    sessionStorage.removeItem(`wizard_state_${product.id}`);
    
    // Redirect
    router.push('/cart');
  };

  if (!isLoaded) return null;

  return (
    <FormProvider {...methods}>
      {/* ⚠️ **كان `flex` والملخص `w-96 shrink-0` جنب الفورم في كل المقاسات.**
          على موبايل ٣٩٠ بكسل الملخص لوحده ٣٨٤ — فالفورم كان بيتزنق في
          شريط ضيق والصفحة بتتمرّر بالعرض. دلوقتي عمود واحد تحت `lg`،
          والملخص تحت الخطوات (زي معالج المكتبة). */}
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="mx-auto grid w-full max-w-7xl items-start gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8 lg:py-12"
      >
        <div className="min-w-0">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <WizardStepper currentStep={currentStep} skipSteps={subscription ? [3] : []} />
            
            {uploadError && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                {uploadError}
              </div>
            )}

            <div className="mt-8">
              {currentStep === 1 && <Step1ChildInfo onNext={() => handleNext(['familyMemberId', 'newChildName', 'newChildBirthDate', 'newChildGender'])} />}
              {currentStep === 2 && (
                <Step2Details
                  monthlyGoals={subscription?.months}
                  extraFields={extraFields}
                  onNext={() => handleNext(['heroDescription', 'familyMemberNames', 'storyGoal', 'customStoryGoal', 'facePhotoFile', 'monthlyGoals'])}
                  onPrev={handlePrev}
                />
              )}
              {currentStep === 3 && !subscription && <Step3Addons addons={addons} onNext={() => handleNext(['selectedAddonIds', 'customizedAddonIds'])} onPrev={handlePrev} />}
              {(currentStep === 4 || (subscription && currentStep === 3)) && (
                <Step4Review
                  onPrev={handlePrev}
                  product={product}
                  pending={isSubmitting}
                  subscriptionMonths={subscription?.months}
                  extraFields={extraFields}
                />
              )}
            </div>
          </div>
        </div>
        
        <div className="w-full lg:sticky lg:top-24">
          <OrderSummarySidebar
            product={product}
            addons={addons}
            addonDiscountPercent={addonDiscountPercent}
            subscriptionMonths={subscription?.months}
          />
        </div>
      </form>
    </FormProvider>
  );
}

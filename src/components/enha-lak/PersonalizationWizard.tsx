'use client';

import { uploadPrivatePhoto, type PrivatePhoto } from '@/lib/private-upload-client';
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
  selectedAddonIds: { step: 3, label: 'الإضافات' },
  customizedAddonIds: { step: 3, label: 'تخصيص الإضافات' },
};


export function PersonalizationWizard({
  product,
  addons = [],
}: {
  product: PersonalizedProduct;
  /** الإضافات المتاحة — بتيجي من القاعدة عن طريق الصفحة. */
  addons?: AddonProduct[];
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
    const values = getValues();
    const { facePhotoFile, secondPhotoFile, ...rest } = values;
    sessionStorage.setItem(`wizard_state_${product.id}`, JSON.stringify(rest));
    router.push(`${pathname}?step=${currentStep + 1}`);
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
      router.push(`${pathname}?step=${currentStep - 1}`);
    }
  };

  const onSubmit = async (data: WizardFormValues) => {
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

    // 2. Add to cart
    addItem({
      id: product.id + '-' + Date.now(),
      productId: product.id,
      name: product.name,
      price: product.price,
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
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="mx-auto flex max-w-7xl gap-8 px-6 py-12 items-start">
        <div className="flex-1">
          <div className="mb-8 rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
            <WizardStepper currentStep={currentStep} />
            
            {uploadError && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                {uploadError}
              </div>
            )}

            <div className="mt-8">
              {currentStep === 1 && <Step1ChildInfo onNext={() => handleNext(['familyMemberId', 'newChildName', 'newChildBirthDate', 'newChildGender'])} />}
              {currentStep === 2 && <Step2Details onNext={() => handleNext(['heroDescription', 'familyMemberNames', 'storyGoal', 'customStoryGoal', 'facePhotoFile'])} onPrev={handlePrev} />}
              {currentStep === 3 && <Step3Addons addons={addons} onNext={() => handleNext(['selectedAddonIds', 'customizedAddonIds'])} onPrev={handlePrev} />}
              {currentStep === 4 && (
                <Step4Review onPrev={handlePrev} product={product} pending={isSubmitting} />
              )}
            </div>
          </div>
        </div>
        
        <div className="w-96 shrink-0 sticky top-24">
          <OrderSummarySidebar product={product} addons={addons} />
        </div>
      </form>
    </FormProvider>
  );
}

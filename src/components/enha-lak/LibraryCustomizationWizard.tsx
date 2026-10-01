'use client';

import { uploadPrivatePhoto, type PrivatePhoto } from '@/lib/private-upload-client';
import { formatPrice } from '@/lib/utils';

import React, { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PersonalizedProduct, AddonProduct } from '@/types';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';

import { WizardStepper } from './wizard-steps/WizardStepper';
import { Step1ChildInfo } from './wizard-steps/Step1ChildInfo';
import { Step2CoverDetails } from './wizard-steps/Step2CoverDetails';
import { Step3Addons } from './wizard-steps/Step3Addons';
import { OrderSummarySidebar } from './wizard-steps/OrderSummarySidebar';
import { Step3LibraryReview } from './wizard-steps/Step3LibraryReview';
import Image from 'next/image';
import { resolveWizardChild } from '@/app/actions/family';

const librarySchema = z.object({
  familyMemberId: z.string().optional(),
  newChildName: z.string().optional(),
  newChildBirthDate: z.string().optional(),
  newChildGender: z.string().optional(),
  
  dedicationText: z.string().optional(),
  // ⚠️ **الصورة إجبارية — وكانت اختيارية.**
  //
  //    المنتج ده اسمه «تخصيص الغلاف»، والتخصيص **هو الصورة**. من
  //    غيرها العميل بيدفع تمن كتاب مخصّص وبيستلم النسخة العادية،
  //    والمنصة بتطبع طلبًا مالوش أي تخصيص.
  //
  //    وكانت `optional()` فالطلب بيعدّي بلا صورة، ومحدش بيلاحظ إلا
  //    عند الطباعة — بعد الدفع.
  coverPhotoFile: z.any(),

  // ⚠️ **نفس أسماء حقول المعالج المخصّص بالظبط.** السلة والقاعدة
  //    بيقروا `addonIds` و`customizedAddonIds`، ولو المكتبة سمّتهم
  //    بأسماء تانية كانت الإضافات هتتحفظ في مكان محدّش بيقرا منه —
  //    الطلب بيعدّي والعميل بيدفع ومحدش بيشحنله الإضافة.
  // ⚠️ **بلا `.default([])`**: `default` بتخلّي النوع الداخل اختياريًّا
  //    والخارج إجباريًّا، فمحلّل النموذج بيرفض التطابق. ونفس الشكل
  //    المستعمل في مخطط المسار المخصّص بالظبط.
  selectedAddonIds: z.array(z.string()),
  customizedAddonIds: z.array(z.string()).optional(),
}).refine(data => data.familyMemberId || data.newChildName, {
  message: 'يجب اختيار طفل من العائلة أو إضافة طفل جديد',
  path: ['newChildName'],
// ⚠️ **الشرط على الكائن لا على الحقل** عن قصد: `refine` على الحقل
//    بيخلّي النوع الخارج `File` والداخل `undefined`، فمحلّل النموذج
//    بيرفض التطابق — نفس المصيدة اللي وقعت فيها مع `.default([])`.
//    والشكل ده هو نفسه المستعمل لشرط الطفل فوق.
}).refine(data => data.coverPhotoFile instanceof File, {
  message: 'اختار صورة الطفل للغلاف',
  path: ['coverPhotoFile'],
});

type LibraryFormValues = z.infer<typeof librarySchema>;

/** اسم كل حقل بالعربي وخطوته — عشان الرفض يطلع برسالة مفهومة. */
const FIELD_STEP: Record<string, { step: number; label: string }> = {
  familyMemberId: { step: 1, label: 'اختيار الطفل' },
  newChildName: { step: 1, label: 'اسم الطفل' },
  newChildBirthDate: { step: 1, label: 'تاريخ ميلاد الطفل' },
  newChildGender: { step: 1, label: 'نوع الطفل' },
  dedicationText: { step: 2, label: 'الإهداء' },
  coverPhotoFile: { step: 2, label: 'صورة الغلاف' },
  selectedAddonIds: { step: 3, label: 'الإضافات' },
  customizedAddonIds: { step: 3, label: 'تخصيص الإضافات' },
};

export function LibraryCustomizationWizard({
  product,
  addons = [],
}: {
  product: PersonalizedProduct;
  /**
   * ⚠️ **الخطوة دي كانت غايبة من مسار المكتبة كله.** العميل اللي
   *    بيطلب كتابًا من المكتبة مكانش بيتعرض عليه ولا إضافة — لا
   *    بيشوفها ولا يقدر يشتريها — بينما اللي بيطلب كتابًا مخصّصًا
   *    بيشوفها. نفس المنصة ونفس السلة، ومسارين مختلفين.
   */
  addons?: AddonProduct[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { addItem } = useCart();
  
  const currentStep = parseInt(searchParams?.get('step') || '1', 10);
  
  const methods = useForm<LibraryFormValues>({
    resolver: zodResolver(librarySchema),
    mode: 'onChange',
    defaultValues: {
      familyMemberId: '',
      newChildName: '',
      newChildBirthDate: '',
      newChildGender: '',
      dedicationText: '',
      coverPhotoFile: undefined,
      selectedAddonIds: [],
      customizedAddonIds: [],
    }
  });

  const [isClient, setIsClient] = useState(false);
  const [uploadError, setUploadError] = useState('');
  useEffect(() => {
    setIsClient(true);
    const saved = sessionStorage.getItem(`library_wizard_${product.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(key => {
          if (key !== 'coverPhotoFile') {
            methods.setValue(key as any, parsed[key]);
          }
        });
      } catch (e) {}
    }
  }, [product.id, methods]);

  useEffect(() => {
    const subscription = methods.watch((value) => {
      const toSave = { ...value };
      delete toSave.coverPhotoFile;
      sessionStorage.setItem(`library_wizard_${product.id}`, JSON.stringify(toSave));
    });
    return () => subscription.unsubscribe();
  }, [methods, product.id]);

  const goToStep = (step: number) => {
    router.push(`${pathname}?step=${step}`);
  };

  /** رسالة عربية من أخطاء التحقق — بدل السكوت. */
  const describeErrors = (names: string[]) => {
    const errors = methods.formState.errors as Record<string, { message?: string }>;
    const list = names.length ? names : Object.keys(errors);
    if (list.length === 0) return 'في بيانات ناقصة — راجع الخطوات السابقة.';
    return (
      'محتاجين نظبّط ده الأول — ' +
      list
        .map((n) => {
          const label = FIELD_STEP[n]?.label ?? n;
          const message = errors[n]?.message;
          return message ? `${label}: ${message}` : label;
        })
        .join(' · ')
    );
  };

  const onNext = async () => {
    setUploadError('');

    // ══ 🔴 التحقّق على **الخطوة الحالية وحدها** ══════════════
    //
    // كان `methods.trigger()` بلا حقول — وده بيتحقّق من **النموذج
    // كله**. ولمّا بقت صورة الغلاف إجبارية، الزائر واقف في خطوة ١
    // (بيانات الطفل) وبيضغط «التالي» فيلاقي:
    //
    //     «محتاجين نظبّط ده الأول — صورة الغلاف: اختار صورة الطفل»
    //
    // الرسالة **صح والمكان غلط**: بتطلب منه حاجة الخطوة اللي هو
    // فيها مافيهاش، والخانة اللي بتتكلم عنها مش موجودة قدامه —
    // فمايعرفش يعمل إيه، والزرّ شكله متعطّل بلا سبب.
    //
    // ⚠️ **والارتداد ده جه من تعديلي أنا**: الصورة كانت اختيارية
    //    فالتحقّق الشامل كان بيعدّي بالصدفة. أول ما بقت إجبارية،
    //    العيب اللي كان مستخبي بان.
    //
    // `FIELD_STEP` هي نفس الخريطة اللي `onInvalid` بتستعملها
    // عشان ترجّع الزائر للخطوة الناقصة — فالمصدر واحد.
    const fieldsInStep = (Object.keys(FIELD_STEP) as (keyof LibraryFormValues)[]).filter(
      (name) => FIELD_STEP[name as string].step === currentStep,
    );

    const isValid = await methods.trigger(fieldsInStep);
    if (!isValid) {
      // ⚠️ **اللي وقع فعلًا وبس** — لا كل حقول الخطوة.
      //    `describeErrors` بتسرد أي اسم يتبعتلها، والخانة السليمة
      //    بتطلع باسمها بلا سبب، فالزائر بيدوّر في خانة مافيهاش
      //    حاجة.
      const failed = (fieldsInStep as string[]).filter(
        (name) => (methods.formState.errors as Record<string, unknown>)[name],
      );
      // كان `if (isValid) goToStep(...)` وبس: الرفض مكانش بيقول
      // حاجة، فالزرّ شكله متعطّل.
      setUploadError(describeErrors(failed));
      return;
    }
    goToStep(currentStep + 1);
  };

  /** الضغطة اتستلمت والتحقق رفض — بنقول ونرجّع للخطوة الناقصة. */
  const onInvalid = (errors: Record<string, unknown>) => {
    const names = Object.keys(errors);
    setUploadError(describeErrors(names));
    const steps = names.map((n) => FIELD_STEP[n]?.step).filter(Boolean) as number[];
    const target = steps.length ? Math.min(...steps) : null;
    if (target && target !== currentStep) goToStep(target);
  };

  const onPrev = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: LibraryFormValues) => {
    // The chosen cover photo used to be dropped here entirely: the order went
    // through with a child's name and a dedication, and no picture.
    // ⚠️ صورة الطفل على الغلاف **خاصة** (`@/lib/cloudinary-private`).
    let coverPhoto: PrivatePhoto | undefined;
    try {
      if (data.coverPhotoFile instanceof File) {
        coverPhoto = await uploadPrivatePhoto(data.coverPhotoFile, 'covers');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
      return;
    }

    // بيانات الطفل كانت بتتجمع هنا و**ما بتتحفظش خالص**، والاسم اللي
    // بيتكتب في الطلب كان نص ثابت «مشارك من العائلة» لو الخانة فاضية —
    // حتى لو العميل اختار طفل من عيلته. يعني الكتاب يتطبع باسم غلط.
    let childName = '';
    let childId: string | undefined;
    try {
      const resolved = await resolveWizardChild({
        familyMemberId: data.familyMemberId,
        newChildName: data.newChildName,
        newChildBirthDate: data.newChildBirthDate,
        newChildGender: data.newChildGender as 'male' | 'female' | '' | undefined,
      });
      childName = resolved.childName;
      childId = resolved.childId;
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'تعذّر حفظ بيانات المشارك');
      return;
    }

    addItem({
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      type: 'book',
      imageUrl: product.coverImageUrl || undefined,
      customizationData: {
        recipientType: 'child',
        childId,
        childName,
        dedicationText: data.dedicationText,
        coverPhoto,
        selectedAddonIds: data.selectedAddonIds,
        customizedAddonIds: data.customizedAddonIds ?? [],
      },
      // ⚠️ **بره `customizationData` كمان** — دي مش تكرار: القاعدة
      //    بتقرا `addonIds` من جذر البند عشان تسعّرها وتضيفها
      //    للطلب، و`customizationData` بيانات وصفية بتتعرض وبس.
      //    لو اتحطّت في الوصف بس، العميل كان هيختار إضافة ومايتحسبش
      //    عليه تمنها ومحدش يشحنهاله.
      addonIds: data.selectedAddonIds,
      customizedAddonIds: data.customizedAddonIds ?? [],
    });

    sessionStorage.removeItem(`library_wizard_${product.id}`);
    router.push('/cart');
  };

  if (!isClient) return null;

  return (
    <div className="mx-auto w-full max-w-6xl py-8">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-black text-slate-800">تخصيص الغلاف: {product.name}</h1>
        <p className="text-slate-600">أربع خطوات بسيطة لإضافة لمسة شخصية للكتاب</p>
      </div>

      <div className="mb-12 px-4 md:px-12">
        <div className="flex w-full items-center justify-between">
          {[
            { step: 1, label: 'بيانات الطفل' },
            { step: 2, label: 'تخصيص الغلاف' },
            { step: 3, label: 'الإضافات' },
            { step: 4, label: 'المراجعة' },
          ].map((s, idx) => {
            const isCompleted = currentStep > s.step;
            const isCurrent = currentStep === s.step;
            
            return (
              <div key={s.step} className="flex flex-col items-center gap-2 relative z-10 flex-1">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-colors
                  ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 
                    isCurrent ? 'bg-white border-blue-600 text-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                  {isCompleted ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s.step
                  )}
                </div>
                <span className={`text-sm font-bold ${isCurrent || isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                  {s.label}
                </span>
                
                {idx !== 3 && (
                  <div className={`absolute top-5 left-[-50%] w-full h-[2px] -z-10
                    ${currentStep > s.step ? 'bg-emerald-500' : 'bg-slate-200'}`} 
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 md:p-10">
            <FormProvider {...methods}>
              {uploadError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {uploadError}
                </div>
              )}
              <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)}>
                {currentStep === 1 && <Step1ChildInfo onNext={onNext} />}
                {currentStep === 2 && <Step2CoverDetails onNext={onNext} onPrev={onPrev} />}
                {/* نفس مكوّن الإضافات بتاع المسار المخصّص — مش نسخة
                    تانية: النسخة التانية كانت هتفترق عنه أول ما حد
                    يعدّل في واحد منهم. */}
                {currentStep === 3 && (
                  <Step3Addons addons={addons} onNext={onNext} onPrev={onPrev} />
                )}
                {currentStep === 4 && (
                  <Step3LibraryReview
                    onPrev={onPrev}
                    product={product}
                    pending={methods.formState.isSubmitting}
                  />
                )}
              </form>
            </FormProvider>
          </div>
        </div>

        {/* ══ 🔴 الملخّص كان مكتوبًا هنا بإيده — وبيكدب ══════════
            كان بيعرض `product.price` **وحده** كإجمالي. ومع خطوة
            الإضافات الجديدة، العميل كان هيختار إضافة بتمن، ويشوف
            إجماليًّا **مش شاملها**، ويوصل السلة يلاقي رقمًا تاني.

            ⚠️ **ودي مش غلطة عرض، دي وعد بسعر**: الرقم اللي في
               الملخّص هو اللي العميل بيقرّر على أساسه.

            و`OrderSummarySidebar` المشترك بيقرا الإضافات المختارة من
            النموذج وبيحسب الإجمالي الحقيقي — وهو نفسه اللي المسار
            المخصّص بيستعمله. نسخة تانية هنا كانت هتفترق عنه أول ما
            حد يعدّل في واحد منهم.

            (وكان فيه `text-emerald-500` للإجمالي = 2.62:1 على أبيض
             — راسب في المعيار. المكوّن المشترك ماشي على الرموز.) */}
        <div className="lg:col-span-1">
          <FormProvider {...methods}>
            <OrderSummarySidebar product={product} addons={addons} />
          </FormProvider>
        </div>
      </div>
    </div>
  );
}

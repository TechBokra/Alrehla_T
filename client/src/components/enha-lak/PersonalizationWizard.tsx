'use client';

import { uploadPrivatePhoto, type PrivatePhoto } from '@/lib/private-upload-client';
import { isSavedPhoto } from '@/lib/saved-photo';
import { PAUSED_MESSAGE } from '@/lib/delivery';
import Link from 'next/link';
import { Truck } from 'lucide-react';
import { addonsDisplayTotal, baseListPriceForFormat, basePriceForFormat, customizedAddonIdsFor, electronicAvailable, FORMAT_LABELS, itemNeedsShipping, selectedAddonsNeedShipping, type ItemFormat } from '@/lib/item-format';
import React, { useEffect, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { wizardSchema, type WizardFormValues } from './personalization-schema';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { AddonProduct, PersonalizedProduct } from '@/types';
import type { StoryGoal } from '@/lib/story-goals';

import {
  availableStyles,
  buildWritingStyleValue,
  DEFAULT_WRITING_STYLE,
  writingStyleProblem,
  type WritingDialect,
} from '@/lib/writing-style';

import { WizardStepper } from './wizard-steps/WizardStepper';
import { OrderSummarySidebar } from './wizard-steps/OrderSummarySidebar';
import { Step1ChildInfo } from './wizard-steps/Step1ChildInfo';
import { Step2Details } from './wizard-steps/Step2Details';
import { Step3Addons } from './wizard-steps/Step3Addons';
import { Step4Review } from './wizard-steps/Step4Review';
import { useCart, type CartItem } from '@/context/CartContext';
import { clearProductPhotos, loadPhoto, photoKey, savePhoto } from '@/lib/wizard-photo-store';
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
/**
 * آخر خطوة بتوصّل **للدفع**، مش للسلة (قرار تامر، ١٥ أكتوبر).
 *
 * العميل كان بيكمّل التخصيص كله — الاسم والصورة والأهداف — وبعدين
 * بيتحط في صفحة سلة فيها بند واحد وزرار «إتمام الطلب»: صفحة من غير
 * شغل، في أهم لحظة في الرحلة. السلة لسه موجودة (أيقونة الهيدر)
 * ولسه هي المخزن، بس بقت مش خطوة إجبارية.
 */
const CHECKOUT_PATH = '/enha-lak/checkout';

/** خانات الصور في المعالج — اللي بتتحفظ في المتصفح. */
const PHOTO_FIELDS = ['facePhotoFile', 'secondPhotoFile'] as const;

const FIELD_STEP: Record<string, { step: number; label: string }> = {
  familyMemberId: { step: 1, label: 'البيانات / اختيار المستفيد' },
  newChildName: { step: 1, label: 'الاسم' },
  newChildBirthDate: { step: 1, label: 'تاريخ الميلاد' },
  newChildGender: { step: 1, label: 'الجنس' },
  heroDescription: { step: 2, label: 'وصف البطل' },
  familyMemberNames: { step: 2, label: 'أسماء أفراد العائلة' },
  storyGoal: { step: 2, label: 'الهدف الأساسي' },
  writingStyle: { step: 2, label: 'أسلوب الكتابة' },
  writingDialect: { step: 2, label: 'اللهجة' },
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
  goals = [],
  writingDialects = [],
  deliveryPaused = false,
  pauseMessage = '',
}: {
  /** التوصيل متوقف من اللوحة — النسخة المطبوعة مش متاحة للطلب. */
  deliveryPaused?: boolean;
  pauseMessage?: string;
  product: PersonalizedProduct;
  /** اللهجات الفعّالة لخيار أسلوب الكتابة (القصة المخصّصة بس). */
  writingDialects?: WritingDialect[];
  /** خانات التخصيص اللي الإدارة ضافتها (ملف 06) — بتظهر في الخطوة ٢. */
  extraFields?: CustomizationField[];
  /** أهداف التخصيص للمنتج ده (ملف 12) — فاضية = الأربعة الأساسيين. */
  goals?: StoryGoal[];
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
  const { addItem, items, replaceItem } = useCart();

  // ⚠️ **وضع التعديل**: العميل جاي من السلة يصلّح بند موجود. من غيره
  //    كان لازم يحذف البند ويعيد كل خطوات التخصيص من الأول عشان يغيّر
  //    حرف في اسم الطفل.
  const editId = searchParams?.get('edit') ?? null;
  const editing = editId ? items.find((i) => i.id === editId) ?? null : null;

  /**
   * رابط خطوة في المعالج.
   *
   * ⚠️ كان `?step=N` بس، فأول ما العميل يضغط «التالي» وهو بيعدّل بند،
   *    الـ`edit` بيختفي من الرابط، والمعالج ينسى إنه في وضع تعديل —
   *    فيضيف بند جديد بدل ما يستبدل، وتبقى القصة مرتين في السلة.
   */
  const stepHref = (step: number) =>
    editId ? `${pathname}?step=${step}&edit=${encodeURIComponent(editId)}` : `${pathname}?step=${step}`;
  
  const currentStep = parseInt(searchParams?.get('step') || '1', 10);
  const [isLoaded, setIsLoaded] = useState(false);

  // أسلوب الكتابة: للقصة المخصّصة الواحدة بس (القاعدة بتقبله لـ`custom` وبس).
  // لو مفيش خيار متاح (منتج «لهجة بس» ومفيش لهجات فعّالة) الخيار بيتخفي ومبنوقّفش العميل.
  const styleChoices = availableStyles(product.writingStyles).filter(
    (s) => s !== 'dialect' || writingDialects.length > 0,
  );
  const showWritingStyle = !subscription && product.category === 'custom' && styleChoices.length > 0;

  /**
   * التوصيل متوقف: القصة المطبوعة مش ممكن تتطلب.
   *
   * ⚠️ لو المنتج ماعندوش نسخة إلكترونية خالص، الطلب كله متوقف — بنقول
   *    كده **قبل** ما العميل يبدأ يملا بيانات طفله، مش بعد ما يخلّص.
   *    (القاعدة بترفض الطلب أصلًا، ودي الرسالة اللي توفّر عليه الوقت.)
   */
  const blockedByPause = deliveryPaused && !electronicAvailable(product) && !subscription;
  const pauseText = pauseMessage.trim() || PAUSED_MESSAGE;
  const defaultStyle = styleChoices.includes(DEFAULT_WRITING_STYLE)
    ? DEFAULT_WRITING_STYLE
    : styleChoices[0];

  const methods = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      selectedAddonIds: [],
      customizedAddonIds: [],
      storyGoal: '',
      writingStyle: showWritingStyle ? defaultStyle : undefined,
      writingDialect: '',
      // ⚠️ التوصيل متوقف والمنتج ليه نسخة إلكترونية: نبدأ بيها بدل
      //    المطبوعة اللي مش هتعدّي أصلًا.
      format: deliveryPaused && electronicAvailable(product) ? 'electronic' : 'printed',
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
    // بند السلة أولى من الحالة المحفوظة: العميل طلب تعديل بند بعينه.
    if (editing) {
      const data = (editing.customizationData ?? {}) as Record<string, unknown>;
      const savedGoal = typeof data.storyGoal === 'string' ? data.storyGoal : '';
      // «هدف آخر» بيتحفظ بنص العميل، فلو مش من القايمة بنرجّعه لخانة الحر.
      const knownGoal = goals.some((g) => g.label === savedGoal);
      reset({
        ...methods.getValues(),
        familyMemberId: typeof data.childId === 'string' && data.childId ? data.childId : undefined,
        heroDescription: typeof data.heroDescription === 'string' ? data.heroDescription : '',
        dedicationText: typeof data.dedicationText === 'string' ? data.dedicationText : '',
        familyMemberNames: typeof data.familyMemberNames === 'string' ? data.familyMemberNames : '',
        storyGoal: savedGoal ? (knownGoal ? savedGoal : 'other') : '',
        customStoryGoal: savedGoal && !knownGoal ? savedGoal : '',
        writingStyle: typeof data.writingStyle === 'string'
          ? (data.writingStyle.split(':')[0] as never)
          : undefined,
        writingDialect: typeof data.writingStyle === 'string' && data.writingStyle.includes(':')
          ? data.writingStyle.split(':')[1]
          : '',
        // الصور المرفوعة قبل كده بتتحط زي ما هي — التحقق بيعدّيها
        // والرفع بيتخطّاها.
        facePhotoFile: (editing.customizationData as Record<string, unknown> | undefined)?.childPhoto,
        secondPhotoFile: (editing.customizationData as Record<string, unknown> | undefined)?.secondPhoto,
        newChildName: typeof data.childName === 'string' ? data.childName : '',
        format: editing.format ?? 'printed',
        selectedAddonIds: editing.addonIds ?? [],
        customizedAddonIds: editing.customizedAddonIds ?? [],
        extraFields: {},
      } as never);
    } else {
      const saved = sessionStorage.getItem(`wizard_state_${product.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // الملفات مش في `sessionStorage` — بتترجع من `IndexedDB` تحت.
          const { facePhotoFile, secondPhotoFile, ...rest } = parsed;
          reset({ ...methods.getValues(), ...rest });
        } catch (e) {
          console.error("Failed to parse saved form state", e);
        }
      }

      /* ══ الصور ══════════════════════════════════════════════
         ⚠️ **ودي كانت بتضيع مع كل تحديث للصفحة.** `sessionStorage`
            بيشيل نصوص بس، فالصور كانت مستثناة بسطرين فوق — والعميل
            اللي بيرجع للمعالج (من رابط «عدّلها» في الدفع مثلًا)
            بيلاقي كل بياناته موجودة والصورة راحت، فيرفعها تاني.

            `IndexedDB` بيشيل `File` زي ما هو. والصورة بتفضل في
            متصفحه وحده — مش بترتفع قبل الطلب (السبب في
            `lib/wizard-photo-store`). */
      void (async () => {
        for (const field of PHOTO_FIELDS) {
          const file = await loadPhoto(photoKey(product.id, field));
          // ⚠️ مابنكتبش فوق صورة العميل لو كان اختار واحدة جديدة
          //    بالفعل وإحنا بنقرا (القراءة غير متزامنة).
          if (file && !methods.getValues(field)) {
            methods.setValue(field, file as never, { shouldValidate: false });
          }
        }
      })();
    }
    // ⚠️ نداء واحد بس لـ`setIsLoaded` في نهاية التأثير — كان فيه نداء
    //    تاني في فرع التعديل من غير الاستثناء ده، والقاعدة بترفضه.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- استرجاع خطوات المعالج المحفوظة في المتصفح بعد أول رسم.
    setIsLoaded(true);
  }, [product.id, reset, methods, editing, goals]);

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
      if (showWritingStyle) {
        const styleProblem = writingStyleProblem(
          getValues('writingStyle'),
          getValues('writingDialect'),
          writingDialects,
          styleChoices,
        );
        if (styleProblem) {
          setUploadError(styleProblem);
          return;
        }
      }
    }
    const values = getValues();
    const { facePhotoFile, secondPhotoFile, ...rest } = values;
    sessionStorage.setItem(`wizard_state_${product.id}`, JSON.stringify(rest));

    /* ⚠️ **والصور في مخزن تاني.** `JSON.stringify(File)` بيطلّع `{}`،
       فالصور كانت بتتشال من الحفظ خالص — وأي تحديث للصفحة بيضيّعها.
       `IndexedDB` بيشيلها زي ما هي. وبنحفظ عند كل خطوة مش عند
       الاختيار: ساعتها الصورة تكون عدّت تحقق المخطّط (الحجم والنوع)،
       فمابنخزّنش ملفًا هيترفض. */
    for (const [field, file] of [
      ['facePhotoFile', facePhotoFile],
      ['secondPhotoFile', secondPhotoFile],
    ] as const) {
      if (file instanceof File) void savePhoto(photoKey(product.id, field), file);
    }
    // الاشتراك مالوش خطوة إضافات: من ٢ على ٤ على طول.
    const next = subscription && currentStep === 2 ? 4 : currentStep + 1;
    router.push(stepHref(next));
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
      router.push(stepHref(target));
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      const prev = subscription && currentStep === 4 ? 2 : currentStep - 1;
      router.push(stepHref(prev));
    }
  };

  const onSubmit = async (data: WizardFormValues) => {
    // خانات الإدارة الإلزامية — جلسة قديمة في المتصفح ممكن تعدّي الخطوة ٢
    // من غير ما تتفحص (الإدارة ضافت خانة إلزامية بعدها).
    const extraProblem = checkExtraAnswers(extraFields, data.extraFields);
    if (extraProblem) {
      setUploadError(extraProblem);
      if (currentStep !== 2) router.push(stepHref(2));
      return;
    }
    // أسلوب الكتابة — جلسة قديمة ممكن تعدّي الخطوة ٢ من غير اختيار.
    let writingStyle: ReturnType<typeof buildWritingStyleValue> = null;
    if (showWritingStyle) {
      const styleProblem = writingStyleProblem(
        data.writingStyle,
        data.writingDialect,
        writingDialects,
        styleChoices,
      );
      if (styleProblem) {
        setUploadError(styleProblem);
        if (currentStep !== 2) router.push(stepHref(2));
        return;
      }
      writingStyle = buildWritingStyleValue(data.writingStyle, data.writingDialect, writingDialects);
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
      // ⚠️ الصورة المحفوظة (وضع التعديل) مرفوعة خلاص — إعادة رفعها
      //    بتعمل نسخة تانية على Cloudinary وتضيّع الأصلية.
      if (isSavedPhoto(data.facePhotoFile)) {
        childPhoto = data.facePhotoFile;
      } else if (data.facePhotoFile) {
        childPhoto = await uploadPrivatePhoto(data.facePhotoFile, 'children');
      }
      if (isSavedPhoto(data.secondPhotoFile)) {
        secondPhoto = data.secondPhotoFile;
      } else if (data.secondPhotoFile) {
        secondPhoto = await uploadPrivatePhoto(data.secondPhotoFile, 'children');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
      // الصورة اتختارت في خطوة ٢ — نرجّعه هناك يغيّرها (اختبار HS0L).
      if (currentStep !== 2) router.push(stepHref(2));
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
      if (!resolved.ok) {
        setUploadError(resolved.error);
        return;
      }
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
        id: `box-${subscription.planId}-${crypto.randomUUID()}`,
        productId: subscription.planId,
        name: product.name,
        // السعر للعرض — القاعدة بتسعّر من الخطة، والشحن × الشهور في الدفع.
        price: product.price,
        quantity: 1,
        type: 'subscription',
        boxPlanId: subscription.planId,
        boxMonths: subscription.months,
        customizationData: {
          recipientType: data.familyMemberId === 'self' ? 'self' : 'child',
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
      // البند دخل السلة بصورته المرفوعة — النسخة اللي في المتصفح بقت زيادة.
      void clearProductPhotos(product.id, [...PHOTO_FIELDS]);
      router.push(CHECKOUT_PATH);
      return;
    }

    const format: ItemFormat =
      electronicAvailable(product) && data.format ? data.format : 'printed';

    // ملف 07: كل إضافة بتقبل التخصيص بتتخصص — من الإضافة نفسها، مش من
    // اختيار في النموذج (جلسة قديمة كان ممكن يكون فيها «بدون تخصيص»).
    const customizedAddonIds = customizedAddonIdsFor(addons, data.selectedAddonIds);

    /* ⚠️ **الحارس ده كان بيفحص النوع وبس — وده كان العطل.**
     *
     *    بلاغ تامر (١٨ أكتوبر): «الطلب أصلًا كان مقفول على نسخة
     *    إلكترونية فقط، وبرضه وقف في الطلب».
     *
     *    وهو كان صح: اختار «نسخة إلكترونية — من غير شحن» ومعاها
     *    **بوستر مطبوع** كإضافة. الشرط `format !== 'electronic'`
     *    بيعدّيه، والبند بينزل السلة، وبيموت في الدفع — لأن قاعدة
     *    الشحن الحقيقية هي «مطبوع **أو إضافة**».
     *
     *    يعني المعالج باعله تناقض: كارت بيقول «من غير شحن» وبند
     *    محتاج شحن. والحارس الأخير مامسكهوش.
     *
     *    دلوقتي بيستعمل `itemNeedsShipping` — نفس الدالة اللي
     *    الدفع والقاعدة بيحسبوا بيها. فمفيش تعريفين للشحن.
     */
    const addonsShip = selectedAddonsNeedShipping(addons, data.selectedAddonIds);
    if (
      deliveryPaused &&
      itemNeedsShipping({
        format,
        addonIds: data.selectedAddonIds,
        addonsNeedShipping: addonsShip,
      })
    ) {
      // ⚠️ «بسبب الإضافات» بقى يعني **إضافة بتتشحن**، مش أي إضافة.
      //    الإضافة الإلكترونية مالهاش ذنب، ورسالة بتوجّهه يشيلها
      //    كانت هتبعته يدوّر على مشكلة مش موجودة.
      const becauseAddons = addonsShip;
      setUploadError(
        becauseAddons
          ? `${pauseText} — والإضافات اللي اخترتها بتتشحن. شيلها من خطوة الإضافات وكمّل بالنسخة الإلكترونية.`
          : `${pauseText} — اختر النسخة الإلكترونية للمتابعة.`,
      );
      router.push(stepHref(becauseAddons ? 3 : 4));
      return;
    }

    // 2. Add to cart — أو استبدال البند اللي جاي يتعدّل.
    // ⚠️ النوع مثبّت هنا: الكائن كان جوّه `addItem(...)` وبياخد نوعه من
    //    المعامل، ولما اتنقل لمتغير اتوسّع `type` لـ`string` والبناء وقع.
    const line: CartItem = {
      id: editing ? editing.id : `${product.id}-${crypto.randomUUID()}`,
      productId: product.id,
      productSlug: product.slug,
      name: format === 'printed' ? product.name : `${product.name} — ${FORMAT_LABELS[format]}`,
      // للعرض بس — القاعدة بتسعّر من الجدول. ⚠️ **بالإضافات**: كان سعر
      // القصة لوحده، والعميل يتقاله «حوّل» رقمًا أقل من طلبه.
      price:
        basePriceForFormat(product, format) +
        addonsDisplayTotal(addons, data.selectedAddonIds, customizedAddonIds, addonDiscountPercent),
      // السعر قبل العرض وقبل خصم المشترك — للعرض بس («وفّرت كذا» في
      // الدفع)، وبيتحط بس لما يكون أكبر فعلًا.
      listPrice: (() => {
        const full =
          baseListPriceForFormat(product, format) +
          addonsDisplayTotal(addons, data.selectedAddonIds, customizedAddonIds, 0);
        const now =
          basePriceForFormat(product, format) +
          addonsDisplayTotal(addons, data.selectedAddonIds, customizedAddonIds, addonDiscountPercent);
        return full > now ? full : undefined;
      })(),
      format,
      quantity: 1,
      type: product.category === 'subscription' ? 'subscription' : 'custom',
      imageUrl: product.coverImageUrl || undefined,
      customizationData: {
        recipientType: data.familyMemberId === 'self' ? 'self' : 'child',
        childId: finalChildId || undefined,
        childName,
        childPhoto,
        secondPhoto,
        heroDescription: data.heroDescription,
        // «هدف آخر» بيتحفظ بنص العميل نفسه، مش بكلمة 'other'.
        storyGoal:
          data.storyGoal === 'other'
            ? (data.customStoryGoal ?? '').trim()
            : data.storyGoal ?? '',
        dedicationText: data.dedicationText?.trim() || undefined,
        familyMemberNames: data.familyMemberNames,
        ...(writingStyle ? { writingStyle } : {}),
        ...(extraAnswers.length > 0 ? { extraFields: extraAnswers } : {}),
        selectedAddonIds: data.selectedAddonIds,
        customizedAddonIds,
      },
      addonIds: data.selectedAddonIds,
      // القاعدة بتضيف سعر التخصيص للإضافات دي وحدها.
      customizedAddonIds,
      // ⚠️ للعرض في الدفع بس — القاعدة بتحسب الشحن تاني من
      //    `addon_products.delivery_format` وقت تسجيل الطلب.
      addonsNeedShipping: addonsShip,
    };

    if (editing) replaceItem(editing.id, line);
    else addItem(line);

    // Clear session storage
    sessionStorage.removeItem(`wizard_state_${product.id}`);
    void clearProductPhotos(product.id, [...PHOTO_FIELDS]);

    router.push(CHECKOUT_PATH);
  };

  if (!isLoaded) return null;

  // ⚠️ الحاجز هنا مش في السلة: العميل ماينفعش يبدأ تخصيص قصة مابتتطلبش.
  if (blockedByPause) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-8 text-center">
          <Truck className="mx-auto mb-4 h-10 w-10 text-amber-700" aria-hidden="true" />
          <h1 className="text-2xl font-black text-amber-900">التوصيل متوقف مؤقتًا</h1>
          <p className="mt-3 text-base font-medium leading-relaxed text-amber-900">{pauseText}</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-amber-800">
            القصة دي بتتطبع وبتتشحن، فمش هينفع تتطلب دلوقتي. تقدر تتصفّح القصص اللي ليها
            نسخة إلكترونية، أو ترجع لما التوصيل يرجع.
          </p>
          <Link
            href="/enha-lak"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-6 py-3 font-bold text-white transition-colors hover:bg-amber-800"
          >
            تصفّح باقي القصص
          </Link>
        </div>
      </div>
    );
  }

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
                  goals={goals}
                  writingStyles={showWritingStyle ? styleChoices : undefined}
                  writingDialects={writingDialects}
                  onNext={() => handleNext(['heroDescription', 'familyMemberNames', 'storyGoal', 'customStoryGoal', 'facePhotoFile', 'monthlyGoals', 'writingStyle', 'writingDialect'])}
                  onPrev={handlePrev}
                />
              )}
              {currentStep === 3 && !subscription && <Step3Addons addons={addons} deliveryPaused={deliveryPaused} pauseMessage={pauseMessage} onNext={() => handleNext(['selectedAddonIds', 'customizedAddonIds'])} onPrev={handlePrev} />}
              {(currentStep === 4 || (subscription && currentStep === 3)) && (
                <Step4Review
                  onPrev={handlePrev}
                  product={product}
                  pending={isSubmitting}
                  subscriptionMonths={subscription?.months}
                  extraFields={extraFields}
                  writingDialects={writingDialects}
                  showWritingStyle={showWritingStyle}
                  deliveryPaused={deliveryPaused}
                  addons={addons}
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

import { z } from 'zod';

/**
 * مخطّط التحقق لمعالج التخصيص.
 *
 * ── ليه في ملف لوحده ────────────────────────────────────────
 *
 * كان جوّه `PersonalizationWizard.tsx`، والملف ده مكوّن عميل بيستورد
 * `next/navigation` وغيره — يعني **مش ممكن يتّاختبر**. وغلطة صغيرة في
 * سطر واحد هنا قفلت مسار الشراء كله (شوف `newChildGender` تحت).
 *
 * فصله بيخلّي التحقق قابلًا للاختبار من غير React ولا متصفح.
 */
export const wizardSchema = z.object({
  familyMemberId: z.string().optional(),
  newChildName: z.string().optional(),
  newChildBirthDate: z.string().optional(),
  /**
   * ⚠️ `''` مقبولة عن قصد — **ودي كانت بتوقّف المعالج كله.**
   *
   * كانت `z.enum(['male','female']).optional()`. و`.optional()` في Zod
   * بتسمح بـ`undefined` بس، **مش بالنص الفاضي**.
   *
   * ولما العميل بيختار طفلًا من العائلة، `handleSelectExisting` في
   * `Step1ChildInfo` بتصفّر حقول «طفل جديد»:
   *     setValue('newChildGender', '')
   *
   * فالتصفير نفسه كان بيولّد خطأ على `newChildGender`، والحقل ده ضمن
   * حقول الخطوة ١ اللي `trigger` بيفحصها — فزرار «الخطوة التالية»
   * بيرجع false ومبيعملش حاجة. **من غير أي رسالة**، لأن الخطوة كانت
   * بتعرض خطأ `newChildName` وبس.
   *
   * يعني: اختار طفلًا ← اتقفل عليه المعالج ومش عارف ليه.
   *
   * والعقد اللي تحت بيقبل `''` أصلًا: `family.ts` بتاخد
   * `'male' | 'female' | '' | null`، والمعالج التاني
   * (`LibraryCustomizationWizard`) معرّفها `z.string().optional()`.
   * فالمخالف كان هنا وحده.
   */
  newChildGender: z.enum(['male', 'female']).or(z.literal('')).optional(),
  
  heroDescription: z.string().min(5, 'يجب إدخال وصف للبطل'),
  familyMemberNames: z.string().optional(),
  storyGoal: z.string().min(2, 'الرجاء اختيار الهدف التربوي'),
  /** لما العميل يختار «هدف آخر» بيكتب هدفه بكلامه هنا. */
  customStoryGoal: z.string().optional(),
  /** إهداء يتكتب في أول الكتاب — نفس فكرة معالج المكتبة. */
  dedicationText: z.string().optional(),
  facePhotoFile: z.any().refine((file) => file !== null && file !== undefined, 'الصورة الشخصية مطلوبة'),
  secondPhotoFile: z.any().optional(),

  selectedAddonIds: z.array(z.string()),
  /**
   * الإضافات اللي العميل طلبها **بتخصيص**.
   *
   * مجموعة فرعية من `selectedAddonIds` — إضافة مش مختارة أصلًا مالهاش
   * تخصيص. `Step3Addons` بتشيلها من هنا أول ما تتلغي، والقاعدة بترفض
   * أي رقم هنا لإضافة مش بتقبل تخصيص.
   */
  customizedAddonIds: z.array(z.string()).optional(),

  /**
   * مطبوعة / إلكترونية / الاتنين (ملف 138). الاختيار بيظهر بس لو
   * المنتج ليه سعر إلكتروني — والقاعدة بترفض غير كده على أي حال.
   */
  format: z.enum(['printed', 'electronic', 'both']).optional(),

}).superRefine((data, ctx) => {
  if (data.storyGoal === 'other' && !data.customStoryGoal?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'اكتب الهدف اللي في بالك',
      path: ['customStoryGoal'],
    });
  }
  if (!data.familyMemberId && !data.newChildName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'الرجاء اختيار طفل أو إضافة طفل جديد',
      path: ['newChildName']
    });
  }
});

export type WizardFormValues = z.infer<typeof wizardSchema>;

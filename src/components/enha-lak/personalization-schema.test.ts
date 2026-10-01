import { describe, it, expect } from 'vitest';
import { wizardSchema } from './personalization-schema';

/**
 * اختبارات انحدار على تحقق معالج التخصيص.
 *
 * ── العطل اللي خلّى الملف ده موجود ──────────────────────────
 *
 * `newChildGender` كانت `z.enum(['male','female']).optional()`.
 * و`.optional()` في Zod بتسمح بـ`undefined` **بس** — مش بالنص الفاضي.
 *
 * ولما العميل بيختار طفلًا من العائلة، الخطوة الأولى بتصفّر حقول
 * «طفل جديد» بـ`setValue('newChildGender', '')`. فالتصفير نفسه كان
 * بيولّد خطأ تحقق، والحقل ده ضمن حقول الخطوة ١ اللي `trigger` بيفحصها
 * — فزرار «الخطوة التالية» كان بيرجع `false` **ومبيعملش حاجة**.
 *
 * والأسوأ إن الخطوة كانت بتعرض خطأ `newChildName` وحده، فالمستخدم
 * **مكانش بيشوف أي رسالة**: يختار ابنه ويضغط ومفيش رد فعل.
 *
 * يعني مسار الشراء كله كان مقفولًا عند أول خطوة لأي حد عنده أطفال
 * في المركز العائلي — وهم بالظبط العملاء المستهدفون.
 *
 * ⚠️ لو رجّع حد `newChildGender` لـenum صارم بلا `''`، الاختبار الأول
 *    هنا بيسقط. **ما يتغيّرش عشان يعدّي.**
 */

/** القيم وقت الخطوة ١ — باقي الحقول لسه فاضية بطبيعتها. */
const atStepOne = (over: Record<string, unknown> = {}) => ({
  familyMemberId: '',
  newChildName: '',
  newChildBirthDate: '',
  newChildGender: '',
  heroDescription: '',
  familyMemberNames: '',
  storyGoal: '',
  customStoryGoal: '',
  dedicationText: '',
  facePhotoFile: null,
  secondPhotoFile: null,
  selectedAddonIds: [] as string[],
  customizedAddonIds: [] as string[],
  ...over,
});

/** مسارات أخطاء الخطوة ١ وحدها — الباقي بيتفحص في خطوته. */
const stepOneErrors = (values: Record<string, unknown>) => {
  const result = wizardSchema.safeParse(values);
  if (result.success) return [];
  const fields = [
    'familyMemberId',
    'newChildName',
    'newChildBirthDate',
    'newChildGender',
  ];
  return result.error.issues
    .map((i) => String(i.path[0]))
    .filter((p) => fields.includes(p));
};

describe('الخطوة ١ — اختيار الطفل', () => {
  it('اختيار طفل من العائلة بيعدّي', () => {
    expect(stepOneErrors(atStepOne({ familyMemberId: 'child-123' }))).toEqual([]);
  });

  it('النص الفاضي في الجنس مش خطأ', () => {
    // ده بالظبط اللي بيحصل لما `handleSelectExisting` بتصفّر الحقول.
    expect(
      stepOneErrors(atStepOne({ familyMemberId: 'child-123', newChildGender: '' })),
    ).toEqual([]);
  });

  it('طفل جديد من غير اختيار الجنس بيعدّي', () => {
    // العقد اللي تحت بيقبلها: `family.ts` بتاخد 'male' | 'female' | '' | null
    expect(
      stepOneErrors(
        atStepOne({ newChildName: 'زياد', newChildBirthDate: '2018-03-01' }),
      ),
    ).toEqual([]);
  });

  it('طفل جديد بالجنس بيعدّي', () => {
    expect(
      stepOneErrors(
        atStepOne({
          newChildName: 'زياد',
          newChildBirthDate: '2018-03-01',
          newChildGender: 'male',
        }),
      ),
    ).toEqual([]);
  });

  it('من غير أي اختيار بيتمنع — وبرسالة', () => {
    const errors = stepOneErrors(atStepOne());
    expect(errors).toContain('newChildName');

    const result = wizardSchema.safeParse(atStepOne());
    const message = result.success
      ? ''
      : result.error.issues.find((i) => i.path[0] === 'newChildName')?.message;
    expect(message).toBe('الرجاء اختيار طفل أو إضافة طفل جديد');
  });

  it('جنس غير معروف بيتمنع', () => {
    expect(
      stepOneErrors(atStepOne({ familyMemberId: 'c-1', newChildGender: 'other' })),
    ).toContain('newChildGender');
  });
});

describe('باقي المعالج', () => {
  it('الهدف «آخر» بلا نص بيتمنع', () => {
    const result = wizardSchema.safeParse(
      atStepOne({
        familyMemberId: 'c-1',
        heroDescription: 'طفل شجاع يحب البحر',
        storyGoal: 'other',
        customStoryGoal: '   ',
        facePhotoFile: {},
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => String(i.path[0]))).toContain(
        'customStoryGoal',
      );
    }
  });

  it('الصورة الشخصية مطلوبة', () => {
    const result = wizardSchema.safeParse(
      atStepOne({
        familyMemberId: 'c-1',
        heroDescription: 'طفل شجاع يحب البحر',
        storyGoal: 'courage',
        facePhotoFile: null,
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => String(i.path[0]))).toContain(
        'facePhotoFile',
      );
    }
  });

  it('طلب مكتمل بيعدّي', () => {
    const result = wizardSchema.safeParse(
      atStepOne({
        familyMemberId: 'c-1',
        heroDescription: 'طفل شجاع يحب البحر',
        storyGoal: 'courage',
        facePhotoFile: {},
        selectedAddonIds: ['addon-1'],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('إضافة بتخصيص بتعدّي', () => {
    // `customizedAddonIds` مجموعة فرعية من `selectedAddonIds`.
    // ⚠️ لو الحقل ده اتشال أو بقى مطلوبًا بشكل تاني، الشرط في
    //    `create_customer_order` مش هيوصله تخصيص أصلًا.
    const result = wizardSchema.safeParse(
      atStepOne({
        familyMemberId: 'c-1',
        heroDescription: 'طفل شجاع يحب البحر',
        storyGoal: 'courage',
        facePhotoFile: {},
        selectedAddonIds: ['addon-1', 'addon-2'],
        customizedAddonIds: ['addon-1'],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('غياب قايمة التخصيص مش بيقفل الطلب', () => {
    // ⚠️ الحقل ده `.optional()` عن قصد، والمعالج بيحوّله `[]` عند الإرسال.
    //
    //    لو بقى مطلوبًا، أي حالة محفوظة في `sessionStorage` من نسخة
    //    قديمة من الموقع هتخلّي `handleSubmit` يرفض **بلا سبب ظاهر**
    //    وزرار «إضافة للسلة» يبان متعطّل. نفس عطل `newChildGender`
    //    بالظبط، ومفيش داعي نكرره تالت مرة.
    const { customizedAddonIds: _omitted, ...withoutField } = atStepOne({
      familyMemberId: 'c-1',
      heroDescription: 'طفل شجاع يحب البحر',
      storyGoal: 'courage',
      facePhotoFile: {},
    });
    const result = wizardSchema.safeParse(withoutField);
    expect(result.success).toBe(true);
  });
});

describe('وضع الاشتراك (ملف 140)', () => {
  const base = {
    familyMemberId: 'c1',
    heroDescription: 'بيحب الديناصورات',
    facePhotoFile: {},
    selectedAddonIds: [],
  };
  it('الاشتراك من غير هدف واحد بيعدّي — الأهداف شهرية', async () => {
    const { wizardSchema } = await import('./personalization-schema');
    expect(wizardSchema.safeParse({ ...base, storyGoal: '', mode: 'subscription', monthlyGoals: ['', 'ثقة'] }).success).toBe(true);
  });
  it('القصة الواحدة لسه محتاجة هدف', async () => {
    const { wizardSchema } = await import('./personalization-schema');
    const r = wizardSchema.safeParse({ ...base, storyGoal: '' });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('الرجاء اختيار الهدف التربوي');
  });
});



export type WithdrawalRequestRow = {
  id: string;
  /**
   * صاحب الطلب — مدرب أو ناشر أو مقدّم خدمة مستقل.
   *
   * ⚠️ **واحد بس من التلاتة متملّي**، والقاعدة بتفرض ده بقيد.
   *
   * ⚠️ والمقدّم المستقل اتضاف في 20261016160000: قبله كان بيشتغل
   *    وياخد «مستحقك» على شاشته **ومفيش طريقة يسجّلها ولا يطلبها**.
   */
  ownerKind: 'instructor' | 'publisher' | 'provider';
  instructorId: string | null;
  publisherId: string | null;
  providerId: string | null;
  /** الاسم اللي الإدارة بتشوفه. */
  ownerName: string;
  amount: number;
  method: string;
  /**
   * بيانات التحويل اللي المدرب كتبها (ملف SQL 92).
   *
   * ⚠️ من غيرها الطلب **مينفعش يتنفّذ**: الإدارة بتشوف «تحويل بنكي»
   *    وبس. الطلبات القديمة — اللي اتعملت قبل الإصلاح — فاضية هنا.
   */
  payoutDetails: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
};

/** صف في سجلّ المستحقات الموحّد — مدرب أو ناشر أو مقدّم خدمة. */
export type PayoutRow = {
  id: string;
  period: string;
  amount: number;
  status: 'pending' | 'paid';
};

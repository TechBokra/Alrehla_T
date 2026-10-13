

export type WithdrawalRequestRow = {
  id: string;
  /**
   * صاحب الطلب — مدرب أو ناشر (ملف SQL 100).
   *
   * ⚠️ **واحد بس من الرقمين متملّي**، والقاعدة بتفرض ده بقيد. وقبل
   *    ملف 100 كان الجدول للمدرب وحده، فالناشر مكانش يقدر يطلب سحبه
   *    من الموقع خالص.
   */
  ownerKind: 'instructor' | 'publisher';
  instructorId: string | null;
  publisherId: string | null;
  /** اسم المدرب أو الناشر — اللي الإدارة بتشوفه. */
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

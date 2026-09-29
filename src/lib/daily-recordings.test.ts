import { describe, it, expect } from 'vitest';
import { expiredRecordings, SESSION_ROOM_PREFIX, type DailyRecording } from './daily';

/**
 * ⚠️ الاختبارات دي بتحرس **عملية حذف مالهاش تراجع**، وبتشتغل من
 *    مهمة يومية **محدّش بيبصّ عليها**. غلطة هنا مابتتلاحظش يوم ما
 *    تحصل — بتتلاحظ يوم ما حد يدوّر على تسجيل مش لاقيه.
 *
 *    فأغلب اللي تحت مش بيتأكّد إن الحذف بيحصل، بيتأكّد إنه
 *    **مابيحصلش**: برّه البادئة، وبلا تاريخ، ولسه بيتسجّل.
 */

const NOW = new Date('2026-09-29T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function rec(over: Partial<DailyRecording> = {}): DailyRecording {
  return {
    id: 'r1',
    roomName: `${SESSION_ROOM_PREFIX}abc`,
    startedAt: new Date(NOW - 40 * DAY).toISOString(),
    durationSeconds: 1800,
    status: 'finished',
    sessionId: 'abc',
    ...over,
  };
}

describe('اللي بيتحذف', () => {
  it('تسجيل جلسة عدّى مدة الاحتفاظ', () => {
    expect(expiredRecordings([rec()], 30, NOW)).toHaveLength(1);
  });

  it('واللي لسه في المدة بيتساب', () => {
    const fresh = rec({ startedAt: new Date(NOW - 3 * DAY).toISOString() });
    expect(expiredRecordings([fresh], 30, NOW)).toHaveLength(0);
  });

  it('الحدّ بالظبط مابيتحذفش — الأقل من القاطع بس', () => {
    const exactly = rec({ startedAt: new Date(NOW - 30 * DAY).toISOString() });
    expect(expiredRecordings([exactly], 30, NOW)).toHaveLength(0);
  });
});

describe('اللي مابيتلمسش — وهو أهم من اللي بيتحذف', () => {
  it('⚠️ تسجيل برّه بادئة غرف الجلسات', () => {
    // الحساب ممكن يتشارك مع مشروع تاني. ده نفس حارس مجلّد Cloudinary.
    const foreign = rec({ roomName: 'onlyhelio-demo', sessionId: null });
    expect(expiredRecordings([foreign], 30, NOW)).toHaveLength(0);
  });

  it('⚠️ تسجيل بلا اسم غرفة', () => {
    // الاسم مش موجود = مانعرفش بتاع مين. الشك بيمنع لا بيسمح.
    const nameless = rec({ roomName: '', sessionId: null });
    expect(expiredRecordings([nameless], 30, NOW)).toHaveLength(0);
  });

  it('⚠️ تسجيل بلا تاريخ بداية', () => {
    // من غير تاريخ مفيش عمر، ومن غير عمر مفيش قرار حذف.
    expect(expiredRecordings([rec({ startedAt: '' })], 30, NOW)).toHaveLength(0);
  });

  it('⚠️ تسجيل لسه شغّال مهما كان تاريخه', () => {
    const live = rec({ status: 'in-progress' });
    expect(expiredRecordings([live], 30, NOW)).toHaveLength(0);
  });

  it('⚠️ مدة صفر أو سالبة مابتحذفش كل حاجة', () => {
    // إعداد فاضي أو مقروء غلط كان ممكن يخلّي القاطع = دلوقتي، يعني
    // **كل التسجيلات** تتمسح في تشغيل واحد.
    expect(expiredRecordings([rec()], 0, NOW)).toHaveLength(0);
    expect(expiredRecordings([rec()], -5, NOW)).toHaveLength(0);
    expect(expiredRecordings([rec()], Number.NaN, NOW)).toHaveLength(0);
  });
});

describe('تقصير المدة', () => {
  it('نزّلنا المدة من شهر لأسبوع فاللي فات أسبوع بقى منتهيًا', () => {
    // الأثر ده مقصود ومكتوب في التوثيق: ده معنى «بنحتفظ أسبوع».
    const tenDays = rec({ startedAt: new Date(NOW - 10 * DAY).toISOString() });
    expect(expiredRecordings([tenDays], 30, NOW)).toHaveLength(0);
    expect(expiredRecordings([tenDays], 7, NOW)).toHaveLength(1);
  });
});

import { describe, it, expect } from 'vitest';
import { isProfileComplete, onboardingState, validateFirstProfile } from './instructor-onboarding';

const full = {
  displayName: 'أ. منى',
  bio: 'مدربة كتابة إبداعية للأطفال من عشر سنين، بشتغل بالقصص والألعاب.',
  specialties: ['الكتابة للأطفال'],
  yearsExperience: 10,
  avatarUrl: 'https://res.cloudinary.com/x/image/upload/a.jpg',
};

describe('المدرب الجديد بيكمّل ملفه', () => {
  it('الملف الناقص = نبذة فاضية أو مفيش تخصصات', () => {
    expect(isProfileComplete({ bio: '', specialties: [] })).toBe(false);
    expect(isProfileComplete({ bio: 'نبذة', specialties: [] })).toBe(false);
    expect(isProfileComplete({ bio: '   ', specialties: ['x'] })).toBe(false);
    expect(isProfileComplete({ bio: 'نبذة', specialties: ['x'] })).toBe(true);
  });

  it('الحالات التلاتة', () => {
    const empty = { bio: '', specialties: [] };
    expect(onboardingState(empty, [])).toBe('needs_profile');
    expect(
      onboardingState(empty, [{ status: 'pending', requestedChanges: { bio: 'x' } }]),
    ).toBe('in_review');
    // طلب مرفوض = يرجع يكمّل
    expect(
      onboardingState(empty, [{ status: 'rejected', requestedChanges: { bio: 'x' } }]),
    ).toBe('needs_profile');
    // طلب الباقات مش ملف
    expect(
      onboardingState(empty, [
        { status: 'pending', requestedChanges: { _requestType: 'packages' } },
      ]),
    ).toBe('needs_profile');
    expect(onboardingState({ bio: 'نبذة', specialties: ['x'] }, [])).toBe('complete');
  });

  it('الملف الكامل بيعدّي، وكل خانة ناقصة ليها رسالتها', () => {
    expect(validateFirstProfile(full)).toBeNull();
    expect(validateFirstProfile({ ...full, avatarUrl: '' })).toContain('صورتك');
    expect(validateFirstProfile({ ...full, displayName: ' ' })).toContain('اسمك');
    expect(validateFirstProfile({ ...full, bio: 'قصيرة' })).toContain('النبذة');
    expect(validateFirstProfile({ ...full, specialties: [' '] })).toContain('تخصص');
    expect(validateFirstProfile({ ...full, yearsExperience: -1 })).toContain('سنين');
    expect(validateFirstProfile({ ...full, yearsExperience: Number.NaN })).toContain('سنين');
  });
});

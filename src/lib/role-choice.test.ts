import { describe, it, expect } from 'vitest';
import {
  roleToChoice,
  choiceToRole,
  roleDisplayName,
  roleChoices,
} from './role-choice';

const roles = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'مشرف عام',
    isDefault: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'محاسب',
    isDefault: false,
  },
];
const labels = {
  student: 'عميل / طالب',
  publisher: 'ناشر',
  general_supervisor: 'إداري',
  super_admin: 'مدير نظام',
};

describe('قايمة الدور بالأدوار الإدارية', () => {
  it('الإداري من غير دور = الافتراضي، وبدور = دوره', () => {
    expect(roleToChoice('general_supervisor', null, roles)).toBe(
      `admin:${roles[0].id}`
    );
    expect(roleToChoice('general_supervisor', roles[1].id, roles)).toBe(
      `admin:${roles[1].id}`
    );
    // دور اتمسح = الافتراضي (نفس اللي القاعدة بتعمله)
    expect(roleToChoice('general_supervisor', 'gone', roles)).toBe(
      `admin:${roles[0].id}`
    );
    expect(roleToChoice('publisher', roles[1].id, roles)).toBe('publisher');
  });

  it('الافتراضي بيتخزّن فاضي، وأي دور تاني برقمه', () => {
    expect(choiceToRole(`admin:${roles[0].id}`, roles)).toEqual({
      role: 'general_supervisor',
      adminRoleId: null,
    });
    expect(choiceToRole(`admin:${roles[1].id}`, roles)).toEqual({
      role: 'general_supervisor',
      adminRoleId: roles[1].id,
    });
    expect(choiceToRole('publisher', roles)).toEqual({
      role: 'publisher',
      adminRoleId: null,
    });
  });

  it('دور إداري مش موجود = اختيار مرفوض، مش افتراضي في صمت', () => {
    expect(choiceToRole('admin:not-a-role', roles)).toBeNull();
  });

  it('الاسم المعروض للإداري = اسم دوره', () => {
    expect(
      roleDisplayName('general_supervisor', roles[1].id, roles, labels)
    ).toBe('محاسب');
    expect(roleDisplayName('general_supervisor', null, roles, labels)).toBe(
      'مشرف عام'
    );
    expect(roleDisplayName('publisher', null, roles, labels)).toBe('ناشر');
  });

  it('غير مدير النظام مابيشوفش أي اختيار إداري', () => {
    const all = [
      'student',
      'publisher',
      'general_supervisor',
      'super_admin',
    ] as const;
    const forSupervisor = roleChoices([...all], roles, labels, false).map(
      (c) => c.value
    );
    expect(forSupervisor).toEqual(['student', 'publisher']);
    const forSuper = roleChoices([...all], roles, labels, true);
    expect(forSuper.map((c) => c.label)).toEqual([
      'عميل / طالب',
      'ناشر',
      'إداري — مشرف عام',
      'إداري — محاسب',
      'مدير نظام',
    ]);
  });

  it('لو جدول الأدوار مش موجود: «إداري» واحد زي الأول', () => {
    expect(roleToChoice('general_supervisor', null, [])).toBe(
      'general_supervisor'
    );
    expect(
      roleChoices(['general_supervisor'], [], labels, true).map((c) => c.value)
    ).toEqual(['general_supervisor', 'super_admin']);
  });
});

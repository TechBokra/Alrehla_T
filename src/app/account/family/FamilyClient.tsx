'use client';
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChildProfile } from '@/types';
import { createFamilyMember, updateFamilyMember, deleteFamilyMember } from '@/app/actions/family';
import { Button } from '@/components/ui/Button';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { Trash2, Edit2, Plus, X, FileText } from 'lucide-react';
import { calculateAge } from '@/lib/utils';
import { BirthDatePicker } from '@/components/ui/BirthDatePicker';
import { AvatarPicker } from '@/components/dashboard/AvatarPicker';
import { PersonAvatar } from '@/components/ui/PersonAvatar';
import { StudentAccountCell } from './StudentAccountCell';
import { Field, TextInput, Select, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

export function FamilyClient({
  initialMembers,
  accountsEnabled,
}: {
  initialMembers: ChildProfile[];
  /** مفتاح الخدمة متظبط على الخادم؟ */
  accountsEnabled: boolean;
}) {
  const [members, setMembers] = useState<ChildProfile[]>(initialMembers);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    fullName: string;
    birthDate: string;
    gender: 'male' | 'female' | '';
    avatarUrl: string;
  }>({ fullName: '', birthDate: '', gender: '', avatarUrl: '' });
  const [error, setError] = useState('');
  // الخانة اللي عليها الخطأ — الرسالة بتظهر تحتها بدل ما تبقى فوق.
  const [errorField, setErrorField] = useState<string | undefined>();
  // خطأ الحذف — بيظهر فوق الجدول، لأن النموذج ممكن يكون مقفول.
  const [listError, setListError] = useState('');

  const fail = (message: string, field?: string) => {
    setError(message);
    setErrorField(field);
  };
  const err = (f: string) => (errorField === f ? error : undefined);

  const resetForm = () => {
    setFormData({ fullName: '', birthDate: '', gender: '', avatarUrl: '' });
    setEditingId(null);
    setShowForm(false);
    setError('');
    setErrorField(undefined);
  };

  const handleEdit = (child: ChildProfile) => {
    setFormData({
      fullName: child.fullName,
      birthDate: child.birthDate || '',
      gender: child.gender ?? '',
      avatarUrl: child.avatarUrl ?? '',
    });
    setEditingId(child.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الملف؟')) return;
    setListError('');
    startTransition(async () => {
      try {
        const result = await deleteFamilyMember(id);
        if (!result.ok) {
          setListError(result.error);
          return;
        }
        setMembers(prev => prev.filter(m => m.id !== id));
      } catch {
        setListError('تعذّر الحذف — جرّب تاني');
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorField(undefined);

    // كان بيرجع من غير أي رسالة لو تاريخ الميلاد فاضي — الزرار يتضغط
    // وما يحصلش حاجة ومحدش يعرف ليه.
    if (!formData.fullName.trim()) {
      fail('اكتب اسم الطفل', 'fullName');
      return;
    }
    if (!formData.birthDate) {
      fail('حدّد تاريخ الميلاد', 'birthDate');
      return;
    }

    const gender = formData.gender || null;

    startTransition(async () => {
      try {
        if (editingId) {
          const result = await updateFamilyMember(
            editingId,
            formData.fullName,
            formData.birthDate,
            gender,
            formData.avatarUrl,
          );
          if (!result.ok) {
            fail(result.error, result.field);
            return;
          }
          setMembers(prev => prev.map(m => m.id === editingId
            ? {
                ...m,
                fullName: formData.fullName,
                birthDate: formData.birthDate,
                gender,
                avatarUrl: formData.avatarUrl || null,
              }
            : m));
          resetForm();
        } else {
          const result = await createFamilyMember(
            formData.fullName,
            formData.birthDate,
            gender,
            formData.avatarUrl,
          );
          if (!result.ok) {
            fail(result.error, result.field);
            return;
          }
          setMembers(prev => [...prev, result.child]);
          resetForm();
        }
      } catch {
        fail('تعذّر الحفظ — جرّب تاني');
      }
    });
  };

  const columns = [
    {
      header: 'الاسم',
      accessorKey: 'fullName',
      // الصورة جنب الاسم — لو مفيش، الحرف الأول.
      cell: (child: ChildProfile) => (
        <span className="flex items-center gap-3">
          <PersonAvatar name={child.fullName} avatarUrl={child.avatarUrl} size={36} />
          <span className="font-bold text-slate-800">{child.fullName}</span>
        </span>
      ),
    },
    { 
      header: 'العمر (سنوات)', 
      accessorKey: 'age',
      cell: (child: ChildProfile) => {
        const age = calculateAge(child.birthDate);
        return age !== null ? age.toString() : '-';
      }
    },
    {
      header: 'حساب الدخول',
      accessorKey: 'account',
      cell: (child: ChildProfile) => (
        <StudentAccountCell child={child} enabled={accountsEnabled} />
      ),
    },
    {
      header: 'المتابعة',
      accessorKey: 'follow',
      /**
       * متابعة الطفل — باقاته وجلساته ومعرض أعماله في صفحة واحدة.
       *
       * ⚠️ بتظهر لكل طفل، حتى اللي مالوش حساب دخول: الباقات والجلسات
       *    موجودة له برضه، والصفحة بتوضّح إن المعرض وحده محتاج حساب.
       */
      cell: (child: ChildProfile) =>
        <Link
          href={`/account/family/${child.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 hover:underline"
        >
          <FileText className="h-4 w-4" />
          تابع تقدّمه
        </Link>,
    },
    { 
      header: 'الإجراءات', 
      accessorKey: 'actions',
      cell: (child: ChildProfile) => (
        <div className="flex gap-2">
          <button onClick={() => handleEdit(child)} className="text-slate-400 hover:text-amber-500"><Edit2 className="h-4 w-4" /></button>
          <button onClick={() => handleDelete(child.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">أفراد العائلة</h2>
        <Button onClick={() => setShowForm(true)} accentColor="amber" className="gap-2">
          <Plus className="h-4 w-4" /> إضافة فرد
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-wrap gap-4 items-end">
          {/* الخطأ اللي مش على خانة بعينها فوق؛ اللي على خانة بيظهر تحتها. */}
          <FormError message={errorField ? '' : error} className="w-full" />
          {/* ⚠️ الصورة دي كانت **مستحيلة**: العمود في القاعدة والنوع
              في الكود، ومفيش أي شاشة بتكتب فيها. فمعالج الشراء بيرسم
              دايرة رمادية بالحرف الأول دايمًا. */}
          <div className="w-full">
            <AvatarPicker
              value={formData.avatarUrl}
              onChange={(url) => setFormData({ ...formData, avatarUrl: url })}
              onError={(message) => fail(message)}
              label="صورة الطفل (اختياري)"
              folder="alrehla/children"
            />
          </div>

          <Field label="اسم الطفل" name="fullName" required error={err('fullName')} className="flex-1 min-w-[200px]">
            <TextInput
              value={formData.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
            />
          </Field>
          <Field label="تاريخ الميلاد" required error={err('birthDate')} className="w-56">
            <BirthDatePicker
              value={formData.birthDate}
              onChange={(v) => setFormData({ ...formData, birthDate: v })}
            />
          </Field>
          <Field label="النوع" name="gender" className="w-40">
            <Select
              value={formData.gender}
              onChange={(e) =>
                setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | '' })
              }
            >
              <option value="">غير محدد</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </Select>
          </Field>
          <div className="flex gap-2 w-full sm:w-auto">
            <BusyButton type="submit" busy={isPending} className="flex-1">حفظ</BusyButton>
            <Button type="button" onClick={resetForm} variant="secondary" className="!bg-slate-200">إلغاء</Button>
          </div>
        </form>
      )}

      <FormError message={listError} />

      {members.length > 0 ? (
        <SimpleDataTable columns={columns} data={members as any} />
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500">
          لا يوجد أفراد عائلة مضافين بعد
        </div>
      )}
    </div>
  );
}

import type { CustomizationField } from '@/lib/customization-fields';
import { readAppliesTo } from '@/lib/applies-to';

type FieldRow = {
  id: string;
  label: string;
  placeholder: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  /** ملف 12 — قبله العمود مش موجود فبيوصل `undefined`. */
  applies_to?: string[] | null;
};

export function mapField(r: FieldRow): CustomizationField {
  return {
    id: r.id,
    label: r.label,
    placeholder: r.placeholder || undefined,
    isRequired: Boolean(r.is_required),
    isActive: Boolean(r.is_active),
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    appliesTo: readAppliesTo(r.applies_to),
  };
}

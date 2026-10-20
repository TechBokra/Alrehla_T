import React from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { productState } from '@/lib/product-display';
import type { PersonalizedProduct } from '@/types';

const LABELS = {
  live: { type: 'success', label: 'معروض' },
  pending: { type: 'pending', label: 'مستني المراجعة' },
  rejected: { type: 'danger', label: 'مرفوض' },
  stopped: { type: 'neutral', label: 'موقوف' },
} as const;

/**
 * شارة حالة المنتج — **واحدة لشاشة الإدارة وشاشة الناشر**.
 *
 * الحساب في `productState` (حساب نقي ومختبَر): العميل بيشوف المنتج
 * لما يكون مفعّل **ومعتمد**، مش مفعّل وبس.
 */
export function ProductStateBadge({
  product,
}: {
  product: Pick<PersonalizedProduct, 'isActive' | 'reviewStatus'>;
}) {
  const { type, label } = LABELS[productState(product)];
  return <StatusBadge type={type} label={label} />;
}

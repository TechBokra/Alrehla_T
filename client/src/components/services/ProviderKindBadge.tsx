import React from 'react';
import type { ProviderKind } from '@/types';

/**
 * مين بيقدّم الخدمة: المنصة ولا مستقل.
 *
 * ⚠️ **كانت «فريق المنصة» وحدها ليها شارة، والباقي بلا أي علامة.**
 *    فالعميل بيختار من قايمة فيها المنصة ومدرب ومقدّم مستقل جنب بعض،
 *    ومش فارق معاه مين فيهم مين — وده فرق حقيقي: المنصة مسؤولة
 *    بنفسها، والمستقل شخص بيشتغل من خلالها.
 *
 * والتفرقة بين «مدرب» و«مقدّم مستقل» مقصودة كمان: المدرب العميل ممكن
 * يكون شايفه في صفحة المدربين وحاجز معاه جلسات.
 */
const LABEL: Record<ProviderKind, string> = {
  platform: 'فريق المنصة',
  instructor: 'مدرب في المنصة',
  individual: 'مقدّم مستقل',
};

const TONE: Record<ProviderKind, string> = {
  platform: 'bg-emerald-50 text-emerald-800',
  instructor: 'bg-sky-50 text-sky-800',
  individual: 'bg-slate-100 text-slate-700',
};

export function ProviderKindBadge({
  kind,
  className = '',
}: {
  kind: ProviderKind;
  className?: string;
}) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${TONE[kind]} ${className}`}>
      {LABEL[kind]}
    </span>
  );
}

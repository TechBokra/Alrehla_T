'use client';

import { createContext, useContext } from 'react';

/**
 * حالة النموذج اللي `ActionForm` بيشاركها مع اللي جوّاه: شغّال ولا لأ،
 * وأنهي خانة عليها الخطأ.
 *
 * ⚠️ ليه مش `useFormStatus` وبس: `ActionForm` بيبعت بنفسه (عشان يعرض
 *    الخطأ ويمنع الضغطتين)، فـ`useFormStatus` بيرجع «مش شغّال» وهو شغّال.
 */
export type FormState = {
  busy: boolean;
  errorField?: string;
  /** رسالة الخادم للخانة دي — `Field` بيعرضها تحتها لوحده (مراجعة م. محمد). */
  errorMessage?: string;
};

export const FormStateContext = createContext<FormState>({ busy: false });

export function useFormState(): FormState {
  return useContext(FormStateContext);
}

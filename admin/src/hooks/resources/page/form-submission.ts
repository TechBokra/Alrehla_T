export interface ResourceFormSubmission<TRecord> {
  /** Feature validation, uploads and allowlisted payload mapping. */
  prepare: () => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Reset TanStack Form only after persistence and the edit refresh finish. */
  reset: (record: TRecord) => void;
}

export type ResourceFormSubmit<TRecord> = (
  submission: ResourceFormSubmission<TRecord>,
) => Promise<TRecord | false>;

interface SubmissionServices<TRecord> {
  save: (payload: Record<string, unknown>) => Promise<TRecord | false>;
  invalidate: (record: TRecord) => Promise<void>;
  refreshRecord?: () => Promise<TRecord | undefined>;
  clearUploads: () => void;
  redirect?: (record: TRecord) => void;
  getLastError: () => unknown;
  getErrorMessage: (error: unknown) => string;
  notifyError: (message: string) => void;
  notifySuccess?: () => void;
}

/** Shared submission sequence. Dependencies keep the Refine and UI seams explicit. */
export async function submitResourceForm<TRecord>(
  submission: ResourceFormSubmission<TRecord>,
  services: SubmissionServices<TRecord>,
  guard: { pending: boolean },
): Promise<TRecord | false> {
  if (guard.pending) return false;
  guard.pending = true;
  try {
    let payload: Record<string, unknown>;
    try {
      payload = await submission.prepare();
    } catch (error) {
      services.notifyError(error instanceof Error ? error.message : "تعذّر تجهيز البيانات للحفظ. حاول مرة أخرى.");
      return false;
    }

    let saved: TRecord | false;
    try {
      saved = await services.save(payload);
    } catch (error) {
      services.notifyError(services.getErrorMessage(error));
      return false;
    }
    if (saved === false) {
      services.notifyError(services.getErrorMessage(services.getLastError()));
      return false;
    }

    try {
      await services.invalidate(saved);
    } catch {
      services.notifyError("تم الحفظ، لكن تعذّر تحديث البيانات المعروضة. أعد تحميل الصفحة.");
    }
    let baseline = saved;
    if (services.refreshRecord) {
      try {
        baseline = await services.refreshRecord() ?? saved;
      } catch {
        services.notifyError("تم الحفظ، لكن تعذّر إعادة تحميل البيانات.");
      }
    }
    services.clearUploads();
    submission.reset(baseline);
    services.notifySuccess?.();
    services.redirect?.(saved);
    return baseline;
  } finally {
    guard.pending = false;
  }
}

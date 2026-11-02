export function closeDecision(pending: boolean, dirty: boolean) {
  return pending ? "stay" : dirty ? "confirm" : "close";
}

/** A failed save can be retried; an acknowledged save cannot be submitted twice. */
export function createSubmissionGuard() {
  let state: "idle" | "pending" | "saved" = "idle";
  return {
    begin() {
      if (state !== "idle") return false;
      state = "pending";
      return true;
    },
    failed() {
      if (state === "pending") state = "idle";
    },
    completed() {
      state = "saved";
    },
  };
}

export function editRecordState<T>({
  loading,
  error,
  record,
  canEdit,
}: {
  loading: boolean;
  error?: { statusCode?: number; code?: string } | null;
  record?: T;
  canEdit: (row: T) => boolean;
}) {
  if (loading) return "loading";
  if (
    error?.statusCode === 401 ||
    error?.statusCode === 403 ||
    error?.code === "42501" ||
    (record && !canEdit(record))
  )
    return "forbidden";
  if (
    error?.statusCode === 404 ||
    error?.code === "PGRST116" ||
    (!record && !error)
  )
    return "missing";
  if (error) return "failed";
  return "ready";
}

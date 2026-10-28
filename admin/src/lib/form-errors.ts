/** Zod issues and string validators share the shadcn FieldError shape. */
export function normalizeFieldErrors(errors: unknown[]) {
  return errors
    .map((error) =>
      typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String(error.message ?? "")
          : "",
    )
    .filter(Boolean)
    .map((message) => ({ message }));
}

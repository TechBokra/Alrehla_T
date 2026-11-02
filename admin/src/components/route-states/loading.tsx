import { LoaderCircleIcon } from "lucide-react";

export function Loading() {
  return (
    <main dir="rtl" role="status" aria-label="جارٍ التحميل" className="grid min-h-svh place-items-center bg-background p-6">
      <LoaderCircleIcon aria-hidden="true" className="animate-spin size-8" />
    </main>
  );
}

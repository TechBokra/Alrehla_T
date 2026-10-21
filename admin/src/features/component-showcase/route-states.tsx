import type { ErrorComponentProps } from "@tanstack/react-router";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShowcasePending() {
  return (
    <div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">
      جارٍ تحميل لوحة المعاينة…
    </div>
  );
}

export function ShowcaseError({ error, reset }: ErrorComponentProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="max-w-md rounded-3xl border bg-card p-8 text-card-foreground shadow-sm">
        <AlertCircle className="mb-4 size-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">خطأ في المعاينة</p>
        <h1 className="mt-2 text-xl font-semibold">تعذّر تحميل الصفحة</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String(error)}</p>
        <Button className="mt-5" onClick={reset}>
          <RotateCcw data-icon="inline-start" /> إعادة المحاولة
        </Button>
      </section>
    </main>
  );
}

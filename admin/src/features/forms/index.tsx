import { Badge } from "@/components/ui/badge";
import { OverlayFormDemos } from "@/features/form-prototype/overlay-form-demos";

export function FormsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">النماذج · معاينة محلية</Badge>
          <Badge variant="secondary">TanStack Form + Zod</Badge>
          <Badge variant="secondary">حالات الحفظ والتنبيه</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          النماذج
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          قارن بين نموذج داخل نافذة أو لوحة جانبية أو أقسام متعددة. عملية الحفظ تجريبية، وتظهر أخطاء التحقق بجانب الحقل وحالة الحفظ في إشعار.
        </p>
      </header>

      <OverlayFormDemos />
    </div>
  );
}

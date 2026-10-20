import { Badge } from "@/components/ui/badge";
import { OverlayFormDemos } from "@/features/form-prototype/overlay-form-demos";

export function FormsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">APP LOCAL · FORM SHOWCASE</Badge>
          <Badge variant="secondary">TanStack Form + Zod</Badge>
          <Badge variant="secondary">Sonner promise feedback</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Forms
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Compare dialog, sheet, and multi-section form layouts. Each save is a
          simulated asynchronous request; validation stays beside its field,
          while save progress and results appear in a toast.
        </p>
      </header>

      <OverlayFormDemos />
    </div>
  );
}

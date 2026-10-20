import { Badge } from "@/components/ui/badge";
import { Calendar1 } from "@/components/calendar1";

export function CalendarPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">INTERACTIVE · MEMORY ONLY</Badge>
          <Badge variant="secondary">October 2026 sample events</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Calendar
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Switch between month and week views, then add, edit, or remove sample
          events. Changes stay in this page session and reset when it reloads;
          no external calendar account is connected.
        </p>
      </header>

      <Calendar1 className="h-[min(76svh,900px)] min-h-[560px] rounded-3xl border shadow-sm" />
    </div>
  );
}

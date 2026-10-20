import {
  createRootRoute,
  HeadContent,
  Outlet,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createRootRoute({
  component: RootLayout,
  pendingComponent: RootPending,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}

function RootPending() {
  return (
    <div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">
      Loading Calesee Admin…
    </div>
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="max-w-md rounded-3xl border bg-card p-8 text-card-foreground shadow-sm">
        <AlertCircle className="mb-4 size-6 text-destructive" />
        <h1 className="text-lg font-semibold">The admin preview ran into a problem</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String(error)}</p>
        <Button className="mt-6" onClick={reset}>
          <RotateCcw /> Try again
        </Button>
      </section>
    </main>
  );
}

function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-primary">404 · Not found</p>
        <h1 className="mt-2 text-2xl font-semibold">That page isn’t here.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the component navigation to return to the preview workspace.
        </p>
      </section>
    </main>
  );
}

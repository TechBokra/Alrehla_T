import { LoaderCircleIcon } from "lucide-react";

export function RootPending() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <LoaderCircleIcon className="animate-spin size-8" />
    </main>
  );
}

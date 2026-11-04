import { createFileRoute } from "@tanstack/react-router";
import { WritingPackagesPage } from "@/features/writing/packages/page";

export const Route = createFileRoute("/writing/packages/")({
  component: WritingPackagesPage,
  head: () => ({ meta: [{ title: "باقات الكتابة الإبداعية · الرحلة" }] }),
});

import { createFileRoute } from "@tanstack/react-router";
import { BoxPlansPage } from "@/features/subscriptions/box-plans/page";

export const Route = createFileRoute("/subscriptions/box/plans/")({
  component: BoxPlansPage,
  head: () => ({ meta: [{ title: "خطط صندوق الرحلة · الرحلة" }] }),
});

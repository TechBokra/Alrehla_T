import { createFileRoute } from "@tanstack/react-router";
import { PromotionsPage } from "@/features/catalog/promotions/page";
export const Route = createFileRoute("/catalog/promotions/")({
  component: PromotionsPage,
  head: () => ({ meta: [{ title: "العروض والخصومات · الرحلة" }] }),
});

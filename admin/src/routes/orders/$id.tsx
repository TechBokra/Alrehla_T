import { createFileRoute } from "@tanstack/react-router";
import { orderPage } from "@/features/orders/detail-page";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetailsRoute,
});

function OrderDetailsRoute() {
  const { id } = Route.useParams();
  const Page = orderPage.Page;
  return <Page id={id} />;
}

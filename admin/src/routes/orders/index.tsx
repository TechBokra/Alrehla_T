import { createFileRoute } from "@tanstack/react-router";
import { OrdersListPage } from "@/features/orders/list-page";

export const Route = createFileRoute("/orders/")({
  component: OrdersListPage,
});

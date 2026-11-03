import { createFileRoute } from "@tanstack/react-router";
import { PublisherProductsPage } from "@/features/catalog/publisher-products/page";

export const Route = createFileRoute("/catalog/publisher-products/")({
  component: PublisherProductsPage,
});

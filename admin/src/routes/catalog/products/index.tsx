import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/features/catalog/products/page";
export const Route = createFileRoute("/catalog/products/")({
  component: ProductsPage,
});

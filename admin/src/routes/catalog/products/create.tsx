import { createFileRoute } from "@tanstack/react-router";
import { ProductFormPage } from "@/features/catalog/products/form-page";

export const Route = createFileRoute("/catalog/products/create")({
  component: CreateProductRoute,
});

function CreateProductRoute() {
  return <ProductFormPage />;
}

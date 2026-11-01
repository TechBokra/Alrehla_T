import { createFileRoute } from "@tanstack/react-router";
import { ProductFormPage } from "@/features/catalog/products/form-page";

export const Route = createFileRoute("/catalog/products/$id/edit")({
  component: EditProductRoute,
});

function EditProductRoute() {
  const { id } = Route.useParams();
  return <ProductFormPage id={id} />;
}

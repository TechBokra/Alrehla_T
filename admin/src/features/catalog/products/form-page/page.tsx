import { resourceFormRegistry } from "@/components/resources/forms";
import { catalogError } from "../../model";
import { isEditableProduct, type Product } from "../model";
import { ProductForm } from "./form";

export function ProductFormPage({ id }: { id?: string }) {
  const mode = id === undefined ? "create" : "edit";
  const PageForm = resourceFormRegistry.page.Page;
  return (
    <PageForm<Product>
      resource="personalized_products"
      id={id}
      title={mode === "create" ? "إضافة منتج للمنصة" : "تعديل المنتج"}
      description="أدخل بيانات المنتج وصوره، ثم احفظ لنشر التغييرات."
      canEdit={isEditableProduct}
      getErrorMessage={catalogError}
    >
      {(context) => <ProductForm {...context} />}
    </PageForm>
  );
}

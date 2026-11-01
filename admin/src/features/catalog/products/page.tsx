import { ResourceView } from "@/components/resources";
import { productColumns } from "./columns";
import { isEditableProduct, type Product } from "./model";

export function ProductsPage() {
  return (
    <ResourceView<Product>
      resource="personalized_products"
      title="منتجات المنصة"
      description="اللي المنصة بتقدّمه بنفسها: «أنت البطل هنا» وتخصيص غلاف المكتبة والإضافات. منتجات دور النشر في قسم «الناشرون»."
      columns={productColumns}
      mode="page"
      canEdit={isEditableProduct}
      deleteConsequence="ستُحذف أيضًا روابط توزيعه المرتبطة به."
      enableRowReordering
      refineCoreProps={{
        filters: {
          permanent: [
            { field: "owner_type", operator: "eq", value: "platform" },
          ],
        },
        sorters: {
          initial: [
            { field: "sort_order", order: "asc" },
            { field: "id", order: "asc" },
          ],
        },
      }}
    />
  );
}

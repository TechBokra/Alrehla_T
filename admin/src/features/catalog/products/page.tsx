import { ResourceView } from "@/components/resources";
import { productColumns } from "./columns";
import { type Product } from "./model";
import { productForm } from "./form-page";

export function ProductsPage() {
  return (
    <ResourceView<Product>
      resource="personalized_products"
      title="منتجات المنصة"
      description="اللي المنصة بتقدّمه بنفسها: «أنت البطل هنا» وتخصيص غلاف المكتبة والإضافات. منتجات دور النشر في قسم «الناشرون»."
      columns={productColumns}
      searchField="name"
      mode="page"
      form={productForm}
      deleteConsequence="ستُحذف أيضًا روابط توزيعه المرتبطة به."
      orderField="sort_order"
      refineCoreProps={{
        filters: {
          permanent: [
            { field: "owner_type", operator: "eq", value: "platform" },
          ],
        },
      }}
    />
  );
}

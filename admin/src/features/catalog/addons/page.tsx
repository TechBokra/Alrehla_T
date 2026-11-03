import { ResourceView } from "@/components/resources";
import { addonForm } from "./dialogs";
import { addonColumns } from "./columns";
import type { Addon } from "./model";

export function AddonsPage() {
  return (
    <ResourceView<Addon>
      resource="addon_products"
      title="الإضافات"
      description="دي اللمسات الاختيارية اللي العميل يقدر يضيفها لطلبه في خطوة التخصيص. السعر اللي هنا هو اللي بيتحسب عليه — الواجهة ما بتبعتش أسعار."
      columns={addonColumns}
      searchField="name"
      mode="dialog"
      form={addonForm}
    />
  );
}

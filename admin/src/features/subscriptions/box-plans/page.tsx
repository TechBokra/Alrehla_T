import { ResourceView } from "@/components/resources";
import {
  BOX_PLANS_PROVIDER,
  type BoxPlan,
} from "./model";
import { boxPlanForm } from "./dialogs";
import { boxPlanColumns } from "./columns";

const description =
  "الباقات دي هي اللي بتظهر في صفحة «صندوق الرحلة». الصورة والمزايا هما اللي بيفرّقوا باقة عن التانية للعميل — من غيرهم بيبقى الفرق سعر ومدة بس.";

export function BoxPlansPage() {
  return (
    <ResourceView<BoxPlan>
      resource="box_subscription_plans"
      title="خطط صندوق الرحلة"
      description={description}
      columns={boxPlanColumns}
      searchField="name"
      mode="dialog"
      form={boxPlanForm}
      getRowLabel={(plan) => plan.name}
      refineCoreProps={{
        dataProviderName: BOX_PLANS_PROVIDER,
        sorters: {
          initial: [
            { field: "sort_order", order: "asc" },
            { field: "duration_months", order: "asc" },
          ],
        },
      }}
    />
  );
}

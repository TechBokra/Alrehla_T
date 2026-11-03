import { useEffect, useMemo, useState } from "react";
import { ResourceView } from "@/components/resources";
import { PROMOTIONS_PROVIDER, type Promotion } from "./model";
import { promotionForm } from "./dialogs";
import { promotionColumns } from "./columns";

const promptionDescription = `اضبط سعرًا مخفّضًا لقصة أو إضافة أو خطة صندوق لفترة محددة. يظهر للعميل السعر الأصلي بخط عليه والسعر الجديد وتاريخ الانتهاء، وينتهي العرض وحده في موعده. السعر المدفوع يُحسب في قاعدة البيانات وقت الطلب، والطلبات السابقة لا تتغير. التواريخ بتوقيت القاهرة.`;
export function PromotionsPage() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const columns = useMemo(() => promotionColumns(now), [now]);
  return (
    <ResourceView<Promotion>
      resource="price_promotions"
      title="العروض والخصومات"
      description={promptionDescription}
      columns={columns}
      searchField="label"
      mode="dialog"
      form={promotionForm}
      getRowLabel={(row) => row.label || row.target_name || "العرض"}
      refineCoreProps={{
        dataProviderName: PROMOTIONS_PROVIDER,
        sorters: {
          initial: [
            { field: "ends_at", order: "desc" },
            { field: "id", order: "asc" },
          ],
        },
      }}
    />
  );
}

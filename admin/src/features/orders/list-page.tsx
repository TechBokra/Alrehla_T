import { useDataTable } from "@/components/refine-ui/data-table/use-data-table";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { ResourceAccessGate } from "@/components/resources";
import { DEFAULT_SEARCH_DEBOUNCE_MS, DEFAULT_RESOURCE_PAGE_SIZE } from "@/lib/const";
import { orderColumns } from "./columns";
import type { OrderDetail } from "./model";

export function OrdersListPage() {
  return (
    <ResourceAccessGate resource="orders" action="list">
      <AuthorizedOrdersList />
    </ResourceAccessGate>
  );
}

function AuthorizedOrdersList() {
  const table = useDataTable<OrderDetail>({
    columns: orderColumns(),
    searchFields: ["payment_reference", "recipient_name", "recipient_phone"],
    searchDebounceMs: DEFAULT_SEARCH_DEBOUNCE_MS,
    refineCoreProps: {
      resource: "orders",
      dataProviderName: "orders",
      errorNotification: false,
      pagination: { pageSize: DEFAULT_RESOURCE_PAGE_SIZE },
      sorters: {
        initial: [
          { field: "created_at", order: "desc" },
          { field: "id", order: "desc" },
        ],
      },
    },
  });
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">الطلبات</h1>
        <p className="text-muted-foreground">متابعة طلبات المتجر وحالات الدفع والتجهيز والشحن.</p>
      </header>
      <DataTable
        table={table}
        pageSizeOptions={[20, 50, 100]}
        searchPlaceholder="ابحث برقم الطلب أو اسم العميل أو هاتفه…"
        toolbarVariant="inline-chips"
        paginationVariant="numbered"
      />
    </section>
  );
}

import { useMemo } from "react";
import { useList } from "@refinedev/core";
import { ResourceView } from "@/components/resources";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { productForm } from "../products/form-page";
import type { Product } from "../products/model";
import {
  publisherProductColumns,
  type PublisherSummary,
} from "./columns";

const emptyPublishers: PublisherSummary[] = [];
const publisherProductsDescription =
  "إصدارات دور النشر اللي بتتعرض في المكتبة — الناشر بيضيفها من حسابه وبتعدّي على المراجعة. منتجات المنصة نفسها في قسم «منتجات المنصة».";

export function PublisherProductsPage() {
  const { query } = useList<PublisherSummary>({
    resource: "publishers",
    pagination: { mode: "off" },
    sorters: [{ field: "name", order: "asc" }],
    meta: { select: "id,name" },
    queryOptions: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  const publishers = query.data?.data ?? emptyPublishers;
  const columns = useMemo(
    () => publisherProductColumns(publishers),
    [publishers],
  );

  if (query.isPending) {
    return (
      <div
        className="space-y-4"
        role="status"
        aria-label="جارٍ تحميل دور النشر"
      >
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (query.isError && !query.data) {
    return (
      <div
        className="flex flex-col gap-3 rounded-md border border-destructive/30 p-4 text-sm"
        role="alert"
      >
        <p>تعذّر تحميل أسماء دور النشر، لذلك لم يظهر فلتر دار النشر.</p>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? "جارٍ إعادة المحاولة…" : "إعادة المحاولة"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ResourceView<Product>
      resource="personalized_products"
      title="منتجات الناشرين"
      description={
        query.isError ? (
          <>
            <p>{publisherProductsDescription}</p>
            <p role="status" className="text-sm text-muted-foreground">
              تعذّر تحديث أسماء دور النشر؛ المعروض هو آخر بيانات محفوظة.
            </p>
          </>
        ) : (
          publisherProductsDescription
        )
      }
      columns={columns}
      searchField="name"
      mode="page"
      form={productForm}
      canCreate={false}
      canEdit={(product) => product.owner_type === "publisher"}
      refineCoreProps={{
        filters: {
          permanent: [
            { field: "owner_type", operator: "eq", value: "publisher" },
          ],
        },
        sorters: {
          initial: [
            { field: "created_at", order: "desc" },
            { field: "id", order: "asc" },
          ],
        },
      }}
    />
  );
}

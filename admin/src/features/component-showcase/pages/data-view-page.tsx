import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { KanbanSquare, Table2, WandSparkles } from "lucide-react";
import { Amount } from "@/components/dualkit/Amount";
import { Icon } from "@/components/dualkit/icons";
import {
  CreateView,
  CreateViewHeader,
} from "@/components/refine-ui/views/create-view";
import {
  EditView,
  EditViewHeader,
} from "@/components/refine-ui/views/edit-view";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  DataTablePagination,
  DataTableSortMenu,
  DataTableToolbar,
  DataTableViews,
  useDataTable,
} from "@/components/block/shuip/data-table";
import { Kanban, type KanbanColumn } from "@/components/block/shuip/kanban";
import { Calendar1 } from "@/components/calendar1";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDemoProducts, type DemoProduct } from "../demo-provider";
import { ShowcaseLayout } from "../layout";

export type DataViewMode = "table" | "kanban" | "calendar";

const productColumns: ColumnDef<DemoProduct, unknown>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="المنتج" />
    ),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {row.original.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.sku}
        </p>
      </div>
    ),
    meta: { label: "المنتج", variant: "text" },
    size: 260,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="الحالة" />
    ),
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "Active" ? "secondary" : "outline"}
      >
        {row.original.status === "Active" ? "نشط" : "مسودة"}
      </Badge>
    ),
    meta: {
      label: "الحالة",
      variant: "select",
      options: [
        { label: "نشط", value: "Active" },
        { label: "مسودة", value: "Draft" },
      ],
    },
    size: 130,
  },
  {
    accessorKey: "inventory",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="المخزون" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {new Intl.NumberFormat("ar-EG").format(row.original.inventory)} قطعة
        متاحة
      </span>
    ),
    meta: { label: "المخزون", variant: "number" },
    size: 150,
  },
  {
    accessorKey: "price",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="السعر" />
    ),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {new Intl.NumberFormat("ar-EG", {
          style: "currency",
          currency: "EGP",
          maximumFractionDigits: 0,
        }).format(row.original.price)}
      </span>
    ),
    meta: { label: "السعر", variant: "number" },
    size: 120,
  },
];

const productColumnsByStatus: KanbanColumn[] = [
  { id: "Active", label: "نشط", color: "var(--chart-2)" },
  { id: "Draft", label: "مسودة", color: "var(--chart-4)" },
];

function ProductTableView({ products }: { products: DemoProduct[] }) {
  const { table } = useDataTable({
    data: products,
    columns: productColumns,
    getRowId: (product) => product.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  });

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        table={table}
        searchPlaceholder="ابحث عن منتج..."
        variant="inline-chips"
      >
        <DataTableSortMenu table={table} />
        <DataTableViews table={table} storageKey="catalog-products" />
      </DataTableToolbar>
      <DataTable
        table={table}
        emptyState={
          <DataTableEmpty
            variant="illustrated"
            title="مفيش منتجات مطابقة"
            description="جرّب تغيّر كلمة البحث أو تمسح أحد الفلاتر."
          />
        }
      />
      <DataTablePagination table={table} pageSizeOptions={[5, 10, 20]} />
    </div>
  );
}

function ProductKanbanView({
  products,
  onProductsChange,
}: {
  products: DemoProduct[];
  onProductsChange: (products: DemoProduct[]) => void;
}) {
  return (
    <Kanban
      columns={productColumnsByStatus}
      data={products}
      onDataChange={onProductsChange}
      idField="id"
      columnField="status"
      title={(product) => product.title}
      fields={[
        { key: "sku", label: "كود المنتج" },
        {
          key: "inventory",
          label: "المخزون",
          render: (value) =>
            `${new Intl.NumberFormat("ar-EG").format(Number(value))} قطعة`,
        },
        {
          key: "price",
          label: "السعر",
          render: (value) =>
            new Intl.NumberFormat("ar-EG", {
              style: "currency",
              currency: "EGP",
              maximumFractionDigits: 0,
            }).format(Number(value)),
        },
      ]}
      searchableFields={["title", "sku"]}
      searchPlaceholder="ابحث عن منتج..."
      className="min-h-72"
    />
  );
}

function DataViewsPanel({
  selectedView,
  onViewChange,
}: {
  selectedView: DataViewMode;
  onViewChange: (view: DataViewMode) => void;
}) {
  const [products, setProducts] = useState(getDemoProducts);

  return (
    <Card className="rounded-3xl shadow-sm">
      <Tabs
        value={selectedView}
        onValueChange={(value) => onViewChange(value as DataViewMode)}
      >
        <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">منتجات المتجر</CardTitle>
            <CardDescription className="mt-1">
              اعرض المنتجات في جدول أو لوحة أو تقويم. وتظهر تغييرات الحالة في
              الجدول خلال الجلسة.
            </CardDescription>
          </div>
          <TabsList className="h-10 w-full sm:w-auto">
            <TabsTrigger value="table" className="gap-2 px-3">
              <Table2 aria-hidden="true" />
              <span>جدول</span>
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-2 px-3">
              <KanbanSquare aria-hidden="true" />
              <span>لوحة</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2 px-3">
              <Icon name="calendar" />
              <span>تقويم</span>
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <TabsContent value="table" forceMount className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-medium">جدول المنتجات</h2>
                <p className="text-sm text-muted-foreground">
                  رتّب وابحث وصفِّ المنتجات، واحفظ طريقة العرض المناسبة لك.
                </p>
              </div>
              <Badge variant="secondary">
                {new Intl.NumberFormat("ar-EG").format(products.length)} منتجات
                تجريبية
              </Badge>
            </div>
            <ProductTableView products={products} />
          </TabsContent>
          <TabsContent
            value="kanban"
            forceMount
            className="flex flex-col gap-4"
          >
            <div>
              <h2 className="font-medium">لوحة المنتجات</h2>
              <p className="text-sm text-muted-foreground">
                اسحب المنتج بين «نشط» و«مسودة» لتغيير حالته.
              </p>
            </div>
            <ProductKanbanView
              products={products}
              onProductsChange={setProducts}
            />
          </TabsContent>
          <TabsContent
            value="calendar"
            forceMount
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-medium">التقويم</h2>
                <p className="text-sm text-muted-foreground">
                  عدّل المواعيد التجريبية؛ ستعود كما كانت بعد تحديث الصفحة.
                </p>
              </div>
              <Badge variant="outline">مواعيد تجريبية · أكتوبر ٢٠٢٦</Badge>
            </div>
            <Calendar1 className="h-[min(76svh,900px)] min-h-[560px] rounded-2xl border shadow-sm" />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

function DualKitAmountPreview() {
  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">تنسيق المبالغ · DualKit</CardTitle>
        <CardDescription>
          مثال تنسيق مستقل بالجنيه المصري، وليس سعرًا لمنتج في الكتالوج.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div
          lang="ar-EG"
          dir="rtl"
          className="rounded-2xl border bg-muted/30 p-4"
        >
          <Amount
            amount={4250}
            currency="EGP"
            label="العربية - مصر"
            note="مثال فقط"
          />
        </div>
        <div
          lang="ar-EG"
          dir="rtl"
          className="rounded-2xl border bg-muted/30 p-4"
        >
          <Amount
            amount={4250}
            currency="EGP"
            locale="ar"
            label="نمط عرض آخر"
            note="الجنيه المصري"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ViewsSection() {
  return (
    <section id="views" className="flex flex-col gap-5">
      <SectionHeading
        eyebrow="أمثلة الصفحات"
        title="قائمة وإنشاء وتعديل وتفاصيل"
        description="أمثلة توضّح تنسيق الصفحات حول محتوى كل ميزة."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-3xl shadow-sm">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="mb-2 w-fit">
              صفحة إنشاء
            </Badge>
            <CardDescription>مساحة عمل لمنتج جديد</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateView>
              <CreateViewHeader resource="products" title="إنشاء منتج" />
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                يظهر هنا نموذج الميزة وحقولها.
              </div>
            </CreateView>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-sm">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="mb-2 w-fit">
              صفحة تعديل
            </Badge>
            <CardDescription>مساحة عمل لتعديل منتج</CardDescription>
          </CardHeader>
          <CardContent>
            <EditView>
              <EditViewHeader resource="products" title="تعديل منتج" />
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                تظهر هنا الحقول بعد التحقق وحالة الحفظ.
              </div>
            </EditView>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-sm">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="mb-2 w-fit">
              صفحة التفاصيل
            </Badge>
            <CardDescription>تفاصيل المنتج للعرض فقط</CardDescription>
          </CardHeader>
          <CardContent>
            <ShowView>
              <ShowViewHeader resource="products" title="تفاصيل المنتج" />
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                يمكن أن تجمع صفحة التفاصيل بين الحالة والوصف والإجراءات.
              </div>
            </ShowView>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-3xl flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <span className="hidden items-center gap-1 whitespace-nowrap text-xs text-muted-foreground lg:inline-flex">
        <WandSparkles className="size-3.5" />
        معاينة للمكوّن
      </span>
    </div>
  );
}

export function DataViewPage({
  activeSection,
  selectedView,
  onViewChange,
}: {
  activeSection: "data-view";
  selectedView: DataViewMode;
  onViewChange: (view: DataViewMode) => void;
}) {
  return (
    <ShowcaseLayout activeSection={activeSection}>
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-5">
          <SectionHeading
            eyebrow="الكتالوج · طرق عرض البيانات"
            title="اعرض البيانات بالطريقة المناسبة لك"
            description="استخدم بيانات المنتجات نفسها في جدول قابل للبحث ولوحة بالسحب والإفلات، أو انتقل للتقويم لمتابعة المواعيد."
          />
          <DataViewsPanel
            selectedView={selectedView}
            onViewChange={onViewChange}
          />
        </section>
        <DualKitAmountPreview />
        <ViewsSection />
      </div>
    </ShowcaseLayout>
  );
}

import { Pencil, WandSparkles } from "lucide-react";
import {
  CreateView,
  CreateViewHeader,
} from "@/components/refine-ui/views/create-view";
import {
  EditView,
  EditViewHeader,
} from "@/components/refine-ui/views/edit-view";
import {
  ListView,
  ListViewHeader,
} from "@/components/refine-ui/views/list-view";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductsTablePreview } from "../products-table";
import { ShowcaseLayout } from "../showcase-layout";

function DataSection() {
  return (
    <section id="data" className="scroll-mt-24 space-y-5">
      <SectionHeading
        eyebrow="Refine · data view"
        title="Products table"
        description="A real Refine useTable + TanStack Table composition with client-side search, sort controls, loading/empty states, row actions, and pagination."
      />
      <ListView className="gap-4">
        <ListViewHeader
          resource="products"
          title="Catalog products"
          canCreate
        />
        <Card className="rounded-[24px] shadow-sm">
          <CardHeader className="border-b py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Product inventory</CardTitle>
              <CardDescription className="mt-1">
                Refine React Table · local sample records
              </CardDescription>
            </div>
            <Badge variant="secondary" className="mt-2 w-fit sm:mt-0">
              Updated just now
            </Badge>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <ProductsTablePreview />
          </CardContent>
        </Card>
      </ListView>
    </section>
  );
}

function ViewsSection() {
  return (
    <section id="views" className="scroll-mt-24 space-y-5">
      <SectionHeading
        eyebrow="Refine · page patterns"
        title="List, create, edit, and show"
        description="Small composition examples showing how the view wrappers and headers sit around feature-owned content."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-[24px] shadow-sm">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="mb-2 w-fit">
              CreateView
            </Badge>
            <CardDescription>New product workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateView>
              <CreateViewHeader resource="products" title="Create product" />
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                Feature-owned form content goes here.
              </div>
            </CreateView>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] shadow-sm">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="mb-2 w-fit">
              EditView
            </Badge>
            <CardDescription>Update product workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <EditView>
              <EditViewHeader resource="products" title="Edit product" />
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                Validated fields and mutation state go here.
              </div>
            </EditView>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] shadow-sm">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="mb-2 w-fit">
              ShowView
            </Badge>
            <CardDescription>Read-only product detail</CardDescription>
          </CardHeader>
          <CardContent>
            <ShowView>
              <ShowViewHeader resource="products" title="Product details" />
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                A detail projection can compose badges, descriptions, and
                actions.
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
      <div className="max-w-3xl space-y-2">
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
        Component preview
      </span>
    </div>
  );
}

function PencilIcon() {
  return <Pencil className="size-4" />;
}

export function DataViewPage({
  activeSection,
}: {
  activeSection: "data-view";
}) {
  return (
    <ShowcaseLayout activeSection={activeSection}>
      <>
        <DataSection />
        <ViewsSection />
      </>
    </ShowcaseLayout>
  );
}

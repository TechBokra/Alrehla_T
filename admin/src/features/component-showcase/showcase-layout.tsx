import type { ReactNode } from "react";
import { Refine, useGetIdentity } from "@refinedev/core";
import { toast } from "sonner";
import { Package, Store } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/refine-ui/theme/theme-provider";
import { Toaster } from "@/components/refine-ui/notification/toaster";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  previewAuthProvider,
  previewDataProvider,
  previewRouterProvider,
} from "./demo-provider";
import { showcaseNavigation, type ShowcaseSection } from "./sections";

const resources = [
  {
    name: "products",
    list: "/",
    create: "/",
    edit: "/",
    clone: "/",
    show: "/",
    meta: {
      label: "Products",
      icon: <Package className="size-4" />,
    },
  },
];

type ShowcaseLayoutProps = {
  activeSection: ShowcaseSection;
  children: ReactNode;
};

type ShowcaseIdentity = {
  name?: string;
  email?: string;
  avatar?: string;
  image?: string;
};

export function ShowcaseLayout({
  activeSection,
  children,
}: ShowcaseLayoutProps) {
  const activePage = showcaseNavigation.find(
    (item) => item.id === activeSection
  );

  return (
    <Refine
      resources={resources}
      dataProvider={previewDataProvider}
      authProvider={previewAuthProvider}
      routerProvider={previewRouterProvider}
      notificationProvider={{
        open: ({ message, description, type }) => {
          if (type === "error") toast.error(message, { description });
          else if (type === "progress") toast.loading(message, { description });
          else toast.success(message, { description });
        },
        close: (key) => toast.dismiss(key),
      }}
      options={{
        disableTelemetry: true,
        disableRouteChangeHandler: true,
        syncWithLocation: false,
        title: {
          text: "Calesee Admin",
          icon: <Store className="size-5" />,
        },
      }}
    >
      <ThemeProvider
        defaultTheme="light"
        storageKey="calesee-admin-preview-theme"
      >
        <ShowcaseShell
          activeSection={activeSection}
          pageLabel={activePage?.label}
        >
          {children}
        </ShowcaseShell>
        <Toaster position="bottom-right" richColors />
      </ThemeProvider>
    </Refine>
  );
}

function ShowcaseShell({
  activeSection,
  pageLabel,
  children,
}: {
  activeSection: ShowcaseSection;
  pageLabel?: string;
  children: ReactNode;
}) {
  const { data: identity } = useGetIdentity<ShowcaseIdentity>();
  const user = {
    name: identity?.name ?? "Preview Admin",
    email: identity?.email ?? "admin@example.test",
    avatar: identity?.avatar ?? identity?.image ?? "",
  };

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar activeSection={activeSection} user={user} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b border-sidebar-border bg-background/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-5" />
            <div className="hidden text-sm text-muted-foreground sm:block">
              Admin system <span className="px-1.5">/</span>
              <span className="font-medium text-foreground">
                {pageLabel ?? "Component gallery"}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-12 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
          <footer className="flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Calesee Admin · Frontend component preview</span>
            <span>
              All records and authentication in this gallery are local demos.
            </span>
          </footer>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

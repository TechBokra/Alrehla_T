import type { ReactNode } from "react";
import { Refine, useGetIdentity, useLogout } from "@refinedev/core";
import { toast } from "sonner";
import { Package, Store } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { adminAuthProvider } from "@/features/auth/supabase";
import { Separator } from "@/components/ui/separator";
import { arabicEgyptI18nProvider } from "@/lib/i18n-provider";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { previewDataProvider, previewRouterProvider } from "./demo-provider";
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
      label: "المنتجات",
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
    (item) => item.id === activeSection,
  );

  return (
    <Refine
      resources={resources}
      dataProvider={previewDataProvider}
      authProvider={adminAuthProvider}
      routerProvider={previewRouterProvider}
      notificationProvider={{
        open: ({ message, description, type }) => {
          if (type === "error") toast.error(message, { description });
          else if (type === "progress") toast.loading(message, { description });
          else toast.success(message, { description });
        },
        close: (key) => toast.dismiss(key),
      }}
      i18nProvider={arabicEgyptI18nProvider}
      options={{
        disableTelemetry: true,
        disableRouteChangeHandler: true,
        syncWithLocation: false,
        title: {
          text: "الرحلة · لوحة الإدارة",
          icon: <Store className="size-5" />,
        },
      }}
    >
      <ShowcaseShell
        activeSection={activeSection}
        pageLabel={activePage?.label}
      >
        {children}
      </ShowcaseShell>
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
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const user = {
    name: identity?.name ?? "حساب الإدارة",
    email: identity?.email ?? "",
    avatar: identity?.avatar ?? identity?.image ?? "",
  };

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        activeSection={activeSection}
        user={user}
        logOut={logout}
        isLoggingOut={isLoggingOut}
      />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b border-sidebar-border bg-background/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="h-5" />
            <div className="hidden text-sm text-muted-foreground sm:block">
              نظام الإدارة <span className="px-1.5">/</span>
              <span className="font-medium text-foreground">
                {pageLabel ?? "معرض المكوّنات"}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-12 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { Fragment, lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { DirectionProvider } from "./components/ui/direction";
import "./styles.css";
import "./components/dualkit/tokens.css";
import "./components/dualkit/styles.css";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import { Loading } from "./components/route-states/loading";
import { AppErrorBoundary } from "./components/route-states/app-error-boundary";

const DevelopmentTools = import.meta.env.DEV
  ? lazy(() => import("./providers/devtools"))
  : Fragment;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <Suspense fallback={<Loading />}>
        <DevelopmentTools>
          <DirectionProvider direction="rtl">
            <TooltipProvider>
              <ThemeProvider
                defaultTheme="light"
                storageKey="admin-preview-theme"
              >
                <RouterProvider router={router} />
                <Toaster position="bottom-left" richColors />
              </ThemeProvider>
            </TooltipProvider>
          </DirectionProvider>
        </DevelopmentTools>
      </Suspense>
    </AppErrorBoundary>
  </StrictMode>,
);

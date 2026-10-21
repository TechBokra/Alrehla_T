import { StrictMode } from "react";
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
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DirectionProvider direction="rtl">
      <TooltipProvider>
        <ThemeProvider
          defaultTheme="light"
          storageKey="calesee-admin-preview-theme"
        >
          <RouterProvider router={router} />
          <Toaster position="bottom-left" richColors />
        </ThemeProvider>
      </TooltipProvider>
    </DirectionProvider>
  </StrictMode>,
);

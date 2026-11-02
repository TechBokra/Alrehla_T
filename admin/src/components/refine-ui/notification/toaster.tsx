"use client";

import { cn } from "@/lib/utils";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/components/refine-ui/theme/theme-provider";

export function Toaster({ toastOptions, ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      dir="rtl"
      containerAriaLabel="الإشعارات"
      toastOptions={{
        ...toastOptions,
        closeButtonAriaLabel: "إغلاق الإشعار",
        classNames: {
          ...toastOptions?.classNames,
          toast: cn("font-sans text-start", toastOptions?.classNames?.toast),
          content: cn("text-start", toastOptions?.classNames?.content),
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

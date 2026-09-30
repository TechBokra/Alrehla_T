import type { ReactNode } from 'react';

/**
 * Admin application boundary.
 *
 * Role-specific layouts below this segment own their navigation and access
 * checks. This parent layout is deliberately neutral so it can later host
 * admin-only providers (for example, the admin TanStack Query client) without
 * leaking them into storefront routes.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}

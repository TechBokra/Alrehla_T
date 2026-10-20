# Domain structure

Group domain readers and page queries by audience, then by feature:

```text
domains/
  (admin)/
    orders/
      queries.ts
      page-data.ts
      detail.ts
      page-data.test.ts
    files/
      cleanup.ts
      cleanup.test.ts
    finance/
    sessions/
  (client)/
    orders/
      queries.ts
    family/
      queries.ts
      follow-up.ts
      follow-up.test.ts
    bookings/
    subscriptions/
  (shared)/
    auth/
    files/
      queries.ts
      settings.ts
    service-orders/
      queries.ts
      messages.ts
      types.ts
      internal.ts
    settings/
    portfolio/
```

- `(admin)` contains staff and management queries, including instructor, provider, and publisher dashboards.
- `(client)` contains customer and student queries and customer page compositions.
- `(shared)` contains common readers, contracts, and helpers used by both audiences. Common code depends on other shared features and the infrastructure layer.
- Keep tests beside the feature they cover. Tests spanning several features live under `(shared)/testing`.
- `queries.ts` holds data readers; `page-data.ts` composes the data needed by a page; `types.ts` holds shared contracts. More specific files group subfeatures such as shipments, media, and session reports.
- Import the owning module directly. For example:

```ts
import { getAdminOrdersPageData } from '@/data/domains/(admin)/orders/page-data';
import { getOrders } from '@/data/domains/(client)/orders/queries';
import { getOrderFiles } from '@/data/domains/(shared)/files/queries';
```

Authorization is enforced by server guards and database RLS. `QueryResult`, server query handling, and server time utilities stay in `src/data/` as common infrastructure.

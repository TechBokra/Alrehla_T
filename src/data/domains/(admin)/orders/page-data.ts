import 'server-only';
import type { Order } from '@/types';
import type { QueryResult, QueryReadOptions } from '@/data/query-result';
import { readServerQuery } from '@/data/server-query';
import { getAllOrders } from '@/data/domains/(admin)/orders/queries';
import { createClient } from '@/lib/supabase/server';
import { fetchIn } from '@/lib/fetch-all';

export type AdminOrdersPageData = {
  orders: Order[];
  productNames: Record<string, string>;
  productCategories: Record<string, string>;
  customerNames: Record<string, string>;
};

export type AdminOrdersPageResult = QueryResult<AdminOrdersPageData, 'LOAD_FAILED'>;

/** Loads exactly the data required by the admin orders list. */
export async function getAdminOrdersPageData(): Promise<AdminOrdersPageResult> {
  return readServerQuery(async () => {
    const options: QueryReadOptions = { throwOnError: true };
    const orders = await getAllOrders(options);
    const supabase = await createClient();
    const productIds = Array.from(new Set(orders.flatMap((order) => order.items.map((item) => item.productId))));
    const userIds = Array.from(new Set(orders.map((order) => order.userId)));

    const [products, profiles] = await Promise.all([
      fetchIn(
        productIds,
        (part) => supabase.from('personalized_products').select('id, name, category').in('id', part),
        undefined,
        options,
      ),
      fetchIn(
        userIds,
        (part) => supabase.from('user_profiles').select('id, full_name').in('id', part),
        undefined,
        options,
      ),
    ]);

    return {
      orders,
      productNames: Object.fromEntries(products.map((product) => [product.id, product.name])),
      productCategories: Object.fromEntries(products.map((product) => [product.id, product.category])),
      customerNames: Object.fromEntries(
        profiles.flatMap((profile) => profile.full_name ? [[profile.id, profile.full_name] as const] : []),
      ),
    };
  }, 'تعذّر تحميل الطلبات. جرّب تاني.');
}

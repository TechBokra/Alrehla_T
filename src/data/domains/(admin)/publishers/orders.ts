import { PublisherOrder } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { getPublisherPricingSettings } from '@/data/domains/(shared)/pricing/queries';
import { sharePerUnit } from '@/lib/publisher-sales';
import { getMyPublisher } from '@/data/domains/(admin)/publishers/queries';

/**
 * طلبات الناشر الحقيقية ونصيبه منها.
 *
 * دي كانت **مخترعة بالكامل**: بتبني الطلبات من بيانات تجريبية، ومعاها
 * `setTimeout(600)` بيقلّد بطء الشبكة عشان تبان حقيقية، وبتحسب نصيب
 * الناشر 70% ثابتة مكتوبة في الكود. يعني أي ناشر بيفتح لوحته كان بيشوف
 * طلبات وأرباح مش موجودة.
 *
 * النسخة دي بتقرا من قاعدة البيانات.
 *
 * ⚠️ **والنصيب بيتقري من `publisher_cost` لا بعكس المعادلة** (ملف
 *    97). كانت بتتحسب بالعكس:
 *
 *        نصيب الناشر = (سعر العميل − الرسم) ÷ المعامل
 *
 *    والعكس ده بيدّي رقمًا صح **طول ما المعادلة ما اتغيّرتش**. أول ما
 *    الإدارة تعدّل النسبة، كل الطلبات القديمة بتتحسب بالمعادلة
 *    الجديدة — فالناشر يفتح لوحته يلاقي نصيبه من بيعة الشهر اللي فات
 *    **اتغيّر لوحده**، ورقم شاشة الطلبات يخالف رقم المستحقات.
 *
 *    `publisher_cost` رقم مخزّن على المنتج، فالشاشتان بيقروا نفس
 *    المصدر.
 *
 * ⚠️ **والقديم لسه بيتحسب بالعكس**: المنتجات اللي اتعملت قبل ملف 97
 *    `publisher_cost` بتاعها فاضي، فبنرجع للعكس عشان مانعرضش صفرًا
 *    على بيعة حقيقية.
 */
export async function getPublisherOrders(): Promise<PublisherOrder[]> {
  const publisher = await getMyPublisher();
  if (!publisher) return [];

  const supabase = await createClient();

  // منتجات الناشر ده.
  const { data: products } = await supabase
    .from('personalized_products')
    .select('id, name, publisher_cost')
    .eq('publisher_id', publisher.id);

  if (!products || products.length === 0) return [];
  const productById = new Map(products.map((p) => [p.id, p]));

  // ⚠️ **بعميل الإدارة — وده كان سبب اختبار «إنها لك» 7.7** («صفحة طلبات
  //    الناشر مابتعرضش طلبات كتبه»): قواعد الحماية بتسمح للعميل يقرا
  //    طلباته **هو** بس، فالناشر كان بيسأل عن طلبات غيره والقاعدة ترجّع
  //    فاضي من غير غلط. ماحطّيناش قاعدة حماية للناشر عن قصد: كانت هتفتح
  //    له صف الطلب كله (عنوان العميل وتليفونه). هنا الخادم بيقرا
  //    **أعمدة بعينها** (الكمية والسعر والحالة والتاريخ) لمنتجات الناشر
  //    ده بس — واللي اتأكدنا منه فوق بحسابه هو.
  const { createAdminClient, isAdminApiConfigured } = await import('@/lib/supabase/admin');
  const reader = isAdminApiConfigured() ? createAdminClient() : supabase;

  // بنودها في الطلبات.
  const { data: items } = await reader
    .from('order_items')
    .select('id, order_id, product_id, quantity, unit_price, publisher_cost_snapshot')
    .in('product_id', Array.from(productById.keys()));

  if (!items || items.length === 0) return [];

  // الطلبات نفسها — للحالة والتاريخ.
  const orderIds = Array.from(new Set(items.map((i) => i.order_id)));
  const { data: orders } = await reader
    .from('orders')
    .select('id, status, created_at')
    .in('id', orderIds);

  const orderById = new Map((orders ?? []).map((o) => [o.id, o]));

  const formula = await getPublisherPricingSettings();
  const multiplier = formula.platformMultiplier > 0 ? formula.platformMultiplier : 1;

  const rows: PublisherOrder[] = [];
  for (const item of items) {
    const order = orderById.get(item.order_id);
    if (!order) continue;

    const product = productById.get(item.product_id);
    const totalAmount = item.unit_price * item.quantity;

    // ⚠️ المتثبّت وقت الشراء أولًا (ملف 134) — `sharePerUnit`.
    const unitShare = sharePerUnit({
      snapshot: item.publisher_cost_snapshot,
      currentCost: product?.publisher_cost,
      unitPrice: item.unit_price,
      fixedAdminFee: formula.fixedAdminFee,
      multiplier,
    });

    rows.push({
      id: item.id,
      orderId: item.order_id,
      productName: product?.name ?? 'منتج محذوف',
      quantity: item.quantity,
      totalAmount,
      publisherShare: unitShare * item.quantity,
      status: order.status,
      createdAt: order.created_at,
    });
  }

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

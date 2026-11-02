import type { ReactNode } from "react";
import { createResourcePage } from "@/components/resources/page";
import { useResourcePage } from "@/hooks/resources";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { orderCommands } from "./commands";
import {
  formatDate,
  money,
  orderReference,
  orderStatusLabels,
  orderSubtotal,
  paymentMethodLabel,
  type OrderDetail,
} from "./model";

export const orderPage = createResourcePage<OrderDetail, typeof orderCommands>({
    kind: "details",
    resource: "orders",
    dataProviderName: "orders",
    title: "تفاصيل الطلب",
    description: "تفاصيل الطلب والدفع والتجهيز وسجل الحالة.",
    commands: orderCommands,
    Content: OrderDetailsContent,
});

function OrderDetailsContent() {
  const order = useResourcePage(orderPage);
  const record = order.record!;
  const subtotal = orderSubtotal(record);
  const hasDiscount = record.discount_amount > 0;
  return (
    <div className="flex flex-col gap-6">
      {record.box_plan_id ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">هذا الطلب مرتبط بصندوق، وتبقى متابعة الشحنات الشهرية في مسار الصندوق المخصص.</CardContent></Card>
      ) : <OrderCommandBar />}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>الطلب والعميل</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              {record.photoPreview ? (
                record.photoPreview.available ? (
                  <Avatar className="size-12"><AvatarImage src={record.photoPreview.url} alt="صورة المستلم" /><AvatarFallback>{(record.participant?.full_name ?? record.customer?.full_name ?? "ط").slice(0, 1)}</AvatarFallback></Avatar>
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">غير متاح</div>
                )
              ) : null}
              <div className="min-w-0">
                <p className="font-medium">{record.recipient_name || record.participant?.full_name || record.customer?.full_name || "عميل"}</p>
                {record.recipient_phone ? <bdi dir="ltr" className="text-sm text-muted-foreground">{record.recipient_phone}</bdi> : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="رقم الطلب"><bdi dir="ltr">{orderReference(record)}</bdi></Detail>
              <Detail label="تاريخ الطلب">{formatDate(record.created_at)}</Detail>
              <Detail label="الحالة"><Badge variant={record.status === "paid" || record.status === "delivered" ? "secondary" : "outline"}>{orderStatusLabels[record.status]}</Badge></Detail>
              <Detail label="البريد الإلكتروني للتسليم"><bdi dir="ltr">{record.delivery_email || "—"}</bdi></Detail>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>الدفع</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Detail label="بوابة الدفع">{paymentMethodLabel(record)}</Detail>
            <Detail label="طريقة الدفع">{record.payment_method || "—"}</Detail>
            <Detail label="حالة XPay">{record.paid_at ? "تم تأكيد الدفع" : record.status === "failed" ? "فشل الدفع" : "بانتظار تحديث بوابة الدفع"}</Detail>
            <Detail label="تاريخ الدفع">{formatDate(record.paid_at)}</Detail>
            {record.payment_reference ? <Detail label="مرجع الدفع"><bdi dir="ltr">{record.payment_reference}</bdi></Detail> : null}
            {record.transaction_reference ? <Detail label="مرجع العملية"><bdi dir="ltr">{record.transaction_reference}</bdi></Detail> : null}
            {record.payment_receipt_url ? (
              <Detail label="إثبات الدفع">
                {record.receiptPreview?.available
                  ? <a href={record.receiptPreview.url} target="_blank" rel="noreferrer" className="underline">فتح الإثبات</a>
                  : "المعاينة غير متاحة لهذا الملف"}
              </Detail>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>العنوان والشحن</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Detail label="العنوان">{record.address_line || "—"}</Detail>
            <Detail label="المدينة">{record.city || "—"}</Detail>
            <Detail label="المحافظة">{record.governorate || "—"}</Detail>
            <Detail label="ملاحظات التوصيل">{record.shipping_notes || "—"}</Detail>
            <Detail label="رقم التتبع"><bdi dir="ltr">{record.tracking_reference || "—"}</bdi></Detail>
            <Detail label="ملاحظات الإدارة">{record.admin_notes || "—"}</Detail>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ملخص المبالغ</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Detail label="قيمة المنتجات">{money(subtotal)}</Detail>
            <Detail label="الشحن">{money(record.shipping_fee)}</Detail>
            {hasDiscount ? <Detail label={`الخصم${record.discount_code ? ` (${record.discount_code})` : ""}`}>−{money(record.discount_amount)}</Detail> : null}
            <Detail label="الإجمالي"><strong>{money(record.total_amount)}</strong></Detail>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>المنتجات والإضافات</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {record.items.length ? record.items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 border-b pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                {item.image_url ? <img src={item.image_url} alt="" className="size-14 rounded-md border object-cover" /> : null}
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-muted-foreground">{item.format} × {item.quantity}</p>
                  <OrderItemCustomization data={item.customization_data} />
                </div>
              </div>
              <bdi className="shrink-0">{money(item.unit_price * item.quantity)}</bdi>
            </div>
          )) : <p className="text-sm text-muted-foreground">لا توجد عناصر مرتبطة بالطلب.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>مراحل الطلب</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="إنشاء الطلب">{formatDate(record.created_at)}</Detail>
          <Detail label="تأكيد الدفع">{formatDate(record.paid_at)}</Detail>
          <Detail label="الشحن">{formatDate(record.shipped_at)}</Detail>
          <Detail label="التسليم">{formatDate(record.delivered_at)}</Detail>
          <Detail label="إرسال النسخة الإلكترونية">{formatDate(record.electronic_sent_at)}</Detail>
          <Detail label="آخر تحديث">{formatDate(record.updated_at)}</Detail>
        </CardContent>
      </Card>
    </div>
  );
}

function OrderCommandBar() {
  const order = useResourcePage(orderPage);
  const next = order.actions.startPreparation;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!next.disabled ? <orderPage.Action name="startPreparation" /> : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={order.pending}>إجراءات الطلب</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          <orderPage.ActionMenuItem name="markShipped" />
          <orderPage.ActionMenuItem name="markDelivered" />
          <orderPage.ActionMenuItem name="cancel" />
          <orderPage.ActionMenuItem name="electronicSent" />
          <orderPage.ActionMenuItem name="retryPublisherEarnings" />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="break-words text-sm">{children}</div>
    </div>
  );
}

function OrderItemCustomization({ data }: { data: OrderDetail["items"][number]["customization_data"] }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const values = data as Record<string, unknown>;
  const privatePhotoKeys = ["childPhoto", "secondPhoto", "coverPhoto"];
  const publicPhotoKeys = ["childPhotoUrl", "secondPhotoUrl", "coverPhotoUrl"];
  type PhotoPreview =
    | { label: string; kind: "deleted" | "private" }
    | { label: string; kind: "public"; url: string };
  const photos: PhotoPreview[] = [
    ...privatePhotoKeys.flatMap<PhotoPreview>((key) => {
      const value = values[key];
      if (!value || typeof value !== "object") return [];
      const photo = value as { publicId?: unknown; deletedAt?: unknown };
      if (typeof photo.deletedAt === "string") return [{ label: key, kind: "deleted" as const }];
      return typeof photo.publicId === "string" && photo.publicId.startsWith("alrehla/private/")
        ? [{ label: key, kind: "private" as const }]
        : [];
    }),
    ...publicPhotoKeys.flatMap<PhotoPreview>((key) => {
      const url = values[key];
      if (typeof url !== "string") return [];
      try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com"
          ? [{ label: key, kind: "public" as const, url }]
          : [];
      } catch {
        return [];
      }
    }),
  ];
  const safeValues = Object.fromEntries(
    Object.entries(values).filter(([key]) => ![...privatePhotoKeys, ...publicPhotoKeys].includes(key)),
  );
  const labels: Record<string, string> = {
    childPhoto: "صورة الطفل",
    secondPhoto: "صورة إضافية",
    coverPhoto: "صورة الغلاف",
    childPhotoUrl: "صورة الطفل",
    secondPhotoUrl: "صورة إضافية",
    coverPhotoUrl: "صورة الغلاف",
  };
  return (
    <div className="mt-2 flex max-w-2xl flex-col gap-3">
      {photos.length ? (
        <div className="flex flex-wrap gap-3">
          {photos.map((photo) => (
            <div key={photo.label} className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>{labels[photo.label]}</span>
              {photo.kind === "public" ? (
                <img src={photo.url} alt={labels[photo.label]} className="size-24 rounded-md border object-cover" />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-md border bg-muted p-2 text-center">
                  {photo.kind === "private" ? "معاينة الصورة الخاصة غير متاحة" : "انتهت مدة الاحتفاظ بالصورة"}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {Object.keys(safeValues).length ? (
        <pre dir="auto" className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(safeValues, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

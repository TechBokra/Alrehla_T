import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, FormActions, SubmitButton, TextInput } from '@/components/forms/Form';
import { saveProductDeliveryDays } from '@/actions/products';
import { daysLabel, type DeliveryDays } from '@/lib/delivery-days';

/**
 * مدة تجهيز الكتاب ده — فاضية = القيمة العامة من «الإعدادات».
 * حفظ لوحده (مش جوّه نموذج المنتج) عشان مايلمسش أي خانة تانية.
 */
export function ProductDeliveryDaysForm({
  productId,
  electronic,
  printed,
  globalDays,
  hasElectronic,
}: {
  productId: string;
  electronic?: number;
  printed?: number;
  globalDays: DeliveryDays;
  hasElectronic: boolean;
}) {
  return (
    <section className="mt-8 border-t border-slate-100 pt-6" aria-labelledby="delivery-days-h">
      <h2 id="delivery-days-h" className="text-lg font-black text-slate-800">
        مدة التجهيز
      </h2>
      <p className="mt-1 text-sm font-medium text-slate-600">
        سيبها فاضية عشان الكتاب ياخد القيمة العامة (الإلكترونية {daysLabel(globalDays.electronic)} · المطبوعة{' '}
        {daysLabel(globalDays.printed)}). العميل بيشوفها في صفحة المنتج.
      </p>
      <ActionForm action={saveProductDeliveryDays} successMessage="اتحفظت مدة التجهيز." className="mt-4 space-y-4">
        <input type="hidden" name="productId" value={productId} />
        <div className="grid gap-4 md:grid-cols-2">
          {hasElectronic && (
            <Field label="النسخة الإلكترونية (أيام)" name="deliveryDaysElectronic">
              <TextInput
                type="number"
                min={1}
                max={120}
                dir="ltr"
                className="text-left"
                placeholder={String(globalDays.electronic)}
                defaultValue={electronic ?? ''}
              />
            </Field>
          )}
          <Field label="النسخة المطبوعة (أيام، قبل الشحن)" name="deliveryDaysPrinted">
            <TextInput
              type="number"
              min={1}
              max={120}
              dir="ltr"
              className="text-left"
              placeholder={String(globalDays.printed)}
              defaultValue={printed ?? ''}
            />
          </Field>
        </div>
        {!hasElectronic && <input type="hidden" name="deliveryDaysElectronic" value={electronic ?? ''} />}
        <FormActions>
          <SubmitButton>حفظ المدة</SubmitButton>
        </FormActions>
      </ActionForm>
    </section>
  );
}

import { useAppForm } from "@/lib/form";
import type { CloudinaryImageValue } from "@/components/upload/cloudinary";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
export function ImageUploadDemo() {
  const form = useAppForm({
    defaultValues: { image: null as CloudinaryImageValue },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>رفع الصور باستخدام UploadCN</CardTitle>
        <CardDescription>
          تُرسل الصور إلى Cloudinary عند تزويد الحقل بمحوّل متصل بالخادم. هذا
          المثال غير متصل بخدمة الرفع.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="max-w-xl">
          <form.AppField name="image">
            {(field) => (
              <field.ImageUploadField
                label="صورة المنتج"
                description="اختر صورة واضحة للمنتج. تُحفظ نتيجة الرفع الناجح في النموذج."
                maxSizeMb={5}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

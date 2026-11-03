import { ResourceView } from "@/components/resources";
import {
  customizationFieldColumns,
  storyGoalColumns,
  writingDialectColumns,
} from "./columns";
import {
  customizationFieldForm,
  storyGoalForm,
} from "./personalization-dialog";
import { writingDialectForm } from "./dialect-dialog";
import {
  CATALOG_SETTINGS_PROVIDER,
  type CustomizationField,
  type StoryGoal,
  type WritingDialect,
} from "./model";

const customizationDescrption = `الخانات دي بتظهر للعميل في خطوة التخصيص — تحت الخانات الأساسية — في كل المنتجات (القصة المخصصة، وتخصيص غلاف المكتبة، وصندوق الرحلة)، أو في منتجات بعينها تختارها لكل خانة.

الخانات الأساسية ثابتة ومش هنا: اسم الطفل، تاريخ الميلاد، صورته، والهدف ووصف البطل والإهداء وأسماء العائلة.

إجابة العميل بتتحفظ في الطلب ومعاها اسم الخانة — فتغيير اسم خانة أو مسحها مابيبوّظش الطلبات القديمة.`;
export function CustomizationFieldsPage() {
  return (
    <ResourceView<CustomizationField>
      resource="customization_fields"
      title="خانات التخصيص"
      description={customizationDescrption}
      columns={customizationFieldColumns}
      searchField="label"
      mode="dialog"
      form={customizationFieldForm}
      deleteConsequence="لن تظهر الخانة في نماذج التخصيص الجديدة. بيانات الطلبات السابقة تظل محفوظة."
      orderField="sort_order"
      getRowLabel={(row) => row.label}
      refineCoreProps={{ dataProviderName: CATALOG_SETTINGS_PROVIDER }}
    />
  );
}
const storyGoalsDescription = `العميل بيختار هدف واحد للقصة في خطوة «تفاصيل القصة» — من القايمة دي. وفي اشتراك صندوق الرحلة بتظهر كاقتراحات لهدف كل شهر.

اختيار «هدف آخر — أكتبه بنفسي» موجود دايمًا في آخر القايمة، مش هنا.

كل هدف ممكن يظهر في كل المنتجات أو في منتجات بعينها. والطلبات القديمة بتفضل حافظة نص الهدف اللي اتختار وقتها — فتغيير هدف أو مسحه مابيبوّظش حاجة.`;

export function StoryGoalsPage() {
  return (
    <ResourceView<StoryGoal>
      resource="story_goals"
      title="أهداف التخصيص"
      description={storyGoalsDescription}
      columns={storyGoalColumns}
      searchField="label"
      mode="dialog"
      form={storyGoalForm}
      deleteConsequence="لن يظهر الهدف ضمن الاختيارات الجديدة. بيانات الطلبات السابقة تظل محفوظة."
      orderField="sort_order"
      getRowLabel={(row) => row.label}
      refineCoreProps={{ dataProviderName: CATALOG_SETTINGS_PROVIDER }}
    />
  );
}
const writingDialectsDescription = `
اللهجات التي يختار منها العميل في «إنها لك» عند اختيار «لهجة». الإيقاف يخفي اللهجة عن العملاء الجدد فقط،
 والطلبات السابقة تحتفظ باختيارها. أي منتج يتحكم في الأساليب المتاحة له من شاشة المنتج نفسه.

`;
export function WritingDialectsPage() {
  return (
    <ResourceView<WritingDialect>
      resource="writing_dialects"
      title="لهجات الكتابة"
      description={writingDialectsDescription}
      columns={writingDialectColumns}
      searchFields={["name_ar", "code"]}
      mode="dialog"
      form={writingDialectForm}
      deleteConsequence="لن تكون اللهجة متاحة للاختيارات الجديدة. بيانات الطلبات السابقة تظل محفوظة."
      refineCoreProps={{
        dataProviderName: CATALOG_SETTINGS_PROVIDER,
        sorters: {
          initial: [
            { field: "sort_order", order: "asc" },
            { field: "code", order: "asc" },
          ],
        },
      }}
    />
  );
}

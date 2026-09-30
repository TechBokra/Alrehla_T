import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { FamilyClient } from './FamilyClient';
import { fetchFamilyMembers } from '@/app/actions/family';
import { isAdminApiConfigured } from '@/lib/supabase/admin';

export default async function FamilyManagementPage() {
  const familyMembers = await fetchFamilyMembers();
  // فتح الحسابات محتاج مفتاح الخدمة على الخادم. لو ناقص، الأزرار
  // بتتعطّل برسالة واضحة بدل ما تقع بخطأ وقت الضغط.
  const accountsEnabled = isAdminApiConfigured();

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="أفراد العائلة" />
      <p className="mt-2 text-slate-500 font-medium">أضف أطفالك لإدارة حجوزاتهم وتخصيص منتجاتهم بسهولة.</p>
      
      <FamilyClient initialMembers={familyMembers} accountsEnabled={accountsEnabled} />

      {/* Helper Card */}
      <div className="mt-8 rounded-2xl bg-amber-50 p-6 border border-amber-100">
        <h4 className="font-bold text-amber-800 mb-2">كيف تعمل مسارات الأعمار؟</h4>
        <p className="text-sm font-medium text-amber-700/80 leading-relaxed">
          <strong>دون 12 عاماً:</strong> تحجز أنت نيابةً عنهم، وتقدر تفتح لكل واحد
          حساب دخول خاص بيه من عمود «حساب الدخول». الحساب ده يشوف جلساته ومواده
          ويكتب في معرض أعماله — <strong>ومايشوفش أي بيانات دفع ولا يقدر يشتري</strong>.
          <br />
          <strong>12 عاماً فأكثر:</strong> يقدر يسجّل حسابًا مستقلًا بنفسه بالبريد
          الإلكتروني.
          <br />
          <br />
          كلمة السر بتظهر <strong>مرة واحدة</strong> وقت فتح الحساب — اكتبها. ولو
          اتنسيت، اضغط «كلمة سر جديدة» وهتطلع واحدة بدلها؛ مفيش «نسيت كلمة السر»
          للطفل لأن اسم الدخول داخلي ومايستقبلش رسائل.
        </p>
      </div>
    </div>
  );
}

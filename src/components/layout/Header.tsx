import Link from 'next/link';
import Image from 'next/image';
import { Compass } from 'lucide-react';
import React from 'react';
import { CartHeaderButton } from '@/components/cart/CartHeaderButton';
import { HeaderAccount } from '@/components/layout/HeaderAccount';
import { NavLinks, NavLinksMobile } from '@/components/layout/NavLinks';
import { NavCollapseOnScroll } from '@/components/layout/NavCollapseOnScroll';
import { getSiteSettings } from '@/data/domains/content';
import { slotImageUrl } from '@/lib/cloudinary';

/**
 * الهيدر.
 *
 * كان بيقرا المستخدم من الكوكيز على الخادم، وده كان بيخلي **كل صفحة في
 * الموقع** ديناميكية — تتبني من الصفر مع كل زيارة، بلا تخزين مؤقت، حتى
 * صفحة الشروط والأحكام اللي محتواها واحد للجميع.
 *
 * دلوقتي الهيدر ما بيعرفش مين داخل. الشعار والقائمة بيتبنوا ثابتين،
 * و`HeaderAccount` (مكوّن متصفح) بيسأل عن حالة المستخدم بعد ما الصفحة
 * تظهر.
 *
 * ⚠️ ده تغيير **عرض** مش أمان: حماية الصفحات في `middleware.ts` وفي
 * صلاحيات قاعدة البيانات، ومش متأثرة بده إطلاقًا.
 *
 * إعدادات الموقع بتُقرأ بعميل بلا كوكيز (`createPublicClient`) — لو رجعت
 * للعميل العادي، كل المكسب ده بيضيع.
 */
export default async function Header() {
  const settings = await getSiteSettings();
  const logo = settings.images.logo;

  return (
    // `pointer-events-none` على الغلاف: ارتفاعه ثابت (حتى والصفّ مطوي —
    // شوف `.nav-collapsible`)، فالجزء الفاضي منه مايمسكش الضغطات اللي
    // على المحتوى تحته. الهيدر والصفّ بيرجّعوها لنفسهم.
    <div className="pointer-events-none sticky top-0 z-[100] w-full px-4 pt-6 md:px-8">
      <header className="pointer-events-auto mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full border border-white/60 bg-white/70 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all md:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex min-h-[44px] items-center gap-2 text-2xl font-black tracking-tighter text-amber-800 transition-colors hover:text-amber-900 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {/* ⚠️ لون الاسم كان `amber-500` على خلفية فاتحة = 2.1:1 (المطلوب
                4.5) — بقى `amber-800`. بيظهر بس لو مفيش شعار مرفوع؛ الشعار
                المرفوع حاليًّا كحلي وتباينه سليم (اتقاس من الصورة نفسها).
                الشعار يُرفع من: لوحة الإدارة ← صور الموقع ← شعار الموقع.
                لحد ما يُرفع، البوصلة والاسم يفضلوا زي ما هم. */}
            {logo ? (
              <Image
                src={slotImageUrl(logo, 'logo')}
                alt="الرحلة"
                width={160}
                height={40}
                priority
                className="h-9 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <>
                <Compass className="h-6 w-6" />
                <span>الرحلة</span>
              </>
            )}
          </Link>

          <NavLinks />
        </div>

        <div className="flex items-center gap-3">
          <CartHeaderButton />
          <HeaderAccount />
        </div>
      </header>

      {/* القائمة كانت مخفية تمامًا تحت 1024 بكسل، ومفيش زرار يفتحها —
          الزائر على التليفون مكانش يقدر يتنقّل بين الأقسام من الهيدر.

          ⚠️ والصفّ ده بيتطوى وإنت نازل ويرجع وإنت طالع: كان بيعمل
             طبقة رابعة قبل أول كلمة محتوى على الشاشات الضيّقة.
             التنسيق في `globals.css` تحت `.nav-collapsible`،
             والمراقب مكوّن عميل صغير مابيرسمش حاجة — فالهيدر
             بيفضل **مكوّن خادم** زي ما هو. */}
      <div className="nav-collapsible pointer-events-auto">
        <NavLinksMobile />
      </div>
      <NavCollapseOnScroll />
    </div>
  );
}

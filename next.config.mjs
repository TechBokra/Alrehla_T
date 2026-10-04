/**
 * سياسة مصادر المحتوى (CSP) — **بتتبعت للتسجيل بس، مش للتنفيذ.**
 *
 * ⚠️ ليه Report-Only ولا تنفيذ مباشر:
 *
 * CSP متشدّدة بتكسر الموقع كله فورًا لو نسيت مصدرًا واحدًا — صورة ما
 * تظهرش، أو الاتصال بـSupabase يترفض، فالموقع يبقى شاشة فاضية. والمشروع
 * ده **بينشر من الـPush مباشرة على الإنتاج بلا بيئة معاينة**، يعني
 * الكسر ده هيحصل على عيون العملاء، مش في مكان آمن.
 *
 * فالخطة خطوتين:
 *   1. دلوقتي: المتصفح **بيبلّغ** عن أي مخالفة في console ومبيمنعش حاجة
 *   2. لما تشوف الconsole نضيف على كل الصفحات، نحوّل الاسم لـ
 *      `Content-Security-Policy` من غير `-Report-Only` وتبقى نافذة
 *
 * باقي الرؤوس تحت **نافذة من دلوقتي** — دي مالهاش أي احتمال كسر.
 */
const contentSecurityPolicy = [
  "default-src 'self'",

  // Next بيحقن سكربتات inline للترطيب (hydration) من غير nonce، فـ
  // 'unsafe-inline' مطلوبة. و'unsafe-eval' للتطوير بس.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

  // Tailwind وNext بيكتبوا styles inline.
  "style-src 'self' 'unsafe-inline'",

  // الخطوط self-hosted: `next/font/google` بينزّل Cairo وقت البناء
  // ويقدّمها من نفس الدومين، فمفيش اتصال بجوجل وقت التشغيل.
  "font-src 'self' data:",

  // مصادر الصور — نفس اللي في `images.remotePatterns` تحت، زائد
  // data: و blob: لمعاينة الصورة قبل رفعها.
  // و`api.cloudinary.com`: صور الأطفال الخاصة بتتعرض للإدارة من رابط
  // `download` المؤقت (`@/lib/cloudinary-private`).
  "img-src 'self' data: blob: https://res.cloudinary.com https://api.cloudinary.com https://ui-avatars.com https://picsum.photos",

  // Supabase (REST + realtime عبر websocket) ورفع Cloudinary المباشر.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com",

  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  // يمنع المتصفح من «تخمين» نوع الملف. من غيره ملف مرفوع من عميل ممكن
  // المتصفح يقرره سكربت وينفّذه.
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // المواقع الخارجية تشوف الدومين بس، مش المسار الكامل. مهم عندنا:
  // روابط زي /account/orders/<id> فيها معرّفات ما تخرجش للخارج.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // المتصفح يستخدم HTTPS دايمًا لسنتين جايين، حتى لو حد كتب http.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },

  // الموقع مش محتاج كاميرا ولا ميكروفون ولا موقع جغرافي — نقفلهم صراحةً
  // عشان أي سكربت طرف تالت ما يقدرش يطلبهم.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },

  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
];

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },

  /**
   * رؤوس الحماية — بتتبعت مع **كل** صفحة وكل طلب.
   *
   * كانت غايبة تمامًا: الموقع كان بيتبعت بلا أي رأس حماية، فمحدش مانع
   * موقع تاني يحطه في iframe، ولا مانع المتصفح يخمّن نوع ملف مرفوع.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  /**
   * الصور الخارجية.
   *
   * Next.js بيرفض عرض أي صورة من نطاق مش مكتوب هنا — إجراء أمني عشان محدش
   * يستخدم خادم الموقع كوسيط لتحميل صور من أي مكان.
   *
   * الملف ده كان فيه `picsum.photos` وبس (أيام الصور العشوائية). لما بقينا
   * نرفع على Cloudinary، الصورة كانت بتترفع وبتتحفظ في قاعدة البيانات
   * بنجاح — وبعدين Next.js يرفض يعرضها، فتظهر مكسورة.
   */
  images: {
    remotePatterns: [
      {
        // صور الموقع والمنتجات والصور الشخصية وأغلفة المقالات.
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        // الحرف الأول من اسم المدرب لما ما يكونش رافع صورة شخصية.
        protocol: 'https',
        hostname: 'ui-avatars.com',
        port: '',
        pathname: '/**',
      },
      {
        // بيانات تجريبية للتطوير المحلي فقط — مش مستخدمة على الموقع.
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

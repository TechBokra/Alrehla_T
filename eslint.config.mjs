import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  // `eslint .` (بدل `next lint` اللي Next وقّفه): ملفات البناء والمكتبات برّه الفحص.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts']),
  ...nextVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',

      // Next 16 adds React Compiler diagnostics to the recommended preset.
      // Keep existing initialization/time-based rendering visible for follow-up
      // without changing application behavior during the framework migration.
      // The compiler is not enabled; rules-of-hooks remains an error.
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',

      // ⚠️ **الحارس ده اتحط بعد عطل حقيقي على الإنتاج.**
      //
      // `saveProduct` كانت فيها `metadata: { name }` **ومافيش
      // متغيّر اسمه `name`**. TypeScript قبلها لأن `lib.dom` بتعرّف
      // `declare const name: void` (خاصية `window.name` القديمة).
      // وعلى الخادم — نود مش متصفح — بترمي `ReferenceError` **بعد
      // ما القاعدة تحفظ**: البيانات بتتغيّر والشاشة بتقول «حدث خطأ
      // غير متوقع».
      //
      // الأسماء دي كلها عامة في المتصفح ومش موجودة على الخادم،
      // فالمترجم بيسكت عنها وهي بتوقع وقت التشغيل.
      'no-restricted-globals': [
        'error',
        { name: 'name', message: 'اكتب متغيّرًا صريحًا — `name` عامّ في المتصفح ومش موجود على الخادم' },
        { name: 'status', message: 'اكتب متغيّرًا صريحًا — `status` عامّ في المتصفح' },
        { name: 'length', message: 'اكتب متغيّرًا صريحًا — `length` عامّ في المتصفح' },
        { name: 'origin', message: 'اكتب متغيّرًا صريحًا — `origin` عامّ في المتصفح' },
        { name: 'event', message: 'اكتب متغيّرًا صريحًا — `event` عامّ في المتصفح' },
        { name: 'top', message: 'اكتب متغيّرًا صريحًا — `top` عامّ في المتصفح' },
        { name: 'self', message: 'اكتب متغيّرًا صريحًا — `self` عامّ في المتصفح' },
        { name: 'parent', message: 'اكتب متغيّرًا صريحًا — `parent` عامّ في المتصفح' },
        { name: 'closed', message: 'اكتب متغيّرًا صريحًا — `closed` عامّ في المتصفح' },
        { name: 'external', message: 'اكتب متغيّرًا صريحًا — `external` عامّ في المتصفح' },
      ],
    },
  },
]);

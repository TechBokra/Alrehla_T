import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',

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
];

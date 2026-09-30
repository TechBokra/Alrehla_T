-- ============================================================
-- 128 — تشخيص: إيه الناقص في بيانات المكتبة
-- ============================================================
--
-- ⚠️ **الملف ده مابيغيّرش حاجة. بيقرا وبيطبع.**
--
-- ── ليه اتكتب ───────────────────────────────────────────────
--
-- كارت المكتبة بقى بيعرض **اسم الناشر** و**تفاصيل الكتاب**
-- (`features`). اتأكّدت من الكود على المنشور — وطلع الاتنين
-- **مش بيبانوا**، لا لأن الكود غلط، لكن لأن **الخانات فاضية في
-- القاعدة**:
--
--   • فلتر «دار النشر» في صفحة المكتبة **مش ظاهر أصلًا** — والشرط
--     اللي بيظهّره إن يكون فيه ناشر له كتاب واحد على الأقل. يعني
--     **ولا كتاب في المكتبة متربط بناشر**.
--   • ومافيش ولا شريحة تفاصيل على أي كارت.
--
-- ⚠️ **والفرق ده مهم**: لو قلت «الميزة اتعملت» وإنت بتفتح الصفحة
--    ومش شايف حاجة، تفتكر إني كدبت. الميزة اتعملت، **والمحتوى
--    ناقص** — والملف ده بيطلع القايمة بالظبط عشان الفريق يملاها.
--
-- ── وحاجة تانية العين مسكتها ────────────────────────────────
--
-- وصف أحد الكتب على المنشور مكتوب: «مغانرات ف اعماق البحار».
-- فيها غلطتان إملائيتان («مغامرات» و«في») — والوصف ده **معروض
-- للعميل** في شبكة المكتبة.
-- ============================================================

SELECT البند, التفاصيل, الحالة FROM (

  -- ══ ① كتب المكتبة وحالة بياناتها ══════════════════════
  SELECT
    ('كتاب: ' || p.name)::text AS البند,
    (
      'الناشر: ' ||
        CASE WHEN p.publisher_id IS NULL THEN '🔴 مفيش'
             ELSE COALESCE((SELECT pub.name FROM public.publishers pub
                             WHERE pub.id = p.publisher_id), '🔴 رقم مش موجود')
        END
      || '  ·  التفاصيل: ' ||
        CASE WHEN p.features IS NULL OR array_length(p.features, 1) IS NULL
             THEN '🔴 فاضية'
             ELSE array_length(p.features, 1)::text || ' بند' END
      || '  ·  الوصف: ' ||
        CASE WHEN p.short_description IS NULL OR btrim(p.short_description) = ''
             THEN '🔴 فاضي'
             ELSE '«' || left(p.short_description, 40) || '»' END
      || '  ·  الرابط: ' ||
        -- ⚠️ الرابط بشكل `prod-<رقم>` معناه إنه اتولّد تلقائيًّا
        --    قبل ما نصلّح التوليد — وبيظهر للعميل في شريط العنوان
        --    وفي أي رابط بيتبعت على واتساب.
        CASE WHEN p.slug ~ '^prod-[0-9]+$' THEN '🔴 رقم تلقائي' ELSE '✅' END
    )::text AS التفاصيل,
    CASE
      WHEN p.publisher_id IS NULL
        OR p.features IS NULL OR array_length(p.features, 1) IS NULL
      THEN '🔴 ناقص'
      ELSE '✅ كامل'
    END AS الحالة
  FROM public.personalized_products p
  WHERE p.category = 'library'

  UNION ALL

  -- ══ ② دور النشر الموجودة ══════════════════════════════
  --    عشان الفريق يعرف يربط الكتب بمين.
  SELECT
    ('ناشر: ' || pub.name),
    ('رقمه: ' || pub.id || '  ·  كتبه في المكتبة: ' ||
      (SELECT count(*)::text FROM public.personalized_products p2
        WHERE p2.publisher_id = pub.id AND p2.category = 'library')),
    '⬅️ متاح للربط'
  FROM public.publishers pub

  UNION ALL

  -- ══ ③ الخلاصة ═════════════════════════════════════════
  SELECT
    'الخلاصة',
    (
      (SELECT count(*)::text FROM public.personalized_products
        WHERE category='library' AND publisher_id IS NULL)
      || ' كتاب بلا ناشر · '
      || (SELECT count(*)::text FROM public.personalized_products
           WHERE category='library'
             AND (features IS NULL OR array_length(features,1) IS NULL))
      || ' كتاب بلا تفاصيل'
    ),
    '⬅️ ده اللي بيمنع الكارت من عرضهم'

) t ORDER BY البند;

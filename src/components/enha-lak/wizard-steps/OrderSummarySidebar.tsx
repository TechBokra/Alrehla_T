'use client';
import { formatPrice } from '@/lib/utils';

import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { AddonProduct, ChildProfile, PersonalizedProduct } from '@/types';
import Image from 'next/image';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { PersonAvatar } from '@/components/ui/PersonAvatar';
import { fetchFamilyMembers } from '@/app/actions/family';
import {
  addonsDisplayTotal,
  customizedAddonIdsFor,
  basePriceForFormat,
  electronicAvailable,
  FORMAT_LABELS,
  isItemFormat,
  type ItemFormat,
} from '@/lib/item-format';

export function OrderSummarySidebar({
  product,
  addons = [],
  addonDiscountPercent = 0,
  subscriptionMonths,
}: {
  product: PersonalizedProduct;
  /** نفس قايمة الإضافات اللي الخطوة ٣ بتعرضها — عشان الإجمالي يبقى حقيقي. */
  addons?: AddonProduct[];
  /** خصم المشترك (ملف 140) — نفس حساب القاعدة. */
  addonDiscountPercent?: number;
  /** اشتراك الصندوق: الشحن × الشهور بيتحسب في الدفع. */
  subscriptionMonths?: number;
}) {
  const { watch } = useFormContext();
  const selectedAddonIds: string[] = watch('selectedAddonIds') || [];
  const facePhotoFile = watch('facePhotoFile');
  const familyMemberId = watch('familyMemberId');
  const newChildName = watch('newChildName');
  
  const [facePhotoPreviewUrl, setFacePhotoPreviewUrl] = useState<string | null>(null);

  /**
   * أفراد العائلة — عشان صورة الطفل المختار تبان في الملخّص قبل ما
   * العميل يرفع صورة الوش.
   *
   * ⚠️ الصورتان مختلفتان عن قصد: **صورة الملف** هي صورة الطفل
   *    المحفوظة في المركز العائلي، و**صورة الوش** هي اللي الكتاب
   *    بيتبني عليها وبترتفع مع كل طلب. الأولى بتبان لحد ما التانية
   *    تترفع، وبعدين التانية ليها الأولوية — لأنها هي اللي هتطبع.
   */
  const [members, setMembers] = useState<ChildProfile[]>([]);
  useEffect(() => {
    fetchFamilyMembers().then(setMembers).catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    if (!facePhotoFile) {
      setFacePhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(facePhotoFile);
    setFacePhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [facePhotoFile]);
  
  const selectedMember = members.find((m) => m.id === familyMemberId) ?? null;
  // اسم الطفل الحقيقي بدل «مشارك من العائلة» — كان نصًا ثابتًا.
  const childName = newChildName || selectedMember?.fullName
    || (familyMemberId ? 'مشارك من العائلة' : null);

  // ⚠️ العرض هنا **تقدير**: الحساب الحقيقي بيتم في
  //    `create_customer_order` من أسعار الجدول. المتصفح مبيبعتش سعرًا.
  //
  //    وقبل كده كان `addonsTotal = 0` ثابتًا — يعني العميل كان بيشوف
  //    إجماليًا من غير الإضافات ويدفع إجماليًا بيها.
  const chosenAddons = addons.filter((a) => selectedAddonIds.includes(a.id));
  // ملف 07: التخصيص بيتحدد من الإضافة نفسها، مش من اختيار العميل.
  const customizedAddonIds = customizedAddonIdsFor(addons, selectedAddonIds);
  const addonsTotal = addonsDisplayTotal(
    chosenAddons,
    selectedAddonIds,
    customizedAddonIds,
    addonDiscountPercent,
  );
  // النوع (ملف 138): «أنت البطل» اللي ليها إلكتروني بس — غير كده مطبوعة.
  const watchedFormat = watch('format');
  const format: ItemFormat =
    electronicAvailable(product) && isItemFormat(watchedFormat) ? watchedFormat : 'printed';
  const base = basePriceForFormat(product, format);
  const total = base + addonsTotal;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
      <h3 className="text-xl font-black text-slate-800 mb-6">ملخص الطلب</h3>
      
      <div className="flex gap-4 mb-6 pb-6 border-b border-slate-100">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {product.coverImageUrl ? (
            <Image src={optimizedImageUrl(product.coverImageUrl, 400)} alt={product.name} fill sizes="96px" className="object-cover" referrerPolicy="no-referrer" />
          ) : null}
        </div>
        <div>
          <h4 className="font-bold text-slate-800">{product.name}</h4>
          <p className="text-sm text-slate-600 mt-1">{formatPrice(base)}</p>
          {format !== 'printed' && (
            <p className="mt-1 text-xs font-bold text-emerald-800">{FORMAT_LABELS[format]}</p>
          )}
        </div>
      </div>

      {childName && (
        <div className="mb-6 pb-6 border-b border-slate-100">
          <h4 className="font-bold text-slate-700 text-sm mb-2">الطفل:</h4>
          <div className="flex items-center gap-3">
            {facePhotoPreviewUrl ? (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                <Image
                  src={facePhotoPreviewUrl}
                  alt="صورة وجه الطفل للطلب"
                  fill
                  sizes="96px"
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <PersonAvatar
                name={childName}
                avatarUrl={selectedMember?.avatarUrl}
                size={40}
              />
            )}
            <span className="font-bold text-slate-800">{childName}</span>
          </div>
        </div>
      )}

      {chosenAddons.length > 0 && (
        <div className="mb-6 pb-6 border-b border-slate-100">
          <h4 className="font-bold text-slate-700 text-sm mb-2">
            الإضافات ({chosenAddons.length}):
          </h4>
          <ul className="space-y-1.5">
            {chosenAddons.map((addon) => {
              const customized = customizedAddonIds.includes(addon.id);
              return (
                <li key={addon.id} className="flex justify-between gap-3 text-sm text-slate-600">
                  <span>
                    {addon.name}
                    {customized && (
                      <span className="text-emerald-700 font-bold"> · باسم الطفل وصورته</span>
                    )}
                  </span>
                  <span className="shrink-0">
                    +{formatPrice(addon.price + (customized ? addon.customizationPrice : 0))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex justify-between items-center text-lg font-black text-slate-800 mt-4">
        <span>الإجمالي:</span>
        <span className="text-rose-500">{formatPrice(total)}</span>
      </div>
      {addonDiscountPercent > 0 && chosenAddons.length > 0 && (
        <p className="mt-2 text-xs font-bold text-emerald-800">
          شامل خصم المشترك {addonDiscountPercent.toLocaleString('ar-EG')}٪ على الإضافات
        </p>
      )}
      {subscriptionMonths && (
        <p className="mt-2 text-xs text-slate-600">
          + الشحن: سعر منطقتك × {subscriptionMonths.toLocaleString('ar-EG')} شهور — بيتحسب في الدفع
        </p>
      )}
    </div>
  );
}

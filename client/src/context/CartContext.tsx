'use client';
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { ItemFormat } from '@/lib/item-format';
import {
  CART_CLEAR_EVENT,
  CART_STORAGE_KEY,
  parseStoredCart,
  serializeCart,
} from '@/lib/cart-storage';

export type CartItem = {
  /** رقم سطر العربة — بيفرّق بين نسختين متخصصتين من نفس المنتج. */
  id: string;
  /**
   * رقم المنتج الحقيقي في قاعدة البيانات.
   *
   * كان الطلب بيتخزّن برقم السطر المركّب (رقم المنتج + التوقيت)، فعناصر
   * الطلبات ما كانتش موصولة بالمنتجات، والخادم ما كانش يقدر يجيب السعر
   * الصح. الرقم ده هو اللي بيتبعت للخادم.
   */
  productId: string;
  /**
   * اسم المنتج في الرابط — عشان زرار «تعديل» في السلة يرجّع العميل
   * لنفس شاشة التخصيص. البنود المحفوظة في المتصفح قبل الخانة دي
   * مالهاش، وزرار التعديل بيختفي عنها بدل ما يوديه لرابط مكسور.
   */
  productSlug?: string;
  name: string;
  price: number;
  /**
   * السعر **قبل العرض وخصم المشترك** — للعرض بس، عشان «وفّرت كذا»
   * يبان في الدفع.
   *
   * ⚠️ اختياري عن قصد: السلال المحفوظة في المتصفح قبل الخانة دي
   *    مالهاش، والتوفير ساعتها بيتحسب صفرًا بدل ما يطلع بالسالب.
   *    وبيتحط بس لما يكون فعلًا أكبر من `price`.
   */
  listPrice?: number;
  quantity: number;
  imageUrl?: string;
  type: 'book' | 'custom' | 'subscription' | 'package';
  /** أرقام الإضافات المختارة — السعر بيتحسب في القاعدة، مش هنا. */
  addonIds?: string[];
  /** الإضافات اللي اتطلبت بتخصيص — مجموعة فرعية من `addonIds`. */
  customizedAddonIds?: string[];
  /**
   * فيه إضافة مختارة بتتشحن؟ (قرار تامر، ٢٣ أكتوبر — الإضافات بقى
   * ليها نوع: مطبوعة / إلكترونية / الاتنين).
   *
   * ⚠️ **للعرض بس.** القاعدة بتحسب الشحن تاني من
   *    `addon_products.delivery_format` وقت تسجيل الطلب — زيّ
   *    الأسعار بالظبط. والغايب = «آه» (السلال القديمة، والسلوك
   *    اللي كان).
   */
  addonsNeedShipping?: boolean;
  customizationData?: any;
  /**
   * مطبوعة / إلكترونية / الاتنين (ملف 138). فاضي = مطبوعة — السلال
   * القديمة المحفوظة في المتصفح مالهاش الخانة دي.
   */
  format?: ItemFormat;
  /**
   * اشتراك صندوق الرحلة (ملف 140): رقم الخطة وعدد شهورها. البند ده
   * بيتطلب **لوحده** بدالة تانية (`create_box_subscription_order`).
   */
  boxPlanId?: string;
  boxMonths?: number;
};

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  /** يستبدل بند موجود ببند معدّل — بيحافظ على ترتيبه في السلة. */
  replaceItem: (id: string, item: CartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  /** Emptying the cart after an order. The checkout used to carry the comment
   *  "In real app, clearCart() would be here" — so every completed order left
   *  its items in the cart, ready to be ordered again. */
  clearCart: () => void;
  /** يشيل بنود بعينها مرة واحدة — بعد دفع طلب اتسجّل منها. */
  removeItems: (ids: string[]) => void;
  /**
   * السلة اتقرت من المتصفح؟
   *
   * ⚠️ **أي حاجة بتعدّل السلة أول ما الصفحة تفتح لازم تستنى ده.**
   *    مكوّنات الصفحة بتشتغل **قبل** ما السلة تتقري (React بيشغّل
   *    تأثيرات الأبناء قبل الأب). فتفضية السلة في صفحة «شكرًا» كانت
   *    بتحصل على سلة لسه فاضية، وبعدها السلة تتقري وترجع كاملة —
   *    وده بالظبط اللي حصل مع طلب ALR-000068-QB (٢٤ أكتوبر).
   */
  ready: boolean;
  itemCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // ══ الحفظ في المتصفح — التفصيل والتنازل في `lib/cart-storage.ts` ══
  //
  // ⚠️ **القراءة بعد أول رسم لا قبله**: الخادم بيرسم السلة فاضية
  //    (مفيش تخزين على الخادم)، ولو المتصفح رسمها مليانة من أول لحظة
  //    React بيشتكي من عدم التطابق. فبتبدأ فاضية وتتملى فورًا.
  //
  // ⚠️ **و`loaded` قبل أي حفظ**: من غيره، أول رسم بالسلة الفاضية كان
  //    هيتحفظ **فوق** السلة المحفوظة قبل ما تتقري — فتضيع في نفس
  //    اللحظة اللي المفروض تتحمّل فيها.
  const loaded = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      // السلال القديمة المحفوظة ممكن يكون فيها كمية ٢ أو أكتر — بترجع ١.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- السلة محفوظة في المتصفح؛ لازم تتقري بعد أول رسم عشان ماتختلفش عن نسخة الخادم.
      setItems(
        parseStoredCart<CartItem>(window.localStorage.getItem(CART_STORAGE_KEY), Date.now()).map((i) => ({
          ...i,
          quantity: 1,
        })),
      );
    } catch {
      // التخزين مقفول (تصفّح خاص) — السلة تشتغل في الذاكرة زي الأول.
    }
    loaded.current = true;
    setReady(true);

    const clear = () => setItems([]);
    window.addEventListener(CART_CLEAR_EVENT, clear);
    return () => window.removeEventListener(CART_CLEAR_EVENT, clear);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (items.length === 0) window.localStorage.removeItem(CART_STORAGE_KEY);
      else window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(items, Date.now()));
    } catch {
      // مساحة التخزين خلصت أو مقفول — السلة في الذاكرة لسه شغّالة.
    }
  }, [items]);

  // ⚠️ **كل بند في «إنها لك» نسخة واحدة** (قرار تامر): القصة والكتاب
  //    دايمًا متخصصين لطفل بعينه، فمفيش معنى لـ«٢ من نفس القصة». نسخة
  //    لطفل تاني = تخصيص جديد = بند جديد. كانت الضغطة التانية على «أضف
  //    للسلة» بتخلّي الكمية ٢، وفي الدفع كان فيه عدّاد +/−.
  const addItem = (item: CartItem) => {
    setItems((prev) =>
      prev.some(i => i.id === item.id) ? prev : [...prev, { ...item, quantity: 1 }],
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter(i => i.id !== id));
  };

  /** الكمية دايمًا ١ — أي رقم أقل من ١ = حذف البند. */
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) removeItem(id);
  };

  /**
   * ⚠️ الاستبدال في مكانه، مش حذف وإضافة: العميل اللي بيعدّل بند
   *    مايلاقيهوش نط لآخر السلة ويفتكر إنه اتضاف مرتين.
   */
  const replaceItem = (id: string, item: CartItem) => {
    setItems((prev) => {
      const index = prev.findIndex((i) => i.id === id);
      if (index === -1) return [...prev, item];
      const next = [...prev];
      next[index] = item;
      return next;
    });
  };

  const clearCart = () => setItems([]);

  const removeItems = (ids: string[]) => {
    if (ids.length === 0) return;
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
  };

  const itemCount = items.length;
  const cartTotal = items.reduce((acc, i) => acc + i.price, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, replaceItem, updateQuantity, clearCart, removeItems, ready, itemCount, cartTotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

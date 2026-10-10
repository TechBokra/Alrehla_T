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
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  type: 'book' | 'custom' | 'subscription' | 'package';
  /** أرقام الإضافات المختارة — السعر بيتحسب في القاعدة، مش هنا. */
  addonIds?: string[];
  /** الإضافات اللي اتطلبت بتخصيص — مجموعة فرعية من `addonIds`. */
  customizedAddonIds?: string[];
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
  updateQuantity: (id: string, quantity: number) => void;
  /** Emptying the cart after an order. The checkout used to carry the comment
   *  "In real app, clearCart() would be here" — so every completed order left
   *  its items in the cart, ready to be ordered again. */
  clearCart: () => void;
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

  const clearCart = () => setItems([]);

  const itemCount = items.length;
  const cartTotal = items.reduce((acc, i) => acc + i.price, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, itemCount, cartTotal }}
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

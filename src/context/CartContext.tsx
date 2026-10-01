'use client';
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { isQuantityLocked, type ItemFormat } from '@/lib/item-format';
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
      setItems(parseStoredCart<CartItem>(window.localStorage.getItem(CART_STORAGE_KEY), Date.now()));
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

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    // ⚠️ الإلكتروني ملف واحد: القاعدة بتحسبه كمية ١ مهما اتبعت، فلو
    //    الشاشة سمحت بـ٣ كان العميل هيشوف ٣ أضعاف ويدفع واحد.
    setItems((prev) =>
      prev.map(i => i.id === id ? { ...i, quantity: isQuantityLocked(i.format) ? 1 : quantity } : i),
    );
  };

  const clearCart = () => setItems([]);

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const cartTotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);

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

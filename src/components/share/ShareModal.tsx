'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Share2,
  Copy,
  Check,
  MessageCircle,
  Twitter,
  Facebook,
  Send,
  X,
  Link2,
  ExternalLink,
} from 'lucide-react';
import {
  ShareData,
  resolveShareUrls,
  getWhatsAppShareUrl,
  getTwitterShareUrl,
  getFacebookShareUrl,
  getTelegramShareUrl,
  copyToClipboard,
} from '@/lib/share-utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShareData;
  theme?: 'amber' | 'rose' | 'emerald' | 'brand';
}

export function ShareModal({ isOpen, onClose, data, theme = 'brand' }: ShareModalProps) {
  const [copiedShort, setCopiedShort] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const { fullUrl, shortUrl } = resolveShareUrls(data);
  // نفضل الرابط المختصر للمشاركة
  const shareTargetUrl = shortUrl || fullUrl;

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true);
    }
  }, []);

  // إغلاق النافذة عند الضغط على زر ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleCopyShortLink = async () => {
    const success = await copyToClipboard(shareTargetUrl);
    if (success) {
      setCopiedShort(true);
      setTimeout(() => setCopiedShort(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: data.title,
        text: data.description || data.title,
        url: shareTargetUrl,
      });
    } catch {
      // User cancelled or share failed silently
    }
  };

  const whatsAppUrl = getWhatsAppShareUrl(data.title, shareTargetUrl, data.description);
  const twitterUrl = getTwitterShareUrl(data.title, shareTargetUrl);
  const facebookUrl = getFacebookShareUrl(shareTargetUrl);
  const telegramUrl = getTelegramShareUrl(data.title, shareTargetUrl);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl z-10 border border-slate-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Share2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="share-modal-title" className="text-lg font-bold text-slate-900">
                    مشاركة
                  </h3>
                  <p className="text-xs font-medium text-slate-500 line-clamp-1 max-w-[240px]">
                    {data.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content & Options */}
            <div className="space-y-4">
              {/* WhatsApp Primary Button */}
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-full items-center justify-between rounded-2xl bg-[#25D366]/10 p-3.5 text-[#128C7E] hover:bg-[#25D366] hover:text-white transition-all duration-200 border border-[#25D366]/20 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm transition-transform group-hover:scale-105">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-sm">مشاركة عبر واتساب</span>
                    <span className="block text-xs opacity-80">إرسال مباشر إلى محادثاتك ومجموعاتك</span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 opacity-70 group-hover:opacity-100" />
              </a>

              {/* Short Link Box */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  الرابط المختصر
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-brand focus-within:bg-white transition-colors">
                  <div className="flex items-center gap-2 px-2.5 flex-1 min-w-0">
                    <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      readOnly
                      value={shareTargetUrl}
                      className="w-full bg-transparent text-base md:text-xs font-mono text-slate-700 outline-none select-all dir-ltr text-left"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyShortLink}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 shadow-sm ${
                      copiedShort
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {copiedShort ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>نسخ الرابط</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Other Social Networks */}
              <div>
                <span className="mb-2.5 block text-xs font-bold text-slate-600">
                  منصات أخرى
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Twitter / X */}
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 hover:border-slate-900 hover:bg-slate-50 hover:text-black transition-all"
                  >
                    <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                    <span className="text-xs font-bold">منصة X</span>
                  </a>

                  {/* Facebook */}
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 hover:border-blue-600 hover:bg-blue-50/50 hover:text-blue-600 transition-all"
                  >
                    <Facebook className="h-5 w-5 text-[#1877F2]" />
                    <span className="text-xs font-bold">فيسبوك</span>
                  </a>

                  {/* Telegram */}
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 hover:border-sky-500 hover:bg-sky-50/50 hover:text-sky-600 transition-all"
                  >
                    <Send className="h-5 w-5 text-[#229ED9]" />
                    <span className="text-xs font-bold">تيليجرام</span>
                  </a>
                </div>
              </div>

              {/* Native Share button (Mobile / Supported browsers) */}
              {canNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  <span>المزيد من خيارات المشاركة في هاتفك</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

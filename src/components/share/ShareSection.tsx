'use client';

import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  MessageCircle,
  Twitter,
  Facebook,
  Send,
  Link2,
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

interface ShareSectionProps {
  data: ShareData;
  title?: string;
  subtitle?: string;
  theme?: 'amber' | 'rose' | 'emerald' | 'brand';
  showShortLinkInput?: boolean;
  className?: string;
}

export function ShareSection({
  data,
  title = 'شارك المقال',
  subtitle = 'انشر الفائدة مع أصدقائك وزملائك عبر وسائل التواصل',
  theme = 'amber',
  showShortLinkInput = true,
  className = '',
}: ShareSectionProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const { fullUrl, shortUrl } = resolveShareUrls(data);
  const shareTargetUrl = shortUrl || fullUrl;

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- زرار المشاركة متاح في بعض المتصفحات بس، ومفيش طريقة نعرف ده على الخادم.
      setCanNativeShare(true);
    }
  }, []);

  const handleCopy = async () => {
    const success = await copyToClipboard(shareTargetUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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
      // User cancelled
    }
  };

  const whatsAppUrl = getWhatsAppShareUrl(data.title, shareTargetUrl, data.description);
  const twitterUrl = getTwitterShareUrl(data.title, shareTargetUrl);
  const facebookUrl = getFacebookShareUrl(shareTargetUrl);
  const telegramUrl = getTelegramShareUrl(data.title, shareTargetUrl);

  const themeBorderColors = {
    amber: 'border-amber-100 bg-amber-50/40',
    rose: 'border-rose-100 bg-rose-50/40',
    emerald: 'border-emerald-100 bg-emerald-50/40',
    brand: 'border-slate-200 bg-slate-50/60',
  }[theme];

  const themeIconBg = {
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    brand: 'bg-slate-200 text-slate-800',
  }[theme];

  return (
    <div
      className={`rounded-3xl border ${themeBorderColors} p-6 sm:p-8 transition-all ${className}`}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* Title & Info */}
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${themeIconBg}`}>
            <Share2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 sm:text-xl">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* WhatsApp Direct Share Button */}
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="مشاركة عبر واتساب"
            aria-label="مشاركة عبر واتساب"
            className="flex items-center gap-2 rounded-2xl bg-[#25D366] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#20ba59] hover:shadow-md transition-all active:scale-95"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>واتساب</span>
          </a>

          {/* Copy Link Button */}
          <button
            type="button"
            onClick={handleCopy}
            title="نسخ الرابط المختصر"
            aria-label="نسخ الرابط المختصر"
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 border ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 shrink-0 text-white" />
                <span>تم النسخ!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 shrink-0 text-slate-500" />
                <span>نسخ الرابط</span>
              </>
            )}
          </button>

          {/* Twitter / X */}
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="مشاركة على X (تويتر)"
            aria-label="مشاركة على X"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:border-slate-800 hover:bg-slate-900 hover:text-white transition-all shadow-xs"
          >
            <Twitter className="h-4 w-4" />
          </a>

          {/* Facebook */}
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="مشاركة على فيسبوك"
            aria-label="مشاركة على فيسبوك"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:border-blue-600 hover:bg-[#1877F2] hover:text-white transition-all shadow-xs"
          >
            <Facebook className="h-4 w-4" />
          </a>

          {/* Telegram */}
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="مشاركة على تيليجرام"
            aria-label="مشاركة على تيليجرام"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:border-sky-500 hover:bg-[#229ED9] hover:text-white transition-all shadow-xs"
          >
            <Send className="h-4 w-4" />
          </a>

          {/* Native Share on mobile */}
          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              title="المزيد من الخيارات"
              aria-label="المزيد من خيارات المشاركة"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-all shadow-xs"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Short Link Display Box */}
      {showShortLinkInput && (
        <div className="mt-5 pt-4 border-t border-slate-200/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-slate-400" />
              رابط المشاركة المختصر:
            </span>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 focus-within:border-slate-400 transition-colors max-w-md w-full sm:w-auto">
              <span className="text-xs font-mono text-slate-700 truncate select-all dir-ltr text-left flex-1">
                {shareTargetUrl}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-bold text-brand-strong hover:underline shrink-0"
              >
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { ShareData } from '@/lib/share-utils';
import { ShareModal } from './ShareModal';

interface ShareButtonProps {
  data: ShareData;
  label?: string;
  variant?: 'icon' | 'pill' | 'subtle';
  className?: string;
  theme?: 'amber' | 'rose' | 'emerald' | 'brand';
  size?: 'sm' | 'md' | 'lg';
}

export function ShareButton({
  data,
  label = 'مشاركة',
  variant = 'pill',
  className = '',
  theme = 'brand',
  size = 'md',
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    // منع انتشار الحدث لو كان الزرار داخل كارت رابط (Link)
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  };

  const sizeClasses = {
    sm: 'text-xs py-1.5 px-3 gap-1.5',
    md: 'text-sm py-2 px-3.5 gap-2',
    lg: 'text-base py-2.5 px-5 gap-2.5',
  }[size];

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[size];

  let buttonClasses = '';

  if (variant === 'icon') {
    buttonClasses =
      'flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-slate-700 shadow-sm border border-slate-200/80 hover:bg-white hover:text-brand-strong hover:scale-105 transition-all p-2';
  } else if (variant === 'subtle') {
    buttonClasses = `inline-flex items-center justify-center font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all ${sizeClasses}`;
  } else {
    // pill
    buttonClasses = `inline-flex items-center justify-center font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs hover:shadow-sm rounded-2xl transition-all ${sizeClasses}`;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`مشاركة ${data.title}`}
        className={`${buttonClasses} ${className}`}
      >
        <Share2 className={iconSizes} />
        {variant !== 'icon' && <span>{label}</span>}
      </button>

      <ShareModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        data={data}
        theme={theme}
      />
    </>
  );
}

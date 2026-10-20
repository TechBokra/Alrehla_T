import { cn } from '@/lib/utils';
import React from 'react';

interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  iconClassName?: string;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  subNav?: React.ReactNode;
  children?: React.ReactNode;
}

export function SectionHeader({
  title,
  description,
  badge,
  icon,
  iconClassName,
  className,
  titleClassName,
  descriptionClassName,
  subNav,
  children,
}: SectionHeaderProps) {
  return (
    <section
      className={cn('mx-auto max-w-4xl space-y-6 text-center', className)}
    >
      {badge && badge}
      {icon && (
        <div
          className={cn(
            'mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl',
            iconClassName
          )}
        >
          {icon}
        </div>
      )}
      <h1
        className={cn(
          'text-4xl leading-tight font-black text-slate-900 md:text-5xl',
          titleClassName
        )}
      >
        {title}
      </h1>

      {subNav && subNav}

      {description && (
        <p
          className={cn(
            'mx-auto max-w-2xl text-lg leading-relaxed font-medium text-slate-500 md:text-xl',
            descriptionClassName
          )}
        >
          {description}
        </p>
      )}

      {children}
    </section>
  );
}

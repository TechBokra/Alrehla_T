import React from 'react';
import { ImageIcon } from 'lucide-react';

/**
 * What is shown where an image has not been uploaded yet.
 *
 * The alternative used to be a random photograph from picsum.photos standing
 * in as the platform's own. An honest empty frame is better than somebody
 * else's photo of somebody else's child.
 */
export function ImagePlaceholder({ label }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-600">
      <ImageIcon className="h-8 w-8" />
      {label && <span className="px-4 text-center text-xs font-bold">{label}</span>}
    </div>
  );
}

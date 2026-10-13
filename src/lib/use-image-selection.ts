import { useEffect, useState } from 'react';
import { validateImageFile } from '@/lib/upload-client';

export function useImageSelection() {
  const [selection, setSelection] = useState<{ file: File; preview: string } | null>(null);
  useEffect(() => () => {
    if (selection) URL.revokeObjectURL(selection.preview);
  }, [selection]);
  const select = (file: File | null) => {
    if (file) validateImageFile(file);
    setSelection(file ? { file, preview: URL.createObjectURL(file) } : null);
  };
  return { selection, select };
}

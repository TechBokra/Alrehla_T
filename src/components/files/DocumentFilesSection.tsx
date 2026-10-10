import { getDocumentFiles } from '@/data/domains/private-files';
import { FILE_KINDS, WORKSPACE_FILE_MAX_MB } from '@/lib/private-files';
import { PrivateFilesPanel } from './PrivateFilesPanel';

/**
 * ملفات مستند في مساحة الكتابة (ملف 20).
 *
 *   • الكاتب: يرفع ملفه (Word/PDF/صورة) يبعته للمدرب مع النص.
 *   • المدرب: يرفع التصحيح.
 *   • ولي الأمر: يشوف ويحمّل بس.
 */
export async function DocumentFilesSection({
  document,
  viewer,
}: {
  document: { id: string; status: string; updatedAt?: string | null };
  viewer: 'writer' | 'instructor' | 'guardian';
}) {
  const { files, retentionDays } = await getDocumentFiles(document);
  if (viewer === 'guardian' && files.length === 0) return null;

  return (
    <PrivateFilesPanel
      owner={{ documentId: document.id }}
      files={files}
      rules={{ kinds: FILE_KINDS.map((k) => k.kind), maxMb: WORKSPACE_FILE_MAX_MB }}
      canUpload={viewer !== 'guardian'}
      retentionDays={retentionDays}
      closedLabel="مراجعة المدرب للنص"
      title="ملفات مرفقة"
      otherSideLabel={viewer === 'instructor' ? 'من الكاتب' : 'تصحيح المدرب'}
      emptyText={
        viewer === 'instructor'
          ? 'مفيش ملفات. تقدر ترفع النص مصحّح كملف يرجع للكاتب.'
          : 'عندك نص مكتوب في ملف Word أو PDF، أو صورة لكراستك؟ ارفعه هنا وابعته للمدرب مع النص.'
      }
    />
  );
}

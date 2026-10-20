import { getDocumentFiles } from '@/data/domains/(shared)/files/queries';
import { FILE_KINDS, WORKSPACE_FILE_MAX_MB } from '@/lib/private-files';
import { PrivateFilesPanel } from './PrivateFilesPanel';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { canManageWriterContent } from '@/lib/document-control';

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
  document: { id: string; studentId: string; status: string; updatedAt?: string | null };
  viewer: 'writer' | 'instructor' | 'guardian';
}) {
  // ولي الأمر يمسح ملفات ابنه الأصغر من ١٢ (قرار تامر).
  let manageAll = false;
  if (viewer === 'guardian') {
    const user = await getCurrentUser();
    manageAll = await canManageWriterContent(user.id, document.studentId);
  }
  const result = await getDocumentFiles(document, { manageAll });
  const files = result.success ? result.data.files : [];
  const retentionDays = result.success ? result.data.retentionDays : 30;
  if (viewer === 'guardian' && files.length === 0 && result.success) return null;

  return (
    <PrivateFilesPanel
      owner={{ documentId: document.id }}
      files={files}
      loadError={result.success ? null : result.error.message}
      rules={{ kinds: FILE_KINDS.map((k) => k.kind), maxMb: WORKSPACE_FILE_MAX_MB }}
      canUpload={viewer !== 'guardian' && ['draft', 'submitted'].includes(document.status) && result.success}
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

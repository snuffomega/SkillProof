import { readZip } from '@/domain/bundle';
import { isIgnoredPath, isTextPath, MAX_TEXT_FILE_BYTES, type ImportedFile } from '@/domain/importers';

/** Read files chosen via <input type="file"> (single files, folders via webkitdirectory, or ZIPs). */
export async function readSelectedFiles(list: FileList | File[]): Promise<{ files: ImportedFile[]; skipped: string[] }> {
  const files: ImportedFile[] = [];
  const skipped: string[] = [];
  for (const file of Array.from(list)) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    if (isIgnoredPath(path)) continue;
    if (/\.zip$/i.test(file.name)) {
      const z = await readZip(await file.arrayBuffer());
      files.push(...z.files);
      skipped.push(...z.skipped);
      continue;
    }
    if (!isTextPath(path) || file.size > MAX_TEXT_FILE_BYTES) {
      skipped.push(path);
      continue;
    }
    files.push({ path, content: await file.text() });
  }
  return { files, skipped };
}

import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { open, unlink } from 'fs/promises';
import { join } from 'path';

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');

const CV_TYPES: Record<string, string> = { 'application/pdf': '.pdf' };

const MATERIAL_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/zip': '.zip',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'video/mp4': '.mp4',
  'text/plain': '.txt',
};

function makeOptions(sub: 'cv' | 'materials', allowed: Record<string, string>, maxBytes: number) {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(UPLOAD_ROOT, sub);
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      // اسم عشوائي + امتداد من نوع الملف (لا نثق باسم الملف القادم من المستخدم)
      filename: (_req, file, cb) => cb(null, randomUUID() + allowed[file.mimetype]),
    }),
    fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
      if (!allowed[file.mimetype]) {
        return cb(new BadRequestException('نوع الملف غير مسموح'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: maxBytes, files: 1 },
  };
}

export const cvUploadOptions = makeOptions('cv', CV_TYPES, 5 * 1024 * 1024);
export const materialUploadOptions = makeOptions('materials', MATERIAL_TYPES, 50 * 1024 * 1024);

/** المسار النسبي الذي يُخزَّن في قاعدة البيانات */
export const relativePath = (sub: 'cv' | 'materials', file: Express.Multer.File) => `${sub}/${file.filename}`;
export const absolutePath = (rel: string) => join(UPLOAD_ROOT, rel);

export async function removeFile(rel?: string | null) {
  if (!rel) return;
  try {
    await unlink(absolutePath(rel));
  } catch {
    /* تجاهل */
  }
}

/** تحقق إضافي من أن الملف PDF فعلاً (الـ mimetype يأتي من العميل ويمكن تزويره) */
export async function assertPdf(rel: string) {
  const fh = await open(absolutePath(rel), 'r');
  try {
    const buf = Buffer.alloc(5);
    await fh.read(buf, 0, 5, 0);
    if (buf.toString('latin1') !== '%PDF-') {
      throw new BadRequestException('الملف ليس PDF صالحاً');
    }
  } finally {
    await fh.close();
  }
}

/** multer يقرأ أسماء الملفات كـ latin1، نصلحها لتدعم العربية */
export const fixFileName = (name: string) => Buffer.from(name, 'latin1').toString('utf8');

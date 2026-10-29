import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthUser } from '../common/decorators.js';
import { absolutePath, fixFileName, removeFile } from '../common/upload.js';

const MATERIAL_SELECT = {
  id: true, programId: true, title: true, originalName: true, mimeType: true, createdAt: true,
} as const;

const withUrl = <T extends { id: number; programId: number }>(m: T) => ({
  ...m,
  downloadUrl: `/programs/${m.programId}/materials/${m.id}/download`,
});

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- الصلاحيات ----------
  /** مشرف البرنامج فقط */
  private async assertOwner(programId: number, instructorId: number) {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: { instructorId: true } });
    if (!program) throw new NotFoundException('البرنامج غير موجود');
    if (program.instructorId !== instructorId) throw new ForbiddenException('هذا البرنامج ليس من برامجك');
  }

  /** الشاب المقبول (ACCEPTED) + مشرف البرنامج + الأدمن */
  private async assertCanRead(user: AuthUser, programId: number) {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: { instructorId: true } });
    if (!program) throw new NotFoundException('البرنامج غير موجود');
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.INSTRUCTOR) {
      if (program.instructorId !== user.id) throw new ForbiddenException('هذا البرنامج ليس من برامجك');
      return;
    }
    const app = await this.prisma.application.findUnique({
      where: { userId_programId: { userId: user.id, programId } },
      select: { status: true },
    });
    if (app?.status !== 'ACCEPTED') {
      throw new ForbiddenException('يجب أن يكون طلبك مقبولاً للوصول إلى المواد');
    }
  }

  // ---------- Create ----------
  async create(instructorId: number, programId: number, title: string, filePath: string, file: Express.Multer.File) {
    await this.assertOwner(programId, instructorId);
    const m = await this.prisma.programMaterial.create({
      data: { programId, title, filePath, originalName: fixFileName(file.originalname), mimeType: file.mimetype },
      select: MATERIAL_SELECT,
    });
    return withUrl(m);
  }

  // ---------- Read ----------
  async list(user: AuthUser, programId: number) {
    await this.assertCanRead(user, programId);
    const items = await this.prisma.programMaterial.findMany({
      where: { programId },
      orderBy: { createdAt: 'asc' },
      select: MATERIAL_SELECT,
    });
    return items.map(withUrl);
  }

  async findOne(user: AuthUser, programId: number, materialId: number) {
    await this.assertCanRead(user, programId);
    const m = await this.prisma.programMaterial.findFirst({
      where: { id: materialId, programId },
      select: MATERIAL_SELECT,
    });
    if (!m) throw new NotFoundException('المادة غير موجودة');
    return withUrl(m);
  }

  async getFile(user: AuthUser, programId: number, materialId: number) {
    await this.assertCanRead(user, programId);
    const m = await this.prisma.programMaterial.findFirst({ where: { id: materialId, programId } });
    if (!m) throw new NotFoundException('المادة غير موجودة');
    return { absPath: absolutePath(m.filePath), originalName: m.originalName, mimeType: m.mimeType };
  }

  // ---------- Update (عنوان و/أو استبدال الملف) ----------
  async update(
    instructorId: number,
    programId: number,
    materialId: number,
    title?: string,
    upload?: { filePath: string; file: Express.Multer.File },
  ) {
    if (title === undefined && !upload) throw new BadRequestException('أرسل title أو file على الأقل');
    await this.assertOwner(programId, instructorId);
    const old = await this.prisma.programMaterial.findFirst({ where: { id: materialId, programId } });
    if (!old) throw new NotFoundException('المادة غير موجودة');

    const m = await this.prisma.programMaterial.update({
      where: { id: materialId },
      data: {
        ...(title !== undefined && { title }),
        ...(upload && {
          filePath: upload.filePath,
          originalName: fixFileName(upload.file.originalname),
          mimeType: upload.file.mimetype,
        }),
      },
      select: MATERIAL_SELECT,
    });
    if (upload) await removeFile(old.filePath); // نحذف الملف القديم من القرص بعد نجاح التحديث
    return withUrl(m);
  }

  // ---------- Delete ----------
  async remove(instructorId: number, programId: number, materialId: number) {
    await this.assertOwner(programId, instructorId);
    const m = await this.prisma.programMaterial.findFirst({ where: { id: materialId, programId } });
    if (!m) throw new NotFoundException('المادة غير موجودة');
    await this.prisma.programMaterial.delete({ where: { id: materialId } });
    await removeFile(m.filePath);
    return { message: 'تم حذف المادة' };
  }
}

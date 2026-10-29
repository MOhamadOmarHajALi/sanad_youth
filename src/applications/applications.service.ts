import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgramsService } from '../programs/programs.service.js';
import { isUniqueError } from '../common/prisma-errors.js';
import { removeFile } from '../common/upload.js';

/**
 * سياسة المقاعد: يُحجز المقعد عند التقديم (PENDING) ويُعاد عند الرفض أو الإلغاء.
 * القبول يغيّر الحالة فقط. كل التحديثات شرطية (updateMany) لتكون ذرّية ضد التزامن.
 */
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramsService,
  ) {}

  async apply(userId: number, programId: number, cvPath: string) {
    let oldCv: string | null = null;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.application.findUnique({ where: { userId_programId: { userId, programId } } });

        if (existing) {
          // يُسمح بإعادة التقديم بعد الإلغاء فقط (الرفض نهائي)
          const claimed = await tx.application.updateMany({
            where: { id: existing.id, status: 'CANCELLED' },
            data: { status: 'PENDING', cvPath, reviewedAt: null, reviewedById: null },
          });
          if (claimed.count === 0) throw new ConflictException('لقد قدّمت على هذا البرنامج سابقاً');
          oldCv = existing.cvPath;
        }

        const reserved = await tx.program.updateMany({
          where: { id: programId, availableSeats: { gt: 0 } },
          data: { availableSeats: { decrement: 1 } },
        });
        if (reserved.count === 0) {
          const exists = await tx.program.count({ where: { id: programId } });
          if (!exists) throw new NotFoundException('البرنامج غير موجود');
          throw new BadRequestException('اكتملت المقاعد المتاحة لهذا البرنامج');
        }

        return existing
          ? tx.application.findUniqueOrThrow({ where: { id: existing.id } })
          : tx.application.create({ data: { userId, programId, cvPath } });
      });
      await this.programs.invalidateCache();
      await removeFile(oldCv);
      return result;
    } catch (e) {
      if (isUniqueError(e)) throw new ConflictException('لقد قدّمت على هذا البرنامج سابقاً');
      throw e;
    }
  }

  async cancel(userId: number, applicationId: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.application.updateMany({
        where: { id: applicationId, userId, status: { in: ['PENDING', 'ACCEPTED'] } },
        data: { status: 'CANCELLED' },
      });
      if (updated.count === 0) throw new NotFoundException('الطلب غير موجود أو لا يمكن إلغاؤه');
      const app = await tx.application.findUniqueOrThrow({ where: { id: applicationId } });
      await tx.program.update({ where: { id: app.programId }, data: { availableSeats: { increment: 1 } } });
      return app;
    });
    await this.programs.invalidateCache();
    return result;
  }

  /** قبول/رفض من الأدمن: فقط من حالة PENDING */
  async review(adminId: number, applicationId: number, status: 'ACCEPTED' | 'REJECTED') {
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.application.updateMany({
        where: { id: applicationId, status: 'PENDING' },
        data: { status, reviewedById: adminId, reviewedAt: new Date() },
      });
      if (updated.count === 0) throw new BadRequestException('الطلب غير موجود أو تمت مراجعته مسبقاً');
      const app = await tx.application.findUniqueOrThrow({ where: { id: applicationId } });
      if (status === 'REJECTED') {
        await tx.program.update({ where: { id: app.programId }, data: { availableSeats: { increment: 1 } } });
      }
      return app;
    });
    if (status === 'REJECTED') await this.programs.invalidateCache();
    return result;
  }

  mine(userId: number) {
    return this.prisma.application.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, status: true, createdAt: true, reviewedAt: true,
        program: { select: { id: true, title: true, image: true } },
      },
    });
  }
}

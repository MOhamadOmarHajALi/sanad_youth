import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAnnouncementDto } from './dto/announcement.dto.js';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** إعلان عام لكل الشباب (أدمن) */
  createGeneral(authorId: number, dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: { title: dto.title, content: dto.content, authorId, programId: null },
    });
  }

  /** إعلان خاص بمتدربي برنامج (مشرف البرنامج فقط) */
  async createForProgram(authorId: number, programId: number, dto: CreateAnnouncementDto) {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: { instructorId: true } });
    if (!program) throw new NotFoundException('البرنامج غير موجود');
    if (program.instructorId !== authorId) throw new ForbiddenException('هذا البرنامج ليس من برامجك');
    return this.prisma.announcement.create({
      data: { title: dto.title, content: dto.content, authorId, programId },
    });
  }

  /** الإعلانات العامة + إعلانات البرامج التي قُبل فيها الشاب فقط */
  async forYouth(userId: number) {
    const accepted = await this.prisma.application.findMany({
      where: { userId, status: 'ACCEPTED' },
      select: { programId: true },
    });
    return this.prisma.announcement.findMany({
      where: { OR: [{ programId: null }, { programId: { in: accepted.map((a) => a.programId) } }] },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { fullName: true } },
        program: { select: { id: true, title: true } },
      },
    });
  }
}

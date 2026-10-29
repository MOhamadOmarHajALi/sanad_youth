import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthUser } from '../common/decorators.js';
import { absolutePath, fixFileName } from '../common/upload.js';
import { CreateProgramDto, CreateSessionDto, ListProgramsDto } from './dto/program.dto.js';

const VERSION_KEY = 'programs:version';
const LIST_TTL_MS = 30_000;

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ---------- Cache: مفتاح يحتوي على رقم نسخة، وزيادة الرقم تُبطل كل صفحات القائمة ----------
  private async version() {
    return (await this.cache.get<number>(VERSION_KEY)) ?? 1;
  }
  async invalidateCache() {
    await this.cache.set(VERSION_KEY, (await this.version()) + 1, 24 * 60 * 60 * 1000);
  }

  // ---------- عام ----------
  async findAll(q: ListProgramsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const search = q.search?.trim() || undefined;
    const key = `programs:list:v${await this.version()}:${page}:${limit}:${search ?? ''}`;

    const cached = await this.cache.get(key);
    if (cached) return cached;

    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { instructor: { select: { id: true, fullName: true } } },
      }),
      this.prisma.program.count({ where }),
    ]);
    const result = { data, meta: { total, page, limit, lastPage: Math.max(1, Math.ceil(total / limit)) } };
    await this.cache.set(key, result, LIST_TTL_MS);
    return result;
  }

  /** تفاصيل البرنامج بدون المواد (المواد للمقبولين فقط) */
  async findOne(id: number) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, fullName: true } },
        sessions: { orderBy: { date: 'asc' } },
      },
    });
    if (!program) throw new NotFoundException('البرنامج غير موجود');
    return program;
  }

  // ---------- المواد (للمقبولين + مشرف البرنامج + الأدمن) ----------
  private async assertCanAccessMaterials(user: AuthUser, programId: number) {
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

  async listMaterials(user: AuthUser, programId: number) {
    await this.assertCanAccessMaterials(user, programId);
    const items = await this.prisma.programMaterial.findMany({
      where: { programId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, originalName: true, mimeType: true, createdAt: true },
    });
    return items.map((m) => ({ ...m, downloadUrl: `/programs/${programId}/materials/${m.id}/download` }));
  }

  async getMaterialFile(user: AuthUser, programId: number, materialId: number) {
    await this.assertCanAccessMaterials(user, programId);
    const m = await this.prisma.programMaterial.findFirst({ where: { id: materialId, programId } });
    if (!m) throw new NotFoundException('المادة غير موجودة');
    return { absPath: absolutePath(m.filePath), originalName: m.originalName, mimeType: m.mimeType };
  }

  // ---------- عمليات المشرف ----------
  async assertOwner(programId: number, instructorId: number) {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: { instructorId: true } });
    if (!program) throw new NotFoundException('البرنامج غير موجود');
    if (program.instructorId !== instructorId) throw new ForbiddenException('هذا البرنامج ليس من برامجك');
  }

  async create(instructorId: number, dto: CreateProgramDto) {
    const program = await this.prisma.program.create({
      data: { ...dto, availableSeats: dto.totalSeats, instructorId },
    });
    await this.invalidateCache();
    return program;
  }

  async addSession(instructorId: number, programId: number, dto: CreateSessionDto) {
    await this.assertOwner(programId, instructorId);
    return this.prisma.programSession.create({
      data: { programId, title: dto.title, date: new Date(dto.date), locationOrLink: dto.locationOrLink },
    });
  }

  async addMaterial(instructorId: number, programId: number, title: string, filePath: string, file: Express.Multer.File) {
    await this.assertOwner(programId, instructorId);
    return this.prisma.programMaterial.create({
      data: { programId, title, filePath, originalName: fixFileName(file.originalname), mimeType: file.mimetype },
      select: { id: true, title: true, originalName: true, mimeType: true, createdAt: true },
    });
  }
}
